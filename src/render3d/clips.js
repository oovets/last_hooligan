// Hand-keyed strike clips for the v2 characters (overhaul: "key clips").
//
// A clip is a list of key poses on a normalised timeline that is locked to the attack's phases, so the impact pose
// always lands on the game's real hit frames (combat.js startup / active / recovery):
//   u 0.00 - 0.35  startup   (anticipation: weight back, shoulder pulled, fist cocked)
//   u 0.35 - 0.50  active    (the kinetic chain: hips -> chest -> shoulder -> arm, slight overextension on impact)
//   u 0.50 - 1.00  recovery  (follow-through, then settle back into the guard)
//
// Key = [u, { bone: [x, y, z] (degrees), hip: [x, y, z] (metres: x side, y up, z forward),
//            ikL / ikR: [side, up, forward] }, ease]
// ikL / ikR put the fist at a point (model metres from the feet: side + = the character's LEFT, up, forward) with a
// two-bone IK solve (characters2.js), elbow down and out. That keeps straight punches straight and lets strikes be
// written as fist paths instead of joint angles. Keys without ik leave that arm to the joint angles; the solver
// blends in and out between keys.
// Bones not listed in a key hold the GUARD value. Angles use the rig convention (characters2.js), written for the
// character's LEFT side; *_R bones mirror y/z automatically:
//   spine/chest/neck/head: x+ lean forward, y+ turn so the RIGHT shoulder comes forward, z side bend
//   arms/legs:             x+ swing forward (forearm x+ = elbow bend, shin x- = knee bend), z+ out to the side
//   shoulder:              x+ shoulder forward (protract), z+ shrug
//   foot:                  x+ toes up
// The guard (and the pose library) has the RIGHT leg forward: jab and hook are thrown with the LEFT hand, cross,
// uppercut, haymaker and weapon swings with the RIGHT, kicks with the RIGHT leg.

export const PHASE_U = [0, 0.35, 0.5, 1];

// guard stance in rig degrees (matches the pose library's GUARD converted by characters2.js)
export const GUARD_RIG = {
  hips: [6, 10, 0], spine: [3, -4, 0], chest: [4, -8, 0], neck: [2, 4, 0], head: [2, 4, 0],
  shoulder_L: [0, 0, 0], shoulder_R: [0, 0, 0],
  upperArm_R: [32, 0, 16], forearm_R: [112, 0, 0], hand_R: [-10, 0, 0],
  upperArm_L: [46, 0, 18], forearm_L: [100, 0, 0], hand_L: [-10, 0, 0],
  thigh_R: [20, 0, 3], shin_R: [-24, 0, 0], foot_R: [4, 0, 0],
  thigh_L: [-15, 0, 3], shin_L: [-18, 0, 0], foot_L: [28, 0, 0],
  hip: [0, -0.03, 0],
};

const G = GUARD_RIG;
// helpers to write keys compactly
const k = (u, pose, ease = 'io') => [u, pose, ease];

export const CLIPS = {
  // -------------------------------------------------------------- left jab: fast, little wind-up, snaps back
  jab: [
    k(0.0, {}),
    k(0.3, { chest: [2, 6, 0], upperArm_L: [38, 0, 20], forearm_L: [112, 0, 0], hip: [0, -0.04, -0.02], ikL: [0.13, 1.4, 0.2] }, 'out'),
    k(0.42, { hips: [8, -4, 0], spine: [6, -4, 0], chest: [8, -16, 0], head: [-2, 8, 0], shoulder_L: [24, 0, 4],
      upperArm_L: [92, 0, -6], forearm_L: [2, 0, 0], hand_L: [0, 0, 0], thigh_R: [26, 0, 3], shin_R: [-20, 0, 0], hip: [0, -0.04, 0.07], ikL: [0.05, 1.37, 0.86] }, 'in'),
    k(0.52, { hips: [8, -4, 0], chest: [8, -14, 0], shoulder_L: [18, 0, 4], upperArm_L: [86, 0, -2], forearm_L: [12, 0, 0], hip: [0, -0.04, 0.06], ikL: [0.06, 1.38, 0.78] }),
    k(0.75, { chest: [5, -6, 0], upperArm_L: [52, 0, 16], forearm_L: [92, 0, 0], hip: [0, -0.03, 0.01], ikL: [0.11, 1.42, 0.36] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- right cross: weight shift, hips then shoulders
  cross: [
    k(0.0, {}),
    k(0.3, { hips: [2, -14, 0], chest: [0, -26, 0], head: [0, 14, 0], shoulder_R: [-10, 0, 4], upperArm_R: [20, 0, 22], forearm_R: [125, 0, 0],
      thigh_L: [-20, 0, 3], shin_L: [-26, 0, 0], hip: [0, -0.05, -0.05], ikR: [-0.17, 1.38, 0.08] }, 'out'),
    k(0.38, { hips: [6, 12, 0], chest: [4, -6, 0], hip: [0, -0.06, 0.04] }, 'in'),
    k(0.44, { hips: [10, 14, 0], spine: [8, 6, 0], chest: [12, 18, 0], head: [-4, -10, 0], shoulder_R: [28, 0, 6],
      upperArm_R: [92, 0, -8], forearm_R: [0, 0, 0], hand_R: [0, 0, 0], upperArm_L: [30, 0, 22], forearm_L: [120, 0, 0],
      thigh_R: [32, 0, 3], shin_R: [-24, 0, 0], thigh_L: [-34, 0, 3], shin_L: [-8, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.06, 0.11], ikR: [-0.03, 1.35, 0.92] }, 'in'),
    k(0.56, { hips: [10, 16, 0], chest: [12, 22, 0], shoulder_R: [24, 0, 6], upperArm_R: [88, 0, -4], forearm_R: [14, 0, 0], hip: [0, -0.06, 0.1], ikR: [-0.02, 1.36, 0.84] }),
    k(0.8, { hips: [6, 14, 0], chest: [5, 0, 0], shoulder_R: [4, 0, 0], upperArm_R: [46, 0, 14], forearm_R: [100, 0, 0], hip: [0, -0.04, 0.03], ikR: [-0.11, 1.42, 0.36] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- left hook: wind the body right, whip it back
  hook: [
    k(0.0, {}),
    k(0.32, { hips: [4, 18, 0], chest: [2, 22, 0], head: [0, -8, 0], upperArm_L: [40, 0, 40], forearm_L: [95, 0, 0], hip: [0, -0.05, -0.02], ikL: [0.36, 1.36, 0.22] }, 'out'),
    k(0.45, { hips: [8, -20, 0], spine: [6, -14, 0], chest: [10, -38, 0], head: [-2, 16, 0], shoulder_L: [18, 0, 10],
      upperArm_L: [82, 10, 72], forearm_L: [88, 0, 0], hand_L: [0, 0, 0], thigh_R: [24, 0, 3], shin_R: [-28, 0, 0], foot_L: [36, 0, 0], hip: [0, -0.06, 0.05], ikL: [0.02, 1.42, 0.62] }, 'in'),
    k(0.58, { hips: [8, -26, 0], chest: [10, -46, 0], upperArm_L: [76, 10, 62], forearm_L: [100, 0, 0], hip: [0, -0.06, 0.05], ikL: [-0.2, 1.4, 0.48] }),
    k(0.82, { chest: [5, -14, 0], upperArm_L: [50, 0, 24], forearm_L: [100, 0, 0], hip: [0, -0.04, 0.01], ikL: [0.1, 1.42, 0.32] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- right uppercut: sink, then drive up through the legs
  uppercut: [
    k(0.0, {}),
    k(0.33, { hips: [14, -10, 0], spine: [12, -6, 0], chest: [14, -18, 0], head: [6, 8, 0], upperArm_R: [4, 0, 14], forearm_R: [95, 0, 0],
      thigh_R: [52, 0, 3], shin_R: [-70, 0, 0], foot_R: [16, 0, 0], thigh_L: [10, 0, 3], shin_L: [-62, 0, 0], foot_L: [50, 0, 0], hip: [0, -0.2, -0.02], ikR: [-0.16, 0.98, 0.22] }, 'out'),
    k(0.44, { hips: [-4, 22, 0], spine: [-6, 10, 0], chest: [-8, 26, 0], head: [-14, -10, 0], shoulder_R: [16, 0, 18],
      upperArm_R: [150, 0, 10], forearm_R: [38, 0, 0], hand_R: [10, 0, 0], thigh_R: [16, 0, 3], shin_R: [-6, 0, 0], thigh_L: [-22, 0, 3], shin_L: [-6, 0, 0],
      foot_L: [36, 0, 0], hip: [0, 0.03, 0.06], ikR: [-0.03, 1.58, 0.46] }, 'in'),
    k(0.58, { hips: [-6, 24, 0], chest: [-10, 30, 0], upperArm_R: [160, 0, 10], forearm_R: [44, 0, 0], hip: [0, 0.02, 0.05], ikR: [-0.01, 1.74, 0.36] }),
    k(0.85, { chest: [2, 0, 0], upperArm_R: [60, 0, 16], forearm_R: [104, 0, 0], hip: [0, -0.04, 0.01], ikR: [-0.11, 1.42, 0.32] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- right haymaker: huge telegraphed wind-up
  haymaker: [
    k(0.0, {}),
    k(0.33, { hips: [-4, -26, 0], spine: [-6, -14, 0], chest: [-8, -40, 0], head: [-4, 20, 0], shoulder_R: [-18, 0, 12],
      upperArm_R: [-40, 0, 52], forearm_R: [70, 0, 0], upperArm_L: [60, 0, 26], forearm_L: [80, 0, 0], hip: [0, -0.05, -0.07], ikR: [-0.5, 1.32, -0.28] }, 'out'),
    k(0.45, { hips: [12, 30, 0], spine: [10, 16, 0], chest: [16, 42, 0], head: [-2, -14, 0], shoulder_R: [24, 0, 12],
      upperArm_R: [90, 0, 42], forearm_R: [24, 0, 0], upperArm_L: [24, 0, 26], forearm_L: [110, 0, 0],
      thigh_R: [34, 0, 3], shin_R: [-26, 0, 0], thigh_L: [-36, 0, 3], shin_L: [-10, 0, 0], foot_L: [44, 0, 0], hip: [0, -0.07, 0.13], ikR: [-0.04, 1.36, 0.82] }, 'in'),
    k(0.62, { hips: [14, 40, 0], chest: [20, 56, 0], upperArm_R: [72, 0, 22], forearm_R: [60, 0, 0], hip: [0, -0.08, 0.13], ikR: [0.28, 1.24, 0.56] }),
    k(0.85, { hips: [8, 18, 0], chest: [8, 10, 0], upperArm_R: [44, 0, 18], forearm_R: [104, 0, 0], hip: [0, -0.04, 0.04], ikR: [-0.12, 1.4, 0.34] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- right front kick: chamber, snap, re-chamber
  kick: [
    k(0.0, {}),
    k(0.32, { hips: [-6, 6, 0], spine: [-6, 0, 0], chest: [-4, -6, 0], thigh_R: [86, 0, 2], shin_R: [-112, 0, 0], foot_R: [10, 0, 0],
      thigh_L: [-6, 0, 3], shin_L: [-20, 0, 0], foot_L: [20, 0, 0], upperArm_L: [40, 0, 30], upperArm_R: [20, 0, 26], hip: [0, -0.02, -0.03] }, 'out'),
    k(0.44, { hips: [-14, 10, 0], spine: [-10, 0, 0], chest: [-10, -8, 0], head: [8, 0, 0], thigh_R: [96, 0, 2], shin_R: [-4, 0, 0], foot_R: [-24, 0, 0],
      thigh_L: [-4, 0, 3], shin_L: [-14, 0, 0], foot_L: [16, 0, 0], upperArm_L: [30, 0, 36], forearm_L: [96, 0, 0], upperArm_R: [6, 0, 34], forearm_R: [90, 0, 0], hip: [0, -0.01, 0.03] }, 'in'),
    k(0.6, { hips: [-10, 8, 0], thigh_R: [80, 0, 2], shin_R: [-96, 0, 0], foot_R: [6, 0, 0], hip: [0, -0.02, 0.0] }, 'out'),
    k(0.82, { thigh_R: [34, 0, 3], shin_R: [-44, 0, 0], hip: [0, -0.04, 0.0] }, 'io'),
    k(1.0, {}),
  ],
  lowKick: [
    k(0.0, {}),
    k(0.32, { thigh_R: [48, 0, 6], shin_R: [-74, 0, 0], hips: [2, 12, 0], hip: [0, -0.04, -0.02] }, 'out'),
    k(0.45, { hips: [-6, 26, 0], chest: [-4, -10, 0], thigh_R: [56, 0, 10], shin_R: [-2, 0, 0], foot_R: [-12, 0, 0], thigh_L: [-8, 0, 3], shin_L: [-22, 0, 0], hip: [0, -0.05, 0.03] }, 'in'),
    k(0.65, { thigh_R: [40, 0, 6], shin_R: [-50, 0, 0], hip: [0, -0.04, 0.01] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- right roundhouse: hip turns over, leg whips across
  roundhouse: [
    k(0.0, {}),
    k(0.3, { hips: [-2, 26, 0], chest: [-2, 10, 0], thigh_R: [60, 0, 34], shin_R: [-108, 0, 0], foot_R: [-10, 0, 0], thigh_L: [-4, 0, 3], shin_L: [-18, 0, 0],
      upperArm_L: [50, 0, 34], upperArm_R: [10, 0, 40], forearm_R: [80, 0, 0], hip: [0, -0.02, -0.02] }, 'out'),
    k(0.45, { hips: [-10, 62, 0], spine: [-8, 12, 6], chest: [-12, 8, 14], head: [6, -30, 0], thigh_R: [74, -10, 80], shin_R: [-6, 0, 0], foot_R: [-22, 0, 0],
      thigh_L: [-2, 0, 3], shin_L: [-12, 0, 0], foot_L: [12, 0, 0], upperArm_L: [26, 0, 46], forearm_L: [70, 0, 0], upperArm_R: [-20, 0, 52], forearm_R: [50, 0, 0], hip: [0, 0.0, 0.02] }, 'in'),
    k(0.6, { hips: [-10, 72, 0], thigh_R: [66, -10, 70], shin_R: [-40, 0, 0], hip: [0, -0.01, 0.02] }),
    k(0.82, { hips: [0, 30, 0], thigh_R: [36, 0, 20], shin_R: [-60, 0, 0], hip: [0, -0.04, 0.0] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- stomp on a man who's down
  stomp: [
    k(0.0, {}),
    k(0.33, { hips: [-4, 6, 0], thigh_R: [84, 0, 3], shin_R: [-104, 0, 0], foot_R: [10, 0, 0], chest: [-6, 0, 0], upperArm_L: [30, 0, 36], upperArm_R: [10, 0, 40], hip: [0, 0.02, -0.02] }, 'out'),
    k(0.45, { hips: [16, 6, 0], spine: [12, 0, 0], chest: [16, 0, 0], head: [20, 0, 0], thigh_R: [28, 0, 3], shin_R: [-4, 0, 0], foot_R: [-6, 0, 0],
      thigh_L: [-8, 0, 3], shin_L: [-34, 0, 0], foot_L: [30, 0, 0], hip: [0, -0.1, 0.08] }, 'in'),
    k(0.62, { hips: [14, 6, 0], chest: [14, 0, 0], thigh_R: [32, 0, 3], shin_R: [-10, 0, 0], hip: [0, -0.1, 0.07] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- headbutt (in a clinch)
  headbutt: [
    k(0.0, { upperArm_L: [70, 0, 22], forearm_L: [40, 0, 0], upperArm_R: [70, 0, 22], forearm_R: [40, 0, 0] }),
    k(0.33, { hips: [-6, 0, 0], spine: [-10, 0, 0], chest: [-14, 0, 0], neck: [-12, 0, 0], head: [-24, 0, 0],
      upperArm_L: [76, 0, 20], forearm_L: [34, 0, 0], upperArm_R: [76, 0, 20], forearm_R: [34, 0, 0], hip: [0, -0.02, -0.05] }, 'out'),
    k(0.44, { hips: [10, 0, 0], spine: [16, 0, 0], chest: [22, 0, 0], neck: [18, 0, 0], head: [28, 0, 0],
      upperArm_L: [62, 0, 22], forearm_L: [52, 0, 0], upperArm_R: [62, 0, 22], forearm_R: [52, 0, 0], thigh_R: [30, 0, 3], shin_R: [-24, 0, 0], hip: [0, -0.04, 0.1] }, 'in'),
    k(0.6, { chest: [18, 0, 0], head: [20, 0, 0], hip: [0, -0.04, 0.08] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- shoulder charge (running)
  shoulder: [
    k(0.0, {}),
    k(0.3, { hips: [16, -20, 0], spine: [16, -10, 0], chest: [18, -20, 0], head: [-8, 18, 0], shoulder_R: [12, 0, 10],
      upperArm_R: [10, 0, 10], forearm_R: [120, 0, 0], upperArm_L: [26, 0, 24], forearm_L: [120, 0, 0],
      thigh_R: [40, 0, 3], shin_R: [-44, 0, 0], thigh_L: [-30, 0, 3], shin_L: [-30, 0, 0], hip: [0, -0.1, 0.0] }, 'out'),
    k(0.45, { hips: [24, -34, 0], spine: [20, -14, 0], chest: [24, -30, 0], head: [-14, 26, 0], shoulder_R: [24, 0, 16],
      upperArm_R: [16, 0, 8], forearm_R: [124, 0, 0], thigh_R: [52, 0, 3], shin_R: [-30, 0, 0], thigh_L: [-44, 0, 3], shin_L: [-14, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.12, 0.12] }, 'in'),
    k(0.7, { hips: [18, -24, 0], chest: [18, -20, 0], hip: [0, -0.1, 0.08] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- weapon swing (right hand, overhead to across)
  swing: [
    k(0.0, {}),
    k(0.33, { hips: [-4, -20, 0], spine: [-8, -10, 0], chest: [-12, -30, 0], head: [-6, 16, 0], shoulder_R: [-8, 0, 20],
      upperArm_R: [170, 0, 20], forearm_R: [50, 0, 0], hand_R: [-30, 0, 0], upperArm_L: [50, 0, 30], forearm_L: [90, 0, 0], hip: [0, -0.03, -0.06], ikR: [-0.22, 1.86, -0.08] }, 'out'),
    k(0.45, { hips: [14, 24, 0], spine: [10, 12, 0], chest: [18, 32, 0], head: [6, -12, 0], shoulder_R: [22, 0, 10],
      upperArm_R: [62, 0, 20], forearm_R: [6, 0, 0], hand_R: [10, 0, 0], upperArm_L: [30, 0, 30], forearm_L: [100, 0, 0],
      thigh_R: [34, 0, 3], shin_R: [-26, 0, 0], thigh_L: [-30, 0, 3], shin_L: [-10, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.07, 0.11], ikR: [-0.05, 1.22, 0.78] }, 'in'),
    k(0.62, { hips: [16, 34, 0], chest: [20, 44, 0], upperArm_R: [28, 0, 24], forearm_R: [16, 0, 0], hip: [0, -0.08, 0.1], ikR: [0.26, 0.86, 0.5] }),
    k(0.85, { hips: [8, 14, 0], chest: [8, 6, 0], upperArm_R: [36, 0, 18], forearm_R: [96, 0, 0], hip: [0, -0.04, 0.03], ikR: [-0.13, 1.3, 0.3] }, 'out'),
    k(1.0, {}),
  ],
};
// variants that share a clip
CLIPS.jab2 = CLIPS.jab;
CLIPS.thrust = CLIPS.cross;

// ------------------------------------------------------------------ evaluation
const ease = {
  io: t => t * t * (3 - 2 * t),
  in: t => t * t * t,                       // accelerate into the key (strikes)
  out: t => 1 - (1 - t) * (1 - t),          // decelerate into the key (wind-ups, settling)
  lin: t => t,
};
const val = (key, bone) => key[1][bone] || G[bone];

// fill out[bone] = [x,y,z] degrees (+ out.hip metres) for clip at u in [0,1]
export function evalClip(clip, u, out) {
  let i = 0;
  while (i < clip.length - 2 && u > clip[i + 1][0]) i++;
  const a = clip[i], b = clip[i + 1];
  const t = Math.max(0, Math.min(1, (u - a[0]) / Math.max(1e-6, b[0] - a[0])));
  const e = (ease[b[2]] || ease.io)(t);
  for (const bone in G) {
    const va = val(a, bone), vb = val(b, bone);
    const o = out[bone] || (out[bone] = [0, 0, 0]);
    o[0] = va[0] + (vb[0] - va[0]) * e; o[1] = va[1] + (vb[1] - va[1]) * e; o[2] = va[2] + (vb[2] - va[2]) * e;
  }
  // fist targets: position from whichever keys have one, weight blends in/out (1 = full IK)
  for (const ik of ['ikL', 'ikR']) {
    const pa = a[1][ik], pb = b[1][ik];
    const o = out[ik] || (out[ik] = { v: [0, 0, 0], w: 0 });
    if (!pa && !pb) { o.w = 0; continue; }
    const A = pa || pb, B = pb || pa;
    o.v[0] = A[0] + (B[0] - A[0]) * e; o.v[1] = A[1] + (B[1] - A[1]) * e; o.v[2] = A[2] + (B[2] - A[2]) * e;
    o.w = (pa ? 1 : 0) + ((pb ? 1 : 0) - (pa ? 1 : 0)) * e;
  }
  return out;
}

// where in the clip an attack is: same phase timing as the pose library (game/fighter.js getPose)
export function attackU(f) {
  const a = f.attack;
  if (!a) return 0;
  const d = a.def;
  const su = a.startup ?? d.startup;
  let p;
  if (a.phase === 0) p = a.t / Math.max(1e-6, su);
  else if (a.phase === 1) p = d.air ? Math.min(1, (a.t - su) / 0.12) : (a.t - su) / Math.max(1e-6, d.active);
  else p = d.air ? (a.t - (a.landT || 0)) / Math.max(1e-6, d.recovery) : (a.t - su - d.active) / Math.max(1e-6, d.recovery);
  p = Math.max(0, Math.min(1, p));
  const ph = Math.max(0, Math.min(2, a.phase));
  return PHASE_U[ph] + (PHASE_U[ph + 1] - PHASE_U[ph]) * p;
}
