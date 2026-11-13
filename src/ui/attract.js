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
import { ENEMIES, casualLook } from '../content/enemies.js';
import { CLUBS } from '../content/clubs.js';
import { rivalTag } from '../content/rivals.js';
import { LEVELS } from '../content/levels/index.js';
import { TOUR } from '../content/tour/index.js';
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
// One page per real firm on the Football Tour: three of their lads and their top boy, in the club's colours.
const ENEMY_PREFIX = { oldtrafford: 'ot_' };
// the Swedish firms (after the Football Tour's); their grounds (as in 1994) are in clubs.js
const SWEDISH = {
  aik: { lines: ['GNAGET HAR KOMMIT!', 'NORTH STAND. NOW.', 'BLACK AND YELLOW TILL I DIE'] },
  dif: { lines: ['JÄRNKAMINERNA!', 'THE OLD STADIUM IS OURS', 'COME ON THEN, SÖDER!'] },
  bajen: { lines: ['WELCOME TO SÖDER', 'THIS IS OUR ISLAND', 'GREEN AND WHITE ARMY!'] },
  blavitt: { lines: ['STOCKHOLM? NEVER HEARD OF IT', 'THE WISEMEN ARE HERE', 'BLÅVITT! BLÅVITT!'] },
  mff: { lines: ['DI BLÅE!', 'FERRY\'S GONE, MATE', 'SKÅNE IS SKY BLUE'] },
  hbg: { lines: ['DI RÖE!', 'ACROSS THE SOUND AND BACK', 'FRONTLINE. FRONT. LINE.'] },
  peking: { lines: ['WELCOME TO PEKING', 'WHITE AND BLUE!', 'NORRKÖPING DOESN\'T RUN'] },
};
function swedishPage(c, ci) {
  const S = SWEDISH[c.id], tag = rivalTag(c);
  const rng = makeRng(ci * 101 + 7);
  const kit = { a: c.a, b: c.b };
  const lad = (name, hp, quote, o = {}) => ({ id: c.id + name, name, look: casualLook(rng, { ...kit, ...o }), quote, hp, boss: false });
  const boss = { id: c.id + 'top', name: `${c.firm} TOP BOY`, hp: 560, boss: true, quote: c.chant,
    look: { ...casualLook(rng, { ...kit, scarf: kit, hatChance: 0, maskChance: 0, hoodChance: 0 }), build: 1.5, height: 1.24, facial: 'beard' } };
  return {
    t: { colors: [c.a, c.b], club: c.name, nick: c.nick, firm: c.firm, venue: c.venue, city: c.city },
    cards: [
      lad(`${tag} LAD`, 34, S.lines[0]),
      lad(`${tag} BOOT BOY`, 42, S.lines[1], { hair: ['skinhead', 'shaved'], build: 1.15 }),
      lad(`${tag} BRUISER`, 56, S.lines[2], { build: 1.35, maskChance: 0.6 }),
      boss,
    ],
  };
}
const PAGE_T = 5;   // seconds per page (the English tour, then the Swedish firms)
class GalleryScene {
  constructor(next) { this.next = next; this.t = 0; }
  enter() {
    this.t = 0;
    const card = (id, i) => {
      const d = ENEMIES[id];
      let look = {};
      try { look = typeof d.look === 'function' ? d.look(makeRng(i * 31 + 5)) : (d.look || {}); } catch (e) { look = {}; }
      const sh = d.ai && d.ai.shouts;
      const tq = (Array.isArray(sh) ? sh : sh && (sh.taunt || sh.aggro || sh.intro)) || (d.intro ? [d.intro] : null) || ['...'];
      return { id, name: d.name || id.toUpperCase(), look, quote: String(tq[i % tq.length] || '...'), hp: d.hp || 40, boss: !!d.boss };
    };
    this.pages = TOUR.map(t => {
      const pre = ENEMY_PREFIX[t.id] || t.id + '_';
      const ids = Object.keys(ENEMIES).filter(k => k.startsWith(pre));
      const lads = ids.filter(k => !ENEMIES[k].boss).sort((a, b) => (ENEMIES[a].hp || 0) - (ENEMIES[b].hp || 0)).slice(0, 3);
      const boss = ids.find(k => ENEMIES[k].boss);
      const cards = [...lads, ...(boss ? [boss] : [])].map(card);
      // the top boy's line: from the level's boss intro when his own def has none
      const bi = t.level && t.level.boss && t.level.boss.intro;
      const last = cards[cards.length - 1];
      if (last && last.boss && last.quote === '...' && bi) last.quote = Array.isArray(bi) ? bi[0] : String(bi);
      return { t, cards };
    }).filter(p => p.cards.length);
    CLUBS.forEach((c, ci) => { if (SWEDISH[c.id]) this.pages.push(swedishPage(c, ci)); });
  }
  update(dt) {
    this.t += dt; backdrop.update(dt);
    if (this.t > 0.4 && leaveKeys()) { app.go(app.scenes.title({ skipIntro: true })); return; }
    if (this.t > PAGE_T * this.pages.length) app.go(this.next());
  }
  draw(ctx) {
    backdrop.draw(ctx, { dim: 0.7 });
    heading(ctx, 'KNOW YOUR ENEMY', VIEW_W / 2, 16, { scale: 3 });
    if (!this.pages.length) { scanlines(ctx); return; }
    const pi = Math.min(this.pages.length - 1, Math.floor(this.t / PAGE_T));
    const { t: club, cards } = this.pages[pi];
    const pt = this.t - pi * PAGE_T;
    const [ca, cb] = club.colors;
    cards.forEach((e, i) => {
      const x = 24 + i * 152, y = 62;
      const k = Math.min(1, Math.max(0, (pt - i * 0.18) * 4));
      if (k <= 0) return;
      const yy = y + Math.round((1 - k) * 40);
      ctx.globalAlpha = k;
      frame(ctx, x, yy, 140, 200, { fill: 'rgba(12,8,22,0.9)', accent: e.boss ? '#ffd23a' : ca });
      ctx.fillStyle = ca; ctx.globalAlpha = k * 0.22; ctx.fillRect(x + 4, yy + 4, 132, 130); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.ellipse(x + 70, yy + 124, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
      const anim = Math.floor(pt + i) % 3 === 0 ? 'taunt' : 'guard';
      ladFigure(ctx, e.look, x + 70, yy + 124, 2.4, pt + i * 0.3, { key: 'rogue' + i, anim, flip: true, yaw: -0.45, face: anim === 'taunt' ? 'shout' : 'angry' });
      if (e.boss) { ctx.fillStyle = '#ffd23a'; ctx.fillRect(x + 6, yy + 6, 46, 11); drawText(ctx, 'TOP BOY', x + 29, yy + 8, { color: '#120c14', align: 'center' }); }
      drawText(ctx, e.name, x + 70, yy + 140, { color: e.boss ? '#ffd23a' : '#ffb0b0', align: 'center', outline: '#000' });
      const thr = Math.min(5, Math.max(1, Math.round(e.hp / (e.boss ? 130 : 22))));
      drawText(ctx, 'THREAT', x + 12, yy + 154, { color: C.dim });
      for (let s = 0; s < 5; s++) { ctx.fillStyle = s < thr ? '#ff3a3a' : '#3a2e44'; ctx.fillRect(x + 56 + s * 14, yy + 154, 10, 6); }
      const q = '"' + e.quote.toUpperCase() + '"';
      const lines = [];   // word-wrap at ~22 characters, up to three lines
      for (const w of q.split(' ')) { const L = lines[lines.length - 1]; if (L !== undefined && (L + ' ' + w).length <= 22) lines[lines.length - 1] = L + ' ' + w; else lines.push(w); }
      lines.splice(3);
      lines.forEach((l, j) => drawText(ctx, l, x + 70, yy + 166 + j * 10, { color: '#ffffff', align: 'center' }));
      ctx.globalAlpha = 1;
    });
    // the club and its firm
    const y = 280;
    ctx.fillStyle = ca; ctx.fillRect(40, y, 10, 10); ctx.fillStyle = cb; ctx.fillRect(45, y, 5, 10);
    drawText(ctx, `${club.club} (${club.nick})`, 58, y + 1, { color: '#ffffff', outline: '#000' });
    drawText(ctx, club.firm, 58, y + 14, { color: '#ffd23a', outline: '#000' });
    drawText(ctx, `${club.venue}, ${club.city}`, VIEW_W - 40, y + 1, { color: '#d0c8e0', align: 'right', outline: '#000' });
    drawText(ctx, `PAGE ${pi + 1}/${this.pages.length}`, VIEW_W - 40, y + 14, { color: C.dim, align: 'right', outline: '#000' });
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
