# THE LAST HOOLIGAN

*NO RULES. NO FEAR. JUST FOOTBALL.*

An original isometric beat 'em up / action adventure for the browser. It combines exploration (multi-area levels,
keys, items, secret passages) with brawler combat (combos, grabs, throws, weapons, crowds of enemies), and you lead
a firm: your lads fight beside you on your orders, and between matches you run them from your local pub. The theme
is 90s football-casual culture in the fictional city of Nordhamn.

> **Work in progress.** The game is moving from its original retro 2D look to real 3D, with a firm-management layer
> on top. Plan: [`docs/DESIGN-V2.md`](docs/DESIGN-V2.md). What's left: [`docs/TODO.md`](docs/TODO.md).

* 8 levels: THE STREETS, THE PUB, THE UNDERGROUND, THE AWAY END, THE CITY, THE INDUSTRIAL ZONE, THE DERBY and
  THE LAST STAND. Each has unique enemies, hazards, secrets, 5 lost scarves, a pin badge and a boss.
* 6 playable characters: The Last Hooligan, Big Mo, Little Stig, Terrace Tina, Fat Vic and The Old Boy (unlockable).
* **Two renderers:**
  * **3D (Three.js, beta):** wall blocks, real lights and shadows, ambient occlusion, bloom and colour grading.
    The characters are skinned Blender models on a 22-bone rig, animated by a layered animator: hand-keyed strike
    clips with fist IK, a procedural walk and run that doesn't slide, counter-twist and head tracking. Props are
    still flat billboards of the 2D art.
  * **2D (classic):** pre-rendered Blender sprites, procedural pixel art as fallback.
* Fully synthesized WebAudio soundtrack, crowd ambience and original terrace chants.
* Wardrobe unlocks, save/continue, level select, hall of fame, gamepad support.
* **The firm, in the fight:** 3–4 lads with their own stats and traits fight on your side. Give quick orders, or
  hold G for a slow-motion command mode with mouse orders. Nerve decides who stands and who runs, on both sides.
* **The firm, between matches:** THE ANCHOR, your local, is a walkable pub. Recruit at the bar, train in the back
  room, pick who gets on the coach at the map, and live with the consequences: injuries, reputation, police heat,
  banning orders, lads who walk out, and event cards.

## Play

No build step and no dependencies. Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 scripts/serve.py
```

Then open http://localhost:8642. Add `?play=N` to jump straight into level N (0-based).

**3D renderer (beta):** pick OPTIONS → GRAPHICS → 3D, or add `?renderer=3d`. It needs an internet connection: Three.js
is loaded from jsDelivr via an import map. Add `?post=0` to turn off post-processing on slow machines.

**The game loop:** NEW GAME starts a new firm and the first level. After every level (won or lost) you're back at
THE ANCHOR with a report. Walk to the map on the wall (or press **M**) to pick the next trip.

During development the game is **muted** by `src/devflags.js` (`DEV.mute = true`). Set it to `false` for sound.

### Controls (keyboard; a gamepad also works)
| | |
|---|---|
| Move | WASD / arrows (double-tap = run) |
| Punch L / R | J / K (or Z / X) |
| Kick | L (or C) |
| Jump | Space |
| Block (tap = parry) | Shift |
| Dodge | O |
| Grab / throw weapon | I |
| Pick up / use | E |
| Eat & drink | 1 2 3 |
| Kit bag / pause | Tab / Esc |
| **Firm:** with me / get into them / hold / sing up | R / T / H / Y |
| **Firm:** command mode (slow-mo, mouse orders) | hold G, 1-4 or click = select, right-click = have him / go there |
| **Pub:** use a station / talk to a lad, the map | E, M |

## Develop

* `node scripts/check.mjs [levelId] [--sim]`: validates levels and runs a headless simulation of the whole level
  (with the firm along).
* `node scripts/test_firm.mjs [levelId]`: headless test of the lads' orders, nerve, routs and knockouts.
* `node scripts/test_firmloop.mjs`: headless test of the pub → trip → level → pub loop and its consequences.
* `node scripts/env_coverage.mjs [levelId] [--missing]`: shows which walls, floors and props have Blender sprites.
* `tools/sprites.html?model=m_jacket`: character sprite viewer.
* Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/LEVELS.md`](docs/LEVELS.md), [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md),
  [`docs/DESIGN-V2.md`](docs/DESIGN-V2.md) (3D + firm plan), [`docs/TODO.md`](docs/TODO.md) (what's left).
* Code map for the new parts: `src/render3d/` (renderer, `characters2.js` animator, `clips.js` strike clips),
  `src/game/firm.js` (lads in the fight), `src/game/firmdata.js` (the persistent firm and its rules),
  `src/ui/firmhud.js` (orders, command mode), `src/ui/hub.js` + `src/content/hub.js` (THE ANCHOR).

### Rebuilding the Blender art (needs Blender 4.2+, Python with Pillow + numpy)

3D characters (skinned v2 models for the 3D renderer, about 1 s each):

```bash
python3 scripts/build_models_v2.py
```

2D character sprites:

```bash
python3 scripts/build_sprites.py --jobs 3
```

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/render_env.py -- scripts/blender/env_common.py
```

All clubs, firms, people and places are fictional.
