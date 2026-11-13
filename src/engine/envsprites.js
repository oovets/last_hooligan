// Pre-rendered (Blender) environment sprites: walls, floor textures, props.
// Built by scripts/blender/render_env.py into assets/env/ (index.json + PNGs, 2x the logical pixel scale).
// Everything here is optional: when a piece is missing the procedural renderer in tiles.js / props.js is used.
//
//   await loadEnv()                      (everything; envNeed(keys) puts a level's sprites first)
//   envWall(styleId, h, variant) -> { img, padX, extraTop } | null
//   envFloor(floorId) -> { n, w, h, data: Uint8ClampedArray } | null     (RGBA patch, tile (0,0) north corner at (w/2, 0))
//   envProp(type, opts) -> { img, ax, ay } | null

const BASE = new URL('../../assets/env/', import.meta.url);
export const ENV = { walls: {}, floors: {}, props: {}, ready: false, done: 0, total: 0 };   // done/total: load progress
// optional recolouring of loaded sprites (content/rivals.js: the home stadiums' red -> the game's yellow)
let tintFn = null;
export function setEnvTint(fn) { tintFn = fn; }

function loadImg(file) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = new URL(file, BASE).href;
  });
}

// The ~1100 sprites load through a queue (a few dozen requests at a time) that can be reordered: envNeed(keys) moves a
// level's walls/floors/props to the front and resolves when they're in, so starting a level waits for that level's
// sprites only, not every level's. Keys: 'wall:<style>', 'floor:<id>', 'prop:<type>'.
const MAX_ACTIVE = 24;
const queue = [];                 // { key, run }
const keyLeft = new Map();        // key -> jobs still to load
const keyWait = new Map();        // key -> [resolve]
let active = 0, indexP = null, allDone = null;
const allP = new Promise(r => { allDone = r; });   // everything loaded
function settle(key) {
  const n = keyLeft.get(key) - 1;
  keyLeft.set(key, n);
  if (n <= 0 && keyWait.has(key)) { for (const r of keyWait.get(key)) r(); keyWait.delete(key); }
}
function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    const j = queue.shift();
    active++;
    j.run().catch(() => {}).then(() => {
      active--; ENV.done++; settle(j.key);
      if (ENV.done >= ENV.total) { ENV.ready = true; allDone(ENV); }
      pump();
    });
  }
}
function add(key, run) { keyLeft.set(key, (keyLeft.get(key) || 0) + 1); queue.push({ key, run }); }
export function loadEnv() {
  if (indexP) return indexP.then(() => (ENV.ready ? ENV : allP));
  indexP = (async () => {
    let index;
    try {
      const r = await fetch(new URL('index.json', BASE));
      if (!r.ok) { ENV.ready = true; return; }
      index = await r.json();
    } catch (e) { ENV.ready = true; return; }
    for (const [id, w] of Object.entries(index.walls || {})) {
      ENV.walls[id] = {};
      for (const [h, e] of Object.entries(w.heights || {})) {
        const rec = { padX: e.padX || 0, extraTop: e.extraTop || 0, imgs: [] };
        ENV.walls[id][h] = rec;
        e.files.forEach((f, i) => add('wall:' + id, () => loadImg(f).then(im => { rec.imgs[i] = im; })));
      }
    }
    for (const [id, f] of Object.entries(index.floors || {})) {
      add('floor:' + id, () => loadImg(f.file).then(im => {
        if (!im) return;
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
        ENV.floors[id] = { n: f.n, w: im.width, h: im.height, data: g.getImageData(0, 0, im.width, im.height).data };
      }));
    }
    for (const [id, p] of Object.entries(index.props || {})) {
      ENV.props[id] = [];          // variants are added as they arrive (envProp scores them; order doesn't matter)
      p.variants.forEach(v => add('prop:' + id, () => loadImg(v.file).then(im => { if (im) ENV.props[id].push({ ...v, img: im }); })));
    }
    ENV.total = queue.length;
    if (!ENV.total) { ENV.ready = true; return; }
    pump();
  })();
  return indexP.then(() => (ENV.ready ? ENV : allP));
}
// put these sprites first in the queue; -> { promise (resolves when they're all loaded), progress() 0..1 }
export function envNeed(keys) {
  let total = 0;
  const promise = (indexP || loadEnv()).then(() => {
    const want = new Set(keys.filter(k => keyLeft.get(k) > 0));
    const front = [], rest = [];
    for (const j of queue) (want.has(j.key) ? front : rest).push(j);
    queue.splice(0, queue.length, ...front, ...rest);
    total = [...want].reduce((n, k) => n + keyLeft.get(k), 0);
    return Promise.all([...want].map(k => new Promise(r => { if (!(keyLeft.get(k) > 0)) r(); else { if (!keyWait.has(k)) keyWait.set(k, []); keyWait.get(k).push(r); } })));
  });
  const left = () => keys.reduce((n, k) => n + Math.max(0, keyLeft.get(k) || 0), 0);
  return { promise, progress: () => (total ? 1 - left() / total : 0) };
}
export function envWall(styleId, h, variant) {
  const w = ENV.walls[styleId];
  if (!w) return null;
  const rec = w[String(h)];
  if (!rec || !rec.imgs.length) return null;
  const img = rec.imgs[((variant % rec.imgs.length) + rec.imgs.length) % rec.imgs.length];
  return img ? { img: tintFn ? tintFn('wall', styleId, img) : img, padX: rec.padX, extraTop: rec.extraTop } : null;
}

export function envFloor(id) { const f = ENV.floors[id] || null; return f && tintFn ? tintFn('floor', id, f) : f; }

export function envProp(type, o = {}) {
  const list = ENV.props[type];
  if (!list || !list.length) return null;
  let best = list[0], bs = -1;
  for (const v of list) {
    let s = 0;
    if (o.dir !== undefined || v.dir !== undefined) s += (v.dir || 'x') === (o.dir || 'x') ? 4 : -10;
    if (v.color && o.color) s += v.color.toLowerCase() === String(o.color).toLowerCase() ? 3 : 0;
    if (!!v.fire === !!o.fire) s += 2;
    if (!!v.rev === !!o.rev) s += 5;          // vehicles: which way the front faces
    if (s > bs) { bs = s; best = v; }
  }
  if ((best.dir || 'x') !== (o.dir || 'x') && (o.dir !== undefined || best.dir !== undefined)) return null;
  if (tintFn) {
    const im = tintFn('prop', type, best.img);
    if (im !== best.img) { if (!best.tinted || best.tinted.src !== best.img || best.tinted.v.img !== im) best.tinted = { src: best.img, v: { ...best, img: im } }; return best.tinted.v; }
  }
  return best;
}
