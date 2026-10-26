import { afterEach, describe, expect, it } from 'vitest';
import { io } from 'socket.io-client';
import { createTagServer } from '../../server/src/index.js';
import { CLIENT_EVENTS, SERVER_EVENTS } from '../../shared/events.js';
import { PROTOCOL_VERSION } from '../../shared/constants.js';

let runtime;
let sockets = [];

function waitFor(socket, event, { timeout = 4000, predicate = () => true } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function connect(url, resumeToken) {
  const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(socket);
  await waitFor(socket, 'connect');
  const welcome = waitFor(socket, SERVER_EVENTS.WELCOME);
  const matchStarting = resumeToken ? waitFor(socket, SERVER_EVENTS.MATCH_STARTING) : null;
  socket.emit(CLIENT_EVENTS.HELLO, {
    protocol: PROTOCOL_VERSION,
    name: 'Tester',
    resumeToken
  });
  return {
    socket,
    welcome: await welcome,
    matchStarting: matchStarting ? await matchStarting : null
  };
}

afterEach(async () => {
  for (const socket of sockets) socket.disconnect();
  sockets = [];
  if (runtime) await runtime.close();
  runtime = null;
});

describe('server integration', () => {
  it('creates a lobby, starts a match, and restores a reconnecting player', async () => {
    runtime = await createTagServer({ host: '127.0.0.1', port: 0 });
    const port = await runtime.listen();
    const url = `http://127.0.0.1:${port}`;
    const host = await connect(url);
    const guest = await connect(url);
    expect(host.welcome.playerId).toBeTruthy();

    const hostJoined = waitFor(host.socket, SERVER_EVENTS.LOBBY_JOINED);
    host.socket.emit(CLIENT_EVENTS.CREATE_LOBBY, {
      modeId: 'classic',
      mapId: 'playground',
      visibility: 'public'
    });
    const lobby = (await hostJoined).lobby;
    expect(lobby.code).toMatch(/^[A-Z0-9]{5}$/);

    const guestJoined = waitFor(guest.socket, SERVER_EVENTS.LOBBY_JOINED);
    guest.socket.emit(CLIENT_EVENTS.JOIN_LOBBY, { code: lobby.code });
    expect((await guestJoined).lobby.players).toHaveLength(2);

    host.socket.emit(CLIENT_EVENTS.READY, { ready: true });
    guest.socket.emit(CLIENT_EVENTS.READY, { ready: true });
    await waitFor(host.socket, SERVER_EVENTS.LOBBY_UPDATE, {
      predicate: (payload) => payload.lobby.players.every((player) => player.ready)
    });

    const hostStart = waitFor(host.socket, SERVER_EVENTS.MATCH_STARTING);
    const guestStart = waitFor(guest.socket, SERVER_EVENTS.MATCH_STARTING);
    host.socket.emit(CLIENT_EVENTS.START_MATCH, {});
    const [hostMatch, guestMatch] = await Promise.all([hostStart, guestStart]);
    expect(hostMatch.state.phase).toBe('countdown');
    expect(guestMatch.state.modeId).toBe('classic');

    const token = guest.welcome.token;
    guest.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 120));

    const resumed = await connect(url, token);
    expect(resumed.welcome.resumed).toBe(true);
    expect(resumed.matchStarting.state.matchId).toBe(hostMatch.state.matchId);
    expect(resumed.matchStarting.state.phase).toBe('countdown');
    expect(resumed.matchStarting.lobby.players).toHaveLength(2);
  });
});

describe('match lifecycle', () => {
  it('ends a timed match, reports results, and returns players to the lobby', async () => {
    runtime = await createTagServer({ host: '127.0.0.1', port: 0 });
    const port = await runtime.listen();
    const url = `http://127.0.0.1:${port}`;
    const host = await connect(url);
    const guest = await connect(url);
    const hostJoined = waitFor(host.socket, SERVER_EVENTS.LOBBY_JOINED);
    host.socket.emit(CLIENT_EVENTS.CREATE_LOBBY, { modeId: 'classic', mapId: 'playground' });
    const lobby = (await hostJoined).lobby;
    const guestJoined = waitFor(guest.socket, SERVER_EVENTS.LOBBY_JOINED);
    guest.socket.emit(CLIENT_EVENTS.JOIN_LOBBY, { code: lobby.code });
    await guestJoined;
    host.socket.emit(CLIENT_EVENTS.READY, { ready: true });
    guest.socket.emit(CLIENT_EVENTS.READY, { ready: true });
    await waitFor(host.socket, SERVER_EVENTS.LOBBY_UPDATE, {
      predicate: (payload) => payload.lobby.players.every((player) => player.ready)
    });

    const hostStart = waitFor(host.socket, SERVER_EVENTS.MATCH_STARTING);
    const guestStart = waitFor(guest.socket, SERVER_EVENTS.MATCH_STARTING);
    host.socket.emit(CLIENT_EVENTS.START_MATCH, {});
    await Promise.all([hostStart, guestStart]);

    const entry = runtime.matches.get(lobby.id);
    expect(entry).toBeTruthy();
    entry.engine.timeLeft = 0.01;
    const hostEnd = waitFor(host.socket, SERVER_EVENTS.MATCH_END);
    const guestEnd = waitFor(guest.socket, SERVER_EVENTS.MATCH_END);
    const [hostResult, guestResult] = await Promise.all([hostEnd, guestEnd]);
    expect(hostResult.results.matchId).toBe(entry.id);
    expect(hostResult.results.reason).toBe('time');
    expect(hostResult.results.standings).toHaveLength(2);
    expect(hostResult.results.winnerIds.length).toBeGreaterThan(0);
    expect(guestResult.results.matchId).toBe(entry.id);

    expect(runtime.matches.get(lobby.id)).toBeNull();
    const returned = waitFor(host.socket, SERVER_EVENTS.LOBBY_JOINED);
    host.socket.emit(CLIENT_EVENTS.RETURN_TO_LOBBY, {});
    const lobbyView = (await returned).lobby;
    expect(lobbyView.state).toBe('waiting');
    expect(lobbyView.players).toHaveLength(2);
    expect(lobbyView.players.every((player) => player.ready === false)).toBe(true);
  });

  it('removes stale lobbies when a match ends with a disconnected player', async () => {
    runtime = await createTagServer({ host: '127.0.0.1', port: 0 });
    const port = await runtime.listen();
    const url = `http://127.0.0.1:${port}`;
    const host = await connect(url);
    const guest = await connect(url);
    const hostJoined = waitFor(host.socket, SERVER_EVENTS.LOBBY_JOINED);
    host.socket.emit(CLIENT_EVENTS.CREATE_LOBBY, { modeId: 'classic', mapId: 'playground' });
    const lobby = (await hostJoined).lobby;
    const guestJoined = waitFor(guest.socket, SERVER_EVENTS.LOBBY_JOINED);
    guest.socket.emit(CLIENT_EVENTS.JOIN_LOBBY, { code: lobby.code });
    await guestJoined;
    host.socket.emit(CLIENT_EVENTS.READY, { ready: true });
    guest.socket.emit(CLIENT_EVENTS.READY, { ready: true });
    await waitFor(host.socket, SERVER_EVENTS.LOBBY_UPDATE, {
      predicate: (payload) => payload.lobby.players.every((player) => player.ready)
    });
    const hostStart = waitFor(host.socket, SERVER_EVENTS.MATCH_STARTING);
    const guestStart = waitFor(guest.socket, SERVER_EVENTS.MATCH_STARTING);
    host.socket.emit(CLIENT_EVENTS.START_MATCH, {});
    await Promise.all([hostStart, guestStart]);

    guest.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const left = waitFor(host.socket, SERVER_EVENTS.LOBBY_LEFT);
    host.socket.emit(CLIENT_EVENTS.LEAVE_LOBBY, {});
    await left;
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(runtime.matches.get(lobby.id)).toBeNull();
    expect(runtime.lobbies.getById(lobby.id)).toBeNull();
    expect(runtime.lobbies.lobbies.size).toBe(0);
  });
});
