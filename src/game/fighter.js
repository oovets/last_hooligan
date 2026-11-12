// Fighter: shared state machine for the player, enemies and bosses.
// Controllers (player.js / ai.js) write `fighter.intent` every step; Fighter.update() interprets it.
//
// intent = { mx, my,          world-space move direction scaled by magnitude (|v|<=1)
//            run,             bool
//            attack,          null | 'punchL' | 'punchR' | 'kick'   (button semantics, combo aware)
//            attackName,      null | explicit ATTACKS key (AI/bosses) — takes precedence over `attack`
//            jump, block, dodge, grab, use, taunt }   (block is "held"; others are one-step presses)
//
// Defensive layer:
//   * BLOCK (held) stops frontal hits (chip damage, guard meter drains -> GUARD BREAK = dizzy).
//   * Pressing block just before a hit (PARRY_WINDOW) = PARRY: no chip/guard loss, attacker recoils.
//   * Attacking within COUNTER_WINDOW after a block/parry = COUNTER (fast, unblockable knockdown).
//   * BLOCK + punch/kick (no counter pending) = rear elbow / back kick for enemies behind you.
//   * DODGE has i-frames and (for the player) cancels the recovery of an attack.
//   * Player "mercy": the 4th hit of an uninterrupted enemy string knocks the player down (getup i-frames);
//     a downed player can press any button to get up sooner; mash buttons to break free of a grab.

import { ATTACKS, resolveAttack, openingAttack, attackStartup } from './combat.js';
import { sampleAnim, attackPose, GUARD } from './poses.js';
import { specForLook, drawCharacter, fighterClip, handPos, SPRITE_MODELS } from './sprites.js';
import { drawDoll, normalizeLook } from './doll.js';
import { GRAVITY, Z_PX } from '../engine/constants.js';
import { toScreen } from '../engine/iso.js';
import { shadow } from '../engine/gfx.js';
import { drawText, measureText } from '../engine/font.js';

let NEXT_ID = 1;
export const JUMP_V = 7.8;

const FREE = new Set(['idle', 'walk', 'run']);
export const PARRY_WINDOW = 0.15;
export const COUNTER_WINDOW = 0.5;
const PLAYER_MERCY_HITS = 4;

export function blankIntent() {
  return { mx: 0, my: 0, run: false, attack: null, attackName: null, jump: false, block: false, dodge: false, grab: false, use: false, taunt: false };
}

export class Fighter {
  constructor(o = {}) {
    this.id = NEXT_ID++;
    this.kind = 'fighter';
    this.type = o.type || 'generic';
    this.name = o.name || 'BLOKE';
    this.team = o.team || 'enemy';
    this.look = normalizeLook(o.look || {});
    this.x = o.x ?? 0; this.y = o.y ?? 0; this.z = o.z ?? 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.r = o.r ?? 0.28 * Math.max(1, this.look.height || 1);
    this.fx = o.fx ?? 1; this.fy = o.fy ?? 0;
    this.maxHp = this.hp = o.hp ?? 100;
    this.power = o.power ?? 1;
    this.defense = o.defense ?? 1;
    this.speed = o.speed ?? 3.0;
    this.runSpeed = o.runSpeed ?? 5.4;
    this.weight = o.weight ?? 1;
    this.superArmor = o.superArmor ?? 0;     // hits dealing less than this don't stagger
    this.maxGuard = o.guard ?? 30; this.guard = this.maxGuard;
    this.reachMul = o.reachMul ?? 1;
    this.boss = !!o.boss;
    this.scoreValue = o.score ?? 100;
    this.state = 'idle'; this.stateT = 0; this.animT = 0;
    this.animName = null;
    this.stunT = 0;
    this.attack = null;
    this.intent = blankIntent();
    this.invuln = 0; this.flashT = 0;
    this.alive = true; this.removed = false;
    this.weapon = null;                       // { def, durability }
    this.grabbing = null; this.grabbedBy = null; this.grabT = 0;
    this.onGround = true; this.airAttackUsed = false;
    this.combat = false;
    this.downTime = 0;
    this.hitChain = 0; this.hitChainT = 0;    // juggle / stun-lock protection
    this.juggles = 0;
    this.lastAttacker = null;
    this.face = 'normal'; this.faceT = 0;
    this.noclip = false;
    this.controller = null;
    this.thrower = null;
    this.hurtAnim = 'hurt';
    this.visFlip = false;
    this.deadT = 0;
    this.tag = o.tag || null;
    this.onAction = null;   // callback for pickup/drink completion
    this.data = {};         // free-form storage for controllers
    this.parryT = 0;        // >0: a block started this recently parries
    this.counterT = 0;      // >0: attacking now performs a counter
    this.counterTarget = null;
    this.sayText = null; this.sayT = 0; this.sayColor = '#ffffff';
  }

  get busy() { return !FREE.has(this.state); }
  get isDown() { return this.state === 'down' || this.state === 'knockdown' || this.state === 'dead'; }
  get canAct() { return FREE.has(this.state) || this.state === 'block'; }

  setState(s) {
    if (this.state === s) return;
    this.state = s; this.stateT = 0; this.animT = 0;
  }

  face2(dx, dy) {
    const l = Math.hypot(dx, dy);
    if (l > 1e-4) { this.fx = dx / l; this.fy = dy / l; }
  }

  // Speech bubble (short UPPERCASE shout drawn over the head).
  say(text, dur = 1.2, color) {
    this.sayText = text; this.sayT = dur;
    this.sayColor = color || (this.team === 'player' ? '#ffffff' : '#ffe0a0');
  }

  // ------------------------------------------------------------------ actions
  startAttack(name, world) {
    const def = ATTACKS[name];
    if (!def) return false;
    const startup = attackStartup(this, def);
    this.attack = { name, def, t: 0, phase: 0, hit: new Set(), buffered: null, whiffed: false, startup,
      tele: !this.isPlayer && (def.telegraph || startup >= 0.26) };
    this.setState('attack');
    if (def.air) this.airAttackUsed = true;
    // leaping attacks (flying kick): launch from the ground in the facing direction
    if (def.leap && this.onGround) {
      this.vz = def.leap.vz; this.onGround = false;
      this.vx = this.fx * def.leap.speed; this.vy = this.fy * def.leap.speed;
    }
    return true;
  }

  startDodge(world, dx, dy) {
    let l = Math.hypot(dx, dy);
    if (l < 0.1) { dx = -this.fx; dy = -this.fy; l = 1; }
    this.attack = null;
    this.dodgeDir = { x: dx / l, y: dy / l };
    this.setState('dodge');
    this.invuln = Math.max(this.invuln, 0.32);
    world.sfx('dodge', this);
  }

  startCounter(world) {
    const t = this.counterTarget;
    if (t && t.alive) this.face2(t.x - this.x, t.y - this.y);
    else world.autoAim && world.autoAim(this, this.intent.mx, this.intent.my);
    this.counterT = 0; this.counterTarget = null;
    this.startAttack('counter', world);
    world.fx && world.fx.spark(this.x + this.fx * 0.4, this.y + this.fy * 0.4, this.z + 1.5, '#ffffff', 6);
  }

  jump(world) {
    this.vz = JUMP_V; this.onGround = false; this.airAttackUsed = false;
    this.setState('jump');
    world.sfx('jump', this);
  }

  tryGrab(world) {
    let best = null, bd = 1e9;
    for (const t of world.fighters) {
      if (t === this || t.team === this.team || !t.alive || t.removed || t.dying) continue;
      const G = this.grabCfg;
      if (!(FREE.has(t.state) || t.state === 'hurt' || t.state === 'block' || t.state === 'blockstun' || t.state === 'dizzy' || t.state === 'taunt' || (G && G.any && t.state === 'attack' && !t.boss))) continue;
      if (t.ungrabbable || Math.abs(t.z - this.z) > 0.4 || t.invuln > 0) continue;
      const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
      if (d > (G ? G.range : 0.95) + t.r) continue;
      if ((dx * this.fx + dy * this.fy) / (d || 1) < 0.2) continue;
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) return false;
    return this.grabTarget(world, best);
  }

  // Seize a specific target (used by tryGrab and by grabOnHit attacks such as Fat Vic's lunging headlock).
  grabTarget(world, best) {
    if (!best || !best.alive || best.ungrabbable || best.grabbedBy) return false;
    if (best.attack) best.attack = null;
    this.attack = null;
    this.grabbing = best; best.grabbedBy = this;
    this.grabT = 0; this.grabHits = 0;
    best.setState('grabbed'); best.vx = best.vy = 0;
    this.face2(best.x - this.x, best.y - this.y);
    best.face2(this.x - best.x, this.y - best.y);
    this.setState('grabbing');
    world.sfx('grab', this);
    return true;
  }

  releaseGrab() {
    const t = this.grabbing;
    if (t) {
      t.grabbedBy = null;
      if (t.state === 'grabbed') { t.setState('hurt'); t.stunT = 0.25; }
    }
    this.grabbing = null;
    if (this.state === 'grabbing') this.setState('idle');
  }

  throwTarget(world, dx, dy) {
    const t = this.grabbing;
    if (!t) return;
    let l = Math.hypot(dx, dy);
    if (l < 0.1) { dx = this.fx; dy = this.fy; l = 1; }
    dx /= l; dy /= l;
    this.grabbing = null; t.grabbedBy = null;
    t.setState('thrown');
    t.thrower = this;
    t.thrownHit = new Set([this]);
    t.wallSlam = false;
    t.x = this.x + dx * 0.5; t.y = this.y + dy * 0.5;
    t.vx = dx * 7.5; t.vy = dy * 7.5; t.vz = 4.5; t.z = Math.max(t.z, this.z + 0.3); t.onGround = false;
    t.face2(-dx, -dy);
    this.face2(dx, dy);
    this.startAttack('throwAnim', world);
    world.sfx('throw', this);
    world.onThrow && world.onThrow(this, t);
  }

  knockDown(dir, kb, launch = 0) {
    if (this.grabbing) this.releaseGrab();
    if (this.grabbedBy) { const g = this.grabbedBy; this.grabbedBy = null; g.grabbing = null; if (g.state === 'grabbing') g.setState('idle'); }
    this.attack = null;
    this.setState('knockdown');
    this.vx = dir.x * kb / this.weight; this.vy = dir.y * kb / this.weight;
    this.vz = 3.2 + launch * 0.55;
    this.onGround = false;
    this.face2(-dir.x, -dir.y);
  }

  // hit: { attacker, def, name, dmg, dir, kb, stun, knockdown, launch, unblockable, guardDmg }
  takeHit(hit, world) {
    if (!this.alive || this.dying) return 'none';
    if (this.invuln > 0) return 'miss';
    const dir = hit.dir;
    const facing = -(this.fx * dir.x + this.fy * dir.y) > 0.15;
    const att = hit.attacker && hit.attacker.kind === 'fighter' ? hit.attacker : null;
    if ((this.state === 'block' || this.state === 'blockstun') && facing && !hit.unblockable) {
      // PARRY: a fresh block right before the hit
      if (this.parryT > 0 && this.state === 'block') {
        this.parryT = 0;
        this.counterT = COUNTER_WINDOW + 0.15; this.counterTarget = att;
        this.vx = dir.x * 0.8; this.vy = dir.y * 0.8;
        if (att && att.alive && !att.boss && att.attack && !att.attack.def.air) {
          att.attack = null; att.setState('hurt'); att.hurtAnim = 'hurt'; att.stunT = 0.45;
          att.vx = -dir.x * 2.2; att.vy = -dir.y * 2.2;
        }
        if (world.fx) { world.fx.spark(this.x + this.fx * 0.4, this.y + this.fy * 0.4, this.z + 1.5, '#ffffff', 12); world.fx.popup(this.x, this.y, this.z, 'PARRY!', '#8ad8ff'); }
        world.sfx('block', this); world.sfx('combo', this);
        this.setState('blockstun'); this.stunT = 0.08;
        return 'blocked';
      }
      this.guard -= hit.guardDmg;
      const chip = Math.max(0, hit.dmg * 0.08 * this.defense);
      this.hp = Math.max(1, this.hp - chip);
      this.vx = dir.x * hit.kb * 0.6 / this.weight; this.vy = dir.y * hit.kb * 0.6 / this.weight;
      if (this.guard <= 0) {
        this.guard = this.maxGuard * 0.6;
        this.counterT = 0;
        this.setState('dizzy'); this.stunT = this.isPlayer ? 0.85 : 1.3;
        world.sfx('guardBreak', this);
        return 'guardbreak';
      }
      this.counterT = COUNTER_WINDOW; this.counterTarget = att;
      this.setState('blockstun'); this.stunT = Math.max(0.12, hit.stun * 0.45);
      return 'blocked';
    }
    const dmg = hit.dmg * this.defense;
    this.hp -= dmg;
    this.flashT = 0.09;
    this.lastAttacker = hit.attacker;
    this.face = 'hurt'; this.faceT = 0.4;
    this.counterT = 0;
    if (this.grabbing) this.releaseGrab();
    if (this.grabbedBy && this.grabbedBy !== hit.attacker) {
      const g = this.grabbedBy; this.grabbedBy = null; g.grabbing = null; if (g.state === 'grabbing') g.setState('idle');
    }
    if (this.attack && this.superArmor <= dmg) this.attack = null;
    this.hitChainT = this.isPlayer ? 0.7 : 0.9;
    this.hitChain++;
    if (this.hp <= 0) {
      this.hp = 0;
      this.knockDown(dir, Math.max(hit.kb, 3.5), Math.max(hit.launch, 3));
      this.dying = true;
      return 'ko';
    }
    const airborne = !this.onGround || this.state === 'jump' || this.state === 'knockdown';
    const mercy = this.isPlayer && this.hitChain >= PLAYER_MERCY_HITS && this.state !== 'grabbed';
    if (hit.knockdown || airborne || mercy || this.hitChain >= 7 || this.state === 'thrown') {
      if (this.superArmor > dmg * 1.5 && !airborne) { this.vx += dir.x * 0.6; this.vy += dir.y * 0.6; return 'armor'; }
      this.hitChain = 0;
      this.knockDown(dir, mercy && !hit.knockdown ? Math.max(hit.kb, 3) : hit.kb, hit.launch);
      return 'knockdown';
    }
    if (this.superArmor > dmg && this.state !== 'grabbed') {
      return 'armor';
    }
    if (this.state === 'dizzy') {
      // dazed fighters stay dazed (the punish window isn't cut short); hits just shove them
      this.vx = dir.x * hit.kb * 0.5 / this.weight; this.vy = dir.y * hit.kb * 0.5 / this.weight;
      return 'hit';
    }
    if (this.state !== 'grabbed') {
      this.attack = null;
      this.setState('hurt');
      this.hurtAnim = (hit.def && hit.def.hz !== undefined && hit.def.hz < 1.3) ? 'hurtGut' : 'hurt';
      this.vx = dir.x * hit.kb / this.weight; this.vy = dir.y * hit.kb / this.weight;
    } else {
      this.animT = 0;
    }
    this.stunT = hit.stun;
    return 'hit';
  }

  // called by resolveAttack when one of this fighter's attacks connects
  onAttackLanded(world, target, def, res, juggle) {
    if (def.counter && res !== 'blocked') {
      world.fx && world.fx.popup(target.x, target.y, target.z + 0.3, 'COUNTER!', '#ff6a3a');
      if (this.isPlayer) { world.slowmo = Math.max(world.slowmo || 0, 0.18); world.addScore && world.addScore(150, target.x, target.y, target.z + 1, false); }
    }
    if (juggle && this.isPlayer && world.fx && target.juggles >= 2) world.fx.popup(target.x, target.y, target.z + 0.6, 'JUGGLE!', '#7affe0');
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  weaponHit(world) {
    if (!this.weapon) return;
    this.weapon.durability--;
    if (this.weapon.durability <= 0) {
      world.weaponBroke && world.weaponBroke(this, this.weapon);
      this.weapon = null;
    }
  }

  // ------------------------------------------------------------------ update
  update(world, dt) {
    if (this.removed) return;
    this.stateT += dt; this.animT += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.parryT > 0) this.parryT -= dt;
    if (this.counterT > 0) this.counterT -= dt;
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this.sayText = null; }
    if (this.faceT > 0) { this.faceT -= dt; if (this.faceT <= 0) this.face = 'normal'; }
    if (this.hitChainT > 0) { this.hitChainT -= dt; if (this.hitChainT <= 0) this.hitChain = 0; }
    if (this.state !== 'block' && this.state !== 'blockstun') this.guard = Math.min(this.maxGuard, this.guard + this.maxGuard * 0.35 * dt);

    const I = this.intent;
    // a button pressed late in an attack that couldn't chain comes out as soon as the attack ends
    if (this.lateBtn) {
      this.lateBtn.t -= dt;
      if (this.lateBtn.t <= 0) this.lateBtn = null;
      else if (this.state !== 'attack' && !I.attack && !I.attackName) {
        I.attack = this.lateBtn.b; this.lateBtn = null;
        if (this.isPlayer && FREE.has(this.state) && !I.block) world.autoAim && world.autoAim(this, I.mx, I.my);
      }
    }
    const mvMag = Math.hypot(I.mx, I.my);
    let friction = 0;

    switch (this.state) {
      case 'idle': case 'walk': case 'run': {
        if (!this.onGround) { this.setState('jump'); this.airAttackUsed = true; break; }
        if (I.dodge) { this.startDodge(world, I.mx, I.my); break; }
        if (I.jump) { this.jump(world); this.vx = I.mx * (I.run ? this.runSpeed : this.speed); this.vy = I.my * (I.run ? this.runSpeed : this.speed); break; }
        if (I.grab && !this.weapon && this.state === 'run' && this.moves && this.moves.runGrab) { this.startAttack(this.moves.runGrab, world); break; }
        if (I.grab && !this.weapon && this.tryGrab(world)) break;
        if (I.attackName) { this.startAttack(I.attackName, world); break; }
        if (I.attack) {
          if (this.counterT > 0 && this.isPlayer) { this.startCounter(world); break; }
          const name = openingAttack(this, I.attack, { running: this.state === 'run', back: I.block && this.isPlayer, downTarget: !I.block && world.downTargetNear(this) });
          this.startAttack(name, world);
          break;
        }
        if (I.block) { this.setState('block'); this.parryT = PARRY_WINDOW; this.vx = this.vy = 0; break; }
        if (I.taunt) { this.setState('taunt'); this.vx = this.vy = 0; break; }
        if (mvMag > 0.05) {
          const sp = (I.run ? this.runSpeed : this.speed) * Math.min(1, mvMag);
          this.vx = I.mx / mvMag * sp; this.vy = I.my / mvMag * sp;
          this.face2(I.mx, I.my);
          const ns = I.run ? 'run' : 'walk';
          if (this.state !== ns) { this.state = ns; this.stateT = 0; }
        } else {
          this.vx = this.vy = 0;
          if (this.state !== 'idle') { this.state = 'idle'; this.stateT = 0; }
        }
        break;
      }
      case 'jump': {
        // light air control
        if (mvMag > 0.05) { this.vx += I.mx * 6 * dt; this.vy += I.my * 6 * dt; }
        const sp = Math.hypot(this.vx, this.vy), cap = this.runSpeed;
        if (sp > cap) { this.vx *= cap / sp; this.vy *= cap / sp; }
        if ((I.attack || I.attackName) && !this.airAttackUsed) {
          const name = I.attackName && ATTACKS[I.attackName] && ATTACKS[I.attackName].air ? I.attackName : openingAttack(this, I.attack || 'kick', { air: true });
          if (this.isPlayer) world.autoAim && world.autoAim(this, I.mx, I.my);
          this.startAttack(name, world);
          break;
        }
        if (this.onGround && this.stateT > 0.05) { this.setState('idle'); this.vx = this.vy = 0; world.sfx('land', this); world.fx && world.fx.dust(this.x, this.y, this.z, 3); }
        break;
      }
      case 'attack': this.updateAttack(world, dt, I); break;
      case 'block': {
        this.vx *= 0.8; this.vy *= 0.8;
        if (I.attackName) { this.startAttack(I.attackName, world); break; }
        if (I.attack) {
          if (this.counterT > 0) this.startCounter(world);
          else this.startAttack(openingAttack(this, I.attack, { back: true }), world);
          break;
        }
        if (mvMag > 0.05 && this.stateT > 0.05) this.face2(I.mx, I.my);
        if (!I.block) this.setState('idle');
        else if (I.dodge) this.startDodge(world, I.mx, I.my);
        break;
      }
      case 'blockstun': {
        friction = 10; this.stunT -= dt;
        if (this.counterT > 0 && (I.attack || I.attackName === 'counter') && this.stateT > 0.04) { this.startCounter(world); break; }
        if (this.stunT <= 0) this.setState(I.block ? 'block' : 'idle');
        break;
      }
      case 'dodge': {
        const k = Math.max(0, 1 - this.stateT / 0.42);
        this.vx = this.dodgeDir.x * 7 * k; this.vy = this.dodgeDir.y * 7 * k;
        if (this.stateT > 0.42) { this.setState('idle'); this.vx = this.vy = 0; }
        break;
      }
      case 'hurt': friction = 9; this.stunT -= dt; if (this.stunT <= 0) this.setState('idle'); break;
      case 'dizzy': friction = 9; this.stunT -= dt; if (this.stunT <= 0) this.setState('idle'); break;
      case 'knockdown': {
        if (this.onGround && this.stateT > 0.08) {
          this.setState('down');
          this.juggles = 0;
          this.downTime = this.dying ? 1.2 : (this.boss ? 0.6 : (this.isPlayer ? 0.75 : 0.85));
          world.sfx('fall', this);
          world.fx && world.fx.dust(this.x, this.y, this.z, 6);
          world.camera && world.camera.shake(2, 0.15);
        }
        break;
      }
      case 'down': {
        friction = 12;
        // the player can scramble up early by pressing any button
        if (this.isPlayer && !this.dying && this.hp > 0 && this.stateT > 0.3 && (I.attack || I.jump || I.dodge)) this.downTime = Math.min(this.downTime, this.stateT);
        if (this.stateT > this.downTime) {
          if (this.dying || this.hp <= 0) { this.die(world); }
          else { this.setState('getup'); this.invuln = 0.55; }
        }
        break;
      }
      case 'getup': friction = 20; if (this.stateT > 0.46) { this.setState('idle'); this.invuln = Math.max(this.invuln, 0.25); } break;
      case 'grabbing': this.updateGrabbing(world, dt, I); break;
      case 'grabbed': {
        friction = 30;
        this.stunT -= dt;
        const g = this.grabbedBy;
        if (!g || g.grabbing !== this || !g.alive) { this.grabbedBy = null; this.setState('idle'); break; }
        // struggle: mashing buttons shortens the hold
        if (I.attack || I.jump || I.dodge || I.grab) g.grabT += this.isPlayer ? 0.2 : 0.1;
        const choke = g.grabCfg && g.grabCfg.choke;
        const reach = choke ? 0.42 + this.r : 0.55 + this.r;
        this.x = g.x + g.fx * reach; this.y = g.y + g.fy * reach;
        let lift = 0;
        if (choke) {
          lift = 0.32 + Math.sin(this.stateT * 9) * 0.03;           // strangled off the ground, feet kicking
          const a = g.attack;
          if (a && a.def.chokeLift) lift = a.phase === 0 ? 0.32 + 1.1 * Math.min(1, a.t / a.def.startup) : 0;   // chokeslam: up... and down
        }
        this.z = g.z + lift;
        break;
      }
      case 'thrown': this.updateThrown(world, dt); break;
      case 'taunt': friction = 20; if (this.stateT > (this.tauntTime || 0.9)) this.setState('idle'); break;
      case 'pickup': case 'drink': {
        friction = 30;
        const dur = this.state === 'pickup' ? 0.25 : 0.55;
        if (this.stateT >= dur) { const cb = this.onAction; this.onAction = null; this.setState('idle'); cb && cb(); }
        break;
      }
      case 'victory': friction = 30; break;
      case 'dead': {
        friction = 12;
        this.deadT += dt;
        break;
      }
      default: break;
    }

    if (friction && this.onGround) {
      const sp = Math.hypot(this.vx, this.vy);
      if (sp > 0) { const ns = Math.max(0, sp - friction * dt); this.vx *= ns / sp; this.vy *= ns / sp; }
    }
    this.physics(world, dt);
  }

  updateAttack(world, dt, I) {
    const atk = this.attack;
    if (!atk) { this.setState('idle'); return; }
    const def = atk.def;
    const startup = atk.startup ?? def.startup;
    atk.t += dt;
    const prevPhase = atk.phase;
    if (def.air) {
      atk.phase = atk.t < startup ? 0 : (this.onGround && atk.t > startup + 0.03) ? 2 : 1;
      if (atk.phase === 2 && atk.landT === undefined) { atk.landT = atk.t; world.sfx('land', this); }
    } else {
      atk.phase = atk.t < startup ? 0 : atk.t < startup + def.active ? 1 : 2;
    }
    if (prevPhase === 0 && atk.phase >= 1 && def.whiff) world.sfx(def.whiff, this);
    // movement
    if (!def.air && this.onGround) {
      if (def.lunge && atk.phase <= 1 && !(def.lungeActive && atk.phase === 0)) { this.vx = this.fx * def.lunge; this.vy = this.fy * def.lunge; }
      else { this.vx *= 0.75; this.vy *= 0.75; }
    }
    // player: dodge cancels the recovery of grounded attacks
    if (this.isPlayer && I.dodge && atk.phase === 2 && !def.air && this.onGround) { this.startDodge(world, I.mx, I.my); return; }
    // combo buffering (presses any time during the attack are remembered; they chain once allowed)
    if (I.attack && atk.buffered && this.isPlayer && !atk.queued) atk.queued = I.attack;   // fast mashing: remember one more press
    else if (I.attack && atk.t > 0.02 && def.next && def.next[I.attack]) atk.buffered = def.next[I.attack];
    else if (I.attack && this.isPlayer && (atk.phase === 2 || def.grab)) this.lateBtn = { b: I.attack, t: 0.22 };
    if (I.attackName && atk.t > 0.02) atk.buffered = I.attackName;
    resolveAttack(world, this);
    const total = def.air ? (atk.landT !== undefined ? atk.landT + def.recovery : Infinity) : startup + def.active + def.recovery;
    const canChain = atk.phase === 2 && (atk.hit.size > 0 ? true : atk.t > total - def.recovery * 0.4);
    if (atk.buffered && canChain) {
      const nb = atk.buffered, q = atk.queued;
      this.attack = null;
      // re-aim toward the nearest target when chaining (player only; AI aims itself)
      if (this.isPlayer) world.autoAim && world.autoAim(this, I.mx, I.my);
      if (this.startAttack(nb, world) && q) {
        const nd = this.attack.def;
        if (nd.next && nd.next[q]) this.attack.buffered = nd.next[q];
      }
      return;
    }
    if (atk.t >= total) {
      this.attack = null;
      if (this.grabbing && this.grabbing.grabbedBy === this) { this.state = 'grabbing'; this.stateT = 0.3; }
      else this.setState(this.onGround ? 'idle' : 'jump');
    }
  }

  updateGrabbing(world, dt, I) {
    const t = this.grabbing;
    this.vx = this.vy = 0;
    this.grabT += dt;
    if (!t || t.grabbedBy !== this || !t.alive) { this.grabbing = null; this.setState('idle'); return; }
    const mvMag = Math.hypot(I.mx, I.my);
    if (this.stateT < 0.12 && !(this.grabCfg && this.grabCfg.squeeze && (I.attack === "punchL" || I.attack === "punchR"))) return;
    if (I.attack === 'kick' || (I.grab && this.grabT > 0.15)) {
      const backward = mvMag > 0.3 && (I.mx * this.fx + I.my * this.fy) < -0.3;
      this.throwTarget(world, backward ? I.mx : this.fx, backward ? I.my : this.fy);
      return;
    }
    const G = this.grabCfg;
    if (G && G.choke && this.state === 'grabbing') {
      this.chokeTick = (this.chokeTick || 0) + dt;
      if (this.chokeTick >= (G.tick || 0.45)) {
        this.chokeTick = 0;
        const d = { x: this.fx, y: this.fy };
        const def = { hz: 1.8, sfx: 'grunt', score: 15, choke: true };
        const res = t.takeHit({ attacker: this, def, dmg: (G.tickDmg || 3) * (this.power || 1), dir: d, kb: 0, stun: 0.5, knockdown: false, launch: 0, unblockable: true, guardDmg: 0 }, world);
        world.onHit(this, t, def, res, G.tickDmg || 3);
        if (Math.random() < 0.25 && t.say) t.say(['GRRK!', 'HKK...', 'URK!'][Math.floor(Math.random() * 3)], 0.6);
        if (!t.alive || t.hp <= 0 || t.dying) { this.releaseGrab(); this.winLine && this.say(this.winLine, 2.2); return; }
      }
    }
    if (G && G.squeeze && (I.attack === 'punchL' || I.attack === 'punchR')) {
      this.grabHits = (this.grabHits || 0) + 1;
      this.grabT = Math.min(this.grabT, (G.hold || 1.8) * 0.5);   // squeezing keeps the hold locked
      if (this.grabHits >= (G.hits || 4) && G.finisher) { this.startAttack(G.finisher, world); return; }
      this.startAttack(G.squeeze, world);
      if (t.say && Math.random() < 0.3) t.say('URGH!', 0.6);
      return;
    }
    if (I.attack === 'punchL' || I.attack === 'punchR') {
      this.grabHits = (this.grabHits || 0) + 1;
      if (this.grabHits >= 4) { this.throwTarget(world, this.fx, this.fy); return; }
      this.startAttack(I.attack === 'punchR' && this.grabHits === 3 ? 'headbutt' : 'knee', world);
      return;
    }
    if (I.attackName) { this.startAttack(I.attackName, world); return; }
    if (this.grabT > ((this.grabCfg && this.grabCfg.hold) || 1.8)) { // target struggles free
      this.releaseGrab();
      t.vx = t.fx * -2; t.vy = t.fy * -2;
    }
  }

  updateThrown(world, dt) {
    // hits other fighters on the way
    const pw = this.thrower ? this.thrower.power || 1 : 1;
    for (const o of world.fighters) {
      if (o === this || !o.alive || this.thrownHit.has(o) || o.isDown || o.invuln > 0 || o.dying) continue;
      if (Math.hypot(o.x - this.x, o.y - this.y) < o.r + this.r + 0.15 && Math.abs(o.z - this.z) < 1.2) {
        this.thrownHit.add(o);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const res = o.takeHit({ attacker: this.thrower || this, def: ATTACKS.throwImpact, dmg: 10 * pw, dir: { x: this.vx / sp, y: this.vy / sp }, kb: 4, stun: 0.5, knockdown: true, launch: 2, guardDmg: 20 }, world);
        world.onHit(this.thrower || this, o, ATTACKS.throwImpact, res, 10 * pw);
      }
    }
    world.breakPropsAt && world.breakPropsAt(this.x + this.vx * 0.05, this.y + this.vy * 0.05, this.z, this.thrower || this, 20);
    if (this.onGround && this.stateT > 0.1) {
      const dmg = 12 * pw;
      this.hp -= dmg * this.defense;
      this.flashT = 0.1;
      if (this.hp <= 0) { this.hp = 0; this.dying = true; }
      world.onThrowLand && world.onThrowLand(this, dmg);
      this.setState('down');
      this.juggles = 0;
      this.downTime = this.dying ? 1.2 : 0.9;
      world.sfx('fall', this);
      world.fx && world.fx.dust(this.x, this.y, this.z, 8);
      world.camera && world.camera.shake(4, 0.2);
      this.vx *= 0.3; this.vy *= 0.3;
    }
  }

  die(world) {
    this.alive = false;
    this.setState('dead');
    this.deadT = 0;
    world.onDeath && world.onDeath(this);
  }

  physics(world, dt) {
    if (this.state === 'grabbed') return;
    if (this.vx || this.vy) {
      const hit = world.moveEntity(this, this.vx * dt, this.vy * dt);
      if (hit && this.state === 'thrown') {
        // slam into wall
        this.vx *= -0.3; this.vy *= -0.3;
        if (!this.wallSlam) {
          this.wallSlam = true; this.hp -= 6; if (this.hp <= 0) { this.hp = 0; this.dying = true; }
          world.sfx('wallSlam', this); world.camera && world.camera.shake(4, 0.2);
        }
      }
      if (hit && this.state === 'knockdown') { this.vx *= -0.35; this.vy *= -0.35; }
      this.blockedMove = hit;
    } else this.blockedMove = false;
    const g = world.groundHeight(this.x, this.y, this.z);
    if (this.onGround) {
      if (g < this.z - 0.06) { this.onGround = false; this.vz = 0; }
      else this.z = g;
    }
    if (!this.onGround) {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= g) {
        this.z = g;
        this.vz = 0;
        this.onGround = true;
      }
    }
  }

  // ------------------------------------------------------------------ rendering
  getPose(out = {}) {
    switch (this.state) {
      case 'attack': {
        const a = this.attack;
        if (!a) return sampleAnim('guard', this.animT, out);
        const d = a.def;
        const su = a.startup ?? d.startup;
        let p;
        if (a.phase === 0) p = a.t / su;
        else if (a.phase === 1) p = d.air ? Math.min(1, (a.t - su) / 0.12) : (a.t - su) / d.active;
        else p = d.air ? (a.t - a.landT) / d.recovery : (a.t - su - d.active) / d.recovery;
        return attackPose(d.pose, a.phase, Math.max(0, Math.min(1, p)), GUARD, out);
      }
      case 'idle': return sampleAnim(this.combat ? 'guard' : 'idle', this.animT, out);
      case 'walk': return sampleAnim(this.combat ? 'fightWalk' : 'walk', this.animT * (Math.hypot(this.vx, this.vy) / 3), out);
      case 'run': return sampleAnim('run', this.animT, out);
      case 'jump': return sampleAnim(this.vz > 1 ? 'jump' : 'fall', this.animT, out);
      case 'block': return sampleAnim('block', this.animT, out);
      case 'blockstun': return sampleAnim('blockHit', this.animT, out);
      case 'dodge': return sampleAnim('dodge', this.animT, out);
      case 'hurt': return sampleAnim(this.hurtAnim, this.animT, out);
      case 'dizzy': return sampleAnim('dizzy', this.animT, out);
      case 'knockdown': return sampleAnim('knockdown', this.animT, out);
      case 'down': return sampleAnim('down', this.animT, out);
      case 'dead': return sampleAnim('dead', this.animT, out);
      case 'getup': return sampleAnim('getup', this.animT, out);
      case 'grabbing': return sampleAnim(this.grabCfg && this.grabCfg.choke ? 'choking' : 'grabbing', this.animT, out);
      case 'grabbed': return sampleAnim(this.grabbedBy && this.grabbedBy.grabCfg && this.grabbedBy.grabCfg.choke ? 'choked' : 'grabbed', this.animT, out);
      case 'thrown': return sampleAnim('thrown', this.animT, out);
      case 'taunt': return sampleAnim(this.tauntAnim || 'taunt', this.animT, out);
      case 'victory': return sampleAnim('victory', this.animT, out);
      case 'pickup': return sampleAnim('pickup', this.animT, out);
      case 'drink': return sampleAnim('drink', this.animT, out);
      default: return sampleAnim(this.state, this.animT, out);
    }
  }

  // screen-space facing
  visual() {
    const sdx = this.fx - this.fy, sdy = this.fx + this.fy;
    if (sdx < -0.05) this.visFlip = true; else if (sdx > 0.05) this.visFlip = false;
    return { flip: this.visFlip, back: sdy < -0.35 };
  }

  draw(ctx, world) {
    if (this.removed) return;
    const g = world.groundHeight(this.x, this.y, this.z);
    const sg = toScreen(this.x, this.y, g);
    const sc = this.look.height || 1;
    shadow(ctx, sg.x, sg.y, 8 * sc, 3.5 * sc, this.state === 'down' || this.state === 'dead' ? 0.3 : 0.38);
    const s = toScreen(this.x, this.y, this.z);
    const vis = this.visual();
    let alpha = 1;
    if (this.state === 'dead') alpha = this.team === 'player' ? 1 : Math.max(0, 1 - Math.max(0, this.deadT - 1.2) / 0.8);
    if (this.invuln > 0 && this.state !== 'dodge' && this.team === 'player' && Math.floor(this.invuln * 20) % 2 === 0) alpha *= 0.45;
    if (this.state === 'dead' && this.team !== 'player' && this.deadT > 0.4 && Math.floor(this.deadT * 12) % 2 === 0) alpha *= 0.5;
    if (alpha <= 0) return;
    const pose = this.getPose();
    let face = this.face;
    if (this.state === 'down' || this.state === 'dead' || this.state === 'dizzy') face = this.hp <= 0 ? 'ko' : 'hurt';
    else if (this.state === 'attack' && face === 'normal') face = 'shout';
    else if (this.combat && face === 'normal') face = 'angry';
    // Pre-rendered Blender sprite when the atlas for this look is loaded, else the procedural doll.
    if (this._specLook !== this.look) { this._spec = specForLook(this.look); this._specLook = this.look; }
    const spec = this._spec;
    let drawn = false;
    if (!this.noSprite && SPRITE_MODELS[spec.model]) {
      const { clip, frame } = fighterClip(this, spec.model);
      const scl = (this.look.height || 1) * (this.spriteScale || 1);
      drawn = drawCharacter(ctx, s.x, s.y, spec, clip, frame, this.fx, this.fy, { flash: this.flashT > 0, alpha, scale: scl });
      if (drawn && this.weapon && this.weapon.def.drawHeld) {
        const h = handPos(spec, clip, frame, this.fx, this.fy, scl);
        if (h) {
          const pa = ctx.globalAlpha; ctx.globalAlpha = pa * alpha;
          this.weapon.def.drawHeld(ctx, Math.round(s.x + h.x), Math.round(s.y + h.y), h.ang, 1, this.flashT > 0);
          ctx.globalAlpha = pa;
        }
      }
    }
    if (!drawn) drawDoll(ctx, s.x, s.y, this.look, pose, {
      flip: vis.flip, back: vis.back, flash: this.flashT > 0, alpha, face,
      weapon: this.weapon ? this.weapon.def : null,
      time: world.time + this.id, sway: Math.min(0.6, Math.hypot(this.vx, this.vy) * 0.08),
    });
    if (this.state === 'dizzy' || (this.state === 'down' && this.hp > 0 && this.downTime > 1)) world.fx && world.fx.drawStars(ctx, s.x, s.y - 50 * sc, world.time);
    if (world.overheadQueue) world.overheadQueue.push(() => this.drawOverhead(ctx, world, s, sc));
    else this.drawOverhead(ctx, world, s, sc);
  }

  // telegraph "!" for slow AI attacks, counter-ready glint, speech bubbles
  drawOverhead(ctx, world, s, sc) {
    const top = s.y - 54 * sc;
    if (this.isPlayer && this.counterT > 0 && (this.state === 'block' || this.state === 'blockstun')) {
      if (Math.floor(world.time * 20) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        const gx = Math.round(s.x + 8 * sc), gy = Math.round(top + 6);
        ctx.fillRect(gx - 3, gy, 7, 1); ctx.fillRect(gx, gy - 3, 1, 7);
      }
    }
    if (this.sayText && this.sayT > 0 && this.alive) {
      const w = measureText(this.sayText);
      const bx = Math.round(s.x - w / 2 - 3), by = Math.round(top - 12);
      ctx.globalAlpha = Math.min(1, this.sayT * 4);
      ctx.fillStyle = '#0c0a10';
      ctx.fillRect(bx - 1, by - 1, w + 8, 12);
      ctx.fillStyle = '#f4f1e8';
      ctx.fillRect(bx, by, w + 6, 10);
      ctx.fillRect(Math.round(s.x) - 1, by + 10, 3, 2);
      ctx.fillRect(Math.round(s.x), by + 12, 1, 1);
      drawText(ctx, this.sayText, bx + 3, by + 2, { color: this.team === 'player' ? '#c8102e' : '#1a1420' });
      ctx.globalAlpha = 1;
    }
    // telegraph: flashing "!" beside the head while a slow AI attack winds up (drawn last, above bubbles)
    const a = this.attack;
    if (a && a.tele && a.phase === 0 && this.state === 'attack') {
      const k = Math.min(1, a.t / (a.startup || 0.3));
      const col = Math.floor(world.time * 16) % 2 ? '#ff3a2a' : '#ffe14a';
      const ex = Math.round(s.x + (this.visFlip ? 13 : -13) * sc), ey = Math.round(top + 2 - k * 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(ex - 3, ey - 1, 6, 13);
      ctx.fillStyle = col;
      ctx.fillRect(ex - 2, ey, 4, 7);
      ctx.fillRect(ex - 2, ey + 9, 4, 2);
    }
  }

  // screen-space bounding box of the sprite (for occlusion tests)
  screenBox() {
    const s = toScreen(this.x, this.y, this.z);
    const sc = this.look.height || 1;
    return { x0: s.x - 10 * sc, x1: s.x + 10 * sc, y0: s.y - 46 * sc, y1: s.y };
  }
}

// internal pseudo-attacks
ATTACKS.throwAnim = { pose: 'throw', startup: 0.06, active: 0.05, recovery: 0.25, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, hz: 1 };
ATTACKS.throwImpact = { pose: 'throw', startup: 0, active: 0, recovery: 0, dmg: 10, reach: 0, arc: 0, kb: 4, stun: 0.5, knockdown: true, sfx: 'hitHeavy', hz: 1, hitstop: 0.07, shake: 4, score: 60 };
export { Z_PX };
