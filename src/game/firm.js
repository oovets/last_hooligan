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
//
// Phase D: the lads come from the persistent firm (game/firmdata.js, save.data.firm): the travelling squad, with
// stats -> fighter numbers, traits (hothead, singer, old school, lookout...) and bonds (proper mates keep each
// other going). report() hands each lad's KOs / knockdowns back for the trip's consequences.

import { Fighter } from './fighter.js';
import { AIController } from './ai.js';
import { CHARACTERS, characterById } from '../content/characters.js';
import { audio } from '../audio/audio.js';
import { save } from '../save.js';
import { input } from '../engine/input.js';
import { getFirm, squadLads, fighterParams } from './firmdata.js';

export const ORDER_TEXT = { follow: 'WITH ME!', charge: 'GET INTO THEM!', hold: 'HOLD!', move: 'OVER THERE!', attack: 'HAVE HIM!', sing: 'SING UP!', pin: 'GRAB HIM!', regroup: 'BACK TO ME!' };
export const ORDER_TAG = { follow: 'FOL', charge: 'ATK', hold: 'HLD', move: 'MOV', attack: 'TGT', pin: 'PIN', regroup: 'REG' };
export const REPLY = {
  follow: ['WITH YOU!', 'RIGHT BEHIND YA!', 'COMING!'],
  charge: ['HAVE IT!', 'COME ON THEN!', 'GET IN!'],
  hold: ['HOLDING!', 'GOING NOWHERE!', 'NOT AN INCH!'],
  move: ['ON IT!', 'GOT IT!', 'YES BOSS!'],
  attack: ['HE\'S MINE!', 'LEAVE HIM TO ME!', 'HAVE HIM!'],
  sing: ['WE ARE NORDHAMN!', 'NOBODY LIKES US!', 'OLE OLE!'],
  flee: ['I\'M OFF!', 'LEG IT!', 'NOT TODAY!'],
  back: ['RIGHT, I\'M BACK!', 'SORTED. AGAIN!'],
  up: ['STILL HERE!', 'IS THAT ALL?', 'ME HEAD...'],
  help: ['HELP ME OUT HERE!', 'LADS! OVER HERE!', 'GIZ A HAND!', 'I\'M SURROUNDED!'],
  cover: ['GOT YOUR BACK!', 'OI! LEAVE HIM!', 'I\'M COMING!'],
  pin: ['GOT HIM!', 'LEAVE HIM TO ME!', 'HE\'S MINE!'],
  regroup: ['COMING BACK!', 'ON ME WAY!', 'WITH YOU!'],
};
// short situational shouts (Firm.bark: per-lad and global cooldowns keep them readable)
const BARK = {
  pin: ['GOT HIM! GO ON!', 'HE\'S GOING NOWHERE!', 'HIT HIM!'],
  caught: ['MINE!', 'GOT HIM!'],
  dteam: ['HAVE THAT!', 'GET IN!', 'TEAMWORK!'],
  cheers: ['CHEERS, BOSS!', 'ME HEAD...', 'BACK IN IT!'],
  rescue: ['GET OFF HIM!', 'OI! LEAVE HIM!'],
  rally: ['WITH YOU!', 'RIGHT HERE!'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];

// AI flavour per playable character when they're a lad (signature moves from content/characters.js)
const LAD_AI = {
  hooligan: { attacks: [['jab', 3], ['cross', 2], ['hook', 1], ['kick', 2]], comboLen: [1, 3], aggression: 0.62, reaction: 0.28, blockChance: 0.18, dodgeChance: 0.06 },
  mo: { attacks: [['jab', 2], ['cross', 2], ['mo_hammer', 3], ['kick', 1]], comboLen: [1, 2], aggression: 0.55, reaction: 0.34, blockChance: 0.22, grabChance: 0.05 },
  stig: { attacks: [['stig_flurry', 4], ['cross', 1], ['lowKick', 1], ['stig_slide', 1]], comboLen: [2, 4], aggression: 0.72, reaction: 0.22, dodgeChance: 0.16, blockChance: 0.08 },
  kenny: { attacks: [['kenny_bomb', 3], ['cross', 2], ['hook', 2], ['uppercut', 1], ['kick', 1]], comboLen: [1, 3], aggression: 0.85, reaction: 0.26, blockChance: 0.06, dodgeChance: 0.04 },
  vic: { attacks: [['jab', 2], ['cross', 2], ['kick', 1]], comboLen: [1, 2], aggression: 0.5, reaction: 0.32, grabChance: 0.12, blockChance: 0.12 },
  oldboy: { attacks: [['old_headbutt', 3], ['jab', 2], ['cross', 1]], comboLen: [1, 2], aggression: 0.55, reaction: 0.3, blockChance: 0.2 },
};
// DOUBLE TEAM: the leader and a lad on the same man inside the window (or the leader on a pinned man) -> launch
// chance per attack decision that a lad goes to grab and pin the man instead (near the leader only)
export const PIN_CHANCE = { biglad: 0.45, normal: 0.25, lightweight: 0.06 };
export const REVIVE_R = 1.4;   // how close the leader has to be to haul a KO'd lad up
const PIN_STATES = new Set(['idle', 'walk', 'run', 'hurt', 'block', 'blockstun', 'dizzy']);   // states a man can be pinned from
const DT_WINDOW = 1.2, DT_HITS = 4, DT_PIN_HITS = 3, DT_CD = 6, DT_DMG = 8;
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
    if (this.pinCd > 0) this.pinCd -= dt;
    if (this.stompCd > 0) this.stompCd -= dt;
    if (this.tightT > 0) this.tightT -= dt;
    if (!f.alive) { I.mx = I.my = 0; I.block = false; return; }
    const P = world.player;
    // broken nerve: run back toward the leader, away from the nearest enemy
    if (f.routT > 0) {
      if (f.grabbing) f.releaseGrab();
      f.routT -= dt;
      const e = this.nearestFoe(f, world, f, 6);
      let mx = P.x - f.x, my = P.y - f.y;
      if (e) { const d = dist(e, f) || 1; mx += (f.x - e.x) / d * 3; my += (f.y - e.y) / d * 3; }
      const l = Math.hypot(mx, my) || 1;
      I.mx = mx / l; I.my = my / l; I.run = true; I.block = false;
      if (f.routT <= 0) { f.nerve = 45; f.say && f.say(pick(REPLY.back), 1.2); }
      return;
    }
    let o = this.order;
    if ((o.type === 'attack' || o.type === 'pin') && (!live(o.target) || o.target.routed)) this.order = { type: 'follow' };
    if (o.type === 'pin') { o.t = (o.t || 0) + dt; if (o.done || o.t > 6) this.order = { type: 'follow' }; }
    if (o.type === 'move' && dist(f, o) < 0.6) this.order = { type: 'hold', x: o.x, y: o.y };
    o = this.order;
    // holding a man for the others
    if (this.holdPin(f, world, dt)) return;
    // a man coming his way (a pass) or flattened by a double team: catch / finish him
    if (this.catchFor && this.stompFollow(f, world, dt)) return;
    // BACK TO ME!: drop everything and get round the leader (swat away anyone right on top of you)
    if (o.type === 'regroup') {
      o.t = (o.t || 0) + dt;
      const e = this.nearestFoe(f, world, f, 0.9);
      if (e && (this.t % 1) < 0.5) { this.foe = e; this.curTarget = e; this.base(f, world, dt); return; }
      this.foe = null; this.curTarget = null; I.block = false;
      const n = Math.max(1, this.firm.lads.length), a = Math.atan2(-P.fy, -P.fx) + (this.idx - (n - 1) / 2) * 0.9;
      const tx = P.x + Math.cos(a), ty = P.y + Math.sin(a);
      if (world.heightAt(tx, ty) < 0.4) this.moveToward(f, world, tx, ty, dt, true); else this.moveToward(f, world, P.x, P.y, dt, true);
      if (dist(f, P) < 1.6 || o.t > 4) {
        if (dist(f, P) < 1.6 && !(f.rallyCd > 0)) { f.nerve = Math.min(100, (f.nerve ?? 100) + 20); f.rallyCd = 12; this.firm.bark(f, 'rally'); }
        this.order = { type: 'follow' }; this.tightT = 5;
      }
      return;
    }

    // who to fight
    this.foeT -= dt;
    if (this.foeT <= 0 || !live(this.foe)) {
      this.foeT = 0.4 + Math.random() * 0.3;
      this.foe = this.chooseFoe(f, world);
    }
    if (this.foe) {
      this.curTarget = this.foe;
      // decided to pin this man: step in and grab him (for a moment, then give up)
      if (this.pinWant && (this.pinWant.e !== this.foe || this.foe.grabbedBy || this.foe.grabbing || !live(this.foe))) this.pinWant = null;   // someone else has him
      if (this.pinWant && (this.pinWant.t -= dt) > 0) {
        if (this.tryPin(f, world, dt)) { this.pinWant = null; return; }
        if (f.canAct) { this.moveToward(f, world, this.foe.x, this.foe.y, dt, false); return; }
      } else this.pinWant = null;
      if (o.type === 'pin') {
        // GRAB HIM!: walk straight in and grab (the normal AI would hover at punching distance)
        if (this.tryPin(f, world, dt)) return;
        if (f.canAct && live(this.foe)) { I.block = false; this.moveToward(f, world, this.foe.x, this.foe.y, dt, dist(f, this.foe) > 2.5); return; }
      }
      this.base(f, world, dt);
      // the moment he'd swing at a man near the leader, sometimes he goes to grab and pin him instead
      if ((I.attack || I.attackName) && this.rollPin(f, world)) {
        I.attack = null; I.attackName = null;
        if (!this.tryPin(f, world, dt)) this.pinWant = { e: this.foe, t: 0.8 };
      }
      return;
    }
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
    const r = this.tightT > 0 ? 1.0 : 1.5 + (this.idx % 2) * 0.5;
    const tx = P.x + Math.cos(a) * r, ty = P.y + Math.sin(a) * r;
    const d = Math.hypot(tx - f.x, ty - f.y);
    if (d > 0.6 && world.heightAt(tx, ty) < 0.4) this.moveToward(f, world, tx, ty, dt, d > 3.2);
    else if (dist(f, P) > 2.6) this.moveToward(f, world, P.x, P.y, dt, dist(f, P) > 4);
    else { I.mx = I.my = 0; f.face2(P.fx, P.fy); }
  }

  chooseFoe(f, world) {
    const o = this.order, P = world.player;
    if (o.type === 'attack' || o.type === 'pin') return o.target;
    // GET OFF HIM!: someone has hold of the leader
    if (o.type === 'follow' || o.type === 'charge') {
      const g = P.grabbedBy;
      if (live(g) && !g.boss && g.team !== 'player' && dist(g, f) < 8) {
        let crowd = 0;
        for (const l of this.firm.lads) if (l !== f && l.controller && l.controller.foe === g) crowd++;
        if (crowd < 2) return g;
      }
    }
    const hot = f.traits && f.traits.has('hothead');
    if (o.type === 'hold' || o.type === 'move') {
      const c = o.type === 'hold' ? o : f;
      return this.nearestFoe(f, world, c, o.type === 'hold' ? (hot ? 3.6 : 2.6) : 1.6);
    }
    if (o.type === 'charge') return this.nearestFoe(f, world, f, 12) || this.nearestFoe(f, world, P, 12);
    // follow: look after the leader first, then a mate who's shouting for help, then anything close (fewest lads on
    // it first)
    // just regrouped: only men right round the leader, so the firm fights as one knot
    if (this.tightT > 0) return this.threatOn(f, world, P, 4) || this.nearestFoe(f, world, P, 2.5);
    const r = (f.engage || ENGAGE) + (hot ? 1.5 : 0);
    const onLeader = this.threatOn(f, world, P, r + 1.5);
    if (onLeader) return onLeader;
    for (const m of this.firm.lads) {
      if (m === f || !live(m) || !(m.helpT > 0) || dist(m, f) > r + 3) continue;
      const t = this.threatOn(f, world, m, r + 3);
      if (t) { if (!(f.coverT > 0)) { f.coverT = 6; f.say && f.say(pick(REPLY.cover), 1.0); } return t; }
    }
    return this.nearestFoe(f, world, f, r) || this.nearestFoe(f, world, P, r);
  }

  // HOLD HIM!: pin the man (arms locked) so the leader and the lads can hit him without breaking the hold
  holdPin(f, world, dt) {
    const I = f.intent, P = world.player;
    // a pin that ended some other way (launched, knocked down, the pinner hit, thrown): tidy up once
    if (this.pinVictim && (f.grabbing !== this.pinVictim || !f.pinning)) {
      if (this.order.type === 'pin' && this.order.target === this.pinVictim) this.order.done = true;
      this.pinVictim = null; this.pinCd = 3;
    }
    if (f.pinning && !f.grabbing) f.pinning = false;
    if (!(f.grabbing && f.pinning)) return false;
    const v = f.grabbing;
    if (this.pinVictim !== v) {
      this.pinVictim = v; this.pinT = 0; this.farT = 0;
      world.releaseToken(v);
      this.firm.bark(f, 'pin', { force: true, toast: `${f.name} HAS GOT HIM! FREE HITS!` });
    }
    I.mx = I.my = 0; I.block = false;
    this.curTarget = v; this.foe = v;
    this.pinT += dt;
    const T = f.traits;
    const pinMax = 2.6 + (T && T.has('biglad') ? 1.2 : 0) - (T && T.has('lightweight') ? 1.0 : 0);
    this.farT = P.alive && dist(P, v) < 6 ? 0 : this.farT + dt;
    if (this.pinT > pinMax || this.farT > 1.2 || v.boss || v.routed || !live(v)) {
      f.releaseGrab(); this.pinCd = 4; this.pinVictim = null;
      if (this.order.type === 'pin' && this.order.target === v) this.order.done = true;
      return true;
    }
    // turn the man toward the leader (not into a wall)
    const want = Math.atan2(P.y - f.y, P.x - f.x), cur = Math.atan2(f.fy, f.fx);
    let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
    const na = cur + Math.max(-4 * dt, Math.min(4 * dt, d));
    const nx = Math.cos(na), ny = Math.sin(na), reach = (f.grabCfg && f.grabCfg.choke ? 0.42 : 0.55) + (v.r || 0.3);
    if (world.heightAt(f.x + nx * reach, f.y + ny * reach) < 0.4) { f.fx = nx; f.fy = ny; }
    v.face2(f.fx, f.fy);
    const hold = (f.grabCfg && f.grabCfg.hold) || 1.8;
    f.grabT = Math.min(f.grabT, hold - 0.1);
    return true;
  }

  // stay on a man who was passed to us or launched by a double team: face him in flight, stomp him once he's down
  stompFollow(f, world, dt) {
    const b = this.catchFor, I = f.intent;
    this.catchT -= dt;
    if (!live(b) || this.catchT <= 0 || b.grabbedBy || !['thrown', 'knockdown', 'down'].includes(b.state)) { this.catchFor = null; return false; }
    I.block = false;
    const d = dist(f, b);
    if (b.state !== 'down') { I.mx = I.my = 0; if (f.canAct) f.face2(b.x - f.x, b.y - f.y); return true; }
    if (d < 1.0) {
      I.mx = I.my = 0;
      if (f.state === 'idle' || f.state === 'walk' || f.state === 'run') {
        f.face2(b.x - f.x, b.y - f.y);
        if (!(this.stompCd > 0)) { I.attackName = 'stomp'; this.stompCd = 0.6; }
      }
      return true;
    }
    if (d < 4) { this.moveToward(f, world, b.x, b.y, dt, d > 2); return true; }
    this.catchFor = null;
    return false;
  }

  // grab this.foe for a pin: on a pin order, or now and then when the leader is close enough to use it
  // auto pin: rolled once per attack decision, only when the leader is close enough to make use of it
  rollPin(f, world) {
    const e = this.foe, P = world.player, o = this.order, T = f.traits;
    if (!['follow', 'charge', 'attack'].includes(o.type) || this.pinCd > 0 || f.weapon || f.grabbing) return false;
    if (!live(e) || e.boss || e.ungrabbable || e.grabbedBy || e.grabbing || e.routed || dist(f, e) > 2.2) return false;
    if (!PIN_STATES.has(e.state)) return false;
    // one lad goes for the pin at a time
    if (this.firm.lads.some(l => l !== f && l.controller && ((l.controller.pinWant && l.controller.pinWant.e === e) || (l.grabbing === e)))) return false;
    if (!P.alive || P.state === 'down' || P.state === 'knockdown' || dist(P, e) > 4.5) return false;
    const chance = T && T.has('biglad') ? PIN_CHANCE.biglad : T && T.has('lightweight') ? PIN_CHANCE.lightweight : PIN_CHANCE.normal;
    if (Math.random() >= chance) { this.pinCd = 0.6; return false; }
    this.pinCd = 1.5;
    return true;
  }

  // grab this.foe into a pin if he's in reach and grabbable right now
  tryPin(f, world, dt) {
    const e = this.foe, P = world.player, o = this.order, T = f.traits;
    if (!['follow', 'charge', 'attack', 'pin'].includes(o.type) || f.weapon || f.grabbing) return false;   // (pinCd gates the roll, not an attempt)
    if (!(f.state === 'idle' || f.state === 'walk' || f.state === 'run' || f.state === 'block')) return false;
    if (!live(e) || e.boss || e.ungrabbable || e.grabbedBy || e.invuln > 0 || e.routed || Math.abs(e.z - f.z) > 0.4) return false;
    if (!PIN_STATES.has(e.state)) return false;
    const d = dist(f, e);
    if (d > ((f.grabCfg && f.grabCfg.range) || 0.95) + (e.r || 0.3)) return false;
    f.face2(e.x - f.x, e.y - f.y);
    f.pinning = true;
    if (f.grabTarget(world, e)) { f.intent.block = false; return true; }
    f.pinning = false;
    return false;
  }

  // an enemy who is having a go at `who` (aimed at him and close), with at most one other lad already on it
  threatOn(f, world, who, r) {
    let best = null, bs = 1e9;
    for (const e of world.fighters) {
      if (e.team === f.team || !live(e) || e.routT > 0 || !e.controller || e.controller.curTarget !== who) continue;
      if (e.controller.goal || dist(e, who) > 3 || dist(e, f) > r) continue;
      let crowd = 0;
      for (const l of this.firm.lads) if (l !== f && l.controller && l.controller.foe === e) crowd++;
      if (crowd >= 2) continue;
      const s = dist(e, who) + dist(e, f) * 0.3 + crowd * 2.5;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
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
    this.barkCd = 0; this.barks = {};
    this.dtQueue = [];             // men due a DOUBLE TEAM launch (run in update, never inside a hit)
  }

  // a short situational shout from a lad (cooldowns per lad and across the firm, so they stay readable)
  bark(l, kind, opts = {}) {
    if (!live(l) || !l.say) return false;
    if (!opts.force && (l.barkCd > 0 || this.barkCd > 0)) return false;
    const a = BARK[kind] || kind;
    l.say(Array.isArray(a) ? pick(a) : String(a), opts.dur || 1.2, opts.color);
    l.barkCd = opts.cd ?? 2.5; this.barkCd = 0.8;
    this.barks[kind] = (this.barks[kind] || 0) + 1;
    if (opts.toast && this.world.toast) this.world.toast(opts.toast);
    return true;
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
    const firm = getFirm(this.world.player.character);
    // a founder who is the character you're playing stays at the pub (you can't fight beside yourself)
    const me = this.world.player.character;
    const recs = squadLads(firm).filter(r => !r.char || r.char !== me).slice(0, Math.max(1, this.size + (firm.rep >= 60 ? 1 : 0)));
    if (recs.length) { recs.forEach((rec, i) => this.spawnLad(rec, i, game)); return; }
    this.spawnCharacters(game);
  }

  // a lad from the persistent firm
  spawnLad(rec, i, game) {
    const w = this.world, P = w.player;
    const ch = rec.char ? characterById(rec.char) : null;
    const pr = fighterParams(rec);
    const look = rec.look || (ch && ch.look) || game.look();
    const f = new Fighter({
      type: 'lad', name: rec.name, team: 'player', look, x: P.x, y: P.y,
      hp: pr.hp, speed: pr.speed, runSpeed: pr.runSpeed, power: pr.power, defense: pr.defense, guard: pr.guard,
      weight: pr.weight, superArmor: pr.superArmor, reachMul: (ch && ch.fighter && ch.fighter.reachMul) || 1,
    });
    f.isLad = true; f.character = rec.char; f.ladIdx = i; f.rec = rec;
    f.grabCfg = (ch && ch.grab) || null;
    f.koLines = (ch && ch.koLines) || null; f.rage = !!(ch && ch.rage);
    // pr.kickMul is an offset (kicks stat 5 = 0, 3 = -0.1); combat multiplies kick damage by f.kickMul
    f.kickMul = ((ch && ch.kickMul) || 1) * (1 + pr.kickMul); f.punchMul = (ch && ch.punchMul) || 0;
    f.nerve = pr.nerve; f.nerveMul = pr.nerveMul; f.engage = pr.engage;
    f.traits = new Set(rec.traits); f.bonds = rec.bonds || {};
    f.fight = { kos: 0, downs: 0 };
    const sig = rec.char && LAD_AI[rec.char];
    const ai = { ...pr.ai, ...(sig ? { attacks: sig.attacks, comboLen: sig.comboLen } : {}), sight: 99, shouts: false };
    f.controller = new LadController({ ai }, this, i);
    this.place(f, i);
    w.fighters.push(f);
    this.lads.push(f);
  }

  // no saved firm (fallback): the other playable characters
  spawnCharacters(game) {
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
      f.koLines = ch.koLines || null; f.rage = !!ch.rage;
      f.kickMul = ch.kickMul || 0; f.punchMul = ch.punchMul || 0;
      f.nerve = 100; f.fight = { kos: 0, downs: 0 };
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
    if (type === 'pin') {
      // GRAB HIM!: the nearest lad (of the selection) goes and pins that man
      const t = opts.target;
      if (!live(t) || t.boss || t.ungrabbable || t.team === 'player') { w.toast && w.toast("CAN'T HOLD HIM"); return; }
      // a free lad if there is one; a busy one lets go of his man first
      let l = null, bd = 1e9;
      for (const pass of [0, 1]) {
        for (const c of who) {
          if (!live(c) || c.routT > 0 || (pass === 0 && c.grabbing)) continue;
          const d = dist(c, t); if (d < bd) { bd = d; l = c; }
        }
        if (l) break;
      }
      if (!l) return;
      const c = l.controller;
      if (l.grabbing && l.grabbing !== t) { l.releaseGrab(); c.pinVictim = null; }
      c.pinWant = null; c.catchFor = null;
      c.order = { type: 'pin', target: t, t: 0 }; c.foe = t; c.foeT = 0.5; c.pinCd = 0;
      P.say && P.say(ORDER_TEXT.pin, 1.1);
      setTimeout(() => { if (l.alive && l.say) l.say(pick(REPLY.pin), 1.1); }, 260);
      this.markers.push({ target: t, t: 0, kind: 'attack' });
      w.sfx && w.sfx('menuSelect', P);
      return;
    }
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
      else if (type === 'regroup') { c.order = { type: 'regroup', t: 0 }; c.catchFor = null; if (l.grabbing) l.releaseGrab(); }
      else c.order = { type };
      c.foeT = 0; c.foe = null; c.pinWant = null;
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
    const bonus = this.active.some(l => l.traits && l.traits.has('singer')) ? 15 : 0;
    for (const l of this.active) if (dist(l, P) < 9) { l.nerve = Math.min(100, (l.nerve ?? 100) + 35 + bonus); n++; if (l.routT > 0) l.routT = 0.3; }
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
    if (this.barkCd > 0) this.barkCd -= dt;
    if (this.dtQueue.length) {
      const q = this.dtQueue; this.dtQueue = [];
      for (const t of q) if (live(t) && !t.boss && t.state !== 'knockdown' && t.state !== 'down') this.doubleTeam(P, t, t._dteam && t._dteam.lad);
    }
    for (const m of this.markers) m.t += dt;
    this.markers = this.markers.filter(m => m.t < (m.kind === 'attack' ? 2.5 : 3));
    for (const l of this.lads) if (!l.alive) this.selected.delete(l);
    // catch-up: a lad left far behind (doors, locked arenas, teleports) rejoins next to the leader
    for (const l of this.lads) {
      if (!l.alive || l.removed) continue;
      if (dist(l, P) > 13 || (w.lock && !inside(w.lock, l) && dist(l, P) > 7)) { if (l.grabbing) l.releaseGrab(); this.place(l, l.ladIdx); l.controller.foe = null; }
    }
    // a lad in trouble (hurt and outnumbered) shouts for help: his mates come over (LadController.chooseFoe) and the
    // HUD flags him so you can send someone (or go yourself)
    for (const l of this.lads) {
      if (l.helpT > 0) l.helpT -= dt;
      if (l.coverT > 0) l.coverT -= dt;
      if (l.barkCd > 0) l.barkCd -= dt;
      if (l.rallyCd > 0) l.rallyCd -= dt;
      if (l.helpCd > 0) { l.helpCd -= dt; continue; }
      if (!live(l) || l.routT > 0) continue;
      let on = 0;
      for (const e of w.fighters) if (e.team !== 'player' && live(e) && e.controller && e.controller.curTarget === l && dist(e, l) < 3) on++;
      if (on >= 2 && (l.hp < l.maxHp * 0.45 || on >= 3)) {
        l.helpT = 4; l.helpCd = 9;
        l.say && l.say(pick(REPLY.help), 1.3);
        w.toast && w.toast(`${l.name} NEEDS A HAND!`);
      }
    }
    // GET OFF HIM!: the leader just got grabbed -> lads on WITH ME / GET INTO THEM re-pick at once, one shouts
    const held = P.grabbedBy && !P.grabbedBy.boss;
    if (held && !this._leaderHeld) {
      let s = null, bd = 1e9;
      for (const l of this.active) {
        const t = l.controller.order.type;
        if (!live(l) || l.routT > 0 || (t !== 'follow' && t !== 'charge')) continue;
        l.controller.foeT = 0;
        const d = dist(l, P); if (d < bd) { bd = d; s = l; }
      }
      if (s) this.bark(s, 'rescue', { force: true });
    }
    this._leaderHeld = !!held;
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
      if (f.team === 'player') {
        if (dist(f, P) < 6) dn += 2.5;
        if (dn < 0) dn *= f.nerveMul || 1;
        for (const o of this.lads) {
          if (o === f || !live(o) || dist(o, f) > 4.5) continue;
          if (o.traits && o.traits.has('oldschool') && dn < 0) dn *= 0.5;
          if (o.traits && o.traits.has('singer')) dn += 1.5;
          if (f.bonds && o.rec && (f.bonds[o.rec.id] || 0) >= 5) dn += 1.5;   // proper mates
        }
        if (f.routT > 0) dn = 0;
      }
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
      w.toast && w.toast(`${f.name} HAS BOTTLED IT! SING UP (${input.hint('orderSing')}) OR SORT IT YOURSELF`);
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
    // DOUBLE TEAM tracker: leader and lad hitting the same man close together
    if (t.team === 'player' || !att || !(att.isPlayer || att.isLad) || (res !== 'hit' && res !== 'armor')) return;
    const now = this.world.time, d = t._dteam || (t._dteam = { p: -9, l: -9, lad: null, n: 0, cd: -9 });
    if (att.isPlayer) { d.p = now; const g = t.grabbedBy; if (g && g.pinning) { d.l = now; d.lad = g; } }
    else { d.l = now; d.lad = att; }
    if (now - d.p < DT_WINDOW && now - d.l < DT_WINDOW) d.n++; else d.n = 0;
    const pinned = t.grabbedBy && t.grabbedBy.pinning;
    if (att.isPlayer && d.n >= (pinned ? DT_PIN_HITS : DT_HITS) && now > d.cd && !t.dying && !this.dtQueue.includes(t)) {
      d.cd = now + DT_CD; d.n = 0; this.dtQueue.push(t);
    }
  }

  // DOUBLE TEAM!: slow-motion launch, extra damage, the other side's nerve takes a knock
  doubleTeam(P, t, lad) {
    const w = this.world;
    let dx = t.x - P.x, dy = t.y - P.y;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    t.hp -= DT_DMG * (P.power || 1) * (t.defense || 1);
    t.lastAttacker = P;
    if (t.hp <= 0) { t.hp = 0; t.dying = true; w.sfx && w.sfx('ko', t); }
    t.knockDown({ x: dx, y: dy }, 5, 4);
    w.slowmo = Math.max(w.slowmo || 0, 0.22);
    w.fx && w.fx.popup(t.x, t.y, t.z + 1.6, 'DOUBLE TEAM!', '#ffe14a');
    w.sfx && w.sfx('combo', P);
    if (w.camera && save.data.settings && save.data.settings.shake) w.camera.shake(4, 0.2);
    w.addScore && w.addScore(150, t.x, t.y, t.z + 1, false);
    w.stats && (w.stats.doubleTeams = (w.stats.doubleTeams || 0) + 1);
    for (const o of w.fighters) {
      if (!live(o) || o.isPlayer || o.boss || dist(o, t) > 6) continue;
      if (o.team === 'player') o.nerve = Math.min(100, (o.nerve ?? 100) + 8);
      else if (o !== t) o.nerve = Math.max(0, (o.nerve ?? 100) - 12);
    }
    if (live(lad) && lad.controller) { this.bark(lad, 'dteam', { force: true }); lad.controller.catchFor = t; lad.controller.catchT = 1.5; }
  }

  // PASS HIM ON: a throw in the general direction of a free lad goes to him (he catches it into a pin)
  aimThrow(thrower, victim, dx, dy) {
    const w = this.world;
    if (!victim || victim.boss || victim.ungrabbable || victim.routed || victim.dying || victim.hp <= 0) return null;
    let best = null, bc = Math.cos(Math.PI / 6);
    for (const l of this.active) {
      if (!live(l) || !l.canAct || l.routT > 0 || l.grabbing) continue;
      const ex = l.x - thrower.x, ey = l.y - thrower.y, d = Math.hypot(ex, ey);
      if (d < 1.5 || d > 3.6) continue;
      const c = (ex * dx + ey * dy) / d;
      if (c < bc) continue;
      if (!w.hasWalkLine(thrower.x, thrower.y, l.x, l.y)) continue;
      bc = c; best = l;
    }
    if (!best) return null;
    victim.passTo = best;
    best.controller.catchFor = victim; best.controller.catchT = 1.2;
    const ex = best.x - thrower.x, ey = best.y - thrower.y, d = Math.hypot(ex, ey);
    return { x: ex / d, y: ey / d };
  }

  onDeath(f) {
    const w = this.world, P = w.player;
    if (f.isLad) {
      f.out = true;
      if (f.fight) f.fight.downs++;
      w.toast && w.toast(`${f.name} IS OUT COLD!`);
      for (const o of w.fighters) if (live(o) && dist(o, f) < 7 && !o.isPlayer && !o.boss) o.nerve = Math.max(0, (o.nerve ?? 100) + (o.team === 'player' ? -15 : 10));
      return;
    }
    if (f.isPlayer) return;
    const by = f.lastAttacker;
    if (by && by.isLad && by.fight) by.fight.kos++;
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
  revive(l, hpFrac, nerve) {
    l.alive = true; l.dying = false; l.out = false;
    l.hp = Math.max(1, Math.round(l.maxHp * hpFrac));
    l.setState('down'); l.downTime = 0.6; l.stateT = 0;
    l.nerve = nerve;
    if (l.controller) { l.controller.foe = null; l.controller.foeT = 0; }
  }

  // PICK HIM UP: the leader hauls a knocked-out lad back onto his feet (USE over him; once per lad per fight)
  canRevive(c, P) { return !c.alive && !c.removed && c.out && !c.revivedThisFight && dist(c, P) < REVIVE_R; }
  enemyOnTop(P) { return this.world.fighters.some(e => e.team !== 'player' && live(e) && !e.routed && dist(e, P) < 1.6); }

  tryRevive(P) {
    const w = this.world;
    let l = null, bd = 1e9;
    for (const c of this.lads) { if (!this.canRevive(c, P)) continue; const d = dist(c, P); if (d < bd) { bd = d; l = c; } }
    if (!l) return false;
    // refused with a man on top of you: say so, but let USE do its other jobs (weapons, doors, items)
    if (this.enemyOnTop(P)) { w.toast && w.toast('NOT WITH THEM ON TOP OF YOU!'); return false; }
    P.face2(l.x - P.x, l.y - P.y);
    P.setState('pickup'); P.vx = P.vy = 0;
    P.actionDur = 1.2;
    P.onAction = () => {
      if (l.alive || l.removed) return;
      this.revive(l, 0.3, 60);
      l.revivedThisFight = true; l.invuln = 1;
      w.toast && w.toast(`${l.name} IS BACK ON HIS FEET!`);
      this.bark(l, 'cheers', { force: true, dur: 1.3 });
      for (const o of this.active) if (dist(o, P) < 7) o.nerve = Math.min(100, (o.nerve ?? 100) + 10);
    };
    return true;
  }

  onClear() {
    for (const l of this.lads) {
      if (l.alive || l.removed) continue;
      this.revive(l, 0.45, 70);
      setTimeout(() => l.alive && l.say && l.say(pick(REPLY.up), 1.4), 700);
    }
    for (const l of this.lads) l.revivedThisFight = false;
    for (const l of this.lads) { if (l.alive) { l.hp = Math.min(l.maxHp, l.hp + l.maxHp * 0.25); l.nerve = Math.max(l.nerve ?? 0, 80); } }
  }

  // per-lad results for the trip report (game/firmdata.js applyTrip)
  report() {
    return this.lads.filter(l => l.rec).map(l => ({ id: l.rec.id, name: l.name, kos: (l.fight && l.fight.kos) || 0, downs: (l.fight && l.fight.downs) || 0, out: !l.alive || l.dying || l.hp <= 0 }));
  }

  onRespawn() { this.lads.forEach((l, i) => { if (l.alive) { if (l.grabbing) l.releaseGrab(); this.place(l, i); l.controller.foe = null; } }); }
}

function inside(a, f) { return f.x >= a.x && f.y >= a.y && f.x <= a.x + a.w && f.y <= a.y + a.h; }
