// THEME: THE PUB ("The Anchor", Level 2). Floors, walls, props and items. Every id starts with 'pub_'.
//
// Floors: pub_flags pub_lawn pub_carpet pub_boards pub_barmat pub_func pub_dance pub_gents pub_snug pub_cellar pub_yard pub_stairs
// Walls:  pub_panel pub_panelLow pub_bar (low counter, h 1.0 — jump on it) pub_backbar pub_extBrick pub_fence pub_gentsWall
//         pub_partition pub_cellarWall pub_gardenWall
// Props:  pub_picnic pub_heater pub_fire pub_shelter pub_post pub_booth pub_jukebox pub_fruit pub_pool pub_poollamp pub_cuerack
//         pub_dartboard pub_telly pub_stool pub_keg pub_cask pub_spill pub_water pub_empties pub_toilet pub_urinal pub_sink
//         pub_cubdoor pub_disco pub_stage pub_speaker pub_decks pub_mic pub_buffet pub_balloons pub_boarded pub_hatch pub_door
//         pub_dray pub_aboard pub_hangsign pub_bell pub_pumps pub_till pub_pendant pub_armchair
// Items:  pub_cue pub_stool pub_glass pub_dart pub_poolball pub_crisps
//
// Interactive bits unique to this level:
//   * beer spills (pub_spill, left by smashed kegs/casks) and water (pub_water, smashed toilets/sinks) are SLIPPERY:
//     running fighters go flying, walking enemies sometimes do, a charging boss often does.
//   * pub_jukebox / pub_decks: USE (costs £1) -> every enemy nearby drops everything and dances for a few seconds.
//   * pub_heater: smash it and it falls over, leaving a burning patch (pub_fire) for a few seconds.
//   * pub_fruit: smash the fruit machine for a JACKPOT.

import { registerFloor, registerWall } from '../../engine/tiles.js';
import { registerProp } from '../../game/props.js';
import { registerItem } from '../../game/items.js';
import { isoBox, isoQuad, isoPanel, fillPoly, ellipse, line, thick, proj, shadow } from '../../engine/gfx.js';
import { shade, mix } from '../../engine/color.js';
import { hash2 } from '../../engine/rng.js';
import { drawText } from '../../engine/font.js';
import { Z_PX } from '../../engine/constants.js';
import { audio } from '../../audio/audio.js';

const OL = '#120c14';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);
const R = (side, c, k = -0.28) => (side === 'right' ? shade(c, k) : c);
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

// ======================================================================= custom sound effects
// Installed lazily into audio.customSfx (the audio engine plays them by name through world.sfx / audio.sfx).
const PUB_SFX = {
  pub_bell(e, t, o) {
    for (let k = 0; k < 3; k++) {
      const tt = t + k * 0.22;
      e.tone(tt, 0.9, { freq: 1180 * o.pitch, type: 'sine', vol: 0.22 * o.vol, pan: o.pan, release: 0.9 });
      e.tone(tt, 0.7, { freq: 2950 * o.pitch, type: 'sine', vol: 0.07 * o.vol, pan: o.pan, release: 0.6 });
      e.tone(tt, 0.4, { freq: 590 * o.pitch, type: 'triangle', vol: 0.08 * o.vol, pan: o.pan });
    }
  },
  pub_juke(e, t, o) {
    const notes = [392, 494, 587, 784, 698, 587, 494, 587];
    notes.forEach((f, i) => e.tone(t + i * 0.11, 0.1, { freq: f, type: 'square', vol: 0.09 * o.vol }));
    e.noise(t, 0.5, { vol: 0.12 * o.vol, freq: 3000, type: 'highpass' });
  },
  pub_jackpot(e, t, o) {
    for (let i = 0; i < 10; i++) e.tone(t + i * 0.06, 0.08, { freq: 880 + (i % 2) * 440 + i * 40, type: 'square', vol: 0.08 * o.vol });
  },
  pub_slip(e, t, o) {
    e.tone(t, 0.25, { freq: 900, to: 300, type: 'sine', vol: 0.14 * o.vol, pan: o.pan });
    e.noise(t, 0.15, { vol: 0.25 * o.vol, freq: 1800, q: 2, pan: o.pan });
  },
  pub_glassSmash(e, t, o) {
    for (let i = 0; i < 8; i++) e.tone(t + i * 0.015, 0.18, { freq: 2200 + Math.random() * 3500, type: 'triangle', vol: 0.1 * o.vol, pan: o.pan });
    e.noise(t, 0.25, { vol: 0.5 * o.vol, freq: 4500, type: 'highpass', pan: o.pan });
  },
};
export function installPubSfx() {
  if (!audio.customSfx) audio.customSfx = {};
  for (const k in PUB_SFX) if (!audio.customSfx[k]) audio.customSfx[k] = PUB_SFX[k];
}
installPubSfx();

// ======================================================================= floors
registerFloor('pub_flags', { // beer garden patio: wet flagstones, moss in the joints, fag ends
  pixel(u, v, tx, ty, r) {
    const row = Math.floor(v * 2), off = (row + ty) % 2 ? 0.25 : 0;
    const su = (u + off) * 2, sv = v * 2;
    const fu = su % 1, fv = sv % 1;
    if (fu < 0.05 || fv < 0.06) return n2(u * 32 + tx * 32, v * 32 + ty * 32, 31) < 0.3 ? '#2e4a24' : '#26241f';
    const s = n2(tx * 2 + Math.floor(su), ty * 2 + row, 32);
    let c = s < 0.25 ? '#57534c' : s < 0.5 ? '#615c54' : s < 0.75 ? '#4f4b45' : '#6a655b';
    const nn = n2(u * 32 + tx * 32, v * 32 + ty * 32, 33);
    if (nn < 0.07) c = shade(c, -0.15); else if (nn > 0.95) c = shade(c, 0.12);
    if (s < 0.15 && fu > 0.3 && fu < 0.7 && fv > 0.3 && fv < 0.6) c = mix(c, '#8a9aa8', 0.25); // puddle sheen
    if (r < 0.3 && Math.abs(u - 0.25 - r) < 0.05 && Math.abs(v - 0.7) < 0.025) return u - 0.25 - r > 0.02 ? '#c86a2a' : '#e8e0d0';
    return c;
  },
});
registerFloor('pub_lawn', { // patchy pub lawn: bald muddy bits, bottle caps, dog-ends
  pixel(u, v, tx, ty, r) {
    const wx = tx + u, wy = ty + v;
    const mud = n2(wx * 2.5, wy * 2.5, 21) < 0.22 || n2(wx * 3 + 7, wy * 3 + 3, 22) < 0.12;
    const n = n2(wx * 32, wy * 32, 23);
    if (mud) return n < 0.2 ? '#3a2c20' : n > 0.85 ? '#5a4632' : '#4a3a2a';
    if (r < 0.2 && Math.abs(u - 0.6) < 0.04 && Math.abs(v - 0.3 - r) < 0.04) return '#c8c0a0';
    if (r > 0.85 && Math.abs(u - 0.3) < 0.035 && Math.abs(v - 0.5) < 0.035) return '#b03020';
    return n < 0.15 ? '#2a4220' : n > 0.88 ? '#4e6e32' : n > 0.7 ? '#3e5c2a' : '#344e24';
  },
});
registerFloor('pub_carpet', { // lounge carpet: burgundy & bottle-green paisley, sticky with history
  pixel(u, v, tx, ty, r) {
    const x = (u + tx) * 6, y = (v + ty) * 6;
    const s = Math.sin(x * 1.7 + Math.sin(y * 1.3) * 2) * Math.cos(y * 1.1 - Math.cos(x * 0.9) * 1.5);
    let c = '#4a1418';
    if (s > 0.8) c = '#b08a36'; else if (s > 0.5) c = '#1e4430'; else if (s < -0.7) c = '#2a0a10'; else if (s < -0.35) c = '#5e1c22';
    const sx = 0.2 + r * 0.6, sy = 0.25 + hash2(tx, ty, 41) * 0.5;
    const d = Math.hypot(u - sx, (v - sy) * 1.2);
    if (r < 0.45 && d < 0.16 + hash2(Math.floor(u * 8), Math.floor(v * 8), tx + ty) * 0.05) c = shade(c, -0.3); // pint stain
    if (n2(u * 32 + tx * 32, v * 32 + ty * 32, 42) < 0.012) c = '#0a0606'; // fag burn
    return c;
  },
});
registerFloor('pub_boards', { // public bar floorboards, dark varnish worn pale where the drinkers stand
  pixel(u, v, tx, ty) {
    const plank = Math.floor(v * 5);
    const pv = (v * 5) % 1;
    if (pv < 0.12) return '#1a0e08';
    const off = n2(ty * 5 + plank, 3, 51);
    const pu = (u + off + tx) % 2;
    if (pu < 0.025) return '#1a0e08';
    const s = n2(tx + Math.floor(pu), ty * 5 + plank, 52);
    let c = s < 0.33 ? '#4a2a18' : s < 0.66 ? '#55301c' : '#3e2414';
    const g = n2(u * 48 + tx * 48, v * 10 + ty * 10, 53);
    if (g < 0.12) c = shade(c, -0.15); else if (g > 0.93) c = shade(c, 0.12);
    if (pu > 0.5 && pu < 0.53 && pv > 0.45 && pv < 0.6) c = '#8a8a90'; // nail
    const wear = n2((tx + u) * 1.5, (ty + v) * 1.5, 54);
    if (wear < 0.18) c = mix(c, '#7a5a3a', 0.35);
    return c;
  },
});
registerFloor('pub_barmat', { // staff side: black rubber anti-slip matting over boards
  pixel(u, v, tx, ty) {
    const hu = (u * 6) % 1, hv = (v * 6) % 1;
    if (u < 0.04 || v < 0.04) return '#3a3a40';
    if (Math.abs(hu - 0.5) < 0.18 && Math.abs(hv - 0.5) < 0.18) return n2(u * 6 + tx * 6, v * 6 + ty * 6, 61) < 0.15 ? '#5a3a18' : '#0c0c0e';
    return '#26262a';
  },
});
registerFloor('pub_func', { // function room: hotel-style navy carpet with a gold lattice
  pixel(u, v, tx, ty) {
    const a = (u + v) * 3, b = (u - v) * 3;
    const fa = ((a % 1) + 1) % 1, fb = ((b % 1) + 1) % 1;
    if (fa < 0.07 || fb < 0.07) return '#a8822e';
    const ca = Math.abs(fa - 0.5) + Math.abs(fb - 0.5);
    if (ca < 0.12) return '#8a1a2a';
    if (ca < 0.2) return '#2c3a74';
    return n2(u * 32 + tx * 32, v * 32 + ty * 32, 71) < 0.05 ? '#141c40' : '#1c2858';
  },
});
registerFloor('pub_dance', { // light-up disco floor (animated glow is drawn by the level's drawGround)
  pixel(u, v, tx, ty) {
    const su = (u * 2) % 1, sv = (v * 2) % 1;
    if (su < 0.08 || sv < 0.08) return '#08080c';
    const k = (Math.floor(u * 2) + Math.floor(v * 2) * 2 + tx * 3 + ty * 5) % 4;
    const c = ['#3a1a4a', '#1a3a4a', '#4a3a14', '#1a4a2a'][k];
    return su > 0.75 || sv > 0.78 ? shade(c, 0.25) : c;
  },
});
registerFloor('pub_gents', { // the gents: small grimy tiles, permanently wet
  pixel(u, v, tx, ty) {
    const su = (u * 6) % 1, sv = (v * 6) % 1;
    if (su < 0.14 || sv < 0.14) return '#5a5a50';
    const k = (Math.floor(u * 6) + Math.floor(v * 6)) % 2;
    let c = k ? '#c8c8bc' : '#7a98a8';
    const wet = n2((tx + u) * 1.7, (ty + v) * 1.7, 81) < 0.3;
    if (wet) c = mix(c, '#9ab8c8', 0.35);
    if (n2(u * 6 + tx * 6, v * 6 + ty * 6, 82) < 0.08) c = mix(c, '#b8a868', 0.4);
    return c;
  },
});
registerFloor('pub_snug', { // Ron's secret snug: a threadbare Persian-ish rug
  pixel(u, v, tx, ty) {
    const x = Math.abs(((u + tx) % 2) - 1), y = Math.abs(((v + ty) % 2) - 1);
    const d = x + y;
    if (d < 0.25) return '#c8a040';
    if (d < 0.4) return '#1a2a4a';
    if (Math.abs(d - 0.9) < 0.08) return '#c8a040';
    if (n2(u * 32 + tx * 32, v * 32 + ty * 32, 91) < 0.1) return '#4a1010';
    return d > 1.3 ? '#2a1a3a' : '#6a1a1a';
  },
});
registerFloor('pub_cellar', { // damp cellar flags with a drainage gully
  pixel(u, v, tx, ty) {
    const su = (u * 2) % 1, sv = (v * 2 + (Math.floor(u * 2) % 2) * 0.5) % 1;
    if (su < 0.06 || sv < 0.06) return '#1e1c1a';
    const s = n2(tx * 2 + Math.floor(u * 2), ty * 2 + Math.floor(v * 2 + (Math.floor(u * 2) % 2) * 0.5), 101);
    let c = s < 0.3 ? '#3e3a36' : s < 0.6 ? '#46423c' : '#38342f';
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 102);
    if (n < 0.08) c = '#2e3a2c'; else if (n > 0.96) c = '#5a564e';
    if (n2((tx + u) * 2, (ty + v) * 2, 103) < 0.12) c = mix(c, '#5a4a20', 0.3); // old beer
    return c;
  },
});
registerFloor('pub_yard', { // back yard concrete: oil, cracks, weeds
  pixel(u, v, tx, ty, r) {
    const n = n2(u * 32 + tx * 32, v * 32 + ty * 32, 111);
    let c = r < 0.5 ? '#585854' : '#52524e';
    if (u < 0.03 || v < 0.03) c = '#3e3e3a';
    if (n < 0.06) c = shade(c, -0.15); else if (n > 0.96) c = shade(c, 0.1);
    const crack = Math.abs(v - (0.3 + 0.4 * Math.sin(u * 7 + tx))) < 0.02 && r > 0.7;
    if (crack) return n < 0.5 ? '#2e4a24' : '#2a2a28';
    if (n2((tx + u) * 1.3, (ty + v) * 1.3, 112) < 0.1) c = mix(c, '#1a1a22', 0.55); // oil
    return c;
  },
});
registerFloor('pub_stairs', { // cellar stairs running down along -x
  pixel(u, v) {
    const s = (u * 4) % 1;
    if (s < 0.14) return '#c8a040';  // brass nosing
    if (s < 0.3) return '#1a120c';
    return v < 0.08 || v > 0.92 ? '#2a1a10' : (s > 0.85 ? '#4a2a1a' : '#5a3420');
  },
});

// ======================================================================= walls
function brickFace(base, mortar, u, py, side, variant, coping = true) {
  const bx = u * 16, row = Math.floor(py / 4);
  const off = row % 2 ? 4 : 0;
  let c;
  if (py % 4 === 3 || Math.floor(bx + off) % 8 === 0) c = mortar;
  else {
    const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, 3);
    c = s < 0.3 ? shade(base, -0.08) : s > 0.85 ? shade(base, 0.1) : base;
  }
  if (coping && py < 2) c = shade(base, 0.15);
  return R(side, c, -0.3);
}

// pub interior: flock wallpaper over a dark wooden dado; pictures, sconces and nicotine.
function panelFace(u, py, side, H, r, variant) {
  const X = Math.floor(u * 16);
  const dadoTop = H - Math.min(26, Math.round(H * 0.45));
  let c;
  if (py < 2) c = py === 0 ? '#7a5a32' : '#3a2414';
  else if (py < dadoTop - 3) {
    const yy = py - 2;
    const cx = (X + (Math.floor(yy / 10) % 2) * 4) % 8, cy = yy % 10;
    const dd = Math.abs(cx - 4) + Math.abs(cy - 5) * 0.8;
    c = '#5a1420';
    if (dd < 1.2) c = '#b08a3a';
    else if (dd > 2.6 && dd < 3.4) c = '#7a5a2a';
    else if ((X + yy) % 2 === 0 && dd < 2.6) c = '#6a1a26';
    if (py < 9 && hash2(X, py, variant) < 0.35) c = mix(c, '#6a5a2a', 0.3);  // nicotine
    // decorations on some tiles
    if (H >= 56) {
      const kind = variant % 6;
      if (kind === 1 || kind === 4) { // framed picture: a ship, or the 1971 cup-run team photo
        if (X >= 3 && X <= 12 && py >= 10 && py <= 27) {
          if (X === 3 || X === 12 || py === 10 || py === 27) c = '#c8a040';
          else if (X === 4 || X === 11 || py === 11 || py === 26) c = '#6a4a1a';
          else if (kind === 1) {
            const sea = py > 20;
            c = sea ? ((X + py) % 3 ? '#1a3a5a' : '#2a5a7a') : '#a8b8c0';
            if (py >= 18 && py <= 21 && X >= 5 && X <= 10) c = '#3a1a10'; // hull
            if (X === 8 && py >= 13 && py < 18) c = '#3a2a1a';          // mast
            if (py >= 14 && py <= 16 && X >= 6 && X <= 9 && X !== 8) c = '#e8e0d0'; // sails
          } else {
            c = '#a08a60';
            if ((py === 15 || py === 19 || py === 23) && X % 2 === 1 && X > 4 && X < 11) c = '#3a2a1a';
            if ((py === 16 || py === 20 || py === 24) && X > 4 && X < 11) c = X % 2 ? '#c8102e' : '#7a6a4a';
          }
        }
      } else if (kind === 3) { // brass wall sconce with an amber shade
        if (X >= 6 && X <= 9 && py >= 13 && py <= 17) c = py === 13 ? '#ffe8a8' : '#f0a848';
        else if ((X === 7 || X === 8) && py >= 18 && py <= 21) c = '#c8a040';
        else if (X >= 4 && X <= 11 && py >= 10 && py <= 20 && hash2(X, py, 7) < 0.5) c = mix(c, '#ffb050', 0.18);
      }
    }
  } else if (py < dadoTop) c = py === dadoTop - 3 ? '#9a7a42' : '#4a2c16';
  else if (py >= H - 3) c = py === H - 3 ? '#3a2210' : '#22140a';
  else {
    const pxx = X % 8, pyy = py - dadoTop;
    const frame = pxx === 0 || pxx === 7 || pyy < 2 || pyy > H - dadoTop - 6;
    c = frame ? '#3e2412' : (pxx === 1 || pyy === 2 ? '#7a4a26' : '#5c361c');
    if (!frame && hash2(X + variant * 16, py, 3) < 0.06) c = '#6a3e20';
  }
  return R(side, c);
}
registerWall('pub_panel', { top: '#2a1a12', variants: 12, face: panelFace });
registerWall('pub_panelLow', {
  top: (u, v) => ((u * 8) % 1 < 0.12 ? '#3a2210' : '#6a4022'),
  face(u, py, side, H, r, variant) {
    const X = Math.floor(u * 16);
    let c;
    if (py < 2) c = py === 0 ? '#9a6a3a' : '#5a3418';
    else if (py >= H - 2) c = '#22140a';
    else {
      const pxx = X % 8;
      const frame = pxx === 0 || pxx === 7 || py < 4 || py > H - 5;
      c = frame ? '#3e2412' : (pxx === 1 || py === 4 ? '#7a4a26' : '#5c361c');
    }
    return R(side, c);
  },
});
// THE COUNTER: mahogany panels, brass foot rail; top has beer mats and drip trays. h 1.0 -> you can jump up and fight on it.
registerWall('pub_bar', {
  variants: 9,
  top(u, v, variant) {
    if (v > 0.9) return '#8a3a1a';
    if (v < 0.06) return '#3a140a';
    const k = variant % 3;
    if (k === 0 && u > 0.3 && u < 0.58 && v > 0.35 && v < 0.63) { // beer mat
      const d = Math.hypot(u - 0.44, v - 0.49);
      return d < 0.07 ? '#f4f1e8' : d < 0.11 ? '#c8102e' : '#e8e0d0';
    }
    if (k === 1 && u > 0.12 && u < 0.88 && v > 0.2 && v < 0.55) { // rubber drip mat
      return ((u * 20) % 1 < 0.4 && (v * 12) % 1 < 0.5) ? '#0c0c0e' : '#2a2a2e';
    }
    const grain = n2(u * 2, v * 16 + variant, 121);
    let c = grain < 0.3 ? '#4e1e10' : grain > 0.8 ? '#6a2a16' : '#5a2412';
    if (k === 2 && Math.abs(Math.hypot(u - 0.6, v - 0.5) - 0.1) < 0.02) c = '#3a1408'; // ring stain
    return c;
  },
  face(u, py, side, H) {
    const X = Math.floor(u * 16);
    let c;
    if (py === 0) c = '#a04a22';
    else if (py < 3) c = '#5a2410';
    else if (py === H - 6) c = '#f0c050';
    else if (py === H - 5) c = '#9a7020';
    else if (py >= H - 3) c = '#1e0c06';
    else if (py === H - 4) c = '#2e140a';
    else {
      const pxx = X % 8, pyy = py - 3;
      const frame = pxx === 0 || pxx === 7 || pyy === 0 || py === H - 7;
      c = frame ? '#3a1408' : (pxx === 1 || pyy === 1 ? '#8a3a1c' : '#6a2a14');
    }
    return R(side, c, -0.32);
  },
});
const BOTTLES = ['#2a6a2a', '#7a3a10', '#d8d0b0', '#3a5a9a', '#a01a1a', '#c89020', '#1a1a1a', '#5a8a3a'];
registerWall('pub_backbar', { // shelves of bottles, optics on the mirror, glowing chiller fridges
  top: '#2a1a12', variants: 8,
  face(u, py, side, H, r, variant) {
    const X = Math.floor(u * 16);
    let c;
    if (py < 3) c = py === 0 ? '#8a6a3a' : '#3a2414';
    else if (py < 14) { // mirror with optics
      c = ((X + py) % 7 === 0) ? '#8a9aaa' : '#3e4a58';
      if (X % 4 === 1 || X % 4 === 2) {
        const k = hash2(Math.floor(X / 4) + variant * 4, 1, 131);
        if (py >= 4 && py <= 9) c = X % 4 === 1 ? BOTTLES[Math.floor(k * 6)] : shade(BOTTLES[Math.floor(k * 6)], 0.25);
        if (py === 10 || py === 11) c = X % 4 === 1 ? '#d8d8e0' : '#9a9aa8';
        if (py === 12 && X % 4 === 1) c = '#e8e8f0';
      }
    } else if (py === 14 || py === 30) c = '#ffd27a';
    else if (py === 15 || py === 31) c = '#5a3a20';
    else if (py < 30 || py < 44) { // two shelves of bottles
      const base = py < 30 ? 16 : 32;
      const yy = py - base;
      const col = Math.floor(X / 3), cx = X % 3;
      const k = hash2(col + variant * 6, base, 132);
      const hgt = 8 + Math.floor(k * 6);
      c = '#1a120c';
      if (base === 32 && k < 0.3) { // upturned pint glasses
        if (yy >= 13 - 8 && cx !== 2) c = cx === 0 ? '#c8d8e0' : '#7a8a92';
      } else if (cx !== 2 && yy >= 14 - hgt) {
        const neck = yy < 14 - hgt + 3;
        if (!neck || cx === 0) c = BOTTLES[Math.floor(k * BOTTLES.length)];
        if (cx === 0 && !neck) c = shade(c, 0.3);
        if (!neck && yy > 14 - hgt + 5 && yy < 14 - hgt + 8) c = '#e8e0c8'; // label
      }
      if (yy > 13) c = '#3a2414';
    }
    if (py >= 44) {
      if (py < 46) c = py === 44 ? '#8a3a1a' : '#5a2412';
      else if (py >= H - 2) c = '#120a06';
      else { // chiller fridge
        const fx = X % 8, fy = py - 46;
        if (fx === 0 || fy === 0 || py === H - 3) c = '#1a1a1e';
        else {
          c = '#5aa8c8';
          if (fy % 5 === 4) c = '#2a5a6a';
          else if (fx % 2 === 1 && fy % 5 > 0) c = hash2(X, Math.floor(fy / 5) + variant, 133) < 0.5 ? '#c86a1a' : '#3a8a3a';
          if (fx === 1) c = '#a8e0f0';
        }
      }
    }
    return R(side, c, -0.3);
  },
});
registerWall('pub_extBrick', { // the pub's Victorian exterior: brick, green glazed tiles, etched glowing windows
  top: '#3a2a26', variants: 8,
  face(u, py, side, H, r, variant) {
    const X = Math.floor(u * 16);
    if (py < 3) return R(side, py === 0 ? '#c8b89a' : '#9a8a70');
    if (py >= H - 10) { // glazed tiles
      const c = (py === H - 10 || py === H - 1) ? '#0e2a1a' : (X % 4 === 0 || (py - H + 10) % 5 === 0) ? '#143a26' : (X % 4 === 1 && py % 5 === 2 ? '#5aa07a' : '#1f5a3a');
      return R(side, c);
    }
    const hasWin = variant % 4 !== 3 && H >= 50;
    const wy0 = 12, wy1 = H - 15;
    if (hasWin && X >= 2 && X <= 13 && py >= wy0 && py <= wy1) {
      if (X === 2 || X === 13 || py === wy0 || py === wy1) return R(side, '#d8d0c0');
      if (X === 7 || X === 8 || py === Math.round((wy0 + wy1) / 2)) return R(side, '#c8c0b0');
      const t = (py - wy0) / (wy1 - wy0);
      let c = t < 0.5 ? '#ffd27a' : '#e8a848';
      if ((X + py) % 5 === 0) c = '#fff0c0';
      if (Math.abs((X - 7.5) / 5) + Math.abs(t - 0.5) * 1.6 < 0.5 && (X + py) % 2 === 0) c = '#fff4d8'; // etched oval
      return R(side, c, -0.2);
    }
    if (hasWin && py === wy1 + 1 && X >= 1 && X <= 14) return R(side, '#c8c0b0');
    return brickFace('#7a3a2a', '#3a2220', u, py, side, variant, false);
  },
});
registerWall('pub_fence', { // close-board garden fence, half eaten by ivy
  top: '#5a4028', variants: 6,
  face(u, py, side, H, r, variant) {
    const X = Math.floor(u * 16);
    const ivyD = 0.6 - py / H * 0.7;
    const iv = hash2(Math.floor(X / 2) + variant * 8, Math.floor(py / 2), 141);
    if (iv < ivyD) return R(side, iv < ivyD * 0.4 ? '#3e7a30' : '#2a5a24');
    let c = X % 4 === 0 ? '#2a1a0e' : (hash2(Math.floor(X / 4) + variant * 4, 0, 142) < 0.5 ? '#6a4a2a' : '#5e4026');
    if (py === 8 || py === H - 10) c = '#3e2a16';
    if (py < 2) c = '#7a5a36';
    return R(side, c, -0.3);
  },
});
registerWall('pub_gentsWall', { // tiled gents: cream tiles, a green band, grime and despair
  top: '#9a9aa0', variants: 6,
  face(u, py, side, H, r, variant) {
    const X = Math.floor(u * 16);
    const tx = X % 4, ty = py % 4;
    let c = (tx === 0 || ty === 0) ? '#8a8a7e' : '#ddd8c4';
    if (py >= 22 && py < 30) c = (tx === 0 || ty === 0) ? '#1a4a36' : '#2a7a5a';
    if (py === 21 || py === 30) c = '#101a14';
    if (py >= H - 8) c = (tx === 0 || ty === 0) ? '#1a3a2a' : '#245a42';
    if (py > H - 20 && py < H - 8 && hash2(X, py, variant + 144) < 0.25) c = mix(c, '#a89a5a', 0.4);
    if (hash2(Math.floor(X / 4) + variant * 4, Math.floor(py / 4), 145) < 0.04 && tx === ty) c = '#5a5a50'; // crack
    if (py < 2) c = '#b8b8b0';
    return R(side, c, -0.25);
  },
});
registerWall('pub_partition', { // cubicle partitions: brown laminate covered in scratched wisdom, gap at the bottom
  top: '#a0a0a8', variants: 6,
  face(u, py, side, H, r, variant) {
    const X = Math.floor(u * 16);
    if (py >= H - 4) return null;
    if (py < 2) return R(side, '#b8b8c0');
    let c = '#6a4a32';
    if (X % 8 === 0) c = '#5a3e2a';
    const g = hash2(X + variant * 16, Math.floor(py / 2), 151);
    if (py > 8 && py < H - 10 && g < 0.08) c = '#c8b898';
    if (py > 8 && py < H - 10 && hash2(X + variant * 16, py, 152) < 0.03) c = '#1a1a40';
    return R(side, c, -0.3);
  },
});
registerWall('pub_cellarWall', { // whitewashed cellar brick: peeling, damp, beer lines
  top: '#6a6660', variants: 10,
  face(u, py, side, H, r, variant) {
    const X = Math.floor(u * 16);
    const peel = hash2(Math.floor(X / 3) + variant * 6, Math.floor(py / 5), 161) < 0.05;
    let c = brickFace(peel ? '#8a4a38' : '#d4d0c4', peel ? '#3a2a22' : '#a8a498', u, py, 'left', variant, true);
    if (py > H - 14 && hash2(X, py, variant + 162) < (py - (H - 14)) / 16) c = mix(c, '#3e4a3a', 0.6);
    if (hash2(X, Math.floor(py / 2), variant + 163) < 0.015) c = '#1a1a14';
    if (variant % 5 === 0 && H > 40) { // beer lines along the wall
      if (py === 18) c = '#c03030'; else if (py === 20) c = '#3050c0'; else if (py === 22) c = '#d8d0c0';
      if ((py === 17 || py === 23) && X % 8 === 4) c = '#7a7a80';
    }
    return R(side, c, -0.3);
  },
});
registerWall('pub_gardenWall', { // low garden wall with mossy coping
  top: (u, v, variant) => (hash2(Math.floor(u * 8), Math.floor(v * 8), variant + 171) < 0.25 ? '#4a6a34' : '#8a8478'),
  face(u, py, side, H, r, variant) {
    if (py < 3) return R(side, hash2(Math.floor(u * 16), py, variant) < 0.3 ? '#4a6a34' : (py === 2 ? '#5a5650' : '#8a8478'));
    let c = brickFace('#6a3a2a', '#2e1e1a', u, py, 'left', variant, false);
    if (py > H - 6 && hash2(Math.floor(u * 16), py, variant + 172) < 0.3) c = '#2e4a24';
    return R(side, c, -0.3);
  },
});

// ======================================================================= helpers for props
// world-space dir-aware box: dir 'y' swaps the local x/y axes so the same art can lie along either axis.
function B(ctx, ax, ay, dirY, x, y, z, w, d, h, colors) {
  return dirY ? isoBox(ctx, ax, ay, y, x, z, d, w, h, colors) : isoBox(ctx, ax, ay, x, y, z, w, d, h, colors);
}
function Pd(ax, ay, dirY, x, y, z) { return dirY ? proj(ax, ay, y, x, z) : proj(ax, ay, x, y, z); }
function glow(ctx, x, y, rx, ry, color, a) {
  const prev = ctx.globalAlpha; ctx.globalAlpha = prev * a; ellipse(ctx, x, y, rx, ry, color); ctx.globalAlpha = prev;
}
// Skewed decal drawing on a wall face (like the common graffiti prop). side 'left' = +y face, 'right' = +x face.
function onFace(ctx, ax, ay, side, z, fn) {
  const m = side === 'right' ? proj(ax, ay, 1.01, 0.5, z) : proj(ax, ay, 0.5, 1.01, z);
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.transform(1, side === 'right' ? -0.5 : 0.5, 0, 1, 0, 0);
  fn(ctx);
  ctx.restore();
}

// ---- slip logic shared by beer & water puddles
function slipUpdate(p, world, dt) {
  const r = 0.55 * (p.o.size || 1);
  for (const f of world.fighters) {
    if (!f.alive || !f.onGround || f.z > 0.2 || f.invuln > 0) continue;
    if ((f.data.pubSlipT || 0) > world.time) continue;
    const dx = f.x - p.cx, dy = f.y - p.cy;
    if (dx * dx + dy * dy > r * r) continue;
    let chance = 0;
    if (f.state === 'run') chance = f.isPlayer ? 0.9 : 1;
    else if (f.state === 'walk') chance = f.isPlayer ? 0 : 0.6 * dt * 4;
    else if (f.state === 'attack' && f.attack && f.attack.def.lunge && f.attack.phase <= 1) chance = f.boss ? 0.5 : 0.35;
    if (Math.random() >= chance) { if (chance > 0) f.data.pubSlipT = world.time + 0.25; continue; }
    f.data.pubSlipT = world.time + 2.5;
    const sp = Math.hypot(f.vx, f.vy) || 1;
    const dir = { x: (f.vx || f.fx) / sp, y: (f.vy || f.fy) / sp };
    f.attack = null;
    f.knockDown(dir, 2.5, 1.5);
    if (!f.isPlayer && f.hp > 4) f.hp -= 4;
    world.fx.popup(f.x, f.y, f.z, 'SLIP!', '#ffe14a');
    world.fx.dust(f.x, f.y, 0, 4);
    world.sfx('pub_slip', f);
    if (f.boss) world.toast(`${f.name} WENT FLYING!`);
  }
}
function drawPuddle(ctx, ax, ay, p, t, cols) {
  const c = proj(ax, ay, 0.5, 0.5, 0);
  const s = p.o.size || 1;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * 0.75;
  ellipse(ctx, c.x, c.y, 13 * s, 5 * s, cols[0]);
  ellipse(ctx, c.x + 5 * s, c.y + 2, 7 * s, 3 * s, cols[0]);
  ctx.globalAlpha = prev * 0.6;
  ellipse(ctx, c.x - 2, c.y - 1, 8 * s, 2.5 * s, cols[1]);
  ctx.globalAlpha = prev;
  const k = Math.floor(t * 2 + p.x) % 4;
  px(ctx, cols[2], c.x - 6 * s + k, c.y - 1, 2, 1);
  px(ctx, cols[2], c.x + 4 * s - k, c.y + 1, 1, 1);
  if (cols[3]) { px(ctx, cols[3], c.x - 9 * s, c.y, 2, 1); px(ctx, cols[3], c.x + 7 * s, c.y - 2, 2, 1); }
}

// ---- dance effect (jukebox / DJ decks): costs a quid, every enemy in range stops to dance
export function pubDance(world, p, label) {
  const g = world.game;
  p.open = false;
  world.rebuildPropGrid();
  if ((p.cool || 0) > world.time) { world.toast('GIVE IT A SECOND. IT\'S STILL PLAYING.'); return; }
  if (g.cash < 1) { world.toast('NO QUIDS, NO TUNES.'); world.sfx('locked', p); return; }
  g.cash -= 1;
  p.cool = world.time + 11;
  p.playT = 4.5;
  world.sfx('pub_juke', world.player);
  world.message(label || 'BANGER!', 'EVERYONE STOPS TO DANCE. HIT THEM.', 2, '#ff6ad0');
  const dancers = [];
  for (const f of world.fighters) {
    if (f.team === 'player' || !f.alive || f.boss || f.removed) continue;
    if (Math.hypot(f.x - p.cx, f.y - p.cy) > 9) continue;
    if (!(f.canAct || f.state === 'taunt')) continue;
    f.data.pubPrevTaunt = [f.tauntAnim, f.tauntTime];
    f.tauntAnim = 'pub_dance'; f.tauntTime = 3.2 + Math.random() * 0.8;
    f.attack = null;
    f.setState('taunt'); f.vx = f.vy = 0;
    world.fx.popup(f.x, f.y, f.z + 0.3, '★', '#ff6ad0');
    dancers.push(f);
  }
  p.dancers = dancers;
}
function danceUpdate(p, world, dt) {
  if (p.open) pubDance(world, p, p.o.danceMsg);
  if (p.playT > 0) {
    p.playT -= dt;
    if (Math.random() < dt * 6) world.fx.add({ x: p.cx + (Math.random() - 0.5), y: p.cy + (Math.random() - 0.5), z: 1.6, vz: 1.2, g: 0, life: 0.9, color: ['#ff6ad0', '#6ae0ff', '#ffe14a'][Math.floor(Math.random() * 3)], size: 2 });
  }
  if (p.dancers && p.dancers.length) {
    for (const f of p.dancers) if (f.state !== 'taunt' || !f.alive) {
      if (f.data.pubPrevTaunt) { [f.tauntAnim, f.tauntTime] = f.data.pubPrevTaunt; f.data.pubPrevTaunt = null; }
    }
    p.dancers = p.dancers.filter(f => f.data.pubPrevTaunt);
  }
}

// ======================================================================= props: beer garden
registerProp('pub_picnic', { // A-frame picnic table with bench seats (w 2 along x; dir:'y' turns it)
  w: 2, d: 1, h: 0.75,
  breakable: { hp: 26, debris: ['#8a6a3a', '#6a4a26', '#b08a50'], sfx: 'wood', drops: [['pint', 0.3], ['bottle', 0.3], ['coin', 0.5]], score: 60 },
  draw(ctx, ax, ay, p) {
    const dy = p.o.dir === 'y';
    const wood = p.o.color || '#8a6a3a', dark = shade(wood, -0.35);
    const L = 2;
    for (const lx of [0.25, L - 0.35]) { // A-frame legs
      B(ctx, ax, ay, dy, lx, 0.15, 0, 0.1, 0.1, 0.7, { color: dark });
      B(ctx, ax, ay, dy, lx, 0.75, 0, 0.1, 0.1, 0.7, { color: dark });
    }
    B(ctx, ax, ay, dy, 0.1, 0.02, 0.38, L - 0.2, 0.24, 0.06, { color: wood, outline: OL });       // back bench
    B(ctx, ax, ay, dy, 0.05, 0.3, 0.68, L - 0.1, 0.4, 0.07, { color: wood, outline: OL });        // table top
    for (let i = 1; i < 4; i++) { const a = Pd(ax, ay, dy, 0.05, 0.3 + i * 0.1, 0.75), b = Pd(ax, ay, dy, L - 0.05, 0.3 + i * 0.1, 0.75); line(ctx, a.x, a.y, b.x, b.y, shade(wood, -0.2)); }
    // pints and an overflowing ashtray
    const g1 = Pd(ax, ay, dy, 0.5, 0.45, 0.75), g2 = Pd(ax, ay, dy, 1.3, 0.55, 0.75), at = Pd(ax, ay, dy, 1.6, 0.4, 0.75);
    if (p.o.pints !== false) {
      px(ctx, OL, g1.x - 2, g1.y - 7, 5, 7); px(ctx, '#b06a18', g1.x - 1, g1.y - 5, 3, 4); px(ctx, '#f5f0e0', g1.x - 1, g1.y - 6, 3, 1);
      px(ctx, OL, g2.x - 2, g2.y - 7, 5, 7); px(ctx, '#d8e8f0', g2.x - 1, g2.y - 6, 3, 5); px(ctx, '#c89a30', g2.x - 1, g2.y - 2, 3, 1);
      ellipse(ctx, at.x, at.y - 1, 3, 1.5, '#3a3a40'); px(ctx, '#e8e0d0', at.x - 1, at.y - 2, 2, 1);
    }
    B(ctx, ax, ay, dy, 0.1, 0.74, 0.38, L - 0.2, 0.24, 0.06, { color: wood, outline: OL });       // front bench
  },
});
registerProp('pub_heater', { // gas patio heater: smash it and it topples into a burning patch
  h: 2.1,
  light: { z: 2.0, r: 3.4, color: '#ff9a40', intensity: 0.8, flicker: true },
  breakable: { hp: 14, debris: ['#9aa0a8', '#5a6068', '#ff8a30'], sfx: 'metal', score: 80, leaves: 'pub_fire' },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, b.x, b.y, 8, 3, 0.35);
    ellipse(ctx, b.x, b.y - 1, 7, 3.5, OL); ellipse(ctx, b.x, b.y - 2, 6, 3, '#5a6068');
    ctx.fillStyle = OL; ctx.fillRect(b.x - 5, b.y - 12, 10, 10); ctx.fillStyle = '#6a7078'; ctx.fillRect(b.x - 4, b.y - 11, 8, 9);
    ctx.fillStyle = '#8a929c'; ctx.fillRect(b.x - 3, b.y - 11, 2, 9);
    const top = b.y - 40;
    thick(ctx, b.x, b.y - 11, b.x, top, 4, OL); thick(ctx, b.x, b.y - 11, b.x, top, 2, '#9aa0a8');
    // burner + flame mesh
    ctx.fillStyle = OL; ctx.fillRect(b.x - 4, top - 6, 8, 7);
    for (let i = 0; i < 3; i++) { const f = Math.sin(t * 20 + i * 2) > 0; ctx.fillStyle = f ? '#ffb040' : '#ff6a10'; ctx.fillRect(b.x - 3 + i * 2, top - 5, 2, 5); }
    glow(ctx, b.x, top - 3, 9, 6, '#ff9a40', 0.3 + 0.1 * Math.sin(t * 9));
    // reflector hood
    ellipse(ctx, b.x, top - 8, 12, 4, OL); ellipse(ctx, b.x, top - 9, 11, 3, '#b8bec8'); ellipse(ctx, b.x - 2, top - 10, 5, 1, '#e8eef4');
  },
});
registerProp('pub_fire', { // burning patch from a fallen patio heater: hurts anyone standing in it, burns out
  h: 0, solid: false, depthBias: -1,
  light: { z: 0.8, r: 3.2, color: '#ff7a20', intensity: 0.95, flicker: true },
  update(p, world, dt) {
    p.age = (p.age || 0) + dt;
    if (p.age > 7) { p.removed = true; return; }
    p.tick = (p.tick || 0) - dt;
    if (p.tick > 0) return;
    p.tick = 0.45;
    for (const f of world.fighters) {
      if (!f.alive || f.invuln > 0 || f.z > 0.5 || f.isDown) continue;
      const dx = f.x - p.cx, dy = f.y - p.cy, d = Math.hypot(dx, dy);
      if (d > 0.75) continue;
      const dir = d > 0.05 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
      const res = f.takeHit({ attacker: null, def: { hz: 0.4 }, dmg: 6, dir, kb: 3.5, stun: 0.35, knockdown: false, launch: 0, unblockable: true, guardDmg: 0 }, world);
      world.onHit({ x: p.cx, y: p.cy }, f, { hz: 0.4, sfx: 'punch' }, res, 6);
      world.fx.popup(f.x, f.y, f.z, 'HOT!', '#ff8a30');
    }
  },
  draw(ctx, ax, ay, p, t) {
    const c = proj(ax, ay, 0.5, 0.5, 0);
    const k = Math.max(0, Math.min(1, (7 - (p.age || 0)) / 2));
    ctx.globalAlpha = 0.6; ellipse(ctx, c.x, c.y, 13, 5, '#1a0c06'); ctx.globalAlpha = 1;
    // the toppled heater
    thick(ctx, c.x - 12, c.y - 2, c.x + 8, c.y + 4, 4, OL); thick(ctx, c.x - 12, c.y - 2, c.x + 8, c.y + 4, 2, '#7a8088');
    ellipse(ctx, c.x + 10, c.y + 4, 6, 3, '#9aa0a8');
    for (let i = 0; i < 9; i++) {
      const fx = c.x - 9 + ((i * 37 + Math.floor(t * 14) * 13) % 19), fh = (3 + Math.random() * 10) * k;
      ctx.fillStyle = Math.random() < 0.5 ? '#ffb030' : (Math.random() < 0.5 ? '#ff5a10' : '#ffe080');
      ctx.fillRect(Math.round(fx), Math.round(c.y - fh + (i % 3)), 2, Math.round(fh));
    }
  },
});
registerProp('pub_shelter', { // smoking shelter: posts and a corrugated perspex roof you can walk under (w 3, d 2)
  w: 3, d: 2, h: 0, solid: false, depthBias: 0.6,
  draw(ctx, ax, ay, p, t, world) {
    const W = p.w, D = p.d, zr = 2.3;
    const pl = world && world.player;
    const under = pl && pl.x > p.x - 0.3 && pl.x < p.x + W + 0.3 && pl.y > p.y - 0.3 && pl.y < p.y + D + 0.3;
    // bench + ash bin under the roof
    isoBox(ctx, ax, ay, 0.2, 0.08, 0.4, W - 0.4, 0.3, 0.06, { color: '#4a5a4a', outline: OL });
    isoBox(ctx, ax, ay, 0.3, 0.1, 0, 0.06, 0.06, 0.4, { color: '#2a3028' });
    isoBox(ctx, ax, ay, W - 0.4, 0.1, 0, 0.06, 0.06, 0.4, { color: '#2a3028' });
    const ab = proj(ax, ay, W - 0.35, D - 0.4, 0);
    ctx.fillStyle = OL; ctx.fillRect(ab.x - 4, ab.y - 15, 8, 15); ctx.fillStyle = '#3a4a3a'; ctx.fillRect(ab.x - 3, ab.y - 14, 6, 13);
    ctx.fillStyle = '#c8c8c0'; ctx.fillRect(ab.x - 3, ab.y - 15, 6, 1);
    // posts
    for (const [x, y] of [[0.05, 0.05], [W - 0.1, 0.05], [0.05, D - 0.1], [W - 0.1, D - 0.1]]) {
      const a = proj(ax, ay, x, y, 0), b = proj(ax, ay, x, y, zr);
      thick(ctx, a.x, a.y, b.x, b.y, 3, OL); thick(ctx, a.x, a.y, b.x, b.y, 1, '#3a5a46');
    }
    // roof (slopes down toward +y)
    const P = (x, y) => proj(ax, ay, x, y, zr + 0.25 - y * 0.15);
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * (under ? 0.28 : 0.72);
    fillPoly(ctx, [P(-0.1, -0.05), P(W + 0.1, -0.05), P(W + 0.1, D + 0.1), P(-0.1, D + 0.1)], '#9ab8a8');
    for (let i = 0; i <= 12; i++) { const x = -0.1 + (W + 0.2) * i / 12; const a = P(x, -0.05), b = P(x, D + 0.1); line(ctx, a.x, a.y, b.x, b.y, i % 2 ? '#c8e0d0' : '#6a8a7a'); }
    ctx.globalAlpha = prev;
    const e0 = P(-0.1, D + 0.1), e1 = P(W + 0.1, D + 0.1); line(ctx, e0.x, e0.y, e1.x, e1.y, '#2a3a30');
    if (!under) { const s = proj(ax, ay, W / 2, D + 0.1, zr - 0.1); drawText(ctx, 'SMOKERS', s.x, s.y - 4, { color: '#e8e0c0', align: 'center', outline: OL }); }
  },
});
registerProp('pub_post', { // wooden post holding up the fairy lights
  h: 2.6,
  draw(ctx, ax, ay) {
    const b = proj(ax, ay, 0.5, 0.5, 0), tp = proj(ax, ay, 0.5, 0.5, 2.6);
    shadow(ctx, b.x, b.y, 5, 2, 0.3);
    thick(ctx, b.x, b.y, tp.x, tp.y, 5, OL); thick(ctx, b.x, b.y, tp.x, tp.y, 3, '#6a4a2a');
    line(ctx, b.x - 1, b.y, tp.x - 1, tp.y, '#8a6a3a');
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(tp.x - 3, tp.y - 2, 6, 2);
  },
});
registerProp('pub_aboard', { // chalk A-board: "QUIZ THURS / NO AWAY COLOURS"
  h: 0.9,
  breakable: { hp: 6, debris: ['#1a1a1a', '#6a4a2a', '#e8e8e0'], sfx: 'wood', score: 20 },
  draw(ctx, ax, ay, p) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    shadow(ctx, P(0.5, 0.5, 0).x, P(0.5, 0.5, 0).y, 8, 3, 0.3);
    fillPoly(ctx, [P(0.15, 0.3, 0), P(0.85, 0.3, 0), P(0.85, 0.5, 0.9), P(0.15, 0.5, 0.9)], '#4a3020');
    fillPoly(ctx, [P(0.15, 0.7, 0), P(0.85, 0.7, 0), P(0.85, 0.5, 0.9), P(0.15, 0.5, 0.9)], OL);
    fillPoly(ctx, [P(0.2, 0.68, 0.06), P(0.8, 0.68, 0.06), P(0.8, 0.52, 0.84), P(0.2, 0.52, 0.84)], '#1e2620');
    for (let i = 0; i < 4; i++) {
      const a = P(0.27, 0.66 - i * 0.035, 0.18 + i * 0.17), b = P(0.27 + 0.45 * (0.5 + hash2(i, p.x, 5) * 0.5), 0.66 - i * 0.035, 0.18 + i * 0.17);
      line(ctx, a.x, a.y, b.x, b.y, i === 0 ? '#ff8a8a' : '#e8e8e0');
    }
    const s = P(0.62, 0.6, 0.45); px(ctx, '#c8102e', s.x - 1, s.y - 2, 3, 3);
  },
});
registerProp('pub_hangsign', { // swinging painted pub sign on an iron bracket, hung off a wall face (place on the wall tile)
  h: 0, solid: false, depthBias: 0.05,
  draw(ctx, ax, ay, p, t) {
    const z = p.o.z ?? 2.6;
    const br0 = proj(ax, ay, 0.5, 1.0, z + 0.55), br1 = proj(ax, ay, 0.5, 1.85, z + 0.55);
    thick(ctx, br0.x, br0.y, br1.x, br1.y, 3, OL); thick(ctx, br0.x, br0.y, br1.x, br1.y, 1, '#3a3a40');
    const sw = Math.sin(t * 1.6) * 0.04;
    const P = (y, zz) => proj(ax, ay, 0.5 + sw * (z + 0.5 - zz), y, zz);
    fillPoly(ctx, [P(1.05, z + 0.5), P(1.8, z + 0.5), P(1.8, z - 0.55), P(1.05, z - 0.55)], OL);
    fillPoly(ctx, [P(1.1, z + 0.45), P(1.75, z + 0.45), P(1.75, z - 0.5), P(1.1, z - 0.5)], '#c8a040');
    fillPoly(ctx, [P(1.15, z + 0.4), P(1.7, z + 0.4), P(1.7, z - 0.45), P(1.15, z - 0.45)], '#8a0c20');
    // white anchor
    const c = P(1.42, z), tp = P(1.42, z + 0.3), bt = P(1.42, z - 0.32);
    line(ctx, tp.x, tp.y, bt.x, bt.y, '#f4f1e8'); line(ctx, tp.x + 1, tp.y, bt.x + 1, bt.y, '#f4f1e8');
    const l = P(1.25, z - 0.2), r = P(1.6, z - 0.2);
    line(ctx, l.x, l.y, bt.x, bt.y, '#f4f1e8'); line(ctx, r.x, r.y, bt.x, bt.y, '#f4f1e8');
    const cb0 = P(1.3, z + 0.18), cb1 = P(1.55, z + 0.18); line(ctx, cb0.x, cb0.y, cb1.x, cb1.y, '#f4f1e8');
    ellipse(ctx, tp.x, tp.y - 2, 2, 2, '#f4f1e8'); px(ctx, '#8a0c20', tp.x, tp.y - 2, 1, 1);
    px(ctx, '#ffd27a', c.x - 6, c.y - 12, 1, 1);
  },
});

// ======================================================================= props: lounge
registerProp('pub_booth', { // buttoned red leatherette booth seat; dir 'x' = back along the -y edge, 'y' = along the -x edge
  h: 0.5,
  draw(ctx, ax, ay, p) {
    const dy = p.o.dir === 'y';
    const c = p.o.color || '#7a1a22';
    B(ctx, ax, ay, dy, 0.02, 0.05, 0, 0.96, 0.85, 0.32, { color: '#3a2010', outline: OL });
    B(ctx, ax, ay, dy, 0.02, 0.05, 0.32, 0.96, 0.8, 0.14, { color: c, outline: OL });
    B(ctx, ax, ay, dy, 0.02, 0.0, 0.32, 0.96, 0.22, 0.85, { color: shade(c, -0.08), outline: OL });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const q = Pd(ax, ay, dy, 0.15 + i * 0.23, 0.22, 0.6 + j * 0.3); px(ctx, shade(c, -0.45), q.x, q.y, 1, 1);
    }
    const hl = Pd(ax, ay, dy, 0.1, 0.22, 1.12), hr = Pd(ax, ay, dy, 0.9, 0.22, 1.12); line(ctx, hl.x, hl.y, hr.x, hr.y, shade(c, 0.3));
  },
});
registerProp('pub_jukebox', { // neon jukebox. USE (costs £1): everyone nearby stops fighting to dance.
  h: 1.5, interact: { kind: 'switch', key: null },
  light: { z: 1.2, r: 3.2, color: '#ff3aa0', intensity: 0.85 },
  update(p, world, dt) {
    danceUpdate(p, world, dt);
    if (!p.light) p.light = world.lights.find(l => l.prop === p);
    if (p.light) p.light.color = ['#ff3aa0', '#3ad8ff', '#ffd23a', '#7aff5a'][Math.floor(world.time * (p.playT > 0 ? 6 : 0.7)) % 4];
  },
  draw(ctx, ax, ay, p, t) {
    const fast = p.playT > 0;
    const neon = ['#ff3aa0', '#3ad8ff', '#ffd23a', '#7aff5a'];
    const ni = Math.floor(t * (fast ? 6 : 0.7)) % 4;
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    shadow(ctx, P(0.5, 0.5, 0).x, P(0.5, 0.5, 0).y, 11, 4, 0.4);
    isoBox(ctx, ax, ay, 0.12, 0.15, 0, 0.76, 0.7, 1.15, { color: '#4a1a10', outline: OL });
    for (let k = 0; k < 3; k++) isoBox(ctx, ax, ay, 0.16 + k * 0.08, 0.2, 1.15 + k * 0.1, 0.68 - k * 0.16, 0.6, 0.1, { color: shade('#5a2414', k * 0.05), outline: OL });
    // front (+y face): record window, grill, buttons
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.86, 0.6, 0.75, 1.1, '#ffe8a0');
    isoPanel(ctx, ax, ay, 'left', 0.26, 0.86, 0.48, 0.8, 1.02, fast ? '#fff4c8' : '#e8c070');
    for (let i = 0; i < 4; i++) { const q = P(0.3 + i * 0.12, 0.86, 0.9); ellipse(ctx, q.x, q.y, 2, 1, '#1a1a1a'); }
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.86, 0.6, 0.12, 0.6, '#1a0c08');
    for (let i = 0; i < 6; i++) { const a = P(0.24 + i * 0.1, 0.86, 0.15), b = P(0.24 + i * 0.1, 0.86, 0.55); line(ctx, a.x, a.y, b.x, b.y, '#c8c8d0'); }
    for (let i = 0; i < 5; i++) { const q = P(0.25 + i * 0.12, 0.86, 0.68); px(ctx, neon[(i + ni) % 4], q.x, q.y, 2, 1); }
    // neon arch
    const c1 = neon[ni], c2 = neon[(ni + 2) % 4];
    let a = P(0.14, 0.87, 0.1), b = P(0.14, 0.87, 1.15); thick(ctx, a.x, a.y, b.x, b.y, 2, c1);
    a = P(0.88, 0.87, 0.1); b = P(0.88, 0.87, 1.15); thick(ctx, a.x, a.y, b.x, b.y, 2, c1);
    const pts = []; for (let i = 0; i <= 8; i++) { const ang = Math.PI * i / 8; pts.push(P(0.51 - Math.cos(ang) * 0.37, 0.87, 1.15 + Math.sin(ang) * 0.35)); }
    for (let i = 0; i < 8; i++) thick(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 2, c2);
    glow(ctx, P(0.5, 0.9, 1.0).x, P(0.5, 0.9, 1.0).y, 16, 12, c1, fast ? 0.25 : 0.12);
    if (fast && Math.floor(t * 4) % 2) drawText(ctx, '★', P(0.5, 0.5, 2).x, P(0.5, 0.5, 2).y, { color: c2, align: 'center', outline: OL });
  },
});
registerProp('pub_fruit', { // fruit machine with spinning reels. Smash it for a JACKPOT.
  h: 1.7,
  light: { z: 1.6, r: 2.2, color: '#ffd23a', intensity: 0.55 },
  breakable: { hp: 30, debris: ['#2a2a6a', '#c8c8d0', '#ffd23a', '#c8102e'], sfx: 'metal', score: 300,
    drops: [['coin', 1], ['coin', 1], ['coin', 1], ['coin', 1], ['coin', 0.8], ['cash5', 0.9], ['cash5', 0.5], ['cash20', 0.5]] },
  update(p, world) {
    if (p.removed && !p.jack) { p.jack = true; world.toast('JACKPOT!'); world.sfx('pub_jackpot', world.player); world.fx.confetti(p.cx, p.cy, 0.6, ['#ffd23a', '#c8c8d0', '#c8102e'], 18); }
  },
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    shadow(ctx, P(0.5, 0.5, 0).x, P(0.5, 0.5, 0).y, 10, 4, 0.4);
    isoBox(ctx, ax, ay, 0.12, 0.15, 0, 0.76, 0.7, 1.45, { color: '#22225a', outline: OL });
    isoBox(ctx, ax, ay, 0.1, 0.12, 1.45, 0.8, 0.76, 0.28, { color: '#c8102e', outline: OL });
    // header bulbs
    for (let i = 0; i < 6; i++) { const q = P(0.15 + i * 0.13, 0.88, 1.6); px(ctx, (Math.floor(t * 8) + i) % 2 ? '#ffe14a' : '#7a5a1a', q.x, q.y, 2, 2); }
    // reels
    isoPanel(ctx, ax, ay, 'left', 0.18, 0.86, 0.64, 0.85, 1.3, '#c8c8d0');
    const SYM = [['#c8102e', '#3a8a2a'], ['#ffd23a', '#c88a1a'], ['#f4f1e8', '#1a1a1a'], ['#ff6a1a', '#c8102e']];
    for (let i = 0; i < 3; i++) {
      const spin = ((t + p.x) % 6) < 2.5;
      const k = spin ? Math.floor(t * 14 + i * 3) % 4 : (i + Math.floor(p.x)) % 4;
      const q = P(0.3 + i * 0.2, 0.86, 1.08);
      px(ctx, '#f4f4ec', q.x - 3, q.y - 3, 6, 7);
      px(ctx, SYM[k][0], q.x - 2, q.y - 1, 4, 3); px(ctx, SYM[k][1], q.x - 1, q.y - 2, 2, 1);
    }
    // buttons + coin tray
    for (let i = 0; i < 3; i++) { const q = P(0.3 + i * 0.2, 0.86, 0.72); px(ctx, ['#ff3a3a', '#ffe14a', '#3aff7a'][i], q.x - 1, q.y - 1, 3, 2); }
    isoPanel(ctx, ax, ay, 'left', 0.25, 0.86, 0.5, 0.15, 0.3, '#8a8a92');
    const s = P(0.5, 0.86, 1.62); drawText(ctx, '£', s.x, s.y - 3, { color: '#ffe14a', align: 'center' });
  },
});
registerProp('pub_pool', { // pool table (reds & yellows). w 2 along x. h 0.85 — jump up and fight on the baize.
  w: 2, d: 1, h: 0.85,
  draw(ctx, ax, ay, p) {
    const W = 2, D = 1;
    for (const [x, y] of [[0.12, 0.12], [W - 0.28, 0.12], [0.12, D - 0.28], [W - 0.28, D - 0.28]]) isoBox(ctx, ax, ay, x, y, 0, 0.16, 0.16, 0.3, { color: '#3a1e0c', outline: OL });
    isoBox(ctx, ax, ay, 0.04, 0.04, 0.3, W - 0.08, D - 0.08, 0.45, { color: '#4a2410', outline: OL });
    isoBox(ctx, ax, ay, 0.0, 0.0, 0.75, W, D, 0.1, { top: '#6a3418', left: '#4a2410', right: '#3a1a0a', outline: OL });
    isoQuad(ctx, ax, ay, 0.12, 0.12, 0.85, W - 0.24, D - 0.24, '#1f6a3a');
    isoQuad(ctx, ax, ay, 0.12, 0.12, 0.85, W - 0.24, 0.05, '#17502c');
    for (const [x, y] of [[0.1, 0.1], [1, 0.08], [W - 0.1, 0.1], [0.1, D - 0.1], [1, D - 0.08], [W - 0.1, D - 0.1]]) { const q = proj(ax, ay, x, y, 0.85); ellipse(ctx, q.x, q.y, 2, 1, '#050505'); }
    const balls = [[0.5, 0.5, '#f4f1e8'], [1.35, 0.5, '#c8102e'], [1.42, 0.42, '#f0c020'], [1.42, 0.58, '#c8102e'], [1.5, 0.35, '#f0c020'], [1.5, 0.5, '#111111'], [1.5, 0.65, '#c8102e'], [1.0, 0.3, '#f0c020'], [0.8, 0.7, '#c8102e']];
    for (const [x, y, c] of balls) { const q = proj(ax, ay, x, y, 0.85); px(ctx, c, q.x - 1, q.y - 2, 2, 2); px(ctx, '#ffffff', q.x - 1, q.y - 2, 1, 1); }
    const c0 = proj(ax, ay, 0.15, 0.85, 0.87), c1 = proj(ax, ay, 1.4, 0.75, 0.87);
    line(ctx, c0.x, c0.y, c1.x, c1.y, '#c8a060'); px(ctx, '#3a6ae8', c1.x, c1.y, 1, 1);
  },
});
registerProp('pub_poollamp', { // long green lamp hanging over the pool table (w 2)
  w: 2, d: 1, h: 0, solid: false, depthBias: 0.3,
  light: { z: 2.4, r: 3.6, color: '#fff0c0', intensity: 0.95 },
  draw(ctx, ax, ay) {
    const z = 2.1;
    for (const x of [0.5, 1.5]) { const a = proj(ax, ay, x, 0.5, z + 0.25), b = proj(ax, ay, x, 0.5, 3.4); line(ctx, a.x, a.y, b.x, b.y, '#2a2a2a'); }
    isoBox(ctx, ax, ay, 0.25, 0.32, z, 1.5, 0.36, 0.22, { top: '#2a6a46', left: '#1f5a3a', right: '#14402a', outline: OL });
    const a = proj(ax, ay, 0.3, 0.68, z), b = proj(ax, ay, 1.7, 0.68, z); line(ctx, a.x, a.y + 1, b.x, b.y + 1, '#fff4c8');
    glow(ctx, proj(ax, ay, 1, 0.5, z).x, proj(ax, ay, 1, 0.5, z).y + 4, 22, 6, '#fff0c0', 0.12);
  },
});
registerProp('pub_cuerack', { // cue rack against the wall. USE = grab a pool cue (spec: side 'left' = wall at -y, 'right' = wall at -x)
  h: 0, solid: false, pickup: 'pub_cue',
  draw(ctx, ax, ay, p) {
    const right = p.o.side === 'right';
    const P = (a, z) => (right ? proj(ax, ay, 0.04, a, z) : proj(ax, ay, a, 0.04, z));
    fillPoly(ctx, [P(0.15, 1.9), P(0.85, 1.9), P(0.85, 0.15), P(0.15, 0.15)], OL);
    fillPoly(ctx, [P(0.18, 1.86), P(0.82, 1.86), P(0.82, 0.19), P(0.18, 0.19)], '#5a3418');
    for (let i = 0; i < 4; i++) {
      const a = P(0.27 + i * 0.15, 0.1), b = P(0.25 + i * 0.15, 1.85);
      thick(ctx, a.x, a.y, b.x, b.y, 2, OL); line(ctx, a.x, a.y, b.x, b.y, i % 2 ? '#c8a060' : '#b08850');
      line(ctx, a.x, a.y - 1, a.x, a.y - 4, '#2a1a10'); px(ctx, '#4a7ae8', b.x, b.y, 1, 1);
    }
    const s = P(0.5, 1.95); px(ctx, '#3a6ae8', s.x - 1, s.y - 2, 3, 2);
  },
});
registerProp('pub_dartboard', { // dartboard + chalk scoreboard, a decal on a wall face (place on the wall tile)
  h: 0, solid: false, depthBias: 0.02,
  draw(ctx, ax, ay, p) {
    const side = p.o.side || 'left';
    onFace(ctx, ax, ay, side, p.o.z ?? 1.5, g => {
      ellipse(g, 0, 0, 8, 8, '#2a1a10');
      ellipse(g, 0, 0, 7, 7, '#141414');
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
        const r = Math.hypot(x, y); if (r > 6.2) continue;
        const seg = Math.floor(((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * 20 + 0.5) % 2;
        let c = seg ? '#e8dcb8' : '#141414';
        if (r > 5.2 || (r > 3 && r < 3.9)) c = seg ? '#c8102e' : '#1f7a3a';
        if (r < 1.6) c = r < 0.8 ? '#c8102e' : '#1f7a3a';
        px(g, c, x, y, 1, 1);
      }
      line(g, 2, -1, 6, -4, '#c8c8d0'); px(g, '#ff3a3a', 6, -5, 2, 1);
      line(g, -1, 2, 3, -1, '#c8c8d0'); px(g, '#3aff7a', 3, -2, 2, 1);
      // scoreboard
      px(g, '#3a2a1a', 11, -9, 14, 18); px(g, '#1e2620', 12, -8, 12, 16);
      drawText(g, '501', 13, -7, { color: '#e8e8e0' });
      px(g, '#c8c8c0', 13, 1, 9, 1); px(g, '#c8c8c0', 13, 4, 6, 1);
    });
  },
});
registerProp('pub_telly', { // telly on a wall bracket showing the build-up. Decal on a wall face (place on the wall tile).
  h: 0, solid: false, depthBias: 0.03,
  light: { z: 2.0, r: 2.0, color: '#8ab8ff', intensity: 0.45 },
  draw(ctx, ax, ay, p, t) {
    const side = p.o.side || 'left';
    onFace(ctx, ax, ay, side, p.o.z ?? 2.1, g => {
      px(g, '#2a2a2e', -2, 7, 4, 4);
      px(g, OL, -12, -9, 24, 17); px(g, '#2a2a30', -11, -8, 22, 15);
      px(g, '#2e7a32', -10, -7, 20, 12);
      px(g, '#e8f0e0', -10, -2, 20, 1); px(g, '#e8f0e0', -1, -7, 1, 12);
      const bx = Math.round(Math.sin(t * 1.3) * 7), by = Math.round(Math.cos(t * 1.7) * 3);
      px(g, '#ffffff', bx, by - 2, 1, 1);
      for (let i = 0; i < 4; i++) { const q = Math.round(Math.sin(t * 1.1 + i * 1.7) * 8); px(g, i % 2 ? '#c8102e' : '#1f4fb4', q, -5 + i * 3, 1, 2); }
      px(g, '#1a1a1a', -10, -7, 13, 3); drawText(g, '0-0', -9, -7, { color: '#ffffff', scale: 1 });
      if (Math.floor(t * 3) % 7 === 0) px(g, '#ffffff', -10, -7 + Math.floor(t * 40) % 12, 20, 1);
    });
  },
});
registerProp('pub_stool', { // bar stool: smash it, or USE to pick it up and swing it
  h: 0.6, pickup: 'pub_stool',
  breakable: { hp: 6, debris: ['#6a4020', '#8a1a22', '#c8c8d0'], sfx: 'wood', score: 20 },
  draw(ctx, ax, ay, p) {
    const c = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, c.x, c.y, 7, 3, 0.3);
    for (const [x, y] of [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]]) {
      const a = proj(ax, ay, x, y, 0), b = proj(ax, ay, 0.5 + (x - 0.5) * 0.6, 0.5 + (y - 0.5) * 0.6, 0.6);
      thick(ctx, a.x, a.y, b.x, b.y, 2, OL); line(ctx, a.x, a.y, b.x, b.y, '#6a4020');
    }
    const r = proj(ax, ay, 0.5, 0.5, 0.25); ellipse(ctx, r.x, r.y, 6, 2.5, '#5a3418'); ellipse(ctx, r.x, r.y - 1, 5, 1.5, '#3a2010');
    const s = proj(ax, ay, 0.5, 0.5, 0.6);
    ellipse(ctx, s.x, s.y + 1, 8, 4, OL); ellipse(ctx, s.x, s.y + 1, 7, 3, '#5a0c14'); ellipse(ctx, s.x, s.y, 7, 3, '#8a1a22'); px(ctx, '#c84a52', s.x - 4, s.y - 1, 3, 1);
  },
});

// ======================================================================= props: cellar & yard
registerProp('pub_keg', { // steel keg: smash it and it spills (slippery!) and maybe a pint survives
  h: 0.85,
  breakable: { hp: 22, debris: ['#9aa0a8', '#6a7078', '#e0b040', '#f4f1e8'], sfx: 'metal', drops: [['pint', 0.55], ['coin', 0.3]], score: 60, leaves: 'pub_spill' },
  draw(ctx, ax, ay, p) {
    const s = proj(ax, ay, 0.5, 0.5, 0), H = Math.round(Z_PX * 0.85);
    shadow(ctx, s.x, s.y, 9, 4, 0.4);
    ellipse(ctx, s.x, s.y, 8, 4, OL);
    ctx.fillStyle = OL; ctx.fillRect(s.x - 8, s.y - H, 16, H);
    ctx.fillStyle = '#8a9098'; ctx.fillRect(s.x - 7, s.y - H, 14, H);
    ellipse(ctx, s.x, s.y - 1, 7, 3, '#8a9098');
    ctx.fillStyle = '#c8ced6'; ctx.fillRect(s.x - 4, s.y - H, 2, H);
    ctx.fillStyle = '#5a6068'; ctx.fillRect(s.x + 4, s.y - H, 2, H);
    ctx.fillStyle = '#6a7078'; ctx.fillRect(s.x - 7, s.y - H + 3, 14, 1); ctx.fillRect(s.x - 7, s.y - 4, 14, 1);
    ctx.fillStyle = p.o.color || '#c8102e'; ctx.fillRect(s.x - 7, s.y - H + 7, 14, 3);
    ellipse(ctx, s.x, s.y - H, 8, 4, OL); ellipse(ctx, s.x, s.y - H, 7, 3, '#b0b6be'); ellipse(ctx, s.x, s.y - H, 4, 2, '#6a7078');
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(s.x - 2, s.y - H - 3, 4, 3); ctx.fillStyle = '#c8102e'; ctx.fillRect(s.x - 1, s.y - H - 4, 2, 1);
  },
});
registerProp('pub_cask', { // wooden ale cask on end: smash it -> beer everywhere
  h: 0.9,
  breakable: { hp: 16, debris: ['#7a4a24', '#5a3418', '#3a3a40', '#e0b040'], sfx: 'wood', drops: [['pint', 0.45], ['pub_crisps', 0.15], ['coin', 0.4]], score: 50, leaves: 'pub_spill' },
  draw(ctx, ax, ay, p) {
    const s = proj(ax, ay, 0.5, 0.5, 0), H = Math.round(Z_PX * 0.9);
    shadow(ctx, s.x, s.y, 10, 4, 0.4);
    const c = p.o.color || '#7a4a24';
    for (let i = 0; i <= H; i++) {
      const k = Math.sin((i / H) * Math.PI);
      const w = Math.round(7 + k * 2);
      ctx.fillStyle = OL; ctx.fillRect(s.x - w - 1, s.y - i, w * 2 + 2, 1);
      ctx.fillStyle = (i === 3 || i === 4 || i === H - 4 || i === H - 3) ? '#3a3a40' : c; ctx.fillRect(s.x - w, s.y - i, w * 2, 1);
      ctx.fillStyle = shade(c, 0.18); ctx.fillRect(s.x - w + 3, s.y - i, 2, 1);
      ctx.fillStyle = shade(c, -0.25); ctx.fillRect(s.x + w - 3, s.y - i, 2, 1);
      ctx.fillStyle = shade(c, -0.12); ctx.fillRect(s.x - 1, s.y - i, 1, 1);
    }
    ellipse(ctx, s.x, s.y - H, 8, 4, OL); ellipse(ctx, s.x, s.y - H, 7, 3, shade(c, -0.15));
    for (let i = -5; i <= 5; i += 3) px(ctx, shade(c, -0.35), s.x + i, s.y - H - 1, 1, 3);
    px(ctx, '#c8a040', s.x - 1, s.y - H - 1, 2, 1);
  },
});
registerProp('pub_spill', { // a puddle of best bitter. SLIPPERY.
  h: 0, solid: false, depthBias: -6,
  update: slipUpdate,
  draw(ctx, ax, ay, p, t) { drawPuddle(ctx, ax, ay, p, t, ['#7a4a10', '#c8902a', '#f4f0d8', '#f4f0d8']); },
});
registerProp('pub_water', { // a puddle from a smashed toilet/sink. Also SLIPPERY. Try not to think about it.
  h: 0, solid: false, depthBias: -6,
  update: slipUpdate,
  draw(ctx, ax, ay, p, t) { drawPuddle(ctx, ax, ay, p, t, ['#3a5a6a', '#8ab0c0', '#d8eef4']); },
});
registerProp('pub_empties', { // crate of empty bottles
  h: 0.7,
  breakable: { hp: 8, debris: ['#c8202a', '#2a6a2a', '#7a3a10', '#d8e8d8'], sfx: 'glass', drops: [['bottle', 0.7]], score: 30 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#c8202a';
    isoBox(ctx, ax, ay, 0.1, 0.1, 0, 0.8, 0.8, 0.5, { color: c, outline: OL });
    for (let i = 0; i < 3; i++) { const a = proj(ax, ay, 0.1, 0.9, 0.1 + i * 0.15), b = proj(ax, ay, 0.9, 0.9, 0.1 + i * 0.15); line(ctx, a.x, a.y, b.x, b.y, shade(c, -0.3)); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const q = proj(ax, ay, 0.2 + i * 0.2, 0.25 + j * 0.25, 0.5);
      const bc = (i + j * 2 + p.x) % 3 === 0 ? '#2a6a2a' : '#6a3410';
      px(ctx, OL, q.x - 1, q.y - 6, 3, 6); px(ctx, bc, q.x, q.y - 5, 1, 5); px(ctx, '#d8c050', q.x, q.y - 6, 1, 1);
    }
  },
});
registerProp('pub_dray', { // the brewery's dray lorry, parked in the yard with a load of kegs (w 4, d 2, along x; cab at +x)
  w: 4, d: 2, h: 1.3,
  draw(ctx, ax, ay, p) {
    const c = p.o.color || '#6a1a24';
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.2); ellipse(ctx, s.x, s.y, 5, 4, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 2, '#5a5a62'); };
    wh(0.6, 1.9); wh(2.0, 1.9); wh(3.4, 1.9);
    isoBox(ctx, ax, ay, 0.05, 0.1, 0.25, 3.9, 1.8, 0.2, { color: '#1a1a1e', outline: OL });
    isoBox(ctx, ax, ay, 0.05, 0.1, 0.45, 2.85, 1.8, 0.25, { color: c, outline: OL });
    // side board with lettering
    const m = proj(ax, ay, 1.45, 1.9, 0.57);
    ctx.save(); ctx.translate(m.x, m.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
    drawText(ctx, 'NORDHAMN', 0, -3, { color: '#e8c050', align: 'center' });
    ctx.restore();
    // kegs on the flatbed
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const s = proj(ax, ay, 0.45 + i * 0.85, 0.5 + j * 0.85, 0.7), H = 13;
      ellipse(ctx, s.x, s.y, 7, 3.5, OL); ctx.fillStyle = OL; ctx.fillRect(s.x - 7, s.y - H, 14, H);
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(s.x - 6, s.y - H, 12, H); ctx.fillStyle = '#d0d6de'; ctx.fillRect(s.x - 3, s.y - H, 2, H);
      ctx.fillStyle = '#c8102e'; ctx.fillRect(s.x - 6, s.y - H + 5, 12, 2);
      ellipse(ctx, s.x, s.y - H, 7, 3.5, OL); ellipse(ctx, s.x, s.y - H, 6, 2.5, '#b8bec6');
    }
    // cab
    isoBox(ctx, ax, ay, 2.95, 0.1, 0.45, 0.95, 1.8, 1.0, { color: c, outline: OL });
    isoBox(ctx, ax, ay, 2.95, 0.1, 1.45, 0.95, 1.8, 0.55, { top: shade(c, 0.1), left: '#9ab8d0', right: '#6a88a0', outline: OL });
    const hl = proj(ax, ay, 3.92, 0.4, 0.75), hr = proj(ax, ay, 3.92, 1.6, 0.75);
    px(ctx, '#fff2a0', hl.x - 1, hl.y - 1, 3, 2); px(ctx, '#fff2a0', hr.x - 1, hr.y - 1, 3, 2);
    const g = proj(ax, ay, 3.92, 1.0, 0.65); px(ctx, '#c8c8d0', g.x - 4, g.y - 2, 8, 1);
  },
});

// ======================================================================= props: gents
registerProp('pub_toilet', { // toilet with the cistern against the +x wall. Smash -> water everywhere.
  h: 0.5,
  breakable: { hp: 14, debris: ['#e8e8e0', '#c8c8c0', '#ffffff'], sfx: 'glass', drops: [['coin', 0.5]], score: 40, leaves: 'pub_water' },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.72, 0.28, 0.35, 0.22, 0.44, 0.6, { top: '#f4f4ec', left: '#d8d8d0', right: '#b8b8b0', outline: OL });
    const b = proj(ax, ay, 0.48, 0.5, 0);
    ctx.fillStyle = OL; ctx.fillRect(b.x - 4, b.y - 8, 8, 8); ctx.fillStyle = '#d8d8d0'; ctx.fillRect(b.x - 3, b.y - 8, 6, 7);
    const s = proj(ax, ay, 0.45, 0.5, 0.45);
    ellipse(ctx, s.x, s.y, 8, 4, OL); ellipse(ctx, s.x, s.y, 7, 3, '#1a1a1a'); ellipse(ctx, s.x, s.y, 5, 2, '#6a8a9a');
    const f = proj(ax, ay, 0.85, 0.5, 1.0); px(ctx, '#c8c8d0', f.x - 1, f.y - 1, 3, 1);
  },
});
registerProp('pub_urinal', { // wall-hung urinal against the -y wall (decal-ish, no collision)
  h: 0, solid: false,
  draw(ctx, ax, ay) {
    const P = (x, z) => proj(ax, ay, x, 0.06, z);
    fillPoly(ctx, [P(0.28, 1.25), P(0.72, 1.25), P(0.72, 0.35), P(0.28, 0.35)], OL);
    fillPoly(ctx, [P(0.31, 1.2), P(0.69, 1.2), P(0.69, 0.4), P(0.31, 0.4)], '#e8e8e0');
    fillPoly(ctx, [P(0.36, 0.95), P(0.64, 0.95), P(0.64, 0.45), P(0.36, 0.45)], '#a8b0b0');
    const c = P(0.5, 0.5); px(ctx, '#ffe14a', c.x - 1, c.y - 1, 3, 1);
    const a = P(0.5, 1.25), b = P(0.5, 2.2); line(ctx, a.x, a.y, b.x, b.y, '#9a9aa2');
  },
});
registerProp('pub_sink', { // sink + cracked mirror against the -x wall. Smash -> water.
  h: 0.9,
  breakable: { hp: 10, debris: ['#e8e8e0', '#c8d8e0', '#ffffff'], sfx: 'glass', score: 30, leaves: 'pub_water' },
  draw(ctx, ax, ay) {
    isoPanel(ctx, ax, ay, 'right', 0.03, 0.2, 0.6, 1.25, 2.1, '#5a6a72');
    isoPanel(ctx, ax, ay, 'right', 0.03, 0.24, 0.52, 1.3, 2.05, '#9ab8c8');
    const a = proj(ax, ay, 0.03, 0.3, 1.9), b = proj(ax, ay, 0.03, 0.6, 1.4); line(ctx, a.x, a.y, b.x, b.y, '#e8f4f8');
    const p0 = proj(ax, ay, 0.4, 0.5, 0); ctx.fillStyle = OL; ctx.fillRect(p0.x - 2, p0.y - 16, 4, 16); ctx.fillStyle = '#c8c8c0'; ctx.fillRect(p0.x - 1, p0.y - 16, 2, 15);
    isoBox(ctx, ax, ay, 0.05, 0.2, 0.75, 0.55, 0.6, 0.15, { top: '#f4f4ec', left: '#d8d8d0', right: '#b8b8b0', outline: OL });
    isoQuad(ctx, ax, ay, 0.12, 0.28, 0.9, 0.4, 0.44, '#8aa0aa');
    const t = proj(ax, ay, 0.1, 0.5, 1.05); px(ctx, '#c8c8d0', t.x - 1, t.y - 2, 3, 2);
  },
});
registerProp('pub_cubdoor', { // cubicle door swung open into the cubicle (anchor = the cubicle tile at the door edge, -x side)
  h: 0, solid: false, depthBias: -0.3,
  draw(ctx, ax, ay, p) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const y0 = p.o.dy || 0;
    fillPoly(ctx, [P(0, y0 + 0.05, 0.15), P(0.55, y0 + 0.75, 0.15), P(0.55, y0 + 0.75, 1.85), P(0, y0 + 0.05, 1.85)], OL);
    fillPoly(ctx, [P(0.03, y0 + 0.1, 0.18), P(0.5, y0 + 0.72, 0.18), P(0.5, y0 + 0.72, 1.8), P(0.03, y0 + 0.1, 1.8)], '#6a4a32');
    const k = P(0.4, y0 + 0.6, 1.0); px(ctx, '#c8c8d0', k.x, k.y, 2, 1);
    const sgn = P(0.25, y0 + 0.4, 1.5); px(ctx, '#3aa03a', sgn.x - 1, sgn.y - 1, 3, 2);
  },
});
registerProp('pub_armchair', { // Ron's chintzy armchair in the secret snug
  h: 0.55,
  draw(ctx, ax, ay) {
    const c = '#8a5a3a';
    isoBox(ctx, ax, ay, 0.12, 0.12, 0, 0.76, 0.76, 0.4, { color: c, outline: OL });
    isoBox(ctx, ax, ay, 0.62, 0.12, 0.4, 0.26, 0.76, 0.7, { color: shade(c, -0.1), outline: OL });
    isoBox(ctx, ax, ay, 0.12, 0.12, 0.4, 0.5, 0.18, 0.3, { color: shade(c, 0.05), outline: OL });
    isoBox(ctx, ax, ay, 0.12, 0.7, 0.4, 0.5, 0.18, 0.3, { color: shade(c, 0.05), outline: OL });
    for (let i = 0; i < 6; i++) { const q = proj(ax, ay, 0.2 + (i % 3) * 0.15, 0.3 + Math.floor(i / 3) * 0.25, 0.4); px(ctx, '#d8a0a0', q.x, q.y, 2, 1); }
  },
});

// ======================================================================= props: function room
registerProp('pub_stage', { // low wooden stage (big prop, w/d from the spec). h 0.3: walk straight up onto it.
  w: 4, d: 8, h: 0.3, depthBias: -9,
  draw(ctx, ax, ay, p, t) {
    const W = p.w, D = p.d;
    isoBox(ctx, ax, ay, 0, 0, 0, W, D, 0.3, { top: '#5a3a20', left: '#141418', right: '#0c0c10', outline: OL });
    for (let i = 1; i < W * 4; i++) { const a = proj(ax, ay, i / 4, 0, 0.3), b = proj(ax, ay, i / 4, D, 0.3); line(ctx, a.x, a.y, b.x, b.y, i % 4 ? '#4a2e18' : '#3a2410'); }
    const x1 = proj(ax, ay, 2.2, 3.6, 0.3), x2 = proj(ax, ay, 2.6, 4.0, 0.3), x3 = proj(ax, ay, 2.6, 3.6, 0.3), x4 = proj(ax, ay, 2.2, 4.0, 0.3);
    line(ctx, x1.x, x1.y, x2.x, x2.y, '#d8d0b0'); line(ctx, x3.x, x3.y, x4.x, x4.y, '#d8d0b0');
    for (let i = 0; i < D * 2; i++) { // footlights along the +x edge
      const q = proj(ax, ay, W, 0.25 + i * 0.5, 0.15);
      px(ctx, ['#ff3a3a', '#3a8aff', '#ffe14a'][(i + Math.floor(t * 2)) % 3], q.x - 1, q.y - 1, 2, 2);
    }
  },
});
registerProp('pub_speaker', { // PA speaker stack (spec z = base height, e.g. 0.3 on the stage)
  h: 1.9,
  draw(ctx, ax, ay, p, t) {
    const z = p.o.z || 0;
    isoBox(ctx, ax, ay, 0.12, 0.12, z, 0.76, 0.76, 0.85, { color: '#1a1a1e', outline: OL });
    isoBox(ctx, ax, ay, 0.16, 0.16, z + 0.85, 0.68, 0.68, 0.7, { color: '#1e1e24', outline: OL });
    const thump = Math.sin(t * 12) > 0.6 ? 1 : 0;
    for (const [zz, r] of [[z + 0.42, 5], [z + 1.2, 3]]) {
      const l = proj(ax, ay, 0.5, 0.89, zz), rr = proj(ax, ay, 0.89, 0.5, zz);
      ellipse(ctx, l.x, l.y, r + thump, r + thump, '#3a3a42'); ellipse(ctx, l.x, l.y, 2, 2, '#0a0a0c');
      ellipse(ctx, rr.x, rr.y, r, r, '#2a2a30'); ellipse(ctx, rr.x, rr.y, 1, 1, '#0a0a0c');
    }
  },
});
registerProp('pub_decks', { // DJ decks on the stage (spec z base). USE (£1) = DISCO! Everyone dances.
  w: 1, d: 2, h: 1.0, interact: { kind: 'switch', key: null },
  light: { z: 1.3, r: 2.4, color: '#6ae0ff', intensity: 0.6 },
  update: danceUpdate,
  draw(ctx, ax, ay, p, t) {
    const z = p.o.z || 0;
    isoBox(ctx, ax, ay, 0.1, 0.1, z, 0.8, 1.8, 0.62, { top: '#1a1a1e', left: '#0e0e12', right: '#08080a', outline: OL });
    const s = proj(ax, ay, 0.5, 1.9, z + 0.3);
    ctx.save(); ctx.translate(s.x, s.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
    drawText(ctx, 'DJ', -13, -4, { color: '#ff6ad0' });
    ctx.restore();
    for (const y of [0.5, 1.5]) {
      const c = proj(ax, ay, 0.5, y, z + 0.62);
      ellipse(ctx, c.x, c.y, 7, 3.5, '#2a2a30'); ellipse(ctx, c.x, c.y, 5, 2.5, '#0a0a0a');
      const a = t * (p.playT > 0 ? 9 : 3) + y;
      line(ctx, c.x, c.y, c.x + Math.cos(a) * 4, c.y + Math.sin(a) * 2, '#5a5a62');
      px(ctx, '#c8102e', c.x, c.y, 1, 1);
    }
    for (let i = 0; i < 4; i++) { const q = proj(ax, ay, 0.3 + i * 0.12, 1.0, z + 0.62); px(ctx, Math.sin(t * 9 + i) > 0 ? '#3aff7a' : '#1a4a2a', q.x, q.y - 1, 1, 2); }
  },
});
registerProp('pub_mic', { // mic stand
  h: 0, solid: false,
  draw(ctx, ax, ay, p) {
    const z = p.o.z || 0;
    const b = proj(ax, ay, 0.5, 0.5, z), tp = proj(ax, ay, 0.5, 0.5, z + 1.6);
    line(ctx, b.x - 4, b.y + 1, b.x + 4, b.y - 1, '#2a2a30');
    thick(ctx, b.x, b.y, tp.x, tp.y, 1, '#3a3a42');
    line(ctx, tp.x, tp.y, tp.x + 5, tp.y - 3, '#3a3a42');
    ellipse(ctx, tp.x + 6, tp.y - 4, 2, 2, '#9a9aa2');
  },
});
registerProp('pub_disco', { // mirror ball hanging over the dance floor (the moving spots are level lights)
  h: 0, solid: false, depthBias: 4,
  draw(ctx, ax, ay, p, t) {
    const z = p.o.z ?? 3.0;
    const c = proj(ax, ay, 0.5, 0.5, z), top = proj(ax, ay, 0.5, 0.5, z + 1.2);
    line(ctx, c.x, c.y - 6, top.x, top.y, '#5a5a62');
    ellipse(ctx, c.x, c.y, 7, 7, OL);
    for (let y = -6; y <= 6; y += 2) for (let x = -6; x <= 6; x += 2) {
      if (x * x + y * y > 38) continue;
      const k = hash2(Math.floor(x + t * 6) + 50, y + 50, 7);
      const c2 = k > 0.92 ? '#ffffff' : k > 0.7 ? '#c8d0e0' : k > 0.4 ? '#8a90a0' : '#5a5e6a';
      px(ctx, c2, c.x + x, c.y + y, 2, 2);
    }
    if (Math.floor(t * 5) % 3 === 0) { px(ctx, '#ffffff', c.x - 3, c.y - 9, 1, 3); px(ctx, '#ffffff', c.x - 4, c.y - 8, 3, 1); }
  },
});
registerProp('pub_buffet', { // the silver-wedding buffet (w 2 along x). Smash it: pies and crisps everywhere.
  w: 2, d: 1, h: 0.8,
  breakable: { hp: 18, debris: ['#f4f4ec', '#c8902a', '#e8c070', '#c8102e'], sfx: 'wood', score: 80,
    drops: [['pie', 0.9], ['pub_crisps', 0.9], ['pub_crisps', 0.5], ['pie', 0.35]] },
  draw(ctx, ax, ay) {
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, 1.9, 0.8, 0.78, { top: '#f4f4ec', left: '#e8e8e0', right: '#c8c8c0', outline: OL });
    for (let i = 0; i < 10; i++) { const q = proj(ax, ay, 0.05 + i * 0.19, 0.9, 0.05); ellipse(ctx, q.x + 2, q.y, 2, 1, '#c8c8c0'); }
    const food = [[0.3, 0.45, '#e8c070', 'rolls'], [0.75, 0.4, '#f0e0b0', 'sarnies'], [1.2, 0.5, '#e8b040', 'crisps'], [1.6, 0.45, '#f4f1e8', 'cake']];
    for (const [x, y, c, k] of food) {
      const q = proj(ax, ay, x, y, 0.78);
      ellipse(ctx, q.x, q.y, 6, 3, '#e8e8f0'); ellipse(ctx, q.x, q.y, 5, 2, '#c8c8d0');
      if (k === 'cake') { px(ctx, OL, q.x - 4, q.y - 7, 8, 6); px(ctx, '#f4f1e8', q.x - 3, q.y - 6, 6, 4); px(ctx, '#c8a040', q.x - 3, q.y - 6, 6, 1); px(ctx, '#ffe14a', q.x - 1, q.y - 9, 1, 2); }
      else for (let j = 0; j < 4; j++) px(ctx, j % 2 ? c : shade(c, -0.2), q.x - 4 + j * 2, q.y - 2 - (j % 2), 2, 2);
    }
  },
});
registerProp('pub_balloons', { // party balloons tied to something (decorative)
  h: 0, solid: false, depthBias: 0.5,
  draw(ctx, ax, ay, p, t) {
    const cols = p.o.colors || ['#c8c8d0', '#e8e8f0', '#c8102e'];
    const base = proj(ax, ay, 0.5, 0.5, p.o.z ?? 0.8);
    cols.forEach((c, i) => {
      const sw = Math.sin(t * 1.3 + i * 2) * 2;
      const bx = base.x - 6 + i * 6 + sw, by = base.y - 26 - (i % 2) * 7;
      line(ctx, base.x, base.y, bx, by + 5, '#d8d8d0');
      ellipse(ctx, bx, by, 4, 5, OL); ellipse(ctx, bx, by, 3, 4, c); px(ctx, '#ffffff', bx - 1, by - 2, 1, 2);
    });
  },
});

// ======================================================================= props: doors, hatch, boards
registerProp('pub_door', { // panelled pub door with frosted glass. dir 'x' (spans x) | 'y'. Interact door (spec: key, requiresExit, lockedMsg, label)
  h: 3, interact: { kind: 'door', key: null },
  draw(ctx, ax, ay, p) {
    const dy = p.o.dir === 'y';
    const c = p.o.color || '#4a2412';
    if (p.open) { // swung back against the frame
      B(ctx, ax, ay, dy, 0.0, 0.0, 0, 0.12, 0.9, 2.6, { color: c, outline: OL });
      return;
    }
    B(ctx, ax, ay, dy, 0, 0.42, 0, 1, 0.16, 2.6, { color: c, outline: OL });
    const F = (u, z) => Pd(ax, ay, dy, u, 0.58, z);
    fillPoly(ctx, [F(0.18, 2.35), F(0.82, 2.35), F(0.82, 1.45), F(0.18, 1.45)], '#e8c070');
    fillPoly(ctx, [F(0.22, 2.3), F(0.78, 2.3), F(0.78, 1.5), F(0.22, 1.5)], '#ffe0a0');
    for (let i = 0; i < 3; i++) { const a = F(0.25 + i * 0.2, 2.25), b = F(0.35 + i * 0.2, 1.55); line(ctx, a.x, a.y, b.x, b.y, '#fff4d8'); }
    fillPoly(ctx, [F(0.18, 1.2), F(0.82, 1.2), F(0.82, 0.35), F(0.18, 0.35)], shade(c, -0.25));
    fillPoly(ctx, [F(0.05, 0.2), F(0.95, 0.2), F(0.95, 0.02), F(0.05, 0.02)], '#c8a040');
    const h = F(0.85, 1.3); px(ctx, '#e8c050', h.x - 1, h.y - 1, 3, 2);
    if (p.o.label) {
      const m = F(0.5, 1.9);
      ctx.save(); ctx.translate(m.x, m.y); ctx.transform(1, dy ? -0.5 : 0.5, 0, 1, 0, 0);
      drawText(ctx, p.o.label, 0, -3, { color: '#7a4a10', align: 'center' });
      ctx.restore();
    }
  },
});
registerProp('pub_hatch', { // heavy cellar dray doors (w 2 along x). Interact door with a key (spec key / lockedMsg).
  w: 2, d: 1, h: 3, interact: { kind: 'door', key: null },
  draw(ctx, ax, ay, p) {
    const c = '#5a3a1e';
    if (p.open) {
      isoBox(ctx, ax, ay, 0.0, 0.1, 0, 0.12, 0.85, 2.4, { color: c, outline: OL });
      isoBox(ctx, ax, ay, 1.88, 0.1, 0, 0.12, 0.85, 2.4, { color: c, outline: OL });
      return;
    }
    isoBox(ctx, ax, ay, 0, 0.4, 0, 2, 0.2, 2.5, { color: c, outline: OL });
    const F = (u, z) => proj(ax, ay, u, 0.6, z);
    for (let i = 1; i < 10; i++) { const a = F(i * 0.2, 0.05), b = F(i * 0.2, 2.45); line(ctx, a.x, a.y, b.x, b.y, shade(c, -0.3)); }
    for (const z of [0.4, 1.25, 2.1]) { const a = F(0.05, z), b = F(1.95, z); thick(ctx, a.x, a.y, b.x, b.y, 2, '#2a2a30'); }
    const m0 = F(1, 0.05), m1 = F(1, 2.45); line(ctx, m0.x, m0.y, m1.x, m1.y, OL);
    const lk = F(1, 1.25); px(ctx, OL, lk.x - 2, lk.y - 1, 5, 6); px(ctx, '#c8a040', lk.x - 1, lk.y, 3, 4);
    const s = F(1, 2.0);
    ctx.save(); ctx.translate(s.x, s.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
    drawText(ctx, 'DRAYS', 0, -3, { color: '#e8e0c0', align: 'center', outline: OL });
    ctx.restore();
  },
});
registerProp('pub_boarded', { // boarded-up old doorway in a wall gap (h 2.2). Smash the planks — something's behind them.
  h: 2.2,
  breakable: { hp: 24, debris: ['#8a6a3a', '#6a4a26', '#3a2a1a'], sfx: 'wood', score: 100 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0, 0.15, 0, 1, 0.7, 2.2, { top: '#3a3630', left: '#0c0806', right: '#0c0806' });
    const F = (u, z) => proj(ax, ay, u, 0.9, z);
    const planks = [[0.25, 0.1, 0.08], [0.7, -0.08, 0.1], [1.15, 0.05, -0.05], [1.6, -0.1, 0.06], [1.95, 0.05, 0.02]];
    for (const [z, a, b] of planks) {
      const p0 = F(-0.05, z + a), p1 = F(1.05, z + b);
      fillPoly(ctx, [{ x: p0.x, y: p0.y - 5 }, { x: p1.x, y: p1.y - 5 }, { x: p1.x, y: p1.y + 1 }, { x: p0.x, y: p0.y + 1 }], OL);
      fillPoly(ctx, [{ x: p0.x, y: p0.y - 4 }, { x: p1.x, y: p1.y - 4 }, { x: p1.x, y: p1.y }, { x: p0.x, y: p0.y }], '#8a6a3a');
      line(ctx, p0.x, p0.y - 4, p1.x, p1.y - 4, '#a8885a');
      px(ctx, '#9a9aa2', p0.x + 3, p0.y - 2, 1, 1); px(ctx, '#9a9aa2', p1.x - 3, p1.y - 2, 1, 1);
    }
    const m = F(0.5, 1.4);
    ctx.save(); ctx.translate(m.x, m.y); ctx.transform(1, 0.5, 0, 1, 0, 0);
    drawText(ctx, 'KEEP OUT', 0, -2, { color: '#e83a3a', align: 'center' });
    ctx.restore();
  },
});

// ======================================================================= props: the public bar
registerProp('pub_bell', { // LAST ORDERS bell on the back-bar wall (decal). Ron rings it: prop.ring > 0 swings it.
  h: 0, solid: false, depthBias: 0.03,
  update(p, world, dt) { if (p.ring > 0) p.ring -= dt; },
  draw(ctx, ax, ay, p, t) {
    onFace(ctx, ax, ay, p.o.side || 'left', p.o.z ?? 2.0, g => {
      const sw = p.ring > 0 ? Math.sin(t * 30) * 3 : 0;
      px(g, '#3a2414', -6, -10, 12, 3);
      line(g, 0, -7, Math.round(sw), -3, '#c8a040');
      const bx = Math.round(sw);
      fillPoly(g, [{ x: bx - 3, y: -4 }, { x: bx + 3, y: -4 }, { x: bx + 6, y: 4 }, { x: bx - 6, y: 4 }], OL);
      fillPoly(g, [{ x: bx - 2, y: -3 }, { x: bx + 2, y: -3 }, { x: bx + 5, y: 3 }, { x: bx - 5, y: 3 }], '#d8a838');
      px(g, '#fff0a0', bx - 2, -2, 1, 4);
      px(g, '#3a2a10', bx - 1, 4, 2, 2);
      line(g, bx + 4, 4, bx + 6, 14, '#e8e0c0');
      if (p.ring > 0) { px(g, '#ffe14a', bx - 10, -6, 2, 1); px(g, '#ffe14a', bx + 9, -6, 2, 1); px(g, '#ffe14a', bx - 11, 0, 3, 1); px(g, '#ffe14a', bx + 9, 0, 3, 1); }
    });
  },
});
registerProp('pub_pumps', { // hand pumps + lager font on the counter top (place on the counter wall tile; spec z = counter height)
  h: 0, solid: false, depthBias: 0.05,
  draw(ctx, ax, ay, p) {
    const z = p.o.z ?? 1.0;
    const clips = p.o.clips || ['#c8102e', '#f0c020', '#2a6a3a'];
    for (let i = 0; i < 3; i++) {
      const b = proj(ax, ay, 0.22 + i * 0.27, 0.5, z), tp = proj(ax, ay, 0.22 + i * 0.27, 0.5, z + 1.0);
      ctx.fillStyle = OL; ctx.fillRect(b.x - 2, b.y - 6, 5, 6); ctx.fillStyle = '#c8a040'; ctx.fillRect(b.x - 1, b.y - 5, 3, 4);
      thick(ctx, b.x, b.y - 6, tp.x + 2, tp.y, 3, OL); line(ctx, b.x, b.y - 6, tp.x + 2, tp.y, '#e8e0d0');
      px(ctx, OL, tp.x - 1, tp.y + 2, 6, 6); px(ctx, clips[i], tp.x, tp.y + 3, 4, 4); px(ctx, '#f4f1e8', tp.x + 1, tp.y + 4, 2, 1);
    }
    const f = proj(ax, ay, 0.5, 0.15, z);
    ctx.fillStyle = OL; ctx.fillRect(f.x - 7, f.y - 14, 14, 4); ctx.fillStyle = '#c8c8d0'; ctx.fillRect(f.x - 6, f.y - 13, 12, 2);
    ctx.fillStyle = '#d8d8e0'; ctx.fillRect(f.x - 1, f.y - 12, 2, 12);
  },
});
registerProp('pub_till', { // cash register on the counter (spec z)
  h: 0, solid: false, depthBias: 0.05,
  draw(ctx, ax, ay, p, t) {
    const z = p.o.z ?? 1.0;
    isoBox(ctx, ax, ay, 0.25, 0.2, z, 0.5, 0.55, 0.3, { color: '#2a2a30', outline: OL });
    isoBox(ctx, ax, ay, 0.3, 0.25, z + 0.3, 0.3, 0.45, 0.2, { color: '#3a3a42', outline: OL });
    const d = proj(ax, ay, 0.45, 0.72, z + 0.42); px(ctx, '#0a1a0a', d.x - 4, d.y - 2, 8, 3); px(ctx, Math.floor(t * 2) % 2 ? '#3aff7a' : '#2ac85a', d.x - 3, d.y - 1, 6, 1);
  },
});
registerProp('pub_pendant', { // hanging pendant lamp with an amber glass shade
  h: 0, solid: false, depthBias: 0.4,
  light: { z: 2.4, r: 3.3, color: '#ffc870', intensity: 0.85 },
  draw(ctx, ax, ay, p) {
    const z = p.o.z ?? 2.5;
    const c = proj(ax, ay, 0.5, 0.5, z), top = proj(ax, ay, 0.5, 0.5, 3.6);
    line(ctx, c.x, c.y - 5, top.x, top.y, '#2a2a2a');
    fillPoly(ctx, [{ x: c.x - 2, y: c.y - 6 }, { x: c.x + 2, y: c.y - 6 }, { x: c.x + 6, y: c.y }, { x: c.x - 6, y: c.y }], OL);
    fillPoly(ctx, [{ x: c.x - 1, y: c.y - 5 }, { x: c.x + 1, y: c.y - 5 }, { x: c.x + 5, y: c.y - 1 }, { x: c.x - 5, y: c.y - 1 }], '#c87a20');
    px(ctx, '#fff0c0', c.x - 3, c.y, 6, 1);
    glow(ctx, c.x, c.y + 2, 8, 3, '#ffd27a', 0.25);
  },
});

// ======================================================================= items
function heldLong(len, col, tip, butt) {
  return (ctx, hx, hy, ang, s = 1, flash) => {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const bx = hx - dx * 5 * s, by = hy - dy * 5 * s, ex = hx + dx * len * s, ey = hy + dy * len * s;
    thick(ctx, bx, by, ex, ey, 3, OL);
    thick(ctx, bx, by, ex, ey, 1, flash ? '#fff' : col);
    thick(ctx, bx, by, hx - dx * 1 * s, hy - dy * 1 * s, 2, flash ? '#fff' : butt);
    px(ctx, flash ? '#fff' : tip, ex, ey, 1, 1);
  };
}
registerItem('pub_cue', {
  name: 'POOL CUE', kind: 'weapon', score: 0,
  weapon: { dmg: 10, reach: 1.9, durability: 6, attack: 'thrust', throwDmg: 10, breaks: 'wood' },
  icon(ctx, x, y) {
    line(ctx, x - 8, y - 1, x + 8, y - 13, OL); line(ctx, x - 7, y - 1, x + 8, y - 12, OL);
    line(ctx, x - 7, y - 2, x + 7, y - 12, '#c8a060'); line(ctx, x - 7, y - 2, x - 3, y - 5, '#2a1a10');
    px(ctx, '#3a6ae8', x + 7, y - 13, 1, 1);
  },
  drawHeld: heldLong(17, '#c8a060', '#3a6ae8', '#2a1a10'),
});
registerItem('pub_stool', {
  name: 'BAR STOOL', kind: 'weapon', score: 0,
  weapon: { dmg: 13, reach: 1.4, durability: 3, attack: 'swing', knockdown: true, throwDmg: 16, breaks: 'wood' },
  icon(ctx, x, y) {
    ellipse(ctx, x, y - 11, 6, 3, OL); ellipse(ctx, x, y - 11, 5, 2, '#8a1a22');
    for (const dx of [-4, 0, 4]) { line(ctx, x + dx * 0.6, y - 9, x + dx, y, OL); }
    line(ctx, x - 3, y - 4, x + 3, y - 4, '#6a4020');
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang), pxv = -dy, pyv = dx;
    const ex = hx + dx * 10 * s, ey = hy + dy * 10 * s;
    for (const k of [-3, 0, 3]) { thick(ctx, hx + pxv * k * 0.4, hy + pyv * k * 0.4, ex + pxv * k, ey + pyv * k, 2, OL); line(ctx, hx + pxv * k * 0.4, hy + pyv * k * 0.4, ex + pxv * k, ey + pyv * k, flash ? '#fff' : '#6a4020'); }
    ellipse(ctx, ex, ey, 6, 4, OL); ellipse(ctx, ex, ey, 5, 3, flash ? '#fff' : '#8a1a22');
  },
});
registerItem('pub_glass', {
  name: 'PINT GLASS', kind: 'weapon', score: 0,
  weapon: { dmg: 10, reach: 1.15, durability: 1, attack: 'swing', throwDmg: 11, breaks: 'glass' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 4, y - 12, 8, 12); px(ctx, '#c8dce6', x - 3, y - 11, 6, 10); px(ctx, '#eef6fa', x - 2, y - 11, 1, 9);
    px(ctx, '#8aa8b8', x + 2, y - 11, 1, 10); px(ctx, '#c89a30', x - 3, y - 2, 6, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const cx = hx + dx * 3, cy = hy + dy * 3;
    px(ctx, OL, cx - 3, cy - 4, 7, 9); px(ctx, flash ? '#fff' : '#c8dce6', cx - 2, cy - 3, 5, 7); px(ctx, '#eef6fa', cx - 1, cy - 3, 1, 6);
  },
});
registerItem('pub_dart', {
  name: 'DART', kind: 'weapon', score: 0,
  weapon: { dmg: 3, reach: 1.0, durability: 1, attack: 'swing', throwDmg: 5, breaks: 'metal' },
  icon(ctx, x, y) { line(ctx, x - 5, y - 2, x + 5, y - 8, '#c8c8d0'); px(ctx, '#c8102e', x - 6, y - 3, 3, 2); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    line(ctx, hx - dx * 3, hy - dy * 3, hx + dx * 5, hy + dy * 5, flash ? '#fff' : '#c8c8d0');
    px(ctx, '#ff3a3a', hx - dx * 4 - 1, hy - dy * 4 - 1, 3, 2);
  },
});
registerItem('pub_poolball', {
  name: 'POOL BALL', kind: 'weapon', score: 0,
  weapon: { dmg: 7, reach: 1.0, durability: 2, attack: 'swing', throwDmg: 15, breaks: 'stone' },
  icon(ctx, x, y, t) { ellipse(ctx, x, y - 4, 4, 4, OL); ellipse(ctx, x, y - 4, 3, 3, '#c8102e'); px(ctx, '#ffffff', x - 1, y - 6, 1, 1); },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) { ellipse(ctx, hx, hy, 3, 3, OL); ellipse(ctx, hx, hy, 2, 2, flash ? '#fff' : '#c8102e'); },
});
registerItem('pub_crisps', {
  name: 'PACKET OF CRISPS', kind: 'heal', heal: 12, score: 30, stash: true, auto: true,
  icon(ctx, x, y) {
    px(ctx, OL, x - 5, y - 12, 10, 12);
    px(ctx, '#2a62d8', x - 4, y - 11, 8, 10);
    px(ctx, '#c8102e', x - 4, y - 11, 8, 2);
    ellipse(ctx, x, y - 5, 2, 2, '#ffd23a');
    px(ctx, '#e8eef8', x - 3, y - 9, 1, 5);
    px(ctx, '#9ab0e8', x - 5, y - 12, 10, 1);
  },
});
