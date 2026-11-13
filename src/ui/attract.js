// Attract mode (runs when the title screen is left alone): rolling story text, "KNOW YOUR ENEMY" gallery,
// hall of fame, and a live demo of Level 1 played by a simple bot. Any key returns to the title.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText, measureText } from '../engine/font.js';
import { app } from '../app.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { makeRng } from '../engine/rng.js';
import { drawDoll } from '../game/doll.js';
import { sampleAnim } from '../game/poses.js';
import { ENEMIES } from '../content/enemies.js';
import { LEVELS } from '../content/levels/index.js';
import { World } from '../game/world.js';
import { game } from '../game/state.js';
import { backdrop } from './backdrop.js';
import { frame, heading, blink, scanlines, fmtScore, stripes, C, ladFigure } from './widgets.js';

export const STORY = [
  'WHAT ELSE ARE YOU GONNA DO ON A SATURDAY?',
  '',
  'SIT IN YOUR FUCKIN\' ARMCHAIR',
  'WANKIN\' OFF TO POP IDOLS?',
  '',
  'THEN TRY AND AVOID YOUR WIFE\'S GAZE',
  'AS YOU STRUGGLE TO COME TO TERMS',
  'WITH YOUR SEXLESS MARRIAGE?',
  '',
  'THEN GO AND SPUNK YOUR WAGES ON KEBABS,',
  'FRUIT MACHINES AND BRASSES?',
  '',
  'FUCK THAT FOR A LAUGH!',
  'I KNOW WHAT I\'D RATHER DO.',
  '',
  'TOTTENHAM AWAY, LOVE IT!',
  '',
  'THE LAST HOOLIGAN',
];
const HARD = new Set(['FUCK THAT FOR A LAUGH!', 'TOTTENHAM AWAY, LOVE IT!']);   // the punchlines, in red

const leaveKeys = () => input.anyPressed();

// ---------------------------------------------------------------- rolling story
class StoryScene {
  constructor(next) { this.next = next; this.t = 0; }
  enter() { this.t = 0; }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.t > 0.4 && leaveKeys()) { app.go(app.scenes.title({ skipIntro: true })); return; }
    const end = (STORY.length * 14 + VIEW_H + 40) / 18;
    if (this.t > end) app.go(this.next());
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.72 });
    const y0 = VIEW_H + 10 - this.t * 18;
    STORY.forEach((l, i) => {
      const y = y0 + i * 14;
      if (y < 30 || y > VIEW_H) return;
      const fade = Math.min(1, (y - 30) / 40, (VIEW_H - y) / 30);
      ctx.globalAlpha = Math.max(0, fade);
      const last = i === STORY.length - 1;
      drawText(ctx, l, VIEW_W / 2, y, { color: last ? C.gold : HARD.has(l) ? '#ff3a3a' : '#ffffff', align: 'center', outline: '#000', scale: last ? 2 : 1 });
    });
    ctx.globalAlpha = 1;
    if (blink(this.t)) drawText(ctx, 'PRESS START', VIEW_W / 2, VIEW_H - 14, { color: C.gold, align: 'center', outline: '#000' });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- know your enemy
const FIRMS = [
  { name: 'PORTSIDE CITY', a: '#1f4fb4', b: '#f2f2f2', line: 'THE BLUES ACROSS THE RIVER. LOUD, MANY, MOUTHY.' },
  { name: 'VARGBY WANDERERS', a: '#f0c020', b: '#141414', line: 'YELLOW AND BLACK. BIG BOOTS FROM UP THE COAST.' },
];
class GalleryScene {
  constructor(next) { this.next = next; this.t = 0; }
  enter() {
    this.t = 0;
    const ids = Object.keys(ENEMIES).filter(k => !ENEMIES[k].boss).slice(0, 8);
    this.list = ids.map((id, i) => {
      const d = ENEMIES[id];
      let look = {};
      try { look = typeof d.look === 'function' ? d.look(makeRng(i * 31 + 5)) : (d.look || {}); } catch (e) { look = {}; }
      const tq = (d.ai && d.ai.shouts && (d.ai.shouts.taunt || d.ai.shouts.aggro)) || ['...'];
      return { id, name: d.name || id.toUpperCase(), look, quote: tq[i % tq.length], hp: d.hp || 40 };
    });
    this.pages = Math.max(1, Math.ceil(this.list.length / 4));
  }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.t > 0.4 && leaveKeys()) { app.go(app.scenes.title({ skipIntro: true })); return; }
    if (this.t > 6 * this.pages) app.go(this.next());
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.7 });
    heading(ctx, 'KNOW YOUR ENEMY', VIEW_W / 2, 16, { scale: 3 });
    const page = Math.min(this.pages - 1, Math.floor(this.t / 6));
    const pt = this.t - page * 6;
    const items = this.list.slice(page * 4, page * 4 + 4);
    items.forEach((e, i) => {
      const x = 24 + i * 152, y = 62;
      const k = Math.min(1, Math.max(0, (pt - i * 0.18) * 4));
      if (k <= 0) return;
      const yy = y + Math.round((1 - k) * 40);
      ctx.globalAlpha = k;
      frame(ctx, x, yy, 140, 200, { fill: 'rgba(12,8,22,0.9)', accent: '#1f4fb4' });
      ctx.fillStyle = 'rgba(31,79,180,0.18)'; ctx.fillRect(x + 4, yy + 4, 132, 130);
      // spotlight
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.ellipse(x + 70, yy + 124, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
      const anim = Math.floor(pt + i) % 3 === 0 ? 'taunt' : 'guard';
      ladFigure(ctx, e.look, x + 70, yy + 124, 2.4, pt + i * 0.3, { key: 'rogue' + i, anim, flip: true, yaw: -0.45, face: anim === 'taunt' ? 'shout' : 'angry' });
      drawText(ctx, e.name, x + 70, yy + 140, { color: '#ffb0b0', align: 'center', outline: '#000' });
      // threat meter
      const thr = Math.min(5, Math.max(1, Math.round(e.hp / 15)));
      drawText(ctx, 'THREAT', x + 12, yy + 154, { color: C.dim });
      for (let s = 0; s < 5; s++) { ctx.fillStyle = s < thr ? '#ff3a3a' : '#3a2e44'; ctx.fillRect(x + 56 + s * 14, yy + 154, 10, 6); }
      // quote bubble
      const q = '"' + e.quote + '"';
      const lines = q.length > 20 ? [q.slice(0, q.lastIndexOf(' ', 20)), q.slice(q.lastIndexOf(' ', 20) + 1)] : [q];
      lines.forEach((l, j) => drawText(ctx, l, x + 70, yy + 170 + j * 10, { color: '#ffffff', align: 'center' }));
      ctx.globalAlpha = 1;
    });
    // firms strip
    FIRMS.forEach((f, i) => {
      const y = 280 + i * 16;
      ctx.fillStyle = f.a; ctx.fillRect(40, y, 8, 8); ctx.fillStyle = f.b; ctx.fillRect(44, y, 4, 8);
      drawText(ctx, f.name, 54, y + 1, { color: f.a === '#f0c020' ? f.a : '#7aa0ff', outline: '#000' });
      drawText(ctx, f.line, 176, y + 1, { color: '#d0c8e0', outline: '#000' });
    });
    if (blink(this.t)) drawText(ctx, 'PRESS START', VIEW_W / 2, VIEW_H - 14, { color: C.gold, align: 'center', outline: '#000' });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- hall of fame
export function drawHallOfFame(ctx, t, highlight = -1, y0 = 64) {
  const tbl = save.data.hiscores || [];
  const cols = ['#ffd23a', '#f4f1e8', '#ff8a5a', '#c0b8d0'];
  drawText(ctx, 'RANK', 130, y0 - 16, { color: C.dim });
  drawText(ctx, 'NAME', 210, y0 - 16, { color: C.dim });
  drawText(ctx, 'SCORE', 400, y0 - 16, { color: C.dim, align: 'right' });
  drawText(ctx, 'LEVEL', 500, y0 - 16, { color: C.dim, align: 'right' });
  tbl.forEach((e, i) => {
    const y = y0 + i * 20;
    const k = Math.min(1, Math.max(0, (t - i * 0.08) * 5));
    if (k <= 0) return;
    const off = Math.round((1 - k) * (i % 2 ? 300 : -300));
    const hl = i === highlight;
    const col = hl ? (blink(t, 6) ? '#ffffff' : C.gold) : i < 3 ? cols[i] : cols[3];
    if (hl) { ctx.fillStyle = 'rgba(200,16,46,0.5)'; ctx.fillRect(120 + off, y - 4, 400, 15); }
    const rank = ['1ST', '2ND', '3RD'][i] || (i + 1) + 'TH';
    drawText(ctx, rank, 130 + off, y, { color: col, scale: 1, outline: '#000' });
    drawText(ctx, e.name, 210 + off, y - 3, { color: col, scale: 2, outline: '#000' });
    drawText(ctx, fmtScore(e.score), 400 + off, y - 3, { color: col, scale: 2, outline: '#000', align: 'right' });
    drawText(ctx, e.level >= 8 ? 'ALL' : String(e.level || 1), 500 + off, y, { color: col, outline: '#000', align: 'right' });
  });
}
class HallScene {
  constructor(next) { this.next = next; this.t = 0; }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.t > 0.4 && leaveKeys()) { app.go(app.scenes.title({ skipIntro: true })); return; }
    if (this.t > 7) app.go(this.next());
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.65 });
    heading(ctx, 'HALL OF FAME', VIEW_W / 2, 12, { scale: 3 });
    drawHallOfFame(ctx, this.t, -1, 72);
    if (blink(this.t)) drawText(ctx, 'PRESS START', VIEW_W / 2, VIEW_H - 14, { color: C.gold, align: 'center', outline: '#000' });
    scanlines(ctx);
  }
}

// ---------------------------------------------------------------- demo (bot plays Level 1)
class DemoBot {
  constructor() { this.t = 0; this.atkT = 0; this.seq = 0; this.stuckT = 0; this.last = null; this.detour = null; this.detourT = 0; }
  update(f, world, dt) {
    this.t += dt;
    const I = f.intent;
    I.attack = null; I.attackName = null; I.jump = false; I.dodge = false; I.grab = false; I.use = false; I.taunt = false; I.block = false; I.run = false;
    I.mx = 0; I.my = 0;
    f.invuln = Math.max(f.invuln || 0, 0.5); f.hp = Math.max(f.hp, f.maxHp * 0.6);
    // nearest enemy
    let best = null, bd = 1e9;
    for (const o of world.fighters) {
      if (o === f || o.team === f.team || !o.alive || o.removed) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < bd) { bd = d; best = o; }
    }
    let tx, ty;
    if (best && bd < 14) { tx = best.x; ty = best.y; }
    else {
      const next = world.encounters && world.encounters.find(e => e.state === 'waiting');
      const g = world.goArrow || (next && (next.area || next.trigger) && { x: (next.area || next.trigger).x + (next.area || next.trigger).w / 2, y: (next.area || next.trigger).y + (next.area || next.trigger).h / 2 }) || (world.exit && { x: world.exit.x + world.exit.w / 2, y: world.exit.y + world.exit.h / 2 });
      if (g) { tx = g.x; ty = g.y; }
    }
    if (tx === undefined) return;
    let dx = tx - f.x, dy = ty - f.y;
    const d = Math.hypot(dx, dy) || 1;
    if (best && bd < 1.1 && !best.isDown) {
      // fight: chain a combo
      this.atkT -= dt;
      if (this.atkT <= 0) {
        const combo = ['punchL', 'punchL', 'punchL', 'punchL', 'kick', 'kick', 'punchR', 'punchR', 'punchR'];
        I.attack = combo[this.seq % combo.length];
        this.seq++;
        this.atkT = 0.16;
        if (f.canAct && world.autoAim) world.autoAim(f, dx / d, dy / d);
        if (this.seq % 9 === 0) this.atkT = 0.5;
      }
      return;
    }
    if (best && best.isDown && bd < 1.2) { if ((this.t % 0.6) < dt) I.attack = 'kick'; return; }
    // move (with simple unstick detour)
    if (this.detourT > 0) { this.detourT -= dt; dx = this.detour.x; dy = this.detour.y; }
    else { dx /= d; dy /= d; }
    I.mx = dx; I.my = dy;
    I.run = d > 5;
    if (this.last) {
      const moved = Math.hypot(f.x - this.last.x, f.y - this.last.y);
      if (moved < dt * 0.5) this.stuckT += dt; else this.stuckT = 0;
      if (this.stuckT > 0.4) { const s = Math.random() < 0.5 ? 1 : -1; this.detour = { x: -dy / d * s, y: dx / d * s }; this.detourT = 0.7; this.stuckT = 0; if (Math.random() < 0.3) I.jump = true; }
    }
    this.last = { x: f.x, y: f.y };
  }
}

class DemoScene {
  constructor(next) { this.next = next; this.t = 0; this.ok = true; }
  enter() {
    this.t = 0;
    try {
      this.saved = { lives: game.lives, score: game.score, cash: game.cash, inventory: game.inventory, keys: game.keys, collected: game.collected };
      game.lives = 9; game.score = 0; game.cash = 0; game.inventory = []; game.keys = new Set(); game.collected = {};
      audio.setVolumes({ sfx: 0 });
      this.world = new World(LEVELS[0], game, { onComplete: () => this.leave(), onGameOver: () => this.leave(), noFirm: true });
      this.world.player.controller = new DemoBot();
      this.world.player.controller.enabled = true;
    } catch (e) { console.warn('[attract] demo unavailable', e); this.ok = false; }
  }
  exit() {
    const s = save.data.settings;
    audio.setVolumes({ music: s.music ?? 0.6, sfx: s.sfx ?? 0.8 });
    audio.setBoss(false); audio.crowd(0);
    if (this.saved) Object.assign(game, this.saved);
  }
  leave(toTitle = false) { if (this.left) return; this.left = true; app.go(toTitle ? app.scenes.title({ skipIntro: true }) : this.next()); }
  update(dt) {
    this.t += dt;
    if (!this.ok) { this.leave(); return; }
    if (this.t > 0.4 && leaveKeys()) { this.leave(true); return; }
    try { this.world.update(dt); } catch (e) { console.warn('[attract] demo stopped', e); this.ok = false; return; }
    if (this.t > 38) this.leave();
  }
  draw(ctx) {
    if (!this.ok || !this.world) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); return; }
    this.world.draw(ctx);
    // arcade demo chrome
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VIEW_W, 22); ctx.fillRect(0, VIEW_H - 24, VIEW_W, 24);
    drawText(ctx, 'DEMO PLAY', 10, 8, { color: blink(this.t, 1.5) ? '#ff4a5a' : '#ffffff', outline: '#000' });
    drawText(ctx, 'HI ' + fmtScore(save.topScore()), VIEW_W - 10, 8, { color: '#ff8aa0', align: 'right', outline: '#000' });
    drawText(ctx, fmtScore(game.score), VIEW_W / 2, 6, { color: C.gold, align: 'center', scale: 2, outline: '#000' });
    if (blink(this.t)) drawText(ctx, 'PRESS START TO PLAY', VIEW_W / 2, VIEW_H - 16, { color: C.gold, align: 'center', outline: '#000', scale: 1 });
    drawText(ctx, 'THE LAST HOOLIGAN', VIEW_W - 10, VIEW_H - 16, { color: '#ff4a5a', align: 'right', outline: '#000' });
    scanlines(ctx);
  }
}

// attract cycle: story -> demo -> gallery -> hall of fame -> title
export function attractCycle(start = 0) {
  const order = [
    () => new StoryScene(() => attractCycle(1)),
    () => new DemoScene(() => attractCycle(2)),
    () => new GalleryScene(() => attractCycle(3)),
    () => new HallScene(() => app.scenes.title({ skipIntro: true, fromAttract: true })),
  ];
  return order[start % order.length]();
}

export { StoryScene, GalleryScene, HallScene, DemoScene };
