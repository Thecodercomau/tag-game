import {
  ACCELERATION,
  COUNTDOWN_SECONDS,
  DECELERATION,
  DEFAULT_OPTIONS,
  PLAYER_RADIUS,
  REVIVE_COOLDOWN_MS,
  SPRINT_SPEED,
  STAMINA_DRAIN,
  STAMINA_MAX,
  STAMINA_RECOVER_DELAY,
  STAMINA_REGEN,
  STAMINA_SPRINT_MIN,
  TAG_IMMUNITY_MS,
  TAG_STUN_MS,
  WALK_SPEED
} from './constants.js';
import { getMap } from './maps.js';
import { getModeRules } from './mode-rules.js';
import { MATCH_PHASES } from './events.js';
import { circleRectOverlap, clamp, distance, makeId, normalize, pointBlocked, shuffle } from './utils.js';

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

function sanitizeInput(input) {
  if (!input || typeof input !== 'object') return { dx: 0, dy: 0, sprint: false, seq: 0 };
  let dx = Number.isFinite(input.dx) ? clamp(input.dx, -1, 1) : 0;
  let dy = Number.isFinite(input.dy) ? clamp(input.dy, -1, 1) : 0;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude > 1) {
    dx /= magnitude;
    dy /= magnitude;
  }
  return {
    dx,
    dy,
    sprint: Boolean(input.sprint),
    seq: Number.isInteger(input.seq) ? input.seq : 0
  };
}

export class MatchEngine {
  constructor({ matchId = makeId(), modeId = 'classic', mapId = 'playground', options = {}, players = [], rng = Math.random } = {}) {
    this.matchId = matchId;
    this.modeId = modeId;
    this.mapId = getMap(mapId).id;
    this.map = getMap(mapId);
    this.mode = getModeRules(modeId);
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.rng = rng;
    this.phase = MATCH_PHASES.COUNTDOWN;
    this.countdown = this.options.countdown || COUNTDOWN_SECONDS;
    this.timeLeft = this.options.duration;
    this.clock = 0;
    this.tickCount = 0;
    this.events = [];
    this.eventId = 0;
    this.modeState = {};
    this.winnerIds = [];
    this.results = null;
    this.startedAt = Date.now();

    const spawns = shuffle(this.map.spawns, rng);
    this.players = players.map((source, index) => this.createPlayer(source, index, spawns));
    this.playerMap = new Map(this.players.map((player) => [player.id, player]));
    this.mode.init(this);
    this.updateAnimations();
  }

  createPlayer(source, index, spawns) {
    const spawn = this.findSpawn(spawns, index);
    return {
      id: source.id || makeId(this.rng),
      name: source.name || `Player ${index + 1}`,
      appearance: source.appearance || null,
      isBot: Boolean(source.isBot),
      difficulty: source.difficulty || 'normal',
      team: source.team || null,
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      dirX: 0,
      dirY: 1,
      radius: PLAYER_RADIUS,
      input: { dx: 0, dy: 0, sprint: false, seq: 0 },
      lastInputSeq: 0,
      stamina: STAMINA_MAX,
      sprinting: false,
      exhausted: false,
      lastStaminaUse: -999,
      isIt: false,
      isSeeker: false,
      isEvader: false,
      infected: false,
      frozen: false,
      frozenAt: 0,
      eliminated: false,
      eliminatedAt: 0,
      connected: true,
      tagImmununeUntil: 0,
      tagImmuneUntil: 0,
      lastTagAt: -999,
      lastInteractAt: -999,
      stunUntil: 0,
      taggingUntil: 0,
      taggedUntil: 0,
      tags: 0,
      timesTagged: 0,
      revives: 0,
      score: 0,
      itTime: 0,
      survivalTime: 0,
      animation: 'idle'
    };
  }

  findSpawn(spawns, index) {
    for (let offset = 0; offset < spawns.length; offset += 1) {
      const spawn = spawns[(index + offset) % spawns.length];
      if (!pointBlocked(spawn.x, spawn.y, this.map, PLAYER_RADIUS + 4)) return spawn;
    }
    for (let radius = 40; radius < 800; radius += 36) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const x = this.map.width / 2 + Math.cos(angle) * radius;
        const y = this.map.height / 2 + Math.sin(angle) * radius;
        if (x > 40 && y > 40 && x < this.map.width - 40 && y < this.map.height - 40 && !pointBlocked(x, y, this.map, PLAYER_RADIUS + 4)) {
          return { x, y };
        }
      }
    }
    return { x: this.map.width / 2, y: this.map.height / 2 };
  }

  setInput(playerId, input) {
    const player = this.playerMap.get(playerId);
    if (!player || this.phase === MATCH_PHASES.ENDED) return false;
    player.input = sanitizeInput(input);
    player.lastInputSeq = player.input.seq;
    return true;
  }

  requestTag(playerId, targetId = null) {
    if (this.phase !== MATCH_PHASES.PLAYING) return { ok: false, reason: 'Match is not active.' };
    const tagger = this.playerMap.get(playerId);
    if (!tagger || tagger.eliminated || tagger.frozen || !tagger.connected) return { ok: false, reason: 'You cannot tag right now.' };
    if (this.clock < tagger.stunUntil) return { ok: false, reason: 'You are still recovering.' };
    const cooldown = this.options.tagCooldownMs / 1000;
    if (this.clock - tagger.lastTagAt < cooldown) return { ok: false, reason: 'Tag is cooling down.' };

    let candidates;
    if (targetId) {
      const target = this.playerMap.get(targetId);
      candidates = target ? [target] : [];
    } else {
      candidates = this.players;
    }
    const valid = [];
    for (const target of candidates) {
      if (target === tagger || target.eliminated || target.frozen || !target.connected) continue;
      if (target.tagImmuneUntil > this.clock) continue;
      if (distance(tagger.x, tagger.y, target.x, target.y) > this.options.tagDistance) continue;
      const rule = this.mode.canTag(this, tagger, target);
      if (rule.ok) valid.push(target);
    }
    if (!valid.length) return { ok: false, reason: 'No valid tag target in range.' };
    valid.sort((a, b) => distance(tagger.x, tagger.y, a.x, a.y) - distance(tagger.x, tagger.y, b.x, b.y));
    const target = valid[0];
    this.mode.onTag(this, tagger, target);
    tagger.lastTagAt = this.clock;
    tagger.taggingUntil = Math.max(tagger.taggingUntil, this.clock + 0.35);
    target.taggedUntil = Math.max(target.taggedUntil, this.clock + 0.7);
    target.stunUntil = Math.max(target.stunUntil, this.clock + TAG_STUN_MS / 1000);
    return { ok: true, targetId: target.id, targetName: target.name };
  }

  requestInteract(playerId, targetId = null) {
    if (this.phase !== MATCH_PHASES.PLAYING) return { ok: false, reason: 'Match is not active.' };
    const player = this.playerMap.get(playerId);
    if (!player || player.eliminated || player.frozen || !player.connected) return { ok: false, reason: 'You cannot interact right now.' };
    if (!this.mode.canInteract) return { ok: false, reason: 'Nothing to interact with.' };
    if (this.clock - player.lastInteractAt < REVIVE_COOLDOWN_MS / 1000) return { ok: false, reason: 'Interact is cooling down.' };
    const range = this.options.reviveRange;
    const candidates = targetId ? [this.playerMap.get(targetId)].filter(Boolean) : this.players;
    const valid = [];
    for (const target of candidates) {
      if (target === player) continue;
      if (distance(player.x, player.y, target.x, target.y) > range) continue;
      const rule = this.mode.canInteract(this, player, target);
      if (rule.ok) valid.push(target);
    }
    if (!valid.length) return { ok: false, reason: 'No one nearby needs help.' };
    valid.sort((a, b) => distance(player.x, player.y, a.x, a.y) - distance(player.x, player.y, b.x, b.y));
    const target = valid[0];
    this.mode.onInteract(this, player, target);
    player.lastInteractAt = this.clock;
    return { ok: true, targetId: target.id, targetName: target.name };
  }

  tick(deltaSeconds) {
    if (this.phase === MATCH_PHASES.ENDED) return this.events;
    const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.1);
    this.tickCount += 1;
    if (this.phase === MATCH_PHASES.COUNTDOWN) {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.phase = MATCH_PHASES.PLAYING;
        this.addEvent({ type: 'match-start', message: 'GO!' });
      }
      this.updateAnimations();
      return this.events;
    }

    this.clock += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    for (const player of this.players) {
      if (player.eliminated) {
        player.vx = 0;
        player.vy = 0;
        continue;
      }
      player.survivalTime += dt;
      if (player.isIt) player.itTime += dt;
      this.updatePlayer(player, dt);
    }
    this.mode.tick(this, dt);
    this.updateAnimations();
    const ending = this.mode.checkEnd(this);
    if (ending) {
      this.finish(ending.reason, ending.winnerIds || [], ending.title, ending.detail);
    } else if (this.timeLeft <= 0) {
      this.finish('time', [], 'Time!', 'The round is over.');
    }
    return this.events;
  }

  updatePlayer(player, dt) {
    const input = player.input;
    const magnitude = Math.hypot(input.dx, input.dy);
    const canMove = player.connected && !player.frozen && !player.eliminated && this.clock >= player.stunUntil;
    const moving = canMove && magnitude > 0.01;
    const wantsSprint = Boolean(this.options.sprintEnabled && input.sprint && moving && !player.exhausted && player.stamina > STAMINA_SPRINT_MIN);
    const targetSpeed = wantsSprint ? SPRINT_SPEED : WALK_SPEED;
    const targetX = moving ? input.dx * targetSpeed : 0;
    const targetY = moving ? input.dy * targetSpeed : 0;
    const acceleration = moving ? ACCELERATION : DECELERATION;
    player.vx = approach(player.vx, targetX, acceleration * dt);
    player.vy = approach(player.vy, targetY, acceleration * dt);

    if (wantsSprint) {
      player.stamina = Math.max(0, player.stamina - STAMINA_DRAIN * dt);
      player.lastStaminaUse = this.clock;
      if (player.stamina <= 0) player.exhausted = true;
    } else if (this.clock - player.lastStaminaUse > STAMINA_RECOVER_DELAY) {
      player.stamina = Math.min(STAMINA_MAX, player.stamina + STAMINA_REGEN * dt);
      if (player.stamina > 30) player.exhausted = false;
    }
    player.sprinting = wantsSprint && Math.hypot(player.vx, player.vy) > WALK_SPEED * 0.8;

    if (!canMove) {
      player.vx = 0;
      player.vy = 0;
    }

    this.moveWithCollision(player, player.vx * dt, player.vy * dt);
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 8) {
      player.dirX = player.vx / speed;
      player.dirY = player.vy / speed;
    }
  }

  moveWithCollision(player, dx, dy) {
    if (dx !== 0) {
      const oldX = player.x;
      player.x += dx;
      if (this.map.walls.some((rect) => circleRectOverlap(player.x, player.y, player.radius, rect))) {
        player.x = oldX;
        player.vx = 0;
      }
    }
    if (dy !== 0) {
      const oldY = player.y;
      player.y += dy;
      if (this.map.walls.some((rect) => circleRectOverlap(player.x, player.y, player.radius, rect))) {
        player.y = oldY;
        player.vy = 0;
      }
    }
    player.x = clamp(player.x, player.radius, this.map.width - player.radius);
    player.y = clamp(player.y, player.radius, this.map.height - player.radius);
  }

  updateAnimations() {
    for (const player of this.players) {
      if (this.phase === MATCH_PHASES.ENDED) {
        if (this.winnerIds.includes(player.id)) player.animation = 'victory';
        else if (this.winnerIds.length) player.animation = 'defeat';
        else player.animation = 'idle';
        continue;
      }
      if (player.eliminated) player.animation = 'defeat';
      else if (player.frozen) player.animation = 'frozen';
      else if (this.clock < player.taggedUntil) player.animation = 'tagged';
      else if (this.clock < player.taggingUntil) player.animation = 'tagging';
      else {
        const speed = Math.hypot(player.vx, player.vy);
        if (player.sprinting && speed > 120) player.animation = 'sprinting';
        else if (speed > WALK_SPEED * 0.9) player.animation = 'running';
        else if (speed > 20) player.animation = 'walking';
        else player.animation = 'idle';
      }
    }
  }

  addEvent(event) {
    this.eventId += 1;
    const full = { id: this.eventId, at: this.clock, ...event };
    this.events.push(full);
    if (this.events.length > 80) this.events.shift();
    return full;
  }

  drainEvents() {
    return this.events.splice(0, this.events.length);
  }

  removePlayer(playerId) {
    const player = this.playerMap.get(playerId);
    if (!player) return;
    player.connected = false;
    player.eliminated = true;
    player.input = { dx: 0, dy: 0, sprint: false };
    player.vx = 0;
    player.vy = 0;
    player.isIt = false;
    player.isSeeker = false;
    player.frozen = false;
    if (this.mode.onRemove) this.mode.onRemove(this, player);
    this.addEvent({ type: 'leave', playerId, playerName: player.name, message: `${player.name} left the match` });
    this.updateAnimations();
    const ending = this.mode.checkEnd(this);
    if (ending) this.finish(ending.reason, ending.winnerIds || [], ending.title, ending.detail);
  }

  setConnected(playerId, connected) {
    const player = this.playerMap.get(playerId);
    if (!player) return;
    player.connected = connected;
    if (!connected) {
      player.input = { dx: 0, dy: 0, sprint: false };
      player.vx = 0;
      player.vy = 0;
      this.addEvent({ type: 'disconnect', playerId, playerName: player.name, message: `${player.name} lost connection` });
    } else {
      this.addEvent({ type: 'reconnect', playerId, playerName: player.name, message: `${player.name} reconnected` });
    }
  }

  finish(reason, winnerIds, title, detail) {
    if (this.phase === MATCH_PHASES.ENDED) return this.results;
    this.phase = MATCH_PHASES.ENDED;
    this.winnerIds = [...new Set(winnerIds)].filter((id) => this.playerMap.has(id));
    this.countdown = 0;
    const winnerSet = new Set(this.winnerIds);
    for (const player of this.players) {
      player.input = { dx: 0, dy: 0, sprint: false };
      player.vx = 0;
      player.vy = 0;
    }
    this.updateAnimations();
    const ordered = [...this.players].sort((a, b) => {
      const aw = winnerSet.has(a.id) ? 1 : 0;
      const bw = winnerSet.has(b.id) ? 1 : 0;
      return bw - aw || b.score - a.score || b.tags - a.tags || a.itTime - b.itTime || a.name.localeCompare(b.name);
    });
    const standings = ordered.map((player, index) => ({
      placement: index + 1,
      id: player.id,
      name: player.name,
      team: player.team,
      isBot: player.isBot,
      won: winnerSet.has(player.id),
      tags: player.tags,
      timesTagged: player.timesTagged,
      itTime: Number(player.itTime.toFixed(2)),
      survivalTime: Number(player.survivalTime.toFixed(2)),
      score: player.score,
      revives: player.revives,
      appearance: player.appearance
    }));
    this.results = {
      matchId: this.matchId,
      modeId: this.modeId,
      mapId: this.mapId,
      reason,
      title: title || 'Match complete',
      detail: detail || '',
      winnerIds: [...this.winnerIds],
      winners: this.winnerIds.map((id) => this.playerMap.get(id)?.name).filter(Boolean),
      standings,
      duration: Number(this.clock.toFixed(2)),
      at: Date.now()
    };
    this.addEvent({ type: 'match-end', message: title || 'Match complete', reason });
    return this.results;
  }

  serialize() {
    return {
      matchId: this.matchId,
      modeId: this.modeId,
      mapId: this.mapId,
      phase: this.phase,
      countdown: Number(this.countdown.toFixed(2)),
      timeLeft: Number(this.timeLeft.toFixed(2)),
      elapsed: Number(this.clock.toFixed(2)),
      tick: this.tickCount,
      options: {
        tagDistance: this.options.tagDistance,
        tagCooldownMs: this.options.tagCooldownMs,
        sprintEnabled: this.options.sprintEnabled,
        reviveRange: this.options.reviveRange,
        duration: this.options.duration
      },
      modeState: this.mode.getState(this),
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        appearance: player.appearance,
        isBot: player.isBot,
        team: player.team,
        x: Number(player.x.toFixed(2)),
        y: Number(player.y.toFixed(2)),
        vx: Number(player.vx.toFixed(2)),
        vy: Number(player.vy.toFixed(2)),
        dirX: Number(player.dirX.toFixed(3)),
        dirY: Number(player.dirY.toFixed(3)),
        animation: player.animation,
        isIt: player.isIt,
        isSeeker: player.isSeeker,
        isEvader: player.isEvader,
        infected: player.infected,
        frozen: player.frozen,
        eliminated: player.eliminated,
        connected: player.connected,
        stamina: Number(player.stamina.toFixed(1)),
        sprinting: player.sprinting,
        tags: player.tags,
        timesTagged: player.timesTagged,
        itTime: Number(player.itTime.toFixed(1)),
        score: player.score,
        revives: player.revives,
        lastInputSeq: player.lastInputSeq
      }))
    };
  }

  getPlayer(playerId) {
    return this.playerMap.get(playerId) || null;
  }

  getWinnerNames() {
    return this.winnerIds.map((id) => this.playerMap.get(id)?.name).filter(Boolean);
  }
}

export { sanitizeInput };
