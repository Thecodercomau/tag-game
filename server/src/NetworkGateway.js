import {
  PROTOCOL_VERSION
} from '../../shared/constants.js';
import { CLIENT_EVENTS, ERROR_CODES, SERVER_EVENTS } from '../../shared/events.js';
import {
  chatSchema,
  characterSchema,
  createLobbySchema,
  helloSchema,
  inputSchema,
  interactSchema,
  joinLobbySchema,
  kickSchema,
  parse,
  pingSchema,
  quickMatchSchema,
  readySchema,
  rejoinSchema,
  tagSchema,
  updateSettingsSchema
} from '../../shared/schemas.js';
import { sanitizeText } from '../../shared/utils.js';
import { GameError } from './GameError.js';

export class NetworkGateway {
  constructor({ io, players, lobbies, matches, security, config }) {
    this.io = io;
    this.players = players;
    this.lobbies = lobbies;
    this.matches = matches;
    this.security = security;
    this.config = config;
  }

  register() {
    this.io.on('connection', (socket) => {
      const ip = socket.handshake.address || 'unknown';
      if (!this.security.tryConnect(ip)) {
        socket.emit(SERVER_EVENTS.ERROR, {
          code: ERROR_CODES.SERVER_FULL,
          message: 'Too many connections from this address.'
        });
        socket.disconnect(true);
        return;
      }
      socket.data.ip = ip;
      socket.on(CLIENT_EVENTS.HELLO, (payload) => this.onHello(socket, payload));
      socket.on(CLIENT_EVENTS.QUICK_MATCH, (payload) => this.onQuickMatch(socket, payload));
      socket.on(CLIENT_EVENTS.LIST_LOBBIES, () => this.onListLobbies(socket));
      socket.on(CLIENT_EVENTS.CREATE_LOBBY, (payload) => this.onCreateLobby(socket, payload));
      socket.on(CLIENT_EVENTS.JOIN_LOBBY, (payload) => this.onJoinLobby(socket, payload));
      socket.on(CLIENT_EVENTS.LEAVE_LOBBY, () => this.onLeaveLobby(socket));
      socket.on(CLIENT_EVENTS.READY, (payload) => this.onReady(socket, payload));
      socket.on(CLIENT_EVENTS.SELECT_CHARACTER, (payload) => this.onCharacter(socket, payload));
      socket.on(CLIENT_EVENTS.UPDATE_SETTINGS, (payload) => this.onUpdateSettings(socket, payload));
      socket.on(CLIENT_EVENTS.START_MATCH, () => this.onStartMatch(socket));
      socket.on(CLIENT_EVENTS.KICK_PLAYER, (payload) => this.onKick(socket, payload));
      socket.on(CLIENT_EVENTS.SEND_CHAT, (payload) => this.onChat(socket, payload));
      socket.on(CLIENT_EVENTS.INPUT, (payload) => this.onInput(socket, payload));
      socket.on(CLIENT_EVENTS.TAG, (payload) => this.onTag(socket, payload));
      socket.on(CLIENT_EVENTS.INTERACT, (payload) => this.onInteract(socket, payload));
      socket.on(CLIENT_EVENTS.PING, (payload) => this.onPing(socket, payload));
      socket.on(CLIENT_EVENTS.REJOIN, (payload) => this.onRejoin(socket, payload));
      socket.on(CLIENT_EVENTS.RETURN_TO_LOBBY, () => this.onReturnToLobby(socket));
      socket.on('disconnect', () => this.onDisconnect(socket));
      socket.on('error', (error) => {
        if (process.env.NODE_ENV !== 'test') console.warn('Socket error', error?.message || error);
      });
    });
  }

  onHello(socket, payload) {
    if (socket.data.clientId) return;
    if (!this.limit(socket, 'hello')) return;
    const result = parse(helloSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    if (result.data.protocol && result.data.protocol !== PROTOCOL_VERSION) {
      return this.fail(socket, ERROR_CODES.VERSION_MISMATCH, 'This client is out of date. Refresh the page.');
    }
    const client = this.players.attach(socket, result.data);
    socket.data.clientId = client.id;
    this.resumeSession(socket, client, Boolean(result.data.resumeToken));
  }

  onRejoin(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(rejoinSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    if (result.data.token !== client.token) {
      return this.fail(socket, ERROR_CODES.RESUME_EXPIRED, 'That session is no longer valid.');
    }
    this.resumeSession(socket, client, true);
  }

  resumeSession(socket, client, resumed) {
    socket.emit(SERVER_EVENTS.WELCOME, {
      playerId: client.id,
      token: client.token,
      name: client.name,
      appearance: client.appearance,
      protocol: PROTOCOL_VERSION,
      serverTime: Date.now(),
      resumed
    });
    if (!client.lobbyId) return;
    const lobby = this.lobbies.getById(client.lobbyId);
    if (!lobby || !lobby.players.has(client.id)) {
      client.lobbyId = null;
      return;
    }
    const player = lobby.players.get(client.id);
    player.socketId = socket.id;
    player.connected = true;
    socket.join(lobby.id);
    this.lobbies.sendLobbyTo(socket, lobby, client.id);
    this.lobbies.broadcastUpdate(lobby);
    if (lobby.state !== 'in-progress') return;
    const state = this.matches.reconnect(lobby.id, client.id);
    if (!state) return;
    socket.emit(SERVER_EVENTS.MATCH_STARTING, {
      lobby: this.lobbies.view(lobby, client.id),
      state,
      serverTime: Date.now()
    });
    socket.emit(SERVER_EVENTS.MATCH_STATE, state);
    this.lobbies.markConnected(lobby, client.id, true);
  }

  onListLobbies(socket) {
    const client = this.client(socket);
    if (!client) return;
    socket.emit(SERVER_EVENTS.LOBBY_LIST, { lobbies: this.lobbies.listPublic() });
  }

  onQuickMatch(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(quickMatchSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      if (client.lobbyId) throw new GameError(ERROR_CODES.ALREADY_IN_LOBBY, 'Leave your current lobby first.');
      this.applyProfile(client, result.data);
      const { lobby, created } = this.lobbies.quickMatch(client, result.data);
      this.enterLobby(socket, client, lobby, created ? 'Quick Match room created.' : 'Joined an open lobby.');
      this.broadcastLobbyList();
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onCreateLobby(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(createLobbySchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      if (client.lobbyId) throw new GameError(ERROR_CODES.ALREADY_IN_LOBBY, 'Leave your current lobby first.');
      this.applyProfile(client, result.data);
      const lobby = this.lobbies.create(client, result.data);
      this.enterLobby(socket, client, lobby, `Room ${lobby.code} created.`);
      this.broadcastLobbyList();
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onJoinLobby(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(joinLobbySchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      if (client.lobbyId) throw new GameError(ERROR_CODES.ALREADY_IN_LOBBY, 'Leave your current lobby first.');
      this.applyProfile(client, result.data);
      const lobby = this.lobbies.join(client, result.data.code);
      this.enterLobby(socket, client, lobby, `Joined room ${lobby.code}.`);
      this.broadcastLobbyList();
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  enterLobby(socket, client, lobby, notice) {
    socket.join(lobby.id);
    client.lobbyId = lobby.id;
    const player = lobby.players.get(client.id);
    if (player) player.socketId = socket.id;
    this.lobbies.sendLobbyTo(socket, lobby, client.id);
    if (notice) this.lobbies.addChat(lobby, { system: true, message: notice });
    this.lobbies.broadcastUpdate(lobby);
  }

  onLeaveLobby(socket) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const lobby = this.lobbies.getByPlayer(client.id);
    if (!lobby) {
      socket.emit(SERVER_EVENTS.LOBBY_LEFT, {});
      return;
    }
    if (lobby.state === 'in-progress') this.matches.leaveMatch(lobby.id, client.id);
    this.lobbies.removePlayer(lobby, client.id, { reason: 'left the lobby' });
    socket.leave(lobby.id);
    client.lobbyId = null;
    socket.emit(SERVER_EVENTS.LOBBY_LEFT, { lobbyId: lobby.id });
    this.broadcastLobbyList();
  }

  onReady(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(readySchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      const lobby = this.requireLobby(client);
      this.lobbies.setReady(lobby, client.id, result.data.ready);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onCharacter(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(characterSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      const lobby = this.requireLobby(client);
      if (lobby.state !== 'waiting') throw new GameError(ERROR_CODES.LOBBY_IN_PROGRESS, 'Characters are locked during a match.');
      this.players.updateProfile(client, result.data);
      this.lobbies.updateCharacter(lobby, client.id, result.data);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onUpdateSettings(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(updateSettingsSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      const lobby = this.requireLobby(client);
      this.lobbies.updateSettings(lobby, client.id, result.data);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onStartMatch(socket) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    try {
      const lobby = this.requireLobby(client);
      this.lobbies.canStart(lobby, client.id);
      const started = this.matches.start(lobby, client.id);
      this.lobbies.startMatch(lobby, client.id);
      this.io.to(lobby.id).emit(SERVER_EVENTS.MATCH_STATE, started.state);
      this.broadcastLobbyList();
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onKick(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'action')) return;
    const result = parse(kickSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      const lobby = this.requireLobby(client);
      if (lobby.hostId !== client.id) throw new GameError(ERROR_CODES.NOT_HOST, 'Only the host can remove players.');
      if (lobby.state !== 'waiting') throw new GameError(ERROR_CODES.LOBBY_IN_PROGRESS, 'You cannot remove players during a match.');
      const target = lobby.players.get(result.data.playerId);
      if (!target) throw new GameError(ERROR_CODES.NOT_IN_LOBBY, 'That player is not in this lobby.');
      if (target.id === client.id) throw new GameError(ERROR_CODES.NOT_HOST, 'You cannot kick yourself.');
      const targetSocket = this.io.sockets.sockets.get(target.socketId);
      this.lobbies.removePlayer(lobby, target.id, { reason: 'was removed by the host' });
      if (targetSocket) {
        targetSocket.leave(lobby.id);
        targetSocket.emit(SERVER_EVENTS.ERROR, {
          code: ERROR_CODES.KICKED,
          message: 'The host removed you from the lobby.',
          context: 'kick'
        });
      }
      const targetClient = this.players.getById(target.id);
      if (targetClient) targetClient.lobbyId = null;
      this.broadcastLobbyList();
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onChat(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'chat')) return;
    const result = parse(chatSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      const lobby = this.requireLobby(client);
      const message = sanitizeText(result.data.message, 140);
      if (!message) throw new GameError(ERROR_CODES.INVALID_PAYLOAD, 'Message is empty.');
      this.lobbies.chat(lobby, client.id, message);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onInput(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'input')) return;
    if (!client.lobbyId) return;
    const result = parse(inputSchema, payload || {});
    if (!result.ok) return;
    this.matches.setInput(client.lobbyId, client.id, result.data);
  }

  onTag(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'tag')) return;
    const result = parse(tagSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      const lobby = this.requireLobby(client);
      const outcome = this.matches.requestTag(lobby.id, client.id, result.data.targetId || null);
      socket.emit(SERVER_EVENTS.TAG_RESULT, { type: 'tag', ...outcome });
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onInteract(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    if (!this.limit(socket, 'tag')) return;
    const result = parse(interactSchema, payload || {});
    if (!result.ok) return this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, result.error);
    try {
      const lobby = this.requireLobby(client);
      const outcome = this.matches.requestInteract(lobby.id, client.id, result.data.targetId || null);
      socket.emit(SERVER_EVENTS.TAG_RESULT, { type: 'interact', ...outcome });
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  onPing(socket, payload) {
    const client = this.client(socket);
    if (!client) return;
    const result = parse(pingSchema, payload || {});
    if (!result.ok) return;
    socket.emit(SERVER_EVENTS.PONG, { t: result.data.t, serverTime: Date.now() });
  }

  onReturnToLobby(socket) {
    const client = this.client(socket);
    if (!client) return;
    const lobby = this.lobbies.getByPlayer(client.id);
    if (!lobby) return;
    socket.emit(SERVER_EVENTS.LOBBY_JOINED, { lobby: this.lobbies.view(lobby, client.id) });
  }

  onDisconnect(socket) {
    this.security.disconnect(socket.data.ip);
    const client = this.players.detach(socket.id);
    if (!client || !client.lobbyId) return;
    const lobby = this.lobbies.getById(client.lobbyId);
    if (!lobby) {
      client.lobbyId = null;
      return;
    }
    if (lobby.state === 'in-progress') {
      this.lobbies.markConnected(lobby, client.id, false);
      this.matches.disconnect(lobby.id, client.id);
    } else {
      const target = lobby.players.get(client.id);
      if (target) target.socketId = socket.id;
      this.lobbies.removePlayer(lobby, client.id, { reason: 'disconnected' });
      client.lobbyId = null;
    }
    this.broadcastLobbyList();
  }

  applyProfile(client, data) {
    if (!data) return;
    this.players.updateProfile(client, { name: data.name, appearance: data.appearance });
  }

  client(socket) {
    if (!socket.data.clientId) {
      this.fail(socket, ERROR_CODES.INVALID_PAYLOAD, 'Send a hello message first.');
      return null;
    }
    return this.players.getById(socket.data.clientId);
  }

  requireLobby(client) {
    const lobby = this.lobbies.getByPlayer(client.id);
    if (!lobby) throw new GameError(ERROR_CODES.NOT_IN_LOBBY, 'You are not in a lobby.');
    return lobby;
  }

  limit(socket, type) {
    const key = socket.data.clientId || socket.id;
    const result = this.security.consume(key, type);
    if (!result.ok) {
      this.fail(socket, ERROR_CODES.RATE_LIMITED, `Slow down — retry in ${result.retryAfter}ms.`);
      return false;
    }
    return true;
  }

  broadcastLobbyList() {
    this.io.emit(SERVER_EVENTS.LOBBY_LIST, { lobbies: this.lobbies.listPublic() });
  }

  fail(socket, code, message, context = null) {
    socket.emit(SERVER_EVENTS.ERROR, { code, message, context });
  }

  handleError(socket, error) {
    if (error instanceof GameError) {
      this.fail(socket, error.code, error.message);
      return;
    }
    console.error('Unhandled gateway error', error);
    this.fail(socket, ERROR_CODES.INTERNAL, 'Something went wrong on the server.');
  }
}
