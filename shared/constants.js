export const GAME_NAME = 'TAG';
export const PROTOCOL_VERSION = 2;
export const TICK_RATE = 30;
export const SNAPSHOT_RATE = 20;
export const INPUT_RATE = 30;
export const SERVER_TICK_MS = 1000 / TICK_RATE;

export const PLAYER_RADIUS = 17;
export const PLAYER_HALF_WIDTH = 15;
export const PLAYER_HALF_HEIGHT = 27;
export const WORLD_PADDING = 24;
export const WALK_SPEED = 190;
export const SPRINT_SPEED = 300;
export const ACCELERATION = 1850;
export const DECELERATION = 2450;
export const AIR_ACCELERATION = 1250;
export const GRAVITY = 2200;
export const JUMP_SPEED = 900;
export const MAX_FALL_SPEED = 1500;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.13;
export const DIAGONAL_NORMALIZER = Math.SQRT1_2;

export const STAMINA_MAX = 100;
export const STAMINA_DRAIN = 24;
export const STAMINA_REGEN = 17;
export const STAMINA_SPRINT_MIN = 6;
export const STAMINA_RECOVER_DELAY = 0.45;

export const TAG_DISTANCE = 58;
export const TAG_COOLDOWN_MS = 1200;
export const TAG_IMMUNITY_MS = 1400;
export const TAG_STUN_MS = 420;
export const REVIVE_RANGE = 76;
export const REVIVE_COOLDOWN_MS = 1200;
export const REVIVE_IMMUNITY_MS = 1800;
export const COUNTDOWN_SECONDS = 3;

export const MAX_PLAYERS = 12;
export const MIN_PLAYERS = 2;
export const MAX_CHAT_LENGTH = 140;
export const MAX_NAME_LENGTH = 18;
export const ROOM_CODE_LENGTH = 5;
export const RECONNECT_GRACE_MS = 20000;

export const DEFAULT_OPTIONS = Object.freeze({
  duration: 180,
  tagDistance: TAG_DISTANCE,
  tagCooldownMs: TAG_COOLDOWN_MS,
  sprintEnabled: true,
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  countdown: COUNTDOWN_SECONDS,
  reviveRange: REVIVE_RANGE,
  scoreLimit: 0
});

export const OPTION_LIMITS = Object.freeze({
  duration: { min: 60, max: 600, step: 30 },
  tagDistance: { min: 40, max: 84, step: 2 },
  tagCooldownMs: { min: 600, max: 3000, step: 100 },
  minPlayers: { min: 2, max: 8, step: 1 },
  maxPlayers: { min: 2, max: MAX_PLAYERS, step: 1 },
  reviveRange: { min: 50, max: 120, step: 5 }
});

export const GAME_MODES = Object.freeze([
  {
    id: 'classic',
    name: 'Classic Tag',
    short: 'Classic',
    description: 'One player is IT. Tag someone to pass it on before time runs out. Spend the least time as IT to win.',
    icon: '◈',
    minPlayers: 2,
    maxPlayers: 12,
    teamBased: false,
    accent: '#ff5d73'
  },
  {
    id: 'infection',
    name: 'Infection',
    short: 'Infection',
    description: 'The infected spread by tagging survivors. Survivors win if anyone remains when the clock hits zero.',
    icon: '☣',
    minPlayers: 3,
    maxPlayers: 12,
    teamBased: false,
    accent: '#b8ff5a'
  },
  {
    id: 'freeze',
    name: 'Freeze Tag',
    short: 'Freeze',
    description: 'IT freezes runners in place. Nearby runners can thaw frozen teammates before everyone is frozen.',
    icon: '❄',
    minPlayers: 3,
    maxPlayers: 12,
    teamBased: false,
    accent: '#63d9ff'
  },
  {
    id: 'team',
    name: 'Team Tag',
    short: 'Teams',
    description: 'Coral and Azure each have a seeker. Tag an opponent to score, then their team promotes a new seeker.',
    icon: '⚑',
    minPlayers: 4,
    maxPlayers: 12,
    teamBased: true,
    accent: '#ffcc4d'
  },
  {
    id: 'last',
    name: 'Last Player Standing',
    short: 'Last One',
    description: 'Tagged runners are eliminated. Outlast everyone else — or clear the arena as IT.',
    icon: '★',
    minPlayers: 3,
    maxPlayers: 12,
    teamBased: false,
    accent: '#ff8c42'
  },
  {
    id: 'reverse',
    name: 'Reverse Tag',
    short: 'Reverse',
    description: 'The marked evader must survive the hunt. Any hunter who tags the evader ends the round instantly.',
    icon: '◎',
    minPlayers: 2,
    maxPlayers: 12,
    teamBased: false,
    accent: '#c58bff'
  }
]);

export const MODE_MAP = Object.freeze(Object.fromEntries(GAME_MODES.map((mode) => [mode.id, mode])));

export const TEAMS = Object.freeze({
  coral: { id: 'coral', name: 'Coral', color: 0xff6b81, css: '#ff8fa0', dark: '#9d2942', icon: '◆' },
  azure: { id: 'azure', name: 'Azure', color: 0x4cc9ff, css: '#68d9ff', dark: '#155b79', icon: '●' }
});

export const CHARACTERS = Object.freeze([
  { id: 'rascal', name: 'Rascal', tagline: 'Quick feet, quicker mouth.', body: 0, silhouette: 'spiky', defaultPalette: 'sunset' },
  { id: 'comet', name: 'Comet', tagline: 'Always first to the corner.', body: 1, silhouette: 'round', defaultPalette: 'ocean' },
  { id: 'moss', name: 'Moss', tagline: 'Knows every shortcut.', body: 2, silhouette: 'leaf', defaultPalette: 'forest' },
  { id: 'pixel', name: 'Pixel', tagline: 'Plays in frames per second.', body: 3, silhouette: 'square', defaultPalette: 'arcade' },
  { id: 'nova', name: 'Nova', tagline: 'Makes an entrance, then leaves.', body: 4, silhouette: 'star', defaultPalette: 'candy' },
  { id: 'breeze', name: 'Breeze', tagline: 'Impossible to corner.', body: 5, silhouette: 'wave', defaultPalette: 'mint' }
]);

export const CHARACTER_MAP = Object.freeze(Object.fromEntries(CHARACTERS.map((character) => [character.id, character])));

export const PALETTES = Object.freeze([
  { id: 'sunset', name: 'Sunset', skin: '#f2b38d', hair: '#2f2030', primary: '#ff6b5e', secondary: '#ffd166', accent: '#fff4d6' },
  { id: 'ocean', name: 'Ocean', skin: '#8d5f45', hair: '#16233b', primary: '#2c9cff', secondary: '#7ef0e2', accent: '#e9fbff' },
  { id: 'forest', name: 'Forest', skin: '#b97855', hair: '#203124', primary: '#44b66b', secondary: '#d4f06a', accent: '#f5ffe1' },
  { id: 'arcade', name: 'Arcade', skin: '#e7a77d', hair: '#311b58', primary: '#b45cff', secondary: '#ff4fd8', accent: '#fff0ff' },
  { id: 'candy', name: 'Candy', skin: '#f5c6a5', hair: '#692a54', primary: '#ff86bf', secondary: '#8ce8ff', accent: '#fff7fc' },
  { id: 'mint', name: 'Mint', skin: '#7d4f3b', hair: '#132d2c', primary: '#45d6b1', secondary: '#f4ef9b', accent: '#f0fffa' },
  { id: 'ember', name: 'Ember', skin: '#d68b63', hair: '#3f1612', primary: '#ff8a35', secondary: '#ff3d50', accent: '#fff1df' },
  { id: 'slate', name: 'Slate', skin: '#9b6a52', hair: '#141820', primary: '#7b8ea8', secondary: '#d6e3f0', accent: '#f5f9ff' }
]);

export const PALETTE_MAP = Object.freeze(Object.fromEntries(PALETTES.map((palette) => [palette.id, palette])));

export const OUTFITS = Object.freeze([
  { id: 'tee', name: 'Team Tee' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'varsity', name: 'Varsity' },
  { id: 'jacket', name: 'Windbreaker' },
  { id: 'robe', name: 'Cosy Robe' }
]);

export const ACCESSORIES = Object.freeze([
  { id: 'none', name: 'None' },
  { id: 'cap', name: 'Cap' },
  { id: 'headphones', name: 'Headphones' },
  { id: 'antenna', name: 'Antenna' },
  { id: 'halo', name: 'Halo' },
  { id: 'scarf', name: 'Scarf' }
]);

export const TRAILS = Object.freeze([
  { id: 'none', name: 'No trail' },
  { id: 'spark', name: 'Sparks' },
  { id: 'bubble', name: 'Bubbles' },
  { id: 'leaf', name: 'Leaves' }
]);

export const DEFAULT_PROFILE = Object.freeze({
  name: '',
  characterId: 'rascal',
  paletteId: 'sunset',
  outfitId: 'tee',
  accessoryId: 'none',
  trailId: 'spark'
});

export const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 0.45,
  sfxVolume: 0.8,
  muted: false,
  reducedMotion: false,
  graphics: 'high',
  particles: true,
  screenShake: true,
  colorBlindMarkers: true,
  bindings: {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space', 'KeyW', 'ArrowUp'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    tag: ['KeyJ'],
    interact: ['KeyE'],
    scoreboard: ['Tab']
  }
});

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_tag', name: 'You’re It', description: 'Land your first tag.', icon: '◈' },
  { id: 'first_win', name: 'Top of the Playground', description: 'Win your first match.', icon: '★' },
  { id: 'escape_artist', name: 'Escape Artist', description: 'Survive a Reverse Tag round as the evader.', icon: '◎' },
  { id: 'ice_breaker', name: 'Ice Breaker', description: 'Thaw three frozen runners in one match.', icon: '❄' },
  { id: 'untouchable', name: 'Untouchable', description: 'Win a match without being tagged.', icon: '◇' },
  { id: 'team_player', name: 'Team Player', description: 'Score three tags in Team Tag.', icon: '⚑' },
  { id: 'regular', name: 'Playground Regular', description: 'Play ten matches.', icon: '●' },
  { id: 'marathon', name: 'Marathon', description: 'Sprint for a total of five minutes.', icon: '➤' }
]);

export const ACHIEVEMENT_MAP = Object.freeze(Object.fromEntries(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement])));

export const GRAPHICS_PRESETS = Object.freeze({
  low: { particles: 8, shadows: false, glow: false, cameraZoom: 1, pulse: false },
  medium: { particles: 20, shadows: true, glow: false, cameraZoom: 1.02, pulse: false },
  high: { particles: 42, shadows: true, glow: true, cameraZoom: 1.04, pulse: true }
});

export const TEAM_COLORS = Object.freeze({
  coral: 0xff6b81,
  azure: 0x4cc9ff
});

export const DEFAULT_MATCH_STATE = 'waiting';
