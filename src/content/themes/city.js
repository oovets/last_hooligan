// LEVEL 5 THEME — THE CITY (downtown Nordhamn after the match: neon, rain, nightlife).
// Floors, walls, props and items used by src/content/levels/l5_city.js. Every id starts with 'city_'.
//
// Floors: city_wetPave city_wetRoad city_roadLineY city_busLane city_zebra city_tactile city_brickPave
//         city_arcadeCarpet city_taxiBay city_clubFloor city_dance city_deck city_bay city_plaza city_water
//         city_marketCobble city_kebabTiles
// Walls:  city_neonShop city_backBlock city_arcadeFront city_arcadeInside city_kebabInside city_kebabFront city_hotel city_galleria city_tunnel
//         city_railing city_clubWall city_clubInside city_bar city_djBooth city_counter city_pillar city_stairwell
//         city_lowWall city_marketWall city_rim
// Props:  city_taxi city_busShelter city_kebabVan city_cashpoint city_arcadeCab city_clawMachine city_pelican
//         city_clubDoor city_fireDoor city_shutter city_clubTotem city_rope city_speaker city_discoBall city_djDeck
//         city_barTop city_doner city_statue city_fountainJet city_stall city_fruitCrate city_boards city_payMachine
//         city_planter city_bigScreen city_neonSign city_festoon city_taxiSign
// Items:  city_apple city_melon (heal) · city_inflatable city_handbag city_heel city_cane city_phone
//         city_champagne city_neon (weapons)
// Also exports drawCityVehicle(ctx, v, world) used by the level's traffic lanes (custom vehicle draw).

import { registerFloor, registerWall } from '../../engine/tiles.js';
import { VEHICLE_SIZE, drawVehicleSprite } from '../../game/vehicles.js';
import { registerProp } from '../../game/props.js';
import { registerItem } from '../../game/items.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow } from '../../engine/gfx.js';
import { shade, mix } from '../../engine/color.js';
import { hash2 } from '../../engine/rng.js';
import { drawText } from '../../engine/font.js';
import { Z_PX, HALF_W, HALF_H } from '../../engine/constants.js';
import { toScreen } from '../../engine/iso.js';
import { homeKit } from '../rivals.js';
import { currentClub, drawClubCrest } from '../clubs.js';

const OL = '#120c14';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const fr = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
export const NEON = { pink: '#ff3aa0', cyan: '#3ae0ff', amber: '#ffc23a', green: '#5aff7a', violet: '#b06aff', orange: '#ff7a3a', red: '#ff3a4a' };

// Draw onto a vertical face plane (skewed). side 'left' = plane at fixed y (visible +y face), 'right' = fixed x.
// (x,y,z) = left end on screen, top of the drawing; fn(ctx) draws in local px (x right, y down).
function onFace(ctx, ax, ay, side, x, y, z, fn) {
  const m = proj(ax, ay, x, y, z);
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
  fn(ctx);
  ctx.restore();
}

// ====================================================================== floors
function slabPave(u, v, tx, ty, r, seed) {
  const gu = (u * 2) % 1, gv = (v * 2) % 1;
  if (gu < 0.06 || gv < 0.06) return '#33313e';
  const slab = n2(tx * 2 + Math.floor(u * 2), ty * 2 + Math.floor(v * 2), seed);
  let c = slab < 0.3 ? '#555363' : slab < 0.6 ? '#5b5969' : '#4f4d5c';
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, seed + 1);
  if (n > 0.965) c = '#787690';
  else if (n < 0.04) c = shade(c, -0.12);
  // wet neon reflections: vertical (screen) smears
  if (r < 0.16) {
    const k = Math.abs((u - v) - (r * 6 - 0.5));
    if (k < 0.07 && n > 0.25) c = mix(c, [NEON.pink, NEON.cyan, NEON.amber, NEON.violet][Math.floor(r * 25) % 4], 0.38);
  }
  return c;
}
registerFloor('city_wetPave', { pixel: (u, v, tx, ty, r) => slabPave(u, v, tx, ty, r, 31) });

function wetRoad(u, v, tx, ty, r) {
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 33);
  let c = n < 0.08 ? '#1e1e26' : n > 0.95 ? '#34343e' : '#26262f';
  // puddle sheen
  const pd = Math.hypot(u - 0.3 - r * 0.4, (v - 0.6) * 1.6);
  if (r > 0.7 && pd < 0.18) c = n > 0.5 ? '#3a4458' : '#323a4c';
  if (r > 0.7 && pd < 0.18 && Math.abs((u - v) - 0.1) < 0.04) c = '#6a6a9a';
  return c;
}
registerFloor('city_wetRoad', { pixel: wetRoad });
registerFloor('city_roadLineY', {
  pixel(u, v, tx, ty, r) {
    if (Math.abs(u - 0.5) < 0.05 && (ty % 2 === 0 ? v < 0.7 : false)) return '#d8c870';
    return wetRoad(u, v, tx, ty, r);
  },
});
registerFloor('city_busLane', {
  pixel(u, v, tx, ty, r) {
    if (u < 0.05 || u > 0.95) return '#e8dcc0';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 34);
    let c = n < 0.08 ? '#3e1a1e' : n > 0.95 ? '#5a2a2e' : '#4a2026';
    if (r > 0.8 && Math.abs((u - v) + 0.2) < 0.05) c = '#7a4a5a';
    return c;
  },
  decal(g, sx, sy, tx, ty) {
    if (ty % 5 !== 0) return;
    g.save();
    g.translate(sx + 2, sy + 12);
    g.transform(1, -0.5, 0, 1, 0, 0);
    drawText(g, 'BUS', -6, -4, { color: '#e8dcc0' });
    g.restore();
  },
});
registerFloor('city_zebra', {
  pixel(u, v, tx, ty, r) {
    if (Math.floor(u * 4) % 2 === 0 && v > 0.04 && v < 0.96) return n2(u * 32 + tx * 32, v * 32 + ty * 32, 35) < 0.07 ? '#a8a8a2' : '#d4d4cc';
    return wetRoad(u, v, tx, ty, r);
  },
});
registerFloor('city_tactile', { // dropped kerb with tactile paving at crossings
  pixel(u, v) {
    if (u < 0.06 || v < 0.06 || u > 0.94 || v > 0.94) return '#3a3644';
    const du = (u * 6) % 1, dv = (v * 6) % 1;
    return Math.hypot(du - 0.5, dv - 0.5) < 0.28 ? '#d07a5a' : '#9a4a3a';
  },
});
registerFloor('city_brickPave', { // basket-weave pedestrian brick, wet
  pixel(u, v, tx, ty, r) {
    const X = (tx + u) * 4, Y = (ty + v) * 4;
    const cx = Math.floor(X / 2), cy = Math.floor(Y / 2);
    const horiz = (cx + cy) % 2 === 0;
    const a = horiz ? Y : X, b = horiz ? X : Y;
    if ((a % 1) < 0.1 || (b % 2) < 0.07) return '#2e2228';
    const s = hash2(Math.floor(X), Math.floor(Y), 36);
    let c = s < 0.3 ? '#5e4246' : s < 0.7 ? '#664a4c' : '#563a40';
    if ((a % 1) > 0.85) c = shade(c, 0.12);
    if (r < 0.12 && Math.abs((u - v) - (r * 8 - 0.5)) < 0.06) c = mix(c, r < 0.06 ? NEON.pink : NEON.cyan, 0.35);
    return c;
  },
});
registerFloor('city_arcadeCarpet', { // garish 90s arcade carpet: navy with neon confetti shapes
  pixel(u, v, tx, ty) {
    const X = Math.floor((tx + u) * 16), Y = Math.floor((ty + v) * 16);
    const cx = Math.floor(X / 5), cy = Math.floor(Y / 5), lx = X - cx * 5, ly = Y - cy * 5;
    const h = hash2(cx, cy, 37);
    const col = ['#ff3aa0', '#3ae0ff', '#ffd23a', '#7aff5a'][Math.floor(h * 97) % 4];
    if (h < 0.18 && ((lx === 2 && ly > 0 && ly < 4) || (ly === 2 && lx > 0 && lx < 4))) return col;      // plus
    if (h > 0.18 && h < 0.32 && ly >= lx && ly < 4 && lx > 0) return col;                                 // triangle
    if (h > 0.32 && h < 0.42 && (lx + ly) % 3 === 0 && ly === Math.floor(lx / 2) + 1) return col;          // squiggle
    return (X + Y) % 7 === 0 ? '#1c1a44' : '#141432';
  },
});
registerFloor('city_taxiBay', {
  pixel(u, v, tx, ty, r) {
    if (u < 0.05 || u > 0.95) return '#e8c020';
    if (ty % 3 === 0 && v < 0.04) return '#e8c020';
    return wetRoad(u, v, tx, ty, r);
  },
  decal(g, sx, sy, tx, ty) {
    if (ty % 3 !== 1) return;
    g.save();
    g.translate(sx, sy + 12);
    g.transform(1, -0.5, 0, 1, 0, 0);
    drawText(g, 'TAXI', -10, -4, { color: '#e8c020' });
    g.restore();
  },
});
registerFloor('city_clubFloor', {
  pixel(u, v, tx, ty) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 38);
    if ((u * 2) % 1 < 0.04 || (v * 2) % 1 < 0.04) return '#251a30';
    if (n > 0.985) return '#b07ad8';
    if (n > 0.96) return '#4a2a5e';
    return n < 0.1 ? '#120c18' : '#18101f';
  },
});
export const DANCE_COLS = ['#ff3aa0', '#3ae0ff', '#ffd23a', '#7aff5a', '#b06aff', '#ff7a3a'];
registerFloor('city_dance', {
  pixel(u, v, tx, ty) {
    if (u < 0.07 || v < 0.07) return '#08080c';
    if (u > 0.94 || v > 0.94) return '#2a2a34';
    const col = DANCE_COLS[(tx * 3 + ty * 5) % DANCE_COLS.length];
    const base = mix('#0e0e16', col, 0.3);
    if (u < 0.22 && v < 0.22) return mix(base, '#ffffff', 0.25);
    return Math.abs(u - v) < 0.04 ? mix(base, '#ffffff', 0.1) : base;
  },
});
registerFloor('city_deck', { // multi-storey car park deck: concrete, oil stains, tyre marks
  pixel(u, v, tx, ty, r) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 39);
    let c = r < 0.5 ? '#4a4a52' : '#46464e';
    if (n < 0.06) c = '#3a3a42'; else if (n > 0.97) c = '#5a5a62';
    const od = Math.hypot(u - 0.5 - (r - 0.5) * 0.6, (v - 0.5) * 1.3);
    if (r > 0.75 && od < 0.22) c = n > 0.5 ? '#2a2a30' : '#2e2c34';
    if (r < 0.2 && Math.abs(u - 0.35 - v * 0.2) < 0.05) c = '#38383e';
    return c;
  },
});
registerFloor('city_bay', { // parking bay line along world x at the tile's -y edge + bay end markers
  pixel(u, v, tx, ty, r) {
    if (v < 0.06) return '#d8d0b0';
    if (u < 0.05 && v < 0.5) return '#d8d0b0';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 40);
    return n < 0.06 ? '#3a3a42' : (r < 0.5 ? '#4a4a52' : '#46464e');
  },
});
const PLAZA_C = { x: 20, y: 27 };
registerFloor('city_plaza', { // concentric ring paving around the fountain
  pixel(u, v, tx, ty) {
    const X = tx + u - PLAZA_C.x, Y = ty + v - PLAZA_C.y;
    const d = Math.hypot(X, Y) * 1.1, a = Math.atan2(Y, X);
    const ring = Math.floor(d);
    const seg = Math.floor((a + Math.PI) / (Math.PI * 2) * (8 + ring * 6));
    if (d % 1 < 0.07) return '#34303c';
    const fa = ((a + Math.PI) / (Math.PI * 2) * (8 + ring * 6)) % 1;
    if (fa < 0.05 * Math.max(1, 6 / (ring + 1))) return '#3a3644';
    const s = hash2(ring, seg, 41);
    let c = ring % 3 === 0 ? '#6e6672' : s < 0.5 ? '#5c5864' : '#56525e';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 42);
    if (n > 0.97) c = '#8a86a0';
    return c;
  },
});
registerFloor('city_water', {
  pixel(u, v, tx, ty) {
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 43);
    const w = Math.sin((tx + u) * 7 + (ty + v) * 3) > 0.85;
    return w ? '#4a7aa8' : n < 0.1 ? '#2a5070' : '#1c3a58';
  },
});
registerFloor('city_marketCobble', {
  pixel(u, v, tx, ty) {
    const cu = u * 4, cv = v * 4 + (Math.floor(u * 4) % 2) * 0.5;
    const fu = cu % 1, fv = cv % 1;
    const lit = n2(u * 32 + tx * 32, v * 32 + ty * 32, 44);
    if (lit > 0.993) return '#4a8a2a';        // cabbage leaf bits
    if (lit < 0.004) return '#d8d0c0';        // paper litter
    if (fu < 0.12 || fv < 0.12) return '#2c2830';
    const s = n2(tx * 4 + Math.floor(cu), ty * 4 + Math.floor(cv), 45);
    const base = s < 0.33 ? '#5a525c' : s < 0.66 ? '#645c66' : '#504852';
    return fu > 0.72 && fv > 0.6 ? shade(base, 0.18) : base;
  },
});
registerFloor('city_kebabTiles', {
  pixel(u, v, tx, ty) {
    if ((u * 3) % 1 < 0.06 || (v * 3) % 1 < 0.06) return '#7a7a80';
    const a = Math.floor(u * 3) + Math.floor(v * 3) + tx + ty;
    return a % 2 ? '#d8d4c8' : '#b83a2a';
  },
});

// ====================================================================== walls
const roofTop = (u, v, variant) => {
  const n = hash2(Math.floor(u * 16), Math.floor(v * 16), variant + 50);
  if (u > 0.92 || v > 0.92) return '#4a4250';
  return n < 0.1 ? '#2a2630' : n > 0.93 ? '#463e4a' : '#36303c';
};
function brickFace(base, mortar) {
  return (u, py, side, variant) => {
    const bx = u * 16, row = Math.floor(py / 4);
    const off = row % 2 ? 4 : 0;
    if (py % 4 === 3 || (Math.floor(bx + off)) % 8 === 0) return mortar;
    const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, 51);
    return s < 0.3 ? shade(base, -0.1) : s > 0.85 ? shade(base, 0.1) : base;
  };
}
const SHOP_PALS = [
  [NEON.pink, '#ffd0ea', '#5a1838'], [NEON.cyan, '#d0f6ff', '#123a48'], [NEON.amber, '#fff2c0', '#4a3a10'],
  [NEON.green, '#e0ffd0', '#1a4a14'], [NEON.violet, '#ecd8ff', '#2e1a4a'], [NEON.orange, '#ffe0c8', '#4a1e10'],
];
function upperStorey(u, py, side, variant, base = '#4a3440', mortar = '#24181e') {
  const fy = py % 40, storey = Math.floor(py / 40);
  const wu = u * 16;
  if (fy > 9 && fy < 29 && wu > 3 && wu < 13) {
    if (fy === 10 || fy === 28 || Math.floor(wu) === 4 || Math.floor(wu) === 12 || Math.floor(wu) === 8) return '#1a141c';
    const k = hash2(variant, storey + (side === 'left' ? 0 : 9), 52);
    if (k < 0.3) return fy < 18 ? '#ffd27a' : '#e0a048';          // lit
    if (k < 0.42) return fy < 18 ? '#7ab0ff' : '#4a7ad0';          // telly glow
    if (k < 0.5) return fy < 14 ? '#ff7ac0' : '#a04a80';           // pink lamp
    return (fy + Math.floor(wu)) % 9 === 0 ? '#2a3448' : '#1a2030';
  }
  if (fy === 30 && wu > 2 && wu < 14) return '#6a5a60';
  return brickFace(base, mortar)(u, py, side, variant);
}
function sideShade(c, side, k = -0.32) { return side === 'right' ? shade(c, k) : c; }

registerWall('city_neonShop', {
  top: roofTop, variants: 8,
  face(u, py, side, H, r, variant) {
    const [neon, glass, dark] = SHOP_PALS[variant % 6];
    const shut = variant === 6 || variant === 7;
    const wu = u * 16, iu = Math.floor(wu);
    const low = H - 34;
    let c;
    if (py >= low - 5 && py < low - 2) return side === 'right' ? shade(neon, -0.12) : neon;   // neon tube band
    if (py >= low - 2 && py < low) c = shade(neon, -0.6);
    else if (py >= low) {
      const fy = py - low;
      if (iu === 0 || iu === 15 || fy < 2) c = '#1e1c26';
      else if (shut) {
        c = fy % 3 === 0 ? '#3e3e48' : '#5e5e6a';
        if (variant === 7 && fy > 8 && fy < 22 && (iu * 3 + fy) % 7 === 0) c = NEON.pink;
        if (variant === 6 && fy > 12 && fy < 18 && iu > 3 && iu < 12 && (iu + fy) % 3 === 0) c = '#3ae08a';
      } else if (fy > 29) c = '#26222c';
      else {
        c = fy < 15 ? glass : mix(glass, dark, 0.45);
        if (fy > 17 && fy < 27 && hash2(iu, fy >> 1, variant + 60) < 0.25) c = mix(neon, dark, 0.3);   // goods on display
        if (iu === 8) c = '#2a2630';
        if ((iu + fy) % 11 === 0 && fy < 15) c = '#ffffff';                                           // glint
      }
    } else c = upperStorey(u, py, side, variant);
    return sideShade(c, side);
  },
});
registerWall('city_backBlock', { // generic dark building mass with a few lit windows
  top: roofTop, variants: 6,
  face(u, py, side, H, r, variant) { return sideShade(upperStorey(u, py, side, variant + 3, '#3a2c36', '#1e161c'), side); },
});
registerWall('city_arcadeFront', {
  top: roofTop, variants: 4,
  face(u, py, side, H, r, variant) {
    const low = H - 34, wu = u * 16, iu = Math.floor(wu);
    let c;
    if (py >= low - 8 && py < low) { // marquee with chasing bulbs
      if (py === low - 8 || py === low - 1) c = '#2a1a3a';
      else c = (py === low - 5 && iu % 2 === 0) ? '#fff2a0' : '#6a2a9a';
    } else if (py >= low) {
      const fy = py - low;
      if (iu === 0 || iu === 15 || fy < 2 || fy > 30) c = '#1a1424';
      else {
        c = fy < 16 ? '#3a1a5a' : '#2a1244';
        const h = hash2(iu >> 1, fy >> 1, variant + 61);
        if (h < 0.12) c = ['#ff3aa0', '#3ae0ff', '#ffd23a', '#7aff5a'][Math.floor(h * 100) % 4];
        if (fy % 8 === 0) c = '#6a3a9a';
      }
    } else c = upperStorey(u, py, side, variant, '#3a2440', '#1c1020');
    return sideShade(c, side);
  },
});
registerWall('city_arcadeInside', { // arcade interior: dark violet with neon strip and game posters
  top: (u, v) => (u > 0.88 || v > 0.88 ? '#6a3a9a' : '#1a1028'),
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, iu = Math.floor(wu);
    let c = (iu + Math.floor(py / 2)) % 9 === 0 ? '#22163a' : '#1a1030';
    if (py >= 6 && py < 8) c = variant % 2 ? NEON.cyan : NEON.pink;
    if (py > H - 6) c = '#0e0a18';
    if (variant % 4 === 1 && py > 14 && py < 34 && iu > 3 && iu < 13) {           // poster
      const pc = ['#ff3aa0', '#ffd23a', '#3ae0ff'][Math.floor(py / 7) % 3];
      c = iu === 4 || iu === 12 || py === 15 || py === 33 ? '#e8e0c8' : (hash2(iu, py >> 1, 72) < 0.3 ? pc : '#2a1a4a');
    }
    if (variant % 4 === 3 && py > 16 && py < 30 && iu > 5 && iu < 11) c = (iu + py) % 2 ? '#7aff5a' : '#0a2a0a';   // 'HI SCORE' panel
    return sideShade(c, side, -0.25);
  },
});
registerWall('city_kebabInside', { // kebab shop interior: white tiles to head height, menu boards, grubby above
  top: roofTop, variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, iu = Math.floor(wu);
    const tileTop = H - 36;
    let c;
    if (py >= tileTop) {
      const fy = py - tileTop;
      c = (iu % 4 === 0 || fy % 4 === 0) ? '#9a9a96' : (hash2(iu >> 2, fy >> 2, 73) < 0.08 ? '#c8c0a8' : '#dcdad0');
      if (fy > 4 && fy < 9) c = '#c82a1a';
      if (variant % 2 === 0 && fy > 11 && fy < 22 && iu > 1 && iu < 15) c = (fy === 12 || fy === 21) ? '#2a1a14' : ((iu + fy) % 4 === 0 ? '#ffe0a0' : '#1a1410');   // menu board
    } else c = upperStorey(u, py, side, variant + 5, '#3a2c2a', '#1e1614');
    return sideShade(c, side, -0.25);
  },
});
registerWall('city_kebabFront', {
  top: roofTop, variants: 4,
  face(u, py, side, H, r, variant) {
    const low = H - 34, wu = u * 16, iu = Math.floor(wu);
    let c;
    if (py >= low - 6 && py < low) c = py % 2 ? '#e8e0c0' : '#c82a1a';     // striped fascia
    else if (py >= low) {
      const fy = py - low;
      if (iu === 0 || iu === 15 || fy < 2) c = '#2a1a14';
      else if (fy > 26) c = '#e8e4dc';
      else {
        c = fy < 14 ? '#fff0b0' : '#e8c070';
        const spit = Math.hypot((wu - 8) * 0.9, (fy - 15) * 0.5);
        if (Math.abs(wu - 8) < 3.5 - Math.abs(fy - 14) * 0.15 && fy > 5 && fy < 25) c = (fy % 3 === 0) ? '#6a3010' : '#9a5420';
        else if (spit < 1 && fy === 4) c = '#9a9aa0';
      }
    } else c = upperStorey(u, py, side, variant, '#5a3a34', '#2a1a18');
    return sideShade(c, side);
  },
});
registerWall('city_hotel', {
  top: roofTop, variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, iu = Math.floor(wu);
    const fy = py % 24, storey = Math.floor(py / 24);
    let c = (iu === 0) ? '#3a3448' : '#5a5466';
    if (py > H - 30) { // lobby glass
      const gy = py - (H - 30);
      c = gy < 2 || iu === 0 || iu === 8 ? '#2a2632' : gy < 14 ? '#ffe2a8' : '#d8a860';
    } else if (fy > 5 && fy < 19 && wu > 2 && wu < 14) {
      const k = hash2(variant * 5 + iu, storey + (side === 'left' ? 0 : 3), 62);
      c = fy === 6 || iu === 8 ? '#2a2632' : k < 0.35 ? (fy < 12 ? '#ffd890' : '#d8a050') : k < 0.45 ? '#7aa0ff' : '#202838';
    } else if (fy === 21) c = '#7a7488';
    return sideShade(c, side);
  },
});
registerWall('city_galleria', { // 70s shopping-centre concrete with mirrored glass bands
  top: (u, v, variant) => {
    const n = hash2(Math.floor(u * 16), Math.floor(v * 16), variant + 63);
    if (variant % 5 === 0 && u > 0.3 && u < 0.7 && v > 0.3 && v < 0.7) return u > 0.62 || v > 0.62 ? '#5a5a64' : '#7a7a86'; // vent units
    return n < 0.15 ? '#3e3e46' : n > 0.92 ? '#5e5e66' : '#4a4a52';
  },
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c;
    const band = py % 24;
    if (band > 6 && band < 18) {
      c = ((wu + py * 0.5) % 10) < 1.5 ? '#9ab0d0' : '#2c3a52';
      if (Math.floor(wu) % 8 === 0) c = '#1a2232';
    } else {
      const n = hash2(Math.floor(wu) + variant * 3, py, 64);
      c = n < 0.05 ? '#5a5a60' : '#6a6a70';
      if (band === 0) c = '#4a4a50';
      if (band > 18 && band < 21 && variant % 3 === 0) c = NEON.cyan;
    }
    return sideShade(c, side);
  },
});
registerWall('city_tunnel', { // road tunnel mouth under the galleria
  top: (u, v, variant) => hash2(Math.floor(u * 16), Math.floor(v * 16), variant + 65) < 0.15 ? '#3e3e46' : '#4a4a52',
  variants: 2,
  face(u, py, side, H) {
    const wu = u * 16;
    let c;
    if (py < 4) c = '#6a6a70';
    else if (py < 11) c = (Math.floor(wu + py) % 6 < 3) ? '#e8c020' : '#1a1a1a';    // chevron lintel
    else if (py < 13) c = '#4a4a50';
    else {
      const d = (py - 13) / (H - 13);
      c = d < 0.15 ? '#0e0e14' : '#06060a';
      if (py === 16 && Math.floor(wu) % 4 === 1) c = '#ffd890';                    // tunnel lamps
    }
    return sideShade(c, side, -0.2);
  },
});
registerWall('city_railing', { // municipal green railings with spear tops (see-through)
  top: (u, v) => (v > 0.88 || u > 0.88 ? '#2e4a3a' : null),
  variants: 1,
  face(u, py, side, H) {
    const wu = u * 16, iu = Math.floor(wu);
    const bar = iu % 3 === 1;
    const base = side === 'right' ? '#1e3226' : '#2e4a3a';
    if (bar && py < 2) return '#c8a040';               // gilded spear tips
    if (py >= 3 && py < 5) return base;
    if (py >= H - 6 && py < H - 4) return base;
    if (bar) return py % 7 === 0 ? shade(base, 0.2) : base;
    if (iu === 0 && py > 3) return shade(base, -0.2);
    return null;
  },
});
registerWall('city_clubWall', {
  top: (u, v) => (v > 0.85 || u > 0.85 ? '#ff3aa0' : '#1a141e'),
  variants: 4,
  face(u, py, side, H, r, variant) {
    if (py < 2) return '#2a2030';
    if (py >= 3 && py < 5) return variant % 2 ? NEON.violet : NEON.pink;
    const c = brickFace('#2a2232', '#120e16')(u, py, side, variant);
    return sideShade(c, side, -0.35);
  },
});
registerWall('city_clubInside', { // quilted velvet wall with gold dado rail
  top: '#1a1020', variants: 2,
  face(u, py, side, H) {
    const wu = u * 16;
    let c;
    if (py < 3) c = '#2a1830';
    else if (py > H - 16 && py < H - 13) c = '#c8a040';
    else if (py >= H - 13) c = '#1a1018';
    else {
      const a = (wu + py) % 8, b = (wu - py + 80) % 8;
      c = a < 0.8 || b < 0.8 ? '#3a1050' : (py % 8 < 4 ? '#5e1a78' : '#521668');
      if (Math.abs(a - 4) < 0.6 && Math.abs(b - 4) < 0.6) c = '#c8a040';
    }
    return sideShade(c, side);
  },
});
registerWall('city_bar', { // bar counter
  top: (u, v) => (v > 0.8 || u > 0.8 ? '#8a5a30' : (Math.floor((u + v) * 10) % 3 === 0 ? '#5a2e18' : '#4a2412')),
  variants: 2,
  face(u, py, side, H) {
    const wu = u * 16;
    let c = py < 2 ? '#c8a040' : py === H - 5 ? '#c8a040' : (Math.floor(wu) % 5 === 0 ? '#2a140a' : '#4a2814');
    if (py > 3 && py < H - 6 && Math.floor(wu) % 5 === 2) c = '#5a3018';
    return sideShade(c, side);
  },
});
registerWall('city_djBooth', {
  top: (u, v) => (u > 0.85 || v > 0.85 ? '#3a3a44' : '#16161c'),
  variants: 3,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, iu = Math.floor(wu);
    if (py < 2) return '#3a3a44';
    if (py > 4 && py < H - 3 && iu % 3 === 1 && py % 3 === 1) return DANCE_COLS[(iu + py + variant) % DANCE_COLS.length];
    return side === 'right' ? '#0e0e12' : '#18181e';
  },
});
registerWall('city_counter', { // kebab shop counter: steel top, tiled front
  top: (u, v) => ((u + v) * 8 % 1 < 0.15 ? '#c8ccd4' : '#a8acb4'),
  variants: 1,
  face(u, py, side) {
    const wu = u * 16;
    let c = py < 2 ? '#d8dce4' : py < 5 ? '#c82a1a' : ((Math.floor(wu / 4) + Math.floor(py / 4)) % 2 ? '#e8e4dc' : '#d0ccc4');
    if (py >= 5 && (Math.floor(wu) % 4 === 0 || py % 4 === 0)) c = '#8a8a90';
    return sideShade(c, side, -0.25);
  },
});
registerWall('city_pillar', { // car park column with hazard stripes and level paint
  top: '#5a5a62', variants: 2,
  face(u, py, side, H) {
    const wu = u * 16;
    let c = hash2(Math.floor(wu), py, 66) < 0.05 ? '#4a4a52' : '#6a6a72';
    if (py > H - 14) c = (Math.floor(wu + py) % 6 < 3) ? '#e8c020' : '#1a1a1e';
    if (py > 10 && py < 22 && wu > 4 && wu < 12) c = '#2a5ab8';
    if (py > 13 && py < 19 && wu > 6 && wu < 10 && (Math.floor(wu) === 7 || py === 16)) c = '#ffffff';
    return sideShade(c, side);
  },
});
registerWall('city_stairwell', {
  top: (u, v, variant) => (u > 0.9 || v > 0.9 ? '#7a7a82' : hash2(Math.floor(u * 16), Math.floor(v * 16), variant + 67) < 0.1 ? '#4a4a52' : '#5a5a62'),
  variants: 3,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c = hash2(Math.floor(wu) + variant, py, 68) < 0.05 ? '#4e4e56' : '#5e5e66';
    if (py % 12 === 0) c = '#4a4a52';
    if (variant === 1 && side === 'left' && wu > 4 && wu < 12 && py > H - 30) c = Math.floor(wu) === 4 || py === H - 29 ? '#1a3a24' : '#2a6a3a';
    if (variant === 2 && side === 'left' && wu > 5 && wu < 11 && py > 6 && py < 11) c = '#3aff7a';
    return sideShade(c, side);
  },
});
registerWall('city_lowWall', { // brick planter wall topped with shrubs
  top: (u, v, variant) => {
    const n = hash2(Math.floor(u * 12), Math.floor(v * 12), variant + 69);
    if (u > 0.9 || v > 0.9) return '#7a6a6a';
    return n < 0.3 ? '#1e3a1e' : n > 0.85 ? '#3e6a30' : '#2a4a26';
  },
  variants: 3,
  face(u, py, side, H, r, variant) {
    if (py < 2) return sideShade('#8a7a7a', side);
    return sideShade(brickFace('#6a4440', '#2e1e1e')(u, py, side, variant), side);
  },
});
registerWall('city_marketWall', { // brick with roller shutters and fly-posters
  top: roofTop, variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = u * 16, iu = Math.floor(wu);
    const low = H - 32;
    let c;
    if (py >= low) {
      const fy = py - low;
      if (variant % 3 === 0 && iu > 1 && iu < 15) c = fy % 3 === 0 ? '#3a3a42' : '#5a5a64';
      else if (variant % 3 === 1 && iu > 2 && iu < 13 && fy > 6 && fy < 24) {
        const pc = ['#e8e0c0', '#ffd23a', '#ff8ac0', '#8ad0ff'][(iu >> 2) % 4];
        c = (fy + iu) % 5 === 0 ? '#2a2a2a' : pc;
      } else c = brickFace('#5a3a34', '#261816')(u, py, side, variant);
    } else c = upperStorey(u, py, side, variant + 9, '#4a3430', '#221614');
    return sideShade(c, side);
  },
});
registerWall('city_rim', { // fountain basin rim (low stone)
  top: (u, v) => (u > 0.85 || v > 0.85 || u < 0.08 || v < 0.08 ? '#aaa6b0' : '#8a8692'),
  variants: 2,
  face(u, py, side) {
    const wu = u * 16;
    const c = py < 2 ? '#b0acb8' : (Math.floor(wu) % 8 === 0 ? '#5a5664' : '#7a7684');
    return sideShade(c, side, -0.28);
  },
});

// ====================================================================== shared car / vehicle drawing
// Draws a car-ish vehicle in an isoBox-local frame. alongX: long axis along world x.
function drawCar(ctx, ax, ay, alongX, o) {
  const W = alongX ? (o.len || 2) : 1, D = alongX ? 1 : (o.len || 2);
  const body = o.color || '#e8b818';
  const P = (x, y, z) => proj(ax, ay, x, y, z);
  const wh = (x, y) => { const s = P(x, y, 0.15); ellipse(ctx, s.x, s.y, 3.5, 3, '#0c0c0e'); ellipse(ctx, s.x, s.y, 1.5, 1, '#5a5a62'); };
  if (alongX) { wh(0.4, 0.92); wh(W - 0.4, 0.92); } else { wh(0.92, 0.4); wh(0.92, D - 0.4); }
  isoBox(ctx, ax, ay, 0.06, 0.08, 0.18, W - 0.12, D - 0.16, 0.48, { color: body, outline: OL });
  // chequer stripe on the visible side
  if (o.chequer) {
    const n = Math.floor((alongX ? W : D) * 6);
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      const t0 = 0.1 + i / 6;
      if (alongX) isoPanel(ctx, ax, ay, 'left', t0, D - 0.08, 1 / 6, 0.36, 0.46, '#141418');
      else isoPanel(ctx, ax, ay, 'right', W - 0.06, t0, 1 / 6, 0.36, 0.46, '#141418');
    }
  }
  const cab = alongX ? [0.45, 0.14, W - 0.95, 0.72] : [0.14, 0.45, 0.72, D - 0.95];
  isoBox(ctx, ax, ay, cab[0], cab[1], 0.66, cab[2], cab[3], 0.38, { top: shade(body, 0.12), left: '#7a9ab8', right: '#4a6a88', outline: OL });
  // reflections
  const r1 = alongX ? P(cab[0] + 0.15, D - 0.15, 1.0) : P(W - 0.15, cab[1] + 0.15, 1.0);
  fr(ctx, '#c8e0f0', r1.x, r1.y, 2, 1);
  if (o.roofSign) {
    const m = alongX ? [W / 2 - 0.15, 0.4] : [0.4, D / 2 - 0.15];
    isoBox(ctx, ax, ay, m[0], m[1], 1.04, 0.3, 0.2, 0.12, { color: o.signOff ? '#6a6050' : '#ffe27a', outline: OL });
  }
  // lights
  const front = o.front ?? 1;  // +1: front at high end
  const fl = alongX ? (front > 0 ? [P(W - 0.02, 0.25, 0.42), P(W - 0.02, 0.75, 0.42)] : [P(0.02, 0.25, 0.42), P(0.02, 0.75, 0.42)])
    : (front > 0 ? [P(0.25, D - 0.02, 0.42), P(0.75, D - 0.02, 0.42)] : [P(0.25, 0.02, 0.42), P(0.75, 0.02, 0.42)]);
  for (const q of fl) fr(ctx, '#fff6c8', q.x - 1, q.y - 1, 3, 2);
  const bl = alongX ? (front > 0 ? P(0.02, 0.5, 0.42) : P(W - 0.02, 0.5, 0.42)) : (front > 0 ? P(0.5, 0.02, 0.42) : P(0.5, D - 0.02, 0.42));
  fr(ctx, '#ff2a2a', bl.x - 2, bl.y - 1, 4, 2);
}

// Night bus: long double-decker, green/cream livery, lit windows, LED destination.
function drawBus(ctx, ax, ay, alongX, len, front, t) {
  const W = alongX ? len : 1, D = alongX ? 1 : len;
  const P = (x, y, z) => proj(ax, ay, x, y, z);
  const wh = (x, y) => { const s = P(x, y, 0.2); ellipse(ctx, s.x, s.y, 4.5, 4, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 1.5, '#6a6a72'); };
  if (alongX) { wh(0.8, 0.95); wh(W - 0.9, 0.95); } else { wh(0.95, 0.8); wh(0.95, D - 0.9); }
  isoBox(ctx, ax, ay, 0.04, 0.04, 0.18, W - 0.08, D - 0.08, 2.5, { top: '#d8d4c0', left: '#2a6a4a', right: '#1c4a34', outline: OL });
  const side = alongX ? 'left' : 'right';
  const L = alongX ? W : D;
  const panel = (a, l, z0, z1, c) => alongX ? isoPanel(ctx, ax, ay, 'left', a, D - 0.04, l, z0, z1, c) : isoPanel(ctx, ax, ay, 'right', W - 0.04, a, l, z0, z1, c);
  panel(0.04, L - 0.08, 1.2, 1.4, '#e8e0c0');      // cream band
  panel(0.04, L - 0.08, 2.35, 2.5, '#e8e0c0');
  const nW = Math.floor(L / 0.55);
  for (let i = 0; i < nW; i++) {
    const a = 0.2 + i * (L - 0.4) / nW, l = (L - 0.4) / nW - 0.08;
    const lit = hash2(i, Math.floor(t * 0.2), 70) < 0.85;
    panel(a, l, 0.6, 1.1, lit ? '#ffe8a8' : '#3a4a5a');
    panel(a, l, 1.6, 2.2, lit ? '#ffd890' : '#3a4a5a');
  }
  // front end: destination LED + windscreen
  const fz = front > 0 ? L - 0.04 : 0.04;
  if (alongX) {
    isoPanel(ctx, ax, ay, 'right', fz, 0.1, 0.8, 2.2, 2.45, '#141010');
    isoPanel(ctx, ax, ay, 'right', fz, 0.1, 0.8, 0.6, 1.5, '#6a8ab0');
    const m = P(fz, 0.5, 2.33); drawText(ctx, 'N7', m.x - 5, m.y - 4, { color: '#ffa020' });
  } else if (front > 0) {
    isoPanel(ctx, ax, ay, 'left', 0.1, fz, 0.8, 2.2, 2.45, '#141010');
    isoPanel(ctx, ax, ay, 'left', 0.1, fz, 0.8, 0.6, 1.5, '#6a8ab0');
    const m = P(0.5, fz, 2.33); drawText(ctx, 'N7', m.x - 5, m.y - 4, { color: '#ffa020' });
  }
  void side;
}

const TUNNEL = { y0: 17, y1: 38 };   // road segment hidden under the galleria (level geometry)
export function setTunnel(y0, y1) { TUNNEL.y0 = y0; TUNNEL.y1 = y1; }

// Custom vehicle renderer for traffic hazards (hazard.draw). Vehicles drive along world y.
export function drawCityVehicle(ctx, v, world) {
  if (v.y > TUNNEL.y0 + 1.5 && v.y < TUNNEL.y1 - 1.5) return; // fully inside the tunnel
  const style = v.vstyle || v.def.vehicleStyle || 'car';
  const len = (VEHICLE_SIZE[style] || VEHICLE_SIZE.car).L;
  const front = v.dy > 0 ? 1 : -1;
  const s = toScreen(v.x - 0.5, v.y - len / 2, 0);
  // clip away the part that is inside the tunnel (vertical screen line through the portal plane)
  ctx.save();
  const north = v.y < (TUNNEL.y0 + TUNNEL.y1) / 2;
  const cx = (v.x - (north ? TUNNEL.y0 : TUNNEL.y1)) * HALF_W;
  ctx.beginPath();
  if (north) ctx.rect(cx, s.y - 400, 800, 1200); else ctx.rect(cx - 800, s.y - 400, 800, 1200);
  ctx.clip();
  const g = toScreen(v.x, v.y, 0);
  shadow(ctx, g.x, g.y, style === 'bus' ? 30 : 16, style === 'bus' ? 16 : 9, 0.4);
  if (drawVehicleSprite(ctx, v, style)) { /* full-scale Blender vehicle */ }
  else if (style === 'bus') drawBus(ctx, Math.round(s.x), Math.round(s.y), false, len, front, world.time);
  else drawCar(ctx, Math.round(s.x), Math.round(s.y), false, { color: v.color, len, front, roofSign: style === 'taxi', chequer: style === 'taxi' });
  ctx.restore();
  world.lightsDynamic = world.lightsDynamic || [];
  world.lightsDynamic.push({ x: v.x + v.dx * (len / 2 + 1.2), y: v.y + v.dy * (len / 2 + 1.2), z: 0.4, r: style === 'bus' ? 4 : 3.2, color: '#fff0c0', intensity: 0.75 });
  if (style === 'bus') world.lightsDynamic.push({ x: v.x, y: v.y, z: 1.5, r: 3, color: '#ffe0a0', intensity: 0.5 });
}

// ====================================================================== props
registerProp('city_taxi', { // parked taxi; dir 'y' (default) = long along world y. Full scale: 5 x 2 tiles
  w: 5, d: 2, h: 1.6, rotates: true, defaultDir: 'y',
  draw(ctx, ax, ay, p) {
    const alongX = p.dir === 'x';
    const s = proj(ax, ay, alongX ? 1 : 0.5, alongX ? 0.5 : 1, 0);
    shadow(ctx, s.x, s.y, 18, 9, 0.4);
    drawCar(ctx, ax, ay, alongX, { color: p.o.color || '#e8b818', len: 2, front: 1, roofSign: true, chequer: true, signOff: p.o.signOff });
  },
});
registerProp('city_taxiSign', {
  h: 0.4,
  light: { z: 2.4, r: 2.5, color: '#ffe27a', intensity: 0.6 },
  draw(ctx, ax, ay) {
    const b = proj(ax, ay, 0.5, 0.5, 0), t = proj(ax, ay, 0.5, 0.5, 2.2);
    thick(ctx, b.x, b.y, t.x, t.y, 4, OL); thick(ctx, b.x, b.y, t.x, t.y, 2, '#5a5a62');
    fr(ctx, OL, t.x - 15, t.y - 12, 30, 12);
    fr(ctx, '#ffe27a', t.x - 14, t.y - 11, 28, 10);
    drawText(ctx, 'TAXI', t.x, t.y - 9, { color: '#141418', align: 'center' });
  },
});
registerProp('city_busShelter', { // w1 d2 along y; glass back on -x, roof, lit advert at the +y end
  w: 1, d: 2, h: 2.0,
  light: { z: 1.4, r: 2.4, color: '#c8e0ff', intensity: 0.5 },
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const post = (x, y) => { const a = P(x, y, 0), b = P(x, y, 1.95); thick(ctx, a.x, a.y, b.x, b.y, 2, '#3a3a44'); };
    post(0.15, 0.1); post(0.15, 1.9); post(0.85, 0.1);
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.08, 1.8, 1.8, { top: '#9ab8d0', left: '#8ab0d0', right: '#5a7a98' });
    ctx.globalAlpha = 0.35; isoPanel(ctx, ax, ay, 'right', 0.18, 0.1, 1.8, 0.2, 1.75, '#b0d0f0'); ctx.globalAlpha = 1;
    isoBox(ctx, ax, ay, 0.3, 0.6, 0.45, 0.4, 0.9, 0.08, { color: '#5a5a66', outline: OL });   // bench
    // advert box at +y end
    isoBox(ctx, ax, ay, 0.15, 1.82, 0.1, 0.7, 0.14, 1.6, { top: '#3a3a44', left: '#e8f0ff', right: '#3a3a44', outline: OL });
    onFace(ctx, ax, ay, 'left', 0.2, 1.97, 1.55, g => {
      fr(g, '#1f2a5a', 1, 1, 20, 22);
      drawText(g, 'N7', 4, 3, { color: '#ffd23a' });
      drawText(g, 'DOCKS', 2, 12, { color: '#ffffff' });
    });
    isoBox(ctx, ax, ay, 0.0, 0.0, 1.95, 1.0, 2.0, 0.1, { color: '#2a2a34', outline: OL });
    const s = P(0.5, 0.1, 2.05); drawText(ctx, 'BUS', s.x - 8, s.y - 9, { color: '#ffffff', outline: '#1a3a8a' });
    void t;
  },
});
registerProp('city_kebabVan', { // w2 d1: white van with lit serving hatch
  w: 2, d: 1, h: 1.6,
  light: { z: 1.4, r: 3.4, color: '#ffd27a', intensity: 0.85 },
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const s = P(1, 0.5, 0); shadow(ctx, s.x, s.y, 22, 10, 0.4);
    for (const [x, y] of [[0.4, 0.9], [1.6, 0.9]]) { const q = P(x, y, 0.18); ellipse(ctx, q.x, q.y, 3.5, 3, '#0c0c0e'); }
    isoBox(ctx, ax, ay, 0.04, 0.08, 0.2, 1.92, 0.84, 1.4, { top: '#d8d8d0', left: '#e8e6de', right: '#b0aea6', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.5, 0.92, 1.1, 0.8, 1.35, OL);
    isoPanel(ctx, ax, ay, 'left', 0.55, 0.92, 1.0, 0.84, 1.31, '#ffe8a0');
    // menu & kebab silhouette in hatch
    onFace(ctx, ax, ay, 'left', 0.6, 0.93, 1.3, g => { fr(g, '#8a4a1a', 22, 2, 5, 7); fr(g, '#c87a3a', 23, 2, 2, 7); fr(g, '#3a2a1a', 3, 3, 12, 1); fr(g, '#3a2a1a', 3, 5, 10, 1); });
    isoBox(ctx, ax, ay, 0.45, 0.92, 1.38, 1.2, 0.3, 0.06, { color: '#c82a1a', outline: OL });   // awning
    isoBox(ctx, ax, ay, 0.5, 0.95, 0.72, 1.1, 0.18, 0.05, { color: '#a8acb4', outline: OL });    // counter ledge
    onFace(ctx, ax, ay, 'left', 0.2, 0.93, 0.62, g => drawText(g, 'KEBABS', 4, 0, { color: '#c82a1a' }));
    const q = P(0.15, 0.5, 1.62);
    if (Math.sin(t * 2) > 0) { fr(ctx, '#d8d8e0', q.x, q.y - 6, 1, 3); fr(ctx, '#d8d8e0', q.x + 2, q.y - 10, 1, 3); }   // steam
  },
});
registerProp('city_cashpoint', { // free-standing cash machine: give it a kicking, it pays out
  h: 1.4,
  light: { z: 1.0, r: 1.6, color: '#5affb0', intensity: 0.5 },
  breakable: { hp: 30, debris: ['#7a7e88', '#3a3e48', '#5affb0'], sfx: 'metal', drops: [['cash5', 1], ['cash5', 0.8], ['cash20', 0.6], ['coin', 1], ['coin', 0.8]], score: 300 },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.2, 0.2, 0, 0.6, 0.6, 1.4, { top: '#5a5e68', left: '#7a7e88', right: '#4a4e58', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.28, 0.81, 0.44, 0.85, 1.2, OL);
    const blink = Math.floor(t * 2) % 2;
    isoPanel(ctx, ax, ay, 'left', 0.31, 0.81, 0.38, 0.88, 1.17, blink ? '#3affa0' : '#2ad080');
    isoPanel(ctx, ax, ay, 'left', 0.3, 0.81, 0.4, 0.55, 0.62, '#1a1a20');
    onFace(ctx, ax, ay, 'left', 0.22, 0.81, 1.36, g => drawText(g, 'CASH', 0, 0, { color: '#ffffff' }));
    if (p.hp < 30) { const m = proj(ax, ay, 0.5, 0.8, 0.9); fr(ctx, '#ffffff', m.x - 3, m.y - 4, 7, 1); fr(ctx, '#ffffff', m.x, m.y - 6, 1, 5); }
  },
});
registerProp('city_arcadeCab', { // arcade cabinet; o.color body, o.screen hue index. Breaks into coins.
  h: 1.6,
  breakable: { hp: 18, debris: ['#2a2a3a', '#ff3aa0', '#3ae0ff', '#c8e8ff'], sfx: 'glass', drops: [['coin', 1], ['coin', 0.8], ['coin', 0.6], ['cash5', 0.25]], score: 120 },
  light: { z: 1.3, r: 1.6, color: '#8a6aff', intensity: 0.55 },
  draw(ctx, ax, ay, p, t) {
    const c = p.o.color || '#3a1a6a';
    const face = p.o.face || 'left';
    isoBox(ctx, ax, ay, 0.18, 0.18, 0, 0.64, 0.64, 1.6, { color: c, outline: OL });
    const scr = DANCE_COLS[(p.o.screen ?? p.x) % DANCE_COLS.length];
    if (face === 'left') {
      isoPanel(ctx, ax, ay, 'left', 0.24, 0.83, 0.52, 0.9, 1.35, '#06060a');
      onFace(ctx, ax, ay, 'left', 0.27, 0.83, 1.33, g => {
        const k = Math.floor(t * 8 + p.x);
        for (let i = 0; i < 6; i++) fr(g, i % 2 ? scr : '#ffffff', 1 + ((k + i * 5) % 12), 1 + ((k * 3 + i * 7) % 7), 1, 1);
        fr(g, scr, 1 + (k % 13), 7, 3, 1);
      });
      isoPanel(ctx, ax, ay, 'left', 0.2, 0.83, 0.6, 1.4, 1.58, mix(scr, '#ffffff', 0.4));
      isoBox(ctx, ax, ay, 0.2, 0.82, 0.75, 0.6, 0.12, 0.08, { color: '#1a1a22' });
      const j = proj(ax, ay, 0.4, 0.88, 0.85); fr(ctx, '#ff2a2a', j.x, j.y - 3, 2, 2); fr(ctx, '#ffd23a', j.x + 5, j.y - 1, 2, 2);
    } else {
      isoPanel(ctx, ax, ay, 'right', 0.83, 0.24, 0.52, 0.9, 1.35, '#06060a');
      onFace(ctx, ax, ay, 'right', 0.83, 0.27, 1.33, g => {
        const k = Math.floor(t * 8 + p.y);
        for (let i = 0; i < 6; i++) fr(g, i % 2 ? scr : '#ffffff', 1 + ((k + i * 5) % 12), 1 + ((k * 3 + i * 7) % 7), 1, 1);
      });
      isoPanel(ctx, ax, ay, 'right', 0.83, 0.2, 0.6, 1.4, 1.58, mix(scr, '#ffffff', 0.4));
    }
  },
});
registerProp('city_clawMachine', {
  h: 1.8,
  light: { z: 1.6, r: 1.8, color: '#ff7ac0', intensity: 0.5 },
  breakable: { hp: 22, debris: ['#c8e8ff', '#ff7ac0', '#ffd23a'], sfx: 'glass', drops: [['coin', 0.8], ['energy', 0.5]], score: 150 },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.12, 0.12, 0, 0.76, 0.76, 0.7, { color: '#c82a6a', outline: OL });
    // plushies
    for (const [x, y, c] of [[0.3, 0.6, '#ffd23a'], [0.55, 0.4, '#7aff5a'], [0.6, 0.7, '#3ae0ff'], [0.35, 0.35, '#ff8ac0']]) { const q = proj(ax, ay, x, y, 0.72); ellipse(ctx, q.x, q.y - 2, 3, 2.5, c); fr(ctx, OL, q.x, q.y - 3, 1, 1); }
    ctx.globalAlpha = 0.3; isoBox(ctx, ax, ay, 0.12, 0.12, 0.7, 0.76, 0.76, 0.9, { top: '#c8e8ff', left: '#a0c8f0', right: '#7090c0' }); ctx.globalAlpha = 1;
    const cx = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.9)), cl = proj(ax, ay, cx, 0.5, 1.55), cl2 = proj(ax, ay, cx, 0.5, 1.15);
    line(ctx, cl.x, cl.y, cl2.x, cl2.y, '#c8c8d0'); fr(ctx, '#c8c8d0', cl2.x - 2, cl2.y, 5, 1); fr(ctx, '#c8c8d0', cl2.x - 2, cl2.y, 1, 3); fr(ctx, '#c8c8d0', cl2.x + 2, cl2.y, 1, 3);
    isoBox(ctx, ax, ay, 0.1, 0.1, 1.6, 0.8, 0.8, 0.2, { color: '#c82a6a', outline: OL });
    const s = proj(ax, ay, 0.5, 0.9, 1.7); drawText(ctx, 'GRAB', s.x - 8, s.y - 2, { color: '#ffd23a' });
  },
});
registerProp('city_pelican', { // crossing button post with red/green man; USE = cross (level supplies onOpen)
  h: 0, solid: false, interact: { kind: 'switch', key: null },
  update(p, world, dt) { if (p.greenT > 0) p.greenT -= dt; },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 2.3);
    thick(ctx, b.x, b.y, top.x, top.y, 4, OL); thick(ctx, b.x, b.y, top.x, top.y, 2, '#3a3e48');
    // button box
    fr(ctx, OL, b.x - 4, b.y - 25, 8, 9); fr(ctx, '#e8c020', b.x - 3, b.y - 24, 6, 7);
    const wait = p.greenT > 0;
    fr(ctx, wait ? '#ff6a2a' : '#4a2a1a', b.x - 2, b.y - 23, 4, 2);
    fr(ctx, '#1a1a1a', b.x - 1, b.y - 20, 2, 2);
    // signal head
    fr(ctx, OL, top.x - 5, top.y - 14, 10, 15); fr(ctx, '#1a1a20', top.x - 4, top.y - 13, 8, 13);
    const green = wait && (p.greenT > 1.5 || Math.floor(t * 6) % 2);
    const man = (yy, col, walking) => {
      fr(ctx, col, top.x - 1, yy, 2, 2); fr(ctx, col, top.x - 1, yy + 2, 2, 3);
      if (walking) { fr(ctx, col, top.x - 2, yy + 5, 1, 1); fr(ctx, col, top.x + 1, yy + 5, 1, 1); } else fr(ctx, col, top.x - 1, yy + 5, 2, 1);
    };
    man(top.y - 12, green ? '#2a3a2a' : '#ff3a3a', false);
    man(top.y - 6, green ? '#5aff7a' : '#1a2a1a', true);
    const near = p.o.hint !== false && !wait;
    if (near && Math.floor(t * 2) % 2) drawText(ctx, 'PUSH', b.x, b.y - 34, { color: '#e8c020', align: 'center', outline: OL });
  },
});
function drawDoorLeaf(ctx, ax, ay, p, col, trim, porthole) {
  const alongX = p.o.dir !== 'y';
  if (alongX) isoBox(ctx, ax, ay, 0, 0.42, 0, 1, 0.16, 2.0, { color: col, outline: OL });
  else isoBox(ctx, ax, ay, 0.42, 0, 0, 0.16, 1, 2.0, { color: col, outline: OL });
  const side = alongX ? 'left' : 'right';
  const k = alongX ? [0.15, 0.59] : [0.59, 0.15];
  isoPanel(ctx, ax, ay, side, k[0], k[1], 0.7, 1.85, 1.92, trim);
  if (porthole) { const m = alongX ? proj(ax, ay, 0.5, 0.59, 1.5) : proj(ax, ay, 0.59, 0.5, 1.5); ellipse(ctx, m.x, m.y, 3, 3, trim); ellipse(ctx, m.x, m.y, 2, 2, '#ff7ac0'); }
  return side;
}
registerProp('city_clubDoor', { // padded club door; opens when the level says so
  h: 2.0, interact: { kind: 'door', key: null },
  draw(ctx, ax, ay, p) {
    if (p.open) return;
    drawDoorLeaf(ctx, ax, ay, p, '#2a1236', '#c8a040', true);
  },
});
registerProp('city_fireDoor', {
  h: 2.0, interact: { kind: 'door', key: null },
  draw(ctx, ax, ay, p) {
    if (p.open) return;
    const side = drawDoorLeaf(ctx, ax, ay, p, '#2a6a3a', '#c8c8c0', false);
    const m = side === 'left' ? proj(ax, ay, 0.5, 0.59, 1.0) : proj(ax, ay, 0.59, 0.5, 1.0);
    fr(ctx, '#d8d8d0', m.x - 4, m.y - 1, 9, 2);
  },
});
registerProp('city_shutter', { // market roller shutter gate
  h: 2.4, interact: { kind: 'gate', key: null },
  update(p, world, dt) { if (p.open) p.roll = Math.min(1, (p.roll || 0) + dt * 1.5); },
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const roll = p.open ? (p.roll || 0) : 0;
    if (roll >= 1) return;
    const z0 = 2.3 * roll;
    for (let i = 0; i < 12; i++) {
      const z = z0 + i * (2.3 - z0) / 12;
      if (alongX) isoPanel(ctx, ax, ay, 'left', 0, 0.5, 1, z, z + (2.3 - z0) / 12, i % 2 ? '#6a6a74' : '#7e7e88');
      else isoPanel(ctx, ax, ay, 'right', 0.5, 0, 1, z, z + (2.3 - z0) / 12, i % 2 ? '#5a5a64' : '#6a6a74');
    }
    if (alongX) isoBox(ctx, ax, ay, 0, 0.35, 2.3, 1, 0.3, 0.2, { color: '#3a3a44', outline: OL });
    else isoBox(ctx, ax, ay, 0.35, 0, 2.3, 0.3, 1, 0.2, { color: '#3a3a44', outline: OL });
    if (!p.open && p.o.text) onFace(ctx, ax, ay, alongX ? 'left' : 'right', alongX ? 0.1 : 0.5, alongX ? 0.5 : 0.1, 1.5, g => drawText(g, p.o.text, 0, 0, { color: '#e83a3a' }));
  },
});
registerProp('city_clubTotem', { // vertical neon totem sign spelling the club name
  h: 0.5,
  light: { z: 2.5, r: 3.4, color: '#ff3aa0', intensity: 0.85 },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 4.2);
    isoBox(ctx, ax, ay, 0.3, 0.3, 0, 0.4, 0.4, 0.5, { color: '#2a2a34', outline: OL });
    thick(ctx, b.x, b.y - 10, b.x, top.y + 50, 4, OL); thick(ctx, b.x, b.y - 10, b.x, top.y + 50, 2, '#4a4a54');
    const word = p.o.text || 'VELVET';
    const h = word.length * 9 + 8;
    fr(ctx, OL, top.x - 8, top.y - 2, 16, h + 2);
    fr(ctx, '#1a0a22', top.x - 7, top.y - 1, 14, h);
    const k = Math.floor(t * 10);
    for (let i = 0; i < (h + 14) / 2; i++) {   // chasing bulbs around the edge
      const on = (i + k) % 4 === 0;
      const yy = top.y - 1 + (i * 2) % h;
      if (i * 2 < h) fr(ctx, on ? '#fff2a0' : '#6a4a20', top.x - 7, yy, 1, 1); else fr(ctx, on ? '#fff2a0' : '#6a4a20', top.x + 6, top.y - 1 + ((i * 2) - h), 1, 1);
    }
    const flick = Math.sin(t * 13) + Math.sin(t * 4.7) > 1.7;
    for (let i = 0; i < word.length; i++) drawText(ctx, word[i], top.x - 2, top.y + 4 + i * 9, { color: flick && i === 2 ? '#5a1a3a' : NEON.pink, outline: '#4a0a2a' });
  },
});
registerProp('city_rope', { // velvet rope between brass stanchions; dir 'x' (default) or 'y'
  h: 0.7,
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const A = alongX ? [0.1, 0.5] : [0.5, 0.1], B = alongX ? [0.9, 0.5] : [0.5, 0.9];
    const post = ([x, y]) => { const a = proj(ax, ay, x, y, 0), b = proj(ax, ay, x, y, 0.8); ellipse(ctx, a.x, a.y, 3, 1.5, '#8a6a20'); thick(ctx, a.x, a.y, b.x, b.y, 2, '#c8a040'); ellipse(ctx, b.x, b.y, 2, 2, '#e8c860'); return b; };
    const a = post(A), b = post(B);
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, sag = Math.sin(u * Math.PI) * 5;
      fr(ctx, i % 3 ? '#a01a3a' : '#c82a4a', a.x + (b.x - a.x) * u - 1, a.y + (b.y - a.y) * u + sag, 2, 2);
    }
  },
});
registerProp('city_speaker', { // club speaker stack, cones thump with the beat
  h: 1.8,
  breakable: { hp: 26, debris: ['#1a1a1e', '#3a3a44', '#6a6a72'], sfx: 'wood', drops: [['coin', 0.4]], score: 80 },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.8, 0.8, 1.8, { top: '#2a2a32', left: '#1a1a20', right: '#121216', outline: OL });
    const beat = (t * 2.1) % 1 < 0.15 ? 1 : 0;
    const side = p.o.face || 'right';
    for (const [z, r] of [[0.55, 5], [1.35, 3.5]]) {
      const m = side === 'left' ? proj(ax, ay, 0.5, 0.91, z) : proj(ax, ay, 0.91, 0.5, z);
      ellipse(ctx, m.x, m.y, r + 1 + beat, r + 1 + beat, '#3a3a44');
      ellipse(ctx, m.x, m.y, r + beat * 0.5, r + beat * 0.5, '#0a0a0c');
      ellipse(ctx, m.x, m.y, 1.5, 1.5, '#5a5a66');
    }
  },
});
registerProp('city_discoBall', { // hangs over the dance floor
  h: 0, solid: false, depthBias: 3,
  draw(ctx, ax, ay, p, t) {
    const c = proj(ax, ay, 0.5, 0.5, 3.6), top = proj(ax, ay, 0.5, 0.5, 6);
    line(ctx, c.x, top.y, c.x, c.y - 7, '#8a8a94');
    ellipse(ctx, c.x, c.y, 7, 7, OL);
    for (let y = -6; y <= 6; y += 2) for (let x = -6; x <= 6; x += 2) {
      if (x * x + y * y > 36) continue;
      const k = hash2(x + Math.floor(t * 6), y, 71);
      fr(ctx, k > 0.85 ? '#ffffff' : k > 0.5 ? '#b0b0c0' : '#6a6a7a', c.x + x - 1, c.y + y - 1, 2, 2);
    }
    for (let i = 0; i < 3; i++) {   // flying glints
      const a = t * 1.7 + i * 2.1, d = 18 + (t * 23 + i * 7) % 30;
      fr(ctx, DANCE_COLS[(i + Math.floor(t)) % 6], c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.5 + 10, 2, 1);
    }
  },
});
registerProp('city_djDeck', { // turntables on top of the DJ booth; USE = BASS DROP (level supplies onOpen)
  h: 0, solid: false, depthBias: 0.3, interact: { kind: 'switch', key: null },
  draw(ctx, ax, ay, p, t) {
    const z = p.o.z ?? 1.1;
    isoBox(ctx, ax, ay, 0.1, 0.05, z, 0.8, 0.9, 0.1, { color: '#2a2a32', outline: OL });
    for (const y of [0.28, 0.72]) {
      const m = proj(ax, ay, 0.5, y, z + 0.1);
      ellipse(ctx, m.x, m.y, 6, 3, '#0a0a0c');
      const a = t * 9 + y * 5;
      fr(ctx, '#e8e8e8', m.x + Math.cos(a) * 4, m.y + Math.sin(a) * 2, 1, 1);
      fr(ctx, NEON.pink, m.x - 1, m.y, 2, 1);
    }
    const used = p.o.used;
    const m = proj(ax, ay, 0.5, 0.5, z + 0.1);
    fr(ctx, used ? '#5a5a5a' : (Math.floor(t * 4) % 2 ? '#ff2a2a' : '#7a1a1a'), m.x - 1, m.y - 1, 3, 2);
    if (!used && Math.floor(t * 2) % 2) drawText(ctx, 'DROP?', m.x, m.y - 22, { color: NEON.cyan, align: 'center', outline: OL });
  },
});
registerProp('city_barTop', { // bottles, taps and glasses standing on a bar counter tile (place on the bar wall)
  h: 0, solid: false, depthBias: 0.2,
  draw(ctx, ax, ay, p) {
    const z = p.o.z ?? 1.1;
    const k = (p.x * 7 + p.y * 3) % 4;
    if (k === 0) { // beer taps
      for (const x of [0.3, 0.55, 0.8]) { const a = proj(ax, ay, x, 0.5, z), b = proj(ax, ay, x, 0.5, z + 0.7); thick(ctx, a.x, a.y, b.x, b.y, 2, '#c8a040'); fr(ctx, ['#c82a1a', '#1a1a1a', '#e8c020'][Math.floor(x * 3) % 3], b.x - 2, b.y - 4, 4, 4); }
    } else {
      for (let i = 0; i < 3; i++) {
        const q = proj(ax, ay, 0.25 + i * 0.25, 0.4 + (i % 2) * 0.2, z);
        const col = ['#2a6a3a', '#6a3010', '#c8e0f0', '#8a1a2a'][(i + k) % 4];
        if ((i + k) % 3 === 0) { fr(ctx, OL, q.x - 2, q.y - 6, 4, 6); fr(ctx, '#e8d088', q.x - 1, q.y - 5, 2, 4); }   // pint
        else { fr(ctx, OL, q.x - 2, q.y - 11, 4, 11); fr(ctx, col, q.x - 1, q.y - 10, 2, 9); fr(ctx, '#ffffff', q.x - 1, q.y - 9, 1, 3); }
      }
    }
  },
});
registerProp('city_doner', { // rotating doner spit behind the kebab counter
  h: 1.4,
  light: { z: 1.0, r: 2.2, color: '#ff8a3a', intensity: 0.6 },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 1.6);
    isoBox(ctx, ax, ay, 0.2, 0.2, 0, 0.6, 0.6, 0.3, { color: '#8a8a94', outline: OL });
    thick(ctx, b.x, b.y - 6, top.x, top.y, 1, '#c8c8d0');
    for (let y = 0; y < 16; y++) {
      const w = 6 - Math.abs(y - 6) * 0.25;
      const ph = Math.floor(t * 8 + y) % 3;
      fr(ctx, OL, b.x - w - 1, b.y - 28 + y, w * 2 + 2, 1);
      fr(ctx, ph === 0 ? '#c87a3a' : ph === 1 ? '#9a5420' : '#7a3a14', b.x - w, b.y - 28 + y, w * 2, 1);
    }
    isoBox(ctx, ax, ay, 0.05, 0.6, 0.2, 0.9, 0.1, 1.2, { color: '#a83a1a' });   // heater panel glow
  },
});
registerProp('city_statue', { // 2x2 founder statue on a plinth — someone has given him a traffic cone hat
  w: 2, d: 2, h: 3.4,
  light: { z: 0.5, r: 3.2, color: '#a0c8ff', intensity: 0.6 },
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    isoBox(ctx, ax, ay, 0.35, 0.35, 0, 1.3, 1.3, 0.35, { color: '#8a8692', outline: OL });
    isoBox(ctx, ax, ay, 0.5, 0.5, 0.35, 1.0, 1.0, 1.0, { top: '#8a8692', left: '#7a7684', right: '#5a5664', outline: OL });
    onFace(ctx, ax, ay, 'left', 0.62, 1.5, 1.05, g => { fr(g, '#c8a040', 0, 0, 13, 7); drawText(g, 'H', 4, 0, { color: '#4a3a10' }); });
    const pat = '#4a8a74', patD = '#2e5e4e', patL = '#7ab8a0';
    const base = P(1, 1, 1.35);
    // legs + long coat
    fillPoly(ctx, [{ x: base.x - 8, y: base.y }, { x: base.x + 8, y: base.y }, { x: base.x + 6, y: base.y - 26 }, { x: base.x - 6, y: base.y - 26 }], OL);
    fillPoly(ctx, [{ x: base.x - 7, y: base.y - 1 }, { x: base.x + 7, y: base.y - 1 }, { x: base.x + 5, y: base.y - 25 }, { x: base.x - 5, y: base.y - 25 }], pat);
    fr(ctx, patD, base.x + 1, base.y - 24, 4, 23);
    fr(ctx, patL, base.x - 5, base.y - 24, 2, 22);
    // torso and head
    fr(ctx, OL, base.x - 7, base.y - 40, 14, 16); fr(ctx, pat, base.x - 6, base.y - 39, 12, 14); fr(ctx, patD, base.x + 2, base.y - 39, 4, 14);
    ellipse(ctx, base.x, base.y - 45, 5, 5, OL); ellipse(ctx, base.x, base.y - 45, 4, 4, pat); fr(ctx, patL, base.x - 3, base.y - 48, 2, 3);
    // pointing arm (toward the docks)
    thick(ctx, base.x + 5, base.y - 37, base.x + 18, base.y - 46, 4, OL); thick(ctx, base.x + 5, base.y - 37, base.x + 18, base.y - 46, 2, patL);
    // the cone
    fillPoly(ctx, [{ x: base.x - 1, y: base.y - 61 }, { x: base.x + 2, y: base.y - 61 }, { x: base.x + 6, y: base.y - 49 }, { x: base.x - 5, y: base.y - 49 }], OL);
    fillPoly(ctx, [{ x: base.x, y: base.y - 60 }, { x: base.x + 1, y: base.y - 60 }, { x: base.x + 5, y: base.y - 50 }, { x: base.x - 4, y: base.y - 50 }], '#ff6a1a');
    fr(ctx, '#ffffff', base.x - 2, base.y - 55, 5, 2);
    // pigeon
    if (Math.sin(t * 0.7 + p.x) > -0.3) { const q = P(1, 1, 1.35); fr(ctx, '#8a8a96', q.x + 14, q.y - 49, 3, 2); fr(ctx, '#5a5a66', q.x + 16, q.y - 50, 1, 1); }
  },
});
registerProp('city_fountainJet', { // animated water spray into the basin (no collision)
  h: 0, solid: false, depthBias: 0.4,
  draw(ctx, ax, ay, p, t) {
    const dir = p.o.dir || [1, 0];
    const b = proj(ax, ay, 0.5, 0.5, 0.9);
    for (let i = 0; i < 9; i++) {
      const u = ((t * 1.2 + i / 9) % 1);
      const x = dir[0] * u * 1.0, y = dir[1] * u * 1.0, z = 0.9 + Math.sin(u * Math.PI) * 0.9 - u * 0.9;
      const q = proj(ax, ay, 0.5 + x, 0.5 + y, z);
      fr(ctx, i % 3 ? '#a8d0f0' : '#ffffff', q.x, q.y, 2, 2);
    }
    const m = proj(ax, ay, 0.5 + dir[0], 0.5 + dir[1], 0);
    const r = (t * 2) % 1;
    ctx.globalAlpha = 0.6 * (1 - r);
    ctx.strokeStyle = '#c8e8ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(m.x, m.y, 2 + r * 6, 1 + r * 3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    void b;
  },
});
const STALL_FRUIT = [['#d83a2a', '#ff6a4a'], ['#ff9a1a', '#ffc04a'], ['#e8d02a', '#fff07a'], ['#5aa82a', '#8ad84a'], ['#7a2a8a', '#a85ab8']];
registerProp('city_stall', { // w2 d1 market stall with striped awning; o.color awning colour
  w: 2, d: 1, h: 1.1,
  draw(ctx, ax, ay, p) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const aw = p.o.color || '#c82a1a';
    for (const [x, y] of [[0.1, 0.1], [1.9, 0.1], [0.1, 0.9], [1.9, 0.9]]) { const a = P(x, y, 0), b = P(x, y, 2.3); thick(ctx, a.x, a.y, b.x, b.y, 2, '#5a4a3a'); }
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, 1.9, 0.8, 0.9, { top: '#7a5a38', left: '#6a4a2a', right: '#4a3420', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.05, 0.9, 1.9, 0.6, 0.9, '#2a6a2a');   // green fake-grass skirt
    // produce piles
    let i = 0;
    for (let x = 0.25; x < 1.9; x += 0.42) {
      const [c, hl] = STALL_FRUIT[(i++ + p.x) % STALL_FRUIT.length];
      for (const [dx, dy, dz] of [[0, 0, 0], [0.12, 0.15, 0], [-0.1, 0.2, 0], [0.04, 0.08, 0.12]]) {
        const q = P(x + dx, 0.35 + dy, 0.92 + dz);
        ellipse(ctx, q.x, q.y - 2, 2.5, 2, OL); ellipse(ctx, q.x, q.y - 2, 2, 1.5, c); fr(ctx, hl, q.x - 1, q.y - 3, 1, 1);
      }
    }
    // price card
    const pc = P(1.0, 0.9, 0.95); fr(ctx, '#f0ead8', pc.x - 5, pc.y - 6, 10, 6); drawText(ctx, '£1', pc.x - 4, pc.y - 6, { color: '#c82a1a' });
    // awning (striped, sloped toward +y)
    const n = 8;
    for (let k = 0; k < n; k++) {
      const x0 = k * 2 / n, x1 = (k + 1) * 2 / n;
      fillPoly(ctx, [P(x0, 0, 2.3), P(x1, 0, 2.3), P(x1, 1.1, 1.95), P(x0, 1.1, 1.95)], k % 2 ? '#f0ead8' : aw);
    }
    const e0 = P(0, 1.1, 1.95), e1 = P(2, 1.1, 1.95);
    for (let k = 0; k < 8; k++) { const u = (k + 0.5) / 8; fillPoly(ctx, [{ x: e0.x + (e1.x - e0.x) * u - 3, y: e0.y + (e1.y - e0.y) * u }, { x: e0.x + (e1.x - e0.x) * u + 3, y: e0.y + (e1.y - e0.y) * u }, { x: e0.x + (e1.x - e0.x) * u, y: e0.y + (e1.y - e0.y) * u + 3 }], k % 2 ? '#f0ead8' : aw); }
    line(ctx, P(0, 0, 2.3).x, P(0, 0, 2.3).y, P(2, 0, 2.3).x, P(2, 0, 2.3).y, OL);
  },
});
registerProp('city_fruitCrate', { // breakable produce crate (five a day!)
  h: 0.7,
  breakable: { hp: 8, debris: ['#8a6038', '#d83a2a', '#ff9a1a', '#5aa82a'], sfx: 'wood', drops: [['city_apple', 0.7], ['city_apple', 0.35], ['city_melon', 0.25], ['coin', 0.3]], score: 40 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.8, 0.8, 0.6, { color: '#9a7040', outline: OL });
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    for (const z of [0.2, 0.4]) { const a = P(0.1, 0.9, z), b = P(0.9, 0.9, z); line(ctx, a.x, a.y, b.x, b.y, '#5e3e20'); const c = P(0.9, 0.1, z), d = P(0.9, 0.9, z); line(ctx, c.x, c.y, d.x, d.y, '#4e3218'); }
    const [c, hl] = STALL_FRUIT[(p.o.fruit ?? (p.x + p.y)) % STALL_FRUIT.length];
    for (const [x, y] of [[0.3, 0.3], [0.6, 0.35], [0.35, 0.62], [0.65, 0.65], [0.5, 0.48]]) { const q = P(x, y, 0.62); ellipse(ctx, q.x, q.y - 1, 2.5, 2, OL); ellipse(ctx, q.x, q.y - 1, 2, 1.5, c); fr(ctx, hl, q.x - 1, q.y - 2, 1, 1); }
  },
});
registerProp('city_boards', { // boarded-up doorway (break it!) — plane at the tile's +x edge by default
  h: 3,
  breakable: { hp: 24, debris: ['#8a6a40', '#6a4a28', '#b08a50'], sfx: 'wood', score: 100 },
  draw(ctx, ax, ay, p) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    isoBox(ctx, ax, ay, 0.0, 0.0, 0, 1, 1, 2.8, { top: '#2a1a14', left: '#1a1210', right: '#120c0a' });
    for (let i = 0; i < 6; i++) {
      const z = 0.3 + i * 0.42;
      const tilt = (i % 2 ? 0.12 : -0.1);
      fillPoly(ctx, [P(1.02, 0.02, z + tilt), P(1.02, 0.98, z - tilt), P(1.02, 0.98, z - tilt + 0.25), P(1.02, 0.02, z + tilt + 0.25)], OL);
      fillPoly(ctx, [P(1.02, 0.05, z + tilt + 0.03), P(1.02, 0.95, z - tilt + 0.03), P(1.02, 0.95, z - tilt + 0.22), P(1.02, 0.05, z + tilt + 0.22)], i % 3 ? '#8a6a40' : '#7a5a34');
    }
    onFace(ctx, ax, ay, 'right', 1.03, 0.15, 1.75, g => drawText(g, 'KEEP OUT', 0, 0, { color: '#e83a3a' }));
  },
});
registerProp('city_payMachine', {
  h: 1.3,
  breakable: { hp: 20, debris: ['#2a5ab8', '#8a8a94'], sfx: 'metal', drops: [['coin', 1], ['coin', 0.8], ['coin', 0.6], ['cash5', 0.3]], score: 100 },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.25, 0.25, 0, 0.5, 0.5, 1.3, { color: '#2a5ab8', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.3, 0.76, 0.4, 0.85, 1.1, Math.floor(t * 1.5) % 2 ? '#c8ff8a' : '#9ad06a');
    onFace(ctx, ax, ay, 'left', 0.28, 0.76, 1.27, g => drawText(g, 'PAY', 0, 0, { color: '#ffffff' }));
  },
});
registerProp('city_planter', { // concrete planter with a shrub (jumpable)
  h: 1.0,
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.08, 0.08, 0, 0.84, 0.84, 0.75, { color: '#6a6672', outline: OL });
    const c = proj(ax, ay, 0.5, 0.5, 0.75);
    const sway = Math.round(Math.sin(t * 1.4 + p.x) * 0.6);
    for (const [dx, dy, r, k] of [[0, -6, 8, 0], [-5, -3, 5, -0.12], [5, -3, 5, -0.25], [0, -11, 5, 0.12]]) ellipse(ctx, c.x + dx + sway, c.y + dy, r + 1, r * 0.75 + 1, OL);
    for (const [dx, dy, r, k] of [[0, -6, 8, 0], [-5, -3, 5, -0.12], [5, -3, 5, -0.25], [0, -11, 5, 0.12]]) ellipse(ctx, c.x + dx + sway, c.y + dy, r, r * 0.75, shade(p.o.color || '#2e5a2a', k));
    if (p.o.flowers) for (let i = 0; i < 5; i++) fr(ctx, ['#ff7ac0', '#ffd23a', '#ffffff'][i % 3], c.x - 6 + i * 3 + sway, c.y - 8 - (i % 2) * 4, 1, 1);
  },
});
registerProp('city_bigScreen', { // big outdoor screen on a wall's +y face (place on the wall tile): scrolling result
  h: 0, solid: false, depthBias: 0.05,
  light: { z: 3.6, r: 3.6, color: '#8ac8ff', intensity: 0.7 },
  draw(ctx, ax, ay, p, t) {
    const len = p.o.len || 4, z0 = p.o.z ?? 2.8, z1 = z0 + 1.4;
    isoPanel(ctx, ax, ay, 'left', -0.12, 1.02, len + 0.24, z0 - 0.16, z1 + 0.16, OL);
    isoPanel(ctx, ax, ay, 'left', -0.08, 1.02, len + 0.16, z0 - 0.11, z1 + 0.11, '#5a5a66');
    isoPanel(ctx, ax, ay, 'left', 0.0, 1.02, len, z0 - 0.04, z1 + 0.04, OL);
    isoPanel(ctx, ax, ay, 'left', 0.05, 1.02, len - 0.1, z0, z1, '#0c2448');
    const text = p.o.text || 'FULL TIME   NORDHAMN ATHLETIC 2   PORTSIDE CITY 1   ★   ';
    onFace(ctx, ax, ay, 'left', 0.1, 1.02, z1 - 0.05, g => {
      const W = Math.round((len - 0.2) * HALF_W);
      g.save();
      g.beginPath(); g.rect(0, 0, W, 26); g.clip();
      // scanline bg
      for (let y = 0; y < 26; y += 2) fr(g, '#081a38', 0, y, W, 1);
      const tw = text.length * 6;
      const off = Math.floor(t * 22) % tw;
      drawText(g, text + text, -off, 3, { color: '#ffd23a' });
      // crest-ish anchor icon blink
      if (Math.floor(t * 2) % 2) drawClubCrest(g, currentClub(), 2, 13, 10, 10, () => { fr(g, homeKit.main, 3, 14, 8, 8); fr(g, homeKit.second, 6, 15, 2, 6); fr(g, homeKit.second, 4, 19, 6, 1); });   // your club's crest blinks
      drawText(g, 'ANCHORS WIN!', 15, 15, { color: '#ffffff' });
      g.restore();
    });
  },
});
const NEON_SHAPES = {
  cocktail: [[0, 0, 10, 0], [0, 0, 5, 6], [10, 0, 5, 6], [5, 6, 5, 11], [2, 11, 8, 11], [8, -3, 6, 1]],
  arrow: [[0, 4, 12, 4], [12, 4, 8, 0], [12, 4, 8, 8]],
  star: [[5, 0, 7, 4], [7, 4, 11, 4], [11, 4, 8, 7], [8, 7, 9, 11], [9, 11, 5, 8], [5, 8, 1, 11], [1, 11, 2, 7], [2, 7, -1, 4], [-1, 4, 3, 4], [3, 4, 5, 0]],
  joystick: [[2, 11, 10, 11], [2, 11, 2, 8], [10, 11, 10, 8], [2, 8, 10, 8], [6, 8, 6, 2], [4, 0, 8, 0], [4, 0, 4, 3], [8, 0, 8, 3], [4, 3, 8, 3]],
  anchor: [[6, 0, 6, 11], [3, 3, 9, 3], [1, 8, 6, 11], [11, 8, 6, 11], [1, 8, 0, 6], [11, 8, 12, 6]],
  heart: [[6, 11, 0, 4], [0, 4, 0, 2], [0, 2, 3, 0], [3, 0, 6, 3], [6, 3, 9, 0], [9, 0, 12, 2], [12, 2, 12, 4], [12, 4, 6, 11]],
};
registerProp('city_neonSign', { // neon tube sign on a wall face: o.shape, o.text, o.color, o.side, o.z
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    const col = p.o.color || NEON.pink;
    const flick = p.o.flicker !== false && Math.sin(t * 19 + p.x * 3) + Math.sin(t * 6.3 + p.y) > 1.8;
    const c = flick ? shade(col, -0.65) : col;
    const glow = flick ? shade(col, -0.8) : shade(col, -0.45);
    const x = side === 'left' ? (p.o.at ?? 0.2) : 1.02, y = side === 'left' ? 1.02 : (p.o.at ?? 0.2);
    onFace(ctx, ax, ay, side, x, y, p.o.z ?? 3.2, g => {
      const segs = NEON_SHAPES[p.o.shape] || [];
      for (const [a, b, cc, d] of segs) thick(g, a + 1, b + 1, cc + 1, d + 1, 3, glow);
      for (const [a, b, cc, d] of segs) line(g, a + 1, b + 1, cc + 1, d + 1, c);
      if (p.o.text) {
        const ox = segs.length ? 16 : 0;
        drawText(g, p.o.text, ox, 3, { color: c, outline: glow });
      }
    });
  },
});
registerProp('city_festoon', { // string of party bulbs from (x,y) to (o.x2,o.y2) at height o.z
  h: 0, solid: false, depthBias: 60,
  draw(ctx, ax, ay, p, t) {
    const z = p.o.z ?? 2.6;
    const a = proj(ax, ay, 0.5, 0.5, z), b = proj(ax, ay, p.o.x2 - p.x + 0.5, p.o.y2 - p.y + 0.5, z);
    const n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 7));
    let px0 = a.x, py0 = a.y;
    for (let i = 1; i <= n; i++) {
      const u = i / n, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 9;
      line(ctx, px0, py0, x, y, '#1a1a1a');
      px0 = x; py0 = y;
    }
    for (let i = 1; i < n; i++) {
      const u = i / n, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 9;
      const on = (i + Math.floor(t * 2)) % 7 !== 0;
      fr(ctx, on ? ['#ffd27a', '#ff7ac0', '#7ae0ff', '#a0ff8a'][i % 4] : '#4a4030', x - 1, y + 1, 2, 2);
    }
  },
});

// ====================================================================== items
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
registerItem('city_apple', {
  name: 'BRUISED APPLE', kind: 'heal', heal: 10, score: 20, stash: true, auto: true,
  icon(ctx, x, y) { ellipse(ctx, x, y - 4, 5, 4.5, OL); ellipse(ctx, x, y - 4, 4, 3.5, '#d83a2a'); px(ctx, '#ff8a6a', x - 2, y - 6, 2, 1); px(ctx, '#5a3a1a', x, y - 10, 1, 2); px(ctx, '#5aa82a', x + 1, y - 10, 2, 1); },
});
registerItem('city_melon', {
  name: 'MELON SLICE', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y) {
    fillPoly(ctx, [{ x: x - 7, y: y - 8 }, { x: x + 7, y: y - 8 }, { x: x, y: y }], OL);
    fillPoly(ctx, [{ x: x - 6, y: y - 7 }, { x: x + 6, y: y - 7 }, { x: x, y: y - 1 }], '#ff4a5a');
    px(ctx, '#3a8a2a', x - 6, y - 8, 12, 1); px(ctx, '#1a1a1a', x - 2, y - 5); px(ctx, '#1a1a1a', x + 2, y - 5); px(ctx, '#1a1a1a', x, y - 3);
  },
});
function stickHeld(len, w, color, tipColor, tipLen = 0, knob) {
  return (ctx, hx, hy, ang, s = 1, flash) => {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const bx = hx - dx * 2 * s, by = hy - dy * 2 * s, ex = hx + dx * len * s, ey = hy + dy * len * s;
    thick(ctx, bx, by, ex, ey, w + 2, OL);
    thick(ctx, bx, by, ex, ey, w, flash ? '#fff' : color);
    if (tipColor) thick(ctx, hx + dx * (len - tipLen) * s, hy + dy * (len - tipLen) * s, ex, ey, w, flash ? '#fff' : tipColor);
    if (knob) { ellipse(ctx, bx, by, 2.5, 2.5, OL); ellipse(ctx, bx, by, 1.5, 1.5, flash ? '#fff' : knob); }
  };
}
registerItem('city_inflatable', {
  name: 'INFLATABLE HAMMER', kind: 'weapon', score: 0,
  weapon: { dmg: 6, reach: 1.6, durability: 7, attack: 'swing', knockdown: true, throwDmg: 6, breaks: 'plastic' },
  icon(ctx, x, y) { px(ctx, OL, x - 1, y - 14, 3, 14); px(ctx, '#ffd23a', x, y - 13, 1, 13); px(ctx, OL, x - 6, y - 17, 13, 6); px(ctx, '#ff5aa8', x - 5, y - 16, 11, 4); px(ctx, '#ffb0d8', x - 4, y - 16, 4, 1); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 12 * s, ey = hy + dy * 12 * s;
    thick(ctx, hx, hy, ex, ey, 4, OL); thick(ctx, hx, hy, ex, ey, 2, flash ? '#fff' : '#ffd23a');
    const pxv = -dy, pyv = dx;
    fillPoly(ctx, [{ x: ex - pxv * 6, y: ey - pyv * 6 }, { x: ex + pxv * 6, y: ey + pyv * 6 }, { x: ex + pxv * 6 + dx * 6, y: ey + pyv * 6 + dy * 6 }, { x: ex - pxv * 6 + dx * 6, y: ey - pyv * 6 + dy * 6 }], OL);
    fillPoly(ctx, [{ x: ex - pxv * 5, y: ey - pyv * 5 }, { x: ex + pxv * 5, y: ey + pyv * 5 }, { x: ex + pxv * 5 + dx * 5, y: ey + pyv * 5 + dy * 5 }, { x: ex - pxv * 5 + dx * 5, y: ey - pyv * 5 + dy * 5 }], flash ? '#fff' : '#ff5aa8');
  },
});
registerItem('city_handbag', {
  name: 'HANDBAG', kind: 'weapon', score: 0,
  weapon: { dmg: 9, reach: 1.3, durability: 6, attack: 'city_bagSwing', throwDmg: 10, breaks: 'plastic' },
  icon(ctx, x, y) { px(ctx, OL, x - 5, y - 8, 10, 8); px(ctx, '#e83a8a', x - 4, y - 7, 8, 6); px(ctx, '#ffd23a', x - 1, y - 6, 2, 1); px(ctx, OL, x - 3, y - 11, 1, 3); px(ctx, OL, x + 2, y - 11, 1, 3); px(ctx, OL, x - 3, y - 12, 6, 1); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 7 * s, ey = hy + dy * 7 * s;
    line(ctx, hx, hy, ex, ey, OL);
    px(ctx, OL, ex - 4, ey - 3, 9, 7); px(ctx, flash ? '#fff' : '#e83a8a', ex - 3, ey - 2, 7, 5); px(ctx, '#ffd23a', ex, ey - 1, 1, 1);
  },
});
registerItem('city_heel', {
  name: 'STILETTO', kind: 'weapon', score: 0,
  weapon: { dmg: 6, reach: 1.05, durability: 2, attack: 'swing', throwDmg: 9, breaks: 'plastic' },
  icon(ctx, x, y) { px(ctx, OL, x - 5, y - 6, 11, 4); px(ctx, '#c81a4a', x - 4, y - 5, 9, 2); px(ctx, OL, x + 4, y - 3, 2, 3); px(ctx, '#c81a4a', x + 4, y - 3, 1, 2); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) { const c = flash ? '#fff' : '#c81a4a'; px(ctx, OL, hx - 4, hy - 2, 9, 4); px(ctx, c, hx - 3, hy - 1, 7, 2); px(ctx, OL, hx + 3, hy + 1, 2, 3); },
});
registerItem('city_cane', {
  name: 'SILVER-TOPPED CANE', kind: 'weapon', score: 0,
  weapon: { dmg: 11, reach: 1.6, durability: 14, attack: 'city_caneSwing', throwDmg: 14, breaks: 'wood' },
  icon(ctx, x, y) { px(ctx, OL, x - 7, y - 5, 15, 3); px(ctx, '#1a1a22', x - 6, y - 4, 13, 1); ellipse(ctx, x - 7, y - 4, 2.5, 2.5, OL); ellipse(ctx, x - 7, y - 4, 1.5, 1.5, '#e8e8f0'); },
  drawHeld: stickHeld(15, 2, '#1a1a24', '#d4af37', 1, '#e8e8f0'),
});
registerItem('city_phone', {
  name: 'BRICK PHONE', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.15, durability: 4, attack: 'swing', throwDmg: 18, breaks: 'metal' },
  icon(ctx, x, y) { px(ctx, OL, x - 3, y - 13, 7, 13); px(ctx, '#2a2a30', x - 2, y - 12, 5, 11); px(ctx, '#7aff5a', x - 1, y - 11, 3, 2); px(ctx, '#8a8a94', x - 1, y - 7, 3, 4); px(ctx, OL, x + 2, y - 16, 1, 3); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) { px(ctx, OL, hx - 3, hy - 7, 6, 11); px(ctx, flash ? '#fff' : '#2a2a30', hx - 2, hy - 6, 4, 9); px(ctx, '#7aff5a', hx - 1, hy - 5, 2, 1); px(ctx, OL, hx + 1, hy - 10, 1, 3); },
});
registerItem('city_champagne', {
  name: 'CHAMPAGNE BOTTLE', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.25, durability: 1, attack: 'swing', throwDmg: 15, breaks: 'glass' },
  icon(ctx, x, y) { px(ctx, OL, x - 3, y - 14, 6, 14); px(ctx, '#1a4a2a', x - 2, y - 9, 4, 8); px(ctx, '#2a6a3a', x - 1, y - 13, 2, 4); px(ctx, '#d4af37', x - 2, y - 14, 4, 3); px(ctx, '#f0ead8', x - 2, y - 7, 4, 3); },
  drawHeld: stickHeld(9, 3, '#1a4a2a', '#d4af37', 2),
});
registerItem('city_neon', {
  name: 'NEON TUBE', kind: 'weapon', score: 0,
  weapon: { dmg: 16, reach: 1.6, durability: 1, attack: 'swing', knockdown: true, throwDmg: 16, breaks: 'glass' },
  icon(ctx, x, y, t) { const on = Math.floor(t * 6) % 5 !== 0; px(ctx, OL, x - 8, y - 5, 17, 4); px(ctx, on ? '#ff8ad0' : '#8a3a6a', x - 7, y - 4, 15, 2); if (on) px(ctx, '#ffffff', x - 5, y - 4, 8, 1); },
  drawHeld: stickHeld(16, 2, '#ff8ad0', '#ffffff', 3),
});
