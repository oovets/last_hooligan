// TOUR ARENA ANFIELD: THE URCHINS (the Road End crew) — enemies and the boss. All invented people.
//
//   anfield_urchin    URCHIN            the everyday Road End lad: cagoule or trackie, picks up anything
//   anfield_scally    SCALLY            UNIQUE: fast, dodges a lot and NICKS things — your weapon, a fiver from your
//                                       pocket or the pie on the floor — then legs it. Floor him to get it back.
//   anfield_alleylad  BACK-ALLEY LAD    UNIQUE: comes OVER the back-yard walls into the jigger, then rushes you
//   anfield_koplad    KOP TERRACE LAD   UNIQUE big man: super armour, the TERRACE SWAY shove. One for the lads to pin.
//   anfield_bottler   OFFIE MERCHANT    lobs empties from range
//   anfield_topboy    URCHINS TOP BOY   ELITE: slips your punch with a sidestep and kicks you on the way back
//   anfield_lenny     LENNY "THE JIGGER" BOSS: slippy stance + dodge-roll counter, trainer flash (bait), weapon swipe,
//                                       and he calls THE KOP: a crowd surge rolls over the fence (theme.spawnKopSurge)

import { registerEnemy, casualLook } from '../../enemies.js';
import { registerAttack } from '../../../game/combat.js';
import { registerAttackPose, GUARD } from '../../../game/poses.js';
import { normalizeLook } from '../../../game/doll.js';
import { LFC, spawnKopSurge, kopState } from './theme.js';

const RED = LFC.red, YEL = LFC.yel, WHITE = LFC.white;
const PASTEL = ['#9ad0e8', '#f0b8c8', '#c8e8a0', '#e8d890', '#c8b8e8', '#f4f0e4', '#a8e0d0'];
const G = GUARD;
const dist2 = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const live = f => !!f && f.alive && f.hp > 0 && !f.removed;
const popup = (world, f, text, color = '#ffe14a') => world.fx.popup(f.x, f.y, f.z + 0.5, text, color);

// ------------------------------------------------------------------ attack poses + attacks
registerAttackPose('anfield_swipe', {
  windup: { ...G, uaN: 0.2, faN: 1.0, lean: -0.05, dx: -1 },
  hit: { ...G, uaN: 1.7, faN: 0.1, lean: 0.5, dx: 5, thN: 0.6, knN: 0.5, head: 0.1 },
});
registerAttackPose('anfield_heel', {
  windup: { ...G, lean: -0.25, thN: 0.9, knN: 1.4, dy: -1 },
  hit: { ...G, lean: -0.35, thN: 1.7, knN: 0.05, thF: -0.2, knF: 0.2, uaN: 0.9, faN: 1.0, dx: 2 },
});
registerAttackPose('anfield_shove', {
  windup: { ...G, uaN: 0.4, faN: 2.2, uaF: 0.4, faF: 2.2, lean: -0.2, dx: -2 },
  hit: { ...G, uaN: 1.5, faN: 0.2, uaF: 1.5, faF: 0.2, lean: 0.55, dx: 5, thN: 0.6, knN: 0.5 },
});

registerAttack('anfield_snatch', { pose: 'anfield_swipe', startup: 0.14, active: 0.08, recovery: 0.18, dmg: 2, reach: 1.1, arc: 1.0, kb: 1, stun: 0.25, sfx: 'punch', whiff: 'whoosh', hz: 1.2, hitstop: 0.03, score: 0 });
registerAttack('anfield_sidekick', { pose: 'anfield_heel', startup: 0.05, active: 0.09, recovery: 0.28, dmg: 9, reach: 1.1, arc: 1.0, kb: 4.5, stun: 0.5, knockdown: true, launch: 2, sfx: 'kick', whiff: 'whoosh', hz: 1.0, hitstop: 0.07, shake: 3, score: 0 });
registerAttack('anfield_sway', { pose: 'anfield_shove', startup: 0.4, active: 0.12, recovery: 0.4, dmg: 7, reach: 1.25, arc: 1.1, kb: 7.5, stun: 0.5, knockdown: true, launch: 2, telegraph: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.3, hitstop: 0.08, shake: 4, score: 0 });
registerAttack('anfield_lenny_heel', { pose: 'anfield_heel', startup: 0.05, active: 0.1, recovery: 0.32, dmg: 14, reach: 1.25, arc: 1.1, kb: 5, stun: 0.6, knockdown: true, launch: 5, unblockable: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.2, hitstop: 0.1, shake: 5, score: 0 });
registerAttack('anfield_lenny_kick', { pose: 'dropkick', startup: 0.3, active: 0.3, recovery: 0.45, dmg: 14, reach: 1.1, arc: 0.9, kb: 6, stun: 0.6, knockdown: true, launch: 3, lunge: 8.5, telegraph: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.1, hitstop: 0.1, shake: 5, score: 0 });

// ------------------------------------------------------------------ looks
function urchinLook(rng) {
  const L = casualLook(rng, { a: RED, b: WHITE, hatChance: 0.25, hair: ['curtains', 'mod', 'crop', 'shaved'] });
  L.jacket = rng.pick([
    { style: 'parka', color: rng.pick(['#2a3a4a', '#4a3a2a', '#1e2a22']) },
    { style: 'track', color: rng.pick(['#1a1a20', RED, '#2a3a6a']), trim: rng.pick([WHITE, YEL]) },
    { style: 'harrington', color: rng.pick(['#c8b48a', '#1d2742', '#3a3a3e']), lining: RED },
    { style: 'hoodie', color: rng.pick(['#26262c', '#6a6e78']) },
  ]);
  L.scarf = rng.chance(0.55) ? { a: RED, b: rng.chance(0.5) ? WHITE : YEL } : null;
  return L;
}
function scallyLook(rng) {
  const c = rng.pick(PASTEL), c2 = rng.pick(PASTEL);
  return {
    skin: rng.pick(['#f0c098', '#e2a97a', '#f4d0b0', '#d49a6a']),
    hair: { style: rng.pick(['curtains', 'mod', 'crop', 'shaved']), color: rng.pick(['#3a2717', '#141016', '#6a4a2a', '#b4521c']) },
    facial: rng.pick(['none', 'none', 'stubble']),
    hat: rng.chance(0.55) ? { style: rng.pick(['bucket', 'bucket', 'cap']), color: rng.pick(['#e8e0cc', c2, '#1a1a20']) } : null,
    shades: rng.chance(0.15),
    jacket: { style: 'track', color: c, trim: rng.pick([WHITE, '#1a1a20', c2]) },
    shirt: rng.pick([WHITE, c2, RED]),
    pants: { style: 'trackies', color: rng.pick([c, '#1a1a22', '#2a3a6a']) },
    shoes: { color: rng.pick(['#f4f4f0', '#e8e0c8', '#c8e0f0', '#f0d8a0']), sole: rng.pick(['#c8a868', '#e8e8e8', '#3a7ad8']) },  // the trainers you can't buy here
    scarf: null, bag: rng.chance(0.5),
    build: rng.range(0.88, 1.0), height: rng.range(0.94, 1.0),
  };
}

// ------------------------------------------------------------------ regulars
registerEnemy('anfield_urchin', {
  name: 'URCHIN', hp: 48, speed: 2.8, runSpeed: 5.0, power: 0.95, score: 150,
  look: urchinLook,
  ai: { aggression: 0.6, reaction: 0.32, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.14, dodgeChance: 0.06, runChance: 0.35, keepDist: 2.3, useWeapons: true, taunt: 0.1,
    shouts: { aggro: ['OI! WOOLLYBACK!', 'THERE THEY ARE!', 'ROAD END!'], taunt: ['COME ED!', 'GO \'ED THEN!', 'YER NOT IN NORDHAMN NOW!', 'URCHINS!'], hurt: ['ME NOSE LA!', 'OW!'] } },
  drops: [['coin', 0.5], ['pint', 0.08], ['anfield_chips', 0.05]],
});

registerEnemy('anfield_bottler', {
  name: 'OFFIE MERCHANT', hp: 36, speed: 2.7, power: 0.75, score: 160,
  look: rng => ({ ...urchinLook(rng), jacket: { style: 'parka', color: rng.pick(['#3e4530', '#2a3a4a']) } }),
  ai: { aggression: 0.35, reaction: 0.42, attacks: [['jab', 2], ['slap', 1]], throwChance: 0.5, throwCd: 2.6, projectile: 'bottle', keepDist: 4.2, kite: true, taunt: 0.06,
    shouts: { aggro: ['EMPTIES!'], taunt: ['CATCH LA!', 'HAVE THAT!', 'ONE FOR YOU!'] } },
  drops: [['bottle', 0.45], ['coin', 0.4]],
});

// ------------------------------------------------------------------ UNIQUE: the scally (nicks things and runs)
const LOOTABLE = new Set(['heal', 'cash', 'weapon']);
function stealFromPlayer(f, world, p) {
  const d = f.data;
  if (p.weapon) {
    if (f.weapon) world.dropWeapon(f);
    f.weapon = p.weapon; p.weapon = null;
    popup(world, f, 'NICKED!', '#ff9ad0');
    world.toast('A SCALLY NICKED YOUR ' + (f.weapon.def.name || 'WEAPON') + '! FLOOR HIM!');
  } else if (world.game && world.game.cash >= 5) {
    world.game.cash -= 5; d.loot.push('cash5');
    popup(world, f, '£5 NICKED!', '#ff9ad0');
    world.toast('YOUR FIVER! FLOOR HIM TO GET IT BACK');
  } else { popup(world, f, 'SKINT, YOU!', '#ff9ad0'); return; }
  world.sfx('pickupWeapon', f);
  d.runT = 3.2;
}
registerEnemy('anfield_scally', {
  name: 'SCALLY', hp: 40, speed: 3.2, runSpeed: 5.9, power: 0.8, score: 190,
  look: scallyLook,
  ai: { aggression: 0.55, reaction: 0.26, attacks: [['jab', 3], ['lowKick', 2], ['kick', 1]], comboLen: [1, 3], blockChance: 0.05, dodgeChance: 0.32, flank: 0.8, runChance: 0.5, keepDist: 2.6, taunt: 0.14,
    shouts: { aggro: ['NICE TRAINERS. GIZ.', 'ALRIGHT LA?', 'SOUND, THIS.'], taunt: ['CALM DOWN, CALM DOWN!', 'DEAD SLOW YOU!', 'SCALLY LADS!', 'AVIN\' THAT!', 'BOSS, THAT.'], hurt: ['ME KECKS!', 'NOT THE FACE LA!'] } },
  drops: [['coin', 0.5], ['cash5', 0.15]],
  onSpawn(f) { f.data.loot = []; f.data.nickCd = 1.5 + Math.random() * 2; },
  onDeath(f, world) {
    for (const id of f.data.loot || []) world.spawnItem(id, f.x, f.y, 0.5, { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: 4, pickDelay: 0.3, life: 25 });
    if ((f.data.loot || []).length || f.weapon) popup(world, f, 'GIVE IT BACK!', '#7aff9a');
  },
  think(f, world, dt, ai) {
    const p = world.player, d = f.data;
    if (!p || !p.alive) return false;
    d.loot ||= [];
    d.nickCd = (d.nickCd ?? 2) - dt;
    // the swipe connects on its active frame
    if (f.attack && f.attack.name === 'anfield_snatch') {
      if (f.attack.phase >= 1 && !f.attack.fired) {
        f.attack.fired = true;
        if (dist2(f, p) < 1.45 && p.invuln <= 0 && p.state !== 'dodge' && !p.isDown) stealFromPlayer(f, world, p);
      }
      return false;
    }
    if (!ai.aggro || ai.goal) return false;
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 1;
    // legging it with the swag
    if (d.runT > 0) {
      d.runT -= dt;
      if (!f.canAct) return false;
      if (Math.random() < dt * 0.8) popup(world, f, ['TA-RA!', 'LEG IT!', 'CAN\'T CATCH ME!'][Math.floor(Math.random() * 3)], '#ff9ad0');
      let ax = -dx / dist, ay = -dy / dist;
      if (world.heightAt(f.x + ax * 0.6, f.y + ay * 0.6) > 0.35) { const s = (f.id % 2 ? 1 : -1); ax = -dy / dist * s; ay = dx / dist * s; }
      f.intent.mx = ax; f.intent.my = ay; f.intent.run = true; f.intent.block = false;
      world.releaseToken(f);
      return true;
    }
    if (!f.canAct || d.nickCd > 0) return false;
    // go for whatever is lying about
    const tgt = d.grab;
    if (tgt && (tgt.removed || dist2(f, tgt) > 7)) d.grab = null;
    if (!d.grab && Math.random() < dt * 2) {
      let best = null, bd = 5;
      for (const it of world.items) {
        if (it.removed || !it.def || !LOOTABLE.has(it.def.kind) || it.z > 0.5 || it.data && it.data.pickDelay > 0) continue;
        const dd = dist2(f, it);
        if (dd < bd && dist2(p, it) > 1.2) { bd = dd; best = it; }
      }
      d.grab = best;
    }
    if (d.grab) {
      const it = d.grab;
      if (dist2(f, it) < 0.6) {
        if (it.def.kind === 'weapon') { if (f.weapon) world.dropWeapon(f); world.pickupWeapon(f, it); }
        else { it.removed = true; d.loot.push(it.type); f.setState('pickup'); }
        popup(world, f, 'TA VERY MUCH!', '#ff9ad0');
        world.sfx('pickup', f);
        d.grab = null; d.runT = 2.4; d.nickCd = 5;
        return true;
      }
      ai.moveToward(f, world, it.x, it.y, dt, true);
      return true;
    }
    // pick your pocket / nick your weapon
    if (dist < 1.25 && (p.weapon || (world.game && world.game.cash >= 5)) && Math.random() < dt * 3) {
      d.nickCd = 6 + Math.random() * 3;
      f.face2(dx, dy); f.intent.attackName = 'anfield_snatch'; f.intent.block = false;
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ UNIQUE: back-alley lad (vaults the yard walls)
registerEnemy('anfield_alleylad', {
  name: 'BACK-ALLEY LAD', hp: 52, speed: 3.0, runSpeed: 5.4, power: 1.0, score: 180,
  look: rng => {
    const L = urchinLook(rng);
    L.jacket = rng.pick([{ style: 'hoodie', color: rng.pick(['#1a1a20', '#3a3a44', '#2a3a2a']) }, { style: 'bomber', color: '#1a1a20', lining: RED }, { style: 'track', color: '#26262c', trim: RED }]);
    L.hood = rng.chance(0.5); L.mask = rng.chance(0.4) ? 'snood' : null; L.maskColor = '#1a1a20';
    return L;
  },
  ai: { aggression: 0.7, reaction: 0.28, attacks: [['jab', 2], ['cross', 2], ['kick', 2], ['lowKick', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.08, runChance: 0.5, keepDist: 2.2, useWeapons: true,
    rushChance: 0.2, rushAttack: 'shoulder', taunt: 0.1,
    shouts: { aggro: ['OVER THE WALL LADS!', 'IN THE JIGGER!'], taunt: ['OUR ALLEY, THIS!', 'YOU LOST, LA?', 'NO WAY OUT!'], rush: ['AVE IT!', 'GO \'ED!'] } },
  drops: [['coin', 0.5], ['cash5', 0.12]],
  onSpawn(f, world, opts) { if (opts && opts.vault) f.data.vault = true; },
  think(f, world, dt, ai) {
    const d = f.data;
    if (d.vault && ai.goal && !d.jumped && f.onGround && f.canAct) {
      d.jumped = true;
      f.intent.jump = true;
      popup(world, f, 'OVER THE WALL!', '#ffb04a');
    }
    return false;
  },
});

// ------------------------------------------------------------------ UNIQUE: the big Kop terrace lad
registerEnemy('anfield_koplad', {
  name: 'KOP TERRACE LAD', hp: 100, speed: 2.1, runSpeed: 4.2, power: 1.1, weight: 1.9, superArmor: 7, guard: 55, score: 320,
  look: rng => {
    const L = casualLook(rng, { a: RED, b: WHITE, build: rng.range(1.4, 1.55), height: 1.14, hair: ['skinhead', 'shaved', 'crop'], maskChance: 0.1 });
    L.jacket = rng.pick([{ style: 'tee', color: RED }, { style: 'vest', color: '#e8e4d8' }, { style: 'parka', color: '#2a2a30' }]);
    L.shirt = RED; L.scarf = { a: RED, b: WHITE };
    return L;
  },
  ai: { aggression: 0.5, reaction: 0.5, attacks: [['haymaker', 3], ['anfield_sway', 2], ['push', 1], ['bodySlam', 1]], comboLen: [1, 1], blockChance: 0.12, grabChance: 0.14, keepDist: 2.0, taunt: 0.1,
    shouts: { aggro: ['YOU\'RE ON MY STEP.'], taunt: ['I\'VE STOOD ON THE KOP SINCE I WAS SIX.', 'COME HERE, WOOLLY.', 'SWAY WITH US!'], hurt: ['...IS THAT IT?'] } },
  drops: [['anfield_scouse', 0.3], ['cash5', 0.25]],
});

// ------------------------------------------------------------------ ELITE: Urchins top boy (sidestep + kick)
registerEnemy('anfield_topboy', {
  name: 'URCHINS TOP BOY', hp: 80, speed: 3.1, runSpeed: 5.5, power: 1.12, guard: 60, score: 420,
  look: rng => ({
    skin: rng.pick(['#e2a97a', '#f0c098', '#d49a6a']),
    hair: { style: rng.pick(['curtains', 'mod']), color: rng.pick(['#141016', '#3a2717', '#6a4a2a']) },
    facial: rng.pick(['none', 'stubble']),
    hat: rng.chance(0.3) ? { style: 'bucket', color: '#e8e0cc' } : null,
    shades: rng.chance(0.4),
    jacket: rng.pick([{ style: 'parka', color: '#d8ccb0' }, { style: 'harrington', color: '#1a1a22', lining: RED }, { style: 'track', color: rng.pick(PASTEL), trim: '#1a1a20' }]),
    shirt: rng.pick([WHITE, '#e8d8a8', RED]),
    pants: { style: 'jeans', color: rng.pick(['#2a3346', '#c8c0a8', '#1e1e26']) },
    shoes: { color: rng.pick(['#f4f4f0', '#c8e0f0', '#f0d8a0']), sole: '#c8a868' },
    scarf: null, build: rng.range(1.05, 1.2), height: rng.range(1.0, 1.06),
  }),
  ai: { aggression: 0.62, reaction: 0.24, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['roundhouse', 1]], comboLen: [2, 4], blockChance: 0.18, dodgeChance: 0.35, grabChance: 0.05, keepDist: 2.2, taunt: 0.12,
    shouts: { aggro: ['YOU\'VE COME A LONG WAY TO GET BATTERED.'], taunt: ['TOO SLOW, LA.', 'BOSS TRAINERS, THESE.', 'ROAD END!'] } },
  drops: [['cash20', 0.25], ['pint', 0.2]],
  think(f, world, dt, ai) {
    const p = world.player, d = f.data;
    if (!p || !p.alive) return false;
    if (f.state === 'dodge') { d.slipped = true; return false; }
    if (d.slipped && f.canAct) {
      d.slipped = false;
      if (dist2(f, p) < 1.9) {
        f.face2(p.x - f.x, p.y - f.y);
        f.intent.attackName = 'anfield_sidekick'; f.intent.block = false; f.intent.mx = f.intent.my = 0;
        popup(world, f, 'SLIPPY!', '#ff9a3a');
        return true;
      }
    }
    return false;
  },
});

// ------------------------------------------------------------------ BOSS: LENNY "THE JIGGER"
// Pattern (every ~4.5s, 3.2s once he's raging), in a fixed rotation so it can be learned:
//   1 SLIPPY STANCE  he shuffles on the spot ("COME ON THEN, LA..."). Swing at him and he dodge-rolls round you and
//                    back-heels you (unblockable). Wait it out, or throw something.
//   2 TRAINER FLASH  he lifts a foot to show off the trainers ("SEEN THESE?"), they glint. Hit him in the first moment
//                    and he's ruined them (stunned); hang about close and the glint DAZZLES you, then a flying kick.
//   3 WEAPON SWIPE   he sprints for anything lying on the floor ("TA VERY MUCH!"), or nicks the one in your hand.
//   At 75/50/25% health (and every 15s once raging) he CALLS THE KOP: arms up, then a red-chevron band appears and
//   a surge of fans pours over the fence across it. Get out of the band. It flattens his own lads too.
function arenaBox(world) { return (world.level.boss && world.level.boss.lockArea) || { x: 0, y: 0, w: 99, h: 99 }; }
function kopThrows(world, n) {
  const A = arenaBox(world);
  const types = ['bottle', 'brick', 'bottle', 'umbrella'];
  for (let i = 0; i < n; i++) {
    const x = A.x + 2 + Math.random() * (A.w - 3), y = A.y + 1.5 + Math.random() * (A.h - 3);
    if (world.heightAt(x, y) > 0.3) continue;
    world.spawnItem(types[Math.floor(Math.random() * types.length)], x, y, 3.5, { vz: 1, pickDelay: 0.6, life: 30 });
  }
}
registerEnemy('anfield_lenny', {
  name: 'LENNY THE JIGGER', boss: true, hp: 640, speed: 3.2, runSpeed: 5.8, power: 1.15, weight: 1.6, superArmor: 6, guard: 80, score: 6500, ungrabbable: true,
  look: {
    skin: '#f0c098', hair: { style: 'curtains', color: '#3a2717' }, facial: 'stubble',
    hat: { style: 'bucket', color: '#e8e0cc' },
    jacket: { style: 'track', color: '#9ad0e8', trim: '#f4f4f0' }, shirt: '#f4f4f0',
    pants: { style: 'trackies', color: '#9ad0e8' }, shoes: { color: '#f4f4f0', sole: '#3a7ad8' },
    scarf: null, bag: true, build: 1.12, height: 1.12,
  },
  ai: { aggression: 0.6, reaction: 0.26, attacks: [['jab', 3], ['cross', 2], ['lowKick', 2], ['kick', 2], ['roundhouse', 1]], comboLen: [2, 4], blockChance: 0.1, dodgeChance: 0.28, ignoreTokens: true, keepDist: 2.4, useWeapons: true, taunt: 0.04, shouts: false },
  drops: [['anfield_scouse', 1], ['cash20', 1]],
  onSpawn(f) { f.tauntAnim = 'taunt3'; f.data.surgeImmune = true; f.say && f.say('ALRIGHT LA. LOST?', 1.8); },
  think(f, world, dt, ai) {
    const p = world.player, d = f.data;
    if (!p || !p.alive) return false;
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 1;
    if (!d.init) { d.init = true; d.surgeAt = [0.75, 0.5, 0.25]; d.cycle = 0; ai.spCd = 3; d.kopT = 15; }
    const fast = !!d.phase2;
    const hurt = f.state === 'hurt' || f.isDown;

    // ---- phase 2: the trackie top comes off
    if (!d.phase2 && f.hp < f.maxHp * 0.4) {
      d.phase2 = true;
      f.look = normalizeLook({ ...f.look, jacket: { style: 'tee', color: '#f4f4f0' }, hat: null, __norm: undefined });
      f.speed *= 1.12; f.runSpeed *= 1.08; f.superArmor += 2;
      world.message('LENNY\'S TRAINERS ARE SCUFFED', 'NOW HE\'S RAGING', 2, '#ff6a4a');
      world.sfx('bossRoar', f);
      world.fx.debris(f.x, f.y, 1.2, ['#9ad0e8', '#e8e0cc'], 8);
    }
    // ---- his lads, once, under 55%
    if (!d.called && f.hp < f.maxHp * 0.55 && f.canAct) {
      d.called = true;
      f.say && f.say('SCALLIES! GET IN \'ERE!', 1.6);
      world.sfx('bossRoar', f);
      const A = arenaBox(world);
      world.spawnEnemy('anfield_scally', A.x + A.w - 2, A.y + 3, { from: { x: A.x + A.w + 0.5, y: A.y + 3 }, aggro: true });
      world.spawnEnemy('anfield_scally', A.x + A.w - 2, A.y + A.h - 3, { from: { x: A.x + A.w + 0.5, y: A.y + A.h - 3 }, aggro: true });
    }

    // ---- CALL THE KOP (arms up, then the surge)
    if (d.call > 0) {
      d.call -= dt;
      f.intent.mx = f.intent.my = 0; f.intent.block = false; f.face2(dx, dy);
      if (hurt && d.call > 0.4) d.call = 0.4;      // can't stop the Kop once it's going
      if (d.call <= 0) {
        spawnKopSurge(world, p.y, { warn: fast ? 1.25 : 1.5 });
        if (fast) setTimeout0(world, 1.6, () => { if (live(f) && world.player) spawnKopSurge(world, world.player.y, { warn: 1.3 }); });
        kopThrows(world, fast ? 3 : 2);
        world.message('THE KOP SURGES!', 'GET OUT OF THE RED!', 1.6, '#ff3a2a');
        ai.spCd = Math.max(ai.spCd, 2.5);
      }
      return true;
    }
    d.kopT -= dt;
    if (f.canAct && ((d.surgeAt.length && f.hp < f.maxHp * d.surgeAt[0]) || (fast && d.kopT <= 0))) {
      if (d.surgeAt.length && f.hp < f.maxHp * d.surgeAt[0]) d.surgeAt.shift();
      d.kopT = 15; d.call = 1.1; d.stance = 0; d.flash = 0;
      f.tauntAnim = ANIM_CHEER; f.intent.taunt = true;
      f.say && f.say('KOP! SWAY FOR ME!', 1.4);
      world.message('LENNY CALLS THE KOP!', '', 1.2, '#ff6a4a');
      world.sfx('crowdCheer', f); world.sfx('bossRoar', f);
      kopState(world).surge = 2.6;
      return true;
    }

    // ---- TRAINER FLASH
    if (d.flash > 0) {
      d.flash -= dt;
      if (hurt) {
        if (d.flash > 0.6) { popup(world, f, 'ME TRAINERS!', '#ff6a4a'); f.stunT = Math.max(f.stunT, 0.9); }
        d.flash = 0; return false;
      }
      f.intent.mx = f.intent.my = 0; f.intent.block = false; f.face2(dx, dy);
      if (Math.random() < dt * 14) world.fx.spark(f.x + f.fx * 0.3, f.y + f.fy * 0.3, 0.3, '#ffffff', 3);
      if (d.flash <= 0) {
        if (dist < 2.7 && p.invuln <= 0 && !p.isDown && p.state !== 'grabbed' && p.state !== 'thrown') {
          p.attack = null; p.setState('dizzy'); p.stunT = 0.85;
          world.fx.popup(p.x, p.y, p.z + 0.6, 'DAZZLED!', '#ffffff');
          world.fx.spark(f.x, f.y, 0.4, '#ffffff', 16);
          world.sfx('combo', f);
          d.kickQ = true;
        } else popup(world, f, 'PEASANT.', '#a0e0ff');
      }
      return true;
    }
    if (d.kickQ) {
      if (f.canAct) { d.kickQ = false; f.face2(dx, dy); f.intent.attackName = 'anfield_lenny_kick'; popup(world, f, 'HAVE SOME!', '#ff8a3a'); }
      return true;
    }

    // ---- SLIPPY STANCE -> dodge-roll counter
    if (d.stance > 0) {
      d.stance -= dt;
      if (hurt) { d.stance = 0; return false; }
      f.face2(dx, dy); f.intent.block = false;
      // shuffle side to side
      const s = Math.sin(world.time * 9) > 0 ? 1 : -1;
      f.intent.mx = -dy / dist * s * 0.35; f.intent.my = dx / dist * s * 0.35;
      const swinging = p.state === 'attack' && p.attack && dist < 2.2 && ((p.fx * -dx + p.fy * -dy) / dist) > 0.3;
      if (swinging && f.canAct) {
        d.stance = 0; d.rollQ = 0.35;
        const side = Math.random() < 0.5 ? 1 : -1;
        f.intent.dodge = true;
        f.intent.mx = -dy / dist * side + dx / dist * 0.6; f.intent.my = dx / dist * side + dy / dist * 0.6;   // round you
        popup(world, f, 'TOO SLIPPY!', '#a0e0ff');
      }
      return true;
    }
    if (d.rollQ > 0) {
      d.rollQ -= dt;
      if (f.canAct) { d.rollQ = 0; f.face2(p.x - f.x, p.y - f.y); f.intent.attackName = 'anfield_lenny_heel'; world.sfx('whooshBig', f); return true; }
      return f.state === 'dodge';
    }

    // ---- WEAPON SWIPE (run for it)
    if (d.swipe) {
      const it = d.swipe;
      d.swipeT -= dt;
      if (it.removed || f.weapon || d.swipeT <= 0) { d.swipe = null; return false; }
      if (!f.canAct) return false;
      if (dist2(f, it) < 0.65) { world.pickupWeapon(f, it); popup(world, f, 'TA VERY MUCH!', '#a0e0ff'); d.swipe = null; return true; }
      ai.moveToward(f, world, it.x, it.y, dt, true);
      return true;
    }
    if (f.attack && f.attack.name === 'anfield_snatch') {
      if (f.attack.phase >= 1 && !f.attack.fired) {
        f.attack.fired = true;
        if (dist < 1.5 && p.weapon && p.invuln <= 0 && p.state !== 'dodge') {
          if (f.weapon) world.dropWeapon(f);
          f.weapon = p.weapon; p.weapon = null;
          popup(world, f, 'MINE NOW!', '#a0e0ff'); world.toast('LENNY NICKED YOUR WEAPON!');
        }
      }
      return false;
    }

    // ---- choose the next special
    ai.spCd -= dt;
    if (!f.canAct || ai.spCd > 0 || ai.goal) return false;
    ai.spCd = fast ? 3.2 + Math.random() : 4.5 + Math.random() * 1.5;
    if (p.weapon && dist < 1.4) {
      f.face2(dx, dy); f.intent.attackName = 'anfield_snatch'; popup(world, f, 'GIZ THAT!', '#a0e0ff');
      return true;
    }
    const pickN = d.cycle++ % 3;
    if (pickN === 2 && !f.weapon) {
      let best = null, bd = 9;
      for (const it of world.items) if (!it.removed && it.def && it.def.kind === 'weapon' && it.z < 0.5 && dist2(f, it) < bd) { bd = dist2(f, it); best = it; }
      if (best) { d.swipe = best; d.swipeT = 3; f.say && f.say('OOH, THAT\'S MINE.', 1.1); return true; }
    }
    if (pickN === 1 || (pickN === 2 && dist >= 3.6)) {
      d.flash = 1.35;
      f.tauntAnim = 'taunt3'; f.intent.taunt = true;
      f.say && f.say('SEEN THESE? YOU CAN\'T GET THEM HERE.', 1.3);
      world.message('TRAINER FLASH!', 'HIT HIM QUICK OR BACK OFF', 1.1, '#a0e0ff');
      return true;
    }
    d.stance = 1.7;
    f.say && f.say('COME ON THEN, LA...', 1.3);
    world.message('SLIPPY STANCE', 'DON\'T SWING AT HIM', 1.0, '#a0e0ff');
    return true;
  },
});
const ANIM_CHEER = 'cheer';

// tiny per-world timer queue (the boss' double surge); ticked by the level's onUpdate via tickTimers
function setTimeout0(world, t, fn) { (world.__anfTimers ||= []).push({ t, fn }); }
export function tickTimers(world, dt) {
  const q = world.__anfTimers;
  if (!q || !q.length) return;
  for (let i = q.length - 1; i >= 0; i--) { q[i].t -= dt; if (q[i].t <= 0) { const fn = q[i].fn; q.splice(i, 1); fn(); } }
}
