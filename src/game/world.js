// World: one loaded level with all its entities, encounters, triggers and rendering.
// See docs/ARCHITECTURE.md and docs/LEVELS.md for the level format.

import { VIEW_W, VIEW_H, HALF_W, HALF_H, Z_PX, STEP_UP } from '../engine/constants.js';
import { toScreen, toWorld } from '../engine/iso.js';
import { Firm } from './firm.js';
import { TileMap } from '../engine/tilemap.js';
import { renderFloor, drawWallBlock } from '../engine/tiles.js';
import { Camera } from '../engine/camera.js';
import { drawText } from '../engine/font.js';
import { shade, rgba } from '../engine/color.js';
import { ATTACKS } from './combat.js';
import { FX } from './fx.js';
import { Prop, PROPS } from './props.js';
import { WorldItem, Projectile, ITEMS } from './items.js';
import { createPlayer } from './player.js';
import { spawnEnemy, ENEMIES } from '../content/enemies.js';
import { audio } from '../audio/audio.js';
import { save } from '../save.js';
import { isoBox } from '../engine/gfx.js';
import { envProp } from '../engine/envsprites.js';
import { VEHICLE_SIZE, drawVehicleSprite } from './vehicles.js';
import { applyBuff, tickBuffs, buffLeft, RUSH, CRASH } from './buffs.js';

// Clip to the screen region of the vertical prism above footprint [x0,x0+w] x [y0,y0+d] from height z0 up to z0+h.
function clipPrism(ctx, x0, y0, w, d, h, z0 = 0) {
  const pts = [];
  for (const [x, y] of [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]]) { pts.push(toScreen(x, y, z0)); pts.push(toScreen(x, y, z0 + h)); }
  // convex hull (monotone chain) of the 8 projected corners
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  ctx.beginPath();
  hull.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
}


const DIFF = {
  easy: { tokens: 1, dmg: 0.7, hp: 0.85 },
  normal: { tokens: 2, dmg: 1.0, hp: 1.0 },
  hard: { tokens: 3, dmg: 1.15, hp: 1.2 },
};

ATTACKS.throwItem = { pose: 'throwItem', startup: 0.3, active: 0.06, recovery: 0.3, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, spawnProjectile: true, whiff: 'whoosh' };
ATTACKS.playerThrow = { pose: 'throwItem', startup: 0.1, active: 0.05, recovery: 0.2, dmg: 0, reach: 0, arc: 0, kb: 0, stun: 0, spawnProjectile: true, whiff: 'whoosh' };

export class World {
  constructor(level, game, callbacks = {}) {
    this.level = level;
    this.game = game;
    this.cb = callbacks;
    this.diff = DIFF[save.data.settings.difficulty] || DIFF.normal;
    this.time = 0;
    this.map = new TileMap(level);
    this.floor = renderFloor(this.map);
    this.camera = new Camera();
    const W = this.map.w, H = this.map.h;
    let maxWall = 0;
    for (const w of this.map.wall) if (w && w.h > maxWall) maxWall = w.h;
    this.camera.bounds = { minX: -H * HALF_W - 40, maxX: W * HALF_W + 40, minY: -maxWall * Z_PX - 50, maxY: (W + H) * HALF_H + 60 };
    this.fx = new FX();
    this.fighters = [];
    this.items = [];
    this.props = [];
    this.projectiles = [];
    this.vehicles = [];
    this.overheadQueue = [];
    this.actors = [];          // custom level entities: { x, y, z?, update?(world, dt), draw?(ctx, world), depth?(), removed }
    this.propH = new Float32Array(W * H);
    this.propAt = new Array(W * H).fill(null);
    this.hitstop = 0;
    this.slowmo = 0;
    this.tokens = new Set();
    this.combo = { count: 0, t: 0 };
    this.banner = null;
    this.toasts = [];
    this.lastEnemy = null; this.lastEnemyT = 0;
    this.boss = null;
    this.bosses = [];          // every boss-flagged fighter alive in the level (HUD shows a bar per boss)
    this.exitOpen = false;
    this.completeT = -1;
    this.deathT = -1;
    this.lock = null;
    this.goArrow = null;
    this.readText = null;
    this.stats = game.blankStats();
    this.record = game.levelRecord(level.id);
    this.scarfIndex = 0;
    this.flow = null; this.flowT = 0; this.flowTile = -1;
    this.rain = [];
    this.paused = false;

    // walls list for rendering
    this.walls = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const w = this.map.wall[ty * W + tx];
      if (w) this.walls.push({ tx, ty, w, sx: (tx - ty) * HALF_W, sy: (tx + ty) * HALF_H, depth: tx + ty + 1 });
    }

    this.lights = (level.lights || []).map(l => ({ ...l }));
    // props & items from map legend + explicit lists
    for (const ps of [...this.map.propSpawns, ...(level.props || [])]) this.addProp(ps);
    let scarfIdx = 0;
    for (const it of [...this.map.itemSpawns, ...(level.items || [])]) {
      const extra = {};
      if (it.type === 'scarf') { extra.data = { idx: scarfIdx++ }; if (this.record.scarves.has(extra.data.idx)) continue; }
      if (it.type === 'badge' && this.record.badge) continue;
      if (it.key) extra.data = { ...(extra.data || {}), keyId: it.key };
      if (it.text) extra.data = { ...(extra.data || {}), text: it.text, title: it.title };
      this.items.push(new WorldItem(it.type, it.x, it.y, it.z || 0, extra));
    }
    this.totalScarves = scarfIdx;


    // player
    const start = level.start || (this.map.markers.start && this.map.markers.start[0]) || { x: 2, y: 2 };
    this.player = createPlayer(game, start.x, start.y);
    if (level.startFacing) this.player.face2(level.startFacing.x, level.startFacing.y);
    this.fighters.push(this.player);
    this.checkpoint = { x: start.x, y: start.y };
    this.camera.snapTo(start.x, start.y);

    // the firm: the player's lads (game/firm.js); off for attract demos / levels with firm:false / settings.firm false
    this.firm = Firm.enabled(this, callbacks) ? new Firm(this, { size: save.data.settings.firmSize ?? 3 }) : null;
    if (this.firm) this.firm.spawn(game);

    // static enemies
    for (const e of level.enemies || []) this.spawnEnemy(e.type, e.x, e.y, e);

    // encounters
    this.encounters = (level.encounters || []).map((e, i) => ({ ...e, idx: i, state: 'waiting', wave: -1, spawned: [], waveT: 0 }));
    if (level.boss) {
      this.encounters.push({ ...level.boss, idx: this.encounters.length, boss: true, state: 'waiting', wave: -1, spawned: [], waveT: 0,
        waves: [{ enemies: [{ type: level.boss.type, x: level.boss.x, y: level.boss.y, from: level.boss.from, boss: true }, ...(level.boss.minions || [])] }, ...(level.boss.extraWaves || [])] });
    }
    this.secrets = (level.secrets || []).map(s => ({ ...s, found: this.record.secrets.has(s.id) }));
    this.triggers = (level.triggers || []).map(t => ({ ...t, fired: false }));
    this.hazards = (level.hazards || []).map(h => ({ ...h, t: (h.offset || 0) + Math.random() * 2, timer: 0 }));
    this.exit = level.exit || (this.map.markers.exit && { x: this.map.markers.exit[0].x - 1, y: this.map.markers.exit[0].y - 1, w: 2, h: 2 });
    if (level.exitOpen) this.exitOpen = true;
    this.rebuildPropGrid();
    if (level.onStart) level.onStart(this);
  }

  // ================================================================== spatial queries
  addProp(spec) {
    if (!PROPS[spec.type]) { console.warn('[world] unknown prop type', spec.type); }
    const p = new Prop(spec);
    this.props.push(p);
    if (p.def.light || spec.light) { const L = { prop: p, x: p.cx, y: p.cy, ...(p.def.light || { z: 1, r: 3, color: '#ffcf7a', intensity: 0.8 }), ...(spec.light || {}) }; L.z = (L.z || 0) + p.base; this.lights.push(L); }
    return p;
  }

  rebuildPropGrid() {
    this.propH.fill(0);
    this.propAt.fill(null);
    const W = this.map.w;
    for (const p of this.props) {
      if (p.removed || !p.solid || p.open) continue;
      for (let y = p.y; y < p.y + p.d; y++) for (let x = p.x; x < p.x + p.w; x++) {
        if (!this.map.inBounds(x, y)) continue;
        const i = y * W + x;
        if (p.h > this.propH[i]) { this.propH[i] = p.h; this.propAt[i] = p; }
      }
    }
    this.flowTile = -1;
  }

  heightAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    const h = this.map.heightAt(tx, ty);
    if (h >= 99) return h;
    return Math.max(h, this.propH[ty * this.map.w + tx]);
  }

  groundHeight(x, y, z = 0) {
    const h = this.heightAt(x, y);
    return h <= z + STEP_UP ? h : 0;
  }

  blockedAt(x, y, r, zTol, e) {
    if (e && e.isPlayer && this.lock) {
      const L = this.lock;
      if (x < L.x + r || y < L.y + r || x > L.x + L.w - r || y > L.y + L.h - r) return true;
    }
    if (e && e.noclip) return false;
    const k = r * 0.8;
    return this.heightAt(x - k, y - k) > zTol || this.heightAt(x + k, y - k) > zTol ||
      this.heightAt(x - k, y + k) > zTol || this.heightAt(x + k, y + k) > zTol;
  }

  moveEntity(e, dx, dy, rOverride) {
    const r = rOverride ?? e.r ?? 0.25;
    const zTol = (e.z || 0) + STEP_UP;
    let blocked = false;
    if (dx) { const nx = e.x + dx; if (this.blockedAt(nx, e.y, r, zTol, e)) blocked = true; else e.x = nx; }
    if (dy) { const ny = e.y + dy; if (this.blockedAt(e.x, ny, r, zTol, e)) blocked = true; else e.y = ny; }
    return blocked;
  }

  hasLOS(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 0.3);
    // eye line follows the ground between the two ends (flat ground: 0.7; stepped terraces: rises with the steps)
    const g = (x, y) => { const h = this.heightAt(x, y); return h >= 99 ? 0 : h; };
    const h0 = g(x0, y0), h1 = g(x1, y1);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.heightAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) > h0 + (h1 - h0) * t + 0.7) return false;
    }
    return true;
  }

  // Like hasLOS but blocks on anything an entity cannot walk over (used for AI steering).
  hasWalkLine(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 0.25);
    // relative steps: walking up terrace steps (each <= STEP_UP) is fine, any drop is fine
    let prev = this.heightAt(x0, y0); if (prev >= 99) prev = 0;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const h = this.heightAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (h > Math.max(prev, 0) + STEP_UP) return false;
      prev = h;
    }
    return true;
  }

  computeFlow() {
    const W = this.map.w, H = this.map.h;
    const p = this.player;
    const pt = Math.floor(p.y) * W + Math.floor(p.x);
    if (pt === this.flowTile && this.flow) return;
    this.flowTile = pt;
    this.flow = this.bfsFlow(pt, this.flow);
  }

  // Breadth-first distance field (tiles) toward tile index pt. Same stepping rules everywhere (terrace steps etc.).
  bfsFlow(pt, reuse) {
    const W = this.map.w, H = this.map.h;
    const dist = reuse && reuse.length === W * H ? reuse : new Int16Array(W * H);
    dist.fill(-1);
    const q = new Int32Array(W * H);
    let qh = 0, qt = 0;
    if (pt < 0 || pt >= W * H) return dist;
    dist[pt] = 0; q[qt++] = pt;
    while (qh < qt) {
      const i = q[qh++];
      const x = i % W, y = (i / W) | 0;
      const nd = dist[i] + 1;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (dist[j] !== -1) continue;
        // j joins if it is ground level (as before) or a step within STEP_UP of i (stepped terraces, platforms)
        const hj = Math.max(this.map.heightAt(nx, ny), this.propH[j]);
        if (hj >= 99) continue;
        if (hj > STEP_UP) { const hi = Math.max(this.map.heightAt(x, y), this.propH[i]); if (Math.abs(hj - hi) > STEP_UP) continue; }
        dist[j] = nd; q[qt++] = j;
      }
    }
    return dist;
  }

  // Path direction toward any point (lads' orders, enemies going for a lad). Near the player it reuses the main
  // field; other target tiles get their own field, cached for 0.6s.
  flowDirTo(x, y, tx, ty) {
    const p = this.player, W = this.map.w;
    const ix = Math.floor(tx), iy = Math.floor(ty);
    if (!p || Math.hypot(tx - p.x, ty - p.y) < 2.5 || !this.map.inBounds(ix, iy)) return this.flowDir(x, y);
    const key = iy * W + ix;
    const C = this._flowCache || (this._flowCache = new Map());
    let e = C.get(key);
    if (!e || this.time - e.t > 0.6) {
      e = { t: this.time, d: this.bfsFlow(key, e && e.d) };
      C.delete(key); C.set(key, e);
      if (C.size > 24) C.delete(C.keys().next().value);
    }
    return this.flowDir(x, y, e.d);
  }

  flowDir(x, y, field = this.flow) {
    if (!field) return null;
    const W = this.map.w, H = this.map.h;
    const tx = Math.floor(x), ty = Math.floor(y);
    const here = field[ty * W + tx];
    let best = null, bd = here >= 0 ? here : 1e9;
    let hHere = this.heightAt(x, y); if (hHere >= 99) hHere = 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = tx + ox, ny = ty + oy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (ox && oy && (field[ty * W + nx] < 0 || field[ny * W + tx] < 0)) continue;
      const d = field[ny * W + nx];
      if (d >= 0 && d < bd && this.heightAt(nx + 0.5, ny + 0.5) <= hHere + STEP_UP) { bd = d; best = { x: nx + 0.5 - x, y: ny + 0.5 - y }; }
    }
    if (!best) return null;
    const l = Math.hypot(best.x, best.y) || 1;
    return { x: best.x / l, y: best.y / l };
  }

  // ================================================================== tokens (limit simultaneous attackers)
  hasToken(f) { return this.tokens.has(f); }
  requestToken(f) {
    if (this.tokens.has(f)) return true;
    if ((f.data.tokenCd || 0) > this.time) return false;
    for (const t of this.tokens) if (!t.alive || t.removed) this.tokens.delete(t);
    if (this.tokens.size < this.diff.tokens + (this.level.extraTokens || 0)) { this.tokens.add(f); return true; }
    return false;
  }
  // Attack token on a target other than the player (a lad, or an enemy a lad is fighting): the two closest
  // fighters going for that target may attack, the rest circle. Recomputed every 0.25s.
  sideToken(f, t) {
    const m = this._sideTok || (this._sideTok = new Map());
    let e = m.get(t);
    if (!e || this.time - e.t > 0.25) {
      const att = this.fighters.filter(o => o.team !== t.team && o.alive && !o.removed && o.controller && o.controller.curTarget === t && o.grabbing !== t)
        .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y)).slice(0, 2);
      e = { t: this.time, set: new Set(att) };
      m.set(t, e);
      if (m.size > 64) m.clear();
    }
    return e.set.has(f);
  }
  releaseToken(f, cooldown = 0) {
    if (this.tokens.delete(f) && cooldown) f.data.tokenCd = this.time + cooldown;
  }
  alertNear(f, r) {
    for (const o of this.fighters) if (o.controller && o.controller.aggro === false && Math.hypot(o.x - f.x, o.y - f.y) < r) o.controller.aggro = true;
  }

  // ================================================================== spawning
  spawnEnemy(type, x, y, opts = {}) {
    const f = spawnEnemy(type, x, y, opts, this);
    if (!f) return null;
    f.power *= this.diff.dmg;
    f.maxHp = f.hp = Math.round(f.hp * this.diff.hp);
    if (opts.from) {
      f.x = opts.from.x; f.y = opts.from.y;
      f.noclip = true;
      f.controller.goal = { x, y };
    }
    if (opts.aggro !== undefined) f.controller.aggro = opts.aggro;
    this.fighters.push(f);
    if (f.boss) { if (opts.boss || !this.boss) this.boss = f; this.bosses.push(f); }
    return f;
  }

  // Custom level entity (trains, crowds, forklifts, cutscene props...). Must have x,y; may define
  // update(world, dt), draw(ctx, world) (world-space, camera already applied), depth() for sorting, removed flag.
  addActor(a) { this.actors.push(a); return a; }

  // Light that exists for the current frame only (call every frame from update/draw of actors, props, levels).
  addFrameLight(l) { (this.lightsDynamic ||= []).push(l); }

  spawnItem(type, x, y, z = 0, extra = {}) {
    const it = new WorldItem(type, x, y, z, extra);
    this.items.push(it);
    return it;
  }

  spawnProjectile(f, type, tx, ty, dmg) {
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
    const speed = 9;
    const t = d / speed;
    const pr = new Projectile({ x: f.x + f.fx * 0.4, y: f.y + f.fy * 0.4, z: f.z + 1.6, vx: dx / d * speed, vy: dy / d * speed, vz: Math.max(0.5, (t * 24 * 0.5) * 0.5 - 0.2), grav: 0.5, dmg: dmg ?? (ITEMS[type] && ITEMS[type].weapon ? ITEMS[type].weapon.throwDmg : 10), owner: f, team: f.team, type });
    this.projectiles.push(pr);
    this.sfx('throw', f);
    return pr;
  }

  // ================================================================== player helpers
  autoAim(f, mx = 0, my = 0) {
    let best = null, bs = -1e9;
    for (const t of this.fighters) {
      if (t.team === f.team || !t.alive || t.removed || t.state === 'dead') continue;
      const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
      if (d > 2.2 || d < 0.01) continue;
      const fx = Math.hypot(mx, my) > 0.3 ? mx : f.fx, fy = Math.hypot(mx, my) > 0.3 ? my : f.fy;
      const dot = (dx * fx + dy * fy) / d / (Math.hypot(fx, fy) || 1);
      if (dot < -0.3) continue;
      const score = dot * 2 - d + (t.isDown ? -1.5 : 0) - (dot < 0.1 ? 2 : 0);
      if (score > bs) { bs = score; best = t; }
    }
    if (best) f.face2(best.x - f.x, best.y - f.y);
    else if (Math.hypot(mx, my) > 0.3) f.face2(mx, my);
  }

  downTargetNear(f) {
    for (const t of this.fighters) {
      if (t.team === f.team || !t.alive || t.state !== 'down') continue;
      if (Math.hypot(t.x - f.x, t.y - f.y) < 1.3) {
        // only stomp if nobody standing is closer
        let standing = false;
        for (const o of this.fighters) if (o.team !== f.team && o.alive && !o.isDown && Math.hypot(o.x - f.x, o.y - f.y) < 1.3) standing = true;
        if (!standing) { f.face2(t.x - f.x, t.y - f.y); return true; }
      }
    }
    return false;
  }

  nearestWeapon(x, y, r) {
    let best = null, bd = r;
    for (const it of this.items) {
      if (it.removed || !it.def || it.def.kind !== 'weapon' || it.z > 0.5) continue;
      const d = Math.hypot(it.x - x, it.y - y);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  pickupWeapon(f, item) {
    if (f.weapon) this.dropWeapon(f);
    f.weapon = { def: item.def, durability: item.durability };
    item.removed = true;
    f.setState('pickup');
    this.sfx('pickupWeapon', f);
  }

  dropWeapon(f) {
    if (!f.weapon) return;
    this.spawnItem(f.weapon.def.id, f.x + f.fx * 0.4, f.y + f.fy * 0.4, 0.5, { durability: f.weapon.durability, vz: 2, pickDelay: 0.4 });
    f.weapon = null;
  }

  throwWeapon(f) {
    if (!f.weapon) return;
    f.data.throwing = { type: f.weapon.def.id, dmg: f.weapon.def.weapon.throwDmg || 10 };
    f.weapon = null;
    this.autoAim(f);
    f.startAttack('playerThrow', this);
  }

  weaponBroke(f, w) {
    const br = w.def.weapon.breaks;
    if (br === 'glass') { this.fx.glass(f.x + f.fx * 0.6, f.y + f.fy * 0.6, f.z + 1.3); this.sfx('glass', f); }
    else { this.fx.debris(f.x + f.fx * 0.6, f.y + f.fy * 0.6, f.z + 1, br === 'wood' ? ['#8a5a30', '#5e3e20'] : ['#9aa0a8', '#5a6068']); this.sfx(br === 'wood' ? 'wood' : 'clatter', f); }
    if (f.isPlayer) this.toast(w.def.name + ' BROKE!');
  }

  playerUse(f) {
    // 0. a mate out cold at your feet: haul him up (game/firm.js)
    if (this.firm && this.firm.tryRevive(f)) return;
    if (f.onUse && f.onUse(this, 'first')) return;   // character-specific USE (Big Al: put the shirt back on)
    // 1. interactive props
    for (const p of this.props) {
      if (p.removed || p.open || !p.def.interact) continue;
      if (Math.hypot(p.cx - f.x, p.cy - f.y) > 1.3) continue;
      if (p.def.interact.onUse) { if (p.def.interact.onUse(this, p, f) !== false) return; continue; }
      const need = p.o.key || p.def.interact.key;
      if (p.o.requiresExit && !this.exitOpen) { this.toast(p.o.lockedMsg || 'LOCKED. DEAL WITH THE BOSS FIRST.'); return; }
      if (need && !this.game.keys.has(need)) { this.toast(p.o.lockedMsg || `LOCKED - NEED ${need === 'ticket' ? 'A TICKET' : 'A KEY'}`); this.sfx('locked', f); return; }
      p.open = true;
      this.rebuildPropGrid();
      this.sfx('door', f);
      this.toast(p.o.openMsg || 'OPENED!');
      if (p.o.onOpen) p.o.onOpen(this, p);
      return;
    }
    // 2. items needing USE
    let best = null, bd = 1.0;
    for (const it of this.items) {
      if (it.removed || !it.def || it.def.auto || it.def.noUse || it.pickDelay > 0) continue;
      const d = Math.hypot(it.x - f.x, it.y - f.y);
      if (d < bd) { bd = d; best = it; }
    }
    if (best) {
      if (best.def.kind === 'weapon') { this.pickupWeapon(f, best); this.toast(best.def.name); return; }
      if (best.def.kind === 'fanzine') {
        best.removed = true;
        this.readText = { title: best.data.title || 'FANZINE', text: best.data.text || 'NOTHING BUT TERRACE GOSSIP.', t: 0 };
        this.addScore(best.def.score, best.x, best.y, 0);
        this.sfx('pickup', f);
        return;
      }
      this.collect(best);
      return;
    }
    // 3. props that give weapons
    for (const p of this.props) {
      if (p.removed || !(p.def.pickup || (p.def.pickupFromOpts && p.o.item))) continue;
      if (Math.hypot(p.cx - f.x, p.cy - f.y) > 1.1) continue;
      const id = p.def.pickupFromOpts ? p.o.item : p.def.pickup;
      if (f.weapon) this.dropWeapon(f);
      f.weapon = { def: ITEMS[id], durability: ITEMS[id].weapon.durability };
      if (!p.o.infinite) p.removed = true;
      this.rebuildPropGrid();
      f.setState('pickup');
      this.sfx('pickupWeapon', f);
      this.toast(ITEMS[id].name);
      return;
    }
    // 4. drop weapon
    if (f.weapon) { this.dropWeapon(f); return; }
    // 5. nothing else to use: character-specific (Big Al: top off)
    if (f.onUse) f.onUse(this, 'last');
  }

  useItemSlot(i) {
    const p = this.player;
    const slot = this.game.inventory[i];
    if (!slot) return;
    const def = ITEMS[slot.id];
    if (!def) return;
    if (def.kind === 'boost') {                       // BAG OF CHARLIE: rush, then comedown
      if (buffLeft(p, 'rush') || buffLeft(p, 'crash')) { this.toast('STILL BUZZING FROM THE LAST ONE'); return; }
      this.game.takeItem(i);
      p.setState('drink'); p.vx = p.vy = 0;
      p.onAction = () => {
        applyBuff(p, 'rush', RUSH, 20, f => {
          applyBuff(f, 'crash', CRASH, 10);
          if (f.alive) { this.fx.popup(f.x, f.y, f.z, 'COMEDOWN...', '#8a8aa0'); if (f.say) f.say('...NEED A SIT DOWN', 1.4); }
        });
        this.fx.popup(p.x, p.y, p.z, 'BUZZING!', '#ffffff');
        if (p.say) p.say(['COME ON THEN!', 'I\'M FLYING!', 'WHO WANTS IT?!'][Math.floor(Math.random() * 3)], 1.4);
        if (save.data.settings.shake) this.camera.shake(3, 0.3);
      };
      this.sfx('combo', p);
      return;
    }
    if (def.kind === 'gear') {                        // GUM SHIELD: in for the rest of the level
      if (p.gumShield) { this.toast('GUM SHIELD\'S ALREADY IN'); return; }
      this.game.takeItem(i);
      p.gumShield = true;
      this.fx.popup(p.x, p.y, p.z, 'GUM SHIELD IN', '#5a8af0');
      this.sfx('pickup', p);
      return;
    }
    if (def.heal && p.hp >= p.maxHp) { this.toast('ALREADY FIGHTING FIT'); return; }
    this.game.takeItem(i);
    p.setState('drink');
    p.vx = p.vy = 0;
    p.onAction = () => { p.heal(def.heal || 0); this.fx.popup(p.x, p.y, p.z, '+' + (def.heal || 0), '#5aff7a'); };
    this.sfx(slot.id === 'pint' ? 'drink' : 'eat', p);
  }

  collect(it) {
    const d = it.def, g = this.game, p = this.player;
    if (!d) { it.removed = true; return; }
    switch (d.kind) {
      case 'boost': case 'gear':
        if (g.addItem(d.id)) { this.toast('+ ' + d.name); this.sfx('pickup', p); } else return;   // kit bag full: leave it
        break;
      case 'heal':
        if (d.stash && g.addItem(d.id)) { this.toast('+ ' + d.name); this.sfx('pickup', p); }
        else if (p.hp < p.maxHp) { p.heal(d.heal); this.fx.popup(p.x, p.y, p.z, '+' + d.heal, '#5aff7a'); this.sfx('heal', p); }
        else return; // leave it
        break;
      case 'cash':
        g.cash += d.cash; this.sfx('coin', p);
        this.fx.popup(it.x, it.y, it.z, '£' + d.cash, '#7aff9a');
        break;
      case 'scarf': {
        const idx = it.data.idx ?? 0;
        this.record.scarves.add(idx);
        this.stats.scarves++;
        this.toast(`LOST SCARF ${this.record.scarves.size}/${this.totalScarves}`);
        this.sfx('scarf', p);
        this.fx.confetti(it.x, it.y, 0, ['#c8102e', '#f4f1e8'], 14);
        break;
      }
      case 'badge':
        this.record.badge = true;
        this.toast('PIN BADGE FOUND!');
        this.banner = { text: 'PIN BADGE', sub: 'A RARE ONE FOR THE COLLECTION', t: 0, dur: 2.2, color: '#d4af37' };
        this.sfx('secret', p);
        break;
      case 'key': {
        const k = it.data.keyId || d.keyId || 'key';
        g.keys.add(k);
        this.toast(d.id === 'ticket' ? 'GOT A MATCH TICKET' : 'GOT A KEY');
        this.sfx('key', p);
        break;
      }
      case 'life':
        g.lives++; this.toast('EXTRA LIFE!'); this.sfx('life', p);
        break;
      default: break;
    }
    this.stats.items++;
    if (d.score) this.addScore(d.score, it.x, it.y, it.z, false);
    it.removed = true;
  }

  // ================================================================== combat callbacks
  onHit(att, t, def, res, dmg) {
    if (res === 'miss' || res === 'none') return;
    const hz = (def && def.hz) ?? 1.3;
    const px = t.x - (t.x - att.x) * 0.3, py = t.y - (t.y - att.y) * 0.3, pz = t.z + hz;
    if (res === 'blocked') { this.fx.block(px, py, pz); this.sfx('block', t); this.hitstop = Math.max(this.hitstop, 0.03); return; }
    if (res === 'guardbreak') { this.fx.impact(px, py, pz, true); this.camera.shake(3, 0.2); this.hitstop = Math.max(this.hitstop, 0.08); if (t.isPlayer) this.toast('GUARD BROKEN!'); return; }
    const heavy = dmg >= 10 || (def && def.knockdown);
    this.fx.impact(px, py, pz, heavy);
    this.sfx((def && def.sfx) || 'punch', t);
    if (t.isPlayer) this.sfx('hurtPlayer', t); else if (Math.random() < 0.5 || heavy) this.sfx('grunt', t);
    this.hitstop = Math.max(this.hitstop, (def && def.hitstop) || 0.035);
    if (def && def.shake && save.data.settings.shake) this.camera.shake(def.shake, 0.18);
    if (heavy && save.data.settings.shake && this.camera.kick) { const sx = (t.x - (att.x ?? t.x)) - (t.y - (att.y ?? t.y)); this.camera.kick(Math.sign(sx) * 2, 1); }
    if (att && att.isPlayer) {
      this.combo.count++; this.combo.t = 1.7;
      this.stats.hits++;
      if (this.combo.count > this.stats.maxCombo) this.stats.maxCombo = this.combo.count;
      const sc = Math.round(((def && def.score) || 10) * (1 + 0.15 * (this.combo.count - 1)));
      this.addScore(sc, t.x, t.y, t.z, false);
      this.lastEnemy = t; this.lastEnemyT = 3;
      if (this.combo.count > 0 && this.combo.count % 5 === 0) this.sfx('combo', att);
    }
    if (t.isPlayer) {
      this.stats.damageTaken += dmg * t.defense;
      this.combo.count = 0;
      if (save.data.settings.shake) this.camera.shake(2, 0.12);
    }
    if (res === 'ko' && att && att.winLine && att.say && def && (def.choke || def.chokeLift || (att.grabCfg && att.grabCfg.choke))) att.say(att.winLine, 2.2);
    if (this.firm) this.firm.onHit(att, t, dmg, res);
    if (res === 'ko' && t.team !== 'player') {
      this.slowmo = t.boss ? 1.4 : 0.12;
      this.sfx(t.boss ? 'bossKO' : 'ko', t);
    }
  }

  onDeath(f) {
    this.releaseToken(f);
    if (f.isPlayer) { this.deathT = 0; this.sfx('playerDown', f); return; }
    if (this.firm) this.firm.onDeath(f);
    const by = f.lastAttacker;
    if (by && by.koLines && by.alive && by.say && Math.random() < 0.45) by.say(by.koLines[Math.floor(Math.random() * by.koLines.length)], 1.3);
    if (f.isLad) { if (f.weapon) this.dropWeapon(f); return; }
    this.stats.kos++;
    this.addScore(f.scoreValue, f.x, f.y, f.z + 0.5, true);
    const def = ENEMIES[f.type];
    const drops = (def && def.drops) || [['coin', 0.35], ['pint', 0.08]];
    for (const [id, ch] of drops) if (Math.random() < ch) this.spawnItem(id, f.x, f.y, 0.5, { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: 4, life: id === 'coin' || id === 'cash5' ? 14 : 20, pickDelay: 0.3 });
    if (f.weapon) this.dropWeapon(f);
    if (def && def.onDeath) def.onDeath(f, this);
    if (f.boss && f === this.boss) this.bossDefeated(f);
  }

  // the player's catchphrase when a fight is won (Fat Vic: "VILL DU DÖ ELLER?")
  sayWinLine() {
    const p = this.player;
    if (p && p.alive && p.winLine && p.say) p.say(p.winLine, 2.6);
  }

  bossDefeated(f) {
    this.sayWinLine();
    // level.onBossDefeated may return false to veto the default handling (multi-stage / twin bosses)
    if (this.level.onBossDefeated && this.level.onBossDefeated(this, f) === false) {
      this.addScore(5000, f.x, f.y, f.z + 1, true);
      return;
    }
    this.exitOpen = true;
    this.banner = { text: 'BOSS DOWN!', sub: (f.name || '') + ' HAS HAD ENOUGH', t: 0, dur: 3, color: '#ffe14a' };
    audio.setBoss(false);
    audio.sfx('crowdCheer');
    this.addScore(5000, f.x, f.y, f.z + 1, true);
    for (const e of this.fighters) if (e.team !== 'player' && e.alive && e !== f) { e.controller && (e.controller.fleeT = 99); }
    this.goArrow = this.exit ? { x: this.exit.x + this.exit.w / 2, y: this.exit.y + this.exit.h / 2 } : null;
    this.lock = null;
  }

  onThrowLand(f, dmg) {
    if (f.thrower && f.thrower.isPlayer) this.addScore(60, f.x, f.y, f.z, false);
  }

  breakPropsAt(x, y, z, by, dmg) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!this.map.inBounds(tx, ty)) return false;
    const p = this.propAt[ty * this.map.w + tx];
    if (!p || !p.def.breakable || p.removed || z > p.h + 0.2) return false;
    this.damageProp(p, dmg, by);
    return true;
  }

  damageProp(p, dmg, by) {
    const b = p.def.breakable;
    if (!b || p.removed) return;
    p.hp -= dmg;
    p.flash = 0.08;
    this.sfx(b.sfx || 'wood', p.cx !== undefined ? { x: p.cx, y: p.cy } : p);
    if (p.hp <= 0) {
      p.removed = true;
      this.fx.debris(p.cx, p.cy, 0.3, b.debris || ['#7a5a3a'], 14);
      if (b.sfx === 'glass') this.fx.glass(p.cx, p.cy, 0.6);
      for (const [id, ch] of b.drops || []) if (Math.random() < ch) this.spawnItem(id, p.cx, p.cy, 0.6, { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: 4, pickDelay: 0.2 });
      if (b.leaves) { const lp = this.addProp({ type: b.leaves, x: p.x, y: p.y }); lp.brokenBy = by; }
      p.brokenBy = by;
      if (b.score && by && by.isPlayer) this.addScore(b.score, p.cx, p.cy, 0.5, false);
      if (p.o.secret) this.revealSecret(p.o.secret, p.cx, p.cy);
      if (p.o.onBreak) p.o.onBreak(this, p);
      this.rebuildPropGrid();
    }
  }

  // ================================================================== messages & score
  addScore(n, x, y, z, popup = true) {
    n = Math.round(n);
    this.game.score += n;
    if (popup && x !== undefined) this.fx.popup(x, y, z || 0, String(n), '#ffe14a');
  }
  toast(text) {
    this.toasts.push({ text, t: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
  }
  message(text, sub = '', dur = 2.5, color = '#ffffff') { this.banner = { text, sub, t: 0, dur, color }; }
  sfx(name, e) {
    let pan = 0, vol = 1;
    if (e && this.player && e.x !== undefined) {
      const s = toScreen(e.x, e.y, 0), c = this.camera;
      pan = Math.max(-1, Math.min(1, (s.x - c.x) / (VIEW_W * 0.6)));
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      vol = Math.max(0.15, 1 - d / 16);
    }
    audio.sfx(name, { pan, vol });
  }

  revealSecret(id, x, y) {
    const s = this.secrets.find(s => s.id === id);
    if (s && !s.found) this.foundSecret(s);
    else if (!s) { this.banner = { text: 'SECRET FOUND!', sub: '', t: 0, dur: 2, color: '#7affe0' }; this.sfx('secret', this.player); }
  }

  foundSecret(s) {
    s.found = true;
    this.record.secrets.add(s.id);
    this.stats.secrets++;
    this.addScore(s.score || 1000, this.player.x, this.player.y, 1, true);
    this.banner = { text: 'SECRET FOUND!', sub: s.msg || '', t: 0, dur: 2.4, color: '#7affe0' };
    this.sfx('secret', this.player);
  }

  // ================================================================== update
  update(dt) {
    if (this.readText) { this.readText.t += dt; return; }
    this.time += dt;
    this.updateUI(dt);
    if (this.hitstop > 0) { this.hitstop -= dt; this.fx.update(dt * 0.2); return; }
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.35; }
    this.stats.time += dt;
    const p = this.player;

    // AI flow field
    this.flowT -= dt;
    if (this.flowT <= 0) { this.flowT = 0.3; this.computeFlow(); }

    // controllers
    for (const f of this.fighters) if (f.controller && !f.removed) f.controller.update(f, this, dt);
    // fighters
    for (const f of this.fighters) {
      if (f.removed) continue;
      tickBuffs(f, dt);
      f.combat = f.isPlayer ? this.enemiesNear(f, 4.5) : f.combat;
      const prevPhase = f.attack ? f.attack.phase : -1;
      const prevAtk = f.attack;
      f.update(this, dt);
      // attack phase hooks (def.onPhase(f, world, phase)), e.g. Big Al's strip; per-fighter tick (f.onTick)
      if (f.attack && f.attack.def.onPhase && (f.attack !== prevAtk || f.attack.phase !== prevPhase)) f.attack.def.onPhase(f, this, f.attack.phase);
      if (f.onTick) f.onTick(this, dt);
      if (f.state === 'attack' && f.attack && f.attack.def.spawnProjectile && prevPhase === 0 && f.attack.phase >= 1) {
        const th = f.data.throwing;
        if (th) { // player weapon throw
          this.spawnProjectile(f, th.type, f.x + f.fx * 6, f.y + f.fy * 6, th.dmg).z = f.z + 1.3;
          f.data.throwing = null;
        } else {
          const tgt = f.isPlayer ? null : ((f.controller && f.controller.curTarget) || this.player);
          if (tgt) this.spawnProjectile(f, f.data.projectile || 'bottle', tgt.x, tgt.y, (ITEMS[f.data.projectile || 'bottle']?.weapon?.throwDmg || 10) * f.power);
        }
      }
      if (f.state === 'dead' && f.team !== 'player' && f.deadT > 2.2) f.removed = true;
    }
    this.separate();
    this.fighters = this.fighters.filter(f => !f.removed);
    for (const t of this.tokens) if (!t.alive || t.removed) this.tokens.delete(t);

    // projectiles & items & props
    for (const pr of this.projectiles) pr.update(this, dt);
    this.projectiles = this.projectiles.filter(p => !p.removed);
    for (const it of this.items) {
      it.update(this, dt);
      if (!it.removed && it.def && it.def.auto && it.pickDelay <= 0 && p.alive && Math.hypot(it.x - p.x, it.y - p.y) < 0.6 && Math.abs(it.z - p.z) < 1.2) this.collect(it);
    }
    this.items = this.items.filter(i => !i.removed);
    let propsChanged = false;
    for (const pr of this.props) { pr.update(dt); if (pr.def.update) pr.def.update(pr, this, dt); if (pr.removed) propsChanged = true; }
    for (const a of this.actors) if (a.update && !a.removed) a.update(this, dt);
    this.updatePropHazards();
    this.actors = this.actors.filter(a => !a.removed);
    if (propsChanged) { this.props = this.props.filter(p => !p.removed); this.lights = this.lights.filter(l => !l.prop || !l.prop.removed); }
    // player attacks break props
    for (const f of this.fighters) {
      if (f.state === 'attack' && f.attack && f.attack.phase === 1 && f.attack.def.dmg > 0 && !f.attack.propHit) {
        const reach = 0.9;
        const hx = f.x + f.fx * reach, hy = f.y + f.fy * reach;
        if (this.breakPropsAt(hx, hy, f.z, f, f.attack.def.weapon && f.weapon ? f.weapon.def.weapon.dmg : f.attack.def.dmg * f.power)) f.attack.propHit = true;
      }
    }

    this.updateHazards(dt);
    this.updateEncounters(dt);
    if (this.firm) this.firm.update(dt);
    this.updateTriggers(dt);
    if (this.level.onUpdate) this.level.onUpdate(this, dt);

    // combo timer
    if (this.combo.t > 0) { this.combo.t -= dt; if (this.combo.t <= 0) this.combo.count = 0; }
    if (this.lastEnemyT > 0) this.lastEnemyT -= dt;

    // player death / respawn
    if (this.deathT >= 0) {
      this.deathT += dt;
      if (this.deathT > 1.8) {
        this.deathT = -1;
        if (this.game.lives > 0) { this.game.lives--; this.respawnPlayer(); }
        else this.cb.onGameOver && this.cb.onGameOver();
      }
    }

    // exit
    if (this.exitOpen && this.exit && p.alive && this.completeT < 0) {
      const e = this.exit;
      if (p.x >= e.x && p.y >= e.y && p.x <= e.x + e.w && p.y <= e.y + e.h) {
        this.completeT = 0;
        p.controller.enabled = false;
        p.setState('victory');
        this.sayWinLine();
        audio.sfx('levelComplete');
      }
    }
    if (this.completeT >= 0) {
      this.completeT += dt;
      if (this.completeT > 2.0 && !this.completeFired) { this.completeFired = true; this.cb.onComplete && this.cb.onComplete(this.stats); }
    }

    // camera
    const look = 14;
    this.camera.follow(p.x, p.y, p.z, dt, (p.fx - p.fy) * look, (p.fx + p.fy) * look * 0.5);
    this.fx.update(dt);
    this.updateWeather(dt);
  }

  // props with def.hazard = { dmg, kb, knockdown, interval, sfx, height } hurt fighters standing on/against them
  updatePropHazards() {
    for (const p of this.props) {
      const hz = p.def.hazard;
      if (!hz || p.removed || p.open || (p.o.hazardActive && !p.o.hazardActive(this, p))) continue;
      for (const f of this.fighters) {
        if (!f.alive || f.invuln > 0 || f.z > (hz.height ?? (p.h + 0.4))) continue;
        if (f.x < p.x - f.r || f.y < p.y - f.r || f.x > p.x + p.w + f.r || f.y > p.y + p.d + f.r) continue;
        const key = '_ph' + p.id;
        if ((f.data[key] || 0) > this.time) continue;
        f.data[key] = this.time + (hz.interval || 0.7);
        const dx = f.x - p.cx, dy = f.y - p.cy, d = Math.hypot(dx, dy) || 1;
        const dmg = (hz.dmg || 8) * (f.isPlayer ? this.diff.dmg : 1);
        const def = { hz: 0.6, sfx: hz.sfx || 'hitHeavy' };
        const res = f.takeHit({ attacker: null, def, dmg, dir: { x: dx / d, y: dy / d }, kb: hz.kb ?? 3, stun: 0.4, knockdown: !!hz.knockdown, launch: 1, unblockable: true, guardDmg: 0 }, this);
        this.onHit({ x: p.cx, y: p.cy, z: 0 }, f, def, res, dmg);
      }
    }
  }

  enemiesNear(f, r) {
    for (const o of this.fighters) if (o.team !== f.team && o.alive && Math.hypot(o.x - f.x, o.y - f.y) < r) return true;
    return false;
  }

  separate() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (!a.alive || a.isDown || a.state === 'grabbed' || a.state === 'thrown' || a.noclip) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        if (!b.alive || b.isDown || b.state === 'grabbed' || b.state === 'thrown' || b.noclip) continue;
        if (a.grabbing === b || b.grabbing === a) continue;
        if (Math.abs(a.z - b.z) > 1) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
        if (d < min && d > 1e-4) {
          const push = (min - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          const wa = a.isPlayer ? 0.35 : 0.5, wb = b.isPlayer ? 0.35 : 0.5;
          this.moveEntity(a, -nx * push * wa * 2, -ny * push * wa * 2);
          this.moveEntity(b, nx * push * wb * 2, ny * push * wb * 2);
        }
      }
    }
  }

  respawnPlayer() {
    const p = this.player;
    p.alive = true; p.dying = false; p.hp = p.maxHp; p.removed = false;
    p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.z = 0; p.vx = p.vy = p.vz = 0;
    p.setState('idle'); p.invuln = 2.5;
    p.controller.enabled = true;
    this.message('GET UP!', `${this.game.lives} LIVES LEFT`, 1.6, '#ff6a5a');
    if (this.firm) this.firm.onRespawn();
    for (const f of this.fighters) if (f.team !== 'player' && f.alive && Math.hypot(f.x - p.x, f.y - p.y) < 2.5) {
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
      f.knockDown({ x: dx / d, y: dy / d }, 4, 1);
    }
    this.sfx('respawn', p);
  }

  updateEncounters(dt) {
    const p = this.player;
    for (const e of this.encounters) {
      if (e.state === 'cleared') continue;
      if (e.state === 'waiting') {
        const a = e.area || e.trigger;
        if (e.requires && !e.requires(this)) continue;
        if (a && p.x >= a.x && p.y >= a.y && p.x <= a.x + a.w && p.y <= a.y + a.h) this.startEncounter(e);
        continue;
      }
      // active
      e.waveT += dt;
      const alive = e.spawned.filter(f => f.alive && !f.removed);
      const wave = e.waves[e.wave];
      const nextAt = wave && wave.nextAt !== undefined ? wave.nextAt : 0;
      const timed = wave && wave.next !== undefined && e.waveT > wave.next;
      for (const pend of e.pending || []) {
        if (!pend.done && e.waveT >= pend.delay) { pend.done = true; const f = this.spawnEnemy(pend.type, pend.x, pend.y, { ...pend, aggro: true }); if (f) e.spawned.push(f); }
      }
      const pendingLeft = (e.pending || []).some(q => !q.done);
      if (!pendingLeft && (alive.length <= nextAt || timed)) {
        if (e.wave + 1 < e.waves.length) this.spawnWave(e, e.wave + 1);
        else if (alive.length === 0) this.clearEncounter(e);
      }
    }
  }

  startEncounter(e) {
    e.state = 'active';
    if (e.lock !== false) this.lock = e.lockArea || e.area;
    if (e.msg) this.message(e.msg, e.sub || '', 2.2, e.boss ? '#ff4a4a' : '#ffffff');
    if (e.boss) {
      audio.setBoss(true);
      const name = (ENEMIES[e.type] && ENEMIES[e.type].name) || e.type;
      this.banner = { text: e.title || name, sub: e.intro || 'BOSS FIGHT', t: 0, dur: 2.6, color: '#ff3a3a', boss: true };
      this.sfx('bossIntro', this.player);
    } else this.sfx('encounter', this.player);
    if (e.crowd !== undefined && audio.crowd) audio.crowd(e.crowd);
    this.spawnWave(e, 0);
    this.goArrow = null;
  }

  spawnWave(e, i) {
    e.wave = i; e.waveT = 0;
    const w = e.waves[i];
    e.pending = [];
    for (const s of w.enemies || []) {
      if (s.delay) { e.pending.push({ ...s, done: false }); continue; }
      const f = this.spawnEnemy(s.type, s.x, s.y, { ...s, aggro: true });
      if (f) e.spawned.push(f);
    }
    if (w.msg) this.message(w.msg, '', 1.6);
  }

  clearEncounter(e) {
    e.state = 'cleared';
    this.sayWinLine();
    if (this.firm) this.firm.onClear();
    if (this.lock === (e.lockArea || e.area)) this.lock = null;
    if (e.checkpoint !== false && e.area) this.checkpoint = { x: e.area.x + e.area.w / 2, y: e.area.y + e.area.h / 2 };
    if (!e.boss) {
      this.message(e.clearMsg || 'GO!', '', 1.4, '#ffe14a');
      this.sfx('clear', this.player);
      const next = this.encounters.find(o => o.state === 'waiting');
      const tgt = e.goTo || (next && (next.area || next.trigger)) || this.exit;
      if (tgt) this.goArrow = { x: tgt.x + (tgt.w || 0) / 2, y: tgt.y + (tgt.h || 0) / 2 };
    }
    if (this.level.onEncounterClear) this.level.onEncounterClear(this, e);
  }

  updateTriggers(dt) {
    const p = this.player;
    const inA = a => p.x >= a.x && p.y >= a.y && p.x <= a.x + a.w && p.y <= a.y + a.h;
    for (const s of this.secrets) if (!s.found && s.area !== false && s.w && inA(s)) this.foundSecret(s);
    for (const t of this.triggers) {
      if (t.fired && t.once !== false) continue;
      if (t.area && inA(t.area)) {
        if (t.fired && t.once === false && t.inside) continue;
        t.fired = true; t.inside = true;
        if (t.msg) this.message(t.msg, t.sub || '', t.dur || 2.2, t.color || '#ffffff');
        if (t.toast) this.toast(t.toast);
        if (t.action) t.action(this, t);
      } else if (t.area) t.inside = false;
    }
    if (this.goArrow && Math.hypot(this.goArrow.x - p.x, this.goArrow.y - p.y) < 2.5 && !this.exitOpen) this.goArrow = null;
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      if (h.type === 'traffic') {
        if (h.active && !h.active(this)) continue;
        if (h.manual && !h.fire) continue;
        h.fire = false;
        h.t -= dt;
        if (h.t <= 0) {
          const iv = h.interval || [4, 8];
          h.t = iv[0] + Math.random() * (iv[1] - iv[0]);
          const [a, b] = h.lane;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
          this.vehicles.push({ kind: 'vehicle', def: h, x: a.x, y: a.y, dx: dx / len, dy: dy / len, len, dist: 0, speed: h.speed || 8, color: h.colors ? h.colors[Math.floor(Math.random() * h.colors.length)] : ['#8a2020', '#203a8a', '#d8d8d0', '#2a6a3a', '#d8b020'][Math.floor(Math.random() * 5)], style: h.vehicle || h.vehicleStyle || 'car', hit: new Set(), honk: false, dmg: h.dmg || 22 });
          if (h.mix) {   // mixed stream: { style, colors, weight, dmg }
            const tot = h.mix.reduce((n, m) => n + (m.weight || 1), 0);
            let r = Math.random() * tot, m = h.mix[0];
            for (const q of h.mix) { r -= q.weight || 1; if (r <= 0) { m = q; break; } }
            const v = this.vehicles[this.vehicles.length - 1];
            v.style = v.vstyle = m.style; v.color = m.colors[Math.floor(Math.random() * m.colors.length)]; if (m.dmg) v.dmg = m.dmg;
          }
        }
      } else if (h.type === 'zone') {
        h.timer -= dt;
        if (h.active && !h.active(this)) continue;
        if (h.timer <= 0) {
          h.timer = h.interval || 0.5;
          const a = h.area;
          for (const f of this.fighters) {
            if (!f.alive || f.invuln > 0 || f.z > (h.height ?? 0.3)) continue;
            if (f.x >= a.x && f.y >= a.y && f.x <= a.x + a.w && f.y <= a.y + a.h) {
              const cdKey = '_zone' + this.hazards.indexOf(h);
              if ((f.data[cdKey] || 0) > this.time) continue;
              f.data[cdKey] = this.time + Math.max(0.6, h.interval || 0.5);
              const zd = (h.dmg || 8) * (f.isPlayer ? this.diff.dmg : 1);
              const res = f.takeHit({ attacker: null, def: { hz: 0.5, sfx: h.sfx || 'zap' }, dmg: zd, dir: { x: -f.fx, y: -f.fy }, kb: h.kb || 2, stun: 0.4, knockdown: !!h.knockdown, launch: 1, unblockable: true, guardDmg: 0 }, this);
              this.onHit({ x: f.x, y: f.y }, f, { hz: 0.5, sfx: h.sfx || 'zap' }, res, h.dmg || 8);
              if (h.fx === 'zap') this.fx.spark(f.x, f.y, 0.4, '#8ae0ff', 12);
            }
          }
        }
      }
    }
    for (const v of this.vehicles) {
      v.dist += v.speed * dt;
      v.x += v.dx * v.speed * dt; v.y += v.dy * v.speed * dt;
      if (v.dist > v.len) v.removed = true;
      const p = this.player;
      if (!v.honk && Math.hypot(p.x - v.x, p.y - v.y) < 6) { v.honk = true; this.sfx('horn', v); }
      for (const f of this.fighters) {
        if (!f.alive || v.hit.has(f) || f.z > 0.9 || f.invuln > 0) continue;
        const rx = f.x - v.x, ry = f.y - v.y;
        const along = rx * v.dx + ry * v.dy, across = Math.abs(-rx * v.dy + ry * v.dx);
        const vs = VEHICLE_SIZE[v.style] || VEHICLE_SIZE.car;
        const hl = v.def.halfLen ?? vs.hl, hw = v.def.halfWidth ?? vs.hw;
        if (along > -hl && along < hl && across < hw + f.r) {
          v.hit.add(f);
          const res = f.takeHit({ attacker: null, def: { hz: 1, sfx: 'carHit' }, dmg: v.dmg, dir: { x: v.dx * 0.6 + (-v.dy) * Math.sign(-rx * v.dy + ry * v.dx || 1) * 0.8, y: v.dy * 0.6 + v.dx * Math.sign(-rx * v.dy + ry * v.dx || 1) * 0.8 }, kb: 7, stun: 0.6, knockdown: true, launch: 5, unblockable: true, guardDmg: 0 }, this);
          this.onHit({ x: v.x, y: v.y }, f, { hz: 1, sfx: 'carHit', shake: 6, hitstop: 0.08 }, res, v.dmg);
          if (f.team !== 'player' && this.player) this.addScore(150, f.x, f.y, 1, true);
        }
      }
    }
    this.vehicles = this.vehicles.filter(v => !v.removed);
  }

  updateUI(dt) {
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < 2.4);
  }

  updateWeather(dt) {
    const w = this.level.weather;
    if (w !== 'snow') return;                  // rain is off everywhere (owner's call: it got on your nerves); snow stays
    const target = w === 'rain' ? 160 : 90;
    while (this.rain.length < target) this.rain.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 0.6 + Math.random() * 0.6 });
    for (const r of this.rain) {
      if (w === 'rain') { r.y += 420 * r.s * dt; r.x -= 90 * r.s * dt; }
      else { r.y += 30 * r.s * dt; r.x += Math.sin(this.time * 2 + r.s * 10) * 12 * dt; }
      if (r.y > VIEW_H) { r.y -= VIEW_H + 10; r.x = Math.random() * (VIEW_W + 60); }
      if (r.x < -10) r.x += VIEW_W + 20;
    }
  }

  // ================================================================== draw
  draw(ctx) {
    const cam = this.camera;
    ctx.fillStyle = this.level.bg || '#07060c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(cam.tx, cam.ty);
    const vx0 = cam.x - VIEW_W / 2 - 40, vx1 = cam.x + VIEW_W / 2 + 40, vy0 = cam.y - VIEW_H / 2 - 40, vy1 = cam.y + VIEW_H / 2 + 260;

    // ground
    const fl = this.floor;
    ctx.drawImage(fl.canvas, -fl.ox, -fl.oy, fl.w, fl.h);
    if (this.level.drawGround) this.level.drawGround(ctx, this);
    this.fx.drawGround(ctx);

    // drawables
    const p = this.player;
    const pd = p.x + p.y;
    const pb = p.screenBox();
    const list = [];
    for (const w of this.walls) {
      if (w.sx < vx0 || w.sx > vx1 || w.sy < vy0 || w.sy - w.w.h * Z_PX > vy1) continue;
      list.push({ d: w.depth, z: 0, wall: w });
    }
    for (const pr of this.props) {
      const s = toScreen(pr.cx, pr.cy);
      if (s.x < vx0 - 40 || s.x > vx1 + 40 || s.y < vy0 || s.y > vy1) continue;
      // long props with a Blender sprite (vehicles, lorries...) are drawn as 1-tile slices so they sort correctly
      const spr = (pr.w > 1 || pr.d > 1) && !pr.open && !pr.o.noSprite && !pr.def.noSlice ? envProp(pr.type, pr.def.rotates ? { ...pr.o, dir: pr.dir } : pr.o) : null;
      if (spr) {
        const alongX = pr.w >= pr.d, n = alongX ? pr.w : pr.d;
        for (let i = 0; i < n; i++) {
          const d = alongX ? (pr.x + i + 0.5) + (pr.y + pr.d / 2) : (pr.x + pr.w / 2) + (pr.y + i + 0.5);
          list.push({ d: d + (pr.def.depthBias || 0) + (pr.o.depthBias || 0), z: 0, slice: { p: pr, spr, i, n, alongX } });
        }
        continue;
      }
      list.push({ d: pr.depth(), z: 0, e: pr });
    }
    for (const f of this.fighters) list.push({ d: f.x + f.y + (f.isDown ? -0.15 : 0), z: f.z, e: f });
    for (const it of this.items) list.push({ d: it.x + it.y, z: it.z, e: it });
    for (const pr of this.projectiles) list.push({ d: pr.x + pr.y, z: pr.z, e: pr });
    for (const v of this.vehicles) {
      const sz = VEHICLE_SIZE[v.style] || VEHICLE_SIZE.car;
      const alongX = Math.abs(v.dx) > Math.abs(v.dy);
      const n = Math.ceil(sz.L);
      for (let i = 0; i < n; i++) {
        const t = -sz.L / 2 + i + 0.5;
        list.push({ d: alongX ? (v.x + t) + v.y : v.x + (v.y + t), z: 0, veh: v, vs: { i, n, alongX, L: sz.L, W: sz.W } });
      }
    }
    for (const a of this.actors) {
      if (!a.draw) continue;
      if (!a.noCull) { const s = toScreen(a.x, a.y, 0); if (s.x < vx0 - 120 || s.x > vx1 + 120 || s.y < vy0 - 60 || s.y > vy1 + 60) continue; }
      list.push({ d: a.depth ? a.depth() : a.x + a.y, z: a.z || 0, e: a });
    }
    list.sort((a, b) => a.d - b.d || a.z - b.z);

    for (const o of list) {
      if (o.wall) {
        const w = o.wall;
        let alpha = 1;
        if (w.w.fake && Math.hypot(w.tx + 0.5 - p.x, w.ty + 0.5 - p.y) < 2.2) alpha = 0.45;
        else if (w.w.h - (p.z || 0) >= 1.4 && w.depth > pd + 0.6) {
          const x0 = w.sx - HALF_W, x1 = w.sx + HALF_W, y0 = w.sy - w.w.h * Z_PX, y1 = w.sy + HALF_H * 2;
          if (x1 > pb.x0 && x0 < pb.x1 && y1 > pb.y0 + 4 && y0 < pb.y1) alpha = 0.42;
        }
        drawWallBlock(ctx, w.w.style, w.w.h, w.w.variant, w.sx, w.sy, alpha);
      } else if (o.slice) this.drawPropSlice(ctx, o.slice);
      else if (o.veh) {
        // vehicle slice: clip to the prism above this 1-tile section of its footprint, draw the whole vehicle
        const v = o.veh, q = o.vs;
        const x0 = q.alongX ? v.x - q.L / 2 + q.i : v.x - q.W / 2, y0 = q.alongX ? v.y - q.W / 2 : v.y - q.L / 2 + q.i;
        const w = q.alongX ? 1 : q.W, d = q.alongX ? q.W : 1;
        ctx.save(); clipPrism(ctx, x0 - (q.i === 0 && q.alongX ? 2 : 0), y0 - (q.i === 0 && !q.alongX ? 2 : 0), w + (q.alongX && (q.i === 0 || q.i === q.n - 1) ? 2 : 0), d + (!q.alongX && (q.i === 0 || q.i === q.n - 1) ? 2 : 0), 8);
        if (q.i === q.n - 1) this.drawVehicle(ctx, v); else this.drawVehicle(ctx, v, true);
        ctx.restore();
      }
      else if (o.e.kind === 'prop') this.drawProp(ctx, o.e);
      else o.e.draw(ctx, this);
    }

    // player silhouette when hidden behind props/walls
    this.fx.draw(ctx);
    if (this.level.drawOverlay) this.level.drawOverlay(ctx, this);
    this.fx.drawPopups(ctx);
    this.drawGoArrow(ctx);
    ctx.restore();

    this.drawLighting(ctx);
    this.drawWeather(ctx);
    // overhead UI (speech bubbles, telegraph "!") above lighting so it stays readable in dark levels
    if (this.overheadQueue && this.overheadQueue.length) {
      ctx.save(); ctx.translate(cam.tx, cam.ty);
      for (const fn of this.overheadQueue) fn();
      ctx.restore();
      this.overheadQueue.length = 0;
    }
  }

  // 3D renderer mode: the scene itself is drawn by src/render3d; this paints the 2D layers that sit on top of it
  // (particles, popups, GO arrow, level overlays, custom actors, speech bubbles / telegraphs, weather), using the
  // same camera transform so everything lines up with the 3D view.
  drawOverlay3D(ctx) {
    const cam = this.camera;
    ctx.save();
    ctx.translate(cam.tx, cam.ty);
    for (const a of this.actors) if (a.draw && !a.removed) a.draw(ctx, this);
    this.fx.draw(ctx);
    if (this.level.drawOverlay) this.level.drawOverlay(ctx, this);
    this.fx.drawPopups(ctx);
    this.drawGoArrow(ctx);
    for (const f of this.fighters) {
      if (f.removed || !f.drawOverhead) continue;
      const s = toScreen(f.x, f.y, f.z), sc = (f.look && f.look.height) || 1;
      // 3D characters: dizzy stars come from here (billboard fighters paint their own)
      if (f._char3d && (f.state === 'dizzy' || (f.state === 'down' && f.hp > 0 && f.downTime > 1))) this.fx.drawStars(ctx, s.x, s.y - 50 * sc, this.time);
      f.drawOverhead(ctx, this, s, sc);
    }
    ctx.restore();
    this.drawWeather(ctx);
  }

  // Props use a Blender sprite when one exists for their type/variant (and they aren't open/animated specials).
  drawPropSlice(ctx, q) {
    const p = q.p, spr = q.spr;
    const a = toScreen(p.x, p.y, p.base);
    const x0 = q.alongX ? p.x + q.i : p.x, y0 = q.alongX ? p.y : p.y + q.i;
    const w = q.alongX ? 1 : p.w, d = q.alongX ? p.d : 1;
    // end slices also take the sprite's padding beyond the footprint (bumpers, mirrors, shadows)
    const ex0 = q.i === 0 ? 1.5 : 0, ex1 = q.i === q.n - 1 ? 1.5 : 0;
    ctx.save();
    clipPrism(ctx, q.alongX ? x0 - ex0 : x0 - 0.6, q.alongX ? y0 - 0.6 : y0 - ex0, q.alongX ? w + ex0 + ex1 : w + 1.2, q.alongX ? d + 1.2 : d + ex0 + ex1, 8, p.base);
    const prev = ctx.globalAlpha;
    if (p.flash > 0) ctx.globalAlpha = prev * 0.6;
    ctx.drawImage(spr.img, Math.round(a.x) - spr.ax / 2, Math.round(a.y) - spr.ay / 2, spr.img.width / 2, spr.img.height / 2);
    ctx.globalAlpha = prev;
    ctx.restore();
    if (q.i === q.n - 1 && p.def.overlay) p.def.overlay(ctx, Math.round(a.x), Math.round(a.y), p, p.t, this);
  }

  drawProp(ctx, p) {
    const spr = !p.open && !p.o.noSprite ? envProp(p.type, p.def.rotates ? { ...p.o, dir: p.dir } : p.o) : null;
    if (!spr) { p.draw(ctx, this); return; }
    const a = toScreen(p.x, p.y, p.base);
    const prev = ctx.globalAlpha;
    if (p.flash > 0) ctx.globalAlpha = prev * 0.6;
    ctx.drawImage(spr.img, Math.round(a.x) - spr.ax / 2, Math.round(a.y) - spr.ay / 2, spr.img.width / 2, spr.img.height / 2);
    ctx.globalAlpha = prev;
    if (p.def.overlay) p.def.overlay(ctx, Math.round(a.x), Math.round(a.y), p, p.t, this);
  }

  // Traffic: full-scale Blender vehicle sprites (scripts/blender/env_vehicles.py), drawn centred on the vehicle.
  // Sprite ids: car (coloured saloon), city_taxi, bus. Procedural boxes only if the sprites aren't built.
  drawVehicle(ctx, v, noLight = false) {
    if (v.def && v.def.draw) { const L = this.lightsDynamic ? this.lightsDynamic.length : 0; v.def.draw(ctx, v, this); if (noLight && this.lightsDynamic) this.lightsDynamic.length = L; return; }
    if (drawVehicleSprite(ctx, v, v.style)) {
      if (!noLight) this.addFrameLight({ x: v.x + v.dx * 3, y: v.y + v.dy * 3, z: 0.4, r: 4, color: '#fff0c0', intensity: 0.8 });
      return;
    }
    const sz = VEHICLE_SIZE[v.style] || VEHICLE_SIZE.car;
    const alongX = Math.abs(v.dx) > Math.abs(v.dy);
    const W = alongX ? sz.L : sz.W, D = alongX ? sz.W : sz.L;
    const a = toScreen(v.x - W / 2, v.y - D / 2, 0);
    const c = v.color, OL = '#120c14';
    isoBox(ctx, a.x, a.y, 0.05, 0.05, 0.25, W - 0.1, D - 0.1, sz.H * 0.5, { color: c, outline: OL });
    isoBox(ctx, a.x, a.y, alongX ? W * 0.25 : 0.15, alongX ? 0.15 : D * 0.25, 0.25 + sz.H * 0.5, alongX ? W * 0.45 : W - 0.3, alongX ? D - 0.3 : D * 0.45, sz.H * 0.4, { top: shade(c, 0.1), left: '#9ab8d0', right: '#6a88a0', outline: OL });
    this.addFrameLight({ x: v.x + v.dx * 3, y: v.y + v.dy * 3, z: 0.4, r: 4, color: '#fff0c0', intensity: 0.8 });
  }


  drawGoArrow(ctx) {
    if (!this.goArrow) return;
    const p = this.player;
    const dx = this.goArrow.x - p.x, dy = this.goArrow.y - p.y;
    const s = toScreen(dx, dy, 0);
    const l = Math.hypot(s.x, s.y) || 1;
    const ps = toScreen(p.x, p.y, p.z);
    const blink = Math.floor(this.time * 3) % 2 === 0;
    if (!blink) return;
    const ax = ps.x + s.x / l * 30, ay = ps.y - 20 + s.y / l * 22;
    const ang = Math.atan2(s.y, s.x);
    ctx.save();
    ctx.translate(Math.round(ax), Math.round(ay));
    ctx.rotate(ang);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    drawText(ctx, 'GO', ax, ay - 16, { color: '#ffe14a', align: 'center', outline: '#000' });
  }

  drawLighting(ctx) {
    const amb = this.ambientOverride || this.level.ambient;
    const dyn = this.lightsDynamic || [];
    this.lightsDynamic = [];
    if (!amb || !amb.dark) return;
    if (!this.lightCanvas) {
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = VIEW_W; this.lightCanvas.height = VIEW_H;
    }
    const lc = this.lightCanvas, g = lc.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle = rgba(amb.color || '#06071a', amb.dark);
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const cam = this.camera;
    const lights = [...this.lights, ...dyn];
    // player carries a faint personal light so the action stays readable
    lights.push({ x: this.player.x, y: this.player.y, z: 1, r: amb.playerLight ?? 3, intensity: 0.5, color: '#ffffff', noGlow: true });
    g.globalCompositeOperation = 'destination-out';
    const vis = [];
    for (const l of lights) {
      if (l.active === false) continue;
      const s = toScreen(l.x, l.y, 0);
      const x = s.x + cam.tx, y = s.y + cam.ty;
      const r = (l.r || 4) * HALF_W * 1.4;
      if (x < -r || x > VIEW_W + r || y < -r || y > VIEW_H + r) continue;
      let inten = l.intensity ?? 0.9;
      if (l.flicker) inten *= 0.75 + 0.25 * Math.sin(this.time * 23 + l.x * 3) * Math.sin(this.time * 7 + l.y);
      vis.push({ l, x, y, r, inten });
      g.save();
      g.translate(x, y);
      g.scale(1, 0.62);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(0,0,0,${inten})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${inten * 0.55})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
    ctx.drawImage(lc, 0, 0);
    // coloured glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const v of vis) {
      if (v.l.noGlow) continue;
      const lz = (v.l.z || 0) * Z_PX;
      const grad = ctx.createRadialGradient(v.x, v.y - lz * 0.5, 0, v.x, v.y - lz * 0.5, v.r * 0.7);
      grad.addColorStop(0, rgba(v.l.color || '#ffcf7a', 0.22 * v.inten));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(v.x - v.r, v.y - lz * 0.5 - v.r, v.r * 2, v.r * 2);
    }
    ctx.restore();
  }

  drawWeather(ctx) {
    const w = this.level.weather;
    if (w === 'snow') {
      ctx.fillStyle = 'rgba(240,240,255,0.8)';
      for (const r of this.rain) ctx.fillRect(Math.round(r.x), Math.round(r.y), r.s > 0.9 ? 2 : 1, r.s > 0.9 ? 2 : 1);
    }
    if (this.level.fog) {
      ctx.fillStyle = this.level.fog;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}
