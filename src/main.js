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
function resize() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const k = s >= 2 ? Math.floor(s) : s; // integer scale when big enough (crisp pixels)
  const w = Math.floor(VIEW_W * k) + 'px', h = Math.floor(VIEW_H * k) + 'px';
  for (const el of [stage, canvas, glCanvas]) { el.style.width = w; el.style.height = h; }
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
const unlockAudio = () => audio.init();
window.addEventListener('keydown', unlockAudio);
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('touchstart', unlockAudio);
canvas.focus();

import { loadEnv } from './engine/envsprites.js';
import { loadModels, EXTRAS } from './game/sprites.js';
import { drawText } from './engine/font.js';
import { r3d } from './render3d/index.js';

// ---- asset preload (Blender-rendered environment + character atlases); the game falls back to procedural art
let loadState = { done: 0, total: 1, ready: false };
const qp0 = new URLSearchParams(location.search);
const want3d = (qp0.get('renderer') || save.data.settings.renderer) === '3d';
async function load3d() {
  try {
    const m = await import('./render3d/renderer.js');
    await m.loadCharacterModels();
    r3d.renderer = new m.Renderer3D(glCanvas, canvas);
  } catch (e) { console.warn('[3d] renderer unavailable, using 2D', e); }
}
async function preload() {
  const tasks = [loadEnv()];
  if (want3d) tasks.push(load3d());
  try {
    const r = await fetch('assets/sprites/index.json');
    if (r.ok) { const idx = await r.json(); EXTRAS.push(...(idx.extras || [])); tasks.push(loadModels(idx.models || [])); }
  } catch (e) { /* no sprites built */ }
  loadState.total = tasks.length;
  await Promise.all(tasks.map(t => t.then(() => { loadState.done++; })));
  loadState.ready = true;
}
const loading = {
  t: 0,
  update(dt) { this.t += dt; if (loadState.ready) start(); },
  draw(c) {
    c.fillStyle = '#05040a'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(c, 'LOADING', VIEW_W / 2, VIEW_H / 2 - 12, { color: '#ffd23a', align: 'center', scale: 2 });
    const w = 200, k = loadState.done / Math.max(1, loadState.total);
    c.fillStyle = '#2a1a2a'; c.fillRect(VIEW_W / 2 - w / 2, VIEW_H / 2 + 10, w, 6);
    c.fillStyle = '#c8102e'; c.fillRect(VIEW_W / 2 - w / 2, VIEW_H / 2 + 10, Math.max(4, w * k + (Math.sin(this.t * 6) + 1) * 4 * (1 - k)), 6);
  },
};
{ const ov = document.getElementById('loading'); if (ov) ov.style.display = 'none'; }
preload();
let started = false;
const qp = new URLSearchParams(location.search);
function start() {
  if (started) return; started = true;
  const ov = document.getElementById('loading'); if (ov) ov.remove();
if (qp.has('play')) { game.reset(); app.go(app.scenes.play(parseInt(qp.get('play'), 10) || 0), { fade: false }); }
else app.go(app.scenes.boot ? app.scenes.boot() : app.scenes.title(), { fade: false });
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
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
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
