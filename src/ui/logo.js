// Title logo and chrome headlines, painted with vector type at the canvas's full resolution.
//
// "THE LAST" in brushed steel on a waving club scarf, "HOOLIGAN" in blood-red chrome: a deep extrusion, a black
// keyline, a mirrored horizon in the face gradient, bevel highlights, an outer glow, a glint sweep and sparkles,
// plus the slam-in entrance (one letter at a time, with squash on landing).
//
//   drawLogo(ctx, cx, y, t, opts)  -> bottom y of the logo
//      opts.intro: seconds since the entrance animation started (omit = fully landed)
//      opts.small: compact variant for menus
//   LOGO_LAND_TIMES: entrance times (s) at which each HOOLIGAN letter lands (title plays a thud there)
//   drawChrome(ctx, text, x, y, scale, style, align): chrome headline whose capitals are 7*scale tall at y
//   drawCrest(ctx, x, y, s): the club crest (an original anchor in a shield), 15s x 16s
import { FONT, sizeForCap } from '../engine/font.js';

const BIG = 'HOOLIGAN', TOP = 'THE LAST';
const cache = new Map();
const devScale = ctx => (ctx.getTransform ? ctx.getTransform().a : 2) || 2;

// 'blood' is the game's yellow chrome now (black and yellow throughout; the name stays for the callers)
const BLOOD = {
  fill: [[0, '#ffffff'], [0.16, '#fff6c8'], [0.42, '#ffd84a'], [0.47, '#f2c811'], [0.485, '#2a2000'], [0.53, '#3a2c00'], [0.56, '#ffd21a'], [0.8, '#e0a80c'], [0.93, '#7a5600'], [1, '#f2c811']],
  ext: ['#7a5a00', '#1a1200'], hi: 'rgba(255,255,255,0.85)', lo: 'rgba(30,20,0,0.55)', outline: '#0a0a06', glow: 'rgba(242,200,17,0.4)', depth: 0.11,
};
const STEEL = {
  fill: [[0, '#ffffff'], [0.38, '#cfd8f0'], [0.49, '#8890b8'], [0.5, '#262a48'], [0.6, '#e4eaff'], [1, '#7880a8']],
  ext: ['#44486a', '#0e1020'], hi: 'rgba(255,255,255,0.9)', lo: 'rgba(10,12,30,0.5)', outline: '#05060c', glow: 'rgba(160,180,255,0.25)', depth: 0.09,
};

function fontFor(cap) {
  const px = sizeForCap(FONT.display, 400, cap);
  return { font: `400 ${px.toFixed(2)}px ${FONT.display}`, ls: px * 0.02 };
}
function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

// Chrome text block, cached per (text, cap height, style, resolution). The canvas is in device px;
// ox/oy (logical px) = where the left edge / cap top of the text sits inside it.
function chrome(text, cap, sty, S) {
  const key = text + '|' + cap.toFixed(2) + '|' + (sty === BLOOD ? 'b' : 's') + '|' + S.toFixed(2);
  let r = cache.get(key);
  if (r) return r;
  const f = fontFor(cap);
  const mg = newCanvas(1, 1).getContext('2d');
  mg.font = f.font; if ('letterSpacing' in mg) mg.letterSpacing = f.ls + 'px';
  const tw = Math.max(1, mg.measureText(text).width);
  const D = cap * sty.depth, pad = cap * 0.45 + 4;
  const W = tw + pad * 2 + D, H = cap + pad * 2 + D;
  const c = newCanvas(W * S, H * S), g = c.getContext('2d');
  g.scale(S, S);
  g.font = f.font; if ('letterSpacing' in g) g.letterSpacing = f.ls + 'px';
  g.textBaseline = 'alphabetic';
  const x0 = pad, base = pad + cap;
  const kl = Math.max(1.2, cap * 0.075);
  // keyline + glow behind everything (front, middle and back of the extrusion)
  g.lineJoin = 'round'; g.lineWidth = kl * 2; g.strokeStyle = sty.outline;
  g.shadowColor = sty.glow; g.shadowBlur = cap * 0.35 * S;
  for (const k of [D, D / 2, 0]) g.strokeText(text, x0 + k, base + k);
  g.shadowBlur = 0;
  for (const k of [D, D / 2, 0]) g.fillText(text, x0 + k, base + k);   // fill the keyline's inside (no gaps)
  // extrusion (back to front)
  const steps = Math.max(4, Math.ceil(D * S / 1.5));
  for (let i = steps; i >= 1; i--) {
    const k = D * i / steps;
    g.fillStyle = mix(sty.ext[0], sty.ext[1], (i - 1) / Math.max(1, steps - 1));
    g.fillText(text, x0 + k, base + k);
  }
  // face
  const fg = g.createLinearGradient(0, base - cap, 0, base);
  for (const [p, col] of sty.fill) fg.addColorStop(p, col);
  g.fillStyle = fg; g.fillText(text, x0, base);
  // bevel: light rim top-left, dark rim bottom-right
  const rim = (dx, dy, col) => {
    const m = newCanvas(c.width, c.height), mg2 = m.getContext('2d');
    mg2.scale(S, S); mg2.font = f.font; if ('letterSpacing' in mg2) mg2.letterSpacing = f.ls + 'px'; mg2.textBaseline = 'alphabetic';
    mg2.fillStyle = col; mg2.fillText(text, x0, base);
    mg2.globalCompositeOperation = 'destination-out'; mg2.fillText(text, x0 + dx, base + dy);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(m, 0, 0); g.setTransform(S, 0, 0, S, 0, 0);
  };
  const b = Math.max(0.6, cap * 0.035);
  rim(b * 0.6, b, sty.hi);
  rim(-b * 0.6, -b, sty.lo);
  r = { c, W, H, ox: pad, oy: pad, tw, S };
  cache.set(key, r);
  if (cache.size > 160) cache.delete(cache.keys().next().value);
  return r;
}
function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
function put(ctx, r, x, y, w, h) { ctx.drawImage(r.c, x - r.ox, y - r.oy, w ?? r.W, h ?? r.H); }

// face-only mask of the landed word (for the glint)
function wordMask(cap, letters, S) {
  const key = 'mask|' + cap + '|' + S.toFixed(2);
  let m = cache.get(key);
  if (m) return m;
  const f = fontFor(cap);
  const w = letters.reduce((s, L) => s + L.adv, 0) + cap, h = cap * 1.4;
  const c = newCanvas(w * S, h * S), g = c.getContext('2d');
  g.scale(S, S); g.font = f.font; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  let x = 0;
  for (const L of letters) { g.fillText(L.ch, x, cap * 1.2); x += L.adv; }
  m = { c, w, h, top: cap * 0.2, tmp: newCanvas(c.width, c.height) };
  cache.set(key, m);
  return m;
}

// Club scarf ribbon: red/white blocks with knit texture and fringes, waving.
function drawScarf(ctx, x0, y0, w, h, t, alpha = 1) {
  const N = Math.ceil(w / 3), block = h * 1.05;
  const wave = x => Math.sin(t * 3.2 + x * 0.045) * h * 0.16 + Math.sin(t * 1.7 + x * 0.02) * h * 0.1;
  ctx.save();
  ctx.globalAlpha = alpha;
  // shadow under the ribbon
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8 * devScale(ctx); ctx.shadowOffsetY = 2 * devScale(ctx);
  ctx.fillStyle = '#121214';
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const x = i / N * w; ctx.lineTo(x0 + x, y0 + wave(x)); }
  for (let i = N; i >= 0; i--) { const x = i / N * w; ctx.lineTo(x0 + x, y0 + h + wave(x)); }
  ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent';
  // blocks
  for (let i = 0; i < N; i++) {
    const xa = i / N * w, xb = (i + 1) / N * w;
    const bar = Math.floor((xa + 0.01) / block) % 2;
    ctx.fillStyle = bar ? '#f2c811' : '#141416';   // black and yellow bars
    ctx.beginPath();
    ctx.moveTo(x0 + xa, y0 + wave(xa)); ctx.lineTo(x0 + xb + 0.25, y0 + wave(xb)); ctx.lineTo(x0 + xb + 0.25, y0 + h + wave(xb)); ctx.lineTo(x0 + xa, y0 + h + wave(xa));
    ctx.closePath(); ctx.fill();
    // light from the slope of the wave
    const sl = (wave(xb) - wave(xa)) / (xb - xa);
    ctx.fillStyle = sl > 0 ? `rgba(0,0,0,${Math.min(0.35, sl * 0.9).toFixed(3)})` : `rgba(255,255,255,${Math.min(0.25, -sl * 0.6).toFixed(3)})`;
    ctx.fill();
  }
  // knit ribs + top/bottom shading
  ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 0.45; ctx.beginPath();
  for (let x = 1.5; x < w; x += 2.2) { ctx.moveTo(x0 + x, y0 + wave(x) + 1.5); ctx.lineTo(x0 + x, y0 + h + wave(x) - 1.5); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6; ctx.beginPath();
  for (let i = 0; i <= N; i++) { const x = i / N * w; ctx.lineTo(x0 + x, y0 + wave(x) + 0.6); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,0,10,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i <= N; i++) { const x = i / N * w; ctx.lineTo(x0 + x, y0 + h + wave(x) - 0.8); }
  ctx.stroke();
  // fringes
  ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ex = side < 0 ? 0 : w;
    for (let k = 0.5; k < h; k += 1.6) {
      const len = h * 0.3 + ((k * 7) % 3) + Math.sin(t * 5 + k) * 1.2;
      ctx.strokeStyle = Math.floor(k / 1.6) % 2 ? '#f2c811' : '#141416';
      ctx.beginPath(); ctx.moveTo(x0 + ex, y0 + wave(ex) + k); ctx.lineTo(x0 + ex + side * len, y0 + wave(ex) + k + Math.sin(t * 4 + k) * 0.8); ctx.stroke();
    }
  }
  ctx.restore();
}

function sparkle(ctx, x, y, r, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  g.addColorStop(0, 'rgba(255,250,220,0.9)'); g.addColorStop(1, 'rgba(255,200,160,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const [w, h] of [[r * 2.6, r * 0.16], [r * 0.16, r * 2.6]]) {
    ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - h, x + w, y); ctx.quadraticCurveTo(x, y + h, x - w, y); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - w); ctx.quadraticCurveTo(x + h, y, x, y + w); ctx.quadraticCurveTo(x - h, y, x, y - w); ctx.fill();
  }
  ctx.restore();
}

const easeOutBack = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export const LOGO_LAND_TIMES = BIG.split('').map((_, i) => 0.55 + i * 0.09 + 0.22);
export const LOGO_INTRO_LEN = 2.0;

function letterSet(cap, S) {
  const key = 'set|' + cap + '|' + S.toFixed(2);
  let set = cache.get(key);
  if (set) return set;
  const f = fontFor(cap);
  const mg = newCanvas(1, 1).getContext('2d'); mg.font = f.font;
  set = BIG.split('').map(ch => ({ ch, r: chrome(ch, cap, BLOOD, S), adv: mg.measureText(ch).width + cap * 0.06 }));
  cache.set(key, set);
  return set;
}

export function drawLogo(ctx, cx, y, t = 0, opts = {}) {
  const S = devScale(ctx);
  const small = !!opts.small;
  const cap = small ? 34 : 64, topCap = small ? 11 : 17;
  const intro = opts.intro === undefined ? 99 : opts.intro;
  const letters = letterSet(cap, S);
  const totalW = letters.reduce((s, L) => s + L.adv, 0) - cap * 0.06;
  const x0 = cx - totalW / 2;
  const bigY = y + (small ? 18 : 30);
  const bob = small ? 0 : Math.sin(t * 1.6) * 1.2;

  // ---- scarf ribbon + THE LAST (slides in from the left)
  const ts = Math.min(1, Math.max(0, (intro - 0.05) / 0.45));
  const slide = (1 - easeOutBack(ts)) * -300;
  if (ts > 0) {
    const top = chrome(TOP, topCap, STEEL, S);
    const sw = top.tw + (small ? 34 : 60), sh = topCap + (small ? 6 : 9);
    drawScarf(ctx, cx - sw / 2 + slide, y - sh * 0.5 + topCap * 0.5 + bob, sw, sh, t, Math.min(1, ts * 2));
    ctx.globalAlpha = Math.min(1, ts * 2);
    put(ctx, top, cx - top.tw / 2 + slide, y + bob - 0.5);
    ctx.globalAlpha = 1;
  }

  // ---- HOOLIGAN letters slam down one by one
  let lx = x0;
  const pos = [];
  letters.forEach((L, i) => {
    const t0 = 0.55 + i * 0.09, dur = 0.22;
    const k = Math.min(1, Math.max(0, (intro - t0) / dur));
    if (k > 0) {
      const fall = (1 - k * k) * -190;
      const since = intro - (t0 + dur);
      const sq = since > 0 && since < 0.14 ? Math.sin(since / 0.14 * Math.PI) * 0.16 : 0;
      const wob = small ? 0 : Math.sin(t * 2.2 + i * 0.7) * 1.1;
      const yy = bigY + fall + bob + wob;
      if (sq) {
        const r = L.r, w2 = r.W * (1 + sq * 0.6), h2 = r.H * (1 - sq);
        ctx.drawImage(r.c, lx - r.ox - (w2 - r.W) / 2, yy - r.oy + (r.H - h2), w2, h2);
      } else put(ctx, L.r, lx, yy);
      pos.push([lx, yy, L]);
    }
    lx += L.adv;
  });

  // ---- glint sweep across the face, every ~3.6 s once landed
  const landed = intro > LOGO_INTRO_LEN;
  if (landed && !small) {
    const period = 3.6, gt = (t % period) / 0.9;
    if (gt < 1) {
      const m = wordMask(cap, letters, S);
      const g = m.tmp.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, m.tmp.width, m.tmp.height);
      g.drawImage(m.c, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.setTransform(S, 0, 0, S, 0, 0);
      const gx = -cap + gt * (m.w + cap * 2);
      const band = g.createLinearGradient(gx - cap * 0.5, 0, gx + cap * 0.5, cap * 0.3);
      band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.45, 'rgba(255,255,255,0.75)'); band.addColorStop(0.55, 'rgba(255,255,255,0.75)'); band.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = band; g.fillRect(0, 0, m.w, m.h);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
      ctx.drawImage(m.tmp, x0, bigY + bob - m.top, m.w, m.h);
      ctx.restore();
    }
    // sparkles hopping between letter corners
    const sp = Math.floor(t * 1.3) % letters.length, sk = (t * 1.3) % 1;
    const p = pos[sp];
    if (p) sparkle(ctx, p[0] + cap * 0.12 + ((sp * 13) % 20) * cap / 64, p[1] + cap * 0.08 + ((sp * 7) % 10) * cap / 64, 2.5 + Math.sin(sk * Math.PI) * 3.5, Math.sin(sk * Math.PI) * 1.2);
  }
  // white flash on the final slam
  const lastLand = LOGO_LAND_TIMES[LOGO_LAND_TIMES.length - 1];
  if (!small && intro > lastLand && intro < lastLand + 0.3) {
    ctx.save();
    ctx.globalAlpha = (1 - (intro - lastLand) / 0.3) * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }
  return bigY + cap + cap * BLOOD.depth + bob;
}

// The club crest: an original anchor emblem in a red-and-white shield. Fits a 15s x 16s box at (x, y).
export function drawCrest(ctx, x, y, s = 1) {
  const S = devScale(ctx);
  const w = 15 * s, h = 16 * s, cx = x + w / 2;
  const shield = () => {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h * 0.04); ctx.lineTo(x + w * 0.92, y + h * 0.04);
    ctx.quadraticCurveTo(x + w, y + h * 0.04, x + w, y + h * 0.14);
    ctx.lineTo(x + w, y + h * 0.5); ctx.quadraticCurveTo(x + w * 0.95, y + h * 0.82, cx, y + h);
    ctx.quadraticCurveTo(x + w * 0.05, y + h * 0.82, x, y + h * 0.5);
    ctx.lineTo(x, y + h * 0.14); ctx.quadraticCurveTo(x, y + h * 0.04, x + w * 0.08, y + h * 0.04); ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * S * s / 2; ctx.shadowOffsetY = 1.5 * S;
  shield(); ctx.fillStyle = '#121214'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); shield(); ctx.clip();
  const rg = ctx.createLinearGradient(0, y, 0, y + h);
  rg.addColorStop(0, '#ff3048'); rg.addColorStop(1, '#8a0418');
  ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f4f1e8'; ctx.fillRect(x, y, w, h * 0.42);
  const sh = ctx.createLinearGradient(x, 0, x + w, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = '#121214'; ctx.lineWidth = 0.8 * s; shield(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,150,0.8)'; ctx.lineWidth = 0.3 * s;
  ctx.save(); ctx.translate(cx, y + h * 0.53); ctx.scale(0.86, 0.86); ctx.translate(-cx, -(y + h * 0.53)); shield(); ctx.stroke(); ctx.restore();
  // anchor
  ctx.strokeStyle = '#121214'; ctx.lineWidth = 1.15 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(cx, y + h * 0.19, 1.2 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, y + h * 0.26); ctx.lineTo(cx, y + h * 0.84);
  ctx.moveTo(cx - 3.6 * s, y + h * 0.36); ctx.lineTo(cx + 3.6 * s, y + h * 0.36);
  ctx.moveTo(cx - 5 * s, y + h * 0.6); ctx.quadraticCurveTo(cx - 4.6 * s, y + h * 0.86, cx, y + h * 0.84); ctx.quadraticCurveTo(cx + 4.6 * s, y + h * 0.86, cx + 5 * s, y + h * 0.6);
  ctx.stroke();
  ctx.fillStyle = '#121214';
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * 5.9 * s, y + h * 0.56); ctx.lineTo(cx + d * 3.9 * s, y + h * 0.63); ctx.lineTo(cx + d * 5.6 * s, y + h * 0.68); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  return { w, h };
}

// Chrome headline text in the logo style. style: 'blood' | 'steel'. align: 'left' | 'center' | 'right'.
// Capitals are 7*scale tall with their top at y (as with the bitmap font). Returns { w, h } of the drawn block.
export function drawChrome(ctx, text, x, y, scale = 4, style = 'blood', align = 'left') {
  const sty = style === 'steel' ? STEEL : BLOOD;
  const cap = 7 * scale;
  const r = chrome(String(text).toUpperCase(), cap, sty, devScale(ctx));
  let dx = x;
  if (align === 'center') dx = x - r.tw / 2;
  else if (align === 'right') dx = x - r.tw;
  put(ctx, r, dx, y);
  return { w: r.tw, h: cap * (1 + sty.depth) };
}
