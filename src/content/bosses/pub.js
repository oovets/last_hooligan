// LEVEL 2 — THE PUB: new enemies, attacks, poses and the boss (RON, THE GUV'NOR). Every id starts with 'pub_'.
//
//   pub_lad    PORTSIDE BOOZER  tougher Portside lad; grabs chairs/glasses, sometimes walks in with a pint glass.
//   pub_darts  OCHE WARRIOR     darts player: keeps his distance, backs off when you close in, throws darts in volleys of three.
//   pub_drunk  PUB DRUNK        staggering regular: wobbly walk, HIC! pauses, sudden unpredictable lurches; soaks up punishment.
//   pub_ron    RON (boss)       the landlord. Starts behind the counter lobbing pint glasses; vaults the bar when he's had
//                               enough; BELLY BARGE (telegraphed charge), LAST ORDERS bell (summons regulars),
//                               phase 2 "LOCK-IN!" under 40% HP: string vest, faster, darker, triple glass volleys.

import { registerEnemy, casualLook, RIVAL, RIVAL_KIT } from '../enemies.js';
import { registerAttack } from '../../game/combat.js';
import { registerAttackPose, registerAnim, GUARD, STAND } from '../../game/poses.js';
import { normalizeLook } from '../../game/doll.js';
import { ITEMS } from '../../game/items.js';
import { STEP_UP } from '../../engine/constants.js';

// ======================================================================= attacks
registerAttack('pub_lurch', { pose: 'pub_lurch', startup: 0.38, active: 0.22, recovery: 0.55, dmg: 9, reach: 1.0, arc: 1.0, kb: 4, stun: 0.5, knockdown: true, launch: 2, lunge: 5.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.3, hitstop: 0.07, shake: 3, score: 0 });
registerAttack('pub_belly', { pose: 'pub_belly', startup: 0.62, active: 0.45, recovery: 0.6, dmg: 15, reach: 1.1, arc: 1.0, kb: 6.5, stun: 0.6, knockdown: true, launch: 3, lunge: 8, guardDmg: 45, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.1, hitstop: 0.1, shake: 7, score: 0 });
registerAttack('pub_glassThrow', { pose: 'throwItem', startup: 0.38, active: 0.06, recovery: 0.32, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, spawnProjectile: true, whiff: 'whoosh' });
registerAttack('pub_dartThrow', { pose: 'pub_dart', startup: 0.22, active: 0.05, recovery: 0.22, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, spawnProjectile: true, whiff: 'whooshLight' });
registerAttack('pub_backhand', { pose: 'pub_backhand', startup: 0.2, active: 0.08, recovery: 0.3, dmg: 9, reach: 1.15, arc: 1.2, kb: 3.5, stun: 0.45, sfx: 'slap', whiff: 'whoosh', hz: 1.6, hitstop: 0.06, shake: 2, score: 0 });

// ======================================================================= poses & anims
registerAttackPose('pub_lurch', {
  windup: { lean: -0.25, head: -0.35, dx: -2, thN: 0.2, knN: 0.4, thF: -0.2, knF: 0.3, uaN: 2.3, faN: 0.5, uaF: -0.4, faF: 0.6 },
  hit: { lean: 0.75, head: 0.2, dx: 5, dy: 3, thN: 0.7, knN: 0.3, thF: -0.6, knF: 0.5, uaN: 1.5, faN: 0.1, uaF: 1.7, faF: 0.2 },
});
registerAttackPose('pub_belly', {
  windup: { lean: -0.4, head: 0.15, dx: -3, dy: 1, thN: 0.2, knN: 0.5, thF: -0.4, knF: 0.4, uaN: -0.7, faN: 0.6, uaF: -0.6, faF: 0.7 },
  hit: { lean: -0.2, head: 0.1, dx: 7, dy: 0, thN: 0.6, knN: 0.2, thF: -0.6, knF: 0.3, uaN: -0.9, faN: 0.3, uaF: -0.8, faF: 0.4 },
});
registerAttackPose('pub_dart', {
  windup: { ...STAND, lean: -0.05, uaN: 1.9, faN: 2.5, uaF: 0.2, faF: 0.6, head: 0.05 },
  hit: { ...STAND, lean: 0.15, dx: 1, uaN: 1.55, faN: 0.15, uaF: 0.2, faF: 0.6 },
});
registerAttackPose('pub_backhand', {
  windup: { ...GUARD, uaN: 1.2, faN: 2.2, lean: -0.15, dx: -1 },
  hit: { ...GUARD, uaN: 1.4, faN: 0.1, lean: 0.25, dx: 2, thN: 0.4 },
});
registerAnim('pub_ring', { loop: true, frames: [[0.09, { ...STAND, uaN: 2.9, faN: 0.2, uaF: 0.3, faF: 0.5, head: -0.2 }], [0.09, { ...STAND, uaN: 2.6, faN: 0.9, uaF: 0.3, faF: 0.5, head: -0.2 }]] });
registerAnim('pub_dance', {
  loop: true, frames: [
    [0.18, { ...STAND, dx: -2, dy: 1, thN: 0.3, knN: 0.6, uaN: 2.6, faN: 0.6, uaF: 0.6, faF: 1.6, head: -0.15 }],
    [0.18, { ...STAND, dx: 0, dy: -1, uaN: 1.4, faN: 1.6, uaF: 1.4, faF: 1.6 }],
    [0.18, { ...STAND, dx: 2, dy: 1, thF: 0.3, knF: 0.6, uaN: 0.6, faN: 1.6, uaF: 2.6, faF: 0.6, head: 0.15 }],
    [0.18, { ...STAND, dx: 0, dy: -1, uaN: 2.8, faN: 0.3, uaF: 2.8, faF: 0.3 }],
  ],
});
registerAnim('pub_stagger', {
  loop: true, frames: [
    [0.3, { ...STAND, lean: -0.15, head: -0.45, dx: -2, thN: 0.25, knN: 0.3, thF: -0.2, knF: 0.4, uaN: 0.6, faN: 0.3, uaF: -0.3, faF: 0.2 }],
    [0.35, { ...STAND, lean: 0.2, head: 0.4, dx: 2, thN: -0.1, knN: 0.5, thF: 0.2, knF: 0.2, uaN: -0.4, faN: 0.2, uaF: 0.7, faF: 0.4 }],
  ],
});

// ======================================================================= helpers
const PORTSIDE = RIVAL_KIT;   // live: the rival club's colours at spawn time
function clearShot(world, x0, y0, x1, y1, maxH = 1.3) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.3);
  for (let i = 1; i < n; i++) { const t = i / n; if (world.heightAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) > maxH) return false; }
  return true;
}
// push a fighter out of a solid tile it ended up inside (after a noclip vault)
function unstick(f, world) {
  if (world.heightAt(f.x, f.y) <= f.z + STEP_UP) return;
  let best = null, bd = 1e9;
  for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
    const x = Math.floor(f.x) + ox + 0.5, y = Math.floor(f.y) + oy + 0.5;
    if (world.heightAt(x, y) > STEP_UP) continue;
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  if (best) { f.x = best.x; f.y = best.y; f.z = 0; }
}

// ======================================================================= PORTSIDE BOOZER
registerEnemy('pub_lad', {
  name: 'PORTSIDE BOOZER', hp: 44, speed: 2.6, runSpeed: 4.8, power: 0.95, score: 130, guard: 30,
  look: rng => casualLook(rng, { ...PORTSIDE, hatChance: 0.25, build: rng.range(1.05, 1.3) }),
  ai: { aggression: 0.55, reaction: 0.34, attacks: [['jab', 3], ['cross', 2], ['kick', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.12, dodgeChance: 0.04, grabChance: 0.05, useWeapons: true, keepDist: 2.2, runChance: 0.3 },
  drops: [['coin', 0.5], ['pint', 0.1], ['pub_crisps', 0.08]],
  onSpawn(f) { if (!f.weapon && Math.random() < 0.25 && ITEMS.pub_glass) f.weapon = { def: ITEMS.pub_glass, durability: 1 }; },
});

// ======================================================================= OCHE WARRIOR (darts)
registerEnemy('pub_darts', {
  name: 'OCHE WARRIOR', hp: 32, speed: 2.4, runSpeed: 4.4, power: 0.9, score: 180, guard: 20,
  look: rng => ({
    ...casualLook(rng, { ...PORTSIDE, scarf: null, hatChance: 0, build: rng.range(1.35, 1.55) }),
    jacket: { style: 'polo', color: rng.pick(['#e83a8a', '#3ad8ff', '#f0c020']) },
    shirt: rng.pick(['#e83a8a', '#3ad8ff', '#f0c020']),
    pants: { style: 'suit', color: '#1a1a22' }, shoes: { color: '#121214', sole: '#222' },
    hair: { style: rng.pick(['mod', 'curtains', 'bald']), color: rng.pick(['#3a2717', '#5a5a5a', '#b4521c']) },
    facial: rng.pick(['tache', 'beard', 'stubble']),
  }),
  ai: { aggression: 0.3, reaction: 0.42, attacks: [['jab', 2], ['slap', 2]], comboLen: [1, 2], blockChance: 0.1, keepDist: 4.6, taunt: 0.12 },
  drops: [['cash5', 0.3], ['pub_crisps', 0.15], ['coin', 0.4]],
  think(f, world, dt, ai) {
    if (ai.goal) return false;
    const p = world.player;
    if (!p || !p.alive || !ai.aggro) return false;
    ai.dartCd = (ai.dartCd ?? 0.8 + Math.random()) - dt;
    ai.backT = (ai.backT || 0) - dt;
    if (!f.canAct) return false;
    const I = f.intent;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 0.01;
    if (ai.backT > 0) { // back-pedal out of trouble
      ai.moveToward(f, world, f.x - dx / d * 3, f.y - dy / d * 3, dt, true);
      return true;
    }
    if (d < 1.6 && Math.random() < dt * 2.2) { ai.backT = 0.45 + Math.random() * 0.4; world.releaseToken(f); return true; }
    if (ai.dartCd <= 0 && d > 2.0 && d < 7.5 && clearShot(world, f.x, f.y, p.x, p.y)) {
      f.face2(dx, dy);
      I.mx = I.my = 0;
      I.attackName = 'pub_dartThrow';
      f.data.projectile = 'pub_dart';
      ai.volley = (ai.volley || 0) + 1;
      if (ai.volley >= 3) {
        ai.volley = 0; ai.dartCd = 2.2 + Math.random() * 1.2;
        world.fx.popup(f.x, f.y, f.z + 0.4, 'ONE HUNDRED AND EIGHTY!', '#ffe14a');
      } else ai.dartCd = 0.42;
      return true;
    }
    return false;
  },
});

// ======================================================================= PUB DRUNK
registerEnemy('pub_drunk', {
  name: 'PUB DRUNK', hp: 56, speed: 2.0, runSpeed: 3.8, power: 1.0, weight: 1.35, superArmor: 3, score: 160, guard: 25,
  look: rng => ({
    ...casualLook(rng, { scarf: null, hatChance: 0.1, build: rng.range(1.3, 1.5) }),
    skin: rng.pick(['#e8968a', '#f0a090', '#d88a7a']),
    jacket: { style: rng.pick(['shirt', 'tee', 'vest']), color: rng.pick(['#c8b8a0', '#8a8aa0', '#5a3a2a', '#e8e4dc']) },
    shirt: rng.pick(['#c8b8a0', '#e8e4dc', '#8a6a6a']),
    pants: { style: rng.pick(['suit', 'jeans', 'trackies']), color: rng.pick(['#3a3a40', '#4a4030', '#2a2a3a']) },
    hair: { style: rng.pick(['bald', 'long', 'crop', 'flattop']), color: rng.pick(['#8a8a8a', '#3a2717', '#c8c8c0']) },
    facial: rng.pick(['beard', 'stubble', 'tache']),
  }),
  ai: { aggression: 0.5, reaction: 0.5, attacks: [['haymaker', 3], ['slap', 2], ['push', 1]], comboLen: [1, 1], blockChance: 0.02, grabChance: 0.12, keepDist: 1.8, runChance: 0.1, taunt: 0.05 },
  drops: [['pint', 0.3], ['pub_crisps', 0.2], ['coin', 0.4]],
  think(f, world, dt, ai) {
    if (ai.goal) return false;
    const p = world.player;
    if (!p || !p.alive) return false;
    ai.lurchCd = (ai.lurchCd ?? 1.5 + Math.random() * 2) - dt;
    ai.wob = (ai.wob ?? Math.random() * 6) + dt;
    const I = f.intent;
    if (f.canAct && ai.aggro) {
      const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 0.01;
      if (Math.random() < dt * 0.1 && d > 1.6) { // HIC!
        f.tauntAnim = 'pub_stagger'; f.tauntTime = 1.1;
        f.setState('taunt'); I.mx = I.my = 0;
        world.fx.popup(f.x, f.y, f.z + 0.2, 'HIC!', '#ffd27a');
        return true;
      }
      if (ai.lurchCd <= 0 && d > 1.0 && d < 3.4) { // the lurch: sudden, and not quite aimed
        ai.lurchCd = 2.4 + Math.random() * 2.2;
        const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
        f.fx = Math.cos(a); f.fy = Math.sin(a);
        I.mx = I.my = 0;
        I.attackName = 'pub_lurch';
        return true;
      }
    }
    ai.base(f, world, dt);
    // wobbly walking
    const m = Math.hypot(I.mx, I.my);
    if (m > 0.1 && f.canAct) {
      const w = Math.sin(ai.wob * 2.3) * 0.8 + Math.sin(ai.wob * 5.1) * 0.25;
      const nx = I.mx / m, ny = I.my / m;
      const vx = nx - ny * w, vy = ny + nx * w, l = Math.hypot(vx, vy) || 1;
      I.mx = vx / l * m; I.my = vy / l * m;
    }
    return true;
  },
});

// ======================================================================= RON, THE GUV'NOR (boss)
const RON_LOOK = {
  skin: '#e89a80', hair: { style: 'bald', color: '#9a9a9a' }, facial: 'tache',
  jacket: { style: 'vest', color: '#5a1a24', trim: '#3a0c14' }, shirt: '#ece4d4',
  pants: { style: 'suit', color: '#2a2a32', trim: '#3a3a44' }, shoes: { color: '#121214', sole: '#3a2a1a' },
  scarf: null, build: 1.6, height: 1.3,
};
const RON_VEST = { ...RON_LOOK, jacket: { style: 'tee', color: '#f4f0e4' }, shirt: '#f4f0e4', skin: '#f0907a' };
const RON_LINES = ['OUT!', "YOU'RE BARRED!", 'TIME!', 'NOT IN MY PUB!', 'GET OUT!', "THAT'S MY GLASS!"];

function ronSummon(world, f) {
  const spots = [[{ x: 60.5, y: 20.5 }, { x: 55.5, y: 19.5 }], [{ x: 60.5, y: 21.5 }, { x: 55.5, y: 24.5 }], [{ x: 45.5, y: 32.5 }, { x: 44.5, y: 27.5 }]];
  let n = 0;
  for (const [from, to] of spots) {
    if (n >= 2) break;
    if (world.heightAt(to.x, to.y) > STEP_UP) continue;
    const e = world.spawnEnemy('pub_drunk', to.x, to.y, { from, aggro: true, name: 'REGULAR' });
    if (e) n++;
  }
}

registerEnemy('pub_ron', {
  name: "RON THE GUV'NOR", boss: true, hp: 320, speed: 2.3, runSpeed: 4.4, power: 1.2, weight: 2.4, superArmor: 8, guard: 80, score: 4000, ungrabbable: true,
  look: RON_LOOK,
  ai: { aggression: 0.55, reaction: 0.36, attacks: [['haymaker', 3], ['pub_backhand', 2], ['push', 2], ['bodySlam', 1]], comboLen: [1, 2], blockChance: 0.18, grabChance: 0.1, ignoreTokens: true, keepDist: 2.4 },
  drops: [['kebab', 1], ['cash20', 1]],
  onSpawn(f) { f.r = 0.36; },
  onDeath(f, world) {
    world.fx.popup(f.x, f.y, f.z + 0.6, "YOU'RE BARRED. SEE YOU NEXT WEEK.", '#ffd27a');
    if (world.level.ambient && world.level.ambient.pubBase !== undefined) world.level.ambient.dark = world.level.ambient.pubBase;
  },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !f.alive) return false;
    const I = f.intent;
    if (!ai.pub) ai.pub = { mode: 'bar', glassCd: 1.4, bargeCd: 3.5, barT: 0, bells: 0, ringT: 0, lineT: 2, vault: false };
    const R = ai.pub;
    R.glassCd -= dt; R.bargeCd -= dt; R.barT += dt; R.lineT -= dt;
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy) || 0.01;
    const hpf = f.hp / f.maxHp;

    // ---- the vault over the bar (noclip hop) -> land, then fight
    if (R.vault) {
      if (f.onGround && f.stateT > 0.05 || f.state !== 'jump') {
        R.vault = false; f.noclip = false; unstick(f, world);
        world.camera.shake(5, 0.25); world.fx.dust(f.x, f.y, f.z, 8); world.sfx('fall', f);
      } else { I.mx = I.my = 0; return true; }
    }
    // ---- pending LAST ORDERS summon
    if (R.ringT > 0) { R.ringT -= dt; if (R.ringT <= 0) ronSummon(world, f); }
    // ---- extra glasses for the phase-2 volley
    if (f.state === 'attack' && f.attack && f.attack.name === 'pub_glassThrow' && f.attack.phase >= 1 && !f.attack.pubVolley) {
      f.attack.pubVolley = true;
      if (R.lockin) {
        const px = -dy / d, py = dx / d;
        for (const s of [-1.6, 1.6]) world.spawnProjectile(f, 'pub_glass', p.x + px * s, p.y + py * s, ITEMS.pub_glass.weapon.throwDmg * f.power);
      }
    }
    // ---- phase 2: LOCK-IN
    if (hpf < 0.4 && !R.lockin) {
      R.lockin = true;
      f.look = normalizeLook(RON_VEST);
      f.speed *= 1.25; f.runSpeed *= 1.1; f.superArmor += 3;
      R.bargeCd = Math.min(R.bargeCd, 1.2);
      world.message('LOCK-IN!', "RON'S BOLTED THE DOORS. NOBODY LEAVES.", 2.4, '#ff4a4a');
      world.sfx('bossRoar', f); world.camera.shake(6, 0.4);
      const amb = world.level.ambient;
      if (amb) { if (amb.pubBase === undefined) amb.pubBase = amb.dark; amb.dark = Math.min(0.56, amb.pubBase + 0.16); }
      world.pubLockin = true;
    }
    if (f.state !== 'taunt' && f.tauntAnim === 'pub_ring') { f.tauntAnim = undefined; f.tauntTime = undefined; }
    if (!f.canAct) return false;

    if (R.lineT <= 0 && d < 9) { R.lineT = 3 + Math.random() * 3; world.fx.popup(f.x, f.y, f.z + 0.5, RON_LINES[Math.floor(Math.random() * RON_LINES.length)], '#ffd27a'); }

    // ---- LAST ORDERS (at 70% and again during the lock-in)
    if ((R.bells === 0 && hpf < 0.7) || (R.bells === 1 && R.lockin && hpf < 0.3)) {
      R.bells++;
      f.tauntAnim = 'pub_ring'; f.tauntTime = 1.1;
      f.setState('taunt'); I.mx = I.my = 0; f.vx = f.vy = 0;
      R.ringT = 0.7;
      world.message('LAST ORDERS!', 'RON RINGS THE BELL FOR THE REGULARS', 2, '#ffd27a');
      world.sfx('pub_bell', f);
      for (const pr of world.props) if (pr.type === 'pub_bell') pr.ring = 1.6;
      return true;
    }

    // ---- behind the bar: pace the counter, lob glasses
    if (R.mode === 'bar') {
      const playerBehind = p.y < 15 && p.z < 0.5;
      if (playerBehind || hpf < 0.88 || R.barT > 11) {
        R.mode = 'brawl';
        if (!playerBehind && f.y < 15) { // vault the counter toward the player
          const lx = [42.5, 45.5, 48.5, 51.5, 54.5].reduce((b, x) => (Math.abs(x - p.x) < Math.abs(b - p.x) ? x : b), 48.5);
          const tx = lx, ty = 17.4, ddx = tx - f.x, ddy = ty - f.y, dd = Math.hypot(ddx, ddy) || 1;
          const T = 0.85, sp = Math.min(f.runSpeed, dd / T);
          f.face2(ddx, ddy);
          f.setState('jump'); f.onGround = false; f.vz = 10.2; f.vx = ddx / dd * sp; f.vy = ddy / dd * sp;
          f.noclip = true; R.vault = true;
          I.mx = I.my = 0;
          world.message("RIGHT! THAT'S IT!", 'RON COMES OVER THE BAR', 1.8, '#ff4a4a');
          world.sfx('bossRoar', f);
          return true;
        }
        return false;
      }
      if (d < 1.7) return false; // you're on the counter in his face: fight
      f.face2(dx, dy);
      if (R.glassCd <= 0 && d < 9) {
        R.glassCd = 1.5 + Math.random() * 0.5;
        I.mx = I.my = 0;
        I.attackName = 'pub_glassThrow';
        f.data.projectile = 'pub_glass';
        return true;
      }
      const tx = Math.max(39, Math.min(57.5, p.x)), ty = 13.4;
      const mx = tx - f.x, my = ty - f.y, ml = Math.hypot(mx, my);
      if (ml > 0.4) { I.mx = mx / ml; I.my = my / ml; I.run = false; } else { I.mx = I.my = 0; }
      return true;
    }

    // ---- brawl: specials on top of the default AI
    if (R.bargeCd <= 0 && d > 2.0 && d < 6.5 && world.hasLOS(f.x, f.y, p.x, p.y)) {
      R.bargeCd = R.lockin ? 3.0 : 5.0;
      f.face2(dx, dy);
      I.mx = I.my = 0;
      I.attackName = 'pub_belly';
      world.fx.popup(f.x, f.y, f.z + 0.7, 'BELLY BARGE!', '#ff4a4a');
      world.sfx('bossRoar', f);
      return true;
    }
    if (R.glassCd <= 0 && d > 3.2 && d < 8 && clearShot(world, f.x, f.y, p.x, p.y)) {
      R.glassCd = R.lockin ? 2.4 : 3.6;
      f.face2(dx, dy);
      I.mx = I.my = 0;
      I.attackName = 'pub_glassThrow';
      f.data.projectile = 'pub_glass';
      return true;
    }
    return false;
  },
});
