import { distance } from '../../../shared/utils.js';

export function validateTagAttempt(engine, playerId, targetId = null) {
  if (!engine) return { ok: false, reason: 'No active match.' };
  if (engine.phase !== 'playing') return { ok: false, reason: 'The round is not active.' };
  const player = engine.playerMap.get(playerId);
  if (!player) return { ok: false, reason: 'Unknown player.' };
  if (!player.connected || player.frozen || player.eliminated) return { ok: false, reason: 'Player cannot tag right now.' };
  if (!player.isIt && !player.isSeeker && engine.modeId !== 'reverse') {
    return { ok: false, reason: 'You do not have a tagger role.' };
  }
  if (targetId) {
    const target = engine.playerMap.get(targetId);
    if (!target) return { ok: false, reason: 'Unknown target.' };
    if (distance(player.x, player.y, target.x, target.y) > engine.options.tagDistance + 10) {
      return { ok: false, reason: 'Target is too far away.' };
    }
  }
  return { ok: true };
}

export function validateInteractAttempt(engine, playerId, targetId = null) {
  if (!engine) return { ok: false, reason: 'No active match.' };
  if (engine.phase !== 'playing') return { ok: false, reason: 'The round is not active.' };
  const player = engine.playerMap.get(playerId);
  if (!player) return { ok: false, reason: 'Unknown player.' };
  if (targetId && !engine.playerMap.has(targetId)) return { ok: false, reason: 'Unknown target.' };
  return { ok: true };
}
