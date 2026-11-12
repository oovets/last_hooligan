// Procedural pixel-art character renderer ("doll").
//
// drawDoll(ctx, x, y, look, pose, opts)
//   x,y   screen position of the character's feet (already including height z)
//   look  appearance object (see LOOK FORMAT below; missing fields fall back to DEFAULT_LOOK)
//   pose  full pose (see poses.js)
//   opts  { flip:bool (face screen-left), back:bool (facing away from camera), flash:bool (white hit flash),
//           silhouette:'#hex' (solid colour, no detail), alpha, face:'normal'|'hurt'|'ko'|'angry'|'shout'|'grin',
//           weapon:{ drawHeld(ctx, hx, hy, ang, s) }, time (s, for scarf sway), sway (scarf extra sway), scale }
//
// LOOK FORMAT (all optional):
// {
//   skin:'#hex',
//   hair:{ style:'crop'|'shaved'|'skinhead'|'curtains'|'mod'|'mohawk'|'flattop'|'spiky'|'ponytail'|'long'|'bald'
//                |'perm'|'wedge'|'sidepart'|'balding'|'buzz'|'quiff', color },
//   facial:'none'|'stubble'|'beard'|'tache'|'goatee'|'sideburns',
//   hat:null|{ style:'cap'|'beanie'|'bucket'|'helmet'|'flatcap'|'hood', color, trim, bobble:true },
//   shades:false,
//   jacket:{ style:'harrington'|'track'|'parka'|'bomber'|'tee'|'polo'|'leather'|'hivis'|'suit'|'vest'|'shirt'
//                  |'kit'|'sheepskin', color, trim, lining,
//            pattern:'plain'|'stripes'|'hoops'|'sash' (kit only), print:'#hex' (tee chest print), badge:'#hex' (chest badge) },
//   shirt:'#hex',
//   pants:{ style:'jeans'|'trackies'|'cargo'|'shorts'|'suit', color, trim, socks:'#hex' (shorts) },
//   shoes:{ color, sole, style:'trainer'|'boot'|'dress', stripe:'#hex' },
//   scarf:null|{ a:'#hex', b:'#hex' },
//   gloves:null|'#hex',
//   build:1 (girth multiplier; > 1.12 adds a belly, > 1.3 a thick neck & jaw), height:1 (overall scale)
// }
// Optional fields added in v2 (all backward compatible): hair styles perm/wedge/sidepart/balding/buzz/quiff,
// facial goatee/sideburns, hat flatcap/hood + bobble, jacket kit/sheepskin + pattern/print/badge, pants.socks,
// shoes.style/stripe, face 'grin'. Poses may carry hN/hF (0..1: near/far hand open).

import { thick, fillPoly, line, makeCanvas } from '../engine/gfx.js';
import { shade, mix, hexToRgb } from '../engine/color.js';
import { hash2 } from '../engine/rng.js';

const hn = (hx, hy, k = 2, seed = 0) => hash2(Math.floor(hx * k + 64), Math.floor(hy * k + 64), seed);

export const OUTLINE = '#120c14';

export const DEFAULT_LOOK = {
  skin: '#e2a97a',
  hair: { style: 'crop', color: '#3a2717' },
  facial: 'none',
  hat: null,
  shades: false,
  jacket: { style: 'harrington', color: '#2b3a2a', trim: '#1c261c', lining: '#b8302a' },
  shirt: '#e8e4dc',
  pants: { style: 'jeans', color: '#34507a', trim: '#5f7fae' },
  shoes: { color: '#f2f2ee', sole: '#b9a27a' },
  scarf: null,
  gloves: null,
  build: 1,
  height: 1,
};

export function normalizeLook(look = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  L.hair = { ...DEFAULT_LOOK.hair, ...(look.hair || {}) };
  L.jacket = { ...DEFAULT_LOOK.jacket, ...(look.jacket || {}) };
  L.pants = { ...DEFAULT_LOOK.pants, ...(look.pants || {}) };
  L.shoes = { ...DEFAULT_LOOK.shoes, ...(look.shoes || {}) };
  if (look.jacket && look.jacket.trim === undefined) L.jacket.trim = shade(L.jacket.color, -0.3);
  if (look.pants && look.pants.trim === undefined) L.pants.trim = shade(L.pants.color, 0.35);
  L.__norm = true;
  return L;
}

// raw look objects (e.g. rebuilt every frame by menus) -> cached normalized look (keeps head sprite caches warm)
const normCache = new Map();
function getNorm(look) {
  if (look.__norm) return look;
  let key;
  try { key = JSON.stringify(look); } catch (e) { return normalizeLook(look); }
  let L = normCache.get(key);
  if (!L) {
    if (normCache.size > 64) normCache.delete(normCache.keys().next().value);
    L = normalizeLook(look);
    normCache.set(key, L);
  }
  return L;
}

// memoized colour helpers
const SHM = new Map();
function sh(c, f) {
  if (!f) return c;
  const k = c + f;
  let v = SHM.get(k);
  if (v === undefined) { v = shade(c, f); SHM.set(k, v); }
  return v;
}
const MXM = new Map();
function mx(a, b, t) {
  const k = a + b + t;
  let v = MXM.get(k);
  if (v === undefined) { v = mix(a, b, t); MXM.set(k, v); }
  return v;
}

const SHORT_SLEEVE = new Set(['tee', 'polo', 'vest', 'hivis', 'kit']);
const SLEEVELESS = SHORT_SLEEVE; // (legacy name)

// =============================================================================== HEAD
// Head-local coordinates: hx forward (+ toward the face), hy down (+ toward the chin), 1 unit = 1px at scale 1.
const skullIn = (hx, hy, g = 0) => { const a = (hx + 0.4) / (4.1 + g), b = (hy + 0.8) / (4.0 + g); return a * a + b * b <= 1; };
const jawIn = (hx, hy, jw, g = 0) => { const a = (hx - 0.9 + (jw - 1) * 1.6) / (2.9 * jw + g), b = (hy - 0.9) / (3.4 + g); return a * a + b * b <= 1; };
const noseIn = (hx, hy) => hy > -0.5 && hy < 1.1 && hx >= 3.2 && hx < 3.6 + Math.min(1.1, (hy + 0.5) * 1.2);

const EYE_W = '#efe9dc', PUPIL = '#120e16', MOUTH = '#3a0a12', TEETH = '#f4efe0', TONGUE = '#c84a5a';

// hair outside the skull (volume)
function hairVolume(st, hx, hy) {
  switch (st) {
    case 'mohawk': return hy < -2.5 && hy > -9 && Math.abs(hx + 0.4) < 1.5 - Math.max(0, (-hy - 7.5)) * 0.6 &&
      (hy > -8 || (Math.floor(hx + 20) % 2 === 0));
    case 'flattop': return hy < -2.8 && hy > -7.2 && hx > -4.2 && hx < 3.2;
    case 'spiky': {
      if (hy > -2.5 || hx < -4.6 || hx > 3.4) return false;
      const ph = ((hx + 20) % 2.2) / 2.2;
      const top = -5.4 - (1 - Math.abs(ph - 0.5) * 2) * 1.8;
      return hy > top && skullIn(hx, hy, 2.2);
    }
    case 'curtains': return hy < -1.2 && skullIn(hx, hy, 0.9) && hx < 3.6;
    case 'mod': return skullIn(hx, hy, 1.0) && hy < 2.6 && hx < 3.3 && (hy < -1.3 || hx < -0.6);
    case 'perm': {
      if (!skullIn(hx, hy, 1.8) || hx > 3.0 || hy > 3.2) return false;
      if (hy > -1.4 && hx > -0.4) return false;
      return true;
    }
    case 'wedge': return skullIn(hx, hy, 1.1) && hy < 1.8 && hx < 3.6 && (hy < -1.6 || hx < -0.8);
    case 'quiff': return (skullIn(hx, hy, 0.6) && hy < -1.5 && hx < 3) || (hy < -3.5 && hy > -7 && hx > -0.5 && hx < 4.2 && ((hx - 1.8) / 2.4) ** 2 + ((hy + 5) / 2) ** 2 <= 1);
    case 'ponytail': return (skullIn(hx, hy, 0.4) && hy < -1.8) || (hx < -3.6 && hx > -7 && hy > -2.4 && hy < 3.4 + (hx + 3.6) * 0.4 && hy > -2.4 + (-hx - 3.6) * 0.5);
    case 'long': return (skullIn(hx, hy, 0.8) && hy < -1.4) || (hx < -1.2 && hx > -5.4 && hy > -2 && hy < 7);
    case 'crop': case 'sidepart': return skullIn(hx, hy, 0.45) && hy < -1.8 && hx < 3.2;
    case 'balding': return skullIn(hx, hy, 0.4) && hx < -1.5 && hy < 1.2 && hy > -3.4;
    default: return false;
  }
}

// hair over the skull surface
function hairOnSkull(st, hx, hy, back) {
  switch (st) {
    case 'crop': return hy < -2.5 || (hx < -1.5 && hy < 1.2) || (back && hy < 1.4);
    case 'buzz': case 'shaved': return (hy < -2.0 && hx < 2.8) || (hx < -1.7 && hy < 1.0) || (back && hy < 1.4);
    case 'sidepart': return hy < -2.2 || (hx < -1.4 && hy < 1.0) || (back && hy < 1.4);
    case 'curtains': return hy < -1.8 || (hx < -0.8 && hy < 2.2) || (hx > 1.0 && hx < 3.2 && hy < -0.9 && Math.abs(hx - 0.6) > 0.5) || (back && hy < 2.4);
    case 'mod': return hy < -1.2 || (hx < -0.6 && hy < 2.4) || (back && hy < 2.6);
    case 'wedge': return hy < -1.5 + (hx > 1 ? (hx - 1) * -0.35 : 0) || (hx < -0.8 && hy < 1.8) || (back && hy < 2);
    case 'perm': return hy < -1.4 || (hx < -0.4 && hy < 2.6) || (back && hy < 2.6);
    case 'quiff': return hy < -2.0 || (hx < -1.4 && hy < 1.0) || (back && hy < 1.4);
    case 'mohawk': return Math.abs(hx + 0.4) < 1.5 && hy < -2.4;
    case 'flattop': return hy < -2.6 || (hx < -1.8 && hy < 0.8) || (back && hy < 1.2);
    case 'spiky': return hy < -2.3 || (hx < -1.6 && hy < 1.0) || (back && hy < 1.4);
    case 'ponytail': return hy < -1.9 || (hx < -0.7 && hy < 1.4) || (back && hy < 2);
    case 'long': return hy < -1.7 || (hx < -0.4 && hy < 4.2) || (back && hy < 4.2);
    case 'balding': return (hx < -1.5 && hy < 1.2 && hy > -3.6) || (back && hy < 1.4 && hy > -3.2);
    default: return false;
  }
}

function hatPix(L, hat, hx, hy, inside, back) {
  const c = hat.color || '#333333', tr = hat.trim || sh(c, 0.25);
  switch (hat.style) {
    case 'cap': {
      if (!back && hy > -2.7 && hy < -1.5 && hx > 1.8 && hx < 6.6 - (hy + 2.7) * 0.6) return hy < -2.2 ? sh(c, -0.1) : sh(c, -0.35); // brim
      if ((inside && hy < -1.9) || (!inside && skullIn(hx, hy, 0.6) && hy < -1.9)) {
        if (hy < -4.6 && Math.abs(hx + 0.3) < 0.6) return tr; // button
        if (Math.abs(hx - 0.8) < 0.35 && hy < -2.4) return sh(c, -0.18); // panel seam
        if (hy > -2.6) return sh(c, -0.12);
        return hx > 0.5 && hy < -3.8 ? sh(c, 0.18) : c;
      }
      return null;
    }
    case 'beanie': {
      if (hat.bobble !== false && hy < -4.4 && hy > -7.4 && ((hx + 0.6) ** 2 + (hy + 6.0) ** 2) < 2.2) return ((Math.floor(hx * 2) + Math.floor(hy * 2)) & 1) ? tr : sh(tr, -0.15);
      if ((inside || skullIn(hx, hy, 0.7)) && hy < -2.1 + Math.max(0, -hx - 1) * 0.25) {
        if (hy > -3.5) return (Math.floor(hx * 1.4 + 20) % 2) ? tr : sh(tr, -0.2); // ribbed turn-up
        return (Math.floor(hx * 1.4 + 20) % 3 === 0) ? sh(c, -0.12) : (hy < -4 && hx > 0 ? sh(c, 0.15) : c);
      }
      return null;
    }
    case 'bucket': {
      const by = -1.9 + Math.abs(hx + 0.2) * 0.16;
      if (hy > by - 0.8 && hy < by + 0.6 && Math.abs(hx + 0.2) < 6.2) return hy > by ? sh(c, -0.25) : sh(c, -0.08);
      if ((inside || skullIn(hx, hy, 0.9)) && hy < by) {
        if (hy > by - 1.4) return tr === sh(c, 0.25) ? sh(c, -0.3) : tr; // band
        return hy < -4.4 && hx > -1 ? sh(c, 0.14) : c;
      }
      return null;
    }
    case 'flatcap': {
      if (!back && hy > -2.8 && hy < -1.8 && hx > 2.0 && hx < 5.4) return sh(c, -0.25);
      if ((inside || (skullIn(hx, hy, 0.7) && hy > -5.0)) && hy < -2.0 + Math.max(0, hx - 1) * -0.1) {
        const tw = ((Math.floor(hx * 1.5 + 30) + Math.floor(hy * 1.5 + 30)) % 3 === 0);
        return tw ? sh(c, -0.18) : (hy < -4 ? sh(c, 0.1) : c);
      }
      return null;
    }
    case 'helmet': {
      if ((inside && hy < -0.6) || (!inside && (hx * hx) / 23 + ((hy + 0.6) * (hy + 0.6)) / 33 <= 1 && hy < -0.4)) {
        if (!back && hy > -1.6 && hx > 1.5) return sh(c, -0.35); // peak
        if (Math.abs(hy + 2.8) < 0.4) return tr; // band
        return hy < -4.2 && hx > -1 && hx < 1.6 ? sh(c, 0.35) : c;
      }
      return null;
    }
    case 'hood': {
      const rim = skullIn(hx, hy, 1.6) || jawIn(hx, hy, 1, 1.4);
      if (!rim) return null;
      if (!back && hx > 0.9 && hy > -2.4 && jawIn(hx, hy, 1, 0) && !(hy < -1.6 && hx < 1.6)) return null; // face opening
      if (!back && hx > 0.2 && hy > -3.4 && hy < 4.4 && !(skullIn(hx, hy, -0.3) && hx < 0.9)) return tr === sh(c, 0.25) ? sh(c, -0.25) : tr; // trim ring
      return hy < -3.5 ? sh(c, 0.12) : hx < -2 ? sh(c, -0.15) : c;
    }
  }
  return null;
}

// Returns the colour of a head pixel (no outline) or null.
function headPix(L, hx, hy, back, face) {
  const bw = L.build || 1;
  const jw = 1 + Math.max(0, bw - 1.05) * 0.5;
  const skin = L.skin, hair = L.hair.color, st = L.hair.style, hat = L.hat;
  const inSkull = skullIn(hx, hy), inJaw = jawIn(hx, hy, jw);
  const nose = !back && noseIn(hx, hy);
  const inside = inSkull || inJaw;

  if (hat) {
    const h = hatPix(L, hat, hx, hy, inside, back);
    if (h) return h;
  }
  if (!inside && !nose) {
    if (!hat) { if (hairVolume(st, hx, hy)) return hairShade(L, hx, hy, true); }
    else if (hat.style !== 'helmet' && hat.style !== 'hood') {
      // long hair / ponytail still visible under hats
      if ((st === 'long' || st === 'ponytail' || st === 'perm') && hy > -1.5 && hairVolume(st, hx, hy)) return hairShade(L, hx, hy, true);
    }
    if (L.facial === 'beard' && !back && jawIn(hx, hy, jw, 0.6) && hy > 1.2 && hx > -1.2) return sh(hair, -0.08);
    return null;
  }
  if (nose) {
    if (L.shades && hy < -0.1) return '#0b0b10';
    return hy > 0.7 ? sh(skin, -0.16) : (hx > 4.2 && hy < 0.3 ? sh(skin, 0.1) : skin);
  }
  // hair on the skull
  if (inSkull && hairOnSkull(st, hx, hy, back) && !(hat && hy < -1.4)) return hairShade(L, hx, hy, false);

  // skin
  if ((st === 'skinhead' || st === 'bald' || st === 'balding') && hy < -3.2 && hx > -0.6 && hx < 1.4) return sh(skin, 0.32); // shine
  if (st === 'skinhead' && inSkull && hy < -2.6 && hx < 2.6 && hn(hx, hy, 2, 3) < 0.3) return mx(skin, hair, 0.25);

  if (back) {
    // seen from behind: ear forward, nape shading
    if (((hx - 1.2) / 0.9) ** 2 + ((hy - 0.4) / 1.4) ** 2 <= 1) return sh(skin, -0.2);
    if (hy > 2.4) return sh(skin, -0.18);
    return hx < -2.5 ? sh(skin, -0.12) : skin;
  }

  // ---- face ----
  const ex = 2.15, ey = -0.6;
  // shades
  if (L.shades && hy > -1.5 && hy < 0.2 && hx > 0.4) return (hx > 2.6 && hy < -0.7) ? '#8ad8ff' : '#0b0b10';
  // brows
  const browC = hair === '#e8d27a' || st === 'skinhead' || st === 'bald' ? sh(hair, -0.45) : sh(hair, -0.15);
  let bc;
  if (face === 'angry' || face === 'shout') bc = -1.85 + (hx - ex) * 0.5;
  else if (face === 'hurt') bc = -2.1 - (hx - ex) * 0.45;
  else if (face === 'ko') bc = -2.4;
  else bc = -2.0;
  if (hx > 1.0 && hx < 3.5 && Math.abs(hy - bc) < 0.42) return browC;
  // eyes
  const dxE = hx - ex, dyE = hy - ey;
  if (face === 'ko') {
    if (Math.abs(dxE) < 0.95 && Math.abs(dyE) < 0.95 && Math.abs(Math.abs(dxE) - Math.abs(dyE)) < 0.45) return '#2a0c10';
  } else if (face === 'hurt' || face === 'grin') {
    const yy = face === 'hurt' ? Math.abs(dxE) * 0.5 - 0.1 : -Math.abs(dxE) * 0.4 + 0.1;
    if (Math.abs(dxE) < 0.95 && Math.abs(dyE - yy) < 0.38) return PUPIL;
  } else {
    const top = face === 'angry' || face === 'shout' ? -0.35 : -0.6;
    if (dxE > -0.9 && dxE < 0.95 && dyE > top && dyE < 0.55) return dxE > 0.05 ? PUPIL : EYE_W;
    if (top < -0.5 && dxE > -0.2 && dxE < 0.95 && dyE > top - 0.45 && dyE <= top) return sh(skin, -0.2); // upper lid
  }
  // mouth
  const mxC = 2.6, myC = 2.3;
  const dxM = hx - mxC, dyM = hy - myC;
  switch (face) {
    case 'shout':
      if (dxM > -1.3 && dxM < 1.25 && dyM > -0.8 && dyM < 1.2 - Math.max(0, dxM) * 0.4) {
        if (dyM < -0.25) return TEETH;
        if (dyM > 0.6 && dxM < 0.4) return TONGUE;
        return MOUTH;
      }
      break;
    case 'hurt':
      if (dxM > -1.0 && dxM < 1.2 && dyM > -0.5 && dyM < 0.7) return Math.abs(dyM - 0.1) < 0.2 ? MOUTH : TEETH;
      break;
    case 'ko':
      if (dxM > -0.7 && dxM < 0.9 && dyM > -0.4 && dyM < 1.2) return dyM > 0.5 ? TONGUE : MOUTH;
      break;
    case 'grin':
      if (dxM > -1.3 && dxM < 1.3 && dyM > -0.5 + (dxM < -0.6 ? -0.5 : 0) && dyM < 0.45) return dyM < 0.05 ? TEETH : MOUTH;
      break;
    case 'angry':
      if (dxM > -1.1 && dxM < 1.0 && Math.abs(dyM - Math.max(0, -dxM - 0.3) * 0.5) < 0.32) return sh(skin, -0.45);
      break;
    default:
      if (dxM > -0.9 && dxM < 0.95 && Math.abs(dyM) < 0.3) return sh(skin, -0.38);
  }
  // facial hair
  const f = L.facial;
  if (f === 'beard' && hy > 0.7 && hx > -1.4) return hn(hx, hy, 2, 5) < 0.25 ? sh(hair, -0.2) : sh(hair, -0.05);
  if (f === 'tache' && hy > 1.25 && hy < 2.05 && hx > 1.5) return hair;
  if (f === 'goatee' && ((hy > 2.8 && hx > 1.5 && hx < 3.6) || (hy > 1.35 && hy < 1.95 && hx > 1.6))) return sh(hair, -0.05);
  if ((f === 'sideburns' || f === 'beard') && hx > -1.9 && hx < -0.3 && hy > -1.6 && hy < 1.4) return hair;
  if (f === 'stubble' && hy > 0.9 && hx > -1.2 && hn(hx, hy, 2, 7) < 0.45) return mx(skin, hair, 0.38);
  // ear
  const ea = ((hx + 0.9) / 0.9) ** 2 + ((hy - 0.3) / 1.35) ** 2;
  if (ea <= 1) return ea < 0.35 ? sh(skin, -0.32) : sh(skin, -0.14);
  // shading: back of head, under the jaw, forehead / cheek highlights
  if (hy > 3.0 && !jawIn(hx, hy - 0.8, jw)) return sh(skin, -0.2);
  if (hx < -2.6) return sh(skin, -0.12);
  if (hy < -2.6 && hx > 0.6 && hx < 2.8) return sh(skin, 0.1);
  if (hx > 2.8 && hy > 0.2 && hy < 1.4) return sh(skin, 0.06);
  if (face === 'hurt' && hx > 1 && hx < 3 && hy > 0.6 && hy < 1.4) return mx(skin, '#d04040', 0.2);
  return skin;
}

function hairShade(L, hx, hy, outside) {
  const hair = L.hair.color, st = L.hair.style;
  let base = (st === 'shaved' || st === 'buzz') ? mx(L.skin, hair, st === 'buzz' ? 0.7 : 0.55) : hair;
  if (st === 'perm') {
    const k = (Math.floor(hx * 1.3 + 40) * 3 + Math.floor(hy * 1.3 + 40) * 5) % 4;
    return k === 0 ? sh(base, -0.25) : k === 1 ? sh(base, 0.15) : base;
  }
  if (hy < -3.4 && hx > -1.6 && hx < 1.8 && !(st === 'shaved' || st === 'buzz')) {
    if ((Math.floor(hx * 1.5 + 30) % 3) === 0) return sh(base, 0.28);
    return sh(base, 0.14);
  }
  if (hx < -3 || (outside && hy > 0)) return sh(base, -0.2);
  return base;
}

// legacy export (per-pixel query incl. a rough outline ring)
export function headColor(L, hx, hy, back, face) {
  const c = headPix(L, hx, hy, back, face);
  if (c) return c;
  if (skullIn(hx, hy, 1) || jawIn(hx, hy, 1, 1)) return OUTLINE;
  return null;
}

// Rendered head sprites cached per look: key face|back|angle|scale|mode
const HEAD_R = 10;
function headSprite(L, face, back, ang, s, mode) {
  const aq = Math.round(ang / (Math.PI / 24));
  const sq = Math.round(s * 100);
  const key = face + (back ? 'B' : 'F') + aq + '|' + sq + '|' + mode;
  let cache = L.__heads;
  if (!cache) { cache = L.__heads = new Map(); }
  let spr = cache.get(key);
  if (spr) return spr;
  if (cache.size > 220) cache.delete(cache.keys().next().value);
  const a = aq * (Math.PI / 24);
  const N = Math.ceil(HEAD_R * 2 * s) + 4;
  const c = makeCanvas(N, N);
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  const d = img.data;
  const up = { x: Math.sin(a), y: -Math.cos(a) }, fw = { x: Math.cos(a), y: Math.sin(a) };
  const half = N / 2;
  const solid = new Uint8Array(N * N);
  const silRgb = mode && mode !== 'flash' ? hexToRgb(mode) : null;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const dx = (i + 0.5 - half) / s, dy = (j + 0.5 - half) / s;
      const hx = dx * fw.x + dy * fw.y;
      const hy = -(dx * up.x + dy * up.y);
      if (hx * hx + hy * hy > HEAD_R * HEAD_R) continue;
      const col = headPix(L, hx, hy, back, face);
      if (!col) continue;
      const rgb = silRgb || (mode === 'flash' ? WHITE_RGB : hexToRgb(col));
      const o = (j * N + i) * 4;
      d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
      solid[j * N + i] = 1;
    }
  }
  // 1px outline around the silhouette
  const ol = silRgb || hexToRgb(OUTLINE);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    if (solid[k]) continue;
    if ((i > 0 && solid[k - 1]) || (i < N - 1 && solid[k + 1]) || (j > 0 && solid[k - N]) || (j < N - 1 && solid[k + N])) {
      const o = k * 4;
      d[o] = ol[0]; d[o + 1] = ol[1]; d[o + 2] = ol[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  spr = { c, half };
  cache.set(key, spr);
  return spr;
}
const WHITE_RGB = [255, 255, 255];

// =============================================================================== BODY
const OFFS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
function outlinedPoly(ctx, pts, fill, ol) {
  for (const [ox, oy] of OFFS) {
    const q = pts.map(p => ({ x: p.x + ox, y: p.y + oy }));
    fillPoly(ctx, q, ol);
  }
  fillPoly(ctx, pts, fill);
}

export function drawDoll(ctx, x, y, look, pose, opts = {}) {
  const L = getNorm(look);
  const s = (L.height || 1) * (opts.scale || 1);
  const bw = L.build || 1;
  const flipV = (!!opts.flip) !== (pose.flip >= 0.5);
  const back = !!opts.back;
  const flash = !!opts.flash;
  const sil = opts.silhouette || null;
  const plain = !!(sil || flash);
  const face = opts.face || 'normal';

  const col = (c, dark = 0) => (sil ? sil : flash ? '#ffffff' : dark ? sh(c, dark) : c);
  const OL = sil ? sil : OUTLINE;

  // ---- skeleton (local coords: +x forward, +y down, origin = feet) ----
  const lean = pose.lean;
  const tdir = { x: Math.sin(lean), y: -Math.cos(lean) };
  const perp = { x: Math.cos(lean), y: Math.sin(lean) };
  const hip = { x: pose.dx, y: -20 * s + pose.dy };
  const neck = { x: hip.x + tdir.x * 14 * s, y: hip.y + tdir.y * 14 * s };
  const P = [];
  const pt = (px, py) => { const o = { x: px, y: py }; P.push(o); return o; };
  const add = (a, ang, len) => pt(a.x + Math.sin(ang) * len, a.y + Math.cos(ang) * len);

  const hipN = pt(hip.x + perp.x * 0.6 * s, hip.y + perp.y * 0.6 * s);
  const hipF = pt(hip.x - perp.x * 1.2 * s, hip.y - perp.y * 1.2 * s);
  const shN = pt(neck.x - tdir.x * 2.2 * s + perp.x * 0.6 * s, neck.y - tdir.y * 2.2 * s + perp.y * 0.6 * s);
  const shF = pt(neck.x - tdir.x * 2.2 * s - perp.x * 1.8 * s, neck.y - tdir.y * 2.2 * s - perp.y * 1.8 * s);

  const leg = (h, th, kn) => {
    const knee = add(h, th, 10 * s);
    const shn = th - kn;
    const ankle = add(knee, shn, 9.5 * s);
    const toe = pt(ankle.x + Math.cos(shn) * 3.4 * s, ankle.y - Math.sin(shn) * 3.4 * s + 0.5 * s);
    return { h, knee, ankle, toe };
  };
  const arm = (sh0, ua, fa) => {
    const a1 = ua + lean, a2 = a1 + fa;
    const elbow = add(sh0, a1, 7.5 * s);
    const hand = add(elbow, a2, 7 * s);
    return { sh: sh0, elbow, hand, ang: a2 };
  };
  const lN = leg(hipN, pose.thN, pose.knN), lF = leg(hipF, pose.thF, pose.knF);
  const aN = arm(shN, pose.uaN, pose.faN), aF = arm(shF, pose.uaF, pose.faF);
  aN.open = (pose.hN || 0) > 0.5; aF.open = (pose.hF || 0) > 0.5;
  const neckP = pt(neck.x, neck.y);
  const hipP = pt(hip.x, hip.y);
  let headAng = lean + pose.head;
  const headC = pt(neck.x + Math.sin(headAng) * 5.0 * s, neck.y - Math.cos(headAng) * 5.0 * s);

  // whole-body rotation around the hip
  const rot = pose.rot || 0;
  if (rot) {
    const c = Math.cos(rot), sn = Math.sin(rot), hx = hip.x, hy = hip.y;
    for (const p of P) {
      const dx = p.x - hx, dy = p.y - hy;
      p.x = hx + dx * c - dy * sn;
      p.y = hy + dx * sn + dy * c;
    }
    headAng += rot;
    aN.ang += rot; aF.ang += rot;
  }
  const rP = { x: Math.cos(lean + rot), y: Math.sin(lean + rot) };   // torso forward
  const rT = { x: Math.sin(lean + rot), y: -Math.cos(lean + rot) };  // torso up
  const T = (u, v) => ({ x: hipP.x + rP.x * u + rT.x * v, y: hipP.y + rP.y * u + rT.y * v });

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flipV) ctx.scale(-1, 1);
  const prevA = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevA * opts.alpha;

  const J = L.jacket, PN = L.pants, SHO = L.shoes;
  const js = J.style;
  const shortSleeve = SHORT_SLEEVE.has(js);
  const sleeve = js === 'hivis' || js === 'vest' ? L.shirt : J.color;
  const torsoCol = js === 'tee' || js === 'polo' ? L.shirt : J.color;
  const puffy = js === 'bomber' || js === 'parka' || js === 'sheepskin' ? 1 : 0;

  // ------------------------------------------------------------------ legs
  const drawLeg = (lg, dark, near) => {
    const legW = Math.max(3, Math.round(4.8 * s * Math.min(1.3, bw)));
    const shinW = Math.max(3, Math.round(4.2 * s * Math.min(1.25, bw)));
    // shoe geometry
    let fx = lg.toe.x - lg.ankle.x, fy = lg.toe.y - lg.ankle.y;
    const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    let nx = fy, ny = -fx;
    if (nx * (lg.knee.x - lg.ankle.x) + ny * (lg.knee.y - lg.ankle.y) < 0) { nx = -nx; ny = -ny; }
    const A = lg.ankle;
    const Q = (f, n) => ({ x: A.x + fx * f * s + nx * n * s, y: A.y + fy * f * s + ny * n * s });
    const boot = SHO.style === 'boot';
    const shoe = [Q(-1.7, boot ? 3.2 : 1.6), Q(1.4, boot ? 2.6 : 1.7), Q(3.6, 0.6), Q(4.4, -0.6), Q(4.0, -1.9), Q(-1.9, -1.9), Q(-2.1, -0.4)];
    // outlines
    thick(ctx, lg.h.x, lg.h.y, lg.knee.x, lg.knee.y, legW + 2, OL);
    thick(ctx, lg.knee.x, lg.knee.y, lg.ankle.x, lg.ankle.y, shinW + 2, OL);
    for (const [ox, oy] of OFFS) fillPoly(ctx, shoe.map(p => ({ x: p.x + ox, y: p.y + oy })), OL);
    // fill
    const shorts = PN.style === 'shorts';
    thick(ctx, lg.h.x, lg.h.y, lg.knee.x, lg.knee.y, legW, col(PN.color, dark));
    if (shorts) {
      const mx2 = lg.h.x + (lg.knee.x - lg.h.x) * 0.7, my2 = lg.h.y + (lg.knee.y - lg.h.y) * 0.7;
      thick(ctx, mx2, my2, lg.knee.x, lg.knee.y, legW - 1, col(L.skin, dark));
    }
    thick(ctx, lg.knee.x, lg.knee.y, lg.ankle.x, lg.ankle.y, shinW, col(shorts ? L.skin : PN.color, dark));
    if (!plain) {
      const kx = lg.knee.x, ky = lg.knee.y;
      if (PN.style === 'jeans') {
        const tx = A.x + (kx - A.x) * 0.2, ty = A.y + (ky - A.y) * 0.2;
        thick(ctx, tx, ty, A.x + (kx - A.x) * 0.08, A.y + (ky - A.y) * 0.08, shinW, col(PN.trim || sh(PN.color, 0.3), dark)); // turn-up
        if (near) {
          ctx.fillStyle = sh(PN.color, 0.16 + (dark || 0));
          ctx.fillRect(Math.round(kx + fx * 0.6), Math.round(ky - 1), 1, 2); // knee highlight
          line(ctx, lg.h.x + fx * 1.2, lg.h.y - 0.5, kx + fx * 1.4, ky - 1, sh(PN.color, 0.1 + (dark || 0)));
        }
      } else if (PN.style === 'trackies' || PN.style === 'suit') {
        const tc = PN.style === 'suit' ? sh(PN.color, 0.12) : (PN.trim || sh(PN.color, 0.4));
        line(ctx, lg.h.x, lg.h.y, kx, ky, col(tc, dark));
        line(ctx, kx, ky, A.x, A.y, col(tc, dark));
        if (PN.style === 'trackies') thick(ctx, A.x + (kx - A.x) * 0.12, A.y + (ky - A.y) * 0.12, A.x, A.y, Math.max(2, shinW - 1), col(sh(PN.color, -0.2), dark)); // cuff
      } else if (PN.style === 'cargo') {
        const px2 = lg.h.x + (kx - lg.h.x) * 0.55, py2 = lg.h.y + (ky - lg.h.y) * 0.55;
        ctx.fillStyle = col(sh(PN.color, -0.22), dark);
        ctx.fillRect(Math.round(px2 - 1), Math.round(py2 - 1), 3, 3);
        ctx.fillStyle = col(sh(PN.color, 0.15), dark);
        ctx.fillRect(Math.round(px2 - 1), Math.round(py2 - 2), 3, 1);
      } else if (shorts) {
        const sc = PN.socks || PN.trim || '#e8e8e0';
        thick(ctx, A.x + (kx - A.x) * 0.45, A.y + (ky - A.y) * 0.45, A.x, A.y, shinW, col(sc, dark));
        thick(ctx, A.x + (kx - A.x) * 0.45, A.y + (ky - A.y) * 0.45, A.x + (kx - A.x) * 0.4, A.y + (ky - A.y) * 0.4, shinW, col(sh(sc, -0.25), dark));
      }
    }
    // shoe
    fillPoly(ctx, shoe, col(SHO.color, dark));
    if (!plain) {
      const sole = SHO.sole || '#d0c0a0';
      const s0 = Q(-1.8, -1.3), s1 = Q(4.1, -1.3);
      thick(ctx, s0.x, s0.y, s1.x, s1.y, Math.max(1, Math.round(s)), col(sole, dark));
      if (SHO.style === 'boot') {
        const k0 = Q(-1.2, -0.5), k1 = Q(3.4, -0.5); line(ctx, k0.x, k0.y, k1.x, k1.y, col('#d8b040', dark)); // yellow stitch
        const e0 = Q(0.2, 2.4), e1 = Q(1.6, 0.9); line(ctx, e0.x, e0.y, e1.x, e1.y, col(sh(SHO.color, 0.3), dark));
      } else if (SHO.style === 'dress') {
        const h0 = Q(2.2, 0.6); ctx.fillStyle = col(sh(SHO.color, 0.45), dark); ctx.fillRect(Math.round(h0.x), Math.round(h0.y), 1, 1);
      } else {
        const st = SHO.stripe || (SHO.color === '#f2f2ee' || SHO.color === '#ffffff' ? '#2d5bb3' : sh(SHO.color, 0.45));
        const t0 = Q(0.0, 0.9), t1 = Q(2.2, -0.6); line(ctx, t0.x, t0.y, t1.x, t1.y, col(st, dark));
        const l0 = Q(1.0, 1.4); ctx.fillStyle = col(sh(SHO.color, -0.25), dark); ctx.fillRect(Math.round(l0.x), Math.round(l0.y), 1, 1);
      }
    }
  };

  // ------------------------------------------------------------------ arms
  const drawHand = (am, dark) => {
    const f = Math.max(3, Math.round(3.6 * s));
    const hc = col(L.gloves || L.skin, dark);
    if (am.open) {
      const dx = Math.sin(am.ang), dy = Math.cos(am.ang);
      const ex = am.hand.x + dx * 2.6 * s, ey = am.hand.y + dy * 2.6 * s;
      thick(ctx, am.hand.x, am.hand.y, ex, ey, f + 1, OL);
      thick(ctx, am.hand.x, am.hand.y, ex, ey, f - 1, hc);
      return;
    }
    const hx = Math.round(am.hand.x - f / 2), hy = Math.round(am.hand.y - f / 2);
    ctx.fillStyle = OL;
    ctx.fillRect(hx - 1, hy, f + 2, f);
    ctx.fillRect(hx, hy - 1, f, f + 2);
    ctx.fillStyle = hc;
    ctx.fillRect(hx, hy, f, f);
    if (!plain) {
      ctx.fillStyle = sh(L.gloves || L.skin, (dark || 0) - 0.22);
      ctx.fillRect(hx, hy + f - 1, f, 1);
      ctx.fillStyle = sh(L.gloves || L.skin, (dark || 0) + 0.18);
      ctx.fillRect(hx, hy, 1, 1);
    }
  };
  const drawArm = (am, dark, isNear) => {
    const uw = Math.max(3, Math.round((3.9 + puffy * 0.5) * s * Math.min(1.35, bw)));
    const fw = Math.max(3, Math.round((3.4 + puffy * 0.3) * s * Math.min(1.3, bw)));
    thick(ctx, am.sh.x, am.sh.y, am.elbow.x, am.elbow.y, uw + 2, OL);
    thick(ctx, am.elbow.x, am.elbow.y, am.hand.x, am.hand.y, fw + 2, OL);
    thick(ctx, am.sh.x, am.sh.y, am.elbow.x, am.elbow.y, uw, col(sleeve, dark));
    if (shortSleeve) {
      const m = js === 'vest' ? 0.1 : 0.5;
      const mx2 = am.sh.x + (am.elbow.x - am.sh.x) * m, my2 = am.sh.y + (am.elbow.y - am.sh.y) * m;
      thick(ctx, mx2, my2, am.elbow.x, am.elbow.y, uw - 1, col(L.skin, dark));
      thick(ctx, am.elbow.x, am.elbow.y, am.hand.x, am.hand.y, fw - (fw > 3 ? 1 : 0), col(L.skin, dark));
      if (!plain && js === 'kit') {
        const cx = am.sh.x + (am.elbow.x - am.sh.x) * (m - 0.08), cy = am.sh.y + (am.elbow.y - am.sh.y) * (m - 0.08);
        thick(ctx, cx, cy, cx, cy, uw, col(J.trim, dark));
      }
    } else {
      thick(ctx, am.elbow.x, am.elbow.y, am.hand.x, am.hand.y, fw, col(sleeve, dark));
      if (!plain) {
        if (js === 'track') {
          const ox = -Math.cos(am.ang) * 0.6, oy = Math.sin(am.ang) * 0.6;
          line(ctx, am.sh.x + ox, am.sh.y + oy, am.elbow.x + ox, am.elbow.y + oy, col(J.trim, dark));
          line(ctx, am.elbow.x + ox, am.elbow.y + oy, am.hand.x + ox, am.hand.y + oy, col(J.trim, dark));
        } else if (isNear) {
          // light catch along the upper arm
          line(ctx, am.sh.x - 1, am.sh.y - 1, am.elbow.x - 1, am.elbow.y - 1, col(sh(sleeve, 0.14), dark));
        }
        if (js === 'bomber' && isNear) {
          const px2 = am.sh.x + (am.elbow.x - am.sh.x) * 0.4, py2 = am.sh.y + (am.elbow.y - am.sh.y) * 0.4;
          ctx.fillStyle = sh(sleeve, -0.22); ctx.fillRect(Math.round(px2 - 1), Math.round(py2 - 1), 2, 2);
          ctx.fillStyle = '#c8c8d0'; ctx.fillRect(Math.round(px2 - 1), Math.round(py2 - 1), 2, 1);
        }
        // cuff
        const cx = am.hand.x + (am.elbow.x - am.hand.x) * 0.24, cy = am.hand.y + (am.elbow.y - am.hand.y) * 0.24;
        const cx2 = am.hand.x + (am.elbow.x - am.hand.x) * 0.12, cy2 = am.hand.y + (am.elbow.y - am.hand.y) * 0.12;
        const cuff = js === 'sheepskin' ? (J.trim || '#e8dcc0') : (js === 'bomber' || js === 'harrington' || js === 'track') ? J.trim : sh(sleeve, -0.25);
        thick(ctx, cx, cy, cx2, cy2, fw, col(cuff, dark));
      }
    }
    drawHand(am, dark);
  };

  // ------------------------------------------------------------------ torso
  const drawTorso = () => {
    const Lt = 14 * s;
    const sw = (5 * Math.min(1.5, bw) + puffy * 0.5) * s;
    const ww = 4 * s * (0.85 + bw * 0.15) + puffy * 0.4 * s;
    const belly = bw > 1.1 ? (bw - 1.1) * 13 * s : 0;
    const extTab = { parka: 4.5, sheepskin: 5.5, suit: 2.2, leather: 1.2, kit: 1.4, tee: 1.0, shirt: 1.4, polo: 1.0 };
    const ext = (extTab[js] ?? 0.6) * s;
    const backExt = js === 'parka' ? ext + 1.4 * s : ext;
    const poly = [T(-sw + 1.2, Lt + 0.6), T(sw - 1.6, Lt + 0.6), T(sw, Lt - 1.6), T(sw + 0.3, Lt - 5.5), T(ww + belly, 3.5),
      T(ww + belly * 0.4, -ext), T(-ww - (js === 'parka' ? 0.6 * s : 0), -backExt), T(-sw + 0.4, Lt - 7), T(-sw, Lt - 1.6)];
    outlinedPoly(ctx, poly, col(torsoCol), OL);
    if (plain) return { Lt, sw, ww, belly, ext };
    const tc = torsoCol;
    // light from above: shoulders lit, back + hem in shadow
    fillPoly(ctx, [T(-sw + 1.2, Lt + 0.6), T(-sw + 2.8, Lt + 0.6), T(-ww + 1.8, -backExt), T(-ww - (js === 'parka' ? 0.6 * s : 0), -backExt), T(-sw + 0.4, Lt - 7), T(-sw, Lt - 1.6)], sh(tc, -0.2));
    line(ctx, T(-sw + 2, Lt - 0.2).x, T(-sw + 2, Lt - 0.2).y, T(sw - 1.8, Lt - 0.2).x, T(sw - 1.8, Lt - 0.2).y, sh(tc, 0.16));
    if (belly > 0.5) {
      const b0 = T(ww + belly - 1.2, 5.5), b1 = T(ww + belly * 0.5 - 1, 0.5);
      line(ctx, b0.x, b0.y, b1.x, b1.y, sh(tc, -0.16));
    }
    const hem = (c, h = 1.8) => {
      fillPoly(ctx, [T(-ww, -ext), T(ww + belly * 0.4, -ext), T(ww + belly * 0.55, -ext + h * s), T(-ww, -ext + h * s)], c);
      for (let u = -ww + 1; u < ww + belly * 0.4; u += 1.6 * s) { const a = T(u, -ext), b = T(u, -ext + h * s - 0.5); line(ctx, a.x, a.y, b.x, b.y, sh(c, -0.22)); }
    };
    const zip = (c, u0 = sw - 1.4, u1 = ww + belly * 0.5 - 0.8) => { const a = T(u0, Lt), b = T(u1, -ext + 1.5 * s); line(ctx, a.x, a.y, b.x, b.y, c); };
    const collar = (c, hgt = 1.8) => { const a = T(-1.4 * s, Lt + 0.8), b = T(sw - 1.5, Lt + 0.6); thick(ctx, a.x, a.y - (hgt - 1), b.x, b.y - (hgt - 1), 2, c); };
    switch (js) {
      case 'harrington': {
        hem(J.trim);
        if (!back) {
          // open front shows the tartan lining
          const lin = J.lining || '#b8302a';
          const a = T(sw - 1.6, Lt - 0.2), b = T(ww + belly * 0.5 - 0.6, -ext + 1.8 * s);
          const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
          for (let i = 0; i <= n; i++) {
            const t = i / n, px2 = Math.round(a.x + (b.x - a.x) * t), py2 = Math.round(a.y + (b.y - a.y) * t);
            ctx.fillStyle = (i % 4 === 1) ? '#e8c84a' : (i % 4 === 3) ? '#1a1418' : lin; ctx.fillRect(px2 - 1, py2, 1, 1);
            ctx.fillStyle = (i % 4 === 2) ? '#1a1418' : (i % 2) ? sh(lin, -0.25) : lin; ctx.fillRect(px2, py2, 1, 1);
          }
          collar(sh(J.color, -0.25));
        } else {
          const a = T(-sw + 0.8, Lt - 3.2 * s), b = T(sw - 0.8, Lt - 3.2 * s); line(ctx, a.x, a.y, b.x, b.y, sh(J.color, -0.22)); // umbrella yoke
          collar(sh(J.color, -0.25));
        }
        break;
      }
      case 'track':
        hem(J.trim, 1.4);
        if (J.panel) fillPoly(ctx, [T(-sw + 1.2, Lt + 0.6), T(sw - 1.6, Lt + 0.6), T(sw, Lt - 1.6), T(sw + 0.2, Lt - 3.4 * s), T(-sw + 0.2, Lt - 3.4 * s)], J.panel);
        if (!back) zip(J.trim);
        else { const a = T(-sw + 1, Lt - 1.5), b = T(sw - 1, Lt - 1.5); line(ctx, a.x, a.y, b.x, b.y, J.trim); }
        collar(J.trim, 1.6);
        break;
      case 'bomber':
        hem(J.trim);
        if (!back) { zip(sh(J.color, -0.3)); const a = T(sw - 2.4, Lt - 0.4); ctx.fillStyle = J.lining || '#e07020'; ctx.fillRect(Math.round(a.x), Math.round(a.y), 2, 2); }
        collar(J.trim, 1.6);
        break;
      case 'parka': {
        const furC = J.trim && J.trim !== sh(J.color, -0.3) ? J.trim : '#9a8a6a';
        const hc = back ? T(-0.6 * s, Lt + 1.2 * s) : T(-sw + 1.4 * s, Lt + 0.8 * s);
        const rx = (back ? 3.8 : 2.8) * s, ry = (back ? 3.0 : 2.4) * s;
        ctx.fillStyle = OL; ellipseFill(ctx, hc.x, hc.y, rx + 1, ry + 1);
        ctx.fillStyle = sh(J.color, -0.1); ellipseFill(ctx, hc.x, hc.y, rx, ry);
        ctx.fillStyle = furC; ellipseFill(ctx, hc.x, hc.y - 1, rx - 1, ry - 1.2);
        ctx.fillStyle = sh(furC, -0.3);
        for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(hc.x - rx + 1.5 + i * rx * 0.4), Math.round(hc.y - 1 + ((i * 7) % 3) - 1), 1, 1);
        if (!back) {
          zip(sh(J.color, -0.32), sw - 1.6, ww + belly * 0.4 - 1);
          const p0 = T(0.4, 3.2 * s), p1 = T(ww - 0.6, 3.2 * s); line(ctx, p0.x, p0.y, p1.x, p1.y, sh(J.color, -0.28));
          const tg = T(ww - 0.4, -ext + 0.4); ctx.fillStyle = '#d8d0b0'; ctx.fillRect(Math.round(tg.x), Math.round(tg.y), 1, 2);
        }
        break;
      }
      case 'leather':
        if (!back) {
          fillPoly(ctx, [T(sw - 3.6, Lt + 0.4), T(sw - 0.6, Lt - 0.6), T(sw - 2.0, Lt - 4.8 * s)], sh(J.color, -0.35));
          const z0 = T(sw - 2.2, Lt - 1.5), z1 = T(ww - 1.4, 0.4); line(ctx, z0.x, z0.y, z1.x, z1.y, '#c8c8d0');
        }
        { const a = T(-sw + 2, Lt - 1.6), b = T(-sw + 2.8, Lt - 5); line(ctx, a.x, a.y, b.x, b.y, sh(J.color, 0.35)); }
        { const a = T(sw - 1.2, Lt - 2.2); ctx.fillStyle = sh(J.color, 0.45); ctx.fillRect(Math.round(a.x), Math.round(a.y), 1, 1); }
        break;
      case 'hivis': {
        const band = '#dfe3ea';
        for (const v of [Lt * 0.33, Lt * 0.56]) {
          const a = T(-ww - 0.3, v), b = T(ww + belly + 0.1, v);
          thick(ctx, a.x, a.y, b.x, b.y, Math.max(2, Math.round(1.6 * s)), band);
          line(ctx, a.x, a.y - 1, b.x, b.y - 1, '#ffffff');
        }
        { const a = T(0.6, Lt + 0.3), b = T(0.6, Lt * 0.56); thick(ctx, a.x, a.y, b.x, b.y, 2, band); }
        if (!back) zip(sh(J.color, -0.3), sw - 1.6, ww + belly * 0.5 - 1);
        break;
      }
      case 'suit':
        if (!back) {
          fillPoly(ctx, [T(sw - 3.4, Lt + 0.4), T(sw - 0.8, Lt + 0.4), T(sw - 1.4, Lt - 6 * s)], L.shirt);
          const t0 = T(sw - 1.7, Lt + 0.2), t1 = T(sw - 1.5, Lt - 6.2 * s); thick(ctx, t0.x, t0.y, t1.x, t1.y, Math.max(1, Math.round(1.4 * s)), J.trim || '#a01818');
          const l0 = T(sw - 3.6, Lt + 0.2), l1 = T(sw - 1.4, Lt - 6.4 * s); line(ctx, l0.x, l0.y, l1.x, l1.y, sh(J.color, -0.35));
          const b0 = T(sw - 1.2, Lt - 8.2 * s); ctx.fillStyle = sh(J.color, 0.3); ctx.fillRect(Math.round(b0.x), Math.round(b0.y), 1, 1);
        }
        break;
      case 'sheepskin': {
        const fur = J.trim && J.trim !== sh(J.color, -0.3) ? J.trim : '#e8dcc0';
        if (!back) { const a = T(sw - 1.3, Lt), b = T(ww + belly * 0.4 - 0.8, -ext); thick(ctx, a.x, a.y, b.x, b.y, 2, fur); }
        { const a = T(-sw + 1.5, Lt + 1.2), b = T(sw - 1.4, Lt + 0.8); thick(ctx, a.x, a.y, b.x, b.y, 3, fur); line(ctx, a.x, a.y + 1, b.x, b.y + 1, sh(fur, -0.2)); }
        { const a = T(-ww + 0.5, -ext + 0.5), b = T(ww + belly * 0.4, -ext + 0.5); line(ctx, a.x, a.y, b.x, b.y, fur); }
        break;
      }
      case 'tee':
        { const a = T(-0.6, Lt + 0.4), b = T(sw - 1.8, Lt + 0.3); line(ctx, a.x, a.y, b.x, b.y, sh(L.shirt, -0.25)); }
        if (J.print && !back) { const p = T(sw - 4 * s, Lt - 4.5 * s); ctx.fillStyle = J.print; ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(2, Math.round(3 * s)), Math.max(2, Math.round(2.4 * s))); }
        break;
      case 'polo':
        collar(J.trim || sh(L.shirt, -0.2), 1.6);
        if (!back) { const a = T(sw - 1.8, Lt), b = T(sw - 1.8, Lt - 3.6 * s); line(ctx, a.x, a.y, b.x, b.y, sh(L.shirt, -0.22)); }
        break;
      case 'shirt':
        if (!back) { zip(sh(J.color, -0.2), sw - 1.6, ww + belly * 0.5 - 1); }
        collar(sh(J.color, 0.25), 1.4);
        break;
      case 'kit': {
        const tr = J.trim || '#f4f1e8';
        const pat = J.pattern || 'plain';
        if (pat === 'stripes') {
          for (let u = -ww + 1.2; u < ww; u += 2.6 * s) { const a = T(u, Lt - 0.6), b = T(u, -ext + 0.4); thick(ctx, a.x, a.y, b.x, b.y, Math.max(1, Math.round(1.2 * s)), tr); }
        } else if (pat === 'hoops') {
          for (let v = 1.4 * s; v < Lt - 1; v += 3.2 * s) { const a = T(-ww + 0.2, v), b = T(ww + belly * 0.8, v); thick(ctx, a.x, a.y, b.x, b.y, Math.max(1, Math.round(1.4 * s)), tr); }
        } else if (pat === 'sash') {
          if (!back) { const a = T(sw - 1.6, Lt - 1), b = T(-ww + 1.2, 0.6); thick(ctx, a.x, a.y, b.x, b.y, Math.max(2, Math.round(2 * s)), tr); }
        }
        { const a = T(-0.4, Lt + 0.4), b = T(sw - 1.8, Lt + 0.3); line(ctx, a.x, a.y, b.x, b.y, tr); }
        if (back && J.num !== undefined) { const p = T(-1.2 * s, Lt - 5.5 * s); ctx.fillStyle = tr; ctx.fillRect(Math.round(p.x - 1), Math.round(p.y), 2, Math.max(3, Math.round(4 * s))); }
        break;
      }
      default: break;
    }
    if (J.badge && !back) { const p = T(sw - 2.6 * s, Lt - 3.2 * s); ctx.fillStyle = J.badge; ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(1.4 * s)), Math.max(1, Math.round(1.4 * s))); }
    return { Lt, sw, ww, belly, ext };
  };

  const drawNeck = () => {
    const nw = Math.max(2, Math.round(3 * s * Math.min(1.45, bw)));
    const tx = neckP.x + (headC.x - neckP.x) * 0.55, ty = neckP.y + (headC.y - neckP.y) * 0.55;
    thick(ctx, neckP.x, neckP.y, tx, ty, nw + 2, OL);
    thick(ctx, neckP.x, neckP.y, tx, ty, nw, col(L.skin, -0.16));
  };

  const drawHead = () => {
    const spr = headSprite(L, face, back, headAng, s * (bw > 1.2 ? 1 + (bw - 1.2) * 0.35 : 1), sil || (flash ? 'flash' : ''));
    ctx.drawImage(spr.c, Math.round(headC.x - spr.half), Math.round(headC.y - spr.half));
  };

  const drawScarf = () => {
    if (!L.scarf) return;
    const a = L.scarf.a, b = L.scarf.b;
    const Lt = 14 * s;
    const t = opts.time || 0;
    const sway = opts.sway || 0;
    const w = Math.max(2, Math.round(2.6 * s));
    // a hanging tail: chain of links that lag behind (wind + movement)
    const tail = (start, base, n, dirSign) => {
      const segL = 2.2 * s;
      const pts = [start];
      let ang = base + rot * 0.85 + lean * 0.5;
      for (let i = 0; i < n; i++) {
        ang += (Math.sin(t * 5.2 - i * 0.9) * 0.08 * (i + 1) - sway * 0.28 * (i + 1) * 0.5) * dirSign + (dirSign > 0 ? 0.03 : -0.02);
        const q = pts[i];
        pts.push({ x: q.x + Math.sin(ang) * segL, y: q.y + Math.cos(ang) * segL });
      }
      for (let i = 0; i < n; i++) thick(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, w + 2, OL);
      for (let i = 0; i < n; i++) thick(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, w, col(i % 2 ? b : a));
      if (!plain) {
        const e = pts[n], pv = pts[n - 1];
        const dx = e.x - pv.x, dy = e.y - pv.y, l = Math.hypot(dx, dy) || 1;
        ctx.fillStyle = b;
        for (let k = -1; k <= 1; k += 2) ctx.fillRect(Math.round(e.x + dx / l * 1.5 + k * 0.9), Math.round(e.y + dy / l * 1.5), 1, Math.max(2, Math.round(2 * s)));
      }
    };
    // knot around the neck
    const p0 = T(-2.2 * s, Lt + 0.4 * s), p1 = T(2.6 * s, Lt + 0.1 * s);
    const wN = Math.max(3, Math.round(3.2 * s));
    thick(ctx, p0.x, p0.y, p1.x, p1.y, wN + 2, OL);
    thick(ctx, p0.x, p0.y, p1.x, p1.y, wN, col(a));
    if (!plain) {
      for (let k = 0.25; k < 1; k += 0.5) {
        const m = { x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k };
        ctx.fillStyle = b; ctx.fillRect(Math.round(m.x), Math.round(m.y - wN / 2), Math.max(1, Math.round(s)), wN);
      }
    }
    if (back) tail(T(-1.8 * s, Lt - 0.2 * s), 0.12, 4, 1);
    else tail(T(2.0 * s, Lt - 0.2 * s), -0.1, 4, 1);
  };

  // ---- paint in depth order ----
  const farDark = -0.28;
  drawLeg(lF, farDark, false);
  drawArm(aF, farDark, false);
  drawLeg(lN, 0, true);
  drawNeck();
  drawTorso();
  drawScarf();
  drawHead();
  drawArm(aN, 0, true);
  if (opts.weapon && opts.weapon.drawHeld && !sil) opts.weapon.drawHeld(ctx, aN.hand.x, aN.hand.y, aN.ang, s, flash);

  ctx.globalAlpha = prevA;
  ctx.restore();
}

function ellipseFill(ctx, cx, cy, rx, ry) {
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    const w = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

// Head-and-shoulders portrait for HUD / menus. Draws into a size x size box at (x,y), facing right.
export function drawPortrait(ctx, look, x, y, size = 24, opts = {}) {
  const L = getNorm(look);
  const face = opts.face || 'angry';
  const k = size / 15;
  ctx.save();
  // shoulders / jacket
  const js = L.jacket.style;
  const jc = js === 'tee' || js === 'polo' ? L.shirt : js === 'hivis' ? L.jacket.color : L.jacket.color;
  const sy = Math.round(y + size * 0.74), sx0 = Math.round(x + size * 0.06), sx1 = Math.round(x + size * 0.94);
  const bot = Math.round(y + size);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(sx0 - 1, sy - 1, sx1 - sx0 + 2, bot - sy + 1);
  ctx.fillStyle = jc; ctx.fillRect(sx0, sy, sx1 - sx0, bot - sy);
  ctx.fillStyle = sh(jc, 0.16); ctx.fillRect(sx0, sy, sx1 - sx0, 1);
  ctx.fillStyle = sh(jc, -0.2); ctx.fillRect(sx0, sy + 1, Math.round(size * 0.18), bot - sy - 1);
  const midx = Math.round(x + size * 0.55);
  if (js === 'harrington') { ctx.fillStyle = L.jacket.lining || '#b8302a'; ctx.fillRect(midx, sy + 1, 2, bot - sy - 1); ctx.fillStyle = '#e8c84a'; ctx.fillRect(midx, sy + 3, 1, 1); }
  else if (js === 'track' || js === 'bomber') { ctx.fillStyle = L.jacket.trim; ctx.fillRect(midx, sy, 1, bot - sy); }
  else if (js === 'hivis') { ctx.fillStyle = '#dfe3ea'; ctx.fillRect(sx0, sy + Math.round(size * 0.14), sx1 - sx0, 2); }
  // neck
  ctx.fillStyle = OUTLINE; ctx.fillRect(Math.round(x + size * 0.38) - 1, Math.round(y + size * 0.6), Math.round(size * 0.24) + 2, Math.round(size * 0.16));
  ctx.fillStyle = sh(L.skin, -0.16); ctx.fillRect(Math.round(x + size * 0.38), Math.round(y + size * 0.6), Math.round(size * 0.24), Math.round(size * 0.16));
  if (L.scarf) {
    const w = Math.max(1, Math.round(k));
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? L.scarf.b : L.scarf.a;
      ctx.fillRect(Math.round(x + size * 0.28) + i * w, sy - w, w, w * 2 + 1);
    }
    ctx.fillStyle = OUTLINE; ctx.fillRect(Math.round(x + size * 0.28), sy + w + 1, w * 8, 1);
  }
  // head
  const spr = headSprite(L, face, false, 0, k, '');
  const hc = { x: x + size * 0.47, y: y + size * 0.38 };
  ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
  ctx.drawImage(spr.c, Math.round(hc.x - spr.half), Math.round(hc.y - spr.half));
  ctx.restore();
}

export { SLEEVELESS };
