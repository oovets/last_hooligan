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
  const atrace = {};
  step(w, 6, () => { const k = foe.state + (foe.grabbedBy ? '/held' : ''); atrace[k] = (atrace[k] || 0) + 1; for (const l of F.lads) { const kk = 'L:' + l.state + (l.controller.pinWant ? '/W' : '') + (l.controller.foe === foe ? '' : '/notfoe'); atrace[kk] = (atrace[kk] || 0) + 1; } });
  if (!(foe.hp < 400)) console.log('     diag attack', JSON.stringify(atrace), 'dists', F.lads.map(l => dist(l, foe).toFixed(2)).join('/'), 'foe z', foe.z.toFixed(2), 'h', w.heightAt(foe.x, foe.y).toFixed(2));
  check(foe.hp < 400, `ATTACK: the marked enemy took a beating (hp ${foe.hp}/400)`);
  check(F.lads.every(l => !l.alive || l.controller.foe === foe || !foe.alive || foe.routed), 'ATTACK: every lad went for the marked enemy (until he broke and ran)');

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
  if (!(e1.hp < 300)) console.log('     diag charge e1', e1.state, e1.z.toFixed(2), e1.invuln, 'h', w.heightAt(e1.x, e1.y).toFixed(2), F.lads.map(l => `${l.name}:${l.state}:${l.attack && l.attack.name}:${l.z.toFixed(2)}:${dist(l, e1).toFixed(2)}:${l.fx.toFixed(2)},${l.fy.toFixed(2)}:${(e1.x - l.x).toFixed(2)},${(e1.y - l.y).toFixed(2)}`).join(' | '));
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

// PROTECT + HELP: lads on WITH ME look after the leader first, and answer a mate who shouts for help
{
  const w = fresh(), F = w.firm, P = w.player;
  F.order('follow'); step(w, 1.5);
  const sp = spots(w, P.x, P.y, 1.2, 2);
  const onP = w.spawnEnemy('rival', sp[0].x, sp[0].y, { aggro: true }); onP.maxHp = onP.hp = 999;
  onP.controller.target = () => P;
  const decoy = spots(w, P.x, P.y, 3.5, 4.5)[0];
  const d2 = w.spawnEnemy('rival', decoy.x, decoy.y, { aggro: true }); d2.maxHp = d2.hp = 999;
  d2.controller.target = () => F.lads[0];
  let covered = 0, frames = 0;
  step(w, 3, () => { frames++; if (F.lads.some(l => l.controller.foe === onP)) covered++; });
  check(covered / frames > 0.6, `PROTECT: a lad is on the man going for the leader ${Math.round(covered / frames * 100)}% of the time`);
  for (const f of w.fighters) if (f.team !== 'player') f.removed = true;
  step(w, 0.3);

  // HELP: two men on a hurt lad -> he shouts, a mate comes over
  F.order('follow'); step(w, 1.5);
  const l0 = F.lads[0];
  l0.hp = l0.maxHp * 0.3;
  const sp2 = spots(w, l0.x, l0.y, 0.8, 1.6);
  const foes = [0, 1].map(i => { const e = w.spawnEnemy('rival', sp2[i].x, sp2[i].y, { aggro: true }); e.maxHp = e.hp = 999; e.controller.target = () => l0; e.power = 0; return e; });
  let called = false, helped = false;
  step(w, 3, () => { l0.hp = Math.max(l0.hp, l0.maxHp * 0.3); if (l0.helpT > 0) called = true; if (F.lads.some(l => l !== l0 && foes.includes(l.controller.foe))) helped = true; });
  check(called, 'HELP: a hurt, outnumbered lad shouts for help');
  check(helped, 'HELP: ...and a mate goes for one of the men on him');
}

// ---------------------------------------------------------------- teamwork (HOLD HIM / DOUBLE TEAM / PASS / PICK UP / BACK TO ME / GET OFF HIM)
const { ORDER_TAG, ORDER_TEXT, REPLY } = await import('../src/game/firm.js');
const { KEYMAP } = await import('../src/engine/input.js');
const { BIND_ROWS } = await import('../src/ui/options.js');
const holdAll = F => { for (const l of F.lads) l.controller.order = { type: 'hold', x: l.x, y: l.y }; };
const jabAt = (w, P, e) => {
  const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
  P.x = e.x - dx / d * 0.8; P.y = e.y - dy / d * 0.8; P.setState('idle'); P.attack = null;
  P.face2(e.x - P.x, e.y - P.y); P.startAttack('jab', w);
};

// HOLD HIM!
{
  const w = fresh(), F = w.firm, P = w.player;
  F.order('follow'); step(w, 1.5);
  const mo = F.lads.find(l => l.character === 'mo') || F.lads[0];
  const s0 = spots(w, P.x, P.y, 2, 3)[0]; mo.x = s0.x; mo.y = s0.y;
  const far = spots(w, P.x, P.y, 7, 10)[0];
  for (const o of F.lads) if (o !== mo) { o.x = far.x; o.y = far.y; }
  holdAll(F);
  const e = w.spawnEnemy('rival', ...Object.values(spots(w, mo.x, mo.y, 0.7, 1.1)[0]).slice(0, 2), { aggro: false });
  e.maxHp = e.hp = 400; e.power = 0;
  mo.pinning = true;
  check(mo.grabTarget(w, e), 'PIN: a lad can pin a man');
  step(w, 0.6, () => { e.nerve = 100; });
  jabAt(w, P, e);
  step(w, 0.35, () => { e.nerve = 100; });
  check(e.hp < 400 && e.grabbedBy === mo && e.state === 'grabbed', `PIN: the leader's hit lands and the hold stays (hp ${Math.round(e.hp)}, held ${e.grabbedBy === mo})`);
  let ok = true, maxGrabT = 0;
  step(w, 2.0, () => { e.nerve = 100; ok = ok && e.grabbedBy === mo && e.state !== 'thrown'; maxGrabT = Math.max(maxGrabT, mo.grabT); });
  check(ok && maxGrabT < ((mo.grabCfg && mo.grabCfg.hold) || 1.8), `PIN: he holds without kneeing or throwing (max grabT ${maxGrabT.toFixed(2)})`);
  const e2 = w.spawnEnemy('rival', mo.x - 0.6, mo.y, { aggro: false });
  mo.takeHit({ attacker: e2, def: { hz: 1 }, dmg: 3, dir: { x: 1, y: 0 }, kb: 1, stun: 0.3, guardDmg: 0 }, w);
  check(e.grabbedBy === null && !mo.pinning && mo.grabbing === null, 'PIN: an enemy hitting the pinner frees his mate');
  // a normal (non-pin) grab still breaks on someone else's hit
  step(w, 0.6);
  const e3 = w.spawnEnemy('rival', mo.x + 0.7, mo.y, { aggro: false }); e3.maxHp = e3.hp = 400;
  mo.setState('idle'); mo.pinning = false; mo.grabTarget(w, e3);
  step(w, 0.1);
  const heldBefore = e3.grabbedBy === mo;
  jabAt(w, P, e3); step(w, 0.35);
  if (!(e3.grabbedBy !== mo || !mo.grabbing)) console.log('     diag plain grab: heldBefore', heldBefore, 'e3hp', e3.hp, 'Pstate', P.state, 'd', dist(P, e3).toFixed(2));
  check(e3.grabbedBy !== mo || !mo.grabbing, 'PIN: a plain grab still breaks when a mate hits the man (no free hits)');
  for (const f of w.fighters) if (f.team !== 'player') f.removed = true;
  step(w, 0.3);
  // GRAB HIM! order: exactly one lad goes and pins the marked man
  const ep = w.spawnEnemy('rival', ...Object.values(spots(w, P.x, P.y, 2.5, 3.5)[0]).slice(0, 2), { aggro: false }); ep.maxHp = ep.hp = 999; ep.power = 0;
  F.select(null); F.order('pin', { target: ep });
  check(F.lads.filter(l => l.controller.order.type === 'pin').length === 1, 'PIN ORDER: one lad takes the GRAB HIM! order');
  let pinned = false;
  step(w, 5, () => { ep.nerve = 100; if (ep.grabbedBy && ep.grabbedBy.isLad && ep.grabbedBy.pinning) pinned = true; });
  if (!pinned) { const pl = F.lads.find(l => l.controller.order.type === 'pin') || F.lads[0]; console.log('     diag pinorder', 'ep', ep.state, ep.alive, ep.routed, 'lads', F.lads.map(l => `${l.name}:${l.state}:${l.controller.order.type}:${dist(l, ep).toFixed(2)}:${l.grabbing ? 'G' : ''}:${l.routT > 0 ? 'R' : ''}`).join(' | ')); }
  check(pinned, 'PIN ORDER: ...and pins him');
  // a lad who bottles it lets go
  const pl = ep.grabbedBy || F.lads.find(l => l.alive);
  if (!pl.grabbing) { pl.setState('idle'); pl.pinning = true; pl.grabTarget(w, ep); }
  pl.nerve = 0; step(w, 0.3);
  check(pl.grabbing === null && ep.grabbedBy !== pl, 'PIN: a lad who breaks and runs lets go');
  check(Object.keys(ORDER_TAG).every(k => ORDER_TEXT[k] && REPLY[k]), 'ORDERS: every order has a shout and replies');
  F.barkCd = 0; for (const l of F.lads) l.barkCd = 0;
  const b1 = F.bark(F.lads[0], 'rally'), b2 = F.bark(F.lads[1], 'rally');
  check(b1 === true && b2 === false, 'BARK: shouts have a firm-wide cooldown');
  F.lads[0].helpCd = 5; F.lads[0].barkCd = 1; let ranDown = false;
  step(w, 1.5, () => { F.lads[0].helpCd = Math.max(F.lads[0].helpCd, 2); if (!(F.lads[0].barkCd > 0)) ranDown = true; });
  check(ranDown, 'BARK: a lad\'s shout cooldown runs down even while his help call is cooling');
}
// auto pin: lads on WITH ME pin men near the leader now and then (chance forced to 1: this checks the mechanism)
{
  const { PIN_CHANCE } = await import('../src/game/firm.js');
  const saved = { ...PIN_CHANCE }; PIN_CHANCE.biglad = PIN_CHANCE.normal = PIN_CHANCE.lightweight = 1;
  const w = fresh(), F = w.firm, P = w.player;
  F.order('follow'); step(w, 1);
  const sp = spots(w, P.x, P.y, 1.4, 2)[0];
  const e = w.spawnEnemy('rival', sp.x, sp.y, { aggro: true }); e.maxHp = e.hp = 999; e.power = 0;
  e.controller.target = () => F.lads[0];
  let pinned = false;
  step(w, 15, () => { e.nerve = 100; if (e.grabbedBy && e.grabbedBy.pinning) pinned = true; if (dist(P, e) > 3) { P.x += (e.x - P.x) * 0.05; P.y += (e.y - P.y) * 0.05; } });
  Object.assign(PIN_CHANCE, saved);
  if (!pinned) console.log('     diag autopin', e.state, dist(P, e).toFixed(2), F.lads.map(l => `${l.state}:${l.controller.foe === e}:${l.controller.pinCd && l.controller.pinCd.toFixed(2)}:${dist(l, e).toFixed(2)}`).join(' | '));
  check(pinned, 'AUTO PIN: a lad pins a man next to the leader on his own');
}

// DOUBLE TEAM
{
  const w = fresh(), F = w.firm, P = w.player;
  holdAll(F);
  const sp = spots(w, P.x, P.y, 8, 10)[0];
  const e = w.spawnEnemy('rival', sp.x, sp.y, { aggro: false }); e.maxHp = e.hp = 300; e.power = 0;
  const l = F.lads[1];
  F.onHit(l, e, 5, 'hit'); F.onHit(P, e, 5, 'hit'); F.onHit(P, e, 5, 'hit'); F.onHit(P, e, 5, 'hit');
  const q3 = F.dtQueue.length;
  F.onHit(P, e, 5, 'hit');
  check(q3 === 0 && F.dtQueue.length === 1, `DOUBLE TEAM: four leader hits while a lad is on him queue the launch (${q3} -> ${F.dtQueue.length})`);
  check(e.state !== 'knockdown', 'DOUBLE TEAM: ...not inside the hit (a grab-on-hit can\'t re-grab the body)');
  step(w, 0.05);
  check((e.state === 'knockdown' || e.state === 'down') && e.hp <= 300 - 8 && e._dteam.cd > w.time, `DOUBLE TEAM: launched, extra damage, cooldown (state ${e.state}, hp ${Math.round(e.hp)})`);
  const sp2 = spots(w, P.x, P.y, 8, 10)[3] || sp;
  const e2 = w.spawnEnemy('rival', sp2.x, sp2.y, { aggro: false }); e2.maxHp = e2.hp = 300;
  for (let i = 0; i < 6; i++) F.onHit(P, e2, 5, 'hit');
  check(F.dtQueue.length === 0, 'DOUBLE TEAM: the leader alone doesn\'t trigger it');
  for (let i = 0; i < 2; i++) { F.onHit(l, e, 5, 'hit'); F.onHit(P, e, 5, 'hit'); F.onHit(P, e, 5, 'hit'); }
  check(!F.dtQueue.includes(e), 'DOUBLE TEAM: cooldown per man');
  // on a pinned man three hits do it, and the launch breaks the pin
  const mo = F.lads[0];
  const sp3 = spots(w, mo.x, mo.y, 0.7, 1.1)[0];
  const e3 = w.spawnEnemy('rival', sp3.x, sp3.y, { aggro: false }); e3.maxHp = e3.hp = 300; e3.power = 0;
  mo.setState('idle'); mo.pinning = true; mo.grabTarget(w, e3);
  F.onHit(P, e3, 5, 'hit'); F.onHit(P, e3, 5, 'hit'); F.onHit(P, e3, 5, 'hit');
  step(w, 0.05);
  check(e3.state === 'knockdown' && e3.grabbedBy === null && mo.grabbing === null && !mo.pinning, `DOUBLE TEAM: three hits on a pinned man launch him out of the pin (state ${e3.state})`);
  check(mo.controller.catchFor === e3 || (F.barks.dteam || 0) >= 1, 'DOUBLE TEAM: the pinner follows up');
}

// PASS HIM ON + no friendly fire from our throws
{
  const setup = () => {
    const w = fresh(), F = w.firm, P = w.player;
    holdAll(F); step(w, 0.2);
    const s = spots(w, P.x, P.y, 2.4, 3.2).find(q => w.hasWalkLine(P.x, P.y, q.x, q.y));
    P.face2(s.x - P.x, s.y - P.y);
    const ex = P.x + P.fx * 0.8, ey = P.y + P.fy * 0.8;
    const e = w.spawnEnemy('rival', ex, ey, { aggro: false }); e.maxHp = e.hp = 400; e.power = 0;
    const lad = F.lads[0];
    for (const o of F.lads) if (o !== lad) { o.x = P.x - P.fx * 3; o.y = P.y - P.fy * 3; o.controller.order = { type: 'hold', x: o.x, y: o.y }; }
    lad.x = s.x; lad.y = s.y; lad.controller.order = { type: 'hold', x: s.x, y: s.y }; lad.setState('idle');
    return { w, F, P, e, lad, s };
  };
  {
    const { w, P, e, lad } = setup();
    P.setState('idle'); P.grabTarget(w, e); P.throwTarget(w, P.fx, P.fy);
    check(e.passTo === lad, 'PASS: a throw toward a free lad is aimed at him');
    const hp0 = lad.hp; let sawKD = false;
    step(w, 1.0, () => { if (lad.state === 'knockdown') sawKD = true; e.nerve = 100; });
    check((e.grabbedBy === lad) || (e.state === 'down' && dist(e, lad) < 1.6), `PASS: he catches him (held ${e.grabbedBy === lad}, state ${e.state})`);
    check(!sawKD && lad.hp === hp0, 'PASS: the catcher isn\'t flattened');
    if (e.grabbedBy === lad) {
      check(e.onGround && !e.vz, 'PASS: a man caught in the air is held at ground level');
      jabAt(w, P, e); step(w, 0.35, () => { e.nerve = 100; });
      check(e.grabbedBy === lad && lad.pinning, `PASS: the leader's free hit on a caught man keeps the pin (state ${e.state})`);
    }
    const dead = w.spawnEnemy('rival', P.x + 5, P.y, { aggro: false }); dead.dying = true; dead.hp = 0;
    check(!lad.grabTarget(w, dead), 'GRAB: nobody can grab a dying man (no unkillable bodies)');
  }
  {
    const { w, P, e, lad } = setup();
    lad.x = P.x + P.fx * 1.5; lad.y = P.y + P.fy * 1.5; lad.controller.order = { type: 'hold', x: lad.x, y: lad.y };
    lad.setState('hurt'); lad.stunT = 2;
    P.setState('idle'); P.grabTarget(w, e); P.throwTarget(w, P.fx, P.fy);
    const hp0 = lad.hp; let sawKD = false;
    step(w, 1.0, () => { if (lad.state === 'knockdown') sawKD = true; });
    check(!sawKD && lad.hp === hp0, 'THROWS: our throws don\'t bowl over our own lads');
  }
  {
    const { w, F, P, e, lad } = setup();
    lad.x = P.x - P.fx * 3; lad.y = P.y - P.fy * 3; lad.controller.order = { type: 'hold', x: lad.x, y: lad.y };
    const e2 = w.spawnEnemy('rival', P.x + P.fx * 1.8, P.y + P.fy * 1.8, { aggro: false }); e2.maxHp = e2.hp = 400;
    e2.controller = { update(f) { f.intent.mx = f.intent.my = 0; f.intent.block = false; } };   // (an enemy can block a thrown body)
    P.setState('idle'); P.grabTarget(w, e); P.throwTarget(w, P.fx, P.fy);
    let floored = false; const path = [];
    step(w, 1.0, () => { if (e2.state === 'knockdown' || e2.state === 'down') floored = true; if (path[path.length - 1] !== e.state) path.push(e.state); });
    if (!(e2.hp < 400 && floored)) console.log('     diag throw: e path', path.join('>'), 'e2', e2.state, e2.hp, 'passTo', !!e.passTo, 'e-e2', dist(e, e2).toFixed(2));
    check(e2.hp < 400 && floored, 'THROWS: ...but still bowl over enemies');
  }
}

// PICK HIM UP
{
  const w = fresh(), F = w.firm, P = w.player;
  holdAll(F);
  const KO = l => l.takeHit({ attacker: null, def: { hz: 1 }, dmg: 9999, dir: { x: 1, y: 0 }, kb: 1, stun: 0.3, knockdown: true, launch: 0, guardDmg: 0, unblockable: true }, w);
  const l1 = F.lads[1];
  KO(l1); step(w, 2.5);
  P.x = l1.x + 0.6; P.y = l1.y; P.setState('idle');
  w.playerUse(P);
  check(P.state === 'pickup' && P.actionDur === 1.2, 'PICK UP: USE over a KO\'d lad starts hauling him up');
  step(w, 1.6);
  check(l1.alive && l1.hp / l1.maxHp > 0.25 && l1.hp / l1.maxHp < 0.35 && l1.revivedThisFight, `PICK UP: he's back on his feet at ~30% (hp ${l1.hp}/${l1.maxHp})`);
  step(w, 1.5); l1.invuln = 0;
  KO(l1); step(w, 2.5);
  P.x = l1.x + 0.6; P.y = l1.y; P.setState('idle'); w.playerUse(P); step(w, 1.6);
  check(!l1.alive, 'PICK UP: once per lad per fight');
  F.onClear(); step(w, 1.6);
  check(l1.alive && !l1.revivedThisFight, 'PICK UP: winning the fight still gets everyone up and resets it');
  const l2 = F.lads[2];
  KO(l2); step(w, 2.5);
  P.x = l2.x + 0.6; P.y = l2.y; P.setState('idle');
  const r = w.spawnEnemy('rival', P.x + 1.0, P.y, { aggro: false });
  w.playerUse(P);
  check(P.state !== 'pickup' && w.toasts.some(t => t.text.includes('ON TOP')), 'PICK UP: not with an enemy on top of you');
  r.removed = true; step(w, 0.1);
  P.setState('idle'); w.playerUse(P);
  P.invuln = 0;
  P.takeHit({ attacker: null, def: { hz: 1 }, dmg: 1, dir: { x: 1, y: 0 }, kb: 0.5, stun: 0.3, guardDmg: 0 }, w);
  check(P.state === 'hurt' && P.actionDur === 0 && P.onAction === null, 'PICK UP: a hit cancels it');
  step(w, 1.6);
  check(!l2.alive, 'PICK UP: ...and he stays down');
  let fired = false;
  P.setState('idle'); P.setState('drink'); P.onAction = () => { fired = true; }; P.setState('hurt'); step(w, 0.6);
  P.setState('idle'); P.setState('pickup'); step(w, 0.5);
  check(!fired, 'PICK UP: an interrupted drink never fires later');
}

// BACK TO ME! + GET OFF HIM!
{
  const w = fresh(), F = w.firm, P = w.player;
  P.controller = { update() {} };
  const sp = spots(w, P.x, P.y, 4, 5);
  for (let i = 0; i < 2; i++) { const e = w.spawnEnemy('rival', sp[i].x, sp[i].y, { aggro: true }); e.maxHp = e.hp = 999; e.power = 0; }
  F.order('charge'); step(w, 2.5, () => { for (const f of w.fighters) if (f.team !== 'player') f.nerve = 100; });
  check(F.lads.some(l => l.controller.foe), 'REGROUP: (lads were in the fight)');
  for (const l of F.lads) l.nerve = 40;
  F.order('regroup');
  check(F.lads.every(l => l.controller.order.type === 'regroup'), 'REGROUP: BACK TO ME! goes to everyone');
  const closest = new Map(F.lads.map(l => [l, 99]));
  step(w, 4.5, () => { for (const f of w.fighters) if (f.team !== 'player') f.nerve = 100; for (const l of F.lads) closest.set(l, Math.min(closest.get(l), dist(l, P))); });
  // (one lad knocked about or blocked in can time out after 4 s: that's the designed fallback)
  const alive = F.lads.filter(l => l.alive), arrived = alive.filter(l => closest.get(l) < 1.8).length;
  const near = arrived >= alive.length - 1 && alive.every(l => l.controller.order.type === 'follow');
  check(near, `REGROUP: the lads got back to the leader, then went back on WITH ME (closest ${[...closest.values()].map(v => v.toFixed(2)).join('/')})`);
  check(F.lads.some(l => l.rallyCd > 0), 'REGROUP: arriving gives a nerve rally (with a cooldown)');
  const code2 = {}; for (const [a, cs] of Object.entries(KEYMAP)) for (const c of cs) (code2[c] ||= []).push(a);
  check(JSON.stringify(code2.KeyN) === '["orderRegroup"]', 'REGROUP: N is BACK TO ME and nothing else');
}
{
  const w = fresh(), F = w.firm, P = w.player;
  F.order('follow'); step(w, 1.5);
  const e = w.spawnEnemy('rival', P.x + 0.6, P.y, { aggro: true }); e.maxHp = e.hp = 400; e.power = 0;
  e.controller = { update(f) { const I = f.intent; I.mx = I.my = 0; I.attack = null; I.attackName = null; I.grab = false; I.block = false; I.jump = false; I.dodge = false; }, curTarget: P };
  F.barks.rescue = 0;
  e.grabTarget(w, P);
  let freedAt = -1, t = 0;
  const trace = [];
  step(w, 1.7, () => { t += 1 / 60; if (freedAt < 0 && !P.grabbedBy) freedAt = t; e.nerve = 100; if (Math.round(t * 60) % 15 === 0) trace.push(F.lads.map(l => `${l.name.split(' ').pop()}:${l.state}:${l.controller.foe === e ? 'G' : l.controller.foe ? 'o' : '-'}:${dist(l, e).toFixed(1)}:${l.controller.order.type}${l.grabbing ? ':GRAB' : ''}${l.controller.pinWant ? ':W' : ''}`).join(' ')); });
  if (freedAt < 0) console.log('     diag rescue', 'Pstate', P.state, 'e', e.state, e.alive, '\n       ' + trace.join('\n       '));
  check(freedAt > 0 && e.lastAttacker && e.lastAttacker.isLad, `GET OFF HIM: the lads knock the grabber off the leader (${freedAt.toFixed(2)}s)`);
  check((F.barks.rescue || 0) >= 1, 'GET OFF HIM: someone shouts it');
}

// lads' kicks hurt (the kicks stat is an offset around 1, never a multiplier near zero)
{
  const w = fresh(), F = w.firm;
  check(F.lads.every(l => l.kickMul > 0.5 && l.kickMul < 1.6), `KICKS: every lad's kicks do real damage (kickMul ${F.lads.map(l => l.kickMul.toFixed(2)).join('/')})`);
}

// controls copy matches the bindings
{
  check(BIND_ROWS.every(r => !r[1] || r[1].every(a => KEYMAP[a])), 'CONTROLS: every bindings row names a real action');
  check(!BIND_ROWS.find(r => r[0].startsWith('BLOCK'))[2].includes('RT'), 'CONTROLS: block is RB only (RT is command)');
}
console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all firm checks passed'}`);
process.exit(fails ? 1 : 0);
