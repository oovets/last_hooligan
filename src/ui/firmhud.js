// Firm controls + UI (phase C): quick orders, command mode (hold G: slow motion + mouse), lad markers and the HUD panel.
//
//   R  WITH ME!        T  GET INTO THEM!      H  HOLD!       Y  SING UP!  (to the selection, or everyone)
//   hold G  COMMAND MODE: time slows to 25%. 1-4 / click a lad = select (SHIFT adds), drag = box select,
//           click empty ground = select all. RIGHT-CLICK an enemy = HAVE HIM!, right-click the ground = OVER THERE!
//
// Drawing works for both renderers: the 3D camera uses the same projection, so world-space overlays line up.

import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { toScreen, toWorld } from '../engine/iso.js';
import { drawText } from '../engine/font.js';
import { input } from '../engine/input.js';
import { frame, C } from './widgets.js';
import { ORDER_TAG } from '../game/firm.js';

export const COMMAND_SLOW = 0.25;
const SEL_COL = '#ffd23a', LAD_COL = '#5ab0ff';
const shiftDown = () => input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');

// ------------------------------------------------------------------ input (called by PlayScene before world.update)
export function updateFirmInput(world, ui) {
  const F = world.firm;
  if (!F) return;
  const p = world.player;
  F.command = input.down('command') && p.alive;
  if (input.pressed('command') && p.alive) { ui.cmdSeen = (ui.cmdSeen || 0) + 1; }
  if (p.alive) {
    if (input.pressed('orderFollow')) F.order('follow');
    if (input.pressed('orderCharge')) F.order('charge');
    if (input.pressed('orderHold')) F.order('hold');
    if (input.pressed('orderSing')) F.order('sing');
  }
  if (!F.command) { ui.drag = null; return; }
  // number keys select lads while commanding (eating/drinking is off in command mode)
  const keys = ['item1', 'item2', 'item3', 'select4'];
  keys.forEach((k, i) => {
    if (input.pressed(k)) { const l = F.lads[i]; if (l && l.alive) F.select(l, shiftDown()); }
    input.consume(k);
  });
  const M = input.mouse, cam = world.camera;
  const ladAt = (sx, sy) => pickFighter(world, sx, sy, f => f.isLad && f.alive);
  if (M.pressed[0]) ui.drag = { x0: M.x, y0: M.y };
  if (ui.drag) { ui.drag.x1 = M.x; ui.drag.y1 = M.y; }
  if (M.released[0] && ui.drag) {
    const d = ui.drag; ui.drag = null;
    if (Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) < 6) {
      const l = ladAt(M.x, M.y);
      if (l) F.select(l, shiftDown()); else F.selected.clear();
    } else {
      const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      if (!shiftDown()) F.selected.clear();
      for (const l of F.lads) {
        if (!l.alive) continue;
        const s = toScreen(l.x, l.y, l.z + 0.8);
        const sx = s.x + cam.tx, sy = s.y + cam.ty;
        if (sx >= x0 && sx <= x1 && sy >= y0 - 12 && sy <= y1 + 12) F.selected.add(l);
      }
    }
  }
  if (M.pressed[2] && M.inside) {
    const foe = pickFighter(world, M.x, M.y, f => f.team !== 'player' && f.alive && !f.removed);
    if (foe) F.order('attack', { target: foe });
    else {
      const g = toWorld(M.x - cam.tx, M.y - cam.ty);
      if (world.heightAt(g.x, g.y) < 0.4 || world.heightAt(g.x, g.y) <= world.heightAt(p.x, p.y) + 0.35) F.order('move', { x: g.x, y: g.y });
      else world.toast("CAN'T GET THERE");
    }
  }
}

// fighter whose body is under the screen point (logical px)
function pickFighter(world, sx, sy, filter) {
  const cam = world.camera;
  let best = null, bd = 16;
  for (const f of world.fighters) {
    if (!filter(f)) continue;
    const s = toScreen(f.x, f.y, f.z + 0.9);
    const d = Math.hypot(s.x + cam.tx - sx, (s.y + cam.ty - sy) * 0.7);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

// ------------------------------------------------------------------ world-space overlay (rings, markers, tags)
export function drawFirmWorld(ctx, world) {
  const F = world.firm;
  if (!F) return;
  const cam = world.camera, t = world.time;
  ctx.save();
  ctx.translate(cam.tx, cam.ty);
  // order markers
  for (const m of F.markers) {
    const k = Math.min(1, m.t * 4), a = Math.max(0, 1 - m.t / 3);
    ctx.globalAlpha = a;
    if (m.kind === 'move') {
      const s = toScreen(m.x, m.y, 0);
      ring(ctx, s.x, s.y, 10 * (1.4 - 0.4 * k), 5 * (1.4 - 0.4 * k), SEL_COL);
      flag(ctx, s.x, s.y, SEL_COL);
    } else if (m.kind === 'attack' && m.target && m.target.alive) {
      const s = toScreen(m.target.x, m.target.y, m.target.z);
      ring(ctx, s.x, s.y, 13, 6.5, '#ff3a3a');
      ring(ctx, s.x, s.y, 9 + Math.sin(t * 12) * 1.5, 4.5, '#ffb0a0');
    }
  }
  ctx.globalAlpha = 1;
  // held positions
  for (const l of F.lads) {
    if (!l.alive) continue;
    const o = l.controller.order;
    if (o.type === 'hold' || o.type === 'move') { const s = toScreen(o.x, o.y, 0); ctx.globalAlpha = 0.55; flag(ctx, s.x, s.y, LAD_COL); ctx.globalAlpha = 1; }
  }
  // lads: feet ring, number, order tag, nerve
  F.lads.forEach((l, i) => {
    if (l.removed) return;
    const g = world.groundHeight(l.x, l.y, l.z);
    const s = toScreen(l.x, l.y, g);
    const sel = F.selected.has(l);
    if (l.alive) ring(ctx, s.x, s.y, sel ? 11 : 9, sel ? 5.5 : 4.5, sel ? SEL_COL : LAD_COL, sel ? 1 : 0.55);
    const head = toScreen(l.x, l.y, l.z);
    const sc = (l.look && l.look.height) || 1;
    const top = head.y - 62 * sc;
    if (!l.alive) { drawText(ctx, 'KO', head.x, head.y - 18, { color: '#ff7a7a', align: 'center', outline: '#000' }); return; }
    const o = l.controller.order;
    const tag = (i + 1) + (o.type !== 'follow' ? ' ' + ORDER_TAG[o.type] : '');
    drawText(ctx, tag, head.x, top, { color: sel ? SEL_COL : LAD_COL, align: 'center', outline: '#000' });
    if (l.routT > 0) drawText(ctx, '!!', head.x, top - 9, { color: Math.floor(t * 8) % 2 ? '#ff4a4a' : '#ffe14a', align: 'center', outline: '#000' });
    else if ((l.nerve ?? 100) < 50) bar(ctx, head.x - 9, top - 4, 18, l.nerve / 100, '#ff8a3a');
  });
  // enemies about to break (low nerve) wobble a little "?" so you know a push will scatter them
  if (F.lads.length) for (const e of world.fighters) {
    if (e.team === 'player' || !e.alive || e.boss || e.routed) continue;
    if ((e.nerve ?? 100) < 25) { const s = toScreen(e.x, e.y, e.z); drawText(ctx, '?', s.x + 9, s.y - 58, { color: '#ffe14a', align: 'center', outline: '#000' }); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ screen UI (command mode frame, drag box, cursor)
export function drawFirmScreen(ctx, world, ui) {
  const F = world.firm;
  if (!F) return;
  const t = world.time;
  if (F.command) {
    // tinted frame + header
    ctx.fillStyle = 'rgba(20,60,120,0.16)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(90,176,255,0.5)';
    ctx.fillRect(0, 0, VIEW_W, 2); ctx.fillRect(0, VIEW_H - 2, VIEW_W, 2); ctx.fillRect(0, 0, 2, VIEW_H); ctx.fillRect(VIEW_W - 2, 0, 2, VIEW_H);
    const hdr = 'COMMAND MODE';
    frame(ctx, VIEW_W / 2 - 172, 48, 344, 30, { fill: 'rgba(6,14,30,0.9)', accent: LAD_COL });
    drawText(ctx, hdr, VIEW_W / 2, 53, { color: LAD_COL, align: 'center', outline: '#000' });
    drawText(ctx, '1-4 / CLICK: SELECT   RIGHT-CLICK MAN: HAVE HIM   GROUND: GO', VIEW_W / 2, 65, { color: '#c0d8f0', align: 'center' });
    const d = ui.drag;
    if (d && Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) >= 6) {
      const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1);
      ctx.fillStyle = 'rgba(255,210,58,0.12)'; ctx.fillRect(x0, y0, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      ctx.strokeStyle = SEL_COL; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(Math.abs(d.x1 - d.x0)), Math.round(Math.abs(d.y1 - d.y0)));
    }
    const M = input.mouse;
    if (M.inside) {
      const foe = pickFighter(world, M.x, M.y, f => f.team !== 'player' && f.alive);
      const col = foe ? '#ff4a4a' : SEL_COL;
      ctx.fillStyle = '#000'; ctx.fillRect(M.x - 6, M.y - 1, 13, 3); ctx.fillRect(M.x - 1, M.y - 6, 3, 13);
      ctx.fillStyle = col; ctx.fillRect(M.x - 5, M.y, 11, 1); ctx.fillRect(M.x, M.y - 5, 1, 11);
      if (foe) drawText(ctx, 'HAVE HIM', M.x + 8, M.y + 6, { color: col, outline: '#000' });
    }
  }
}

// ------------------------------------------------------------------ HUD panel (under the player panel)
export function drawFirmPanel(ctx, world) {
  const F = world.firm;
  if (!F || !F.lads.length) return;
  const x = 6, y = 48, w = 150, rh = 12, h = 8 + F.lads.length * rh + 10;
  frame(ctx, x, y, w, h, { accent: LAD_COL, fill: 'rgba(6,10,22,0.82)', rivets: false });
  F.lads.forEach((l, i) => {
    const yy = y + 5 + i * rh;
    const sel = F.selected.has(l);
    const o = l.controller.order;
    drawText(ctx, String(i + 1), x + 5, yy, { color: sel ? SEL_COL : '#6a7a9a' });
    const name = l.name.replace('THE ', '').replace('TERRACE ', '').replace('LITTLE ', '').replace('BIG ', '');
    drawText(ctx, name.slice(0, 8), x + 14, yy, { color: !l.alive ? '#6a5a6a' : l.routT > 0 ? '#ff8a5a' : sel ? '#ffffff' : '#c8d8f0' });
    bar(ctx, x + 66, yy + 1, 38, Math.max(0, l.hp / l.maxHp), l.alive ? '#5aff7a' : '#4a2a2a');
    bar(ctx, x + 66, yy + 5, 38, Math.max(0, (l.nerve ?? 100) / 100), l.routT > 0 ? '#ff4a4a' : '#ffb03a');
    drawText(ctx, !l.alive ? 'KO' : l.routT > 0 ? 'RUN' : ORDER_TAG[o.type], x + w - 6, yy, { color: !l.alive ? '#ff7a7a' : '#7ac0ff', align: 'right' });
  });
  const sy = y + h - 9;
  const ready = F.singCd <= 0;
  drawText(ctx, ready ? 'Y SING UP: READY' : `Y SING UP: ${Math.ceil(F.singCd)}S`, x + 5, sy, { color: ready ? '#ffe14a' : '#6a6a7a' });
  drawText(ctx, 'G CMD', x + w - 6, sy, { color: '#7ac0ff', align: 'right' });
}

// ------------------------------------------------------------------ helpers
function ring(ctx, x, y, rx, ry, col, alpha = 1) {
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * alpha;
  ctx.fillStyle = col;
  const n = Math.max(16, Math.round(rx * 2.4));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1);
  }
  ctx.globalAlpha = pa;
}
function flag(ctx, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 15, 3, 16);
  ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x, y - 14, 1, 14);
  ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y - 15, 9, 7);
  ctx.fillStyle = col; ctx.fillRect(x + 1, y - 14, 8, 5);
}
function bar(ctx, x, y, w, k, col) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = '#1a1a26'; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), 2);
}
