// IBROX — enemies of the ICF (Rangers' Inter City Firm) and the boss. Every id starts with 'ibrox_'.
// All named characters are invented.
//
//   ibrox_gers       ICF LAD             the everyday Govan casual in royal blue
//   ibrox_spotter    SUBWAY SPOTTER      anorak and flask: keeps his distance, lobs bottles and, if you leave him
//                                        alone for a few seconds, SHOUTS UP a reinforcement. Deck him first.
//   ibrox_closemouth CLOSE MOUTH LAD     ambusher out of the tenement closes: flanks you and throws a SUCKER PUNCH
//                                        (lunge) the moment your back is turned
//   ibrox_hardman    SHIPYARD HARD MAN   huge and slow, super armour, a telegraphed RIVET HAMMER. He's grabbable:
//                                        get a lad to pin him (GRAB HIM!) and DOUBLE TEAM him
//   ibrox_icf        ICF TOP BOY         elite: blocks, then answers with a NUT (headbutt counter)
//   ibrox_shuggie    BIG SHUGGIE "THE RIVET" McGLASHAN — BOSS. A Govan hard man in a huge parka.
//                    GLASGOW KISS (lunging headbutt), RAIN SLIDE (slide tackle across the wet forecourt),
//                    FISH SUPPER (thrown; three at once when he's raging), and he whistles up the close mouth lads.

import { registerEnemy, casualLook } from '../../enemies.js';
import { registerAttack } from '../../../game/combat.js';
import { normalizeLook } from '../../../game/doll.js';
import { ROYAL, RED, WHITE } from './theme.js';

const live = f => !!f && f.alive && f.hp > 0 && !f.removed;
function popup(world, f, text, color = '#ffe14a') { world.fx.popup(f.x, f.y, f.z + 0.5, text, color); }

// ------------------------------------------------------------------ attacks
registerAttack('ibrox_sucker', { pose: 'chargePunch', startup: 0.16, active: 0.12, recovery: 0.4, dmg: 10, reach: 1.0, arc: 0.9, kb: 3, stun: 0.5, lunge: 7, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.6, hitstop: 0.06, shake: 3, score: 0 });
registerAttack('ibrox_nut', { pose: 'headbutt', startup: 0.08, active: 0.08, recovery: 0.3, dmg: 11, reach: 0.95, arc: 0.9, kb: 3, stun: 0.65, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.8, hitstop: 0.09, shake: 4, score: 0 });
registerAttack('ibrox_rivet', { pose: 'slam', startup: 0.62, active: 0.1, recovery: 0.6, dmg: 16, reach: 1.3, arc: 1.0, kb: 4.5, stun: 0.6, knockdown: true, launch: 2, telegraph: true, guardDmg: 35, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.1, shake: 6, score: 0 });
// boss
registerAttack('ibrox_kiss', { pose: 'headbutt', startup: 0.55, active: 0.16, recovery: 0.65, dmg: 18, reach: 1.05, arc: 0.9, kb: 5, stun: 0.7, knockdown: true, launch: 2.5, lunge: 6.5, lungeActive: true, telegraph: true, guardDmg: 45, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.8, hitstop: 0.12, shake: 7, score: 0 });
registerAttack('ibrox_slide', { pose: 'sweep', startup: 0.6, active: 0.55, recovery: 0.85, dmg: 14, reach: 1.15, arc: 1.0, kb: 5, stun: 0.6, knockdown: true, launch: 2, lunge: 10, lungeActive: true, telegraph: true, guardDmg: 30, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 0.4, hitstop: 0.1, shake: 5, score: 0 });
registerAttack('ibrox_toss', { pose: 'throwItem', startup: 0.42, active: 0.06, recovery: 0.36, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, whiff: 'whoosh' });
registerAttack('ibrox_haymaker', { pose: 'haymaker', startup: 0.22, active: 0.1, recovery: 0.32, dmg: 13, reach: 1.15, arc: 1.0, kb: 3.5, stun: 0.5, knockdown: true, launch: 1.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.08, shake: 4, score: 0 });

// ------------------------------------------------------------------ looks
const govan = (rng, o = {}) => {
  const L = casualLook(rng, { a: ROYAL, b: WHITE, hatChance: 0.3, ...o });
  if (L.scarf) L.scarf = rng.chance(0.75) ? { a: ROYAL, b: WHITE } : { a: ROYAL, b: RED };
  if (L.maskColor && L.maskColor !== '#141416' && L.maskColor !== '#1c1c20') L.maskColor = ROYAL;
  return L;
};

// ------------------------------------------------------------------ ICF LAD
registerEnemy('ibrox_gers', {
  name: 'ICF LAD', hp: 50, speed: 2.8, runSpeed: 5.0, power: 1.0, score: 150,
  look: rng => {
    const L = govan(rng);
    if (rng.chance(0.35)) L.jacket = { style: 'harrington', color: rng.pick(['#1d2742', '#c8b48a', '#2a2a30']), lining: RED };
    return L;
  },
  ai: { aggression: 0.62, reaction: 0.3, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.14, dodgeChance: 0.05, runChance: 0.35, keepDist: 2.3, useWeapons: true, taunt: 0.12,
    shouts: { aggro: ['HERE THEY ARE!', 'GET INTAE THEM!', 'ICF!'], taunt: ['LONG WAY HAME, PAL!', 'ENJOY THE WEATHER?', 'YER COACH IS LEAVING!', 'COME AHEAD THEN!'], hurt: ['MA NOSE!', 'AYYYA!'] } },
  drops: [['coin', 0.5], ['ibrox_ginger', 0.08]],
});

// ------------------------------------------------------------------ SUBWAY SPOTTER
registerEnemy('ibrox_spotter', {
  name: 'SUBWAY SPOTTER', hp: 30, speed: 2.9, runSpeed: 5.2, power: 0.7, score: 160,
  look: rng => ({ ...govan(rng, { scarf: null, hatChance: 0.7 }), jacket: { style: 'parka', color: rng.pick(['#2a3a28', '#3a3a2a', '#1a2a3a']) }, hood: true, mask: null, bag: true }),
  ai: { aggression: 0.35, reaction: 0.42, attacks: [['jab', 2], ['slap', 1], ['lowKick', 1]], throwChance: 0.5, throwCd: 2.4, projectile: 'bottle', keepDist: 4.4, kite: true, taunt: 0.08,
    shouts: { aggro: ['THERE THEY ARE!', 'SPOTTED!'], taunt: ['I\'VE SEEN YE!', 'AWAY BUS, NUMBER 9!', 'NOTED!'] } },
  drops: [['bottle', 0.3], ['coin', 0.4]],
  think(f, world, dt, ai) {
    const p = world.player, d = f.data;
    if (!p || !p.alive || !ai.aggro) return false;
    d.watch = (d.watch || 0) + dt;
    if (!d.called && d.watch > 5.5 && f.canAct && f.hp > f.maxHp * 0.35) {
      d.called = true;
      const dx = f.x - p.x, dy = f.y - p.y, dd = Math.hypot(dx, dy) || 1;
      const fx = Math.max(1, Math.min(world.map.w - 2, f.x + dx / dd * 5)), fy = Math.max(1, Math.min(world.map.h - 2, f.y + dy / dd * 5));
      world.spawnEnemy('ibrox_gers', f.x, f.y, { from: { x: fx, y: fy }, aggro: true });
      popup(world, f, 'OVER HERE, LADS!', '#a8c8ff');
      world.toast('THE SPOTTER SHOUTED UP REINFORCEMENTS. DECK THE SPOTTERS FIRST!');
      f.intent.taunt = true;
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ CLOSE MOUTH LAD
registerEnemy('ibrox_closemouth', {
  name: 'CLOSE MOUTH LAD', hp: 42, speed: 3.1, runSpeed: 5.6, power: 0.95, score: 170,
  look: rng => {
    const L = govan(rng, { scarf: null, hoodChance: 0.7, maskChance: 0.6 });
    L.jacket = rng.pick([{ style: 'track', color: rng.pick(['#14204a', '#1a1a22', ROYAL]), trim: WHITE }, { style: 'hoodie', color: rng.pick(['#1a1a22', '#2a2e3a']) }]);
    return L;
  },
  ai: { aggression: 0.7, reaction: 0.28, attacks: [['jab', 3], ['kick', 2], ['lowKick', 2], ['cross', 1]], comboLen: [2, 3], dodgeChance: 0.16, flank: 1.0, runChance: 0.45, keepDist: 2.6, useWeapons: true, taunt: 0.06,
    shouts: { aggro: ['NOW!', 'OOT THE CLOSE!'], taunt: ['BEHIND YE!', 'WATCH YER BACK!', 'BOO!'] } },
  drops: [['cash5', 0.2], ['coin', 0.3]],
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !p.alive || !ai.aggro || ai.goal) return false;
    ai.suckCd = (ai.suckCd ?? 1.5 + Math.random() * 2) - dt;
    if (ai.suckCd > 0 || !f.canAct || p.isDown) return false;
    const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
    const behind = (p.fx * dx + p.fy * dy) / d < -0.25;          // he's behind you
    if (behind && d > 1.2 && d < 3.8) {
      ai.suckCd = 4 + Math.random() * 2;
      f.face2(-dx, -dy);
      f.intent.mx = f.intent.my = 0; f.intent.block = false;
      f.intent.attackName = 'ibrox_sucker';
      popup(world, f, 'SUCKER!', '#ff8a4a');
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ SHIPYARD HARD MAN
registerEnemy('ibrox_hardman', {
  name: 'SHIPYARD HARD MAN', hp: 125, speed: 1.9, runSpeed: 3.4, power: 1.2, weight: 2.4, superArmor: 10, guard: 60, score: 450,
  look: rng => ({
    ...govan(rng, { scarf: null, hatChance: 0 }),
    hair: { style: rng.pick(['skinhead', 'shaved', 'crop']), color: rng.pick(['#3a2717', '#6a6a6a', '#b4521c']) },
    facial: rng.pick(['beard', 'tache', 'stubble']),
    jacket: rng.pick([{ style: 'bomber', color: '#1a2a4a', lining: RED }, { style: 'parka', color: '#2a3440' }, { style: 'tee', color: '#2a2a30' }]),
    shirt: ROYAL, pants: { style: 'jeans', color: '#2a3a5a' }, shoes: { color: '#3a2a1a', sole: '#222' },
    mask: null, hood: false, gloves: null, build: rng.range(1.5, 1.65), height: rng.range(1.15, 1.22),
  }),
  ai: { aggression: 0.5, reaction: 0.5, attacks: [['ibrox_rivet', 2], ['haymaker', 2], ['push', 2], ['bodySlam', 1]], comboLen: [1, 1], blockChance: 0.1, grabChance: 0.1, keepDist: 1.9, taunt: 0.1,
    shouts: { aggro: ['AYE, RIGHT.'], taunt: ['A\'VE RIVETED BIGGER THAN YOU.', 'COME HERE, SON.', 'I BUILT SHIPS.'], hurt: ['...WAS THAT YOU?'] } },
  drops: [['ibrox_chips', 0.35], ['pipe', 0.2], ['cash5', 0.2]],
  onSpawn(f) { f.say && f.say('AYE, RIGHT.', 1.2); },
  think(f, world, dt, ai) {
    const a = f.attack;
    if (f.state === 'attack' && a && a.name === 'ibrox_rivet' && a.phase === 1 && !a.dusted) {
      a.dusted = true; world.fx.dust(f.x + f.fx * 0.8, f.y + f.fy * 0.8, 0, 8); world.camera.shake(4, 0.2);
    }
    if (f.state === 'attack' && a && a.name === 'ibrox_rivet' && a.phase === 0 && a.t < 0.05) popup(world, f, 'RIVET!', '#ff9a3a');
    return false;
  },
});

// ------------------------------------------------------------------ ICF TOP BOY (elite counter-puncher)
registerEnemy('ibrox_icf', {
  name: 'ICF TOP BOY', hp: 84, speed: 3.1, runSpeed: 5.4, power: 1.15, guard: 70, score: 400,
  look: rng => ({
    skin: rng.pick(['#e2a97a', '#f0c098', '#f4d0b0', '#d49a6a']),
    hair: { style: rng.pick(['mod', 'curtains', 'crop']), color: rng.pick(['#141016', '#3a2717', '#b4521c']) },
    facial: rng.pick(['none', 'stubble']),
    hat: rng.chance(0.35) ? { style: 'cap', color: rng.pick(['#e8e0cc', '#1d2742']) } : null,
    shades: rng.chance(0.4),
    jacket: rng.pick([
      { style: 'harrington', color: '#c8b48a', lining: RED },
      { style: 'track', color: ROYAL, trim: WHITE },
      { style: 'parka', color: '#d8ccb0' },
      { style: 'bomber', color: '#1a1a22', lining: ROYAL },
    ]),
    shirt: rng.pick([WHITE, ROYAL, '#e8d8a8']),
    pants: { style: 'jeans', color: rng.pick(['#2a3346', '#1e1e26']) },
    shoes: { color: rng.pick(['#f2f2ee', '#e8e0c8']), sole: '#b8a070' },
    scarf: null, build: rng.range(1.05, 1.2), height: rng.range(1.0, 1.06),
  }),
  ai: { aggression: 0.64, reaction: 0.24, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['ibrox_nut', 1]], comboLen: [2, 4], blockChance: 0.42, dodgeChance: 0.12, grabChance: 0.05, keepDist: 2.2, taunt: 0.15,
    shouts: { aggro: ['SO THIS IS NORDHAMN?'], taunt: ['NICE TRAINERS. FOR A FARMER.', 'WELCOME TAE GOVAN.', 'TAKE YER TIME.'], hurt: ['CHEEKY.'] } },
  drops: [['cash20', 0.25], ['pint', 0.2]],
  think(f, world, dt, ai) {
    const p = world.player, d = f.data;
    if (!p || !p.alive) return false;
    if (f.state === 'blockstun') { d.counter = true; return false; }
    if (d.counter) {
      if (Math.hypot(p.x - f.x, p.y - f.y) > 1.8 || f.isDown || f.state === 'hurt') { d.counter = false; return false; }
      if (f.state === 'block') { f.intent.block = false; ai.blockT = 0; f.intent.mx = f.intent.my = 0; return true; }
      if (f.canAct) {
        d.counter = false; ai.blockT = 0;
        f.face2(p.x - f.x, p.y - f.y);
        f.intent.block = false; f.intent.mx = f.intent.my = 0;
        f.intent.attackName = 'ibrox_nut';
        popup(world, f, 'THE NUT!', '#ff9a3a');
        return true;
      }
    }
    return false;
  },
});

// ------------------------------------------------------------------ BOSS: BIG SHUGGIE "THE RIVET" McGLASHAN
// Pattern (readable): he brawls with big hooks; every 4-5 s (3-4 s when raging) a special, picked by range:
//   close  -> GLASGOW KISS: rears his head back ("GLASGOW KISS!", 0.55 s, tracks you for the first half), then
//             lunges. Sidestep -> he whiffs and sees stars (free hits).
//   mid    -> RAIN SLIDE: crouches ("SLIDE!", 0.6 s) and slides across the wet forecourt in a straight line.
//             Get out of the line. If he slides into the police line or a wall he's dazed.
//   far    -> FISH SUPPER: winds up and lobs a fish supper (three in a fan when raging).
// At 65% and 30% he whistles up the close mouth lads. Under 45% the parka comes off (faster, angrier).
registerEnemy('ibrox_shuggie', {
  name: 'BIG SHUGGIE', boss: true, hp: 680, speed: 2.5, runSpeed: 4.8, power: 1.2, weight: 2.3, superArmor: 9, guard: 85, score: 7000, ungrabbable: true,
  look: {
    skin: '#e8b090', hair: { style: 'crop', color: '#b4521c' }, facial: 'beard',
    jacket: { style: 'parka', color: '#2a3a2e', trim: '#1a241c', lining: RED }, hood: true, shirt: ROYAL,
    pants: { style: 'jeans', color: '#2a3a5a' }, shoes: { color: '#f2f2ee', sole: '#c8b080' },
    scarf: { a: ROYAL, b: WHITE }, gloves: null, mask: null, build: 1.6, height: 1.3,
  },
  ai: { aggression: 0.58, reaction: 0.32, attacks: [['jab', 2], ['hook', 2], ['ibrox_haymaker', 2], ['push', 1], ['kick', 1]], comboLen: [1, 3], blockChance: 0.22, ignoreTokens: true, keepDist: 2.4, taunt: 0.04,
    shouts: false },
  drops: [['ibrox_munchy', 1]],
  onSpawn(f) { f.say && f.say('YOU\'RE A LONG WAY FAE HAME, SON.', 2.2); f.tauntAnim = 'taunt'; },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !p.alive) return false;
    const d = f.data;
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy);
    const a = f.attack;

    // ---- the parka comes off
    if (!d.raged && f.hp < f.maxHp * 0.45) {
      d.raged = true;
      f.look = normalizeLook({ ...f.look, jacket: { style: 'tee', color: ROYAL }, hood: false, __norm: undefined });
      f.speed *= 1.15; f.runSpeed *= 1.1; f.superArmor += 3;
      f.controller.ai.aggression = Math.min(0.9, f.controller.ai.aggression + 0.2);
      world.message('THE PARKA COMES OFF!', 'IN THIS WEATHER. HE\'S RAGING.', 2.2, '#ff5a3a');
      world.sfx('bossRoar', f); world.camera.shake(5, 0.4);
      world.fx.debris(f.x, f.y, 1.2, ['#2a3a2e', '#c8102e'], 8);
      ai.spCd = Math.min(ai.spCd ?? 1, 1);
    }
    // ---- whistles up the close mouth lads (65% and 30%)
    for (const [k, frac] of [['call1', 0.65], ['call2', 0.3]]) {
      if (!d[k] && f.hp < f.maxHp * frac && f.canAct) {
        d[k] = true;
        world.message('SHUGGIE WHISTLES UP THE CLOSES!', 'BACK TO BACK, LADS', 1.8, '#a8c8ff');
        world.sfx('bossRoar', f);
        const A = world.level.boss && world.level.boss.lockArea;
        const cx = A ? A.x + A.w / 2 : f.x, cy = A ? A.y + A.h / 2 : f.y;
        world.spawnEnemy('ibrox_closemouth', cx - 6, cy, { from: { x: cx - 6, y: (A ? A.y : f.y) - 2 }, aggro: true });
        world.spawnEnemy('ibrox_closemouth', cx + 6, cy + 1, { from: { x: cx + 6, y: (A ? A.y : f.y) - 2 }, aggro: true });
        if (k === 'call2') world.spawnEnemy('ibrox_gers', cx, cy + 2, { from: { x: A ? A.x + A.w + 1 : f.x + 6, y: cy + 2 }, aggro: true });
        f.intent.taunt = true;
        return true;
      }
    }

    // ---- GLASGOW KISS in progress
    if (f.state === 'attack' && a && a.name === 'ibrox_kiss') {
      if (a.phase === 0 && a.t < a.startup * 0.5) f.face2(dx, dy);
      if (a.phase === 2 && a.hit.size === 0 && !a.missed) { a.missed = true; d.dazed = 0.9; }
      return true;
    }
    // ---- RAIN SLIDE in progress
    if (f.state === 'attack' && a && a.name === 'ibrox_slide') {
      if (a.phase === 0) { if (a.t < a.startup * 0.4) f.face2(dx, dy); if (Math.random() < 0.3) world.fx.dust(f.x, f.y, 0, 1); }
      else if (a.phase === 1) {
        // spray off the wet ground
        if (Math.random() < 0.8) world.fx.add({ x: f.x - f.fx * 0.3 + (Math.random() - 0.5) * 0.4, y: f.y - f.fy * 0.3 + (Math.random() - 0.5) * 0.4, z: 0.1, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 2 + Math.random() * 2, g: 1, life: 0.5, kind: 'drop', color: Math.random() < 0.5 ? '#a8c0e0' : '#dfe8ff', size: 1 });
        // bowls over his own lads too
        for (const o of world.fighters) {
          if (o === f || o.team !== f.team || !o.alive || o.isDown) continue;
          if (Math.hypot(o.x - f.x, o.y - f.y) < 0.9) { o.knockDown({ x: f.fx, y: f.fy }, 4, 2); world.sfx('hitHeavy', o); }
        }
        if (f.blockedMove && a.t > a.startup + 0.1) {
          f.attack = null; f.setState('dizzy'); f.stunT = 1.6;
          f.vx = -f.fx * 1.2; f.vy = -f.fy * 1.2;
          world.sfx('wallSlam', f); world.camera.shake(6, 0.3);
          world.toast('SHUGGIE SLID INTO THE BARRIERS! HAVE HIM!');
          f.say('MA KNEES...', 1.2);
        }
      } else if (a.phase === 2 && a.hit.size === 0 && !a.missed) { a.missed = true; d.dazed = 0.7; }
      return true;
    }
    // ---- FISH SUPPER
    if (f.state === 'attack' && a && a.name === 'ibrox_toss') {
      if (a.phase >= 1 && !a.fired) {
        a.fired = true;
        const t = d.tossTgt || p;
        const n = d.raged ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 1.6;
          const tx = t.x + (-dy / (dist || 1)) * off, ty = t.y + (dx / (dist || 1)) * off;
          world.spawnProjectile(f, 'ibrox_supper', tx, ty, 12 * f.power);
        }
      }
      return true;
    }

    if (!f.canAct) return false;
    if (d.dazed > 0) {                               // whiffed a special: sees stars for a moment
      const t = d.dazed; d.dazed = 0;
      f.setState('dizzy'); f.stunT = t;
      popup(world, f, 'SEEIN\' STARS', '#ffe14a');
      return true;
    }

    ai.spCd = (ai.spCd ?? 3) - dt;
    if (ai.spCd > 0 || p.isDown || ai.goal) return false;
    const los = world.hasLOS(f.x, f.y, p.x, p.y);
    if (dist < 1.9) {
      ai.spCd = d.raged ? 3 + Math.random() : 4.2 + Math.random() * 1.3;
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0; f.intent.block = false;
      f.intent.attackName = 'ibrox_kiss';
      popup(world, f, 'GLASGOW KISS!', '#ff5a3a');
      world.sfx('bossRoar', f);
      return true;
    }
    if (dist > 2.6 && dist < 7.5 && los && (Math.random() < 0.6 || dist < 4)) {
      ai.spCd = d.raged ? 3 + Math.random() : 4.5 + Math.random() * 1.5;
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0; f.intent.block = false;
      f.intent.attackName = 'ibrox_slide';
      popup(world, f, 'SLIDE!', '#8ac8ff');
      f.say('IT\'S A WEE BIT WET!', 0.9);
      return true;
    }
    if (dist >= 4 && dist < 10 && los) {
      ai.spCd = d.raged ? 2.8 + Math.random() : 4 + Math.random() * 1.5;
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0; f.intent.block = false;
      d.tossTgt = { x: p.x + (p.vx || 0) * 0.35, y: p.y + (p.vy || 0) * 0.35 };
      f.intent.attackName = 'ibrox_toss';
      popup(world, f, 'FISH SUPPER!', '#ffe14a');
      f.say('HAVE YER DINNER!', 0.9);
      return true;
    }
    return false;
  },
});

export { live };
