// Pre-rendered (Blender) environment sprites: walls, floor textures, props.
// Built by scripts/blender/render_env.py into assets/env/ (index.json + PNGs, 2x the logical pixel scale).
// Everything here is optional: when a piece is missing the procedural renderer in tiles.js / props.js is used.
//
//   await loadEnv()
//   envWall(styleId, h, variant) -> { img, padX, extraTop } | null
//   envFloor(floorId) -> { n, w, h, data: Uint8ClampedArray } | null     (RGBA patch, tile (0,0) north corner at (w/2, 0))
//   envProp(type, opts) -> { img, ax, ay } | null

const BASE = new URL('../../assets/env/', import.meta.url);
export const ENV = { walls: {}, floors: {}, props: {}, ready: false, done: 0, total: 0 };   // done/total: load progress

function loadImg(file) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = new URL(file, BASE).href;
  });
}

export async function loadEnv() {
  let index;
  try {
    const r = await fetch(new URL('index.json', BASE));
    if (!r.ok) { ENV.ready = true; return ENV; }
    index = await r.json();
  } catch (e) { ENV.ready = true; return ENV; }
  const jobs = [];
  for (const [id, w] of Object.entries(index.walls || {})) {
    ENV.walls[id] = {};
    for (const [h, e] of Object.entries(w.heights || {})) {
      const rec = { padX: e.padX || 0, extraTop: e.extraTop || 0, imgs: [] };
      ENV.walls[id][h] = rec;
      e.files.forEach((f, i) => jobs.push(loadImg(f).then(im => { rec.imgs[i] = im; })));
    }
  }
  for (const [id, f] of Object.entries(index.floors || {})) {
    jobs.push(loadImg(f.file).then(im => {
      if (!im) return;
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      ENV.floors[id] = { n: f.n, w: im.width, h: im.height, data: g.getImageData(0, 0, im.width, im.height).data };
    }));
  }
  for (const [id, p] of Object.entries(index.props || {})) {
    ENV.props[id] = [];
    p.variants.forEach((v, i) => jobs.push(loadImg(v.file).then(im => { if (im) ENV.props[id][i] = { ...v, img: im }; })));
  }
  ENV.total = jobs.length;
  await Promise.all(jobs.map(j => j.then(() => { ENV.done++; })));
  for (const id in ENV.props) ENV.props[id] = ENV.props[id].filter(Boolean);
  ENV.ready = true;
  return ENV;
}

export function envWall(styleId, h, variant) {
  const w = ENV.walls[styleId];
  if (!w) return null;
  const rec = w[String(h)];
  if (!rec || !rec.imgs.length) return null;
  const img = rec.imgs[((variant % rec.imgs.length) + rec.imgs.length) % rec.imgs.length];
  return img ? { img, padX: rec.padX, extraTop: rec.extraTop } : null;
}

export function envFloor(id) { return ENV.floors[id] || null; }

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
  return best;
}
