// Level intro card, level complete tally (with cash banking), game over + continue countdown,
// ending sequence after Level 8 (story pages -> credits roll -> hall of fame).
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText, wrapText } from '../engine/font.js';
import { app } from '../app.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { game } from '../game/state.js';
import { LEVELS } from '../content/levels/index.js';
import { ALL_LEVELS } from '../content/tour/index.js';
import { firmMode } from './hub.js';
import { getFirm, applyTrip, resultFromWorld } from '../game/firmdata.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim } from '../game/poses.js';
import { drawLogo, drawCrest, drawChrome } from './logo.js';
import { backdrop } from './backdrop.js';
import { levelThumb, drawFit } from './minimap.js';
import { drawCreditsRoll, creditsHeight, NameEntryScene } from './menus.js';
import { frame, hintBar, heading, stripes, scanlines, blink, typed, typedCount, fmtTime, fmtScore, scarfIcon, badgeIcon, secretIcon, coinIcon, starIcon, vignette, C, ladFigure } from './widgets.js';

const pressed = () => input.pressed('confirm') || input.pressed('punchL') || input.pressed('pause');

function toHallOfFame(next) {
  const score = game.score, lvl = Math.min(LEVELS.length, game.levelIndex + 1);   // (tour arenas count as the story so far)
  if (save.qualifies(score)) return new NameEntryScene(score, lvl, next);
  return next();
}

// ---------------------------------------------------------------- level intro card
class LevelIntroScene {
  constructor(i) { this.i = i; this.L = ALL_LEVELS[i]; this.t = 0; this.typedN = 0; }
  enter() {
    game.levelIndex = this.i;
    save.data.run = game.snapshot();
    save.write();
    audio.music(null);
    audio.sfx('bossIntro');
    this.total = typedCount(this.L.intro || []);
  }
  update(dt) {
    this.t += dt;
    const n = Math.floor(Math.max(0, this.t - 0.9) * 40);
    if (n > this.typedN && n <= this.total) { if (n % 2 === 0) audio.sfx('menuMove', { vol: 0.25, pitch: 1.6 }); }
    this.typedN = n;
    if (this.t > 0.6 && pressed()) {
      if (this.typedN < this.total && this.t < 8) { this.t = 0.9 + this.total / 40 + 0.01; return; }
      audio.sfx('menuSelect');
      app.go(app.scenes.play(this.i));
    }
  }
  draw(ctx) {
    const L = this.L, t = this.t;
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    stripes(ctx, t, '#c8102e', '#f4f1e8', 0.12, 30);
    vignette(ctx, 0.7);
    // map preview on the right, card on the left
    const th = levelThumb(L);
    if (th) {
      const k = Math.min(1, t * 2);
      frame(ctx, 380, 40, 240, 150, { fill: 'rgba(6,4,12,0.92)', title: 'THE PATCH' });
      ctx.globalAlpha = k;
      drawFit(ctx, th, 388, 50, 224, 132, 1);
      ctx.globalAlpha = 1;
      // scanning sweep
      const sy = 50 + ((t * 60) % 132);
      ctx.fillStyle = 'rgba(122,255,154,0.25)'; ctx.fillRect(388, Math.round(sy), 224, 1);
    }
    const slide = Math.round(Math.max(0, 1 - t * 3) * 300);
    // big number
    drawText(ctx, 'LEVEL', 30 - slide, 42, { color: C.gold, scale: 2, outline: '#000' });
    const num = String(L.num || this.i + 1);
    drawChrome(ctx, num, 30 - slide, 62, 9, 'blood');
    // name (auto-fit)
    let ns = 4; while (ns > 2 && measureText(L.name, ns) > 330) ns--;
    drawChrome(ctx, L.name, 30 + slide, 140, ns, 'steel');
    ctx.fillStyle = C.red; ctx.fillRect(30, 150 + 7 * ns, Math.min(330, measureText(L.name, ns)), 3);
    if (L.subtitle && t > 0.4) drawText(ctx, L.subtitle, 30, 160 + 7 * ns, { color: '#ff8aa0', outline: '#000' });
    // collectibles status
    const d = save.data;
    if (t > 0.6) {
      const sc = (d.scarves[L.id] || []).length;
      for (let k = 0; k < 5; k++) scarfIcon(ctx, 390 + k * 13, 200, k < sc);
      badgeIcon(ctx, 460, 199, !!d.badges[L.id]);
      if (d.best[L.id]) drawText(ctx, 'BEST ' + fmtScore(d.best[L.id]), 612, 200, { color: C.gold, align: 'right', outline: '#000' });
    }
    // typed story
    const lines = L.intro || [];
    const shown = typed(lines, this.typedN);
    frame(ctx, 24, 224, VIEW_W - 48, Math.max(40, 12 + lines.length * 13), { fill: 'rgba(8,4,14,0.88)', rivets: false });
    shown.forEach((ln, k) => {
      drawText(ctx, ln, 36, 232 + k * 13, { color: '#e8e0f0' });
      const full = ln.length === lines[k].length;
      if (!full && ln.length > 0 && blink(t, 6)) { ctx.fillStyle = C.gold; ctx.fillRect(36 + measureText(ln) + 2, 232 + k * 13, 5, 7); }
    });
    // footer
    drawText(ctx, `SCORE ${fmtScore(game.score)}   ♥ X${game.lives}   £${game.cash}`, 24, VIEW_H - 14, { color: '#8a7a9a', outline: '#000' });
    if (t > 1.2 && blink(t, 2)) drawText(ctx, 'PRESS START', VIEW_W - 24, VIEW_H - 18, { color: C.gold, align: 'right', scale: 2, outline: '#000' });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- level complete tally
class LevelCompleteScene {
  constructor(i, stats, world) {
    this.i = i; this.stats = stats; this.world = world; this.t = 0;
    const s = stats;
    const timeBonus = Math.max(0, Math.round((420 - s.time) * 10));
    const noDmg = s.damageTaken < 1 ? 10000 : s.damageTaken < 50 ? 3000 : 0;
    const nScarf = world.record.scarves.size;
    const scarfBonus = nScarf * 500 + (nScarf >= (world.totalScarves || 5) ? 2500 : 0);
    const comboBonus = s.maxCombo * 100;
    const secretsTot = (world.secrets || []).length;
    this.rows = [
      ['KNOCKOUTS', String(s.kos), s.kos * 100],
      ['BEST COMBO', s.maxCombo + ' HITS', comboBonus],
      ['TIME', fmtTime(s.time), timeBonus],
      ['DAMAGE TAKEN', String(Math.round(s.damageTaken)), noDmg],
      ['SCARVES', `${nScarf}/${world.totalScarves}`, scarfBonus],
      ['SECRETS', `${s.secrets}${secretsTot ? '/' + secretsTot : ''}`, s.secrets * 1000],
      ['PIN BADGE', world.record.badge ? 'FOUND' : '-', world.record.badge ? 2000 : 0],
    ];
    this.bonus = this.rows.reduce((a, r) => a + r[2], 0);
    this.cashEarned = Math.max(0, game.cash - (save.data.run ? save.data.run.cash : 0));
    this.scoreBefore = game.score;
    // rank
    const frac = (Math.min(1, s.kos / 20) * 0.2) + (nScarf / Math.max(1, world.totalScarves)) * 0.25 + (noDmg >= 10000 ? 0.2 : noDmg ? 0.1 : Math.max(0, 0.08 - s.damageTaken / 2000)) + Math.min(0.15, s.maxCombo / 100) + (world.record.badge ? 0.15 : 0) + Math.min(0.1, timeBonus / 30000);
    this.rank = frac > 0.9 ? 'S' : frac > 0.68 ? 'A' : frac > 0.45 ? 'B' : frac > 0.25 ? 'C' : 'D';
    this.rankWord = { S: 'TERRACE LEGEND', A: 'TOP BOY', B: 'PROPER LAD', C: 'DAY TRIPPER', D: 'PRAWN SANDWICH' }[this.rank];
    this.rowShown = this.rows.map(() => 0);
    this.ticks = 0;
  }
  enter() {
    const d = save.data;
    game.score += this.bonus;
    d.highScore = Math.max(d.highScore || 0, game.score);
    const L = ALL_LEVELS[this.i];
    this.newBest = game.score > (d.best[L.id] || 0) || (d.best[L.id] || 0) === this.scoreBefore;
    d.best[L.id] = Math.max(d.best[L.id] || 0, game.score);
    d.cash = (d.cash || 0) + this.cashEarned;
    const T = (d.totals ||= {}); T.cashEarned = (T.cashEarned || 0) + this.cashEarned;
    const next = this.i + 1;
    if (this.i >= LEVELS.length) { game.levelIndex = Math.min(LEVELS.length - 1, (d.unlocked || 1) - 1); game.keys = new Set(); d.run = game.snapshot(); }   // a tour away day: back to the pub, the story resumes where it was
    else if (next < LEVELS.length) { game.levelIndex = next; game.keys = new Set(); d.run = game.snapshot(); }
    else { d.run = null; d.completed = true; }
    // the firm: consequences of the trip (game/firmdata.js); you go back to the pub afterwards
    if (firmMode() && this.world && this.world.firm) applyTrip(getFirm(game.character), resultFromWorld(this.world, true, this.rank));
    save.write();
    this.bankBefore = d.cash - this.cashEarned;
    audio.music('victory');
  }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    // count rows up with ticks
    this.rows.forEach((r, k) => {
      const st = 0.6 + k * 0.45;
      if (this.t > st && this.rowShown[k] < r[2]) {
        this.rowShown[k] = Math.min(r[2], this.rowShown[k] + Math.max(1, r[2] * dt * 3));
        this.ticks += dt; if (this.ticks > 0.05) { this.ticks = 0; audio.sfx('coin', { vol: 0.25 }); }
      }
      if (this.t > st && this.t - dt <= st) audio.sfx('punch', { vol: 0.5 });
    });
    const endT = 0.6 + this.rows.length * 0.45 + 0.6;
    if (this.t > endT && this.t - dt <= endT) { audio.sfx('levelComplete'); }
    if (this.t > endT + 0.8 && this.t - dt <= endT + 0.8) audio.sfx('hitHeavy');
    if (this.t > 0.8 && pressed()) {
      if (this.t < endT + 0.8) { this.t = endT + 0.81; this.rows.forEach((r, k) => { this.rowShown[k] = r[2]; }); return; }
      const next = this.i + 1;
      audio.sfx('menuSelect');
      if (this.i >= LEVELS.length) app.go(app.scenes.hub ? app.scenes.hub() : app.scenes.title());
      else if (next < LEVELS.length) app.go(firmMode() && app.scenes.hub ? app.scenes.hub() : app.scenes.levelIntro(next));
      else app.go(new EndingScene());
    }
  }
  draw(ctx) {
    const t = this.t;
    backdrop.draw(ctx, { dim: 0.72 });
    stripes(ctx, t, '#c8102e', '#f4f1e8', 0.06, 20);
    drawText(ctx, `${this.i >= LEVELS.length ? 'AWAY DAY' : 'LEVEL ' + (ALL_LEVELS[this.i].num || this.i + 1)} - ${ALL_LEVELS[this.i].name}`, VIEW_W / 2, 12, { color: '#ffffff', align: 'center', outline: '#000' });
    const k = Math.min(1, t * 4);
    const s = 5 + Math.round((1 - k) * 4);
    drawChrome(ctx, 'SORTED!', VIEW_W / 2, 26, s, 'blood', 'center');
    // tally panel
    const px = 70, py = 76, pw = 330, ph = 170;
    frame(ctx, px, py, pw, ph, { title: 'THE TALLY', fill: 'rgba(12,8,22,0.92)' });
    this.rows.forEach((r, k2) => {
      if (t < 0.6 + k2 * 0.45) return;
      const y = py + 12 + k2 * 18;
      if (k2 % 2) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(px + 4, y - 4, pw - 8, 16); }
      drawText(ctx, r[0], px + 12, y, { color: '#c0b8d0' });
      drawText(ctx, r[1], px + 200, y, { color: '#ffffff', align: 'right' });
      drawText(ctx, '+' + Math.floor(this.rowShown[k2]), px + pw - 12, y, { color: this.rowShown[k2] > 0 ? C.gold : '#5a4a6a', align: 'right' });
    });
    const endT = 0.6 + this.rows.length * 0.45 + 0.6;
    // right column: collectibles + rank
    const rx = 420, ry = 76;
    frame(ctx, rx, ry, 150, 170, { title: 'RATING', fill: 'rgba(12,8,22,0.92)', titleBg: '#1f4fb4' });
    const nS = this.world.record.scarves.size;
    for (let q = 0; q < (this.world.totalScarves || 5); q++) scarfIcon(ctx, rx + 14 + q * 13, ry + 14, this.world.record.scarves.has(q));
    badgeIcon(ctx, rx + 84 - 0 + 2, ry + 13, !!this.world.record.badge);
    if (t > endT) {
      const rk = Math.min(1, (t - endT) * 3);
      const rs = Math.round(12 - rk * 4);
      const col = { S: '#ffd23a', A: '#7aff9a', B: '#7ac0ff', C: '#ffffff', D: '#ff7a7a' }[this.rank];
      drawChrome(ctx, this.rank, rx + 75, ry + 34 + (12 - rs) * 3, rs, this.rank === 'S' || this.rank === 'D' ? 'blood' : 'steel', 'center');
      if (t > endT + 0.3) drawText(ctx, this.rankWord, rx + 75, ry + 112, { color: col, align: 'center', outline: '#000' });
      if (nS >= (this.world.totalScarves || 5) && this.world.totalScarves) drawText(ctx, 'ALL SCARVES!', rx + 75, ry + 128, { color: C.gold, align: 'center' });
      if (this.newBest && blink(t, 3)) drawText(ctx, 'NEW BEST!', rx + 75, ry + 146, { color: '#ff6a7a', align: 'center' });
    }
    if (t > endT + 0.8) {
      frame(ctx, 70, 256, 500, 50, { fill: 'rgba(12,30,16,0.92)', accent: '#7aff9a' });
      const bf = Math.min(1, (t - endT - 0.8) * 1.5);
      drawText(ctx, 'TOTAL BONUS +' + this.bonus, 84, 264, { color: '#7aff9a', scale: 2, outline: '#000' });
      drawText(ctx, 'SCORE ' + fmtScore(game.score), 556, 264, { color: '#ffffff', scale: 2, align: 'right', outline: '#000' });
      coinIcon(ctx, 84, 288);
      drawText(ctx, `CASH BANKED £${Math.round(this.cashEarned * bf)}   BANK £${Math.round(this.bankBefore + this.cashEarned * bf)}   (SPEND IT IN THE WARDROBE)`, 94, 288, { color: '#c8ffd0' });
    }
    // the lad celebrating
    const look = game.look();
    ladFigure(ctx, look, 36, 330, 2, t, { key: 'complete', anim: 'victory', yaw: 0.4, face: 'shout' });
    if (t > 1 && blink(t, 2)) drawText(ctx, t < endT + 0.8 ? 'PRESS START TO SKIP' : 'PRESS START', VIEW_W - 16, VIEW_H - 16, { color: C.gold, align: 'right', outline: '#000', scale: t < endT + 0.8 ? 1 : 2 });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- game over
class GameOverScene {
  constructor(i) { this.i = i; this.t = 0; this.count = 9.99; this.lastSec = 10; }
  enter() { audio.music('gameover'); audio.sfx('gameOver'); }
  update(dt) {
    this.t += dt;
    if (game.continues > 0) {
      this.count -= dt * 0.8;
      if (input.pressed('punchR') || input.pressed('kick')) this.count -= 1; // arcade: mash to hurry
      const sec = Math.max(0, Math.ceil(this.count));
      if (sec < this.lastSec) { this.lastSec = sec; audio.sfx('menuMove', { pitch: 0.6 + sec * 0.05 }); }
      if (this.t > 0.8 && (input.pressed('confirm') || input.pressed('pause'))) {
        game.continues--;
        const snap = save.data.run;
        game.restore(snap);
        game.lives = 3;
        game.score = Math.floor((snap ? snap.score : 0) / 2);
        audio.sfx('respawn');
        app.go(app.scenes.levelIntro(this.i));
        return;
      }
      if (this.count <= 0 || input.pressed('back')) this.finish();
    } else if (this.t > 1.5 && pressed()) this.finish();
  }
  finish() {
    if (this.left) return; this.left = true;
    app.go(toHallOfFame(() => app.scenes.title({ skipIntro: true })));
  }
  draw(ctx) {
    const t = this.t;
    ctx.fillStyle = '#0a0004'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // rain of red stripes
    stripes(ctx, t * 0.3, '#5a0010', '#1a0006', 0.4, 10);
    vignette(ctx, 0.85);
    // the lad, flat out
    const look = game.look();
    ladFigure(ctx, look, VIEW_W / 2, 330, 3, t, { key: 'gameover', anim: 'down', yaw: 0.3, face: 'ko' });
    // stars circling
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; drawText(ctx, '★', VIEW_W / 2 - 34 + Math.cos(a) * 18, 296 + Math.sin(a) * 5, { color: C.gold }); }
    const k = Math.min(1, t * 2);
    const s = 6;
    drawChrome(ctx, 'GAME OVER', VIEW_W / 2, 40 - Math.round((1 - k) * 80), s, 'blood', 'center');
    const quips = ['YOU GOT A PROPER KICKING.', 'THAT WILL BE IN THE PAPERS.', 'YOUR MUM WILL HEAR ABOUT THIS.', 'BACK OF THE NET... FOR THEM.'];
    drawText(ctx, quips[this.i % quips.length], VIEW_W / 2, 96, { color: '#ffffff', align: 'center', outline: '#000' });
    if (game.continues > 0) {
      drawText(ctx, 'CONTINUE?', VIEW_W / 2, 124, { color: C.gold, align: 'center', scale: 3, outline: '#000' });
      const n = Math.max(0, Math.ceil(this.count));
      const frac = this.count - Math.floor(this.count);
      const ps = 7 + Math.round(frac * 2);
      drawText(ctx, String(n), VIEW_W / 2, 160 - (ps - 7) * 3, { color: n <= 3 ? '#ff4a4a' : '#ffffff', align: 'center', scale: ps, outline: '#000' });
      drawText(ctx, `${game.continues} CONTINUE${game.continues > 1 ? 'S' : ''} LEFT - SCORE HALVED`, VIEW_W / 2, 230, { color: '#c0b8d0', align: 'center', outline: '#000' });
      if (blink(t, 3)) drawText(ctx, 'PRESS START', VIEW_W / 2, 244, { color: C.gold, align: 'center', outline: '#000' });
    } else drawText(ctx, 'NO CONTINUES LEFT. GO HOME.', VIEW_W / 2, 160, { color: '#c0b8d0', align: 'center', scale: 2, outline: '#000' });
    drawText(ctx, 'FINAL SCORE ' + fmtScore(game.score), 16, VIEW_H - 14, { color: C.gold, outline: '#000' });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- ending
const ENDING_PAGES = [
  { title: 'FULL TIME', lines: ['THE FIRM TOP BOYS ARE ON THEIR BACKS.', 'PORTSIDE CITY HAVE GONE HOME ON THE LAST FERRY.', 'VARGBY ARE STILL LOOKING FOR THEIR COACH.'], anim: 'victory' },
  { title: 'THE NORTH BANK', lines: ['THE BULLDOZERS NEVER CAME.', 'THE COUNCIL "LOST THE PAPERWORK".', 'NOBODY ASKED WHY. NOBODY DARED.'], anim: 'cheer' },
  { title: 'THE LAST HOOLIGAN', lines: ['HE HUNG UP THE HARRINGTON,', 'PUT THE KETTLE ON,', 'AND RENEWED HIS SEASON TICKET.'], anim: 'idle' },
  { title: 'NORDHAMN ATHLETIC', lines: ['STILL RED. STILL WHITE.', 'STILL RUBBISH ON A WET TUESDAY.', 'STILL OURS.'], anim: 'cheer' },
];
class EndingScene {
  constructor() { this.t = 0; this.page = 0; this.pageT = 0; this.phase = 'story'; this.scroll = 0; }
  enter() { audio.music('victory'); audio.sfx('crowdCheer'); }
  update(dt) {
    this.t += dt; this.pageT += dt; backdrop.update(dt);
    if (this.phase === 'story') {
      if ((this.pageT > 1.2 && pressed()) || this.pageT > 7) {
        this.page++; this.pageT = 0; audio.sfx('menuSelect');
        if (this.page >= ENDING_PAGES.length) { this.phase = 'credits'; this.scroll = 0; audio.music('title'); }
      }
    } else if (this.phase === 'credits') {
      this.scroll += dt * (input.down('confirm') ? 90 : 26);
      if (this.scroll > creditsHeight() + VIEW_H * 0.55) { this.phase = 'end'; this.pageT = 0; audio.sfx('levelComplete'); }
    } else if (this.phase === 'end') {
      if (this.pageT > 2 && pressed()) app.go(toHallOfFame(() => app.scenes.title({ skipIntro: true })));
    }
  }
  draw(ctx) {
    const t = this.t;
    if (this.phase === 'story') {
      const P = ENDING_PAGES[this.page];
      // dawn over the stadium: lighten the backdrop progressively
      backdrop.draw(ctx, { lads: false, dim: 0.25 });
      const dawn = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      dawn.addColorStop(0, `rgba(255,140,80,${0.08 + this.page * 0.06})`); dawn.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dawn; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const k = Math.min(1, this.pageT * 2);
      ctx.globalAlpha = k;
      frame(ctx, 170, 150, 430, 92, { title: P.title, fill: 'rgba(8,4,14,0.9)' });
      const total = typedCount(P.lines);
      typed(P.lines, Math.floor(this.pageT * 35)).forEach((l, i) => drawText(ctx, l, 385, 168 + i * 18, { color: '#ffffff', align: 'center', scale: 1, outline: '#000' }));
      ctx.globalAlpha = 1;
      drawText(ctx, `${this.page + 1}/${ENDING_PAGES.length}`, 592, 232, { color: C.dim, align: 'right' });
      const look = game.look();
      ladFigure(ctx, look, 92, 352, 3.2, t, { key: 'ending', anim: P.anim, yaw: 0.5, face: P.anim === 'idle' ? 'normal' : 'shout' });
      drawLogo(ctx, VIEW_W / 2, 6, t, { small: true });
      if (this.pageT > 1.2 && blink(t, 2) && Math.floor(this.pageT * 35) >= total) drawText(ctx, 'PRESS START', VIEW_W / 2, VIEW_H - 16, { color: C.gold, align: 'center', outline: '#000' });
    } else if (this.phase === 'credits') {
      backdrop.draw(ctx, { lads: true, dim: 0.35 });
      ctx.fillStyle = 'rgba(4,2,10,0.5)'; ctx.fillRect(VIEW_W / 2 - 180, 0, 360, VIEW_H);
      drawCreditsRoll(ctx, this.scroll);
    } else {
      backdrop.draw(ctx, { lads: true, dim: 0.2 });
      drawLogo(ctx, VIEW_W / 2, 30, t, {});
      ctx.fillStyle = 'rgba(4,2,10,0.7)'; ctx.fillRect(0, 158, VIEW_W, 108);
      drawChrome(ctx, 'THE END', VIEW_W / 2, 166, 5, 'steel', 'center');
      drawText(ctx, 'FINAL SCORE ' + fmtScore(game.score), VIEW_W / 2, 210, { color: C.gold, align: 'center', scale: 2, outline: '#000' });
      drawText(ctx, 'CENTENARY SCARF UNLOCKED IN THE WARDROBE', VIEW_W / 2, 234, { color: '#7aff9a', align: 'center', outline: '#000' });
      if (this.pageT > 2 && blink(t, 2)) drawText(ctx, 'PRESS START', VIEW_W / 2, 252, { color: C.gold, align: 'center', outline: '#000' });
    }
    scanlines(ctx);
  }
}

app.scenes.levelIntro = i => new LevelIntroScene(i);
app.scenes.levelComplete = (i, s, w) => new LevelCompleteScene(i, s, w);
app.scenes.gameOver = i => new GameOverScene(i);
app.scenes.ending = () => new EndingScene();
