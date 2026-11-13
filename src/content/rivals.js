// The story's two rival firms are real clubs, picked from the club YOUR firm follows (src/content/clubs.js):
//   RIVAL = the derby enemy (was the made-up "Portside City", the blues across the river)
//   AWAY  = the away firm that turns up everywhere (was the made-up "Vargby Wanderers", yellow and black)
// Nordhamn (the game's own club) gets DIF and AIK: the same blue and the same yellow-and-black as before.
//
// rivalClub() / awayClub() -> CLUB objects; rivalTag(club) -> the short name used in enemy names ('DIF LAD').
// The level/boss text was written with the old names; the font's text filter (installed here) swaps them for the
// real ones as it's drawn, so the story follows whichever club you picked without touching every line.
import { clubById, currentClub } from './clubs.js';
import { setTextFilter } from '../engine/font.js';

const PAIRS = {            // your club -> [derby rival, away firm]
  nordhamn: ['dif', 'aik'],
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
const pair = () => PAIRS[currentClub().id] || PAIRS.nordhamn;
export const rivalClub = () => clubById(pair()[0]);
export const awayClub = () => clubById(pair()[1]);

// ---- the text filter: old made-up names -> the real clubs (longest first, so "PORTSIDE CITY" isn't half-replaced)
const OLD = /PORTSIDE CITY|VARGBY WANDERERS|PORTSIDE|VARGBY/gi;
const cache = new Map();
let cacheFor = '';
export function swapRivalNames(text) {
  const s = String(text);
  if (s.length < 6 || !/portside|vargby/i.test(s)) return s;
  const key = currentClub().id;
  if (key !== cacheFor) { cache.clear(); cacheFor = key; }
  let out = cache.get(s);
  if (out === undefined) {
    const R = rivalClub(), A = awayClub();
    out = s.replace(OLD, m => {
      const u = m.toUpperCase();
      return u === 'PORTSIDE CITY' ? R.name : u === 'VARGBY WANDERERS' ? A.name : u === 'PORTSIDE' ? rivalTag(R) : rivalTag(A);
    });
    if (cache.size > 2000) cache.clear();
    cache.set(s, out);
  }
  return out;
}
setTextFilter(swapRivalNames);
