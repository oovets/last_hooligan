// FIRM SETUP (new game, after character select): 1) pick the club your firm runs with (colours, firm name),
// 2) pick the lads who found the firm with you (up to 4; the first 3 picked travel on the coach).
// The choice is stored in save.data.firmSetup and used when the firm is created (game/firmdata.js newFirm).
// More lads to choose from will come (FOUNDER_IDS); adding yourself as a lad comes later.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText } from '../engine/font.js';
import { app } from '../app.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { CLUBS, clubById, clubLogo, drawClubCrest } from '../content/clubs.js';
import { drawCrest } from './logo.js';
import { FOUNDER_IDS, founderInfo, TRAITS } from '../game/firmdata.js';
import { backdrop } from './backdrop.js';
import { frame, hintBar, heading, Repeater, C, rrect, devScale } from './widgets.js';
import { r3d } from '../render3d/index.js';

const MAX_LADS = 4, COACH = 3, VIS = 5;      // VIS: lad cards on screen at once (the row scrolls)

export class FirmSetupScene {
  constructor(playerChar, onDone) {
    this.onDone = onDone; this.t = 0; this.rep = new Repeater();
    CLUBS.forEach(clubLogo);                                   // start loading the crests
    this.step = 'club';
    this.clubSel = Math.max(0, CLUBS.findIndex(c => c.id === clubById(save.data.club).id));
    this.lads = FOUNDER_IDS.filter(id => id !== playerChar).map(founderInfo);
    this.picks = this.lads.slice(0, COACH).map(c => c.id);      // a sensible default: the first three
    this.ladSel = 0;
  }

  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.step === 'club') {
      const n = CLUBS.length, cols = 4;
      const mv = d => { this.clubSel = (this.clubSel + d + n) % n; audio.sfx('menuMove'); };
      if (this.rep.check('menuLeft', dt)) mv(-1);
      if (this.rep.check('menuRight', dt)) mv(1);
      if (this.rep.check('menuUp', dt)) mv(-cols);
      if (this.rep.check('menuDown', dt)) mv(cols);
      if (input.pressed('confirm')) { audio.sfx('menuSelect'); this.step = 'lads'; this.ladSel = 0; }
      if (input.pressed('back')) { audio.sfx('menuBack'); app.go(app.scenes.menu()); }
      return;
    }
    // lads: one card per lad, then LET'S GO
    const n = this.lads.length + 1;
    const mv = d => { this.ladSel = (this.ladSel + d + n) % n; audio.sfx('menuMove'); };
    if (this.rep.check('menuLeft', dt)) mv(-1);
    if (this.rep.check('menuRight', dt)) mv(1);
    if (input.pressed('confirm')) {
      if (this.ladSel === this.lads.length) {
        if (!this.picks.length) { audio.sfx('locked'); return; }
        audio.sfx('menuSelect');
        const club = CLUBS[this.clubSel];
        save.data.club = club.id;
        save.data.firmSetup = { club: club.id, lads: [...this.picks] };
        save.write();
        this.onDone();
        return;
      }
      const id = this.lads[this.ladSel].id, i = this.picks.indexOf(id);
      if (i >= 0) { this.picks.splice(i, 1); audio.sfx('menuBack'); }
      else if (this.picks.length < MAX_LADS) { this.picks.push(id); audio.sfx('menuSelect'); }
      else audio.sfx('locked');
    }
    if (input.pressed('back')) { audio.sfx('menuBack'); this.step = 'club'; }
  }

  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.62 });
    if (this.step === 'club') this.drawClubs(ctx); else this.drawLads(ctx);
  }

  drawClubs(ctx) {
    heading(ctx, 'WHO DO YOU RUN WITH?', VIEW_W / 2, 8, { scale: 3 });
    const cw = 146, ch = 104, gap = 8, x0 = Math.round((VIEW_W - (cw * 4 + gap * 3)) / 2);
    CLUBS.forEach((c, i) => {
      const col = i % 4, row = Math.floor(i / 4), sel = i === this.clubSel;
      const x = x0 + col * (cw + gap), y = 46 + row * (ch + 10) + (sel ? -2 : 0);
      frame(ctx, x, y, cw, ch, { fill: sel ? 'rgba(40,10,20,0.95)' : 'rgba(14,9,22,0.92)', accent: sel ? C.gold : c.a, edge: sel ? '#c8a030' : undefined });
      // the crest, and the colours as a scarf of bars beside it
      drawClubCrest(ctx, c, x + 6, y + 8, 40, 46, (g, bx, by, bw, bh) => drawCrest(g, bx + 5, by + 6, 2));
      const bars = c.c ? [c.a, c.b, c.c, c.a, c.b, c.c] : [c.a, c.b, c.a, c.b, c.a, c.b];
      bars.forEach((col2, k) => { ctx.fillStyle = col2; ctx.fillRect(x + 52 + k * 14, y + 14, 14, 12); });
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(x + 52, y + 14, 84, 12);
      drawText(ctx, c.short, x + 52, y + 32, { color: '#fff', scale: 2, outline: '#000' });
      drawText(ctx, c.name, x + 8, y + 58, { color: sel ? '#fff' : '#e0d8e8' });
      drawText(ctx, c.nick, x + 8, y + 69, { color: '#c0b8d0' });
      drawText(ctx, 'FIRM: ' + c.firm, x + 8, y + 81, { color: sel ? C.gold : '#a89aba' });
      drawText(ctx, c.city, x + 8, y + 92, { color: '#7a6a8a' });
      if (sel) { ctx.save(); ctx.globalAlpha = 0.65 + Math.sin(this.t * 5) * 0.35; ctx.shadowColor = 'rgba(255,210,58,0.9)'; ctx.shadowBlur = 10 * devScale(ctx); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2; rrect(ctx, x - 2.5, y - 2.5, cw + 5, ch + 5, 7); ctx.stroke(); ctx.restore(); }
    });
    const c = CLUBS[this.clubSel];
    frame(ctx, 16, 288, VIEW_W - 32, 40, { fill: 'rgba(14,9,22,0.94)' });
    drawText(ctx, `${c.name}: ${c.nick}`, 26, 296, { color: C.gold });
    drawText(ctx, `${c.firm}. ${c.chant}`, 26, 309, { color: '#c0b8d0' });
    hintBar(ctx, [['menuLeft', 'CHOOSE'], ['confirm', 'NEXT: THE LADS'], ['back', 'BACK']], VIEW_H - 14);
  }

  drawLads(ctx) {
    const club = CLUBS[this.clubSel];
    heading(ctx, 'WHO COMES WITH YOU?', VIEW_W / 2, 8, { scale: 3 });
    drawText(ctx, `${club.firm} (${club.name})   PICK UP TO ${MAX_LADS}. THE FIRST ${COACH} TRAVEL ON THE COACH.`, VIEW_W / 2, 36, { color: '#c0b8d0', align: 'center' });
    const n = this.lads.length, cw = 92, gap = 8, vis = Math.min(VIS, n), total = vis * (cw + gap) + 70, x0 = Math.round((VIEW_W - total) / 2), y0 = 52, chh = 222;
    // the visible window follows the selection
    this.first = Math.max(0, Math.min(n - vis, Math.min(this.ladSel, n - 1) - Math.floor(vis / 2)));
    const first = this.first, shown = this.lads.slice(first, first + vis);
    if (first > 0) drawText(ctx, '<', x0 - 10, y0 + 100, { color: C.gold, scale: 2, align: 'center', outline: '#000' });
    if (first + vis < n) drawText(ctx, '>', x0 + vis * (cw + gap) - 4, y0 + 100, { color: C.gold, scale: 2, align: 'center', outline: '#000' });
    const stage = r3d.menu, actors = [];
    shown.forEach((c, j) => {
      const i = first + j, x = x0 + j * (cw + gap), sel = i === this.ladSel, k = this.picks.indexOf(c.id);
      frame(ctx, x, y0 + (sel ? -2 : 0), cw, chh, { fill: k >= 0 ? 'rgba(40,10,20,0.95)' : 'rgba(14,9,22,0.92)', accent: sel ? C.gold : k >= 0 ? club.a : '#3a2e44', edge: sel ? '#c8a030' : undefined });
      const look = c.look;
      if (look) actors.push({ look, x: x + cw / 2, feet: y0 + 168, h: 150 * (look.height || 1) * 0.92, anim: 'idle', phase: i * 0.6, yaw: sel ? 0.3 + Math.sin(this.t * 2) * 0.25 : 0.4 });
    });
    if (stage && stage.ready && actors.length) stage.draw(ctx, 'firm_lads', actors, { x: x0, y: y0, w: vis * (cw + gap), h: 175 }, this.t, { light: 'studio' });
    shown.forEach((c, j) => {
      const i = first + j, x = x0 + j * (cw + gap), sel = i === this.ladSel, k = this.picks.indexOf(c.id);
      drawText(ctx, c.name.length > 13 ? c.name.split(' ').pop() : c.name, x + cw / 2, y0 + 176, { color: sel ? '#fff' : '#e0d8e8', align: 'center' });
      drawText(ctx, c.nick || '', x + cw / 2, y0 + 188, { color: '#8a7a9a', align: 'center' });
      const tag = k < 0 ? 'NOT COMING' : k < COACH ? 'ON THE COACH' : 'AT THE PUB';
      drawText(ctx, tag, x + cw / 2, y0 + 203, { color: k < 0 ? '#6a5a7a' : k < COACH ? club.b === '#f4f4f0' || club.b === '#f4f1e8' ? C.gold : club.b : '#c0b8d0', align: 'center' });
      if (k >= 0) { ctx.fillStyle = club.a; rrect(ctx, x + 4, y0 + 4, 16, 13, 3); ctx.fill(); drawText(ctx, String(k + 1), x + 12, y0 + 7, { color: '#fff', align: 'center', outline: '#000' }); }
      if (sel) { ctx.save(); ctx.shadowColor = 'rgba(255,210,58,0.9)'; ctx.shadowBlur = 10 * devScale(ctx); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.2; rrect(ctx, x - 2.5, y0 - 4.5, cw + 5, chh + 5, 7); ctx.stroke(); ctx.restore(); }
    });
    // the selected lad: trait and stats
    const cur = this.lads[Math.min(this.ladSel, n - 1)];
    if (cur && this.ladSel < n) {
      const tr = (cur.traits || []).map(t => (TRAITS[t] ? TRAITS[t].name : t)).join(', ');
      const st = cur.stats || {};
      drawText(ctx, `${cur.name}${tr ? '  -  ' + tr : ''}   FISTS ${st.fists}  KICKS ${st.kicks}  TOUGH ${st.tough}  SPEED ${st.speed}  NERVE ${st.nerve}  LOYAL ${st.loyalty}`,
        VIEW_W / 2, y0 + chh + 10, { color: '#c0b8d0', align: 'center' });
    }
    // LET'S GO
    const gx = x0 + vis * (cw + gap), gsel = this.ladSel === n;
    frame(ctx, gx, y0 + 80, 62, 56, { fill: gsel ? 'rgba(80,10,24,0.95)' : 'rgba(14,9,22,0.92)', accent: gsel ? C.gold : C.red });
    drawText(ctx, "LET'S", gx + 31, y0 + 96, { color: gsel ? C.gold : '#fff', align: 'center' });
    drawText(ctx, 'GO >', gx + 31, y0 + 110, { color: gsel ? C.gold : '#fff', align: 'center' });
    drawText(ctx, `${this.picks.length}/${MAX_LADS}`, gx + 31, y0 + 146, { color: '#8a7a9a', align: 'center' });
    hintBar(ctx, [['menuLeft', 'CHOOSE'], ['confirm', this.ladSel === n ? 'START' : 'IN / OUT'], ['back', 'CLUB']], VIEW_H - 14);
  }
}

app.scenes.firmSetup = (playerChar, onDone) => new FirmSetupScene(playerChar, onDone);
