import { describe, expect, it } from 'vitest';
import { MatchEngine } from '../../shared/MatchEngine.js';
import { MATCH_PHASES } from '../../shared/events.js';
import { GAME_MODES } from '../../shared/constants.js';
import { distance } from '../../shared/utils.js';

const players = [
  { id: 'a', name: 'Ace' },
  { id: 'b', name: 'Bea' },
  { id: 'c', name: 'Cam' }
];

function startMatch(modeId = 'classic', count = 3) {
  const engine = new MatchEngine({
    modeId,
    mapId: 'playground',
    options: { countdown: 1, duration: 60 },
    players: players.slice(0, count),
    rng: () => 0.42
  });
  for (let i = 0; i < 11; i += 1) engine.tick(0.1);
  return engine;
}

function placeTogether(...entries) {
  const [anchor, ...rest] = entries;
  for (const entry of rest) {
    entry.x = anchor.x;
    entry.y = anchor.y;
  }
}

describe('MatchEngine', () => {
  it('advances through the countdown into play', () => {
    const engine = new MatchEngine({
      modeId: 'classic',
      mapId: 'playground',
      options: { countdown: 1, duration: 60 },
      players,
      rng: () => 0.5
    });
    expect(engine.phase).toBe(MATCH_PHASES.COUNTDOWN);
    for (let i = 0; i < 11; i += 1) engine.tick(0.1);
    expect(engine.phase).toBe(MATCH_PHASES.PLAYING);
    expect(engine.countdown).toBe(0);
  });

  it('passes IT and records tag stats in classic mode', () => {
    const engine = startMatch();
    const it = engine.players.find((player) => player.isIt);
    const runner = engine.players.find((player) => !player.isIt);
    placeTogether(it, runner);
    const result = engine.requestTag(it.id, runner.id);
    expect(result.ok).toBe(true);
    expect(runner.isIt).toBe(true);
    expect(it.isIt).toBe(false);
    expect(it.tags).toBe(1);
    expect(runner.timesTagged).toBe(1);
    expect(distance(it.x, it.y, runner.x, runner.y)).toBe(0);
  });

  it('freezes runners and allows a nearby teammate to thaw them', () => {
    const engine = startMatch('freeze');
    const it = engine.players.find((player) => player.isIt);
    const runner = engine.players.find((player) => !player.isIt);
    const rescuer = engine.players.find((player) => !player.isIt && player !== runner);
    placeTogether(it, runner);
    expect(engine.requestTag(it.id, runner.id).ok).toBe(true);
    expect(runner.frozen).toBe(true);
    placeTogether(runner, rescuer);
    const rescue = engine.requestInteract(rescuer.id, runner.id);
    expect(rescue.ok).toBe(true);
    expect(runner.frozen).toBe(false);
    expect(rescuer.revives).toBe(1);
  });

  it('finishes when the clock expires and produces standings', () => {
    const engine = startMatch();
    engine.timeLeft = 0.05;
    engine.tick(0.1);
    expect(engine.phase).toBe(MATCH_PHASES.ENDED);
    expect(engine.results).toBeTruthy();
    expect(engine.results.standings).toHaveLength(3);
    expect(engine.results.reason).toBe('time');
    expect(engine.serialize().phase).toBe(MATCH_PHASES.ENDED);
  });

  it.each(GAME_MODES.map((mode) => [mode.id, mode]))('%s initializes and simulates cleanly', (modeId, mode) => {
    const engine = new MatchEngine({
      modeId,
      mapId: 'campus',
      options: { countdown: 1, duration: 5 },
      players: Array.from({ length: Math.max(mode.minPlayers, 6) }, (_, index) => ({
        id: `p${index}`,
        name: `Player ${index}`,
        team: index % 2 === 0 ? 'coral' : 'azure'
      })),
      rng: () => 0.37
    });
    for (let i = 0; i < 70; i += 1) engine.tick(0.1);
    const state = engine.serialize();
    expect(state.players).toHaveLength(Math.max(mode.minPlayers, 6));
    expect(['playing', 'ended']).toContain(state.phase);
    expect(Number.isFinite(state.timeLeft)).toBe(true);
  });

  it('rejects tags outside the active phase and range', () => {
    const engine = startMatch();
    const it = engine.players.find((player) => player.isIt);
    const runner = engine.players.find((player) => !player.isIt);
    runner.x = 20;
    runner.y = 20;
    expect(engine.requestTag(it.id, runner.id)).toMatchObject({ ok: false });
    engine.phase = MATCH_PHASES.COUNTDOWN;
    expect(engine.requestTag(it.id, runner.id)).toMatchObject({ ok: false });
  });
});
