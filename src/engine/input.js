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
  // the firm (game/firm.js): hold COMMAND for slow-motion mouse orders; quick orders work any time
  command: ['KeyG'],
  orderFollow: ['KeyR'],
  orderCharge: ['KeyT'],
  orderHold: ['KeyH'],
  orderSing: ['KeyY'],
  orderRegroup: ['KeyN'],
  select4: ['Digit4'],
  hubMap: ['KeyM'],          // the pub: open THE MAP from anywhere
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
  7: ['command'],           // RT: hold for command mode (block stays on RB)
  8: ['inventory'],
  9: ['pause'],
  10: ['use'],
  11: ['orderRegroup'],      // R3: BACK TO ME! (L3 keeps use)
  // d-pad: quick firm orders in a fight (the stick moves), menu navigation in menus
  12: ['orderCharge', 'menuUp'],
  13: ['orderFollow', 'menuDown'],
  14: ['orderHold', 'menuLeft'],
  15: ['orderSing', 'menuRight'],
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
    this.padCount = 0;            // gamepads the page can see (browsers only show one after a button press)
    this.padJoined = 0;           // performance.now() when one turned up (the GAMEPAD CONNECTED message, ui/widgets.js)
    this.anyTap = false;
    this.listeners = [];
    this.codeToActions = {};
    // mouse in logical view coordinates (initMouse); pressed/released are per-step edges like keys
    this.mouse = { x: 0, y: 0, inside: false, down: [false, false, false], pressed: [false, false, false], released: [false, false, false], _p: new Set(), _r: new Set(), moved: false };
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

  // Mouse over the game canvas, mapped to the logical view (vw x vh). Right-click menu is suppressed on the canvas.
  initMouse(el, vw, vh) {
    const M = this.mouse;
    const pos = e => { const r = el.getBoundingClientRect(); M.x = (e.clientX - r.left) / r.width * vw; M.y = (e.clientY - r.top) / r.height * vh; M.inside = M.x >= 0 && M.y >= 0 && M.x < vw && M.y < vh; };
    el.addEventListener('mousemove', e => { pos(e); M.moved = true; });
    el.addEventListener('mousedown', e => { pos(e); if (e.button < 3) { M.down[e.button] = true; M._p.add(e.button); } e.preventDefault(); el.focus && el.focus(); });
    window.addEventListener('mouseup', e => { if (e.button < 3) { M.down[e.button] = false; M._r.add(e.button); } });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('mouseleave', () => { M.inside = false; });
  }

  poll() {
    const now = {};
    for (const a in KEYMAP) now[a] = false;
    for (const c of this.keys) { const acts = this.codeToActions[c]; if (acts) for (const a of acts) now[a] = true; }
    const tappedActs = {};
    for (const c of this.tapped) { const acts = this.codeToActions[c]; if (acts) for (const a of acts) tappedActs[a] = true; }

    // gamepad
    this.padAxes.x = 0; this.padAxes.y = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const nPads = [...pads].filter(Boolean).length;
    if (nPads > this.padCount) this.padJoined = performance.now();
    this.padCount = nPads;
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
    const M = this.mouse;
    for (let b = 0; b < 3; b++) { M.pressed[b] = M._p.has(b); M.released[b] = M._r.has(b); }
    M._p.clear(); M._r.clear();
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
      const names = { jump: 'A', kick: 'B', punchL: 'X', punchR: 'Y', grab: 'LB', block: 'RB', dodge: 'LT', use: 'L3', pause: 'START', inventory: 'SELECT', confirm: 'A', back: 'B',
        command: 'RT', orderCharge: 'D-UP', orderFollow: 'D-DOWN', orderHold: 'D-LEFT', orderSing: 'D-RIGHT', orderRegroup: 'R3' };
      return names[a] || a.toUpperCase();
    }
    const c = (KEYMAP[a] || [''])[0];
    return c.replace('Key', '').replace('Digit', '').replace('Left', '').replace('Right', '').replace('Arrow', '').toUpperCase();
  }
}

export const input = new Input();
