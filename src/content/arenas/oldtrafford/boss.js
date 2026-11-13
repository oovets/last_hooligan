// OLD TRAFFORD — the home side's enemies and the boss.
//
//   ot_redarmy   RED ARMY            the masses: lots of them, weak on their own, red everywhere
//   ot_oldboy    RED ARMY OLD BOY    70s throwback (sheepskin, sideburns, scarf round the wrist): big, tough,
//                                    headbutts, sometimes swings a football rattle. A big man worth PINNING (GRAB HIM!)
//   ot_tout      TICKET TOUT         fast and slippery: runs for any cash lying about, pockets it and legs it.
//                                    Floor him and he coughs it all back up (plus his float)
//   ot_mib       THE MEN IN BLACK    disciplined crew in black jackets: block a lot, flank, and ATTACK TOGETHER ON A
//                                    SIGNAL. Someone shouts "NOW!", the crew freezes with guards up for a beat ("!"),
//                                    then they all rush THE MOST ISOLATED of your lot at once -> keep the firm tight
//                                    (BACK TO ME / HOLD) or watch a lad get swamped
//   ot_grimshaw  DES "THE FUNERAL DIRECTOR" GRIMSHAW (BOSS, invented): the Men in Black's cold, organised top man.
//       NOW!          raises a hand (readable freeze), then his crew rushes together and he steps in behind them;
//                     whistles up fresh crew when his lads are down (limited)
//       HAMMERFIST    punishes button mashing: throw 3+ attacks at him in quick succession and he shells up ("...")
//                     then answers with an unblockable hammerfist. Hit, step out, hit again
//       LIGHTS OUT    at 70% and 35%: "FUSE BOX!" warning, the forecourt floodlights flicker and die (ambient darkness
//                     spike), crew step out of the shadows, and he dashes in from the dark (watch for the "!").
//                     USE the fuse box on the wall to throw the breakers back on early.

import { registerEnemy, casualLook } from '../../enemies.js';
import { registerAttack } from '../../../game/combat.js';
import { registerAttackPose, GUARD } from '../../../game/poses.js';
import { normalizeLook } from '../../../game/doll.js';
import { OT } from './theme.js';

const { RED, WHITE, BLACK } = OT;
const G = GUARD;
const live = f => !!f && f.alive && f.hp > 0 && !f.removed && !f.dying;
const popup = (world, f, text, color = '#ffe14a') => world.fx.popup(f.x, f.y, f.z + 0.5, text, color);

// ------------------------------------------------------------------ poses + attacks
registerAttackPose('ot_hammerPose', {
  windup: { ...G, uaN: 3.0, faN: 0.6, lean: -0.25, dy: -1 },
  hit: { ...G, uaN: 1.2, faN: 0.15, lean: 0.5, dx: 3, dy: 3, thN: 0.6, knN: 0.6 },
});
registerAttackPose('ot_dashPose', {
  windup: { lean: 0.6, dy: 5, thN: 0.9, knN: 1.6, thF: -0.6, knF: 0.9, uaN: -0.4, faN: 1.6, uaF: 0.6, faF: 1.8 },
  hit: { lean: 0.55, dx: 5, dy: 2, thN: 0.9, knN: 0.6, thF: -0.9, knF: 0.4, uaN: 1.7, faN: 0.0, uaF: 0.3, faF: 1.6 },
});
registerAttackPose('ot_signalPose', {
  windup: { ...G, uaN: 3.1, faN: 0.2, uaF: 0.6, faF: 1.6, lean: -0.1 },
  hit: { ...G, uaN: 2.4, faN: 0.1, uaF: 0.6, faF: 1.6, lean: 0.2, dx: 2 },
});
registerAttack('ot_hammer', { pose: 'ot_hammerPose', startup: 0.2, active: 0.1, recovery: 0.42, dmg: 16, reach: 1.15, arc: 1.0, kb: 4.5, stun: 0.6, knockdown: true, launch: 3, unblockable: true, telegraph: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.8, hitstop: 0.14, shake: 6, score: 0 });
registerAttack('ot_grimDash', { pose: 'ot_dashPose', startup: 0.5, active: 0.32, recovery: 0.5, dmg: 13, reach: 1.0, arc: 0.9, kb: 5.5, stun: 0.55, knockdown: true, launch: 3, lunge: 9, telegraph: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.4, hitstop: 0.09, shake: 5, score: 0 });
registerAttack('ot_grimStep', { pose: 'ot_signalPose', startup: 0.3, active: 0.16, recovery: 0.35, dmg: 10, reach: 1.05, arc: 0.9, kb: 3.5, stun: 0.45, lunge: 5, sfx: 'punchHeavy', whiff: 'whoosh', hz: 1.5, hitstop: 0.06, shake: 3, score: 0 });

// ------------------------------------------------------------------ the masses
registerEnemy('ot_redarmy', {
  name: 'RED ARMY', hp: 24, speed: 2.6, runSpeed: 4.8, power: 0.6, score: 80, guard: 12,
  look: rng => {
    const L = casualLook(rng, { a: RED, b: WHITE, hatChance: 0.3, maskChance: 0.1 });
    L.jacket = rng.pick([{ style: 'kit', color: RED, trim: WHITE }, { style: 'track', color: RED, trim: WHITE }, { style: 'track', color: BLACK, trim: RED }, { style: 'harrington', color: '#1a1a20', lining: RED }, { style: 'tee', color: RED }, L.jacket]);
    L.shirt = rng.pick([RED, WHITE, BLACK]);
    L.scarf = rng.chance(0.75) ? rng.pick([{ a: RED, b: WHITE }, { a: RED, b: BLACK }]) : null;
    return L;
  },
  ai: { aggression: 0.55, reaction: 0.4, attacks: [['jab', 3], ['cross', 2], ['slap', 1], ['kick', 1]], comboLen: [1, 2], blockChance: 0.06, runChance: 0.45, keepDist: 2.2, taunt: 0.12, flee: 0.25,
    shouts: { aggro: ['UNITED!', 'RED ARMY!', 'THERE THEY ARE!'], taunt: ['WHO ARE YA?', 'U-N-I-T-E-D!', 'YOU\'RE GOING HOME IN AN AMBULANCE!', 'GLORY GLORY!'], hurt: ['MAM!', 'OOF!'] } },
  drops: [['coin', 0.45], ['ot_tea', 0.06]],
});

registerEnemy('ot_oldboy', {
  name: 'RED ARMY OLD BOY', hp: 78, speed: 2.2, runSpeed: 4.2, power: 1.05, weight: 1.6, superArmor: 4, guard: 45, score: 260,
  look: rng => ({
    skin: rng.pick(['#e8b48c', '#f0c098', '#d49a6a']),
    hair: { style: rng.pick(['wedge', 'perm', 'long', 'balding', 'sidepart']), color: rng.pick(['#5a5a5a', '#8a8a8a', '#3a2717', '#6a4a2a']) },
    facial: rng.pick(['tache', 'sideburns', 'beard', 'tache']),
    hat: rng.chance(0.3) ? { style: 'beanie', color: RED, trim: WHITE, bobble: true } : null,
    jacket: rng.pick([{ style: 'sheepskin', color: '#6a4a2a' }, { style: 'parka', color: '#3a4030' }, { style: 'leather', color: '#1a1414' }, { style: 'harrington', color: '#c8b48a', lining: RED }]),
    shirt: rng.pick([RED, WHITE, '#e8d8a8']),
    pants: { style: 'jeans', color: rng.pick(['#3a4a6a', '#2a3346', '#4a3a2a']) },   // flares (in spirit)
    shoes: { color: rng.pick(['#3a2414', '#121214']), sole: '#2a1a10', style: 'boot' },
    scarf: { a: RED, b: WHITE },
    gloves: RED,                                                                      // the scarf round the wrist
    build: rng.range(1.3, 1.5), height: rng.range(1.04, 1.1),
  }),
  ai: { aggression: 0.5, reaction: 0.42, attacks: [['headbutt', 3], ['haymaker', 2], ['push', 1], ['cross', 1]], comboLen: [1, 2], blockChance: 0.14, grabChance: 0.1, keepDist: 2.1, taunt: 0.1,
    shouts: { aggro: ['NOT IN MY DAY, SON.'], taunt: ['I WAS ON THE STRETFORD END IN \'74!', 'YOUR LOT? SOFT.', 'COME ON THEN, KIDDA!', 'TAKE IT OUTSIDE!'], hurt: ['ME HIP!', '...STILL GOT IT.'] } },
  drops: [['ot_pasty', 0.3], ['cash5', 0.3]],
});

// ------------------------------------------------------------------ ticket tout: steals cash pickups and legs it
const CASH = new Set(['coin', 'cash5', 'cash20']);
function nearestCash(world, f, r) {
  let best = null, bd = r;
  for (const it of world.items) {
    if (it.removed || !CASH.has(it.type) || it.z > 0.6 || it.pickDelay > 0) continue;
    const d = Math.hypot(it.x - f.x, it.y - f.y);
    if (d < bd && world.heightAt(it.x, it.y) < 0.35) { bd = d; best = it; }
  }
  return best;
}
registerEnemy('ot_tout', {
  name: 'TICKET TOUT', hp: 34, speed: 3.2, runSpeed: 6.0, power: 0.65, score: 180, guard: 15,
  look: rng => {
    const L = casualLook(rng, { scarf: null, hatChance: 0, maskChance: 0, hoodChance: 0 });
    L.jacket = rng.pick([{ style: 'leather', color: '#2a1a14' }, { style: 'parka', color: '#3a3a30' }, { style: 'sheepskin', color: '#7a5a3a' }]);
    L.hat = rng.chance(0.6) ? { style: 'flatcap', color: rng.pick(['#4a4038', '#3a3a3e']) } : null;
    L.facial = rng.pick(['tache', 'stubble']); L.bag = true;
    return L;
  },
  ai: { aggression: 0.35, reaction: 0.36, attacks: [['slap', 3], ['jab', 2], ['lowKick', 1]], comboLen: [1, 2], dodgeChance: 0.22, keepDist: 3.0, runChance: 0.6, taunt: 0.1,
    shouts: { aggro: ['TICKETS! BUY OR SELL!'], taunt: ['ANY SPARES?', 'FACE VALUE, HONEST!', 'CASH ONLY, PAL!'], hurt: ['NOT THE FACE!'] } },
  drops: [['cash5', 0.6], ['cash20', 0.2]],
  onSpawn(f) { f.data.loot = []; },
  onDeath(f, world) {
    const loot = f.data.loot || [];
    if (loot.length) popup(world, f, 'HAVE IT BACK!', '#7aff9a');
    for (const id of loot) world.spawnItem(id, f.x, f.y, 0.5, { vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: 4, pickDelay: 0.4 });
  },
  think(f, world, dt, ai) {
    const d = f.data, p = world.player;
    if (!p || !p.alive || !ai.aggro || ai.goal || !f.canAct) return false;
    d.legT = (d.legT || 0) - dt;
    // pockets full: leg it away from the player for a while (stays inside the fight)
    if (d.legT > 0) {
      const dx = f.x - p.x, dy = f.y - p.y, dd = Math.hypot(dx, dy) || 1;
      if (dd > 7) { f.intent.mx = f.intent.my = 0; f.face2(-dx, -dy); if (Math.random() < dt * 0.6) f.intent.taunt = true; return true; }
      ai.moveToward(f, world, f.x + dx / dd * 3, f.y + dy / dd * 3, dt, true);
      return true;
    }
    const it = nearestCash(world, f, 7);
    if (it && (d.loot.length < 4)) {
      if (Math.hypot(it.x - f.x, it.y - f.y) < 0.55) {
        it.removed = true;
        d.loot.push(it.type);
        popup(world, f, it.type === 'cash20' ? 'A SCORE! TA!' : 'MINE!', '#7aff9a');
        world.sfx('coin', f);
        if (!world.__otToutWarned) { world.__otToutWarned = true; world.toast('THE TOUT HAS NICKED YOUR CASH! FLOOR HIM TO GET IT BACK'); }
        d.legT = 3 + Math.random() * 2;
        return true;
      }
      ai.moveToward(f, world, it.x, it.y, dt, true);
      return true;
    }
    return false;
  },
});

// ------------------------------------------------------------------ THE MEN IN BLACK (crew + shared signal)
function mibLook(rng) {
  const L = casualLook(rng, { scarf: null, hatChance: 0, maskChance: 0.25, hoodChance: 0.15 });
  L.jacket = rng.pick([{ style: 'harrington', color: BLACK, lining: '#1a1a1a' }, { style: 'bomber', color: BLACK, lining: '#2a2a2a' }, { style: 'leather', color: '#0c0c0e' }, { style: 'track', color: BLACK, trim: '#2a2a2e' }]);
  L.shirt = rng.pick([BLACK, '#1a1a1e', WHITE]);
  L.pants = { style: rng.pick(['jeans', 'cargo']), color: rng.pick(['#141418', '#1e1e24']) };
  L.shoes = { color: rng.pick([BLACK, '#f2f2ee']), sole: rng.pick(['#222', '#d0c0a0']) };
  L.gloves = BLACK; L.maskColor = BLACK;
  L.hair = { style: rng.pick(['crop', 'shaved', 'buzz', 'skinhead', 'sidepart']), color: rng.pick(['#141016', '#3a2717', '#1a1a1a']) };
  L.build = rng.range(1.05, 1.22); L.height = rng.range(1.0, 1.06);
  return L;
}
registerEnemy('ot_mib', {
  name: 'MAN IN BLACK', hp: 60, speed: 2.9, runSpeed: 5.3, power: 1.0, guard: 60, score: 360,
  look: mibLook,
  ai: { aggression: 0.5, reaction: 0.3, attacks: [['jab', 3], ['cross', 2], ['hook', 2], ['kick', 1]], comboLen: [2, 3], blockChance: 0.48, counterChance: 0.3, dodgeChance: 0.06, keepDist: 2.5, flank: 1.0, runChance: 0.3, rushAttack: 'shoulder', taunt: 0.04,
    shouts: { aggro: ['...', 'STAY TIGHT.', 'ON MY CALL.'], taunt: ['WAIT FOR IT.', 'NOBODY MOVES.', 'TIGHT, LADS.'], rush: ['NOW!'], hurt: ['...'] } },
  drops: [['coin', 0.5], ['cash5', 0.25], ['ot_tea', 0.12]],
  think(f, world, dt, ai) { return mibThink(f, world, dt, ai); },
});

export function mibState(world) {
  return world.__otMib || (world.__otMib = { lastT: -1, cd: 3.5, phase: 'idle', t: 0, members: [], target: null, caller: null, signals: 0 });
}
function crewMembers(world) {
  return world.fighters.filter(f => f.type === 'ot_mib' && live(f) && f.controller && f.controller.aggro && !f.controller.goal && !(f.controller.fleeT > 0));
}
// the player's man with the fewest mates around him (ties -> the player)
function isolated(world) {
  const team = [world.player, ...((world.firm && world.firm.lads) || [])].filter(o => o && o.alive && !o.removed && o.state !== 'dead' && !(o.routT > 0));
  let best = world.player, bs = 1e9;
  for (const o of team) {
    let n = 0;
    for (const q of team) if (q !== o && Math.hypot(q.x - o.x, q.y - o.y) < 3) n++;
    const s = n * 10 + (o === world.player ? -0.5 : 0);
    if (s < bs) { bs = s; best = o; }
  }
  return best;
}
// Runs once per frame (whichever crew member or the boss thinks first).
export function mibCrew(world, dt) {
  const S = mibState(world);
  if (S.lastT === world.time) return S;
  S.lastT = world.time;
  const boss = world.fighters.find(f => f.type === 'ot_grimshaw' && live(f));
  if (S.phase === 'idle') {
    S.cd -= dt * (world.__otDark ? 2.2 : 1);
    const mem = crewMembers(world);
    const p = world.player;
    if (S.cd <= 0 && mem.length >= 2 && p && p.alive) {
      S.phase = 'ready'; S.t = 0.8; S.members = mem; S.target = isolated(world); S.signals++;
      S.caller = boss && boss.canAct && Math.hypot(boss.x - p.x, boss.y - p.y) < 10 ? boss : mem.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b));
      if (S.caller.say) S.caller.say(S.caller === boss ? 'NOW.' : 'NOW!', 0.9);
      for (const m of mem) popup(world, m, '!', '#ff4a4a');
      world.sfx('whistle', S.caller);
      const who = S.target === p ? 'YOU' : S.target.name;
      if (S.signals <= 2 || S.target !== p) world.toast(`THE MEN IN BLACK ARE GOING FOR ${who}! ${S.target === p ? 'BRACE!' : 'BACK TO ME!'}`);
    }
  } else if (S.phase === 'ready') {
    S.t -= dt;
    if (S.t <= 0) {
      S.phase = 'idle';
      S.cd = (boss ? 6 : 7.5) + Math.random() * 2;
      const tgt = S.target && S.target.alive ? S.target : world.player;
      for (const m of S.members) {
        if (!live(m) || !m.controller) continue;
        const c = m.controller;
        c.tgt = tgt; c.tgtUntil = world.time + 3;
        c.blockT = 0; m.intent.block = false;
        c.rushT = 1.7;
      }
      S.members = [];
    }
  }
  return S;
}
function mibThink(f, world, dt, ai) {
  const S = mibCrew(world, dt);
  if (S.phase === 'ready' && S.members.includes(f)) {
    if (!f.canAct) return false;
    const t = S.target || world.player;
    f.face2(t.x - f.x, t.y - f.y);
    f.intent.mx = f.intent.my = 0;
    f.intent.block = true;            // guards up, waiting for the call
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ BOSS: DES "THE FUNERAL DIRECTOR" GRIMSHAW
const GRIM_LOOK = {
  skin: '#e2b08a', hair: { style: 'buzz', color: '#8a8a8e' }, facial: 'goatee',
  jacket: { style: 'leather', color: '#0c0c0e' }, shirt: BLACK,
  pants: { style: 'jeans', color: '#141418' }, shoes: { color: BLACK, sole: '#222', style: 'boot' },
  scarf: null, gloves: BLACK, build: 1.32, height: 1.24,
};
const GRIM_LINES = ['TIGHT, LADS.', 'NOBODY RUNS.', 'YOU\'RE A LONG WAY FROM HOME.', 'I\'VE BURIED BETTER.', 'SLOWLY NOW.', 'ON MY SIGNAL.'];

function bossArena(world) { return (world.level.boss && world.level.boss.lockArea) || null; }
function inRect(a, x, y) { return a && x >= a.x && y >= a.y && x <= a.x + a.w && y <= a.y + a.h; }
// spawn spots on the edge of the arena (the level can override with boss.crewSpots)
function crewSpots(world) {
  return (world.level.boss && world.level.boss.crewSpots) || [];
}
function callCrew(world, n, msg) {
  const spots = crewSpots(world).slice().sort(() => Math.random() - 0.5);
  let k = 0;
  for (const s of spots) {
    if (k >= n) break;
    const e = world.spawnEnemy('ot_mib', s.x, s.y, { from: s.from, aggro: true });
    if (e) k++;
  }
  if (k && msg) world.message(msg, '', 1.4, '#c8c8d0');
  return k;
}

// LIGHTS OUT: darkness spike in the boss arena, restored by timer, the fuse box or the boss going down.
export function lightsOut(world) {
  const A = bossArena(world);
  world.__otDark = true; world.__otLightsOn = false;
  world.ambientOverride = { dark: 0.9, color: '#020308', playerLight: 2.4 };
  world.__otDimmed = [];
  for (const l of world.lights) if (inRect(A, l.x, l.y) && l.active !== false) { l.active = false; world.__otDimmed.push(l); }
  world.sfx('zap', world.player);
  world.camera.shake(3, 0.25);
}
export function lightsOn(world, msg = true) {
  if (!world.__otDark) return;
  world.__otDark = false; world.__otLightsOn = false;
  world.ambientOverride = null;
  for (const l of world.__otDimmed || []) { l.active = true; l.flicker = l.__flick0; }
  world.__otDimmed = [];
  if (msg) world.message('LIGHTS BACK ON', 'NOWHERE TO HIDE NOW', 1.4, '#ffe14a');
}
function flickerArena(world, on) {
  const A = bossArena(world);
  for (const l of world.lights) if (inRect(A, l.x, l.y)) { if (l.__flick0 === undefined) l.__flick0 = !!l.flicker; l.flicker = on ? true : l.__flick0; }
}

registerEnemy('ot_grimshaw', {
  name: 'DES GRIMSHAW', boss: true, hp: 640, speed: 2.7, runSpeed: 5.0, power: 1.2, weight: 2.0, superArmor: 8, guard: 90, score: 7000, ungrabbable: true,
  look: GRIM_LOOK,
  ai: { aggression: 0.55, reaction: 0.3, attacks: [['jab', 2], ['cross', 3], ['hook', 2], ['push', 1], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.32, dodgeChance: 0.06, ignoreTokens: true, keepDist: 2.6, taunt: 0.04, shouts: false },
  drops: [['kebab', 1], ['cash20', 1]],
  onSpawn(f) { f.tauntAnim = 'taunt2'; },
  onDeath(f, world) {
    lightsOn(world, false);
    flickerArena(world, false);
    popup(world, f, 'CLOSE THE LID.', '#c8c8d0');
  },
  think(f, world, dt, ai) {
    const p = world.player;
    if (!p || !p.alive) return false;
    const d = f.data;
    if (!d.init) { d.init = true; d.calls = 3; d.lights = 0; d.mash = []; d.lineT = 3; }
    const S = mibCrew(world, dt);
    const dx = p.x - f.x, dy = p.y - f.y, dist = Math.hypot(dx, dy) || 0.01;
    const hpf = f.hp / f.maxHp;
    d.lineT -= dt;

    // ---- watch for button mashing: count the player's attacks thrown at close range
    if (p.state === 'attack' && p.attack && p.attack !== d.seenAtk) {
      d.seenAtk = p.attack;
      if (dist < 2.4) d.mash.push(world.time);
    }
    d.mash = d.mash.filter(t => world.time - t < 1.4);

    // ---- LIGHTS OUT sequence (warn -> dark)
    if (d.ls) {
      const L = d.ls;
      L.t -= dt;
      if (L.phase === 'warn') {
        f.intent.mx = f.intent.my = 0; f.face2(dx, dy);
        if (L.t <= 0) {
          L.phase = 'dark'; L.t = 6.5; L.dashT = 1.4;
          flickerArena(world, false);
          lightsOut(world);
          world.message('LIGHTS OUT!', 'THEY\'RE IN THE SHADOWS. FIND THE FUSE BOX (E)', 2.2, '#8a8aff');
          const crew = world.fighters.filter(o => o.type === 'ot_mib' && live(o)).length;
          if (crew < 3) callCrew(world, Math.min(2, 3 - crew), null);
          S.cd = Math.min(S.cd, 1.2);
        }
        return true;
      }
      if (L.phase === 'dark') {
        if (world.__otLightsOn || L.t <= 0) { d.ls = null; lightsOn(world); return false; }
        // strikes out of the dark: a dash, telegraphed by the "!" and a glint
        L.dashT -= dt;
        if (f.canAct && L.dashT <= 0 && dist > 2.0 && dist < 9) {
          L.dashT = 2.6 + Math.random();
          f.face2(dx, dy);
          f.intent.attackName = 'ot_grimDash';
          popup(world, f, '...', '#c8c8ff');
          world.sfx('whooshBig', f);
          return true;
        }
        // otherwise hangs back at the edge of your light
        if (f.canAct && dist < 3.2 && f.state !== 'attack' && Math.random() < 0.6) {
          ai.moveToward(f, world, f.x - dx / dist * 2, f.y - dy / dist * 2, dt, false);
          f.face2(dx, dy);
          return true;
        }
        return false;
      }
    }

    // ---- hammerfist counter: shell up, then punish
    if (d.shell > 0) {
      d.shell -= dt;
      f.face2(dx, dy);
      if (f.state === 'hurt' || f.isDown) { d.shell = 0; return false; }
      const swinging = p.state === 'attack' && dist < 2.2;
      if (f.state === 'blockstun' || (swinging && d.shell < 0.35)) { d.shell = 0; d.hammerQ = true; f.intent.block = false; return true; }
      f.intent.block = true; f.intent.mx = f.intent.my = 0;
      if (d.shell <= 0) { f.intent.block = false; if (dist < 1.8) d.hammerQ = true; }
      return true;
    }
    if (d.hammerQ) {
      f.intent.block = false;
      if (f.canAct) {
        d.hammerQ = false;
        f.face2(dx, dy);
        f.intent.attackName = 'ot_hammer';
        popup(world, f, 'HAMMERFIST!', '#ff6a4a');
        world.sfx('whooshBig', f);
      }
      return true;
    }
    if (f.canAct && d.mash.length >= 3 && dist < 2.2) {
      d.mash = [];
      d.shell = 0.65;
      popup(world, f, '...', '#c8c8d0');
      f.intent.block = true; f.intent.mx = f.intent.my = 0;
      if (!d.hammerTold) { d.hammerTold = true; world.toast('DON\'T MASH! HE COUNTERS. HIT, STEP OUT, HIT AGAIN'); }
      return true;
    }
    // under pressure from blocks too: blockstun -> counter
    if (f.state === 'blockstun' && Math.random() < 0.5) { d.hammerQ = true; return false; }

    // ---- phase change: gloves off
    if (!d.phase2 && hpf < 0.4) {
      d.phase2 = true;
      f.look = normalizeLook({ ...f.look, gloves: null, jacket: { style: 'tee', color: BLACK }, __norm: undefined });
      f.speed *= 1.12; f.superArmor += 3;
      world.message('GRIMSHAW TAKES THE GLOVES OFF', 'HE FOLDS THEM. NEATLY.', 2, '#c8c8d0');
      world.sfx('bossRoar', f);
    }
    if (!f.canAct) return false;

    // ---- LIGHTS OUT triggers at 70% and 35%
    if ((d.lights === 0 && hpf < 0.7) || (d.lights === 1 && hpf < 0.35)) {
      d.lights++;
      d.ls = { phase: 'warn', t: 1.3 };
      flickerArena(world, true);
      world.message('GRIMSHAW NODS AT THE FUSE BOX...', 'THE FLOODLIGHTS FLICKER', 1.4, '#c8c8ff');
      f.intent.taunt = true;
      world.sfx('bossRoar', f);
      return true;
    }

    // ---- crew down: whistle up more (limited)
    const crew = world.fighters.filter(o => o.type === 'ot_mib' && live(o)).length;
    ai.callCd = (ai.callCd ?? 5) - dt;
    if (crew === 0 && d.calls > 0 && ai.callCd <= 0) {
      d.calls--; ai.callCd = 9;
      f.intent.taunt = true;
      callCrew(world, 2, 'GRIMSHAW WHISTLES. MORE BLACK JACKETS.');
      world.sfx('whistle', f);
      return true;
    }

    // ---- NOW!: he's the caller -> raise the hand while the crew freezes, then step in behind them
    if (S.phase === 'ready' && S.caller === f) {
      f.intent.mx = f.intent.my = 0;
      f.face2(dx, dy);
      if (!d.signalling) { d.signalling = true; f.intent.taunt = true; }   // the raised hand
      return true;
    }
    if (d.signalling) {                                                    // the crew goes: he steps in behind them
      d.signalling = false;
      if (dist < 5) { f.face2(dx, dy); f.intent.attackName = 'ot_grimStep'; return true; }
    }

    // ---- solo pressure: a dash from range when he's on his own
    ai.dashCd = (ai.dashCd ?? 3) - dt;
    if (ai.dashCd <= 0 && crew === 0 && dist > 2.6 && dist < 8 && world.hasLOS(f.x, f.y, p.x, p.y)) {
      ai.dashCd = d.phase2 ? 3.2 : 4.6;
      f.face2(dx, dy);
      f.intent.attackName = 'ot_grimDash';
      world.message('THE LONG WALK!', '', 0.8, '#c8c8d0');
      return true;
    }
    if (d.lineT <= 0 && dist < 8) { d.lineT = 4 + Math.random() * 3; popup(world, f, GRIM_LINES[Math.floor(Math.random() * GRIM_LINES.length)], '#c8c8d0'); }
    return false;
  },
});
