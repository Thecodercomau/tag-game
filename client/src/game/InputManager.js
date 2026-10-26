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
    this.touch = { x: 0, sprint: false, jump: false };
    this.jumpPressedAt = -1000;
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
    if (!this.enabled) return;
    if (this.matches('scoreboard', code)) {
      event.preventDefault?.();
      if (!event.repeat) this.onScoreboard?.(true);
      return;
    }
    if (this.captured.includes(code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      event.preventDefault?.();
    }
    this.down.add(code);
    if (event.repeat) return;
    if (this.matches('jump', code)) this.jumpPressedAt = performance.now();
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
    this.touch.sprint = false;
    this.touch.jump = false;
    this.jumpPressedAt = -1000;
    this.onScoreboard?.(false);
    this.onBlur?.();
  }

  setEnabled(value) {
    const next = Boolean(value);
    if (next === this.enabled) return;
    this.enabled = next;
    const captures = [...this.captured, 'Tab', 'Escape'];
    if (next) {
      this.scene.input.keyboard?.addCapture(captures);
    } else {
      this.down.clear();
      this.touch.x = 0;
      this.touch.sprint = false;
      this.touch.jump = false;
      this.scene.input.keyboard?.removeCapture(captures);
    }
  }

  setTouchVector(x) {
    this.touch.x = Math.max(-1, Math.min(1, x));
  }

  setTouchSprint(active) {
    this.touch.sprint = Boolean(active);
  }

  setTouchJump(active) {
    const next = Boolean(active);
    if (next && !this.touch.jump) this.jumpPressedAt = performance.now();
    this.touch.jump = next;
  }

  clear() {
    this.down.clear();
    this.touch.x = 0;
    this.touch.sprint = false;
    this.touch.jump = false;
    this.jumpPressedAt = -1000;
  }

  getInput() {
    if (!this.enabled) return { dx: 0, sprint: false, jump: false };
    let dx = 0;
    for (const code of this.down) {
      if (this.matches('left', code)) dx -= 1;
      if (this.matches('right', code)) dx += 1;
    }
    dx += this.touch.x;
    dx = Math.max(-1, Math.min(1, dx));
    const sprint = [...this.down].some((code) => this.matches('sprint', code)) || this.touch.sprint;
    const heldJump = [...this.down].some((code) => this.matches('jump', code)) || this.touch.jump;
    const jump = heldJump || performance.now() - this.jumpPressedAt < 100;
    return { dx, sprint, jump };
  }

  destroy() {
    this.scene.input.keyboard?.removeCapture([...this.captured, 'Tab', 'Escape']);
    this.scene.input.keyboard?.off('keydown', this.handleKeyDown);
    this.scene.input.keyboard?.off('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }
}
