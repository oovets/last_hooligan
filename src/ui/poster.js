// The title screen as a film poster: blood-red paper with folds and grain, a black mob charging at you across the
// middle (white trainers and shirts catching the light), ink splatter, the title slammed on in white, and the line
// in a black box. Drawn in logical 640x360 units (the UI canvas scales it to full resolution).
//
//   drawPosterBg(ctx, t, { dim })                 paper + folds + grain (+ darken for menus)
//   drawMob(ctx, t, { charge })                    the charging crowd (charge 0..1: running in from below)
//   drawPosterTitle(ctx, cx, y, t, { intro, small }) -> bottom y
//   drawTagline(ctx, cx, y, text)
import { VIEW_W, VIEW_H } from '../engine/constants.js';

const RED = '#c8141a', RED_D = '#7e080c', INK = '#0b0708';
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
  // the red paper, hotter in the middle
  const g = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.42, 20, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.75);
  g.addColorStop(0, '#e01c22'); g.addColorStop(0.55, RED); g.addColorStop(1, RED_D);
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
  if (opts.dim) { ctx.fillStyle = `rgba(8,2,3,${opts.dim})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
}

// one charging man: black silhouette, h = height in px, feet at (x, fy), phase = run cycle
function man(ctx, x, fy, h, phase, seed) {
  const s = Math.sin(phase), c = Math.cos(phase);
  const lean = 0.06 + rnd(seed) * 0.08;
  const hipY = fy - h * 0.47, shY = fy - h * 0.8, headY = fy - h * 0.9;
  const hx = x + lean * h * 0.5, sx = x + lean * h;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // legs: one striding, one kicking back
  const leg = (dir) => {
    const kx = hx + dir * s * h * 0.17, ky = hipY + h * 0.24 - Math.max(0, dir * c) * h * 0.06;
    const fx = hx + dir * s * h * 0.26 - (dir * s < 0 ? h * 0.06 : 0), fyy = fy - Math.max(0, -dir * s) * h * 0.1;
    ctx.lineWidth = h * 0.11; ctx.beginPath(); ctx.moveTo(hx, hipY); ctx.lineTo(kx, ky); ctx.lineTo(fx, fyy); ctx.stroke();
    return [fx, fyy];
  };
  const f1 = leg(1), f2 = leg(-1);
  // torso (a jacket, a bit wider at the shoulders)
  ctx.beginPath();
  ctx.moveTo(sx - h * 0.15, shY); ctx.lineTo(sx + h * 0.15, shY);
  ctx.lineTo(hx + h * 0.1, hipY + h * 0.03); ctx.lineTo(hx - h * 0.1, hipY + h * 0.03); ctx.closePath(); ctx.fill();
  // arms: pumping, or one fist up / both up
  const pose = rnd(seed + 3);
  ctx.lineWidth = h * 0.085;
  const arm = (side, up) => {
    const ax = sx + side * h * 0.13;
    const ex = ax + side * h * 0.1 + (up ? 0 : -side * s * h * 0.08), ey = up ? shY - h * 0.14 : shY + h * 0.16;
    const hx2 = up ? ax + side * h * 0.05 : ex + side * h * 0.02 + s * side * h * 0.1, hy2 = up ? shY - h * 0.32 : ey + h * 0.1;
    ctx.beginPath(); ctx.moveTo(ax, shY + h * 0.02); ctx.lineTo(ex, ey); ctx.lineTo(hx2, hy2); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx2, hy2, h * 0.05, 0, Math.PI * 2); ctx.fill();   // fist
  };
  arm(-1, pose > 0.72); arm(1, pose > 0.45 && pose < 0.72);
  // head (shaved, a bit forward)
  ctx.beginPath(); ctx.ellipse(sx + h * 0.02, headY, h * 0.075, h * 0.085, 0, 0, Math.PI * 2); ctx.fill();
  // the light catching them: white trainers, some white shirts / a face
  ctx.fillStyle = '#f4f0ea';
  for (const [fx, fyy] of [f1, f2]) { ctx.beginPath(); ctx.ellipse(fx + h * 0.03, fyy - h * 0.015, h * 0.055, h * 0.025, 0, 0, Math.PI * 2); ctx.fill(); }
  const shirt = rnd(seed + 7);
  if (shirt > 0.74) {
    // light catching one side of the jacket / a white polo under it
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(sx + h * 0.02, shY + h * 0.03); ctx.lineTo(sx + h * 0.13, shY + h * 0.02); ctx.lineTo(hx + h * 0.08, hipY - h * 0.03); ctx.lineTo(hx + h * 0.03, hipY - h * 0.03); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (shirt < 0.3) { ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.ellipse(sx + h * 0.045, headY + h * 0.01, h * 0.03, h * 0.05, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
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

const ROWS = [
  { n: 15, h: 52, fy: 196, spread: 1.0, speed: 6.5 },
  { n: 13, h: 66, fy: 212, spread: 1.0, speed: 7.0 },
  { n: 10, h: 84, fy: 232, spread: 1.05, speed: 7.6 },
];
export function drawMob(ctx, t = 0, opts = {}) {
  const charge = opts.charge === undefined ? 1 : opts.charge;
  const rise = (1 - charge) * 140;
  ctx.save(); ctx.translate(0, rise);
  // the dark mass behind them and the ground smear
  ctx.fillStyle = 'rgba(11,7,8,0.9)';
  ctx.beginPath(); ctx.moveTo(-10, 170); for (let x = 0; x <= VIEW_W + 10; x += 16) ctx.lineTo(x, 166 + Math.sin(x * 0.07 + 1) * 5 + rnd(x) * 6); ctx.lineTo(VIEW_W + 10, 200); ctx.lineTo(-10, 200); ctx.fill();
  ctx.fillStyle = INK; ctx.fillRect(-10, 226, VIEW_W + 20, 10);
  for (let i = 0; i < 26; i++) splat(ctx, rnd(i * 9.1) * VIEW_W, 234 + rnd(i * 4.3) * 10, 1.2 + rnd(i * 2.2) * 2.4, i * 13);
  ROWS.forEach((row, ri) => {
    for (let i = 0; i < row.n; i++) {
      const seed = ri * 100 + i;
      const x = (i + 0.5) / row.n * VIEW_W * row.spread - (row.spread - 1) * VIEW_W / 2 + (rnd(seed) - 0.5) * 22;
      const h = row.h * (0.9 + rnd(seed + 1) * 0.2);
      const ph = t * row.speed + rnd(seed + 2) * 6.28;
      const bob = Math.abs(Math.sin(ph)) * h * 0.04;
      man(ctx, x, row.fy - bob, h, ph, seed);
    }
  });
  // spray across the crowd
  for (let i = 0; i < 14; i++) splat(ctx, rnd(i * 3.7 + 50) * VIEW_W, 150 + rnd(i * 6.1 + 50) * 30, 0.8 + rnd(i) * 1.6, i * 31 + 7);
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
  ctx.fillStyle = '#f6f2ec'; ctx.fillText('T H E   L A S T', cx, y);
  ctx.font = `400 ${big}px Anton, Impact, sans-serif`;
  const by = y + top + (small ? 0 : 2);
  ctx.fillStyle = INK; ctx.fillText('HOOLIGAN', cx + (small ? 2 : 4), by + (small ? 2 : 4));
  ctx.fillStyle = '#f6f2ec'; ctx.fillText('HOOLIGAN', cx, by);
  // worn print: knock a few specks out of the letters
  if (!small) {
    ctx.fillStyle = 'rgba(200,20,26,0.9)';
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
  ctx.fillStyle = '#f6f2ec'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
