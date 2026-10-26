import { describe, expect, it } from 'vitest';
import { MAPS, allSpawns } from '../../shared/maps.js';
import { PLAYER_RADIUS } from '../../shared/constants.js';
import { circleRectOverlap } from '../../shared/utils.js';

describe('map definitions', () => {
  it.each(MAPS.map((map) => [map.id, map]))('%s has valid geometry and clear spawns', (_id, map) => {
    expect(map.width).toBeGreaterThan(800);
    expect(map.height).toBeGreaterThan(600);
    expect(map.spawns.length).toBeGreaterThanOrEqual(2);
    for (const spawn of allSpawns(map)) {
      expect(spawn.x).toBeGreaterThan(PLAYER_RADIUS);
      expect(spawn.y).toBeGreaterThan(PLAYER_RADIUS);
      expect(spawn.x).toBeLessThan(map.width - PLAYER_RADIUS);
      expect(spawn.y).toBeLessThan(map.height - PLAYER_RADIUS);
      for (const wall of map.walls) {
        expect(circleRectOverlap(spawn.x, spawn.y, PLAYER_RADIUS + 4, wall)).toBe(false);
      }
    }
  });

  it('uses unique map ids and spawn points', () => {
    expect(new Set(MAPS.map((map) => map.id)).size).toBe(MAPS.length);
    for (const map of MAPS) {
      const unique = new Set(map.spawns.map((spawn) => `${spawn.x},${spawn.y}`));
      expect(unique.size).toBe(map.spawns.length);
    }
  });
});
