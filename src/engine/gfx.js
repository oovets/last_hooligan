// Low-level crisp pixel drawing helpers + iso box painter.
import { HALF_W, HALF_H, Z_PX } from './constants.js';
import { shade } from './color.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

// Scanline fill of a convex polygon with hard pixel edges (no anti-aliasing).
export function fillPoly(ctx, pts, color) {
  if (!pts.length) return;
  ctx.fillStyle = color;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  minY = Math.round(minY); maxY = Math.round(maxY);
  const n = pts.length;
  for (let y = minY; y < maxY; y++) {
    const yc = y + 0.5;
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
        const x = a.x + (yc - a.y) / (b.y - a.y) * (b.x - a.x);
        if (x < x0) x0 = x; if (x > x1) x1 = x;
      }
    }
    if (x1 > x0) ctx.fillRect(Math.round(x0), y, Math.round(x1) - Math.round(x0), 1);
  }
}

// 1px pixel line (Bresenham).
export function line(ctx, x0, y0, x1, y1, color) {
  ctx.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sxs = x0 < x1 ? 1 : -1, sys = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 2000; i++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sxs; }
    if (e2 <= dx) { err += dx; y0 += sys; }
  }
}

// Thick pixel "limb" from (x0,y0) to (x1,y1) with width w.
export function thick(ctx, x0, y0, x1, y1, w, color) {
  ctx.fillStyle = color;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len * 2));
  const h = w / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t - h), Math.round(y0 + (y1 - y0) * t - h), w, w);
  }
}

// Filled pixel ellipse.
export function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

export function shadow(ctx, cx, cy, rx = 9, ry = 4, alpha = 0.35) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * alpha;
  ellipse(ctx, cx, cy, rx, ry, '#000000');
  ctx.globalAlpha = a;
}

// Project local prop coordinates (tiles, relative to anchor) to screen px relative to anchor screen pos.
export function proj(ax, ay, x, y, z = 0) {
  return { x: ax + (x - y) * HALF_W, y: ay + (x + y) * HALF_H - z * Z_PX };
}

// Draw an iso box. (ax,ay) = screen position of the prop's anchor (the world point (prop.x, prop.y) — a tile's north corner).
// Box occupies local [x, x+w] x [y, y+d] x [z, z+h] (tile/height units).
// colors: { top, left, right, outline } (left = face along +y edge (SW-facing), right = face along +x edge (SE-facing)).
// If only `color` given, faces are shaded automatically.
export function isoBox(ctx, ax, ay, x, y, z, w, d, h, colors) {
  const base = colors.color || '#888888';
  const top = colors.top || shade(base, 0.15);
  const left = colors.left || shade(base, -0.15);
  const right = colors.right || shade(base, -0.35);
  const P = (px, py, pz) => proj(ax, ay, px, py, pz);
  const t0 = P(x, y, z + h), t1 = P(x + w, y, z + h), t2 = P(x + w, y + d, z + h), t3 = P(x, y + d, z + h);
  const b1 = P(x + w, y, z), b2 = P(x + w, y + d, z), b3 = P(x, y + d, z);
  if (h > 0) {
    fillPoly(ctx, [t3, t2, b2, b3], left);   // +y face
    fillPoly(ctx, [t2, t1, b1, b2], right);  // +x face
  }
  fillPoly(ctx, [t0, t1, t2, t3], top);
  if (colors.outline) {
    line(ctx, t0.x, t0.y, t1.x, t1.y, colors.outline);
    line(ctx, t1.x, t1.y, t2.x, t2.y, colors.outline);
    line(ctx, t2.x, t2.y, t3.x, t3.y, colors.outline);
    line(ctx, t3.x, t3.y, t0.x, t0.y, colors.outline);
    if (h > 0) {
      line(ctx, t3.x, t3.y, b3.x, b3.y, colors.outline);
      line(ctx, t2.x, t2.y, b2.x, b2.y, colors.outline);
      line(ctx, t1.x, t1.y, b1.x, b1.y, colors.outline);
      line(ctx, b3.x, b3.y, b2.x, b2.y, colors.outline);
      line(ctx, b2.x, b2.y, b1.x, b1.y, colors.outline);
    }
  }
  return { t0, t1, t2, t3, b1, b2, b3 };
}

// Iso flat quad on the ground (or at height z).
export function isoQuad(ctx, ax, ay, x, y, z, w, d, color) {
  const P = (px, py) => proj(ax, ay, px, py, z);
  fillPoly(ctx, [P(x, y), P(x + w, y), P(x + w, y + d), P(x, y + d)], color);
}

// Vertical billboard-ish panel drawn on the +y (left/SW) face plane or +x (right/SE) face plane.
// Useful for signs. side: 'left' | 'right'. Covers local edge from (x,y) along the face for `len` tiles, from z0 to z1.
export function isoPanel(ctx, ax, ay, side, x, y, len, z0, z1, color) {
  const P = (px, py, pz) => proj(ax, ay, px, py, pz);
  let a, b;
  if (side === 'left') { a = { x, y }; b = { x: x + len, y }; }
  else { a = { x, y }; b = { x, y: y + len }; }
  fillPoly(ctx, [P(a.x, a.y, z1), P(b.x, b.y, z1), P(b.x, b.y, z0), P(a.x, a.y, z0)], color);
}
