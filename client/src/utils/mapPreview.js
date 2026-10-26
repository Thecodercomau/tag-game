function cssColor(number, alpha = 1) {
  const hex = number.toString(16).padStart(6, '0');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const platformColors = {
  ground: [36, 58, 44, 1],
  grass: [64, 125, 71, 1],
  stone: [104, 112, 112, 1],
  roof: [72, 91, 111, 1],
  slide: [236, 165, 56, 1],
  bench: [120, 81, 53, 1],
  shop: [83, 77, 120, 1],
  kiosk: [104, 93, 139, 1],
  neon: [49, 132, 180, 1],
  planter: [76, 132, 92, 1],
  sandbox: [211, 185, 116, 1],
  ledge: [86, 105, 89, 1]
};

export function renderMapPreview(canvas, map, width = 240, height = 150) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const scale = Math.min(width / map.width, height / map.height);
  const offsetX = (width - map.width * scale) / 2;
  const offsetY = (height - map.height * scale) / 2;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, cssColor(map.theme.skyTop || map.theme.sky));
  sky.addColorStop(1, cssColor(map.theme.skyBottom || map.theme.sky));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const ground = map.platforms.find((platform) => platform.type === 'ground');
  const groundTop = ground?.y ?? map.height - 100;
  ctx.fillStyle = cssColor(map.theme.floor, 0.24);
  ctx.beginPath();
  ctx.ellipse(map.width * 0.28, groundTop - 20, map.width * 0.3, 200, 0, 0, Math.PI * 2);
  ctx.ellipse(map.width * 0.76, groundTop - 10, map.width * 0.28, 170, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const platform of map.platforms) {
    const isGround = platform.type === 'ground';
    const color = platformColors[platform.type] || platformColors.ledge;
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    const radius = isGround ? 0 : 4;
    ctx.beginPath();
    ctx.roundRect(platform.x, platform.y, platform.w, platform.h, radius);
    ctx.fill();
    ctx.fillStyle = cssColor(map.theme.platformTop, 0.75);
    ctx.fillRect(platform.x, platform.y, platform.w, Math.max(2, platform.h * 0.22));
    if (platform.type === 'neon') {
      ctx.strokeStyle = cssColor(map.theme.accent, 0.65);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(platform.x + 4, platform.y);
      ctx.lineTo(platform.x + platform.w - 4, platform.y);
      ctx.stroke();
    }
  }

  for (const spawn of map.spawns) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(spawn.x, spawn.y - 6, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

export function mapPreviewMarkup(map, { selected = false } = {}) {
  return `
    <button class="map-card ${selected ? 'is-selected' : ''}" data-map-id="${map.id}" type="button" aria-pressed="${selected}">
      <canvas class="map-thumb" data-preview-map="${map.id}" width="240" height="150" aria-hidden="true"></canvas>
      <span class="map-card-info"><b>${map.name}</b><span>${map.subtitle}</span></span>
    </button>
  `;
}

export function hydrateMapPreviews(root, maps) {
  root.querySelectorAll('canvas[data-preview-map]').forEach((canvas) => {
    const map = maps.find((entry) => entry.id === canvas.dataset.previewMap);
    if (map) renderMapPreview(canvas, map);
  });
}
