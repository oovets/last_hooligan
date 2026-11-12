// THEME: THE INDUSTRIAL ZONE (level 6) — docks, container yard, warehouse, factory floor, loading bay, quay.
// Only ADDS ids (all prefixed 'industrial_'). Floors, walls, props and items used by l6_industrial.js.
import { registerFloor, registerWall } from '../../engine/tiles.js';
import { registerProp } from '../../game/props.js';
import { registerItem } from '../../game/items.js';
import { shade, mix } from '../../engine/color.js';
import { hash2 } from '../../engine/rng.js';
import { isoBox, isoQuad, isoPanel, fillPoly, ellipse, line, thick, proj, shadow } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import { Z_PX } from '../../engine/constants.js';

import { ENV } from '../../engine/envsprites.js';

const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const OL = '#120c14';
const SODIUM = '#ff9a3a';

// Blender sprite parts (scripts/blender/env_industrial.py): props whose state the sprite matcher can't select (lorry
// segments, lifted office furniture, press frames, lever/lamp states, gate signs) carry extra variants tagged 'part'.
// World.drawProp draws the matched variant (a blank or the default state), then the prop's overlay() draws the right part.
function envPart(type, pred) { const l = ENV.props[type]; if (l) for (const v of l) if (pred(v)) return v; return null; }
function drawPart(ctx, v, ax, ay, p, lift = 0) {
  const prev = ctx.globalAlpha;
  if (p.flash > 0) ctx.globalAlpha = prev * 0.6;
  ctx.drawImage(v.img, ax - v.ax / 2, ay - lift * Z_PX - v.ay / 2, v.img.width / 2, v.img.height / 2);
  ctx.globalAlpha = prev;
}
const lc = c => String(c || '').toLowerCase();

// ================================================================== floors
function yardPix(u, v, tx, ty, r) {
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 31);
  let c = n < 0.07 ? '#2a282e' : n > 0.94 ? '#423f46' : n > 0.8 ? '#38353c' : '#343238';
  // oil stain
  if (r < 0.2) {
    const cu = 0.3 + hash2(tx, ty, 41) * 0.4, cv = 0.3 + hash2(tx, ty, 42) * 0.4;
    const d = Math.hypot((u - cu) * 1.3, v - cv);
    if (d < 0.2) c = n > 0.85 ? '#3a3448' : '#232128';
    else if (d < 0.25) c = '#2c2a31';
  }
  // hairline crack
  if (r > 0.86 && Math.abs(v - 0.5 - Math.sin(u * 9 + tx) * 0.12) < 0.025) c = '#222026';
  return c;
}
registerFloor('industrial_yard', { pixel: yardPix });
registerFloor('industrial_yardLineX', { // worn yellow paint line along world x
  pixel(u, v, tx, ty, r) {
    if (Math.abs(v - 0.5) < 0.06 && n2(u * 32 + tx * 32, v * 16, 33) > 0.18) return n2(u * 32 + tx * 32, ty, 34) < 0.15 ? '#a8862a' : '#d0a42c';
    return yardPix(u, v, tx, ty, 0.5);
  },
});
registerFloor('industrial_hatch', { // yellow/black hazard hatching
  pixel(u, v, tx, ty) {
    const s = ((u + v + tx + ty) * 3) % 1 < 0.5;
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 35);
    if (n < 0.12) return '#3a3638';
    return s ? (n > 0.9 ? '#b08a20' : '#d0a422') : (n > 0.9 ? '#2e2c30' : '#1e1d22');
  },
});
function slabPix(u, v, tx, ty, r, base = '#4a524e') {
  if (u < 0.03 || v < 0.03) return shade(base, -0.22);
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 36);
  let c = r < 0.5 ? base : shade(base, -0.04);
  if (n < 0.05) c = shade(c, -0.15); else if (n > 0.97) c = shade(c, 0.12);
  // tyre scuffs along x
  if (r > 0.75 && (Math.abs(v - 0.3) < 0.04 || Math.abs(v - 0.7) < 0.04) && n > 0.3) c = shade(c, -0.1);
  return c;
}
registerFloor('industrial_slab', { pixel: (u, v, tx, ty, r) => slabPix(u, v, tx, ty, r) });
registerFloor('industrial_slabLineX', {
  pixel(u, v, tx, ty, r) {
    if (Math.abs(v - 0.5) < 0.07) return n2(u * 32 + tx * 32, ty, 37) < 0.1 ? '#8a7a3a' : '#d8b030';
    return slabPix(u, v, tx, ty, r);
  },
});
function factoryPix(u, v, tx, ty, r) {
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 38);
  if ((u * 2) % 1 < 0.03 || (v * 2) % 1 < 0.03) return '#2c2a2a';
  let c = n < 0.08 ? '#332f2e' : n > 0.95 ? '#4a4542' : '#3d3937';
  if (r < 0.22) { const d = Math.hypot(u - 0.5 - (r - 0.1), v - 0.55); if (d < 0.22) c = n > 0.9 ? '#3e3450' : '#2a2626'; }
  return c;
}
registerFloor('industrial_factory', { pixel: factoryPix });
registerFloor('industrial_factoryLineX', {
  pixel(u, v, tx, ty, r) { if (Math.abs(v - 0.5) < 0.06) return '#d8b030'; return factoryPix(u, v, tx, ty, r); },
});
registerFloor('industrial_factoryLineY', {
  pixel(u, v, tx, ty, r) { if (Math.abs(u - 0.5) < 0.06) return '#d8b030'; return factoryPix(u, v, tx, ty, r); },
});
registerFloor('industrial_plate', { // diamond tread steel
  pixel(u, v) {
    const a = (u * 8) % 1, b = (v * 8) % 1;
    const odd = (Math.floor(u * 8) + Math.floor(v * 8)) % 2;
    if (Math.abs(a - b) < 0.16 && odd) return '#8c9098';
    if (Math.abs(a + b - 1) < 0.16 && !odd) return '#8c9098';
    return (u < 0.03 || v < 0.03) ? '#3a3c42' : '#5c6068';
  },
});
// conveyor belts: base look (motion is drawn by the level each frame)
function beltPix(alongX) {
  return (u, v, tx, ty) => {
    const a = alongX ? u : v, c = alongX ? v : u;
    if (c < 0.12 || c > 0.88) {
      if (c < 0.05 || c > 0.95) return '#2a2c30';
      return ((a * 4) % 1 < 0.15) ? '#3e4148' : '#767a84';
    }
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 39);
    return n < 0.1 ? '#1a1a1e' : '#232328';
  };
}
registerFloor('industrial_beltXp', { pixel: beltPix(true) });
registerFloor('industrial_beltXn', { pixel: beltPix(true) });
registerFloor('industrial_beltYp', { pixel: beltPix(false) });
registerFloor('industrial_beltYn', { pixel: beltPix(false) });
registerFloor('industrial_grate', {
  pixel(u, v) { return ((u * 8) % 1 < 0.28 || (v * 8) % 1 < 0.28) ? '#585b62' : '#121216'; },
});
registerFloor('industrial_lino', {
  pixel(u, v, tx, ty) {
    const a = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 40);
    let c = a ? '#7e7464' : '#625c52';
    if ((u * 2) % 1 < 0.04 || (v * 2) % 1 < 0.04) c = '#4a463e';
    return n < 0.06 ? shade(c, -0.12) : c;
  },
});
function quayPix(u, v, tx, ty) {
  const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 43);
  if (u < 0.025 || v < 0.025) return '#3a3834';
  let c = hash2(tx, ty, 44) < 0.5 ? '#55534c' : '#5c5a52';
  if (n < 0.07) c = '#46443e'; else if (n > 0.96) c = '#6a675e';
  return c;
}
registerFloor('industrial_quay', { pixel: quayPix });
registerFloor('industrial_quayEdge', { // painted yellow edge on the +y side, then the granite lip
  pixel(u, v, tx, ty) {
    if (v > 0.9) return v > 0.95 ? '#1c1c1e' : '#7a7870';
    if (v > 0.72 && v < 0.84) return n2(u * 32 + tx * 32, 1, 45) < 0.15 ? '#8a7a3a' : '#d8b030';
    return quayPix(u, v, tx, ty);
  },
});
registerFloor('industrial_water', {
  pixel(u, v, tx, ty) {
    const n = n2(u * 16 + tx * 16, v * 32 + ty * 32, 46);
    const w = Math.sin((u + tx) * 7 + (v + ty) * 2.3);
    if (w > 0.93) return '#2a4660';
    return n < 0.08 ? '#142636' : '#0c1824';
  },
});
registerFloor('industrial_ramp', {
  pixel(u, v) {
    if (u < 0.06 || u > 0.94) return '#2a2c30';
    return ((v * 6) % 1 < 0.2) ? '#8a8e96' : '#5a5e66';
  },
});

// ================================================================== walls
// shipping containers: vertical ribs, top/bottom rails, rust, stencils
function containerFace(base, seed = 0) {
  return (u, py, side, H, r, variant) => {
    const wu = Math.floor(u * 16);
    const rib = wu % 4;
    let c = rib === 0 ? shade(base, -0.28) : rib === 1 ? shade(base, 0.12) : base;
    if (py < 3) c = py === 0 ? shade(base, 0.25) : shade(base, -0.2);
    else if (py > H - 4) c = shade(base, -0.45);
    else {
      // rust streaks running down from the top rail
      const rs = hash2(wu + variant * 17, seed, 47);
      if (rs < 0.18 && py < 6 + rs * 60) c = mix(c, '#6a3a1e', 0.55);
      // stencilled ID code on some panels
      if (side === 'left' && variant % 3 === 0 && py > 7 && py < 13 && wu > 2 && wu < 13 && hash2(wu, py, variant + 48) < 0.55) c = '#d8d4c8';
      // dents
      if (hash2(wu, Math.floor(py / 3), variant + 49) < 0.03) c = shade(c, -0.15);
    }
    return side === 'right' ? shade(c, -0.3) : c;
  };
}
function containerTop(base) {
  return (u, v) => {
    if (u < 0.06 || v < 0.06 || u > 0.94 || v > 0.94) return shade(base, -0.3);
    return ((u * 6) % 1 < 0.2) ? shade(base, -0.12) : shade(base, 0.05);
  };
}
const CONTAINER_COLORS = { Red: '#8a3324', Blue: '#2a4d7a', Green: '#3c6a3c', Orange: '#b0602a', Grey: '#6a6e72', Cream: '#a89c80' };
for (const [name, col] of Object.entries(CONTAINER_COLORS)) {
  registerWall('industrial_container' + name, { top: containerTop(col), face: containerFace(col, name.length), variants: 6 });
}
// double-stacked containers (two colours, seam in the middle)
function stackWall(lo, hi) {
  const fl = containerFace(lo, 3), fh = containerFace(hi, 5);
  return {
    top: containerTop(hi), variants: 6,
    face(u, py, side, H, r, v) {
      const half = Math.floor(H / 2);
      return py < half ? fh(u, py, side, half, r, v) : fl(u, py - half, side, H - half, r, v + 1);
    },
  };
}
registerWall('industrial_stackA', stackWall('#2a4d7a', '#8a3324'));
registerWall('industrial_stackB', stackWall('#6a6e72', '#3c6a3c'));

// warehouse cladding: blue-grey corrugated sheet, rooflight band, concrete plinth
registerWall('industrial_cladding', {
  top: (u, v) => ((u * 4) % 1 < 0.12 ? '#2e3640' : '#46525e'), variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    let c;
    if (py > H - 9) { // concrete plinth
      c = hash2(wu, py, variant + 50) < 0.1 ? '#4e4e52' : '#606064';
      if (py === H - 9) c = '#3a3a3e';
    } else if (py >= 5 && py < 13) { // translucent rooflight band
      c = wu % 8 === 0 || py === 5 || py === 12 ? '#2e3640' : (hash2(variant, wu >> 3, 51) < 0.5 ? '#c8a060' : '#6e7e86');
    } else {
      const rib = wu % 3;
      c = rib === 0 ? '#3a4652' : rib === 1 ? '#5e6c7a' : '#4c5866';
      if (py % 30 === 14) c = '#323c46';
      const rs = hash2(wu + variant * 5, 2, 52);
      if (rs < 0.12 && py > 14 && py < 14 + rs * 160) c = mix(c, '#7a4a2a', 0.45);
    }
    if (py < 2) c = '#7a8894';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
// sooty factory brick with big industrial windows (lit orange on some)
registerWall('industrial_factoryBrick', {
  top: '#2e2220', variants: 8,
  face(u, py, side, H, r, variant) {
    const bx = u * 16, row = Math.floor(py / 4), off = row % 2 ? 4 : 0;
    let c;
    if (py % 4 === 3 || Math.floor(bx + off) % 8 === 0) c = '#1e1616';
    else {
      const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, 53);
      c = s < 0.3 ? '#4e2a22' : s > 0.85 ? '#6a3a2c' : '#5a3228';
    }
    // soot toward the top
    if (py < 14 && hash2(Math.floor(bx), py, variant) < (14 - py) / 18) c = shade(c, -0.35);
    const wu = Math.floor(bx);
    const winTop = 10, winBot = H - 12;
    if (H >= 50 && variant % 4 !== 3 && py >= winTop && py <= winBot && wu >= 3 && wu <= 12) {
      if (py === winTop || py === winBot || wu === 3 || wu === 12) c = '#2a2a2e';
      else if (wu === 7 || wu === 8 || (py - winTop) % 7 === 0) c = '#3a3a3e';
      else {
        const lit = hash2(variant, side === 'left' ? 1 : 2, 54) < 0.55;
        const broken = hash2(wu >> 1, (py - winTop) / 7 | 0, variant + 55) < 0.08;
        c = broken ? '#0c0c10' : lit ? ((py - winTop) % 7 < 3 ? '#ffb050' : '#d87a30') : '#1e2430';
      }
    } else if (variant % 4 === 3 && wu >= 7 && wu <= 8 && py > 2) c = py % 12 === 0 ? '#22262a' : (wu === 7 ? '#4a5058' : '#30343a'); // downpipe
    if (py < 2) c = '#5a463c';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
// closed roller shutter
registerWall('industrial_shutter', {
  top: '#2e3238',
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    let c;
    if (py < 7) c = py < 2 ? '#5a6068' : '#30343a';
    else if (wu < 1 || wu > 14) c = '#26282c';
    else if (py > H - 6) c = (Math.floor((wu + py) / 3) % 2) ? '#d8b020' : '#1e1e22';
    else c = (py % 3 === 0) ? '#4a5058' : (py % 3 === 1 ? '#7a828c' : '#646c76');
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
// warehouse racking: orange uprights, blue beams, boxes; gaps are see-through
function shelfPix(wu, py, H, variant, side) {
  if (wu < 1 || wu > 14) return (py % 4 === 0) ? '#8a4410' : '#e07a1a';
  const lvl = Math.floor(py / 18), ly = py % 18;
  if (ly >= 15) return ly === 15 ? '#5a8ad8' : '#2a5aa8';
  const slot = Math.floor(wu / 5);
  const kind = hash2(slot + variant * 3, lvl, side === 'left' ? 56 : 57);
  if (kind < 0.22) return null;                       // empty slot: see through
  const top = 3 + Math.floor(hash2(slot, lvl + variant, 58) * 7);
  if (ly < top) return null;
  if (kind < 0.62) { // cardboard
    if (wu % 5 === 0) return '#5e4428';
    if (ly === top) return '#c89a5e';
    return (wu % 5 === 2 && ly < top + 3) ? '#d8c8a0' : '#a87a48';
  }
  if (kind < 0.82) return ly === top ? '#5a8ad8' : ((wu + ly) % 3 ? '#2e5aa0' : '#24488a'); // plastic crates
  return ly % 3 === 0 ? '#c8ccd0' : '#9aa0a8';          // shrink-wrapped
}
registerWall('industrial_shelf', {
  variants: 8,
  top(u, v) { if (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92) return '#2a5aa8'; return ((u * 3) % 1 < 0.1) ? '#7a5a38' : '#b08a58'; },
  face(u, py, side, H, r, variant) { const c = shelfPix(Math.floor(u * 16), py, H, variant, side); return c && side === 'right' ? shade(c, -0.3) : c; },
});
// chain-link fence planes: X runs along world x (drawn on the tile's +y edge), Y along world y (+x edge)
function meshFace(want) {
  return (u, py, side, H) => {
    if (side !== want) return null;
    const wu = u * 16;
    const dk = side === 'right';
    if (Math.floor(wu) === 0) return dk ? '#3a3e44' : '#565c64';
    if (py < 2) return dk ? '#5a6068' : '#8a929c';
    if (py > H - 3) return dk ? '#2a2c30' : '#3e4248';
    if (py < 6 && (Math.floor(wu) + py) % 5 === 0) return '#9aa0a8';        // barbed wire
    if (py < 6) return null;
    if (((wu + py) % 4) < 0.9 || ((wu - py + 400) % 4) < 0.9) return dk ? '#5a6068' : '#80878f';
    return null;
  };
}
registerWall('industrial_meshX', { top: (u, v) => (v > 0.88 ? '#8a929c' : null), face: meshFace('left') });
registerWall('industrial_meshY', { top: (u, v) => (u > 0.88 ? '#5a6068' : null), face: meshFace('right') });
// guard hut: white render, blue trim, lit window
registerWall('industrial_hut', {
  top: (u, v) => ((u + v) * 6 % 1 < 0.1 ? '#3a3a40' : '#4a4a52'),
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    let c = hash2(wu, py, 59) < 0.06 ? '#bcb8ac' : '#d4d0c4';
    if (py < 3) c = '#2a4a8a';
    else if (py > H - 5) c = '#6a6a70';
    else if (py >= 8 && py <= 24 && wu >= 2 && wu <= 13) {
      if (py === 8 || py === 24 || wu === 2 || wu === 13 || wu === 7) c = '#2a4a8a';
      else c = side === 'left' ? (py < 15 ? '#ffe08a' : '#e8b860') : '#c8a050';
    }
    return side === 'right' ? shade(c, -0.28) : c;
  },
});
// office partition on the mezzanine: steel edge below (platform), glass + blinds above (see-through gaps)
registerWall('industrial_partition', {
  top: (u, v) => ((u < 0.1 || v < 0.1 || u > 0.9 || v > 0.9) ? '#3a3e46' : null),
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    const lowTop = H - 24;
    let c;
    if (py >= lowTop) { // mezzanine edge
      const ly = py - lowTop;
      if (ly < 3) c = (Math.floor((wu + ly) / 2) % 2) ? '#d8b020' : '#1e1e22';
      else c = (wu % 8 === 4 && ly % 6 === 3) ? '#9aa0a8' : '#585e68';
    } else {
      if (wu === 0 || py < 2 || py === lowTop - 1) c = '#3a3e46';
      else if (py > lowTop - 9) c = '#8a8070';                          // low panel
      else if (py % 3 === 0) c = '#d8d4c0';                             // blinds
      else if (wu > 10 && py % 3 === 1) c = '#8aa8c0';                  // glass glint
      else c = null;
    }
    return c && side === 'right' ? shade(c, -0.3) : c;
  },
});
// mezzanine platform (h 1.2) and stair steps
registerWall('industrial_mezz', {
  top(u, v) {
    const a = (Math.floor(u * 2) + Math.floor(v * 2)) % 2;
    if ((u * 2) % 1 < 0.05 || (v * 2) % 1 < 0.05) return '#4a463e';
    return a ? '#7e7464' : '#625c52';
  },
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    let c = py < 3 ? ((Math.floor((wu + py) / 2) % 2) ? '#d8b020' : '#1e1e22') : (wu % 8 === 4 && py % 6 === 3 ? '#9aa0a8' : '#585e68');
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
registerWall('industrial_step', {
  top(u, v) { if (v > 0.85) return '#d8b020'; return ((u * 8 + v * 8) % 1 < 0.2) ? '#8c9098' : '#5c6068'; },
  face(u, py, side) { const c = py < 2 ? '#d8b020' : '#4a4e56'; return side === 'right' ? shade(c, -0.3) : c; },
});
// portakabin canteen
registerWall('industrial_kabin', {
  top: '#5a5a50',
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    let c = wu % 8 === 0 ? '#8a8268' : '#c8c0a0';
    if (py < 3) c = '#6a6450';
    if (py > H - 5) c = '#2a4a8a';
    if (py >= 9 && py <= 22 && wu >= 3 && wu <= 12) {
      if (py === 9 || py === 22 || wu === 3 || wu === 12) c = '#4a4a50';
      else c = side === 'left' ? (py < 15 ? '#ffd890' : '#e0a860') : '#a07a48';
    }
    return side === 'right' ? shade(c, -0.28) : c;
  },
});
// low concrete jersey barrier with chevrons
registerWall('industrial_jersey', {
  top: '#7a7a7e',
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    let c = hash2(wu, py, 60) < 0.06 ? '#6a6a6e' : '#8a8a8e';
    if (py >= 4 && py <= 9) c = (Math.floor((wu + py) / 3) % 2) ? '#d8b020' : '#1e1e22';
    if (py > H - 3) c = '#5a5a5e';
    return side === 'right' ? shade(c, -0.3) : c;
  },
});
// invisible blocker over water (the floor shows the water)
registerWall('industrial_waterBlock', { top: () => null, face: () => null, variants: 1 });

// ================================================================== props
// Draw one tile of a bigger axis-aligned box made of 1x1 prop segments (avoids painter's-sort artefacts on long
// objects). opts i,j = segment index, nw,nd = box size in tiles. Faces only drawn on the outer +x/+y edges.
function segFaces(ctx, ax, ay, p, z0, z1, top, left, right) {
  const o = p.o, nw = o.nw || 1, nd = o.nd || 1, i = o.i || 0, j = o.j || 0;
  const P = (x, y, z) => proj(ax, ay, x, y, z);
  if (j === nd - 1) fillPoly(ctx, [P(0, 1, z1), P(1, 1, z1), P(1, 1, z0), P(0, 1, z0)], left);
  if (i === nw - 1) fillPoly(ctx, [P(1, 1, z1), P(1, 0, z1), P(1, 0, z0), P(1, 1, z0)], right);
  fillPoly(ctx, [P(0, 0, z1), P(1, 0, z1), P(1, 1, z1), P(0, 1, z1)], top);
  // outer outline
  const L = (a, b) => line(ctx, a.x, a.y, b.x, b.y, OL);
  if (i === 0) L(P(0, 0, z1), P(0, 1, z1));
  if (j === 0) L(P(0, 0, z1), P(1, 0, z1));
  if (i === nw - 1) { L(P(1, 0, z1), P(1, 1, z1)); L(P(1, 1, z0), P(1, 0, z0)); if (j === 0) L(P(1, 0, z1), P(1, 0, z0)); }
  if (j === nd - 1) { L(P(0, 1, z1), P(1, 1, z1)); L(P(0, 1, z0), P(1, 1, z0)); if (i === 0) L(P(0, 1, z1), P(0, 1, z0)); }
  if (i === nw - 1 && j === nd - 1) L(P(1, 1, z1), P(1, 1, z0));
}
function wheel(ctx, s) { ellipse(ctx, s.x, s.y, 5, 6, OL); ellipse(ctx, s.x, s.y, 4, 5, '#1c1c20'); ellipse(ctx, s.x, s.y, 2, 2, '#8a8e96'); }

// lorry: part 'trailer' or 'cab' (segments), running along world y with the cab at the +y end (facing the camera)
registerProp('industrial_lorry', {
  h: 2.2,
  overlay(ctx, ax, ay, p, t, world) { // Blender segment slice (the matched sprite is a blank), then the livery text
    const o = p.o, i = o.i || 0, j = o.j || 0;
    const v = o.part === 'cab'
      ? envPart('industrial_lorry', q => q.part === 'cab' && q.i === i && q.j === j && lc(q.cabColor) === lc(o.cabColor || '#b02020'))
      : envPart('industrial_lorry', q => q.part === 'trailer' && q.i === i && q.j === j && lc(q.color) === lc(o.color || '#c8c4b8'));
    if (!v) { p.def.draw(ctx, ax, ay, p, t, world); return; }
    drawPart(ctx, v, ax, ay, p);
    const nw = o.nw || 2, nd = o.nd || 5;
    if (o.part !== 'cab' && i === nw - 1 && j === nd - 1 && o.text) {
      const m = proj(ax, ay, 1.01, -(nd - 1) / 2 + 0.5, 1.35);
      ctx.save(); ctx.translate(m.x, m.y); ctx.transform(1, -0.5, 0, 1, 0, 0);
      drawText(ctx, o.text, 0, -3, { color: o.textColor || '#1a2a5a', align: 'center' });
      ctx.restore();
    }
  },
  draw(ctx, ax, ay, p) {
    const o = p.o, nw = o.nw || 2, nd = o.nd || 5, i = o.i || 0, j = o.j || 0;
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const col = o.color || '#c8c4b8';
    if (o.part === 'cab') {
      const cc = o.cabColor || '#b02020';
      // chassis shadow + wheels
      if (i === nw - 1 && j === 0) wheel(ctx, P(1.02, 0.5, 0.25));
      segFaces(ctx, ax, ay, p, 0.3, 2.3, shade(cc, 0.1), shade(cc, -0.1), shade(cc, -0.35));
      if (j === nd - 1) { // front: windscreen, grille, lights, bumper
        isoPanel(ctx, ax, ay, 'left', 0.06, 1.01, 0.94, 1.45, 2.15, '#20303e');
        isoPanel(ctx, ax, ay, 'left', i === 0 ? 0.15 : 0.05, 1.01, 0.3, 1.9, 2.1, '#5a7890');
        isoPanel(ctx, ax, ay, 'left', 0.1, 1.01, 0.8, 0.7, 1.2, '#2a2a2e');
        for (let k = 0; k < 4; k++) isoPanel(ctx, ax, ay, 'left', 0.14, 1.015, 0.72, 0.76 + k * 0.11, 0.8 + k * 0.11, '#6a6e76');
        isoPanel(ctx, ax, ay, 'left', i === 0 ? 0.08 : 0.72, 1.02, 0.2, 0.5, 0.66, '#fff2b0');
        isoPanel(ctx, ax, ay, 'left', 0, 1.02, 1, 0.3, 0.46, '#3a3a40');
      }
      if (i === nw - 1) { // side: door + window
        isoPanel(ctx, ax, ay, 'right', 1.01, j === nd - 1 ? 0.1 : 0.15, 0.7, 1.45, 2.1, '#20303e');
        if (j === nd - 1) { isoPanel(ctx, ax, ay, 'right', 1.01, 0.05, 0.85, 0.5, 1.4, shade(cc, -0.45)); isoPanel(ctx, ax, ay, 'right', 1.015, 0.1, 0.75, 0.55, 1.35, shade(cc, -0.3)); }
      }
      if (j === 0) { const a = P(0.1, 0.15, 2.3), b = P(0.9, 0.15, 2.3); thick(ctx, a.x, a.y - 4, b.x, b.y - 4, 3, OL); thick(ctx, a.x, a.y - 4, b.x, b.y - 4, 1, shade(cc, 0.2)); }
      return;
    }
    // trailer box
    if (i === nw - 1 && (j === 0 || j === 1)) { const c = P(1.0, 0.5, 0.2); thick(ctx, c.x, c.y, c.x, c.y - 8, 2, OL); wheel(ctx, P(1.02, 0.5, 0.25)); }
    if (i === nw - 1 && j === nd - 1) { const c = P(1.0, 0.5, 0.3); thick(ctx, c.x, c.y, c.x, c.y + 4, 3, '#2a2a2e'); }
    segFaces(ctx, ax, ay, p, 0.45, 2.3, shade(col, 0.12), shade(col, -0.08), shade(col, -0.3));
    if (i === nw - 1) {
      for (let k = 1; k < 4; k++) { const a = P(1.005, k / 4, 2.25), b = P(1.005, k / 4, 0.5); line(ctx, a.x, a.y, b.x, b.y, shade(col, -0.42)); }
      isoPanel(ctx, ax, ay, 'right', 1.01, 0, 1, 0.55, 0.75, o.stripe || '#c8102e');
      isoPanel(ctx, ax, ay, 'right', 1.01, 0, 1, 2.05, 2.2, o.stripe || '#c8102e');
      if (j === nd - 1 && o.text) { // livery text spanning the whole side (drawn by the front-most tile)
        const m = P(1.01, -(nd - 1) / 2 + 0.5, 1.35);
        ctx.save(); ctx.translate(m.x, m.y); ctx.transform(1, -0.5, 0, 1, 0, 0);
        drawText(ctx, o.text, 0, -3, { color: o.textColor || '#1a2a5a', align: 'center' });
        ctx.restore();
      }
    }
  },
});
// sodium lamp mast
registerProp('industrial_lamp', {
  h: 3, light: { z: 4, r: 5.5, color: SODIUM, intensity: 0.95 },
  overlay(ctx, ax, ay, p, t) { // flickering mast: swap to the unlit render
    if (!(p.o.flicker && Math.sin(t * 11) + Math.sin(t * 5.7) > 1.5)) return;
    const v = envPart('industrial_lamp', q => q.part === 'off');
    if (v) drawPart(ctx, v, ax, ay, p);
  },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 4.1);
    ctx.fillStyle = OL; ctx.fillRect(b.x - 4, b.y - 5, 8, 6); ctx.fillStyle = '#4a4e56'; ctx.fillRect(b.x - 3, b.y - 4, 6, 4);
    thick(ctx, b.x, b.y, top.x, top.y, 4, OL); thick(ctx, b.x, b.y, top.x, top.y, 2, '#5a5e66');
    ctx.fillStyle = '#d8b020'; ctx.fillRect(b.x - 1, b.y - 18, 2, 6);
    const dir = p.o.flipArm ? -1 : 1;
    thick(ctx, top.x, top.y, top.x + 9 * dir, top.y - 3, 3, OL);
    ctx.fillStyle = OL; ctx.fillRect(top.x + (dir > 0 ? 5 : -16), top.y - 6, 11, 5);
    const on = !(p.o.flicker && Math.sin(t * 11) + Math.sin(t * 5.7) > 1.5);
    ctx.fillStyle = on ? '#ffd090' : '#5a4a30'; ctx.fillRect(top.x + (dir > 0 ? 6 : -15), top.y - 2, 9, 2);
    if (on) { ctx.globalAlpha = 0.35; ctx.fillStyle = SODIUM; ctx.fillRect(top.x + (dir > 0 ? 4 : -17), top.y, 13, 2); ctx.globalAlpha = 1; }
  },
});
// bulkhead wall light (decal on a wall tile face, like 'sign'); opts side, z, color
registerProp('industrial_wallLamp', {
  h: 0, solid: false, depthBias: 0.03,
  overlay(ctx, ax, ay, p, t, world) { // rendered at z 0.45 on the chosen face; lift to opts z
    const want = (p.o.side || 'left') + (p.o.color === 'white' ? 'white' : '');
    const v = envPart('industrial_wallLamp', q => q.part === want);
    if (!v) { p.def.draw(ctx, ax, ay, p, t, world); return; }
    drawPart(ctx, v, ax, ay, p, (p.o.z ?? 2.2) - 0.45);
  },
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    const m = side === 'left' ? proj(ax, ay, 0.5, 1.02, p.o.z ?? 2.2) : proj(ax, ay, 1.02, 0.5, p.o.z ?? 2.2);
    ctx.fillStyle = OL; ctx.fillRect(m.x - 5, m.y - 4, 10, 7);
    ctx.fillStyle = '#3a3e46'; ctx.fillRect(m.x - 4, m.y - 3, 8, 5);
    ctx.fillStyle = p.o.color === 'white' ? '#f0f4ff' : '#ffc070'; ctx.fillRect(m.x - 3, m.y - 2, 6, 3);
    ctx.fillStyle = OL; ctx.fillRect(m.x - 1, m.y - 3, 1, 5); ctx.fillRect(m.x + 1, m.y - 3, 1, 5);
  },
});
// steam vent: floor grate that hisses, warns (red lamp + wisps) and bursts. Damages anyone standing on it.
//   opts: period (s), offset (s), warn (s), burst (s), dmg
registerProp('industrial_vent', {
  h: 0, solid: false, depthBias: -5,
  update(p, world, dt) {
    const o = p.o;
    const per = (world.ventRate || 1) * (o.period || 4.2), warn = o.warn || 0.9, burst = o.burst || 1.0;
    p.vt = ((p.vt ?? (o.offset || 0)) + dt);
    const ph = p.vt % per;
    const idle = per - warn - burst;
    const prev = p.phase;
    p.phase = ph < idle ? 0 : ph < idle + warn ? 1 : 2;
    const cx = p.x + 0.5, cy = p.y + 0.5;
    const near = world.player && Math.hypot(world.player.x - cx, world.player.y - cy) < 9;
    if (p.phase === 1 && near && Math.random() < 0.3) world.fx.add({ x: cx + (Math.random() - 0.5) * 0.5, y: cy + (Math.random() - 0.5) * 0.5, z: 0.1, vz: 1.2, life: 0.5, color: '#c8ccd4', kind: 'puff', size: 2, g: -0.05 });
    if (p.phase === 2 && prev !== 2) { p.hitSet = new Set(); if (near) { world.sfx('whooshBig', { x: cx, y: cy }); world.sfx('zap', { x: cx, y: cy }); } }
    if (p.phase === 1 && prev !== 1 && near) world.sfx('zap', { x: cx, y: cy });
    if (p.phase === 2) {
      const k = (ph - idle - warn) / burst;
      if (near) for (let n = 0; n < 3; n++) {
        world.fx.add({ x: cx + (Math.random() - 0.5) * 0.6, y: cy + (Math.random() - 0.5) * 0.6, z: 0.2 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, vz: 5 + Math.random() * 3, life: 0.7 + Math.random() * 0.4, color: Math.random() < 0.3 ? '#ffffff' : '#d8dce4', kind: 'puff', size: 3 + Math.random() * 3, g: 0.1 });
      }
      if (k < 0.7) for (const f of world.fighters) {
        if (!f.alive || f.invuln > 0 || f.z > 1.6 || p.hitSet.has(f) || f.state === 'down') continue;
        if (Math.hypot(f.x - cx, f.y - cy) > 0.72 + f.r * 0.5) continue;
        p.hitSet.add(f);
        const dx = f.x - cx, dy = f.y - cy, d = Math.hypot(dx, dy) || 1;
        const def = { hz: 0.8, sfx: 'zap', hitstop: 0.05, shake: 3 };
        const res = f.takeHit({ attacker: null, def, dmg: o.dmg || 11, dir: { x: d > 0.05 ? dx / d : -f.fx, y: d > 0.05 ? dy / d : -f.fy }, kb: 3.5, stun: 0.5, knockdown: true, launch: 2.5, unblockable: true, guardDmg: 0 }, world);
        world.onHit({ x: cx, y: cy }, f, def, res, o.dmg || 11);
        if (!f.isPlayer && world.player) world.addScore(120, f.x, f.y, 1, true);
      }
    }
  },
  overlay(ctx, ax, ay, p, t) { // over the Blender grate: heat glow, warning lamp, steam column
    const P = (x, y, z = 0) => proj(ax, ay, x, y, z);
    const hot = p.phase === 2 ? '#ff8a40' : p.phase === 1 ? '#c04020' : null;
    if (hot) { ctx.globalAlpha = p.phase === 2 ? 0.5 : 0.3; fillPoly(ctx, [P(0.22, 0.22), P(0.78, 0.22), P(0.78, 0.78), P(0.22, 0.78)], hot); ctx.globalAlpha = 1; }
    const blink = p.phase === 1 ? Math.floor(t * 12) % 2 === 0 : p.phase === 2;
    if (blink) { const l = P(0.12, 0.12, 0.93); ctx.fillStyle = '#ff3a20'; ctx.fillRect(Math.round(l.x) - 2, Math.round(l.y) - 2, 4, 3); ctx.globalAlpha = 0.35; ctx.fillRect(Math.round(l.x) - 3, Math.round(l.y) - 3, 6, 5); ctx.globalAlpha = 1; }
    if (p.phase === 2) {
      const c = P(0.5, 0.5);
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#e8ecf4';
      for (let k = 0; k < 7; k++) { const w = 6 + k * 2 + Math.sin(t * 20 + k) * 2; ctx.fillRect(Math.round(c.x - w / 2), Math.round(c.y - 8 - k * 8), Math.round(w), 9); }
      ctx.globalAlpha = 1;
    }
  },
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z = 0) => proj(ax, ay, x, y, z);
    fillPoly(ctx, [P(0.15, 0.15), P(0.85, 0.15), P(0.85, 0.85), P(0.15, 0.85)], '#2a2c30');
    fillPoly(ctx, [P(0.2, 0.2), P(0.8, 0.2), P(0.8, 0.8), P(0.2, 0.8)], '#0e0e12');
    for (let k = 0; k < 5; k++) { const a = P(0.22 + k * 0.14, 0.2), b = P(0.22 + k * 0.14, 0.8); line(ctx, a.x, a.y, b.x, b.y, '#6a6e76'); }
    const hot = p.phase === 2 ? '#ff8a40' : p.phase === 1 ? '#c04020' : null;
    if (hot) { ctx.globalAlpha = p.phase === 2 ? 0.5 : 0.3; fillPoly(ctx, [P(0.25, 0.25), P(0.75, 0.25), P(0.75, 0.75), P(0.25, 0.75)], hot); ctx.globalAlpha = 1; }
    // warning post with lamp at the back corner
    const b = P(0.12, 0.12), top = P(0.12, 0.12, 0.8);
    thick(ctx, b.x, b.y, top.x, top.y, 3, OL); thick(ctx, b.x, b.y, top.x, top.y, 1, '#d8b020');
    const blink = p.phase === 1 ? Math.floor(t * 12) % 2 === 0 : p.phase === 2;
    ctx.fillStyle = OL; ctx.fillRect(top.x - 3, top.y - 4, 6, 5);
    ctx.fillStyle = blink ? '#ff3a20' : '#5a1a14'; ctx.fillRect(top.x - 2, top.y - 3, 4, 3);
    if (p.phase === 2) { // steam column core
      const c = P(0.5, 0.5);
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#e8ecf4';
      for (let k = 0; k < 7; k++) { const w = 6 + k * 2 + Math.sin(t * 20 + k) * 2; ctx.fillRect(Math.round(c.x - w / 2), Math.round(c.y - 8 - k * 8), Math.round(w), 9); }
      ctx.globalAlpha = 1;
    }
  },
});
// oil drum (breakable)
registerProp('industrial_drum', {
  h: 1.0,
  breakable: { hp: 16, debris: ['#2a4d7a', '#1a1a1e', '#d8b020'], sfx: 'metal', drops: [['coin', 0.4], ['cash5', 0.15]], score: 40 },
  draw(ctx, ax, ay, p) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    const c = p.o.color || '#2a4d7a';
    const H = 20;
    ellipse(ctx, s.x, s.y, 8, 4, OL);
    ctx.fillStyle = OL; ctx.fillRect(s.x - 8, s.y - H, 16, H);
    ctx.fillStyle = c; ctx.fillRect(s.x - 7, s.y - H, 14, H);
    ctx.fillStyle = shade(c, 0.25); ctx.fillRect(s.x - 4, s.y - H, 2, H);
    ctx.fillStyle = shade(c, -0.35); ctx.fillRect(s.x + 4, s.y - H, 3, H);
    ctx.fillStyle = shade(c, -0.5); ctx.fillRect(s.x - 7, s.y - H + 6, 14, 1); ctx.fillRect(s.x - 7, s.y - 7, 14, 1);
    ellipse(ctx, s.x, s.y - 1, 7, 3, c);
    ellipse(ctx, s.x, s.y - H, 8, 4, OL); ellipse(ctx, s.x, s.y - H, 7, 3, shade(c, -0.2));
    ctx.fillStyle = shade(c, -0.45); ctx.fillRect(s.x + 2, s.y - H - 1, 2, 1);
    if (p.o.label !== false) { ctx.fillStyle = '#d8b020'; ctx.fillRect(s.x - 3, s.y - 15, 6, 5); ctx.fillStyle = OL; ctx.fillRect(s.x - 1, s.y - 14, 2, 3); }
  },
});
// pallet stacked with shrink-wrapped boxes (breakable, standable)
registerProp('industrial_palletBoxes', {
  h: 0.9,
  breakable: { hp: 12, debris: ['#a87a48', '#c89a5e', '#b08a50'], sfx: 'wood', drops: [['industrial_tea', 0.2], ['coin', 0.4], ['cash5', 0.15]], score: 40 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 0.9, 0.9, 0.15, { color: '#b08a50', outline: OL });
    const c = p.o.color || '#a87a48';
    isoBox(ctx, ax, ay, 0.1, 0.1, 0.15, 0.8, 0.8, 0.72, { top: shade(c, 0.15), left: c, right: shade(c, -0.3), outline: OL });
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    let a = P(0.1, 0.9, 0.5), b = P(0.9, 0.9, 0.5); line(ctx, a.x, a.y, b.x, b.y, shade(c, -0.35));
    a = P(0.9, 0.1, 0.5); b = P(0.9, 0.9, 0.5); line(ctx, a.x, a.y, b.x, b.y, shade(c, -0.5));
    a = P(0.5, 0.9, 0.85); b = P(0.5, 0.9, 0.2); line(ctx, a.x, a.y, b.x, b.y, '#d8c8a0');
    ctx.globalAlpha = 0.25; isoPanel(ctx, ax, ay, 'left', 0.15, 0.91, 0.3, 0.5, 0.8, '#ffffff'); ctx.globalAlpha = 1;
  },
});
// tyre stack
registerProp('industrial_tyres', {
  h: 0.9,
  breakable: { hp: 20, debris: ['#1a1a1e', '#2a2a30'], sfx: 'wood', drops: [['coin', 0.4]], score: 30 },
  draw(ctx, ax, ay) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    for (let k = 0; k < 4; k++) {
      const y = s.y - k * 5;
      ellipse(ctx, s.x, y, 10, 5, OL); ellipse(ctx, s.x, y - 1, 9, 4, k % 2 ? '#26262a' : '#2e2e34');
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(s.x - 8, y - 2, 4, 1);
    }
    ellipse(ctx, s.x, s.y - 16, 4, 2, '#0a0a0c');
  },
});
// dock mooring bollard
registerProp('industrial_bollard', {
  h: 0.6,
  draw(ctx, ax, ay) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    ellipse(ctx, s.x, s.y, 6, 3, OL); ctx.fillStyle = OL; ctx.fillRect(s.x - 5, s.y - 9, 10, 9);
    ctx.fillStyle = '#26282c'; ctx.fillRect(s.x - 4, s.y - 9, 8, 9);
    ellipse(ctx, s.x, s.y - 10, 7, 3, OL); ellipse(ctx, s.x, s.y - 10, 6, 2, '#3a3e44');
    ctx.fillStyle = '#5a5e66'; ctx.fillRect(s.x - 3, s.y - 8, 1, 6);
  },
});
// hydraulic press at a conveyor end (animated ram)
registerProp('industrial_press', {
  h: 2.4,
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    isoBox(ctx, ax, ay, 0.05, 0.05, 0, 0.9, 0.9, 0.5, { color: '#4a4e56', outline: OL });
    for (const [x, y] of [[0.08, 0.08], [0.78, 0.08], [0.08, 0.78], [0.78, 0.78]]) isoBox(ctx, ax, ay, x, y, 0.5, 0.14, 0.14, 1.7, { color: '#d8b020', outline: OL });
    const ram = 1.35 + Math.max(0, Math.sin(t * 2.4 + p.x)) * 0.55;
    isoBox(ctx, ax, ay, 0.22, 0.22, ram, 0.56, 0.56, 2.15 - ram, { color: '#8a8e96', outline: OL });
    isoBox(ctx, ax, ay, 0.0, 0.0, 2.2, 1, 1, 0.3, { color: '#c8a020', outline: OL });
    const w = P(0.5, 1.0, 2.35); drawText(ctx, '!', w.x, w.y - 3, { color: '#1e1e22', align: 'center' });
    const lamp = P(0.95, 0.5, 2.6); ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff6a20' : '#5a2010'; ctx.fillRect(lamp.x - 1, lamp.y - 2, 3, 3);
  },
});
// boiler tank with gauge and pipes
registerProp('industrial_boiler', {
  h: 2.6,
  draw(ctx, ax, ay, p, t) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    const H = 52, c = p.o.color || '#6a3a2c';
    ellipse(ctx, s.x, s.y, 14, 7, OL);
    ctx.fillStyle = OL; ctx.fillRect(s.x - 14, s.y - H, 28, H);
    ctx.fillStyle = c; ctx.fillRect(s.x - 13, s.y - H, 26, H);
    ctx.fillStyle = shade(c, 0.2); ctx.fillRect(s.x - 8, s.y - H, 3, H);
    ctx.fillStyle = shade(c, -0.35); ctx.fillRect(s.x + 7, s.y - H, 6, H);
    for (const y of [10, 26, 42]) { ctx.fillStyle = shade(c, -0.45); ctx.fillRect(s.x - 13, s.y - y, 26, 2); }
    ellipse(ctx, s.x, s.y - 1, 13, 6, c);
    ellipse(ctx, s.x, s.y - H, 14, 7, OL); ellipse(ctx, s.x, s.y - H, 13, 6, shade(c, 0.1));
    // gauge
    ellipse(ctx, s.x - 3, s.y - 33, 4, 4, OL); ellipse(ctx, s.x - 3, s.y - 33, 3, 3, '#e8e4d8');
    const a = Math.sin(t * 1.7 + p.x) * 1.2 + 0.4; line(ctx, s.x - 3, s.y - 33, s.x - 3 + Math.cos(a) * 3, s.y - 33 - Math.sin(a) * 3, '#c01818');
    // pipe up into the dark
    thick(ctx, s.x + 4, s.y - H - 2, s.x + 4, s.y - H - 26, 5, OL); thick(ctx, s.x + 4, s.y - H - 2, s.x + 4, s.y - H - 26, 3, '#5a5e66');
    if (Math.random() < 0.08) { ctx.fillStyle = 'rgba(220,224,232,0.5)'; ctx.fillRect(s.x + 1, s.y - H - 30 - Math.random() * 6, 6, 3); }
  },
});
// crane release lever (USE it). interact kind 'switch': world sets open=true; the level resets it.
registerProp('industrial_lever', {
  h: 1.1, interact: { kind: 'switch', key: null },
  draw(ctx, ax, ay, p, t) {
    isoBox(ctx, ax, ay, 0.2, 0.25, 0, 0.6, 0.5, 1.0, { color: '#d8b020', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.28, 0.76, 0.44, 0.5, 0.85, '#2a2a2e');
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const b = P(0.5, 0.5, 1.0);
    const pulled = (p.coolT || 0) > 0;
    const ang = pulled ? 0.9 : -0.5;
    const e = { x: b.x + Math.sin(ang) * 10, y: b.y - Math.cos(ang) * 10 };
    thick(ctx, b.x, b.y, e.x, e.y, 3, OL); thick(ctx, b.x, b.y, e.x, e.y, 1, '#c8ccd0');
    ellipse(ctx, e.x, e.y, 3, 3, OL); ellipse(ctx, e.x, e.y, 2, 2, '#c01818');
    const l = P(0.5, 0.76, 0.95);
    ctx.fillStyle = pulled ? '#5a1a14' : (Math.floor(t * 3) % 2 ? '#3aff7a' : '#1a6a3a'); ctx.fillRect(l.x - 1, l.y - 2, 3, 2);
  },
});
// wire cage with valuables inside; only the crane load can smash it (level code removes it)
registerProp('industrial_cage', {
  h: 2.0, depthBias: 0.05,
  draw(ctx, ax, ay) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const zt = 1.9;
    fillPoly(ctx, [P(0.05, 0.05, 0.02), P(0.95, 0.05, 0.02), P(0.95, 0.95, 0.02), P(0.05, 0.95, 0.02)], '#2a2c30');
    const mesh = (a, b) => {
      for (let k = 0; k <= 8; k++) { const u = k / 8; const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u; line(ctx, x, y, x, y - zt * Z_PX, k % 4 === 0 ? OL : '#8a9098'); }
      for (const z of [0.05, 0.6, 1.2, zt]) line(ctx, a.x, a.y - z * Z_PX, b.x, b.y - z * Z_PX, '#6a7078');
    };
    mesh(P(0.05, 0.95, 0), P(0.95, 0.95, 0));
    mesh(P(0.95, 0.95, 0), P(0.95, 0.05, 0));
    fillPoly(ctx, [P(0.05, 0.05, zt), P(0.95, 0.05, zt), P(0.95, 0.95, zt), P(0.05, 0.95, zt)], '#4a4e56');
    const lk = P(0.5, 0.95, 1.0); ctx.fillStyle = OL; ctx.fillRect(lk.x - 3, lk.y - 3, 6, 6); ctx.fillStyle = '#e8c040'; ctx.fillRect(lk.x - 2, lk.y - 2, 4, 4);
    const s = P(0.5, 0.95, 1.55); drawText(ctx, 'PRIVATE', s.x, s.y - 3, { color: '#ff4a3a', align: 'center', outline: OL });
  },
});
// invisible collision block (keeps the floor height inside a fake wall at mezzanine level)
registerProp('industrial_invis', { h: 1.2, draw() {} });
// office bits
// office furniture: def h 0 (pass h in the placement); opts z lifts it onto the mezzanine
registerProp('industrial_desk', {
  h: 0,
  breakable: { hp: 22, debris: ['#6a5a40', '#3a3e46', '#d8d4c8'], sfx: 'wood', drops: [['cash5', 0.6], ['industrial_tea', 0.3]], score: 60 },
  draw(ctx, ax, ay, p, t) {
    ay -= (p.o.z || 0) * Z_PX;
    isoBox(ctx, ax, ay, 0.1, 0.15, 0, 0.8, 0.7, 0.75, { color: '#6a5a40', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.55, 0.86, 0.3, 0.1, 0.65, '#4a3e2c');
    isoBox(ctx, ax, ay, 0.25, 0.25, 0.75, 0.35, 0.35, 0.4, { color: '#c8c0a8', outline: OL });   // CRT monitor
    isoPanel(ctx, ax, ay, 'left', 0.28, 0.61, 0.28, 0.8, 1.1, Math.floor(t * 2) % 7 ? '#2a6a4a' : '#3aff7a');
    isoBox(ctx, ax, ay, 0.62, 0.55, 0.75, 0.18, 0.25, 0.02, { color: '#f0ece0' });              // papers
    const m = proj(ax, ay, 0.75, 0.3, 0.75); ctx.fillStyle = OL; ctx.fillRect(m.x - 2, m.y - 5, 5, 6); ctx.fillStyle = '#c8102e'; ctx.fillRect(m.x - 1, m.y - 4, 3, 4);
  },
});
registerProp('industrial_cabinet', {
  h: 0,
  draw(ctx, ax, ay, p) {
    ay -= (p.o.z || 0) * Z_PX;
    isoBox(ctx, ax, ay, 0.2, 0.2, 0, 0.6, 0.6, 1.6, { color: '#6a7078', outline: OL });
    for (let k = 0; k < 4; k++) { isoPanel(ctx, ax, ay, 'left', 0.25, 0.81, 0.5, 0.1 + k * 0.38, 0.42 + k * 0.38, '#5a6068'); const h = proj(ax, ay, 0.5, 0.81, 0.3 + k * 0.38); ctx.fillStyle = '#c8ccd0'; ctx.fillRect(h.x - 2, h.y - 1, 4, 1); }
  },
});
registerProp('industrial_workbench', {
  h: 0.85,
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.05, 0.15, 0, 0.1, 0.1, 0.8, { color: '#3a3e46' });
    isoBox(ctx, ax, ay, 0.85, 0.75, 0, 0.1, 0.1, 0.8, { color: '#3a3e46' });
    isoBox(ctx, ax, ay, 0.0, 0.1, 0.8, 1.0, 0.8, 0.08, { color: '#8a6a40', outline: OL });
    isoBox(ctx, ax, ay, 0.15, 0.25, 0.88, 0.25, 0.2, 0.15, { color: '#c01818', outline: OL });   // toolbox
    const v = proj(ax, ay, 0.7, 0.5, 0.95); ctx.fillStyle = OL; ctx.fillRect(v.x - 4, v.y - 3, 8, 4); ctx.fillStyle = '#4a6a9a'; ctx.fillRect(v.x - 3, v.y - 2, 6, 2);  // vice
  },
});
// sliding dock gate panel (1 tile; opts dir 'y'|'x', key, group). Opens with interact; level opens the whole group.
registerProp('industrial_gate', {
  h: 3, interact: { kind: 'gate', key: null },
  draw(ctx, ax, ay, p, t) {
    if (p.open) return;
    const alongX = p.o.dir === 'x';
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const a = alongX ? P(0, 0.5, 0) : P(0.5, 0, 0), b = alongX ? P(1, 0.5, 0) : P(0.5, 1, 0);
    const zt = 2.5 * Z_PX;
    // mesh infill
    const steps = 10;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
      line(ctx, x, y - 3, x, y - zt + 3, k % 5 === 0 ? OL : '#7a8088');
    }
    for (let k = 1; k < 10; k++) line(ctx, a.x, a.y - k * zt / 10, b.x, b.y - k * zt / 10, '#5a6068');
    // frame
    for (const z of [0, zt]) { thick(ctx, a.x, a.y - z, b.x, b.y - z, 3, OL); thick(ctx, a.x, a.y - z, b.x, b.y - z, 1, z ? '#d8b020' : '#8a929c'); }
    thick(ctx, a.x, a.y, a.x, a.y - zt, 3, OL); thick(ctx, b.x, b.y, b.x, b.y - zt, 3, OL);
    // hazard band + sign
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - zt * 0.55 };
    if (p.o.sign !== false) {
      ctx.fillStyle = OL; ctx.fillRect(m.x - 9, m.y - 6, 18, 11);
      ctx.fillStyle = '#e8e4d8'; ctx.fillRect(m.x - 8, m.y - 5, 16, 9);
      ctx.fillStyle = '#c01818'; ctx.fillRect(m.x - 6, m.y - 3, 12, 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(m.x - 4, m.y - 1, 8, 1);
    }
    if (Math.floor(t * 2) % 2) { const q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - zt * 0.25 }; ctx.fillStyle = '#ff3030'; ctx.fillRect(q.x - 1, q.y - 1, 3, 3); }
  },
});
// overhead stencil/hanging sign helper for the quay & yard: a free-standing post sign
registerProp('industrial_postSign', {
  h: 0.4,
  draw(ctx, ax, ay, p) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    thick(ctx, b.x - 7, b.y, b.x - 7, b.y - 30, 2, OL); thick(ctx, b.x + 7, b.y, b.x + 7, b.y - 30, 2, OL);
    const w = Math.max(24, (p.o.text || '').length * 7 + 8);
    ctx.fillStyle = OL; ctx.fillRect(b.x - w / 2 - 1, b.y - 44, w + 2, 15);
    ctx.fillStyle = p.o.bg || '#d8b020'; ctx.fillRect(b.x - w / 2, b.y - 43, w, 13);
    drawText(ctx, p.o.text || 'DANGER', b.x, b.y - 40, { color: p.o.color || '#1a1a1e', align: 'center' });
  },
});

// ================================================================== items
const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
registerItem('industrial_tea', {
  name: 'MUG OF BUILDERS TEA', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 4, y - 9, 8, 9); px(ctx, '#e8e4d8', x - 3, y - 8, 6, 7); px(ctx, '#c8102e', x - 3, y - 6, 6, 2);
    px(ctx, '#8a5a2a', x - 3, y - 8, 6, 1); px(ctx, OL, x + 3, y - 7, 3, 4); px(ctx, '#e8e4d8', x + 4, y - 6, 1, 2);
    if (Math.floor(t * 3) % 2) px(ctx, '#c8ccd4', x - 1, y - 12, 1, 2); else px(ctx, '#c8ccd4', x + 1, y - 13, 1, 2);
  },
});
registerItem('industrial_pass', {
  name: 'GATE PASS', kind: 'key', keyId: 'industrial_pass', score: 150, auto: true,
  icon(ctx, x, y, t) {
    const b = Math.round(Math.sin(t * 4));
    px(ctx, OL, x - 6, y - 10 + b, 12, 9); px(ctx, '#e8e4d8', x - 5, y - 9 + b, 10, 7);
    px(ctx, '#2a4a8a', x - 5, y - 9 + b, 10, 2); px(ctx, '#d4a070', x - 4, y - 6 + b, 3, 3);
    px(ctx, '#504840', x, y - 6 + b, 4, 1); px(ctx, '#504840', x, y - 4 + b, 3, 1);
    px(ctx, '#c8102e', x - 1, y - 12 + b, 2, 3);
  },
});
function heldBar(len, w, color, head) {
  return (ctx, hx, hy, ang, s = 1, flash) => {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const bx = hx - dx * 2 * s, by = hy - dy * 2 * s, ex = hx + dx * len * s, ey = hy + dy * len * s;
    thick(ctx, bx, by, ex, ey, w + 2, OL); thick(ctx, bx, by, ex, ey, w, flash ? '#fff' : color);
    if (head) head(ctx, ex, ey, dx, dy, s, flash);
  };
}
const wrenchHead = (ctx, ex, ey, dx, dy, s, flash) => {
  const r = 4 * s, nx = -dy, ny = dx;
  ellipse(ctx, ex, ey, r + 1, r + 1, OL); ellipse(ctx, ex, ey, r, r, flash ? '#fff' : '#9aa0a8');
  const j = { x: ex + dx * r * 0.6, y: ey + dy * r * 0.6 };
  ellipse(ctx, j.x, j.y, r * 0.55, r * 0.55, OL);
  px(ctx, '#c8ccd0', ex + nx * r * 0.6 - 1, ey + ny * r * 0.6 - 1, 2, 2);
};
registerItem('industrial_wrench', {
  name: 'GIANT WRENCH', kind: 'weapon', score: 0,
  weapon: { dmg: 17, reach: 1.6, durability: 12, attack: 'industrial_wrenchSwing', knockdown: true, throwDmg: 20, breaks: 'metal' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 8, y - 5, 14, 4); px(ctx, '#7a828c', x - 7, y - 4, 12, 2); px(ctx, '#a8b0b8', x - 7, y - 4, 12, 1);
    ellipse(ctx, x + 6, y - 3, 4, 4, OL); ellipse(ctx, x + 6, y - 3, 3, 3, '#9aa0a8'); px(ctx, OL, x + 7, y - 4, 3, 2);
  },
  drawHeld: heldBar(15, 3, '#7a828c', wrenchHead),
});
registerItem('industrial_spanner', {
  name: 'SPANNER', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.35, durability: 8, attack: 'swing', throwDmg: 14, breaks: 'metal' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 6, y - 4, 10, 3); px(ctx, '#a8b0b8', x - 5, y - 3, 8, 1);
    ellipse(ctx, x + 5, y - 3, 3, 3, OL); ellipse(ctx, x + 5, y - 3, 2, 2, '#a8b0b8'); px(ctx, OL, x + 6, y - 4, 2, 2);
  },
  drawHeld: heldBar(9, 2, '#a8b0b8', (ctx, ex, ey) => { ellipse(ctx, ex, ey, 3, 3, OL); ellipse(ctx, ex, ey, 2, 2, '#c8ccd0'); }),
});
registerItem('industrial_pole', {
  name: 'SCAFFOLD POLE', kind: 'weapon', score: 0,
  weapon: { dmg: 11, reach: 1.95, durability: 6, attack: 'thrust', throwDmg: 12, breaks: 'metal' },
  icon(ctx, x, y) { px(ctx, OL, x - 9, y - 4, 18, 3); px(ctx, '#9aa0a8', x - 8, y - 3, 16, 1); px(ctx, '#d8b020', x + 5, y - 4, 2, 3); },
  drawHeld: heldBar(20, 2, '#9aa0a8', (ctx, ex, ey) => px(ctx, '#d8b020', ex - 1, ey - 1, 3, 3)),
});
registerItem('industrial_torch', {
  name: 'RUBBER TORCH', kind: 'weapon', score: 0,
  weapon: { dmg: 10, reach: 1.3, durability: 5, attack: 'swing', throwDmg: 11, breaks: 'glass' },
  icon(ctx, x, y) { px(ctx, OL, x - 6, y - 5, 12, 4); px(ctx, '#1a1a1e', x - 5, y - 4, 9, 2); px(ctx, '#fff2a0', x + 4, y - 4, 1, 2); },
  drawHeld: heldBar(9, 3, '#1e1e24', (ctx, ex, ey, dx, dy) => { px(ctx, '#fff2a0', ex - 1, ey - 1, 3, 3); }),
});
registerItem('industrial_crate', {
  name: 'TEA CHEST', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.3, durability: 2, attack: 'swing', knockdown: true, throwDmg: 15, breaks: 'wood' },
  icon(ctx, x, y) { px(ctx, OL, x - 6, y - 10, 12, 10); px(ctx, '#a87a48', x - 5, y - 9, 10, 8); px(ctx, '#6e4a28', x - 5, y - 6, 10, 1); px(ctx, '#6e4a28', x - 1, y - 9, 1, 8); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    px(ctx, OL, hx - 6, hy - 6, 12, 11); px(ctx, flash ? '#fff' : '#a87a48', hx - 5, hy - 5, 10, 9);
    px(ctx, '#6e4a28', hx - 5, hy - 1, 10, 1); px(ctx, '#6e4a28', hx - 1, hy - 5, 1, 9);
  },
});
registerItem('industrial_barrel', { // only used as the foreman's thrown projectile
  name: 'OIL DRUM', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.2, durability: 1, attack: 'swing', knockdown: true, throwDmg: 18, breaks: 'metal' },
  icon(ctx, x, y) { px(ctx, OL, x - 5, y - 12, 10, 12); px(ctx, '#2a4d7a', x - 4, y - 11, 8, 10); px(ctx, '#1a2a4a', x - 4, y - 8, 8, 1); px(ctx, '#1a2a4a', x - 4, y - 4, 8, 1); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    ctx.save(); ctx.translate(Math.round(hx), Math.round(hy)); ctx.rotate(ang);
    px(ctx, OL, -6, -8, 12, 16); px(ctx, flash ? '#fff' : '#2a4d7a', -5, -7, 10, 14);
    px(ctx, '#1a2a4a', -5, -3, 10, 1); px(ctx, '#1a2a4a', -5, 3, 10, 1); px(ctx, '#d8b020', -2, -1, 4, 3);
    ctx.restore();
  },
});
