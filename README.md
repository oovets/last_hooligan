# THE LAST HOOLIGAN

*NO RULES. NO FEAR. JUST FOOTBALL.*

An original isometric beat 'em up / action adventure for the browser. It combines exploration (multi-area levels,
keys, items, secret passages) with brawler combat (combos, grabs, throws, weapons, crowds of enemies), and you lead
a firm: your lads fight beside you on your orders, and between matches you run them from your local pub. The theme
is 90s football-casual culture in the fictional city of Nordhamn.

> **Work in progress.** The game is moving from its original retro 2D look to real 3D, with a firm-management layer
> on top. Plan: [`docs/DESIGN-V2.md`](docs/DESIGN-V2.md). What's left: [`docs/TODO.md`](docs/TODO.md).

* 8 story levels in Nordhamn: THE STREETS, THE PUB, THE UNDERGROUND, THE AWAY END, THE CITY, THE INDUSTRIAL ZONE,
  THE DERBY and THE LAST STAND. Each has unique enemies, hazards, secrets, 5 lost scarves, a pin badge and a boss.
* **The Football Tour:** away days at real grounds, picked from a 1994/95 matchday-programme map in the pub and
  unlocked by your firm's reputation: STAMFORD BRIDGE (the Headhunters), ANFIELD, OLD TRAFFORD and IBROX, each with
  its own theme, boss and music. THE DEN (Millwall) is still to come.
* 7 playable characters: The Last Hooligan (Dez, dressed in the wardrobe), Big Mo, Little Stig, Kenny Showtime
  (masked, roided, ultraviolent), Big Al (six foot six, the toughest man in the firm, and the shirt comes off),
  Fat Vic and The Old Boy (unlockable).
* **Two renderers:**
  * **3D (Three.js, default):** wall blocks, real lights and shadows, ambient occlusion, bloom and colour grading.
    The characters are skinned Blender models on a 22-bone rig, animated by a layered animator: hand-keyed clips
    with fist IK for strikes, hit reactions, knockdowns, grabs, chokeholds and air attacks; a procedural fighting
    stance, side-steps, walk and run that blend by speed and don't slide; counter-twist and head tracking. Builds
    from lanky to husky to roided; trainers with three stripes, Stone Island badges and a woven Burberry check are
    drawn on the models. The menus show realistic hero models (MakeHuman via MPFB2) for Fat Vic and Big Al. Props are
    still flat billboards of the 2D art.
  * **2D (classic):** pre-rendered Blender sprites, procedural pixel art as fallback.
* Fully synthesized WebAudio soundtrack, crowd ambience and original terrace chants.
* **Wardrobe:** the casual labels (Stone Island, C.P. Company, Aquascutum, Burberry, Lacoste, Fred Perry, Sergio
  Tacchini, Fila, Ellesse, adidas, Lyle & Scott, Pringle, Henri Lloyd, Barbour, Paul & Shark, Levi's, Armani, Lois,
  Farah, Diadora, Reebok, New Balance, Clarks, Kangol) and KITS, whole looks in one go (the Perry boy, the scally,
  Stone Island casual, terrace 1996 ...).
* Save/continue, level select, hall of fame, gamepad support.
* **The firm, in the fight:** 3–4 lads with their own stats and traits fight on your side. Give quick orders, or
  hold G (pad: RT) for a slow-motion command mode with an order cursor you aim with the movement keys, stick or mouse. Lads look after you first and shout for help when they're in trouble. They fight *with* you: a lad pins a man so you get free hits, you and a lad on the same man trigger a DOUBLE TEAM launch, a throw towards a lad is caught straight into a pin, you can haul a knocked-out lad back up, and BACK TO ME pulls everyone round you. Nerve decides who stands and who runs, on both sides.
* **The firm, between matches:** THE ANCHOR, your local, is a walkable pub. Recruit at the bar, train in the back
  room, pick who gets on the coach at the map, and live with the consequences: injuries, reputation, police heat,
  banning orders, lads who walk out, and event cards.

## Play

No build step and no dependencies. Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 scripts/serve.py
```

Then open http://localhost:8642. Add `?play=N` to jump straight into level N (0-based).
`--public` serves on all interfaces (LAN / router port-forward, with caching and gzip) and `--root DIR` serves
another checkout or worktree, e.g. `python3 scripts/serve.py 8642 --public --root ../other-worktree`.

**3D renderer (default):** it needs an internet connection: Three.js is loaded from jsDelivr via an import map.
For the classic pixel-art renderer pick OPTIONS → GRAPHICS → 2D, or add `?renderer=2d`. Add `?post=0` to turn off post-processing on slow machines.

**The game loop:** NEW GAME starts a new firm and the first level. After every level (won or lost) you're back at
THE ANCHOR with a report. Walk to the map on the wall (or press **M**) to pick the next trip.

During development the game is **muted** by `src/devflags.js` (`DEV.mute = true`). Set it to `false` for sound.
`UNLOCK_ALL` in `src/save.js` is on for playtesting: every level, the whole tour and the whole wardrobe are open.
Set it to `false` to earn them.

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
| Pick up / use (Big Al: shirt off, or back on by the shirt) | E |
| Eat & drink | 1 2 3 |
| Kit bag / pause | Tab / Esc |
| **Firm:** with me / get into them / hold / sing up | R / T / H / Y (pad: d-pad down / up / left / right) |
| **Firm:** back to me (regroup) | N (pad: R3) |
| **Firm:** pick up a knocked-out lad | E standing over him (pad: L3) |
| **Firm:** command mode (slow-mo, order cursor) | hold G (pad: RT), aim with WASD / stick: J (X) = have him / go there / pick a lad, I (LB) = grab him (a lad pins him), K (Y) = cycle who gets the order, L (B) = with me, Space (A) = back to me |
| **Firm:** command mode with the mouse | 1-4 or click = select, drag = box select, right-click = have him / go there |
| **Pub:** use a station / talk to a lad, the map | E, M |

## Develop

* `node scripts/check.mjs [levelId] [--sim]`: validates levels and runs a headless simulation of the whole level
  (with the firm along).
* `node scripts/test_firm.mjs [levelId]`: headless test of the lads' orders, nerve, routs, knockouts and teamwork
  (Math.random is seeded: `FIRM_SEED=n` for another run).
* `node scripts/test_firmloop.mjs`: headless test of the pub → trip → level → pub loop and its consequences.
* `node scripts/env_coverage.mjs [levelId] [--missing]`: shows which walls, floors and props have Blender sprites.
* `tools/sprites.html?model=m_jacket`: character sprite viewer.
* `tools/anim3d.html`: 3D animation film strips. In the console:
  `filmstrip(['hurtFront', 'atk:spinKick', 'move:guard:left'], { frames: 7, facing: 0, look: 'vic' })`, then
  `shot('name')` saves the image to `build/shots/` (needs `scripts/serve.py`).
* Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/LEVELS.md`](docs/LEVELS.md), [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md),
  [`docs/DESIGN-V2.md`](docs/DESIGN-V2.md) (3D + firm plan), [`docs/TODO.md`](docs/TODO.md) (what's left).
* Code map for the new parts: `src/render3d/` (renderer, `characters2.js` animator, `clips.js` strike and state clips),
  `src/game/firm.js` (lads in the fight), `src/game/firmdata.js` (the persistent firm and its rules),
  `src/ui/firmhud.js` (orders, command mode), `src/ui/hub.js` + `src/content/hub.js` (THE ANCHOR).

### Rebuilding the Blender art (needs Blender 4.2+, Python with Pillow + numpy)

3D characters (skinned v2 models for the 3D renderer, builds m/h/f/b/l, about 30 s each, four at a time):

```bash
python3 scripts/build_models_v2.py [--only l_jacket,l_bare]
```

Realistic hero models for the menus (Blender 5.x with the MPFB 2.0.18 extension and the MakeHuman asset packs; see
the header of `scripts/blender/char_mpfb.py` and `assets/models/CREDITS.md`):

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/char_mpfb.py -- scripts/blender/bigal.json
```

2D character sprites:

```bash
python3 scripts/build_sprites.py --jobs 3
```

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/render_env.py -- scripts/blender/env_common.py
```

Nordhamn, its club and its story are fictional. The Football Tour visits real grounds, clubs and firms, and the
wardrobe carries real labels; every named person in the game (lads, bosses, faces) is invented. A private game for
friends, not for sale.
