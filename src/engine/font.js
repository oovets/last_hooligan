// Bitmap 5x7 pixel font (uppercase; lowercase is mapped to uppercase).
// drawText(ctx, text, x, y, {color, scale, align:'left'|'center'|'right', shadow:color|false, outline:color|false})
// measureText(text, scale) -> width in px

const G = {
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  'Å': ['..#..', '.#.#.', '..#..', '.###.', '#...#', '#####', '#...#'],
  'Ä': ['.#.#.', '.....', '.###.', '#...#', '#####', '#...#', '#...#'],
  'Ö': ['.#.#.', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  'Ü': ['.#.#.', '.....', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'É': ['...#.', '..#..', '#####', '#....', '####.', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  ';': ['..', '.#', '..', '..', '..', '.#', '#.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '£': ['..##.', '.#..#', '.#...', '###..', '.#...', '.#...', '#####'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  // special glyphs
  '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'], // heart
  '→': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'], // →
  '←': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'], // ←
  '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'], // ↑
  '↓': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'], // ↓
  '★': ['..#..', '..#..', '#####', '.###.', '.###.', '#...#', '.....'], // ★
};

const glyphCache = new Map();
export const GLYPH_H = 7;

function glyphCanvas(ch, color) {
  const key = ch + color;
  let c = glyphCache.get(key);
  if (c) return c;
  const rows = G[ch] || G['?'];
  const w = rows[0].length;
  c = document.createElement('canvas');
  c.width = w; c.height = GLYPH_H;
  const g = c.getContext('2d');
  g.fillStyle = color;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < w; x++) if (rows[y][x] === '#') g.fillRect(x, y, 1, 1);
  glyphCache.set(key, c);
  return c;
}

function norm(ch) {
  const u = ch.toUpperCase();
  if (G[u]) return u;
  if (ch === 'å') return 'Å';
  if (ch === 'ä') return 'Ä';
  if (ch === 'ö') return 'Ö';
  return G[ch] ? ch : '?';
}

// ---------------------------------------------------------------- HD text (real fonts)
// Screens rendered in HD (the canvas backing store at full device resolution, see main.js) draw text with real
// vector fonts instead of the bitmap font. The metrics are matched to the bitmap font: the cap height is 7*scale
// and y is the top of the capitals, so every existing layout keeps working. Offscreen canvases drawn at 1:1
// (world signs, textures) keep the pixel font. setTextMode('hd') forces vector text (e.g. the in-game HUD).
export const FONT = {
  ui: '"Barlow Condensed", "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", sans-serif',
  display: '"Anton", "Impact", "Haettenschweiler", "Arial Narrow", sans-serif',
};
let textMode = 'auto';
export function setTextMode(m) { const p = textMode; textMode = m; return p; }
const hasDoc = typeof document !== 'undefined' && typeof document.createElement === 'function';
let mctx = null;
const capCache = new Map(), wCache = new Map();
export function fontSpec(scale) {
  if (scale >= 3) return { family: FONT.display, weight: 400, ls: 0.02 };
  if (scale >= 2) return { family: FONT.ui, weight: 700, ls: 0.03 };
  return { family: FONT.ui, weight: 600, ls: 0.05 };
}
// font size (px) whose capital height is `cap` px
export function sizeForCap(family, weight, cap) {
  const k = family + weight;
  let f = capCache.get(k);
  if (f === undefined) {
    f = family === FONT.display ? 0.86 : 0.7;
    try {
      const g = mctx || (mctx = document.createElement('canvas').getContext('2d'));
      g.font = `${weight} 100px ${family}`;
      const m = g.measureText('HXE');
      if (m && m.actualBoundingBoxAscent > 20) f = m.actualBoundingBoxAscent / 100;
    } catch (e) { /* headless */ }
    capCache.set(k, f);
  }
  return cap / f;
}
export function hdFont(scale) {
  const s = fontSpec(scale);
  const px = sizeForCap(s.family, s.weight, 7 * scale);
  return { font: `${s.weight} ${px.toFixed(2)}px ${s.family}`, ls: px * s.ls, px };
}
function setLS(ctx, v) { if ('letterSpacing' in ctx) ctx.letterSpacing = v.toFixed(2) + 'px'; }
export function measureHD(text, scale = 1) {
  text = String(text).toUpperCase();
  const k = text + '|' + scale;
  let w = wCache.get(k);
  if (w !== undefined) return w;
  try {
    const g = mctx || (mctx = document.createElement('canvas').getContext('2d'));
    const f = hdFont(scale);
    g.font = f.font; setLS(g, f.ls);
    w = g.measureText(text).width - ('letterSpacing' in g ? f.ls : 0);
  } catch (e) { w = measurePixel(text, scale); }
  if (!(w >= 0)) w = measurePixel(text, scale);
  if (wCache.size > 4000) wCache.clear();
  wCache.set(k, w);
  return w;
}
// drop cached metrics once the web fonts arrive
if (hasDoc && document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { capCache.clear(); wCache.clear(); });
export async function loadFonts(timeout = 3000) {
  if (!hasDoc || !document.fonts || !document.fonts.load) return;
  const want = ['400 40px Anton', '500 40px "Barlow Condensed"', '600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '800 40px "Barlow Condensed"'];
  try { await Promise.race([Promise.all(want.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, timeout))]); } catch (e) { /* offline: fallbacks */ }
  capCache.clear(); wCache.clear();
}
let hdNow = false;   // the current frame is an HD (UI) frame — set by main.js
const isHD = ctx => textMode === 'hd' || (textMode === 'auto' && hdNow && hasDoc && ctx && ctx.getTransform && ctx.getTransform().a > 1.01);

function drawHD(ctx, text, x, y, opts, scale) {
  text = String(text).toUpperCase();
  const f = hdFont(scale);
  const w = measureHD(text, scale);
  let ox = x;
  if (opts.align === 'center') ox = x - w / 2;
  else if (opts.align === 'right') ox = x - w;
  const by = y + 7 * scale;
  ctx.save();
  ctx.font = f.font; setLS(ctx, f.ls);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (opts.outline) {
    ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    ctx.strokeStyle = opts.outline; ctx.lineWidth = Math.max(1.6, Math.min(1.5 * scale, 1.4 + scale * 0.35));
    ctx.strokeText(text, ox, by);
  }
  if (opts.shadow) { ctx.fillStyle = opts.shadow === true ? '#000000' : opts.shadow; ctx.fillText(text, ox + 0.7 * scale, by + 0.9 * scale); }
  else if (!opts.outline && opts.soft !== false) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 2 * ctx.getTransform().a; ctx.shadowOffsetY = 0.5 * ctx.getTransform().a; }
  ctx.fillStyle = opts.color || '#ffffff';
  ctx.fillText(text, ox, by);
  ctx.restore();
  return w;
}

function measurePixel(text, scale) {
  let w = 0;
  for (const ch of String(text)) w += ((G[norm(ch)] || G['?'])[0].length + 1);
  return Math.max(0, (w - 1) * scale);
}

// a filter every drawn/measured string goes through (content/rivals.js: the story's old made-up club names -> the real
// rival clubs of the club you picked)
let textFilter = null;
export function setTextFilter(fn) { textFilter = fn || null; }
const filt = text => (textFilter ? textFilter(text) : text);

export function measureText(text, scale = 1) {
  text = filt(text);
  if (textMode === 'hd' || (textMode === 'auto' && hdNow)) return measureHD(text, scale);
  return measurePixel(text, scale);
}

function rawDraw(ctx, text, x, y, color, scale) {
  let cx = x;
  for (const ch of String(text)) {
    const n = norm(ch);
    const gc = glyphCanvas(n, color);
    ctx.drawImage(gc, Math.round(cx), Math.round(y), gc.width * scale, gc.height * scale);
    cx += (gc.width + 1) * scale;
  }
}

// main.js tells the font which kind of frame is being drawn (HD UI frame or pixel-art frame)
export function setFrameHD(on) { hdNow = !!on; }
export function isFrameHD() { return hdNow; }

export function drawText(ctx, text, x, y, opts = {}) {
  const scale = opts.scale || 1;
  text = filt(text);
  if (isHD(ctx)) return drawHD(ctx, text, x, y, opts, scale);
  const color = opts.color || '#ffffff';
  const w = measurePixel(text, scale);
  let ox = x;
  if (opts.align === 'center') ox = x - w / 2;
  else if (opts.align === 'right') ox = x - w;
  ox = Math.round(ox); y = Math.round(y);
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (opts.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]])
      rawDraw(ctx, text, ox + dx * scale, y + dy * scale, opts.outline, scale);
  }
  if (opts.shadow) rawDraw(ctx, text, ox + scale, y + scale, opts.shadow === true ? '#000000' : opts.shadow, scale);
  rawDraw(ctx, text, ox, y, color, scale);
  ctx.imageSmoothingEnabled = prevSmooth;
  return w;
}

// Word-wrap helper: returns array of lines fitting maxWidth px.
export function wrapText(text, maxWidth, scale = 1) {
  const out = [];
  for (const para of String(filt(text)).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (measureText(t, scale) > maxWidth && line) { out.push(line); line = word; }
      else line = t;
    }
    out.push(line);
  }
  return out;
}
