// Enemy type registry + factory.
//
// ENEMY DEF (registerEnemy(id, def)):
// {
//   name: 'SHOWN IN HUD', hp, speed, runSpeed, power, defense, weight, guard, superArmor, reachMul, score,
//   look: lookObject | (rng) => lookObject        (see doll.js LOOK FORMAT; a function gives per-spawn variety)
//   ai: { ...see game/ai.js },
//   drops: [['itemId', chance], ...],
//   weapon: 'itemId' | null                        starts holding this weapon
//   boss: false, ungrabbable: false,
//   think(f, world, dt, ai) -> true to override default AI this step (bosses)
//   onSpawn(f, world), onDeath(f, world)
// }
// Bosses are registered in bosses.js. All content modules are loaded via content/index.js.

import { Fighter } from '../game/fighter.js';
import { AIController } from '../game/ai.js';
import { ITEMS } from '../game/items.js';
import { makeRng } from '../engine/rng.js';
import { rivalClub, awayClub, rivalTag } from './rivals.js';

export const ENEMIES = {};
export function registerEnemy(id, def) { ENEMIES[id] = { id, ...def }; }

let seedCounter = 1;
export function spawnEnemy(type, x, y, opts = {}, world) {
  const def = ENEMIES[type];
  if (!def) { console.warn('[enemies] unknown enemy type', type); return null; }
  const rng = makeRng((opts.seed ?? seedCounter++) * 9973 + 17);
  const look = typeof def.look === 'function' ? def.look(rng) : (def.look || {});
  const f = new Fighter({
    type, name: opts.name || def.name, team: 'enemy', look, x, y,
    hp: opts.hp ?? def.hp ?? 40, speed: def.speed ?? 2.6, runSpeed: def.runSpeed ?? 4.6,
    power: def.power ?? 1, defense: def.defense ?? 1, weight: def.weight ?? 1, guard: def.guard ?? 20,
    superArmor: def.superArmor ?? 0, reachMul: def.reachMul ?? 1, score: def.score ?? 100, boss: !!(def.boss || opts.boss),
  });
  f.ungrabbable = !!def.ungrabbable;
  f.controller = new AIController(def);
  if (opts.facing) f.face2(opts.facing.x, opts.facing.y);
  const wpn = opts.weapon ?? def.weapon;
  if (wpn && ITEMS[wpn]) f.weapon = { def: ITEMS[wpn], durability: ITEMS[wpn].weapon.durability + 2 };
  if (def.onSpawn) def.onSpawn(f, world, opts);
  return f;
}

// ------------------------------------------------------------------ palette helpers
const SKINS = ['#e2a97a', '#d49a6a', '#f0c098', '#b87a50', '#8a5636', '#5e3a24', '#f4d0b0'];
const HAIRC = ['#141016', '#3a2717', '#6a4a2a', '#b4521c', '#e8d27a', '#5a5a5a'];
// the story's two rival firms: real clubs, chosen from the club your firm follows (content/rivals.js). Read live, so
// enemies spawned after a new firm is formed wear the new rivals' colours. a/b = kit colours, name, firm, tag ('DIF')
function liveClub(get) {
  const o = {};
  for (const k of ['a', 'b', 'name', 'firm', 'city']) Object.defineProperty(o, k, { get: () => get()[k], enumerable: true });
  Object.defineProperty(o, 'tag', { get: () => rivalTag(get()), enumerable: true });
  Object.defineProperty(o, 'club', { get, enumerable: false });
  return o;
}
export const RIVAL = liveClub(rivalClub);     // the derby enemy
export const AWAY = liveClub(awayClub);       // the away firm
// scarf/kit colours that stay live inside looks built when the module loads: { a, b } read at spawn time
const liveKit = get => Object.defineProperties({}, { a: { get: () => get().a, enumerable: true }, b: { get: () => get().b, enumerable: true } });
export const RIVAL_KIT = liveKit(rivalClub);
export const AWAY_KIT = liveKit(awayClub);

export function casualLook(rng, o = {}) {
  const dark = () => rng.pick(['#141416', '#1c1c20', '#26262c', '#2e3036', '#3a3c42']);
  return {
    skin: rng.pick(SKINS),
    hair: { style: rng.pick(o.hair || ['crop', 'shaved', 'skinhead', 'curtains', 'mod', 'spiky']), color: rng.pick(HAIRC) },
    facial: rng.pick(['none', 'stubble', 'stubble', 'beard', 'tache']),
    jacket: o.jacket || rng.pick([
      { style: 'hoodie', color: dark() },
      { style: 'hoodie', color: rng.pick(['#141416', '#6a6e78', o.a || '#1f4fb4']) },
      { style: 'harrington', color: rng.pick(['#1d2742', '#3a3a3e', '#4a4030']) },
      { style: 'track', color: rng.pick([o.a || '#1f4fb4', '#222222', '#3a3a6a']), trim: '#e8e8e8' },
      { style: 'bomber', color: rng.pick(['#2a3220', '#1a1a20']), lining: '#e07020' },
      { style: 'tee', color: '#ffffff' },
      { style: 'polo', color: '#ffffff' },
    ]),
    shirt: o.shirt || rng.pick([o.a || '#1f4fb4', '#e8e4dc', '#3a3a3a', '#8a1a1a']),
    pants: { style: rng.pick(['jeans', 'jeans', 'trackies', 'cargo']), color: rng.pick(['#34507a', '#1e1e26', '#5a6a7a', '#6a5a40']) },
    shoes: { color: rng.pick(['#f2f2ee', '#121214', '#2d5bb3', '#7a2020']), sole: '#d0c0a0' },
    scarf: o.scarf === null ? null : (o.scarf || (rng.chance(0.7) ? { a: o.a || RIVAL.a, b: o.b || RIVAL.b } : null)),
    hat: rng.chance(o.hatChance ?? 0.15) ? rng.pick([{ style: 'cap', color: '#3a3a3a' }, { style: 'beanie', color: o.a || RIVAL.a, trim: o.b || RIVAL.b }, { style: 'bucket', color: '#d8d0b8' }]) : null,
    shades: rng.chance(0.08),
    // match-day kit: hoods up, faces covered, bum bags, gloves (the 3D models show these; 2D ignores them)
    hood: rng.chance(o.hoodChance ?? 0.3),
    mask: rng.chance(o.maskChance ?? 0.35) ? rng.pick(['snood', 'snood', 'balaclava']) : null,
    maskColor: rng.pick(['#141416', '#1c1c20', '#141416', o.a || '#1f4fb4']),
    bag: rng.chance(0.3),
    gloves: rng.chance(0.35) ? '#141416' : null,
    build: o.build ?? rng.range(0.95, 1.2),
    height: o.height ?? rng.range(0.96, 1.04),
  };
}

// ------------------------------------------------------------------ base roster (levels add more via their own modules)
// Each base type is a distinct archetype:
//   rival    PORTSIDE LAD     — the everyday opponent: cautious, jab/cross, mouthy, taunts while waiting
//   awayfan  VARGBY BOOT BOY  — aggressive RUSHER: charges in from range with a shoulder barge, kicks
//   bruiser  BIG UNIT         — slow tank: super armour, grabs and body slams; telegraphed haymakers
//   bottler  BOTTLE MERCHANT  — ranged pest: keeps his distance (kites) and lobs bottles on a cooldown
//   steward  STEWARD          — defender: blocks a lot and COUNTERS, pushes you away, grabs
//   ganger   ESTATE RAT       — fast FLANKER: works round your back, dodges, low kicks, grabs weapons
//   firm     FIRM TOP BOY     — the real deal: long combos, blocks/counters/dodges, occasional flying kick
registerEnemy('rival', {
  name: 'PORTSIDE LAD', hp: 34, speed: 2.5, power: 0.7, score: 100,
  look: rng => casualLook(rng, { a: RIVAL.a, b: RIVAL.b }),
  ai: { aggression: 0.45, reaction: 0.42, attacks: [['jab', 3], ['cross', 2], ['haymaker', 1]], comboLen: [1, 2], blockChance: 0.1, keepDist: 2.4, taunt: 0.12,
    shouts: { aggro: ['OI! ANCHOR!', 'THAT\'S ONE!', 'GET HIM!'], taunt: ['COME ON THEN!', 'YOU WHAT?', 'RED RUBBISH!', 'BLUES! BLUES!'], hurt: ['ME NOSE!', 'OOF!'] } },
  drops: [['coin', 0.45], ['pint', 0.08]],
});
registerEnemy('awayfan', {
  name: 'VARGBY BOOT BOY', hp: 40, speed: 2.9, runSpeed: 5.2, power: 0.8, score: 140,
  look: rng => casualLook(rng, { a: AWAY.a, b: AWAY.b, hair: ['skinhead', 'shaved', 'crop'] }),
  ai: { aggression: 0.7, reaction: 0.3, attacks: [['jab', 2], ['cross', 2], ['kick', 2], ['haymaker', 1]], comboLen: [1, 3], blockChance: 0.05, runChance: 0.4, keepDist: 2.6,
    rushChance: 0.22, rushAttack: 'shoulder', taunt: 0.08,
    shouts: { aggro: ['VARGBY!', 'HERE THEY ARE!'], taunt: ['WE\'RE VARGBY!', 'SMALL TOWN, BIG BOOTS', 'IS THAT IT?'], rush: ['OI OI!', 'HAVE IT!', 'VARGBYYY!'] } },
  drops: [['coin', 0.5], ['cash5', 0.1], ['pie', 0.08]],
});
registerEnemy('bruiser', {
  name: 'BIG UNIT', hp: 70, speed: 2.1, power: 1.05, weight: 1.6, superArmor: 5, score: 250, guard: 40,
  look: rng => casualLook(rng, { a: RIVAL.a, b: RIVAL.b, build: rng.range(1.35, 1.5), height: 1.12, hair: ['skinhead', 'shaved'] }),
  ai: { aggression: 0.5, reaction: 0.5, attacks: [['haymaker', 3], ['push', 2], ['bodySlam', 1]], comboLen: [1, 1], blockChance: 0.15, grabChance: 0.12, keepDist: 2.0, taunt: 0.1,
    shouts: { aggro: ['YOU\'RE MINE.'], taunt: ['COME HERE, SON.', 'I\'LL SIT ON YOU.', 'TINY MAN.'], hurt: ['...THAT TICKLED.'] } },
  drops: [['pie', 0.25], ['cash5', 0.2]],
});
registerEnemy('bottler', {
  name: 'BOTTLE MERCHANT', hp: 30, speed: 2.7, power: 0.65, score: 150,
  look: rng => casualLook(rng, { a: RIVAL.a, b: RIVAL.b, jacket: { style: 'parka', color: '#3e4530' } }),
  ai: { aggression: 0.35, reaction: 0.45, attacks: [['jab', 2], ['slap', 1]], throwChance: 0.5, throwCd: 2.6, projectile: 'bottle', keepDist: 4.2, kite: true, taunt: 0.06,
    shouts: { aggro: ['INCOMING!'], taunt: ['CATCH!', 'ONE FOR YOU!', 'EMPTIES!'] } },
  drops: [['bottle', 0.4], ['coin', 0.4]],
});
registerEnemy('steward', {
  name: 'STEWARD', hp: 55, speed: 2.4, power: 0.9, guard: 50, score: 200,
  look: rng => ({ ...casualLook(rng, { scarf: null, hatChance: 0 }), jacket: { style: 'hivis', color: '#d8f020' }, shirt: '#1a1a22', pants: { style: 'trackies', color: '#1a1a22', trim: '#1a1a22' }, shoes: { color: '#121214', sole: '#222' } }),
  ai: { aggression: 0.45, reaction: 0.36, attacks: [['push', 3], ['jab', 2], ['kick', 1]], blockChance: 0.4, counterChance: 0.5, grabChance: 0.15, keepDist: 2.2, taunt: 0.06,
    shouts: { aggro: ['STEP BACK!', 'OI, YOU!'], taunt: ['SIT DOWN!', 'NOT TODAY, SON.', 'BACK IN THE STAND!'], hurt: ['I\'M ON MINIMUM WAGE!'] } },
  drops: [['energy', 0.15], ['coin', 0.3]],
});
registerEnemy('ganger', {
  name: 'ESTATE RAT', hp: 38, speed: 3.0, runSpeed: 5.4, power: 0.8, score: 150,
  look: rng => casualLook(rng, { scarf: null, jacket: { style: 'track', color: rng.pick(['#222', '#3a1a4a', '#0a3a3a']), trim: '#c0c0c0' }, hatChance: 0.5 }),
  ai: { aggression: 0.6, reaction: 0.3, attacks: [['jab', 3], ['kick', 2], ['lowKick', 2]], comboLen: [2, 3], dodgeChance: 0.18, useWeapons: true, keepDist: 2.6, flank: 0.9, runChance: 0.35, taunt: 0.08,
    shouts: { aggro: ['NICE TRAINERS...', 'OI, MATE!'], taunt: ['WOT YOU LOOKIN AT?', 'GIVE US A QUID', 'BEHIND YA!'] } },
  drops: [['cash5', 0.2], ['coin', 0.3]],
});
registerEnemy('firm', {
  name: 'FIRM TOP BOY', hp: 60, speed: 3.0, power: 1.0, score: 300, guard: 45,
  look: rng => casualLook(rng, { a: RIVAL.a, b: RIVAL.b, jacket: { style: 'harrington', color: rng.pick(['#b5a98a', '#1d2742']), lining: '#1f4fb4' }, scarf: null }),
  ai: { aggression: 0.65, reaction: 0.27, attacks: [['jab', 2], ['cross', 2], ['hook', 2], ['kick', 1], ['uppercut', 1]], comboLen: [2, 4], blockChance: 0.3, counterChance: 0.35, dodgeChance: 0.1, grabChance: 0.06, keepDist: 2.2,
    rushChance: 0.12, rushAttack: 'flyingKick', taunt: 0.1,
    shouts: { aggro: ['SO YOU\'RE THE LAST ONE.'], taunt: ['NO SCARF, NO STYLE.', 'WE RUN THIS TOWN.', 'TAKE YOUR TIME.'], rush: ['MY TURN!'] } },
  drops: [['cash20', 0.15], ['pint', 0.15]],
});
