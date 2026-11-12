// Floor & wall style registries + tile sprite painting.
//
// FLOOR style: registerFloor(id, { pixel(u, v, tx, ty, r) -> '#rrggbb' })
//   u,v in [0,1): position inside the tile along world x / world y. r = per-tile random [0,1).
//   Optional: decal(ctx, sx, sy, tx, ty, r) to draw extra ground details after the pixel pass
//   (sx,sy = screen position of the tile's NORTH corner in the floor canvas).
//
// WALL style: registerWall(id, {
//    top: '#hex' | fn(u, v, variant, hUnits, r) -> hex,
//    face(u, py, side, Hpx, r, variant, hUnits) -> '#hex' | null
//         u in [0,1) along the face (left->right on screen), py = pixel row from the TOP of the face (0..Hpx-1),
//         Hpx = face height in px (= hUnits * Z_PX), side 'left' (SW face, along +y edge) | 'right' (SE face, along +x edge)
//         Convention: right faces are darker than left faces (light comes from the upper-left).
//    variants: n (number of cached random variants; default 4; a tile picks variant = hash of its position)
//    post(g, Hpx, r, variant): optional extra drawing on the cached sprite canvas (canvas is 32 x (16+Hpx);
//         the top diamond occupies y 0..16, left face top edge runs (0,8)->(16,16), right face (16,16)->(32,8))
// })
// Wall sprites are cached per (style, height, variant). Draw with drawWallBlock().

import { TILE_W, TILE_H, HALF_W, HALF_H, Z_PX } from './constants.js';
import { hexToRgb } from './color.js';
import { hash2 } from './rng.js';
import { makeCanvas } from './gfx.js';
import { envWall, envFloor } from './envsprites.js';

export const FLOORS = {};
export const WALLS = {};

export function registerFloor(id, def) { FLOORS[id] = def; }
export function registerWall(id, def) { WALLS[id] = def; }

// ---- floor canvas -------------------------------------------------------------------------
// Pre-renders the whole ground layer for a tilemap. Returns { canvas, ox, oy } where the canvas
// pixel (px,py) corresponds to screen point (px - ox, py - oy) before camera translation.
export const FLOOR_SCALE = 2;   // floor canvas is baked at 2x the logical resolution
export function renderFloor(map) {
  const W = map.w, H = map.h, K = FLOOR_SCALE;
  const ox = H * HALF_W;              // logical x offset so that the leftmost tile corner is at 0
  const oy = 0;
  const cw = (W + H) * HALF_W, ch = (W + H) * HALF_H + TILE_H;
  const canvas = makeCanvas(cw * K, ch * K);
  const g = canvas.getContext('2d');
  const img = g.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const CW = canvas.width;
  // iterate canvas pixels and resolve which tile they belong to
  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < CW; px++) {
      const a = ((px + 0.5) / K - ox) / HALF_W, b = ((py + 0.5) / K - oy) / HALF_H;
      const wx = (a + b) / 2, wy = (b - a) / 2;
      const tx = Math.floor(wx), ty = Math.floor(wy);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const fid = map.floor[ty * W + tx];
      if (!fid) continue;
      const i = (py * CW + px) * 4;
      const env = envFloor(fid);
      if (env) {
        // sample the Blender-rendered patch at the same world position (patches tile seamlessly every n tiles)
        const n = env.n;
        const ii = (((tx % n) + n) % n) + (wx - tx), jj = (((ty % n) + n) % n) + (wy - ty);
        const sx = Math.floor(env.w / 2 + (ii - jj) * HALF_W * K), sy = Math.floor((ii + jj) * HALF_H * K);
        if (sx >= 0 && sy >= 0 && sx < env.w && sy < env.h) {
          const si = (sy * env.w + sx) * 4;
          if (env.data[si + 3] > 0) { data[i] = env.data[si]; data[i + 1] = env.data[si + 1]; data[i + 2] = env.data[si + 2]; data[i + 3] = 255; continue; }
        }
      }
      const def = FLOORS[fid] || FLOORS.void;
      if (!def) continue;
      const r = hash2(tx, ty, 7);
      const col = def.pixel(wx - tx, wy - ty, tx, ty, r);
      if (!col) continue;
      const rgb = hexToRgb(col);
      data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // decals (drawn in logical coordinates)
  g.setTransform(K, 0, 0, K, 0, 0);
  g.imageSmoothingEnabled = false;
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const fid = map.floor[ty * W + tx];
    const def = fid && FLOORS[fid];
    if (def && def.decal) def.decal(g, ox + (tx - ty) * HALF_W, oy + (tx + ty) * HALF_H, tx, ty, hash2(tx, ty, 11));
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, ox, oy, scale: K, w: cw, h: ch };
}

// ---- wall sprites -------------------------------------------------------------------------
const wallCache = new Map();

function colorOf(c, ...args) { return typeof c === 'function' ? c(...args) : c; }

export function wallSprite(styleId, h, variant = 0) {
  const def = WALLS[styleId] || WALLS.default;
  const nv = def.variants || 4;
  const v = ((variant % nv) + nv) % nv;
  const key = styleId + '|' + h + '|' + v;
  let spr = wallCache.get(key);
  if (spr) return spr;
  const Hpx = Math.round(h * Z_PX);
  const c = makeCanvas(TILE_W, TILE_H + Hpx);
  const g = c.getContext('2d');
  const img = g.createImageData(c.width, c.height);
  const d = img.data;
  const r = hash2(v, h, 3);
  const put = (x, y, col) => {
    if (!col) return;
    const rgb = hexToRgb(col);
    const i = (y * c.width + x) * 4;
    d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
  };
  // faces: left face spans x in [0,16), its top edge goes from (0,8) to (16,16)
  for (let x = 0; x < TILE_W; x++) {
    const left = x < HALF_W;
    const u = left ? x / HALF_W : (x - HALF_W) / HALF_W;
    const topY = left ? HALF_H + x / 2 : TILE_H - (x - HALF_W) / 2;
    for (let vy = 0; vy < Hpx; vy++) {
      const y = Math.floor(topY + vy);
      if (y < 0 || y >= c.height) continue;
      const col = def.face(u, vy, left ? 'left' : 'right', Hpx, r, v, h);
      put(x, y, col);
    }
  }
  // top diamond
  for (let y = 0; y < TILE_H; y++) for (let x = 0; x < TILE_W; x++) {
    const a = (x + 0.5 - HALF_W) / HALF_W, b = (y + 0.5) / HALF_H;
    const u = (a + b) / 2, w = (b - a) / 2;
    if (u < 0 || w < 0 || u >= 1 || w >= 1) continue;
    put(x, y, colorOf(def.top, u, w, v, h, r));
  }
  g.putImageData(img, 0, 0);
  if (def.post) def.post(g, Hpx, r, v);
  spr = { canvas: c, h: Hpx };
  wallCache.set(key, spr);
  return spr;
}

// Draw a wall block whose tile is (tx,ty), given camera-adjusted screen coordinates of the tile's north corner.
export function drawWallBlock(ctx, styleId, h, variant, sxN, syN, alpha = 1) {
  const prev = ctx.globalAlpha;
  if (alpha < 1) ctx.globalAlpha = prev * alpha;
  const env = envWall(styleId, h, variant);
  if (env) {
    // Blender sprite at 2x: north corner at (32 + padX, extraTop) of the image
    const im = env.img;
    ctx.drawImage(im, Math.round(sxN) - (32 + env.padX) / 2, Math.round(syN - h * Z_PX) - env.extraTop / 2, im.width / 2, im.height / 2);
  } else {
    const spr = wallSprite(styleId, h, variant);
    ctx.drawImage(spr.canvas, Math.round(sxN - HALF_W), Math.round(syN - spr.h));
  }
  ctx.globalAlpha = prev;
}

// ---- built-in fallback styles ------------------------------------------------------------
registerFloor('void', { pixel: () => '#05040a' });
registerWall('default', {
  top: '#77707a',
  face: (u, v, side) => (side === 'left' ? '#4b4650' : '#35313a'),
});
