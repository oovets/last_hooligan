// THE CITY (Level 5): new enemies, attacks, poses and the boss VINCE VELVET, KING OF THE NIGHT.
// All ids start with 'city_'.
//   city_casual  CITY SLICKER   stylish rival casuals: sidestep your attacks and counter with a flick kick
//   city_bouncer DOOR STAFF     huge, armoured, grab-heavy: grab -> knee -> "OUT YOU GO" throw
//   city_stag    STAG DO        drunk, wobbly, telegraphed windmill haymakers + belly bump, inflatable hammers
//   city_hen     HEN DO         fast, handbag swings, lobs stilettos from range
//   city_king    VINCE VELVET   boss: cane combos, CANE TWIRL (360 sweep), SHOWTIME knee slide,
//                               phones in his crew (interruptible!), phase 2 champagne volleys
// The boss reads optional world.level.cityCrewSpawns = [{ x, y, from:{x,y} }] for his phone-a-friend.

import { registerEnemy } from '../enemies.js';
import { registerAttack } from '../../game/combat.js';
import { registerAttackPose, registerAnim, GUARD, STAND } from '../../game/poses.js';
import { ITEMS } from '../../game/items.js';
import { toScreen } from '../../engine/iso.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const rpick = (rng, a) => a[Math.floor(rng() * a.length)];

// ------------------------------------------------------------------ attacks
registerAttack('city_flick', { pose: 'city_flick', startup: 0.07, active: 0.08, recovery: 0.16, dmg: 6, reach: 1.25, arc: 0.6, kb: 2.4, stun: 0.34, sfx: 'kick', whiff: 'whooshLight', hz: 1.2, score: 15 });
registerAttack('city_palm', { pose: 'city_palm', startup: 0.24, active: 0.09, recovery: 0.32, dmg: 9, reach: 1.15, arc: 0.8, kb: 5.5, stun: 0.5, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.5, hitstop: 0.06, shake: 3, score: 0 });
registerAttack('city_drunkSwing', { pose: 'city_drunkSwing', startup: 0.42, active: 0.12, recovery: 0.45, dmg: 11, reach: 1.15, arc: 1.1, kb: 4.2, stun: 0.5, sfx: 'punchHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.07, shake: 3, score: 0 });
registerAttack('city_belly', { pose: 'city_belly', startup: 0.32, active: 0.15, recovery: 0.4, dmg: 7, reach: 1.0, arc: 0.9, kb: 6.5, stun: 0.45, lunge: 3.5, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.1, hitstop: 0.05, shake: 2, score: 0 });
registerAttack('city_bagSwing', { pose: 'city_bagSwing', startup: 0.14, active: 0.12, recovery: 0.24, dmg: 9, reach: 1.3, arc: 1.4, kb: 3.5, stun: 0.45, weapon: true, sfx: 'slap', whiff: 'whooshBig', hz: 1.5, hitstop: 0.06, shake: 2, score: 25 });
registerAttack('city_caneSwing', { pose: 'city_caneSwing', startup: 0.21, active: 0.1, recovery: 0.26, dmg: 13, reach: 1.5, arc: 1.0, kb: 3.5, stun: 0.45, weapon: true, sfx: 'weapon', whiff: 'whooshBig', hz: 1.5, hitstop: 0.07, shake: 3, score: 30 });
registerAttack('city_caneSpin', { pose: 'city_caneSpin', startup: 0.65, active: 0.3, recovery: 0.5, dmg: 16, reach: 1.8, arc: Math.PI, kb: 6, stun: 0.6, knockdown: true, launch: 3, guardDmg: 40, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.4, hitstop: 0.1, shake: 6, score: 0 });
registerAttack('city_kneeSlide', { pose: 'city_kneeSlide', startup: 0.5, active: 0.42, recovery: 0.55, dmg: 14, reach: 1.0, arc: 0.9, kb: 6, stun: 0.6, knockdown: true, launch: 2.5, lunge: 9, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 0.9, hitstop: 0.09, shake: 5, score: 0 });

// ------------------------------------------------------------------ poses
registerAttackPose('city_flick', {
  windup: { ...GUARD, thN: 0.9, knN: 1.9, lean: -0.05, uaN: 0.3 },
  hit: { ...GUARD, thN: 1.35, knN: 0.15, lean: -0.25, dx: 2 },
});
registerAttackPose('city_palm', {
  windup: { lean: -0.15, uaN: 0.8, faN: 2.2, uaF: 0.5, faF: 1.5, thN: 0.2, thF: -0.2, hN: 1 },
  hit: { lean: 0.35, dx: 4, uaN: 1.55, faN: 0.05, uaF: 0.4, faF: 1.6, thN: 0.5, knN: 0.3, thF: -0.4, hN: 1 },
});
registerAttackPose('city_drunkSwing', {
  windup: { lean: -0.35, head: -0.3, dx: -2, uaN: -1.2, faN: 0.6, uaF: 1.4, faF: 0.6, thN: 0.2, thF: -0.3, knF: 0.3 },
  hit: { lean: 0.55, head: 0.25, dx: 4, uaN: 2.0, faN: 0.2, uaF: -0.4, faF: 0.4, thN: 0.6, knN: 0.4, thF: -0.4, rot: 0.15 },
});
registerAttackPose('city_belly', {
  windup: { lean: -0.45, dy: -1, uaN: -0.6, faN: 0.6, uaF: -0.6, faF: 0.6, thN: 0.2 },
  hit: { lean: -0.35, dx: 5, uaN: -0.9, faN: 0.3, uaF: -0.9, faF: 0.3, thN: 0.5, knN: 0.2, thF: -0.3 },
});
registerAttackPose('city_bagSwing', {
  windup: { ...GUARD, uaN: 2.6, faN: 0.4, lean: -0.25 },
  hit: { ...GUARD, uaN: 0.6, faN: 0.2, lean: 0.35, dx: 3, thN: 0.5, knN: 0.3 },
});
registerAttackPose('city_caneSwing', {
  windup: { ...GUARD, uaN: 2.9, faN: 0.3, lean: -0.2 },
  hit: { ...GUARD, uaN: 1.0, faN: 0.0, lean: 0.4, dx: 3, thN: 0.55, knN: 0.3 },
});
registerAttackPose('city_caneSpin', {
  windup: { lean: -0.2, dy: 2, uaN: 2.8, faN: 0.2, uaF: 1.2, faF: 1.0, thN: 0.4, knN: 0.6, thF: -0.3, knF: 0.5 },
  hit: { lean: 0.1, uaN: 1.57, faN: 0, uaF: 1.4, faF: 0.2, flip: 1, thN: 0.5, knN: 0.3, thF: -0.5, rot: 0.1 },
});
registerAttackPose('city_kneeSlide', {
  windup: { lean: -0.3, dy: 1, uaN: 2.6, faN: 0.4, uaF: 2.4, faF: 0.4, thN: 0.3, knN: 0.5 },
  hit: { lean: -0.35, dy: 8, thN: 1.4, knN: 2.3, thF: -0.2, knF: 2.0, uaN: 2.9, faN: 0.2, uaF: 2.7, faF: 0.3 },
});
registerAnim('city_phone', { loop: true, frames: [[0.3, { ...STAND, uaN: 1.75, faN: 2.6, head: 0.15, uaF: 0.3, faF: 1.4 }], [0.3, { ...STAND, uaN: 1.8, faN: 2.55, head: 0.25, uaF: 0.9, faF: 0.9, hF: 1 }]] });
registerAnim('city_strut', { loop: true, frames: [[0.25, { ...STAND, lean: -0.12, uaN: 0.5, faN: 1.6, uaF: -0.3, faF: 0.4, head: -0.15 }], [0.25, { ...STAND, lean: -0.08, dy: -1, uaN: 0.6, faN: 1.7, uaF: -0.2, faF: 0.5, head: -0.1, thN: 0.2 }]] });
registerAnim('city_woo', { loop: true, frames: [[0.15, { ...STAND, uaN: 2.8, faN: 0.6, uaF: 2.6, faF: 0.7, dy: 0 }], [0.15, { ...STAND, uaN: 2.6, faN: 0.3, uaF: 2.9, faF: 0.4, dy: -3, thN: 0.3, knN: 0.5 }]] });

// ------------------------------------------------------------------ helpers
function popup(world, f, text, color = '#ffe14a') { world.fx && world.fx.popup(f.x, f.y, f.z + 2.4 * (f.look.height || 1), text, color); }

// Telegraph ring on the ground around a fighter (drawn under everyone).
function ring(world, f, r, dur, color) {
  world.addActor({
    x: f.x, y: f.y, t: 0, removed: false,
    update(w, dt) { this.t += dt; if (this.t > dur || !f.alive) this.removed = true; },
    depth() { return -1e6; },
    draw(ctx) {
      const s = toScreen(f.x, f.y, 0);
      const rx = r * 16 * 1.414, ry = r * 8 * 1.414;
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.floor(this.t * 14) % 2 ? 0.85 : 0.45;
      const n = 48, k = Math.min(1, this.t / dur);
      for (let i = 0; i < n; i++) {
        if (i / n > k + 0.02) break;
        const a = i / n * Math.PI * 2;
        ctx.fillRect(Math.round(s.x + Math.cos(a) * rx) - 1, Math.round(s.y + Math.sin(a) * ry), 3, 1);
      }
      ctx.globalAlpha = 1;
    },
  });
}

function giveWeapon(f, id) { const d = ITEMS[id]; if (d && d.weapon) f.weapon = { def: d, durability: d.weapon.durability + 2 }; }

// ------------------------------------------------------------------ CITY SLICKER — stylish casuals who sidestep
const PASTELS = ['#9ad0c8', '#e8b0c0', '#d8d0a8', '#a8b8e8', '#c8a8e0', '#f0e0b0'];
registerEnemy('city_casual', {
  name: 'CITY SLICKER', hp: 52, speed: 3.2, runSpeed: 5.8, power: 1.0, score: 240, guard: 35,
  look: rng => ({
    skin: rpick(rng, ['#e2a97a', '#d49a6a', '#f0c098', '#b87a50', '#8a5636', '#5e3a24']),
    hair: { style: rpick(rng, ['mod', 'curtains', 'wedge', 'sidepart', 'quiff', 'flattop']), color: rpick(rng, ['#141016', '#3a2717', '#6a4a2a', '#e8d27a']) },
    facial: rpick(rng, ['none', 'none', 'stubble', 'sideburns', 'goatee']),
    jacket: rng() < 0.65
      ? { style: 'harrington', color: rpick(rng, PASTELS), lining: rpick(rng, ['#c8102e', '#1a6a5a', '#e8c040']) }
      : { style: 'track', color: rpick(rng, ['#1a6a6a', '#6a1a5a', '#e8e4dc', '#2a2a6a']), trim: rpick(rng, ['#e8c040', '#ffffff', '#ff8ac0']) },
    shirt: rpick(rng, ['#f4f1e8', '#1a1a22', '#e8c8d0', '#c8e0e8']),
    pants: { style: rpick(rng, ['jeans', 'cargo', 'jeans']), color: rpick(rng, ['#8aa0c0', '#d8d0b8', '#2a2a34', '#5a6a7a']) },
    shoes: { style: 'trainer', color: '#f4f1ee', sole: '#d8d0b8', stripe: rpick(rng, ['#2a8a5a', '#1f4fb4', '#c8102e', '#e8c040']) },
    scarf: null,
    hat: rng() < 0.3 ? { style: 'bucket', color: rpick(rng, ['#e8e0c8', '#c8d8e8', '#f0c8d8']) } : (rng() < 0.12 ? { style: 'flatcap', color: '#8a7a6a' } : null),
    shades: rng() < 0.4,
    build: 0.95 + rng() * 0.15, height: 0.98 + rng() * 0.06,
  }),
  ai: { aggression: 0.62, reaction: 0.24, attacks: [['jab', 3], ['cross', 2], ['city_flick', 3], ['roundhouse', 1]], comboLen: [2, 3], blockChance: 0.1, dodgeChance: 0.14, keepDist: 2.4, runChance: 0.45, taunt: 0.12 },
  drops: [['cash5', 0.3], ['coin', 0.4], ['energy', 0.08]],
  onSpawn(f) { f.tauntAnim = 'city_strut'; f.tauntTime = 1.0; },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || ai.goal || !ai.aggro) return false;
    ai.sideCd = (ai.sideCd ?? 0.5) - dt;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1;
    if (ai.counter && f.canAct) {
      ai.counter = false;
      if (d < 1.6) { f.face2(dx, dy); f.intent.attackName = 'city_flick'; ai.combo = 1; return true; }
    }
    if (f.canAct && ai.sideCd <= 0 && d < 1.9 && p.state === 'attack' && p.attack && p.attack.phase === 0 && Math.random() < 0.4) {
      ai.sideCd = 2.2;
      const s = Math.random() < 0.5 ? 1 : -1;
      f.intent.dodge = true; f.intent.mx = (-dy / d) * s * 0.8 - dx / d * 0.3; f.intent.my = (dx / d) * s * 0.8 - dy / d * 0.3;
      ai.counter = true;
      if (Math.random() < 0.3) popup(world, f, pick(['TOO SLOW!', 'NICE TRY', 'OLE!']), '#9ad0c8');
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ DOOR STAFF — bouncers
registerEnemy('city_bouncer', {
  name: 'DOOR STAFF', hp: 95, speed: 2.2, runSpeed: 4.2, power: 1.15, weight: 1.9, superArmor: 8, guard: 70, score: 420, ungrabbable: true,
  look: rng => ({
    skin: rpick(rng, ['#e2a97a', '#d49a6a', '#b87a50', '#8a5636', '#5e3a24', '#f0c098']),
    hair: { style: rpick(rng, ['skinhead', 'bald', 'buzz']), color: '#1a1410' },
    facial: rpick(rng, ['beard', 'goatee', 'none', 'stubble']),
    jacket: { style: rng() < 0.6 ? 'suit' : 'bomber', color: '#141418', trim: '#0a0a0c', lining: '#3a3a44' },
    shirt: rng() < 0.7 ? '#e8e4dc' : '#141418',
    pants: { style: 'suit', color: '#141418' },
    shoes: { style: 'dress', color: '#0a0a0c', sole: '#1a1a1a' },
    gloves: '#0a0a0c', scarf: null, hat: null, shades: rng() < 0.45,
    build: 1.45 + rng() * 0.12, height: 1.12 + rng() * 0.05,
  }),
  ai: { aggression: 0.5, reaction: 0.42, attacks: [['city_palm', 3], ['haymaker', 2], ['push', 1]], comboLen: [1, 2], blockChance: 0.3, grabChance: 0.22, keepDist: 1.9, runChance: 0.1, taunt: 0.05 },
  drops: [['pie', 0.3], ['cash20', 0.2], ['coin', 0.4]],
  think(f, world, dt, ai) {
    if (f.grabbing) {
      ai.gt = (ai.gt || 0) + dt;
      if (!ai.said) { ai.said = true; if (f.grabbing.isPlayer) world.toast(pick(["NOT TONIGHT, PAL.", "TRAINERS? YOU'RE BARRED.", "NAME'S NOT DOWN, MATE."])); }
      if (ai.gt > 0.35 && !ai.kneed) { ai.kneed = true; f.intent.attackName = 'knee'; }
      else if (ai.gt > 1.0 && f.state === 'grabbing') { f.intent.grab = true; popup(world, f, 'OUT YOU GO!', '#ff6a5a'); }
      f.intent.mx = f.intent.my = 0;
      return true;
    }
    ai.gt = 0; ai.kneed = false; ai.said = false;
    return false;
  },
});

// ------------------------------------------------------------------ STAG DO — wobbly, loud, harmless-ish
const STAG_TEES = ['#ff5aa8', '#9aff3a', '#ffd23a', '#3ae0ff'];
registerEnemy('city_stag', {
  name: 'STAG DO', hp: 48, speed: 2.5, runSpeed: 4.6, power: 0.95, weight: 1.2, score: 200,
  look: rng => {
    const tee = rpick(rng, STAG_TEES);
    return {
      skin: rpick(rng, ['#f0c098', '#e2a97a', '#f4d0b0', '#d49a6a', '#8a5636']),
      hair: { style: rpick(rng, ['crop', 'balding', 'spiky', 'perm', 'curtains', 'shaved']), color: rpick(rng, ['#3a2717', '#6a4a2a', '#b4521c', '#e8d27a', '#141016']) },
      facial: rpick(rng, ['none', 'stubble', 'beard', 'tache']),
      jacket: { style: 'tee', color: tee, print: '#ffffff' },
      shirt: tee,
      pants: rng() < 0.4 ? { style: 'shorts', color: rpick(rng, ['#d8c8a0', '#3a5a8a']), socks: '#f4f1e8' } : { style: 'jeans', color: rpick(rng, ['#34507a', '#1e1e26']) },
      shoes: { style: 'trainer', color: rpick(rng, ['#f4f1ee', '#121214']), sole: '#d0c0a0' },
      scarf: null,
      hat: rng() < 0.35 ? { style: 'helmet', color: rpick(rng, ['#d4af37', '#c8c8d0']) } : (rng() < 0.2 ? { style: 'cap', color: tee } : null),
      shades: rng() < 0.2,
      build: 1.1 + rng() * 0.25, height: 0.97 + rng() * 0.06,
    };
  },
  ai: { aggression: 0.55, reaction: 0.45, attacks: [['city_drunkSwing', 3], ['jab', 1], ['city_belly', 2]], comboLen: [1, 2], blockChance: 0.03, keepDist: 2.0, runChance: 0.3, taunt: 0.25, useWeapons: true },
  drops: [['pint', 0.25], ['coin', 0.5]],
  onSpawn(f, world, opts) { f.tauntAnim = 'city_woo'; f.tauntTime = 1.1; if (!opts || opts.weapon === undefined) { if (Math.random() < 0.4) giveWeapon(f, 'city_inflatable'); } },
  think(f, world, dt, ai) {
    if (ai.goal) return false;
    ai.base(f, world, dt);
    if (f.canAct && (f.intent.mx || f.intent.my)) {
      const w = Math.sin(ai.t * 2.6 + f.id * 1.7) * 0.6;
      const mx = f.intent.mx, my = f.intent.my;
      f.intent.mx = mx - my * w; f.intent.my = my + mx * w;
    }
    if (f.state === 'taunt' && f.stateT < 0.02 && Math.random() < 0.5) popup(world, f, pick(['WAHEY!', 'HIC!', 'LADS LADS LADS', 'ONE MORE!']), '#ffe14a');
    return true;
  },
});

// ------------------------------------------------------------------ HEN DO — handbags at dawn
registerEnemy('city_hen', {
  name: 'HEN DO', hp: 42, speed: 3.0, runSpeed: 5.4, power: 0.9, score: 200,
  look: rng => {
    const pink = rpick(rng, ['#ff8ac8', '#ff5aa8', '#e8e4dc', '#c8a8f0']);
    return {
      skin: rpick(rng, ['#f0c098', '#e2a97a', '#f4d0b0', '#d49a6a', '#8a5636', '#5e3a24']),
      hair: { style: rpick(rng, ['long', 'ponytail', 'perm', 'long']), color: rpick(rng, ['#e8d27a', '#b4521c', '#141016', '#6a4a2a', '#f0e0b0']) },
      facial: 'none',
      jacket: rng() < 0.5 ? { style: 'tee', color: pink, print: '#ffffff' } : { style: 'shirt', color: pink },
      shirt: pink,
      pants: { style: rng() < 0.5 ? 'suit' : 'jeans', color: rpick(rng, ['#141418', '#1e1e26', '#3a1a3a']) },
      shoes: { style: 'dress', color: rpick(rng, ['#c81a4a', '#141418', '#d4af37']), sole: '#141418' },
      scarf: { a: '#ff8ac8', b: '#ffffff' },
      hat: null, shades: rng() < 0.15,
      build: 0.88 + rng() * 0.1, height: 0.93 + rng() * 0.05,
    };
  },
  ai: { aggression: 0.66, reaction: 0.3, attacks: [['slap', 3], ['city_flick', 1], ['jab', 1]], comboLen: [1, 3], blockChance: 0.05, dodgeChance: 0.12, keepDist: 2.6, runChance: 0.4, taunt: 0.15, throwChance: 0.2, projectile: 'city_heel' },
  drops: [['energy', 0.2], ['coin', 0.4]],
  onSpawn(f, world, opts) { f.tauntAnim = 'city_woo'; f.tauntTime = 0.9; if (!opts || opts.weapon === undefined) { if (Math.random() < 0.6) giveWeapon(f, 'city_handbag'); } },
  think(f, world, dt, ai) {
    if (f.state === 'taunt' && f.stateT < 0.02 && Math.random() < 0.6) popup(world, f, pick(['WOOO!', 'OI OI!', 'HANDBAGS!', 'BRIDE COMING THROUGH']), '#ff8ac8');
    return false;
  },
});

// ------------------------------------------------------------------ BOSS: VINCE VELVET, KING OF THE NIGHT
registerEnemy('city_king', {
  name: 'VINCE VELVET', boss: true, hp: 500, speed: 2.7, runSpeed: 5.2, power: 1.1, weight: 2.0, superArmor: 9, guard: 85, score: 6000, ungrabbable: true,
  weapon: 'city_cane',
  look: {
    skin: '#c88a60', hair: { style: 'quiff', color: '#141016' }, facial: 'tache', shades: true,
    jacket: { style: 'suit', color: '#6a1a8a', trim: '#d4af37', lining: '#ff3aa0', badge: '#d4af37' },
    shirt: '#ff3aa0',
    pants: { style: 'suit', color: '#3a0a4e' },
    shoes: { style: 'dress', color: '#f4f1e8', sole: '#d4af37' },
    gloves: '#f4f1e8', scarf: null, hat: null,
    build: 1.38, height: 1.32,
  },
  ai: { aggression: 0.6, reaction: 0.34, attacks: [['cross', 2], ['hook', 2], ['city_flick', 2], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.22, dodgeChance: 0.08, grabChance: 0, ignoreTokens: true, keepDist: 2.4, runChance: 0.3 },
  drops: [['kebab', 1], ['cash20', 1]],
  onSpawn(f) { f.tauntAnim = 'city_strut'; f.tauntTime = 1.0; },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || ai.goal) return false;
    const S = ai.king || (ai.king = { phoneCd: 7, spinCd: 3.5, slideCd: 5, volley: 0, volleyCd: 0, refill: 0, rearm: 0, phase: 1, calling: false });
    S.phoneCd -= dt; S.spinCd -= dt; S.slideCd -= dt; S.volleyCd -= dt;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1;
    const P2 = S.phase === 2;

    // ---- phase change
    if (!P2 && f.hp < f.maxHp * 0.45 && f.alive) {
      S.phase = 2;
      f.speed *= 1.2; f.runSpeed *= 1.15; f.superArmor += 3;
      f.look.shades = false;
      world.message('VINCE HAS LOST HIS COOL!', 'THE SHADES ARE OFF...', 2.2, '#ff3aa0');
      world.sfx('bossRoar', f);
      world.camera && world.camera.shake(5, 0.4);
      ai.ai.aggression = 0.75; ai.ai.reaction = 0.26;
      S.phoneCd = Math.min(S.phoneCd, 2); S.volley = 3; S.volleyCd = 1;
    }

    // ---- on the phone (interruptible)
    if (S.calling) {
      S.callT += dt;
      f.intent.mx = f.intent.my = 0;
      if (f.state !== 'taunt' && S.callT > 0.1) {
        S.calling = false;
        f.weapon = S.cane || f.weapon;
        if (!S.called) { popup(world, f, 'CALL DROPPED!', '#7aff9a'); world.toast('YOU HUNG UP ON THE KING!'); }
        return false;
      }
      if (S.callT > 1.15 && !S.called) {
        S.called = true;
        summonCrew(f, world, P2 ? 3 : 2);
        popup(world, f, "THEY'RE ON THEIR WAY", '#ff3aa0');
      }
      return true;
    }

    // ---- re-arm with a fresh cane
    if (!f.weapon) {
      S.rearm += dt;
      if (S.rearm > 6 && f.canAct) { S.rearm = 0; giveWeapon(f, 'city_cane'); popup(world, f, 'SPARE CANE!', '#d4af37'); }
    } else S.rearm = 0;

    if (!f.canAct || f.state === 'attack') return false;

    // ---- PHONE A FRIEND
    const crew = world.fighters.filter(o => o.alive && o.data.kingCrew).length;
    if (S.phoneCd <= 0 && crew < (P2 ? 2 : 1) && (S.calls || 0) < (P2 ? 4 : 2) && d > 2.4 && f.state !== 'block') {
      S.phoneCd = P2 ? 15 : 18;
      S.calls = (S.calls || 0) + 1;
      S.calling = true; S.called = false; S.callT = 0;
      S.cane = f.weapon;
      giveWeapon(f, 'city_phone');
      f.tauntAnim = 'city_phone'; f.tauntTime = 1.7;
      f.intent.taunt = true;
      f.face2(dx, dy);
      world.message('VINCE IS ON THE BLOWER!', 'STOP HIM BEFORE THE CREW TURNS UP!', 1.8, '#ff3aa0');
      world.sfx('bossRoar', f);
      return true;
    }
    // ---- CANE TWIRL: 360 sweep when crowded
    if (S.spinCd <= 0 && d < 1.9) {
      S.spinCd = P2 ? 4.5 : 6.5;
      f.face2(dx, dy);
      f.intent.attackName = 'city_caneSpin';
      ring(world, f, 1.8, 0.65, '#ff3aa0');
      popup(world, f, 'TWIRL!', '#ff3aa0');
      world.sfx('whooshBig', f);
      return true;
    }
    // ---- SHOWTIME: knee slide across the square
    if (S.slideCd <= 0 && d > 2.8 && d < 7 && world.hasLOS(f.x, f.y, p.x, p.y)) {
      S.slideCd = P2 ? 4 : 6.5;
      f.face2(dx, dy);
      f.intent.attackName = 'city_kneeSlide';
      popup(world, f, 'SHOWTIME!', '#ffd23a');
      world.sfx('bossRoar', f);
      return true;
    }
    // ---- phase 2: champagne volley
    if (P2) {
      S.refill += dt;
      if (S.volley <= 0 && S.refill > 7) { S.volley = 3; S.refill = 0; }
      if (S.volley > 0 && S.volleyCd <= 0 && d > 2.2 && d < 8 && world.hasLOS(f.x, f.y, p.x, p.y)) {
        S.volley--; S.volleyCd = 0.5;
        if (S.volley === 2) popup(world, f, 'POP THE BUBBLY!', '#d4af37');
        f.face2(dx, dy);
        f.data.projectile = 'city_champagne';
        f.intent.attackName = 'throwItem';
        return true;
      }
    }
    return false;
  },
  onDeath(f, world) {
    world.toast('THE KING IS DEAD. LONG LIVE THE ANCHORS!');
    for (const o of world.fighters) if (o.alive && o.data.kingCrew) world.fx && world.fx.popup(o.x, o.y, o.z + 2, 'LEG IT!', '#ffe14a');
  },
});

function summonCrew(king, world, n) {
  const spots = (world.level.cityCrewSpawns || []).slice();
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const enc = world.encounters && world.encounters.find(e => e.boss && e.state === 'active');
  for (let i = 0; i < n; i++) {
    const s = spots[i] || { x: king.x + (i ? 1.5 : -1.5), y: king.y + 1 };
    const c = world.spawnEnemy('city_casual', s.x, s.y, { from: s.from, aggro: true, hp: 36, name: "VINCE'S CREW" });
    if (!c) continue;
    c.data.kingCrew = true;
    if (enc) enc.spawned.push(c);
  }
}
