// LEVEL 4 — THE AWAY END: new enemies, attacks, poses and the boss.
//
//   awayend_riot       RIOT STEWARD — perspex shield blocks everything from the front (incl. thrown bottles).
//                      Beat him by hitting him from behind (he turns slowly), with jump attacks over the top,
//                      by grabbing him, by throwing someone into him, or by smashing the shield with heavy hits/weapons.
//                      Drops his shield (a weapon) when KO'd with it intact.
//   awayend_spotter    PORTSIDE SPOTTER — keeps his distance and blows a whistle to call reinforcements
//                      (max 2 calls, only while he is standing). Take him out first.
//   awayend_ejector    EJECTION STEWARD — big lad in black, grabs you and throws you ("OUT YOU GO!").
//   awayend_homefirm   PORTSIDE HOME FIRM — tougher, flanking, rushing version of the firm top boy.
//   awayend_headsteward  BOSS: BARRIER BARRY, head steward. Phase 1: giant shield (front block), telegraphed
//                      SHIELD CHARGE (crashes into walls -> dazed), WHISTLE (summons stewards). Phase 2 (<50% hp or
//                      shield smashed): drops the shield (you can pick it up), CLOTHESLINE run, EJECTION grab-throw.
//
// The shield is implemented per-instance (wrapped takeHit/face2 + an actor that draws it) — no engine changes needed.

import { registerEnemy, casualLook, RIVAL } from '../enemies.js';
import { registerAttack, ATTACKS } from '../../game/combat.js';
import { registerAttackPose, GUARD } from '../../game/poses.js';
import { toScreen } from '../../engine/iso.js';
import { audio } from '../../audio/audio.js';

const OL = '#120c14';
const HIVIS = '#d8f020';

// ------------------------------------------------------------------ attacks & poses
registerAttack('awayend_shieldbash', { pose: 'awayend_shieldbash', startup: 0.12, npcStartup: 0.3, active: 0.1, recovery: 0.3, dmg: 8, reach: 1.15, arc: 0.85, kb: 5.5, stun: 0.5, lunge: 2.5, weapon: true, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.3, hitstop: 0.07, shake: 3, score: 30, guardDmg: 18 });
registerAttack('awayend_chargewind', { pose: 'awayend_chargewind', startup: 0.75, active: 0.02, recovery: 0.02, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, telegraph: true });
registerAttack('awayend_shieldcharge', { pose: 'awayend_shieldcharge', startup: 0.08, active: 0.8, recovery: 0.55, dmg: 17, reach: 1.15, arc: 1.0, kb: 7, stun: 0.7, knockdown: true, launch: 3.5, lunge: 9, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.2, hitstop: 0.12, shake: 7, guardDmg: 40 });
registerAttack('awayend_linewind', { pose: 'awayend_linewind', startup: 0.6, active: 0.02, recovery: 0.02, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, telegraph: true });
registerAttack('awayend_clothesline', { pose: 'awayend_clothesline', startup: 0.06, active: 0.7, recovery: 0.5, dmg: 15, reach: 1.25, arc: 1.3, kb: 6.5, stun: 0.6, knockdown: true, launch: 4.5, lunge: 8.2, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.1, shake: 6, guardDmg: 35 });
registerAttack('awayend_whistle', { pose: 'awayend_whistle', startup: 0.45, active: 0.35, recovery: 0.3, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0 });

registerAttackPose('awayend_shieldbash', {
  windup: { ...GUARD, lean: -0.15, dx: -1, uaN: 1.0, faN: 1.6, uaF: 1.1, faF: 1.5 },
  hit: { ...GUARD, lean: 0.45, dx: 4, uaN: 1.5, faN: 0.3, uaF: 1.5, faF: 0.3, thN: 0.55, knN: 0.3, thF: -0.45, knF: 0.1 },
});
registerAttackPose('awayend_chargewind', {
  windup: { lean: 0.55, dy: 4, head: 0.2, thN: 0.7, knN: 1.1, thF: -0.5, knF: 0.8, uaN: 1.2, faN: 1.2, uaF: 1.3, faF: 1.1 },
  hit: { lean: 0.6, dy: 4, head: 0.2, thN: 0.75, knN: 1.15, thF: -0.55, knF: 0.85, uaN: 1.2, faN: 1.2, uaF: 1.3, faF: 1.1 },
});
registerAttackPose('awayend_shieldcharge', {
  windup: { lean: 0.6, dy: 3, thN: 0.9, knN: 0.6, thF: -0.6, knF: 0.9, uaN: 1.3, faN: 1.0, uaF: 1.3, faF: 1.0 },
  hit: { lean: 0.7, dx: 4, dy: 3, thN: -0.3, knN: 1.0, thF: 0.9, knF: 0.4, uaN: 1.4, faN: 0.8, uaF: 1.4, faF: 0.8 },
});
registerAttackPose('awayend_linewind', {
  windup: { lean: -0.2, head: -0.1, thN: 0.3, knN: 0.4, thF: -0.3, knF: 0.3, uaN: 1.57, faN: 0.05, uaF: -0.7, faF: 0.3 },
  hit: { lean: -0.25, head: -0.15, thN: 0.35, knN: 0.45, thF: -0.35, knF: 0.3, uaN: 1.6, faN: 0.0, uaF: -0.8, faF: 0.3 },
});
registerAttackPose('awayend_clothesline', {
  windup: { lean: 0.3, thN: 0.9, knN: 0.4, thF: -0.6, knF: 1.2, uaN: 1.57, faN: 0, uaF: -0.5, faF: 0.6 },
  hit: { lean: 0.35, dx: 3, thN: -0.5, knN: 1.2, thF: 0.9, knF: 0.4, uaN: 1.6, faN: 0, uaF: -0.4, faF: 0.6 },
});
registerAttackPose('awayend_whistle', {
  windup: { lean: -0.1, head: -0.25, thN: 0.1, knN: 0.1, thF: -0.1, knF: 0.1, uaN: 2.0, faN: 2.5, uaF: 0.1, faF: 0.3 },
  hit: { lean: -0.25, head: -0.35, dy: -1, thN: 0.1, knN: 0.1, thF: -0.1, knF: 0.1, uaN: 2.1, faN: 2.6, uaF: 1.8, faF: 0.6 },
});

// ------------------------------------------------------------------ sound helper (a proper 'whistle' sfx is requested from audio)
export function awayendWhistle(world, f, long = false) {
  if (audio.customSfx && audio.customSfx.whistle) { world.sfx('whistle', f); return; }
  const a = audio;
  if (!a.ctx || a.ctx.state !== 'running' || !a.tone) { world.sfx('menuSelect', f); return; }
  let vol = 0.06;
  if (f && world.player) vol *= Math.max(0.3, 1 - Math.hypot(f.x - world.player.x, f.y - world.player.y) / 18);
  const t = a.ctx.currentTime + 0.01;
  a.tone(t, 0.1, { freq: 2500, to: 3200, type: 'square', vol });
  const n = long ? 9 : 5;
  for (let i = 0; i < n; i++) a.tone(t + 0.12 + i * 0.045, 0.05, { freq: i % 2 ? 2950 : 3250, type: 'square', vol });
}

// ------------------------------------------------------------------ the riot shield (shared by the riot steward and the boss)
const SHIELD_STATES = new Set(['idle', 'walk', 'run', 'attack', 'block', 'blockstun', 'taunt']);
const TURN_STATES = new Set(['idle', 'walk', 'run', 'attack', 'block', 'taunt']);

function shieldFace(f, dx, dy, proto) {
  const sh = f.data.shield;
  if (!sh || sh.hp <= 0 || f.data.freeTurn || !TURN_STATES.has(f.state)) return proto.face2.call(f, dx, dy);
  const l = Math.hypot(dx, dy);
  if (l < 1e-4) return;
  const cur = Math.atan2(f.fy, f.fx), want = Math.atan2(dy, dx);
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const budget = Math.max(0, f.data.turnBudget ?? 0.05);
  const step = Math.max(-budget, Math.min(budget, d));
  f.data.turnBudget = budget - Math.abs(step);
  const a = cur + step;
  f.fx = Math.cos(a); f.fy = Math.sin(a);
}

function shieldPos(f) {
  return { x: f.x + f.fx * 0.4, y: f.y + f.fy * 0.4 };
}

export function breakShield(f, world, stun = true) {
  const sh = f.data.shield;
  if (!sh) return;
  sh.hp = 0;
  const p = shieldPos(f);
  world.fx.debris(p.x, p.y, f.z + 0.8, ['#c8e0f4', '#9cc4e4', '#ffd23a', '#2a2a30'], 18);
  world.fx.glass(p.x, p.y, f.z + 1.0);
  world.fx.popup(f.x, f.y, f.z + 0.4, 'SHIELD SMASHED!', '#8ad8ff');
  world.sfx('glass', f); world.sfx('guardBreak', f);
  if (stun && f.alive) { f.attack = null; f.setState('dizzy'); f.stunT = 1.4; f.vx = f.vy = 0; }
}

function shieldTakeHit(f, hit, world, proto) {
  const sh = f.data.shield;
  if (sh && sh.hp > 0 && f.alive && !f.dying && f.invuln <= 0 && SHIELD_STATES.has(f.state) && hit.attacker && !hit.unblockable && hit.dir) {
    const def = hit.def || {};
    const att = hit.attacker;
    const overTop = def.air || (att.z !== undefined && att.z > f.z + 0.45);
    if (!overTop && def !== ATTACKS.throwImpact) {
      const facing = -(f.fx * hit.dir.x + f.fy * hit.dir.y);
      if (facing > 0.25) {
        const heavy = hit.dmg >= 10 || def.knockdown || def.weapon;
        sh.hp -= hit.dmg * (heavy ? 1 : 0.45);
        sh.flash = 0.12;
        if (att.kind === 'fighter' && att.onGround && !att.boss) { att.vx -= hit.dir.x * 2.2; att.vy -= hit.dir.y * 2.2; }
        const p = shieldPos(f);
        world.fx.spark(p.x, p.y, f.z + 1.2, '#c8e8ff', 5);
        if (sh.hp <= 0) { breakShield(f, world, true); if (f.data.onShieldBreak) f.data.onShieldBreak(f, world); return 'guardbreak'; }
        if (att.isPlayer && !world.__awayendShieldTip) {
          world.__awayendShieldTip = true;
          world.toast('SHIELD! HIT HIM FROM BEHIND, JUMP-KICK OR GRAB HIM');
        }
        return 'blocked';
      }
    }
  }
  return proto.takeHit.call(f, hit, world);
}

function drawShield(ctx, f, world) {
  const sh = f.data.shield;
  if (!sh || sh.hp <= 0 || f.isDown || f.state === 'thrown' || f.state === 'grabbed' || !f.alive) return;
  const sc = (f.look.height || 1) * (sh.scale || 1);
  const s = toScreen(f.x, f.y, f.z);
  const sdx = f.fx - f.fy, sdy = f.fx + f.fy;
  const dir = Math.abs(sdx) < 0.08 ? (f.visFlip ? -1 : 1) : Math.sign(sdx);
  let push = 0;
  const a = f.attack;
  if (f.state === 'attack' && a && a.phase >= 1 && /shield|charge/.test(a.name)) push = 4;
  if (f.state === 'attack' && a && a.name === 'awayend_chargewind') push = -1;
  const w = Math.max(9, Math.round(11 * sc * (0.75 + Math.abs(sdy) * 0.25))), h = Math.round(27 * sc);
  const cx = Math.round(s.x + dir * (Math.round(6 * sc) + push) - (sdy > 0.35 ? dir * 3 : 0));
  const bottom = Math.round(s.y - 4 * sc), top = bottom - h;
  const x0 = cx - (w >> 1);
  const flash = sh.flash > 0;
  // edge thickness on the far side
  ctx.fillStyle = OL; ctx.fillRect(x0 - 1, top - 1, w + 2, h + 2);
  ctx.fillStyle = '#3a4a58'; ctx.fillRect(dir > 0 ? x0 + w - 1 : x0, top, 1, h);
  ctx.globalAlpha = flash ? 0.95 : 0.5;
  ctx.fillStyle = flash ? '#ffffff' : '#9cc4e4';
  ctx.fillRect(x0, top, w, h);
  ctx.globalAlpha = flash ? 1 : 0.35;
  ctx.fillStyle = '#d8ecfa'; ctx.fillRect(x0, top + 3, w, Math.round(6 * sc));          // view window
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e8f6ff';
  for (let i = 0; i < Math.round(9 * sc); i++) ctx.fillRect(x0 + 2 + (i >> 2), top + 3 + i, 1, 1);  // glint
  // hazard band
  const by = bottom - Math.round(7 * sc);
  ctx.fillStyle = '#ffd23a'; ctx.fillRect(x0, by, w, 3);
  ctx.fillStyle = OL; for (let i = 0; i < w; i += 3) ctx.fillRect(x0 + i, by, 1, 3);
  // cracks when damaged
  if (sh.max && sh.hp < sh.max * 0.55) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) ctx.fillRect(x0 + 3 + ((i * 3) % (w - 4)), top + 8 + i * 2, 1, 1);
    for (let i = 0; i < 4; i++) ctx.fillRect(x0 + w - 4 - i, top + 12 + i * 2, 1, 1);
  }
}

export function equipShield(f, world, o = {}) {
  const max = o.hp ?? 40;
  f.data.shield = { hp: max, max, scale: o.scale ?? 1, flash: 0, turn: o.turn ?? 2.6 };
  if (!f.__awayendShield) {
    f.__awayendShield = true;
    const proto = Object.getPrototypeOf(f);
    f.takeHit = function (hit, w) { return shieldTakeHit(this, hit, w, proto); };
    f.face2 = function (dx, dy) { shieldFace(this, dx, dy, proto); };
  }
  if (!world || !world.addActor) return;
  world.addActor({
    x: f.x, y: f.y, removed: false,
    update(w, dt) {
      this.x = f.x; this.y = f.y;
      const sh = f.data.shield;
      if (sh && sh.flash > 0) sh.flash -= dt;
      if (f.removed || !sh || sh.hp <= 0 || !f.alive) this.removed = true;
    },
    depth() { return f.x + f.y + ((f.fx + f.fy) >= -0.2 ? 0.03 : -0.03); },
    draw(ctx, w) { drawShield(ctx, f, w); },
  });
}

// turn budget for slow-turning shield bearers; call at the top of think()
function shieldTick(f, dt, ai) {
  const sh = f.data.shield;
  if (sh) f.data.turnBudget = sh.turn * dt;
  f.data.freeTurn = !!ai.goal;
}

// Find the encounter that owns a fighter (to register summoned reinforcements with it).
function encounterOf(world, f) {
  return world.encounters && world.encounters.find(e => e.state === 'active' && e.spawned && e.spawned.includes(f));
}

// ------------------------------------------------------------------ looks
function stewardLook(rng, o = {}) {
  return {
    ...casualLook(rng, { scarf: null, hatChance: 0 }),
    jacket: { style: 'hivis', color: o.vis || HIVIS }, shirt: o.shirt || '#1a1a22',
    pants: { style: 'trackies', color: '#1a1a22', trim: '#1a1a22' }, shoes: { color: '#121214', sole: '#222' },
    hat: o.hat || null, gloves: o.gloves || null,
    build: o.build ?? rng.range(1.05, 1.25), height: o.height ?? rng.range(1.0, 1.06),
  };
}

// ------------------------------------------------------------------ enemies
registerEnemy('awayend_riot', {
  name: 'RIOT STEWARD', hp: 58, speed: 2.1, runSpeed: 3.8, power: 1.05, weight: 1.4, guard: 60, superArmor: 3, score: 320,
  look: rng => stewardLook(rng, { hat: { style: 'helmet', color: '#1a1c24' }, gloves: '#141418', build: rng.range(1.15, 1.3) }),
  ai: {
    aggression: 0.5, reaction: 0.36, attacks: [['awayend_shieldbash', 3], ['jab', 1]], comboLen: [1, 1],
    blockChance: 0, dodgeChance: 0, grabChance: 0, keepDist: 1.9, runChance: 0, taunt: 0.05,
    shouts: { aggro: ['STAND STILL!', 'BACK IN YOUR SEAT!', 'NOBODY GETS PAST ME'], taunt: ['COME ON THEN', 'BEHIND THE LINE!'], hurt: ['OI!', 'ME VISOR!'] },
  },
  drops: [['coin', 0.4], ['energy', 0.2]],
  onSpawn(f, world) { equipShield(f, world, { hp: 40, turn: 2.4 }); },
  think(f, world, dt, ai) { shieldTick(f, dt, ai); return false; },
  onDeath(f, world) {
    if (f.data.shield && f.data.shield.hp > 0) {
      f.data.shield.hp = 0;
      world.spawnItem('awayend_shield', f.x, f.y, 0.5, { vx: f.fx, vy: f.fy, vz: 3, pickDelay: 0.4, life: 30 });
    }
  },
});

registerEnemy('awayend_spotter', {
  name: 'PORTSIDE SPOTTER', hp: 34, speed: 3.0, runSpeed: 5.3, power: 0.8, score: 260,
  look: rng => ({
    ...casualLook(rng, { a: RIVAL.a, b: RIVAL.b, scarf: null, hatChance: 0 }),
    jacket: { style: 'parka', color: rng.pick(['#4a5040', '#3e4a5a', '#5a4a38']), lining: RIVAL.a },
    hat: { style: 'cap', color: rng.pick(['#1a1a22', RIVAL.a]) }, shades: rng.chance(0.5),
  }),
  ai: {
    aggression: 0.3, reaction: 0.42, attacks: [['jab', 2], ['lowKick', 1]], comboLen: [1, 1],
    keepDist: 4.6, kite: true, flee: 0.45, blockChance: 0.05, dodgeChance: 0.25, runChance: 0.5, taunt: 0.12,
    shouts: { aggro: ['THERE HE IS!', 'OVER HERE, LADS!', 'GOT ONE!'], taunt: ['YOU\'RE GOING HOME IN A BAG', 'WAIT TILL THE LADS GET HERE'], hurt: ['NOT THE FACE!'] },
  },
  drops: [['cash5', 0.5], ['coin', 0.5]],
  onSpawn(f, world, opts = {}) {
    f.data.callFrom = opts.callFrom || opts.from || null;
    f.data.callType = opts.callType || 'rival';
    f.data.calls = 0; f.data.maxCalls = opts.maxCalls ?? 2;
  },
  think(f, world, dt, ai) {
    const p = world.player;
    if (f.state === 'attack' && f.attack && f.attack.name === 'awayend_whistle') {
      f.intent.mx = f.intent.my = 0;
      if (f.attack.phase >= 1 && !f.attack.called) {
        f.attack.called = true;
        awayendWhistle(world, f);
        world.fx.popup(f.x, f.y, f.z + 0.6, 'PHWEEET!', '#ffe14a');
        const e = encounterOf(world, f);
        const aliveN = e ? e.spawned.filter(o => o.alive && !o.removed).length : 0;
        if (aliveN < 6) {
          const from = f.data.callFrom || { x: f.x, y: f.y };
          const gx = (p ? (p.x + f.x) / 2 : f.x), gy = (p ? (p.y + f.y) / 2 : f.y);
          const tgt = world.heightAt(gx, gy) <= 0.3 ? { x: gx, y: gy } : { x: f.x, y: f.y };
          const n = world.spawnEnemy(f.data.callType, tgt.x, tgt.y, { from, aggro: true });
          if (n && e) e.spawned.push(n);
          if (n) world.toast('THE SPOTTER CALLED FOR BACKUP!');
        }
      }
      return true;
    }
    ai.callCd = (ai.callCd ?? (2.5 + Math.random() * 2)) - dt;
    if (p && p.alive && ai.aggro && !ai.goal && f.canAct && ai.callCd <= 0 && f.data.calls < f.data.maxCalls) {
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d > 2.4) {
        ai.callCd = 7 + Math.random() * 2;
        f.data.calls++;
        f.face2(p.x - f.x, p.y - f.y);
        f.intent.mx = f.intent.my = 0;
        f.intent.attackName = 'awayend_whistle';
        f.say('PHWEEET!', 0.9);
        return true;
      }
      ai.callCd = 0.6;
    }
    return false;
  },
});

registerEnemy('awayend_ejector', {
  name: 'EJECTION STEWARD', hp: 82, speed: 2.4, runSpeed: 4.6, power: 1.1, weight: 1.7, superArmor: 6, guard: 60, score: 340,
  look: rng => ({
    ...casualLook(rng, { scarf: null, hatChance: 0, hair: ['shaved', 'skinhead'] }),
    jacket: { style: 'bomber', color: '#141418', lining: '#d8f020', trim: '#0a0a0c' }, shirt: '#141418',
    pants: { style: 'cargo', color: '#1a1a22' }, shoes: { color: '#0e0e10', sole: '#222' },
    hat: rng.chance(0.5) ? { style: 'beanie', color: '#141418', trim: '#2a2a30' } : null, gloves: '#141418',
    build: rng.range(1.4, 1.5), height: 1.1,
  }),
  ai: {
    aggression: 0.55, reaction: 0.34, attacks: [['push', 2], ['haymaker', 2], ['jab', 1]], comboLen: [1, 2],
    blockChance: 0.25, grabChance: 0.4, keepDist: 1.8, rushChance: 0.06, rushAttack: 'shoulder', runChance: 0.3,
    shouts: { aggro: ['RIGHT, YOU. OUT.', 'TICKET? THOUGHT NOT.', 'YOU\'RE BARRED, SON'], taunt: ['COME HERE...'], rush: ['OUT!'] },
  },
  drops: [['pie', 0.3], ['cash5', 0.3]],
  think(f, world, dt, ai) {
    if (f.state === 'grabbing' && f.grabbing && f.grabbing.isPlayer) {
      f.intent.mx = f.intent.my = 0;
      if (!f.data.ejectSaid) { f.data.ejectSaid = true; f.say('OUT YOU GO!', 1.0); }
      if (f.stateT > 0.5) f.intent.grab = true;
      return true;
    }
    f.data.ejectSaid = false;
    return false;
  },
});

registerEnemy('awayend_homefirm', {
  name: 'PORTSIDE HOME FIRM', hp: 72, speed: 3.05, runSpeed: 5.4, power: 1.2, score: 360, guard: 50,
  look: rng => casualLook(rng, { a: RIVAL.a, b: RIVAL.b, scarf: null, jacket: { style: rng.pick(['harrington', 'bomber', 'leather']), color: rng.pick(['#b5a98a', '#1d2742', '#2a2a2e']), lining: RIVAL.a }, hatChance: 0.25, hair: ['crop', 'mod', 'shaved', 'curtains'] }),
  ai: {
    aggression: 0.7, reaction: 0.26, attacks: [['jab', 2], ['cross', 2], ['hook', 2], ['kick', 1], ['uppercut', 1]], comboLen: [2, 4],
    blockChance: 0.3, dodgeChance: 0.12, counterChance: 0.2, grabChance: 0.06, keepDist: 2.2, rushChance: 0.12, flank: 0.6, runChance: 0.4,
    shouts: { aggro: ['YOU\'RE IN OUR END NOW', 'NORDHAMN? NOBODY.', 'WELCOME TO PORTSIDE'], taunt: ['IS THAT IT?', 'CITY! CITY!'], rush: ['HAVE IT!'] },
  },
  drops: [['cash20', 0.15], ['pint', 0.15], ['coin', 0.4]],
});

// ------------------------------------------------------------------ BOSS: BARRIER BARRY, head steward
function summonStewards(f, world) {
  const L = world.level.boss || {};
  const pts = L.reinforce || [{ x: f.x + 2, y: f.y, from: { x: f.x + 4, y: f.y } }];
  const alive = world.fighters.filter(o => o.team !== 'player' && o.alive && o !== f).length;
  const n = Math.max(0, Math.min(2, 4 - alive));
  for (let i = 0; i < n; i++) {
    const s = pts[(f.data.summons + i) % pts.length];
    const type = (f.data.summons + i) % 3 === 2 ? 'awayend_riot' : (f.data.phase2 && i === 0 ? 'awayend_ejector' : 'steward');
    world.spawnEnemy(type, s.x, s.y, { from: s.from, aggro: true });
  }
  f.data.summons += n;
  return n;
}

function bossCrash(f, world, ai) {
  f.attack = null;
  f.setState('dizzy'); f.stunT = ai.phase2 ? 1.35 : 1.9; f.vx = f.vy = 0;
  world.sfx('wallSlam', f);
  world.camera.shake(7, 0.35);
  world.fx.impact(f.x + f.fx * 0.5, f.y + f.fy * 0.5, f.z + 1.2, true);
  world.fx.popup(f.x, f.y, f.z + 0.4, 'CLANG!', '#ffe14a');
  world.breakPropsAt(f.x + f.fx * 0.8, f.y + f.fy * 0.8, 0.2, f, 40);
  f.say('OOF...', 1.2);
  if (!ai.crashTip) { ai.crashTip = true; world.toast('HE\'S SEEING STARS - GET STUCK IN!'); }
}

function enterPhase2(f, world, ai) {
  ai.phase2 = true; f.data.phase2 = true;
  const sh = f.data.shield;
  if (sh && sh.hp > 0) {
    sh.hp = 0;
    world.spawnItem('awayend_shield', f.x - f.fx * 0.6, f.y - f.fy * 0.6, 0.6, { vx: -f.fx * 1.5, vy: -f.fy * 1.5, vz: 4, pickDelay: 0.6 });
    world.sfx('clatter', f);
  }
  f.data.shield = null;
  f.ungrabbable = false;
  f.speed *= 1.3; f.runSpeed *= 1.15; f.superArmor = 9;
  ai.ai = {
    ...ai.ai, aggression: 0.75, reaction: 0.28, comboLen: [2, 3], keepDist: 1.8, blockChance: 0.15,
    attacks: [['haymaker', 2], ['hook', 2], ['cross', 2], ['uppercut', 1], ['bodySlam', 1]],
  };
  ai.lineCd = 2.5; ai.grabCd = 3.5; ai.whistleCd = Math.max(ai.whistleCd || 0, 6);
  f.attack = null; f.setState('taunt'); f.tauntTime = 1.1; f.vx = f.vy = 0;
  world.message('BARRY HAS LOST HIS SHIELD!', 'AND HIS TEMPER', 2.0, '#ff6a3a');
  world.sfx('bossRoar', f);
  world.camera.shake(4, 0.3);
  f.say('RIGHT. GLOVES OFF.', 1.6);
}

registerEnemy('awayend_headsteward', {
  name: 'BARRIER BARRY', boss: true, hp: 440, speed: 2.3, runSpeed: 4.4, power: 1.2, weight: 2.4, superArmor: 7, guard: 80, score: 4000, ungrabbable: true,
  look: {
    skin: '#e8b090', hair: { style: 'flattop', color: '#7a7a7a' }, facial: 'tache',
    hat: { style: 'cap', color: '#14141a' },
    jacket: { style: 'hivis', color: '#ff7a1a' }, shirt: '#14141a',
    pants: { style: 'suit', color: '#1a1a22' }, shoes: { color: '#0e0e10', sole: '#2a2a2a' },
    gloves: '#1a1a1a', build: 1.6, height: 1.34,
  },
  ai: {
    aggression: 0.5, reaction: 0.36, attacks: [['awayend_shieldbash', 3], ['push', 2], ['jab', 1], ['haymaker', 1]], comboLen: [1, 2],
    blockChance: 0, dodgeChance: 0, grabChance: 0, ignoreTokens: true, keepDist: 2.2, taunt: 0.04,
    shouts: { aggro: ['NOT ON MY WATCH', 'YOU\'RE ON THE LIST, SON'], taunt: ['TWENTY-TWO YEARS. NEVER LOST ONE.', 'SIT. DOWN.'], hurt: ['THAT\'S A BAN!'] },
  },
  drops: [['kebab', 1]],
  onSpawn(f, world) {
    f.data.summons = 0;
    equipShield(f, world, { hp: 120, scale: 1.18, turn: 3.0 });
  },
  think(f, world, dt, ai) {
    shieldTick(f, dt, ai);
    const p = world.player;
    if (!p) return false;
    if (!ai.phase2 && (f.hp < f.maxHp * 0.5 || !f.data.shield || f.data.shield.hp <= 0) && f.state !== 'dizzy' && !f.isDown) {
      enterPhase2(f, world, ai);
      return true;
    }
    ai.chargeCd = (ai.chargeCd ?? 3.2) - dt;
    ai.whistleCd = (ai.whistleCd ?? 9) - dt;
    ai.lineCd = (ai.lineCd ?? 3) - dt;
    ai.grabCd = (ai.grabCd ?? 4) - dt;
    const I = f.intent;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);

    // --- running specials: detect crashing into walls / props
    const a = f.attack;
    if (f.state === 'attack' && a && (a.name === 'awayend_shieldcharge' || a.name === 'awayend_clothesline')) {
      const st = a.startup ?? a.def.startup;
      if (a.phase <= 1 && a.t > st + 0.1) {
        const moved = Math.hypot(f.x - (ai.lx ?? f.x), f.y - (ai.ly ?? f.y));
        if (moved < a.def.lunge * dt * 0.25) { bossCrash(f, world, ai); ai.lx = ai.ly = undefined; return true; }
      }
      ai.lx = f.x; ai.ly = f.y;
      I.mx = I.my = 0;
      return true;
    }
    // --- wind-ups: keep aiming at the player, then launch
    if (f.state === 'attack' && a && (a.name === 'awayend_chargewind' || a.name === 'awayend_linewind')) {
      f.data.freeTurn = true;
      if (a.t < (a.startup ?? a.def.startup) * 0.8) f.face2(dx, dy);
      ai.pending = a.name === 'awayend_chargewind' ? 'awayend_shieldcharge' : 'awayend_clothesline';
      I.mx = I.my = 0;
      return true;
    }
    if (ai.pending && f.canAct) {
      I.attackName = ai.pending; ai.pending = null;
      ai.lx = f.x; ai.ly = f.y;
      I.mx = I.my = 0;
      return true;
    }
    ai.pending = null;
    // --- whistle: summons stewards
    if (f.state === 'attack' && a && a.name === 'awayend_whistle') {
      I.mx = I.my = 0;
      if (a.phase >= 1 && !a.called) {
        a.called = true;
        awayendWhistle(world, f, true);
        const n = summonStewards(f, world);
        world.message('PHWEEEEEET!', n ? 'STEWARDS! TO ME!' : 'NOBODY CAME...', 1.4, '#ffe14a');
      }
      return true;
    }
    // --- ejection grab (phase 2): grab and launch the player
    if (f.state === 'grabbing' && f.grabbing) {
      I.mx = I.my = 0;
      if (!ai.ejectSaid) { ai.ejectSaid = true; f.say('RED CARD! OUT!', 1.2); world.sfx('bossRoar', f); }
      if (f.stateT > 0.55) I.grab = true;
      return true;
    }
    ai.ejectSaid = false;
    if (!p.alive || !f.canAct || ai.goal) return false;
    const pDown = p.isDown || p.state === 'getup' || p.state === 'grabbed' || p.state === 'thrown';
    const los = world.hasLOS(f.x, f.y, p.x, p.y);

    if (ai.whistleCd <= 0 && !pDown) {
      const minions = world.fighters.filter(o => o.team !== 'player' && o.alive && o !== f).length;
      ai.whistleCd = ai.phase2 ? 14 : 12;
      if (minions < 2) {
        f.face2(dx, dy);
        I.attackName = 'awayend_whistle'; I.mx = I.my = 0;
        f.say('PHWEEEET!', 1.0);
        return true;
      }
    }
    if (!ai.phase2) {
      if (ai.chargeCd <= 0 && d > 2.4 && d < 8.5 && los && !pDown) {
        ai.chargeCd = 4.6 + Math.random() * 1.5;
        f.data.freeTurn = true; f.face2(dx, dy);
        I.attackName = 'awayend_chargewind'; I.mx = I.my = 0;
        world.message('SHIELD CHARGE!', 'DODGE IT - LET HIM HIT THE WALL', 1.1, '#ff6a3a');
        world.sfx('bossRoar', f);
        f.say('STAND BACK!', 0.9);
        return true;
      }
    } else {
      if (ai.lineCd <= 0 && d > 2.2 && d < 8 && los && !pDown) {
        ai.lineCd = 3.6 + Math.random() * 1.4;
        f.face2(dx, dy);
        I.attackName = 'awayend_linewind'; I.mx = I.my = 0;
        world.message('CLOTHESLINE!', '', 0.9, '#ff6a3a');
        world.sfx('bossRoar', f);
        f.say('HAVE SOME OF THIS!', 0.9);
        return true;
      }
      if (ai.grabCd <= 0 && d < 1.15 && !pDown && p.state !== 'jump') {
        ai.grabCd = 5 + Math.random() * 2;
        f.face2(dx, dy);
        I.grab = true; I.mx = I.my = 0;
        return true;
      }
    }
    return false;
  },
});
