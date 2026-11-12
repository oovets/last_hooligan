// Boot splash (tape-loader style), title screen (logo slam-in, stadium backdrop, attract mode on idle)
// and the main menu. Other menu screens live in menus.js / wardrobe_ui.js / attract.js.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText } from '../engine/font.js';
import { app } from '../app.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { game } from '../game/state.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim } from '../game/poses.js';
import { LEVELS } from '../content/levels/index.js';
import { buildLook, progressTotals } from '../content/wardrobe.js';
import { Backdrop, backdrop } from './backdrop.js';
import { drawLogo, drawCrest, LOGO_LAND_TIMES, LOGO_INTRO_LEN } from './logo.js';
import { attractCycle } from './attract.js';
import { startNewRun, LevelSelectScene, OptionsScene, HowToPlayScene, CreditsScene } from './menus.js';
import { WardrobeScene } from './wardrobe_ui.js';
import { frame, MenuList, hintBar, scanlines, blink, fmtScore, fmtTime, scarfIcon, badgeIcon, secretIcon, coinIcon, hideLoader, C } from './widgets.js';

const SUB = 'NO RULES. NO FEAR. JUST FOOTBALL.';

// ---------------------------------------------------------------- boot splash
class BootScene {
  constructor() { this.t = 0; }
  enter() {
    hideLoader();
    backdrop.build();
  }
  update(dt) {
    this.t += dt;
    if ((this.t > 0.3 && input.anyPressed()) || this.t > 3.6) app.go(app.scenes.title(), { fade: true });
  }
  draw(ctx) {
    const t = this.t;
    const loading = t < 2.6;
    // raster border stripes
    const cols = loading ? ['#00c8c8', '#c80000'] : ['#e8e000', '#0000c8'];
    let y = 0, k = Math.floor(t * 60);
    while (y < VIEW_H) {
      const h = 2 + ((k * 7 + y * 3) % 9);
      ctx.fillStyle = cols[(k + Math.floor(y / 3)) % 2]; ctx.fillRect(0, y, VIEW_W, h);
      y += h; k++;
    }
    // paper area
    const px = 48, py = 30, pw = VIEW_W - 96, ph = VIEW_H - 60;
    ctx.fillStyle = '#000000'; ctx.fillRect(px, py, pw, ph);
    drawText(ctx, 'PROGRAM: HOOLIGAN', px + 12, py + 12, { color: '#d8d8d8' });
    if (t > 0.5) drawText(ctx, 'BYTES: 48K   FAST LOADER V2', px + 12, py + 24, { color: '#d8d8d8' });
    if (t > 0.9) {
      drawCrest(ctx, VIEW_W / 2 - 30, py + 60, 4);
      drawText(ctx, 'NORDHAMN SOFTWARE', VIEW_W / 2, py + 136, { color: '#ffffff', scale: 2, align: 'center' });
      drawText(ctx, 'PRESENTS', VIEW_W / 2, py + 156, { color: '#c8102e', align: 'center' });
    }
    // loading bar
    const f = Math.min(1, t / 2.6);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(px + 40, py + ph - 50, pw - 80, 10);
    ctx.fillStyle = f < 1 ? '#c8102e' : '#7aff9a'; ctx.fillRect(px + 41, py + ph - 49, Math.round((pw - 82) * f), 8);
    drawText(ctx, f < 1 ? 'LOADING... ' + Math.floor(f * 100) + '%' : 'LOADED. KICK OFF!', VIEW_W / 2, py + ph - 34, { color: '#ffffff', align: 'center' });
    if (Math.floor(t * 2) % 2) drawText(ctx, 'PRESS ANY KEY', VIEW_W / 2, py + ph - 18, { color: '#8a8a8a', align: 'center' });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- title
class TitleScene {
  constructor(opts = {}) { this.opts = opts; }
  enter() {
    this.t = 0;
    this.intro = this.opts.skipIntro ? 99 : 0;
    this.landed = 0;
    this.shake = 0;
    this.idle = 0;
    hideLoader();
    audio.music('title');
    backdrop.refreshLook();
  }
  update(dt) {
    this.t += dt; this.intro += dt; this.idle += dt; backdrop.update(dt);
    while (this.landed < LOGO_LAND_TIMES.length && this.intro >= LOGO_LAND_TIMES[this.landed]) {
      const last = this.landed === LOGO_LAND_TIMES.length - 1;
      if (this.intro < 50) { audio.sfx(last ? 'hitHeavy' : 'punchHeavy', { pitch: 0.8 + this.landed * 0.05 }); this.shake = last ? 0.35 : 0.1; if (last) audio.sfx('crowdCheer'); }
      this.landed++;
    }
    if (this.shake > 0) this.shake -= dt;
    if (input.anyPressed()) this.idle = 0;
    if (this.intro < LOGO_INTRO_LEN && this.t > 0.2 && input.anyPressed()) { this.intro = 50; this.landed = LOGO_LAND_TIMES.length; return; }
    if (this.t > 0.4 && (input.pressed('confirm') || input.pressed('pause') || input.anyPressed())) { audio.init(); audio.sfx('menuSelect'); app.go(app.scenes.menu()); return; }
    if (this.idle > 22) app.go(attractCycle(0));
  }
  draw(ctx) {
    const sh = this.shake > 0 ? Math.round((Math.random() * 2 - 1) * this.shake * 14) : 0;
    ctx.save(); ctx.translate(sh, sh ? Math.round((Math.random() * 2 - 1) * this.shake * 8) : 0);
    backdrop.draw(ctx, { lads: true });
    const bottom = drawLogo(ctx, VIEW_W / 2, 18, this.t, { intro: this.intro });
    ctx.restore();
    const ti = this.intro - LOGO_INTRO_LEN;
    if (ti > 0) {
      const n = Math.min(SUB.length, Math.floor(ti * 30));
      const sub = SUB.slice(0, n);
      const sw = measureText(SUB);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(VIEW_W / 2 - sw / 2 - 8, bottom + 4, sw + 16, 13);
      drawText(ctx, sub, VIEW_W / 2 - sw / 2, bottom + 7, { color: '#ffffff', outline: '#000' });
      if (ti > 1.4) {
        if (blink(this.t, 2.2)) drawText(ctx, 'PRESS START', VIEW_W / 2, 196, { color: C.gold, align: 'center', scale: 3, outline: '#000' });
        const top = (save.data.hiscores || [])[0] || { name: '---', score: 0 };
        const hs = Math.max(top.score, save.data.highScore || 0);
        drawText(ctx, 'HI-SCORE ' + fmtScore(hs) + '  ' + (hs > top.score ? 'YOU' : top.name), VIEW_W / 2, 226, { color: '#ff8aa0', align: 'center', outline: '#000' });
      }
    }
    drawText(ctx, '(C) 1994 NORDHAMN SOFTWARE', 8, VIEW_H - 10, { color: '#8a7a9a', outline: '#000' });
    drawText(ctx, 'V1.0', VIEW_W - 8, VIEW_H - 10, { color: '#8a7a9a', outline: '#000', align: 'right' });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- main menu
class MainMenuScene {
  constructor() {
    const d = save.data;
    this.t = 0;
    const hasRun = () => !!d.run;
    this.menu = new MenuList([
      { label: 'NEW GAME', fn: () => startNewRun(0), hint: 'KICK OFF FROM LEVEL 1: THE STREETS' },
      { label: 'CONTINUE', disabled: () => !hasRun(), fn: () => { game.reset(); game.restore(d.run); app.go((d.settings || {}).firm !== false && app.scenes.hub ? app.scenes.hub() : app.scenes.levelIntro(d.run.levelIndex)); }, hint: () => (d.run ? `RESUME AT LEVEL ${d.run.levelIndex + 1}: ${(LEVELS[d.run.levelIndex] || {}).name || ''}` : 'NOTHING TO CONTINUE YET') },
      { label: 'LEVEL SELECT', fn: () => app.go(new LevelSelectScene()), hint: `${d.unlocked || 1} OF ${LEVELS.length} LEVELS UNLOCKED`, badge: () => `${d.unlocked || 1}/${LEVELS.length}` },
      { label: 'WARDROBE', fn: () => app.go(new WardrobeScene()), hint: 'SPEND YOUR BANKED CASH ON CLOBBER', badge: () => '£' + (d.cash || 0) },
      { label: 'OPTIONS', fn: () => app.go(new OptionsScene()), hint: 'SOUND, SHAKE, DIFFICULTY, CONTROLS' },
      { label: 'HOW TO PLAY', fn: () => app.go(new HowToPlayScene()), hint: 'CONTROLS, COMBOS AND THE TERRACE CODE' },
      { label: 'CREDITS', fn: () => app.go(new CreditsScene()), hint: 'WHO TO BLAME' },
    ], { onBack: () => app.go(app.scenes.title({ skipIntro: true })) });
    if (hasRun()) this.menu.sel = 1;
  }
  enter() { this.t = 0; audio.music('title'); }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    this.menu.update(dt);
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.45 });
    drawLogo(ctx, VIEW_W / 2, 8, this.t, { small: true });
    // menu panel
    const mx = 46, my = 92, mw = 250;
    frame(ctx, mx, my, mw, 150, { title: 'MAIN MENU', fill: 'rgba(14,9,22,0.9)' });
    this.menu.draw(ctx, mx + 20, my + 14, { w: mw - 40, rowH: 19 });
    // player card
    const d = save.data;
    const cx = 344, cy = 92, cw = 250, ch = 196;
    frame(ctx, cx, cy, cw, ch, { title: 'YOUR LAD', fill: 'rgba(14,9,22,0.9)', titleBg: '#1f4fb4' });
    const sg = ctx.createRadialGradient(cx + 64, cy + 40, 4, cx + 64, cy + 140, 100);
    sg.addColorStop(0, 'rgba(255,240,200,0.18)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(cx + 4, cy + 4, 124, ch - 8);
    ctx.fillStyle = '#c8102e'; ctx.beginPath(); ctx.ellipse(cx + 64, cy + 170, 40, 7, 0, 0, Math.PI * 2); ctx.fill();
    const look = this.look || (this.look = buildLook(d.outfit));
    drawDoll(ctx, cx + 64, cy + 170, look, sampleAnim(Math.floor(this.t / 4) % 2 ? 'guard' : 'idle', this.t), { scale: 3, time: this.t, face: 'angry' });
    const T = progressTotals(d), tt = d.totals || {};
    const sx = cx + 130;
    let yy = cy + 14;
    const row = (label, val, col = '#ffffff') => { drawText(ctx, label, sx, yy, { color: C.dim }); drawText(ctx, String(val), cx + cw - 10, yy, { color: col, align: 'right' }); yy += 13; };
    coinIcon(ctx, sx, yy); drawText(ctx, '£' + (d.cash || 0), sx + 9, yy, { color: C.cash }); yy += 14;
    row('HI-SCORE', d.highScore || 0, C.gold);
    row('LEVELS', `${Math.min(d.unlocked || 1, LEVELS.length)}/${LEVELS.length}`);
    row('SCARVES', `${T.scarves}/${LEVELS.length * 5}`);
    row('BADGES', `${T.badges}/${LEVELS.length}`);
    row('SECRETS', T.secrets);
    row('KNOCKOUTS', tt.kos || 0);
    row('BEST COMBO', tt.bestCombo || 0);
    row('TIME PLAYED', fmtTime(tt.playTime || 0));
    if (d.completed) drawText(ctx, '★ FINISHED ★', cx + cw - 64, yy + 2, { color: C.gold, align: 'center' });
    drawText(ctx, this.menu.hint(), mx + mw / 2, my + 162, { color: '#c0b8d0', align: 'center', outline: '#000' });
    hintBar(ctx, [['menuUp', 'MOVE'], ['confirm', 'SELECT'], ['back', 'TITLE']], VIEW_H - 14);
    scanlines(ctx);
  }
}

app.scenes.boot = () => new BootScene();
app.scenes.title = opts => new TitleScene(opts);
app.scenes.menu = () => new MainMenuScene();
app.scenes.wardrobe = back => new WardrobeScene(back);
export { Backdrop, backdrop, startNewRun };
