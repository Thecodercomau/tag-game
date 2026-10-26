import { describe, expect, it } from 'vitest';
import { PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH, STAMINA_MAX } from '../../shared/constants.js';
import { stepPlayerPhysics } from '../../shared/physics.js';

const map = {
  width: 1200,
  height: 700,
  platforms: [{ x: 0, y: 600, w: 1200, h: 100, type: 'ground' }]
};
const groundTop = 600;

function playerAt(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    dirX: 1,
    grounded: false,
    jumpHeld: false,
    jumpBuffer: 0,
    coyote: 0,
    stamina: STAMINA_MAX,
    exhausted: false,
    sprinting: false,
    lastStaminaUse: -999
  };
}

describe('side-view physics', () => {
  it('falls under gravity and lands on the ground', () => {
    const player = playerAt(430, groundTop - 300);
    for (let index = 0; index < 120; index += 1) {
      stepPlayerPhysics(player, map, { dx: 0, sprint: false, jump: false }, 1 / 60);
    }
    expect(player.grounded).toBe(true);
    expect(player.y).toBeCloseTo(groundTop - PLAYER_HALF_HEIGHT, 1);
    expect(player.vy).toBe(0);
  });

  it('jumps from a grounded position and lands again', () => {
    const player = playerAt(430, groundTop - PLAYER_HALF_HEIGHT);
    player.grounded = true;
    stepPlayerPhysics(player, map, { dx: 0, sprint: false, jump: true }, 1 / 60);
    expect(player.vy).toBeLessThan(0);
    expect(player.grounded).toBe(false);
    const startY = player.y;
    for (let index = 0; index < 10; index += 1) {
      stepPlayerPhysics(player, map, { dx: 0, sprint: false, jump: true }, 1 / 60);
    }
    expect(player.y).toBeLessThan(startY);
    for (let index = 0; index < 180; index += 1) {
      stepPlayerPhysics(player, map, { dx: 0, sprint: false, jump: false }, 1 / 60);
    }
    expect(player.grounded).toBe(true);
    expect(player.y).toBeCloseTo(groundTop - PLAYER_HALF_HEIGHT, 1);
  });

  it('runs horizontally and stays inside the map', () => {
    const player = playerAt(120, groundTop - PLAYER_HALF_HEIGHT);
    player.grounded = true;
    for (let index = 0; index < 240; index += 1) {
      stepPlayerPhysics(player, map, { dx: -1, sprint: true, jump: false }, 1 / 60);
    }
    expect(player.x).toBeGreaterThanOrEqual(PLAYER_HALF_WIDTH);
    expect(player.x).toBeLessThan(400);
  });
});
