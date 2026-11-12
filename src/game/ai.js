// Enemy AI controller (data-driven by an enemy def's `ai` block; bosses can add a custom `think`).
//
// def.ai fields (all optional):
//   sight        aggro radius (tiles)                        aggression  0..1 chance to commit to an attack per decision
//   reaction     seconds between decisions                    attacks     [[attackName, weight], ...]
//   comboLen     [min,max] chained attacks                    keepDist    circling distance while waiting for an attack token
//   blockChance  chance to block a player attack it sees coming          dodgeChance chance to dodge instead
//   counterChance chance to counter-attack right after blocking a hit
//   grabChance   chance to grab when adjacent                 useWeapons  walk to & pick up nearby weapons
//   throwChance  chance per decision to lob a projectile when at mid range (needs ATTACKS.throwItem; projectile type in `projectile`)
//   throwCd      min seconds between throws (default 2.6)     kite        back off when the player gets close (ranged types)
//   rushChance   chance per decision to charge in from mid range with `rushAttack` (default 'shoulder'), ignoring tokens
//   flank        0..1 preference for slots behind the player  flee        hp fraction under which it may run off
//   taunt        chance to taunt while circling               ignoreTokens attack regardless of the shared attack-token limit (bosses)
//   runChance    chance to run (not walk) when closing in     approachRange  distance at which it starts attacking (default from attack reach)
//   shouts       { aggro:[...], taunt:[...], rush:[...], hurt:[...] } speech-bubble lines (UPPERCASE)
//
// Group behaviour: all aggro enemies around the player are given evenly spread "slots" (angles) so they surround
// and flank instead of queueing on one side. Only token holders (world.diff.tokens) attack; the rest circle at
// keepDist, taunt and wait. Rushers occasionally charge in from range (one at a time, announced with a shout).
// Difficulty (save.data.settings.difficulty) scales reaction time, aggression, blocking and rushing.
//
// def.think(f, world, dt, ai) -> true to skip the default behaviour this step (bosses' specials).
// ai.base(f, world, dt) runs the default behaviour; ai.shout(f, world, textOrList, chance) shows a speech bubble.

import { save } from '../save.js';
import { ATTACKS } from './combat.js';

export const DEFAULT_AI = {
  sight: 8, aggression: 0.55, reaction: 0.32,
  attacks: [['jab', 3], ['cross', 2], ['kick', 1]], comboLen: [1, 2],
  blockChance: 0.12, dodgeChance: 0.04, counterChance: 0, grabChance: 0.04, keepDist: 2.3,
  useWeapons: false, throwChance: 0, throwCd: 2.6, projectile: 'bottle', kite: false, flee: 0, taunt: 0.08, ignoreTokens: false, runChance: 0.2,
  rushChance: 0, rushAttack: 'shoulder', flank: 0, shouts: null,
};

export const DIFF_AI = {
  easy: { react: 1.35, aggr: 0.7, block: 0.5, rush: 0.4 },
  normal: { react: 1.0, aggr: 1.0, block: 1.0, rush: 1.0 },
  hard: { react: 0.88, aggr: 1.15, block: 1.25, rush: 1.3 },
};

const GENERIC_SHOUTS = {
  aggro: ['OI!', 'THAT\'S HIM!', 'COME HERE YOU!', 'GET HIM LADS!'],
  taunt: ['COME ON THEN!', 'YOU WHAT?', 'IS THAT IT?', 'HAVE SOME!', 'GO ON THEN!'],
  rush: ['OI OI!', 'HAVE IT!', 'RAAAH!'],
  hurt: ['OOF!', 'ME NOSE!', 'OW!'],
};

function weighted(list) {
  let tot = 0;
  for (const [, w] of list) tot += w;
  let r = Math.random() * tot;
  for (const [n, w] of list) { r -= w; if (r <= 0) return n; }
  return list[0][0];
}

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ------------------------------------------------------------------ group coordination (per world)
function group(world) {
  return world._aiGroup || (world._aiGroup = { t: -1, sayT: 0, rushT: 0, rusher: null });
}

function updateGroup(world) {
  const g = group(world);
  if (world.time - g.t < 0.25) return g;
  g.t = world.time;
  const p = world.player;
  if (!p) return g;
  const mem = [];
  for (const f of world.fighters) {
    const c = f.controller;
    if (!(c instanceof AIController) || !f.alive || f.removed || !c.aggro || c.goal || c.fleeT > 0) continue;
    const d = Math.hypot(f.x - p.x, f.y - p.y);
    if (d > 9) continue;
    mem.push({ f, c, a: Math.atan2(f.y - p.y, f.x - p.x) });
  }
  const n = mem.length;
  if (!n) return g;
  mem.sort((u, v) => u.a - v.a);
  const step = TAU / n;
  // best rotation of evenly spaced slots = circular mean of (angle_i - i*step)
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += Math.cos(mem[i].a - i * step); sy += Math.sin(mem[i].a - i * step); }
  let base = Math.atan2(sy, sx);
  // flankers pull the formation toward the player's back a little
  let fl = 0;
  for (const m of mem) fl = Math.max(fl, m.c.ai.flank || 0);
  if (fl > 0 && n > 1) {
    const back = Math.atan2(-p.fy, -p.fx);
    // rotate so the nearest slot to the back moves partway toward it
    let bestD = 9;
    for (let i = 0; i < n; i++) { const d = angDiff(back, base + i * step); if (Math.abs(d) < Math.abs(bestD)) bestD = d; }
    base += bestD * fl * 0.5;
  }
  for (let i = 0; i < n; i++) mem[i].c.slotA = base + i * step;
  g.count = n;
  return g;
}

export class AIController {
  constructor(def = {}) {
    this.def = def;
    this.ai = { ...DEFAULT_AI, ...(def.ai || {}) };
    this.dm = DIFF_AI[save.data.settings && save.data.settings.difficulty] || DIFF_AI.normal;
    this.think = Math.random() * 0.3;
    this.aggro = false;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.combo = 0;
    this.blockT = 0;
    this.stuckT = 0; this.lastX = 0; this.lastY = 0;
    this.detour = null; this.detourT = 0;
    this.fleeT = 0;
    this.goal = null;      // optional scripted walk target {x,y}
    this.mode = 'normal';
    this.t = 0;
    this.slotA = null;
    this.tokenT = 0;
    this.throwT = 1 + Math.random() * 1.5;
    this.rushT = 0;
    this.seenAtk = null;
    this.grabStepT = 0; this.grabKnees = 0;
    this.settleT = 0;
    this.saidAggro = false;
  }

  update(f, world, dt) {
    const I = f.intent;
    I.attack = null; I.attackName = null; I.jump = false; I.dodge = false; I.grab = false; I.use = false; I.taunt = false; I.run = false;
    this.t += dt;
    if (!f.alive) { I.mx = I.my = 0; I.block = false; return; }
    if (this.def.think && this.def.think(f, world, dt, this) === true) return;
    this.base(f, world, dt);
  }

  // speech bubble with a global rate limit so the screen doesn't fill with text
  shout(f, world, what, chance = 1) {
    if (!what || Math.random() > chance || !f.say) return false;
    const g = group(world);
    if (world.time < g.sayT && !f.boss) return false;
    const text = Array.isArray(what) ? what[Math.floor(Math.random() * what.length)] : what;
    if (!text) return false;
    f.say(text, 1.1);
    g.sayT = world.time + 1.8 + Math.random() * 1.5;
    return true;
  }

  lines(kind) {
    const s = this.ai.shouts;
    if (s === false) return null;
    return (s && s[kind]) || GENERIC_SHOUTS[kind];
  }

  // The default behaviour; bosses can call ai.base(f, world, dt) from their think().
  base(f, world, dt) {
    const I = f.intent, A = this.ai, D = this.dm;
    const p = world.player;

    // scripted walk-in (spawned off-screen / through doors)
    if (this.goal) {
      if (this.goalSet !== this.goal) { this.goalSet = this.goal; this.goalT = this.t; }
      const dx = this.goal.x - f.x, dy = this.goal.y - f.y, d = Math.hypot(dx, dy);
      if (d < 0.3 || this.t - this.goalT > Math.max(4, d / Math.max(1, f.runSpeed) + 2)) { this.goal = null; f.noclip = false; this.aggro = true; }
      else { I.mx = dx / d; I.my = dy / d; I.run = true; return; }
    }

    if (!p || !p.alive || p.state === 'dead') {
      I.mx = I.my = 0; I.block = false;
      if (f.canAct && Math.random() < 0.01) { I.taunt = true; this.shout(f, world, this.lines('taunt'), 0.3); }
      world.releaseToken(f);
      return;
    }

    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 0.001;
    if (!this.aggro) {
      if (dist < A.sight && world.hasLOS(f.x, f.y, p.x, p.y)) this.aggro = true;
      else if (dist < 2) this.aggro = true;
      else { I.mx = I.my = 0; I.block = false; f.combat = false; return; }
      world.alertNear && world.alertNear(f, 4);
    }
    if (!this.saidAggro) { this.saidAggro = true; this.shout(f, world, this.lines('aggro'), 0.35); }
    f.combat = dist < 6;
    updateGroup(world);

    // holding someone: knee them a couple of times, then throw
    if (f.state === 'grabbing') {
      I.mx = I.my = 0; I.block = false;
      this.grabStepT -= dt;
      if (this.grabStepT <= 0 && f.stateT > 0.2) {
        this.grabStepT = 0.42 * D.react;
        if (this.grabKnees >= 2 || Math.random() < 0.25) { I.grab = true; this.grabKnees = 0; }
        else { I.attackName = 'knee'; this.grabKnees++; }
      }
      return;
    }
    this.grabKnees = 0;

    // block hold timer (+ counter-attack once a hit has been blocked)
    if (this.blockT > 0) {
      this.blockT -= dt;
      if (f.counterT > 0 && A.counterChance && Math.random() < A.counterChance * D.block * dt * 10) {
        this.blockT = 0; I.block = false; I.attackName = 'counter';
        if (f.canAct || f.state === 'blockstun') f.face2(dx, dy);
        return;
      }
      I.block = true; I.mx = I.my = 0;
      if (f.canAct) f.face2(dx, dy);
      return;
    }
    I.block = false;

    // react (once) to each player attack we see coming
    if (p.state === 'attack' && p.attack && p.attack !== this.seenAtk) {
      this.seenAtk = p.attack;
      if (f.canAct && dist < 2.0 && p.attack.phase === 0 && !p.attack.def.grab) {
        const facingMe = (p.fx * -dx + p.fy * -dy) / dist > 0.45;
        if (facingMe) {
          const r = Math.random();
          if (r < A.blockChance * D.block) { this.blockT = 0.32 + Math.random() * 0.25; I.block = true; f.face2(dx, dy); return; }
          if (r < (A.blockChance + A.dodgeChance) * D.block) {
            I.dodge = true;
            const side = Math.random() < 0.5 ? 1 : -1;
            I.mx = -dx / dist * 0.6 + -dy / dist * side * 0.8; I.my = -dy / dist * 0.6 + dx / dist * side * 0.8;
            return;
          }
        }
      }
    }

    if (f.state === 'attack') { this.continueCombo(f); this.wasAttacking = true; return; }
    if (this.wasAttacking) {
      this.wasAttacking = false;
      this.rushT = 0;
      if (this.combo <= 0 && Math.random() < 0.75) world.releaseToken(f, (0.6 + Math.random() * 0.9) * D.react);
    }
    if (!f.canAct) {
      if (f.state === 'hurt' || f.isDown) world.releaseToken(f, 0.4);
      if (f.state === 'hurt' && f.stateT < 0.02 && f.hp < f.maxHp * 0.5) this.shout(f, world, this.lines('hurt'), 0.12);
      return;
    }

    // flee when low
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      I.mx = -dx / dist; I.my = -dy / dist; I.run = true;
      return;
    }
    if (A.flee && f.hp < f.maxHp * A.flee && Math.random() < 0.004) { this.fleeT = 1.2; world.releaseToken(f); }

    // weapons
    if (A.useWeapons && !f.weapon) {
      const w = world.nearestWeapon(f.x, f.y, 3.5);
      if (w && dist > 1.6) {
        const wx = w.x - f.x, wy = w.y - f.y, wd = Math.hypot(wx, wy);
        if (wd < 0.6) { world.pickupWeapon(f, w); return; }
        this.moveToward(f, world, w.x, w.y, dt, false);
        return;
      }
    }

    const g = group(world);
    const pDown = p.isDown || p.state === 'getup' || p.state === 'grabbed';

    // rushing in (shoulder charge / flying attack) — ignores tokens, one rusher at a time
    if (this.rushT > 0) {
      this.rushT -= dt;
      if (pDown) { this.rushT = 0; }
      else if (dist < (this.rushRange ??= (ATTACKS[A.rushAttack] && ATTACKS[A.rushAttack].leap ? 2.6 : 1.55))) {
        f.face2(dx, dy);
        I.attackName = A.rushAttack || 'shoulder';
        this.rushT = 0;
        return;
      } else { this.moveToward(f, world, p.x, p.y, dt, true); return; }
    }

    this.think -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    const hasToken = A.ignoreTokens || world.hasToken(f);
    if (hasToken) this.tokenT += dt; else this.tokenT = 0;
    const reach = this.attackReach(f);

    if (this.think <= 0) {
      this.think = A.reaction * D.react * (0.7 + Math.random() * 0.6);
      if (Math.random() < 0.15) this.strafe *= -1;
      // ranged throw
      if (A.throwChance && this.throwT <= 0 && dist > 2.5 && dist < 7 && !pDown && Math.random() < A.throwChance && world.hasLOS(f.x, f.y, p.x, p.y)) {
        f.face2(dx, dy);
        I.attackName = 'throwItem';
        f.data.projectile = A.projectile;
        this.throwT = A.throwCd * (0.8 + Math.random() * 0.5) * D.react;
        return;
      }
      // rush in from mid range
      if (A.rushChance && !hasToken && !pDown && dist > 2.6 && dist < 6.5 && world.time > g.rushT &&
          Math.random() < A.rushChance * D.rush && world.hasLOS(f.x, f.y, p.x, p.y)) {
        g.rushT = world.time + 3.5 / D.rush;
        this.rushT = 1.6;
        this.shout(f, world, this.lines('rush'), 0.8);
        return;
      }
      if (!hasToken && !A.ignoreTokens) world.requestToken(f);
      if (A.taunt && !hasToken && dist < 4.5 && Math.random() < A.taunt) {
        I.taunt = true; f.face2(dx, dy);
        this.shout(f, world, this.lines('taunt'), 0.45);
        return;
      }
    }

    // token held for ages without landing anything -> give someone else a go
    if (!A.ignoreTokens && hasToken && this.tokenT > 3.5) { world.releaseToken(f, 1.2); this.tokenT = 0; }

    if (hasToken || A.ignoreTokens) {
      if (pDown) { this.hover(f, world, dt, Math.max(reach + 0.6, 1.6)); return; }
      if (dist <= reach) {
        f.face2(dx, dy);
        this.settleT += dt;
        if (this.settleT > 0.08 && this.think <= A.reaction * 0.5 && Math.random() < A.aggression * D.aggr * dt * 12) {
          this.settleT = 0;
          if (A.grabChance && dist < 0.95 && !f.weapon && !p.ungrabbable && Math.random() < A.grabChance * 3) { I.grab = true; return; }
          const name = f.weapon ? (f.weapon.def.weapon.attack || 'swing') : weighted(A.attacks);
          I.attackName = name;
          this.combo = Math.floor(A.comboLen[0] + Math.random() * (A.comboLen[1] - A.comboLen[0] + 1)) - 1;
          this.think = A.reaction * D.react;
          return;
        }
        I.mx = I.my = 0;
        return;
      }
      this.settleT = 0;
      // approach through our slot so attackers come from different sides
      let tx = p.x, ty = p.y;
      if (this.slotA !== null && dist < 4.5) {
        const myA = Math.atan2(-dy, -dx);
        const off = angDiff(this.slotA, myA);
        // swing round the player when our slot is on the other side
        const a = Math.abs(off) > 0.9 ? myA + Math.sign(off) * 0.9 : this.slotA;
        const r = Math.abs(off) > 0.9 ? Math.max(reach + 0.4, Math.min(dist, 2.0)) : reach * 0.7;
        tx = p.x + Math.cos(a) * r; ty = p.y + Math.sin(a) * r;
      }
      this.moveToward(f, world, tx, ty, dt, Math.random() < A.runChance && dist > 3);
      return;
    }

    // waiting for a token: hold a spread-out slot at keepDist, strafe, taunt
    const want = A.keepDist + (f.id % 3) * 0.3;
    if (A.kite && dist < want - 0.8) {
      const side = this.strafe;
      I.mx = -dx / dist * 0.9 + -dy / dist * side * 0.4; I.my = -dy / dist * 0.9 + dx / dist * side * 0.4;
      const l = Math.hypot(I.mx, I.my) || 1; I.mx /= l; I.my /= l;
      f.face2(dx, dy);
      this.checkStuck(f, dt);
      return;
    }
    this.hover(f, world, dt, want);
  }

  // stay around our slot at radius `want` from the player, facing them
  hover(f, world, dt, want) {
    const I = f.intent, p = world.player;
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 0.001;
    if (dist > 6.5) { this.moveToward(f, world, p.x, p.y, dt, dist > 8); f.face2(dx, dy); return; }
    const a = this.slotA !== null ? this.slotA : Math.atan2(-dy, -dx);
    const tx = p.x + Math.cos(a) * want, ty = p.y + Math.sin(a) * want;
    const ex = tx - f.x, ey = ty - f.y, ed = Math.hypot(ex, ey);
    let mx = 0, my = 0;
    if (ed > 0.45) { mx = ex / ed; my = ey / ed; }
    // keep out of the player's face while repositioning
    if (dist < want - 0.6) { mx -= dx / dist * 0.8; my -= dy / dist * 0.8; }
    // gentle side-to-side bob while waiting
    const bob = Math.sin(this.t * 1.7 + f.id) * 0.35;
    mx += -dy / dist * bob * this.strafe; my += dx / dist * bob * this.strafe;
    const l = Math.hypot(mx, my);
    if (l > 0.12) {
      if (!(world.hasWalkLine ? world.hasWalkLine(f.x, f.y, tx, ty) : world.hasLOS(f.x, f.y, tx, ty))) { this.moveToward(f, world, tx, ty, dt, false); }
      else { const sp = ed > 1.5 ? 0.85 : 0.55; I.mx = mx / l * sp; I.my = my / l * sp; this.checkStuck(f, dt); }
    } else { I.mx = I.my = 0; }
    f.face2(dx, dy);
  }

  // continue a combo while in an attack
  continueCombo(f) {
    if (this.combo > 0 && f.state === 'attack' && f.attack && f.attack.phase >= 1 && f.attack.hit.size > 0) {
      this.combo--;
      f.intent.attackName = f.weapon ? (f.weapon.def.weapon.attack || 'swing') : weighted(this.ai.attacks);
    }
  }

  attackReach(f) {
    if (this.ai.approachRange) return this.ai.approachRange;
    if (f.weapon) return (f.weapon.def.weapon.reach || 1.2) * 0.9;
    return 0.95 * (f.reachMul || 1) + 0.05;
  }

  moveToward(f, world, tx, ty, dt, run) {
    const I = f.intent;
    let dx = tx - f.x, dy = ty - f.y;
    if (this.detourT > 0 && this.detour) {
      this.detourT -= dt;
      I.mx = this.detour.x; I.my = this.detour.y; I.run = run;
      return;
    }
    if (!(world.hasWalkLine ? world.hasWalkLine(f.x, f.y, tx, ty) : world.hasLOS(f.x, f.y, tx, ty))) {
      const fd = world.flowDir(f.x, f.y);
      if (fd) { dx = fd.x; dy = fd.y; }
    }
    const l = Math.hypot(dx, dy) || 1;
    I.mx = dx / l; I.my = dy / l; I.run = run;
    this.checkStuck(f, dt);
  }

  checkStuck(f, dt) {
    const moved = Math.hypot(f.x - this.lastX, f.y - this.lastY);
    this.lastX = f.x; this.lastY = f.y;
    const wants = Math.hypot(f.intent.mx, f.intent.my) > 0.3;
    if (wants && moved < 0.2 * dt && f.state !== 'attack') {
      this.stuckT += dt;
      if (this.stuckT > 0.35) {
        const a = Math.random() * Math.PI * 2;
        this.detour = { x: Math.cos(a), y: Math.sin(a) };
        this.detourT = 0.4;
        this.stuckT = 0;
        this.strafe *= -1;
      }
    } else this.stuckT = 0;
  }
}
