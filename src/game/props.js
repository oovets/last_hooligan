// Props: static/breakable/interactive scenery placed on tiles.
//
// PROP DEF (registerProp(id, def)):
// {
//   w:1, d:1          footprint in tiles (along world x / y)
//   h:0               collision height in units (0 = no collision). Entities can stand on props with h <= ~1.4 by jumping.
//   solid:true        false -> never collides
//   breakable: { hp, debris:['#hex',...], sfx:'wood'|'glass'|'metal', drops:[['itemId', chance], ...], score, leaves:'propId' }
//   light: { z, r, color, intensity (0..1), flicker:bool }   r in tiles; emits light in dark levels
//   pickup: 'itemId'  -> pressing USE next to it gives that weapon and removes the prop
//   interact: { kind:'door'|'gate'|'switch', key:'keyId'|null, msg }   -> USE opens it (removes collision) if player has key
//   draw(ctx, ax, ay, prop, t, world)   ax,ay = screen px of the prop's anchor (north corner of its first tile, ground level)
//   depthBias: 0      added to the painter's sort key
//   hazard: { dmg, kb, knockdown }      damages fighters touching it (e.g. live rail, fire barrel)
// }
// Level placement: { type, x, y, ...opts }  (opts are available as prop.o in draw()).
//   base: n   raises the whole prop by n units (stands on a terrace step / low wall). Collision top = base + h.
//
// Common props: crate barrel bin wheeliebin bench lamp bollard bollardLit cone barrier fence car phonebox tree skip pallet
// table chairProp door gate sign graffiti puddle postbox hydrant rubble weaponStash exitArrow
// flag billboard busStop newsStand trolley trafficLight.
// Shared opts: color (main colour), dir:'x'|'y' (orientation of long/flat props).
// Drawing helpers for theme/level authors are exported: cylinder(), boxLines(), OL.

import { toScreen } from '../engine/iso.js';
import { isoBox, isoQuad, isoPanel, fillPoly, ellipse, line, thick, proj, shadow } from '../engine/gfx.js';
import { shade } from '../engine/color.js';
import { drawText, measureText } from '../engine/font.js';
import { Z_PX } from '../engine/constants.js';

export const PROPS = {};
export function registerProp(id, def) { PROPS[id] = { w: 1, d: 1, h: 0, solid: true, depthBias: 0, ...def }; }

let PID = 1;
export class Prop {
  constructor(spec) {
    this.id = PID++;
    this.kind = 'prop';
    this.type = spec.type;
    this.def = PROPS[spec.type];
    if (!this.def) { console.warn('unknown prop', spec.type); this.def = PROPS.crate; }
    this.o = spec;
    this.x = spec.x; this.y = spec.y;
    this.w = spec.w ?? this.def.w; this.d = spec.d ?? this.def.d;
    // rotating props (vehicles): def footprint is for dir 'x'; dir 'y' turns it
    this.dir = spec.dir ?? this.def.defaultDir ?? 'x';
    if (this.def.rotates && this.dir === 'y' && spec.w === undefined && spec.d === undefined) { const t = this.w; this.w = this.d; this.d = t; }
    this.base = spec.base || 0;
    this.h = spec.h ?? this.def.h;
    this.solid = (spec.solid ?? this.def.solid) && this.h > 0;
    if (this.solid) this.h += this.base;    // collision top (stand on terrace steps etc.)
    this.hp = this.def.breakable ? (spec.hp ?? this.def.breakable.hp) : Infinity;
    this.removed = false;
    this.t = Math.random() * 10;
    this.open = false;
    this.flash = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.d / 2; }
  depth() {
    // long wall decals (sign/graffiti with len > 1) sort by their far end so later wall tiles don't cover them
    const lenBias = (this.type === 'sign' || this.type === 'graffiti') && (this.o.len || 1) > 1 && this.o.depthBias === undefined ? (this.o.len - 1) : 0;
    return this.x + this.w / 2 + this.y + this.d / 2 + (this.def.depthBias || 0) + (this.o.depthBias || 0) + lenBias;
  }
  update(dt) { this.t += dt; if (this.flash > 0) this.flash -= dt; }
  draw(ctx, world) {
    const a = toScreen(this.x, this.y, this.base);
    if (this.flash > 0) ctx.globalAlpha = 0.6;
    this.def.draw && this.def.draw(ctx, Math.round(a.x), Math.round(a.y), this, this.t, world);
    if (this.flash > 0 && Math.floor(this.flash * 30) % 2 === 0) {
      // white hit flicker
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'lighter';
      this.def.draw && this.def.draw(ctx, Math.round(a.x), Math.round(a.y), this, this.t, world);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}

export const OL = '#120c14';

// ------------------------------------------------------------------ helpers
// Shaded vertical cylinder standing at screen point (cx, cy): rx/ry ellipse radii, H height px.
// Lit from the upper-left: a highlight column left of centre, dark rim on the right.
export function cylinder(ctx, cx, cy, rx, ry, H, color, opts = {}) {
  const top = opts.top || shade(color, 0.12);
  cx = Math.round(cx); cy = Math.round(cy);
  if (opts.outline !== false) {
    ellipse(ctx, cx, cy, rx + 1, ry + 1, OL);
    ctx.fillStyle = OL; ctx.fillRect(cx - rx - 1, cy - H, rx * 2 + 2, H);
    ellipse(ctx, cx, cy - H, rx + 1, ry + 1, OL);
  }
  for (let i = -rx; i < rx; i++) {
    const f = (i + 0.5) / rx;
    const yb = Math.round(ry * Math.sqrt(Math.max(0, 1 - f * f)));
    let c;
    if (f < -0.55) c = shade(color, -0.08);
    else if (f < -0.15) c = shade(color, 0.22);
    else if (f < 0.45) c = color;
    else c = shade(color, -0.3);
    ctx.fillStyle = c;
    ctx.fillRect(cx + i, cy - H, 1, H + yb);
  }
  ellipse(ctx, cx, cy - H, rx, ry, top);
}
// draw lines on the outer faces of an iso box: rows (horizontal slats) on +y (left) and +x (right) faces
export function boxLines(ctx, ax, ay, x, y, z, w, d, h, n, color, colorR) {
  for (let i = 1; i < n; i++) {
    const zz = z + (h * i) / n;
    const a = proj(ax, ay, x, y + d, zz), b = proj(ax, ay, x + w, y + d, zz), c = proj(ax, ay, x + w, y, zz);
    line(ctx, a.x, a.y, b.x, b.y, color);
    line(ctx, b.x, b.y, c.x, c.y, colorR || color);
  }
}
const P_ = (ax, ay) => (x, y, z = 0) => proj(ax, ay, x, y, z);
const seg = (ctx, a, b, c) => line(ctx, a.x, a.y, b.x, b.y, c);
const tseg = (ctx, a, b, w, c) => thick(ctx, a.x, a.y, b.x, b.y, w, c);

// ------------------------------------------------------------------ common props
registerProp('crate', {
  h: 0.9,
  breakable: { hp: 12, debris: ['#8a6038', '#5e3e20', '#b08050'], sfx: 'wood', drops: [['pint', 0.25], ['cash5', 0.3], ['coin', 0.3]], score: 50 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#8a6038';
    const P = P_(ax, ay);
    const s = P(0.5, 0.5); shadow(ctx, s.x + 2, s.y + 1, 13, 6, 0.3);
    isoBox(ctx, ax, ay, 0.08, 0.08, 0, 0.84, 0.84, 0.9, { top: shade(c, 0.22), left: c, right: shade(c, -0.32), outline: OL });
    // slats + frame
    boxLines(ctx, ax, ay, 0.08, 0.08, 0, 0.84, 0.84, 0.9, 3, shade(c, -0.35), shade(c, -0.55));
    seg(ctx, P(0.12, 0.92, 0.08), P(0.88, 0.92, 0.82), shade(c, -0.28));
    seg(ctx, P(0.92, 0.12, 0.08), P(0.92, 0.88, 0.82), shade(c, -0.5));
    seg(ctx, P(0.1, 0.92, 0.86), P(0.9, 0.92, 0.86), shade(c, 0.3));
    // top boards
    for (const u of [0.36, 0.64]) seg(ctx, P(u, 0.1, 0.9), P(u, 0.9, 0.9), shade(c, -0.12));
    const n1 = P(0.15, 0.92, 0.8), n2 = P(0.85, 0.92, 0.15);
    ctx.fillStyle = '#2a2a2e'; ctx.fillRect(n1.x, n1.y, 1, 1); ctx.fillRect(n2.x, n2.y, 1, 1);
    if (p.o.label !== false) { const m = P(0.55, 0.92, 0.45); ctx.fillStyle = shade(c, -0.45); ctx.fillRect(m.x - 2, m.y - 1, 4, 2); }
  },
});
registerProp('barrel', {
  h: 1.0,
  breakable: { hp: 18, debris: ['#5a3a20', '#3a3a3a'], sfx: 'wood', drops: [['coin', 0.5]], score: 50 },
  draw(ctx, ax, ay, p, t) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    const c = p.o.color || '#6a4424';
    const H = Z_PX * 1.0;
    shadow(ctx, s.x + 2, s.y + 1, 11, 5, 0.3);
    cylinder(ctx, s.x, s.y, 8, 4, H, c, { top: shade(c, -0.25) });
    // hoops / ribs
    for (const hz of [4, H / 2 + 1, H - 3]) {
      ctx.fillStyle = '#2e2e34'; ctx.fillRect(s.x - 8, Math.round(s.y - hz), 16, 2);
      ctx.fillStyle = '#5a5a64'; ctx.fillRect(s.x - 6, Math.round(s.y - hz), 4, 1);
    }
    ellipse(ctx, s.x, s.y - H, 6, 3, shade(c, -0.45));
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(s.x + 2, s.y - H - 1, 2, 1); // bung
    if (p.o.fire) {
      ellipse(ctx, s.x, s.y - H, 6, 3, '#3a1408');
      const fl = (k, w, hgt, col) => {
        const fx = s.x - 5 + ((k * 37 + Math.floor(t * 14) * 13) % 10);
        const fh = hgt * (0.6 + 0.4 * Math.abs(Math.sin(t * 9 + k * 1.7)));
        ctx.fillStyle = col; ctx.fillRect(Math.round(fx), Math.round(s.y - H - fh), w, Math.round(fh));
      };
      for (let i = 0; i < 5; i++) fl(i, 3, 12, '#c8301a');
      for (let i = 0; i < 5; i++) fl(i + 7, 2, 9, '#ff8a20');
      for (let i = 0; i < 3; i++) fl(i + 13, 2, 5, '#ffe080');
      for (let i = 0; i < 3; i++) { // embers
        const e = (t * 0.9 + i * 0.33) % 1;
        ctx.fillStyle = e < 0.5 ? '#ffd040' : '#ff6a20';
        ctx.fillRect(Math.round(s.x - 3 + Math.sin(t * 3 + i * 2) * 4 + i * 2), Math.round(s.y - H - 10 - e * 16), 1, 1);
      }
    }
  },
});
registerProp('bin', { // council litter bin
  h: 1.1,
  breakable: { hp: 14, debris: ['#2a5a30', '#1a3a20', '#d0d0c0'], sfx: 'metal', drops: [['binlid', 0.5], ['pie', 0.2], ['coin', 0.3]], score: 40 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#2a5a30';
    const s = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, s.x + 1, s.y + 1, 9, 4, 0.3);
    cylinder(ctx, s.x, s.y, 7, 3, 21, c);
    for (let i = -5; i <= 5; i += 3) { ctx.fillStyle = shade(c, -0.35); ctx.fillRect(s.x + i, s.y - 17, 1, 13); }
    ctx.fillStyle = shade(c, -0.4); ctx.fillRect(s.x - 7, s.y - 4, 14, 1);
    ctx.fillStyle = '#d8c060'; ctx.fillRect(s.x - 2, s.y - 14, 4, 3); // little bin badge
    ellipse(ctx, s.x, s.y - 21, 8, 4, OL);
    ellipse(ctx, s.x, s.y - 22, 7, 3, shade(c, 0.25));
    ellipse(ctx, s.x, s.y - 22, 4, 2, '#141414');
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(s.x - 2, s.y - 25, 3, 2); // litter poking out
    ctx.fillStyle = '#c83030'; ctx.fillRect(s.x + 1, s.y - 24, 2, 1);
  },
});
registerProp('wheeliebin', {
  h: 1.2,
  breakable: { hp: 16, debris: ['#202428', '#404850'], sfx: 'metal', drops: [['pie', 0.3], ['coin', 0.4], ['brick', 0.2]], score: 40 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#22262c';
    const P = P_(ax, ay);
    const s = P(0.5, 0.5); shadow(ctx, s.x + 2, s.y + 1, 11, 5, 0.32);
    // wheels at the back (-x side)
    const w1 = P(0.18, 0.25, 0.08), w2 = P(0.18, 0.85, 0.08);
    ellipse(ctx, w1.x, w1.y, 3, 3, OL); ellipse(ctx, w2.x, w2.y, 3, 3, OL); ellipse(ctx, w2.x, w2.y, 2, 2, '#3a3a40');
    isoBox(ctx, ax, ay, 0.2, 0.17, 0.05, 0.62, 0.66, 1.08, { top: shade(c, 0.1), left: shade(c, 0.05), right: shade(c, -0.35), outline: OL });
    // embossed panels
    seg(ctx, P(0.28, 0.83, 0.25), P(0.75, 0.83, 0.25), shade(c, 0.18));
    seg(ctx, P(0.28, 0.83, 0.85), P(0.75, 0.83, 0.85), shade(c, -0.2));
    // lid with overhang + handle
    isoBox(ctx, ax, ay, 0.14, 0.12, 1.13, 0.74, 0.76, 0.08, { top: shade(c, 0.22), left: shade(c, 0.05), right: shade(c, -0.3), outline: OL });
    tseg(ctx, P(0.14, 0.2, 1.24), P(0.14, 0.82, 1.24), 2, shade(c, -0.15));
    if (p.o.num !== false) { const m = P(0.5, 0.83, 0.6); ctx.fillStyle = '#e8e4d8'; ctx.fillRect(m.x - 1, m.y - 2, 3, 3); }
  },
});
registerProp('bench', {
  h: 0.5, w: 1, d: 1,
  breakable: { hp: 20, debris: ['#7a5a30', '#4a4a4a'], sfx: 'wood', score: 40 },
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const c = p.o.color || '#7a5a30';
    const leg = '#2a2a30';
    const s = proj(ax, ay, 0.5, 0.5, 0); shadow(ctx, s.x, s.y + 2, 14, 5, 0.25);
    const B = (x, y, z, w, d, h, o) => (alongX ? isoBox(ctx, ax, ay, x, y, z, w, d, h, o) : isoBox(ctx, ax, ay, y, x, z, d, w, h, o));
    // cast iron end frames
    for (const e of [0.06, 0.84]) { B(e, 0.32, 0, 0.1, 0.34, 0.42, { color: leg, outline: OL }); B(e, 0.24, 0.42, 0.1, 0.06, 0.55, { color: leg }); }
    // seat slats
    for (let i = 0; i < 3; i++) B(0.0, 0.34 + i * 0.12, 0.42, 1.0, 0.09, 0.06, { top: shade(c, 0.22 - i * 0.05), left: c, right: shade(c, -0.3), outline: i === 2 ? OL : undefined });
    // back rest slats
    for (let i = 0; i < 2; i++) B(0.0, 0.24, 0.58 + i * 0.2, 1.0, 0.06, 0.12, { top: shade(c, 0.2), left: shade(c, 0.05), right: shade(c, -0.3), outline: OL });
  },
});
registerProp('lamp', {
  h: 3, solid: true, light: { z: 3.3, r: 4.5, color: '#ffcf7a', intensity: 0.95 },
  draw(ctx, ax, ay, p, t, world) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    const top = proj(ax, ay, 0.5, 0.5, 3.35);
    const pc = p.o.color || '#3c4048';
    shadow(ctx, b.x, b.y, 6, 3, 0.35);
    // base plinth
    ctx.fillStyle = OL; ctx.fillRect(b.x - 4, b.y - 9, 8, 10);
    ctx.fillStyle = pc; ctx.fillRect(b.x - 3, b.y - 8, 6, 8);
    ctx.fillStyle = shade(pc, 0.25); ctx.fillRect(b.x - 3, b.y - 8, 2, 8);
    ctx.fillStyle = shade(pc, -0.35); ctx.fillRect(b.x + 2, b.y - 8, 1, 8);
    ctx.fillStyle = shade(pc, 0.15); ctx.fillRect(b.x - 4, b.y - 10, 8, 2);
    // pole
    thick(ctx, b.x, b.y - 9, top.x, top.y, 4, OL);
    ctx.fillStyle = pc; ctx.fillRect(b.x - 1, top.y, 2, b.y - 9 - top.y);
    ctx.fillStyle = shade(pc, 0.3); ctx.fillRect(b.x - 1, top.y, 1, b.y - 9 - top.y);
    ctx.fillStyle = shade(pc, 0.1); ctx.fillRect(b.x - 2, top.y + 18, 4, 2); // collar
    // swan-neck arm and lantern head
    const ex = top.x + 10, ey = top.y - 4;
    thick(ctx, top.x, top.y, top.x + 3, top.y - 4, 3, OL); thick(ctx, top.x + 3, top.y - 4, ex, ey, 3, OL);
    line(ctx, top.x, top.y, top.x + 3, top.y - 4, pc); line(ctx, top.x + 3, top.y - 4, ex, ey, pc);
    fillPoly(ctx, [{ x: ex - 6, y: ey - 1 }, { x: ex + 6, y: ey - 1 }, { x: ex + 4, y: ey + 4 }, { x: ex - 4, y: ey + 4 }], OL);
    fillPoly(ctx, [{ x: ex - 5, y: ey }, { x: ex + 5, y: ey }, { x: ex + 3, y: ey + 3 }, { x: ex - 3, y: ey + 3 }], shade(pc, 0.1));
    const on = !(p.o.flicker && Math.sin(t * 13) + Math.sin(t * 7.3) > 1.4);
    ctx.fillStyle = on ? '#fff6d0' : '#706850'; ctx.fillRect(ex - 3, ey + 3, 6, 2);
    if (on) {
      ctx.fillStyle = '#ffd890'; ctx.fillRect(ex - 2, ey + 5, 4, 1);
    }
    if (on && world && world.level && world.level.ambient && world.level.ambient.dark > 0.25) {
      ctx.globalAlpha *= 0.18;
      fillPoly(ctx, [{ x: ex - 3, y: ey + 5 }, { x: ex + 3, y: ey + 5 }, { x: ex + 12, y: b.y + 2 }, { x: ex - 16, y: b.y + 2 }], '#ffd890');
      ctx.globalAlpha /= 0.18;
    }
  },
});
registerProp('bollard', {
  h: 0.7,
  draw(ctx, ax, ay, p) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    const c = p.o.color || '#22222a';
    shadow(ctx, b.x + 1, b.y, 5, 2, 0.35);
    cylinder(ctx, b.x, b.y, 3, 1, 13, c);
    ellipse(ctx, b.x, b.y - 14, 3, 2, shade(c, 0.25));
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(b.x - 3, b.y - 10, 6, 2);
    ctx.fillStyle = '#a8a49a'; ctx.fillRect(b.x + 1, b.y - 10, 2, 2);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(b.x - 1, b.y - 6, 1, 1);
  },
});
registerProp('bollardLit', { // illuminated keep-left bollard
  h: 0.9, light: { z: 0.8, r: 1.8, color: '#d0e8ff', intensity: 0.6 },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x + 1, b.y, 6, 3, 0.35);
    cylinder(ctx, b.x, b.y, 4, 2, 18, '#e8e8e4', { top: '#3a3a40' });
    ctx.fillStyle = '#1f4fb4'; ctx.fillRect(b.x - 3, b.y - 15, 5, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x - 2, b.y - 13, 3, 1); ctx.fillRect(b.x, b.y - 14, 1, 3);
    ctx.fillStyle = '#e8c020'; ctx.fillRect(b.x - 4, b.y - 4, 8, 2);
  },
});
registerProp('cone', {
  h: 0, solid: false, pickup: 'cone',
  draw(ctx, ax, ay) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x, b.y, 6, 3, 0.3);
    ITEM_ICON_CONE(ctx, b.x, b.y);
  },
});
function ITEM_ICON_CONE(ctx, x, y) {
  fillPoly(ctx, [{ x: x - 7, y: y - 2 }, { x: x + 7, y: y - 2 }, { x: x + 7, y: y + 1 }, { x: x - 7, y: y + 1 }], OL);
  ctx.fillStyle = '#1a1a1e'; ctx.fillRect(x - 6, y - 1, 12, 1);
  fillPoly(ctx, [{ x: x - 1, y: y - 15 }, { x: x + 2, y: y - 15 }, { x: x + 6, y: y - 1 }, { x: x - 5, y: y - 1 }], OL);
  fillPoly(ctx, [{ x: x, y: y - 14 }, { x: x + 1, y: y - 14 }, { x: x + 5, y: y - 2 }, { x: x - 4, y: y - 2 }], '#ff6a1a');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 9, 5, 2); ctx.fillRect(x - 3, y - 5, 7, 1);
  ctx.fillStyle = '#ff9a5a'; ctx.fillRect(x - 1, y - 13, 1, 10);
  ctx.fillStyle = '#b84008'; ctx.fillRect(x + 3, y - 7, 1, 5);
}
registerProp('barrier', { // crowd control barrier (steel)
  h: 0.8,
  breakable: { hp: 25, debris: ['#b0b4bc', '#6a6e76'], sfx: 'metal', score: 30 },
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const c = p.o.color || '#b0b4bc';
    const P = P_(ax, ay);
    const w = alongX ? [P(0.02, 0.5, 0), P(0.98, 0.5, 0)] : [P(0.5, 0.02, 0), P(0.5, 0.98, 0)];
    const zt = 0.8 * Z_PX;
    shadow(ctx, (w[0].x + w[1].x) / 2, (w[0].y + w[1].y) / 2 + 1, 14, 4, 0.22);
    // feet
    for (const q of w) { const f = alongX ? [{ x: q.x + 4, y: q.y - 2 }, { x: q.x - 4, y: q.y + 2 }] : [{ x: q.x - 4, y: q.y - 2 }, { x: q.x + 4, y: q.y + 2 }]; tseg(ctx, f[0], f[1], 3, OL); seg(ctx, f[0], f[1], shade(c, -0.3)); }
    // infill bars
    for (let i = 1; i < 10; i++) {
      const u = i / 10, x = w[0].x + (w[1].x - w[0].x) * u, y = w[0].y + (w[1].y - w[0].y) * u;
      line(ctx, x, y - 3, x, y - zt + 2, shade(c, -0.3));
    }
    for (const q of w) { thick(ctx, q.x, q.y, q.x, q.y - zt, 3, OL); line(ctx, q.x, q.y, q.x, q.y - zt, c); }
    for (const z of [zt, 3]) {
      thick(ctx, w[0].x, w[0].y - z, w[1].x, w[1].y - z, 3, OL);
      line(ctx, w[0].x, w[0].y - z, w[1].x, w[1].y - z, z === zt ? shade(c, 0.25) : c);
    }
    if (p.o.sign) { const m = { x: (w[0].x + w[1].x) / 2, y: (w[0].y + w[1].y) / 2 - zt / 2 }; ctx.fillStyle = OL; ctx.fillRect(m.x - 5, m.y - 3, 10, 6); ctx.fillStyle = p.o.signColor || '#e8c020'; ctx.fillRect(m.x - 4, m.y - 2, 8, 4); }
  },
});
registerProp('fence', { // steel mesh fence panel
  h: 2.2,
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const c = p.o.color || '#7a8088';
    const P = P_(ax, ay);
    const w = alongX ? [P(0, 0.5, 0), P(1, 0.5, 0)] : [P(0.5, 0, 0), P(0.5, 1, 0)];
    const zt = 2.2 * Z_PX;
    // mesh
    ctx.globalAlpha *= 0.85;
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, x = w[0].x + (w[1].x - w[0].x) * u, y = w[0].y + (w[1].y - w[0].y) * u;
      line(ctx, x, y - 1, x, y - zt + 1, shade(c, -0.15));
    }
    for (let z = 6; z < zt; z += 6) line(ctx, w[0].x, w[0].y - z, w[1].x, w[1].y - z, shade(c, -0.3));
    ctx.globalAlpha /= 0.85;
    for (const q of [w[0], w[1]]) { thick(ctx, q.x, q.y, q.x, q.y - zt - 2, 3, OL); line(ctx, q.x, q.y, q.x, q.y - zt - 2, shade(c, 0.2)); }
    for (const z of [zt, 1]) { thick(ctx, w[0].x, w[0].y - z, w[1].x, w[1].y - z, 3, OL); line(ctx, w[0].x, w[0].y - z, w[1].x, w[1].y - z, shade(c, 0.15)); }
    if (p.o.wire !== false) for (let i = 0; i < 6; i++) { // barbed wire on top
      const u = (i + 0.5) / 6, x = w[0].x + (w[1].x - w[0].x) * u, y = w[0].y + (w[1].y - w[0].y) * u - zt - 3;
      ctx.fillStyle = '#9a9aa4'; ctx.fillRect(Math.round(x - 1), Math.round(y), 3, 1); ctx.fillRect(Math.round(x), Math.round(y - 1), 1, 3);
    }
  },
});

// ---- car: detailed 80s/90s hatchback. opts: color, dir:'x'|'y', alarm, broken, plate
function drawCar(ctx, ax, ay, c, alongX, t, o) {
  // local frame: a = along the car (0..2, front at a=2), b = across (0..1); visible long side at b = 1
  const [SA, SB, SZ] = (o && o.scale) || [1, 1, 1];
  const P = alongX ? (a, b, z) => proj(ax, ay, a * SA, b * SB, z * SZ) : (a, b, z) => proj(ax, ay, b * SB, a * SA, z * SZ);
  const Q = (pts, col) => fillPoly(ctx, pts.map(q => P(q[0], q[1], q[2])), col);
  const sideLit = alongX; // +y face is the lit (left) face
  const sideC = sideLit ? c : shade(c, -0.3), endC = sideLit ? shade(c, -0.3) : c;
  const s = P(1, 0.5, 0);
  shadow(ctx, s.x, s.y + 2, 30, 11, 0.38);
  // far wheels (peeking under the body)
  for (const a of [0.42, 1.58]) { const w = P(a, 0.12, 0.16); ellipse(ctx, w.x, w.y, 4, 4, OL); }
  // lower body
  const z0 = 0.18, z1 = 0.62;
  const body = [[0.05, 0.1], [1.95, 0.1], [1.95, 0.9], [0.05, 0.9]];
  // outline pass
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const sh = pts => pts.map(q => { const r = P(q[0], q[1], q[2]); return { x: r.x + ox, y: r.y + oy }; });
    fillPoly(ctx, sh([[0.05, 0.9, z0], [1.95, 0.9, z0], [1.95, 0.9, z1], [0.05, 0.9, z1]]), OL);
    fillPoly(ctx, sh([[1.95, 0.1, z0], [1.95, 0.9, z0], [1.95, 0.9, z1], [1.95, 0.1, z1]]), OL);
    fillPoly(ctx, sh([[0.05, 0.1, z1], [1.95, 0.1, z1], [1.95, 0.9, z1], [0.05, 0.9, z1]]), OL);
    fillPoly(ctx, sh([[0.35, 0.18, z1], [1.45, 0.18, z1], [1.32, 0.24, 1.02], [0.5, 0.24, 1.02], [0.5, 0.76, 1.02], [1.32, 0.76, 1.02], [1.45, 0.82, z1], [0.35, 0.82, z1]]), OL);
  }
  Q([[0.05, 0.9, z0], [1.95, 0.9, z0], [1.95, 0.9, z1], [0.05, 0.9, z1]], sideC);           // long side
  Q([[1.95, 0.1, z0], [1.95, 0.9, z0], [1.95, 0.9, z1], [1.95, 0.1, z1]], endC);            // front
  Q(body.map(q => [q[0], q[1], z1]), shade(c, 0.14));                                       // bonnet/boot top
  // side trim line + door shut lines + handle
  const tl0 = P(0.08, 0.9, 0.4), tl1 = P(1.92, 0.9, 0.4); line(ctx, tl0.x, tl0.y, tl1.x, tl1.y, shade(sideC, -0.3));
  const hl0 = P(0.08, 0.9, z1 - 0.02), hl1 = P(1.92, 0.9, z1 - 0.02); line(ctx, hl0.x, hl0.y, hl1.x, hl1.y, shade(sideC, 0.3));
  for (const a of [0.62, 1.22]) { const d0 = P(a, 0.9, 0.22), d1 = P(a, 0.9, z1); line(ctx, d0.x, d0.y, d1.x, d1.y, shade(sideC, -0.35)); }
  { const h = P(1.12, 0.9, 0.52); ctx.fillStyle = '#c8c8d0'; ctx.fillRect(h.x - 1, h.y, 3, 1); }
  // bumpers
  Q([[1.95, 0.08, 0.18], [1.95, 0.92, 0.18], [1.95, 0.92, 0.28], [1.95, 0.08, 0.28]], '#2a2a30');
  Q([[0.05, 0.92, 0.18], [1.95, 0.92, 0.18], [1.95, 0.92, 0.24], [0.05, 0.92, 0.24]], '#2a2a30');
  // headlights + grille + plate on the front end
  Q([[1.955, 0.14, 0.4], [1.955, 0.3, 0.4], [1.955, 0.3, 0.54], [1.955, 0.14, 0.54]], '#fff4c0');
  Q([[1.955, 0.7, 0.4], [1.955, 0.86, 0.4], [1.955, 0.86, 0.54], [1.955, 0.7, 0.54]], '#fff4c0');
  Q([[1.955, 0.36, 0.42], [1.955, 0.64, 0.42], [1.955, 0.64, 0.52], [1.955, 0.36, 0.52]], '#1a1a20');
  Q([[1.955, 0.38, 0.29], [1.955, 0.62, 0.29], [1.955, 0.62, 0.36], [1.955, 0.38, 0.36]], o.plate || '#e8e0b0');
  // rear light on the visible side end
  Q([[0.06, 0.9, 0.42], [0.18, 0.9, 0.42], [0.18, 0.9, 0.54], [0.06, 0.9, 0.54]], '#c81818');
  // cabin: pillars + glass
  const g1 = '#7a98b4', g2 = '#4a6480', gl = '#c8e0f0';
  const zc = 1.02;
  Q([[0.35, 0.82, z1], [1.45, 0.82, z1], [1.32, 0.76, zc], [0.5, 0.76, zc]], sideLit ? shade(c, 0.05) : shade(c, -0.25));
  Q([[0.44, 0.81, z1 + 0.06], [0.88, 0.81, z1 + 0.06], [0.88, 0.77, zc - 0.06], [0.54, 0.77, zc - 0.06]], sideLit ? g1 : g2);
  Q([[0.94, 0.81, z1 + 0.06], [1.38, 0.81, z1 + 0.06], [1.28, 0.77, zc - 0.06], [0.94, 0.77, zc - 0.06]], sideLit ? g1 : g2);
  Q([[1.45, 0.18, z1], [1.45, 0.82, z1], [1.32, 0.76, zc], [1.32, 0.24, zc]], sideLit ? g2 : g1); // windscreen
  { const r0 = P(1.42, 0.3, z1 + 0.08), r1 = P(1.35, 0.42, zc - 0.08); line(ctx, r0.x, r0.y, r1.x, r1.y, gl); }
  { const r0 = P(0.6, 0.79, z1 + 0.12), r1 = P(0.7, 0.79, zc - 0.1); line(ctx, r0.x, r0.y, r1.x, r1.y, gl); }
  Q([[0.5, 0.24, zc], [1.32, 0.24, zc], [1.32, 0.76, zc], [0.5, 0.76, zc]], shade(c, 0.22));      // roof
  { const r0 = P(0.56, 0.3, zc), r1 = P(1.26, 0.3, zc); line(ctx, r0.x, r0.y, r1.x, r1.y, shade(c, 0.4)); }
  // near wheels
  for (const a of [0.42, 1.58]) {
    const w = P(a, 0.92, 0.17);
    ellipse(ctx, w.x, w.y, 5, 5, OL); ellipse(ctx, w.x, w.y, 4, 4, '#18181c');
    ellipse(ctx, w.x, w.y, 2, 2, '#8a8a94'); ctx.fillStyle = '#c8c8d0'; ctx.fillRect(w.x - 1, w.y - 1, 1, 1);
  }
  if (o.broken) { const b = P(1.0, 0.8, 0.85); ctx.fillStyle = '#e8f0ff'; ctx.fillRect(b.x - 2, b.y, 1, 1); ctx.fillRect(b.x + 1, b.y - 2, 1, 1); ctx.fillRect(b.x, b.y + 2, 2, 1); }
  if (o.alarm && Math.floor(t * 4) % 2) {
    for (const q of [P(1.955, 0.22, 0.47), P(0.12, 0.9, 0.48)]) { ctx.fillStyle = '#ffb030'; ctx.fillRect(q.x - 2, q.y - 2, 4, 3); }
    const r = P(0.9, 0.5, 1.15); ctx.fillStyle = '#ff8a20'; ctx.fillRect(r.x - 1, r.y - 1, 3, 2);
  }
}
registerProp('car', {
  w: 5, d: 2, h: 1.6, rotates: true,   // full-scale saloon (5 x 2 tiles); Blender sprite in env_vehicles.py
  draw(ctx, ax, ay, p) {
    drawCar(ctx, ax, ay, p.o.color || '#8a2020', p.dir !== 'y', p.t, { ...p.o, scale: [2.5, 2, 1.4] });
  },
});
export { drawCar };

registerProp('phonebox', {
  h: 3,
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#b01818';
    const P = P_(ax, ay);
    const s = P(0.5, 0.5); shadow(ctx, s.x + 3, s.y + 2, 13, 6, 0.35);
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.8, 0.8, 0.12, { color: shade(c, -0.25), outline: OL }); // plinth
    isoBox(ctx, ax, ay, 0.15, 0.15, 0.12, 0.7, 0.7, 2.62, { top: shade(c, 0.1), left: c, right: shade(c, -0.32), outline: OL });
    // roof: stepped cap + crown
    isoBox(ctx, ax, ay, 0.1, 0.1, 2.74, 0.8, 0.8, 0.16, { top: shade(c, 0.2), left: shade(c, -0.08), right: shade(c, -0.38), outline: OL });
    isoBox(ctx, ax, ay, 0.22, 0.22, 2.9, 0.56, 0.56, 0.1, { top: shade(c, 0.25), left: shade(c, -0.05), right: shade(c, -0.35), outline: OL });
    // glowing sign band
    isoPanel(ctx, ax, ay, 'left', 0.22, 0.851, 0.56, 2.48, 2.68, '#f8f4e0');
    isoPanel(ctx, ax, ay, 'right', 0.851, 0.22, 0.56, 2.48, 2.68, '#c8c4b0');
    for (let i = 0; i < 4; i++) { const q = P(0.3 + i * 0.12, 0.851, 2.55); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(q.x, q.y - 1, 2, 2); }
    // small-pane windows (6 rows x 3 cols per face)
    for (let r = 0; r < 6; r++) {
      const z0 = 0.62 + r * 0.29;
      for (let k = 0; k < 3; k++) {
        isoPanel(ctx, ax, ay, 'left', 0.25 + k * 0.17, 0.851, 0.14, z0, z0 + 0.23, r % 3 === 1 && k === 0 ? '#e8f4f8' : '#a8c8d4');
        isoPanel(ctx, ax, ay, 'right', 0.851, 0.25 + k * 0.17, 0.14, z0, z0 + 0.23, '#6a8a98');
      }
    }
    // door handle + inside phone silhouette
    const h = P(0.78, 0.851, 1.4); ctx.fillStyle = '#d8c070'; ctx.fillRect(h.x, h.y, 1, 3);
    const ph = P(0.5, 0.851, 1.6); ctx.fillStyle = '#2a3a44'; ctx.fillRect(ph.x - 2, ph.y - 2, 4, 4);
  },
});
registerProp('tree', {
  h: 3, solid: true,
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x + 4, b.y + 2, 18, 7, 0.3);
    // trunk with roots + bark
    fillPoly(ctx, [{ x: b.x - 5, y: b.y + 1 }, { x: b.x + 5, y: b.y + 1 }, { x: b.x + 3, y: b.y - 4 }, { x: b.x - 3, y: b.y - 4 }], OL);
    thick(ctx, b.x, b.y, b.x, b.y - 32, 6, OL);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(b.x - 2, b.y - 32, 4, 32); ctx.fillRect(b.x - 4, b.y - 2, 8, 2);
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(b.x - 2, b.y - 32, 1, 30);
    ctx.fillStyle = '#2e1c12'; ctx.fillRect(b.x + 1, b.y - 28, 1, 6); ctx.fillRect(b.x, b.y - 14, 1, 4);
    thick(ctx, b.x, b.y - 26, b.x + 7, b.y - 36, 2, '#4a3020');
    const sway = Math.round(Math.sin(t * 1.3 + p.x) * 1);
    const g = p.o.color || '#2e5a2a';
    const blobs = [[0, -50, 14], [-10, -40, 10], [10, -40, 11], [0, -35, 11], [-5, -56, 8], [7, -52, 8]];
    for (const [dx, dy, r] of blobs) ellipse(ctx, b.x + dx + sway, b.y + dy, r + 1, r * 0.82 + 1, OL);
    for (const [dx, dy, r] of blobs) ellipse(ctx, b.x + dx + sway, b.y + dy, r, r * 0.82, shade(g, -0.25));
    for (const [dx, dy, r] of blobs) ellipse(ctx, b.x + dx + sway - 1, b.y + dy - 2, r * 0.8, r * 0.62, g);
    for (const [dx, dy, r] of blobs) ellipse(ctx, b.x + dx + sway - 3, b.y + dy - 4, r * 0.4, r * 0.3, shade(g, 0.22));
    // leaf speckle
    for (let i = 0; i < 18; i++) {
      const lx = b.x + sway + ((i * 37) % 26) - 13, ly = b.y - 34 - ((i * 23) % 26);
      ctx.fillStyle = i % 3 ? shade(g, 0.35) : shade(g, -0.4);
      ctx.fillRect(lx, ly, 1, 1);
    }
  },
});
registerProp('skip', {
  w: 2, d: 1, h: 1.2,
  breakable: null,
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#d08a18';
    const P = P_(ax, ay);
    const s = P(1, 0.5); shadow(ctx, s.x + 2, s.y + 2, 28, 10, 0.32);
    // tapered sides: narrower at the bottom
    const B = [[0.2, 0.22, 0], [1.8, 0.22, 0], [1.8, 0.78, 0], [0.2, 0.78, 0]];
    const T = [[0.05, 0.1, 1.2], [1.95, 0.1, 1.2], [1.95, 0.9, 1.2], [0.05, 0.9, 1.2]];
    const Pp = q => P(q[0], q[1], q[2]);
    const out = (pts, col) => { for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fillPoly(ctx, pts.map(q => { const r = Pp(q); return { x: r.x + ox, y: r.y + oy }; }), OL); fillPoly(ctx, pts.map(Pp), col); };
    out([B[3], B[2], T[2], T[3]], c);
    out([B[2], B[1], T[1], T[2]], shade(c, -0.32));
    fillPoly(ctx, T.map(Pp), OL);
    fillPoly(ctx, [[0.12, 0.16, 1.18], [1.88, 0.16, 1.18], [1.88, 0.84, 1.18], [0.12, 0.84, 1.18]].map(Pp), '#3a3430');
    // rubbish
    const junk = ['#8a6038', '#6a6e76', '#b8b0a0', '#4a4a50', '#a04830'];
    for (let i = 0; i < 9; i++) { const q = P(0.3 + (i * 0.37) % 1.4, 0.25 + (i * 0.23) % 0.5, 1.22); ctx.fillStyle = junk[i % 5]; ctx.fillRect(q.x - 2, q.y - 2 - (i % 3), 4, 3); }
    // ribs + lifting lugs + hazard stripes
    for (const a of [0.55, 1.0, 1.45]) { const b0 = P(a, 0.84, 0.12), b1 = P(a - 0.04, 0.9, 1.15); line(ctx, b0.x, b0.y, b1.x, b1.y, shade(c, -0.3)); }
    for (const a of [0.12, 1.88]) { const l = P(a, 0.9, 0.75); ctx.fillStyle = '#2a2a30'; ctx.fillRect(l.x - 1, l.y - 1, 3, 3); }
    for (let i = 0; i < 6; i++) { const q = P(1.93, 0.18 + i * 0.12, 1.0); ctx.fillStyle = i % 2 ? '#1a1a1a' : '#f0d020'; ctx.fillRect(q.x, q.y, 2, 3); }
  },
});
registerProp('pallet', {
  h: 0.35,
  breakable: { hp: 8, debris: ['#b08a50', '#8a6a38'], sfx: 'wood', score: 20 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#b08a50';
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 0.9, 0.9, 0.08, { color: shade(c, -0.2), outline: OL });
    for (const y of [0.08, 0.45, 0.82]) isoBox(ctx, ax, ay, 0.05, y, 0.08, 0.9, 0.1, 0.14, { color: shade(c, -0.15), outline: OL });
    for (let i = 0; i < 5; i++) isoBox(ctx, ax, ay, 0.05 + i * 0.185, 0.05, 0.22, 0.15, 0.9, 0.08, { top: shade(c, 0.12), left: c, right: shade(c, -0.3), outline: OL });
  },
});
registerProp('table', {
  h: 0.75,
  breakable: { hp: 15, debris: ['#6a4020', '#4a2c14'], sfx: 'wood', drops: [['pint', 0.35], ['bottle', 0.3]], score: 40 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#6a4020';
    const s = proj(ax, ay, 0.5, 0.5, 0); shadow(ctx, s.x, s.y + 1, 12, 5, 0.3);
    isoBox(ctx, ax, ay, 0.3, 0.3, 0, 0.4, 0.4, 0.05, { color: '#2a2a2e', outline: OL });
    isoBox(ctx, ax, ay, 0.45, 0.45, 0.05, 0.1, 0.1, 0.65, { color: '#2a2a2e' });
    isoBox(ctx, ax, ay, 0.08, 0.08, 0.7, 0.84, 0.84, 0.08, { top: shade(c, 0.15), left: c, right: shade(c, -0.3), outline: OL });
    const r = proj(ax, ay, 0.2, 0.3, 0.78); line(ctx, r.x, r.y, r.x + 8, r.y + 4, shade(c, 0.32));
    if (p.o.pints !== false) {
      for (const [x, y, full] of [[0.35, 0.55, 1], [0.6, 0.35, 0]]) {
        const q = proj(ax, ay, x, y, 0.78);
        ctx.fillStyle = OL; ctx.fillRect(q.x - 2, q.y - 7, 5, 8);
        ctx.fillStyle = '#d9e6f0'; ctx.fillRect(q.x - 1, q.y - 6, 3, 6);
        if (full) { ctx.fillStyle = '#b06a18'; ctx.fillRect(q.x - 1, q.y - 4, 3, 4); ctx.fillStyle = '#f5f0e0'; ctx.fillRect(q.x - 1, q.y - 5, 3, 1); }
        else { ctx.fillStyle = '#c89a50'; ctx.fillRect(q.x - 1, q.y - 1, 3, 1); }
      }
      const a = proj(ax, ay, 0.62, 0.65, 0.78); ctx.fillStyle = '#e8e4d8'; ctx.fillRect(a.x - 2, a.y - 1, 4, 2); // beer mat
    }
  },
});
registerProp('chairProp', {
  h: 0, solid: false, pickup: 'chair',
  draw(ctx, ax, ay) {
    const s = proj(ax, ay, 0.5, 0.5, 0); shadow(ctx, s.x, s.y, 8, 3, 0.25);
    for (const [x, y] of [[0.3, 0.3], [0.64, 0.3], [0.3, 0.64], [0.64, 0.64]]) isoBox(ctx, ax, ay, x, y, 0, 0.06, 0.06, 0.45, { color: '#4a2e14' });
    isoBox(ctx, ax, ay, 0.28, 0.28, 0.45, 0.44, 0.44, 0.06, { top: '#a8703c', left: '#8a5a30', right: '#5e3c1c', outline: OL });
    isoBox(ctx, ax, ay, 0.28, 0.28, 0.51, 0.06, 0.44, 0.08, { color: '#8a5a30', outline: OL });
    isoBox(ctx, ax, ay, 0.28, 0.28, 0.75, 0.06, 0.44, 0.1, { color: '#8a5a30', outline: OL });
    for (const y of [0.3, 0.66]) isoBox(ctx, ax, ay, 0.28, y, 0.51, 0.06, 0.06, 0.34, { color: '#6a4422' });
  },
});
registerProp('door', {
  h: 3, interact: { kind: 'door', key: null },
  draw(ctx, ax, ay, p) {
    if (p.open) return;
    const c = p.o.color || '#4a2a18';
    const alongX = p.o.dir !== 'y';
    if (alongX) isoBox(ctx, ax, ay, 0, 0.4, 0, 1, 0.2, 2.6, { top: shade(c, 0.1), left: c, right: shade(c, -0.3), outline: OL });
    else isoBox(ctx, ax, ay, 0.4, 0, 0, 0.2, 1, 2.6, { top: shade(c, 0.1), left: c, right: shade(c, -0.3), outline: OL });
    // raised panels on the visible face
    const pc = alongX ? shade(c, 0.12) : shade(c, -0.18), pd = alongX ? shade(c, -0.15) : shade(c, -0.42);
    for (const [z0, z1] of [[0.25, 1.15], [1.35, 2.35]]) {
      if (alongX) { isoPanel(ctx, ax, ay, 'left', 0.15, 0.601, 0.3, z0, z1, pd); isoPanel(ctx, ax, ay, 'left', 0.55, 0.601, 0.3, z0, z1, pd); isoPanel(ctx, ax, ay, 'left', 0.17, 0.602, 0.26, z0 + 0.06, z1, pc); isoPanel(ctx, ax, ay, 'left', 0.57, 0.602, 0.26, z0 + 0.06, z1, pc); }
      else { isoPanel(ctx, ax, ay, 'right', 0.601, 0.15, 0.3, z0, z1, pd); isoPanel(ctx, ax, ay, 'right', 0.601, 0.55, 0.3, z0, z1, pd); isoPanel(ctx, ax, ay, 'right', 0.602, 0.17, 0.26, z0 + 0.06, z1, pc); isoPanel(ctx, ax, ay, 'right', 0.602, 0.57, 0.26, z0 + 0.06, z1, pc); }
    }
    const k = alongX ? proj(ax, ay, 0.85, 0.6, 1.25) : proj(ax, ay, 0.6, 0.85, 1.25);
    ctx.fillStyle = '#e8c040'; ctx.fillRect(k.x - 1, k.y - 1, 2, 2);
    if (p.o.key) { // padlock + hasp
      const m = alongX ? proj(ax, ay, 0.5, 0.6, 1.3) : proj(ax, ay, 0.6, 0.5, 1.3);
      ctx.fillStyle = OL; ctx.fillRect(m.x - 3, m.y - 2, 7, 7);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(m.x - 2, m.y, 5, 4);
      ctx.fillStyle = '#a8a8b0'; ctx.fillRect(m.x - 1, m.y - 2, 3, 1); ctx.fillRect(m.x - 2, m.y - 1, 1, 1); ctx.fillRect(m.x + 2, m.y - 1, 1, 1);
      ctx.fillStyle = OL; ctx.fillRect(m.x, m.y + 1, 1, 2);
    }
  },
});
registerProp('gate', { // iron gate with spear tips; chained + flashing lock while closed
  h: 3, interact: { kind: 'gate', key: null },
  draw(ctx, ax, ay, p, t) {
    if (p.open) return;
    const alongX = p.o.dir !== 'y';
    const P = P_(ax, ay);
    const a = alongX ? P(0, 0.5, 0) : P(0.5, 0, 0), b = alongX ? P(1, 0.5, 0) : P(0.5, 1, 0);
    const zt = 2.8 * Z_PX;
    const col = p.o.color || '#3a3a46';
    for (let i = 0; i <= 8; i++) {
      const u = i / 8, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
      const end = i === 0 || i === 8;
      thick(ctx, x, y, x, y - zt - (end ? 0 : 3), end ? 4 : 3, OL);
      line(ctx, x, y, x, y - zt - (end ? 0 : 3), end ? shade(col, 0.2) : col);
      if (!end) { ctx.fillStyle = '#c8a040'; ctx.fillRect(Math.round(x) - 1, Math.round(y - zt - 4), 3, 1); ctx.fillRect(Math.round(x), Math.round(y - zt - 5), 1, 1); }
    }
    for (const z of [zt, zt * 0.55, 4]) { thick(ctx, a.x, a.y - z, b.x, b.y - z, 3, OL); line(ctx, a.x, a.y - z, b.x, b.y - z, shade(col, 0.15)); }
    // scroll detail
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.fillStyle = '#c8a040'; ctx.fillRect(Math.round(m.x) - 2, Math.round(m.y - zt * 0.78), 5, 1);
    if (p.o.locked !== false) {
      // chain across the middle + padlock
      for (let i = -3; i <= 3; i++) { ctx.fillStyle = i % 2 ? '#8a8a94' : '#b8b8c0'; ctx.fillRect(Math.round(m.x + i * 2), Math.round(m.y - zt / 2 + i * (alongX ? 1 : -1)), 2, 1); }
      const blink = Math.floor(t * 2) % 2;
      ctx.fillStyle = OL; ctx.fillRect(Math.round(m.x) - 3, Math.round(m.y - zt / 2) - 1, 6, 6);
      ctx.fillStyle = blink ? '#ff4030' : '#c8a040'; ctx.fillRect(Math.round(m.x) - 2, Math.round(m.y - zt / 2), 4, 4);
    }
  },
});
registerProp('sign', {
  h: 0, solid: false, depthBias: 0.02,
  // opts: text, color, bg, side:'left'|'right', z (bottom), height, len, neon:bool
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    const z0 = p.o.z ?? 1.6, z1 = z0 + (p.o.height ?? 0.8);
    const len = p.o.len ?? 1;
    const bg = p.o.bg || '#1a1420';
    const flick = p.o.neon && Math.sin(t * 17 + p.x) + Math.sin(t * 5.1) > 1.75;
    const fg = flick ? shade(p.o.color || '#ff3aa0', -0.6) : (p.o.color || '#ff3aa0');
    let m;
    if (side === 'left') {
      isoPanel(ctx, ax, ay, 'left', 0.05, 1.02, len - 0.1, z0 - 0.04, z1 + 0.04, OL);
      isoPanel(ctx, ax, ay, 'left', 0.08, 1.02, len - 0.16, z0, z1, shade(bg, 0.25));
      isoPanel(ctx, ax, ay, 'left', 0.12, 1.02, len - 0.24, z0 + 0.07, z1 - 0.07, bg);
      m = proj(ax, ay, len / 2, 1.02, (z0 + z1) / 2);
    } else {
      isoPanel(ctx, ax, ay, 'right', 1.02, 0.05, len - 0.1, z0 - 0.04, z1 + 0.04, OL);
      isoPanel(ctx, ax, ay, 'right', 1.02, 0.08, len - 0.16, z0, z1, shade(bg, 0.12));
      isoPanel(ctx, ax, ay, 'right', 1.02, 0.12, len - 0.24, z0 + 0.07, z1 - 0.07, shade(bg, -0.15));
      m = proj(ax, ay, 1.02, len / 2, (z0 + z1) / 2);
    }
    if (p.o.text) {
      ctx.save();
      ctx.translate(Math.round(m.x), Math.round(m.y));
      ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
      if (p.o.neon && !flick) { ctx.globalAlpha *= 0.35; drawText(ctx, p.o.text, 0, -3, { color: fg, align: 'center', outline: fg }); ctx.globalAlpha /= 0.35; }
      drawText(ctx, p.o.text, 0, -3, { color: fg, align: 'center', outline: p.o.neon ? undefined : shade(bg, -0.5) });
      ctx.restore();
    }
  },
});
registerProp('puddle', {
  h: 0, solid: false, depthBias: -5,
  draw(ctx, ax, ay, p, t) {
    const c = proj(ax, ay, 0.5, 0.5, 0);
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * 0.6;
    ellipse(ctx, c.x, c.y, 13, 5, '#141c28');
    ctx.globalAlpha = a0 * 0.5;
    ellipse(ctx, c.x + 1, c.y, 11, 4, '#1e2a3c');
    ctx.globalAlpha = a0 * 0.45;
    ctx.fillStyle = '#9ab8d8'; ctx.fillRect(c.x - 6, c.y - 2, 5, 1); ctx.fillRect(c.x - 3, c.y - 1, 2, 1);
    ctx.fillStyle = '#ffd890'; ctx.fillRect(c.x + 3, c.y - 1, 1, 3); // reflected street light
    ctx.strokeStyle = '#a0c8e8'; ctx.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      const r = (t * 0.8 + p.x * 0.3 + k * 0.5) % 1;
      ctx.globalAlpha = a0 * 0.4 * (1 - r);
      const ox = k ? -4 : 4;
      ctx.beginPath(); ctx.ellipse(c.x + ox, c.y, 1 + r * 5, 0.5 + r * 2, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = a0;
  },
});
registerProp('graffiti', {
  // decal on a wall face; place on the wall tile. opts: text, color, side, z
  h: 0, solid: false, depthBias: 0.02,
  draw(ctx, ax, ay, p) {
    const side = p.o.side || 'left';
    const m = side === 'left' ? proj(ax, ay, 0.5, 1.01, p.o.z ?? 1.0) : proj(ax, ay, 1.01, 0.5, p.o.z ?? 1.0);
    const txt = p.o.text || 'ANCHORS';
    const col = p.o.color || '#e83a8a';
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
    // paint drips under the letters
    const w = txt.length * 6;
    for (let i = 0; i < txt.length; i++) {
      if ((i * 7 + txt.charCodeAt(i)) % 3) continue;
      const dx = -w / 2 + i * 6 + 2, dl = 2 + ((i * 5) % 5);
      ctx.fillStyle = col; ctx.fillRect(dx, 4, 1, dl);
    }
    drawText(ctx, txt, 0, -4, { color: col, align: 'center', outline: shade(col, -0.6) });
    ctx.restore();
  },
});
registerProp('postbox', {
  h: 1.4,
  draw(ctx, ax, ay, p) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    const c = p.o.color || '#c01818';
    shadow(ctx, b.x + 2, b.y + 1, 8, 4, 0.35);
    ctx.fillStyle = OL; ctx.fillRect(b.x - 7, b.y - 4, 14, 5); ctx.fillStyle = '#1a1a1e'; ctx.fillRect(b.x - 6, b.y - 3, 12, 3); // base
    cylinder(ctx, b.x, b.y - 3, 6, 3, 24, c);
    // domed cap
    ellipse(ctx, b.x, b.y - 28, 8, 4, OL);
    ellipse(ctx, b.x, b.y - 29, 7, 3, shade(c, 0.1));
    ellipse(ctx, b.x, b.y - 31, 5, 3, OL); ellipse(ctx, b.x, b.y - 31, 4, 2, shade(c, 0.28));
    ctx.fillStyle = '#200808'; ctx.fillRect(b.x - 4, b.y - 23, 8, 2);   // slot
    ctx.fillStyle = shade(c, 0.4); ctx.fillRect(b.x - 4, b.y - 24, 8, 1);
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(b.x - 3, b.y - 18, 5, 4);   // collection plate
    ctx.fillStyle = '#5a5a60'; ctx.fillRect(b.x - 2, b.y - 17, 3, 1); ctx.fillRect(b.x - 2, b.y - 15, 2, 1);
    ctx.fillStyle = '#e8c040'; ctx.fillRect(b.x - 1, b.y - 11, 2, 2);  // crown-less cipher (just a brass dot)
  },
});
registerProp('hydrant', {
  h: 0.6,
  draw(ctx, ax, ay) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x + 1, b.y, 6, 3, 0.35);
    cylinder(ctx, b.x, b.y, 3, 1, 11, '#d8b020');
    ctx.fillStyle = OL; ctx.fillRect(b.x - 6, b.y - 9, 12, 4);
    ctx.fillStyle = '#d8b020'; ctx.fillRect(b.x - 5, b.y - 8, 10, 2);
    ctx.fillStyle = '#f0d060'; ctx.fillRect(b.x - 5, b.y - 8, 3, 1);
    ellipse(ctx, b.x, b.y - 12, 3, 2, OL); ellipse(ctx, b.x, b.y - 12, 2, 1, '#e8c040');
  },
});
registerProp('rubble', {
  h: 0.4,
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#6a6056';
    const s = proj(ax, ay, 0.5, 0.5, 0); shadow(ctx, s.x, s.y + 1, 14, 5, 0.25);
    const cols = [c, '#8a4a38', shade(c, 0.15), '#5a5a62'];
    const pieces = [[0.1, 0.2, 0.4, 0.3, 0.2], [0.5, 0.4, 0.35, 0.4, 0.3], [0.2, 0.55, 0.3, 0.3, 0.15], [0.55, 0.1, 0.3, 0.25, 0.12], [0.35, 0.35, 0.2, 0.18, 0.38], [0.7, 0.7, 0.18, 0.15, 0.1]];
    pieces.forEach(([x, y, w, d, h], i) => isoBox(ctx, ax, ay, x, y, 0, w, d, h, { top: shade(cols[i % 4], 0.18), left: cols[i % 4], right: shade(cols[i % 4], -0.32), outline: OL }));
    const q = proj(ax, ay, 0.4, 0.8, 0); ctx.fillStyle = '#9a9488'; ctx.fillRect(q.x, q.y, 2, 1); ctx.fillRect(q.x + 5, q.y - 3, 1, 1);
  },
});
registerProp('weaponStash', {
  // a pile that dispenses a weapon on USE (opts.item)
  h: 0, solid: false,
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x, b.y, 9, 4, 0.3);
    isoBox(ctx, ax, ay, 0.2, 0.25, 0, 0.6, 0.5, 0.2, { color: '#7a5a38', outline: OL });
    // planks & a pipe sticking out
    thick(ctx, b.x - 8, b.y - 4, b.x + 7, b.y - 10, 3, OL); line(ctx, b.x - 8, b.y - 4, b.x + 7, b.y - 10, '#a07848');
    thick(ctx, b.x - 6, b.y - 9, b.x + 8, b.y - 5, 3, OL); line(ctx, b.x - 6, b.y - 9, b.x + 8, b.y - 5, '#8a929c');
    if (Math.floor(t * 3) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x + 6, b.y - 12, 1, 1); }
  },
  pickupFromOpts: true,
});
registerProp('exitArrow', {
  h: 0, solid: false, depthBias: -5,
  draw(ctx, ax, ay, p, t, world) {
    if (!world || !world.exitOpen) return;
    const c = proj(ax, ay, 0.5, 0.5, 0);
    const a = 0.5 + 0.5 * Math.sin(t * 6);
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * (0.35 + a * 0.4);
    ellipse(ctx, c.x, c.y, 15, 7, '#3aff7a');
    ctx.globalAlpha = a0 * 0.9;
    ellipse(ctx, c.x, c.y, 10, 4, '#0a3a1a');
    ctx.globalAlpha = a0;
    // bouncing chevrons
    for (let i = 0; i < 2; i++) {
      const y = c.y - 34 + i * 6 + Math.round(a * 3);
      fillPoly(ctx, [{ x: c.x - 6, y }, { x: c.x + 6, y }, { x: c.x, y: y + 5 }], OL);
      fillPoly(ctx, [{ x: c.x - 4, y: y + 1 }, { x: c.x + 4, y: y + 1 }, { x: c.x, y: y + 4 }], i ? '#3aff7a' : '#b0ffc8');
    }
    drawText(ctx, 'EXIT', c.x, c.y - 46 - Math.round(a * 3), { color: '#3aff7a', align: 'center', outline: '#000' });
  },
});

// ------------------------------------------------------------------ new common props
registerProp('flag', { // flag pole with a waving flag. opts: a, b (colours), pattern:'halves'|'stripes'|'cross', h
  h: 2.5, solid: true,
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    const H = Z_PX * (p.o.poleH || 3.4);
    const A = p.o.a || '#c8102e', B = p.o.b || '#f4f1e8';
    shadow(ctx, b.x, b.y, 5, 2, 0.35);
    ctx.fillStyle = OL; ctx.fillRect(b.x - 2, b.y - H - 2, 4, H + 3);
    ctx.fillStyle = '#c8c8d0'; ctx.fillRect(b.x - 1, b.y - H, 2, H);
    ctx.fillStyle = '#8a8a94'; ctx.fillRect(b.x, b.y - H, 1, H);
    ctx.fillStyle = '#e8c040'; ctx.fillRect(b.x - 1, b.y - H - 3, 3, 2);
    const fw = 22, fh = 13, x0 = b.x + 1, y0 = b.y - H + 1;
    for (let i = 0; i < fw; i++) {
      const wv = Math.round(Math.sin(t * 6 - i * 0.35) * (i / fw) * 2.5);
      const sh = Math.sin(t * 6 - i * 0.35 + 0.8) > 0.4 ? -0.18 : Math.sin(t * 6 - i * 0.35 + 0.8) < -0.6 ? 0.12 : 0;
      for (let j = 0; j < fh; j++) {
        let c;
        const pat = p.o.pattern || 'halves';
        if (pat === 'stripes') c = Math.floor(j / 3) % 2 ? B : A;
        else if (pat === 'cross') c = (Math.abs(i - 7) < 2 || Math.abs(j - 6) < 2) ? B : A;
        else c = i < fw / 2 ? A : B;
        ctx.fillStyle = sh ? shade(c, sh) : c;
        ctx.fillRect(x0 + i, y0 + j + wv, 1, 1);
      }
      ctx.fillStyle = OL; ctx.fillRect(x0 + i, y0 + wv - 1, 1, 1); ctx.fillRect(x0 + i, y0 + fh + wv, 1, 1);
    }
  },
});
registerProp('billboard', { // poster hoarding on legs (3 tiles long). opts: dir, text (<= 8 chars), sub, color (poster bg), fg
  w: 3, d: 1, h: 3.2,
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const len = 3;
    const L = alongX ? (a, z) => proj(ax, ay, a, 0.5, z) : (a, z) => proj(ax, ay, 0.5, a, z);
    const bg = p.o.color || '#1f4fb4', fg = p.o.fg || '#ffd23a';
    const s = L(len / 2, 0); shadow(ctx, s.x, s.y + 2, 26, 6, 0.22);
    for (const a of [0.4, len - 0.4]) { const q0 = L(a, 0), q1 = L(a, 1.6); thick(ctx, q0.x, q0.y, q1.x, q1.y, 4, OL); line(ctx, q0.x, q0.y, q1.x, q1.y, '#5a5a62'); }
    const quad = (a0, a1, z0, z1) => [L(a0, z0), L(a1, z0), L(a1, z1), L(a0, z1)];
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fillPoly(ctx, quad(0, len, 1.5, 3.4).map(q => ({ x: q.x + ox, y: q.y + oy })), OL);
    fillPoly(ctx, quad(0, len, 1.5, 3.4), '#e8e4d8');
    fillPoly(ctx, quad(0.08, len - 0.08, 1.6, 3.3), alongX ? bg : shade(bg, -0.25));
    fillPoly(ctx, quad(0.08, len - 0.08, 1.6, 1.82), shade(bg, -0.3));
    // poster art: club-ish roundel on the left, headline + body bars
    const cc = L(0.55, 2.45);
    ellipse(ctx, cc.x, cc.y, 7, 7, OL); ellipse(ctx, cc.x, cc.y, 6, 6, '#c8102e'); ellipse(ctx, cc.x, cc.y, 3, 3, '#f4f1e8');
    const txt = (p.o.text || 'MATCHDAY').slice(0, 8);
    const m = L(len / 2 + 0.35, 2.75);
    ctx.save(); ctx.translate(m.x, m.y); ctx.transform(1, alongX ? 0.5 : -0.5, 0, 1, 0, 0);
    if (measureText(txt) <= 36) drawText(ctx, txt, 0, -4, { color: fg, align: 'center', outline: shade(bg, -0.6) });
    if (p.o.sub && measureText(p.o.sub) <= 36) drawText(ctx, p.o.sub, 0, 6, { color: '#ffffff', align: 'center' });
    else { ctx.fillStyle = '#ffffff'; ctx.fillRect(-14, 6, 28, 2); ctx.fillStyle = shade(bg, 0.4); ctx.fillRect(-14, 10, 20, 1); }
    ctx.restore();
    for (const a of [0.9, len - 0.9]) { const l = L(a, 3.4); ctx.fillStyle = '#3a3a40'; ctx.fillRect(l.x - 1, l.y - 3, 3, 3); ctx.fillStyle = '#fff4c0'; ctx.fillRect(l.x - 1, l.y - 1, 3, 1); }
  },
});
registerProp('busStop', { // shelter: roof, glass panels, timetable, bench. opts: dir, color
  w: 2, d: 1, h: 2.4,
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const c = p.o.color || '#2a3a5a';
    const B = (x, y, z, w, d, h, o) => (alongX ? isoBox(ctx, ax, ay, x, y, z, w, d, h, o) : isoBox(ctx, ax, ay, y, x, z, d, w, h, o));
    const Pn = (x, y, z) => (alongX ? proj(ax, ay, x, y, z) : proj(ax, ay, y, x, z));
    const s = Pn(1, 0.5, 0); shadow(ctx, s.x, s.y + 2, 26, 9, 0.25);
    // back glass (semi-transparent)
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * 0.4;
    fillPoly(ctx, [Pn(0.1, 0.15, 0.2), Pn(1.9, 0.15, 0.2), Pn(1.9, 0.15, 2.2), Pn(0.1, 0.15, 2.2)], '#9ac0d8');
    ctx.globalAlpha = a0;
    for (const a of [0.1, 1.0, 1.9]) { const q0 = Pn(a, 0.15, 0), q1 = Pn(a, 0.15, 2.3); thick(ctx, q0.x, q0.y, q1.x, q1.y, 3, OL); line(ctx, q0.x, q0.y, q1.x, q1.y, c); }
    for (const a of [0.1, 1.9]) { const q0 = Pn(a, 0.85, 0), q1 = Pn(a, 0.85, 2.3); thick(ctx, q0.x, q0.y, q1.x, q1.y, 3, OL); line(ctx, q0.x, q0.y, q1.x, q1.y, c); }
    // end panel with timetable / advert
    fillPoly(ctx, [Pn(1.9, 0.18, 0.4), Pn(1.9, 0.82, 0.4), Pn(1.9, 0.82, 2.0), Pn(1.9, 0.18, 2.0)], OL);
    fillPoly(ctx, [Pn(1.9, 0.22, 0.45), Pn(1.9, 0.78, 0.45), Pn(1.9, 0.78, 1.95), Pn(1.9, 0.22, 1.95)], '#e8e0c8');
    fillPoly(ctx, [Pn(1.9, 0.22, 1.4), Pn(1.9, 0.78, 1.4), Pn(1.9, 0.78, 1.95), Pn(1.9, 0.22, 1.95)], '#c8102e');
    for (let i = 0; i < 4; i++) { const q = Pn(1.9, 0.3, 1.25 - i * 0.18); ctx.fillStyle = '#5a5a60'; ctx.fillRect(q.x, q.y, alongX ? 4 : -4, 1); }
    // bench
    B(0.3, 0.2, 0.45, 1.4, 0.25, 0.06, { color: '#8a8a94', outline: OL });
    // roof
    B(0.0, 0.05, 2.3, 2.0, 0.9, 0.12, { top: shade(c, 0.2), left: c, right: shade(c, -0.3), outline: OL });
    const r = Pn(1, 0.95, 2.36); ctx.fillStyle = '#ffd23a'; ctx.fillRect(r.x - 2, r.y - 1, 5, 2);
  },
});
registerProp('newsStand', { // newspaper A-board with a (blurry) tabloid headline
  h: 0.9,
  breakable: { hp: 10, debris: ['#e8e4d8', '#2a2a30'], sfx: 'wood', score: 20, drops: [['coin', 0.3]] },
  draw(ctx, ax, ay, p) {
    const P = P_(ax, ay);
    const s = P(0.5, 0.5); shadow(ctx, s.x, s.y + 1, 9, 4, 0.3);
    const a = P(0.25, 0.6, 0), b = P(0.75, 0.6, 0), tA = P(0.3, 0.5, 1.15), tB = P(0.7, 0.5, 1.15);
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fillPoly(ctx, [a, b, tB, tA].map(q => ({ x: q.x + ox, y: q.y + oy })), OL);
    fillPoly(ctx, [a, b, tB, tA], '#2a2a30');
    const i0 = P(0.3, 0.6, 0.2), i1 = P(0.7, 0.6, 0.2), i2 = P(0.68, 0.53, 1.05), i3 = P(0.32, 0.53, 1.05);
    fillPoly(ctx, [i0, i1, i2, i3], '#f4f0e4');
    const m = P(0.5, 0.57, 0.62);
    ctx.save(); ctx.translate(m.x, m.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillStyle = '#c8102e'; ctx.fillRect(-7, -9, 14, 3);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-6, -4, 12, 3); ctx.fillRect(-6, 0, 9, 3);
    ctx.fillStyle = '#5a5a60'; ctx.fillRect(-6, 5, 12, 1); ctx.fillRect(-6, 7, 10, 1); ctx.fillRect(-6, 9, 11, 1);
    ctx.restore();
  },
});
registerProp('trolley', { // abandoned shopping trolley
  h: 0.9,
  breakable: { hp: 20, debris: ['#b0b4bc', '#6a6e76'], sfx: 'metal', score: 30 },
  draw(ctx, ax, ay, p) {
    const P = P_(ax, ay);
    const c = '#b8bcc4';
    const s = P(0.5, 0.5); shadow(ctx, s.x, s.y + 1, 10, 4, 0.28);
    for (const [x, y] of [[0.2, 0.25], [0.8, 0.3], [0.2, 0.75], [0.75, 0.75]]) { const w = P(x, y, 0.05); ctx.fillStyle = OL; ctx.fillRect(w.x - 1, w.y - 1, 3, 3); }
    const bx = [[0.15, 0.2], [0.85, 0.25], [0.8, 0.8], [0.15, 0.8]];
    const lo = bx.map(q => P(q[0], q[1], 0.35)), hi = bx.map(q => P(q[0] - 0.05, q[1], 0.95));
    for (let i = 0; i < 4; i++) { tseg(ctx, lo[i], hi[i], 3, OL); seg(ctx, lo[i], hi[i], c); }
    for (const ring of [lo, hi]) for (let i = 0; i < 4; i++) { tseg(ctx, ring[i], ring[(i + 1) % 4], 3, OL); }
    for (const ring of [lo, hi]) for (let i = 0; i < 4; i++) seg(ctx, ring[i], ring[(i + 1) % 4], c);
    for (let k = 1; k < 4; k++) { const a = P(0.15 + k * 0.17, 0.8, 0.38), b = P(0.1 + k * 0.17, 0.8, 0.92); seg(ctx, a, b, shade(c, -0.25)); }
    const h0 = P(0.05, 0.2, 1.05), h1 = P(0.05, 0.8, 1.05); tseg(ctx, h0, h1, 3, OL); seg(ctx, h0, h1, '#c83030');
    for (let i = 0; i < 5; i++) { const q = P(0.3 + i * 0.1, 0.4 + (i % 2) * 0.2, 0.6); ctx.fillStyle = ['#e8c040', '#3060c8', '#e8e4d8', '#c83030', '#30a050'][i]; ctx.fillRect(q.x - 1, q.y - 2, 3, 3); }
  },
});
registerProp('trafficLight', { // pole with cycling lights. opts: phase (s offset)
  h: 3, light: { z: 2.6, r: 1.6, color: '#ff4030', intensity: 0.5 },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    const H = Z_PX * 2.4;
    shadow(ctx, b.x, b.y, 5, 2, 0.35);
    ctx.fillStyle = OL; ctx.fillRect(b.x - 2, b.y - H, 4, H + 1);
    ctx.fillStyle = '#4a4a52'; ctx.fillRect(b.x - 1, b.y - H, 2, H);
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(b.x - 1, b.y - 18, 2, 4); ctx.fillRect(b.x - 1, b.y - 10, 2, 4);
    const hx = b.x - 4, hy = b.y - H - 22;
    ctx.fillStyle = OL; ctx.fillRect(hx - 1, hy - 1, 10, 24);
    ctx.fillStyle = '#1e1e22'; ctx.fillRect(hx, hy, 8, 22);
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(hx - 2, hy - 1, 1, 24);
    const ph = ((t + (p.o.phase || 0)) % 8);
    const st = ph < 3 ? 0 : ph < 4 ? 1 : ph < 7 ? 2 : 1;
    const cols = [['#ff3020', '#4a1410'], ['#ffb020', '#4a3410'], ['#30e060', '#103a1a']];
    for (let i = 0; i < 3; i++) { ctx.fillStyle = (st === i || (st === 1 && i === 0 && ph >= 7)) ? cols[i][0] : cols[i][1]; ctx.fillRect(hx + 2, hy + 2 + i * 7, 4, 5); }
  },
});
