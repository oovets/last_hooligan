// THE LAST STAND theme: night outside the Nordhamn Arena.
// Floors, walls, props and items used by Level 8 (all ids prefixed 'laststand_').
//
// Floors: laststand_granite (forecourt slabs) laststand_plaza (pavers) laststand_crest (giant painted club crest,
//         global coords centred on the plaza) laststand_steps (stair treads, rising toward -y) laststand_tunnel
//         laststand_lino (ticket office) laststand_scorched (burnt tarmac) laststand_water (fountain pool)
// Walls:  laststand_facade laststand_stand laststand_balustrade laststand_hoarding laststand_officewall
//         laststand_ticketfront laststand_counter laststand_basin laststand_planter
// Props:  laststand_policevan laststand_burntcar laststand_floodlight laststand_flarepot laststand_statue
//         laststand_fountainjet laststand_fireworks laststand_fuse laststand_boards laststand_lintel laststand_flagpole
//         laststand_turnstile laststand_cabinet laststand_stall laststand_arenagate laststand_banner
// Items:  laststand_flare (weapon / flare projectile) laststand_megaphone (weapon)

import { registerFloor, registerWall } from '../../engine/tiles.js';
import { registerProp } from '../../game/props.js';
import { registerItem } from '../../game/items.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow } from '../../engine/gfx.js';
import { shade, mix } from '../../engine/color.js';
import { hash2 } from '../../engine/rng.js';
import { drawText } from '../../engine/font.js';
import { Z_PX } from '../../engine/constants.js';
import { drawDoll, normalizeLook } from '../../game/doll.js';
import { sampleAnim } from '../../game/poses.js';

const OL = '#120c14';
const RED = '#c8102e', WHITE = '#f4f1e8', NAVY = '#1a1a40', GOLD = '#d4af37';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);

// Crest placement (world tile coords) — the plaza in l8_laststand.js is built around this.
export const CREST = { x: 21, y: 37, r: 6.4 };

// ================================================================== floors
function plazaPixel(u, v, tx, ty) {
  const X = (tx + u) * 8, Y = (ty + v) * 8;
  const row = Math.floor(Y);
  const off = (row & 1) ? 1 : 0;
  const col = Math.floor((X + off) / 2);
  const fu = ((X + off) / 2) % 1, fv = Y % 1;
  if (fv < 0.16 || fu < 0.08) return '#262228';
  const h = hash2(col, row, 43);
  let c = h < 0.42 ? '#5e5256' : h < 0.78 ? '#564a50' : h < 0.93 ? '#6a5c5e' : '#463c42';
  // red paver accent bands every 6 tiles (frames the plaza)
  if ((((tx % 6) + 6) % 6 === 0 && u < 0.25) || (((ty % 6) + 6) % 6 === 0 && v < 0.25)) c = h < 0.5 ? '#7a2a30' : '#6a2228';
  if (fv > 0.8) c = shade(c, -0.12);
  return c;
}
registerFloor('laststand_plaza', { pixel: plazaPixel });

registerFloor('laststand_granite', {
  pixel(u, v, tx, ty, r) {
    if (u < 0.04 || v < 0.04) return '#221f28';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 41);
    let c = r < 0.33 ? '#4b4752' : r < 0.66 ? '#46424e' : '#504a57';
    // inlaid red granite border tile every 4th tile on the diagonal
    if (((tx + ty) % 4 + 4) % 4 === 0) c = r < 0.5 ? '#5a3238' : '#62363c';
    if (n < 0.07) c = '#2c2832'; else if (n > 0.96) c = '#9a8c96'; else if (n > 0.9) c = shade(c, 0.14);
    const s = (u + v + r * 0.7) % 1;
    if (s > 0.47 && s < 0.5 && n > 0.25) c = shade(c, 0.16);  // floodlit sheen
    if (u > 0.94 || v > 0.94) c = shade(c, 0.1);              // bevel
    return c;
  },
});

// Giant painted club crest: lifebuoy ring of red/white segments, red field, white anchor.
registerFloor('laststand_crest', {
  pixel(u, v, tx, ty) {
    const dx = tx + u - CREST.x, dy = ty + v - CREST.y;
    const d = Math.hypot(dx, dy);
    const R = CREST.r;
    if (d > R) return plazaPixel(u, v, tx, ty);
    const a = (dx - dy) * 0.7071, b = (dx + dy) * 0.7071;   // a: screen-right, b: screen-down
    const wear = n2((tx + u) * 24, (ty + v) * 24, 77);
    let c;
    if (d > R - 0.35) c = NAVY;
    else if (d > R - 0.5) c = GOLD;
    else if (d > R - 2.0) {
      const ang = Math.atan2(b, a);
      const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8 + 0.5) % 8;
      const frac = ((ang + Math.PI) / (Math.PI * 2)) * 8 + 0.5;
      const edge = Math.abs(frac - Math.round(frac)) < 0.04;
      c = edge ? NAVY : (seg % 2 ? RED : WHITE);
      // stars on the white segments
      if (!edge && seg % 2 === 0) {
        const rr = R - 1.25;
        const sa = Math.round((ang + Math.PI) / (Math.PI / 4)) * (Math.PI / 4) - Math.PI;
        const sx = Math.cos(sa) * rr, sy = Math.sin(sa) * rr;
        const q = Math.abs(a - sx) + Math.abs(b - sy) * 0.8;
        if (q < 0.32 || (Math.abs(a - sx) < 0.08 && Math.abs(b - sy) < 0.5) || (Math.abs(b - sy) < 0.08 && Math.abs(a - sx) < 0.5)) c = GOLD;
      }
    } else if (d > R - 2.25) c = NAVY;
    else {
      c = RED;
      // anchor
      const shank = Math.abs(a) < 0.26 && b > -2.4 && b < 2.3;
      const ringD = Math.hypot(a, b + 2.85);
      const ring = ringD < 0.62 && ringD > 0.3;
      const stock = Math.abs(b + 1.75) < 0.2 && Math.abs(a) < 1.45;
      const stockEnd = Math.hypot(Math.abs(a) - 1.5, b + 1.75) < 0.28;
      const armD = Math.hypot(a, b - 0.2);
      const arms = armD > 1.85 && armD < 2.3 && b > 0.75;
      const fl = Math.abs(a) > 1.5 && Math.abs(a) < 2.35 && b > 0.35 && b < 1.25 && (b - 0.35) > (2.35 - Math.abs(a)) * 0.6;
      if (shank || ring || stock || stockEnd || arms || fl) c = WHITE;
      else if (Math.abs(a) < 0.4 && b > -2.5 && b < 2.4) c = shade(RED, -0.25);    // drop shadow of the shank
    }
    if (wear < 0.06) c = mix(c, '#5a4e52', 0.55);
    else if (wear > 0.97) c = shade(c, -0.15);
    return c;
  },
});

// Stair treads: two steps per tile; risers face +y (toward the camera) so the stairs rise toward -y.
registerFloor('laststand_steps', {
  pixel(u, v, tx, ty) {
    const w = (v * 2) % 1, step = ty * 2 + Math.floor(v * 2);
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 44);
    const hv = hash2(tx, step, 45);
    let c;
    if (w < 0.6) c = hv < 0.5 ? '#5c5864' : '#56525e';
    else if (w < 0.68) c = '#9a96a2';                       // nosing catching the floodlights
    else c = mix('#3a3640', '#2a2630', (w - 0.68) / 0.32);   // riser
    if (w < 0.6 && n < 0.05) c = shade(c, -0.15);
    if (w < 0.6 && n > 0.97) c = shade(c, 0.12);
    // worn red runner up the middle of the flight
    if (tx >= 27 && tx <= 28 && w < 0.66) c = w < 0.6 ? (n < 0.1 ? '#6a1a24' : '#7e1e2a') : '#b8484a';
    return c;
  },
});

registerFloor('laststand_tunnel', {
  pixel(u, v, tx, ty) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 46);
    if (Math.abs(v - 0.5) < 0.06 && ((u * 8) % 1) < 0.6) return '#16141a';   // drain grate
    let c = n < 0.08 ? '#2a2830' : n > 0.95 ? '#46444e' : '#34323a';
    if (u < 0.03) c = '#222028';
    return c;
  },
});

registerFloor('laststand_lino', {
  pixel(u, v, tx, ty) {
    const gu = (u * 2) % 1, gv = (v * 2) % 1;
    if (gu < 0.05 || gv < 0.05) return '#3a4238';
    const chk = (Math.floor(u * 2) + Math.floor(v * 2) + tx + ty) & 1;
    let c = chk ? '#5c6a5a' : '#6e7a64';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 47);
    if (n < 0.05) c = '#3e4a3c';                 // scuffs
    else if (n > 0.985) c = '#8a6040';           // fag burns
    return c;
  },
});

registerFloor('laststand_scorched', {
  pixel(u, v, tx, ty, r) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 48);
    const m = n2(u * 8 + tx * 8, v * 8 + ty * 8, 49);
    let c = m < 0.55 ? '#1c1a1e' : '#26242a';
    if (n < 0.06) c = '#3a3638';
    else if (n > 0.985) c = '#7a3010';          // embers
    else if (n > 0.95) c = '#4a4446';            // ash
    return c;
  },
});

registerFloor('laststand_water', {
  pixel(u, v, tx, ty) {
    const x = (tx + u) * 6, y = (ty + v) * 6;
    const s = Math.sin(x * 1.7 + Math.sin(y * 1.3)) + Math.cos(y * 1.9 - x * 0.4);
    if (s > 1.55) return '#5aa8c4';
    if (s > 0.9) return '#24607a';
    if (s < -1.4) return '#0c2230';
    return '#163e52';
  },
});

// ================================================================== walls
registerWall('laststand_facade', {
  top: (u, v) => ((u < 0.06 || v < 0.06) ? '#7a7a86' : ((Math.floor(u * 8) + Math.floor(v * 8)) & 1) ? '#34323c' : '#3a3842'),
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    let c;
    if (py < 3) c = py === 0 ? '#b0b0ba' : '#8a8a96';                       // steel coping
    else if (py < 14) c = (py === 9 || py === 10) ? WHITE : RED;             // club cladding band
    else if (py < 16) c = '#1e1a22';
    else if (py >= H - 20) {                                                 // granite plinth
      const n = hash2(wu + variant * 5, py, 51);
      c = py === H - 20 ? '#7a7680' : n < 0.1 ? '#2e2a34' : n > 0.93 ? '#6a6670' : '#423e48';
    } else {
      // ribbed concrete panels with lit slit windows
      const rib = wu % 4;
      c = rib === 0 ? '#46444e' : rib === 1 ? '#6c6a74' : '#5c5a64';
      if ((py - 16) % 28 === 0) c = '#3a3842';
      const winCol = variant % 3 === 0 ? (wu >= 6 && wu <= 9) : variant % 3 === 1 ? (wu >= 2 && wu <= 4) || (wu >= 11 && wu <= 13) : false;
      if (winCol && py > 22 && py < H - 28 && ((py - 16) % 28) > 4) {
        const lit = hash2(variant, Math.floor((py - 16) / 28) + (side === 'left' ? 0 : 9), 52) < 0.6;
        c = (wu === 6 || wu === 9 || wu === 2 || wu === 4 || wu === 11 || wu === 13) ? '#24222a' : lit ? (py % 28 < 12 ? '#ffe2a0' : '#e8b060') : '#1c2434';
      }
      const n = hash2(wu + variant * 3, py, 53);
      if (n < 0.025) c = shade(c, -0.2);
    }
    return side === 'right' ? shade(c, -0.32) : c;
  },
});

// Inner stands (seen from the pitch side): roof edge, packed terraces of red & white.
registerWall('laststand_stand', {
  top: '#24222c',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    let c;
    if (py < 8) c = py < 2 ? '#5a5a66' : (wu % 4 === 0 ? '#ffffff' : '#2a2a34');   // roof edge with floodlight dots
    else if (py >= H - 10) c = py < H - 5 ? ((wu + variant) % 6 < 3 ? RED : WHITE) : '#1e3a22'; // advert boards / pitch wall
    else {
      const row = Math.floor((py - 8) / 5), ry = (py - 8) % 5;
      if (ry === 4) c = '#2a2026';
      else {
        const h = hash2(wu + variant * 17, row, 54);
        const head = ry <= 1;
        if (head) c = h < 0.12 ? '#3a3036' : ['#e2a97a', '#d49a6a', '#f0c098', '#b87a50', '#8a5636'][Math.floor(h * 5)];
        else c = h < 0.45 ? RED : h < 0.8 ? WHITE : h < 0.9 ? '#2a2a34' : '#7a1020';
      }
    }
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('laststand_balustrade', {
  top: (u, v) => (u < 0.08 || v < 0.08 || u > 0.92 || v > 0.92 ? '#7e7a86' : '#a8a4b0'),
  face(u, py, side, H) {
    const wu = (u * 16) % 4;
    let c;
    if (py < 4) c = py === 0 ? '#c0bcc8' : '#9a96a2';
    else if (py >= H - 4) c = '#5e5a66';
    else if (wu >= 1 && wu < 3) {
      const t = (py - 4) / (H - 8);
      const bulge = Math.abs(t - 0.5) < 0.25;
      c = wu < 2 ? (bulge ? '#a09ca8' : '#8a8692') : (bulge ? '#7a7682' : '#6a6672');
    } else return null;   // see-through between balusters
    return side === 'right' ? shade(c, -0.28) : c;
  },
});

registerWall('laststand_hoarding', {
  top: '#1a1a20',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c;
    if (py < 2 || wu < 0.8 || py >= H - 12) c = py >= H - 12 ? (py === H - 12 ? '#5a5862' : '#3e3c46') : '#14141a';
    else {
      const k = variant % 3, y = py - 2;
      if (k === 0) {        // red panel, white chain links
        c = RED;
        const cy = 16, lx = (wu * 2) % 8;
        if (Math.abs(y - cy) < 4 && (Math.abs(lx - 4) > 1.5) && (Math.abs(y - cy) > 1.5 || Math.abs(lx - 4) > 2.6)) c = WHITE;
        if (y > 28 && y < 34) c = (Math.floor(wu) % 3 === 0) ? '#8a0a1e' : WHITE;
      } else if (k === 1) { // navy panel with gold stars
        c = NAVY;
        const sx = (wu * 2) % 10, sy = y % 12;
        if ((Math.abs(sx - 5) < 1 && Math.abs(sy - 6) < 3) || (Math.abs(sy - 6) < 1 && Math.abs(sx - 5) < 3)) c = GOLD;
      } else {              // white panel with red block "lettering"
        c = WHITE;
        const ly = y % 14;
        if (ly > 3 && ly < 10 && hash2(Math.floor(wu / 1.5), Math.floor(y / 14) + variant, 55) < 0.6 && Math.floor(wu * 2) % 3 !== 0) c = RED;
      }
      // torn fly-posters
      if (hash2(Math.floor(wu / 3) + variant * 7, Math.floor(py / 9), 56) < 0.08) c = hash2(Math.floor(wu), py, 57) < 0.5 ? '#c8c0a0' : '#8a8478';
    }
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('laststand_officewall', {
  top: '#5a5650',
  face(u, py, side, H, r, variant) {
    const bx = u * 16, row = Math.floor(py / 5);
    const off = row % 2 ? 4 : 0;
    let c = '#c4bca4';
    if (py % 5 === 4 || Math.floor(bx + off) % 8 === 0) c = '#8e8672';
    if (py >= 16 && py < 20) c = RED;
    if (py >= H - 10) c = py === H - 10 ? '#1a3226' : '#2a4a3a';
    if (py < 2) c = '#e0d8c0';
    if (hash2(Math.floor(bx) + variant * 3, py, 58) < 0.03) c = shade(c, -0.25);
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('laststand_ticketfront', {
  top: '#3a3640',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c;
    if (py < 11) c = py < 2 ? '#e0e0e8' : (py > 8 ? '#7a0a1a' : RED);          // red sign fascia
    else if (py >= H - 10) c = py === H - 10 ? '#8a8692' : '#3a3640';           // counter plinth
    else {
      const inWin = wu > 1.5 && wu < 14.5;
      if (!inWin || py === 11 || py === 12) c = '#2a2830';
      else {
        const grille = Math.floor(wu) % 3 === 0;
        const lit = variant !== 3;
        c = grille ? '#6a6872' : lit ? (py < 24 ? '#ffe6b0' : '#e8b468') : '#1c2230';
        if (py === H - 13 && lit) c = '#8a6a40';     // little ticket slot ledge
      }
    }
    return side === 'right' ? shade(c, -0.32) : c;
  },
});

registerWall('laststand_counter', {
  top: (u, v) => (v < 0.15 || u < 0.08 ? '#5a3418' : '#7a4a28'),
  face(u, py, side, H) {
    let c = py < 3 ? '#6a3e20' : (py > 7 && py < 10) ? RED : '#d8d0b8';
    if (py >= H - 2) c = '#3a3632';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('laststand_basin', {
  top: (u, v) => (u < 0.12 || v < 0.12 || u > 0.88 || v > 0.88 ? '#c8c4c0' : '#aaa6a2'),
  face(u, py, side, H) {
    let c = py < 2 ? '#d0ccc8' : '#8a8682';
    if (py > H - 4 && hash2(Math.floor(u * 16), py, 59) < 0.5) c = '#4a6a4a';   // moss line
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('laststand_planter', {
  top: (u, v, variant) => (u < 0.1 || v < 0.1 || u > 0.9 || v > 0.9 ? '#8a8690' : hash2(Math.floor(u * 16), Math.floor(v * 16), variant) < 0.35 ? '#2a4a22' : '#355a2c'),
  face(u, py, side) {
    let c = py < 2 ? '#a8a4ae' : '#76727e';
    if (py % 6 === 5) c = '#5e5a66';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

// ================================================================== props
const P0 = (ax, ay) => (x, y, z) => proj(ax, ay, x, y, z);

function skewText(ctx, text, x, y, side, color, outline) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
  drawText(ctx, text, 0, -3, { color, align: 'center', outline: outline || false });
  ctx.restore();
}

function findLight(p, world) {
  if (p._light === undefined) p._light = (world && world.lights.find(l => l.prop === p)) || null;
  return p._light;
}

// ---- police van: white with blue/yellow checks, roof light bar. Roof (h 1.2) can be jumped onto.
registerProp('laststand_policevan', {
  w: 5, d: 2, h: 2.2, rotates: true,   // full-scale panel van (Blender sprite in env_vehicles.py)
  light: { z: 1.5, r: 3.2, color: '#3a5aff', intensity: 0.8 },
  update(p, world) {
    const L = findLight(p, world);
    if (!L) return;
    const ph = (p.t * 2.2 + p.x * 0.37) % 1;
    const on = ph < 0.12 || (ph > 0.22 && ph < 0.34);
    L.intensity = on ? 0.95 : 0.25;
    L.color = ph < 0.5 ? '#3a5aff' : '#2a7aff';
  },
  overlay(ctx, ax, ay, p, t) {
    const W = p.w, D = p.d, alongX = W >= D;
    const lx = alongX ? W / 2 - 0.3 : 0.3, ly = alongX ? 0.3 : D / 2 - 0.3;
    const ph = (t * 2.2 + p.x * 0.37) % 1;
    if (!(ph < 0.12 || (ph > 0.22 && ph < 0.34))) return;
    isoBox(ctx, ax, ay, lx + 0.02, ly + 0.02, 1.2, alongX ? 0.56 : 0.36, alongX ? 0.36 : 0.56, 0.09, { top: '#a0c0ff', left: '#5a7aff', right: '#3a5aff' });
    const s = proj(ax, ay, lx + 0.3, ly + 0.2, 1.32); ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 1, s.y - 1, 3, 2);
  },
  draw(ctx, ax, ay, p, t) {
    const W = p.w, D = p.d, alongX = W >= D;
    const P = P0(ax, ay);
    const cen = P(W / 2, D / 2, 0); shadow(ctx, cen.x, cen.y, 26, 10, 0.35);
    const wh = (x, y) => { const s = P(x, y, 0.14); ellipse(ctx, s.x, s.y, 4, 3, '#0c0c0e'); ellipse(ctx, s.x, s.y - 1, 2, 1, '#4a4a50'); };
    if (alongX) { wh(0.4, D - 0.05); wh(W - 0.4, D - 0.05); } else { wh(W - 0.05, 0.4); wh(W - 0.05, D - 0.4); }
    const body = '#e4e6ea';
    isoBox(ctx, ax, ay, 0.04, 0.06, 0.18, W - 0.08, D - 0.12, 1.0, { top: '#f2f4f6', left: body, right: '#a8aab4', outline: OL });
    // battenberg band on both visible faces
    const n = alongX ? 8 : 4, m = alongX ? 4 : 8;
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
      const s = (W - 0.16) / n;
      isoPanel(ctx, ax, ay, 'left', 0.08 + i * s, D - 0.06 + 0.001, s, 0.34 + k * 0.17, 0.51 + k * 0.17, (i + k) % 2 ? '#1f3fa0' : '#e8d020');
    }
    for (let i = 0; i < m; i++) for (let k = 0; k < 2; k++) {
      const s = (D - 0.16) / m;
      isoPanel(ctx, ax, ay, 'right', W - 0.04 + 0.001, 0.08 + i * s, s, 0.34 + k * 0.17, 0.51 + k * 0.17, (i + k) % 2 ? shade('#1f3fa0', -0.3) : shade('#e8d020', -0.3));
    }
    // windows
    if (alongX) {
      isoPanel(ctx, ax, ay, 'left', 0.15, D - 0.06 + 0.002, 0.95, 0.8, 1.07, '#1a2230');
      for (let i = 0; i < 6; i++) { const a = P(0.2 + i * 0.16, D - 0.06, 0.8), b = P(0.2 + i * 0.16, D - 0.06, 1.07); line(ctx, a.x, a.y, b.x, b.y, '#5a5a62'); }
      isoPanel(ctx, ax, ay, 'left', 1.3, D - 0.06 + 0.002, 0.45, 0.8, 1.07, '#2a4a66');
      isoPanel(ctx, ax, ay, 'right', W - 0.04 + 0.002, 0.12, D - 0.24, 0.76, 1.08, '#36587a');
      const hl = P(W - 0.04, 0.25, 1.02); ctx.fillStyle = '#9ac0e0'; ctx.fillRect(hl.x, hl.y, 3, 1);
      const hd = P(W - 0.04, 0.2, 0.28); ctx.fillStyle = '#fff2c0'; ctx.fillRect(hd.x - 1, hd.y - 1, 3, 2);
      const m2 = P(0.95, D - 0.06, 0.92); skewText(ctx, 'POLIS', m2.x, m2.y + 1, 'left', '#1f3fa0');
    } else {
      isoPanel(ctx, ax, ay, 'right', W - 0.04 + 0.002, 0.15, 0.95, 0.8, 1.07, '#141a24');
      for (let i = 0; i < 6; i++) { const a = P(W - 0.04, 0.2 + i * 0.16, 0.8), b = P(W - 0.04, 0.2 + i * 0.16, 1.07); line(ctx, a.x, a.y, b.x, b.y, '#4a4a52'); }
      isoPanel(ctx, ax, ay, 'left', 0.12, D - 0.06 + 0.002, W - 0.24, 0.76, 1.08, '#3a5c80');
      const hd = P(0.25, D - 0.06, 0.28); ctx.fillStyle = '#fff2c0'; ctx.fillRect(hd.x - 1, hd.y - 1, 3, 2);
      const m2 = P(W - 0.04, 1.15, 0.92); skewText(ctx, 'POLIS', m2.x, m2.y + 1, 'right', shade('#1f3fa0', -0.2));
    }
    // light bar
    const lx = alongX ? W / 2 - 0.3 : 0.3, ly = alongX ? 0.3 : D / 2 - 0.3;
    const ph = (t * 2.2 + p.x * 0.37) % 1;
    const on = ph < 0.12 || (ph > 0.22 && ph < 0.34);
    isoBox(ctx, ax, ay, lx, ly, 1.18, alongX ? 0.6 : 0.4, alongX ? 0.4 : 0.6, 0.1, { top: on ? '#a0c0ff' : '#2a3a8a', left: on ? '#5a7aff' : '#1a2a6a', right: on ? '#3a5aff' : '#14205a', outline: OL });
    if (on) { const s = P(lx + 0.3, ly + 0.2, 1.3); ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 1, s.y - 1, 3, 2); }
  },
});

// ---- burnt-out car: charred shell, embers, smoke
registerProp('laststand_burntcar', {
  w: 5, d: 2, h: 1.3, rotates: true,
  light: { z: 0.8, r: 2.8, color: '#ff6a20', intensity: 0.6, flicker: true },
  update(p, world, dt) {
    p.smokeT = (p.smokeT || 0) - dt;
    if (p.smokeT <= 0 && world.fx) {
      p.smokeT = 0.18 + Math.random() * 0.25;
      world.fx.add({ x: p.x + 0.4 + Math.random() * 1.2, y: p.y + 0.3 + Math.random() * 0.4, z: 0.9, vx: 0.15, vy: -0.1, vz: 0.9 + Math.random() * 0.5, life: 1.6 + Math.random(), kind: 'puff', size: 3 + Math.random() * 3, color: Math.random() < 0.5 ? '#3a3638' : '#2a2628', g: 0 });
    }
  },
  overlay(ctx, ax, ay, p, t) {
    const W = p.w, D = p.d, P = P0(ax, ay);
    for (let i = 0; i < 6; i++) {
      const fx = 0.3 + ((i * 0.37 + p.x) % 1) * (W - 0.6), fy = 0.3 + ((i * 0.53) % 1) * (D - 0.6);
      const s = P(fx, fy, 0.56);
      const fl = Math.sin(t * (7 + i) + i * 2) > 0.2;
      ctx.fillStyle = fl ? '#ffb030' : '#c84010'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      if (i < 3 && fl) { const h = 2 + Math.round(Math.abs(Math.sin(t * 9 + i)) * 4); ctx.fillStyle = '#ff6a10'; ctx.fillRect(Math.round(s.x), Math.round(s.y) - h, 2, h); ctx.fillStyle = '#ffd060'; ctx.fillRect(Math.round(s.x), Math.round(s.y) - Math.max(1, h - 2), 1, Math.max(1, h - 3)); }
    }
  },
  draw(ctx, ax, ay, p, t) {
    const W = p.w, D = p.d;
    const P = P0(ax, ay);
    const cen = P(W / 2, D / 2, 0); shadow(ctx, cen.x, cen.y, 24, 9, 0.45);
    const rim = (x, y) => { const s = P(x, y, 0.1); ellipse(ctx, s.x, s.y, 3, 2, '#3a2a22'); ellipse(ctx, s.x, s.y, 1, 1, '#120c0c'); };
    rim(0.35, D - 0.08); rim(W - 0.4, D - 0.08);
    isoBox(ctx, ax, ay, 0.06, 0.1, 0.1, W - 0.12, D - 0.2, 0.45, { top: '#3a2a22', left: '#2a2220', right: '#1e1816', outline: OL });
    // rust blotches on the side
    for (let i = 0; i < 7; i++) {
      const s = P(0.15 + i * 0.25, D - 0.1, 0.22 + (i % 3) * 0.08);
      ctx.fillStyle = i % 2 ? '#6a3418' : '#4a2a18'; ctx.fillRect(s.x, s.y, 3, 2);
    }
    // gutted cabin frame (no glass)
    const c0 = 0.55, c1 = 1.5;
    isoBox(ctx, ax, ay, c0, 0.18, 0.55, c1 - c0, D - 0.36, 0.05, { color: '#1a1414' });
    for (const [x, y] of [[c0, 0.18], [c1, 0.18], [c0, D - 0.18], [c1, D - 0.18]]) {
      const a = P(x, y, 0.55), b = P(x + (x === c0 ? 0.12 : -0.08), y, 0.95);
      thick(ctx, a.x, a.y, b.x, b.y, 2, '#2a2020');
    }
    const r0 = P(c0 + 0.12, 0.18, 0.95), r1 = P(c1 - 0.08, 0.18, 0.95), r2 = P(c1 - 0.08, D - 0.18, 0.95), r3 = P(c0 + 0.12, D - 0.18, 0.95);
    line(ctx, r0.x, r0.y, r1.x, r1.y, '#3a2a22'); line(ctx, r1.x, r1.y, r2.x, r2.y, '#3a2a22'); line(ctx, r2.x, r2.y, r3.x, r3.y, '#2a2020'); line(ctx, r3.x, r3.y, r0.x, r0.y, '#2a2020');
    // embers & little flames
    for (let i = 0; i < 6; i++) {
      const fx = 0.3 + ((i * 0.37 + p.x) % 1) * (W - 0.6), fy = 0.3 + ((i * 0.53) % 1) * (D - 0.6);
      const s = P(fx, fy, 0.56);
      const fl = Math.sin(t * (7 + i) + i * 2) > 0.2;
      ctx.fillStyle = fl ? '#ffb030' : '#c84010'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      if (i < 3 && fl) { const h = 2 + Math.round(Math.abs(Math.sin(t * 9 + i)) * 4); ctx.fillStyle = '#ff6a10'; ctx.fillRect(Math.round(s.x), Math.round(s.y) - h, 2, h); ctx.fillStyle = '#ffd060'; ctx.fillRect(Math.round(s.x), Math.round(s.y) - Math.max(1, h - 2), 1, Math.max(1, h - 3)); }
    }
  },
});

// ---- floodlight pylon: lattice mast with a bank of lamps
registerProp('laststand_floodlight', {
  h: 3,
  light: { z: 6, r: 7.5, color: '#e8f0ff', intensity: 0.95 },
  overlay(ctx, ax, ay, p) {
    if (p.o.off) return;
    const P = P0(ax, ay), top = P(0.5, 0.5, 6.2);
    const aim = p.o.aim || { x: 4, y: 4 };
    const g = P(0.5 + aim.x, 0.5 + aim.y, 0);
    ctx.save(); ctx.globalAlpha = 0.07;
    fillPoly(ctx, [{ x: top.x - 10, y: top.y - 4 }, { x: top.x + 10, y: top.y - 4 }, { x: g.x + 40, y: g.y }, { x: g.x - 40, y: g.y }], '#e8f0ff');
    ctx.restore();
  },
  draw(ctx, ax, ay, p, t, world) {
    const P = P0(ax, ay);
    isoBox(ctx, ax, ay, 0.22, 0.22, 0, 0.56, 0.56, 0.5, { color: '#5a5862', outline: OL });
    const b = P(0.5, 0.5, 0.5), top = P(0.5, 0.5, 6.2);
    const off = p.o.off;
    // faint beam toward the aim point (local offset in tiles)
    const aim = p.o.aim || { x: 4, y: 4 };
    if (!off) {
      const g = P(0.5 + aim.x, 0.5 + aim.y, 0);
      ctx.save(); ctx.globalAlpha = 0.07;
      fillPoly(ctx, [{ x: top.x - 10, y: top.y - 4 }, { x: top.x + 10, y: top.y - 4 }, { x: g.x + 40, y: g.y }, { x: g.x - 40, y: g.y }], '#e8f0ff');
      ctx.restore();
    }
    for (const dx of [-3, 3]) { thick(ctx, b.x + dx, b.y, top.x + dx * 0.5, top.y, 2, OL); line(ctx, b.x + dx, b.y, top.x + dx * 0.5, top.y, '#7a7a86'); }
    const segs = 9;
    for (let i = 0; i < segs; i++) {
      const y0 = b.y + (top.y - b.y) * (i / segs), y1 = b.y + (top.y - b.y) * ((i + 1) / segs);
      const w0 = 3 - 1.5 * (i / segs), w1 = 3 - 1.5 * ((i + 1) / segs);
      line(ctx, b.x - w0, y0, b.x + w1, y1, '#5a5a66');
      line(ctx, b.x + w0, y0, b.x - w1, y1, '#4a4a56');
    }
    // lamp head
    const hx = top.x, hy = top.y - 6;
    ctx.fillStyle = OL; ctx.fillRect(hx - 13, hy - 9, 26, 14);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(hx - 12, hy - 8, 24, 12);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const flick = !off && (p.o.flicker ? Math.sin(t * 11 + c) > -0.6 : true);
      ctx.fillStyle = flick ? '#ffffff' : '#4a4a50';
      ctx.fillRect(hx - 11 + c * 6, hy - 7 + r * 6, 4, 4);
      if (flick) { ctx.fillStyle = '#d8e8ff'; ctx.fillRect(hx - 11 + c * 6, hy - 4 + r * 6, 4, 1); }
    }
  },
});

// ---- burning ground flare (hazard: singes anyone standing on it)
registerProp('laststand_flarepot', {
  h: 0, solid: false, depthBias: -0.2,
  light: { z: 0.5, r: 3.4, color: '#ff2a3a', intensity: 0.85, flicker: true },
  overlay(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    ctx.save(); ctx.globalAlpha = 0.28 + 0.1 * Math.sin(t * 17);
    ellipse(ctx, b.x, b.y, 14, 6, '#ff2a3a');
    ctx.restore();
    const fh = 4 + Math.round(Math.abs(Math.sin(t * 23)) * 4);
    ctx.fillStyle = '#ff3a4a'; ctx.fillRect(b.x - 1, b.y - 9 - fh, 4, fh);
    ctx.fillStyle = '#ffd0d8'; ctx.fillRect(b.x, b.y - 9 - fh + 2, 2, fh - 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x, b.y - 10, 2, 2);
  },
  update(p, world, dt) {
    p.tick = (p.tick || 0) - dt;
    p.smokeT = (p.smokeT || 0) - dt;
    if (p.smokeT <= 0 && world.fx) {
      p.smokeT = 0.15 + Math.random() * 0.2;
      world.fx.add({ x: p.x + 0.5, y: p.y + 0.5, z: 0.5, vx: 0.2 + Math.random() * 0.2, vy: -0.15, vz: 0.8 + Math.random() * 0.6, life: 1.4 + Math.random(), kind: 'puff', size: 3 + Math.random() * 3, color: Math.random() < 0.6 ? '#8a2a3a' : '#5a2a34', g: 0 });
      if (Math.random() < 0.4) world.fx.add({ x: p.x + 0.5, y: p.y + 0.5, z: 0.45, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: 2 + Math.random() * 2, life: 0.35, color: '#ffd0a0', g: 0.6 });
    }
    if (p.tick > 0) return;
    p.tick = 0.6;
    for (const f of world.fighters) {
      if (!f.alive || f.invuln > 0 || f.z > 0.3 || f.isDown) continue;
      const dx = f.x - (p.x + 0.5), dy = f.y - (p.y + 0.5), d = Math.hypot(dx, dy);
      if (d > 0.5) continue;
      const hit = { attacker: null, def: { hz: 0.4, sfx: 'flare' }, dmg: 4, dir: { x: dx / (d || 1) || 1, y: dy / (d || 1) }, kb: 3, stun: 0.3, knockdown: false, launch: 0, unblockable: true, guardDmg: 0 };
      const res = f.takeHit(hit, world);
      world.onHit({ x: p.x + 0.5, y: p.y + 0.5 }, f, hit.def, res, 4);
      world.fx.spark(f.x, f.y, 0.4, '#ff6a3a', 6);
      if (f.isPlayer && !world._lsFlareTip) { world._lsFlareTip = true; world.toast('OUCH! FLARES BURN!'); }
    }
  },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    ctx.save(); ctx.globalAlpha = 0.28 + 0.1 * Math.sin(t * 17);
    ellipse(ctx, b.x, b.y, 14, 6, '#ff2a3a');
    ctx.restore();
    thick(ctx, b.x - 2, b.y, b.x + 1, b.y - 8, 3, OL);
    thick(ctx, b.x - 2, b.y, b.x + 1, b.y - 8, 1, '#c81830');
    const fh = 4 + Math.round(Math.abs(Math.sin(t * 23)) * 4);
    ctx.fillStyle = '#ff3a4a'; ctx.fillRect(b.x - 1, b.y - 9 - fh, 4, fh);
    ctx.fillStyle = '#ffd0d8'; ctx.fillRect(b.x, b.y - 9 - fh + 2, 2, fh - 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(b.x, b.y - 10, 2, 2);
  },
});

// ---- bronze statue of a club legend on a granite plinth (opts: text, sub, face:'left'|'right', pose)
const BRONZE = normalizeLook({
  skin: '#9a7440', hair: { style: 'crop', color: '#6a4c22' }, facial: 'tache',
  jacket: { style: 'kit', color: '#8a6a34', trim: '#6a4e24', pattern: 'plain', badge: '#b8945a' }, shirt: '#8a6a34',
  pants: { style: 'shorts', color: '#7a5c2c', socks: '#8a6a34' }, shoes: { color: '#5a4020', sole: '#4a3418', style: 'boot' },
  scarf: null, build: 1.15, height: 1.3,
});
const statuePoses = {};
registerProp('laststand_statue', {
  h: 1.6,
  light: { z: 0.2, r: 2.4, color: '#ffd8a0', intensity: 0.6 },
  overlay(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    const m = P(0.5, 0.88, 0.95); skewText(ctx, (p.o.text || 'LEGEND').slice(0, 5), m.x, m.y - 1, 'left', '#3a2810');
    const m2 = P(0.5, 0.88, 0.68); skewText(ctx, (p.o.sub || '').slice(0, 5), m2.x, m2.y, 'left', '#4a3418');
    const pk = p.o.pose || 'victory';
    const pose = statuePoses[pk] || (statuePoses[pk] = sampleAnim(pk, 0.1, {}));
    const s = P(0.5, 0.5, 1.42);
    drawDoll(ctx, s.x, s.y, BRONZE, pose, { flip: p.o.face === 'left', face: 'normal', time: 0 });
    ctx.fillStyle = '#4a8a72'; ctx.fillRect(s.x - 3, s.y - 30, 1, 6); ctx.fillRect(s.x + 2, s.y - 18, 1, 5);
    if (Math.floor(t * 2) % 7 === 0) { ctx.fillStyle = '#ffe8b0'; ctx.fillRect(s.x - 2, s.y - 46, 1, 1); }
  },
  draw(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    isoBox(ctx, ax, ay, 0.04, 0.04, 0, 0.92, 0.92, 0.25, { color: '#3e3a44', outline: OL });
    isoBox(ctx, ax, ay, 0.12, 0.12, 0.25, 0.76, 0.76, 1.05, { top: '#6a6670', left: '#55515c', right: '#3e3a46', outline: OL });
    isoBox(ctx, ax, ay, 0.08, 0.08, 1.3, 0.84, 0.84, 0.12, { color: '#5e5a66', outline: OL });
    // bronze plaque + inscription on the visible faces
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.881, 0.6, 0.55, 1.05, '#7a5a2a');
    isoPanel(ctx, ax, ay, 'left', 0.24, 0.882, 0.52, 0.6, 1.0, '#a07a3a');
    const m = P(0.5, 0.88, 0.95); skewText(ctx, (p.o.text || 'LEGEND').slice(0, 5), m.x, m.y - 1, 'left', '#3a2810');
    const m2 = P(0.5, 0.88, 0.68); skewText(ctx, (p.o.sub || '').slice(0, 5), m2.x, m2.y, 'left', '#4a3418');
    const pk = p.o.pose || 'victory';
    const pose = statuePoses[pk] || (statuePoses[pk] = sampleAnim(pk, 0.1, {}));
    const s = P(0.5, 0.5, 1.42);
    drawDoll(ctx, s.x, s.y, BRONZE, pose, { flip: p.o.face === 'left', face: 'normal', time: 0 });
    // verdigris streaks + glint
    ctx.fillStyle = '#4a8a72'; ctx.fillRect(s.x - 3, s.y - 30, 1, 6); ctx.fillRect(s.x + 2, s.y - 18, 1, 5);
    if (Math.floor(t * 2) % 7 === 0) { ctx.fillStyle = '#ffe8b0'; ctx.fillRect(s.x - 2, s.y - 46, 1, 1); }
  },
});

// ---- fountain centre: stacked bowls with animated jets (stands on the middle water tile)
registerProp('laststand_fountainjet', {
  h: 1.5, depthBias: 0.05,
  light: { z: 0.4, r: 3.2, color: '#6ad8ff', intensity: 0.55 },
  overlay(ctx, ax, ay, p, t) {
    const b1 = proj(ax, ay, 0.5, 0.5, 0.9);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + 0.2;
      const cx = Math.cos(a), cy = Math.sin(a) * 0.5;
      for (let i = 0; i < 9; i++) {
        const u = ((i / 9) + t * 0.9 + k * 0.07) % 1;
        const x = b1.x + cx * u * 15, y = b1.y - 20 - (u * 14 - u * u * 18) + cy * u * 8;
        ctx.fillStyle = i % 3 ? '#9ad8f0' : '#e8f8ff';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
      }
    }
    const tip = Math.round(Math.sin(t * 9) * 1.5);
    ctx.fillStyle = '#e8f8ff'; ctx.fillRect(b1.x - 1, b1.y - 27 + tip, 2, 7);
  },
  draw(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    isoBox(ctx, ax, ay, 0.3, 0.3, 0, 0.4, 0.4, 0.9, { top: '#b8b4b0', left: '#9a9692', right: '#76726e', outline: OL });
    const b1 = P(0.5, 0.5, 0.9);
    ellipse(ctx, b1.x, b1.y, 15, 6, OL); ellipse(ctx, b1.x, b1.y - 1, 14, 5, '#a8a4a0'); ellipse(ctx, b1.x, b1.y - 2, 11, 3, '#2a6a8a');
    thick(ctx, b1.x, b1.y - 2, b1.x, b1.y - 18, 4, OL); thick(ctx, b1.x, b1.y - 2, b1.x, b1.y - 18, 2, '#a8a4a0');
    ellipse(ctx, b1.x, b1.y - 18, 8, 3, OL); ellipse(ctx, b1.x, b1.y - 19, 7, 2, '#b8b4b0');
    // jets: parabolic arcs of droplets
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + 0.2;
      const cx = Math.cos(a), cy = Math.sin(a) * 0.5;
      for (let i = 0; i < 9; i++) {
        const u = ((i / 9) + t * 0.9 + k * 0.07) % 1;
        const x = b1.x + cx * u * 15, y = b1.y - 20 - (u * 14 - u * u * 18) + cy * u * 8;
        ctx.fillStyle = i % 3 ? '#9ad8f0' : '#e8f8ff';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
      }
    }
    const tip = Math.round(Math.sin(t * 9) * 1.5);
    ctx.fillStyle = '#e8f8ff'; ctx.fillRect(b1.x - 1, b1.y - 27 + tip, 2, 7);
  },
});

// ---- crate of fireworks: break it -> fuse fizzes -> BANG (hurts everyone nearby, chains to other crates)
registerProp('laststand_fireworks', {
  h: 0.7,
  breakable: { hp: 6, debris: ['#8a5a30', '#c8102e', '#e8c020'], sfx: 'wood', score: 60, leaves: 'laststand_fuse' },
  draw(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    const tubes = [[0.3, 0.3, '#d82020'], [0.55, 0.3, '#20a0d8'], [0.3, 0.6, '#e8c020'], [0.6, 0.6, '#d820a0'], [0.45, 0.45, '#30c040']];
    isoBox(ctx, ax, ay, 0.14, 0.14, 0, 0.72, 0.72, 0.5, { color: '#8a5a30', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.25, 0.861, 0.5, 0.12, 0.38, RED);
    const s = P(0.5, 0.86, 0.25); ctx.fillStyle = '#ffe14a'; ctx.fillRect(s.x - 1, s.y - 3, 3, 1); ctx.fillRect(s.x, s.y - 4, 1, 3);
    for (const [x, y, c] of tubes) {
      const a = P(x, y, 0.5), b = P(x, y, 0.85);
      thick(ctx, a.x, a.y, b.x, b.y, 4, OL); thick(ctx, a.x, a.y, b.x, b.y, 2, c);
      ctx.fillStyle = '#f0f0f0'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 3, 2, 3);
    }
    const f = P(0.86, 0.5, 0.4); line(ctx, f.x, f.y, f.x + 5, f.y - 4, '#2a2a2a');
  },
});
registerProp('laststand_fuse', {
  h: 0, solid: false,
  update(p, world, dt) {
    p.fuseT = (p.fuseT || 0) + dt;
    if (world.fx && Math.random() < 0.6) world.fx.add({ x: p.x + 0.5 + (Math.random() - 0.5) * 0.3, y: p.y + 0.5, z: 0.2, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 2 + Math.random() * 3, life: 0.3, color: Math.random() < 0.5 ? '#ffe14a' : '#ffffff', g: 0.8 });
    if (!p.hissed) { p.hissed = true; world.sfx('hiss', { x: p.x, y: p.y }); if (!world._lsFwTip) { world._lsFwTip = true; world.toast('FUSE LIT - LEG IT!'); } }
    if (p.fuseT < 1.1 || p.removed) return;
    p.removed = true;
    const cx = p.x + 0.5, cy = p.y + 0.5;
    world.sfx('explosion', { x: cx, y: cy }); world.sfx('glass', { x: cx, y: cy });
    if (world.camera) world.camera.shake(7, 0.35);
    world.hitstop = Math.max(world.hitstop, 0.06);
    const cols = ['#ff3a4a', '#ffe14a', '#3ab8ff', '#ffffff', '#ff7ae0', '#7aff9a'];
    if (world.fx) {
      world.fx.confetti(cx, cy, 0.3, cols, 34);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 5;
        world.fx.add({ x: cx, y: cy, z: 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 2 + Math.random() * 6, life: 0.6 + Math.random() * 0.4, color: cols[i % cols.length], size: 2, g: 0.5 });
      }
      world.fx.add({ x: cx, y: cy, z: 0.5, kind: 'ring', life: 0.35, size: 4, color: '#ffe14a', g: 0 });
      world.fx.add({ x: cx, y: cy, z: 0.6, kind: 'flash', life: 0.15, size: 14, color: '#ffffff', g: 0 });
      world.fx.dust(cx, cy, 0, 8);
    }
    world._lsFlash = { x: cx, y: cy, t: world.time };
    for (const f of world.fighters) {
      if (!f.alive || f.invuln > 0) continue;
      const dx = f.x - cx, dy = f.y - cy, d = Math.hypot(dx, dy);
      if (d > 2.2 || f.z > 1.2) continue;
      const dmg = f.isPlayer ? 14 : 22;
      const hit = { attacker: null, def: { hz: 1, sfx: 'hitHeavy', shake: 4 }, dmg, dir: { x: d > 0.05 ? dx / d : 1, y: d > 0.05 ? dy / d : 0 }, kb: 6, stun: 0.6, knockdown: true, launch: 4, unblockable: true, guardDmg: 0 };
      const res = f.takeHit(hit, world);
      world.onHit({ x: cx, y: cy }, f, hit.def, res, dmg);
      if (f.team !== 'player' && res !== 'miss') world.addScore(150, f.x, f.y, 1, true);
    }
    // chain reaction: other breakables in the blast radius
    for (const o of world.props) {
      if (o === p || o.removed || !o.def.breakable) continue;
      if (Math.hypot(o.cx - cx, o.cy - cy) < 2.2) world.damageProp(o, 30, null);
    }
    world.rebuildPropGrid();
  },
  draw(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    const k = Math.min(1, (p.fuseT || 0) / 1.1);
    for (const [x, y, c, a] of [[0.3, 0.4, '#d82020', 0.4], [0.6, 0.55, '#20a0d8', -0.6], [0.45, 0.7, '#e8c020', 1.2]]) {
      const s = P(x, y, 0.05);
      thick(ctx, s.x - Math.cos(a) * 4, s.y - Math.sin(a) * 2, s.x + Math.cos(a) * 4, s.y + Math.sin(a) * 2, 3, OL);
      thick(ctx, s.x - Math.cos(a) * 4, s.y - Math.sin(a) * 2, s.x + Math.cos(a) * 4, s.y + Math.sin(a) * 2, 1, c);
    }
    const s = P(0.5, 0.5, 0.1);
    if (Math.floor(t * 20) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 1, s.y - 2, 3, 3); }
    ctx.save(); ctx.globalAlpha = 0.25 + 0.4 * k; ellipse(ctx, s.x, s.y, 6 + k * 8, 3 + k * 4, '#ff8a20'); ctx.restore();
  },
});

// ---- boarded-up opening in the arena facade (breakable; place with { secret }) + the lintel that stays
function drawLintel(ctx, ax, ay, p) {
  isoBox(ctx, ax, ay, 0, 0, 2.7, p.w, 1, 2.3, { top: '#3a3842', left: '#5c5a64', right: '#3e3c46' });
  isoPanel(ctx, ax, ay, 'left', 0, 1.001, p.w, 4.45, 5.0, RED);
  isoPanel(ctx, ax, ay, 'left', 0, 1.002, p.w, 4.68, 4.75, WHITE);
  isoPanel(ctx, ax, ay, 'left', 0, 1.002, p.w, 2.7, 2.85, '#2a2830');
}
registerProp('laststand_boards', {
  w: 2, d: 1, h: 3,
  breakable: { hp: 24, debris: ['#8a6a40', '#6a4a28', '#c8c0a0'], sfx: 'wood', score: 100, leaves: 'laststand_lintel', drops: [['coin', 0.8]] },
  draw(ctx, ax, ay, p) {
    const P = P0(ax, ay);
    isoPanel(ctx, ax, ay, 'left', 0, 0.75, p.w, 0, 2.7, '#0c0a10');
    for (let i = 0; i < 7; i++) {
      const z0 = 0.15 + i * 0.36;
      const tilt = (i % 3 - 1) * 0.06;
      const a = P(0.02, 0.8, z0 + tilt), b = P(p.w - 0.02, 0.8, z0 - tilt);
      thick(ctx, a.x, a.y, b.x, b.y, 6, OL);
      thick(ctx, a.x, a.y, b.x, b.y, 4, i % 2 ? '#8a6a40' : '#7a5a34');
      line(ctx, a.x, a.y - 1, b.x, b.y - 1, '#a8885a');
    }
    const m = P(p.w / 2, 0.8, 1.45); skewText(ctx, 'KEEP OUT', m.x, m.y, 'left', '#e8e0c8', '#3a1010');
    drawLintel(ctx, ax, ay, p);
  },
});
registerProp('laststand_lintel', { w: 2, d: 1, h: 0, solid: false, draw: drawLintel });

// ---- club flag on a pole (opts.colors = [a, b], opts.anchor)
registerProp('laststand_flagpole', {
  h: 2.5,
  overlay(ctx, ax, ay, p, t) {
    const top = proj(ax, ay, 0.5, 0.5, 4.8);
    const [ca, cb] = p.o.colors || [RED, WHITE];
    const FW = 18, FH = 11;
    for (let i = 0; i < FW; i++) {
      const wv = Math.sin(t * 5 + i * 0.45 + p.x) * 1.6 * (i / FW);
      const x = top.x + 1 + i, y0 = Math.round(top.y + 1 + wv);
      for (let j = 0; j < FH; j++) {
        let c = j < FH / 2 ? ca : cb;
        if (p.o.anchor && Math.abs(i - 9) < 1 && j > 2 && j < 9) c = j < 5 ? cb : ca;
        if (p.o.anchor && j === 7 && Math.abs(i - 9) < 3) c = j < FH / 2 ? cb : ca;
        ctx.fillStyle = shade(c, Math.cos(t * 5 + i * 0.45 + p.x) * 0.15);
        ctx.fillRect(x, y0 + j, 1, 1);
      }
    }
  },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 4.8);
    isoBox(ctx, ax, ay, 0.35, 0.35, 0, 0.3, 0.3, 0.2, { color: '#5a5862' });
    thick(ctx, b.x, b.y, top.x, top.y, 3, OL); line(ctx, b.x, b.y, top.x, top.y, '#c0c0c8');
    ctx.fillStyle = GOLD; ctx.fillRect(top.x - 1, top.y - 2, 3, 2);
    const [ca, cb] = p.o.colors || [RED, WHITE];
    const FW = 18, FH = 11;
    for (let i = 0; i < FW; i++) {
      const wv = Math.sin(t * 5 + i * 0.45 + p.x) * 1.6 * (i / FW);
      const x = top.x + 1 + i, y0 = Math.round(top.y + 1 + wv);
      for (let j = 0; j < FH; j++) {
        let c = j < FH / 2 ? ca : cb;
        if (p.o.anchor && Math.abs(i - 9) < 1 && j > 2 && j < 9) c = j < 5 ? cb : ca;
        if (p.o.anchor && j === 7 && Math.abs(i - 9) < 3) c = j < FH / 2 ? cb : ca;
        const shadeK = Math.cos(t * 5 + i * 0.45 + p.x) * 0.15;
        ctx.fillStyle = shade(c, shadeK);
        ctx.fillRect(x, y0 + j, 1, 1);
      }
    }
  },
});

registerProp('laststand_turnstile', {
  h: 1.0,
  overlay(ctx, ax, ay, p, t) {
    const l = proj(ax, ay, 0.3, 0.7, 0.98); ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#3aff7a' : '#1a6a3a'; ctx.fillRect(l.x - 1, l.y - 1, 2, 2);
  },
  draw(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    isoBox(ctx, ax, ay, 0.15, 0.3, 0, 0.3, 0.4, 0.95, { top: '#a0a4ac', left: '#7a7e86', right: '#5a5e66', outline: OL });
    const hub = P(0.55, 0.5, 0.75);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094 + 0.4;
      const e = P(0.55 + Math.cos(a) * 0.38, 0.5 + Math.sin(a) * 0.38, 0.75 - 0.05 * k);
      thick(ctx, hub.x, hub.y, e.x, e.y, 2, '#c0c4cc');
    }
    const l = P(0.3, 0.7, 0.98); ctx.fillStyle = Math.floor(t * 1.5) % 2 ? '#3aff7a' : '#1a6a3a'; ctx.fillRect(l.x - 1, l.y - 1, 2, 2);
  },
});

registerProp('laststand_cabinet', {
  h: 1.0,
  draw(ctx, ax, ay, p) {
    const P = P0(ax, ay);
    const c = p.o.color || '#6e727a';
    isoBox(ctx, ax, ay, 0.12, 0.15, 0, 0.76, 0.7, 1.0, { color: c, outline: OL });
    for (let i = 1; i < 3; i++) { const a = P(0.12, 0.85, i / 3), b = P(0.88, 0.85, i / 3); line(ctx, a.x, a.y, b.x, b.y, shade(c, -0.4)); }
    for (let i = 0; i < 3; i++) { const h = P(0.5, 0.85, (i + 0.6) / 3); ctx.fillStyle = '#c8ccd4'; ctx.fillRect(h.x - 2, h.y - 1, 4, 1); }
  },
});

// ---- merch stall (striped canopy, scarves on the rail)
registerProp('laststand_stall', {
  w: 2, d: 1, h: 1.6,
  breakable: null,
  draw(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    const W = p.w, D = p.d;
    for (const [x, y] of [[0.1, 0.1], [W - 0.1, 0.1], [0.1, D - 0.1], [W - 0.1, D - 0.1]]) { const a = P(x, y, 0), b = P(x, y, 1.9); thick(ctx, a.x, a.y, b.x, b.y, 2, '#3a3a44'); }
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, W - 0.1, D - 0.2, 0.8, { top: '#d8d0b8', left: '#2a4a8a', right: '#1a3060', outline: OL });
    // scarves laid out on the table
    for (let i = 0; i < 6; i++) {
      const s = P(0.2 + i * 0.28, 0.4, 0.81);
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? WHITE : RED; ctx.fillRect(s.x - 2 + k, s.y - 1 + (k >> 1), 1, 2); }
    }
    // hanging scarves on the front rail
    for (let i = 0; i < 5; i++) {
      const s = P(0.25 + i * 0.36, D - 0.1, 1.85);
      const sw = Math.round(Math.sin(t * 2 + i) * 1);
      for (let k = 0; k < 9; k++) { ctx.fillStyle = (k >> 1) % 2 ? WHITE : RED; ctx.fillRect(s.x + sw * (k > 4 ? 1 : 0), s.y + k, 2, 1); }
    }
    // canopy (striped)
    const n = 8;
    for (let i = 0; i < n; i++) isoBox(ctx, ax, ay, -0.05 + i * (W + 0.1) / n, -0.05, 1.9, (W + 0.1) / n, D + 0.1, 0.12, { top: i % 2 ? WHITE : RED, left: i % 2 ? shade(WHITE, -0.15) : shade(RED, -0.15), right: shade(RED, -0.35) });
    const m = P(W / 2, D - 0.1, 0.45); skewText(ctx, 'MERCH', m.x, m.y, 'left', '#ffe14a');
  },
});

// ---- the arena gates (2 tiles deep along y, bars near the +x face). interact gate; opts.ajar for cutscenes.
registerProp('laststand_arenagate', {
  w: 1, d: 2, h: 3, interact: { kind: 'gate', key: null },
  overlay(ctx, ax, ay, p, t) {
    if (!p.o.requiresExit || Math.floor(t * 2) % 2 === 0) return;
    const m = proj(ax, ay, 0.85, 1, 1.5); ctx.fillStyle = '#ff3030'; ctx.fillRect(m.x - 1, m.y + 9, 3, 3);
  },
  draw(ctx, ax, ay, p, t) {
    const P = P0(ax, ay);
    const open = p.open || p.o.ajar;
    const bars = (pts) => {
      const [a, b] = pts;
      const zt = 2.8 * Z_PX;
      for (let i = 0; i <= 8; i++) {
        const u = i / 8, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
        thick(ctx, x, y, x, y - zt, 3, OL); line(ctx, x, y, x, y - zt, '#4a4a56');
        ctx.fillStyle = GOLD; ctx.fillRect(Math.round(x) - 1, Math.round(y - zt) - 3, 2, 3);
      }
      thick(ctx, a.x, a.y - zt + 4, b.x, b.y - zt + 4, 3, OL); line(ctx, a.x, a.y - zt + 4, b.x, b.y - zt + 4, '#6a6a76');
      thick(ctx, a.x, a.y - zt * 0.45, b.x, b.y - zt * 0.45, 3, OL); line(ctx, a.x, a.y - zt * 0.45, b.x, b.y - zt * 0.45, '#5a5a66');
    };
    if (open) {
      bars([P(0.1, 0.05, 0), P(0.85, 0.05, 0)]);
      bars([P(0.1, 1.95, 0), P(0.85, 1.95, 0)]);
    } else {
      bars([P(0.85, 0, 0), P(0.85, 1, 0)]);
      bars([P(0.85, 1, 0), P(0.85, 2, 0)]);
      // crest medallion where the leaves meet
      const m = P(0.85, 1, 1.5);
      ellipse(ctx, m.x, m.y, 7, 8, OL); ellipse(ctx, m.x, m.y, 6, 7, GOLD); ellipse(ctx, m.x, m.y, 5, 6, RED);
      ctx.fillStyle = WHITE; ctx.fillRect(m.x, m.y - 4, 1, 8); ctx.fillRect(m.x - 2, m.y - 3, 5, 1);
      ctx.fillRect(m.x - 3, m.y + 2, 1, 2); ctx.fillRect(m.x + 3, m.y + 2, 1, 2); ctx.fillRect(m.x - 2, m.y + 4, 5, 1);
      if (p.o.requiresExit && Math.floor(t * 2) % 2) { ctx.fillStyle = '#ff3030'; ctx.fillRect(m.x - 1, m.y + 9, 3, 3); }
    }
    // lintel over the tunnel mouth
    isoBox(ctx, ax, ay, 0, 0, 3.0, 1, 2, 2.0, { top: '#3a3842', left: '#5c5a64', right: '#46444e' });
    isoPanel(ctx, ax, ay, 'right', 1.001, 0, 2, 4.45, 5.0, shade(RED, -0.3));
    isoPanel(ctx, ax, ay, 'right', 1.002, 0, 2, 4.68, 4.75, shade(WHITE, -0.3));
  },
});

// ---- hanging club banner on a wall face (opts.side 'left'|'right', z0, z1, colors)
registerProp('laststand_banner', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'right';
    const z0 = p.o.z0 ?? 1.4, z1 = p.o.z1 ?? 4.2;
    const [ca, cb] = p.o.colors || [RED, WHITE];
    const P = P0(ax, ay);
    const sw = Math.sin(t * 1.3 + p.x) * 0.6;
    const zs = (z1 - z0) * Z_PX;
    for (let i = 0; i < 12; i++) {
      const u = 0.2 + i * 0.05;
      const top = side === 'right' ? P(1.03, u, z1) : P(u, 1.03, z1);
      for (let j = 0; j < zs; j++) {
        const k = j / zs;
        let c = (i < 2 || i > 9) ? cb : ca;
        if (k > 0.86) c = (i % 2) ? GOLD : ca;
        const ai = Math.abs(i - 5.5), aj = j - zs * 0.35;
        if ((ai < 0.8 && aj > -10 && aj < 12) || (Math.abs(aj + 6) < 1 && ai < 3) || (aj > 7 && aj < 10 && ai < 3.5 && ai > 1.5 - (aj - 7) * 0.6)) c = cb;
        ctx.fillStyle = shade(c, side === 'right' ? -0.25 : 0);
        ctx.fillRect(Math.round(top.x), Math.round(top.y + j + (k > 0.5 ? sw * k : 0)), 1, 1);
      }
    }
  },
});

// ================================================================== items
const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

registerItem('laststand_flare', {
  name: 'LIT FLARE', kind: 'weapon', score: 0,
  weapon: { dmg: 10, reach: 1.3, durability: 3, attack: 'swing', throwDmg: 12, breaks: 'flare' },
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 2, y - 12, 4, 12);
    px(ctx, '#c81830', x - 1, y - 11, 2, 10);
    px(ctx, '#e8e0d0', x - 1, y - 4, 2, 1);
    const f = Math.floor((t || 0) * 20) % 3;
    px(ctx, '#ff3a4a', x - 1, y - 15 - f, 3, 4 + f);
    px(ctx, '#ffffff', x, y - 13, 1, 2);
    if (f === 1) px(ctx, '#ffd0a0', x + 2, y - 16, 1, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 9 * s, ey = hy + dy * 9 * s;
    thick(ctx, hx - dx * 2, hy - dy * 2, ex, ey, 4, OL);
    thick(ctx, hx - dx * 2, hy - dy * 2, ex, ey, 2, flash ? '#fff' : '#c81830');
    const tt = performance.now() / 50;
    ctx.fillStyle = '#ff3a4a'; ctx.fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 5, 5);
    ctx.fillStyle = '#ffd8e0'; ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
    for (let i = 0; i < 3; i++) {
      const a = tt * 0.7 + i * 2.1;
      ctx.fillStyle = i % 2 ? '#ffe14a' : '#ffffff';
      ctx.fillRect(Math.round(ex + Math.cos(a) * 4), Math.round(ey - 2 - Math.abs(Math.sin(a * 1.3)) * 5), 1, 1);
    }
  },
});

registerItem('laststand_megaphone', {
  name: 'POLICE MEGAPHONE', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.3, durability: 5, attack: 'swing', throwDmg: 13, breaks: 'metal', knockdown: false },
  icon(ctx, x, y) {
    fillPoly(ctx, [{ x: x - 5, y: y - 9 }, { x: x + 6, y: y - 13 }, { x: x + 6, y: y - 1 }, { x: x - 5, y: y - 5 }], OL);
    fillPoly(ctx, [{ x: x - 4, y: y - 8 }, { x: x + 5, y: y - 12 }, { x: x + 5, y: y - 2 }, { x: x - 4, y: y - 6 }], '#e8e8ec');
    px(ctx, '#1f3fa0', x + 1, y - 10, 2, 7);
    px(ctx, OL, x - 3, y - 6, 2, 5); px(ctx, '#3a3a40', x - 2, y - 5, 1, 4);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang), nx = -dy, ny = dx;
    const ex = hx + dx * 10 * s, ey = hy + dy * 10 * s;
    thick(ctx, hx, hy, hx + dx * 3, hy + dy * 3, 3, OL);
    fillPoly(ctx, [{ x: hx + dx * 2 + nx * 2, y: hy + dy * 2 + ny * 2 }, { x: ex + nx * 5, y: ey + ny * 5 }, { x: ex - nx * 5, y: ey - ny * 5 }, { x: hx + dx * 2 - nx * 2, y: hy + dy * 2 - ny * 2 }], flash ? '#fff' : '#e8e8ec');
    line(ctx, ex + nx * 5, ey + ny * 5, ex - nx * 5, ey - ny * 5, '#1f3fa0');
  },
});
