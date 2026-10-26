import { getMap } from '@shared/maps.js';

function tint(color, amount) {
  const r = Math.min(255, Math.max(0, ((color >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (color & 255) + amount));
  return (r << 16) | (g << 8) | b;
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
    g.fillStyle(0x060918, 1);
    g.fillRect(-400, -400, map.width + 800, map.height + 800);
    g.fillStyle(theme.background, 1);
    g.fillRect(0, 0, map.width, map.height);
    g.fillStyle(theme.floor, 1);
    g.fillRoundedRect(14, 14, map.width - 28, map.height - 28, 28);

    if (map.id === 'neon') {
      g.fillStyle(theme.floorAlt, 0.75);
      g.fillRect(28, 28, map.width - 56, map.height - 56);
      g.lineStyle(1, theme.accent, 0.09);
      for (let x = 0; x < map.width; x += 64) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, map.height);
        g.strokePath();
      }
      for (let y = 0; y < map.height; y += 64) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(map.width, y);
        g.strokePath();
      }
      for (let x = 0; x < map.width; x += 256) {
        for (let y = 0; y < map.height; y += 256) {
          g.lineStyle(1, theme.accent, 0.06);
          g.strokeCircle(x, y, 90);
        }
      }
    } else {
      g.fillStyle(theme.floorAlt, 0.25);
      for (let x = 32; x < map.width; x += 144) {
        for (let y = 32; y < map.height; y += 144) {
          if (((x / 144) + (y / 144)) % 2 < 1) g.fillRect(x, y, 144, 144);
        }
      }
    }

    for (const path of map.paths || []) {
      const isNeon = path.type === 'neonpath';
      g.fillStyle(isNeon ? 0x0c1730 : 0xd8b987, isNeon ? 0.9 : 0.24);
      g.fillRoundedRect(path.x, path.y, path.w, path.h, 24);
      if (isNeon) {
        g.lineStyle(2, theme.accent, 0.36);
        g.strokeRoundedRect(path.x, path.y, path.w, path.h, 24);
        g.lineStyle(1, 0xffffff, 0.1);
        g.strokeRoundedRect(path.x + 5, path.y + 5, path.w - 10, path.h - 10, 20);
      } else {
        g.fillStyle(0xffffff, 0.04);
        g.fillRoundedRect(path.x + 8, path.y + 8, path.w - 16, path.h - 16, 16);
      }
    }

    for (const wall of map.walls) {
      this.drawWall(g, wall);
    }

    for (const zone of map.zones || []) {
      const label = this.scene.add.text(zone.x, zone.y, zone.label, {
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: map.id === 'neon' ? '#8ef9e8' : '#f7efd8',
        letterSpacing: 4,
        align: 'center'
      });
      label.setOrigin(0.5);
      label.setAlpha(map.id === 'neon' ? 0.23 : 0.18);
      label.setDepth(2);
      this.root.add(label);
    }

    for (const landmark of map.landmarks || []) {
      const label = this.scene.add.text(landmark.x, landmark.y + 38, landmark.label, {
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
        fontSize: '11px',
        fontStyle: '650',
        color: map.id === 'neon' ? '#65e7d9' : '#243c31',
        backgroundColor: map.id === 'neon' ? '#0a1730cc' : '#f7efd8aa',
        padding: { x: 7, y: 3 },
        align: 'center'
      });
      label.setOrigin(0.5);
      label.setAlpha(0.7);
      label.setDepth(3);
      this.root.add(label);
    }

    if (this.quality.glow && map.id === 'neon') {
      const rim = this.scene.add.graphics();
      rim.lineStyle(7, theme.accent, 0.15);
      rim.strokeRoundedRect(12, 12, map.width - 24, map.height - 24, 30);
      rim.setDepth(1);
      this.root.add(rim);
    }
  }

  drawWall(g, wall) {
    const t = this.map.theme;
    const { x, y, w, h, type } = wall;
    const shadowOffset = this.quality.shadows === false ? 0 : 5;
    if (shadowOffset) {
      g.fillStyle(0x08101a, 0.22);
      g.fillRoundedRect(x + shadowOffset, y + shadowOffset, w, h, type === 'tree' || type === 'pond' ? Math.min(w, h) * 0.45 : 8);
    }
    if (type === 'boundary') {
      if (['playground', 'park'].includes(this.map.id)) {
        g.fillStyle(0x34432f, 0.95);
        g.fillRect(x, y, w, h);
        g.fillStyle(0xa6d280, 0.55);
        const horizontal = w > h;
        const length = horizontal ? w : h;
        const step = 36;
        for (let i = 10; i < length; i += step) {
          const px = horizontal ? x + i : x + w / 2;
          const py = horizontal ? y + h / 2 : y + i;
          g.fillRect(px - 1.5, py - 7, 3, 14);
        }
      } else {
        g.fillStyle(t.wall, 1);
        g.fillRect(x, y, w, h);
        g.fillStyle(tint(t.wall, 18), 1);
        g.fillRect(x, y, w, Math.min(8, h));
      }
      return;
    }
    if (type === 'tree') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      g.fillStyle(0x624734, 1);
      g.fillRoundedRect(cx - 6, cy + h * 0.16, 12, h * 0.37, 5);
      const radius = Math.min(w, h) * 0.53;
      g.fillStyle(0x2d7046, 1);
      g.fillCircle(cx - radius * 0.38, cy + 4, radius * 0.7);
      g.fillCircle(cx + radius * 0.38, cy + 2, radius * 0.68);
      g.fillStyle(0x3b8b55, 1);
      g.fillCircle(cx, cy - radius * 0.28, radius * 0.8);
      g.fillStyle(0x64b66c, 1);
      g.fillCircle(cx - radius * 0.22, cy - radius * 0.42, radius * 0.38);
      g.fillStyle(0x8ed68c, 0.55);
      g.fillCircle(cx - radius * 0.38, cy - radius * 0.48, radius * 0.14);
      return;
    }
    if (type === 'pond') {
      g.fillStyle(0x6a5c3e, 1);
      g.fillRoundedRect(x, y, w, h, 58);
      g.fillStyle(0x3f95c6, 1);
      g.fillRoundedRect(x + 8, y + 8, w - 16, h - 16, 52);
      g.fillStyle(0x74cbea, 0.36);
      g.fillEllipse(x + w * 0.36, y + h * 0.3, w * 0.4, h * 0.2);
      g.lineStyle(2, 0xc8f6ff, 0.22);
      g.strokeEllipse(x + w * 0.54, y + h * 0.62, w * 0.44, h * 0.26);
      g.strokeEllipse(x + w * 0.7, y + h * 0.3, w * 0.18, h * 0.1);
      return;
    }
    if (['building', 'portable', 'shop'].includes(type)) {
      const roof = type === 'shop' ? t.wallTop : tint(t.wall, 16);
      g.fillStyle(t.wall, 1);
      g.fillRoundedRect(x, y, w, h, 10);
      g.fillStyle(roof, 1);
      g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 8);
      g.fillStyle(0x0a1021, 0.55);
      const cols = Math.max(2, Math.floor(w / 100));
      for (let i = 0; i < cols; i += 1) {
        const wx = x + 24 + i * ((w - 48) / cols);
        g.fillRoundedRect(wx, y + 26, Math.max(20, (w - 48) / cols - 18), 24, 4);
      }
      g.fillStyle(0x142032, 0.8);
      g.fillRoundedRect(x + w / 2 - 18, y + h - 42, 36, 42, 5);
      g.fillStyle(t.accent, 0.65);
      g.fillRect(x + w / 2 - 2, y + h - 24, 4, 8);
      return;
    }
    if (type === 'kiosk') {
      g.fillStyle(t.wall, 1);
      g.fillRoundedRect(x, y, w, h, 13);
      g.fillStyle(t.wallTop, 1);
      g.fillRoundedRect(x + 5, y + 5, w - 10, h * 0.54, 9);
      g.fillStyle(t.accent, 0.28);
      for (let i = 0; i < 5; i += 1) {
        g.fillRoundedRect(x + 18 + i * ((w - 36) / 5), y + 10, (w - 60) / 5, h * 0.34, 3);
      }
      g.fillStyle(0x0d1428, 0.65);
      g.fillRect(x + 12, y + h * 0.68, w - 24, 5);
      return;
    }
    if (type === 'neon') {
      g.fillStyle(0x121a43, 1);
      g.fillRoundedRect(x, y, w, h, 7);
      g.lineStyle(5, t.accent, 0.34);
      g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 5);
      g.lineStyle(1.5, 0x9bffe9, 0.8);
      g.strokeRoundedRect(x + 7, y + 7, w - 14, h - 14, 4);
      g.lineStyle(2, 0xd6b4ff, 0.24);
      g.beginPath();
      g.moveTo(x + w * 0.3, y + h / 2);
      g.lineTo(x + w * 0.5, y + h * 0.28);
      g.lineTo(x + w * 0.7, y + h / 2);
      g.strokePath();
      return;
    }
    if (type === 'slide') {
      g.fillStyle(0x38667e, 1);
      g.fillRoundedRect(x, y + h * 0.28, w * 0.72, h * 0.5, 8);
      g.fillStyle(0xffc857, 1);
      g.fillRoundedRect(x + w * 0.18, y, w * 0.55, h * 0.53, 10);
      g.fillStyle(0xec7f63, 1);
      g.fillRoundedRect(x + w * 0.62, y + h * 0.15, w * 0.3, h * 0.7, 8);
      g.lineStyle(3, 0xfff0c7, 0.35);
      g.beginPath();
      g.moveTo(x + w * 0.7, y + h * 0.28);
      g.lineTo(x + w * 0.84, y + h * 0.65);
      g.strokePath();
      return;
    }
    if (type === 'swing') {
      g.fillStyle(0x6c5140, 1);
      g.fillRoundedRect(x + 4, y + 10, 10, h + 8, 5);
      g.fillRoundedRect(x + w - 14, y + 10, 10, h + 8, 5);
      g.fillStyle(0xd6a34d, 1);
      g.fillRoundedRect(x + 6, y, w - 12, 9, 4);
      g.lineStyle(2, 0x514438, 0.8);
      for (let i = 0; i < 2; i += 1) {
        const sx = x + w * 0.36 + i * w * 0.28;
        g.beginPath();
        g.moveTo(sx, y + 7);
        g.lineTo(sx, y + h + 10);
        g.strokePath();
        g.fillStyle(0xff8a65, 1);
        g.fillRoundedRect(sx - 13, y + h + 6, 26, 8, 4);
      }
      return;
    }
    if (type === 'bench') {
      g.fillStyle(0x5d412c, 1);
      g.fillRoundedRect(x, y, w, h, 5);
      g.fillStyle(0xb88554, 1);
      g.fillRoundedRect(x + 3, y + 2, w - 6, h - 8, 4);
      g.fillStyle(0x3f2d21, 1);
      g.fillRect(x + 10, y + h - 2, 8, 6);
      g.fillRect(x + w - 18, y + h - 2, 8, 6);
      return;
    }
    if (type === 'playhouse') {
      g.fillStyle(0x7d4b3c, 1);
      g.fillRoundedRect(x, y, w, h, 8);
      g.fillStyle(0xc96e4d, 1);
      g.fillTriangle(x - 8, y + 2, x + w / 2, y - 45, x + w + 8, y + 2);
      g.fillStyle(0x1b2237, 0.75);
      g.fillRoundedRect(x + w / 2 - 22, y + h - 72, 44, 72, 5);
      g.fillStyle(0xffd36b, 1);
      g.fillCircle(x + 26, y + h / 2, 8);
      return;
    }
    if (type === 'sandbox') {
      g.fillStyle(0x8d6a43, 1);
      g.fillRoundedRect(x, y, w, h, 5);
      g.fillStyle(0xd8c28d, 1);
      g.fillRoundedRect(x + 7, y + 7, w - 14, h - 14, 4);
      g.fillStyle(0xbc9d64, 0.45);
      g.fillCircle(x + w * 0.35, y + h * 0.42, 9);
      g.fillCircle(x + w * 0.68, y + h * 0.65, 6);
      return;
    }
    if (type === 'planter') {
      g.fillStyle(0x715337, 1);
      g.fillRoundedRect(x, y, w, h, 5);
      g.fillStyle(0x3e7d4d, 1);
      g.fillCircle(x + w / 2, y + h / 2, w * 0.37);
      g.fillStyle(0x7fc66f, 1);
      g.fillCircle(x + w * 0.35, y + h * 0.35, w * 0.18);
      return;
    }
    if (type === 'fountain') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      g.fillStyle(0x6b7388, 1);
      g.fillEllipse(cx, cy, w, h);
      g.fillStyle(0x55b8d8, 1);
      g.fillEllipse(cx, cy, w * 0.75, h * 0.62);
      g.fillStyle(0xb9f3ff, 0.55);
      g.fillEllipse(cx, cy, w * 0.32, h * 0.2);
      g.lineStyle(2, 0xe6fdff, 0.3);
      g.strokeEllipse(cx, cy, w * 0.58, h * 0.42);
      return;
    }
    if (type === 'gazebo') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      g.fillStyle(0x7d6045, 1);
      g.fillCircle(cx, cy, Math.min(w, h) * 0.49);
      g.fillStyle(0xae865c, 1);
      g.fillCircle(cx, cy, Math.min(w, h) * 0.39);
      g.lineStyle(2, 0xd5b78c, 0.5);
      for (let i = 0; i < 8; i += 1) {
        const angle = (i * Math.PI * 2) / 8;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(angle) * Math.min(w, h) * 0.47, cy + Math.sin(angle) * Math.min(w, h) * 0.47);
        g.strokePath();
      }
      g.fillStyle(0x5b4531, 1);
      g.fillCircle(cx, cy, 7);
      return;
    }
    g.fillStyle(t.wallTop, 1);
    g.fillRoundedRect(x, y, w, h, 7);
  }
}
