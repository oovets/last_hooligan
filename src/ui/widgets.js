// Shared UI building blocks: framed panels, icons, menu lists with key repeat, button-hint bars,
// scanlines. Used by the title/menus, the in-game screens, the pause menu and the HUD.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText } from '../engine/font.js';
import { makeCanvas } from '../engine/gfx.js';
import { audio } from '../audio/audio.js';
import { save } from '../save.js';

export const C = {
  ink: '#0b0710', frame: '#120c14', bevelHi: '#a898bc', bevelLo: '#2a1e36', panel: 'rgba(14,9,22,0.88)',
  gold: '#ffd23a', red: '#c8102e', cream: '#f4f1e8', cash: '#7aff9a', dim: '#8a7a9a', off: '#5a4a6a',
  text: '#e8e0f0', blue: '#1f4fb4', yellow: '#f0c020', hp: '#3af0e0', pink: '#ff3aa0', bad: '#ff4a4a',
};

// ---------------------------------------------------------------- frames
// LN-style chunky bevelled metal frame with rivets. opts: { fill, title, accent, rivets, glow }
export function frame(ctx, x, y, w, h, opts = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = opts.edge || '#5a4a6e'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = C.bevelHi; ctx.fillRect(x - 1, y - 1, w + 2, 1); ctx.fillRect(x - 1, y - 1, 1, h + 2);
  ctx.fillStyle = C.bevelLo; ctx.fillRect(x - 1, y + h, w + 2, 1); ctx.fillRect(x + w, y - 1, 1, h + 2);
  ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = opts.fill || C.panel; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  if (opts.accent) { ctx.fillStyle = opts.accent; ctx.fillRect(x + 2, y + 2, w - 4, 1); }
  if (opts.rivets !== false && w > 24 && h > 14) {
    for (const [rx, ry] of [[x + 1, y + 1], [x + w - 3, y + 1], [x + 1, y + h - 3], [x + w - 3, y + h - 3]]) {
      ctx.fillStyle = '#d8c8e8'; ctx.fillRect(rx, ry, 2, 2);
      ctx.fillStyle = '#5a4a6e'; ctx.fillRect(rx + 1, ry + 1, 1, 1);
    }
  }
  if (opts.title) {
    const tw = measureText(opts.title) + 12;
    const tx = opts.titleAlign === 'center' ? x + Math.round((w - tw) / 2) : x + 8;
    ctx.fillStyle = '#000'; ctx.fillRect(tx - 1, y - 7, tw + 2, 12);
    ctx.fillStyle = opts.titleBg || C.red; ctx.fillRect(tx, y - 6, tw, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(tx, y - 6, tw, 1);
    drawText(ctx, opts.title, tx + 6, y - 4, { color: opts.titleColor || '#ffffff' });
  }
}

// Plain dark plate (no bevel), for lightweight overlays.
export function plate(ctx, x, y, w, h, fill = 'rgba(0,0,0,0.6)') {
  ctx.fillStyle = fill; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Segmented bar with highlight row, ghost (recent damage) and ticks.
export function bar(ctx, x, y, w, h, frac, colA, colB, ghost, segs = 10) {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#24162a'; ctx.fillRect(x, y, w, h);
  if (ghost !== undefined && ghost > frac) { ctx.fillStyle = '#fff6d0'; ctx.fillRect(x, y, Math.round(w * Math.min(1, ghost)), h); }
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  ctx.fillStyle = colA; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = colB; ctx.fillRect(x, y, fw, Math.max(1, Math.floor(h / 3)));
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h - 1, fw, 1);
  if (segs) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 1; i < segs; i++) ctx.fillRect(x + Math.round(w * i / segs), y, 1, h); }
}

// ---------------------------------------------------------------- pixel sprites
const spriteCache = new Map();
// rows: array of strings; pal: { char: '#hex' }; '.' = transparent. Cached per scale.
export function sprite(ctx, rows, pal, x, y, s = 1, key) {
  const k = (key || rows.join('/')) + '|' + s + '|' + Object.values(pal).join();
  let c = spriteCache.get(k);
  if (!c) {
    c = makeCanvas(rows[0].length * s, rows.length * s);
    const g = c.getContext('2d');
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch === '.' || !pal[ch]) continue;
      g.fillStyle = pal[ch]; g.fillRect(i * s, j * s, s, s);
    }
    spriteCache.set(k, c);
  }
  ctx.drawImage(c, Math.round(x), Math.round(y));
  return c;
}

const SCARF = ['kkkkkkkkk', 'kawabawak', 'kawabawak', 'kawabawak', 'kkkkkkkkk', '.f.f.f.f.'];
export function scarfIcon(ctx, x, y, got = true, s = 1) {
  const pal = got ? { k: '#120c14', a: '#c8102e', w: '#f4f1e8', b: '#c8102e', f: '#e8d8c8' } : { k: '#120c14', a: '#3a2e44', w: '#4a3e54', b: '#3a2e44', f: '#3a2e44' };
  sprite(ctx, SCARF, pal, x, y, s, 'scarf');
}
const BADGE = ['..kkkk..', '.kggggk.', 'kgrrrrgk', 'kgrwwrgk', 'kgrwwrgk', 'kgrrrrgk', '.kggggk.', '..kkkk..'];
export function badgeIcon(ctx, x, y, got = true, s = 1) {
  const pal = got ? { k: '#120c14', g: '#d4af37', r: '#c8102e', w: '#fff4c0' } : { k: '#120c14', g: '#4a3e54', r: '#3a2e44', w: '#5a4e64' };
  sprite(ctx, BADGE, pal, x, y, s, 'badge');
}
const LOCK = ['.kkkk.', 'k.kk.k', 'k.kk.k', 'kkkkkk', 'kyyyyk', 'kyykyk', 'kyyyyk', 'kkkkkk'];
export function lockIcon(ctx, x, y, s = 1) { sprite(ctx, LOCK, { k: '#120c14', y: '#c8a030' }, x, y, s, 'lock'); }
const KEY = ['.kkk.....', 'kyyyk....', 'ky.ykkkkk', 'kyyyyyyyk', '.kkk.kyk.', '.....k.k.'];
export function keyIcon(ctx, x, y, s = 1, col = '#e8c040') { sprite(ctx, KEY, { k: '#120c14', y: col }, x, y, s, 'key'); }
const STAR = ['....k....', '...kyk...', 'kkkkyykkk', 'kyyyyyyyk', '.kyyyyyk.', '.kyykyyk.', 'kyk...kyk', 'kk.....kk'];
export function starIcon(ctx, x, y, got = true, s = 1) { sprite(ctx, STAR, { k: '#120c14', y: got ? '#ffd23a' : '#3a2e44' }, x, y, s, 'star'); }
const SECRET = ['..kkkk..', '.kyyyyk.', 'kyk..kyk', '....kyk.', '...kyk..', '...kyk..', '........', '...kyk..'];
export function secretIcon(ctx, x, y, got = true, s = 1) { sprite(ctx, SECRET, { k: '#120c14', y: got ? '#7affe0' : '#3a2e44' }, x, y, s, 'secret'); }
const COIN = ['.kkkk.', 'kyyyyk', 'kywyyk', 'kyyyyk', 'kyyyyk', '.kkkk.'];
export function coinIcon(ctx, x, y, s = 1) { sprite(ctx, COIN, { k: '#120c14', y: '#e8c040', w: '#fff8d0' }, x, y, s, 'coin'); }
const TICK = ['......k', '.....kg', 'k...kg.', 'gk.kg..', '.gkg...', '..g....'];
export function tickIcon(ctx, x, y, s = 1) { sprite(ctx, TICK, { k: '#120c14', g: '#7aff9a' }, x, y, s, 'tick'); }

// Small triangle pointer (selection cursor) pointing right.
export function pointer(ctx, x, y, col = C.gold, dir = 1) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#000';
  for (let i = 0; i < 5; i++) { const cx = dir > 0 ? x - i : x + i; ctx.fillRect(cx - 1, y - i - 1, 3, i * 2 + 3); }
  ctx.fillStyle = col;
  for (let i = 0; i < 4; i++) { const cx = dir > 0 ? x - i : x + i; ctx.fillRect(cx, y - i, 1, i * 2 + 1); }
}

// ---------------------------------------------------------------- key names / hint bar
const KB_NAMES = { confirm: 'ENTER', back: 'ESC', pause: 'ESC', inventory: 'TAB', menuUp: '↑↓', menuDown: '↓', menuLeft: '←→', menuRight: '→', use: 'E', punchL: 'J', punchR: 'K', kick: 'L', jump: 'SPACE', block: 'SHIFT', dodge: 'O', grab: 'I' };
const PAD_NAMES = { confirm: 'A', back: 'B', pause: 'START', inventory: 'SELECT', menuUp: '↑↓', menuDown: '↓', menuLeft: '←→', menuRight: '→', use: 'L3', punchL: 'X', punchR: 'Y', kick: 'B', jump: 'A', block: 'RB', dodge: 'LT', grab: 'LB' };
export function keyName(action) {
  const pad = input.lastDevice === 'pad';
  return (pad ? PAD_NAMES : KB_NAMES)[action] || input.hint(action);
}

// Draw a key cap ("[ENTER]") and return its width.
export function keyCap(ctx, label, x, y, col = '#ffffff') {
  const w = measureText(label) + 6;
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 2, w + 2, 12);
  ctx.fillStyle = '#d8d0e0'; ctx.fillRect(x, y - 1, w, 10);
  ctx.fillStyle = '#8a7a9a'; ctx.fillRect(x, y + 8, w, 1);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 1, w, 1);
  drawText(ctx, label, x + 3, y + 1, { color: '#120c14' });
  return w + 2;
}

// Hint bar: items [[action|label, text], ...] centred at y (or aligned via opts.align/x).
export function hintBar(ctx, items, y = VIEW_H - 14, opts = {}) {
  const parts = items.map(([a, t]) => ({ k: KB_NAMES[a] || PAD_NAMES[a] ? keyName(a) : a, t }));
  let total = 0;
  for (const p of parts) total += measureText(p.k) + 8 + measureText(p.t) + 14;
  total -= 14;
  let x = opts.align === 'left' ? (opts.x || 8) : opts.align === 'right' ? (opts.x || VIEW_W - 8) - total : Math.round(VIEW_W / 2 - total / 2);
  if (opts.bg !== false) plate(ctx, x - 6, y - 4, total + 12, 15, 'rgba(0,0,0,0.55)');
  for (const p of parts) {
    x += keyCap(ctx, p.k, x, y);
    x += 4;
    drawText(ctx, p.t, x, y + 1, { color: opts.color || '#c0b8d0' });
    x += measureText(p.t) + 14;
  }
}

// ---------------------------------------------------------------- input helpers
// Key-repeat for held menu directions.
export class Repeater {
  constructor(delay = 0.32, rate = 0.075) { this.delay = delay; this.rate = rate; this.t = {}; }
  check(action, dt) {
    if (input.pressed(action)) { this.t[action] = 0; return true; }
    if (!input.down(action)) { this.t[action] = -1; return false; }
    if (this.t[action] === undefined || this.t[action] < 0) { this.t[action] = 0; return false; }
    const before = this.t[action];
    this.t[action] += dt;
    if (this.t[action] < this.delay) return false;
    const n0 = Math.floor((before - this.delay) / this.rate), n1 = Math.floor((this.t[action] - this.delay) / this.rate);
    return before < this.delay || n1 > n0;
  }
}

export const confirmPressed = () => input.pressed('confirm');
export const backPressed = () => input.pressed('back');
export const blink = (t, hz = 2) => Math.floor(t * hz) % 2 === 0;

// ---------------------------------------------------------------- menu list
// items: { label: str|fn, value?: fn->str, slider?: fn->0..1, left?, right?, fn?, disabled?: bool|fn, hint?: str|fn, color? }
export class MenuList {
  constructor(items, opts = {}) {
    this.items = items;
    this.sel = 0;
    this.onBack = opts.onBack || null;
    this.rep = new Repeater();
    this.t = 0;
    this.flash = 0;
    this.fixSel(1);
  }
  isDisabled(it) { return typeof it.disabled === 'function' ? it.disabled() : !!it.disabled; }
  fixSel(d = 1) {
    const n = this.items.length;
    for (let k = 0; k < n && this.isDisabled(this.items[this.sel]); k++) this.sel = (this.sel + d + n) % n;
  }
  move(d) {
    const n = this.items.length;
    let s = this.sel;
    for (let k = 0; k < n; k++) { s = (s + d + n) % n; if (!this.isDisabled(this.items[s])) break; }
    if (s !== this.sel) { this.sel = s; audio.sfx('menuMove'); }
  }
  update(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.rep.check('menuUp', dt)) this.move(-1);
    if (this.rep.check('menuDown', dt)) this.move(1);
    const it = this.items[this.sel];
    if (!it) return;
    if (it.left && this.rep.check('menuLeft', dt)) { it.left(); audio.sfx('menuMove'); }
    if (it.right && this.rep.check('menuRight', dt)) { it.right(); audio.sfx('menuMove'); }
    if (input.pressed('confirm') && (it.fn || it.right) && !this.isDisabled(it)) {
      audio.sfx('menuSelect'); this.flash = 0.18;
      if (it.fn) it.fn(); else it.right();
      return;
    }
    if (input.pressed('back') && this.onBack) { audio.sfx('menuBack'); this.onBack(); }
  }
  hint() {
    const it = this.items[this.sel];
    if (!it || !it.hint) return '';
    return typeof it.hint === 'function' ? it.hint() : it.hint;
  }
  // Draw rows. opts: { w, rowH, align:'center'|'left', scale, valueX }
  draw(ctx, x, y, opts = {}) {
    const w = opts.w || 240, rowH = opts.rowH || 16, scale = opts.scale || 1;
    const center = opts.align !== 'left';
    this.items.forEach((it, i) => {
      const sel = i === this.sel;
      const dis = this.isDisabled(it);
      const yy = y + i * rowH;
      const label = typeof it.label === 'function' ? it.label() : it.label;
      if (sel) {
        const pulse = 0.55 + Math.sin(this.t * 6) * 0.12;
        ctx.fillStyle = `rgba(200,16,46,${pulse})`; ctx.fillRect(x, yy - 3, w, rowH - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, yy - 3, w, 1);
        ctx.fillStyle = '#5a0010'; ctx.fillRect(x, yy + rowH - 6, w, 1);
        if (this.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, yy - 3, w, rowH - 2); }
        const bob = Math.round(Math.sin(this.t * 8) * 1.5);
        pointer(ctx, x - 9 + bob, yy + Math.round((7 * scale) / 2) - 0, C.gold, 1);
        pointer(ctx, x + w + 8 - bob, yy + Math.round((7 * scale) / 2), C.gold, -1);
      }
      const col = dis ? C.off : sel ? '#ffffff' : (it.color || '#c0b8d0');
      const hasVal = it.value || it.slider;
      if (hasVal) {
        drawText(ctx, label, x + 8, yy, { color: col, scale, outline: '#000' });
        const vx = x + w - 8;
        if (it.slider) {
          const f = it.slider();
          const bw = 80, bx = vx - bw - 24;
          drawText(ctx, '<', bx - 4, yy, { color: sel ? C.gold : C.dim, align: 'right' });
          for (let k = 0; k < 10; k++) {
            const on = k < Math.round(f * 10);
            ctx.fillStyle = '#000'; ctx.fillRect(bx + k * 8, yy - 1, 7, 9);
            ctx.fillStyle = on ? (k < 7 ? '#7aff9a' : k < 9 ? C.gold : C.bad) : '#2a1e36';
            ctx.fillRect(bx + k * 8 + 1, yy + 6 - Math.round(k * 0.6), 5, 2 + Math.round(k * 0.6));
          }
          drawText(ctx, '>', bx + bw + 2, yy, { color: sel ? C.gold : C.dim });
          drawText(ctx, String(Math.round(f * 10)), vx, yy, { color: col, align: 'right' });
        } else {
          const v = it.value();
          drawText(ctx, (sel ? '< ' : '') + v + (sel ? ' >' : ''), vx, yy, { color: sel ? C.gold : '#a8a0b8', align: 'right', outline: '#000' });
        }
      } else {
        drawText(ctx, label, center ? x + w / 2 : x + 8, yy, { color: col, scale, align: center ? 'center' : 'left', outline: '#000' });
        if (it.badge) {
          const bt = typeof it.badge === 'function' ? it.badge() : it.badge;
          if (bt) drawText(ctx, bt, x + w - 6, yy, { color: C.gold, align: 'right', outline: '#000' });
        }
      }
    });
  }
}

// ---------------------------------------------------------------- overlays
let scan = null, vig = null;
export function scanlines(ctx, force = false) {
  if (!force && !(save.data.settings && save.data.settings.scanlines)) return;
  if (!scan) {
    scan = makeCanvas(VIEW_W, VIEW_H);
    const g = scan.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 1; y < VIEW_H; y += 2) g.fillRect(0, y, VIEW_W, 1);
  }
  ctx.drawImage(scan, 0, 0);
  vignette(ctx, 0.35);
}
export function vignette(ctx, alpha = 0.5, color = '0,0,0') {
  if (!vig) {
    vig = makeCanvas(VIEW_W, VIEW_H);
    const g = vig.getContext('2d');
    const rg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = rg; g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(vig, 0, 0);
  ctx.globalAlpha = 1;
}

// Typewriter helper: returns lines truncated to `chars` total characters.
export function typed(lines, chars) {
  const out = [];
  for (const ln of lines) { if (chars <= 0) { out.push(''); continue; } out.push(ln.slice(0, chars)); chars -= ln.length; }
  return out;
}
export function typedCount(lines) { return lines.reduce((s, l) => s + l.length, 0); }

export function fmtTime(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); }
export function fmtScore(n, pad = 8) { return String(Math.max(0, Math.floor(n))).padStart(pad, '0'); }
export function fmtCash(n) { return '£' + Math.max(0, Math.floor(n)); }

// Diagonal club-colour stripes background (level cards, tallies).
export function stripes(ctx, t, a = '#c8102e', b = '#f4f1e8', alpha = 0.14, speed = 30) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = -10; i < 30; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    const x = i * 40 + (t * speed) % 80;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, 0); ctx.lineTo(x - 180, VIEW_H); ctx.lineTo(x - 200, VIEW_H); ctx.fill();
  }
  ctx.restore();
}

// Big title text with a club-red underline bar.
export function heading(ctx, text, x, y, opts = {}) {
  const scale = opts.scale || 3;
  const w = measureText(text, scale);
  const x0 = opts.align === 'left' ? x : x - w / 2;
  drawText(ctx, text, x0 + scale, y + scale, { color: '#3a0008', scale });
  drawText(ctx, text, x0, y, { color: opts.color || C.gold, scale, outline: '#000' });
  ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x0) - 1, y + 7 * scale + 3, w + 2, 4);
  ctx.fillStyle = C.red; ctx.fillRect(Math.round(x0), y + 7 * scale + 4, w, 2);
  ctx.fillStyle = C.cream; ctx.fillRect(Math.round(x0 + w * 0.35), y + 7 * scale + 4, Math.round(w * 0.3), 2);
}

// Remove the HTML "LOADING..." overlay (index.html) once the first scene is up.
export function hideLoader() {
  try { const el = typeof document !== 'undefined' && document.getElementById && document.getElementById('loading'); if (el) el.remove(); } catch (e) { /* headless */ }
}
