// THE UNDERGROUND (Level 3): new enemies, attacks, poses and the boss GAFFER GUNNAR.
// All ids start with 'underground_'. Talks to the level through world.ug (set in the level's onStart):
//   world.ug.warn = { p: seconds, d: seconds }   train-approach warnings per zone
//   world.ug.requestTrain(zone, source)          ask the level to send a train ('d' = depot)
//   world.ug.depotLive                           live rail in the depot energised
//   world.ug.depotLaneY                          y of the depot track centre line

import { registerEnemy, casualLook, RIVAL, AWAY, RIVAL_KIT } from '../enemies.js';
import { registerAttack } from '../../game/combat.js';
import { registerAttackPose, registerAnim, GUARD, STAND } from '../../game/poses.js';
import { toScreen } from '../../engine/iso.js';

// ------------------------------------------------------------------ attacks
registerAttack('underground_handleSwing', { pose: 'underground_overhead', startup: 0.17, active: 0.1, recovery: 0.27, dmg: 13, reach: 1.55, arc: 1.0, kb: 3.6, stun: 0.5, weapon: true, sfx: 'weapon', whiff: 'whooshBig', hz: 1.5, hitstop: 0.08, shake: 4, score: 30 });
registerAttack('underground_bigSweep', { pose: 'underground_sweepSpin', startup: 0.78, active: 0.2, recovery: 0.55, dmg: 18, reach: 1.95, arc: Math.PI, kb: 6.5, stun: 0.6, knockdown: true, launch: 3, guardDmg: 45, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.2, hitstop: 0.11, shake: 7, score: 0 });
registerAttack('underground_shove', { pose: 'push', startup: 0.32, active: 0.12, recovery: 0.42, dmg: 6, reach: 1.25, arc: 0.9, kb: 10, stun: 0.6, knockdown: true, launch: 1, guardDmg: 50, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.2, hitstop: 0.06, shake: 4, score: 0 });
registerAttack('underground_fine', { pose: 'underground_fine', startup: 0.2, active: 0.08, recovery: 0.22, dmg: 6, reach: 1.0, arc: 0.8, kb: 2, stun: 0.38, sfx: 'slap', whiff: 'whooshLight', hz: 1.7, score: 0 });
registerAttack('underground_ratSlide', { pose: 'underground_slide', startup: 0.15, active: 0.22, recovery: 0.32, dmg: 7, reach: 1.0, arc: 0.7, kb: 3, stun: 0.4, knockdown: true, launch: 1.5, lunge: 6, sfx: 'kick', whiff: 'whoosh', hz: 0.4, hitstop: 0.05, shake: 2, score: 0 });
registerAttack('underground_headRush', { pose: 'headbutt', startup: 0.3, active: 0.12, recovery: 0.36, dmg: 10, reach: 1.0, arc: 0.8, kb: 4, stun: 0.5, lunge: 4.5, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.8, hitstop: 0.07, shake: 3, score: 0 });

// ------------------------------------------------------------------ poses
registerAttackPose('underground_overhead', {
  windup: { ...GUARD, uaN: 3.0, faN: 0.4, uaF: 2.8, faF: 0.5, lean: -0.25, dy: 1 },
  hit: { ...GUARD, uaN: 1.0, faN: 0.05, uaF: 1.0, faF: 0.1, lean: 0.45, dx: 3, thN: 0.5, knN: 0.3 },
});
registerAttackPose('underground_sweepSpin', {
  windup: { ...GUARD, lean: -0.3, dy: 4, uaN: -1.5, faN: 0.3, uaF: -1.2, faF: 0.4, thN: 0.5, knN: 0.8, thF: -0.4, knF: 0.6, head: 0.2 },
  hit: { lean: 0.4, dx: 3, dy: 2, uaN: 1.6, faN: 0.05, uaF: 1.5, faF: 0.1, thN: 0.6, knN: 0.4, thF: -0.5, knF: 0.3, flip: 1 },
});
registerAttackPose('underground_fine', {
  windup: { ...GUARD, uaN: 2.5, faN: 1.5, lean: -0.15 },
  hit: { ...GUARD, uaN: 1.1, faN: 0.15, lean: 0.3, dx: 2 },
});
registerAttackPose('underground_slide', {
  windup: { ...GUARD, lean: -0.2, dy: 4, thN: 0.6, knN: 1.3, thF: -0.2, knF: 1.0 },
  hit: { lean: -0.6, rot: -0.55, dy: 10, thN: 1.5, knN: 0, thF: 0.7, knF: 1.3, uaN: -0.7, faN: 0.4, uaF: 0.5, faF: 0.6 },
});
registerAnim('underground_crouch', { loop: true, frames: [[0.12, { lean: 0.45, dy: 7, thN: 0.9, knN: 1.7, thF: 0.4, knF: 1.5, uaN: -0.6, faN: 0.6, uaF: -0.5, faF: 0.6 }], [0.12, { lean: 0.5, dy: 8, thN: 1.0, knN: 1.8, thF: 0.45, knF: 1.6, uaN: -0.7, faN: 0.6, uaF: -0.6, faF: 0.6 }]] });
registerAnim('underground_radio', { loop: true, frames: [[0.3, { ...STAND, lean: -0.1, uaN: 2.3, faN: 2.4, head: -0.2, uaF: 1.4, faF: 1.9 }], [0.3, { ...STAND, lean: -0.05, uaN: 2.4, faN: 2.5, head: -0.25, uaF: 2.6, faF: 0.4 }]] });
registerAnim('underground_ticketPlease', { loop: true, frames: [[0.25, { ...STAND, uaN: 1.5, faN: 0.2, head: 0.1 }], [0.25, { ...STAND, uaN: 1.6, faN: 0.3, head: 0.15 }]] });

// ------------------------------------------------------------------ helpers
const FINE_LINES = ['FINED £', 'PENALTY FARE £', 'TICKET? £'];

// telegraph ring on the ground (actor drawn under everything). pos: {x,y} or () => {x,y}
export function groundRing(world, pos, r, dur, color = '#ff4a2a') {
  return world.addActor({
    x: 0, y: 0, t: 0, removed: false,
    update(w, dt) { this.t += dt; if (this.t > dur) this.removed = true; },
    depth() { return -1e6; },
    draw(ctx) {
      const q = typeof pos === 'function' ? pos() : pos;
      if (!q) return;
      const s = toScreen(q.x, q.y, 0);
      const k = Math.min(1, this.t / dur);
      const rx = r * 16 * 1.414, ry = r * 8 * 1.414;
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.floor(this.t * 12) % 2 ? 0.9 : 0.5;
      const n = 56;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        ctx.fillRect(Math.round(s.x + Math.cos(a) * rx), Math.round(s.y + Math.sin(a) * ry), 2, 1);
      }
      ctx.globalAlpha = 0.18 * k;
      for (let y = -Math.ceil(ry * k); y <= Math.ceil(ry * k); y++) {
        const t2 = 1 - (y * y) / ((ry * k) ** 2 || 1);
        if (t2 < 0) continue;
        const w = Math.round(rx * k * Math.sqrt(t2));
        ctx.fillRect(Math.round(s.x - w), Math.round(s.y + y), w * 2, 1);
      }
      ctx.globalAlpha = 1;
    },
  });
}

// grab routine used by inspectors & headcases: knee/headbutt a couple of times, then throw
function grabCombo(f, world, dt, ai, moves) {
  if (f.state !== 'grabbing') { ai.gStep = 0; ai.gT = 0; return false; }
  const I = f.intent;
  I.mx = I.my = 0;
  ai.gT = (ai.gT || 0) + dt;
  if (ai.gT > 0.42) {
    ai.gT = 0;
    if ((ai.gStep || 0) < moves.length) { I.attackName = moves[ai.gStep]; ai.gStep = (ai.gStep || 0) + 1; }
    else { I.grab = true; ai.gStep = 0; }
  }
  return true;
}

function ventNear(world, x, y, r = 2.5) {
  let best = null, bd = r;
  for (const p of world.props) {
    if (p.type !== 'underground_vent' || p.removed) continue;
    const d = Math.hypot(p.cx - x, p.cy - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ------------------------------------------------------------------ regular enemies
registerEnemy('underground_lad', {
  name: 'PORTSIDE TUBE LAD', hp: 42, speed: 2.7, runSpeed: 4.9, power: 0.92, score: 130,
  look: rng => casualLook(rng, { a: RIVAL.a, b: RIVAL.b }),
  ai: { aggression: 0.55, reaction: 0.32, attacks: [['jab', 3], ['cross', 2], ['hook', 1], ['kick', 1]], comboLen: [1, 3], blockChance: 0.12, dodgeChance: 0.05, keepDist: 2.2, useWeapons: true, runChance: 0.35 },
  drops: [['coin', 0.45], ['pint', 0.06]],
});

registerEnemy('underground_headcase', {
  name: 'VARGBY HEADCASE', hp: 50, speed: 3.0, runSpeed: 5.4, power: 1.0, score: 170, guard: 30,
  look: rng => casualLook(rng, { a: AWAY.a, b: AWAY.b, hair: ['skinhead', 'shaved'], build: rng.range(1.05, 1.25) }),
  ai: { aggression: 0.75, reaction: 0.26, attacks: [['jab', 2], ['cross', 2], ['underground_headRush', 2], ['kick', 1]], comboLen: [1, 3], blockChance: 0.05, runChance: 0.55, grabChance: 0.1, keepDist: 1.9, taunt: 0.15 },
  drops: [['coin', 0.5], ['cash5', 0.12], ['pie', 0.06]],
  think(f, world, dt, ai) { return grabCombo(f, world, dt, ai, ['headbutt', 'headbutt']); },
});

registerEnemy('underground_inspector', {
  name: 'TICKET INSPECTOR', hp: 60, speed: 2.5, runSpeed: 4.6, power: 1.0, guard: 60, score: 220, weight: 1.15,
  look: rng => ({
    skin: rng.pick(['#e2a97a', '#d49a6a', '#f0c098', '#b87a50']), hair: { style: rng.pick(['crop', 'bald', 'flattop']), color: rng.pick(['#3a2717', '#5a5a5a', '#141016']) },
    facial: rng.pick(['tache', 'tache', 'none', 'beard']), hat: { style: 'cap', color: '#1a2440' },
    jacket: { style: 'suit', color: '#1a2440', trim: '#d8b020' }, shirt: '#c8d8f0',
    pants: { style: 'suit', color: '#1a2440' }, shoes: { color: '#121214', sole: '#222' },
    scarf: null, gloves: null, shades: false, build: rng.range(1.1, 1.3), height: rng.range(1.0, 1.06),
  }),
  ai: { aggression: 0.5, reaction: 0.32, attacks: [['underground_fine', 3], ['push', 2], ['jab', 1]], comboLen: [1, 2], blockChance: 0.42, dodgeChance: 0.02, grabChance: 0.14, keepDist: 2.0, taunt: 0.1 },
  drops: [['coin', 0.6], ['cash5', 0.2], ['underground_tea', 0.12]],
  onSpawn(f) { f.tauntAnim = 'underground_ticketPlease'; f.tauntTime = 1.1; },
  think(f, world, dt, ai) {
    const p = world.player;
    if (p && f.attack && f.attack.name === 'underground_fine' && f.attack.hit.has(p) && !f.attack.fined) {
      f.attack.fined = true;
      const g = world.game;
      const amt = Math.min(g.cash || 0, 5);
      g.cash = (g.cash || 0) - amt;
      world.fx.popup(p.x, p.y, p.z + 2.3, amt ? FINE_LINES[Math.floor(Math.random() * FINE_LINES.length)] + amt : 'NO TICKET!', '#ff6a5a');
    }
    if (f.state === 'grabbing' && !ai.saidTicket && p) { ai.saidTicket = true; world.fx.popup(f.x, f.y, f.z + 2.6, 'TICKET PLEASE!', '#ffe14a'); }
    if (f.state !== 'grabbing') ai.saidTicket = false;
    return grabCombo(f, world, dt, ai, ['knee', 'knee']);
  },
});

registerEnemy('underground_rat', {
  name: 'TUNNEL RAT', hp: 28, speed: 3.6, runSpeed: 6.2, power: 0.8, weight: 0.8, score: 140, guard: 15,
  look: rng => ({
    ...casualLook(rng, { scarf: null, hatChance: 0.6, hair: ['mohawk', 'spiky', 'shaved', 'long'] }),
    jacket: { style: 'track', color: rng.pick(['#2a2a22', '#3a3020', '#2a3a2a', '#3a2a3a']), trim: '#7a7a6a' },
    pants: { style: 'trackies', color: rng.pick(['#3a3a3a', '#2a2a30', '#4a4030']) },
    shoes: { color: rng.pick(['#5a5a50', '#2a2a2a']), sole: '#7a7060' },
    gloves: '#2a2a26', build: rng.range(0.8, 0.9), height: rng.range(0.86, 0.92),
  }),
  ai: { aggression: 0.72, reaction: 0.22, attacks: [['lowKick', 3], ['underground_ratSlide', 2], ['jab', 1]], comboLen: [1, 2], blockChance: 0, dodgeChance: 0.3, grabChance: 0, keepDist: 2.8, runChance: 0.75, taunt: 0.12 },
  drops: [['coin', 0.55], ['cash5', 0.1]],
  onSpawn(f, world, opts) {
    if (!world || !world.props) return;
    const o = (opts && opts.from) || f;
    const v = ventNear(world, o.x, o.y);
    if (v) { v.popT = 1.6; world.sfx && world.sfx('clatter', { x: v.cx, y: v.cy }); }
  },
  think(f, world, dt, ai) {
    // hit and run: after each attack, scurry off for a moment
    if (f.state === 'attack') ai.wasAtk = true;
    else if (ai.wasAtk) {
      ai.wasAtk = false;
      if (Math.random() < 0.75) { ai.fleeT = 0.45 + Math.random() * 0.35; world.releaseToken(f, 0.7); }
    }
    return false;
  },
});

// ------------------------------------------------------------------ BOSS: GAFFER GUNNAR, the night foreman
registerEnemy('underground_gunnar', {
  name: 'GAFFER GUNNAR', boss: true, hp: 380, speed: 2.3, runSpeed: 4.2, power: 1.12, weight: 2.4, superArmor: 8, guard: 85, score: 4000, ungrabbable: true,
  weapon: 'underground_pickhandle',
  look: {
    skin: '#e8b090', hair: { style: 'bald', color: '#b4621c' }, facial: 'beard',
    hat: { style: 'helmet', color: '#f0a020' },
    jacket: { style: 'hivis', color: '#ff7a1a', trim: '#e8e8d8' }, shirt: '#3a3a3a',
    pants: { style: 'cargo', color: '#2a3a4a' }, shoes: { color: '#3a2a1a', sole: '#1a1a1a' },
    scarf: RIVAL_KIT, gloves: '#d8b020', build: 1.6, height: 1.36,
  },
  ai: { aggression: 0.5, reaction: 0.42, attacks: [['haymaker', 2], ['push', 1]], comboLen: [1, 2], blockChance: 0.15, ignoreTokens: true, keepDist: 2.4, runChance: 0.3 },
  drops: [['kebab', 1]],
  onSpawn(f) { if (f.weapon) f.weapon.durability = 1e9; },
  onDeath(f, world) {
    for (const it of world.items) if (it.type === 'underground_pickhandle' && Math.hypot(it.x - f.x, it.y - f.y) < 2) it.durability = 8;
    world.ug && (world.ug.depotLive = false);
  },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p) return false;
    const ug = world.ug || (world.ug = { warn: {} });
    const I = f.intent;
    if ((f.state === 'underground_crouch' || f.state === 'underground_radio') && !ai.spec) f.setState('idle');
    for (const k of ['cdSweep', 'cdLeap', 'cdShove', 'cdRadio']) ai[k] = (ai[k] ?? (k === 'cdLeap' ? 4 : k === 'cdRadio' ? 2 : 2)) - dt;

    // ---- phase change
    if (!ai.phase2 && f.hp < f.maxHp * 0.4 && f.alive) {
      ai.phase2 = true;
      f.speed *= 1.2; f.runSpeed *= 1.15; f.superArmor = 12;
      ug.depotLive = true;
      world.message('GUNNAR HAS LOST IT!', 'HE\'S SWITCHED THE LIVE RAIL BACK ON', 2.2, '#ff4a2a');
      world.sfx('bossRoar', f);
      world.sfx('underground_zap', f);
      world.camera.shake(5, 0.4);
      ai.cdRadio = 0.5;
    }

    // ---- the live rail: he hops over it rather than standing on it (and scrambles off if knocked onto it)
    if (ug.depotLive && ug.depotLaneY !== undefined && f.z < 0.3 && f.alive) {
      const dl = f.y - ug.depotLaneY;
      if (Math.abs(dl) < 0.5) world.moveEntity(f, 0, (dl >= 0 ? 1 : -1) * 4 * dt);
      else if (Math.abs(dl) < 1.15 && f.canAct && !ai.spec && Math.sign(p.y - ug.depotLaneY) !== Math.sign(dl)) {
        I.jump = true; I.mx = 0; I.my = -Math.sign(dl);
        f.face2(p.x - f.x, p.y - f.y);
        return true;
      }
    }

    // ---- special in progress
    if (ai.spec) {
      const s = ai.spec;
      s.t += dt;
      I.mx = I.my = 0;
      if (s.kind === 'leap') {
        if (s.phase === 'crouch') {
          if (f.state !== 'underground_crouch') { ai.spec = null; return false; } // interrupted
          f.vx = f.vy = 0;
          s.tx = p.x; s.ty = p.y;
          f.face2(p.x - f.x, p.y - f.y);
          if (s.t > 0.55) {
            s.phase = 'air'; s.t = 0;
            const T = 0.8, vz = 24 * T / 2;
            let dx = s.tx - f.x, dy = s.ty - f.y; const d = Math.hypot(dx, dy) || 1;
            const reach = Math.min(d, 8.5);
            dx = dx / d * reach; dy = dy / d * reach;
            s.oldRun = f.runSpeed; f.runSpeed = 14;
            f.setState('jump'); f.onGround = false; f.vz = vz;
            f.vx = dx / T; f.vy = dy / T;
            world.sfx('whooshBig', f);
            s.ring = groundRing(world, { x: f.x + dx, y: f.y + dy }, 2.6, 0.85, '#ff4a2a');
          }
          return true;
        }
        if (s.phase === 'air') {
          if (f.state !== 'jump') { if (s.oldRun) f.runSpeed = s.oldRun; ai.spec = null; return false; }
          if (f.onGround && s.t > 0.1) {
            if (s.oldRun) f.runSpeed = s.oldRun;
            f.vx = f.vy = 0;
            // shockwave
            world.sfx('stomp', f); world.sfx('hitHeavy', f);
            world.camera.shake(9, 0.35);
            world.fx.dust(f.x, f.y, 0, 26);
            world.fx.debris(f.x, f.y, 0, ['#4a4c48', '#2a2622', '#7a6a50'], 12);
            for (const t of world.fighters) {
              if (t === f || !t.alive || t.team === f.team || t.z > 0.45) continue;
              const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
              if (d > 2.6 + t.r) continue;
              const dir = d > 0.05 ? { x: dx / d, y: dy / d } : { x: f.fx, y: f.fy };
              const def = { hz: 0.4, sfx: 'hitHeavy', hitstop: 0.08, shake: 6, knockdown: true };
              const dmg = 15 * f.power;
              const res = t.takeHit({ attacker: f, def, name: 'underground_slam', dmg, dir, kb: 5.5, stun: 0.5, knockdown: true, launch: 3.5, unblockable: true, guardDmg: 0 }, world);
              world.onHit(f, t, def, res, dmg);
            }
            ai.spec = null;
            ai.cdLeap = ai.phase2 ? 5 : 7.5;
            return false;
          }
          return true;
        }
      }
      if (s.kind === 'radio') {
        if (f.state !== 'underground_radio') { ai.spec = null; return false; }
        if (!s.sent && s.t > 0.8) {
          s.sent = true;
          if (ug.requestTrain) ug.requestTrain('d', 'boss');
          if (!ai.ratsCalled) {
            ai.ratsCalled = true;
            world.fx.popup(f.x, f.y, f.z + 3.2, 'LADS! OUT OF THE VENTS!', '#ffb030');
            const vents = world.props.filter(v => v.type === 'underground_vent' && v.o.zone === 'd');
            for (const v of vents.slice(0, 2)) {
              const gx = v.o.gx ?? v.cx, gy = v.o.gy ?? v.cy + 1.2;
              world.spawnEnemy('underground_rat', gx, gy, { from: { x: v.cx, y: v.cy + 0.6 }, aggro: true });
            }
          }
        }
        if (s.t > 1.3) { f.setState('idle'); ai.spec = null; }
        return true;
      }
      ai.spec = null;
    }

    if (!f.canAct || f.state === 'attack') return false;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);

    // ---- knows the timetable: steps off the depot track when HIS train is coming
    if (ug.warn && ug.warn.d > 0 && ug.trainSource === 'boss' && ug.depotLaneY !== undefined && Math.abs(f.y - ug.depotLaneY) < 1.8) {
      const away = f.y < ug.depotLaneY ? -1 : 1;
      I.mx = 0; I.my = away; I.run = true;
      return true;
    }

    // ---- radio for a train (phase 2)
    if (ai.phase2 && ai.cdRadio <= 0 && !(ug.warn && ug.warn.d > 0)) {
      ai.cdRadio = 13 + Math.random() * 4;
      ai.spec = { kind: 'radio', t: 0 };
      f.setState('underground_radio'); f.vx = f.vy = 0;
      world.message('"SEND THE 15:02 THROUGH!"', 'GUNNAR RADIOS THE SIGNAL BOX', 1.8, '#ff6a3a');
      world.sfx('underground_whistle', f);
      return true;
    }

    // ---- pick handle sweep (close range, long telegraph)
    if (ai.cdSweep <= 0 && d < 2.1) {
      ai.cdSweep = ai.phase2 ? 3.8 : 5.5;
      f.face2(dx, dy);
      I.mx = I.my = 0;
      I.attackName = 'underground_bigSweep';
      world.fx.popup(f.x, f.y, f.z + 3, 'HAVE SOME OF THIS!', '#ffb030');
      groundRing(world, () => ({ x: f.x, y: f.y }), 1.95, 0.78, '#ffb030');
      world.sfx('bossRoar', f);
      return true;
    }

    // ---- shove (towards the track, loves a cheap trick)
    if (ai.cdShove <= 0 && d < 1.35 && (ai.phase2 || Math.random() < 0.3)) {
      ai.cdShove = ai.phase2 ? 3.2 : 5;
      f.face2(dx, dy);
      I.attackName = 'underground_shove';
      return true;
    }

    // ---- leap slam (mid range)
    if (ai.cdLeap <= 0 && d > 2.8 && d < 8.5 && world.hasLOS(f.x, f.y, p.x, p.y)) {
      ai.spec = { kind: 'leap', phase: 'crouch', t: 0 };
      f.setState('underground_crouch'); f.vx = f.vy = 0;
      f.face2(dx, dy);
      world.message('GUNNAR LEAPS!', 'GET OFF THE GROUND!', 1.0, '#ff6a3a');
      world.sfx('bossRoar', f);
      return true;
    }
    return false;
  },
});
