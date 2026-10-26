import { BaseGameMode } from './BaseGameMode.js';
import { MODE_RULES } from '../../../shared/mode-rules.js';

export class LastPlayerStanding extends BaseGameMode {
  constructor() {
    super(MODE_RULES.last);
  }
}
