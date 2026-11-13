// THEME: IBROX (tour arena) — Rangers away. Govan, Glasgow G51, in the rain.
// Red-sandstone tenements and back courts, the wee orange Subway, Paisley Road West pubs and a chippy,
// Edmiston Drive under the red-brick Main Stand facade, the Broomloan Road stand. Every id starts with 'ibrox_'.
//
// Exports used by the level: fryerSpitting(time), spawnSubwayTrain(world, vehicle), drawCranes(ctx, world),
// drawGust(ctx, world), ROYAL/RED/WHITE.

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
import { sampleAnim, fillPose, STAND } from '../../../game/poses.js';
import { casualLook } from '../../enemies.js';
import { ramp, vnoise } from '../../themes/common.js';

export const ROYAL = '#1b458f', RED = '#c8102e', WHITE = '#f4f4f0';
const OL = '#120c14';
const SUB = '#e8661a';            // the wee orange Subway trains
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const pickR = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v)))];

// =====================================================================================================
// FLOORS
// =====================================================================================================

// Back green: trampled grass, black ash paths and standing water.
const BGRASS = ['#1e3218', '#26391e', '#2e4424', '#38502a'];
registerFloor('ibrox_backcourt', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const pud = vnoise(X * 0.6, Y * 0.6, 301);
    if (pud > 0.74) return pud < 0.755 ? '#5a6478' : (n2(X * 20, Y * 6, 302) > 0.9 ? '#7a88a0' : '#2a3242');
    const ash = vnoise(X * 1.1, Y * 1.1, 303);
    const n = n2(X * 32, Y * 32, 304);
    if (ash > 0.62) return n < 0.3 ? '#2a2628' : n < 0.8 ? '#363034' : '#463e40';
    return pickR(BGRASS, 1.6 + (vnoise(X * 2, Y * 2, 305) - 0.5) * 3 + (n > 0.85 ? 1 : n < 0.1 ? -1 : 0));
  },
});

// Close (tenement passage): worn sandstone flags, damp.
registerFloor('ibrox_close', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const fu = (X * 2) % 1, fv = (Y * 1.5) % 1;
    if (fu < 0.04 || fv < 0.05) return '#2a2224';
    const s = n2(X * 2, Y * 1.5, 311);
    const n = n2(X * 32, Y * 32, 312);
    let c = s < 0.3 ? '#5a4a46' : s < 0.7 ? '#644e48' : '#6e5650';
    if (vnoise(X * 1.5, Y * 1.5, 313) > 0.7) c = shade(c, -0.2);
    if (n > 0.96) c = shade(c, 0.12);
    return c;
  },
});

// Stairs down into the Subway (steps run along world x, descending east).
registerFloor('ibrox_stairs', {
  pixel(u, v, tx, ty) {
    const st = (u * 3) % 1;
    if (st < 0.1) return '#2e2a2c';
    if (st < 0.2) return Math.floor((ty + v) * 6) % 5 === 0 ? '#8a6a3a' : '#c8a040';   // brass nosing
    const n = n2((tx + u) * 32, (ty + v) * 32, 321);
    return n < 0.1 ? '#4a4648' : n > 0.95 ? '#7a7678' : '#5c585a';
  },
});

// Stairs up out of the Subway (steps run along world y).
registerFloor('ibrox_stairsY', {
  pixel(u, v, tx, ty) {
    const st = (v * 3) % 1;
    if (st < 0.1) return '#2e2a2c';
    if (st < 0.2) return Math.floor((tx + u) * 6) % 5 === 0 ? '#8a6a3a' : '#c8a040';
    const n = n2((tx + u) * 32, (ty + v) * 32, 322);
    return n < 0.1 ? '#4a4648' : n > 0.95 ? '#7a7678' : '#5c585a';
  },
});

// Subway ticket hall: orange and cream terrazzo squares.
registerFloor('ibrox_hall', {
  pixel(u, v, tx, ty) {
    const gu = (u * 2) % 1, gv = (v * 2) % 1;
    if (gu < 0.05 || gv < 0.05) return '#4a3a30';
    const k = (Math.floor(u * 2) + Math.floor(v * 2) + tx + ty) % 2;
    const n = n2((tx + u) * 32, (ty + v) * 32, 331);
    const base = k ? '#c8b89a' : '#b8682e';
    if (n < 0.08) return shade(base, -0.15);
    if (n > 0.93) return shade(base, 0.12);
    return base;
  },
});

// Island platform: grey slabs.
const PLAT = ramp('#6a6a70', -0.2, 0.15, 5);
function platPix(u, v, tx, ty) {
  const gu = (u * 2) % 1, gv = (v * 2) % 1;
  if (gu < 0.04 || gv < 0.04) return '#3e3e44';
  const n = n2((tx + u) * 32, (ty + v) * 32, 341);
  if (n < 0.012) return '#9a9aa0';
  return pickR(PLAT, 2.2 + (hash2(tx * 2 + Math.floor(u * 2), ty * 2 + Math.floor(v * 2), 342) - 0.5) * 2 + (n < 0.1 ? -1 : 0));
}
registerFloor('ibrox_platform', { pixel: platPix });
// Platform edge: stone lip and yellow line on the NORTH (track) side.
registerFloor('ibrox_platEdge', {
  pixel(u, v, tx, ty) {
    if (v < 0.08) return v < 0.03 ? '#2a2a30' : '#b8b4a8';
    if (v > 0.16 && v < 0.28) return '#e8c020';
    if (v > 0.32 && v < 0.46) {
      const bu = (u * 8) % 1, bv = ((v - 0.32) * 14) % 1;
      if (bu > 0.25 && bu < 0.65 && bv > 0.2 && bv < 0.7) return bu < 0.4 ? '#9a9aa2' : '#76767e';
    }
    return platPix(u, v, tx, ty);
  },
});
// Subway track bed (narrow gauge, along world x): concrete trough, sleepers, two rails and the third rail.
registerFloor('ibrox_track', {
  pixel(u, v, tx, ty) {
    const Y = ty + v;
    const lane = Y - 1;                      // track occupies rows 1..2 (lane centre y = 2)
    const r1 = Math.abs(lane - 0.62), r2 = Math.abs(lane - 1.38), r3 = Math.abs(lane - 0.25);
    if (r1 < 0.035 || r2 < 0.035) return '#c8ccd4';
    if (r1 < 0.07 || r2 < 0.07) return '#5a5250';
    if (r3 < 0.05) return '#8a8a7a';         // third rail
    if (lane > 0.45 && lane < 1.55) {
      const su = ((tx + u) * 3) % 1;
      if (su < 0.3) return su < 0.06 ? '#4a3a2a' : '#2e241a';
    }
    const n = n2((tx + u) * 32, Y * 32, 351);
    return n < 0.3 ? '#2a2826' : n < 0.7 ? '#363230' : n < 0.95 ? '#423e3a' : '#5a5650';
  },
});

// Main Stand concourse: grey concrete with blue painted walkway lines.
registerFloor('ibrox_concourse', {
  pixel(u, v, tx, ty, r) {
    const X = tx + u, Y = ty + v;
    const ly = Y % 5;
    if (ly > 0.2 && ly < 0.3) return '#2a4a8a';
    if (u < 0.03 || v < 0.03) return '#4c4a52';
    const n = n2(X * 32, Y * 32, 361);
    let c = r < 0.4 ? '#66646c' : r < 0.75 ? '#605e66' : '#6a6870';
    if (n < 0.07) c = shade(c, -0.14); else if (n > 0.975) c = '#d8d4c8';
    return c;
  },
});

// Marble hall: polished checker with veins.
registerFloor('ibrox_marble', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const k = (Math.floor(X) + Math.floor(Y)) % 2;
    if (u < 0.025 || v < 0.025) return '#8a7a60';
    const vein = Math.abs(Math.sin(X * 3.1 + Math.sin(Y * 2.3) * 2.2 + k * 3)) < 0.06;
    if (k) return vein ? '#8a8478' : (n2(X * 32, Y * 32, 371) > 0.9 ? '#ece6d8' : '#e0d8c6');
    return vein ? '#6a2a2a' : (n2(X * 32, Y * 32, 372) > 0.9 ? '#3a3a46' : '#2a2a36');
  },
});

// Broomloan stand: stepped concrete, riser shadows, ticket stubs.
registerFloor('ibrox_awaySteps', {
  pixel(u, v, tx, ty) {
    const step = (v * 2) % 1;
    const X = tx + u, Y = ty + v;
    if (step < 0.1) return '#2c2c34';
    if (step < 0.2) return Math.floor(X * 2) % 7 === 0 ? '#5a5a62' : '#8c8a92';
    const n = n2(X * 32, Y * 32, 381);
    if (n < 0.04) return '#26242a';
    if (n > 0.985) return Math.floor(X * 9) % 2 ? ROYAL : WHITE;
    return n < 0.2 ? '#56565e' : '#5e5e66';
  },
});

// Edmiston Drive forecourt: wet sandstone-red flags with puddles reflecting the sky.
registerFloor('ibrox_forecourt', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const pud = vnoise(X * 0.5, Y * 0.5, 391);
    if (pud > 0.7) {
      if (pud < 0.715) return '#6a6a78';
      return n2((X - Y) * 8, (X + Y) * 1.5, 392) > 0.9 ? '#8a94aa' : '#343a4a';
    }
    const fu = (X * 2) % 1, fv = (Y * 2) % 1;
    if (fu < 0.05 || fv < 0.05) return '#3a2a28';
    const s = n2(X * 2, Y * 2, 393);
    const base = s < 0.33 ? '#6e4a40' : s < 0.66 ? '#78524a' : '#6a4640';
    return n2(X * 32, Y * 32, 394) < 0.08 ? shade(base, -0.15) : base;
  },
});

// Chippy floor: red quarry tiles, grease and vinegar spots.
registerFloor('ibrox_chippyFloor', {
  pixel(u, v, tx, ty) {
    const gu = (u * 3) % 1, gv = (v * 3) % 1;
    if (gu < 0.06 || gv < 0.06) return '#5a4a40';
    const n = n2((tx + u) * 32, (ty + v) * 32, 401);
    const s = hash2(tx * 3 + Math.floor(u * 3), ty * 3 + Math.floor(v * 3), 402);
    const base = s < 0.5 ? '#8a3424' : '#7a2e20';
    if (vnoise((tx + u) * 2, (ty + v) * 2, 403) > 0.72) return shade(base, -0.18);   // grease
    return n > 0.96 ? shade(base, 0.15) : base;
  },
});

// =====================================================================================================
// WALLS
// =====================================================================================================
const dkf = (c, side, k = -0.3) => (side === 'right' ? shade(c, k) : c);

// Red sandstone ashlar (shared by tenements): big courses with fine joints, soot toward the top and the ground.
function ashlar(u, py, side, H, variant, base = '#9a4a3a') {
  const row = Math.floor(py / 7), bx = u * 16 + (row % 2 ? 5 : 0);
  if (py % 7 === 6) return dkf('#4a2420', side);
  if (Math.floor(bx) % 10 === 0) return dkf('#562a24', side);
  const s = hash2(Math.floor(bx / 10) + variant * 7, row, 411);
  let c = s < 0.3 ? shade(base, -0.08) : s > 0.8 ? shade(base, 0.08) : base;
  const soot = vnoise(u * 3 + variant, py / 14, 412);
  if (soot > 0.66) c = shade(c, -0.22);
  if (H - py < 8) c = shade(c, -0.18);
  return dkf(c, side);
}

// Tenement front: four storeys of sash windows in a red-sandstone ashlar face, cornice, string courses,
// some lit windows (it's a dreich afternoon), a close mouth on some tiles.
const CURT = ['#8a2a2a', '#2a4a7a', '#c8c0a8', '#4a6a3a', '#6a4a7a'];
registerWall('ibrox_tenement', {
  variants: 8,
  top(u, v, variant) {
    if (Math.abs(u - 0.5) < 0.05) return '#4a4248';
    const row = (v * 6) % 1;
    if (row < 0.15) return '#5a5462';
    return hash2(Math.floor(u * 8), Math.floor(v * 6), variant + 41) < 0.2 ? '#3a3440' : '#46404e';
  },
  face(u, py, side, H, r, variant) {
    if (py < 4) return dkf(py < 2 ? '#c8a088' : '#3a1e1a', side);        // cornice
    const fb = H - 1 - py, storey = Math.floor(fb / 25), fy = 24 - (fb % 25);
    const wu = u * 16, fx = Math.floor(wu);
    if (fy === 0 && storey > 0) return dkf('#b47a64', side);               // string course
    // close mouth (ground floor, every 5th tile)
    if (storey === 0 && variant % 5 === 2 && wu > 4 && wu < 12 && fy > 5) {
      if (fy < 9 && (fx === 5 || fx === 10 || (fy === 6 && fx > 5 && fx < 10))) return dkf('#c8a088', side);
      return fy < 9 ? dkf('#1a1012', side) : dkf('#0e0a0c', side);
    }
    if (fy > 5 && fy < 20 && wu > 3.5 && wu < 12.5) {
      if (fx === 4 || fx === 12 || fy === 6 || fy === 19) return dkf('#e8e0d0', side);    // white frames
      if (fy === 12 || fy === 13) return dkf('#d8d0c0', side);                             // meeting rail
      const lit = hash2(variant, storey + (side === 'right' ? 9 : 0), 413) < 0.38;
      if (lit) {
        const cur = CURT[Math.floor(hash2(variant, storey, 414) * CURT.length)];
        if (fx <= 5 || fx >= 11) return dkf(cur, side);
        return dkf(fy < 12 ? '#ffd88a' : '#e8a848', side, -0.25);
      }
      const refl = Math.abs((wu - 4) - (fy - 6) * 0.5 - 2) < 0.7;
      return dkf(refl ? '#4a5a76' : '#1a2232', side, -0.25);
    }
    if (wu > 3 && wu < 13 && fy === 20) return dkf('#c8a088', side);       // sill
    return ashlar(u, py, side, H, variant);
  },
});

// Tenement back (rear elevation onto the back courts): stair windows on the half landings, drainpipes, soot.
registerWall('ibrox_tenementBack', {
  variants: 6,
  top: (u, v, variant) => (hash2(Math.floor(u * 8), Math.floor(v * 6), variant + 51) < 0.2 ? '#3a3440' : '#423c4a'),
  face(u, py, side, H, r, variant) {
    if (py < 3) return dkf('#3a2422', side);
    const wu = u * 16, fx = Math.floor(wu);
    if (variant % 3 === 1 && fx === 13) return dkf(py % 9 === 0 ? '#3a3a40' : '#24242a', side);    // drainpipe
    const fb = H - 1 - py, storey = Math.floor((fb + (variant % 2 ? 12 : 0)) / 25), fy = 24 - ((fb + (variant % 2 ? 12 : 0)) % 25);
    const narrow = variant % 2 ? (wu > 6 && wu < 10) : (wu > 3.5 && wu < 9.5);
    if (narrow && fy > 6 && fy < 19 && storey < 4 && fb > 8) {
      const ex = variant % 2 ? [6, 9] : [4, 9];
      if (fx === ex[0] || fx === ex[1] || fy === 7 || fy === 18) return dkf('#c8c0b0', side);
      return dkf(hash2(variant, storey, 52) < 0.3 ? '#d8b070' : '#1c2230', side, -0.25);
    }
    return ashlar(u, py, side, H, variant + 3, '#7e3e32');
  },
});

// Subway walls: cream tiles with an orange band and a brown skirting.
registerWall('ibrox_subwayWall', {
  top: '#8a8278',
  face(u, py, side, H) {
    if (H - py < 5) return dkf('#3a2a20', side);
    const band = Math.floor(H * 0.4);
    if (py >= band && py < band + 5) return dkf(py === band ? '#8a3a10' : SUB, side);
    const tx = (u * 16) % 4, ty = py % 4;
    const c = (tx < 0.5 || ty === 0) ? '#a89c88' : (ty === 1 && tx < 2 ? '#f4ecd8' : '#e2d8c2');
    return dkf(c, side, -0.25);
  },
});

// Pub frontage (Paisley Road West): painted timber, gold-lettered fascia, frosted lit windows, a door.
const PUBPAL = ['#1a3a2a', '#4a1418', '#14204a', '#2a2a2e'];
registerWall('ibrox_pubFront', {
  variants: 4,
  top: '#3a3036',
  face(u, py, side, H, r, variant) {
    const base = PUBPAL[variant % 4];
    const wu = u * 16, fx = Math.floor(wu);
    const shopTop = H - 44;
    if (py < shopTop) return ashlar(u, py, side, H, variant + 5);
    const fy = py - shopTop;
    if (fy < 2) return dkf('#c8a050', side);
    if (fy < 10) {                                                      // fascia with gold blocky letters
      const letter = fy > 2 && fy < 8 && fx > 0 && fx < 15 && hash2(fx + variant * 16, 1, 421) < 0.55;
      return dkf(letter ? '#e8c860' : base, side);
    }
    if (fx === 0 || fx === 15 || fy > 40) return dkf(shade(base, -0.2), side);
    if (variant % 2 === 0 && fx >= 9 && fx <= 13) {                    // door
      if (fx === 9 || fx === 13) return dkf('#c8a050', side);
      return dkf(fy < 18 ? '#e8b060' : shade(base, 0.1), side);
    }
    if (fx >= 2 && fx <= (variant % 2 === 0 ? 7 : 13) && fy > 12 && fy < 36) {
      if (fy === 24) return dkf(base, side);
      const etch = (fx + fy) % 5 === 0;
      return dkf(etch ? '#f8e0a8' : (fy < 24 ? '#e8b868' : '#c89848'), side, -0.25);
    }
    return dkf(base, side);
  },
});

// Inside the chippy: white tiles, a blue band, a menu board on some tiles.
registerWall('ibrox_chippyInner', {
  variants: 4,
  top: '#9a9aa0',
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    if (variant % 4 === 1 && py > 10 && py < 34 && wu > 1.5 && wu < 14.5) {
      if (py === 11 || py === 33 || wu < 2.5 || wu > 13.5) return dkf('#6a4a2a', side);
      const ln = (py - 13) % 4 === 0 && wu > 3 && wu < 13 && hash2(Math.floor(wu), py, 431) < 0.8;
      return dkf(ln ? '#f4f4ec' : '#1a1a1e', side);
    }
    const band = H - 30;
    if (py >= band && py < band + 3) return dkf(ROYAL, side);
    const tx = wu % 4, ty = py % 4;
    return dkf((tx < 0.5 || ty === 0) ? '#b8b8b4' : '#eeeeea', side, -0.25);
  },
});

// Main Stand facade (Edmiston Drive): red brick, cream stone dressings, tall arched first-floor windows with
// blue frames, rectangular ground-floor windows, a stone plinth and cornice.
registerWall('ibrox_facade', {
  variants: 6,
  top: (u, v) => ((u * 4) % 1 < 0.12 ? '#5a2a22' : '#6a3428'),
  face(u, py, side, H, r, variant) {
    const wu = u * 16, fx = Math.floor(wu);
    if (py < 4) return dkf(py < 2 ? '#e8dcc0' : '#8a7a60', side);           // cornice
    if (H - py < 6) return dkf(H - py < 2 ? '#3a3230' : '#c8bca0', side);    // plinth
    const mid = Math.floor(H * 0.55);
    if (py >= mid && py < mid + 3) return dkf('#e0d4b8', side);             // string course
    // upper arched windows
    if (py > 10 && py < mid - 3 && wu > 4 && wu < 12) {
      const cx = wu - 8, top = 14 - Math.sqrt(Math.max(0, 16 - cx * cx)) * 1.2;
      if (py < top) return brickPx(u, py, side, variant);
      if (Math.abs(py - top) < 1.2 || fx === 5 || fx === 11) return dkf('#e8dcc0', side);
      if (fx === 8 || py % 6 === 0) return dkf(ROYAL, side);
      return dkf(hash2(variant, py >> 3, 441) < 0.25 ? '#e8c878' : '#1e2a3e', side, -0.25);
    }
    // ground-floor windows
    if (py > mid + 6 && py < H - 9 && wu > 4 && wu < 12) {
      if (fx === 4 || fx === 11 || py === mid + 7 || py === H - 10) return dkf('#e8dcc0', side);
      if (fx === 8) return dkf(ROYAL, side);
      return dkf('#1a2232', side, -0.25);
    }
    return brickPx(u, py, side, variant);
  },
});
function brickPx(u, py, side, variant) {
  const bx = u * 16, row = Math.floor(py / 3), off = row % 2 ? 2 : 0;
  if (py % 3 === 2 || Math.floor(bx + off) % 4 === 0) return dkf('#5a2a22', side);
  const s = hash2(Math.floor((bx + off) / 4) + variant * 5, row, 442);
  return dkf(s < 0.3 ? '#8a3424' : s > 0.85 ? '#a8483a' : '#9a3c2e', side);
}

// Stand walls inside the ground: royal-blue painted concrete with a red-white-red band.
registerWall('ibrox_standWall', {
  variants: 4,
  top: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 ? '#22263a' : '#2a2e44'),
  face(u, py, side, H, r, variant) {
    if (py < 2) return dkf('#8a8a92', side);
    if (py < 4) return dkf(RED, side);
    if (py < 6) return dkf(WHITE, side);
    if (py < 8) return dkf(RED, side);
    const wu = Math.floor(u * 16);
    let c = wu % 4 === 0 ? '#16306a' : ROYAL;
    if (hash2(wu + variant * 5, py, 451) < 0.03) c = '#2a5aa8';
    if (H - py < 3) c = '#0e1a3a';
    return dkf(c, side);
  },
});
// Front of the Main Stand enclosure (low, can't be jumped): white top rail over blue panels.
registerWall('ibrox_standFront', {
  top: '#e8e8e4',
  face(u, py, side, H) {
    if (py < 3) return dkf(WHITE, side);
    if (H - py < 3) return dkf('#0e1a3a', side);
    return dkf(Math.floor(u * 16) % 8 === 0 ? '#16306a' : ROYAL, side);
  },
});
// Oak panelling (the marble hall and the trophy room), a dado rail and gilt frames.
registerWall('ibrox_woodPanel', {
  variants: 4,
  top: '#4a2e1c',
  face(u, py, side, H, r, variant) {
    const wu = u * 16, fx = Math.floor(wu);
    if (py < 3) return dkf('#c8a050', side);
    const dado = Math.floor(H * 0.62);
    if (py === dado || py === dado + 1) return dkf('#c8a050', side);
    if (py < dado && variant % 2 === 0 && wu > 4 && wu < 12 && py > 8 && py < dado - 6) {   // framed painting
      if (fx === 4 || fx === 11 || py === 9 || py === dado - 7) return dkf('#d8b048', side);
      return dkf(hash2(fx, py >> 2, 461 + variant) < 0.5 ? '#2a3a2a' : '#3a2a20', side);
    }
    const panel = (fx % 8 === 0) || (py > dado && (py - dado) % 14 === 0);
    const grain = Math.sin(wu * 1.7 + py * 0.15 + variant) > 0.6;
    return dkf(panel ? '#3a2214' : grain ? '#6a4228' : '#5e3a22', side);
  },
});
// Segregation fence: see-through steel mesh, blue top rail.
registerWall('ibrox_awayFence', {
  top: '#2a2a30',
  face(u, py, side, H) {
    const wu = u * 16;
    if (py < 2) return dkf(ROYAL, side, -0.25);
    if (Math.floor(wu) === 0 || Math.floor(wu) === 8 || H - py < 2) return dkf('#3a3a44', side, -0.25);
    if ((Math.floor(wu) + py) % 4 === 0 || (Math.floor(wu) - py + 400) % 4 === 0) return dkf('#6a6e78', side, -0.25);
    return null;
  },
});
// Broomloan stand back: rows of blue tip-up seats rising up, the odd white seat spelling nothing in particular.
registerWall('ibrox_seatsWall', {
  variants: 4,
  top: '#20242e',
  face(u, py, side, H, r, variant) {
    if (py < 2) return dkf('#6a6a70', side);
    const row = Math.floor((py - 2) / 7), fy = (py - 2) % 7;
    const wu = u * 16, seat = Math.floor(wu / 4), fx = wu % 4;
    if (fy === 6) return dkf('#2a2a2e', side);
    if (fy >= 4) return dkf('#5a5a60', side);
    if (fx < 0.6) return dkf('#2a2a32', side);
    const white = (seat * 3 + row * 5 + variant) % 11 === 0;
    return dkf(white ? WHITE : (fy === 0 ? '#3a64b8' : ROYAL), side);
  },
});
// Back-court dividing wall: low rubble sandstone with a coping (jumpable, h 1.2).
registerWall('ibrox_courtWall', {
  top: '#8a6a5a',
  face(u, py, side, H, r, variant) {
    if (py < 3) return dkf(py < 1 ? '#a88070' : '#7a5446', side);
    const s = hash2(Math.floor(u * 6 + (Math.floor(py / 5) % 2) * 0.5), Math.floor(py / 5), 471 + variant);
    if ((py % 5) === 4) return dkf('#3a2620', side);
    return dkf(s < 0.3 ? '#6a3e32' : s < 0.7 ? '#7a463a' : '#5e362c', side);
  },
});
// Police line: steel crowd barriers, blue-and-yellow chequer band (too high to vault, h 1.5).
registerWall('ibrox_policeLine', {
  top: '#3a3a44',
  face(u, py, side, H) {
    const wu = u * 16;
    if (py < 2 || H - py < 2) return dkf('#9aa0a8', side);
    if (py > 8 && py < 15) return dkf(((Math.floor(wu / 2) + Math.floor((py - 9) / 3)) % 2) ? '#f0d020' : '#1a3a8a', side);
    if (Math.floor(wu) % 4 === 0) return dkf('#9aa0a8', side);
    return null;
  },
});

// =====================================================================================================
// CHIPPY FRYER: shared spit timing (the level pairs it with a hazard zone in front of the range)
// =====================================================================================================
// boils for 3s, then spits hot fat for 1.8s (step back, or throw somebody into it)
export function fryerSpitting(time, phase = 0) { return ((time + phase) % 4.8) > 3.0; }

// =====================================================================================================
// HOME FANS — they jeer at you (and gasp when you deck one of theirs)
// =====================================================================================================
const FAN_LOOKS = [];
function fanLook(i) {
  if (FAN_LOOKS[i]) return FAN_LOOKS[i];
  const rng = makeRng(9100 + i * 137);
  const L = casualLook(rng, { a: ROYAL, b: WHITE, hatChance: 0.3 });
  if (i % 3 === 0) L.jacket = { style: 'tee', color: ROYAL };
  else if (i % 3 === 1) L.jacket = { style: 'track', color: rng.pick([ROYAL, '#1a1a22', WHITE]), trim: rng.pick([WHITE, RED]) };
  else L.jacket = { style: 'parka', color: rng.pick(['#2a3440', '#3a4030', '#1a2238']) };
  L.shirt = rng.pick([ROYAL, ROYAL, WHITE, RED]);
  L.scarf = rng.chance(0.7) ? (rng.chance(0.7) ? { a: ROYAL, b: WHITE } : { a: ROYAL, b: RED }) : null;
  if (L.hat && L.hat.style === 'beanie') L.hat = { style: 'beanie', color: ROYAL, trim: rng.pick([WHITE, RED]) };
  L.mask = null; L.hood = rng.chance(0.25);
  L.build = rng.range(0.9, 1.25); L.height = rng.range(0.92, 1.02);
  return (FAN_LOOKS[i] = L);
}
const FAN_POSES = {
  stand: () => ({ ...STAND }),
  jeer0: () => ({ ...STAND, lean: 0.15, uaN: 1.6, faN: 0.1, uaF: 0.1, faF: 0.4, head: 0.1 }),
  jeer1: () => ({ ...STAND, lean: 0.24, uaN: 1.8, faN: 0.0, uaF: 0.2, faF: 0.5, head: 0.15, dy: 1 }),
  wave0: () => ({ ...STAND, uaN: 2.6, faN: 0.6, uaF: 0.3, faF: 0.5 }),
  wave1: () => ({ ...STAND, uaN: 2.9, faN: 0.2, uaF: 0.3, faF: 0.5, dy: -1 }),
  gasp0: () => ({ ...STAND, uaN: 2.4, faN: 2.4, uaF: 2.4, faF: 2.4, lean: -0.08 }),
  gasp1: () => ({ ...STAND, uaN: 2.5, faN: 2.6, uaF: 2.5, faF: 2.6, lean: -0.12, dy: 1 }),
  cheer0: () => sampleAnim('cheer', 0.0), cheer1: () => sampleAnim('cheer', 0.2),
};
const fanCache = new Map();
function fanSprite(li, pose, flip) {
  const key = li + '|' + pose + '|' + (flip ? 1 : 0);
  let c = fanCache.get(key);
  if (c) return c;
  c = makeCanvas(44, 70);
  drawDoll(c.getContext('2d'), 22, 66, fanLook(li), fillPose(FAN_POSES[pose]()), { flip, face: pose === 'stand' || pose.startsWith('wave') ? 'normal' : 'shout', time: li });
  fanCache.set(key, c);
  return c;
}
// shared mood: 'jeer' (you're near), 'gasp' (you just floored one of theirs), 'cheer' (you just got hit), 'idle'
function crowdState(world) {
  let S = world.__ibroxCrowd;
  if (!S) S = world.__ibroxCrowd = { t: -1, mood: 'idle', gaspT: 0, cheerT: 0, kos: 0, php: null, bubbleCd: 1, bubbles: [] };
  if (S.t !== world.time) {
    const dt = S.t < 0 ? 0 : Math.max(0, Math.min(0.1, world.time - S.t));
    S.t = world.time;
    S.gaspT -= dt; S.cheerT -= dt; S.bubbleCd -= dt;
    if (world.stats && world.stats.kos !== S.kos) { if (world.stats.kos > S.kos) S.gaspT = 1.6; S.kos = world.stats.kos; }
    const p = world.player;
    if (p) { if (S.php !== null && p.hp < S.php - 4) S.cheerT = 1.4; S.php = p.hp; }
    let near = false;
    if (p) for (const f of world.fighters) if (f.team === 'enemy' && f.alive && Math.hypot(f.x - p.x, f.y - p.y) < 9) { near = true; break; }
    S.mood = S.gaspT > 0 ? 'gasp' : S.cheerT > 0 ? 'cheer' : near ? 'jeer' : 'idle';
    for (const b of S.bubbles) b.t += dt;
    S.bubbles = S.bubbles.filter(b => b.t < 1.3);
  }
  return S;
}
const JEER = ['WHO ARE YE?', 'GO HAME!', 'LONG WAY HAME!', 'YER BUS IS LEAVING!', 'BRING A BROLLY!', 'NAE CHANCE!', 'WEE MAN!', 'IS THAT YER BEST?'];
const GASP = ['AW NAW!', 'HE\'S DECKED HIM!', 'GET UP, BIG MAN!', 'SHOCKING!', 'REF!!'];
const CHEER = ['GAUN YERSEL!', 'HAVE THAT!', 'TELT YE!', 'GERS! GERS!'];
const IDLE = ['COME ON THE GERS!', 'LIGHT BLUES!', 'IT\'S CHUCKIN\' IT DOWN', 'PIE AND A BEEF TEA?', 'GERS!'];
function fanUpdate(p, world, dt) {
  const S = crowdState(world);
  const pl = world.player;
  if (!pl || S.bubbleCd > 0) return;
  if (Math.hypot(pl.x - p.cx, pl.y - p.cy) > 11 || Math.random() > dt * 3) return;
  S.bubbleCd = S.mood === 'idle' ? 1.6 : 0.6;
  const list = S.mood === 'jeer' ? JEER : S.mood === 'gasp' ? GASP : S.mood === 'cheer' ? CHEER : IDLE;
  S.bubbles.push({ x: p.cx, y: p.cy, text: list[Math.floor(Math.random() * list.length)], t: 0, col: S.mood === 'gasp' ? '#ffffff' : '#a8c8ff' });
}
registerProp('ibrox_fans', {
  h: 1.7,
  update: fanUpdate,
  draw(ctx, ax, ay, p, t, world) {
    const S = world ? crowdState(world) : { mood: 'idle' };
    const flip = !!p.o.flip;
    const seeds = [[0.3, 0.32], [0.72, 0.74]];
    for (let k = 0; k < 2; k++) {
      if (k === 0 && p.o.single) continue;
      const [lx, ly] = seeds[k];
      const hv = hash2(p.x * 3 + k, p.y * 5 + k, 91);
      const li = Math.floor(hv * 12);
      const s = proj(ax, ay, lx + (hv - 0.5) * 0.12, ly, 0);
      const fr = ((t * (S.mood === 'idle' ? 1.5 : 4) + hv * 7) % 2) < 1 ? 0 : 1;
      const pose = S.mood === 'jeer' ? (hv < 0.65 ? 'jeer' : 'wave') + fr : S.mood === 'gasp' ? 'gasp' + fr : S.mood === 'cheer' ? 'cheer' + fr : (hv < 0.4 ? 'wave' + fr : 'stand');
      shadow(ctx, s.x, s.y, 7, 3, 0.3);
      ctx.drawImage(fanSprite(li, pose, flip), Math.round(s.x - 22), Math.round(s.y - 66 + (S.mood === 'cheer' && fr ? -2 : 0)));
    }
    if (world && S.bubbles) for (const b of S.bubbles) {
      if (b.x !== p.cx || b.y !== p.cy) continue;
      const s = toScreen(b.x, b.y, 2.9 + b.t * 0.6);
      ctx.globalAlpha = b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.4) : 1;
      drawText(ctx, b.text, s.x, s.y, { color: b.col, align: 'center', outline: '#000' });
      ctx.globalAlpha = 1;
    }
  },
});

// =====================================================================================================
// PROPS
// =====================================================================================================

// Midden: the brick bin shelter in the back court (w 2). Flat roof you can jump onto (h 1.1).
registerProp('ibrox_midden', {
  w: 2, d: 1, h: 1.1,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 1.9, 0.9, 1.05, { top: '#5a4a48', left: '#7a3e32', right: '#5a2c24', outline: OL });
    // three openings with bins inside
    for (let i = 0; i < 3; i++) {
      isoPanel(ctx, ax, ay, 'left', 0.18 + i * 0.6, 0.96, 0.44, 0, 0.8, '#140e10');
      isoBox(ctx, ax, ay, 0.22 + i * 0.6, 0.55, 0, 0.36, 0.36, 0.6, { top: '#3a4a3a', left: '#2a3a2a', right: '#1e2a1e' });
    }
    // roof slab + bin bag on top
    isoBox(ctx, ax, ay, 0, 0, 1.05, 2, 1, 0.08, { top: '#6a6a70', left: '#4a4a52', right: '#3a3a40', outline: OL });
    const b = proj(ax, ay, 1.6, 0.4, 1.13);
    ellipse(ctx, b.x, b.y - 3, 5, 4, OL); ellipse(ctx, b.x, b.y - 3, 4, 3, '#1a1a1e');
  },
});

// Washing pole with a line running o.len tiles along x, clothes flapping in the wind (and the rain).
const CLOTHES = [ROYAL, WHITE, '#c8b890', RED, '#6a8aa8', '#e8e0c8', '#3a3a40'];
registerProp('ibrox_washpole', {
  h: 0, solid: false,
  draw(ctx, ax, ay, p, t) {
    const len = p.o.len || 3;
    const b0 = proj(ax, ay, 0.5, 0.5, 0), t0 = proj(ax, ay, 0.5, 0.5, 2.4);
    const b1 = proj(ax, ay, 0.5 + len, 0.5, 0), t1 = proj(ax, ay, 0.5 + len, 0.5, 2.4);
    for (const [b, tt] of [[b0, t0], [b1, t1]]) { thick(ctx, b.x, b.y, tt.x, tt.y, 3, OL); thick(ctx, b.x, b.y, tt.x, tt.y, 1, '#8a8a90'); }
    const N = Math.round(len * 3);
    for (let i = 0; i <= N; i++) {
      const k = i / N, sag = Math.sin(k * Math.PI) * 5;
      const x = t0.x + (t1.x - t0.x) * k, y = t0.y + (t1.y - t0.y) * k + sag;
      ctx.fillStyle = '#d8d8d0'; ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
      if (i > 0 && i < N && hash2(p.x + i, p.y, 481) < 0.75) {
        const c = CLOTHES[Math.floor(hash2(p.x * 7 + i, p.y, 482) * CLOTHES.length)];
        const sw = Math.round(Math.sin(t * 6 + i * 1.3) * 2 - 2);
        const h = 6 + Math.floor(hash2(i, p.y, 483) * 5);
        ctx.fillStyle = OL; ctx.fillRect(Math.round(x) - 3 + sw, Math.round(y), 7, h + 1);
        ctx.fillStyle = c; ctx.fillRect(Math.round(x) - 2 + sw, Math.round(y), 5, h);
      }
    }
  },
});

// Subway ticket office (w 2): glass booth, orange trim, a sleepy clerk light.
registerProp('ibrox_ticketOffice', {
  w: 2, d: 1, h: 1.8,
  light: { z: 1.4, r: 2.6, color: '#ffe0a8', intensity: 0.6 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, 1.9, 0.8, 0.9, { top: '#5a4a40', left: SUB, right: shade(SUB, -0.3), outline: OL });
    isoBox(ctx, ax, ay, 0.05, 0.1, 0.9, 1.9, 0.8, 0.9, { top: '#3a3a40', left: '#a8c8d8', right: '#7898a8', outline: OL });
    isoBox(ctx, ax, ay, 0, 0.05, 1.8, 2, 0.9, 0.15, { top: '#e8e0c8', left: '#c8bca0', right: '#9a8e78', outline: OL });
    const m = proj(ax, ay, 1, 0.95, 1.95);
    drawText(ctx, 'TICKETS', m.x, m.y - 4, { color: SUB, align: 'center' });
  },
});

// Turnstile set into the Main Stand facade: passable, blue lintel, spinning arms.
registerProp('ibrox_turnstile', {
  h: 0, solid: false,
  draw(ctx, ax, ay, p, t, world) {
    isoBox(ctx, ax, ay, 0, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a5a62', outline: OL });
    isoBox(ctx, ax, ay, 0.88, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a5a62', outline: OL });
    isoBox(ctx, ax, ay, 0, 0, 1.9, 1, 1, 0.3, { top: '#16306a', left: ROYAL, right: shade(ROYAL, -0.3), outline: OL });
    let spin = 0;
    if (world) for (const f of world.fighters) if (Math.abs(f.x - p.cx) < 0.8 && Math.abs(f.y - p.cy) < 0.8) spin = 1;
    p.ang = (p.ang || 0) + spin * 0.12;
    const hub = proj(ax, ay, 0.3, 0.5, 0.9);
    ctx.fillStyle = OL; ctx.fillRect(hub.x - 3, hub.y - 3, 6, 10);
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(hub.x - 2, hub.y - 2, 4, 8);
    for (let i = 0; i < 3; i++) {
      const a = p.ang + i * 2.094;
      const e = proj(ax, ay, 0.3 + Math.cos(a) * 0.45, 0.5 + Math.sin(a) * 0.45, 0.9);
      thick(ctx, hub.x, hub.y, e.x, e.y, 3, OL); thick(ctx, hub.x, hub.y, e.x, e.y, 1, '#d8dce0');
    }
    const m = proj(ax, ay, 0.5, 1.0, 2.05);
    drawText(ctx, p.o.text || 'IN', m.x - 4, m.y - 3, { color: '#ffffff' });
  },
});

// Fryer range (w 5): stainless steel, bubbling baskets; spits fat when fryerSpitting() (pair with a hazard zone).
registerProp('ibrox_fryer', {
  w: 5, d: 1, h: 1.0,
  light: { z: 1.2, r: 3.2, color: '#ffc070', intensity: 0.75 },
  update(p, world, dt) {
    const on = fryerSpitting(world.time, p.o.phase || 0);
    if (on && Math.random() < dt * 14) world.fx.add({ x: p.x + 0.5 + Math.random() * 4, y: p.y + 0.9, z: 1.05, vx: (Math.random() - 0.5) * 1.5, vy: 1.5 + Math.random() * 2, vz: 3 + Math.random() * 2, g: 1, life: 0.5, kind: 'px', color: Math.random() < 0.5 ? '#ffe080' : '#ffb040', size: 1 });
    if (Math.random() < dt * 4) world.fx.add({ x: p.x + 0.5 + Math.random() * 4, y: p.y + 0.5, z: 1.2, vx: 0, vy: 0, vz: 0.8, g: 0, life: 1.4, kind: 'puff', color: '#d8d8d8', size: 3 });
  },
  draw(ctx, ax, ay, p, t, world) {
    isoBox(ctx, ax, ay, 0.02, 0.1, 0, 4.96, 0.85, 0.95, { top: '#9aa0a8', left: '#c8ccd4', right: '#8a9098', outline: OL });
    for (let i = 0; i < 4; i++) {
      const c = proj(ax, ay, 0.7 + i * 1.2, 0.5, 0.95);
      ellipse(ctx, c.x, c.y, 9, 4, OL);
      ellipse(ctx, c.x, c.y, 8, 3, '#c89838');
      const bub = Math.floor(t * 9 + i * 3) % 4;
      ctx.fillStyle = '#ffe8a0'; ctx.fillRect(c.x - 4 + bub * 2, c.y - 1, 2, 1); ctx.fillRect(c.x + 3 - bub, c.y, 1, 1);
      // basket handle
      const h0 = proj(ax, ay, 0.7 + i * 1.2, 0.85, 1.0);
      thick(ctx, c.x, c.y, h0.x, h0.y - 4, 1, '#3a3a40');
    }
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.96, 4.6, 0.3, 0.5, RED);
    if (world && fryerSpitting(world.time, p.o.phase || 0)) {
      const m = proj(ax, ay, 2.5, 0.9, 1.6);
      drawText(ctx, 'SPIT!', m.x, m.y - 6 + Math.round(Math.sin(t * 20)), { color: '#ffb040', align: 'center', outline: OL });
    }
  },
});

// Chippy counter (w 4): heated glass cabinet of pies and fritters (h 1.0, jump on top).
registerProp('ibrox_counter', {
  w: 4, d: 1, h: 1.0,
  light: { z: 1.0, r: 2.4, color: '#fff0c0', intensity: 0.5 },
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.02, 0.15, 0, 3.96, 0.75, 0.6, { top: '#c8c4bc', left: '#e8e4d8', right: '#a8a49c', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.02, 0.91, 3.96, 0.2, 0.32, ROYAL);
    isoBox(ctx, ax, ay, 0.1, 0.2, 0.6, 3.8, 0.6, 0.4, { top: 'rgba(200,230,240,0.35)', left: 'rgba(220,240,250,0.3)', right: 'rgba(160,190,210,0.3)', outline: OL });
    for (let i = 0; i < 6; i++) { const s = proj(ax, ay, 0.4 + i * 0.6, 0.5, 0.62); ctx.fillStyle = OL; ctx.fillRect(s.x - 3, s.y - 3, 7, 4); ctx.fillStyle = i % 2 ? '#c8862e' : '#e8b048'; ctx.fillRect(s.x - 2, s.y - 2, 5, 2); }
    const till = proj(ax, ay, 3.6, 0.4, 1.0);
    ctx.fillStyle = OL; ctx.fillRect(till.x - 4, till.y - 7, 9, 7); ctx.fillStyle = '#3a3a40'; ctx.fillRect(till.x - 3, till.y - 6, 7, 5); ctx.fillStyle = '#7aff9a'; ctx.fillRect(till.x - 2, till.y - 5, 4, 1);
  },
});

// Chest freezer (breakable; the level gives it a secret).
registerProp('ibrox_freezer', {
  h: 0.9,
  breakable: { hp: 26, debris: ['#e8e8e4', '#9aa0a8', '#c8e8f0'], sfx: 'metal', drops: [['ibrox_chips', 0.8], ['cash5', 0.5]], score: 80 },
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.06, 0.12, 0, 0.88, 0.76, 0.85, { top: '#f0f0ec', left: '#e0e0dc', right: '#b8b8b4', outline: OL });
    isoBox(ctx, ax, ay, 0.04, 0.1, 0.85, 0.92, 0.8, 0.06, { color: '#d0d0cc', outline: OL });
    const m = proj(ax, ay, 0.5, 0.88, 0.5);
    drawText(ctx, 'ICE', m.x - 6, m.y - 3, { color: '#3a8ac8' });
  },
});

// Row of blue tip-up seats in the Broomloan stand (breakable -> plastic seat weapon).
registerProp('ibrox_seats', {
  h: 0.5,
  breakable: { hp: 8, debris: [ROYAL, '#1a1a1a'], sfx: 'clatter', drops: [['ibrox_seat', 1]], score: 20 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || ROYAL;
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, 0.9, 0.8, 0.15, { color: '#3a3a40' });
    for (let i = 0; i < 2; i++) {
      isoBox(ctx, ax, ay, 0.1 + i * 0.45, 0.25, 0.25, 0.38, 0.45, 0.08, { color: c, outline: OL });
      isoBox(ctx, ax, ay, 0.1 + i * 0.45, 0.2, 0.33, 0.38, 0.07, 0.35, { color: shade(c, -0.1), outline: OL });
    }
  },
});

// Our overnight coach (w 4), steamed-up windows.
registerProp('ibrox_coach', {
  w: 4, d: 1, h: 1.9,
  light: { z: 1, r: 3, color: '#fff0c0', intensity: 0.5 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#e8e4dc', c2 = p.o.trim || '#6a2a8a';
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.15); ellipse(ctx, s.x, s.y, 4, 4, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 2, '#6a6a70'); };
    wh(0.6, 0.95); wh(3.3, 0.95);
    isoBox(ctx, ax, ay, 0.04, 0.06, 0.15, 3.92, 0.88, 1.8, { top: shade(c, -0.1), left: c, right: shade(c, -0.3), outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.94, 3.6, 1.05, 1.6, '#3a4250');
    for (let i = 0; i < 6; i++) isoPanel(ctx, ax, ay, 'left', 0.25 + i * 0.6, 0.94, 0.5, 1.1, 1.55, i % 2 ? '#8a98a8' : '#7a8898');   // steamed up
    isoPanel(ctx, ax, ay, 'left', 0.04, 0.94, 3.92, 0.5, 0.78, c2);
    isoPanel(ctx, ax, ay, 'right', 3.96, 0.1, 0.8, 0.95, 1.65, '#4a6a88');
    if (p.o.text) {
      const m = proj(ax, ay, 2, 0.95, 0.64);
      ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, 0.5, 0, 1, 0, 0);
      drawText(ctx, p.o.text, 0, -3, { color: '#ffffff', align: 'center' });
      ctx.restore();
    }
  },
});

// Trophy cabinet (w 2) against the panelling: glass shelves of glinting (invented) silverware.
registerProp('ibrox_trophies', {
  w: 2, d: 1, h: 1.7,
  light: { z: 1.4, r: 2.4, color: '#fff4d0', intensity: 0.6 },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, 1.9, 0.7, 1.75, { top: '#5a3a22', left: '#6a4228', right: '#4a2e1c', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.12, 0.81, 1.76, 0.12, 1.65, '#1a1820');
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
      const s = proj(ax, ay, 0.3 + i * 0.45, 0.6, 0.2 + r * 0.52);
      const glint = Math.floor(t * 2 + i + r * 2) % 7 === 0;
      ctx.fillStyle = OL; ctx.fillRect(s.x - 3, s.y - 9, 7, 10);
      ctx.fillStyle = glint ? '#ffffff' : ((i + r) % 3 ? '#d8d8e0' : '#e8c860');
      ctx.fillRect(s.x - 2, s.y - 8, 5, 3); ctx.fillRect(s.x - 1, s.y - 5, 3, 3); ctx.fillRect(s.x - 2, s.y - 2, 5, 2);
    }
    isoPanel(ctx, ax, ay, 'left', 0.12, 0.82, 1.76, 0.12, 1.65, 'rgba(200,230,255,0.12)');
  },
});

// The marble staircase (w 3, d 2): decorative steps with brass rails (h 0.3, walk on it).
registerProp('ibrox_staircase', {
  w: 3, d: 2, h: 0.3,
  draw(ctx, ax, ay) {
    for (let i = 0; i < 5; i++) {
      const y0 = 1.6 - i * 0.32;
      isoBox(ctx, ax, ay, 0.2, Math.max(0, y0 - 0.32), 0, 2.6, 0.34 + (i === 4 ? 0.3 : 0), 0.06 + i * 0.06, { top: i % 2 ? '#e8e0cc' : '#d8d0bc', left: '#b8ae98', right: '#988e78', outline: OL });
    }
    isoBox(ctx, ax, ay, 0.8, 0.05, 0.36, 1.4, 1.95, 0.02, { color: '#8a1a24' });     // red runner
    for (const x of [0.15, 2.85]) {
      const a = proj(ax, ay, x, 1.95, 0.9), b = proj(ax, ay, x, 0.05, 1.3);
      thick(ctx, a.x, a.y, b.x, b.y, 3, OL); thick(ctx, a.x, a.y, b.x, b.y, 1, '#e8c860');
      const a0 = proj(ax, ay, x, 1.95, 0);
      thick(ctx, a0.x, a0.y, a.x, a.y, 2, '#c8a040');
    }
  },
});

// Hanging pub sign on a bracket (decor). opts: text, a (board colour)
registerProp('ibrox_pubSign', {
  h: 0, solid: false, depthBias: 0.05,
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.15, 2.6), e = proj(ax, ay, 0.5, 0.95, 2.6);
    thick(ctx, b.x, b.y, e.x, e.y, 2, '#1a1a1e');
    const sw = Math.round(Math.sin(t * 2.5 + p.x) * 1.5);
    const bx = e.x + sw, by = e.y + 2;
    ctx.fillStyle = OL; ctx.fillRect(bx - 13, by, 27, 14);
    ctx.fillStyle = p.o.a || '#1a3a2a'; ctx.fillRect(bx - 12, by + 1, 25, 12);
    ctx.fillStyle = '#c8a050'; ctx.fillRect(bx - 12, by + 1, 25, 1);
    drawText(ctx, p.o.text || 'BAR', bx, by + 4, { color: '#e8c860', align: 'center' });
  },
});

// Steaming manhole / drain with the rain bouncing off it (decor).
registerProp('ibrox_drain', {
  h: 0, solid: false, depthBias: -0.4,
  draw(ctx, ax, ay, p, t) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    ellipse(ctx, s.x, s.y, 8, 4, '#1a1a1e');
    ctx.fillStyle = '#3a3a40'; for (let i = -6; i <= 6; i += 3) ctx.fillRect(s.x + i, s.y - 2, 1, 4);
    for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = '#d8d8e0'; ctx.fillRect(Math.round(s.x - 3 + i * 3 + Math.sin(t + i) * 2), Math.round(s.y - 4 - k * 16), 3, 3); }
    ctx.globalAlpha = 1;
  },
});

// =====================================================================================================
// THE WEE ORANGE TRAIN — custom draw for the Subway traffic hazard (one actor per 1-tile slice for sorting)
// =====================================================================================================
export function spawnSubwayTrain(world, v) {
  const def = v.def, N = Math.round((def.halfLen ?? 3.5) * 2), half = def.halfWidth ?? 0.62, ly = v.y;
  const clip = def.clip || [-1e9, 1e9];
  for (let i = 0; i < N; i++) {
    const off = (i - (N - 1) / 2);
    world.addActor({
      x: v.x, y: ly, removed: false,
      update() { if (v.removed) this.removed = true; this.x = v.x + v.dx * off; },
      depth() { return this.x + ly + 0.05; },
      draw(ctx) {
        const cx = v.x + v.dx * off;
        const x0 = Math.max(cx - 0.5, clip[0]), x1 = Math.min(cx + 0.5, clip[1]);
        if (x1 - x0 <= 0.01) return;
        const a = toScreen(x0, ly - half, 0), W = x1 - x0, D = half * 2;
        const idx = v.dx > 0 ? N - 1 - i : i;               // 0 = front
        const front = idx === 0, back = idx === N - 1, pos = idx % 3;
        isoBox(ctx, a.x, a.y, 0, 0.1, 0, W, D - 0.2, 0.2, { top: '#1a1a1e', left: '#0e0e10', right: '#0a0a0c' });
        isoBox(ctx, a.x, a.y, 0, 0, 0.2, W, D, 1.45, { top: '#9aa0a8', left: SUB, right: shade(SUB, -0.32) });
        isoBox(ctx, a.x, a.y, 0, 0.1, 1.65, W, D - 0.2, 0.1, { top: '#b8bcc4', left: '#8a8e96', right: '#6a6e76' });
        isoPanel(ctx, a.x, a.y, 'left', 0, D, W, 0.35, 0.42, '#f4ecd8');
        if (pos === 1 && !front && !back) {
          isoPanel(ctx, a.x, a.y, 'left', Math.max(0, cx - 0.35 - x0), D, Math.min(W, 0.7), 0.25, 1.5, '#d8d0b8');
          isoPanel(ctx, a.x, a.y, 'left', Math.max(0, cx - 0.3 - x0), D, Math.min(W, 0.25), 0.8, 1.35, '#1a2228');
          isoPanel(ctx, a.x, a.y, 'left', Math.max(0, cx + 0.05 - x0), D, Math.min(W, 0.25), 0.8, 1.35, '#1a2228');
        } else {
          isoPanel(ctx, a.x, a.y, 'left', 0.06, D, Math.max(0, W - 0.12), 0.75, 1.4, '#1a2228');
          isoPanel(ctx, a.x, a.y, 'left', 0.1, D, Math.max(0, W - 0.2), 0.8, 1.36, (i + Math.floor(v.x)) % 3 ? '#e8d890' : '#c8b870');
          if ((i * 5) % 3 !== 0) { const hp = toScreen(cx, ly + half, 1.08); ctx.fillStyle = '#3a3020'; ctx.fillRect(Math.round(hp.x) - 2, Math.round(hp.y) - 2, 4, 6); ctx.fillRect(Math.round(hp.x) - 1, Math.round(hp.y) - 5, 3, 3); }
        }
        if (front) {
          const fx = v.dx > 0 ? x1 : x0;
          const hl = toScreen(fx, ly + half * 0.5, 0.55);
          ctx.fillStyle = '#fff8d0'; ctx.fillRect(Math.round(hl.x) - 1, Math.round(hl.y) - 1, 3, 2);
          world.addFrameLight({ x: fx + v.dx * 1.5, y: ly, z: 0.6, r: 4, color: '#fff4d0', intensity: 0.9 });
          const hb = toScreen(cx, ly + half, 1.62);
          drawText(ctx, 'INNER', Math.round(hb.x), Math.round(hb.y) - 7, { color: '#ffe8a0', align: 'center', outline: OL });
        }
      },
    });
  }
}

// =====================================================================================================
// SKYLINE + WEATHER (level drawGround / drawOverlay helpers)
// =====================================================================================================
// The Govan shipyard cranes on the skyline north of the map (drawn in world space under the walls).
const CRANES = [{ x: 4, y: -14, h: 15, arm: 9 }, { x: 22, y: -16, h: 17, arm: 11 }, { x: 40, y: -13, h: 14, arm: 8 }, { x: 58, y: -15, h: 16, arm: 10 }];
export function drawCranes(ctx, world) {
  const t = world.time;
  ctx.save();
  for (const c of CRANES) {
    const b = toScreen(c.x, c.y, 0), top = toScreen(c.x, c.y, c.h);
    const col = '#1c2230', hi = '#2a3244';
    // lattice legs
    for (const dx of [-7, 7]) { thick(ctx, b.x + dx, b.y, top.x + dx * 0.4, top.y + 10, 3, col); }
    for (let i = 0; i < 14; i++) { const k0 = i / 14, k1 = (i + 1) / 14; const y0 = b.y + (top.y + 10 - b.y) * k0, y1 = b.y + (top.y + 10 - b.y) * k1; line(ctx, b.x - 7 + 4.2 * k0, y0, b.x + 7 - 4.2 * k1, y1, hi); }
    // jib and counter-jib
    const j0 = { x: top.x - c.arm * 6, y: top.y + c.arm * 1.5 }, j1 = { x: top.x + c.arm * 9, y: top.y - c.arm * 2 };
    thick(ctx, j0.x, j0.y, j1.x, j1.y, 4, col);
    line(ctx, j0.x, j0.y - 2, j1.x, j1.y - 2, hi);
    ctx.fillStyle = col; ctx.fillRect(Math.round(top.x) - 8, Math.round(top.y) - 4, 16, 12);
    // hook cable
    const hk = { x: j1.x - 20, y: j1.y + 6 };
    line(ctx, hk.x, hk.y, hk.x, hk.y + 40 + Math.sin(t * 0.7 + c.x) * 3, '#141820');
    // aircraft warning light
    if (Math.floor(t * 1.2 + c.x) % 2 === 0) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(Math.round(j1.x) - 1, Math.round(j1.y) - 2, 3, 3); }
  }
  ctx.restore();
}

// Horizontal Glasgow rain: gust streaks blowing across the screen around the player (world space).
export function drawGust(ctx, world, strength) {
  if (strength <= 0) return;
  const p = world.player;
  if (!p) return;
  const c = toScreen(p.x, p.y, 0);
  const t = world.time;
  ctx.save();
  ctx.globalAlpha = 0.35 * strength;
  ctx.strokeStyle = '#b8c8e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const r1 = hash2(i, 7, 501), r2 = hash2(i, 9, 502);
    const x = c.x - 360 + ((r1 * 720 + t * (520 + r2 * 200)) % 720);
    const y = c.y - 220 + r2 * 300 + Math.sin(t * 3 + i) * 3;
    ctx.moveTo(Math.round(x), Math.round(y));
    ctx.lineTo(Math.round(x - 26 - r1 * 16), Math.round(y - 5));
  }
  ctx.stroke();
  ctx.restore();
}

// =====================================================================================================
// ITEMS
// =====================================================================================================
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

registerItem('ibrox_chips', {
  name: 'POKE OF CHIPS', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 5, y - 10, 11, 10);
    px(ctx, '#f0ece0', x - 4, y - 9, 9, 8);
    for (let i = 0; i < 5; i++) px(ctx, '#e8c050', x - 3 + i * 2, y - 12 + (i % 2), 1, 4);
    px(ctx, RED, x - 4, y - 5, 9, 1);
    px(ctx, 'rgba(255,255,255,0.6)', x - 1 + Math.round(Math.sin(t * 5)), y - 15 - Math.round((t * 1.5) % 1 * 3), 1, 2);
  },
});
registerItem('ibrox_ginger', {
  name: 'CAN OF GINGER', kind: 'heal', heal: 15, score: 30, stash: true, auto: true,
  icon(ctx, x, y) {
    px(ctx, OL, x - 4, y - 12, 8, 12);
    px(ctx, '#e87a20', x - 3, y - 11, 6, 10);
    px(ctx, ROYAL, x - 3, y - 7, 6, 3);
    px(ctx, '#c8c8d0', x - 3, y - 11, 6, 1);
  },
});
registerItem('ibrox_munchy', {
  name: 'MUNCHY BOX', kind: 'heal', heal: 55, score: 80, stash: true, auto: true,
  icon(ctx, x, y) {
    px(ctx, OL, x - 7, y - 10, 14, 10);
    px(ctx, '#f0ece0', x - 6, y - 9, 12, 8);
    px(ctx, '#e8c050', x - 5, y - 11, 4, 3); px(ctx, '#a8582a', x - 1, y - 12, 4, 4); px(ctx, '#d8402a', x + 3, y - 11, 3, 3);
    px(ctx, '#7a9a3a', x, y - 9, 2, 1);
  },
});
// A fish supper in newspaper. Pick it up and it's lunch... the boss throws them (a weapon you can throw back).
registerItem('ibrox_supper', {
  name: 'FISH SUPPER', kind: 'weapon', score: 0,
  weapon: { dmg: 6, reach: 1.1, durability: 1, attack: 'swing', throwDmg: 13, breaks: 'paper' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 7, y - 8, 14, 8);
    px(ctx, '#e8e4d0', x - 6, y - 7, 12, 6);
    px(ctx, '#8a8a80', x - 5, y - 6, 4, 1); px(ctx, '#8a8a80', x, y - 4, 5, 1);
    px(ctx, '#e8b048', x - 2, y - 9, 6, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.cos(ang) * 4, dy = Math.sin(ang) * 2;
    fillPoly(ctx, [{ x: hx - 6 + dx, y: hy - 3 }, { x: hx + 6 + dx, y: hy - 3 + dy }, { x: hx + 6 - dx, y: hy + 3 }, { x: hx - 6 - dx, y: hy + 3 - dy }], OL);
    fillPoly(ctx, [{ x: hx - 5 + dx, y: hy - 2 }, { x: hx + 5 + dx, y: hy - 2 + dy }, { x: hx + 5 - dx, y: hy + 2 }, { x: hx - 5 - dx, y: hy + 2 - dy }], flash ? '#ffffff' : '#e8e4d0');
    px(ctx, '#e8b048', hx - 1, hy - 4, 4, 2);
  },
});
registerItem('ibrox_seat', {
  name: 'PLASTIC SEAT', kind: 'weapon', score: 0,
  weapon: { dmg: 11, reach: 1.3, durability: 3, attack: 'swing', knockdown: true, throwDmg: 13, breaks: 'plastic' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 6, y - 12, 12, 12);
    px(ctx, ROYAL, x - 5, y - 11, 10, 6);
    px(ctx, '#16306a', x - 5, y - 5, 10, 3);
    px(ctx, '#3a3a40', x - 4, y - 2, 2, 2); px(ctx, '#3a3a40', x + 2, y - 2, 2, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 7 * s, ey = hy + dy * 7 * s;
    thick(ctx, hx, hy, ex, ey, 3, OL);
    const pxv = -dy, pyv = dx;
    fillPoly(ctx, [{ x: ex - pxv * 6, y: ey - pyv * 6 }, { x: ex + pxv * 6, y: ey + pyv * 6 }, { x: ex + pxv * 6 + dx * 6, y: ey + pyv * 6 + dy * 6 }, { x: ex - pxv * 6 + dx * 6, y: ey - pyv * 6 + dy * 6 }], OL);
    fillPoly(ctx, [{ x: ex - pxv * 5, y: ey - pyv * 5 }, { x: ex + pxv * 5, y: ey + pyv * 5 }, { x: ex + pxv * 5 + dx * 5, y: ey + pyv * 5 + dy * 5 }, { x: ex - pxv * 5 + dx * 5, y: ey - pyv * 5 + dy * 5 }], flash ? '#ffffff' : ROYAL);
  },
});

// pre-render the static props once (per option key) — the per-frame cost is one drawImage
const SPR = new Map();
function cacheStatic(id, keyFn = () => '') {
  const def = PROPS[id], raw = def.draw;
  const H = Math.max(def.h, 2.5) + 1.2;
  def.draw = (ctx, ax, ay, p) => {
    const ox = p.d * 16 + 16, oy = Math.round(H * 20 + 16);
    const key = id + '|' + p.w + 'x' + p.d + '|' + keyFn(p.o);
    let c = SPR.get(key);
    if (!c) { c = makeCanvas((p.w + p.d) * 16 + 32, (p.w + p.d) * 8 + oy + 24); raw(c.getContext('2d'), ox, oy, p, 0, null); SPR.set(key, c); }
    ctx.drawImage(c, ax - ox, ay - oy);
  };
}
cacheStatic('ibrox_midden');
cacheStatic('ibrox_ticketOffice');
cacheStatic('ibrox_counter');
cacheStatic('ibrox_freezer');
cacheStatic('ibrox_seats', o => o.color || '');
cacheStatic('ibrox_coach', o => [o.color, o.trim, o.text].join(','));
cacheStatic('ibrox_staircase');

export { Z_PX };
