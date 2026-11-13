// Shared UI building blocks: framed panels, icons, menu lists with key repeat, button-hint bars,
// scanlines. Used by the title/menus, the in-game screens, the pause menu and the HUD.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText, isFrameHD, FONT, sizeForCap } from '../engine/font.js';
import { makeCanvas } from '../engine/gfx.js';
import { audio } from '../audio/audio.js';
import { save } from '../save.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim } from '../game/poses.js';
import { r3d } from '../render3d/index.js';

// The game's colours are BLACK AND YELLOW (svartgult: black first, yellow the accent). C.red is the accent colour (the
// name is historic: it was the old club red) and is yellow now; panels are neutral black, not purple.
export const C = {
  ink: '#0a0a0b', frame: '#111113', bevelHi: '#b8a860', bevelLo: '#2a2a2e', panel: 'rgba(12,12,14,0.9)',
  gold: '#ffd23a', red: '#f2c811', cream: '#f4f1e8', cash: '#7aff9a', dim: '#8e8b82', off: '#5a5a5e',
  text: '#ecebe6', blue: '#1f4fb4', yellow: '#f0c020', hp: '#3af0e0', pink: '#ff3aa0', bad: '#ff4a4a',
  black: '#141416',
};
// text colour that reads on a filled background (black on the yellow accent, white on dark)
export function onFill(bg) {
  if (!bg || bg[0] !== '#' || bg.length !== 7) return '#ffffff';
  const n = parseInt(bg.slice(1), 16), l = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.55 ? '#141416' : '#ffffff';
}

// ---------------------------------------------------------------- vector helpers
// device px per logical px of the current transform (shadowBlur and hairlines are in device px)
export const devScale = ctx => (ctx.getTransform ? ctx.getTransform().a : 2) || 2;
export function rrect(ctx, x, y, w, h, r, append = false) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!append) ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
export function rgba(col, a) { return col && col[0] === '#' && col.length === 7 ? hexA(col, a) : col; }

// ---------------------------------------------------------------- frames
// Glass panel: soft drop shadow, rounded body with a sheen, hairline border, optional accent line and title tab.
// opts: { fill, title, accent, rivets (ignored), glow, edge, titleBg, titleColor, titleAlign, radius }
export function frame(ctx, x, y, w, h, opts = {}) {
  const S = devScale(ctx), r = opts.radius ?? 5;
  ctx.save();
  // shadow + body
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18 * S; ctx.shadowOffsetY = 4 * S;
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = opts.fill || C.panel; ctx.fill();
  ctx.shadowColor = 'transparent';
  const sheen = ctx.createLinearGradient(0, y, 0, y + h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.075)'); sheen.addColorStop(0.35, 'rgba(255,255,255,0.015)'); sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = sheen; ctx.fill();
  // hairline border (lit from above)
  const bd = ctx.createLinearGradient(0, y, 0, y + h);
  if (opts.edge) { bd.addColorStop(0, opts.edge); bd.addColorStop(1, rgba(opts.edge, 0.35)); }
  else { bd.addColorStop(0, 'rgba(255,255,255,0.28)'); bd.addColorStop(0.5, 'rgba(255,255,255,0.08)'); bd.addColorStop(1, 'rgba(255,255,255,0.14)'); }
  ctx.strokeStyle = bd; ctx.lineWidth = Math.max(1 / S, 0.6);
  rrect(ctx, x + 0.3, y + 0.3, w - 0.6, h - 0.6, r); ctx.stroke();
  // accent line along the top edge, fading out at the ends
  if (opts.accent) {
    const ag = ctx.createLinearGradient(x, 0, x + w, 0);
    ag.addColorStop(0, rgba(opts.accent, 0)); ag.addColorStop(0.2, opts.accent); ag.addColorStop(0.8, opts.accent); ag.addColorStop(1, rgba(opts.accent, 0));
    ctx.shadowColor = opts.accent; ctx.shadowBlur = 6 * S;
    ctx.fillStyle = ag; ctx.fillRect(x + r, y, w - r * 2, 1.2);
    ctx.shadowColor = 'transparent';
  }
  if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = 16 * S; ctx.strokeStyle = opts.glow; rrect(ctx, x, y, w, h, r); ctx.stroke(); }
  ctx.restore();
  if (opts.title) {
    const tw = measureText(opts.title) + 14;
    const tx = opts.titleAlign === 'center' ? x + Math.round((w - tw) / 2) : x + 9;
    const base = opts.titleBg || C.red;
    ctx.save();
    ctx.shadowColor = rgba(base, 0.7); ctx.shadowBlur = 8 * S;
    rrect(ctx, tx, y - 6.5, tw, 12, 3);
    const tg = ctx.createLinearGradient(0, y - 6.5, 0, y + 5.5);
    tg.addColorStop(0, shadeHex(base, 0.28)); tg.addColorStop(1, shadeHex(base, -0.18));
    ctx.fillStyle = tg; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
    drawText(ctx, opts.title, tx + 7, y - 3.5, { color: opts.titleColor || onFill(base) });
  }
}
// lighten (k>0) / darken (k<0) a #hex colour
export function shadeHex(hex, k) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Plain dark plate (no bevel), for lightweight overlays.
export function plate(ctx, x, y, w, h, fill = 'rgba(0,0,0,0.6)') {
  ctx.fillStyle = fill; rrect(ctx, x, y, w, h, Math.min(4, h / 2)); ctx.fill();
}

// Rounded gauge with a glossy fill, ghost (recent damage) and segment ticks.
export function bar(ctx, x, y, w, h, frac, colA, colB, ghost, segs = 10) {
  const r = Math.min(h / 2, 2.5);
  ctx.save();
  rrect(ctx, x - 0.75, y - 0.75, w + 1.5, h + 1.5, r + 0.75); ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fill();
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = '#1c1224'; ctx.fill();
  ctx.clip();
  if (ghost !== undefined && ghost > frac) { ctx.fillStyle = '#fff6d0'; ctx.fillRect(x, y, w * Math.min(1, ghost), h); }
  const fw = w * Math.max(0, Math.min(1, frac));
  if (fw > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, colB || colA); g.addColorStop(0.45, colA); g.addColorStop(1, shadeHex(colA, -0.35));
    ctx.fillStyle = g; ctx.fillRect(x, y, fw, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, fw, Math.max(0.5, h * 0.22));
  }
  if (segs) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = 1; i < segs; i++) ctx.fillRect(x + w * i / segs - 0.3, y, 0.6, h); }
  ctx.restore();
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
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = sm;
  return c;
}


// ---- vector icons (HD frames): same footprint as the pixel versions
function glow(ctx, col, b) { ctx.shadowColor = col; ctx.shadowBlur = b * devScale(ctx); }
function vScarf(ctx, x, y, got, s) {
  const w = 9 * s, h = 5 * s;
  ctx.save();
  rrect(ctx, x, y, w, h, 1 * s); ctx.fillStyle = got ? '#f2c811' : '#3a3a40'; ctx.fill(); ctx.clip();
  ctx.fillStyle = got ? '#f4f1e8' : '#4a4a50';
  for (let i = 1; i < 4; i += 2) ctx.fillRect(x + i * w / 4 - w / 16, y, w / 8 + w / 16, h);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, w, h * 0.3);
  ctx.restore();
  ctx.strokeStyle = got ? '#e8d8c8' : '#3a3a40'; ctx.lineWidth = 0.5 * s;
  ctx.beginPath(); for (let i = 0; i < 4; i++) { const fx = x + (1.2 + i * 2.2) * s; ctx.moveTo(fx, y + h); ctx.lineTo(fx, y + h + 1.2 * s); } ctx.stroke();
}
function vBadge(ctx, x, y, got, s) {
  const cx = x + 4 * s, cy = y + 4 * s, R = 4 * s;
  ctx.save();
  if (got) glow(ctx, 'rgba(255,200,60,0.6)', 4);
  const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  g.addColorStop(0, got ? '#fff2a8' : '#5a4e64'); g.addColorStop(1, got ? '#b08018' : '#3a3a40');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.68, 0, Math.PI * 2); ctx.fillStyle = got ? '#f2c811' : '#3a3a40'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2); ctx.fillStyle = got ? '#fff4c0' : '#5a4e64'; ctx.fill();
  ctx.restore();
}
function vCoin(ctx, x, y, s) {
  const cx = x + 3 * s, cy = y + 3 * s, R = 3 * s;
  ctx.save(); glow(ctx, 'rgba(255,210,80,0.55)', 4);
  const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#f2c840'); g.addColorStop(1, '#a87410');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(120,70,0,0.8)'; ctx.lineWidth = 0.35 * s;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function starPath(ctx, cx, cy, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath();
}
function vStar(ctx, x, y, got, s) {
  ctx.save(); if (got) glow(ctx, 'rgba(255,210,60,0.7)', 5);
  const g = ctx.createLinearGradient(0, y, 0, y + 8 * s);
  g.addColorStop(0, got ? '#fff6b8' : '#4a4a50'); g.addColorStop(1, got ? '#f0a810' : '#2a2034');
  starPath(ctx, x + 4.5 * s, y + 4.3 * s, 4.6 * s, 2 * s); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
function vSecret(ctx, x, y, got, s) {
  ctx.save(); if (got) glow(ctx, 'rgba(122,255,224,0.7)', 4);
  ctx.font = `800 ${(9.5 * s).toFixed(2)}px ${FONT.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = got ? '#7affe0' : '#3a3a40'; ctx.fillText('?', x + 4 * s, y + 8 * s);
  ctx.restore();
}
function vLock(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = '#a88a40'; ctx.lineWidth = 1.1 * s;
  ctx.beginPath(); ctx.arc(x + 3 * s, y + 3 * s, 1.9 * s, Math.PI, 0); ctx.lineTo(x + 4.9 * s, y + 3.6 * s); ctx.moveTo(x + 1.1 * s, y + 3 * s); ctx.lineTo(x + 1.1 * s, y + 3.6 * s); ctx.stroke();
  const g = ctx.createLinearGradient(0, y + 3.5 * s, 0, y + 8 * s); g.addColorStop(0, '#f0c850'); g.addColorStop(1, '#9a6c10');
  rrect(ctx, x, y + 3.5 * s, 6 * s, 4.5 * s, 0.8 * s); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = '#3a2a08'; ctx.beginPath(); ctx.arc(x + 3 * s, y + 5.4 * s, 0.7 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function vTick(ctx, x, y, s) {
  ctx.save(); glow(ctx, 'rgba(122,255,154,0.7)', 3);
  ctx.strokeStyle = '#7aff9a'; ctx.lineWidth = 1.3 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x + 0.8 * s, y + 3.4 * s); ctx.lineTo(x + 2.6 * s, y + 5 * s); ctx.lineTo(x + 6.2 * s, y + 0.8 * s); ctx.stroke();
  ctx.restore();
}

const SCARF = ['kkkkkkkkk', 'kawabawak', 'kawabawak', 'kawabawak', 'kkkkkkkkk', '.f.f.f.f.'];
export function scarfIcon(ctx, x, y, got = true, s = 1) {
  if (isFrameHD()) return vScarf(ctx, x, y, got, s);
  const pal = got ? { k: '#121214', a: '#f2c811', w: '#141416', b: '#f2c811', f: '#e8d8c8' } : { k: '#121214', a: '#3a3a40', w: '#4a4a50', b: '#3a3a40', f: '#3a3a40' };   // a black-and-yellow scarf
  sprite(ctx, SCARF, pal, x, y, s, 'scarf');
}
const BADGE = ['..kkkk..', '.kggggk.', 'kgrrrrgk', 'kgrwwrgk', 'kgrwwrgk', 'kgrrrrgk', '.kggggk.', '..kkkk..'];
export function badgeIcon(ctx, x, y, got = true, s = 1) {
  if (isFrameHD()) return vBadge(ctx, x, y, got, s);
  const pal = got ? { k: '#121214', g: '#d4af37', r: '#141416', w: '#fff4c0' } : { k: '#121214', g: '#4a4a50', r: '#3a3a40', w: '#5a5a60' };
  sprite(ctx, BADGE, pal, x, y, s, 'badge');
}
const LOCK = ['.kkkk.', 'k.kk.k', 'k.kk.k', 'kkkkkk', 'kyyyyk', 'kyykyk', 'kyyyyk', 'kkkkkk'];
export function lockIcon(ctx, x, y, s = 1) { if (isFrameHD()) return vLock(ctx, x, y, s); sprite(ctx, LOCK, { k: '#121214', y: '#c8a030' }, x, y, s, 'lock'); }
const KEY = ['.kkk.....', 'kyyyk....', 'ky.ykkkkk', 'kyyyyyyyk', '.kkk.kyk.', '.....k.k.'];
export function keyIcon(ctx, x, y, s = 1, col = '#e8c040') { sprite(ctx, KEY, { k: '#121214', y: col }, x, y, s, 'key'); }
const STAR = ['....k....', '...kyk...', 'kkkkyykkk', 'kyyyyyyyk', '.kyyyyyk.', '.kyykyyk.', 'kyk...kyk', 'kk.....kk'];
export function starIcon(ctx, x, y, got = true, s = 1) { if (isFrameHD()) return vStar(ctx, x, y, got, s); sprite(ctx, STAR, { k: '#121214', y: got ? '#ffd23a' : '#3a3a40' }, x, y, s, 'star'); }
const SECRET = ['..kkkk..', '.kyyyyk.', 'kyk..kyk', '....kyk.', '...kyk..', '...kyk..', '........', '...kyk..'];
export function secretIcon(ctx, x, y, got = true, s = 1) { if (isFrameHD()) return vSecret(ctx, x, y, got, s); sprite(ctx, SECRET, { k: '#121214', y: got ? '#7affe0' : '#3a3a40' }, x, y, s, 'secret'); }
const COIN = ['.kkkk.', 'kyyyyk', 'kywyyk', 'kyyyyk', 'kyyyyk', '.kkkk.'];
export function coinIcon(ctx, x, y, s = 1) { if (isFrameHD()) return vCoin(ctx, x, y, s); sprite(ctx, COIN, { k: '#121214', y: '#e8c040', w: '#fff8d0' }, x, y, s, 'coin'); }
const TICK = ['......k', '.....kg', 'k...kg.', 'gk.kg..', '.gkg...', '..g....'];
export function tickIcon(ctx, x, y, s = 1) { if (isFrameHD()) return vTick(ctx, x, y, s); sprite(ctx, TICK, { k: '#121214', g: '#7aff9a' }, x, y, s, 'tick'); }

// Selection chevron pointing right (dir 1) or left (dir -1), with a soft glow.
export function pointer(ctx, x, y, col = C.gold, dir = 1) {
  const S = devScale(ctx);
  ctx.save();
  ctx.shadowColor = rgba(col, 0.8); ctx.shadowBlur = 5 * S;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dir * 5, y - 4); ctx.lineTo(x - dir * 3.6, y); ctx.lineTo(x - dir * 5, y + 4); ctx.closePath(); ctx.fill();
  ctx.restore();
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
  const w = Math.max(10, measureText(label) + 8);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3 * devScale(ctx); ctx.shadowOffsetY = 0.6 * devScale(ctx);
  rrect(ctx, x, y - 2.5, w, 12, 2.5);
  const g = ctx.createLinearGradient(0, y - 2.5, 0, y + 9.5);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#ddd6e6'); g.addColorStop(1, '#a89cb8');
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  drawText(ctx, label, x + w / 2, y + 0.5, { color: '#160e1c', align: 'center', soft: false });
  return w + 2;
}

// Hint bar: items [[action|label, text], ...] centred at y (or aligned via opts.align/x).
export function hintBar(ctx, items, y = VIEW_H - 14, opts = {}) {
  const parts = items.map(([a, t]) => ({ k: KB_NAMES[a] || PAD_NAMES[a] ? keyName(a) : a, t }));
  let total = 0;
  for (const p of parts) total += Math.max(10, measureText(p.k) + 8) + 6 + measureText(p.t) + 14;
  total -= 14;
  let x = opts.align === 'left' ? (opts.x || 8) : opts.align === 'right' ? (opts.x || VIEW_W - 8) - total : Math.round(VIEW_W / 2 - total / 2);
  if (opts.bg !== false) {
    const g = ctx.createLinearGradient(x - 12, 0, x + total + 12, 0);
    g.addColorStop(0, 'rgba(8,8,10,0)'); g.addColorStop(0.12, 'rgba(8,8,10,0.72)'); g.addColorStop(0.88, 'rgba(8,8,10,0.72)'); g.addColorStop(1, 'rgba(8,8,10,0)');
    ctx.fillStyle = g; rrect(ctx, x - 18, y - 5.5, total + 36, 17, 8.5); ctx.fill();
  }
  for (const p of parts) {
    x += keyCap(ctx, p.k, x, y);
    x += 4;
    drawText(ctx, p.t, x, y + 0.5, { color: opts.color || '#d4cce0' });
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
        const pulse = 0.85 + Math.sin(this.t * 5) * 0.15;
        const top = yy - 4, hh = rowH - 1 + (scale - 1) * 6;
        ctx.save();
        ctx.shadowColor = `rgba(242,200,17,${0.55 * pulse})`; ctx.shadowBlur = 12 * devScale(ctx);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        if (center) { g.addColorStop(0, 'rgba(150,118,0,0.25)'); g.addColorStop(0.5, `rgba(242,200,17,${0.92 * pulse})`); g.addColorStop(1, 'rgba(150,118,0,0.25)'); }
        else { g.addColorStop(0, `rgba(242,200,17,${0.92 * pulse})`); g.addColorStop(0.7, 'rgba(176,140,0,0.55)'); g.addColorStop(1, 'rgba(150,118,0,0.18)'); }
        rrect(ctx, x, top, w, hh, 3); ctx.fillStyle = g; ctx.fill();
        ctx.shadowColor = 'transparent';
        const hl = ctx.createLinearGradient(0, top, 0, top + hh);
        hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(0.5, 'rgba(255,255,255,0.04)'); hl.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = hl; ctx.fill();
        if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 2.6})`; ctx.fill(); }
        ctx.restore();
        const bob = Math.sin(this.t * 7) * 1.6;
        const my = top + hh / 2;
        pointer(ctx, x - 5 + bob, my, C.gold, 1);
        pointer(ctx, x + w + 5 - bob, my, C.gold, -1);
      }
      const col = dis ? C.off : sel ? C.black : (it.color || '#c8c4b8');   // black on the yellow bar
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
            const hb = 2.5 + k * 0.6;
            ctx.fillStyle = on ? (k < 7 ? '#7aff9a' : k < 9 ? C.gold : C.bad) : 'rgba(255,255,255,0.12)';
            if (on) { ctx.save(); ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 4 * devScale(ctx); }
            rrect(ctx, bx + k * 8 + 1, yy + 7.5 - hb, 5.5, hb, 1); ctx.fill();
            if (on) ctx.restore();
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
  if (isFrameHD() && !force) { vignette(ctx, 0.28); return; }
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

// Diagonal stripes background in the game's black and yellow (level cards, tallies).
export function stripes(ctx, t, a = '#141416', b = '#f2c811', alpha = 0.14, speed = 30) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = -10; i < 30; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    const x = i * 40 + (t * speed) % 80;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, 0); ctx.lineTo(x - 180, VIEW_H); ctx.lineTo(x - 200, VIEW_H); ctx.fill();
  }
  ctx.restore();
}

// Big title text with a yellow underline bar (a black notch in the middle).
export function heading(ctx, text, x, y, opts = {}) {
  const scale = opts.scale || 3;
  if (!isFrameHD()) {
    const w = measureText(text, scale);
    const x0 = opts.align === 'left' ? x : x - w / 2;
    drawText(ctx, text, x0 + scale, y + scale, { color: '#0a0a0a', scale });
    drawText(ctx, text, x0, y, { color: opts.color || C.gold, scale, outline: '#000' });
    ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x0) - 1, y + 7 * scale + 3, w + 2, 4);
    ctx.fillStyle = C.red; ctx.fillRect(Math.round(x0), y + 7 * scale + 4, w, 2);
    ctx.fillStyle = C.black; ctx.fillRect(Math.round(x0 + w * 0.35), y + 7 * scale + 4, Math.round(w * 0.3), 2);
    return;
  }
  const S = devScale(ctx);
  const cap = 7 * scale;
  const px = sizeForCap(FONT.display, 400, cap);
  ctx.save();
  ctx.font = `400 ${px.toFixed(2)}px ${FONT.display}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = (px * 0.03).toFixed(2) + 'px';
  const w = ctx.measureText(text).width;
  const x0 = opts.align === 'left' ? x : x - w / 2;
  const base = y + cap;
  const col = opts.color || C.gold;
  const g = ctx.createLinearGradient(0, y, 0, base);
  if (col === C.gold) { g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#ffd84a'); g.addColorStop(1, '#e8900c'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, col); }
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 2 * S;
  ctx.fillStyle = '#0a0a0a'; ctx.fillText(text, x0 + 0.6, base + 1.4);
  ctx.shadowColor = 'rgba(255,190,60,0.35)'; ctx.shadowBlur = 14 * S; ctx.shadowOffsetY = 0;
  ctx.fillStyle = g; ctx.fillText(text, x0, base);
  ctx.restore();
  // underline: yellow with a black centre, fading at the ends
  const uy = base + 4, ug = ctx.createLinearGradient(x0 - 10, 0, x0 + w + 10, 0);
  ug.addColorStop(0, 'rgba(242,200,17,0)'); ug.addColorStop(0.15, C.red); ug.addColorStop(0.38, C.red); ug.addColorStop(0.4, C.black); ug.addColorStop(0.6, C.black); ug.addColorStop(0.62, C.red); ug.addColorStop(0.85, C.red); ug.addColorStop(1, 'rgba(242,200,17,0)');
  ctx.save(); ctx.shadowColor = 'rgba(242,200,17,0.5)'; ctx.shadowBlur = 8 * S;
  ctx.fillStyle = ug; rrect(ctx, x0 - 10, uy, w + 20, 2, 1); ctx.fill(); ctx.restore();
}

// Remove the HTML "LOADING..." overlay (index.html) once the first scene is up.
export function hideLoader() {
  try { const el = typeof document !== 'undefined' && document.getElementById && document.getElementById('loading'); if (el) el.remove(); } catch (e) { /* headless */ }
}

// A lad standing at (x, feet): the rigged 3D character when the 3D renderer is loaded (render3d/menustage.js),
// the 2D doll otherwise. scale = the doll scale (the 3D figure is matched to the doll's height).
// opts: { key (one per figure on screen), anim, pose, flip, face, yaw, light, dark }
export function ladFigure(ctx, look, x, feet, scale, t, opts = {}) {
  const stage = r3d.menu;
  const h = 41 * scale * (look.height || 1);
  if (stage && stage.ready) {
    const yaw = opts.yaw ?? (opts.flip ? -0.5 : 0.5);
    const rect = { x: x - h * 0.75, y: feet - h * 1.25, w: h * 1.5, h: h * 1.25 + 8 };
    if (stage.draw(ctx, opts.key || 'lad', [{ look, x, feet, h, anim: opts.anim || 'idle', pose: opts.pose || null, phase: 0, yaw, dark: opts.dark }], rect, t, { light: opts.light || 'studio' })) return;
  }
  drawDoll(ctx, x, feet, look, opts.pose || sampleAnim(opts.anim || 'idle', t), { scale, flip: opts.flip, time: t, face: opts.face || 'angry', silhouette: opts.dark ? '#141018' : null });
}
