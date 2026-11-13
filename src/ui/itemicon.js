// Item icons in the UI (kit bag, HUD slots, "in your hand"): the 3D-rendered icon (render3d/itemicons.js, set on
// r3d.itemIcon by main.js) fitted into a box, or false so the caller draws the old pixel icon (2D game / no build).
import { r3d } from '../render3d/index.js';

export function drawItemIcon(ctx, def, x, y, w, h) {
  const c = r3d.itemIcon && def ? r3d.itemIcon(def) : null;
  if (!c) return false;
  const s = Math.min(w, h);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, x + (w - s) / 2, y + (h - s) / 2, s, s);
  ctx.restore();
  return true;
}
