// Timed stat buffs on a fighter (multiplicative, so they stack cleanly with difficulty, perks and Big Al's TOP OFF).
//   applyBuff(f, 'rush', RUSH, 20, f => ...)   multiplies f's stats now, divides them back when it runs out, then calls
//                                              the follow-up (e.g. the comedown)
//   tickBuffs(f, dt)                           from World.update for every fighter
export const RUSH = { power: 1.35, speed: 1.15, runSpeed: 1.15, defense: 0.8 };     // BAG OF CHARLIE: flying, feels nothing
export const CRASH = { power: 0.8, speed: 0.85, runSpeed: 0.85, defense: 1.15 };    // ...and the comedown

export function applyBuff(f, name, mul, dur, then = null) {
  f.buffs ||= {};
  if (f.buffs[name]) endBuff(f, name, false);
  for (const k in mul) f[k] *= mul[k];
  f.buffs[name] = { mul, t: dur, dur, then };
}

export function endBuff(f, name, chain = true) {
  const b = f.buffs && f.buffs[name];
  if (!b) return;
  for (const k in b.mul) f[k] /= b.mul[k];
  delete f.buffs[name];
  if (chain && b.then) b.then(f);
}

export function tickBuffs(f, dt) {
  if (!f.buffs) return;
  for (const name of Object.keys(f.buffs)) {
    const b = f.buffs[name];
    if (b && (b.t -= dt) <= 0) endBuff(f, name);
  }
}

export const buffLeft = (f, name) => (f.buffs && f.buffs[name] ? Math.max(0, f.buffs[name].t) : 0);
