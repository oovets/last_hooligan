// Playable characters (character select). Each has stats, a signature move set tweak and a fixed look
// (THE LAST HOOLIGAN uses the wardrobe outfit instead).
//
// CHARACTER: {
//   id, name, nick, tagline, bio: [lines],
//   stats: { power, speed, toughness, technique } (1..5, for the select screen bars),
//   fighter: { hp, speed, runSpeed, power, defense, weight, guard, superArmor, reachMul }   (overrides PLAYER_BASE)
//   moves: { punchL?, punchR?, kick?, run?, air? }  opening-attack overrides (attack ids in combat.js / registered below)
//   kickMul / punchMul: damage multipliers by limb
//   look: doll LOOK (null = wardrobe outfit)
//   unlock: null | { completed: true } | { level: n }
// }
import { registerAttack } from '../game/combat.js';
import { registerAttackPose, registerAnim, ATTACK_POSES } from '../game/poses.js';
import '../game/bigal.js';   // Big Al's strip (al_strip, al_stepladder, the shirt)

// ---- signature moves
registerAttack('mo_hammer', { pose: 'haymaker', startup: 0.2, active: 0.1, recovery: 0.28, dmg: 13, reach: 1.15, arc: 0.8, kb: 4, stun: 0.5, knockdown: true, launch: 2, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.6, hitstop: 0.09, shake: 5, score: 45, next: { punchL: 'jab', kick: 'kick' } });
registerAttack('mo_charge', { pose: 'bodySlam', startup: 0.12, active: 0.28, recovery: 0.35, dmg: 14, reach: 1.1, arc: 0.9, kb: 6, stun: 0.6, knockdown: true, launch: 3, lunge: 6.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.1, hitstop: 0.1, shake: 6, score: 60 });
registerAttack('stig_flurry', { pose: 'jab', startup: 0.03, active: 0.05, recovery: 0.08, dmg: 3, reach: 0.95, arc: 0.75, kb: 0.8, stun: 0.24, sfx: 'punch', whiff: 'whooshLight', hz: 1.6, score: 8, next: { punchL: 'stig_flurry2', punchR: 'cross', kick: 'lowKick' } });
registerAttack('stig_flurry2', { pose: 'hook', startup: 0.03, active: 0.05, recovery: 0.09, dmg: 3, reach: 0.95, arc: 0.85, kb: 0.8, stun: 0.24, sfx: 'punch', whiff: 'whooshLight', hz: 1.6, score: 8, next: { punchL: 'stig_flurry', punchR: 'uppercut', kick: 'spinKick' } });
registerAttack('stig_slide', { pose: 'flyingKick', startup: 0.04, active: 0.32, recovery: 0.22, dmg: 9, reach: 1.1, arc: 0.7, kb: 4, stun: 0.5, knockdown: true, launch: 1, lunge: 8, sfx: 'kick', whiff: 'whoosh', hz: 0.5, hitstop: 0.06, shake: 3, score: 45 });
// Kenny Showtime: ultraviolence. K = SHOWTIME BOMB (overhand from the heavens, knockdown), RUN + J = SPEAR (shoulder
// first through a man, knockdown); every hit lands harder the more he's hurt (fighter.rage, game/fighter.js).
registerAttack('kenny_bomb', { pose: 'kenny_bomb', startup: 0.16, active: 0.09, recovery: 0.26, dmg: 14, reach: 1.05, arc: 0.7, kb: 4.2, stun: 0.55, knockdown: true, launch: 2.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.7, hitstop: 0.11, shake: 6, score: 50, guardDmg: 20, next: { punchL: 'jab', punchR: 'cross', kick: 'kick' } });
registerAttack('kenny_spear', { pose: 'shoulder', startup: 0.08, active: 0.26, recovery: 0.3, dmg: 13, reach: 1.0, arc: 0.85, kb: 6, stun: 0.6, knockdown: true, launch: 3, lunge: 7.5, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 1.2, hitstop: 0.1, shake: 6, score: 60, guardDmg: 24 });
registerAttack('old_headbutt', { pose: 'headbutt', startup: 0.12, active: 0.08, recovery: 0.22, dmg: 11, reach: 0.9, arc: 0.7, kb: 2.5, stun: 0.6, sfx: 'hitHeavy', whiff: 'whoosh', hz: 1.8, hitstop: 0.08, shake: 3, score: 35, next: { punchL: 'jab', kick: 'kick' } });
// Fat Vic: STRYPGREPP (chokehold) specialist. Grab -> two-handed chokehold that lifts the victim off the ground and
// strangles them continuously (damage every tick); J/K = TIGHTEN (burst damage, keeps the hold locked);
// 3rd tighten = CHOKESLAM (hoists them overhead and slams them down, shockwave floors everyone close).
// RUN + GRAB = lunging grab for the throat. When he wins a fight he asks: "VILL DU DÖ ELLER?"
registerAttack('vic_tighten', { pose: 'vic_tighten', startup: 0.06, active: 0.1, recovery: 0.16, dmg: 6, reach: 1.1, arc: 1.4, kb: 0, stun: 0.6, grab: true, choke: true, sfx: 'grunt', hz: 1.8, hitstop: 0.05, shake: 2, score: 30 });
registerAttack('vic_chokeslam', { pose: 'vic_chokeslam', startup: 0.42, active: 0.12, recovery: 0.45, dmg: 18, reach: 1.7, arc: Math.PI, kb: 5, stun: 0.6, knockdown: true, launch: 1.5, chokeLift: true, sfx: 'hitHeavy', whiff: 'whooshBig', hz: 0.4, hitstop: 0.14, shake: 8, score: 150 });
registerAttack('vic_lunge', { pose: 'vic_lunge', startup: 0.08, active: 0.3, recovery: 0.3, dmg: 3, reach: 1.0, arc: 0.8, kb: 0.4, stun: 0.5, lunge: 6.5, grabOnHit: true, sfx: 'grab', whiff: 'whoosh', hz: 1.7, score: 30 });
// Vic: both arms straight out, hands locked round the throat at shoulder height, leaning in
registerAnim('choking', { loop: true, frames: [
  [0.18, { lean: 0.12, dy: 1, thN: 0.4, knN: 0.45, thF: -0.32, knF: 0.35, uaN: 1.62, faN: 0.25, uaF: 1.7, faF: 0.2, head: 0.1 }],
  [0.18, { lean: 0.18, dy: 2, thN: 0.42, knN: 0.5, thF: -0.34, knF: 0.38, uaN: 1.68, faN: 0.18, uaF: 1.76, faF: 0.14, head: 0.18 }],
] });
// victim: hauled up by the throat, clawing at the hands, legs kicking
registerAnim('choked', { loop: true, frames: [
  [0.12, { lean: -0.28, head: -0.45, thN: 0.35, knN: 0.9, thF: -0.15, knF: 0.4, uaN: 1.2, faN: 1.9, uaF: 1.35, faF: 1.8 }],
  [0.12, { lean: -0.32, head: -0.5, thN: -0.1, knN: 0.4, thF: 0.3, knF: 1.0, uaN: 1.3, faN: 1.8, uaF: 1.25, faF: 1.95 }],
] });
if (!ATTACK_POSES.vic_tighten) registerAttackPose('vic_tighten', {
  windup: { lean: 0.1, dy: 1, thN: 0.4, knN: 0.45, thF: -0.32, knF: 0.35, uaN: 1.55, faN: 0.35, uaF: 1.62, faF: 0.3, head: 0.05 },
  hit: { lean: 0.3, dy: 3, thN: 0.5, knN: 0.6, thF: -0.4, knF: 0.45, uaN: 1.75, faN: 0.05, uaF: 1.82, faF: 0.02, head: 0.3 },
});
if (!ATTACK_POSES.vic_chokeslam) registerAttackPose('vic_chokeslam', {
  windup: { lean: -0.3, dy: -2, thN: 0.2, knN: 0.2, thF: -0.2, knF: 0.2, uaN: 2.9, faN: 0.1, uaF: 2.95, faF: 0.05, head: -0.3 },
  hit: { lean: 0.85, dy: 7, dx: 4, thN: 0.9, knN: 1.4, thF: -0.6, knF: 0.9, uaN: 1.1, faN: 0.0, uaF: 1.15, faF: 0.0, head: 0.4 },
});
if (!ATTACK_POSES.vic_lunge) registerAttackPose('vic_lunge', {
  windup: { lean: 0.35, dy: 2, thN: 0.6, knN: 0.6, thF: -0.5, knF: 0.6, uaN: 1.2, faN: 0.6, uaF: 1.3, faF: 0.5 },
  hit: { lean: 0.6, dy: 3, dx: 4, thN: 0.8, knN: 0.4, thF: -0.7, knF: 0.4, uaN: 1.65, faN: 0.15, uaF: 1.72, faF: 0.1 },
});
if (!ATTACK_POSES.kenny_bomb) registerAttackPose('kenny_bomb', {
  windup: { lean: -0.3, dx: -1, uaN: 3.1, faN: 0.9, uaF: 1.0, faF: 1.6, thN: 0.3, knN: 0.3, head: -0.15 },
  hit: { lean: 0.55, dx: 4, dy: 2, uaN: 1.2, faN: 0.1, uaF: 0.7, faF: 1.6, thN: 0.6, knN: 0.5, thF: -0.5, knF: 0.2, head: 0.2 },
  follow: { lean: 0.5, dx: 3, dy: 2, uaN: 0.6, faN: 0.3, thN: 0.55, knN: 0.45, thF: -0.45 },
});

export const CHARACTERS = [
  {
    id: 'hooligan', name: 'THE LAST HOOLIGAN', nick: 'DEZ', tagline: 'ALL-ROUNDER. DRESS HIM UP IN THE WARDROBE.',
    bio: ['TWENTY YEARS ON THE TERRACES.', 'NEVER MISSED A HOME GAME.', 'NOBODY KNOWS HIS SURNAME.'],
    stats: { power: 3, speed: 3, toughness: 3, technique: 4 },
    fighter: {}, moves: {}, look: null, unlock: null,
  },
  {
    id: 'mo', name: 'BIG MO', nick: 'THE FRIDGE', tagline: 'SLOW. HUGE. SHRUGS OFF JABS.',
    bio: ['EX-DOORMAN AT THE ANCHOR.', 'BANNED FROM THREE COUNTIES', 'AND ONE ALL-YOU-CAN-EAT BUFFET.'],
    stats: { power: 5, speed: 1, toughness: 5, technique: 2 },
    fighter: { hp: 140, speed: 2.55, runSpeed: 4.6, power: 1.3, defense: 0.75, weight: 1.7, guard: 60, superArmor: 4 },
    moves: { punchR: 'mo_hammer', run: 'mo_charge' },
    look: {
      skin: '#d49a6a', hair: { style: 'skinhead', color: '#2a1a10' }, facial: 'beard',
      jacket: { style: 'bomber', color: '#1c1c22', trim: '#0e0e12', lining: '#e07020' }, shirt: '#c8102e',
      pants: { style: 'jeans', color: '#2a3a5a' }, shoes: { color: '#5a1418', sole: '#d8c060' },
      scarf: null, build: 1.5, height: 1.14,
    },
    unlock: null,
  },
  {
    id: 'stig', name: 'LITTLE STIG', nick: 'THE TERRACE RAT', tagline: 'FAST HANDS, FASTER FEET. A BIT FRAGILE.',
    bio: ['MOVED FROM GOTHENBURG FOR THE FOOTBALL.', 'STAYED FOR THE FIGHTING.', 'WEIGHS LESS THAN HIS PARKA.'],
    stats: { power: 2, speed: 5, toughness: 2, technique: 5 },
    fighter: { hp: 85, speed: 3.6, runSpeed: 6.5, power: 0.85, defense: 1.05, weight: 0.85, guard: 34 },
    moves: { punchL: 'stig_flurry', runKick: 'stig_slide' },
    look: {
      skin: '#f0c098', hair: { style: 'mod', color: '#e8d27a' }, facial: 'none',
      jacket: { style: 'parka', color: '#4e5536' }, shirt: '#1f3f8f',
      pants: { style: 'jeans', color: '#7d97bf' }, shoes: { color: '#2d5bb3', sole: '#e8e0d0' },
      scarf: null, build: 0.92, height: 0.94,
    },
    unlock: null,
  },
  {
    id: 'kenny', name: 'KENNY SHOWTIME', nick: 'ULTRAVIOLENCE', tagline: 'MASKED UP, PUMPED UP, NO OFF SWITCH.',
    bio: ['NOBODY HAS SEEN HIS FACE SINCE 1994.', 'BENCHES THE LANDLORD FOR A WARM-UP.', 'EVERY FIGHT IS A SHOW. HE IS THE SHOW.'],
    stats: { power: 5, speed: 3, toughness: 4, technique: 2 },
    fighter: { hp: 115, speed: 3.2, runSpeed: 5.7, power: 1.25, defense: 0.85, weight: 1.35, guard: 45, superArmor: 2 },
    moves: { punchR: 'kenny_bomb', run: 'kenny_spear' }, punchMul: 1.15, kickMul: 0.9, rage: true,
    winLine: 'IT\'S SHOWTIME!', koLines: ['SHOWTIME!', 'NEXT!', 'IS THAT IT?', 'WHO\'S NEXT?!', 'GET UP! I\'M NOT DONE!'],
    look: {
      skin: '#d99a6c', hair: { style: 'skinhead', color: '#2a1a10' }, facial: 'none', muscle: true,
      hat: { style: 'balaclava', color: '#ff5a00', neon: true },   // NEON orange balaclava (glows a little in 3D)
      tattoo: 'clockwork',                                   // A Clockwork Orange on his left arm (3D)
      jacket: { style: 'vest', color: '#ecebe4' }, shirt: '#ecebe4',
      pants: { style: 'cargo', color: '#3e4632' }, shoes: { color: '#f4f4f0', sole: '#ecebe6', stripe: '#141416' },   // white three-stripes, black stripes
      scarf: null, build: 1.2, height: 1.08,
    },
    unlock: null,
  },
  {
    id: 'bigal', name: 'BIG AL', nick: 'THE STEPLADDER', tagline: 'SIX FOOT SIX OF ELBOWS. THE SHIRT COMES OFF.',
    bio: ['TALLEST LAD AT THE ANCHOR.', 'HAS NOT WORN A COAT SINCE 1989.', 'THE SHIRT ALWAYS COMES OFF. ALWAYS.'],
    stats: { power: 3, speed: 4, toughness: 5, technique: 4 },
    // the hardest man at THE ANCHOR: most hp, least damage taken and the strongest guard of anyone (Mo 140 / 0.75 / 60)
    fighter: { hp: 150, speed: 3.25, runSpeed: 5.9, power: 1.0, defense: 0.7, weight: 0.82, guard: 62, reachMul: 1.22 },
    moves: { kick: 'al_stepladder' }, kickMul: 1.1, strip: true,
    winLine: 'ANYONE GOT A JUMPER? IT\'S BALTIC.', koLines: ['ANYONE GOT A JUMPER?', 'IT\'S BALTIC!', 'GET IN!', 'LOOK AT THE STATE OF YOU!', 'SIX FOOT SIX, SON!'],
    look: {
      skin: '#f3d9c8', hair: { style: 'curtains', color: '#5a3a1e' }, facial: 'none',
      jacket: { style: 'shirt', color: '#bd9d66', trim: '#16120e', lining: '#c0281e', pattern: 'nova' }, shirt: '#bd9d66',   // the Burberry check
      pants: { style: 'jeans', color: '#8aa6c8' }, shoes: { color: '#18181b', sole: '#ece8de', stripe: '#f5c518' },   // black three-stripes, yellow stripes
      scarf: null, build: 0.86, height: 1.18, lanky: true, hero: 'bigal',   // hero: realistic menu model (assets/models/hero/bigal.glb)   // lanky: his own long thin v2 build (l_jacket / l_bare)
    },
    unlock: null,
  },
  {
    id: 'vic', name: 'FAT VIC', nick: 'THE PYTHON', tagline: 'STRYPGREPP SPECIALIST. ONCE HE HAS YOUR THROAT, IT IS OVER.',
    bio: ['THIRTY STONE OF TERRACE LOVE.', 'NOBODY HAS EVER GOT OUT OF HIS GRIP.', 'HE ALWAYS ASKS THE SAME QUESTION.'],
    stats: { power: 4, speed: 2, toughness: 5, technique: 3 },
    fighter: { hp: 135, speed: 2.7, runSpeed: 4.8, power: 1.1, defense: 0.8, weight: 1.8, guard: 55, superArmor: 3 },
    moves: { runGrab: 'vic_lunge' },
    grab: { range: 1.35, hold: 3.6, any: true, choke: true, tick: 0.45, tickDmg: 3, squeeze: 'vic_tighten', finisher: 'vic_chokeslam', hits: 3 },
    winLine: 'VILL DU DÖ ELLER?',
    look: {
      // terrace casual: sage Stone Island overshirt (hood down, chest pockets, compass badge on the left arm),
      // polo, stonewash jeans, blue suede trainers with three orange stripes on a gum sole, a bum bag; shaved head
      skin: '#f2c4a6', hair: { style: 'shaved', color: '#c9a184' }, facial: 'none',
      jacket: { style: 'overshirt', color: '#a3ad97', trim: '#88937d', lining: '#a3ad97', hood: 'down', pockets: true }, shirt: '#f4f1e8',
      badge: { base: '#141416', mark: '#c8d43a' },
      hero: 'vic',                                           // realistic menu model (assets/models/hero/vic.glb)
      pants: { style: 'jeans', color: '#7d97bf' }, shoes: { color: '#2d5bb3', sole: '#b5793a', stripe: '#f07a1a' },
      bag: true, scarf: null, build: 1.65, height: 1.08,
    },
    unlock: null,
  },
  {
    id: 'oldboy', name: 'THE OLD BOY', nick: 'GRANDAD', tagline: 'SEEN IT ALL SINCE THE SEVENTIES. HEADBUTTS FIRST.',
    bio: ['STOOD ON THE NORTH BANK IN 1974.', 'STILL HAS THE SCAR.', 'STILL HAS THE BOOTS.'],
    stats: { power: 4, speed: 2, toughness: 4, technique: 3 },
    fighter: { hp: 115, speed: 2.9, runSpeed: 5.0, power: 1.15, defense: 0.85, weight: 1.2, guard: 50 },
    moves: { punchR: 'old_headbutt' },
    look: {
      skin: '#e2a97a', hair: { style: 'shaved', color: '#9a9a9a' }, facial: 'tache',
      hat: { style: 'cap', color: '#6a5a40' },
      jacket: { style: 'harrington', color: '#b5a98a', trim: '#8a7e62', lining: '#c8102e' }, shirt: '#f0ece0',
      pants: { style: 'cargo', color: '#4a4030' }, shoes: { color: '#5a1418', sole: '#d8c060' },
      scarf: null, build: 1.15, height: 1.0,
    },
    unlock: { completed: true },
  },
];

export function characterById(id) { return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]; }

export function isCharacterUnlocked(c, data) {
  if (!c.unlock) return true;
  if (c.unlock.completed) return !!data.completed;
  if (c.unlock.level) return (data.unlocked || 1) >= c.unlock.level;
  return true;
}
