import { getMap } from '@shared/maps.js';

function mixColor(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function lighten(color, amount) {
  return mixColor(color, 0xffffff, amount);
}

function darken(color, amount) {
  return mixColor(color, 0x000000, amount);
}

export class MapRenderer {
  constructor(scene, mapId, graphics = {}) {
    this.scene = scene;
    this.map = getMap(mapId);
    this.quality = graphics;
    this.root = scene.add.container(0, 0);
    this.root.setDepth(0);
    this.draw();
  }

  draw() {
    const map = this.map;
    const theme = map.theme;
    const g = this.scene.add.graphics();
    this.root.add(g);

    this.drawSky(g);
    this.drawBackdrop(g);
    for (const decor of map.decor || []) this.drawBackgroundDecor(g, decor);
    for (const platform of map.platforms || []) this.drawPlatform(g, platform);
    for (const decor of map.decor || []) this.drawForegroundDecor(g, decor);
    this.drawLabels();
  }

  drawSky(g) {
    const map = this.map;
    const theme = map.theme;
    g.fillStyle(0x05070f, 1);
    g.fillRect(-600, -600, map.width + 1200, map.height + 1200);
    const bands = 30;
    const horizon = (map.platforms?.find((platform) => platform.type === 'ground')?.y || map.height - 100) - 80;
    for (let index = 0; index < bands; index += 1) {
      const t = index / (bands - 1);
      const color = mixColor(theme.skyTop || theme.sky, theme.skyBottom || theme.sky, t);
      const y = (horizon / bands) * index;
      g.fillStyle(color, 1);
      g.fillRect(0, y, map.width, horizon / bands + 2);
    }
    if (map.id === 'neon') {
      g.fillStyle(0xfff2b0, 0.9);
      g.fillCircle(map.width * 0.78, 155, 46);
      g.fillStyle(0xfff2b0, 0.12);
      g.fillCircle(map.width * 0.78, 155, 92);
    } else {
      g.fillStyle(0xfff5c4, 0.82);
      g.fillCircle(map.width * 0.16, 145, 44);
      g.fillStyle(0xfff5c4, 0.13);
      g.fillCircle(map.width * 0.16, 145, 96);
    }
  }

  drawBackdrop(g) {
    const map = this.map;
    const theme = map.theme;
    const groundTop = (map.platforms?.find((platform) => platform.type === 'ground')?.y || map.height - 100);
    if (map.id === 'neon') {
      for (let index = 0; index < 16; index += 1) {
        const x = (index * 241 + 70) % map.width;
        const height = 180 + ((index * 89) % 260);
        const width = 90 + ((index * 53) % 110);
        const color = mixColor(theme.wall, 0x050817, 0.55 + (index % 3) * 0.1);
        g.fillStyle(color, 0.9);
        g.fillRect(x, groundTop - height, width, height);
        g.fillStyle(theme.accent, 0.24);
        for (let wy = groundTop - height + 24; wy < groundTop - 20; wy += 38) {
          for (let wx = x + 16; wx < x + width - 16; wx += 28) {
            if ((wx + wy) % 3 < 2) g.fillRect(wx, wy, 8, 12);
          }
        }
      }
      g.fillStyle(theme.accent, 0.07);
      g.fillRect(0, groundTop - 420, map.width, 420);
    } else {
      for (let index = 0; index < 11; index += 1) {
        const x = (index * 347 + 120) % map.width;
        const radius = 140 + ((index * 61) % 120);
        g.fillStyle(mixColor(theme.skyBottom || theme.sky, theme.floor, 0.36), 0.7);
        g.fillEllipse(x, groundTop - 10, radius * 2.4, radius);
      }
      g.fillStyle(mixColor(theme.skyBottom || theme.sky, theme.floor, 0.2), 0.45);
      g.fillRect(0, groundTop - 230, map.width, 230);
    }
  }

  drawBackgroundDecor(g, decor) {
    const theme = this.map.theme;
    if (decor.type === 'cloud') {
      const s = decor.s || 1;
      g.fillStyle(theme.cloud, 0.45);
      g.fillEllipse(decor.x, decor.y + 14, 190 * s, 40 * s);
      g.fillStyle(theme.cloud, 0.62);
      g.fillEllipse(decor.x - 54 * s, decor.y + 8, 100 * s, 42 * s);
      g.fillEllipse(decor.x + 52 * s, decor.y + 5, 122 * s, 54 * s);
      g.fillEllipse(decor.x + 6 * s, decor.y - 12, 96 * s, 50 * s);
      return;
    }
    if (decor.type === 'hill') {
      const s = decor.s || 1;
      g.fillStyle(mixColor(theme.floor, theme.wall, 0.32), 0.75);
      g.fillEllipse(decor.x, decor.y + 30, 560 * s, 260 * s);
      g.fillStyle(mixColor(theme.floor, theme.skyBottom || theme.sky, 0.32), 0.45);
      g.fillEllipse(decor.x - 110 * s, decor.y + 4, 300 * s, 160 * s);
      return;
    }
    if (decor.type === 'building') {
      const s = decor.s || 1;
      const width = 230 * s;
      const height = 330 * s;
      g.fillStyle(darken(theme.wall, 0.2), 0.65);
      g.fillRoundedRect(decor.x - width / 2, decor.y - height, width, height, 12);
      g.fillStyle(lighten(theme.wall, 0.12), 0.4);
      g.fillRoundedRect(decor.x - width / 2 + 10, decor.y - height + 10, width - 20, height - 20, 8);
      g.fillStyle(theme.accent, 0.28);
      for (let wy = decor.y - height + 34; wy < decor.y - 24; wy += 50) {
        for (let wx = decor.x - width / 2 + 26; wx < decor.x + width / 2 - 26; wx += 54) {
          g.fillRoundedRect(wx, wy, 24, 26, 3);
        }
      }
      return;
    }
    if (decor.type === 'tower') {
      const s = decor.s || 1;
      const width = 210 * s;
      const height = 430 * s;
      g.fillStyle(darken(theme.wall, 0.35), 0.9);
      g.fillRect(decor.x - width / 2, decor.y - height, width, height);
      g.fillStyle(theme.accent, 0.12);
      for (let wy = decor.y - height + 30; wy < decor.y - 20; wy += 44) {
        g.fillRect(decor.x - width / 2 + 18, wy, width - 36, 5);
      }
      return;
    }
    if (decor.type === 'star') {
      const s = decor.s || 1;
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(decor.x, decor.y, 2.4 * s);
      g.fillStyle(theme.accent, 0.18);
      g.fillCircle(decor.x, decor.y, 12 * s);
    }
  }

  drawForegroundDecor(g, decor) {
    const theme = this.map.theme;
    if (decor.type === 'tree') {
      const s = decor.s || 1;
      g.fillStyle(0x5a4030, 1);
      g.fillRoundedRect(decor.x - 9 * s, decor.y - 120 * s, 18 * s, 124 * s, 6);
      g.fillStyle(0x2f7247, 1);
      g.fillCircle(decor.x - 32 * s, decor.y - 138 * s, 50 * s);
      g.fillCircle(decor.x + 34 * s, decor.y - 144 * s, 54 * s);
      g.fillStyle(0x3f8b58, 1);
      g.fillCircle(decor.x, decor.y - 182 * s, 62 * s);
      g.fillStyle(0x6eb66b, 1);
      g.fillCircle(decor.x - 20 * s, decor.y - 204 * s, 30 * s);
      g.fillStyle(0xa0dd8c, 0.65);
      g.fillCircle(decor.x - 30 * s, decor.y - 216 * s, 12 * s);
      return;
    }
    if (decor.type === 'bush') {
      const s = decor.s || 1;
      g.fillStyle(0x2f7247, 1);
      g.fillEllipse(decor.x - 28 * s, decor.y - 20 * s, 82 * s, 54 * s);
      g.fillEllipse(decor.x + 28 * s, decor.y - 18 * s, 94 * s, 58 * s);
      g.fillStyle(0x4c965e, 1);
      g.fillEllipse(decor.x, decor.y - 40 * s, 86 * s, 62 * s);
      g.fillStyle(0x86cf76, 0.7);
      g.fillEllipse(decor.x - 18 * s, decor.y - 52 * s, 30 * s, 16 * s);
      return;
    }
    if (decor.type === 'lamp') {
      const s = decor.s || 1;
      g.fillStyle(0x28302f, 0.9);
      g.fillRect(decor.x - 3 * s, decor.y - 190 * s, 6 * s, 190 * s);
      g.fillStyle(theme.accent, 0.22);
      g.fillCircle(decor.x, decor.y - 200 * s, 44 * s);
      g.fillStyle(0xfff2b8, 1);
      g.fillCircle(decor.x, decor.y - 200 * s, 12 * s);
      return;
    }
    if (decor.type === 'sign') {
      const s = decor.s || 1;
      g.fillStyle(0x4d3a2b, 1);
      g.fillRect(decor.x - 4 * s, decor.y - 74 * s, 8 * s, 74 * s);
      g.fillStyle(lighten(theme.accent, 0.2), 1);
      g.fillRoundedRect(decor.x - 62 * s, decor.y - 118 * s, 124 * s, 50 * s, 9);
      g.lineStyle(2, darken(theme.accent, 0.25), 0.7);
      g.strokeRoundedRect(decor.x - 58 * s, decor.y - 114 * s, 116 * s, 42 * s, 7);
      return;
    }
    if (decor.type === 'neon') {
      const s = decor.s || 1;
      g.lineStyle(4 * s, theme.accent, 0.55);
      g.strokeRoundedRect(decor.x - 70 * s, decor.y - 34 * s, 140 * s, 58 * s, 8);
      g.lineStyle(1.5 * s, lighten(theme.accent, 0.5), 0.85);
      g.strokeRoundedRect(decor.x - 64 * s, decor.y - 28 * s, 128 * s, 46 * s, 5);
    }
  }

  drawPlatform(g, platform) {
    const theme = this.map.theme;
    const { x, y, w, h, type } = platform;
    const isGround = type === 'ground';
    if (isGround) {
      g.fillStyle(darken(theme.platformSide, 0.22), 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(theme.platform, 1);
      g.fillRect(x, y, w, Math.min(h, 34));
      g.fillStyle(theme.platformTop, 1);
      g.fillRect(x, y, w, 8);
      g.fillStyle(lighten(theme.platformTop, 0.22), 0.5);
      g.fillRect(x, y, w, 3);
      if (this.quality.textures !== false) {
        for (let stripe = 24; stripe < w; stripe += 92) {
          g.fillStyle(darken(theme.platform, 0.1), 0.35);
          g.fillRect(x + stripe, y + 34, 46, 4);
        }
      }
      return;
    }

    const sideColor = type === 'neon' ? 0x0b1230 : type === 'shop' || type === 'kiosk' ? darken(theme.platformSide, 0.08) : theme.platformSide;
    const bodyColor = type === 'grass' ? theme.platform : type === 'slide' ? 0x38667e : type === 'bench' ? 0x6e4d32 : type === 'neon' ? theme.platform : theme.platform;
    const topColor = type === 'grass' ? lighten(theme.platformTop, 0.12) : type === 'stone' ? lighten(theme.platformTop, 0.08) : type === 'neon' ? theme.accent : theme.platformTop;

    if (type === 'roof' || type === 'shop' || type === 'kiosk') {
      g.fillStyle(darken(theme.wall, 0.3), 0.22);
      g.fillRect(x + 22, y + h, 10, Math.max(0, this.map.height - 100 - y - h));
      g.fillRect(x + w - 32, y + h, 10, Math.max(0, this.map.height - 100 - y - h));
    }

    g.fillStyle(0x05080f, this.quality.shadows === false ? 0 : 0.18);
    if (this.quality.shadows !== false) g.fillRoundedRect(x + 5, y + 9, w, h, 4);
    g.fillStyle(sideColor, 1);
    g.fillRoundedRect(x, y + 5, w, h + 4, 4);
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(x, y, w, h, 4);
    g.fillStyle(topColor, 1);
    g.fillRect(x, y, w, 7);
    g.fillStyle(lighten(topColor, 0.3), 0.55);
    g.fillRect(x, y, w, 2);

    if (type === 'grass' || type === 'ground') {
      g.fillStyle(lighten(theme.platformTop, 0.12), 0.8);
      for (let blade = x + 8; blade < x + w - 6; blade += 19) {
        g.fillRect(blade, y - 4 - ((blade / 19) % 3), 3, 5 + ((blade / 19) % 3));
      }
    } else if (type === 'slide') {
      g.fillStyle(0xffc857, 1);
      g.fillRoundedRect(x + 10, y - 2, w * 0.42, 8, 4);
      g.fillStyle(0xec7f63, 1);
      g.fillRoundedRect(x + w * 0.58, y + 2, w * 0.3, 6, 3);
      g.lineStyle(2, 0xfff0c7, 0.32);
      g.beginPath();
      g.moveTo(x + 16, y + 14);
      g.lineTo(x + w * 0.38, y + 14);
      g.strokePath();
    } else if (type === 'bench') {
      g.fillStyle(0xb88554, 0.95);
      g.fillRect(x + 8, y + 6, w - 16, 4);
      g.fillStyle(0x3f2d21, 0.85);
      g.fillRect(x + 18, y + h - 4, 7, 8);
      g.fillRect(x + w - 26, y + h - 4, 7, 8);
    } else if (type === 'neon') {
      if (this.quality.glow !== false) {
        g.lineStyle(8, theme.accent, 0.14);
        g.strokeRoundedRect(x - 3, y - 3, w + 6, h + 10, 6);
      }
      g.lineStyle(2, lighten(theme.accent, 0.45), 0.9);
      g.beginPath();
      g.moveTo(x + 6, y + 1);
      g.lineTo(x + w - 6, y + 1);
      g.strokePath();
      g.fillStyle(theme.accent, 0.32);
      for (let light = x + 14; light < x + w - 10; light += 34) {
        g.fillRect(light, y + h - 6, 10, 3);
      }
    } else if (type === 'shop' || type === 'kiosk') {
      const stripeColor = type === 'shop' ? theme.accent : lighten(theme.accent, 0.28);
      g.fillStyle(stripeColor, 0.55);
      for (let stripe = x + 12; stripe < x + w - 12; stripe += 26) {
        g.fillRect(stripe, y + 10, 12, 4);
      }
      g.fillStyle(0x0a1021, 0.35);
      g.fillRect(x + 10, y + h - 6, w - 20, 4);
    } else if (type === 'planter') {
      g.fillStyle(0x4f8e52, 1);
      for (let plant = x + 12; plant < x + w - 8; plant += 18) {
        g.fillCircle(plant, y - 5, 8);
      }
      g.fillStyle(0x8bd477, 0.8);
      for (let plant = x + 18; plant < x + w - 8; plant += 26) {
        g.fillCircle(plant, y - 9, 4);
      }
    } else if (type === 'sandbox') {
      g.fillStyle(0xd8c28d, 1);
      g.fillRect(x + 4, y, w - 8, 5);
      g.fillStyle(0xbc9d64, 0.5);
      g.fillCircle(x + w * 0.35, y + 4, 4);
    } else if (type === 'stone') {
      g.fillStyle(lighten(theme.platformTop, 0.06), 0.8);
      for (let stone = x + 14; stone < x + w - 12; stone += 48) {
        g.fillRect(stone, y + 12, 26, 3);
      }
    }
  }

  drawLabels() {
    const map = this.map;
    const theme = map.theme;
    const labelColor = map.id === 'neon' ? '#8ef9e8' : '#fff8e6';
    for (const zone of map.zones || []) {
      const label = this.scene.add.text(zone.x, zone.y, zone.label, {
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: labelColor,
        letterSpacing: 5,
        align: 'center'
      });
      label.setOrigin(0.5);
      label.setAlpha(map.id === 'neon' ? 0.22 : 0.16);
      label.setDepth(2);
      this.root.add(label);
    }
    for (const landmark of map.landmarks || []) {
      const label = this.scene.add.text(landmark.x, landmark.y - 16, landmark.label, {
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
        fontSize: '11px',
        fontStyle: '650',
        color: map.id === 'neon' ? '#65e7d9' : '#243c31',
        backgroundColor: map.id === 'neon' ? '#0a1730cc' : '#fff8e6aa',
        padding: { x: 7, y: 3 },
        align: 'center'
      });
      label.setOrigin(0.5);
      label.setAlpha(0.72);
      label.setDepth(3);
      this.root.add(label);
    }
    for (const decor of map.decor || []) {
      if (!decor.label) continue;
      const label = this.scene.add.text(decor.x, decor.y - 100 * (decor.s || 1), decor.label, {
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
        fontSize: `${Math.round(13 * (decor.s || 1))}px`,
        fontStyle: '800',
        color: map.id === 'neon' ? '#5ff8e2' : '#3d3021',
        align: 'center'
      });
      label.setOrigin(0.5);
      label.setDepth(3);
      this.root.add(label);
    }
  }
}
