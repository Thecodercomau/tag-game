export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function distance(ax, ay, bx, by) {
  return Math.sqrt(distanceSq(ax, ay, bx, by));
}

export function normalize(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (length < 0.0001) return { x: 0, y: 0, length: 0 };
  return { x: dx / length, y: dy / length, length };
}

export function sanitizeText(value, maxLength = 140) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function circleRectOverlap(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  return distanceSq(cx, cy, nearestX, nearestY) < radius * radius;
}

export function circleRectResolve(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  let dx = cx - nearestX;
  let dy = cy - nearestY;
  let dist = Math.hypot(dx, dy);
  if (dist >= radius) return null;
  if (dist < 0.0001) {
    const left = Math.abs(cx - rect.x);
    const right = Math.abs(rect.x + rect.w - cx);
    const top = Math.abs(cy - rect.y);
    const bottom = Math.abs(rect.y + rect.h - cy);
    const min = Math.min(left, right, top, bottom);
    if (min === left) return { x: rect.x - radius, y: cy };
    if (min === right) return { x: rect.x + rect.w + radius, y: cy };
    if (min === top) return { x: cx, y: rect.y - radius };
    return { x: cx, y: rect.y + rect.h + radius };
  }
  dx /= dist;
  dy /= dist;
  return { x: nearestX + dx * radius, y: nearestY + dy * radius };
}

export function circleIntersectsRect(cx, cy, radius, rect) {
  return circleRectOverlap(cx, cy, radius, rect);
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pick(items, rng = Math.random) {
  if (!items.length) return null;
  return items[Math.floor(rng() * items.length)];
}

export function isPointInMap(x, y, map, padding = 0) {
  return x >= padding && y >= padding && x <= map.width - padding && y <= map.height - padding;
}

export function pointBlocked(x, y, map, radius = 0) {
  return map.walls.some((rect) => circleRectOverlap(x, y, radius, rect));
}

export function makeId(rng = Math.random, length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) result += alphabet[Math.floor(rng() * alphabet.length)];
  return result;
}

export function makeRoomCode(rng = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i += 1) result += alphabet[Math.floor(rng() * alphabet.length)];
  return result;
}

export function deepMerge(base, extra) {
  const result = { ...base };
  if (!extra || typeof extra !== 'object') return result;
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
