// In-game HUD (screen space, drawn after the world).
// Layout (640x360): player panel top-left, score/cash top-centre, enemy panel top-right, combo under it,
// kit strip bottom-left, boss bar bottom-centre, minimap bottom-right, toasts above the minimap,
// banners mid-screen, fanzine reader on top.
import { MAX_SLOTS } from './state.js';
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { drawText, measureText, wrapText } from '../engine/font.js';
import { makeCanvas } from '../engine/gfx.js';
import { drawPortrait } from './doll.js';
import { ITEMS } from './items.js';
import { input } from '../engine/input.js';
import { save } from '../save.js';
import { frame, bar, scarfIcon, badgeIcon, keyIcon, coinIcon, keyName, fmtScore, C, devScale } from '../ui/widgets.js';
import { Minimap } from '../ui/minimap.js';
import { drawItemIcon } from '../ui/itemicon.js';
import { r3d } from '../render3d/index.js';

const GOLD = '#ffd23a';

export const COMBO_WORDS = [
  [50, 'NORDHAMN ROYALTY'], [40, 'THEY WILL WRITE SONGS'], [30, 'CALL THE OLD BILL!'], [25, 'UNSTOPPABLE'],
  [20, 'TERRACE LEGEND'], [15, 'ABSOLUTE SCENES'], [12, 'LIMBS EVERYWHERE!'], [10, 'SCENES!'], [8, 'PROPER NAUGHTY'],
  [6, 'LOVELY STUFF'], [5, 'TASTY'], [4, 'TIDY'], [3, 'NICE ONE'], [2, 'OI OI'],
];
export function comboWord(n) { for (const [k, w] of COMBO_WORDS) if (n >= k) return w; return ''; }

let lowVig = null;
function lowHpVignette(ctx, a) {
  if (!lowVig) {
    lowVig = makeCanvas(VIEW_W, VIEW_H);
    const g = lowVig.getContext('2d');
    const rg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.6);
    rg.addColorStop(0, 'rgba(160,0,20,0)'); rg.addColorStop(1, 'rgba(160,0,20,1)');
    g.fillStyle = rg; g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.globalAlpha = a; ctx.drawImage(lowVig, 0, 0); ctx.globalAlpha = 1;
}

export class HUD {
  constructor() {
    this.ghostHp = 1;
    this.enemyGhost = 1;
    this.bossGhost = 1;
    this.scoreShown = 0;
    this.cashShown = 0;
    this.lastEnemyRef = null;
    this.lastHp = -1;
    this.hurtT = 0;
    this.comboShown = 0;
    this.comboPop = 0;
    this.comboFade = 0;
    this.comboLast = 0;
    this.lastTime = null;
    this.minimap = null;
    this.mmWorld = null;
    this.introT = 0;
  }

  getMinimap(world) {
    if (this.mmWorld !== world) {
      this.mmWorld = world;
      try { this.minimap = new Minimap(world); } catch (e) { console.warn('[hud] minimap failed', e); this.minimap = null; }
    }
    return this.minimap;
  }

  draw(ctx, world, game, dtIn) {
    const p = world.player;
    // dt from world time (pauses freeze HUD animation too)
    let dt = dtIn;
    if (dt === undefined) { dt = this.lastTime === null ? 0 : Math.max(0, Math.min(0.1, world.time - this.lastTime)); this.lastTime = world.time; }
    this.introT += dt;
    const T = world.time;

    // ---- low HP vignette (under the HUD)
    const frac = Math.max(0, p.hp / p.maxHp);
    if (p.alive && frac < 0.3) lowHpVignette(ctx, 0.25 + Math.sin(T * 6) * 0.12 + (0.3 - frac));
    if (p.hp < this.lastHp) this.hurtT = 0.25;
    this.lastHp = p.hp;
    if (this.hurtT > 0) this.hurtT -= dt;

    this.drawPlayer(ctx, world, game, dt, frac);
    this.drawScore(ctx, world, game, dt);
    this.drawEnemy(ctx, world, dt);
    this.drawCombo(ctx, world, dt);
    this.drawBoss(ctx, world, dt);
    this.drawKit(ctx, world, game);
    if (save.data.settings.minimap !== false) this.drawMinimap(ctx, world);
    this.drawToasts(ctx, world);
    this.drawBanner(ctx, world);
    this.drawHints(ctx, world);
    this.drawComplete(ctx, world);
    if (world.readText) this.drawFanzine(ctx, world.readText);
  }

  // ------------------------------------------------------------------ player panel
  // the player's portrait as a 3D bust (the menus' stage, the realistic model when there is one), re-rendered at most
  // 15 times a second into a small canvas; false when there's no 3D (the 2D game draws the pixel portrait)
  drawPortrait3D(ctx, p, x, y, s, t) {
    const stage = r3d.menu;
    if (!stage || !stage.ready || !p.look) return false;
    const S = devScale(ctx), W = Math.max(8, Math.round(s * S));
    const P = this.port || (this.port = { c: makeCanvas(W, W), t: -1 });
    if (P.c.width !== W) { P.c.width = P.c.height = W; P.t = -1; }
    if (t - P.t > 1 / 15 || t < P.t) {
      const g = P.c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, W); g.setTransform(S, 0, 0, S, 0, 0);
      const H = 138 * ((p.look && p.look.height) || 1);   // (tight: head and shoulders)
      const ok = stage.draw(g, 'hudport', [{ look: p.look, x: s / 2, feet: 3 + H, h: H, anim: 'idle', phase: 0, yaw: 0.3 }], { x: -10, y: -4, w: s + 20, h: s + 8 }, t, { light: 'studio' });
      if (!ok) return false;
      P.t = t;
    }
    ctx.drawImage(P.c, x, y, s, s);
    return true;
  }

  drawPlayer(ctx, world, game, dt, frac) {
    const p = world.player;
    const x = 6, y = 6, w = 198, h = 38;
    frame(ctx, x, y, w, h, { accent: C.red });
    // portrait
    ctx.fillStyle = '#000'; ctx.fillRect(x + 3, y + 3, 32, 32);
    const pg = ctx.createLinearGradient(0, y + 4, 0, y + 34);
    pg.addColorStop(0, '#4a3c08'); pg.addColorStop(1, '#0c0b06');
    ctx.fillStyle = pg; ctx.fillRect(x + 4, y + 4, 30, 30);
    const face = !p.alive ? 'ko' : this.hurtT > 0 ? 'hurt' : frac < 0.3 ? 'hurt' : p.state === 'attack' ? 'shout' : 'angry';
    if (!this.drawPortrait3D(ctx, p, x + 4, y + 4, 30, world.time)) drawPortrait(ctx, p.look, x + 4, y + 4, 30, { face });
    if (!p.alive) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 4, y + 4, 30, 30); }
    if (this.hurtT > 0) { ctx.fillStyle = `rgba(255,40,40,${this.hurtT * 2})`; ctx.fillRect(x + 4, y + 4, 30, 30); }
    // name + lives
    drawText(ctx, p.name || 'THE LAST HOOLIGAN', x + 40, y + 4, { color: '#ffffff', shadow: '#000' });
    const lives = Math.max(0, game.lives);
    const lt = '♥' + (lives > 4 ? 'X' + lives : '');
    let lx = x + w - 6;
    if (lives > 4) drawText(ctx, lt, lx, y + 4, { color: '#ff4a5a', align: 'right', shadow: '#000' });
    else for (let i = 0; i < lives; i++) { lx -= 7; drawText(ctx, '♥', lx, y + 4, { color: i % 2 ? '#ff6a7a' : '#ff3a4a', shadow: '#000' }); }
    // hp bar
    this.ghostHp = Math.max(frac, this.ghostHp - dt * 0.45);
    if (this.ghostHp < frac) this.ghostHp = frac;
    const low = frac < 0.3 && Math.floor(world.time * 6) % 2;
    bar(ctx, x + 40, y + 15, 152, 8, frac, low ? '#ff3a3a' : C.hp, low ? '#ffa0a0' : '#c8fff8', this.ghostHp, 10);
    // guard bar + label
    const gf = Math.max(0, p.guard / (p.maxGuard || 1));
    drawText(ctx, 'GUARD', x + 40, y + 27, { color: '#b090c0' });
    bar(ctx, x + 72, y + 28, 70, 4, gf, gf < 0.25 ? '#ff6a3a' : C.pink, '#ffc0e0', undefined, 5);
    // status tags
    const rush = p.buffs && p.buffs.rush, crash = p.buffs && p.buffs.crash;
    if (rush) drawText(ctx, 'BUZZING ' + Math.ceil(rush.t), x + w - 6, y + 27, { color: Math.floor(world.time * 10) % 2 ? '#ffffff' : '#ffe14a', align: 'right' });
    else if (crash) drawText(ctx, 'COMEDOWN ' + Math.ceil(crash.t), x + w - 6, y + 27, { color: '#8a8aa0', align: 'right' });
    else if (p.invuln > 0.5 && p.alive) drawText(ctx, 'SAFE', x + w - 6, y + 27, { color: Math.floor(world.time * 8) % 2 ? '#7affe0' : '#3a9a8a', align: 'right' });
    else if (p.weapon) drawText(ctx, 'ARMED', x + w - 6, y + 27, { color: GOLD, align: 'right' });
  }

  // ------------------------------------------------------------------ score / cash / objective
  drawScore(ctx, world, game, dt) {
    this.scoreShown += (game.score - this.scoreShown) * Math.min(1, dt * 10);
    if (Math.abs(game.score - this.scoreShown) < 1) this.scoreShown = game.score;
    this.cashShown += (game.cash - this.cashShown) * Math.min(1, dt * 8);
    if (Math.abs(game.cash - this.cashShown) < 0.5) this.cashShown = game.cash;
    const cx = VIEW_W / 2;
    const sc = fmtScore(this.scoreShown);
    const rising = game.score - this.scoreShown > 1;
    drawText(ctx, '1UP', cx - 68, 7, { color: Math.floor(world.time * 2) % 2 ? '#f2c811' : '#8a6a00', outline: '#000' });
    drawText(ctx, sc, cx + 4, 6, { color: rising ? '#ffffff' : GOLD, scale: 2, align: 'center', outline: '#000' });
    const hi = Math.max(save.topScore ? save.topScore() : (save.data.highScore || 0), game.score);
    drawText(ctx, 'HI ' + fmtScore(hi), cx + 4, 23, { color: '#e8d48a', align: 'center', outline: '#000' });
    // cash
    const cs = '£' + Math.round(this.cashShown);
    const cw = measureText(cs) + 10;
    coinIcon(ctx, cx - cw / 2 + 4, 32);
    drawText(ctx, cs, cx - cw / 2 + 12, 32, { color: C.cash, outline: '#000' });
    // level name (first seconds)
    if (this.introT < 4.5) {
      const a = Math.min(1, this.introT * 2, (4.5 - this.introT) * 2);
      ctx.globalAlpha = Math.max(0, a);
      const L = world.level;
      drawText(ctx, `LEVEL ${L.num || ''} - ${L.name || ''}`, cx, 44, { color: '#ffffff', align: 'center', outline: '#000' });
      ctx.globalAlpha = 1;
    } else {
      // active encounter info
      const e = world.encounters && world.encounters.find(o => o.state === 'active');
      if (e && !e.boss) {
        const alive = e.spawned.filter(f => f.alive && !f.removed).length + (e.pending || []).filter(q => !q.done).length;
        let rest = 0;
        for (let i = e.wave + 1; i < e.waves.length; i++) rest += (e.waves[i].enemies || []).length;
        const txt = (e.waves.length > 1 ? `WAVE ${e.wave + 1}/${e.waves.length}   ` : '') + `${alive + rest} LEFT`;
        drawText(ctx, txt, cx, 44, { color: '#ff9a7a', align: 'center', outline: '#000' });
      }
    }
  }

  // ------------------------------------------------------------------ enemy
  drawEnemy(ctx, world, dt) {
    let e = world.lastEnemyT > 0 ? world.lastEnemy : null;
    if (e && (e.removed || e === world.boss)) e = null;
    if (!e) return;
    if (this.lastEnemyRef !== e) { this.lastEnemyRef = e; this.enemyGhost = Math.max(0, e.hp / e.maxHp); }
    const ef = Math.max(0, e.hp / e.maxHp);
    this.enemyGhost = Math.max(ef, this.enemyGhost - dt * 0.6);
    const fade = Math.min(1, world.lastEnemyT * 3);
    ctx.globalAlpha = fade;
    const w = 168, h = 30, x = VIEW_W - w - 6, y = 6;
    frame(ctx, x, y, w, h, { accent: '#1f4fb4' });
    ctx.fillStyle = '#000'; ctx.fillRect(x + w - 27, y + 3, 24, 24);
    ctx.fillStyle = '#101a3a'; ctx.fillRect(x + w - 26, y + 4, 22, 22);
    drawPortrait(ctx, e.look, x + w - 26, y + 4, 22, { face: e.hp <= 0 ? 'ko' : 'angry' });
    drawText(ctx, e.name || 'BLOKE', x + w - 31, y + 5, { color: '#f2c811', align: 'right', shadow: '#000' });
    bar(ctx, x + 6, y + 16, w - 40, 7, ef, '#ff3a6a', '#ffb0c8', this.enemyGhost, 8);
    if (e.hp <= 0) drawText(ctx, 'K.O.', x + 8, y + 5, { color: GOLD, shadow: '#000' });
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ combo
  drawCombo(ctx, world, dt) {
    const n = world.combo.count;
    if (n > this.comboLast && n >= 2) { this.comboPop = 0.18; this.comboShown = n; }
    this.comboLast = n;
    if (n >= 2) { this.comboShown = n; this.comboFade = 1; }
    else if (this.comboFade > 0) this.comboFade -= dt * 2;
    if (this.comboPop > 0) this.comboPop -= dt;
    if (this.comboFade <= 0 || this.comboShown < 2) return;
    const c = this.comboShown;
    const big = c >= 10;
    const s = big ? 3 : 2;
    const pop = this.comboPop > 0 ? 1 : 0;
    const x = VIEW_W - 10, y = 46;
    ctx.globalAlpha = Math.max(0, Math.min(1, this.comboFade));
    const col = c >= 20 ? (Math.floor(world.time * 10) % 2 ? '#ff3aa0' : '#ffffff') : big ? '#ff3aa0' : GOLD;
    drawText(ctx, String(c), x - measureText(' HITS', 1) - 2, y - pop * 3, { color: col, scale: s + pop, align: 'right', outline: '#000' });
    drawText(ctx, 'HITS', x, y + (s + pop) * 7 - 8, { color: '#ffffff', align: 'right', outline: '#000' });
    const word = comboWord(c);
    if (word) {
      const wy = y + (s + pop) * 7 + 3;
      const ww = measureText(word) + 8;
      ctx.fillStyle = 'rgba(242,200,17,0.85)'; ctx.fillRect(x - ww + 2, wy - 2, ww, 11);
      ctx.fillStyle = '#141416'; ctx.fillRect(x - ww + 2, wy - 2, ww, 1);
      drawText(ctx, word, x - 2, wy, { color: '#141416', align: 'right' });   // black on the yellow label
    }
    // combo timer pip
    if (world.combo.count >= 2) { const tw = 40 * Math.max(0, Math.min(1, world.combo.t / 1.5)); ctx.fillStyle = '#000'; ctx.fillRect(x - 41, y - 6, 42, 3); ctx.fillStyle = GOLD; ctx.fillRect(x - 40, y - 5, Math.round(tw), 1); }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ boss bar
  drawBoss(ctx, world, dt) {
    const b = world.boss;
    if (!(b && !b.removed && (b.alive || b.deadT < 1.5) && b.controller && b.controller.aggro)) { this.bossGhost = 1; return; }
    const f = Math.max(0, b.hp / b.maxHp);
    this.bossGhost = Math.max(f, this.bossGhost - dt * 0.35);
    const x = 196, w = 308, y = VIEW_H - 36, h = 30;
    frame(ctx, x, y, w, h, { accent: '#ff2a2a', fill: 'rgba(30,4,10,0.9)' });
    ctx.fillStyle = '#000'; ctx.fillRect(x + 3, y + 3, 24, 24);
    ctx.fillStyle = '#3a0610'; ctx.fillRect(x + 4, y + 4, 22, 22);
    drawPortrait(ctx, b.look, x + 4, y + 4, 22, { face: b.hp <= 0 ? 'ko' : 'shout' });
    drawText(ctx, b.name || 'BOSS', x + 32, y + 5, { color: '#ff6a5a', shadow: '#000' });
    const tag = 'BOSS';
    drawText(ctx, tag, x + w - 6, y + 5, { color: Math.floor(world.time * 3) % 2 ? GOLD : '#ff8a3a', align: 'right', shadow: '#000' });
    bar(ctx, x + 32, y + 16, w - 38, 8, f, f < 0.3 ? '#ff7a1a' : '#e01a2a', '#ffa080', this.bossGhost, 16);
    // additional bosses (twins / lieutenants flagged boss:true) get slim bars stacked above
    let k = 0;
    for (const o of world.bosses || []) {
      if (o === b || o.removed || !o.alive || !(o.controller && o.controller.aggro)) continue;
      const yy = y - 14 - k * 13;
      frame(ctx, x + 40, yy, w - 80, 11, { accent: '#ff6a2a', fill: 'rgba(30,4,10,0.85)' });
      drawText(ctx, o.name || 'BOSS', x + 44, yy + 2, { color: '#ffb0a0' });
      bar(ctx, x + 150, yy + 3, w - 196, 5, Math.max(0, o.hp / o.maxHp), '#e01a2a', '#ffa080');
      if (++k >= 2) break;
    }
  }

  // ------------------------------------------------------------------ kit strip
  drawKit(ctx, world, game) {
    const p = world.player;
    const x = 6, y = VIEW_H - 36, w = 182 + (MAX_SLOTS - 3) * 25, h = 30;   // widens with the kit bag slots
    frame(ctx, x, y, w, h);
    // weapon slot
    const wx = x + 4, wy = y + 3;
    ctx.fillStyle = '#000'; ctx.fillRect(wx, wy, 24, 24);
    ctx.fillStyle = p.weapon ? '#3a2a10' : '#1a1222'; ctx.fillRect(wx + 1, wy + 1, 22, 22);
    if (p.weapon && p.weapon.def) {
      if (!drawItemIcon(ctx, p.weapon.def, wx + 1, wy + 1, 22, 22) && p.weapon.def.icon) p.weapon.def.icon(ctx, wx + 12, wy + 20, world.time);
      const max = (p.weapon.def.weapon && p.weapon.def.weapon.durability) || p.weapon.durability || 1;
      const n = Math.min(10, max), cur = Math.ceil(p.weapon.durability / max * n);
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < cur ? (cur <= 2 ? '#ff4a3a' : GOLD) : '#3a3a40'; ctx.fillRect(wx + 1 + i * Math.floor(22 / n), wy + 25, Math.max(1, Math.floor(22 / n) - 1), 2); }
    } else {
      // fist icon
      ctx.fillStyle = '#e2a97a'; ctx.fillRect(wx + 7, wy + 9, 10, 8); ctx.fillStyle = '#b07850';
      for (let i = 0; i < 4; i++) ctx.fillRect(wx + 7 + i * 2 + (i > 1 ? 1 : 0), wy + 9, 1, 3);
      ctx.fillRect(wx + 7, wy + 16, 10, 1); ctx.fillStyle = '#c8102e'; ctx.fillRect(wx + 8, wy + 17, 8, 3);
    }
    // consumable slots
    for (let i = 0; i < MAX_SLOTS; i++) {
      const sx = x + 32 + i * 25, sy = y + 3;
      ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, 23, 24);
      ctx.fillStyle = '#1a1222'; ctx.fillRect(sx + 1, sy + 1, 21, 22);
      const it = game.inventory[i];
      if (it && ITEMS[it.id]) {
        if (!drawItemIcon(ctx, ITEMS[it.id], sx + 1, sy + 1, 21, 22)) ITEMS[it.id].icon(ctx, sx + 11, sy + 21, 0);
        if (it.count > 1) drawText(ctx, String(it.count), sx + 22, sy + 16, { color: '#fff', align: 'right', outline: '#000' });
      }
      drawText(ctx, String(i + 1), sx + 2, sy + 2, { color: '#6a5a7a' });
    }
    // collectibles
    const cx = x + 35 + MAX_SLOTS * 25;
    const ns = world.record.scarves.size, tot = world.totalScarves || 5;
    scarfIcon(ctx, cx, y + 5, true);
    drawText(ctx, `${ns}/${tot}`, cx + 12, y + 5, { color: ns >= tot && tot ? GOLD : '#fff' });
    badgeIcon(ctx, cx + 40, y + 4, !!world.record.badge);
    keyIcon(ctx, cx, y + 18, 1, game.keys.size ? '#e8c040' : '#3a3a40');
    drawText(ctx, 'X' + game.keys.size, cx + 12, y + 18, { color: game.keys.size ? '#e8c040' : '#5a4a6a' });
    const secretsFound = (world.secrets || []).filter(s => s.found).length, secretsTot = (world.secrets || []).length;
    if (secretsTot) drawText(ctx, `?${secretsFound}/${secretsTot}`, cx + 38, y + 18, { color: secretsFound >= secretsTot ? '#7affe0' : '#8a7a9a' });
  }

  // ------------------------------------------------------------------ minimap
  drawMinimap(ctx, world) {
    const mm = this.getMinimap(world);
    if (!mm) return;
    const w = 116, h = 66, x = VIEW_W - w - 6, y = VIEW_H - h - 6;
    frame(ctx, x, y, w, h, { fill: 'rgba(8,8,10,0.82)' });
    mm.draw(ctx, x + 2, y + 2, w - 4, h - 4, { zoom: 2 });
    // compass hint: N-ish (world -y) arrow is up-right on screen
    drawText(ctx, 'MAP', x + 4, y + 3, { color: '#6a5a7a' });
  }

  // ------------------------------------------------------------------ toasts
  drawToasts(ctx, world) {
    let ty = VIEW_H - 86;
    for (let i = world.toasts.length - 1; i >= 0; i--) {
      const t = world.toasts[i];
      const a = t.t < 0.15 ? t.t / 0.15 : t.t > 2 ? (2.4 - t.t) / 0.4 : 1;
      const slide = t.t < 0.15 ? Math.round((1 - t.t / 0.15) * 30) : 0;
      ctx.globalAlpha = Math.max(0, a);
      const w = measureText(t.text) + 14;
      const x = VIEW_W - w - 6 + slide;
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, ty - 3, w + 2, 13);
      ctx.fillStyle = 'rgba(30,18,40,0.92)'; ctx.fillRect(x, ty - 2, w, 11);
      ctx.fillStyle = C.red; ctx.fillRect(x, ty - 2, 2, 11);
      drawText(ctx, t.text, x + 7, ty, { color: '#fff' });
      ctx.globalAlpha = 1;
      ty -= 14;
    }
  }

  // ------------------------------------------------------------------ banner
  drawBanner(ctx, world) {
    const bn = world.banner;
    if (!bn) return;
    const tIn = Math.min(1, bn.t * 5), tOut = Math.min(1, (bn.dur - bn.t) * 4);
    const a = Math.max(0, Math.min(tIn, tOut));
    const y = 96;
    const tw = measureText(bn.text, 3);
    const sc = tw > VIEW_W - 20 ? 2 : 3;
    const hh = 7 * sc + (bn.sub ? 22 : 12);
    const bandW = Math.round(VIEW_W * Math.min(1, bn.t * 6));
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = '#000'; ctx.fillRect(VIEW_W / 2 - bandW / 2, y - 8, bandW, hh);
    ctx.globalAlpha = a;
    const edge = bn.boss ? '#ff2a2a' : bn.color && bn.color !== '#ffffff' ? bn.color : C.red;
    ctx.fillStyle = edge; ctx.fillRect(VIEW_W / 2 - bandW / 2, y - 9, bandW, 2); ctx.fillRect(VIEW_W / 2 - bandW / 2, y - 9 + hh, bandW, 2);
    if (bn.boss) { for (let x = -20 + (world.time * 40) % 20; x < VIEW_W; x += 20) { ctx.fillStyle = 'rgba(255,42,42,0.25)'; ctx.fillRect(x, y - 6, 8, 2); ctx.fillRect(x + 10, y - 13 + hh, 8, 2); } }
    const off = Math.round((1 - tIn) * 80);
    drawText(ctx, bn.text, VIEW_W / 2 - off + sc, y - 2 + sc, { color: '#000', scale: sc, align: 'center' });
    drawText(ctx, bn.text, VIEW_W / 2 - off, y - 2, { color: bn.color || '#fff', scale: sc, align: 'center', outline: '#000' });
    if (bn.sub) drawText(ctx, bn.sub, VIEW_W / 2 + off, y + 7 * sc + 4, { color: '#d0c8e0', align: 'center', outline: '#000' });
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ hints
  drawHints(ctx, world) {
    if (save.data.settings.hints === false) return;
    if (this.introT > 9 || this.introT < 1) return;
    const a = Math.min(1, (this.introT - 1) * 2, (9 - this.introT) * 2);
    ctx.globalAlpha = Math.max(0, a);
    const txt = `${keyName('pause')} PAUSE   ${keyName('inventory')} KIT BAG   ${keyName('use')} PICK UP`;
    drawText(ctx, txt, VIEW_W / 2, VIEW_H - 50, { color: '#c0b8d0', align: 'center', outline: '#000' });
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ level clear flourish
  drawComplete(ctx, world) {
    if (!(world.completeT >= 0)) return;
    const t = world.completeT;
    const k = Math.min(1, t * 3);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, t * 0.4)})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const s = 5;
    const yy = 120 + Math.round((1 - k) * -120);
    drawText(ctx, 'SORTED!', VIEW_W / 2 + s, yy + s, { color: '#3a0008', scale: s, align: 'center' });
    drawText(ctx, 'SORTED!', VIEW_W / 2, yy, { color: Math.floor(t * 8) % 2 ? GOLD : '#ffffff', scale: s, align: 'center', outline: '#000' });
    if (t > 0.5) drawText(ctx, 'AREA CLEARED - ON TO THE NEXT ONE', VIEW_W / 2, yy + 48, { color: '#ffffff', align: 'center', outline: '#000' });
  }

  // ------------------------------------------------------------------ fanzine reader
  drawFanzine(ctx, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 360, x = (VIEW_W - w) / 2;
    const lines = wrapText(r.text || '', w - 32);
    const h = Math.min(VIEW_H - 30, 74 + lines.length * 11);
    const ease = Math.min(1, (r.t || 0) * 5);
    const y = Math.round((VIEW_H - h) / 2 + (1 - ease) * 40);
    // paper with photocopy grain
    ctx.fillStyle = '#000'; ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = '#ece6d4'; ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 120; i++) { const gx = (i * 73) % w, gy = (i * 37) % h; ctx.fillStyle = 'rgba(60,50,40,0.15)'; ctx.fillRect(x + gx, y + gy, 1, 1); }
    // masthead
    ctx.fillStyle = '#141416'; ctx.fillRect(x, y, w, 26);   // black masthead
    ctx.fillStyle = '#121214'; ctx.fillRect(x, y + 26, w, 2);
    drawText(ctx, 'ANCHORS ARMY!', x + 8, y + 4, { color: '#f2c811', scale: 2 });   // (-> BLACK ARMY!: content/rivals.js)
    drawText(ctx, 'ISSUE ' + (((r.title || '').length * 7) % 40 + 3) + '  -  20P', x + w - 8, y + 4, { color: '#f2c811', align: 'right' });
    drawText(ctx, 'THE UNOFFICIAL NORDHAMN FANZINE', x + w - 8, y + 15, { color: '#f2c811', align: 'right' });
    // staples
    ctx.fillStyle = '#9a98a0'; ctx.fillRect(x + 2, y + 40, 1, 8); ctx.fillRect(x + 2, y + h - 20, 1, 8);
    drawText(ctx, r.title || 'FANZINE', x + 16, y + 36, { color: '#141416' });
    ctx.fillStyle = '#141416'; ctx.fillRect(x + 16, y + 45, measureText(r.title || 'FANZINE'), 1);
    lines.forEach((l, i) => { if (52 + i * 11 < h - 18) drawText(ctx, l, x + 16, y + 52 + i * 11, { color: '#1a1416' }); });
    if (Math.floor((r.t || 0) * 2) % 2 === 0) drawText(ctx, 'PRESS ' + keyName('use') + ' TO CLOSE', x + w / 2, y + h - 13, { color: '#141416', align: 'center' });
  }
}
