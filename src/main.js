// Boot: canvas, scaling, fixed-step loop.
import { VIEW_W, VIEW_H, STEP } from './engine/constants.js';
import { input } from './engine/input.js';
import { app } from './app.js';
import { save } from './save.js';
import { audio } from './audio/audio.js';
import './content/index.js';
import './audio/music.js';
import './ui/title.js';
import './ui/screens.js';
import './game/play.js';
import './ui/charselect.js';
import './ui/hub.js';
import { game } from './game/state.js';

const canvas = document.getElementById('game');
// The backing store is 2x the logical resolution: procedural pixel art is drawn through a 2x transform
// (identical chunky look) while pre-rendered Blender sprites are blitted at their native 2x detail.
export const RENDER_SCALE = 2;
canvas.width = VIEW_W * RENDER_SCALE; canvas.height = VIEW_H * RENDER_SCALE;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const stage = document.getElementById('stage');
const glCanvas = document.getElementById('gl');
// HD frames: every scene except the pixel-art world scenes (scene.pixel) is drawn into a backing store at the full
// device resolution (CSS size x devicePixelRatio, capped) through a scale transform, so the logical 640x360
// coordinates stay the same while text, gradients and vector shapes are razor sharp.
const HD = { w: VIEW_W * RENDER_SCALE, h: VIEW_H * RENDER_SCALE };
function resize() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const k = s >= 2 ? Math.floor(s) : s; // integer scale when big enough (crisp pixels)
  const cw = Math.floor(VIEW_W * k), ch = Math.floor(VIEW_H * k);
  const w = cw + 'px', h = ch + 'px';
  for (const el of [stage, canvas, glCanvas]) { el.style.width = w; el.style.height = h; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let hw = Math.round(cw * dpr), hh = Math.round(ch * dpr);
  const cap = 2880 / hw; if (cap < 1) { hw = Math.round(hw * cap); hh = Math.round(hh * cap); }
  HD.w = Math.max(VIEW_W * RENDER_SCALE, hw); HD.h = Math.max(VIEW_H * RENDER_SCALE, hh);
}
window.addEventListener('resize', resize);
resize();

import { DEV } from './devflags.js';
if (DEV.mute) {
  // development mute: never create an AudioContext (all audio calls become no-ops)
  audio.init = () => {};
  if (audio.ctx) audio.ctx.close();
}
save.load();
audio.setVolumes({ music: save.data.settings.music, sfx: save.data.settings.sfx });
input.init(window);
input.initMouse(canvas, VIEW_W, VIEW_H);
const unlockAudio = () => audio.init();
window.addEventListener('keydown', unlockAudio);
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);
canvas.focus();

import { loadEnv, envNeed, ENV } from './engine/envsprites.js';
import { TileMap } from './engine/tilemap.js';
import { ALL_LEVELS } from './content/tour/index.js';
import HUB from './content/hub.js';
import { loadModels, EXTRAS } from './game/sprites.js';
import { loadFonts, setFrameHD } from './engine/font.js';
import { drawLoading } from './ui/loadscreen.js';
import { r3d } from './render3d/index.js';
import { backdrop } from './ui/backdrop.js';
import { lineupHeroes } from './ui/title.js';

// ---- asset preload (Blender-rendered environment + character atlases); the game falls back to procedural art
let loadState = { done: 0, total: 1, ready: false };
const qp0 = new URLSearchParams(location.search);
const want3d = (qp0.get('renderer') || save.data.settings.renderer) === '3d';
async function load3d() {
  try {
    const m = await timed('3d:modules', import('./render3d/renderer.js'));
    m.HERO_FIRST.push(...lineupHeroes());            // the title's line-up first; the other lads after the title is up
    await timed('3d:models v2 + heroes', m.loadCharacters2());
    // the old v1 rigid models are only a fallback for when the v2 skinned models are missing
    const { CHAR2 } = await import('./render3d/characters2.js');
    if (!CHAR2.ready) await timed('3d:models v1', m.loadCharacterModels());
    r3d.renderer = new m.Renderer3D(glCanvas, canvas);
    try { const ms = await timed('3d:menu', import('./render3d/menustage.js')); r3d.menu = new ms.MenuStage(); } catch (e) { console.warn('[3d] menu stage unavailable', e); }
    try { const ic = await import('./render3d/itemicons.js'); r3d.itemIcon = ic.itemIcon; } catch (e) { console.warn('[3d] item icons unavailable', e); }
  } catch (e) { console.warn('[3d] renderer unavailable, using 2D', e); }
}
// each preload step logs its time ([load] in the console) so slow loads can be diagnosed on the live site
const T0 = performance.now();
const timed = (name, p) => p.then(v => { console.info(`[load] ${name} ${Math.round(performance.now() - T0)}ms`); return v; });
// The Blender environment sprites (~1100 PNGs for every level) load in the BACKGROUND: the title shows as soon as the
// fonts and the 3D characters are in. A level / the pub waits only for ITS sprites (envNeed: they jump the queue).
const envP = timed('env', loadEnv());
async function preload() {
  const tasks = [timed('fonts', loadFonts()), timed('bg', backdrop.photoReady())];   // the title's Råsunda photo
  if (want3d) tasks.push(timed('3d', load3d()));
  try {
    const r = await fetch('assets/sprites/index.json');
    if (r.ok) { const idx = await r.json(); EXTRAS.push(...(idx.extras || [])); tasks.push(timed('sprites', loadModels(idx.models || []))); }
  } catch (e) { /* no sprites built */ }
  loadState.total = tasks.length;
  await Promise.all(tasks.map(t => t.then(() => { loadState.done++; })));
  loadState.ready = true;
  if (r3d.renderer) import('./render3d/renderer.js').then(m => m.loadAllHeroes()).then(() => console.info(`[load] all heroes ${Math.round(performance.now() - T0)}ms`));
  console.info(`[load] ready ${Math.round(performance.now() - T0)}ms`);
}
const loading = {
  t: 0,
  update(dt) { this.t += dt; if (loadState.ready) start(); },
  shown: 0,
  draw(c) {
    const k = loadState.done / Math.max(1, loadState.total);
    this.shown += (k - this.shown) * 0.12;
    drawLoading(c, this.t, this.shown);
  },
};
{ const ov = document.getElementById('loading'); if (ov) ov.style.display = 'none'; }
preload();
let started = false;
const qp = new URLSearchParams(location.search);
// scenes that build a World wait for the environment sprites (floors are baked when a level is built)
// the env sprites one level uses (walls, floors, props): starting it waits for these only, not every level's
const keyCache = new Map();
function envKeysFor(level) {
  if (!level) return [];
  if (keyCache.has(level)) return keyCache.get(level);
  const k = new Set();
  try {
    const m = new TileMap(level);
    for (let i = 0; i < m.w * m.h; i++) { if (m.floor[i]) k.add('floor:' + m.floor[i]); const w = m.wall[i]; if (w && w.style) k.add('wall:' + w.style); }
    for (const p of [...(m.propSpawns || []), ...(level.props || [])]) if (p && p.type) k.add('prop:' + p.type);
  } catch (e) { console.warn('[env] keys for', level.id, e); }
  const out = [...k]; keyCache.set(level, out); return out;
}
class EnvWaitScene {
  constructor(make, keys) {
    this.make = make; this.t = 0; this.shown = 0;
    const need = envNeed(keys); this.progress = need.progress;
    need.promise.then(() => { this.ready = true; });
  }
  update(dt) { this.t += dt; if (this.ready || ENV.ready) app.go(this.make(), { fade: false }); }
  draw(c) { const k = this.progress(); this.shown += (k - this.shown) * 0.15; drawLoading(c, this.t, this.shown); }
}
{
  const play = app.scenes.play, hub = app.scenes.hub, intro = app.scenes.levelIntro;
  if (play) app.scenes.play = i => (ENV.ready ? play(i) : new EnvWaitScene(() => play(i), envKeysFor(ALL_LEVELS[i])));
  if (hub) app.scenes.hub = () => (ENV.ready ? hub() : new EnvWaitScene(() => hub(), envKeysFor(HUB)));
  // the briefing doesn't wait: it puts its level's sprites first so they load while you read
  if (intro) app.scenes.levelIntro = i => { if (!ENV.ready) envNeed(envKeysFor(ALL_LEVELS[i])); return intro(i); };
}
// at boot: the pub (where a run starts) and the level you'd continue at go first in the queue
{
  const run = save.data.run;
  envNeed(envKeysFor(ALL_LEVELS[(run && run.levelIndex) || 0]));
  if ((save.data.settings || {}).firm !== false) envNeed(envKeysFor(HUB));
}
function start() {
  if (started) return; started = true;
  const ov = document.getElementById('loading'); if (ov) ov.remove();
if (qp.has('play')) { game.reset(); app.go(app.scenes.play(parseInt(qp.get('play'), 10) || 0), { fade: false }); }
else app.go(app.scenes.title(), { fade: false });   // one loading screen, then straight to the title (no studio ident)
}
app.go(loading, { fade: false });

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    input.poll();
    app.update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  const hd = !!(app.scene && !app.scene.pixel);
  const W = hd ? HD.w : VIEW_W * RENDER_SCALE, H = hd ? HD.h : VIEW_H * RENDER_SCALE;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  if (canvas.classList.contains('hd') !== hd) canvas.classList.toggle('hd', hd);
  const S = W / VIEW_W;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = hd;
  ctx.imageSmoothingQuality = 'high';
  setFrameHD(hd);
  app.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debug handle
window.__hooligan = {
  app, save, audio, game, r3d,
  play(i = 0) { game.reset(); app.go(app.scenes.play(i), { fade: false }); },
  get world() { return app.scene && app.scene.world; },
  // test helpers: simulate key holds
  hold(code, ms = 300) { input.keys.add(code); input.tapped.add(code); setTimeout(() => input.keys.delete(code), ms); },
  tap(code) { input.tapped.add(code); },
};
