// THE LAST STAND: the rival alliance's elites and THE GENERAL (final boss).
//
// Enemies:  laststand_ultra      ALLIANCE ULTRA   fast flanker, rushes in with a running clothesline (laststand_lariat)
//           laststand_flareman   FLARE MERCHANT   kites at range, lobs lit flares that leave burning patches on the ground
//           laststand_lieutenant LIEUTENANT       suited, blocks a lot and counter-attacks out of his guard
// Boss:     laststand_general    THE GENERAL      three phases:
//             1  technical brawler: reads single attacks and counters them, 3-hit "DRILL" string, sweeps
//             2  (<= 66%) calls in two lieutenants, directs from the gates and calls FLARE STRIKES from the stands
//             3  (<= 33%) enraged (coat off, faster, super armour): UNBLOCKABLE CHARGE and GROUND SLAM (jump it)
// Shared helpers (exported for the level): ensureFlareSystem, spawnFirePatch, spawnFlareStrike, ALLIANCE.

import { registerEnemy, casualLook } from '../enemies.js';
import { registerAttack } from '../../game/combat.js';
import { registerAttackPose, registerAnim, GUARD, STAND } from '../../game/poses.js';
import { normalizeLook } from '../../game/doll.js';
import { toScreen } from '../../engine/iso.js';
import { ellipse, thick } from '../../engine/gfx.js';

export const ALLIANCE = { a: '#1f4fb4', b: '#f0c020' };   // Portside blue + Vargby yellow, together at last

// ================================================================== attacks & poses
registerAttackPose('laststand_lariat', {
  windup: { ...GUARD, uaN: 1.5, faN: 0.15, uaF: 0.4, faF: 1.6, lean: 0.2, dx: -1 },
  hit: { ...GUARD, uaN: 1.65, faN: 0.0, uaF: 0.2, faF: 1.2, lean: 0.5, dx: 5, thN: 0.7, knN: 0.3, thF: -0.6, knF: 0.2 },
});
registerAttackPose('laststand_palm', {
  windup: { ...GUARD, uaN: 0.35, faN: 2.25, lean: -0.12, dx: -1 },
  hit: { ...GUARD, uaN: 1.5, faN: 0.05, lean: 0.42, dx: 4, thN: 0.6, knN: 0.3, thF: -0.45, hN: 1 },
});
registerAttackPose('laststand_slam', {
  windup: { lean: -0.25, dy: -3, head: -0.2, uaN: 3.0, faN: 0.3, uaF: 3.0, faF: 0.3, thN: 0.3, knN: 0.2, thF: -0.2, knF: 0.1 },
  hit: { lean: 0.85, dx: 3, dy: 9, uaN: 0.9, faN: 0.15, uaF: 0.9, faF: 0.15, thN: 1.1, knN: 1.7, thF: -0.3, knF: 1.3 },
});
registerAttackPose('laststand_sweep', {
  windup: { ...GUARD, dy: 6, lean: 0.3, thN: 0.9, knN: 1.8, thF: -0.2, knF: 1.6 },
  hit: { ...GUARD, dy: 8, lean: 0.45, thN: 1.55, knN: 0.1, thF: -0.4, knF: 1.8, uaN: 0.3, uaF: 0.5 },
});
registerAttackPose('laststand_charge', {
  windup: { lean: 0.6, dy: 3, thN: 0.7, knN: 0.8, thF: -0.6, knF: 0.7, uaN: 0.0, faN: 2.4, uaF: 0.2, faF: 2.4 },
  hit: { lean: 0.85, dx: 5, dy: 3, thN: 0.95, knN: 0.5, thF: -0.8, knF: 0.4, uaN: 0.4, faN: 2.2, uaF: 0.4, faF: 2.2 },
});
registerAnim('laststand_command', { loop: true, frames: [
  [0.3, { ...STAND, lean: -0.06, head: -0.12, uaN: 1.6, faN: 0.05, uaF: 0.35, faF: 1.9 }],
  [0.3, { ...STAND, lean: -0.1, head: -0.18, uaN: 1.75, faN: 0.0, uaF: 0.35, faF: 1.9, dy: 1 }],
] });
registerAnim('laststand_roar', { loop: true, frames: [
  [0.14, { lean: -0.3, head: -0.4, dy: 1, uaN: 2.4, faN: 0.9, uaF: 2.4, faF: 0.9, thN: 0.3, knN: 0.3, thF: -0.3, knF: 0.3 }],
  [0.14, { lean: -0.38, head: -0.55, dy: 2, uaN: 2.6, faN: 0.7, uaF: 2.6, faF: 0.7, thN: 0.35, knN: 0.35, thF: -0.35, knF: 0.35 }],
] });

registerAttack('laststand_lariat', { pose: 'laststand_lariat', startup: 0.24, active: 0.3, recovery: 0.45, dmg: 11, reach: 1.05, arc: 1.0, kb: 5, stun: 0.5, knockdown: true, launch: 2.5, lunge: 6.5, telegraph: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.08, shake: 4, score: 40, guardDmg: 18 });
registerAttack('laststand_gen_counter', { pose: 'laststand_palm', startup: 0.05, active: 0.08, recovery: 0.3, dmg: 11, reach: 1.2, arc: 1.0, kb: 4.5, stun: 0.55, knockdown: true, launch: 2.5, lunge: 2, unblockable: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.12, shake: 5, score: 0 });
registerAttack('laststand_gen_palm', { pose: 'laststand_palm', startup: 0.14, active: 0.1, recovery: 0.4, dmg: 13, reach: 1.15, arc: 0.9, kb: 5, stun: 0.6, knockdown: true, launch: 3, lunge: 2.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.1, shake: 5, score: 0, guardDmg: 22 });
registerAttack('laststand_gen_sweep', { pose: 'laststand_sweep', startup: 0.16, npcStartup: 0.28, active: 0.1, recovery: 0.34, dmg: 8, reach: 1.45, arc: 1.2, kb: 2.5, stun: 0.45, knockdown: true, launch: 1, telegraph: true, sfx: 'kick', whiff: 'whooshBig', hz: 0.4, hitstop: 0.07, shake: 3, score: 0, guardDmg: 14 });
registerAttack('laststand_gen_charge', { pose: 'laststand_charge', startup: 0.1, active: 0.6, recovery: 0.6, dmg: 20, reach: 1.15, arc: 1.0, kb: 7.5, stun: 0.7, knockdown: true, launch: 3.5, lunge: 9.5, unblockable: true, telegraph: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.3, hitstop: 0.12, shake: 8, score: 0 });
registerAttack('laststand_gen_slam', { pose: 'laststand_slam', startup: 0.12, active: 0.12, recovery: 0.7, dmg: 16, reach: 2.3, arc: Math.PI, kb: 6, stun: 0.6, knockdown: true, launch: 3, zReach: 0.45, unblockable: true, telegraph: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 0.3, hitstop: 0.12, shake: 10, score: 0 });

// ================================================================== fire: flare patches, strikes, light rig
function burnHit(world, f, cx, cy, dmg, knock) {
  const dx = f.x - cx, dy = f.y - cy, d = Math.hypot(dx, dy) || 1;
  const def = { hz: 0.4, sfx: knock ? 'explosion' : 'flare' };
  const hit = { attacker: null, def, dmg, dir: { x: dx / d, y: dy / d }, kb: knock ? 6 : 2.5, stun: knock ? 0.6 : 0.3, knockdown: !!knock, launch: knock ? 3 : 0, unblockable: true, guardDmg: 0 };
  const res = f.takeHit(hit, world);
  world.onHit({ x: cx, y: cy }, f, def, res, dmg);
  if (world.fx) world.fx.spark(f.x, f.y, 0.5, '#ff6a3a', 6);
  return res;
}

// a burning flare lying on the ground: hurts everybody standing in it (enemies too)
export function spawnFirePatch(world, x, y, o = {}) {
  if (world.heightAt(x, y) > 0.35) return null;
  const a = {
    kind: 'laststand_fire', x, y, t: 0, life: o.life ?? 4, r: o.r ?? 0.7, dmg: o.dmg ?? 4, tick: 0.25, removed: false,
    update(w, dt) {
      this.t += dt;
      if (this.t > this.life) { this.removed = true; return; }
      if (w.fx && Math.random() < dt * 7) w.fx.add({ x: this.x + (Math.random() - 0.5) * 0.4, y: this.y + (Math.random() - 0.5) * 0.4, z: 0.3, vx: 0.2, vy: -0.1, vz: 0.8 + Math.random() * 0.5, life: 1.2 + Math.random(), kind: 'puff', size: 3 + Math.random() * 3, color: Math.random() < 0.5 ? '#7a2a36' : '#4a2430', g: 0 });
      this.tick -= dt;
      if (this.tick > 0) return;
      this.tick = 0.5;
      for (const f of w.fighters) {
        if (!f.alive || f.invuln > 0 || f.isDown || f.z > 0.35) continue;
        if (Math.hypot(f.x - this.x, f.y - this.y) > this.r + f.r * 0.5) continue;
        burnHit(w, f, this.x, this.y, this.dmg, false);
      }
    },
    draw(ctx, w) {
      const s = toScreen(this.x, this.y, 0);
      const k = Math.min(1, (this.life - this.t) / 0.8);
      ctx.save(); ctx.globalAlpha = (0.25 + 0.1 * Math.sin(w.time * 19 + this.x)) * k;
      ellipse(ctx, s.x, s.y, 13, 6, '#ff2a3a');
      ctx.restore();
      thick(ctx, s.x - 4, s.y, s.x + 3, s.y - 2, 3, '#120c14');
      thick(ctx, s.x - 4, s.y, s.x + 3, s.y - 2, 1, '#c81830');
      const fh = Math.round((3 + Math.abs(Math.sin(w.time * 21 + this.y)) * 5) * k);
      if (fh > 0) {
        ctx.fillStyle = '#ff3a4a'; ctx.fillRect(Math.round(s.x) + 2, Math.round(s.y) - 3 - fh, 3, fh);
        ctx.fillStyle = '#ffe0e0'; ctx.fillRect(Math.round(s.x) + 3, Math.round(s.y) - 2 - fh, 1, Math.max(1, fh - 1));
      }
      (w.lightsDynamic ||= []).push({ x: this.x, y: this.y, z: 0.4, r: 3 * k + 0.5, color: '#ff2a3a', intensity: 0.75 * k, flicker: true });
    },
    depth() { return this.x + this.y - 0.3; },
  };
  world.addActor(a);
  return a;
}

// a flare lobbed from the stands: red target marker, then impact (knockdown) + fire patch
export function spawnFlareStrike(world, x, y, delay = 1.25) {
  const a = {
    kind: 'laststand_strike', x, y, t: 0, delay, removed: false,
    update(w, dt) {
      this.t += dt;
      if (this.t < this.delay) return;
      this.removed = true;
      w.sfx('hitHeavy', this);
      if (w.fx) { w.fx.spark(this.x, this.y, 0.4, '#ff3a4a', 16); w.fx.add({ x: this.x, y: this.y, z: 0.2, kind: 'ring', life: 0.3, size: 4, color: '#ff6a6a', g: 0 }); w.fx.dust(this.x, this.y, 0, 5); }
      if (w.camera) w.camera.shake(3, 0.15);
      for (const f of w.fighters) {
        if (!f.alive || f.invuln > 0 || f.z > 0.8 || f.boss) continue;
        if (Math.hypot(f.x - this.x, f.y - this.y) > 1.05) continue;
        burnHit(w, f, this.x, this.y, f.isPlayer ? 10 : 16, true);
      }
      spawnFirePatch(w, this.x, this.y, { life: 2.6 });
    },
    draw(ctx, w) {
      const s = toScreen(this.x, this.y, 0);
      const k = this.t / this.delay;
      const blink = Math.floor(this.t * (6 + k * 14)) % 2 === 0;
      ctx.strokeStyle = blink ? '#ff3a3a' : '#ffd0d0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(Math.round(s.x), Math.round(s.y), 18 - k * 6, 9 - k * 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(Math.round(s.x) - 4, Math.round(s.y), 9, 1); ctx.fillRect(Math.round(s.x), Math.round(s.y) - 2, 1, 5);
      if (k > 0.55) {   // the flare falling in
        const z = (1 - (k - 0.55) / 0.45) * 9;
        const f = toScreen(this.x, this.y, z);
        thick(ctx, f.x, f.y, f.x + 2, f.y - 6, 2, '#c81830');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3);
        ctx.fillStyle = '#ffb0b0'; ctx.fillRect(Math.round(f.x), Math.round(f.y) + 2, 1, 6);
      }
      (w.lightsDynamic ||= []).push({ x: this.x, y: this.y, z: 0, r: 1.8, color: '#ff2a2a', intensity: 0.4 + 0.3 * (blink ? 1 : 0) });
    },
    depth() { return this.x + this.y - 0.4; },
  };
  world.addActor(a);
  return a;
}

// watches thrown flares (they turn into fire patches where they land) and lights up held/flying flares
export function ensureFlareSystem(world) {
  if (world._lsFlares) return world._lsFlares;
  const sys = {
    kind: 'laststand_flaresys', x: 0, y: 0, removed: false, tracked: new Map(),
    update(w) {
      for (const pr of w.projectiles) if (pr.type === 'laststand_flare' && !this.tracked.has(pr)) this.tracked.set(pr, true);
      for (const pr of this.tracked.keys()) {
        if (!pr.removed) continue;
        this.tracked.delete(pr);
        spawnFirePatch(w, pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, { life: 3.6 });
      }
    },
    draw(ctx, w) {
      const L = (w.lightsDynamic ||= []);
      for (const f of w.fighters) if (f.alive && f.weapon && f.weapon.def.id === 'laststand_flare') L.push({ x: f.x, y: f.y, z: 1.2, r: 2.8, color: '#ff2a3a', intensity: 0.65, flicker: true });
      for (const pr of w.projectiles) if (pr.type === 'laststand_flare') L.push({ x: pr.x, y: pr.y, z: pr.z, r: 2.4, color: '#ff3a4a', intensity: 0.7 });
    },
    depth() { return -1e9; },
  };
  world.addActor(sys);
  world._lsFlares = sys;
  return sys;
}

// ================================================================== elites
registerEnemy('laststand_ultra', {
  name: 'ALLIANCE ULTRA', hp: 58, speed: 3.1, runSpeed: 5.8, power: 1.1, guard: 38, score: 280,
  look: rng => {
    const L = casualLook(rng, { a: ALLIANCE.a, b: ALLIANCE.b, scarf: { a: ALLIANCE.a, b: ALLIANCE.b }, hair: ['skinhead', 'buzz', 'crop'] });
    return {
      ...L,
      jacket: { style: 'track', color: rng.pick(['#1f4fb4', '#141418', '#24245a']), trim: ALLIANCE.b },
      pants: { style: 'trackies', color: rng.pick(['#141418', '#1f2a5a']), trim: ALLIANCE.b },
      hat: rng.chance(0.55) ? { style: 'hood', color: '#141418' } : { style: 'beanie', color: ALLIANCE.a, trim: ALLIANCE.b, bobble: true },
      shades: rng.chance(0.35), build: rng.range(1.05, 1.22),
    };
  },
  ai: {
    aggression: 0.75, reaction: 0.24, attacks: [['jab', 2], ['cross', 2], ['hook', 2], ['kick', 2], ['uppercut', 1]], comboLen: [2, 4],
    blockChance: 0.18, dodgeChance: 0.12, runChance: 0.6, rushChance: 0.45, rushAttack: 'laststand_lariat', flank: 0.6, keepDist: 2.0, taunt: 0.12,
    shouts: { aggro: ['ALLIANCE!', 'ONE LAST RUCK!', 'HE\'S ON HIS OWN!'], taunt: ['NO MATES?', 'COME ON THEN, HERO!'], rush: ['CLOTHESLINE!', 'HAVE THAT!'], hurt: ['ME TEETH!', 'OOF!'] },
  },
  drops: [['coin', 0.6], ['cash5', 0.25], ['pint', 0.1]],
});

registerEnemy('laststand_flareman', {
  name: 'FLARE MERCHANT', hp: 38, speed: 2.8, runSpeed: 5.0, power: 0.9, score: 240, guard: 25,
  weapon: 'laststand_flare',
  look: rng => ({
    ...casualLook(rng, { scarf: { a: ALLIANCE.b, b: '#141414' }, hair: ['crop', 'shaved'] }),
    jacket: { style: 'parka', color: rng.pick(['#1a1a1e', '#26262c', '#2a2420']), lining: '#c81830' },
    hat: { style: 'hood', color: '#1a1a1e' }, pants: { style: 'cargo', color: '#2a2a2e' }, shades: false,
  }),
  ai: {
    aggression: 0.35, reaction: 0.38, attacks: [['jab', 1]], throwChance: 0.5, throwCd: 2.4, projectile: 'laststand_flare',
    kite: true, keepDist: 4.6, flee: 0.25, blockChance: 0.05,
    shouts: { aggro: ['LIGHT HIM UP!', 'BIT OF COLOUR FOR YOU!'], taunt: ['SMELL THE SMOKE!', 'PRETTY, INNIT?'], hurt: ['ME EYEBROWS!'] },
  },
  drops: [['coin', 0.5], ['energy', 0.12]],
  onSpawn(f, world) { if (world) ensureFlareSystem(world); },
  think(f, world) { ensureFlareSystem(world); return false; },
});

registerEnemy('laststand_lieutenant', {
  name: 'LIEUTENANT', hp: 80, speed: 2.9, runSpeed: 5.2, power: 1.2, guard: 60, superArmor: 5, weight: 1.2, score: 450,
  look: rng => ({
    skin: rng.pick(['#e2a97a', '#d49a6a', '#f0c098', '#b87a50', '#8a5636']),
    hair: { style: rng.pick(['sidepart', 'mod', 'quiff', 'crop']), color: rng.pick(['#141016', '#3a2717', '#5a5a5a']) },
    facial: rng.pick(['none', 'stubble', 'goatee']),
    jacket: { style: 'suit', color: rng.pick(['#1a1c2a', '#24242c', '#2a2030']), lining: ALLIANCE.b },
    shirt: rng.pick([ALLIANCE.a, '#e8e4dc']), pants: { style: 'suit', color: '#1a1c2a' },
    shoes: { style: 'dress', color: '#121214', sole: '#2a2a2a' }, scarf: { a: ALLIANCE.a, b: ALLIANCE.b },
    shades: true, gloves: '#141418', build: 1.2, height: 1.08,
  }),
  ai: {
    aggression: 0.62, reaction: 0.24, attacks: [['jab', 2], ['cross', 2], ['hook', 2], ['roundhouse', 1], ['uppercut', 1]], comboLen: [2, 3],
    blockChance: 0.5, dodgeChance: 0.1, counterChance: 0.8, grabChance: 0.08, keepDist: 2.1, flank: 0.4,
    shouts: { aggro: ['THE GENERAL SENDS HIS REGARDS.', 'ORDERS ARE ORDERS.'], taunt: ['TOO SLOW.', 'AMATEUR.'], hurt: ['MY SUIT!'] },
  },
  drops: [['cash20', 0.3], ['pie', 0.3]],
});

// ================================================================== THE GENERAL
const GENERAL_LOOK = {
  skin: '#e0b090', hair: { style: 'flattop', color: '#c4c4cc' }, facial: 'beard', shades: true,
  jacket: { style: 'sheepskin', color: '#2a2018', trim: '#e8dcc0', lining: ALLIANCE.a }, shirt: ALLIANCE.a,
  pants: { style: 'jeans', color: '#24324e' }, shoes: { style: 'boot', color: '#121214', sole: ALLIANCE.b },
  scarf: { a: ALLIANCE.a, b: ALLIANCE.b }, gloves: '#141418', build: 1.45, height: 1.32,
};
const GENERAL_RAGE = normalizeLook({
  ...GENERAL_LOOK, shades: false, jacket: { style: 'vest', color: '#ecebe4' }, shirt: '#ecebe4', gloves: null, scarf: { a: ALLIANCE.a, b: ALLIANCE.b },
});

function sayBig(f, world, text, color = '#ffd23a') { if (f.say) f.say(text, 2.0, color); }

function spawnLieutenants(world) {
  const out = [];
  const spots = [
    { x: 23.5, y: 5.5, from: { x: 17.5, y: 7.6 } },
    { x: 33.5, y: 11.5, from: { x: 36.5, y: 18.5 } },
  ];
  for (const s of spots) {
    const f = world.spawnEnemy('laststand_lieutenant', s.x, s.y, { from: s.from, aggro: true, name: 'LIEUTENANT' });
    if (f) out.push(f);
  }
  return out;
}

function flareBarrage(world, p, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = i === 0 ? 0.2 : 1.2 + Math.random() * 1.4;
    let x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (world.heightAt(x, y) > 0.35) { x = p.x; y = p.y; }
    spawnFlareStrike(world, x, y, 1.15 + i * 0.22);
  }
  world.sfx('throw', p);
}

registerEnemy('laststand_general', {
  name: 'THE GENERAL', boss: true, hp: 680, speed: 2.7, runSpeed: 5.0, power: 1.2, weight: 2.0, superArmor: 0, guard: 90, score: 10000,
  ungrabbable: true, reachMul: 1.1,
  look: GENERAL_LOOK,
  ai: {
    aggression: 0.6, reaction: 0.3, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 2], ['laststand_gen_sweep', 1]], comboLen: [1, 3],
    blockChance: 0.35, dodgeChance: 0.1, counterChance: 0.5, ignoreTokens: true, keepDist: 2.4, taunt: 0.05,
    shouts: { aggro: ['ATTENTION!'], taunt: ['IS THAT IT?', 'I IRON MY JEANS FOR THIS?', 'FORM UP!'], hurt: ['INSUBORDINATION!', 'HOW DARE YOU!'], rush: ['CHARGE!'] },
  },
  drops: [['kebab', 1]],
  onSpawn(f, world) { if (world) ensureFlareSystem(world); },
  think(f, world, dt, ai) {
    const p = world.player;
    const I = f.intent;
    const G = ai.gen || (ai.gen = { phase: 1, specialCd: 3.5, counterCd: 1.2, strikeCd: 2, cmdT: 0, lts: [], seq: null, tele: null, seenAtk: null, intro: false, tips: {} });
    if (!p) return false;
    if (ai.goal) return false;                                    // still marching out of the tunnel
    for (const k of ['specialCd', 'counterCd', 'strikeCd']) G[k] -= dt;
    if (!G.intro) {
      G.intro = true;
      sayBig(f, world, 'SO. YOU\'RE THE LAST ONE.');
      f.tauntAnim = 'laststand_command'; f.tauntTime = 1.3; f.setState('taunt');
      world.sfx('bossRoar', f);
      return true;
    }
    if (!f.alive || f.dying) return false;
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 0.01;
    const r = f.hp / f.maxHp;

    // ---------------------------------------------------------- phase changes
    if (G.phase === 1 && r <= 0.66) {
      G.phase = 2; G.cmdT = 14; G.strikeCd = 1.6; G.tele = null; G.seq = null;
      f.invuln = 1.2; f.attack = null;
      f.tauntAnim = 'laststand_command'; f.tauntTime = 1.4; f.setState('taunt');
      world.message('"LADS - NOW!"', 'THE GENERAL CALLS IN HIS LIEUTENANTS', 2.4, '#ffd23a');
      world.sfx('bossRoar', f);
      G.lts = spawnLieutenants(world);
      return true;
    }
    if (G.phase === 2 && r <= 0.33) {
      G.phase = 3; G.cmdT = 0; G.tele = null; G.seq = null; G.specialCd = 1.6;
      f.look = GENERAL_RAGE;
      f.speed *= 1.3; f.runSpeed *= 1.25; f.superArmor = 9; f.power *= 1.1;
      ai.ai = { ...ai.ai, aggression: 0.85, reaction: 0.2, blockChance: 0.12, counterChance: 0.25 };
      f.invuln = 1.1; f.attack = null;
      f.tauntAnim = 'laststand_roar'; f.tauntTime = 1.1; f.setState('taunt');
      world.message('THE GENERAL HAS LOST IT!', 'THE COAT IS OFF. THE GLOVES ARE OFF.', 2.6, '#ff4a4a');
      world.sfx('bossRoar', f);
      if (world.camera) world.camera.shake(8, 0.5);
      if (world.fx) { world.fx.add({ x: f.x, y: f.y, z: 1, kind: 'ring', life: 0.4, size: 6, color: '#ff4a4a', g: 0 }); world.fx.dust(f.x, f.y, 0, 12); }
      if (dist < 2.6 && p.alive && p.invuln <= 0 && !p.isDown) p.knockDown({ x: dx / dist, y: dy / dist }, 6, 2);
      return true;
    }

    // ---------------------------------------------------------- telegraphed special in progress
    if (G.tele) {
      if (!f.canAct) { G.tele = null; return false; }
      G.tele.t -= dt;
      I.mx = I.my = 0; I.block = false;
      if (G.tele.t > 0.12) f.face2(dx, dy);
      if (Math.floor(G.tele.t * 12) % 2 === 0) f.flashT = Math.max(f.flashT, 0.03);
      if (world.fx && Math.random() < dt * 20) world.fx.spark(f.x, f.y, 1.2 + Math.random() * 1.2, G.tele.color, 2);
      if (G.tele.t <= 0) { I.attackName = G.tele.atk; G.tele = null; }
      return true;
    }

    // ---------------------------------------------------------- scripted strings (THE DRILL)
    if (G.seq) {
      if (f.state === 'attack' && f.attack) {
        if (f.attack.phase >= 1 && G.seq.length) I.attackName = G.seq[0];
        if (f.attack.name === G.seq[0]) G.seq.shift();
        if (!G.seq.length) G.seq = null;
        return true;
      }
      if (!f.canAct) G.seq = null;
    }

    // slam shockwave fx
    if (f.state === 'attack' && f.attack && f.attack.name === 'laststand_gen_slam' && f.attack.phase === 1 && !f.attack.lsFx) {
      f.attack.lsFx = true;
      if (world.fx) {
        world.fx.add({ x: f.x, y: f.y, z: 0.1, kind: 'ring', life: 0.35, size: 8, color: '#ffe14a', g: 0 });
        world.fx.add({ x: f.x, y: f.y, z: 0.1, kind: 'ring', life: 0.5, size: 4, color: '#ffffff', g: 0 });
        for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; world.fx.dust(f.x + Math.cos(a) * 1.6, f.y + Math.sin(a) * 1.6, 0, 1); }
      }
      if (world.camera) world.camera.shake(10, 0.35);
      for (const o of world.props) if (!o.removed && o.def.breakable && Math.hypot(o.cx - f.x, o.cy - f.y) < 2.4) world.damageProp(o, 40, f);
    }

    if (!f.canAct || p.isDown || !p.alive) return false;

    // ---------------------------------------------------------- reactive counter (reads single attacks)
    if (p.state === 'attack' && p.attack && p.attack !== G.seenAtk) {
      G.seenAtk = p.attack;
      const facingMe = (p.fx * -dx + p.fy * -dy) / dist > 0.45;
      const ch = G.phase === 1 ? 0.55 : G.phase === 2 ? 0.4 : 0.28;
      if (facingMe && dist < 1.9 && p.attack.phase === 0 && G.counterCd <= 0 && !p.attack.def.grab && Math.random() < ch) {
        G.counterCd = G.phase === 3 ? 3.2 : 2.3;
        f.invuln = 0.3;
        f.face2(dx, dy);
        I.attackName = 'laststand_gen_counter';
        if (world.fx) world.fx.spark(f.x + dx / dist * 0.5, f.y + dy / dist * 0.5, 1.5, '#8ad8ff', 10);
        world.sfx('block', f);
        if (!G.tips.counter) { G.tips.counter = true; world.message('COUNTERED!', 'HE READS LONE SWINGS - MIX IT UP, HIT HIM FROM BEHIND', 2.2, '#8ad8ff'); }
        else ai.shout && ai.shout(f, world, ['TOO SLOW.', 'PREDICTABLE.', 'AMATEUR.'], 0.5);
        return true;
      }
    }

    // ---------------------------------------------------------- phase 2: command post + flare strikes
    if (G.phase === 2) {
      G.lts = G.lts.filter(l => l.alive && !l.removed);
      if (G.cmdT > 0) {
        G.cmdT -= dt;
        if (!G.lts.length) { G.cmdT = 0; sayBig(f, world, 'USELESS! DO I HAVE TO DO EVERYTHING?'); }
      }
      if (G.strikeCd <= 0 && world.hasLOS(f.x, f.y, p.x, p.y)) {
        G.strikeCd = G.cmdT > 0 ? 2.6 : 5;
        if (!G.tips.strike) { G.tips.strike = true; world.message('FLARES FROM THE STANDS!', 'KEEP MOVING - MIND THE RED MARKERS', 2.2, '#ff6a6a'); }
        flareBarrage(world, p, G.cmdT > 0 ? 3 : 2);
        f.tauntAnim = 'laststand_command'; f.tauntTime = 0.6; f.setState('taunt'); f.face2(dx, dy);
        ai.shout && ai.shout(f, world, ['FIRE!', 'LIGHT HIM UP!', 'BARRAGE!'], 1);
        return true;
      }
      if (G.cmdT > 0 && dist > 2.0) {
        // hang back by the gates and direct the lads; lob the odd flare himself
        const post = { x: 22.5, y: 8.5 };
        const px = post.x - f.x, py = post.y - f.y, pd = Math.hypot(px, py);
        if (pd > 0.6) { I.mx = px / pd; I.my = py / pd; I.run = pd > 3; f.face2(px, py); return true; }
        f.face2(dx, dy);
        if (G.specialCd <= 0 && dist > 2.6 && dist < 7) {
          G.specialCd = 3;
          f.data.projectile = 'laststand_flare';
          I.attackName = 'throwItem';
          return true;
        }
        return true;
      }
    }

    // ---------------------------------------------------------- phase 3: charge & slam
    if (G.phase === 3 && G.specialCd <= 0) {
      if (dist < 2.4 && Math.random() < dt * 3) {
        G.specialCd = 3.2;
        G.tele = { t: 0.55, atk: 'laststand_gen_slam', color: '#ffe14a' };
        if (!G.tips.slam) { G.tips.slam = true; world.message('GROUND SLAM!', 'JUMP OVER THE SHOCKWAVE (SPACE)', 1.8, '#ffe14a'); }
        sayBig(f, world, 'DOWN!', '#ffe14a');
        world.sfx('bossRoar', f);
        return true;
      }
      if (dist > 2.6 && dist < 7.5 && world.hasLOS(f.x, f.y, p.x, p.y)) {
        G.specialCd = 3.6;
        G.tele = { t: 0.7, atk: 'laststand_gen_charge', color: '#ff3a3a' };
        if (!G.tips.charge) { G.tips.charge = true; world.message('UNBLOCKABLE CHARGE!', 'DODGE (O) OR JUMP OUT OF THE WAY', 1.8, '#ff4a4a'); }
        sayBig(f, world, 'NORDHAMN BURNS!', '#ff6a6a');
        world.sfx('bossRoar', f);
        return true;
      }
    }
    if (G.phase === 3 && G.strikeCd <= 0 && dist > 3) { G.strikeCd = 7; flareBarrage(world, p, 2); }

    // ---------------------------------------------------------- THE DRILL: jab, hook, palm strike
    if (G.phase < 3 && G.specialCd <= 0 && dist < 1.35) {
      G.specialCd = G.phase === 1 ? 4 : 5;
      f.face2(dx, dy);
      G.seq = ['hook', 'laststand_gen_palm'];
      I.attackName = 'jab';
      ai.shout && ai.shout(f, world, ['LEFT! RIGHT! DOWN!', 'DRILL TIME.'], 0.7);
      return true;
    }
    return false;
  },
  onDeath(f, world) {
    if (f.say) f.say('NOT... THE JEANS...', 2.5, '#ffd23a');
    if (world.fx) world.fx.confetti(f.x, f.y, 1, ['#c8102e', '#f4f1e8', '#d4af37'], 40);
  },
});

