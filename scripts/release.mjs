#!/usr/bin/env node
// Prepare a release copy of the game for the web (used by scripts/deploy.sh on a staging folder, never on the repo):
//   node scripts/release.mjs <dir>
// 1. Writes <link rel="modulepreload"> for every module the game can load (the static + dynamic import graph from
//    src/main.js, plus Three.js and the addons it pulls in) into index.html. Without it the browser discovers the ~150
//    modules one import at a time, a round trip per level of the graph, which made first loads take 10-20 s.
// 2. The public build has sound: src/devflags.js mute:false (the dev checkout stays silent).
// 3. Cache-busting: every model and env sprite listed in an assets index.json gets ?v=<content hash> in its URL, and
//    every module import gets ?v=<release> (REV env var, from deploy.sh), so the server lets browsers and Cloudflare
//    keep them forever (a changed file / a new release gets new URLs) while index.html and the index files are
//    revalidated on every load (deploy/hooligan.sthlm.fun.nginx).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = path.resolve(process.argv[2] || '.');
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
// three addons the game imports and what they import in turn (r170)
const ADDON_DEPS = {
  'loaders/GLTFLoader.js': ['utils/BufferGeometryUtils.js'],
  'postprocessing/EffectComposer.js': ['shaders/CopyShader.js', 'postprocessing/ShaderPass.js', 'postprocessing/MaskPass.js', 'postprocessing/Pass.js'],
  'postprocessing/GTAOPass.js': ['postprocessing/Pass.js', 'shaders/CopyShader.js', 'shaders/GTAOShader.js', 'shaders/PoissonDenoiseShader.js', 'math/SimplexNoise.js'],
  'postprocessing/OutputPass.js': ['postprocessing/Pass.js', 'shaders/OutputShader.js'],
  'postprocessing/RenderPass.js': ['postprocessing/Pass.js'],
  'postprocessing/ShaderPass.js': ['postprocessing/Pass.js'],
  'postprocessing/UnrealBloomPass.js': ['postprocessing/Pass.js', 'shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js'],
};

const local = new Set(), remote = new Set();
const RE = /(?:import|export)\s*(?:[^'"()]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function walk(file) {
  if (local.has(file) || !fs.existsSync(file)) return;
  local.add(file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(RE)) {
    const spec = m[1] || m[2];
    if (spec === 'three') { remote.add(THREE + 'build/three.module.js'); continue; }
    if (spec.startsWith('three/addons/')) {
      const a = spec.slice('three/addons/'.length);
      remote.add(THREE + 'examples/jsm/' + a);
      for (const d of ADDON_DEPS[a] || []) remote.add(THREE + 'examples/jsm/' + d);
      continue;
    }
    if (spec.startsWith('.')) walk(path.resolve(path.dirname(file), spec));
  }
}
walk(path.join(dir, 'src/main.js'));

const REL = (process.env.REV || Date.now().toString(36)).replace(/[^\w.-]/g, '');
const rel = [...local].map(f => path.relative(dir, f).split(path.sep).join('/')).sort();
const links = [...[...remote].sort().map(u => `<link rel="modulepreload" href="${u}" crossorigin>`), ...rel.map(f => `<link rel="modulepreload" href="${f}?v=${REL}">`)];
const idxFile = path.join(dir, 'index.html');
let html = fs.readFileSync(idxFile, 'utf8');
html = html.replace('<script type="module" src="src/main.js"></script>', `<!-- release: preload the whole module graph in parallel -->\n${links.join('\n')}\n<script type="module" src="src/main.js?v=${REL}"></script>`);
if (!html.includes(`src/main.js?v=${REL}`)) throw new Error('release: could not version the main script in index.html');
// every relative import in the module graph -> ?v=<release> (the same URLs as the preload links above)
let versioned = 0;
for (const f of local) {
  const src = fs.readFileSync(f, 'utf8');
  const out = src.replace(RE, (m, a, b) => { const spec = a || b; if (!spec || !spec.startsWith('.') || spec.includes('?')) return m; versioned++; return m.replace(spec, spec + '?v=' + REL); });
  if (out !== src) fs.writeFileSync(f, out);
}
fs.writeFileSync(idxFile, html);

const flags = path.join(dir, 'src/devflags.js');
const fsrc = fs.readFileSync(flags, 'utf8'), fout = fsrc.replace(/DEV = \{ mute: true \}/, 'DEV = { mute: false }');
if (fout === fsrc) throw new Error('release: could not switch the sound on in src/devflags.js');
fs.writeFileSync(flags, fout);
// ---- 3. content hashes on asset URLs
const hashOf = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
let hashed = 0;
const ver = (base, file) => { const f = path.join(base, file); if (!fs.existsSync(f)) return file; hashed++; return file + '?v=' + hashOf(f); };
{ // env sprites
  const base = path.join(dir, 'assets/env'), idx = path.join(base, 'index.json');
  if (fs.existsSync(idx)) {
    const j = JSON.parse(fs.readFileSync(idx, 'utf8'));
    for (const w of Object.values(j.walls || {})) for (const e of Object.values(w.heights || {})) e.files = e.files.map(f => ver(base, f));
    for (const f of Object.values(j.floors || {})) f.file = ver(base, f.file);
    for (const p of Object.values(j.props || {})) for (const v of p.variants || []) v.file = ver(base, v.file);
    fs.writeFileSync(idx, JSON.stringify(j));
  }
}
{ // hero models: { models: { id: file } }
  const base = path.join(dir, 'assets/models/hero'), idx = path.join(base, 'index.json');
  if (fs.existsSync(idx)) {
    const j = JSON.parse(fs.readFileSync(idx, 'utf8'));
    for (const k of Object.keys(j.models || {})) j.models[k] = ver(base, j.models[k]);
    fs.writeFileSync(idx, JSON.stringify(j));
  }
}
{ // v2 models: { models: [name] } -> v: { name: hash } (characters2.js appends ?v=)
  const base = path.join(dir, 'assets/models/v2'), idx = path.join(base, 'index.json');
  if (fs.existsSync(idx)) {
    const j = JSON.parse(fs.readFileSync(idx, 'utf8'));
    j.v = {};
    for (const n of j.models || []) { const f = path.join(base, n + '.glb'); if (fs.existsSync(f)) { j.v[n] = hashOf(f); hashed++; } }
    fs.writeFileSync(idx, JSON.stringify(j));
  }
}
console.log(`release ${REL}: ${rel.length} local + ${remote.size} three modules preloaded, ${versioned} imports versioned, sound on, ${hashed} assets hashed`);
