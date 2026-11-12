import { HALF_W, HALF_H, Z_PX } from './constants.js';

// World (x,y in tiles, z in height units) -> screen px (before camera offset).
// The tile (tx,ty) occupies world [tx,tx+1)x[ty,ty+1); its NORTH corner projects to toScreen(tx,ty).
export function toScreen(x, y, z = 0) {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H - z * Z_PX };
}
export function sx(x, y) { return (x - y) * HALF_W; }
export function sy(x, y, z = 0) { return (x + y) * HALF_H - z * Z_PX; }

// Screen px (ground plane) -> world tiles.
export function toWorld(px, py) {
  const a = px / HALF_W, b = py / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// Convert a screen-space input direction (x right, y down) into a normalized world direction.
export function screenDirToWorld(ix, iy) {
  if (!ix && !iy) return { x: 0, y: 0 };
  // inverse of the projection with HALF_W=2*HALF_H: screen right = world (+1,-1), screen down = world (+1,+1)
  const wx = ix * 0.5 + iy;
  const wy = -ix * 0.5 + iy;
  const l = Math.hypot(wx, wy) || 1;
  return { x: wx / l, y: wy / l };
}

// World direction -> screen direction (not normalized).
export function worldDirToScreen(dx, dy) {
  return { x: (dx - dy) * HALF_W, y: (dx + dy) * HALF_H };
}

// Depth key for painter's sort: larger = drawn later (closer to camera).
export function depthOf(x, y) { return x + y; }
