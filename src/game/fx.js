// Particles, hit sparks, impact bursts, floating score popups, ground splats.
//
// API (stable): add(p) spark(x,y,z,color,n) impact(x,y,z,heavy) block(x,y,z) dust(x,y,z,n) debris(x,y,z,colors,n)
//               glass(x,y,z) confetti(x,y,z,colors,n) popup(x,y,z,text,color,scale) update(dt) drawGround(ctx)
//               draw(ctx) drawPopups(ctx) drawStars(ctx,x,y,t) clear()
// Extra:        burst(x,y,z,color,size) sweat(x,y,z,n) splat(x,y,color,size) smoke(x,y,z,color,n,opts) flare(x,y,z,color)
//               shockwave(x,y,z,color) shards(x,y,z,colors,n) coins(x,y,z,n) streaks(x,y,z,color,n) landDust(x,y,z)
// Particle kinds: 'px' (default square), 'flash', 'ring', 'puff', 'burst', 'streak', 'drop', 'shard', 'confetti', 'smoke',
//                 'wave' (ground ring), 'coin'.
// World units: x,y tiles, z height units; velocities per second.
import { toScreen } from '../engine/iso.js';
import { drawText } from '../engine/font.js';
import { GRAVITY } from '../engine/constants.js';
import { fillPoly } from '../engine/gfx.js';

const R = Math.random;
const SPLAT_LIFE = 12; // seconds a ground splat stays (fades over the last 4)

export class FX {
  constructor() {
    this.parts = [];
    this.popups = [];
    this.splats = [];   // ground decals (fade slowly)
  }

  clear() { this.parts.length = 0; this.popups.length = 0; this.splats.length = 0; }

  add(p) {
    if (this.parts.length > 700) this.parts.shift();
    const o = { life: 0.6, t: 0, vx: 0, vy: 0, vz: 0, g: 1, size: 1, kind: 'px', ...p };
    this.parts.push(o);
    return o;
  }

  // ---------------------------------------------------------------- emitters
  spark(x, y, z, color = '#fff6a0', n = 8) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 2 + R() * 4;
      this.add({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (R() * 2 - 0.4) * 4, life: 0.14 + R() * 0.16, color, g: 0.3, size: R() < 0.3 ? 2 : 1, kind: 'streak' });
    }
    this.add({ x, y, z, kind: 'flash', life: 0.08, size: 7, color: '#ffffff', g: 0 });
  }

  burst(x, y, z, color = '#ffffff', size = 9) {
    this.add({ x, y, z, kind: 'burst', life: 0.14, size, color, g: 0, rot: R() * Math.PI });
  }

  streaks(x, y, z, color = '#ffffff', n = 6) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 4 + R() * 4;
      this.add({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (R() - 0.3) * 6, life: 0.1 + R() * 0.08, color, g: 0, kind: 'streak', size: 1 });
    }
  }

  impact(x, y, z, heavy = false) {
    this.burst(x, y, z, heavy ? '#fff2a0' : '#ffffff', heavy ? 13 : 8);
    this.spark(x, y, z, heavy ? '#ffd23a' : '#fff6a0', heavy ? 12 : 6);
    if (heavy) {
      this.add({ x, y, z, kind: 'ring', life: 0.2, size: 3, color: '#ffffff', g: 0 });
      this.streaks(x, y, z, '#ffffff', 5);
    }
    this.sweat(x, y, z, heavy ? 4 : 2);
    // cartoon claret: a couple of small red drops that leave tiny splats (no gore)
    const nd = heavy ? (R() < 0.5 ? 2 : 1) : (R() < 0.25 ? 1 : 0);
    for (let i = 0; i < nd; i++) {
      this.add({ x, y, z, vx: (R() - 0.5) * 3.5, vy: (R() - 0.5) * 3.5, vz: 2 + R() * 3, life: 0.8, color: R() < 0.5 ? '#b81818' : '#8a1010', g: 1, size: 1, kind: 'drop', splat: true });
    }
  }

  sweat(x, y, z, n = 3) {
    for (let i = 0; i < n; i++) {
      this.add({ x, y, z: z + 0.2, vx: (R() - 0.5) * 3, vy: (R() - 0.5) * 3, vz: 2.5 + R() * 3, life: 0.5 + R() * 0.2, color: R() < 0.5 ? '#dfe8ff' : '#a8c8f0', g: 1, size: 1, kind: 'drop' });
    }
  }

  block(x, y, z) {
    this.add({ x, y, z, kind: 'ring', life: 0.14, size: 2, color: '#8ad8ff', g: 0 });
    this.spark(x, y, z, '#8ad8ff', 6);
  }

  dust(x, y, z, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 0.6 + R() * 1.4;
      this.add({ x, y, z: z + 0.05, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0.3 + R(), life: 0.45 + R() * 0.35, color: R() < 0.5 ? '#9a9184' : '#b8b0a2', kind: 'puff', size: 2 + R() * 2.5, g: 0.12, drag: 2.5 });
    }
  }

  landDust(x, y, z) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.add({ x, y, z: z + 0.02, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2, vz: 0.2, life: 0.35, color: '#a49c8e', kind: 'puff', size: 2, g: 0, drag: 4 });
    }
  }

  shockwave(x, y, z = 0, color = '#e8e0c8') {
    this.add({ x, y, z, kind: 'wave', life: 0.35, size: 1, color, g: 0 });
    this.dust(x, y, z, 8);
  }

  debris(x, y, z, colors = ['#7a5a3a', '#5a3f28'], n = 10) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 1 + R() * 3.5;
      this.add({ x, y, z: z + 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 2 + R() * 5, life: 0.9 + R() * 0.6, color: colors[i % colors.length], size: R() < 0.5 ? 2 : 1, g: 1, bounce: true, kind: 'shard', spin: R() * 10 });
    }
    this.dust(x, y, z, 3);
  }

  shards(x, y, z, colors = ['#bfe8d0', '#86c9a6', '#ffffff'], n = 14) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 1.5 + R() * 4;
      this.add({ x, y, z: z + 0.2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 2 + R() * 5, life: 1.0 + R() * 0.6, color: colors[i % colors.length], size: 1, g: 1, bounce: true, kind: 'shard', glint: true, spin: R() * 10, decal: R() < 0.35 });
    }
  }

  glass(x, y, z) {
    this.shards(x, y, z, ['#bfe8d0', '#86c9a6', '#ffffff', '#5a9a7a'], 16);
    this.add({ x, y, z, kind: 'flash', life: 0.06, size: 5, color: '#e8fff0', g: 0 });
  }

  confetti(x, y, z, colors, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = 0.5 + R() * 2.4;
      this.add({ x, y, z: z + 1, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 3 + R() * 5, life: 1.6 + R() * 0.8, color: colors[i % colors.length], size: 2, g: 0.3, kind: 'confetti', drag: 1.2, ph: R() * 6 });
    }
  }

  coins(x, y, z, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2;
      this.add({ x, y, z: z + 0.6, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, vz: 4 + R() * 2, life: 0.7, color: '#e8c040', g: 1, kind: 'coin', bounce: true, ph: R() * 6 });
    }
  }

  // drifting smoke puffs (flares, fires, exhausts). opts: { rise, spread, life, size }
  smoke(x, y, z, color = '#8a8490', n = 3, opts = {}) {
    for (let i = 0; i < n; i++) {
      const sp = opts.spread ?? 0.5;
      this.add({ x: x + (R() - 0.5) * 0.2, y: y + (R() - 0.5) * 0.2, z, vx: (R() - 0.5) * sp + (opts.wind || 0), vy: (R() - 0.5) * sp, vz: (opts.rise ?? 1.0) * (0.6 + R() * 0.6), life: (opts.life ?? 1.6) * (0.7 + R() * 0.6), color, kind: 'smoke', size: (opts.size ?? 3) * (0.8 + R() * 0.5), g: 0, drag: 0.6 });
    }
  }

  // a burning flare: bright core sparks + coloured smoke (call every few frames while it burns)
  flare(x, y, z = 0.2, color = '#ff3a2a') {
    this.add({ x, y, z, kind: 'flash', life: 0.05, size: 3, color: '#fff0c0', g: 0 });
    for (let i = 0; i < 2; i++) this.add({ x, y, z, vx: (R() - 0.5) * 2, vy: (R() - 0.5) * 2, vz: 1 + R() * 2, life: 0.25, color: R() < 0.5 ? '#ffe080' : '#ff8a40', g: 0.5, kind: 'px' });
    this.smoke(x, y, z + 0.2, color, 1, { rise: 1.3, size: 3.5, life: 2.2, wind: 0.2 });
  }

  splat(x, y, color = '#9a1414', size = 1) {
    this.splats.push({ x, y, color, t: 0, s: size, v: Math.floor(R() * 4) });
    if (this.splats.length > 120) this.splats.shift();
  }

  popup(x, y, z, text, color = '#ffe14a', scale = 1) {
    this.popups.push({ x, y, z: z + 2.4, text, color, t: 0, life: 0.9, scale });
  }

  // ---------------------------------------------------------------- simulation
  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; if (p.kind === 'confetti') p.vz = Math.max(p.vz, -1.2); }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.g) { p.vz -= GRAVITY * p.g * dt; }
      p.z += p.vz * dt;
      if (p.z < 0) {
        if (p.splat) { this.splat(p.x, p.y, p.color, 1); p.t = p.life; }
        else if (p.bounce && p.vz < -1) {
          p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6;
          if (p.decal && R() < 0.5) { this.splats.push({ x: p.x, y: p.y, color: '#c8e8d8', t: 2, s: 0, v: 0 }); p.decal = false; }
        } else { p.z = 0; p.vz = 0; p.vx *= 0.85; p.vy *= 0.85; }
      }
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const s of this.popups) s.t += dt;
    this.popups = this.popups.filter(s => s.t < s.life);
    for (const s of this.splats) s.t += dt;
    this.splats = this.splats.filter(s => s.t < SPLAT_LIFE);
  }

  // ---------------------------------------------------------------- drawing
  drawGround(ctx) {
    const a0 = ctx.globalAlpha;
    for (const s of this.splats) {
      const p = toScreen(s.x, s.y, 0);
      ctx.globalAlpha = a0 * Math.max(0, Math.min(0.7, (SPLAT_LIFE - s.t) / 4));
      ctx.fillStyle = s.color;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (!s.s) { ctx.fillRect(x, y, 1, 1); continue; }
      // small irregular splat shapes (2-5 px)
      switch (s.v) {
        case 0: ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 1, y + 1, 1, 1); break;
        case 1: ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x + 2, y - 1, 1, 1); break;
        case 2: ctx.fillRect(x, y, 2, 1); ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 2, y + 1, 1, 1); break;
        default: ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1);
      }
    }
    ctx.globalAlpha = a0;
  }

  draw(ctx) {
    const a0 = ctx.globalAlpha;
    for (const p of this.parts) {
      const s = toScreen(p.x, p.y, p.z);
      const k = 1 - p.t / p.life;
      const x = Math.round(s.x), y = Math.round(s.y);
      switch (p.kind) {
        case 'flash': {
          ctx.fillStyle = p.color;
          const r = Math.round(p.size * (0.5 + k));
          ctx.fillRect(x - r, y - 1, r * 2, 2);
          ctx.fillRect(x - 1, y - r, 2, r * 2);
          ctx.fillRect(x - 2, y - 2, 4, 4);
          break;
        }
        case 'burst': { // comic impact star: hard-edged spikes around a hot core
          const r = p.size * (0.6 + (1 - k) * 0.7), ri = Math.max(2, r * 0.4);
          const c = k > 0.5 ? p.color : '#ffd23a';
          for (let i = 0; i < 8; i++) {
            const a = p.rot + (i / 8) * Math.PI * 2, rr = r * (i % 2 ? 0.7 : 1);
            const a1 = a - 0.32, a2 = a + 0.32;
            fillPoly(ctx, [{ x: x + Math.cos(a1) * ri, y: y + Math.sin(a1) * ri * 0.85 }, { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.85 }, { x: x + Math.cos(a2) * ri, y: y + Math.sin(a2) * ri * 0.85 }, { x, y }], c);
          }
          ctx.fillStyle = c; ctx.fillRect(Math.round(x - ri), Math.round(y - ri * 0.8), Math.round(ri * 2), Math.round(ri * 1.6));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 2, y - 2, 4, 4);
          break;
        }
        case 'ring': {
          ctx.strokeStyle = p.color; ctx.globalAlpha = a0 * k;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, 3 + (1 - k) * 14, 2 + (1 - k) * 7, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = a0;
          break;
        }
        case 'wave': {
          ctx.strokeStyle = p.color; ctx.globalAlpha = a0 * k * 0.8;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(s.x, s.y, 4 + (1 - k) * 30, 2 + (1 - k) * 15, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = a0;
          break;
        }
        case 'puff': {
          ctx.globalAlpha = a0 * k * 0.55; ctx.fillStyle = p.color;
          const r = Math.max(1, Math.round(p.size * (1.6 - k * 0.6)));
          ctx.fillRect(x - r, y - Math.round(r / 2), r * 2, r);
          ctx.fillRect(x - Math.round(r / 2), y - r, r, r * 2 - 1);
          ctx.globalAlpha = a0;
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = a0 * Math.min(1, p.t * 4) * k * 0.45; ctx.fillStyle = p.color;
          const r = Math.max(2, Math.round(p.size * (1 + (1 - k) * 1.6)));
          ctx.fillRect(x - r, y - Math.round(r * 0.7), r * 2, Math.round(r * 1.4));
          ctx.fillRect(x - Math.round(r * 0.7), y - r, Math.round(r * 1.4), r * 2);
          ctx.globalAlpha = a0;
          break;
        }
        case 'streak': {
          ctx.fillStyle = p.color;
          const sx2 = (p.vx - p.vy) * 16 * 0.025, sy2 = ((p.vx + p.vy) * 8 - p.vz * 20) * 0.025;
          const n = 3;
          for (let i = 0; i < n; i++) ctx.fillRect(Math.round(x - sx2 * i), Math.round(y - sy2 * i), p.size, p.size);
          break;
        }
        case 'drop': {
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, 1, p.vz > 0 ? 1 : 2);
          break;
        }
        case 'shard': {
          const sp = Math.floor(p.t * 20 + p.spin) % 3;
          ctx.fillStyle = p.glint && sp === 0 ? '#ffffff' : p.color;
          if (sp === 0) ctx.fillRect(x, y, p.size + 1, p.size);
          else if (sp === 1) ctx.fillRect(x, y, p.size, p.size + 1);
          else ctx.fillRect(x, y, p.size, p.size);
          break;
        }
        case 'confetti': {
          const w = Math.sin(p.t * 9 + p.ph) > 0 ? 2 : 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(x + Math.sin(p.t * 5 + p.ph) * 2), y, w, 3 - w);
          break;
        }
        case 'coin': {
          const w = Math.max(1, Math.round(Math.abs(Math.cos(p.t * 12 + p.ph)) * 3));
          ctx.fillStyle = '#7a5a10'; ctx.fillRect(x - w, y - 3, w * 2, 5);
          ctx.fillStyle = p.color; ctx.fillRect(x - w + 1, y - 2, Math.max(1, w * 2 - 2), 3);
          break;
        }
        default:
          ctx.fillStyle = p.color;
          ctx.fillRect(x, y, p.size, p.size);
      }
    }
    ctx.globalAlpha = a0;
  }

  drawPopups(ctx) {
    const a0 = ctx.globalAlpha;
    for (const p of this.popups) {
      const rise = p.t < 0.12 ? p.t * 8 : 0.96 + (p.t - 0.12) * 0.6; // pop up quickly, then drift
      const s = toScreen(p.x, p.y, p.z + rise * 0.9);
      const a = p.t > p.life * 0.6 ? 1 - (p.t - p.life * 0.6) / (p.life * 0.4) : 1;
      ctx.globalAlpha = a0 * Math.max(0, a);
      drawText(ctx, p.text, Math.round(s.x), Math.round(s.y), { color: p.color, align: 'center', outline: '#000', scale: p.scale });
    }
    ctx.globalAlpha = a0;
  }

  // circling dizzy stars + tweeting birds
  drawStars(ctx, x, y, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.1;
      const px = Math.round(x + Math.cos(a) * 8), py = Math.round(y + Math.sin(a) * 2.5);
      const front = Math.sin(a) > 0;
      ctx.fillStyle = '#120c14';
      ctx.fillRect(px - 2, py - 1, 5, 3); ctx.fillRect(px - 1, py - 2, 3, 5);
      ctx.fillStyle = i % 2 ? '#ffe14a' : (front ? '#ffffff' : '#c8c8d8');
      ctx.fillRect(px, py - 1, 1, 3);
      ctx.fillRect(px - 1, py, 3, 1);
    }
  }
}
