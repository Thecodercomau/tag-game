import { randomUUID } from 'node:crypto';
import { MatchEngine } from '../../shared/MatchEngine.js';
import {
  RECONNECT_GRACE_MS,
  SNAPSHOT_RATE,
  TICK_RATE
} from '../../shared/constants.js';
import { ERROR_CODES, MATCH_PHASES, SERVER_EVENTS } from '../../shared/events.js';
import { GameError } from './GameError.js';
import { getServerMode } from './game-modes/index.js';
import { MovementValidator } from './validation/MovementValidator.js';
import { validateInteractAttempt, validateTagAttempt } from './validation/TagValidator.js';

export class MatchManager {
  constructor(io, lobbies, { reconnectGraceMs = RECONNECT_GRACE_MS, tickRate = TICK_RATE } = {}) {
    this.io = io;
    this.lobbies = lobbies;
    this.matches = new Map();
    this.movementValidator = new MovementValidator();
    this.reconnectGraceMs = reconnectGraceMs;
    this.tickRate = tickRate;
    this.snapshotInterval = 1000 / SNAPSHOT_RATE;
    this.history = [];
  }

  start(lobby, playerId) {
    if (this.matches.has(lobby.id)) throw new GameError(ERROR_CODES.LOBBY_IN_PROGRESS, 'A match is already running in this lobby.');
    const mode = getServerMode(lobby.modeId);
    if (!mode.canStart(lobby.players.size)) {
      throw new GameError(ERROR_CODES.TOO_FEW_PLAYERS, `${mode.meta.name} needs at least ${mode.meta.minPlayers} players.`);
    }
    const players = [...lobby.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      appearance: player.appearance
    }));
    const matchId = randomUUID();
    const engine = new MatchEngine({
      matchId,
      modeId: lobby.modeId,
      mapId: lobby.mapId,
      options: lobby.options,
      players
    });
    engine.addEvent({
      type: 'round-start',
      message: `${mode.meta.name} on ${lobby.mapId}`
    });
    const entry = {
      id: matchId,
      lobby,
      engine,
      timer: null,
      reconnectTimers: new Map(),
      ended: false,
      lastTick: Date.now(),
      lastSnapshot: 0,
      startedAt: Date.now()
    };
    this.matches.set(lobby.id, entry);
    const state = this.snapshot(entry);
    this.io.to(lobby.id).emit(SERVER_EVENTS.MATCH_STARTING, {
      lobby: this.lobbies.view(lobby, null),
      state,
      serverTime: Date.now()
    });
    this.io.to(lobby.id).emit(SERVER_EVENTS.MATCH_STATE, state);
    entry.timer = setInterval(() => this.tick(entry), Math.round(1000 / this.tickRate));
    return { matchId, state };
  }

  get(lobbyId) {
    return this.matches.get(lobbyId) || null;
  }

  snapshot(entry) {
    return {
      ...entry.engine.serialize(),
      serverTime: Date.now(),
      matchId: entry.id
    };
  }

  tick(entry) {
    if (!entry || entry.ended) return;
    try {
      const now = Date.now();
      const delta = Math.max(0, Math.min(0.1, (now - entry.lastTick) / 1000));
      entry.lastTick = now;
      entry.engine.tick(delta);
      const events = entry.engine.drainEvents();
      for (const event of events) {
        this.io.to(entry.lobby.id).emit(SERVER_EVENTS.MATCH_EVENT, { ...event, matchId: entry.id });
      }
      if (entry.engine.phase === MATCH_PHASES.ENDED) {
        this.finish(entry);
        return;
      }
      if (now - entry.lastSnapshot >= this.snapshotInterval) {
        entry.lastSnapshot = now;
        this.io.to(entry.lobby.id).emit(SERVER_EVENTS.MATCH_STATE, this.snapshot(entry));
      }
    } catch (error) {
      console.error('Match tick failed', error);
      entry.engine.finish('server-error', [], 'Match ended', 'The server could not continue this match.');
      this.finish(entry);
    }
  }

  finish(entry) {
    if (entry.ended) return;
    entry.ended = true;
    if (entry.timer) clearInterval(entry.timer);
    for (const timer of entry.reconnectTimers.values()) clearTimeout(timer);
    entry.reconnectTimers.clear();
    const results = entry.engine.results || entry.engine.finish('ended', [], 'Match complete', 'The round is over.');
    for (const player of [...entry.lobby.players.values()]) {
      if (!player.connected) this.lobbies.removePlayer(entry.lobby, player.id, { reason: 'disconnected' });
    }
    this.io.to(entry.lobby.id).emit(SERVER_EVENTS.MATCH_STATE, this.snapshot(entry));
    this.io.to(entry.lobby.id).emit(SERVER_EVENTS.MATCH_END, {
      results,
      lobby: this.lobbies.view(entry.lobby, null),
      serverTime: Date.now()
    });
    this.lobbies.endMatch(entry.lobby);
    this.history.unshift(results);
    if (this.history.length > 40) this.history.pop();
    this.matches.delete(entry.lobby.id);
    for (const player of entry.lobby.players.values()) {
      player.ready = false;
    }
  }

  requirePlayer(entry, playerId) {
    if (!entry) throw new GameError(ERROR_CODES.LOBBY_NOT_FOUND, 'No active match.');
    const player = entry.engine.getPlayer(playerId);
    if (!player) throw new GameError(ERROR_CODES.NOT_IN_LOBBY, 'You are not in this match.');
    return player;
  }

  setInput(lobbyId, playerId, payload) {
    const entry = this.matches.get(lobbyId);
    if (!entry) return false;
    this.requirePlayer(entry, playerId);
    const result = this.movementValidator.validate(payload);
    if (!result.ok) return false;
    return entry.engine.setInput(playerId, result.data);
  }

  requestTag(lobbyId, playerId, targetId = null) {
    const entry = this.matches.get(lobbyId);
    if (!entry) throw new GameError(ERROR_CODES.LOBBY_NOT_FOUND, 'No active match.');
    this.requirePlayer(entry, playerId);
    const precheck = validateTagAttempt(entry.engine, playerId, targetId);
    if (!precheck.ok) return { ok: false, reason: precheck.reason };
    return entry.engine.requestTag(playerId, targetId);
  }

  requestInteract(lobbyId, playerId, targetId = null) {
    const entry = this.matches.get(lobbyId);
    if (!entry) throw new GameError(ERROR_CODES.LOBBY_NOT_FOUND, 'No active match.');
    this.requirePlayer(entry, playerId);
    const precheck = validateInteractAttempt(entry.engine, playerId, targetId);
    if (!precheck.ok) return { ok: false, reason: precheck.reason };
    return entry.engine.requestInteract(playerId, targetId);
  }

  disconnect(lobbyId, playerId) {
    const entry = this.matches.get(lobbyId);
    if (!entry) return;
    entry.engine.setConnected(playerId, false);
    this.lobbies.markConnected(entry.lobby, playerId, false);
    this.io.to(entry.lobby.id).emit(SERVER_EVENTS.MATCH_STATE, this.snapshot(entry));
    if (entry.reconnectTimers.has(playerId)) clearTimeout(entry.reconnectTimers.get(playerId));
    const timer = setTimeout(() => {
      entry.reconnectTimers.delete(playerId);
      if (entry.ended) return;
      entry.engine.removePlayer(playerId);
      this.lobbies.removePlayer(entry.lobby, playerId, { reason: 'disconnected' });
      this.io.to(entry.lobby.id).emit(SERVER_EVENTS.MATCH_STATE, this.snapshot(entry));
      if (entry.engine.phase === MATCH_PHASES.ENDED) {
        this.finish(entry);
        return;
      }
      const connected = entry.engine.players.filter((player) => player.connected && !player.eliminated);
      if (connected.length <= 1) {
        const winner = connected[0];
        entry.engine.finish(
          'not-enough-players',
          winner ? [winner.id] : [],
          winner ? `${winner.name} wins by default` : 'Match abandoned',
          'Not enough players remain to continue.'
        );
        this.finish(entry);
      }
    }, this.reconnectGraceMs);
    timer.unref?.();
    entry.reconnectTimers.set(playerId, timer);
  }

  reconnect(lobbyId, playerId) {
    const entry = this.matches.get(lobbyId);
    if (!entry) return null;
    const timer = entry.reconnectTimers.get(playerId);
    if (timer) clearTimeout(timer);
    entry.reconnectTimers.delete(playerId);
    entry.engine.setConnected(playerId, true);
    this.lobbies.markConnected(entry.lobby, playerId, true);
    const state = this.snapshot(entry);
    this.io.to(entry.lobby.id).emit(SERVER_EVENTS.MATCH_STATE, state);
    return state;
  }

  leaveMatch(lobbyId, playerId) {
    const entry = this.matches.get(lobbyId);
    if (!entry) return null;
    const timer = entry.reconnectTimers.get(playerId);
    if (timer) clearTimeout(timer);
    entry.reconnectTimers.delete(playerId);
    entry.engine.removePlayer(playerId);
    const remaining = entry.engine.players.filter((player) => player.connected && !player.eliminated);
    if (entry.engine.phase === MATCH_PHASES.ENDED) {
      this.finish(entry);
    } else if (remaining.length <= 1) {
      const winner = remaining[0];
      entry.engine.finish(
        'not-enough-players',
        winner ? [winner.id] : [],
        winner ? `${winner.name} wins by default` : 'Match abandoned',
        'Not enough players remain to continue.'
      );
      this.finish(entry);
    }
    return true;
  }

  getStateFor(lobby, playerId) {
    const entry = this.matches.get(lobby.id);
    if (!entry) return null;
    return this.snapshot(entry);
  }

  shutdown() {
    for (const entry of this.matches.values()) {
      if (entry.timer) clearInterval(entry.timer);
      for (const timer of entry.reconnectTimers.values()) clearTimeout(timer);
    }
    this.matches.clear();
  }
}
