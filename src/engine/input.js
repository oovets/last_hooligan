// Keyboard + gamepad input mapped to abstract actions.
// Usage: input.poll() once at the start of every fixed step; then query
//   input.down(a)  - held
//   input.pressed(a) - became held this step (edge; never missed even for very short taps)
//   input.released(a)
//   input.move()   - screen-space movement vector {x,y}, |v|<=1

export const KEYMAP = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  punchL: ['KeyJ', 'KeyZ'],
  punchR: ['KeyK', 'KeyX'],
  kick: ['KeyL', 'KeyC'],
  jump: ['Space'],
  block: ['ShiftLeft', 'ShiftRight', 'KeyU'],
  dodge: ['KeyO', 'KeyV'],
  grab: ['KeyI', 'KeyB'],
  use: ['KeyE', 'KeyF'],
  item1: ['Digit1'],
  item2: ['Digit2'],
  item3: ['Digit3'],
  inventory: ['Tab', 'KeyQ'],
  pause: ['Escape', 'KeyP'],
  // menu actions
  confirm: ['Enter', 'Space', 'KeyJ', 'NumpadEnter'],
  back: ['Escape', 'Backspace'],
  menuUp: ['ArrowUp', 'KeyW'],
  menuDown: ['ArrowDown', 'KeyS'],
  menuLeft: ['ArrowLeft', 'KeyA'],
  menuRight: ['ArrowRight', 'KeyD'],
};

// Standard gamepad layout (button index -> actions)
const PADMAP = {
  0: ['jump', 'confirm'],
  1: ['kick', 'back'],
  2: ['punchL'],
  3: ['punchR'],
  4: ['grab'],
  5: ['block'],
  6: ['dodge'],
  7: ['block'],
  8: ['inventory'],
  9: ['pause'],
  10: ['use'],
  11: ['use'],
  12: ['up', 'menuUp'],
  13: ['down', 'menuDown'],
  14: ['left', 'menuLeft'],
  15: ['right', 'menuRight'],
};

const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

class Input {
  constructor() {
    this.keys = new Set();
    this.tapped = new Set();      // key codes pressed since last poll
    this.held = {};
    this.prev = {};
    this.edgeDown = {};
    this.edgeUp = {};
    this.pad = null;
    this.padAxes = { x: 0, y: 0 };
    this.lastDevice = 'kb';
    this.anyTap = false;
    this.listeners = [];
    this.codeToActions = {};
    for (const [a, codes] of Object.entries(KEYMAP)) for (const c of codes) (this.codeToActions[c] ||= []).push(a);
  }

  init(target = window) {
    target.addEventListener('keydown', e => {
      if (PREVENT.has(e.code) || this.codeToActions[e.code]) e.preventDefault();
      if (!e.repeat) { this.tapped.add(e.code); this.anyTap = true; }
      this.keys.add(e.code);
      this.lastDevice = 'kb';
      for (const fn of this.listeners) fn(e);
    });
    target.addEventListener('keyup', e => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousedown', () => { this.anyTap = true; });
    window.addEventListener('touchstart', () => { this.anyTap = true; }, { passive: true });
  }

  onKey(fn) { this.listeners.push(fn); }

  poll() {
    const now = {};
    for (const a in KEYMAP) now[a] = false;
    for (const c of this.keys) { const acts = this.codeToActions[c]; if (acts) for (const a of acts) now[a] = true; }
    const tappedActs = {};
    for (const c of this.tapped) { const acts = this.codeToActions[c]; if (acts) for (const a of acts) tappedActs[a] = true; }

    // gamepad
    this.padAxes.x = 0; this.padAxes.y = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      p.buttons.forEach((b, i) => {
        if (b.pressed && PADMAP[i]) { for (const a of PADMAP[i]) now[a] = true; this.lastDevice = 'pad'; }
      });
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.25) {
        this.padAxes.x = ax; this.padAxes.y = ay; this.lastDevice = 'pad';
        if (ay < -0.5) now.menuUp = true;
        if (ay > 0.5) now.menuDown = true;
        if (ax < -0.5) now.menuLeft = true;
        if (ax > 0.5) now.menuRight = true;
      }
      break;
    }

    for (const a in now) {
      const was = !!this.held[a];
      this.edgeDown[a] = (now[a] && !was) || !!tappedActs[a];
      this.edgeUp[a] = !now[a] && was;
      this.held[a] = now[a];
    }
    this.tapped.clear();
    this.anyPressedFlag = this.anyTap;
    this.anyTap = false;
  }

  down(a) { return !!this.held[a]; }
  pressed(a) { return !!this.edgeDown[a]; }
  released(a) { return !!this.edgeUp[a]; }
  consume(a) { this.edgeDown[a] = false; }
  anyPressed() { return this.anyPressedFlag || Object.keys(this.edgeDown).some(k => this.edgeDown[k]); }

  // Screen-space movement vector.
  move() {
    let x = 0, y = 0;
    if (this.held.left) x -= 1;
    if (this.held.right) x += 1;
    if (this.held.up) y -= 1;
    if (this.held.down) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l, mag: 1 }; }
    const ax = this.padAxes.x, ay = this.padAxes.y, m = Math.hypot(ax, ay);
    if (m > 0.25) return { x: ax / m, y: ay / m, mag: Math.min(1, m) };
    return { x: 0, y: 0, mag: 0 };
  }

  // Human readable key hint for an action (first binding).
  hint(a) {
    if (this.lastDevice === 'pad') {
      const names = { jump: 'A', kick: 'B', punchL: 'X', punchR: 'Y', grab: 'LB', block: 'RB', dodge: 'LT', use: 'L3', pause: 'START', inventory: 'SELECT', confirm: 'A', back: 'B' };
      return names[a] || a.toUpperCase();
    }
    const c = (KEYMAP[a] || [''])[0];
    return c.replace('Key', '').replace('Digit', '').replace('Left', '').replace('Right', '').replace('Arrow', '').toUpperCase();
  }
}

export const input = new Input();
