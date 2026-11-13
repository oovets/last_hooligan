// Firm controls + UI (phase C): quick orders, command mode (hold G: slow motion + mouse), lad markers and the HUD panel.
//
//   R  WITH ME!        T  GET INTO THEM!      H  HOLD!       Y  SING UP!  (to the selection, or everyone)
//   pad: d-pad up GET INTO THEM, down WITH ME, left HOLD, right SING UP
//   hold G (pad RT)  COMMAND MODE: time slows to 25% and the leader stands still. An order cursor moves with the
//           movement keys / stick and snaps to men under it:
//             J (pad X)  on an enemy = HAVE HIM!, on the ground = OVER THERE!, on a lad = select him
//             K (pad Y)  cycle the selection: everyone -> 1 -> 2 -> ... -> everyone
//             L (pad B)  WITH ME!
//           Mouse works too: 1-4 / click a lad = select (SHIFT adds), drag = box select, click empty ground = select
//           all, RIGHT-CLICK an enemy = HAVE HIM!, right-click the ground = OVER THERE!
//
// Drawing works for both renderers: the 3D camera uses the same projection, so world-space overlays line up.

import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { toScreen, toWorld } from '../engine/iso.js';
import { drawText } from '../engine/font.js';
import { input } from '../engine/input.js';
import { frame, C } from './widgets.js';
import { ORDER_TAG } from '../game/firm.js';
import { moveToWorld } from '../game/player.js';

export const COMMAND_SLOW = 0.25;
const CURSOR_SPEED = 9;      // tiles per real second
const SNAP = 0.95;           // cursor snaps to a man this close (tiles)
const SEL_COL = '#ffd23a', LAD_COL = '#5ab0ff';
const short = n => n.replace('THE ', '').replace('TERRACE ', '').replace('LITTLE ', '').replace('BIG ', '');
const shiftDown = () => input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');

// ------------------------------------------------------------------ input (called by PlayScene before world.update)
export function updateFirmInput(world, ui, dt = 1 / 60) {
  const F = world.firm;
  if (!F) return;
  const p = world.player;
  F.command = input.down('command') && p.alive;
  if (input.pressed('command') && p.alive) {
    ui.cmdSeen = (ui.cmdSeen || 0) + 1;
    // the cursor starts on whoever you're fighting, else a few steps ahead of you
    const e = world.lastEnemy && world.lastEnemyT > 0 && world.lastEnemy.alive ? world.lastEnemy : null;
    ui.cur = e ? { x: e.x, y: e.y } : { x: p.x + p.fx * 2.5, y: p.y + p.fy * 2.5 };
  }
  if (p.alive) {
    if (input.pressed('orderFollow')) F.order('follow');
    if (input.pressed('orderCharge')) F.order('charge');
    if (input.pressed('orderHold')) F.order('hold');
    if (input.pressed('orderSing')) F.order('sing');
    if (input.pressed('orderRegroup')) F.order('regroup');
  }
  if (!F.command) { ui.drag = null; ui.hover = null; input.mouse.moved = false; return; }
  // presses used for orders must not leak into the leader (a jump/grab after G is released, even across hitstop)
  if (p.controller && p.controller.pollButtons) p.controller.pollButtons();
  updateCursor(world, ui, dt);
  // number keys select lads while commanding (eating/drinking is off in command mode)
  const keys = ['item1', 'item2', 'item3', 'select4'];
  keys.forEach((k, i) => {
    if (input.pressed(k)) { const l = F.lads[i]; if (l && l.alive) F.select(l, shiftDown()); }
    input.consume(k);
  });
  if (input.pressed('jump')) F.order('regroup');
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

// keyboard / pad order cursor (command mode)
function updateCursor(world, ui, dt) {
  const F = world.firm, p = world.player, M = input.mouse, cam = world.camera;
  const c = ui.cur || (ui.cur = { x: p.x, y: p.y });
  if (M.moved && M.inside) { const g = toWorld(M.x - cam.tx, M.y - cam.ty); c.x = g.x; c.y = g.y; ui.mouseAim = true; }
  M.moved = false;
  const m = input.move();
  if (m.mag > 0.1) {
    ui.mouseAim = false;
    const w = moveToWorld(m.x, m.y);
    c.x += w.x * m.mag * CURSOR_SPEED * dt; c.y += w.y * m.mag * CURSOR_SPEED * dt;
    // keep it on screen-ish: within 11 tiles of the leader
    const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy);
    if (d > 11) { c.x = p.x + dx / d * 11; c.y = p.y + dy / d * 11; }
  }
  // snap to a man under the cursor: any enemy within reach wins, a lad only when he's right under it
  let best = null, bd = SNAP;
  for (const f of world.fighters) {
    if (!f.alive || f.removed || f.isPlayer || f.team === 'player' || f.routed) continue;
    const d = Math.hypot(f.x - c.x, f.y - c.y);
    if (d < bd) { bd = d; best = f; }
  }
  if (!best) {
    bd = SNAP * 0.6;
    for (const l of F.lads) { if (!l.alive) continue; const d = Math.hypot(l.x - c.x, l.y - c.y); if (d < bd) { bd = d; best = l; } }
  }
  ui.hover = best;
  if (input.pressed('punchL')) {
    if (best && best.team !== 'player') F.order('attack', { target: best });
    else if (best && best.isLad) { F.select(best, true); world.sfx && world.sfx('menuMove', p); }
    else if (world.heightAt(c.x, c.y) < 0.4 || world.heightAt(c.x, c.y) <= world.heightAt(p.x, p.y) + 0.35) F.order('move', { x: c.x, y: c.y });
    else world.toast("CAN'T GET THERE");
  }
  if (input.pressed('grab') && best && best.team !== 'player') F.order('pin', { target: best });
  if (input.pressed('punchR')) {
    // everyone -> lad 1 -> lad 2 -> ... -> everyone
    const alive = F.lads.filter(l => l.alive);
    const cur = F.selected.size === 1 ? alive.indexOf([...F.selected][0]) : -1;
    F.selected.clear();
    if (cur + 1 < alive.length) F.selected.add(alive[cur + 1]);
    world.sfx && world.sfx('menuMove', p);
  }
  if (input.pressed('kick')) F.order('follow');
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
// who's who in a scrum: a ring under the player, and the man his next swing goes at (world.aimTarget) gets a red
// ring and a red arrow over his head. Drawn in every fight, firm or no firm.
export function drawAimMarkers(ctx, world) {
  const P = world.player;
  if (!P || !P.alive) return;
  const cam = world.camera, t = world.time;
  ctx.save();
  ctx.translate(cam.tx, cam.ty);
  const ps = toScreen(P.x, P.y, world.groundHeight(P.x, P.y, P.z));
  ring(ctx, ps.x, ps.y, 10, 5, '#ffd23a', 0.9);
  const e = world.aimTarget;
  if (e && e.alive && !e.removed) {
    const gs = toScreen(e.x, e.y, world.groundHeight(e.x, e.y, e.z));
    ring(ctx, gs.x, gs.y, 11, 5.5, '#ff3a3a');
    ring(ctx, gs.x, gs.y, 12, 6, '#7a0a0a', 0.6);
    const head = toScreen(e.x, e.y, e.z), sc = (e.look && e.look.height) || 1;
    const x = Math.round(head.x), y = Math.round(head.y - 66 * sc - 3 + Math.sin(t * 8) * 1.5);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff3a3a';
    ctx.beginPath(); ctx.moveTo(x - 3.5, y); ctx.lineTo(x + 3.5, y); ctx.lineTo(x, y + 4.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

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
    if (!l.alive) {
      drawText(ctx, 'KO', head.x, head.y - 18, { color: '#ff7a7a', align: 'center', outline: '#000' });
      const P = world.player;
      if (P.alive && F.canRevive(l, P) && !F.enemyOnTop(P)) drawText(ctx, input.hint('use') + ' PICK HIM UP', head.x, head.y - 28, { color: '#7affe0', align: 'center', outline: '#000' });
      else if (P.alive && !l.revivedThisFight && !l.removed && Math.hypot(l.x - P.x, l.y - P.y) < 3) drawText(ctx, 'GET TO HIM', head.x, head.y - 28, { color: '#4a8a7a', align: 'center', outline: '#000' });
      return;
    }
    const o = l.controller.order;
    const tag = (i + 1) + (o.type !== 'follow' ? ' ' + ORDER_TAG[o.type] : '');
    drawText(ctx, tag, head.x, top, { color: sel ? SEL_COL : LAD_COL, align: 'center', outline: '#000' });
    if (l.helpT > 0 && !(l.routT > 0)) drawText(ctx, 'HELP!', head.x, top - 9, { color: Math.floor(t * 6) % 2 ? '#ff4a4a' : '#ffffff', align: 'center', outline: '#000' });
    else if (l.routT > 0) drawText(ctx, '!!', head.x, top - 9, { color: Math.floor(t * 8) % 2 ? '#ff4a4a' : '#ffe14a', align: 'center', outline: '#000' });
    else if ((l.nerve ?? 100) < 50) bar(ctx, head.x - 9, top - 4, 18, l.nerve / 100, '#ff8a3a');
  });
  // enemies about to break (low nerve) wobble a little "?" so you know a push will scatter them
  if (F.lads.length) for (const e of world.fighters) {
    if (e.team === 'player' || !e.alive || e.boss || e.routed) continue;
    if ((e.nerve ?? 100) < 25) { const s = toScreen(e.x, e.y, e.z); drawText(ctx, '?', s.x + 9, s.y - 58, { color: '#ffe14a', align: 'center', outline: '#000' }); }
    if (e.grabbedBy && e.grabbedBy.pinning) { const s = toScreen(e.x, e.y, e.z); drawText(ctx, 'FREE HIT', s.x, s.y - 68, { color: Math.floor(t * 6) % 2 ? '#ffe14a' : '#ffffff', align: 'center', outline: '#000' }); }
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
    const hx = Math.max(VIEW_W / 2 - 172, 162), cx = hx + 172;   // clear of the firm panel on the left
    frame(ctx, hx, 48, 344, 40, { fill: 'rgba(6,14,30,0.9)', accent: LAD_COL });
    drawText(ctx, hdr, cx, 53, { color: LAD_COL, align: 'center', outline: '#000' });
    const pad = input.lastDevice === 'pad';
    const help = pad ? 'STICK: AIM   X: HAVE HIM / GO / PICK LAD   Y: WHO   B: WITH ME'
      : 'WASD: AIM   J: HAVE HIM / GO / PICK LAD   K: WHO   L: WITH ME   (OR MOUSE)';
    drawText(ctx, help, cx, 65, { color: '#c0d8f0', align: 'center' });
    drawText(ctx, pad ? 'LB: GRAB HIM (PIN)   A: BACK TO ME' : 'I: GRAB HIM (PIN)   SPACE: BACK TO ME', cx, 76, { color: '#c0d8f0', align: 'center' });
    // who the next order goes to
    const sel = [...F.selected].filter(l => l.alive);
    const who = sel.length ? 'ORDERS TO: ' + sel.map(l => short(l.name)).join(', ') : 'ORDERS TO: THE WHOLE FIRM';
    drawText(ctx, who, cx, 93, { color: sel.length ? SEL_COL : '#7ac0ff', align: 'center', outline: '#000' });
    const d = ui.drag;
    if (d && Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) >= 6) {
      const x0 = Math.min(d.x0, d.x1), y0 = Math.min(d.y0, d.y1);
      ctx.fillStyle = 'rgba(255,210,58,0.12)'; ctx.fillRect(x0, y0, Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      ctx.strokeStyle = SEL_COL; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(Math.abs(d.x1 - d.x0)), Math.round(Math.abs(d.y1 - d.y0)));
    }
    drawCursor(ctx, world, ui);
  }
}

// the order cursor: a ground ring where the next GO lands, red on an enemy (HAVE HIM), yellow on a lad (PICK)
function drawCursor(ctx, world, ui) {
  const c = ui.cur;
  if (!c) return;
  const cam = world.camera, t = world.time, h = ui.hover;
  ctx.save();
  ctx.translate(cam.tx, cam.ty);
  let s, col, label;
  if (h && h.team !== 'player') { s = toScreen(h.x, h.y, world.groundHeight(h.x, h.y, h.z)); col = '#ff4a4a'; label = input.lastDevice === 'pad' ? 'X HAVE HIM  LB GRAB HIM' : 'J HAVE HIM  I GRAB HIM'; }
  else if (h && h.isLad) { s = toScreen(h.x, h.y, world.groundHeight(h.x, h.y, h.z)); col = SEL_COL; label = 'PICK ' + short(h.name); }
  else { s = toScreen(c.x, c.y, world.groundHeight(c.x, c.y, 5)); col = SEL_COL; label = 'GO HERE'; }
  const pulse = 1 + Math.sin(t * 40) * 0.08;
  ring(ctx, s.x, s.y, 12 * pulse, 6 * pulse, '#000', 0.6);
  ring(ctx, s.x, s.y, 11 * pulse, 5.5 * pulse, col);
  ring(ctx, s.x, s.y, 5, 2.5, col, 0.7);
  if (!h) flag(ctx, s.x, s.y, col);
  drawText(ctx, label, s.x, s.y + 8, { color: col, align: 'center', outline: '#000' });
  ctx.restore();
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
    const name = short(l.name);
    drawText(ctx, name.slice(0, 8), x + 14, yy, { color: !l.alive ? '#6a5a6a' : l.routT > 0 ? '#ff8a5a' : sel ? '#ffffff' : '#c8d8f0' });
    bar(ctx, x + 66, yy + 1, 38, Math.max(0, l.hp / l.maxHp), l.alive ? '#5aff7a' : '#4a2a2a');
    bar(ctx, x + 66, yy + 5, 38, Math.max(0, (l.nerve ?? 100) / 100), l.routT > 0 ? '#ff4a4a' : '#ffb03a');
    const help = l.alive && l.helpT > 0, blink = Math.floor(world.time * 6) % 2;
    drawText(ctx, !l.alive ? 'KO' : l.routT > 0 ? 'RUN' : help ? 'HELP' : ORDER_TAG[o.type], x + w - 6, yy,
      { color: !l.alive ? '#ff7a7a' : help ? (blink ? '#ff4a4a' : '#ffe14a') : '#7ac0ff', align: 'right' });
  });
  const sy = y + h - 9;
  const ready = F.singCd <= 0;
  drawText(ctx, input.hint('orderSing') + ' SING' + (ready ? ': READY' : ` ${Math.ceil(F.singCd)}S`), x + 5, sy, { color: ready ? '#ffe14a' : '#6a6a7a' });
  drawText(ctx, input.hint('command') + ' CMD', x + w - 6, sy, { color: '#7ac0ff', align: 'right' });
}

// ------------------------------------------------------------------ THE FIRM block on the pause CONTROLS page
export function drawFirmControls(ctx, x, y) {
  const pad = input.lastDevice === 'pad';
  const rows = pad ? [
    ['D-DOWN / UP', 'WITH ME / GET INTO THEM'], ['D-LEFT / RIGHT', 'HOLD / SING UP'], ['R3', 'BACK TO ME'], ['HOLD RT', 'COMMAND MODE (SLOW-MO)'],
    ['RT + X', 'HAVE HIM / GO / PICK LAD'], ['RT + LB', 'GRAB HIM (PIN FOR YOU)'], ['RT + A', 'BACK TO ME'], ['L3 BY A KO LAD', 'PICK HIM UP'],
  ] : [
    ['R / T', 'WITH ME / GET INTO THEM'], ['H / Y', 'HOLD / SING UP'], ['N', 'BACK TO ME'], ['HOLD G', 'COMMAND MODE (SLOW-MO)'],
    ['G + J', 'HAVE HIM / GO / PICK LAD'], ['G + I', 'GRAB HIM (PIN FOR YOU)'], ['G + SPACE', 'BACK TO ME'], ['E BY A KO LAD', 'PICK HIM UP'],
  ];
  drawText(ctx, 'THE FIRM', x, y, { color: C.gold });
  ctx.fillStyle = C.red; ctx.fillRect(x, y + 9, VIEW_W - 2 * x, 1);
  rows.forEach(([k, n], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const xx = x + col * 260, yy = y + 16 + row * 12;
    drawText(ctx, k, xx, yy, { color: '#ffffff' });
    drawText(ctx, n, xx + 100, yy, { color: '#c0e8ff' });
  });
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
