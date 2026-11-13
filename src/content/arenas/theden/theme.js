// THEME: THE DEN (tour arena) — South Bermondsey station, the fenced walkway ("the cage"), the railway arches with
// their lock-ups and car breakers, the scrapyard, the Zampa Road industrial estate, Cold Blow Lane and the forecourt
// in front of the ground. Every id registered here starts with 'theden_'.
//
// Exports for the level / boss modules:
//   NAVY, WHITE                      club colours
//   archTrain(time)                  the overhead train on the viaduct: { on, x (front), k } (deterministic)
//   brickDrop(time, zx)              loose bricks shaken out of the arch at x = zx after a train has gone over
//   spawnStationTrain(world, v)      custom draw (1-tile slice actors) for the station traffic hazard
//   addViaductTrain(world)           persistent actors drawing the overhead train on top of the viaduct
//   drawSkyline(ctx, world)          the Docklands skyline north of the map (level drawGround)

import { registerFloor, registerWall } from '../../../engine/tiles.js';
import { registerProp } from '../../../game/props.js';
import { registerItem } from '../../../game/items.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow, makeCanvas } from '../../../engine/gfx.js';
import { shade } from '../../../engine/color.js';
import { hash2, makeRng } from '../../../engine/rng.js';
import { drawText } from '../../../engine/font.js';
import { toScreen } from '../../../engine/iso.js';
import { drawDoll } from '../../../game/doll.js';
import { sampleAnim, fillPose, STAND } from '../../../game/poses.js';
import { casualLook } from '../../enemies.js';
import { vnoise, brickFace } from '../../themes/common.js';

const OL = '#120c14';
export const NAVY = '#0b2c6b', WHITE = '#f4f4f4';
const ROYAL = '#1d4fa8', RED = '#c8102e', GOLD = '#e8c040';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const R = (side, c, k = -0.3) => (side === 'right' ? shade(c, k) : c);
const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

// =====================================================================================================
// FLOORS
// =====================================================================================================

// Station platform: grey concrete slabs with a tarmac patch or two, chewing gum, a cigarette end.
registerFloor('theden_platform', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if ((X * 1.5) % 1 < 0.035 || (Y * 1.5) % 1 < 0.035) return '#4a4a4e';
    const patch = vnoise(X * 0.35, Y * 0.35, 701) > 0.7;
    const n = n2(X * 32, Y * 32, 702);
    let c = patch ? (n < 0.5 ? '#3a3a40' : '#404046') : (n < 0.3 ? '#7a7a7e' : n < 0.7 ? '#828286' : '#8a8a8c');
    if (n > 0.985) c = '#b8b8b0';
    if (n < 0.012) c = '#e8e0c8';                                                   // fag end
    return c;
  },
});
// Platform edge: white-painted coping with the yellow line behind it.
registerFloor('theden_platEdge', {
  pixel(u, v, tx, ty) {
    if (v < 0.3) return (Math.floor((tx + u) * 4) % 2) ? '#d8d8d0' : '#c8c8c0';
    if (v > 0.55 && v < 0.68) return '#e8c020';
    const n = n2((tx + u) * 32, (ty + v) * 32, 703);
    return n < 0.5 ? '#7e7e82' : '#86868a';
  },
});
// Track: ballast, timber sleepers across, two rails running along x (and a third conductor rail: Southern Region).
registerFloor('theden_track', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const lv = (Y - 1) / 2;                                                         // the track spans y 1..3
    const rail = Math.abs(lv - 0.28) < 0.025 || Math.abs(lv - 0.72) < 0.025;
    if (rail) return Math.floor(X * 8) % 2 ? '#b8bcc4' : '#9aa0a8';
    if (Math.abs(lv - 0.88) < 0.022) return '#8a7a5a';                              // the conductor rail
    if ((X * 2.2) % 1 < 0.32 && lv > 0.12 && lv < 0.86) return n2(X * 2.2, 1, 704) < 0.5 ? '#3a2c20' : '#45352a';
    const n = n2(X * 24, Y * 24, 705);
    return n < 0.3 ? '#4a463e' : n < 0.6 ? '#5a554c' : n < 0.9 ? '#66605a' : '#7a7468';
  },
});
// Booking hall: red quarry tiles, worn grey in the middle.
registerFloor('theden_hall', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if ((X * 2) % 1 < 0.05 || (Y * 2) % 1 < 0.05) return '#3a2a24';
    const worn = vnoise(X * 0.5, Y * 0.5, 706) > 0.6;
    const s = hash2(Math.floor(X * 2), Math.floor(Y * 2), 707);
    const c = s < 0.4 ? '#8a3a2a' : s < 0.8 ? '#7e3426' : '#94402e';
    return worn ? shade(c, -0.18) : c;
  },
});
// The walkway: cracked tarmac between the fences, litter, puddles, a painted arrow.
registerFloor('theden_walkway', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (vnoise(X * 0.6, Y * 0.6, 708) > 0.78) return Math.floor((X - Y) * 5) % 3 ? '#2a3038' : '#4a5664';
    const crack = Math.abs(vnoise(X * 1.4, Y * 0.3, 709) - 0.5) < 0.02;
    if (crack) return '#1c1c20';
    const n = n2(X * 32, Y * 32, 710);
    if (n > 0.985) return ['#e8e0c8', '#c8102e', '#f4f4f4'][Math.floor(n * 1000) % 3];
    return n < 0.4 ? '#34343a' : n < 0.8 ? '#3a3a40' : '#424248';
  },
});
// Wasteland / railway embankment: scrubby grass, mud, gravel and buddleia shoots.
registerFloor('theden_scrub', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const mud = vnoise(X * 0.4, Y * 0.4, 711);
    const n = n2(X * 24, Y * 24, 712);
    if (mud > 0.68) return n < 0.5 ? '#4a3c2c' : '#55463a';
    if (n > 0.93) return n > 0.975 ? '#9a6ab8' : '#6a7a3a';                         // buddleia / dock leaves
    return ['#3a4a28', '#44542e', '#4e5e34', '#58663a'][Math.floor(vnoise(X * 1.5, Y * 1.5, 713) * 4)];
  },
});
// Cobbled lane under the arches: granite setts, oil, a rusty drain line.
registerFloor('theden_setts', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const row = Math.floor(Y * 3), off = (row % 2) * 0.5;
    const fu = (X * 2.5 + off) % 1, fv = (Y * 3) % 1;
    if (fu < 0.1 || fv < 0.12) return '#1e1c1e';
    const s = hash2(Math.floor(X * 2.5 + off), row, 714);
    let c = s < 0.3 ? '#4a4850' : s < 0.7 ? '#545260' : '#5c5a66';
    if (fu < 0.3 && fv < 0.45) c = shade(c, 0.12);
    if (vnoise(X * 0.5, Y * 0.5, 715) > 0.72) c = shade(c, -0.3);                   // oil
    return c;
  },
});
// Inside the arches: black oily concrete.
registerFloor('theden_archFloor', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const n = n2(X * 32, Y * 32, 716);
    if (vnoise(X * 0.8, Y * 0.8, 717) > 0.66) return '#141416';
    return n < 0.5 ? '#26262a' : n < 0.95 ? '#2c2c30' : '#4a4a4e';
  },
});
// Scrapyard: oily mud, rust flakes, glass, tyre tracks.
registerFloor('theden_yard', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const rut = (X + vnoise(1, Y * 0.3, 718) * 1.5) % 6;
    if ((rut > 1.2 && rut < 1.5) || (rut > 2.6 && rut < 2.9)) return Math.floor(Y * 6) % 2 ? '#241c16' : '#2a2018';
    const n = n2(X * 24, Y * 24, 719);
    if (n > 0.95) return n > 0.985 ? '#a8c8c0' : '#8a4a24';                         // glass / rust
    if (vnoise(X * 0.5, Y * 0.5, 720) > 0.74) return '#1a1614';                     // sump oil
    return ['#3a3026', '#433628', '#4c3e2e', '#3e342a'][Math.floor(vnoise(X * 1.2, Y * 1.2, 721) * 4)];
  },
});
// Forecourt: big paving slabs, a navy band every few tiles.
registerFloor('theden_forecourt', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (Y % 7 > 6.6) return (X * 3) % 1 < 0.06 ? '#0a1e48' : NAVY;
    if (X % 1 < 0.04 || Y % 1 < 0.04) return '#4e4e54';
    const s = hash2(Math.floor(X), Math.floor(Y), 722);
    let c = s < 0.3 ? '#7a7a80' : s < 0.7 ? '#727278' : '#808086';
    const n = n2(X * 32, Y * 32, 723);
    if (n < 0.03) c = '#a8a8ae';                                                    // gum
    if (n > 0.992) c = WHITE;                                                       // a torn ticket
    return c;
  },
});
// Cold Blow Lane: patched black tarmac, faded yellow lines along the kerb, the odd pothole.
registerFloor('theden_lane', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (X > 52.05 && X < 52.25 && (Y * 2) % 1 < 0.8) return '#c8a830';
    if (vnoise(X * 0.7, Y * 0.7, 724) > 0.8) return '#16161a';
    const patch = vnoise(X * 0.3, Y * 0.3, 725) > 0.62;
    const n = n2(X * 32, Y * 32, 726);
    if (patch) return n < 0.5 ? '#2a2a2e' : '#2e2e33';
    return n < 0.4 ? '#36363c' : n < 0.85 ? '#3c3c42' : '#46464c';
  },
});
// The transport cafe (behind the units): chequered lino.
registerFloor('theden_cafe', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    const k = (Math.floor(X * 2) + Math.floor(Y * 2)) % 2;
    const n = n2(X * 32, Y * 32, 727);
    return k ? (n < 0.1 ? '#a8a090' : '#c8c0b0') : (n < 0.1 ? '#1e2a3a' : '#28344a');
  },
});

// =====================================================================================================
// WALLS
// =====================================================================================================
const stockBrick = brickFace('#8a7a5e', '#3a3228');      // sooty London stock brick
const sootBrick = brickFace('#5e4e40', '#2a221c');       // the arches: a hundred years of steam

// Station back wall: sooty brick, a band of faded Network SouthEast posters.
registerWall('theden_stationWall', {
  top: '#3a3430',
  variants: 4,
  face(u, py, side, H, r, variant) {
    if (py > 14 && py < 38) {
      const wu = Math.floor(u * 16);
      if (wu === 0 || wu === 15) return R(side, '#2a2a30');
      if (py === 15 || py === 37) return R(side, '#1a1a20');
      const pc = [['#e8e0c8', RED], ['#2a3a7a', WHITE], ['#e8c040', '#1a1a20'], ['#c8d8e8', NAVY]][variant];
      if (py < 20) return R(side, pc[1]);
      return R(side, (py + wu * 3) % 9 < 2 ? shade(pc[0], -0.25) : pc[0]);
    }
    return stockBrick(u, py, side, H, r, variant);
  },
});
// Station building / booking hall front: brick with the red-white-blue stripe under the cornice.
registerWall('theden_hallFront', {
  top: '#3a3430',
  variants: 4,
  face(u, py, side, H, r, variant) {
    if (py >= 6 && py < 12) return R(side, py < 8 ? RED : py < 10 ? WHITE : '#1a3a8a');
    const wu = Math.floor(u * 16);
    if (variant % 2 === 0 && py > 20 && py < H - 8 && wu > 3 && wu < 12) {           // barred window
      if (wu % 3 === 0) return R(side, '#2a2a30');
      return R(side, (py + wu) % 7 === 0 ? '#c8d8e0' : '#3a4a58');
    }
    return stockBrick(u, py, side, H, r, variant);
  },
});
// Low partition walls in the booking hall: cream panels, blue skirting.
registerWall('theden_hallLow', {
  top: '#5a5a62',
  face(u, py, side, H) {
    if (py < 2) return R(side, '#3a3a42');
    if (py >= H - 5) return R(side, '#1a3a8a');
    return R(side, Math.floor(u * 16) % 8 === 0 ? '#b8b0a0' : '#ddd5c4');
  },
});
// Chain-link fence on concrete posts, two strands of barbed wire (see-through).
function chainFace(u, py, side, H, hole) {
  const wu = u * 16;
  if (Math.floor(wu) === 0) return R(side, '#8a8a8a');                              // concrete post
  if (py < 4) return (py === 1 || py === 3) && Math.floor(wu * 2) % 3 !== 0 ? R(side, '#6a6a70') : null;
  if (py === 4 || py === H - 1) return R(side, '#7a7e86');
  if (hole) {                                                                        // somebody brought bolt cutters
    const dx = (wu - 8) / 5.5, dy = (py - H * 0.62) / (H * 0.36);
    if (dx * dx + dy * dy < 1) return Math.abs(dx * dx + dy * dy - 0.92) < 0.08 ? R(side, '#9aa0a8') : null;
  }
  const a = (Math.floor(wu * 1.5) + py) % 4, b = (Math.floor(wu * 1.5) - py + 400) % 4;
  return a === 0 || b === 0 ? R(side, '#8a9098', -0.2) : null;
}
registerWall('theden_fence', { top: '#6a6a70', face: (u, py, side, H) => chainFace(u, py, side, H, false) });
registerWall('theden_fenceCut', { top: '#6a6a70', face: (u, py, side, H) => chainFace(u, py, side, H, true) });

// The viaduct: sooty brick; the top is ballast, and the 'track' rows carry rails along x.
function ballast(u, v) {
  const n = hash2(Math.floor(u * 16), Math.floor(v * 16), 730);
  return n < 0.3 ? '#3e3a34' : n < 0.7 ? '#4a463e' : '#56524a';
}
registerWall('theden_viaduct', { top: (u, v) => ballast(u, v), variants: 4, face: (u, py, side, H, r, variant) => sootBrick(u, py, side, H, r, variant) });
registerWall('theden_viaductTrack', {
  top(u, v) {
    if (Math.abs(v - 0.28) < 0.04 || Math.abs(v - 0.72) < 0.04) return '#9aa0a8';
    if ((u * 2.5) % 1 < 0.3 && v > 0.14 && v < 0.86) return '#3a2c20';
    return ballast(u, v);
  },
  variants: 4,
  face: (u, py, side, H, r, variant) => sootBrick(u, py, side, H, r, variant),
});
// The front of the viaduct: a run of arches, three tiles to an arch (theden_arch0/1/2 = left haunch, crown, right
// haunch). Each arch has a corrugated roller door. Blue engineering-brick voussoirs, a parapet on top.
function archFace(k) {
  return (u, py, side, H, r, variant) => {
    const U = (k + u) / 3, ax = (U - 0.5) * 48;                                     // px from the arch centre
    const spring = H - 44, R0 = 19;
    const open = Math.abs(ax) < R0 && (py >= spring || py >= spring - Math.sqrt(Math.max(0, R0 * R0 - ax * ax)));
    if (py < 4) return R(side, py < 2 ? '#7a7670' : '#4a4640');                       // parapet coping
    if (open) {
      if (py < spring - 12 + Math.abs(ax) * 0.3) return R(side, '#0e0c0e');            // dark fanlight above the door
      if (py >= H - 2) return R(side, '#1a1a1a');
      const slat = py % 3 === 0;
      const rust = vnoise(U * 9, py * 0.12, 731) > 0.62;
      let c = slat ? '#3e4a44' : '#5a6a62';
      if (rust) c = slat ? '#4a2e1e' : '#7a4a2a';
      if (Math.abs(ax + 10) < 2 && py > H - 9 && py < H - 6) c = '#c8c8c0';            // padlock hasp
      return R(side, c);
    }
    const dr = Math.hypot(ax, Math.max(0, spring - py)) - R0;
    if (py < spring && dr >= 0 && dr < 4) return R(side, (Math.floor(Math.atan2(spring - py, ax) * 7)) % 2 ? '#2a2e3a' : '#343846');
    if (py > H - 6 && Math.abs(ax) > R0 + 2) return R(side, '#3a3430');               // damp at the foot of the pier
    return sootBrick(u, py, side, H, r, variant);
  };
}
for (const k of [0, 1, 2]) registerWall('theden_arch' + k, { top: (u, v) => (v > 0.82 ? '#6a6660' : ballast(u, v)), variants: 4, face: archFace(k) });

// Corrugated sheet fence round the scrapyard: rust, odd panels, painted warnings.
registerWall('theden_corrugated', {
  top: '#5a4232',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    const s = Math.floor(wu) % 3;
    const panel = (Math.floor(wu / 5) + variant) % 4;
    const base = ['#6a5e52', '#7a4a2e', '#5a6060', '#4a5a4a'][panel];
    let c = s === 0 ? shade(base, -0.2) : s === 1 ? base : shade(base, 0.1);
    if (vnoise(wu * 0.3, py * 0.15, 732 + variant) > 0.68) c = s === 1 ? '#8a4a24' : '#6a3a1e';
    if (py < 2) c = '#3a3028';
    if (variant === 1 && py > 8 && py < 18 && wu > 2 && wu < 14 && (Math.floor(wu) + py) % 5 < 2) c = '#e8e0c8';   // daubed letters
    return R(side, c);
  },
});
// Industrial units (Zampa Road): grey profiled cladding, roller shutters, unit numbers, a strip of orange light.
registerWall('theden_unit', {
  top: '#4a4c52',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    if (py < 3) return R(side, '#2a2c32');
    if (py < 9) return R(side, ['#1a3a8a', '#8a1a1a', '#2a5a3a', '#4a4a4e', '#e0a020', '#1a1a1e'][variant]);   // company fascia
    if (py > 14 && variant % 3 !== 2 && wu >= 2 && wu <= 13) {                      // roller shutter
      if (wu === 2 || wu === 13) return R(side, '#2a2c30');
      if (py >= H - 2) return R(side, '#1a1a1e');
      return R(side, py % 3 === 0 ? '#6a6c72' : '#8a8c92');
    }
    if (py > 16 && py < 26 && wu > 4 && wu < 11) return R(side, (py + wu) % 6 === 0 ? '#ffd890' : '#3a3a42');   // office window
    return R(side, wu % 3 === 0 ? '#5a5c62' : '#6e7076');
  },
});
// The cafe's front (fake: you can walk through the door): steamed-up window, red and white fascia.
registerWall('theden_cafeFront', {
  top: '#4a4c52',
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    if (py < 3) return R(side, '#2a2c32');
    if (py < 9) return R(side, py % 2 ? RED : WHITE);
    if (py >= H - 3) return R(side, '#2a2a2e');
    if (wu === 0 || wu === 15) return R(side, '#5a5c62');
    return R(side, (py * 3 + wu * 5) % 11 < 3 ? '#f0e8d8' : '#c8b8a0');                // steamed-up window
  },
});
// Low brick wall with a coping (south edges, so it never hides the fight behind it).
registerWall('theden_lowWall', { top: '#5a5450', variants: 4, face: (u, py, side, H, r, variant) => stockBrick(u, py, side, H, r, variant) });
// Low steel railings painted blue (see-through).
registerWall('theden_railings', {
  top: '#1a2a4a',
  face(u, py, side, H) {
    const wu = Math.floor(u * 16);
    if (py < 2) return wu % 2 === 0 ? R(side, '#2a4a8a') : null;
    if (py === 3 || py === H - 3) return R(side, '#1a3a7a');
    if (wu % 3 === 0) return R(side, '#14306a');
    return null;
  },
});
// Stack of crushed cars: squashed bodies in layers, one colour each (stand on it).
const CAR_COLS = ['#8a2020', '#2a4a8a', '#d8d8d0', '#2a6a3a', '#c8a020', '#5a5a60', '#6a3a6a', '#1a1a1e'];
registerWall('theden_scrapStack', {
  top(u, v, variant) { return hash2(Math.floor(u * 6), Math.floor(v * 6), 733 + variant) < 0.5 ? '#6a3a20' : '#5a5a5e'; },
  variants: 4,
  face(u, py, side, H, r, variant) {
    const layer = Math.floor(py / 8), fy = py % 8;
    const col = CAR_COLS[(layer * 3 + variant * 5) % CAR_COLS.length];
    const wu = u * 16;
    if (fy === 7 || fy === 0) return R(side, '#1a1614');
    if (fy === 3 && (Math.floor(wu) + layer) % 5 > 1) return R(side, '#2a3a44');      // flattened windows
    let c = col;
    if (vnoise(wu * 0.25, py * 0.25, 734 + variant) > 0.66) c = '#7a4224';             // rust
    return R(side, (Math.floor(wu) + fy) % 6 === 0 ? shade(c, -0.25) : c);
  },
});
// THE DEN: the stand's blue cladding, a white band and a grey block plinth.
registerWall('theden_stand', {
  top: '#2a3040',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = u * 16;
    if (py < 4) return R(side, '#c8ccd4');
    if (py >= 10 && py < 14) return R(side, WHITE);
    if (py >= H - 14) return R(side, (Math.floor(py / 4) + Math.floor(wu / 8)) % 2 ? '#5a5c62' : '#64666c');   // block plinth
    const rib = Math.floor(wu * 2) % 4;
    let c = rib === 0 ? '#08224e' : rib === 1 ? '#14408a' : NAVY;
    if (hash2(Math.floor(wu), py, 735 + variant) < 0.015) c = '#3a5a8a';
    return R(side, c);
  },
});
// The stand's side with the turnstile block: blue booth doors with a grille and an IN light at the bottom.
registerWall('theden_turnstiles', {
  top: '#2a3040',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const wu = Math.floor(u * 16);
    if (py < 4) return R(side, '#c8ccd4');
    if (py >= 10 && py < 14) return R(side, WHITE);
    if (py >= H - 40) {
      if (wu <= 1 || wu >= 14) return R(side, '#5a5c62');                           // pier between booths
      if (py < H - 34) return R(side, py === H - 38 ? '#e8c040' : '#1a1a1e');         // lintel with the turnstile letter
      if (py > H - 30 && py < H - 22 && wu > 4 && wu < 11) return R(side, (wu + py) % 2 ? '#3a3a40' : '#8a8e96');   // grille
      if (py === H - 26 && wu === 12) return R(side, variant % 2 ? '#3aff7a' : '#ff3a2a');
      return R(side, (py % 6 === 0) ? '#0a2050' : ROYAL);
    }
    const rib = Math.floor(u * 32) % 4;
    return R(side, rib === 0 ? '#08224e' : rib === 1 ? '#14408a' : NAVY);
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
const onFace = (ax, ay, side, u, z) => (side === 'left' ? proj(ax, ay, u, 1.02, z) : proj(ax, ay, 1.02, u, z));
function faceDraw(ctx, ax, ay, side, u, z, fn) {
  const m = onFace(ax, ay, side, u, z);
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
  fn(ctx);
  ctx.restore();
}

// ---- the home crowd behind the barriers (navy & white): they jeer you and cheer every time you get hit
const LOOKS = [];
function fanLook(i) {
  if (LOOKS[i]) return LOOKS[i];
  const rng = makeRng(9700 + i * 131);
  const L = casualLook(rng, { a: NAVY, b: WHITE, hatChance: 0.3, maskChance: 0.04, hoodChance: 0.05 });
  if (i % 3 === 0) L.jacket = { style: 'tee', color: NAVY };
  else if (i % 3 === 1) L.jacket = rng.pick([{ style: 'bomber', color: '#1a1a20', lining: '#e07020' }, { style: 'track', color: NAVY, trim: WHITE }, { style: 'harrington', color: '#c8b48a', lining: NAVY }]);
  L.shirt = rng.pick([NAVY, WHITE, NAVY]);
  L.scarf = rng.chance(0.6) ? { a: NAVY, b: WHITE } : null;
  L.build = rng.range(0.95, 1.3); L.height = rng.range(0.94, 1.03);
  return (LOOKS[i] = L);
}
const FAN_POSES = {
  stand: () => ({ ...STAND }),
  cheer0: () => sampleAnim('cheer', 0.0), cheer1: () => sampleAnim('cheer', 0.2),
  jeer0: () => ({ ...STAND, lean: 0.18, uaN: 1.6, faN: 0.1, uaF: 0.2, faF: 0.4, head: 0.1 }),
  jeer1: () => ({ ...STAND, lean: 0.24, uaN: 1.75, faN: 0.05, uaF: 0.3, faF: 0.5, head: 0.15, dy: 1 }),
  arms0: () => ({ ...STAND, uaN: 2.4, faN: 0.6, uaF: 2.4, faF: 0.6 }),
  arms1: () => ({ ...STAND, uaN: 2.6, faN: 0.3, uaF: 2.6, faF: 0.3, dy: 1 }),
};
const fanCache = new Map();
function fanSprite(li, pose, flip) {
  const key = li + '|' + pose + '|' + (flip ? 1 : 0);
  let c = fanCache.get(key);
  if (c) return c;
  c = makeCanvas(44, 70);
  drawDoll(c.getContext('2d'), 22, 66, fanLook(li), fillPose(FAN_POSES[pose]()), { flip, face: pose === 'stand' ? 'normal' : 'shout', time: li });
  fanCache.set(key, c);
  return c;
}
const JEERS = {
  idle: ['MILLWALL!', 'WHO ARE YA?', 'NO ONE LIKES US!', 'LIONS!', 'YOU\'RE IN THE DEN NOW!'],
  fight: ['GO ON, SON!', 'HAVE HIM!', 'BUSHWACKERS!', 'WE DON\'T CARE!', 'OFF OUR MANOR!'],
  hurt: ['HAVE THAT!', 'GET IN!', 'MILLWALL!', 'LIONS!'],
  ko: ['OI!', 'DISGRACE!', 'GET UP, YOU MUG!', 'BOOO!'],
};
function crowd(world) {
  let S = world.__denCrowd;
  if (!S) S = world.__denCrowd = { t: -1, mood: 'idle', kos: 0, cheerT: 0, hurtT: 0, hp: null, cd: 1, bubbles: [] };
  if (S.t !== world.time) {
    const dt = S.t < 0 ? 0 : Math.max(0, Math.min(0.1, world.time - S.t));
    S.t = world.time; S.cheerT -= dt; S.hurtT -= dt; S.cd -= dt;
    if (world.stats && world.stats.kos !== S.kos) { if (world.stats.kos > S.kos) S.cheerT = 1.6; S.kos = world.stats.kos; }
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
registerProp('theden_fans', {
  h: 1.7,
  update(p, world, dt) {
    const S = crowd(world), pl = world.player;
    if (!pl || S.cd > 0) return;
    if (Math.hypot(pl.x - p.cx, pl.y - p.cy) > 11 || Math.random() > dt * 3) return;
    S.cd = S.mood === 'idle' ? 1.7 : 0.7;
    const list = JEERS[S.mood];
    S.bubbles.push({ x: p.cx, y: p.cy, text: list[Math.floor(Math.random() * list.length)], t: 0 });
  },
  draw(ctx, ax, ay, p, t, world) {
    const S = world ? crowd(world) : { mood: 'idle' };
    const flip = !!p.o.flip;
    for (const [k, lx, ly] of [[0, 0.3, 0.32], [1, 0.72, 0.74]]) {
      if (k === 0 && p.o.single) continue;
      const hv = hash2(p.x * 3 + k, p.y * 5 + k, 79);
      const li = Math.floor(hv * 10);
      const s = proj(ax, ay, lx + (hv - 0.5) * 0.12, ly, 0);
      const fr = (t * (S.mood === 'idle' ? 1.5 : 4) + hv * 7) % 2 < 1 ? 0 : 1;
      let pose;
      if (S.mood === 'hurt') pose = 'cheer' + fr;
      else if (S.mood === 'ko' || S.mood === 'fight') pose = hv < 0.5 ? 'jeer' + fr : 'arms' + fr;
      else pose = hv < 0.35 ? 'arms' + fr : hv < 0.55 ? 'jeer' + fr : 'stand';
      shadow(ctx, s.x, s.y, 7, 3, 0.3);
      ctx.drawImage(fanSprite(li, pose, flip), Math.round(s.x - 22), Math.round(s.y - 66 + (S.mood === 'hurt' && fr ? -2 : 0)));
    }
    if (world && S.bubbles) for (const b of S.bubbles) {
      if (b.x !== p.cx || b.y !== p.cy) continue;
      const s = toScreen(b.x, b.y, 2.9 + b.t * 0.6);
      ctx.globalAlpha = b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.4) : 1;
      drawText(ctx, b.text, s.x, s.y, { color: '#a8c0ff', align: 'center', outline: '#000' });
      ctx.globalAlpha = 1;
    }
  },
});

// ---- mounted police: a bay horse with a hi-vis rider (w 2 along x). o.flip faces -x.
const COPPER = { skin: '#e8b48c', hair: { style: 'crop', color: '#2a1a10' }, hat: { style: 'helmet', color: '#1a1e2c' }, jacket: { style: 'hivis', color: '#d8f020' }, shirt: '#e8e8f0', pants: { style: 'suit', color: '#1a1e2c' }, shoes: { color: '#121214', sole: '#222', style: 'boot' }, build: 1.1, height: 1.0 };
const riderCache = new Map();
function riderSprite(flip) {
  if (riderCache.has(flip)) return riderCache.get(flip);
  const c = makeCanvas(44, 70);
  drawDoll(c.getContext('2d'), 22, 66, COPPER, fillPose({ ...STAND, thN: 1.45, knN: 1.5, thF: 1.35, knF: 1.5, uaN: 0.6, faN: 1.1, uaF: 0.5, faF: 1.2, lean: 0.05 }), { flip, face: 'normal' });
  riderCache.set(flip, c);
  return c;
}
registerProp('theden_policeHorse', {
  w: 2, d: 1, h: 2.2,
  draw(ctx, ax, ay, p, t) {
    const flip = !!p.o.flip, dir = flip ? -1 : 1;
    const c = proj(ax, ay, 1, 0.5, 0);
    shadow(ctx, c.x, c.y, 22, 7, 0.35);
    const bay = p.o.color || '#4a2e1e', dark = shade(bay, -0.35);
    const step = Math.sin(t * 1.3 + p.x) * 0.06;
    // legs
    for (const [lx, ly] of [[0.45, 0.3], [0.55, 0.7], [1.45, 0.3], [1.55, 0.7]]) {
      const a = proj(ax, ay, 1 + (lx - 1) * dir, ly, 0.85), b = proj(ax, ay, 1 + (lx - 1) * dir + step, ly, 0.02);
      thick(ctx, a.x, a.y, b.x, b.y, 4, OL); thick(ctx, a.x, a.y, b.x, b.y, 2, ly < 0.5 ? dark : bay);
      px(ctx, '#1a1a1a', b.x - 2, b.y - 1, 4, 2);
    }
    // body
    const m = proj(ax, ay, 1, 0.5, 1.15);
    ellipse(ctx, m.x, m.y, 18, 9, OL); ellipse(ctx, m.x, m.y, 17, 8, bay); ellipse(ctx, m.x - 3, m.y - 3, 10, 4, shade(bay, 0.15));
    // saddle cloth
    px(ctx, OL, m.x - 6, m.y - 8, 12, 9); px(ctx, '#1a2a5a', m.x - 5, m.y - 7, 10, 7); px(ctx, WHITE, m.x - 5, m.y - 1, 10, 1);
    // neck and head
    const n0 = proj(ax, ay, 1 + 0.7 * dir, 0.5, 1.4), n1 = proj(ax, ay, 1 + 1.05 * dir, 0.5, 2.0);
    thick(ctx, n0.x, n0.y, n1.x, n1.y, 9, OL); thick(ctx, n0.x, n0.y, n1.x, n1.y, 7, bay);
    const hd = proj(ax, ay, 1 + 1.2 * dir, 0.5, 1.85);
    ellipse(ctx, hd.x, hd.y, 6, 4, OL); ellipse(ctx, hd.x, hd.y, 5, 3, bay);
    px(ctx, '#e8e8e0', hd.x - 1 + dir * 2, hd.y - 1, 2, 2);                          // blaze
    px(ctx, '#d8f020', n1.x - 2, n1.y - 1, 4, 2);                                    // hi-vis browband
    // tail
    const tl = proj(ax, ay, 1 - 0.95 * dir, 0.5, 1.2), tl2 = proj(ax, ay, 1 - 1.05 * dir + Math.sin(t * 2 + p.x) * 0.05, 0.5, 0.5);
    thick(ctx, tl.x, tl.y, tl2.x, tl2.y, 3, '#1a1210');
    // rider
    const r = proj(ax, ay, 1 - 0.1 * dir, 0.5, 1.15);
    ctx.drawImage(riderSprite(flip), Math.round(r.x - 22), Math.round(r.y - 56));
  },
});

// ---- station name board on two posts (Network SouthEast style), 4 tiles along x. o.lines: one or two lines
registerProp('theden_stationBoard', {
  w: 4, d: 1, h: 0, solid: false, depthBias: 0.2,
  draw(ctx, ax, ay, p) {
    const lines = p.o.lines || ['SOUTH', 'BERMONDSEY'];
    const c = cached('board|' + lines.join('/'), 180, 150, 50, 110, (g, x, y) => {
      for (const u of [0.3, 3.7]) { const a = proj(x, y, u, 0.5, 0), b = proj(x, y, u, 0.5, 2.6); thick(g, a.x, a.y, b.x, b.y, 3, OL); thick(g, a.x, a.y, b.x, b.y, 1, '#3a3a42'); }
      isoPanel(g, x, y, 'left', 0, 0.55, 4, 1.75, 3.0, OL);
      isoPanel(g, x, y, 'left', 0.04, 0.56, 3.92, 1.8, 2.95, WHITE);
      isoPanel(g, x, y, 'left', 0.04, 0.56, 3.92, 1.8, 1.9, RED);
      isoPanel(g, x, y, 'left', 0.04, 0.56, 3.92, 1.9, 1.97, '#1a3a8a');
      lines.forEach((t, i) => {
        const m = proj(x, y, 2, 0.57, lines.length === 1 ? 2.45 : 2.68 - i * 0.42);
        g.save(); g.translate(Math.round(m.x), Math.round(m.y)); g.transform(1, 0.5, 0, 1, 0, 0);
        drawText(g, t, 0, -3, { color: '#1a1a2a', align: 'center' });
        g.restore();
      });
    });
    ctx.drawImage(c, ax - 50, ay - 110);
  },
});

// ---- oil drum brazier: the lads in the arches keep warm (light + sparks). Knock it over at your peril? No: solid.
registerProp('theden_brazier', {
  h: 0.9,
  light: { z: 1.2, r: 3.4, color: '#ff9a40', intensity: 0.75, flicker: true },
  hazard: { dmg: 6, kb: 2.5, interval: 0.8, sfx: 'punch', height: 1.1 },
  draw(ctx, ax, ay, p, t) {
    const c = cached('brazier', 60, 70, 24, 54, (g, x, y) => {
      const s = proj(x, y, 0.5, 0.5, 0); shadow(g, s.x, s.y, 9, 4, 0.35);
      isoBox(g, x, y, 0.2, 0.2, 0, 0.6, 0.6, 0.85, { top: '#2a1a12', left: '#5a3a2a', right: '#3a2418', outline: OL });
      for (let i = 0; i < 4; i++) { const q = proj(x, y, 0.3 + i * 0.12, 0.8, 0.4 + (i % 2) * 0.15); px(g, '#ff8a2a', q.x, q.y, 2, 2); }
    });
    ctx.drawImage(c, ax - 24, ay - 54);
    const f = proj(ax, ay, 0.5, 0.5, 0.9);
    for (let i = 0; i < 5; i++) {
      const k = (t * 2.2 + i * 0.37 + p.x) % 1;
      const fx = f.x + Math.sin(t * 7 + i * 2) * 3 - 4 + i * 2, fy = f.y - k * 12;
      px(ctx, k < 0.4 ? '#ffe070' : k < 0.75 ? '#ff8a20' : '#a03010', fx, fy, 2, k < 0.5 ? 3 : 2);
    }
  },
});

// ---- tyres: a stack of four. Breakable (rubber); drops a hubcap.
registerProp('theden_tyres', {
  h: 0.9,
  breakable: { hp: 22, debris: ['#1a1a1e', '#3a3a3e', '#8a8a90'], sfx: 'wood', drops: [['theden_hubcap', 0.8], ['coin', 0.4]], score: 60 },
  draw(ctx, ax, ay, p) {
    const c = cached('tyres', 60, 64, 24, 50, (g, x, y) => {
      const s = proj(x, y, 0.5, 0.5, 0); shadow(g, s.x, s.y, 11, 5, 0.35);
      for (let i = 0; i < 4; i++) {
        const q = proj(x, y, 0.5, 0.5, 0.1 + i * 0.2);
        ellipse(g, q.x, q.y, 12, 6, OL); ellipse(g, q.x, q.y, 11, 5, i % 2 ? '#2a2a2e' : '#222226');
        ellipse(g, q.x, q.y - 1, 5, 2, '#0e0e10');
      }
    });
    ctx.drawImage(c, ax - 24, ay - 50);
  },
});

// ---- engine block on a pallet: breakable (metal), drops a wheel brace.
registerProp('theden_engine', {
  h: 0.9,
  breakable: { hp: 40, debris: ['#5a5a60', '#2a2a2e', '#8a5a2a'], sfx: 'metal', drops: [['theden_wheelbrace', 0.8], ['cash5', 0.3]], score: 120 },
  draw(ctx, ax, ay) {
    const c = cached('engine', 64, 70, 24, 54, (g, x, y) => {
      const s = proj(x, y, 0.5, 0.5, 0); shadow(g, s.x, s.y, 13, 6, 0.35);
      isoBox(g, x, y, 0.08, 0.08, 0, 0.84, 0.84, 0.14, { top: '#b08a50', left: '#8a6a3a', right: '#5e4626', outline: OL });
      isoBox(g, x, y, 0.18, 0.2, 0.14, 0.64, 0.6, 0.5, { top: '#5a5c62', left: '#4a4c52', right: '#34363c', outline: OL });
      isoBox(g, x, y, 0.26, 0.3, 0.64, 0.48, 0.4, 0.16, { top: '#7a2a20', left: '#6a2018', right: '#4a1610', outline: OL });   // rocker cover
      for (let i = 0; i < 3; i++) { const q = proj(x, y, 0.3 + i * 0.16, 0.8, 0.42); ellipse(g, q.x, q.y, 2, 2, '#1a1a1e'); }
    });
    ctx.drawImage(c, ax - 24, ay - 54);
  },
});

// ---- scrap pile: bent metal, a bath, a bike wheel. Stand on top (h 1.0).
registerProp('theden_scrapPile', {
  w: 2, d: 2, h: 1.0,
  draw(ctx, ax, ay, p) {
    const c = cached('scrap|' + (p.o.v || 0), 120, 100, 60, 70, (g, x, y) => {
      const rng = makeRng(311 + (p.o.v || 0) * 17);
      const s = proj(x, y, 1, 1, 0); shadow(g, s.x, s.y, 30, 12, 0.4);
      fillPoly(g, [proj(x, y, 0.1, 1.9, 0), proj(x, y, 1.9, 1.9, 0), proj(x, y, 1.9, 0.1, 0), proj(x, y, 1.2, 0.6, 1.0), proj(x, y, 0.6, 1.2, 1.05)], OL);
      fillPoly(g, [proj(x, y, 0.2, 1.85, 0), proj(x, y, 1.85, 1.85, 0), proj(x, y, 1.85, 0.2, 0), proj(x, y, 1.2, 0.65, 0.95), proj(x, y, 0.65, 1.2, 1.0)], '#4a3a2e');
      for (let i = 0; i < 26; i++) {
        const u = rng.range(0.3, 1.7), v = rng.range(0.3, 1.7), z = Math.max(0.05, 1.0 - Math.hypot(u - 1, v - 1) * 0.9);
        const q = proj(x, y, u, v, z * rng.range(0.6, 1));
        const col = rng.pick(['#8a4a24', '#6a6a70', '#9a9aa0', '#5a2a1a', '#2a4a8a', '#8a2020', '#c8c8c0', '#3a3a3e']);
        if (i % 5 === 0) { ellipse(g, q.x, q.y, 5, 3, OL); ellipse(g, q.x, q.y, 4, 2, '#2a2a2e'); }
        else { const w = rng.int ? rng.int(3, 8) : 5; px(g, OL, q.x - 1, q.y - 1, w + 2, 4); px(g, col, q.x, q.y, w, 2); }
      }
      const b = proj(x, y, 0.8, 1.2, 0.75); ellipse(g, b.x, b.y, 9, 4, OL); ellipse(g, b.x, b.y, 8, 3, '#e8e8e0'); ellipse(g, b.x, b.y - 1, 6, 2, '#a8a8a0');   // the bath
      const w = proj(x, y, 1.3, 0.8, 0.9); ellipse(g, w.x, w.y, 6, 6, OL); ellipse(g, w.x, w.y, 5, 5, '#4a4a50'); ellipse(g, w.x, w.y, 3, 3, '#2a2016');
    });
    ctx.drawImage(c, ax - 60, ay - 70);
  },
});

// ---- burnt-out car shell (w 2 x d 1). Pure set dressing.
registerProp('theden_burntCar', {
  w: 2, d: 1, h: 0.9,
  draw(ctx, ax, ay) {
    const c = cached('burnt', 120, 80, 50, 50, (g, x, y) => {
      const s = proj(x, y, 1, 0.5, 0); shadow(g, s.x, s.y, 24, 8, 0.4);
      isoBox(g, x, y, 0.05, 0.1, 0.1, 1.9, 0.8, 0.45, { top: '#3a2a22', left: '#4a3428', right: '#2a1c16', outline: OL });
      isoBox(g, x, y, 0.5, 0.15, 0.55, 0.9, 0.7, 0.3, { top: '#2a1e18', left: '#1a1210', right: '#140e0c', outline: OL });
      for (let i = 0; i < 9; i++) { const q = proj(x, y, 0.2 + i * 0.2, 0.9, 0.3 + (i % 3) * 0.06); px(g, i % 2 ? '#8a4a24' : '#5a2a14', q.x, q.y, 3, 2); }
    });
    ctx.drawImage(c, ax - 50, ay - 50);
  },
});

// ---- a wooden crate of the boss's (props version for the yard, breakable).
registerProp('theden_teaChest', {
  h: 0.8,
  breakable: { hp: 14, debris: ['#8a6a3a', '#b08a50', '#5a3a1a'], sfx: 'wood', drops: [['theden_tea', 0.6], ['coin', 0.5]], score: 40 },
  draw(ctx, ax, ay) {
    const c = cached('teachest', 60, 64, 24, 50, (g, x, y) => {
      const s = proj(x, y, 0.5, 0.5, 0); shadow(g, s.x, s.y, 11, 5, 0.3);
      isoBox(g, x, y, 0.12, 0.12, 0, 0.76, 0.76, 0.74, { top: '#b08a50', left: '#9a7840', right: '#6a5028', outline: OL });
      isoPanel(g, x, y, 'left', 0.12, 0.88, 0.76, 0.3, 0.45, '#2a2a2e');
      const m = proj(x, y, 0.5, 0.89, 0.55);
      g.save(); g.translate(Math.round(m.x), Math.round(m.y)); g.transform(1, 0.5, 0, 1, 0, 0); drawText(g, 'TEA', 0, -3, { color: '#2a1a0a', align: 'center' }); g.restore();
    });
    ctx.drawImage(c, ax - 24, ay - 50);
  },
});

// ---- a lion rampant (club-style crest) on a wall face. o.big, o.text
const LION = [
  '.....###.......',
  '....#####......',
  '...##.####.....',
  '....######.....',
  '.....######.#..',
  '....########.#.',
  '...##.######.#.',
  '..##..#####..#.',
  '......####.....',
  '.....##..##....',
  '....##....##...',
  '...##......##..',
];
function drawLion(g, s = 1) {
  px(g, OL, -9 * s, -8 * s, 18 * s, 18 * s);
  px(g, NAVY, -8 * s, -7 * s, 16 * s, 16 * s);
  for (let r = 0; r < LION.length; r++) for (let c = 0; c < LION[r].length; c++) if (LION[r][c] === '#') px(g, WHITE, (c - 7) * s, (r - 5) * s, s, s);
}
registerProp('theden_lion', {
  h: 0, solid: false, depthBias: 0.03,
  draw(ctx, ax, ay, p) {
    faceDraw(ctx, ax, ay, p.o.side || 'left', p.o.u ?? 0.5, p.o.z ?? 2, g => {
      drawLion(g, p.o.big ? 2 : 1);
      if (p.o.text) drawText(g, p.o.text, 0, p.o.big ? 22 : 12, { color: WHITE, align: 'center', outline: OL });
    });
  },
});

// =====================================================================================================
// TRAINS
// =====================================================================================================
// Network SouthEast livery: blue-grey body, a red / white / blue stripe band, yellow warning front.
const NSE = { body: '#3a4458', roof: '#8a8e96', stripeR: '#d8202a', stripeW: '#f4f4f4', stripeB: '#2a3a9a', win: '#1a2228', lit: '#e8d890' };
function drawCarSlice(ctx, x0, y0, z0, W, D, cx, opts) {
  const a = toScreen(x0, y0, z0);
  isoBox(ctx, a.x, a.y, 0, 0.1, 0, W, D - 0.2, 0.2, { top: '#1a1a1e', left: '#0e0e10', right: '#0a0a0c' });
  isoBox(ctx, a.x, a.y, 0, 0, 0.2, W, D, 1.5, { top: NSE.roof, left: NSE.body, right: shade(NSE.body, -0.32) });
  isoPanel(ctx, a.x, a.y, 'left', 0, D, W, 0.42, 0.52, NSE.stripeR);
  isoPanel(ctx, a.x, a.y, 'left', 0, D, W, 0.52, 0.6, NSE.stripeW);
  isoPanel(ctx, a.x, a.y, 'left', 0, D, W, 0.6, 0.68, NSE.stripeB);
  if (opts.door) {
    isoPanel(ctx, a.x, a.y, 'left', Math.max(0, cx - 0.3 - x0), D, Math.min(W, 0.6), 0.25, 1.55, '#4a566e');
    isoPanel(ctx, a.x, a.y, 'left', Math.max(0, cx - 0.25 - x0), D, Math.min(W, 0.5), 0.85, 1.4, NSE.win);
  } else {
    isoPanel(ctx, a.x, a.y, 'left', 0.06, D, Math.max(0, W - 0.12), 0.85, 1.45, NSE.win);
    isoPanel(ctx, a.x, a.y, 'left', 0.1, D, Math.max(0, W - 0.2), 0.9, 1.4, opts.lit ? NSE.lit : '#3a4a58');
  }
  isoBox(ctx, a.x, a.y, 0, 0.15, 1.7, W, D - 0.3, 0.08, { top: '#a8acb4', left: '#7a7e86', right: '#5a5e66' });
}
// Station train: a traffic hazard (the level sets draw: noDraw) drawn by one actor per 1-tile slice so it sorts.
export function spawnStationTrain(world, v) {
  const def = v.def, N = Math.round((def.halfLen ?? 4.5) * 2), half = def.halfWidth ?? 0.72, ly = v.y;
  const clip = def.clip || [-1e9, 1e9];
  for (let i = 0; i < N; i++) {
    const off = (i - (N - 1) / 2);
    world.addActor({
      x: v.x, y: ly, removed: false,
      update() { if (v.removed) this.removed = true; this.x = v.x + v.dx * off; },
      depth() { return this.x + ly + 0.05; },
      draw(ctx) {
        const cx = v.x + v.dx * off;
        const x0 = Math.max(cx - 0.5, clip[0]), x1 = Math.min(cx + 0.5, clip[1]);
        if (x1 - x0 <= 0.01) return;
        const idx = v.dx > 0 ? N - 1 - i : i;                                       // 0 = front
        drawCarSlice(ctx, x0, ly - half, 0, x1 - x0, half * 2, cx, { door: idx % 4 === 2, lit: (i + Math.floor(v.x)) % 3 !== 0 });
        if (idx === 0) {
          const fx = v.dx > 0 ? x1 : x0;
          const a = toScreen(fx, ly - half, 0);
          isoPanel(ctx, a.x, a.y, 'right', 0, 0, half * 2, 0.3, 1.2, '#e8c020');
          const hl = toScreen(fx, ly + half * 0.4, 0.5);
          px(ctx, '#fff8d0', hl.x - 1, hl.y - 1, 3, 2);
          world.addFrameLight({ x: fx + v.dx * 1.5, y: ly, z: 0.6, r: 4, color: '#fff4d0', intensity: 0.9 });
          const hb = toScreen(cx, ly + half, 1.75);
          drawText(ctx, 'LONDON BRIDGE', Math.round(hb.x), Math.round(hb.y) - 7, { color: '#ffb040', align: 'center', outline: OL });
        }
      },
    });
  }
}

// The overhead train: crosses the viaduct (x 50 -> -10 along y = VIA_Y, on top at z = VIA_Z) every 18 s.
export const VIA = { y: 15.5, z: 4.5, x0: 0, x1: 43, from: 50, to: -10, speed: 12, period: 18, phase: 7 };
export function archTrain(time) {
  const k = (time + VIA.phase) % VIA.period;
  const x = VIA.from - VIA.speed * k;
  return { k, x, on: x > VIA.to && x < VIA.from, warn: k > VIA.period - 1.4 };
}
// loose bricks at x = zx: dust trickles for 0.9 s after the train has passed over, then they come down for 0.45 s
export function brickDrop(time, zx) {
  const k = (time + VIA.phase) % VIA.period;
  const tPass = (VIA.from - zx) / VIA.speed;
  const d = k - tPass;
  return { warn: d >= 0 && d < 0.9, drop: d >= 0.9 && d < 1.35, d };
}
export function addViaductTrain(world) {
  const N = 8;
  for (let i = 0; i < N; i++) {
    world.addActor({
      x: 20, y: VIA.y, removed: false, noCull: true,
      update() { this.x = archTrain(world.time).x + i; },
      depth() { return this.x + VIA.y + 3.7; },
      draw(ctx) {
        const T = archTrain(world.time);
        if (!T.on) return;
        const cx = T.x + i + 0.5;
        const x0 = Math.max(cx - 0.5, VIA.x0), x1 = Math.min(cx + 0.5, VIA.x1);
        if (x1 - x0 <= 0.01) return;
        drawCarSlice(ctx, x0, VIA.y - 0.72, VIA.z, x1 - x0, 1.44, cx, { door: i % 4 === 2, lit: i % 3 !== 0 });
        if (i === 0 && x0 === cx - 0.5) {
          const a = toScreen(x0, VIA.y - 0.72, VIA.z);
          isoPanel(ctx, a.x, a.y, 'right', 0, 0, 1.44, 0.3, 1.2, '#e8c020');
        }
      },
    });
  }
}

// =====================================================================================================
// SKYLINE: Canary Wharf's tower across the river, blinking on the horizon (drawn under the walls).
// =====================================================================================================
export function drawSkyline(ctx, world) {
  const t = world.time;
  const b = toScreen(34, -16, 0), top = toScreen(34, -16, 13);
  ctx.save();
  fillPoly(ctx, [{ x: b.x - 10, y: b.y }, { x: b.x + 10, y: b.y }, { x: top.x + 10, y: top.y }, { x: top.x - 10, y: top.y }], '#141826');
  fillPoly(ctx, [{ x: top.x - 10, y: top.y }, { x: top.x + 10, y: top.y }, { x: top.x, y: top.y - 12 }], '#1a1e2e');
  for (let i = 0; i < 26; i++) { const yy = b.y - 8 - i * 9; if (yy < top.y + 4) break; if (hash2(i, 3, 740) < 0.5) px(ctx, '#e8d890', b.x - 6 + (i % 3) * 5, yy, 2, 1); }
  if (Math.floor(t * 1.1) % 2 === 0) px(ctx, '#ff3a2a', top.x - 1, top.y - 13, 3, 3);
  for (const [x, h] of [[18, 6], [24, 8], [44, 7], [52, 5]]) {
    const q = toScreen(x, -14, 0), q2 = toScreen(x, -14, h);
    fillPoly(ctx, [{ x: q.x - 7, y: q.y }, { x: q.x + 7, y: q.y }, { x: q2.x + 7, y: q2.y }, { x: q2.x - 7, y: q2.y }], '#121522');
  }
  ctx.restore();
}

// =====================================================================================================
// ITEMS
// =====================================================================================================
registerItem('theden_tea', {
  name: 'MUG OF TEA', kind: 'heal', heal: 22, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 4, y - 10, 9, 10); px(ctx, WHITE, x - 3, y - 9, 7, 9); px(ctx, '#8a5a2a', x - 3, y - 9, 7, 2);
    px(ctx, NAVY, x - 3, y - 5, 7, 2); px(ctx, OL, x + 4, y - 7, 2, 4);
    const k = (t * 1.5) % 1; px(ctx, 'rgba(255,255,255,0.7)', x - 1 + Math.round(Math.sin(t * 5) * 1.5), y - 12 - Math.round(k * 4), 1, 2);
  },
});
registerItem('theden_pieMash', {
  name: 'PIE, MASH & LIQUOR', kind: 'heal', heal: 40, score: 80, stash: true, auto: true,
  icon(ctx, x, y) {
    px(ctx, OL, x - 7, y - 6, 15, 6); px(ctx, WHITE, x - 6, y - 5, 13, 4);
    px(ctx, '#c89a50', x - 5, y - 8, 6, 3); px(ctx, OL, x - 6, y - 9, 8, 1);
    px(ctx, '#e8e0c8', x + 1, y - 7, 5, 2); px(ctx, '#6a9a3a', x - 6, y - 4, 13, 1);   // mash + green liquor
  },
});
registerItem('theden_wheelbrace', {
  name: 'WHEEL BRACE', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.45, durability: 8, attack: 'swing', throwDmg: 13, breaks: 'metal' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 8, y - 5, 16, 4); px(ctx, '#5a5c62', x - 7, y - 4, 14, 2); px(ctx, '#9a9ca2', x - 7, y - 4, 14, 1);
    px(ctx, OL, x + 5, y - 9, 4, 9); px(ctx, '#5a5c62', x + 6, y - 8, 2, 7);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 14 * s, ey = hy + dy * 14 * s, bx = hx - dx * 2, by = hy - dy * 2;
    thick(ctx, bx, by, ex, ey, 4, OL); thick(ctx, bx, by, ex, ey, 2, flash ? '#ffffff' : '#6a6c72');
    thick(ctx, ex - dy * 4, ey + dx * 4, ex + dy * 4, ey - dx * 4, 3, OL); line(ctx, ex - dy * 3, ey + dx * 3, ex + dy * 3, ey - dx * 3, '#8a8c92');
  },
});
registerItem('theden_hubcap', {
  name: 'HUBCAP', kind: 'weapon', score: 0,
  weapon: { dmg: 6, reach: 1.1, durability: 2, attack: 'swing', throwDmg: 11, breaks: 'metal' },
  icon(ctx, x, y) { ellipse(ctx, x, y - 5, 6, 4, OL); ellipse(ctx, x, y - 5, 5, 3, '#c8ccd4'); ellipse(ctx, x, y - 5, 2, 1, '#6a6c72'); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const w = Math.max(2, Math.round(Math.abs(Math.cos(ang)) * 6));
    ellipse(ctx, hx, hy, w + 1, 4, OL); ellipse(ctx, hx, hy, w, 3, flash ? '#ffffff' : '#c8ccd4'); px(ctx, '#6a6c72', hx - 1, hy - 1, 2, 2);
  },
});
// The Docker's crate: what he throws. Heavy enough to knock you down.
registerItem('theden_crate', {
  name: 'TEA CHEST', kind: 'weapon', score: 0,
  weapon: { dmg: 12, reach: 1.2, durability: 1, attack: 'swing', knockdown: true, throwDmg: 15, breaks: 'wood' },
  icon(ctx, x, y) { px(ctx, OL, x - 6, y - 11, 12, 11); px(ctx, '#b08a50', x - 5, y - 10, 10, 9); px(ctx, '#6a5028', x - 5, y - 6, 10, 1); },
  drawHeld(ctx, hx, hy, ang) {
    const k = Math.round(Math.sin(ang) * 2);
    fillPoly(ctx, [{ x: hx - 9, y: hy - 4 + k }, { x: hx, y: hy - 9 - k }, { x: hx + 9, y: hy - 4 + k }, { x: hx, y: hy + 1 - k }], OL);
    fillPoly(ctx, [{ x: hx - 8, y: hy - 4 + k }, { x: hx, y: hy - 8 - k }, { x: hx + 8, y: hy - 4 + k }, { x: hx, y: hy - k }], '#c8a060');
    fillPoly(ctx, [{ x: hx - 9, y: hy - 4 + k }, { x: hx, y: hy + 1 - k }, { x: hx, y: hy + 9 - k }, { x: hx - 9, y: hy + 4 + k }], '#9a7840');
    fillPoly(ctx, [{ x: hx, y: hy + 1 - k }, { x: hx + 9, y: hy - 4 + k }, { x: hx + 9, y: hy + 4 + k }, { x: hx, y: hy + 9 - k }], '#6a5028');
  },
});
