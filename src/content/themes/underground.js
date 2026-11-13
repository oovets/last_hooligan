// THE UNDERGROUND theme (Level 3): Nordhamn Metro floors, walls, props, items and the train renderer.
// Every id registered here starts with 'underground_'. Only ADDS ids (never redefines common ones).

import { registerFloor, registerWall } from '../../engine/tiles.js';
import { registerProp } from '../../game/props.js';
import { registerItem } from '../../game/items.js';
import { shade, mix } from '../../engine/color.js';
import { hash2 } from '../../engine/rng.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow } from '../../engine/gfx.js';
import { toScreen } from '../../engine/iso.js';
import { drawText } from '../../engine/font.js';
import { drawDoll } from '../../game/doll.js';
import { sampleAnim } from '../../game/poses.js';
import { audio } from '../../audio/audio.js';
import { homeKit } from '../rivals.js';

const OL = '#120c14';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const R = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

// ------------------------------------------------------------------ tiny 3x5 font (posters, boards, panels)
const TINY = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', ':': '000010000010000', '.': '000000000000010', '-': '000000111000000', '!': '010010010000010',
  '£': '011010111010111', '?': '110001010000010', '/': '001001010100100', "'": '010010000000000', '+': '000010111010000',
  '&': '010101010101011', 'Å': '010000010101101', 'Ö': '101010101101010', 'Ä': '101010101111101',
};
export function tinyWidth(s) { return Math.max(0, String(s).length * 4 - 1); }
// k = vertical shear per px (0.5 on a left wall face, -0.5 on a right face, 0 flat)
export function tinyText(ctx, s, x, y, color, k = 0, align = 'left') {
  s = String(s).toUpperCase();
  let cx = align === 'center' ? x - tinyWidth(s) / 2 : align === 'right' ? x - tinyWidth(s) : x;
  cx = Math.round(cx);
  ctx.fillStyle = color;
  const x0 = cx;
  for (const ch of s) {
    const g = TINY[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') {
      const px = cx + (i % 3), py = Math.floor(i / 3);
      ctx.fillRect(px, Math.round(y + py + Math.floor((px - x0) * k)), 1, 1);
    }
    cx += 4;
  }
}

// pixel rectangle on a wall face plane: tl = top-left screen point of the face region; k = shear
function faceRect(ctx, tl, k, px, py, w, h, c) {
  ctx.fillStyle = c;
  for (let i = 0; i < w; i++) ctx.fillRect(Math.round(tl.x + px + i), Math.round(tl.y + py + Math.floor((px + i) * k)), 1, h);
}

// ------------------------------------------------------------------ custom sounds (audio.customSfx hook)
try {
  audio.customSfx = audio.customSfx || {};
  audio.customSfx.underground_rumble = (a, t, o) => {
    a.noise(t, 2.4, { vol: 0.55 * o.vol, freq: 160, q: 0.6, type: 'lowpass', pan: o.pan, attack: 0.8 });
    a.tone(t, 2.2, { freq: 46, to: 38, type: 'sawtooth', vol: 0.12 * o.vol, pan: o.pan, attack: 0.7 });
  };
  audio.customSfx.underground_chime = (a, t, o) => {
    a.tone(t, 0.35, { freq: 784, type: 'sine', vol: 0.25 * o.vol, pan: o.pan });
    a.tone(t + 0.32, 0.5, { freq: 622, type: 'sine', vol: 0.25 * o.vol, pan: o.pan });
  };
  audio.customSfx.underground_whistle = (a, t, o) => {
    a.tone(t, 0.5, { freq: 1900, to: 2100, type: 'square', vol: 0.08 * o.vol, pan: o.pan });
    a.tone(t + 0.55, 0.7, { freq: 1900, to: 1850, type: 'square', vol: 0.08 * o.vol, pan: o.pan });
  };
  audio.customSfx.underground_zap = (a, t, o) => {
    a.noise(t, 0.25, { vol: 0.6 * o.vol, freq: 4000, q: 4, pan: o.pan, sweep: 0.3 });
    a.tone(t, 0.2, { freq: 120, type: 'sawtooth', vol: 0.3 * o.vol, pan: o.pan });
  };
} catch (e) { /* audio optional */ }

// ================================================================== FLOORS
registerFloor('underground_terrazzo', {
  pixel(u, v, tx, ty, r) {
    if (u < 0.03 || v < 0.03) return '#3c4440';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 31);
    if (n < 0.05) return '#8c9286';
    if (n > 0.96) return '#363c38';
    if (n > 0.92) return '#7a5c4a';
    return r < 0.5 ? '#5a625c' : '#5e665f';
  },
});
registerFloor('underground_corridor', { // small square tiles, cream & green border every other tile
  pixel(u, v, tx, ty) {
    const gu = (u * 4) % 1, gv = (v * 4) % 1;
    if (gu < 0.1 || gv < 0.1) return '#4a504a';
    const n = n2(tx * 4 + Math.floor(u * 4), ty * 4 + Math.floor(v * 4), 34);
    const base = n < 0.4 ? '#8a8a7c' : n < 0.8 ? '#82827a' : '#76786e';
    return n2(u * 32 + tx * 32, v * 32 + ty * 32, 35) < 0.04 ? '#5a5c54' : base;
  },
});
function platPix(u, v, tx, ty) {
  const gu = (u * 2) % 1, gv = (v * 2) % 1;
  if (gu < 0.05 || gv < 0.05) return '#2c302e';
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 32);
  const s = n2(tx * 2 + Math.floor(u * 2), ty * 2 + Math.floor(v * 2), 33);
  const base = s < 0.33 ? '#4a4f4c' : s < 0.66 ? '#464b48' : '#4f5451';
  return n < 0.05 ? '#383c3a' : n > 0.975 ? '#646a66' : base;
}
registerFloor('underground_platform', { pixel: platPix });
// w = distance (0..1) from the platform's track-side lip
function edgePix(w, u, v, tx, ty) {
  if (w < 0.05) return '#151716';
  if (w < 0.2) return ((u * 2) % 1 < 0.04) ? '#7a7a72' : (w < 0.08 ? '#d0d0c4' : '#b4b4a8');
  if (w < 0.3) return (w < 0.215 || w > 0.29) ? '#a08010' : '#e8c020';
  if (w < 0.5) return (((u * 16) % 2) < 1 && ((w * 20) % 2) < 1) ? '#a6a69a' : '#6c6e66';
  return platPix(u, v, tx, ty);
}
registerFloor('underground_edgeS', { pixel(u, v, tx, ty) { return edgePix(1 - v, u, v, tx, ty); } }); // lip on the +y side
registerFloor('underground_edgeN', { pixel(u, v, tx, ty) { return edgePix(v, u, v, tx, ty); } });     // lip on the -y side
// track: two rows; d = 0 at the lane centre (live 4th rail), 1 at the platform wall
function trackPix(d, u, tx, ty, crossing) {
  if (d > 0.9) return d > 0.96 ? '#0e0f0f' : '#1c1d1c';           // platform wall shadow
  const rail = Math.abs(d - 0.55);
  if (crossing) {
    if (rail < 0.035) return '#c0c4cc';
    if ((u * 4) % 1 < 0.1) return '#2a1e14';
    const n = n2(u * 32 + tx * 32, d * 32 + ty * 7, 37);
    return n < 0.3 ? '#5e4428' : n < 0.6 ? '#6a4c2e' : '#725434';
  }
  if (rail < 0.035) return '#c4c8d0';
  if (rail < 0.075) return '#4a4e56';
  if (d < 0.1) return d < 0.04 ? '#c0b080' : '#706452';            // conductor rail (live!)
  if (d < 0.17 && ((u * 2 + 0.25) % 1) < 0.14) return '#e0dccc';     // insulator pots
  const sl = (u * 2) % 1;
  if (sl < 0.3 && d < 0.8) return sl < 0.05 ? '#3a3028' : '#58483a'; // sleepers
  const n = n2(u * 32 + tx * 32, d * 24 + ty * 13, 36);
  return n < 0.3 ? '#2a2622' : n < 0.6 ? '#33302a' : n < 0.9 ? '#24211e' : '#4a4238';
}
registerFloor('underground_trackA', { pixel(u, v, tx, ty) { return trackPix(1 - v, u, tx, ty, false); } }); // upper row (lane at v=1)
registerFloor('underground_trackB', { pixel(u, v, tx, ty) { return trackPix(v, u, tx, ty, false); } });     // lower row (lane at v=0)
registerFloor('underground_crossA', { pixel(u, v, tx, ty) { return trackPix(1 - v, u, tx, ty, true); } });
registerFloor('underground_crossB', { pixel(u, v, tx, ty) { return trackPix(v, u, tx, ty, true); } });
registerFloor('underground_deadTrackA', { // ghost station: rusty, no live rail, rubbish
  pixel(u, v, tx, ty) {
    const d = 1 - v;
    const c = trackPix(d, u, tx, ty, false);
    if (d < 0.17 && d >= 0.04) return '#2a2622';
    if (c === '#c4c8d0') return '#7a5a40';
    return n2(u * 16 + tx * 16, v * 16 + ty * 16, 38) < 0.08 ? '#4a4a40' : c;
  },
});
registerFloor('underground_deadTrackB', {
  pixel(u, v, tx, ty) {
    const c = trackPix(v, u, tx, ty, false);
    if (v < 0.17 && v >= 0.04) return '#2a2622';
    if (c === '#c4c8d0') return '#7a5a40';
    return n2(u * 16 + tx * 16, v * 16 + ty * 16, 38) < 0.08 ? '#4a4a40' : c;
  },
});
registerFloor('underground_stairs', { // steps descending along +y, brass nosing
  pixel(u, v, tx, ty) {
    const s = (v * 3) % 1;
    if (u < 0.04 || u > 0.96) return '#30342f';
    if (s < 0.1) return (n2(u * 16, ty * 3 + Math.floor(v * 3), 39) < 0.15) ? '#8a7a40' : '#b8a650';
    if (s < 0.26) return '#272a28';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 40);
    return n < 0.08 ? '#4a504c' : n > 0.95 ? '#6e746e' : '#5c625e';
  },
});
registerFloor('underground_stairsUp', {
  pixel(u, v, tx, ty) {
    const s = (v * 3) % 1;
    if (u < 0.04 || u > 0.96) return '#2a2e2a';
    if (s > 0.9) return '#e0c040';
    if (s > 0.74) return '#7a7e78';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 41);
    return n < 0.08 ? '#4e544e' : '#5a605a';
  },
});
registerFloor('underground_ballast', {
  pixel(u, v, tx, ty, r) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 42);
    if (r < 0.07 && Math.hypot(u - 0.4, (v - 0.6) * 1.4) < 0.18 + n * 0.1) return n < 0.5 ? '#16140f' : '#1e1b16'; // oil
    return n < 0.22 ? '#2c2925' : n < 0.5 ? '#3a3631' : n < 0.8 ? '#33302b' : '#4a453d';
  },
});
registerFloor('underground_depot', {
  pixel(u, v, tx, ty, r) {
    if (u < 0.025 || v < 0.025) return '#363836';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 43);
    if (r > 0.93) { // irregular oil stain
      const d = Math.hypot(u - 0.5 - (r - 0.95) * 4, (v - 0.5) * 1.3);
      if (d < 0.22 + n2(u * 8 + tx * 8, v * 8 + ty * 8, 48) * 0.16) return d < 0.12 ? '#202220' : '#2a2c2a';
    }
    return n < 0.06 ? '#3e403e' : n > 0.97 ? '#62645e' : (r < 0.5 ? '#4c4e4a' : '#50524e');
  },
});
registerFloor('underground_hatch', {
  pixel(u, v) { return ((u + v) * 3) % 1 < 0.5 ? '#d8b020' : '#1a1a1a'; },
});
registerFloor('underground_lino', {
  pixel(u, v, tx, ty) {
    const a = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 44);
    const base = a ? '#6a7a68' : '#8a9480';
    return n < 0.05 ? shade(base, -0.2) : base;
  },
});
registerFloor('underground_dusty', { // the ghost station: grimy old tiles under dust
  pixel(u, v, tx, ty) {
    const gu = (u * 3) % 1, gv = (v * 3) % 1;
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 45);
    if ((gu < 0.08 || gv < 0.08) && n > 0.3) return '#3a342c';
    const s = n2(tx * 3 + Math.floor(u * 3), ty * 3 + Math.floor(v * 3), 46);
    const base = s < 0.5 ? '#6a5e4a' : '#5e5444';
    return n < 0.25 ? '#7a7060' : n > 0.93 ? '#3a3228' : base;
  },
});
registerFloor('underground_dustEdge', {
  pixel(u, v, tx, ty) {
    const w = 1 - v;
    if (w < 0.05) return '#151412';
    if (w < 0.2) return '#8a8270';
    if (w < 0.28) return '#8a7a3a';
    return n2(u * 32 + tx * 32, v * 32 + ty * 32, 47) < 0.3 ? '#7a7060' : '#5e5444';
  },
});
// 2x2 mosaic of the Anchors' anchor, set into the ticket hall floor (place on an even x,y block)
registerFloor('underground_anchor', {
  pixel(u, v, tx, ty) {
    const U = ((tx & 1) + u) / 2, V = ((ty & 1) + v) / 2;
    const px = (U - V) * 32, py = (U + V - 1) * 16;
    const e = (px / 27) ** 2 + (py / 13.5) ** 2;
    if (e > 1) {
      if (u < 0.03 || v < 0.03) return '#3c4440';
      return n2(u * 32 + tx * 32, v * 32 + ty * 32, 31) < 0.05 ? '#8c9286' : '#5a625c';
    }
    if (e > 0.86) return '#c8102e';
    if (e > 0.8) return '#f4f1e8';
    const red = '#a80c26';
    if (Math.abs(px) < 1.6 && py > -8 && py < 8) return red;                  // shank
    if (Math.abs(py + 5) < 1.2 && Math.abs(px) < 6.5) return red;             // stock
    const rr = Math.hypot(px, (py + 10) * 1.6);
    if (rr > 2 && rr < 4.2) return red;                                       // ring
    const ar = Math.hypot(px, (py - 1) * 1.8);
    if (ar > 13 && ar < 16.5 && py > 2) return red;                           // arms
    if (py > 3 && py < 6.5 && Math.abs(Math.abs(px) - 11) < 2.5 && py < 3 + (Math.abs(px) - 8.5)) return red; // flukes
    return ((Math.floor(px) + Math.floor(py)) & 3) === 0 ? '#e0dccc' : '#f4f1e8';
  },
});

// ================================================================== WALLS
function tileFace(base, band, bandDark, opts = {}) {
  return (u, py, side, H, r, variant) => {
    const fromB = H - 1 - py;
    const x = Math.floor(u * 16);
    let c;
    if (py < 2) c = '#c8c8b6';
    else if (fromB < 4) c = fromB === 3 ? '#4a4e4a' : '#262a28';
    else if (band && fromB >= 26 && fromB < 32) c = (fromB === 26 || fromB === 31) ? bandDark : (opts.stripe && fromB === 28 ? opts.stripe : band);
    else {
      const gx = x % 4 === 0, gy = py % 4 === 0;
      if (gx || gy) c = '#94968a';
      else {
        const h = hash2(Math.floor(x / 4) + variant * 13, Math.floor(py / 4), 41);
        c = h < 0.07 ? shade(base, -0.08) : h > 0.93 ? shade(base, 0.08) : base;
        if (h > 0.985) c = '#4a4c44';                     // missing tile
        if ((x % 4 === 1 || py % 4 === 1) && h > 0.3) c = shade(c, 0.1); // glaze bevel
      }
      const grime = fromB < 16 ? (16 - fromB) / 16 : 0;
      if (grime && hash2(x, py, variant + 50) < grime * 0.7) c = shade(c, -0.18);
      if (opts.soot && hash2(x, Math.floor(py / 2), variant + 70) < 0.12) c = shade(c, -0.25);
    }
    return side === 'right' ? shade(c, -0.3) : c;
  };
}
registerWall('underground_tiles', { top: '#2e322e', variants: 6, face: tileFace('#dcd8c4', '#2f6a4a', '#1c4430', { stripe: '#c8102e' }) });
registerWall('underground_tilesPlain', { top: '#2e322e', variants: 4, face: tileFace('#d6d2be', null, null) });
registerWall('underground_tilesBlue', { top: '#2e322e', variants: 4, face: tileFace('#c8d0d4', '#1f4fb4', '#14306a') });
registerWall('underground_tilesGrim', { top: '#262824', variants: 6, face: tileFace('#a8a28a', '#3a4a3a', '#222c22', { soot: true }) });

registerWall('underground_gateline', {
  top: (u, v) => (Math.abs(v - 0.5) < 0.14 ? '#1a1c20' : (u < 0.08 || u > 0.92) ? '#6a7078' : '#a2aab2'),
  face(u, py, side, H) {
    const x = Math.floor(u * 16);
    let c = '#5c626a';
    if (py < 2) c = '#a8b0b8';
    else if (x === 0 || x === 15) c = '#33363c';
    else if (py >= 4 && py <= 5 && x >= 6 && x <= 9) c = side === 'left' ? '#3aff6a' : '#ff3a3a';
    else if (py >= 8 && py <= 12 && x >= 4 && x <= 11) c = (py === 10 && x > 5 && x < 10) ? '#1a1a1a' : '#d8c020';
    else if (py > H - 3) c = '#26282c';
    else if (x === 2 || x === 13) c = '#4a5058';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
registerWall('underground_counter', {
  top: (u, v) => (v < 0.15 || v > 0.85 ? '#6a5a40' : '#b8a888'),
  face(u, py, side, H) {
    const x = Math.floor(u * 16);
    let c = '#5a3a22';
    if (py < 2) c = '#c8b898';
    else if (x % 8 === 0 || py === 3 || py === H - 3) c = '#3a2412';
    else if (py > H - 3) c = '#1e1a16';
    else if (x % 8 === 1) c = '#6e4a2c';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
function brickFace(base, mortar, sootTop) {
  return (u, py, side, H, r, variant) => {
    const bx = u * 16, row = Math.floor(py / 4);
    const off = row % 2 ? 4 : 0;
    let c;
    if (py % 4 === 3 || (Math.floor(bx + off)) % 8 === 0) c = mortar;
    else {
      const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, 3);
      c = s < 0.3 ? shade(base, -0.1) : s > 0.85 ? shade(base, 0.1) : base;
    }
    if (sootTop) { const k = Math.max(0, 1 - py / (H * 0.6)); if (hash2(Math.floor(bx), py, variant + 90) < k * 0.8) c = shade(c, -0.35); }
    if (hash2(Math.floor(bx), py, variant + 91) < 0.02) c = '#6a7a5a'; // damp moss
    return side === 'right' ? shade(c, -0.32) : c;
  };
}
registerWall('underground_brickSoot', { top: '#201a18', face: brickFace('#5a3a30', '#22181a', true) });
registerWall('underground_brickBlocked', { top: '#2a201c', face: brickFace('#7a5a48', '#3a2a24', false) }); // newer bricks filling an arch
registerWall('underground_tunnel', {
  top: '#1e201e',
  face(u, py, side, H, r, variant) {
    const fromB = H - 1 - py;
    const x = Math.floor(u * 16);
    let c;
    const n = hash2(x + variant * 5, py, 51);
    c = n < 0.05 ? '#3a3c38' : n > 0.96 ? '#5a5c56' : '#4a4c48';
    if (py % 20 === 0) c = '#363834';
    if (hash2(x, variant, 52) < 0.15 && hash2(x, py >> 3, 53) < 0.8) c = shade(c, -0.12); // water streak
    if (fromB >= 30 && fromB <= 36) {                                                      // cable run
      if (fromB === 30 || fromB === 36) c = '#2a2c2a';
      else if (fromB === 32) c = '#c8541a';
      else if (fromB === 34) c = '#1a1a1c';
      else if (fromB === 33) c = '#3a3a3e';
      if (x % 8 === 3 && fromB < 36) c = '#6a6e74';                                       // brackets
    }
    if (fromB < 4) c = '#242622';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
registerWall('underground_hazard', {
  top: '#1e201e',
  face(u, py, side, H, r, variant) {
    const fromB = H - 1 - py;
    const x = Math.floor(u * 16);
    let c;
    if (fromB < 10) c = fromB < 1 ? '#1a1a1a' : (((x + fromB) >> 2) % 2 ? '#d8b020' : '#1a1a1a');
    else {
      const n = hash2(x + variant * 5, py, 54);
      c = n < 0.05 ? '#3c3e3a' : n > 0.96 ? '#5c5e58' : '#4c4e4a';
      if (py % 20 === 0) c = '#383a36';
    }
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
registerWall('underground_duct', {
  top: (u, v) => ((u * 4) % 1 < 0.08 ? '#6a727a' : '#a0a8b0'),
  face(u, py, side, H) {
    const x = Math.floor(u * 16);
    let c = '#8a929a';
    if (py < 2 || py > H - 3) c = '#5a6068';
    else if (x % 8 === 0) c = '#6a727a';
    else if ((x % 8 === 1 || x % 8 === 7) && py % 6 === 3) c = '#d0d8e0'; // rivets
    else if (side === 'left' && x >= 3 && x <= 12 && py >= 6 && py <= H - 6) c = py % 3 === 0 ? '#c0c8d0' : '#1a1c20'; // grille
    return side === 'right' ? shade(c, -0.28) : c;
  },
});
registerWall('underground_lockers', {
  top: '#3a4440',
  face(u, py, side, H) {
    const x = Math.floor(u * 16);
    let c = '#5a7064';
    if (x % 5 === 0 || py < 2) c = '#2e3a34';
    else if (py > H - 4) c = '#1e2420';
    else if (py >= 5 && py <= 10 && x % 5 >= 2 && x % 5 <= 3 && py % 2 === 0) c = '#1e2420'; // vents
    else if (x % 5 === 4 && py === Math.floor(H / 2)) c = '#c0c8c0';                         // handle
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
registerWall('underground_ticketWindow', {
  top: '#2e322e', variants: 2,
  face(u, py, side, H, r, variant) {
    const fromB = H - 1 - py;
    const x = Math.floor(u * 16);
    if (side === 'left' && fromB >= 22 && fromB <= 50 && x >= 1 && x <= 14) {
      if (fromB === 22 || fromB === 50 || x === 1 || x === 14) return '#2a2a2a';
      if (fromB < 26) return '#6a4a2a';
      if (x === 8) return '#3a3a3a';
      const refl = ((x + fromB * 0.6) % 9) < 1.5;
      return refl ? '#c8f0e0' : fromB > 40 ? '#f0e8b0' : '#b8c8a0';
    }
    return tileFace('#dcd8c4', '#2f6a4a', '#1c4430', { stripe: '#c8102e' })(u, py, side, H, r, variant);
  },
});

// ================================================================== PROPS
// light colours
export const UG_TUBE = '#c8ffe6';

registerProp('underground_ticketMachine', {
  h: 1.6,
  light: { z: 1.2, r: 1.8, color: '#7affd0', intensity: 0.5 },
  breakable: { hp: 30, debris: ['#a8202a', '#3a3a40', '#7affd0'], sfx: 'metal', drops: [['cash5', 0.9], ['coin', 0.9], ['cash5', 0.5], ['coin', 0.6]], score: 120 },
  draw(ctx, ax, ay, p, t) {
    const c = p.o.color || '#a8202a';
    isoBox(ctx, ax, ay, 0.15, 0.2, 0, 0.7, 0.6, 1.62, { top: '#5a5e66', left: c, right: shade(c, -0.35), outline: OL });
    isoBox(ctx, ax, ay, 0.12, 0.17, 1.62, 0.76, 0.66, 0.06, { color: '#3a3e44', outline: OL });
    const P = (x, z) => proj(ax, ay, x, 0.8, z);
    // screen
    const s0 = P(0.24, 1.42);
    const lit = (Math.floor(t * 2) % 6) !== 0;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) R(ctx, (i === 0 || i === 8 || j === 0 || j === 6) ? '#1a1a1a' : (lit ? (j < 3 ? '#7affd0' : '#4ad0a0') : '#205040'), s0.x + i, s0.y + j + Math.floor(i * 0.5));
    if (lit) tinyText(ctx, '£', s0.x + 3, s0.y + 1, '#103020', 0.5);
    // keypad + slot
    const k = P(0.26, 0.98);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R(ctx, '#d8d8d0', k.x + i * 2, k.y + j * 2 + i);
    const sl = P(0.58, 1.0); R(ctx, '#111', sl.x, sl.y, 3, 1); R(ctx, '#111', sl.x, sl.y + 4, 4, 1);
    const tr = P(0.3, 0.45); R(ctx, '#111', tr.x, tr.y, 6, 2); R(ctx, '#111', tr.x + 2, tr.y + 2, 6, 1);
    const tt = P(0.2, 1.62); tinyText(ctx, 'TICKETS', tt.x + 1, tt.y - 5, '#f4f1e8', 0.5);
  },
});

registerProp('underground_gatePaddle', { // open barrier paddles in a gateline gap (decor)
  h: 0, solid: false,
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    for (const x of [0.08, 0.92]) {
      const sw = Math.sin(t * 0.7 + p.x) * 0.05;
      fillPoly(ctx, [P(x, 0.3, 0.85), P(x, 0.62 + sw, 0.85), P(x, 0.62 + sw, 0.45), P(x, 0.3, 0.45)], '#8a1a24');
      line(ctx, P(x, 0.3, 0.85).x, P(x, 0.3, 0.85).y, P(x, 0.62 + sw, 0.85).x, P(x, 0.62 + sw, 0.85).y, '#e85a64');
    }
    if (p.o.wide) { const q = P(0.5, 0.5, 0); tinyText(ctx, 'STAFF', q.x, q.y - 2, '#e8c020', 0, 'center'); }
  },
});

registerProp('underground_escalator', { // flat, animated; w 2 (two lanes), d = run length along y
  w: 2, d: 4, h: 0, solid: false, depthBias: -6,
  draw(ctx, ax, ay, p, t) {
    const D = p.d;
    const P = (x, y, z = 0) => proj(ax, ay, x, y, z);
    fillPoly(ctx, [P(0, 0), P(2, 0), P(2, D), P(0, D)], '#1c1e20');
    for (let lane = 0; lane < 2; lane++) {
      const x0 = lane + 0.12, x1 = lane + 0.88;
      fillPoly(ctx, [P(x0, 0), P(x1, 0), P(x1, D), P(x0, D)], '#3a3e44');
      const dir = lane === 0 ? 1 : -1;
      for (let k = 0; k < D * 5; k++) {
        let y = (k / 5 + dir * t * 0.6) % D; if (y < 0) y += D;
        const a = P(x0, y), b = P(x1, y);
        line(ctx, a.x, a.y, b.x, b.y, '#7a8088');
        const a2 = P(x0, y + 0.06), b2 = P(x1, y + 0.06);
        line(ctx, a2.x, a2.y, b2.x, b2.y, '#24272a');
      }
      for (const yy of [0.05, D - 0.1]) { const a = P(x0, yy), b = P(x1, yy); thick(ctx, a.x, a.y, b.x, b.y, 2, '#b8a650'); }
    }
    // handrails
    for (const x of [0.04, 1.0, 1.96]) {
      const a = P(x, 0, 0.75), b = P(x, D, 0.75);
      const a0 = P(x, 0, 0.1), b0 = P(x, D, 0.1);
      ctx.globalAlpha = 0.25; fillPoly(ctx, [a, b, b0, a0], '#9ad0c8'); ctx.globalAlpha = 1;
      thick(ctx, a.x, a.y, b.x, b.y, 2, '#111');
    }
  },
});

registerProp('underground_metroSign', {
  h: 2.6, light: { z: 2.6, r: 3.5, color: '#9ab8ff', intensity: 0.85 },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 2.2);
    thick(ctx, b.x, b.y, top.x, top.y, 4, OL); thick(ctx, b.x, b.y, top.x, top.y, 2, '#3c4048');
    R(ctx, OL, b.x - 3, b.y - 4, 6, 5);
    const w = 30, h = 13, x = top.x - w / 2, y = top.y - h - 2;
    R(ctx, OL, x - 1, y - 1, w + 2, h + 2);
    R(ctx, '#1f3fa0', x, y, w, h);
    R(ctx, '#f4f1e8', x, y, w, 1); R(ctx, '#f4f1e8', x, y + h - 1, w, 1);
    R(ctx, '#c8102e', x + 2, y + 2, 9, 9);
    tinyText(ctx, 'M', x + 5, y + 4, '#ffffff');
    tinyText(ctx, 'METRO', x + 13, y + 3, '#ffffff');
    const bob = Math.floor(t * 3) % 2;
    R(ctx, '#ffd23a', x + 20, y + 7 + bob, 3, 1); R(ctx, '#ffd23a', x + 21, y + 8 + bob, 1, 3); R(ctx, '#ffd23a', x + 20, y + 10 + bob, 3, 1);
  },
});

registerProp('underground_kiosk', {
  w: 2, d: 2, h: 2.2,
  draw(ctx, ax, ay, p) {
    const c = '#2a5a3a';
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 1.8, 1.8, 2.0, { top: '#1e3a28', left: c, right: shade(c, -0.35), outline: OL });
    // roof with overhang
    isoBox(ctx, ax, ay, 0.0, 0.0, 2.0, 2.0, 2.0, 0.18, { color: '#1a2a20', outline: OL });
    // striped awning on +y face
    for (let i = 0; i < 6; i++) isoPanel(ctx, ax, ay, 'left', 0.1 + i * 0.3, 1.95, 0.3, 1.55, 1.85, i % 2 ? '#f4f1e8' : '#c8102e');
    // window with magazines
    isoPanel(ctx, ax, ay, 'left', 0.25, 1.9, 1.5, 0.75, 1.45, '#1a1a14');
    const cols = ['#e8c020', '#c8102e', '#3ab8ff', '#f4f1e8', '#e85aa0', '#5ad070'];
    for (let i = 0; i < 6; i++) isoPanel(ctx, ax, ay, 'left', 0.32 + i * 0.24, 1.9, 0.18, 0.95, 1.35, cols[(i + p.x) % 6]);
    isoPanel(ctx, ax, ay, 'left', 0.2, 1.92, 1.6, 0.68, 0.76, '#7a5a30'); // counter
    const s = proj(ax, ay, 0.2, 1.9, 2.05);
    tinyText(ctx, 'PAPERS & SWEETS', s.x + 2, s.y - 5, '#ffd23a', 0.5);
    // headline board
    isoPanel(ctx, ax, ay, 'right', 1.9, 0.3, 0.9, 0.3, 1.0, '#f4f1e8');
    const hb = proj(ax, ay, 1.9, 0.35, 0.95);
    tinyText(ctx, 'DERBY', hb.x + 1, hb.y + 1, '#c8102e', -0.5);
    tinyText(ctx, 'FEVER', hb.x + 1, hb.y + 7, '#1a1a1a', -0.5);
  },
});

// Wall poster decal. opts: side 'left'|'right', z (bottom), len (tiles, default 2), design (string id)
const POSTERS = {
  season: { bg: '#c8102e', draw(ctx, tl, k) { faceRect(ctx, tl, k, 3, 3, 26, 1, '#f4f1e8'); tinyText(ctx, 'ANCHORS', tl.x + 3, tl.y + 6 + Math.floor(3 * k), '#f4f1e8', k); tinyText(ctx, 'SEASON', tl.x + 3, tl.y + 12 + Math.floor(3 * k), '#ffd8d8', k); tinyText(ctx, 'TICKETS', tl.x + 3, tl.y + 18 + Math.floor(3 * k), '#ffffff', k); } },
  vargby: { bg: '#f0c020', draw(ctx, tl, k) { faceRect(ctx, tl, k, 0, 0, 32, 4, '#141414'); tinyText(ctx, 'VISIT', tl.x + 4, tl.y + 7 + Math.floor(4 * k), '#141414', k); tinyText(ctx, 'VARGBY', tl.x + 4, tl.y + 13 + Math.floor(4 * k), '#141414', k); tinyText(ctx, 'WHY?', tl.x + 14, tl.y + 19 + Math.floor(14 * k), '#c8102e', k); } },
  brew: { bg: '#1a2a5a', draw(ctx, tl, k) { faceRect(ctx, tl, k, 4, 6, 6, 12, '#e8a030'); faceRect(ctx, tl, k, 4, 4, 6, 3, '#f4f1e8'); tinyText(ctx, 'NORD', tl.x + 13, tl.y + 6 + Math.floor(13 * k), '#ffd23a', k); tinyText(ctx, 'LAGER', tl.x + 12, tl.y + 13 + Math.floor(12 * k), '#ffffff', k); } },
  missing: { bg: '#e8e4d0', draw(ctx, tl, k) { tinyText(ctx, 'MISSING', tl.x + 3, tl.y + 2 + Math.floor(3 * k), '#141414', k); tinyText(ctx, 'OUR', tl.x + 3, tl.y + 9 + Math.floor(3 * k), '#c8102e', k); tinyText(ctx, 'LEAGUE', tl.x + 3, tl.y + 14 + Math.floor(3 * k), '#c8102e', k); tinyText(ctx, 'TITLE', tl.x + 3, tl.y + 19 + Math.floor(3 * k), '#c8102e', k); } },
  safety: { bg: '#f4f1e8', draw(ctx, tl, k) { faceRect(ctx, tl, k, 0, 0, 32, 3, '#e8c020'); tinyText(ctx, 'STAND', tl.x + 3, tl.y + 6 + Math.floor(3 * k), '#141414', k); tinyText(ctx, 'BEHIND', tl.x + 3, tl.y + 12 + Math.floor(3 * k), '#141414', k); tinyText(ctx, 'THE LINE', tl.x + 1, tl.y + 18 + Math.floor(1 * k), '#a08010', k); } },
  gig: { bg: '#141414', draw(ctx, tl, k) { tinyText(ctx, 'LIVE!', tl.x + 3, tl.y + 3 + Math.floor(3 * k), '#e85aa0', k); tinyText(ctx, 'TERRACE', tl.x + 3, tl.y + 10 + Math.floor(3 * k), '#ffffff', k); tinyText(ctx, 'RATS', tl.x + 3, tl.y + 16 + Math.floor(3 * k), '#7affd0', k); } },
  derby71: { bg: '#b8a878', draw(ctx, tl, k) { tinyText(ctx, 'NHA V', tl.x + 3, tl.y + 3 + Math.floor(3 * k), '#6a1a1a', k); tinyText(ctx, 'PSC', tl.x + 3, tl.y + 9 + Math.floor(3 * k), '#1a2a6a', k); tinyText(ctx, '1971', tl.x + 3, tl.y + 16 + Math.floor(3 * k), '#3a2a1a', k); } },
  wanted: { bg: '#e0d8b8', draw(ctx, tl, k) { tinyText(ctx, 'WANTED', tl.x + 3, tl.y + 2 + Math.floor(3 * k), '#6a1a1a', k); faceRect(ctx, tl, k, 10, 9, 10, 8, '#d49a6a'); faceRect(ctx, tl, k, 10, 9, 10, 3, '#f0a020'); faceRect(ctx, tl, k, 10, 15, 10, 2, '#5a3a20'); tinyText(ctx, 'GUNNAR', tl.x + 4, tl.y + 19 + Math.floor(4 * k), '#3a2a1a', k); } },
  noFines: { bg: '#1f3fa0', draw(ctx, tl, k) { tinyText(ctx, 'FARE', tl.x + 3, tl.y + 3 + Math.floor(3 * k), '#ffd23a', k); tinyText(ctx, 'DODGERS', tl.x + 3, tl.y + 9 + Math.floor(3 * k), '#ffffff', k); tinyText(ctx, 'FINED £50', tl.x + 0, tl.y + 16, '#ff8080', k); } },
};
registerProp('underground_poster', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p) {
    const side = p.o.side || 'left';
    const len = p.o.len ?? 2, z0 = p.o.z ?? 0.9, z1 = z0 + (p.o.height ?? 1.25);
    const d = POSTERS[p.o.design] || POSTERS.season;
    const k = side === 'left' ? 0.5 : -0.5;
    let tl;
    if (side === 'left') { isoPanel(ctx, ax, ay, 'left', 0.05, 1.02, len - 0.1, z0 - 0.05, z1 + 0.05, '#1a1a1a'); isoPanel(ctx, ax, ay, 'left', 0.1, 1.02, len - 0.2, z0, z1, d.bg); tl = proj(ax, ay, 0.1, 1.02, z1); }
    else { isoPanel(ctx, ax, ay, 'right', 1.02, 0.05, len - 0.1, z0 - 0.05, z1 + 0.05, '#1a1a1a'); isoPanel(ctx, ax, ay, 'right', 1.02, 0.1, len - 0.2, z0, z1, d.bg); tl = proj(ax, ay, 1.02, 0.1, z1); }
    tl = { x: tl.x, y: tl.y };
    d.draw(ctx, tl, k);
    if (p.o.torn) faceRect(ctx, tl, k, 20, 0, 8, 6, shade(d.bg, -0.4));
  },
});

// Hanging dot-matrix departure board (screen-facing). opts.zone = which train hazard id it follows; opts.dest
registerProp('underground_departures', {
  h: 0, solid: false, depthBias: 0.05,
  draw(ctx, ax, ay, p, t, world) {
    const c = proj(ax, ay, 0.5, 0.5, 3.0);
    const W = 50, H = 11, x = Math.round(c.x - W / 2), y = Math.round(c.y - H);
    line(ctx, x + 6, y - 14, x + 6, y, '#3a3a3a'); line(ctx, x + W - 7, y - 14, x + W - 7, y, '#3a3a3a');
    R(ctx, OL, x - 1, y - 1, W + 2, H + 2);
    R(ctx, '#0a0a08', x, y, W, H);
    const ug = world && world.ug;
    const warn = ug && ug.warn && ug.warn[p.o.zone || 'p'] > 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 1, y + 1, W - 2, H - 2); ctx.clip();
    if (warn) {
      if (Math.floor(t * 4) % 2) tinyText(ctx, 'STAND BACK!', x + W / 2, y + 3, '#ff4a2a', 0, 'center');
    } else {
      const hz = world && world.hazards && world.hazards.find(h => h.id === (p.o.zone === 'd' ? 'trainD' : 'trainP'));
      const secs = hz ? Math.max(0, Math.ceil(hz.t)) : 2;
      const msg = `${p.o.dest || 'STADIUM'} ${secs >= 60 ? Math.ceil(secs / 60) + ' MIN' : secs + 'S'}    MIND THE GAP ON THE LIVE RAIL    NO FOOTBALL CHANTING`;
      const wpx = tinyWidth(msg);
      const off = Math.floor((t * 14) % (wpx + W));
      tinyText(ctx, msg, x + W - off, y + 3, '#ffb030');
    }
    ctx.restore();
  },
});

// Hanging fluorescent fitting. opts.zone 'p'|'d' -> flashes amber when that zone's train is approaching; opts.flicker
registerProp('underground_striplight', {
  h: 0, solid: false, depthBias: 0.1,
  light: { z: 3.0, r: 4.2, color: UG_TUBE, intensity: 0.8 },
  draw(ctx, ax, ay, p, t, world) {
    const a = proj(ax, ay, 0.2, 0.5, 3.0), b = proj(ax, ay, 1.0, 0.5, 3.0);
    line(ctx, a.x, a.y - 1, a.x, a.y - 12, '#2a2a2a'); line(ctx, b.x, b.y - 1, b.x, b.y - 12, '#2a2a2a');
    thick(ctx, a.x, a.y, b.x, b.y, 4, OL);
    const ug = world && world.ug;
    const warn = ug && p.o.zone && ug.warn && ug.warn[p.o.zone] > 0 && Math.floor(t * 6) % 2 === 0;
    const off = p.o.flicker && Math.sin(t * 23 + p.x * 3) * Math.sin(t * 7 + p.y) < -0.55;
    thick(ctx, a.x, a.y - 1, b.x, b.y - 1, 2, warn ? '#ffb030' : off ? '#4a5a54' : '#eafff4');
  },
  update(p, world) {
    if (!p.ugLight) p.ugLight = world.lights.find(l => l.prop === p);
    const l = p.ugLight;
    if (!l) return;
    const ug = world.ug;
    const warn = ug && p.o.zone && ug.warn && ug.warn[p.o.zone] > 0;
    l.color = warn && Math.floor(world.time * 6) % 2 === 0 ? '#ff9a30' : (p.o.color || UG_TUBE);
  },
});

registerProp('underground_worklight', { // tripod work lamp; smash it and the light goes out
  h: 0.6,
  light: { z: 1.4, r: 3.6, color: '#ffe0a0', intensity: 0.9, flicker: true },
  breakable: { hp: 8, debris: ['#e8c020', '#3a3a3a', '#ffffff'], sfx: 'glass', drops: [['coin', 0.3]], score: 40 },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 1.4);
    for (const dx of [-6, 0, 6]) line(ctx, b.x + dx, b.y + (dx ? 1 : 3), top.x, top.y + 6, '#2a2a2a');
    thick(ctx, b.x, b.y - 4, top.x, top.y + 4, 2, '#e8c020');
    R(ctx, OL, top.x - 6, top.y - 4, 12, 9);
    R(ctx, '#d8a818', top.x - 5, top.y - 3, 10, 7);
    const on = !(Math.sin(t * 19 + p.x) * Math.sin(t * 5.3 + p.y) > 0.6);
    R(ctx, on ? '#fff8d0' : '#6a6040', top.x - 4, top.y - 2, 8, 5);
    if (on) { R(ctx, '#ffffff', top.x - 3, top.y - 1, 3, 2); }
  },
});

registerProp('underground_cableDrum', { // big wooden cable reel. NOT breakable: a safe climbing step
  h: 0.9,
  draw(ctx, ax, ay, p) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const flange = (x, col) => {
      const pts = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts.push(P(x, 0.5 + Math.cos(a) * 0.46, 0.46 + Math.sin(a) * 0.45)); }
      fillPoly(ctx, pts, OL);
      const pts2 = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts2.push(P(x, 0.5 + Math.cos(a) * 0.4, 0.46 + Math.sin(a) * 0.39)); }
      fillPoly(ctx, pts2, col);
      const hub = P(x, 0.5, 0.46); ellipse(ctx, hub.x, hub.y, 2, 3, '#2a1e14');
    };
    flange(0.12, '#7a5a34');
    isoBox(ctx, ax, ay, 0.16, 0.22, 0.18, 0.68, 0.56, 0.56, { top: '#d8541a', left: '#b8441a', right: '#8a3212' });
    for (let i = 0; i < 5; i++) { const a = P(0.2 + i * 0.13, 0.78, 0.2), b = P(0.2 + i * 0.13, 0.78, 0.72); line(ctx, a.x, a.y, b.x, b.y, '#6a2a0a'); }
    flange(0.86, '#8a6a3e');
    const s = P(0.86, 0.6, 0.6); tinyText(ctx, 'NM', s.x - 2, s.y, '#e8d8a8', -0.5);
  },
});

registerProp('underground_hoarding', { // plywood boarding over an alcove; break it (opts.secret)
  h: 2.2,
  breakable: { hp: 22, debris: ['#b08a58', '#8a6a40', '#d0b080'], sfx: 'wood', drops: [['coin', 0.5]], score: 80 },
  draw(ctx, ax, ay, p) {
    const c = '#b08a58';
    isoBox(ctx, ax, ay, 0, 0.3, 0, 1, 0.3, 2.2, { top: '#8a6a40', left: c, right: shade(c, -0.35), outline: OL });
    const P = (x, z) => proj(ax, ay, x, 0.6, z);
    for (const x of [0.33, 0.66]) { const a = P(x, 0.05), b = P(x, 2.15); line(ctx, a.x, a.y, b.x, b.y, '#7a5a34'); }
    for (const z of [0.4, 1.7]) { const a = P(0.02, z), b = P(0.98, z); line(ctx, a.x, a.y, b.x, b.y, '#8a6a40'); }
    const s = P(0.1, 1.3);
    if (p.o.text !== false) tinyText(ctx, p.o.text || 'KEEP', s.x, s.y, '#c8102e', 0.5);
    if (p.o.text2) { const s2 = P(0.1, 1.0); tinyText(ctx, p.o.text2, s2.x, s2.y, '#1a1a1a', 0.5); }
    // nail heads
    for (const [x, z] of [[0.05, 0.4], [0.95, 0.4], [0.05, 1.7], [0.95, 1.7]]) { const n = P(x, z); R(ctx, '#3a3a3a', n.x, n.y, 1, 1); }
  },
});

// Vent grille decal on a wall face; rats pop out of it (prop.popT set by the rat's onSpawn)
registerProp('underground_vent', {
  h: 0, solid: false, depthBias: 0.04,
  draw(ctx, ax, ay, p, t, world) {
    const side = p.o.side || 'left';
    const z0 = p.o.z ?? 0.15, z1 = z0 + 0.5;
    const open = (p.popT || 0) > 0;
    if (side === 'left') {
      isoPanel(ctx, ax, ay, 'left', 0.2, 1.02, 0.6, z0, z1, '#2a2c30');
      isoPanel(ctx, ax, ay, 'left', 0.25, 1.02, 0.5, z0 + 0.05, z1 - 0.05, open ? '#050506' : '#14161a');
    } else {
      isoPanel(ctx, ax, ay, 'right', 1.02, 0.2, 0.6, z0, z1, '#202226');
      isoPanel(ctx, ax, ay, 'right', 1.02, 0.25, 0.5, z0 + 0.05, z1 - 0.05, open ? '#050506' : '#101216');
    }
    if (!open) {
      for (let i = 0; i < 4; i++) {
        const z = z0 + 0.1 + i * 0.1;
        const a = side === 'left' ? proj(ax, ay, 0.27, 1.02, z) : proj(ax, ay, 1.02, 0.27, z);
        const b = side === 'left' ? proj(ax, ay, 0.73, 1.02, z) : proj(ax, ay, 1.02, 0.73, z);
        line(ctx, a.x, a.y, b.x, b.y, '#7a828a');
      }
    } else {
      // grille hanging off one screw + glowing eyes
      const a = side === 'left' ? proj(ax, ay, 0.25, 1.1, z0) : proj(ax, ay, 1.1, 0.25, z0);
      thick(ctx, a.x, a.y, a.x + (side === 'left' ? -3 : 3), a.y + 8, 3, '#6a727a');
      const e = side === 'left' ? proj(ax, ay, 0.5, 1.02, z0 + 0.25) : proj(ax, ay, 1.02, 0.5, z0 + 0.25);
      if (Math.floor(t * 3) % 3) { R(ctx, '#ff3a3a', e.x - 3, e.y, 1, 1); R(ctx, '#ff3a3a', e.x + 2, e.y + (side === 'left' ? 2 : -2), 1, 1); }
    }
  },
  update(p, world, dt) { if (p.popT > 0) p.popT -= dt; },
});

registerProp('underground_vending', {
  h: 1.8,
  light: { z: 1.2, r: 2.2, color: '#8ab0ff', intensity: 0.55 },
  breakable: { hp: 26, debris: ['#2a4a8a', '#c0c8d0', '#e8c020'], sfx: 'glass', drops: [['energy', 0.95], ['energy', 0.5], ['coin', 0.8], ['coin', 0.5]], score: 120 },
  draw(ctx, ax, ay, p, t) {
    const c = '#1f3f8a';
    isoBox(ctx, ax, ay, 0.12, 0.2, 0, 0.76, 0.6, 1.8, { top: '#3a4a6a', left: c, right: shade(c, -0.4), outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.18, 0.81, 0.5, 0.55, 1.65, '#c8e0ff');
    const cols = ['#e83a3a', '#e8c020', '#3ad070', '#f4f1e8', '#3ab8ff'];
    for (let r2 = 0; r2 < 4; r2++) for (let i = 0; i < 4; i++) {
      const s = proj(ax, ay, 0.22 + i * 0.12, 0.81, 0.65 + r2 * 0.25);
      R(ctx, cols[(i + r2 * 2 + p.x) % 5], s.x, s.y - 3, 2, 3);
    }
    const s = proj(ax, ay, 0.72, 0.81, 1.2); R(ctx, '#111', s.x, s.y, 2, 6);
    const tr = proj(ax, ay, 0.2, 0.81, 0.3); R(ctx, '#0a0a0a', tr.x, tr.y - 3, 8, 3);
    const lg = proj(ax, ay, 0.15, 0.81, 1.78); tinyText(ctx, 'FIZZ', lg.x + 2, lg.y, '#ffffff', 0.5);
  },
});

// Signal post: green normally, flashing red when its zone's train is approaching
registerProp('underground_signal', {
  h: 2.4,
  draw(ctx, ax, ay, p, t, world) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 2.3);
    thick(ctx, b.x, b.y, top.x, top.y, 3, OL); thick(ctx, b.x, b.y, top.x, top.y, 1, '#5a5e66');
    R(ctx, OL, top.x - 4, top.y - 2, 9, 19); R(ctx, '#1a1a1a', top.x - 3, top.y - 1, 7, 17);
    const ug = world && world.ug;
    const warn = ug && ug.warn && ug.warn[p.o.zone || 'p'] > 0;
    const blink = Math.floor(t * 5) % 2 === 0;
    ellipse(ctx, top.x + 0.5, top.y + 3, 2, 2, warn && blink ? '#ff3a2a' : '#3a0a0a');
    ellipse(ctx, top.x + 0.5, top.y + 8, 2, 2, warn && !blink ? '#ffb030' : '#3a2a0a');
    ellipse(ctx, top.x + 0.5, top.y + 13, 2, 2, warn ? '#0a2a0a' : '#3aff6a');
  },
});

// Depot signal lever: USE to clear the signal and send a train through (opts.onOpen set by the level)
registerProp('underground_lever', {
  h: 0, solid: false, interact: { kind: 'switch', key: null },
  draw(ctx, ax, ay, p, t, world) {
    isoBox(ctx, ax, ay, 0.25, 0.3, 0, 0.5, 0.4, 0.55, { color: '#5a1a1a', outline: OL });
    isoBox(ctx, ax, ay, 0.22, 0.27, 0.55, 0.56, 0.46, 0.08, { color: '#3a3a40', outline: OL });
    const pv = proj(ax, ay, 0.5, 0.5, 0.62);
    const ang = p.open ? 0.9 : -0.5;
    const ex = pv.x + Math.sin(ang) * 18, ey = pv.y - Math.cos(ang) * 18;
    thick(ctx, pv.x, pv.y, ex, ey, 3, OL); thick(ctx, pv.x, pv.y, ex, ey, 1, '#c8c8c8');
    R(ctx, OL, ex - 3, ey - 3, 6, 5); R(ctx, p.open ? '#3aff6a' : '#e83a2a', ex - 2, ey - 2, 4, 3);
    const lab = proj(ax, ay, 0.25, 0.7, 0.45); tinyText(ctx, 'SIG', lab.x + 1, lab.y - 2, '#f4f1e8', 0.5);
    const pl = world && world.player;
    if (!p.open && pl && Math.hypot(pl.x - p.cx, pl.y - p.cy) < 1.4) drawText(ctx, 'E', pv.x, pv.y - 34 + Math.round(Math.sin(t * 6)), { color: '#ffe14a', align: 'center', outline: '#000' });
    if (p.open && p.cool > 0) { const s = proj(ax, ay, 0.5, 0.5, 1.6); tinyText(ctx, String(Math.ceil(p.cool)), s.x, s.y, '#ffb030', 0, 'center'); }
  },
  update(p, world, dt) {
    if (p.open) {
      if (!p.wasOpen) { p.cool = p.o.cooldown ?? 12; p.wasOpen = true; }
      p.cool -= dt;
      if (p.cool <= 0) { p.open = false; p.wasOpen = false; p.cool = 0; }
    }
  },
});

registerProp('underground_controlDesk', { // signal control desk with a live track diagram
  w: 2, d: 1, h: 1.0,
  light: { z: 1.1, r: 2.6, color: '#7affd0', intensity: 0.6 },
  draw(ctx, ax, ay, p, t, world) {
    isoBox(ctx, ax, ay, 0.05, 0.25, 0, 1.9, 0.6, 0.8, { top: '#3a4440', left: '#5a6a64', right: '#3a4642', outline: OL });
    // sloped panel
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    fillPoly(ctx, [P(0.05, 0.25, 0.8), P(1.95, 0.25, 0.8), P(1.95, 0.6, 1.15), P(0.05, 0.6, 1.15)], OL);
    fillPoly(ctx, [P(0.1, 0.3, 0.83), P(1.9, 0.3, 0.83), P(1.9, 0.57, 1.12), P(0.1, 0.57, 1.12)], '#1a2a24');
    // track diagram line + moving train dots
    const a = P(0.2, 0.42, 0.97), b = P(1.8, 0.42, 0.97);
    line(ctx, a.x, a.y, b.x, b.y, '#e8e8e0');
    for (let i = 0; i < 6; i++) { const q = P(0.25 + i * 0.3, 0.42, 0.97); R(ctx, (Math.floor(t * 2 + i) % 4) ? '#3aff6a' : '#ff3a2a', q.x, q.y - 2, 1, 1); }
    if (world && world.vehicles) for (const v of world.vehicles) {
      if (!v.def || !v.def.train) continue;
      const f = Math.max(0, Math.min(1, v.dist / v.len));
      const q = P(0.2 + f * 1.6, 0.42, 0.97);
      R(ctx, '#ffb030', q.x - 2, q.y - 1, 5, 2);
    }
    for (let i = 0; i < 8; i++) { const q = P(0.2 + i * 0.2, 0.52, 1.07); R(ctx, ((i * 7 + Math.floor(t * 3)) % 5) ? '#e8c020' : '#3a3a20', q.x, q.y, 1, 1); }
    // mug of tea
    const m = P(1.7, 0.4, 0.8); R(ctx, OL, m.x - 2, m.y - 5, 5, 6); R(ctx, '#f4f1e8', m.x - 1, m.y - 4, 3, 4); R(ctx, '#8a5a30', m.x - 1, m.y - 4, 3, 1);
  },
});

registerProp('underground_sleepers', { // stack of old wooden sleepers
  w: 2, d: 1, h: 0.6,
  breakable: { hp: 24, debris: ['#4a3624', '#2e2216'], sfx: 'wood', drops: [['coin', 0.4], ['underground_spanner', 0.3]], score: 50 },
  draw(ctx, ax, ay, p) {
    for (let i = 0; i < 3; i++) {
      isoBox(ctx, ax, ay, 0.05, 0.12 + (i % 2) * 0.06, i * 0.2, 1.9, 0.32, 0.2, { color: i % 2 ? '#4a3624' : '#56402a', outline: OL });
      isoBox(ctx, ax, ay, 0.05, 0.52 - (i % 2) * 0.06, i * 0.2, 1.9, 0.32, 0.2, { color: i % 2 ? '#56402a' : '#4a3624', outline: OL });
    }
  },
});

registerProp('underground_trolley', { // yellow track maintenance trolley (sits on rails)
  w: 2, d: 1, h: 0.8,
  draw(ctx, ax, ay, p) {
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.15); ellipse(ctx, s.x, s.y, 3, 3, '#0c0c0e'); ellipse(ctx, s.x, s.y, 1, 1, '#8a8a8a'); };
    wh(0.3, 0.92); wh(1.7, 0.92);
    isoBox(ctx, ax, ay, 0.05, 0.1, 0.15, 1.9, 0.8, 0.25, { color: '#d8a818', outline: OL });
    isoBox(ctx, ax, ay, 0.2, 0.2, 0.4, 0.5, 0.6, 0.35, { color: '#8a2a1a', outline: OL });
    isoBox(ctx, ax, ay, 0.9, 0.25, 0.4, 0.9, 0.5, 0.2, { color: '#5a5e66', outline: OL });
    const s = proj(ax, ay, 0.9, 0.9, 0.3); tinyText(ctx, 'NM-07', s.x, s.y - 2, '#1a1a1a', 0.5);
  },
});

registerProp('underground_guitarCase', { // open case, flat
  h: 0, solid: false, depthBias: -3,
  draw(ctx, ax, ay, p, t) {
    const P = (x, y) => proj(ax, ay, x, y, 0.05);
    fillPoly(ctx, [P(0.15, 0.2), P(0.85, 0.2), P(0.85, 0.8), P(0.15, 0.8)], OL);
    fillPoly(ctx, [P(0.2, 0.25), P(0.8, 0.25), P(0.8, 0.75), P(0.2, 0.75)], '#6a1a3a');
    for (let i = 0; i < 6; i++) { const q = P(0.3 + (i * 37 % 10) / 20, 0.35 + (i * 53 % 10) / 25); R(ctx, (Math.floor(t * 4 + i) % 5) ? '#c8a030' : '#fff8c0', q.x, q.y, 2, 1); }
    const q = P(0.5, 0.8); tinyText(ctx, 'TA', q.x - 3, q.y + 2, '#f4f1e8');
  },
});

// The busker: a doll strumming a guitar (solid so you can't walk through him)
const BUSKER_LOOK = {
  skin: '#f0c098', hair: { style: 'long', color: '#b4521c' }, facial: 'beard',
  hat: { style: 'beanie', color: homeKit.main, trim: homeKit.second },   // the game's black and yellow
  jacket: { style: 'parka', color: '#4a5a3a' }, shirt: '#e8e4dc',
  pants: { style: 'jeans', color: '#3a4a6a' }, shoes: { color: '#5a3a20', sole: '#2a2a2a' },
  scarf: { a: homeKit.main, b: homeKit.second }, build: 1.05, height: 1,
};
registerProp('underground_busker', {
  h: 1.4,
  draw(ctx, ax, ay, p, t, world) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x, b.y, 8, 3.5, 0.38);
    const pose = sampleAnim('idle', t);
    const strum = Math.sin(t * 9) * 0.25;
    pose.uaN = 0.9 + strum; pose.faN = 1.3; pose.uaF = 1.2; pose.faF = 1.4; pose.head = 0.15 + Math.sin(t * 2) * 0.08;
    drawDoll(ctx, b.x, b.y, BUSKER_LOOK, pose, { flip: true, time: t, face: 'normal' });
    // guitar
    const gx = b.x - 2, gy = b.y - 22;
    fillPoly(ctx, [{ x: gx - 6, y: gy - 3 }, { x: gx + 3, y: gy - 6 }, { x: gx + 6, y: gy + 3 }, { x: gx - 3, y: gy + 6 }], OL);
    ellipse(ctx, gx, gy, 5, 4, '#a8642a'); ellipse(ctx, gx, gy, 2, 2, '#2a1a10');
    thick(ctx, gx + 2, gy - 1, gx + 14, gy - 8, 2, '#3a2412');
    // notes
    const k = (t * 0.8) % 1;
    const nx = b.x + 6 + k * 8, ny = b.y - 52 - k * 14;
    ctx.globalAlpha = 1 - k;
    R(ctx, '#f4f1e8', nx, ny, 1, 5); R(ctx, '#f4f1e8', nx - 2, ny + 4, 3, 2); R(ctx, '#f4f1e8', nx + 1, ny, 2, 1);
    ctx.globalAlpha = 1;
    const pl = world && world.player;
    if (pl && Math.hypot(pl.x - p.cx, pl.y - p.cy) < 2.4) {
      const lines = ['ANCHORS TILL I DIE', 'SPARE ANY CHANGE?', 'THIS ONE IS A CLASSIC', 'PORTSIDE WENT THAT WAY'];
      const s = lines[Math.floor(t / 3) % lines.length];
      drawText(ctx, s, b.x, b.y - 64, { color: '#ffe14a', align: 'center', outline: '#000' });
    }
  },
});

// Low brass handrail post for stairs (decor, solid h 1)
registerProp('underground_rope', { // queue rope barrier (decor, not solid)
  h: 0, solid: false,
  draw(ctx, ax, ay, p) {
    const a = proj(ax, ay, 0.1, 0.5, 0), b = proj(ax, ay, 0.9, 0.5, 0);
    for (const q of [a, b]) { thick(ctx, q.x, q.y, q.x, q.y - 16, 3, OL); thick(ctx, q.x, q.y, q.x, q.y - 16, 1, '#c8a850'); }
    for (let i = 0; i <= 8; i++) { const u = i / 8; const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u - 14 + Math.sin(u * Math.PI) * 4; R(ctx, '#8a1a24', x, y, 1, 2); }
  },
});

// ================================================================== ITEMS
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function stick(len, w, color, tip, tipLen) {
  return (ctx, hx, hy, ang, s = 1, flash) => {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const bx = hx - dx * 2 * s, by = hy - dy * 2 * s, ex = hx + dx * len * s, ey = hy + dy * len * s;
    thick(ctx, bx, by, ex, ey, w + 2, OL);
    thick(ctx, bx, by, ex, ey, w, flash ? '#fff' : color);
    if (tip) thick(ctx, hx + dx * (len - tipLen) * s, hy + dy * (len - tipLen) * s, ex, ey, w + 1, flash ? '#fff' : tip);
  };
}
registerItem('underground_pickhandle', {
  name: 'PICK HANDLE', kind: 'weapon', score: 0,
  weapon: { dmg: 15, reach: 1.55, durability: 7, attack: 'underground_handleSwing', knockdown: true, throwDmg: 16, breaks: 'wood' },
  icon(ctx, x, y) { px(ctx, OL, x - 8, y - 6, 16, 5); px(ctx, '#b08a58', x - 7, y - 5, 14, 3); px(ctx, '#d0aa70', x - 7, y - 5, 14, 1); px(ctx, '#8a6a40', x + 4, y - 6, 4, 5); },
  drawHeld: stick(14, 2, '#b08a58', '#8a6a40', 4),
});
registerItem('underground_spanner', {
  name: 'TRACK SPANNER', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.3, durability: 9, attack: 'swing', throwDmg: 15, breaks: 'metal' },
  icon(ctx, x, y) { px(ctx, OL, x - 7, y - 5, 14, 4); px(ctx, '#8a929a', x - 6, y - 4, 12, 2); px(ctx, OL, x + 4, y - 8, 4, 9); px(ctx, '#a8b0b8', x + 5, y - 7, 2, 2); px(ctx, '#a8b0b8', x + 5, y - 3, 2, 2); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    stick(10, 2, '#8a929a')(ctx, hx, hy, ang, s, flash);
    const dx = Math.sin(ang), dy = Math.cos(ang), ex = hx + dx * 10 * s, ey = hy + dy * 10 * s;
    px(ctx, OL, ex - 3, ey - 3, 7, 7); px(ctx, flash ? '#fff' : '#a8b0b8', ex - 2, ey - 2, 5, 5); px(ctx, OL, ex, ey - 2, 1, 3);
  },
});
registerItem('underground_tea', {
  name: 'CANTEEN TEA', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 4, y - 9, 8, 9); px(ctx, '#f4f1e8', x - 3, y - 8, 6, 7); px(ctx, '#8a5a30', x - 3, y - 8, 6, 2);
    px(ctx, OL, x + 4, y - 7, 2, 4); px(ctx, '#f4f1e8', x + 4, y - 6, 1, 2);
    const k = Math.floor(t * 3) % 2; px(ctx, '#d0d0d0', x - 1 + k, y - 12, 1, 2); px(ctx, '#d0d0d0', x + 1 - k, y - 14, 1, 2);
  },
});

// ================================================================== TRAINS
// Draws a train (a world vehicle from a 'traffic' hazard with def.train) as 1-tile segments, each its own
// depth-sorted actor, clipped to the visible tunnel range def.clip = [x0, x1]. Lane must run along x.
const CAR_LEN = 1;
export function spawnTrainActors(world, v) {
  const def = v.def;
  const N = Math.round((def.halfLen ?? 4) * 2 / CAR_LEN);
  const half = def.halfWidth ?? 0.72;
  const ly = v.y;
  const livery = def.livery || { body: '#e4e0d4', band: '#c8102e', roof: '#7a7e86', dark: '#1a1a1e' };
  for (let i = 0; i < N; i++) {
    const off = (i - (N - 1) / 2) * CAR_LEN;   // along travel direction (+ = towards the front)
    const actor = {
      x: v.x, y: ly, removed: false, v, i, N,
      update() { if (v.removed) this.removed = true; },
      cx() { return v.x + v.dx * off; },
      depth() { return this.cx() + ly + 0.05; },
      draw(ctx, w) {
        const cx = this.cx();
        let x0 = cx - CAR_LEN / 2, x1 = cx + CAR_LEN / 2;
        const clip = def.clip || [-1e9, 1e9];
        x0 = Math.max(x0, clip[0]); x1 = Math.min(x1, clip[1]);
        if (x1 - x0 <= 0.01) return;
        const a = toScreen(x0, ly - half, 0);
        const W = x1 - x0, D = half * 2;
        const front = v.dx > 0 ? i === N - 1 : i === 0;
        const car = Math.floor((v.dx > 0 ? (N - 1 - i) : i) / 3);  // carriage index from the front
        const posInCar = (v.dx > 0 ? (N - 1 - i) : i) % 3;
        const L = livery;
        // underframe + bogies
        isoBox(ctx, a.x, a.y, 0, 0.1, 0, W, D - 0.2, 0.22, { top: L.dark, left: '#0e0e10', right: '#0a0a0c' });
        const wl = toScreen(cx, ly + half - 0.05, 0.12);
        if (cx > clip[0] && cx < clip[1]) { ellipse(ctx, wl.x, wl.y, 3, 3, '#050506'); R(ctx, '#6a6a70', wl.x - 1, wl.y - 1, 2, 1); }
        // body
        isoBox(ctx, a.x, a.y, 0, 0, 0.22, W, D, 1.95, { top: L.roof, left: L.body, right: shade(L.body, -0.32) });
        // roof curve highlight
        isoBox(ctx, a.x, a.y, 0, 0.12, 2.17, W, D - 0.24, 0.08, { top: shade(L.roof, 0.15), left: shade(L.roof, -0.1), right: shade(L.roof, -0.3) });
        // band
        isoPanel(ctx, a.x, a.y, 'left', 0, D, W, 0.45, 0.68, L.band);
        // windows or doors on the visible +y side
        const wx0 = Math.max(0, (cx - 0.5) - x0), wx1 = Math.min(W, (cx + 0.5) - x0);
        if (posInCar === 1 && !front) {
          // double doors
          isoPanel(ctx, a.x, a.y, 'left', wx0 + 0.12, D, Math.max(0, Math.min(0.76, wx1 - wx0 - 0.24)), 0.25, 1.95, '#c8c4b8');
          isoPanel(ctx, a.x, a.y, 'left', wx0 + 0.2, D, Math.max(0, Math.min(0.26, wx1 - wx0 - 0.4)), 1.1, 1.75, '#20303a');
          isoPanel(ctx, a.x, a.y, 'left', wx0 + 0.54, D, Math.max(0, Math.min(0.26, wx1 - wx0 - 0.74)), 1.1, 1.75, '#20303a');
          isoPanel(ctx, a.x, a.y, 'left', wx0 + 0.49, D, Math.max(0, Math.min(0.02, wx1 - wx0 - 0.5)), 0.25, 1.95, '#e8a020');
        } else if (wx1 - wx0 > 0.15) {
          isoPanel(ctx, a.x, a.y, 'left', wx0 + 0.08, D, Math.max(0, wx1 - wx0 - 0.16), 1.0, 1.78, '#1a2228');
          isoPanel(ctx, a.x, a.y, 'left', wx0 + 0.12, D, Math.max(0, wx1 - wx0 - 0.24), 1.05, 1.74, (car + posInCar + Math.floor(v.x)) % 4 ? '#e8d890' : '#c8b870');
          // passengers' silhouettes
          if ((i * 7 + car) % 3 !== 0) {
            const hp = toScreen(cx, ly + half, 1.42);
            R(ctx, '#3a3020', hp.x - 2, hp.y - 3, 4, 7);
            ellipse(ctx, hp.x, hp.y - 6, 2, 2, '#3a3020');
            if ((i + car) % 2) { R(ctx, L.band, hp.x - 2, hp.y, 4, 2); R(ctx, '#f4f1e8', hp.x - 1, hp.y, 1, 2); }
          }
        }
        // carriage gap
        if (posInCar === 2 && !front && wx1 - wx0 > 0.9) isoPanel(ctx, a.x, a.y, 'left', wx1 - 0.04, D, 0.04, 0.25, 2.15, '#2a2a2e');
        // front cab
        if (front) {
          const fx = v.dx > 0 ? x1 : x0;
          if (v.dx > 0 && x1 >= cx + CAR_LEN / 2 - 0.01) {
            const ap = toScreen(fx, ly - half, 0);
            isoPanel(ctx, ap.x, ap.y, 'right', 0, 0.12, D - 0.24, 1.15, 1.85, '#1a2228');
            isoPanel(ctx, ap.x, ap.y, 'right', 0, 0.18, D - 0.36, 1.2, 1.8, '#3a5a6a');
            isoPanel(ctx, ap.x, ap.y, 'right', 0, 0.1, D - 0.2, 0.45, 0.68, L.band);
            const d1 = toScreen(fx, ly, 2.0); R(ctx, '#0a0a0a', d1.x - 9, d1.y - 1, 18, 5);
            tinyText(ctx, def.dest || 'STADIUM', d1.x, d1.y, '#ffb030', -0.5, 'center');
            for (const yy of [ly - half + 0.2, ly + half - 0.2]) { const hl = toScreen(fx, yy, 0.6); R(ctx, '#fff8d0', hl.x - 1, hl.y - 1, 3, 2); }
            w.lightsDynamic = w.lightsDynamic || [];
            w.lightsDynamic.push({ x: fx + 1.6, y: ly, z: 0.5, r: 4, color: '#fff4c8', intensity: 0.95 });
          }
        }
        if ((i % 3) === 1) { w.lightsDynamic = w.lightsDynamic || []; w.lightsDynamic.push({ x: cx, y: ly + 1.1, z: 1.2, r: 2.4, color: '#ffe8a0', intensity: 0.55 }); }
      },
    };
    world.addActor(actor);
  }
}
