// The title screen as a film poster in the game's black and yellow: black paper (a warm yellow glow at its heart) with folds and grain, a black mob charging at you across the
// middle (white trainers and shirts catching the light), ink splatter, the title slammed on in yellow, and the line
// in a black box. Drawn in logical 640x360 units (the UI canvas scales it to full resolution).
//
//   drawPosterBg(ctx, t, { dim })                 paper + folds + grain (+ darken for menus)
//   drawMob(ctx, t, { charge })                    the charging crowd (charge 0..1: running in from below)
//   drawPosterTitle(ctx, cx, y, t, { intro, small }) -> bottom y
//   drawTagline(ctx, cx, y, text)
import { VIEW_W, VIEW_H } from '../engine/constants.js';

const RED = '#16140c', RED_D = '#050505', INK = '#050505', YEL = '#f2c811';   // (RED/RED_D: the paper, black now)
let GRAIN = null;
function grain(ctx) {
  if (GRAIN) return GRAIN;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = Math.random();
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v < 0.5 ? 0 : 255;
    im.data[i + 3] = Math.floor(Math.random() * 26);
  }
  g.putImageData(im, 0, 0);
  GRAIN = ctx.createPattern(c, 'repeat');
  return GRAIN;
}

// deterministic pseudo-random
const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function drawPosterBg(ctx, t = 0, opts = {}) {
  // the black paper, a warm yellow glow behind the lads
  const g = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.42, 20, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.75);
  g.addColorStop(0, '#4a3c0a'); g.addColorStop(0.5, RED); g.addColorStop(1, RED_D);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // folds and creases: big light and dark facets, a couple of hard crease lines
  const facet = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
  facet([[0, 0], [250, 0], [120, 150], [0, 210]], 'rgba(255,255,255,0.05)');
  facet([[250, 0], [640, 0], [640, 70], [330, 140]], 'rgba(0,0,0,0.10)');
  facet([[0, 210], [120, 150], [330, 140], [640, 70], [640, 160], [0, 290]], 'rgba(255,255,255,0.035)');
  facet([[0, 290], [640, 160], [640, 360], [0, 360]], 'rgba(0,0,0,0.14)');
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(250, 0); ctx.lineTo(120, 150); ctx.lineTo(330, 140); ctx.lineTo(640, 70); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(470, 0); ctx.lineTo(560, 360); ctx.stroke();
  // grain
  ctx.save(); ctx.fillStyle = grain(ctx); ctx.globalCompositeOperation = 'overlay'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.restore();
  // vignette
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (opts.dim) { ctx.fillStyle = `rgba(4,4,4,${opts.dim})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}

// one man charging AT you (front view): head down, shoulders hunched, fists pumping, a knee coming up.
// h = height in px, feet at (x, fy), phase = his own run cycle (nobody is in step), seed = his build and kit
function man(ctx, x, fy, h, phase, seed) {
  const s = Math.sin(phase);
  const W = h * (0.15 + rnd(seed) * 0.07);                 // shoulder half-width: some big lads, some whippets
  const lean = h * (0.03 + rnd(seed + 1) * 0.04);           // leaning in, head forward and low
  const sway = s * h * 0.025;
  const hipY = fy - h * 0.46, shY = fy - h * 0.76, headY = fy - h * 0.84 + lean;
  const cx = x + sway;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs (front view): one planted, the other knee driving up and forward (foreshortened)
  const up = s > 0 ? 1 : -1, lift = Math.abs(s);
  const legW = h * 0.1;
  ctx.lineWidth = legW;
  // planted leg
  const px = cx - up * h * 0.07;
  ctx.beginPath(); ctx.moveTo(px, hipY); ctx.lineTo(px - up * h * 0.03, fy - h * 0.22); ctx.lineTo(px - up * h * 0.02, fy); ctx.stroke();
  // driving leg: knee up towards the camera, shin hanging under it
  const kx = cx + up * h * 0.08, ky = hipY + h * (0.22 - lift * 0.12), fx2 = kx + up * h * 0.02, fy2 = fy - lift * h * 0.14;
  ctx.lineWidth = legW * (1 + lift * 0.25);
  ctx.beginPath(); ctx.moveTo(cx + up * h * 0.06, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx2, fy2); ctx.stroke();
  // torso: a jacket, broad and hunched
  ctx.beginPath();
  ctx.moveTo(cx - W, shY + h * 0.04); ctx.quadraticCurveTo(cx, shY - h * 0.05, cx + W, shY + h * 0.04);
  ctx.lineTo(cx + W * 0.62, hipY + h * 0.04); ctx.lineTo(cx - W * 0.62, hipY + h * 0.04); ctx.closePath(); ctx.fill();
  // arms: pumping in opposition, bent, fists clenched; some swing a bottle or point the way
  const kit = rnd(seed + 5);
  ctx.lineWidth = h * 0.085;
  for (const side of [-1, 1]) {
    const fwd = side === up ? 1 : 0;                         // the arm opposite the lifted knee comes forward
    const ax = cx + side * W * 0.92, ay = shY + h * 0.06;
    const ex = ax + side * h * 0.07, ey = ay + h * (fwd ? 0.1 : 0.17);
    const hx = fwd ? cx + side * h * 0.08 : ex + side * h * 0.01, hy = fwd ? ay + h * 0.02 : ey + h * 0.12;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx, hy, h * (fwd ? 0.058 : 0.05), 0, Math.PI * 2); ctx.fill();
    if (fwd && kit > 0.86) { ctx.lineWidth = h * 0.05; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + side * h * 0.05, hy - h * 0.2); ctx.stroke(); ctx.lineWidth = h * 0.085; }   // bottle
  }
  // head down, a short neck buried in the collar
  ctx.beginPath(); ctx.ellipse(cx, headY, h * 0.07, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  // the light catching them: trainers, an open collar / white polo, a bit of face
  ctx.fillStyle = '#f4f0ea';
  ctx.beginPath(); ctx.ellipse(px - up * h * 0.02, fy - h * 0.012, h * 0.05, h * 0.022, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(fx2, fy2 - h * 0.01, h * 0.045 * (1 + lift * 0.3), h * 0.024 * (1 + lift * 0.5), 0, 0, Math.PI * 2); ctx.fill();
  const shirt = rnd(seed + 7);
  if (shirt > 0.8) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(cx - h * 0.025, shY + h * 0.02); ctx.lineTo(cx + h * 0.025, shY + h * 0.02); ctx.lineTo(cx, shY + h * 0.08); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
  if (shirt < 0.35) { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(cx + h * 0.025, headY + h * 0.02, h * 0.035, h * 0.045, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
}

// ink splatter (fixed per seed)
function splat(ctx, x, y, r, seed) {
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = rnd(seed + i) * Math.PI * 2, d = r * (1 + rnd(seed + i * 3) * 2.6), rr = r * (0.12 + rnd(seed + i * 5) * 0.35);
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, rr, 0, Math.PI * 2); ctx.fill();
  }
}

// the firm: one dense, ragged clump in depth (z 0 = far, 1 = right on top of you), everybody on his own stride
const MOB = Array.from({ length: 34 }, (_, i) => {
  const z = Math.pow(rnd(i * 7.3 + 1), 0.9);
  const spread = 0.6 + z * 0.65;                            // the front of the charge fans out wider
  return { z, x: VIEW_W / 2 + (rnd(i * 3.1 + 2) - 0.5) * VIEW_W * spread, seed: i * 17 + 3, speed: 8 + rnd(i * 5.7) * 3, off: rnd(i * 9.9) * 6.28 };
}).sort((a, b) => a.z - b.z);
export function drawMob(ctx, t = 0, opts = {}) {
  const charge = opts.charge === undefined ? 1 : opts.charge;
  const rise = (1 - charge) * 150;
  ctx.save(); ctx.translate(0, rise);
  // the mass behind them: more of them, coming over the brow
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.moveTo(-10, 196);
  for (let x = -10; x <= VIEW_W + 10; x += 7) ctx.lineTo(x, 168 - Math.abs(Math.sin(x * 0.11 + 0.7)) * 8 - rnd(Math.floor(x / 7)) * 7 + Math.abs(x - VIEW_W / 2) * 0.03);
  ctx.lineTo(VIEW_W + 10, 200); ctx.lineTo(-10, 200); ctx.fill();
  for (let i = 0; i < 40; i++) {   // heads poking up out of the mass
    const hx = rnd(i * 2.3 + 90) * VIEW_W, hy = 160 + rnd(i * 4.4 + 90) * 10;
    ctx.beginPath(); ctx.ellipse(hx, hy, 3.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  // the street under them, splattered
  ctx.fillRect(-10, 238, VIEW_W + 20, 7);
  for (let i = 0; i < 30; i++) splat(ctx, rnd(i * 9.1) * VIEW_W, 242 + rnd(i * 4.3) * 10, 1 + rnd(i * 2.2) * 2.6, i * 13);
  for (const m of MOB) {
    const h = (40 + m.z * 96) * (0.88 + rnd(m.seed + 11) * 0.24), fy = 184 + m.z * 60;
    const ph = t * m.speed + m.off;
    man(ctx, m.x, fy - Math.abs(Math.sin(ph)) * h * 0.035, h, ph, m.seed);
  }
  // spray kicked up across them
  for (let i = 0; i < 12; i++) splat(ctx, rnd(i * 3.7 + 50) * VIEW_W, 140 + rnd(i * 6.1 + 50) * 40, 0.7 + rnd(i) * 1.4, i * 31 + 7);
  ctx.restore();
}

// the title: THE LAST over HOOLIGAN, white condensed capitals, slammed on
export function drawPosterTitle(ctx, cx, y, t = 0, opts = {}) {
  const intro = opts.intro === undefined ? 99 : opts.intro;
  const small = !!opts.small;
  const big = small ? 30 : 62, top = small ? 11 : 20;
  const k = Math.min(1, Math.max(0, (intro - 1.15) / 0.25));            // slams on at ~1.4 s (the logo land time)
  if (k <= 0) return y + top + big;
  const sc = 1 + (1 - k) * 0.6;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(cx, y + (top + big) / 2); ctx.scale(sc, sc); ctx.translate(-cx, -(y + (top + big) / 2));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = `400 ${top}px Anton, Impact, sans-serif`;
  ctx.fillStyle = INK; ctx.fillText('T H E   L A S T', cx + 2, y + 2);
  ctx.fillStyle = YEL; ctx.fillText('T H E   L A S T', cx, y);
  ctx.font = `400 ${big}px Anton, Impact, sans-serif`;
  const by = y + top + (small ? 0 : 2);
  ctx.fillStyle = INK; ctx.fillText('HOOLIGAN', cx + (small ? 2 : 4), by + (small ? 2 : 4));
  ctx.fillStyle = YEL; ctx.fillText('HOOLIGAN', cx, by);
  // worn print: knock a few specks out of the letters
  if (!small) {
    ctx.fillStyle = 'rgba(20,18,10,0.9)';
    for (let i = 0; i < 70; i++) ctx.fillRect(cx - 150 + rnd(i * 1.7) * 300, by + 6 + rnd(i * 2.9) * (big - 10), 0.9 + rnd(i * 4.1) * 1.4, 0.9);
  }
  ctx.restore();
  return by + big * 1.02;
}

export function drawTagline(ctx, cx, y, text, opts = {}) {
  const size = opts.size || 11;
  ctx.save();
  ctx.font = `800 ${size}px "Barlow Condensed", Impact, sans-serif`;
  const w = ctx.measureText(text).width + 22, h = size + 9;
  ctx.fillStyle = INK; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - w / 2, y, w, h, 3); else ctx.rect(cx - w / 2, y, w, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,200,17,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();   // a yellow edge: the box is black on black paper
  ctx.fillStyle = YEL; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 0.5);
  ctx.restore();
  return y + h;
}

// a press quote across the top, poster style
export function drawPressQuote(ctx, t = 0) {
  ctx.save();
  ctx.font = '400 13px Anton, Impact, sans-serif';
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const q1 = '‘A PROPER KICKING.', q2 = ' ABSOLUTELY BRUTAL’';
  const w1 = ctx.measureText(q1).width, w2 = ctx.measureText(q2).width;
  const x = 16, y = 12;
  ctx.fillStyle = '#f6f2ec'; ctx.fillText(q1, x, y);
  ctx.font = '400 15px Anton, Impact, sans-serif';
  ctx.fillText(q2, x + w1, y - 1);
  // stars
  const sx = x + w1 + w2 + 26;
  ctx.fillStyle = '#f6f2ec';
  for (let i = 0; i < 5; i++) {
    const cx = sx + i * 11, cy = y + 7;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.2 : 5; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }
  ctx.font = '700 7px "Barlow Condensed", sans-serif';
  ctx.fillText('THE TERRACE GAZETTE', sx - 2, y + 15);
  ctx.restore();
}
