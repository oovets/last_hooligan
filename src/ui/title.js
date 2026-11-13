// Title screen (logo slam-in, Råsunda photo backdrop, attract mode on idle)
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
import { makeRng } from '../engine/rng.js';

const TAG = 'WHAT ELSE ARE YOU GONNA DO ON A SATURDAY?';

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
    // the photo of Råsunda's North Stand (flares, smoke, floodlights), the masked mob and the lads in front of it, the
    // title slammed on, the line in a black box
    backdrop.draw(ctx, {});
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
    return { look, x, feet: 264, h: 150 * (look.height || 1) * (1 - d * 0.035), still: true, yaw: (VIEW_W / 2 - x) * 0.0016 };   // all on one floor, standing dead still
  });
  // nobody's head goes behind the logo (its bottom is ~y 108): shrink the whole line-up evenly if the tallest
  // (Big Al) would reach it, so the lads keep their heights relative to each other
  const HEAD_ROOM = 114, fit = Math.min(1, ...actors.map(a => (a.feet - HEAD_ROOM) / a.h));
  if (fit < 1) for (const a of actors) a.h *= fit;
  ctx.save();
  ctx.globalAlpha = k;
  drawBackMob(ctx, t, stage);
  // floor: the key light casts the lads' real shadows on the ground they stand on (menustage opts.floor)
  const ok = stage.draw(ctx, 'titlefirm', actors, { x: 0, y: 70, w: VIEW_W, h: 230 }, t, { light: 'studio', floor: true });
  ctx.restore();
  if (!ok) { drawMob(ctx, t, { charge: k }); return; }
}

// the mob behind the line-up: rows of masked-up lads (black track tops with white piping, balaclavas, olive cargos,
// white trainers), smaller and darker the further back they stand, each in a fight stance of his own. A stage of its own (no floor shadows:
// cheap), drawn first and then pushed back into the dark, so the firm reads in front.
const MOB_ROWS = [   // back to front: feet y, body height, how many, darkening on top
  { feet: 204, h: 96, n: 13, dim: 0.35 },
  { feet: 220, h: 110, n: 11, dim: 0.3 },
  { feet: 238, h: 126, n: 10, dim: 0.3 },
];
let MOB = null;
const MOB_STANCES = [{ fight: true }, { fight: true }, { fight: true }, { anim: 'block' }, { anim: 'crouch' }, { anim: 'taunt' }, { anim: 'taunt2' }];
// all in the same kit: black track top with white piping, black balaclava, olive cargos, white trainers, black gloves
function mobLook(rng) {
  return normalizeLook({
    skin: rng.pick(['#e2a97a', '#d49a6a', '#f0c098', '#b87a50', '#8a5636']), hair: { style: 'shaved', color: '#141016' }, facial: 'none',
    jacket: { style: 'track', color: '#16161a', trim: '#ecebe6' }, shirt: '#141416',
    pants: { style: 'cargo', color: '#3e4632' },
    shoes: { color: '#f4f4f0', sole: '#ecebe6', stripe: '#141416' },
    mask: 'balaclava', maskColor: '#141416', gloves: '#141416', scarf: null,
    build: 1.15, height: 1.0,
  });
}
function mobActors() {
  if (MOB) return MOB;
  const rng = makeRng(1994);
  MOB = [];
  MOB_ROWS.forEach((r, ri) => {
    const gap = (VIEW_W + 40) / r.n, off = ri % 2 ? gap / 2 : 0;
    for (let i = 0; i < r.n; i++) {
      const x = -20 + off + i * gap;
      // a fight stance each, picked at random from the game's own (guard, covering up, low, "come on then"), every
      // lad on his own beat and turned a little his own way
      const st = rng.pick(MOB_STANCES);
      MOB.push({ look: mobLook(rng), x, feet: r.feet, h: r.h, anim: st.anim || 'idle', fight: !!st.fight, sync: false,
        phase: rng.range(0, 4), yaw: rng.range(-0.3, 0.3), row: ri });
    }
  });
  return MOB;
}
let mobCanvas = null;
function drawBackMob(ctx, t, stage) {
  const actors = mobActors();
  // drawn on a canvas of its own so the darkening only lands on the lads (source-atop), never the poster behind them:
  // back rows first, everything so far pushed further into the dark before the next row goes on top
  const cw = ctx.canvas.width, chh = ctx.canvas.height;
  if (!mobCanvas) mobCanvas = document.createElement('canvas');
  if (mobCanvas.width !== cw || mobCanvas.height !== chh) { mobCanvas.width = cw; mobCanvas.height = chh; }
  const m = mobCanvas.getContext('2d');
  m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, cw, chh);
  m.setTransform(ctx.getTransform());
  for (let ri = 0; ri < MOB_ROWS.length; ri++) {
    const r = MOB_ROWS[ri];
    if (!stage.draw(m, 'titlemob' + ri, actors.filter(a => a.row === ri), { x: 0, y: 70, w: VIEW_W, h: 230 }, t, { light: 'studio' })) return;
    m.save(); m.globalCompositeOperation = 'source-atop';
    const g = m.createLinearGradient(0, 90, 0, 250);
    g.addColorStop(0, `rgba(10,4,8,${r.dim})`); g.addColorStop(1, `rgba(10,4,8,${Math.min(0.92, r.dim + 0.25)})`);
    m.fillStyle = g; m.fillRect(0, 0, VIEW_W, VIEW_H);
    m.restore();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(mobCanvas, 0, 0); ctx.restore();
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
    frame(ctx, mx, my, mw, 150, { title: 'MAIN MENU', fill: 'rgba(12,12,14,0.9)' });
    this.menu.draw(ctx, mx + 20, my + 14, { w: mw - 40, rowH: 19 });
    // player card
    const d = save.data;
    const cx = 344, cy = 92, cw = 250, ch = 196;
    frame(ctx, cx, cy, cw, ch, { title: 'YOUR LAD', fill: 'rgba(12,12,14,0.9)', titleBg: '#141416', titleColor: '#f2c811' });   // black tab, yellow letters
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
    // plinth: glowing yellow ring
    const pg = ctx.createRadialGradient(mx, fy, 2, mx, fy, 44);
    pg.addColorStop(0, 'rgba(255,214,60,0.55)'); pg.addColorStop(0.6, 'rgba(242,200,17,0.25)'); pg.addColorStop(1, 'rgba(242,200,17,0)');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(mx, fy, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'rgba(242,200,17,0.9)'; ctx.shadowBlur = 8 * S;
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(mx, fy, 36, 7, 0, 0, Math.PI * 2); ctx.stroke();
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

app.scenes.title = opts => new TitleScene(opts);
app.scenes.menu = () => new MainMenuScene();
app.scenes.wardrobe = back => new WardrobeScene(back);
export { Backdrop, backdrop, startNewRun };
