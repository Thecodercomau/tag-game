import { PLAYER_RADIUS } from '@shared/constants.js';
import { circleRectOverlap, distance, normalize, pointBlocked } from '@shared/utils.js';

const CELL = 38;
const DIFFICULTY = {
  easy: { think: 0.75, react: 0.34, speed: 0.78, sprint: 0.42, tagChance: 0.55, threat: 320, repath: 0.72 },
  normal: { think: 0.5, react: 0.16, speed: 0.92, sprint: 0.78, tagChance: 0.86, threat: 390, repath: 0.55 },
  hard: { think: 0.32, react: 0.04, speed: 1, sprint: 0.95, tagChance: 1, threat: 470, repath: 0.38 }
};

export class BotController {
  constructor(engine, difficulty = 'normal') {
    this.engine = engine;
    this.map = engine.map;
    this.difficulty = DIFFICULTY[difficulty] ? difficulty : 'normal';
    this.config = DIFFICULTY[this.difficulty];
    this.cols = Math.ceil(this.map.width / CELL);
    this.rows = Math.ceil(this.map.height / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.buildGrid();
    this.states = new Map();
    for (const player of engine.players.filter((entry) => entry.isBot)) {
      this.states.set(player.id, {
        path: [],
        target: null,
        targetPoint: null,
        mode: 'wander',
        thinkTimer: Math.random() * 0.4,
        pathTimer: 0,
        tagTimer: Math.random() * 0.4,
        interactTimer: 0.2,
        lastX: player.x,
        lastY: player.y,
        stuckTimer: 0,
        wanderTimer: 0,
        reactTimer: 0,
        desiredTargetId: null,
        pathGoal: null
      });
    }
  }

  buildGrid() {
    for (let gy = 0; gy < this.rows; gy += 1) {
      for (let gx = 0; gx < this.cols; gx += 1) {
        const x = gx * CELL + CELL / 2;
        const y = gy * CELL + CELL / 2;
        const out = x < PLAYER_RADIUS + 6 || y < PLAYER_RADIUS + 6 || x > this.map.width - PLAYER_RADIUS - 6 || y > this.map.height - PLAYER_RADIUS - 6;
        this.blocked[gy * this.cols + gx] = out || pointBlocked(x, y, this.map, PLAYER_RADIUS + 5) ? 1 : 0;
      }
    }
  }

  cellIndex(x, y) {
    const gx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / CELL)));
    const gy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / CELL)));
    return gy * this.cols + gx;
  }

  cellCenter(index) {
    return { x: (index % this.cols) * CELL + CELL / 2, y: Math.floor(index / this.cols) * CELL + CELL / 2 };
  }

  nearestOpen(x, y) {
    const gx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / CELL)));
    const gy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / CELL)));
    for (let radius = 0; radius < 8; radius += 1) {
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
          const nx = gx + ox;
          const ny = gy + oy;
          if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
          if (!this.blocked[ny * this.cols + nx]) return ny * this.cols + nx;
        }
      }
    }
    return gy * this.cols + gx;
  }

  lineClear(ax, ay, bx, by, radius = PLAYER_RADIUS + 2) {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(dist / 12));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (pointBlocked(ax + (bx - ax) * t, ay + (by - ay) * t, this.map, radius)) return false;
    }
    return true;
  }

  findPath(from, goal) {
    const start = this.nearestOpen(from.x, from.y);
    const end = this.nearestOpen(goal.x, goal.y);
    if (start === end) return [goal];
    const total = this.cols * this.rows;
    const queue = new Int32Array(total);
    const visited = new Uint8Array(total);
    const parent = new Int32Array(total);
    parent.fill(-1);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let found = false;
    while (head < tail) {
      const current = queue[head++];
      if (current === end) { found = true; break; }
      const cx = current % this.cols;
      const cy = Math.floor(current / this.cols);
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const next = ny * this.cols + nx;
        if (visited[next] || this.blocked[next]) continue;
        if (dx !== 0 && dy !== 0) {
          if (this.blocked[cy * this.cols + nx] || this.blocked[ny * this.cols + cx]) continue;
        }
        visited[next] = 1;
        parent[next] = current;
        queue[tail++] = next;
      }
    }
    if (!found) return [];
    const points = [];
    let current = end;
    while (current !== -1) {
      points.push(this.cellCenter(current));
      if (current === start) break;
      current = parent[current];
    }
    points.reverse();
    points.push(goal);
    return this.smooth(points);
  }

  smooth(points) {
    if (points.length <= 2) return points;
    const output = [];
    let index = 0;
    while (index < points.length - 1) {
      let next = index + 1;
      for (let candidate = points.length - 1; candidate > index + 1; candidate -= 1) {
        if (this.lineClear(points[index].x, points[index].y, points[candidate].x, points[candidate].y, PLAYER_RADIUS + 1)) {
          next = candidate;
          break;
        }
      }
      output.push(points[next]);
      index = next;
    }
    return output;
  }

  nearestFrom(player, list) {
    let best = null;
    let bestDist = Infinity;
    for (const other of list) {
      if (!other || other.id === player.id || other.eliminated || !other.connected) continue;
      const d = distance(player.x, player.y, other.x, other.y);
      if (d < bestDist) { bestDist = d; best = other; }
    }
    return { player: best, distance: bestDist };
  }

  chooseStrategy(player, state) {
    const mode = this.engine.modeId;
    const others = this.engine.players;
    const threatRange = this.config.threat;
    const survivors = others.filter((entry) => !entry.eliminated && entry.connected && entry.id !== player.id);
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
        const hunters = survivors.filter((entry) => entry.id !== player.id);
        const nearest = this.nearestFrom(player, hunters);
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
        const targets = survivors.filter((entry) => !entry.infected);
        const nearest = this.nearestFrom(player, targets);
        return { mode: 'chase', target: nearest.player, distance: nearest.distance };
      }
      const infected = survivors.filter((entry) => entry.infected);
      const nearest = this.nearestFrom(player, infected);
      return nearest.distance < threatRange
        ? { mode: 'flee', target: nearest.player, distance: nearest.distance }
        : { mode: 'wander' };
    }

    if (mode === 'freeze') {
      if (player.isIt) {
        const targets = survivors.filter((entry) => !entry.frozen);
        const nearest = this.nearestFrom(player, targets);
        return { mode: 'chase', target: nearest.player, distance: nearest.distance };
      }
      const threat = survivors.find((entry) => entry.isIt);
      const threatDist = threat ? distance(player.x, player.y, threat.x, threat.y) : Infinity;
      const frozen = survivors.filter((entry) => entry.frozen);
      const rescue = this.nearestFrom(player, frozen);
      if (rescue.player && threatDist > 100 && rescue.distance < 470) {
        return { mode: 'rescue', target: rescue.player, distance: rescue.distance };
      }
      if (threat && threatDist < threatRange) return { mode: 'flee', target: threat, distance: threatDist };
      return { mode: 'wander' };
    }

    if (player.isIt) {
      const targets = survivors.filter((entry) => !entry.isIt);
      const nearest = this.nearestFrom(player, targets);
      return { mode: 'chase', target: nearest.player, distance: nearest.distance };
    }
    const it = survivors.find((entry) => entry.isIt);
    if (!it) return { mode: 'wander' };
    const dist = distance(player.x, player.y, it.x, it.y);
    return dist < threatRange ? { mode: 'flee', target: it, distance: dist } : { mode: 'wander' };
  }

  fleePoint(player, threats, state) {
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
      const radius = 240 + Math.random() * 260;
      const x = player.x + Math.cos(angle) * radius;
      const y = player.y + Math.sin(angle) * radius;
      if (x < 50 || y < 50 || x > this.map.width - 50 || y > this.map.height - 50) continue;
      if (pointBlocked(x, y, this.map, PLAYER_RADIUS + 10)) continue;
      let nearest = Infinity;
      for (const threat of threats) nearest = Math.min(nearest, distance(x, y, threat.x, threat.y));
      const edgePenalty = Math.max(0, 190 - Math.min(x, y, this.map.width - x, this.map.height - y)) * 3;
      const centerPull = distance(x, y, this.map.width / 2, this.map.height / 2) * 0.08;
      const score = nearest - edgePenalty - centerPull + (this.lineClear(player.x, player.y, x, y) ? 90 : 0);
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best || { x: this.map.width / 2, y: this.map.height / 2 };
  }

  wanderPoint(player, state) {
    if (state.targetPoint && state.wanderTimer > 0) return state.targetPoint;
    const spawns = this.map.spawns;
    const point = spawns[Math.floor(Math.random() * spawns.length)];
    state.wanderTimer = 2.4 + Math.random() * 2.8;
    if (distance(player.x, player.y, point.x, point.y) < 120) {
      state.wanderTimer = 0.3;
      return { x: this.map.width / 2 + (Math.random() - 0.5) * this.map.width * 0.5, y: this.map.height / 2 + (Math.random() - 0.5) * this.map.height * 0.5 };
    }
    return point;
  }

  update(dt) {
    const engine = this.engine;
    for (const player of engine.players) {
      if (!player.isBot) continue;
      const state = this.states.get(player.id);
      if (!state) continue;
      if (player.eliminated || player.frozen || !player.connected || engine.phase === 'ended') {
        engine.setInput(player.id, { dx: 0, dy: 0, sprint: false, seq: player.lastInputSeq + 1 });
        continue;
      }
      state.thinkTimer -= dt;
      state.pathTimer -= dt;
      state.tagTimer -= dt;
      state.interactTimer -= dt;
      state.reactTimer -= dt;
      state.wanderTimer -= dt;
      if (state.thinkTimer <= 0) {
        state.thinkTimer = this.config.think + Math.random() * 0.15;
        const strategy = this.chooseStrategy(player, state);
        if (strategy.target?.id !== state.desiredTargetId) state.reactTimer = this.config.react;
        state.desiredTargetId = strategy.target?.id || null;
        state.mode = strategy.mode;
        state.target = strategy.target || null;
        state.urgent = Boolean(strategy.urgent);
        state.threatDistance = strategy.distance;
        if (strategy.mode === 'flee') {
          const threats = engine.players.filter((entry) => entry.id !== player.id && entry.connected && !entry.eliminated && !entry.frozen);
          state.targetPoint = this.fleePoint(player, threats, state);
          state.path = [];
          state.pathTimer = this.config.repath;
        } else if (strategy.mode === 'chase' || strategy.mode === 'rescue' || strategy.mode === 'group') {
          if (strategy.target) {
            state.targetPoint = { x: strategy.target.x, y: strategy.target.y };
            state.pathGoal = null;
          }
        } else if (strategy.mode === 'wander') {
          state.targetPoint = this.wanderPoint(player, state);
          state.pathGoal = null;
        }
      }

      if (state.mode === 'chase' && state.target) {
        const goalMoved = !state.pathGoal || distance(state.pathGoal.x, state.pathGoal.y, state.target.x, state.target.y) > 130;
        if (state.pathTimer <= 0 || goalMoved || !state.path.length) {
          state.targetPoint = { x: state.target.x, y: state.target.y };
          state.path = this.findPath(player, state.targetPoint);
          state.pathGoal = { x: state.target.x, y: state.target.y };
          state.pathTimer = this.config.repath;
        }
      } else if (state.mode === 'flee' && state.pathTimer <= 0 && state.targetPoint) {
        state.path = this.findPath(player, state.targetPoint);
        state.pathTimer = this.config.repath;
      } else if (state.mode === 'rescue' && state.target) {
        state.targetPoint = { x: state.target.x, y: state.target.y };
        state.path = this.findPath(player, state.targetPoint);
        state.pathTimer = this.config.repath;
      }

      const movement = Math.hypot(player.x - state.lastX, player.y - state.lastY);
      state.lastX = player.x;
      state.lastY = player.y;
      if (movement < 1.2) state.stuckTimer += dt; else state.stuckTimer = Math.max(0, state.stuckTimer - dt * 2);
      if (state.stuckTimer > 0.95) {
        state.stuckTimer = 0;
        state.path = [];
        state.pathTimer = 0;
        state.targetPoint = this.wanderPoint(player, state);
      }

      let waypoint = state.path[0] || state.targetPoint;
      if (!waypoint) {
        const wander = this.wanderPoint(player, state);
        waypoint = wander;
      }
      while (state.path.length && distance(player.x, player.y, state.path[0].x, state.path[0].y) < 28) {
        state.path.shift();
      }
      waypoint = state.path[0] || state.targetPoint || waypoint;

      let dx = waypoint.x - player.x;
      let dy = waypoint.y - player.y;
      const direction = normalize(dx, dy);
      dx = direction.x;
      dy = direction.y;
      if (state.reactTimer > 0) {
        dx *= 0.18;
        dy *= 0.18;
      }
      let sprint = false;
      const needsSpeed = state.mode === 'chase' || state.mode === 'flee' || state.mode === 'rescue';
      if (needsSpeed && player.stamina > 18 && Math.random() < this.config.sprint) {
        const close = state.mode === 'chase' ? (state.threatDistance ?? 999) < 280 : (state.threatDistance ?? 999) < 320;
        if (close || state.urgent) sprint = true;
      }
      const speed = this.config.speed;
      engine.setInput(player.id, {
        dx: dx * speed,
        dy: dy * speed,
        sprint,
        seq: player.lastInputSeq + 1
      });

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
