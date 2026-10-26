import { BaseGameMode } from './BaseGameMode.js';
import { MODE_RULES } from '../../../shared/mode-rules.js';

export class FreezeTag extends BaseGameMode {
  constructor() {
    super(MODE_RULES.freeze);
  }
}
