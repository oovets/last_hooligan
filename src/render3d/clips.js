// Hand-keyed strike clips for the v2 characters (overhaul: "key clips").
//
// A clip is a list of key poses on a normalised timeline that is locked to the attack's phases, so the impact pose
// always lands on the game's real hit frames (combat.js startup / active / recovery):
//   u 0.00 - 0.35  startup   (anticipation: weight back, shoulder pulled, fist cocked)
//   u 0.35 - 0.50  active    (the kinetic chain: hips -> chest -> shoulder -> arm, slight overextension on impact)
//   u 0.50 - 1.00  recovery  (follow-through, then settle back into the guard)
//
// Key = [u, { bone: [x, y, z] (degrees), hip: [x, y, z] (metres: x side, y up, z forward),
//            ikL / ikR: [side, up, forward], yaw: degrees (whole-body turn on top of the facing; - = clockwise from above) }, ease]
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

// Fat Vic's two-handed throat grip (shared by the vic_* strike clips and the choking state clip)
const CHOKER = {
  hips: [-2, 0, 0], spine: [-2, 0, 0], chest: [-6, 0, 0], neck: [0, 0, 0], head: [6, 0, 0],
  shoulder_L: [14, 0, 10], shoulder_R: [14, 0, 10],
  thigh_R: [26, 0, 10], shin_R: [-34, 0, 0], thigh_L: [-20, 0, 10], shin_L: [-30, 0, 0],
  hip: [0, -0.12, 0.0], ikL: [0.09, 1.56, 0.52], ikR: [-0.09, 1.56, 0.52],
};

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
  // -------------------------------------------------------------- spinning back kick: turn the back, whip the right heel round a full circle
  spinKick: [
    k(0.0, {}),
    k(0.32, { yaw: -150, hips: [-4, 0, 0], spine: [-4, 0, 0], chest: [-4, 0, 0], head: [6, 60, 0], thigh_R: [56, 0, 18], shin_R: [-100, 0, 0], foot_R: [0, 0, 0],
      thigh_L: [-6, 0, 3], shin_L: [-30, 0, 0], foot_L: [20, 0, 0], upperArm_L: [50, 0, 24], forearm_L: [120, 0, 0], upperArm_R: [44, 0, 22], forearm_R: [124, 0, 0], hip: [0, -0.08, 0] }, 'in'),
    k(0.45, { yaw: -290, hips: [-16, 44, 0], spine: [-8, 12, 6], chest: [-12, 8, 16], head: [6, -34, 0], thigh_R: [82, -10, 86], shin_R: [-4, 0, 0], foot_R: [-24, 0, 0],
      thigh_L: [-2, 0, 3], shin_L: [-12, 0, 0], foot_L: [12, 0, 0], upperArm_L: [24, 0, 50], forearm_L: [70, 0, 0], upperArm_R: [-24, 0, 56], forearm_R: [50, 0, 0], hip: [0, 0.01, 0.02] }, 'lin'),
    k(0.6, { yaw: -340, hips: [-10, 40, 0], chest: [-8, 4, 10], head: [4, -24, 0], thigh_R: [60, -10, 62], shin_R: [-40, 0, 0], upperArm_L: [30, 0, 40], upperArm_R: [-10, 0, 46], hip: [0, -0.01, 0.02] }, 'out'),
    k(0.85, { yaw: -360, hips: [2, 16, 0], thigh_R: [30, 0, 12], shin_R: [-56, 0, 0], hip: [0, -0.05, 0.0] }, 'out'),
    k(1.0, { yaw: -360 }),
  ],
  // -------------------------------------------------------------- flying kick (air): crouch, leap, right leg spears out and holds until landing
  flyingKick: [
    k(0.0, {}),
    k(0.35, { hips: [14, 6, 0], spine: [10, 0, 0], chest: [12, -6, 0], thigh_R: [64, 0, 4], shin_R: [-96, 0, 0], foot_R: [24, 0, 0], thigh_L: [30, 0, 4], shin_L: [-90, 0, 0], foot_L: [40, 0, 0],
      upperArm_L: [-30, 0, 20], forearm_L: [40, 0, 0], upperArm_R: [-36, 0, 20], forearm_R: [40, 0, 0], hip: [0, -0.26, 0] }, 'out'),
    k(0.5, { hips: [-24, 14, 0], spine: [-6, 0, 0], chest: [-4, -10, 0], head: [16, -8, 0], thigh_R: [100, 0, 4], shin_R: [-2, 0, 0], foot_R: [-20, 0, 0],
      thigh_L: [70, 0, 6], shin_L: [-128, 0, 0], foot_L: [10, 0, 0], upperArm_L: [70, 0, 40], forearm_L: [60, 0, 0], upperArm_R: [-40, 0, 50], forearm_R: [30, 0, 0], hip: [0, 0.1, 0.06] }, 'in'),
    k(0.66, { hips: [16, 6, 0], spine: [10, 0, 0], chest: [10, -4, 0], thigh_R: [70, 0, 6], shin_R: [-110, 0, 0], foot_R: [30, 0, 0], thigh_L: [50, 0, 6], shin_L: [-100, 0, 0], foot_L: [40, 0, 0],
      upperArm_L: [40, 0, 40], upperArm_R: [30, 0, 44], hip: [0, -0.32, 0.02] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- jump kick (air): both knees tucked, right foot snaps out at chest height
  jumpKick: [
    k(0.0, {}),
    k(0.35, { hips: [10, 0, 0], thigh_R: [80, 0, 6], shin_R: [-120, 0, 0], thigh_L: [70, 0, 6], shin_L: [-124, 0, 0], foot_L: [20, 0, 0],
      upperArm_L: [60, 0, 30], forearm_L: [100, 0, 0], upperArm_R: [56, 0, 30], forearm_R: [100, 0, 0], hip: [0, -0.04, 0] }, 'out'),
    k(0.5, { hips: [-16, 20, 0], chest: [-6, -12, 0], head: [10, -10, 0], thigh_R: [90, 0, 10], shin_R: [-4, 0, 0], foot_R: [-20, 0, 0],
      thigh_L: [76, 0, 8], shin_L: [-132, 0, 0], upperArm_L: [50, 0, 50], forearm_L: [90, 0, 0], upperArm_R: [20, 0, 60], forearm_R: [80, 0, 0], hip: [0, 0.04, 0.04] }, 'in'),
    k(0.66, { hips: [14, 6, 0], chest: [8, 0, 0], thigh_R: [64, 0, 6], shin_R: [-104, 0, 0], foot_R: [26, 0, 0], thigh_L: [46, 0, 6], shin_L: [-96, 0, 0], foot_L: [38, 0, 0], hip: [0, -0.28, 0.02] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- dive punch (air): right fist hammers down at a man below
  divePunch: [
    k(0.0, {}),
    k(0.35, { hips: [-6, -10, 0], chest: [-8, -20, 0], thigh_R: [60, 0, 6], shin_R: [-110, 0, 0], thigh_L: [40, 0, 6], shin_L: [-110, 0, 0],
      upperArm_L: [60, 0, 30], forearm_L: [90, 0, 0], hip: [0, -0.06, 0], ikR: [-0.2, 1.95, -0.05] }, 'out'),
    k(0.5, { hips: [36, 14, 0], spine: [14, 6, 0], chest: [16, 16, 0], head: [10, -8, 0], shoulder_R: [24, 0, 0], thigh_R: [10, 0, 6], shin_R: [-100, 0, 0], foot_R: [-20, 0, 0],
      thigh_L: [-10, 0, 6], shin_L: [-90, 0, 0], foot_L: [-20, 0, 0], upperArm_L: [-20, 0, 40], forearm_L: [60, 0, 0], hip: [0, 0.0, 0.06], ikR: [-0.06, 0.62, 0.86] }, 'in'),
    k(0.66, { hips: [20, 6, 0], spine: [12, 0, 0], chest: [14, 6, 0], thigh_R: [70, 0, 6], shin_R: [-112, 0, 0], foot_R: [30, 0, 0], thigh_L: [48, 0, 6], shin_L: [-100, 0, 0], foot_L: [40, 0, 0],
      hip: [0, -0.34, 0.04], ikR: [-0.1, 0.7, 0.62] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- knee to the gut (in a clinch): drag his head down onto a rising right knee
  knee: [
    k(0.0, { hips: [8, 0, 0], chest: [10, 0, 0], shoulder_L: [16, 0, 0], shoulder_R: [16, 0, 0], hip: [0, -0.06, 0.04], ikL: [0.13, 1.34, 0.56], ikR: [-0.13, 1.34, 0.56] }),
    k(0.33, { hips: [2, 0, 0], chest: [12, 0, 0], head: [6, 0, 0], shoulder_L: [16, 0, 0], shoulder_R: [16, 0, 0], thigh_R: [10, 0, 3], shin_R: [-80, 0, 0], foot_R: [-20, 0, 0],
      thigh_L: [-8, 0, 3], shin_L: [-20, 0, 0], hip: [0, -0.04, -0.04], ikL: [0.12, 1.4, 0.5], ikR: [-0.12, 1.4, 0.5] }, 'out'),
    k(0.45, { hips: [-14, 0, 0], spine: [14, 0, 0], chest: [22, 0, 0], head: [14, 0, 0], shoulder_L: [24, 0, 0], shoulder_R: [24, 0, 0],
      thigh_R: [104, 0, 4], shin_R: [-124, 0, 0], foot_R: [-24, 0, 0], thigh_L: [-12, 0, 3], shin_L: [-8, 0, 0], foot_L: [14, 0, 0], hip: [0, 0.05, 0.06], ikL: [0.12, 1.16, 0.46], ikR: [-0.12, 1.16, 0.46] }, 'in'),
    k(0.62, { hips: [-8, 0, 0], spine: [10, 0, 0], chest: [16, 0, 0], thigh_R: [80, 0, 4], shin_R: [-110, 0, 0], hip: [0, 0.02, 0.04], ikL: [0.12, 1.22, 0.5], ikR: [-0.12, 1.22, 0.5] }),
    k(1.0, { hips: [8, 0, 0], chest: [10, 0, 0], shoulder_L: [16, 0, 0], shoulder_R: [16, 0, 0], thigh_R: [26, 0, 4], shin_R: [-30, 0, 0], hip: [0, -0.06, 0.04], ikL: [0.13, 1.34, 0.56], ikR: [-0.13, 1.34, 0.56] }, 'out'),
  ],
  // -------------------------------------------------------------- throw (a man he's holding): hoist him up, heave him forward
  throw: [
    k(0.0, { hips: [8, 0, 0], chest: [10, 0, 0], shoulder_L: [16, 0, 0], shoulder_R: [16, 0, 0], hip: [0, -0.06, 0.04], ikL: [0.13, 1.34, 0.56], ikR: [-0.13, 1.34, 0.56] }),
    k(0.35, { hips: [-14, -10, 0], spine: [-10, 0, 0], chest: [-14, -8, 0], head: [-10, 0, 0], shoulder_L: [0, 0, 20], shoulder_R: [0, 0, 20],
      thigh_R: [30, 0, 8], shin_R: [-50, 0, 0], thigh_L: [-20, 0, 8], shin_L: [-46, 0, 0], foot_L: [30, 0, 0], hip: [0, -0.16, -0.08], ikL: [0.16, 1.86, 0.3], ikR: [-0.12, 1.88, 0.28] }, 'out'),
    k(0.5, { hips: [22, 16, 0], spine: [16, 6, 0], chest: [22, 12, 0], head: [6, -8, 0], shoulder_L: [26, 0, 0], shoulder_R: [26, 0, 0],
      thigh_R: [40, 0, 4], shin_R: [-28, 0, 0], thigh_L: [-36, 0, 4], shin_L: [-10, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.1, 0.14], ikL: [0.18, 1.2, 0.86], ikR: [-0.14, 1.16, 0.88] }, 'in'),
    k(0.7, { hips: [18, 14, 0], chest: [16, 10, 0], thigh_R: [36, 0, 4], shin_R: [-30, 0, 0], thigh_L: [-30, 0, 4], shin_L: [-14, 0, 0], hip: [0, -0.08, 0.1], ikL: [0.2, 1.0, 0.7], ikR: [-0.16, 0.98, 0.72] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- two-handed shove
  push: [
    k(0.0, {}),
    k(0.35, { hips: [-4, 0, 0], chest: [-6, 0, 0], shoulder_L: [-10, 0, 0], shoulder_R: [-10, 0, 0], thigh_R: [24, 0, 4], shin_R: [-34, 0, 0], hip: [0, -0.06, -0.06],
      ikL: [0.17, 1.3, 0.22], ikR: [-0.17, 1.3, 0.22] }, 'out'),
    k(0.48, { hips: [14, 0, 0], spine: [10, 0, 0], chest: [14, 0, 0], head: [-4, 0, 0], shoulder_L: [26, 0, 0], shoulder_R: [26, 0, 0], hand_L: [-50, 0, 0], hand_R: [-50, 0, 0],
      thigh_R: [36, 0, 4], shin_R: [-24, 0, 0], thigh_L: [-34, 0, 4], shin_L: [-6, 0, 0], foot_L: [36, 0, 0], hip: [0, -0.07, 0.12], ikL: [0.19, 1.34, 0.78], ikR: [-0.19, 1.34, 0.78] }, 'in'),
    k(0.66, { hips: [12, 0, 0], chest: [12, 0, 0], shoulder_L: [20, 0, 0], shoulder_R: [20, 0, 0], hand_L: [-40, 0, 0], hand_R: [-40, 0, 0], hip: [0, -0.06, 0.1], ikL: [0.19, 1.34, 0.72], ikR: [-0.19, 1.34, 0.72] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- open-hand slap (right hand, wide and insulting)
  slap: [
    k(0.0, {}),
    k(0.35, { hips: [0, -18, 0], chest: [-4, -28, 0], head: [-4, 14, 0], shoulder_R: [-6, 0, 10], hand_R: [-30, 0, 0], hip: [0, -0.03, -0.03], ikR: [-0.6, 1.5, 0.08] }, 'out'),
    k(0.47, { hips: [6, 16, 0], chest: [8, 26, 0], head: [-2, -10, 0], shoulder_R: [18, 0, 4], hand_R: [-20, 0, 0], thigh_R: [28, 0, 3], shin_R: [-22, 0, 0], hip: [0, -0.04, 0.06], ikR: [0.02, 1.5, 0.66] }, 'in'),
    k(0.64, { hips: [6, 24, 0], chest: [8, 34, 0], shoulder_R: [16, 0, 4], hip: [0, -0.04, 0.05], ikR: [0.3, 1.4, 0.5] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- counter: slip the punch low, come back with a right that lands first
  counter: [
    k(0.0, {}),
    k(0.3, { hips: [18, -16, -6], spine: [10, 0, 8], chest: [14, -20, 14], head: [6, 12, 8], thigh_R: [44, 0, 6], shin_R: [-64, 0, 0], thigh_L: [0, 0, 8], shin_L: [-56, 0, 0], foot_L: [40, 0, 0],
      hip: [-0.12, -0.24, 0.0], ikL: [0.12, 1.3, 0.32], ikR: [-0.18, 1.22, 0.12] }, 'out'),
    k(0.45, { hips: [10, 20, 0], spine: [8, 8, 0], chest: [12, 24, 0], head: [-4, -12, 0], shoulder_R: [28, 0, 6], upperArm_L: [30, 0, 22], forearm_L: [120, 0, 0],
      thigh_R: [34, 0, 3], shin_R: [-26, 0, 0], thigh_L: [-34, 0, 3], shin_L: [-8, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.07, 0.14], ikR: [-0.02, 1.4, 0.94] }, 'in'),
    k(0.6, { hips: [10, 22, 0], chest: [12, 28, 0], shoulder_R: [22, 0, 6], hip: [0, -0.07, 0.12], ikR: [-0.01, 1.4, 0.84] }),
    k(0.85, { hips: [6, 14, 0], chest: [5, 0, 0], hip: [0, -0.04, 0.03], ikR: [-0.11, 1.42, 0.36] }, 'out'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- back elbow: right elbow driven backwards, looking over the shoulder
  backElbow: [
    k(0.0, {}),
    k(0.35, { hips: [4, 12, 0], chest: [6, 22, 0], head: [2, -30, 0], upperArm_R: [60, 0, 10], forearm_R: [140, 0, 0], hand_R: [-10, 0, 0], hip: [0, -0.05, 0.02] }, 'out'),
    k(0.47, { hips: [6, -22, 0], spine: [4, -10, 0], chest: [8, -34, 0], head: [0, -60, 0], shoulder_R: [-16, 0, 6], upperArm_R: [-74, 0, 18], forearm_R: [136, 0, 0], hand_R: [0, 0, 0],
      upperArm_L: [50, 0, 20], forearm_L: [110, 0, 0], thigh_R: [10, 0, 3], shin_R: [-26, 0, 0], thigh_L: [-24, 0, 3], shin_L: [-22, 0, 0], hip: [0, -0.07, -0.08] }, 'in'),
    k(0.66, { hips: [6, -18, 0], chest: [8, -28, 0], head: [0, -50, 0], upperArm_R: [-60, 0, 16], forearm_R: [130, 0, 0], hip: [0, -0.06, -0.06] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- back kick: fold forward, mule-kick the right heel straight back
  backKick: [
    k(0.0, {}),
    k(0.35, { hips: [18, 0, 0], spine: [8, 0, 0], chest: [10, -6, 0], head: [0, -40, 0], thigh_R: [60, 0, 4], shin_R: [-120, 0, 0], foot_R: [10, 0, 0],
      thigh_L: [10, 0, 3], shin_L: [-30, 0, 0], foot_L: [20, 0, 0], hip: [0, -0.06, 0.02] }, 'out'),
    k(0.47, { hips: [46, -6, 0], spine: [8, 0, 0], chest: [6, -6, 0], neck: [-14, 0, 0], head: [-20, -50, 0], thigh_R: [-100, 0, 4], shin_R: [-6, 0, 0], foot_R: [-40, 0, 0],
      thigh_L: [36, 0, 3], shin_L: [-20, 0, 0], foot_L: [-10, 0, 0], upperArm_L: [70, 0, 30], forearm_L: [90, 0, 0], upperArm_R: [60, 0, 30], forearm_R: [100, 0, 0], hip: [0, -0.1, 0.12] }, 'in'),
    k(0.64, { hips: [40, -4, 0], head: [-16, -44, 0], thigh_R: [-80, 0, 4], shin_R: [-40, 0, 0], thigh_L: [32, 0, 3], shin_L: [-20, 0, 0], foot_L: [-10, 0, 0], hip: [0, -0.1, 0.1] }, 'out'),
    k(0.84, { hips: [16, 0, 0], thigh_R: [20, 0, 4], shin_R: [-70, 0, 0], hip: [0, -0.05, 0.02] }, 'io'),
    k(1.0, {}),
  ],
  // -------------------------------------------------------------- body slam (the big lads): arms up, then fall on him like a wardrobe
  bodySlam: [
    k(0.0, {}),
    k(0.35, { hips: [-14, 0, 0], spine: [-10, 0, 0], chest: [-12, 0, 0], neck: [-6, 0, 0], head: [-10, 0, 0], upperArm_L: [168, 0, 30], forearm_L: [30, 0, 0], upperArm_R: [168, 0, 30], forearm_R: [30, 0, 0],
      thigh_R: [30, 0, 8], shin_R: [-40, 0, 0], thigh_L: [-14, 0, 8], shin_L: [-36, 0, 0], hip: [0, -0.02, -0.08] }, 'out'),
    k(0.48, { hips: [56, 0, 0], spine: [12, 0, 0], chest: [14, 0, 0], neck: [-20, 0, 0], head: [-26, 0, 0], upperArm_L: [130, 0, 50], forearm_L: [20, 0, 0], upperArm_R: [130, 0, 50], forearm_R: [20, 0, 0],
      thigh_R: [10, 0, 8], shin_R: [-30, 0, 0], foot_R: [-20, 0, 0], thigh_L: [-40, 0, 8], shin_L: [-10, 0, 0], foot_L: [-10, 0, 0], hip: [0, -0.34, 0.36] }, 'in'),
    k(0.7, { hips: [44, 0, 0], spine: [10, 0, 0], chest: [10, 0, 0], neck: [-14, 0, 0], head: [-16, 0, 0], upperArm_L: [100, 0, 40], forearm_L: [40, 0, 0], upperArm_R: [100, 0, 40], forearm_R: [40, 0, 0],
      thigh_R: [60, 0, 8], shin_R: [-90, 0, 0], thigh_L: [10, 0, 8], shin_L: [-80, 0, 0], foot_L: [30, 0, 0], hip: [0, -0.4, 0.24] }, 'io'),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- overarm throw (bottles, bricks): cock it behind the head, hurl
  throwItem: [
    k(0.0, {}),
    k(0.35, { hips: [-6, -24, 0], spine: [-8, -10, 0], chest: [-12, -30, 0], head: [-4, 20, 0], shoulder_R: [-10, 0, 14], upperArm_L: [80, 0, 20], forearm_L: [40, 0, 0],
      thigh_R: [26, 0, 4], shin_R: [-20, 0, 0], thigh_L: [-20, 0, 4], shin_L: [-36, 0, 0], hip: [0, -0.04, -0.08], ikR: [-0.3, 1.82, -0.3] }, 'out'),
    k(0.47, { hips: [12, 22, 0], spine: [10, 10, 0], chest: [14, 30, 0], head: [-4, -12, 0], shoulder_R: [22, 0, 10], upperArm_L: [20, 0, 30], forearm_L: [90, 0, 0],
      thigh_R: [34, 0, 3], shin_R: [-26, 0, 0], thigh_L: [-32, 0, 3], shin_L: [-10, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.07, 0.12], ikR: [-0.06, 1.72, 0.72] }, 'in'),
    k(0.66, { hips: [16, 30, 0], chest: [18, 40, 0], hip: [0, -0.08, 0.12], ikR: [0.14, 1.0, 0.56] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- Tina's axe kick: right leg straight up past her head, heel chopped down
  tina_axe: [
    k(0.0, {}),
    k(0.35, { hips: [-22, 8, 0], spine: [-8, 0, 0], chest: [-8, -6, 0], head: [16, 0, 0], thigh_R: [156, 0, 12], shin_R: [-8, 0, 0], foot_R: [-10, 0, 0],
      thigh_L: [-4, 0, 3], shin_L: [-8, 0, 0], foot_L: [10, 0, 0], upperArm_L: [40, 0, 40], forearm_L: [100, 0, 0], upperArm_R: [20, 0, 46], forearm_R: [90, 0, 0], hip: [0, 0.02, -0.04] }, 'out'),
    k(0.47, { hips: [14, 8, 0], spine: [10, 0, 0], chest: [12, -6, 0], head: [10, 0, 0], thigh_R: [52, 0, 6], shin_R: [-4, 0, 0], foot_R: [-26, 0, 0],
      thigh_L: [-10, 0, 3], shin_L: [-30, 0, 0], foot_L: [30, 0, 0], upperArm_L: [50, 0, 30], forearm_L: [110, 0, 0], upperArm_R: [40, 0, 30], forearm_R: [110, 0, 0], hip: [0, -0.1, 0.08] }, 'in'),
    k(0.64, { hips: [12, 6, 0], chest: [10, -4, 0], thigh_R: [40, 0, 4], shin_R: [-16, 0, 0], hip: [0, -0.1, 0.07] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- Fat Vic: squeeze (STRYPGREPP tightens: shrug, lean back, hands up and in)
  vic_tighten: [
    k(0.0, CHOKER),
    k(0.35, { ...CHOKER, chest: [-2, 0, 0], shoulder_L: [8, 0, 4], shoulder_R: [8, 0, 4], hip: [0, -0.14, 0.02], ikL: [0.1, 1.5, 0.54], ikR: [-0.1, 1.5, 0.54] }, 'out'),
    k(0.47, { ...CHOKER, hips: [-8, 0, 0], spine: [-6, 0, 0], chest: [-14, 0, 0], head: [10, 0, 0], shoulder_L: [20, 0, 22], shoulder_R: [20, 0, 22], hip: [0, -0.08, -0.03], ikL: [0.06, 1.66, 0.48], ikR: [-0.06, 1.66, 0.48] }, 'in'),
    k(0.66, { ...CHOKER, hips: [-6, 0, 0], chest: [-12, 0, 0], shoulder_L: [18, 0, 18], shoulder_R: [18, 0, 18], hip: [0, -0.09, -0.02], ikL: [0.07, 1.64, 0.5], ikR: [-0.07, 1.64, 0.5] }),
    k(1.0, CHOKER, 'out'),
  ],
  // -------------------------------------------------------------- Fat Vic: chokeslam — hoist him overhead by the throat, then drive him into the floor
  vic_chokeslam: [
    k(0.0, CHOKER),
    k(0.35, { hips: [-16, 0, 0], spine: [-12, 0, 0], chest: [-14, 0, 0], neck: [-10, 0, 0], head: [-16, 0, 0], shoulder_L: [0, 0, 26], shoulder_R: [0, 0, 26],
      thigh_R: [24, 0, 10], shin_R: [-20, 0, 0], thigh_L: [-18, 0, 10], shin_L: [-16, 0, 0], hip: [0, 0.0, -0.1], ikL: [0.08, 2.12, 0.34], ikR: [-0.08, 2.12, 0.34] }, 'out'),
    k(0.48, { hips: [44, 0, 0], spine: [14, 0, 0], chest: [16, 0, 0], neck: [-4, 0, 0], head: [-6, 0, 0], shoulder_L: [30, 0, 0], shoulder_R: [30, 0, 0],
      thigh_R: [80, 0, 12], shin_R: [-96, 0, 0], foot_R: [10, 0, 0], thigh_L: [16, 0, 12], shin_L: [-100, 0, 0], foot_L: [44, 0, 0], hip: [0, -0.44, 0.16], ikL: [0.1, 0.52, 0.96], ikR: [-0.1, 0.52, 0.96] }, 'in'),
    k(0.7, { hips: [36, 0, 0], spine: [12, 0, 0], chest: [12, 0, 0], shoulder_L: [24, 0, 0], shoulder_R: [24, 0, 0], thigh_R: [70, 0, 12], shin_R: [-90, 0, 0], thigh_L: [14, 0, 12], shin_L: [-90, 0, 0], foot_L: [40, 0, 0],
      hip: [0, -0.4, 0.12], ikL: [0.12, 0.6, 0.86], ikR: [-0.12, 0.6, 0.86] }),
    k(1.0, {}, 'out'),
  ],
  // -------------------------------------------------------------- Fat Vic: lunge — throws his whole weight forward, both hands out for the throat
  vic_lunge: [
    k(0.0, {}),
    k(0.35, { hips: [20, 0, 0], spine: [10, 0, 0], chest: [10, 0, 0], head: [-14, 0, 0], thigh_R: [40, 0, 6], shin_R: [-60, 0, 0], thigh_L: [-20, 0, 6], shin_L: [-40, 0, 0], foot_L: [30, 0, 0],
      hip: [0, -0.18, 0.0], ikL: [0.18, 1.3, 0.3], ikR: [-0.18, 1.3, 0.3] }, 'out'),
    k(0.5, { hips: [30, 0, 0], spine: [8, 0, 0], chest: [8, 0, 0], neck: [-10, 0, 0], head: [-18, 0, 0], shoulder_L: [24, 0, 0], shoulder_R: [24, 0, 0],
      thigh_R: [56, 0, 6], shin_R: [-36, 0, 0], thigh_L: [-40, 0, 6], shin_L: [-20, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.2, 0.16], ikL: [0.12, 1.42, 0.86], ikR: [-0.12, 1.42, 0.86] }, 'in'),
    k(0.7, { hips: [20, 0, 0], chest: [6, 0, 0], head: [-10, 0, 0], shoulder_L: [16, 0, 0], shoulder_R: [16, 0, 0], thigh_R: [40, 0, 6], shin_R: [-40, 0, 0], thigh_L: [-26, 0, 6], shin_L: [-30, 0, 0],
      hip: [0, -0.14, 0.1], ikL: [0.13, 1.4, 0.7], ikR: [-0.13, 1.4, 0.7] }),
    k(1.0, {}, 'out'),
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
  // whole-body yaw (degrees, spin kicks): not smoothed by the animator, so key a full turn as 0 -> -360
  const ya = a[1].yaw || 0, yb = b[1].yaw || 0;
  out.yaw = ya + (yb - ya) * e;
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

// ======================================================================================================
// STATE CLIPS — hand-keyed motion for everything that isn't an attack (hit reactions, knockdowns, block, dodge,
// grabs, chokeholds, thrown, dizzy, taunts, victory). Same key format as CLIPS; timed by the fighter's state clock:
//   { dur (s), loop, keys, state? (fighter state it plays in, for the viewer) }
// u = loop ? (animT mod dur) / dur : min(1, animT / dur). Picked by stateClipFor(f) (characters2.js falls back to
// the pose library for anything without a state clip).
// Lying on the back = hips pitched back ~90° (x-) with the hip lowered ~0.8 m: torso points away, legs point forward.
const LIE = {
  hips: [-88, 0, 0], spine: [2, 0, 0], chest: [2, 0, 0], neck: [-4, 0, 0], head: [-8, 12, 0],
  shoulder_L: [0, 0, 0], shoulder_R: [0, 0, 0],
  upperArm_L: [138, 0, 58], forearm_L: [22, 0, 0], hand_L: [0, 0, 0],
  upperArm_R: [150, 0, 46], forearm_R: [34, 0, 0], hand_R: [0, 0, 0],
  thigh_R: [16, 0, 9], shin_R: [-34, 0, 0], foot_R: [-24, 0, 0],
  thigh_L: [4, 0, 6], shin_L: [-8, 0, 0], foot_L: [-34, 0, 0],
  hip: [0, -0.8, -0.32],
};
const lie = (o = {}) => ({ ...LIE, ...o });
const BLOCK = {
  hips: [4, 6, 0], spine: [6, -4, 0], chest: [8, -6, 0], neck: [8, 0, 0], head: [12, 0, 0],
  upperArm_L: [74, 0, 8], forearm_L: [134, 0, 0], hand_L: [-14, 0, 0],
  upperArm_R: [70, 0, 6], forearm_R: [138, 0, 0], hand_R: [-14, 0, 0],
  thigh_R: [22, 0, 4], shin_R: [-34, 0, 0], thigh_L: [-16, 0, 4], shin_L: [-28, 0, 0],
  hip: [0, -0.08, -0.02],
};
const blk = (o = {}) => ({ ...BLOCK, ...o });
const CHOKED = {
  hips: [-10, 0, 0], spine: [-12, 0, 0], chest: [-16, 0, 0], neck: [-22, 0, 0], head: [-26, 0, 0],
  thigh_R: [34, 0, 6], shin_R: [-66, 0, 0], foot_R: [-44, 0, 0], thigh_L: [-8, 0, 6], shin_L: [-34, 0, 0], foot_L: [-36, 0, 0],
  hip: [0, -0.02, -0.04], ikL: [0.07, 1.45, 0.26], ikR: [-0.07, 1.45, 0.26],
};

export const STATE_CLIPS = {
  // ---------------------------------------------------------------- hit reactions
  hurtFront: { state: 'hurt', dur: 0.42, keys: [
    k(0.0, {}),
    k(0.14, { hips: [-8, -6, 0], spine: [-10, -4, 0], chest: [-16, -8, 4], neck: [-14, 0, 0], head: [-24, -10, 8],
      upperArm_L: [24, 0, 44], forearm_L: [70, 0, 0], upperArm_R: [12, 0, 48], forearm_R: [56, 0, 0],
      thigh_R: [8, 0, 4], shin_R: [-14, 0, 0], thigh_L: [-26, 0, 4], shin_L: [-22, 0, 0], foot_L: [30, 0, 0], hip: [0, -0.05, -0.14] }, 'out'),
    k(0.5, { chest: [-6, -4, 2], head: [-8, -4, 2], upperArm_L: [38, 0, 28], forearm_L: [94, 0, 0], hip: [0, -0.05, -0.08] }, 'io'),
    k(1.0, {}, 'io'),
  ] },
  hurtHigh: { state: 'hurt', dur: 0.42, keys: [   // head snapped round (hooks, kicks to the head)
    k(0.0, {}),
    k(0.13, { hips: [-4, 14, 0], spine: [-4, 12, 0], chest: [-8, 20, -6], neck: [-6, 26, -10], head: [-12, 34, -16],
      upperArm_L: [30, 0, 52], forearm_L: [60, 0, 0], upperArm_R: [20, 0, 40], forearm_R: [80, 0, 0], thigh_L: [-24, 0, 4], shin_L: [-22, 0, 0], hip: [0.05, -0.06, -0.1] }, 'out'),
    k(0.55, { chest: [-2, 6, 0], head: [-4, 10, -4], hip: [0.02, -0.05, -0.05] }),
    k(1.0, {}),
  ] },
  hurtGut: { state: 'hurt', dur: 0.48, keys: [     // winded, doubled over
    k(0.0, {}),
    k(0.15, { hips: [18, 0, 0], spine: [18, 0, 0], chest: [24, 0, 0], neck: [6, 0, 0], head: [-6, 0, 0],
      upperArm_L: [34, 0, 8], forearm_L: [118, 0, 0], upperArm_R: [36, 0, 6], forearm_R: [122, 0, 0],
      thigh_R: [32, 0, 4], shin_R: [-46, 0, 0], thigh_L: [0, 0, 4], shin_L: [-36, 0, 0], hip: [0, -0.15, -0.1] }, 'out'),
    k(0.6, { hips: [12, 0, 0], spine: [10, 0, 0], chest: [14, 0, 0], upperArm_L: [38, 0, 12], forearm_L: [110, 0, 0], hip: [0, -0.1, -0.06] }),
    k(1.0, {}),
  ] },
  hurtBack: { state: 'hurt', dur: 0.42, keys: [    // hit from behind: lurch forward, arms thrown back
    k(0.0, {}),
    k(0.14, { hips: [12, 0, 0], spine: [14, 0, 0], chest: [18, 0, 0], neck: [10, 0, 0], head: [16, 0, 0],
      upperArm_L: [-34, 0, 30], forearm_L: [30, 0, 0], upperArm_R: [-30, 0, 34], forearm_R: [26, 0, 0],
      thigh_R: [36, 0, 4], shin_R: [-30, 0, 0], thigh_L: [-6, 0, 4], shin_L: [-20, 0, 0], hip: [0, -0.05, 0.14] }, 'out'),
    k(0.55, { chest: [8, 0, 0], head: [6, 0, 0], upperArm_L: [20, 0, 24], upperArm_R: [16, 0, 26], hip: [0, -0.04, 0.06] }),
    k(1.0, {}),
  ] },
  blockHit: { state: 'blockstun', dur: 0.24, keys: [
    k(0.0, blk()),
    k(0.22, blk({ chest: [-4, -10, 0], head: [2, 0, 0], hips: [-2, 4, 0], hip: [0, -0.08, -0.12], thigh_L: [-26, 0, 4], shin_L: [-20, 0, 0] }), 'out'),
    k(1.0, blk(), 'io'),
  ] },
  block: { state: 'block', dur: 0.9, loop: true, keys: [
    k(0.0, blk()), k(0.5, blk({ chest: [9, -5, 0], hip: [0, -0.09, -0.02] })), k(1.0, blk()),
  ] },
  // ---------------------------------------------------------------- down and back up
  knockdown: { state: 'knockdown', dur: 0.5, keys: [
    k(0.0, { hips: [-10, 0, 0], chest: [-18, 0, 0], head: [-26, 0, 0], upperArm_L: [40, 0, 50], upperArm_R: [36, 0, 54], hip: [0, -0.04, -0.12] }),
    k(0.32, { hips: [-46, 0, 0], spine: [-8, 0, 0], chest: [-12, 0, 0], neck: [-10, 0, 0], head: [-30, 0, 0],
      upperArm_L: [120, 0, 64], forearm_L: [24, 0, 0], upperArm_R: [128, 0, 58], forearm_R: [28, 0, 0],
      thigh_R: [64, 0, 8], shin_R: [-24, 0, 0], thigh_L: [44, 0, 8], shin_L: [-34, 0, 0], hip: [0, -0.36, -0.3] }, 'out'),
    k(0.78, lie({ hips: [-94, 0, 0], head: [-14, 6, 0], thigh_R: [30, 0, 9], thigh_L: [22, 0, 6], hip: [0, -0.82, -0.36] }), 'in'),
    k(0.9, lie({ hips: [-86, 0, 0], thigh_R: [20, 0, 9], hip: [0, -0.78, -0.34] }), 'out'),   // bounce
    k(1.0, lie(), 'io'),
  ] },
  down: { state: 'down', dur: 1.4, loop: true, keys: [
    k(0.0, lie()), k(0.5, lie({ chest: [-2, 0, 0], neck: [-8, 0, 0], head: [-14, 18, 0], thigh_R: [22, 0, 9], shin_R: [-44, 0, 0] })), k(1.0, lie()),
  ] },
  ko: { state: 'dead', dur: 1.0, loop: true, keys: [
    k(0.0, lie({ head: [-4, 36, 10], upperArm_L: [120, 0, 74], upperArm_R: [96, 0, 70], forearm_R: [60, 0, 0], thigh_L: [0, 0, 18], shin_L: [-4, 0, 0] })),
    k(1.0, lie({ head: [-4, 36, 10], upperArm_L: [120, 0, 74], upperArm_R: [96, 0, 70], forearm_R: [60, 0, 0], thigh_L: [0, 0, 18], shin_L: [-4, 0, 0] })),
  ] },
  getup: { state: 'getup', dur: 0.46, keys: [
    k(0.0, lie()),
    k(0.32, { hips: [-34, 0, 0], spine: [22, 0, 0], chest: [26, 0, 0], neck: [4, 0, 0], head: [6, 0, 0],
      upperArm_L: [-46, 0, 34], forearm_L: [14, 0, 0], upperArm_R: [-44, 0, 30], forearm_R: [12, 0, 0],
      thigh_R: [104, 0, 6], shin_R: [-136, 0, 0], foot_R: [20, 0, 0], thigh_L: [70, 0, 10], shin_L: [-104, 0, 0], foot_L: [14, 0, 0], hip: [0, -0.62, -0.2] }, 'out'),
    k(0.66, { hips: [22, 0, 0], spine: [18, 0, 0], chest: [20, -4, 0], head: [-6, 0, 0],
      upperArm_L: [40, 0, 30], forearm_L: [96, 0, 0], upperArm_R: [36, 0, 28], forearm_R: [104, 0, 0],
      thigh_R: [88, 0, 6], shin_R: [-118, 0, 0], foot_R: [26, 0, 0], thigh_L: [52, 0, 8], shin_L: [-96, 0, 0], foot_L: [40, 0, 0], hip: [0, -0.44, -0.06] }, 'io'),
    k(1.0, {}, 'out'),
  ] },
  // ---------------------------------------------------------------- dodge: duck and slip to the side, come up in guard
  dodge: { state: 'dodge', dur: 0.42, keys: [
    k(0.0, {}),
    k(0.3, { hips: [22, 10, -6], spine: [16, 0, 10], chest: [20, -10, 18], neck: [8, 0, 8], head: [6, 10, 12],
      upperArm_L: [62, 0, 12], forearm_L: [128, 0, 0], upperArm_R: [58, 0, 10], forearm_R: [132, 0, 0],
      thigh_R: [56, 0, 10], shin_R: [-82, 0, 0], foot_R: [20, 0, 0], thigh_L: [12, 0, 16], shin_L: [-70, 0, 0], foot_L: [46, 0, 0], hip: [-0.18, -0.34, 0.0] }, 'out'),
    k(0.62, { hips: [14, -6, 4], spine: [10, 0, -6], chest: [12, 4, -10], head: [4, -6, -6],
      upperArm_L: [58, 0, 14], forearm_L: [122, 0, 0], upperArm_R: [54, 0, 12], forearm_R: [126, 0, 0],
      thigh_R: [40, 0, 4], shin_R: [-60, 0, 0], thigh_L: [-4, 0, 4], shin_L: [-48, 0, 0], hip: [0.08, -0.2, 0.02] }, 'io'),
    k(1.0, {}, 'out'),
  ] },
  // ---------------------------------------------------------------- grabs, chokeholds, being thrown
  grabbing: { state: 'grabbing', dur: 0.7, loop: true, keys: [
    k(0.0, { hips: [8, 0, 0], chest: [10, 0, 0], head: [6, 0, 0], shoulder_L: [16, 0, 0], shoulder_R: [16, 0, 0], thigh_R: [26, 0, 4], shin_R: [-30, 0, 0], hip: [0, -0.06, 0.04], ikL: [0.13, 1.34, 0.56], ikR: [-0.13, 1.34, 0.56] }),
    k(0.5, { hips: [10, 4, 0], chest: [12, 6, 0], head: [8, 0, 0], shoulder_L: [18, 0, 0], shoulder_R: [18, 0, 0], thigh_R: [26, 0, 4], shin_R: [-32, 0, 0], hip: [0, -0.07, 0.05], ikL: [0.12, 1.31, 0.58], ikR: [-0.14, 1.33, 0.56] }),
    k(1.0, { hips: [8, 0, 0], chest: [10, 0, 0], head: [6, 0, 0], shoulder_L: [16, 0, 0], shoulder_R: [16, 0, 0], thigh_R: [26, 0, 4], shin_R: [-30, 0, 0], hip: [0, -0.06, 0.04], ikL: [0.13, 1.34, 0.56], ikR: [-0.13, 1.34, 0.56] }),
  ] },
  grabbed: { state: 'grabbed', dur: 0.5, loop: true, keys: [
    k(0.0, { hips: [-6, 0, 0], chest: [-14, 0, 0], neck: [-8, 0, 0], head: [-18, 0, 0], thigh_R: [10, 0, 4], shin_R: [-20, 0, 0], thigh_L: [-18, 0, 4], shin_L: [-26, 0, 0], hip: [0, -0.05, -0.05], ikL: [0.1, 1.22, 0.36], ikR: [-0.1, 1.22, 0.36] }),
    k(0.5, { hips: [-8, 8, 0], chest: [-16, 12, 0], neck: [-8, 0, 0], head: [-20, -10, 0], thigh_R: [16, 0, 4], shin_R: [-30, 0, 0], thigh_L: [-12, 0, 4], shin_L: [-20, 0, 0], hip: [0.03, -0.06, -0.06], ikL: [0.12, 1.25, 0.38], ikR: [-0.08, 1.2, 0.34] }),
    k(1.0, { hips: [-6, 0, 0], chest: [-14, 0, 0], neck: [-8, 0, 0], head: [-18, 0, 0], thigh_R: [10, 0, 4], shin_R: [-20, 0, 0], thigh_L: [-18, 0, 4], shin_L: [-26, 0, 0], hip: [0, -0.05, -0.05], ikL: [0.1, 1.22, 0.36], ikR: [-0.1, 1.22, 0.36] }),
  ] },
  // Fat Vic's STRYPGREPP: two hands locked round the throat at shoulder height, leaning back to hoist the man up
  choking: { state: 'grabbing', dur: 0.5, loop: true, setup: f => { f.grabCfg = { choke: true }; }, keys: [
    k(0.0, CHOKER),
    k(0.5, { ...CHOKER, chest: [-8, 6, 0], head: [8, -6, 0], hip: [0, -0.13, -0.01], ikL: [0.1, 1.6, 0.5], ikR: [-0.08, 1.58, 0.53] }),
    k(1.0, CHOKER),
  ] },
  // ...and the man on the end of it: hauled off his feet, clawing at the hands, legs kicking
  choked: { state: 'grabbed', dur: 0.34, loop: true, setup: f => { f.grabbedBy = { grabCfg: { choke: true } }; }, keys: [
    k(0.0, CHOKED),
    k(0.5, { ...CHOKED, chest: [-14, 8, 0], head: [-24, -8, 6], thigh_R: [-6, 0, 6], shin_R: [-30, 0, 0], thigh_L: [36, 0, 6], shin_L: [-70, 0, 0], ikL: [0.09, 1.47, 0.27], ikR: [-0.05, 1.43, 0.25] }),
    k(1.0, CHOKED),
  ] },
  thrown: { state: 'thrown', dur: 0.4, loop: true, keys: [   // flailing through the air (horizontal, arms and legs everywhere)
    k(0.0, { hips: [-70, 0, 10], chest: [-10, 0, 0], head: [-26, 0, 0], upperArm_L: [150, 0, 70], forearm_L: [30, 0, 0], upperArm_R: [100, 0, 80], forearm_R: [60, 0, 0], thigh_R: [60, 0, 20], shin_R: [-50, 0, 0], thigh_L: [20, 0, 10], shin_L: [-80, 0, 0], hip: [0, -0.3, 0] }),
    k(0.5, { hips: [-80, 0, -10], chest: [-6, 0, 0], head: [-18, 0, 0], upperArm_L: [100, 0, 80], forearm_L: [60, 0, 0], upperArm_R: [150, 0, 70], forearm_R: [30, 0, 0], thigh_R: [24, 0, 10], shin_R: [-80, 0, 0], thigh_L: [64, 0, 20], shin_L: [-46, 0, 0], hip: [0, -0.32, 0] }),
    k(1.0, { hips: [-70, 0, 10], chest: [-10, 0, 0], head: [-26, 0, 0], upperArm_L: [150, 0, 70], forearm_L: [30, 0, 0], upperArm_R: [100, 0, 80], forearm_R: [60, 0, 0], thigh_R: [60, 0, 20], shin_R: [-50, 0, 0], thigh_L: [20, 0, 10], shin_L: [-80, 0, 0], hip: [0, -0.3, 0] }),
  ] },
  // ---------------------------------------------------------------- dazed, taunting, celebrating
  dizzy: { state: 'dizzy', dur: 1.1, loop: true, keys: [
    k(0.0, { hips: [2, 8, 4], spine: [0, 0, 6], chest: [-4, 0, 10], neck: [0, 0, 10], head: [-6, 10, 16], upperArm_L: [8, 0, 16], forearm_L: [22, 0, 0], upperArm_R: [6, 0, 18], forearm_R: [16, 0, 0], thigh_R: [10, 0, 8], shin_R: [-26, 0, 0], thigh_L: [-6, 0, 8], shin_L: [-22, 0, 0], hip: [0.06, -0.1, 0] }),
    k(0.5, { hips: [2, -8, -4], spine: [0, 0, -6], chest: [-2, 0, -10], neck: [0, 0, -10], head: [-4, -10, -16], upperArm_L: [6, 0, 18], forearm_L: [16, 0, 0], upperArm_R: [10, 0, 14], forearm_R: [24, 0, 0], thigh_R: [6, 0, 8], shin_R: [-22, 0, 0], thigh_L: [-10, 0, 8], shin_L: [-28, 0, 0], hip: [-0.06, -0.12, 0] }),
    k(1.0, { hips: [2, 8, 4], spine: [0, 0, 6], chest: [-4, 0, 10], neck: [0, 0, 10], head: [-6, 10, 16], upperArm_L: [8, 0, 16], forearm_L: [22, 0, 0], upperArm_R: [6, 0, 18], forearm_R: [16, 0, 0], thigh_R: [10, 0, 8], shin_R: [-26, 0, 0], thigh_L: [-6, 0, 8], shin_L: [-22, 0, 0], hip: [0.06, -0.1, 0] }),
  ] },
  taunt: { state: 'taunt', dur: 0.9, loop: true, keys: [   // "come on then": chin up, chest out, beckoning with the right hand
    k(0.0, { hips: [-2, 10, 0], spine: [-6, 0, 0], chest: [-10, 8, 0], neck: [-6, 0, 0], head: [-10, -6, 0], upperArm_L: [18, 0, 30], forearm_L: [40, 0, 0], thigh_R: [16, 0, 8], shin_R: [-14, 0, 0], thigh_L: [-12, 0, 8], shin_L: [-10, 0, 0], hip: [0, -0.02, -0.02], ikR: [-0.2, 1.26, 0.6] }),
    k(0.45, { hips: [-2, 10, 0], spine: [-6, 0, 0], chest: [-12, 10, 0], neck: [-6, 0, 0], head: [-12, -6, 0], upperArm_L: [18, 0, 30], forearm_L: [40, 0, 0], thigh_R: [16, 0, 8], shin_R: [-14, 0, 0], thigh_L: [-12, 0, 8], shin_L: [-10, 0, 0], hip: [0, -0.02, -0.04], ikR: [-0.18, 1.44, 0.34] }),
    k(1.0, { hips: [-2, 10, 0], spine: [-6, 0, 0], chest: [-10, 8, 0], neck: [-6, 0, 0], head: [-10, -6, 0], upperArm_L: [18, 0, 30], forearm_L: [40, 0, 0], thigh_R: [16, 0, 8], shin_R: [-14, 0, 0], thigh_L: [-12, 0, 8], shin_L: [-10, 0, 0], hip: [0, -0.02, -0.02], ikR: [-0.2, 1.26, 0.6] }),
  ] },
  victory: { state: 'victory', dur: 0.56, loop: true, keys: [   // both fists in the air, pumping
    k(0.0, { hips: [-4, 0, 0], spine: [-6, 0, 0], chest: [-10, 0, 0], neck: [-8, 0, 0], head: [-16, 0, 0], upperArm_L: [168, 0, 26], forearm_L: [24, 0, 0], upperArm_R: [160, 0, 30], forearm_R: [40, 0, 0], thigh_R: [8, 0, 8], shin_R: [-8, 0, 0], thigh_L: [-6, 0, 8], shin_L: [-8, 0, 0], hip: [0, 0, 0] }),
    k(0.5, { hips: [-4, 0, 0], spine: [-8, 0, 0], chest: [-12, 0, 0], neck: [-10, 0, 0], head: [-20, 0, 0], upperArm_L: [156, 0, 30], forearm_L: [44, 0, 0], upperArm_R: [170, 0, 24], forearm_R: [20, 0, 0], thigh_R: [14, 0, 8], shin_R: [-24, 0, 0], thigh_L: [-2, 0, 8], shin_L: [-20, 0, 0], hip: [0, -0.06, 0] }),
    k(1.0, { hips: [-4, 0, 0], spine: [-6, 0, 0], chest: [-10, 0, 0], neck: [-8, 0, 0], head: [-16, 0, 0], upperArm_L: [168, 0, 26], forearm_L: [24, 0, 0], upperArm_R: [160, 0, 30], forearm_R: [40, 0, 0], thigh_R: [8, 0, 8], shin_R: [-8, 0, 0], thigh_L: [-6, 0, 8], shin_L: [-8, 0, 0], hip: [0, 0, 0] }),
  ] },
};

// Which state clip a fighter should play right now (null = fall back to the pose library).
export function stateClipFor(f) {
  let name = null;
  if (f._forceClip && STATE_CLIPS[f._forceClip]) name = f._forceClip;   // tools/anim3d.html
  else switch (f.state) {
    case 'hurt': {
      const h = f.hitDir;
      if (h && !h.front) name = 'hurtBack';
      else if (f.hurtAnim === 'hurtGut' || (h && !h.high)) name = 'hurtGut';
      else name = (f.id + Math.floor((h && h.t || 0) * 7)) % 3 === 0 ? 'hurtHigh' : 'hurtFront';
      break;
    }
    case 'blockstun': name = 'blockHit'; break;
    case 'block': name = 'block'; break;
    case 'knockdown': name = 'knockdown'; break;
    case 'down': name = f.hp <= 0 || f.dying ? 'ko' : 'down'; break;
    case 'dead': name = 'ko'; break;
    case 'getup': name = 'getup'; break;
    case 'dodge': name = 'dodge'; break;
    case 'grabbing': name = f.grabCfg && f.grabCfg.choke ? 'choking' : 'grabbing'; break;
    case 'grabbed': name = f.grabbedBy && f.grabbedBy.grabCfg && f.grabbedBy.grabCfg.choke ? 'choked' : 'grabbed'; break;
    case 'thrown': name = 'thrown'; break;
    case 'dizzy': name = 'dizzy'; break;
    case 'taunt': name = 'taunt'; break;
    case 'victory': name = 'victory'; break;
    default: return null;
  }
  const S = STATE_CLIPS[name];
  if (!S) return null;
  const t = f.animT || 0;
  const u = S.loop ? ((t % S.dur) + S.dur) % S.dur / S.dur : Math.min(1, t / S.dur);
  return { name, clip: S.keys, u };
}
