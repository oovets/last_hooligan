// Animated title/menu backdrop: your club's town by night, seen from the home terrace — painted with vector shapes,
// gradients and light at the canvas's full resolution (HD menus) or at 2x (pixel frames).
//
// Static layers (sky, skyline, far stand, pitch, fence, floodlight towers) and sprites (crowd tiers, terrace fans,
// glows, beams, smoke) are pre-rendered once per output resolution. Per frame: twinkling stars, the bouncing crowd
// with a scarf wave and camera flashes, the scrolling LED boards, floodlight beams and glare, waving flags, flares
// with smoke and sparks, the terrace crowd and — with { lads: true } — the firm in front (rigged 3D characters when
// the 3D renderer is loaded, the 2D dolls otherwise).
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { FONT, sizeForCap, filterText } from '../engine/font.js';
import { makeRng } from '../engine/rng.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim } from '../game/poses.js';
import { buildLook } from '../content/wardrobe.js';
import { casualLook } from '../content/enemies.js';
import { save } from '../save.js';
import { r3d } from '../render3d/index.js';

const RED = '#c8102e', WHITE = '#f4f1e8';
const HORIZON = 128;                     // top of the far stand roof
const STAND_TOP = 136, STAND_BOT = 198, BOARDS = 199, PITCH_TOP = 211, PITCH_BOT = 296;
const TOWERS = [[64, 1], [VIEW_W - 64, -1]];
const ADS = [['HAMNÖL LAGER', '#c8102e', '#ffffff'], ['NORDHAMN FERRIES', '#123a78', '#ffffff'], ['SILLEN FISH BAR', '#f4f1e8', '#141414'],
  ['DOCKSIDE MOTORS', '#1c1c22', '#ffd23a'], ['KAFFE KRONA', '#5a2a10', '#f4e0b0'], ['ANCHOR BOOKMAKERS', '#c8102e', '#f4f1e8']];

const devScale = ctx => (ctx.getTransform ? ctx.getTransform().a : 2) || 2;
function layer(S, w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S));
  const g = c.getContext('2d');
  g.scale(S, S);
  return { c, g, w, h };
}
const blit = (ctx, L, x, y) => ctx.drawImage(L.c, x, y, L.w, L.h);
function softEllipse(g, cx, cy, rx, ry, inner, outer) {
  g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  rg.addColorStop(0, inner); rg.addColorStop(1, outer);
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- static layer
function paintSky(g, S, rng) {
  const sky = g.createLinearGradient(0, 0, 0, PITCH_TOP);
  sky.addColorStop(0, '#03020a'); sky.addColorStop(0.3, '#0a0820'); sky.addColorStop(0.55, '#1a0d2e'); sky.addColorStop(0.78, '#3a1232'); sky.addColorStop(1, '#5e1a34');
  g.fillStyle = sky; g.fillRect(0, 0, VIEW_W, PITCH_TOP);
  softEllipse(g, VIEW_W / 2, HORIZON + 6, 420, 70, 'rgba(255,110,80,0.30)', 'rgba(255,110,80,0)');
  softEllipse(g, 150, HORIZON, 200, 40, 'rgba(255,170,90,0.12)', 'rgba(255,170,90,0)');
  // stars
  for (let i = 0; i < 300; i++) {
    const x = rng() * VIEW_W, y = Math.pow(rng(), 1.4) * 118, r = 0.18 + rng() * rng() * 0.55;
    const a = 0.25 + rng() * 0.75;
    g.fillStyle = rng() < 0.2 ? `rgba(255,236,200,${a})` : rng() < 0.5 ? `rgba(200,210,255,${a})` : `rgba(255,255,255,${a})`;
    if (r > 0.5) { g.shadowColor = g.fillStyle; g.shadowBlur = 3 * S; }
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }
  // moon
  const mx = 522, my = 36;
  softEllipse(g, mx, my, 60, 60, 'rgba(190,200,255,0.16)', 'rgba(190,200,255,0)');
  softEllipse(g, mx, my, 18, 18, 'rgba(230,230,255,0.25)', 'rgba(230,230,255,0)');
  const mg = g.createRadialGradient(mx - 3, my - 3, 1, mx, my, 9);
  mg.addColorStop(0, '#fffbee'); mg.addColorStop(0.7, '#e6dfca'); mg.addColorStop(1, '#bdb39a');
  g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 8.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(120,110,90,0.18)';
  for (const [dx, dy, r] of [[-3, -2, 1.8], [2.5, 1.5, 2.2], [-1, 4, 1.2], [3.5, -3.5, 1]]) { g.beginPath(); g.arc(mx + dx, my + dy, r, 0, Math.PI * 2); g.fill(); }
  // clouds: soft, lit from below by the town
  for (let k = 0; k < 12; k++) {
    const cx = rng() * VIEW_W, cy = 18 + rng() * 80, w = 50 + rng() * 120;
    softEllipse(g, cx, cy, w, w * 0.16, 'rgba(110,70,140,0.20)', 'rgba(110,70,140,0)');
    softEllipse(g, cx + 6, cy + 3, w * 0.7, w * 0.08, 'rgba(255,120,120,0.07)', 'rgba(255,120,120,0)');
  }
  // moon passes behind a cloud bank
  softEllipse(g, mx + 10, my + 6, 46, 6, 'rgba(60,36,80,0.55)', 'rgba(60,36,80,0)');
}

function paintSkyline(g, S, rng) {
  // far haze layer
  g.fillStyle = '#1e1230';
  let x = 0;
  g.beginPath(); g.moveTo(0, HORIZON + 4);
  while (x < VIEW_W) { const w = 8 + rng() * 22, h = 6 + rng() * 22; g.lineTo(x, HORIZON - h); g.lineTo(x + w, HORIZON - h); x += w; }
  g.lineTo(VIEW_W, HORIZON + 4); g.closePath(); g.fill();
  // near silhouettes with lit windows
  const sil = '#0b0614';
  x = 0;
  const wins = [];
  while (x < VIEW_W) {
    const w = 14 + Math.floor(rng() * 26), h = 10 + Math.floor(rng() * 28);
    g.fillStyle = sil; g.fillRect(x, HORIZON - h, w + 0.5, h + 10);
    if (rng() < 0.3) { g.fillRect(x + w * 0.3, HORIZON - h - 4, 2, 4); }
    for (let wy = HORIZON - h + 3; wy < HORIZON - 1; wy += 3.5) for (let wx = x + 2; wx < x + w - 2; wx += 3.2) if (rng() < 0.16) wins.push([wx, wy, rng() < 0.82 ? '#ffcf70' : '#9fc0ff']);
    x += w;
  }
  // tower block
  g.fillStyle = sil; g.fillRect(118, HORIZON - 64, 26, 64);
  for (let wy = HORIZON - 60; wy < HORIZON - 4; wy += 4) for (let wx = 121; wx < 141; wx += 4) if (rng() < 0.32) wins.push([wx, wy, '#ffd27a']);
  // church spire
  g.beginPath(); g.moveTo(452, HORIZON); g.lineTo(452, HORIZON - 40); g.lineTo(458, HORIZON - 76); g.lineTo(464, HORIZON - 40); g.lineTo(464, HORIZON); g.fill();
  g.fillRect(457.5, HORIZON - 84, 1, 9); g.fillRect(455.5, HORIZON - 81, 5, 1);
  softEllipse(g, 458, HORIZON - 32, 8, 8, 'rgba(255,220,140,0.45)', 'rgba(255,220,140,0)');
  g.fillStyle = '#ffe6a0'; g.beginPath(); g.arc(458, HORIZON - 32, 2, 0, Math.PI * 2); g.fill();
  // harbour cranes (lattice)
  g.strokeStyle = sil; g.fillStyle = sil;
  for (const cx of [24, 590]) {
    g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx, HORIZON); g.lineTo(cx, HORIZON - 72); g.moveTo(cx + 4, HORIZON); g.lineTo(cx + 4, HORIZON - 72); g.stroke();
    g.lineWidth = 0.5; g.beginPath();
    for (let y = HORIZON; y > HORIZON - 70; y -= 6) { g.moveTo(cx, y); g.lineTo(cx + 4, y - 6); }
    g.stroke();
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 24, HORIZON - 72); g.lineTo(cx + 30, HORIZON - 72); g.stroke();
    g.lineWidth = 0.5; g.beginPath(); g.moveTo(cx + 2, HORIZON - 86); g.lineTo(cx - 24, HORIZON - 72); g.moveTo(cx + 2, HORIZON - 86); g.lineTo(cx + 30, HORIZON - 72); g.moveTo(cx + 2, HORIZON - 86); g.lineTo(cx + 2, HORIZON - 72); g.stroke();
    g.beginPath(); g.moveTo(cx + 22, HORIZON - 72); g.lineTo(cx + 22, HORIZON - 46); g.stroke();
    g.fillRect(cx + 19, HORIZON - 46, 6, 4);
  }
  // windows with a little bloom
  g.shadowBlur = 2.5 * S;
  for (const [wx, wy, c] of wins) { g.shadowColor = c; g.fillStyle = c; g.globalAlpha = 0.55 + rng() * 0.45; g.fillRect(wx, wy, 1.4, 1.6); }
  g.globalAlpha = 1; g.shadowBlur = 0;
  // haze where the town meets the stadium
  const hz = g.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 6);
  hz.addColorStop(0, 'rgba(110,40,80,0)'); hz.addColorStop(1, 'rgba(140,50,80,0.35)');
  g.fillStyle = hz; g.fillRect(0, HORIZON - 30, VIEW_W, 36);
}

function paintStand(g, S) {
  // stand interior (crowd tiers are separate layers)
  const st = g.createLinearGradient(0, STAND_TOP - 6, 0, STAND_BOT);
  st.addColorStop(0, '#06040a'); st.addColorStop(0.5, '#150e1e'); st.addColorStop(1, '#2a1c30');
  g.fillStyle = st; g.fillRect(36, HORIZON + 4, VIEW_W - 72, STAND_BOT - HORIZON);
  // wings (stand ends, angled)
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 0 : VIEW_W, x1 = side < 0 ? 36 : VIEW_W - 36;
    const wg = g.createLinearGradient(x0, 0, x1, 0);
    wg.addColorStop(0, '#0a0712'); wg.addColorStop(1, '#1a1224');
    g.fillStyle = wg;
    g.beginPath(); g.moveTo(x0, HORIZON + 16); g.lineTo(x1, HORIZON - 2); g.lineTo(x1, BOARDS); g.lineTo(x0, BOARDS + 5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x0, HORIZON + 16); g.lineTo(x1, HORIZON - 2); g.stroke();
  }
  // roof: fascia with club trim and a row of under-roof lights
  const rf = g.createLinearGradient(0, HORIZON - 6, 0, HORIZON + 5);
  rf.addColorStop(0, '#3a3046'); rf.addColorStop(0.3, '#221a2e'); rf.addColorStop(1, '#0e0a16');
  g.fillStyle = rf; g.fillRect(30, HORIZON - 6, VIEW_W - 60, 11);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(30, HORIZON - 6, VIEW_W - 60, 0.6);
  g.fillStyle = '#e8e2d4'; g.fillRect(30, HORIZON + 5, VIEW_W - 60, 1.2);
  g.fillStyle = RED; g.fillRect(30, HORIZON + 6.2, VIEW_W - 60, 1.4);
  // truss rhythm on the fascia
  g.strokeStyle = 'rgba(120,100,140,0.35)'; g.lineWidth = 0.4; g.beginPath();
  for (let k = 36; k < VIEW_W - 36; k += 10) { g.moveTo(k, HORIZON - 5); g.lineTo(k + 5, HORIZON + 4); g.moveTo(k + 5, HORIZON + 4); g.lineTo(k + 10, HORIZON - 5); }
  g.stroke();
  // roof supports
  g.fillStyle = '#251c30'; for (const sx of [128, 248, 392, 512]) g.fillRect(sx, HORIZON + 7, 1.6, STAND_BOT - HORIZON - 7);
  // front wall
  const fw = g.createLinearGradient(0, STAND_BOT - 3, 0, BOARDS);
  fw.addColorStop(0, '#3a2c44'); fw.addColorStop(1, '#1a1220');
  g.fillStyle = fw; g.fillRect(36, STAND_BOT - 3, VIEW_W - 72, BOARDS - STAND_BOT + 3);
}

function paintPitch(g, S, rng) {
  const N = 11;
  for (let i = 0; i < N; i++) {
    const y0 = PITCH_TOP + (PITCH_BOT + 10 - PITCH_TOP) * Math.pow(i / N, 1.45);
    const y1 = PITCH_TOP + (PITCH_BOT + 10 - PITCH_TOP) * Math.pow((i + 1) / N, 1.45);
    g.fillStyle = i % 2 ? '#24692c' : '#2c7a34';
    g.fillRect(0, y0, VIEW_W, y1 - y0 + 0.5);
  }
  // fine grass texture
  for (let i = 0; i < 2600; i++) {
    const x = rng() * VIEW_W, y = PITCH_TOP + rng() * (PITCH_BOT - PITCH_TOP + 10);
    g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(180,255,170,0.05)';
    g.fillRect(x, y, 0.5 + rng(), 0.35);
  }
  // distance falloff + floodlit pools
  const dg = g.createLinearGradient(0, PITCH_TOP, 0, PITCH_BOT);
  dg.addColorStop(0, 'rgba(10,8,30,0.45)'); dg.addColorStop(0.5, 'rgba(10,8,30,0.12)'); dg.addColorStop(1, 'rgba(10,8,30,0.25)');
  g.fillStyle = dg; g.fillRect(0, PITCH_TOP, VIEW_W, PITCH_BOT - PITCH_TOP + 10);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [px, py, r] of [[150, 248, 170], [490, 248, 170], [320, 262, 210]]) softEllipse(g, px, py, r, r * 0.3, 'rgba(210,255,190,0.14)', 'rgba(210,255,190,0)');
  g.restore();
  // markings
  g.strokeStyle = 'rgba(240,250,240,0.78)'; g.lineWidth = 0.9; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-5, PITCH_TOP + 2.5); g.lineTo(VIEW_W + 5, PITCH_TOP + 2.5);                          // far touchline
  g.moveTo(320, PITCH_TOP + 2.5); g.lineTo(320, PITCH_BOT + 6);                                   // halfway line
  g.moveTo(-5, PITCH_TOP + 21); g.lineTo(54, PITCH_TOP + 21); g.lineTo(72, PITCH_BOT - 14); g.lineTo(-5, PITCH_BOT - 14);
  g.moveTo(VIEW_W + 5, PITCH_TOP + 21); g.lineTo(VIEW_W - 54, PITCH_TOP + 21); g.lineTo(VIEW_W - 72, PITCH_BOT - 14); g.lineTo(VIEW_W + 5, PITCH_BOT - 14);
  g.stroke();
  g.lineWidth = 1.0;
  g.beginPath(); g.ellipse(320, 250, 74, 17, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(240,250,240,0.85)'; g.beginPath(); g.ellipse(320, 250, 1.6, 0.8, 0, 0, Math.PI * 2); g.fill();
  // the stand's shadow line along the far touchline
  const sh = g.createLinearGradient(0, PITCH_TOP, 0, PITCH_TOP + 8);
  sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(0, PITCH_TOP, VIEW_W, 8);
}

function paintTower(g, S, fx) {
  // tapered lattice mast
  const top = 44, bot = 300, wt = 3, wb = 9;
  g.strokeStyle = '#0d0a16'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(fx - wt, top); g.lineTo(fx - wb, bot); g.moveTo(fx + wt, top); g.lineTo(fx + wb, bot); g.stroke();
  g.lineWidth = 0.55; g.beginPath();
  let side = 0;
  for (let y = top; y < bot; y += 9) {
    const k0 = (y - top) / (bot - top), k1 = (y + 9 - top) / (bot - top);
    const a = wt + (wb - wt) * k0, b = wt + (wb - wt) * k1;
    g.moveTo(fx - a, y); g.lineTo(fx + a, y);
    if (side) { g.moveTo(fx - a, y); g.lineTo(fx + b, y + 9); } else { g.moveTo(fx + a, y); g.lineTo(fx - b, y + 9); }
    side ^= 1;
  }
  g.stroke();
  // rim light from the lamps
  g.strokeStyle = 'rgba(255,240,200,0.12)'; g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(fx - wt + 0.6, top); g.lineTo(fx - wb + 0.6, bot); g.stroke();
  // lamp head frame
  const hg = g.createLinearGradient(0, 18, 0, 46);
  hg.addColorStop(0, '#2a2434'); hg.addColorStop(1, '#0c0a12');
  g.fillStyle = hg;
  g.beginPath(); g.moveTo(fx - 19, 18); g.lineTo(fx + 19, 18); g.lineTo(fx + 17, 44); g.lineTo(fx - 17, 44); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.5; g.stroke();
}

function paintFence(g) {
  const top = PITCH_BOT - 28, bot = PITCH_BOT;
  g.fillStyle = 'rgba(30,24,40,0.55)'; g.fillRect(0, top, VIEW_W, bot - top);
  g.strokeStyle = 'rgba(120,110,140,0.32)'; g.lineWidth = 0.35;
  g.beginPath();
  for (let x = 0; x < VIEW_W; x += 2.6) { g.moveTo(x, top); g.lineTo(x + 2.6, top + 2.6 * 4); }
  for (let x = 0; x < VIEW_W; x += 2.6) { g.moveTo(x + 2.6, top); g.lineTo(x, top + 2.6 * 4); }
  g.stroke();
  g.strokeStyle = 'rgba(120,110,140,0.22)';
  g.beginPath(); for (let y = top + 10; y < bot; y += 4) { g.moveTo(0, y); g.lineTo(VIEW_W, y); } g.stroke();
  // posts and rails
  for (let x = 6; x < VIEW_W; x += 44) {
    const pg = g.createLinearGradient(x - 1.2, 0, x + 1.2, 0);
    pg.addColorStop(0, '#5a5068'); pg.addColorStop(1, '#1a1422');
    g.fillStyle = pg; g.fillRect(x - 1.2, top - 3, 2.4, bot - top + 3);
  }
  const rg = g.createLinearGradient(0, top - 3, 0, top);
  rg.addColorStop(0, '#9a90a8'); rg.addColorStop(1, '#3a3246');
  g.fillStyle = rg; g.fillRect(0, top - 3, VIEW_W, 2.6);
  g.fillStyle = '#2a2234'; g.fillRect(0, bot - 3, VIEW_W, 3);
}

function buildStatic(S) {
  const L = layer(S, VIEW_W, VIEW_H), g = L.g;
  const rng = makeRng(1986);
  paintSky(g, S, rng);
  paintSkyline(g, S, rng);
  paintStand(g, S);
  paintPitch(g, S, rng);
  for (const [fx] of TOWERS) paintTower(g, S, fx);
  paintFence(g);
  // terrace floor (behind the near crowd)
  const tg = g.createLinearGradient(0, PITCH_BOT, 0, VIEW_H);
  tg.addColorStop(0, '#1a0e16'); tg.addColorStop(1, '#0a0508');
  g.fillStyle = tg; g.fillRect(0, PITCH_BOT, VIEW_W, VIEW_H - PITCH_BOT);
  return L;
}

// far crowd: three interleaved layers that bounce out of phase
function buildCrowd(S, far) {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const L = layer(S, VIEW_W, STAND_BOT - STAND_TOP + 12), g = L.g;
    for (const p of far) {
      if (p.layer !== k) continue;
      const y = p.y - STAND_TOP + 6, s = p.s;
      g.fillStyle = p.c;
      g.beginPath(); g.ellipse(p.x, y + 1.4 * s, 1.35 * s, 1.6 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.skin;
      g.beginPath(); g.arc(p.x, y - 0.9 * s, 0.85 * s, 0, Math.PI * 2); g.fill();
      if (p.scarf) {
        g.fillStyle = RED; g.fillRect(p.x - 2.2 * s, y - 3 * s, 4.4 * s, 0.9 * s);
        g.fillStyle = WHITE; g.fillRect(p.x - 0.6 * s, y - 3 * s, 1.2 * s, 0.9 * s);
      }
    }
    // under-roof shadow at the back, floodlight on the front rows
    g.globalCompositeOperation = 'source-atop';
    const sg = g.createLinearGradient(0, 0, 0, L.h);
    sg.addColorStop(0, 'rgba(0,0,0,0.72)'); sg.addColorStop(0.6, 'rgba(0,0,0,0.25)'); sg.addColorStop(1, 'rgba(255,240,220,0.06)');
    g.fillStyle = sg; g.fillRect(0, 0, L.w, L.h);
    g.globalCompositeOperation = 'source-over';
    out.push(L);
  }
  return out;
}

// LED advertising strip (scrolls)
function buildAds(S) {
  const pad = 14, h = 11;
  let total = 0;
  const px = sizeForCap(FONT.ui, 800, 5.4);
  const mg = document.createElement('canvas').getContext('2d');
  mg.font = `800 ${px}px ${FONT.ui}`;
  const items = ADS.map(([t, bg, fg]) => { const w = mg.measureText(t).width * 1.12 + pad * 2; total += w; return { t, bg, fg, w }; });
  const L = layer(S, total, h), g = L.g;
  let x = 0;
  for (const it of items) {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, it.bg); bg.addColorStop(1, it.bg === '#f4f1e8' ? '#c8c2b4' : '#000000');
    g.fillStyle = it.bg; g.fillRect(x, 0, it.w, h);
    g.globalAlpha = 0.35; g.fillStyle = bg; g.fillRect(x, 0, it.w, h); g.globalAlpha = 1;
    g.font = `800 ${px}px ${FONT.ui}`;
    if ('letterSpacing' in g) g.letterSpacing = (px * 0.12).toFixed(2) + 'px';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = it.fg; g.shadowBlur = 3 * S;
    g.fillStyle = it.fg; g.fillText(filterText(it.t), x + it.w / 2, h / 2 + 0.4);   // (NORDHAMN FERRIES -> your club)
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + it.w - 0.5, 0, 0.5, h);
    x += it.w;
  }
  // LED pixel grid
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let yy = 0; yy < h; yy += 1.1) g.fillRect(0, yy, total, 0.35);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, total, 0.5);
  return L;
}

function buildGlow(S, r, col, a0 = 0.9) {
  const L = layer(S, r * 2, r * 2), g = L.g;
  const rg = g.createRadialGradient(r, r, 0, r, r, r);
  rg.addColorStop(0, `rgba(${col},${a0})`); rg.addColorStop(0.18, `rgba(${col},${a0 * 0.45})`); rg.addColorStop(0.5, `rgba(${col},${a0 * 0.1})`); rg.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = rg; g.fillRect(0, 0, r * 2, r * 2);
  return L;
}

// volumetric floodlight cone pointing down and inwards
function buildBeam(S, dir) {
  const len = 260, spread = 120, w = 360;
  const L = layer(S, w, len), g = L.g;
  const ox = dir > 0 ? 40 : w - 40;
  const lg = g.createLinearGradient(0, 0, 0, len);
  lg.addColorStop(0, 'rgba(255,248,225,0.28)'); lg.addColorStop(0.35, 'rgba(255,248,225,0.10)'); lg.addColorStop(1, 'rgba(255,248,225,0)');
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(ox - 12, 0); g.lineTo(ox + 12, 0);
  g.lineTo(ox + dir * 170 + spread, len); g.lineTo(ox + dir * 170 - spread, len);
  g.closePath(); g.fill();
  // brighter core
  const cg = g.createLinearGradient(0, 0, 0, len * 0.8);
  cg.addColorStop(0, 'rgba(255,250,235,0.22)'); cg.addColorStop(1, 'rgba(255,250,235,0)');
  g.fillStyle = cg;
  g.beginPath(); g.moveTo(ox - 5, 0); g.lineTo(ox + 5, 0); g.lineTo(ox + dir * 150 + 30, len * 0.8); g.lineTo(ox + dir * 150 - 30, len * 0.8); g.closePath(); g.fill();
  return { L, ox };
}

function buildPuff(S) {
  const r = 16, L = layer(S, r * 2, r * 2), g = L.g;
  const rg = g.createRadialGradient(r, r, 0, r, r, r);
  rg.addColorStop(0, 'rgba(200,170,185,0.55)'); rg.addColorStop(0.5, 'rgba(150,120,140,0.28)'); rg.addColorStop(1, 'rgba(120,100,120,0)');
  g.fillStyle = rg; g.fillRect(0, 0, r * 2, r * 2);
  return L;
}

// terrace fans, seen from behind and rim-lit by the flares. kinds: still, arms (up/down), scarf
function buildFan(S, body, hair, kind, armsUp) {
  const L = layer(S, 36, 76), g = L.g;
  const ax = 18, ay = 44;                                 // anchor: shoulder line centre
  const rim = 'rgba(255,110,70,0.75)';
  const arm = (side) => {
    const sx = ax + side * 7.5, sy = ay + 2;
    const hx = ax + side * (armsUp ? 10 : 11), hy = armsUp ? ay - 22 : ay - 9;
    g.strokeStyle = body; g.lineWidth = 4.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + side * 3, (sy + hy) / 2, hx, hy); g.stroke();
    g.strokeStyle = rim; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(sx + side * 1.5, sy - 1); g.quadraticCurveTo(sx + side * 4.6, (sy + hy) / 2, hx + side * 1.6, hy); g.stroke();
    g.fillStyle = '#b07a64'; g.beginPath(); g.arc(hx, hy - 1.2, 2, 0, Math.PI * 2); g.fill();
    return [hx, hy];
  };
  let hands = null;
  if (kind !== 'still') hands = [arm(-1), arm(1)];
  // torso
  const tg = g.createLinearGradient(0, ay - 2, 0, ay + 32);
  tg.addColorStop(0, body); tg.addColorStop(1, '#050306');
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(ax - 10, ay + 32); g.lineTo(ax - 10.5, ay + 6); g.quadraticCurveTo(ax - 10, ay - 1, ax - 3, ay - 1.5);
  g.lineTo(ax + 3, ay - 1.5); g.quadraticCurveTo(ax + 10, ay - 1, ax + 10.5, ay + 6); g.lineTo(ax + 10, ay + 32); g.closePath(); g.fill();
  g.strokeStyle = rim; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(ax - 10.3, ay + 8); g.quadraticCurveTo(ax - 10, ay - 1, ax - 3, ay - 1.5); g.lineTo(ax + 3, ay - 1.5); g.quadraticCurveTo(ax + 10, ay - 1, ax + 10.3, ay + 8); g.stroke();
  // neck + head (back of)
  g.fillStyle = '#7a4c3c'; g.fillRect(ax - 2.4, ay - 4.5, 4.8, 4);
  const hg = g.createRadialGradient(ax, ay - 12, 1, ax, ay - 9, 7);
  hg.addColorStop(0, hair === 'bald' ? '#c09078' : shadeC(hair, 0.25)); hg.addColorStop(1, hair === 'bald' ? '#6a4434' : hair);
  g.fillStyle = hg; g.beginPath(); g.ellipse(ax, ay - 9, 4.6, 5.4, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,120,80,0.6)'; g.lineWidth = 0.6;
  g.beginPath(); g.ellipse(ax, ay - 9, 4.6, 5.4, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.fillStyle = '#9a6450'; g.beginPath(); g.ellipse(ax - 4.6, ay - 8.5, 0.9, 1.6, 0, 0, Math.PI * 2); g.ellipse(ax + 4.6, ay - 8.5, 0.9, 1.6, 0, 0, Math.PI * 2); g.fill();
  if (kind === 'scarf' && hands) {
    // scarf held taut overhead
    const [[x0, y0], [x1, y1]] = hands;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      g.fillStyle = i % 2 ? WHITE : RED;
      g.beginPath();
      g.moveTo(x0 + (x1 - x0) * a, y0 - 3.6 + Math.sin(a * Math.PI) * 1.2); g.lineTo(x0 + (x1 - x0) * b, y0 - 3.6 + Math.sin(b * Math.PI) * 1.2);
      g.lineTo(x0 + (x1 - x0) * b, y0 + 0.6 + Math.sin(b * Math.PI) * 1.2); g.lineTo(x0 + (x1 - x0) * a, y0 + 0.6 + Math.sin(a * Math.PI) * 1.2); g.closePath(); g.fill();
    }
    g.strokeStyle = RED; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x0 - 0.5, y0); g.lineTo(x0 - 1.5, y0 + 6); g.moveTo(x1 + 0.5, y1); g.lineTo(x1 + 1.5, y1 + 6); g.stroke();
  }
  return L;
}
function shadeC(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(c + (255 - c) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---------------------------------------------------------------- the backdrop
export class Backdrop {
  constructor() {
    this.t = 0;
    this.ready = true;
    this.smoke = [];
    this.sparks = [];
    this.flashes = [];
    this.caches = new Map();
    const rng = makeRng(42);
    // far crowd: tiers of supporters, slightly larger toward the front
    this.far = [];
    const rows = 10;
    for (let row = 0; row < rows; row++) {
      const y = STAND_TOP + 4 + row * 5.8, s = 0.82 + row * 0.04;
      for (let x = 40 + (row % 2) * 1.7; x < VIEW_W - 40; x += 3.5 * s) {
        if (rng() < 0.06) continue;
        const r = rng();
        this.far.push({ x: x + (rng() - 0.5) * 0.6, y, s, layer: Math.floor(rng() * 3), c: r < 0.5 ? RED : r < 0.75 ? '#e8e2d6' : r < 0.88 ? '#2a2030' : '#7a0c20', skin: rng() < 0.85 ? '#d0a088' : '#8a5c48', scarf: rng() < 0.14 });
      }
    }
    // terrace crowd in front (backs of heads, arms, held scarves)
    this.near = [];
    for (let row = 0; row < 4; row++) {
      const y = 306 + row * 15;
      for (let x = -12 + (row % 2) * 9; x < VIEW_W + 12; x += 16 + rng() * 6) {
        const r = rng();
        this.near.push({ x, y: y + rng() * 4, row, ph: rng() * 6, kind: r < 0.16 ? 'scarf' : r < 0.4 ? 'arms' : 'still', v: Math.floor(rng() * 4), s: 0.92 + row * 0.08 + rng() * 0.06 });
      }
    }
    this.near.sort((a, b) => a.y - b.y);
    this.flares = [{ x: 96, y: 304 }, { x: 352, y: 310 }, { x: 556, y: 302 }];
    this.flags = [{ x: 196, y: 258, w: 50, h: 30, ph: 0 }, { x: 468, y: 262, w: 42, h: 25, ph: 2 }];
    this.stars = [];
    for (let i = 0; i < 26; i++) this.stars.push({ x: rng() * VIEW_W, y: Math.pow(rng(), 1.3) * 104, ph: rng() * 10, f: 0.8 + rng() * 1.6 });
    this.refreshLook();
  }

  refreshLook() {
    this.lads = [0, 1, 2, 3, 4].map(i => ({
      look: i === 2 ? buildLook(save.data.outfit) : casualLook(makeRng(i * 7 + 3), { a: RED, b: WHITE }),
      x: [196, 258, 320, 382, 444][i], anim: i === 2 ? 'guard' : i % 2 ? 'cheer' : 'idle', ph: i * 0.37, scale: i === 2 ? 2 : 1.6,
      yaw: [0.55, 0.3, 0, -0.3, -0.55][i], h: i === 2 ? 112 : 92, feet: i === 2 ? 356 : 350,
    }));
  }

  build() { /* caches are built lazily per output resolution */ }

  cache(S) {
    const key = Math.round(S * 100);
    let c = this.caches.get(key);
    if (c) return c;
    if (this.caches.size >= 2) this.caches.delete(this.caches.keys().next().value);
    const BODY = ['#1c1018', '#14101c', '#2a0a12', '#181418'], HAIR = ['#0e0a0a', '#2a1a10', '#4a3020', 'bald'];
    c = {
      static: buildStatic(S),
      crowd: buildCrowd(S, this.far),
      ads: buildAds(S),
      lampGlow: buildGlow(S, 70, '255,250,225', 0.95),
      lampCore: buildGlow(S, 8, '255,255,245', 1),
      flareGlow: buildGlow(S, 80, '255,80,40', 0.7),
      sparkGlow: buildGlow(S, 4, '255,220,140', 1),
      beamL: buildBeam(S, 1), beamR: buildBeam(S, -1),
      puff: buildPuff(S),
      fans: [],
    };
    for (let v = 0; v < 4; v++) {
      c.fans.push({
        still: buildFan(S, BODY[v], HAIR[v], 'still', false),
        down: buildFan(S, BODY[v], HAIR[v], 'arms', false),
        up: buildFan(S, BODY[v], HAIR[v], 'arms', true),
        scarf: buildFan(S, BODY[v], HAIR[(v + 1) % 4], 'scarf', true),
      });
    }
    this.caches.set(key, c);
    return c;
  }

  update(dt) {
    this.t += dt;
    for (const f of this.flares) {
      if (Math.random() < dt * 12) this.smoke.push({ x: f.x + (Math.random() - 0.5) * 4, y: f.y - 6, vx: 6 + Math.random() * 10, vy: -12 - Math.random() * 10, life: 0, max: 3.5 + Math.random() * 2.5, r: 0.5 + Math.random() * 0.4, rot: Math.random() * 6 });
      if (Math.random() < dt * 34) this.sparks.push({ x: f.x, y: f.y - 5, vx: (Math.random() - 0.5) * 46, vy: -30 - Math.random() * 46, life: 0, max: 0.4 + Math.random() * 0.4 });
    }
    for (const s of this.smoke) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 0.995; s.vx += dt * 3; }
    this.smoke = this.smoke.filter(s => s.life < s.max).slice(-120);
    for (const s of this.sparks) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 120 * dt; }
    this.sparks = this.sparks.filter(s => s.life < s.max);
    // camera flashes in the far stand
    if (Math.random() < dt * 3.5) { const p = this.far[Math.floor(Math.random() * this.far.length)]; this.flashes.push({ x: p.x, y: p.y - 1, life: 0 }); }
    for (const f of this.flashes) f.life += dt;
    this.flashes = this.flashes.filter(f => f.life < 0.12);
  }

  // The menus' background: a photo of the North Stand at old Råsunda (AIK, November 2012: flares, smoke, floodlights;
  // assets/bg/rasunda.jpg, see assets/bg/CREDITS.md), slowly drifting, graded dark at the edges so text reads on it.
  // Until it has loaded, the drawn stadium below stands in.
  photo() {
    if (!this._photo && typeof Image !== 'undefined') {
      this._photo = new Image();
      this._photo.src = new URL('../../assets/bg/rasunda.jpg', import.meta.url).href;
    }
    const im = this._photo;
    return im && im.complete && im.naturalWidth ? im : null;
  }

  draw(ctx, opts = {}) {
    if (opts === false || opts === true) opts = { lads: opts };
    const im = this.photo();
    if (im) {
      const t = this.t;
      // cover the screen, with a slow zoom and pan (Ken Burns)
      const z = 1.06 + Math.sin(t * 0.045) * 0.04;
      const k = Math.max(VIEW_W / im.naturalWidth, VIEW_H / im.naturalHeight) * z;
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      const x = (VIEW_W - w) / 2 + Math.sin(t * 0.031) * (w - VIEW_W) * 0.35, y = (VIEW_H - h) / 2 + Math.cos(t * 0.027) * (h - VIEW_H) * 0.25;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, x, y, w, h);
      // grade: darker top and bottom, a touch of the red flare light breathing
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, 'rgba(6,3,12,0.62)'); g.addColorStop(0.35, 'rgba(6,3,12,0.18)'); g.addColorStop(0.7, 'rgba(6,3,12,0.25)'); g.addColorStop(1, 'rgba(6,3,12,0.8)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(120,20,24,${0.05 + Math.sin(t * 7) * 0.02 + Math.sin(t * 2.3) * 0.02})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
      // vignette
      const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      if (opts.lads) this.drawLads(ctx, t);
      if (opts.dim) { ctx.fillStyle = `rgba(4,2,10,${opts.dim})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
      return;
    }
    const S = devScale(ctx), C = this.cache(S), t = this.t;
    blit(ctx, C.static, 0, 0);
    // twinkling stars
    for (const s of this.stars) {
      const k = Math.sin(t * s.f + s.ph);
      if (k < 0.4) continue;
      ctx.globalAlpha = (k - 0.4) / 0.6;
      ctx.drawImage(C.sparkGlow.c, s.x - 3, s.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    // crane aviation lights
    if (Math.sin(t * 3) > 0) for (const cx of [26, 592]) { ctx.drawImage(C.sparkGlow.c, cx - 4, HORIZON - 90, 8, 8); }
    // far crowd: three tiers bouncing out of phase
    C.crowd.forEach((L, i) => blit(ctx, L, 0, STAND_TOP - 6 - Math.max(0, Math.sin(t * 5 + i * 2.1)) * 0.9));
    // scarf wave rolling along the stand
    const wave = (t * 110) % (VIEW_W + 240) - 120;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const wg = ctx.createLinearGradient(wave - 40, 0, wave + 40, 0);
    wg.addColorStop(0, 'rgba(255,60,80,0)'); wg.addColorStop(0.5, 'rgba(255,90,100,0.16)'); wg.addColorStop(1, 'rgba(255,60,80,0)');
    ctx.fillStyle = wg; ctx.fillRect(wave - 40, STAND_TOP, 80, STAND_BOT - STAND_TOP);
    for (const f of this.flashes) { ctx.globalAlpha = 1 - f.life / 0.12; ctx.drawImage(C.sparkGlow.c, f.x - 4, f.y - 4, 8, 8); }
    ctx.restore();
    // LED boards (scroll)
    const A = C.ads, off = (t * 14) % A.w;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, BOARDS, VIEW_W, A.h); ctx.clip();
    for (let x = -off; x < VIEW_W; x += A.w) ctx.drawImage(A.c, x, BOARDS, A.w, A.h);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, BOARDS + A.h, VIEW_W, 0.8);
    // floodlights: lamps, beams, glare
    for (const [fx, dir] of TOWERS) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const beam = dir > 0 ? C.beamL : C.beamR;
      ctx.globalAlpha = 0.8 + Math.sin(t * 0.7 + fx) * 0.12;
      blit(ctx, beam.L, fx - beam.ox, 38);
      ctx.globalAlpha = 1;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
        const flick = (Math.floor(t * 4 + r * 3 + c * 7) % 29) === 0;
        ctx.globalAlpha = flick ? 0.35 : 1;
        ctx.drawImage(C.lampCore.c, fx - 16 + c * 6.4 - 4, 21 + r * 7.2 - 4, 8, 8);
      }
      ctx.globalAlpha = 0.85 + Math.sin(t * 1.3 + fx) * 0.08;
      blit(ctx, C.lampGlow, fx - 70, 31 - 70);
      // anamorphic streak
      const sg = ctx.createLinearGradient(fx - 90, 0, fx + 90, 0);
      sg.addColorStop(0, 'rgba(200,220,255,0)'); sg.addColorStop(0.5, 'rgba(230,240,255,0.55)'); sg.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = sg; ctx.fillRect(fx - 90, 30.5, 180, 0.9);
      ctx.restore();
    }
    // flags on the near terrace
    for (const f of this.flags) this.drawFlag(ctx, f, t);
    // flare glow behind the terrace crowd
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flares) { ctx.globalAlpha = 0.7 + Math.sin(t * 23 + f.x) * 0.12 + Math.sin(t * 7) * 0.08; blit(ctx, C.flareGlow, f.x - 80, f.y - 90); }
    ctx.restore();
    // terrace crowd
    for (const p of this.near) {
      const bounce = Math.max(0, Math.sin(t * 5.5 + p.ph)) * 2.6;
      const F = C.fans[p.v];
      const spr = p.kind === 'still' ? F.still : p.kind === 'scarf' ? F.scarf : (Math.sin(t * 5.5 + p.ph) > -0.2 ? F.up : F.down);
      const w = spr.w * p.s, h = spr.h * p.s;
      ctx.drawImage(spr.c, p.x - w / 2, p.y - bounce - 44 * p.s, w, h);
    }
    // flares + sparks + smoke
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flares) {
      ctx.fillStyle = '#3a1418'; ctx.fillRect(f.x - 1, f.y - 2, 2.2, 12);
      ctx.globalAlpha = 0.9 + Math.sin(t * 40 + f.x) * 0.1;
      ctx.drawImage(C.lampCore.c, f.x - 6, f.y - 11, 12, 12);
      ctx.drawImage(C.flareGlow.c, f.x - 16, f.y - 21, 32, 32);
      ctx.globalAlpha = 1;
    }
    for (const s of this.sparks) {
      const k = s.life / s.max;
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(C.sparkGlow.c, s.x - 2, s.y - 2, 4, 4);
    }
    ctx.restore();
    for (const s of this.smoke) {
      const k = s.life / s.max, r = (6 + k * 26) * s.r * 2;
      ctx.globalAlpha = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k) * 0.55;
      ctx.drawImage(C.puff.c, s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    // red flare light over the terrace + floor shadow
    const tg = ctx.createLinearGradient(0, 270, 0, VIEW_H);
    tg.addColorStop(0, 'rgba(170,24,30,0)'); tg.addColorStop(0.4, `rgba(170,24,30,${0.12 + Math.sin(t * 9) * 0.02})`); tg.addColorStop(1, 'rgba(10,2,6,0.55)');
    ctx.fillStyle = tg; ctx.fillRect(0, 270, VIEW_W, VIEW_H - 270);
    if (opts.lads) this.drawLads(ctx, t);
    if (opts.dim) {
      ctx.fillStyle = `rgba(4,2,10,${opts.dim})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // the firm in front: rigged 3D characters when available, else the 2D dolls
  drawLads(ctx, t) {
    // contact shadows / flare light on the ground
    for (const l of this.lads) {
      const g = ctx.createRadialGradient(l.x, l.feet, 0, l.x, l.feet, l.h * 0.3);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(l.x, l.feet, l.h * 0.3, l.h * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    }
    const stage = r3d.menu;
    if (stage && stage.ready && stage.draw(ctx, 'lads', this.lads.map(l => ({ look: l.look, x: l.x, feet: l.feet, h: l.h, anim: l.anim, phase: l.ph, yaw: l.yaw })), { x: 120, y: 210, w: 400, h: 150 }, t, { light: 'terrace' })) return;
    const sorted = [...this.lads].sort((a, b) => a.scale - b.scale);
    for (const l of sorted) {
      const flip = l.x > VIEW_W / 2;
      drawDoll(ctx, l.x, l.feet + 2, l.look, sampleAnim(l.anim, t + l.ph), { flip, time: t, face: l.anim === 'guard' ? 'angry' : 'shout', scale: l.scale });
    }
  }

  drawFlag(ctx, f, t) {
    // pole
    const pg = ctx.createLinearGradient(f.x - 1, 0, f.x + 1, 0);
    pg.addColorStop(0, '#6a6070'); pg.addColorStop(1, '#16101c');
    ctx.fillStyle = pg; ctx.fillRect(f.x - 1, f.y - 5, 2, 74);
    ctx.fillStyle = '#d8c070'; ctx.beginPath(); ctx.arc(f.x, f.y - 6, 1.6, 0, Math.PI * 2); ctx.fill();
    const N = 18, stripes = 5;
    const off = x => Math.sin(t * 4 + f.ph - x * 0.16) * (x / f.w) * 4.2;
    ctx.save();
    for (let i = 0; i < N; i++) {
      const x0 = i / N * f.w, x1 = (i + 1) / N * f.w;
      const o0 = off(x0), o1 = off(x1);
      for (let s = 0; s < stripes; s++) {
        const y0 = f.y + s * f.h / stripes, y1 = y0 + f.h / stripes;
        ctx.fillStyle = s % 2 ? WHITE : RED;
        ctx.beginPath();
        ctx.moveTo(f.x + 1 + x0, y0 + o0); ctx.lineTo(f.x + 1 + x1 + 0.3, y0 + o1); ctx.lineTo(f.x + 1 + x1 + 0.3, y1 + o1 + 0.3); ctx.lineTo(f.x + 1 + x0, y1 + o0 + 0.3);
        ctx.closePath(); ctx.fill();
      }
      // fold shading
      const shade = Math.sin(t * 4 + f.ph - x0 * 0.16 - 0.8) * 0.3;
      ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${(shade * 0.45).toFixed(3)})` : `rgba(0,0,0,${(-shade * 0.9).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(f.x + 1 + x0, f.y + o0); ctx.lineTo(f.x + 1 + x1 + 0.3, f.y + o1); ctx.lineTo(f.x + 1 + x1 + 0.3, f.y + f.h + o1); ctx.lineTo(f.x + 1 + x0, f.y + f.h + o0); ctx.closePath(); ctx.fill();
    }
    // anchor emblem
    const cx = f.x + 1 + f.w / 2, cy = f.y + f.h / 2 + off(f.w / 2);
    ctx.strokeStyle = '#120c14'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 6); ctx.moveTo(cx - 3.5, cy - 4); ctx.lineTo(cx + 3.5, cy - 4);
    ctx.moveTo(cx - 6, cy + 2); ctx.quadraticCurveTo(cx - 5, cy + 7, cx, cy + 6.5); ctx.quadraticCurveTo(cx + 5, cy + 7, cx + 6, cy + 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 8.2, 1.4, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

export const backdrop = new Backdrop();
