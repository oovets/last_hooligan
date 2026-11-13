#!/usr/bin/env node
// Prepare a release copy of the game for the web (used by scripts/deploy.sh on a staging folder, never on the repo):
//   node scripts/release.mjs <dir>
// 1. Writes <link rel="modulepreload"> for every module the game can load (the static + dynamic import graph from
//    src/main.js, plus Three.js and the addons it pulls in) into index.html. Without it the browser discovers the ~150
//    modules one import at a time, a round trip per level of the graph, which made first loads take 10-20 s.
// 2. The public build has sound: src/devflags.js mute:false (the dev checkout stays silent).
import fs from 'node:fs';
import path from 'node:path';

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

const rel = [...local].map(f => path.relative(dir, f).split(path.sep).join('/')).sort();
const links = [...[...remote].sort().map(u => `<link rel="modulepreload" href="${u}" crossorigin>`), ...rel.map(f => `<link rel="modulepreload" href="${f}">`)];
const idxFile = path.join(dir, 'index.html');
let html = fs.readFileSync(idxFile, 'utf8');
html = html.replace('<script type="module" src="src/main.js"></script>', `<!-- release: preload the whole module graph in parallel -->\n${links.join('\n')}\n<script type="module" src="src/main.js"></script>`);
fs.writeFileSync(idxFile, html);

const flags = path.join(dir, 'src/devflags.js');
const fsrc = fs.readFileSync(flags, 'utf8'), fout = fsrc.replace(/DEV = \{ mute: true \}/, 'DEV = { mute: false }');
if (fout === fsrc) throw new Error('release: could not switch the sound on in src/devflags.js');
fs.writeFileSync(flags, fout);
console.log(`release: ${rel.length} local + ${remote.size} three modules preloaded, sound on`);
