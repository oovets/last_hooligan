// THE FIRM — your lads in the fight (phase C, docs/DESIGN-V2.md).
//
// The player still fights as their own character; 2-4 lads (the other playable characters) come along, fight on their
// own with the normal AI and follow ORDERS:
//   follow  "WITH ME!"        stay around the leader, pile in on anything close
//   charge  "GET INTO THEM!"  go for the nearest enemy anywhere nearby
//   hold    "HOLD!"           stand your ground where you are (fight what comes close)
//   move    "OVER THERE!"     run to a point, then hold it
//   attack  "HAVE HIM!"       go for one specific enemy
//   sing    "SING UP!"        (instant) nerve boost for everyone near the leader, 15s cooldown
//
// NERVE (0..100) on lads and enemies: drains when outnumbered, when hit and when a mate goes down; recovers near the
// leader and when the other side drops. At 0 a fighter breaks and runs: lads come back after a few seconds, enemies
// leg it and are gone ("RAN OFF!"). Knocking out an enemy elite/top boy hits every enemy around him hard.
//
// Lads who are knocked out stay down until the current encounter is won, then get back up.
// World integration: world.firm (null when disabled), see World constructor / update / onHit / onDeath / clearEncounter.

import { Fighter } from './fighter.js';
import { AIController } from './ai.js';
import { CHARACTERS, characterById } from '../content/characters.js';
import { audio } from '../audio/audio.js';
import { save } from '../save.js';

export const ORDER_TEXT = { follow: 'WITH ME!', charge: 'GET INTO THEM!', hold: 'HOLD!', move: 'OVER THERE!', attack: 'HAVE HIM!', sing: 'SING UP!' };
export const ORDER_TAG = { follow: 'FOL', charge: 'ATK', hold: 'HLD', move: 'MOV', attack: 'TGT' };
const REPLY = {
  follow: ['WITH YOU!', 'RIGHT BEHIND YA!', 'COMING!'],
  charge: ['HAVE IT!', 'COME ON THEN!', 'GET IN!'],
  hold: ['HOLDING!', 'GOING NOWHERE!', 'NOT AN INCH!'],
  move: ['ON IT!', 'GOT IT!', 'YES BOSS!'],
  attack: ['HE\'S MINE!', 'LEAVE HIM TO ME!', 'HAVE HIM!'],
  sing: ['WE ARE NORDHAMN!', 'NOBODY LIKES US!', 'OLE OLE!'],
  flee: ['I\'M OFF!', 'LEG IT!', 'NOT TODAY!'],
  back: ['RIGHT, I\'M BACK!', 'SORTED. AGAIN!'],
  up: ['STILL HERE!', 'IS THAT ALL?', 'ME HEAD...'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];

// AI flavour per playable character when they're a lad (signature moves from content/characters.js)
const LAD_AI = {
  hooligan: { attacks: [['jab', 3], ['cross', 2], ['hook', 1], ['kick', 2]], comboLen: [1, 3], aggression: 0.62, reaction: 0.28, blockChance: 0.18, dodgeChance: 0.06 },
  mo: { attacks: [['jab', 2], ['cross', 2], ['mo_hammer', 3], ['kick', 1]], comboLen: [1, 2], aggression: 0.55, reaction: 0.34, blockChance: 0.22, grabChance: 0.05 },
  stig: { attacks: [['stig_flurry', 4], ['cross', 1], ['lowKick', 1], ['stig_slide', 1]], comboLen: [2, 4], aggression: 0.72, reaction: 0.22, dodgeChance: 0.16, blockChance: 0.08 },
  tina: { attacks: [['tina_snap', 3], ['tina_axe', 2], ['jab', 1]], comboLen: [1, 2], aggression: 0.62, reaction: 0.26, blockChance: 0.12, dodgeChance: 0.1 },
  vic: { attacks: [['jab', 2], ['cross', 2], ['kick', 1]], comboLen: [1, 2], aggression: 0.5, reaction: 0.32, grabChance: 0.12, blockChance: 0.12 },
  oldboy: { attacks: [['old_headbutt', 3], ['jab', 2], ['cross', 1]], comboLen: [1, 2], aggression: 0.55, reaction: 0.3, blockChance: 0.2 },
};
const LAD_POWER = 0.8;     // lads hit a bit softer than the player so the leader still matters
const ENGAGE = 4.5;        // follow: pile in on enemies this close to the leader or the lad

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const live = f => f && f.alive && !f.removed && !f.dying && f.state !== 'dead';
export const isElite = f => !!f && (f.boss || (f.scoreValue || 0) >= 350);

// ------------------------------------------------------------------ lad AI
export class LadController extends AIController {
  constructor(def, firm, idx) {
    super(def);
    this.firm = firm; this.idx = idx;
    this.order = { type: 'follow' };
    this.aggro = true;
    this.foe = null; this.foeT = 0;
    this.fleeT = 0;
  }

  // the base AI's target is whoever this lad has decided to fight
  target() { return this.foe; }

  update(f, world, dt) {
    const I = f.intent;
    I.attack = null; I.attackName = null; I.jump = false; I.dodge = false; I.grab = false; I.use = false; I.taunt = false; I.run = false;
    this.t += dt;
    if (!f.alive) { I.mx = I.my = 0; I.block = false; return; }
    const P = world.player;
    // broken nerve: run back toward the leader, away from the nearest enemy
    if (f.routT > 0) {
      f.routT -= dt;
      const e = this.nearestFoe(f, world, f, 6);
      let mx = P.x - f.x, my = P.y - f.y;
      if (e) { const d = dist(e, f) || 1; mx += (f.x - e.x) / d * 3; my += (f.y - e.y) / d * 3; }
      const l = Math.hypot(mx, my) || 1;
      I.mx = mx / l; I.my = my / l; I.run = true; I.block = false;
      if (f.routT <= 0) { f.nerve = 45; f.say && f.say(pick(REPLY.back), 1.2); }
      return;
    }
    const o = this.order;
    if (o.type === 'attack' && !live(o.target)) this.order = { type: 'follow' };
    if (o.type === 'move' && dist(f, o) < 0.6) this.order = { type: 'hold', x: o.x, y: o.y };

    // who to fight
    this.foeT -= dt;
    if (this.foeT <= 0 || !live(this.foe)) {
      this.foeT = 0.4 + Math.random() * 0.3;
      this.foe = this.chooseFoe(f, world);
    }
    if (this.foe) { this.curTarget = this.foe; this.base(f, world, dt); return; }
    this.curTarget = null;
    I.block = false;
    f.combat = false;
    // nobody to fight: carry out the order
    if (o.type === 'move') { this.moveToward(f, world, o.x, o.y, dt, dist(f, o) > 2); return; }
    if (o.type === 'hold') {
      const d = dist(f, o);
      if (d > 0.5) this.moveToward(f, world, o.x, o.y, dt, d > 3); else { I.mx = I.my = 0; }
      return;
    }
    // follow / charge with nothing around: stay in formation around the leader
    const n = Math.max(1, this.firm.lads.length);
    const back = Math.atan2(-P.fy, -P.fx);
    const a = back + (this.idx - (n - 1) / 2) * 0.9;
    const r = 1.5 + (this.idx % 2) * 0.5;
    const tx = P.x + Math.cos(a) * r, ty = P.y + Math.sin(a) * r;
    const d = Math.hypot(tx - f.x, ty - f.y);
    if (d > 0.6 && world.heightAt(tx, ty) < 0.4) this.moveToward(f, world, tx, ty, dt, d > 3.2);
    else if (dist(f, P) > 2.6) this.moveToward(f, world, P.x, P.y, dt, dist(f, P) > 4);
    else { I.mx = I.my = 0; f.face2(P.fx, P.fy); }
  }

  chooseFoe(f, world) {
    const o = this.order, P = world.player;
    if (o.type === 'attack') return o.target;
    if (o.type === 'hold' || o.type === 'move') {
      const c = o.type === 'hold' ? o : f;
      return this.nearestFoe(f, world, c, o.type === 'hold' ? 2.6 : 1.6);
    }
    if (o.type === 'charge') return this.nearestFoe(f, world, f, 12) || this.nearestFoe(f, world, P, 12);
    // follow: anything close to me or the leader; spread over targets (fewest lads on it first)
    return this.nearestFoe(f, world, f, ENGAGE) || this.nearestFoe(f, world, P, ENGAGE);
  }

  nearestFoe(f, world, c, r) {
    let best = null, bs = 1e9;
    for (const e of world.fighters) {
      if (e.team === f.team || !live(e) || e.routT > 0) continue;
      if (e.controller && e.controller.goal) continue;          // still walking in
      const d = dist(e, c);
      if (d > r) continue;
      let crowd = 0;
      for (const l of this.firm.lads) if (l !== f && l.controller && l.controller.foe === e) crowd++;
      const s = dist(e, f) + crowd * 2.2;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
}

// ------------------------------------------------------------------ the firm
export class Firm {
  constructor(world, opts = {}) {
    this.world = world;
    this.lads = [];
    this.selected = new Set();
    this.singCd = 0;
    this.command = false;          // command mode (time slowed, mouse orders)
    this.markers = [];             // order feedback drawn on the ground {x,y,t,kind}
    this.size = opts.size ?? 3;
    this.topBoyDown = false;
  }

  static enabled(world, opts) {
    if (opts && opts.noFirm) return false;
    if (world.level.firm === false) return false;
    const s = save.data.settings || {};
    return s.firm !== false;
  }

  roster(playerChar) {
    const ids = CHARACTERS.map(c => c.id).filter(id => id !== playerChar && id !== 'oldboy' && LAD_AI[id]);
    return ids.slice(0, this.size);
  }

  spawn(game) {
    const w = this.world, P = w.player;
    this.roster(P.character).forEach((id, i) => {
      const ch = characterById(id);
      const F = ch.fighter || {};
      const look = ch.look || game.look();
      const f = new Fighter({
        type: 'lad_' + id, name: ch.name, team: 'player', look, x: P.x, y: P.y,
        hp: Math.round((F.hp ?? 100) * 0.9), speed: (F.speed ?? 3.1) * 0.98, runSpeed: (F.runSpeed ?? 5.6) * 0.98,
        power: (F.power ?? 1) * LAD_POWER, defense: F.defense ?? 0.9, guard: F.guard ?? 40, weight: F.weight ?? 1,
        superArmor: F.superArmor ?? 0, reachMul: F.reachMul ?? 1,
      });
      f.isLad = true; f.character = id; f.ladIdx = i;
      f.grabCfg = ch.grab || null;
      f.kickMul = ch.kickMul || 0; f.punchMul = ch.punchMul || 0;
      f.nerve = 100;
      f.controller = new LadController({ ai: { ...LAD_AI[id], sight: 99, shouts: false } }, this, i);
      this.place(f, i);
      w.fighters.push(f);
      this.lads.push(f);
    });
  }

  // put a lad on a free walkable tile near the leader (spawn, catch-up, respawn)
  place(f, i) {
    const w = this.world, P = w.player;
    const ring = [[-1, -1], [-1, 1], [1, -1], [-2, 0], [0, -2], [1, 1], [-2, -2], [0, 2], [2, 0]];
    for (let k = 0; k < ring.length; k++) {
      const [ox, oy] = ring[(i + k) % ring.length];
      const x = P.x + ox * 0.9, y = P.y + oy * 0.9;
      if (w.heightAt(x, y) <= Math.max(0.3, w.heightAt(P.x, P.y) + 0.3) && w.hasWalkLine(P.x, P.y, x, y)) { f.x = x; f.y = y; f.z = w.groundHeight(x, y, 5); return; }
    }
    f.x = P.x; f.y = P.y; f.z = P.z;
  }

  get active() { return this.lads.filter(l => l.alive && !l.removed); }

  // ---- orders (to the selection, or the whole firm when nothing is selected)
  targets() {
    const sel = [...this.selected].filter(l => l.alive);
    return sel.length ? sel : this.active;
  }

  order(type, opts = {}) {
    const w = this.world, P = w.player;
    const who = this.targets();
    if (type === 'sing') return this.sing();
    if (!who.length) return;
    who.forEach((l, k) => {
      const c = l.controller;
      if (type === 'hold') c.order = { type: 'hold', x: l.x, y: l.y };
      else if (type === 'move') {
        // spread around the point so they don't stack
        const a = k * 2.1, r = who.length > 1 ? 0.8 : 0;
        let x = opts.x + Math.cos(a) * r, y = opts.y + Math.sin(a) * r;
        if (w.heightAt(x, y) > 0.4) { x = opts.x; y = opts.y; }
        c.order = { type: 'move', x, y };
      } else if (type === 'attack') c.order = { type: 'attack', target: opts.target };
      else c.order = { type };
      c.foeT = 0; c.foe = null;
      if (l.routT > 0) l.routT = Math.min(l.routT, 0.5);
    });
    P.say && P.say(ORDER_TEXT[type], 1.1);
    const speaker = who[Math.floor(Math.random() * who.length)];
    setTimeout(() => { if (speaker.alive && speaker.say) speaker.say(pick(REPLY[type] || REPLY.follow), 1.1); }, 260);
    if (type === 'move') this.markers.push({ x: opts.x, y: opts.y, t: 0, kind: 'move' });
    if (type === 'attack' && opts.target) this.markers.push({ target: opts.target, t: 0, kind: 'attack' });
    w.sfx && w.sfx('menuSelect', P);
  }

  sing() {
    const w = this.world, P = w.player;
    if (this.singCd > 0) { w.toast(`THEY'RE HOARSE. SING AGAIN IN ${Math.ceil(this.singCd)}S`); return false; }
    this.singCd = 15;
    let n = 0;
    for (const l of this.active) if (dist(l, P) < 9) { l.nerve = Math.min(100, (l.nerve ?? 100) + 35); n++; if (l.routT > 0) l.routT = 0.3; }
    for (const e of w.fighters) if (e.team !== 'player' && live(e) && !e.boss && dist(e, P) < 7) e.nerve = Math.max(5, (e.nerve ?? 100) - 10);
    P.say && P.say(ORDER_TEXT.sing, 1.4);
    this.active.forEach((l, i) => setTimeout(() => l.alive && l.say && l.say(pick(REPLY.sing), 1.6), 200 + i * 220));
    audio.chant && audio.chant();
    w.message && w.message('SING UP!', n ? `${n} LADS FIRED UP` : 'NOBODY HEARD YOU', 1.4, '#ffe14a');
    return true;
  }

  select(lad, add = false) {
    if (!add) this.selected.clear();
    if (lad) { if (add && this.selected.has(lad)) this.selected.delete(lad); else this.selected.add(lad); }
  }

  // ---- per-step update: nerve, routs, catch-up, markers
  update(dt) {
    const w = this.world, P = w.player;
    if (this.singCd > 0) this.singCd -= dt;
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter(m => m.t < (m.kind === 'attack' ? 2.5 : 3));
    for (const l of this.lads) if (!l.alive) this.selected.delete(l);
    // catch-up: a lad left far behind (doors, locked arenas, teleports) rejoins next to the leader
    for (const l of this.lads) {
      if (!l.alive || l.removed) continue;
      if (dist(l, P) > 13 || (w.lock && !inside(w.lock, l) && dist(l, P) > 7)) { this.place(l, l.ladIdx); l.controller.foe = null; }
    }
    // nerve
    for (const f of w.fighters) {
      if (f.isPlayer || !live(f) || f.boss) continue;
      if (f.nerve === undefined) f.nerve = f.team === 'player' ? 100 : (isElite(f) ? 100 : 85);
      if (f.nerve <= 0 && !(f.routT > 0)) { this.rout(f); continue; }
      let mates = 0, foes = 0;
      for (const o of w.fighters) {
        if (o === f || !live(o)) continue;
        if (dist(o, f) > 4.5) continue;
        if (o.team === f.team) mates++; else foes += o.isPlayer ? 1.5 : 1;
      }
      let dn = 0;
      if (foes > mates + 1.6) dn -= 5 * (foes - mates - 1);
      else if (foes < mates) dn += 3;
      if (f.team === 'player' && dist(f, P) < 6) dn += 2.5;
      if (f.team === 'player' && f.routT > 0) dn = 0;
      f.nerve = Math.max(0, Math.min(100, f.nerve + dn * dt));
    }
    // routed enemies leg it, then they're gone
    for (const f of w.fighters) {
      if (f.team === 'player' || !f.routed || f.removed) continue;
      f.routAge = (f.routAge || 0) + dt;
      if (f.controller) { f.controller.fleeT = 1; f.controller.goal = null; }
      if (f.routAge > 3.2 || (f.routAge > 1.2 && dist(f, P) > 8)) {
        f.removed = true; f.alive = false;
        w.fx.popup(f.x, f.y, f.z + 1.4, 'RAN OFF!', '#7affe0');
        w.addScore(Math.round((f.scoreValue || 100) * 0.5), f.x, f.y, f.z + 0.5, true);
        w.stats.routs = (w.stats.routs || 0) + 1;
      }
    }
  }

  rout(f) {
    const w = this.world;
    if (f.team === 'player') {
      f.routT = 3.2;
      f.say && f.say(pick(REPLY.flee), 1.1);
      w.toast && w.toast(`${f.name} HAS BOTTLED IT! SING UP (Y) OR SORT IT YOURSELF`);
      return;
    }
    if (f.routed || isElite(f)) return;
    f.routed = true; f.routT = 99;
    w.releaseToken(f);
    f.say && f.say(pick(REPLY.flee), 1.0);
    if (f.weapon) w.dropWeapon(f);
  }

  // ---- world hooks
  onHit(att, t, dmg, res) {
    if (!t || t.isPlayer || t.boss || res === 'miss' || res === 'none') return;
    const k = res === 'blocked' ? 0.15 : 0.55;
    t.nerve = Math.max(0, (t.nerve ?? 100) - dmg * k);
  }

  onDeath(f) {
    const w = this.world, P = w.player;
    if (f.isLad) {
      f.out = true;
      w.toast && w.toast(`${f.name} IS OUT COLD!`);
      for (const o of w.fighters) if (live(o) && dist(o, f) < 7 && !o.isPlayer && !o.boss) o.nerve = Math.max(0, (o.nerve ?? 100) + (o.team === 'player' ? -15 : 10));
      return;
    }
    if (f.isPlayer) return;
    const elite = isElite(f) && !f.boss;
    for (const o of w.fighters) {
      if (!live(o) || o.isPlayer || o.boss || dist(o, f) > 8) continue;
      if (o.team === f.team) o.nerve = Math.max(0, (o.nerve ?? 100) - (elite ? 45 : 10));
      else o.nerve = Math.min(100, (o.nerve ?? 100) + (elite ? 15 : 5));
    }
    if (elite && !this.topBoyDown && this.lads.length) {
      this.topBoyDown = true;
      w.message('THEIR TOP BOY IS DOWN!', 'WATCH THEM SCATTER', 1.8, '#7affe0');
      setTimeout(() => { this.topBoyDown = false; }, 6000);
    }
  }

  // an encounter was won: everyone who got knocked out gets back up
  onClear() {
    for (const l of this.lads) {
      if (l.alive || l.removed) continue;
      l.alive = true; l.dying = false; l.out = false;
      l.hp = Math.round(l.maxHp * 0.45);
      l.setState('down'); l.downTime = 0.6; l.stateT = 0;
      l.nerve = 70;
      setTimeout(() => l.alive && l.say && l.say(pick(REPLY.up), 1.4), 700);
    }
    for (const l of this.lads) { if (l.alive) { l.hp = Math.min(l.maxHp, l.hp + l.maxHp * 0.25); l.nerve = Math.max(l.nerve ?? 0, 80); } }
  }

  onRespawn() { this.lads.forEach((l, i) => { if (l.alive) { this.place(l, i); l.controller.foe = null; } }); }
}

function inside(a, f) { return f.x >= a.x && f.y >= a.y && f.x <= a.x + a.w && f.y <= a.y + a.h; }
