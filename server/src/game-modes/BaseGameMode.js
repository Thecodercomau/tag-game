import { MODE_MAP } from '../../../shared/constants.js';

export class BaseGameMode {
  constructor(rule) {
    this.rule = rule;
    this.id = rule.id;
    this.meta = MODE_MAP[rule.id];
  }

  canStart(playerCount) {
    return playerCount >= (this.meta?.minPlayers || 2) && playerCount <= (this.meta?.maxPlayers || 12);
  }

  validate({ modeId, playerCount }) {
    if (modeId !== this.id) return { ok: false, reason: 'Mode mismatch.' };
    if (!this.canStart(playerCount)) {
      return { ok: false, reason: `${this.meta?.name || this.id} needs at least ${this.meta?.minPlayers || 2} players.` };
    }
    return { ok: true };
  }
}
