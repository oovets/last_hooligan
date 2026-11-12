// THEME: THE DERBY (Level 7) — Nordhamn Athletic's own ground on derby day.
// Floors, walls, props, items and the flare actors used by the level and its enemies.
// Every id registered here starts with 'derby_'.

import { registerFloor, registerWall } from '../../engine/tiles.js';
import { registerProp, PROPS } from '../../game/props.js';
import { registerItem } from '../../game/items.js';
import { isoBox, isoPanel, fillPoly, ellipse, line, thick, proj, shadow, makeCanvas } from '../../engine/gfx.js';
import { shade, mix } from '../../engine/color.js';
import { hash2, makeRng } from '../../engine/rng.js';
import { drawText } from '../../engine/font.js';
import { Z_PX } from '../../engine/constants.js';
import { toScreen } from '../../engine/iso.js';
import { drawDoll } from '../../game/doll.js';
import { sampleAnim, fillPose, animDuration, ANIMS, STAND } from '../../game/poses.js';
import { casualLook } from '../enemies.js';
import { audio } from '../../audio/audio.js';

const OL = '#120c14';
const RED = '#c8102e', WHITE = '#f4f1e8', BLUE = '#1f4fb4', YEL = '#f0c020', BLK = '#141414';
const n2 = (a, b, s = 0) => hash2(Math.floor(a), Math.floor(b), s);

// =====================================================================================================
// FLOORS
// =====================================================================================================

// Concourse: scuffed grey concrete, painted red walkway edge lines, drains, crushed cups.
registerFloor('derby_concourse', {
  pixel(u, v, tx, ty, r) {
    const X = tx + u, Y = ty + v;
    // painted walkway lines along x (two bands)
    const ly = Y % 4.5;
    if (ly > 0.2 && ly < 0.32) return '#9a2a30';
    if (u < 0.03 || v < 0.03) return '#4c4a52';
    const n = n2(X * 32, Y * 32, 41);
    let c = r < 0.35 ? '#66646c' : r < 0.7 ? '#605e66' : '#6a6870';
    if (n < 0.07) c = shade(c, -0.14);
    else if (n > 0.975) c = '#d8d4c8';                              // flecks of litter
    // old spillage stains
    if (n2(X * 3, Y * 3, 42) < 0.06) c = shade(c, -0.1);
    // drain grate
    if (r > 0.94 && Math.abs(u - 0.5) < 0.18 && Math.abs(v - 0.5) < 0.1) return ((u * 20) % 1 < 0.4) ? '#2a2a30' : '#3c3c44';
    return c;
  },
  decal(g, sx, sy, tx, ty, r) {
    if (r < 0.12) { // crushed paper cup
      g.fillStyle = '#e8e4d8'; g.fillRect(sx - 2 + Math.round(r * 40) % 6, sy + 6, 3, 2);
      g.fillStyle = RED; g.fillRect(sx - 2 + Math.round(r * 40) % 6, sy + 6, 3, 1);
    }
  },
});

// Terrace: stepped concrete, the step lips painted, chewing gum, ticket stubs.
registerFloor('derby_terrace', {
  pixel(u, v, tx, ty) {
    const step = (v * 2) % 1;
    const X = tx + u, Y = ty + v;
    if (step < 0.1) return '#34323a';                               // riser shadow
    if (step < 0.2) return Math.floor(X * 2) % 7 === 0 ? '#5a5a62' : '#8c8a92';   // worn lip
    const n = n2(X * 32, Y * 32, 43);
    if (n < 0.04) return '#26242a';                                 // gum
    if (n > 0.985) return Math.floor(X * 9) % 2 ? RED : WHITE;      // ticket stub / scrap
    return n < 0.2 ? '#5a5860' : '#626068';
  },
});

// Away section terrace: dirtier, yellow paint on the lips, more litter.
registerFloor('derby_awayTerrace', {
  pixel(u, v, tx, ty) {
    const step = (v * 2) % 1;
    const X = tx + u, Y = ty + v;
    if (step < 0.1) return '#2c2a2c';
    if (step < 0.2) return Math.floor(X * 3) % 5 === 0 ? '#5a5240' : '#b49a34';
    const n = n2(X * 32, Y * 32, 44);
    if (n < 0.05) return '#242226';
    if (n > 0.975) return Math.floor(X * 7) % 2 ? YEL : '#e8e4d8';
    return n < 0.22 ? '#4e4c50' : '#58565a';
  },
});

// Running track / cinder surround: red ash with grit.
registerFloor('derby_track', {
  pixel(u, v, tx, ty) {
    const n = n2((tx + u) * 32, (ty + v) * 32, 45);
    if (n < 0.08) return '#5a2a22';
    if (n > 0.93) return '#b86a52';
    if (n > 0.8) return '#9a4c3a';
    return '#8a4232';
  },
});

// The pitch: mowing stripes + proper markings computed from absolute coordinates, worn goalmouth.
export const PITCH = { x0: 16.5, x1: 61.5, y0: 39.5, pbx0: 28, pbx1: 50, pby1: 48.5, sbx0: 34, sbx1: 44, sby1: 43, spotX: 39, spotY: 46, arcR: 5.5, ccX: 39, ccY: 67.5, ccR: 8 };
registerFloor('derby_pitch', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v, P = PITCH, lw = 0.065;
    const line = '#eef2e6';
    const inX = X >= P.x0 - lw && X <= P.x1 + lw;
    if (Y >= P.y0 - lw) {
      if (Math.abs(Y - P.y0) < lw && inX) return line;                              // goal line
      if ((Math.abs(X - P.x0) < lw || Math.abs(X - P.x1) < lw) && Y >= P.y0) return line;   // touchlines
      // penalty area
      if (Y <= P.pby1 + lw && (Math.abs(X - P.pbx0) < lw || Math.abs(X - P.pbx1) < lw)) return line;
      if (Math.abs(Y - P.pby1) < lw && X >= P.pbx0 && X <= P.pbx1) return line;
      // six-yard box
      if (Y <= P.sby1 + lw && (Math.abs(X - P.sbx0) < lw || Math.abs(X - P.sbx1) < lw)) return line;
      if (Math.abs(Y - P.sby1) < lw && X >= P.sbx0 && X <= P.sbx1) return line;
      // penalty spot + D
      const ds = Math.hypot(X - P.spotX, Y - P.spotY);
      if (ds < 0.16) return line;
      if (Y > P.pby1 && Math.abs(ds - P.arcR) < lw * 1.2) return line;
      // corner arcs
      for (const cx of [P.x0, P.x1]) { const dc = Math.hypot(X - cx, Y - P.y0); if (Math.abs(dc - 1) < lw && Y > P.y0) return line; }
      // centre circle peeking in at the bottom
      if (Math.abs(Math.hypot(X - P.ccX, Y - P.ccY) - P.ccR) < lw * 1.2) return line;
    }
    // stripes (mown along x) and checker
    const band = Math.floor((Y - 0.5) / 2.5) % 2 === 0;
    const chk = Math.floor(X / 5) % 2 === 0;
    let base = band ? (chk ? '#2e6c2a' : '#2b6627') : (chk ? '#3a7d34' : '#377831');
    // worn goalmouth (mud)
    const dg = Math.hypot((X - P.spotX) * 0.8, (Y - (P.y0 + 2)) * 1.3);
    const n = n2(X * 32, Y * 32, 46);
    if (dg < 3.2 && n < 0.75 - dg * 0.18) base = n < 0.25 ? '#5a4630' : '#6a5438';
    if (n < 0.06) base = shade(base, -0.12);
    else if (n > 0.96) base = shade(base, 0.1);
    return base;
  },
});

// Players' tunnel: ribbed blue rubber matting with a red runner.
registerFloor('derby_tunnel', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if (u < 0.03 || v < 0.03) return '#1a1c26';
    const rib = (Math.floor(X * 8) + Math.floor(Y * 8)) % 2 === 0;
    let c = rib ? '#2e3446' : '#343a4e';
    // red runner down the middle of the horizontal part
    if (Y > 28.1 && Y < 29.9 && X < 50) c = rib ? '#7a1420' : '#861826';
    if (X > 50.6 && X < 52.4 && Y > 29.9) c = rib ? '#7a1420' : '#861826';
    if (n2(X * 32, Y * 32, 47) < 0.04) c = shade(c, -0.25);
    return c;
  },
});

// Dressing room: worn lino in club red with white lines, bench shadow.
registerFloor('derby_dressing', {
  pixel(u, v, tx, ty) {
    const X = tx + u, Y = ty + v;
    if ((X % 3) < 0.06 || (Y % 3) < 0.06) return '#d8d0c0';
    const n = n2(X * 32, Y * 32, 48);
    const c = (Math.floor(X / 3) + Math.floor(Y / 3)) % 2 ? '#7a2028' : '#6c1a22';
    if (n < 0.06) return shade(c, -0.2);
    if (n > 0.985) return '#e8e0c8';   // tape scraps
    return c;
  },
});

// =====================================================================================================
// WALLS
// =====================================================================================================
function brickPx(base, mortar, u, py, side, variant) {
  const bx = u * 16, row = Math.floor(py / 4);
  const off = row % 2 ? 4 : 0;
  if (py % 4 === 3) return mortar;
  if (Math.floor(bx + off) % 8 === 0) return mortar;
  const s = hash2(Math.floor((bx + off) / 8) + variant * 7, row, 3);
  let c = s < 0.3 ? shade(base, -0.08) : s > 0.85 ? shade(base, 0.1) : base;
  if (side === 'right') c = shade(c, -0.3);
  return c;
}

// Stadium facade: red brick, white stone band, dark red cornice, iron rivets.
registerWall('derby_facade', {
  top: (u, v) => ((u * 4) % 1 < 0.12 ? '#3a1418' : '#5a2228'),
  variants: 6,
  face(u, py, side, H, r, variant) {
    const dk = side === 'right' ? -0.3 : 0;
    if (py < 3) return shade('#4a1a1e', dk);                  // cornice
    if (py < 5) return shade('#2a0e10', dk);
    if (py >= 9 && py < 14) {                                 // white band with red pinstripe
      if (py === 11) return shade(RED, dk);
      return shade('#e8e2d4', dk - (hash2(Math.floor(u * 16), py, variant) < 0.1 ? 0.08 : 0));
    }
    if (py >= H - 3) return shade('#3a2a2a', dk);             // plinth
    const wu = Math.floor(u * 16);
    // arched window slot on some variants
    if (variant % 3 === 0 && py > 18 && py < H - 8 && wu >= 6 && wu <= 9) return shade(py < 20 ? '#2a2420' : '#141820', dk);
    return brickPx('#8a3430', '#3a1c1c', u, py, side, variant);
  },
});

// Stand back / side walls: dark painted concrete with red-white-red bands and a ribbed lower half.
registerWall('derby_standWall', {
  top: (u, v, variant) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 ? '#2e2c36' : '#36343e'),
  variants: 4,
  face(u, py, side, H, r, variant) {
    const dk = side === 'right' ? -0.3 : 0;
    if (py < 2) return shade('#8a8a92', dk);                 // capping
    if (py < 5) return shade(RED, dk);
    if (py < 7) return shade(WHITE, dk);
    if (py < 10) return shade(RED, dk);
    const wu = Math.floor(u * 16);
    let c = (wu % 4 === 0) ? '#2a2834' : '#3a3846';
    if (py > H * 0.55 && wu % 2 === 0) c = '#34323e';
    if (hash2(wu + variant * 5, py, 61) < 0.03) c = '#4a4856';   // scuffs
    if (py === H - 1) c = '#1a1820';
    return shade(c, dk);
  },
});

// Tunnel walls: white glazed tiles, red band at shoulder height, black skirting.
registerWall('derby_tunnelWall', {
  top: '#8a8a90',
  face(u, py, side, H) {
    const dk = side === 'right' ? -0.25 : 0;
    if (py >= H - 3) return shade('#1a1a20', dk);
    const band = H - 22;
    if (py >= band && py < band + 4) return shade(RED, dk);
    if (py === band + 4) return shade(WHITE, dk - 0.1);
    const tx = (u * 16) % 4, ty = py % 5;
    let c = (tx < 0.6 || ty === 0) ? '#a8aab0' : '#e2e2dc';
    if (py < 2) c = '#c8c8cc';
    return shade(c, dk);
  },
});

// Perimeter wall (terrace front / track back): low, club red with a white top and gaps of advertising.
registerWall('derby_perimeter', {
  top: '#e8e4d8',
  variants: 6,
  face(u, py, side, H, r, variant) {
    const dk = side === 'right' ? -0.25 : 0;
    if (py < 2) return shade(WHITE, dk);
    if (py >= H - 2) return shade('#3a1418', dk);
    const wu = u * 16;
    if (variant % 3 === 1) {                                  // advert panel (abstract lettering)
      const letter = py > 4 && py < H - 4 && Math.floor(wu) % 4 !== 0 && hash2(Math.floor(wu / 2), py, variant + 3) < 0.55;
      return shade(letter ? '#ffd23a' : '#1a2a5a', dk);
    }
    if (variant % 3 === 2) {                                  // anchors pattern: chevrons
      const k = (Math.floor(wu) + py) % 8;
      return shade(k < 2 ? WHITE : RED, dk);
    }
    return shade(hash2(Math.floor(wu), py, 63) < 0.05 ? '#a00c24' : RED, dk);
  },
});

// Away stand back wall: rows of yellow & black plastic seats rising up.
registerWall('derby_awayStand', {
  top: '#2a2620',
  variants: 4,
  face(u, py, side, H, r, variant) {
    const dk = side === 'right' ? -0.3 : 0;
    if (py < 2) return shade('#6a6a70', dk);
    const row = Math.floor((py - 2) / 7), fy = (py - 2) % 7;
    const wu = u * 16, seat = Math.floor(wu / 4), fx = wu % 4;
    if (fy === 6) return shade('#2a2a2e', dk);               // step
    if (fy >= 4) return shade('#5a5a60', dk);                 // concrete riser
    if (fx < 0.6) return shade('#3a3a3e', dk);               // gap
    const black = (seat + row + variant) % 5 === 0;
    const broken = hash2(seat + variant * 9, row, 64) < 0.07;
    if (broken) return shade('#3a3a3e', dk);
    const c = black ? BLK : (fy === 0 ? '#ffe070' : YEL);
    return shade(c, dk);
  },
});

// Away pen fence: see-through steel mesh with a yellow top rail and posts.
registerWall('derby_awayFence', {
  top: '#2a2a30',
  face(u, py, side, H) {
    const wu = u * 16;
    const dk = side === 'right' ? -0.25 : 0;
    if (py < 2) return shade('#c8a020', dk);
    if (Math.floor(wu) === 0 || Math.floor(wu) === 8) return shade('#3a3a44', dk);
    if (py >= H - 2) return shade('#3a3a44', dk);
    if ((Math.floor(wu) + py) % 4 === 0 || (Math.floor(wu) - py + 400) % 4 === 0) return shade('#6a6e78', dk);
    return null;
  },
});

// =====================================================================================================
// FLARES: shared timing + actors (thrown flares, burning zones)
// =====================================================================================================
// static terrace flares burn for 3.6s then sputter for 2s
export function flareBurning(time, phase = 0) { return ((time + phase) % 5.6) < 3.6; }

function drawFlareStick(ctx, x, y, t, burning, color = '#ff3020') {
  // canister
  ctx.fillStyle = OL; ctx.fillRect(x - 2, y - 7, 5, 8);
  ctx.fillStyle = color === '#ff3020' ? '#d82020' : '#e0c020'; ctx.fillRect(x - 1, y - 6, 3, 6);
  ctx.fillStyle = '#f4f1e8'; ctx.fillRect(x - 1, y - 4, 3, 1);
  if (!burning) {
    if (Math.floor(t * 8) % 3 === 0) { ctx.fillStyle = '#ff8a40'; ctx.fillRect(x, y - 9, 1, 2); }
    return;
  }
  // flame: flickering pixels
  for (let i = 0; i < 9; i++) {
    const fx = x - 3 + ((i * 7 + Math.floor(t * 30)) % 7), fh = 3 + ((i * 13 + Math.floor(t * 25)) % 8);
    ctx.fillStyle = i % 3 === 0 ? '#fff4c0' : i % 3 === 1 ? '#ffb030' : color;
    ctx.fillRect(fx, y - 7 - fh, 1 + (i % 2), fh);
  }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 9, 3, 2);
}

function smokePuff(world, x, y, z, color, n = 1) {
  for (let i = 0; i < n; i++) {
    world.fx.add({ x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, z, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4 - 0.15, vz: 0.9 + Math.random() * 0.6, g: 0, life: 1.4 + Math.random() * 0.8, kind: 'puff', color, size: 3 + Math.random() * 3 });
  }
}

function nearPlayer(world, x, y, r = 14) { const p = world.player; return p && Math.hypot(p.x - x, p.y - y) < r; }

// Burning patch left by a thrown flare: damages fighters of the opposing team (or everyone with team:null).
export function spawnFlareZone(world, x, y, o = {}) {
  const dur = o.dur ?? 4.2, r = o.r ?? 0.95, dmg = o.dmg ?? 5, color = o.color || '#ff3020', team = o.team ?? null;
  const light = { x, y, z: 0.6, r: 3.0, color, intensity: 0.9, flicker: true };
  world.lights.push(light);
  return world.addActor({
    kind: 'derbyFlareZone', x, y, z: 0, t: 0, tick: 0.25, removed: false,
    update(w, dt) {
      this.t += dt; this.tick -= dt;
      if (Math.random() < dt * 9 && nearPlayer(w, x, y)) smokePuff(w, x, y, 0.4, Math.random() < 0.5 ? '#b04040' : '#8a7a80');
      if (this.tick <= 0) {
        this.tick = 0.5;
        for (const f of w.fighters) {
          if (!f.alive || f.invuln > 0 || f.z > 0.5 || f.isDown) continue;
          if (team && f.team === team) continue;
          if (Math.hypot(f.x - x, f.y - y) > r + f.r) continue;
          const d = Math.hypot(f.x - x, f.y - y) || 1;
          const def = { hz: 0.5, sfx: 'punch' };
          const res = f.takeHit({ attacker: null, def, dmg, dir: { x: (f.x - x) / d, y: (f.y - y) / d }, kb: 3, stun: 0.35, knockdown: false, launch: 0, unblockable: true, guardDmg: 0 }, w);
          w.onHit({ x, y }, f, def, res, dmg);
          w.fx.spark(f.x, f.y, 0.5, '#ff7a30', 6);
        }
      }
      if (this.t > dur) {
        this.removed = true;
        const i = w.lights.indexOf(light); if (i >= 0) w.lights.splice(i, 1);
      }
    },
    depth() { return x + y - 0.3; },
    draw(ctx, w) {
      const s = toScreen(x, y, 0);
      const fade = Math.min(1, (dur - this.t) / 0.8);
      ctx.globalAlpha = 0.35 * fade;
      ellipse(ctx, s.x, s.y, 15, 7, color);
      ctx.globalAlpha = 0.25 * fade;
      ellipse(ctx, s.x, s.y, 9, 4, '#ffd080');
      ctx.globalAlpha = 1;
      drawFlareStick(ctx, s.x, s.y, w.time + x, this.t < dur - 0.5, color);
    },
  });
}

// A flare lobbed in an arc by `f` at (tx,ty); lands and becomes a burning zone.
export function spawnFlareShot(world, f, tx, ty, o = {}) {
  const sx = f.x + f.fx * 0.4, sy = f.y + f.fy * 0.4, sz = f.z + 1.6;
  const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
  const G = 16, T = Math.max(0.45, Math.min(1.1, d / 7));
  const shot = {
    kind: 'derbyFlareShot', x: sx, y: sy, z: sz, vx: dx / T, vy: dy / T, vz: (0.5 * G * T * T - sz) / T, t: 0, removed: false,
    update(w, dt) {
      this.t += dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vz -= G * dt; this.z += this.vz * dt;
      if (Math.random() < dt * 30) w.fx.add({ x: this.x, y: this.y, z: this.z, vx: 0, vy: 0, vz: 0.2, g: 0, life: 0.5, kind: 'puff', color: '#a05050', size: 2 });
      const tile = w.heightAt(this.x, this.y);
      if (this.z <= 0 || (tile > this.z && tile < 99) || this.t > 2.5) {
        this.removed = true;
        w.sfx('glass', this);
        spawnFlareZone(w, this.x, this.y, { team: f.team === 'enemy' ? 'enemy' : null, ...o });
      }
    },
    depth() { return this.x + this.y; },
    draw(ctx, w) {
      const g = toScreen(this.x, this.y, 0);
      shadow(ctx, g.x, g.y, 4, 2, 0.3);
      const s = toScreen(this.x, this.y, this.z);
      const a = this.t * 14;
      const ex = Math.cos(a) * 4, ey = Math.sin(a) * 2;
      thick(ctx, s.x - ex, s.y - ey, s.x + ex, s.y + ey, 3, OL);
      thick(ctx, s.x - ex, s.y - ey, s.x + ex, s.y + ey, 1, '#d82020');
      ctx.fillStyle = '#ffe080'; ctx.fillRect(Math.round(s.x + ex) - 1, Math.round(s.y + ey) - 1, 3, 3);
      w.lightsDynamic = w.lightsDynamic || [];
      w.lightsDynamic.push({ x: this.x, y: this.y, z: this.z, r: 2, color: '#ff4020', intensity: 0.7 });
    },
  };
  return world.addActor(shot);
}

// =====================================================================================================
// HOME FANS (cached doll sprites) — they cheer for you and boo the enemy
// =====================================================================================================
const FAN_LOOKS = [];
function fanLook(i) {
  if (FAN_LOOKS[i]) return FAN_LOOKS[i];
  const rng = makeRng(7000 + i * 131);
  const L = casualLook(rng, { a: RED, b: WHITE, hatChance: 0.25 });
  if (i % 3 === 0) L.jacket = { style: 'tee', color: RED };
  else if (i % 3 === 1) L.jacket = { style: 'track', color: rng.pick([RED, '#2a2a30', WHITE]), trim: rng.pick([WHITE, RED]) };
  L.shirt = rng.pick([RED, WHITE, RED]);
  L.scarf = rng.chance(0.75) ? { a: RED, b: WHITE } : null;
  if (L.hat && L.hat.style === 'beanie') L.hat = { style: 'beanie', color: RED, trim: WHITE };
  L.build = rng.range(0.9, 1.25); L.height = rng.range(0.92, 1.02);
  return (FAN_LOOKS[i] = L);
}
const FAN_POSES = {
  stand: () => ({ ...STAND }),
  cheer0: () => sampleAnim('cheer', 0.0), cheer1: () => sampleAnim('cheer', 0.2),
  boo0: () => ({ ...STAND, lean: 0.15, uaN: 1.5, faN: 0.15, uaF: 0.1, faF: 0.4, head: 0.1 }),
  boo1: () => ({ ...STAND, lean: 0.22, uaN: 1.7, faN: 0.05, uaF: 0.2, faF: 0.5, head: 0.15, dy: 1 }),
  clap0: () => ({ ...STAND, uaN: 1.0, faN: 1.3, uaF: 1.0, faF: 1.4 }),
  clap1: () => ({ ...STAND, uaN: 1.1, faN: 0.9, uaF: 1.1, faF: 1.0, dy: 1 }),
  wave0: () => (ANIMS.scarfWave ? sampleAnim('scarfWave', 0) : { ...STAND, uaN: 2.6, faN: 0.6 }),
  wave1: () => (ANIMS.scarfWave ? sampleAnim('scarfWave', animDuration('scarfWave') / 2) : { ...STAND, uaN: 2.9, faN: 0.2 }),
  chant0: () => (ANIMS.chant ? sampleAnim('chant', 0) : { ...STAND, uaN: 2.2, faN: 1.2 }),
  chant1: () => (ANIMS.chant ? sampleAnim('chant', animDuration('chant') / 2) : { ...STAND, uaN: 2.7, faN: 0.6 }),
  flare0: () => ({ ...STAND, uaN: 2.9, faN: 0.2, uaF: 0.3, faF: 0.6, lean: -0.05 }),
  flare1: () => ({ ...STAND, uaN: 2.7, faN: 0.4, uaF: 1.2, faF: 1.3, lean: -0.05, dy: -1 }),
};
const fanCache = new Map();
function fanSprite(li, pose, flip) {
  const key = li + '|' + pose + '|' + (flip ? 1 : 0);
  let c = fanCache.get(key);
  if (c) return c;
  c = makeCanvas(44, 70);
  const g = c.getContext('2d');
  const face = pose.startsWith('boo') ? 'shout' : pose.startsWith('cheer') ? 'shout' : 'normal';
  drawDoll(g, 22, 66, fanLook(li), fillPose(FAN_POSES[pose]()), { flip, face, time: li });
  fanCache.set(key, c);
  return c;
}

// mood shared by all fans: 'boo' (enemies around), 'cheer' (you just floored someone), 'idle'
function crowdState(world) {
  let S = world.__derbyCrowd;
  if (!S) S = world.__derbyCrowd = { t: -1, mood: 'idle', cheerT: 0, kos: 0, bubbleCd: 1, bubbles: [] };
  if (S.t !== world.time) {
    const dt = S.t < 0 ? 0 : Math.max(0, Math.min(0.1, world.time - S.t));
    S.t = world.time;
    S.cheerT -= dt; S.bubbleCd -= dt;
    if (world.stats && world.stats.kos !== S.kos) { if (world.stats.kos > S.kos) S.cheerT = 1.8; S.kos = world.stats.kos; }
    const p = world.player;
    let foes = 0;
    if (p) for (const f of world.fighters) if (f.team === 'enemy' && f.alive && Math.hypot(f.x - p.x, f.y - p.y) < 9) foes++;
    S.mood = S.cheerT > 0 ? 'cheer' : foes > 0 ? 'boo' : (world.combo && world.combo.count >= 3) ? 'cheer' : 'idle';
    for (const b of S.bubbles) b.t += dt;
    S.bubbles = S.bubbles.filter(b => b.t < 1.3);
  }
  return S;
}
const BOO = ['BOO!', 'OFF!', 'GET OUT!', 'SCUM!', 'WHO ARE YA?', 'BOOOO!', 'OUT!'];
const CHEER = ['GET IN!', 'YES!!', 'ANCHORS!', 'GO ON SON!', 'LOVELY!', 'HAVE IT!', '★ ★ ★'];
const IDLE = ['ANCHORS!', 'COME ON!', 'NORDHAMN!', 'RED ARMY!', 'OI OI!'];

function fanUpdate(p, world, dt) {
  const S = crowdState(world);
  const pl = world.player;
  if (!pl || S.bubbleCd > 0) return;
  const d = Math.hypot(pl.x - p.cx, pl.y - p.cy);
  if (d > 11 || Math.random() > dt * 3) return;
  S.bubbleCd = S.mood === 'idle' ? 1.6 : 0.55;
  const list = S.mood === 'boo' ? BOO : S.mood === 'cheer' ? CHEER : IDLE;
  S.bubbles.push({ x: p.cx, y: p.cy, text: list[Math.floor(Math.random() * list.length)], t: 0, col: S.mood === 'boo' ? '#ffb0a0' : '#ffffff' });
}

function fanDraw(ctx, ax, ay, p, t, world, flareHolder) {
  const S = world ? crowdState(world) : { mood: 'idle' };
  const flip = !!p.o.flip;
  const seeds = [[0.3, 0.32], [0.72, 0.74]];
  for (let k = 0; k < 2; k++) {
    if (k === 0 && p.o.single) continue;
    const [lx, ly] = seeds[k];
    const hv = hash2(p.x * 3 + k, p.y * 5 + k, 77);
    const li = Math.floor(hv * 12);
    const s = proj(ax, ay, lx + (hv - 0.5) * 0.12, ly, 0);
    const ph = (t * (S.mood === 'idle' ? 1.6 : 4.2) + hv * 7) % 2;
    const fr = ph < 1 ? 0 : 1;
    let pose;
    if (flareHolder && k === 1) pose = 'flare' + fr;
    else if (S.mood === 'cheer') pose = 'cheer' + fr;
    else if (S.mood === 'boo') pose = hv < 0.6 ? 'boo' + fr : 'clap' + fr;
    else pose = hv < 0.25 ? 'clap' + fr : hv < 0.45 ? 'wave' + fr : hv < 0.6 ? 'chant' + fr : 'stand';
    const spr = fanSprite(li, pose, flip);
    const bob = S.mood === 'cheer' && fr ? -2 : 0;
    shadow(ctx, s.x, s.y, 7, 3, 0.3);
    ctx.drawImage(spr, Math.round(s.x - 22), Math.round(s.y - 66 + bob));
    if (flareHolder && k === 1) {
      // flare held aloft
      const hx = s.x + (flip ? -6 : 6), hy = s.y - 62 + bob;
      drawFlareStick(ctx, hx, hy + 8, t, true);
    }
  }
  // speech bubbles owned by this prop
  if (world && S.bubbles) for (const b of S.bubbles) {
    if (b.x !== p.cx || b.y !== p.cy) continue;
    const s = toScreen(b.x, b.y, 2.9 + b.t * 0.6);
    ctx.globalAlpha = b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.4) : 1;
    drawText(ctx, b.text, s.x, s.y, { color: b.col, align: 'center', outline: '#000' });
    ctx.globalAlpha = 1;
  }
}

registerProp('derby_fans', {
  h: 1.7,
  update: fanUpdate,
  draw(ctx, ax, ay, p, t, world) { fanDraw(ctx, ax, ay, p, t, world, false); },
});
registerProp('derby_fansFlare', {
  h: 1.7,
  light: { z: 2.6, r: 3.6, color: '#ff3020', intensity: 0.85, flicker: true },
  update(p, world, dt) {
    fanUpdate(p, world, dt);
    if (Math.random() < dt * 6 && nearPlayer(world, p.cx, p.cy)) smokePuff(world, p.cx + 0.2, p.cy + 0.2, 2.8, Math.random() < 0.6 ? '#c04848' : '#9a8088');
  },
  draw(ctx, ax, ay, p, t, world) { fanDraw(ctx, ax, ay, p, t, world, true); },
});

// =====================================================================================================
// PROPS
// =====================================================================================================

// Flag on a tall pole, waving (o.a/o.b colours, o.text optional)
registerProp('derby_flagpole', {
  h: 2.5,
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 4.2);
    ctx.fillStyle = OL; ctx.fillRect(b.x - 4, b.y - 5, 8, 6);
    ctx.fillStyle = '#4a4a52'; ctx.fillRect(b.x - 3, b.y - 4, 6, 4);
    thick(ctx, b.x, b.y, top.x, top.y, 3, OL);
    thick(ctx, b.x, b.y, top.x, top.y, 1, '#c8c8d0');
    ctx.fillStyle = '#e8c040'; ctx.fillRect(top.x - 1, top.y - 2, 3, 2);
    const a = p.o.a || RED, bcol = p.o.b || WHITE;
    const fw = 22, fh = 13;
    for (let i = 0; i < fw; i++) {
      const sw = Math.sin(t * 5 + i * 0.45 + p.x);
      const wave = Math.round(sw * (i / fw) * 3);
      const k = Math.round(sw * 3) / 20;              // quantised shading -> few distinct colours
      const x = top.x + 1 + i, y0 = top.y + 1 + wave;
      if (p.o.cross && Math.abs(i - 7) < 2) { ctx.fillStyle = shade(p.o.cross, k); ctx.fillRect(x, y0, 1, fh); continue; }
      ctx.fillStyle = shade(a, k); ctx.fillRect(x, y0, 1, fh);
      ctx.fillStyle = shade(bcol, k); ctx.fillRect(x, y0 + 4, 1, 5);
      if (p.o.cross) { ctx.fillStyle = shade(p.o.cross, k); ctx.fillRect(x, y0 + 5, 1, 3); }
    }
    // dark edge
    for (let i = 0; i < fw; i++) { const wave = Math.round(Math.sin(t * 5 + i * 0.45 + p.x) * (i / fw) * 3); ctx.fillStyle = OL; ctx.fillRect(top.x + 1 + i, top.y + wave, 1, 1); ctx.fillRect(top.x + 1 + i, top.y + fh + 1 + wave, 1, 1); }
  },
});

// Scarf & badge seller's stall (2x1). o.a/o.b = scarf colours.
registerProp('derby_stall', {
  w: 2, d: 1, h: 1.2,
  breakable: { hp: 30, debris: [RED, WHITE, '#7a5a38'], sfx: 'wood', drops: [['coin', 0.8], ['cash5', 0.5], ['coin', 0.6]], score: 80 },
  draw(ctx, ax, ay, p, t) {
    const a = p.o.a || RED, b = p.o.b || WHITE;
    // poles
    for (const [x, y] of [[0.1, 0.15], [1.9, 0.15], [0.1, 0.85], [1.9, 0.85]]) { const s = proj(ax, ay, x, y, 0), e = proj(ax, ay, x, y, 2.2); thick(ctx, s.x, s.y, e.x, e.y, 2, '#3a3a40'); }
    // counter
    isoBox(ctx, ax, ay, 0.05, 0.3, 0, 1.9, 0.6, 0.9, { top: '#8a6a44', left: '#6a4a2c', right: '#4e3820', outline: OL });
    // scarves hanging on the front (+y face) of the counter
    for (let i = 0; i < 7; i++) {
      const u = 0.15 + i * 0.25;
      const s0 = proj(ax, ay, u, 0.91, 0.85);
      const sw = Math.sin(t * 2 + i) * 0.5;
      for (let j = 0; j < 12; j++) { ctx.fillStyle = Math.floor(j / 2) % 2 ? b : a; ctx.fillRect(Math.round(s0.x + sw * j / 12), Math.round(s0.y + j), 3, 1); }
      ctx.fillStyle = b; ctx.fillRect(Math.round(s0.x + sw), Math.round(s0.y + 12), 1, 2); ctx.fillRect(Math.round(s0.x + 2 + sw), Math.round(s0.y + 12), 1, 2);
    }
    // folded scarves on the top
    for (let i = 0; i < 4; i++) isoBox(ctx, ax, ay, 0.2 + i * 0.42, 0.45, 0.9, 0.3, 0.3, 0.08 + (i % 2) * 0.06, { color: i % 2 ? b : a });
    // canopy (striped)
    const c = [proj(ax, ay, 0, 0, 2.2), proj(ax, ay, 2, 0, 2.2), proj(ax, ay, 2, 1.15, 1.95), proj(ax, ay, 0, 1.15, 1.95)];
    fillPoly(ctx, c, OL);
    for (let i = 0; i < 8; i++) {
      const u0 = i / 8, u1 = (i + 1) / 8;
      fillPoly(ctx, [proj(ax, ay, u0 * 2, 0.04, 2.2), proj(ax, ay, u1 * 2, 0.04, 2.2), proj(ax, ay, u1 * 2, 1.1, 1.96), proj(ax, ay, u0 * 2, 1.1, 1.96)], i % 2 ? b : a);
    }
    // valance
    for (let i = 0; i < 8; i++) {
      const s = proj(ax, ay, i * 0.25 + 0.02, 1.15, 1.95);
      ctx.fillStyle = OL; ctx.fillRect(s.x, s.y, 5, 4);
      ctx.fillStyle = i % 2 ? b : a; ctx.fillRect(s.x + 1, s.y, 3, 3);
    }
    if (p.o.text) { const m = proj(ax, ay, 1, 1.15, 2.3); drawText(ctx, p.o.text, m.x, m.y - 10, { color: '#ffe14a', align: 'center', outline: OL }); }
  },
});

// Burger van (3x1), hatch on the +y side, warm light.
registerProp('derby_burgerVan', {
  w: 3, d: 1, h: 1.6,
  light: { z: 1.4, r: 3.4, color: '#ffc070', intensity: 0.8 },
  draw(ctx, ax, ay, p, t) {
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.12); ellipse(ctx, s.x, s.y, 4, 3, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 1, '#5a5a60'); };
    wh(0.5, 0.95); wh(2.4, 0.95);
    const B = isoBox(ctx, ax, ay, 0.05, 0.08, 0.15, 2.9, 0.84, 1.55, { top: '#e8e4d8', left: '#d8d2c4', right: '#a8a296', outline: OL });
    // red stripe
    isoPanel(ctx, ax, ay, 'left', 0.05, 0.92, 2.9, 0.4, 0.55, RED);
    isoPanel(ctx, ax, ay, 'right', 2.95, 0.08, 0.84, 0.4, 0.55, shade(RED, -0.3));
    // hatch (lit)
    isoPanel(ctx, ax, ay, 'left', 0.7, 0.92, 1.5, 0.75, 1.45, OL);
    isoPanel(ctx, ax, ay, 'left', 0.75, 0.92, 1.4, 0.8, 1.4, '#ffd88a');
    isoPanel(ctx, ax, ay, 'left', 0.75, 0.92, 1.4, 0.8, 0.95, '#c08a3a');
    // awning
    fillPoly(ctx, [proj(ax, ay, 0.6, 0.92, 1.6), proj(ax, ay, 2.3, 0.92, 1.6), proj(ax, ay, 2.3, 1.3, 1.35), proj(ax, ay, 0.6, 1.3, 1.35)], OL);
    for (let i = 0; i < 6; i++) fillPoly(ctx, [proj(ax, ay, 0.62 + i * 0.28, 0.93, 1.58), proj(ax, ay, 0.62 + (i + 1) * 0.28, 0.93, 1.58), proj(ax, ay, 0.62 + (i + 1) * 0.28, 1.27, 1.37), proj(ax, ay, 0.62 + i * 0.28, 1.27, 1.37)], i % 2 ? WHITE : RED);
    // cab window
    isoPanel(ctx, ax, ay, 'right', 2.95, 0.2, 0.6, 0.9, 1.4, '#7a9ab0');
    // roof sign
    const m = proj(ax, ay, 1.5, 0.5, 1.7);
    ctx.fillStyle = OL; ctx.fillRect(m.x - 22, m.y - 11, 44, 10);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(m.x - 21, m.y - 10, 42, 8);
    drawText(ctx, 'BURGERS', m.x, m.y - 9, { color: '#7a1010', align: 'center' });
  },
});
function vanSteam(ctx, ax, ay, p, t) {
  for (let i = 0; i < 3; i++) { const k = (t * 0.7 + i / 3) % 1; const s = proj(ax, ay, 1.3 + i * 0.2, 1.2, 1.7 + k * 0.8); ctx.globalAlpha = 0.4 * (1 - k); ctx.fillStyle = '#e0e0e0'; ctx.fillRect(Math.round(s.x + Math.sin(t * 3 + i) * 2), Math.round(s.y), 2, 2); }
  ctx.globalAlpha = 1;
}

// Turnstile set into the facade: passable tile with a lintel, booth sides and a rotating 3-arm barrier.
registerProp('derby_turnstile', {
  h: 0, solid: false,
  draw(ctx, ax, ay, p) {
    // booth side posts
    isoBox(ctx, ax, ay, 0, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a5a62', outline: OL });
    isoBox(ctx, ax, ay, 0.88, 0.1, 0, 0.12, 0.8, 1.9, { color: '#5a5a62', outline: OL });
    // lintel with IN sign
    isoBox(ctx, ax, ay, 0, 0, 1.9, 1, 1, 0.3, { top: '#5a2228', left: '#8a3430', right: '#5e2420', outline: OL });
    const m = proj(ax, ay, 0.5, 1.0, 2.05);
    drawText(ctx, 'IN', m.x - 4, m.y - 3, { color: '#ffffff' });
  },
});
function turnstileArms(ctx, ax, ay, p, t, world) {
    let spin = 0;
    if (world) for (const f of world.fighters) if (Math.abs(f.x - p.cx) < 0.8 && Math.abs(f.y - p.cy) < 0.8) spin = 1;
    p.ang = (p.ang || 0) + spin * 0.12;
    // hub
    const hub = proj(ax, ay, 0.3, 0.5, 0.9);
    ctx.fillStyle = OL; ctx.fillRect(hub.x - 3, hub.y - 3, 6, 10);
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(hub.x - 2, hub.y - 2, 4, 8);
    for (let i = 0; i < 3; i++) {
      const a = p.ang + i * 2.094;
      const e = proj(ax, ay, 0.3 + Math.cos(a) * 0.45, 0.5 + Math.sin(a) * 0.45, 0.9 + Math.sin(a * 0.5) * 0.05);
      thick(ctx, hub.x, hub.y, e.x, e.y, 3, OL); thick(ctx, hub.x, hub.y, e.x, e.y, 1, '#d8dce0');
    }
    const m = proj(ax, ay, 0.5, 1.0, 2.05);
    ctx.fillStyle = Math.floor(t * 2) % 2 ? '#3aff7a' : '#1a8a3a'; ctx.fillRect(m.x + 6, m.y - 2, 2, 2);
}

// Food kiosk (2x1) against a wall: counter, menu board, lit hatch. Low enough to jump on (h 1.1).
registerProp('derby_kiosk', {
  w: 2, d: 1, h: 1.1,
  light: { z: 1.6, r: 3.0, color: '#ffd08a', intensity: 0.75 },
  draw(ctx, ax, ay, p, t) {
    // back wall panel & menu board
    isoPanel(ctx, ax, ay, 'left', 0.0, 0.05, 2, 1.1, 2.15, OL);
    isoPanel(ctx, ax, ay, 'left', 0.05, 0.05, 1.9, 1.15, 2.1, '#2a1a14');
    const mb = proj(ax, ay, 1, 0.05, 1.95);
    drawText(ctx, p.o.text || 'PIES', mb.x, mb.y - 1, { color: '#ffe14a', align: 'center' });
    drawText(ctx, p.o.text2 || 'BEEF TEA £1', mb.x, mb.y + 7, { color: '#f4f1e8', align: 'center' });
    // counter
    isoBox(ctx, ax, ay, 0.02, 0.35, 0, 1.96, 0.6, 1.05, { top: '#c8c4bc', left: '#e8e4d8', right: '#a8a49c', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0.02, 0.96, 1.96, 0.2, 0.42, RED);
    isoPanel(ctx, ax, ay, 'left', 0.02, 0.96, 1.96, 0.42, 0.5, WHITE);
    // pies + steaming urn
    for (let i = 0; i < 3; i++) { const s = proj(ax, ay, 0.35 + i * 0.25, 0.65, 1.05); ctx.fillStyle = OL; ctx.fillRect(s.x - 3, s.y - 3, 7, 4); ctx.fillStyle = '#c8862e'; ctx.fillRect(s.x - 2, s.y - 2, 5, 2); }
    const urn = proj(ax, ay, 1.55, 0.6, 1.05);
    ctx.fillStyle = OL; ctx.fillRect(urn.x - 4, urn.y - 12, 9, 13); ctx.fillStyle = '#b8bcc4'; ctx.fillRect(urn.x - 3, urn.y - 11, 7, 11); ctx.fillStyle = '#e8ecf0'; ctx.fillRect(urn.x - 2, urn.y - 11, 2, 11);
  },
});
function kioskSteam(ctx, ax, ay, p, t) {
  const urn = proj(ax, ay, 1.55, 0.6, 1.05);
  for (let i = 0; i < 2; i++) { const k = (t * 0.8 + i * 0.5) % 1; ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(urn.x + Math.sin(t * 4 + i) * 2), Math.round(urn.y - 14 - k * 14), 2, 2); }
  ctx.globalAlpha = 1;
}

// Concrete column holding up the stand.
registerProp('derby_pillar', {
  h: 3,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.22, 0.22, 0, 0.56, 0.56, 3.6, { top: '#7a7a82', left: '#6a6a72', right: '#4a4a52', outline: OL });
    isoBox(ctx, ax, ay, 0.2, 0.2, 1.0, 0.6, 0.6, 0.25, { top: RED, left: RED, right: shade(RED, -0.35) });
    isoBox(ctx, ax, ay, 0.2, 0.2, 1.25, 0.6, 0.6, 0.08, { top: WHITE, left: WHITE, right: shade(WHITE, -0.3) });
    if (p.o.text) { const m = proj(ax, ay, 0.5, 0.78, 2.2); drawText(ctx, p.o.text, m.x, m.y - 3, { color: '#ffe14a', align: 'center', outline: OL }); }
  },
});

// Crush barrier: galvanised rail on posts (dir 'x' default or 'y'). Jumpable (0.9).
registerProp('derby_crushBarrier', {
  h: 0.9,
  draw(ctx, ax, ay, p) {
    const alongX = p.o.dir !== 'y';
    const a = alongX ? proj(ax, ay, 0.02, 0.5, 0) : proj(ax, ay, 0.5, 0.02, 0);
    const b = alongX ? proj(ax, ay, 0.98, 0.5, 0) : proj(ax, ay, 0.5, 0.98, 0);
    const zt = 0.9 * Z_PX;
    for (const q of [a, b]) { thick(ctx, q.x, q.y, q.x, q.y - zt, 3, OL); thick(ctx, q.x, q.y, q.x, q.y - zt, 1, '#a8acb4'); }
    thick(ctx, a.x, a.y - zt, b.x, b.y - zt, 4, OL);
    thick(ctx, a.x, a.y - zt, b.x, b.y - zt, 2, '#c0c4cc');
    line(ctx, a.x, a.y - zt - 1, b.x, b.y - zt - 1, '#e8ecf0');
    thick(ctx, a.x, a.y - zt * 0.45, b.x, b.y - zt * 0.45, 1, '#7a7e86');
    if (p.o.scarf) { // a scarf tied on the rail
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - zt };
      for (let j = 0; j < 9; j++) { ctx.fillStyle = Math.floor(j / 2) % 2 ? WHITE : RED; ctx.fillRect(m.x, m.y + j, 2, 1); }
    }
  },
});

// Static flare burning on the ground (pair it with a level hazard zone; o.phase offsets its cycle).
registerProp('derby_flare', {
  h: 0, solid: false, depthBias: -0.4,
  light: { z: 0.6, r: 3.2, color: '#ff3020', intensity: 0.95, flicker: true },
  update(p, world, dt) {
    const on = flareBurning(world.time, p.o.phase || 0);
    const L = p.__light || (p.__light = world.lights.find(l => l.prop === p));
    if (L) L.intensity = on ? 0.95 : 0.35;
    if (on && Math.random() < dt * 10 && nearPlayer(world, p.cx, p.cy)) smokePuff(world, p.cx, p.cy, 0.3, Math.random() < 0.6 ? '#c04040' : '#8a7a80');
  },
  draw(ctx, ax, ay, p, t, world) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    const on = world ? flareBurning(world.time, p.o.phase || 0) : true;
    if (on) { ctx.globalAlpha = 0.3; ellipse(ctx, s.x, s.y, 16, 8, '#ff3020'); ctx.globalAlpha = 0.25; ellipse(ctx, s.x, s.y, 8, 4, '#ffe0a0'); ctx.globalAlpha = 1; }
    else { ctx.globalAlpha = 0.3; ellipse(ctx, s.x, s.y, 9, 4, '#3a1010'); ctx.globalAlpha = 1; }
    drawFlareStick(ctx, s.x, s.y, t, on);
  },
});

// Goal: posts, crossbar and net (w 6, d 2). Posts stand on the goal line (local y 1.5).
registerProp('derby_goal', {
  w: 6, d: 2, h: 2,
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    const L = 0.5, R = 5.5, F = 1.5, B = 0.3, H = 1.9, HB = 1.3;
    const net = 'rgba(232,236,240,0.55)';
    ctx.strokeStyle = net; ctx.lineWidth = 1;
    const seg = (a, b) => { ctx.beginPath(); ctx.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); ctx.lineTo(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5); ctx.stroke(); };
    // back net plane (x from L..R at y=B, z 0..HB)
    ctx.globalAlpha = 0.85;
    fillPoly(ctx, [P(L, B, HB), P(R, B, HB), P(R, B, 0), P(L, B, 0)], 'rgba(200,210,220,0.10)');
    for (let i = 0; i <= 20; i++) { const x = L + (R - L) * i / 20; seg(P(x, B, 0), P(x, B, HB)); }
    for (let j = 0; j <= 6; j++) { const z = HB * j / 6; seg(P(L, B, z), P(R, B, z)); }
    // roof net: from crossbar back to the back bar
    for (let i = 0; i <= 20; i++) { const x = L + (R - L) * i / 20; seg(P(x, F, H), P(x, B, HB)); }
    for (let j = 0; j <= 3; j++) { const k = j / 3; seg(P(L, F + (B - F) * k, H + (HB - H) * k), P(R, F + (B - F) * k, H + (HB - H) * k)); }
    // side nets
    for (const x of [L, R]) {
      for (let j = 0; j <= 4; j++) { const k = j / 4; seg(P(x, F + (B - F) * k, 0), P(x, F + (B - F) * k, H + (HB - H) * k)); }
      for (let j = 0; j <= 5; j++) { const z = HB * j / 5; seg(P(x, B, z), P(x, F, z * H / HB)); }
    }
    ctx.globalAlpha = 1;
    // back frame
    thick(ctx, P(L, B, 0).x, P(L, B, 0).y, P(L, B, HB).x, P(L, B, HB).y, 1, '#9aa0a8');
    thick(ctx, P(R, B, 0).x, P(R, B, 0).y, P(R, B, HB).x, P(R, B, HB).y, 1, '#9aa0a8');
    // posts & crossbar
    const post = (x) => { const a = P(x, F, 0), b = P(x, F, H); thick(ctx, a.x, a.y, b.x, b.y, 4, OL); thick(ctx, a.x, a.y, b.x, b.y, 2, '#f4f4f0'); };
    post(L); post(R);
    const c0 = P(L, F, H), c1 = P(R, F, H);
    thick(ctx, c0.x, c0.y, c1.x, c1.y, 4, OL); thick(ctx, c0.x, c0.y, c1.x, c1.y, 2, '#f4f4f0');
    line(ctx, c0.x, c0.y - 1, c1.x, c1.y - 1, '#ffffff');
  },
});

// Corner flag: USE to pull it out (gives the CORNER FLAG weapon).
registerProp('derby_cornerFlag', {
  h: 0, solid: false, pickup: 'flag',
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 1.7);
    shadow(ctx, b.x, b.y, 4, 2, 0.3);
    thick(ctx, b.x, b.y, top.x, top.y, 3, OL); thick(ctx, b.x, b.y, top.x, top.y, 1, '#f4f4f0');
    for (let i = 0; i < 9; i++) {
      const w = Math.round(Math.sin(t * 6 + i * 0.6) * i / 9 * 2);
      for (let j = 0; j < 6; j++) { ctx.fillStyle = (Math.floor(i / 3) + Math.floor(j / 3)) % 2 ? '#c8102e' : '#ffd23a'; ctx.fillRect(top.x + 1 + i, top.y + j + w, 1, 1); }
    }
  },
});

// Dugout (w 3): perspex shelter with red tip-up seats.
registerProp('derby_dugout', {
  w: 3, d: 1, h: 1.5,
  draw(ctx, ax, ay, p, t) {
    const P = (x, y, z) => proj(ax, ay, x, y, z);
    // back wall
    isoBox(ctx, ax, ay, 0, 0, 0, 3, 0.15, 1.6, { top: '#3a3a44', left: '#2a2a34', right: '#22222a', outline: OL });
    // seats row
    for (let i = 0; i < 6; i++) {
      isoBox(ctx, ax, ay, 0.12 + i * 0.47, 0.2, 0.35, 0.36, 0.3, 0.08, { color: p.o.seat || RED });
      isoBox(ctx, ax, ay, 0.12 + i * 0.47, 0.17, 0.43, 0.36, 0.06, 0.4, { color: p.o.seat || RED });
    }
    // floor plinth
    isoBox(ctx, ax, ay, 0, 0.15, 0, 3, 0.85, 0.15, { top: '#4a4a52', left: '#3a3a42', right: '#2a2a32' });
    // perspex canopy (curved roof approximated) and ends
    ctx.globalAlpha = 0.35;
    fillPoly(ctx, [P(0, 0, 1.6), P(3, 0, 1.6), P(3, 0.95, 1.2), P(0, 0.95, 1.2)], '#b8e0f0');
    fillPoly(ctx, [P(3, 0, 1.6), P(3, 0.95, 1.2), P(3, 0.95, 0.15), P(3, 0, 0.15)], '#9ac8e0');
    ctx.globalAlpha = 1;
    for (const [a, b] of [[P(0, 0, 1.6), P(0, 0.95, 1.2)], [P(3, 0, 1.6), P(3, 0.95, 1.2)], [P(0, 0.95, 1.2), P(3, 0.95, 1.2)], [P(3, 0.95, 1.2), P(3, 0.95, 0.15)]]) line(ctx, a.x, a.y, b.x, b.y, '#d8e8f0');
    if (p.o.text) { const m = P(1.5, 0.95, 1.35); drawText(ctx, p.o.text, m.x, m.y - 3, { color: '#ffffff', align: 'center', outline: OL }); }
  },
});

// Stadium tannoy: USE it to blast the club song. Stuns nearby enemies, wakes the crowd. Recharges.
registerProp('derby_tannoy', {
  h: 0, solid: false,
  interact: { kind: 'switch', key: null },
  update(p, world, dt) {
    if (p.open && !p.fired) {
      p.fired = true; p.cool = 25;
      audio.chant && audio.chant();
      world.sfx('crowdCheer', p);
      world.message('THE TANNOY BLASTS THE CLUB SONG!', 'THE WHOLE GROUND JOINS IN', 2.2, '#ffe14a');
      world.camera.shake(5, 0.5);
      const S = crowdState(world); S.cheerT = 3;
      for (const f of world.fighters) {
        if (f.team !== 'enemy' || !f.alive || f.isDown) continue;
        if (Math.hypot(f.x - p.cx, f.y - p.cy) > 10) continue;
        f.attack = null;
        if (f.boss) { f.setState('hurt'); f.stunT = 0.6; }
        else { f.setState('dizzy'); f.stunT = 2.2; }
        world.fx.popup(f.x, f.y, f.z + 0.4, '?!', '#ffe14a');
      }
    }
    if (p.open && p.fired) {
      p.cool -= dt;
      if (p.cool <= 0) { p.open = false; p.fired = false; }
    }
  },
  draw(ctx, ax, ay, p, t, world) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 2.6);
    thick(ctx, b.x, b.y, top.x, top.y, 4, OL); thick(ctx, b.x, b.y, top.x, top.y, 2, '#5a5a62');
    // control box
    isoBox(ctx, ax, ay, 0.3, 0.3, 0.7, 0.4, 0.4, 0.5, { color: '#3a4a3a', outline: OL });
    const l = proj(ax, ay, 0.5, 0.7, 1.0);
    ctx.fillStyle = p.open ? '#ff3030' : (Math.floor(t * 3) % 2 ? '#3aff7a' : '#1a8a3a'); ctx.fillRect(l.x - 1, l.y - 1, 3, 3);
    // horn speakers
    for (const dx of [-1, 1]) {
      const h0 = { x: top.x, y: top.y + 2 };
      fillPoly(ctx, [{ x: h0.x, y: h0.y - 2 }, { x: h0.x + dx * 10, y: h0.y - 6 }, { x: h0.x + dx * 10, y: h0.y + 4 }, { x: h0.x, y: h0.y + 2 }], OL);
      fillPoly(ctx, [{ x: h0.x + dx, y: h0.y - 1 }, { x: h0.x + dx * 9, y: h0.y - 4 }, { x: h0.x + dx * 9, y: h0.y + 2 }, { x: h0.x + dx, y: h0.y + 1 }], '#c8c8b8');
    }
    if (p.open) { // sound waves
      for (let i = 0; i < 3; i++) { const k = (t * 2 + i / 3) % 1; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(top.x, top.y + 1, 8 + k * 18, -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(top.x, top.y + 1, 8 + k * 18, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else if (world && world.player && Math.hypot(world.player.x - p.cx, world.player.y - p.cy) < 1.4) {
      drawText(ctx, 'E', b.x, b.y - 30 + Math.round(Math.sin(t * 6)), { color: '#ffe14a', align: 'center', outline: '#000' });
    }
  },
});

// Bag of match balls (breakable -> footballs to throw).
registerProp('derby_ballBag', {
  h: 0.6,
  breakable: { hp: 8, debris: ['#f4f4f0', '#2a2a2a', '#1a3a8a'], sfx: 'wood', drops: [['derby_ball', 1], ['derby_ball', 1], ['derby_ball', 0.5]], score: 40 },
  draw(ctx, ax, ay) {
    const s = proj(ax, ay, 0.5, 0.5, 0);
    shadow(ctx, s.x, s.y, 9, 4, 0.35);
    ellipse(ctx, s.x, s.y - 7, 10, 8, OL);
    ellipse(ctx, s.x, s.y - 7, 9, 7, '#1a2a6a');
    for (const [dx, dy] of [[-4, -9], [3, -10], [-1, -4], [5, -5], [-6, -4]]) { ellipse(ctx, s.x + dx, s.y + dy, 3, 3, OL); ellipse(ctx, s.x + dx, s.y + dy, 2, 2, '#f4f4f0'); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(s.x + dx, s.y + dy, 1, 1); }
    for (let i = -8; i <= 8; i += 3) line(ctx, s.x + i, s.y - 14, s.x + i * 0.7, s.y, '#0a1440');
    ctx.fillStyle = OL; ctx.fillRect(s.x - 2, s.y - 17, 4, 3);
  },
});

// Kit hamper in the dressing room.
registerProp('derby_kitBasket', {
  h: 0.8,
  breakable: { hp: 12, debris: ['#b08a50', RED, WHITE], sfx: 'wood', drops: [['cash5', 0.6], ['energy', 0.5], ['coin', 0.6]], score: 50 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.12, 0.15, 0, 0.76, 0.7, 0.7, { top: '#c8a060', left: '#a8803c', right: '#7a5a28', outline: OL });
    for (let i = 1; i < 6; i++) { const a = proj(ax, ay, 0.12 + i * 0.127, 0.85, 0), b = proj(ax, ay, 0.12 + i * 0.127, 0.85, 0.7); line(ctx, a.x, a.y, b.x, b.y, '#7a5a28'); }
    // shirts spilling out
    isoBox(ctx, ax, ay, 0.2, 0.25, 0.7, 0.5, 0.4, 0.12, { color: RED });
    isoBox(ctx, ax, ay, 0.3, 0.45, 0.78, 0.35, 0.3, 0.08, { color: WHITE });
  },
});

// Stack of bootleg merchandise boxes (breakable; can carry a secret id).
registerProp('derby_merchBox', {
  h: 1.5,
  breakable: { hp: 22, debris: ['#b08a5a', '#8a6a40', RED], sfx: 'wood', drops: [['coin', 0.8], ['cash5', 0.4]], score: 60 },
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.08, 0.1, 0, 0.84, 0.8, 0.7, { top: '#c09a68', left: '#a8824e', right: '#7a5e38', outline: OL });
    isoBox(ctx, ax, ay, 0.15, 0.18, 0.7, 0.7, 0.66, 0.6, { top: '#b8925e', left: '#9e7846', right: '#745632', outline: OL });
    const m = proj(ax, ay, 0.5, 0.9, 0.35);
    drawText(ctx, 'NAFC', m.x - 9, m.y - 3, { color: RED });
    const m2 = proj(ax, ay, 0.5, 0.84, 1.0);
    ctx.fillStyle = '#e8e4d8'; ctx.fillRect(m2.x - 5, m2.y - 2, 10, 3);
    drawText(ctx, 'X', m2.x - 2, m2.y - 3, { color: '#1a1a1a' });
  },
});

// Supporters' coach (w 4, along x).
registerProp('derby_coach', {
  w: 4, d: 1, h: 1.9,
  draw(ctx, ax, ay, p) {
    const c = p.o.color || BLUE, c2 = p.o.trim || WHITE;
    const wh = (x, y) => { const s = proj(ax, ay, x, y, 0.15); ellipse(ctx, s.x, s.y, 4, 4, '#0c0c0e'); ellipse(ctx, s.x, s.y, 2, 2, '#6a6a70'); };
    wh(0.6, 0.95); wh(3.3, 0.95);
    isoBox(ctx, ax, ay, 0.04, 0.06, 0.15, 3.92, 0.88, 1.8, { top: shade(c2, -0.1), left: c, right: shade(c, -0.3), outline: OL });
    // window band
    isoPanel(ctx, ax, ay, 'left', 0.2, 0.94, 3.6, 1.05, 1.6, '#1a2030');
    for (let i = 0; i < 6; i++) isoPanel(ctx, ax, ay, 'left', 0.25 + i * 0.6, 0.94, 0.5, 1.1, 1.55, i % 2 ? '#3a4a60' : '#2c3a4e');
    isoPanel(ctx, ax, ay, 'left', 0.04, 0.94, 3.92, 0.55, 0.75, c2);
    isoPanel(ctx, ax, ay, 'right', 3.96, 0.1, 0.8, 0.95, 1.65, '#4a6a88');
    // scarves in the back window
    for (let i = 0; i < 3; i++) { const s = proj(ax, ay, 0.4 + i * 1.1, 0.94, 1.45); for (let j = 0; j < 6; j++) { ctx.fillStyle = j % 2 ? c2 : c; ctx.fillRect(s.x, s.y + j, 2, 1); } }
    if (p.o.text) {
      const m = proj(ax, ay, 2, 0.95, 0.66);
      ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, 0.5, 0, 1, 0, 0);
      drawText(ctx, p.o.text, 0, -3, { color: p.o.textColor || c, align: 'center' });
      ctx.restore();
    }
  },
});

// Floodlight pylon: lattice base, tall mast and lamp bank (big light).
registerProp('derby_floodlight', {
  h: 3,
  light: { z: 6, r: 9, color: '#f0f4ff', intensity: 0.75 },
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 9);
    isoBox(ctx, ax, ay, 0.15, 0.15, 0, 0.7, 0.7, 0.4, { color: '#5a5a62', outline: OL });
    // lattice mast
    for (const dx of [-4, 4]) thick(ctx, b.x + dx, b.y - 6, top.x + dx * 0.4, top.y + 6, 2, OL);
    for (const dx of [-4, 4]) line(ctx, b.x + dx, b.y - 6, top.x + dx * 0.4, top.y + 6, '#8a8e96');
    for (let i = 0; i < 16; i++) {
      const k0 = i / 16, k1 = (i + 1) / 16;
      const y0 = b.y - 6 + (top.y + 6 - b.y + 6) * k0, y1 = b.y - 6 + (top.y + 6 - b.y + 6) * k1;
      const w0 = 4 - 2.4 * k0, w1 = 4 - 2.4 * k1;
      line(ctx, b.x - w0, y0, b.x + w1, y1, '#6a6e76');
    }
    // lamp bank
    ctx.fillStyle = OL; ctx.fillRect(top.x - 14, top.y - 10, 28, 16);
    ctx.fillStyle = '#3a3a42'; ctx.fillRect(top.x - 13, top.y - 9, 26, 14);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r + c + Math.floor(t * 0.5)) % 7 === 0 ? '#d8e0ff' : '#ffffff';
      ctx.fillRect(top.x - 12 + c * 4, top.y - 8 + r * 4, 3, 3);
    }
  },
});

// Row of plastic seats (away section). Breakable -> rip a seat off as a weapon.
registerProp('derby_seats', {
  h: 0.5,
  breakable: { hp: 8, debris: [YEL, '#1a1a1a'], sfx: 'clatter', drops: [['derby_seat', 1]], score: 20 },
  draw(ctx, ax, ay, p) {
    const c = p.o.color || YEL;
    isoBox(ctx, ax, ay, 0.05, 0.1, 0, 0.9, 0.8, 0.15, { color: '#3a3a40' });
    for (let i = 0; i < 2; i++) {
      isoBox(ctx, ax, ay, 0.1 + i * 0.45, 0.25, 0.25, 0.38, 0.45, 0.08, { color: c, outline: OL });
      isoBox(ctx, ax, ay, 0.1 + i * 0.45, 0.2, 0.33, 0.38, 0.07, 0.35, { color: shade(c, -0.1), outline: OL });
    }
  },
});

// Physio table (jump on top).
registerProp('derby_physio', {
  w: 1, d: 1, h: 0.8,
  draw(ctx, ax, ay, p) {
    for (const [x, y] of [[0.15, 0.15], [0.8, 0.15], [0.15, 0.8], [0.8, 0.8]]) isoBox(ctx, ax, ay, x, y, 0, 0.06, 0.06, 0.7, { color: '#9aa0a8' });
    isoBox(ctx, ax, ay, 0.08, 0.08, 0.7, 0.84, 0.84, 0.12, { top: '#2a3a6a', left: '#1e2c54', right: '#16203e', outline: OL });
    // the magic sponge bucket underneath
    const s = proj(ax, ay, 0.5, 0.5, 0);
    ctx.fillStyle = OL; ctx.fillRect(s.x - 4, s.y - 7, 9, 8); ctx.fillStyle = '#c8c8c0'; ctx.fillRect(s.x - 3, s.y - 6, 7, 6); ctx.fillStyle = '#e8d040'; ctx.fillRect(s.x - 2, s.y - 8, 5, 2);
  },
});

// ---- wall decals (place on a wall tile; side 'left' = +y face, 'right' = +x face)
// Long decals are split into one prop per wall tile (opts.seg = index, see segments()) so every slice
// sorts with its own wall tile; each slice draws the whole decal clipped to its tile's face.
export function segments(spec) {
  const out = [];
  for (let i = 0; i < (spec.len || 1); i++) out.push({ ...spec, seg: i, x: spec.side === 'right' ? spec.x : spec.x + i, y: spec.side === 'right' ? spec.y + i : spec.y });
  return out;
}
// pre-rendered sprites (static props and wall decals) — keeps the per-frame cost to a drawImage
const SPRITES = new Map();
function cachedSprite(key, w, h, ox, oy, fn) {
  let c = SPRITES.get(key);
  if (!c) { c = makeCanvas(w, h); fn(c.getContext('2d'), ox, oy); SPRITES.set(key, c); }
  return c;
}
// wrap a registered prop's draw so it renders once per (type, size, key) and is blitted afterwards
function cacheStatic(id, keyFn = () => '', overlay = null) {
  const def = PROPS[id], raw = def.draw;
  const H = Math.max(def.h, 2.5) + 1.2;
  def.draw = (ctx, ax, ay, p, t, world) => {
    const w = p.w, d = p.d, ox = d * 16 + 16, oy = Math.round(H * 20 + 16);
    const c = cachedSprite(id + '|' + w + 'x' + d + '|' + keyFn(p.o), (w + d) * 16 + 32, (w + d) * 8 + oy + 24, ox, oy, (g, x, y) => raw(g, x, y, p, 0, null));
    ctx.drawImage(c, ax - ox, ay - oy);
    if (overlay) overlay(ctx, ax, ay, p, t, world);
  };
}
// a whole wall decal pre-rendered relative to its origin tile anchor
function decalSprite(p, variant, draw) {
  const o = p.o, len = o.len || 1;
  const zTop = Math.max(3, (o.z ?? 1.2) + (o.height ?? 1.2)) + 1;
  const ox = len * 16 + 48, oy = Math.round(zTop * 20 + 8);
  const key = [p.type, o.side, len, o.z, o.height, o.text, o.a, o.b, o.color, o.bg, o.n, o.nums, variant].join('|');
  return { c: cachedSprite(key, len * 32 + 96, oy + len * 8 + 48, ox, oy, (g, x, y) => draw(g, x, y, p, 0, null)), ox, oy };
}
function segmented(draw, variantFn = () => 0) {
  return function (ctx, ax, ay, p, t, world) {
    const seg = p.o.seg;
    const vr = variantFn(p, t);
    if (seg === undefined) { const S = decalSprite(p, vr, (g, x, y, pp) => draw(g, x, y, pp, vr)); ctx.drawImage(S.c, ax - S.ox, ay - S.oy); return; }
    const side = p.o.side || 'left';
    const len = p.o.len || 1;
    const o = side === 'left' ? proj(ax, ay, -seg, 0, 0) : proj(ax, ay, 0, -seg, 0);
    const lo = -0.6, hi = 6;
    const e0 = seg === 0 ? -0.3 : 0, e1 = seg === len - 1 ? 1.3 : 1;
    const pts = side === 'left'
      ? [proj(ax, ay, e0, 1, lo), proj(ax, ay, e1, 1, lo), proj(ax, ay, e1, 1, hi), proj(ax, ay, e0, 1, hi)]
      : [proj(ax, ay, 1, e0, lo), proj(ax, ay, 1, e1, lo), proj(ax, ay, 1, e1, hi), proj(ax, ay, 1, e0, hi)];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(Math.round(pts[0].x), pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(Math.round(pts[i].x), pts[i].y);
    ctx.closePath();
    ctx.clip();
    const S = decalSprite(p, vr, (g, x, y, pp) => draw(g, x, y, pp, vr));
    ctx.drawImage(S.c, Math.round(o.x) - S.ox, Math.round(o.y) - S.oy);
    ctx.restore();
  };
}

// Wall sign: framed panel with skewed text. opts: text, color, bg, side, z, height, len, neon
registerProp('derby_sign', {
  h: 0, solid: false, depthBias: 0.03,
  draw: segmented((ctx, ax, ay, p, flick) => {
    const side = p.o.side || 'left', len = p.o.len ?? 1, z0 = p.o.z ?? 1.2, z1 = z0 + (p.o.height ?? 0.7);
    const bg = p.o.bg || '#1a1420';
    const fg = flick ? shade(p.o.color || '#ffffff', -0.6) : (p.o.color || '#ffffff');
    facePanel(ctx, ax, ay, side, 0.04, len - 0.08, z0, z1, OL);
    facePanel(ctx, ax, ay, side, 0.08, len - 0.16, z0 + 0.06, z1 - 0.06, bg);
    facePanel(ctx, ax, ay, side, 0.08, len - 0.16, z1 - 0.12, z1 - 0.06, shade(bg, 0.25));
    for (const u of [0.15, len - 0.15]) { const b = onFace(ctx, ax, ay, side, u, (z0 + z1) / 2); ctx.fillStyle = '#c8c8c0'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); }
    if (p.o.text) {
      const m = onFace(ctx, ax, ay, side, len / 2, (z0 + z1) / 2);
      ctx.save();
      ctx.translate(Math.round(m.x), Math.round(m.y));
      ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
      drawText(ctx, p.o.text, 0, -3, { color: fg, align: 'center' });
      ctx.restore();
    }
  }, (p, t) => (p.o.neon && Math.sin(t * 17) + Math.sin(t * 5.1) > 1.8 ? 1 : 0)),
});
function onFace(ctx, ax, ay, side, u, z) { return side === 'left' ? proj(ax, ay, u, 1.01, z) : proj(ax, ay, 1.01, u, z); }
function facePanel(ctx, ax, ay, side, u0, len, z0, z1, color) {
  if (side === 'left') isoPanel(ctx, ax, ay, 'left', u0, 1.02, len, z0, z1, color);
  else isoPanel(ctx, ax, ay, 'right', 1.02, u0, len, z0, z1, color);
}

// Fabric banner hung on a wall face: stripes, fringe, text. opts: text, a, b, len, z, height, side, color
registerProp('derby_banner', {
  h: 0, solid: false, depthBias: 0.03,
  draw: segmented(function (ctx, ax, ay, p, t) {
    const side = p.o.side || 'left', len = p.o.len ?? 3, z0 = p.o.z ?? 0.6, z1 = z0 + (p.o.height ?? 0.9);
    const a = p.o.a || RED, b = p.o.b || WHITE;
    const N = Math.round(len * 16);
    for (let i = 0; i < N; i++) {
      const u = i / 16;
      const sag = Math.sin(Math.PI * (u / len)) * 0.08 + Math.sin(t * 2 + u * 3) * 0.015;
      const top = onFace(ctx, ax, ay, side, u, z1 - sag), bot = onFace(ctx, ax, ay, side, u, z0 - sag);
      const h = Math.round(bot.y - top.y);
      ctx.fillStyle = OL; ctx.fillRect(Math.round(top.x), Math.round(top.y) - 1, 1, h + 2);
      if (i === 0 || i === N - 1) continue;
      for (let y = 0; y < h; y++) {
        const k = y / h;
        ctx.fillStyle = (k < 0.18 || k > 0.82) ? b : a;
        ctx.fillRect(Math.round(top.x), Math.round(top.y) + y, 1, 1);
      }
      if (i % 2 === 0) { ctx.fillStyle = b; ctx.fillRect(Math.round(bot.x), Math.round(bot.y) + 1, 1, 2); }
    }
    if (p.o.text) {
      const m = onFace(ctx, ax, ay, side, len / 2, (z0 + z1) / 2 - 0.05);
      ctx.save();
      ctx.translate(Math.round(m.x), Math.round(m.y));
      ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
      drawText(ctx, p.o.text, 0, -3, { color: p.o.color || b, align: 'center', outline: shade(a, -0.55) });
      ctx.restore();
    }
  }),
});

// Kit hanging on pegs (wall decal): o.n shirts, numbers.
registerProp('derby_shirts', {
  h: 0, solid: false, depthBias: 0.03,
  draw: segmented(function (ctx, ax, ay, p) {
    const side = p.o.side || 'left', n = p.o.n ?? 3;
    for (let i = 0; i < n; i++) {
      const c = onFace(ctx, ax, ay, side, (i + 0.5) / n * (p.o.len ?? 1), 1.55);
      const sk = side === 'left' ? 0.5 : -0.5;
      ctx.save(); ctx.translate(Math.round(c.x), Math.round(c.y)); ctx.transform(1, sk, 0, 1, 0, 0);
      ctx.fillStyle = OL; ctx.fillRect(-4, -1, 9, 12); ctx.fillRect(-6, 0, 13, 4);
      ctx.fillStyle = RED; ctx.fillRect(-3, 0, 7, 10); ctx.fillRect(-5, 1, 11, 2);
      ctx.fillStyle = WHITE; ctx.fillRect(-1, 0, 3, 1); ctx.fillRect(-5, 2, 1, 1); ctx.fillRect(5, 2, 1, 1);
      drawText(ctx, String(p.o.nums ? p.o.nums[i] : i + 2), 1, 3, { color: WHITE, align: 'center' });
      ctx.fillStyle = '#c8c8c0'; ctx.fillRect(0, -3, 1, 2);
      ctx.restore();
    }
  }),
});

// Tactics whiteboard (wall decal)
registerProp('derby_tactics', {
  h: 0, solid: false, depthBias: 0.03,
  draw: segmented(function (ctx, ax, ay, p) {
    const side = p.o.side || 'left', len = p.o.len ?? 2;
    facePanel(ctx, ax, ay, side, 0.1, len - 0.2, 0.9, 2.1, OL);
    facePanel(ctx, ax, ay, side, 0.15, len - 0.3, 0.95, 2.05, '#e8ecee');
    const m = onFace(ctx, ax, ay, side, len / 2, 1.5);
    ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, side === 'left' ? 0.5 : -0.5, 0, 1, 0, 0);
    drawText(ctx, p.o.text || 'HIT THEM EARLY', 0, -10, { color: '#c01820', align: 'center' });
    for (const [x, y] of [[-10, 2], [-4, 5], [4, 3], [10, 6]]) drawText(ctx, 'X', x, y, { color: '#1a3a8a' });
    for (const [x, y] of [[-8, 9], [0, 10], [8, 11]]) drawText(ctx, 'O', x, y, { color: '#c01820' });
    line(ctx, -6, 8, 3, 3, '#1a1a1a'); line(ctx, 3, 3, 1, 4, '#1a1a1a');
    ctx.restore();
  }),
});

// Urinal trough along a back wall (decor)
registerProp('derby_urinal', {
  h: 0, solid: false, depthBias: -0.2,
  draw(ctx, ax, ay, p) {
    isoBox(ctx, ax, ay, 0.0, 0.05, 0.3, 1.0, 0.3, 0.25, { top: '#5a6066', left: '#c8ccd0', right: '#9aa0a6', outline: OL });
    isoPanel(ctx, ax, ay, 'left', 0, 0.06, 1, 0.55, 1.4, '#d8dcde');
    const pipe = proj(ax, ay, 0.5, 0.06, 1.4), pb = proj(ax, ay, 0.5, 0.06, 0.55);
    line(ctx, pipe.x, pipe.y, pb.x, pb.y, '#8a9098');
  },
});

// static props: pre-render once (animated bits drawn on top)
cacheStatic('derby_burgerVan', () => '', vanSteam);
cacheStatic('derby_kiosk', o => (o.text || '') + '|' + (o.text2 || ''), kioskSteam);
cacheStatic('derby_turnstile', () => '', turnstileArms);
cacheStatic('derby_stall', o => [o.a, o.b, o.text].join(','));
cacheStatic('derby_crushBarrier', o => (o.dir || 'x') + (o.scarf ? 's' : ''));
cacheStatic('derby_seats', o => o.color || '');
cacheStatic('derby_merchBox');
cacheStatic('derby_kitBasket');
cacheStatic('derby_physio');
cacheStatic('derby_dugout', o => (o.seat || '') + (o.text || ''));
cacheStatic('derby_coach', o => [o.color, o.trim, o.text, o.textColor].join(','));
cacheStatic('derby_goal');
cacheStatic('derby_pillar', o => o.text || '');
cacheStatic('derby_urinal');
cacheStatic('derby_ballBag');

// =====================================================================================================
// ITEMS
// =====================================================================================================
function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

registerItem('derby_beeftea', {
  name: 'CUP OF BEEF TEA', kind: 'heal', heal: 25, score: 40, stash: true, auto: true,
  icon(ctx, x, y, t) {
    px(ctx, OL, x - 4, y - 10, 9, 10);
    px(ctx, '#f0ece0', x - 3, y - 9, 7, 9);
    px(ctx, '#6a3a1a', x - 3, y - 9, 7, 2);
    px(ctx, RED, x - 3, y - 5, 7, 2);
    const k = (t * 1.5) % 1;
    px(ctx, 'rgba(255,255,255,0.7)', x - 1 + Math.round(Math.sin(t * 5) * 1.5), y - 12 - Math.round(k * 4), 1, 2);
  },
});

registerItem('derby_ball', {
  name: 'MATCH BALL', kind: 'weapon', score: 0,
  weapon: { dmg: 7, reach: 1.15, durability: 3, attack: 'swing', throwDmg: 15, breaks: 'plastic' },
  icon(ctx, x, y, t) {
    const b = Math.abs(Math.round(Math.sin(t * 5) * 2));
    ellipse(ctx, x, y - 5 - b, 5, 5, OL); ellipse(ctx, x, y - 5 - b, 4, 4, '#f4f4f0');
    px(ctx, '#1a1a1a', x - 1, y - 6 - b, 2, 2); px(ctx, '#1a1a1a', x + 2, y - 4 - b, 1, 1); px(ctx, '#1a1a1a', x - 3, y - 3 - b, 1, 1);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    ellipse(ctx, hx, hy, 5, 5, OL); ellipse(ctx, hx, hy, 4, 4, flash ? '#ffffff' : '#f4f4f0');
    const a = ang * 2;
    px(ctx, '#1a1a1a', hx + Math.cos(a) * 2 - 1, hy + Math.sin(a) * 2 - 1, 2, 2);
    px(ctx, '#1a1a1a', hx - Math.cos(a) * 2, hy - Math.sin(a) * 2, 1, 1);
  },
});

registerItem('derby_seat', {
  name: 'PLASTIC SEAT', kind: 'weapon', score: 0,
  weapon: { dmg: 11, reach: 1.3, durability: 3, attack: 'swing', knockdown: true, throwDmg: 13, breaks: 'plastic' },
  icon(ctx, x, y) {
    px(ctx, OL, x - 6, y - 12, 12, 12);
    px(ctx, YEL, x - 5, y - 11, 10, 6);
    px(ctx, '#c8a010', x - 5, y - 5, 10, 3);
    px(ctx, '#3a3a40', x - 4, y - 2, 2, 2); px(ctx, '#3a3a40', x + 2, y - 2, 2, 2);
  },
  drawHeld(ctx, hx, hy, ang, s = 1, flash) {
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const ex = hx + dx * 7 * s, ey = hy + dy * 7 * s;
    thick(ctx, hx, hy, ex, ey, 3, OL);
    const pxv = -dy, pyv = dx;
    fillPoly(ctx, [{ x: ex - pxv * 6, y: ey - pyv * 6 }, { x: ex + pxv * 6, y: ey + pyv * 6 }, { x: ex + pxv * 6 + dx * 6, y: ey + pyv * 6 + dy * 6 }, { x: ex - pxv * 6 + dx * 6, y: ey - pyv * 6 + dy * 6 }], OL);
    fillPoly(ctx, [{ x: ex - pxv * 5, y: ey - pyv * 5 }, { x: ex + pxv * 5, y: ey + pyv * 5 }, { x: ex + pxv * 5 + dx * 5, y: ey + pyv * 5 + dy * 5 }, { x: ex - pxv * 5 + dx * 5, y: ey - pyv * 5 + dy * 5 }], flash ? '#ffffff' : YEL);
  },
});

// =====================================================================================================
// BLENDER SPRITE OVERLAYS — scripts/blender/env_derby.py pre-renders the static bodies of these props/floors.
// World.drawProp draws the sprite and then def.overlay(ctx, ax, ay, p, t, world): the animated, lettered or
// per-placement bits stay procedural here. Floors with features at absolute map positions (pitch markings,
// tunnel runner) re-paint those pixels on top of the sampled sprite patch via a floor decal.
// =====================================================================================================
import { FLOORS, FLOOR_SCALE } from '../../engine/tiles.js';
import { HALF_W, HALF_H } from '../../engine/constants.js';

function spriteOverlay(id, fn) { if (PROPS[id]) PROPS[id].overlay = fn; }

// waving cloth of derby_flagpole (same drawing as its procedural draw, minus the pole)
spriteOverlay('derby_flagpole', (ctx, ax, ay, p, t) => {
  const top = proj(ax, ay, 0.5, 0.5, 4.2);
  const a = p.o.a || RED, bcol = p.o.b || WHITE;
  const fw = 22, fh = 13;
  for (let i = 0; i < fw; i++) {
    const sw = Math.sin(t * 5 + i * 0.45 + p.x);
    const wave = Math.round(sw * (i / fw) * 3);
    const k = Math.round(sw * 3) / 20;
    const x = top.x + 1 + i, y0 = top.y + 1 + wave;
    if (p.o.cross && Math.abs(i - 7) < 2) { ctx.fillStyle = shade(p.o.cross, k); ctx.fillRect(x, y0, 1, fh); continue; }
    ctx.fillStyle = shade(a, k); ctx.fillRect(x, y0, 1, fh);
    ctx.fillStyle = shade(bcol, k); ctx.fillRect(x, y0 + 4, 1, 5);
    if (p.o.cross) { ctx.fillStyle = shade(p.o.cross, k); ctx.fillRect(x, y0 + 5, 1, 3); }
  }
  for (let i = 0; i < fw; i++) { const wave = Math.round(Math.sin(t * 5 + i * 0.45 + p.x) * (i / fw) * 3); ctx.fillStyle = OL; ctx.fillRect(top.x + 1 + i, top.y + wave, 1, 1); ctx.fillRect(top.x + 1 + i, top.y + fh + 1 + wave, 1, 1); }
});

spriteOverlay('derby_stall', (ctx, ax, ay, p) => {
  if (p.o.text) { const m = proj(ax, ay, 1, 1.15, 2.3); drawText(ctx, p.o.text, m.x, m.y - 10, { color: '#ffe14a', align: 'center', outline: OL }); }
});

spriteOverlay('derby_burgerVan', (ctx, ax, ay, p, t) => {
  const m = proj(ax, ay, 1.5, 0.5, 1.7);
  ctx.fillStyle = OL; ctx.fillRect(m.x - 22, m.y - 11, 44, 10);
  ctx.fillStyle = '#ffe14a'; ctx.fillRect(m.x - 21, m.y - 10, 42, 8);
  drawText(ctx, 'BURGERS', m.x, m.y - 9, { color: '#7a1010', align: 'center' });
  vanSteam(ctx, ax, ay, p, t);
});

spriteOverlay('derby_turnstile', (ctx, ax, ay, p, t, world) => {
  const m = proj(ax, ay, 0.5, 1.0, 2.05);
  drawText(ctx, 'IN', m.x - 4, m.y - 3, { color: '#ffffff' });
  turnstileArms(ctx, ax, ay, p, t, world);
});

spriteOverlay('derby_coach', (ctx, ax, ay, p) => {
  if (!p.o.text) return;
  const m = proj(ax, ay, 2, 0.95, 0.66);
  ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.transform(1, 0.5, 0, 1, 0, 0);
  drawText(ctx, p.o.text, 0, -3, { color: p.o.textColor || p.o.color || BLUE, align: 'center' });
  ctx.restore();
});

spriteOverlay('derby_kiosk', (ctx, ax, ay, p, t) => {
  const mb = proj(ax, ay, 1, 0.05, 1.95);
  drawText(ctx, p.o.text || 'PIES', mb.x, mb.y - 1, { color: '#ffe14a', align: 'center' });
  drawText(ctx, p.o.text2 || 'BEEF TEA £1', mb.x, mb.y + 7, { color: '#f4f1e8', align: 'center' });
  kioskSteam(ctx, ax, ay, p, t);
});

spriteOverlay('derby_pillar', (ctx, ax, ay, p) => {
  if (p.o.text) { const m = proj(ax, ay, 0.5, 0.78, 2.2); drawText(ctx, p.o.text, m.x, m.y - 3, { color: '#ffe14a', align: 'center', outline: OL }); }
});

spriteOverlay('derby_crushBarrier', (ctx, ax, ay, p) => {
  if (!p.o.scarf) return;
  const alongX = p.o.dir !== 'y';
  const a = alongX ? proj(ax, ay, 0.02, 0.5, 0) : proj(ax, ay, 0.5, 0.02, 0);
  const b = alongX ? proj(ax, ay, 0.98, 0.5, 0) : proj(ax, ay, 0.5, 0.98, 0);
  const zt = 0.9 * Z_PX;
  const m = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2 - zt) };
  for (let j = 0; j < 9; j++) { ctx.fillStyle = Math.floor(j / 2) % 2 ? WHITE : RED; ctx.fillRect(m.x, m.y + j, 2, 1); }
});

// flare: canister is in the sprite; glow + flame / sputter drawn here
spriteOverlay('derby_flare', (ctx, ax, ay, p, t, world) => {
  const s = proj(ax, ay, 0.5, 0.5, 0);
  const on = world ? flareBurning(world.time, p.o.phase || 0) : true;
  if (on) { ctx.globalAlpha = 0.3; ellipse(ctx, s.x, s.y, 16, 8, '#ff3020'); ctx.globalAlpha = 0.25; ellipse(ctx, s.x, s.y, 8, 4, '#ffe0a0'); ctx.globalAlpha = 1; }
  const x = s.x, y = s.y;
  if (!on) {
    if (Math.floor(t * 8) % 3 === 0) { ctx.fillStyle = '#ff8a40'; ctx.fillRect(x, y - 9, 1, 2); }
    return;
  }
  for (let i = 0; i < 9; i++) {
    const fx = x - 3 + ((i * 7 + Math.floor(t * 30)) % 7), fh = 3 + ((i * 13 + Math.floor(t * 25)) % 8);
    ctx.fillStyle = i % 3 === 0 ? '#fff4c0' : i % 3 === 1 ? '#ffb030' : '#ff3020';
    ctx.fillRect(fx, y - 7 - fh, 1 + (i % 2), fh);
  }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 9, 3, 2);
});

spriteOverlay('derby_cornerFlag', (ctx, ax, ay, p, t) => {
  const top = proj(ax, ay, 0.5, 0.5, 1.7);
  for (let i = 0; i < 9; i++) {
    const w = Math.round(Math.sin(t * 6 + i * 0.6) * i / 9 * 2);
    for (let j = 0; j < 6; j++) { ctx.fillStyle = (Math.floor(i / 3) + Math.floor(j / 3)) % 2 ? '#c8102e' : '#ffd23a'; ctx.fillRect(top.x + 1 + i, top.y + j + w, 1, 1); }
  }
});

// dugout: the sprite has red seats; other seat colours are painted over them (seen through the perspex)
spriteOverlay('derby_dugout', (ctx, ax, ay, p) => {
  if (p.o.seat && p.o.seat !== RED) {
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 6; i++) {
      isoBox(ctx, ax, ay, 0.12 + i * 0.47, 0.2, 0.35, 0.36, 0.3, 0.08, { color: p.o.seat });
      isoBox(ctx, ax, ay, 0.12 + i * 0.47, 0.17, 0.43, 0.36, 0.06, 0.4, { color: p.o.seat });
    }
    ctx.globalAlpha = 1;
  }
  if (p.o.text) { const m = proj(ax, ay, 1.5, 0.95, 1.35); drawText(ctx, p.o.text, m.x, m.y - 3, { color: '#ffffff', align: 'center', outline: OL }); }
});

// tannoy (sprite only while idle; when switched on the procedural draw with sound waves takes over)
spriteOverlay('derby_tannoy', (ctx, ax, ay, p, t, world) => {
  const l = proj(ax, ay, 0.5, 0.7, 1.0);
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#3aff7a' : '#1a8a3a'; ctx.fillRect(l.x - 1, l.y - 1, 3, 3);
  if (world && world.player && Math.hypot(world.player.x - p.cx, world.player.y - p.cy) < 1.4) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    drawText(ctx, 'E', b.x, b.y - 30 + Math.round(Math.sin(t * 6)), { color: '#ffe14a', align: 'center', outline: '#000' });
  }
});

spriteOverlay('derby_merchBox', (ctx, ax, ay) => {
  const m = proj(ax, ay, 0.5, 0.9, 0.35);
  drawText(ctx, 'NAFC', m.x - 9, m.y - 3, { color: RED });
  const m2 = proj(ax, ay, 0.5, 0.84, 1.0);
  drawText(ctx, 'X', m2.x - 2, m2.y - 3, { color: '#1a1a1a' });
});

// ---- floor decals: re-paint absolute-position features over the Blender patch
function repaintTile(g, sx, sy, tx, ty, pixel, test) {
  const K = FLOOR_SCALE;
  for (let py = 0; py < 2 * HALF_H * K; py++) {
    for (let q = -HALF_W * K; q < HALF_W * K; q++) {
      const a = ((q + 0.5) / K) / HALF_W, b = ((py + 0.5) / K) / HALF_H;
      const u = (a + b) / 2, v = (b - a) / 2;
      if (u < 0 || v < 0 || u >= 1 || v >= 1) continue;
      const c = test(tx + u, ty + v, u, v);
      if (!c) continue;
      g.fillStyle = c; g.fillRect(sx + q / K, sy + py / K, 1 / K, 1 / K);
    }
  }
}
function pitchNear(tx, ty) {
  const P = PITCH, X = tx + 0.5, Y = ty + 0.5, r = 0.8;
  const segs = [[P.x0, P.y0, P.x1, P.y0], [P.x0, P.y0, P.x0, 999], [P.x1, P.y0, P.x1, 999],
    [P.pbx0, P.y0, P.pbx0, P.pby1], [P.pbx1, P.y0, P.pbx1, P.pby1], [P.pbx0, P.pby1, P.pbx1, P.pby1],
    [P.sbx0, P.y0, P.sbx0, P.sby1], [P.sbx1, P.y0, P.sbx1, P.sby1], [P.sbx0, P.sby1, P.sbx1, P.sby1]];
  for (const [x0, y0, x1, y1] of segs) {
    const cx = Math.max(Math.min(x0, x1), Math.min(X, Math.max(x0, x1))), cy = Math.max(Math.min(y0, y1), Math.min(Y, Math.max(y0, y1)));
    if (Math.hypot(X - cx, Y - cy) < r) return true;
  }
  for (const [cx, cy, R] of [[P.spotX, P.spotY, P.arcR], [P.spotX, P.spotY, 0], [P.x0, P.y0, 1], [P.x1, P.y0, 1], [P.ccX, P.ccY, P.ccR]]) {
    if (Math.abs(Math.hypot(X - cx, Y - cy) - R) < r + 0.1) return true;
  }
  return Math.hypot((X - P.spotX) * 0.8, (Y - (P.y0 + 2)) * 1.3) < 4;
}
if (FLOORS.derby_pitch) FLOORS.derby_pitch.decal = function (g, sx, sy, tx, ty) {
  if (!pitchNear(tx, ty)) return;
  const pixel = this.pixel, P = PITCH;
  repaintTile(g, sx, sy, tx, ty, pixel, (X, Y, u, v) => {
    const c = pixel(u, v, tx, ty);
    if (c === '#eef2e6') return c;
    const dg = Math.hypot((X - P.spotX) * 0.8, (Y - (P.y0 + 2)) * 1.3);
    return dg < 3.2 && n2(X * 32, Y * 32, 46) < 0.75 - dg * 0.18 ? c : null;
  });
};
if (FLOORS.derby_tunnel) FLOORS.derby_tunnel.decal = function (g, sx, sy, tx, ty) {
  if (!((ty >= 28 && ty <= 29 && tx < 50) || (tx >= 50 && tx <= 52 && ty >= 29))) return;
  const pixel = this.pixel;
  repaintTile(g, sx, sy, tx, ty, pixel, (X, Y, u, v) => (((Y > 28.1 && Y < 29.9 && X < 50) || (X > 50.6 && X < 52.4 && Y > 29.9)) && u >= 0.03 && v >= 0.03 ? pixel(u, v, tx, ty) : null));
};
