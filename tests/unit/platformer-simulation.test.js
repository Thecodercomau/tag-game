import { describe, expect, it } from 'vitest';
import { GAME_MODES } from '../../shared/constants.js';
import { MAPS } from '../../shared/maps.js';
import { MatchEngine } from '../../shared/MatchEngine.js';
import { BotController } from '../../client/src/game/BotController.js';

const modeIds = GAME_MODES.map((mode) => mode.id);

describe('side-view match simulation', () => {
  for (const map of MAPS) {
    for (const modeId of modeIds) {
      it(`runs ${modeId} on ${map.id} with bots`, () => {
        const players = Array.from({ length: 4 }, (_, index) => ({
          id: `bot-${index}`,
          name: `Bot ${index}`,
          isBot: true,
          difficulty: ['easy', 'normal', 'hard'][index % 3]
        }));
        const engine = new MatchEngine({
          modeId,
          mapId: map.id,
          players,
          options: { duration: 60, countdown: 1 }
        });
        const bots = new BotController(engine, 'normal');
        for (let tick = 0; tick < 600; tick += 1) {
          bots.update(1 / 60);
          engine.tick(1 / 60);
        }
        expect(engine.players).toHaveLength(4);
        for (const player of engine.players) {
          expect(Number.isFinite(player.x)).toBe(true);
          expect(Number.isFinite(player.y)).toBe(true);
          expect(Number.isFinite(player.vx)).toBe(true);
          expect(Number.isFinite(player.vy)).toBe(true);
          expect(player.x).toBeGreaterThanOrEqual(15);
          expect(player.x).toBeLessThanOrEqual(map.width - 15);
          expect(player.y).toBeGreaterThanOrEqual(27);
          expect(player.y).toBeLessThanOrEqual(map.height - 27);
        }
      });
    }
  }
});
