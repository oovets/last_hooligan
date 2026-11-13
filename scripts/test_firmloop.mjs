#!/usr/bin/env node
// Headless test of the firm between matches (phase D): pub -> trip -> level -> back to the pub with consequences.
//
//   node scripts/test_firmloop.mjs
//
// Covers game/firmdata.js (recruit, train, physio, squad, days, events, heat, walkouts), the hub World
// (content/hub.js: stations reachable, lads standing about) and a real level played with the saved squad.

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
const { save } = await import('../src/save.js');
const FD = await import('../src/game/firmdata.js');
const HUB = (await import('../src/content/hub.js')).default;
const { STEP_UP } = await import('../src/engine/constants.js');

let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
FD.setSeed(12345);

console.log('\n== THE FIRM between matches');
// ---- a new firm
save.data.firm = null; save.data.cash = 200;
const F = FD.getFirm('hooligan');
check(F.lads.length === 3 && F.squad.length === 3, `new firm: ${F.lads.map(l => l.name).join(', ')} (all on the coach)`);
check(F.pool.length === 4, `four new faces at the bar (${F.pool.map(c => `${c.name} £${c.cost}`).join(', ')})`);

// ---- the pub itself
{
  const w = new World(HUB, game, { noFirm: true });
  const st = w.props.filter(p => p.type === 'hub_station');
  const W = w.map.w, field = w.bfsFlow(Math.floor(w.player.y) * W + Math.floor(w.player.x));
  const reach = p => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = Math.floor(p.cx) + dx, y = Math.floor(p.cy) + dy; if (w.map.inBounds(x, y) && field[y * W + x] >= 0 && Math.hypot(x + 0.5 - p.cx, y + 0.5 - p.cy) < 1.3) return true; } return false; };
  const acts = [...new Set(st.map(s => s.o.action))];
  check(acts.length === 5 && st.every(reach), `the pub: stations ${acts.join(', ')} are all reachable`);
  check(!w.firm, 'no fighting firm spawned inside the pub');
  // USE at the map station sets the action the hub scene opens
  const m = st.find(s => s.o.action === 'map');
  w.player.x = m.cx; w.player.y = m.cy + 0.4; w.playerUse(w.player);
  check(w.hubAction === 'map', 'USE next to the cork board opens THE MAP');
}

// ---- recruiting, training, physio, the coach
{
  const cash0 = save.data.cash, cost0 = F.pool[0].cost;
  const r = FD.hire(F, 0);
  check(r.ok && F.lads.length === 4 && save.data.cash === cash0 - cost0, `hire: ${r.msg} (-£${cost0})`);
  const l = F.lads[0], v0 = l.stats.fists, cost = FD.trainCost(l, 'fists');
  const t1 = FD.train(F, l.id, 'fists');
  check(t1.ok && l.stats.fists === v0 + 1, `train: ${t1.msg} (-£${cost})`);
  check(!FD.train(F, l.id, 'kicks').ok, 'train: one session per lad per day');
  check(FD.squadSize(F) === 3 && F.squad.length === 3, 'the coach takes 3 at this reputation');
  check(FD.toggleSquad(F, F.lads[3].id).includes('ONLY 3'), 'a 4th lad can\'t get on a full coach');
}

// ---- a trip: play THE STREETS with the saved squad
const L = LEVELS[0];
game.reset();
const w = new World(L, game, { onComplete: noop, onGameOver: noop });
const squadIds = FD.squadLads(F).map(l => l.id);
check(w.firm && w.firm.lads.length === 3 && w.firm.lads.every(f => squadIds.includes(f.rec.id)), `the fight spawns the squad: ${w.firm.lads.map(f => f.name).join(', ')}`);
const p = w.player; p.controller.enabled = false;
const step = n => { for (let i = 0; i < n; i++) { p.invuln = 1; p.hp = p.maxHp; w.update(1 / 60); } };
step(30);
for (const e of w.encounters) {
  const a = e.area; p.x = a.x + 0.5; p.y = a.y + 0.5;
  outer: for (let y = Math.floor(a.y); y < a.y + a.h; y++) for (let x = Math.floor(a.x); x < a.x + a.w; x++) if (w.heightAt(x + 0.5, y + 0.5) <= STEP_UP) { p.x = x + 0.5; p.y = y + 0.5; break outer; }
  step(5);
  let guard = 0;
  while (e.state !== 'cleared' && guard++ < 40) {
    step(240);
    for (const f of w.fighters) if (f.team !== 'player' && f.alive && !f.controller.goal) f.takeHit({ attacker: w.firm.lads[0], def: { hz: 1 }, dmg: 9999, dir: { x: 1, y: 0 }, kb: 1, stun: 0.3, knockdown: true, launch: 0, guardDmg: 0 }, w);
    step(150);
  }
}
// one lad was left out cold at the end of the boss fight
const outLad = w.firm.lads[2];
outLad.takeHit({ attacker: null, def: { hz: 1 }, dmg: 9999, dir: { x: 1, y: 0 }, kb: 1, stun: 0.3, knockdown: true, launch: 0, guardDmg: 0, unblockable: true }, w);
step(10);
const res = FD.resultFromWorld(w, true, 'A');
check(res.lads.length === 3 && res.lads.some(r => r.kos > 0), `fight results: ${res.lads.map(r => `${r.name} ${r.kos} KO${r.out ? ' (OUT)' : ''}`).join(', ')}`);
const before = { rep: F.rep, heat: F.heat, day: F.day, trips: FD.ladById(F, res.lads[0].id).trips };
const lines = FD.applyTrip(F, res);
check(F.rep > before.rep && F.heat > before.heat && F.day === before.day + 1, `consequences: rep ${before.rep} -> ${F.rep}, heat ${before.heat} -> ${F.heat}, day ${before.day} -> ${F.day}`);
const outRec = FD.ladById(F, outLad.rec.id);
check(outRec && outRec.injury >= 1 && !F.squad.includes(outRec.id), `${outLad.name} was left out cold: injured ${outRec && outRec.injury} day(s), off the coach`);
check(F.squad.length === 3, `the coach is topped up from the bench (${FD.squadLads(F).map(l => l.name).join(', ')})`);
check(FD.ladById(F, res.lads[0].id).trips === before.trips + 1, 'trips and KOs recorded on the lads');
const a0 = FD.ladById(F, res.lads[0].id), a1 = FD.ladById(F, res.lads[1].id);
check((a0.bonds[a1.id] || 0) >= 1, 'fighting side by side builds bonds');
check(F.report && F.report.lines.length >= 3, `a report waits at the pub (${F.report.lines.length} lines)`);
console.log('       ' + lines.slice(0, 6).join('\n       '));

// ---- days pass: injuries heal
{
  const inj = outRec.injury;
  for (let i = 0; i < inj; i++) FD.nextDay(F, []);
  check(outRec.injury === 0 && FD.available(outRec), `after ${inj} day(s) ${outRec.name} is fit again`);
  const pool0 = F.pool.map(c => c.id).join();
  FD.nextDay(F, []);
  check(F.pool.map(c => c.id).join() !== pool0, 'new faces at the bar every day');
}

// ---- physio
{
  const l = F.lads[1]; l.injury = 3; save.data.cash = 100;
  const r = FD.physio(F, l.id);
  check(r.ok && l.injury === 2 && save.data.cash === 75, `physio: ${r.msg} (-£25)`);
  l.injury = 0;
}

// ---- event cards
{
  F.event = { id: 'copper', a: F.lads[0].id, b: F.lads[1].id }; F.heat = 50; save.data.cash = 100;
  const card = FD.eventCard(F);
  const msg = card.resolve(0);
  check(F.event === null && F.heat === 35 && save.data.cash === 80, `event "${card.title}": ${msg}`);
  F.event = { id: 'mum', a: F.lads[0].id, b: F.lads[1].id };
  const m2 = FD.eventCard(F).resolve(0);
  check(F.lads[0].banned >= 1 && !F.squad.includes(F.lads[0].id), `event "SOMEBODY'S MUM": ${m2}`);
  F.lads[0].banned = 0; FD.fixSquad(F);
  let drawn = 0; for (let i = 0; i < 20; i++) if (FD.drawEvent(F)) drawn++;
  check(drawn === 20, 'event cards can always be drawn');
}

// ---- the Old Bill
{
  F.heat = 70;
  const r1 = { levelId: 'streets', levelName: 'THE STREETS', won: true, rank: 'B', kos: 10, routs: 0, bossDown: false, lads: FD.squadLads(F).map(l => ({ id: l.id, kos: 1, downs: 0, out: false })) };
  const l1 = FD.applyTrip(F, r1);
  check(l1.some(x => x.includes('BANNING ORDER')), 'heat 60+: a banning order');
  F.heat = 90; save.data.cash = 400;
  const l2 = FD.applyTrip(F, { ...r1, lads: FD.squadLads(F).map(l => ({ id: l.id, kos: 0, downs: 0, out: false })) });
  check(l2.some(x => x.includes('RAID')) && save.data.cash < 400, `heat 85+: a raid on the Anchor (cash now £${save.data.cash})`);
}

// ---- a lost trip, an unhappy lad walks out
{
  const rep0 = F.rep;
  const bench = F.lads.find(l => !F.squad.includes(l.id)) || F.lads[F.lads.length - 1];
  bench.mood = 5; bench.stats.loyalty = 1;
  let left = false;
  for (let k = 0; k < 6 && !left; k++) {
    bench.mood = 5;
    FD.applyTrip(F, { levelId: 'pub', levelName: 'THE PUB', won: false, kos: 2, routs: 0, bossDown: false, lads: FD.squadLads(F).filter(l => l !== bench).map(l => ({ id: l.id, kos: 0, downs: 0, out: false })) });
    left = !F.lads.includes(bench);
  }
  check(F.rep < rep0, `a lost trip costs reputation (${rep0} -> ${F.rep})`);
  check(left, `an unhappy, disloyal lad walks out (${bench.name})`);
}

// ---- the next fight uses the new squad
{
  FD.fixSquad(F);
  game.reset();
  const w2 = new World(LEVELS[1], game, { onComplete: noop, onGameOver: noop });
  const ids = FD.squadLads(F).map(l => l.id);
  check(w2.firm.lads.length === ids.length && w2.firm.lads.every(f => ids.includes(f.rec.id) && FD.available(f.rec)), `next trip (THE PUB): ${w2.firm.lads.map(f => f.name).join(', ')}`);
}

// THE FOOTBALL TOUR: away days pay double reputation, +15 the first win at a ground; a loss there costs more
{
  const { TOUR, ALL_LEVELS, levelIndex } = await import('../src/content/tour/index.js');
  const { LEVELS: STORY } = await import('../src/content/levels/index.js');
  check(TOUR.length === 5 && ALL_LEVELS.length === STORY.length + TOUR.length && TOUR.every(t => levelIndex(t.id) >= STORY.length),
    `TOUR: ${TOUR.length} grounds after the ${STORY.length} story levels (${TOUR.map(t => t.venue).join(', ')})`);
  check(TOUR.every((t, i) => i === 0 || t.rep > TOUR[i - 1].rep), 'TOUR: each ground needs more reputation than the last');
  const F2 = FD.newFirm('hooligan');
  const lads = FD.squadLads(F2).map(l => ({ id: l.id, kos: 1, downs: 0, out: false }));
  const base = { levelId: 'streets', levelName: 'X', won: true, rank: 'B', kos: 4, routs: 0, bossDown: true, lads };
  const r0 = F2.rep; FD.applyTrip(F2, base); const dStory = F2.rep - r0;
  const r1 = F2.rep; FD.applyTrip(F2, { ...base, levelId: 'theden', tour: true }); const dTour1 = F2.rep - r1;
  const r2 = F2.rep; FD.applyTrip(F2, { ...base, levelId: 'theden', tour: true }); const dTour2 = F2.rep - r2;
  check(dTour1 === dStory * 2 + 15 && dTour2 === dStory * 2 && F2.tourWins.theden === 2, `TOUR: rep story +${dStory}, first away win +${dTour1}, again +${dTour2}`);
  const r3 = F2.rep; FD.applyTrip(F2, { ...base, won: false, levelId: 'theden', tour: true });
  check(F2.rep - r3 === -10, `TOUR: losing an away day costs ${F2.rep - r3}`);
}

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'all firm loop checks passed'}`);
process.exit(fails ? 1 : 0);
