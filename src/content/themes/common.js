// Common floor & wall styles shared by all levels. Level-specific themes live in their own files
// (e.g. themes/pub.js) and must only ADD new ids (never redefine these).
//
// Floor pixel(u, v, tx, ty, r): u,v in [0,1) within the tile; r per-tile random.
// Wall face(u, py, side, Hpx, r, variant, hUnits); top(u, v, variant, hUnits, r).
// Light comes from the upper-left: left (SW) faces are lit, right (SE) faces are in shade.
//
// Helpers exported for theme authors: ramp(hex, lo, hi, n), vnoise(x, y, seed), brickFace(base, mortar).

import { registerFloor, registerWall } from '../../engine/tiles.js';
import { shade, mix } from '../../engine/color.js';
import { hash2 } from '../../engine/rng.js';

const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);

// smooth value noise in [0,1)
export function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// palette of n shades from shade(hex, lo) to shade(hex, hi)
export function ramp(hex, lo, hi, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(shade(hex, lo + (hi - lo) * (i / (n - 1))));
  return out;
}
const pickR = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v)))];

// ------------------------------------------------------------------ floors
const ASPH = ramp('#34343e', -0.32, 0.16, 8);
const WET = ['#20242f', '#252a37', '#2b3140', '#3a4458', '#56627c'];
function asphaltPix(u, v, tx, ty, seed, pal, wet = true) {
  const wx = tx + u, wy = ty + v;
  // hairline cracks
  const cr = vnoise(wx * 2.2, wy * 2.2, seed + 40);
  if (Math.abs(cr - 0.5) < 0.012) return '#1c1c22';
  const sp = n2(u * 16 + tx * 16, v * 16 + ty * 16, seed);
  if (wet) {
    const pud = vnoise(wx * 0.55, wy * 0.55, seed + 7);
    if (pud > 0.7) {
      // standing water: dark, blue-grey, with vertical light streaks (reflections) and a lit rim
      if (pud < 0.715) return WET[3];
      const sxc = Math.floor((wx - wy) * 8);
      const st = hash2(sxc, Math.floor((wx + wy) * 1.5), seed + 3);
      if (st > 0.94) return WET[4];
      if (st > 0.82) return WET[2];
      return sp < 0.5 ? WET[0] : WET[1];
    }
  }
  let k = 3.6 + (vnoise(wx * 1.4, wy * 1.4, seed + 1) - 0.5) * 3;
  if (sp < 0.09) k -= 2; else if (sp > 0.93) k += 2.4; else if (sp > 0.8) k += 1;
  return pickR(pal, k);
}
registerFloor('asphalt', { pixel: (u, v, tx, ty) => asphaltPix(u, v, tx, ty, 1, ASPH) });
const ROAD = ramp('#2c2c34', -0.3, 0.14, 8);
registerFloor('road', { pixel: (u, v, tx, ty) => asphaltPix(u, v, tx, ty, 2, ROAD) });
const PAINT = ['#d8d0a0', '#b8b088', '#8a8670'];
function paintWorn(u, v, tx, ty) {
  const w = n2(u * 16 + tx * 16, v * 16 + ty * 16, 33);
  return w < 0.12 ? PAINT[2] : w < 0.3 ? PAINT[1] : PAINT[0];
}
// dashed centre line along world x (put on the row of tiles that forms the middle of a road)
registerFloor('roadLineX', {
  pixel(u, v, tx, ty) {
    if (Math.abs(v - 0.5) < 0.055 && ((tx % 2) === 0 ? u > 0.1 && u < 0.85 : false)) return paintWorn(u, v, tx, ty);
    return asphaltPix(u, v, tx, ty, 2, ROAD, false);
  },
});
registerFloor('roadLineY', {
  pixel(u, v, tx, ty) {
    if (Math.abs(u - 0.5) < 0.055 && ((ty % 2) === 0 ? v > 0.1 && v < 0.85 : false)) return paintWorn(u, v, tx, ty);
    return asphaltPix(u, v, tx, ty, 2, ROAD, false);
  },
});
registerFloor('zebra', {
  pixel(u, v, tx, ty) { return (Math.floor(u * 4) % 2 === 0 && (u * 4) % 1 > 0.1) ? paintWorn(u, v, tx, ty).replace('#d8d0a0', '#d4d4cc') : asphaltPix(u, v, tx, ty, 2, ROAD, false); },
});
registerFloor('zebraY', {
  pixel(u, v, tx, ty) { return (Math.floor(v * 4) % 2 === 0 && (v * 4) % 1 > 0.1) ? paintWorn(u, v, tx, ty).replace('#d8d0a0', '#d4d4cc') : asphaltPix(u, v, tx, ty, 2, ROAD, false); },
});

// paving slabs (2x2 per tile) with bevels lit from the upper-left, gum spots and the odd cracked slab
const SLAB = [ramp('#7a7782', -0.2, 0.18, 6), ramp('#74717c', -0.2, 0.18, 6), ramp('#807d86', -0.2, 0.18, 6), ramp('#6e6b76', -0.2, 0.18, 6)];
function FLOOR_PAV(u, v, tx, ty) {
  const gu = (u * 2) % 1, gv = (v * 2) % 1;
  if (gu < 0.05 || gv < 0.05) return '#4a4852';
  const si = tx * 2 + Math.floor(u * 2), sj = ty * 2 + Math.floor(v * 2);
  const slab = hash2(si, sj, 3);
  const pal = SLAB[Math.floor(slab * 4)];
  let k = 2.6;
  if (gu < 0.1) k += 1.6; else if (gv < 0.1) k += 0.9; else if (gu > 0.95) k -= 1.4; else if (gv > 0.95) k -= 0.8;
  if (slab > 0.9 && Math.abs(gu - gv * 0.7 - 0.2) < 0.035) return '#4e4c56'; // cracked slab
  const sp = n2(u * 16 + tx * 16, v * 16 + ty * 16, 4);
  if (sp < 0.012) return '#a6a4aa'; // chewing gum
  if (sp > 0.985) return '#56545e';
  k += (vnoise((tx + u) * 1.7, (ty + v) * 1.7, 5) - 0.5) * 1.6;
  if (sp < 0.1) k -= 0.7;
  return pickR(pal, k);
}
registerFloor('pavement', { pixel: (u, v, tx, ty) => FLOOR_PAV(u, v, tx, ty) });
const KERB = { lit: '#b6b4bc', top: '#9c9aa4', face: '#66646e', gut: '#26262c', joint: '#56545e' };
registerFloor('kerbX', { // pavement edge running along world x (kerb on the +y side)
  pixel(u, v, tx, ty) {
    if (v > 0.78) {
      if (v > 0.95) return KERB.gut;
      if ((u * 2) % 1 < 0.04) return KERB.joint;
      if (v < 0.81) return KERB.lit;
      if (v < 0.88) return n2(u * 16 + tx * 16, v * 16, 8) < 0.1 ? KERB.face : KERB.top;
      return KERB.face;
    }
    return FLOOR_PAV(u, v, tx, ty);
  },
});
registerFloor('kerbY', {
  pixel(u, v, tx, ty) {
    if (u > 0.78) {
      if (u > 0.95) return KERB.gut;
      if ((v * 2) % 1 < 0.04) return KERB.joint;
      if (u < 0.81) return KERB.lit;
      if (u < 0.88) return n2(v * 16 + ty * 16, u * 16, 8) < 0.1 ? KERB.face : KERB.top;
      return KERB.face;
    }
    return FLOOR_PAV(u, v, tx, ty);
  },
});
// granite setts: rounded stones in running bond, wet highlights
const SETT = [ramp('#625a62', -0.25, 0.3, 6), ramp('#6c646c', -0.25, 0.3, 6), ramp('#58505a', -0.25, 0.3, 6), ramp('#665e58', -0.25, 0.3, 6)];
registerFloor('cobble', {
  pixel(u, v, tx, ty) {
    const cu = u * 4, row = Math.floor(v * 4), cv = v * 4;
    const off = (row % 2) * 0.5;
    const fu = (cu + off) % 1, fv = cv % 1;
    if (fu < 0.1 || fv < 0.12) return '#29252c';
    const cornerA = (fu < 0.2 && fv < 0.24) || (fu > 0.9 && fv < 0.22) || (fu < 0.18 && fv > 0.9) || (fu > 0.9 && fv > 0.88);
    if (cornerA) return '#332e36';
    const s = hash2(tx * 4 + Math.floor(cu + off), ty * 4 + row, 5);
    const pal = SETT[Math.floor(s * 4)];
    let k = 2;
    if (fu < 0.3 && fv < 0.4) k += 2; else if (fu < 0.45 || fv < 0.3) k += 1;
    if (fu > 0.8 || fv > 0.82) k -= 1.5;
    if (fu > 0.18 && fu < 0.32 && fv > 0.2 && fv < 0.32) k = 5; // wet glint
    return pickR(pal, k);
  },
});
const GRASS = ['#24401e', '#2e4a24', '#365426', '#3e5e2c', '#4a6e34', '#5a8040'];
registerFloor('grass', {
  pixel(u, v, tx, ty) {
    const wx = tx + u, wy = ty + v;
    const sx = Math.floor((wx - wy) * 16), sy = Math.floor((wx + wy) * 8);
    const blade = hash2(sx, Math.floor(sy / 2), 6);
    let k = 2 + (vnoise(wx * 1.2, wy * 1.2, 6) - 0.5) * 2.4;
    if (blade > 0.8) k += 1.5; else if (blade < 0.15) k -= 1.2;
    if (hash2(sx, sy, 61) > 0.997) return (sx & 1) ? '#e8e4c0' : '#e8c840'; // daisies & buttercups
    return pickR(GRASS, k);
  },
});
const DIRT = ['#30261e', '#3a2e24', '#44362a', '#4e3e2e', '#5e4c3a', '#6e5a44'];
registerFloor('dirt', {
  pixel(u, v, tx, ty) {
    const wx = tx + u, wy = ty + v;
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 7);
    let k = 2.4 + (vnoise(wx * 1.5, wy * 1.5, 7) - 0.5) * 2.5;
    if (n < 0.1) k -= 1.5; else if (n > 0.95) k += 2.5;
    return pickR(DIRT, k);
  },
});
const CONC = ramp('#606066', -0.22, 0.14, 7);
registerFloor('concrete', {
  pixel(u, v, tx, ty, r) {
    if (u < 0.03 || v < 0.03) return '#47474d';
    if (u < 0.07) return CONC[5];
    const wx = tx + u, wy = ty + v;
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 8);
    let k = 3 + (r - 0.5) * 1.2 + (vnoise(wx * 2, wy * 2, 8) - 0.5) * 2;
    if (vnoise(wx * 0.8, wy * 0.8, 18) > 0.78) k -= 1.6; // oil/water stain
    if (n < 0.06) k -= 1.2; else if (n > 0.96) k += 1.4;
    return pickR(CONC, k);
  },
});
registerFloor('parking', { // car park bay lines along world y every tile, on tarmac
  pixel(u, v, tx, ty) {
    if (u < 0.05 && v > 0.12) return paintWorn(u, v, tx, ty).replace('#d8d0a0', '#d8d4c0');
    if (v > 0.12 && v < 0.16 && u < 0.25) return '#b8b4a0';
    return asphaltPix(u, v, tx, ty, 9, ROAD, true);
  },
});
const WOOD = [ramp('#6e4424', -0.3, 0.2, 6), ramp('#7a4c28', -0.3, 0.2, 6), ramp('#643c1e', -0.3, 0.2, 6)];
registerFloor('wood', {
  pixel(u, v, tx, ty) {
    const plank = Math.floor(v * 4);
    const off = n2(tx, ty * 4 + plank, 10);
    const fv = (v * 4) % 1;
    if (fv < 0.1) return '#2e1c0e';
    const pu = (u + off) % 1;
    if (pu < 0.025) return '#2e1c0e';
    const pal = WOOD[Math.floor(n2(tx, ty * 4 + plank, 11) * 3)];
    if ((pu > 0.04 && pu < 0.07 || pu > 0.93 && pu < 0.96) && Math.abs(fv - 0.55) < 0.12) return '#2a2a30'; // nails
    let k = 2.5 + Math.sin((u + tx + off * 7) * 22 + fv * 3) * 0.9;
    if (fv < 0.22) k += 1.4; else if (fv > 0.86) k -= 1.2;
    return pickR(pal, k);
  },
});
registerFloor('carpet', { // sticky pub carpet: swirly red/gold pattern, beer stains
  pixel(u, v, tx, ty) {
    const x = (u + tx) * 8, y = (v + ty) * 8;
    const st = vnoise((u + tx) * 1.3, (v + ty) * 1.3, 77) > 0.74;
    const s = Math.sin(x * 1.3 + Math.sin(y * 0.9)) + Math.cos(y * 1.1 - Math.sin(x * 0.7));
    let c;
    if (s > 1.2) c = '#c09030';
    else if (s > 0.9) c = '#8a6a24';
    else if (s > 0.5) c = '#7a1a24';
    else if (s < -1.3) c = '#3a0a12';
    else c = '#5a1018';
    return st ? (c === '#c09030' ? '#8a6a30' : c === '#5a1018' ? '#4a1416' : c) : c;
  },
});
registerFloor('tiles', { // checker tiles (toilets, chippy)
  pixel(u, v, tx, ty) {
    const a = Math.floor(u * 2) + Math.floor(v * 2);
    const gu = (u * 2) % 1, gv = (v * 2) % 1;
    if (gu < 0.05 || gv < 0.05) return '#7a7a80';
    const dark = a % 2;
    if (gu < 0.12 || gv < 0.12) return dark ? '#3e3e46' : '#f0f0e8';
    const dirt = vnoise((tx + u) * 2, (ty + v) * 2, 12) > 0.75;
    return dark ? '#2a2a30' : (dirt ? '#bcb8a8' : '#d8d8d0');
  },
});
registerFloor('metal', { // diamond tread plate
  pixel(u, v, tx, ty) {
    if (u < 0.03 || v < 0.03) return '#33353b';
    const gx = u * 8, gy = v * 8;
    const row = Math.floor(gy);
    const fx = (gx + (row % 2) * 0.5) % 1, fy = gy % 1;
    const d = Math.abs(fx - 0.5) + Math.abs(fy - 0.5) * 2.2;
    if (d < 0.32) return fx < 0.5 ? '#9a9ea6' : '#6a6e76';
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 13);
    return n < 0.08 ? '#4e5258' : n > 0.96 ? '#6e7078' : '#5a5e66';
  },
});
const GRAV = ['#4a4640', '#56524c', '#625e58', '#6e6a62', '#7c7870', '#8a867e'];
registerFloor('gravel', {
  pixel(u, v, tx, ty) {
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 13);
    const m = n2(u * 8 + tx * 8, v * 8 + ty * 8, 14);
    return pickR(GRAV, n * 4 + m * 2);
  },
});
registerFloor('water', {
  pixel(u, v, tx, ty) {
    const wx = tx + u, wy = ty + v;
    const w = Math.sin(wx * 9 + Math.sin(wy * 3) * 2) + Math.sin(wy * 7 - wx * 2);
    if (w > 1.7) return '#5a7a9a';
    if (w > 1.3) return '#3a5a7a';
    const n = vnoise(wx * 1.2, wy * 1.2, 14);
    return n > 0.6 ? '#1e3046' : '#18263a';
  },
});
const PITCHA = ramp('#2f6a2a', -0.15, 0.1, 4), PITCHB = ramp('#3a7a34', -0.15, 0.1, 4);
function pitchPix(u, v, tx, ty) {
  const stripe = Math.floor((ty + v) / 2) % 2 === 0;
  const pal = stripe ? PITCHA : PITCHB;
  const wx = tx + u, wy = ty + v;
  const n = hash2(Math.floor((wx - wy) * 16), Math.floor((wx + wy) * 4), 15);
  let k = 1.6 + (vnoise(wx * 0.8, wy * 0.8, 16) - 0.5) * 1.4;
  if (n < 0.12) k -= 1; else if (n > 0.9) k += 1;
  return pickR(pal, k);
}
registerFloor('pitch', { pixel: pitchPix }); // football pitch stripes along world x
registerFloor('pitchLine', { // white line along world x through tile centre
  pixel(u, v, tx, ty) {
    if (Math.abs(v - 0.5) < 0.065) return n2(u * 16 + tx * 16, 3, 9) < 0.1 ? '#c8d0c0' : '#eef2e6';
    return pitchPix(u, v, tx, ty);
  },
});
registerFloor('pitchLineY', {
  pixel(u, v, tx, ty) {
    if (Math.abs(u - 0.5) < 0.065) return n2(v * 16 + ty * 16, 3, 9) < 0.1 ? '#c8d0c0' : '#eef2e6';
    return pitchPix(u, v, tx, ty);
  },
});
registerFloor('terrace', { // concrete stepped terrace look
  pixel(u, v, tx, ty) {
    const step = (v * 3) % 1;
    if (step < 0.12) return '#36363c';
    if (step < 0.2) return '#86868c';
    if (step < 0.26) return '#6e6e74';
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 16);
    if (n > 0.992) return '#c8c0a0'; // dropped programme / ticket stub
    return n < 0.06 ? '#4e4e54' : (vnoise((tx + u) * 2, (ty + v) * 2, 17) > 0.7 ? '#58585e' : '#5e5e64');
  },
});
registerFloor('rail', { // rail tracks along world x
  pixel(u, v, tx, ty) {
    const dr = Math.min(Math.abs(v - 0.3), Math.abs(v - 0.7));
    if (dr < 0.045) return dr < 0.018 ? '#d0d4dc' : '#7a7a84';
    if (Math.abs(v - 0.3) < 0.07 || Math.abs(v - 0.7) < 0.07) return '#3a3438';
    const su = (u * 3) % 1;
    if (su < 0.24 && v > 0.12 && v < 0.88) return su < 0.05 ? '#5a4030' : su > 0.2 ? '#2e2018' : '#4a3424';
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 17);
    return n < 0.3 ? '#3a3632' : n < 0.6 ? '#4a4640' : n < 0.85 ? '#56524a' : '#2c2a28';
  },
});
registerFloor('platformEdge', { // yellow safety line along world x on the +y side, tactile bumps
  pixel(u, v, tx, ty) {
    if (v > 0.9) return v > 0.96 ? '#4a4a52' : '#a4a4aa';
    if (v > 0.78 && v < 0.88) return '#e8c020';
    if (v > 0.6 && v < 0.76) {
      const bu = (u * 8) % 1, bv = ((v - 0.6) * 8 / 1.28 * 2) % 1;
      if (bu > 0.25 && bu < 0.65 && bv > 0.25 && bv < 0.7) return bu < 0.4 ? '#9a9aa2' : '#76767e';
      return '#6a6a72';
    }
    return n2(u * 16 + tx * 16, v * 16 + ty * 16, 18) < 0.05 ? '#5a5a62' : '#6a6a72';
  },
});
registerFloor('manhole', {
  pixel(u, v, tx, ty) {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d < 0.27) {
      const g = ((u * 9) % 1 < 0.35) !== ((v * 9) % 1 < 0.35);
      return g ? '#2a2a30' : (u + v < 0.9 ? '#4a4a54' : '#3e3e46');
    }
    if (d < 0.31) return '#5a5a64';
    if (d < 0.34) return '#1a1a20';
    return asphaltPix(u, v, tx, ty, 1, ASPH, false);
  },
});
registerFloor('crest', { // painted club crest centre (use on a single tile; looks best on concrete squares)
  pixel(u, v) {
    const x = u - 0.5, y = v - 0.5;
    const d = Math.hypot(x, y);
    if (d < 0.2) {
      // anchor emblem
      const ax = Math.abs(x + y) * 0.7, ay = (y - x) * 0.7;
      if (ax < 0.022 && ay > -0.11 && ay < 0.1) return '#c8102e';
      if (Math.abs(ay + 0.07) < 0.02 && ax < 0.07) return '#c8102e';
      if (ay > 0.03 && Math.abs(Math.hypot(ax, ay - 0.01) - 0.09) < 0.02) return '#c8102e';
      return '#f4f1e8';
    }
    if (d < 0.3) return '#c8102e';
    if (d < 0.33) return '#f4f1e8';
    if (d < 0.4) return '#1a1a40';
    if (d < 0.42) return '#f4f1e8';
    return '#5c5c62';
  },
});

// ------------------------------------------------------------------ walls
// brick: running bond, recessed mortar, per-brick tone, lit top edge, grime toward the ground, coping
export function brickFace(base, mortar = '#3a2a26') {
  const pal = ramp(base, -0.22, 0.16, 6);
  const palR = pal.map(c => shade(c, -0.32));
  const mortR = shade(mortar, -0.25);
  return (u, py, side, H, r, variant) => {
    const right = side === 'right';
    const bx = u * 16, row = Math.floor(py / 4);
    const off = row % 2 ? 4 : 0;
    if (py < 3) { // coping stone
      if (py === 2) return right ? '#3a3236' : '#4e4448';
      return right ? shade(pal[5], -0.25) : pal[5];
    }
    if (py % 4 === 3) return right ? mortR : mortar;
    if ((Math.floor(bx + off)) % 8 === 0) return right ? mortR : mortar;
    const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, 3);
    let k = 2.5 + (s - 0.5) * 3;
    if (py % 4 === 0) k += 1;                       // lit upper edge of the brick
    if (py === 3) k -= 2;                           // shadow under the coping
    const fromGround = H - py;
    if (fromGround < 10) k -= (10 - fromGround) * 0.18; // grime / damp
    if (s > 0.93) k -= 2.2;                        // burnt brick
    const p = right ? palR : pal;
    return p[Math.max(0, Math.min(5, Math.round(k)))];
  };
}
const brick = brickFace;
registerWall('brick', { top: (u, v) => ((u * 8) % 1 < 0.12 ? '#4a302a' : '#5a3a30'), face: brick('#8a4a38') });
registerWall('brickDark', { top: (u, v) => ((u * 8) % 1 < 0.12 ? '#2a1e1c' : '#3a2a26'), face: brick('#5e3a30', '#22181a') });
registerWall('brickYellow', { top: '#7a6a48', face: brick('#b09a64', '#5a4a3a') });

// terraced house: brick, sash windows with stone sills/lintels (lit at random at night), front doors, slate roof
const HOUSE_BRICK = brick('#7a4434', '#3a2422');
const CURTAINS = ['#8a2a2a', '#2a4a7a', '#7a6a2a', '#4a7a4a', '#7a3a6a', '#c8c0a8'];
registerWall('house', {
  top(u, v, variant) {
    // slate roof: rows of slates along v with lighter leading edges + a ridge
    const row = (v * 6) % 1;
    if (Math.abs(u - 0.5) < 0.04) return '#5a4448';
    const s = hash2(Math.floor(u * 8), Math.floor(v * 6), variant + 5);
    if (row < 0.15) return '#5e5662';
    return s < 0.2 ? '#3a3440' : s > 0.85 ? '#4e4654' : '#444050';
  },
  variants: 8,
  face(u, py, side, H, r, variant) {
    const right = side === 'right';
    const fb = H - 1 - py;                 // px from the ground
    const storey = Math.floor(fb / 40);
    const fy = 39 - (fb % 40);             // 0 = top of the storey
    const wu = u * 16;
    const tall = H >= 60;
    // eaves / gutter line on top
    if (py < 3) return py === 2 ? '#1a1418' : (right ? '#3a3236' : '#4a4246');
    // drainpipe on some tiles
    if (variant % 4 === 1 && Math.floor(wu) === 14) return right ? '#1e1e24' : '#2c2c34';
    const door = storey === 0 && tall && variant % 3 === 0;
    if (door) {
      if (wu >= 4 && wu < 12 && fy >= 6) {
        if (Math.floor(wu) === 4 || Math.floor(wu) === 11 || fy === 6) return right ? '#a8a49a' : '#d8d0c0'; // frame
        if (fy < 12) return (Math.floor(wu) % 2) ? '#ffd27a' : '#c8a050';  // fanlight
        if (fy === 12) return '#d8d0c0';
        const dc = ['#2a3a6a', '#6a1a1a', '#1a4a2a', '#1a1a1a'][variant % 4];
        if (fy > 37) return '#9a948a'; // step
        if (Math.floor(wu) === 9 && fy === 24) return '#e8c040'; // knob
        if ((Math.floor(wu) === 6 || Math.floor(wu) === 9) && (fy === 16 || fy === 30)) return shade(dc, 0.25);
        return right ? shade(dc, -0.3) : dc;
      }
    }
    const inWin = fy > 9 && fy < 30 && wu > 3.5 && wu < 12.5;
    if (inWin) {
      const fx = Math.floor(wu);
      if (fy === 10 || fy === 29 || fx === 4 || fx === 12) return right ? '#a8a49a' : '#e0dace'; // frame
      if (fy === 19 || fy === 20) return right ? '#a8a49a' : '#d0cabe';  // meeting rail
      const lit = hash2(variant, storey + (right ? 0 : 7), 9) < 0.45;
      const tv = !lit && hash2(variant, storey + 3, 19) < 0.12;
      if (lit) {
        const cur = CURTAINS[Math.floor(hash2(variant, storey, 21) * CURTAINS.length)];
        if (fx <= 5 || fx >= 11) return right ? shade(cur, -0.3) : cur;   // curtains
        const g = fy < 19 ? '#ffd88a' : '#e8a848';
        return right ? shade(g, -0.25) : g;
      }
      if (tv) return (fy + fx) % 3 ? '#4a6ab8' : '#6a8ad8';
      // dark glass with a diagonal reflection
      const refl = Math.abs((wu - 4) - (fy - 10) * 0.45 - 2) < 0.8;
      const g = refl ? '#3a4a66' : (fy < 19 ? '#1c2638' : '#161e2e');
      return right ? shade(g, -0.25) : g;
    }
    if (wu > 3 && wu < 13 && (fy === 30 || fy === 31)) return fy === 30 ? (right ? '#a49e90' : '#d4ccbc') : '#2a1a1a'; // sill + shadow
    if (wu > 3.5 && wu < 12.5 && (fy === 8 || fy === 9)) return right ? '#8e887c' : '#bcb4a4'; // lintel
    return HOUSE_BRICK(u, py, side, H, r, variant);
  },
});

// shopfront: fascia with lettering, striped awning, lit window with goods, stall riser; brick above
const SHOP_PAL = [['#b02828', '#ffe0a0'], ['#1f4fb4', '#c8e8ff'], ['#2a7a3a', '#e0ffd0'], ['#d8a020', '#fff0c0'], ['#6a2a8a', '#ffd0ff'], ['#1a1a1a', '#ff9a50']];
const SHOP_BRICK = brick('#6a4038', '#2e2022');
registerWall('shop', {
  top: '#3a3238',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const right = side === 'right';
    const pal = SHOP_PAL[variant % 6];
    const wu = u * 16, fx = Math.floor(wu);
    const lowTop = H - 34;
    const dk = c => (right ? shade(c, -0.3) : c);
    if (py >= lowTop - 12 && py < lowTop - 6) { // fascia sign with blocky lettering
      const fy = py - (lowTop - 12);
      if (fy === 0 || fy === 5) return dk('#1a1418');
      const letter = fy > 1 && fy < 4 && fx > 0 && fx < 15 && hash2(fx + variant * 16, 0, 41) < 0.6;
      return dk(letter ? pal[1] : pal[0]);
    }
    if (py >= lowTop - 6 && py < lowTop) { // striped awning, scalloped edge
      const fy = py - (lowTop - 6);
      if (fy === 5) return (fx % 2) ? null : dk(shade(pal[0], -0.3));
      return dk(((fx >> 1) % 2) ? pal[0] : '#e8e4dc');
    }
    if (py >= lowTop) {
      const fy = py - lowTop;
      if (fy < 2) return '#141016'; // awning shadow
      if (wu < 1.5 || wu > 14.5) return dk('#3a3038'); // pilasters
      if (fy > 26) return dk(fy === 27 ? '#8a8a90' : ((fx + fy) % 4 === 0 ? '#3a4a52' : '#4a5a62')); // tiled stall riser
      if (fy === 2 || fy === 26) return dk('#2a2228');
      // window: lit interior with shelves and goods
      const g = pal[1];
      if (fy === 12 || fy === 20) return dk(shade(g, -0.45)); // shelves
      if ((fy > 7 && fy < 12) || (fy > 15 && fy < 20)) {
        const item = hash2(fx + variant * 13, fy > 12 ? 1 : 2, 43);
        if (item < 0.55 && (fy > 9 || fy > 17)) return dk(['#c83030', '#3060c8', '#e8c040', '#30a050', '#e8e8e0'][Math.floor(item * 9) % 5]);
      }
      if (fx === 7 && fy > 2) return dk('#2a2228'); // mullion
      const glare = Math.abs((wu - 2) - (fy - 2) * 0.5 - 1) < 0.7;
      return dk(glare ? '#ffffff' : fy < 14 ? g : shade(g, -0.18));
    }
    return SHOP_BRICK(u, py, side, H, r, variant);
  },
});

registerWall('concrete', {
  top: '#6a6a70',
  face(u, py, side, H, r, variant) {
    const n = hash2(Math.floor(u * 16) + variant * 3, py, 4);
    const streak = hash2(Math.floor(u * 16) + variant * 17, 0, 44) < 0.18 && py > 4;
    let c = n < 0.04 ? '#4e4e54' : n > 0.97 ? '#7a7a80' : '#626268';
    if (streak) c = '#56565c';                             // rain run-off streaks
    if (py % 24 === 0) c = '#4a4a50';                      // pour lines
    if (py % 24 === 1) c = '#6e6e74';
    if (Math.floor(u * 16) === 0) c = '#55555b';
    if ((py % 24 === 12) && (Math.floor(u * 16) % 8 === 4)) c = '#3a3a40'; // tie holes
    if (H - py < 6) c = shade(c, -0.15);
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
const CORR = ['#4a525c', '#5a6470', '#6e7884', '#8a929c'];
registerWall('corrugated', {
  top: '#5a6068',
  face(u, py, side, H) {
    const s = Math.floor(u * 16) % 3;
    let c = s === 0 ? CORR[1] : s === 1 ? CORR[2] : CORR[0];
    if (py < 2) c = CORR[3];
    if (py % 30 === 15) c = '#3a4048'; // rail with bolts
    if (H - py < 4) c = '#3e444c';
    return side === 'right' ? shade(c, -0.28) : c;
  },
});
registerWall('corrugatedRust', {
  top: '#6a4a38',
  face(u, py, side, H, r, variant) {
    const s = Math.floor(u * 16) % 3;
    let c = s === 0 ? '#7a4a30' : s === 1 ? '#8e5a3a' : '#5e3a26';
    if (hash2(Math.floor(u * 16), Math.floor(py / 3), variant + 9) < 0.15) c = '#5a6068';
    if (hash2(Math.floor(u * 16), 0, variant + 19) < 0.2 && py > 6) c = '#a0602e'; // rust drip
    return side === 'right' ? shade(c, -0.28) : c;
  },
});
registerWall('tiledWall', { // white tiled (subway / toilets) with a coloured band
  top: '#9a9aa0',
  face(u, py, side, H) {
    const tx = (u * 16) % 4, ty = py % 4;
    let c = (tx < 0.6 || ty === 0) ? '#a8a8a8' : (ty === 1 && tx < 2 ? '#f4f4ec' : '#e0e0d8');
    const band = Math.floor(H * 0.45);
    if (py >= band && py < band + 4) c = ty === 0 || tx < 0.6 ? '#6a1018' : '#c8102e';
    if (H - py < 8 && !(tx < 0.6 || ty === 0)) c = '#c8c4b8';
    return side === 'right' ? shade(c, -0.25) : c;
  },
});
registerWall('glass', {
  top: '#6a7a8a',
  face(u, py, side) {
    const wu = u * 16;
    if (Math.floor(wu) % 8 === 0 || py % 20 === 0) return side === 'right' ? '#2a3038' : '#3a424c';
    const d = ((wu + py * 0.5) % 12);
    const refl = d < 1.2 ? '#c8e0f0' : d < 2.4 ? '#88a8c8' : '#4a6a8a';
    return side === 'right' ? shade(refl, -0.3) : refl;
  },
});
const HEDGE = ['#1c3a18', '#244a1e', '#2e5a26', '#3a6a30', '#4a7e3a'];
registerWall('hedge', {
  top: (u, v, variant) => { const n = hash2(Math.floor(u * 16), Math.floor(v * 16), variant); return n < 0.3 ? '#2e5a26' : n > 0.85 ? '#4a7e3a' : '#3a6a30'; },
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    const leaf = hash2(wu, py, variant + 2), clump = vnoise(u * 5 + variant, py / 4, 22);
    let k = 1.5 + (clump - 0.5) * 3 + (leaf > 0.8 ? 1 : leaf < 0.2 ? -1 : 0);
    if (py < 3) k += 1;
    if (H - py < 4) k -= 1.5;
    const c = pickR(HEDGE, k);
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
registerWall('fenceWood', {
  top: '#5a4028',
  face(u, py, side, H) {
    const p = (u * 16) % 3;
    if (p < 0.4) return side === 'right' ? '#1a1008' : '#24180c';  // gaps between boards
    let c = p < 1 ? '#7a5a34' : '#6a4a2a';
    if (py % 18 === 8 || py % 18 === 9) c = '#4a3420';             // rail
    if (py < 2) c = '#8a6a40';
    if (H - py < 4) c = '#3a2a18';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
const CONT = ['#8a2a20', '#1f4f8a', '#2a6a3a', '#b08a20'];
registerWall('container', {
  top: '#6a2a20',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const base = CONT[variant % 4];
    const fx = Math.floor(u * 16);
    let c = (fx % 2 === 0) ? base : shade(base, -0.15);
    if (py < 2 || py > H - 3) c = shade(base, -0.35);
    if (variant % 2 === 1 && (fx === 5 || fx === 10)) c = '#2a2a2e';      // locking bars
    if (variant % 2 === 1 && (fx === 5 || fx === 10) && py % 14 === 7) c = '#9a9aa0';
    if (hash2(fx, Math.floor(py / 4), variant + 31) < 0.06) c = '#7a4a2a'; // rust spots
    return side === 'right' ? shade(c, -0.28) : c;
  },
});
registerWall('railing', {
  top: '#2a2a30',
  face(u, py, side, H) {
    const wu = u * 16;
    const bar = Math.floor(wu) % 3 === 0;
    if (py < 2) return side === 'right' ? '#1e1e24' : '#3a3a44';
    if (py === 2 || py === H - 3) return side === 'right' ? '#1e1e24' : '#2e2e36';
    if (bar) return side === 'right' ? '#1a1a20' : (py < 5 ? '#4a4a56' : '#2e2e36');
    return null; // see-through
  },
});
registerWall('stand', { // stadium stand back/side wall in club colours
  top: '#2a2a34',
  face(u, py, side, H) {
    const fx = Math.floor(u * 16);
    let c;
    if (py < 6) c = '#c8102e';
    else if (py < 8) c = '#f4f1e8';
    else {
      // concrete with louvred vents and a turnstile-ish door band at the bottom
      c = (py % 12 === 0) ? '#323238' : '#3a3a44';
      if (fx % 8 === 0) c = '#2a2a32';
      if (py > 12 && py < 22 && fx > 2 && fx < 6) c = (py % 2) ? '#22222a' : '#4a4a54';
    }
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
const ADV = [['#1a1a8a', '#ffd23a'], ['#c8102e', '#ffffff'], ['#0a6a3a', '#ffffff'], ['#ffd23a', '#1a1a1a'], ['#ffffff', '#c8102e'], ['#2a2a2a', '#3aff7a']];
registerWall('advert', { // pitch-side advertising hoardings (low), invented brands only
  top: '#1a1a20',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const [bg, fg] = ADV[variant % ADV.length];
    const wu = u * 16;
    if (py < 1 || py > H - 2) return side === 'right' ? '#141418' : '#22222a';
    const letter = py > 4 && py < H - 4 && (Math.floor(wu + variant * 3) % 4 !== 0) && hash2(Math.floor(wu / 2), py, variant) < 0.55;
    const c = letter ? fg : bg;
    return side === 'right' ? shade(c, -0.25) : c;
  },
});
const ROCK = ['#2e2a26', '#3a3632', '#4a4640', '#5a5650', '#6a665e'];
registerWall('rock', {
  top: '#4a4640',
  face(u, py, side, H, r, variant) {
    const n = hash2(Math.floor(u * 8), Math.floor(py / 3), variant + 5);
    const k = 1.5 + vnoise(u * 4 + variant, py / 6, 23) * 2 + (n - 0.5);
    const c = pickR(ROCK, k);
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
registerWall('crateStack', {
  top: '#8a6038',
  face(u, py, side) {
    const wu = u * 16;
    let c = (py % 20 < 10) ? '#8a6038' : '#82593a';
    if (py % 20 < 2 || Math.floor(wu) === 0 || Math.floor(wu) === 15) c = '#5e3e20';
    else if (Math.abs((wu - 8) - ((py % 20) - 10) * 0.8) < 1) c = '#6e4a28';
    else if (py % 20 === 2) c = '#a07848';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

export { mix };
