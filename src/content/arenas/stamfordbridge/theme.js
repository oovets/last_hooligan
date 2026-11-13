// THEME: STAMFORD BRIDGE (tour arena) — Fulham Broadway tube, the Fulham Road, a King's Road boutique mews,
// the Britannia Gate forecourt, the Shed End building site (1994/95: the old terrace is being rebuilt), the away
// section and the players' car park. Every id registered here starts with 'stamfordbridge_'.
//
// Exports for the level / boss modules: hoistPhase(time, phase) (the hoist hazard timing), BLUE/WHITE colours.

import { registerFloor, registerWall } from '../../../engine/tiles.js';
import { registerProp } from '../../../game/props.js';
import { registerItem } from '../../../game/items.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow, makeCanvas } from '../../../engine/gfx.js';
import { shade } from '../../../engine/color.js';
import { hash2, makeRng } from '../../../engine/rng.js';
import { drawText } from '../../../engine/font.js';
import { Z_PX } from '../../../engine/constants.js';
import { toScreen } from '../../../engine/iso.js';
import { drawDoll } from '../../../game/doll.js';
import { sampleAnim, fillPose, STAND } from '../../../game/poses.js';
import { casualLook } from '../../enemies.js';
import { vnoise } from '../../themes/common.js';

const OL = '#120c14';
export const BLUE = '#034694', WHITE = '#f4f4f4';
const NAVY = '#0a2350', SKY = '#3a78c8', RED = '#c8102e', GOLD = '#e8c040';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const R = (side, c, k = -0.3) => (side === 'right' ? shade(c, k) : c);

// =====================================================================================================
// FLOORS
// =====================================================================================================

// Tube ticket hall: cream terrazzo in big square tiles, dark grout, black & white speckle, scuffed walkway.
registerFloor('stamfordbridge_tube', {
  pixel(u, v, tx, ty, r) {
    const X = tx + u, Y = ty + v;
    if ((X * 2) % 1 < 0.04 || (Y * 2) % 1 < 0.04) return '#6a6458';
    const n = n2(X * 32, Y * 32, 501);
    if (n < 0.05) return '#3a3632';
    if (n > 0.95) return '#f4f0e4';
    const worn = vnoise(X * 0.7, Y * 0.7, 502) > 0.62;
    const base = (Math.floor(X * 2) + Math.floor(Y * 2)) % 2 ? '#c8bea6' : '#beb49c';
    return worn ? shade(base, -0.1) : base;
  },
});

// Forecourt: blue-grey brick paviors in herringbone, a royal blue band every few tiles.
registerFloor('stamfordbridge_forecourt', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (Y % 6 > 5.55) return (X * 4) % 1 < 0.08 ? '#1a2a4a' : '#20407a';         // blue band
    const bx = X * 4, by = Y * 4;
    const k = (Math.floor(bx) + Math.floor(by)) % 2;
    const fu = k ? bx % 1 : by % 1, fv = k ? (by / 2) % 1 : (bx / 2) % 1;
    if (fu < 0.1 || fv < 0.06) return '#3a3e48';
    const s = hash2(Math.floor(bx), Math.floor(by), 503);
    let c = s < 0.3 ? '#6e7480' : s < 0.7 ? '#666c78' : '#727884';
    if (fu < 0.25) c = shade(c, 0.08);
    if (n2(X * 32, Y * 32, 504) < 0.03) c = '#a4a8ae';                           // gum
    return c;
  },
});

// Building site: churned mud, hardcore stones, tyre ruts and the odd puddle.
const MUD = ['#3a2c20', '#45352a', '#4e3e2e', '#5a4836', '#66543e'];
registerFloor('stamfordbridge_site', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const pud = vnoise(X * 0.45, Y * 0.45, 505);
    if (pud > 0.76) return pud > 0.78 ? ((Math.floor((X - Y) * 6) % 3 === 0) ? '#6a7a8a' : '#3a4654') : '#2a2420';
    const rut = (Y + vnoise(X * 0.3, 1, 506) * 1.5) % 5;
    if (rut > 1.2 && rut < 1.45 || rut > 2.3 && rut < 2.55) return (Math.floor(X * 6) % 2) ? '#2a2018' : '#30261c';
    const n = n2(X * 24, Y * 24, 507);
    if (n > 0.9) return n > 0.97 ? '#a8a49c' : '#8a8680';                       // hardcore stones
    const k = 2 + (vnoise(X * 1.3, Y * 1.3, 508) - 0.5) * 3 + (n < 0.1 ? -1 : 0);
    return MUD[Math.max(0, Math.min(4, Math.floor(k)))];
  },
});

// Players' car park: smooth dark tarmac, white bay lines, yellow hatching by the exit, RESERVED stencils.
registerFloor('stamfordbridge_carpark', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const n = n2(X * 32, Y * 32, 509);
    // bays: rows of bays along y=44..47 and y=53..56, lines every 3 tiles
    const inBayRow = (Y > 43.2 && Y < 47.2) || (Y > 53.2 && Y < 57);
    if (inBayRow && (X % 3) < 0.07) return n < 0.15 ? '#a8a8a0' : '#e8e8e0';
    if ((Math.abs(Y - 47.2) < 0.05 || Math.abs(Y - 53.2) < 0.05) && X > 26) return '#d8d8d0';
    // yellow hatched box by the exit gate
    if (X > 53 && Y > 48 && Y < 52) { if (((X + Y) * 2) % 1 < 0.22) return '#e0b020'; if (X < 53.07 || Y < 48.07 || Y > 51.93) return '#e0b020'; }
    const sp = vnoise(X * 1.5, Y * 1.5, 510);
    let c = sp < 0.4 ? '#2a2c32' : sp < 0.7 ? '#2e3036' : '#32343a';
    if (n < 0.06) c = '#222428'; else if (n > 0.97) c = '#4a4c52';
    if (vnoise(X * 0.6, Y * 0.6, 511) > 0.8) c = shade(c, -0.15);              // oil stain
    return c;
  },
});

// King's Road paving: big pale York stone slabs, posh and clean.
registerFloor('stamfordbridge_yorkstone', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const row = Math.floor(Y * 1.5), off = (row % 2) * 0.4;
    const fu = (X * 1.2 + off) % 1, fv = (Y * 1.5) % 1;
    if (fu < 0.03 || fv < 0.04) return '#6a6458';
    const s = hash2(Math.floor(X * 1.2 + off), row, 512);
    let c = s < 0.33 ? '#b4aa94' : s < 0.66 ? '#aca28c' : '#bab09a';
    if (fu < 0.08 || fv < 0.1) c = shade(c, 0.08);
    if (n2(X * 32, Y * 32, 513) < 0.04) c = shade(c, -0.12);
    return c;
  },
});

// Away section flat front: grey concrete, worn, with a blue-painted line at the front edge.
registerFloor('stamfordbridge_terrace', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (v > 0.9 && (Math.floor(X * 2) % 5) !== 0) return '#2a4a8a';
    const n = n2(X * 32, Y * 32, 514);
    if (n < 0.04) return '#26242a';
    if (n > 0.985) return Math.floor(X * 9) % 2 ? RED : WHITE;
    return n < 0.25 ? '#58565e' : '#605e66';
  },
});

// =====================================================================================================
// WALLS
// =====================================================================================================
function brickPx(base, mortar, u, py, side, variant, seed = 0) {
  const bx = u * 16, row = Math.floor(py / 4), off = row % 2 ? 4 : 0;
  if (py % 4 === 3 || Math.floor(bx + off) % 8 === 0) return R(side, mortar);
  const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, 520 + seed);
  return R(side, s < 0.3 ? shade(base, -0.09) : s > 0.85 ? shade(base, 0.1) : base);
}

// Underground ticket hall walls: cream glazed tiles, District line green band, maroon skirting.
registerWall('stamfordbridge_tubeWall', {
  top: '#7a7268',
  face(u, py, side, H) {
    if (py >= H - 4) return R(side, '#5a1a1e');
    const band = Math.floor(H * 0.45);
    if (py >= band && py < band + 4) return R(side, '#007a3a');
    if (py === band + 4 || py === band - 1) return R(side, '#e8e0c8', -0.25);
    const tx = (u * 16) % 4, ty = py % 6;
    const c = (tx < 0.5 || ty === 0) ? '#a89e88' : '#e6dcc4';
    return R(side, c, -0.25);
  },
});

// Fulham Broadway station facade: ox-blood glazed terracotta (the old Underground look), cream stone band.
registerWall('stamfordbridge_tubeFacade', {
  top: '#3a1a18',
  variants: 4,
  face(u, py, side, H, r, variant) {
    if (py < 3) return R(side, '#e8dcc0');
    if (py < 5) return R(side, '#2a0e0e');
    if (py >= 14 && py < 20) return R(side, py === 16 ? '#2a3a7a' : '#e8dcc0');
    if (py >= H - 3) return R(side, '#2a1414');
    const wu = Math.floor(u * 16);
    // tall arched windows
    if (py > 24 && py < H - 10 && wu >= 4 && wu <= 11) {
      if (py < 27) return R(side, '#e8dcc0');
      if (wu === 4 || wu === 11 || wu === 8) return R(side, '#3a1a18');
      return R(side, (py + wu) % 7 === 0 ? '#8ab0c8' : '#2a3a48');
    }
    const blk = (Math.floor(py / 8) + Math.floor(u * 4)) % 2;
    return R(side, (py % 8 === 0 || wu % 4 === 0) ? '#4a1612' : blk ? '#7a2420' : '#842a24');
  },
});

// Ticket office: glass windows with TICKETS lightbox look.
registerWall('stamfordbridge_ticketOffice', {
  top: '#5a5a62',
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    if (py < 6) return R(side, py < 2 ? '#1a1a22' : '#e8e8e0');
    if (py >= H - 14) return R(side, (wu % 4 === 0) ? '#3a3a42' : '#6a6a72');
    if (wu % 8 === 0) return R(side, '#3a3a42');
    return R(side, (py + wu * 2) % 11 < 2 ? '#c8e0f0' : '#5a7a8a');
  },
});

// Victorian pub front: dark green glazed tiles, etched windows, gold-lettered fascia band.
registerWall('stamfordbridge_pub', {
  top: '#2a2420',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    if (py < 3) return R(side, '#1a3a24');
    if (py < 12) return R(side, (py === 4 || py === 10) ? GOLD : '#0e2a1a');             // fascia
    if (py >= H - 6) return R(side, (wu % 4 === 0) ? '#0a1e12' : '#1a4a2a');             // tiled stall riser
    if (variant % 2 === 0 && wu >= 6 && wu <= 9) {                                       // door
      if (wu === 6 || wu === 9) return R(side, '#0a1e12');
      return R(side, py < 22 ? '#d8a050' : '#3a2214');
    }
    if (wu === 0 || wu === 15 || wu === 5 || wu === 10) return R(side, '#0e2a1a');      // pilasters
    // etched glass, warm light inside, a frosted band
    if (py > 22 && py < 27) return R(side, (wu + py) % 2 ? '#e8e0c0' : '#c8c0a0');
    return R(side, (py * 3 + wu * 5) % 13 < 2 ? '#ffe0a0' : '#c88a3a');
  },
});

// King's Road boutiques: white stucco above, big shop windows below, painted fascias in posh colours.
const FASCIA = ['#1a1a1a', '#2a3a5a', '#5a1a2a', '#2a4a3a', '#c8b48a', '#3a2a4a'];
registerWall('stamfordbridge_boutique', {
  top: '#8a8478',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    const shopTop = H - 30;
    if (py < shopTop) {                                                                  // stucco + sash windows
      if (py < 3) return R(side, '#d8d4c8');
      if (py % 14 > 3 && py % 14 < 12 && (wu % 8 > 1 && wu % 8 < 6)) return R(side, (py % 14 === 7) ? '#e8e4d8' : '#3a4a5a');
      return R(side, '#ece8dc', -0.25);
    }
    if (py < shopTop + 6) return R(side, py === shopTop || py === shopTop + 5 ? '#e8e4d8' : FASCIA[variant]);
    if (py >= H - 3) return R(side, '#2a2a2e');
    if (wu === 0 || wu === 15) return R(side, FASCIA[variant]);
    // window: dark glass with lit displays (jackets on rails)
    const hang = py > shopTop + 9 && py < shopTop + 18 && wu % 3 !== 0;
    if (hang) return R(side, ['#c8b48a', '#2a3346', '#e8e0cc', '#4a3a2a', '#1a1a22', '#8a2a2a'][(wu + variant) % 6]);
    return R(side, (py + wu) % 9 === 0 ? '#9ab8c8' : '#2a3440');
  },
});

// Mews houses: pastel painted fronts, garage doors, flower boxes.
const PASTEL = ['#e8c8c8', '#c8d8e8', '#f0e4c0', '#d8e8d0', '#e8d8f0', '#f4f0e8'];
registerWall('stamfordbridge_mews', {
  top: '#6a5a50',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16), c = PASTEL[variant];
    if (py < 3) return R(side, '#5a4a40');
    if (py >= H - 3) return R(side, '#4a4a50');
    if (py > H - 22 && wu >= 2 && wu <= 13) return R(side, (py % 3 === 0) ? '#5a5a62' : (variant % 2 ? '#2a3a5a' : '#4a2a2a'));   // garage door
    if (py > 8 && py < 20 && (wu % 8 > 1 && wu % 8 < 6)) {
      if (py === 19) return R(side, (wu % 2) ? '#d03050' : '#3a8a3a');                   // flower box
      return R(side, py === 14 ? '#f0f0e8' : '#3a4a5a');
    }
    return R(side, c, -0.25);
  },
});

// Blue-painted stadium railings with gold spear tips (see-through).
registerWall('stamfordbridge_railing', {
  top: '#1a2a4a',
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    if (py < 2) return wu % 2 === 0 ? R(side, GOLD) : null;
    if (py === 3 || py === H - 4) return R(side, '#1a3a7a');
    if (wu % 2 === 0) return R(side, py < 4 ? '#1a3a7a' : '#14306a');
    return null;
  },
});

// Brick gate pier: yellow London stock brick, blue & white stone cap.
registerWall('stamfordbridge_pier', {
  top: WHITE,
  face(u, py, side, H, r, variant) {
    if (py < 4) return R(side, py < 2 ? WHITE : BLUE);
    if (py >= 4 && py < 7) return R(side, '#d8d0b8');
    return brickPx('#b8a070', '#6a6050', u, py, side, variant, 1);
  },
});

// The Shed End facade (mid-rebuild): blue profiled cladding, white stripe, scaffold-netted top.
registerWall('stamfordbridge_shed', {
  top: '#2a3040',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    if (py < 6) return R(side, (Math.floor(wu) + py) % 3 === 0 ? '#6a7a5a' : '#2a3a2a');   // green debris netting
    if (py === 6) return R(side, '#9aa0a8');
    if (py >= 12 && py < 16) return R(side, WHITE);
    if (py >= H - 3) return R(side, '#1a1a22');
    const rib = Math.floor(wu * 2) % 4;
    let c = rib === 0 ? '#022e66' : rib === 1 ? '#0a5aaa' : BLUE;
    if (hash2(Math.floor(wu), py, 530 + variant) < 0.02) c = '#3a5a8a';
    return R(side, c);
  },
});

// East Stand concrete: raw grey concrete bays, blue steel, rows of small windows.
registerWall('stamfordbridge_eastStand', {
  top: '#3a3a42',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    if (py < 4) return R(side, BLUE);
    if (py < 6) return R(side, WHITE);
    if (wu % 8 === 0) return R(side, '#1a3a6a');
    if (py % 20 > 8 && py % 20 < 13 && wu % 4 !== 0) return R(side, (wu + variant) % 5 === 0 ? '#ffe0a0' : '#2a3440');
    const n = hash2(wu, py, 531 + variant);
    return R(side, n < 0.06 ? '#5a5a60' : n > 0.94 ? '#8a8a90' : '#74747a');
  },
});

// Scaffolding: galvanised tubes + boards (see-through between the standards); stand on it.
registerWall('stamfordbridge_scaffold', {
  top(u, v) { return ((v * 4) % 1 < 0.12) ? '#4a3a24' : (Math.floor(u * 8) % 3 === 0 ? '#9a7a48' : '#b08a52'); },
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    if (py < 3) return R(side, py === 0 ? '#c8a060' : '#8a6a3a');          // toe board / platform edge
    if (wu === 0 || wu === 15) return R(side, '#b8bcc4');                      // standards
    if (py % 12 === 5 || py === H - 2) return R(side, '#a8acb4');              // ledgers
    if ((wu + py) % 14 === 0 || (wu - py + 280) % 14 === 0) return R(side, '#8a8e96');   // braces
    return null;
  },
});

// Site portakabin: corrugated steel in council blue, window with a kettle glow.
registerWall('stamfordbridge_portakabin', {
  top: '#3a4a5a',
  variants: 3,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    if (py < 3) return R(side, '#2a3a4a');
    if (py >= H - 4) return R(side, '#1a1a20');
    if (variant === 1 && py > 10 && py < 24 && wu >= 4 && wu <= 11) {
      if (py === 11 || py === 23 || wu === 4 || wu === 11) return R(side, '#1a1a22');
      return R(side, py < 17 ? '#ffd890' : '#e0a860');
    }
    return R(side, (wu % 2) ? '#4a6a9a' : '#3a5a8a');
  },
});

// Hoardings around the redevelopment: plywood painted club blue with white lettering blocks.
registerWall('stamfordbridge_hoarding', {
  top: '#5a4a30',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    if (py < 2) return R(side, '#3a3a3a');
    if (py >= H - 2) return R(side, '#2a2a2a');
    if (Math.floor(wu) % 8 === 0) return R(side, '#022e66');
    if (variant % 2 === 0 && py > 10 && py < 24) {                            // abstract white lettering
      const letter = Math.floor(wu) % 3 !== 2 && hash2(Math.floor(wu / 1.5), Math.floor(py / 3), 532 + variant) < 0.55;
      if (letter) return R(side, WHITE);
    }
    return R(side, BLUE);
  },
});

// Terrace step (away section): concrete tread with a blue-painted lip.
registerWall('stamfordbridge_step', {
  top(u, v) {
    if (v > 0.88) return '#2a4a8a';
    const n = hash2(Math.floor(u * 16), Math.floor(v * 16), 533);
    return n < 0.05 ? '#3a383e' : n > 0.97 ? WHITE : ((Math.floor(u * 8) + Math.floor(v * 4)) % 2 ? '#5e5c64' : '#64626a');
  },
  face(u, py, side) { return R(side, py < 2 ? '#3a6ab8' : '#46444c'); },
});

// Away section back stand: rows of blue tip-up seats rising.
registerWall('stamfordbridge_awayStand', {
  top: '#2a2a30',
  variants: 4,
  face(u, py, side, H, r, variant) {
    if (py < 2) return R(side, '#6a6a70');
    const row = Math.floor((py - 2) / 7), fy = (py - 2) % 7;
    const wu = u * 16, seat = Math.floor(wu / 4), fx = wu % 4;
    if (fy === 6) return R(side, '#2a2a2e');
    if (fy >= 4) return R(side, '#5a5a60');
    if (fx < 0.6) return R(side, '#3a3a3e');
    if (hash2(seat + variant * 9, row, 534) < 0.06) return R(side, '#3a3a3e');
    return R(side, (seat + row + variant) % 7 === 0 ? WHITE : (fy === 0 ? SKY : BLUE));
  },
});

// Car park wall: London stock brick with a blue painted coping.
registerWall('stamfordbridge_wall', {
  top: '#3a4a6a',
  variants: 4,
  face(u, py, side, H, r, variant) {
    if (py < 3) return R(side, BLUE);
    if (py >= H - 2) return R(side, '#3a3428');
    return brickPx('#a89468', '#5a5244', u, py, side, variant, 2);
  },
});

// =====================================================================================================
// PROPS
// =====================================================================================================
const SPR = new Map();
function cached(key, w, h, ox, oy, fn) {
  let c = SPR.get(key);
  if (!c) { c = makeCanvas(w, h); fn(c.getContext('2d'), ox, oy); SPR.set(key, c); }
  return c;
}
// face-space text / drawing helpers (decals on a wall tile's visible +y ('left') or +x ('right') face)
const onFace = (ax, ay, side, u, z) => (side === 'left' ? proj(ax, ay, u, 1.02, z) : proj(ax, ay, 1.02, u, z));
function faceDraw(ctx, ax, ay, side, u, z, fn) {
  const m = onFace(ax, ay, side, u, z);
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
  fn(ctx);
  ctx.restore();
}
const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

// ---- crowds: HOME fans (Chelsea: blue & white, booing you) and AWAY fans (Nordhamn: red & white, cheering you)
const LOOKS = { home: [], away: [] };
function fanLook(side, i) {
  if (LOOKS[side][i]) return LOOKS[side][i];
  const home = side === 'home';
  const A = home ? BLUE : RED, B = WHITE;
  const rng = makeRng((home ? 9100 : 9500) + i * 137);
  const L = casualLook(rng, { a: A, b: B, hatChance: 0.3, maskChance: 0.05, hoodChance: 0.05 });
  if (i % 3 === 0) L.jacket = { style: 'tee', color: A };
  else if (i % 3 === 1) L.jacket = home ? rng.pick([{ style: 'harrington', color: '#c8b48a', lining: BLUE }, { style: 'track', color: BLUE, trim: WHITE }, { style: 'parka', color: '#2a3346' }])
    : { style: 'track', color: rng.pick([RED, '#2a2a30']), trim: WHITE };
  L.shirt = rng.pick([A, B, A]);
  L.scarf = rng.chance(0.7) ? { a: A, b: B } : null;
  if (L.hat && L.hat.style === 'beanie') L.hat = { style: 'beanie', color: A, trim: B };
  L.build = rng.range(0.9, 1.25); L.height = rng.range(0.92, 1.02);
  return (LOOKS[side][i] = L);
}
const FAN_POSES = {
  stand: () => ({ ...STAND }),
  cheer0: () => sampleAnim('cheer', 0.0), cheer1: () => sampleAnim('cheer', 0.2),
  boo0: () => ({ ...STAND, lean: 0.15, uaN: 1.5, faN: 0.15, uaF: 0.1, faF: 0.4, head: 0.1 }),
  boo1: () => ({ ...STAND, lean: 0.22, uaN: 1.7, faN: 0.05, uaF: 0.2, faF: 0.5, head: 0.15, dy: 1 }),
  clap0: () => ({ ...STAND, uaN: 1.0, faN: 1.3, uaF: 1.0, faF: 1.4 }),
  clap1: () => ({ ...STAND, uaN: 1.1, faN: 0.9, uaF: 1.1, faF: 1.0, dy: 1 }),
  point0: () => ({ ...STAND, uaN: 1.55, faN: 0.05, lean: 0.1 }),
  point1: () => ({ ...STAND, uaN: 1.7, faN: 0.0, lean: 0.14, dy: 1 }),
};
const fanCache = new Map();
function fanSprite(side, li, pose, flip) {
  const key = side + li + '|' + pose + '|' + (flip ? 1 : 0);
  let c = fanCache.get(key);
  if (c) return c;
  c = makeCanvas(44, 70);
  drawDoll(c.getContext('2d'), 22, 66, fanLook(side, li), fillPose(FAN_POSES[pose]()), { flip, face: pose === 'stand' ? 'normal' : 'shout', time: li });
  fanCache.set(key, c);
  return c;
}
function crowd(world) {
  let S = world.__sbCrowd;
  if (!S) S = world.__sbCrowd = { t: -1, mood: 'idle', kos: 0, cheerT: 0, hurtT: 0, hp: null, cd: 1, bubbles: [] };
  if (S.t !== world.time) {
    const dt = S.t < 0 ? 0 : Math.max(0, Math.min(0.1, world.time - S.t));
    S.t = world.time; S.cheerT -= dt; S.hurtT -= dt; S.cd -= dt;
    if (world.stats && world.stats.kos !== S.kos) { if (world.stats.kos > S.kos) S.cheerT = 1.8; S.kos = world.stats.kos; }
    const p = world.player;
    if (p) { if (S.hp !== null && p.hp < S.hp - 0.5) S.hurtT = 1.4; S.hp = p.hp; }
    let foes = 0;
    if (p) for (const f of world.fighters) if (f.team === 'enemy' && f.alive && Math.hypot(f.x - p.x, f.y - p.y) < 9) foes++;
    S.mood = S.cheerT > 0 ? 'ko' : S.hurtT > 0 ? 'hurt' : foes > 0 ? 'fight' : 'idle';
    for (const b of S.bubbles) b.t += dt;
    S.bubbles = S.bubbles.filter(b => b.t < 1.3);
  }
  return S;
}
// what each side shouts per mood
const SHOUT = {
  home: {
    idle: ['CHELSEA!', 'CAREFREE!', 'COME ON CHELSEA!', 'WHO ARE YA?', 'BLUE ARMY!'],
    fight: ['GO ON, HAVE HIM!', 'HEADHUNTERS!', 'OFF OUR MANOR!', 'YOU\'RE NOT WELCOME!', 'WHO ARE YA?'],
    hurt: ['HAVE THAT!', 'GET IN!', 'BLUE ARMY!', 'OLE!'],
    ko: ['BOOO!', 'OFF!', 'DISGRACE!', 'GET HIM OUT!', 'SOFT!'],
  },
  away: {
    idle: ['NORDHAMN!', 'ANCHORS!', 'WE\'RE ON TOUR!', 'OI OI!', 'COME ON!'],
    fight: ['GO ON SON!', 'GET INTO THEM!', 'ANCHORS!', 'HAVE IT!'],
    hurt: ['GET UP!', 'OOF!', 'COME ON!'],
    ko: ['GET IN!', 'YES!!', 'ANCHORS!', 'LOVELY!', '★ ★ ★'],
  },
};
function fanUpdate(p, world, dt) {
  const S = crowd(world), pl = world.player;
  if (!pl || S.cd > 0) return;
  if (Math.hypot(pl.x - p.cx, pl.y - p.cy) > 11 || Math.random() > dt * 3) return;
  const side = p.o.side || 'home';
  S.cd = S.mood === 'idle' ? 1.6 : 0.6;
  const list = SHOUT[side][S.mood];
  S.bubbles.push({ x: p.cx, y: p.cy, text: list[Math.floor(Math.random() * list.length)], t: 0, col: side === 'home' ? '#a8c8ff' : '#ffb0a0' });
}
registerProp('stamfordbridge_fans', {
  h: 1.7,
  update: fanUpdate,
  draw(ctx, ax, ay, p, t, world) {
    const S = world ? crowd(world) : { mood: 'idle' };
    const side = p.o.side || 'home', flip = !!p.o.flip;
    // the home crowd's joy is your pain and vice versa
    const happy = side === 'home' ? S.mood === 'hurt' : S.mood === 'ko';
    const angry = side === 'home' ? (S.mood === 'ko' || S.mood === 'fight') : S.mood === 'hurt';
    for (const [k, lx, ly] of [[0, 0.3, 0.32], [1, 0.72, 0.74]]) {
      if (k === 0 && p.o.single) continue;
      const hv = hash2(p.x * 3 + k, p.y * 5 + k, 77);
      const li = Math.floor(hv * 10);
      const s = proj(ax, ay, lx + (hv - 0.5) * 0.12, ly, 0);
      const fr = (t * (S.mood === 'idle' ? 1.6 : 4.2) + hv * 7) % 2 < 1 ? 0 : 1;
      let pose;
      if (happy) pose = 'cheer' + fr;
      else if (angry) pose = hv < 0.45 ? 'boo' + fr : hv < 0.7 ? 'point' + fr : 'clap' + fr;
      else pose = hv < 0.3 ? 'clap' + fr : hv < 0.5 ? 'point' + fr : 'stand';
      shadow(ctx, s.x, s.y, 7, 3, 0.3);
      ctx.drawImage(fanSprite(side, li, pose, flip), Math.round(s.x - 22), Math.round(s.y - 66 + (happy && fr ? -2 : 0)));
    }
    if (world && S.bubbles) for (const b of S.bubbles) {
      if (b.x !== p.cx || b.y !== p.cy) continue;
      const s = toScreen(b.x, b.y, 2.9 + b.t * 0.6);
      ctx.globalAlpha = b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.4) : 1;
      drawText(ctx, b.text, s.x, s.y, { color: b.col, align: 'center', outline: '#000' });
      ctx.globalAlpha = 1;
    }
  },
});

// Underground ticket gateline (h 1.0: jump on it, or use the open gate in the middle of a bank).
registerProp('stamfordbridge_gateline', {
  h: 1.0,
  draw(ctx, ax, ay, p, t) {
    const c = cached('gateline', 64, 72, 24, 56, (g, x, y) => {
      isoBox(g, x, y, 0.1, 0.3, 0, 0.8, 0.4, 1.0, { top: '#c8c8c0', left: '#a8a8a8', right: '#7a7a80', outline: OL });
      isoPanel(g, x, y, 'left', 0.1, 0.71, 0.8, 0.55, 0.85, '#1a1a1a');
      isoPanel(g, x, y, 'left', 0.15, 0.71, 0.25, 0.62, 0.78, '#3aa040');
      isoBox(g, x, y, 0.12, 0.32, 1.0, 0.3, 0.36, 0.05, { color: '#4a4a52' });
    });
    ctx.drawImage(c, ax - 24, ay - 56);
    // paddles (red/yellow) and a blinking reader
    const m = proj(ax, ay, 0.5, 0.75, 0.75);
    ctx.fillStyle = Math.floor(t * 2 + p.x) % 2 ? '#3aff7a' : '#1a8a3a'; ctx.fillRect(m.x - 6, m.y - 6, 2, 2);
  },
});

// Underground roundel on a wall face (side 'left' = +y face, 'right' = +x face). o.text = station name.
registerProp('stamfordbridge_roundel', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p) {
    const side = p.o.side || 'left', z = p.o.z ?? 1.6, u = p.o.u ?? 0.5;
    faceDraw(ctx, ax, ay, side, u, z, g => {
      ellipse(g, 0, 0, 11, 11, OL); ellipse(g, 0, 0, 10, 10, '#d81e05'); ellipse(g, 0, 0, 6, 6, '#f4f4f4');
      const t = p.o.text || 'UNDERGROUND', w = Math.max(30, t.length * 5 + 6);
      px(g, OL, -w / 2 - 1, -4, w + 2, 9); px(g, '#0019a8', -w / 2, -3, w, 7);
      drawText(g, t, 0, -3, { color: '#ffffff', align: 'center' });
    });
  },
});

// Club crest: a blue roundel with a rampant lion holding a staff (club-style), on a wall face or a freestanding board.
const LION = [
  '......##.......',
  '.....####...|..',
  '....##.###..|..',
  '.....#####..|..',
  '......####.||..',
  '.....######.|..',
  '....#######.|..',
  '...##.#####.|..',
  '......####..|..',
  '.....##.##..|..',
  '....##...##.|..',
  '...##.....##...',
];
function drawCrest(g, s = 1, ring = true) {
  ellipse(g, 0, 0, 15 * s, 15 * s, OL);
  ellipse(g, 0, 0, 14 * s, 14 * s, ring ? GOLD : WHITE);
  ellipse(g, 0, 0, 12 * s, 12 * s, BLUE);
  for (let r = 0; r < LION.length; r++) for (let c = 0; c < LION[r].length; c++) {
    const ch = LION[r][c];
    if (ch === '#') px(g, WHITE, (c - 7) * s, (r - 6) * s, s, s);
    else if (ch === '|') px(g, GOLD, (c - 7) * s, (r - 6) * s, s, s);
  }
  // red rose/ball accents
  px(g, RED, -9 * s, 7 * s, 2 * s, 2 * s); px(g, RED, 8 * s, 7 * s, 2 * s, 2 * s);
}
registerProp('stamfordbridge_crest', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p) {
    const side = p.o.side || 'left';
    faceDraw(ctx, ax, ay, side, p.o.u ?? 0.5, p.o.z ?? 1.8, g => {
      drawCrest(g, p.o.big ? 2 : 1);
      if (p.o.text) drawText(g, p.o.text, 0, (p.o.big ? 32 : 17), { color: '#ffffff', align: 'center', outline: OL });
    });
  },
});
// Freestanding crest board on two posts (forecourt).
registerProp('stamfordbridge_crestBoard', {
  w: 2, d: 1, h: 1.2,
  draw(ctx, ax, ay, p) {
    const c = cached('crestBoard|' + (p.o.text || ''), 120, 150, 40, 130, (g, x, y) => {
      for (const u of [0.25, 1.75]) { const a = proj(x, y, u, 0.5, 0), b = proj(x, y, u, 0.5, 3.4); thick(g, a.x, a.y, b.x, b.y, 3, OL); thick(g, a.x, a.y, b.x, b.y, 1, '#c8ccd4'); }
      isoPanel(g, x, y, 'left', 0.05, 0.55, 1.9, 2.0, 3.5, OL);
      isoPanel(g, x, y, 'left', 0.1, 0.56, 1.8, 2.05, 3.45, BLUE);
      isoPanel(g, x, y, 'left', 0.1, 0.56, 1.8, 2.05, 2.25, WHITE);
      const m = proj(x, y, 1, 0.57, 2.85);
      g.save(); g.translate(Math.round(m.x), Math.round(m.y)); g.transform(1, 0.5, 0, 1, 0, 0); drawCrest(g, 1); g.restore();
      const tm = proj(x, y, 1, 0.57, 2.12);
      g.save(); g.translate(Math.round(tm.x), Math.round(tm.y)); g.transform(1, 0.5, 0, 1, 0, 0); drawText(g, p.o.text || 'CHELSEA F.C.', 0, -3, { color: BLUE, align: 'center' }); g.restore();
    });
    shadow(ctx, proj(ax, ay, 1, 0.5).x, proj(ax, ay, 1, 0.5).y, 18, 5, 0.25);
    ctx.drawImage(c, ax - 40, ay - 130);
  },
});

// Club flag / banner hanging on a face: blue with white border, text.
registerProp('stamfordbridge_flagBanner', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left', z = p.o.z ?? 1.4;
    faceDraw(ctx, ax, ay, side, p.o.u ?? 0.5, z, g => {
      const w = p.o.bw || 26, h = p.o.hgt || 18;
      px(g, OL, -w / 2 - 1, -1, w + 2, h + 2);
      for (let i = 0; i < w; i++) { const sag = Math.round(Math.sin(t * 2 + i * 0.3 + p.x) * 0.6); px(g, p.o.a || BLUE, -w / 2 + i, sag, 1, h); px(g, p.o.b || WHITE, -w / 2 + i, sag, 1, 2); px(g, p.o.b || WHITE, -w / 2 + i, sag + h - 2, 1, 2); }
      if (p.o.crest) { g.save(); g.translate(0, h / 2); drawCrest(g, 0.5, false); g.restore(); }
      else if (p.o.text) drawText(g, p.o.text, 0, h / 2 - 3, { color: p.o.color || WHITE, align: 'center' });
    });
  },
});

// Turnstile (blue): passable tile with booth posts, a lintel and a rotating 3-arm barrier.
registerProp('stamfordbridge_turnstile', {
  h: 0, solid: false,
  draw(ctx, ax, ay, p, t, world) {
    const c = cached('turnstile', 64, 100, 24, 84, (g, x, y) => {
      isoBox(g, x, y, 0, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a6272', outline: OL });
      isoBox(g, x, y, 0.88, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a6272', outline: OL });
      isoBox(g, x, y, 0, 0, 1.9, 1, 1, 0.3, { top: NAVY, left: BLUE, right: shade(BLUE, -0.35), outline: OL });
    });
    ctx.drawImage(c, ax - 24, ay - 84);
    const m = proj(ax, ay, 0.5, 1.0, 2.05);
    drawText(ctx, 'IN', m.x - 4, m.y - 3, { color: '#ffffff' });
    let spin = 0;
    if (world) for (const f of world.fighters) if (Math.abs(f.x - p.cx) < 0.8 && Math.abs(f.y - p.cy) < 0.8) spin = 1;
    p.ang = (p.ang || 0) + spin * 0.12;
    const hub = proj(ax, ay, 0.3, 0.5, 0.9);
    ctx.fillStyle = OL; ctx.fillRect(hub.x - 3, hub.y - 3, 6, 10);
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(hub.x - 2, hub.y - 2, 4, 8);
    for (let i = 0; i < 3; i++) {
      const a = p.ang + i * 2.094;
      const e = proj(ax, ay, 0.3 + Math.cos(a) * 0.45, 0.5 + Math.sin(a) * 0.45, 0.9);
      thick(ctx, hub.x, hub.y, e.x, e.y, 3, OL); thick(ctx, hub.x, hub.y, e.x, e.y, 1, '#d8dce0');
    }
  },
});

// Boutique display window (King's Road): glass case with a mannequin in a stone-coloured jacket with the compass
// badge on the arm. Breakable (glass); o.secret reveals what's behind.
registerProp('stamfordbridge_window', {
  h: 1.4,
  breakable: { hp: 18, debris: ['#bfe8d0', '#ffffff', '#c8b48a'], sfx: 'glass', drops: [['cash20', 0.6], ['cash5', 0.8]], score: 300 },
  draw(ctx, ax, ay, p) {
    const c = cached('sbwindow|' + (p.o.text || ''), 70, 110, 26, 92, (g, x, y) => {
      isoBox(g, x, y, 0.05, 0.1, 0, 0.9, 0.8, 0.3, { top: '#2a2a2e', left: '#1a1a1e', right: '#121214', outline: OL });
      // mannequin
      const b = proj(x, y, 0.5, 0.5, 0.3);
      px(g, OL, b.x - 1, b.y - 28, 3, 28);
      px(g, OL, b.x - 6, b.y - 30, 13, 16); px(g, '#c8b48a', b.x - 5, b.y - 29, 11, 14);
      px(g, '#b0a07a', b.x - 5, b.y - 22, 11, 1);
      px(g, OL, b.x + 4, b.y - 27, 4, 4); px(g, '#e8c040', b.x + 5, b.y - 26, 2, 2); px(g, '#1a1a1a', b.x + 5, b.y - 24, 2, 1);   // compass badge
      ellipse(g, b.x, b.y - 34, 3, 3, OL); ellipse(g, b.x, b.y - 34, 2, 2, '#e8e0d0');
      // glass
      g.globalAlpha = 0.28;
      isoBox(g, x, y, 0.05, 0.1, 0.3, 0.9, 0.8, 1.6, { top: '#cfe8f0', left: '#9ac8d8', right: '#6a98a8' });
      g.globalAlpha = 1;
      const a1 = proj(x, y, 0.15, 0.9, 0.5), a2 = proj(x, y, 0.4, 0.9, 1.7);
      line(g, a1.x, a1.y, a2.x, a2.y, '#e8f8ff');
      isoBox(g, x, y, 0.05, 0.1, 1.9, 0.9, 0.8, 0.12, { color: '#1a1a1e', outline: OL });
    });
    ctx.drawImage(c, ax - 26, ay - 92);
    if (p.o.text) { const m = proj(ax, ay, 0.5, 0.9, 2.2); drawText(ctx, p.o.text, m.x, m.y - 6, { color: '#ffffff', align: 'center', outline: OL }); }
  },
});

// Cement mixer: orange drum turning on a stand. Breakable (metal).
registerProp('stamfordbridge_mixer', {
  h: 1.1,
  breakable: { hp: 40, debris: ['#e07020', '#8a8a90', '#c8c4b8'], sfx: 'metal', drops: [['brick', 0.7], ['stamfordbridge_pole', 0.4]], score: 150 },
  draw(ctx, ax, ay, p, t) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, s.x, s.y, 14, 6, 0.35);
    for (const [x, y] of [[0.2, 0.3], [0.8, 0.3], [0.2, 0.8], [0.8, 0.8]]) { const a = proj(ax, ay, x, y, 0), b = proj(ax, ay, 0.5, 0.55, 0.6); thick(ctx, a.x, a.y, b.x, b.y, 2, '#5a5a62'); }
    const w1 = proj(ax, ay, 0.15, 0.85, 0.12); ellipse(ctx, w1.x, w1.y, 4, 4, OL); ellipse(ctx, w1.x, w1.y, 2, 2, '#5a5a60');
    const c = proj(ax, ay, 0.5, 0.55, 1.05);
    const rot = t * 3 + p.x;
    ellipse(ctx, c.x, c.y, 11, 9, OL);
    ellipse(ctx, c.x, c.y, 10, 8, '#e07020');
    ellipse(ctx, c.x - 3, c.y - 2, 4, 3, '#f09a4a');
    for (let i = 0; i < 3; i++) { const a = rot + i * 2.09; px(ctx, '#a04a10', c.x + Math.cos(a) * 7, c.y + Math.sin(a) * 5, 2, 2); }
    // mouth with grey slop
    ellipse(ctx, c.x + 7, c.y - 7, 5, 3, OL); ellipse(ctx, c.x + 7, c.y - 7, 4, 2, '#8a8680');
    if (Math.floor(t * 4) % 6 === 0) px(ctx, '#a8a49c', c.x + 9, c.y - 4, 2, 2);
  },
});

// Pallet of bricks: breakable, drops bricks to throw.
registerProp('stamfordbridge_bricks', {
  h: 0.8,
  breakable: { hp: 16, debris: ['#a0503a', '#7a3a2a', '#c8a070'], sfx: 'wood', drops: [['brick', 1], ['brick', 0.6], ['coin', 0.3]], score: 60 },
  draw(ctx, ax, ay) {
    const c = cached('sbbricks', 64, 70, 24, 52, (g, x, y) => {
      const s = proj(x, y, 0.5, 0.5, 0); shadow(g, s.x, s.y, 13, 6, 0.3);
      isoBox(g, x, y, 0.08, 0.08, 0, 0.84, 0.84, 0.14, { top: '#b08a50', left: '#8a6a3a', right: '#5e4626', outline: OL });
      isoBox(g, x, y, 0.12, 0.12, 0.14, 0.76, 0.76, 0.62, { top: '#b0583e', left: '#9a4a34', right: '#6a3022', outline: OL });
      for (let i = 1; i < 5; i++) { const z = 0.14 + i * 0.124; const a = proj(x, y, 0.12, 0.88, z), b = proj(x, y, 0.88, 0.88, z), cc = proj(x, y, 0.88, 0.12, z); line(g, a.x, a.y, b.x, b.y, '#d8c8a8'); line(g, b.x, b.y, cc.x, cc.y, '#a89878'); }
      const st = proj(x, y, 0.5, 0.88, 0.76), st2 = proj(x, y, 0.5, 0.88, 0.14); line(g, st.x, st.y, st2.x, st2.y, '#1a1a1a');
    });
    ctx.drawImage(c, ax - 24, ay - 52);
  },
});

// THE HOIST: a crane hook with a pallet of bricks swinging high over the site. Every 6.5s it lowers fast and slams
// down (the level pairs it with a damage zone). Warning: rattle + a growing shadow + a red light.
export function hoistPhase(time, phase = 0) {
  const k = (time + phase) % 6.5;
  return { k, warn: k > 4.1 && k < 5.1, drop: k >= 5.1 && k < 5.55, down: k >= 5.1 && k < 6.0 };
}
registerProp('stamfordbridge_hoist', {
  w: 2, d: 2, h: 0, solid: false, depthBias: 1.2,
  draw(ctx, ax, ay, p, t, world) {
    const time = world ? world.time : t;
    const H = hoistPhase(time, p.o.phase || 0);
    let z = 4.6;
    if (H.warn) z = 4.6 - (H.k - 4.1) * 0.4;
    else if (H.k >= 5.1 && H.k < 5.25) z = 4.2 * (1 - (H.k - 5.1) / 0.15);
    else if (H.down) z = 0;
    else if (H.k >= 6.0) z = 4.6 * (H.k - 6.0) / 0.5;
    const shake = H.warn ? Math.round(Math.sin(time * 40) * 1.5) : 0;
    const g = proj(ax, ay, 1, 1, 0);
    // shadow / target ring
    const a = H.warn || H.down ? 0.45 : 0.15;
    ctx.globalAlpha = a; ellipse(ctx, g.x, g.y, 18, 9, H.warn ? '#ff3020' : '#000000'); ctx.globalAlpha = a * 0.7; ellipse(ctx, g.x, g.y, 12, 6, '#000000'); ctx.globalAlpha = 1;
    if (H.warn && Math.floor(time * 6) % 2) drawText(ctx, '!', g.x, g.y - 12, { color: '#ff3020', align: 'center', outline: '#000' });
    // cable from far above
    const top = proj(ax, ay, 1, 1, 9);
    const hook = proj(ax, ay, 1, 1, z + 1.3);
    line(ctx, top.x + shake, top.y, hook.x + shake, hook.y, '#2a2a30');
    line(ctx, top.x + 1 + shake, top.y, hook.x + 1 + shake, hook.y, '#5a5a62');
    // slings + pallet of bricks
    const pal = proj(ax, ay, 1, 1, z);
    const sx = pal.x + shake, sy = pal.y;
    line(ctx, hook.x + shake, hook.y, sx - 12, sy - 8, '#3a3a40'); line(ctx, hook.x + shake, hook.y, sx + 12, sy - 8, '#3a3a40');
    ctx.fillStyle = OL; ctx.fillRect(sx - 3, hook.y - 3, 6, 5); ctx.fillStyle = '#e0b020'; ctx.fillRect(sx - 2, hook.y - 2, 4, 3);
    fillPoly(ctx, [{ x: sx - 15, y: sy - 8 }, { x: sx, y: sy - 15 }, { x: sx + 15, y: sy - 8 }, { x: sx, y: sy - 1 }], OL);
    fillPoly(ctx, [{ x: sx - 14, y: sy - 8 }, { x: sx, y: sy - 14 }, { x: sx + 14, y: sy - 8 }, { x: sx, y: sy - 2 }], '#b0583e');
    fillPoly(ctx, [{ x: sx - 15, y: sy - 8 }, { x: sx, y: sy - 1 }, { x: sx, y: sy + 5 }, { x: sx - 15, y: sy - 2 }], '#9a4a34');
    fillPoly(ctx, [{ x: sx, y: sy - 1 }, { x: sx + 15, y: sy - 8 }, { x: sx + 15, y: sy - 2 }, { x: sx, y: sy + 5 }], '#6a3022');
    for (let i = 1; i < 3; i++) { line(ctx, sx - 15, sy - 8 + i * 3, sx, sy - 1 + i * 3, '#d8c8a8'); line(ctx, sx, sy - 1 + i * 3, sx + 15, sy - 8 + i * 3, '#a89878'); }
    // red warning lamp on the hook
    if (H.warn || H.down) { ctx.fillStyle = Math.floor(time * 8) % 2 ? '#ff3020' : '#7a1010'; ctx.fillRect(sx - 1, hook.y - 5, 3, 2); }
    if (world && H.k >= 5.1 && H.k < 5.15 && !p.__dusted) { p.__dusted = true; world.fx.dust(p.cx, p.cy, 0, 14); world.camera && world.camera.shake(4, 0.25); world.sfx && world.sfx('wallSlam', { x: p.cx, y: p.cy }); }
    if (H.k < 5) p.__dusted = false;
  },
});

// Flash motor (players' car park): low wedge sports car, w 4 x d 2, along x. o.color, o.roof.
registerProp('stamfordbridge_sportscar', {
  w: 4, d: 2, h: 1.2,
  breakable: { hp: 60, debris: ['#c8102e', '#1a1a1a', '#bfe8d0'], sfx: 'metal', drops: [['cash20', 1], ['cash20', 0.5]], score: 500, leaves: 'stamfordbridge_wreck' },
  draw(ctx, ax, ay, p) {
    const col = p.o.color || RED;
    const c = cached('sportscar|' + col, 200, 120, 60, 80, (g, x, y) => {
      const s = proj(x, y, 2, 1, 0); shadow(g, s.x, s.y, 46, 16, 0.35);
      const wh = (wx, wy) => { const q = proj(x, y, wx, wy, 0.22); ellipse(g, q.x, q.y, 6, 5, '#0c0c0e'); ellipse(g, q.x, q.y, 3, 2, '#b8bcc4'); };
      wh(0.7, 1.75); wh(3.2, 1.75);
      isoBox(g, x, y, 0.15, 0.25, 0.2, 3.7, 1.5, 0.5, { top: shade(col, 0.15), left: col, right: shade(col, -0.32), outline: OL });
      // cabin: raked glass
      fillPoly(g, [proj(x, y, 1.3, 0.4, 0.7), proj(x, y, 2.7, 0.4, 0.7), proj(x, y, 2.5, 0.45, 1.15), proj(x, y, 1.7, 0.45, 1.15)], OL);
      fillPoly(g, [proj(x, y, 1.3, 1.6, 0.7), proj(x, y, 2.7, 1.6, 0.7), proj(x, y, 2.5, 1.55, 1.15), proj(x, y, 1.7, 1.55, 1.15)], '#2a3a4a');
      fillPoly(g, [proj(x, y, 1.7, 0.45, 1.15), proj(x, y, 2.5, 0.45, 1.15), proj(x, y, 2.5, 1.55, 1.15), proj(x, y, 1.7, 1.55, 1.15)], p.o.roof || shade(col, -0.2));
      fillPoly(g, [proj(x, y, 2.7, 0.4, 0.7), proj(x, y, 2.7, 1.6, 0.7), proj(x, y, 2.5, 1.55, 1.15), proj(x, y, 2.5, 0.45, 1.15)], '#1a2430');
      // spoiler + lights
      isoBox(g, x, y, 0.2, 0.35, 0.75, 0.15, 1.3, 0.12, { color: shade(col, -0.3), outline: OL });
      isoPanel(g, x, y, 'right', 3.86, 0.4, 0.3, 0.45, 0.6, '#fff8d0'); isoPanel(g, x, y, 'right', 3.86, 1.3, 0.3, 0.45, 0.6, '#fff8d0');
      isoPanel(g, x, y, 'left', 0.3, 1.76, 3.3, 0.38, 0.42, shade(col, 0.3));
    });
    ctx.drawImage(c, ax - 60, ay - 80);
  },
});
registerProp('stamfordbridge_wreck', {
  w: 4, d: 2, h: 0.7,
  draw(ctx, ax, ay) {
    const s = proj(ax, ay, 2, 1, 0); shadow(ctx, s.x, s.y, 44, 14, 0.4);
    isoBox(ctx, ax, ay, 0.2, 0.3, 0, 3.6, 1.4, 0.55, { top: '#3a3a3e', left: '#2a2a2e', right: '#1a1a1e', outline: OL });
    for (let i = 0; i < 6; i++) { const q = proj(ax, ay, 0.5 + i * 0.55, 0.9, 0.6); ctx.fillStyle = i % 2 ? '#bfe8d0' : '#7a1010'; ctx.fillRect(q.x, q.y, 2, 1); }
  },
});

// Hanging pub sign on a bracket in front of a face.
registerProp('stamfordbridge_pubSign', {
  h: 0, solid: false, depthBias: 0.05,
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    const base = onFace(ax, ay, side, 0.5, 2.6);
    const out = side === 'left' ? proj(ax, ay, 0.5, 1.6, 2.6) : proj(ax, ay, 1.6, 0.5, 2.6);
    thick(ctx, base.x, base.y, out.x, out.y, 2, OL);
    const sw = Math.round(Math.sin(t * 1.6 + p.x) * 1.5);
    ctx.fillStyle = OL; ctx.fillRect(out.x - 11 + sw, out.y + 2, 22, 20);
    ctx.fillStyle = '#0e2a1a'; ctx.fillRect(out.x - 10 + sw, out.y + 3, 20, 18);
    ctx.save(); ctx.translate(out.x + sw, out.y + 12); drawCrest(ctx, 0.5, true); ctx.restore();
    if (p.o.text) drawText(ctx, p.o.text, out.x + sw, out.y + 24, { color: GOLD, align: 'center', outline: OL });
  },
});

// Red phone box is common ('phonebox'); here's a London Underground-style map board on posts for flavour.
registerProp('stamfordbridge_mapBoard', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p) {
    const side = p.o.side || 'left';
    faceDraw(ctx, ax, ay, side, p.o.u ?? 0.5, p.o.z ?? 1.5, g => {
      px(g, OL, -15, -10, 30, 20); px(g, '#f4f0e4', -14, -9, 28, 18);
      // district line (green) and a few stops
      px(g, '#007a3a', -12, 0, 24, 2); for (let i = -10; i <= 10; i += 5) px(g, '#f4f0e4', i, 0, 1, 2);
      px(g, '#d81e05', -1, -1, 3, 4);
      drawText(g, 'DISTRICT', 0, -8, { color: '#007a3a', align: 'center' });
    });
  },
});

// =====================================================================================================
// ITEMS
// =====================================================================================================
registerItem('stamfordbridge_cuppa', {
  name: 'BUILDER\'S TEA', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 4, y - 10, 9, 10); px(ctx, '#f4f0e4', x - 3, y - 9, 7, 9); px(ctx, '#8a5a2a', x - 3, y - 9, 7, 2);
    px(ctx, BLUE, x - 3, y - 5, 7, 2); px(ctx, OL, x + 4, y - 7, 2, 4);
    const k = (t * 1.5) % 1; px(ctx, 'rgba(255,255,255,0.7)', x - 1 + Math.round(Math.sin(t * 5) * 1.5), y - 12 - Math.round(k * 4), 1, 2);
  },
});
registerItem('stamfordbridge_pole', {
  name: 'SCAFFOLD TUBE', kind: 'weapon', score: 0,
  weapon: { dmg: 13, reach: 1.75, durability: 7, attack: 'swing', knockdown: true, throwDmg: 15, breaks: 'metal' },
  icon(ctx, x, y) { px(ctx, OL, x - 9, y - 5, 19, 4); px(ctx, '#b8bcc4', x - 8, y - 4, 17, 2); px(ctx, '#e8ecf0', x - 8, y - 4, 17, 1); px(ctx, '#5a5a62', x + 6, y - 5, 2, 4); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 17 * s, ey = hy + dy * 17 * s, bx = hx - dx * 3, by = hy - dy * 3;
    thick(ctx, bx, by, ex, ey, 4, OL); thick(ctx, bx, by, ex, ey, 2, flash ? '#ffffff' : '#b8bcc4');
    line(ctx, bx, by - 1, ex, ey - 1, '#e8ecf0');
  },
});
