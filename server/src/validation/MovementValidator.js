import { inputSchema } from '../../../shared/schemas.js';

export class MovementValidator {
  constructor({ maxMagnitude = 1.001 } = {}) {
    this.maxMagnitude = maxMagnitude;
  }

  validate(payload) {
    const parsed = inputSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, reason: 'Malformed movement input.' };
    const { dx, dy, sprint, seq } = parsed.data;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { ok: false, reason: 'Non-finite movement input.' };
    if (Math.hypot(dx, dy) > this.maxMagnitude) return { ok: false, reason: 'Movement input exceeds unit length.' };
    return { ok: true, data: { dx, dy, sprint, seq } };
  }
}
