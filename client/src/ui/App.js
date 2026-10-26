import {
  ACCESSORIES,
  ACHIEVEMENTS,
  CHARACTERS,
  GAME_MODES,
  MODE_MAP,
  OUTFITS,
  PALETTES,
  TRAILS
} from '@shared/constants.js';
import { MATCH_PHASES, SERVER_EVENTS } from '@shared/events.js';
import { MAP_MAP, MAPS } from '@shared/maps.js';
import { store } from '../state/Store.js';
import { NetworkClient } from '../networking/NetworkClient.js';
import { AudioManager } from '../game/AudioManager.js';
import { drawCharacter, hydrateAvatars, renderAvatarHtml } from '../game/CharacterArt.js';
import { hydrateMapPreviews } from '../utils/mapPreview.js';
import {
  escapeHtml,
  formatClock,
  formatDuration,
  keyLabel,
  mapInfo,
  modeInfo,
  relativeTime,
  roleLabel,
  teamInfo
} from '../utils/format.js';

const CONTROL_LABELS = {
  up: 'Move up',
  down: 'Move down',
  left: 'Move left',
  right: 'Move right',
  sprint: 'Sprint',
  tag: 'Tag',
  interact: 'Thaw / interact',
  scoreboard: 'Scoreboard'
};

const TOAST_ICONS = { error: '!', success: '+', info: 'i', warning: '!' };
const TONE_CLASS = { danger: 'error', warn: 'warning', warning: 'warning', good: 'success', accent: 'info' };

function appearanceOf(profile) {
  return {
    characterId: profile.characterId,
    paletteId: profile.paletteId,
    outfitId: profile.outfitId,
    accessoryId: profile.accessoryId,
    trailId: profile.trailId
  };
}

function profileFromPlayer(player) {
  return { name: player?.name || 'Player', ...(player?.appearance || {}) };
}

function formatSeconds(value) {
  return formatDuration(Number(value) || 0);
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((Number(value) / Number(total)) * 100);
}

function prettyCode(code) {
  return String(code || 'error').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function connectionModel(connection) {
  if (connection.state === 'ready') {
    return {
      quality: connection.quality || 'good',
      label: connection.rtt == null || connection.rtt < 15 ? 'Online' : `${connection.rtt} ms`,
      title: 'Connected to the game server'
    };
  }
  if (connection.state === 'error') return { quality: 'poor', label: 'Offline', title: 'The game server is not reachable' };
  if (connection.state === 'disconnected') return { quality: 'poor', label: 'Reconnecting', title: 'Trying to reconnect' };
  return { quality: 'ok', label: 'Connecting', title: 'Connecting to the game server' };
}

function modeCard(mode, selected, action) {
  return `
    <button class="mode-card ${selected ? 'is-selected' : ''}" type="button" data-action="${action}" data-mode-id="${mode.id}" aria-pressed="${selected}" style="--mode-accent:${mode.accent}">
      <span class="mode-icon" aria-hidden="true">${mode.icon}</span>
      <b>${escapeHtml(mode.name)}</b>
      <span>${escapeHtml(mode.description)}</span>
    </button>
  `;
}

function mapCard(map, selected, action) {
  return `
    <button class="map-card ${selected ? 'is-selected' : ''}" type="button" data-action="${action}" data-map-id="${map.id}" aria-pressed="${selected}">
      <canvas class="map-thumb" data-preview-map="${map.id}" width="240" height="150" aria-hidden="true"></canvas>
      <span class="map-card-info"><b>${escapeHtml(map.name)}</b><span>${escapeHtml(map.subtitle)}</span></span>
    </button>
  `;
}

function badge(text, tone = '') {
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

export class App {
  constructor(game) {
    this.game = game;
    this.screenRoot = document.getElementById('screen-root');
    this.hudRoot = document.getElementById('hud-root');
    this.overlayRoot = document.getElementById('overlay-root');
    this.toastRoot = document.getElementById('toast-root');
    this.modalRoot = document.getElementById('modal-root');
    this.bootScreen = document.getElementById('boot-screen');

    this.audio = new AudioManager(store.settings);
    this.network = new NetworkClient({ getProfile: () => store.profile });
    this.connection = { state: 'connecting', quality: 'ok', rtt: null, message: '' };
    this.playerId = null;
    this.currentLobby = null;
    this.currentScreen = null;
    this.busy = false;
    this.busyButton = null;
    this.busyHtml = '';
    this.busyTimer = null;
    this.publicLobbies = [];
    this.lanInfo = null;
    this.lanError = false;
    this.onlineMode = 'classic';
    this.onlineMap = 'playground';
    this.practiceMode = 'classic';
    this.practiceMap = 'playground';
    this.practiceBots = 5;
    this.practiceDifficulty = 'normal';
    this.practiceDuration = 180;
    this.settingsTab = 'audio';
    this.listenBinding = null;
    this.customizeOrigin = 'menu';
    this.chatDraft = '';
    this.modalCallback = null;
    this.inGame = false;
    this.paused = false;
    this.resultsActive = false;
    this.results = null;
    this.resultMeta = null;
    this.newAchievements = [];
    this.recordedResultId = null;
    this.lastHud = null;
    this.sceneApi = null;
    this.scoreboardVisible = false;
    this.lastCountdownValue = null;
    this.lastPhase = null;
    this.flashTimer = null;
    this.goTimer = null;
    this.lastMinimapAt = 0;
    this.sprintSampleAt = null;
    this.joystickPointer = null;
    this.previewRaf = null;
    this.previewDrawnAt = 0;
    this.lobbyRestoredAfterHello = false;
    this.lobbyResumeTimer = null;
    this.serverErrorToastShown = false;
    this.lastLobbyScreen = null;
    this.lastCountdownAnnounced = null;
    this.resultShowTimer = null;

    this.applySettings();
    this.bindDom();
    this.bindNetwork();
    this.network.connect().catch((error) => {
      this.connection = { state: 'error', quality: 'poor', rtt: null, message: error.message };
      this.updateConnectionChrome();
    });
    this.fetchServerInfo();
    this.showScreen('menu');
    this.hideBoot();
  }

  hideBoot() {
    const delay = Math.max(0, 650 - performance.now());
    setTimeout(() => this.bootScreen?.classList.add('is-hidden'), delay);
  }

  applySettings() {
    const settings = store.settings;
    document.body.dataset.reducedMotion = String(settings.reducedMotion);
    document.body.dataset.graphics = settings.graphics;
    document.body.dataset.colorBlind = String(settings.colorBlindMarkers);
    this.audio.setSettings(settings);
  }

  bindDom() {
    this.screenRoot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      if (this.busy) return;
      const action = button.dataset.action;
      this.playUiSound(action, button);
      this.handleAction(action, button, event);
    });
    this.screenRoot.addEventListener('change', (event) => this.handleScreenChange(event));
    this.screenRoot.addEventListener('input', (event) => this.handleScreenInput(event));
    this.screenRoot.addEventListener('submit', (event) => this.handleScreenSubmit(event));

    this.overlayRoot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      this.playUiSound(action, button);
      this.handleAction(action, button, event);
    });

    this.modalRoot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-modal-action]');
      if (!button) return;
      if (button.dataset.modalAction === 'confirm') {
        const callback = this.modalCallback;
        this.closeModal();
        callback?.();
      } else {
        this.closeModal();
      }
    });

    this.hudRoot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      if (button.dataset.action === 'game-pause') this.togglePause();
      if (button.dataset.action === 'game-scoreboard') this.toggleScoreboard(!this.scoreboardVisible);
      if (button.dataset.action === 'game-scoreboard-close') this.toggleScoreboard(false);
    });
    this.hudRoot.addEventListener('pointerdown', (event) => this.handleHudPointerDown(event));
    window.addEventListener('pointermove', (event) => this.handleJoystickMove(event), { passive: false });
    window.addEventListener('pointerup', (event) => this.handleJoystickEnd(event));
    window.addEventListener('pointercancel', (event) => this.handleJoystickEnd(event));
    window.addEventListener('keydown', (event) => this.handleGlobalKey(event));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.inGame && !this.paused && !this.resultsActive) this.togglePause(true);
    });
  }

  bindNetwork() {
    this.network.on('connection', (state) => this.handleNetworkConnection(state));
    this.network.on('latency', ({ rtt, quality }) => {
      this.connection.rtt = rtt;
      this.connection.quality = quality;
      this.updateConnectionChrome();
    });
    this.network.on(SERVER_EVENTS.WELCOME, (payload) => this.handleWelcome(payload));
    this.network.on(SERVER_EVENTS.ERROR, (payload) => this.handleServerError(payload));
    this.network.on(SERVER_EVENTS.LOBBY_LIST, (payload) => this.handleLobbyList(payload));
    this.network.on(SERVER_EVENTS.LOBBY_JOINED, (payload) => this.handleLobbyJoined(payload));
    this.network.on(SERVER_EVENTS.LOBBY_UPDATE, (payload) => this.handleLobbyUpdate(payload));
    this.network.on(SERVER_EVENTS.LOBBY_LEFT, () => this.handleLobbyLeft());
    this.network.on(SERVER_EVENTS.CHAT, (payload) => this.handleChat(payload));
    this.network.on(SERVER_EVENTS.MATCH_STARTING, (payload) => this.handleMatchStarting(payload));
    this.network.on(SERVER_EVENTS.MATCH_END, () => {
      if (this.busy) this.endBusy();
    });
  }

  playUiSound(action, button) {
    if (button.tagName !== 'BUTTON') return;
    if (button.dataset.sound === 'none') return;
    if (/back|menu|leave/.test(action)) this.audio.uiBack();
    else this.audio.uiClick();
  }

  updateConnectionChrome() {
    const model = connectionModel(this.connection);
    this.screenRoot.querySelectorAll('[data-connection-pill]').forEach((pill) => {
      pill.dataset.quality = model.quality;
      const label = pill.querySelector('[data-connection-label]');
      if (label) label.textContent = model.label;
      pill.title = model.title;
    });
    const status = this.screenRoot.querySelector('[data-online-status]');
    if (status) {
      status.textContent = model.label;
      status.dataset.quality = model.quality;
    }
  }

  handleNetworkConnection(state) {
    const wasReady = this.connection.state === 'ready';
    if (state.state === 'ready') {
      this.connection = {
        state: 'ready',
        quality: state.quality || this.network.quality?.() || 'good',
        rtt: state.rtt ?? this.network.rtt,
        message: ''
      };
      this.serverErrorToastShown = false;
      if (wasReady === false && this.currentScreen === 'online') this.network.listLobbies();
    } else if (state.state === 'disconnected') {
      this.connection = { state: 'disconnected', quality: 'poor', rtt: null, message: state.reason || '' };
      this.endBusy();
    } else if (state.state === 'error') {
      this.connection = { state: 'error', quality: 'poor', rtt: null, message: state.message || '' };
      this.endBusy();
      if (!this.serverErrorToastShown) {
        this.serverErrorToastShown = true;
        this.toast({
          title: 'Server offline',
          message: 'Practice against bots still works. Start the server for online play.',
          tone: 'warning',
          duration: 5200
        });
      }
    } else {
      this.connection = { state: 'connecting', quality: 'ok', rtt: null, message: '' };
    }
    this.updateConnectionChrome();
  }

  handleWelcome(payload) {
    this.playerId = payload.playerId || this.playerId;
    if (payload.name && payload.name !== store.profile.name) store.updateProfile({ name: payload.name });
    this.lobbyRestoredAfterHello = false;
    if (this.lobbyResumeTimer) clearTimeout(this.lobbyResumeTimer);
    if (this.currentLobby && !this.inGame) {
      const lobbyAtHello = this.currentLobby.id;
      this.lobbyResumeTimer = setTimeout(() => {
        if (
          this.currentLobby?.id === lobbyAtHello
          && !this.lobbyRestoredAfterHello
          && !this.inGame
          && (this.currentScreen === 'lobby' || (this.currentScreen === 'customize' && this.customizeOrigin === 'lobby'))
        ) {
          this.currentLobby = null;
          this.toast({ title: 'Lobby unavailable', message: 'The room ended while you were away.', tone: 'warning' });
          this.showScreen('menu');
        }
      }, 900);
    }
    this.updateConnectionChrome();
  }

  handleServerError(payload) {
    this.endBusy();
    this.audio.error();
    if (payload?.code === 'KICKED') {
      this.currentLobby = null;
      if (this.inGame) this.stopGame();
      this.toast({ title: 'Removed from lobby', message: payload.message || 'The host removed you.', tone: 'error', duration: 5000 });
      this.showScreen('menu');
      return;
    }
    if (payload?.code === 'VERSION_MISMATCH') {
      this.toast({ title: 'Update required', message: payload.message || 'Refresh the page to update.', tone: 'error', duration: 9000 });
      return;
    }
    if (payload?.code === 'RESUME_EXPIRED') {
      this.toast({ title: 'Session expired', message: payload.message || 'Join a room to create a new session.', tone: 'warning', duration: 5000 });
      return;
    }
    this.toast({
      title: prettyCode(payload?.code),
      message: payload?.message || 'That request could not be completed.',
      tone: 'error',
      duration: 4400
    });
  }

  handleLobbyList(payload) {
    this.publicLobbies = Array.isArray(payload?.lobbies) ? payload.lobbies : [];
    if (this.currentScreen === 'online') this.updateRoomList();
  }

  handleLobbyJoined(payload) {
    this.endBusy();
    const lobby = payload?.lobby;
    if (!lobby) return;
    this.lobbyRestoredAfterHello = true;
    if (this.lobbyResumeTimer) clearTimeout(this.lobbyResumeTimer);
    this.currentLobby = lobby;
    if (this.inGame) return;
    if (this.currentScreen === 'customize' && this.customizeOrigin === 'lobby') return;
    this.audio.uiJoin();
    this.showScreen('lobby');
  }

  handleLobbyUpdate(payload) {
    if (!payload?.lobby) return;
    this.currentLobby = payload.lobby;
    if (this.currentScreen === 'lobby') this.showScreen('lobby', { preserve: true });
  }

  handleLobbyLeft() {
    this.endBusy();
    this.currentLobby = null;
    this.chatDraft = '';
    if (this.inGame) {
      this.stopGame();
    }
    if (this.currentScreen !== 'menu') {
      this.toast({ title: 'Left lobby', message: 'You can join another room whenever you are ready.', tone: 'info' });
      this.showScreen('menu');
    }
  }

  handleChat(payload) {
    const entry = payload?.entry;
    if (!entry || !this.currentLobby) return;
    const chat = this.currentLobby.chat || [];
    if (!chat.some((line) => line.id === entry.id)) {
      this.currentLobby.chat = [...chat, entry].slice(-30);
    }
    if (this.currentScreen === 'lobby') this.showScreen('lobby', { preserve: true, focusChat: false });
  }

  handleMatchStarting(payload) {
    if (!payload?.state) return;
    const matchId = payload.state.matchId;
    if (this.inGame && this.currentMatchId === matchId && !this.resultsActive) return;
    if (this.inGame) this.stopGame({ countAsLeave: false });
    if (payload.lobby) this.currentLobby = payload.lobby;
    this.startOnlineGame(payload.state);
  }

  async ensureOnline() {
    if (this.network.connected && this.network.welcomed) return true;
    try {
      await this.network.connect();
      return true;
    } catch (error) {
      this.toast({ title: 'Could not connect', message: error.message || 'Check the server and try again.', tone: 'error' });
      return false;
    }
  }

  async withOnline(button, label, callback) {
    if (!this.setBusy(button, label)) return;
    const connected = await this.ensureOnline();
    if (!connected) {
      this.endBusy();
      return;
    }
    const emitted = callback();
    if (emitted === false) {
      this.endBusy();
      this.toast({ title: 'Connection lost', message: 'Trying to reconnect. Please retry in a moment.', tone: 'warning' });
    }
  }

  setBusy(button, label = 'Working…') {
    if (this.busy) return false;
    this.busy = true;
    this.busyButton = button || null;
    if (button) {
      this.busyHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escapeHtml(label)}`;
    }
    this.screenRoot.classList.add('is-busy');
    if (this.busyTimer) clearTimeout(this.busyTimer);
    this.busyTimer = setTimeout(() => this.endBusy(), 13000);
    return true;
  }

  endBusy() {
    if (this.busyTimer) clearTimeout(this.busyTimer);
    this.busyTimer = null;
    this.busy = false;
    this.screenRoot.classList.remove('is-busy');
    if (this.busyButton?.isConnected) {
      this.busyButton.disabled = false;
      this.busyButton.innerHTML = this.busyHtml;
    }
    this.busyButton = null;
    this.busyHtml = '';
  }

  toast({ title = '', message = '', tone = 'info', duration = 3600 } = {}) {
    if (!this.toastRoot) return;
    const el = document.createElement('div');
    const kind = tone === 'warning' ? 'info' : tone;
    el.className = `toast ${kind}`;
    el.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${TOAST_ICONS[kind] || 'i'}</span>
      <span>${title ? `<b>${escapeHtml(title)}</b>` : ''}${escapeHtml(message)}</span>
    `;
    this.toastRoot.appendChild(el);
    while (this.toastRoot.children.length > 4) this.toastRoot.firstElementChild?.remove();
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 280);
    }, duration);
  }

  showConfirm({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
    this.modalCallback = onConfirm;
    this.modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button class="modal-close" type="button" data-modal-action="cancel" aria-label="Close">×</button>
          <h2 id="modal-title">${escapeHtml(title)}</h2>
          <p>${escapeHtml(message)}</p>
          <div class="row end">
            <button class="btn ghost" type="button" data-modal-action="cancel">Cancel</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-modal-action="confirm">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>
    `;
    this.modalRoot.querySelector('[data-modal-action="confirm"]')?.focus();
  }

  closeModal() {
    this.modalCallback = null;
    this.modalRoot.innerHTML = '';
  }

  playFlash(message, tone = 'accent', sub = '') {
    const flash = this.hudRoot.querySelector('#hud-flash');
    if (!flash) return;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    flash.innerHTML = `
      <div class="tag-flash ${tone === 'good' ? 'good' : ''}">${escapeHtml(message)}</div>
      ${sub ? `<div class="tag-sub">${escapeHtml(sub)}</div>` : ''}
    `;
    this.flashTimer = setTimeout(() => { if (flash) flash.innerHTML = ''; }, 2100);
  }

  showScreen(name, options = {}) {
    const inGameSettings = this.inGame && name === 'settings';
    if (this.inGame && !inGameSettings) return;
    if (name === 'lobby' && !this.currentLobby) name = 'online';
    if (name === 'customize' && this.customizeOrigin === 'lobby' && !this.currentLobby) {
      this.customizeOrigin = 'menu';
    }
    if (this.previewRaf) {
      cancelAnimationFrame(this.previewRaf);
      this.previewRaf = null;
    }
    this.currentScreen = name;
    if (!options.preserveBinding) this.listenBinding = null;
    if (!inGameSettings) this.audio.startMusic('menu');
    const render = {
      menu: () => this.renderMenu(),
      online: () => this.renderOnline(),
      practice: () => this.renderPractice(),
      lobby: () => this.renderLobby(),
      customize: () => this.renderCustomize(),
      settings: () => this.renderSettings(),
      stats: () => this.renderStats(),
      how: () => this.renderHowToPlay(),
      lan: () => this.renderLan()
    }[name] || (() => this.renderMenu());
    this.screenRoot.innerHTML = render();
    this.hydrateViews();
    if (inGameSettings) {
      this.pausedSettings = true;
      this.screenRoot.classList.add('in-game-settings');
      document.body.classList.add('pause-settings');
      this.overlayRoot.innerHTML = '';
    } else {
      this.pausedSettings = false;
      this.screenRoot.classList.remove('in-game-settings');
      document.body.classList.remove('pause-settings');
    }
    this.screenRoot.classList.remove('is-leaving');
    if (!options.preserve) this.screenRoot.scrollTop = 0;
    if (name === 'lobby') this.focusLobby(options);
    if (name === 'customize') this.startPreviewLoop();
    this.updateConnectionChrome();
  }

  hydrateViews() {
    hydrateAvatars(this.screenRoot);
    hydrateMapPreviews(this.screenRoot, MAPS);
    if (this.currentScreen === 'customize') this.paintCharacterPreview();
  }

  topbar() {
    const model = connectionModel(this.connection);
    return `
      <header class="topbar">
        <button class="brand" type="button" data-action="home" aria-label="TAG home">
          <span class="brand-mark" aria-hidden="true">T</span>
          <span>
            <span class="brand-name">TAG</span>
            <span class="brand-tag">Playground rules, anywhere</span>
          </span>
        </button>
        <div class="top-actions">
          <div class="connection-pill" data-connection-pill data-quality="${model.quality}" title="${escapeHtml(model.title)}" role="status">
            <span class="connection-dot" aria-hidden="true"></span>
            <span data-connection-label>${escapeHtml(model.label)}</span>
          </div>
          <div class="profile-mini">
            <span class="avatar">${renderAvatarHtml(store.profile, 34)}</span>
            <span>${escapeHtml(store.profile.name)}</span>
          </div>
          <button class="icon-btn" type="button" data-action="settings" aria-label="Settings">SET</button>
        </div>
      </header>
    `;
  }

  pageHead({ eyebrow, title, subtitle, back = 'menu', action = '' }) {
    return `
      <div class="page-head">
        <div class="page-title-wrap">
          <button class="back-btn" type="button" data-action="${back}" aria-label="Go back">←</button>
          <div>
            <p class="page-eyebrow">${escapeHtml(eyebrow)}</p>
            <h1 class="page-title">${escapeHtml(title)}</h1>
            ${subtitle ? `<p class="page-sub">${escapeHtml(subtitle)}</p>` : ''}
          </div>
        </div>
        ${action}
      </div>
    `;
  }

  renderMenu() {
    const stats = store.stats;
    const winRate = percent(stats.wins, stats.matches);
    return `
      <section class="screen screen--menu">
        <div class="screen-inner">
          ${this.topbar()}
          <div class="menu-grid">
            <div class="hero-panel">
              <div class="hero-eyebrow">Fast hands. Loud feet. One rule.</div>
              <h1 class="hero-title">TAG<span class="dot">.</span></h1>
              <p class="hero-copy">
                Welcome back, <strong>${escapeHtml(store.profile.name)}</strong>. Pick a mode, read the room,
                and do not be the one left holding IT.
              </p>
              <div class="hero-actions">
                <button class="btn primary" type="button" data-action="online">Play online</button>
                <button class="btn mint" type="button" data-action="practice">Practice with bots</button>
              </div>
              <div class="hero-stats">
                <div class="hero-stat"><b>${stats.matches}</b><span>Matches</span></div>
                <div class="hero-stat"><b>${stats.wins}</b><span>Wins</span></div>
                <div class="hero-stat"><b>${winRate}%</b><span>Win rate</span></div>
                <div class="hero-stat"><b>${stats.tags}</b><span>Tags landed</span></div>
              </div>
            </div>
            <aside class="nav-panel">
              <div class="nav-panel-head">
                <h2>Choose a lane</h2>
                ${badge('Solo or online', 'live')}
              </div>
              <div class="menu-list">
                <button class="menu-item" type="button" data-action="online" data-primary="true">
                  <span class="menu-icon" aria-hidden="true">ON</span>
                  <span><span class="menu-title">Play online</span><span class="menu-sub">Quick match, room codes and LAN rooms.</span></span>
                  <span class="menu-arrow" aria-hidden="true">→</span>
                </button>
                <button class="menu-item" type="button" data-action="practice">
                  <span class="menu-icon" aria-hidden="true">AI</span>
                  <span><span class="menu-title">Practice</span><span class="menu-sub">Six modes against three bot difficulty levels.</span></span>
                  <span class="menu-arrow" aria-hidden="true">→</span>
                </button>
                <div class="menu-section-label">Your playground</div>
                <button class="menu-item" type="button" data-action="customize">
                  <span class="menu-icon" aria-hidden="true">ME</span>
                  <span><span class="menu-title">Customize</span><span class="menu-sub">Character, colors, outfit, accessory and trail.</span></span>
                  <span class="menu-arrow" aria-hidden="true">→</span>
                </button>
                <button class="menu-item" type="button" data-action="stats">
                  <span class="menu-icon" aria-hidden="true">ST</span>
                  <span><span class="menu-title">Stats and awards</span><span class="menu-sub">${stats.achievements.length} of ${ACHIEVEMENTS.length} achievements unlocked.</span></span>
                  <span class="menu-arrow" aria-hidden="true">→</span>
                </button>
                <button class="menu-item" type="button" data-action="how">
                  <span class="menu-icon" aria-hidden="true">?</span>
                  <span><span class="menu-title">How to play</span><span class="menu-sub">Controls, modes and a few shameless tactics.</span></span>
                  <span class="menu-arrow" aria-hidden="true">→</span>
                </button>
                <button class="menu-item" type="button" data-action="lan">
                  <span class="menu-icon" aria-hidden="true">LAN</span>
                  <span><span class="menu-title">LAN party</span><span class="menu-sub">Host a room on your local network.</span></span>
                  <span class="menu-arrow" aria-hidden="true">→</span>
                </button>
                <button class="menu-item" type="button" data-action="settings">
                  <span class="menu-icon" aria-hidden="true">SET</span>
                  <span><span class="menu-title">Settings</span><span class="menu-sub">Audio, graphics, accessibility and controls.</span></span>
                  <span class="menu-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </aside>
          </div>
          <footer class="menu-footer">
            <span>Protocol 1 · Built for browsers, LAN and questionable rematches.</span>
            <span class="row" style="gap:16px">
              <button type="button" data-action="how">Rules</button>
              <button type="button" data-action="settings">Settings</button>
            </span>
          </footer>
          <div class="hero-art" aria-hidden="true">
            <div class="orb"></div><div class="orb"></div><div class="tag-chip">TAG</div>
          </div>
        </div>
      </section>
    `;
  }

  renderOnline() {
    const mode = MODE_MAP[this.onlineMode] || MODE_MAP.classic;
    const map = MAP_MAP[this.onlineMap] || MAP_MAP.playground;
    const model = connectionModel(this.connection);
    const maxOptions = Array.from({ length: mode.maxPlayers - mode.minPlayers + 1 }, (_, index) => mode.minPlayers + index);
    const statusBanner = this.connection.state === 'ready'
      ? `<div class="connection-banner"><span class="connection-dot" data-quality="${model.quality}"></span><span>Connected. Open rooms refresh automatically when the server sends updates.</span><span class="grow"></span><span class="mono tiny">${escapeHtml(model.label)}</span></div>`
      : `<div class="connection-banner ${this.connection.state === 'error' ? 'error' : ''}"><span class="connection-dot" data-quality="${model.quality}"></span><span>${this.connection.state === 'error' ? 'The server is offline. Practice is still available.' : 'Connecting to the game server…'}</span><button class="btn small ghost" type="button" data-action="practice">Practice instead</button></div>`;

    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({ eyebrow: 'Multiplayer', title: 'Play online', subtitle: 'Quick match into a public room, host your own, or bring a five-letter code.' })}
          <div class="page-body stack">
            ${statusBanner}
            <div class="online-layout">
              <div class="stack">
                <section class="panel">
                  <div class="panel-head"><h2>1. Choose a mode</h2>${badge(`${mode.minPlayers}–${mode.maxPlayers} players`, 'public')}</div>
                  <div class="panel-body">
                    <div class="mode-grid">${GAME_MODES.map((entry) => modeCard(entry, entry.id === this.onlineMode, 'online-mode')).join('')}</div>
                  </div>
                </section>
                <section class="panel">
                  <div class="panel-head"><h2>2. Choose a map</h2><span class="tiny">${escapeHtml(map.difficulty)} · ${map.width} × ${map.height}</span></div>
                  <div class="panel-body"><div class="map-select">${MAPS.map((entry) => mapCard(entry, entry.id === this.onlineMap, 'online-map')).join('')}</div></div>
                </section>
                <section class="panel">
                  <div class="panel-head">
                    <h2>Open rooms</h2>
                    <button class="btn small ghost" type="button" data-action="refresh-rooms">Refresh</button>
                  </div>
                  <div class="panel-body">
                    <div class="room-list" id="online-room-list">${this.roomListMarkup()}</div>
                  </div>
                </section>
              </div>
              <div class="stack">
                <section class="panel pad">
                  <div class="row between">
                    <div>
                      <div class="label">Quick match</div>
                      <h2 style="margin:5px 0 4px;font-family:var(--display);font-size:25px;letter-spacing:-.04em">${escapeHtml(mode.name)}</h2>
                      <p class="tiny">Joined into the fullest public ${escapeHtml(mode.short)} room, or we open one for you.</p>
                    </div>
                    <span class="badge ${this.connection.state === 'ready' ? 'live' : ''}">${escapeHtml(model.label)}</span>
                  </div>
                  <div style="height:16px"></div>
                  <button class="btn primary wide" type="button" data-action="quick-match" ${this.busy ? 'disabled' : ''}>Find a room</button>
                </section>
                <section class="panel pad">
                  <form class="form-row" data-form="join-code">
                    <label for="join-code">Join with a room code</label>
                    <input class="input code-input" id="join-code" name="code" maxlength="5" autocomplete="off" placeholder="ABC23" aria-label="Room code">
                    <button class="btn wide" type="submit">Join room</button>
                  </form>
                </section>
                <section class="panel pad">
                  <form class="stack" data-form="create-room" style="gap:12px">
                    <div>
                      <div class="label">Host a room</div>
                      <p class="tiny" style="margin:6px 0 0">${escapeHtml(mode.name)} on ${escapeHtml(map.name)}.</p>
                    </div>
                    <div class="form-grid">
                      <div class="form-row">
                        <label for="room-visibility">Visibility</label>
                        <select class="select" id="room-visibility" name="visibility">
                          <option value="public">Public</option>
                          <option value="private">Private</option>
                          <option value="lan">LAN</option>
                        </select>
                      </div>
                      <div class="form-row">
                        <label for="room-max">Max players</label>
                        <select class="select" id="room-max" name="maxPlayers">
                          ${maxOptions.map((count) => `<option value="${count}" ${count === Math.min(8, mode.maxPlayers) ? 'selected' : ''}>${count} players</option>`).join('')}
                        </select>
                      </div>
                    </div>
                    <button class="btn mint wide" type="submit">Create room</button>
                  </form>
                </section>
                <div class="lan-banner">
                  <div><b>Same Wi-Fi?</b> Open this page on another device using the host machine's LAN address. Room codes work exactly the same.</div>
                  <button class="btn small ghost" type="button" data-action="lan">LAN setup</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  roomListMarkup() {
    if (!this.publicLobbies.length) {
      return `<div class="empty-state"><b>No public rooms yet</b><span>Start a quick match or host the first room.</span></div>`;
    }
    return this.publicLobbies.map((room) => {
      const mode = modeInfo(room.modeId);
      const map = mapInfo(room.mapId);
      return `
        <button class="room-card" type="button" data-action="join-room-code" data-code="${escapeHtml(room.code)}">
          <span>
            <b>${escapeHtml(room.name)}</b>
            <span>${escapeHtml(mode.name)} · ${escapeHtml(map.name)} · ${escapeHtml(room.hostName)}</span>
          </span>
          <span class="room-meta"><span class="room-count">${room.players}/${room.maxPlayers}</span><br>${escapeHtml(room.code)}</span>
        </button>
      `;
    }).join('');
  }

  updateRoomList() {
    const list = this.screenRoot.querySelector('#online-room-list');
    if (list) list.innerHTML = this.roomListMarkup();
  }

  renderPractice() {
    const mode = MODE_MAP[this.practiceMode] || MODE_MAP.classic;
    const map = MAP_MAP[this.practiceMap] || MAP_MAP.playground;
    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({ eyebrow: 'Offline', title: 'Practice', subtitle: 'Same maps, same rules, no lobby wait. Tune the bots and go.' })}
          <div class="page-body">
            <div class="online-layout">
              <div class="stack">
                <section class="panel">
                  <div class="panel-head"><h2>Mode</h2>${badge(`${mode.minPlayers}+ players`, 'lan')}</div>
                  <div class="panel-body"><div class="mode-grid">${GAME_MODES.map((entry) => modeCard(entry, entry.id === this.practiceMode, 'practice-mode')).join('')}</div></div>
                </section>
                <section class="panel">
                  <div class="panel-head"><h2>Map</h2><span class="tiny">${escapeHtml(map.description)}</span></div>
                  <div class="panel-body"><div class="map-select">${MAPS.map((entry) => mapCard(entry, entry.id === this.practiceMap, 'practice-map')).join('')}</div></div>
                </section>
              </div>
              <div class="stack">
                <section class="panel pad">
                  <div class="panel-head" style="padding:0 0 15px;border:0"><h2>Session setup</h2>${badge('Local', 'live')}</div>
                  <div class="setting-row">
                    <div class="setting-copy"><b>Bots</b><span>One human, ${this.practiceBots} bot${this.practiceBots === 1 ? '' : 's'}. Team modes balance automatically.</span></div>
                    <div class="setting-control range-wrap">
                      <input id="practice-bots" type="range" min="1" max="11" step="1" value="${this.practiceBots}" data-practice-bots aria-label="Bot count">
                      <output id="practice-bots-value">${this.practiceBots}</output>
                    </div>
                  </div>
                  <div class="setting-row">
                    <div class="setting-copy"><b>Difficulty</b><span>Reaction speed, sprinting and tag confidence.</span></div>
                    <div class="option-chips">
                      ${['easy', 'normal', 'hard'].map((level) => `<button class="option-chip ${this.practiceDifficulty === level ? 'is-selected' : ''}" type="button" data-action="practice-difficulty" data-difficulty="${level}">${level[0].toUpperCase() + level.slice(1)}</button>`).join('')}
                    </div>
                  </div>
                  <div class="setting-row">
                    <div class="setting-copy"><b>Round length</b><span>Countdown adds three seconds before play.</span></div>
                    <select class="select" style="width:130px" id="practice-duration" data-practice-duration>
                      ${[90, 120, 180, 300].map((seconds) => `<option value="${seconds}" ${seconds === this.practiceDuration ? 'selected' : ''}>${formatDuration(seconds)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="divider"></div>
                  <div class="row between">
                    <span class="tiny">${escapeHtml(mode.name)} · ${escapeHtml(map.name)}</span>
                    <button class="btn primary" type="button" data-action="practice-start">Start practice</button>
                  </div>
                </section>
                <section class="panel pad">
                  <div class="label">Quick summary</div>
                  <p class="tiny" style="margin:9px 0 0">${escapeHtml(mode.description)}</p>
                  <div class="divider"></div>
                  <div class="row" style="gap:7px;flex-wrap:wrap">
                    ${badge(`${this.practiceBots} bots`, 'lan')}
                    ${badge(this.practiceDifficulty, 'private')}
                    ${badge(formatDuration(this.practiceDuration))}
                  </div>
                </section>
                <div class="lan-banner">
                  <div><b>Practice counts.</b> Stats, achievements and best tags are saved exactly like online matches.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  renderLobby() {
    const lobby = this.currentLobby;
    if (!lobby) return this.renderOnline();
    const mode = modeInfo(lobby.modeId);
    const map = mapInfo(lobby.mapId);
    const players = lobby.players || [];
    const you = players.find((player) => player.id === this.playerId);
    const isHost = lobby.hostId === this.playerId;
    const readyCount = players.filter((player) => player.ready).length;
    const required = Math.max(mode.minPlayers, lobby.options?.minPlayers || 2);
    const allReady = players.length >= required && players.every((player) => player.ready);
    const canStart = isHost && allReady;
    const maxOptions = Array.from({ length: mode.maxPlayers - mode.minPlayers + 1 }, (_, index) => mode.minPlayers + index);
    const durations = [...new Set([90, 120, 180, 240, 300, 420, 600, Number(lobby.options?.duration) || 180])].sort((a, b) => a - b);
    const chat = lobby.chat || [];
    const stateLabel = lobby.state === 'in-progress' ? 'In progress' : 'Waiting';
    const roomStatus = isHost
      ? (allReady ? 'Everyone is ready. Start when you are.' : 'Ready up, then start the match.')
      : (allReady ? 'Waiting for the host to start.' : 'Set yourself ready and wait for the host.');

    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({
            eyebrow: `Room ${lobby.code}`,
            title: lobby.name,
            subtitle: `${mode.name} · ${map.name} · ${players.length}/${lobby.options?.maxPlayers || mode.maxPlayers} players`,
            back: 'leave-lobby',
            action: `<div class="row">${badge(stateLabel, lobby.state === 'waiting' ? 'live' : 'lan')}${badge(lobby.visibility, lobby.visibility === 'public' ? 'public' : lobby.visibility === 'lan' ? 'lan' : 'private')}</div>`
          })}
          <div class="page-body">
            <div class="lobby-layout">
              <div class="lobby-main">
                <section class="panel pad">
                  <div class="row between" style="margin-bottom:14px">
                    <div class="room-code-box">
                      <span class="label">Room code</span>
                      <span class="room-code">${escapeHtml(lobby.code)}</span>
                      <button class="btn small ghost" type="button" data-action="copy-code" data-code="${escapeHtml(lobby.code)}">Copy</button>
                    </div>
                    <span class="tiny">${readyCount}/${players.length} ready · need ${required}</span>
                  </div>
                  <div class="players-header"><h2 style="font-size:12px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin:0">Players</h2><span class="tiny">${roomStatus}</span></div>
                  <div class="player-grid">
                    ${players.map((player) => this.playerCardMarkup(player, lobby, isHost)).join('')}
                  </div>
                </section>
                <section class="panel chat-panel">
                  <div class="panel-head"><h2>Room chat</h2><span class="tiny">Enter to send</span></div>
                  <div class="chat-log" id="chat-log">
                    ${chat.length ? chat.map((entry) => this.chatLineMarkup(entry)).join('') : '<div class="chat-empty">No messages yet. Say hello.</div>'}
                  </div>
                  <form class="chat-form" data-form="chat">
                    <input class="input" id="chat-input" name="message" maxlength="140" autocomplete="off" value="${escapeHtml(this.chatDraft)}" placeholder="Message the room…" aria-label="Chat message">
                    <button class="btn small primary" type="submit">Send</button>
                  </form>
                </section>
              </div>
              <aside class="lobby-side">
                <section class="panel pad">
                  <div class="panel-head" style="padding:0 0 14px;border:0"><h2>Room setup</h2>${badge(map.subtitle)}</div>
                  <canvas class="map-thumb" data-preview-map="${map.id}" width="240" height="150" aria-label="${escapeHtml(map.name)} map preview"></canvas>
                  <div class="form-grid" style="margin-top:14px">
                    <div class="form-row">
                      <label for="lobby-mode">Mode</label>
                      <select class="select" id="lobby-mode" data-lobby-setting="modeId" ${isHost ? '' : 'disabled'}>
                        ${GAME_MODES.map((entry) => `<option value="${entry.id}" ${entry.id === lobby.modeId ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-row">
                      <label for="lobby-map">Map</label>
                      <select class="select" id="lobby-map" data-lobby-setting="mapId" ${isHost ? '' : 'disabled'}>
                        ${MAPS.map((entry) => `<option value="${entry.id}" ${entry.id === lobby.mapId ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-row">
                      <label for="lobby-duration">Duration</label>
                      <select class="select" id="lobby-duration" data-lobby-option="duration" ${isHost ? '' : 'disabled'}>
                        ${durations.map((seconds) => `<option value="${seconds}" ${Number(lobby.options?.duration) === seconds ? 'selected' : ''}>${formatDuration(seconds)}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-row">
                      <label for="lobby-max">Max players</label>
                      <select class="select" id="lobby-max" data-lobby-option="maxPlayers" ${isHost ? '' : 'disabled'}>
                        ${maxOptions.map((count) => `<option value="${count}" ${Number(lobby.options?.maxPlayers) === count ? 'selected' : ''}>${count} players</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="setting-row" style="margin-top:4px">
                    <div class="setting-copy"><b>Sprint</b><span>Allow the stamina sprint burst.</span></div>
                    <button class="toggle ${lobby.options?.sprintEnabled !== false ? 'is-on' : ''}" type="button" role="switch" aria-checked="${lobby.options?.sprintEnabled !== false}" data-action="lobby-sprint" ${isHost ? '' : 'disabled'} aria-label="Toggle sprint"></button>
                  </div>
                  ${isHost ? '<p class="tiny" style="margin:12px 0 0">Changing match settings resets everyone to not-ready.</p>' : '<p class="tiny" style="margin:12px 0 0">Only the host can change match settings.</p>'}
                </section>
                <section class="panel pad">
                  <div class="lobby-actions">
                    <button class="btn ${you?.ready ? 'mint' : 'ghost'}" type="button" data-action="toggle-ready">${you?.ready ? 'Ready — cancel' : 'I am ready'}</button>
                    <button class="btn ghost" type="button" data-action="customize">Customize</button>
                    ${isHost ? `<button class="btn primary" type="button" data-action="start-match" ${canStart ? '' : 'disabled'}>Start match</button>` : `<button class="btn" type="button" disabled>Waiting for host</button>`}
                    <button class="btn danger" type="button" data-action="leave-lobby">Leave</button>
                  </div>
                  <p class="tiny" style="margin:14px 0 0">${escapeHtml(roomStatus)}</p>
                </section>
                <div class="lan-banner">
                  <div><b>Invite the room.</b> Send a friend the code <span class="lan-url">${escapeHtml(lobby.code)}</span> so they can join from the Play online screen.</div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  playerCardMarkup(player, lobby, isHost) {
    const you = player.id === this.playerId;
    const canKick = isHost && !you && lobby.state === 'waiting';
    const profile = profileFromPlayer(player);
    return `
      <div class="player-card ${you ? 'is-you' : ''} ${player.isHost ? 'is-host' : ''} ${player.connected === false ? 'is-disconnected' : ''}">
        <span class="player-avatar">${renderAvatarHtml(profile, 50)}</span>
        <span class="player-info">
          <b>${escapeHtml(player.name)}${you ? ' (you)' : ''}</b>
          <span><i class="ready-dot ${player.ready ? 'ready' : ''}"></i>${player.ready ? 'Ready' : 'Not ready'}</span>
          <span>${player.connected === false ? 'Reconnecting…' : player.isHost ? 'Host' : 'Runner'}</span>
        </span>
        ${canKick ? `<button class="player-kick" type="button" data-action="kick-player" data-player-id="${escapeHtml(player.id)}" aria-label="Remove ${escapeHtml(player.name)}">×</button>` : ''}
      </div>
    `;
  }

  chatLineMarkup(entry) {
    const time = new Date(entry.at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (entry.system) {
      return `<div class="chat-line system">${escapeHtml(entry.message)}<span class="chat-time">${escapeHtml(time)}</span></div>`;
    }
    return `<div class="chat-line"><b>${escapeHtml(entry.name || 'Player')}</b> ${escapeHtml(entry.message)}<span class="chat-time">${escapeHtml(time)}</span></div>`;
  }

  focusLobby(options) {
    const log = this.screenRoot.querySelector('#chat-log');
    if (log) log.scrollTop = log.scrollHeight;
    if (options.focusChat) {
      const input = this.screenRoot.querySelector('#chat-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  renderCustomize() {
    const profile = store.profile;
    const character = CHARACTERS.find((entry) => entry.id === profile.characterId) || CHARACTERS[0];
    const palette = PALETTES.find((entry) => entry.id === profile.paletteId) || PALETTES[0];
    const back = this.customizeOrigin === 'lobby' ? 'lobby' : 'menu';
    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({ eyebrow: 'Your runner', title: 'Customize', subtitle: 'Your look is stored on this device and carried into every lobby.', back })}
          <div class="page-body">
            <div class="character-layout">
              <section class="panel pad preview-panel">
                <div class="character-preview">
                  <span class="preview-floor"></span>
                  <canvas id="character-preview" width="320" height="320" aria-label="Character preview"></canvas>
                </div>
                <div class="preview-name"><b id="preview-name">${escapeHtml(profile.name)}</b><span>${escapeHtml(character.name)} · ${escapeHtml(palette.name)}</span></div>
                <div class="divider"></div>
                <p class="tiny" style="margin:0 0 14px">Saved automatically. Changes sync to your lobby character when you are in a room.</p>
                <div class="row">
                  <button class="btn primary" type="button" data-action="${back}">${back === 'lobby' ? 'Back to lobby' : 'Back to menu'}</button>
                  <button class="btn ghost" type="button" data-action="customize-random">Surprise me</button>
                </div>
              </section>
              <div class="stack">
                <section class="panel pad">
                  <div class="panel-head" style="padding:0 0 14px;border:0"><h2>Runner name</h2><span class="tiny">18 characters max</span></div>
                  <input class="input" id="profile-name" maxlength="18" autocomplete="off" value="${escapeHtml(profile.name)}" aria-label="Runner name">
                </section>
                <section class="panel pad">
                  <div class="panel-head" style="padding:0 0 14px;border:0"><h2>Character</h2><span class="tiny">${escapeHtml(character.tagline)}</span></div>
                  <div class="character-grid">
                    ${CHARACTERS.map((entry) => `
                      <button class="character-card ${entry.id === profile.characterId ? 'is-selected' : ''}" type="button" data-action="pick-character" data-value="${entry.id}" aria-pressed="${entry.id === profile.characterId}">
                        ${renderAvatarHtml({ ...profile, characterId: entry.id }, 96)}
                        <b>${escapeHtml(entry.name)}</b>
                        <span>${escapeHtml(entry.tagline)}</span>
                      </button>
                    `).join('')}
                  </div>
                </section>
                <section class="panel pad">
                  <div class="panel-head" style="padding:0 0 14px;border:0"><h2>Color palette</h2><span class="tiny">${escapeHtml(palette.name)}</span></div>
                  <div class="swatch-row">
                    ${PALETTES.map((entry) => `
                      <button class="color-swatch ${entry.id === profile.paletteId ? 'is-selected' : ''}" type="button" data-action="pick-palette" data-value="${entry.id}" style="background:linear-gradient(135deg, ${entry.primary}, ${entry.secondary})" title="${escapeHtml(entry.name)}" aria-label="${escapeHtml(entry.name)} palette"></button>
                    `).join('')}
                  </div>
                  <div class="divider"></div>
                  <div class="form-grid">
                    <div>
                      <div class="label" style="margin-bottom:9px">Outfit</div>
                      <div class="option-chips">
                        ${OUTFITS.map((entry) => `<button class="option-chip ${entry.id === profile.outfitId ? 'is-selected' : ''}" type="button" data-action="pick-outfit" data-value="${entry.id}">${escapeHtml(entry.name)}</button>`).join('')}
                      </div>
                    </div>
                    <div>
                      <div class="label" style="margin-bottom:9px">Accessory</div>
                      <div class="option-chips">
                        ${ACCESSORIES.map((entry) => `<button class="option-chip ${entry.id === profile.accessoryId ? 'is-selected' : ''}" type="button" data-action="pick-accessory" data-value="${entry.id}">${escapeHtml(entry.name)}</button>`).join('')}
                      </div>
                    </div>
                    <div class="form-row full">
                      <div class="label" style="margin-bottom:2px">Movement trail</div>
                      <div class="option-chips">
                        ${TRAILS.map((entry) => `<button class="option-chip ${entry.id === profile.trailId ? 'is-selected' : ''}" type="button" data-action="pick-trail" data-value="${entry.id}">${escapeHtml(entry.name)}</button>`).join('')}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  startPreviewLoop() {
    const canvas = this.screenRoot.querySelector('#character-preview');
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = 320;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    const loop = (now) => {
      if (this.currentScreen !== 'customize' || !canvas.isConnected) return;
      if (now - this.previewDrawnAt > 32) {
        this.previewDrawnAt = now;
        drawCharacter(ctx, {
          size: size * dpr,
          profile: store.profile,
          state: 'idle',
          time: now / 1000,
          frame: 0,
          colorBlind: store.settings.colorBlindMarkers
        });
      }
      this.previewRaf = requestAnimationFrame(loop);
    };
    this.previewRaf = requestAnimationFrame(loop);
  }

  paintCharacterPreview() {
    const canvas = this.screenRoot.querySelector('#character-preview');
    if (!canvas) return;
    this.previewDrawnAt = 0;
  }

  renderSettings() {
    const settings = store.settings;
    const tabs = [
      ['audio', 'Audio'],
      ['gameplay', 'Gameplay'],
      ['controls', 'Controls'],
      ['accessibility', 'Accessibility']
    ];
    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({ eyebrow: 'Preferences', title: 'Settings', subtitle: 'Everything here is saved on this device.' })}
          <div class="page-body">
            <div class="settings-tabs">
              ${tabs.map(([id, label]) => `<button class="tab ${this.settingsTab === id ? 'is-active' : ''}" type="button" data-action="settings-tab" data-tab="${id}">${label}</button>`).join('')}
            </div>
            <div style="height:16px"></div>
            <div class="settings-layout">
              <section class="panel pad">
                ${this.settingsPanelMarkup(settings)}
              </section>
              <aside class="stack">
                <section class="panel pad">
                  <div class="row">
                    <span class="avatar large">${renderAvatarHtml(store.profile, 90)}</span>
                    <div><b>${escapeHtml(store.profile.name)}</b><div class="tiny">Your local guest profile</div></div>
                  </div>
                  <div class="divider"></div>
                  <button class="btn wide ghost" type="button" data-action="customize">Edit character</button>
                </section>
                <section class="panel pad">
                  <div class="label">Need a clean slate?</div>
                  <p class="tiny" style="margin:9px 0 14px">Restore the default audio, graphics, accessibility and control bindings.</p>
                  <button class="btn wide danger" type="button" data-action="reset-settings">Reset settings</button>
                </section>
              </aside>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  settingsPanelMarkup(settings) {
    if (this.settingsTab === 'audio') {
      return `
        <div class="panel-head" style="padding:0 0 10px;border:0"><h2>Audio</h2>${badge(settings.muted ? 'Muted' : 'On')}</div>
        ${this.rangeSetting('Master volume', 'Overall game volume.', 'masterVolume', settings.masterVolume)}
        ${this.rangeSetting('Music volume', 'Menu and match music.', 'musicVolume', settings.musicVolume)}
        ${this.rangeSetting('Effects volume', 'Tags, footsteps, UI sounds.', 'sfxVolume', settings.sfxVolume)}
        ${this.toggleSetting('Mute everything', 'Silence all audio without losing your levels.', 'muted', settings.muted)}
      `;
    }
    if (this.settingsTab === 'gameplay') {
      return `
        <div class="panel-head" style="padding:0 0 10px;border:0"><h2>Gameplay</h2></div>
        <div class="setting-row">
          <div class="setting-copy"><b>Graphics quality</b><span>Controls particles, shadows, glow and camera zoom.</span></div>
          <select class="select" style="width:150px" data-setting-select="graphics">
            ${['low', 'medium', 'high'].map((level) => `<option value="${level}" ${settings.graphics === level ? 'selected' : ''}>${level[0].toUpperCase() + level.slice(1)}</option>`).join('')}
          </select>
        </div>
        ${this.toggleSetting('Particles', 'Trails, bursts and other decorative effects.', 'particles', settings.particles)}
        ${this.toggleSetting('Screen shake', 'A small kick on tags and victories.', 'screenShake', settings.screenShake)}
        <div class="connection-banner" style="margin-top:18px">Graphics quality also affects camera zoom and particle count in Phaser.</div>
      `;
    }
    if (this.settingsTab === 'controls') {
      return `
        <div class="panel-head" style="padding:0 0 10px;border:0"><h2>Controls</h2><span class="tiny">Click a key to rebind it</span></div>
        ${Object.entries(CONTROL_LABELS).map(([action, label]) => `
          <div class="setting-row">
            <div class="setting-copy"><b>${escapeHtml(label)}</b><span>${action === 'tag' ? 'Space also works as expected.' : action === 'scoreboard' ? 'Hold to view the live scoreboard.' : 'Bind up to four keys.'}</span></div>
            <div class="key-binding">
              ${(settings.bindings[action] || []).map((code, index) => `<button class="key-btn ${this.listenBinding?.action === action && this.listenBinding?.index === index ? 'is-listening' : ''}" type="button" data-action="remap-key" data-binding-action="${action}" data-binding-index="${index}">${this.listenBinding?.action === action && this.listenBinding?.index === index ? 'Press…' : escapeHtml(keyLabel(code))}</button>`).join('')}
            </div>
          </div>
        `).join('')}
        <p class="tiny" style="margin:16px 0 0">Escape always opens the pause menu. Tab is captured while in a match.</p>
      `;
    }
    return `
      <div class="panel-head" style="padding:0 0 10px;border:0"><h2>Accessibility</h2></div>
      ${this.toggleSetting('Reduce motion', 'Reduces camera shake, particles, trails and CSS animation.', 'reducedMotion', settings.reducedMotion)}
      ${this.toggleSetting('Color-blind role markers', 'Adds a text marker above IT and high-contrast status cues.', 'colorBlindMarkers', settings.colorBlindMarkers)}
      ${this.toggleSetting('Particles', 'Decorative effects can be disabled independently.', 'particles', settings.particles)}
      <div class="connection-banner" style="margin-top:18px">Movement does not rely on color alone: role labels, prompts and the scoreboard use text too.</div>
    `;
  }

  rangeSetting(title, copy, key, value) {
    return `
      <div class="setting-row">
        <div class="setting-copy"><b>${escapeHtml(title)}</b><span>${escapeHtml(copy)}</span></div>
        <div class="setting-control range-wrap">
          <input type="range" min="0" max="1" step="0.05" value="${Number(value)}" data-setting-range="${key}" aria-label="${escapeHtml(title)}">
          <output data-setting-output="${key}">${Math.round(Number(value) * 100)}%</output>
        </div>
      </div>
    `;
  }

  toggleSetting(title, copy, key, value) {
    return `
      <div class="setting-row">
        <div class="setting-copy"><b>${escapeHtml(title)}</b><span>${escapeHtml(copy)}</span></div>
        <button class="toggle ${value ? 'is-on' : ''}" type="button" role="switch" aria-checked="${Boolean(value)}" data-action="toggle-setting" data-setting="${key}" aria-label="${escapeHtml(title)}"></button>
      </div>
    `;
  }

  renderStats() {
    const stats = store.stats;
    const winRate = percent(stats.wins, stats.matches);
    const modes = Object.entries(stats.modes || {}).filter(([, record]) => record?.played);
    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({ eyebrow: 'Career', title: 'Stats and awards', subtitle: 'A record of every sprint, tag and narrow escape on this device.' })}
          <div class="page-body stack">
            <div class="stat-grid">
              <div class="stat-card"><b>${stats.matches}</b><span>Matches</span></div>
              <div class="stat-card"><b>${stats.wins}</b><span>Wins</span></div>
              <div class="stat-card"><b>${winRate}%</b><span>Win rate</span></div>
              <div class="stat-card"><b>${stats.tags}</b><span>Tags landed</span></div>
              <div class="stat-card"><b>${stats.timesTagged}</b><span>Times tagged</span></div>
              <div class="stat-card"><b>${formatSeconds(stats.itTime)}</b><span>Time as IT</span></div>
              <div class="stat-card"><b>${stats.revives}</b><span>Thaws</span></div>
              <div class="stat-card"><b>${formatSeconds(stats.sprintTime)}</b><span>Sprint time</span></div>
            </div>
            <div class="grid-2">
              <section class="panel">
                <div class="panel-head"><h2>Achievements</h2><span class="tiny">${stats.achievements.length}/${ACHIEVEMENTS.length}</span></div>
                <div class="panel-body">
                  <div class="achievement-grid">
                    ${ACHIEVEMENTS.map((entry) => {
                      const isUnlocked = stats.achievements.includes(entry.id);
                      return `
                        <div class="achievement ${isUnlocked ? 'is-unlocked' : ''}">
                          <span class="achievement-icon">${isUnlocked ? entry.icon : '—'}</span>
                          <span><b>${escapeHtml(entry.name)}</b><span>${escapeHtml(isUnlocked ? entry.description : 'Locked')}</span></span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              </section>
              <div class="stack">
                <section class="panel">
                  <div class="panel-head"><h2>Recent matches</h2><button class="btn small ghost" type="button" data-action="how">How to play</button></div>
                  <div class="panel-body">
                    ${stats.history.length ? `<div class="history-list">${stats.history.map((entry) => `
                      <div class="history-row">
                        <b>${escapeHtml(entry.title || modeInfo(entry.modeId).name)}</b>
                        <span>${escapeHtml(modeInfo(entry.modeId).short)} · ${escapeHtml(mapInfo(entry.mapId).name)} · ${relativeTime(entry.at)}</span>
                        <span class="${entry.won ? 'history-win' : 'history-loss'}">${entry.draw ? 'DRAW' : entry.won ? 'WIN' : 'LOSS'}</span>
                      </div>
                    `).join('')}</div>` : '<div class="empty-state"><b>No matches yet</b><span>A quick practice round is a good first entry.</span></div>'}
                  </div>
                </section>
                <section class="panel">
                  <div class="panel-head"><h2>By mode</h2></div>
                  <div class="panel-body">
                    ${modes.length ? `<div class="history-list">${modes.map(([modeId, record]) => `
                      <div class="history-row"><b>${escapeHtml(modeInfo(modeId).name)}</b><span>${record.played} played</span><span class="history-win">${percent(record.wins, record.played)}% wins</span></div>
                    `).join('')}</div>` : '<p class="tiny" style="margin:0">Play a match in any mode to see a breakdown.</p>'}
                  </div>
                </section>
              </div>
            </div>
            <div class="row"><span class="grow"></span><button class="btn danger" type="button" data-action="reset-stats">Reset all stats</button></div>
          </div>
        </div>
      </section>
    `;
  }

  renderHowToPlay() {
    const bind = (action) => (store.settings.bindings[action] || []).map(keyLabel).join(' / ');
    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({ eyebrow: 'The rules', title: 'How to play', subtitle: 'Run, read the room, and pass IT before the clock runs out.' })}
          <div class="page-body stack">
            <div class="info-grid">
              <div class="info-card">
                <h3>Move</h3>
                <p>Use ${escapeHtml(bind('up'))}, ${escapeHtml(bind('left'))}, ${escapeHtml(bind('down'))} and ${escapeHtml(bind('right'))} — or the on-screen joystick on touch screens.</p>
                <div class="key-row"><span>Movement</span><span class="kbd">${escapeHtml(bind('up'))} ${escapeHtml(bind('left'))} ${escapeHtml(bind('down'))} ${escapeHtml(bind('right'))}</span></div>
                <div class="key-row"><span>Sprint</span><span class="kbd">${escapeHtml(bind('sprint'))}</span></div>
              </div>
              <div class="info-card">
                <h3>Tag and interact</h3>
                <p>Press ${escapeHtml(bind('tag'))} when the prompt appears. In Freeze Tag, use ${escapeHtml(bind('interact'))} near a frozen runner to thaw them.</p>
                <div class="key-row"><span>Tag</span><span class="kbd">${escapeHtml(bind('tag'))}</span></div>
                <div class="key-row"><span>Thaw</span><span class="kbd">${escapeHtml(bind('interact'))}</span></div>
                <div class="key-row"><span>Scoreboard</span><span class="kbd">${escapeHtml(bind('scoreboard'))}</span></div>
              </div>
              <div class="info-card">
                <h3>Stay slippery</h3>
                <p>Sprinting drains stamina. Break line of sight, use the corners and do not let a crowd box you in.</p>
                <p style="margin-top:10px">Online matches are server-authoritative. Practice uses the same rules engine and bot AI is fully local.</p>
              </div>
            </div>
            <section class="panel">
              <div class="panel-head"><h2>Modes</h2><span class="tiny">Six ways to make enemies</span></div>
              <div class="panel-body">
                <div class="info-grid">
                  ${GAME_MODES.map((mode) => `<div class="info-card"><h3>${escapeHtml(mode.name)}</h3><p>${escapeHtml(mode.description)}</p><div class="row" style="margin-top:12px">${badge(`${mode.minPlayers}–${mode.maxPlayers} players`, 'public')}${mode.teamBased ? badge('Teams', 'lan') : ''}</div></div>`).join('')}
                </div>
              </div>
            </section>
            <div class="grid-2">
              <div class="info-card">
                <h3>Good habits</h3>
                <div class="steps">
                  <div class="step">Keep moving when you are IT. Standing still lets runners read your angle.</div>
                  <div class="step">Sprint in short bursts. A full stamina bar is worth more than one panic dash.</div>
                  <div class="step">In Freeze Tag, thaw early and often. A frozen teammate is a future target.</div>
                </div>
              </div>
              <div class="info-card">
                <h3>Play together</h3>
                <p>Host a room, share the five-letter code, and everyone on the same server can join. Use LAN mode for a local party with no internet required.</p>
                <div class="divider"></div>
                <div class="row"><button class="btn primary" type="button" data-action="online">Play online</button><button class="btn ghost" type="button" data-action="practice">Practice</button><button class="btn ghost" type="button" data-action="lan">LAN setup</button></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  renderLan() {
    const info = this.lanInfo;
    const urls = info?.lanUrls || [];
    return `
      <section class="screen">
        <div class="screen-inner">
          ${this.topbar()}
          ${this.pageHead({
            eyebrow: 'Local multiplayer',
            title: 'LAN party',
            subtitle: 'Run the server on one machine and open the game from every device on the same network.',
            action: `<button class="btn small ghost" type="button" data-action="refresh-lan">Refresh</button>`
          })}
          <div class="page-body stack">
            ${this.lanError ? '<div class="connection-banner error">Could not read server information. Start the game server and try Refresh.</div>' : ''}
            <div class="info-grid">
              <div class="info-card"><h3>Server status</h3><p>${this.connection.state === 'ready' ? 'Reachable from this device.' : 'Not connected from this device yet.'}</p><div class="divider"></div><span class="${this.connection.state === 'ready' ? 'history-win' : 'history-loss'}">${escapeHtml(connectionModel(this.connection).label)}</span></div>
              <div class="info-card"><h3>Local address</h3><p class="mono" style="color:var(--mint);word-break:break-all">${escapeHtml(info?.localUrl || 'http://localhost:3000')}</p><div class="divider"></div><p>Open this on the host machine.</p></div>
              <div class="info-card"><h3>Protocol</h3><p>${info ? `TAG protocol ${info.protocol} · max ${info.maxPlayers} players` : 'Waiting for /api/server-info.'}</p><div class="divider"></div><p>${info?.lanOnly ? 'LAN-only mode is enabled.' : 'Online play is enabled.'}</p></div>
            </div>
            <section class="panel pad">
              <div class="panel-head" style="padding:0 0 14px;border:0"><h2>LAN addresses</h2><span class="tiny">Use the address that matches your Wi-Fi or Ethernet network</span></div>
              ${urls.length ? `<div class="lan-list">${urls.map((entry) => `
                <div class="lan-card"><span><b>${escapeHtml(entry.name)}</b> · <code>${escapeHtml(entry.url)}</code></span><button class="btn small ghost" type="button" data-action="copy-text" data-copy="${escapeHtml(entry.url)}">Copy</button></div>
              `).join('')}</div>` : `<div class="empty-state"><b>No LAN addresses found</b><span>Connect this machine to Wi-Fi or Ethernet, then refresh.</span></div>`}
              ${info?.publicUrl ? `<div class="divider"></div><div class="lan-card"><span><b>Public URL</b> · <code>${escapeHtml(info.publicUrl)}</code></span><button class="btn small ghost" type="button" data-action="copy-text" data-copy="${escapeHtml(info.publicUrl)}">Copy</button></div>` : ''}
            </section>
            <div class="grid-2">
              <section class="panel pad">
                <h3 style="margin:0 0 12px;font-size:14px">Host checklist</h3>
                <div class="steps">
                  <div class="step">Start the server on the host machine with <span class="kbd">npm start</span> (or <span class="kbd">npm run dev</span> while developing).</div>
                  <div class="step">Allow Node through the operating system firewall for your local network.</div>
                  <div class="step">Give every device one of the LAN addresses above. Do not use localhost from another device.</div>
                  <div class="step">Create a room, then share the five-letter code. Public rooms also appear in Play online.</div>
                </div>
              </section>
              <section class="panel pad">
                <h3 style="margin:0 0 12px;font-size:14px">Recommended setup</h3>
                <p class="tiny">For a local-only event, set <span class="kbd">LAN_ONLY=true</span> on the server so public lobbies are local by default. Use a wired host when possible; Wi-Fi is fine for casual matches.</p>
                <div class="divider"></div>
                <div class="lan-banner"><div><b>Same network?</b> If a phone cannot connect, check that the host firewall allows port 3000.</div></div>
              </section>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async fetchServerInfo() {
    try {
      const response = await fetch('/api/server-info', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Server info unavailable');
      this.lanInfo = await response.json();
      this.lanError = false;
    } catch {
      this.lanError = true;
    }
    if (this.currentScreen === 'lan') this.showScreen('lan');
  }

  handleAction(action, button, event) {
    switch (action) {
      case 'home':
        if (this.inGame) {
          if (this.pausedSettings) this.closePauseSettings();
          break;
        }
        if (this.currentLobby) {
          this.requestLeaveLobby(() => this.showScreen('menu'));
        } else {
          this.showScreen('menu');
        }
        break;
      case 'online':
        this.showScreen('online');
        if (this.network.welcomed) this.network.listLobbies();
        break;
      case 'practice':
        this.showScreen('practice');
        break;
      case 'settings':
        this.showScreen('settings');
        break;
      case 'stats':
        this.showScreen('stats');
        break;
      case 'how':
        this.showScreen('how');
        break;
      case 'lan':
        this.showScreen('lan');
        this.fetchServerInfo();
        break;
      case 'refresh-lan':
        this.fetchServerInfo();
        break;
      case 'customize':
        this.customizeOrigin = this.currentScreen === 'lobby' || this.currentLobby ? 'lobby' : 'menu';
        this.showScreen('customize');
        break;
      case 'back':
      case 'menu':
        if (this.inGame) {
          if (this.pausedSettings) this.closePauseSettings();
          break;
        }
        this.showScreen('menu');
        break;
      case 'lobby':
        if (this.currentLobby) this.showScreen('lobby');
        else this.showScreen('menu');
        break;
      case 'online-mode':
        this.onlineMode = button.dataset.modeId || this.onlineMode;
        this.showScreen('online');
        break;
      case 'online-map':
        this.onlineMap = button.dataset.mapId || this.onlineMap;
        this.showScreen('online');
        break;
      case 'practice-mode':
        this.practiceMode = button.dataset.modeId || this.practiceMode;
        this.showScreen('practice');
        break;
      case 'practice-map':
        this.practiceMap = button.dataset.mapId || this.practiceMap;
        this.showScreen('practice');
        break;
      case 'practice-difficulty':
        this.practiceDifficulty = button.dataset.difficulty || 'normal';
        this.showScreen('practice');
        break;
      case 'practice-start':
        this.startPractice();
        break;
      case 'quick-match':
        this.withOnline(button, 'Finding a room…', () => this.network.quickMatch({ modeId: this.onlineMode }));
        break;
      case 'refresh-rooms':
        if (this.network.welcomed) this.network.listLobbies();
        else this.withOnline(button, 'Connecting…', () => this.network.listLobbies());
        break;
      case 'join-room-code':
        this.joinLobby(button.dataset.code, button);
        break;
      case 'copy-code':
        this.copyText(button.dataset.code, 'Room code copied.');
        break;
      case 'copy-text':
        this.copyText(button.dataset.copy, 'Address copied.');
        break;
      case 'toggle-ready':
        this.toggleReady();
        break;
      case 'start-match':
        this.startOnlineMatch();
        break;
      case 'lobby-sprint':
        this.updateLobbySprint();
        break;
      case 'kick-player':
        this.confirmKick(button.dataset.playerId);
        break;
      case 'leave-lobby':
        this.requestLeaveLobby(() => this.showScreen('menu'));
        break;
      case 'pick-character':
      case 'pick-palette':
      case 'pick-outfit':
      case 'pick-accessory':
      case 'pick-trail':
        this.updateProfilePart(action.replace('pick-', ''), button.dataset.value);
        break;
      case 'customize-random':
        this.randomizeProfile();
        break;
      case 'settings-tab':
        this.settingsTab = button.dataset.tab || 'audio';
        this.showScreen('settings');
        break;
      case 'toggle-setting':
        this.toggleSettingValue(button.dataset.setting);
        break;
      case 'remap-key':
        this.beginRemap(button.dataset.bindingAction, Number(button.dataset.bindingIndex));
        break;
      case 'reset-settings':
        this.showConfirm({
          title: 'Reset settings?',
          message: 'Audio, graphics, accessibility and key bindings will return to their defaults.',
          confirmLabel: 'Reset settings',
          danger: true,
          onConfirm: () => {
            store.resetSettings();
            this.applySettings();
            this.showScreen('settings');
            this.toast({ title: 'Settings reset', message: 'Defaults restored.', tone: 'success' });
          }
        });
        break;
      case 'reset-stats':
        this.showConfirm({
          title: 'Reset all stats?',
          message: 'Your match history, totals and achievement unlocks will be permanently cleared on this device.',
          confirmLabel: 'Reset everything',
          danger: true,
          onConfirm: () => {
            store.resetStats();
            this.showScreen('stats');
            this.toast({ title: 'Stats reset', message: 'A fresh scorebook.', tone: 'success' });
          }
        });
        break;
      case 'results-lobby':
        this.backToLobbyFromResults();
        break;
      case 'results-again':
        this.playPracticeAgain();
        break;
      case 'results-setup':
        this.stopGame();
        this.showScreen('practice');
        break;
      case 'results-menu':
        this.leaveToMenuFromResults();
        break;
      case 'pause-resume':
        this.togglePause(false);
        break;
      case 'pause-leave':
        this.leaveGame();
        break;
      default:
        break;
    }
  }

  handleScreenChange(event) {
    const target = event.target;
    if (target.matches('[data-setting-select="graphics"]')) {
      store.updateSettings({ graphics: target.value });
      this.applySettings();
      return;
    }
    if (target.matches('[data-practice-duration]')) {
      this.practiceDuration = Number(target.value) || 180;
      this.showScreen('practice');
      return;
    }
    if (target.matches('[data-lobby-setting], [data-lobby-option]')) {
      this.updateLobbySetting(target);
      return;
    }
    if (target.id === 'profile-name') {
      this.saveProfileName(target.value);
    }
  }

  handleScreenInput(event) {
    const target = event.target;
    if (target.matches('[data-setting-range]')) {
      const key = target.dataset.settingRange;
      const value = Number(target.value);
      store.updateSettings({ [key]: value });
      this.applySettings();
      const output = this.screenRoot.querySelector(`[data-setting-output="${key}"]`);
      if (output) output.textContent = `${Math.round(value * 100)}%`;
      return;
    }
    if (target.matches('[data-practice-bots]')) {
      this.practiceBots = Math.max(1, Math.min(11, Number(target.value) || 1));
      const output = this.screenRoot.querySelector('#practice-bots-value');
      if (output) output.textContent = String(this.practiceBots);
      return;
    }
    if (target.id === 'chat-input') {
      this.chatDraft = target.value;
      return;
    }
    if (target.id === 'profile-name') {
      const preview = this.screenRoot.querySelector('#preview-name');
      if (preview) preview.textContent = target.value || store.profile.name;
      return;
    }
  }

  handleScreenSubmit(event) {
    event.preventDefault();
    const form = event.target.closest('[data-form]');
    if (!form) return;
    const kind = form.dataset.form;
    if (kind === 'chat') {
      const input = form.querySelector('#chat-input');
      const message = input?.value.trim();
      if (!message) return;
      if (!this.network.chat(message)) {
        this.toast({ title: 'Not connected', message: 'Chat is unavailable while reconnecting.', tone: 'warning' });
        return;
      }
      this.chatDraft = '';
      if (input) input.value = '';
      return;
    }
    if (kind === 'join-code') {
      const code = form.querySelector('input[name="code"]')?.value.trim();
      this.joinLobby(code, form.querySelector('button[type="submit"]'));
      return;
    }
    if (kind === 'create-room') {
      const visibility = form.querySelector('select[name="visibility"]')?.value || 'public';
      const maxPlayers = Number(form.querySelector('select[name="maxPlayers"]')?.value) || 8;
      this.withOnline(form.querySelector('button[type="submit"]'), 'Creating room…', () => this.network.createLobby({
        modeId: this.onlineMode,
        mapId: this.onlineMap,
        visibility,
        options: { maxPlayers }
      }));
    }
  }

  joinLobby(code, button) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(normalized)) {
      this.toast({ title: 'Room code', message: 'Enter the five-character code from the host.', tone: 'warning' });
      return;
    }
    this.withOnline(button, 'Joining room…', () => this.network.joinLobby(normalized));
  }

  copyText(value, message) {
    if (!value) return;
    const done = () => this.toast({ title: 'Copied', message, tone: 'success', duration: 2200 });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(() => this.fallbackCopy(value, done));
    } else {
      this.fallbackCopy(value, done);
    }
  }

  fallbackCopy(value, done) {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } catch {}
    area.remove();
  }

  toggleReady() {
    if (!this.currentLobby) return;
    const you = this.currentLobby.players.find((player) => player.id === this.playerId);
    if (!you) return;
    const ready = !you.ready;
    this.network.setReady(ready);
    if (ready) this.audio.ready();
  }

  startOnlineMatch() {
    if (!this.currentLobby) return;
    if (!this.network.startMatch()) {
      this.toast({ title: 'Not connected', message: 'Reconnect before starting the match.', tone: 'warning' });
    }
  }

  updateLobbySprint() {
    const lobby = this.currentLobby;
    if (!lobby) return;
    this.network.updateSettings({
      modeId: lobby.modeId,
      mapId: lobby.mapId,
      options: { ...(lobby.options || {}), sprintEnabled: !(lobby.options?.sprintEnabled !== false) }
    });
  }

  updateLobbySetting(target) {
    const lobby = this.currentLobby;
    if (!lobby) return;
    if (lobby.hostId !== this.playerId) return;
    if (target.matches('[data-lobby-option]')) {
      const key = target.dataset.lobbyOption;
      const value = Number(target.value);
      this.network.updateSettings({
        modeId: lobby.modeId,
        mapId: lobby.mapId,
        options: { ...(lobby.options || {}), [key]: value }
      });
      return;
    }
    const key = target.dataset.lobbySetting;
    if (key === 'modeId' || key === 'mapId') {
      this.network.updateSettings({ modeId: lobby.modeId, mapId: lobby.mapId, [key]: target.value });
    }
  }

  confirmKick(playerId) {
    if (!playerId || !this.currentLobby) return;
    const player = this.currentLobby.players.find((entry) => entry.id === playerId);
    if (!player) return;
    this.showConfirm({
      title: `Remove ${player.name}?`,
      message: 'They will be sent back to the main menu and can join another room.',
      confirmLabel: 'Remove player',
      danger: true,
      onConfirm: () => this.network.kick(playerId)
    });
  }

  requestLeaveLobby(after) {
    if (!this.currentLobby) {
      after?.();
      return;
    }
    this.showConfirm({
      title: 'Leave the lobby?',
      message: 'You will lose your place in this room. The host can start without you.',
      confirmLabel: 'Leave lobby',
      danger: true,
      onConfirm: () => {
        this.network.leaveLobby();
        this.currentLobby = null;
        after?.();
      }
    });
  }

  updateProfilePart(part, value) {
    if (!value) return;
    const key = `${part}Id`;
    store.updateProfile({ [key]: value });
    this.syncCharacterToLobby();
    this.showScreen('customize');
  }

  randomizeProfile() {
    const random = (items) => items[Math.floor(Math.random() * items.length)].id;
    store.updateProfile({
      characterId: random(CHARACTERS),
      paletteId: random(PALETTES),
      outfitId: random(OUTFITS),
      accessoryId: random(ACCESSORIES),
      trailId: random(TRAILS)
    });
    this.syncCharacterToLobby();
    this.showScreen('customize');
  }

  saveProfileName(name) {
    const clean = String(name || '').trim();
    if (!clean) {
      const input = this.screenRoot.querySelector('#profile-name');
      if (input) input.value = store.profile.name;
      return;
    }
    store.updateProfile({ name: clean });
    this.syncCharacterToLobby();
  }

  syncCharacterToLobby() {
    if (!this.currentLobby || !this.network.welcomed) return;
    if (this.characterSyncTimer) clearTimeout(this.characterSyncTimer);
    this.characterSyncTimer = setTimeout(() => {
      this.network.selectCharacter(appearanceOf(store.profile), store.profile.name);
    }, 180);
  }

  toggleSettingValue(key) {
    if (!key) return;
    const next = !store.settings[key];
    store.updateSettings({ [key]: next });
    this.applySettings();
    const button = this.screenRoot.querySelector(`[data-setting="${key}"]`);
    if (button) {
      button.classList.toggle('is-on', next);
      button.setAttribute('aria-checked', String(next));
    }
  }

  beginRemap(action, index) {
    this.settingsTab = 'controls';
    this.listenBinding = { action, index };
    this.showScreen('settings', { preserveBinding: true });
    const button = this.screenRoot.querySelector(`[data-binding-action="${action}"][data-binding-index="${index}"]`);
    button?.focus();
  }

  completeRemap(code) {
    const binding = this.listenBinding;
    if (!binding) return;
    this.listenBinding = null;
    const current = store.settings.bindings;
    const bindings = Object.fromEntries(Object.entries(current).map(([key, list]) => [key, [...list]]));
    const target = bindings[binding.action] || [];
    const previous = target[binding.index];
    target[binding.index] = code;
    bindings[binding.action] = target.filter((entry, index) => index === binding.index || entry !== code);
    for (const key of Object.keys(bindings)) {
      if (key === binding.action) continue;
      const filtered = bindings[key].filter((entry) => entry !== code);
      if (filtered.length) {
        bindings[key] = filtered;
        continue;
      }
      const fallback = previous && previous !== code ? [previous] : current[key].filter((entry) => entry !== code);
      bindings[key] = fallback.length ? fallback : current[key];
    }
    store.updateSettings({ bindings });
    this.showScreen('settings');
    this.toast({ title: 'Key bound', message: `${CONTROL_LABELS[binding.action]} is now ${keyLabel(code)}.`, tone: 'success', duration: 2400 });
  }

  handleGlobalKey(event) {
    if (this.listenBinding) {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        this.listenBinding = null;
        this.showScreen('settings');
      } else {
        this.completeRemap(event.code);
      }
      return;
    }
    if (event.key === 'Escape' && !this.inGame) {
      if (this.modalCallback) {
        this.closeModal();
        return;
      }
      if (this.currentScreen && this.currentScreen !== 'menu') {
        this.showScreen('menu');
      }
    }
  }

  startPractice() {
    this.closeResults();
    this.stopGame({ countAsLeave: false });
    const mode = MODE_MAP[this.practiceMode] || MODE_MAP.classic;
    const config = {
      modeId: mode.id,
      mapId: this.practiceMap,
      bots: Math.min(11, Math.max(1, this.practiceBots)),
      difficulty: this.practiceDifficulty,
      duration: this.practiceDuration
    };
    this.practiceConfig = config;
    this.beginGame({ mode: 'practice', mapId: config.mapId, practice: config });
  }

  startOnlineGame(initialState) {
    this.closeResults();
    this.beginGame({
      mode: 'online',
      initialState,
      localId: this.playerId
    });
  }

  beginGame(data) {
    this.inGame = true;
    this.paused = false;
    this.scoreboardVisible = false;
    this.resultsActive = false;
    this.results = null;
    this.currentMatchId = data.initialState?.matchId || null;
    this.lastHud = null;
    this.lastPhase = null;
    this.lastCountdownValue = null;
    this.sprintSampleAt = performance.now();
    document.body.classList.add('in-game');
    this.screenRoot.innerHTML = '';
    this.overlayRoot.innerHTML = '';
    this.modalRoot.innerHTML = '';
    this.hudRoot.innerHTML = this.hudMarkup(data.initialState);
    this.audio.startMusic('game');
    const callbacks = this.gameCallbacks();
    const sceneData = {
      mode: data.mode,
      network: this.network,
      localId: data.localId || 'you',
      profile: store.profile,
      settings: store.settings,
      audio: this.audio,
      callbacks,
      ...(data.mode === 'online'
        ? { initialState: data.initialState }
        : { mapId: data.mapId, practice: data.practice })
    };
    this.game.scene.stop('GameScene');
    this.game.scene.start('GameScene', sceneData);
  }

  gameCallbacks() {
    return {
      onReady: (api) => { this.sceneApi = api; },
      onHud: (hud) => this.updateHud(hud),
      onEnd: (results, meta) => this.handleResults(results, meta),
      onGameEvent: (event) => this.handleGameEvent(event),
      onScoreboard: (visible) => this.toggleScoreboard(visible),
      onPauseRequest: () => this.togglePause(),
      onFocusLost: () => {
        if (this.inGame && !this.paused && !this.resultsActive) this.togglePause(true);
      },
      onSceneClosed: () => { this.sceneApi = null; }
    };
  }

  stopGame({ countAsLeave = false } = {}) {
    if (this.sprintSampleAt && this.lastHud?.local?.sprinting) {
      store.flushSprint();
    }
    this.sprintSampleAt = null;
    if (this.inGame) this.game.scene.stop('GameScene');
    this.inGame = false;
    this.paused = false;
    this.resultsActive = false;
    this.results = null;
    this.resultMeta = null;
    this.currentMatchId = null;
    this.sceneApi = null;
    this.lastHud = null;
    this.scoreboardVisible = false;
    document.body.classList.remove('in-game', 'pause-settings');
    this.screenRoot.classList.remove('in-game-settings');
    this.pausedSettings = false;
    this.hudRoot.innerHTML = '';
    this.overlayRoot.innerHTML = '';
    this.modalRoot.innerHTML = '';
    if (this.flashTimer) clearTimeout(this.flashTimer);
    if (this.goTimer) clearTimeout(this.goTimer);
    this.flashTimer = null;
    this.goTimer = null;
    if (countAsLeave) this.currentLobby = null;
    this.audio.startMusic('menu');
  }

  hudMarkup(initialState) {
    const mode = modeInfo(initialState?.modeId || this.practiceConfig?.modeId || 'classic');
    const map = mapInfo(initialState?.mapId || this.practiceConfig?.mapId || 'playground');
    const online = Boolean(initialState);
    const bind = (action) => (store.settings.bindings[action] || []).map(keyLabel).join(' / ');
    return `
      <div class="hud">
        <div class="hud-top">
          <div class="hud-left">
            <div class="hud-card hud-match">
              <div class="hud-match-top"><span class="hud-mode-dot" style="background:${mode.accent}"></span><span>${escapeHtml(mode.short)}</span><span>·</span><span>${online ? 'Online' : 'Practice'}</span></div>
              <div class="hud-timer" id="hud-timer">${formatClock(initialState?.timeLeft || this.practiceConfig?.duration || 180)}</div>
              <div class="tiny" id="hud-map-label">${escapeHtml(map.name)}${online ? ` · ${escapeHtml(initialState?.options?.duration ? formatDuration(initialState.options.duration) : '')}` : ` · ${escapeHtml(this.practiceDifficulty || 'normal')} bots`}</div>
            </div>
          </div>
          <div class="hud-center" id="hud-role"></div>
          <div class="hud-right">
            <div class="hud-minimap"><canvas id="hud-minimap" width="136" height="96" aria-label="Minimap"></canvas></div>
            <div class="ping-pill" id="hud-ping">--</div>
            <button class="hud-btn small" type="button" data-action="game-pause" aria-label="Pause">II</button>
          </div>
        </div>
        <div class="hud-connection hidden" id="hud-connection"><div class="connection-banner error">Connection lost. Reconnecting…</div></div>
        <div class="hud-notice">
          <div id="hud-countdown"></div>
          <div id="hud-flash"></div>
        </div>
        <div class="hud-prompt" id="hud-prompt"></div>
        <div class="hud-bottom">
          <div>
            <div class="hud-card stamina-wrap" id="hud-stamina">
              <div class="stamina-label"><span>Stamina</span><span id="hud-stamina-value">100%</span></div>
              <div class="stamina-bar"><div class="stamina-fill" id="hud-stamina-fill"></div></div>
            </div>
            <div class="hud-controls-hint">
              <span class="hint-chip"><b>${escapeHtml(bind('tag'))}</b> tag</span>
              <span class="hint-chip"><b>${escapeHtml(bind('interact'))}</b> thaw</span>
              <span class="hint-chip"><b>${escapeHtml(bind('sprint'))}</b> sprint</span>
              <span class="hint-chip"><b>${escapeHtml(bind('scoreboard'))}</b> scores</span>
            </div>
          </div>
          <div class="hud-actions">
            <button class="hud-btn" type="button" data-action="game-scoreboard" aria-label="Scoreboard">SCORE</button>
            <button class="hud-btn" type="button" data-action="game-pause" aria-label="Pause">PAUSE</button>
          </div>
        </div>
        <div class="touch-controls">
          <div class="joystick" id="touch-joystick" aria-label="Movement joystick"><span class="joystick-ring"></span><span class="joystick-knob" id="joystick-knob"></span></div>
          <div class="touch-buttons">
            <button class="touch-btn interact hidden" type="button" data-touch="interact" id="touch-interact">THAW</button>
            <button class="touch-btn sprint" type="button" data-touch="sprint">RUN</button>
            <button class="touch-btn tag" type="button" data-touch="tag">TAG</button>
          </div>
        </div>
      </div>
      <div class="scoreboard-overlay hidden" id="scoreboard-overlay">
        <div class="scoreboard-panel">
          <div class="panel-head"><h2>Live scoreboard</h2><button class="btn small ghost" type="button" data-action="game-scoreboard-close">Close</button></div>
          <div id="scoreboard-body"></div>
        </div>
      </div>
    `;
  }

  updateHud(hud) {
    if (!hud || !this.inGame) return;
    this.lastHud = hud;
    const timer = this.hudRoot.querySelector('#hud-timer');
    if (timer) {
      timer.textContent = formatClock(hud.timeLeft);
      timer.classList.toggle('is-low', Number(hud.timeLeft) <= 30);
    }
    const local = hud.local || {};
    const staminaWrap = this.hudRoot.querySelector('#hud-stamina');
    const staminaFill = this.hudRoot.querySelector('#hud-stamina-fill');
    const staminaValue = this.hudRoot.querySelector('#hud-stamina-value');
    const stamina = Math.max(0, Math.min(100, Number(local.stamina) || 0));
    if (staminaFill) staminaFill.style.width = `${stamina}%`;
    if (staminaValue) staminaValue.textContent = `${Math.round(stamina)}%`;
    staminaWrap?.classList.toggle('is-low', stamina < 20);
    staminaWrap?.classList.toggle('is-sprinting', Boolean(local.sprinting));

    const ping = this.hudRoot.querySelector('#hud-ping');
    if (ping) {
      if (hud.practice) {
        ping.textContent = 'LOCAL';
        ping.className = 'ping-pill good';
      } else {
        const quality = hud.quality || 'ok';
        ping.textContent = hud.ping == null ? '--' : `${Math.round(hud.ping)} ms`;
        ping.className = `ping-pill ${quality}`;
      }
    }

    this.updateRoleCard(hud);
    this.updatePrompt(hud);
    this.updateCountdown(hud);
    const connection = this.hudRoot.querySelector('#hud-connection');
    if (connection) connection.classList.toggle('hidden', !hud.connectionLost);

    const sprinting = Boolean(local.sprinting) && hud.phase === MATCH_PHASES.PLAYING && !this.paused;
    const now = performance.now();
    if (this.sprintSampleAt && sprinting) store.addSprintTime((now - this.sprintSampleAt) / 1000);
    this.sprintSampleAt = now;

    if (this.scoreboardVisible) this.renderScoreboard(hud);
    if (now - this.lastMinimapAt > 220) {
      this.lastMinimapAt = now;
      this.drawMinimap(hud);
    }
  }

  updateRoleCard(hud) {
    const slot = this.hudRoot.querySelector('#hud-role');
    if (!slot) return;
    const players = hud.players || [];
    const mode = hud.modeId;
    const it = players.find((player) => player.isIt || player.isEvader);
    const infected = players.filter((player) => player.infected).length;
    const frozen = players.filter((player) => player.frozen).length;
    const eliminated = players.filter((player) => player.eliminated).length;
    let html = '';
    if (mode === 'team') {
      const coral = Number(hud.modeState?.scores?.coral) || 0;
      const azure = Number(hud.modeState?.scores?.azure) || 0;
      const seekers = players.filter((player) => player.isSeeker);
      html = `
        <div class="hud-team-scores">
          <div class="team-score hud-card coral"><span>Coral</span><b>${coral}</b></div>
          <div class="team-score hud-card azure"><span>Azure</span><b>${azure}</b></div>
        </div>
        <div class="hud-card hud-it" data-team="azure" style="min-width:0">
          <span class="hud-it-mark">${seekers.length ? 'S' : 'C'}</span>
          <span class="hud-it-copy"><span>Seekers</span><b>${seekers.length ? seekers.map((entry) => escapeHtml(entry.name)).join(' · ') : 'Choosing…'}</b></span>
        </div>
      `;
    } else if (mode === 'infection') {
      const survivors = players.filter((player) => !player.infected && !player.eliminated).length;
      html = `
        <div class="hud-card hud-it">
          <span class="hud-it-mark" style="background:var(--green);color:#08230d">!</span>
          <span class="hud-it-copy"><span>Infected ${infected}</span><b>Survivors ${survivors}</b></span>
        </div>
      `;
    } else if (mode === 'freeze') {
      html = `
        <div class="hud-card hud-it">
          <span class="hud-it-mark" style="background:var(--azure);color:#032432">F</span>
          <span class="hud-it-copy"><span>Frozen ${frozen}</span><b>${it ? `${escapeHtml(it.name)} is IT` : 'IT is loose'}</b></span>
        </div>
      `;
    } else if (mode === 'last') {
      html = `
        <div class="hud-card hud-it">
          <span class="hud-it-mark">${Math.max(0, players.length - eliminated)}</span>
          <span class="hud-it-copy"><span>Still standing</span><b>${it ? `${escapeHtml(it.name)} is IT` : 'No tagger'}</b></span>
        </div>
      `;
    } else if (mode === 'reverse') {
      const evader = players.find((player) => player.isEvader) || it;
      html = `
        <div class="hud-card hud-it">
          <span class="hud-it-mark">◎</span>
          <span class="hud-it-copy"><span>Evader</span><b>${evader ? escapeHtml(evader.name) : 'Waiting…'}</b></span>
        </div>
      `;
    } else {
      html = `
        <div class="hud-card hud-it">
          <span class="hud-it-mark">IT</span>
          <span class="hud-it-copy"><span>Tag to pass it on</span><b>${it ? escapeHtml(it.name) : 'Waiting…'}</b></span>
        </div>
      `;
    }
    if (slot.dataset.signature !== html) {
      slot.innerHTML = html;
      slot.dataset.signature = html;
    }
  }

  updatePrompt(hud) {
    const prompt = this.hudRoot.querySelector('#hud-prompt');
    const interact = this.hudRoot.querySelector('#touch-interact');
    const tagButton = this.hudRoot.querySelector('[data-touch="tag"]');
    if (prompt) {
      const text = hud.connectionLost ? 'Reconnecting…' : hud.prompt || '';
      prompt.textContent = text;
      prompt.classList.toggle('hidden', !text);
      prompt.classList.toggle('is-interact', hud.promptKind === 'interact');
    }
    if (interact) interact.classList.toggle('hidden', !hud.canInteract);
    if (tagButton) tagButton.classList.toggle('is-ready', Boolean(hud.canTag));
  }

  updateCountdown(hud) {
    const countdownEl = this.hudRoot.querySelector('#hud-countdown');
    if (!countdownEl) return;
    if (hud.phase === MATCH_PHASES.COUNTDOWN) {
      const value = Math.max(1, Math.ceil(Number(hud.countdown) || 1));
      if (this.lastCountdownValue !== value) {
        this.lastCountdownValue = value;
        countdownEl.innerHTML = `<div class="countdown">${value}</div>`;
      }
      this.lastPhase = hud.phase;
      return;
    }
    if (this.lastPhase === MATCH_PHASES.COUNTDOWN && hud.phase === MATCH_PHASES.PLAYING) {
      countdownEl.innerHTML = '<div class="countdown go">GO!</div>';
      if (this.goTimer) clearTimeout(this.goTimer);
      this.goTimer = setTimeout(() => { if (countdownEl) countdownEl.innerHTML = ''; }, 820);
    }
    if (hud.phase === MATCH_PHASES.PLAYING && this.lastCountdownValue != null && this.lastPhase !== MATCH_PHASES.PLAYING) {
      this.lastCountdownValue = null;
    }
    if (hud.phase === MATCH_PHASES.ENDED) countdownEl.innerHTML = '';
    this.lastPhase = hud.phase;
  }

  toggleScoreboard(visible) {
    if (!this.inGame || this.resultsActive) return;
    this.scoreboardVisible = Boolean(visible);
    const overlay = this.hudRoot.querySelector('#scoreboard-overlay');
    if (!overlay) return;
    overlay.classList.toggle('hidden', !this.scoreboardVisible);
    if (this.scoreboardVisible && this.lastHud) this.renderScoreboard(this.lastHud);
  }

  renderScoreboard(hud) {
    const body = this.hudRoot.querySelector('#scoreboard-body');
    if (!body) return;
    const players = [...(hud.players || [])].sort((a, b) => {
      if (Boolean(b.isIt || b.isEvader || b.isSeeker) !== Boolean(a.isIt || a.isEvader || a.isSeeker)) {
        return Number(Boolean(b.isIt || b.isEvader || b.isSeeker)) - Number(Boolean(a.isIt || a.isEvader || a.isSeeker));
      }
      return (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(b.tags) || 0) - (Number(a.tags) || 0);
    });
    body.innerHTML = `
      <table class="score-table">
        <thead><tr><th>Player</th><th>Role</th><th>Tags</th><th>Score</th><th>Status</th></tr></thead>
        <tbody>
          ${players.map((player) => `
            <tr class="${player.id === hud.localId ? 'is-you' : ''} ${(player.isIt || player.isEvader) ? 'it-row' : ''}">
              <td>${escapeHtml(player.name)}${player.id === hud.localId ? ' (you)' : ''}</td>
              <td>${escapeHtml(roleLabel(player, hud.modeId))}</td>
              <td>${Number(player.tags) || 0}</td>
              <td>${Number(player.score) || 0}</td>
              <td>${player.connected === false ? 'Reconnecting' : player.frozen ? 'Frozen' : player.eliminated ? 'Out' : 'Active'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  drawMinimap(hud) {
    const canvas = this.hudRoot.querySelector('#hud-minimap');
    if (!canvas) return;
    const map = mapInfo(hud.mapId);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = 136;
    const height = 96;
    if (canvas.width !== Math.round(width * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width / map.width, height / map.height);
    const ox = (width - map.width * scale) / 2;
    const oy = (height - map.height * scale) / 2;
    const hex = (value) => `#${Number(value).toString(16).padStart(6, '0')}`;
    ctx.fillStyle = '#0b1026';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.fillStyle = hex(map.theme.floor);
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(map.theme.wall);
    for (const wall of map.walls) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    for (const player of hud.players || []) {
      if (player.eliminated || player.connected === false) continue;
      const isIt = player.isIt || player.isEvader || player.isSeeker;
      ctx.fillStyle = isIt ? '#ff5d73' : player.frozen ? '#63d9ff' : '#45f6e0';
      ctx.beginPath();
      ctx.arc(player.x, player.y, Math.max(28, map.width * 0.014), 0, Math.PI * 2);
      ctx.fill();
      if (player.id === hud.localId) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 18;
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }

  handleGameEvent(event) {
    if (!event) return;
    if (event.type === 'connection') {
      const tone = TONE_CLASS[event.tone] || 'info';
      this.toast({ title: event.tone === 'good' ? 'Reconnected' : 'Connection', message: event.message, tone });
      return;
    }
    if (event.type === 'notice') {
      this.toast({ title: 'No tag', message: event.message, tone: 'warning', duration: 2200 });
      this.playFlash(event.message, event.tone || 'warn');
      return;
    }
    if (event.message) {
      this.playFlash(event.message, event.tone || 'accent');
    }
  }

  togglePause(force) {
    if (!this.inGame || this.resultsActive) return;
    this.paused = typeof force === 'boolean' ? force : !this.paused;
    this.scoreboardVisible = false;
    const scoreboard = this.hudRoot.querySelector('#scoreboard-overlay');
    scoreboard?.classList.add('hidden');
    this.sceneApi?.setPaused(this.paused);
    if (!this.paused) {
      if (this.pausedSettings) {
        this.pausedSettings = false;
        this.screenRoot.classList.remove('in-game-settings');
        document.body.classList.remove('pause-settings');
        this.screenRoot.innerHTML = '';
        this.currentScreen = null;
      }
      this.overlayRoot.innerHTML = '';
      return;
    }
    const online = Boolean(this.currentMatchId) && !this.lastHud?.practice;
    this.overlayRoot.innerHTML = `
      <div class="pause-overlay">
        <div class="pause-card">
          <h2>Paused</h2>
          <p>${online ? 'Online matches keep running on the server. Your runner will stop sending movement until you resume.' : 'The practice clock is stopped while you are here.'}</p>
          <div class="pause-actions">
            <button class="btn primary" type="button" data-action="pause-resume">Resume</button>
            <button class="btn ghost" type="button" data-action="settings">Settings</button>
            <button class="btn danger" type="button" data-action="pause-leave">${online ? 'Leave match' : 'Quit practice'}</button>
          </div>
          <p class="tiny" style="margin:18px 0 0">Escape toggles pause. Controls can be rebound in Settings.</p>
        </div>
      </div>
    `;
    this.overlayRoot.querySelector('[data-action="pause-resume"]')?.focus();
  }

  closePauseSettings() {
    this.pausedSettings = false;
    this.screenRoot.classList.remove('in-game-settings');
    document.body.classList.remove('pause-settings');
    this.screenRoot.innerHTML = '';
    this.currentScreen = null;
    this.overlayRoot.innerHTML = '';
    this.togglePause(true);
  }

  leaveGame() {
    if (!this.inGame) return;
    if (this.currentLobby) this.network.leaveLobby();
    this.currentLobby = null;
    this.stopGame({ countAsLeave: true });
    this.showScreen('menu');
  }

  handleResults(results, meta) {
    if (!results || !this.inGame) return;
    this.resultsActive = true;
    this.results = results;
    this.resultMeta = meta || {};
    this.scoreboardVisible = false;
    this.paused = true;
    this.sceneApi?.setPaused(true);
    const localId = meta?.practice ? 'you' : this.playerId;
    const recordKey = `${results.matchId || 'practice'}:${results.at || Date.now()}`;
    if (this.recordedResultId !== recordKey) {
      this.recordedResultId = recordKey;
      store.flushSprint();
      const outcome = store.recordMatch(results, localId, { botMatch: Boolean(meta?.practice) });
      this.newAchievements = outcome.newAchievements || [];
    } else {
      this.newAchievements = [];
    }
    if (meta?.lobby) this.currentLobby = meta.lobby;
    this.renderResults();
    if (this.newAchievements.length) {
      this.newAchievements.forEach((achievement, index) => {
        setTimeout(() => this.toast({
          title: 'Achievement unlocked',
          message: achievement.name,
          tone: 'success',
          duration: 4200
        }), 450 + index * 380);
      });
    }
  }

  renderResults() {
    const results = this.results;
    if (!results) return;
    const localId = this.resultMeta?.practice ? 'you' : this.playerId;
    const local = results.standings?.find((entry) => entry.id === localId)
      || results.standings?.find((entry) => !entry.isBot)
      || results.standings?.[0];
    const isDraw = !results.winnerIds?.length;
    const won = Boolean(local?.won);
    const outcome = won ? 'WIN' : isDraw ? 'DRAW' : 'FINISHED';
    const practice = Boolean(this.resultMeta?.practice);
    const mode = modeInfo(results.modeId);
    const map = mapInfo(results.mapId);
    const detail = results.detail || 'The round is over.';
    const standings = results.standings || [];
    this.overlayRoot.innerHTML = `
      <div class="results-overlay">
        <div class="results-shell">
          <div class="row between results-bar">
            <div class="row">${badge(practice ? 'Practice' : 'Online match', practice ? 'lan' : 'live')}<span class="tiny">${escapeHtml(mode.name)} · ${escapeHtml(map.name)}</span></div>
            <button class="btn small ghost" type="button" data-action="results-menu">Main menu</button>
          </div>
          <div class="results-layout">
            <section class="panel result-hero">
              <div class="result-tag" aria-hidden="true">${won ? 'WIN' : isDraw ? 'TIE' : 'TAG'}</div>
              <h2>${escapeHtml(results.title || (won ? 'Victory' : 'Match complete'))}</h2>
              <p>${escapeHtml(detail)}</p>
              <div class="result-stats">
                <div class="result-stat"><b>${local?.tags || 0}</b><span>Tags</span></div>
                <div class="result-stat"><b>${formatSeconds(local?.itTime || 0)}</b><span>As IT</span></div>
                <div class="result-stat"><b>${formatSeconds(local?.survivalTime || 0)}</b><span>Survived</span></div>
              </div>
              <div class="result-actions">
                ${!practice && this.currentLobby ? '<button class="btn primary" type="button" data-action="results-lobby">Back to lobby</button>' : ''}
                ${practice ? '<button class="btn primary" type="button" data-action="results-again">Play again</button>' : ''}
                ${practice ? '<button class="btn ghost" type="button" data-action="results-setup">Change setup</button>' : ''}
                <button class="btn ghost" type="button" data-action="results-menu">Main menu</button>
              </div>
              ${this.newAchievements.length ? `<div class="new-awards">${this.newAchievements.map((entry) => `<span class="badge lan">${escapeHtml(entry.name)}</span>`).join('')}</div>` : ''}
            </section>
            <section class="panel">
              <div class="panel-head"><h2>Final standings</h2><span class="tiny">${outcome} · ${formatClock(results.duration)}</span></div>
              <div style="overflow:auto">
                <table class="standings">
                  <thead><tr><th>#</th><th>Player</th><th>Tags</th><th>Tagged</th><th>IT time</th><th>Score</th></tr></thead>
                  <tbody>
                    ${standings.map((entry) => `
                      <tr class="${entry.won ? 'is-winner' : ''}">
                        <td class="rank">${entry.placement}</td>
                        <td class="player-name">${escapeHtml(entry.name)}${entry.id === localId ? '<span class="you-tag">YOU</span>' : ''}</td>
                        <td class="tag-count">${entry.tags || 0}</td>
                        <td>${entry.timesTagged || 0}</td>
                        <td class="it-time">${formatClock(entry.itTime)}</td>
                        <td class="mono">${entry.score || 0}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    `;
    this.overlayRoot.querySelector('[data-action="results-lobby"]')?.focus();
  }

  closeResults() {
    this.resultsActive = false;
    this.results = null;
    this.resultMeta = null;
    this.newAchievements = [];
    if (this.overlayRoot.querySelector('.results-overlay')) this.overlayRoot.innerHTML = '';
  }

  backToLobbyFromResults() {
    this.audio.uiClick();
    if (this.currentLobby) this.network.returnToLobby();
    const lobby = this.currentLobby;
    this.stopGame({ countAsLeave: false });
    if (lobby) {
      this.showScreen('lobby');
    } else {
      this.showScreen('menu');
    }
  }

  playPracticeAgain() {
    const config = this.practiceConfig;
    this.closeResults();
    this.stopGame({ countAsLeave: false });
    if (!config) {
      this.showScreen('practice');
      return;
    }
    this.practiceMode = config.modeId;
    this.practiceMap = config.mapId;
    this.practiceBots = config.bots;
    this.practiceDifficulty = config.difficulty;
    this.practiceDuration = config.duration;
    this.startPractice();
  }

  leaveToMenuFromResults() {
    if (this.currentLobby) this.network.leaveLobby();
    this.currentLobby = null;
    this.stopGame({ countAsLeave: true });
    this.showScreen('menu');
  }

  handleHudPointerDown(event) {
    const sprint = event.target.closest('[data-touch="sprint"]');
    if (sprint) {
      event.preventDefault();
      this.sceneApi?.setTouchSprint(true);
      return;
    }
    const tag = event.target.closest('[data-touch="tag"]');
    if (tag) {
      event.preventDefault();
      this.sceneApi?.requestTag();
      return;
    }
    const interact = event.target.closest('[data-touch="interact"]');
    if (interact) {
      event.preventDefault();
      this.sceneApi?.requestInteract();
      return;
    }
    const joystick = event.target.closest('#touch-joystick');
    if (joystick) {
      event.preventDefault();
      this.joystickPointer = event.pointerId;
      joystick.setPointerCapture?.(event.pointerId);
      this.updateJoystick(event, joystick);
    }
  }

  handleJoystickMove(event) {
    if (this.joystickPointer !== event.pointerId) return;
    const joystick = this.hudRoot.querySelector('#touch-joystick');
    if (!joystick) return;
    event.preventDefault();
    this.updateJoystick(event, joystick);
  }

  updateJoystick(event, joystick) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const max = rect.width * 0.34;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const length = Math.hypot(dx, dy);
    if (length > max) {
      dx = (dx / length) * max;
      dy = (dy / length) * max;
    }
    const knob = joystick.querySelector('#joystick-knob');
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.sceneApi?.setTouchVector(dx / max, dy / max);
  }

  handleJoystickEnd(event) {
    const sprint = event.target.closest?.('[data-touch="sprint"]');
    if (sprint) this.sceneApi?.setTouchSprint(false);
    if (this.joystickPointer !== event.pointerId) return;
    this.joystickPointer = null;
    const knob = this.hudRoot.querySelector('#joystick-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
    this.sceneApi?.setTouchVector(0, 0);
  }
}
