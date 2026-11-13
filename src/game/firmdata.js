// THE FIRM between matches (phase D, docs/DESIGN-V2.md): the persistent firm, its lads and the consequences of trips.
// Pure data + rules (no drawing): the pub hub (ui/hub.js) and the fights (game/firm.js) use it, and
// scripts/test_firmloop.mjs tests it headless.
//
// save.data.firm = {
//   v, day, rep, heat, nextId,
//   lads:  [LAD], squad: [ladId...] (who travels next), pool: [LAD] (recruits at the bar), poolDay,
//   log:   [line...] (newest first), report: { title, lines } | null (shown when you get back to the pub),
//   event: EVENT id | null (pending event card), trained: { ladId: day }
// }
// LAD = { id, name, nick, char (playable character id -> signature moves) | null, look, stats: { fists, kicks, tough,
//         speed, nerve, loyalty } (1..10), traits: [id], xp, lvl, kos, trips, injury (days out), banned (days),
//         mood (0..100), bonds: { ladId: 0..10 }, hired (day) }

import { save } from '../save.js';
import { characterById } from '../content/characters.js';

export const STATS = ['fists', 'kicks', 'tough', 'speed', 'nerve', 'loyalty'];
export const STAT_NAME = { fists: 'FISTS', kicks: 'KICKS', tough: 'TOUGH', speed: 'SPEED', nerve: 'NERVE', loyalty: 'LOYAL' };
export const MAX_ROSTER = 8;
export const HOME = { a: '#c8102e', b: '#f4f1e8' };      // Nordhamn Athletic: red & white

export const TRAITS = {
  hothead: { name: 'HOTHEAD', desc: 'GOES IN BEFORE THE ORDER. HITS HARDER, LEAVES HIS POST.' },
  biglad: { name: 'BIG LAD', desc: 'HARD TO PUT DOWN. SLOW.' },
  singer: { name: 'SINGER', desc: 'KEEPS THE LADS GOING. BIGGER SING-UPS.' },
  lookout: { name: 'LOOKOUT', desc: 'SPOTS TROUBLE EARLY. PILES IN FROM FURTHER.' },
  lightweight: { name: 'LIGHTWEIGHT', desc: 'TWO PINTS AND HE IS ANYONE\'S. LESS NERVE.' },
  oldschool: { name: 'OLD SCHOOL', desc: 'SEEN IT ALL. MATES NEAR HIM DON\'T PANIC.' },
  grafter: { name: 'GRAFTER', desc: 'TRAINS FOR HALF PRICE.' },
  liability: { name: 'LIABILITY', desc: 'HITS HARDER. THE OLD BILL KNOW HIS FACE (+HEAT).' },
};
const TRAIT_IDS = Object.keys(TRAITS);

// the three founders: the other playable characters, with their signature moves
const FOUNDERS = {
  mo: { nick: 'THE FRIDGE', stats: { fists: 7, kicks: 3, tough: 8, speed: 3, nerve: 7, loyalty: 8 }, traits: ['biglad'] },
  stig: { nick: 'THE TERRACE RAT', stats: { fists: 6, kicks: 4, tough: 3, speed: 8, nerve: 5, loyalty: 6 }, traits: ['hothead'] },
  bigal: { nick: 'THE STEPLADDER', stats: { fists: 5, kicks: 7, tough: 10, speed: 6, nerve: 7, loyalty: 8 }, traits: ['singer'] },
  kenny: { nick: 'ULTRAVIOLENCE', stats: { fists: 8, kicks: 4, tough: 7, speed: 5, nerve: 8, loyalty: 5 }, traits: ['liability'] },
  vic: { nick: 'THE PYTHON', stats: { fists: 6, kicks: 3, tough: 7, speed: 3, nerve: 6, loyalty: 7 }, traits: ['biglad'] },
  hooligan: { nick: 'DEZ', stats: { fists: 6, kicks: 6, tough: 5, speed: 5, nerve: 6, loyalty: 8 }, traits: ['oldschool'] },
};

// ------------------------------------------------------------------ randomness (seedable for tests)
let seed = 0;
export function setSeed(s) { seed = s >>> 0; }
function rnd() {
  if (!seed) return Math.random();
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------ names & looks (fictional)
const FIRST = ['GAZ', 'BAZ', 'DAZ', 'KEV', 'TEL', 'MICK', 'SPUD', 'NOBBY', 'LEE', 'DEANO', 'STU', 'ROB', 'JONNO', 'BENNO', 'MAGS', 'PELLE', 'JOCKE', 'NIKLAS', 'OLLE', 'KALLE', 'SHAZ', 'TRACE', 'BEV', 'JUNE'];
const NICK = ['THE BRICK', 'SPANNER', 'TWO DINNERS', 'THE ACCOUNTANT', 'CHOPPER', 'PIE', 'THE VICAR', 'BIG H', 'LITTLE H', 'DOORMAT', 'THE POSTMAN', 'ROADRUNNER', 'MOUSE', 'THE BEAR', 'NO NECK', 'DIESEL', 'SMUDGE', 'TOPPER'];
const SKINS = ['#e2a97a', '#d49a6a', '#f0c098', '#b87a50', '#8a5636', '#5e3a24', '#f4d0b0'];
const HAIRC = ['#141016', '#3a2717', '#6a4a2a', '#b4521c', '#e8d27a', '#5a5a5a'];
const JACKETS = [
  { style: 'harrington', color: '#1d2742', lining: '#c8102e' }, { style: 'harrington', color: '#c8b48a', lining: '#a01818' },
  { style: 'bomber', color: '#1a1a20', lining: '#e07020' }, { style: 'track', color: '#c8102e', trim: '#f4f1e8' },
  { style: 'parka', color: '#4a5a3a' }, { style: 'tee', color: '#f4f1e8' }, { style: 'track', color: '#1a1a22', trim: '#c8102e' },
];
function randomLook(female, big) {
  const hair = female ? pick(['ponytail', 'long', 'bob', 'crop', 'curtains']) : pick(['crop', 'shaved', 'skinhead', 'curtains', 'mod', 'spiky', 'flattop']);
  return {
    skin: pick(SKINS), female: !!female,
    hair: { style: hair, color: pick(HAIRC) },
    facial: female ? 'none' : pick(['none', 'stubble', 'stubble', 'beard', 'tache']),
    hat: rnd() < 0.2 ? { style: pick(['cap', 'beanie', 'bucket']), color: pick(['#c8102e', '#1d2742', '#e8e0cc']) } : null,
    shades: rnd() < 0.12,
    jacket: { ...pick(JACKETS) },
    shirt: pick(['#f4f1e8', '#c8102e', '#e8d8a8']),
    pants: { style: 'jeans', color: pick(['#2a3346', '#34507a', '#1e1e26', '#6a6050']) },
    shoes: { color: pick(['#f2f2ee', '#1a1a1a', '#c8102e']), sole: '#b8a070' },
    scarf: { a: HOME.a, b: HOME.b },
    build: big ? 1.4 + rnd() * 0.15 : 0.95 + rnd() * 0.2, height: 0.97 + rnd() * 0.08,
  };
}

// ------------------------------------------------------------------ creation
function newId(F) { return 'lad' + (F.nextId++); }

export function founder(F, charId) {
  const ch = characterById(charId);
  const fd = FOUNDERS[charId] || FOUNDERS.hooligan;
  return {
    id: newId(F), name: ch.name, nick: fd.nick, char: charId, look: ch.look || null,
    stats: { ...fd.stats }, traits: [...fd.traits], xp: 0, lvl: 1, kos: 0, trips: 0, injury: 0, banned: 0,
    mood: 75, bonds: {}, hired: F.day,
  };
}

// a recruit; tier 0..3 (better with reputation)
export function recruit(F, tier = 0) {
  const female = rnd() < 0.25;
  const big = !female && rnd() < 0.25;
  const base = 2 + tier;
  const stats = {};
  for (const s of STATS) stats[s] = clamp(base + Math.floor(rnd() * 4) - 1, 1, 10);
  if (big) { stats.tough = clamp(stats.tough + 2, 1, 10); stats.speed = clamp(stats.speed - 1, 1, 10); }
  const traits = [];
  if (big) traits.push('biglad');
  const n = rnd() < 0.5 ? 1 : (traits.length ? 0 : 1);
  for (let i = 0; i < n; i++) { const t = pick(TRAIT_IDS.filter(x => !traits.includes(x) && x !== 'biglad')); if (t) traits.push(t); }
  // names and nicknames nobody in the firm (or at the bar) already has
  const used = new Set([...F.lads, ...(F.pool || [])].flatMap(l => [l.name, l.nick]));
  const names = FIRST.filter(n2 => female === ['SHAZ', 'TRACE', 'BEV', 'JUNE'].includes(n2));
  const name = pick(names.filter(n2 => !used.has(n2)).length ? names.filter(n2 => !used.has(n2)) : names);
  const nick = pick(NICK.filter(n2 => !used.has(n2)).length ? NICK.filter(n2 => !used.has(n2)) : NICK);
  const lad = {
    id: newId(F), name, nick, char: null, look: randomLook(female, big),
    stats, traits, xp: 0, lvl: 1, kos: 0, trips: 0, injury: 0, banned: 0, mood: 65, bonds: {}, hired: F.day, tier,
  };
  lad.cost = recruitCost(lad);
  return lad;
}

export function statSum(l) { return STATS.reduce((s, k) => s + l.stats[k], 0); }
export function recruitCost(l) { return 20 + Math.max(0, statSum(l) - 18) * 6; }
export function trainCost(l, stat) { return Math.round(10 + l.stats[stat] * 8 * (l.traits.includes('grafter') ? 0.5 : 1)); }
export function squadSize(F) { return F.rep >= 60 ? 4 : 3; }
export function recruitTier(F) { return F.rep >= 120 ? 3 : F.rep >= 60 ? 2 : F.rep >= 20 ? 1 : 0; }

export function newFirm(playerChar = 'hooligan') {
  const F = { v: 1, day: 1, rep: 0, heat: 0, nextId: 1, lads: [], squad: [], pool: [], poolDay: 0, log: [], report: null, event: null, trained: {} };
  for (const id of ['mo', 'stig', 'kenny', 'bigal', 'hooligan'].filter(c => c !== playerChar).slice(0, 4)) F.lads.push(founder(F, id));
  F.squad = F.lads.slice(0, 3).map(l => l.id);   // four founders, three on the coach
  refreshPool(F);
  F.log.unshift('DAY 1. THE ANCHOR. THE FIRM IS FORMED.');
  return F;
}

// save.data.firm, created on first use
export function getFirm(playerChar) {
  if (!save.data.firm) { save.data.firm = newFirm(playerChar || save.data.character || 'hooligan'); save.write(); }
  // save v4: Big Al walks into an existing firm's pub (unless he's the one you play or the roster is full)
  if (save.data.addBigAl) {
    const F = save.data.firm;
    if (!F.lads.some(l => l.char === 'bigal') && (playerChar || save.data.character) !== 'bigal' && F.lads.length < MAX_ROSTER) {
      F.lads.push(founder(F, 'bigal'));
      F.log && F.log.unshift(`DAY ${F.day}. BIG AL WALKED IN, ORDERED A LAGER AND TOOK HIS SHIRT OFF.`);
    }
    delete save.data.addBigAl; save.write();
  }
  return save.data.firm;
}

export function refreshPool(F) {
  const tier = recruitTier(F);
  F.pool = [];
  for (let i = 0; i < 4; i++) F.pool.push(recruit(F, Math.max(0, tier - (i === 3 ? 1 : 0))));
  F.poolDay = F.day;
}

// ------------------------------------------------------------------ queries
export const ladById = (F, id) => F.lads.find(l => l.id === id) || null;
export const available = l => l.injury <= 0 && l.banned <= 0;
export function squadLads(F) { return F.squad.map(id => ladById(F, id)).filter(l => l && available(l)).slice(0, squadSize(F)); }

// keep the squad valid: only available lads, top up from the bench
export function fixSquad(F) {
  const max = squadSize(F);
  F.squad = F.squad.filter(id => { const l = ladById(F, id); return l && available(l); }).slice(0, max);
  for (const l of F.lads) { if (F.squad.length >= max) break; if (available(l) && !F.squad.includes(l.id)) F.squad.push(l.id); }
}

export function toggleSquad(F, id) {
  const l = ladById(F, id);
  if (!l) return 'NOBODY BY THAT NAME';
  if (F.squad.includes(id)) { F.squad = F.squad.filter(x => x !== id); return `${l.name} STAYS AT THE PUB`; }
  if (!available(l)) return l.injury > 0 ? `${l.name} IS INJURED (${l.injury} DAYS)` : `${l.name} IS BANNED (${l.banned} DAYS)`;
  if (F.squad.length >= squadSize(F)) return `ONLY ${squadSize(F)} TRAVEL. DROP SOMEONE FIRST`;
  F.squad.push(id);
  return `${l.name} IS ON THE COACH`;
}

// ------------------------------------------------------------------ actions at the pub (return a message)
export function hire(F, poolIdx) {
  const c = F.pool[poolIdx];
  if (!c) return { ok: false, msg: 'NOBODY THERE' };
  if (F.lads.length >= MAX_ROSTER) return { ok: false, msg: `THE FIRM IS FULL (${MAX_ROSTER}). LET SOMEONE GO FIRST` };
  if ((save.data.cash || 0) < c.cost) return { ok: false, msg: `NEED £${c.cost} FOR HIS ROUNDS` };
  save.data.cash -= c.cost;
  F.pool.splice(poolIdx, 1);
  delete c.cost; delete c.tier;
  F.lads.push(c);
  if (F.squad.length < squadSize(F)) F.squad.push(c.id);
  F.log.unshift(`DAY ${F.day}: ${c.name} '${c.nick}' JOINS THE FIRM.`);
  return { ok: true, msg: `${c.name} IS IN!` };
}

export function sack(F, id) {
  const l = ladById(F, id);
  if (!l) return 'NOBODY BY THAT NAME';
  if (F.lads.length <= 1) return 'YOU CAN\'T BE A FIRM OF ONE';
  F.lads = F.lads.filter(x => x !== l);
  F.squad = F.squad.filter(x => x !== id);
  for (const o of F.lads) delete o.bonds[id];
  F.log.unshift(`DAY ${F.day}: ${l.name} WAS SHOWN THE DOOR.`);
  return `${l.name} HAS LEFT THE FIRM`;
}

export function train(F, id, stat) {
  const l = ladById(F, id);
  if (!l) return { ok: false, msg: 'NOBODY BY THAT NAME' };
  if (l.injury > 0) return { ok: false, msg: `${l.name} IS INJURED` };
  if (l.stats[stat] >= 10) return { ok: false, msg: `${l.name} CAN'T GET ANY BETTER AT THAT` };
  if ((F.trained || {})[id] === F.day) return { ok: false, msg: `${l.name} HAS TRAINED TODAY. COME BACK TOMORROW` };
  const cost = trainCost(l, stat);
  if ((save.data.cash || 0) < cost) return { ok: false, msg: `NEED £${cost} FOR THE GYM` };
  save.data.cash -= cost;
  l.stats[stat]++;
  (F.trained ||= {})[id] = F.day;
  l.mood = clamp(l.mood + 3, 0, 100);
  return { ok: true, msg: `${l.name}: ${STAT_NAME[stat]} UP TO ${l.stats[stat]}` };
}

export function physio(F, id) {
  const l = ladById(F, id);
  if (!l || l.injury <= 0) return { ok: false, msg: 'NOTHING TO FIX' };
  const cost = 25;
  if ((save.data.cash || 0) < cost) return { ok: false, msg: `PHYSIO COSTS £${cost}` };
  save.data.cash -= cost;
  l.injury--;
  return { ok: true, msg: l.injury ? `${l.name}: ${l.injury} DAYS LEFT` : `${l.name} IS FIT AGAIN` };
}

// a day passes (a trip, or "CALL IT A NIGHT"): injuries heal, bans run out, heat cools, new faces at the bar
export function nextDay(F, lines = []) {
  F.day++;
  F.heat = Math.max(0, F.heat - 8);
  for (const l of F.lads) {
    if (l.injury > 0) { l.injury--; if (!l.injury) lines.push(`${l.name} IS FIT AGAIN.`); }
    if (l.banned > 0) { l.banned--; if (!l.banned) lines.push(`${l.name}'S BAN IS OVER.`); }
    l.mood = clamp(l.mood + (l.mood < 60 ? 2 : -1), 0, 100);
  }
  if (F.day - F.poolDay >= 1) refreshPool(F);
  fixSquad(F);
  return lines;
}

// ------------------------------------------------------------------ fight -> fighter numbers
// Converts a lad's stats/traits into Fighter parameters and AI tuning (used by game/firm.js).
export function fighterParams(l) {
  const s = l.stats, T = new Set(l.traits);
  const p = {
    hp: Math.round(66 + s.tough * 7 + (T.has('biglad') ? 28 : 0) - (T.has('lightweight') ? 10 : 0)),
    speed: 2.5 + s.speed * 0.09 - (T.has('biglad') ? 0.25 : 0),
    runSpeed: 4.4 + s.speed * 0.14 - (T.has('biglad') ? 0.4 : 0),
    power: (0.55 + s.fists * 0.035) * (T.has('hothead') || T.has('liability') ? 1.1 : 1),
    kickMul: (s.kicks - 5) * 0.05,
    guard: 22 + s.tough * 3,
    defense: 1.05 - s.tough * 0.02,
    superArmor: T.has('biglad') ? 2 : 0,
    weight: T.has('biglad') ? 1.5 : 1,
    nerve: clamp(45 + s.nerve * 5.5 - (T.has('lightweight') ? 12 : 0), 20, 100),
    nerveMul: 1.45 - s.nerve * 0.07,        // how fast nerve drains
  };
  // AI: style from the best stat
  const best = ['fists', 'kicks', 'tough', 'speed'].sort((a, b) => s[b] - s[a])[0];
  const styles = {
    fists: { attacks: [['jab', 3], ['cross', 3], ['hook', 2], ['uppercut', 1]], comboLen: [2, 3] },
    kicks: { attacks: [['kick', 3], ['roundhouse', 2], ['jab', 1], ['lowKick', 1]], comboLen: [1, 2] },
    tough: { attacks: [['haymaker', 2], ['cross', 2], ['jab', 1], ['bodySlam', 1]], comboLen: [1, 2], grabChance: 0.08 },
    speed: { attacks: [['jab', 4], ['lowKick', 2], ['cross', 1]], comboLen: [2, 4], dodgeChance: 0.14 },
  };
  p.ai = {
    ...styles[best],
    aggression: 0.45 + s.fists * 0.02 + (T.has('hothead') ? 0.15 : 0),
    reaction: 0.38 - s.speed * 0.014,
    blockChance: 0.06 + s.tough * 0.015,
    dodgeChance: (styles[best].dodgeChance || 0.04) + s.speed * 0.006,
  };
  p.engage = T.has('lookout') ? 6.5 : 4.5;
  return p;
}

// ------------------------------------------------------------------ after a trip
// Build the trip result from a finished (or lost) level World.
export function resultFromWorld(world, won, rank) {
  const L = world.level;
  return {
    levelId: L.id, levelName: L.name, won, rank: rank || null, tour: !!L.tour,
    kos: (world.stats && world.stats.kos) || 0, routs: (world.stats && world.stats.routs) || 0,
    bossDown: !!(world.boss && !world.boss.alive),
    lads: world.firm ? world.firm.report() : [],
  };
}

// result = { levelId, levelName, won, rank, kos, routs, bossDown, cash, tour, lads: [{ id, kos, downs, out }] }
export function applyTrip(F, result) {
  const lines = [];
  const squadIds = new Set(result.lads.map(r => r.id));
  // the trip takes the day: injuries/bans tick, heat cools, new faces; then the new consequences land
  nextDay(F, lines);
  // reputation
  let dRep = result.won ? 10 + ({ S: 10, A: 6, B: 3 }[result.rank] || 0) + (result.bossDown ? 5 : 0) : -5;
  dRep += Math.min(10, Math.floor((result.routs || 0) / 2));
  // an away day on the Football Tour: taking it to a real firm on their own patch counts double (first win there: +15 more)
  if (result.tour && result.won) {
    const done = (F.tourWins || (F.tourWins = {}));
    dRep = dRep * 2 + (done[result.levelId] ? 0 : 15);
    done[result.levelId] = (done[result.levelId] || 0) + 1;
  } else if (result.tour) dRep -= 5;
  F.rep = Math.max(0, F.rep + dRep);
  lines.push(`REPUTATION ${dRep >= 0 ? '+' : ''}${dRep} (NOW ${F.rep})`);
  // heat
  let dHeat = 6 + Math.round((result.kos || 0) * 0.4 + (result.routs || 0) * 0.5) + (result.bossDown ? 6 : 0);
  for (const r of result.lads) { const l = ladById(F, r.id); if (l && l.traits.includes('liability')) dHeat += 3; }
  F.heat = clamp(F.heat + dHeat, 0, 100);
  lines.push(`HEAT +${dHeat} (NOW ${F.heat})`);
  // the lads who went
  for (const r of result.lads) {
    const l = ladById(F, r.id);
    if (!l) continue;
    l.trips++; l.kos += r.kos || 0;
    l.xp += (r.kos || 0) * 10 + (result.won ? 20 : 5);
    while (l.xp >= l.lvl * 100) {
      l.xp -= l.lvl * 100; l.lvl++;
      const st = ['fists', 'kicks', 'tough', 'speed', 'nerve'].filter(k => l.stats[k] < 10).sort((a, b) => l.stats[b] - l.stats[a])[0];
      if (st) { l.stats[st]++; lines.push(`${l.name} IS GETTING SHARPER: ${STAT_NAME[st]} ${l.stats[st]}.`); }
    }
    let inj = r.out ? 2 : 0;
    for (let k = 0; k < (r.downs || 0); k++) if (rnd() < 0.3) inj++;
    if (l.traits.includes('biglad')) inj = Math.max(0, inj - 1);
    if (inj > 0) { l.injury = Math.max(l.injury, inj); lines.push(`${l.name} IS INJURED: OUT FOR ${inj} DAY${inj > 1 ? 'S' : ''}.`); }
    l.mood = clamp(l.mood + (result.won ? 8 : -6) + (r.kos >= 3 ? 4 : 0), 0, 100);
    if (r.kos) lines.push(`${l.name}: ${r.kos} KO${r.kos > 1 ? 'S' : ''}.`);
  }
  // fighting side by side builds bonds
  const ids = [...squadIds];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ladById(F, ids[i]), b = ladById(F, ids[j]);
    if (!a || !b) continue;
    const v = Math.min(10, (a.bonds[b.id] || 0) + 1);
    a.bonds[b.id] = b.bonds[a.id] = v;
    if (v === 5) lines.push(`${a.name} AND ${b.name} ARE PROPER MATES NOW.`);
  }
  // left at the pub
  for (const l of F.lads) if (!squadIds.has(l.id) && available(l)) l.mood = clamp(l.mood - 9, 0, 100);
  // walkouts: unhappy and disloyal
  for (const l of [...F.lads]) {
    if (l.mood < 20 && l.stats.loyalty < 5 && rnd() < 0.5 && F.lads.length > 1) {
      F.lads = F.lads.filter(x => x !== l); F.squad = F.squad.filter(x => x !== l.id);
      lines.push(`${l.name} HAS JOINED ANOTHER FIRM. TRAITOR.`);
    }
  }
  // the Old Bill
  if (F.heat >= 85) {
    const lost = Math.round((save.data.cash || 0) * 0.25);
    save.data.cash = Math.max(0, (save.data.cash || 0) - lost);
    F.heat -= 30;
    lines.push(`RAID ON THE ANCHOR! THE OLD BILL TOOK £${lost}.`);
  } else if (F.heat >= 60) {
    const cands = result.lads.map(r => ladById(F, r.id)).filter(Boolean);
    if (cands.length) { const l = pick(cands); l.banned = 2; lines.push(`BANNING ORDER: ${l.name} CAN'T TRAVEL FOR 2 DAYS.`); }
  }
  fixSquad(F);
  F.report = { title: `${result.won ? 'BACK AT THE ANCHOR' : 'LICKING YOUR WOUNDS'}: ${result.levelName || ''}`, lines };
  F.log.unshift(`DAY ${F.day}: ${result.levelName || 'A TRIP'} - ${result.won ? 'WON' : 'LOST'}.`);
  if (F.log.length > 30) F.log.length = 30;
  // an event card waiting at the pub (about every other time)
  if (!F.event && rnd() < 0.6) F.event = drawEvent(F);
  return lines;
}

// ------------------------------------------------------------------ event cards
// effect(F) returns the line shown afterwards. cond(F) decides if the card can be drawn.
export const EVENTS = {
  mum: {
    title: "SOMEBODY'S MUM",
    text: lad => `${lad.name}'S MUM HAS RUNG THE PUB. SHE WANTS HIM HOME BEFORE TEN ON MATCH DAYS.`,
    cond: F => F.lads.some(available),
    options: [
      { label: 'LET HIM GO', effect: (F, lad) => { lad.banned = Math.max(lad.banned, 1); lad.mood = clamp(lad.mood + 10, 0, 100); lad.stats.loyalty = clamp(lad.stats.loyalty + 1, 1, 10); fixSquad(F); return `${lad.name} MISSES THE NEXT TRIP. HE WON'T FORGET IT (+LOYALTY).`; } },
      { label: 'HE STAYS', effect: (F, lad) => { lad.mood = clamp(lad.mood - 15, 0, 100); return `${lad.name} IS SULKING.`; } },
    ],
  },
  flag: {
    title: 'THE FLAG',
    text: () => "SOMEBODY'S NICKED THE FIRM'S FLAG OFF THE ANCHOR'S WALL. PORTSIDE, PROBABLY.",
    cond: () => true,
    options: [
      { label: 'GO AND GET IT BACK', effect: F => { F.rep += 5; F.heat = clamp(F.heat + 10, 0, 100); return 'GOT IT BACK. AND THEIR FLAG. +5 REP, +10 HEAT.'; } },
      { label: 'MAKE A NEW ONE (£40)', effect: F => { save.data.cash = Math.max(0, (save.data.cash || 0) - 40); return 'NEW FLAG. BIGGER. -£40.'; } },
    ],
  },
  paper: {
    title: 'THE NORDHAMN ECHO',
    text: () => 'A REPORTER FROM THE LOCAL RAG IS AT THE BAR. SHE WANTS A QUOTE ABOUT "THE FIRM".',
    cond: F => F.rep >= 10,
    options: [
      { label: 'MOUTH OFF', effect: F => { F.rep += 8; F.heat = clamp(F.heat + 12, 0, 100); return 'FRONT PAGE. +8 REP, +12 HEAT.'; } },
      { label: 'NO COMMENT', effect: F => { F.heat = Math.max(0, F.heat - 6); return 'NOTHING TO SEE HERE. -6 HEAT.'; } },
    ],
  },
  fallout: {
    title: 'A FALLING OUT',
    text: (lad, lad2) => `${lad.name} AND ${lad2.name} HAVE FALLEN OUT OVER A BET ON THE DOGS.`,
    cond: F => F.lads.length >= 2,
    two: true,
    options: [
      { label: 'SORT IT (£20 ROUND)', effect: (F, a, b) => { save.data.cash = Math.max(0, (save.data.cash || 0) - 20); a.mood = clamp(a.mood + 5, 0, 100); b.mood = clamp(b.mood + 5, 0, 100); a.bonds[b.id] = b.bonds[a.id] = Math.min(10, (a.bonds[b.id] || 0) + 1); return 'SHAKE ON IT. -£20.'; } },
      { label: 'LET THEM SCRAP IT OUT', effect: (F, a, b) => { const l = rnd() < 0.5 ? a : b; l.injury = Math.max(l.injury, 1); a.bonds[b.id] = b.bonds[a.id] = 0; fixSquad(F); return `${l.name} CAME OFF WORST. OUT FOR A DAY.`; } },
    ],
  },
  whip: {
    title: 'A WHIP-ROUND',
    text: () => 'THE REGULARS HAD A WHIP-ROUND FOR "THE LADS". RON COUNTED IT TWICE.',
    cond: F => F.rep >= 5,
    options: [{ label: 'CHEERS!', effect: () => { const n = 30 + Math.floor(rnd() * 31); save.data.cash = (save.data.cash || 0) + n; return `+£${n}.`; } }],
  },
  copper: {
    title: 'A COPPER AT THE BAR',
    text: () => 'A PLAIN-CLOTHES COPPER IS ASKING QUESTIONS. HIS SHOES GIVE HIM AWAY.',
    cond: F => F.heat >= 30,
    options: [
      { label: 'BUY HIM A PINT (£20)', effect: F => { save.data.cash = Math.max(0, (save.data.cash || 0) - 20); F.heat = Math.max(0, F.heat - 15); return 'HE FORGETS WHY HE CAME. -15 HEAT.'; } },
      { label: 'TELL HIM WHERE TO GO', effect: F => { F.heat = clamp(F.heat + 10, 0, 100); F.rep += 4; return 'THE BAR CHEERS. +4 REP, +10 HEAT.'; } },
    ],
  },
  newface: {
    title: 'A NEW FACE',
    text: () => 'A LAD FROM THE ESTATE HAS BEEN HANGING ROUND THE ANCHOR ALL WEEK. HE WANTS IN.',
    cond: F => F.lads.length < MAX_ROSTER,
    options: [
      { label: 'GIVE HIM A GO', effect: F => { const r = recruit(F, 0); delete r.cost; delete r.tier; F.lads.push(r); return `${r.name} '${r.nick}' JOINS. FOR FREE.`; } },
      { label: 'NOT TODAY, SON', effect: () => 'HE TRUDGES OFF.' },
    ],
  },
  tab: {
    title: "RON'S TAB",
    text: () => "RON WANTS THE FIRM'S BAR TAB SETTLED. IT IS... A LOT.",
    cond: () => true,
    options: [
      { label: 'PAY UP (£35)', effect: () => { save.data.cash = Math.max(0, (save.data.cash || 0) - 35); return 'RON SMILES FOR THE FIRST TIME SINCE 1986.'; } },
      { label: 'NEXT WEEK, RON', effect: F => { F.rep = Math.max(0, F.rep - 3); for (const l of F.lads) l.mood = clamp(l.mood - 4, 0, 100); return 'RON IS NOT HAPPY. NEITHER ARE THE LADS. -3 REP.'; } },
    ],
  },
};

export function drawEvent(F) {
  const ids = Object.keys(EVENTS).filter(k => EVENTS[k].cond(F));
  if (!ids.length) return null;
  const id = pick(ids);
  const ladsOk = F.lads.filter(available);
  const a = pick(ladsOk.length ? ladsOk : F.lads);
  const b = pick(F.lads.filter(l => l !== a)) || a;
  return { id, a: a && a.id, b: b && b.id };
}

export function eventCard(F) {
  const e = F.event;
  if (!e) return null;
  const E = EVENTS[e.id];
  if (!E) return null;
  const a = ladById(F, e.a) || F.lads[0], b = ladById(F, e.b) || a;
  if (!a) return null;
  return { title: E.title, text: E.text(a, b), options: E.options.map(o => o.label), resolve: i => { const msg = E.options[i].effect(F, a, b); F.event = null; F.log.unshift(`DAY ${F.day}: ${E.title} - ${msg}`); return msg; } };
}
