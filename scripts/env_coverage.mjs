#!/usr/bin/env node
// Lists every wall (style,height), floor and prop used by the levels and whether a Blender sprite exists in assets/env/index.json.
//   node scripts/env_coverage.mjs [levelId] [--missing]
import { readFileSync, existsSync } from 'node:fs';
const noop = () => {};
const fakeCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : noop), set: (t, k, v) => { t[k] = v; return true; } });
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx(), style: {} }), getElementById: () => null };
globalThis.localStorage = { getItem: () => null, setItem: noop };
if (!globalThis.navigator) globalThis.navigator = { getGamepads: () => [] };
globalThis.addEventListener = noop;
await import('../src/content/index.js');
const { LEVELS } = await import('../src/content/levels/index.js');
const { TileMap } = await import('../src/engine/tilemap.js');
const idxPath = new URL('../assets/env/index.json', import.meta.url);
const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath)) : { walls: {}, floors: {}, props: {} };
const args = process.argv.slice(2), only = args.filter(a => !a.startsWith('--')), MISSING = args.includes('--missing');
for (const L of LEVELS) {
  if (only.length && !only.includes(L.id)) continue;
  const m = new TileMap(L);
  const walls = new Map(), floors = new Map(), props = new Map();
  m.wall.forEach(w => { if (w) { const k = w.style + '@' + w.h; walls.set(k, (walls.get(k) || 0) + 1); } });
  m.floor.forEach(f => { if (f) floors.set(f, (floors.get(f) || 0) + 1); });
  for (const p of [...m.propSpawns, ...(L.props || [])]) props.set(p.type, (props.get(p.type) || 0) + 1);
  const line = (kind, k, n, ok) => { if (!MISSING || !ok) console.log(`  ${ok ? 'OK  ' : 'MISS'} ${kind} ${k} x${n}`); };
  console.log(`== ${L.id}`);
  for (const [k, n] of [...walls].sort((a, b) => b[1] - a[1])) { const [s, h] = k.split('@'); line('wall ', k, n, !!(idx.walls[s] && idx.walls[s].heights[String(+h)])); }
  for (const [k, n] of [...floors].sort((a, b) => b[1] - a[1])) line('floor', k, n, !!idx.floors[k]);
  for (const [k, n] of [...props].sort((a, b) => b[1] - a[1])) line('prop ', k, n, !!idx.props[k] || k === 'sign' || k === 'graffiti');
}
