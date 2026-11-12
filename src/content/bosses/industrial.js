// LEVEL 6 — THE INDUSTRIAL ZONE: dock workers, welders, scaffolders, the hired nightwatchman,
// tougher Portside / Vargby lads, and the boss BIG GUNNAR, foreman of the yard, with his giant wrench.
import { registerEnemy, casualLook, RIVAL, AWAY } from '../enemies.js';
import { registerAttack } from '../../game/combat.js';
import { registerAttackPose, GUARD } from '../../game/poses.js';
import { toScreen } from '../../engine/iso.js';
import { shadow } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import '../themes/industrial.js';   // weapons / projectile items used below

const OL = '#120c14';

// ================================================================== poses
registerAttackPose('industrial_weld', {
  windup: { ...GUARD, uaN: 1.15, faN: 0.7, uaF: 0.95, faF: 1.0, lean: 0.12, head: 0.15 },
  hit: { ...GUARD, uaN: 1.5, faN: 0.15, uaF: 1.3, faF: 0.45, lean: 0.32, dx: 2, thN: 0.42, knN: 0.32, head: 0.2 },
});
registerAttackPose('industrial_slam', {
  windup: { lean: -0.3, dy: -2, uaN: 2.9, faN: 0.4, uaF: 2.9, faF: 0.4, thN: 0.1, thF: -0.1 },
  hit: { lean: 0.7, dx: 4, dy: 4, uaN: 1.2, faN: 0.2, uaF: 1.2, faF: 0.2, thN: 0.5, knN: 0.6, thF: -0.4, knF: 0.3 },
});
registerAttackPose('industrial_wrench', {
  windup: { ...GUARD, uaN: 2.8, faN: 0.8, lean: -0.25, dx: -1 },
  hit: { ...GUARD, uaN: 0.7, faN: 0.1, lean: 0.42, dx: 4, thN: 0.5, knN: 0.3 },
});
registerAttackPose('industrial_smash', {
  windup: { lean: -0.35, dy: -1, uaN: 3.1, faN: 0.3, uaF: 3.0, faF: 0.4, thN: 0.15, thF: -0.15 },
  hit: { lean: 0.8, dx: 5, dy: 6, uaN: 0.9, faN: 0.0, uaF: 1.0, faF: 0.1, thN: 0.7, knN: 1.0, thF: -0.5, knF: 0.5 },
});
registerAttackPose('industrial_spin', {
  windup: { ...GUARD, uaN: 1.6, faN: 0.2, uaF: 1.6, faF: 0.2, lean: -0.15, flip: 1 },
  hit: { ...GUARD, uaN: 1.65, faN: 0.05, uaF: 1.55, faF: 0.1, lean: 0.25, dx: 2, flip: 0 },
});
registerAttackPose('industrial_pound', {
  windup: { lean: -0.2, dy: -7, uaN: 3.0, faN: 0.4, uaF: 3.0, faF: 0.4, thN: 0.8, knN: 1.4, thF: 0.5, knF: 1.2 },
  hit: { lean: 0.6, dy: 8, uaN: 1.0, faN: 0.1, uaF: 1.0, faF: 0.1, thN: 1.0, knN: 1.8, thF: -0.2, knF: 1.4 },
});
registerAttackPose('industrial_heave', {
  windup: { lean: 0.55, dy: 5, uaN: 1.2, faN: 0.4, uaF: 1.2, faF: 0.4, thN: 0.7, knN: 1.3, thF: 0.2, knF: 1.1 },
  hit: { lean: -0.15, dx: 3, uaN: 2.4, faN: 0.1, uaF: 2.4, faF: 0.1, thN: 0.4, thF: -0.4 },
});

// ================================================================== attacks
registerAttack('industrial_weld', { pose: 'industrial_weld', startup: 0.3, active: 0.55, recovery: 0.35, dmg: 0, reach: 1.3, arc: 0.75, kb: 1, stun: 0.4, whiff: 'zap', hz: 1.3, telegraph: true });
registerAttack('industrial_dockerSlam', { pose: 'industrial_slam', startup: 0.42, active: 0.1, recovery: 0.5, dmg: 14, reach: 1.2, arc: 0.85, kb: 4.5, stun: 0.6, knockdown: true, launch: 2, lunge: 2, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.4, hitstop: 0.09, shake: 5, guardDmg: 26, telegraph: true });
registerAttack('industrial_wrenchSwing', { pose: 'industrial_wrench', startup: 0.16, npcStartup: 0.3, active: 0.1, recovery: 0.3, dmg: 15, reach: 1.55, arc: 1.0, kb: 3.6, stun: 0.5, weapon: true, sfx: 'weapon', whiff: 'whooshBig', hz: 1.5, hitstop: 0.08, shake: 4, score: 30 });
registerAttack('industrial_wrenchSmash', { pose: 'industrial_smash', startup: 0.62, active: 0.12, recovery: 0.6, dmg: 22, reach: 1.6, arc: 0.75, kb: 6, stun: 0.7, knockdown: true, launch: 3, lunge: 4.5, guardDmg: 60, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.4, hitstop: 0.12, shake: 8, telegraph: true });
registerAttack('industrial_wrenchSpin', { pose: 'industrial_spin', startup: 0.38, active: 0.45, recovery: 0.55, dmg: 16, reach: 1.65, arc: Math.PI, kb: 5, stun: 0.6, knockdown: true, launch: 2.5, lunge: 3, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.4, hitstop: 0.1, shake: 6, telegraph: true });
registerAttack('industrial_pound', { pose: 'industrial_pound', startup: 0.8, active: 0.1, recovery: 0.75, dmg: 18, reach: 1.15, arc: Math.PI, kb: 5, stun: 0.6, knockdown: true, launch: 3, sfx: 'stomp', whiff: 'whooshBig', hz: 0.6, hitstop: 0.1, shake: 9, telegraph: true });
registerAttack('industrial_heave', { pose: 'industrial_heave', startup: 0.5, active: 0.08, recovery: 0.45, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, whiff: 'throw', hz: 1, telegraph: true });

// ================================================================== shared hazards spawned by these enemies
// Expanding ground shockwave ring. Hits grounded fighters of the other team as the ring passes them.
export function spawnShockwave(world, owner, x, y, o = {}) {
  const maxR = o.maxR ?? 6.5, speed = o.speed ?? 7, dmg = o.dmg ?? 14;
  const hit = new Set([owner]);
  world.camera.shake(8, 0.35);
  world.sfx('stomp', { x, y }); world.sfx('hitHeavy', { x, y });
  world.addActor({
    x, y, r: 0.3, removed: false,
    depth: () => -1e4,
    update(w, dt) {
      this.r += speed * dt;
      if (this.r > maxR) { this.removed = true; return; }
      for (let k = 0; k < 4; k++) {
        const a = Math.random() * Math.PI * 2;
        w.fx.add({ x: x + Math.cos(a) * this.r, y: y + Math.sin(a) * this.r, z: 0.05, vz: 1 + Math.random(), life: 0.35, color: '#9a9184', kind: 'puff', size: 2 + Math.random() * 2, g: 0.2 });
      }
      for (const f of w.fighters) {
        if (hit.has(f) || !f.alive || f.team === owner.team || f.z > 0.35 || f.invuln > 0 || f.isDown) continue;
        const d = Math.hypot(f.x - x, f.y - y);
        if (Math.abs(d - this.r) > 0.45) continue;
        hit.add(f);
        const dir = { x: (f.x - x) / (d || 1), y: (f.y - y) / (d || 1) };
        const def = { hz: 0.4, sfx: 'hitHeavy', hitstop: 0.06, shake: 4 };
        const res = f.takeHit({ attacker: owner, def, dmg: dmg * (owner.power || 1), dir, kb: 5, stun: 0.6, knockdown: true, launch: 3, unblockable: true, guardDmg: 0 }, w);
        w.onHit(owner, f, def, res, dmg);
      }
    },
    draw(ctx) {
      const s = toScreen(x, y, 0);
      const rx = this.r * 22.6, ry = this.r * 11.3;   // circle of radius r in iso
      const k = 1 - this.r / maxR;
      ctx.save();
      ctx.globalAlpha = 0.85 * k + 0.15;
      ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(Math.round(s.x), Math.round(s.y), rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff6a20'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(Math.round(s.x), Math.round(s.y), Math.max(1, rx - 4), Math.max(1, ry - 2), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    },
  });
}

// Oil drum rolling along the ground; jump over it. Breaks on walls.
export function spawnRollingDrum(world, owner, x, y, dx, dy, o = {}) {
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const speed = o.speed ?? 5.2, dmg = o.dmg ?? 13;
  const hit = new Set([owner]);
  world.addActor({
    x: x + dx * 0.8, y: y + dy * 0.8, z: 0, roll: 0, dist: 0, removed: false, col: o.color || '#2a4d7a',
    depth() { return this.x + this.y; },
    update(w, dt) {
      const nx = this.x + dx * speed * dt, ny = this.y + dy * speed * dt;
      this.roll += speed * dt * 3;
      this.dist += speed * dt;
      if (w.heightAt(nx, ny) > 0.35 || this.dist > 16) { this.burst(w); return; }
      this.x = nx; this.y = ny;
      if (Math.random() < 0.3) w.fx.add({ x: this.x, y: this.y, z: 0.05, vz: 0.4, life: 0.3, color: '#7a7064', kind: 'puff', size: 2, g: 0 });
      for (const f of w.fighters) {
        if (hit.has(f) || !f.alive || f.z > 0.55 || f.invuln > 0 || f.isDown || f.boss) continue;
        if (Math.hypot(f.x - this.x, f.y - this.y) > 0.5 + f.r) continue;
        hit.add(f);
        const def = { hz: 0.5, sfx: 'hitHeavy', hitstop: 0.06, shake: 4 };
        const res = f.takeHit({ attacker: owner, def, dmg: dmg * (owner.power || 1), dir: { x: dx, y: dy }, kb: 6, stun: 0.6, knockdown: true, launch: 3.5, unblockable: false, guardDmg: 30 }, w);
        w.onHit(owner, f, def, res, dmg);
        if (f.team !== 'player' && w.player) w.addScore(150, f.x, f.y, 1, true);
      }
    },
    burst(w) {
      this.removed = true;
      w.fx.debris(this.x, this.y, 0.3, [this.col, '#1a1a1e', '#d8b020'], 12);
      w.sfx('metal', this);
    },
    draw(ctx) {
      const s = toScreen(this.x, this.y, 0);
      shadow(ctx, s.x, s.y, 9, 4, 0.35);
      ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y - 8)); ctx.rotate(this.roll);
      ctx.fillStyle = OL; ctx.fillRect(-8, -7, 16, 14);
      ctx.fillStyle = this.col; ctx.fillRect(-7, -6, 14, 12);
      ctx.fillStyle = '#1a2a4a'; ctx.fillRect(-7, -3, 14, 1); ctx.fillRect(-7, 2, 14, 1);
      ctx.fillStyle = '#d8b020'; ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    },
  });
}

// ================================================================== looks
const DOCK_PALS = ['#22242a', '#1d2742', '#3a2e22'];
function dockerLook(rng) {
  return {
    skin: rng.pick(['#e2a97a', '#d49a6a', '#b87a50', '#f0c098']),
    hair: { style: rng.pick(['shaved', 'skinhead', 'crop']), color: rng.pick(['#141016', '#3a2717', '#5a5a5a']) },
    facial: rng.pick(['beard', 'stubble', 'tache']),
    hat: rng.chance(0.7) ? { style: 'beanie', color: rng.pick(['#1d2742', '#3a3a3e', '#6a2020']), trim: '#2a2a30' } : null,
    jacket: { style: 'parka', color: rng.pick(DOCK_PALS), trim: '#d8b020' },
    shirt: rng.pick(['#6a4a3a', '#3a3a3a', RIVAL.a]),
    pants: { style: 'cargo', color: rng.pick(['#3a3a30', '#2a3040', '#4a4030']) },
    shoes: { color: '#3a2a1a', sole: '#1a1a1a' },
    gloves: '#7a5a3a',
    scarf: rng.chance(0.4) ? { a: RIVAL.a, b: RIVAL.b } : null,
    build: rng.range(1.4, 1.55), height: rng.range(1.08, 1.14),
  };
}
function welderLook(rng) {
  return {
    skin: rng.pick(['#e2a97a', '#d49a6a', '#8a5636']),
    hair: { style: 'crop', color: '#141016' }, facial: rng.pick(['stubble', 'none', 'beard']),
    hat: { style: 'helmet', color: rng.pick(['#2a2a2e', '#3a3e46']) }, shades: true,
    jacket: { style: 'leather', color: rng.pick(['#6a4424', '#5a3a1e']), trim: '#3a2410' },
    shirt: '#3a3a3a',
    pants: { style: 'cargo', color: '#2a3040' },
    shoes: { color: '#2a2018', sole: '#121212' }, gloves: '#4a3020',
    scarf: null, build: rng.range(1.05, 1.15), height: rng.range(0.98, 1.04),
  };
}
function scafferLook(rng) {
  return {
    ...casualLook(rng, { a: RIVAL.a, b: RIVAL.b, scarf: null }),
    hat: { style: 'helmet', color: rng.pick(['#f4f1e8', '#e8c020', '#1f4fb4']) },
    jacket: { style: 'hivis', color: rng.pick(['#d8f020', '#ff8a1a']) },
    shirt: rng.pick([RIVAL.a, '#3a3a3a']),
    pants: { style: 'trackies', color: '#1e1e26', trim: RIVAL.b },
    shoes: { color: '#3a2a1a', sole: '#1a1a1a' },
  };
}

// ================================================================== the yard roster
registerEnemy('industrial_dockLad', {
  name: 'PORTSIDE DOCK LAD', hp: 46, speed: 2.7, runSpeed: 5.0, power: 0.95, score: 160, guard: 30,
  look: rng => {
    const L = casualLook(rng, { a: RIVAL.a, b: RIVAL.b, hair: ['crop', 'shaved', 'skinhead', 'curtains'] });
    if (rng.chance(0.4)) L.jacket = { style: 'hivis', color: '#ff8a1a' };
    if (rng.chance(0.35)) L.hat = { style: 'beanie', color: RIVAL.a, trim: RIVAL.b };
    return L;
  },
  ai: { aggression: 0.6, reaction: 0.3, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.14, dodgeChance: 0.05, runChance: 0.35, useWeapons: true, keepDist: 2.2 },
  drops: [['coin', 0.5], ['cash5', 0.12], ['industrial_tea', 0.07]],
});
registerEnemy('industrial_steeltoe', {
  name: 'VARGBY STEEL TOE', hp: 52, speed: 3.0, runSpeed: 5.4, power: 1.05, score: 190, guard: 34,
  look: rng => { const L = casualLook(rng, { a: AWAY.a, b: AWAY.b, hair: ['skinhead', 'shaved', 'crop'] }); L.shoes = { color: '#2a1a10', sole: '#d8b020' }; L.pants = { style: 'jeans', color: '#2a3a5a' }; return L; },
  ai: { aggression: 0.72, reaction: 0.26, attacks: [['kick', 3], ['lowKick', 2], ['roundhouse', 1], ['jab', 2]], comboLen: [1, 3], blockChance: 0.08, dodgeChance: 0.1, runChance: 0.45, keepDist: 2.0 },
  drops: [['coin', 0.5], ['cash5', 0.15], ['pie', 0.08]],
});
registerEnemy('industrial_watchman', {
  name: 'BENT NIGHTWATCHMAN', hp: 62, speed: 2.4, power: 1.0, guard: 55, score: 220, weapon: 'industrial_torch',
  look: rng => ({ ...casualLook(rng, { scarf: null, hatChance: 0 }), hat: { style: 'cap', color: '#1a1a22' }, facial: 'tache', jacket: { style: 'bomber', color: '#1a1a22', trim: '#0e0e14', lining: '#d8f020' }, shirt: '#c8ccd8', pants: { style: 'suit', color: '#1a1a22' }, shoes: { color: '#121214', sole: '#222' }, build: 1.3, height: 1.02 }),
  ai: { aggression: 0.5, reaction: 0.34, attacks: [['push', 3], ['jab', 2], ['haymaker', 1]], blockChance: 0.35, grabChance: 0.12, keepDist: 2.2 },
  drops: [['industrial_tea', 0.4], ['cash5', 0.4]],
});
registerEnemy('industrial_docker', {
  name: 'DOCKER', hp: 80, speed: 2.15, runSpeed: 4.2, power: 1.2, weight: 1.7, superArmor: 6, guard: 50, score: 300,
  look: dockerLook,
  ai: { aggression: 0.5, reaction: 0.45, attacks: [['haymaker', 3], ['push', 2], ['industrial_dockerSlam', 2]], comboLen: [1, 1], blockChance: 0.18, grabChance: 0.12, throwChance: 0.22, projectile: 'industrial_crate', keepDist: 2.6 },
  drops: [['pie', 0.25], ['cash5', 0.25], ['industrial_crate', 0.15]],
});
registerEnemy('industrial_scaffer', {
  name: 'SCAFFOLDER', hp: 48, speed: 2.9, runSpeed: 5.2, power: 1.0, score: 200, weapon: 'industrial_pole',
  look: scafferLook,
  ai: { aggression: 0.62, reaction: 0.3, attacks: [['jab', 2], ['kick', 2], ['cross', 1]], comboLen: [1, 2], blockChance: 0.1, dodgeChance: 0.12, useWeapons: true, runChance: 0.4, keepDist: 2.5 },
  drops: [['coin', 0.5], ['cash5', 0.15]],
});

// WELDER: closes in, then sprays a short cone of sparks that ticks damage several times (hold block or get out).
const WELD_HIT = { hz: 1.3, sfx: 'zap', hitstop: 0.025, shake: 1, score: 0 };
registerEnemy('industrial_welder', {
  name: 'WELDER', hp: 54, speed: 2.6, runSpeed: 4.8, power: 1.0, score: 240, guard: 40,
  look: welderLook,
  ai: { aggression: 0.55, reaction: 0.34, attacks: [['industrial_weld', 4], ['jab', 1], ['kick', 1]], comboLen: [1, 1], blockChance: 0.12, dodgeChance: 0.08, keepDist: 2.6, approachRange: 1.15 },
  drops: [['coin', 0.5], ['industrial_spanner', 0.2], ['cash5', 0.15]],
  think(f, world, dt) {
    const a = f.attack;
    if (f.state !== 'attack' || !a || a.name !== 'industrial_weld') { f.data.torchT = (f.data.torchT || 0) + dt; return false; }
    if (a.phase !== 1) return false;
    const hx = f.x + f.fx * 0.75, hy = f.y + f.fy * 0.75, hz = f.z + 1.3;
    for (let k = 0; k < 3; k++) {
      const s = 2 + Math.random() * 3, ang = Math.atan2(f.fy, f.fx) + (Math.random() - 0.5) * 1.3;
      world.fx.add({ x: hx, y: hy, z: hz, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, vz: (Math.random() - 0.2) * 3, life: 0.25 + Math.random() * 0.2, color: Math.random() < 0.5 ? '#fff6a0' : (Math.random() < 0.5 ? '#ffb030' : '#a8e0ff'), g: 0.6, size: Math.random() < 0.25 ? 2 : 1 });
    }
    if (Math.random() < 0.5) world.fx.add({ x: hx, y: hy, z: hz, kind: 'flash', life: 0.05, size: 5, color: '#e8f4ff', g: 0 });
    (world.lightsDynamic ||= []).push({ x: hx, y: hy, z: 1.2, r: 2.6, color: '#a8d8ff', intensity: 0.75 + Math.random() * 0.2 });
    a.tickT = (a.tickT ?? 0.05) - dt;
    if (a.tickT <= 0) {
      a.tickT = 0.17;
      a.ticks = (a.ticks || 0) + 1;
      const cosArc = Math.cos(0.8);
      for (const t of world.fighters) {
        if (t === f || t.team === f.team || !t.alive || t.isDown || t.invuln > 0 || Math.abs(t.z - f.z) > 1) continue;
        const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
        if (d > 1.3 + t.r || (d > 0.1 && (dx * f.fx + dy * f.fy) / d < cosArc)) continue;
        const dmg = 4 * f.power;
        const res = t.takeHit({ attacker: f, def: WELD_HIT, name: 'industrial_weld', dmg, dir: { x: f.fx, y: f.fy }, kb: 1.2, stun: 0.35, knockdown: a.ticks >= 3, launch: 1.5, guardDmg: 7 }, world);
        world.onHit(f, t, WELD_HIT, res, dmg);
        world.fx.spark(t.x, t.y, t.z + 1.2, '#ffd23a', 5);
      }
    }
    return false;
  },
});

// ================================================================== BOSS: BIG GUNNAR, FOREMAN OF THE YARD
function bossIssue(f, world, ai, name, msg, color) {
  const p = world.player;
  f.face2(p.x - f.x, p.y - f.y);
  f.intent.attackName = name;
  f.intent.mx = f.intent.my = 0;
  ai.combo = 0;
  if (msg) world.message(msg, '', 1.1, color || '#ffb030');
  world.sfx('bossRoar', f);
  f.data.tell = 0.8;
}

registerEnemy('industrial_gunnar', {
  name: 'BIG GUNNAR', boss: true, hp: 560, speed: 2.25, runSpeed: 4.3, power: 1.2, weight: 2.6, superArmor: 8, guard: 90, score: 6000, ungrabbable: true,
  weapon: 'industrial_wrench',
  look: {
    skin: '#e8b090', hair: { style: 'shaved', color: '#b4521c' }, facial: 'beard',
    hat: { style: 'helmet', color: '#e87020' },
    jacket: { style: 'hivis', color: '#ff7a1a' }, shirt: '#1d2a44',
    pants: { style: 'cargo', color: '#1d2a44' }, shoes: { color: '#3a2a1a', sole: '#141414' },
    gloves: '#d8b040', scarf: { a: RIVAL.a, b: RIVAL.b }, build: 1.6, height: 1.36,
  },
  ai: { aggression: 0.5, reaction: 0.4, attacks: [['haymaker', 2], ['push', 1]], comboLen: [1, 2], blockChance: 0.15, ignoreTokens: true, keepDist: 2.8 },
  drops: [['kebab', 1]],
  onSpawn(f) { if (f.weapon) f.weapon.durability = 99999; },
  onDeath(f, world) {
    // the dropped wrench becomes a (finite) player weapon
    for (const it of world.items) if (it.type === 'industrial_wrench' && Math.hypot(it.x - f.x, it.y - f.y) < 2) it.durability = 12;
  },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p) return false;
    const B = ai.B || (ai.B = { pound: 3.5, barrel: 5.5, smash: 2.5, spin: 4, ring2: 0 });
    if (f.data.tell > 0) f.data.tell -= dt;
    if (f.weapon) f.weapon.durability = 99999;

    // specials in progress: fire their effects at the impact frame
    if (f.state === 'attack' && f.attack) {
      const a = f.attack;
      if (a.name === 'industrial_pound' && a.phase >= 1 && !a.fired) {
        a.fired = true;
        spawnShockwave(world, f, f.x, f.y, { maxR: B.enraged ? 7.5 : 6, speed: 7, dmg: 13 });
        if (B.enraged) B.ring2 = 0.5;
      }
      if (a.name === 'industrial_heave' && a.phase >= 1 && !a.fired) {
        a.fired = true;
        const base = Math.atan2(p.y - f.y, p.x - f.x);
        const spread = B.enraged ? [-0.42, 0, 0.42] : [0];
        for (const s of spread) spawnRollingDrum(world, f, f.x, f.y, Math.cos(base + s), Math.sin(base + s), { speed: B.enraged ? 6 : 5.2, color: ['#2a4d7a', '#8a3324', '#3c6a3c'][Math.floor(Math.random() * 3)] });
      }
      if (a.name === 'industrial_wrenchSmash' && a.phase >= 1 && !a.fired) { a.fired = true; world.fx.dust(f.x + f.fx * 1.3, f.y + f.fy * 1.3, 0, 10); world.camera.shake(5, 0.2); }
      return false;
    }
    if (B.ring2 > 0) { B.ring2 -= dt; if (B.ring2 <= 0) spawnShockwave(world, f, f.x, f.y, { maxR: 7.5, speed: 5.5, dmg: 11 }); }

    for (const k of ['pound', 'barrel', 'smash', 'spin']) B[k] -= dt;

    // phase 2
    if (!B.enraged && f.hp < f.maxHp * 0.45) {
      B.enraged = true;
      f.speed *= 1.2; f.runSpeed *= 1.15;
      ai.ai.aggression = 0.7; ai.ai.reaction = 0.3;
      world.ventRate = 0.6;
      world.message('GUNNAR HAS LOST HIS RAG!', 'NO MORE MR NICE FOREMAN', 2.2, '#ff4a3a');
      world.sfx('bossRoar', f);
      world.camera.shake(6, 0.4);
      const L = world.level;
      if (L && L.onBossEnrage) L.onBossEnrage(world, f);
      B.pound = 1.2; B.barrel = 3;
      return true;
    }
    if (!f.canAct || f.state === 'block') return false;
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    const los = world.hasLOS(f.x, f.y, p.x, p.y);
    if (!p.alive) return false;

    if (B.pound <= 0 && d < 4.2) {
      B.pound = B.enraged ? 5.5 : 8.5;
      bossIssue(f, world, ai, 'industrial_pound', 'GROUND POUND! JUMP!', '#ffd23a');
      return true;
    }
    if (B.barrel <= 0 && d > 2.8 && d < 11 && los) {
      B.barrel = B.enraged ? 5 : 7.5;
      bossIssue(f, world, ai, 'industrial_heave', B.enraged ? 'DRUMS! LOTS OF DRUMS!' : 'ROLLING DRUM!', '#7ac8ff');
      return true;
    }
    if (B.enraged && B.spin <= 0 && d < 2.0) {
      B.spin = 3.8;
      bossIssue(f, world, ai, 'industrial_wrenchSpin', null);
      return true;
    }
    if (B.smash <= 0 && d > 1.5 && d < 3.4 && los) {
      B.smash = B.enraged ? 3 : 4.5;
      bossIssue(f, world, ai, 'industrial_wrenchSmash', null);
      return true;
    }
    return false;
  },
});

// Telegraph marker for this level's bosses/specials (called from the level's drawOverlay).
export function drawIndustrialTells(ctx, world) {
  for (const f of world.fighters) {
    if (!f.alive || f.state !== 'attack' || !f.attack || f.attack.phase !== 0 || f.team === 'player') continue;
    const n = f.attack.name;
    if (n === 'industrial_pound') {
      const s = toScreen(f.x, f.y, 0);
      const r = (f.attack.t * 5) % 1;
      ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ff3a20'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(Math.round(s.x), Math.round(s.y), 30 + r * 40, 15 + r * 20, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (n === 'industrial_pound' || n === 'industrial_heave' || n === 'industrial_wrenchSmash' || n === 'industrial_wrenchSpin' || n === 'industrial_dockerSlam' || n === 'industrial_weld') {
      const sc = f.look.height || 1;
      const s = toScreen(f.x, f.y, f.z);
      if (Math.floor(world.time * 10) % 2) drawText(ctx, '!', s.x, s.y - 58 * sc, { color: f.boss ? '#ff3a20' : '#ffd23a', align: 'center', outline: OL });
    }
  }
}
