// Menu screens: level select, options (+ key bindings), how to play, credits roll, hall-of-fame name entry.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText, wrapText } from '../engine/font.js';
import { app } from '../app.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { game } from '../game/state.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim, attackPose } from '../game/poses.js';
import { buildLook } from '../content/wardrobe.js';
import { LEVELS } from '../content/levels/index.js';
import { ITEMS } from '../game/items.js';
import { backdrop } from './backdrop.js';
import { drawLogo, drawCrest } from './logo.js';
import { levelThumb, drawFit } from './minimap.js';
import { optionItems, drawBindings, drawControlCard } from './options.js';
import { drawComboList } from '../game/play.js';
import { drawHallOfFame } from './attract.js';
import { frame, MenuList, hintBar, heading, scarfIcon, badgeIcon, lockIcon, secretIcon, Repeater, scanlines, blink, fmtScore, C } from './widgets.js';

export function startNewRun(levelIndex = 0) {
  // pick a character first (src/ui/charselect.js), then kick off
  if (app.scenes.charSelect) { app.go(app.scenes.charSelect(levelIndex, () => beginRun(levelIndex))); return; }
  beginRun(levelIndex);
}

function beginRun(levelIndex) {
  game.reset();
  game.levelIndex = levelIndex;
  const T = (save.data.totals ||= {});
  T.games = (T.games || 0) + 1;
  save.write();
  app.go(app.scenes.levelIntro(levelIndex));
}

// ---------------------------------------------------------------- level select
export class LevelSelectScene {
  constructor() { this.t = 0; this.sel = Math.max(0, Math.min(LEVELS.length - 1, (save.data.unlocked || 1) - 1)); this.rep = new Repeater(); }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    const n = LEVELS.length, cols = 4;
    const mv = d => { this.sel = (this.sel + d + n) % n; audio.sfx('menuMove'); };
    if (this.rep.check('menuLeft', dt)) mv(-1);
    if (this.rep.check('menuRight', dt)) mv(1);
    if (this.rep.check('menuUp', dt)) mv(-cols);
    if (this.rep.check('menuDown', dt)) mv(cols);
    if (input.pressed('confirm')) {
      if (this.sel < (save.data.unlocked || 1)) { audio.sfx('menuSelect'); startNewRun(this.sel); }
      else audio.sfx('locked');
    }
    if (input.pressed('back')) { audio.sfx('menuBack'); app.go(app.scenes.menu()); }
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.62 });
    const d = save.data;
    heading(ctx, 'LEVEL SELECT', VIEW_W / 2, 8, { scale: 3 });
    const cw = 146, ch = 112, gap = 8, x0 = Math.round((VIEW_W - (cw * 4 + gap * 3)) / 2);
    LEVELS.forEach((L, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = x0 + col * (cw + gap), y = 44 + row * (ch + 10);
      const sel = i === this.sel, locked = i >= (d.unlocked || 1);
      const lift = sel ? -2 : 0;
      frame(ctx, x, y + lift, cw, ch, { fill: locked ? 'rgba(10,6,16,0.94)' : sel ? 'rgba(40,10,20,0.95)' : 'rgba(14,9,22,0.92)', accent: sel ? C.gold : locked ? '#3a2e44' : C.red, edge: sel ? '#c8a030' : undefined });
      // number tab
      ctx.fillStyle = locked ? '#3a2e44' : C.red; ctx.fillRect(x + 4, y + 4 + lift, 18, 13);
      drawText(ctx, String(L.num || i + 1), x + 13, y + 7 + lift, { color: '#fff', align: 'center' });
      drawText(ctx, L.name.length > 19 ? L.name.slice(0, 18) + '.' : L.name, x + 27, y + 7 + lift, { color: locked ? '#5a4a6a' : sel ? '#fff' : '#e0d8e8' });
      // map thumbnail
      const th = locked ? null : levelThumb(L);
      ctx.fillStyle = '#06040c'; ctx.fillRect(x + 4, y + 21 + lift, cw - 8, 54);
      if (th) drawFit(ctx, th, x + 6, y + 22 + lift, cw - 12, 52, sel ? 1 : 0.75);
      else { lockIcon(ctx, x + cw / 2 - 9, y + 36 + lift, 3); }
      if (!locked) {
        const sc = (d.scarves[L.id] || []).length;
        for (let k = 0; k < 5; k++) scarfIcon(ctx, x + 6 + k * 12, y + 80 + lift, k < sc);
        badgeIcon(ctx, x + 68, y + 79 + lift, !!d.badges[L.id]);
        const sec = (d.secrets[L.id] || []).length;
        secretIcon(ctx, x + 82, y + 79 + lift, sec > 0);
        drawText(ctx, String(sec), x + 92, y + 80 + lift, { color: sec ? '#7affe0' : '#5a4a6a' });
        drawText(ctx, 'BEST ' + (d.best[L.id] ? fmtScore(d.best[L.id], 7) : '-------'), x + 6, y + 95 + lift, { color: d.best[L.id] ? C.gold : '#5a4a6a' });
      } else drawText(ctx, 'LOCKED', x + cw / 2, y + 88 + lift, { color: '#6a5a7a', align: 'center' });
      if (sel && blink(this.t, 3)) { ctx.strokeStyle = C.gold; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 3.5 + lift, cw + 7, ch + 7); }
    });
    // detail strip
    const L = LEVELS[this.sel], locked = this.sel >= (d.unlocked || 1);
    frame(ctx, 16, 294, VIEW_W - 32, 40, { fill: 'rgba(14,9,22,0.94)' });
    if (locked) {
      drawText(ctx, 'FINISH LEVEL ' + this.sel + ' TO UNLOCK THIS ONE.', VIEW_W / 2, 302, { color: '#ff7a7a', align: 'center' });
      drawText(ctx, 'NO SKIPPING THE QUEUE. THIS IS NORDHAMN.', VIEW_W / 2, 315, { color: C.dim, align: 'center' });
    } else {
      drawText(ctx, `LEVEL ${L.num || this.sel + 1}: ${L.name}`, 26, 301, { color: C.gold });
      if (L.subtitle) drawText(ctx, L.subtitle, VIEW_W - 26, 301, { color: '#ff8aa0', align: 'right' });
      const line = (L.intro || []).slice(0, 2).join(' ');
      wrapText(line, VIEW_W - 60).slice(0, 2).forEach((l, i) => drawText(ctx, l, 26, 313 + i * 10, { color: '#c0b8d0' }));
    }
    hintBar(ctx, [['menuLeft', 'CHOOSE'], ['confirm', 'PLAY'], ['back', 'BACK']], VIEW_H - 14);
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- options
export class OptionsScene {
  constructor() {
    this.t = 0; this.page = 'list';
    this.menu = new MenuList(optionItems({
      onKeys: () => { this.page = 'keys'; },
      onBack: () => app.go(app.scenes.menu()),
      onReset: () => { save.reset(); backdrop.refreshLook(); audio.setVolumes({ music: save.data.settings.music, sfx: save.data.settings.sfx }); app.go(app.scenes.menu()); },
    }), { onBack: () => app.go(app.scenes.menu()) });
  }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.page === 'keys') { if (input.pressed('back') || input.pressed('confirm')) { audio.sfx('menuBack'); this.page = 'list'; } return; }
    this.menu.update(dt);
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.65 });
    if (this.page === 'keys') {
      heading(ctx, 'KEY BINDINGS', VIEW_W / 2, 8, { scale: 3 });
      frame(ctx, 40, 44, VIEW_W - 80, 252);
      drawBindings(ctx, 70, 58);
      drawText(ctx, 'MENUS: ARROWS / WASD + ENTER, ESC TO GO BACK. GAMEPADS WORK EVERYWHERE.', VIEW_W / 2, 280, { color: C.dim, align: 'center' });
      hintBar(ctx, [['back', 'BACK']], VIEW_H - 14);
    } else {
      heading(ctx, 'OPTIONS', VIEW_W / 2, 8, { scale: 3 });
      frame(ctx, VIEW_W / 2 - 170, 48, 340, 248);
      this.menu.draw(ctx, VIEW_W / 2 - 160, 60, { w: 320, rowH: 18 });
      drawText(ctx, this.menu.hint(), VIEW_W / 2, 306, { color: '#c0b8d0', align: 'center', outline: '#000' });
      hintBar(ctx, [['menuUp', 'MOVE'], ['menuLeft', 'CHANGE'], ['confirm', 'SELECT'], ['back', 'BACK']], VIEW_H - 14);
    }
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- how to play
const DEMO_COMBO = [['jab', 'J'], ['jab', 'J'], ['hook', 'J'], ['uppercut', 'J'], [null, ''], ['cross', 'K'], ['cross', 'K'], ['uppercut', 'K'], [null, ''], ['kick', 'L'], ['spinKick', 'L'], [null, '']];
export class HowToPlayScene {
  constructor() { this.t = 0; this.page = 0; this.pages = ['CONTROLS', 'FIGHTING', 'THE TERRACE CODE']; }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (input.pressed('menuRight') || input.pressed('confirm')) {
      if (this.page < this.pages.length - 1) { this.page++; audio.sfx('menuMove'); }
      else if (input.pressed('confirm')) { audio.sfx('menuBack'); app.go(app.scenes.menu()); }
    }
    if (input.pressed('menuLeft') && this.page > 0) { this.page--; audio.sfx('menuMove'); }
    if (input.pressed('back')) { audio.sfx('menuBack'); app.go(app.scenes.menu()); }
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.7 });
    heading(ctx, 'HOW TO PLAY', VIEW_W / 2, 8, { scale: 3 });
    // page tabs
    this.pages.forEach((p, i) => {
      const w = 150, x = VIEW_W / 2 - (this.pages.length * w) / 2 + i * w;
      ctx.fillStyle = i === this.page ? C.red : 'rgba(30,20,44,0.9)'; ctx.fillRect(x + 2, 42, w - 4, 12);
      drawText(ctx, `${i + 1}. ${p}`, x + w / 2, 45, { color: i === this.page ? '#fff' : C.dim, align: 'center' });
    });
    frame(ctx, 24, 60, VIEW_W - 48, 266);
    if (this.page === 0) {
      drawText(ctx, 'KEYBOARD', 44, 72, { color: C.gold });
      drawControlCard(ctx, 44, 86);
      drawText(ctx, 'GAMEPAD', 44, 186, { color: C.gold });
      const pad = [['STICK / D-PAD', 'MOVE (FULL TILT = RUN)'], ['X / Y', 'PUNCH'], ['B', 'KICK'], ['A', 'JUMP'], ['RB', 'BLOCK'], ['LT', 'DODGE'], ['LB', 'GRAB / THROW'], ['STICK CLICK', 'PICK UP / USE'], ['SELECT', 'KIT BAG'], ['START', 'PAUSE']];
      pad.forEach(([k, t], i) => { const c = i % 2, r = Math.floor(i / 2); drawText(ctx, k, 44 + c * 280, 200 + r * 13, { color: '#ffffff' }); drawText(ctx, t, 140 + c * 280, 200 + r * 13, { color: '#c0e8ff' }); });
      drawText(ctx, 'CONTROLS MODE (OPTIONS): SCREEN = UP IS UP THE SCREEN. ISO = ARROWS FOLLOW THE STREETS.', VIEW_W / 2, 270, { color: C.dim, align: 'center' });
    } else if (this.page === 1) {
      drawComboList(ctx, 44, 72);
      // animated combo demo
      const look = buildLook(save.data.outfit);
      const step = 0.42, tt = this.t % (DEMO_COMBO.length * step), k = Math.floor(tt / step), p = (tt % step) / step;
      const [atk, key] = DEMO_COMBO[k];
      const pose = atk ? attackPose(atk, p < 0.3 ? 0 : p < 0.55 ? 1 : 2, p < 0.3 ? p / 0.3 : p < 0.55 ? (p - 0.3) / 0.25 : (p - 0.55) / 0.45) : sampleAnim('guard', this.t);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(44, 170, VIEW_W - 88, 130);
      drawDoll(ctx, 200, 292, look, pose, { scale: 3, time: this.t, face: atk ? 'shout' : 'angry' });
      // the victim (a punch bag in Portside blue)
      ctx.fillStyle = '#120c14'; ctx.fillRect(299, 180, 2, 30); ctx.fillRect(285, 208, 30, 80);
      const wob = atk && p > 0.3 && p < 0.8 ? 3 : 0;
      ctx.fillStyle = '#1f4fb4'; ctx.fillRect(287 + wob, 210, 26, 76); ctx.fillStyle = '#f2f2f2'; ctx.fillRect(287 + wob, 230, 26, 6); ctx.fillRect(287 + wob, 260, 26, 6);
      // input strip
      const seq = DEMO_COMBO.map(c => c[1]);
      let x = 350;
      drawText(ctx, 'INPUT:', x, 190, { color: C.dim });
      seq.forEach((s, i) => { if (!s) { x += 6; return; } const on = i === k; drawText(ctx, s, x + 40, 190, { color: on ? C.gold : '#6a5a7a', scale: on ? 2 : 1 }); x += 14; });
      drawText(ctx, atk ? atk.toUpperCase() : '...', 390, 220, { color: '#ffffff', scale: 2, outline: '#000' });
      drawText(ctx, 'TIME EACH PRESS AS THE LAST HIT LANDS.', 350, 250, { color: '#c0b8d0' });
      drawText(ctx, 'BLOCK WITH SHIFT. YOUR GUARD (PINK BAR)', 350, 262, { color: '#c0b8d0' });
      drawText(ctx, 'BREAKS IF YOU HIDE TOO LONG - DODGE!', 350, 274, { color: '#c0b8d0' });
    } else {
      const rows = [
        ['scarf', 'FIVE LOST SCARVES ARE HIDDEN IN EVERY LEVEL. FIND THEM ALL.'],
        ['badge', 'ONE RARE PIN BADGE PER LEVEL. USUALLY SOMEWHERE SILLY.'],
        ['secret', 'SECRETS: CRACKED WALLS, LOOSE CRATES, ROOFTOPS. EXPLORE.'],
        ['pint', 'PINTS, PIES AND KEBABS HEAL. EXTRA ONES GO IN THE KIT BAG (1 2 3).'],
        ['key', 'KEYS AND TICKETS OPEN GATES, DOORS AND TURNSTILES.'],
        ['cash20', 'CASH IS BANKED AT THE END OF A LEVEL. SPEND IT IN THE WARDROBE.'],
        ['chair', 'BOTTLES, CHAIRS, BIN LIDS: PICK UP WITH E, THROW WITH I.'],
        ['fanzine', 'FANZINES TELL YOU THINGS. READ THEM WITH E.'],
      ];
      rows.forEach(([id, t], i) => {
        const y = 76 + i * 30;
        ctx.fillStyle = '#000'; ctx.fillRect(44, y - 4, 24, 24); ctx.fillStyle = '#1a1222'; ctx.fillRect(45, y - 3, 22, 22);
        if (id === 'scarf') scarfIcon(ctx, 47, y + 4, true, 2);
        else if (id === 'badge') badgeIcon(ctx, 48, y, true, 2);
        else if (id === 'secret') secretIcon(ctx, 48, y, true, 2);
        else if (ITEMS[id] && ITEMS[id].icon) ITEMS[id].icon(ctx, 56, y + 17, this.t);
        drawText(ctx, t, 80, y + 4, { color: '#e8e0f0' });
      });
    }
    hintBar(ctx, [['menuLeft', 'PAGE'], ['confirm', 'NEXT'], ['back', 'BACK']], VIEW_H - 14);
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- credits
export const CREDITS = [
  ['T', 'THE LAST HOOLIGAN'],
  ['', ''],
  ['H', 'A NORDHAMN SOFTWARE PRODUCTION'],
  ['', ''],
  ['H', 'GAME DESIGN, CODE, PIXELS & NOISE'], ['N', 'THE NORDHAMN SOFTWARE COLLECTIVE'], ['N', 'BUILT WITH CLAUDE'],
  ['', ''],
  ['H', 'LEVEL DESIGN'], ['N', 'EIGHT LADS IN A LOCK-UP GARAGE'],
  ['', ''],
  ['H', 'FIGHT CHOREOGRAPHY'], ['N', 'BIG TEL (VIA A SOLICITOR)'],
  ['', ''],
  ['H', 'TERRACE CHANTS'], ['N', 'THE NORTH BANK, ALL OF IT'],
  ['', ''],
  ['H', 'CATERING'], ['N', 'SILLEN FISH BAR'], ['N', 'THAT KEBAB VAN BY THE DOCKS'],
  ['', ''],
  ['H', 'WARDROBE'], ['N', 'YOUR MUM\'S CATALOGUE'],
  ['', ''],
  ['H', 'SPECIAL THANKS'], ['N', 'EVERY KID WHO EVER TYPED IN A LISTING'], ['N', 'FROM A MAGAZINE AND GOT IT WRONG'], ['N', 'THE 8-BIT ISOMETRIC ADVENTURES'], ['N', 'AND 16-BIT BRAWLERS WE GREW UP ON'],
  ['', ''],
  ['S', 'ALL CLUBS, FIRMS, PUBS AND PEOPLE ARE FICTIONAL.'],
  ['S', 'NO REAL PUNCHES WERE THROWN.'],
  ['S', 'PLEASE SUPPORT YOUR LOCAL CLUB. PEACEFULLY.'],
  ['', ''], ['', ''],
  ['T', 'UP THE ANCHORS!'],
];
export function creditsHeight() { return CREDITS.length * 16 + 40; }
export function drawCreditsRoll(ctx, scrollY) {
  CREDITS.forEach(([k, l], i) => {
    const y = Math.round(VIEW_H - scrollY + i * 16);
    if (y < -20 || y > VIEW_H + 10) return;
    const fade = Math.max(0, Math.min(1, (y + 10) / 50, (VIEW_H - y) / 40));
    ctx.globalAlpha = fade;
    if (k === 'T') drawText(ctx, l, VIEW_W / 2, y - 4, { color: C.gold, align: 'center', scale: 2, outline: '#000' });
    else if (k === 'H') drawText(ctx, l, VIEW_W / 2, y, { color: '#ff6a7a', align: 'center', outline: '#000' });
    else if (k === 'S') drawText(ctx, l, VIEW_W / 2, y, { color: C.dim, align: 'center', outline: '#000' });
    else drawText(ctx, l, VIEW_W / 2, y, { color: '#ffffff', align: 'center', outline: '#000' });
  });
  ctx.globalAlpha = 1;
}

export class CreditsScene {
  constructor(next) { this.t = 0; this.next = next; }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    const speed = input.down('confirm') || input.down('menuDown') ? 90 : 24;
    this.scroll = (this.scroll || 0) + dt * speed;
    if ((this.t > 0.5 && input.pressed('back')) || this.scroll > creditsHeight() + VIEW_H) { audio.sfx('menuBack'); app.go(this.next ? this.next() : app.scenes.menu()); }
  }
  draw(ctx) {
    backdrop.draw(ctx, { lads: true, dim: 0.35 });
    ctx.fillStyle = 'rgba(4,2,10,0.5)'; ctx.fillRect(VIEW_W / 2 - 180, 0, 360, VIEW_H);
    drawCreditsRoll(ctx, this.scroll || 0);
    drawCrest(ctx, 14, 12, 2);
    hintBar(ctx, [['confirm', 'FAST'], ['back', 'BACK']], VIEW_H - 14);
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- hall of fame name entry
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .!?';
export class NameEntryScene {
  constructor(score, level, next) {
    this.score = score; this.level = level; this.next = next; this.t = 0;
    const init = (save.data.lastInitials || 'AAA').padEnd(3, 'A').slice(0, 3);
    this.chars = init.split('').map(c => Math.max(0, ALPHA.indexOf(c)));
    this.pos = 0; this.done = false; this.rank = -1; this.rep = new Repeater(0.3, 0.09);
  }
  enter() { audio.music('title'); audio.sfx('secret'); }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.done) { if (this.t - this.doneT > 1 && (input.pressed('confirm') || input.pressed('back') || this.t - this.doneT > 6)) app.go(this.next ? this.next() : app.scenes.title({ skipIntro: true })); return; }
    const n = ALPHA.length;
    if (this.rep.check('menuUp', dt)) { this.chars[this.pos] = (this.chars[this.pos] + 1) % n; audio.sfx('menuMove'); }
    if (this.rep.check('menuDown', dt)) { this.chars[this.pos] = (this.chars[this.pos] + n - 1) % n; audio.sfx('menuMove'); }
    if (input.pressed('menuLeft') && this.pos > 0) { this.pos--; audio.sfx('menuMove'); }
    if (input.pressed('menuRight') && this.pos < 2) { this.pos++; audio.sfx('menuMove'); }
    if (input.pressed('back') && this.pos > 0) { this.pos--; audio.sfx('menuBack'); }
    if (input.pressed('confirm')) {
      if (this.pos < 2) { this.pos++; audio.sfx('menuSelect'); }
      else {
        const name = this.chars.map(i => ALPHA[i]).join('');
        save.data.lastInitials = name;
        this.rank = save.addHiscore(name, this.score, this.level);
        this.done = true; this.doneT = this.t; audio.sfx('levelComplete');
      }
    }
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.68 });
    heading(ctx, this.done ? 'HALL OF FAME' : 'NEW HIGH SCORE!', VIEW_W / 2, 10, { scale: 3, color: this.done ? C.gold : (blink(this.t, 4) ? C.gold : '#ffffff') });
    if (this.done) { drawHallOfFame(ctx, this.t - this.doneT + 1, this.rank, 66); }
    else {
      drawText(ctx, fmtScore(this.score), VIEW_W / 2, 60, { color: '#ffffff', scale: 3, align: 'center', outline: '#000' });
      drawText(ctx, 'ENTER YOUR INITIALS, LEGEND', VIEW_W / 2, 96, { color: '#c0b8d0', align: 'center', outline: '#000' });
      for (let i = 0; i < 3; i++) {
        const x = VIEW_W / 2 - 75 + i * 50, y = 124;
        const sel = i === this.pos;
        frame(ctx, x, y, 44, 56, { fill: sel ? 'rgba(80,10,24,0.95)' : 'rgba(14,9,22,0.92)', accent: sel ? C.gold : C.red, rivets: false });
        drawText(ctx, ALPHA[this.chars[i]] === ' ' ? '_' : ALPHA[this.chars[i]], x + 22, y + 14, { color: sel && blink(this.t, 4) ? C.gold : '#ffffff', scale: 4, align: 'center', outline: '#000' });
        if (sel) { drawText(ctx, '↑', x + 22, y - 12, { color: C.gold, align: 'center' }); drawText(ctx, '↓', x + 22, y + 60, { color: C.gold, align: 'center' }); }
      }
      const look = buildLook(save.data.outfit);
      drawDoll(ctx, 110, 300, look, sampleAnim('victory', this.t), { scale: 3, time: this.t, face: 'shout' });
      drawDoll(ctx, 530, 300, look, sampleAnim('cheer', this.t + 0.3), { scale: 3, time: this.t, face: 'shout', flip: true });
      hintBar(ctx, [['menuUp', 'LETTER'], ['menuLeft', 'MOVE'], ['confirm', 'OK']], VIEW_H - 14);
    }
    scanlines(ctx);
  }
}

app.scenes.levelSelect = () => new LevelSelectScene();
app.scenes.options = () => new OptionsScene();
app.scenes.howToPlay = () => new HowToPlayScene();
app.scenes.credits = next => new CreditsScene(next);
app.scenes.nameEntry = (score, level, next) => new NameEntryScene(score, level, next);
