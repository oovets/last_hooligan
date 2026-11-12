// 3D characters v2 (overhaul): skinned bodies + a layered animator.
//
// Models: assets/models/v2/<build>_<torso>.glb from scripts/blender/char_v2.py (scripts/build_models_v2.py):
// one skinned body (clothing = material regions), a separate head with a face, accessories tagged 'acc:<layer>',
// a named humanoid skeleton (root, hips, spine, chest, neck, head, shoulder/upperArm/forearm/hand, thigh/shin/foot/toe
// with _L/_R). Bone-local axes as in Blender: limbs swing forward about X, out to the side about Z, twist about Y.
//
// Animator layers (every frame):
//   1. base pose — the game's pose library (Fighter.getPose(): every state, attack and boss move), converted to the
//      skeleton; walking and running are generated procedurally from the distance actually travelled (no foot slide)
//   2. 3D secondary motion — hip/shoulder counter-twist toward the working arm or leg, arms kept clear of the body,
//      feet kept level, a breathing idle, a slight lean into movement, the head turning toward who you're fighting
//   3. smoothing — every joint eases toward its target (fast for strikes, softer otherwise), so nothing snaps
//
// Recolouring/accessories follow the LOOK exactly like the sprites (specForLook): material ID_<n> -> palette n.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { specForLook } from '../game/sprites.js';
import { fillPose } from '../game/poses.js';

export const CHAR2 = { templates: {}, meta: {}, ready: false };
export const CHAR2_SCALE = 1.27;          // the game's chunky character scale (matches the sprites)
const K = 0.046;                          // metres per pose-library pixel (hip offsets)
const TORSO_OF = { harrington: 'jacket', bomber: 'jacket', track: 'jacket', leather: 'jacket', suit: 'jacket', shirt: 'jacket', parka: 'parka', tee: 'tee', polo: 'tee', vest: 'tee', hivis: 'hivis' };
const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'upperArm_L', 'forearm_L', 'hand_L', 'shoulder_R', 'upperArm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R'];
const ANIMATED = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArm_L', 'forearm_L', 'hand_L', 'upperArm_R', 'forearm_R', 'hand_R', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'];

export async function loadCharacters2() {
  try {
    const base = new URL('../../assets/models/v2/', import.meta.url);
    const r = await fetch(new URL('index.json', base));
    if (!r.ok) return;
    const { models = [] } = await r.json();
    const loader = new GLTFLoader();
    await Promise.all(models.map(async name => {
      try {
        const g = await loader.loadAsync(new URL(name + '.glb', base).href);
        g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
        CHAR2.templates[name] = g.scene;
        const rig = g.scene.getObjectByName('rig');
        let meta = {};
        try { meta = JSON.parse((rig && rig.userData && rig.userData.hooligan) || '{}'); } catch (e) { /* defaults */ }
        CHAR2.meta[name] = { girth: meta.girth || 1, build: name[0] };
      } catch (e) { console.warn('[3d v2] model failed', name, e); }
    }));
    CHAR2.ready = Object.keys(CHAR2.templates).length > 0;
  } catch (e) { console.warn('[3d v2] no models', e); }
}

export function modelFor2(look) {
  const b = look.build || 1;
  const pre = look.female ? 'f' : b >= 1.28 ? 'h' : 'm';
  const torso = TORSO_OF[(look.jacket && look.jacket.style) || 'harrington'] || 'jacket';
  for (const c of [`${pre}_${torso}`, `${pre}_jacket`, `m_${torso}`, 'm_jacket']) if (CHAR2.templates[c]) return c;
  return null;
}

let RAMP = null;
function ramp() {
  if (RAMP) return RAMP;
  const d = new Uint8Array([58, 118, 188, 240, 255]);
  RAMP = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
  RAMP.needsUpdate = true;
  return RAMP;
}
const toColor = c => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const E = new THREE.Euler();
const Q = new THREE.Quaternion();

export class Character2 {
  constructor(look) {
    this.group = new THREE.Group();
    this.mats = {};
    this.build(look);
    this.blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = -1e8;
    this.blob.layers.set(1);
    // animator state
    this.cur = {}; for (const b of ANIMATED) this.cur[b] = new THREE.Vector3();
    this.hipOff = new THREE.Vector3();
    this.phase = 0; this.lastX = null; this.lastY = null; this.speed = 0;
    this.headYaw = 0; this.first = true;
  }

  build(look) {
    if (this.inner) { this.group.remove(this.inner); for (const m of Object.values(this.mats)) m.dispose(); this.mats = {}; }
    const spec = specForLook(look);
    this.key = spec.key; this.look = look;
    this.model = modelFor2(look);
    const inner = this.inner = SkeletonUtils.clone(CHAR2.templates[this.model]);
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
        if (id === 13 || id === 19) m.color.multiplyScalar(0.5);
      }
      o.material = m;
      o.castShadow = true;
    });
    this.B = {}; this.rest = {};
    for (const n of BONES) { const b = inner.getObjectByName(n); if (b) { this.B[n] = b; this.rest[n] = b.quaternion.clone(); } }
    this.hipsRest = this.B.hips ? this.B.hips.position.clone() : new THREE.Vector3();
    this.rootInv = this.B.root ? this.B.root.quaternion.clone().invert() : new THREE.Quaternion();
    this.handR = this.B.hand_R;
    const h = look.height || 1;
    const bw = clamp((look.build || 1) / ({ m: 1.0, h: 1.4, f: 0.95 }[this.model[0]] || 1), 0.88, 1.18);
    inner.scale.set(CHAR2_SCALE * h * bw, CHAR2_SCALE * h, CHAR2_SCALE * h * bw);
    this.group.add(inner);
    this.weaponId = null;
  }

  // ---------------------------------------------------------------- animator
  // f: Fighter, world, dt (seconds since last frame)
  animate(f, world, dt) {
    dt = clamp(dt || 1 / 60, 0, 0.1);
    const st = f.state;
    // distance actually travelled drives the walk/run cycle
    if (this.lastX === null) { this.lastX = f.x; this.lastY = f.y; }
    const moved = Math.hypot(f.x - this.lastX, f.y - this.lastY);
    this.lastX = f.x; this.lastY = f.y;
    const v = dt > 0 ? moved / dt : 0;
    this.speed += (v - this.speed) * (1 - Math.exp(-dt * 10));
    const loco = (st === 'walk' || st === 'run' || st === 'idle') && !f.combat;
    const T = this.target || (this.target = {});
    if (loco && this.speed > 0.25) this.locomotion(T, f, moved, st === 'run' || this.speed > 4.2);
    else this.fromPose(T, f.getPose(), f, world.time);
    // secondary 3D layers
    this.secondary(T, f, world);
    // smoothing: strikes snap, everything else eases
    const fast = st === 'attack' || st === 'hurt' || st === 'blockstun' || st === 'knockdown' || st === 'thrown' || st === 'grabbed';
    const k = this.first ? 1 : 1 - Math.exp(-dt * (fast ? 34 : loco ? 16 : 13));
    this.first = false;
    for (const b of ANIMATED) {
      const t = T[b] || ZERO;
      this.cur[b].x += (t.x - this.cur[b].x) * k; this.cur[b].y += (t.y - this.cur[b].y) * k; this.cur[b].z += (t.z - this.cur[b].z) * k;
      const bone = this.B[b];
      if (!bone) continue;
      E.set(this.cur[b].x, this.cur[b].y, this.cur[b].z, 'ZYX');
      bone.quaternion.copy(this.rest[b]).multiply(Q.setFromEuler(E));
    }
    this.hipOff.lerp(T.hipOff || ZERO, k);
    if (this.B.hips) this.B.hips.position.copy(this.hipsRest).add(V1.copy(this.hipOff).applyQuaternion(this.rootInv));
    // facing
    const flip = (this.lastPose && (this.lastPose.flip || 0) >= 0.5) && !loco;
    const yaw = Math.atan2(f.fx, f.fy) + (flip ? Math.PI : 0);
    let d = yaw - this.group.rotation.y;
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    this.group.rotation.y += d * (1 - Math.exp(-dt * (fast ? 40 : 18)));
  }

  setBone(T, name, x, y, z, side) {
    // poses are authored for the left side; the right side mirrors twist and abduction
    const m = side === 'R' ? -1 : 1;
    (T[name] || (T[name] = new THREE.Vector3())).set(x, y * m, z * m);
  }

  // pose library (2D sagittal angles) -> skeleton. N limbs = the character's right side, F = left.
  fromPose(T, p0, f, time) {
    const P = fillPose(p0);
    this.lastPose = p0;
    for (const [s, side] of [['N', 'R'], ['F', 'L']]) {
      const ua = P['ua' + s], fa = P['fa' + s], th = P['th' + s], kn = P['kn' + s];
      const abd = 0.16 + 0.22 * clamp(Math.sin(ua), 0, 1);          // arms clear of the body, more so when raised
      this.setBone(T, 'upperArm_' + side, ua, 0, abd, side);
      this.setBone(T, 'forearm_' + side, fa, 0.1 * clamp(fa, 0, 2), 0, side);
      this.setBone(T, 'hand_' + side, -0.2, 0, 0, side);
      this.setBone(T, 'thigh_' + side, th, 0, 0.05, side);
      this.setBone(T, 'shin_' + side, -kn, 0, 0, side);
      this.setBone(T, 'foot_' + side, -(th - kn) * 0.85 + 0.05, 0, 0, side);
    }
    this.setBone(T, 'hips', P.rot, 0, 0);
    this.setBone(T, 'spine', P.lean * 0.45, 0, 0);
    this.setBone(T, 'chest', P.lean * 0.55, 0, 0);
    this.setBone(T, 'neck', P.head * 0.4, 0, 0);
    this.setBone(T, 'head', P.head * 0.6, 0, 0);
    (T.hipOff || (T.hipOff = new THREE.Vector3())).set(0, -P.dy * K, P.dx * K);
    // breathing when standing about
    if (f.state === 'idle') { const b = Math.sin(time * 2.2 + (f.id || 0)) * 0.025; T.chest.x += b; T.head.x -= b * 0.6; }
  }

  // procedural walk/run from distance travelled
  locomotion(T, f, moved, run) {
    const stride = run ? 2.3 : 1.25;                                // tiles per full cycle (two steps)
    this.phase = (this.phase + moved / stride * TAU) % TAU;
    const p = this.phase, s = Math.sin(p), c = Math.cos(p);
    const A = run ? 0.62 : 0.4;                                     // leg swing
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      const sw = sg * s;                                            // + = this leg forward
      const lift = Math.max(0, sg * c);                             // swing phase (foot off the ground)
      this.setBone(T, 'thigh_' + side, A * sw + (run ? 0.12 : 0.03) + lift * (run ? 0.35 : 0.12), 0, 0.04, side);
      this.setBone(T, 'shin_' + side, -(lift * (run ? 1.35 : 0.55) + (run ? 0.2 : 0.06)), 0, 0, side);
      this.setBone(T, 'foot_' + side, -(A * sw) * 0.7 + lift * (run ? 0.5 : 0.2) - 0.05, 0, 0, side);
      const arm = -sw * (run ? 0.75 : 0.35);                        // arms swing against the legs
      this.setBone(T, 'upperArm_' + side, arm + (run ? 0.25 : 0.05), 0, 0.14, side);
      this.setBone(T, 'forearm_' + side, (run ? 1.45 : 0.35) + Math.max(0, arm) * 0.5, 0, 0, side);
      this.setBone(T, 'hand_' + side, -0.15, 0, 0, side);
    }
    const bob = Math.abs(c);
    this.setBone(T, 'hips', run ? 0.08 : 0.02, s * (run ? 0.14 : 0.1), 0);
    this.setBone(T, 'spine', run ? 0.12 : 0.04, -s * (run ? 0.1 : 0.06), 0);
    this.setBone(T, 'chest', run ? 0.1 : 0.03, -s * (run ? 0.14 : 0.08), 0);
    this.setBone(T, 'neck', -(run ? 0.12 : 0.03), s * 0.05, 0);
    this.setBone(T, 'head', -(run ? 0.08 : 0.02), s * 0.04, 0);
    (T.hipOff || (T.hipOff = new THREE.Vector3())).set(0, -(run ? 0.07 : 0.02) - (1 - bob) * (run ? 0.06 : 0.025), 0);
    this.lastPose = null;
  }

  // twist toward the working limb, head tracking, slight lean into movement
  secondary(T, f, world) {
    const P = this.lastPose ? fillPose(this.lastPose) : null;
    if (P) {
      // a straight right arm (N) pulls the right shoulder forward: chest twists, hips counter
      const arms = (Math.sin(P.uaN) * (1 - Math.min(1, P.faN / 2)) - Math.sin(P.uaF) * (1 - Math.min(1, P.faF / 2)));
      const legs = Math.sin(P.thN) - Math.sin(P.thF);
      const tw = clamp(arms * 0.55 + legs * 0.15, -0.7, 0.7);
      T.chest.y += -tw * 0.6; T.spine.y += -tw * 0.3; T.hips.y += tw * 0.25;
    }
    // head turns toward whoever this fighter is fighting
    const tgt = f.isPlayer ? (world.lastEnemy && world.lastEnemyT > 0 ? world.lastEnemy : null) : (f.controller && f.controller.curTarget) || null;
    let want = 0;
    if (tgt && tgt !== f && f.alive && f.state !== 'down' && f.state !== 'dead') {
      const a = Math.atan2(tgt.x - f.x, tgt.y - f.y);
      let d = a - Math.atan2(f.fx, f.fy);
      d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      want = clamp(d, -0.7, 0.7);
    }
    this.headYaw += (want - this.headYaw) * 0.15;
    T.neck.y += this.headYaw * 0.45; T.head.y += this.headYaw * 0.55;
    // airborne: tuck the legs a little
    if (!f.onGround && f.state === 'jump') { T.shin_L.x -= 0.4; T.shin_R.x -= 0.4; }
  }

  // ---------------------------------------------------------------- per-frame state (flash, fade, weapon)
  update(f, world) {
    if (f.look !== this.look && specForLook(f.look).key !== this.key) { this.build(f.look); this.first = true; }
    let alpha = 1;
    if (f.state === 'dead') alpha = f.team === 'player' ? 1 : Math.max(0, 1 - Math.max(0, f.deadT - 1.2) / 0.8);
    if (f.invuln > 0 && f.state !== 'dodge' && f.team === 'player' && Math.floor(f.invuln * 20) % 2 === 0) alpha *= 0.45;
    if (f.state === 'dead' && f.team !== 'player' && f.deadT > 0.4 && Math.floor(f.deadT * 12) % 2 === 0) alpha *= 0.5;
    const flash = f.flashT > 0;
    for (const m of Object.values(this.mats)) {
      m.emissive.setScalar(flash ? 0.6 : 0);
      const tr = alpha < 0.999;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = alpha;
    }
    this.group.visible = alpha > 0;
    this.setWeapon(f.weapon && f.weapon.def);
  }

  setWeapon(def) {
    const id = def ? def.id : null;
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weaponSprite) { this.handR.remove(this.weaponSprite); this.weaponSprite.material.map.dispose(); this.weaponSprite.material.dispose(); this.weaponSprite = null; }
    if (!def || !def.icon || !this.handR) return;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.scale(2, 2);
    try { def.icon(g, 16, 26, 0); } catch (e) { /* icon needs more context */ }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = this.weaponSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.1 }));
    s.scale.set(0.34, 0.34, 1);
    s.position.set(0, 0.08, 0);
    this.handR.add(s);
  }

  dispose() { for (const m of Object.values(this.mats)) m.dispose(); this.setWeapon(null); }
}

const ZERO = new THREE.Vector3();
const V1 = new THREE.Vector3();
const BLOB_GEO = new THREE.CircleGeometry(0.42, 24);
const BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
