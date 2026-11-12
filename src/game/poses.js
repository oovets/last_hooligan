// Pose & animation library for the procedural pixel "doll" characters.
//
// A POSE is an object of joint values (radians unless noted). Missing keys fall back to BASE.
//   lean  torso angle (0 upright, + leans forward)        head  head tilt relative to torso
//   dx,dy body offset in px (+dx forward, +dy down)        rot   whole-body rotation around the hip (+ = pitch forward/clockwise when facing right)
//   thN,thF thigh angle (0 straight down, + swings forward)  knN,knF knee bend (+ bends the shin backwards)
//   uaN,uaF upper-arm angle (0 down, + forward/up)          faN,faF elbow bend (+ folds the forearm forward/up)
//   hN,hF hand open (0 fist .. 1 open hand)                flip  0/1 visually mirror (used mid spin-kick)
//   N = near (camera side) limb, F = far limb (the lead arm in a boxing guard)
//
// Looping/one-shot animations: ANIMS[name] = { loop, frames: [[duration, pose], ...] }.
// Frames are interpolated in QUANT discrete in-between steps (crisp 16-bit sprite feel, ~20-25 fps of drawing).
// Attacks use ATTACK_POSES[name] = { windup, hit, follow?, end? } driven by the attack's own timing
// (startup -> windup, active -> hit (impact frame), recovery -> follow-through -> end/guard). See Fighter.getPose().
//
// Animation names (fighter.js uses the first group; the rest are free for controllers/levels/cutscenes):
//   idle guard walk fightWalk run jump fall land block blockHit dodge hurt hurtGut knockdown down getup
//   grabbed grabbing thrown dizzy taunt victory cheer pickup dead drink
//   + jumpStart crouch hurtHead hurtBack stagger launch bounce ko lieFront idleBored idleFidget
//     taunt2 (arms wide "COME ON THEN") taunt3 (fist pump chant) taunt4 (point & laugh) taunt5 (chest slap)
//     clap chant scarfWave sit throwOver grab punchL punchR kickFront kickLow victory2 shrug talk
// Attack pose names: jab cross hook uppercut kick lowKick spinKick roundhouse flyingKick jumpKick divePunch shoulder
//   knee headbutt stomp swing thrust haymaker slap throw push bodySlam throwItem
//   + punchL punchR elbow backfist sweep dropkick lariat clothesline groundPunch jumpPunch chargePunch slam
//     bigSwing bellyBump grabThrow overhead pokeJab

export const BASE = {
  lean: 0, head: 0, dx: 0, dy: 0, rot: 0, flip: 0,
  thN: 0, knN: 0, thF: 0, knF: 0,
  uaN: 0.1, faN: 0.25, uaF: -0.1, faF: 0.3,
  hN: 0, hF: 0,
};

// discrete in-between steps per key frame (set to 0 for fully smooth tweening)
export let QUANT = 3;
export function setQuant(n) { QUANT = n | 0; }

export const STAND = { lean: 0.03, thN: 0.1, knN: 0.06, thF: -0.1, knF: 0.08, uaN: 0.14, faN: 0.32, uaF: -0.12, faF: 0.38 };
export const GUARD = { lean: 0.1, dy: 1, thN: 0.32, knN: 0.38, thF: -0.26, knF: 0.28, uaN: 0.55, faN: 1.95, uaF: 0.8, faF: 1.75, head: 0.06 };
const G = GUARD;
const BLOCKP = { lean: -0.04, dy: 2, thN: 0.36, knN: 0.52, thF: -0.3, knF: 0.38, uaN: 1.0, faN: 2.3, uaF: 1.1, faF: 2.15, head: 0.25 };
const LIE = { lean: 0, head: -0.1, thN: 0.25, knN: 0.3, thF: 0.1, knF: 0.5, uaN: 2.9, faN: 0.2, uaF: 2.6, faF: 0.3, rot: -1.57, dy: 17 };

export const ANIMS = {
  // ---------------------------------------------------------------- stances & locomotion
  idle: { loop: true, frames: [[0.55, { ...STAND }], [0.45, { ...STAND, dy: 1, uaN: 0.18, uaF: -0.08, head: 0.04 }]] },
  idleBored: { loop: true, frames: [[0.8, { ...STAND, head: -0.1 }], [0.6, { ...STAND, head: 0.25, dy: 1 }], [0.8, { ...STAND, head: 0.1, lean: -0.02 }]] },
  idleFidget: { loop: true, frames: [[0.3, { ...STAND, uaN: 0.3, faN: 1.2 }], [0.3, { ...STAND, uaN: 0.25, faN: 1.6, dy: 1 }], [0.6, { ...STAND }]] },
  guard: { loop: true, frames: [[0.2, { ...G }], [0.2, { ...G, dy: 2, lean: 0.13, knN: 0.48, knF: 0.36, uaF: 0.86 }]] },
  crouch: { loop: true, frames: [[0.5, { ...G, dy: 6, lean: 0.3, thN: 0.8, knN: 1.5, thF: 0.1, knF: 1.2 }]] },
  walk: {
    loop: true, frames: [
      [0.13, { lean: 0.06, thN: 0.5, knN: 0.08, thF: -0.38, knF: 0.3, uaN: -0.4, faN: 0.35, uaF: 0.42, faF: 0.5, head: 0.02 }],
      [0.13, { lean: 0.06, dy: -1, thN: 0.0, knN: 0.06, thF: 0.12, knF: 0.75, uaN: 0, faN: 0.3, uaF: 0, faF: 0.35 }],
      [0.13, { lean: 0.06, thN: -0.38, knN: 0.3, thF: 0.5, knF: 0.08, uaN: 0.42, faN: 0.5, uaF: -0.4, faF: 0.35, head: 0.02 }],
      [0.13, { lean: 0.06, dy: -1, thN: 0.12, knN: 0.75, thF: 0.0, knF: 0.06, uaN: 0, faN: 0.35, uaF: 0, faF: 0.3 }],
    ],
  },
  fightWalk: {
    loop: true, frames: [
      [0.11, { ...G, thN: 0.52, knN: 0.25, thF: -0.32, knF: 0.5, lean: 0.12 }],
      [0.11, { ...G, dy: 0, thN: 0.2, knN: 0.55, thF: 0.0, knF: 0.25, uaF: 0.86 }],
      [0.11, { ...G, thN: -0.15, knN: 0.5, thF: 0.42, knF: 0.25, lean: 0.12 }],
      [0.11, { ...G, dy: 0, thN: 0.15, knN: 0.25, thF: 0.1, knF: 0.55, uaN: 0.6 }],
    ],
  },
  run: {
    loop: true, frames: [
      [0.085, { lean: 0.36, dy: -2, head: -0.12, thN: 1.0, knN: 0.45, thF: -0.65, knF: 1.4, uaN: -0.85, faN: 1.6, uaF: 1.1, faF: 1.5 }],
      [0.085, { lean: 0.34, dy: 1, head: -0.1, thN: 0.2, knN: 1.6, thF: 0.15, knF: 0.25, uaN: 0.1, faN: 1.6, uaF: 0.15, faF: 1.6 }],
      [0.085, { lean: 0.36, dy: -2, head: -0.12, thN: -0.65, knN: 1.4, thF: 1.0, knF: 0.45, uaN: 1.1, faN: 1.5, uaF: -0.85, faF: 1.6 }],
      [0.085, { lean: 0.34, dy: 1, head: -0.1, thN: 0.15, knN: 0.25, thF: 0.2, knF: 1.6, uaN: 0.15, faN: 1.6, uaF: 0.1, faF: 1.6 }],
    ],
  },
  jumpStart: { loop: false, frames: [[0.06, { ...G, dy: 6, lean: 0.3, thN: 0.7, knN: 1.4, thF: 0.1, knF: 1.2, uaN: 0.2, faN: 1.2, uaF: 0.3, faF: 1.2 }]] },
  jump: { loop: false, frames: [[0.1, { lean: 0.12, dy: -1, thN: 1.0, knN: 1.8, thF: 0.55, knF: 1.7, uaN: 1.7, faN: 0.9, uaF: 1.3, faF: 1.0 }], [1, { lean: 0.1, thN: 0.8, knN: 1.5, thF: 0.35, knF: 1.3, uaN: 1.3, faN: 1.0, uaF: 1.0, faF: 1.1 }]] },
  fall: { loop: false, frames: [[0.16, { lean: 0.02, thN: 0.45, knN: 0.6, thF: -0.05, knF: 0.5, uaN: 1.6, faN: 0.5, uaF: 1.25, faF: 0.5 }], [1, { lean: 0.0, thN: 0.25, knN: 0.25, thF: -0.1, knF: 0.3, uaN: 1.9, faN: 0.35, uaF: 1.5, faF: 0.4 }]] },
  land: { loop: false, frames: [[0.07, { lean: 0.3, dy: 5, thN: 0.7, knN: 1.35, thF: 0.15, knF: 1.15, uaN: 0.7, faN: 0.6, uaF: 0.5, faF: 0.7 }], [0.08, { ...G, dy: 3 }]] },

  // ---------------------------------------------------------------- defence
  block: { loop: true, frames: [[0.4, { ...BLOCKP }], [0.4, { ...BLOCKP, head: 0.3, dy: 3 }]] },
  blockHit: { loop: false, frames: [[0.05, { ...BLOCKP, lean: -0.3, dx: -3, dy: 2, thF: -0.45, head: 0.1 }], [0.08, { ...BLOCKP, lean: -0.15, dx: -1 }], [0.15, { ...BLOCKP }]] },
  dodge: {
    loop: false, frames: [
      [0.05, { lean: 0.65, dy: 6, thN: 1.2, knN: 2.2, thF: 1.0, knF: 2.2, uaN: 1.6, faN: 1.5, uaF: 1.6, faF: 1.5, rot: 0, head: 0.4 }],
      [0.09, { lean: 0.6, dy: 10, thN: 1.4, knN: 2.5, thF: 1.2, knF: 2.5, uaN: 1.6, faN: 1.9, uaF: 1.6, faF: 1.9, rot: 2.1, head: 0.5 }],
      [0.09, { lean: 0.6, dy: 10, thN: 1.4, knN: 2.5, thF: 1.2, knF: 2.5, uaN: 1.6, faN: 1.9, uaF: 1.6, faF: 1.9, rot: 4.2, head: 0.5 }],
      [0.1, { lean: 0.45, dy: 6, thN: 1.0, knN: 2.0, thF: 0.8, knF: 2.0, uaN: 1.2, faN: 1.5, uaF: 1.2, faF: 1.5, rot: 6.283 }],
      [0.08, { ...G, dy: 3 }],
    ],
  },

  // ---------------------------------------------------------------- getting hit
  hurt: {
    loop: false, frames: [
      [0.05, { lean: -0.5, head: -0.55, dx: -3, dy: 1, thN: 0.25, knN: 0.35, thF: -0.35, knF: 0.2, uaN: -0.6, faN: 0.7, uaF: 0.9, faF: 1.0, hN: 1, hF: 1 }],
      [0.1, { lean: -0.35, head: -0.35, dx: -2, dy: 1, thN: 0.25, knN: 0.35, thF: -0.3, knF: 0.25, uaN: -0.2, faN: 0.9, uaF: 0.6, faF: 1.2 }],
      [0.18, { lean: -0.1, head: -0.1, thN: 0.25, knN: 0.3, thF: -0.25, knF: 0.25, uaN: 0.3, faN: 1.4, uaF: 0.5, faF: 1.5 }],
    ],
  },
  hurtHead: null, // alias set below
  hurtGut: {
    loop: false, frames: [
      [0.05, { lean: 0.8, head: 0.35, dy: 4, dx: -1, thN: 0.45, knN: 0.7, thF: -0.1, knF: 0.55, uaN: 0.5, faN: 1.8, uaF: 0.65, faF: 1.7 }],
      [0.12, { lean: 0.65, head: 0.3, dy: 3, thN: 0.4, knN: 0.6, thF: -0.1, knF: 0.5, uaN: 0.5, faN: 1.7, uaF: 0.6, faF: 1.7 }],
      [0.16, { lean: 0.3, head: 0.15, dy: 2, thN: 0.3, knN: 0.45, thF: -0.15, knF: 0.35, uaN: 0.5, faN: 1.7, uaF: 0.6, faF: 1.7 }],
    ],
  },
  hurtBack: { loop: false, frames: [[0.05, { lean: 0.4, head: -0.5, dx: 2, thN: 0.1, knN: 0.3, thF: -0.4, knF: 0.4, uaN: -0.5, faN: 0.4, uaF: -0.4, faF: 0.4, hN: 1, hF: 1 }], [0.25, { lean: 0.15, head: -0.1, thN: 0.2, knN: 0.3, thF: -0.2, knF: 0.3, uaN: 0.3, faN: 1.2, uaF: 0.4, faF: 1.2 }]] },
  stagger: {
    loop: false, frames: [
      [0.08, { lean: -0.3, head: -0.3, dx: -2, thN: 0.4, knN: 0.2, thF: -0.4, knF: 0.5, uaN: -0.5, faN: 0.4, uaF: 1.1, faF: 0.6, hN: 1, hF: 1 }],
      [0.1, { lean: -0.15, head: 0.1, dx: -3, thN: -0.2, knN: 0.6, thF: 0.3, knF: 0.2, uaN: 0.6, faN: 0.6, uaF: -0.3, faF: 0.6, hN: 1, hF: 1 }],
      [0.15, { ...G, dy: 2 }],
    ],
  },
  dizzy: {
    loop: true, frames: [
      [0.28, { lean: -0.12, head: -0.35, dx: -1, thN: 0.15, knN: 0.35, thF: -0.12, knF: 0.45, uaN: 0.25, faN: 0.2, uaF: 0.05, faF: 0.3, hN: 1, hF: 1 }],
      [0.28, { lean: 0.02, head: 0.05, dy: 1, thN: 0.1, knN: 0.5, thF: -0.1, knF: 0.35, uaN: 0.1, faN: 0.3, uaF: 0.15, faF: 0.2, hN: 1, hF: 1 }],
      [0.28, { lean: 0.14, head: 0.3, dx: 1, thN: 0.08, knN: 0.4, thF: -0.16, knF: 0.3, uaN: -0.05, faN: 0.3, uaF: 0.28, faF: 0.2, hN: 1, hF: 1 }],
      [0.28, { lean: 0.02, head: -0.05, dy: 1, thN: 0.12, knN: 0.5, thF: -0.12, knF: 0.4, uaN: 0.12, faN: 0.25, uaF: 0.12, faF: 0.25, hN: 1, hF: 1 }],
    ],
  },
  knockdown: {
    loop: false, frames: [
      [0.06, { lean: -0.55, head: -0.55, thN: 0.6, knN: 0.2, thF: 0.3, knF: 0.25, uaN: 2.3, faN: 0.3, uaF: 1.9, faF: 0.5, rot: -0.35, dy: -1, hN: 1, hF: 1 }],
      [0.18, { lean: -0.2, head: -0.3, thN: 0.9, knN: 0.35, thF: 0.65, knF: 0.5, uaN: 2.7, faN: 0.3, uaF: 2.3, faF: 0.4, rot: -1.15, dy: 8, hN: 1, hF: 1 }],
      [0.07, { lean: 0, head: 0.15, thN: 0.6, knN: 0.3, thF: 0.4, knF: 0.4, uaN: 3.0, faN: 0.2, uaF: 2.7, faF: 0.2, rot: -1.62, dy: 17 }],
      [0.07, { lean: 0, head: -0.2, thN: 0.5, knN: 0.25, thF: 0.3, knF: 0.4, uaN: 2.8, faN: 0.3, uaF: 2.5, faF: 0.3, rot: -1.45, dy: 14 }],
      [0.1, { ...LIE }],
    ],
  },
  launch: { loop: true, frames: [[0.12, { lean: -0.3, head: -0.4, thN: 0.9, knN: 0.6, thF: 0.5, knF: 0.8, uaN: 2.6, faN: 0.4, uaF: 2.2, faF: 0.5, rot: -0.9, dy: 4, hN: 1, hF: 1 }], [0.12, { lean: -0.3, head: -0.3, thN: 0.7, knN: 0.8, thF: 0.6, knF: 0.6, uaN: 2.4, faN: 0.6, uaF: 2.5, faF: 0.3, rot: -1.0, dy: 4, hN: 1, hF: 1 }]] },
  bounce: { loop: false, frames: [[0.06, { ...LIE, rot: -1.35, dy: 12, thN: 0.8, knN: 0.6 }], [0.1, { ...LIE }]] },
  down: { loop: true, frames: [[0.6, { ...LIE }], [0.6, { ...LIE, head: 0, knN: 0.36, faN: 0.28, dy: 16.5 }]] },
  lieFront: { loop: true, frames: [[1, { lean: 0, head: 0.3, thN: -0.1, knN: 0.6, thF: 0.05, knF: 0.3, uaN: 2.5, faN: 0.6, uaF: 2.9, faF: 0.2, rot: 1.57, dy: 17 }]] },
  ko: { loop: true, frames: [[1, { ...LIE, head: -0.25, uaN: 3.0, faN: 0.05, uaF: 2.4, faF: 0.1, hN: 1, hF: 1 }]] },
  dead: { loop: true, frames: [[1, { lean: 0, head: -0.2, thN: 0.2, knN: 0.1, thF: 0.05, knF: 0.3, uaN: 2.9, faN: 0.1, uaF: 2.5, faF: 0.2, rot: -1.57, dy: 17, hN: 1, hF: 1 }]] },
  getup: {
    loop: false, frames: [
      [0.1, { lean: 0, head: 0.2, thN: 1.3, knN: 2.3, thF: 0.9, knF: 2.0, uaN: 0.5, faN: 0.3, uaF: 0.6, faF: 0.3, rot: -1.25, dy: 15, hN: 1, hF: 1 }],
      [0.12, { lean: 0.6, head: 0.3, thN: 1.35, knN: 2.45, thF: 0.4, knF: 1.6, uaN: 0.9, faN: 0.3, uaF: 0.8, faF: 0.4, rot: -0.45, dy: 9, hN: 1, hF: 1 }],
      [0.12, { lean: 0.4, dy: 5, thN: 0.75, knN: 1.3, thF: 0.1, knF: 0.9, uaN: 0.6, faN: 1.6, uaF: 0.7, faF: 1.6, rot: 0 }],
      [0.12, { ...G, dy: 2 }],
    ],
  },

  // ---------------------------------------------------------------- grappling
  grab: { loop: false, frames: [[0.06, { ...G, lean: 0.25, dx: 2, uaN: 1.3, faN: 0.3, uaF: 1.4, faF: 0.2, hN: 1, hF: 1 }], [0.1, { lean: 0.2, dx: 2, dy: 1, thN: 0.4, knN: 0.35, thF: -0.35, knF: 0.3, uaN: 1.25, faN: 0.5, uaF: 1.35, faF: 0.4, hN: 1, hF: 1 }]] },
  grabbing: { loop: true, frames: [[0.3, { lean: 0.18, dy: 1, thN: 0.38, knN: 0.32, thF: -0.32, knF: 0.32, uaN: 1.25, faN: 0.55, uaF: 1.35, faF: 0.45, hN: 1, hF: 1 }], [0.3, { lean: 0.22, dy: 2, thN: 0.38, knN: 0.4, thF: -0.32, knF: 0.36, uaN: 1.3, faN: 0.5, uaF: 1.4, faF: 0.4, hN: 1, hF: 1 }]] },
  grabbed: { loop: true, frames: [[0.15, { lean: -0.32, head: -0.3, dy: -1, thN: 0.2, knN: 0.45, thF: 0.1, knF: 0.55, uaN: 0.85, faN: 1.3, uaF: 1.05, faF: 1.2, hN: 1, hF: 1 }], [0.15, { lean: -0.38, head: -0.2, dy: -2, thN: 0.32, knN: 0.3, thF: -0.05, knF: 0.65, uaN: 0.95, faN: 1.15, uaF: 1.15, faF: 1.05, hN: 1, hF: 1 }]] },
  thrown: { loop: true, frames: [[0.1, { lean: 0, thN: 0.8, knN: 1.0, thF: 0.4, knF: 1.4, uaN: 2.6, faN: 0.5, uaF: 2.2, faF: 0.8, rot: -1.2, dy: 6, hN: 1, hF: 1 }], [0.1, { lean: 0, thN: 0.6, knN: 1.4, thF: 0.6, knF: 1.0, uaN: 2.2, faN: 0.8, uaF: 2.6, faF: 0.5, rot: -2.6, dy: 6, hN: 1, hF: 1 }], [0.1, { lean: 0, thN: 0.8, knN: 1.0, thF: 0.4, knF: 1.4, uaN: 2.6, faN: 0.5, uaF: 2.2, faF: 0.8, rot: -4.0, dy: 6, hN: 1, hF: 1 }], [0.1, { lean: 0, thN: 0.6, knN: 1.4, thF: 0.6, knF: 1.0, uaN: 2.2, faN: 0.8, uaF: 2.6, faF: 0.5, rot: -5.3, dy: 6, hN: 1, hF: 1 }]] },
  throwOver: {
    loop: false, frames: [
      [0.08, { lean: -0.35, dy: 1, uaN: 2.5, faN: 0.5, uaF: 2.4, faF: 0.5, thN: 0.35, knN: 0.35, thF: -0.35, hN: 1, hF: 1 }],
      [0.08, { lean: 0.5, dx: 2, dy: 2, uaN: 1.2, faN: 0.1, uaF: 1.2, faF: 0.1, thN: 0.55, knN: 0.45, thF: -0.45, hN: 1, hF: 1 }],
      [0.2, { ...G }],
    ],
  },

  // ---------------------------------------------------------------- one-shot actions
  punchL: { loop: false, frames: [[0.04, { ...G, uaF: 0.85, faF: 2.0 }], [0.08, { ...G, uaF: 1.6, faF: 0.0, lean: 0.22, dx: 3 }], [0.12, { ...G }]] },
  punchR: { loop: false, frames: [[0.05, { ...G, uaN: 0.4, faN: 2.1, lean: -0.04 }], [0.08, { ...G, uaN: 1.62, faN: 0.0, lean: 0.4, dx: 4, thF: -0.55, knF: 0.15 }], [0.14, { ...G }]] },
  kickFront: { loop: false, frames: [[0.08, { ...G, thN: 1.3, knN: 2.0, lean: -0.15 }], [0.1, { ...G, thN: 1.55, knN: 0, lean: -0.35, thF: -0.05, knF: 0.15 }], [0.15, { ...G }]] },
  kickLow: { loop: false, frames: [[0.06, { ...G, thN: 0.7, knN: 1.3 }], [0.1, { ...G, thN: 0.95, knN: 0, lean: -0.2 }], [0.12, { ...G }]] },
  pickup: { loop: false, frames: [[0.08, { lean: 0.75, dy: 6, head: 0.2, thN: 0.75, knN: 1.45, thF: 0.1, knF: 1.25, uaN: 1.0, faN: 0.2, uaF: 0.6, faF: 0.4, hN: 1 }], [0.1, { lean: 0.8, dy: 7, head: 0.25, thN: 0.8, knN: 1.5, thF: 0.1, knF: 1.3, uaN: 1.05, faN: 0.1, uaF: 0.6, faF: 0.4 }], [0.07, { ...STAND, dy: 1 }]] },
  drink: { loop: false, frames: [[0.12, { ...STAND, uaN: 1.4, faN: 2.2, head: -0.1 }], [0.28, { ...STAND, uaN: 1.85, faN: 2.6, head: -0.5, lean: -0.12 }], [0.15, { ...STAND, uaN: 0.5, faN: 0.6, head: 0.05 }]] },
  sit: { loop: true, frames: [[1, { lean: -0.05, dy: 9, thN: 1.55, knN: 1.5, thF: 1.45, knF: 1.6, uaN: 0.4, faN: 1.0, uaF: 0.3, faF: 1.0 }]] },
  talk: { loop: true, frames: [[0.25, { ...STAND, uaN: 0.6, faN: 1.2, hN: 1 }], [0.25, { ...STAND, uaN: 0.8, faN: 0.8, hN: 1, head: 0.08 }], [0.3, { ...STAND, uaN: 0.3, faN: 0.8 }]] },
  shrug: { loop: false, frames: [[0.12, { ...STAND, uaN: 0.4, faN: 1.6, uaF: 0.4, faF: 1.6, hN: 1, hF: 1, dy: -1, head: -0.2 }], [0.4, { ...STAND, uaN: 0.45, faN: 1.8, uaF: 0.45, faF: 1.8, hN: 1, hF: 1, dy: -1, head: -0.25 }], [0.15, { ...STAND }]] },

  // ---------------------------------------------------------------- attitude
  taunt: { // "come on then" beckon
    loop: true, frames: [
      [0.16, { ...STAND, lean: -0.12, head: -0.15, uaN: 1.5, faN: 0.6, hN: 1, uaF: 0.3, faF: 1.6 }],
      [0.16, { ...STAND, lean: -0.12, head: -0.12, uaN: 1.55, faN: 1.9, hN: 0, uaF: 0.3, faF: 1.6 }],
    ],
  },
  taunt2: { // arms wide, chest out
    loop: true, frames: [
      [0.22, { ...STAND, lean: -0.18, head: -0.2, dy: 0, uaN: 1.0, faN: 0.3, uaF: -0.9, faF: 0.4, hN: 1, hF: 1 }],
      [0.22, { ...STAND, lean: -0.14, head: -0.12, dy: 1, uaN: 1.15, faN: 0.6, uaF: -1.0, faF: 0.6, hN: 1, hF: 1, thN: 0.3, knN: 0.2 }],
    ],
  },
  taunt3: { // fist pump chant
    loop: true, frames: [
      [0.14, { ...STAND, lean: -0.05, head: -0.25, uaN: 2.7, faN: 0.3, uaF: 0.2, faF: 1.6 }],
      [0.14, { ...STAND, lean: 0.02, head: -0.15, dy: 1, uaN: 2.2, faN: 1.6, uaF: 0.2, faF: 1.6 }],
    ],
  },
  taunt4: { // point and laugh
    loop: true, frames: [
      [0.12, { ...STAND, lean: -0.2, head: -0.3, uaN: 1.5, faN: 0.05, uaF: 0.5, faF: 2.0, dy: 0 }],
      [0.12, { ...STAND, lean: -0.08, head: -0.1, uaN: 1.45, faN: 0.1, uaF: 0.6, faF: 2.1, dy: 2 }],
    ],
  },
  taunt5: { // slap the chest
    loop: true, frames: [
      [0.13, { ...STAND, lean: -0.1, head: -0.2, uaN: 0.2, faN: 2.6, uaF: 0.3, faF: 2.4, hN: 1, hF: 1 }],
      [0.13, { ...STAND, lean: -0.1, head: -0.1, uaN: 0.7, faN: 1.6, uaF: 0.75, faF: 1.5, hN: 1, hF: 1, dy: 1 }],
    ],
  },
  clap: { loop: true, frames: [[0.12, { ...STAND, uaN: 0.9, faN: 1.2, uaF: 0.9, faF: 0.4, hN: 1, hF: 1 }], [0.12, { ...STAND, uaN: 1.0, faN: 0.6, uaF: 1.0, faF: 0.6, hN: 1, hF: 1 }]] },
  chant: { loop: true, frames: [[0.25, { ...STAND, head: -0.25, lean: -0.08, uaN: 2.6, faN: 0.4, uaF: 2.5, faF: 0.5 }], [0.25, { ...STAND, head: -0.15, dy: 1, uaN: 2.2, faN: 1.2, uaF: 2.1, faF: 1.3 }]] },
  scarfWave: { loop: true, frames: [[0.2, { ...STAND, head: -0.3, uaN: 2.9, faN: 0.1, uaF: 2.7, faF: 0.2, hN: 1, hF: 1 }], [0.2, { ...STAND, head: -0.25, dy: -1, uaN: 2.6, faN: 0.5, uaF: 3.0, faF: 0.1, hN: 1, hF: 1 }]] },
  cheer: { loop: true, frames: [[0.2, { ...STAND, uaN: 2.8, faN: 0.3, uaF: 2.8, faF: 0.3, head: -0.2 }], [0.2, { ...STAND, dy: -3, uaN: 2.4, faN: 0.8, uaF: 2.4, faF: 0.8, thN: 0.3, knN: 0.5, thF: 0.1, knF: 0.5 }]] },
  victory: { loop: true, frames: [[0.25, { ...STAND, head: -0.2, uaN: 2.9, faN: 0.3, uaF: 2.7, faF: 0.4 }], [0.25, { ...STAND, head: -0.15, uaN: 2.6, faN: 0.7, uaF: 2.95, faF: 0.2, dy: -2, thN: 0.25, knN: 0.35 }]] },
  victory2: { loop: true, frames: [[0.3, { ...STAND, lean: -0.1, head: -0.15, uaN: 0.4, faN: 2.4, uaF: 2.9, faF: 0.1 }], [0.3, { ...STAND, lean: -0.1, head: -0.1, dy: 1, uaN: 0.4, faN: 2.4, uaF: 2.7, faF: 0.4 }]] },
};
ANIMS.hurtHead = ANIMS.hurt;

// ---------------------------------------------------------------------------------- attack poses
export const ATTACK_POSES = {
  jab: {
    windup: { ...G, uaF: 0.85, faF: 2.05, lean: 0.04, dx: -1 },
    hit: { ...G, uaF: 1.6, faF: 0.0, lean: 0.24, dx: 3, thN: 0.45, knN: 0.35, head: 0.12 },
    follow: { ...G, uaF: 1.5, faF: 0.3, lean: 0.2, dx: 2 },
  },
  cross: {
    windup: { ...G, uaN: 0.38, faN: 2.15, lean: -0.06, dx: -1, uaF: 0.9, faF: 1.6 },
    hit: { ...G, uaN: 1.62, faN: 0.0, lean: 0.42, dx: 4, thF: -0.58, knF: 0.12, thN: 0.5, knN: 0.42, uaF: 0.5, faF: 2.1, head: 0.14 },
    follow: { ...G, uaN: 1.5, faN: 0.25, lean: 0.4, dx: 4, thF: -0.5, knF: 0.15, thN: 0.48 },
  },
  hook: {
    windup: { ...G, uaF: 0.55, faF: 1.1, lean: -0.15, dx: -1, rot: -0.04 },
    hit: { ...G, uaF: 1.5, faF: 1.35, lean: 0.32, dx: 3, head: 0.12, rot: 0.05, thN: 0.45 },
    follow: { ...G, uaF: 1.3, faF: 1.9, lean: 0.36, dx: 3 },
  },
  uppercut: {
    windup: { ...G, uaN: 0.05, faN: 1.5, lean: 0.4, dy: 6, thN: 0.6, knN: 1.0, thF: -0.1, knF: 0.9, head: 0.2 },
    hit: { ...G, uaN: 2.65, faN: 0.45, lean: -0.18, dy: -4, thN: 0.28, knN: 0.08, thF: -0.32, knF: 0.12, head: -0.15 },
    follow: { ...G, uaN: 2.85, faN: 0.6, lean: -0.25, dy: -2, thN: 0.25, knN: 0.1, thF: -0.3, knF: 0.15, head: -0.2 },
  },
  kick: {
    windup: { ...G, thN: 1.3, knN: 2.05, lean: -0.12, dy: 0 },
    hit: { ...G, thN: 1.58, knN: 0.0, lean: -0.36, thF: -0.05, knF: 0.12, dx: 1, uaN: 0.35, faN: 1.6 },
    follow: { ...G, thN: 1.3, knN: 0.6, lean: -0.3, thF: -0.05, knF: 0.15 },
  },
  lowKick: {
    windup: { ...G, thN: 0.72, knN: 1.35, lean: 0.02 },
    hit: { ...G, thN: 0.98, knN: 0.0, lean: -0.18, thF: -0.15, knF: 0.18, dx: 1 },
    follow: { ...G, thN: 0.7, knN: 0.5, lean: -0.1 },
  },
  spinKick: {
    windup: { ...G, thN: 0.8, knN: 1.6, lean: -0.2, flip: 1, uaN: -0.3, uaF: -0.4, head: 0.2 },
    hit: { ...G, thN: 1.9, knN: 0.0, lean: -0.6, thF: 0.0, knF: 0.12, uaN: -0.45, faN: 0.4, uaF: 0.3, faF: 0.4, head: 0.2 },
    follow: { ...G, thN: 1.5, knN: 0.5, lean: -0.5, thF: 0.0, knF: 0.15, uaN: -0.3, faN: 0.5 },
  },
  roundhouse: {
    windup: { ...G, thN: 0.7, knN: 1.6, lean: -0.25, rot: -0.05, uaN: 0.2 },
    hit: { ...G, thN: 1.78, knN: 0.12, lean: -0.5, uaN: -0.4, faN: 0.5, thF: -0.05, knF: 0.12 },
    follow: { ...G, thN: 1.4, knN: 0.6, lean: -0.4, uaN: -0.2, faN: 0.6 },
  },
  flyingKick: {
    windup: { lean: -0.1, thN: 1.05, knN: 1.7, thF: 0.45, knF: 1.6, uaN: 1.4, faN: 0.6, uaF: 1.2, faF: 0.6 },
    hit: { lean: -0.3, thN: 1.5, knN: 0.0, thF: -0.25, knF: 1.7, uaN: -0.7, faN: 0.5, uaF: 1.3, faF: 0.5, head: 0.15 },
  },
  jumpKick: {
    windup: { lean: 0.0, thN: 0.95, knN: 1.7, thF: 0.55, knF: 1.7, uaN: 1.4, faN: 0.8, uaF: 1.2, faF: 0.8 },
    hit: { lean: -0.22, thN: 1.35, knN: 0.0, thF: 0.25, knF: 1.9, uaN: 0.6, faN: 1.2, uaF: 1.7, faF: 0.4, head: 0.1 },
  },
  divePunch: {
    windup: { lean: 0.2, thN: 0.6, knN: 1.4, thF: 0.3, knF: 1.5, uaN: 2.7, faN: 0.6, uaF: 1.0, faF: 1.2 },
    hit: { lean: 0.55, thN: 0.5, knN: 1.4, thF: 0.15, knF: 1.6, uaN: 1.0, faN: 0.0, uaF: 0.6, faF: 1.4, head: 0.2 },
  },
  shoulder: {
    windup: { lean: 0.45, dy: 3, thN: 0.6, knN: 0.8, thF: -0.4, knF: 0.7, uaN: 0.2, faN: 2.4, uaF: 0.2, faF: 2.4, head: 0.3 },
    hit: { lean: 0.8, dx: 5, dy: 3, thN: 0.75, knN: 0.5, thF: -0.75, knF: 0.35, uaN: 0.3, faN: 2.3, uaF: 0.3, faF: 2.3, head: 0.35 },
    follow: { lean: 0.65, dx: 4, dy: 3, thN: 0.6, knN: 0.6, thF: -0.6, knF: 0.4, uaN: 0.4, faN: 2.0, uaF: 0.4, faF: 2.0 },
  },
  knee: {
    windup: { lean: 0.05, thN: 0.4, knN: 1.0, uaN: 1.25, faN: 0.5, uaF: 1.25, faF: 0.5, hN: 1, hF: 1 },
    hit: { lean: 0.3, dy: -1, thN: 1.5, knN: 2.4, thF: -0.12, knF: 0.1, uaN: 0.9, faN: 0.4, uaF: 0.9, faF: 0.4, hN: 1, hF: 1, head: 0.2 },
    follow: { lean: 0.2, thN: 1.0, knN: 1.8, thF: -0.1, knF: 0.12, uaN: 1.1, faN: 0.4, uaF: 1.1, faF: 0.4, hN: 1, hF: 1 },
  },
  headbutt: {
    windup: { lean: -0.35, head: -0.3, dx: -1, uaN: 1.2, faN: 0.5, uaF: 1.3, faF: 0.4, hN: 1, hF: 1 },
    hit: { lean: 0.55, head: 0.4, dx: 3, uaN: 1.1, faN: 0.5, uaF: 1.2, faF: 0.4, hN: 1, hF: 1, thN: 0.35, knN: 0.3 },
  },
  stomp: {
    windup: { ...G, thN: 1.2, knN: 1.9, lean: -0.1, dy: -1 },
    hit: { ...G, thN: 0.3, knN: 0.0, lean: 0.3, dy: 2, dx: 2, head: 0.3 },
  },
  swing: {
    windup: { ...G, uaN: 3.05, faN: 0.7, lean: -0.28, dx: -1, head: -0.1 },
    hit: { ...G, uaN: 0.95, faN: 0.1, lean: 0.4, dx: 3, thN: 0.52, knN: 0.35, head: 0.1 },
    follow: { ...G, uaN: 0.35, faN: 0.2, lean: 0.46, dx: 3, thN: 0.5, knN: 0.35 },
  },
  thrust: {
    windup: { ...G, uaN: 0.6, faN: 1.7, lean: -0.12, dx: -1 },
    hit: { ...G, uaN: 1.52, faN: 0.0, lean: 0.32, dx: 4, thN: 0.52, thF: -0.45 },
    follow: { ...G, uaN: 1.45, faN: 0.2, lean: 0.28, dx: 3 },
  },
  haymaker: {
    windup: { ...G, uaN: -0.85, faN: 1.1, lean: -0.3, dx: -2, head: -0.1, uaF: 1.0, faF: 1.4 },
    hit: { ...G, uaN: 1.7, faN: 0.25, lean: 0.52, dx: 4, thN: 0.55, knN: 0.35, thF: -0.5, knF: 0.15, head: 0.15 },
    follow: { ...G, uaN: 1.15, faN: 0.7, lean: 0.56, dx: 4, thN: 0.55, knN: 0.4, thF: -0.45 },
  },
  slap: {
    windup: { ...G, uaF: 1.7, faF: 1.6, lean: -0.12, hF: 1 },
    hit: { ...G, uaF: 1.2, faF: 0.2, lean: 0.25, dx: 1, hF: 1 },
    follow: { ...G, uaF: 0.8, faF: 0.4, lean: 0.25, hF: 1 },
  },
  throw: {
    windup: { lean: -0.35, uaN: 2.5, faN: 0.5, uaF: 2.4, faF: 0.5, thN: 0.35, knN: 0.35, thF: -0.35, hN: 1, hF: 1 },
    hit: { lean: 0.5, dx: 2, dy: 2, uaN: 1.25, faN: 0.0, uaF: 1.25, faF: 0.0, thN: 0.55, knN: 0.4, thF: -0.45, hN: 1, hF: 1 },
  },
  push: {
    windup: { lean: -0.04, uaN: 1.0, faN: 1.7, uaF: 1.0, faF: 1.7, hN: 1, hF: 1, thN: 0.25, knN: 0.3 },
    hit: { lean: 0.38, dx: 3, uaN: 1.5, faN: 0.0, uaF: 1.5, faF: 0.0, thN: 0.52, thF: -0.45, hN: 1, hF: 1 },
  },
  bodySlam: {
    windup: { lean: -0.32, dy: -2, uaN: 2.85, faN: 0.3, uaF: 2.85, faF: 0.3, head: -0.2 },
    hit: { lean: 0.95, dx: 5, dy: 7, uaN: 1.6, faN: 0.3, uaF: 1.6, faF: 0.3, thN: 0.25, thF: -0.65, head: 0.3 },
  },
  throwItem: {
    windup: { ...G, uaN: 2.85, faN: 1.3, lean: -0.28, dx: -1, uaF: 1.2, faF: 0.4 },
    hit: { ...G, uaN: 1.45, faN: 0.1, lean: 0.32, dx: 2, thN: 0.5, knN: 0.3 },
    follow: { ...G, uaN: 0.9, faN: 0.3, lean: 0.35, dx: 2 },
  },
  // ---- extra moves (for new attacks / bosses)
  elbow: {
    windup: { ...G, uaN: 0.2, faN: 2.6, lean: -0.1 },
    hit: { ...G, uaN: 1.35, faN: 2.6, lean: 0.38, dx: 3, head: 0.1 },
  },
  backfist: {
    windup: { ...G, uaF: 1.0, faF: 2.5, lean: -0.05, rot: -0.05 },
    hit: { ...G, uaF: 1.7, faF: 0.25, lean: 0.15, dx: 2 },
    follow: { ...G, uaF: 1.4, faF: 0.6, lean: 0.12 },
  },
  sweep: {
    windup: { ...G, dy: 8, lean: 0.4, thN: 0.5, knN: 1.6, thF: 1.0, knF: 1.9 },
    hit: { ...G, dy: 10, lean: 0.35, thN: 1.55, knN: 0.0, thF: 1.2, knF: 2.2, uaN: 0.2, faN: 0.6, uaF: 1.0, faF: 0.8, hF: 1 },
    follow: { ...G, dy: 9, lean: 0.35, thN: 1.2, knN: 0.6, thF: 1.1, knF: 2.0 },
  },
  dropkick: {
    windup: { lean: -0.2, thN: 1.1, knN: 1.8, thF: 1.0, knF: 1.8, uaN: 1.5, faN: 0.6, uaF: 1.3, faF: 0.6 },
    hit: { lean: -0.7, rot: -0.3, thN: 1.55, knN: 0.0, thF: 1.45, knF: 0.05, uaN: 2.4, faN: 0.3, uaF: 2.2, faF: 0.3, head: 0.3 },
  },
  lariat: {
    windup: { ...G, uaN: -0.2, faN: 0.3, uaF: 0.8, faF: 1.5, lean: -0.1, dx: -1 },
    hit: { ...G, uaN: 1.6, faN: 0.05, lean: 0.35, dx: 5, thN: 0.6, knN: 0.3, thF: -0.6, knF: 0.2, hN: 1 },
    follow: { ...G, uaN: 1.4, faN: 0.1, lean: 0.4, dx: 5, hN: 1 },
  },
  groundPunch: {
    windup: { ...G, uaN: 2.4, faN: 1.0, lean: 0.2, dy: 2 },
    hit: { ...G, uaN: 0.6, faN: 0.0, lean: 0.85, dy: 9, thN: 0.9, knN: 1.6, thF: 0.1, knF: 1.4, head: 0.3 },
  },
  jumpPunch: {
    windup: { lean: 0.1, thN: 0.9, knN: 1.6, thF: 0.4, knF: 1.6, uaN: 0.5, faN: 2.1, uaF: 1.0, faF: 1.5 },
    hit: { lean: 0.3, thN: 0.7, knN: 1.4, thF: 0.2, knF: 1.6, uaN: 1.7, faN: 0.0, uaF: 0.8, faF: 1.8, head: 0.1 },
  },
  chargePunch: {
    windup: { ...G, uaN: 0.0, faN: 1.6, lean: -0.15, dy: 3, dx: -2, knN: 0.6, knF: 0.5 },
    hit: { ...G, uaN: 1.62, faN: 0.0, lean: 0.55, dx: 6, thN: 0.7, knN: 0.4, thF: -0.75, knF: 0.1, head: 0.15 },
    follow: { ...G, uaN: 1.5, faN: 0.2, lean: 0.5, dx: 5, thN: 0.65, thF: -0.7 },
  },
  slam: {
    windup: { lean: -0.3, dy: -2, uaN: 3.0, faN: 0.2, uaF: 2.9, faF: 0.3, head: -0.2 },
    hit: { lean: 0.6, dy: 4, dx: 2, uaN: 1.0, faN: 0.1, uaF: 0.95, faF: 0.15, thN: 0.6, knN: 0.8, thF: -0.3, knF: 0.6, head: 0.2 },
  },
  bigSwing: {
    windup: { ...G, uaN: 2.7, faN: 1.5, uaF: 2.6, faF: 1.5, lean: -0.35, dx: -2 },
    hit: { ...G, uaN: 1.2, faN: 0.05, uaF: 1.15, faF: 0.1, lean: 0.5, dx: 4, thN: 0.6, knN: 0.4, thF: -0.5 },
    follow: { ...G, uaN: 0.4, faN: 0.1, uaF: 0.35, faF: 0.1, lean: 0.55, dx: 4 },
  },
  bellyBump: {
    windup: { lean: -0.35, dx: -2, uaN: -0.5, faN: 0.6, uaF: -0.6, faF: 0.6, thN: 0.3, knN: 0.3 },
    hit: { lean: -0.45, dx: 4, uaN: -0.8, faN: 0.3, uaF: -0.9, faF: 0.3, thN: 0.5, knN: 0.2, thF: -0.4, head: 0.2 },
  },
  grabThrow: {
    windup: { lean: -0.3, uaN: 1.8, faN: 0.6, uaF: 1.9, faF: 0.5, hN: 1, hF: 1, thF: -0.3 },
    hit: { lean: 0.45, dx: 3, uaN: 0.8, faN: 0.2, uaF: 0.7, faF: 0.2, hN: 1, hF: 1, thN: 0.5, thF: -0.5 },
  },
  overhead: {
    windup: { ...G, uaN: 3.1, faN: 0.4, uaF: 3.0, faF: 0.5, lean: -0.3, dy: -1 },
    hit: { ...G, uaN: 1.0, faN: 0.1, uaF: 1.0, faF: 0.1, lean: 0.55, dy: 3, dx: 3 },
  },
  pokeJab: {
    windup: { ...G, uaF: 0.7, faF: 1.9 },
    hit: { ...G, uaF: 1.55, faF: 0.1, lean: 0.12, dx: 1 },
  },
};
ATTACK_POSES.punchL = ATTACK_POSES.jab;
ATTACK_POSES.punchR = ATTACK_POSES.cross;
ATTACK_POSES.clothesline = ATTACK_POSES.lariat;

const KEYS = Object.keys(BASE);

export function lerpPose(a, b, t, out = {}) {
  for (const k of KEYS) {
    const va = a[k] ?? BASE[k], vb = b[k] ?? BASE[k];
    out[k] = k === 'flip' ? (t < 0.5 ? va : vb) : va + (vb - va) * t;
  }
  return out;
}

export function fillPose(p) { const o = {}; for (const k of KEYS) o[k] = p[k] ?? BASE[k]; return o; }

const smooth = t => t * t * (3 - 2 * t);
const quant = (t, n) => (n > 0 ? Math.floor(t * n + 1e-6) / n : t);
const quantUp = (t, n) => (n > 0 ? Math.min(1, Math.ceil(t * n - 1e-6) / n) : t);

// Sample an animation at time t (s). Returns a full pose.
export function sampleAnim(name, t, out = {}) {
  const A = ANIMS[name] || ANIMS.idle;
  const fr = A.frames;
  let total = 0;
  for (const f of fr) total += f[0];
  let tt = A.loop ? ((t % total) + total) % total : Math.min(Math.max(0, t), total - 1e-6);
  for (let i = 0; i < fr.length; i++) {
    const [d, p] = fr[i];
    if (tt < d || i === fr.length - 1) {
      const next = A.loop ? fr[(i + 1) % fr.length][1] : (fr[i + 1] ? fr[i + 1][1] : p);
      return lerpPose(p, next, smooth(quant(Math.min(1, tt / d), QUANT)), out);
    }
    tt -= d;
  }
  return fillPose(fr[0][1]);
}

export function animDuration(name) {
  const A = ANIMS[name];
  return A ? A.frames.reduce((s, f) => s + f[0], 0) : 0;
}

// Attack pose by phase. phase: 0 startup, 1 active, 2 recovery; p in [0,1] within phase.
// Startup shows the anticipation pose immediately, the active phase snaps to the impact frame (one smear in-between),
// recovery goes through the optional follow-through pose before settling back into the guard.
export function attackPose(name, phase, p, rest = GUARD, out = {}) {
  const A = ATTACK_POSES[name] || ATTACK_POSES.jab;
  if (phase === 0) return lerpPose(rest, A.windup, smooth(quantUp(p, QUANT)), out);
  if (phase === 1) return lerpPose(A.windup, A.hit, p < 0.15 ? 0.7 : 1, out);
  const end = A.end || rest;
  if (A.follow) {
    if (p < 0.35) return lerpPose(A.hit, A.follow, quantUp(p / 0.35, 2), out);
    return lerpPose(A.follow, end, smooth(quant((p - 0.35) / 0.65, QUANT)), out);
  }
  return lerpPose(A.hit, end, smooth(quant(p, QUANT + 1)), out);
}

export function registerAnim(name, def) { ANIMS[name] = def; }
export function registerAttackPose(name, def) { ATTACK_POSES[name] = def; }
