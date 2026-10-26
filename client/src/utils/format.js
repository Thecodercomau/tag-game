import { GAME_MODES, MODE_MAP, CHARACTER_MAP, PALETTE_MAP } from '@shared/constants.js';
import { MAP_MAP, MAPS } from '@shared/maps.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatClock(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  return minutes ? `${minutes}m ${total % 60}s` : `${total}s`;
}

export function modeInfo(id) {
  return MODE_MAP[id] || MODE_MAP.classic;
}

export function modeList() {
  return GAME_MODES;
}

export function mapInfo(id) {
  return MAP_MAP[id] || MAP_MAP.playground;
}

export function mapList() {
  return MAPS;
}

export function characterInfo(id) {
  return CHARACTER_MAP[id] || CHARACTER_MAP.rascal;
}

export function paletteInfo(id) {
  return PALETTE_MAP[id] || PALETTE_MAP.sunset;
}

export function keyLabel(code) {
  if (!code) return '—';
  return String(code)
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('Arrow', '')
    .replace('ShiftLeft', 'L Shift')
    .replace('ShiftRight', 'R Shift')
    .replace('ControlLeft', 'L Ctrl')
    .replace('ControlRight', 'R Ctrl')
    .replace('AltLeft', 'L Alt')
    .replace('AltRight', 'R Alt')
    .replace('Escape', 'Esc')
    .replace('Space', 'Space')
    .replace('Backspace', 'Bksp')
    .replace('Enter', 'Enter');
}

export function modeIcon(id) {
  return {
    classic: 'CT',
    infection: 'IN',
    freeze: 'FZ',
    team: 'TM',
    last: 'LS',
    reverse: 'RV'
  }[id] || 'CT';
}

export function teamInfo(id) {
  if (id === 'coral') return { name: 'Coral', color: '#ff8fa0', css: '#ff8fa0', mark: 'C' };
  if (id === 'azure') return { name: 'Azure', color: '#68d9ff', css: '#68d9ff', mark: 'A' };
  return { name: 'Free agent', color: '#a9b2ca', css: '#a9b2ca', mark: '—' };
}

export function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function roleLabel(player, modeId) {
  if (!player) return '';
  if (modeId === 'team') {
    if (player.isSeeker) return 'Seeker';
    return 'Runner';
  }
  if (modeId === 'infection') return player.infected ? 'Infected' : 'Survivor';
  if (modeId === 'reverse') return player.isIt ? 'Evader' : 'Hunter';
  if (modeId === 'freeze' && player.frozen) return 'Frozen';
  if (modeId === 'last' && player.eliminated) return 'Out';
  if (player.isIt) return 'IT';
  return 'Runner';
}
