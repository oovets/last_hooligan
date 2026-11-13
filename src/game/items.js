// Pickups, weapons and projectiles.
//
// ITEM DEF: {
//   name, kind: 'heal'|'cash'|'scarf'|'badge'|'key'|'weapon'|'life'|'fanzine'|'ticket'|'power',
//   auto: true -> picked up by walking over it (otherwise press USE),
//   heal (hp), cash (£), score, stash: true -> goes to inventory slots (consumable used with 1/2/3),
//   weapon: { dmg, reach, durability, attack:'swing'|'thrust', knockdown, throwDmg, breaks:'glass'|'wood'|'metal' },
//   icon(ctx, x, y, t)          draw ~12x12 icon centred on (x,y) bottom (used in world + HUD)
//   drawHeld(ctx, hx, hy, ang, s, flash)  draw when held in hand (weapons)
// }
import { toScreen } from '../engine/iso.js';
import { shadow, thick, ellipse, fillPoly, line } from '../engine/gfx.js';
import { drawText } from '../engine/font.js';

export const ITEMS = {};
export function registerItem(id, def) { ITEMS[id] = { id, ...def }; }

const O = '#120c14';
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

// ---------------------------------------------------------------- consumables
registerItem('pint', {
  name: 'PINT OF BITTER', kind: 'heal', heal: 30, score: 50, stash: true, auto: true,
  icon(ctx, x, y, t = 0) {
    px(ctx, O, x - 5, y - 13, 9, 13); px(ctx, O, x + 4, y - 10, 3, 6);
    px(ctx, '#c8dce8', x - 4, y - 12, 7, 11);
    px(ctx, '#8a4a10', x - 4, y - 9, 7, 8);
    px(ctx, '#b86a18', x - 3, y - 9, 5, 7);
    px(ctx, '#e0a040', x - 3, y - 8, 1, 6);
    px(ctx, '#fbf6e8', x - 4, y - 12, 7, 3); px(ctx, '#fbf6e8', x - 5, y - 13, 3, 1); px(ctx, '#e8e0c8', x - 2, y - 10, 5, 1);
    px(ctx, '#ffffff', x + 1, y - 7, 1, 1); if (Math.floor(t * 3) % 2) px(ctx, '#ffe0a0', x - 1, y - 4, 1, 1);
    px(ctx, '#c8dce8', x + 4, y - 9, 1, 4); px(ctx, '#8aa4b4', x + 5, y - 9, 1, 4);
    px(ctx, '#e8f4fa', x - 4, y - 2, 7, 1);
  },
});
registerItem('pie', {
  name: 'MEAT PIE', kind: 'heal', heal: 20, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t = 0) {
    px(ctx, O, x - 7, y - 8, 14, 8);
    px(ctx, '#b8bcc4', x - 6, y - 3, 12, 2); px(ctx, '#8a8e96', x - 6, y - 2, 12, 1);
    px(ctx, '#c8862e', x - 6, y - 7, 12, 4);
    px(ctx, '#e8b45a', x - 5, y - 7, 9, 2); px(ctx, '#f4d080', x - 4, y - 7, 3, 1);
    for (let i = 0; i < 6; i++) px(ctx, '#8a5016', x - 6 + i * 2, y - 4, 1, 1);
    px(ctx, '#6a3a10', x - 1, y - 6, 2, 1);
    const st = Math.floor(t * 4) % 3;
    px(ctx, '#e8e8f0', x - 2 + st, y - 11, 1, 2); px(ctx, '#e8e8f0', x + 1 - st, y - 13, 1, 2);
  },
});
registerItem('kebab', {
  name: 'LATE NIGHT KEBAB', kind: 'heal', heal: 55, score: 80, stash: true, auto: true,
  icon(ctx, x, y, t = 0) {
    px(ctx, O, x - 6, y - 12, 12, 12);
    px(ctx, '#f4ecd4', x - 5, y - 6, 10, 5); px(ctx, '#d8ccb0', x - 5, y - 2, 10, 1);
    px(ctx, '#e8d8a8', x - 5, y - 11, 10, 5);
    px(ctx, '#8c4a22', x - 4, y - 10, 8, 3); px(ctx, '#a86030', x - 3, y - 10, 3, 1);
    px(ctx, '#3fa040', x - 4, y - 11, 3, 1); px(ctx, '#6ad050', x - 3, y - 11, 1, 1);
    px(ctx, '#d83020', x + 1, y - 11, 2, 1); px(ctx, '#f0e8d0', x + 3, y - 9, 1, 1);
    px(ctx, '#e04020', x - 1, y - 7, 1, 2); px(ctx, '#e04020', x + 2, y - 7, 1, 1);
    const st = Math.floor(t * 4) % 3;
    px(ctx, '#e8e8f0', x - 1 + st, y - 15, 1, 2);
  },
});
registerItem('energy', {
  name: 'ENERGY DRINK', kind: 'heal', heal: 15, score: 30, stash: true, auto: true,
  icon(ctx, x, y) {
    px(ctx, O, x - 4, y - 12, 8, 12);
    px(ctx, '#2a62d8', x - 3, y - 10, 6, 9);
    px(ctx, '#5a8af0', x - 2, y - 10, 1, 9); px(ctx, '#1a3a90', x + 2, y - 10, 1, 9);
    px(ctx, '#c8d0dc', x - 3, y - 11, 6, 1); px(ctx, '#e8eef4', x - 2, y - 11, 2, 1);
    px(ctx, '#8a929c', x - 3, y - 2, 6, 1);
    px(ctx, '#ffd23a', x, y - 9, 2, 2); px(ctx, '#ffd23a', x - 1, y - 7, 2, 2); px(ctx, '#ffd23a', x, y - 5, 1, 2);
  },
});
registerItem('cash5', {
  name: 'FIVER', kind: 'cash', cash: 5, score: 50, auto: true,
  icon(ctx, x, y, t) {
    const b = Math.sin(t * 6) > 0 ? 0 : 1;
    px(ctx, O, x - 7, y - 7 - b, 14, 8);
    px(ctx, '#5aa078', x - 6, y - 6 - b, 12, 6);
    px(ctx, '#7ac898', x - 6, y - 6 - b, 12, 1);
    px(ctx, '#b0e0c0', x - 4, y - 5 - b, 4, 4); px(ctx, '#2e6040', x - 3, y - 4 - b, 2, 2);
    px(ctx, '#2e6040', x + 1, y - 5 - b, 4, 1); px(ctx, '#2e6040', x + 1, y - 3 - b, 3, 1);
    px(ctx, '#b0e0c0', x + 3, y - 2 - b, 2, 1);
  },
});
registerItem('cash20', {
  name: 'SCORE (£20)', kind: 'cash', cash: 20, score: 200, auto: true,
  icon(ctx, x, y, t) {
    const b = Math.sin(t * 6) > 0 ? 0 : 1;
    px(ctx, O, x - 7, y - 7 - b, 14, 8);
    px(ctx, '#8a5ab8', x - 6, y - 6 - b, 12, 6);
    px(ctx, '#a87ad0', x - 6, y - 6 - b, 12, 1);
    px(ctx, '#d8c0f0', x - 4, y - 5 - b, 4, 4); px(ctx, '#4a2a70', x - 3, y - 4 - b, 2, 2);
    px(ctx, '#4a2a70', x + 1, y - 5 - b, 4, 1); px(ctx, '#4a2a70', x + 1, y - 3 - b, 3, 1);
    px(ctx, '#d8c0f0', x + 3, y - 2 - b, 2, 1);
  },
});
registerItem('coin', {
  name: 'QUID', kind: 'cash', cash: 1, score: 10, auto: true,
  icon(ctx, x, y, t) {
    const w = Math.max(1, Math.round(Math.abs(Math.cos(t * 5)) * 4));
    ellipse(ctx, x, y - 5, w + 1, 5, O);
    ellipse(ctx, x, y - 5, w, 4, '#c89a20');
    if (w > 1) { ellipse(ctx, x - 0.5, y - 5, Math.max(1, w - 1), 3, '#e8c040'); px(ctx, '#fff4c0', x - Math.max(1, w - 1), y - 7, 1, 2); }
  },
});
registerItem('scarf', {
  name: 'LOST SCARF', kind: 'scarf', score: 500, auto: true,
  icon(ctx, x, y, t) {
    const bob = Math.round(Math.sin(t * 3) * 1.5);
    for (let i = 0; i < 7; i++) { const w = Math.round(Math.sin(t * 4 + i * 0.9) * 1); px(ctx, O, x - 8 + i * 2, y - 11 + bob + w, 3, 7); }
    for (let i = 0; i < 7; i++) {
      const w = Math.round(Math.sin(t * 4 + i * 0.9) * 1);
      px(ctx, i % 2 ? '#f4f1e8' : '#c8102e', x - 7 + i * 2, y - 10 + bob + w, 2, 5);
      px(ctx, i % 2 ? '#c8c4b8' : '#8a0a20', x - 7 + i * 2, y - 6 + bob + w, 2, 1);
    }
    for (let k = 0; k < 3; k++) { px(ctx, '#f4f1e8', x - 8, y - 9 + bob + k * 2, 1, 1); px(ctx, '#f4f1e8', x + 6, y - 9 + bob + k * 2, 1, 1); }
  },
});
registerItem('badge', {
  name: 'PIN BADGE', kind: 'badge', score: 2000, auto: true,
  icon(ctx, x, y, t) {
    const g = Math.floor(t * 4) % 4 === 0;
    const b = Math.round(Math.sin(t * 3));
    px(ctx, O, x - 5, y - 13 + b, 11, 10); px(ctx, O, x - 4, y - 3 + b, 9, 1); px(ctx, O, x - 2, y - 2 + b, 5, 1);
    px(ctx, '#d4af37', x - 4, y - 12 + b, 9, 8); px(ctx, '#d4af37', x - 3, y - 4 + b, 7, 1); px(ctx, '#d4af37', x - 1, y - 3 + b, 3, 1);
    px(ctx, '#c8102e', x - 3, y - 11 + b, 7, 6); px(ctx, '#c8102e', x - 2, y - 5 + b, 5, 1);
    px(ctx, '#f4f1e8', x, y - 10 + b, 1, 5); px(ctx, '#f4f1e8', x - 1, y - 9 + b, 3, 1); px(ctx, '#f4f1e8', x - 2, y - 6 + b, 1, 1); px(ctx, '#f4f1e8', x + 2, y - 6 + b, 1, 1); px(ctx, '#f4f1e8', x - 1, y - 5 + b, 3, 1);
    px(ctx, '#fff4c0', x - 4, y - 12 + b, 2, 1);
    if (g) { px(ctx, '#ffffff', x + 5, y - 15 + b, 1, 3); px(ctx, '#ffffff', x + 4, y - 14 + b, 3, 1); }
  },
});
registerItem('key', {
  name: 'KEY', kind: 'key', score: 100, auto: true,
  icon(ctx, x, y, t) {
    const b = Math.round(Math.sin(t * 4));
    ellipse(ctx, x - 4, y - 6 + b, 4, 4, O); ellipse(ctx, x - 4, y - 6 + b, 3, 3, '#c89a20'); ellipse(ctx, x - 4, y - 6 + b, 1, 1, O);
    px(ctx, O, x - 1, y - 7 + b, 8, 3); px(ctx, '#e8c040', x - 1, y - 6 + b, 7, 1);
    px(ctx, O, x + 3, y - 5 + b, 4, 3); px(ctx, '#e8c040', x + 3, y - 5 + b, 1, 2); px(ctx, '#e8c040', x + 5, y - 5 + b, 1, 2);
    px(ctx, '#fff4c0', x - 6, y - 8 + b, 1, 1);
    if (Math.floor(t * 3) % 4 === 0) px(ctx, '#ffffff', x + 6, y - 9 + b, 1, 1);
  },
});
registerItem('ticket', {
  name: 'MATCH TICKET', kind: 'key', keyId: 'ticket', score: 100, auto: true,
  icon(ctx, x, y, t) {
    const b = Math.round(Math.sin(t * 4));
    px(ctx, O, x - 7, y - 10 + b, 14, 8);
    px(ctx, '#f0e6c8', x - 6, y - 9 + b, 12, 6);
    px(ctx, '#c8102e', x - 6, y - 9 + b, 3, 6);
    for (let i = 0; i < 3; i++) px(ctx, '#c8b890', x + 2, y - 9 + b + i * 2, 1, 1);
    px(ctx, '#504840', x - 2, y - 8 + b, 3, 1); px(ctx, '#504840', x - 2, y - 6 + b, 4, 1);
    for (let i = 0; i < 3; i++) px(ctx, '#2a2420', x + 4 + (i & 1), y - 8 + b + i, 1, 1);
    px(ctx, '#f4f1e8', x - 5, y - 7 + b, 1, 2);
  },
});
registerItem('life', {
  name: 'LUCKY GOLDEN BOOT', kind: 'life', score: 1000, auto: true,
  icon(ctx, x, y, t) {
    const b = Math.round(Math.sin(t * 3) * 2);
    px(ctx, O, x - 4, y - 14 + b, 7, 10); px(ctx, O, x - 4, y - 7 + b, 11, 5);
    px(ctx, '#c89a20', x - 3, y - 13 + b, 5, 9); px(ctx, '#c89a20', x - 3, y - 6 + b, 9, 3);
    px(ctx, '#e8c040', x - 2, y - 13 + b, 2, 8); px(ctx, '#e8c040', x - 2, y - 6 + b, 7, 1);
    px(ctx, '#fff4c0', x - 2, y - 12 + b, 1, 4);
    px(ctx, '#8a6a10', x - 3, y - 9 + b, 5, 1);
    for (let i = 0; i < 3; i++) px(ctx, O, x - 2 + i * 3, y - 3 + b, 1, 1);
    const sp = Math.floor(t * 5) % 3;
    if (sp === 0) { px(ctx, '#ffffff', x + 5, y - 13 + b, 1, 3); px(ctx, '#ffffff', x + 4, y - 12 + b, 3, 1); }
    else if (sp === 1) px(ctx, '#ffffff', x - 6, y - 10 + b, 1, 1);
  },
});
registerItem('fanzine', {
  name: 'FANZINE', kind: 'fanzine', score: 300, auto: false,
  icon(ctx, x, y) {
    px(ctx, O, x - 6, y - 13, 12, 13);
    px(ctx, '#e8e4d8', x - 5, y - 12, 10, 11);
    px(ctx, '#c8102e', x - 5, y - 12, 10, 3);
    px(ctx, '#f4f1e8', x - 4, y - 11, 2, 1); px(ctx, '#f4f1e8', x - 1, y - 11, 3, 1);
    px(ctx, '#5a5a5a', x - 4, y - 8, 4, 4); px(ctx, '#e2a97a', x - 3, y - 7, 2, 2);
    px(ctx, '#404040', x + 1, y - 8, 3, 1); px(ctx, '#404040', x + 1, y - 6, 3, 1); px(ctx, '#404040', x - 4, y - 3, 8, 1);
    px(ctx, '#a8a8a8', x - 6, y - 10, 1, 1); px(ctx, '#a8a8a8', x - 6, y - 4, 1, 1);
    px(ctx, '#c8c4b8', x + 4, y - 12, 1, 11);
  },
});

// ---------------------------------------------------------------- weapons
function heldStick(len, w, color, tipColor, tipLen = 0) {
  return (ctx, hx, hy, ang, s = 1, flash) => {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const bx = hx - dx * 2 * s, by = hy - dy * 2 * s;
    const ex = hx + dx * len * s, ey = hy + dy * len * s;
    thick(ctx, bx, by, ex, ey, w + 2, O);
    thick(ctx, bx, by, ex, ey, w, flash ? '#fff' : color);
    if (tipColor) thick(ctx, hx + dx * (len - tipLen) * s, hy + dy * (len - tipLen) * s, ex, ey, w, flash ? '#fff' : tipColor);
    if (!flash && w >= 2) line(ctx, bx - dy * 0.6, by + dx * 0.6, ex - dy * 0.6, ey + dx * 0.6, shadeHi(color));
  };
}
const HI = {};
function shadeHi(c) { return HI[c] || (HI[c] = (() => { const n = parseInt(c.slice(1), 16); const f = v => Math.min(255, Math.round(v + (255 - v) * 0.35)); return '#' + ((1 << 24) | (f(n >> 16 & 255) << 16) | (f(n >> 8 & 255) << 8) | f(n & 255)).toString(16).slice(1); })()); }

registerItem('bottle', {
  name: 'BROWN BOTTLE', kind: 'weapon', score: 0,
  weapon: { dmg: 11, reach: 1.25, durability: 1, attack: 'swing', throwDmg: 14, breaks: 'glass' },
  icon(ctx, x, y) {
    px(ctx, O, x - 3, y - 10, 6, 10); px(ctx, O, x - 2, y - 15, 4, 6);
    px(ctx, '#5a3010', x - 2, y - 9, 4, 8); px(ctx, '#7a4818', x - 1, y - 14, 2, 6);
    px(ctx, '#e8dcb0', x - 2, y - 7, 4, 3); px(ctx, '#c8102e', x - 2, y - 6, 4, 1);
    px(ctx, '#c08040', x - 1, y - 9, 1, 2); px(ctx, '#d8a060', x - 1, y - 13, 1, 3);
    px(ctx, '#c8c8c0', x - 1, y - 15, 2, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const n0x = hx - dx * 1.5 * s, n0y = hy - dy * 1.5 * s;
    const n1x = hx + dx * 3 * s, n1y = hy + dy * 3 * s;
    const ex = hx + dx * 10 * s, ey = hy + dy * 10 * s;
    thick(ctx, n0x, n0y, n1x, n1y, 4, O);
    thick(ctx, n1x, n1y, ex, ey, 5, O);
    thick(ctx, n0x, n0y, n1x, n1y, 2, flash ? '#fff' : '#7a4818');
    thick(ctx, n1x, n1y, ex, ey, 3, flash ? '#fff' : '#5a3010');
    if (!flash) {
      const mx = hx + dx * 6 * s, my = hy + dy * 6 * s;
      thick(ctx, mx, my, mx + dx * 2 * s, my + dy * 2 * s, 3, '#e8dcb0');
      line(ctx, n1x - dy, n1y + dx, ex - dy, ey + dx, '#c08040');
    }
  },
});
registerItem('chair', {
  name: 'PUB CHAIR', kind: 'weapon', score: 0,
  weapon: { dmg: 14, reach: 1.4, durability: 3, attack: 'swing', knockdown: true, throwDmg: 16, breaks: 'wood' },
  icon(ctx, x, y) {
    px(ctx, O, x - 5, y - 15, 11, 15);
    px(ctx, '#6a4422', x - 4, y - 14, 2, 14); px(ctx, '#6a4422', x + 3, y - 7, 2, 7); px(ctx, '#5a3a1a', x - 1, y - 6, 1, 6);
    px(ctx, '#a8703c', x - 4, y - 8, 9, 2); px(ctx, '#c88a50', x - 4, y - 8, 9, 1);
    px(ctx, '#8a5a30', x - 4, y - 14, 2, 6); px(ctx, '#a8703c', x - 4, y - 14, 1, 6);
    px(ctx, '#8a5a30', x - 2, y - 13, 2, 1); px(ctx, '#8a5a30', x - 2, y - 11, 2, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 9 * s, ey = hy + dy * 9 * s;
    const px2 = -dy, py2 = dx;
    const seat = [{ x: ex - px2 * 6, y: ey - py2 * 6 }, { x: ex + px2 * 6, y: ey + py2 * 6 }, { x: ex + px2 * 6 + dx * 3, y: ey + py2 * 6 + dy * 3 }, { x: ex - px2 * 6 + dx * 3, y: ey - py2 * 6 + dy * 3 }];
    // legs
    for (const k of [-5, 4]) { const lx = ex + px2 * k, ly = ey + py2 * k; thick(ctx, lx, ly, lx + dx * 9, ly + dy * 9, 3, O); thick(ctx, lx, ly, lx + dx * 9, ly + dy * 9, 1, flash ? '#fff' : '#6a4422'); }
    thick(ctx, hx, hy, ex, ey, 4, O);
    thick(ctx, hx, hy, ex, ey, 2, flash ? '#fff' : '#8a5a30');
    fillPoly(ctx, seat.map(q => ({ x: q.x - 1, y: q.y - 1 })), O); fillPoly(ctx, seat.map(q => ({ x: q.x + 1, y: q.y + 1 })), O);
    fillPoly(ctx, seat, flash ? '#fff' : '#a8703c');
  },
});
registerItem('binlid', {
  name: 'BIN LID', kind: 'weapon', score: 0,
  weapon: { dmg: 9, reach: 1.2, durability: 5, attack: 'swing', throwDmg: 12, breaks: 'metal' },
  icon(ctx, x, y) {
    ellipse(ctx, x, y - 5, 8, 5, O); ellipse(ctx, x, y - 5, 7, 4, '#8c9298'); ellipse(ctx, x, y - 6, 5, 2, '#a8aeb4');
    px(ctx, '#d0d6dc', x - 4, y - 8, 4, 1); px(ctx, O, x - 2, y - 7, 4, 2); px(ctx, '#5a6066', x - 1, y - 7, 2, 1);
    px(ctx, '#6a7076', x - 6, y - 3, 12, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    ellipse(ctx, hx, hy, 7 * s, 7 * s, O); ellipse(ctx, hx, hy, 6 * s, 6 * s, flash ? '#fff' : '#7a8086');
    if (!flash) { ellipse(ctx, hx - 1, hy - 1, 4 * s, 4 * s, '#a8aeb4'); ctx.fillStyle = '#d8dee4'; ctx.fillRect(Math.round(hx - 3 * s), Math.round(hy - 3 * s), 2, 1); ctx.fillStyle = '#5a6066'; ctx.fillRect(Math.round(hx + 3 * s), Math.round(hy + 2 * s), 2, 1); }
  },
});
registerItem('pipe', {
  name: 'LEAD PIPE', kind: 'weapon', score: 0,
  weapon: { dmg: 13, reach: 1.45, durability: 8, attack: 'swing', throwDmg: 14, breaks: 'metal' },
  icon(ctx, x, y) {
    px(ctx, O, x - 8, y - 6, 15, 5); px(ctx, O, x + 4, y - 7, 4, 7);
    px(ctx, '#6e7880', x - 7, y - 5, 12, 3); px(ctx, '#a8b0b8', x - 7, y - 5, 12, 1); px(ctx, '#4a5258', x - 7, y - 3, 12, 1);
    px(ctx, '#8a929a', x + 5, y - 6, 2, 5); px(ctx, '#c8d0d8', x + 5, y - 6, 1, 5);
  },
  drawHeld: heldStick(12, 2, '#7a848c', '#a8b0b8', 2),
});
registerItem('flag', {
  name: 'CORNER FLAG', kind: 'weapon', score: 0,
  weapon: { dmg: 10, reach: 1.75, durability: 6, attack: 'thrust', throwDmg: 12, breaks: 'wood' },
  icon(ctx, x, y, t = 0) {
    px(ctx, O, x - 2, y - 17, 3, 17); px(ctx, '#f0f0f0', x - 1, y - 16, 1, 16);
    const w = Math.floor(t * 6) % 2;
    px(ctx, O, x, y - 17, 8, 7);
    px(ctx, '#ffd23a', x + 1, y - 16 + w, 3, 2); px(ctx, '#c8102e', x + 4, y - 16 + w, 3, 2);
    px(ctx, '#c8102e', x + 1, y - 14 + w, 3, 2); px(ctx, '#ffd23a', x + 4, y - 14 + w, 3, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    heldStick(17, 1, '#f0f0f0')(ctx, hx, hy, ang, s, flash);
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 16 * s, ey = hy + dy * 16 * s;
    const px2 = -dy, py2 = dx;
    const pts = [{ x: ex, y: ey }, { x: ex + px2 * 6, y: ey + py2 * 6 }, { x: ex + px2 * 6 - dx * 4, y: ey + py2 * 6 - dy * 4 }, { x: ex - dx * 4, y: ey - dy * 4 }];
    fillPoly(ctx, pts.map(q => ({ x: q.x + 1, y: q.y + 1 })), O);
    fillPoly(ctx, pts, flash ? '#fff' : '#ffd23a');
    if (!flash) { const m = { x: ex + px2 * 3 - dx * 2, y: ey + py2 * 3 - dy * 2 }; ctx.fillStyle = '#c8102e'; ctx.fillRect(Math.round(m.x - 1), Math.round(m.y - 1), 2, 2); }
  },
});
registerItem('cone', {
  name: 'TRAFFIC CONE', kind: 'weapon', score: 0,
  weapon: { dmg: 5, reach: 1.2, durability: 4, attack: 'swing', throwDmg: 8, breaks: 'plastic' },
  icon(ctx, x, y) {
    px(ctx, O, x - 6, y - 2, 13, 3); px(ctx, '#1a1a1e', x - 5, y - 1, 11, 1);
    fillPoly(ctx, [{ x: x - 1, y: y - 14 }, { x: x + 2, y: y - 14 }, { x: x + 6, y: y - 1 }, { x: x - 5, y: y - 1 }], O);
    fillPoly(ctx, [{ x: x, y: y - 13 }, { x: x + 1, y: y - 13 }, { x: x + 5, y: y - 2 }, { x: x - 4, y: y - 2 }], '#ff6a1a');
    px(ctx, '#ffffff', x - 2, y - 8, 5, 2); px(ctx, '#ff9a5a', x - 1, y - 12, 1, 9);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang), pxv = -dy, pyv = dx;
    const ex = hx + dx * 10 * s, ey = hy + dy * 10 * s;
    const pts = [{ x: hx - pxv, y: hy - pyv }, { x: hx + pxv, y: hy + pyv }, { x: ex + pxv * 4, y: ey + pyv * 4 }, { x: ex - pxv * 4, y: ey - pyv * 4 }];
    fillPoly(ctx, pts.map(q => ({ x: q.x - 1, y: q.y })), O); fillPoly(ctx, pts.map(q => ({ x: q.x + 1, y: q.y + 1 })), O);
    fillPoly(ctx, pts, flash ? '#fff' : '#ff6a1a');
    if (!flash) { const m = { x: hx + dx * 6 * s, y: hy + dy * 6 * s }; thick(ctx, m.x - pxv * 2, m.y - pyv * 2, m.x + pxv * 2, m.y + pyv * 2, 2, '#ffffff'); }
  },
});
registerItem('umbrella', {
  name: 'BROLLY', kind: 'weapon', score: 0,
  weapon: { dmg: 8, reach: 1.5, durability: 5, attack: 'thrust', throwDmg: 9, breaks: 'metal' },
  icon(ctx, x, y) {
    px(ctx, O, x - 7, y - 6, 14, 5); px(ctx, O, x + 5, y - 8, 3, 4);
    px(ctx, '#1a1a22', x - 6, y - 5, 10, 3); px(ctx, '#3a3a4a', x - 5, y - 5, 8, 1);
    px(ctx, '#c8c8d0', x - 7, y - 4, 1, 1);
    px(ctx, '#8a5a30', x + 4, y - 4, 2, 1); px(ctx, '#8a5a30', x + 6, y - 7, 1, 3); px(ctx, '#8a5a30', x + 5, y - 7, 1, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    heldStick(14, 1, '#c8c8d0')(ctx, hx, hy, ang, s, flash);
    const a = { x: hx + dx * 3 * s, y: hy + dy * 3 * s }, b = { x: hx + dx * 12 * s, y: hy + dy * 12 * s };
    thick(ctx, a.x, a.y, b.x, b.y, 5, O); thick(ctx, a.x, a.y, b.x, b.y, 3, flash ? '#fff' : '#1a1a22');
    if (!flash) line(ctx, a.x - dy, a.y + dx, b.x - dy, b.y + dx, '#3a3a4a');
    const hk = { x: hx - dx * 3 * s, y: hy - dy * 3 * s };
    thick(ctx, hx, hy, hk.x, hk.y, 3, O); thick(ctx, hk.x, hk.y, hk.x - dy * 2, hk.y + dx * 2, 3, O);
    line(ctx, hx, hy, hk.x, hk.y, flash ? '#fff' : '#8a5a30'); line(ctx, hk.x, hk.y, hk.x - dy * 2, hk.y + dx * 2, flash ? '#fff' : '#8a5a30');
  },
});
registerItem('brick', {
  name: 'HALF BRICK', kind: 'weapon', score: 0,
  weapon: { dmg: 9, reach: 1.1, durability: 2, attack: 'swing', throwDmg: 16, breaks: 'stone' },
  icon(ctx, x, y) {
    px(ctx, O, x - 6, y - 7, 12, 7);
    px(ctx, '#a04830', x - 5, y - 6, 10, 5); px(ctx, '#c86848', x - 5, y - 6, 10, 1); px(ctx, '#7a3020', x - 5, y - 2, 10, 1);
    px(ctx, '#8a3a24', x + 4, y - 6, 1, 5);
    px(ctx, '#5a2018', x - 3, y - 4, 1, 1); px(ctx, '#d8a080', x + 1, y - 4, 1, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    px(ctx, O, hx - 5, hy - 4, 10, 7);
    px(ctx, flash ? '#fff' : '#a04830', hx - 4, hy - 3, 8, 5);
    if (!flash) { px(ctx, '#c86848', hx - 4, hy - 3, 8, 1); px(ctx, '#7a3020', hx - 4, hy + 1, 8, 1); }
  },
});

// ---------------------------------------------------------------- world entities
let IID = 1;
export class WorldItem {
  constructor(type, x, y, z = 0, extra = {}) {
    this.id = IID++;
    this.kind = 'item';
    this.type = type;
    this.def = ITEMS[type];
    if (!this.def) console.warn('unknown item', type);
    this.x = x; this.y = y; this.z = z;
    this.vx = extra.vx || 0; this.vy = extra.vy || 0; this.vz = extra.vz || 0;
    this.t = Math.random() * 10;
    this.removed = false;
    this.durability = extra.durability ?? (this.def && this.def.weapon ? this.def.weapon.durability : 1);
    this.data = extra.data || {};
    this.pickDelay = extra.pickDelay || 0;
    this.life = extra.life || 0; // >0: despawns after this many seconds
  }
  update(world, dt) {
    this.t += dt;
    if (this.pickDelay > 0) this.pickDelay -= dt;
    if (this.life > 0) { this.life -= dt; if (this.life <= 0) this.removed = true; }
    if (this.vx || this.vy || this.vz || this.z > 0) {
      world.moveEntity(this, this.vx * dt, this.vy * dt, 0.15);
      const g = world.groundHeight(this.x, this.y, this.z);
      this.vz -= 24 * dt; this.z += this.vz * dt;
      if (this.z <= g) { this.z = g; this.vz = this.vz < -3 ? -this.vz * 0.3 : 0; this.vx *= 0.6; this.vy *= 0.6; if (Math.abs(this.vx) < 0.05) this.vx = 0; if (Math.abs(this.vy) < 0.05) this.vy = 0; }
    }
  }
  draw(ctx, world) {
    if (!this.def) return;
    const s = toScreen(this.x, this.y, this.z);
    shadow(ctx, s.x, s.y, 5, 2, 0.3);
    if (this.life > 0 && this.life < 2 && Math.floor(this.life * 10) % 2) return;
    this.def.icon(ctx, s.x, s.y - 1, this.t);
    if (!this.def.auto && world.player && Math.hypot(world.player.x - this.x, world.player.y - this.y) < 1.0) {
      drawText(ctx, 'E', s.x, s.y - 24 + Math.round(Math.sin(this.t * 6)), { color: '#ffe14a', align: 'center', outline: '#000' });
    }
  }
}

// Thrown weapon / bottle projectile.
export class Projectile {
  constructor(o) {
    this.id = IID++;
    this.kind = 'projectile';
    Object.assign(this, { x: 0, y: 0, z: 1.4, vx: 0, vy: 0, vz: 1.5, dmg: 10, owner: null, team: 'player', type: 'bottle', spin: 0, removed: false, hit: new Set(), grav: 0.5 }, o);
    this.def = ITEMS[this.type];
  }
  update(world, dt) {
    this.spin += dt * 18;
    const blocked = world.moveEntity(this, this.vx * dt, this.vy * dt, 0.1);
    this.vz -= 24 * this.grav * dt; this.z += this.vz * dt;
    for (const f of world.fighters) {
      if (!f.alive || f.team === this.team || this.hit.has(f) || f.invuln > 0 || f.state === 'down') continue;
      if (Math.hypot(f.x - this.x, f.y - this.y) < f.r + 0.25 && this.z > f.z - 0.2 && this.z < f.z + 2.4) {
        this.hit.add(f);
        if (this.def && this.def.onHitFighter) { this.def.onHitFighter(this, f, world); this.removed = true; return; }   // (e.g. Big Al's shirt)
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const res = f.takeHit({ attacker: this.owner, def: { hz: 1.5, sfx: 'hitHeavy', score: 30, hitstop: 0.05, shake: 3 }, dmg: this.dmg, dir: { x: this.vx / sp, y: this.vy / sp }, kb: 3, stun: 0.45, knockdown: this.dmg >= 14, launch: 1, guardDmg: this.dmg }, world);
        world.onHit(this.owner || this, f, { hz: 1.5, sfx: 'hitHeavy', score: 30, hitstop: 0.05, shake: 3 }, res, this.dmg);
        this.shatter(world);
        return;
      }
    }
    if (world.breakPropsAt && world.breakPropsAt(this.x, this.y, this.z, this.owner, this.dmg)) {
      if (this.def && this.def.onLand) { this.def.onLand(this, world); this.removed = true; return; }
      this.shatter(world);
    }
    const g = world.groundHeight(this.x, this.y, this.z);
    if ((blocked || this.z <= g) && this.def && this.def.onLand) { this.def.onLand(this, world); this.removed = true; return; }
    if (blocked || this.z <= g) this.shatter(world);
  }
  shatter(world) {
    if (this.removed) return;
    this.removed = true;
    const br = this.def && this.def.weapon ? this.def.weapon.breaks : 'glass';
    if (br === 'glass') { world.fx.glass(this.x, this.y, Math.max(0, this.z)); world.sfx('glass', this); }
    else { world.fx.debris(this.x, this.y, Math.max(0, this.z), ['#8a8a8a', '#5a5a5a']); world.sfx('clatter', this); }
  }
  draw(ctx) {
    const g = toScreen(this.x, this.y, 0);
    shadow(ctx, g.x, g.y, 4, 2, 0.3);
    const s = toScreen(this.x, this.y, this.z);
    if (this.def && this.def.drawHeld) this.def.drawHeld(ctx, s.x, s.y, this.spin, 1, false);
    else { ctx.fillStyle = '#fff'; ctx.fillRect(s.x - 1, s.y - 1, 3, 3); }
  }
}
