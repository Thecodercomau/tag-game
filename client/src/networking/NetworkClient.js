import { io } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@shared/constants.js';
import { CLIENT_EVENTS, SERVER_EVENTS } from '@shared/events.js';

const SESSION_KEY = 'tag.session.v1';
const ALL_SERVER_EVENTS = Object.values(SERVER_EVENTS);

export class NetworkClient {
  constructor({ getProfile } = {}) {
    this.getProfile = getProfile || (() => ({}));
    this.listeners = new Map();
    this.socket = null;
    this.connected = false;
    this.welcomed = false;
    this.token = this.readToken();
    this.rtt = null;
    this.pingTimer = null;
    this.connectPromise = null;
    this.connectResolve = null;
    this.connectReject = null;
    this.connectTimeout = null;
    this.serverUrl = import.meta.env.VITE_SERVER_URL || undefined;
  }

  readToken() {
    try { return sessionStorage.getItem(SESSION_KEY) || null; } catch { return null; }
  }

  writeToken(token) {
    this.token = token || null;
    try {
      if (token) sessionStorage.setItem(SESSION_KEY, token);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.listeners.get(event)?.delete(handler);
  }

  emitLocal(event, payload) {
    for (const handler of this.listeners.get(event) || []) {
      try { handler(payload); } catch (error) { console.error(`Listener for ${event} failed`, error); }
    }
  }

  ensureSocket() {
    if (this.socket) return;
    this.socket = io(this.serverUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 5000,
      timeout: 9000,
      withCredentials: false
    });
    this.socket.on('connect', () => {
      this.connected = true;
      this.sendHello();
      this.emitLocal('connection', { state: 'connected', socketId: this.socket.id });
    });
    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.welcomed = false;
      this.stopPing();
      this.emitLocal('connection', { state: 'disconnected', reason });
    });
    this.socket.on('connect_error', (error) => {
      this.connected = false;
      this.emitLocal('connection', { state: 'error', message: error?.message || 'Could not reach the server.' });
      if (this.connectReject) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
        this.connectReject(new Error('Could not reach the game server.'));
        this.connectReject = null;
        this.connectResolve = null;
      }
    });
    for (const event of ALL_SERVER_EVENTS) {
      this.socket.on(event, (payload) => {
        if (event === SERVER_EVENTS.WELCOME) this.handleWelcome(payload);
        this.emitLocal(event, payload);
      });
    }
  }

  sendHello() {
    const profile = this.getProfile();
    this.socket.emit(CLIENT_EVENTS.HELLO, {
      protocol: PROTOCOL_VERSION,
      name: profile.name,
      appearance: {
        characterId: profile.characterId,
        paletteId: profile.paletteId,
        outfitId: profile.outfitId,
        accessoryId: profile.accessoryId,
        trailId: profile.trailId
      },
      resumeToken: this.token || undefined
    });
  }

  handleWelcome(payload) {
    this.welcomed = true;
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
    if (payload?.token) this.writeToken(payload.token);
    this.emitLocal('connection', { state: 'ready', rtt: this.rtt });
    this.startPing();
    if (this.connectResolve) {
      this.connectResolve(payload);
      this.connectResolve = null;
      this.connectReject = null;
    }
  }

  connect() {
    this.ensureSocket();
    if (this.welcomed) return Promise.resolve({ resumed: true });
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.connectTimeout = setTimeout(() => {
        if (!this.connectResolve) return;
        this.connectReject = null;
        this.connectResolve = null;
        this.connectTimeout = null;
        reject(new Error('Connection timed out. Check that the game server is running.'));
      }, 9000);
    }).finally(() => {
      this.connectPromise = null;
    });
    if (this.socket.connected) this.sendHello();
    else if (!this.socket.active) this.socket.connect();
    return this.connectPromise;
  }

  startPing() {
    this.stopPing();
    const ping = () => {
      if (!this.socket?.connected) return;
      this.socket.emit(CLIENT_EVENTS.PING, { t: Date.now() });
    };
    ping();
    this.pingTimer = setInterval(ping, 3000);
    this.off(SERVER_EVENTS.PONG, this.handlePong);
    this.on(SERVER_EVENTS.PONG, this.handlePong);
  }

  handlePong = (payload) => {
    if (!payload || !Number.isFinite(payload.t)) return;
    const sample = Math.max(0, Date.now() - payload.t);
    this.rtt = this.rtt == null ? sample : Math.round(this.rtt * 0.7 + sample * 0.3);
    this.emitLocal('latency', { rtt: this.rtt, quality: this.quality() });
  };

  stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  quality() {
    if (this.rtt == null) return 'ok';
    if (this.rtt < 90) return 'good';
    if (this.rtt < 190) return 'ok';
    return 'poor';
  }

  emit(event, payload) {
    if (!this.socket?.connected) return false;
    this.socket.emit(event, payload);
    return true;
  }

  quickMatch(payload = {}) { return this.emit(CLIENT_EVENTS.QUICK_MATCH, { ...payload, name: this.getProfile().name, appearance: this.profileAppearance() }); }
  createLobby(payload) { return this.emit(CLIENT_EVENTS.CREATE_LOBBY, { ...payload, name: this.getProfile().name, appearance: this.profileAppearance() }); }
  joinLobby(code) { return this.emit(CLIENT_EVENTS.JOIN_LOBBY, { code, name: this.getProfile().name, appearance: this.profileAppearance() }); }
  leaveLobby() { return this.emit(CLIENT_EVENTS.LEAVE_LOBBY, {}); }
  listLobbies() { return this.emit(CLIENT_EVENTS.LIST_LOBBIES, {}); }
  setReady(ready) { return this.emit(CLIENT_EVENTS.READY, { ready }); }
  selectCharacter(appearance, name) { return this.emit(CLIENT_EVENTS.SELECT_CHARACTER, { appearance, name }); }
  updateSettings(payload) { return this.emit(CLIENT_EVENTS.UPDATE_SETTINGS, payload); }
  startMatch() { return this.emit(CLIENT_EVENTS.START_MATCH, {}); }
  kick(playerId) { return this.emit(CLIENT_EVENTS.KICK_PLAYER, { playerId }); }
  chat(message) { return this.emit(CLIENT_EVENTS.SEND_CHAT, { message }); }
  sendInput(seq, dx, dy, sprint) { return this.emit(CLIENT_EVENTS.INPUT, { seq, dx, dy, sprint }); }
  tag(targetId) { return this.emit(CLIENT_EVENTS.TAG, targetId ? { targetId } : {}); }
  interact(targetId) { return this.emit(CLIENT_EVENTS.INTERACT, targetId ? { targetId } : {}); }
  returnToLobby() { return this.emit(CLIENT_EVENTS.RETURN_TO_LOBBY, {}); }

  profileAppearance() {
    const profile = this.getProfile();
    return {
      characterId: profile.characterId,
      paletteId: profile.paletteId,
      outfitId: profile.outfitId,
      accessoryId: profile.accessoryId,
      trailId: profile.trailId
    };
  }

  disconnect() {
    this.stopPing();
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
    this.welcomed = false;
    this.connected = false;
    this.socket?.disconnect();
  }
}
