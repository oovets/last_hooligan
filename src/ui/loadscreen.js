// Loading screen (shown while the environment sprites, fonts and 3D models load): full-resolution vector art —
// a floodlit haze, the wordmark and a glowing progress bar. Drawn by main.js before any scene module is ready.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { FONT, sizeForCap } from '../engine/font.js';

const S = ctx => (ctx.getTransform ? ctx.getTransform().a : 2) || 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawLoading(ctx, t, k) {
  const s = S(ctx);
  // background: deep night with a red under-glow
  const bg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.62, 10, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.75);
  bg.addColorStop(0, '#2c0c1e'); bg.addColorStop(0.45, '#120818'); bg.addColorStop(1, '#040308');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // two slow floodlight beams
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x0, dir] of [[90, 1], [VIEW_W - 90, -1]]) {
    const sway = Math.sin(t * 0.6 + x0) * 14;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, 'rgba(255,246,220,0.10)'); g.addColorStop(1, 'rgba(255,246,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0 - 6, -10); ctx.lineTo(x0 + 6, -10);
    ctx.lineTo(x0 + dir * 220 + 90 + sway, VIEW_H); ctx.lineTo(x0 + dir * 220 - 90 + sway, VIEW_H); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // wordmark
  const cy = VIEW_H / 2 - 18;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let px = sizeForCap(FONT.ui, 700, 7);
  ctx.font = `700 ${px.toFixed(2)}px ${FONT.ui}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillStyle = '#cfc6dc'; ctx.fillText('THE LAST', VIEW_W / 2 + 1.5, cy - 30);
  px = sizeForCap(FONT.display, 400, 30);
  ctx.font = `400 ${px.toFixed(2)}px ${FONT.display}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
  const g = ctx.createLinearGradient(0, cy - 30, 0, cy);
  g.addColorStop(0, '#ffd0c4'); g.addColorStop(0.48, '#ff4a3a'); g.addColorStop(0.5, '#7a0618'); g.addColorStop(0.56, '#e81c34'); g.addColorStop(1, '#8a0418');
  ctx.shadowColor = 'rgba(232,28,52,0.55)'; ctx.shadowBlur = 24 * s;
  ctx.fillStyle = g; ctx.fillText('HOOLIGAN', VIEW_W / 2, cy);
  ctx.restore();
  // progress bar
  const w = 220, h = 5, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 + 14;
  const shimmer = (Math.sin(t * 5) + 1) * 0.5;
  const f = Math.max(0.03, Math.min(1, k + (1 - k) * 0.04 * shimmer));
  ctx.save();
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.shadowColor = 'rgba(255,40,70,0.9)'; ctx.shadowBlur = 12 * s;
  const bg2 = ctx.createLinearGradient(x, 0, x + w, 0);
  bg2.addColorStop(0, '#8a0820'); bg2.addColorStop(1, '#ff3a50');
  rr(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fillStyle = bg2; ctx.fill();
  ctx.shadowColor = 'transparent';
  // travelling highlight
  const hx = x + ((t * 120) % (w * f + 40)) - 20;
  const hg = ctx.createLinearGradient(hx - 20, 0, hx + 20, 0);
  hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); rr(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.clip(); ctx.fillStyle = hg; ctx.fillRect(x, y, w, h); ctx.restore();
  // caption
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cpx = sizeForCap(FONT.ui, 600, 6);
  ctx.font = `600 ${cpx.toFixed(2)}px ${FONT.ui}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2.5px';
  ctx.fillStyle = `rgba(220,210,232,${0.55 + Math.sin(t * 3) * 0.25})`;
  ctx.fillText('LOADING  ' + Math.round(k * 100) + '%', VIEW_W / 2, y + 20);
  ctx.restore();
}
