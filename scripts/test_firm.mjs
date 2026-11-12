#!/usr/bin/env node
// Headless test of THE FIRM (game/firm.js): spawns a level with the lads and checks that they obey every order,
// that nerve breaks and routs work, and that enemies also go for the lads.
//
//   node scripts/test_firm.mjs [levelId=streets]
//
// Exit code 1 if any check fails.

const noop = () => {};
function fakeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData' || k === 'getImageData') return (a, b, w = a, h = b) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
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

await import('../src/content/index.js');
const { LEVELS } = await import('../src/content/levels/index.js');
const { World } = await import('../src/game/world.js');
const { game } = await import('../src/game/state.js');

const id = process.argv[2] || 'streets';
const L = LEVELS.find(l => l.id === id);
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function fresh() {
  game.reset();
  const w = new World(L, game, { onComplete: noop, onGameOver: noop });
  w.player.controller.enabled = false;
  // no level scripting in the way: encounters off, no traffic
  for (const e of w.encounters) e.state = 'cleared';
  w.hazards = [];
  return w;
}
function step(w, s, each) { for (let i = 0; i < Math.round(s * 60); i++) { w.player.invuln = 1; w.player.hp = w.player.maxHp; if (each) each(); w.update(1 / 60); } }
// walkable tile centres reachable from the start, sorted by distance from (x,y)
function spots(w, x, y, minD, maxD) {
  const out = [];
  const W = w.map.w, H = w.map.h, f = w.bfsFlow(Math.floor(w.player.y) * W + Math.floor(w.player.x));
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (f[ty * W + tx] < 0 || w.heightAt(tx + 0.5, ty + 0.5) > 0.3) continue;
    const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
    if (d >= minD && d <= maxD) out.push({ x: tx + 0.5, y: ty + 0.5, d });
  }
  return out.sort((a, b) => a.d - b.d);
}
function walkPlayer(w, to, s) { const p = w.player; step(w, s, () => { const dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy); if (d > 0.3) { p.intent.mx = dx / d; p.intent.my = dy / d; } else { p.intent.mx = p.intent.my = 0; } }); p.intent.mx = p.intent.my = 0; }

console.log(`\n== THE FIRM on ${L.name}`);
{
  const w = fresh(), F = w.firm;
  check(!!F && F.lads.length === 3, `firm spawned with ${F ? F.lads.length : 0} lads (${F ? F.lads.map(l => l.name).join(', ') : '-'})`);
  check(F.lads.every(l => l.team === 'player' && l.isLad), 'lads are on the player\'s team');

  // FOLLOW: walk the leader away, the lads keep up
  const far = spots(w, w.player.x, w.player.y, 7, 11)[0];
  F.order('follow');
  walkPlayer(w, far, 5); step(w, 2);
  const dF = Math.max(...F.lads.map(l => dist(l, w.player)));
  check(dF < 3.8, `FOLLOW: every lad within 3.8 of the leader after a walk (max ${dF.toFixed(2)})`);

  // HOLD: lads stay put while the leader leaves
  F.order('hold');
  const holds = F.lads.map(l => ({ x: l.x, y: l.y }));
  const away = spots(w, w.player.x, w.player.y, 6, 9)[0];
  walkPlayer(w, away, 4); step(w, 1);
  const dH = Math.max(...F.lads.map((l, i) => dist(l, holds[i])));
  check(dH < 1.2, `HOLD: lads stayed at their posts while the leader walked off (max drift ${dH.toFixed(2)})`);

  // MOVE: send everyone to a point
  const tgt = spots(w, w.player.x, w.player.y, 5, 8).slice(-1)[0];
  F.order('move', tgt);
  step(w, 6);
  const dM = Math.max(...F.lads.map(l => dist(l, tgt)));
  check(dM < 2.2, `MOVE: lads reached the ordered point (max ${dM.toFixed(2)} from it)`);
  if (dM >= 2.2) for (const l of F.lads) console.log('     ', l.name, 'at', l.x.toFixed(1), l.y.toFixed(1), 'order', JSON.stringify(l.controller.order), 'tgt', tgt.x, tgt.y, 'player', w.player.x.toFixed(1), w.player.y.toFixed(1), 'state', l.state);
  check(F.lads.every(l => ['hold', 'move'].includes(l.controller.order.type)), 'MOVE: lads hold the point once they arrive');

  // ATTACK: one named enemy
  F.order('follow'); step(w, 2);
  const sp = spots(w, w.player.x, w.player.y, 4, 6)[0];
  const foe = w.spawnEnemy('rival', sp.x, sp.y, { aggro: true });
  const other = w.spawnEnemy('rival', w.player.x - 0.5, w.player.y + 0.5, { aggro: true });
  foe.maxHp = foe.hp = 400; other.maxHp = other.hp = 400;
  F.order('attack', { target: foe });
  step(w, 6);
  check(foe.hp < 400, `ATTACK: the marked enemy took a beating (hp ${foe.hp}/400)`);
  check(F.lads.every(l => !l.alive || l.controller.foe === foe || !foe.alive), 'ATTACK: every lad went for the marked enemy');

  // enemies also go for the lads
  let ladTargeted = false;
  step(w, 4, () => { for (const e of w.fighters) if (e.team !== 'player' && e.controller && e.controller.curTarget && e.controller.curTarget.isLad) ladTargeted = true; });
  check(ladTargeted, 'ENEMY AI: enemies pick lads as targets too');
  check(w.player.hp === w.player.maxHp, 'no friendly fire on the leader');

  // CHARGE: nearest enemies anywhere around
  for (const f of w.fighters) if (f.team !== 'player') { f.removed = true; }
  step(w, 0.2);
  const sp2 = spots(w, w.player.x, w.player.y, 6, 9);
  const e1 = w.spawnEnemy('rival', sp2[0].x, sp2[0].y, { aggro: false }); e1.maxHp = e1.hp = 300;
  F.order('charge');
  step(w, 7);
  check(e1.hp < 300, `CHARGE: lads ran in and hit an enemy ${sp2[0].d.toFixed(1)} tiles away (hp ${e1.hp}/300)`);

  // SING UP
  for (const f of w.fighters) if (f.team !== 'player') f.removed = true;
  step(w, 0.2);
  F.order('follow'); step(w, 2);
  for (const l of F.lads) l.nerve = 30;
  const ok = F.order('sing');
  check(ok !== false && F.lads.every(l => l.nerve >= 60), `SING UP: nerve ${F.lads.map(l => Math.round(l.nerve)).join('/')} (from 30)`);
  check(F.order('sing') === false, 'SING UP: has a cooldown');

  // NERVE: a broken enemy runs off and counts as gone; a broken lad runs then comes back
  const sp3 = spots(w, w.player.x, w.player.y, 3, 5)[0];
  const coward = w.spawnEnemy('rival', sp3.x, sp3.y, { aggro: true });
  coward.nerve = 0;
  step(w, 4.5);
  check(coward.removed && coward.routed, 'NERVE: an enemy with no nerve legs it and is gone ("RAN OFF!")');
  const l0 = F.lads[0]; l0.nerve = 0;
  step(w, 0.1);
  check(l0.routT > 0, 'NERVE: a lad with no nerve breaks and runs');
  step(w, 4);
  check(!(l0.routT > 0) && l0.nerve > 30, `NERVE: ...and comes back (nerve ${Math.round(l0.nerve)})`);

  // KO + revive after an encounter is won
  const l1 = F.lads[1];
  l1.takeHit({ attacker: null, def: { hz: 1 }, dmg: 9999, dir: { x: 1, y: 0 }, kb: 1, stun: 0.3, knockdown: true, launch: 0, guardDmg: 0, unblockable: true }, w);
  step(w, 2);
  check(!l1.alive && !l1.removed, 'KO: a knocked-out lad stays down (not removed)');
  F.onClear(); step(w, 1.5);
  check(l1.alive && l1.hp > 0, `KO: ...and gets back up when the fight is won (hp ${l1.hp})`);
}
console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all firm checks passed'}`);
process.exit(fails ? 1 : 0);
