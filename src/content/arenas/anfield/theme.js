// TOUR ARENA THEME: ANFIELD (Liverpool L4) — Stanley Park, the terraced streets and their jiggers, Walton Breck Road,
// the Shankly Gates and the old standing Kop. Floors, walls, props, items and the KOP SURGE actor used by the boss.
// Every id registered here starts with 'anfield_'.

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
import { brickFace, vnoise } from '../../themes/common.js';

export const LFC = { red: '#c8102e', yel: '#f6eb61', white: '#f4f1e8', dark: '#7a0a1c' };
const RED = LFC.red, YEL = LFC.yel, WHITE = LFC.white;
const OL = '#120c14';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const pick = (pal, k) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(k)))];
const dk = (c, side) => (side === 'right' ? shade(c, -0.3) : c);

// =====================================================================================================
// FLOORS
// =====================================================================================================

// Stanley Park lawn: damp grass, fallen leaves, worm casts.
const LAWN = ['#22401e', '#2a4a22', '#315426', '#385c2a', '#426832', '#4e763a'];
registerFloor('anfield_grass', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const sx = Math.floor((X - Y) * 16), sy = Math.floor((X + Y) * 8);
    let k = 2.2 + (vnoise(X * 0.9, Y * 0.9, 301) - 0.5) * 2.6;
    const b = hash2(sx, sy >> 1, 302);
    if (b > 0.82) k += 1.3; else if (b < 0.14) k -= 1.1;
    const leaf = hash2(Math.floor(X * 9), Math.floor(Y * 9), 303);
    if (leaf > 0.985) return leaf > 0.993 ? '#b8602a' : '#d8a040';     // autumn leaves
    if (vnoise(X * 0.5, Y * 0.5, 304) > 0.8 && b < 0.4) return '#3a3424'; // muddy patch
    return pick(LAWN, k);
  },
});

// Park path: old grey tarmac with gravel edges and puddles.
registerFloor('anfield_path', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const n = n2(X * 24, Y * 24, 311);
    if (vnoise(X * 0.6, Y * 0.6, 312) > 0.74) return n < 0.5 ? '#2a3240' : (n > 0.93 ? '#5a6a84' : '#323a4a'); // puddle
    let c = n < 0.3 ? '#55525a' : n < 0.7 ? '#5d5a62' : '#66636a';
    if (n > 0.97) c = '#8a8680';
    if (n < 0.04) c = '#3e3c44';
    return c;
  },
});

// The Victorian bridge deck: sandstone setts running across, worn in the middle.
registerFloor('anfield_bridge', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const row = Math.floor(Y * 3), fv = (Y * 3) % 1;
    const fu = (X * 2 + (row % 2) * 0.5) % 1;
    if (fv < 0.1 || fu < 0.06) return '#5a4a3a';
    const s = hash2(Math.floor(X * 2 + (row % 2) * 0.5), row, 313);
    let c = s < 0.3 ? '#a08a68' : s < 0.7 ? '#ad9672' : '#9a8460';
    if (fv < 0.22) c = shade(c, 0.1);
    if (Math.abs(u - 0.5) < 0.3 && n2(X * 24, Y * 24, 314) < 0.3) c = shade(c, -0.08);   // worn track
    return c;
  },
});

// Jigger (back alley): blue-grey setts with a centre drainage channel along the alley direction.
const SETT = ['#3c3c46', '#44444e', '#4c4c56', '#55555e', '#5e5e68'];
function settPix(X, Y, seed) {
  const row = Math.floor(Y * 4), off = (row % 2) * 0.5;
  const fu = (X * 4 + off) % 1, fv = (Y * 4) % 1;
  if (fu < 0.1 || fv < 0.12) return '#22222a';
  const s = hash2(Math.floor(X * 4 + off), row, seed);
  let k = 1.5 + s * 2;
  if (fu < 0.3 && fv < 0.4) k += 1; else if (fu > 0.8 || fv > 0.8) k -= 1;
  if (fu > 0.22 && fu < 0.34 && fv > 0.2 && fv < 0.32) return '#7a7a86';   // wet glint
  return pick(SETT, k);
}
registerFloor('anfield_jigger', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    // channel: the alleys run along y at x 9..11 (top band) and along x at y 61..62 (exit jigger)
    const along = ty >= 60 ? Math.abs(Y - 62) : Math.abs(X - 10.5);
    if (along < 0.12) return along < 0.05 ? '#1a1c22' : '#2e3038';
    if (n2(X * 16, Y * 16, 315) > 0.992) return '#c8c0a0';     // crisp packet
    return settPix(X, Y, 316);
  },
});

// Back yard: big cracked flagstones, moss in the joints.
registerFloor('anfield_yard', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const gu = (X * 1.5) % 1, gv = (Y * 1.5) % 1;
    if (gu < 0.05 || gv < 0.05) return n2(X * 20, Y * 20, 317) < 0.4 ? '#2e4426' : '#34323a';
    const s = hash2(Math.floor(X * 1.5), Math.floor(Y * 1.5), 318);
    let c = s < 0.33 ? '#6a6670' : s < 0.66 ? '#625e68' : '#716d76';
    const n = n2(X * 24, Y * 24, 319);
    if (n < 0.06) c = shade(c, -0.15);
    if (s > 0.85 && Math.abs(gu - gv * 0.8 - 0.1) < 0.03) return '#3a3840';
    return c;
  },
});

// Concourse: grey concrete with a red painted walkway band.
registerFloor('anfield_concourse', {
  pixel(u, v, tx, ty, r) {
    const X = tx + u, Y = ty + v;
    if ((Y % 4) > 0.2 && (Y % 4) < 0.3) return '#8a1424';
    if (u < 0.03 || v < 0.03) return '#46444c';
    const n = n2(X * 32, Y * 32, 321);
    let c = r < 0.4 ? '#625f68' : '#5c5a62';
    if (n < 0.06) c = shade(c, -0.14);
    else if (n > 0.98) c = '#d8d0c0';
    return c;
  },
  decal(g, sx, sy, tx, ty, r) {
    if (r < 0.1) { g.fillStyle = '#e8e4d8'; g.fillRect(sx - 3 + Math.round(r * 50) % 6, sy + 7, 4, 2); g.fillStyle = RED; g.fillRect(sx - 3 + Math.round(r * 50) % 6, sy + 7, 4, 1); }
  },
});

// Running track around the pitch: red cinders.
registerFloor('anfield_track', {
  pixel(u, v, tx, ty) {
    const n = n2((tx + u) * 32, (ty + v) * 32, 322);
    if (n < 0.08) return '#4e2620';
    if (n > 0.93) return '#a85a46';
    if (n > 0.78) return '#8e4636';
    return '#7c3a2e';
  },
});

// Terrace floor (under the steps, flat terraces): stepped concrete, white step lips, ticket stubs.
registerFloor('anfield_terrace', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const step = (u * 2) % 1;            // steps run along y (rows of fans face +x / -x)
    if (step < 0.1) return '#2e2e36';
    if (step < 0.18) return '#a8a8ae';
    const n = n2(X * 32, Y * 32, 323);
    if (n < 0.04) return '#24242a';
    if (n > 0.986) return Math.floor(Y * 7) % 2 ? RED : '#e8e4d8';
    return n < 0.22 ? '#57565e' : '#5f5e66';
  },
});

// The pitch: mown stripes across, full markings from absolute coordinates, muddy goalmouths.
// Pitch rectangle: goal lines x 14.5 (Kop end) / 49.5 (Anfield Road end), touchlines y 33.5 / 58.5.
export const PITCH = { x0: 14.5, x1: 49.5, y0: 33.5, y1: 58.5, cx: 32, cy: 46, box: 6, boxY0: 39.5, boxY1: 52.5, six: 2, sixY0: 43, sixY1: 49, spot: 4, arc: 3.4, cr: 3.6 };
const LINE = '#eef2e6';
function pitchLine(X, Y) {
  const P = PITCH, w = 0.065;
  const inY = Y >= P.y0 - w && Y <= P.y1 + w, inX = X >= P.x0 - w && X <= P.x1 + w;
  if (!inX || !inY) return false;
  if (Math.abs(Y - P.y0) < w || Math.abs(Y - P.y1) < w) return true;                          // touchlines
  if (Math.abs(X - P.x0) < w || Math.abs(X - P.x1) < w || Math.abs(X - P.cx) < w) return true; // goal lines + halfway
  for (const [gx, s] of [[P.x0, 1], [P.x1, -1]]) {
    const bx = gx + s * P.box, sx6 = gx + s * P.six;
    const inBoxX = s > 0 ? X <= bx + w : X >= bx - w;
    if (Math.abs(X - bx) < w && Y >= P.boxY0 && Y <= P.boxY1) return true;
    if ((Math.abs(Y - P.boxY0) < w || Math.abs(Y - P.boxY1) < w) && inBoxX && (s > 0 ? X >= gx : X <= gx)) return true;
    const in6 = s > 0 ? X <= sx6 + w && X >= gx : X >= sx6 - w && X <= gx;
    if (Math.abs(X - sx6) < w && Y >= P.sixY0 && Y <= P.sixY1) return true;
    if ((Math.abs(Y - P.sixY0) < w || Math.abs(Y - P.sixY1) < w) && in6) return true;
    const spx = gx + s * P.spot, ds = Math.hypot(X - spx, Y - P.cy);
    if (ds < 0.14) return true;
    if (Math.abs(ds - P.arc) < w * 1.2 && (s > 0 ? X > bx : X < bx)) return true;            // the D
  }
  const dc = Math.hypot(X - P.cx, Y - P.cy);
  if (Math.abs(dc - P.cr) < w * 1.2 || dc < 0.14) return true;
  for (const cx of [P.x0, P.x1]) for (const cy of [P.y0, P.y1]) if (Math.abs(Math.hypot(X - cx, Y - cy) - 0.7) < w) return true;
  return false;
}
registerFloor('anfield_pitch', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v, P = PITCH;
    if (pitchLine(X, Y)) return LINE;
    const band = Math.floor((X - P.x0) / 2.5) % 2 === 0;
    let c = band ? '#2f6d2b' : '#3a7c34';
    const n = n2(X * 32, Y * 32, 324);
    for (const gx of [P.x0, P.x1]) {
      const dg = Math.hypot((X - gx) * 1.3, (Y - P.cy) * 0.7);
      if (dg < 3 && n < 0.8 - dg * 0.22) c = n < 0.3 ? '#5a4630' : '#6a5438';
    }
    if (n < 0.06) c = shade(c, -0.12); else if (n > 0.96) c = shade(c, 0.1);
    return c;
  },
});

// =====================================================================================================
// WALLS
// =====================================================================================================

// Anfield terraced house: red-orange brick with light mortar, sandstone sills/lintels, white sashes, coloured doors,
// the odd Liverpool flag in a front window. Slate roof on top.
const TERR_BRICK = brickFace('#9a4c34', '#b8a890');
const DOORS = ['#b01020', '#1a3a7a', '#1a5a32', '#1a1a1a', '#e8e0d0', '#6a1a4a'];
const CURT = ['#a01828', '#e8d8b0', '#2a4a7a', '#7a6a2a', '#c8102e', '#3a5a3a'];
registerWall('anfield_house', {
  top(u, v, variant) {
    if (Math.abs(u - 0.5) < 0.04) return '#4a3c40';
    const row = (v * 6) % 1;
    if (row < 0.14) return '#5c5664';
    const s = hash2(Math.floor(u * 8), Math.floor(v * 6), variant + 330);
    if (variant % 5 === 2 && u > 0.7 && u < 0.85 && v > 0.3 && v < 0.5) return v < 0.34 ? '#d07050' : '#8a3a2a'; // chimney pot
    return s < 0.2 ? '#383440' : s > 0.85 ? '#4a4452' : '#403c4a';
  },
  variants: 10,
  face(u, py, side, H, r, variant) {
    const fb = H - 1 - py, storey = Math.floor(fb / 40), fy = 39 - (fb % 40), wu = u * 16, fx = Math.floor(wu);
    if (py < 3) return py === 2 ? '#1a1418' : dk('#3a3236', side);
    if (variant % 4 === 1 && fx === 15) return dk('#22242a', side);                      // downpipe
    const door = storey === 0 && H >= 80 && variant % 3 === 0;
    if (door && wu >= 4 && wu < 12 && fy >= 5) {
      if (fx === 4 || fx === 11 || fy === 5) return dk('#d8ccb0', side);                // stone surround
      if (fy < 11) return fx % 2 ? '#ffd88a' : '#c89a4a';                               // fanlight
      if (fy === 11) return dk('#d8ccb0', side);
      if (fy > 37) return '#a09888';                                                    // step
      const dc = DOORS[variant % DOORS.length];
      if (fx === 9 && fy === 24) return '#e8c040';
      if ((fx === 6 || fx === 9) && (fy === 15 || fy === 30)) return dk(shade(dc, 0.22), side);
      return dk(dc, side);
    }
    const inWin = fy > 8 && fy < 31 && wu > 3.5 && wu < 12.5;
    if (inWin) {
      if (fy === 9 || fy === 30 || fx === 4 || fx === 12) return dk('#ece6da', side);
      if (fy === 19 || fy === 20) return dk('#d8d2c6', side);
      const lit = hash2(variant, storey + (side === 'right' ? 9 : 2), 331) < 0.45;
      const flag = storey === 0 && variant % 5 === 3;
      if (flag) {                                                                       // a red flag in the window
        if (fy > 11 && fy < 28 && fx > 4 && fx < 12) {
          const em = Math.abs(fx - 8) < 2 && fy > 15 && fy < 23;
          return dk(em ? (fy < 18 ? YEL : WHITE) : RED, side);
        }
      }
      if (lit) {
        const cur = CURT[Math.floor(hash2(variant, storey, 332) * CURT.length)];
        if (fx <= 5 || fx >= 11) return dk(cur, side);
        return dk(fy < 19 ? '#ffd890' : '#e8a850', side);
      }
      const refl = Math.abs((wu - 4) - (fy - 9) * 0.45 - 2) < 0.8;
      return dk(refl ? '#3a4a66' : '#18202e', side);
    }
    if (wu > 3 && wu < 13 && (fy === 31 || fy === 32)) return fy === 31 ? dk('#d8ccb0', side) : '#2a1a1a';
    if (wu > 3.5 && wu < 12.5 && (fy === 7 || fy === 8)) return dk('#cbbd9e', side);
    return TERR_BRICK(u, py, side, H, r, variant);
  },
});

// Pub frontage: glazed tiles below (green / oxblood), big etched windows glowing, black fascia with gilt band,
// red brick above with sash windows.
const PUB_TILE = [['#1c4a30', '#2a6a44', '#d8c890'], ['#5a1420', '#7a2030', '#e8d8a0']];
const PUB_BRICK = brickFace('#8a4232', '#3a2622');
registerWall('anfield_pub', {
  top: '#3a3238',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const fb = H - 1 - py, wu = u * 16, fx = Math.floor(wu), T = PUB_TILE[variant % 2];
    if (py < 3) return py === 2 ? '#1a1418' : dk('#4a4246', side);
    if (fb < 46) {
      if (fb >= 38) {                                                    // fascia
        if (fb === 38 || fb === 45) return dk('#c8a040', side);
        return dk(fb > 40 && fb < 44 && fx > 0 && fx < 15 && hash2(fx + variant * 7, 0, 340) < 0.65 ? '#e8c860' : '#141016', side);
      }
      if (fb < 6) return dk((fx + fb) % 3 ? T[0] : T[1], side);           // tiled stall riser
      if (fx < 2 || fx > 13) return dk(fb % 4 ? T[0] : T[2], side);        // tiled pilasters
      if (fb === 6 || fb === 37 || fx === 2 || fx === 13 || fx === 8) return dk('#2a1a14', side);
      // etched glass, warm light inside, shapes of drinkers
      const etch = fb > 28 && ((fx + fb) % 4 === 0);
      const head = (fx === 5 || fx === 10) && fb > 16 && fb < 22;
      if (head) return dk('#3a2418', side);
      return dk(etch ? '#fff0c8' : (fb > 22 ? '#ffd27a' : '#e8a848'), side);
    }
    const fy = (fb - 46) % 34;
    if (fy > 6 && fy < 26 && wu > 3.5 && wu < 12.5) {
      if (fy === 7 || fy === 25 || fx === 4 || fx === 12 || fy === 16) return dk('#e0dace', side);
      return dk(hash2(variant, Math.floor((fb - 46) / 34), 341) < 0.5 ? '#e8b060' : '#1a2232', side);
    }
    return PUB_BRICK(u, py, side, H, r, variant);
  },
});

// Chippy: white tiles with a blue band, bright window with fryers, red fascia; flat above.
registerWall('anfield_chippy', {
  top: '#3a3238',
  variants: 2,
  face(u, py, side, H, r, variant) {
    const fb = H - 1 - py, wu = u * 16, fx = Math.floor(wu);
    if (py < 3) return py === 2 ? '#1a1418' : dk('#4a4246', side);
    if (fb < 44) {
      if (fb >= 36) {
        if (fb === 36 || fb === 43) return dk('#f4f4f0', side);
        return dk(fb > 38 && fb < 42 && fx > 0 && fx < 15 && hash2(fx + variant * 5, 1, 342) < 0.65 ? '#fff4a0' : '#c01828', side);
      }
      if (fb < 7) return dk((fx % 2) ^ (fb % 2) ? '#f0f0ea' : '#2a5aa8', side);
      if (fx < 1 || fx > 14) return dk('#e8e8e2', side);
      if (fb === 7 || fb === 35) return dk('#2a5aa8', side);
      if (fb < 16) return dk(fb === 15 ? '#d8d8d0' : '#b8bcc4', side);       // stainless counter / fryers
      if (fb < 22 && (fx === 3 || fx === 7 || fx === 11)) return dk('#e0a030', side); // chips in the hopper
      return dk(fb > 28 ? '#fffbe0' : '#fff0b0', side);
    }
    return PUB_BRICK(u, py, side, H, r, variant);
  },
});

// Park railings on a sandstone plinth: black bars with gilded spear tips. See-through.
registerWall('anfield_parkRail', {
  top: (u, v) => (u > 0.88 || v > 0.88 ? '#1c1e22' : null),
  face(u, py, side, H) {
    const wu = u * 16, fb = H - 1 - py;
    if (fb < 6) return dk(fb === 5 ? '#d8c8a0' : (Math.floor(wu) % 8 === 0 ? '#8a7a5a' : '#b8a47c'), side);
    const bar = Math.floor(wu) % 3 === 0;
    if (py < 2) return bar ? '#c8a040' : null;                               // spear tips
    if (py === 4 || fb === 9) return dk('#2a2c32', side);                   // rails
    return bar ? dk(py < 6 ? '#3a3c44' : '#202228', side) : null;
  },
});

// Lake balustrade: sandstone coping on stout balusters (gaps show the water), lichen.
registerWall('anfield_lakeRail', {
  top(u, v) { const n = n2(u * 16, v * 16, 343); return n < 0.1 ? '#8a7a5c' : n > 0.9 ? '#d0c09c' : '#b8a882'; },
  face(u, py, side, H, r, variant) {
    const wu = u * 16, fb = H - 1 - py;
    if (py < 4) return dk(py === 0 ? '#d8c8a4' : '#b0a07a', side);
    if (fb < 5) return dk('#9a8a66', side);
    const b = wu % 4;
    if (b > 2.6) return null;                                                // gap between balusters
    const bulge = Math.abs(fb - 14) < 3;
    if (b < 0.5 || (b > 2.1 && !bulge)) return dk('#8a7a58', side);
    if (n2(wu, py, 344 + variant) < 0.06) return dk('#6a7a4a', side);        // lichen
    return dk(b < 1.2 ? '#cbb994' : '#b4a27c', side);
  },
});

// Gladstone-style glasshouse: white Victorian frames, misty glass with plants behind, brick plinth.
registerWall('anfield_glasshouse', {
  top(u, v) { const r = (u * 6) % 1; if (r < 0.1) return '#e8e8e0'; return (v * 4) % 1 < 0.08 ? '#d8d8d0' : (r < 0.5 ? '#9ab8c0' : '#86a4ae'); },
  variants: 3,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, fb = H - 1 - py, fx = Math.floor(wu);
    if (fb < 7) return dk(fb === 6 ? '#d8d0c0' : ((fx + Math.floor(fb / 3)) % 4 ? '#8a4232' : '#3a2622'), side);
    if (py < 2 || fx % 4 === 0 || (py % 12) === 0) return dk('#f0f0e8', side);
    const leaf = vnoise(wu * 0.6 + variant * 3, fb * 0.18, 345);
    if (fb < 26 && leaf > 0.55) return dk(leaf > 0.7 ? '#4a8a3a' : '#2e6a2e', side);   // palms behind the glass
    const refl = ((wu + py * 0.5) % 10) < 1.4;
    return dk(refl ? '#e0f0f4' : '#a8c8d0', side);
  },
});

// Back yard wall: sooty brick, whitewashed inside on some, broken-glass coping. Low (jumpable) or tall.
const YARD_BRICK = brickFace('#6a3a2c', '#2e2220');
registerWall('anfield_yardWall', {
  top(u, v) { const n = n2(u * 16, v * 16, 346); return n > 0.9 ? '#9ae0c8' : n > 0.8 ? '#c8a040' : '#4a3a34'; },
  variants: 6,
  face(u, py, side, H, r, variant) {
    if (py < 2) return dk(hash2(Math.floor(u * 16), py, 347) > 0.7 ? '#8ac8b0' : '#5a4a40', side); // glass shards on top
    const fb = H - 1 - py;
    if (variant % 3 === 0 && fb < H * 0.55 && side === 'left') return n2(u * 16, py, 348) < 0.12 ? '#a8a49a' : '#d8d4c8';
    if (variant % 6 === 1 && fb > 6 && fb < 16 && u > 0.2 && u < 0.6) return dk(py % 3 ? '#e8e4d8' : '#3a3a3a', side); // chalk scribble
    return YARD_BRICK(u, py, side, H, r, variant);
  },
});

// Back yard gate: painted vertical boards with a latch (doubles as the fake gate for the secret yard).
const GATE_C = ['#2a5a32', '#7a1a1a', '#1e3a6a', '#4a3a28'];
registerWall('anfield_yardGate', {
  top: '#3a2a1c',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, fb = H - 1 - py, c = GATE_C[variant % 4];
    if (py < 2) return dk('#2a1e14', side);
    if (Math.floor(wu) % 4 === 0) return dk(shade(c, -0.35), side);
    if (fb === 10 || fb === H - 8) return dk(shade(c, -0.25), side);
    if (Math.floor(wu) === 11 && Math.abs(fb - 16) < 1) return '#c8c8c0';
    const peel = n2(wu * 2, py, 349 + variant) < 0.08;
    return dk(peel ? '#8a7a68' : c, side);
  },
});

// Stadium outer wall on Walton Breck Road: brick plinth, red steel cladding, white band, gate numbers.
const FAC_BRICK = brickFace('#7a3a2e', '#2e1e1c');
registerWall('anfield_facade', {
  top: (u, v) => ((u * 4) % 1 < 0.1 ? '#3a1418' : '#5a1c24'),
  variants: 6,
  face(u, py, side, H, r, variant) {
    const fb = H - 1 - py, wu = u * 16;
    if (py < 2) return dk('#e8e4d8', side);
    if (fb < 22) {
      if (variant % 3 === 0 && wu > 5 && wu < 11 && fb < 18) return dk(fb === 17 || Math.floor(wu) === 6 || Math.floor(wu) === 10 ? '#2a1a1a' : '#4a4a52', side); // exit door
      return FAC_BRICK(u, py, side, H, r, variant);
    }
    if (fb < 25) return dk(fb === 23 ? WHITE : '#c8c4b8', side);
    const rib = Math.floor(wu) % 2 === 0;
    return dk(rib ? '#b80e2a' : RED, side);
  },
});

// Stand walls (inside the ground): red cladding over grey concrete, white trim.
registerWall('anfield_standWall', {
  top: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 ? '#2e2a30' : '#36323a'),
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16), fb = H - 1 - py;
    if (py < 2) return dk(WHITE, side);
    if (py < 14) return dk(wu % 2 ? '#b00c26' : RED, side);
    if (py < 16) return dk(WHITE, side);
    let c = wu % 4 === 0 ? '#2e2c36' : '#3c3a46';
    if (fb < 3) c = '#1c1a22';
    if (hash2(wu + variant * 5, py, 350) < 0.03) c = '#4c4a56';
    return dk(c, side);
  },
});

// Pitch perimeter: low white wall with a red band, mesh fence on top (see-through).
registerWall('anfield_perimeter', {
  top: (u, v) => (u > 0.86 || v > 0.86 ? '#e8e4d8' : null),
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, fb = H - 1 - py;
    if (fb < 14) {
      if (fb === 13) return dk(WHITE, side);
      if (fb < 2) return dk('#3a1418', side);
      if (variant % 2 && fb > 3 && fb < 11) return dk(Math.floor(wu) % 4 && hash2(Math.floor(wu / 2), fb, 351 + variant) < 0.55 ? YEL : '#1a2a5a', side); // advert
      return dk(fb > 4 && fb < 9 ? RED : WHITE, side);
    }
    if (py < 2 || Math.floor(wu) % 8 === 0) return dk('#4a4c54', side);
    if ((Math.floor(wu) + py) % 4 === 0 || (Math.floor(wu) - py + 400) % 4 === 0) return dk('#7a7e88', side);
    return null;
  },
});

// Terrace step: grey concrete riser with a white-painted lip; the tread is the wall's top.
registerWall('anfield_step', {
  top(u, v, variant) {
    if (u < 0.12) return '#c8c8cc';                       // white lip at the front edge (steps face -x... rise toward x=0)
    const n = n2(u * 16, v * 16, 352 + variant);
    if (n < 0.05) return '#26262c';
    if (n > 0.985) return RED;
    return n < 0.3 ? '#55545c' : '#5d5c64';
  },
  variants: 4,
  face(u, py, side, H) {
    if (py < 2) return dk('#d0d0d4', side);
    const n = n2(u * 16, py, 353);
    return dk(n < 0.1 ? '#3e3e46' : '#4a4a52', side);
  },
});

// Back of the Kop: the great roof wall with KOP lettering bands.
registerWall('anfield_kopBack', {
  top: '#2a2630',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    if (py < 3) return dk('#d8d4c8', side);
    if (py < 20) return dk(wu % 2 ? '#a80c24' : RED, side);
    if (py < 22) return dk(WHITE, side);
    return dk(py % 10 === 0 ? '#2a2830' : '#34323c', side);
  },
});

// =====================================================================================================
// CROWDS — home fans in red (the Kop and the locals outside the pubs). They boo YOU: you're the away lot.
// =====================================================================================================
const FAN_LOOKS = [];
function fanLook(i) {
  if (FAN_LOOKS[i]) return FAN_LOOKS[i];
  const rng = makeRng(9100 + i * 173);
  const L = casualLook(rng, { a: RED, b: WHITE, hatChance: 0.3, maskChance: 0, hoodChance: 0.1 });
  const j = i % 4;
  if (j === 0) L.jacket = { style: 'tee', color: RED };
  else if (j === 1) L.jacket = { style: 'track', color: rng.pick([RED, '#e8e0cc', '#9ad0e8', '#2a2a30']), trim: rng.pick([WHITE, YEL]) };
  else if (j === 2) L.jacket = { style: 'parka', color: rng.pick(['#2a3a2a', '#3a3a44', '#6a5a3a']) };
  L.shirt = rng.pick([RED, RED, WHITE, YEL]);
  L.scarf = rng.chance(0.7) ? { a: RED, b: rng.chance(0.5) ? WHITE : YEL } : null;
  if (L.hat && L.hat.style === 'beanie') L.hat = { style: 'beanie', color: RED, trim: WHITE };
  L.build = rng.range(0.9, 1.25); L.height = rng.range(0.92, 1.03);
  return (FAN_LOOKS[i] = L);
}
const FAN_POSES = {
  stand: () => ({ ...STAND }),
  boo0: () => ({ ...STAND, lean: 0.15, uaN: 1.5, faN: 0.15, uaF: 0.1, faF: 0.4, head: 0.1 }),
  boo1: () => ({ ...STAND, lean: 0.22, uaN: 1.7, faN: 0.05, uaF: 0.2, faF: 0.5, head: 0.15, dy: 1 }),
  clap0: () => ({ ...STAND, uaN: 1.0, faN: 1.3, uaF: 1.0, faF: 1.4 }),
  clap1: () => ({ ...STAND, uaN: 1.1, faN: 0.9, uaF: 1.1, faF: 1.0, dy: 1 }),
  wave0: () => (ANIMS.scarfWave ? sampleAnim('scarfWave', 0) : { ...STAND, uaN: 2.6, faN: 0.6 }),
  wave1: () => (ANIMS.scarfWave ? sampleAnim('scarfWave', animDuration('scarfWave') / 2) : { ...STAND, uaN: 2.9, faN: 0.2 }),
  arms0: () => ({ ...STAND, uaN: 2.9, faN: 0.3, uaF: 2.9, faF: 0.3 }),
  arms1: () => ({ ...STAND, uaN: 2.6, faN: 0.6, uaF: 2.6, faF: 0.6, dy: -1 }),
};
const fanCache = new Map();
function fanSprite(li, pose, flip) {
  const key = li + '|' + pose + '|' + (flip ? 1 : 0);
  let c = fanCache.get(key);
  if (c) return c;
  c = makeCanvas(44, 70);
  drawDoll(c.getContext('2d'), 22, 66, fanLook(li), fillPose(FAN_POSES[pose]()), { flip, face: pose.startsWith('boo') || pose.startsWith('arms') ? 'shout' : 'normal', time: li });
  fanCache.set(key, c);
  return c;
}

// crowd mood + Kop sway state shared by every crowd prop
export function kopState(world) {
  let S = world.__anfKop;
  if (!S) S = world.__anfKop = { t: -1, mood: 'idle', jeerT: 0, kos: 0, bubbleCd: 1, bubbles: [], surge: 0, surgeY: 46 };
  if (S.t !== world.time) {
    const dt = S.t < 0 ? 0 : Math.max(0, Math.min(0.1, world.time - S.t));
    S.t = world.time;
    S.jeerT -= dt; S.bubbleCd -= dt; S.surge = Math.max(0, S.surge - dt);
    if (world.stats && world.stats.kos !== S.kos) { if (world.stats.kos > S.kos) S.jeerT = 1.6; S.kos = world.stats.kos; }
    const p = world.player;
    let foes = 0;
    if (p) for (const f of world.fighters) if (f.team === 'enemy' && f.alive && Math.hypot(f.x - p.x, f.y - p.y) < 9) foes++;
    S.mood = S.surge > 0 ? 'surge' : S.jeerT > 0 ? 'jeer' : foes > 0 ? 'boo' : 'idle';
    for (const b of S.bubbles) b.t += dt;
    S.bubbles = S.bubbles.filter(b => b.t < 1.3);
  }
  return S;
}
const BOO = ['WHO ARE YA?', 'GET OUT!', 'OFF!', 'BOOOO!', 'YOU\'RE NOT WELCOME!', 'SOFT LAD!'];
const JEER = ['OOOH!', 'GET UP LA!', 'SHAME!', 'DIRTY!', 'REF!'];
const IDLE = ['LIVERPOOL!', 'COME ON YOU REDS!', 'THE KOP!', 'REDS! REDS!', 'ANFIELD!', 'L-F-C!'];
const SURGE = ['SWAY!', 'WOOOAH!', 'GO ON!', 'MIND OUT!'];
function crowdUpdate(p, world, dt, range = 12) {
  const S = kopState(world), pl = world.player;
  if (!pl || S.bubbleCd > 0) return;
  if (Math.hypot(pl.x - p.cx, pl.y - p.cy) > range || Math.random() > dt * 3) return;
  S.bubbleCd = S.mood === 'idle' ? 1.7 : 0.6;
  const list = S.mood === 'boo' ? BOO : S.mood === 'jeer' ? JEER : S.mood === 'surge' ? SURGE : IDLE;
  S.bubbles.push({ x: p.cx, y: p.cy, z: (p.base || 0) + 2.8, text: list[Math.floor(Math.random() * list.length)], t: 0, col: S.mood === 'boo' ? '#ffb0a0' : '#ffffff' });
}
function drawBubbles(ctx, p, world, S) {
  if (!world || !S.bubbles) return;
  for (const b of S.bubbles) {
    if (b.x !== p.cx || b.y !== p.cy) continue;
    const s = toScreen(b.x, b.y, b.z + b.t * 0.6);
    ctx.globalAlpha = b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.4) : 1;
    drawText(ctx, b.text, s.x, s.y, { color: b.col, align: 'center', outline: '#000' });
    ctx.globalAlpha = 1;
  }
}
function fanPose(S, hv, fr) {
  if (S.mood === 'surge') return 'arms' + fr;
  if (S.mood === 'jeer') return hv < 0.5 ? 'boo' + fr : 'arms' + fr;
  if (S.mood === 'boo') return hv < 0.6 ? 'boo' + fr : 'clap' + fr;
  return hv < 0.3 ? 'clap' + fr : hv < 0.55 ? 'wave' + fr : 'stand';
}

// Kop fans: 1 x 2 tiles of the terrace, four fans standing on their step (o.base). They sway; in a surge they
// lean hard toward the pitch (+x) and bounce.
registerProp('anfield_kopFans', {
  d: 2, h: 0, solid: false,
  update(p, world, dt) { crowdUpdate(p, world, dt, 13); },
  draw(ctx, ax, ay, p, t, world) {
    const S = world ? kopState(world) : { mood: 'idle', surge: 0 };
    const seeds = [[0.3, 0.3], [0.7, 0.75], [0.35, 1.3], [0.72, 1.72]];
    const surge = S.mood === 'surge';
    const sway = Math.sin(t * 1.5 + p.y * 0.22) * (surge ? 0 : 1.6) + (surge ? Math.min(1, S.surge) * 5 * Math.sin(Math.min(1, S.surge) * 3.14) + 3 : 0);
    for (let k = 0; k < 4; k++) {
      const [lx, ly] = seeds[k];
      const hv = hash2(p.x * 3 + k, p.y * 5 + k, 361);
      const li = Math.floor(hv * 16);
      const s = proj(ax, ay, lx + (hv - 0.5) * 0.15, ly, 0);
      const ph = (t * (S.mood === 'idle' ? 1.5 : 4.4) + hv * 7) % 2, fr = ph < 1 ? 0 : 1;
      const spr = fanSprite(li, fanPose(S, hv, fr), true);
      const bob = (surge || S.mood === 'jeer') && fr ? -2 : 0;
      ctx.drawImage(spr, Math.round(s.x - 22 + sway * 0.9), Math.round(s.y - 66 + bob + sway * 0.45));
    }
    drawBubbles(ctx, p, world, S);
  },
});

// Locals outside the pubs (pavement): two fans, normal props, solid so you can't walk through them.
registerProp('anfield_locals', {
  h: 1.7,
  update(p, world, dt) { crowdUpdate(p, world, dt, 9); },
  draw(ctx, ax, ay, p, t, world) {
    const S = world ? kopState(world) : { mood: 'idle' };
    for (let k = 0; k < 2; k++) {
      const [lx, ly] = k ? [0.72, 0.7] : [0.3, 0.32];
      const hv = hash2(p.x * 7 + k, p.y * 3 + k, 362);
      const s = proj(ax, ay, lx, ly, 0);
      const ph = (t * (S.mood === 'idle' ? 1.4 : 4) + hv * 5) % 2, fr = ph < 1 ? 0 : 1;
      shadow(ctx, s.x, s.y, 7, 3, 0.3);
      ctx.drawImage(fanSprite(Math.floor(hv * 16), fanPose(S, hv, fr), !!p.o.flip), Math.round(s.x - 22), Math.round(s.y - 66));
      if (k === 1 && p.o.pint) { ctx.fillStyle = OL; ctx.fillRect(Math.round(s.x + 6), Math.round(s.y - 40), 4, 6); ctx.fillStyle = '#c87a20'; ctx.fillRect(Math.round(s.x + 7), Math.round(s.y - 39), 2, 4); ctx.fillStyle = '#f8f0dc'; ctx.fillRect(Math.round(s.x + 7), Math.round(s.y - 40), 2, 1); }
    }
    drawBubbles(ctx, p, world, S);
  },
});

// =====================================================================================================
// THE KOP SURGE — called by the boss. A 5-tile band in front of the Kop is marked with red chevrons for `warn`
// seconds, then a wall of fans pours over the fence and rolls toward the halfway line, flattening anyone in its
// way (the boss excepted). Readable: step out of the marked band.
// =====================================================================================================
export function spawnKopSurge(world, yC, o = {}) {
  const S = kopState(world);
  const warn = o.warn ?? 1.5, half = o.half ?? 2.5, x0 = o.x0 ?? 11.6, x1 = o.x1 ?? 27, speed = o.speed ?? 8.5;
  const A = world.level.boss && world.level.boss.lockArea;
  const y0 = Math.max(A ? A.y + 0.2 : 0, yC - half), y1 = Math.min(A ? A.y + A.h - 0.2 : 99, yC + half);
  S.surge = warn + 1.6; S.surgeY = (y0 + y1) / 2;
  const hit = new Set();
  const a = world.addActor({
    kind: 'anfieldSurge', x: x0, y: (y0 + y1) / 2, z: 0, t: 0, removed: false, noCull: true, band: { y0, y1 }, warn, front: x0,
    update(w, dt) {
      this.t += dt;
      if (this.t < warn) return;
      if (!this.rolling) { this.rolling = true; w.sfx('crowdCheer', this); w.camera.shake(4, 0.6); }
      this.front = x0 + (this.t - warn) * speed;
      this.x = this.front;
      for (const f of w.fighters) {
        if (!f.alive || hit.has(f) || f.isDown || f.z > 1 || f.data.surgeImmune) continue;
        if (f.y < y0 - 0.2 || f.y > y1 + 0.2 || f.x > this.front + 0.4 || f.x < this.front - 1.2) continue;
        hit.add(f);
        const dmg = (o.dmg ?? 10) * (f.isPlayer ? w.diff.dmg : 1);
        const def = { hz: 1, sfx: 'hitHeavy', shake: 4, hitstop: 0.06 };
        const res = f.takeHit({ attacker: null, def, dmg, dir: { x: 1, y: (f.y - this.y) * 0.15 }, kb: 7, stun: 0.6, knockdown: true, launch: 4, unblockable: true, guardDmg: 0 }, w);
        w.onHit({ x: f.x - 1, y: f.y }, f, def, res, dmg);
        w.fx.popup(f.x, f.y, f.z + 0.6, 'SWEPT AWAY!', '#ff8a6a');
      }
      if (this.front > x1) this.removed = true;
    },
    depth() { return this.front + y1; },
    draw(ctx, w) {
      if (this.t < warn) return;
      // the wave: a ragged line of fans with arms up, running
      const k = Math.min(1, (x1 - this.front) / 3);
      ctx.globalAlpha = Math.max(0.2, k);
      for (let yy = y0; yy <= y1 + 0.01; yy += 0.55) {
        const hv = hash2(Math.floor(yy * 10), 7, 363);
        const s = toScreen(this.front - hv * 0.6, yy, 0);
        const fr = Math.floor(this.t * 8 + hv * 4) % 2;
        shadow(ctx, s.x, s.y, 7, 3, 0.3);
        ctx.drawImage(fanSprite(Math.floor(hv * 16), 'arms' + fr, false), Math.round(s.x - 22), Math.round(s.y - 66 - fr * 2));
      }
      ctx.globalAlpha = 1;
    },
  });
  return a;
}
// telegraph for every live surge (call from level.drawOverlay: works under both renderers)
export function drawSurgeWarnings(ctx, world) {
  for (const a of world.actors) {
    if (a.kind !== 'anfieldSurge' || a.removed) continue;
    const { y0, y1 } = a.band;
    const blink = a.t < a.warn ? (Math.floor(world.time * 8) % 2 ? 0.55 : 0.3) : 0.18;
    ctx.globalAlpha = blink;
    for (let x = Math.max(12, Math.floor(a.front)); x < 27; x += 2) {
      for (let y = Math.ceil(y0); y <= y1; y += 1.5) {
        const c = toScreen(x + 0.3, y, 0), e = toScreen(x + 1.1, y, 0), l = toScreen(x + 0.3, y - 0.45, 0), r = toScreen(x + 0.3, y + 0.45, 0);
        thick(ctx, l.x, l.y, e.x, e.y, 2, '#ff3a2a'); thick(ctx, r.x, r.y, e.x, e.y, 2, '#ff3a2a');
        void c;
      }
    }
    ctx.globalAlpha = 1;
  }
}

// =====================================================================================================
// PROPS
// =====================================================================================================

// Supporters' coach (w4 along x) that dropped you on Utting Avenue.
registerProp('anfield_coach', {
  w: 4, d: 1, h: 1.9,
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#d8d4c8', c2 = p.o.trim || '#1a3a8a';
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.15); ellipse(ctx, s.x, s.y, 4, 4, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 2, '#6a6a70'); };
    wh(0.6, 0.95); wh(3.3, 0.95);
    isoBox(ctx, ax, ay, 0.04, 0.06, 0.15, 3.92, 0.88, 1.8, { top: shade(c, -0.1), left: c, right: shade(c, -0.3), outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.94, 3.6, 1.05, 1.6, '#1a2030');
    for (let i = 0; i < 6; i++) isoPanel(ctx, ax, ay, 'left', 0.25 + i * 0.6, 0.94, 0.5, 1.1, 1.55, i % 2 ? '#3a4a60' : '#2c3a4e');
    isoPanel(ctx, ax, ay, 'left', 0.04, 0.94, 3.92, 0.5, 0.72, c2);
    isoPanel(ctx, ax, ay, 'right', 3.96, 0.1, 0.8, 0.95, 1.65, '#4a6a88');
    const m = proj(ax, ay, 2, 0.95, 0.61);
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, 0.5, 0, 1, 0, 0);
    drawText(ctx, p.o.text || 'NORDHAMN EXECUTIVE', 0, -3, { color: '#ffffff', align: 'center' });
    ctx.restore();
  },
});

// Ornamental park gates (open): two stone piers with lamps, and the iron gates swung back. Stands on the gap
// tile(s) of the railing; non-solid. o.dir 'x' (gap along x) | 'y'.
registerProp('anfield_parkGates', {
  h: 0, solid: false, depthBias: 0.2,
  light: { z: 2.4, r: 3, color: '#ffd8a0', intensity: 0.7 },
  draw(ctx, ax, ay, p, t) {
    const alongX = p.o.dir !== 'y', len = p.o.len || 2;
    const at = (u) => (alongX ? [u, 0.5] : [0.5, u]);
    for (const u of [-0.1, len + 0.1]) {
      const [x, y] = at(u);
      isoBox(ctx, ax, ay, x - 0.2, y - 0.2, 0, 0.4, 0.4, 1.9, { top: '#d8c8a0', left: '#c0ae86', right: '#9a8866', outline: OL });
      isoBox(ctx, ax, ay, x - 0.25, y - 0.25, 1.9, 0.5, 0.5, 0.12, { color: '#d8c8a0', outline: OL });
      const l = proj(ax, ay, x, y, 2.35);
      ctx.fillStyle = OL; ctx.fillRect(l.x - 3, l.y - 6, 7, 8); ctx.fillStyle = Math.sin(t * 9) > 0.95 ? '#fff0c0' : '#ffd890'; ctx.fillRect(l.x - 2, l.y - 5, 5, 6);
    }
    // gates swung open against the railing
    for (const s of [0, 1]) {
      const [x0, y0] = at(s ? len + 0.1 : -0.1);
      const [x1, y1] = alongX ? [x0 + (s ? 0.15 : -0.15), y0 - 0.9] : [x0 - 0.9, y0 + (s ? 0.15 : -0.15)];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
        const b = proj(ax, ay, x, y, 0), e = proj(ax, ay, x, y, 1.7);
        line(ctx, b.x, b.y, e.x, e.y, '#24262c');
        ctx.fillStyle = '#c8a040'; ctx.fillRect(Math.round(e.x), Math.round(e.y) - 1, 1, 1);
      }
      for (const z of [0.2, 1.6]) { const a = proj(ax, ay, x0, y0, z), b = proj(ax, ay, x1, y1, z); thick(ctx, a.x, a.y, b.x, b.y, 2, '#24262c'); }
    }
    if (p.o.text) { const m = proj(ax, ay, ...at(len / 2), 2.3); drawText(ctx, p.o.text, m.x, m.y - 4, { color: '#ffe8a0', align: 'center', outline: OL }); }
  },
});

// Victorian bandstand (2x2): cast-iron columns, red-and-cream roof. The roof is out of reach.
registerProp('anfield_bandstand', {
  w: 2, d: 2, h: 0.6,
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 1.9, 1.9, 0.55, { top: '#8a7a64', left: '#a89478', right: '#7a6a54', outline: OL });
    for (const [x, y] of [[0.2, 0.2], [1.8, 0.2], [0.2, 1.8], [1.8, 1.8], [1, 0.12], [1, 1.88], [0.12, 1], [1.88, 1]]) {
      const b = proj(ax, ay, x, y, 0.55), e = proj(ax, ay, x, y, 2.4);
      thick(ctx, b.x, b.y, e.x, e.y, 3, OL); line(ctx, b.x, b.y, e.x, e.y, '#2a5a3a');
    }
    // handrail
    const r = [proj(ax, ay, 0.2, 1.8, 1.0), proj(ax, ay, 1.8, 1.8, 1.0), proj(ax, ay, 1.8, 0.2, 1.0)];
    thick(ctx, r[0].x, r[0].y, r[1].x, r[1].y, 2, '#2a5a3a'); thick(ctx, r[1].x, r[1].y, r[2].x, r[2].y, 2, '#2a5a3a');
    // conical roof in segments
    const apex = proj(ax, ay, 1, 1, 3.4);
    const ring = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ring.push(proj(ax, ay, 1 + Math.cos(a) * 1.15, 1 + Math.sin(a) * 1.15, 2.4)); }
    for (let i = 0; i < 12; i++) fillPoly(ctx, [apex, ring[i], ring[(i + 1) % 12]], i % 2 ? RED : '#e8dcc0');
    for (let i = 0; i < 12; i++) line(ctx, ring[i].x, ring[i].y, ring[(i + 1) % 12].x, ring[(i + 1) % 12].y, OL);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(apex.x - 1, apex.y - 4, 3, 4);
  },
});

// Park keeper's hut: green-painted timber shed. Breakable (can hide a secret).
registerProp('anfield_hut', {
  h: 1.8,
  breakable: { hp: 34, debris: ['#2e5a36', '#6a4a2a', '#c8c0a8'], sfx: 'wood', drops: [['coin', 0.8], ['cash5', 0.5], ['pint', 0.4]], score: 120 },
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.06, 0.06, 0, 0.88, 0.88, 1.5, { top: '#3a2a22', left: '#2e5a36', right: '#22442a', outline: OL });
    for (let i = 1; i < 6; i++) { const a = proj(ax, ay, 0.06 + i * 0.147, 0.94, 0), b = proj(ax, ay, 0.06 + i * 0.147, 0.94, 1.5); line(ctx, a.x, a.y, b.x, b.y, '#22442a'); }
    isoPanel(ctx, ax, ay, 'left', 0.3, 0.95, 0.36, 0.05, 1.2, '#1e3a24');
    isoPanel(ctx, ax, ay, 'right', 0.95, 0.25, 0.45, 0.8, 1.2, '#c8d8e0');
    fillPoly(ctx, [proj(ax, ay, 0, 0, 1.5), proj(ax, ay, 1, 0, 1.5), proj(ax, ay, 1, 1, 1.75), proj(ax, ay, 0, 1, 1.75)], '#2a2a30');
    const m = proj(ax, ay, 0.5, 0.95, 1.35);
    drawText(ctx, 'KEEP OUT', m.x - 2, m.y - 3, { color: '#e8e4d8', align: 'center' });
  },
});

// Ducks on the lake (non-solid, place on water tiles).
registerProp('anfield_ducks', {
  h: 0, solid: false, depthBias: -0.4,
  draw(ctx, ax, ay, p, t) {
    for (let i = 0; i < 3; i++) {
      const ph = t * 0.4 + i * 2.1 + p.x;
      const s = proj(ax, ay, 0.5 + Math.cos(ph) * 0.35, 0.5 + Math.sin(ph * 0.8) * 0.35, 0);
      ctx.globalAlpha = 0.35; ellipse(ctx, s.x, s.y + 1, 5, 2, '#8ab0c8'); ctx.globalAlpha = 1;
      const f = Math.cos(ph) > 0 ? 1 : -1;
      ctx.fillStyle = OL; ctx.fillRect(s.x - 4, s.y - 4, 8, 4); ctx.fillRect(s.x + f * 2, s.y - 7, 3, 4);
      ctx.fillStyle = i === 1 ? '#7a5a3a' : '#e8e4d8'; ctx.fillRect(s.x - 3, s.y - 3, 6, 2);
      ctx.fillStyle = i === 1 ? '#2a5a3a' : '#e8e4d8'; ctx.fillRect(s.x + f * 2, s.y - 6, 2, 2);
      ctx.fillStyle = '#e8a020'; ctx.fillRect(s.x + f * 4, s.y - 5, 1, 1);
    }
  },
});

// Washing line across a yard: two poles, sagging line, flapping clothes. Non-solid, h 0. o.dir 'x' | 'y', o.len.
registerProp('anfield_washing', {
  h: 0, solid: false, depthBias: 0.3,
  draw(ctx, ax, ay, p, t) {
    const alongX = p.o.dir !== 'y', len = p.o.len || 2;
    const at = (u, z) => (alongX ? proj(ax, ay, u, 0.5, z) : proj(ax, ay, 0.5, u, z));
    const a = at(0.1, 0), b = at(len - 0.1, 0);
    for (const q of [a, b]) { thick(ctx, q.x, q.y, q.x, q.y - 2.1 * Z_PX, 3, OL); line(ctx, q.x, q.y, q.x, q.y - 2.1 * Z_PX, '#9a8a70'); }
    const N = Math.round(len * 16);
    let prev = null;
    const CL = [RED, '#e8e4d8', '#3a5a9a', '#9ad0e8', YEL, '#f0b8c8', '#2a2a30'];
    for (let i = 0; i <= N; i++) {
      const u = 0.1 + (len - 0.2) * i / N;
      const sag = Math.sin(Math.PI * i / N) * 0.25;
      const q = at(u, 2.05 - sag);
      if (prev) line(ctx, prev.x, prev.y, q.x, q.y, '#d8d8d0');
      prev = q;
      if (i % 5 === 2 && i < N - 1) {
        const ci = Math.floor(hash2(p.x * 9 + i, p.y, 364) * CL.length), w = Math.sin(t * 3 + i) * 1.5;
        const isShirt = ci % 2 === 0;
        ctx.fillStyle = OL; ctx.fillRect(Math.round(q.x - 4 + w), Math.round(q.y), 9, isShirt ? 9 : 11);
        ctx.fillStyle = CL[ci]; ctx.fillRect(Math.round(q.x - 3 + w), Math.round(q.y + 1), 7, isShirt ? 7 : 9);
        if (isShirt) { ctx.fillStyle = CL[ci]; ctx.fillRect(Math.round(q.x - 5 + w), Math.round(q.y + 1), 11, 2); }
      }
    }
  },
});

// Outside lav / coal shed in a back yard: whitewashed brick, tar roof. Jumpable (h 1.15).
registerProp('anfield_outhouse', {
  h: 1.15,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.08, 0.08, 0, 0.84, 0.84, 1.1, { top: '#2a2a2e', left: '#d8d4c8', right: '#a8a49a', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.3, 0.93, 0.4, 0.02, 0.95, GATE_C[(p.x + p.y) % 4]);
    const m = proj(ax, ay, 0.5, 0.93, 0.8); ctx.fillStyle = OL; ctx.fillRect(m.x - 1, m.y - 1, 3, 2);
  },
});

// THE SHANKLY GATES (decor over a 4-tile gap in the facade, o.len): stone piers, wrought-iron arch with the motto.
registerProp('anfield_shanklyGates', {
  w: 1, d: 1, h: 0, solid: false, depthBias: 0.6,
  draw(ctx, ax, ay, p, t) {
    const len = p.o.len || 4, P = (u, z) => proj(ax, ay, u, 0.5, z);
    for (const u of [-0.15, len + 0.15]) {
      isoBox(ctx, ax, ay, u - 0.25, 0.25, 0, 0.5, 0.5, 2.8, { top: '#d8c8a0', left: '#c0ae86', right: '#9a8866', outline: OL });
      isoBox(ctx, ax, ay, u - 0.3, 0.2, 2.8, 0.6, 0.6, 0.15, { color: '#e0d0aa', outline: OL });
    }
    // gates folded back (open) and the arch
    const N = 40;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const u = -0.15 + (len + 0.3) * i / N;
      const k = i / N, z = 2.7 + Math.sin(Math.PI * k) * 0.9;
      const q = P(u, z);
      if (prev) { thick(ctx, prev.x, prev.y, q.x, q.y, 3, OL); line(ctx, prev.x, prev.y, q.x, q.y, '#2a2c34'); }
      prev = q;
      if (i % 2 === 0 && i > 0 && i < N) { const b = P(u, 2.6); line(ctx, b.x, b.y, q.x, q.y, '#2a2c34'); }
    }
    const lo = P(-0.15, 2.55), hi = P(len + 0.15, 2.55); thick(ctx, lo.x, lo.y, hi.x, hi.y, 3, OL); line(ctx, lo.x, lo.y, hi.x, hi.y, '#2a2c34');
    // motto band + a little bird crest in gold
    const m = P(len / 2, 3.15);
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillStyle = OL; ctx.fillRect(-46, -5, 92, 10);
    ctx.fillStyle = '#c8a040'; ctx.fillRect(-45, -4, 90, 8);
    drawText(ctx, p.o.text || "YOU'LL NEVER WALK ALONE", 0, -3, { color: '#1a1414', align: 'center' });
    ctx.restore();
    const c = P(len / 2, 3.75);
    drawCrestBird(ctx, c.x, c.y - 2, '#c8a040', OL);
  },
});

// A little stylised standing-bird crest (original drawing), used on banners, gates and flags.
export function drawCrestBird(ctx, x, y, col, outline) {
  x = Math.round(x); y = Math.round(y);
  const px = (dx, dy, w = 1, h = 1) => ctx.fillRect(x + dx, y + dy, w, h);
  if (outline) { ctx.fillStyle = outline; px(-4, -7, 8, 12); }
  ctx.fillStyle = col;
  px(-1, -6, 2, 2); px(1, -6, 2, 1);           // head + beak
  px(-2, -4, 4, 4); px(-3, -3, 1, 2); px(2, -3, 1, 3); // body + wings
  px(-1, 0, 1, 3); px(1, 0, 1, 3);             // legs
  px(-3, 3, 7, 1);                            // perch
}

// Turnstile (passable) with a 3-arm barrier that spins as people go through; booth posts and an IN lamp.
registerProp('anfield_turnstile', {
  h: 0, solid: false,
  draw(ctx, ax, ay, p, t, world) {
    isoBox(ctx, ax, ay, 0, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a5a62', outline: OL });
    isoBox(ctx, ax, ay, 0.88, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a5a62', outline: OL });
    isoBox(ctx, ax, ay, 0, 0, 1.9, 1, 1, 0.3, { top: '#5a1c24', left: '#a81028', right: '#7a0c1c', outline: OL });
    let spin = 0;
    if (world) for (const f of world.fighters) if (Math.abs(f.x - p.cx) < 0.8 && Math.abs(f.y - p.cy) < 0.8) spin = 1;
    p.ang = (p.ang || 0) + spin * 0.12;
    const hub = proj(ax, ay, 0.5, 0.3, 0.9);
    ctx.fillStyle = OL; ctx.fillRect(hub.x - 3, hub.y - 3, 6, 10); ctx.fillStyle = '#9aa0a8'; ctx.fillRect(hub.x - 2, hub.y - 2, 4, 8);
    for (let i = 0; i < 3; i++) {
      const a = p.ang + i * 2.094, e = proj(ax, ay, 0.5 + Math.sin(a) * 0.45, 0.3 + Math.cos(a) * 0.45, 0.9);
      thick(ctx, hub.x, hub.y, e.x, e.y, 3, OL); thick(ctx, hub.x, hub.y, e.x, e.y, 1, '#d8dce0');
    }
    const m = proj(ax, ay, 1.0, 0.5, 2.05);
    drawText(ctx, p.o.text || 'IN', m.x - 6, m.y - 3, { color: '#ffffff' });
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#3aff7a' : '#1a8a3a'; ctx.fillRect(m.x + 4, m.y - 2, 2, 2);
  },
});

// Hanging banner on a wall face (single tile): stripes, crest bird, short text. opts side, z, a, b, text.
registerProp('anfield_banner', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left', z0 = p.o.z ?? 1.0, z1 = z0 + (p.o.height ?? 1.1), a = p.o.a || RED, b = p.o.b || WHITE;
    const on = (u, z) => (side === 'left' ? proj(ax, ay, u, 1.02, z) : proj(ax, ay, 1.02, u, z));
    for (let i = 0; i < 16; i++) {
      const u = 0.06 + i / 16 * 0.88, sw = Math.sin(t * 2 + i * 0.4 + p.x) * 0.02;
      const top = on(u, z1 - sw), bot = on(u, z0 - sw - (i % 3 === 0 ? 0.08 : 0));
      const h = Math.round(bot.y - top.y);
      ctx.fillStyle = OL; ctx.fillRect(Math.round(top.x), Math.round(top.y) - 1, 1, h + 2);
      if (i === 0 || i === 15) continue;
      for (let y = 0; y < h; y++) { const k = y / h; ctx.fillStyle = k < 0.12 || k > 0.88 ? b : a; ctx.fillRect(Math.round(top.x), Math.round(top.y) + y, 1, 1); }
    }
    const m = on(0.5, (z0 + z1) / 2 + 0.12);
    drawCrestBird(ctx, m.x, m.y, p.o.crest || YEL, null);
    if (p.o.text) {
      const q = on(0.5, z0 + 0.22);
      ctx.save(); ctx.translate(Math.round(q.x), Math.round(q.y)); ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
      drawText(ctx, p.o.text, 0, -3, { color: p.o.color || WHITE, align: 'center', outline: shade(a, -0.55) });
      ctx.restore();
    }
  },
});

// Crush barrier on the terrace (o.base for a step), rail along y (default) or x.
registerProp('anfield_crushBarrier', {
  h: 0.9,
  draw(ctx, ax, ay, p) {
    const alongY = p.o.dir !== 'x';
    const a = alongY ? proj(ax, ay, 0.5, 0.02, 0) : proj(ax, ay, 0.02, 0.5, 0);
    const b = alongY ? proj(ax, ay, 0.5, 0.98, 0) : proj(ax, ay, 0.98, 0.5, 0);
    const zt = 0.9 * Z_PX;
    for (const q of [a, b]) { thick(ctx, q.x, q.y, q.x, q.y - zt, 3, OL); thick(ctx, q.x, q.y, q.x, q.y - zt, 1, '#b8bcc4'); }
    thick(ctx, a.x, a.y - zt, b.x, b.y - zt, 4, OL); thick(ctx, a.x, a.y - zt, b.x, b.y - zt, 2, '#c8ccd4');
    line(ctx, a.x, a.y - zt - 1, b.x, b.y - zt - 1, '#eef0f4');
    if (p.o.scarf) { const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - zt }; for (let j = 0; j < 9; j++) { ctx.fillStyle = Math.floor(j / 2) % 2 ? WHITE : RED; ctx.fillRect(m.x, m.y + j, 2, 1); } }
  },
});

// Goal along y (w 2, d 4): posts on the goal line. o.flip: mouth faces -x (Anfield Road end).
registerProp('anfield_goal', {
  w: 2, d: 4, h: 2,
  draw(ctx, ax, ay, p) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const F = p.o.flip ? 0.5 : 1.5, B = p.o.flip ? 1.7 : 0.3, L = 0.1, R = 3.9, H = 1.9, HB = 1.3;
    ctx.strokeStyle = 'rgba(232,236,240,0.55)'; ctx.lineWidth = 1;
    const seg = (a, b) => { ctx.beginPath(); ctx.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); ctx.lineTo(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5); ctx.stroke(); };
    for (let i = 0; i <= 14; i++) { const y = L + (R - L) * i / 14; seg(P(B, y, 0), P(B, y, HB)); seg(P(F, y, H), P(B, y, HB)); }
    for (let j = 0; j <= 5; j++) { const z = HB * j / 5; seg(P(B, L, z), P(B, R, z)); }
    for (const y of [L, R]) for (let j = 0; j <= 4; j++) { const k = j / 4; seg(P(F + (B - F) * k, y, 0), P(F + (B - F) * k, y, H + (HB - H) * k)); }
    const post = (y) => { const a = P(F, y, 0), b = P(F, y, H); thick(ctx, a.x, a.y, b.x, b.y, 4, OL); thick(ctx, a.x, a.y, b.x, b.y, 2, '#f4f4f0'); };
    post(L); post(R);
    const c0 = P(F, L, H), c1 = P(F, R, H);
    thick(ctx, c0.x, c0.y, c1.x, c1.y, 4, OL); thick(ctx, c0.x, c0.y, c1.x, c1.y, 2, '#f4f4f0');
  },
});

// Corner flag: USE to pull it out (gives the CORNER FLAG weapon). Red and yellow.
registerProp('anfield_cornerFlag', {
  h: 0, solid: false, pickup: 'flag',
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 1.7);
    shadow(ctx, b.x, b.y, 4, 2, 0.3);
    thick(ctx, b.x, b.y, top.x, top.y, 3, OL); thick(ctx, b.x, b.y, top.x, top.y, 1, '#f4f4f0');
    for (let i = 0; i < 9; i++) { const w = Math.round(Math.sin(t * 6 + i * 0.6) * i / 9 * 2); for (let j = 0; j < 6; j++) { ctx.fillStyle = (Math.floor(i / 3) + Math.floor(j / 3)) % 2 ? RED : YEL; ctx.fillRect(top.x + 1 + i, top.y + j + w, 1, 1); } }
  },
});

// Police van (w3 along y) parked on Rockfield Road.
registerProp('anfield_van', {
  w: 1, d: 3, h: 1.7,
  draw(ctx, ax, ay, p, t) {
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.12); ellipse(ctx, s.x, s.y, 3, 4, '#0c0c0e'); };
    wh(0.95, 0.5); wh(0.95, 2.4);
    isoBox(ctx, ax, ay, 0.08, 0.05, 0.15, 0.84, 2.9, 1.5, { top: '#e8e8e4', left: '#d8d8d4', right: '#ecece8', outline: OL });
    for (let i = 0; i < 10; i++) isoPanel(ctx, ax, ay, 'right', 0.93, 0.08 + i * 0.28, 0.28, 0.55, 0.8, i % 2 ? '#2a4ab8' : '#f0d020');
    isoPanel(ctx, ax, ay, 'left', 0.12, 2.96, 0.76, 0.95, 1.45, '#5a7a98');
    isoPanel(ctx, ax, ay, 'right', 0.93, 2.1, 0.75, 0.95, 1.45, '#5a7a98');
    const l = proj(ax, ay, 0.5, 2.2, 1.7), on = Math.floor(t * 4) % 2;
    ctx.fillStyle = OL; ctx.fillRect(l.x - 6, l.y - 3, 12, 4);
    ctx.fillStyle = on ? '#4a7aff' : '#1a2a6a'; ctx.fillRect(l.x - 5, l.y - 2, 5, 2);
    ctx.fillStyle = on ? '#1a2a6a' : '#4a7aff'; ctx.fillRect(l.x, l.y - 2, 5, 2);
    const m = proj(ax, ay, 0.95, 1.2, 1.15);
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, -0.5, 0, 1, 0, 0);
    drawText(ctx, 'POLICE', 0, -3, { color: '#1a2a6a', align: 'center' });
    ctx.restore();
  },
});

// =====================================================================================================
// ITEMS
// =====================================================================================================
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

registerItem('anfield_scouse', {
  name: 'BOWL OF SCOUSE', kind: 'heal', heal: 32, score: 50, stash: true, auto: true,
  icon(ctx, x, y, t = 0) {
    px(ctx, OL, x - 7, y - 7, 14, 7);
    px(ctx, '#e8e4dc', x - 6, y - 6, 12, 5);
    px(ctx, '#8a4a22', x - 5, y - 7, 10, 2);
    px(ctx, '#d89a40', x - 3, y - 7, 2, 1); px(ctx, '#c84a2a', x + 1, y - 7, 2, 1);   // spud + carrot
    px(ctx, '#3a6a2a', x + 3, y - 8, 1, 1);
    px(ctx, 'rgba(255,255,255,0.7)', x - 1 + Math.round(Math.sin(t * 5) * 1.5), y - 10 - Math.round(((t * 1.5) % 1) * 3), 1, 2);
  },
});
registerItem('anfield_chips', {
  name: 'CHIPS AND GRAVY', kind: 'heal', heal: 22, score: 40, stash: true, auto: true,
  icon(ctx, x, y) {
    px(ctx, OL, x - 6, y - 9, 12, 9);
    px(ctx, '#f0f0e8', x - 5, y - 8, 10, 7);
    px(ctx, '#e8b040', x - 4, y - 10, 2, 4); px(ctx, '#f0c050', x - 1, y - 11, 2, 5); px(ctx, '#e0a838', x + 2, y - 10, 2, 4);
    px(ctx, '#6a3a1a', x - 4, y - 8, 8, 2);
  },
});
registerItem('anfield_prop', {
  name: 'WASHING LINE PROP', kind: 'weapon', score: 0,
  weapon: { dmg: 11, reach: 1.65, durability: 4, attack: 'thrust', knockdown: false, throwDmg: 12, breaks: 'wood' },
  icon(ctx, x, y) {
    thick(ctx, x - 7, y - 1, x + 6, y - 12, 3, OL);
    thick(ctx, x - 7, y - 1, x + 6, y - 12, 1, '#b08a58');
    px(ctx, '#7a6a5a', x + 5, y - 13, 3, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 20 * s, ey = hy + dy * 20 * s;
    thick(ctx, hx - dx * 5, hy - dy * 5, ex, ey, 3, OL);
    thick(ctx, hx - dx * 5, hy - dy * 5, ex, ey, 1, flash ? '#ffffff' : '#b08a58');
    px(ctx, '#7a6a5a', ex - 1, ey - 1, 3, 3);
  },
});

// cache the heavier static props into sprites (animated bits stay live)
const SPR = new Map();
function cacheStatic(id, keyFn = () => '') {
  const def = PROPS[id], raw = def.draw, H = Math.max(def.h, 3.6) + 1.2;
  def.draw = (ctx, ax, ay, p, t, world) => {
    const w = p.w, d = p.d, ox = d * 16 + 16, oy = Math.round(H * 20 + 16), key = id + '|' + w + 'x' + d + '|' + keyFn(p.o);
    let c = SPR.get(key);
    if (!c) { c = makeCanvas((w + d) * 16 + 32, (w + d) * 8 + oy + 24); raw(c.getContext('2d'), ox, oy, p, 0, null); SPR.set(key, c); }
    ctx.drawImage(c, ax - ox, ay - oy);
  };
}
cacheStatic('anfield_coach', o => [o.color, o.trim, o.text].join(','));
cacheStatic('anfield_bandstand');
cacheStatic('anfield_hut');
cacheStatic('anfield_outhouse', o => '');
cacheStatic('anfield_goal', o => (o.flip ? 'f' : ''));
cacheStatic('anfield_crushBarrier', o => (o.dir || 'y') + (o.scarf ? 's' : ''));
