// Iso-projected minimap built from a level's tile map (walls/floors), with fog of war.
//   mapImage(levelOrWorldMap)          cached base image (2px per tile column, matches the game's iso view)
//   levelThumb(level)                  base image for a level definition (level select / intro card)
//   Minimap: per-world explored mask + draw(ctx, world, x, y, w, h, opts)
// Tile (tx,ty) lands at mini (mx,my) = ((tx - ty) * 2 + H * 2, tx + ty), drawn as a 4x1 row (seamless lattice).
import { makeCanvas } from '../engine/gfx.js';
import { TileMap } from '../engine/tilemap.js';

const SC = 2;
const baseCache = new Map();

function floorColor(id) {
  if (!id) return null;
  const s = String(id).toLowerCase();
  if (s.includes('water')) return '#1c3e72';
  if (s.includes('grass') || s.includes('pitch')) return '#1f4a28';
  if (s.includes('road') || s.includes('asphalt') || s.includes('zebra')) return '#262236';
  if (s.includes('rail') || s.includes('platform')) return '#3a3040';
  if (s.includes('wood') || s.includes('carpet')) return '#3e2a26';
  if (s.includes('terrace')) return '#34303e';
  return '#302c40';
}
function wallColor(w) {
  const s = String(w.style).toLowerCase();
  if (w.fake) return null; // secret walls look like floor on the map... until found
  if (s.includes('hedge') || s.includes('tree')) return w.h > 1.5 ? '#3a6a3a' : '#2e5a30';
  if (w.h <= 1.5) return '#6a5a7e';
  if (w.h <= 3) return '#9a8ab0';
  return '#c8bcd8';
}

export function mapImage(map, key) {
  if (key && baseCache.has(key)) return baseCache.get(key);
  const W = map.w, H = map.h;
  const cw = (W + H) * SC + 4, ch = W + H + 4;
  const c = makeCanvas(cw, ch);
  const g = c.getContext('2d');
  // floors
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const i = ty * W + tx;
    const f = map.floor[i];
    if (!f) continue;
    const mx = (tx - ty) * SC + H * SC, my = tx + ty + 2;
    const w = map.wall[i];
    let col = floorColor(f);
    if (w && !w.fake) col = '#0e0a14';
    g.fillStyle = col; g.fillRect(mx, my, SC * 2, 1);
  }
  // walls (raised a pixel when tall, with a dark base)
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const i = ty * W + tx;
    const w = map.wall[i];
    if (!w || !map.floor[i]) continue;
    const col = wallColor(w);
    if (!col) continue;
    const mx = (tx - ty) * SC + H * SC, my = tx + ty + 2;
    const lift = w.h >= 2.5 ? 1 : 0;
    g.fillStyle = col; g.fillRect(mx, my - lift, SC * 2, 1);
    if (lift) { g.fillStyle = '#4a3e5a'; g.fillRect(mx, my, SC * 2, 1); }
  }
  const out = { canvas: c, W, H, ox: H * SC + SC, oy: 1 };
  if (key) baseCache.set(key, out);
  return out;
}

// world tile coords -> mini px (float)
export function miniPos(img, x, y) { return { x: (x - y) * SC + img.ox, y: x + y + img.oy }; }

export function levelThumb(level) {
  const key = 'lvl:' + level.id;
  if (baseCache.has(key)) return baseCache.get(key);
  let map;
  try { map = new TileMap(level); } catch (e) { return null; }
  return mapImage(map, key);
}

// Draw a base image scaled to fit a box, centred (nearest-neighbour).
export function drawFit(ctx, img, x, y, w, h, alpha = 1) {
  if (!img) return;
  const c = img.canvas || img;
  const k = Math.min(w / c.width, h / c.height);
  const dw = Math.max(1, Math.floor(c.width * k)), dh = Math.max(1, Math.floor(c.height * k));
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(c, Math.round(x + (w - dw) / 2), Math.round(y + (h - dh) / 2), dw, dh);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = prev;
  return { k, x: Math.round(x + (w - dw) / 2), y: Math.round(y + (h - dh) / 2) };
}

const REVEAL_R = 9; // tiles

export class Minimap {
  constructor(world) {
    this.world = world;
    this.base = mapImage(world.map, null);
    const c = this.base.canvas;
    this.mask = makeCanvas(c.width, c.height);
    this.comp = makeCanvas(c.width, c.height);
    this.lastTile = -1;
    this.dirty = true;
    this.revealT = 0;
  }

  reveal(x, y, r = REVEAL_R) {
    const g = this.mask.getContext('2d');
    const p = miniPos(this.base, x, y);
    g.fillStyle = '#fff';
    // iso circle -> ellipse 2:1 in mini space
    g.beginPath();
    g.ellipse(p.x, p.y, r * SC * 1.42, r * 1.42, 0, 0, Math.PI * 2);
    g.fill();
    this.dirty = true;
  }

  revealAll() {
    const g = this.mask.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, this.mask.width, this.mask.height);
    this.dirty = true;
  }

  update() {
    const p = this.world.player;
    if (!p) return;
    const tile = Math.floor(p.x) * 1000 + Math.floor(p.y);
    if (tile !== this.lastTile) { this.lastTile = tile; this.reveal(p.x, p.y); }
    if (this.dirty) {
      const g = this.comp.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, this.comp.width, this.comp.height);
      g.drawImage(this.base.canvas, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(this.mask, 0, 0);
      g.globalCompositeOperation = 'source-over';
      this.dirty = false;
    }
  }

  // Draw a window of the map centred on the player. opts: { full: fit whole map, zoom, t }
  draw(ctx, x, y, w, h, opts = {}) {
    this.update();
    const world = this.world, p = world.player, img = this.base;
    const t = world.time || 0;
    let k = opts.zoom || 1, ox, oy;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (opts.full) {
      const c = this.comp;
      k = Math.max(0.25, Math.min(w / c.width, h / c.height));
      if (k > 2) k = Math.floor(k);
      ox = Math.round(x + (w - c.width * k) / 2); oy = Math.round(y + (h - c.height * k) / 2);
    } else {
      const pp = miniPos(img, p.x, p.y);
      ox = Math.round(x + w / 2 - pp.x * k); oy = Math.round(y + h / 2 - pp.y * k);
    }
    // unexplored hint: faint full map silhouette
    ctx.globalAlpha = 0.12;
    ctx.drawImage(img.canvas, ox, oy, img.canvas.width * k, img.canvas.height * k);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.comp, ox, oy, this.comp.width * k, this.comp.height * k);
    const dot = (wx, wy, col, s = 2, outline = true) => {
      const m = miniPos(img, wx, wy);
      const dx = Math.round(ox + m.x * k - s / 2), dy = Math.round(oy + m.y * k - s / 2);
      if (outline) { ctx.fillStyle = '#000'; ctx.fillRect(dx - 1, dy - 1, s + 2, s + 2); }
      ctx.fillStyle = col; ctx.fillRect(dx, dy, s, s);
      return { x: dx, y: dy };
    };
    // lock area outline
    if (world.lock) {
      const L = world.lock;
      const pts = [[L.x, L.y], [L.x + L.w, L.y], [L.x + L.w, L.y + L.h], [L.x, L.y + L.h]].map(([a, b]) => { const m = miniPos(img, a, b); return [ox + m.x * k, oy + m.y * k]; });
      ctx.strokeStyle = Math.floor(t * 4) % 2 ? '#ff3a3a' : '#a01020';
      ctx.lineWidth = 1;
      ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a + 0.5, b + 0.5) : ctx.moveTo(a + 0.5, b + 0.5))); ctx.closePath(); ctx.stroke();
    }
    // exit
    const ex = world.exit;
    if (ex && world.exitOpen) dot(ex.x + ex.w / 2, ex.y + ex.h / 2, Math.floor(t * 3) % 2 ? '#7aff9a' : '#2a8a4a', 3);
    // GO target
    if (world.goArrow && Math.floor(t * 3) % 2) dot(world.goArrow.x, world.goArrow.y, '#ffe14a', 3);
    // enemies
    for (const f of world.fighters) {
      if (f.isPlayer || !f.alive || f.removed) continue;
      if (f === world.boss) { const pulse = Math.floor(t * 5) % 2; dot(f.x, f.y, pulse ? '#ff2a2a' : '#ffd23a', 4); }
      else dot(f.x, f.y, f.team === 'player' ? '#5ab0ff' : '#ff4a5a', 2, false);
    }
    // player (blinking cross)
    const pm = dot(p.x, p.y, '#ffffff', 3);
    if (Math.floor(t * 4) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(pm.x - 2, pm.y + 1, 7, 1); ctx.fillRect(pm.x + 1, pm.y - 2, 1, 7); }
    ctx.restore();
    ctx.imageSmoothingEnabled = prev;
  }
}
