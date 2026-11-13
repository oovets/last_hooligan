// THEME: OLD TRAFFORD (tour arena) — Manchester United, Stretford M16, a cold floodlit night in the 90s.
// The Bridgewater Canal towpath with Trafford Park's sheds across the water, the railway halt by the ground and its
// footbridge, Sir Matt Busby Way on match night (burger vans, programme huts, touts, police), the newly rebuilt
// cantilever Stretford End, the away corner and the forecourt behind the South Stand.
// Every id registered here starts with 'ot_'.

import { registerFloor, registerWall } from '../../../engine/tiles.js';
import { registerProp, PROPS } from '../../../game/props.js';
import { registerItem } from '../../../game/items.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow, makeCanvas } from '../../../engine/gfx.js';
import { shade } from '../../../engine/color.js';
import { hash2, makeRng } from '../../../engine/rng.js';
import { drawText } from '../../../engine/font.js';
import { Z_PX } from '../../../engine/constants.js';
import { toScreen } from '../../../engine/iso.js';
import { drawDoll } from '../../../game/doll.js';
import { sampleAnim, fillPose, animDuration, ANIMS, STAND } from '../../../game/poses.js';
import { casualLook } from '../../enemies.js';

export const OT = { RED: '#da291c', DRED: '#8a1410', WHITE: '#f4f1e8', BLACK: '#121214', GOLD: '#fbe122' };
const { RED, DRED, WHITE, BLACK, GOLD } = OT;
const OL = '#100c12';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const dkf = side => (side === 'right' ? -0.3 : 0);

// =====================================================================================================
// FLOORS
// =====================================================================================================

// Towpath: compacted cinder and gravel, puddles, the odd weed, worn wheel ruts along x.
registerFloor('ot_towpath', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const n = n2(X * 32, Y * 32, 501);
    const pud = hash2(Math.floor(X * 0.7), Math.floor(Y * 0.9), 502);
    if (pud > 0.86 && Math.hypot((X * 0.7) % 1 - 0.5, (Y * 0.9) % 1 - 0.5) < 0.3) return n < 0.3 ? '#3a4660' : n > 0.9 ? '#8a96b0' : '#26304a';
    const rut = Math.abs(((Y + 0.25) % 2.5) - 1.25) < 0.08;
    let c = n < 0.3 ? '#4a4440' : n < 0.65 ? '#544c46' : '#5e5650';
    if (rut) c = shade(c, -0.12);
    if (n > 0.97) c = '#8a8278';
    if (n < 0.025) c = '#2e4a26';            // weeds
    return c;
  },
});

// Canal coping: big sandstone blocks with a rope-worn edge (the mooring by the lock).
registerFloor('ot_coping', {
  pixel(u, v, tx, ty) {
    if (v < 0.12) return v < 0.05 ? '#2a2a2e' : '#9a8e78';
    if (((u + tx) * 2) % 1 < 0.04) return '#4a4438';
    const n = n2((tx + u) * 32, (ty + v) * 32, 503);
    return n < 0.2 ? '#6e6454' : n > 0.92 ? '#948a72' : '#7c7262';
  },
});

// Canal water: black-green, slow ripples catching the red and sodium lights, the odd floating can.
registerFloor('ot_canal', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const w = Math.sin(X * 5.3 + Y * 1.7) + Math.sin(X * 2.1 - Y * 3.9);
    const n = n2(X * 16, Y * 32, 504);
    if (w > 1.75) return n < 0.5 ? '#6a2a2a' : '#c8a060';      // reflected lamplight
    if (w > 1.45) return '#24384a';
    if (n > 0.995) return '#c8c8c0';                              // a floating can
    return n < 0.4 ? '#0c161c' : '#101c24';
  },
});

// Station platform: grey tarmac, cracked, chewing gum.
registerFloor('ot_platform', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const n = n2(X * 32, Y * 32, 505);
    if (n < 0.012) return '#a4a2a8';
    let c = n < 0.35 ? '#4e4c54' : '#56545c';
    if (Math.abs(Math.sin(X * 1.3 + Y * 0.4) * 0.5 + Math.sin(Y * 2.2) * 0.3) < 0.01) c = '#2e2c32';
    return c;
  },
});
// Platform edge (edge on the +y side): yellow safety line, white coping.
registerFloor('ot_platEdge', {
  pixel(u, v, tx, ty) {
    if (v > 0.84) return v > 0.94 ? '#24222a' : '#d8d6cc';
    if (v > 0.56 && v < 0.68) return n2((tx + u) * 32, 1, 506) < 0.12 ? '#8a7a30' : '#e8c830';
    const n = n2((tx + u) * 32, (ty + v) * 32, 505);
    return n < 0.35 ? '#4e4c54' : '#56545c';
  },
});

// Railway tracks (running along x): ballast, sleepers, two shiny rails.
registerFloor('ot_track', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const r = (Y % 2) / 2;                                   // a 2-tile wide track bed
    if (Math.abs(r - 0.28) < 0.03 || Math.abs(r - 0.72) < 0.03) return '#c8ccd4';
    if (Math.abs(r - 0.28) < 0.05 || Math.abs(r - 0.72) < 0.05) return '#4a4446';
    if ((X * 2.2) % 1 < 0.28 && r > 0.15 && r < 0.85) return '#3a2a20';   // sleepers
    const n = n2(X * 32, Y * 32, 507);
    return n < 0.3 ? '#3e3a36' : n > 0.85 ? '#6a6058' : '#4e4842';
  },
});

// Sir Matt Busby Way: dark wet tarmac (it's Manchester), a painted red line down the middle.
registerFloor('ot_road', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (Math.abs(Y - 34) < 0.06 && (X % 3) < 1.8) return '#a83a30';
    const n = n2(X * 32, Y * 32, 508);
    const wet = Math.sin(X * 0.9 + Y * 0.2) + Math.sin(Y * 1.4 - X * 0.3);
    if (wet > 1.5) {
      const st = hash2(Math.floor((X - Y) * 6), Math.floor((X + Y) * 1.3), 509);
      return st > 0.9 ? '#7a6050' : st > 0.75 ? '#2e3442' : '#1e222c';
    }
    if (n < 0.08) return '#24242a';
    if (n > 0.94) return '#4a4a52';
    return n < 0.5 ? '#2c2c34' : '#32323a';
  },
});

// Red brick paviours (herringbone-ish) on the pavements and the forecourt.
registerFloor('ot_paviour', {
  pixel(u, v, tx, ty) {
    const X = (tx + u) * 4, Y = (ty + v) * 8;
    const row = Math.floor(Y), off = row % 2 ? 0.5 : 0;
    if (Y % 1 < 0.12) return '#3a2a26';
    if ((X + off) % 1 < 0.07) return '#3a2a26';
    const b = hash2(Math.floor(X + off), row, 510);
    let c = b < 0.3 ? '#7a3a30' : b < 0.6 ? '#86423a' : b < 0.9 ? '#6e342c' : '#5a5a5e';
    if (n2((tx + u) * 32, (ty + v) * 32, 511) < 0.03) c = '#a8a4a0';   // gum
    return c;
  },
});

// Concourse: painted grey concrete with red walkway bands.
registerFloor('ot_concourse', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (Math.abs(Y - 43.5) < 0.12) return '#9a2a24';
    const n = n2(X * 32, Y * 32, 512);
    if (u < 0.03 || v < 0.03) return '#46444c';
    if (n > 0.975) return '#e0dcd0';
    return n < 0.3 ? '#5e5c64' : '#66646c';
  },
});

// Terrace: stepped concrete, red-painted step lips (half a tile per step).
registerFloor('ot_terrace', {
  pixel(u, v, tx, ty) {
    const step = (v * 2) % 1;
    const X = tx + u, Y = ty + v;
    if (step < 0.1) return '#2c2a30';
    if (step < 0.2) return Math.floor(X * 2) % 9 === 0 ? '#5a3030' : '#a8342c';
    const n = n2(X * 32, Y * 32, 513);
    if (n < 0.04) return '#222026';
    if (n > 0.985) return Math.floor(X * 7) % 2 ? RED : WHITE;
    return n < 0.25 ? '#54525a' : '#5c5a62';
  },
});

// Tunnel: black ribbed rubber with a red strip.
registerFloor('ot_tunnel', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (Math.abs(((Y % 1) + 1) % 1 - 0.5) < 0.08 && X > 31 && X < 37) return '#7a1612';
    return (Math.floor(X * 8) + Math.floor(Y * 8)) % 2 ? '#1c1c22' : '#24242c';
  },
});

// Service yard behind the South Stand: oil-stained concrete slabs with yellow bay lines.
registerFloor('ot_yard', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (u < 0.025 || v < 0.025) return '#2e2e34';
    if ((X % 6) < 0.1 && Y > 44) return '#c8a830';
    const oil = hash2(Math.floor(X * 0.5), Math.floor(Y * 0.5), 514);
    const n = n2(X * 32, Y * 32, 515);
    let c = n < 0.35 ? '#4a4a50' : '#525258';
    if (oil > 0.8 && n < 0.7) c = '#323036';
    if (n > 0.98) c = '#7a7a80';
    return c;
  },
});

// Grass verge.
registerFloor('ot_verge', {
  pixel(u, v, tx, ty) {
    const n = n2((tx + u) * 32, (ty + v) * 32, 516);
    return n < 0.3 ? '#2a3a22' : n > 0.85 ? '#40522e' : '#33452a';
  },
});

// =====================================================================================================
// WALLS
// =====================================================================================================
function bricks(base, mortar, u, py, side, variant, seed = 7) {
  const bx = u * 16, row = Math.floor(py / 4), off = row % 2 ? 4 : 0;
  if (py % 4 === 3 || Math.floor(bx + off) % 8 === 0) return shade(mortar, dkf(side));
  const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, seed);
  const c = s < 0.3 ? shade(base, -0.1) : s > 0.88 ? shade(base, 0.12) : base;
  return shade(c, dkf(side));
}

// Trafford Park industrial units across the canal: blue-grey cladding, roller doors, a strip light, rust.
registerWall('ot_unit', {
  top: (u, v) => ((u * 6) % 1 < 0.1 ? '#2a2c34' : '#3a3e48'),
  variants: 6,
  face(u, py, side, H, r, variant) {
    const dk = dkf(side), wu = u * 16;
    if (py < 3) return shade('#5a5e68', dk);
    if (py === 3) return shade('#22242a', dk);
    if (variant % 3 === 0 && wu > 2 && wu < 14 && py > H - 34) {            // roller shutter
      if (py === H - 34) return shade('#1a1a1e', dk);
      return shade((py % 3 === 0) ? '#5a5a62' : '#7a7a84', dk);
    }
    if (variant % 3 === 1 && py > 14 && py < 22 && wu > 4 && wu < 12) return shade((py === 18) ? '#1a1a20' : '#d8e8ff', dk);   // lit window strip
    let c = (Math.floor(wu) % 4 === 0) ? '#3a4250' : '#4a5464';
    if (hash2(Math.floor(wu), Math.floor(py / 6), variant + 517) < 0.08) c = '#6a4a34';  // rust streak
    if (py > H - 3) c = '#26282e';
    return shade(c, dk);
  },
});

// Towpath railings: black iron, see-through, with a red-painted cap rail.
registerWall('ot_towRail', {
  top: () => null,
  face(u, py, side, H) {
    const wu = u * 16, dk = dkf(side) * 0.6;
    if (py < 2) return shade('#7a1a14', dk);
    if (py >= H - 2) return shade('#1a1a1e', dk);
    if (py === Math.floor(H * 0.55)) return shade('#26262c', dk);
    if (Math.floor(wu) % 3 === 0) return shade('#2a2a30', dk);
    return null;
  },
});

// Canal lock gate: black and white painted balance beam on heavy timber.
registerWall('ot_lockGate', {
  top: (u, v) => ((u * 4) % 1 < 0.5 ? '#e8e4d8' : '#1a1a1a'),
  face(u, py, side, H) {
    const dk = dkf(side);
    if (py < 6) return shade(Math.floor(u * 4) % 2 ? '#e8e4d8' : '#1a1a1a', dk);
    const n = hash2(Math.floor(u * 16), Math.floor(py / 3), 518);
    return shade(n < 0.3 ? '#3a2e22' : '#4a3a2a', dk);
  },
});

// Bridge abutment: Victorian red brick with blue engineering-brick courses.
registerWall('ot_bridge', {
  top: '#3a2a28',
  variants: 4,
  face(u, py, side, H, r, variant) {
    if (py < 4) return shade('#5a5a62', dkf(side));
    if (Math.floor(py / 4) % 6 === 2) return bricks('#2e3446', '#1a1c24', u, py, side, variant, 519);
    return bricks('#8a3a2e', '#3a2420', u, py, side, variant, 520);
  },
});

// Loading bridge deck over the canal (jumpable at 1.2): stone slabs, iron parapet edge.
registerWall('ot_bridgeDeck', {
  top: (u, v) => (n2(u * 8, v * 8, 521) < 0.3 ? '#5e5a58' : '#686462'),
  face(u, py, side) {
    if (py < 3) return shade('#2a2a30', dkf(side));
    return bricks('#7a3a30', '#3a2420', u, py, side, 1, 522);
  },
});

// Railway embankment wall: sooty brick with arches.
registerWall('ot_embank', {
  top: '#2a2224',
  variants: 6,
  face(u, py, side, H, r, variant) {
    if (py < 3) return shade('#4a4a52', dkf(side));
    const wu = u * 16;
    if (variant % 3 === 0 && py > H * 0.35) {                               // blind arch
      const cx = 8, rx = 6, top = H * 0.35 + 6;
      const inside = Math.abs(wu - cx) < rx && (py > top || Math.hypot((wu - cx) / rx, (py - top) / 6) < 1);
      if (inside) return shade(py > H - 3 ? '#141214' : '#1e1a1c', dkf(side));
    }
    let c = bricks('#5e2a24', '#2a1a18', u, py, side, variant, 523);
    if (hash2(Math.floor(wu / 2), Math.floor(py / 5), variant + 524) < 0.12) c = shade(c, -0.25);   // soot
    return c;
  },
});

// Concrete steps (footbridge stairs): yellow nosing on top.
registerWall('ot_steps', {
  top: (u, v) => (v < 0.12 || u < 0.12 ? '#e8c830' : '#7a7a80'),
  face(u, py, side, H) {
    if (py < 2) return shade('#e8c830', dkf(side));
    return shade(py % 6 === 5 ? '#4a4a50' : '#6a6a70', dkf(side));
  },
});

// Footbridge deck: red-painted steel girders, chequer plate on top.
registerWall('ot_footbridge', {
  top: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 ? '#5a5a62' : '#666670'),
  face(u, py, side, H) {
    const wu = u * 16;
    if (py < 3) return shade(RED, dkf(side));
    if (py > H - 4) return shade(DRED, dkf(side));
    if (Math.abs((wu + py) % 8 - 4) < 0.8 || Math.abs((wu - py + 64) % 8 - 4) < 0.8) return shade('#b8241a', dkf(side));
    return null;
  },
});

// Track fence: steel palisade (see-through), pointed tops.
registerWall('ot_palisade', {
  top: () => null,
  face(u, py, side, H) {
    const wu = u * 16, k = Math.floor(wu) % 3;
    const dk = dkf(side) * 0.6;
    if (py === 5 || py === H - 6) return shade('#3a4048', dk);
    if (k === 0 || (k === 1 && py > 1)) return shade(py < 3 ? '#6a7480' : '#4a525c', dk);
    return null;
  },
});

// Terraced houses of Stretford (backs onto the street): red brick, white sash windows, a lit front room.
registerWall('ot_terraced', {
  top: (u, v) => ((v * 6) % 1 < 0.5 ? '#3a2e34' : '#463840'),
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, dk = dkf(side);
    if (py < 4) return shade('#2a2026', dk);
    const win = wu > 4 && wu < 12 && ((py > 12 && py < 26) || (py > H - 30 && py < H - 14));
    if (win) {
      if (Math.abs(wu - 8) < 0.6 || py === 19 || py === H - 22) return shade(WHITE, dk);
      const lit = (variant + (py > 26 ? 1 : 0)) % 3 === 0;
      return shade(lit ? (variant % 2 ? '#ffd890' : '#ff6a4a') : '#1a2030', dk);
    }
    if (win === false && wu > 3.4 && wu < 12.6 && ((py > 11.4 && py < 26.6) || (py > H - 31 && py < H - 13))) return shade(WHITE, dk);
    return bricks('#8a3c30', '#3a2420', u, py, side, variant, 525);
  },
});

// The Stretford End, newly rebuilt: red cladding, white band with a black stripe, glass at the turnstile level.
registerWall('ot_standFacade', {
  top: (u, v) => ((u * 3) % 1 < 0.1 ? '#2a2a30' : '#46464e'),
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, dk = dkf(side);
    if (py < 3) return shade('#c8c8cc', dk);
    if (py < 16) return shade((Math.floor(wu) % 4 === 0) ? '#a81e16' : RED, dk);        // red cladding
    if (py < 19) return shade(WHITE, dk);
    if (py < 21) return shade(BLACK, dk);
    if (py < 24) return shade(WHITE, dk);
    if (py < H - 12) return shade((Math.floor(wu) % 8 === 0) ? '#3a3a42' : (py % 9 === 0 ? '#5a5a62' : '#4a4a52'), dk);
    if (py < H - 3) return shade(variant % 2 ? '#1a2430' : '#28384a', dk);              // glazing
    return shade('#2a2a30', dk);
  },
});

// Inside the stand: the back wall rising with rows of red seats.
registerWall('ot_seatsWall', {
  top: '#2a2628',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const dk = dkf(side);
    if (py < 2) return shade('#6a6a70', dk);
    const row = Math.floor((py - 2) / 7), fy = (py - 2) % 7;
    const wu = u * 16, seat = Math.floor(wu / 4), fx = wu % 4;
    if (fy === 6) return shade('#262628', dk);
    if (fy >= 4) return shade('#4e4e54', dk);
    if (fx < 0.6) return shade('#2e2e32', dk);
    // white seats spelling stripes: a band of white across the middle rows
    const white = row === 2 && (seat + variant) % 3 !== 0;
    const c = white ? WHITE : (fy === 0 ? '#f0402c' : RED);
    return shade(c, dk);
  },
});

// Segregation fence inside the ground: blue-grey mesh, see-through.
registerWall('ot_segFence', {
  top: () => null,
  face(u, py, side, H) {
    const wu = u * 16, dk = dkf(side) * 0.6;
    if (py < 2) return shade('#c8c8c0', dk);
    if (Math.floor(wu) === 0 || Math.floor(wu) === 8 || py >= H - 2) return shade('#3a4048', dk);
    if ((Math.floor(wu) + py) % 4 === 0 || (Math.floor(wu) - py + 400) % 4 === 0) return shade('#6a7480', dk);
    return null;
  },
});

// Stand back / concourse walls: painted concrete, red-black-white bands.
registerWall('ot_standWall', {
  top: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 ? '#2a2830' : '#32303a'),
  variants: 4,
  face(u, py, side, H, r, variant) {
    const dk = dkf(side), wu = Math.floor(u * 16);
    if (py < 2) return shade('#8a8a92', dk);
    if (py < 5) return shade(RED, dk);
    if (py < 6) return shade(WHITE, dk);
    if (py < 8) return shade(BLACK, dk);
    let c = (wu % 4 === 0) ? '#2e2c36' : '#3c3a46';
    if (hash2(wu + variant * 5, py, 526) < 0.03) c = '#4a4856';
    if (py === H - 1) c = '#18161e';
    return shade(c, dk);
  },
});

// Tunnel walls: white glazed tiles with a red and black band.
registerWall('ot_tunnelWall', {
  top: '#8a8a90',
  face(u, py, side, H) {
    const dk = side === 'right' ? -0.25 : 0;
    if (py >= H - 3) return shade('#141418', dk);
    const band = H - 22;
    if (py >= band && py < band + 3) return shade(RED, dk);
    if (py >= band + 3 && py < band + 5) return shade(BLACK, dk);
    const tx = (u * 16) % 4, ty = py % 5;
    return shade((tx < 0.6 || ty === 0) ? '#a8aab0' : '#e2e2dc', dk);
  },
});

// =====================================================================================================
// CACHE HELPERS (static props render once, animated bits drawn on top) + wall decals (one slice per wall tile)
// =====================================================================================================
const SPRITES = new Map();
function cachedSprite(key, w, h, ox, oy, fn) {
  let c = SPRITES.get(key);
  if (!c) { c = makeCanvas(w, h); fn(c.getContext('2d'), ox, oy); SPRITES.set(key, c); }
  return c;
}
function cacheStatic(id, keyFn = () => '', overlay = null) {
  const def = PROPS[id], raw = def.draw;
  const H = Math.max(def.h, 2.5) + 1.5;
  def.draw = (ctx, ax, ay, p, t, world) => {
    const w = p.w, d = p.d, ox = d * 16 + 16, oy = Math.round(H * 20 + 16);
    const c = cachedSprite(id + '|' + w + 'x' + d + '|' + keyFn(p.o), (w + d) * 16 + 32, (w + d) * 8 + oy + 24, ox, oy, (g, x, y) => raw(g, x, y, p, 0, null));
    ctx.drawImage(c, ax - ox, ay - oy);
    if (overlay) overlay(ctx, ax, ay, p, t, world);
  };
}
export function segments(spec) {
  const out = [];
  for (let i = 0; i < (spec.len || 1); i++) out.push({ ...spec, seg: i, x: spec.side === 'right' ? spec.x : spec.x + i, y: spec.side === 'right' ? spec.y + i : spec.y });
  return out;
}
function decalSprite(p, draw) {
  const o = p.o, len = o.len || 1;
  const zTop = Math.max(3, (o.z ?? 1.2) + (o.height ?? 1.2)) + 1;
  const ox = len * 16 + 48, oy = Math.round(zTop * 20 + 8);
  const key = [p.type, o.side, len, o.z, o.height, o.text, o.a, o.b, o.color, o.bg, o.crest].join('|');
  return { c: cachedSprite(key, len * 32 + 96, oy + len * 8 + 48, ox, oy, (g, x, y) => draw(g, x, y, p)), ox, oy };
}
function segmented(draw) {
  return function (ctx, ax, ay, p) {
    const seg = p.o.seg;
    if (seg === undefined) { const S = decalSprite(p, draw); ctx.drawImage(S.c, ax - S.ox, ay - S.oy); return; }
    const side = p.o.side || 'left', len = p.o.len || 1;
    const o = side === 'left' ? proj(ax, ay, -seg, 0, 0) : proj(ax, ay, 0, -seg, 0);
    const lo = -0.6, hi = 7;
    const e0 = seg === 0 ? -0.3 : 0, e1 = seg === len - 1 ? 1.3 : 1;
    const pts = side === 'left'
      ? [proj(ax, ay, e0, 1, lo), proj(ax, ay, e1, 1, lo), proj(ax, ay, e1, 1, hi), proj(ax, ay, e0, 1, hi)]
      : [proj(ax, ay, 1, e0, lo), proj(ax, ay, 1, e1, lo), proj(ax, ay, 1, e1, hi), proj(ax, ay, 1, e0, hi)];
    ctx.save();
    ctx.beginPath(); ctx.moveTo(Math.round(pts[0].x), pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(Math.round(pts[i].x), pts[i].y);
    ctx.closePath(); ctx.clip();
    const S = decalSprite(p, draw);
    ctx.drawImage(S.c, Math.round(o.x) - S.ox, Math.round(o.y) - S.oy);
    ctx.restore();
  };
}
function onFace(ax, ay, side, u, z) { return side === 'left' ? proj(ax, ay, u, 1.01, z) : proj(ax, ay, 1.01, u, z); }
function facePanel(ctx, ax, ay, side, u0, len, z0, z1, color) {
  if (side === 'left') isoPanel(ctx, ax, ay, 'left', u0, 1.02, len, z0, z1, color);
  else isoPanel(ctx, ax, ay, 'right', 1.02, u0, len, z0, z1, color);
}
function skewText(ctx, side, m, text, opts) {
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
  drawText(ctx, text, 0, -3, { align: 'center', ...opts });
  ctx.restore();
}

// little devil crest (club-style: a red shield with a pitchfork-waving devil silhouette)
function devilCrest(ctx, x, y, s = 1) {
  const P = (dx, dy) => ({ x: x + dx * s, y: y + dy * s });
  fillPoly(ctx, [P(-6, -7), P(6, -7), P(6, 2), P(0, 8), P(-6, 2)], OL);
  fillPoly(ctx, [P(-5, -6), P(5, -6), P(5, 2), P(0, 7), P(-5, 2)], GOLD);
  fillPoly(ctx, [P(-4, -5), P(4, -5), P(4, 1.5), P(0, 6), P(-4, 1.5)], RED);
  ctx.fillStyle = BLACK;
  ctx.fillRect(Math.round(x - 1 * s), Math.round(y - 3 * s), Math.max(1, Math.round(2 * s)), Math.max(1, Math.round(5 * s)));   // body
  ctx.fillRect(Math.round(x - 2 * s), Math.round(y - 4 * s), Math.max(1, Math.round(1 * s)), Math.max(1, Math.round(1 * s)));   // horns
  ctx.fillRect(Math.round(x + 1 * s), Math.round(y - 4 * s), Math.max(1, Math.round(1 * s)), Math.max(1, Math.round(1 * s)));
  ctx.fillRect(Math.round(x + 2 * s), Math.round(y - 5 * s), 1, Math.max(1, Math.round(7 * s)));                                   // fork
  ctx.fillRect(Math.round(x + 1 * s), Math.round(y - 5 * s), Math.max(1, Math.round(3 * s)), 1);
}

// Wall sign: framed panel with skewed text. opts: text, color, bg, side, z, height, len
registerProp('ot_sign', {
  h: 0, solid: false, depthBias: 0.03,
  draw: segmented((ctx, ax, ay, p) => {
    const side = p.o.side || 'left', len = p.o.len ?? 1, z0 = p.o.z ?? 1.2, z1 = z0 + (p.o.height ?? 0.7);
    const bg = p.o.bg || '#1a1420';
    facePanel(ctx, ax, ay, side, 0.04, len - 0.08, z0, z1, OL);
    facePanel(ctx, ax, ay, side, 0.08, len - 0.16, z0 + 0.06, z1 - 0.06, bg);
    facePanel(ctx, ax, ay, side, 0.08, len - 0.16, z1 - 0.12, z1 - 0.06, shade(bg, 0.25));
    if (p.o.crest) devilCrest(ctx, onFace(ax, ay, side, 0.45, (z0 + z1) / 2).x, onFace(ax, ay, side, 0.45, (z0 + z1) / 2).y, 0.8);
    if (p.o.text) skewText(ctx, side, onFace(ax, ay, side, len / 2 + (p.o.crest ? 0.2 : 0), (z0 + z1) / 2), p.o.text, { color: p.o.color || '#ffffff' });
  }),
});

// Fabric banner on a wall face: stripes, fringe, text, optional devil crest. opts: text, a, b, color, crest
registerProp('ot_banner', {
  h: 0, solid: false, depthBias: 0.03,
  draw: segmented((ctx, ax, ay, p) => {
    const side = p.o.side || 'left', len = p.o.len ?? 3, z0 = p.o.z ?? 0.6, z1 = z0 + (p.o.height ?? 0.9);
    const a = p.o.a || RED, b = p.o.b || BLACK;
    const N = Math.round(len * 16);
    for (let i = 0; i < N; i++) {
      const u = i / 16, sag = Math.sin(Math.PI * (u / len)) * 0.08;
      const top = onFace(ax, ay, side, u, z1 - sag), bot = onFace(ax, ay, side, u, z0 - sag);
      const h = Math.round(bot.y - top.y);
      ctx.fillStyle = OL; ctx.fillRect(Math.round(top.x), Math.round(top.y) - 1, 1, h + 2);
      if (i === 0 || i === N - 1) continue;
      for (let y = 0; y < h; y++) { const k = y / h; ctx.fillStyle = (k < 0.16 || k > 0.84) ? b : a; ctx.fillRect(Math.round(top.x), Math.round(top.y) + y, 1, 1); }
      if (i % 2 === 0) { ctx.fillStyle = WHITE; ctx.fillRect(Math.round(bot.x), Math.round(bot.y) + 1, 1, 2); }
    }
    if (p.o.crest) for (const u of [0.45, len - 0.45]) { const m = onFace(ax, ay, side, u, (z0 + z1) / 2); devilCrest(ctx, m.x, m.y, 0.9); }
    if (p.o.text) skewText(ctx, side, onFace(ax, ay, side, len / 2, (z0 + z1) / 2 - 0.05), p.o.text, { color: p.o.color || WHITE, outline: shade(a, -0.6) });
  }),
});

// =====================================================================================================
// PROPS
// =====================================================================================================

// Narrowboat moored in the lock (5 x 2): red & green with a cream cabin top, a chimney, roses on the side panel.
// Low enough to jump onto (h 1.0); the cabin roof is where the stash is.
registerProp('ot_narrowboat', {
  w: 5, d: 2, h: 1.0,
  draw(ctx, ax, ay, p) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    // hull (dark, sits low in the water)
    fillPoly(ctx, [P(0.2, 0.5, 0), P(4.6, 0.5, 0), P(4.98, 1.0, 0), P(4.6, 1.5, 0), P(0.2, 1.5, 0)], '#0a0e12');
    isoBox(ctx, ax, ay, 0.15, 0.45, 0, 4.5, 1.1, 0.45, { top: '#1a1a1e', left: '#1e2a22', right: '#141c18', outline: OL });
    // bow point
    fillPoly(ctx, [P(4.65, 0.45, 0.45), P(4.98, 1.0, 0.4), P(4.65, 1.55, 0.45), P(4.65, 1.55, 0), P(4.98, 1.0, 0), P(4.65, 0.45, 0)], '#18241c');
    // cabin
    isoBox(ctx, ax, ay, 0.4, 0.55, 0.45, 3.6, 0.9, 0.55, { top: '#e8dcc0', left: '#2a5a32', right: '#1e4226', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.4, 1.45, 3.6, 0.82, 0.92, RED);              // red coachline
    for (let i = 0; i < 4; i++) {                                                 // portholes
      const s = P(0.8 + i * 0.85, 1.45, 0.7);
      ellipse(ctx, s.x, s.y, 2, 2, OL); ellipse(ctx, s.x, s.y, 1, 1, '#ffd890');
    }
    // painted panel with roses
    isoPanel(ctx, ax, ay, 'left', 2.2, 1.45, 0.8, 0.5, 0.78, '#1a1a1e');
    for (const [x, z, c] of [[2.4, 0.64, RED], [2.6, 0.6, GOLD], [2.8, 0.66, RED]]) { const s = P(x, 1.45, z); ellipse(ctx, s.x, s.y, 2, 2, c); }
    // roof clutter: a coal sack, a mop, the chimney
    isoBox(ctx, ax, ay, 0.7, 0.75, 1.0, 0.4, 0.35, 0.18, { color: '#2a2622' });
    const ch = P(3.5, 0.95, 1.0), cht = P(3.5, 0.95, 1.5);
    thick(ctx, ch.x, ch.y, cht.x, cht.y, 4, OL); thick(ctx, ch.x, ch.y, cht.x, cht.y, 2, '#2a2a2e');
    ctx.fillStyle = '#c8a040'; ctx.fillRect(Math.round(cht.x) - 2, Math.round(cht.y), 4, 1);
    // name
    const m = P(1.4, 1.46, 0.27);
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, 0.5, 0, 1, 0, 0);
    drawText(ctx, 'STRETFORD ROSE', 0, -3, { color: GOLD, align: 'center' });
    ctx.restore();
  },
});
function boatSmoke(ctx, ax, ay, p, t) {
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.5 + i / 3) % 1, s = proj(ax, ay, 3.5 - k * 0.6, 0.95, 1.55 + k * 1.4);
    ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = '#a8a8b0';
    ctx.fillRect(Math.round(s.x + Math.sin(t * 2 + i) * 2), Math.round(s.y), 2 + Math.round(k * 2), 2);
  }
  ctx.globalAlpha = 1;
}

// Lifebuoy on a post (towpath decor; the ring comes off as a weapon).
registerProp('ot_lifebuoy', {
  h: 1.2, pickup: 'ot_buoy',
  draw(ctx, ax, ay) {
    const b = proj(ax, ay, 0.5, 0.5, 0), t = proj(ax, ay, 0.5, 0.5, 1.4);
    shadow(ctx, b.x, b.y, 5, 2, 0.3);
    thick(ctx, b.x, b.y, t.x, t.y, 4, OL); thick(ctx, b.x, b.y, t.x, t.y, 2, '#3a3a40');
    const c = proj(ax, ay, 0.5, 0.5, 1.0);
    ellipse(ctx, c.x, c.y, 7, 7, OL);
    for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; ellipse(ctx, c.x + Math.cos(ang) * 4.5, c.y + Math.sin(ang) * 4.5, 2, 2, a % 2 ? WHITE : '#e8501c'); }
    ellipse(ctx, c.x, c.y, 2, 2, '#2a2a30');
  },
});

// Mooring bollard / canal milepost.
registerProp('ot_milepost', {
  h: 0.7,
  draw(ctx, ax, ay, p) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x, b.y, 5, 2, 0.3);
    isoBox(ctx, ax, ay, 0.32, 0.32, 0, 0.36, 0.36, 0.6, { top: WHITE, left: '#d8d4c8', right: '#a8a498', outline: OL });
    const m = proj(ax, ay, 0.5, 0.68, 0.38);
    drawText(ctx, p.o.text || 'M1', m.x, m.y - 3, { color: BLACK, align: 'center' });
  },
});

// Police dog with handler at the cordon. The dog lunges on a cycle (pair with a level hazard zone in front of it).
export function dogLunging(time, phase = 0) { return ((time + phase) % 4.2) > 3.0; }
const DOG_HANDLER = { skin: '#e8b48c', hair: { style: 'crop', color: '#2a1a10' }, hat: { style: 'helmet', color: '#1a1e2c' }, jacket: { style: 'hivis', color: '#d8f020' }, shirt: '#e8e8f0', pants: { style: 'suit', color: '#1a1e2c' }, shoes: { color: '#121214', sole: '#222', style: 'boot' }, build: 1.15, height: 1.05 };
const handlerCache = new Map();
function handlerSprite(flip, lunge) {
  const k = (flip ? 1 : 0) + (lunge ? 2 : 0);
  if (handlerCache.has(k)) return handlerCache.get(k);
  const c = makeCanvas(44, 70);
  const pose = lunge ? { ...STAND, lean: -0.25, uaN: 1.1, faN: 0.3, uaF: 1.0, faF: 0.4, dx: -2 } : { ...STAND, uaN: 0.7, faN: 0.6 };
  drawDoll(c.getContext('2d'), 22, 66, DOG_HANDLER, fillPose(pose), { flip, face: lunge ? 'shout' : 'normal' });
  handlerCache.set(k, c);
  return c;
}
registerProp('ot_policeDog', {
  h: 1.7,
  update(p, world, dt) {
    const on = dogLunging(world.time, p.o.phase || 0);
    if (on && !p.barked) { p.barked = true; if (world.player && Math.hypot(world.player.x - p.cx, world.player.y - p.cy) < 8) { world.fx.popup(p.cx - (p.o.dx || -1), p.cy, 1.0, 'WOOF!', '#ffe14a'); world.sfx('punch', p); } }
    if (!on) p.barked = false;
  },
  draw(ctx, ax, ay, p, t, world) {
    const on = world ? dogLunging(world.time, p.o.phase || 0) : false;
    const dir = p.o.dx ?? -1;                                  // the dog faces -x (towards the trouble) by default
    const flip = dir < 0;
    const s = proj(ax, ay, 0.6, 0.5, 0);
    shadow(ctx, s.x, s.y, 8, 3, 0.35);
    ctx.drawImage(handlerSprite(flip, on), Math.round(s.x - 22), Math.round(s.y - 66));
    // the dog (an alsatian): body box + head, straining on the lead
    const reach = on ? 1.0 : 0.45;
    const dx0 = 0.5 + dir * reach;
    const d = proj(ax, ay, dx0, 0.6, 0);
    shadow(ctx, d.x, d.y, 7, 3, 0.35);
    const bob = on ? Math.round(Math.sin(t * 30) * 1.5) : 0;
    const sx = flip ? -1 : 1;
    ctx.fillStyle = OL; ctx.fillRect(Math.round(d.x - 8), Math.round(d.y - 10 + bob), 16, 7);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(Math.round(d.x - 7), Math.round(d.y - 9 + bob), 14, 5);
    ctx.fillStyle = '#1a120a'; ctx.fillRect(Math.round(d.x - 5), Math.round(d.y - 9 + bob), 9, 2);   // saddle
    for (const lx of [-6, -3, 3, 6]) { ctx.fillStyle = OL; ctx.fillRect(Math.round(d.x + lx), Math.round(d.y - 4 + bob), 2, 4); }
    const hx = Math.round(d.x + sx * 9), hy = Math.round(d.y - 13 + bob);
    ctx.fillStyle = OL; ctx.fillRect(hx - 4, hy - 1, 8, 7);
    ctx.fillStyle = '#6a4a22'; ctx.fillRect(hx - 3, hy, 6, 5);
    ctx.fillStyle = '#1a120a'; ctx.fillRect(hx + sx * 3 - (sx < 0 ? 1 : 0), hy + 2, 2, 2);          // snout
    ctx.fillStyle = OL; ctx.fillRect(hx - 2, hy - 3, 1, 2); ctx.fillRect(hx + 1, hy - 3, 1, 2);     // ears
    if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + sx * 2, hy + 5, 2, 1); }
    // lead
    const hand = proj(ax, ay, 0.6 + dir * 0.15, 0.5, 1.0);
    line(ctx, hand.x, hand.y, d.x - sx * 6, d.y - 8 + bob, '#c8b060');
  },
});

// Police officer standing in the cordon line (solid; a wall of hi-vis).
const COP_LOOKS = [];
const copCache = new Map();
function copSprite(i, flip) {
  const k = i + '|' + flip;
  if (copCache.has(k)) return copCache.get(k);
  if (!COP_LOOKS[i]) { const L = { ...DOG_HANDLER }; L.skin = ['#e8b48c', '#d49a6a', '#f0c098', '#8a5636'][i % 4]; L.facial = ['none', 'tache', 'stubble', 'none'][i % 4]; COP_LOOKS[i] = L; }
  const c = makeCanvas(44, 70);
  drawDoll(c.getContext('2d'), 22, 66, COP_LOOKS[i], fillPose({ ...STAND, uaN: 0.4, faN: 1.4, uaF: 0.3, faF: 1.5 }), { flip });
  copCache.set(k, c);
  return c;
}
registerProp('ot_copper', {
  h: 1.7,
  draw(ctx, ax, ay, p) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, s.x, s.y, 7, 3, 0.3);
    ctx.drawImage(copSprite(Math.floor(hash2(p.x, p.y, 530) * 4), !!p.o.flip), Math.round(s.x - 22), Math.round(s.y - 66));
  },
});

// Parked police van (3 x 1): white Transit with the blue-and-yellow band, blue lamp flashing.
registerProp('ot_policeVan', {
  w: 3, d: 1, h: 1.6,
  draw(ctx, ax, ay, p) {
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.12); ellipse(ctx, s.x, s.y, 4, 3, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 1, '#5a5a60'); };
    wh(0.5, 0.95); wh(2.4, 0.95);
    isoBox(ctx, ax, ay, 0.05, 0.08, 0.15, 2.9, 0.84, 1.5, { top: '#e8e8ec', left: '#d8d8dc', right: '#a8a8b0', outline: OL });
    for (let i = 0; i < 12; i++) isoPanel(ctx, ax, ay, 'left', 0.05 + i * 0.24, 0.92, 0.24, 0.55, 0.78, i % 2 ? '#1a3aa8' : '#f0d020');
    isoPanel(ctx, ax, ay, 'left', 2.2, 0.92, 0.6, 0.9, 1.45, '#2a3a50');
    isoPanel(ctx, ax, ay, 'right', 2.95, 0.15, 0.7, 0.9, 1.45, '#3a4a60');
    isoPanel(ctx, ax, ay, 'left', 0.3, 0.92, 1.6, 1.05, 1.4, '#1a1a22');                  // caged windows
    for (let i = 0; i < 8; i++) { const a = proj(ax, ay, 0.3 + i * 0.2, 0.93, 1.05), b = proj(ax, ay, 0.3 + i * 0.2, 0.93, 1.4); line(ctx, a.x, a.y, b.x, b.y, '#6a6a72'); }
    const m = proj(ax, ay, 1.2, 0.93, 0.66);
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, 0.5, 0, 1, 0, 0);
    drawText(ctx, 'POLICE', 0, -3, { color: '#ffffff', align: 'center', outline: '#1a3aa8' });
    ctx.restore();
  },
});
function vanLamp(ctx, ax, ay, p, t) {
  const m = proj(ax, ay, 2.2, 0.5, 1.7);
  const on = Math.floor(t * 4) % 2;
  ctx.fillStyle = OL; ctx.fillRect(m.x - 4, m.y - 3, 8, 4);
  ctx.fillStyle = on ? '#6ab0ff' : '#1a3a8a'; ctx.fillRect(m.x - 3, m.y - 2, 6, 2);
  if (on) { ctx.globalAlpha = 0.25; ellipse(ctx, m.x, m.y, 14, 7, '#4a8aff'); ctx.globalAlpha = 1; }
}

// Burger van (3 x 1): "BURGERS HOT DOGS ONIONS", hatch on the +y side, warm light, steam.
registerProp('ot_burgerVan', {
  w: 3, d: 1, h: 1.6,
  light: { z: 1.4, r: 3.4, color: '#ffc070', intensity: 0.85 },
  draw(ctx, ax, ay, p) {
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.12); ellipse(ctx, s.x, s.y, 4, 3, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 1, '#5a5a60'); };
    wh(0.5, 0.95); wh(2.4, 0.95);
    const body = p.o.color || '#e8e4d8';
    isoBox(ctx, ax, ay, 0.05, 0.08, 0.15, 2.9, 0.84, 1.5, { top: shade(body, 0.05), left: body, right: shade(body, -0.25), outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.05, 0.92, 2.9, 0.3, 0.42, RED);
    isoPanel(ctx, ax, ay, 'left', 0.05, 0.92, 2.9, 0.42, 0.48, BLACK);
    isoPanel(ctx, ax, ay, 'left', 0.6, 0.92, 1.7, 0.72, 1.4, OL);
    isoPanel(ctx, ax, ay, 'left', 0.65, 0.92, 1.6, 0.76, 1.36, '#ffd88a');
    isoPanel(ctx, ax, ay, 'left', 0.65, 0.92, 1.6, 0.76, 0.92, '#a8742e');
    for (let i = 0; i < 4; i++) { const s = proj(ax, ay, 0.85 + i * 0.35, 0.95, 0.95); ctx.fillStyle = OL; ctx.fillRect(s.x - 2, s.y - 3, 5, 3); ctx.fillStyle = '#c8862e'; ctx.fillRect(s.x - 1, s.y - 2, 3, 1); }
    fillPoly(ctx, [proj(ax, ay, 0.55, 0.92, 1.55), proj(ax, ay, 2.35, 0.92, 1.55), proj(ax, ay, 2.35, 1.28, 1.32), proj(ax, ay, 0.55, 1.28, 1.32)], OL);
    for (let i = 0; i < 6; i++) fillPoly(ctx, [proj(ax, ay, 0.57 + i * 0.29, 0.93, 1.53), proj(ax, ay, 0.57 + (i + 1) * 0.29, 0.93, 1.53), proj(ax, ay, 0.57 + (i + 1) * 0.29, 1.25, 1.34), proj(ax, ay, 0.57 + i * 0.29, 1.25, 1.34)], i % 2 ? WHITE : RED);
    isoPanel(ctx, ax, ay, 'right', 2.95, 0.2, 0.6, 0.9, 1.4, '#7a9ab0');
  },
});
function burgerOverlay(ctx, ax, ay, p, t) {
  const m = proj(ax, ay, 1.5, 0.5, 1.7);
  const txt = p.o.text || 'BURGERS';
  const w = Math.max(44, txt.length * 6 + 6);
  ctx.fillStyle = OL; ctx.fillRect(m.x - w / 2, m.y - 11, w, 10);
  ctx.fillStyle = GOLD; ctx.fillRect(m.x - w / 2 + 1, m.y - 10, w - 2, 8);
  drawText(ctx, txt, m.x, m.y - 9, { color: DRED, align: 'center' });
  for (let i = 0; i < 3; i++) { const k = (t * 0.7 + i / 3) % 1; const s = proj(ax, ay, 1.3 + i * 0.2, 1.2, 1.7 + k * 0.8); ctx.globalAlpha = 0.4 * (1 - k); ctx.fillStyle = '#e0e0e0'; ctx.fillRect(Math.round(s.x + Math.sin(t * 3 + i) * 2), Math.round(s.y), 2, 2); }
  ctx.globalAlpha = 1;
}

// Programme hut (1 x 1): the little red hut with UNITED REVIEW posters. Breakable (coins!).
registerProp('ot_progHut', {
  h: 1.6,
  breakable: { hp: 26, debris: [RED, WHITE, '#c8c0a8'], sfx: 'wood', drops: [['coin', 0.9], ['cash5', 0.6], ['ot_programme', 0.8]], score: 90 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.8, 0.8, 1.6, { top: BLACK, left: RED, right: DRED, outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.91, 0.6, 0.7, 1.2, '#ffd88a');
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.91, 0.6, 0.7, 0.78, '#e8e4d8');                  // counter with programmes
    for (let i = 0; i < 3; i++) isoPanel(ctx, ax, ay, 'left', 0.25 + i * 0.18, 0.92, 0.14, 0.74, 0.77, i % 2 ? RED : WHITE);
    isoPanel(ctx, ax, ay, 'right', 0.91, 0.2, 0.6, 0.6, 1.3, WHITE);                     // poster
    isoPanel(ctx, ax, ay, 'right', 0.91, 0.25, 0.5, 1.05, 1.25, RED);
    const m = proj(ax, ay, 0.5, 0.9, 1.45);
    drawText(ctx, 'PROGRAMMES', m.x, m.y - 4, { color: WHITE, align: 'center', outline: OL });
  },
});

// Scarf seller's stall (2 x 1): red/white/black bar scarves and a few dodgy half-and-halfs.
registerProp('ot_scarfStall', {
  w: 2, d: 1, h: 1.2,
  breakable: { hp: 30, debris: [RED, WHITE, BLACK], sfx: 'wood', drops: [['coin', 0.8], ['cash5', 0.5]], score: 80 },
  draw(ctx, ax, ay, p) {
    for (const [x, y] of [[0.1, 0.15], [1.9, 0.15], [0.1, 0.85], [1.9, 0.85]]) { const s = proj(ax, ay, x, y, 0), e = proj(ax, ay, x, y, 2.1); thick(ctx, s.x, s.y, e.x, e.y, 2, '#3a3a40'); }
    isoBox(ctx, ax, ay, 0.05, 0.3, 0, 1.9, 0.6, 0.9, { top: '#7a5a3c', left: '#5a4028', right: '#3e2c1a', outline: OL });
    const cols = [[RED, WHITE], [BLACK, RED], [RED, BLACK], [WHITE, RED], [RED, GOLD], [BLACK, WHITE], [RED, WHITE]];
    for (let i = 0; i < 7; i++) {
      const s0 = proj(ax, ay, 0.15 + i * 0.25, 0.91, 0.85), [a, b] = cols[i];
      for (let j = 0; j < 12; j++) { ctx.fillStyle = Math.floor(j / 2) % 2 ? b : a; ctx.fillRect(Math.round(s0.x), Math.round(s0.y + j), 3, 1); }
    }
    const c = [proj(ax, ay, 0, 0, 2.1), proj(ax, ay, 2, 0, 2.1), proj(ax, ay, 2, 1.15, 1.85), proj(ax, ay, 0, 1.15, 1.85)];
    fillPoly(ctx, c, OL);
    for (let i = 0; i < 8; i++) fillPoly(ctx, [proj(ax, ay, i * 0.25, 0.04, 2.1), proj(ax, ay, (i + 1) * 0.25, 0.04, 2.1), proj(ax, ay, (i + 1) * 0.25, 1.1, 1.86), proj(ax, ay, i * 0.25, 1.1, 1.86)], i % 2 ? BLACK : RED);
    const m = proj(ax, ay, 1, 1.15, 2.2);
    drawText(ctx, p.o.text || 'SCARVES £3', m.x, m.y - 10, { color: GOLD, align: 'center', outline: OL });
  },
});

// Turnstile set into the facade (passable): lintel with the turnstile number, booth posts, spinning arms.
registerProp('ot_turnstile', {
  h: 0, solid: false,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0, 0.1, 0, 0.12, 0.8, 2.0, { color: '#4a4a52', outline: OL });
    isoBox(ctx, ax, ay, 0.88, 0.1, 0, 0.12, 0.8, 2.0, { color: '#4a4a52', outline: OL });
    isoBox(ctx, ax, ay, 0, 0, 2.0, 1, 1, 0.35, { top: BLACK, left: RED, right: DRED, outline: OL });
  },
});
function turnstileOverlay(ctx, ax, ay, p, t, world) {
  const m = proj(ax, ay, 0.5, 1.0, 2.17);
  drawText(ctx, String(p.o.n || 'IN'), m.x, m.y - 3, { color: WHITE, align: 'center' });
  let spin = 0;
  if (world) for (const f of world.fighters) if (Math.abs(f.x - p.cx) < 0.8 && Math.abs(f.y - p.cy) < 0.8) spin = 1;
  p.ang = (p.ang || 0) + spin * 0.12;
  const hub = proj(ax, ay, 0.3, 0.5, 0.9);
  ctx.fillStyle = OL; ctx.fillRect(hub.x - 3, hub.y - 3, 6, 10);
  ctx.fillStyle = '#9aa0a8'; ctx.fillRect(hub.x - 2, hub.y - 2, 4, 8);
  for (let i = 0; i < 3; i++) {
    const a = p.ang + i * 2.094, e = proj(ax, ay, 0.3 + Math.cos(a) * 0.45, 0.5 + Math.sin(a) * 0.45, 0.9);
    thick(ctx, hub.x, hub.y, e.x, e.y, 3, OL); thick(ctx, hub.x, hub.y, e.x, e.y, 1, '#d8dce0');
  }
}

// Concourse kiosk (2 x 1) against a wall: lit hatch, menu board. Jumpable (h 1.1).
registerProp('ot_kiosk', {
  w: 2, d: 1, h: 1.1,
  light: { z: 1.6, r: 3.0, color: '#ffd08a', intensity: 0.75 },
  draw(ctx, ax, ay, p) {
    isoPanel(ctx, ax, ay, 'left', 0.0, 0.05, 2, 1.1, 2.15, OL);
    isoPanel(ctx, ax, ay, 'left', 0.05, 0.05, 1.9, 1.15, 2.1, '#1a1214');
    isoBox(ctx, ax, ay, 0.02, 0.35, 0, 1.96, 0.6, 1.05, { top: '#c8c4bc', left: '#e8e4d8', right: '#a8a49c', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.02, 0.96, 1.96, 0.2, 0.42, RED);
    isoPanel(ctx, ax, ay, 'left', 0.02, 0.96, 1.96, 0.42, 0.5, BLACK);
    for (let i = 0; i < 3; i++) { const s = proj(ax, ay, 0.35 + i * 0.25, 0.65, 1.05); ctx.fillStyle = OL; ctx.fillRect(s.x - 3, s.y - 3, 7, 4); ctx.fillStyle = '#c8862e'; ctx.fillRect(s.x - 2, s.y - 2, 5, 2); }
    const urn = proj(ax, ay, 1.55, 0.6, 1.05);
    ctx.fillStyle = OL; ctx.fillRect(urn.x - 4, urn.y - 12, 9, 13); ctx.fillStyle = '#b8bcc4'; ctx.fillRect(urn.x - 3, urn.y - 11, 7, 11);
  },
});
function kioskOverlay(ctx, ax, ay, p, t) {
  const mb = proj(ax, ay, 1, 0.05, 1.95);
  drawText(ctx, p.o.text || 'PIES', mb.x, mb.y - 1, { color: GOLD, align: 'center' });
  drawText(ctx, p.o.text2 || 'TEA 50P', mb.x, mb.y + 7, { color: WHITE, align: 'center' });
  const urn = proj(ax, ay, 1.55, 0.6, 1.05);
  for (let i = 0; i < 2; i++) { const k = (t * 0.8 + i * 0.5) % 1; ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(urn.x + Math.sin(t * 4 + i) * 2), Math.round(urn.y - 14 - k * 14), 2, 2); }
  ctx.globalAlpha = 1;
}

// Stand column (red & black bands).
registerProp('ot_pillar', {
  h: 3,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.22, 0.22, 0, 0.56, 0.56, 3.6, { top: '#6a6a72', left: '#5a5a62', right: '#3e3e46', outline: OL });
    isoBox(ctx, ax, ay, 0.2, 0.2, 1.0, 0.6, 0.6, 0.25, { top: RED, left: RED, right: DRED });
    isoBox(ctx, ax, ay, 0.2, 0.2, 1.25, 0.6, 0.6, 0.1, { top: BLACK, left: BLACK, right: '#000' });
    if (p.o.text) { const m = proj(ax, ay, 0.5, 0.78, 2.2); drawText(ctx, p.o.text, m.x, m.y - 3, { color: GOLD, align: 'center', outline: OL }); }
  },
});

// Crush barrier (red-painted rail). Jumpable (0.9). dir 'x' (default) / 'y'.
registerProp('ot_crushBarrier', {
  h: 0.9,
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const a = alongX ? proj(ax, ay, 0.02, 0.5, 0) : proj(ax, ay, 0.5, 0.02, 0);
    const b = alongX ? proj(ax, ay, 0.98, 0.5, 0) : proj(ax, ay, 0.5, 0.98, 0);
    const zt = 0.9 * Z_PX;
    for (const q of [a, b]) { thick(ctx, q.x, q.y, q.x, q.y - zt, 3, OL); thick(ctx, q.x, q.y, q.x, q.y - zt, 1, '#8a8e96'); }
    thick(ctx, a.x, a.y - zt, b.x, b.y - zt, 4, OL);
    thick(ctx, a.x, a.y - zt, b.x, b.y - zt, 2, '#c8241a');
    line(ctx, a.x, a.y - zt - 1, b.x, b.y - zt - 1, '#f06a5a');
    thick(ctx, a.x, a.y - zt * 0.45, b.x, b.y - zt * 0.45, 1, '#6a6e76');
  },
});

// Row of red tip-up seats (breakable -> rip one off as a weapon).
registerProp('ot_seats', {
  h: 0.5,
  breakable: { hp: 8, debris: [RED, '#1a1a1a'], sfx: 'clatter', drops: [['ot_seat', 1]], score: 20 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || RED;
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, 0.9, 0.8, 0.15, { color: '#3a3a40' });
    for (let i = 0; i < 2; i++) {
      isoBox(ctx, ax, ay, 0.1 + i * 0.45, 0.25, 0.25, 0.38, 0.45, 0.08, { color: c, outline: OL });
      isoBox(ctx, ax, ay, 0.1 + i * 0.45, 0.2, 0.33, 0.38, 0.07, 0.35, { color: shade(c, -0.1), outline: OL });
    }
  },
});

// Floodlight pylon: lattice mast and lamp bank. o.boss = part of the boss forecourt rig (goes dark in LIGHTS OUT).
registerProp('ot_floodlight', {
  h: 3,
  light: { z: 6, r: 9, color: '#e8eeff', intensity: 0.7 },
  draw(ctx, ax, ay, p, t, world) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 9);
    isoBox(ctx, ax, ay, 0.15, 0.15, 0, 0.7, 0.7, 0.4, { color: '#4a4a52', outline: OL });
    for (const dx of [-4, 4]) { thick(ctx, b.x + dx, b.y - 6, top.x + dx * 0.4, top.y + 6, 2, OL); line(ctx, b.x + dx, b.y - 6, top.x + dx * 0.4, top.y + 6, '#7a7e86'); }
    for (let i = 0; i < 16; i++) {
      const k0 = i / 16, k1 = (i + 1) / 16;
      const y0 = b.y - 6 + (top.y + 12 - b.y) * k0, y1 = b.y - 6 + (top.y + 12 - b.y) * k1;
      line(ctx, b.x - (4 - 2.4 * k0), y0, b.x + (4 - 2.4 * k1), y1, '#5a5e66');
    }
    const dark = world && world.__otDark;
    ctx.fillStyle = OL; ctx.fillRect(top.x - 14, top.y - 10, 28, 16);
    ctx.fillStyle = '#2a2a32'; ctx.fillRect(top.x - 13, top.y - 9, 26, 14);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = dark ? '#3a3a44' : ((r + c + Math.floor(t * 0.5)) % 7 === 0 ? '#d8e0ff' : '#ffffff');
      ctx.fillRect(top.x - 12 + c * 4, top.y - 8 + r * 4, 3, 3);
    }
  },
});

// The stand corner clock on its post: a simple round face, hands showing the kick-off time-ish.
registerProp('ot_clock', {
  h: 1.4,
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), c = proj(ax, ay, 0.5, 0.5, 3.4);
    isoBox(ctx, ax, ay, 0.2, 0.2, 0, 0.6, 0.6, 1.2, { top: '#6a6a70', left: '#5a5a60', right: '#3a3a40', outline: OL });
    thick(ctx, b.x, b.y - 24, c.x, c.y + 10, 4, OL); thick(ctx, b.x, b.y - 24, c.x, c.y + 10, 2, '#3a3a42');
    ellipse(ctx, c.x, c.y, 11, 11, OL); ellipse(ctx, c.x, c.y, 10, 10, '#c8a040'); ellipse(ctx, c.x, c.y, 8, 8, '#f4f0e0');
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = OL; ctx.fillRect(Math.round(c.x + Math.sin(a) * 7), Math.round(c.y - Math.cos(a) * 7), 1, 1); }
    const mins = (t / 6) % 1, hrs = 7.7 / 12;
    line(ctx, c.x, c.y, c.x + Math.sin(mins * Math.PI * 2) * 6, c.y - Math.cos(mins * Math.PI * 2) * 6, OL);
    thick(ctx, c.x, c.y, c.x + Math.sin(hrs * Math.PI * 2) * 4, c.y - Math.cos(hrs * Math.PI * 2) * 4, 2, OL);
  },
});

// Wall-mounted fuse box (boss forecourt). USE it while the lights are out to throw the breakers back on.
registerProp('ot_fuseBox', {
  h: 0, solid: false, depthBias: 0.05,
  interact: {
    kind: 'switch', key: null,
    onUse(world, p) {
      if (!world.__otDark) { world.toast('THE FUSE BOX. KEEP AN EYE ON IT.'); return true; }
      world.__otLightsOn = true;
      world.fx.spark(p.cx, p.cy, 1.4, '#ffe14a', 16);
      world.sfx('zap', p);
      world.toast('BREAKERS BACK ON! LIGHTS!');
      return true;
    },
  },
  draw(ctx, ax, ay, p, t, world) {
    const side = p.o.side || 'left';
    facePanel(ctx, ax, ay, side, 0.25, 0.5, 1.0, 1.7, OL);
    facePanel(ctx, ax, ay, side, 0.28, 0.44, 1.04, 1.66, '#5a6050');
    facePanel(ctx, ax, ay, side, 0.3, 0.4, 1.5, 1.6, '#e8c830');
    const m = onFace(ax, ay, side, 0.5, 1.3);
    const dark = world && world.__otDark;
    ctx.fillStyle = dark ? (Math.floor(t * 6) % 2 ? '#ff3020' : '#5a1010') : '#3aff7a'; ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 3, 3);
    if (dark && world.player && Math.hypot(world.player.x - p.cx, world.player.y - p.cy) < 2.2) drawText(ctx, 'E', m.x, m.y - 22 + Math.round(Math.sin(t * 6)), { color: GOLD, align: 'center', outline: '#000' });
  },
});

// Pallet of programme bundles / crates in the service yard (breakable; secret holder).
registerProp('ot_bundles', {
  h: 1.1,
  breakable: { hp: 20, debris: ['#c8c0a8', RED, '#8a6a40'], sfx: 'wood', drops: [['coin', 0.8], ['cash5', 0.4]], score: 60 },
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 0.9, 0.9, 0.15, { color: '#8a6a40', outline: OL });
    for (let i = 0; i < 4; i++) isoBox(ctx, ax, ay, 0.1 + (i % 2) * 0.42, 0.1 + Math.floor(i / 2) * 0.42, 0.15, 0.38, 0.38, 0.45, { top: '#e8e4d8', left: RED, right: DRED, outline: OL });
    isoBox(ctx, ax, ay, 0.3, 0.3, 0.6, 0.4, 0.4, 0.45, { top: '#e8e4d8', left: '#d8d4c8', right: '#a8a498', outline: OL });
  },
});

// =====================================================================================================
// THE RED ARMY IN THE STANDS: home fans (cached doll sprites). They hate you: boo when you're near,
// cheer when you get hit, gasp when you drop one of theirs. Placement opts: flip, single, flag.
// =====================================================================================================
const FAN_LOOKS = [];
function fanLook(i) {
  if (FAN_LOOKS[i]) return FAN_LOOKS[i];
  const rng = makeRng(9100 + i * 137);
  const L = casualLook(rng, { a: RED, b: WHITE, hatChance: 0.3, maskChance: 0, hoodChance: 0 });
  const k = i % 4;
  if (k === 0) L.jacket = { style: 'kit', color: RED, trim: WHITE, badge: GOLD };
  else if (k === 1) L.jacket = { style: 'track', color: rng.pick([RED, BLACK, '#2a2a30']), trim: rng.pick([WHITE, RED]) };
  else if (k === 2) L.jacket = { style: rng.pick(['parka', 'harrington', 'sheepskin']), color: rng.pick(['#2a2a30', '#3a3226', '#1a1a20']) };
  L.shirt = rng.pick([RED, WHITE, BLACK]);
  L.scarf = rng.chance(0.8) ? rng.pick([{ a: RED, b: WHITE }, { a: RED, b: BLACK }, { a: BLACK, b: WHITE }]) : null;
  if (L.hat && L.hat.style === 'beanie') L.hat = { style: 'beanie', color: RED, trim: WHITE, bobble: true };
  L.build = rng.range(0.9, 1.3); L.height = rng.range(0.92, 1.02);
  return (FAN_LOOKS[i] = L);
}
const FAN_POSES = {
  stand: () => ({ ...STAND }),
  cheer0: () => sampleAnim('cheer', 0.0), cheer1: () => sampleAnim('cheer', 0.2),
  boo0: () => ({ ...STAND, lean: 0.15, uaN: 1.5, faN: 0.15, uaF: 0.1, faF: 0.4, head: 0.1 }),
  boo1: () => ({ ...STAND, lean: 0.22, uaN: 1.7, faN: 0.05, uaF: 0.2, faF: 0.5, head: 0.15, dy: 1 }),
  point0: () => ({ ...STAND, lean: 0.1, uaN: 1.6, faN: 0.0, uaF: 0.3, faF: 1.2 }),
  point1: () => ({ ...STAND, lean: 0.18, uaN: 1.75, faN: 0.0, uaF: 0.4, faF: 1.4, dy: 1 }),
  clap0: () => ({ ...STAND, uaN: 1.0, faN: 1.3, uaF: 1.0, faF: 1.4 }),
  clap1: () => ({ ...STAND, uaN: 1.1, faN: 0.9, uaF: 1.1, faF: 1.0, dy: 1 }),
  wave0: () => (ANIMS.scarfWave ? sampleAnim('scarfWave', 0) : { ...STAND, uaN: 2.6, faN: 0.6 }),
  wave1: () => (ANIMS.scarfWave ? sampleAnim('scarfWave', animDuration('scarfWave') / 2) : { ...STAND, uaN: 2.9, faN: 0.2 }),
  chant0: () => (ANIMS.chant ? sampleAnim('chant', 0) : { ...STAND, uaN: 2.2, faN: 1.2 }),
  chant1: () => (ANIMS.chant ? sampleAnim('chant', animDuration('chant') / 2) : { ...STAND, uaN: 2.7, faN: 0.6 }),
  flag0: () => ({ ...STAND, uaN: 2.9, faN: 0.2, uaF: 2.6, faF: 0.4, lean: -0.05 }),
  flag1: () => ({ ...STAND, uaN: 2.7, faN: 0.4, uaF: 2.8, faF: 0.2, lean: -0.05, dy: -1 }),
};
const fanCache = new Map();
function fanSprite(li, pose, flip) {
  const key = li + '|' + pose + '|' + (flip ? 1 : 0);
  let c = fanCache.get(key);
  if (c) return c;
  c = makeCanvas(44, 70);
  const face = pose.startsWith('boo') || pose.startsWith('point') || pose.startsWith('cheer') ? 'shout' : 'normal';
  drawDoll(c.getContext('2d'), 22, 66, fanLook(li), fillPose(FAN_POSES[pose]()), { flip, face, time: li });
  fanCache.set(key, c);
  return c;
}
function crowdState(world) {
  let S = world.__otCrowd;
  if (!S) S = world.__otCrowd = { t: -1, mood: 'idle', cheerT: 0, gaspT: 0, kos: 0, hp: null, bubbleCd: 1, bubbles: [] };
  if (S.t !== world.time) {
    const dt = S.t < 0 ? 0 : Math.max(0, Math.min(0.1, world.time - S.t));
    S.t = world.time;
    S.cheerT -= dt; S.gaspT -= dt; S.bubbleCd -= dt;
    const p = world.player;
    if (p) { if (S.hp !== null && p.hp < S.hp - 0.5) S.cheerT = 1.6; S.hp = p.hp; }
    if (world.stats && world.stats.kos !== S.kos) { if (world.stats.kos > S.kos) S.gaspT = 1.4; S.kos = world.stats.kos; }
    let near = false;
    if (p) for (const f of world.fighters) if (f.team === 'enemy' && f.alive && Math.hypot(f.x - p.x, f.y - p.y) < 9) { near = true; break; }
    S.mood = S.cheerT > 0 ? 'cheer' : S.gaspT > 0 ? 'gasp' : near ? 'boo' : 'idle';
    for (const b of S.bubbles) b.t += dt;
    S.bubbles = S.bubbles.filter(b => b.t < 1.3);
  }
  return S;
}
const LINES = {
  boo: ['WHO ARE YA?', 'OFF!', 'BOOOO!', 'YOU\'RE GOING HOME!', 'GET HIM!', 'SIT DOWN!'],
  cheer: ['GET IN!', 'HAVE THAT!', 'U-N-I-T-E-D!', 'YESSS!', 'GO ON!'],
  gasp: ['OOOH!', 'REF!', 'SEND HIM OFF!', 'DIRTY!', 'NO WAY!'],
  idle: ['UNITED!', 'RED ARMY!', 'GLORY GLORY!', 'U-N-I-T-E-D!', 'COME ON UNITED!', 'MAN-CHES-TER!'],
};
function fanUpdate(p, world, dt) {
  const S = crowdState(world);
  const pl = world.player;
  if (!pl || S.bubbleCd > 0) return;
  if (Math.hypot(pl.x - p.cx, pl.y - p.cy) > 11 || Math.random() > dt * 3) return;
  S.bubbleCd = S.mood === 'idle' ? 1.7 : 0.6;
  const list = LINES[S.mood];
  S.bubbles.push({ x: p.cx, y: p.cy, text: list[Math.floor(Math.random() * list.length)], t: 0, col: S.mood === 'boo' ? '#ffb0a0' : S.mood === 'cheer' ? '#ff6a5a' : '#ffffff' });
}
function fanDraw(ctx, ax, ay, p, t, world) {
  const S = world ? crowdState(world) : { mood: 'idle' };
  const flip = !!p.o.flip;
  const seeds = [[0.3, 0.32], [0.72, 0.74]];
  for (let k = 0; k < 2; k++) {
    if (k === 0 && p.o.single) continue;
    const [lx, ly] = seeds[k];
    const hv = hash2(p.x * 3 + k, p.y * 5 + k, 531);
    const li = Math.floor(hv * 16);
    const s = proj(ax, ay, lx + (hv - 0.5) * 0.12, ly, 0);
    const ph = (t * (S.mood === 'idle' ? 1.6 : 4.2) + hv * 7) % 2;
    const fr = ph < 1 ? 0 : 1;
    let pose;
    if (p.o.flag && k === 1) pose = 'flag' + fr;
    else if (S.mood === 'cheer') pose = 'cheer' + fr;
    else if (S.mood === 'gasp') pose = hv < 0.5 ? 'point' + fr : 'boo' + fr;
    else if (S.mood === 'boo') pose = hv < 0.45 ? 'boo' + fr : hv < 0.75 ? 'point' + fr : 'clap' + fr;
    else pose = hv < 0.25 ? 'clap' + fr : hv < 0.45 ? 'wave' + fr : hv < 0.7 ? 'chant' + fr : 'stand';
    const spr = fanSprite(li, pose, flip);
    const bob = S.mood === 'cheer' && fr ? -2 : 0;
    shadow(ctx, s.x, s.y, 7, 3, 0.3);
    ctx.drawImage(spr, Math.round(s.x - 22), Math.round(s.y - 66 + bob));
    if (p.o.flag && k === 1) {                                    // a red-white-black flag on a stick
      const hx = s.x + (flip ? -7 : 7), hy = s.y - 66 + bob;
      thick(ctx, hx, hy + 10, hx, hy - 12, 2, OL);
      for (let i = 0; i < 14; i++) {
        const w = Math.round(Math.sin(t * 6 + i * 0.5) * i / 14 * 2), x = hx + (flip ? -1 - i : 1 + i);
        ctx.fillStyle = RED; ctx.fillRect(x, hy - 12 + w, 1, 3);
        ctx.fillStyle = WHITE; ctx.fillRect(x, hy - 9 + w, 1, 2);
        ctx.fillStyle = BLACK; ctx.fillRect(x, hy - 7 + w, 1, 3);
      }
    }
  }
  if (world && S.bubbles) for (const b of S.bubbles) {
    if (b.x !== p.cx || b.y !== p.cy) continue;
    const s = toScreen(b.x, b.y, 2.9 + b.t * 0.6);
    ctx.globalAlpha = b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.4) : 1;
    drawText(ctx, b.text, s.x, s.y, { color: b.col, align: 'center', outline: '#000' });
    ctx.globalAlpha = 1;
  }
}
registerProp('ot_fans', { h: 1.7, update: fanUpdate, draw: fanDraw });

// static props: pre-render once
cacheStatic('ot_narrowboat', () => '', boatSmoke);
cacheStatic('ot_lifebuoy');
cacheStatic('ot_milepost', o => o.text || '');
cacheStatic('ot_policeVan', () => '', vanLamp);
cacheStatic('ot_burgerVan', o => o.color || '', burgerOverlay);
cacheStatic('ot_progHut');
cacheStatic('ot_scarfStall', o => o.text || '');
cacheStatic('ot_turnstile', () => '', turnstileOverlay);
cacheStatic('ot_kiosk', () => '', kioskOverlay);
cacheStatic('ot_pillar', o => o.text || '');
cacheStatic('ot_crushBarrier', o => o.dir || 'x');
cacheStatic('ot_seats', o => o.color || '');
cacheStatic('ot_bundles');

// =====================================================================================================
// ITEMS
// =====================================================================================================
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

registerItem('ot_tea', {
  name: 'CUP OF TEA', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 4, y - 10, 9, 10); px(ctx, '#f0ece0', x - 3, y - 9, 7, 9);
    px(ctx, '#8a5a2a', x - 3, y - 9, 7, 2); px(ctx, RED, x - 3, y - 5, 7, 2);
    px(ctx, 'rgba(255,255,255,0.7)', x - 1 + Math.round(Math.sin(t * 5) * 1.5), y - 12 - Math.round(((t * 1.5) % 1) * 4), 1, 2);
  },
});
registerItem('ot_pasty', {
  name: 'MEAT AND POTATO PIE', kind: 'heal', heal: 35, score: 60, stash: true, auto: true,
  icon(ctx, x, y) {
    ellipse(ctx, x, y - 4, 7, 4, OL); ellipse(ctx, x, y - 4, 6, 3, '#c8862e'); ellipse(ctx, x, y - 5, 4, 2, '#e0a050');
    px(ctx, '#7a4a1a', x - 1, y - 6, 2, 1);
  },
});

registerItem('ot_seat', {
  name: 'RED SEAT', kind: 'weapon', score: 0,
  weapon: { dmg: 11, reach: 1.3, durability: 3, attack: 'swing', knockdown: true, throwDmg: 13, breaks: 'plastic' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 6, y - 12, 12, 12); px(ctx, RED, x - 5, y - 11, 10, 6); px(ctx, DRED, x - 5, y - 5, 10, 3);
    px(ctx, '#3a3a40', x - 4, y - 2, 2, 2); px(ctx, '#3a3a40', x + 2, y - 2, 2, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 7 * s, ey = hy + dy * 7 * s, pxv = -dy, pyv = dx;
    thick(ctx, hx, hy, ex, ey, 3, OL);
    fillPoly(ctx, [{ x: ex - pxv * 6, y: ey - pyv * 6 }, { x: ex + pxv * 6, y: ey + pyv * 6 }, { x: ex + pxv * 6 + dx * 6, y: ey + pyv * 6 + dy * 6 }, { x: ex - pxv * 6 + dx * 6, y: ey - pyv * 6 + dy * 6 }], OL);
    fillPoly(ctx, [{ x: ex - pxv * 5, y: ey - pyv * 5 }, { x: ex + pxv * 5, y: ey + pyv * 5 }, { x: ex + pxv * 5 + dx * 5, y: ey + pyv * 5 + dy * 5 }, { x: ex - pxv * 5 + dx * 5, y: ey - pyv * 5 + dy * 5 }], flash ? '#ffffff' : RED);
  },
});

// Football rattle: the old boys swear by it. Loud, wooden, surprisingly effective.
registerItem('ot_rattle', {
  name: 'FOOTBALL RATTLE', kind: 'weapon', score: 0,
  weapon: { dmg: 9, reach: 1.2, durability: 5, attack: 'swing', throwDmg: 12, breaks: 'wood' },
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 1, y - 4, 3, 5); px(ctx, '#8a6a40', x, y - 3, 1, 4);
    const k = Math.floor(t * 8) % 2;
    px(ctx, OL, x - 5, y - 11, 11, 7); px(ctx, k ? RED : WHITE, x - 4, y - 10, 9, 2); px(ctx, k ? WHITE : RED, x - 4, y - 8, 9, 2); px(ctx, BLACK, x - 4, y - 6, 9, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 8 * s, ey = hy + dy * 8 * s;
    thick(ctx, hx, hy, ex, ey, 3, OL); line(ctx, hx, hy, ex, ey, '#8a6a40');
    ctx.fillStyle = OL; ctx.fillRect(Math.round(ex) - 4, Math.round(ey) - 3, 9, 7);
    ctx.fillStyle = flash ? '#ffffff' : RED; ctx.fillRect(Math.round(ex) - 3, Math.round(ey) - 2, 7, 2);
    ctx.fillStyle = WHITE; ctx.fillRect(Math.round(ex) - 3, Math.round(ey), 7, 2);
  },
});

// Rolled-up match programme: barely a weapon. Very satisfying.
registerItem('ot_programme', {
  name: 'ROLLED PROGRAMME', kind: 'weapon', score: 0,
  weapon: { dmg: 5, reach: 1.15, durability: 6, attack: 'swing', throwDmg: 6, breaks: 'paper' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 2, y - 13, 5, 13); px(ctx, RED, x - 1, y - 12, 3, 11); px(ctx, WHITE, x - 1, y - 8, 3, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const ex = hx + Math.sin(ang) * 10 * s, ey = hy + Math.cos(ang) * 10 * s;
    thick(ctx, hx, hy, ex, ey, 4, OL); thick(ctx, hx, hy, ex, ey, 2, flash ? '#ffffff' : RED);
  },
});

// Lifebuoy off the towpath post: big, round, bouncy.
registerItem('ot_buoy', {
  name: 'LIFEBUOY', kind: 'weapon', score: 0,
  weapon: { dmg: 10, reach: 1.3, durability: 4, attack: 'swing', knockdown: true, throwDmg: 16, breaks: 'plastic' },
  icon(ctx, x, y) {
    ellipse(ctx, x, y - 6, 6, 6, OL);
    for (let a = 0; a < 8; a++) { const g = a / 8 * Math.PI * 2; ellipse(ctx, x + Math.cos(g) * 4, y - 6 + Math.sin(g) * 4, 2, 2, a % 2 ? WHITE : '#e8501c'); }
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const ex = hx + Math.sin(ang) * 7 * s, ey = hy + Math.cos(ang) * 7 * s;
    ellipse(ctx, ex, ey, 6, 6, OL);
    for (let a = 0; a < 8; a++) { const g = a / 8 * Math.PI * 2 + ang; ellipse(ctx, ex + Math.cos(g) * 4, ey + Math.sin(g) * 4, 2, 2, flash ? '#ffffff' : (a % 2 ? WHITE : '#e8501c')); }
  },
});
