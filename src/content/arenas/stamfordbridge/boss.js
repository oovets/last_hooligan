// STAMFORD BRIDGE (tour arena): the Headhunters' crew, the building site lot and the boss.
// All ids start with 'stamfordbridge_'. Every character here is INVENTED (the firm is real, these people aren't).
//
//   stamfordbridge_casual     CALLING-CARD CASUAL  fast and smart: HIT AND RUN (lands a shot, backs off, comes again
//                                                  with a darting jab or a flying kick). Leaves a calling card.
//   stamfordbridge_cityboy    CITY BOY             suit, brolly: long reach, blocks, telegraphed BROLLY POKE
//   stamfordbridge_scaffolder SCAFFOLDER           site lad with a scaffold tube
//   stamfordbridge_gaffer     THE GAFFER           big site foreman: super armour, grabs, HARD HAT CHARGE.
//                                                  The man to PIN (get a lad to hold him, then hit him for free)
//   stamfordbridge_monty      MONTY 'THE BROLLY' FAIRWEATHER  BOSS. Immaculate. Pattern:
//        EN GARDE (0.45s, stands still pointing the brolly) -> BROLLY FLURRY (4-5 thrusts, last one launches)
//        CALLING CARD (holds a card up 0.5s) -> flicks it straight at you: it STUNS (step aside!)
//        BONNET SLIDE (crouches 0.45s) -> slides across a car bonnet at you (long range / car in the way)
//        SURROUND HIM (at 70% and 35%): whistles, his crew ring you and barge your lads away -> BACK TO ME!
//        under 50%: jacket off, faster, flurries get longer.

import { registerEnemy, casualLook } from '../../enemies.js';
import { registerAttack } from '../../../game/combat.js';
import { registerAttackPose, GUARD } from '../../../game/poses.js';
import { ITEMS } from '../../../game/items.js';
import { normalizeLook } from '../../../game/doll.js';
import { ellipse, shadow } from '../../../engine/gfx.js';
import { toScreen } from '../../../engine/iso.js';
import { drawText } from '../../../engine/font.js';
import { input } from '../../../engine/input.js';
import { BLUE, WHITE } from './theme.js';

const G = GUARD;
const OL = '#120c14';
const pick = a => a[Math.floor(Math.random() * a.length)];
const live = f => !!f && f.alive && f.hp > 0 && !f.removed;
const popup = (world, f, text, color = '#a8c8ff') => world.fx.popup(f.x, f.y, f.z + 0.5, text, color);

// ------------------------------------------------------------------ poses
registerAttackPose('stamfordbridge_engarde', {
  windup: { ...G, uaN: 1.6, faN: 0.2, uaF: -0.4, faF: 1.6, lean: -0.1, dx: -2 },
  hit: { ...G, uaN: 1.65, faN: 0.05, uaF: -0.5, faF: 1.8, lean: 0.35, dx: 5, thN: 0.6, knN: 0.5, thF: -0.4, knF: 0.2 },
});
registerAttackPose('stamfordbridge_lunge', {
  windup: { ...G, uaN: 0.9, faN: 1.6, lean: -0.2, dx: -3, thN: 0.2, knN: 0.6 },
  hit: { ...G, uaN: 1.7, faN: 0.0, uaF: -0.8, faF: 0.6, lean: 0.6, dx: 8, dy: 3, thN: 1.0, knN: 0.9, thF: -0.7, knF: 0.1 },
});
registerAttackPose('stamfordbridge_flick', {
  windup: { ...G, uaN: 2.7, faN: 1.6, lean: -0.15, dx: -1 },
  hit: { ...G, uaN: 1.6, faN: 0.1, lean: 0.3, dx: 3 },
});
registerAttackPose('stamfordbridge_slide', {
  windup: { lean: 0.5, dy: 7, thN: 1.1, knN: 1.9, thF: -0.3, knF: 1.4, uaN: 0.4, faN: 1.6, uaF: 0.6, faF: 1.6 },
  hit: { lean: -0.35, dy: 6, thN: 1.5, knN: 0.2, thF: -0.2, knF: 1.6, uaN: 2.3, faN: 0.2, uaF: -0.6, faF: 0.4 },
});
registerAttackPose('stamfordbridge_poke', {
  windup: { ...G, uaN: 0.6, faN: 2.2, lean: -0.15, dx: -2 },
  hit: { ...G, uaN: 1.6, faN: 0.0, lean: 0.45, dx: 6, thN: 0.7, knN: 0.6 },
});

// ------------------------------------------------------------------ attacks
registerAttack('stamfordbridge_dart', { pose: 'cross', startup: 0.1, active: 0.1, recovery: 0.22, dmg: 8, reach: 1.1, arc: 0.7, kb: 3, stun: 0.42, lunge: 6, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.6, hitstop: 0.06, shake: 2, score: 20 });
registerAttack('stamfordbridge_poke', { pose: 'stamfordbridge_poke', startup: 0.34, active: 0.1, recovery: 0.32, dmg: 9, reach: 2.0, arc: 0.4, kb: 4, stun: 0.45, sfx: 'weapon', whiff: 'whoosh', hz: 1.4, hitstop: 0.06, shake: 2, score: 20 });
registerAttack('stamfordbridge_thrust', { pose: 'stamfordbridge_engarde', startup: 0.07, active: 0.07, recovery: 0.1, dmg: 6, reach: 1.75, arc: 0.45, kb: 1.6, stun: 0.34, sfx: 'weapon', whiff: 'whoosh', hz: 1.4, hitstop: 0.04, shake: 1, score: 0 });
registerAttack('stamfordbridge_lungeFinish', { pose: 'stamfordbridge_lunge', startup: 0.16, active: 0.12, recovery: 0.45, dmg: 12, reach: 1.9, arc: 0.5, kb: 5, stun: 0.55, knockdown: true, launch: 3.5, lunge: 5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.3, hitstop: 0.1, shake: 5, score: 0 });
registerAttack('stamfordbridge_flick', { pose: 'stamfordbridge_flick', startup: 0.5, active: 0.06, recovery: 0.3, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, whiff: 'whoosh' });
registerAttack('stamfordbridge_slide', { pose: 'stamfordbridge_slide', startup: 0.45, active: 0.55, recovery: 0.45, dmg: 13, reach: 1.0, arc: Math.PI, kb: 5.5, stun: 0.55, knockdown: true, launch: 3, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 0.6, hitstop: 0.09, shake: 5, score: 0 });

// ------------------------------------------------------------------ the calling card
// "CONGRATULATIONS, YOU HAVE JUST MET THE HEADHUNTERS": a card flutters down where a Headhunter drops.
export const CARD_TEXT = 'CONGRATULATIONS, YOU HAVE JUST MET THE HEADHUNTERS';
function drawCard(ctx, x, y, a, glow) {
  const w = Math.max(1, Math.round(Math.abs(Math.cos(a)) * 6)), h = 4;
  ctx.fillStyle = OL; ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(y - h / 2) - 1, w + 2, h + 2);
  ctx.fillStyle = glow ? '#ffffff' : '#f4f0e4'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  if (w > 3) { ctx.fillStyle = BLUE; ctx.fillRect(Math.round(x - w / 2) + 1, Math.round(y - 1), w - 2, 1); }
}
export function spawnCallingCard(world, x, y) {
  const S = world.__sbCards || (world.__sbCards = { n: 0, told: false });
  if (S.n > 6) return;
  S.n++;
  if (!S.told) { S.told = true; world.toast(CARD_TEXT); }
  world.addActor({
    kind: 'sbCallingCard', x, y, z: 1.7, t: 0, ph: Math.random() * 6, removed: false,
    update(w, dt) {
      this.t += dt;
      if (this.z > 0) { this.z = Math.max(0, this.z - dt * 0.9); this.x += Math.sin(this.t * 4 + this.ph) * dt * 0.6; }
      if (this.t > 9) { this.removed = true; S.n--; }
    },
    depth() { return this.x + this.y + 0.1; },
    draw(ctx) {
      const g = toScreen(this.x, this.y, 0);
      if (this.t > 8) ctx.globalAlpha = Math.max(0, 9 - this.t);
      shadow(ctx, g.x, g.y, 3, 1, 0.25);
      const s = toScreen(this.x, this.y, this.z);
      drawCard(ctx, s.x, s.y, this.z > 0 ? this.t * 6 + this.ph : 0.2, false);
      if (this.z <= 0 && this.t < 4.5) drawText(ctx, 'HH', s.x, s.y - 10, { color: '#a8c8ff', align: 'center', outline: '#000' });
      ctx.globalAlpha = 1;
    },
  });
}

// The boss's flicked card: flies straight, stuns the first of yours it touches.
function spawnFlickCard(world, f, tx, ty) {
  const sx = f.x + f.fx * 0.5, sy = f.y + f.fy * 0.5;
  const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
  const sp = 10.5;
  world.addActor({
    kind: 'sbFlickCard', x: sx, y: sy, z: 1.3, vx: dx / d * sp, vy: dy / d * sp, t: 0, removed: false,
    update(w, dt) {
      this.t += dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (w.heightAt(this.x, this.y) > this.z || this.t > 1.1) { this.removed = true; w.fx.spark(this.x, this.y, this.z, '#ffffff', 4); return; }
      for (const t of w.fighters) {
        if (t.team !== 'player' || !t.alive || t.isDown || t.invuln > 0 || t.z > 1.6) continue;
        if (Math.hypot(t.x - this.x, t.y - this.y) > 0.55) continue;
        const def = { hz: 1.6, sfx: 'slap' };
        const dir = { x: this.vx / sp, y: this.vy / sp };
        const res = t.takeHit({ attacker: f, def, dmg: 4, dir, kb: 1.2, stun: 0.3, knockdown: false, launch: 0, unblockable: false, guardDmg: 12 }, w);
        w.onHit(f, t, def, res, 4);
        if (res === 'hit' && t.alive && !t.isDown) {
          t.setState('dizzy'); t.stunT = t.isPlayer ? 1.05 : 1.6;
          w.fx.popup(t.x, t.y, t.z + 0.6, 'CARDED!', '#ffffff');
        }
        this.removed = true;
        return;
      }
    },
    depth() { return this.x + this.y; },
    draw(ctx, w) {
      const g = toScreen(this.x, this.y, 0); shadow(ctx, g.x, g.y, 3, 1, 0.3);
      const s = toScreen(this.x, this.y, this.z);
      ctx.globalAlpha = 0.35; drawCard(ctx, s.x - this.vx * 0.9, s.y - this.vy * 0.45, this.t * 30 - 1, false); ctx.globalAlpha = 1;
      drawCard(ctx, s.x, s.y, this.t * 30, true);
    },
  });
}

// ------------------------------------------------------------------ looks
const STONE = ['#c8b48a', '#d8ccb0', '#2a3346', '#1a1a22', '#4a5a3a', '#8a2a2a'];
function designerLook(rng, o = {}) {
  const L = casualLook(rng, { a: BLUE, b: WHITE, scarf: null, hatChance: 0.25, maskChance: 0.1, hoodChance: 0.05, hair: ['mod', 'curtains', 'crop', 'sidepart', 'wedge'] });
  L.jacket = rng.pick([
    { style: 'parka', color: rng.pick(STONE), badge: '#e8c040' },
    { style: 'harrington', color: rng.pick(['#c8b48a', '#1a1a22', '#2a3346']), lining: rng.pick(['#a01818', BLUE]) },
    { style: 'track', color: rng.pick(['#1d2742', '#f2f2ee', '#3a3a3e']), trim: rng.pick([WHITE, BLUE]) },
    { style: 'polo', color: rng.pick(['#f2f2ee', '#c8b48a', '#1d2742']) },
  ]);
  L.shirt = rng.pick(['#f2f2ee', '#e8d8a8', BLUE]);
  L.pants = { style: 'jeans', color: rng.pick(['#2a3346', '#1e1e26', '#6a6050', '#3a4a6a']) };
  L.shoes = { color: rng.pick(['#f2f2ee', '#e8e0c8', '#f2f2ee']), sole: '#b8a070', style: 'trainer', stripe: rng.pick([BLUE, '#1a1a1a', '#c8102e']) };
  L.shades = rng.chance(0.35);
  if (L.hat) L.hat = { style: 'cap', color: rng.pick(['#e8e0cc', '#1d2742', '#c8b48a']) };
  L.build = o.build ?? rng.range(1.0, 1.15); L.height = rng.range(0.98, 1.05);
  return L;
}

// ------------------------------------------------------------------ CALLING-CARD CASUAL (hit and run)
registerEnemy('stamfordbridge_casual', {
  name: 'CALLING-CARD CASUAL', hp: 46, speed: 3.15, runSpeed: 5.6, power: 0.95, guard: 40, score: 180,
  look: rng => designerLook(rng),
  ai: { aggression: 0.62, reaction: 0.26, attacks: [['jab', 3], ['cross', 2], ['kick', 2], ['lowKick', 1]], comboLen: [1, 3], blockChance: 0.14, dodgeChance: 0.16, flank: 0.6, runChance: 0.4, keepDist: 2.4, taunt: 0.1,
    shouts: { aggro: ['HEADHUNTERS!', 'NICE OF YOU TO VISIT.', 'WRONG END OF TOWN, SON.'], taunt: ['WHO\'S YOUR TAILOR?', 'COME ON THEN!', 'YOU LOST?', 'WE\'LL SEND A CARD.'], hurt: ['MY JACKET!', 'NOT THE FACE!'] } },
  drops: [['coin', 0.5], ['cash5', 0.2], ['pint', 0.06]],
  onDeath(f, world) { spawnCallingCard(world, f.x, f.y); },
  think(f, world, dt, ai) {
    if (ai.goal || !ai.aggro) return false;
    const tg = ai.curTarget || world.player;
    if (!live(tg)) return false;
    const d = f.data;
    const dx = tg.x - f.x, dy = tg.y - f.y, dist = Math.hypot(dx, dy) || 1;
    // landed a shot? then get out (most of the time)
    const a = f.attack;
    if (a && a.phase === 2 && a.hit && a.hit.size && !a.__hr) { a.__hr = true; if (Math.random() < 0.65) d.backQ = true; }
    d.hrCd = (d.hrCd ?? 2 + Math.random() * 2) - dt;
    if (d.backT > 0) {
      d.backT -= dt;
      if (!f.canAct) return false;
      f.intent.block = false;
      f.intent.mx = -dx / dist; f.intent.my = -dy / dist;
      if (d.backT <= 0) d.comeAgain = true;
      return true;
    }
    if (d.comeAgain && f.canAct) {
      d.comeAgain = false;
      if (dist > 1.4 && dist < 5.5 && world.hasLOS(f.x, f.y, tg.x, tg.y)) {
        f.face2(dx, dy); f.intent.mx = f.intent.my = 0;
        f.intent.attackName = dist > 2.6 && Math.random() < 0.5 ? 'flyingKick' : 'stamfordbridge_dart';
        if (Math.random() < 0.4) popup(world, f, pick(['AGAIN!', 'HELLO AGAIN!', 'MISS ME?']));
        return true;
      }
    }
    if (f.canAct && (d.backQ || (d.hrCd <= 0 && dist < 1.7))) {
      d.backQ = false; d.hrCd = 3 + Math.random() * 2.5;
      d.backT = 0.6 + Math.random() * 0.5;
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ CITY BOY (suit + brolly)
registerEnemy('stamfordbridge_cityboy', {
  name: 'CITY BOY', hp: 50, speed: 2.7, runSpeed: 4.8, power: 0.95, guard: 55, score: 190, weapon: 'umbrella',
  look: rng => {
    const L = casualLook(rng, { scarf: null, hatChance: 0, maskChance: 0, hoodChance: 0, hair: ['sidepart', 'quiff', 'crop', 'balding'] });
    const suit = rng.pick(['#1a1e2a', '#2a2a30', '#3a3a44', '#22283a']);
    L.jacket = { style: 'suit', color: suit, trim: rng.pick(['#c8102e', BLUE, '#e8c040']) };
    L.shirt = rng.pick(['#f2f2ee', '#c8d8f0', '#f0e0e0']);
    L.pants = { style: 'suit', color: suit };
    L.shoes = { color: '#121214', sole: '#2a2a2a', style: 'dress' };
    L.shades = rng.chance(0.25); L.bag = false; L.gloves = null;
    L.build = rng.range(1.0, 1.2); L.height = rng.range(1.0, 1.06);
    return L;
  },
  ai: { aggression: 0.5, reaction: 0.32, attacks: [['jab', 2], ['cross', 2], ['push', 1]], comboLen: [1, 2], blockChance: 0.38, counterChance: 0.3, keepDist: 1.9, taunt: 0.12,
    shouts: { aggro: ['I\'M ON MY LUNCH HOUR.', 'RIGHT, CHAPS.', 'HEADHUNTERS!'], taunt: ['I EARN MORE THAN YOUR TOWN.', 'SELL! SELL!', 'NORTHERN, ARE WE?', 'MIND THE SUIT.'], hurt: ['THIS IS SAVILE ROW!', 'MY SHARES!'] } },
  drops: [['cash20', 0.25], ['cash5', 0.4]],
  onDeath(f, world) { if (Math.random() < 0.5) spawnCallingCard(world, f.x, f.y); },
  think(f, world, dt, ai) {
    if (ai.goal || !ai.aggro) return false;
    if (!f.weapon && f.data.armed === undefined) f.data.armed = false;
    const tg = ai.curTarget || world.player;
    if (!live(tg) || !f.canAct) return false;
    ai.pokeCd = (ai.pokeCd ?? 1.5 + Math.random() * 2) - dt;
    const dx = tg.x - f.x, dy = tg.y - f.y, dist = Math.hypot(dx, dy);
    if (ai.pokeCd <= 0 && dist > 1.2 && dist < 2.1) {
      ai.pokeCd = 3 + Math.random() * 2;
      f.face2(dx, dy); f.intent.block = false; f.intent.mx = f.intent.my = 0;
      f.intent.attackName = 'stamfordbridge_poke';
      popup(world, f, 'BROLLY!');
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ SCAFFOLDER
registerEnemy('stamfordbridge_scaffolder', {
  name: 'SCAFFOLDER', hp: 54, speed: 2.8, runSpeed: 5.0, power: 1.0, score: 180, weapon: 'stamfordbridge_pole',
  look: rng => {
    const L = casualLook(rng, { scarf: null, hatChance: 0, maskChance: 0, hoodChance: 0.1, hair: ['shaved', 'crop', 'skinhead', 'buzz'] });
    L.jacket = rng.chance(0.5) ? { style: 'hivis', color: rng.pick(['#f0a020', '#d8f020']) } : { style: 'vest', color: rng.pick(['#e8e4dc', '#3a3a3e']) };
    L.shirt = rng.pick(['#e8e4dc', '#3a3a3e', BLUE]);
    L.pants = { style: rng.pick(['cargo', 'jeans']), color: rng.pick(['#4a4a40', '#2a3346', '#6a6050']) };
    L.shoes = { color: '#6a4a2a', sole: '#2a2a2a', style: 'boot' };
    L.hat = rng.chance(0.6) ? { style: 'helmet', color: rng.pick(['#f4f4f0', '#e8c020', BLUE]) } : null;
    L.build = rng.range(1.1, 1.3); L.height = rng.range(1.0, 1.06);
    return L;
  },
  ai: { aggression: 0.55, reaction: 0.36, attacks: [['haymaker', 2], ['cross', 2], ['push', 1]], comboLen: [1, 2], blockChance: 0.1, keepDist: 2.2, taunt: 0.1,
    shouts: { aggro: ['OI! SITE\'S CLOSED!', 'HARD HAT AREA, SON!'], taunt: ['WANT A LIFT?', 'MIND YOUR HEAD!', 'TEA BREAK\'S OVER!'], hurt: ['ME BACK!', 'HEALTH AND SAFETY!'] } },
  drops: [['stamfordbridge_cuppa', 0.15], ['coin', 0.4]],
});

// ------------------------------------------------------------------ THE GAFFER (the big man to pin)
registerEnemy('stamfordbridge_gaffer', {
  name: 'THE GAFFER', hp: 150, speed: 2.2, runSpeed: 4.4, power: 1.15, weight: 2.0, superArmor: 7, guard: 60, score: 600,
  look: {
    skin: '#e8a888', hair: { style: 'balding', color: '#5a4a3a' }, facial: 'tache',
    hat: { style: 'helmet', color: '#f4f4f0' },
    jacket: { style: 'hivis', color: '#f0a020' }, shirt: '#3a5a8a',
    pants: { style: 'jeans', color: '#3a4a6a' }, shoes: { color: '#6a4a2a', sole: '#2a2a2a', style: 'boot' },
    scarf: null, build: 1.55, height: 1.18,
  },
  ai: { aggression: 0.5, reaction: 0.45, attacks: [['haymaker', 3], ['push', 2], ['bodySlam', 1]], comboLen: [1, 1], blockChance: 0.12, grabChance: 0.14, keepDist: 2.2, taunt: 0.1,
    shouts: { aggro: ['WHO LET YOU ON MY SITE?'], taunt: ['I\'VE LAID BIGGER THAN YOU.', 'COME HERE, SUNSHINE.'], hurt: ['...IS THAT IT?'] } },
  drops: [['pie', 0.6], ['cash20', 0.4]],
  think(f, world, dt, ai) {
    if (ai.goal || !ai.aggro || !f.canAct) return false;
    const tg = ai.curTarget || world.player;
    if (!live(tg)) return false;
    ai.chargeCd = (ai.chargeCd ?? 3 + Math.random() * 2) - dt;
    const dx = tg.x - f.x, dy = tg.y - f.y, dist = Math.hypot(dx, dy);
    if (ai.chargeCd <= 0 && dist > 2.4 && dist < 6.5 && world.hasLOS(f.x, f.y, tg.x, tg.y)) {
      ai.chargeCd = 6 + Math.random() * 2;
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0;
      f.intent.attackName = 'tel_charge';
      popup(world, f, 'HARD HAT CHARGE!', '#ffd23a');
      world.sfx('bossRoar', f);
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ BOSS: MONTY 'THE BROLLY' FAIRWEATHER
const PROPS_CARS = new Set(['car', 'stamfordbridge_sportscar']);
function arena(world) { return (world.level.boss && world.level.boss.lockArea) || null; }
function clampArena(world, x, y, m = 1) {
  const A = arena(world);
  if (!A) return { x, y };
  return { x: Math.max(A.x + m, Math.min(A.x + A.w - m, x)), y: Math.max(A.y + m, Math.min(A.y + A.h - m, y)) };
}
// standable, free floor (no wall, no solid prop)
function freeSpot(world, x, y) { return world.heightAt(x, y) <= 0.3 && !world.blockedAt(x, y, 0.3, 0.3, null); }
// first car prop the line boss -> target crosses
function carBetween(world, a, b) {
  for (const p of world.props) {
    if (p.removed || !PROPS_CARS.has(p.type)) continue;
    const x0 = p.x - 0.2, y0 = p.y - 0.2, x1 = p.x + p.w + 0.2, y1 = p.y + p.d + 0.2;
    for (let k = 0.1; k < 0.95; k += 0.05) {
      const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
      if (x > x0 && x < x1 && y > y0 && y < y1) return p;
    }
  }
  return null;
}
const MONTY_LOOK = {
  skin: '#ecc0a0', hair: { style: 'sidepart', color: '#2a1a12' }, facial: 'none', shades: true,
  jacket: { style: 'harrington', color: '#d8c8a0', trim: '#b8a880', lining: '#a01818' }, shirt: '#f4f4f0',
  pants: { style: 'jeans', color: '#1e2a44' }, shoes: { color: '#f4f4f0', sole: '#c8a868', style: 'trainer', stripe: BLUE },
  scarf: null, gloves: '#3a2a1a', build: 1.25, height: 1.2,
};

function surround(f, world) {
  const p = world.player;
  const alive = world.fighters.filter(e => e.team === 'enemy' && live(e) && e !== f).length;
  world.message('"SURROUND HIM, CHAPS."', 'MONTY\'S CREW SPLIT YOUR FIRM UP', 2.2, '#a8c8ff');
  world.sfx('bossRoar', f);
  f.say('CHAPS? IF YOU WOULD.', 1.6);
  const A = arena(world) || { x: p.x - 6, y: p.y - 6, w: 12, h: 12 };
  const n = Math.max(0, Math.min(3, 5 - alive));
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n)) * Math.PI * 2 + Math.random();
    let t = clampArena(world, p.x + Math.cos(ang) * 2.8, p.y + Math.sin(ang) * 2.8, 1.2);
    if (!freeSpot(world, t.x, t.y)) t = clampArena(world, p.x + Math.cos(ang) * 1.6, p.y + Math.sin(ang) * 1.6, 1.2);
    if (!freeSpot(world, t.x, t.y)) continue;
    const from = (world.level.sbCrewFrom && world.level.sbCrewFrom[i % world.level.sbCrewFrom.length]) || { x: A.x + A.w, y: A.y + A.h / 2 };
    world.spawnEnemy(i === 1 ? 'stamfordbridge_cityboy' : 'stamfordbridge_casual', t.x, t.y, { from, aggro: true });
  }
  // the barge: your lads get shoved away from you
  let split = 0;
  for (const l of (world.firm && world.firm.lads) || []) {
    if (!live(l) || l.isDown) continue;
    const dx = l.x - p.x, dy = l.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d > 4.5) continue;
    l.knockDown({ x: dx / d, y: dy / d }, 6, 2.5);
    world.fx.popup(l.x, l.y, l.z + 0.6, 'BARGED!', '#ff8a5a');
    split++;
  }
  if (world.firm) world.toast(`THEY'VE SPLIT THE FIRM! SHOUT BACK TO ME! (${input.hint('orderRegroup')})`);
  else world.toast('YOU\'RE SURROUNDED! KEEP MOVING!');
  return split;
}

registerEnemy('stamfordbridge_monty', {
  name: 'MONTY FAIRWEATHER', boss: true, hp: 640, speed: 2.95, runSpeed: 5.3, power: 1.15, weight: 1.7, superArmor: 7, guard: 85, score: 6500, ungrabbable: true,
  weapon: 'umbrella',
  look: MONTY_LOOK,
  ai: { aggression: 0.6, reaction: 0.3, attacks: [['jab', 2], ['cross', 2], ['hook', 1], ['kick', 1]], comboLen: [2, 3], blockChance: 0.3, dodgeChance: 0.12, ignoreTokens: true, keepDist: 2.3, taunt: 0.05, shouts: false },
  drops: [['kebab', 1], ['cash20', 1]],
  onSpawn(f) { f.tauntAnim = 'taunt2'; if (f.weapon) f.weapon.durability = 999; },
  onDeath(f, world) { for (let i = 0; i < 4; i++) spawnCallingCard(world, f.x + (Math.random() - 0.5) * 2, f.y + (Math.random() - 0.5) * 2); },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !p.alive) return false;
    const d = f.data;
    if (!d.init) { d.init = true; d.calls = 0; f.say('CHARMED, I\'M SURE.', 1.6); }
    const tg = (ai.curTarget && live(ai.curTarget)) ? ai.curTarget : p;
    const dx = tg.x - f.x, dy = tg.y - f.y, dist = Math.hypot(dx, dy) || 1;
    // never without his brolly
    if (!f.weapon && f.canAct) { f.weapon = { def: ITEMS.umbrella, durability: 999 }; popup(world, f, 'SPARE BROLLY.', '#d8d0b8'); }

    // ---- bonnet slide in progress: he moves himself along the path (over the car) during the active phase
    const a = f.attack;
    if (a && a.name === 'stamfordbridge_slide' && d.slide) {
      const S = d.slide;
      if (a.phase === 0) { f.face2(S.ex - S.sx, S.ey - S.sy); if (Math.random() < 0.3) world.fx.dust(f.x, f.y, 0, 1); }
      else if (a.phase === 1) {
        const k = Math.min(1, a.t / a.active);
        f.noclip = true;
        f.x = S.sx + (S.ex - S.sx) * k; f.y = S.sy + (S.ey - S.sy) * k;
        if (S.car && !S.hop) { S.hop = true; f.vz = 7.2; f.onGround = false; }   // a hop up onto the bonnet and over
        f.vx = f.vy = 0;
        if (Math.random() < 0.6) world.fx.dust(f.x, f.y, f.z, 1);
      } else { f.noclip = false; f.x = S.ex; f.y = S.ey; d.slide = null; }
      return true;
    }
    if (d.slide && !(a && a.name === 'stamfordbridge_slide')) { f.noclip = false; d.slide = null; if (f.z > 0.05) f.z = 0; }
    // ---- calling card: release on the active frame
    if (a && a.name === 'stamfordbridge_flick') {
      if (a.phase >= 1 && !a.fired) { a.fired = true; const t = d.cardTgt || tg; spawnFlickCard(world, f, t.x, t.y); }
      return false;
    }

    // ---- phase two: the jacket comes off
    if (!d.phase2 && f.hp < f.maxHp * 0.5) {
      d.phase2 = true;
      f.look = normalizeLook({ ...f.look, jacket: { style: 'shirt', color: '#f4f4f0' }, shades: false, __norm: undefined });
      f.speed *= 1.12; f.runSpeed *= 1.08;
      world.message('MONTY HANGS UP HIS JACKET', 'NOW HE\'S CROSS', 2, '#a8c8ff');
      world.sfx('bossRoar', f);
      world.fx.debris(f.x, f.y, 1.2, ['#d8c8a0', '#a01818'], 8);
    }
    // ---- SURROUND HIM: at 70% and 35%
    const want = f.hp < f.maxHp * 0.35 ? 2 : f.hp < f.maxHp * 0.7 ? 1 : 0;
    if (d.calls < want && f.canAct) {
      d.calls++;
      surround(f, world);
      f.intent.taunt = true;
      ai.spCd = 2.5;
      return true;
    }

    // ---- EN GARDE -> BROLLY FLURRY
    if (d.engarde > 0) {
      d.engarde -= dt;
      f.intent.mx = f.intent.my = 0; f.intent.block = false; f.face2(dx, dy);
      if (f.state === 'hurt' || f.isDown) { d.engarde = 0; return false; }
      if (d.engarde <= 0) d.flurry = d.phase2 ? 5 : 4;
      return true;
    }
    if (d.flurry > 0) {
      if (f.isDown) { d.flurry = 0; return false; }
      if (f.canAct) {
        d.flurry--;
        f.face2(dx, dy);
        f.intent.attackName = d.flurry === 0 ? 'stamfordbridge_lungeFinish' : 'stamfordbridge_thrust';
        if (d.flurry === 0) popup(world, f, 'TOUCHÉ!', '#ffffff');
      }
      return true;
    }

    // ---- stepping back to make room for a card or a slide
    if (d.backT > 0) {
      d.backT -= dt;
      if (!f.canAct) return false;
      f.intent.block = false; f.intent.mx = -dx / dist; f.intent.my = -dy / dist;
      if (d.backT <= 0) ai.spCd = 0;
      return true;
    }

    // ---- specials: a fixed, readable cycle  FLURRY -> CARD -> SLIDE (-> CARD again when he's cross)
    ai.spCd = (ai.spCd ?? 2.5) - dt;
    if (!f.canAct || ai.goal || ai.spCd > 0) return false;
    const fast = d.phase2;
    const cycle = fast ? ['flurry', 'card', 'slide', 'card'] : ['flurry', 'card', 'slide'];
    d.ci = (d.ci ?? 0) % cycle.length;
    const move = cycle[d.ci];
    d.waitT = (d.waitT ?? 0) + dt;
    const next = (cd) => { d.ci = (d.ci + 1) % cycle.length; d.waitT = 0; d.saidBack = false; ai.spCd = cd; };
    const backOff = () => { d.backT = 0.55; if (!d.saidBack) { d.saidBack = true; popup(world, f, 'EXCUSE ME.', '#d8d0b8'); } return true; };

    if (move === 'flurry') {
      // EN GARDE: walk in (default AI) and set himself when you're close; gives up after a while
      if (dist < 2.4) {
        next(fast ? 1.8 : 2.4);
        d.engarde = 0.45;
        popup(world, f, 'EN GARDE!', '#ffffff');
        world.sfx('whoosh', f);
        f.intent.mx = f.intent.my = 0;
        return true;
      }
      if (d.waitT > 4) next(0);
      return false;
    }
    if (move === 'card') {
      // CALLING CARD: prefers you over your lads
      const t = (Math.hypot(p.x - f.x, p.y - f.y) < 8 && world.hasLOS(f.x, f.y, p.x, p.y)) ? p : tg;
      const tdx = t.x - f.x, tdy = t.y - f.y, td = Math.hypot(tdx, tdy) || 1;
      if (td < 2.2 && d.waitT < 3) return backOff();
      if (td < 8.5 && world.hasLOS(f.x, f.y, t.x, t.y)) {
        next(fast ? 1.8 : 2.6);
        d.cardTgt = { x: t.x + (t.vx || 0) * 0.25, y: t.y + (t.vy || 0) * 0.25 };
        f.face2(tdx, tdy); f.intent.mx = f.intent.my = 0; f.intent.block = false;
        f.intent.attackName = 'stamfordbridge_flick';
        popup(world, f, 'MY CARD.', '#ffffff');
        return true;
      }
      if (d.waitT > 3) next(0);
      return false;
    }
    // SLIDE: across a car bonnet if one is in the way, otherwise a long knee slide
    if (dist < 2.6 && d.waitT < 3) return backOff();
    const car = carBetween(world, f, tg);
    // landing spot: just past you if that's clear floor, otherwise the nearest clear spot on the line
    let c = null;
    if (dist >= 2.6 && dist < 10) {
      for (const k of [0.9, 0.5, 0.1, -0.3, -0.7]) {
        let ex = tg.x + dx / dist * k, ey = tg.y + dy / dist * k;
        const len = Math.hypot(ex - f.x, ey - f.y);
        if (len > 8) { ex = f.x + (ex - f.x) * 8 / len; ey = f.y + (ey - f.y) * 8 / len; }
        const q = clampArena(world, ex, ey, 0.6);
        if (world.heightAt(q.x, q.y) <= 0.3 && !world.blockedAt(q.x, q.y, 0.3, 0.3, null)) { c = q; break; }
      }
    }
    if (c) {
      next(fast ? 2 : 2.8);
      d.slide = { sx: f.x, sy: f.y, ex: c.x, ey: c.y, car: !!car };
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0;
      f.intent.attackName = 'stamfordbridge_slide';
      world.message(car ? 'BONNET SLIDE!' : 'KNEE SLIDE!', '', 0.9, '#a8c8ff');
      world.sfx('whooshBig', f);
      return true;
    }
    if (d.waitT > 3) next(0);
    return false;
  },
});
