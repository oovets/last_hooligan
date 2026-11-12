// THE LAST HOOLIGAN — 3D renderer (phase A, docs/DESIGN-V2.md).
//
// Mirrors a World into a Three.js scene every frame. The simulation is untouched: this module only READS world state.
//
// Coordinates: world (x, y) tiles -> three (x, z); world height z (units) -> three y = z * ZS.
// The orthographic camera looks down 30° from the +x+y side, which reproduces the 2D projection exactly
// (toScreen: x = (x-y)*16, y = (x+y)*8 - z*20). That keeps every 2D overlay (HUD, particles, popups,
// speech bubbles, GO arrow, weather) pixel-aligned with the 3D scene, so they are drawn on the 2D canvas on top.
//
// Phase A content mapping:
//   floors  -> one top-down texture baked from the floor styles (and Blender floor patches) on a ground plane
//   walls   -> instanced boxes per (style, height, variant) with textures from the wall style's face()/top()
//   fighters -> rigged 3D characters posed live from the pose library (characters.js, phase B); billboard fallback
//   props, items, projectiles, vehicles -> camera-facing vertical "billboards" that reuse the existing
//              2D drawing code (Blender sprites + procedural art) until they get real 3D models (phase F)
//   lights  -> hemisphere + shadow-casting directional light from level.ambient, a pool of point lights for level lights
//   walls in front of the player are dithered away (see-through) instead of the 2D alpha fade

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Colour grade + vignette (applied before tone mapping / output): a touch more contrast and saturation, cool shadows,
// warm highlights — the sodium-lamp-and-rain look.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uContrast: { value: 1.08 }, uSat: { value: 1.12 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette, uContrast, uSat; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.18) * uContrast + 0.18;
      c.rgb += mix(vec3(-0.01, 0.0, 0.02), vec3(0.025, 0.012, -0.01), smoothstep(0.05, 0.6, l));
      vec2 d = vUv - 0.5; c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(max(c.rgb, 0.0), c.a);
    }`,
};
import { VIEW_W, VIEW_H, HALF_W, HALF_H, Z_PX } from '../engine/constants.js';
import { toScreen } from '../engine/iso.js';
import { FLOORS, WALLS } from '../engine/tiles.js';
import { envFloor } from '../engine/envsprites.js';
import { hash2 } from '../engine/rng.js';
import { hexToRgb } from '../engine/color.js';
import { setQuant } from '../game/poses.js';
import { CHAR, Character3D, modelFor, loadCharacterModels } from './characters.js';
import { CHAR2, Character2, modelFor2, loadCharacters2 } from './characters2.js';

export { loadCharacterModels, loadCharacters2 };

const ELEV = Math.PI / 6;                         // camera elevation (30°) -> 2:1 dimetric
const K = HALF_W * Math.SQRT2;                    // screen px per world unit across the screen (22.63)
const PXV = K * Math.cos(ELEV);                   // px per three-unit of vertical extent (19.6)
const ZS = Z_PX / PXV;                            // three units per height unit (1.0206, as in the Blender pipeline)
const VIEW_DIR = new THREE.Vector3(Math.cos(ELEV) / Math.SQRT2, Math.sin(ELEV), Math.cos(ELEV) / Math.SQRT2); // target -> camera
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const RS = 2;                                     // billboard canvas resolution (matches the 2x sprite detail)
const FLOOR_T = 24;                               // floor texels per tile
const MAX_POINT_LIGHTS = 10;
const CULL_R = 24;                                // world units around the camera target that get billboards

const v3 = (x, y, z = 0) => new THREE.Vector3(x, z * ZS, y);

export class Renderer3D {
  constructor(glCanvas, canvas2d) {
    this.gl = glCanvas;
    this.c2d = canvas2d;
    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.world = null;
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this.scratch = document.createElement('canvas');
    this.scratch.width = 512 * RS; this.scratch.height = 512 * RS;
    this.sg = this.scratch.getContext('2d', { willReadFrequently: true });
    this.frame = 0;
    // see-through uniforms shared by every wall material
    this.see = { uSeePos: { value: new THREE.Vector2(-1e5, -1e5) }, uSeeDepth: { value: 0 }, uSeeR: { value: new THREE.Vector2(50, 80) } };
    this.stats = { boards: 0, redraws: 0, ms: 0, chars: 0 };
    // post-processing (ambient occlusion, bloom, grade); ?post=0 turns it off
    this.post = new URLSearchParams(location.search).get('post') !== '0';
    setQuant(0);   // smooth (unquantised) pose sampling: the 3D characters are posed every frame
  }

  // ------------------------------------------------------------------ lifecycle
  begin(world) {
    this.end();
    this.world = world;
    const L = world.level;
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(L.bg || '#07060c');
    this.disposables = [];
    this.camera = new THREE.OrthographicCamera(-VIEW_W / 2 / K, VIEW_W / 2 / K, VIEW_H / 2 / K, -VIEW_H / 2 / K, 1, 800);
    this.camera.layers.enable(1);
    this.aoCamera = this.camera.clone(); this.aoCamera.layers.set(0);
    this.buildFloor(world);
    this.buildWalls(world);
    this.buildLights(world);
    this.composer = null;             // built on first render (needs the camera + size)
    this.boards = new Map();          // entity -> board
    this.chars = new Map();           // fighter -> Character3D
    this.gl.style.display = 'block';
    this.c2d.style.background = 'transparent';
  }

  end() {
    if (!this.world) return;
    for (const b of this.boards.values()) this.disposeBoard(b);
    for (const c of this.chars.values()) this.disposeChar(c);
    this.chars = null;
    for (const d of this.disposables) d.dispose();
    if (this.composer) { this.composer.dispose && this.composer.dispose(); this.composer = null; }
    this.boards = null; this.scene = null; this.world = null;
    this.gl.style.display = 'none';
    this.c2d.style.background = '';
  }

  track(o) { this.disposables.push(o); return o; }

  // ------------------------------------------------------------------ floor
  buildFloor(world) {
    const map = world.map, W = map.w, H = map.h, T = FLOOR_T;
    const c = document.createElement('canvas');
    c.width = W * T; c.height = H * T;
    const g = c.getContext('2d');
    const img = g.createImageData(c.width, c.height), d = img.data;
    const bg = hexToRgb(world.level.bg || '#07060c');
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const fid = map.floor[ty * W + tx];
      const def = fid ? (FLOORS[fid] || FLOORS.void) : null;
      const env = fid ? envFloor(fid) : null;
      const r = hash2(tx, ty, 7);
      for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
        const u = (px + 0.5) / T, v = (py + 0.5) / T;
        const i = ((ty * T + py) * c.width + tx * T + px) * 4;
        let rgb = null;
        if (env) {
          const n = env.n;
          const ii = (((tx % n) + n) % n) + u, jj = (((ty % n) + n) % n) + v;
          const sx = Math.floor(env.w / 2 + (ii - jj) * HALF_W * 2), sy = Math.floor((ii + jj) * HALF_H * 2);
          if (sx >= 0 && sy >= 0 && sx < env.w && sy < env.h) {
            const si = (sy * env.w + sx) * 4;
            if (env.data[si + 3] > 0) rgb = [env.data[si], env.data[si + 1], env.data[si + 2]];
          }
        }
        if (!rgb && def) { const col = def.pixel(u, v, tx, ty, r); if (col) rgb = hexToRgb(col); }
        if (!rgb) rgb = bg;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;
    const mat = this.track(new THREE.MeshLambertMaterial({ map: tex }));
    mat.depthWrite = false;   // billboards may dip below ground level; the floor never hides them
    const geo = this.track(new THREE.PlaneGeometry(W, H));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(W / 2, 0, H / 2);
    mesh.receiveShadow = true;
    mesh.renderOrder = -1e9;
    this.scene.add(mesh);
  }

  // ------------------------------------------------------------------ walls
  wallTextures(style, h, variant) {
    const def = WALLS[style] || WALLS.default;
    const nv = def.variants || 4;
    const v = ((variant % nv) + nv) % nv;
    const key = style + '|' + h + '|' + v;
    this.wallTex ||= new Map();
    let t = this.wallTex.get(key);
    if (t) return t;
    const r = hash2(v, h, 3);
    const Hpx = Math.max(1, Math.round(h * Z_PX)), Wpx = 32;
    const side = document.createElement('canvas'); side.width = Wpx; side.height = Hpx;
    const sg = side.getContext('2d'), si = sg.createImageData(Wpx, Hpx);
    let holes = false;
    for (let y = 0; y < Hpx; y++) for (let x = 0; x < Wpx; x++) {
      const col = def.face((x + 0.5) / Wpx, y, 'left', Hpx, r, v, h);
      const i = (y * Wpx + x) * 4;
      if (!col) { holes = true; continue; }
      const c = hexToRgb(col); si.data[i] = c[0]; si.data[i + 1] = c[1]; si.data[i + 2] = c[2]; si.data[i + 3] = 255;
    }
    sg.putImageData(si, 0, 0);
    const top = document.createElement('canvas'); top.width = 16; top.height = 16;
    const tg = top.getContext('2d'), ti = tg.createImageData(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const col = typeof def.top === 'function' ? def.top((x + 0.5) / 16, (y + 0.5) / 16, v, h, r) : def.top;
      const c = hexToRgb(col || '#555'); const i = (y * 16 + x) * 4;
      ti.data[i] = c[0]; ti.data[i + 1] = c[1]; ti.data[i + 2] = c[2]; ti.data[i + 3] = 255;
    }
    tg.putImageData(ti, 0, 0);
    const mk = cv => { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.magFilter = THREE.NearestFilter; tx.anisotropy = this.maxAniso; return tx; };
    t = { side: mk(side), top: mk(top), holes };
    this.wallTex.set(key, t);
    return t;
  }

  seeThrough(mat) {
    const see = this.see;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, see);
      sh.fragmentShader = 'uniform vec2 uSeePos;\nuniform float uSeeDepth;\nuniform vec2 uSeeR;\n' + sh.fragmentShader.replace('void main() {', `void main() {
  {
    vec2 dd = (gl_FragCoord.xy - uSeePos) / uSeeR;
    float e = dot(dd, dd);
    if (e < 1.0 && gl_FragCoord.z < uSeeDepth) {
      float bayer = mod(floor(gl_FragCoord.x) + 2.0 * floor(gl_FragCoord.y), 4.0) / 4.0;
      if ((1.0 - e) * 2.2 > bayer + 0.2) discard;
    }
  }`);
    };
    return mat;
  }

  wallMaterials(style, h, variant, fake) {
    const t = this.wallTextures(style, h, variant);
    const o = { transparent: fake, opacity: 1, alphaTest: t.holes ? 0.5 : 0, side: t.holes ? THREE.DoubleSide : THREE.FrontSide };
    const sideM = this.track(this.seeThrough(new THREE.MeshLambertMaterial({ map: t.side, ...o })));
    const topM = this.track(this.seeThrough(new THREE.MeshLambertMaterial({ map: t.top, ...o })));
    // BoxGeometry groups: +x, -x, +y, -y, +z, -z
    return [sideM, sideM, topM, topM, sideM, sideM];
  }

  buildWalls(world) {
    const groups = new Map();
    const fakes = [];
    for (const w of world.walls) {
      const W = w.w;
      if (W.fake) { fakes.push(w); continue; }
      const def = WALLS[W.style] || WALLS.default;
      const nv = def.variants || 4;
      const key = W.style + '|' + W.h + '|' + (((W.variant % nv) + nv) % nv);
      let g = groups.get(key);
      if (!g) groups.set(key, g = { style: W.style, h: W.h, variant: W.variant, list: [] });
      g.list.push(w);
    }
    const m = new THREE.Matrix4();
    for (const g of groups.values()) {
      const geo = this.track(new THREE.BoxGeometry(1, g.h * ZS, 1));
      geo.translate(0, g.h * ZS / 2, 0);
      const mesh = new THREE.InstancedMesh(geo, this.wallMaterials(g.style, g.h, g.variant, false), g.list.length);
      g.list.forEach((w, i) => { m.makeTranslation(w.tx + 0.5, 0, w.ty + 0.5); mesh.setMatrixAt(i, m); });
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    this.fakeWalls = fakes.map(w => {
      const geo = this.track(new THREE.BoxGeometry(1, w.w.h * ZS, 1));
      geo.translate(0, w.w.h * ZS / 2, 0);
      const mats = this.wallMaterials(w.w.style, w.w.h, w.w.variant, true).map(mm => mm);
      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(w.tx + 0.5, 0, w.ty + 0.5);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh);
      return { w, mesh, mats: [...new Set(mats)] };
    });
  }

  // ------------------------------------------------------------------ lights
  buildLights(world) {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a24, 1);
    this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.points = [];
    for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 6, 1.6);
      this.points.push(p); this.scene.add(p);
    }
    this.playerLight = new THREE.PointLight(0xffffff, 0, 6, 1.6);
    this.scene.add(this.playerLight);
  }

  updateLights(world, target) {
    const amb = world.ambientOverride || world.level.ambient || { dark: 0 };
    const dark = Math.max(0, Math.min(0.95, amb.dark || 0));
    const b = 1 - dark;
    const tint = new THREE.Color(amb.color || '#06071a').lerp(new THREE.Color('#ffffff'), 0.35 + 0.6 * b);
    this.hemi.color.copy(tint);
    this.hemi.groundColor.set('#141018');
    this.hemi.intensity = 0.55 + 1.9 * b;
    // sun by day, cold moon at night; light from the upper-left of the screen (lights the +y "left" faces)
    this.sun.color.set(dark > 0.35 ? '#9fb0e8' : '#fff1dc');
    this.sun.intensity = 0.25 + 2.4 * b * b;
    this.sun.position.copy(target).add(new THREE.Vector3(-8, 22, 14));
    this.sun.target.position.copy(target);
    // point light pool: the level lights nearest to the view
    const t = world.time;
    const cand = [];
    for (const l of world.lights) {
      if (l.active === false) continue;
      const dx = l.x - target.x, dy = l.y - target.z, d2 = dx * dx + dy * dy;
      if (d2 < 30 * 30) cand.push({ l, d2 });
    }
    cand.sort((a, c) => a.d2 - c.d2);
    const night = 0.35 + dark * 1.3;
    for (let i = 0; i < this.points.length; i++) {
      const P = this.points[i], c = cand[i];
      if (!c) { P.intensity = 0; continue; }
      const l = c.l;
      let inten = l.intensity ?? 0.9;
      if (l.flicker) inten *= 0.75 + 0.25 * Math.sin(t * 23 + l.x * 3) * Math.sin(t * 7 + l.y);
      P.color.set(l.color || '#ffcf7a');
      P.position.set(l.x, Math.max(0.6, (l.z ?? 1.5)) * ZS, l.y);
      P.distance = (l.r || 4) * 1.7;
      P.intensity = inten * 9 * night;
    }
    const p = world.player;
    this.playerLight.position.set(p.x, (p.z + 2.2) * ZS, p.y);
    this.playerLight.distance = (amb.playerLight ?? 3) * 1.6;
    this.playerLight.intensity = dark > 0.25 ? 2.5 * dark : 0;
  }

  // ------------------------------------------------------------------ billboards
  makeBoard(wl, hl, ax, ay) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(wl * RS)); canvas.height = Math.max(1, Math.ceil(hl * RS));
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.03, side: THREE.DoubleSide, depthWrite: true });
    const mesh = new THREE.Mesh(this.planeGeo, mat);
    mesh.rotation.y = Math.PI / 4;
    mesh.scale.set(wl / K, hl / PXV, 1);
    mesh.receiveShadow = true;
    mesh.layers.set(1);              // billboards: hidden from the ambient-occlusion pass (flat cards would cast AO squares)
    this.scene.add(mesh);
    return { canvas, g, tex, mat, mesh, wl, hl, ax, ay, seen: 0 };
  }

  disposeBoard(b) {
    if (!b.mesh) return;   // empty prop (draws nothing)
    if (this.scene) this.scene.remove(b.mesh);
    b.tex.dispose(); b.mat.dispose();
  }

  placeBoard(b, wx, wy, wz, order, shift = 0) {
    const m = b.mesh;
    m.position.set(wx, wz * ZS, wy)
      .addScaledVector(RIGHT, (b.wl / 2 - b.ax) / K)
      .addScaledVector(THREE.Object3D.DEFAULT_UP, (b.ay - b.hl / 2) / PXV)
      .addScaledVector(VIEW_DIR, shift);
    m.renderOrder = Math.round(order * 64);
    m.visible = true;
  }

  // draw into a board canvas with the 2D projection: world point (wx,wy,wz) lands on the board anchor
  paint(b, wx, wy, wz, fn) {
    const g = b.g;
    g.setTransform(RS, 0, 0, RS, 0, 0);
    g.clearRect(0, 0, b.wl, b.hl);
    const s = toScreen(wx, wy, wz);
    g.translate(b.ax - Math.round(s.x), b.ay - Math.round(s.y));
    fn(g);
    b.tex.needsUpdate = true;
    this.stats.redraws++;
  }

  // props: paint once into the scratch canvas, crop to the drawn pixels, keep that box for re-paints
  propBoard(p) {
    const world = this.world;
    const fw = p.w + p.d;
    const wl = fw * HALF_W + 96, hl = 300;
    const ax = wl / 2, ay = hl - fw * HALF_H / 2 - 24;
    const sg = this.sg;
    sg.setTransform(RS, 0, 0, RS, 0, 0);
    sg.clearRect(0, 0, wl, hl);
    const s = toScreen(p.cx, p.cy, p.base);
    sg.save(); sg.translate(ax - Math.round(s.x), ay - Math.round(s.y));
    try { world.drawProp(sg, p); } catch (e) { /* a prop that needs the full 2D frame; skip */ }
    sg.restore();
    const W = Math.ceil(wl * RS), H = Math.ceil(hl * RS);
    const data = sg.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { empty: true };
    const m = 6 * RS;
    x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
    const bw = (x1 - x0 + 1) / RS, bh = (y1 - y0 + 1) / RS;
    const b = this.makeBoard(bw, bh, ax - x0 / RS, ay - y0 / RS);
    b.crop = { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, wl, hl, ax, ay };
    b.g.setTransform(1, 0, 0, 1, 0, 0);
    b.g.drawImage(this.scratch, x0, y0, b.crop.w, b.crop.h, 0, 0, b.crop.w, b.crop.h);
    b.tex.needsUpdate = true;
    const decal = !p.solid && (p.h || 0) <= 0 && (p.o.side || /sign|graffiti|banner|poster|tactics|shirts/.test(p.type));
    b.shift = decal ? 0.9 : 0.12;
    return b;
  }

  repaintProp(b, p) {
    const c = b.crop, sg = this.sg;
    sg.setTransform(RS, 0, 0, RS, 0, 0);
    sg.clearRect(0, 0, c.wl, c.hl);
    const s = toScreen(p.cx, p.cy, p.base);
    sg.save(); sg.translate(c.ax - Math.round(s.x), c.ay - Math.round(s.y));
    try { this.world.drawProp(sg, p); } catch (e) { /* ignore */ }
    sg.restore();
    b.g.setTransform(1, 0, 0, 1, 0, 0);
    b.g.clearRect(0, 0, c.w, c.h);
    b.g.drawImage(this.scratch, c.x0, c.y0, c.w, c.h, 0, 0, c.w, c.h);
    b.tex.needsUpdate = true;
    this.stats.redraws++;
  }

  syncBoards(world, target) {
    const F = ++this.frame;
    const near = (x, y) => Math.abs(x - target.x) + Math.abs(y - target.z) < CULL_R * 1.4;
    const boards = this.boards;
    // props
    for (const p of world.props) {
      if (p.removed) continue;
      let b = boards.get(p);
      const vis = near(p.cx, p.cy);
      if (!b) { if (!vis) continue; b = this.propBoard(p); boards.set(p, b); b.sig = sigOf(p); }
      b.seen = F;
      if (b.empty) continue;
      if (!vis) { b.mesh.visible = false; continue; }
      // repaint: state changes immediately, otherwise animated props at ~15 fps (staggered)
      const sig = sigOf(p);
      if (sig !== b.sig || (F + p.id) % 4 === 0) { b.sig = sig; this.repaintProp(b, p); }
      this.placeBoard(b, p.cx, p.cy, p.base, p.depth(), b.shift);
    }
    // fighters
    const keepQ = world.overheadQueue;
    world.overheadQueue = [];
    for (const f of world.fighters) {
      if (f.removed) continue;
      if ((CHAR2.ready && modelFor2(f.look)) || (CHAR.ready && modelFor(f.look))) { this.syncChar(f, world, F, near(f.x, f.y)); continue; }
      if (!near(f.x, f.y)) { const b0 = boards.get(f); if (b0) { b0.seen = F; b0.mesh.visible = false; } continue; }
      const sc = Math.max(1, (f.look && f.look.height) || 1) * (f.spriteScale || 1);
      let b = boards.get(f);
      if (!b || b.sc !== sc) {
        if (b) this.disposeBoard(b);
        const wl = 120 * sc, hl = 150 * sc + 60;
        b = this.makeBoard(wl, hl, wl / 2, hl - 16);
        b.sc = sc; boards.set(f, b);
      }
      b.seen = F;
      const g = world.groundHeight(f.x, f.y, f.z);
      this.paint(b, f.x, f.y, g, ctx => f.draw(ctx, world));
      this.placeBoard(b, f.x, f.y, g, f.x + f.y + (f.isDown ? -0.15 : 0) + 0.001 * f.z, 0);
    }
    world.overheadQueue = keepQ;
    // items, projectiles
    for (const list of [world.items, world.projectiles]) for (const it of list) {
      if (it.removed || !near(it.x, it.y)) continue;
      let b = boards.get(it);
      if (!b) { b = this.makeBoard(64, 72, 32, 56); boards.set(it, b); }
      b.seen = F;
      this.paint(b, it.x, it.y, 0, ctx => it.draw(ctx, world));
      this.placeBoard(b, it.x, it.y, 0, it.x + it.y + 0.002 * (it.z || 0), 0.05);
    }
    // vehicles (traffic)
    for (const v of world.vehicles) {
      if (v.removed || !near(v.x, v.y)) continue;
      let b = boards.get(v);
      if (!b) { b = this.makeBoard(200, 140, 100, 96); boards.set(v, b); }
      b.seen = F;
      this.paint(b, v.x, v.y, 0, ctx => world.drawVehicle(ctx, v));
      this.placeBoard(b, v.x, v.y, 0, v.x + v.y, 0.1);
    }
    // drop boards whose entity is gone or was not seen this frame
    for (const [e, b] of boards) if (b.seen !== F) { this.disposeBoard(b); boards.delete(e); }
    for (const [f, c] of this.chars) if (c.seen !== F) { this.disposeChar(c); this.chars.delete(f); }
    this.stats.boards = boards.size;
    this.stats.chars = this.chars.size;
  }

  // ------------------------------------------------------------------ 3D characters
  syncChar(f, world, F, vis) {
    let c = this.chars.get(f);
    if (!c) {
      // v2 (skinned + layered animator) when its models are loaded, else the v1 rigid-part characters
      c = CHAR2.ready && modelFor2(f.look) ? new Character2(f.look) : new Character3D(f.look);
      this.chars.set(f, c); this.scene.add(c.group, c.blob);
    }
    c.seen = F;
    f._char3d = true;
    c.group.visible = c.blob.visible = vis;
    if (!vis) return;
    c.update(f, world);
    if (c.animate) { const dt = c.lastT === undefined ? 1 / 60 : world.time - c.lastT; c.lastT = world.time; c.animate(f, world, dt); }
    else c.pose(f.getPose(), f.fx, f.fy);
    c.group.position.set(f.x, f.z * ZS, f.y);
    const g = world.groundHeight(f.x, f.y, f.z);
    const air = Math.max(0, f.z - g);
    const s = ((f.look && f.look.height) || 1) * Math.max(0.8, Math.min(1.6, (f.look && f.look.build) || 1)) / (1 + air * 0.35);
    c.blob.position.set(f.x, g * ZS + 0.015, f.y);
    c.blob.scale.setScalar(s);
    c.blob.visible = c.group.visible;
  }

  disposeChar(c) {
    if (this.scene) this.scene.remove(c.group, c.blob);
    c.dispose();
  }

  // ------------------------------------------------------------------ frame
  render(world) {
    const t0 = performance.now();
    if (world !== this.world) this.begin(world);
    this.resize();
    const cam = world.camera;
    // screen centre in projected px -> ground point under it
    const cx = VIEW_W / 2 - cam.tx, cy = VIEW_H / 2 - cam.ty;
    const gx = (cx / HALF_W + cy / HALF_H) / 2, gy = (cy / HALF_H - cx / HALF_W) / 2;
    const target = new THREE.Vector3(gx, 0, gy);
    // zoom > 1 frames the player closer (2D overlays are only aligned at zoom 1; used for close-ups/duels later)
    const z = this.zoom || 1;
    if (z !== 1) target.lerp(v3(world.player.x, world.player.y, world.player.z + 0.8), 1 - 1 / z);
    if (this.camera.zoom !== z) { this.camera.zoom = z; this.camera.updateProjectionMatrix(); }
    this.camera.position.copy(target).addScaledVector(VIEW_DIR, 300);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    this.updateLights(world, target);
    this.syncBoards(world, target);
    // fake walls fade when the player is close (as in 2D)
    const p = world.player;
    for (const fw of this.fakeWalls) {
      const near = Math.hypot(fw.w.tx + 0.5 - p.x, fw.w.ty + 0.5 - p.y) < 2.2;
      for (const m of fw.mats) m.opacity = near ? 0.45 : 1;
    }
    // see-through hole around the player's body
    const sz = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const body = v3(p.x, p.y, p.z + 0.9);
    const ndc = body.clone().project(this.camera);
    const front = body.clone().addScaledVector(VIEW_DIR, 0.45).project(this.camera);
    this.see.uSeePos.value.set((ndc.x * 0.5 + 0.5) * sz.x, (ndc.y * 0.5 + 0.5) * sz.y);
    this.see.uSeeDepth.value = front.z * 0.5 + 0.5;
    const k = sz.x / VIEW_W;
    this.see.uSeeR.value.set(26 * k, 40 * k);
    if (this.post) {
      try {
        if (!this.composer) this.buildComposer();
        this.aoCamera.copy(this.camera); this.aoCamera.layers.set(0);
        this.composer.render();
      } catch (e) { console.warn('[3d] post-processing off', e); this.post = false; this.composer = null; this.renderer.render(this.scene, this.camera); }
    } else this.renderer.render(this.scene, this.camera);
    this.stats.ms = performance.now() - t0;
  }

  buildComposer() {
    const r = this.renderer, sz = r.getSize(new THREE.Vector2());
    const c = this.composer = new EffectComposer(r);
    c.setPixelRatio(r.getPixelRatio());
    c.setSize(sz.x, sz.y);
    c.addPass(new RenderPass(this.scene, this.camera));
    const ao = new GTAOPass(this.scene, this.aoCamera, sz.x, sz.y);
    ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.2, thickness: 1.5, scale: 1.1, samples: 12 });
    ao.blendIntensity = 0.85;
    c.addPass(ao);
    const bloom = new UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), 0.42, 0.55, 0.78);
    c.addPass(bloom);
    c.addPass(new ShaderPass(GradeShader));
    c.addPass(new OutputPass());
    this.composerSize = sz.clone();
  }

  resize() {
    const r = this.c2d.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== this.cw || h !== this.ch || dpr !== this.dpr) {
      this.cw = w; this.ch = h; this.dpr = dpr;
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
      if (this.composer) { this.composer.setPixelRatio(dpr); this.composer.setSize(w, h); }
    }
  }
}

function sigOf(p) { return (p.open ? 1 : 0) + '|' + (p.flash > 0 ? 1 : 0) + '|' + Math.round(p.hp === Infinity ? -1 : p.hp); }
