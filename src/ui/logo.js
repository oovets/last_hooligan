// Title logo: "THE LAST" in steel chrome on a waving club scarf, "HOOLIGAN" in blood-red chrome with
// a deep pixel extrusion, bevel highlights, glint sweep, sparkles and a slam-in entrance animation.
//
//   drawLogo(ctx, cx, y, t, opts)  -> bottom y of the logo
//      opts.intro: seconds since the entrance animation started (omit = fully landed)
//      opts.small: compact variant for menus
//   LOGO_LAND_TIMES: entrance times (s) at which each HOOLIGAN letter lands (title plays a thud there)
import { drawText, measureText } from '../engine/font.js';
import { makeCanvas } from '../engine/gfx.js';

const BIG = 'HOOLIGAN', TOP = 'THE LAST';
const cache = new Map();

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lerpC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function ramp(stops, f) {
  // stops: [[pos, '#hex'], ...] sorted
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
    if (f <= p1) return lerpC(hexRgb(c0), hexRgb(c1), p1 === p0 ? 0 : Math.max(0, (f - p0) / (p1 - p0)));
  }
  return hexRgb(stops[stops.length - 1][1]);
}

const BLOOD = {
  fill: [[0, '#ffffff'], [0.18, '#ffd8cc'], [0.44, '#ff6a50'], [0.47, '#ff6a50'], [0.48, '#3a0008'], [0.53, '#3a0008'], [0.54, '#ff2a1a'], [0.8, '#c8102e'], [0.92, '#8a0418'], [1, '#e8404a']],
  ext: ['#7a0818', '#3a020a'], hi: '#ffffff', lo: '#3a0008', outline: '#0a0206', depth: 6,
};
const STEEL = {
  fill: [[0, '#ffffff'], [0.4, '#c8d4ec'], [0.5, '#2a3052'], [0.58, '#e8ecff'], [1, '#7880a8']],
  ext: ['#3a3e5a', '#10121e'], hi: '#ffffff', lo: '#20243a', outline: '#05060c', depth: 3,
};

// Build a chrome letter/word canvas from the bitmap font with bevel, extrusion and outline.
function chrome(text, scale, sty) {
  const key = text + '|' + scale + '|' + sty.depth + sty.ext[0];
  if (cache.has(key)) return cache.get(key);
  const P = 2, D = sty.depth;
  const tw = measureText(text, scale), th = 7 * scale;
  const W = tw + P * 2 + D, H = th + P * 2 + D;
  const m = makeCanvas(W, H);
  const mg = m.getContext('2d');
  drawText(mg, text, P, P, { color: '#ffffff', scale });
  const out = makeCanvas(W, H);
  const og = out.getContext('2d');
  let M;
  try { M = mg.getImageData(0, 0, W, H).data; } catch (e) { M = null; }
  if (!M || !M.length) { // headless / no pixel access: plain text fallback
    drawText(og, text, P, P, { color: sty.hi, scale, outline: sty.outline });
    const r = { c: out, w: W, h: H, P };
    cache.set(key, r);
    return r;
  }
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && M[(y * W + x) * 4 + 3] > 0;
  const img = og.createImageData(W, H);
  const d = img.data;
  const ext0 = hexRgb(sty.ext[0]), ext1 = hexRgb(sty.ext[1]);
  const hi = hexRgb(sty.hi), lo = hexRgb(sty.lo), ol = hexRgb(sty.outline);
  const extAt = (x, y) => { for (let k = 1; k <= D; k++) if (at(x - k, y - k)) return k; return 0; };
  const set = (i, c, a = 255) => { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (at(x, y)) {
      let f = (y - P) / (th - 1);
      f = Math.round(f * 18) / 18;
      let c = ramp(sty.fill, f);
      if (!at(x, y - 1)) c = lerpC(c, hi, 0.7);
      else if (!at(x - 1, y)) c = lerpC(c, hi, 0.25);
      else if (!at(x, y + 1) || !at(x + 1, y)) c = lerpC(c, lo, 0.55);
      set(i, c);
      continue;
    }
    const k = extAt(x, y);
    if (k) { set(i, lerpC(ext0, ext1, (k - 1) / Math.max(1, D - 1))); continue; }
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) || extAt(x + dx, y + dy)) { near = true; break; }
    if (near) set(i, ol);
  }
  og.putImageData(img, 0, 0);
  const r = { c: out, w: W, h: H, P };
  cache.set(key, r);
  return r;
}

// mask of a word (for the glint)
function maskOf(text, scale) {
  const key = 'mask|' + text + scale;
  if (cache.has(key)) return cache.get(key);
  const W = measureText(text, scale) + 4, H = 7 * scale + 4;
  const c = makeCanvas(W, H);
  drawText(c.getContext('2d'), text, 2, 2, { color: '#ffffff', scale });
  cache.set(key, c);
  return c;
}

let glintCanvas = null;

// Club scarf ribbon behind "THE LAST": red/white bars with fringes, waving.
function drawScarf(ctx, x0, y0, w, h, t, alpha = 1) {
  const seg = 6;
  ctx.globalAlpha = alpha;
  for (let x = 0; x < w; x += 2) {
    const wave = Math.round(Math.sin(t * 3.2 + x * 0.045) * 2.5 + Math.sin(t * 1.7 + x * 0.02) * 1.5);
    const bar = Math.floor((x + Math.floor(t * 0)) / (seg * 2)) % 2;
    const edge = x < 2 || x >= w - 2;
    ctx.fillStyle = '#120c14';
    ctx.fillRect(x0 + x, y0 + wave - 1, 2, h + 2);
    ctx.fillStyle = edge ? '#8a0a1a' : bar ? '#f4f1e8' : '#c8102e';
    ctx.fillRect(x0 + x, y0 + wave, 2, h);
    ctx.fillStyle = bar ? '#d8d0c0' : '#8a0a1a';
    ctx.fillRect(x0 + x, y0 + wave + h - 2, 2, 2);
    // knit texture
    if ((x >> 1) % 2 === 0) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x0 + x, y0 + wave + 2, 1, h - 4); }
  }
  // fringes at both ends
  for (const side of [-1, 1]) {
    const ex = side < 0 ? x0 - 1 : x0 + w;
    const wave = Math.round(Math.sin(t * 3.2 + (side < 0 ? 0 : w) * 0.045) * 2.5 + Math.sin(t * 1.7 + (side < 0 ? 0 : w) * 0.02) * 1.5);
    for (let k = 0; k < h; k += 2) {
      const len = 4 + ((k * 7) % 3) + Math.round(Math.sin(t * 5 + k) * 1.2);
      ctx.fillStyle = (k >> 1) % 2 ? '#f4f1e8' : '#c8102e';
      if (side < 0) ctx.fillRect(ex - len, y0 + wave + k, len, 1);
      else ctx.fillRect(ex, y0 + wave + k, len, 1);
    }
  }
  ctx.globalAlpha = 1;
}

function sparkle(ctx, x, y, r, a) {
  if (a <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - r, y, r * 2 + 1, 1);
  ctx.fillRect(x, y - r, 1, r * 2 + 1);
  ctx.fillStyle = '#fff4c0';
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.globalAlpha = 1;
}

const easeOutBack = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export const LOGO_LAND_TIMES = BIG.split('').map((_, i) => 0.55 + i * 0.09 + 0.22);
export const LOGO_INTRO_LEN = 2.0;

export function drawLogo(ctx, cx, y, t = 0, opts = {}) {
  const small = !!opts.small;
  const bigScale = small ? 5 : 9, topScale = small ? 2 : 3;
  const intro = opts.intro === undefined ? 99 : opts.intro;
  const top = chrome(TOP, topScale, STEEL);
  const letters = BIG.split('').map(ch => chrome(ch, bigScale, BLOOD));
  const gap = bigScale; // font spacing
  let totalW = 0;
  letters.forEach((L, i) => { totalW += L.w - L.P * 2 - BLOOD.depth + (i ? gap : 0); });
  totalW += letters[0].P * 2 + BLOOD.depth;
  const x0 = Math.round(cx - totalW / 2);
  const topY = y;
  const bigY = y + (small ? 16 : 26);
  const bob = small ? 0 : Math.round(Math.sin(t * 1.6) * 1);

  // ---- scarf ribbon + THE LAST (slides in from the left)
  const ts = Math.min(1, Math.max(0, (intro - 0.05) / 0.45));
  const slide = Math.round((1 - easeOutBack(ts)) * -260);
  if (ts > 0) {
    const sw = top.w + (small ? 26 : 44), sh = small ? 12 : 17;
    drawScarf(ctx, Math.round(cx - sw / 2) + slide, topY + (small ? 1 : 2) + bob, sw, sh, t, Math.min(1, ts * 2));
    ctx.drawImage(top.c, Math.round(cx - top.w / 2) + slide, topY - (small ? 1 : 2) + bob);
  }

  // ---- HOOLIGAN letters slam down one by one
  let lx = x0;
  const glintPos = [];
  letters.forEach((L, i) => {
    const t0 = 0.55 + i * 0.09, dur = 0.22;
    const k = Math.min(1, Math.max(0, (intro - t0) / dur));
    const adv = L.w - L.P * 2 - BLOOD.depth + gap;
    if (k > 0) {
      const fall = Math.round((1 - k * k) * -170);
      // squash on landing
      const since = intro - (t0 + dur);
      const sq = since > 0 && since < 0.12 ? Math.sin(since / 0.12 * Math.PI) * 0.18 : 0;
      const wob = small ? 0 : Math.round(Math.sin(t * 2.2 + i * 0.7) * 1.2);
      const yy = bigY + fall + bob + wob;
      if (sq) {
        const h2 = Math.round(L.h * (1 - sq)), w2 = Math.round(L.w * (1 + sq * 0.6));
        ctx.drawImage(L.c, Math.round(lx - (w2 - L.w) / 2), yy + (L.h - h2), w2, h2);
      } else ctx.drawImage(L.c, lx, yy);
      glintPos.push([lx, yy]);
    }
    lx += adv;
  });

  // ---- glint sweep (masked to the letters), every ~3.5s once landed
  const landed = intro > LOGO_INTRO_LEN;
  if (landed && !small) {
    const period = 3.6, gt = (t % period) / 0.9;
    if (gt < 1) {
      const mk = maskOf(BIG, bigScale);
      if (!glintCanvas || glintCanvas.width !== mk.width || glintCanvas.height !== mk.height) glintCanvas = makeCanvas(mk.width, mk.height);
      const g = glintCanvas.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, mk.width, mk.height);
      g.drawImage(mk, 0, 0);
      g.globalCompositeOperation = 'source-in';
      const gx = -60 + gt * (mk.width + 120);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx + 14, 0); g.lineTo(gx - 16, mk.height); g.lineTo(gx - 30, mk.height); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.moveTo(gx + 20, 0); g.lineTo(gx + 25, 0); g.lineTo(gx - 5, mk.height); g.lineTo(gx - 10, mk.height); g.closePath(); g.fill();
      ctx.drawImage(glintCanvas, x0 + letters[0].P - 2, bigY + letters[0].P - 2 + bob);
    }
    // sparkles hopping between letter corners
    const sp = Math.floor(t * 1.3) % letters.length, sk = (t * 1.3) % 1;
    const gp = glintPos[sp];
    if (gp) sparkle(ctx, gp[0] + 4 + ((sp * 13) % 20), gp[1] + 4 + ((sp * 7) % 10), 3 + Math.round(Math.sin(sk * Math.PI) * 3), Math.sin(sk * Math.PI) * 1.2);
  }
  // white flash on the final slam
  const lastLand = LOGO_LAND_TIMES[LOGO_LAND_TIMES.length - 1];
  if (!small && intro > lastLand && intro < lastLand + 0.25) {
    ctx.globalAlpha = (1 - (intro - lastLand) / 0.25) * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
  }
  return bigY + letters[0].h + bob;
}

// Small reusable club crest (an original anchor emblem in a shield), drawn with pixel rects.
const CREST = [
  '..rrrrrrrrrrr..',
  '.rwwwwwwwwwwwr.',
  'rwwwwwkkkwwwwwr',
  'rwwwwwk.kwwwwwr',
  'rwwwwwkkkwwwwwr',
  'rwwkkkkkkkkkwwr',
  'rwwwwwwkwwwwwwr',
  'rrrrrrrkrrrrrrr',
  'rrrrrrrkrrrrrrr',
  'rkrrrrrkrrrrrkr',
  'rkkrrrrkrrrrkkr',
  '.rkkrrrkrrrkkr.',
  '.rrkkkkkkkkkrr.',
  '..rrrrrkrrrrr..',
  '....rrrrrrr....',
  '......rrr......',
];
export function drawCrest(ctx, x, y, s = 1) {
  const pal = { r: '#c8102e', w: '#f4f1e8', k: '#120c14' };
  ctx.fillStyle = '#120c14';
  for (let j = 0; j < CREST.length; j++) for (let i = 0; i < CREST[j].length; i++) if (CREST[j][i] !== '.') ctx.fillRect(x + (i - 1) * s, y + (j - 1) * s, s * 3, s * 3);
  for (let j = 0; j < CREST.length; j++) for (let i = 0; i < CREST[j].length; i++) {
    const c = CREST[j][i];
    if (c === '.') continue;
    ctx.fillStyle = pal[c];
    ctx.fillRect(x + i * s, y + j * s, s, s);
  }
  return { w: 15 * s, h: CREST.length * s };
}

// Chrome headline text in the logo style. style: 'blood' | 'steel'. align: 'left' | 'center' | 'right'.
// Returns { w, h } of the drawn block.
export function drawChrome(ctx, text, x, y, scale = 4, style = 'blood', align = 'left') {
  const sty = style === 'steel' ? STEEL : BLOOD;
  const r = chrome(String(text), scale, sty);
  let dx = x - r.P;
  if (align === 'center') dx = x - r.w / 2;
  else if (align === 'right') dx = x - r.w + r.P + sty.depth;
  ctx.drawImage(r.c, Math.round(dx), Math.round(y - r.P));
  return { w: r.w, h: r.h };
}
