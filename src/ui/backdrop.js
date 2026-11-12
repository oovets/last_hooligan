// Animated title/menu backdrop: Nordhamn by night, seen from the home terrace.
// Static layers (sky, skyline, far stand, pitch) are pre-rendered once; the crowd, floodlight glare,
// flares, smoke, flags and the lads in front are animated.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { makeCanvas } from '../engine/gfx.js';
import { drawText } from '../engine/font.js';
import { makeRng } from '../engine/rng.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim } from '../game/poses.js';
import { buildLook } from '../content/wardrobe.js';
import { casualLook } from '../content/enemies.js';
import { save } from '../save.js';

const RED = '#c8102e', WHITE = '#f4f1e8';
const HORIZON = 132;      // top of the far stand roof
const STAND_TOP = 140, STAND_BOT = 198, BOARDS = 200, PITCH_TOP = 211, PITCH_BOT = 292;

function buildStatic() {
  const c = makeCanvas(VIEW_W, VIEW_H);
  const g = c.getContext('2d');
  const rng = makeRng(1986);
  // sky
  const sky = g.createLinearGradient(0, 0, 0, PITCH_TOP);
  sky.addColorStop(0, '#03020a'); sky.addColorStop(0.45, '#120826'); sky.addColorStop(0.8, '#2e0c30'); sky.addColorStop(1, '#4a1030');
  g.fillStyle = sky; g.fillRect(0, 0, VIEW_W, PITCH_TOP);
  // dithered horizon glow bands (pixel-art banding)
  for (let y = 70; y < HORIZON; y++) for (let x = (y & 1); x < VIEW_W; x += 2) if (rng() < (y - 70) / 140) { g.fillStyle = 'rgba(120,30,70,0.25)'; g.fillRect(x, y, 1, 1); }
  // stars
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(rng() * VIEW_W), y = Math.floor(rng() * 110);
    g.fillStyle = rng() < 0.15 ? '#fff8e0' : rng() < 0.5 ? '#8a80b0' : '#4a4070';
    g.fillRect(x, y, 1, 1);
  }
  // moon behind clouds
  g.fillStyle = '#e8e0c8'; for (let y = -7; y <= 7; y++) { const w = Math.round(Math.sqrt(49 - y * y)); g.fillRect(520 - w, 34 + y, w * 2, 1); }
  g.fillStyle = '#c8c0a8'; g.fillRect(516, 30, 3, 2); g.fillRect(523, 37, 2, 2);
  g.fillStyle = '#2a1840'; for (let y = -7; y <= 7; y++) { const w = Math.round(Math.sqrt(49 - y * y)); g.fillRect(525 - w, 32 + y, w * 2, 1); }
  // clouds (flat pixel bands)
  for (let k = 0; k < 9; k++) {
    const cx = rng() * VIEW_W, cy = 20 + rng() * 70, w = 60 + rng() * 90;
    g.fillStyle = 'rgba(70,40,90,0.35)'; g.fillRect(Math.round(cx), Math.round(cy), Math.round(w), 3);
    g.fillStyle = 'rgba(90,50,110,0.25)'; g.fillRect(Math.round(cx + 10), Math.round(cy - 2), Math.round(w * 0.6), 2);
  }
  // city skyline (Nordhamn docks): cranes, church spire, tower blocks, terraces
  const sil = '#0b0614';
  g.fillStyle = sil;
  let x = 0;
  while (x < VIEW_W) {
    const w = 14 + Math.floor(rng() * 26), h = 10 + Math.floor(rng() * 30);
    g.fillRect(x, HORIZON - h, w, h + 10);
    for (let wy = HORIZON - h + 3; wy < HORIZON; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rng() < 0.18) { g.fillStyle = rng() < 0.8 ? '#e8c060' : '#80a0e0'; g.fillRect(wx, wy, 2, 2); g.fillStyle = sil; }
    x += w;
  }
  // tower block
  g.fillStyle = sil; g.fillRect(118, HORIZON - 62, 26, 62);
  for (let wy = HORIZON - 58; wy < HORIZON - 4; wy += 5) for (let wx = 121; wx < 141; wx += 5) if (rng() < 0.3) { g.fillStyle = '#e0b850'; g.fillRect(wx, wy, 2, 2); g.fillStyle = sil; }
  // church spire
  g.fillStyle = sil; g.fillRect(452, HORIZON - 40, 12, 40); g.beginPath(); g.moveTo(452, HORIZON - 40); g.lineTo(458, HORIZON - 74); g.lineTo(464, HORIZON - 40); g.fill();
  g.fillRect(457, HORIZON - 80, 2, 8); g.fillRect(455, HORIZON - 77, 6, 2);
  g.fillStyle = '#ffe8a0'; g.fillRect(456, HORIZON - 34, 4, 4);
  // harbour cranes
  for (const cx of [24, 588]) {
    g.fillStyle = sil;
    g.fillRect(cx, HORIZON - 70, 4, 70);
    g.fillRect(cx - 22, HORIZON - 72, 50, 3);
    for (let k = 0; k < 8; k++) g.fillRect(cx - 20 + k * 6, HORIZON - 70, 1, 4);
    g.fillRect(cx + 20, HORIZON - 69, 1, 26); g.fillRect(cx + 17, HORIZON - 44, 7, 4);
    g.fillStyle = '#ff3a3a'; g.fillRect(cx + 1, HORIZON - 74, 2, 2);
  }

  // ---- far stand
  // roof slab with trusses
  g.fillStyle = '#151020'; g.fillRect(40, HORIZON - 4, VIEW_W - 80, 10);
  g.fillStyle = '#2a2238'; g.fillRect(40, HORIZON - 4, VIEW_W - 80, 1);
  g.fillStyle = '#3a3048'; for (let k = 44; k < VIEW_W - 44; k += 12) { g.fillRect(k, HORIZON - 3, 1, 8); g.fillRect(k, HORIZON + 1, 6, 1); }
  g.fillStyle = WHITE; g.fillRect(40, HORIZON + 6, VIEW_W - 80, 1);
  g.fillStyle = '#8a8098'; g.fillRect(40, HORIZON + 7, VIEW_W - 80, 1);
  // under-roof darkness
  const st = g.createLinearGradient(0, STAND_TOP - 4, 0, STAND_BOT);
  st.addColorStop(0, '#07050c'); st.addColorStop(1, '#1e1626');
  g.fillStyle = st; g.fillRect(40, STAND_TOP - 4, VIEW_W - 80, STAND_BOT - STAND_TOP + 4);
  // stand ends (wings)
  g.fillStyle = '#100c18';
  g.beginPath(); g.moveTo(0, STAND_TOP + 10); g.lineTo(40, HORIZON - 4); g.lineTo(40, BOARDS); g.lineTo(0, BOARDS + 4); g.fill();
  g.beginPath(); g.moveTo(VIEW_W, STAND_TOP + 10); g.lineTo(VIEW_W - 40, HORIZON - 4); g.lineTo(VIEW_W - 40, BOARDS); g.lineTo(VIEW_W, BOARDS + 4); g.fill();
  // roof supports
  g.fillStyle = '#2a2238'; for (const sx of [120, 240, 400, 520]) g.fillRect(sx, STAND_TOP, 2, STAND_BOT - STAND_TOP);
  // advertising boards (fictional local businesses)
  const ads = [['HAMNÖL LAGER', '#c8102e', '#fff'], ['NORDHAMN FERRIES', '#1a3a6a', '#f0f0f0'], ['SILLEN FISH BAR', '#f4f1e8', '#1a1a1a'], ['DOCKSIDE MOTORS', '#2a2a2a', '#ffd23a'], ['KAFFE KRONA', '#5a2a10', '#f4e0b0'], ['ANCHOR BOOKMAKERS', '#c8102e', '#f4f1e8']];
  let bx = 0, ai = 0;
  while (bx < VIEW_W) {
    const [txt, bg, fg] = ads[ai % ads.length];
    const w = txt.length * 6 + 18;
    g.fillStyle = '#000'; g.fillRect(bx, BOARDS - 1, w, 12);
    g.fillStyle = bg; g.fillRect(bx + 1, BOARDS, w - 2, 10);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(bx + 1, BOARDS, w - 2, 1);
    drawText(g, txt, bx + 9, BOARDS + 2, { color: fg });
    bx += w; ai++;
  }
  // ---- pitch
  for (let y = PITCH_TOP; y < PITCH_BOT + 40; y++) {
    const f = (y - PITCH_TOP) / (PITCH_BOT - PITCH_TOP);
    const band = Math.floor(Math.pow(f, 0.7) * 9) % 2;
    g.fillStyle = band ? '#1f5a26' : '#2a6e30';
    g.fillRect(0, y, VIEW_W, 1);
  }
  g.fillStyle = 'rgba(240,250,240,0.85)';
  g.fillRect(0, PITCH_TOP + 2, VIEW_W, 1);                                   // far touchline
  g.fillRect(318, PITCH_TOP + 2, 2, PITCH_BOT - PITCH_TOP);                   // halfway line
  for (let a = 0; a < Math.PI * 2; a += 0.01) g.fillRect(Math.round(320 + Math.cos(a) * 78), Math.round(250 + Math.sin(a) * 17), 2, 1);
  g.fillRect(318, 249, 3, 2);
  // penalty boxes at the sides (perspective-ish)
  g.fillRect(0, PITCH_TOP + 22, 70, 1); g.fillRect(70, PITCH_TOP + 22, 1, 50); g.fillRect(0, PITCH_TOP + 72, 72, 1);
  g.fillRect(VIEW_W - 70, PITCH_TOP + 22, 70, 1); g.fillRect(VIEW_W - 71, PITCH_TOP + 22, 1, 50); g.fillRect(VIEW_W - 72, PITCH_TOP + 72, 72, 1);
  // floodlit pools
  for (const [px, py] of [[160, 240], [480, 240], [320, 270]]) {
    const rg = g.createRadialGradient(px, py, 0, px, py, 150);
    rg.addColorStop(0, 'rgba(230,255,200,0.16)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(px - 150, PITCH_TOP, 300, PITCH_BOT - PITCH_TOP + 40);
  }
  return c;
}

function buildGlow(r, col) {
  const c = makeCanvas(r * 2, r * 2);
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(r, r, 0, r, r, r);
  rg.addColorStop(0, col); rg.addColorStop(0.25, col.replace(/[\d.]+\)$/, '0.35)')); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

function buildBeam(len, spread, dir) {
  const w = spread * 2 + 20, h = len;
  const c = makeCanvas(w + Math.abs(dir) * len, h);
  const g = c.getContext('2d');
  const ox = dir < 0 ? Math.abs(dir) * len : 0;
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, 'rgba(255,250,220,0.22)'); lg.addColorStop(1, 'rgba(255,250,220,0)');
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(ox + w / 2 - 8, 0); g.lineTo(ox + w / 2 + 8, 0);
  g.lineTo(ox + w / 2 + spread + dir * len, h); g.lineTo(ox + w / 2 - spread + dir * len, h);
  g.closePath(); g.fill();
  return { c, ox: ox + w / 2 };
}

// dithered smoke puff sprites
function buildPuff(r) {
  const c = makeCanvas(r * 2 + 2, r * 2 + 2);
  const g = c.getContext('2d');
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y) / r;
    if (d > 1) continue;
    if (d > 0.7 && ((x + y) & 1)) continue;
    g.fillStyle = d < 0.5 ? '#b89aa8' : '#806878';
    g.fillRect(x + r + 1, y + r + 1, 1, 1);
  }
  return c;
}

export class Backdrop {
  constructor() {
    this.t = 0;
    this.ready = false;
    this.smoke = [];
    this.sparks = [];
    const rng = makeRng(42);
    // far crowd: tiers of tiny supporters
    this.far = [];
    for (let row = 0; row < 9; row++) {
      const y = STAND_TOP + 3 + row * 6;
      for (let x = 44 + (row % 2) * 2; x < VIEW_W - 44; x += 4) {
        if (rng() < 0.08) continue;
        const r = rng();
        this.far.push({ x, y, c: r < 0.5 ? RED : r < 0.8 ? WHITE : r < 0.9 ? '#3a2a3a' : '#8a1020', ph: x * 0.07 + row * 0.6 + rng(), scarf: rng() < 0.18 });
      }
    }
    // near terrace crowd (backs of heads, arms, held scarves)
    this.near = [];
    for (let row = 0; row < 4; row++) {
      const y = 300 + row * 16;
      for (let x = -10 + (row % 2) * 9; x < VIEW_W + 10; x += 17 + Math.floor(rng() * 6)) {
        const r = rng();
        this.near.push({ x, y: y + Math.floor(rng() * 4), row, ph: rng() * 6, kind: r < 0.14 ? 'scarf' : r < 0.36 ? 'arms' : 'still', c: rng() < 0.4 ? '#160e16' : rng() < 0.5 ? '#100e18' : '#22090e', hair: rng() < 0.5 ? '#0a0608' : '#1e140c' });
      }
    }
    this.near.sort((a, b) => a.y - b.y);
    this.flares = [{ x: 96, y: 306 }, { x: 352, y: 312 }, { x: 556, y: 304 }];
    this.flags = [{ x: 200, y: 262, w: 46, h: 28, ph: 0 }, { x: 466, y: 266, w: 40, h: 24, ph: 2 }];
    this.refreshLook();
  }

  refreshLook() {
    this.lads = [0, 1, 2, 3, 4].map(i => ({
      look: i === 2 ? buildLook(save.data.outfit) : casualLook(makeRng(i * 7 + 3), { a: RED, b: WHITE }),
      x: [208, 262, 320, 378, 432][i], anim: i === 2 ? 'guard' : i % 2 ? 'cheer' : 'idle', ph: i * 0.37, scale: i === 2 ? 2 : 1.6,
    }));
    this.ladDirty = true;
  }

  build() {
    this.static = buildStatic();
    this.lampGlow = buildGlow(46, 'rgba(255,250,220,0.9)');
    this.flareGlow = buildGlow(60, 'rgba(255,70,40,0.75)');
    this.beamL = buildBeam(200, 70, 0.9);
    this.beamR = buildBeam(200, 70, -0.9);
    this.puffs = [buildPuff(4), buildPuff(6), buildPuff(9), buildPuff(12)];
    this.farFrames = [];
    const NF = 10;
    for (let k = 0; k < NF; k++) {
      const c = makeCanvas(VIEW_W, BOARDS);
      const g = c.getContext('2d');
      const t = k / NF * (Math.PI * 2 / 5) * 1;   // one bounce period (sin(t*5)) sampled NF times
      for (const p of this.far) {
        const jump = Math.max(0, Math.sin(t * 5 + p.ph)) > 0.8 ? 1 : 0;
        g.fillStyle = p.c; g.fillRect(p.x, p.y - jump, 2, 3);
        g.fillStyle = '#c89878'; g.fillRect(p.x, p.y - 2 - jump, 2, 1);
        if (p.scarf && Math.sin(t * 5 + p.ph * 2) > 0) { g.fillStyle = RED; g.fillRect(p.x - 1, p.y - 4 - jump, 4, 1); g.fillStyle = WHITE; g.fillRect(p.x + 1, p.y - 4 - jump, 1, 1); }
      }
      this.farFrames.push(c);
    }
    for (const f of this.flags) f.canvas = this.buildFlag(f);
    this.ready = true;
  }

  update(dt) {
    this.t += dt;
    if (!this.ready) return;
    for (const f of this.flares) {
      if (Math.random() < dt * 14) this.smoke.push({ x: f.x + (Math.random() - 0.5) * 4, y: f.y - 6, vx: 6 + Math.random() * 10, vy: -14 - Math.random() * 10, life: 0, max: 3 + Math.random() * 2 });
      if (Math.random() < dt * 30) this.sparks.push({ x: f.x, y: f.y - 4, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, life: 0, max: 0.4 + Math.random() * 0.3 });
    }
    for (const s of this.smoke) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 0.995; s.vx += dt * 3; }
    this.smoke = this.smoke.filter(s => s.life < s.max).slice(-140);
    for (const s of this.sparks) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 120 * dt; }
    this.sparks = this.sparks.filter(s => s.life < s.max);
  }

  draw(ctx, opts = {}) {
    if (opts === false || opts === true) opts = { lads: opts };
    if (!this.ready) this.build();
    const t = this.t;
    ctx.drawImage(this.static, 0, 0);
    // twinkling stars
    for (let i = 0; i < 18; i++) {
      const on = Math.sin(t * (1.3 + i * 0.17) + i * 2.1) > 0.6;
      if (!on) continue;
      const x = (i * 97 + 31) % VIEW_W, y = (i * 53 + 7) % 100;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
    // far crowd: cached bounce frames + a live scarf wave rolling along the stand
    const fi = Math.floor(t * 8) % this.farFrames.length;
    ctx.drawImage(this.farFrames[fi], 0, 0);
    const wave = (t * 120) % (VIEW_W + 200) - 100;
    for (const p of this.far) {
      if (Math.abs(p.x - wave) >= 30) continue;
      ctx.fillStyle = '#1e1626'; ctx.fillRect(p.x - 1, p.y - 5, 4, 8);
      ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y - 2, 2, 3);
      ctx.fillStyle = '#c89878'; ctx.fillRect(p.x, p.y - 4, 2, 1);
      ctx.fillStyle = RED; ctx.fillRect(p.x - 1, p.y - 6, 4, 1); ctx.fillStyle = WHITE; ctx.fillRect(p.x + 1, p.y - 6, 1, 1);
    }
    // floodlight pylons
    for (const [fx, dir] of [[64, 1], [VIEW_W - 64, -1]]) {
      ctx.fillStyle = '#0a0812';
      ctx.fillRect(fx - 3, 46, 6, 250);
      for (let y = 50; y < 296; y += 10) { ctx.fillRect(fx - 6, y, 12, 1); }
      ctx.fillStyle = '#1a1626'; for (let y = 50; y < 296; y += 10) { ctx.fillRect(fx - 5 + ((y / 10) % 2) * 5, y, 5, 10); }
      ctx.fillStyle = '#0a0812'; ctx.fillRect(fx - 16, 24, 32, 22);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const flick = (Math.floor(t * 4 + r * 3 + c * 7) % 23) === 0;
        ctx.fillStyle = flick ? '#a09870' : '#fffbe0';
        ctx.fillRect(fx - 14 + c * 6, 26 + r * 6, 5, 5);
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const beam = dir > 0 ? this.beamL : this.beamR;
      ctx.globalAlpha = 0.85 + Math.sin(t * 0.7 + fx) * 0.1;
      ctx.drawImage(beam.c, Math.round(fx - beam.ox), 40);
      ctx.globalAlpha = 1;
      ctx.drawImage(this.lampGlow, fx - 46, 36 - 46 + 6);
      ctx.restore();
      // lens flare streak
      ctx.fillStyle = 'rgba(255,255,230,0.5)'; ctx.fillRect(fx - 40, 35, 80, 1);
    }
    // flags on the near terrace
    for (const f of this.flags) this.drawFlag(ctx, f, t);
    // perimeter fence
    ctx.fillStyle = 'rgba(20,16,28,0.9)'; ctx.fillRect(0, PITCH_BOT - 4, VIEW_W, 3);
    ctx.fillStyle = 'rgba(60,54,72,0.8)';
    for (let x = 0; x < VIEW_W; x += 6) ctx.fillRect(x, PITCH_BOT - 26, 1, 24);
    ctx.fillStyle = 'rgba(90,80,100,0.9)'; ctx.fillRect(0, PITCH_BOT - 27, VIEW_W, 2);
    // flare glow behind near crowd
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flares) { ctx.globalAlpha = 0.75 + Math.sin(t * 23 + f.x) * 0.15 + Math.sin(t * 7) * 0.1; ctx.drawImage(this.flareGlow, f.x - 60, f.y - 70); }
    ctx.restore();
    // near crowd
    for (const p of this.near) this.drawFan(ctx, p, t);
    // flares themselves + sparks
    for (const f of this.flares) {
      ctx.fillStyle = '#2a1018'; ctx.fillRect(f.x - 1, f.y - 2, 3, 12);
      ctx.fillStyle = Math.sin(t * 40 + f.x) > 0 ? '#fff6c0' : '#ffd040'; ctx.fillRect(f.x - 2, f.y - 6, 5, 4);
      ctx.fillStyle = '#ff6030'; ctx.fillRect(f.x - 1, f.y - 8, 3, 2);
    }
    for (const s of this.sparks) { ctx.fillStyle = s.life < s.max * 0.5 ? '#fff0a0' : '#ff8030'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
    // smoke
    for (const s of this.smoke) {
      const k = s.life / s.max;
      const pi = Math.min(3, Math.floor(k * 4));
      ctx.globalAlpha = (1 - k) * 0.45;
      const pc = this.puffs[pi];
      ctx.drawImage(pc, Math.round(s.x - pc.width / 2), Math.round(s.y - pc.height / 2));
    }
    ctx.globalAlpha = 1;
    // red flare tint over the terrace
    ctx.fillStyle = `rgba(160,20,30,${0.08 + Math.sin(t * 9) * 0.02})`; ctx.fillRect(0, 280, VIEW_W, 80);
    // lads in front
    if (opts.lads) {
      // the dolls are expensive: render them into a layer at 15 fps
      const LY = 200;
      if (!this.ladLayer) this.ladLayer = makeCanvas(VIEW_W, VIEW_H - LY);
      const frame = Math.floor(t * 15);
      if (frame !== this.ladFrame || this.ladDirty) {
        this.ladFrame = frame; this.ladDirty = false;
        const g = this.ladLayer.getContext('2d');
        g.clearRect(0, 0, VIEW_W, VIEW_H - LY);
        const tt = frame / 15;
        for (const l of this.lads) {
          const flip = l.x > VIEW_W / 2;
          drawDoll(g, l.x, VIEW_H - LY, l.look, sampleAnim(l.anim, tt + l.ph), { flip, time: tt, face: l.anim === 'guard' ? 'angry' : 'shout', scale: l.scale });
        }
      }
      ctx.drawImage(this.ladLayer, 0, LY);
    }
    if (opts.dim) { ctx.fillStyle = `rgba(4,2,10,${opts.dim})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }

  buildFlag(f) {
    const c = makeCanvas(f.w, f.h);
    const g = c.getContext('2d');
    for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) {
      const stripe = Math.floor(y / (f.h / 5)) % 2;
      let col = stripe ? WHITE : RED;
      // anchor emblem in the middle
      const ax = x - f.w / 2, ay = y - f.h / 2;
      if ((Math.abs(ax) < 1 && ay > -7 && ay < 7) || (ay > 5 && ay < 7 && Math.abs(ax) < 6) || (ay > 2 && ay < 6 && Math.abs(Math.abs(ax) - 6) < 1) || (Math.abs(ay + 6) < 1.5 && Math.abs(ax) < 3)) col = '#120c14';
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    return c;
  }

  drawFlag(ctx, f, t) {
    // pole
    ctx.fillStyle = '#18121e'; ctx.fillRect(f.x - 1, f.y - 4, 2, 70);
    if (!f.canvas) f.canvas = this.buildFlag(f);
    for (let x = 0; x < f.w; x++) {
      const off = Math.round(Math.sin(t * 4 + f.ph - x * 0.18) * (x / f.w) * 4);
      ctx.drawImage(f.canvas, x, 0, 1, f.h, f.x + 1 + x, f.y + off, 1, f.h);
      const shade = Math.sin(t * 4 + f.ph - x * 0.18 - 0.6) * 0.25;
      if (Math.abs(shade) > 0.05) { ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${(shade * 0.5).toFixed(2)})` : `rgba(0,0,0,${(-shade).toFixed(2)})`; ctx.fillRect(f.x + 1 + x, f.y + off, 1, f.h); }
    }
  }

  drawFan(ctx, p, t) {
    const bounce = Math.round(Math.max(0, Math.sin(t * 5.5 + p.ph)) * 3);
    const y = p.y - bounce;
    const lit = p.row === 0 ? 0.2 : 0;
    // shoulders / back
    ctx.fillStyle = '#05030a'; ctx.fillRect(p.x - 8, y - 1, 18, 30);
    ctx.fillStyle = p.c; ctx.fillRect(p.x - 7, y, 16, 30);
    ctx.fillStyle = `rgba(255,80,60,${0.25 + lit})`; ctx.fillRect(p.x - 7, y, 16, 1);
    // head (back of)
    ctx.fillStyle = '#05030a'; ctx.fillRect(p.x - 4, y - 11, 10, 12);
    ctx.fillStyle = p.hair; ctx.fillRect(p.x - 3, y - 10, 8, 10);
    ctx.fillStyle = '#8a5a48'; ctx.fillRect(p.x - 3, y - 2, 8, 2);
    ctx.fillStyle = 'rgba(255,90,60,0.35)'; ctx.fillRect(p.x - 3, y - 10, 8, 1);
    if (p.kind === 'arms' || p.kind === 'scarf') {
      const up = Math.sin(t * 5.5 + p.ph) > -0.2;
      const ay = up ? y - 20 : y - 12;
      ctx.fillStyle = '#05030a'; ctx.fillRect(p.x - 10, ay - 1, 5, y - ay + 3); ctx.fillRect(p.x + 7, ay - 1, 5, y - ay + 3);
      ctx.fillStyle = p.c; ctx.fillRect(p.x - 9, ay, 3, y - ay + 2); ctx.fillRect(p.x + 8, ay, 3, y - ay + 2);
      ctx.fillStyle = '#c89878'; ctx.fillRect(p.x - 9, ay - 2, 3, 3); ctx.fillRect(p.x + 8, ay - 2, 3, 3);
      if (p.kind === 'scarf') {
        // scarf held taut overhead
        for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? WHITE : RED; ctx.fillRect(p.x - 8 + k * 3, ay - 3, 3, 4); }
        ctx.fillStyle = '#05030a'; ctx.fillRect(p.x - 8, ay - 4, 18, 1);
        ctx.fillStyle = RED; ctx.fillRect(p.x - 9, ay + 1, 1, 6); ctx.fillRect(p.x + 10, ay + 1, 1, 6);
      }
    }
  }
}

export const backdrop = new Backdrop();
