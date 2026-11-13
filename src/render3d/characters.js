// 3D characters for the Three.js renderer (phase B, docs/DESIGN-V2.md).
//
// Models: assets/models/<build>_<torso>.glb, exported from the same Blender builder as the sprites
// (scripts/build_models.py -> scripts/blender/render_char.py "export" mode). Each model is a rigid-part character on a
// joint hierarchy (hip, torso, neck, head, sh/el/th/kn/an + N|F) in its bind pose, with every accessory included.
//
// Animation: no baked clips. Every frame the joints are posed straight from Fighter.getPose() (the game's pose library),
// so every state, attack and boss move that exists in 2D is animated in 3D too. Conversion follows set_pose() in
// render_char.py with glTF's axis swap (rotation about Blender +Y by a == rotation about three +Z by -a).
//
// Looks: the palette, accessories and model choice come from the same LOOK data as the sprites (game/sprites.js
// specForLook): material ID_<n> -> palette colour n; nodes tagged 'acc:<layer>' are shown when the look has that layer.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { specForLook } from '../game/sprites.js';
import { fillPose } from '../game/poses.js';
import { ITEMS } from '../game/items.js';

export const CHAR = { templates: {}, meta: {}, ready: false };
// The 2D sprites draw characters at 28.85 logical px per metre; the 3D camera shows 22.63 px per metre.
// Keep the game's chunky, readable proportions.
export const CHAR_SCALE = 1.275;
const TORSO_OF = { harrington: 'jacket', bomber: 'jacket', track: 'jacket', leather: 'jacket', suit: 'jacket', shirt: 'jacket', parka: 'parka', tee: 'tee', polo: 'tee', vest: 'tee', hivis: 'hivis' };
const JOINTS = ['hip', 'torso', 'neck', 'head', 'shN', 'elN', 'thN', 'knN', 'anN', 'shF', 'elF', 'thF', 'knF', 'anF'];

export async function loadCharacterModels() {
  try {
    const base = new URL('../../assets/models/', import.meta.url);
    const r = await fetch(new URL('index.json', base));
    if (!r.ok) return;
    const { models = [] } = await r.json();
    const loader = new GLTFLoader();
    await Promise.all(models.map(async name => {
      try {
        const g = await loader.loadAsync(new URL(name + '.glb', base).href);
        const root = g.scene.getObjectByName('root') || g.scene;
        let meta = {};
        try { meta = JSON.parse((root.userData && root.userData.hooligan) || '{}'); } catch (e) { /* defaults */ }
        g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
        CHAR.templates[name] = g.scene;
        CHAR.meta[name] = { k: meta.k ?? 0.04, hipH: meta.hipH ?? 0.8, build: meta.build ?? 1 };
      } catch (e) { console.warn('[3d] model failed', name, e); }
    }));
    CHAR.ready = Object.keys(CHAR.templates).length > 0;
  } catch (e) { console.warn('[3d] no character models', e); }
}

export function modelFor(look) {
  const b = look.build || 1;
  const pre = b >= 1.28 ? 'h' : 'm';
  const torso = TORSO_OF[(look.jacket && look.jacket.style) || 'harrington'] || 'jacket';
  for (const c of [`${pre}_${torso}`, `${pre}_jacket`, `m_${torso}`, 'm_jacket']) if (CHAR.templates[c]) return c;
  return null;
}

// 4-band toon ramp (the sprites use a 6-band ramp; 4 reads better with real lights)
let RAMP = null;
function ramp() {
  if (RAMP) return RAMP;
  const d = new Uint8Array([70, 130, 200, 255]);
  RAMP = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
  RAMP.needsUpdate = true;
  return RAMP;
}

const toColor = c => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

export class Character3D {
  constructor(look) {
    this.group = new THREE.Group();
    this.mats = {};
    this.build(look);
    // soft contact shadow so fighters stay grounded in dark levels
    this.blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = -1e8;
  }

  build(look) {
    if (this.inner) { this.group.remove(this.inner); for (const m of Object.values(this.mats)) m.dispose(); this.mats = {}; }
    const spec = specForLook(look);
    this.key = spec.key;
    this.look = look;
    this.model = modelFor(look);
    const tpl = CHAR.templates[this.model];
    this.meta = CHAR.meta[this.model];
    const inner = this.inner = tpl.clone(true);
    const layers = new Set(spec.layers);
    inner.traverse(o => {
      if (!o.isMesh) return;
      const tag = (o.userData && o.userData.tags) || '';
      if (tag.startsWith('acc:')) o.visible = layers.has(tag.slice(4));
      const id = parseInt(String(o.material && o.material.name).replace('ID_', ''), 10) || 3;
      let m = this.mats[id];
      if (!m) {
        const c = spec.pal[id] || [200, 0, 200];
        m = this.mats[id] = new THREE.MeshToonMaterial({ color: toColor(c), gradientMap: ramp() });
        if (id === 13 || id === 19) m.color.multiplyScalar(0.6);   // eyes, shades: stay dark
      }
      o.material = m;
    });
    this.J = {};
    for (const n of JOINTS) this.J[n] = inner.getObjectByName(n);
    this.fistN = inner.getObjectByName('fistN');
    // girth follows the look's build relative to the model's build; height follows look.height
    const bw = Math.max(0.85, Math.min(1.25, (look.build || 1) / (this.meta.build || 1)));
    const h = look.height || 1;
    inner.scale.set(CHAR_SCALE * h, CHAR_SCALE * h, CHAR_SCALE * h * bw);
    this.group.add(inner);
    this.weaponId = null;
  }

  // pose: Fighter.getPose() output (doll units: px offsets, radians)
  pose(p, facingX, facingY) {
    const P = fillPose(p), J = this.J, k = this.meta.k, H = this.meta.hipH;
    J.hip.position.set(P.dx * k, H - P.dy * k, 0);
    J.hip.rotation.set(0, 0, -P.rot);
    J.torso.rotation.set(0, 0, -P.lean);
    J.head.rotation.set(0, 0, -P.head);
    for (const s of ['N', 'F']) {
      J['sh' + s].rotation.set(0, 0, P['ua' + s]);
      J['el' + s].rotation.set(0, 0, P['fa' + s]);
      J['th' + s].rotation.set(0, 0, P['th' + s]);
      J['kn' + s].rotation.set(0, 0, -P['kn' + s]);
      J['an' + s].rotation.set(0, 0, (P['th' + s] - P['kn' + s]) * 0.6);
    }
    const flip = (p.flip || 0) >= 0.5;
    this.group.rotation.y = -Math.atan2(facingY, facingX) + (flip ? Math.PI : 0);
  }

  // held weapon: the item's icon as an upright sprite in the near fist (real weapon models come later)
  setWeapon(def) {
    const id = def ? def.id : null;
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weaponSprite) { this.fistN.remove(this.weaponSprite); this.weaponSprite.material.map.dispose(); this.weaponSprite.material.dispose(); this.weaponSprite = null; }
    if (!def || !def.icon || !this.fistN) return;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.scale(2, 2);
    try { def.icon(g, 16, 26, 0); } catch (e) { /* icon needs more context */ }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = this.weaponSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.1 }));
    s.scale.set(0.42, 0.42, 1);
    s.position.set(0.02, -0.12, 0);
    this.fistN.add(s);
  }

  // per-frame state from the fighter: hit flash, fade-out when KO'd, invulnerability blink
  update(f, world) {
    if (specKeyChanged(this, f.look)) this.build(f.look);
    let alpha = 1;
    if (f.state === 'dead') alpha = f.team === 'player' ? 1 : Math.max(0, 1 - Math.max(0, f.deadT - 1.2) / 0.8);
    let visible = alpha > 0;
    if (f.invuln > 0 && f.state !== 'dodge' && f.team === 'player' && Math.floor(f.invuln * 20) % 2 === 0) alpha *= 0.45;
    if (f.state === 'dead' && f.team !== 'player' && f.deadT > 0.4 && Math.floor(f.deadT * 12) % 2 === 0) alpha *= 0.5;
    const flash = f.flashT > 0;
    for (const m of Object.values(this.mats)) {
      m.emissive.setScalar(flash ? 0.55 : 0);
      const tr = alpha < 0.999;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = alpha;
    }
    this.group.visible = visible;
    this.setWeapon(f.weapon && f.weapon.def);
  }

  dispose() {
    for (const m of Object.values(this.mats)) m.dispose();
    this.setWeapon(null);
  }
}

function specKeyChanged(c, look) {
  if (c.look === look) return false;
  return specForLook(look).key !== c.key;
}

const BLOB_GEO = new THREE.CircleGeometry(0.42, 20);
const BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });

export { ITEMS };
