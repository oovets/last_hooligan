// LEVEL 7 — THE DERBY: new enemies, attacks, attack poses and the twin bosses.
//
//   derby_portside  PORTSIDE LAD      tougher derby-day rival (uses weapons)
//   derby_vargby    VARGBY RAIDER     fast, aggressive away boot boy
//   derby_toplad    PORTSIDE TOP LAD  ELITE: designer gear, blocks a lot and COUNTER-ATTACKS after blocking
//   derby_ultra     VARGBY ULTRA      ELITE: keeps his distance and lobs burning flares that leave fire patches
//   derby_dez       DAPPER DEZ        BOSS (level.boss): Portside's top boy. Counter stance, designer dash, calls his lads
//   derby_bjorn     BIG BJÖRN         TWIN BOSS (boss-strength minion): Vargby's capo. Flare barrage, stampede, ground pound
//
// Tag-team: only one twin is "on point" at a time; the other hangs back (Björn lobs flares, Dez heckles).
// They swap ("TAG!") every ~10s or when the point man takes a beating. When one falls the other rages.
// The level (l7_derby.js) keeps the exit shut until BOTH are down.

import { registerEnemy, casualLook, RIVAL, AWAY, AWAY_KIT } from '../enemies.js';
import { registerAttack } from '../../game/combat.js';
import { registerAttackPose, GUARD } from '../../game/poses.js';
import { normalizeLook } from '../../game/doll.js';
import { spawnFlareShot } from '../themes/derby.js';

const G = GUARD;

// ------------------------------------------------------------------ attack poses
registerAttackPose('derby_elbow', {
  windup: { ...G, uaN: 0.35, faN: 2.5, lean: -0.12, dx: -1 },
  hit: { ...G, uaN: 1.35, faN: 2.6, lean: 0.42, dx: 4, thN: 0.5, knN: 0.3, head: 0.1 },
});
registerAttackPose('derby_upper', {
  windup: { ...G, uaN: 0.0, faN: 1.6, lean: 0.45, dy: 7, thN: 0.7, knN: 1.1, thF: -0.2, knF: 0.9 },
  hit: { ...G, uaN: 2.8, faN: 0.4, lean: -0.25, dy: -5, thN: 0.2, knN: 0.05, thF: -0.3, knF: 0.1 },
});
registerAttackPose('derby_dash', {
  windup: { lean: 0.6, dy: 5, thN: 0.9, knN: 1.6, thF: -0.6, knF: 0.9, uaN: -0.6, faN: 1.2, uaF: 0.6, faF: 1.8 },
  hit: { lean: 0.55, dx: 5, dy: 2, thN: 0.9, knN: 0.6, thF: -0.9, knF: 0.4, uaN: 1.6, faN: 0.0, uaF: 0.3, faF: 1.6 },
});
registerAttackPose('derby_charge', {
  windup: { lean: 0.55, dy: 3, thN: 0.7, knN: 0.9, thF: -0.4, knF: 0.7, uaN: 0.1, faN: 2.4, uaF: 0.2, faF: 2.3, head: 0.2 },
  hit: { lean: 0.8, dx: 5, dy: 3, thN: 0.8, knN: 0.5, thF: -0.8, knF: 0.4, uaN: 0.4, faN: 2.2, uaF: 0.4, faF: 2.2 },
});
registerAttackPose('derby_hammer', {
  windup: { ...G, uaN: 3.0, faN: 0.5, uaF: 3.0, faF: 0.5, lean: -0.3, dy: -1 },
  hit: { ...G, uaN: 1.3, faN: 0.2, uaF: 1.3, faF: 0.2, lean: 0.55, dx: 3, dy: 3, thN: 0.6, knN: 0.6 },
});
registerAttackPose('derby_quake', {
  windup: { uaN: 3.0, faN: 0.3, uaF: 3.0, faF: 0.3, lean: -0.35, dy: -4, thN: 0.9, knN: 1.6, thF: 0.0, knF: 0.0 },
  hit: { uaN: 0.8, faN: 0.4, uaF: 0.8, faF: 0.4, lean: 0.6, dy: 9, thN: 0.9, knN: 1.6, thF: -0.4, knF: 1.2 },
});
registerAttackPose('derby_toss', {
  windup: { ...G, uaN: 2.9, faN: 1.3, lean: -0.3, dx: -1 },
  hit: { ...G, uaN: 1.7, faN: 0.1, lean: 0.35, dx: 2 },
});

// ------------------------------------------------------------------ attacks
registerAttack('derby_counter', { pose: 'derby_elbow', startup: 0.04, active: 0.08, recovery: 0.26, dmg: 9, reach: 1.05, arc: 0.9, kb: 4.5, stun: 0.5, knockdown: true, launch: 2, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.6, hitstop: 0.08, shake: 4, score: 0 });
registerAttack('derby_flareToss', { pose: 'derby_toss', startup: 0.4, active: 0.06, recovery: 0.32, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, whiff: 'whoosh' });
registerAttack('derby_dez_elbow', { pose: 'derby_elbow', startup: 0.08, active: 0.08, recovery: 0.22, dmg: 9, reach: 1.0, arc: 0.8, kb: 2.5, stun: 0.42, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.6, hitstop: 0.06, shake: 2, score: 0 });
registerAttack('derby_dez_counter', { pose: 'derby_upper', startup: 0.05, active: 0.1, recovery: 0.35, dmg: 15, reach: 1.2, arc: 1.0, kb: 4, stun: 0.6, knockdown: true, launch: 7, unblockable: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.7, hitstop: 0.12, shake: 6, score: 0 });
registerAttack('derby_dez_dash', { pose: 'derby_dash', startup: 0.5, active: 0.32, recovery: 0.45, dmg: 13, reach: 1.0, arc: 0.9, kb: 5.5, stun: 0.55, knockdown: true, launch: 3, lunge: 9.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.4, hitstop: 0.09, shake: 5, score: 0 });
registerAttack('derby_bjorn_charge', { pose: 'derby_charge', startup: 0.6, active: 0.6, recovery: 0.55, dmg: 18, reach: 1.1, arc: 0.9, kb: 6.5, stun: 0.6, knockdown: true, launch: 3.5, lunge: 8, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.2, hitstop: 0.12, shake: 7, score: 0 });
registerAttack('derby_bjorn_hammer', { pose: 'derby_hammer', startup: 0.35, active: 0.1, recovery: 0.4, dmg: 14, reach: 1.2, arc: 0.8, kb: 3.5, stun: 0.55, knockdown: true, launch: 2, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.8, hitstop: 0.1, shake: 5, score: 0 });
registerAttack('derby_bjorn_quake', { pose: 'derby_quake', startup: 0.55, active: 0.12, recovery: 0.6, dmg: 14, reach: 2.1, arc: Math.PI, kb: 5, stun: 0.6, knockdown: true, launch: 4, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 0.4, hitstop: 0.1, shake: 9, score: 0 });
registerAttack('derby_bjorn_toss', { pose: 'derby_toss', startup: 0.24, active: 0.06, recovery: 0.22, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, whiff: 'whoosh' });

// ------------------------------------------------------------------ helpers
const dist2 = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const live = f => !!f && f.alive && f.hp > 0 && !f.removed;
function popup(world, f, text, color = '#ffe14a') { world.fx.popup(f.x, f.y, f.z + 0.5, text, color); }
function arena(world) { return (world.level.boss && world.level.boss.lockArea) || null; }
function clampArena(world, x, y) {
  const A = arena(world);
  if (!A) return { x, y };
  return { x: Math.max(A.x + 1, Math.min(A.x + A.w - 1, x)), y: Math.max(A.y + 1, Math.min(A.y + A.h - 1, y)) };
}

// ------------------------------------------------------------------ derby-day regulars
registerEnemy('derby_portside', {
  name: 'PORTSIDE LAD', hp: 48, speed: 2.7, power: 0.95, score: 140,
  look: rng => casualLook(rng, { a: RIVAL.a, b: RIVAL.b, hatChance: 0.3 }),
  ai: { aggression: 0.6, reaction: 0.32, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.14, dodgeChance: 0.05, runChance: 0.35, keepDist: 2.3, useWeapons: true },
  drops: [['coin', 0.5], ['pint', 0.08]],
});

registerEnemy('derby_vargby', {
  name: 'VARGBY RAIDER', hp: 54, speed: 3.0, runSpeed: 5.3, power: 1.05, score: 170,
  look: rng => {
    const L = casualLook(rng, { a: AWAY.a, b: AWAY.b, hair: ['skinhead', 'shaved', 'crop', 'mohawk'], hatChance: 0.3 });
    if (rng.chance(0.4)) L.jacket = { style: 'bomber', color: '#141414', lining: AWAY.a };
    return L;
  },
  ai: { aggression: 0.75, reaction: 0.26, attacks: [['jab', 2], ['cross', 2], ['kick', 2], ['lowKick', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.06, runChance: 0.5, keepDist: 2.0, taunt: 0.12 },
  drops: [['coin', 0.5], ['cash5', 0.12], ['pie', 0.08]],
});

// ------------------------------------------------------------------ ELITE: Portside top lad (counter-attacker)
registerEnemy('derby_toplad', {
  name: 'PORTSIDE TOP LAD', hp: 82, speed: 3.1, runSpeed: 5.4, power: 1.15, guard: 70, score: 400,
  look: rng => ({
    skin: rng.pick(['#e2a97a', '#d49a6a', '#f0c098', '#b87a50']),
    hair: { style: rng.pick(['mod', 'curtains', 'crop']), color: rng.pick(['#141016', '#3a2717', '#6a4a2a']) },
    facial: rng.pick(['none', 'stubble', 'none']),
    hat: rng.chance(0.4) ? { style: 'cap', color: rng.pick(['#e8e0cc', '#1d2742', '#c8b48a']) } : null,
    shades: rng.chance(0.5),
    jacket: rng.pick([
      { style: 'harrington', color: '#c8b48a', lining: '#a01818' },
      { style: 'track', color: '#1d2742', trim: '#e8e8e8' },
      { style: 'parka', color: '#d8ccb0' },
      { style: 'harrington', color: '#1a1a22', lining: RIVAL.a },
    ]),
    shirt: rng.pick(['#f2f2ee', RIVAL.a, '#e8d8a8']),
    pants: { style: 'jeans', color: rng.pick(['#2a3346', '#1e1e26', '#6a6050']) },
    shoes: { color: rng.pick(['#f2f2ee', '#e8e0c8']), sole: '#b8a070' },
    scarf: null,
    build: rng.range(1.05, 1.2), height: rng.range(1.0, 1.06),
  }),
  ai: { aggression: 0.62, reaction: 0.24, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['derby_counter', 1]], comboLen: [2, 4], blockChance: 0.42, dodgeChance: 0.14, grabChance: 0.05, keepDist: 2.2, taunt: 0.15 },
  drops: [['cash20', 0.25], ['pint', 0.2]],
  think(f, world, dt, ai) {
    const p = world.player, d = f.data;
    if (!p || !p.alive) return false;
    if (f.state === 'blockstun') { d.counter = true; return false; }
    if (d.counter) {
      if (dist2(f, p) > 1.8 || f.isDown || f.state === 'hurt') { d.counter = false; return false; }
      if (f.state === 'block') { f.intent.block = false; ai.blockT = 0; f.intent.mx = f.intent.my = 0; return true; }
      if (f.canAct) {
        d.counter = false; ai.blockT = 0;
        f.face2(p.x - f.x, p.y - f.y);
        f.intent.block = false; f.intent.mx = f.intent.my = 0;
        f.intent.attackName = 'derby_counter';
        popup(world, f, 'COUNTER!', '#ff9a3a');
        return true;
      }
    }
    return false;
  },
});

// ------------------------------------------------------------------ ELITE: Vargby ultra (flare thrower)
registerEnemy('derby_ultra', {
  name: 'VARGBY ULTRA', hp: 66, speed: 2.8, runSpeed: 5.0, power: 1.05, guard: 40, score: 350,
  look: rng => ({
    skin: rng.pick(['#f0c098', '#e2a97a', '#f4d0b0']),
    hair: { style: rng.pick(['skinhead', 'shaved', 'crop']), color: rng.pick(['#e8d27a', '#3a2717', '#141016']) },
    facial: rng.pick(['stubble', 'beard', 'none']),
    hat: rng.chance(0.65) ? { style: 'beanie', color: '#141414', trim: AWAY.a } : null,
    shades: rng.chance(0.6),
    jacket: rng.pick([{ style: 'bomber', color: '#141414', lining: AWAY.a }, { style: 'track', color: '#141414', trim: AWAY.a }, { style: 'parka', color: '#2a2a2a' }]),
    shirt: AWAY.a,
    pants: { style: rng.pick(['cargo', 'trackies']), color: '#1e1e22' },
    shoes: { color: '#121214', sole: '#3a3a3a' },
    scarf: { a: AWAY.a, b: AWAY.b },
    gloves: '#141414',
    build: rng.range(1.0, 1.2), height: rng.range(0.98, 1.05),
  }),
  ai: { aggression: 0.55, reaction: 0.3, attacks: [['kick', 3], ['jab', 2], ['lowKick', 2], ['cross', 1]], comboLen: [1, 3], blockChance: 0.12, dodgeChance: 0.08, keepDist: 3.2, runChance: 0.3, taunt: 0.1 },
  drops: [['coin', 0.6], ['cash5', 0.25], ['energy', 0.15]],
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !p.alive) return false;
    if (f.attack && f.attack.name === 'derby_flareToss') {
      if (f.attack.phase >= 1 && !f.attack.fired) {
        f.attack.fired = true;
        const t = f.data.flareTgt || p;
        spawnFlareShot(world, f, t.x, t.y, { dmg: 5, dur: 3.6 });
      }
      return false;
    }
    ai.flareCd = (ai.flareCd ?? 1.5 + Math.random() * 2.5) - dt;
    if (!ai.aggro || ai.goal || !f.canAct) return false;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
    if (ai.flareCd <= 0 && d > 2.6 && d < 7.5 && world.hasLOS(f.x, f.y, p.x, p.y)) {
      ai.flareCd = 5 + Math.random() * 2.5;
      f.face2(dx, dy);
      f.data.flareTgt = { x: p.x + (p.vx || 0) * 0.4, y: p.y + (p.vy || 0) * 0.4 };
      f.intent.block = false; f.intent.mx = f.intent.my = 0;
      f.intent.attackName = 'derby_flareToss';
      popup(world, f, 'FLARE!', '#ff5a3a');
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ TWIN BOSSES
export function derbyTwins(world) {
  return world.__derbyTwins || (world.__derbyTwins = { dez: null, bjorn: null, point: 'dez', tagT: 9, pointHp: null, lastT: -1, solo: false });
}

// Shared tag-team bookkeeping (runs once per frame, whichever twin thinks first).
function tagTeam(world, dt) {
  const T = derbyTwins(world);
  if (T.lastT === world.time) return T;
  T.lastT = world.time;
  const a = T.dez, b = T.bjorn;
  if (!live(a) || !live(b)) { T.solo = true; return T; }
  T.tagT -= dt;
  const pt = T.point === 'dez' ? a : b;
  if (T.pointHp === null) T.pointHp = pt.hp;
  const beaten = pt.hp < T.pointHp - pt.maxHp * 0.14;
  if ((T.tagT <= 0 || beaten) && pt.canAct) {
    T.point = T.point === 'dez' ? 'bjorn' : 'dez';
    const np = T.point === 'dez' ? a : b;
    T.tagT = 9 + Math.random() * 4;
    T.pointHp = np.hp;
    np.data.entry = true;
    popup(world, pt, 'TAG!', '#ffe14a');
    world.toast(np === a ? 'DEZ TAGS IN!' : 'BJÖRN TAGS IN!');
    world.sfx('whooshBig', np);
  }
  return T;
}

// The twin not on point hangs back at ~5 tiles, circling; ranged() may fire something.
function hangBack(f, world, dt, ai, ranged) {
  const p = world.player;
  const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 1;
  if (d < 1.7) return false;                      // too close: defend yourself (default AI)
  if (!f.canAct) return true;
  if (ranged && ranged(d)) return true;
  const want = 5.2;
  const side = (f.id % 2 ? 1 : -1) * 0.6;
  let tx = p.x - dx / d * want - dy / d * side * 3, ty = p.y - dy / d * want + dx / d * side * 3;
  const c = clampArena(world, tx, ty);
  if (Math.hypot(c.x - f.x, c.y - f.y) > 0.6) ai.moveToward(f, world, c.x, c.y, dt, d < 3);
  else { f.intent.mx = f.intent.my = 0; f.face2(dx, dy); }
  return true;
}

function enrage(f, world, who) {
  if (f.data.raged) return;
  f.data.raged = true;
  f.power *= 1.25; f.speed *= 1.2; f.runSpeed *= 1.15; f.superArmor += 4;
  f.controller.ai.aggression = Math.min(0.95, f.controller.ai.aggression + 0.25);
  f.controller.ai.reaction *= 0.75;
  world.message(who === 'dez' ? 'DEZ HAS LOST IT!' : 'BJÖRN GOES BERSERK!', who === 'dez' ? 'NOBODY TOUCHES BJÖRN EXCEPT DEZ' : 'NOBODY TOUCHES DEZ EXCEPT BJÖRN', 2.2, '#ff3a3a');
  world.sfx('bossRoar', f);
  world.camera.shake(6, 0.4);
}

// ---- DAPPER DEZ (main boss)
registerEnemy('derby_dez', {
  name: 'DAPPER DEZ', boss: true, hp: 620, speed: 2.9, runSpeed: 5.2, power: 1.2, weight: 1.8, superArmor: 8, guard: 85, score: 6000, ungrabbable: true,
  look: {
    skin: '#e8b48c', hair: { style: 'mod', color: '#1a1012' }, facial: 'stubble', shades: true,
    jacket: { style: 'harrington', color: '#e6dcc2', trim: '#b8a888', lining: '#1f4fb4' }, shirt: '#1f4fb4',
    pants: { style: 'jeans', color: '#262c3e' }, shoes: { color: '#f4f4f0', sole: '#c8a868' },
    scarf: null, gloves: '#2a1a14', build: 1.35, height: 1.26,
  },
  ai: { aggression: 0.62, reaction: 0.3, attacks: [['jab', 2], ['cross', 2], ['hook', 2], ['derby_dez_elbow', 2], ['roundhouse', 1]], comboLen: [2, 4], blockChance: 0.3, dodgeChance: 0.12, ignoreTokens: true, keepDist: 2.4, taunt: 0.05 },
  drops: [['kebab', 1]],
  onSpawn(f, world) { if (world) derbyTwins(world).dez = f; f.tauntAnim = 'taunt2'; },
  onDeath(f, world) { const T = derbyTwins(world); if (live(T.bjorn)) enrage(T.bjorn, world, 'bjorn'); },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !p.alive) return false;
    const T = tagTeam(world, dt);
    const d = f.data;
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy);
    if (T.solo && live(f) && !d.raged && T.bjorn && !live(T.bjorn)) enrage(f, world, 'dez');

    // phase change: jacket off
    if (!d.phase2 && f.hp < f.maxHp * 0.4) {
      d.phase2 = true;
      f.look = normalizeLook({ ...f.look, jacket: { style: 'polo', color: '#1f4fb4' }, shirt: '#1f4fb4', shades: false, __norm: undefined });
      f.speed *= 1.12; f.superArmor += 3;
      world.message('DEZ TAKES HIS JACKET OFF', 'IT COST MORE THAN YOUR CAR', 2, '#ffb04a');
      world.sfx('bossRoar', f);
      world.fx.debris(f.x, f.y, 1.2, ['#e6dcc2', '#1f4fb4'], 8);
    }
    // call the lads (once, under half health)
    if (!d.called && f.hp < f.maxHp * 0.5 && f.canAct) {
      d.called = true;
      world.message('DEZ WHISTLES FOR HIS LADS!', '', 1.6, '#ff6a4a');
      world.sfx('bossRoar', f);
      world.spawnEnemy('derby_toplad', 12.5, 51.5, { from: { x: 16.5, y: 51.5 }, aggro: true });
      world.spawnEnemy('derby_toplad', 12.5, 53.5, { from: { x: 16.5, y: 52.6 }, aggro: true });
      f.intent.taunt = true;
      return true;
    }

    // --- counter stance in progress
    if (d.stance > 0) {
      d.stance -= dt;
      f.face2(dx, dy);
      if (f.state === 'hurt' || f.isDown) { d.stance = 0; return false; }
      const pAttacking = p.state === 'attack' && p.attack && dist < 2.0 && ((p.fx * -dx + p.fy * -dy) / (dist || 1)) > 0.3;
      if (pAttacking || f.state === 'blockstun') { d.stance = 0; d.counterQ = true; f.intent.block = false; return true; }
      f.intent.block = true; f.intent.mx = f.intent.my = 0;
      if (d.stance <= 0) { f.intent.block = false; f.intent.taunt = true; }
      return true;
    }
    if (d.counterQ) {
      if (f.canAct) {
        d.counterQ = false; f.face2(dx, dy);
        f.intent.attackName = 'derby_dez_counter';
        popup(world, f, 'TOO SLOW!', '#ff8a3a');
        world.sfx('whooshBig', f);
      }
      f.intent.block = false;
      return true;
    }
    // --- chained designer dashes
    if (d.dashes > 0 && f.canAct) {
      d.dashT = (d.dashT ?? 0.25) - dt;
      if (d.dashT <= 0) { d.dashes--; d.dashT = 0.25; f.face2(dx, dy); f.intent.attackName = 'derby_dez_dash'; world.sfx('whooshBig', f); }
      else { f.intent.mx = f.intent.my = 0; f.face2(dx, dy); }
      return true;
    }

    // --- tag team: hang back and heckle
    const onPoint = T.solo || T.point === 'dez';
    if (!onPoint) {
      ai.heckle = (ai.heckle ?? 2) - dt;
      return hangBack(f, world, dt, ai, () => {
        if (ai.heckle <= 0) { ai.heckle = 3 + Math.random() * 3; f.intent.taunt = true; popup(world, f, ['COME ON THEN!', 'IS THAT IT?', 'NICE TRAINERS. NOT.', 'MUMMY DRESSED YOU?'][Math.floor(Math.random() * 4)], '#a0c8ff'); return true; }
        return false;
      });
    }

    // --- specials
    ai.spCd = (ai.spCd ?? 2.5) - dt;
    if (d.entry && f.canAct && dist > 2.4 && dist < 9) { // tag-in entrance: a dash
      d.entry = false; ai.spCd = Math.max(ai.spCd, 2);
      f.face2(dx, dy); f.intent.attackName = 'derby_dez_dash'; popup(world, f, 'DESIGNER DASH!', '#ff8a3a');
      return true;
    }
    d.entry = false;
    if (f.canAct && ai.spCd <= 0 && !ai.goal) {
      const fast = d.phase2 || d.raged;
      ai.spCd = fast ? 3 + Math.random() * 1.5 : 4.5 + Math.random() * 2;
      if (dist < 3.2 && Math.random() < 0.55) {
        d.stance = 1.4;
        world.fx.popup(f.x, f.y, f.z + 0.6, 'COME ON THEN...', '#a0c8ff');
        f.intent.block = true; f.intent.mx = f.intent.my = 0;
        return true;
      }
      if (dist > 2.2 && dist < 9 && world.hasLOS(f.x, f.y, p.x, p.y)) {
        f.face2(dx, dy);
        f.intent.attackName = 'derby_dez_dash';
        d.dashes = fast ? 2 : 0; d.dashT = 0.3;
        world.message('DESIGNER DASH!', '', 0.9, '#ff8a3a');
        world.sfx('bossRoar', f);
        return true;
      }
    }
    return false;
  },
});

// ---- BIG BJÖRN (twin; boss-strength minion)
registerEnemy('derby_bjorn', {
  name: 'BIG BJÖRN', hp: 480, speed: 2.3, runSpeed: 4.6, power: 1.35, weight: 2.6, superArmor: 11, guard: 90, score: 5000, ungrabbable: true,
  look: {
    skin: '#f2c8a4', hair: { style: 'long', color: '#e0c060' }, facial: 'beard',
    jacket: { style: 'vest', color: '#141414' }, shirt: '#f0c020',
    pants: { style: 'cargo', color: '#26262a' }, shoes: { color: '#121214', sole: '#3a3a3a' },
    scarf: AWAY_KIT, gloves: null, build: 1.65, height: 1.38,
  },
  ai: { aggression: 0.5, reaction: 0.4, attacks: [['haymaker', 3], ['derby_bjorn_hammer', 2], ['push', 2], ['bodySlam', 1]], comboLen: [1, 2], blockChance: 0.12, grabChance: 0.12, ignoreTokens: true, keepDist: 2.8 },
  drops: [['kebab', 1], ['cash20', 1]],
  onSpawn(f, world) { if (world) derbyTwins(world).bjorn = f; },
  onDeath(f, world) { const T = derbyTwins(world); if (live(T.dez)) enrage(T.dez, world, 'dez'); },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !p.alive) return false;
    const T = tagTeam(world, dt);
    const d = f.data;
    if (!d.init) { d.init = true; f.boss = true; }   // boss-strength (after spawning, so world.boss stays Dez)
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy);
    if (T.solo && live(f) && !d.raged && T.dez && !live(T.dez)) enrage(f, world, 'bjorn');

    // a flare toss in progress: release on the active frame
    if (f.attack && f.attack.name === 'derby_bjorn_toss') {
      if (f.attack.phase >= 1 && !f.attack.fired) {
        f.attack.fired = true;
        const spread = d.barrage !== undefined ? 1.6 : 0.6;
        const tx = p.x + (Math.random() - 0.5) * spread * 2 + (p.vx || 0) * 0.3, ty = p.y + (Math.random() - 0.5) * spread * 2 + (p.vy || 0) * 0.3;
        spawnFlareShot(world, f, tx, ty, { dmg: 6, dur: 4.5, r: 1.05 });
      }
      return false;
    }
    // phase change: shirt off
    if (!d.phase2 && f.hp < f.maxHp * 0.45) {
      d.phase2 = true;
      f.look = normalizeLook({ ...f.look, jacket: { style: 'tee', color: f.look.skin }, shirt: f.look.skin, __norm: undefined });
      f.speed *= 1.15;
      world.message("BJÖRN'S SHIRT IS OFF", 'NOBODY WANTED THIS', 2, '#ffd23a');
      world.sfx('bossRoar', f);
    }
    // barrage sequence: plant, then three tosses
    if (d.plant > 0) {
      d.plant -= dt; f.intent.mx = f.intent.my = 0; f.face2(dx, dy);
      if (d.plant <= 0) d.barrage = d.phase2 || d.raged ? 4 : 3;
      return true;
    }
    if (d.barrage > 0) {
      if (f.canAct) { d.barrage--; f.face2(dx, dy); f.intent.attackName = 'derby_bjorn_toss'; }
      if (d.barrage <= 0) d.barrage = undefined;
      return true;
    }
    d.barrage = undefined;

    const onPoint = T.solo || T.point === 'bjorn';
    if (!onPoint) {
      ai.cover = (ai.cover ?? 2.5) - dt;
      return hangBack(f, world, dt, ai, (dd) => {
        if (ai.cover <= 0 && dd > 2.5 && dd < 8 && world.hasLOS(f.x, f.y, p.x, p.y)) {
          ai.cover = 3.5 + Math.random() * 2.5;
          f.face2(dx, dy); f.intent.attackName = 'derby_bjorn_toss';
          popup(world, f, 'HEADS UP!', '#ffd23a');
          return true;
        }
        return false;
      });
    }

    ai.spCd = (ai.spCd ?? 2) - dt;
    if (d.entry && f.canAct && dist > 2.6 && dist < 9) {
      d.entry = false; ai.spCd = Math.max(ai.spCd, 2);
      f.face2(dx, dy); f.intent.attackName = 'derby_bjorn_charge';
      popup(world, f, 'STAMPEDE!', '#ffd23a'); world.sfx('bossRoar', f);
      return true;
    }
    d.entry = false;
    if (f.canAct && ai.spCd <= 0 && !ai.goal) {
      const fast = d.phase2 || d.raged;
      ai.spCd = fast ? 3 + Math.random() * 1.5 : 4.5 + Math.random() * 2;
      if ((fast) && dist < 2.4) {
        f.face2(dx, dy); f.intent.attackName = 'derby_bjorn_quake';
        world.message('GROUND POUND!', '', 0.9, '#ffd23a'); world.sfx('bossRoar', f);
        return true;
      }
      if (dist > 3 && dist < 9 && world.hasLOS(f.x, f.y, p.x, p.y) && Math.random() < 0.5) {
        f.face2(dx, dy); f.intent.attackName = 'derby_bjorn_charge';
        world.message('TERRACE STAMPEDE!', '', 0.9, '#ffd23a'); world.sfx('bossRoar', f);
        return true;
      }
      if (dist > 2.2) {
        d.plant = 0.7;
        world.message('BJÖRN LIGHTS THE FLARES!', '', 1.1, '#ff5a3a');
        world.sfx('bossRoar', f);
        return true;
      }
    }
    return false;
  },
});
