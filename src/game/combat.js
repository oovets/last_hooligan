// Attack definitions + hit resolution.
//
// ATTACK DEF fields (times in seconds, distances in tiles):
//   pose      key in ATTACK_POSES (poses.js) used for animation
//   startup, active, recovery   phase durations
//   npcStartup  optional startup used when an AI fighter performs the move (longer = readable telegraph)
//   dmg       base damage (multiplied by attacker.power; weapon attacks use weapon dmg)
//   reach     max distance (centre to centre minus target radius)
//   arc       half-angle (rad) of the hit cone in front of the attacker (Math.PI = all around)
//   back      true -> the hit cone points BEHIND the attacker (rear elbow / back kick)
//   kb        knockback speed applied to target (tiles/s)
//   stun      hitstun duration
//   knockdown true -> target is knocked off its feet
//   launch    extra vertical speed given on knockdown (uppercuts)
//   hitsDown  can hit targets lying on the ground       downOnly: only hits downed targets
//   lunge     forward speed during startup+active (tiles/s)   lungeActive: lunge only during the active phase (charges)
//   air       airborne attack (lasts until landing; recovery happens on landing)
//   leap      { vz, speed } jump impulse applied when the attack starts on the ground (flying kick)
//   guardDmg  guard meter damage when blocked (default dmg)
//   unblockable
//   juggle    false -> can't hit airborne knocked-down targets (default: player-team attacks can juggle)
//   next      { punchL|punchR|kick: attackName } combo continuations (input during the attack; chains once it connects
//             or late in recovery)
//   sfx       sound on hit ('punch','kick','hitHeavy',...)    whiff: sound on startup ('whoosh')
//   hitstop   freeze time on hit;  shake: camera shake px on hit
//   hz        hit height for effects (units above ground)   score: base points per hit
//   grab      true -> only hits the fighter currently held by the attacker
//   counter   true -> counter-attack (bonus effects)       telegraph: force the "!" warning over AI attackers
//
// PLAYER MOVE LIST (button semantics, see openingAttack + `next` maps):
//   J J J J   jab, jab, hook, uppercut          J K L   jab, cross, roundhouse        K J K   cross, hook, uppercut
//   K K K     cross, cross, uppercut            L L     kick, spin kick               J J L   jab, jab, kick -> L spin kick
//   run + J/K shoulder charge                   run + L flying kick               jump + L / J  jump kick / dive punch
//   L near a downed enemy: stomp                GRAB: J/K knees (3rd K = headbutt), L or GRAB = throw (hold back = throw behind)
//   BLOCK + J/K rear elbow   BLOCK + L back kick (hit enemies behind you without turning)
//   attack right after blocking a hit = COUNTER (fast, knocks down; a just-in-time block is a PARRY)

import { ATTACK_POSES, registerAttackPose, GUARD } from './poses.js';

export const ATTACKS = {
  // ---- player strings (enemies use the same moves with a slower npcStartup) ----
  jab: { pose: 'jab', startup: 0.05, npcStartup: 0.16, active: 0.07, recovery: 0.12, dmg: 4, reach: 0.95, arc: 0.75, kb: 1.0, stun: 0.3, sfx: 'punch', whiff: 'whooshLight', hz: 1.6, hitstop: 0.04, score: 10, next: { punchL: 'jab2', punchR: 'cross', kick: 'kick' } },
  jab2: { pose: 'jab', startup: 0.04, npcStartup: 0.12, active: 0.07, recovery: 0.12, dmg: 4, reach: 0.95, arc: 0.75, kb: 1.0, stun: 0.3, sfx: 'punch', whiff: 'whooshLight', hz: 1.6, hitstop: 0.04, score: 10, next: { punchL: 'hook', punchR: 'cross', kick: 'kick' } },
  cross: { pose: 'cross', startup: 0.07, npcStartup: 0.2, active: 0.08, recovery: 0.15, dmg: 6, reach: 1.05, arc: 0.7, kb: 1.6, stun: 0.33, sfx: 'punch', whiff: 'whoosh', hz: 1.6, lunge: 1.5, hitstop: 0.045, score: 15, next: { punchL: 'hook', punchR: 'cross2', kick: 'roundhouse' } },
  cross2: { pose: 'cross', startup: 0.06, npcStartup: 0.16, active: 0.08, recovery: 0.15, dmg: 6, reach: 1.05, arc: 0.7, kb: 1.6, stun: 0.33, sfx: 'punch', whiff: 'whoosh', hz: 1.6, lunge: 1.5, hitstop: 0.045, score: 15, next: { punchL: 'hook', punchR: 'uppercut', kick: 'roundhouse' } },
  hook: { pose: 'hook', startup: 0.08, npcStartup: 0.22, active: 0.08, recovery: 0.17, dmg: 7, reach: 1.0, arc: 0.95, kb: 2.0, stun: 0.38, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.6, hitstop: 0.055, shake: 1, score: 20, next: { punchR: 'uppercut', punchL: 'uppercut', kick: 'spinKick' } },
  uppercut: { pose: 'uppercut', startup: 0.09, npcStartup: 0.3, active: 0.09, recovery: 0.28, dmg: 12, reach: 1.0, arc: 0.75, kb: 3.0, stun: 0.5, knockdown: true, launch: 6.5, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.7, hitstop: 0.1, shake: 4, score: 50, guardDmg: 16 },
  kick: { pose: 'kick', startup: 0.09, npcStartup: 0.22, active: 0.09, recovery: 0.18, dmg: 7, reach: 1.3, arc: 0.6, kb: 2.4, stun: 0.36, sfx: 'kick', whiff: 'whoosh', hz: 1.0, hitstop: 0.05, score: 15, guardDmg: 11, next: { kick: 'spinKick', punchR: 'cross', punchL: 'jab2' } },
  lowKick: { pose: 'lowKick', startup: 0.07, npcStartup: 0.18, active: 0.08, recovery: 0.18, dmg: 5, reach: 1.25, arc: 0.6, kb: 1.4, stun: 0.3, sfx: 'kick', whiff: 'whooshLight', hz: 0.5, score: 10, guardDmg: 8 },
  spinKick: { pose: 'spinKick', startup: 0.12, npcStartup: 0.3, active: 0.12, recovery: 0.28, dmg: 11, reach: 1.4, arc: Math.PI, kb: 4.0, stun: 0.5, knockdown: true, launch: 3, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.5, hitstop: 0.09, shake: 4, score: 50, guardDmg: 18 },
  roundhouse: { pose: 'roundhouse', startup: 0.11, npcStartup: 0.3, active: 0.1, recovery: 0.27, dmg: 11, reach: 1.35, arc: 0.95, kb: 4.2, stun: 0.5, knockdown: true, launch: 3, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.5, hitstop: 0.09, shake: 4, score: 45, guardDmg: 18 },
  shoulder: { pose: 'shoulder', startup: 0.06, npcStartup: 0.22, active: 0.22, recovery: 0.25, dmg: 9, reach: 0.95, arc: 0.85, kb: 4.5, stun: 0.5, knockdown: true, launch: 2.5, lunge: 6, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.2, hitstop: 0.08, shake: 4, score: 40, guardDmg: 20 },
  flyingKick: { pose: 'flyingKick', startup: 0.05, npcStartup: 0.12, leap: { vz: 5.2, speed: 6.5 }, active: 0.6, recovery: 0.2, dmg: 12, reach: 1.25, arc: 0.75, kb: 5, stun: 0.5, knockdown: true, launch: 3, air: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.3, hitstop: 0.09, shake: 5, score: 60, zReach: 1.3, guardDmg: 22 },
  jumpKick: { pose: 'jumpKick', startup: 0.06, active: 0.6, recovery: 0.12, dmg: 9, reach: 1.2, arc: 0.85, kb: 3.5, stun: 0.45, knockdown: true, launch: 2.5, air: true, sfx: 'kick', whiff: 'whoosh', hz: 1.4, hitstop: 0.07, shake: 3, score: 40, zReach: 1.4 },
  divePunch: { pose: 'divePunch', startup: 0.06, active: 0.6, recovery: 0.12, dmg: 8, reach: 1.05, arc: 0.85, kb: 2.5, stun: 0.45, air: true, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.5, hitstop: 0.06, score: 35, zReach: 1.4, hitsDown: true },
  stomp: { pose: 'stomp', startup: 0.09, active: 0.08, recovery: 0.18, dmg: 6, reach: 1.15, arc: 1.0, kb: 0.3, stun: 0.2, hitsDown: true, downOnly: true, sfx: 'stomp', whiff: 'whooshLight', hz: 0.2, hitstop: 0.05, shake: 2, score: 20 },
  knee: { pose: 'knee', startup: 0.07, active: 0.07, recovery: 0.15, dmg: 7, reach: 1.0, arc: 1.2, kb: 0, stun: 0.45, grab: true, sfx: 'punchHeavy', hz: 1.1, hitstop: 0.06, shake: 2, score: 25 },
  headbutt: { pose: 'headbutt', startup: 0.1, active: 0.07, recovery: 0.2, dmg: 10, reach: 1.0, arc: 1.2, kb: 0, stun: 0.6, grab: true, sfx: 'hitHeavy', hz: 1.8, hitstop: 0.09, shake: 3, score: 35 },
  swing: { pose: 'swing', startup: 0.12, npcStartup: 0.28, active: 0.1, recovery: 0.22, dmg: 10, reach: 1.35, arc: 0.95, kb: 3, stun: 0.45, weapon: true, sfx: 'weapon', whiff: 'whooshBig', hz: 1.5, hitstop: 0.08, shake: 3, score: 25 },
  thrust: { pose: 'thrust', startup: 0.1, npcStartup: 0.26, active: 0.1, recovery: 0.2, dmg: 9, reach: 1.7, arc: 0.45, kb: 3, stun: 0.4, weapon: true, sfx: 'weapon', whiff: 'whoosh', hz: 1.3, hitstop: 0.06, shake: 2, score: 25 },
  // ---- defensive tools ----
  counter: { pose: 'counter', startup: 0.03, active: 0.08, recovery: 0.2, dmg: 10, reach: 1.15, arc: 1.0, kb: 4.2, stun: 0.5, knockdown: true, launch: 2.5, lunge: 2.5, counter: true, unblockable: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.11, shake: 4, score: 60 },
  backElbow: { pose: 'backElbow', startup: 0.06, active: 0.08, recovery: 0.18, dmg: 7, reach: 1.0, arc: 1.0, back: true, kb: 2.6, stun: 0.45, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.6, hitstop: 0.06, shake: 2, score: 30, next: { punchL: 'jab', punchR: 'cross', kick: 'backKick' } },
  backKick: { pose: 'backKick', startup: 0.1, active: 0.1, recovery: 0.24, dmg: 9, reach: 1.3, arc: 0.9, back: true, kb: 4.2, stun: 0.5, knockdown: true, launch: 2, sfx: 'kick', whiff: 'whooshBig', hz: 1.1, hitstop: 0.08, shake: 3, score: 40, guardDmg: 16 },
  // ---- generic enemy moves (enemies.js / bosses may register more) ----
  haymaker: { pose: 'haymaker', startup: 0.34, active: 0.09, recovery: 0.34, dmg: 9, reach: 1.1, arc: 0.7, kb: 3.0, stun: 0.45, knockdown: false, sfx: 'punchHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.07, shake: 3, score: 30, guardDmg: 12 },
  slap: { pose: 'slap', startup: 0.18, active: 0.07, recovery: 0.2, dmg: 3, reach: 0.95, arc: 0.8, kb: 1.0, stun: 0.25, sfx: 'slap', whiff: 'whooshLight', hz: 1.7, score: 15 },
  push: { pose: 'push', startup: 0.18, active: 0.1, recovery: 0.26, dmg: 3, reach: 1.0, arc: 0.8, kb: 4.5, stun: 0.4, sfx: 'punch', whiff: 'whooshLight', hz: 1.2, score: 15, guardDmg: 10 },
  bodySlam: { pose: 'bodySlam', startup: 0.45, active: 0.15, recovery: 0.65, dmg: 14, reach: 1.25, arc: 0.9, kb: 5, stun: 0.6, knockdown: true, launch: 3, lunge: 3, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.0, hitstop: 0.1, shake: 6, score: 40, guardDmg: 22 },
};

export function registerAttack(name, def) { ATTACKS[name] = def; }

// The startup a given fighter actually uses for an attack (AI fighters get the slower, readable npcStartup).
export function attackStartup(f, def) {
  return (!f.isPlayer && def.npcStartup !== undefined) ? def.npcStartup : def.startup;
}

// Map an input button to the opening attack given context.
//   ctx: { air, running, downTarget, back }
export function openingAttack(f, button, ctx = {}) {
  if (ctx.back) return button === 'kick' ? 'backKick' : 'backElbow';
  // per-character move overrides (content/characters.js): moves = { punchL, punchR, kick, run, runKick }
  const M = f.moves;
  if (M && !f.weapon && !ctx.air) {
    if (ctx.running) { if (button === 'kick' && M.runKick) return M.runKick; if (button !== 'kick' && M.run) return M.run; }
    else if (M[button] && !ctx.downTarget) return M[button];
  }
  if (f.weapon && button !== 'kick' && !ctx.air) return f.weapon.def.weapon.attack || 'swing';
  if (ctx.air) return button === 'kick' ? 'jumpKick' : 'divePunch';
  if (ctx.running) return button === 'kick' ? 'flyingKick' : 'shoulder';
  if (ctx.downTarget && button === 'kick') return 'stomp';
  if (button === 'punchL') return 'jab';
  if (button === 'punchR') return 'cross';
  return 'kick';
}

const MAX_JUGGLE = 3;

// Called every step for each fighter in an attack.
export function resolveAttack(world, f) {
  const atk = f.attack;
  if (!atk || atk.phase !== 1) return;
  const def = atk.def;
  if (!def.dmg && !def.weapon) return;
  const reach = (def.weapon && f.weapon ? (f.weapon.def.weapon.reach || def.reach) : def.reach) * (f.reachMul || 1);
  const cosArc = Math.cos(Math.min(Math.PI, def.arc));
  const ax = def.back ? -f.fx : f.fx, ay = def.back ? -f.fy : f.fy;
  const canJuggle = def.juggle !== false && f.team === 'player';
  for (const t of world.fighters) {
    if (t === f || !t.alive || t.removed || t.dying) continue;
    if (t.team === f.team) continue;
    if (atk.hit.has(t)) continue;
    if (t.invuln > 0 || t.state === 'getup' || t.state === 'dead' || t.state === 'thrown') continue;
    if (def.grab && t !== f.grabbing) continue;
    let juggle = false;
    if (t.state === 'knockdown' && !def.hitsDown) {
      // airborne bodies can be juggled a few times by the player's team
      const gz = world.groundHeight(t.x, t.y, t.z);
      if (!canJuggle || t.z - gz < 0.25 || (t.juggles || 0) >= (t.boss ? 1 : MAX_JUGGLE)) continue;
      juggle = true;
    } else {
      const isDown = t.state === 'down' || t.state === 'knockdown';
      if (isDown && !def.hitsDown) continue;
      if (def.downOnly && !isDown) continue;
    }
    if (Math.abs(t.z - f.z) > (def.zReach || 1.0) + (juggle ? 0.6 : 0)) continue;
    const dx = t.x - f.x, dy = t.y - f.y;
    const dist = Math.hypot(dx, dy);
    if (dist > reach + t.r) continue;
    if (def.arc < Math.PI && dist > 0.08) {
      const dot = (dx * ax + dy * ay) / dist;
      if (dot < cosArc) continue;
    }
    atk.hit.add(t);
    let dmg = def.dmg;
    if (def.weapon && f.weapon) dmg = f.weapon.def.weapon.dmg;
    dmg *= (f.power || 1);
    if (!def.weapon && (f.kickMul || f.punchMul)) dmg *= /kick|stomp|knee/i.test(def.pose || '') ? (f.kickMul || 1) : (f.punchMul || 1);
    if (juggle) { dmg *= 0.75; t.juggles = (t.juggles || 0) + 1; }
    const dl = dist || 1;
    const dir = dist > 0.05 ? { x: dx / dl, y: dy / dl } : { x: ax, y: ay };
    const res = t.takeHit({
      attacker: f, def, name: atk.name, dmg, dir,
      kb: juggle ? Math.min(def.kb, 3) : def.kb, stun: def.stun,
      knockdown: def.knockdown || (def.weapon && f.weapon && f.weapon.def.weapon.knockdown),
      launch: juggle ? Math.min(def.launch || 2.5, 3.5) : (def.launch || 0), unblockable: def.unblockable, guardDmg: def.guardDmg ?? dmg,
    }, world);
    world.onHit(f, t, def, res, dmg);
    if (def.grabOnHit && (res === 'hit' || res === 'armor') && !t.boss && f.grabTarget) { f.grabTarget(world, t); return; }
    if (res !== 'miss' && res !== 'none' && f.onAttackLanded) f.onAttackLanded(world, t, def, res, juggle);
    if (def.weapon && f.weapon && res !== 'blocked-break') f.weaponHit(world);
  }
}

// ------------------------------------------------------------------ poses for the moves added here
// (only registered when the art module doesn't already provide them)
const P = (name, def) => { if (!ATTACK_POSES[name]) registerAttackPose(name, def); };
P('counter', {
  windup: { ...GUARD, uaN: 0.35, faN: 2.0, lean: -0.15, dx: -1 },
  hit: { ...GUARD, uaN: 1.6, faN: 0.0, uaF: 0.5, faF: 2.0, lean: 0.5, dx: 4, thN: 0.6, knN: 0.3, thF: -0.55, knF: 0.1 },
});
P('backElbow', {
  windup: { ...GUARD, uaN: 1.1, faN: 2.3, lean: 0.12, head: 0.1 },
  hit: { ...GUARD, uaN: -1.25, faN: 1.9, lean: -0.2, dx: -3, head: -0.15, thN: 0.2, thF: -0.45, knF: 0.2 },
});
P('backKick', {
  windup: { ...GUARD, thN: 0.7, knN: 1.7, lean: 0.35, dx: 1 },
  hit: { ...GUARD, thN: -1.35, knN: 0.1, thF: 0.15, knF: 0.25, lean: 0.85, dx: 1, dy: 2, uaN: 0.9, faN: 1.2, uaF: 0.7, faF: 1.3, head: -0.3 },
});
