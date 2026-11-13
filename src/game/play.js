// PlayScene: runs a World + HUD, pause menu (resume/kit bag/restart/options/controls/quit),
// kit-bag overlay (items, weapon, keys, collectibles, explored map) and the fanzine reader input.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText } from '../engine/font.js';
import { app } from '../app.js';
import { World } from './world.js';
import { HUD } from './hud.js';
import { game } from './state.js';
import { LEVELS } from '../content/levels/index.js';
import { audio } from '../audio/audio.js';
import { save } from '../save.js';
import { ITEMS } from './items.js';
import { frame, MenuList, hintBar, heading, scarfIcon, badgeIcon, keyIcon, secretIcon, coinIcon, scanlines, fmtTime, fmtScore, hideLoader, C } from '../ui/widgets.js';
import { optionItems, drawBindings, drawControlCard } from '../ui/options.js';
import { r3d } from '../render3d/index.js';
import { getFirm, applyTrip, resultFromWorld } from './firmdata.js';
import { updateFirmInput, drawFirmWorld, drawFirmScreen, drawFirmPanel, COMMAND_SLOW } from '../ui/firmhud.js';

export class PlayScene {
  // 2D renderer: the world is pixel art, drawn at the 2x resolution (main.js). 3D renderer: the 2D canvas only carries
  // overlays and the HUD, so it runs at full device resolution (HD text and panels; pixel sprites stay unsmoothed)
  get pixel() { return !r3d.renderer; }
  constructor(levelIndex) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    this.paused = false;
    this.pauseSel = 0;
    this.invOpen = false;
    this.invSel = 0;
    this.page = 'menu';
    this.t = 0;
    this.wasAlive = true;
  }

  enter() {
    hideLoader();
    game.levelIndex = this.levelIndex;
    game.keys = new Set();
    this.world = new World(this.level, game, {
      onComplete: stats => this.complete(stats),
      onGameOver: () => {
        this.bankTotals();
        // the firm takes the loss too (injuries, reputation, heat) — once per attempt
        if (this.world.firm && (save.data.settings || {}).firm !== false && !this.firmApplied) { this.firmApplied = true; applyTrip(getFirm(game.character), resultFromWorld(this.world, false)); save.write(); }
        app.go(app.scenes.gameOver(this.levelIndex));
      },
    });
    this.hud = new HUD();
    this.firmUI = {};
    if (this.world.firm && this.world.firm.lads.length && !(save.data.seenNew || []).includes('firmHint')) {
      (save.data.seenNew ||= []).push('firmHint'); save.write();
      setTimeout(() => this.world && this.world.toast(input.lastDevice === 'pad' ? 'YOUR FIRM: D-PAD ORDERS, HOLD RT = COMMAND (STICK AIMS, X = HAVE HIM / GO)' : 'YOUR FIRM: R WITH ME  T GET INTO THEM  H HOLD  Y SING UP  HOLD G = COMMAND (WASD AIMS, J = HAVE HIM / GO)'), 4500);
    }
    audio.music(this.level.music || 'streets');
    audio.crowd(this.level.crowd || 0);
    this.buildMenus();
  }

  exit() { audio.crowd(0); this.unduck(); if (r3d.renderer) r3d.renderer.end(); }

  duck() { const s = save.data.settings; audio.setVolumes({ music: (s.music ?? 0.6) * 0.35 }); }
  unduck() { const s = save.data.settings; audio.setVolumes({ music: s.music ?? 0.6, sfx: s.sfx ?? 0.8 }); }

  buildMenus() {
    this.pauseMenu = new MenuList([
      { label: 'RESUME', fn: () => this.resume(), hint: 'BACK TO THE AGGRO' },
      { label: 'KIT BAG', fn: () => { this.paused = false; this.invOpen = true; }, hint: 'ITEMS, KEYS AND THE MAP' },
      { label: 'RESTART LEVEL', fn: () => this.ask('RESTART THIS LEVEL?', () => { game.restore(save.data.run); app.go(app.scenes.play(this.levelIndex)); }), hint: 'FROM THE START OF THE LEVEL' },
      { label: 'OPTIONS', fn: () => { this.page = 'options'; }, hint: 'SOUND, SHAKE, CONTROLS' },
      { label: 'CONTROLS', fn: () => { this.page = 'controls'; }, hint: 'KEYS AND COMBOS' },
      { label: 'QUIT TO MENU', fn: () => this.ask('QUIT TO THE MENU?', () => { this.bankTotals(); audio.setBoss(false); app.go(app.scenes.menu()); }), hint: 'YOU CAN CONTINUE FROM THIS LEVEL' },
    ], { onBack: () => this.resume() });
    this.optMenu = new MenuList(optionItems({ inGame: true, onKeys: () => { this.page = 'keys'; }, onBack: () => { this.page = 'menu'; } }), { onBack: () => { this.page = 'menu'; } });
  }

  ask(question, yes) {
    this.question = question;
    this.page = 'confirm';
    this.confirmMenu = new MenuList([
      { label: 'NO', fn: () => { this.page = 'menu'; } },
      { label: 'YES', fn: yes },
    ], { onBack: () => { this.page = 'menu'; } });
  }

  resume() { this.paused = false; this.page = 'menu'; this.unduck(); }

  bankTotals() {
    if (this.banked) return;
    this.banked = true;
    const T = (save.data.totals ||= {});
    const s = this.world.stats;
    T.kos = (T.kos || 0) + (s.kos || 0);
    T.playTime = (T.playTime || 0) + (s.time || 0);
    T.bestCombo = Math.max(T.bestCombo || 0, s.maxCombo || 0);
    save.write();
  }

  complete(stats) {
    const w = this.world, lv = this.level, d = save.data;
    // persist progress
    d.unlocked = Math.max(d.unlocked || 1, Math.min(LEVELS.length, this.levelIndex + 2));
    d.best[lv.id] = Math.max(d.best[lv.id] || 0, game.score);
    d.highScore = Math.max(d.highScore || 0, game.score);
    d.scarves[lv.id] = Array.from(new Set([...(d.scarves[lv.id] || []), ...w.record.scarves]));
    if (w.record.badge) d.badges[lv.id] = true;
    d.secrets[lv.id] = Array.from(new Set([...(d.secrets[lv.id] || []), ...w.record.secrets]));
    this.bankTotals();
    save.write();
    app.go(app.scenes.levelComplete(this.levelIndex, stats, w));
  }

  update(dt) {
    this.t += dt;
    const w = this.world;
    if (w.readText) {
      if (w.readText.t > 0.3 && (input.pressed('use') || input.pressed('confirm') || input.pressed('punchL') || input.pressed('back'))) { w.readText = null; audio.sfx('menuBack'); }
      w.update(dt);
      return;
    }
    if (this.invOpen) { this.updateInventory(dt); return; }
    if (this.paused) { this.updatePause(dt); return; }
    if (input.pressed('pause')) { this.paused = true; this.page = 'menu'; this.pauseMenu.sel = 0; audio.sfx('pause'); this.duck(); return; }
    if (input.pressed('inventory')) { this.invOpen = true; this.invSel = 0; audio.sfx('pause'); return; }
    updateFirmInput(w, this.firmUI, dt);
    w.update(w.firm && w.firm.command ? dt * COMMAND_SLOW : dt);
    const p = w.player;
    if (this.wasAlive && !p.alive) { const T = (save.data.totals ||= {}); T.deaths = (T.deaths || 0) + 1; }
    this.wasAlive = p.alive;
  }

  updatePause(dt) {
    if (this.page === 'menu') {
      if (input.pressed('pause') && !input.pressed('back')) { audio.sfx('pause'); this.resume(); return; }
      this.pauseMenu.update(dt);
    } else if (this.page === 'options') this.optMenu.update(dt);
    else if (this.page === 'confirm') this.confirmMenu.update(dt);
    else if (this.page === 'controls' || this.page === 'keys') {
      if (input.pressed('back') || input.pressed('confirm') || input.pressed('pause')) { audio.sfx('menuBack'); this.page = this.page === 'keys' ? 'options' : 'menu'; }
    }
  }

  updateInventory() {
    const n = 3;
    if (input.pressed('menuLeft')) { this.invSel = (this.invSel + n - 1) % n; audio.sfx('menuMove'); }
    if (input.pressed('menuRight')) { this.invSel = (this.invSel + 1) % n; audio.sfx('menuMove'); }
    if (input.pressed('confirm') || input.pressed('use')) {
      if (game.inventory[this.invSel]) { this.invOpen = false; this.world.useItemSlot(this.invSel); }
      else audio.sfx('locked');
    }
    if (input.pressed('back') || input.pressed('inventory') || input.pressed('pause')) { this.invOpen = false; audio.sfx('menuBack'); }
  }

  draw(ctx) {
    if (r3d.renderer) {
      ctx.imageSmoothingEnabled = false;
      r3d.renderer.render(this.world);
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      this.world.drawOverlay3D(ctx);
    } else this.world.draw(ctx);
    drawFirmWorld(ctx, this.world);
    this.hud.draw(ctx, this.world, game);
    drawFirmPanel(ctx, this.world);
    drawFirmScreen(ctx, this.world, this.firmUI);
    if (this.invOpen) this.drawInventory(ctx);
    if (this.paused) this.drawPause(ctx);
    if (!r3d.renderer) scanlines(ctx);
  }

  // ------------------------------------------------------------------ kit bag
  drawInventory(ctx) {
    const w = this.world;
    ctx.fillStyle = 'rgba(4,2,10,0.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const X = 16, Y = 22, W = VIEW_W - 32, H = VIEW_H - 50;
    frame(ctx, X, Y, W, H, { title: 'KIT BAG', fill: 'rgba(16,10,24,0.95)' });
    // ---- left column: items
    const lx = X + 12, ly = Y + 14;
    drawText(ctx, 'SNACKS & PINTS', lx, ly, { color: C.dim });
    for (let i = 0; i < 3; i++) {
      const sx = lx + i * 72, sy = ly + 12;
      const sel = i === this.invSel;
      ctx.fillStyle = sel ? C.gold : '#3a2a4a'; ctx.fillRect(sx - 2, sy - 2, 64, 64);
      ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, 60, 60);
      ctx.fillStyle = sel ? '#2a1a10' : '#140e1c'; ctx.fillRect(sx + 1, sy + 1, 58, 58);
      drawText(ctx, String(i + 1), sx + 3, sy + 3, { color: '#6a5a7a' });
      const it = game.inventory[i];
      if (it && ITEMS[it.id]) {
        ctx.save(); ctx.translate(sx + 30, sy + 50); ctx.scale(3, 3); ITEMS[it.id].icon(ctx, 0, 0, this.t); ctx.restore();
        drawText(ctx, 'X' + it.count, sx + 57, sy + 51, { color: '#fff', align: 'right', outline: '#000' });
      } else drawText(ctx, 'EMPTY', sx + 30, sy + 27, { color: '#4a3a5a', align: 'center' });
    }
    const cur = game.inventory[this.invSel];
    if (cur && ITEMS[cur.id]) {
      const def = ITEMS[cur.id];
      drawText(ctx, def.name, lx, ly + 84, { color: '#ffffff' });
      drawText(ctx, (def.heal ? '+' + def.heal + ' HEALTH' : '') + '   PRESS ' + (input.lastDevice === 'pad' ? 'A' : 'ENTER') + ' TO USE', lx, ly + 95, { color: '#5aff7a' });
    } else drawText(ctx, 'PICK UP PINTS, PIES AND KEBABS TO STASH THEM', lx, ly + 84, { color: '#6a5a7a' });
    // weapon
    const wy = ly + 114;
    drawText(ctx, 'IN YOUR HAND', lx, wy, { color: C.dim });
    const p = w.player;
    ctx.fillStyle = '#000'; ctx.fillRect(lx, wy + 11, 30, 30); ctx.fillStyle = '#1a1222'; ctx.fillRect(lx + 1, wy + 12, 28, 28);
    if (p.weapon && p.weapon.def) {
      if (p.weapon.def.icon) p.weapon.def.icon(ctx, lx + 15, wy + 37, this.t);
      drawText(ctx, p.weapon.def.name, lx + 38, wy + 14, { color: C.gold });
      const max = (p.weapon.def.weapon && p.weapon.def.weapon.durability) || p.weapon.durability || 1;
      drawText(ctx, 'DURABILITY', lx + 38, wy + 26, { color: C.dim });
      for (let i = 0; i < Math.min(12, max); i++) { ctx.fillStyle = i < p.weapon.durability ? C.gold : '#3a2e44'; ctx.fillRect(lx + 100 + i * 6, wy + 26, 5, 6); }
    } else { drawText(ctx, 'BARE KNUCKLES', lx + 38, wy + 14, { color: '#c0b8d0' }); drawText(ctx, 'GRAB ONE: BOTTLES, CHAIRS, BIN LIDS...', lx + 38, wy + 26, { color: '#6a5a7a' }); }
    // keys
    const ky = wy + 50;
    drawText(ctx, 'KEYS', lx, ky, { color: C.dim });
    if (game.keys.size) [...game.keys].slice(0, 4).forEach((k, i) => { keyIcon(ctx, lx + i * 54, ky + 12); drawText(ctx, String(k).toUpperCase().slice(0, 6), lx + i * 54 + 11, ky + 12, { color: '#e8c040' }); });
    else drawText(ctx, 'NONE YET', lx, ky + 12, { color: '#4a3a5a' });
    // collectibles
    const cy = ky + 30;
    drawText(ctx, 'THIS LEVEL', lx, cy, { color: C.dim });
    const tot = w.totalScarves || 5;
    for (let i = 0; i < tot; i++) scarfIcon(ctx, lx + i * 13, cy + 12, w.record.scarves.has(i));
    badgeIcon(ctx, lx + tot * 13 + 6, cy + 11, !!w.record.badge);
    const sf = (w.secrets || []).filter(s => s.found).length, st = (w.secrets || []).length;
    secretIcon(ctx, lx + tot * 13 + 22, cy + 11, sf > 0);
    drawText(ctx, `${sf}/${st}`, lx + tot * 13 + 33, cy + 12, { color: '#7affe0' });
    coinIcon(ctx, lx, cy + 26);
    drawText(ctx, '£' + game.cash, lx + 9, cy + 26, { color: C.cash });
    drawText(ctx, 'KO ' + (w.stats.kos || 0) + '   TIME ' + fmtTime(w.stats.time || 0), lx + 60, cy + 26, { color: '#c0b8d0' });
    // ---- right column: map
    const mx = X + 248, my = Y + 14, mw = W - 260, mh = H - 30;
    drawText(ctx, 'MAP OF ' + (this.level.name || ''), mx, my, { color: C.dim });
    const mm = this.hud.getMinimap(w);
    frame(ctx, mx, my + 10, mw, mh - 10, { fill: '#06040c', rivets: false });
    if (mm) mm.draw(ctx, mx + 2, my + 12, mw - 4, mh - 14, { full: true });
    [['YOU', '#ffffff'], ['AGGRO', '#ff4a5a'], ['BOSS', '#ffd23a'], ['GO', '#ffe14a'], ['EXIT', '#7aff9a']].reduce((xx, [lbl, col]) => {
      ctx.fillStyle = '#000'; ctx.fillRect(xx - 1, my + mh - 8, 6, 6); ctx.fillStyle = col; ctx.fillRect(xx, my + mh - 7, 4, 4);
      drawText(ctx, lbl, xx + 7, my + mh - 8, { color: col });
      return xx + 14 + measureText(lbl);
    }, mx + 6);
    hintBar(ctx, [['menuLeft', 'SELECT'], ['confirm', 'USE'], ['inventory', 'CLOSE']], VIEW_H - 18);
  }

  // ------------------------------------------------------------------ pause
  drawPause(ctx) {
    ctx.fillStyle = 'rgba(4,2,10,0.74)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.page === 'controls') { this.drawControlsPage(ctx); return; }
    if (this.page === 'keys') {
      frame(ctx, 40, 30, VIEW_W - 80, VIEW_H - 64, { title: 'KEY BINDINGS' });
      drawBindings(ctx, 70, 48);
      hintBar(ctx, [['back', 'BACK']], VIEW_H - 22);
      return;
    }
    heading(ctx, 'PAUSED', VIEW_W / 2, 34, { scale: 4 });
    drawText(ctx, `LEVEL ${this.level.num || this.levelIndex + 1} - ${this.level.name}`, VIEW_W / 2, 76, { color: '#ffffff', align: 'center', outline: '#000' });
    if (this.page === 'menu') {
      frame(ctx, VIEW_W / 2 - 110, 96, 220, 118, { fill: 'rgba(14,9,22,0.92)' });
      this.pauseMenu.draw(ctx, VIEW_W / 2 - 100, 106, { w: 200, rowH: 18 });
      drawText(ctx, this.pauseMenu.hint(), VIEW_W / 2, 224, { color: C.dim, align: 'center', outline: '#000' });
      // run summary
      const w = this.world;
      drawText(ctx, `SCORE ${fmtScore(game.score)}   £${game.cash}   KO ${w.stats.kos || 0}   ${fmtTime(w.stats.time || 0)}`, VIEW_W / 2, 246, { color: C.gold, align: 'center', outline: '#000' });
      drawText(ctx, this.tip(), VIEW_W / 2, 266, { color: '#8a7a9a', align: 'center', outline: '#000' });
      hintBar(ctx, [['menuUp', 'MOVE'], ['confirm', 'SELECT'], ['pause', 'RESUME']], VIEW_H - 22);
    } else if (this.page === 'options') {
      frame(ctx, VIEW_W / 2 - 170, 92, 340, 200, { title: 'OPTIONS', fill: 'rgba(14,9,22,0.94)' });
      this.optMenu.draw(ctx, VIEW_W / 2 - 160, 104, { w: 320, rowH: 16 });
      drawText(ctx, this.optMenu.hint(), VIEW_W / 2, 300, { color: C.dim, align: 'center', outline: '#000' });
      hintBar(ctx, [['menuUp', 'MOVE'], ['menuLeft', 'CHANGE'], ['back', 'BACK']], VIEW_H - 22);
    } else if (this.page === 'confirm') {
      frame(ctx, VIEW_W / 2 - 120, 120, 240, 80, { fill: 'rgba(30,6,14,0.95)', accent: C.red });
      drawText(ctx, this.question, VIEW_W / 2, 134, { color: '#ffffff', align: 'center' });
      this.confirmMenu.draw(ctx, VIEW_W / 2 - 60, 156, { w: 120, rowH: 18 });
    }
  }

  tip() {
    const tips = ['TIP: BLOCKING DRAINS YOUR GUARD - DODGE BEFORE IT BREAKS', 'TIP: THROWN LADS BOWL OVER THEIR MATES', 'TIP: KICK A MAN WHEN HE IS DOWN. IT IS THAT KIND OF GAME', 'TIP: SUSPICIOUS WALLS ARE SOMETIMES NOT WALLS', 'TIP: CASH BUYS CLOBBER IN THE WARDROBE', 'TIP: RUN + KICK = FLYING KICK'];
    return tips[Math.floor(this.levelIndex * 3 + (this.world.stats.time || 0) / 20) % tips.length];
  }

  drawControlsPage(ctx) {
    frame(ctx, 30, 26, VIEW_W - 60, VIEW_H - 58, { title: 'CONTROLS' });
    drawControlCard(ctx, 60, 44);
    drawComboList(ctx, 60, 146);
    hintBar(ctx, [['back', 'BACK']], VIEW_H - 22);
  }
}

// Combo list (also used by HOW TO PLAY).
export const COMBOS = [
  ['J J J', 'JAB JAB HOOK'], ['J J J J', 'JAB JAB HOOK UPPERCUT'], ['K K K', 'CROSS CROSS UPPERCUT'],
  ['J K L', 'ONE-TWO ROUNDHOUSE'], ['L L', 'KICK, SPIN KICK'], ['RUN + J', 'SHOULDER CHARGE'], ['RUN + L', 'FLYING KICK'],
  ['JUMP + L / J', 'JUMP KICK / DIVE PUNCH'], ['I (GRAB) + J', 'KNEES / HEADBUTT'], ['I (GRAB) + L', 'THROW'], ['L (MAN DOWN)', 'STOMP'],
];
export function drawComboList(ctx, x, y) {
  drawText(ctx, 'COMBOS', x, y, { color: C.gold });
  ctx.fillStyle = C.red; ctx.fillRect(x, y + 9, VIEW_W - 2 * x, 1);
  COMBOS.forEach(([k, n], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const xx = x + col * 260, yy = y + 16 + row * 13;
    drawText(ctx, k, xx, yy, { color: '#ffffff' });
    drawText(ctx, n, xx + 100, yy, { color: '#c0e8ff' });
  });
}

// Legacy helper (kept for compatibility): compact controls list centred at y.
export function drawControls(ctx, y) {
  const L = [
    ['MOVE', 'WASD / ARROWS (DOUBLE-TAP = RUN)'], ['PUNCH L / R', 'J / K   (OR Z / X)'], ['KICK', 'L   (OR C)'], ['JUMP', 'SPACE'],
    ['BLOCK', 'SHIFT (HOLD)'], ['DODGE', 'O   (OR V)'], ['GRAB / THROW WEAPON', 'I   (OR B)'], ['PICK UP / USE', 'E   (OR F)'],
    ['EAT / DRINK', '1  2  3'], ['KIT BAG / PAUSE', 'TAB / ESC'],
  ];
  L.forEach(([a, b], i) => {
    drawText(ctx, a, VIEW_W / 2 - 8, y + i * 10, { color: '#ffd23a', align: 'right' });
    drawText(ctx, b, VIEW_W / 2 + 8, y + i * 10, { color: '#ffffff' });
  });
}

app.scenes.play = i => new PlayScene(i);
