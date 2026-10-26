function cssColor(number, alpha = 1) {
  const hex = number.toString(16).padStart(6, '0');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const wallColors = {
  boundary: [30, 42, 49, 0.9],
  tree: [44, 120, 68, 1],
  pond: [75, 173, 220, 1],
  building: [56, 72, 91, 1],
  portable: [73, 93, 112, 1],
  shop: [83, 77, 120, 1],
  kiosk: [104, 93, 139, 1],
  neon: [54, 93, 210, 1],
  slide: [236, 165, 56, 1],
  swing: [219, 125, 74, 1],
  bench: [120, 81, 53, 1],
  playhouse: [154, 95, 75, 1],
  sandbox: [211, 185, 116, 1],
  planter: [76, 132, 92, 1],
  fountain: [91, 188, 221, 1],
  gazebo: [126, 99, 77, 1]
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
  ctx.fillStyle = cssColor(map.theme.background);
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.fillStyle = cssColor(map.theme.floor);
  ctx.fillRect(0, 0, map.width, map.height);
  ctx.fillStyle = cssColor(map.theme.floorAlt, 0.35);
  for (let x = 0; x < map.width; x += 160) {
    for (let y = 0; y < map.height; y += 160) {
      if ((x / 160 + y / 160) % 2 === 0) ctx.fillRect(x, y, 160, 160);
    }
  }
  for (const path of map.paths || []) {
    ctx.fillStyle = path.type === 'neonpath' ? 'rgba(69, 246, 224, 0.18)' : 'rgba(255, 238, 196, 0.19)';
    ctx.beginPath();
    ctx.roundRect(path.x, path.y, path.w, path.h, 22);
    ctx.fill();
  }
  for (const wall of map.walls) {
    const color = wallColors[wall.type] || wallColors.boundary;
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    ctx.beginPath();
    const radius = wall.type === 'tree' || wall.type === 'pond' ? Math.min(wall.w, wall.h) * 0.45 : 5;
    ctx.roundRect(wall.x, wall.y, wall.w, wall.h, radius);
    ctx.fill();
    if (wall.type === 'tree') {
      ctx.fillStyle = 'rgba(160, 229, 140, 0.35)';
      ctx.beginPath();
      ctx.arc(wall.x + wall.w * 0.42, wall.y + wall.h * 0.4, Math.min(wall.w, wall.h) * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    if (wall.type === 'neon') {
      ctx.strokeStyle = 'rgba(69, 246, 224, 0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }
  for (const spawn of map.spawns) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(spawn.x, spawn.y, 13, 0, Math.PI * 2);
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
