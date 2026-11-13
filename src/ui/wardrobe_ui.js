// WARDROBE: browse unlockable clobber per category, preview it on a large doll, buy with banked cash.
//   ← → category   ↑ ↓ item   CONFIRM wear / buy (press twice to buy)   BACK leave
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText, wrapText } from '../engine/font.js';
import { app } from '../app.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim } from '../game/poses.js';
import { WARDROBE, CATEGORY_NAMES, CATEGORY_ORDER, buildLook, isUnlocked, isOwned, progressTotals, findOption, kitParts, kitCost } from '../content/wardrobe.js';
import { backdrop } from './backdrop.js';
import { frame, hintBar, heading, lockIcon, tickIcon, starIcon, coinIcon, scarfIcon, badgeIcon, Repeater, scanlines, C, ladFigure, devScale, rrect } from './widgets.js';

const ANIMS = ['idle', 'guard', 'taunt', 'victory', 'cheer'];
const TABS = { kit: 'KITS', jacket: 'JACKET', pants: 'LEGS', shoes: 'SHOES', scarf: 'SCARF', hair: 'HAIR', hairColor: 'DYE', facial: 'FACE', extra: 'HATS', gloves: 'GLOVE' };

export class WardrobeScene {
  constructor(back) {
    this.back = back || null;   // scene factory to return to (the pub hub); default: main menu
    this.cats = (CATEGORY_ORDER || Object.keys(WARDROBE)).filter(c => WARDROBE[c]);
    this.ci = 0; this.sel = {}; this.scroll = {};
    this.t = 0; this.msg = ''; this.msgT = 0; this.armed = null; this.spark = [];
    this.rep = new Repeater();
    this.cashShown = save.data.cash || 0;
  }
  list(cat) { return WARDROBE[cat].filter(o => !o.hidden); }
  enter() {
    for (const c of this.cats) { this.sel[c] = Math.max(0, this.list(c).findIndex(o => o.id === save.data.outfit[c])); this.scroll[c] = 0; }
    this.markSeen();
  }
  get cat() { return this.cats[this.ci]; }
  // kits (whole looks): what they cost, whether you're wearing one
  price(cat, o) { return o.sets ? kitCost(o, save.data) : o.cost; }
  wearing(cat, o) {
    const d = save.data;
    if (!o.sets) return d.outfit[cat] === o.id;
    const e = Object.entries(o.sets);
    return e.length > 0 && e.every(([c, id]) => d.outfit[c] === id);
  }
  wear(cat, o) {
    const d = save.data;
    if (o.sets) Object.assign(d.outfit, o.sets); else d.outfit[cat] = o.id;
    save.write();
  }
  get opt() { return this.list(this.cat)[this.sel[this.cat]]; }
  markSeen() {
    const d = save.data, o = this.opt;
    const id = this.cat + ':' + o.id;
    if (isUnlocked(o, d).ok && !(d.seenNew || []).includes(id)) { (d.seenNew ||= []).push(id); save.write(); }
  }
  isNew(cat, o) {
    const d = save.data;
    return o.req && isUnlocked(o, d).ok && !isOwned(cat, o, d) && !(d.seenNew || []).includes(cat + ':' + o.id);
  }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.msgT > 0) this.msgT -= dt;
    const d = save.data;
    this.cashShown += ((d.cash || 0) - this.cashShown) * Math.min(1, dt * 8);
    for (const s of this.spark) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt; }
    this.spark = this.spark.filter(s => s.t < 0.9);
    const cat = this.cat, n = this.list(cat).length;
    if (this.rep.check('menuLeft', dt)) { this.ci = (this.ci + this.cats.length - 1) % this.cats.length; this.armed = null; audio.sfx('menuMove'); this.markSeen(); }
    if (this.rep.check('menuRight', dt)) { this.ci = (this.ci + 1) % this.cats.length; this.armed = null; audio.sfx('menuMove'); this.markSeen(); }
    if (this.rep.check('menuUp', dt)) { this.sel[cat] = (this.sel[cat] + n - 1) % n; this.armed = null; this.tryWear(); audio.sfx('menuMove'); this.markSeen(); }
    if (this.rep.check('menuDown', dt)) { this.sel[cat] = (this.sel[cat] + 1) % n; this.armed = null; this.tryWear(); audio.sfx('menuMove'); this.markSeen(); }
    if (input.pressed('confirm')) this.buy();
    if (input.pressed('back')) { audio.sfx('menuBack'); backdrop.refreshLook(); app.go(this.back ? this.back() : app.scenes.menu()); }
  }
  tryWear() {
    const d = save.data, o = this.opt;
    if (!o.sets && isOwned(this.cat, o, d) && isUnlocked(o, d).ok) this.wear(this.cat, o);   // (a kit changes everything: CONFIRM to wear it)
  }
  say(m, t = 2) { this.msg = m; this.msgT = t; }
  buy() {
    const d = save.data, cat = this.cat, o = this.opt;
    const u = isUnlocked(o, d);
    if (!u.ok) { this.say('LOCKED: ' + u.reason); audio.sfx('locked'); return; }
    if (isOwned(cat, o, d)) { this.wear(cat, o); this.say('WEARING ' + o.name, 1.5); audio.sfx('menuSelect'); return; }
    const cost = this.price(cat, o);
    if ((d.cash || 0) < cost) { this.say(`NOT ENOUGH CASH - NEED £${cost - (d.cash || 0)} MORE`); audio.sfx('locked'); return; }
    if (this.armed !== cat + o.id) { this.armed = cat + o.id; this.say(`PRESS AGAIN TO BUY FOR £${cost}`, 3); audio.sfx('menuMove'); return; }
    d.cash -= cost; (d.owned ||= []);
    if (o.sets) { for (const [c, p] of kitParts(o)) if (!isOwned(c, p, d)) d.owned.push(c + ':' + p.id); }
    else d.owned.push(cat + ':' + o.id);
    this.wear(cat, o);
    this.armed = null;
    this.say('BOUGHT ' + o.name + '!', 2.2);
    audio.sfx('coin'); audio.sfx('scarf');
    for (let i = 0; i < 40; i++) this.spark.push({ x: 130, y: 200, vx: (Math.random() - 0.5) * 220, vy: -60 - Math.random() * 160, t: 0, c: ['#ffd23a', '#c8102e', '#f4f1e8', '#7aff9a'][i % 4] });
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.6 });
    const d = save.data;
    heading(ctx, 'WARDROBE', 16, 10, { scale: 3, align: 'left' });
    // cash + progress
    coinIcon(ctx, VIEW_W - 120, 12, 2);
    drawText(ctx, '£' + Math.round(this.cashShown), VIEW_W - 104, 10, { color: C.cash, scale: 2, outline: '#000' });
    const T = progressTotals(d);
    scarfIcon(ctx, VIEW_W - 120, 30); drawText(ctx, String(T.scarves), VIEW_W - 108, 30, { color: '#fff' });
    badgeIcon(ctx, VIEW_W - 80, 29); drawText(ctx, String(T.badges), VIEW_W - 70, 30, { color: '#fff' });

    // ---- preview stage
    const sx = 20, sy = 44, sw = 220, sh = 268;
    frame(ctx, sx, sy, sw, sh, { fill: 'rgba(8,4,14,0.92)' });
    const sg = ctx.createRadialGradient(sx + sw / 2, sy + 40, 10, sx + sw / 2, sy + 200, 170);
    sg.addColorStop(0, 'rgba(255,240,200,0.22)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
    // spotlight cone + pedestal
    const cone = ctx.createLinearGradient(0, sy, 0, sy + 236);
    cone.addColorStop(0, 'rgba(255,248,225,0.14)'); cone.addColorStop(1, 'rgba(255,248,225,0.03)');
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(sx + sw / 2 - 12, sy + 2); ctx.lineTo(sx + sw / 2 + 12, sy + 2); ctx.lineTo(sx + sw / 2 + 70, sy + 236); ctx.lineTo(sx + sw / 2 - 70, sy + 236); ctx.fill();
    { // pedestal: dark disc with a glowing club-red rim
      const px = sx + sw / 2, py = sy + 236;
      const pg = ctx.createLinearGradient(0, py - 8, 0, py + 12);
      pg.addColorStop(0, '#3a2a46'); pg.addColorStop(1, '#0a0610');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(px, py + 3, 62, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.shadowColor = 'rgba(255,40,70,0.9)'; ctx.shadowBlur = 10 * devScale(ctx);
      ctx.strokeStyle = '#ff4a5e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(px, py, 58, 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(px, py, 24, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    const preview = this.opt.sets ? { ...d.outfit, ...this.opt.sets } : { ...d.outfit, [this.cat]: this.opt.id };
    const look = buildLook(preview);
    const anim = ANIMS[Math.floor(this.t / 3) % ANIMS.length];
    const turn = Math.floor(this.t / 6) % 2 === 1;
    ladFigure(ctx, look, sx + sw / 2, sy + 234, 4.8, this.t, { key: 'wardrobe', anim, flip: turn, yaw: turn ? -0.6 + Math.sin(this.t * 0.7) * 0.25 : 0.6 + Math.sin(this.t * 0.7) * 0.25, face: anim === 'taunt' || anim === 'cheer' ? 'shout' : 'angry' });
    for (const s of this.spark) { ctx.globalAlpha = 1 - s.t / 0.9; ctx.fillStyle = s.c; ctx.fillRect(Math.round(sx + s.x - 20), Math.round(sy + s.y), 2, 2); }
    ctx.globalAlpha = 1;
    drawText(ctx, 'THE LAST HOOLIGAN', sx + sw / 2, sy + sh - 14, { color: C.gold, align: 'center', outline: '#000' });

    // ---- category tabs
    const px = 256, pw = VIEW_W - px - 16;
    const tabW = pw / this.cats.length;
    this.cats.forEach((c, i) => {
      const x = Math.round(px + i * tabW), sel = i === this.ci;
      ctx.save(); if (sel) { ctx.shadowColor = 'rgba(232,24,56,0.7)'; ctx.shadowBlur = 8 * devScale(ctx); }
      ctx.fillStyle = sel ? C.red : 'rgba(30,20,44,0.9)'; rrect(ctx, x, 43, Math.ceil(tabW) - 2, 14, 3.5); ctx.fill(); ctx.restore();
      const short = TABS[c] || (CATEGORY_NAMES[c] || c.toUpperCase()).slice(0, 5);
      drawText(ctx, short, x + tabW / 2 - 1, 47, { color: sel ? '#fff' : '#8a7a9a', align: 'center' });
      if (this.list(c).some(o => this.isNew(c, o))) { ctx.fillStyle = C.gold; ctx.fillRect(x + Math.ceil(tabW) - 5, 45, 2, 2); }
    });
    // ---- item list
    const ly = 62, lh = 196;
    frame(ctx, px, ly, pw, lh, { fill: 'rgba(12,8,22,0.92)' });
    drawText(ctx, '< ' + (CATEGORY_NAMES[this.cat] || this.cat).toUpperCase() + ' >', px + pw / 2, ly + 6, { color: C.gold, align: 'center', outline: '#000' });
    const L = this.list(this.cat), rows = 10, rowH = 17;
    const sel = this.sel[this.cat];
    let sc = this.scroll[this.cat] || 0;
    if (sel < sc) sc = sel; if (sel >= sc + rows) sc = sel - rows + 1;
    this.scroll[this.cat] = sc;
    for (let r = 0; r < rows && sc + r < L.length; r++) {
      const i = sc + r, o = L[i];
      const y = ly + 20 + r * rowH;
      const isSel = i === sel;
      const unl = isUnlocked(o, d), owned = isOwned(this.cat, o, d), wearing = this.wearing(this.cat, o);
      if (isSel) { const g = ctx.createLinearGradient(px + 4, 0, px + pw - 4, 0); g.addColorStop(0, `rgba(226,26,58,${0.85 + Math.sin(this.t * 5) * 0.1})`); g.addColorStop(1, 'rgba(160,10,36,0.25)'); ctx.save(); ctx.shadowColor = 'rgba(232,24,56,0.5)'; ctx.shadowBlur = 10 * devScale(ctx); ctx.fillStyle = g; rrect(ctx, px + 4, y - 4, pw - 8, rowH - 1, 3); ctx.fill(); ctx.restore(); }
      // colour swatch
      const sw2 = o.sets ? (o.sets.jacket ? findOption('jacket', o.sets.jacket).color : null) : o.color || o.a || (o.hat && o.hat.color) || o.gloves || null;
      if (sw2) { ctx.fillStyle = '#000'; ctx.fillRect(px + 9, y - 1, 9, 9); ctx.fillStyle = sw2; ctx.fillRect(px + 10, y, 7, 7); if (o.b) { ctx.fillStyle = o.b; ctx.fillRect(px + 14, y, 3, 7); } }
      drawText(ctx, o.name, px + 24, y, { color: !unl.ok ? '#6a5a7a' : isSel ? '#fff' : '#d0c8e0' });
      const rx = px + pw - 10;
      if (!unl.ok) { lockIcon(ctx, rx - 6, y - 1); }
      else if (wearing) { starIcon(ctx, rx - 9, y - 1); }
      else if (owned) { tickIcon(ctx, rx - 7, y); }
      else { const pr = this.price(this.cat, o); drawText(ctx, '£' + pr, rx, y, { color: (d.cash || 0) >= pr ? C.gold : '#ff7a7a', align: 'right' }); }
      if (this.isNew(this.cat, o) && Math.floor(this.t * 3) % 2) drawText(ctx, 'NEW!', rx - 40, y, { color: C.gold, align: 'right' });
    }
    if (sc > 0) drawText(ctx, '↑', px + pw - 10, ly + 6, { color: C.dim });
    if (sc + rows < L.length) drawText(ctx, '↓', px + pw - 10, ly + lh - 10, { color: C.dim });
    // ---- detail
    const o = this.opt, unl = isUnlocked(o, d), owned = isOwned(this.cat, o, d);
    const dy = ly + lh + 8;
    frame(ctx, px, dy, pw, 46, { fill: 'rgba(12,8,22,0.92)' });
    drawText(ctx, o.name, px + 8, dy + 6, { color: C.gold });
    const status = !unl.ok ? 'LOCKED - ' + unl.reason : owned ? (this.wearing(this.cat, o) ? 'WEARING' : 'OWNED - PRESS TO WEAR') : `£${this.price(this.cat, o)} - PRESS TWICE TO BUY`;
    drawText(ctx, status, px + pw - 8, dy + 6, { color: !unl.ok ? '#ff7a7a' : owned ? C.cash : '#ffffff', align: 'right' });
    const desc = o.desc || (o.req ? 'A REWARD FOR THE COMMITTED.' : 'STANDARD ISSUE TERRACE WEAR.');
    wrapText(desc, pw - 16).slice(0, 2).forEach((l, i) => drawText(ctx, l, px + 8, dy + 19 + i * 10, { color: '#a8a0b8' }));

    if (this.msgT > 0) {
      const mw = measureText(this.msg) + 20;
      frame(ctx, VIEW_W / 2 - mw / 2, VIEW_H - 46, mw, 18, { fill: 'rgba(40,6,14,0.95)', rivets: false });
      drawText(ctx, this.msg, VIEW_W / 2, VIEW_H - 40, { color: C.gold, align: 'center' });
    }
    hintBar(ctx, [['menuLeft', 'CATEGORY'], ['menuUp', 'BROWSE'], ['confirm', 'WEAR / BUY'], ['back', 'DONE']], VIEW_H - 14);
    scanlines(ctx);
  }
}
