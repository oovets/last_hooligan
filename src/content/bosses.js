// Boss roster. One boss per level; each has a custom think() layered on top of the default AI.
// (Levels 2-8 register their bosses in src/content/bosses/<id>.js; this file holds the shared Level 1 boss.)
import { registerEnemy, RIVAL } from './enemies.js';
import { registerAttack } from '../game/combat.js';

// Telegraphed bull charge: plants his feet and roars (0.7s, tracking you for the first half), then thunders
// forward in a straight line. Dodge sideways -> he whiffs and stumbles (long recovery); if he hits a wall he's dazed.
registerAttack('tel_charge', { pose: 'shoulder', startup: 0.7, active: 0.6, recovery: 0.8, dmg: 13, reach: 1.0, arc: 0.9, kb: 6, stun: 0.6, knockdown: true, launch: 3, lunge: 7.5, lungeActive: true, telegraph: true, guardDmg: 30, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.2, hitstop: 0.12, shake: 6, score: 0 });
// Enraged belly-flop: crouches (telegraph), then flattens everything around him. Step out of range or dodge.
registerAttack('tel_slam', { pose: 'bodySlam', startup: 0.6, active: 0.12, recovery: 0.75, dmg: 13, reach: 1.6, arc: Math.PI, kb: 5, stun: 0.6, knockdown: true, launch: 3, telegraph: true, guardDmg: 25, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 0.6, hitstop: 0.1, shake: 7, score: 0 });

// ---- LEVEL 1: BIG TEL — a pub-car-park legend with a shoulder charge
registerEnemy('bigtel', {
  name: 'BIG TEL', boss: true, hp: 230, speed: 2.3, runSpeed: 4.4, power: 0.95, weight: 2.2, superArmor: 7, guard: 70, score: 3000, ungrabbable: true,
  look: {
    skin: '#e8b090', hair: { style: 'skinhead', color: '#2a1a10' }, facial: 'beard',
    jacket: { style: 'bomber', color: '#1a2a4a', trim: '#0f1830', lining: '#e07020' }, shirt: '#1f4fb4',
    pants: { style: 'jeans', color: '#2a3a5a' }, shoes: { color: '#7a2020', sole: '#d8c060' },
    scarf: { a: RIVAL.a, b: RIVAL.b }, build: 1.55, height: 1.28,
  },
  ai: { aggression: 0.5, reaction: 0.42, attacks: [['haymaker', 3], ['cross', 2], ['bodySlam', 1], ['push', 1]], comboLen: [1, 2], blockChance: 0.15, grabChance: 0.1, ignoreTokens: true, keepDist: 2.6,
    shouts: false },
  drops: [['kebab', 1]],
  onSpawn(f) { f.say && f.say('MY CAR PARK.', 1.6); },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p) return false;
    ai.chargeCd = (ai.chargeCd ?? 2.5) - dt;
    ai.slamCd = (ai.slamCd ?? 3) - dt;
    const enraged = f.hp < f.maxHp * 0.45;
    if (enraged && !ai.enraged) {
      ai.enraged = true; f.speed *= 1.2; f.runSpeed *= 1.1;
      world.message('BIG TEL IS FUMING!', '', 1.5, '#ff4a4a'); world.sfx('bossRoar', f);
      f.say('RIGHT. THAT\'S IT.', 1.4);
      ai.chargeCd = Math.min(ai.chargeCd, 0.8);
    }
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy);
    const a = f.attack;

    // --- during the charge
    if (f.state === 'attack' && a && a.name === 'tel_charge') {
      if (a.phase === 0) {
        if (a.t < a.startup * 0.55) f.face2(dx, dy);          // tracks you, then commits
        if (Math.random() < 0.3) world.fx.dust(f.x - f.fx * 0.4, f.y - f.fy * 0.4, 0, 1);
      } else if (a.phase === 1) {
        if (Math.random() < 0.5) world.fx.dust(f.x, f.y, 0, 1);
        // bowls over his own lads too
        for (const o of world.fighters) {
          if (o === f || o.team !== f.team || !o.alive || o.isDown || o.state === 'thrown') continue;
          const ox = o.x - f.x, oy = o.y - f.y, od = Math.hypot(ox, oy);
          if (od < 1.0 && (ox * f.fx + oy * f.fy) > 0) { o.knockDown({ x: f.fx, y: f.fy }, 5, 2); o.hp -= 6; if (o.hp <= 0) { o.hp = 0; o.dying = true; } world.sfx('hitHeavy', o); }
        }
        // ploughs into a wall/car -> dazed (big punish window)
        if (f.blockedMove && a.t > a.startup + 0.08) {
          f.attack = null; f.setState('dizzy'); f.stunT = 1.7;
          f.vx = -f.fx * 1.5; f.vy = -f.fy * 1.5;
          world.sfx('wallSlam', f); world.camera.shake(7, 0.35);
          world.fx.debris(f.x + f.fx * 0.5, f.y + f.fy * 0.5, 1.2, ['#8a8a8a', '#5a5a5a'], 10);
          world.toast('BIG TEL HIT THE WALL! GET STUCK IN!');
          f.say('ME HEAD...', 1.2);
          ai.stumble = false; ai.again = false;
        }
      } else if (a.phase === 2 && a.hit.size === 0 && !a.stumbled) {
        a.stumbled = true;                                    // whiffed: he'll stumble once the charge ends
        ai.stumble = true;
        ai.again = ai.enraged && Math.random() < 0.55;
      }
      return true;
    }
    if (f.state === 'attack' && a && a.name === 'tel_slam' && a.phase === 1 && !a.dusted) {
      a.dusted = true; world.fx.dust(f.x, f.y, 0, 14); world.camera.shake(5, 0.25);
    }

    if (!f.canAct) return false;
    if (ai.stumble) {
      ai.stumble = false;
      // enraged: turns straight round and goes again
      if (ai.again && d > 1.8) { ai.again = false; return startCharge(f, world, ai, dx, dy, true); }
      f.setState('dizzy'); f.stunT = 0.6;
      return true;
    }
    // belly flop when you're crowding him (enraged only)
    if (ai.enraged && ai.slamCd <= 0 && d < 1.4 && !p.isDown) {
      ai.slamCd = 5 + Math.random() * 2;
      f.intent.attackName = 'tel_slam'; f.intent.mx = f.intent.my = 0;
      f.say('BELLY!', 0.8);
      return true;
    }
    // charge from mid range when he can see you
    if (ai.chargeCd <= 0 && d > 2.1 && d < 7.5 && !p.isDown && world.hasLOS(f.x, f.y, p.x, p.y)) {
      return startCharge(f, world, ai, dx, dy, false);
    }
    // you're in his face and the charge is ready: shove you away to make room for it
    ai.pushCd = (ai.pushCd ?? 0) - dt;
    if (ai.chargeCd <= 0 && ai.pushCd <= 0 && d < 1.4 && !p.isDown && Math.random() < dt * 3) {
      ai.pushCd = 3; ai.backoffT = 0.9;
      f.face2(dx, dy);
      f.intent.attackName = 'push'; f.intent.mx = f.intent.my = 0;
      if (Math.random() < 0.5) f.say('GET BACK!', 0.8);
      return true;
    }
    // ...then lumber backwards to get a run-up
    if (ai.backoffT > 0 && ai.chargeCd <= 0) {
      ai.backoffT -= dt;
      if (d < 2.3) { f.intent.mx = -dx / (d || 1); f.intent.my = -dy / (d || 1); f.face2(dx, dy); return true; }
    }
    return false;
  },
});

function startCharge(f, world, ai, dx, dy, again) {
  ai.chargeCd = ai.enraged ? 3.2 : 5;
  f.face2(dx, dy);
  f.intent.attackName = 'tel_charge';
  f.intent.mx = f.intent.my = 0;
  world.sfx('bossRoar', f);
  f.say(again ? 'AGAIN!' : 'RAAAAH!', 0.9);
  return true;
}
