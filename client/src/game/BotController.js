import { PLAYER_HALF_HEIGHT, PLAYER_HALF_WIDTH } from '@shared/constants.js';
import { platformUnder } from '@shared/physics.js';
import { clamp, distance } from '@shared/utils.js';

const DIFFICULTY = {
  easy: { think: 0.75, react: 0.34, speed: 0.78, sprint: 0.42, tagChance: 0.55, threat: 320, repath: 0.72 },
  normal: { think: 0.5, react: 0.16, speed: 0.92, sprint: 0.78, tagChance: 0.86, threat: 390, repath: 0.55 },
  hard: { think: 0.32, react: 0.04, speed: 1, sprint: 0.95, tagChance: 1, threat: 470, repath: 0.38 }
};

function gapBetween(a, b) {
  return Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
}

export class BotController {
  constructor(engine, difficulty = 'normal') {
    this.engine = engine;
    this.map = engine.map;
    this.difficulty = DIFFICULTY[difficulty] ? difficulty : 'normal';
    this.config = DIFFICULTY[this.difficulty];
    this.platforms = this.map.platforms || [];
    this.adjacency = this.buildAdjacency();
    this.states = new Map();
    for (const player of engine.players.filter((entry) => entry.isBot)) {
      this.states.set(player.id, {
        mode: 'wander',
        target: null,
        targetPoint: null,
        thinkTimer: Math.random() * 0.4,
        tagTimer: Math.random() * 0.4,
        interactTimer: 0.2,
        reactTimer: 0,
        wanderTimer: 0,
        jumpPulse: 0,
        hopTimer: 1 + Math.random() * 2,
        routeTimer: 0,
        route: [],
        routeFrom: -1,
        routeTo: -1,
        lastX: player.x,
        stuckTimer: 0
      });
    }
  }

  buildAdjacency() {
    const adjacency = this.platforms.map(() => []);
    for (let i = 0; i < this.platforms.length; i += 1) {
      for (let j = 0; j < this.platforms.length; j += 1) {
        if (i === j) continue;
        const a = this.platforms[i];
        const b = this.platforms[j];
        const gap = gapBetween(a, b);
        const rise = a.y - b.y;
        if (rise > 235) continue;
        const maxGap = rise > 0 ? 250 - rise * 0.2 : 280 + Math.min(180, -rise * 0.25);
        if (gap > maxGap) continue;
        adjacency[i].push(j);
      }
    }
    return adjacency;
  }

  platformUnderPlayer(player) {
    return platformUnder(player.x, player.y + PLAYER_HALF_HEIGHT, this.map);
  }

  platformIndexAt(x, feetY, fallbackTop = null) {
    if (fallbackTop != null) {
      let best = -1;
      let bestScore = Infinity;
      for (let index = 0; index < this.platforms.length; index += 1) {
        const platform = this.platforms[index];
        if (x + PLAYER_HALF_WIDTH <= platform.x || x - PLAYER_HALF_WIDTH >= platform.x + platform.w) continue;
        const score = Math.abs(platform.y - fallbackTop);
        if (score < bestScore) {
          bestScore = score;
          best = index;
        }
      }
      if (best >= 0) return best;
    }
    const exact = this.platformUnderPlayer({ x, y: feetY - PLAYER_HALF_HEIGHT });
    if (exact) return this.platforms.indexOf(exact);
    let best = -1;
    let bestScore = Infinity;
    for (let index = 0; index < this.platforms.length; index += 1) {
      const platform = this.platforms[index];
      const horizontal = x < platform.x ? platform.x - x : x > platform.x + platform.w ? x - (platform.x + platform.w) : 0;
      const below = platform.y >= feetY - 20 ? platform.y - feetY : 500 + (feetY - platform.y);
      const score = Math.hypot(horizontal, below);
      if (score < bestScore) {
        bestScore = score;
        best = index;
      }
    }
    return best;
  }

  surfaceIndex(player) {
    return this.platformIndexAt(player.x, player.y + PLAYER_HALF_HEIGHT);
  }

  goalIndex(goal) {
    if (!goal) return -1;
    return this.platformIndexAt(goal.x, goal.y + PLAYER_HALF_HEIGHT, goal.y + PLAYER_HALF_HEIGHT);
  }

  findPlatformPath(from, to) {
    if (from < 0 || to < 0) return [];
    if (from === to) return [from];
    const previous = new Int32Array(this.platforms.length).fill(-1);
    const visited = new Uint8Array(this.platforms.length);
    const queue = [from];
    visited[from] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      if (current === to) break;
      for (const next of this.adjacency[current]) {
        if (visited[next]) continue;
        visited[next] = 1;
        previous[next] = current;
        queue.push(next);
      }
    }
    if (!visited[to]) return [];
    const path = [];
    let cursor = to;
    while (cursor !== -1) {
      path.push(cursor);
      if (cursor === from) break;
      cursor = previous[cursor];
    }
    return path.reverse();
  }

  launchX(current, next, player) {
    const left = Math.max(current.x + 22, next.x);
    const right = Math.min(current.x + current.w - 22, next.x + next.w);
    if (right >= left) return clamp((next.x + next.w / 2), left, Math.max(left, right));
    if (next.x > current.x) return current.x + current.w - 16;
    return current.x + 16;
  }

  nearestFrom(player, list) {
    let best = null;
    let bestDist = Infinity;
    for (const other of list) {
      if (!other || other.id === player.id || other.eliminated || !other.connected) continue;
      const d = distance(player.x, player.y, other.x, other.y);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    return { player: best, distance: bestDist };
  }

  chooseStrategy(player) {
    const mode = this.engine.modeId;
    const threatRange = this.config.threat;
    const survivors = this.engine.players.filter((entry) => !entry.eliminated && entry.connected && entry.id !== player.id);
    if (!survivors.length) return { mode: 'wander' };

    if (mode === 'team') {
      if (player.isSeeker) {
        const targets = survivors.filter((entry) => entry.team !== player.team && !entry.isSeeker);
        const nearest = this.nearestFrom(player, targets.length ? targets : survivors);
        return { mode: 'chase', target: nearest.player, distance: nearest.distance };
      }
      const enemySeekers = survivors.filter((entry) => entry.isSeeker && entry.team !== player.team);
      const nearestThreat = this.nearestFrom(player, enemySeekers);
      if (nearestThreat.distance < threatRange) return { mode: 'flee', target: nearestThreat.player, distance: nearestThreat.distance };
      const teammates = survivors.filter((entry) => entry.team === player.team);
      const teammate = this.nearestFrom(player, teammates);
      if (teammate.player && teammate.distance > 360) return { mode: 'group', target: teammate.player, distance: teammate.distance };
      return { mode: 'wander' };
    }

    if (mode === 'reverse') {
      if (player.isEvader) {
        const nearest = this.nearestFrom(player, survivors);
        return nearest.distance < threatRange * 1.55
          ? { mode: 'flee', target: nearest.player, distance: nearest.distance, urgent: true }
          : { mode: 'wander' };
      }
      const evader = survivors.find((entry) => entry.isEvader);
      if (evader) return { mode: 'chase', target: evader, distance: distance(player.x, player.y, evader.x, evader.y) };
      return { mode: 'wander' };
    }

    if (mode === 'infection') {
      if (player.infected) {
        const nearest = this.nearestFrom(player, survivors.filter((entry) => !entry.infected));
        return { mode: 'chase', target: nearest.player, distance: nearest.distance };
      }
      const nearest = this.nearestFrom(player, survivors.filter((entry) => entry.infected));
      return nearest.distance < threatRange
        ? { mode: 'flee', target: nearest.player, distance: nearest.distance }
        : { mode: 'wander' };
    }

    if (mode === 'freeze') {
      if (player.isIt) {
        const nearest = this.nearestFrom(player, survivors.filter((entry) => !entry.frozen));
        return { mode: 'chase', target: nearest.player, distance: nearest.distance };
      }
      const threat = survivors.find((entry) => entry.isIt);
      const threatDist = threat ? distance(player.x, player.y, threat.x, threat.y) : Infinity;
      const rescue = this.nearestFrom(player, survivors.filter((entry) => entry.frozen));
      if (rescue.player && threatDist > 100 && rescue.distance < 470) {
        return { mode: 'rescue', target: rescue.player, distance: rescue.distance };
      }
      if (threat && threatDist < threatRange) return { mode: 'flee', target: threat, distance: threatDist };
      return { mode: 'wander' };
    }

    if (player.isIt) {
      const nearest = this.nearestFrom(player, survivors.filter((entry) => !entry.isIt));
      return { mode: 'chase', target: nearest.player, distance: nearest.distance };
    }
    const it = survivors.find((entry) => entry.isIt);
    if (!it) return { mode: 'wander' };
    const dist = distance(player.x, player.y, it.x, it.y);
    return dist < threatRange ? { mode: 'flee', target: it, distance: dist } : { mode: 'wander' };
  }

  fleePoint(player, threats) {
    let best = null;
    let bestScore = -Infinity;
    for (const spawn of this.map.spawns) {
      let nearest = Infinity;
      for (const threat of threats) nearest = Math.min(nearest, distance(spawn.x, spawn.y, threat.x, threat.y));
      const reached = distance(player.x, player.y, spawn.x, spawn.y) < 260 ? -160 : 0;
      const score = nearest + reached + Math.random() * 70;
      if (score > bestScore) {
        bestScore = score;
        best = { x: spawn.x, y: spawn.y };
      }
    }
    return best || { x: player.x, y: player.y };
  }

  wanderPoint(player, state) {
    if (state.targetPoint && state.wanderTimer > 0) return state.targetPoint;
    let best = null;
    let bestScore = -Infinity;
    for (const spawn of this.map.spawns) {
      const d = distance(player.x, player.y, spawn.x, spawn.y);
      const score = (d < 100 ? -180 : d) + Math.random() * 220;
      if (score > bestScore) {
        bestScore = score;
        best = { x: spawn.x, y: spawn.y };
      }
    }
    state.wanderTimer = 2.4 + Math.random() * 2.8;
    return best || { x: player.x, y: player.y };
  }

  update(dt) {
    const engine = this.engine;
    for (const player of engine.players) {
      if (!player.isBot) continue;
      const state = this.states.get(player.id);
      if (!state) continue;
      if (player.eliminated || player.frozen || !player.connected || engine.phase === 'ended') {
        engine.setInput(player.id, { dx: 0, sprint: false, jump: false, seq: player.lastInputSeq + 1 });
        continue;
      }

      state.thinkTimer -= dt;
      state.tagTimer -= dt;
      state.interactTimer -= dt;
      state.reactTimer -= dt;
      state.wanderTimer -= dt;
      state.jumpPulse = Math.max(0, state.jumpPulse - dt);
      state.hopTimer -= dt;
      state.routeTimer -= dt;

      if (state.thinkTimer <= 0) {
        state.thinkTimer = this.config.think + Math.random() * 0.15;
        const strategy = this.chooseStrategy(player);
        if (strategy.target?.id !== state.target?.id) state.reactTimer = this.config.react;
        state.mode = strategy.mode;
        state.target = strategy.target || null;
        state.urgent = Boolean(strategy.urgent);
        state.threatDistance = strategy.distance;
        if (strategy.mode === 'flee') {
          const threats = engine.players.filter((entry) => entry.id !== player.id && entry.connected && !entry.eliminated && !entry.frozen);
          state.targetPoint = this.fleePoint(player, threats);
          state.routeTimer = 0;
        } else if (strategy.mode === 'wander') {
          state.targetPoint = this.wanderPoint(player, state);
          state.routeTimer = 0;
        } else if (strategy.target) {
          state.targetPoint = { x: strategy.target.x, y: strategy.target.y };
          state.routeTimer = 0;
        }
      }

      const goal = state.targetPoint || (state.target ? { x: state.target.x, y: state.target.y } : null);
      if (!goal) {
        engine.setInput(player.id, { dx: 0, sprint: false, jump: false, seq: player.lastInputSeq + 1 });
        continue;
      }

      if (player.grounded) {
        const current = this.surfaceIndex(player);
        const targetIndex = this.goalIndex(goal);
        if (state.routeTimer <= 0 || state.routeFrom !== current || state.routeTo !== targetIndex) {
          state.route = this.findPlatformPath(current, targetIndex);
          state.routeFrom = current;
          state.routeTo = targetIndex;
          state.routeTimer = this.config.repath;
        }
        if (state.route.length > 1) {
          const currentPlatform = this.platforms[state.route[0]];
          const nextPlatform = this.platforms[state.route[1]];
          const jumpX = this.launchX(currentPlatform, nextPlatform, player);
          const gap = gapBetween(currentPlatform, nextPlatform);
          const needsJump = nextPlatform.y < currentPlatform.y - 8 || gap > 30;
          goal.steerX = jumpX;
          if (needsJump && Math.abs(player.x - jumpX) < 58) state.jumpPulse = 0.16;
          if (!needsJump && nextPlatform.y > currentPlatform.y + 50) goal.steerX = jumpX;
        } else {
          goal.steerX = goal.x;
        }
        if (state.hopTimer <= 0 && state.route.length <= 1 && Math.abs(goal.x - player.x) > 90) {
          state.hopTimer = 1.4 + Math.random() * 1.8;
          state.jumpPulse = 0.15;
        }
      } else if (state.route.length > 1) {
        const next = this.platforms[state.route[1]];
        goal.steerX = next.x + next.w / 2;
      } else {
        goal.steerX = goal.x;
      }

      const horizontal = clamp((goal.steerX - player.x) / 120, -1, 1);
      let sprint = false;
      const needsSpeed = state.mode === 'chase' || state.mode === 'flee' || state.mode === 'rescue';
      if (needsSpeed && player.stamina > 18 && Math.random() < this.config.sprint) {
        const close = state.mode === 'chase' ? (state.threatDistance ?? 999) < 280 : (state.threatDistance ?? 999) < 320;
        if (close || state.urgent) sprint = true;
      }
      const speed = this.config.speed;
      engine.setInput(player.id, {
        dx: horizontal * speed,
        sprint,
        jump: state.jumpPulse > 0,
        seq: player.lastInputSeq + 1
      });

      const moved = Math.abs(player.x - state.lastX);
      state.lastX = player.x;
      if (moved < 0.9 && Math.abs(horizontal) > 0.35) state.stuckTimer += dt;
      else state.stuckTimer = Math.max(0, state.stuckTimer - dt * 2);
      if (state.stuckTimer > 0.8) {
        state.stuckTimer = 0;
        state.jumpPulse = 0.16;
        state.routeTimer = 0;
      }

      if (state.tagTimer <= 0 && (state.mode === 'chase' || state.target)) {
        state.tagTimer = 0.28 + Math.random() * 0.18;
        if (Math.random() < this.config.tagChance) {
          const target = state.target;
          if (target && distance(player.x, player.y, target.x, target.y) <= engine.options.tagDistance - 4) {
            engine.requestTag(player.id);
          }
        }
      }
      if (state.interactTimer <= 0 && engine.modeId === 'freeze' && !player.isIt) {
        state.interactTimer = 0.5;
        const frozen = this.nearestFrom(player, engine.players.filter((entry) => entry.frozen && entry.connected));
        if (frozen.player && frozen.distance <= engine.options.reviveRange - 3) {
          engine.requestInteract(player.id, frozen.player.id);
        }
      }
    }
  }
}
