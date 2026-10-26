import { BaseGameMode } from './BaseGameMode.js';
import { MODE_RULES } from '../../../shared/mode-rules.js';

export class ClassicTag extends BaseGameMode {
  constructor() {
    super(MODE_RULES.classic);
  }
}
