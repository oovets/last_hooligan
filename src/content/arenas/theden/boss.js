// THE DEN (tour arena): the Bushwackers and the boss. All ids start with 'theden_'.
// Every character here is INVENTED (the firm and the club are real, these people aren't).
//
//   theden_bushwacker  BUSHWACKER         the everyday Millwall lad in navy & white: comes at you in a ROAR
//                                         (a shoulder-barge rush from range), never alone
//   theden_lockup      LOCK-UP LAD        out of the arches with a WHEEL BRACE: flanks, swings, and picks up
//                                         anything lying about
//   theden_scrapper    SCRAPPER           scrapyard pest: keeps his distance and frisbees HUBCAPS at you
//   theden_lumper      THE LUMPER         huge ex-docks labourer: super armour, grabs, a telegraphed two-handed
//                                         SACK HOOK slam. The big man to PIN (a lad holds him, you hit him)
//   theden_oldboy      COLD BLOW OLD BOY  elite: blocks and answers with a NUT; when he's hurt he ROARS
//                                         "NO ONE LIKES US!" and every Bushwacker near him gets faster
//   theden_docker      DOUG "THE DOCKER" CRATCHLEY  BOSS. Docker's flat cap, donkey jacket, hands like shovels.
//        CARGO HOOK    rears back ("HOOK!", 0.5 s): a long sweeping hook that DRAGS you in, then the NUT.
//                      Step out of range or sidestep: the whiff leaves him open.
//        DOCKSIDE BARGE plants his feet ("MILLWALL!", 0.65 s), then charges in a straight line. Into a van or
//                      a wall -> he's dazed (free hits).
//        TEA CHEST     at range he heaves a tea chest at you (two at once when he's raging).
//        BUSHWACKERS!  at 66% and 33% he whistles: lads come out of BOTH ends of the forecourt, an ambush.
//        under 45%: the donkey jacket comes off; faster, angrier, shorter cooldowns.

import { registerEnemy, casualLook } from '../../enemies.js';
import { registerAttack } from '../../../game/combat.js';
import { registerAttackPose, GUARD } from '../../../game/poses.js';
import { normalizeLook } from '../../../game/doll.js';
import { input } from '../../../engine/input.js';
import { NAVY, WHITE } from './theme.js';

const G = GUARD;
const live = f => !!f && f.alive && f.hp > 0 && !f.removed && !f.dying;
const popup = (world, f, text, color = '#a8c0ff') => world.fx.popup(f.x, f.y, f.z + 0.5, text, color);
const pick = a => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------------ poses
registerAttackPose('theden_hookPose', {
  windup: { ...G, uaN: 2.5, faN: 1.9, uaF: 0.4, faF: 1.4, lean: -0.25, dx: -3, head: -0.1 },
  hit: { ...G, uaN: 1.3, faN: 0.7, uaF: 0.6, faF: 1.6, lean: 0.45, dx: 6, thN: 0.6, knN: 0.5, thF: -0.4, knF: 0.2 },
});
registerAttackPose('theden_bargePose', {
  windup: { lean: 0.35, dy: 4, dx: -2, thN: 0.8, knN: 1.4, thF: -0.4, knF: 1.0, uaN: 0.3, faN: 1.8, uaF: 0.9, faF: 1.9, head: 0.1 },
  hit: { lean: 0.7, dx: 6, dy: 2, thN: 1.0, knN: 0.5, thF: -0.9, knF: 0.3, uaN: 0.2, faN: 2.0, uaF: 1.0, faF: 1.8, head: 0.15 },
});
registerAttackPose('theden_heavePose', {
  windup: { ...G, uaN: 3.0, faN: 0.5, uaF: 3.0, faF: 0.5, lean: -0.3, dy: -1, thN: 0.2, knN: 0.3 },
  hit: { ...G, uaN: 1.5, faN: 0.1, uaF: 1.5, faF: 0.1, lean: 0.4, dx: 4, thN: 0.7, knN: 0.6 },
});
registerAttackPose('theden_lumpPose', {
  windup: { ...G, uaN: 3.0, faN: 0.9, uaF: 3.0, faF: 0.9, lean: -0.3, dy: -1 },
  hit: { ...G, uaN: 1.0, faN: 0.2, uaF: 1.0, faF: 0.2, lean: 0.55, dx: 3, dy: 4, thN: 0.6, knN: 0.8 },
});

// ------------------------------------------------------------------ attacks
registerAttack('theden_nut', { pose: 'headbutt', startup: 0.1, active: 0.08, recovery: 0.32, dmg: 11, reach: 0.95, arc: 0.9, kb: 3, stun: 0.6, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.8, hitstop: 0.08, shake: 4, score: 0 });
registerAttack('theden_lump', { pose: 'theden_lumpPose', startup: 0.62, active: 0.1, recovery: 0.6, dmg: 16, reach: 1.3, arc: 1.0, kb: 4.5, stun: 0.6, knockdown: true, launch: 2, telegraph: true, guardDmg: 35, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.1, shake: 6, score: 0 });
// boss
registerAttack('theden_hook', { pose: 'theden_hookPose', startup: 0.5, active: 0.12, recovery: 0.6, dmg: 8, reach: 2.1, arc: 0.8, kb: 0.5, stun: 0.8, telegraph: true, guardDmg: 30, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.5, hitstop: 0.1, shake: 4, score: 0 });
registerAttack('theden_bossNut', { pose: 'headbutt', startup: 0.08, active: 0.08, recovery: 0.4, dmg: 14, reach: 1.0, arc: 1.0, kb: 4.5, stun: 0.6, knockdown: true, launch: 2.5, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.8, hitstop: 0.12, shake: 6, score: 0 });
registerAttack('theden_barge', { pose: 'theden_bargePose', startup: 0.65, active: 0.55, recovery: 0.8, dmg: 14, reach: 1.0, arc: 0.9, kb: 6, stun: 0.6, knockdown: true, launch: 3, lunge: 8, lungeActive: true, telegraph: true, guardDmg: 35, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.2, hitstop: 0.12, shake: 6, score: 0 });
registerAttack('theden_heave', { pose: 'theden_heavePose', startup: 0.6, active: 0.06, recovery: 0.45, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, whiff: 'whooshBig' });
registerAttack('theden_haymaker', { pose: 'haymaker', startup: 0.22, active: 0.1, recovery: 0.32, dmg: 13, reach: 1.15, arc: 1.0, kb: 3.5, stun: 0.5, knockdown: true, launch: 1.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.08, shake: 4, score: 0 });

// ------------------------------------------------------------------ looks
const lionLook = (rng, o = {}) => {
  const L = casualLook(rng, { a: NAVY, b: WHITE, hatChance: 0.25, ...o });
  if (L.scarf) L.scarf = { a: NAVY, b: WHITE };
  if (L.maskColor && L.maskColor !== '#141416' && L.maskColor !== '#1c1c20') L.maskColor = NAVY;
  return L;
};

// ------------------------------------------------------------------ BUSHWACKER
registerEnemy('theden_bushwacker', {
  name: 'BUSHWACKER', hp: 48, speed: 2.85, runSpeed: 5.1, power: 1.0, score: 160,
  look: rng => {
    const L = lionLook(rng);
    if (rng.chance(0.4)) L.jacket = rng.pick([
      { style: 'bomber', color: '#1a1a20', lining: '#e07020' },
      { style: 'harrington', color: rng.pick(['#1d2742', '#c8b48a']), lining: NAVY },
      { style: 'track', color: NAVY, trim: WHITE },
    ]);
    return L;
  },
  ai: { aggression: 0.66, reaction: 0.3, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.12, dodgeChance: 0.05, runChance: 0.4, keepDist: 2.4, useWeapons: true, taunt: 0.1,
    rushChance: 0.2, rushAttack: 'shoulder',
    shouts: { aggro: ['MILLWALL!', 'HERE THEY ARE!', 'BUSHWACKERS!'], taunt: ['YOU\'RE IN THE DEN NOW!', 'NO ONE LIKES US!', 'WRONG STATION, SON!', 'COME ON THEN!'], rush: ['MILLWALL!', 'HAVE IT!', 'OI OI!'], hurt: ['ME NOSE!', 'LEAVE IT!'] } },
  drops: [['coin', 0.5], ['theden_tea', 0.06]],
});

// ------------------------------------------------------------------ LOCK-UP LAD
registerEnemy('theden_lockup', {
  name: 'LOCK-UP LAD', hp: 50, speed: 3.0, runSpeed: 5.4, power: 1.0, score: 170, weapon: 'theden_wheelbrace',
  look: rng => {
    const L = lionLook(rng, { scarf: null, hoodChance: 0.4, hair: ['crop', 'shaved', 'skinhead', 'buzz'] });
    L.jacket = rng.pick([{ style: 'vest', color: rng.pick(['#e8e4dc', '#3a3a3e']) }, { style: 'bomber', color: '#2a3220', lining: '#e07020' }, { style: 'hoodie', color: rng.pick(['#1a1a22', NAVY]) }]);
    L.pants = { style: rng.pick(['cargo', 'jeans']), color: rng.pick(['#3a3a40', '#2a3346', '#4a4030']) };
    L.shoes = { color: '#3a2a1a', sole: '#222', style: 'boot' };
    L.gloves = rng.chance(0.5) ? '#2a2a2e' : null;
    return L;
  },
  ai: { aggression: 0.6, reaction: 0.3, attacks: [['jab', 2], ['cross', 2], ['kick', 2], ['lowKick', 1]], comboLen: [1, 2], blockChance: 0.1, dodgeChance: 0.1, flank: 0.8, runChance: 0.35, keepDist: 2.4, useWeapons: true, taunt: 0.08,
    shouts: { aggro: ['OUT THE ARCHES!', 'NOW, LADS!'], taunt: ['WANT YOUR TYRES DOING?', 'CASH ONLY, SON!', 'NO QUESTIONS ASKED!'], hurt: ['ME MOTOR!', 'OW!'] } },
  drops: [['coin', 0.4], ['cash5', 0.15]],
});

// ------------------------------------------------------------------ SCRAPPER (hubcap thrower)
registerEnemy('theden_scrapper', {
  name: 'SCRAPPER', hp: 32, speed: 2.9, runSpeed: 5.2, power: 0.75, score: 160,
  look: rng => ({ ...lionLook(rng, { scarf: null, hatChance: 0.5 }), jacket: { style: 'parka', color: rng.pick(['#3a3a2a', '#2a3a28', '#4a3a2a']) }, gloves: '#3a2a1a', mask: null }),
  ai: { aggression: 0.35, reaction: 0.42, attacks: [['jab', 2], ['slap', 1], ['lowKick', 1]], throwChance: 0.55, throwCd: 2.3, projectile: 'theden_hubcap', keepDist: 4.3, kite: true, taunt: 0.08,
    shouts: { aggro: ['INCOMING!', 'HUBCAPS!'], taunt: ['CATCH!', 'FRISBEE!', 'GOT A SPARE?'] } },
  drops: [['theden_hubcap', 0.35], ['coin', 0.4]],
});

// ------------------------------------------------------------------ THE LUMPER (the big man to pin)
registerEnemy('theden_lumper', {
  name: 'THE LUMPER', hp: 140, speed: 2.0, runSpeed: 3.8, power: 1.15, weight: 2.3, superArmor: 9, guard: 60, score: 520,
  look: rng => ({
    ...lionLook(rng, { scarf: null, hatChance: 0 }),
    hair: { style: rng.pick(['skinhead', 'balding', 'crop']), color: rng.pick(['#3a2717', '#6a6a6a', '#141016']) },
    facial: rng.pick(['beard', 'tache', 'stubble']),
    hat: rng.chance(0.5) ? { style: 'beanie', color: NAVY } : null,
    jacket: rng.pick([{ style: 'bomber', color: '#1a1a20', lining: '#e07020' }, { style: 'vest', color: '#e8e4dc' }, { style: 'tee', color: NAVY }]),
    shirt: NAVY, pants: { style: 'jeans', color: '#2a3a5a' }, shoes: { color: '#3a2a1a', sole: '#222', style: 'boot' },
    mask: null, hood: false, gloves: null, build: rng.range(1.5, 1.65), height: rng.range(1.15, 1.22),
  }),
  ai: { aggression: 0.5, reaction: 0.48, attacks: [['theden_lump', 2], ['theden_haymaker', 2], ['push', 2], ['bodySlam', 1]], comboLen: [1, 1], blockChance: 0.1, grabChance: 0.12, keepDist: 2.0, taunt: 0.1,
    shouts: { aggro: ['YOU WHAT?'], taunt: ['I\'VE SHIFTED BIGGER THAN YOU.', 'COME HERE, SUNSHINE.', 'TWENTY YEARS ON THE DOCKS.'], hurt: ['...LEAVE IT OUT.'] } },
  drops: [['theden_pieMash', 0.35], ['cash5', 0.3]],
  onSpawn(f) { f.say && f.say('YOU WHAT?', 1.2); },
  think(f, world) {
    const a = f.attack;
    if (f.state === 'attack' && a && a.name === 'theden_lump') {
      if (a.phase === 0 && a.t < 0.05 && !a.told) { a.told = true; popup(world, f, 'SACK HOOK!', '#ff9a3a'); }
      if (a.phase === 1 && !a.dusted) { a.dusted = true; world.fx.dust(f.x + f.fx * 0.8, f.y + f.fy * 0.8, 0, 8); world.camera.shake(4, 0.2); }
    }
    if (!world.__denLumperTold && f.controller.aggro && !f.controller.goal) {
      world.__denLumperTold = true;
      world.toast(world.firm ? `BIG MAN! HOLD ${input.hint('command')} + ${input.hint('grab')} ON HIM: A LAD PINS HIM, YOU HIT HIM FOR FREE` : 'BIG MAN! DON\'T TRADE PUNCHES. WAIT FOR THE SACK HOOK, THEN HIT HIM.');
    }
    return false;
  },
});

// ------------------------------------------------------------------ COLD BLOW OLD BOY (elite)
registerEnemy('theden_oldboy', {
  name: 'COLD BLOW OLD BOY', hp: 86, speed: 3.0, runSpeed: 5.2, power: 1.15, guard: 70, score: 420,
  look: rng => ({
    skin: rng.pick(['#e2a97a', '#f0c098', '#d49a6a', '#f4d0b0']),
    hair: { style: rng.pick(['balding', 'crop', 'sidepart']), color: rng.pick(['#6a6a6a', '#3a2717', '#a8a8a8']) },
    facial: rng.pick(['tache', 'stubble', 'none']),
    hat: rng.chance(0.4) ? { style: 'flatcap', color: rng.pick(['#3a3a40', '#4a4030']) } : null,
    jacket: rng.pick([{ style: 'sheepskin', color: '#8a6a4a' }, { style: 'harrington', color: '#1a1a22', lining: NAVY }, { style: 'bomber', color: NAVY, lining: '#e07020' }]),
    shirt: rng.pick([WHITE, NAVY]), pants: { style: 'jeans', color: rng.pick(['#2a3346', '#1e1e26']) },
    shoes: { color: rng.pick(['#121214', '#3a2a1a']), sole: '#2a2a2a', style: 'dress' },
    scarf: rng.chance(0.4) ? { a: NAVY, b: WHITE } : null, build: rng.range(1.15, 1.3), height: rng.range(1.0, 1.05),
  }),
  ai: { aggression: 0.62, reaction: 0.24, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1], ['theden_nut', 1]], comboLen: [2, 4], blockChance: 0.42, dodgeChance: 0.1, grabChance: 0.05, keepDist: 2.2, taunt: 0.14,
    shouts: { aggro: ['I WAS HERE IN \'78, SON.'], taunt: ['YOU DON\'T KNOW YOU\'RE BORN.', 'COLD BLOW LANE, SON. COLD.', 'TAKE YOUR TIME.'], hurt: ['CHEEKY.'] } },
  drops: [['cash20', 0.25], ['pint', 0.2]],
  think(f, world, dt, ai) {
    const p = world.player, d = f.data;
    if (!p || !p.alive) return false;
    // the ROAR: once, when he's hurt, every Bushwacker round him gets a second wind
    if (!d.roared && f.hp < f.maxHp * 0.6 && f.canAct) {
      d.roared = true;
      f.say('NO ONE LIKES US!', 1.6);
      world.sfx('bossRoar', f);
      for (const o of world.fighters) {
        if (o === f || o.team !== f.team || !live(o) || o.data.rallied || Math.hypot(o.x - f.x, o.y - f.y) > 5.5) continue;
        o.data.rallied = true; o.speed *= 1.15; o.runSpeed *= 1.1;
        popup(world, o, 'WE DON\'T CARE!', '#a8c0ff');
      }
      f.intent.taunt = true;
      return true;
    }
    // block -> counter NUT
    if (f.state === 'blockstun') { d.counter = true; return false; }
    if (d.counter) {
      if (Math.hypot(p.x - f.x, p.y - f.y) > 1.8 || f.isDown || f.state === 'hurt') { d.counter = false; return false; }
      if (f.state === 'block') { f.intent.block = false; ai.blockT = 0; f.intent.mx = f.intent.my = 0; return true; }
      if (f.canAct) {
        d.counter = false;
        f.face2(p.x - f.x, p.y - f.y);
        f.intent.block = false; f.intent.mx = f.intent.my = 0;
        f.intent.attackName = 'theden_nut';
        popup(world, f, 'THE NUT!', '#ff9a3a');
        return true;
      }
    }
    return false;
  },
});

// ------------------------------------------------------------------ BOSS: DOUG "THE DOCKER" CRATCHLEY
function arena(world) { return (world.level.boss && world.level.boss.lockArea) || null; }
function clampArena(world, x, y, m = 1) {
  const A = arena(world);
  if (!A) return { x, y };
  return { x: Math.max(A.x + m, Math.min(A.x + A.w - m, x)), y: Math.max(A.y + m, Math.min(A.y + A.h - m, y)) };
}
const freeSpot = (world, x, y) => world.heightAt(x, y) <= 0.3 && !world.blockedAt(x, y, 0.3, 0.3, null);

const DOCKER_LOOK = {
  skin: '#e4a882', hair: { style: 'crop', color: '#5a5a5a' }, facial: 'stubble',
  hat: { style: 'flatcap', color: '#2a2a30' },
  jacket: { style: 'bomber', color: '#1a1a1e', trim: '#0e0e10', lining: '#e07020' }, shirt: NAVY,
  pants: { style: 'jeans', color: '#2a3346' }, shoes: { color: '#3a2a1a', sole: '#1a1a1a', style: 'boot' },
  scarf: { a: NAVY, b: WHITE }, gloves: null, build: 1.6, height: 1.28,
};
const KO_LINES = ['NEXT.', 'NO ONE LIKES YOU EITHER.', 'STAY DOWN, SON.', 'THAT\'S BERMONDSEY FOR YOU.'];

function callTheLads(world, f, second) {
  world.message('"BUSHWACKERS!"', 'THEY\'RE COMING OUT OF BOTH ENDS', 2.2, '#a8c0ff');
  world.sfx('bossRoar', f);
  f.say(second ? 'ALL OF YOU! NOW!' : 'LADS? IF YOU\'D BE SO KIND.', 1.6);
  const A = arena(world);
  const ends = world.level.denAmbushFrom || [{ x: (A ? A.x : f.x - 8) - 1, y: f.y }, { x: (A ? A.x + A.w : f.x + 8) + 1, y: f.y }];
  const alive = world.fighters.filter(e => e.team === 'enemy' && live(e) && e !== f).length;
  const n = Math.max(1, Math.min(second ? 3 : 2, 5 - alive));
  for (let i = 0; i < n; i++) {
    const from = ends[i % ends.length];
    let t = clampArena(world, from.x + (from.x < f.x ? 3 : -3), from.y + (i - 1) * 1.2, 1.2);
    if (!freeSpot(world, t.x, t.y)) t = clampArena(world, f.x + (i % 2 ? 3 : -3), f.y, 1.2);
    if (!freeSpot(world, t.x, t.y)) continue;
    world.spawnEnemy(second && i === 2 ? 'theden_oldboy' : 'theden_bushwacker', t.x, t.y, { from, aggro: true });
  }
  if (world.firm) world.toast(`AMBUSH! BOTH ENDS! KEEP THE LADS CLOSE: BACK TO ME (${input.hint('orderRegroup')})`);
  else world.toast('AMBUSH FROM BOTH ENDS! KEEP MOVING!');
}

registerEnemy('theden_docker', {
  name: 'THE DOCKER', boss: true, hp: 660, speed: 2.55, runSpeed: 4.9, power: 1.2, weight: 2.3, superArmor: 9, guard: 85, score: 6800, ungrabbable: true,
  look: DOCKER_LOOK,
  ai: { aggression: 0.58, reaction: 0.3, attacks: [['jab', 2], ['hook', 2], ['theden_haymaker', 2], ['push', 1], ['kick', 1]], comboLen: [1, 3], blockChance: 0.24, ignoreTokens: true, keepDist: 2.3, taunt: 0.04, shouts: false },
  drops: [['theden_pieMash', 1], ['cash20', 1]],
  onSpawn(f) { f.tauntAnim = 'taunt'; f.koLines = KO_LINES; f.say && f.say('NO ONE LIKES YOU EITHER, SON.', 2.2); },
  onDeath(f, world) {
    f.say && f.say('...FAIR ENOUGH. COME BACK NEXT SEASON.', 2.6);
    world.fx.debris(f.x, f.y, 1.4, ['#2a2a30', NAVY, WHITE], 10);          // the flat cap goes flying
  },
  think(f, world, dt, ai) {
    const p = world.player;
    const d = f.data;
    if (!p) return false;
    // the win line when you go down
    if ((!p.alive || p.dying || p.hp <= 0) && !d.gloated) { d.gloated = true; f.say('BACK ON THE TRAIN, SON. MIND THE GAP.', 2.4); }
    if (p.alive && p.hp > 0) d.gloated = false;
    if (!p.alive) return false;
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 1;
    const a = f.attack;

    // ---- the donkey jacket comes off
    if (!d.raged && f.hp < f.maxHp * 0.45) {
      d.raged = true;
      f.look = normalizeLook({ ...f.look, jacket: { style: 'vest', color: '#e8e4dc' }, hat: null, __norm: undefined });
      f.speed *= 1.15; f.runSpeed *= 1.1; f.superArmor += 3;
      ai.ai.aggression = Math.min(0.9, ai.ai.aggression + 0.2);
      world.message('THE DONKEY JACKET COMES OFF!', 'AND THE CAP. NOW HE MEANS IT.', 2.2, '#a8c0ff');
      world.sfx('bossRoar', f); world.camera.shake(5, 0.4);
      world.fx.debris(f.x, f.y, 1.2, ['#1a1a1e', '#e07020', '#2a2a30'], 8);
      ai.spCd = Math.min(ai.spCd ?? 1, 1);
    }
    // ---- BUSHWACKERS! (66% and 33%)
    for (const [k, frac] of [['call1', 0.66], ['call2', 0.33]]) {
      if (!d[k] && f.hp < f.maxHp * frac && f.canAct) {
        d[k] = true;
        callTheLads(world, f, k === 'call2');
        f.intent.taunt = true;
        ai.spCd = 2;
        return true;
      }
    }

    // ---- CARGO HOOK in progress: track you early; on a hit, drag you in and queue the NUT
    if (f.state === 'attack' && a && a.name === 'theden_hook') {
      if (a.phase === 0 && a.t < a.startup * 0.5) f.face2(dx, dy);
      if (a.phase >= 1 && a.hit.size && !a.dragged) {
        a.dragged = true;
        for (const t of a.hit) {
          if (!live(t) || t.isDown) continue;
          const tx = f.x + f.fx * 0.95, ty = f.y + f.fy * 0.95;
          if (freeSpot(world, tx, ty)) { t.x = tx; t.y = ty; t.vx = t.vy = 0; }
          world.fx.popup(t.x, t.y, t.z + 0.6, 'HOOKED!', '#ffffff');
          d.nutT = t;
        }
      }
      return true;
    }
    if (d.nutT && f.canAct) {
      const t = d.nutT; d.nutT = null;
      if (live(t) && !t.isDown && Math.hypot(t.x - f.x, t.y - f.y) < 1.6) {
        f.face2(t.x - f.x, t.y - f.y); f.intent.mx = f.intent.my = 0; f.intent.block = false;
        f.intent.attackName = 'theden_bossNut';
        f.say('COME HERE.', 0.8);
        return true;
      }
    }
    // ---- DOCKSIDE BARGE in progress
    if (f.state === 'attack' && a && a.name === 'theden_barge') {
      if (a.phase === 0) { if (a.t < a.startup * 0.5) f.face2(dx, dy); if (Math.random() < 0.3) world.fx.dust(f.x - f.fx * 0.4, f.y - f.fy * 0.4, 0, 1); }
      else if (a.phase === 1) {
        if (Math.random() < 0.5) world.fx.dust(f.x, f.y, 0, 1);
        for (const o of world.fighters) {                                           // bowls his own lads over too
          if (o === f || o.team !== f.team || !o.alive || o.isDown) continue;
          if (Math.hypot(o.x - f.x, o.y - f.y) < 0.9) { o.knockDown({ x: f.fx, y: f.fy }, 4, 2); world.sfx('hitHeavy', o); }
        }
        if (f.blockedMove && a.t > a.startup + 0.08) {
          f.attack = null; f.setState('dizzy'); f.stunT = 1.6;
          f.vx = -f.fx * 1.2; f.vy = -f.fy * 1.2;
          world.sfx('wallSlam', f); world.camera.shake(7, 0.35);
          world.fx.debris(f.x + f.fx * 0.5, f.y + f.fy * 0.5, 1.2, ['#8a8a8a', '#5a5a5a'], 10);
          world.toast('THE DOCKER HIT THE WALL! GET STUCK IN!');
          f.say('ME \'EAD...', 1.2);
        }
      }
      return true;
    }
    // ---- TEA CHEST: release on the active frame
    if (f.state === 'attack' && a && a.name === 'theden_heave') {
      if (a.phase >= 1 && !a.fired) {
        a.fired = true;
        const t = d.tossTgt || p;
        const n = d.raged ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 1.8;
          world.spawnProjectile(f, 'theden_crate', t.x + (-dy / dist) * off, t.y + (dx / dist) * off, 15 * f.power);
        }
      }
      return true;
    }

    if (!f.canAct) return false;
    ai.spCd = (ai.spCd ?? 2.5) - dt;
    if (ai.spCd > 0 || p.isDown || ai.goal) return false;
    const los = world.hasLOS(f.x, f.y, p.x, p.y);
    const cd = (lo, hi) => (d.raged ? lo * 0.7 : lo) + Math.random() * (hi - lo);
    if (dist < 2.2 && los) {
      ai.spCd = cd(3.6, 4.8);
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0; f.intent.block = false;
      f.intent.attackName = 'theden_hook';
      popup(world, f, 'HOOK!', '#ff5a3a');
      world.sfx('whoosh', f);
      return true;
    }
    if (dist > 2.6 && dist < 7 && los && (Math.random() < 0.55 || dist < 4)) {
      ai.spCd = cd(4.2, 5.6);
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0; f.intent.block = false;
      f.intent.attackName = 'theden_barge';
      popup(world, f, pick(['MILLWALL!', 'MOVE!', 'OUT THE WAY!']), '#a8c0ff');
      world.sfx('bossRoar', f);
      return true;
    }
    if (dist >= 4 && dist < 10 && los) {
      ai.spCd = cd(3.8, 5.2);
      f.face2(dx, dy); f.intent.mx = f.intent.my = 0; f.intent.block = false;
      d.tossTgt = { x: p.x + (p.vx || 0) * 0.35, y: p.y + (p.vy || 0) * 0.35 };
      f.intent.attackName = 'theden_heave';
      popup(world, f, 'TEA CHEST!', '#ffe14a');
      f.say('DELIVERY!', 0.9);
      return true;
    }
    return false;
  },
});

export { live };
