import { inputSchema } from '../../../shared/schemas.js';

export class MovementValidator {
  constructor({ maxMagnitude = 1.001 } = {}) {
    this.maxMagnitude = maxMagnitude;
  }

  validate(payload) {
    const parsed = inputSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, reason: 'Malformed movement input.' };
    const { dx, sprint, jump, seq } = parsed.data;
    if (!Number.isFinite(dx)) return { ok: false, reason: 'Non-finite movement input.' };
    if (Math.abs(dx) > this.maxMagnitude) return { ok: false, reason: 'Movement input exceeds unit length.' };
    return { ok: true, data: { dx, sprint, jump, seq } };
  }
}
