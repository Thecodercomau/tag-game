import {
  ACCESSORIES,
  ACHIEVEMENTS,
  CHARACTERS,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  OUTFITS,
  PALETTES,
  TRAILS
} from '@shared/constants.js';
import { deepMerge } from '@shared/utils.js';

const KEYS = {
  profile: 'tag.profile.v1',
  settings: 'tag.settings.v1',
  stats: 'tag.stats.v1'
};

const validIds = (items, id) => items.some((item) => item.id === id);

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or sandboxed frames.
  }
}

function makeGuestName() {
  return `Runner${Math.floor(100 + Math.random() * 900)}`;
}

function normalizeProfile(input) {
  const profile = { ...DEFAULT_PROFILE, ...(input || {}) };
  if (!profile.name || typeof profile.name !== 'string') profile.name = makeGuestName();
  profile.name = profile.name.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18) || makeGuestName();
  if (!validIds(CHARACTERS, profile.characterId)) profile.characterId = DEFAULT_PROFILE.characterId;
  if (!validIds(PALETTES, profile.paletteId)) profile.paletteId = DEFAULT_PROFILE.paletteId;
  if (!validIds(OUTFITS, profile.outfitId)) profile.outfitId = DEFAULT_PROFILE.outfitId;
  if (!validIds(ACCESSORIES, profile.accessoryId)) profile.accessoryId = DEFAULT_PROFILE.accessoryId;
  if (!validIds(TRAILS, profile.trailId)) profile.trailId = DEFAULT_PROFILE.trailId;
  return profile;
}

function normalizeSettings(input) {
  const settings = deepMerge(DEFAULT_SETTINGS, input || {});
  settings.masterVolume = Math.max(0, Math.min(1, Number(settings.masterVolume)));
  settings.musicVolume = Math.max(0, Math.min(1, Number(settings.musicVolume)));
  settings.sfxVolume = Math.max(0, Math.min(1, Number(settings.sfxVolume)));
  if (!['low', 'medium', 'high'].includes(settings.graphics)) settings.graphics = 'high';
  const previousBindings = input?.bindings;
  settings.bindings = deepMerge(DEFAULT_SETTINGS.bindings, settings.bindings || {});
  if (!previousBindings?.jump) {
    settings.bindings.jump = [...DEFAULT_SETTINGS.bindings.jump];
    const tagKeys = (settings.bindings.tag || []).filter((code) => !DEFAULT_SETTINGS.bindings.jump.includes(code));
    settings.bindings.tag = tagKeys.length ? tagKeys : [...DEFAULT_SETTINGS.bindings.tag];
  }
  delete settings.bindings.up;
  delete settings.bindings.down;
  for (const key of Object.keys(DEFAULT_SETTINGS.bindings)) {
    const value = settings.bindings[key];
    if (!Array.isArray(value) || !value.length || value.some((entry) => typeof entry !== 'string')) {
      settings.bindings[key] = [...DEFAULT_SETTINGS.bindings[key]];
    } else {
      settings.bindings[key] = value.slice(0, 4);
    }
  }
  for (const key of ['muted', 'reducedMotion', 'particles', 'screenShake', 'colorBlindMarkers']) {
    settings[key] = Boolean(settings[key]);
  }
  return settings;
}

function defaultStats() {
  return {
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    tags: 0,
    timesTagged: 0,
    itTime: 0,
    sprintTime: 0,
    revives: 0,
    achievements: [],
    history: [],
    modes: {},
    maps: {}
  };
}

function normalizeStats(input) {
  const base = defaultStats();
  const stats = { ...base, ...(input || {}) };
  for (const key of ['matches', 'wins', 'losses', 'draws', 'tags', 'timesTagged', 'itTime', 'sprintTime', 'revives']) {
    stats[key] = Number.isFinite(Number(stats[key])) ? Math.max(0, Number(stats[key])) : 0;
  }
  stats.achievements = Array.isArray(stats.achievements)
    ? [...new Set(stats.achievements.filter((id) => ACHIEVEMENTS.some((entry) => entry.id === id)))]
    : [];
  stats.history = Array.isArray(stats.history) ? stats.history.slice(0, 12) : [];
  stats.modes = stats.modes && typeof stats.modes === 'object' ? stats.modes : {};
  stats.maps = stats.maps && typeof stats.maps === 'object' ? stats.maps : {};
  return stats;
}

class Store {
  constructor() {
    this.profile = normalizeProfile(safeRead(KEYS.profile, null));
    this.settings = normalizeSettings(safeRead(KEYS.settings, null));
    this.stats = normalizeStats(safeRead(KEYS.stats, null));
    if (!safeRead(KEYS.profile, null)) this.saveProfile();
    this.pendingSprint = 0;
    this.sprintSaveTimer = setInterval(() => this.flushSprint(), 10000);
  }

  saveProfile() {
    this.profile = normalizeProfile(this.profile);
    safeWrite(KEYS.profile, this.profile);
    return this.profile;
  }

  updateProfile(partial) {
    this.profile = normalizeProfile({ ...this.profile, ...partial });
    safeWrite(KEYS.profile, this.profile);
    return this.profile;
  }

  saveSettings() {
    this.settings = normalizeSettings(this.settings);
    safeWrite(KEYS.settings, this.settings);
    return this.settings;
  }

  updateSettings(partial) {
    this.settings = normalizeSettings(deepMerge(this.settings, partial));
    safeWrite(KEYS.settings, this.settings);
    return this.settings;
  }

  resetSettings() {
    this.settings = normalizeSettings(DEFAULT_SETTINGS);
    safeWrite(KEYS.settings, this.settings);
    return this.settings;
  }

  saveStats() {
    this.stats = normalizeStats(this.stats);
    safeWrite(KEYS.stats, this.stats);
    return this.stats;
  }

  addSprintTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.pendingSprint += Math.min(seconds, 1);
  }

  flushSprint() {
    if (this.pendingSprint <= 0) return;
    this.stats.sprintTime += this.pendingSprint;
    this.pendingSprint = 0;
    this.unlock('marathon', this.stats.sprintTime >= 300);
    this.saveStats();
  }

  unlock(id, condition) {
    if (!condition || this.stats.achievements.includes(id)) return null;
    this.stats.achievements.push(id);
    return ACHIEVEMENTS.find((achievement) => achievement.id === id) || null;
  }

  recordMatch(result, localPlayerId, { botMatch = false } = {}) {
    const local = result.standings.find((entry) => entry.id === localPlayerId)
      || result.standings.find((entry) => !entry.isBot)
      || result.standings[0];
    if (!local) return { newAchievements: [], stats: this.stats };
    this.stats.matches += 1;
    const isDraw = !result.winnerIds.length;
    if (local.won) this.stats.wins += 1;
    else if (isDraw) this.stats.draws += 1;
    else this.stats.losses += 1;
    this.stats.tags += local.tags || 0;
    this.stats.timesTagged += local.timesTagged || 0;
    this.stats.itTime += local.itTime || 0;
    this.stats.revives += local.revives || 0;
    const modeRecord = this.stats.modes[result.modeId] || { played: 0, wins: 0 };
    modeRecord.played += 1;
    if (local.won) modeRecord.wins += 1;
    this.stats.modes[result.modeId] = modeRecord;
    const mapRecord = this.stats.maps[result.mapId] || { played: 0, wins: 0 };
    mapRecord.played += 1;
    if (local.won) mapRecord.wins += 1;
    this.stats.maps[result.mapId] = mapRecord;
    this.stats.history.unshift({
      modeId: result.modeId,
      mapId: result.mapId,
      title: result.title,
      won: local.won,
      draw: isDraw,
      tags: local.tags || 0,
      duration: result.duration,
      botMatch,
      at: Date.now()
    });
    this.stats.history = this.stats.history.slice(0, 12);

    const unlocked = [];
    const add = (achievement) => { if (achievement) unlocked.push(achievement); };
    add(this.unlock('first_tag', this.stats.tags >= 1));
    add(this.unlock('first_win', this.stats.wins >= 1));
    add(this.unlock('regular', this.stats.matches >= 10));
    add(this.unlock('marathon', this.stats.sprintTime >= 300));
    add(this.unlock('ice_breaker', result.modeId === 'freeze' && (local.revives || 0) >= 3));
    add(this.unlock('untouchable', local.won && (local.timesTagged || 0) === 0 && !isDraw));
    add(this.unlock('team_player', result.modeId === 'team' && (local.tags || 0) >= 3));
    add(this.unlock('escape_artist', result.modeId === 'reverse' && local.won && (local.timesTagged || 0) === 0));
    this.saveStats();
    return { newAchievements: unlocked, stats: this.stats };
  }

  resetStats() {
    this.stats = defaultStats();
    this.saveStats();
    return this.stats;
  }
}

export const store = new Store();
export { normalizeProfile, normalizeSettings };
