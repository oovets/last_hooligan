#!/usr/bin/env node
// Samples the 2D pose library (src/game/poses.js) into discrete sprite "clips" for the Blender renderer.
// Output: assets/sprites/clips.json  { clips: { name: { kind:'loop'|'once'|'attack', dur, frames:[pose,...] } } }
// Runtime frame selection lives in src/game/sprites.js (clipFrame()).
import { writeFileSync, mkdirSync } from 'node:fs';

// minimal fake DOM so every content module (which registers extra anims/attack poses) can be imported
const noop = () => {};
const fakeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : noop), set: (t, k, v) => { t[k] = v; return true; } });
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx(), style: {} }), getElementById: () => null };
globalThis.localStorage = { getItem: () => null, setItem: noop };
if (!globalThis.navigator) globalThis.navigator = { getGamepads: () => [] };
globalThis.addEventListener = noop;

await import('../src/content/index.js');
await import('../src/content/levels/index.js');
await import('../src/content/characters.js');
const { ANIMS, ATTACK_POSES, sampleAnim, attackPose, animDuration, GUARD, fillPose } = await import('../src/game/poses.js');

const clips = {};
const MAXF = { walk: 8, run: 8, fightWalk: 8, idle: 4, guard: 4, dodge: 6, knockdown: 4, getup: 4, thrown: 3, dizzy: 4, taunt: 4, victory: 4, cheer: 4 };

for (const [name, A] of Object.entries(ANIMS)) {
  const total = animDuration(name);
  let n;
  // core animations get the full frame budget; level/boss/extra anims are capped to keep render time sane
  const core = MAXF[name] !== undefined || ['hurt', 'hurtGut', 'block', 'blockHit', 'jump', 'fall', 'land', 'down', 'dead', 'grabbed', 'grabbing', 'pickup', 'drink'].includes(name);
  if (A.loop) n = Math.max(2, Math.min(MAXF[name] || (core ? 6 : 4), Math.round(total / 0.1)));
  else n = Math.max(1, Math.min(MAXF[name] || (core ? 5 : 3), Math.round(total / 0.08)));
  if (A.frames.length === 1) n = 1;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = A.loop ? (i / n) * total : n === 1 ? total : (i / (n - 1)) * total;
    frames.push(round(sampleAnim(name, t, {})));
  }
  clips[name] = { kind: A.loop ? 'loop' : 'once', dur: total, frames };
}
for (const name of Object.keys(ATTACK_POSES)) {
  const frames = [
    attackPose(name, 0, 0.5, GUARD, {}),
    attackPose(name, 0, 1, GUARD, {}),
    attackPose(name, 1, 1, GUARD, {}),
    attackPose(name, 2, 0.45, GUARD, {}),
  ].map(round);
  clips['atk_' + name] = { kind: 'attack', dur: 0, frames };
}
function round(p) { const o = {}; for (const k in fillPose(p)) o[k] = Math.round(p[k] * 1000) / 1000; return o; }

// --out <file> --only a,b,c  -> export just those clips (supplementary atlas, see build_sprites.py --suffix)
const argv = process.argv.slice(2);
const outArg = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const onlyArg = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;
if (onlyArg) for (const k of Object.keys(clips)) if (!onlyArg.has(k)) delete clips[k];
mkdirSync(new URL('../assets/sprites/', import.meta.url), { recursive: true });
const out = outArg ? new URL('../' + outArg, import.meta.url) : new URL('../assets/sprites/clips.json', import.meta.url);
writeFileSync(out, JSON.stringify({ clips }, null, 0));
const nf = Object.values(clips).reduce((s, c) => s + c.frames.length, 0);
console.log(`exported ${Object.keys(clips).length} clips, ${nf} frames -> ${outArg || 'assets/sprites/clips.json'}`);
