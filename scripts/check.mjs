#!/usr/bin/env node
// Headless validator + simulator for THE LAST HOOLIGAN levels.
//
//   node scripts/check.mjs                 static checks for every level
//   node scripts/check.mjs pub             only the level with id 'pub'
//   node scripts/check.mjs pub --sim       + headless simulation: walks every encounter, runs real AI fights
//                                            (player invulnerable) and verifies the level can be completed
//   node scripts/check.mjs --sim           simulate all levels
//
// Exit code 1 if any ERROR was found.

// ---------------------------------------------------------------- minimal fake DOM (enough for World)
const noop = () => {};
function fakeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'canvas') return { width: 640, height: 360 };
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx(), style: {} }), getElementById: () => null };
globalThis.localStorage = { getItem: () => null, setItem: noop };
if (!globalThis.navigator) globalThis.navigator = { getGamepads: () => [] };
globalThis.addEventListener = noop;
globalThis.requestAnimationFrame = noop;

const args = process.argv.slice(2);
const SIM = args.includes('--sim');
const only = args.filter(a => !a.startsWith('--'));

await import('../src/content/index.js');
const { LEVELS } = await import('../src/content/levels/index.js');
const { TileMap } = await import('../src/engine/tilemap.js');
const { FLOORS, WALLS } = await import('../src/engine/tiles.js');
const { PROPS } = await import('../src/game/props.js');
const { ITEMS } = await import('../src/game/items.js');
const { ENEMIES } = await import('../src/content/enemies.js');
const { ATTACKS } = await import('../src/game/combat.js');
const { STEP_UP } = await import('../src/engine/constants.js');

let errors = 0, warnings = 0;
const err = (L, m) => { errors++; console.log(`  ERROR [${L.id}] ${m}`); };
const warn = (L, m) => { warnings++; console.log(`  warn  [${L.id}] ${m}`); };

function checkLevel(L) {
  console.log(`\n== Level ${L.num}: ${L.name} (${L.id})`);
  for (const k of ['id', 'num', 'name', 'map', 'legend']) if (L[k] === undefined) err(L, `missing field '${k}'`);
  if (!L.map) return;
  const widths = new Set(L.map.map(r => r.length));
  if (widths.size > 1) err(L, `map rows have different lengths: ${[...widths].join(',')}`);
  const used = new Set(L.map.join(''));
  for (const ch of used) if (ch !== ' ' && !L.legend[ch]) err(L, `map uses char '${ch}' missing from legend`);
  for (const [ch, e] of Object.entries(L.legend)) {
    const fl = e.floor === undefined ? (L.defaultFloor || 'asphalt') : e.floor;
    if (fl && !FLOORS[fl]) err(L, `legend '${ch}': unknown floor '${fl}'`);
    if (e.wall && !WALLS[e.wall]) err(L, `legend '${ch}': unknown wall '${e.wall}'`);
    const pt = e.prop && (typeof e.prop === 'string' ? e.prop : e.prop.type);
    if (pt && !PROPS[pt]) err(L, `legend '${ch}': unknown prop '${pt}'`);
    if (e.item && !ITEMS[e.item]) err(L, `legend '${ch}': unknown item '${e.item}'`);
  }
  const map = new TileMap(L);
  const W = map.w, H = map.h;
  // props (map + explicit)
  const props = [...map.propSpawns, ...(L.props || [])];
  const propH = new Float32Array(W * H);
  const gateTiles = new Set();
  for (const p of props) {
    const d = PROPS[p.type];
    if (!d) { err(L, `unknown prop '${p.type}' at ${p.x},${p.y}`); continue; }
    let w = p.w ?? d.w, dd = p.d ?? d.d;
    if (d.rotates && (p.dir ?? d.defaultDir ?? 'x') === 'y' && p.w === undefined && p.d === undefined) { const t = w; w = dd; dd = t; }
    const _unused = 0, h = (p.h ?? d.h) + ((p.h ?? d.h) > 0 ? (p.base || 0) : 0);
    const solid = (p.solid ?? d.solid) && h > 0;
    for (let y = p.y; y < p.y + dd; y++) for (let x = p.x; x < p.x + w; x++) {
      if (!map.inBounds(x, y)) { err(L, `prop '${p.type}' at ${p.x},${p.y} extends out of the map`); continue; }
      if (solid) { propH[y * W + x] = Math.max(propH[y * W + x], h); if (d.interact || d.breakable) gateTiles.add(y * W + x); }
      if (d.h > 0 && !p.base && map.wall[y * W + x] && map.wall[y * W + x].solid && p.type !== 'sign' && p.type !== 'graffiti') warn(L, `prop '${p.type}' at ${x},${y} sits on a wall tile`);
    }
  }
  // height an entity stands at on a tile (99 = can't stand there)
  const standH = (x, y, ignoreGates) => {
    if (!map.inBounds(x, y)) return 99;
    const i = y * W + x;
    const hm = map.heightAt(x, y);
    if (hm >= 99) return 99;
    const hp = ignoreGates && gateTiles.has(i) ? 0 : propH[i];
    return Math.max(hm, hp);
  };
  // ground tiles, or steps within STEP_UP of where you come from (stepped terraces); same rule as World.computeFlow
  const walkable = (x, y, ignoreGates, fromH = 0) => {
    const h = standH(x, y, ignoreGates);
    if (h >= 99) return false;
    return h <= STEP_UP || Math.abs(h - fromH) <= STEP_UP;
  };
  const bfs = (sx, sy, ignoreGates) => {
    const seen = new Uint8Array(W * H);
    const q = [[Math.floor(sx), Math.floor(sy)]];
    if (!walkable(q[0][0], q[0][1], ignoreGates)) return seen;
    seen[q[0][1] * W + q[0][0]] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      const hh = standH(x, y, ignoreGates);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (walkable(nx, ny, ignoreGates, hh) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push([nx, ny]); }
      }
    }
    return seen;
  };
  const start = L.start || (map.markers.start && map.markers.start[0]);
  if (!start) { err(L, 'no start (level.start or a legend marker "start")'); return; }
  if (!walkable(Math.floor(start.x), Math.floor(start.y), false)) err(L, `start ${start.x},${start.y} is not walkable`);
  const reach = bfs(start.x, start.y, false);
  const reachAll = bfs(start.x, start.y, true);
  const R = (x, y, all = true) => map.inBounds(Math.floor(x), Math.floor(y)) && (all ? reachAll : reach)[Math.floor(y) * W + Math.floor(x)] === 1;
  const areaReach = (a, all = true) => { for (let y = Math.floor(a.y); y < a.y + a.h; y++) for (let x = Math.floor(a.x); x < a.x + a.w; x++) if (R(x + 0.5, y + 0.5, all)) return true; return false; };
  let reachableCount = 0; for (let i = 0; i < W * H; i++) reachableCount += reachAll[i];
  console.log(`  map ${W}x${H}, reachable tiles ${reachableCount}, props ${props.length}, walls ${map.wall.filter(Boolean).length}`);

  // items
  const items = [...map.itemSpawns, ...(L.items || [])];
  let scarves = 0, badges = 0;
  for (const it of items) {
    if (!ITEMS[it.type]) err(L, `unknown item '${it.type}'`);
    if (it.type === 'scarf') scarves++;
    if (it.type === 'badge') badges++;
    if (!it.z && !R(it.x, it.y)) warn(L, `item '${it.type}' at ${it.x},${it.y} is not on a reachable tile`);
  }
  if (scarves !== 5) err(L, `has ${scarves} scarves (need exactly 5)`);
  if (badges !== 1) err(L, `has ${badges} pin badges (need exactly 1)`);

  // encounters
  const encs = L.encounters || [];
  if (encs.length < 3) warn(L, `only ${encs.length} encounters (aim for 4+)`);
  encs.forEach((e, i) => {
    const a = e.area || e.trigger;
    if (!a) { err(L, `encounter ${i} (${e.id}) has no area`); return; }
    if (!areaReach(a)) err(L, `encounter ${i} (${e.id}) trigger area is unreachable`);
    if (!e.waves || !e.waves.length) err(L, `encounter ${i} (${e.id}) has no waves`);
    for (const w of e.waves || []) for (const s of w.enemies || []) {
      if (!ENEMIES[s.type]) err(L, `encounter ${e.id}: unknown enemy '${s.type}'`);
      if (!R(s.x, s.y)) warn(L, `encounter ${e.id}: enemy '${s.type}' goal ${s.x},${s.y} not reachable`);
      if (e.lockArea || e.area) { const la = e.lockArea || e.area; if (s.x < la.x || s.y < la.y || s.x > la.x + la.w || s.y > la.y + la.h) warn(L, `encounter ${e.id}: enemy '${s.type}' at ${s.x},${s.y} ends outside the lock area`); }
    }
  });
  // boss
  if (!L.boss) err(L, 'no boss');
  else {
    const b = ENEMIES[L.boss.type];
    if (!b) err(L, `unknown boss type '${L.boss.type}'`);
    else if (!b.boss) warn(L, `boss '${L.boss.type}' def lacks boss:true`);
    if (!R(L.boss.x, L.boss.y)) err(L, `boss position ${L.boss.x},${L.boss.y} unreachable`);
    if (!L.boss.area || !areaReach(L.boss.area)) err(L, 'boss area missing or unreachable');
    for (const m of L.boss.minions || []) if (!ENEMIES[m.type]) err(L, `unknown boss minion '${m.type}'`);
  }
  // exit
  const ex = L.exit || (map.markers.exit && { x: map.markers.exit[0].x - 1, y: map.markers.exit[0].y - 1, w: 2, h: 2 });
  if (!ex) err(L, 'no exit (level.exit or marker "exit")');
  else if (!areaReach(ex)) err(L, 'exit unreachable even with doors/gates open');
  // attacks referenced by enemies
  for (const [id, d] of Object.entries(ENEMIES)) for (const [a] of (d.ai && d.ai.attacks) || []) if (!ATTACKS[a]) err(L, `enemy '${id}' uses unknown attack '${a}'`);
  if (!L.music) warn(L, 'no music id');
  return { map };
}

// ---------------------------------------------------------------- simulation
async function simulate(L, idx) {
  const { World } = await import('../src/game/world.js');
  const { game } = await import('../src/game/state.js');
  game.reset();
  let completed = false, over = false;
  const w = new World(L, game, { onComplete: () => { completed = true; }, onGameOver: () => { over = true; } });
  const dt = 1 / 60;
  const p = w.player;
  p.controller.enabled = false;
  const step = n => { for (let i = 0; i < n; i++) { p.invuln = 1; p.hp = p.maxHp; w.update(dt); } };
  step(30);
  const order = w.encounters.slice();
  for (const e of order) {
    const a = e.area || e.trigger;
    p.x = a.x + Math.min(a.w, 1) / 2 + 0.01; p.y = a.y + Math.min(a.h, 1) / 2 + 0.01;
    // nudge into a walkable tile inside the area
    outer: for (let y = Math.floor(a.y); y < a.y + a.h; y++) for (let x = Math.floor(a.x); x < a.x + a.w; x++) if (w.heightAt(x + 0.5, y + 0.5) <= STEP_UP) { p.x = x + 0.5; p.y = y + 0.5; break outer; }
    step(5);
    if (e.state === 'waiting') { err(L, `sim: encounter ${e.id || e.idx} did not start when the player stood in its area`); continue; }
    // let the AI actually fight for a while (exercise AI/boss code), then KO everything
    let guard = 0;
    while (e.state !== 'cleared' && guard++ < 40) {
      step(90);
      for (const f of w.fighters) if (f.team !== 'player' && f.alive && !f.controller.goal) { f.takeHit({ attacker: p, def: { hz: 1 }, dmg: 9999, dir: { x: 1, y: 0 }, kb: 1, stun: 0.3, knockdown: true, launch: 0, guardDmg: 0 }, w); f.invuln = 0; }
      step(150);
    }
    if (e.state !== 'cleared') err(L, `sim: encounter ${e.id || e.idx} never cleared (state ${e.state}, wave ${e.wave}, alive ${w.fighters.filter(f => f.team !== 'player' && f.alive).length})`);
  }
  if (!w.exitOpen) err(L, 'sim: exit did not open after all encounters/boss');
  const ex = w.exit;
  if (ex) {
    p.x = ex.x + ex.w / 2; p.y = ex.y + ex.h / 2;
    step(200);
  }
  if (!completed) err(L, 'sim: level did not complete when standing in the exit');
  else console.log(`  sim OK: ${w.stats.kos} KOs, score ${game.score}, ${Math.round(w.stats.time)}s simulated`);
}

for (let i = 0; i < LEVELS.length; i++) {
  const L = LEVELS[i];
  if (only.length && !only.includes(L.id) && !only.includes(String(L.num))) continue;
  try {
    checkLevel(L);
    if (SIM) await simulate(L, i);
  } catch (e) { err(L, 'EXCEPTION ' + (e.stack || e)); }
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
