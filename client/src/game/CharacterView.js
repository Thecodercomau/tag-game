import { CHARACTER_MAP, PALETTE_MAP, TEAM_COLORS } from '@shared/constants.js';
import { drawCharacter } from './CharacterArt.js';

const FRAME_COUNT = {
  idle: 2,
  walking: 4,
  running: 4,
  sprinting: 4,
  tagging: 2,
  tagged: 2,
  frozen: 1,
  victory: 2,
  defeat: 1
};

const FRAME_FPS = {
  idle: 2.2,
  walking: 8,
  running: 11,
  sprinting: 14,
  tagging: 9,
  tagged: 12,
  frozen: 1,
  victory: 5,
  defeat: 1
};

function profileKey(profile = {}) {
  return [
    profile.characterId || 'rascal',
    profile.paletteId || 'sunset',
    profile.outfitId || 'tee',
    profile.accessoryId || 'none'
  ].join('-');
}

function markerFor(player, modeId) {
  if (player.eliminated) return { text: 'OUT', bg: '#4b5267', color: '#e1e6f0' };
  if (!player.connected) return { text: 'OFFLINE', bg: '#363b4d', color: '#aeb6c9' };
  if (player.frozen) return { text: 'FROZEN', bg: '#bff4ff', color: '#082936' };
  if (modeId === 'infection' && player.infected) return { text: 'INFECTED', bg: '#b8ff5a', color: '#142508' };
  if (modeId === 'team' && player.isSeeker) return { text: 'SEEKER', bg: player.team === 'azure' ? '#68d9ff' : '#ff8fa0', color: '#10202a' };
  if (modeId === 'reverse' && player.isEvader) return { text: 'EVADER', bg: '#d9b4ff', color: '#221133' };
  if (player.isIt) return { text: 'IT', bg: '#ff5d73', color: '#2b0a12' };
  return null;
}

export class CharacterView {
  constructor(scene, player, { localId, modeId, quality = {} } = {}) {
    this.scene = scene;
    this.playerId = player.id;
    this.modeId = modeId;
    this.quality = quality;
    this.profile = player.appearance || {};
    this.key = profileKey(this.profile);
    this.isLocal = player.id === localId;
    this.state = 'idle';
    this.frame = 0;
    this.frameElapsed = 0;
    this.dirX = player.dirX ?? 0;
    this.dirY = player.dirY ?? 1;
    this.x = player.x;
    this.y = player.y;
    this.lastMarker = '';
    this.visible = true;

    this.container = scene.add.container(Math.round(player.x), Math.round(player.y));
    this.container.setDepth(Math.round(player.y) + 80);
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x050a12, this.quality.shadows === false ? 0 : 0.24);
    this.shadow.fillEllipse(0, 3, 38, 12);
    this.container.add(this.shadow);
    this.highlight = scene.add.graphics();
    this.highlight.lineStyle(3, 0xffd166, 0.9);
    this.highlight.strokeEllipse(0, 4, 46, 17);
    this.highlight.setVisible(false);
    this.container.add(this.highlight);
    this.teamRing = scene.add.graphics();
    this.container.add(this.teamRing);
    this.sprite = scene.add.sprite(0, 0, this.ensureTexture('idle', 0));
    this.sprite.setOrigin(0.5, 0.87);
    this.sprite.setDisplaySize(77, 77);
    this.container.add(this.sprite);
    this.nameText = scene.add.text(0, -72, player.name, {
      fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
      fontSize: '12px',
      fontStyle: '700',
      color: '#fff7e8',
      stroke: '#111827',
      strokeThickness: 4,
      align: 'center'
    });
    this.nameText.setOrigin(0.5, 1);
    this.nameText.setResolution(2);
    this.container.add(this.nameText);
    this.marker = scene.add.text(0, -92, '', {
      fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
      fontSize: '10px',
      fontStyle: '800',
      color: '#2b0a12',
      backgroundColor: '#ff5d73',
      padding: { x: 6, y: 3 },
      align: 'center'
    });
    this.marker.setOrigin(0.5, 1);
    this.marker.setResolution(2);
    this.container.add(this.marker);
    this.apply(player, 0, 0);
  }

  ensureTexture(state, frame) {
    const safeState = FRAME_COUNT[state] ? state : 'idle';
    const key = `tag-char-${this.key}-${safeState}-${frame}`;
    if (this.scene.textures.exists(key)) return key;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    drawCharacter(ctx, {
      size: 128,
      profile: this.profile,
      state: safeState,
      frame,
      time: 0.4 + frame * 0.19,
      colorBlind: false
    });
    this.scene.textures.addCanvas(key, canvas);
    return key;
  }

  setState(state) {
    const safeState = FRAME_COUNT[state] ? state : 'idle';
    if (this.state === safeState) return;
    this.state = safeState;
    this.frame = 0;
    this.frameElapsed = 0;
    this.sprite.setTexture(this.ensureTexture(safeState, 0));
  }

  apply(player, dt, now) {
    if (!player) return;
    const palette = PALETTE_MAP[this.profile.paletteId] || PALETTE_MAP.sunset;
    const teamColor = player.team ? TEAM_COLORS[player.team] : null;
    this.teamRing.clear();
    if (teamColor) {
      this.teamRing.lineStyle(3, teamColor, 0.9);
      this.teamRing.strokeEllipse(0, 4, 42, 15);
      this.teamRing.fillStyle(teamColor, 0.18);
      this.teamRing.fillEllipse(0, 4, 34, 10);
    } else if (this.isLocal) {
      this.teamRing.lineStyle(2, palette.accent, 0.55);
      this.teamRing.strokeEllipse(0, 4, 36, 13);
    }

    this.setState(player.animation || this.deriveState(player));
    this.frameElapsed += dt;
    const fps = FRAME_FPS[this.state] || 5;
    const frameCount = FRAME_COUNT[this.state] || 1;
    if (this.frameElapsed >= 1 / fps && frameCount > 1) {
      const steps = Math.floor(this.frameElapsed * fps);
      this.frameElapsed -= steps / fps;
      this.frame = (this.frame + steps) % frameCount;
      this.sprite.setTexture(this.ensureTexture(this.state, this.frame));
    }

    this.dirX = player.dirX ?? this.dirX;
    this.dirY = player.dirY ?? this.dirY;
    if (Math.abs(this.dirX) > 0.22) this.sprite.setFlipX(this.dirX < 0);
    const speed = Math.hypot(player.vx || 0, player.vy || 0);
    this.sprite.y = speed > 25 && !player.frozen ? -Math.abs(Math.sin(now * 0.015 + this.x * 0.02)) * 1.8 : 0;
    this.sprite.setAlpha(player.eliminated ? 0.55 : player.connected === false ? 0.5 : 1);

    const name = this.isLocal ? `${player.name} · YOU` : player.name;
    if (this.nameText.text !== name) this.nameText.setText(name);
    this.nameText.setColor(player.team === 'coral' ? '#ffb3bf' : player.team === 'azure' ? '#a8e9ff' : '#fff7e8');

    const marker = markerFor(player, this.modeId);
    if (marker) {
      this.marker.setVisible(true);
      const markerKey = `${marker.text}|${marker.bg}|${marker.color}`;
      if (this.lastMarker !== markerKey) {
        this.lastMarker = markerKey;
        this.marker.setText(marker.text);
        this.marker.setBackgroundColor(marker.bg);
        this.marker.setColor(marker.color);
      }
    } else {
      this.marker.setVisible(false);
      this.lastMarker = '';
    }
  }

  deriveState(player) {
    if (player.eliminated) return 'defeat';
    if (player.frozen) return 'frozen';
    const speed = Math.hypot(player.vx || 0, player.vy || 0);
    if (player.sprinting && speed > 120) return 'sprinting';
    if (speed > 140) return 'running';
    if (speed > 20) return 'walking';
    return 'idle';
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.container.setPosition(Math.round(x), Math.round(y));
    this.container.setDepth(Math.round(y) + 80);
  }

  setHighlight(active, color = 0xffd166) {
    if (!this.highlight) return;
    if (active && this.quality.glow !== false) {
      if (this.highlightColor !== color) {
        this.highlight.clear();
        this.highlight.lineStyle(3, color, 0.9);
        this.highlight.strokeEllipse(0, 4, 48, 18);
        this.highlightColor = color;
      }
      this.highlight.setVisible(true);
    } else {
      this.highlight.setVisible(false);
    }
  }

  setPromptable(active) {
    this.setHighlight(active, 0xffd166);
  }

  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible;
    this.container.setVisible(visible);
  }

  destroy() {
    this.container.destroy(true);
  }
}
