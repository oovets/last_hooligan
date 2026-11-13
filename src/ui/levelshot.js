// The level select's pictures: a 3D shot of each level, rendered from the game itself (assets/levelshots/<id>.jpg,
// made in the dev build: the busiest part of the map, the 3D renderer at zoom 0.6, brightened a little).
// drawLevelShot(ctx, level, x, y, w, h, opts) -> false while it loads / for a level without one (callers fall back to
// the map preview). opts: { alpha, zoom (1 = cover the box; a little more slowly pushes in), t }
const shots = new Map();
function shot(id) {
  if (!id || typeof Image === 'undefined') return null;
  let im = shots.get(id);
  if (!im) { im = new Image(); im.src = new URL('../../assets/levelshots/' + id + '.jpg', import.meta.url).href; shots.set(id, im); }
  return im.complete && im.naturalWidth ? im : null;
}
export function drawLevelShot(ctx, level, x, y, w, h, opts = {}) {
  const im = shot(level && level.id);
  if (!im) return false;
  const z = opts.zoom || 1;
  const k = Math.max(w / im.naturalWidth, h / im.naturalHeight) * z;
  const sw = w / k, sh = h / k, sx = (im.naturalWidth - sw) / 2, sy = (im.naturalHeight - sh) / 2;
  ctx.save();
  ctx.globalAlpha *= opts.alpha ?? 1;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  // a little shade at the bottom so the card's edge reads
  const g = ctx.createLinearGradient(0, y + h * 0.6, 0, y + h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  return true;
}
