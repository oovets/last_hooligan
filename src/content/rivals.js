// The story is about YOUR club (picked on FIRM SETUP, src/content/clubs.js; AIK until you pick) and two real rivals:
//   HOME  = your club (was the made-up "Nordhamn Athletic", The Anchors, The Anchorage, The Anchor Crew)
//   RIVAL = the derby enemy (was the made-up "Portside City")
//   AWAY  = the away firm that turns up everywhere (was the made-up "Vargby Wanderers")
// The two rival firms never work together: each wants to be the one who does you.
//
// rivalClub() / awayClub() -> CLUB objects; rivalTag(club) -> the short name used in enemy names ('DIF LAD').
// The level/boss text was written with the old names; the font's text filter (installed here) swaps them for the
// real ones as it's drawn (and world.addProp runs signs/tickers through it), so the story follows whichever club you picked without touching every line.
import { clubById, currentClub, clubLogo, whenClubLogo } from './clubs.js';
import { setTextFilter } from '../engine/font.js';
import { HALF_W, HALF_H } from '../engine/constants.js';
import { setEnvTint } from '../engine/envsprites.js';

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
const OLD = /\bNORDHAMN ATHLETIC\b|\b(?:THE )?ANCHOR CREW\b|\bTHE ANCHORAGE\b|\bNORDHAMN ECHO\b|\bIN NORDHAMN\b|\bANCHORS ARMY\b|\bTHE ANCHORS\b|\bANCHORS\b|\bNORDHAMN\b|\bNAFC\b|\bNHA\b|\bN\.A\.|PORTSIDE CITY|VARGBY WANDERERS|PORTSIDE|VARGBY/gi;
const SWAP = {
  'NORDHAMN ATHLETIC': (H) => H.name,
  'THE ANCHOR CREW': (H) => H.firm,
  'ANCHOR CREW': (H) => H.firm,
  'THE ANCHORAGE': (H) => H.venue,
  'NORDHAMN ECHO': (H) => H.city + ' ECHO',      // the local paper
  'IN NORDHAMN': (H) => 'IN ' + H.city,          // a place: MATCHDAY IN SOLNA (elsewhere the club: WE ARE AIK!)
  'ANCHORS ARMY': (H) => H.army || H.short + ' ARMY',   // the supporters' club: BLACK ARMY
  'THE ANCHORS': (H) => H.nick,
  'ANCHORS': (H) => rivalTag(H),
  'NORDHAMN': (H) => rivalTag(H),
  'NAFC': (H) => rivalTag(H),                    // crests, graffiti tags, the pub's plaque
  'NHA': (H) => rivalTag(H),
  'N.A.': (H) => rivalTag(H),
  'PORTSIDE CITY': (H, R) => R.name,
  'VARGBY WANDERERS': (H, R, A) => A.name,
  'PORTSIDE': (H, R) => rivalTag(R),
  'VARGBY': (H, R, A) => rivalTag(A),
};
const cache = new Map();
let cacheFor = '';
export function swapRivalNames(text) {
  const s = String(text);
  if (s.length < 3 || !/portside|vargby|nordhamn|anchor|nafc|nha|n\.a\./i.test(s)) return s;
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

// ---- the game's colours: BLACK AND YELLOW (svartgult: black first and biggest, yellow the detail), whichever club you
// pick (owner's call). The home decor in the story levels was Nordhamn's red and white: red -> black, its white -> yellow.
export const OLD_RED = '#c8102e', OLD_WHITE = '#f4f1e8';
export const homeKit = { main: '#141416', second: '#f2c811' };   // main = black, second = yellow

// level prop specs in the story levels (world.addProp): club reds (any strong red) -> black and, in a spec that had red,
// its white -> yellow. Graffiti (red paint on a wall) goes yellow so it can still be read.
function redShade(v) {        // 0 = not a club red, 1 = bright, 2 = dark
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) return 0;
  const n = parseInt(v.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx !== r || mx < 60 || (mx - mn) / mx < 0.6) return 0;
  let h = ((g - b) / (mx - mn)) * 60; if (h < 0) h += 360;
  if (h > 6 && h < 340) return 0;
  return (mx + mn) / 510 < 0.3 ? 2 : 1;
}
const isRed = v => redShade(v) > 0;
const isWhite = v => typeof v === 'string' && v.toLowerCase() === OLD_WHITE;
export function homeColours(spec) {
  let red = false;
  for (const k in spec) { const v = spec[k]; if (isRed(v) || (Array.isArray(v) && v.some(isRed))) { red = true; break; } }
  if (!red) return spec;
  const paint = spec.type === 'graffiti';
  const sw = v => (isRed(v) ? (paint ? homeKit.second : homeKit.main) : isWhite(v) ? homeKit.second : v);
  const out = { ...spec };
  for (const k in out) { const v = out[k]; out[k] = Array.isArray(v) ? v.map(sw) : sw(v); }
  return out;
}

// pre-rendered walls/props/floors of the home stadiums (derby, last stand): their club red is painted yellow at load, shading
// kept (only strong reds: brick and rust are left alone; their white paint goes yellow). Only while a story level is on (world sets it).
let storyDecor = false;
const floorMemo = new Map();   // floor id -> { src, out } (envFloor is called once per pixel while floors render)
export function setStoryDecor(on) { if (storyDecor !== !!on) floorMemo.clear(); storyDecor = !!on; }
const TINT_WALL = /^(derby_(facade|standWall|tunnelWall|perimeter)|laststand_)/;
const TINT_PROP = /^(derby_|laststand_(flagpole|stall|boards|turnstile|arenagate|cabinet|floodlight))/;
const TINT_PROP_WHITE = /^(derby_(flagpole|stall|merchBox|seats|cornerFlag)|laststand_(flagpole|stall|boards))$/;
const tinted = new WeakMap();
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
// red paint -> black (a dark grey base so the shading still reads); with white: white paint -> yellow (stand walls,
// flags, stalls: their white was the club's, next to the red)
function tintPixels(px, white) {
  const [tr, tg, tb] = hexRgb('#2a2a2e'), [yr, yg, yb] = hexRgb(homeKit.second), REF = 0.42;   // REF: lightness of the old red
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const r = px[i], gg = px[i + 1], b = px[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (white && mx > 199 && (mx - mn) / mx < 0.12) {                    // white paint (not grey concrete)
      const k = mx / 242;
      px[i] = Math.min(255, yr * k); px[i + 1] = Math.min(255, yg * k); px[i + 2] = Math.min(255, yb * k);
      continue;
    }
    if (mx !== r || mx < 60 || (mx - mn) / mx < 0.6) continue;           // red has to be the strongest, saturated
    let h = ((gg - b) / (mx - mn)) * 60; if (h < 0) h += 360;
    if (h > 6 && h < 340) continue;                                       // pure-ish red only (not brick/orange)
    const k = Math.min(1.6, ((mx + mn) / 510) / REF);
    px[i] = Math.min(255, tr * k); px[i + 1] = Math.min(255, tg * k); px[i + 2] = Math.min(255, tb * k);
  }
}
function tintImage(img, white) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  let d;
  try { d = g.getImageData(0, 0, c.width, c.height); } catch (e) { return img; }
  tintPixels(d.data, white);
  g.putImageData(d, 0, 0);
  return c;
}
const TINT_FLOOR = /^(derby_(terrace|concourse|tunnel|dressing)|laststand_)/;   // (derby_track: the cinder running track stays)
setEnvTint((kind, id, img) => {
  if (kind === 'floor') {               // a floor is an RGBA patch { n, w, h, data }
    const m = floorMemo.get(id);
    if (m && m.src === img) return m.out;
    let out = img;
    if (storyDecor && img && TINT_FLOOR.test(id)) {
      const data = new Uint8ClampedArray(img.data);
      tintPixels(data, id === 'laststand_crest');   // (the crest's lifebuoy: red/white -> black/yellow)
      out = { ...img, data };
    }
    floorMemo.set(id, { src: img, out });
    return out;
  }
  if (!storyDecor || !img) return img;
  let t = tinted.get(img);              // img -> what to draw (the tinted copy, or img itself: decided once per image)
  if (!t) {
    t = typeof document !== 'undefined' && (kind === 'wall' ? TINT_WALL : TINT_PROP).test(id) ? tintImage(img, kind === 'wall' || TINT_PROP_WHITE.test(id)) : img;
    tinted.set(img, t);
  }
  return t;
});

// ---- the club crest: painted on the floor (a level's crest: { x, y, r } in tiles, e.g. the last stand's plaza) over
// the old baked anchor crest: a black disc, then your club's real crest, laid flat.
// paintHomeCrest(g, M, crest, done?): M = [a, b, c, d, e, f] maps tile coords to the canvas's pixels (2D: the iso floor
// layer; 3D: the top-down ground texture). done() runs after a late paint (the crest image still loading).
export function paintHomeCrest(g, M, crest, done) {
  if (typeof document === 'undefined' || !g || !crest) return;
  let late = false;
  whenClubLogo(currentClub(), im => {
    g.save();
    g.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
    g.fillStyle = homeKit.main; g.beginPath(); g.arc(crest.x, crest.y, crest.r * 0.8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = homeKit.second; g.lineWidth = 0.18; g.beginPath(); g.arc(crest.x, crest.y, crest.r * 0.74, 0, Math.PI * 2); g.stroke();
    const s = crest.r * 0.62, iw = im.naturalWidth, ih = im.naturalHeight, k = 2 * s / Math.max(iw, ih);
    g.translate(crest.x - iw * k / 2, crest.y - ih * k / 2); g.scale(k, k);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.globalAlpha = 0.92; g.drawImage(im, 0, 0);
    g.restore();
    if (late && done) done();
  });
  late = true;
}
// the 2D renderer's iso floor layer (engine/tiles.js renderFloor: { canvas, ox, oy, scale })
export function paintHomeCrestIso(fl, crest) {
  if (!fl || !crest) return;
  const K = fl.scale || 1;
  paintHomeCrest(fl.canvas.getContext('2d'), [HALF_W * K, HALF_H * K, -HALF_W * K, HALF_H * K, fl.ox * K, fl.oy * K], crest);
}
