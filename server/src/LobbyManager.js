import { randomUUID } from 'node:crypto';
import {
  DEFAULT_OPTIONS,
  GAME_MODES,
  MAX_PLAYERS,
  MODE_MAP
} from '../../shared/constants.js';
import { makeRoomCode, sanitizeText } from '../../shared/utils.js';
import { MATCH_PHASES } from '../../shared/events.js';
import { GameError } from './GameError.js';
import { SERVER_EVENTS, ERROR_CODES } from '../../shared/events.js';

const MODE_INDEX = Object.fromEntries(GAME_MODES.map((mode) => [mode.id, mode]));

function clampOptions(lobby, incoming = {}) {
  const options = { ...lobby.options, ...incoming };
  const mode = MODE_INDEX[lobby.modeId] || MODE_INDEX.classic;
  options.duration = Math.max(60, Math.min(600, Number(options.duration) || DEFAULT_OPTIONS.duration));
  options.tagDistance = Math.max(40, Math.min(84, Number(options.tagDistance) || DEFAULT_OPTIONS.tagDistance));
  options.tagCooldownMs = Math.max(600, Math.min(3000, Number(options.tagCooldownMs) || DEFAULT_OPTIONS.tagCooldownMs));
  options.reviveRange = Math.max(50, Math.min(120, Number(options.reviveRange) || DEFAULT_OPTIONS.reviveRange));
  options.minPlayers = Math.max(mode.minPlayers, Math.min(8, Number(options.minPlayers) || DEFAULT_OPTIONS.minPlayers));
  options.maxPlayers = Math.max(mode.minPlayers, Math.min(mode.maxPlayers, Math.min(MAX_PLAYERS, Number(options.maxPlayers) || DEFAULT_OPTIONS.maxPlayers)));
  if (options.minPlayers > options.maxPlayers) options.minPlayers = options.maxPlayers;
  options.sprintEnabled = options.sprintEnabled !== false;
  options.countdown = Math.max(1, Math.min(6, Number(options.countdown) || DEFAULT_OPTIONS.countdown));
  options.scoreLimit = Math.max(0, Math.min(50, Number(options.scoreLimit) || 0));
  return options;
}

export class LobbyManager {
  constructor(io, { lanOnly = false, maxLobbies = 100 } = {}) {
    this.io = io;
    this.lanOnly = lanOnly;
    this.maxLobbies = maxLobbies;
    this.lobbies = new Map();
    this.codes = new Map();
    this.playerLobby = new Map();
  }

  create(client, payload) {
    if (this.playerLobby.has(client.id)) {
      throw new GameError(ERROR_CODES.ALREADY_IN_LOBBY, 'You are already in a lobby.');
    }
    if (this.lobbies.size >= this.maxLobbies) {
      throw new GameError(ERROR_CODES.SERVER_FULL, 'The server is hosting too many lobbies right now.');
    }
    const mode = MODE_INDEX[payload.modeId] || MODE_INDEX.classic;
    let visibility = this.lanOnly ? 'lan' : payload.visibility || 'public';
    if (!['public', 'private', 'lan'].includes(visibility)) visibility = 'public';
    const modeIds = GAME_MODES.map((entry) => entry.id);
    const modeId = modeIds.includes(payload.modeId) ? payload.modeId : 'classic';
    const mapIds = ['playground', 'campus', 'park', 'mall', 'neon'];
    const mapId = mapIds.includes(payload.mapId) ? payload.mapId : 'playground';
    const code = this.generateCode();
    const lobby = {
      id: randomUUID(),
      code,
      name: `${sanitizeText(client.name, 18) || 'Guest'}'s room`,
      hostId: client.id,
      modeId,
      mapId,
      visibility,
      state: 'waiting',
      options: clampOptions({ modeId, options: { ...DEFAULT_OPTIONS, maxPlayers: mode.maxPlayers } }, payload.options),
      createdAt: Date.now(),
      players: new Map(),
      chat: []
    };
    this.addPlayer(lobby, client);
    this.lobbies.set(lobby.id, lobby);
    this.codes.set(lobby.code, lobby.id);
    this.playerLobby.set(client.id, lobby.id);
    return lobby;
  }

  quickMatch(client, payload = {}) {
    const candidates = [...this.lobbies.values()]
      .filter((lobby) => lobby.visibility === 'public' && lobby.state === 'waiting' && lobby.players.size < lobby.options.maxPlayers)
      .filter((lobby) => !payload.modeId || lobby.modeId === payload.modeId)
      .sort((a, b) => b.players.size - a.players.size || a.createdAt - b.createdAt);
    if (candidates.length) {
      const lobby = candidates[0];
      this.join(client, lobby.code);
      return { lobby, created: false };
    }
    const lobby = this.create(client, {
      modeId: payload.modeId || 'classic',
      mapId: 'playground',
      visibility: 'public',
      options: {}
    });
    return { lobby, created: true };
  }

  join(client, code) {
    const lobbyId = this.codes.get(String(code).toUpperCase());
    if (!lobbyId) throw new GameError(ERROR_CODES.INVALID_CODE, 'That room code does not exist.');
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new GameError(ERROR_CODES.LOBBY_NOT_FOUND, 'That lobby is no longer available.');
    if (lobby.state !== 'waiting') throw new GameError(ERROR_CODES.LOBBY_IN_PROGRESS, 'That match has already started.');
    if (this.playerLobby.has(client.id) && this.playerLobby.get(client.id) !== lobby.id) {
      throw new GameError(ERROR_CODES.ALREADY_IN_LOBBY, 'Leave your current lobby first.');
    }
    if (lobby.players.size >= lobby.options.maxPlayers) {
      throw new GameError(ERROR_CODES.LOBBY_FULL, 'That lobby is full.');
    }
    this.addPlayer(lobby, client);
    this.playerLobby.set(client.id, lobby.id);
    this.addChat(lobby, { system: true, message: `${client.name} joined the lobby` });
    this.broadcastUpdate(lobby);
    return lobby;
  }

  addPlayer(lobby, client) {
    lobby.players.set(client.id, {
      id: client.id,
      name: sanitizeText(client.name, 18) || 'Guest',
      appearance: client.appearance,
      socketId: client.socketId,
      ready: false,
      isHost: lobby.hostId === client.id,
      connected: true,
      joinedAt: Date.now()
    });
  }

  generateCode() {
    let code = makeRoomCode();
    let attempts = 0;
    while (this.codes.has(code) && attempts < 200) {
      code = makeRoomCode();
      attempts += 1;
    }
    return code;
  }

  getById(lobbyId) {
    return this.lobbies.get(lobbyId) || null;
  }

  getByPlayer(playerId) {
    const lobbyId = this.playerLobby.get(playerId);
    return lobbyId ? this.lobbies.get(lobbyId) || null : null;
  }

  getPlayerLobbyId(playerId) {
    return this.playerLobby.get(playerId) || null;
  }

  view(lobby, viewerId) {
    return {
      id: lobby.id,
      code: lobby.code,
      name: lobby.name,
      hostId: lobby.hostId,
      modeId: lobby.modeId,
      mapId: lobby.mapId,
      visibility: lobby.visibility,
      state: lobby.state,
      options: { ...lobby.options },
      players: [...lobby.players.values()]
        .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.joinedAt - b.joinedAt)
        .map((player) => ({ ...player, isYou: player.id === viewerId })),
      chat: lobby.chat.slice(-30),
      you: viewerId
    };
  }

  summary(lobby) {
    return {
      code: lobby.code,
      name: lobby.name,
      modeId: lobby.modeId,
      mapId: lobby.mapId,
      players: lobby.players.size,
      maxPlayers: lobby.options.maxPlayers,
      state: lobby.state,
      visibility: lobby.visibility,
      hostName: [...lobby.players.values()].find((player) => player.isHost)?.name || 'Host'
    };
  }

  listPublic() {
    return [...this.lobbies.values()]
      .filter((lobby) => lobby.visibility === 'public' && lobby.state === 'waiting')
      .sort((a, b) => b.players.size - a.players.size || b.createdAt - a.createdAt)
      .map((lobby) => this.summary(lobby));
  }

  broadcastUpdate(lobby) {
    if (!lobby) return;
    this.io.to(lobby.id).emit(SERVER_EVENTS.LOBBY_UPDATE, { lobby: this.view(lobby, null) });
  }

  sendLobbyTo(playerSocket, lobby, viewerId) {
    playerSocket.emit(SERVER_EVENTS.LOBBY_JOINED, { lobby: this.view(lobby, viewerId) });
  }

  removePlayer(lobby, playerId, { reason = 'left' } = {}) {
    const player = lobby.players.get(playerId);
    if (!player) return null;
    lobby.players.delete(playerId);
    this.playerLobby.delete(playerId);
    if (lobby.hostId === playerId) {
      const nextHost = [...lobby.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      lobby.hostId = nextHost?.id || null;
      for (const entry of lobby.players.values()) entry.isHost = entry.id === lobby.hostId;
    }
    if (lobby.players.size === 0) {
      this.deleteLobby(lobby);
      return { lobby: null, player, deleted: true };
    }
    this.addChat(lobby, { system: true, message: `${player.name} ${reason}` });
    this.broadcastUpdate(lobby);
    return { lobby, player, deleted: false };
  }

  leave(client) {
    const lobby = this.getByPlayer(client.id);
    if (!lobby) return null;
    return this.removePlayer(lobby, client.id);
  }

  deleteLobby(lobby) {
    this.lobbies.delete(lobby.id);
    this.codes.delete(lobby.code);
    for (const playerId of lobby.players.keys()) this.playerLobby.delete(playerId);
  }

  setReady(lobby, playerId, ready) {
    const player = lobby.players.get(playerId);
    if (!player) throw new GameError(ERROR_CODES.NOT_IN_LOBBY, 'You are not in this lobby.');
    if (lobby.state !== 'waiting') throw new GameError(ERROR_CODES.LOBBY_IN_PROGRESS, 'The match has already started.');
    player.ready = Boolean(ready);
    this.broadcastUpdate(lobby);
  }

  updateCharacter(lobby, playerId, { name, appearance }) {
    const player = lobby.players.get(playerId);
    if (!player) throw new GameError(ERROR_CODES.NOT_IN_LOBBY, 'You are not in this lobby.');
    if (name) player.name = sanitizeText(name, 18) || player.name;
    if (appearance) player.appearance = appearance;
    this.broadcastUpdate(lobby);
    return player;
  }

  updateSettings(lobby, playerId, payload) {
    if (lobby.hostId !== playerId) throw new GameError(ERROR_CODES.NOT_HOST, 'Only the host can change match settings.');
    if (lobby.state !== 'waiting') throw new GameError(ERROR_CODES.LOBBY_IN_PROGRESS, 'Settings are locked during a match.');
    if (payload.mapId) lobby.mapId = payload.mapId;
    if (payload.modeId) {
      lobby.modeId = payload.modeId;
      const mode = MODE_INDEX[lobby.modeId];
      if (lobby.options.maxPlayers > mode.maxPlayers) lobby.options.maxPlayers = mode.maxPlayers;
    }
    if (payload.options) lobby.options = clampOptions(lobby, payload.options);
    if (lobby.players.size > lobby.options.maxPlayers) {
      throw new GameError(ERROR_CODES.LOBBY_FULL, 'The new player limit is below the current player count.');
    }
    for (const player of lobby.players.values()) player.ready = player.id === playerId;
    this.broadcastUpdate(lobby);
    return lobby;
  }

  canStart(lobby, playerId) {
    if (!lobby) throw new GameError(ERROR_CODES.LOBBY_NOT_FOUND, 'Lobby not found.');
    if (lobby.hostId !== playerId) throw new GameError(ERROR_CODES.NOT_HOST, 'Only the host can start the match.');
    if (lobby.state !== 'waiting') throw new GameError(ERROR_CODES.LOBBY_IN_PROGRESS, 'The match is already running.');
    if (lobby.players.size > lobby.options.maxPlayers) throw new GameError(ERROR_CODES.LOBBY_FULL, 'Too many players.');
    const mode = MODE_INDEX[lobby.modeId];
    const required = Math.max(mode.minPlayers, lobby.options.minPlayers);
    if (lobby.players.size < required) {
      throw new GameError(ERROR_CODES.TOO_FEW_PLAYERS, `Need at least ${required} players for ${mode.name}.`);
    }
    const notReady = [...lobby.players.values()].filter((player) => !player.ready);
    if (notReady.length) throw new GameError(ERROR_CODES.NOT_READY, 'Everyone needs to be ready.');
    return true;
  }

  startMatch(lobby, playerId) {
    this.canStart(lobby, playerId);
    lobby.state = 'in-progress';
    for (const player of lobby.players.values()) player.ready = false;
    this.broadcastUpdate(lobby);
    return { ...lobby, playerList: [...lobby.players.values()] };
  }

  endMatch(lobby) {
    if (!lobby) return;
    lobby.state = 'waiting';
    for (const player of lobby.players.values()) player.ready = false;
    this.broadcastUpdate(lobby);
  }

  addChat(lobby, message) {
    const entry = {
      id: randomUUID(),
      at: Date.now(),
      system: Boolean(message.system),
      playerId: message.playerId || null,
      name: sanitizeText(message.name || '', 18) || 'System',
      message: sanitizeText(message.message, 140)
    };
    if (!entry.message) return null;
    lobby.chat.push(entry);
    if (lobby.chat.length > 60) lobby.chat.shift();
    return entry;
  }

  chat(lobby, playerId, message) {
    const player = lobby.players.get(playerId);
    if (!player) throw new GameError(ERROR_CODES.NOT_IN_LOBBY, 'You are not in this lobby.');
    const entry = this.addChat(lobby, { playerId, name: player.name, message });
    if (entry) this.io.to(lobby.id).emit(SERVER_EVENTS.CHAT, { entry });
    return entry;
  }

  markConnected(lobby, playerId, connected) {
    const player = lobby.players.get(playerId);
    if (!player) return;
    player.connected = connected;
    this.broadcastUpdate(lobby);
  }
}
