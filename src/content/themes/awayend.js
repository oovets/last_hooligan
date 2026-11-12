// LEVEL 4 THEME — THE AWAY END (Portside City's ground on cup day).
// Floors, walls, props and items used by src/content/levels/l4_awayend.js. Every id starts with 'awayend_'.
//
// Floors: awayend_terrace awayend_aisle awayend_concourse awayend_stairs awayend_stairsY awayend_grate awayend_wettiles
//         awayend_corridor awayend_corridorLine awayend_track awayend_moat awayend_forecourt
// Walls:  awayend_stadiumwall awayend_turnstilewall awayend_standback awayend_blockwork awayend_pillar awayend_kioskwall
//         awayend_toiletwall awayend_fenceX awayend_fenceY awayend_invisible awayend_farstand
// Props:  awayend_turnstile awayend_burgervan awayend_kiosk awayend_counter awayend_crushbarrier awayend_tv awayend_vending
//         awayend_urinal awayend_sink awayend_boiler awayend_floodlight awayend_dugout awayend_cctv awayend_walllamp
//         awayend_amnesty awayend_hamper awayend_cubicle
// Items:  awayend_shield (weapon) awayend_programme (weapon) awayend_beeftea (heal) awayend_coin (projectile only)

import { registerFloor, registerWall } from '../../engine/tiles.js';
import { registerProp } from '../../game/props.js';
import { registerItem } from '../../game/items.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow } from '../../engine/gfx.js';
import { shade, mix } from '../../engine/color.js';
import { hash2 } from '../../engine/rng.js';
import { drawText } from '../../engine/font.js';
import { Z_PX } from '../../engine/constants.js';
import { ENV } from '../../engine/envsprites.js';
import { PROPS as PROPS_OVERLAY } from '../../game/props.js';

const OL = '#120c14';
const BLUE = '#1f4fb4';         // Portside City blue
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const fr = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

// Draw onto a vertical wall face plane with a skew transform. side 'left' = plane along world x (at fixed y),
// side 'right' = plane along world y (at fixed x). (x,y,z) = the LEFT end on screen, top of the drawing.
function onFace(ctx, ax, ay, side, x, y, z, fn) {
  const m = proj(ax, ay, x, y, z);
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
  fn(ctx);
  ctx.restore();
}

// ================================================================== FLOORS
function terraceBase(u, v, tx, ty) {
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 41);
  let c = n < 0.06 ? '#4a4b52' : n > 0.95 ? '#6e6f76' : (n2(tx, ty, 42) < 0.5 ? '#595a61' : '#5e5f66');
  if (v < 0.03 && ty % 4 === 0) c = '#3e3f45';                           // expansion joint
  if (n2(u * 8 + tx * 8, v * 8 + ty * 8, 43) < 0.04) c = '#4e4e54';      // cracks/stains
  return c;
}
registerFloor('awayend_terrace', {
  // each tile is one terrace step; the step drops toward +x (the pitch), so the riser sits on the +x edge
  pixel(u, v, tx, ty) {
    if (u > 0.9) return u > 0.955 ? '#232429' : '#30313a';
    if (u > 0.84) return (n2(v * 16, ty * 16 + tx, 44) < 0.15) ? '#6a6a70' : '#8c8d94';
    return terraceBase(u, v, tx, ty);
  },
  decal(g, sx, sy, tx, ty, r) {
    const P = (u, v) => ({ x: sx + (u - v) * 16, y: sy + (u + v) * 8 });
    if (r < 0.22) {        // crushed plastic cup
      const p = P(0.3 + r * 2, 0.5); fr(g, '#e8e8e0', p.x, p.y, 3, 2); fr(g, r < 0.11 ? BLUE : '#c8102e', p.x, p.y + 1, 3, 1);
    } else if (r < 0.34) { // torn programme page
      const p = P(0.55, 0.3); fr(g, '#d8d0b8', p.x, p.y, 4, 2); fr(g, BLUE, p.x + 1, p.y, 2, 1);
    } else if (r < 0.5) {  // chewing gum / fag ends
      for (let i = 0; i < 3; i++) { const p = P(0.2 + hash2(tx, ty, 50 + i) * 0.6, 0.15 + hash2(tx, ty, 60 + i) * 0.7); fr(g, i ? '#e8d8b0' : '#3a3a40', p.x, p.y, 1, 1); }
    } else if (r < 0.56) { // pie wrapper
      const p = P(0.4, 0.65); fr(g, '#c8c0a0', p.x, p.y, 3, 2); fr(g, '#a06a30', p.x + 1, p.y, 1, 1);
    }
  },
});
registerFloor('awayend_aisle', {
  pixel(u, v, tx, ty) {
    if (u > 0.9) return u > 0.955 ? '#232429' : '#30313a';
    if (u > 0.82) return (n2(v * 16, ty * 16, 45) < 0.2) ? '#a08a20' : '#e0c030';  // painted yellow nosing
    if (v < 0.05 || v > 0.95) return '#c8a828';
    return terraceBase(u, v, tx, ty);
  },
});
registerFloor('awayend_concourse', {
  pixel(u, v, tx, ty, r) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 46);
    let c = n < 0.08 ? '#33393a' : n > 0.94 ? '#4c5455' : (r < 0.5 ? '#3d4446' : '#40484a');
    if (u < 0.025 || v < 0.025) c = '#2c3132';
    // spilled beer / tea puddles (amber) and wet patches
    const pd = Math.hypot(u - 0.5 - (r - 0.5) * 0.4, (v - 0.5) * 1.6);
    if (r > 0.86 && pd < 0.22) c = pd < 0.12 ? '#6a5424' : '#57492a';
    else if (r < 0.07 && pd < 0.28) c = '#2f3a42';
    return c;
  },
  decal(g, sx, sy, tx, ty, r) {
    const P = (u, v) => ({ x: sx + (u - v) * 16, y: sy + (u + v) * 8 });
    if (r > 0.3 && r < 0.45) { for (let i = 0; i < 2; i++) { const p = P(hash2(tx, ty, 70 + i), hash2(tx, ty, 80 + i)); fr(g, '#e8dcc0', p.x, p.y, 2, 1); fr(g, '#d07020', p.x + 1, p.y, 1, 1); } }
    else if (r > 0.6 && r < 0.66) { const p = P(0.4, 0.4); fr(g, '#e8e8e0', p.x, p.y, 2, 3); fr(g, '#8a5020', p.x, p.y, 2, 1); }
    else if (r > 0.75 && r < 0.79) { const p = P(0.5, 0.5); ellipse(g, p.x, p.y, 4, 2, '#22282a'); for (let i = -3; i <= 3; i += 2) fr(g, '#4a5052', p.x + i, p.y - 1, 1, 2); } // drain
  },
});
registerFloor('awayend_stairs', { // vomitory stairs: treads across world x, yellow nosings
  pixel(u, v, tx, ty) {
    const k = (u * 3) % 1;
    if (v < 0.06 || v > 0.94) return '#2a2b30';                      // side strings
    if (k > 0.86) return '#2a2a30';                                   // riser shadow
    if (k > 0.74) return (n2(v * 12, tx * 3 + Math.floor(u * 3), 47) < 0.25) ? '#8a7a20' : '#d8b830';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 48);
    return n < 0.08 ? '#4a4b50' : '#5a5b62';
  },
});
registerFloor('awayend_stairsY', { // stairs running along world y (treads across y)
  pixel(u, v, tx, ty) {
    const k = (v * 3) % 1;
    if (u < 0.06 || u > 0.94) return '#2a2b30';
    if (k > 0.86) return '#2a2a30';
    if (k > 0.74) return (n2(u * 12, ty * 3 + Math.floor(v * 3), 47) < 0.25) ? '#8a7a20' : '#d8b830';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 48);
    return n < 0.08 ? '#4a4b50' : '#5a5b62';
  },
});
registerFloor('awayend_grate', { // steel checker plate in the turnstile lanes
  pixel(u, v) {
    if (u < 0.04 || v < 0.04) return '#2a2c30';
    const a = (u * 8) % 1, b = (v * 8) % 1;
    const alt = (Math.floor(u * 8) + Math.floor(v * 8)) % 2;
    if (alt ? Math.abs(a - b) < 0.18 : Math.abs(a + b - 1) < 0.18) return '#9aa0a8';
    return '#5e636a';
  },
});
registerFloor('awayend_wettiles', { // grim toilet floor tiles with wet sheen
  pixel(u, v, tx, ty) {
    const gu = (u * 3) % 1, gv = (v * 3) % 1;
    if (gu < 0.08 || gv < 0.08) return '#6a6e70';
    const tile = n2(tx * 3 + Math.floor(u * 3), ty * 3 + Math.floor(v * 3), 49);
    let c = tile < 0.1 ? '#a8aca6' : tile > 0.9 ? '#d8dcd6' : '#c4c8c2';
    const wet = Math.sin((u + tx) * 2.1 + Math.cos((v + ty) * 1.7) * 2) + Math.cos((v + ty) * 1.3);
    if (wet > 1.25) c = mix(c, '#7a9ab4', 0.45);
    else if (wet < -1.6) c = mix(c, '#8a8a70', 0.25);
    return c;
  },
});
registerFloor('awayend_corridor', {
  pixel(u, v, tx, ty) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 51);
    let c = n < 0.07 ? '#2c3440' : n > 0.95 ? '#465264' : '#36404e';
    if (n2(u * 6 + tx * 6, v * 6 + ty * 6, 52) < 0.05) c = '#4e5866';  // scuffs
    return c;
  },
});
registerFloor('awayend_corridorLine', { // painted walkway line along world x
  pixel(u, v, tx, ty) {
    if (Math.abs(v - 0.5) < 0.06) return ((u * 4 + tx * 4) % 2 < 1.6) ? '#d8b830' : '#36404e';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 51);
    return n < 0.07 ? '#2c3440' : '#36404e';
  },
});
registerFloor('awayend_track', { // pitchside rubber-crumb track
  pixel(u, v, tx, ty) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 53);
    if (Math.abs(u - 0.5) < 0.03 && tx % 3 === 0) return '#e8e4dc';
    return n < 0.1 ? '#6a2e22' : n > 0.9 ? '#9a4a36' : n > 0.75 ? '#8a3e2e' : '#7c3628';
  },
});
registerFloor('awayend_moat', { // murky moat between terrace fence and pitch
  pixel(u, v, tx, ty) {
    const n = n2(u * 16 + tx * 16, v * 16 + ty * 16, 54);
    const w = Math.sin((v + ty) * 5 + (u + tx) * 1.3);
    if (n < 0.03) return '#d8d8c8';                                   // floating litter
    return w > 0.85 ? '#2e4a3e' : n < 0.12 ? '#1a2e26' : '#20362e';
  },
});
registerFloor('awayend_forecourt', { // block-paved forecourt outside the turnstiles
  pixel(u, v, tx, ty) {
    const bu = u * 4, bv = v * 2 + (Math.floor(u * 4) % 2) * 0.5;
    if (bu % 1 < 0.1 || bv % 1 < 0.08) return '#3e3a40';
    const s = n2(tx * 4 + Math.floor(bu), ty * 2 + Math.floor(bv), 55);
    return s < 0.3 ? '#6e6268' : s < 0.7 ? '#76696e' : '#685c62';
  },
});

// ================================================================== WALLS
function bondColor(u, py, cw, ch, variant, base, mortar, seed) {
  const bx = u * 16, row = Math.floor(py / ch);
  const off = row % 2 ? cw / 2 : 0;
  if (py % ch === ch - 1) return mortar;
  if (Math.floor(bx + off) % cw === 0) return mortar;
  const s = hash2(Math.floor((bx + off) / cw) + variant * 7, row, seed);
  return s < 0.25 ? shade(base, -0.07) : s > 0.88 ? shade(base, 0.08) : base;
}

registerWall('awayend_stadiumwall', { // outer wall: grey breeze block, faded blue painted base, white band
  top: (u, v) => ((u * 4) % 1 < 0.12 ? '#4a4c52' : '#6a6c72'),
  variants: 6,
  face(u, py, side, H, r, variant) {
    let c;
    const band = Math.round(H * 0.55);
    if (py < 3) c = py === 2 ? '#3a3c42' : '#8a8c92';
    else if (Math.abs(py - band) <= 1) c = '#e4e2d8';
    else if (py > band) {
      c = bondColor(u, py, 8, 5, variant, BLUE, '#163578', 61);
      if (hash2(Math.floor(u * 6) + variant * 5, Math.floor(py / 6), 62) < 0.12) c = '#7a7c80';   // peeled paint
      if (py > H - 4) c = shade(c, -0.35);
    } else {
      c = bondColor(u, py, 8, 5, variant, '#8a8c90', '#5c5e64', 63);
      const streak = hash2(Math.floor(u * 16) + variant * 13, 0, 64);
      if (streak < 0.1 && py < band - 2) c = mix(c, '#7a4a28', 0.35 * (1 - py / band));  // rust run-off
    }
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('awayend_turnstilewall', { // turnstile booths: cream panels, barred lit window, red-brick base
  top: (u, v) => (u < 0.08 || v < 0.08 || u > 0.92 || v > 0.92 ? '#1a1c20' : '#34363c'),
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c;
    const winTop = 10, winBot = Math.round(H * 0.42);
    if (py < 4) c = py < 2 ? '#1a1c20' : '#4a4e56';
    else if (py < Math.round(H * 0.5)) {
      c = '#d8cfae';
      if (wu < 1 || wu > 15) c = '#a89e80';
      if (py >= winTop && py <= winBot && wu > 3 && wu < 13) {
        if (py === winTop || py === winBot || wu < 4 || wu > 12) c = '#2a2c30';
        else if (Math.floor(wu) % 2 === 0) c = '#5a5e66';                 // bars
        else c = (variant % 2 === 0) ? (py < winTop + 6 ? '#ffe2a0' : '#e8a848') : '#1c2430';
      }
      if (py === winBot + 3 && wu > 5 && wu < 11) c = variant % 2 ? '#30d050' : '#e03030';   // status light
    } else c = bondColor(u, py, 8, 4, variant, '#7a3a2a', '#3a2220', 65);
    if (py > H - 3) c = shade(c, -0.3);
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('awayend_standback', { // back of the stand: blue corrugated cladding over a stained concrete plinth
  top: (u, v) => ((v * 6) % 1 < 0.2 ? '#1c2a48' : '#26365a'),
  variants: 8,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c;
    const plinth = H - Math.round(H * 0.28);
    if (py < 3) c = py === 0 ? '#14161a' : '#3a3e46';                      // gutter
    else if (py >= plinth) {
      const n = hash2(Math.floor(wu) + variant * 3, py, 66);
      c = n < 0.06 ? '#4e4e54' : '#626268';
      if (py === plinth) c = '#3a3a40';
      if (py > H - 6) c = mix(c, '#2a2a22', (py - (H - 6)) / 8);
    } else {
      const rib = Math.floor(wu) % 3;
      c = rib === 0 ? '#1a3468' : rib === 1 ? '#2a4c8e' : '#22407a';
      if (hash2(Math.floor(wu), variant, 67) < 0.18) c = mix(c, '#7a4a2a', Math.min(0.6, (py / plinth) * 0.8));  // rust streaks
      if (variant % 4 === 0 && wu > 5 && wu < 10) c = (wu < 6 || wu > 9) ? '#2a2c30' : '#464a52';                   // steel column
    }
    return side === 'right' ? shade(c, -0.32) : c;
  },
});

registerWall('awayend_blockwork', { // painted breeze blocks: navy gloss dado, white stripe, cream above
  top: '#5a5850',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const dado = H - Math.min(30, Math.round(H * 0.45));
    let c;
    if (py < 2) c = '#8a8678';
    else if (py >= dado - 1 && py <= dado) c = '#e8e4d8';
    else if (py > dado) c = bondColor(u, py, 8, 5, variant, '#1c2c54', '#142040', 68);
    else c = bondColor(u, py, 8, 5, variant, '#cfc8b0', '#aaa490', 69);
    if (py > H - 3) c = shade(c, -0.35);
    if (hash2(Math.floor(u * 16), Math.floor(py / 2) + variant * 31, 70) < 0.015) c = '#3a3a3a';  // scuffs
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('awayend_pillar', { // round-ish concrete column with a blue & white band
  top: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.4 ? '#7a7a80' : '#4a4a50'),
  variants: 2,
  face(u, py, side, H) {
    let c = '#707078';
    const b0 = Math.round(H * 0.42), b1 = Math.round(H * 0.56);
    if (py >= b0 && py < b1) c = (py === b0 + 3 || py === b1 - 4) ? '#f0f0e8' : BLUE;
    if (py < 3) c = '#5a5a62';
    if (py > H - 4) c = '#3a3a40';
    // roundness: darken toward the edges of each face
    const e = side === 'left' ? u : 1 - u;
    if (e < 0.15) c = shade(c, 0.12);
    if (e > 0.85) c = shade(c, -0.15);
    if (hash2(Math.floor(u * 16), py, 71) < 0.03) c = shade(c, -0.15);
    return side === 'right' ? shade(c, -0.28) : c;
  },
});

registerWall('awayend_kioskwall', { // refreshment kiosk: menu board, lit serving hatch, steel counter front
  top: '#2a2a30',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c;
    const hatch0 = Math.round(H * 0.42), hatch1 = H - 12;
    if (py < 3) c = '#1a1a20';
    else if (py < hatch0 - 4) {                                     // menu board
      c = '#141418';
      const row = py - 6;
      if (row >= 0 && row % 4 < 2 && wu > 1.5 && wu < 14.5) {
        const k = hash2(Math.floor(wu * 1.5) + variant * 11, Math.floor(row / 4), 72);
        if (wu > 11) c = k < 0.7 ? '#ffd23a' : '#141418';            // prices
        else if (k < 0.62) c = Math.floor(row / 4) === 0 ? '#ff6a3a' : '#e8e8e0';
      }
    } else if (py < hatch0) c = (Math.floor(wu) % 4 < 2) ? BLUE : '#f0f0e8';   // striped fascia
    else if (py < hatch1) {                                          // open hatch, warm inside
      const iy = py - hatch0;
      if (iy < 3) c = (iy % 2) ? '#7a7e86' : '#a0a4ac';             // rolled shutter
      else if (wu < 1 || wu > 15) c = '#3a3a40';
      else {
        c = iy < 8 ? '#e8b060' : '#c88a44';
        if (iy === 10 && wu > 2 && wu < 14) c = '#5a3a20';           // shelf
        if (iy > 4 && iy < 10 && wu > 9 && wu < 12) c = '#c8ccd4';   // tea urn
        if (iy > 11 && wu > 3 && wu < 8) c = '#a0602a';              // pies
      }
    } else c = (Math.floor(wu) % 2) ? '#8a9098' : '#a8aeb6';         // counter front
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

registerWall('awayend_toiletwall', { // grubby white tiles, navy band, scribbles
  top: '#8a8a90',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c = ((wu % 4) < 0.7 || py % 4 === 0) ? '#9a9c98' : '#dcddd6';
    if (py > H * 0.55 && py < H * 0.55 + 3) c = '#1c2c54';
    if (py < 2) c = '#7a7a80';
    if (py > H - 5) c = mix(c, '#6a6450', 0.35);
    if (hash2(Math.floor(wu / 4) + variant * 9, Math.floor(py / 4), 73) < 0.05) c = '#b8b8a8';   // cracked tile
    // scribbled marker graffiti
    if (variant % 3 === 0 && py > 12 && py < 22 && wu > 3 && wu < 13 && hash2(Math.floor(wu * 2), py, 74 + variant) < 0.22) c = variant % 2 ? '#202020' : '#b02020';
    return side === 'right' ? shade(c, -0.25) : c;
  },
});

function fenceFace(planeSide) {
  return (u, py, side, H) => {
    const wu = u * 16;
    const dark = side === 'right' ? '#24272c' : '#353940';
    if (side !== planeSide) return (wu < 1.2 || py < 2) ? dark : null;   // only posts on the perpendicular face
    if (Math.floor(wu) % 8 === 0 || py < 2 || py === Math.floor(H * 0.5) || py > H - 2) return dark;
    if (py < 5 && Math.floor(wu) % 2 === 0) return side === 'right' ? '#4a4e56' : '#5a5e66';   // spikes / top mesh
    const a = Math.floor(wu * 2) + py, b = Math.floor(wu * 2) - py;
    if (((a % 6) + 6) % 6 === 0 || ((b % 6) + 6) % 6 === 0) return side === 'right' ? '#5a606a' : '#787e88';
    return null;
  };
}
registerWall('awayend_fenceY', { // perimeter fence running along world y (mesh on the +x face)
  top: (u, v) => (Math.abs(u - 0.5) < 0.08 ? '#3a3d44' : null),
  variants: 1,
  face: fenceFace('right'),
});
registerWall('awayend_fenceX', { // segregation fence running along world x (mesh on the +y face)
  top: (u, v) => (Math.abs(v - 0.5) < 0.08 ? '#3a3d44' : null),
  variants: 1,
  face: fenceFace('left'),
});
registerWall('awayend_invisible', { top: () => null, face: () => null, variants: 1 });

registerWall('awayend_farstand', { // the main stand across the pitch: roof, packed blue seats, advert band
  top: '#1a1c22',
  variants: 8,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    let c;
    const roof = 22, adv = H - 14;
    if (py < roof) {
      c = py < 4 ? '#2a2c34' : '#14151a';
      if (py > 10 && py < 14 && (Math.floor(wu) + variant) % 6 < 2) c = '#e8f0ff';       // roof floodlights
      if (py === roof - 1) c = '#3a3e48';
    } else if (py < adv) {
      const row = Math.floor((py - roof) / 5), ry = (py - roof) % 5;
      const seat = Math.floor(wu / 2), k = hash2(seat + variant * 17, row, 75);
      if (ry === 4) c = '#0e1a3a';
      else if (k < 0.7) {                                                                 // a fan
        if (ry < 2) c = k < 0.12 ? '#e8d27a' : k < 0.5 ? '#c08a60' : '#e2a97a';
        else c = k < 0.35 ? BLUE : k < 0.55 ? '#f2f2f2' : '#2a2a34';
      } else c = ry < 2 ? '#1a3a8a' : BLUE;                                                // empty seat
    } else {
      c = '#1a1a20';
      if (py > adv + 2 && py < H - 3) {
        const pal = [['#f2f2f2', BLUE], ['#ffd23a', '#1a1a1a'], [BLUE, '#ffffff'], ['#c8102e', '#ffffff']][variant % 4];
        c = (hash2(Math.floor(wu / 2), py, variant) < 0.5 && Math.floor(wu) % 5 !== 0) ? pal[1] : pal[0];
      }
    }
    return side === 'right' ? shade(c, -0.3) : c;
  },
});

// ================================================================== PROPS
registerProp('awayend_turnstile', { // walk-through turnstile; the rotor spins when someone pushes through
  h: 0, solid: false,
  update(p, world, dt) {
    let near = false;
    for (const f of world.fighters) if (f.alive && Math.abs(f.x - p.x - 0.5) < 0.6 && Math.abs(f.y - p.y - 0.5) < 0.7 && Math.hypot(f.vx, f.vy) > 0.5) near = true;
    p.spin = (p.spin || 0) + (near ? dt * 7 : 0);
    if (near && (p.clickT = (p.clickT || 0) - dt) <= 0) { p.clickT = 0.3; world.sfx('menuMove', { x: p.x, y: p.y }); }
  },
  draw(ctx, ax, ay, p) {
    // cabinet on the -x side of the lane
    isoBox(ctx, ax, ay, 0.02, 0.15, 0, 0.26, 0.7, 1.05, { top: '#8a8e96', left: '#5a5e66', right: '#3e4248', outline: OL });
    const lamp = proj(ax, ay, 0.15, 0.5, 1.05);
    fr(ctx, OL, lamp.x - 2, lamp.y - 3, 4, 3); fr(ctx, '#3aff6a', lamp.x - 1, lamp.y - 2, 2, 1);
    // rotor hub + 3 arms
    const hub = proj(ax, ay, 0.3, 0.5, 0.85);
    const a0 = p.spin || 0;
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * 2.094;
      const e = proj(ax, ay, 0.3 + Math.max(0, Math.cos(a)) * 0.55, 0.5 + Math.sin(a) * 0.32, 0.85 + Math.min(0, Math.cos(a)) * 0.35);
      thick(ctx, hub.x, hub.y, e.x, e.y, 3, OL); thick(ctx, hub.x, hub.y, e.x, e.y, 1, '#c8ccd4');
    }
    ellipse(ctx, hub.x, hub.y, 2, 2, '#9aa0a8');
  },
});

registerProp('awayend_burgervan', { // greasy burger van, hatch open on the +y side
  w: 2, d: 1, h: 1.7,
  light: { z: 1.2, r: 3.4, color: '#ffc070', intensity: 0.85 },
  breakable: null,
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    for (const [x, y] of [[0.4, 0.92], [1.5, 0.92]]) { const s = P(x, y, 0.16); ellipse(ctx, s.x, s.y, 4, 3, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 1, '#5a5a60'); }
    isoBox(ctx, ax, ay, 0.04, 0.1, 0.22, 1.92, 0.8, 1.5, { top: '#f0ead8', left: '#e2dac4', right: '#b4ac96', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.04, 0.9, 1.92, 0.42, 0.56, '#c8102e');            // red stripe
    isoPanel(ctx, ax, ay, 'right', 1.96, 0.1, 0.8, 0.42, 0.56, '#a00c24');
    // serving hatch with warm interior and the cook
    isoPanel(ctx, ax, ay, 'left', 0.5, 0.9, 1.0, 0.85, 1.45, OL);
    isoPanel(ctx, ax, ay, 'left', 0.55, 0.9, 0.9, 0.9, 1.42, '#f0b860');
    const ck = P(1.0, 0.9, 1.0);
    fr(ctx, '#f4f4f0', ck.x - 3, ck.y - 6, 6, 6); fr(ctx, '#e2a97a', ck.x - 2, ck.y - 10, 4, 4); fr(ctx, '#f4f4f0', ck.x - 2, ck.y - 12, 4, 2);
    // hatch flap awning
    fillPoly(ctx, [P(0.5, 0.9, 1.5), P(1.5, 0.9, 1.5), P(1.5, 1.25, 1.6), P(0.5, 1.25, 1.6)], OL);
    fillPoly(ctx, [P(0.53, 0.92, 1.52), P(1.47, 0.92, 1.52), P(1.47, 1.22, 1.6), P(0.53, 1.22, 1.6)], '#d8d0b8');
    // counter shelf with sauce bottles
    isoBox(ctx, ax, ay, 0.5, 0.9, 0.82, 1.0, 0.16, 0.05, { color: '#9aa0a8' });
    const sb = P(0.7, 0.98, 0.87); fr(ctx, '#d02020', sb.x, sb.y - 4, 2, 4); fr(ctx, '#e8c020', sb.x + 4, sb.y - 2, 2, 4);
    // roof sign
    isoBox(ctx, ax, ay, 0.12, 0.4, 1.72, 1.76, 0.12, 0.4, { top: '#1a1a20', left: '#141418', right: '#0e0e12', outline: OL });
    onFace(ctx, ax, ay, 'left', 0.2, 0.52, 2.06, g => drawText(g, 'GRUB', 2, 0, { color: '#ffd23a' }));
    // gas bottle + chimney steam
    const gb = P(1.85, 0.25, 1.72); fr(ctx, OL, gb.x - 1, gb.y - 6, 3, 6); fr(ctx, '#9aa0a8', gb.x, gb.y - 5, 1, 5);
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.6 + i * 0.25) % 1);
      ctx.globalAlpha = 0.35 * (1 - k);
      fr(ctx, '#d8dce0', gb.x + Math.sin(t * 2 + i) * 2 - 1, gb.y - 8 - k * 18, 3, 2);
    }
    ctx.globalAlpha = 1;
  },
});

registerProp('awayend_kiosk', { // programme seller's booth (flat roof: you can jump on it)
  h: 1.2,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.8, 0.8, 1.2, { top: '#3a3a40', left: '#2a5a3a', right: '#1e4029', outline: OL });
    // display window with programme covers
    isoPanel(ctx, ax, ay, 'left', 0.18, 0.9, 0.64, 0.45, 1.0, OL);
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.9, 0.6, 0.48, 0.97, '#d8d4c4');
    for (let i = 0; i < 3; i++) {
      isoPanel(ctx, ax, ay, 'left', 0.24 + i * 0.19, 0.9, 0.14, 0.56, 0.9, i === 1 ? '#c8102e' : BLUE);
      isoPanel(ctx, ax, ay, 'left', 0.24 + i * 0.19, 0.9, 0.14, 0.78, 0.84, '#f2f2f2');
    }
    isoPanel(ctx, ax, ay, 'right', 0.9, 0.18, 0.64, 0.2, 0.4, '#e8d8a0');
    onFace(ctx, ax, ay, 'right', 0.9, 0.82, 0.38, g => drawText(g, '£2', 4, 0, { color: OL }));
    // little awning
    fillPoly(ctx, [proj(ax, ay, 0.1, 0.9, 1.15), proj(ax, ay, 0.9, 0.9, 1.15), proj(ax, ay, 0.9, 1.1, 1.0), proj(ax, ay, 0.1, 1.1, 1.0)], '#f0f0e8');
    for (let i = 0; i < 4; i++) fillPoly(ctx, [proj(ax, ay, 0.1 + i * 0.2, 0.9, 1.15), proj(ax, ay, 0.2 + i * 0.2, 0.9, 1.15), proj(ax, ay, 0.2 + i * 0.2, 1.1, 1.0), proj(ax, ay, 0.1 + i * 0.2, 1.1, 1.0)], BLUE);
  },
});

registerProp('awayend_counter', { // concourse serving counter: urn, pie warmer (breakable — free pies)
  h: 1.1,
  breakable: { hp: 26, debris: ['#9aa0a8', '#c8ccd4', '#a0602a'], sfx: 'metal', drops: [['pie', 0.55], ['awayend_beeftea', 0.45], ['coin', 0.5]], score: 60 },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.02, 0.2, 0, 0.96, 0.6, 1.05, { top: '#b8bec6', left: '#8a9098', right: '#6a7078', outline: OL });
    for (let i = 1; i < 6; i++) { const a = proj(ax, ay, 0.02 + i * 0.16, 0.8, 0.05), b = proj(ax, ay, 0.02 + i * 0.16, 0.8, 0.95); line(ctx, a.x, a.y, b.x, b.y, '#7a8088'); }
    if (p.o.urn) {
      const u = proj(ax, ay, 0.35, 0.5, 1.05);
      fr(ctx, OL, u.x - 4, u.y - 13, 9, 13); fr(ctx, '#c8ccd4', u.x - 3, u.y - 12, 7, 12); fr(ctx, '#f0f2f6', u.x - 2, u.y - 12, 2, 12); fr(ctx, OL, u.x - 2, u.y - 15, 5, 3);
      const k = (t * 0.7) % 1; ctx.globalAlpha = 0.4 * (1 - k); fr(ctx, '#e8ecf0', u.x - 1 + Math.sin(t * 3) * 2, u.y - 18 - k * 12, 2, 2); ctx.globalAlpha = 1;
    } else {
      isoBox(ctx, ax, ay, 0.2, 0.3, 1.05, 0.6, 0.4, 0.32, { top: '#c8e0e8', left: '#a8c8d4', right: '#88a8b4', outline: OL });
      for (let i = 0; i < 3; i++) { const s = proj(ax, ay, 0.28 + i * 0.16, 0.55, 1.1); fr(ctx, '#c8862e', s.x - 2, s.y - 2, 4, 2); fr(ctx, '#e8b45a', s.x - 1, s.y - 3, 2, 1); }
    }
  },
});

registerProp('awayend_crushbarrier', { // terrace crush barrier (stand behind one when the crowd surges)
  h: 1.0,
  draw(ctx, ax, ay, p) {
    const z0 = p.o.z || 0;
    const alongY = p.o.dir !== 'x';
    const P = (a, z) => (alongY ? proj(ax, ay, 0.5, a, z0 + z) : proj(ax, ay, a, 0.5, z0 + z));
    const col = p.o.color || '#2a4c8e';
    for (const a of [0.15, 0.85]) {
      const b = P(a, 0), tp = P(a, 0.95);
      thick(ctx, b.x, b.y, tp.x, tp.y, 4, OL); thick(ctx, b.x, b.y, tp.x, tp.y, 2, shade(col, -0.2));
      fr(ctx, OL, b.x - 3, b.y - 1, 6, 2);
    }
    const l = P(-0.02, 0.95), r = P(1.02, 0.95);
    thick(ctx, l.x, l.y, r.x, r.y, 5, OL); thick(ctx, l.x, l.y, r.x, r.y, 3, col);
    line(ctx, l.x, l.y - 1, r.x, r.y - 1, shade(col, 0.35));
    for (let i = 0; i < 4; i++) {                                   // rust & chipped paint
      const k = hash2(p.x * 3 + i, p.y * 5, 77);
      const q = P(0.1 + k * 0.8, 0.95); fr(ctx, k < 0.5 ? '#8a4a28' : '#d8d8d0', q.x, q.y, 2, 1);
    }
  },
});

registerProp('awayend_tv', { // CRT telly on a bracket (wall decal) showing the match
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    const z = (p.o.z ?? 2.4) + 0.5;
    const x = side === 'left' ? 0.2 : 1.02, y = side === 'left' ? 1.02 : 0.8;
    onFace(ctx, ax, ay, side, x, y, z, g => {
      fr(g, OL, 5, -3, 2, 3);                                         // bracket
      fr(g, OL, 0, 0, 12, 9); fr(g, '#2a2a30', 1, 1, 10, 7);
      fr(g, '#2e6a2a', 2, 2, 8, 5);
      fr(g, '#e8eee0', 6, 2, 1, 5);
      const k = t * 0.8 + p.x;
      fr(g, '#f2f2f2', 3 + Math.floor((Math.sin(k) + 1) * 2.5), 3 + Math.floor((Math.cos(k * 1.3) + 1)), 1, 1);
      fr(g, BLUE, 3 + Math.floor((Math.sin(k * 0.7 + 2) + 1) * 3), 4, 1, 1);
      fr(g, '#c8102e', 3 + Math.floor((Math.cos(k * 0.9) + 1) * 3), 5, 1, 1);
      if (Math.floor(t * 7 + p.y) % 13 === 0) fr(g, '#a0a8b0', 2, 2 + Math.floor(t * 20) % 5, 8, 1);   // bad reception
      fr(g, '#d8d0c0', 2, 7, 3, 1);
    });
  },
});

registerProp('awayend_vending', { // drinks machine; smash it (it hides something...)
  h: 1.8,
  light: { z: 1.2, r: 2.2, color: '#9ad0ff', intensity: 0.5 },
  breakable: { hp: 34, debris: ['#c8102e', '#e8e8e0', '#9ad0ff', '#2a62d8'], sfx: 'glass', drops: [['energy', 0.9], ['energy', 0.5], ['coin', 0.8]], score: 120 },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.1, 0.18, 0, 0.8, 0.64, 1.8, { top: '#3a3a44', left: '#b01828', right: '#7a1020', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.16, 0.82, 0.48, 0.55, 1.68, OL);
    isoPanel(ctx, ax, ay, 'left', 0.18, 0.82, 0.44, 0.58, 1.65, '#bfe0f0');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const s = proj(ax, ay, 0.23 + c * 0.13, 0.82, 0.68 + r * 0.25);
      fr(ctx, ['#2a62d8', '#c8102e', '#f0c020', '#3aa040'][(r + c) % 4], s.x, s.y - 3, 2, 3);
    }
    isoPanel(ctx, ax, ay, 'left', 0.68, 0.82, 0.12, 0.9, 1.3, '#202024');
    const sl = proj(ax, ay, 0.74, 0.82, 1.2); fr(ctx, Math.floor(t * 2) % 2 ? '#3aff6a' : '#1a6a2a', sl.x, sl.y - 1, 1, 1);
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.82, 0.6, 0.15, 0.38, '#141418');
  },
});

registerProp('awayend_urinal', { // steel trough urinal against the -x wall
  h: 0.6,
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.0, 0.0, 0, 0.12, 1.0, 1.5, { top: '#c8ccd0', left: '#a8acb0', right: '#8a8e94' });
    isoBox(ctx, ax, ay, 0.12, 0.02, 0.35, 0.36, 0.96, 0.22, { top: '#3a4a52', left: '#b8bcc0', right: '#9aa0a6', outline: OL });
    const s = proj(ax, ay, 0.2, 0.5, 0.57); fr(ctx, '#e8e0a0', s.x - 1, s.y - 1, 3, 1);        // the lemon (it's tradition)
    const d = proj(ax, ay, 0.08, 0.5, 1.4); fr(ctx, '#9aa0a6', d.x - 1, d.y, 2, 4);
  },
});

registerProp('awayend_sink', { // grim hand basin with a cracked mirror on the wall behind
  h: 0.9,
  breakable: { hp: 18, debris: ['#e8e8e0', '#c8ccd0'], sfx: 'glass', drops: [['coin', 0.3]], score: 40 },
  draw(ctx, ax, ay, p) {
    onFace(ctx, ax, ay, 'left', 0.25, 0.02, 2.0, g => { fr(g, OL, 0, 0, 9, 11); fr(g, '#a8c0cc', 1, 1, 7, 9); fr(g, '#e8f4f8', 2, 2, 1, 4); line(g, 3, 1, 7, 9, '#5a6a72'); });
    isoBox(ctx, ax, ay, 0.45, 0.1, 0, 0.1, 0.1, 0.7, { color: '#c8ccd0' });
    isoBox(ctx, ax, ay, 0.2, 0.05, 0.7, 0.6, 0.45, 0.18, { top: '#e8eae6', left: '#d0d2ce', right: '#b0b2ae', outline: OL });
    const tp = proj(ax, ay, 0.5, 0.15, 0.95); fr(ctx, '#9aa0a8', tp.x - 1, tp.y - 2, 2, 3);
  },
});

registerProp('awayend_cubicle', { // toilet cubicle (door on the +y side), solid
  h: 2.1,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 0.9, 0.9, 2.1, { top: '#4a4038', left: '#7a5a3a', right: '#5a4228', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.95, 0.6, 0.15, 1.9, '#8a6a46');
    const k = proj(ax, ay, 0.7, 0.95, 1.0); fr(ctx, '#c8c8c0', k.x - 1, k.y - 1, 2, 2);
    const s = proj(ax, ay, 0.5, 0.95, 1.6); fr(ctx, p.o.engaged ? '#e03030' : '#30c050', s.x - 2, s.y - 1, 4, 2);
  },
});

registerProp('awayend_boiler', { // ancient boiler in the hidden room (pilot light flickers)
  h: 1.9,
  light: { z: 0.6, r: 2.0, color: '#4a8aff', intensity: 0.55, flicker: true },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.8, 0.8, 1.9, { top: '#5a3a30', left: '#7a4436', right: '#58302a', outline: OL });
    for (const z of [0.5, 1.2]) { const a = proj(ax, ay, 0.1, 0.9, z), b = proj(ax, ay, 0.9, 0.9, z); line(ctx, a.x, a.y, b.x, b.y, '#3a2420'); }
    const gz = proj(ax, ay, 0.35, 0.9, 1.5); ellipse(ctx, gz.x, gz.y, 3, 3, OL); ellipse(ctx, gz.x, gz.y, 2, 2, '#e8e4d8');
    line(ctx, gz.x, gz.y, gz.x + Math.round(Math.cos(t * 0.7) * 2), gz.y - 1, '#c01818');
    const pl = proj(ax, ay, 0.6, 0.9, 0.35); fr(ctx, OL, pl.x - 2, pl.y - 3, 5, 4); fr(ctx, Math.sin(t * 17) > -0.5 ? '#6aa0ff' : '#2a4a8a', pl.x - 1, pl.y - 2, 3, 2);
    const pp = proj(ax, ay, 0.5, 0.5, 1.9), pt = proj(ax, ay, 0.5, 0.5, 3.2);
    thick(ctx, pp.x, pp.y, pt.x, pt.y, 4, OL); thick(ctx, pp.x, pp.y, pt.x, pt.y, 2, '#8a6a4a');
  },
});

registerProp('awayend_floodlight', { // lattice floodlight pylon with a lamp bank
  h: 0, solid: false, depthBias: 0.5,
  draw(ctx, ax, ay, p, t) {
    const H = p.o.height ?? 9;
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, H);
    const w0 = 9, w1 = 3;
    const L = (k) => ({ x: b.x - w0 + (w0 - w1) * k, y: b.y + (top.y - b.y) * k });
    const R = (k) => ({ x: b.x + w0 - (w0 - w1) * k, y: b.y + (top.y - b.y) * k });
    thick(ctx, L(0).x, L(0).y, L(1).x, L(1).y, 3, OL); thick(ctx, R(0).x, R(0).y, R(1).x, R(1).y, 3, OL);
    thick(ctx, L(0).x, L(0).y, L(1).x, L(1).y, 1, '#8a8e96'); thick(ctx, R(0).x, R(0).y, R(1).x, R(1).y, 1, '#6a6e76');
    for (let i = 0; i < 10; i++) {
      const k0 = i / 10, k1 = (i + 1) / 10;
      line(ctx, L(k0).x, L(k0).y, R(k1).x, R(k1).y, '#5a5e66');
      line(ctx, R(k0).x, R(k0).y, L(k1).x, L(k1).y, '#4a4e56');
    }
    // lamp bank (tilted toward the terrace)
    const bx = top.x - 16, by = top.y - 18;
    fr(ctx, OL, bx - 1, by - 1, 34, 20); fr(ctx, '#2a2c32', bx, by, 32, 18);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const on = !(p.o.flicker && r === 1 && c === 3 && Math.sin(t * 9) > 0.6);
      fr(ctx, on ? '#fffbe0' : '#6a6650', bx + 2 + c * 6, by + 2 + r * 5, 4, 3);
      if (on) fr(ctx, '#ffffff', bx + 3 + c * 6, by + 3 + r * 5, 2, 1);
    }
  },
});

registerProp('awayend_dugout', { // perspex dugout (the home bench) — you can't sit there
  w: 2, d: 1, h: 1.4,
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 1.9, 0.12, 1.4, { top: '#1a2a5a', left: '#1f3a7a', right: '#142a5a', outline: OL });
    for (const x of [0.4, 0.9, 1.4]) isoBox(ctx, ax, ay, x, 0.25, 0, 0.36, 0.4, 0.45, { color: BLUE, outline: OL });
    isoBox(ctx, ax, ay, 0.05, 0.05, 1.4, 1.9, 0.85, 0.08, { top: '#9ab8d0', left: '#7a98b0', right: '#5a7890', outline: OL });
    for (const x of [0.06, 1.88]) {
      const a = proj(ax, ay, x, 0.9, 0), b = proj(ax, ay, x, 0.9, 1.4);
      thick(ctx, a.x, a.y, b.x, b.y, 2, '#c8d8e8');
    }
    ctx.globalAlpha = 0.25;
    isoPanel(ctx, ax, ay, 'right', 1.95, 0.05, 0.85, 0.1, 1.4, '#c8e0f0');
    ctx.globalAlpha = 1;
  },
});

registerProp('awayend_cctv', { // wall CCTV camera that pans (wall decal)
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    const z = (p.o.z ?? 2.6) + 0.3;
    onFace(ctx, ax, ay, side, side === 'left' ? 0.4 : 1.02, side === 'left' ? 1.02 : 0.6, z, g => {
      fr(g, OL, 3, 0, 2, 5);
      const sw = Math.round(Math.sin(t * 0.6 + p.x) * 2);
      fr(g, OL, sw - 1, 4, 9, 5); fr(g, '#d8d8d0', sw, 5, 7, 3); fr(g, '#2a2a30', sw + (sw >= 0 ? 6 : 0), 5, 1, 3);
      if (Math.floor(t * 1.5) % 2) fr(g, '#ff3030', sw + 1, 5, 1, 1);
    });
  },
});

registerProp('awayend_walllamp', { // caged bulkhead / strip light on a wall (wall decal + light)
  h: 0, solid: false, depthBias: 0.03,
  light: { z: 2.2, r: 3.4, color: '#d0e8ff', intensity: 0.75 },
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    const on = !(p.o.flicker && (Math.sin(t * 13 + p.x) + Math.sin(t * 5.3)) > 1.5);
    onFace(ctx, ax, ay, side, side === 'left' ? 0.25 : 1.02, side === 'left' ? 1.02 : 0.75, p.o.z ?? 2.3, g => {
      fr(g, OL, 0, 0, 9, 4); fr(g, on ? '#f4fbff' : '#6a7078', 1, 1, 7, 2);
      if (on) { g.globalAlpha = 0.25; fr(g, '#d0e8ff', -2, -2, 13, 8); g.globalAlpha = 1; }
    });
  },
});

registerProp('awayend_amnesty', { // confiscated-items cage: smash it for everything they took off the fans
  h: 1.0,
  breakable: { hp: 18, debris: ['#8a8e96', '#5a5e66', '#6a3a14'], sfx: 'metal', drops: [['bottle', 0.85], ['umbrella', 0.6], ['flag', 0.35], ['binlid', 0.2]], score: 60 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.15, 0.15, 0, 0.7, 0.7, 0.95, { top: '#3a3a40', left: '#2a2a30', right: '#1e1e24' });
    const b1 = proj(ax, ay, 0.35, 0.6, 0.2); fr(ctx, '#5a3010', b1.x, b1.y - 8, 2, 8);
    const b2 = proj(ax, ay, 0.6, 0.5, 0.2); fr(ctx, '#1a1a22', b2.x, b2.y - 10, 2, 10); fr(ctx, '#8a5a30', b2.x, b2.y - 11, 2, 1);
    const b3 = proj(ax, ay, 0.5, 0.4, 0.2); fr(ctx, '#ffd23a', b3.x - 1, b3.y - 9, 4, 3);
    for (let i = 0; i <= 6; i++) {
      const a = proj(ax, ay, 0.15 + i * 0.7 / 6, 0.85, 0), b = proj(ax, ay, 0.15 + i * 0.7 / 6, 0.85, 0.95); line(ctx, a.x, a.y, b.x, b.y, '#9aa0a8');
      const c = proj(ax, ay, 0.85, 0.15 + i * 0.7 / 6, 0), d = proj(ax, ay, 0.85, 0.15 + i * 0.7 / 6, 0.95); line(ctx, c.x, c.y, d.x, d.y, '#6a7078');
    }
    isoBox(ctx, ax, ay, 0.15, 0.15, 0.95, 0.7, 0.7, 0.05, { color: '#9aa0a8', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.3, 0.86, 0.4, 0.4, 0.6, '#f0e8c0');
  },
});

registerProp('awayend_hamper', { // wicker kit hamper (breakable)
  h: 0.9,
  breakable: { hp: 14, debris: ['#b08a50', '#8a6a38', BLUE], sfx: 'wood', drops: [['flag', 0.5], ['awayend_programme', 0.5], ['energy', 0.4]], score: 50 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.1, 0.12, 0, 0.8, 0.76, 0.85, { top: '#a07a40', left: '#b08a50', right: '#8a6a38', outline: OL });
    for (let i = 1; i < 4; i++) { const a = proj(ax, ay, 0.1, 0.88, i * 0.21), b = proj(ax, ay, 0.9, 0.88, i * 0.21); line(ctx, a.x, a.y, b.x, b.y, '#7a5a30'); }
    isoPanel(ctx, ax, ay, 'left', 0.35, 0.88, 0.3, 0.3, 0.55, BLUE);
  },
});

// ================================================================== BLENDER SPRITE OVERLAYS
// scripts/blender/env_awayend.py pre-renders the static bodies of these props. World.drawProp draws the sprite
// (variant 0) and then def.overlay(ctx, ax, ay, p, t, world): the animated or per-placement bits stay procedural here.
// Wall decals (tv / cctv / walllamp) and the floodlight vary by side / z / height, which envProp() can't select, so their
// variant 0 is an empty image and the overlay blits the matching variant itself (modelled at z = ENV_ZB, shifted by o.z).
const ENV_ZB = 1.0;
function envPart(ctx, type, pred, ax, ay, dz = 0) {
  const v = (ENV.props[type] || []).find(pred);
  if (!v || !v.img) return false;
  ctx.drawImage(v.img, Math.round(ax - v.ax / 2), Math.round(ay - dz * Z_PX - v.ay / 2), v.img.width / 2, v.img.height / 2);
  return true;
}
function spriteOverlay(id, fn) { const def = PROPS_OVERLAY[id]; if (def) def.overlay = fn; }

spriteOverlay('awayend_turnstile', (ctx, ax, ay, p) => {    // spinning rotor arms
  const hub = proj(ax, ay, 0.38, 0.5, 0.85);
  const a0 = p.spin || 0;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.094;
    const e = proj(ax, ay, 0.38 + Math.max(0, Math.cos(a)) * 0.5, 0.5 + Math.sin(a) * 0.32, 0.85 + Math.min(0, Math.cos(a)) * 0.35);
    thick(ctx, hub.x, hub.y, e.x, e.y, 3, OL); thick(ctx, hub.x, hub.y, e.x, e.y, 1, '#c8ccd4');
  }
  ellipse(ctx, hub.x, hub.y, 2, 2, '#9aa0a8');
});

spriteOverlay('awayend_burgervan', (ctx, ax, ay, p, t) => {  // lit roof-sign lettering + steam from the flue
  onFace(ctx, ax, ay, 'left', 0.15, 0.53, 2.07, g => drawText(g, 'GRUB', 13, 0, { color: '#ffd23a', align: 'center' }));
  const gb = proj(ax, ay, 0.3, 0.3, 2.1);
  for (let i = 0; i < 4; i++) {
    const k = ((t * 0.6 + i * 0.25) % 1);
    ctx.globalAlpha = 0.35 * (1 - k);
    fr(ctx, '#d8dce0', gb.x + Math.sin(t * 2 + i) * 2 - 1, gb.y - 2 - k * 18, 3, 2);
  }
  ctx.globalAlpha = 1;
});

spriteOverlay('awayend_kiosk', (ctx, ax, ay) => {
  onFace(ctx, ax, ay, 'right', 0.915, 0.8, 0.38, g => drawText(g, '£2', 4, 0, { color: OL }));
});

spriteOverlay('awayend_counter', (ctx, ax, ay, p, t) => {   // urn or pie warmer on top (+ urn steam)
  const prev = ctx.globalAlpha;
  if (p.flash > 0) ctx.globalAlpha = prev * 0.6;
  const ok = envPart(ctx, 'awayend_counter', v => v.part === (p.o.urn ? 'urn' : 'warmer'), ax, ay);
  ctx.globalAlpha = prev;
  if (!ok) { p.def.draw(ctx, ax, ay, p, t); return; }
  if (p.o.urn) {
    const u = proj(ax, ay, 0.35, 0.5, 1.72);
    const k = (t * 0.7) % 1; ctx.globalAlpha = 0.4 * (1 - k); fr(ctx, '#e8ecf0', u.x - 1 + Math.sin(t * 3) * 2, u.y - 3 - k * 12, 2, 2); ctx.globalAlpha = 1;
  }
});

spriteOverlay('awayend_tv', (ctx, ax, ay, p, t) => {
  const side = p.o.side || 'left';
  const dz = (p.o.z ?? 2.4) - ENV_ZB;
  if (!envPart(ctx, 'awayend_tv', v => v.side === side, ax, ay, dz)) { p.def.draw(ctx, ax, ay, p, t); return; }
  onFace(ctx, ax, ay - Math.round(dz * Z_PX), side, side === 'left' ? 0.2 : 1.28, side === 'left' ? 1.28 : 0.8, ENV_ZB + 0.5, g => {
    fr(g, '#2e6a2a', 2, 2, 8, 5);
    fr(g, '#e8eee0', 6, 2, 1, 5);
    const k = t * 0.8 + p.x;
    fr(g, '#f2f2f2', 3 + Math.floor((Math.sin(k) + 1) * 2.5), 3 + Math.floor((Math.cos(k * 1.3) + 1)), 1, 1);
    fr(g, BLUE, 3 + Math.floor((Math.sin(k * 0.7 + 2) + 1) * 3), 4, 1, 1);
    fr(g, '#c8102e', 3 + Math.floor((Math.cos(k * 0.9) + 1) * 3), 5, 1, 1);
    if (Math.floor(t * 7 + p.y) % 13 === 0) fr(g, '#a0a8b0', 2, 2 + Math.floor(t * 20) % 5, 8, 1);
    fr(g, '#d8d0c0', 2, 6, 3, 1);
  });
});

spriteOverlay('awayend_cctv', (ctx, ax, ay, p, t) => {
  const side = p.o.side || 'left';
  const dz = (p.o.z ?? 2.6) - ENV_ZB;
  if (!envPart(ctx, 'awayend_cctv', v => v.side === side, ax, ay, dz)) { p.def.draw(ctx, ax, ay, p, t); return; }
  if (Math.floor(t * 1.5) % 2) {
    const l = proj(ax, ay - Math.round(dz * Z_PX), side === 'left' ? 0.5 : 1.17, side === 'left' ? 1.17 : 0.5, ENV_ZB + 0.08);
    fr(ctx, '#ff3030', l.x, l.y, 1, 1);
  }
});

spriteOverlay('awayend_walllamp', (ctx, ax, ay, p, t) => {
  const side = p.o.side || 'left';
  const dz = (p.o.z ?? 2.3) - ENV_ZB;
  const on = !(p.o.flicker && (Math.sin(t * 13 + p.x) + Math.sin(t * 5.3)) > 1.5);
  if (!envPart(ctx, 'awayend_walllamp', v => v.side === side && !!v.lit === on, ax, ay, dz)) { p.def.draw(ctx, ax, ay, p, t); return; }
  if (on) onFace(ctx, ax, ay - Math.round(dz * Z_PX), side, side === 'left' ? 0.25 : 1.06, side === 'left' ? 1.06 : 0.75, ENV_ZB, g => {
    g.globalAlpha = 0.2; fr(g, '#d0e8ff', -2, -2, 13, 8); g.globalAlpha = 1;
  });
});

spriteOverlay('awayend_vending', (ctx, ax, ay, p, t) => {   // blinking coin-slot LED
  const sl = proj(ax, ay, 0.8, 0.84, 1.0); fr(ctx, Math.floor(t * 2) % 2 ? '#3aff6a' : '#1a6a2a', sl.x, sl.y - 1, 1, 1);
});

spriteOverlay('awayend_boiler', (ctx, ax, ay, p, t) => {    // pressure needle + flickering pilot light
  const gz = proj(ax, ay, 0.35, 0.96, 1.5);
  line(ctx, gz.x, gz.y, gz.x + Math.round(Math.cos(t * 0.7) * 2), gz.y - 1, '#c01818');
  if (Math.sin(t * 17) <= -0.5) { const pl = proj(ax, ay, 0.61, 0.93, 0.34); fr(ctx, '#2a4a8a', pl.x - 1, pl.y - 2, 3, 2); }
});

spriteOverlay('awayend_floodlight', (ctx, ax, ay, p, t) => {
  const H = p.o.height ?? 9;
  if (!envPart(ctx, 'awayend_floodlight', v => v.height === H, ax, ay)) { p.def.draw(ctx, ax, ay, p, t); return; }
  if (p.o.flicker && Math.sin(t * 9) > 0.6) {   // one lamp in the bank keeps dropping out
    const l = proj(ax, ay, 0.857, 0.461, H + 0.45);
    ellipse(ctx, l.x, l.y, 2, 2, '#6a6650');
  }
});

// ================================================================== ITEMS
registerItem('awayend_shield', {
  name: 'RIOT SHIELD', kind: 'weapon', score: 0,
  weapon: { dmg: 10, reach: 1.2, durability: 7, attack: 'awayend_shieldbash', throwDmg: 13, breaks: 'plastic' },
  icon(ctx, x, y) {
    fr(ctx, OL, x - 5, y - 15, 10, 15);
    ctx.globalAlpha = 0.8; fr(ctx, '#a8c8e0', x - 4, y - 14, 8, 13); ctx.globalAlpha = 1;
    fr(ctx, '#e8f4ff', x - 3, y - 13, 1, 5);
    fr(ctx, '#ffd23a', x - 4, y - 5, 8, 2); fr(ctx, OL, x - 2, y - 5, 1, 2); fr(ctx, OL, x + 1, y - 5, 1, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dir = Math.sin(ang) >= 0 ? 1 : -1;
    const x = Math.round(hx + dir * 2 - 4), y = Math.round(hy - 12);
    fr(ctx, OL, x - 1, y - 1, 10, 24);
    ctx.globalAlpha = flash ? 1 : 0.75; fr(ctx, flash ? '#ffffff' : '#a8c8e0', x, y, 8, 22); ctx.globalAlpha = 1;
    fr(ctx, '#e8f4ff', x + 1, y + 1, 1, 9);
    fr(ctx, '#ffd23a', x, y + 15, 8, 3); fr(ctx, OL, x + 2, y + 15, 1, 3); fr(ctx, OL, x + 5, y + 15, 1, 3);
  },
});
registerItem('awayend_programme', {
  name: 'ROLLED-UP PROGRAMME', kind: 'weapon', score: 0,
  weapon: { dmg: 6, reach: 1.2, durability: 12, attack: 'swing', throwDmg: 6, breaks: 'wood' },
  icon(ctx, x, y) {
    fr(ctx, OL, x - 7, y - 5, 14, 5); fr(ctx, '#e8e4d8', x - 6, y - 4, 12, 3); fr(ctx, BLUE, x - 2, y - 4, 4, 3); fr(ctx, '#ffffff', x - 6, y - 4, 12, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const bx = hx - dx * 2 * s, by = hy - dy * 2 * s, ex = hx + dx * 9 * s, ey = hy + dy * 9 * s;
    thick(ctx, bx, by, ex, ey, 5, OL); thick(ctx, bx, by, ex, ey, 3, flash ? '#fff' : '#e8e4d8');
    thick(ctx, hx + dx * 4 * s, hy + dy * 4 * s, hx + dx * 6 * s, hy + dy * 6 * s, 3, flash ? '#fff' : BLUE);
  },
});
registerItem('awayend_beeftea', {
  name: 'CUP OF BEEF TEA', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    fr(ctx, OL, x - 4, y - 9, 8, 9); fr(ctx, '#f0ece0', x - 3, y - 8, 6, 8); fr(ctx, '#6a3a1a', x - 3, y - 8, 6, 2); fr(ctx, BLUE, x - 3, y - 4, 6, 1);
    const k = ((t || 0) * 0.8) % 1; ctx.globalAlpha = 0.6 * (1 - k); fr(ctx, '#e8ecf0', x - 1 + Math.round(Math.sin((t || 0) * 4)), y - 11 - k * 5, 2, 2); ctx.globalAlpha = 1;
  },
});
registerItem('awayend_coin', { // only ever thrown from the home end
  name: 'COIN', kind: 'weapon', score: 0,
  weapon: { dmg: 3, reach: 1, durability: 1, attack: 'swing', throwDmg: 5, breaks: 'metal' },
  icon(ctx, x, y) { ellipse(ctx, x, y - 3, 3, 3, OL); ellipse(ctx, x, y - 3, 2, 2, '#c8ccd4'); },
  drawHeld(ctx, hx, hy, ang) {
    const w = Math.max(1, Math.round(Math.abs(Math.cos(ang)) * 2));
    ellipse(ctx, hx, hy, w + 1, 3, OL); ellipse(ctx, hx, hy, w, 2, '#d8dce4');
  },
});
