// BIG AL — six foot six of elbows, and the shirt comes off.
//
// SHIRT ON:  careful (normal stats), long reach, THE STEPLADDER front kick keeps men at a distance.
// SHIRT OFF: he rips the checked casual shirt over his head, twirls it like a helicopter (hits everyone round him), and
//            flings it into a man's face (blinded for a couple of seconds). Then: the reveal. A pale, skinny torso. Men
//            nearby freeze in horror ("PUT IT AWAY, AL!"), the lads go "AL! AL! AL!" (nerve). Bare-chested he hits
//            harder and moves quicker but takes more damage. The shirt lies where it landed: USE next to it to button it
//            back up (slow, a bit exposed).
// Triggers: USE (E) with nothing else to use, a 5-hit combo, or getting up after a knockdown ("RIGHT. THAT'S IT.").
// As a lad: when the firm sings up, when his nerve is sky high, or when he's hurt. He gets dressed after each fight.
//
// Wiring (generic hooks): ATTACKS.al_strip.onPhase (world.update), f.onTick / f.onUse (world.update / playerUse),
// ITEMS.alshirt.onHitFighter / onLand (items.js Projectile). setupStrip(f, world?) is called for characters with strip:true.
import { registerAttack, ATTACKS } from './combat.js';
import { registerItem } from './items.js';
import { registerAttackPose, ATTACK_POSES } from './poses.js';
import { input } from '../engine/input.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const HORROR = ['PUT IT AWAY, AL!', 'MY EYES!', 'GET DRESSED!', 'IS HE ILL?', 'CHRIST ON A BIKE!', 'NOBODY NEEDS TO SEE THAT!'];
const CHEER = ['AL! AL! AL!', 'GET IN, AL!', 'TOPS OFF!', 'GO ON, AL!'];
const OFF_LINES = ['RIGHT. TOP OFF.', 'TOP\'S COMING OFF!', 'HOLD MY SHIRT!'];
const ON_LINES = ['RIGHT, THAT\'S BETTER.', 'BIT NIPPY, THAT.', 'NOBODY SAW THAT.'];
const BUFF = { power: 1.2, defense: 1.2, speed: 1.08 };    // bare-chested: hits harder, moves quicker, takes more

// ---- the strip: pull it over the head (startup), helicopter twirl (active: hits all round), fling it (recovery)
registerAttack('al_strip', {
  pose: 'al_strip', startup: 0.32, active: 0.4, recovery: 0.32, dmg: 6, reach: 1.55, arc: Math.PI, kb: 2.6, stun: 0.45,
  sfx: 'punch', whiff: 'whooshBig', hz: 1.6, hitstop: 0.04, shake: 1, score: 30, juggle: false,
  onPhase(f, world, phase) {
    if (phase === 1) shirtOff(f, world);
    else if (phase === 2) flingShirt(f, world);
  },
});
// THE STEPLADDER: a long straight front kick from a long straight man
registerAttack('al_stepladder', {
  pose: 'kick', startup: 0.1, npcStartup: 0.22, active: 0.09, recovery: 0.2, dmg: 8, reach: 1.6, arc: 0.5, kb: 3.6, stun: 0.38,
  sfx: 'kick', whiff: 'whoosh', hz: 1.2, hitstop: 0.05, score: 20, guardDmg: 12, next: { kick: 'roundhouse', punchL: 'jab', punchR: 'cross' },
});
if (!ATTACK_POSES.al_strip) registerAttackPose('al_strip', {
  windup: { lean: -0.15, uaN: 2.9, faN: 1.6, uaF: 2.8, faF: 1.6, head: 0.15 },
  hit: { lean: -0.1, uaN: 3.1, faN: 0.3, uaF: 1.2, faF: 1.4, head: -0.15, rot: 0.3 },
  follow: { lean: 0.35, dx: 2, uaN: 1.5, faN: 0.1, uaF: 0.8, faF: 1.2 },
});

// ---- the shirt as a thrown thing and as a thing on the floor
const SHIRT = { base: '#cdb58c', dark: '#2a2420', red: '#a3202a' };
function drawShirt(ctx, x, y, s = 1, crumpled = false) {
  const w = 12 * s, h = (crumpled ? 6 : 9) * s;
  ctx.fillStyle = '#120c14'; ctx.fillRect(x - w / 2 - 1, y - h - 1, w + 2, h + 2);
  ctx.fillStyle = SHIRT.base; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = SHIRT.dark;
  for (let i = 1; i < 4; i++) { ctx.fillRect(x - w / 2 + i * w / 4, y - h, 1, h); ctx.fillRect(x - w / 2, y - h + i * h / 4, w, 1); }
  ctx.fillStyle = SHIRT.red; ctx.fillRect(x - w / 2, y - h / 2, w, 1); ctx.fillRect(x, y - h, 1, h);
}
registerItem('alshirt', {
  name: 'AL\'S SHIRT', kind: 'alshirt', score: 0, noUse: true,
  icon(ctx, x, y) { drawShirt(ctx, x, y - 2, 1, true); },
  drawHeld(ctx, hx, hy, ang) { drawShirt(ctx, hx + Math.sin(ang) * 3, hy + Math.cos(ang) * 2, 1, false); },
  // flung into a man's face: he's blind for a bit, then the shirt drops at his feet
  onHitFighter(pr, f, world) {
    if (!f.boss && f.state !== 'down' && f.state !== 'knockdown') {
      f.attack = null; f.setState('dizzy'); f.stunT = 2.2; f.vx = f.vy = 0;
      f.say && f.say('I CAN\'T SEE!', 1.4);
      world.fx && world.fx.popup(f.x, f.y, f.z + 1.8, 'BLINDED!', '#ffe14a');
    }
    dropShirt(world, f.x, f.y, pr.owner);
  },
  onLand(pr, world) { dropShirt(world, pr.x, pr.y, pr.owner); },
});
function dropShirt(world, x, y, owner) {
  const it = world.spawnItem('alshirt', x, y, 0, { pickDelay: 0.4 });
  it.owner = owner;
  if (owner) owner.shirtItem = it;
}

// ---- state changes
export function bareLook(look) {
  // 3D: the l_bare model (char_v2.py torso 'bare': a pale, skinny torso, collarbones and all); colours = his skin in case
  // a fallback model (2D, or no l_bare) draws a top
  const skin = look.skin || '#f2d6c4';
  return { ...look, jacket: { style: 'bare', color: skin, trim: skin, lining: skin }, shirt: skin, scarf: null };
}
export function setupStrip(f) {
  f.strip = true;
  f.shirtOff = false;
  f.lookOn = f.look; f.lookOff = bareLook(f.look);
  f.stripBase = { power: f.power, defense: f.defense, speed: f.speed, runSpeed: f.runSpeed };
  f.onTick = tickStrip;
  if (f.isPlayer) f.onUse = useStrip;
}
function applyStats(f, off) {
  const b = f.stripBase;
  f.power = b.power * (off ? BUFF.power : 1); f.defense = b.defense * (off ? BUFF.defense : 1);
  f.speed = b.speed * (off ? BUFF.speed : 1); f.runSpeed = b.runSpeed * (off ? BUFF.speed : 1);
}
export function shirtOff(f, world) {
  if (f.shirtOff) return;
  f.shirtOff = true; f.look = f.lookOff; applyStats(f, true);
  f.say && f.say(pick(OFF_LINES), 1.2);
  world.fx && world.fx.popup(f.x, f.y, f.z + 2.2, 'SHIRT OFF!', '#ffd0b0');
  world.sfx && world.sfx('combo', f);
  if (world.camera && world.camera.kick) world.camera.kick(0, 1);
  // the reveal: the other lot freeze in horror, our lot lose their minds
  let horrified = 0;
  for (const e of world.fighters) {
    if (!e.alive || e.removed || e.team === f.team || e.boss || e.dying) continue;
    if (Math.hypot(e.x - f.x, e.y - f.y) > 4.5 || e.state === 'down' || e.state === 'knockdown' || e.state === 'grabbed' || e.state === 'thrown') continue;
    e.attack = null; e.setState('dizzy'); e.stunT = 0.9 + Math.random() * 0.4;
    if (horrified++ < 2 && e.say) e.say(pick(HORROR), 1.4);
  }
  if (world.firm) {
    for (const l of world.firm.active) {
      if (l === f || Math.hypot(l.x - f.x, l.y - f.y) > 9) continue;
      l.nerve = Math.min(100, (l.nerve ?? 100) + 15);
      world.firm.bark(l, CHEER, { force: true, cd: 3 });
    }
  }
}
function flingShirt(f, world) {
  // at the nearest man in front, or just forward
  let tgt = null, bd = 6;
  for (const e of world.fighters) {
    if (!e.alive || e.removed || e.team === f.team || e.dying) continue;
    const dx = e.x - f.x, dy = e.y - f.y, d = Math.hypot(dx, dy);
    if (d < bd && (dx * f.fx + dy * f.fy) / (d || 1) > 0.2) { bd = d; tgt = e; }
  }
  const tx = tgt ? tgt.x : f.x + f.fx * 3, ty = tgt ? tgt.y : f.y + f.fy * 3;
  if (f.shirtItem && !f.shirtItem.removed) f.shirtItem.removed = true;
  world.spawnProjectile(f, 'alshirt', tx, ty, 0);
}
export function shirtOn(f, world, instant = false) {
  if (!f.shirtOff) return;
  f.shirtOff = false; f.look = f.lookOn; applyStats(f, false);
  if (f.shirtItem) { f.shirtItem.removed = true; f.shirtItem = null; }
  if (!instant) { f.say && f.say(pick(ON_LINES), 1.3); world.sfx && world.sfx('pickup', f); }
}
// can he take it off right now?
export function canStrip(f) { return f.strip && !f.shirtOff && f.canAct && f.alive && !f.grabbing && !f.weapon; }
export function startStrip(f, world) { if (!canStrip(f)) return false; f.startAttack('al_strip', world); return true; }

// per frame (world.update): auto triggers + the first-time hint
function tickStrip(world, dt) {
  const f = this;
  if (!f.alive) return;
  if (f.isPlayer && !f.stripHinted) { f.stripHinted = true; setTimeout(() => world.toast && world.toast(`BIG AL: ${input.hint('use')} = TOP OFF!  (${input.hint('use')} BY THE SHIRT = PUT IT BACK ON)`), 2500); }
  // knocked down with the shirt on: he gets up angry
  if (f.state === 'down' || f.state === 'knockdown') f.stripAngry = true;
  if (f.stripAngry && f.canAct && f.combat) { f.stripAngry = false; if (!f.shirtOff && startStrip(f, world)) f.say && f.say('RIGHT. THAT\'S IT.', 1.2); }
  if (f.canAct && !f.combat) f.stripAngry = false;
  // a proper combo gets him going
  if (f.isPlayer && !f.shirtOff && world.combo && world.combo.count >= 5) startStrip(f, world);
}
// USE (player): next to the shirt = put it back on; nothing else to use = take it off
function useStrip(world, when) {
  const f = this;
  if (when === 'first') {
    const it = f.shirtItem;
    if (f.shirtOff && it && !it.removed && it.pickDelay <= 0 && Math.hypot(it.x - f.x, it.y - f.y) < 1.2 && f.canAct) {
      f.setState('pickup'); f.vx = f.vy = 0; f.actionDur = 1.0;   // (a hit cancels it; the shirt stays on the floor)
      f.onAction = () => shirtOn(f, world);
      return true;
    }
    return false;
  }
  if (when === 'last' && !f.shirtOff) return startStrip(f, world);
  return false;
}
export { ATTACKS };
