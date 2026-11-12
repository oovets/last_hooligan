# Level authoring guide

A level is a module in `src/content/levels/` that default-exports a plain object. `src/content/levels/l1_streets.js`
is the reference implementation — read it first. Validate with `node scripts/check.mjs <id> --sim`.

## Required fields
```js
export default {
  id: 'pub', num: 2, name: 'THE PUB', subtitle: 'SATURDAY. 13:30.',
  intro: ['LINE ONE', 'LINE TWO', ...],          // shown on the level card (UPPERCASE; font is caps-only)
  music: 'pub',                                    // track id (see ARCHITECTURE.md)
  crowd: 0,                                        // crowd ambience 0..1 (stadium levels ~0.6-1)
  weather: null | 'rain' | 'snow',
  ambient: { dark: 0..0.85, color: '#06071a', playerLight: 3 },   // night/indoor darkness; lights cut through it
  bg: '#05060c', fog: null | 'rgba(...)',
  defaultFloor: 'asphalt',
  legend: { 'c': { floor, wall, h, solid, fake, prop, item, marker }, ... },
  map: [ 'row0...', 'row1...' ],                   // equal-length strings; ' ' = void
  items: [{ type, x, y, z?, key?, title?, text? }],   // extra pickups (z>0 = on top of a crate/platform)
  props: [{ type, x, y, ...opts }],                // extra props (signs/graffiti on wall tiles, multi-tile props)
  lights: [{ x, y, z, r, color, intensity, flicker }],
  hazards: [ traffic lanes / damage zones ],
  triggers: [{ area:{x,y,w,h}, msg, sub, toast, dur, color, once, action(world, trigger) }],
  secrets: [{ id, x, y, w, h, msg, score }],        // found by walking into the area (or prop.o.secret on break)
  encounters: [ ... ],                             // in play order
  boss: { type, x, y, title, intro, area, lockArea, minions:[...], extraWaves:[...] },
  exit: { x, y, w, h }   // or a legend marker 'exit' (2x2 area around it)
  onStart(world), onUpdate(world, dt), onEncounterClear(world, enc), onBossDefeated(world, boss),
  drawGround(ctx, world), drawOverlay(ctx, world)   // optional hooks (world-space ctx)
};
```

## Legend entries
`{ floor: 'cobble' }` floor only · `{ floor, wall: 'brick', h: 3 }` solid block · `solid:false, fake:true` walk-through
secret wall · `prop: 'lamp' | { type:'car', color:'#..', dir:'y' }` · `item: 'scarf'` · `marker: 'start'|'exit'|any`.
Floor/wall ids: see `src/content/themes/common.js` (asphalt road roadLineX/Y zebra pavement kerbX/Y cobble grass dirt
concrete parking wood carpet tiles metal gravel water pitch pitchLine/Y terrace rail platformEdge manhole crest;
walls brick brickDark brickYellow house shop concrete corrugated corrugatedRust tiledWall glass hedge fenceWood
container railing stand advert rock crateStack). Add new ones in your own theme file `src/content/themes/<theme>.js`
(only ADD ids; never redefine common ones). Props: see `src/game/props.js` (crate barrel bin wheeliebin bench lamp
bollard cone barrier fence car phonebox tree skip pallet table chairProp door gate sign graffiti puddle postbox hydrant
rubble weaponStash exitArrow). Items: pint pie kebab energy cash5 cash20 coin scarf badge key ticket life fanzine
bottle chair binlid pipe flag cone umbrella brick.

## Encounters
```js
{ id, area:{x,y,w,h} /* trigger */, lockArea:{...} /* player is fenced in until cleared (default = area) */,
  lock: true, msg, sub, clearMsg, checkpoint: true, goTo:{x,y,w,h} /* GO-arrow target after clear */,
  requires: world => bool,
  waves: [ { enemies: [{ type, x, y, from:{x,y} /* walk-in start; noclip until arrival */, delay, weapon, hp, name }],
             nextAt: 0 /* spawn next wave when alive <= nextAt */, next: seconds /* or after a timer */, msg } ] }
```
Rules of thumb: 4–6 encounters per level + boss; 2–4 enemies on screen; `from` points just off-screen or in
doorways; lockArea should be the whole room/street so the player can move around; checkpoints are encounter centres.

## Required content per level
* exactly **5 scarves** (`item: 'scarf'`) — some in plain sight, some behind secrets/jumps; **1 pin badge** hidden.
* at least **2 secrets** (fake walls `solid:false,fake:true`, breakable props with `secret:'id'`, platforms via jumps).
* a **boss** with its own `think()` special moves, registered in your level's boss module.
* unique enemies/props/floors/walls for flavour; health pickups between fights; a few weapons.
* tutorial-ish `triggers` only where a new mechanic appears.

## Jumping & platforms
Jump apex ≈ 1.27 units: props/walls with h ≤ ~1.2 can be jumped onto and stood on; `STEP_UP` is 0.35 (walk up).
Use crates (h 0.9) / pallets / low walls to make reachable platforms for secrets.
