import Phaser from 'phaser';
import {
  CHARACTERS,
  DEFAULT_OPTIONS,
  GRAPHICS_PRESETS,
  INPUT_RATE,
  PALETTES
} from '@shared/constants.js';
import { MATCH_PHASES, SERVER_EVENTS } from '@shared/events.js';
import { MatchEngine } from '@shared/MatchEngine.js';
import { MODE_MAP } from '@shared/constants.js';
import { stepPlayerPhysics } from '@shared/physics.js';
import { clamp, distance, normalize } from '@shared/utils.js';
import { CharacterView } from './CharacterView.js';
import { InputManager } from './InputManager.js';
import { MapRenderer } from './MapRenderer.js';
import { BotController } from './BotController.js';

const BOT_NAMES = ['Ace', 'Juno', 'Milo', 'Rae', 'Kai', 'Pip', 'Sage', 'Remy', 'Nico', 'Iris', 'Tess', 'Oli', 'Wren', 'Bea'];
const TRAIL_COLORS = { spark: 0xffd166, bubble: 0x7bdff2, leaf: 0x9adf7a };

function appearanceFor(index) {
  return {
    characterId: CHARACTERS[index % CHARACTERS.length].id,
    paletteId: PALETTES[(index * 3) % PALETTES.length].id,
    outfitId: ['tee', 'hoodie', 'varsity', 'jacket', 'robe'][index % 5],
    accessoryId: ['none', 'cap', 'headphones', 'antenna', 'halo', 'scarf'][(index * 2) % 6],
    trailId: ['none', 'spark', 'bubble', 'leaf'][index % 4]
  };
}

function canTagTarget(modeId, local, target, tagDistance, localX, localY) {
  if (!local || !target || target.id === local.id) return false;
  if (target.eliminated || target.frozen || target.connected === false) return false;
  if (distance(localX, localY, target.x, target.y) > tagDistance) return false;
  if (target.team && local.team && target.team === local.team && modeId === 'team') return false;
  if (modeId === 'infection') return Boolean(local.infected && !target.infected);
  if (modeId === 'team') return Boolean(local.isSeeker && !target.isSeeker && target.team !== local.team);
  if (modeId === 'reverse') return Boolean(!local.isIt && target.isEvader);
  if (modeId === 'freeze') return Boolean(local.isIt && !target.frozen);
  if (modeId === 'last') return Boolean(local.isIt && !target.eliminated);
  return Boolean(local.isIt && !target.isIt);
}

function interactTarget(modeId, local, players, range, localX, localY) {
  if (modeId !== 'freeze' || !local || local.isIt || local.frozen || local.eliminated) return null;
  let best = null;
  let bestDistance = range;
  for (const player of players) {
    if (player.id === local.id || !player.frozen || player.eliminated || player.connected === false) continue;
    const d = distance(localX, localY, player.x, player.y);
    if (d <= bestDistance) { best = player; bestDistance = d; }
  }
  return best;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init(data) {
    this.sceneData = data;
    this.mode = data.mode || 'online';
    this.online = this.mode === 'online';
    this.network = data.network || null;
    this.localId = data.localId;
    this.profile = data.profile || {};
    this.settings = data.settings || {};
    this.audio = data.audio;
    this.callbacks = data.callbacks || {};
    this.paused = false;
    this.ended = false;
    this.practiceFinished = false;
    this.connectionLost = false;
    this.views = new Map();
    this.remotePositions = new Map();
    this.playerData = new Map();
    this.lastTrailAt = new Map();
    this.lastHudAt = 0;
    this.lastCountdownInt = null;
    this.lastPhase = null;
    this.lastTagAttempt = 0;
    this.lastInteractAttempt = 0;
    this.lastFailToast = 0;
    this.tagTargetId = null;
    this.interactTargetId = null;
    this.localState = null;
    this.snapshot = null;
    this.networkSubs = [];
    this.practiceResults = null;
    this.gameEndedNotified = false;
    this.lastInputSent = 0;
    this.inputSeq = 0;
    this.lastFrameAt = null;
    this.inputAccumulator = 0;
    this.practiceAccumulator = 0;
    this.practiceTick = 1 / 60;
    this.destroyed = false;
  }

  create() {
    const mapId = this.online ? this.sceneData.initialState?.mapId : this.sceneData.mapId;
    const quality = GRAPHICS_PRESETS[this.settings.graphics] || GRAPHICS_PRESETS.high;
    this.quality = this.settings.reducedMotion ? { ...quality, pulse: false, shadows: true } : quality;
    this.mapRenderer = new MapRenderer(this, mapId, this.quality);
    this.map = this.mapRenderer.map;
    this.cameras.main.setBackgroundColor('#060918');
    this.cameras.main.setBounds(0, 0, this.map.width, this.map.height);
    this.cameras.main.roundPixels = true;
    this.cameras.main.setZoom(window.innerWidth < 760 ? 0.92 : (this.quality.cameraZoom || 1));
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.cleanup, this);
    this.audio?.startMusic('game');

    this.controls = new InputManager(this, {
      bindings: this.settings.bindings,
      onTag: () => this.attemptTag(),
      onInteract: () => this.attemptInteract(),
      onScoreboard: (visible) => this.callbacks.onScoreboard?.(visible),
      onEsc: () => this.callbacks.onPauseRequest?.(),
      onBlur: () => this.callbacks.onFocusLost?.()
    });

    if (this.online) this.setupOnline();
    else this.setupPractice();

    this.callbacks.onReady?.({
      setPaused: (value) => this.setPaused(value),
      setTouchVector: (x) => this.controls?.setTouchVector(x),
      setTouchSprint: (active) => this.controls?.setTouchSprint(active),
      setTouchJump: (active) => this.controls?.setTouchJump(active),
      requestTag: () => this.attemptTag(),
      requestInteract: () => this.attemptInteract(),
      scene: this
    });
    this.flushHud(true);
  }

  setupOnline() {
    const initial = this.sceneData.initialState;
    if (initial) this.applySnapshot(initial, { initial: true });
    this.networkSubs.push(
      this.network?.on(SERVER_EVENTS.MATCH_STATE, (snapshot) => this.applySnapshot(snapshot)),
      this.network?.on(SERVER_EVENTS.MATCH_EVENT, (event) => this.handleGameEvent(event)),
      this.network?.on(SERVER_EVENTS.MATCH_END, (payload) => this.handleOnlineEnd(payload)),
      this.network?.on(SERVER_EVENTS.TAG_RESULT, (payload) => this.handleTagResult(payload)),
      this.network?.on('connection', (state) => this.handleConnection(state))
    );
    this.callbacks.onConnection?.(this.network ? 'connected' : 'offline');
  }

  setupPractice() {
    const config = this.sceneData.practice || {};
    const modeId = config.modeId && MODE_MAP[config.modeId] ? config.modeId : 'classic';
    const mapId = config.mapId || this.sceneData.mapId || 'playground';
    const modeMeta = MODE_MAP[modeId];
    let botCount = clamp(Number(config.bots) || 5, 1, 11);
    botCount = Math.max(botCount, Math.max(1, (modeMeta?.minPlayers || 2) - 1));
    if (modeMeta?.teamBased && (botCount + 1) % 2 !== 0 && botCount < 11) botCount += 1;
    const human = {
      id: 'you',
      name: this.profile.name || 'You',
      appearance: {
        characterId: this.profile.characterId,
        paletteId: this.profile.paletteId,
        outfitId: this.profile.outfitId,
        accessoryId: this.profile.accessoryId,
        trailId: this.profile.trailId
      },
      isBot: false
    };
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const bots = Array.from({ length: botCount }, (_, index) => ({
      id: `bot-${index + 1}`,
      name: names[index % names.length],
      appearance: appearanceFor(index + Math.floor(Math.random() * 6)),
      isBot: true,
      difficulty: config.difficulty || 'normal'
    }));
    this.practiceEngine = new MatchEngine({
      modeId,
      mapId,
      options: { ...DEFAULT_OPTIONS, duration: config.duration || 150, countdown: 3 },
      players: [human, ...bots]
    });
    this.practiceEngine.addEvent({ type: 'round-start', message: `${modeMeta?.name || 'Classic Tag'} practice` });
    this.botController = new BotController(this.practiceEngine, config.difficulty || 'normal');
    this.localId = 'you';
    const snapshot = this.practiceEngine.serialize();
    this.applySnapshot(snapshot, { initial: true, authoritative: true });
  }

  handleResize() {
    if (!this.cameras?.main) return;
    this.cameras.main.setZoom(window.innerWidth < 760 ? 0.92 : (this.quality?.cameraZoom || 1));
  }

  applySnapshot(snapshot, { initial = false, authoritative = false } = {}) {
    if (!snapshot || this.destroyed) return;
    if (this.snapshot && snapshot.matchId && this.snapshot.matchId && snapshot.matchId !== this.snapshot.matchId) return;
    if (!initial && this.snapshot && snapshot.tick < this.snapshot.tick) return;
    const previousPhase = this.snapshot?.phase;
    this.snapshot = snapshot;
    this.phase = snapshot.phase;
    this.countdown = snapshot.countdown;
    this.timeLeft = snapshot.timeLeft;
    this.modeState = snapshot.modeState;
    this.matchOptions = snapshot.options;
    if (!this.localId) this.localId = this.sceneData.localId;

    const nextIds = new Set();
    for (const player of snapshot.players) {
      nextIds.add(player.id);
      this.playerData.set(player.id, player);
      if (!this.views.has(player.id)) {
        const view = new CharacterView(this, player, {
          localId: this.localId,
          modeId: snapshot.modeId,
          quality: this.quality
        });
        this.views.set(player.id, view);
        this.remotePositions.set(player.id, { x: player.x, y: player.y });
      }
      const remote = this.remotePositions.get(player.id);
      if (player.id === this.localId) {
        if (!this.localState) this.localState = this.createLocalState(player);
        this.syncLocalFlags(player, snapshot, authoritative, initial);
        if (initial || authoritative || previousPhase !== snapshot.phase) {
          this.localState.x = player.x;
          this.localState.y = player.y;
          this.localState.vx = player.vx;
          this.localState.vy = player.vy;
        } else {
          const error = distance(this.localState.x, this.localState.y, player.x, player.y);
          const shouldSnap = error > 120 || player.frozen || player.eliminated || player.connected === false;
          if (shouldSnap) {
            this.localState.x = player.x;
            this.localState.y = player.y;
            this.localState.vx = player.vx;
            this.localState.vy = player.vy;
          }
        }
      } else if (remote) {
        const error = distance(remote.x, remote.y, player.x, player.y);
        if (initial || authoritative || error > 190) {
          remote.x = player.x;
          remote.y = player.y;
        }
      }
    }
    for (const [id, view] of this.views) {
      if (nextIds.has(id)) continue;
      view.destroy();
      this.views.delete(id);
      this.remotePositions.delete(id);
      this.playerData.delete(id);
    }
    const localView = this.views.get(this.localId);
    if (localView && !this.followStarted) {
      this.followStarted = true;
      this.cameras.main.startFollow(localView.container, true, initial ? 1 : 0.16, initial ? 1 : 0.1);
      this.cameras.main.setDeadzone(220, 150);
      if (initial) this.cameras.main.centerOn(localView.container.x, localView.container.y);
    }

    if (snapshot.phase === MATCH_PHASES.COUNTDOWN) {
      const whole = Math.ceil(snapshot.countdown);
      if (whole > 0 && whole <= 3 && whole !== this.lastCountdownInt) {
        this.audio?.countdown();
      }
      this.lastCountdownInt = whole;
    }
    if (previousPhase === MATCH_PHASES.COUNTDOWN && snapshot.phase === MATCH_PHASES.PLAYING) {
      this.lastCountdownInt = null;
      this.audio?.go();
    }
    if (snapshot.phase === MATCH_PHASES.ENDED) {
      this.ended = true;
      this.controls?.clear();
    }
  }

  createLocalState(player) {
    return {
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      dirX: player.dirX,
      dirY: player.dirY,
      grounded: player.grounded !== false,
      jumpHeld: false,
      jumpBuffer: 0,
      coyote: 0.1,
      exhausted: Boolean(player.exhausted),
      stamina: player.stamina,
      sprinting: Boolean(player.sprinting),
      frozen: player.frozen,
      eliminated: player.eliminated,
      connected: player.connected,
      team: player.team,
      isIt: player.isIt,
      isSeeker: player.isSeeker,
      isEvader: player.isEvader,
      infected: player.infected,
      animation: player.animation,
      serverX: player.x,
      serverY: player.y
    };
  }

  syncLocalFlags(player, snapshot, authoritative, initial) {
    const state = this.localState;
    state.stamina = player.stamina;
    state.exhausted = Boolean(player.exhausted);
    state.sprinting = Boolean(player.sprinting);
    state.frozen = player.frozen;
    state.eliminated = player.eliminated;
    state.connected = player.connected;
    state.team = player.team;
    state.isIt = player.isIt;
    state.isSeeker = player.isSeeker;
    state.isEvader = player.isEvader;
    state.infected = player.infected;
    state.animation = player.animation;
    state.serverX = player.x;
    state.serverY = player.y;
    if (authoritative || initial) {
      state.dirX = player.dirX;
      state.dirY = player.dirY;
      state.grounded = player.grounded !== false;
    }
  }

  update(time, deltaMs) {
    if (this.destroyed) return;
    const elapsed = this.lastFrameAt == null ? deltaMs / 1000 : (time - this.lastFrameAt) / 1000;
    this.lastFrameAt = time;
    const dt = Math.max(0, Math.min(0.1, Number.isFinite(elapsed) ? elapsed : deltaMs / 1000));
    if (this.online) {
      if (!this.ended) this.updateLocalPrediction(dt, time);
      this.updateOnlineViews(dt, time);
      if (!this.paused && !this.ended) this.sendInput(dt);
    } else {
      this.updatePractice(dt, time);
      this.updatePracticeViews(dt, time);
    }
    this.updatePrompts();
    this.updateTrails(time);
    if (time - this.lastHudAt > 90) this.flushHud();
  }

  updateLocalPrediction(dt, time) {
    if (!this.localState || !this.snapshot) return;
    const state = this.localState;
    const input = this.paused || this.ended || this.connectionLost
      ? { dx: 0, sprint: false, jump: false }
      : this.controls.getInput();
    const canControl = this.phase === MATCH_PHASES.PLAYING
      && state.connected !== false
      && !state.frozen
      && !state.eliminated
      && state.animation !== 'tagged';
    stepPlayerPhysics(state, this.map, input, dt, {
      sprintEnabled: this.matchOptions?.sprintEnabled,
      clock: this.snapshot.elapsed,
      canControl
    });
    state.speed = Math.abs(state.vx);
  }

  sendInput(dt) {
    if (!this.network || !this.phase) return;
    if (this.phase !== MATCH_PHASES.PLAYING) return;
    this.inputAccumulator += dt;
    if (this.inputAccumulator < 1 / INPUT_RATE) return;
    this.inputAccumulator = 0;
    const input = this.paused || this.connectionLost
      ? { dx: 0, sprint: false, jump: false }
      : this.controls.getInput();
    this.inputSeq += 1;
    this.network.sendInput(this.inputSeq, input.dx, input.sprint, input.jump);
  }

  updateOnlineViews(dt, time) {
    if (!this.snapshot) return;
    for (const [id, view] of this.views) {
      const player = this.playerData.get(id);
      if (!player) continue;
      let x;
      let y;
      let state = player;
      if (id === this.localId && this.localState) {
        x = this.localState.x;
        y = this.localState.y;
        state = { ...player, ...this.localState, animation: this.localAnimation(player) };
      } else {
        const remote = this.remotePositions.get(id);
        if (remote) {
          const factor = 1 - Math.exp(-14 * dt);
          remote.x += (player.x - remote.x) * factor;
          remote.y += (player.y - remote.y) * factor;
          x = remote.x;
          y = remote.y;
        } else {
          x = player.x;
          y = player.y;
        }
      }
      view.setPosition(x, y);
      view.apply(state, dt, time);
    }
    this.updateLocalFootsteps();
  }

  localAnimation(player) {
    if (!this.localState) return player.animation;
    if (this.ended) return player.animation;
    if (this.localState.frozen) return 'frozen';
    if (this.localState.eliminated) return 'defeat';
    if (player.animation === 'tagged' || player.animation === 'tagging' || player.animation === 'victory') return player.animation;
    if (!this.localState.grounded && this.localState.vy < -60) return 'jumping';
    if (!this.localState.grounded) return 'falling';
    const speed = this.localState.speed || Math.abs(this.localState.vx);
    if (this.localState.sprinting && speed > 120) return 'sprinting';
    if (speed > 150) return 'running';
    if (speed > 22) return 'walking';
    return 'idle';
  }

  updateLocalFootsteps() {
    if (this.paused || !this.localState || this.ended) return;
    const speed = this.localState.speed || Math.abs(this.localState.vx);
    if (speed > 90 && this.localState.grounded) this.audio?.footstep(this.localState.sprinting);
  }

  updatePractice(dt, time) {
    if (!this.practiceEngine || this.ended) return;
    if (this.paused) {
      this.practiceEngine.setInput('you', { dx: 0, sprint: false, jump: false, seq: this.inputSeq });
      return;
    }
    this.practiceAccumulator += dt;
    let guard = 0;
    while (this.practiceAccumulator >= this.practiceTick && guard < 6) {
      this.practiceAccumulator -= this.practiceTick;
      guard += 1;
      const input = this.controls.getInput();
      this.inputSeq += 1;
      this.practiceEngine.setInput('you', { ...input, seq: this.inputSeq });
      this.botController?.update(this.practiceTick);
      this.practiceEngine.tick(this.practiceTick);
      const events = this.practiceEngine.drainEvents();
      for (const event of events) this.handleGameEvent(event, true);
      const snapshot = this.practiceEngine.serialize();
      this.applySnapshot(snapshot, { authoritative: true });
      const local = this.practiceEngine.getPlayer('you');
      if (local) {
        this.localState.x = local.x;
        this.localState.y = local.y;
        this.localState.vx = local.vx;
        this.localState.vy = local.vy;
        this.localState.grounded = local.grounded;
        this.localState.exhausted = Boolean(local.exhausted);
        this.localState.speed = Math.abs(local.vx);
        this.localState.sprinting = Boolean(local.sprinting);
      }
      if (this.practiceEngine.phase === MATCH_PHASES.ENDED && !this.practiceFinished) {
        this.practiceFinished = true;
        this.ended = true;
        this.practiceResults = this.practiceEngine.results;
      }
    }
    if (this.localState) {
      const speed = Math.abs(this.localState.vx);
      this.localState.speed = speed;
      if (speed > 90 && this.localState.grounded) this.audio?.footstep(this.localState.sprinting);
    }
    if (this.practiceFinished && !this.gameEndedNotified) {
      this.gameEndedNotified = true;
      this.finishPractice();
    }
  }

  updatePracticeViews(dt, time) {
    for (const [id, view] of this.views) {
      const player = this.playerData.get(id);
      if (!player) continue;
      const remote = this.remotePositions.get(id);
      if (id !== this.localId && remote) {
        const factor = 1 - Math.exp(-22 * dt);
        remote.x += (player.x - remote.x) * factor;
        remote.y += (player.y - remote.y) * factor;
        view.setPosition(remote.x, remote.y);
      } else {
        view.setPosition(player.x, player.y);
      }
      const state = id === this.localId && this.localState
        ? { ...player, ...this.localState, animation: player.animation }
        : player;
      view.apply(state, dt, time);
    }
  }

  updatePrompts() {
    if (!this.snapshot || !this.views.size) {
      this.tagTargetId = null;
      this.interactTargetId = null;
      return;
    }
    const localPlayer = this.playerData.get(this.localId);
    if (!localPlayer || this.ended) {
      this.tagTargetId = null;
      this.interactTargetId = null;
      for (const view of this.views.values()) view.setPromptable(false);
      return;
    }
    const lx = this.localState?.x ?? localPlayer.x;
    const ly = this.localState?.y ?? localPlayer.y;
    const localForDistance = { ...localPlayer, x: lx, y: ly };
    const players = [...this.playerData.values()].map((player) => player.id === this.localId ? localForDistance : player);
    const tagDistance = this.matchOptions?.tagDistance || DEFAULT_OPTIONS.tagDistance;
    let target = null;
    let best = Infinity;
    if (this.phase === MATCH_PHASES.PLAYING && !this.paused) {
      for (const player of players) {
        if (!canTagTarget(this.snapshot.modeId, localPlayer, player, tagDistance, lx, ly)) continue;
        const d = distance(lx, ly, player.x, player.y);
        if (d < best) { best = d; target = player; }
      }
    }
    this.tagTargetId = target?.id || null;
    const interact = this.phase === MATCH_PHASES.PLAYING && !this.paused
      ? interactTarget(this.snapshot.modeId, localPlayer, players, this.matchOptions?.reviveRange || DEFAULT_OPTIONS.reviveRange, lx, ly)
      : null;
    this.interactTargetId = interact?.id || null;
    for (const [id, view] of this.views) {
      view.setPromptable(id === this.tagTargetId || id === this.interactTargetId);
    }
    this.prompt = this.interactTargetId
      ? `THAW ${interact?.name || 'TEAMMATE'}`
      : this.tagTargetId ? `TAG ${target?.name || 'PLAYER'}` : '';
    this.promptKind = this.interactTargetId ? 'interact' : this.tagTargetId ? 'tag' : '';
  }

  updateTrails(time) {
    if (this.settings.reducedMotion || this.settings.particles === false || !this.quality || this.quality.particles <= 0) return;
    for (const [id, view] of this.views) {
      const player = this.playerData.get(id);
      if (!player || player.eliminated || player.frozen || !player.connected) continue;
      const trail = player.appearance?.trailId;
      if (!trail || trail === 'none') continue;
      const speed = id === this.localId && this.localState ? Math.abs(this.localState.vx) : Math.abs(player.vx);
      if (speed < 95) continue;
      const last = this.lastTrailAt.get(id) || 0;
      if (time - last < (trail === 'spark' ? 100 : 150)) continue;
      this.lastTrailAt.set(id, time);
      this.spawnTrail(trail, view.x, view.y - 4);
    }
  }

  spawnTrail(trail, x, y) {
    const color = TRAIL_COLORS[trail] || 0xffffff;
    let particle;
    if (trail === 'leaf') {
      particle = this.add.rectangle(x + (Math.random() - 0.5) * 10, y, 6, 3, color, 0.8);
      particle.setRotation(Math.random() * Math.PI);
    } else if (trail === 'bubble') {
      particle = this.add.circle(x + (Math.random() - 0.5) * 10, y, 4, color, 0.12);
      particle.setStrokeStyle(1, color, 0.65);
    } else {
      particle = this.add.circle(x + (Math.random() - 0.5) * 8, y, 2.5, color, 0.85);
    }
    particle.setDepth(Math.round(y) + 60);
    this.tweens.add({
      targets: particle,
      y: y - 14 - Math.random() * 9,
      alpha: 0,
      scale: 0.35,
      duration: 480 + Math.random() * 240,
      ease: 'Sine.easeOut',
      onComplete: () => particle.destroy()
    });
  }

  burst(x, y, color = 0xffd166, count = 9) {
    if (this.settings.reducedMotion || this.settings.particles === false) return;
    const max = Math.min(count, this.quality?.particles || 8);
    for (let i = 0; i < max; i += 1) {
      const angle = (i / max) * Math.PI * 2 + Math.random() * 0.4;
      const distanceRadius = 16 + Math.random() * 24;
      const particle = this.add.circle(x, y - 22, 3 + Math.random() * 2, color, 0.9);
      particle.setDepth(Math.round(y) + 120);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distanceRadius,
        y: y - 22 + Math.sin(angle) * distanceRadius * 0.7,
        alpha: 0,
        scale: 0.2,
        duration: 380 + Math.random() * 260,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  handleGameEvent(event, localEvent = false) {
    if (!event || !event.type) return;
    if (event.type === 'match-end') return;
    if (event.type === 'round-start') return;
    if (event.type === 'tag') {
      const view = this.views.get(event.targetId);
      if (view) this.burst(view.x, view.y, 0xff6b81, 11);
      if (event.targetId === this.localId) {
        this.audio?.tagged();
        if (this.settings.screenShake !== false && !this.settings.reducedMotion) this.cameras.main.shake(120, 0.004);
      } else if (event.taggerId === this.localId) {
        this.audio?.tag();
        if (this.settings.screenShake !== false && !this.settings.reducedMotion) this.cameras.main.shake(80, 0.002);
      } else {
        this.audio?.tag();
      }
    } else if (event.type === 'rescue') {
      const view = this.views.get(event.targetId);
      if (view) this.burst(view.x, view.y, 0x7bdff2, 12);
      this.audio?.rescue();
    } else if (event.type === 'leave' || event.type === 'disconnect') {
      this.audio?.uiLeave();
    } else if (event.type === 'reconnect') {
      this.audio?.uiJoin();
    }
    const involvesLocal = localEvent
      || event.targetId === this.localId
      || event.taggerId === this.localId
      || event.playerId === this.localId;
    if (involvesLocal && event.message) {
      const tone = event.type === 'tag' && event.targetId === this.localId ? 'danger' : event.type === 'rescue' ? 'good' : 'accent';
      this.callbacks.onGameEvent?.({ ...event, tone });
    }
  }

  handleTagResult(payload) {
    if (!payload || payload.ok) return;
    const now = performance.now();
    if (now - this.lastFailToast < 1200) return;
    this.lastFailToast = now;
    this.callbacks.onGameEvent?.({ type: 'notice', tone: 'warn', message: payload.reason || 'That did not work.' });
  }

  attemptTag() {
    if (this.paused || this.ended || this.phase !== MATCH_PHASES.PLAYING) return;
    const now = performance.now();
    if (now - this.lastTagAttempt < 220) return;
    this.lastTagAttempt = now;
    if (this.online) {
      this.network?.tag(this.tagTargetId);
    } else {
      const outcome = this.practiceEngine.requestTag('you', this.tagTargetId);
      const events = this.practiceEngine.drainEvents();
      for (const event of events) this.handleGameEvent(event, true);
      if (!outcome.ok) {
        if (now - this.lastFailToast > 1100) {
          this.lastFailToast = now;
          this.callbacks.onGameEvent?.({ type: 'notice', tone: 'warn', message: outcome.reason });
        }
      }
    }
  }

  attemptInteract() {
    if (this.paused || this.ended || this.phase !== MATCH_PHASES.PLAYING) return;
    const now = performance.now();
    if (now - this.lastInteractAttempt < 450) return;
    this.lastInteractAttempt = now;
    if (this.online) {
      this.network?.interact(this.interactTargetId);
    } else {
      const outcome = this.practiceEngine.requestInteract('you', this.interactTargetId);
      const events = this.practiceEngine.drainEvents();
      for (const event of events) this.handleGameEvent(event, true);
      if (!outcome.ok && outcome.reason !== 'Nothing to interact with.' && now - this.lastFailToast > 1100) {
        this.lastFailToast = now;
        this.callbacks.onGameEvent?.({ type: 'notice', tone: 'warn', message: outcome.reason });
      }
    }
  }

  handleConnection(state) {
    const wasLost = this.connectionLost;
    this.connectionLost = state.state !== 'ready' && state.state !== 'connected';
    if (this.connectionLost && !wasLost) {
      this.callbacks.onGameEvent?.({ type: 'connection', tone: 'warn', message: 'Connection lost. Trying to reconnect…' });
    } else if (!this.connectionLost && wasLost) {
      this.callbacks.onGameEvent?.({ type: 'connection', tone: 'good', message: 'Reconnected.' });
    }
    this.flushHud(true);
  }

  handleOnlineEnd(payload) {
    if (this.gameEndedNotified) return;
    this.gameEndedNotified = true;
    this.ended = true;
    this.controls?.clear();
    const results = payload?.results;
    if (results) {
      this.practiceResults = results;
      this.announceResultAudio(results);
      this.callbacks.onEnd?.(results, { practice: false, lobby: payload.lobby || null });
    }
  }

  finishPractice() {
    const results = this.practiceResults;
    if (!results) return;
    this.controls?.clear();
    this.announceResultAudio(results);
    this.callbacks.onEnd?.(results, { practice: true });
  }

  announceResultAudio(results) {
    const won = results.winnerIds?.includes(this.localId);
    if (won) this.audio?.win(); else this.audio?.lose();
    if (won && this.settings.screenShake !== false && !this.settings.reducedMotion) this.cameras.main.shake(180, 0.002);
  }

  flushHud(force = false) {
    if (!this.callbacks.onHud || !this.snapshot || !this.localState) return;
    if (!force && this.time.now - this.lastHudAt < 90) return;
    this.lastHudAt = this.time.now;
    const localPlayer = this.playerData.get(this.localId) || {};
    const players = [...this.playerData.values()].map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      x: player.id === this.localId ? this.localState.x : (this.remotePositions.get(player.id)?.x ?? player.x),
      y: player.id === this.localId ? this.localState.y : (this.remotePositions.get(player.id)?.y ?? player.y),
      isIt: player.isIt,
      isSeeker: player.isSeeker,
      isEvader: player.isEvader,
      infected: player.infected,
      frozen: player.frozen,
      eliminated: player.eliminated,
      connected: player.connected,
      isBot: player.isBot,
      tags: player.tags,
      score: player.score,
      animation: player.animation,
      appearance: player.appearance
    }));
    this.callbacks.onHud({
      phase: this.snapshot.phase,
      countdown: this.snapshot.countdown,
      timeLeft: this.snapshot.timeLeft,
      elapsed: this.snapshot.elapsed,
      modeId: this.snapshot.modeId,
      mapId: this.snapshot.mapId,
      options: this.matchOptions,
      modeState: { ...this.modeState },
      players,
      localId: this.localId,
      local: {
        ...localPlayer,
        x: this.localState.x,
        y: this.localState.y,
        stamina: this.localState.stamina,
        sprinting: Boolean(this.localState.sprinting),
        frozen: this.localState.frozen,
        eliminated: this.localState.eliminated,
        connected: this.localState.connected
      },
      prompt: this.prompt || '',
      promptKind: this.promptKind || '',
      canTag: Boolean(this.tagTargetId),
      canInteract: Boolean(this.interactTargetId),
      tagTargetId: this.tagTargetId,
      interactTargetId: this.interactTargetId,
      ping: this.network?.rtt ?? null,
      quality: this.network?.quality?.() || 'ok',
      connectionLost: this.connectionLost,
      practice: !this.online,
      difficulty: this.sceneData.practice?.difficulty || null
    });
  }

  setPaused(value) {
    if (this.destroyed) return;
    this.paused = Boolean(value);
    this.controls?.setEnabled(!this.paused);
    if (this.paused) {
      this.controls?.clear();
      if (this.online) {
        this.inputSeq += 1;
        this.network?.sendInput(this.inputSeq, 0, false, false);
      }
    }
  }

  cleanup() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const unsubscribe of this.networkSubs || []) {
      try { unsubscribe(); } catch {}
    }
    this.networkSubs = [];
    this.controls?.destroy();
    this.scale.off('resize', this.handleResize, this);
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.remotePositions.clear();
    this.playerData.clear();
    this.botController = null;
    this.practiceEngine = null;
    this.callbacks.onSceneClosed?.();
  }
}
