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
import { ALL_LEVELS } from '../content/tour/index.js';
import { buildLook, progressTotals } from '../content/wardrobe.js';
import { Backdrop, backdrop } from './backdrop.js';
import { drawLogo, drawCrest, LOGO_LAND_TIMES, LOGO_INTRO_LEN } from './logo.js';
import { drawPosterBg, drawMob, drawPosterTitle, drawTagline } from './poster.js';
import { CHARACTERS } from '../content/characters.js';
import { normalizeLook } from '../game/doll.js';
import { attractCycle } from './attract.js';
import { startNewRun, LevelSelectScene, OptionsScene, HowToPlayScene, CreditsScene } from './menus.js';
import { WardrobeScene } from './wardrobe_ui.js';
import { frame, MenuList, hintBar, scanlines, blink, fmtScore, fmtTime, scarfIcon, badgeIcon, secretIcon, coinIcon, hideLoader, C, rrect, devScale } from './widgets.js';
import { r3d } from '../render3d/index.js';

const TAG = 'WHAT ELSE ARE YOU GONNA DO ON A SATURDAY?';

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
    const t = this.t, S = devScale(ctx);
    // studio ident: the crest rises out of the dark under a spotlight, then the name types on
    const bg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.42, 10, VIEW_W / 2, VIEW_H * 0.5, VIEW_W * 0.7);
    bg.addColorStop(0, '#24101e'); bg.addColorStop(0.5, '#0c0712'); bg.addColorStop(1, '#030206');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const k = Math.min(1, Math.max(0, (t - 0.2) / 0.8)), e = 1 - Math.pow(1 - k, 3);
    // spotlight cone
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e;
    const cone = ctx.createLinearGradient(0, 0, 0, 260);
    cone.addColorStop(0, 'rgba(255,240,220,0.16)'); cone.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(VIEW_W / 2 - 14, 0); ctx.lineTo(VIEW_W / 2 + 14, 0); ctx.lineTo(VIEW_W / 2 + 110, 260); ctx.lineTo(VIEW_W / 2 - 110, 260); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = e;
    drawCrest(ctx, VIEW_W / 2 - 37.5, 58 + (1 - e) * 20, 5);
    ctx.globalAlpha = 1;
    if (t > 0.9) {
      const a = Math.min(1, (t - 0.9) * 2.5);
      ctx.globalAlpha = a;
      drawText(ctx, 'STEVOO STUDIOS', VIEW_W / 2, 158, { color: '#ffffff', scale: 3, align: 'center' });
      drawText(ctx, 'PRESENTS', VIEW_W / 2, 188, { color: '#ff5a6e', align: 'center' });
      ctx.globalAlpha = 1;
    }
    // progress line
    const f = Math.min(1, t / 2.6);
    const w = 180, x = VIEW_W / 2 - w / 2, y = 292;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; rrect(ctx, x, y, w, 2, 1); ctx.fill();
    ctx.save(); ctx.shadowColor = f < 1 ? 'rgba(255,40,70,0.9)' : 'rgba(122,255,154,0.9)'; ctx.shadowBlur = 8 * S;
    ctx.fillStyle = f < 1 ? '#ff3a50' : '#7aff9a'; rrect(ctx, x, y, Math.max(2, w * f), 2, 1); ctx.fill(); ctx.restore();
    drawText(ctx, f < 1 ? 'LOADING  ' + Math.floor(f * 100) + '%' : 'KICK OFF!', VIEW_W / 2, y + 10, { color: '#b8aec8', align: 'center' });
    ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.3;
    drawText(ctx, 'PRESS ANY KEY', VIEW_W / 2, y + 26, { color: '#8a7a9a', align: 'center' });
    ctx.globalAlpha = 1;
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
    // the poster: red paper, the mob charging in from below, the title slammed on, the line in a black box
    drawPosterBg(ctx, this.t);
    const ch = Math.min(1, Math.max(0, this.intro / 1.1));
    drawFirm(ctx, this.t, ch);
    drawPosterTitle(ctx, VIEW_W / 2, 36, this.t, { intro: this.intro });
    ctx.restore();
    const ti = this.intro - LOGO_INTRO_LEN;
    if (ti > -0.4) drawTagline(ctx, VIEW_W / 2, 284, TAG);
    if (ti > 0.6) {
      const on = Math.floor(this.t * 2.2) % 2 === 0;
      if (on) drawTagline(ctx, VIEW_W / 2, 314, 'PRESS START', { size: 15 });
    }
    drawText(ctx, '(C) 1994 STEVOO STUDIOS', 8, VIEW_H - 10, { color: '#f6d0c8', outline: '#000' });
    drawText(ctx, 'V1.0', VIEW_W - 8, VIEW_H - 10, { color: '#f6d0c8', outline: '#000', align: 'right' });
  }
}

// the firm, lined up under the logo: the real 3D lads standing still, a soft shadow round them, legs fading into the
// dark (the drawn poster mob is only a fallback without the 3D renderer)
const LINEUP = ['oldboy', 'mo', 'kenny', 'hooligan', 'bigal', 'vic', 'stig'];
function drawFirm(ctx, t, k) {
  const stage = r3d.menu;
  if (!(stage && stage.ready)) { drawMob(ctx, t, { charge: k }); return; }
  const n = LINEUP.length, gap = 74, x0 = VIEW_W / 2 - gap * (n - 1) / 2, mid = (n - 1) / 2;
  const actors = LINEUP.map((id, i) => {
    const ch = CHARACTERS.find(x => x.id === id);
    const look = normalizeLook((ch && ch.look) || buildLook(save.data.outfit));
    const d = Math.abs(i - mid);
    const x = x0 + i * gap;
    return { look, x, feet: 266 - d * 4, h: 150 * (look.height || 1) * (1 - d * 0.035), anim: 'idle', phase: i * 0.9, yaw: (VIEW_W / 2 - x) * 0.0016 };
  });
  ctx.save();
  ctx.globalAlpha = k;
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 16 * devScale(ctx); ctx.shadowOffsetY = 5 * devScale(ctx);
  const ok = stage.draw(ctx, 'titlefirm', actors, { x: 0, y: 70, w: VIEW_W, h: 206 }, t, { light: 'studio' });
  ctx.restore();
  if (!ok) { drawMob(ctx, t, { charge: k }); return; }
  // legs fade into the dark street
  const g = ctx.createLinearGradient(0, 214, 0, 276);
  g.addColorStop(0, 'rgba(12,4,6,0)'); g.addColorStop(0.65, 'rgba(12,4,6,0.78)'); g.addColorStop(1, 'rgba(12,4,6,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 214, VIEW_W, 62);
  const g2 = ctx.createLinearGradient(0, 276, 0, 300);
  g2.addColorStop(0, 'rgba(12,4,6,0.92)'); g2.addColorStop(1, 'rgba(12,4,6,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 276, VIEW_W, 24);
}

// ---------------------------------------------------------------- main menu
class MainMenuScene {
  constructor() {
    const d = save.data;
    this.t = 0;
    const hasRun = () => !!d.run;
    this.menu = new MenuList([
      { label: 'NEW GAME', fn: () => startNewRun(0), hint: 'KICK OFF FROM LEVEL 1: THE STREETS' },
      { label: 'CONTINUE', disabled: () => !hasRun(), fn: () => { game.reset(); game.restore(d.run); app.go((d.settings || {}).firm !== false && app.scenes.hub ? app.scenes.hub() : app.scenes.levelIntro(d.run.levelIndex)); }, hint: () => (d.run ? `RESUME AT LEVEL ${d.run.levelIndex + 1}: ${(ALL_LEVELS[d.run.levelIndex] || {}).name || ''}` : 'NOTHING TO CONTINUE YET') },
      { label: 'LEVEL SELECT', fn: () => app.go(new LevelSelectScene()), hint: `${Math.min(d.unlocked || 1, LEVELS.length)} OF ${LEVELS.length} LEVELS UNLOCKED`, badge: () => `${Math.min(d.unlocked || 1, LEVELS.length)}/${LEVELS.length}` },
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
    drawPosterBg(ctx, this.t, { dim: 0.45 });
    drawPosterTitle(ctx, VIEW_W / 2, 8, this.t, { small: true });
    // menu panel
    const mx = 46, my = 92, mw = 250;
    frame(ctx, mx, my, mw, 150, { title: 'MAIN MENU', fill: 'rgba(14,9,22,0.9)' });
    this.menu.draw(ctx, mx + 20, my + 14, { w: mw - 40, rowH: 19 });
    // player card
    const d = save.data;
    const cx = 344, cy = 92, cw = 250, ch = 196;
    frame(ctx, cx, cy, cw, ch, { title: 'YOUR LAD', fill: 'rgba(14,9,22,0.9)', titleBg: '#1f4fb4' });
    this.drawLad(ctx, cx + 4, cy + 4, 122, ch - 8);
    const T = progressTotals(d), tt = d.totals || {};
    const sx = cx + 134, rx = cx + cw - 12;
    let yy = cy + 15;
    coinIcon(ctx, sx, yy + 0.5); drawText(ctx, '£' + (d.cash || 0), sx + 10, yy, { color: C.cash, scale: 2 }); yy += 22;
    const row = (label, val, col = '#ffffff') => {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(sx, yy + 10, rx - sx, 0.5);
      drawText(ctx, label, sx, yy, { color: '#a89cb8' }); drawText(ctx, String(val), rx, yy, { color: col, align: 'right' }); yy += 15;
    };
    row('HI-SCORE', d.highScore || 0, C.gold);
    row('LEVELS', `${Math.min(d.unlocked || 1, LEVELS.length)}/${LEVELS.length}`);
    row('SCARVES', `${T.scarves}/${LEVELS.length * 5}`);
    row('BADGES', `${T.badges}/${LEVELS.length}`);
    row('SECRETS', T.secrets);
    row('KNOCKOUTS', tt.kos || 0);
    row('BEST COMBO', tt.bestCombo || 0);
    row('TIME PLAYED', fmtTime(tt.playTime || 0));
    if (d.completed) drawText(ctx, '★ FINISHED ★', (sx + rx) / 2, yy + 2, { color: C.gold, align: 'center' });
    drawText(ctx, this.menu.hint(), mx + mw / 2, my + 162, { color: '#c0b8d0', align: 'center', outline: '#000' });
    hintBar(ctx, [['menuUp', 'MOVE'], ['confirm', 'SELECT'], ['back', 'TITLE']], VIEW_H - 14);
    scanlines(ctx);
  }
  // the lad on a lit plinth: the rigged 3D character when the 3D renderer is loaded, the 2D doll otherwise
  drawLad(ctx, x, y, w, h) {
    const S = devScale(ctx), mx = x + w / 2, fy = y + h - 22;
    ctx.save();
    rrect(ctx, x, y, w, h, 4); ctx.clip();
    const bg = ctx.createRadialGradient(mx, y + h * 0.45, 4, mx, y + h * 0.55, h * 0.75);
    bg.addColorStop(0, 'rgba(70,40,90,0.55)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    // spotlight cone from above
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, y, 0, fy);
    cone.addColorStop(0, 'rgba(255,240,215,0.20)'); cone.addColorStop(1, 'rgba(255,240,215,0.03)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(mx - 10, y); ctx.lineTo(mx + 10, y); ctx.lineTo(mx + 46, fy); ctx.lineTo(mx - 46, fy); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // plinth: glowing club-red ring
    const pg = ctx.createRadialGradient(mx, fy, 2, mx, fy, 44);
    pg.addColorStop(0, 'rgba(255,60,80,0.55)'); pg.addColorStop(0.6, 'rgba(200,16,46,0.25)'); pg.addColorStop(1, 'rgba(200,16,46,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(mx, fy, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'rgba(255,40,70,0.9)'; ctx.shadowBlur = 8 * S;
    ctx.strokeStyle = '#ff4a5e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(mx, fy, 36, 7, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.ellipse(mx, fy, 18, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const look = this.look || (this.look = buildLook(save.data.outfit));
    const anim = Math.floor(this.t / 4) % 2 ? 'guard' : 'idle';
    const stage = r3d.menu;
    if (!(stage && stage.ready && stage.draw(ctx, 'portrait', [{ look, x: mx, feet: fy, h: 150, anim, phase: 0, yaw: 0.45 }], { x, y, w, h }, this.t, { light: 'studio' })))
      drawDoll(ctx, mx, fy, look, sampleAnim(anim, this.t), { scale: 3, time: this.t, face: 'angry' });
    ctx.restore();
  }
}

app.scenes.boot = () => new BootScene();
app.scenes.title = opts => new TitleScene(opts);
app.scenes.menu = () => new MainMenuScene();
app.scenes.wardrobe = back => new WardrobeScene(back);
export { Backdrop, backdrop, startNewRun };
