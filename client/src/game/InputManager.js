import { DEFAULT_SETTINGS } from '@shared/constants.js';

export class InputManager {
  constructor(scene, { bindings = DEFAULT_SETTINGS.bindings, onTag, onInteract, onScoreboard, onEsc, onBlur } = {}) {
    this.scene = scene;
    this.bindings = { ...DEFAULT_SETTINGS.bindings, ...bindings };
    this.onTag = onTag;
    this.onInteract = onInteract;
    this.onScoreboard = onScoreboard;
    this.onEsc = onEsc;
    this.onBlur = onBlur;
    this.down = new Set();
    this.touch = { x: 0, y: 0, sprint: false };
    this.enabled = true;
    this.captured = [...new Set(Object.values(this.bindings).flat().map((code) => code))];
    this.scene.input.keyboard?.addCapture([...this.captured, 'Tab', 'Escape']);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.scene.input.keyboard?.on('keydown', this.handleKeyDown);
    this.scene.input.keyboard?.on('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  matches(action, code) {
    return (this.bindings[action] || []).includes(code);
  }

  handleKeyDown(event) {
    const code = event.code;
    if (code === 'Escape') {
      this.onEsc?.();
      return;
    }
    if (this.matches('scoreboard', code)) {
      event.preventDefault?.();
      if (!event.repeat) this.onScoreboard?.(true);
      return;
    }
    if (this.captured.includes(code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      event.preventDefault?.();
    }
    if (!this.enabled) return;
    this.down.add(code);
    if (event.repeat) return;
    if (this.matches('tag', code)) this.onTag?.();
    if (this.matches('interact', code)) this.onInteract?.();
  }

  handleKeyUp(event) {
    const code = event.code;
    this.down.delete(code);
    if (this.matches('scoreboard', code)) {
      event.preventDefault?.();
      this.onScoreboard?.(false);
    }
  }

  handleBlur() {
    this.down.clear();
    this.touch.x = 0;
    this.touch.y = 0;
    this.touch.sprint = false;
    this.onScoreboard?.(false);
    this.onBlur?.();
  }

  setTouchVector(x, y) {
    this.touch.x = Math.max(-1, Math.min(1, x));
    this.touch.y = Math.max(-1, Math.min(1, y));
  }

  setTouchSprint(active) {
    this.touch.sprint = Boolean(active);
  }

  clear() {
    this.down.clear();
    this.touch.x = 0;
    this.touch.y = 0;
    this.touch.sprint = false;
  }

  getInput() {
    if (!this.enabled) return { dx: 0, dy: 0, sprint: false };
    let dx = 0;
    let dy = 0;
    for (const code of this.down) {
      if (this.matches('left', code)) dx -= 1;
      if (this.matches('right', code)) dx += 1;
      if (this.matches('up', code)) dy -= 1;
      if (this.matches('down', code)) dy += 1;
    }
    dx += this.touch.x;
    dy += this.touch.y;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > 1) {
      dx /= magnitude;
      dy /= magnitude;
    }
    const sprint = [...this.down].some((code) => this.matches('sprint', code)) || this.touch.sprint;
    return { dx, dy, sprint };
  }

  destroy() {
    this.scene.input.keyboard?.off('keydown', this.handleKeyDown);
    this.scene.input.keyboard?.off('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }
}
