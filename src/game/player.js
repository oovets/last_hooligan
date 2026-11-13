// Player controller: keyboard/gamepad -> Fighter intents. Also builds the player Fighter.
//
// Controls (see combat.js for the full move list):
//   move, double-tap (or full stick) = run      J / K punches, L kick (chain into combos)     SPACE jump
//   SHIFT block (tap just before a hit = PARRY; attack right after a block = COUNTER; BLOCK + attack = rear elbow/back kick)
//   O dodge (i-frames; cancels attack recovery)    I grab (with a weapon: throw it)    E use/pick up    1-3 items
// save.data.settings.controls: 'screen' (default; up = up the screen) or 'iso' (right = world +x, down = world +y,
// left = -x, up = -y — i.e. the d-pad follows the street grid).
import { input, KEYMAP } from '../engine/input.js';
import { screenDirToWorld } from '../engine/iso.js';
import { Fighter } from './fighter.js';
import { save } from '../save.js';
import { characterById } from '../content/characters.js';

export const PLAYER_BASE = { hp: 100, speed: 3.1, runSpeed: 5.6, power: 1, defense: 0.85, guard: 40 };

export function createPlayer(game, x, y) {
  const ch = characterById(game.character);
  const F = ch.fighter || {};
  const f = new Fighter({
    type: 'player', name: ch.name, team: 'player',
    look: ch.look || game.look(), x, y,
    hp: F.hp ?? PLAYER_BASE.hp, speed: F.speed ?? PLAYER_BASE.speed, runSpeed: F.runSpeed ?? PLAYER_BASE.runSpeed,
    power: (F.power ?? PLAYER_BASE.power) * (1 + (game.perks.power || 0)),
    defense: (F.defense ?? PLAYER_BASE.defense) * (1 - (game.perks.defense || 0)),
    guard: F.guard ?? PLAYER_BASE.guard, weight: F.weight ?? 1, superArmor: F.superArmor ?? 0, reachMul: F.reachMul ?? 1,
  });
  f.isPlayer = true;
  f.character = ch.id;
  f.moves = ch.moves && Object.keys(ch.moves).length ? ch.moves : null;
  f.grabCfg = ch.grab || null;
  f.kickMul = ch.kickMul || 0; f.punchMul = ch.punchMul || 0;
  f.winLine = ch.winLine || null;
  f.koLines = ch.koLines || null; f.rage = !!ch.rage;
  f.controller = new PlayerController();
  return f;
}

const DIRS = ['up', 'down', 'left', 'right'];

// Presses are also captured straight from keydown events: the World skips controllers during hitstop, so a tap
// that starts and ends inside a hit-freeze would otherwise be lost (combos would feel like they eat inputs).
const CODE2ACT = {};
for (const [a, codes] of Object.entries(KEYMAP)) for (const c of codes) (CODE2ACT[c] ||= []).push(a);
const PRESSQ = {};   // action -> timestamp (ms) of the latest unconsumed keydown
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
if (input.onKey) input.onKey(e => { if (e.repeat) return; const t = now(); for (const a of CODE2ACT[e.code] || []) PRESSQ[a] = t; });
const BTNS = ['punchL', 'punchR', 'kick', 'jump', 'dodge', 'grab'];

// Map a raw input vector to a world direction according to the control scheme.
export function moveToWorld(mx, my) {
  if (!mx && !my) return { x: 0, y: 0 };
  if (save.data.settings && save.data.settings.controls === 'iso') {
    const l = Math.hypot(mx, my) || 1;
    return { x: mx / l, y: my / l };
  }
  return screenDirToWorld(mx, my);
}

export class PlayerController {
  constructor() {
    this.time = 0;
    this.lastTap = {};
    this.running = false;
    this.bufAttack = null; this.bufT = 0;
    this.bufDodge = 0; this.bufJump = 0;
    this.padHold = 0;
    this.enabled = true;
  }

  // edge-detect a button since the last controller update (input edge, queued keydown, or newly held)
  pollButtons() {
    const t = now(), out = {};
    if (!this.prevDown) {   // first update: ignore keys still held / pressed from the menu that started the level
      this.prevDown = {};
      for (const a of BTNS) { this.prevDown[a] = input.down(a); PRESSQ[a] = undefined; out[a] = false; }
      return out;
    }
    for (const a of BTNS) {
      const q = PRESSQ[a] !== undefined && t - PRESSQ[a] < 250;
      const held = input.down(a);
      out[a] = input.pressed(a) || q || (held && !this.prevDown[a]);
      this.prevDown[a] = held;
      PRESSQ[a] = undefined;
    }
    return out;
  }

  update(f, world, dt) {
    this.time += dt;
    const I = f.intent;
    I.attack = null; I.attackName = null; I.jump = false; I.dodge = false; I.grab = false; I.use = false; I.taunt = false;
    const P = this.pollButtons();
    if (!this.enabled) { I.mx = I.my = 0; I.block = false; I.run = false; this.bufAttack = null; return; }
    // command mode (ui/firmhud.js): the stick and the attack buttons drive the order cursor, the leader stands his ground
    if (world.firm && world.firm.command) { I.mx = I.my = 0; I.run = false; this.running = false; I.block = input.down('block'); this.bufAttack = null; return; }

    const m = input.move();
    const w = moveToWorld(m.x, m.y);
    I.mx = w.x * m.mag; I.my = w.y * m.mag;

    // double-tap to run (keyboard); full-tilt hold to run (stick)
    for (const d of DIRS) {
      if (input.pressed(d)) {
        if (this.time - (this.lastTap[d] ?? -9) < 0.28) this.running = true;
        this.lastTap[d] = this.time;
      }
    }
    if (input.lastDevice === 'pad') {
      if (m.mag > 0.93) this.padHold += dt; else this.padHold = 0;
      if (this.padHold > 0.45) this.running = true;
    }
    if (m.mag < 0.1) this.running = false;
    I.run = this.running;
    I.block = input.down('block');

    // attacks with a short input buffer (so presses during hitstun/landing/dodge still come out)
    const btn = P.punchL ? 'punchL' : P.punchR ? 'punchR' : P.kick ? 'kick' : null;
    if (btn) { this.bufAttack = btn; this.bufT = 0.2; }
    else if (this.bufT > 0) { this.bufT -= dt; if (this.bufT <= 0) this.bufAttack = null; }
    const st = f.state;
    const ready = f.canAct || st === 'attack' || st === 'jump' || st === 'grabbing' || st === 'grabbed' || st === 'down' ||
      (st === 'blockstun' && f.counterT > 0);
    if (this.bufAttack && ready) {
      I.attack = this.bufAttack;
      this.bufAttack = null; this.bufT = 0;
      if (f.canAct && !I.block) world.autoAim(f, I.mx, I.my);
    }

    // dodge / jump are buffered briefly too (pressed during hitstop or the last frames of an attack)
    if (P.dodge) this.bufDodge = 0.12; else if (this.bufDodge > 0) this.bufDodge -= dt;
    if (P.jump) this.bufJump = 0.1; else if (this.bufJump > 0) this.bufJump -= dt;
    const dodgeReady = f.canAct || (st === 'attack' && f.attack && f.attack.phase === 2 && !f.attack.def.air);
    if (this.bufDodge > 0 && dodgeReady) { I.dodge = true; this.bufDodge = 0; }
    if (this.bufJump > 0 && (f.canAct || st === 'down' || st === 'grabbed')) { I.jump = true; this.bufJump = 0; }
    if (P.dodge && (st === 'down' || st === 'grabbed')) I.dodge = true;

    I.grab = P.grab;
    I.use = input.pressed('use');

    // weapon throw with grab
    if (I.grab && f.weapon && f.canAct) { world.throwWeapon(f); I.grab = false; }
    if (I.use && f.canAct) world.playerUse(f);
    for (let i = 1; i <= 3; i++) if (input.pressed('item' + i) && f.canAct) world.useItemSlot(i - 1);
  }
}
