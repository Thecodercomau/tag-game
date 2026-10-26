import { BaseGameMode } from './BaseGameMode.js';
import { MODE_RULES } from '../../../shared/mode-rules.js';

export class ReverseTag extends BaseGameMode {
  constructor() {
    super(MODE_RULES.reverse);
  }
}
