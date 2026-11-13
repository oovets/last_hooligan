// THE ANCHOR — the firm's local between trips (phase D, docs/DESIGN-V2.md).
//
// A walkable World (content/hub.js, both 2D and 3D renderers) with your lads standing around and stations:
//   THE MAP       pick the next trip + who travels -> level intro
//   THE BAR       recruit (Ron knows who wants in)            THE BACK ROOM  train a stat
//   THE COAT RACK the wardrobe                                THE DOOR       call it a night (a day passes)
//   talk to a lad (USE next to him) -> his card: put him on/off the coach, physio, let him go
// After a trip the report (consequences) and any pending event card are shown first.
// All rules live in game/firmdata.js.

import { clubById, drawClubCrest } from '../content/clubs.js';
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { toScreen } from '../engine/iso.js';
import { drawText, wrapText } from '../engine/font.js';
import { app } from '../app.js';
import { save, UNLOCK_ALL } from '../save.js';
import { audio } from '../audio/audio.js';
import { World } from '../game/world.js';
import { Fighter } from '../game/fighter.js';
import { game } from '../game/state.js';
import { LEVELS } from '../content/levels/index.js';
import { TOUR, HOME, levelIndex } from '../content/tour/index.js';
import { ENEMIES } from '../content/enemies.js';
import { characterById } from '../content/characters.js';
import { drawPortrait } from '../game/doll.js';
import { r3d } from '../render3d/index.js';
import HUB, { HUB_STATIONS, HUB_SPOTS } from '../content/hub.js';
import {
  getFirm, fixSquad, squadLads, squadSize, ladById, available, toggleSquad, hire, sack, train, physio, nextDay, drawEvent,
  eventCard, trainCost, STATS, STAT_NAME, TRAITS, MAX_ROSTER, recruitTier,
} from '../game/firmdata.js';
import { frame, MenuList, hintBar, fmtCash, C, hideLoader, Repeater } from './widgets.js';

export const firmMode = () => (save.data.settings || {}).firm !== false;

const SQ = '#5ab0ff';
export function ladLook(l) {
  if (l.look) return l.look;
  const ch = l.char && characterById(l.char);
  return (ch && ch.look) || game.look();
}

// ------------------------------------------------------------------ the scene
export class HubScene {
  get pixel() { return true; }   // walkable world: pixel-art resolution (main.js)
  constructor() { this.t = 0; this.panel = null; this.msg = null; }

  enter() {
    hideLoader();
    this.F = getFirm(game.character);
    fixSquad(this.F);
    save.write();
    this.world = new World(HUB, game, { noFirm: true, onComplete() {}, onGameOver() {} });
    this.world.hub = true;
    this.spawnNPCs();
    audio.music('pub');
    audio.crowd(0);
    // the main goal is always pointed at: the map on the wall (plan the next trip)
    this.mapSpot = { x: 6, y: 1.6 };
    this.world.goArrow = this.mapSpot;
    if (this.F.report) this.panel = new ReportPanel(this);
    else if (this.F.event) this.panel = new EventPanel(this);
    if (!(save.data.seenNew || []).includes('hubHelp')) {
      (save.data.seenNew ||= []).push('hubHelp'); save.write();
      const help = new HelpPanel(this);
      if (this.panel) { const after = this.panel; help.after = () => after; }
      this.panel = help;
    }
  }

  exit() { if (r3d.renderer) r3d.renderer.end(); }

  spawnNPCs() {
    const w = this.world;
    this.npcs = [];
    this.F.lads.slice(0, HUB_SPOTS.length).forEach((l, i) => {
      const [x, y] = HUB_SPOTS[i];
      const f = new Fighter({ type: 'npc_lad', name: l.name, team: 'player', look: ladLook(l), x, y, hp: 100 });
      f.controller = new NPCController(l);
      f.npcLad = l;
      f.face2(w.player.x - x, w.player.y - y);
      w.fighters.push(f);
      this.npcs.push(f);
    });
    // Ron behind the bar
    const ron = ENEMIES.pub_ron;
    if (ron) {
      const f = new Fighter({ type: 'npc_ron', name: "RON", team: 'player', look: typeof ron.look === 'function' ? ron.look({ pick: a => a[0], chance: () => false, range: (a) => a }) : ron.look, x: 18.5, y: 1.6, hp: 100 });
      f.controller = new NPCController(null, ["WHAT'LL IT BE?", 'NO TAB TILL YOU PAY THE LAST ONE.', 'WIPE YOUR FEET.', 'THERE\'S LADS AT THE BAR WANT A WORD.']);
      f.face2(0, 1);
      w.fighters.push(f);
    }
  }

  rebuild() {
    // roster changed (hired/sacked/left): respawn the lads standing around
    const w = this.world;
    w.fighters = w.fighters.filter(f => !f.npcLad);
    this.spawnNPCs();
  }

  toast(text) { this.msg = { text, t: 0 }; }

  open(action) {
    const w = this.world;
    if (action === 'map') this.panel = new MapPanel(this);
    else if (action === 'bar') this.panel = new BarPanel(this);
    else if (action === 'train') this.panel = new TrainPanel(this);
    else if (action === 'lads') this.panel = new RosterPanel(this);
    else if (action === 'door') this.panel = new ConfirmPanel(this, 'CALL IT A NIGHT?', ['INJURIES HEAL A DAY, HEAT COOLS,', 'NEW FACES TURN UP AT THE BAR.'], () => this.endDay());
    else if (action === 'wardrobe') app.go(app.scenes.wardrobe(() => app.scenes.hub()));
    if (this.panel) audio.sfx('menuSelect');
    w.player.intent.mx = w.player.intent.my = 0;
  }

  endDay() {
    const lines = nextDay(this.F, []);
    if (!this.F.event && Math.random() < 0.35) this.F.event = drawEvent(this.F);
    this.F.report = { title: `DAY ${this.F.day}. A NEW DAY AT THE ANCHOR`, lines: lines.length ? lines : ['NOTHING MUCH HAPPENED. RON SWEPT UP.'] };
    save.write();
    this.rebuild();
    this.panel = new ReportPanel(this);
  }

  update(dt) {
    this.t += dt;
    if (this.msg) { this.msg.t += dt; if (this.msg.t > 2.6) this.msg = null; }
    const w = this.world, p = w.player;
    if (this.panel) {
      p.controller.enabled = false;
      this.panel.update(dt);
      w.update(dt);
      return;
    }
    p.controller.enabled = true;
    if (input.pressed('pause')) { this.panel = new PubMenu(this); return; }
    if (input.pressed('hubMap')) { this.open('map'); return; }
    // the GO arrow points at the map until you're standing at it
    const ms = this.mapSpot;
    w.goArrow = Math.hypot(ms.x - p.x, ms.y - p.y) > 1.8 ? ms : null;
    // talk to a lad
    if (input.pressed('use')) {
      const lad = this.nearLad();
      if (lad) { input.consume('use'); this.panel = new RosterPanel(this, lad.npcLad); audio.sfx('menuSelect'); }
    }
    w.update(dt);
    if (w.hubAction) { const a = w.hubAction; w.hubAction = null; this.open(a); }
  }

  nearLad() {
    const p = this.world.player;
    let best = null, bd = 1.5;
    for (const f of this.npcs) { const d = Math.hypot(f.x - p.x, f.y - p.y); if (d < bd) { bd = d; best = f; } }
    return best;
  }

  nearStation() {
    const p = this.world.player;
    let best = null, bd = 1.35;
    for (const pr of this.world.props) if (pr.type === 'hub_station') { const d = Math.hypot(pr.cx - p.x, pr.cy - p.y); if (d < bd) { bd = d; best = pr; } }
    return best;
  }

  draw(ctx) {
    const w = this.world;
    if (r3d.renderer) { r3d.renderer.render(w); ctx.clearRect(0, 0, VIEW_W, VIEW_H); w.drawOverlay3D(ctx); } else w.draw(ctx);
    this.drawLabels(ctx);
    this.drawTop(ctx);
    if (this.panel) this.panel.draw(ctx);
    else {
      this.drawGoal(ctx);
      hintBar(ctx, [['use', 'USE / TALK'], ['M', 'THE MAP: NEXT TRIP'], ['pause', 'MENU']], VIEW_H - 14);
    }
    if (this.msg) {
      const a = Math.min(1, (2.6 - this.msg.t) * 3);
      ctx.globalAlpha = a;
      frame(ctx, VIEW_W / 2 - 160, VIEW_H - 64, 320, 20, { fill: 'rgba(10,10,12,0.95)', accent: C.gold, rivets: false });
      drawText(ctx, this.msg.text, VIEW_W / 2, VIEW_H - 58, { color: '#ffffff', align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  // floating labels: lads' names, the station you're next to
  drawLabels(ctx) {
    const w = this.world, cam = w.camera;
    ctx.save(); ctx.translate(cam.tx, cam.ty);
    const near = this.panel ? null : this.nearLad();
    for (const f of this.npcs) {
      const s = toScreen(f.x, f.y, f.z);
      const l = f.npcLad;
      const tag = l.injury > 0 ? ' (INJURED)' : l.banned > 0 ? ' (BANNED)' : this.F.squad.includes(l.id) ? ' *' : '';
      drawText(ctx, l.name + tag, s.x, s.y - 66, { color: f === near ? C.gold : (l.injury > 0 || l.banned > 0) ? '#ff8a7a' : this.F.squad.includes(l.id) ? SQ : '#c8c0d0', align: 'center', outline: '#000' });
      if (f === near) drawText(ctx, 'E: TALK', s.x, s.y - 56, { color: '#ffffff', align: 'center', outline: '#000' });
    }
    // a sign over every station (bright + 'E:' when you're at it)
    const st = this.panel || near ? null : this.nearStation();
    const seen = new Set();
    for (const pr of w.props) {
      if (pr.type !== 'hub_station' || seen.has(pr.o.action)) continue;
      seen.add(pr.o.action);
      const all = w.props.filter(q => q.type === 'hub_station' && q.o.action === pr.o.action);
      const cx = all.reduce((a, q) => a + q.cx, 0) / all.length, cy = all.reduce((a, q) => a + q.cy, 0) / all.length;
      const S = HUB_STATIONS[pr.o.action] || { label: pr.o.action, sub: '' };
      const at = st && st.o.action === pr.o.action;
      const s = toScreen(cx, cy, 2.4);
      if (at) {
        drawText(ctx, 'E: ' + S.label, s.x, s.y - 8, { color: C.gold, align: 'center', outline: '#000' });
        drawText(ctx, S.sub, s.x, s.y + 2, { color: '#ffffff', align: 'center', outline: '#000' });
      } else drawText(ctx, S.label, s.x, s.y, { color: pr.o.action === 'map' ? '#ffe14a' : '#b8b0c8', align: 'center', outline: '#000' });
    }
    ctx.restore();
  }

  drawTop(ctx) {
    const F = this.F;
    frame(ctx, 6, 6, 250, 40, { accent: C.red, fill: 'rgba(10,10,12,0.9)' });
    const club = clubById(F.club);
    ctx.fillStyle = club.a; ctx.fillRect(6, 6, 250, 2); ctx.fillStyle = club.b; ctx.fillRect(6, 8, 250, 1);   // club colours
    drawClubCrest(ctx, club, 258, 8, 26, 34);
    drawText(ctx, `${club.firm}  -  DAY ${F.day}`, 14, 11, { color: C.gold });
    drawText(ctx, fmtCash(save.data.cash || 0), 14, 23, { color: C.cash || '#7aff9a' });
    drawText(ctx, `REP ${F.rep}`, 70, 23, { color: '#ffffff' });
    const hc = F.heat >= 85 ? '#ff3a3a' : F.heat >= 60 ? '#ff8a3a' : F.heat >= 30 ? '#ffe14a' : '#7aff9a';
    drawText(ctx, `HEAT ${F.heat}`, 124, 23, { color: hc });
    drawText(ctx, `LADS ${F.lads.length}/${MAX_ROSTER}`, 186, 23, { color: '#c0b8d0' });
    const sq = squadLads(F).map(l => l.name.split(' ').pop()).join(', ') || 'NOBODY FIT TO TRAVEL';
    const out = F.lads.filter(l => !available(l)).map(l => `${l.name.split(' ').pop()} ${l.injury > 0 ? 'INJURED ' + l.injury + 'D' : 'BANNED ' + l.banned + 'D'}`);
    drawText(ctx, `COACH (${squadLads(F).length}/${squadSize(F)}): ${sq}`.slice(0, 44), 14, 34, { color: SQ });
    if (out.length) drawText(ctx, ('OUT: ' + out.join(', ')).slice(0, 46), 14, 46, { color: '#ff8a7a', outline: '#000' });
  }

  // what to do next, always on screen
  drawGoal(ctx) {
    const pulse = 0.75 + Math.sin(this.t * 3) * 0.25;
    const w = 300, x = VIEW_W - w - 8, y = 8;
    frame(ctx, x, y, w, 30, { fill: 'rgba(10,10,12,0.9)', accent: C.gold, rivets: false });
    ctx.globalAlpha = pulse;
    drawText(ctx, 'NEXT: PICK YOUR TRIP AT THE MAP (M)', x + w / 2, y + 6, { color: C.gold, align: 'center' });
    ctx.globalAlpha = 1;
    drawText(ctx, 'OR FIRST: RECRUIT AT THE BAR, TRAIN OUT BACK', x + w / 2, y + 17, { color: '#a098b0', align: 'center' });
  }
}

// lads standing about in the pub
class NPCController {
  constructor(lad, lines) { this.lad = lad; this.lines = lines; this.sayT = 1 + Math.random() * 4; }
  update(f, world, dt) {
    const I = f.intent;
    I.mx = I.my = 0; I.attack = null; I.attackName = null; I.jump = false; I.block = false; I.dodge = false; I.grab = false; I.use = false; I.taunt = false; I.run = false;
    const p = world.player, d = Math.hypot(p.x - f.x, p.y - f.y);
    if (d < 3.2 && f.canAct) f.face2(p.x - f.x, p.y - f.y);
    this.sayT -= dt;
    if (d < 2.4 && this.sayT <= 0) { f.say(pickLine(this.lad, this.lines), 1.8); this.sayT = 7 + Math.random() * 6; }
  }
}
function pickLine(l, lines) {
  const P = a => a[Math.floor(Math.random() * a.length)];
  if (lines) return P(lines);
  if (l.injury > 0) return P(['ME RIBS...', `DOC SAYS ${l.injury} DAY${l.injury > 1 ? 'S' : ''}.`, 'NEXT TIME, BOSS.']);
  if (l.banned > 0) return P(['BLOODY BANNING ORDER.', 'I HAVE TO SIGN IN AT THE STATION.']);
  if (l.mood < 35) return P(['NEVER PICK ME, DO YA?', 'MIGHT TRY THE PORTSIDE LOT...', 'WHAT AM I, FURNITURE?']);
  if (l.mood > 75) return P(["WHEN'S THE NEXT ONE?", 'PINT, BOSS?', "I'M BUZZING FOR SATURDAY.", 'WE WERE DIFFERENT CLASS.']);
  return P(['ALRIGHT?', 'SAME AGAIN?', 'WHO WE PLAYING?', 'RON\'S PIES ARE OFF AGAIN.']);
}

// ------------------------------------------------------------------ panels
const PX = 20, PY = 50, PW = VIEW_W - 40, PH = VIEW_H - 76;

function panelFrame(ctx, title, accent = C.red) {
  ctx.fillStyle = 'rgba(6,6,8,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  frame(ctx, PX, PY, PW, PH, { title, fill: 'rgba(12,12,14,0.96)', accent });
}

function stat(ctx, x, y, name, v, col = C.gold) {
  drawText(ctx, name, x, y, { color: '#a098b0' });
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i < v ? col : '#2a2236'; ctx.fillRect(x + 44 + i * 6, y + 1, 5, 5); }
  drawText(ctx, String(v), x + 108, y, { color: '#ffffff' });
}

// the lad's card (right side of the roster / bar / training screens)
export function drawLadCard(ctx, l, F, x, y, w, opts = {}) {
  if (!l) return;
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, 34, 34);
  ctx.fillStyle = '#1a1226'; ctx.fillRect(x + 1, y + 1, 32, 32);
  try { drawPortrait(ctx, ladLook(l), x + 1, y + 1, 32, { face: l.injury > 0 ? 'hurt' : l.mood < 35 ? 'angry' : 'normal' }); } catch (e) { /* no portrait */ }
  drawText(ctx, l.name, x + 40, y + 1, { color: '#ffffff', scale: 1 });
  drawText(ctx, `'${l.nick}'`, x + 40, y + 11, { color: C.gold });
  if (opts.cost !== undefined) drawText(ctx, `WANTS £${opts.cost} IN ROUNDS`, x + 40, y + 21, { color: (save.data.cash || 0) >= opts.cost ? '#7aff9a' : '#ff7a7a' });
  else drawText(ctx, `LVL ${l.lvl}  TRIPS ${l.trips}  KOS ${l.kos}`, x + 40, y + 21, { color: '#c0b8d0' });
  let yy = y + 42;
  for (const s of STATS) { stat(ctx, x, yy, STAT_NAME[s], l.stats[s], s === opts.hl ? '#7affe0' : C.gold); yy += 10; }
  yy += 3;
  for (const t of l.traits) {
    const T = TRAITS[t];
    if (!T) continue;
    drawText(ctx, T.name, x, yy, { color: '#ff9ad0' });
    const d = wrapText(T.desc, w - 70)[0] || '';
    drawText(ctx, d, x + 66, yy, { color: '#8a809a' });
    yy += 10;
  }
  if (opts.cost === undefined) {
    yy += 2;
    const status = l.injury > 0 ? `INJURED: ${l.injury} DAY${l.injury > 1 ? 'S' : ''}` : l.banned > 0 ? `BANNED: ${l.banned} DAY${l.banned > 1 ? 'S' : ''}` : F && F.squad.includes(l.id) ? 'ON THE COACH' : 'AT THE PUB';
    drawText(ctx, status, x, yy, { color: l.injury > 0 || l.banned > 0 ? '#ff7a7a' : F && F.squad.includes(l.id) ? SQ : '#c0b8d0' });
    drawText(ctx, 'MOOD', x + 110, yy, { color: '#a098b0' });
    ctx.fillStyle = '#2a2236'; ctx.fillRect(x + 140, yy + 1, 60, 5);
    ctx.fillStyle = l.mood > 60 ? '#7aff9a' : l.mood > 35 ? '#ffe14a' : '#ff6a5a'; ctx.fillRect(x + 140, yy + 1, Math.round(60 * l.mood / 100), 5);
    const mates = F ? Object.entries(l.bonds || {}).filter(([, v]) => v >= 5).map(([id]) => ladById(F, id)).filter(Boolean).map(m => m.name.split(' ').pop()) : [];
    if (mates.length) { yy += 11; drawText(ctx, ('MATES: ' + mates.join(', ')).slice(0, 40), x, yy, { color: '#7affe0' }); }
  }
}

class BasePanel {
  constructor(hub) { this.hub = hub; this.F = hub.F; this.t = 0; this.note = null; }
  close() { this.hub.panel = null; save.write(); }
  say(text, ok = true) { this.note = { text, ok, t: 0 }; audio.sfx(ok ? 'coin' : 'locked'); }
  update(dt) { this.t += dt; if (this.note) { this.note.t += dt; if (this.note.t > 2.4) this.note = null; } }
  drawNote(ctx) {
    if (!this.note) return;
    drawText(ctx, this.note.text, VIEW_W / 2, PY + PH - 14, { color: this.note.ok ? '#7aff9a' : '#ff7a7a', align: 'center', outline: '#000' });
  }
}

// ---- report after a trip / a day
class ReportPanel extends BasePanel {
  update(dt) {
    super.update(dt);
    if (this.t > 0.4 && (input.pressed('confirm') || input.pressed('use') || input.pressed('back'))) {
      this.F.report = null; save.write();
      audio.sfx('menuSelect');
      this.hub.panel = this.F.event ? new EventPanel(this.hub) : null;
    }
  }
  draw(ctx) {
    const R = this.F.report || { title: '', lines: [] };
    panelFrame(ctx, R.title.slice(0, 48), C.gold);
    const lines = R.lines.flatMap(l => wrapText(l, PW - 40));
    lines.slice(0, 18).forEach((l, i) => {
      const k = Math.min(1, Math.max(0, this.t * 8 - i));
      ctx.globalAlpha = k;
      const bad = /INJURED|RAID|BAN|TRAITOR|-\d+ REP|REPUTATION -/.test(l);
      const good = /SHARPER|MATES|FIT AGAIN|REPUTATION \+/.test(l);
      drawText(ctx, l, PX + 20, PY + 18 + i * 12, { color: bad ? '#ff8a7a' : good ? '#7aff9a' : '#e0d8e8' });
    });
    ctx.globalAlpha = 1;
    hintBar(ctx, [['confirm', 'CARRY ON']], VIEW_H - 14);
  }
}

// ---- event card
class EventPanel extends BasePanel {
  constructor(hub) {
    super(hub);
    this.card = eventCard(this.F);
    if (!this.card) { this.F.event = null; }
    this.result = null;
    this.menu = this.card ? new MenuList(this.card.options.map((label, i) => ({ label, fn: () => { this.result = this.card.resolve(i); save.write(); this.hub.rebuild(); } }))) : null;
  }
  update(dt) {
    super.update(dt);
    if (!this.card) { this.close(); return; }
    if (this.result) { if (input.pressed('confirm') || input.pressed('back') || input.pressed('use')) { audio.sfx('menuSelect'); this.close(); } return; }
    this.menu.update(dt);
  }
  draw(ctx) {
    if (!this.card) return;
    ctx.fillStyle = 'rgba(6,6,8,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 360, h = 170, x = (VIEW_W - w) / 2, y = 80;
    frame(ctx, x, y, w, h, { title: this.card.title, fill: 'rgba(30,22,10,0.97)', accent: C.gold });
    wrapText(this.card.text, w - 30).forEach((l, i) => drawText(ctx, l, x + 15, y + 16 + i * 11, { color: '#f4ecd8' }));
    if (this.result) {
      wrapText(this.result, w - 30).forEach((l, i) => drawText(ctx, l, x + 15, y + 96 + i * 11, { color: '#7aff9a' }));
      hintBar(ctx, [['confirm', 'FAIR ENOUGH']], VIEW_H - 14);
    } else {
      this.menu.draw(ctx, x + 50, y + 96, { w: w - 100, rowH: 18 });
      hintBar(ctx, [['menuUp', 'CHOOSE'], ['confirm', 'DECIDE']], VIEW_H - 14);
    }
  }
}

// ---- the map: THE FOOTBALL TOUR (phase F). A 90s match-programme page: the fixture list (home trips in your club's town, then the
// away days at real grounds, unlocked by reputation), a map of Britain with the grounds pinned, and a ticket stub for
// the selected fixture. Locked away days can still be browsed (what it takes to get there).
// Great Britain + Ireland, rough outlines (lon, lat) for the programme map
const GB = [[-5.0, 58.6], [-3.0, 58.65], [-3.1, 58.3], [-4.0, 57.9], [-3.5, 57.7], [-1.8, 57.6], [-2.1, 57.1], [-2.5, 56.6], [-2.8, 56.3], [-3.2, 56.05],
  [-2.5, 56.0], [-2.0, 55.9], [-1.6, 55.6], [-1.5, 55.0], [-1.2, 54.6], [-0.4, 54.3], [0.1, 53.6], [0.3, 53.3], [0.4, 52.9], [1.3, 52.95], [1.75, 52.6],
  [1.6, 52.1], [1.0, 51.8], [0.9, 51.5], [1.4, 51.35], [1.4, 51.1], [0.3, 50.8], [-0.8, 50.75], [-1.6, 50.7], [-2.5, 50.6], [-3.4, 50.6], [-3.6, 50.25],
  [-4.2, 50.35], [-5.0, 50.0], [-5.7, 50.05], [-5.2, 50.4], [-4.5, 50.9], [-4.2, 51.2], [-3.0, 51.2], [-2.6, 51.5], [-3.2, 51.45], [-4.3, 51.6],
  [-5.2, 51.7], [-5.1, 52.0], [-4.2, 52.4], [-4.1, 52.9], [-4.7, 52.8], [-4.6, 53.3], [-3.3, 53.35], [-3.0, 53.4], [-3.0, 53.75], [-2.8, 54.0],
  [-3.2, 54.1], [-3.6, 54.5], [-3.3, 54.9], [-3.6, 54.9], [-4.4, 54.7], [-4.9, 54.8], [-5.1, 55.0], [-4.65, 55.5], [-4.9, 55.9], [-5.6, 55.3],
  [-5.4, 56.0], [-5.6, 56.5], [-6.1, 56.7], [-5.7, 57.0], [-5.8, 57.6], [-5.1, 58.3]];
const IRL = [[-6.0, 55.2], [-5.4, 54.6], [-6.0, 53.9], [-6.0, 53.0], [-6.4, 52.2], [-7.5, 52.1], [-9.5, 51.6], [-10.2, 52.1], [-9.7, 53.0],
  [-10.0, 53.5], [-9.9, 54.2], [-8.5, 54.5], [-8.2, 55.2], [-7.3, 55.3]];
const PIN_LABEL = { anfield: [-7, -11, 'right'], oldtrafford: [7, -4, 'left'], theden: [2, -14, 'center'], stamfordbridge: [-7, 1, 'right'], ibrox: [7, -4, 'left'] };
const INK = '#1c1612', PAPER = '#ece2c6', PAPER2 = '#e2d6b4', TOUR_RED = '#b3121f';

class MapPanel extends BasePanel {
  constructor(hub) {
    super(hub);
    const d = save.data, n = Math.min(LEVELS.length, d.unlocked || 1);
    const rows = [];
    rows.push({ head: 'HOME FIXTURES: ' + HOME.name });
    for (let i = 0; i < n; i++) rows.push({ kind: 'home', i, L: LEVELS[i] });
    rows.push({ head: 'AWAY DAYS: THE FOOTBALL TOUR' });
    TOUR.forEach(t => rows.push({ kind: 'tour', t }));
    rows.push({ kind: 'roster' });
    rows.push({ kind: 'back' });
    this.rows = rows;
    this.rep = new Repeater();
    const nextI = d.run && d.run.levelIndex !== undefined ? Math.min(n - 1, d.run.levelIndex) : n - 1;
    this.sel = Math.max(0, rows.findIndex(r => r.kind === 'home' && r.i === Math.max(0, nextI)));
  }
  status(t) {
    if (t.level.stub) return { ok: false, tag: 'SOON', why: 'THIS GROUND ISN\'T ON THE FIXTURE LIST YET.' };
    if (this.F.rep < t.rep && !UNLOCK_ALL) return { ok: false, tag: `${t.rep} REP`, why: `YOUR FIRM NEEDS ${t.rep} REPUTATION TO BE TAKEN SERIOUSLY HERE (YOU HAVE ${this.F.rep}).` };
    const wins = (this.F.tourWins && this.F.tourWins[t.id]) || 0;
    return { ok: true, tag: wins ? `DONE x${wins}` : 'GO', why: '' };
  }
  move(dir) {
    const n = this.rows.length;
    let s = this.sel;
    for (let k = 0; k < n; k++) { s = (s + dir + n) % n; if (!this.rows[s].head) break; }
    if (s !== this.sel) { this.sel = s; audio.sfx('menuMove'); }
  }
  activate() {
    const r = this.rows[this.sel];
    if (r.kind === 'home') return this.go(r.i);
    if (r.kind === 'tour') {
      const st = this.status(r.t);
      if (!st.ok) { this.say(st.why.split('.')[0] + '.', false); return; }
      return this.go(levelIndex(r.t.id));
    }
    if (r.kind === 'roster') { this.hub.panel = new RosterPanel(this.hub, null, () => new MapPanel(this.hub)); return; }
    this.close();
  }
  go(i) {
    fixSquad(this.F);
    save.write();
    game.levelIndex = i; game.keys = new Set();
    save.data.run = game.snapshot(); save.write();
    this.hub.panel = null;
    app.go(app.scenes.levelIntro(i));
  }
  update(dt) {
    super.update(dt);
    if (this.rep.check('menuUp', dt)) this.move(-1);
    if (this.rep.check('menuDown', dt)) this.move(1);
    if (input.pressed('confirm')) this.activate();
    else if (input.pressed('back')) { audio.sfx('menuBack'); this.close(); }
  }
  // lon/lat -> programme map pixels
  proj(lon, lat, M) { return { x: M.x + (lon - M.lon0) * M.kx, y: M.y + (M.lat1 - lat) * M.ky }; }
  draw(ctx) {
    const t = this.t, F = this.F;
    ctx.fillStyle = 'rgba(6,6,8,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // the programme page
    const X = 8, Y = 8, W = VIEW_W - 16, H = VIEW_H - 30;
    ctx.fillStyle = PAPER; ctx.fillRect(X, Y, W, H);
    for (let yy = Y + 3; yy < Y + H; yy += 4) { ctx.fillStyle = 'rgba(120,96,60,0.05)'; ctx.fillRect(X, yy, W, 1); }
    ctx.fillStyle = INK; ctx.fillRect(X, Y, W, 1); ctx.fillRect(X, Y + H - 1, W, 1); ctx.fillRect(X, Y, 1, H); ctx.fillRect(X + W - 1, Y, 1, H);
    // masthead
    ctx.fillStyle = TOUR_RED; ctx.fillRect(X + 4, Y + 4, W - 8, 26);
    ctx.fillStyle = INK; ctx.fillRect(X + 4, Y + 30, W - 8, 2);
    drawText(ctx, 'THE FOOTBALL TOUR', X + 12, Y + 9, { color: '#fff4d8', scale: 2, outline: '#3a0008' });
    drawText(ctx, 'OFFICIAL MATCHDAY PROGRAMME  1994/95', X + W - 12, Y + 9, { color: '#fff4d8', align: 'right' });
    drawText(ctx, `REP ${F.rep}   HEAT ${F.heat}   PRICE 1 POUND`, X + W - 12, Y + 19, { color: '#ffd0a0', align: 'right' });
    // ---- fixture list
    const LX = X + 10, LW = 196;
    let y = Y + 40;
    this.rows.forEach((r, k) => {
      const sel = k === this.sel;
      if (r.head) {
        y += 3;
        drawText(ctx, r.head, LX, y, { color: TOUR_RED }); ctx.fillStyle = INK; ctx.fillRect(LX, y + 9, LW, 1);
        y += 13; return;
      }
      let label, tag = '', tagCol = INK, dim = false;
      if (r.kind === 'home') { label = `${r.L.num || r.i + 1}. ${r.L.name}`; }
      else if (r.kind === 'tour') { const st = this.status(r.t); label = r.t.venue; tag = st.tag; dim = !st.ok; tagCol = st.ok ? '#1f6a2a' : '#8a7a60'; }
      else if (r.kind === 'roster') { y += 4; label = 'PICK WHO TRAVELS'; }
      else label = 'BACK TO THE BAR';
      if (sel) { ctx.fillStyle = INK; ctx.fillRect(LX - 3, y - 2, LW + 6, 11); }
      drawText(ctx, label, LX + 2, y, { color: sel ? '#fff4d8' : dim ? '#8a7a60' : INK });
      if (tag) drawText(ctx, tag, LX + LW, y, { color: sel ? '#ffd0a0' : tagCol, align: 'right' });
      if (r.kind === 'tour') { ctx.fillStyle = r.t.colors[0]; ctx.fillRect(LX - 8, y, 4, 7); ctx.fillStyle = r.t.colors[1]; ctx.fillRect(LX - 8, y + 4, 4, 3); }
      y += 11;
    });
    // ---- the map
    const M = { x: X + 222, y: Y + 40, w: 196, h: H - 50, lon0: -10.6, lat1: 59.0 };
    M.kx = M.w / 12.8; M.ky = M.kx / Math.cos(54 * Math.PI / 180);
    ctx.fillStyle = PAPER2; ctx.fillRect(M.x, M.y, M.w, M.h);
    ctx.save(); ctx.beginPath(); ctx.rect(M.x, M.y, M.w, M.h); ctx.clip();
    for (const [poly, fill] of [[IRL, '#d4c8a4'], [GB, '#c9d1a6']]) {
      ctx.beginPath();
      poly.forEach(([lo, la], i) => { const p = this.proj(lo, la, M); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
    }
    // route lines from home to the grounds you can travel to
    const home = this.proj(HOME.lon, HOME.lat, M);
    const selRow = this.rows[this.sel];
    for (const tr of TOUR) {
      const p = this.proj(tr.lon, tr.lat, M), st = this.status(tr);
      if (!st.ok) continue;
      ctx.strokeStyle = selRow.t === tr ? TOUR_RED : 'rgba(28,22,18,0.35)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(home.x, home.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    // pins
    const star = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.stroke(); };
    star(home.x, home.y, 6, selRow.kind === 'home' ? '#ffd23a' : '#e8c060');
    drawText(ctx, HOME.name, home.x - 8, home.y - 4, { color: INK, align: 'right' });   // (the pin sits on the map's east edge)
    TOUR.forEach((tr, k) => {
      const p = this.proj(tr.lon, tr.lat, M), st = this.status(tr), sel = selRow.t === tr;
      const r = sel ? 5 + Math.sin(t * 6) * 1 : 4;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = st.ok ? tr.colors[0] : '#9a8c70'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = st.ok ? tr.colors[1] : '#c8bc9c'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2); ctx.fill();
      // labels: neighbouring grounds (Liverpool/Manchester, the two in London) fan out to either side
      const [dx, dy, align] = PIN_LABEL[tr.id] || [8, -4, 'left'];
      drawText(ctx, tr.venue, p.x + dx, p.y + dy, { color: sel ? TOUR_RED : INK, align });
    });
    // ---- ticket stub for the selected fixture
    const TX = X + 428, TY = Y + 40, TW = W - 436, TH = H - 50;
    ctx.fillStyle = '#f7efd8'; ctx.fillRect(TX, TY, TW, TH);
    ctx.fillStyle = INK; ctx.fillRect(TX, TY, TW, 1); ctx.fillRect(TX, TY + TH - 1, TW, 1); ctx.fillRect(TX, TY, 1, TH); ctx.fillRect(TX + TW - 1, TY, 1, TH);
    for (let yy = TY + 4; yy < TY + TH - 4; yy += 6) { ctx.fillStyle = INK; ctx.fillRect(TX + 3, yy, 1, 3); }   // perforation
    const tx = TX + 10;
    let ty = TY + 6;
    const line = (txt, col = INK, gap = 10) => { drawText(ctx, txt, tx, ty, { color: col }); ty += gap; };
    if (selRow.kind === 'tour') {
      const tr = selRow.t, st = this.status(tr);
      ctx.fillStyle = tr.colors[0]; ctx.fillRect(TX + 6, ty, TW - 12, 8); ctx.fillStyle = tr.colors[1]; ctx.fillRect(TX + 6, ty + 8, TW - 12, 3); ty += 16;
      line('ADMIT ONE: AWAY END', '#6a5a40');
      line(tr.venue, TOUR_RED, 11);
      line(`${tr.club} (${tr.nick})`);
      line(tr.city, '#5a4a36', 13);
      line('THE LOCALS:', '#6a5a40'); line(tr.firm, INK, 13);
      drawText(ctx, 'DANGER', tx, ty, { color: '#6a5a40' });
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i < tr.danger ? TOUR_RED : '#cdbf9c'; ctx.fillRect(tx + 44 + i * 9, ty, 7, 7); }
      ty += 13;
      line(`REP NEEDED ${tr.rep}`, F.rep >= tr.rep ? '#1f6a2a' : TOUR_RED);
      line('WIN: REP X2, +15 THE FIRST TIME', '#5a4a36', 13);
      wrapText(st.ok ? tr.blurb : st.why, TW - 18).slice(0, 6).forEach(l => line(l, st.ok ? INK : '#8a3020', 9));
    } else if (selRow.kind === 'home') {
      const L = selRow.L;
      ctx.fillStyle = '#141416'; ctx.fillRect(TX + 6, ty, TW - 12, 8); ctx.fillStyle = '#f2c811'; ctx.fillRect(TX + 6, ty + 8, TW - 12, 3); ty += 16;
      line('HOME FIXTURE', '#6a5a40');
      line(L.name, TOUR_RED, 11);
      line(L.subtitle || '', '#5a4a36', 13);
      wrapText((L.intro || []).join(' '), TW - 18).slice(0, 9).forEach(l => line(l, INK, 9));
    } else {
      line('THE COACH', TOUR_RED, 12);
    }
    // who's on the coach (bottom of the stub)
    const sq = squadLads(F);
    let cy = TY + TH - 14 - Math.max(1, sq.length) * 9 - 10;
    ctx.fillStyle = INK; ctx.fillRect(TX + 8, cy - 4, TW - 16, 1);
    drawText(ctx, `ON THE COACH (${sq.length}/${squadSize(F)})`, tx, cy, { color: '#6a5a40' }); cy += 10;
    if (!sq.length) drawText(ctx, 'NOBODY. YOU GO ALONE.', tx, cy, { color: TOUR_RED });
    sq.forEach((l, i) => drawText(ctx, l.name, tx, cy + i * 9, { color: INK }));
    if (F.heat >= 60) drawText(ctx, 'THE OLD BILL ARE WATCHING', TX + TW / 2, TY + TH - 10, { color: TOUR_RED, align: 'center' });
    this.drawNote(ctx);
    hintBar(ctx, [['menuUp', 'CHOOSE'], ['confirm', 'GO'], ['back', 'BACK']], VIEW_H - 14);
  }
}

// ---- the lads (roster): coach on/off, physio, let go
class RosterPanel extends BasePanel {
  constructor(hub, focus = null, back = null) {
    super(hub);
    this.back = back;
    this.sub = null;
    this.build(focus);
  }
  build(focus) {
    const F = this.F;
    this.menu = new MenuList([
      ...F.lads.map(l => ({ label: () => `${F.squad.includes(l.id) ? '> ' : '  '}${l.name}`, fn: () => this.actions(l), lad: l })),
      { label: 'BACK', fn: () => this.leave() },
    ], { onBack: () => this.leave() });
    if (focus) this.menu.sel = Math.max(0, F.lads.indexOf(focus));
  }
  leave() { if (this.back) { this.hub.panel = this.back(); save.write(); } else this.close(); }
  actions(l) {
    const F = this.F;
    const items = [
      { label: () => (F.squad.includes(l.id) ? 'TAKE OFF THE COACH' : 'PUT ON THE COACH'), fn: () => { const m = toggleSquad(F, l.id); this.say(m, !/INJURED|BANNED|ONLY/.test(m)); } },
    ];
    if (l.injury > 0) items.push({ label: 'PHYSIO (£25, -1 DAY)', fn: () => { const r = physio(F, l.id); this.say(r.msg, r.ok); } });
    items.push({ label: 'LET HIM GO', fn: () => { this.sub = this.confirmSack(l); } });
    items.push({ label: 'BACK', fn: () => { this.sub = null; } });
    this.sub = new MenuList(items, { onBack: () => { this.sub = null; } });
  }
  confirmSack(l) {
    return new MenuList([
      { label: 'NO, HE STAYS', fn: () => { this.sub = null; } },
      { label: `YES, ${l.name} IS OUT`, fn: () => { this.say(sack(this.F, l.id), true); this.sub = null; this.build(); this.hub.rebuild(); } },
    ], { onBack: () => { this.sub = null; } });
  }
  update(dt) { super.update(dt); if (this.sub) this.sub.update(dt); else this.menu.update(dt); }
  draw(ctx) {
    panelFrame(ctx, `THE LADS (${this.F.lads.length}/${MAX_ROSTER})  > = ON THE COACH`, SQ);
    this.menu.draw(ctx, PX + 18, PY + 16, { w: 180, rowH: 15, align: 'left' });
    const it = this.menu.items[this.menu.sel];
    if (it && it.lad) drawLadCard(ctx, it.lad, this.F, PX + 228, PY + 14, PW - 250);
    if (this.sub) {
      const w = 220, x = PX + 228, y = PY + PH - 90;
      frame(ctx, x - 6, y - 8, w + 12, 70, { fill: 'rgba(8,6,16,0.97)', accent: C.gold, rivets: false });
      this.sub.draw(ctx, x, y, { w, rowH: 14, align: 'left' });
    }
    this.drawNote(ctx);
    hintBar(ctx, [['menuUp', 'CHOOSE'], ['confirm', 'SELECT'], ['back', 'BACK']], VIEW_H - 14);
  }
}

// ---- the bar: recruit
class BarPanel extends BasePanel {
  constructor(hub) { super(hub); this.build(); }
  build() {
    this.menu = new MenuList([
      ...this.F.pool.map((c, i) => ({ label: `${c.name} '${c.nick}'`, fn: () => this.take(i), lad: c })),
      { label: 'BACK', fn: () => this.close() },
    ], { onBack: () => this.close() });
  }
  take(i) {
    const r = hire(this.F, i);
    this.say(r.msg, r.ok);
    if (r.ok) { this.build(); this.hub.rebuild(); save.write(); }
  }
  update(dt) { super.update(dt); this.menu.update(dt); }
  draw(ctx) {
    panelFrame(ctx, "THE BAR: RON KNOWS A FEW LADS WHO WANT IN", C.red);
    this.menu.draw(ctx, PX + 18, PY + 16, { w: 190, rowH: 15, align: 'left' });
    if (!this.F.pool.length) drawText(ctx, 'NOBODY TONIGHT. COME BACK TOMORROW.', PX + 18, PY + 40, { color: '#8a809a' });
    const it = this.menu.items[this.menu.sel];
    if (it && it.lad) drawLadCard(ctx, it.lad, this.F, PX + 236, PY + 14, PW - 258, { cost: it.lad.cost });
    drawText(ctx, `BETTER LADS TURN UP AS YOUR REPUTATION GROWS (TIER ${recruitTier(this.F) + 1}/4)`, PX + 18, PY + PH - 26, { color: '#8a809a' });
    this.drawNote(ctx);
    hintBar(ctx, [['menuUp', 'CHOOSE'], ['confirm', 'SIGN HIM UP'], ['back', 'BACK']], VIEW_H - 14);
  }
}

// ---- the back room: training
class TrainPanel extends BasePanel {
  constructor(hub) { super(hub); this.lad = null; this.build(); }
  build() {
    const F = this.F;
    if (!this.lad) {
      this.menu = new MenuList([
        ...F.lads.map(l => ({ label: `${l.name}${(F.trained || {})[l.id] === F.day ? ' (DONE)' : ''}`, fn: () => { this.lad = l; this.build(); }, lad: l, disabled: () => l.injury > 0 })),
        { label: 'BACK', fn: () => this.close() },
      ], { onBack: () => this.close() });
    } else {
      const l = this.lad;
      this.menu = new MenuList([
        ...STATS.map(s => ({ label: () => `${STAT_NAME[s]} ${l.stats[s]} -> ${Math.min(10, l.stats[s] + 1)}   £${trainCost(l, s)}`, fn: () => { const r = train(F, l.id, s); this.say(r.msg, r.ok); }, st: s })),
        { label: 'BACK', fn: () => { this.lad = null; this.build(); } },
      ], { onBack: () => { this.lad = null; this.build(); } });
    }
  }
  update(dt) { super.update(dt); this.menu.update(dt); }
  draw(ctx) {
    panelFrame(ctx, this.lad ? `THE BACK ROOM: ${this.lad.name}` : 'THE BACK ROOM: WHO\'S TRAINING?', '#7a1a1a');
    this.menu.draw(ctx, PX + 18, PY + 16, { w: 200, rowH: 15, align: 'left' });
    const it = this.menu.items[this.menu.sel];
    const lad = this.lad || (it && it.lad);
    if (lad) drawLadCard(ctx, lad, this.F, PX + 246, PY + 14, PW - 268, { hl: it && it.st });
    drawText(ctx, 'ONE SESSION PER LAD PER DAY. GRAFTERS TRAIN FOR HALF PRICE.', PX + 18, PY + PH - 26, { color: '#8a809a' });
    this.drawNote(ctx);
    hintBar(ctx, [['menuUp', 'CHOOSE'], ['confirm', 'TRAIN'], ['back', 'BACK']], VIEW_H - 14);
  }
}

// ---- first visit: what is this place
class HelpPanel extends BasePanel {
  update(dt) {
    super.update(dt);
    if (this.t > 0.5 && (input.pressed('confirm') || input.pressed('use') || input.pressed('back'))) { audio.sfx('menuSelect'); save.write(); this.hub.panel = this.after ? this.after() : null; }
  }
  draw(ctx) {
    panelFrame(ctx, 'WELCOME TO THE ANCHOR - YOUR FIRM\'S LOCAL', C.gold);
    const L = [
      ['BETWEEN MATCHES YOU LIVE HERE. WALK AROUND WITH WASD / ARROWS.', '#ffffff'],
      ['', ''],
      ['THE MAP (ON THE WALL, OR PRESS M)', C.gold], ['  PICK THE NEXT TRIP AND WHO GETS ON THE COACH. THEN: GO!', '#c0b8d0'],
      ['THE BAR', C.gold], ['  RON KNOWS LADS WHO WANT IN. RECRUIT THEM WITH YOUR CASH.', '#c0b8d0'],
      ['THE BACK ROOM (HEAVY BAG)', C.gold], ['  TRAIN A LAD\'S STATS. ONE SESSION PER LAD PER DAY.', '#c0b8d0'],
      ['TALK TO A LAD (E NEXT TO HIM)', C.gold], ['  HIS CARD: STATS, MOOD, INJURIES. PUT HIM ON OR OFF THE COACH.', '#c0b8d0'],
      ['THE DOOR', C.gold], ['  CALL IT A NIGHT: A DAY PASSES, INJURIES HEAL, HEAT COOLS.', '#c0b8d0'],
      ['', ''],
      ['WIN TRIPS FOR REPUTATION. TOO MUCH CHAOS BRINGS THE OLD BILL (HEAT).', '#7affe0'],
    ];
    L.forEach(([t, c], i) => { if (t) drawText(ctx, t, PX + 20, PY + 16 + i * 12, { color: c }); });
    hintBar(ctx, [['confirm', 'GOT IT']], VIEW_H - 14);
  }
}

// ---- yes/no
class ConfirmPanel extends BasePanel {
  constructor(hub, title, lines, yes) {
    super(hub);
    this.title = title; this.lines = lines;
    this.menu = new MenuList([{ label: 'NOT YET', fn: () => this.close() }, { label: 'YES', fn: () => { this.close(); yes(); } }], { onBack: () => this.close() });
  }
  update(dt) { super.update(dt); this.menu.update(dt); }
  draw(ctx) {
    ctx.fillStyle = 'rgba(6,6,8,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 300, h = 110, x = (VIEW_W - w) / 2, y = 110;
    frame(ctx, x, y, w, h, { title: this.title, fill: 'rgba(12,12,14,0.97)', accent: C.gold });
    this.lines.forEach((l, i) => drawText(ctx, l, VIEW_W / 2, y + 16 + i * 11, { color: '#e0d8e8', align: 'center' }));
    this.menu.draw(ctx, VIEW_W / 2 - 60, y + 58, { w: 120, rowH: 18 });
  }
}

// ---- Esc in the pub
class PubMenu extends BasePanel {
  constructor(hub) {
    super(hub);
    this.menu = new MenuList([
      { label: 'BACK TO THE BAR', fn: () => this.close() },
      { label: 'THE LADS', fn: () => { this.hub.panel = new RosterPanel(this.hub); } },
      { label: 'QUIT TO MENU', fn: () => { save.write(); this.hub.panel = null; app.go(app.scenes.menu()); } },
    ], { onBack: () => this.close() });
  }
  update(dt) { super.update(dt); this.menu.update(dt); }
  draw(ctx) {
    ctx.fillStyle = 'rgba(6,6,8,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    frame(ctx, VIEW_W / 2 - 110, 110, 220, 86, { title: 'THE ANCHOR', fill: 'rgba(12,12,14,0.97)', accent: C.red });
    this.menu.draw(ctx, VIEW_W / 2 - 90, 128, { w: 180, rowH: 18 });
  }
}

app.scenes.hub = () => new HubScene();
