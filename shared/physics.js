import {
  ACCELERATION,
  AIR_ACCELERATION,
  COYOTE_TIME,
  DECELERATION,
  GRAVITY,
  JUMP_BUFFER_TIME,
  JUMP_SPEED,
  MAX_FALL_SPEED,
  PLAYER_HALF_HEIGHT,
  PLAYER_HALF_WIDTH,
  SPRINT_SPEED,
  STAMINA_DRAIN,
  STAMINA_MAX,
  STAMINA_RECOVER_DELAY,
  STAMINA_REGEN,
  STAMINA_SPRINT_MIN,
  WALK_SPEED
} from './constants.js';
import { clamp } from './utils.js';

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export function sanitizeInput(input) {
  if (!input || typeof input !== 'object') {
    return { dx: 0, dy: 0, sprint: false, jump: false, seq: 0 };
  }
  return {
    dx: Number.isFinite(input.dx) ? clamp(input.dx, -1, 1) : 0,
    dy: 0,
    sprint: Boolean(input.sprint),
    jump: Boolean(input.jump),
    seq: Number.isInteger(input.seq) ? input.seq : 0
  };
}

export function platformsFor(map) {
  return map?.platforms || [];
}

export function platformUnder(x, feetY, map, halfWidth = PLAYER_HALF_WIDTH, tolerance = 4) {
  const platforms = platformsFor(map);
  for (const platform of platforms) {
    if (x + halfWidth <= platform.x + 1 || x - halfWidth >= platform.x + platform.w - 1) continue;
    if (Math.abs(feetY - platform.y) <= tolerance) return platform;
  }
  return null;
}

function landingPlatform(map, x, prevBottom, nextBottom, halfWidth) {
  let landing = null;
  for (const platform of platformsFor(map)) {
    if (x + halfWidth <= platform.x + 1 || x - halfWidth >= platform.x + platform.w - 1) continue;
    if (prevBottom <= platform.y + 4 && nextBottom >= platform.y) {
      if (!landing || platform.y < landing.y) landing = platform;
    }
  }
  return landing;
}

export function stepPlayerPhysics(player, map, input, dt, { sprintEnabled = true, clock = 0, canControl = true } = {}) {
  const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  if (!step) return;
  const source = sanitizeInput(input);
  const moving = canControl && Math.abs(source.dx) > 0.01;
  const wantsSprint = Boolean(sprintEnabled && canControl && source.sprint && moving && !player.exhausted && player.stamina > STAMINA_SPRINT_MIN);
  const speed = wantsSprint ? SPRINT_SPEED : WALK_SPEED;
  const targetVx = moving ? source.dx * speed : 0;
  const accel = canControl
    ? player.grounded
      ? moving ? ACCELERATION : DECELERATION
      : moving ? AIR_ACCELERATION : AIR_ACCELERATION * 0.45
    : DECELERATION * 1.5;
  player.vx = approach(player.vx || 0, targetVx, accel * step);

  if (wantsSprint) {
    player.stamina = Math.max(0, (player.stamina ?? STAMINA_MAX) - STAMINA_DRAIN * step);
    player.lastStaminaUse = clock;
    if (player.stamina <= 0) player.exhausted = true;
  } else if (clock - (player.lastStaminaUse ?? -999) > STAMINA_RECOVER_DELAY) {
    player.stamina = Math.min(STAMINA_MAX, (player.stamina ?? STAMINA_MAX) + STAMINA_REGEN * step);
    if (player.stamina > 30) player.exhausted = false;
  }
  player.sprinting = wantsSprint && Math.abs(player.vx) > WALK_SPEED * 0.8;

  if (source.jump && !player.jumpHeld && canControl) {
    player.jumpHeld = true;
    player.jumpBuffer = JUMP_BUFFER_TIME;
  } else if (!source.jump) {
    player.jumpHeld = false;
  }
  player.coyote = player.grounded ? COYOTE_TIME : Math.max(0, (player.coyote ?? 0) - step);
  player.jumpBuffer = Math.max(0, (player.jumpBuffer ?? 0) - step);
  if (canControl && player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -JUMP_SPEED;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.airborneFromJump = true;
  }

  if (!player.grounded) {
    player.vy = Math.min(MAX_FALL_SPEED, (player.vy || 0) + GRAVITY * step);
  } else if (player.vy > 0) {
    player.vy = 0;
  }

  player.x += (player.vx || 0) * step;
  player.x = clamp(player.x, PLAYER_HALF_WIDTH, map.width - PLAYER_HALF_WIDTH);

  if (player.vy < 0) {
    player.y += player.vy * step;
    const ceiling = PLAYER_HALF_HEIGHT;
    if (player.y < ceiling) {
      player.y = ceiling;
      player.vy = 0;
    }
  } else if (player.vy > 0) {
    const previousBottom = player.y + PLAYER_HALF_HEIGHT;
    const nextY = player.y + player.vy * step;
    const nextBottom = nextY + PLAYER_HALF_HEIGHT;
    const landing = landingPlatform(map, player.x, previousBottom, nextBottom, PLAYER_HALF_WIDTH);
    if (landing) {
      player.y = landing.y - PLAYER_HALF_HEIGHT;
      player.vy = 0;
      player.grounded = true;
      player.coyote = COYOTE_TIME;
    } else {
      player.y = nextY;
    }
  }

  if (!player.grounded) {
    const supported = platformUnder(player.x, player.y + PLAYER_HALF_HEIGHT, map);
    if (supported) {
      player.y = supported.y - PLAYER_HALF_HEIGHT;
      player.grounded = true;
      player.vy = 0;
    }
  } else if (!platformUnder(player.x, player.y + PLAYER_HALF_HEIGHT, map)) {
    player.grounded = false;
  }

  if (player.y > map.height - PLAYER_HALF_HEIGHT) {
    player.y = map.height - PLAYER_HALF_HEIGHT;
    player.vy = 0;
    player.grounded = true;
  }

  if (Math.abs(player.vx) > 8) player.dirX = Math.sign(player.vx);
  player.dirY = 0;
  player.speed = Math.abs(player.vx);
}
