import { CHARACTER_MAP, PALETTE_MAP } from '@shared/constants.js';

const C = {
  outline: '#171324',
  eye: '#221827',
  white: '#fff8ef'
};

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRound(ctx, x, y, width, height, radius, fill) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function capsule(ctx, x1, y1, x2, y2, width, fill) {
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawHair(ctx, silhouette, palette) {
  const { hair, primary } = palette;
  ctx.fillStyle = hair;
  if (silhouette === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(41, 32);
    ctx.lineTo(38, 15);
    ctx.lineTo(50, 23);
    ctx.lineTo(58, 9);
    ctx.lineTo(64, 22);
    ctx.lineTo(76, 10);
    ctx.lineTo(79, 24);
    ctx.lineTo(91, 17);
    ctx.lineTo(86, 36);
    ctx.quadraticCurveTo(64, 22, 41, 32);
    ctx.fill();
  } else if (silhouette === 'round') {
    ctx.beginPath();
    ctx.arc(64, 32, 25, Math.PI * 1.03, Math.PI * 1.95);
    ctx.quadraticCurveTo(87, 48, 80, 57);
    ctx.lineTo(48, 57);
    ctx.quadraticCurveTo(40, 46, 41, 31);
    ctx.fill();
  } else if (silhouette === 'leaf') {
    ctx.beginPath();
    ctx.ellipse(64, 28, 24, 18, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(81, 20, 12, 8, 0.6, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.fill();
  } else if (silhouette === 'square') {
    fillRound(ctx, 42, 13, 45, 24, 5, hair);
    fillRound(ctx, 43, 27, 8, 13, 3, hair);
    fillRound(ctx, 79, 27, 8, 13, 3, hair);
  } else if (silhouette === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? 25 : 14;
      const x = 64 + Math.cos(angle) * radius;
      const y = 31 + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(64, 31, 24, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(91, 46, 84, 52);
    ctx.quadraticCurveTo(74, 36, 66, 54);
    ctx.quadraticCurveTo(54, 36, 46, 53);
    ctx.quadraticCurveTo(39, 43, 40, 31);
    ctx.fill();
    ctx.fillStyle = primary;
    fillRound(ctx, 81, 29, 17, 6, 3, primary);
  }
}

function drawAccessory(ctx, accessory, palette, state, frame) {
  const { hair, accent, secondary } = palette;
  if (accessory === 'cap') {
    ctx.fillStyle = palette.primary;
    ctx.beginPath();
    ctx.arc(64, 29, 24, Math.PI, Math.PI * 2);
    ctx.fill();
    fillRound(ctx, 59, 8, 13, 13, 5, palette.primary);
    fillRound(ctx, 72, 24, 27, 7, 3, palette.secondary);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(64, 8, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (accessory === 'headphones') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 31, 28, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    fillRound(ctx, 34, 28, 10, 19, 5, accent);
    fillRound(ctx, 84, 28, 10, 19, 5, accent);
    fillRound(ctx, 37, 33, 4, 9, 2, secondary);
    fillRound(ctx, 87, 33, 4, 9, 2, secondary);
  } else if (accessory === 'antenna') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(64, 13);
    ctx.quadraticCurveTo(71, 1, 80, 5);
    ctx.stroke();
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(81, 5, 4 + Math.sin(frame * 1.5) * 0.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (accessory === 'halo') {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(64, 4, 20, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(64, 4, 16, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (accessory === 'scarf') {
    fillRound(ctx, 43, 53, 42, 9, 4, accent);
    fillRound(ctx, 77, 57, 9, 27, 4, accent);
    ctx.fillStyle = secondary;
    fillRound(ctx, 77, 77, 9, 5, 2, secondary);
  }
}

function drawOutfit(ctx, outfit, palette, state) {
  const { primary, secondary, accent, skin } = palette;
  const bodyTop = 50;
  const bodyH = outfit === 'robe' ? 38 : 32;
  const armLift = state === 'victory' ? -29 : 0;
  capsule(ctx, 46, 58, 37, 82 + armLift, 11, skin);
  capsule(ctx, 82, 58, 91, 82 + armLift, 11, skin);
  capsule(ctx, 46, 58, 37, 76 + armLift, 11, palette.primary);
  capsule(ctx, 82, 58, 91, 76 + armLift, 11, palette.primary);
  ctx.fillStyle = C.outline;
  ctx.globalAlpha = 0.25;
  fillRound(ctx, 39, bodyTop + 1, 50, bodyH + 1, 15, C.outline);
  ctx.globalAlpha = 1;
  fillRound(ctx, 40, bodyTop, 48, bodyH, 15, primary);
  if (outfit === 'hoodie') {
    fillRound(ctx, 48, 64, 32, 15, 7, secondary);
    ctx.fillStyle = accent;
    ctx.fillRect(62, 54, 2, 26);
    fillRound(ctx, 44, 43, 40, 12, 8, secondary);
  } else if (outfit === 'varsity') {
    ctx.fillStyle = secondary;
    ctx.globalAlpha = 0.95;
    fillRound(ctx, 40, 50, 10, 20, 5, secondary);
    fillRound(ctx, 78, 50, 10, 20, 5, secondary);
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.font = 'bold 16px "Arial Rounded MT Bold", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('7', 64, 73);
    fillRound(ctx, 58, 53, 12, 3, 1, accent);
  } else if (outfit === 'jacket') {
    ctx.fillStyle = secondary;
    ctx.fillRect(62, 51, 4, 31);
    fillRound(ctx, 44, 58, 8, 18, 4, secondary);
    fillRound(ctx, 77, 58, 8, 18, 4, secondary);
    fillRound(ctx, 50, 76, 28, 4, 2, accent);
  } else if (outfit === 'robe') {
    ctx.fillStyle = secondary;
    fillRound(ctx, 42, 72, 44, 12, 5, secondary);
    fillRound(ctx, 56, 51, 16, 4, 2, accent);
  } else {
    fillRound(ctx, 55, 50, 18, 5, 2, secondary);
    fillRound(ctx, 40, 76, 48, 4, 2, secondary);
  }
  ctx.strokeStyle = 'rgba(20,16,35,0.3)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 40, bodyTop, 48, bodyH, 15);
  ctx.stroke();
}

export function drawCharacter(ctx, options = {}) {
  const {
    size = 128,
    profile = {},
    state = 'idle',
    frame = 0,
    time = 0,
    teamColor = null,
    isIt = false,
    colorBlind = false
  } = options;
  const palette = PALETTE_MAP[profile.paletteId] || PALETTE_MAP.sunset;
  const character = CHARACTER_MAP[profile.characterId] || CHARACTER_MAP.rascal;
  const accessory = profile.accessoryId || 'none';
  const outfit = profile.outfitId || 'tee';
  const scale = size / 128;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, 128, 128);

  const bob = state === 'walking' || state === 'running' || state === 'sprinting'
    ? Math.sin(time * 13 + frame * Math.PI) * 1.4
    : state === 'idle' ? Math.sin(time * 2.4) * 0.8 : 0;
  const victoryJump = state === 'victory' ? -Math.abs(Math.sin(time * 7)) * 9 : 0;
  const lean = state === 'sprinting' ? 3 : state === 'running' ? 1.5 : 0;
  const defeatSlump = state === 'defeat' ? 7 : 0;
  const legSwing = state === 'walking'
    ? Math.sin(time * 10 + frame * Math.PI) * 8
    : state === 'running' || state === 'sprinting'
      ? Math.sin(time * 17 + frame * Math.PI) * 13
      : 0;

  if (teamColor) {
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(64, 109, 33, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, bob + victoryJump + defeatSlump);
  if (lean) {
    ctx.translate(lean, 0);
    ctx.rotate((lean / 100));
  }

  const hipY = 82;
  const leftFoot = 104 - Math.max(0, legSwing);
  const rightFoot = 104 - Math.max(0, -legSwing);
  const pants = palette.hair;
  capsule(ctx, 53, hipY, 51 - legSwing * 0.35, leftFoot, 11, pants);
  capsule(ctx, 75, hipY, 77 + legSwing * 0.35, rightFoot, 11, pants);
  fillRound(ctx, 44, leftFoot - 2, 14, 7, 3, C.outline);
  fillRound(ctx, 70, rightFoot - 2, 14, 7, 3, C.outline);

  drawOutfit(ctx, outfit, palette, state);

  if (state === 'tagging') {
    ctx.save();
    ctx.translate(86, 65);
    ctx.rotate(-0.9);
    capsule(ctx, 0, 0, 24, -4, 11, palette.skin);
    capsule(ctx, 0, 0, 18, -4, 11, palette.primary);
    ctx.restore();
  } else if (state === 'victory') {
    capsule(ctx, 46, 58, 31, 35, 11, palette.skin);
    capsule(ctx, 82, 58, 97, 35, 11, palette.skin);
  } else if (state === 'tagged') {
    capsule(ctx, 46, 58, 29, 50, 11, palette.skin);
    capsule(ctx, 82, 58, 99, 50, 11, palette.skin);
  }

  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(64, 38, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 12, 24, 0.12)';
  ctx.beginPath();
  ctx.arc(64, 44, 19, 0.2, Math.PI - 0.2);
  ctx.fill();

  drawHair(ctx, character.silhouette, palette);

  const blink = Math.sin(time * 1.4) > 0.985;
  ctx.fillStyle = C.eye;
  if (blink) {
    ctx.fillRect(53, 38, 6, 1.5);
    ctx.fillRect(69, 38, 6, 1.5);
  } else {
    ctx.beginPath();
    ctx.ellipse(56, 38, 2.4, 3.1, 0, 0, Math.PI * 2);
    ctx.ellipse(72, 38, 2.4, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(56.8, 37, 0.8, 0, Math.PI * 2);
    ctx.arc(72.8, 37, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40, 20, 28, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(64, 45, 5, 0.25, Math.PI - 0.25);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 122, 146, 0.25)';
  ctx.beginPath();
  ctx.ellipse(48, 44, 4, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(80, 44, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  drawAccessory(ctx, accessory, palette, state, frame);

  if (state === 'sprinting' && frame % 2 === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(22 + i * 5, 68 + i * 9);
      ctx.lineTo(8 + i * 5, 68 + i * 9);
      ctx.stroke();
    }
  }

  ctx.restore();

  if (state === 'frozen') {
    ctx.fillStyle = 'rgba(120, 225, 255, 0.32)';
    roundRect(ctx, 28, 10, 72, 102, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(195, 248, 255, 0.82)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, 28, 10, 72, 102, 18);
    ctx.stroke();
    ctx.fillStyle = 'rgba(225, 252, 255, 0.85)';
    for (const [x, y, h] of [[35, 12, 12], [52, 10, 8], [88, 14, 11], [94, 100, 9]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5, y - h);
      ctx.lineTo(x + 10, y);
      ctx.fill();
    }
  }

  if (state === 'tagged') {
    ctx.strokeStyle = `rgba(255, 84, 112, ${0.65 + Math.sin(time * 18) * 0.2})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 62, 54, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state === 'victory') {
    ctx.fillStyle = palette.secondary;
    for (let i = 0; i < 5; i += 1) {
      const angle = time * 2 + (i * Math.PI * 2) / 5;
      const x = 64 + Math.cos(angle) * 46;
      const y = 54 + Math.sin(angle) * 36;
      ctx.globalAlpha = 0.55 + Math.sin(time * 3 + i) * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (state === 'defeat') {
    ctx.fillStyle = 'rgba(7, 10, 25, 0.4)';
    ctx.fillRect(0, 0, 128, 128);
  }

  if (isIt && colorBlind) {
    ctx.fillStyle = '#ff6b81';
    roundRect(ctx, 45, 1, 38, 13, 6);
    ctx.fill();
    ctx.fillStyle = '#2b0a12';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('IT', 64, 10.5);
  }

  ctx.restore();
}

export function drawAvatar(canvas, profile, size = 96) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  drawCharacter(ctx, {
    size: size * dpr,
    profile,
    state: 'idle',
    time: 0.7,
    frame: 0
  });
}

export function renderAvatarHtml(profile, size = 34, className = '') {
  return `<canvas class="avatar-canvas ${className}" data-avatar='${encodeURIComponent(JSON.stringify(profile || {}))}' width="${size}" height="${size}" aria-hidden="true"></canvas>`;
}

export function hydrateAvatars(root = document) {
  root.querySelectorAll('canvas[data-avatar]').forEach((canvas) => {
    let profile = {};
    try { profile = JSON.parse(decodeURIComponent(canvas.dataset.avatar)); } catch { profile = {}; }
    const size = Number(canvas.getAttribute('width')) || 34;
    drawAvatar(canvas, profile, size);
  });
}
