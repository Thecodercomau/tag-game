import { randomBytes, randomUUID } from 'node:crypto';
import { DEFAULT_PROFILE } from '../../shared/constants.js';
import { sanitizeText } from '../../shared/utils.js';

const SESSION_TTL_MS = 1000 * 60 * 30;

export class PlayerManager {
  constructor() {
    this.bySocket = new Map();
    this.byId = new Map();
    this.byToken = new Map();
    this.cleanupTimer = setInterval(() => this.cleanup(), 60000);
    this.cleanupTimer.unref?.();
  }

  attach(socket, data = {}) {
    let client = null;
    if (data.resumeToken) {
      const candidate = this.byToken.get(data.resumeToken);
      if (candidate && Date.now() - candidate.lastSeen < SESSION_TTL_MS) client = candidate;
    }
    if (!client) {
      client = {
        id: randomUUID(),
        token: randomBytes(24).toString('hex'),
        socketId: socket.id,
        name: sanitizeText(data.name || '', 18) || `Runner${Math.floor(Math.random() * 900 + 100)}`,
        appearance: data.appearance || { ...DEFAULT_PROFILE },
        lobbyId: null,
        connected: true,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        ip: socket.handshake.address
      };
      this.byId.set(client.id, client);
      this.byToken.set(client.token, client);
    } else {
      if (data.name) client.name = sanitizeText(data.name, 18) || client.name;
      if (data.appearance) client.appearance = data.appearance;
      client.socketId = socket.id;
      client.connected = true;
      client.lastSeen = Date.now();
    }
    this.bySocket.set(socket.id, client);
    return client;
  }

  detach(socketId) {
    const client = this.bySocket.get(socketId);
    if (!client) return null;
    client.connected = false;
    client.lastSeen = Date.now();
    this.bySocket.delete(socketId);
    return client;
  }

  getBySocket(socketId) {
    return this.bySocket.get(socketId) || null;
  }

  getById(id) {
    return this.byId.get(id) || null;
  }

  updateProfile(client, { name, appearance }) {
    if (name) client.name = sanitizeText(name, 18) || client.name;
    if (appearance) client.appearance = appearance;
  }

  bindLobby(client, lobbyId) {
    client.lobbyId = lobbyId;
  }

  unbindLobby(client) {
    client.lobbyId = null;
  }

  remove(client) {
    client.connected = false;
    this.byId.delete(client.id);
    this.byToken.delete(client.token);
    this.bySocket.delete(client.socketId);
  }

  cleanup() {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [token, client] of this.byToken) {
      if (!client.connected && client.lastSeen < cutoff) {
        this.byToken.delete(token);
        this.byId.delete(client.id);
      }
    }
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}
