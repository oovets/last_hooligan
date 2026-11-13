// The story is about YOUR club (picked on FIRM SETUP, src/content/clubs.js; AIK until you pick) and two real rivals:
//   HOME  = your club (was the made-up "Nordhamn Athletic", The Anchors, The Anchorage, The Anchor Crew)
//   RIVAL = the derby enemy (was the made-up "Portside City")
//   AWAY  = the away firm that turns up everywhere (was the made-up "Vargby Wanderers")
// The two rival firms never work together: each wants to be the one who does you.
//
// rivalClub() / awayClub() -> CLUB objects; rivalTag(club) -> the short name used in enemy names ('DIF LAD').
// The level/boss text was written with the old names; the font's text filter (installed here) swaps them for the
// real ones as it's drawn (and world.addProp runs signs/tickers through it), so the story follows whichever club you picked without touching every line.
import { clubById, currentClub } from './clubs.js';
import { setTextFilter } from '../engine/font.js';

const PAIRS = {            // your club -> [derby rival, away firm]
  aik: ['dif', 'bajen'],
  dif: ['aik', 'bajen'],
  bajen: ['dif', 'aik'],
  blavitt: ['aik', 'mff'],
  mff: ['hbg', 'blavitt'],
  hbg: ['mff', 'blavitt'],
  peking: ['blavitt', 'aik'],
};
const TAGS = { blavitt: 'BLÅVITT', peking: 'PEKING', bajen: 'BAJEN' };

export const rivalTag = club => TAGS[club.id] || club.short;
const pair = () => PAIRS[currentClub().id] || PAIRS.aik;
export const rivalClub = () => clubById(pair()[0]);
export const awayClub = () => clubById(pair()[1]);

// ---- the text filter: old made-up names -> the real clubs (longest first, so "PORTSIDE CITY" isn't half-replaced)
const OLD = /\bNORDHAMN ATHLETIC\b|\b(?:THE )?ANCHOR CREW\b|\bTHE ANCHORAGE\b|\bNORDHAMN ECHO\b|\bIN NORDHAMN\b|\bTHE ANCHORS\b|\bANCHORS\b|\bNORDHAMN\b|PORTSIDE CITY|VARGBY WANDERERS|PORTSIDE|VARGBY/gi;
const SWAP = {
  'NORDHAMN ATHLETIC': (H) => H.name,
  'THE ANCHOR CREW': (H) => H.firm,
  'ANCHOR CREW': (H) => H.firm,
  'THE ANCHORAGE': (H) => H.venue,
  'NORDHAMN ECHO': (H) => H.city + ' ECHO',      // the local paper
  'IN NORDHAMN': (H) => 'IN ' + H.city,          // a place: MATCHDAY IN SOLNA (elsewhere the club: WE ARE AIK!)
  'THE ANCHORS': (H) => H.nick,
  'ANCHORS': (H) => rivalTag(H),
  'NORDHAMN': (H) => rivalTag(H),
  'PORTSIDE CITY': (H, R) => R.name,
  'VARGBY WANDERERS': (H, R, A) => A.name,
  'PORTSIDE': (H, R) => rivalTag(R),
  'VARGBY': (H, R, A) => rivalTag(A),
};
const cache = new Map();
let cacheFor = '';
export function swapRivalNames(text) {
  const s = String(text);
  if (s.length < 6 || !/portside|vargby|nordhamn|anchor/i.test(s)) return s;
  const key = currentClub().id;
  if (key !== cacheFor) { cache.clear(); cacheFor = key; }
  let out = cache.get(s);
  if (out === undefined) {
    const H = currentClub(), R = rivalClub(), A = awayClub();
    out = s.replace(OLD, m => SWAP[m.toUpperCase()](H, R, A));
    if (cache.size > 2000) cache.clear();
    cache.set(s, out);
  }
  return out;
}
setTextFilter(swapRivalNames);
