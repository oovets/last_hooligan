// Pre-rendered (Blender) character sprites with runtime recolouring.
//
// Atlases are produced by scripts/blender/render_char.py + scripts/pack_sprites.py into assets/sprites/<model>.{png,json}.
// Pixel encoding: R = light (0..255), G = material id * 8, A = opaque mask. Frames are rendered at 2x the game's logical
// resolution (character ~92 px tall), so they are drawn at half size into the 2x-scaled main canvas = full detail.
//
//   await loadModels(['m_jacket', ...])          (missing files are ignored -> callers fall back to the procedural doll)
//   drawCharacter(ctx, x, y, look, clip, frame, fx, fy, opts) -> true if drawn
//   fighterClip(f) -> { clip, frame }            maps Fighter state/time to an atlas clip frame
//   specForLook(look) -> { model, layers, pal, key }
//
// Material ids (see render_char.py ID): 1 skin 2 hair 3 jacket 4 trim 5 lining 6 shirt 7 pants 8 pantsTrim 9 shoes 10 sole
// 11 scarfA 12 scarfB 13 eye 14 hat 15 hatTrim 16 glove 17 band 18 facial 19 shades 20 mouth 21 belt 22 stripe

import { hexToRgb, shade, mix } from '../engine/color.js';

const MODELS = {};          // name -> { meta, data (Uint8ClampedArray RGBA atlas), W }
const LOADING = {};
export const SPRITE_MODELS = MODELS;
const BASE = new URL('../../assets/sprites/', import.meta.url);

export function loadModel(name) {
  if (MODELS[name]) return Promise.resolve(MODELS[name]);
  if (LOADING[name]) return LOADING[name];
  LOADING[name] = (async () => {
    try {
      const res = await fetch(new URL(name + '.json', BASE));
      if (!res.ok) return null;
      const meta = await res.json();
      const img = new Image();
      img.src = new URL(name + '.png', BASE).href;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height).data;
      const dirIndex = {};
      meta.dirs.forEach((d, i) => { dirIndex[d] = i; });
      const M = { meta, data, W: c.width, dirIndex, datas: [data], Ws: [c.width] };
      meta.frames = Object.values(meta.clips).reduce((n, cl) => Math.max(n, cl.start + cl.n), 0);
      for (const sfx of EXTRAS) {
        try { const X = await loadAtlas(name + '.' + sfx); if (X) mergeAtlas(M, X); } catch (e) { /* missing extra */ }
      }
      MODELS[name] = M;
      return M;
    } catch (e) {
      return null;
    }
  })();
  return LOADING[name];
}

// ---- supplementary atlases (<model>.<suffix>.png/json: extra clips rendered later) are merged into the base model
export const EXTRAS = [];
async function loadAtlas(file) {
  const res = await fetch(new URL(file + '.json', BASE));
  if (!res.ok) return null;
  const meta = await res.json();
  const img = new Image();
  img.src = new URL(file + '.png', BASE).href;
  await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  return { meta, data: g.getImageData(0, 0, c.width, c.height).data, W: c.width };
}
function mergeAtlas(M, X) {
  const base = M.meta.frames || Object.values(M.meta.clips).reduce((n, c) => Math.max(n, c.start + c.n), 0);
  const ai = M.datas.length;
  M.datas.push(X.data); M.Ws.push(X.W);
  for (const [name, c] of Object.entries(X.meta.clips)) M.meta.clips[name] = { ...c, start: c.start + base };
  let total = base;
  for (const [ln, L] of Object.entries(X.meta.layers)) {
    const dst = (M.meta.layers[ln] ||= []);
    while (dst.length < base) dst.push(new Array(M.meta.dirs.length).fill(0));
    L.forEach((row, fi) => { dst[base + fi] = row.map(r => (r ? [...r.slice(0, 6), ai] : 0)); total = Math.max(total, base + fi + 1); });
  }
  M.meta.frames = total;
}

export function loadModels(names) {
  const builds = new Set(names.map(n => n.split('_')[0]));
  return Promise.all([...names.map(loadModel), ...[...builds].map(loadHands)]);
}

// ---- baked weapon-hand positions (scripts/blender/render_char.py handsOnly pass): hands_<build>.json
const HANDS = {};
export function loadHands(build) {
  if (HANDS[build] !== undefined) return Promise.resolve(HANDS[build]);
  HANDS[build] = null;
  const get = f => fetch(new URL(f, BASE)).then(r => (r.ok ? r.json() : null)).catch(() => null);
  return Promise.all([get('hands_' + build + '.json'), ...EXTRAS.map(sx => get('hands_' + build + '.' + sx + '.json'))]).then(([j, ...xs]) => {
    if (!j) return null;
    for (const x of xs) if (x) { j.frames = j.frames.concat(x.frames); j.hands = j.hands.concat(x.hands); }
    const start = {};
    j.frames.forEach(([n, i], k) => { if (i === 0) start[n] = k; });
    const dirIndex = {}; j.dirs.forEach((d, i) => { dirIndex[d] = i; });
    HANDS[build] = { ...j, start, dirIndex };
    return HANDS[build];
  }).catch(() => null);
}

// Near (weapon) hand in logical px relative to the feet, plus forearm angle in the doll convention
// (direction = (sin ang, cos ang) in screen space). Returns null if unknown.
export function handPos(spec, clip, frame, fx, fy, scale = 1) {
  const H = HANDS[spec.model.split('_')[0]];
  const M = MODELS[spec.model];
  if (!H || !M) return null;
  const st = H.start[clip];
  if (st === undefined) return null;
  const C = M.meta.clips[clip];
  const fi = st + Math.max(0, Math.min((C ? C.n : 1) - 1, frame | 0));
  const { di, mirror, dirIdx } = dirFor(M, fx, fy);
  const hd = H.dirIndex[dirIdx];
  const row = H.hands[fi] && H.hands[fi][hd];
  if (!row) return null;
  const k = 0.5 * scale, sgn = mirror ? -1 : 1;
  const hx = (row[0] - H.anchor[0]) * k * sgn, hy = (row[1] - H.anchor[1]) * k;
  const ex = (row[2] - H.anchor[0]) * k * sgn, ey = (row[3] - H.anchor[1]) * k;
  return { x: hx, y: hy, ang: Math.atan2(hx - ex, hy - ey) };
}
export function modelReady(name) { return !!MODELS[name]; }

// ------------------------------------------------------------------ look -> model + layers + palette
const TORSO_OF = { harrington: 'jacket', bomber: 'jacket', track: 'jacket', leather: 'jacket', suit: 'jacket', shirt: 'jacket', parka: 'parka', tee: 'tee', polo: 'tee', vest: 'tee', hivis: 'hivis', hoodie: 'hoodie', overshirt: 'jacket', bare: 'bare' };

// wardrobe hero garments: every jacket-like style wears the jacket, the rest their own top
const HERO_TOP = { tee: 'tee', polo: 'polo', shirt: 'shirt', vest: 'tee' };

export function modelForLook(look) {
  const b = look.build || 1;
  const pre = look.muscle ? 'b' : look.lanky ? 'l' : b >= 1.28 ? 'h' : 'm';
  const torso = TORSO_OF[(look.jacket && look.jacket.style) || 'harrington'] || 'jacket';
  const cands = [`${pre}_${torso}`, `${pre}_jacket`, `m_${torso}`, 'm_jacket'];
  for (const c of cands) if (MODELS[c]) return c;
  return cands[0];
}

export function modelsForLooks(looks) {
  const set = new Set();
  for (const L of looks) {
    const b = L.build || 1;
    const pre = L.muscle ? 'b' : L.lanky ? 'l' : b >= 1.28 ? 'h' : 'm';
    const torso = TORSO_OF[(L.jacket && L.jacket.style) || 'harrington'] || 'jacket';
    set.add(`${pre}_${torso}`); set.add(`${pre}_jacket`); set.add('m_jacket');
  }
  return [...set];
}

function rgb(h) { return hexToRgb(h || '#ff00ff'); }

export function specForLook(look) {
  const model = modelForLook(look);
  const J = look.jacket || {}, Pn = look.pants || {}, S = look.shoes || {};
  const hairC = (look.hair && look.hair.color) || '#3a2717';
  const pal = new Array(32).fill(null);
  const set = (i, c) => { pal[i] = rgb(c); };
  set(1, look.skin || '#e2a97a');
  set(2, hairC);
  set(3, J.color || '#2b3a2a');
  set(4, J.trim || shade(J.color || '#2b3a2a', -0.3));
  set(5, J.lining || '#b8302a');
  set(6, look.shirt || '#e8e4dc');
  set(7, Pn.color || '#34507a');
  set(8, Pn.style === 'jeans' ? shade(Pn.color || '#34507a', 0.28) : (Pn.style === 'shorts' ? (look.skin || '#e2a97a') : (Pn.color || '#34507a')));
  set(9, S.color || '#f2f2ee');
  set(10, S.sole || '#b9a27a');
  set(11, look.scarf ? look.scarf.a : '#c8102e');
  set(12, look.scarf ? look.scarf.b : '#f4f1e8');
  set(13, '#140c0c');
  set(14, look.hat ? look.hat.color : (look.maskColor || '#18181c'));   // hats and masks share a colour
  set(15, look.hat ? (look.hat.trim || shade(look.hat.color, 0.25)) : '#555555');
  set(16, look.gloves || look.skin || '#e2a97a');
  set(17, '#e4e6ee');
  set(18, shade(hairC, -0.08));
  set(19, '#0e0e16');
  set(20, '#6a2626');
  set(21, '#2a1a12');
  set(22, J.style === 'track' ? (J.trim || '#f2efe6') : (J.color || '#2b3a2a'));
  set(24, (look.badge && look.badge.base) || '#141416');
  set(25, (look.badge && look.badge.mark) || '#c8d43a');
  set(23, S.stripe || S.color || '#f2f2ee');   // trainer stripes + heel tab (3D, layer shoes:stripes)
  const layers = ['body'];
  // match-day kit (3D models; the 2D sprites simply don't have these layers): hood up/down, masks, a bum bag, cargo pockets
  const hood = !!look.hood, mask = look.mask || null;          // mask: 'balaclava' (eye slit) | 'snood' (nose down)
  const covered = hood || mask === 'balaclava' || (look.hat && look.hat.style === 'balaclava');
  if (look.scarf && mask !== 'snood') layers.push('scarf');
  const hs = look.hair && look.hair.style;
  if (hs && hs !== 'skinhead' && hs !== 'bald' && !covered) layers.push('hair:' + hs);
  if (look.facial === 'beard' && !mask) layers.push('face:beard');
  if (look.facial === 'tache' && !mask) layers.push('face:tache');
  if (look.shades) layers.push('face:shades');
  if (look.hat && !hood) layers.push('hat:' + look.hat.style);
  if (hood) layers.push('hood:up'); else if (J.style === 'hoodie' || J.hood === 'down') layers.push('hood:down');
  if (J.pockets) layers.push('pockets:chest');
  if (look.badge) layers.push('badge:arm');
  if (look.tattoo) layers.push('tattoo:arm');               // arm tattoo on bare arms (3D; design: look.tattoo)                 // black arm badge with a compass rose (3D)
  if (mask) layers.push('mask:' + mask);
  if (look.bag) layers.push('bag');
  if (Pn.style === 'cargo') layers.push('pants:cargo');
  if (J.style === 'track') layers.push('track:stripes');      // three stripes down the sleeves (colour: jacket trim)
  if (S.stripe) layers.push('shoes:stripes');                // three stripes + heel tab on the trainers
  // realistic wardrobe heroes (Dez, assets/models/hero/dez.glb) carry a garment per kind: show the outfit's
  layers.push('top:' + (HERO_TOP[J.style || 'harrington'] || 'jacket'), 'legs:' + (Pn.style || 'jeans'));
  if (look.gloves) layers.push('gloves');
  const accModel = model.split('_')[0] + '_jacket';
  const key = model + '|' + layers.join(',') + '|' + pal.map(c => c ? c.join('.') : '').join(';');
  return { model, accModel, layers, pal, key };
}

// ------------------------------------------------------------------ tone ramp (toon banding)
// light value (0..255) -> multiplier; highlights blend toward white.
const BANDS = [[38, 0.42], [66, 0.6], [92, 0.78], [125, 0.94], [185, 1.04], [256, 1.15]];
const TONE = new Float32Array(256);
for (let v = 0; v < 256; v++) { for (const [t, m] of BANDS) if (v < t) { TONE[v] = m; break; } }

const OUT = [18, 12, 20];

// ------------------------------------------------------------------ composition cache
const cache = new Map();
const CACHE_MAX = 2600;
let scratch = null;

function compose(M, spec, fi, di, flash, silhouette) {
  const meta = M.meta;
  const [FW, FH] = meta.res;
  if (!scratch || scratch.w !== FW || scratch.h !== FH) scratch = { w: FW, h: FH, id: new Uint8Array(FW * FH), sh: new Uint8Array(FW * FH) };
  const { id, sh } = scratch;
  let x0 = FW, y0 = FH, x1 = -1, y1 = -1;
  let any = false;
  for (const ln of spec.layers) {
    let S = M, L = meta.layers[ln];
    if (!L) { S = MODELS[spec.accModel]; L = S && S.meta.layers[ln]; }
    if (!L) continue;
    const r0 = L[fi] && L[fi][di];
    const data = r0 && r0[6] ? S.datas[r0[6]] : S.data, AW = r0 && r0[6] ? S.Ws[r0[6]] : S.W;
    const r = L[fi] && L[fi][di];
    if (!r) continue;
    const [ax, ay, w, h, ox, oy] = r;
    if (!any) { id.fill(0); any = true; }
    for (let yy = 0; yy < h; yy++) {
      let si = ((ay + yy) * AW + ax) * 4;
      let di2 = (oy + yy) * FW + ox;
      for (let xx = 0; xx < w; xx++, si += 4, di2++) {
        if (data[si + 3] < 128) continue;
        id[di2] = data[si + 1] >> 3; sh[di2] = data[si];
      }
    }
    if (ox < x0) x0 = ox; if (oy < y0) y0 = oy;
    if (ox + w > x1) x1 = ox + w; if (oy + h > y1) y1 = oy + h;
  }
  if (!any) return null;
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(FW, x1 + 1); y1 = Math.min(FH, y1 + 1);
  const w = x1 - x0, h = y1 - y0;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const o = img.data;
  const pal = spec.pal;
  const sil = silhouette ? rgb(silhouette) : null;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const fx = x0 + xx, fy = y0 + yy, i = fy * FW + fx, oi = (yy * w + xx) * 4;
      const m = id[i];
      if (m) {
        if (sil) { o[oi] = sil[0]; o[oi + 1] = sil[1]; o[oi + 2] = sil[2]; o[oi + 3] = 255; continue; }
        if (flash) { o[oi] = 255; o[oi + 1] = 255; o[oi + 2] = 255; o[oi + 3] = 255; continue; }
        const base = pal[m] || [255, 0, 255];
        const t = TONE[sh[i]];
        if (t <= 1) { o[oi] = base[0] * t; o[oi + 1] = base[1] * t; o[oi + 2] = base[2] * t; }
        else { const k = t - 1; o[oi] = base[0] + (255 - base[0]) * k; o[oi + 1] = base[1] + (255 - base[1]) * k; o[oi + 2] = base[2] + (255 - base[2]) * k; }
        // material boundary: darken the lower/right side pixel slightly for crisp part separation
        const up = fy > 0 ? id[i - FW] : 0, lf = fx > 0 ? id[i - 1] : 0;
        if ((up && up !== m) || (lf && lf !== m)) { o[oi] *= 0.82; o[oi + 1] *= 0.82; o[oi + 2] *= 0.82; }
        o[oi + 3] = 255;
      } else {
        // outline where a neighbour is filled
        const l = fx > 0 && id[i - 1], r = fx < FW - 1 && id[i + 1], u = fy > 0 && id[i - FW], d = fy < FH - 1 && id[i + FW];
        if (l || r || u || d) { const oc = sil || OUT; o[oi] = oc[0]; o[oi + 1] = oc[1]; o[oi + 2] = oc[2]; o[oi + 3] = 255; }
      }
    }
  }
  g.putImageData(img, 0, 0);
  return { c, x0, y0 };
}

// facing (game world vector) -> 8-way index, mirror mapping onto rendered dirs
function dirFor(M, fx, fy) {
  let a = Math.atan2(fy, fx);
  let i = Math.round(a / (Math.PI / 4));
  i = ((i % 8) + 8) % 8;
  const MIR = { 2: 0, 3: 7, 4: 6 };
  let mirror = false;
  if (M.dirIndex[i] === undefined && MIR[i] !== undefined) { i = MIR[i]; mirror = true; }
  return { di: M.dirIndex[i] ?? 0, mirror, dirIdx: i };
}

export function clipInfo(model, clip) {
  const M = MODELS[model];
  return M ? M.meta.clips[clip] : null;
}

// Draw. (x,y) = feet position in logical (1x) canvas coords. Returns false if the model isn't loaded.
export function drawCharacter(ctx, x, y, spec, clip, frame, fx, fy, opts = {}) {
  const M = MODELS[spec.model];
  if (!M) return false;
  const meta = M.meta;
  let C = meta.clips[clip] || meta.clips.idle;
  if (!C) return false;
  const fi = C.start + Math.max(0, Math.min(C.n - 1, frame | 0));
  const flip = !!opts.flipFacing;
  const { di, mirror } = dirFor(M, flip ? -fx : fx, flip ? -fy : fy);
  const key = spec.key + '|' + fi + '|' + di + (opts.flash ? '|F' : '') + (opts.silhouette ? '|S' + opts.silhouette : '');
  let e = cache.get(key);
  if (e === undefined) {
    e = compose(M, spec, fi, di, opts.flash, opts.silhouette);
    cache.set(key, e);
    if (cache.size > CACHE_MAX) { let n = 200; for (const k of cache.keys()) { cache.delete(k); if (--n <= 0) break; } }
  } else { cache.delete(key); cache.set(key, e); }
  if (!e) return true;
  const sc = (opts.scale || 1) * 0.5;      // atlas is 2x
  const [ax, ay] = meta.anchor;
  const prevA = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevA * opts.alpha;
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(e.c, (e.x0 - ax) * sc, (e.y0 - ay) * sc, e.c.width * sc, e.c.height * sc);
    ctx.restore();
  } else {
    ctx.drawImage(e.c, x + (e.x0 - ax) * sc, y + (e.y0 - ay) * sc, e.c.width * sc, e.c.height * sc);
  }
  ctx.imageSmoothingEnabled = smooth;
  ctx.globalAlpha = prevA;
  return true;
}

// ------------------------------------------------------------------ fighter state -> clip frame
function frameOf(C, t, speed = 1) {
  if (!C) return 0;
  if (C.kind === 'loop') { const d = C.dur || 0.5; return Math.floor((((t * speed) % d) + d) % d / d * C.n) % C.n; }
  if (C.n <= 1) return 0;
  return Math.min(C.n - 1, Math.round(Math.min(1, t / (C.dur || 0.3)) * (C.n - 1)));
}

export function fighterClip(f, model) {
  const M = MODELS[model];
  const clips = M ? M.meta.clips : {};
  const pick = (name, t, sp) => { const c = clips[name] ? name : 'idle'; return { clip: c, frame: frameOf(clips[c], t, sp) }; };
  switch (f.state) {
    case 'attack': {
      const a = f.attack;
      if (!a) return pick('guard', f.animT);
      const d = a.def, name = 'atk_' + d.pose;
      if (!clips[name]) return pick('guard', f.animT);
      let p;
      if (a.phase === 0) { p = a.t / d.startup; return { clip: name, frame: p < 0.5 ? 0 : 1 }; }
      if (a.phase === 1) return { clip: name, frame: 2 };
      p = d.air ? (a.t - (a.landT ?? a.t)) / d.recovery : (a.t - d.startup - d.active) / d.recovery;
      return p < 0.55 ? { clip: name, frame: 3 } : pick('guard', 0);
    }
    case 'idle': return pick(f.combat ? 'guard' : 'idle', f.animT);
    case 'walk': return pick(f.combat ? 'fightWalk' : 'walk', f.animT, Math.hypot(f.vx, f.vy) / 3);
    case 'run': return pick('run', f.animT);
    case 'jump': return pick(f.vz > 1 ? 'jump' : 'fall', f.animT);
    case 'blockstun': return pick('blockHit', f.animT);
    case 'hurt': return pick(f.hurtAnim || 'hurt', f.animT);
    case 'taunt': return pick(f.tauntAnim || 'taunt', f.animT);
    case 'grabbing': return pick(f.grabCfg && f.grabCfg.choke ? 'choking' : 'grabbing', f.animT);
    case 'grabbed': return pick(f.grabbedBy && f.grabbedBy.grabCfg && f.grabbedBy.grabCfg.choke ? 'choked' : 'grabbed', f.animT);
    default: return pick(clips[f.state] ? f.state : 'idle', f.animT);
  }
}
