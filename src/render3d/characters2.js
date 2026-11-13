// 3D characters v2 (overhaul): skinned bodies + a layered animator.
//
// Models: assets/models/v2/<build>_<torso>.glb from scripts/blender/char_v2.py (scripts/build_models_v2.py):
// one skinned body (clothing = material regions), a separate head with a face, accessories tagged 'acc:<layer>',
// a named humanoid skeleton (root, hips, spine, chest, neck, head, shoulder/upperArm/forearm/hand, thigh/shin/foot/toe
// with _L/_R). Bone-local axes as in Blender: limbs swing forward about X, out to the side about Z, twist about Y.
//
// Animator layers (every frame):
//   0. key clips — hand-keyed strikes (clips.js) locked to the attack's startup/active/recovery timing
//   1. base pose — the game's pose library (Fighter.getPose(): every state, attack and boss move), converted to the
//      skeleton; standing, walking and running are procedural (stance(): guard bounce / relaxed weight shift blended
//      with a stepping cycle by speed, driven by the distance actually travelled, so there's no foot slide)
//   2. 3D secondary motion — hip/shoulder counter-twist toward the working arm or leg, arms kept clear of the body,
//      feet kept level, a breathing idle, a slight lean into movement, the head turning toward who you're fighting
//   3. smoothing — every joint eases toward its target (fast for strikes, softer otherwise), so nothing snaps
//
// Recolouring/accessories follow the LOOK exactly like the sprites (specForLook): material ID_<n> -> palette n.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { specForLook } from '../game/sprites.js';
import { fillPose } from '../game/poses.js';
import { CLIPS, evalClip, attackU, stateClipFor, GUARD_RIG } from './clips.js';

export const CHAR2 = { templates: {}, meta: {}, ready: false };
export const CHAR2_SCALE = 1.27;          // the game's chunky character scale (matches the sprites)
const K = 0.046;                          // metres per pose-library pixel (hip offsets)
const TORSO_OF = { harrington: 'jacket', bomber: 'jacket', track: 'jacket', leather: 'jacket', suit: 'jacket', shirt: 'jacket', parka: 'parka', tee: 'tee', polo: 'tee', vest: 'tee', hivis: 'hivis', hoodie: 'hoodie' };
const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'upperArm_L', 'forearm_L', 'hand_L', 'shoulder_R', 'upperArm_R', 'forearm_R', 'hand_R',
  'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R'];
const ANIMATED = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulder_L', 'shoulder_R', 'upperArm_L', 'forearm_L', 'hand_L', 'upperArm_R', 'forearm_R', 'hand_R', 'thigh_L', 'shin_L', 'foot_L', 'thigh_R', 'shin_R', 'foot_R'];

export async function loadCharacters2() {
  try {
    const base = new URL('../../assets/models/v2/', import.meta.url);
    const r = await fetch(new URL('index.json', base));
    if (!r.ok) return;
    const { models = [] } = await r.json();
    const loader = new GLTFLoader();
    // models are Draco-compressed (scripts/blender/char_v2.py); the decoder comes from the same three.js release
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
    loader.setDRACOLoader(draco);
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
  const pre = look.female ? 'f' : look.muscle ? 'b' : b >= 1.28 ? 'h' : 'm';
  const torso = TORSO_OF[(look.jacket && look.jacket.style) || 'harrington'] || 'jacket';
  for (const c of [`${pre}_${torso}`, `${pre}_jacket`, `m_${torso}`, 'm_jacket']) if (CHAR2.templates[c]) return c;
  return null;
}

const ROUGH = { 1: 0.62, 9: 0.6, 10: 0.7, 13: 0.18, 16: 0.7, 17: 0.4, 19: 0.15, 20: 0.5, 21: 0.55 };   // material id -> roughness
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
    this.mdx = 1; this.mdy = 0; this.lean = 0; this.prevSpeed = 0;   // travel direction, lean into acceleration
    this.ik = { L: { v: new THREE.Vector3(), w: 0 }, R: { v: new THREE.Vector3(), w: 0 } };   // smoothed fist targets
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
      // multi-material parts (striped scarf, the body) export as a group of meshes: the tag sits on the group
      const tag = (o.userData && o.userData.tags) || (o.parent && o.parent.userData && o.parent.userData.tags) || '';
      if (tag.startsWith('acc:')) o.visible = layers.has(tag.slice(4));
      const id = parseInt(String(o.material && o.material.name).replace('ID_', ''), 10) || 3;
      let m = this.mats[id];
      if (!m) {
        const c = spec.pal[id] || [200, 0, 200];
        // physically based, soft cloth; skin a touch of sheen, eyes and shades glossy
        m = this.mats[id] = new THREE.MeshStandardMaterial({ color: toColor(c), roughness: ROUGH[id] ?? 0.88, metalness: 0 });
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
    if (moved > 1e-5) {
      const a = 1 - Math.exp(-dt * 14);
      this.mdx += ((f.x - this.lastX) / moved - this.mdx) * a; this.mdy += ((f.y - this.lastY) / moved - this.mdy) * a;
    }
    this.lastX = f.x; this.lastY = f.y;
    const v = dt > 0 ? moved / dt : 0;
    this.speed += (v - this.speed) * (1 - Math.exp(-dt * 10));
    // lean: forward when speeding up, back when pulling up
    const acc = dt > 0 ? (this.speed - this.prevSpeed) / dt : 0;
    this.prevSpeed = this.speed;
    this.lean += (clamp(acc * 0.012, -0.14, 0.16) - this.lean) * (1 - Math.exp(-dt * 8));
    const T = this.target || (this.target = {});
    const clip = st === 'attack' && f.attack ? CLIPS[f.attack.def.pose || f.attack.name] : null;
    T.ikL = T.ikR = null; T.yaw = 0;
    for (const b of ['shoulder_L', 'shoulder_R']) (T[b] || (T[b] = new THREE.Vector3())).set(0, 0, 0);
    const sc = clip ? null : stateClipFor(f);
    const stance = !clip && !sc && (st === 'walk' || st === 'run' || st === 'idle') && f.onGround !== false;
    if (clip) this.fromClip(T, clip, attackU(f));
    else if (sc) this.fromClip(T, sc.clip, sc.u);
    else if (stance) this.stance(T, f, moved, world.time, st === 'run' || this.speed > 4.2);
    else this.fromPose(T, f.getPose(), f, world.time);
    // secondary 3D layers
    this.secondary(T, f, world);
    // smoothing: strikes snap, everything else eases
    const fast = st === 'attack' || st === 'hurt' || st === 'blockstun' || st === 'knockdown' || st === 'thrown' || st === 'grabbed' || st === 'dodge' || st === 'getup';
    const k = this.first ? 1 : 1 - Math.exp(-dt * (clip ? 48 : sc ? (fast ? 40 : 24) : stance ? 18 : fast ? 34 : 13));
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
    const flip = (this.lastPose && (this.lastPose.flip || 0) >= 0.5);
    const yaw = Math.atan2(f.fx, f.fy) + (flip ? Math.PI : 0);
    if (this.baseYaw === undefined) this.baseYaw = this.group.rotation.y;
    let d = yaw - this.baseYaw;
    d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
    this.baseYaw += d * (1 - Math.exp(-dt * (fast ? 40 : 18)));
    // clip yaw (spin kicks): whole-body turn on top of the facing, unsmoothed so a full 360 never unwinds
    this.group.rotation.y = this.baseYaw + (T.yaw || 0);
    // fist IK (clips): smooth the targets like the joints, then solve shoulder + elbow
    for (const side of ['L', 'R']) {
      const t = T['ik' + side], s = this.ik[side];
      const w = t ? t.w : 0;
      if (t && w > 0) { if (s.w < 0.01 || this.first) s.v.set(t.v[0], t.v[1], t.v[2]); else s.v.lerp(V1.set(t.v[0], t.v[1], t.v[2]), k); }
      s.w += (w - s.w) * k;
      if (s.w > 0.01) { this.group.updateMatrixWorld(true); this.solveArm(side, s.v, s.w); }
    }
  }

  // two-bone IK: put the hand at target (model space, metres from the feet: x = left, y = up, z = forward),
  // elbow bending down and out. weight blends from the current (joint-angle) pose.
  solveArm(side, target, weight) {
    const up = this.B['upperArm_' + side], fo = this.B['forearm_' + side], ha = this.B['hand_' + side];
    if (!up || !fo || !ha) return;
    const S = up.getWorldPosition(IK.s), E0 = fo.getWorldPosition(IK.e), H0 = ha.getWorldPosition(IK.h);
    const a = S.distanceTo(E0), b = E0.distanceTo(H0);
    const T = IK.t.copy(target).applyMatrix4(this.inner.matrixWorld);
    T.lerp(H0, 1 - Math.min(1, weight));
    const dir = IK.d.subVectors(T, S);
    let d = dir.length(); dir.normalize();
    d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, d));
    // pole: elbow down, out to its own side, a little back (model space -> world)
    const out = side === 'L' ? 1 : -1;
    const pole = IK.p.set(0.55 * out, -1, -0.35).transformDirection(this.inner.matrixWorld);
    const n = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const E = IK.E.copy(S).addScaledVector(dir, a * cosA).addScaledVector(n, a * sinA);
    const Tc = IK.T2.copy(S).addScaledVector(dir, d);
    aimBone(up, E0, E);
    aimBone(fo, ha.getWorldPosition(IK.h), Tc);
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

  // hand-keyed clip at u (degrees -> radians; *_R mirrors)
  fromClip(T, clip, u) {
    const C = evalClip(clip, u, this.clipOut || (this.clipOut = {}));
    const R = Math.PI / 180;
    for (const b in C) {
      if (b === 'hip') continue;
      const v = C[b], side = b.endsWith('_R') ? 'R' : 'L';
      this.setBone(T, b, v[0] * R, v[1] * R, v[2] * R, side);
    }
    (T.hipOff || (T.hipOff = new THREE.Vector3())).set(C.hip[0], C.hip[1], C.hip[2]);
    T.ikL = C.ikL; T.ikR = C.ikR;
    T.yaw = C.yaw * R;
    this.lastPose = null;
  }

  // ---------------------------------------------------------------- standing, walking, running (procedural)
  // Standing pose (guard bounce in a fight, relaxed weight shift otherwise) blended with a stepping cycle by speed,
  // so starting and stopping ease in and out instead of switching between two poses.
  stance(T, f, moved, time, run) {
    const t = time + (f.id || 0) * 1.37;
    const guard = f.combat && !run;
    if (guard) this.guardPose(T, t); else this.relaxedPose(T, t);
    const wt = clamp((this.speed - 0.12) / 0.9, 0, 1), w = wt * wt * (3 - 2 * wt);
    if (w > 0.01) {
      const B = this.stepT || (this.stepT = {});
      for (const b of ['shoulder_L', 'shoulder_R']) (B[b] || (B[b] = new THREE.Vector3())).set(0, 0, 0);
      if (guard) this.fightStep(B, f, moved, t); else this.locomotion(B, f, moved, run);
      for (const b of ANIMATED) if (B[b] && T[b]) T[b].lerp(B[b], w);
      T.hipOff.lerp(B.hipOff, w);
    }
    T.hips.x += this.lean; T.chest.x += this.lean * 0.4;
    this.lastPose = null;
  }

  rig(T, R0) {
    const R = Math.PI / 180;
    for (const b in R0) { if (b === 'hip') continue; const v = R0[b]; this.setBone(T, b, v[0] * R, v[1] * R, v[2] * R, b.endsWith('_R') ? 'R' : 'L'); }
    (T.hipOff || (T.hipOff = new THREE.Vector3())).set(R0.hip[0], R0.hip[1], R0.hip[2]);
  }

  // fighting stance: a boxer's bounce on the balls of the feet, shoulders rolling, fists working
  guardPose(T, t) {
    this.rig(T, GUARD_RIG);
    const bo = Math.sin(t * TAU * 1.55), sw = Math.sin(t * TAU * 0.775 + 0.6);
    const dn = 0.5 + 0.5 * bo;                                       // 1 = bottom of the bounce
    for (const sd of ['L', 'R']) { T['thigh_' + sd].x += dn * 0.1; T['shin_' + sd].x -= dn * 0.19; T['foot_' + sd].x += dn * 0.09; }
    T.hips.y += sw * 0.06; T.spine.y -= sw * 0.03; T.chest.y -= sw * 0.05; T.chest.x += dn * 0.03; T.head.x -= dn * 0.025;
    T.shoulder_L.x += sw * 0.06; T.shoulder_R.x -= sw * 0.06;
    T.upperArm_L.x += sw * 0.05 + bo * 0.02; T.forearm_L.x += bo * 0.05;
    T.upperArm_R.x -= sw * 0.05 - bo * 0.02; T.forearm_R.x -= bo * 0.04;
    T.hipOff.x += sw * 0.014; T.hipOff.y -= dn * 0.05;
  }

  // standing about: slow weight shift from foot to foot, breathing, arms loose
  relaxedPose(T, t) {
    const ws = Math.sin(t * TAU / 3.8), br = Math.sin(t * 2.2);
    for (const [sd, sg] of [['L', 1], ['R', -1]]) {
      const unload = Math.max(0, -sg * ws);                         // the leg not carrying the weight relaxes its knee
      this.setBone(T, 'upperArm_' + sd, 0.06 + br * 0.015, 0, 0.13, sd);
      this.setBone(T, 'forearm_' + sd, 0.26 + br * 0.02, 0.03, 0, sd);
      this.setBone(T, 'hand_' + sd, -0.15, 0, 0, sd);
      this.setBone(T, 'thigh_' + sd, 0.02 + unload * 0.1, 0, 0.05 + sg * ws * 0.02, sd);
      this.setBone(T, 'shin_' + sd, -0.05 - unload * 0.22, 0, 0, sd);
      this.setBone(T, 'foot_' + sd, 0.03 + unload * 0.12, 0, 0, sd);
      this.setBone(T, 'shoulder_' + sd, 0, 0, br * 0.025, sd);
    }
    this.setBone(T, 'hips', 0.02, ws * 0.05, ws * 0.05);
    this.setBone(T, 'spine', 0.02 + br * 0.01, 0, -ws * 0.03);
    this.setBone(T, 'chest', 0.01 + br * 0.025, -ws * 0.03, -ws * 0.02);
    this.setBone(T, 'neck', 0.02, 0, 0);
    this.setBone(T, 'head', 0.02 - br * 0.015, Math.sin(t * 0.37) * 0.12, ws * 0.03);
    (T.hipOff || (T.hipOff = new THREE.Vector3())).set(ws * 0.03, -0.012 - Math.abs(ws) * 0.012, 0);
  }

  // stepping in the guard: shuffle forward/back, side-step (feet spread then close), relative to where he faces
  fightStep(T, f, moved, t) {
    this.guardPose(T, t);
    this.phase = (this.phase + moved / 0.95 * TAU) % TAU;
    const p = this.phase, s = Math.sin(p), c = Math.cos(p);
    const vf = this.mdx * f.fx + this.mdy * f.fy;                   // + forward
    const vs = this.mdx * f.fy - this.mdy * f.fx;                   // + toward his left
    const spread = (0.5 - 0.5 * c) * Math.abs(vs);
    const leadL = vs > 0;
    for (const [sd, sg] of [['L', 1], ['R', -1]]) {
      const sw = sg * s, lift = Math.max(0, sg * c) * Math.abs(vf) + (((sd === 'L') === leadL ? Math.max(0, s) : Math.max(0, -s)) * Math.abs(vs));
      T['thigh_' + sd].x += 0.34 * sw * vf + lift * 0.2;
      T['shin_' + sd].x -= lift * 0.55;
      T['foot_' + sd].x += -0.2 * sw * vf + lift * 0.18;
      T['thigh_' + sd].z += sg * spread * 0.36;                     // raw z: + is out for the left leg, in for the right
    }
    T.hips.x += vf * 0.05; T.chest.x += vf * 0.03;
    T.hipOff.y -= (1 - Math.abs(c)) * 0.025;
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
      T.chest.y += tw * 0.6; T.spine.y += tw * 0.3; T.hips.y -= tw * 0.25;   // y+ = right shoulder forward
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

// rotate bone (in world space) so the direction bone->childPos points at want
function aimBone(bone, childPos, want) {
  const b = bone.getWorldPosition(IK.b);
  const cur = IK.c.subVectors(childPos, b).normalize(), des = IK.w.subVectors(want, b).normalize();
  const dq = IK.q.setFromUnitVectors(cur, des);
  const bq = bone.getWorldQuaternion(IK.bq), pq = bone.parent.getWorldQuaternion(IK.pq).invert();
  bone.quaternion.copy(pq.multiply(dq.multiply(bq)));
  bone.updateMatrixWorld(true);
}
const IK = { s: new THREE.Vector3(), e: new THREE.Vector3(), h: new THREE.Vector3(), t: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(),
  E: new THREE.Vector3(), T2: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), w: new THREE.Vector3(),
  q: new THREE.Quaternion(), bq: new THREE.Quaternion(), pq: new THREE.Quaternion() };
const ZERO = new THREE.Vector3();
const V1 = new THREE.Vector3();
const BLOB_GEO = new THREE.CircleGeometry(0.42, 24);
const BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
