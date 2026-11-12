# THE LAST HOOLIGAN — Architecture

Plain ES modules, HTML5 Canvas 2D, **no build step, no dependencies**. Serve the repo root over HTTP
(`python3 scripts/serve.py` → http://localhost:8642) — modules don't load from `file://`.

Internal resolution **640×360**, scaled up with nearest-neighbour. All art is procedural pixel art drawn in code;
all audio is synthesized with WebAudio. Fixed 60 Hz simulation step.

## Directory map

```
index.html                  canvas + loads src/main.js
src/main.js                 boot, scaling, fixed-step loop, debug handle window.__hooligan
src/app.js                  scene manager (app.go(scene), app.scenes registry -> avoids import cycles)
src/save.js                 localStorage save (save.data, save.write())
src/engine/                 constants, iso projection, input, bitmap font, crisp drawing (gfx), camera,
                            tile style registries + floor/wall sprite painting (tiles), TileMap parser
src/game/                   gameplay: Fighter state machine, combat (attack defs + hit resolution), poses/doll
                            (procedural character renderer), player controller, AI controller, items, props,
                            fx (particles), World (level runtime), HUD, PlayScene, GameState
src/content/                data: themes (floor/wall styles), enemies + bosses registries, wardrobe, levels/
src/ui/                     title/menus/wardrobe/options (title.js), level intro/complete/game over (screens.js), logo
src/audio/                  audio.js (engine + sfx + fallback music), music.js (soundtrack, crowd, chants)
scripts/serve.py            no-cache dev server          scripts/check.mjs  headless level validator + simulator
```

## Coordinates

* World positions are **tiles** (floats). Tile `(tx,ty)` covers `[tx,tx+1)×[ty,ty+1)`. Map row index = world y, column = world x.
* Height `z` in **units**; 1 unit = `Z_PX` = 20 screen px. Walls have heights in units (fence ~1, house 5).
* `toScreen(x,y,z) = ((x-y)*16, (x+y)*8 - z*20)`. On screen: **+x goes down-right, +y goes down-left**.
  The camera looks from the +x+y side: faces on the **+y edge ("left" face)** and **+x edge ("right" face)** of
  blocks are visible. Tall walls on the −x/−y (back) side of an area read best; walls on the +x/+y (front) side
  occlude the action (they auto-fade when the player is behind them) — prefer **low walls (h ≤ 1.5)** on front edges.
* Painter's sort key = `x + y` (centre). Walls use `tx+ty+1`.
* Player input is screen-relative (`screenDirToWorld`).

## Runtime objects

* **Fighter** (`game/fighter.js`): player, enemies and bosses. Controllers set `fighter.intent` each step
  (`mx,my,run,attack('punchL'|'punchR'|'kick'),attackName,jump,block,dodge,grab,use,taunt`).
  States: idle/walk/run/jump/attack/block/blockstun/dodge/hurt/dizzy/knockdown/down/getup/grabbing/grabbed/thrown/
  taunt/pickup/drink/victory/dead. `takeHit(hit, world)` → 'hit'|'blocked'|'guardbreak'|'knockdown'|'ko'|'armor'|'miss'.
* **Attacks** (`game/combat.js` `ATTACKS`, `registerAttack(name, def)`): startup/active/recovery timing, dmg, reach,
  arc, kb, stun, knockdown, launch, lunge, air, combo `next` map, sfx, hitstop, shake. Pose animation key in
  `ATTACK_POSES` (`game/poses.js`, `registerAttackPose`). `def.spawnProjectile` → World spawns `f.data.projectile`.
* **AI** (`game/ai.js`): data-driven via the enemy def's `ai` block; shared **attack tokens** limit simultaneous
  attackers; flow-field pathing; bosses add `think(f, world, dt, ai)` (return `true` to skip default AI that step;
  call `ai.base(f, world, dt)` to run it).
* **Enemies** (`content/enemies.js` `registerEnemy(id, def)`, `casualLook(rng, opts)` helper). Bosses: `boss: true`.
* **Items** (`game/items.js` `registerItem`): heal/cash/scarf/badge/key/weapon/life/fanzine. `WorldItem`, `Projectile`.
* **Props** (`game/props.js` `registerProp`): footprint, collision height, breakable, light, pickup, interact
  (doors/gates with keys), hazard, `draw(ctx, ax, ay, prop, t, world)`, optional `update(prop, world, dt)`.
* **Actors**: `world.addActor({x,y,update(world,dt),draw(ctx,world),depth(),removed})` for custom level things
  (trains, crowds, forklifts, cutscene bits).
* **World** (`game/world.js`): map + floor pre-render, collision (`heightAt`, `groundHeight`, `moveEntity`, `hasLOS`,
  `flowDir`), encounters/waves/locks, boss, secrets, triggers, hazards (traffic lanes with optional custom vehicle
  `draw`, damage zones), lighting (ambient darkness + light sources), weather (rain/snow), score/combo, HUD messages
  (`world.message(text, sub, dur, color)`, `world.toast(text)`), level hooks (`onStart`, `onUpdate`, `onEncounterClear`,
  `onBossDefeated`, `drawGround`, `drawOverlay`).

## Rendering pipeline (per frame)
bg → pre-rendered floor canvas → ground splats → depth-sorted walls/props/fighters/items/projectiles/vehicles/actors
→ particles & popups → GO arrow → lighting overlay (screen space) → weather → HUD → scene overlays.

## Audio API (stable)
`audio.init() · sfx(name,{pan,vol,pitch}) · music(id) · stopMusic() · setBoss(bool) · crowd(0..1) · chant() · setVolumes()`.
Music ids: `title streets pub underground awayend city industrial derby laststand victory gameover`.

## Save format
See `src/save.js` `defaultSave()`: unlocked levels, best scores, cash bank, scarves/badges/secrets per level,
wardrobe owned + outfit, settings, `run` snapshot for CONTINUE.

## Testing
* `node scripts/check.mjs [levelId] [--sim]` — static validation (legend, registries, reachability, 5 scarves +
  1 badge, encounters, boss, exit) and a headless run of the whole level with real AI.
* In the browser console: `__hooligan.play(i)` jumps straight into level i (0-based); `__hooligan.world` is the live
  World; `__hooligan.hold('KeyD', ms)` / `__hooligan.tap('KeyJ')` simulate input.

## Additions after the first build round

* **Rendering scale:** the canvas backing store is 2× (`RENDER_SCALE` in `src/main.js`). All game code still
  works in 640×360 logical pixels. See `docs/ART_PIPELINE.md` for the Blender sprites (`src/game/sprites.js`,
  `src/engine/envsprites.js`).
* **Boot:** `src/main.js` preloads environment sprites and character atlases (`assets/sprites/index.json`) behind a
  loading bar, then starts `app.scenes.boot` (or `?play=N`). `src/devflags.js` `DEV.mute` keeps the game silent
  during development.
* **Characters:** `src/content/characters.js` defines the playable roster: stats, fighter overrides,
  `moves` (opening-attack overrides: `punchL`, `punchR`, `kick`, `run`, `runKick`, `runGrab`), `grab` (grappler
  config: `range`, `hold`, `any`, `squeeze`, `finisher`, `hits`), `kickMul`/`punchMul`, look and unlock.
  `createPlayer` applies the selected character (`game.character`, saved in `save.data.character`).
  The screen is `src/ui/charselect.js`; `startNewRun` routes through it.
* **UI modules:** `src/ui/backdrop.js`, `widgets.js` (frames, bars, hint bar, `MenuList`), `minimap.js`,
  `options.js`, `menus.js` (level select, options, how-to-play, credits, name entry), `attract.js`,
  `wardrobe_ui.js`, `charselect.js`.
* **World API additions:**
  - `addFrameLight(l)`
  - `addActor(a)`, with actors culled by view unless `noCull`
  - `hasWalkLine()`
  - `bosses[]`, with a HUD bar per extra boss
  - `level.onBossDefeated` returning `false` vetoes the default exit handling
  - prop `def.hazard` (generic damage)
  - prop `def.interact.onUse(world, prop, fighter)` (switches)
  - prop `def.overlay(ctx, ax, ay, prop, t, world)`, drawn on top of a prop sprite
  - traffic hazards: `active(world)` / `manual` + `fire`, `draw`, `halfLen` / `halfWidth`
  - zone damage scales with difficulty and has a per-fighter cooldown
  - overhead UI (speech bubbles, telegraphs) is drawn after the lighting overlay
