# THE LAST HOOLIGAN

*NO RULES. NO FEAR. JUST FOOTBALL.*

An original retro isometric beat 'em up / action adventure for the browser. It combines exploration in the style of
8-bit isometric adventures (multi-area levels, keys, items, secret passages) with 16-bit brawler combat
(combos, grabs, throws, weapons, crowds of enemies). The theme is 90s football-casual culture in the fictional
city of Nordhamn.

* 8 levels: THE STREETS, THE PUB, THE UNDERGROUND, THE AWAY END, THE CITY, THE INDUSTRIAL ZONE, THE DERBY and
  THE LAST STAND. Each has unique enemies, hazards, secrets, 5 lost scarves, a pin badge and a boss.
* 6 playable characters: The Last Hooligan, Big Mo, Little Stig, Terrace Tina, Fat Vic and The Old Boy (unlockable).
* Pre-rendered **Blender** graphics. Characters are 3D models rigged from the game's pose library and rendered in
  5 directions (mirrored to 8). They are recoloured at runtime, so the wardrobe and enemy variety work on the
  same atlases. Walls, floors and props are rendered from the same isometric camera.
* Fully synthesized WebAudio soundtrack, crowd ambience and original terrace chants.
* Wardrobe unlocks, save/continue, level select, hall of fame, gamepad support.
* **The firm** (see [`docs/DESIGN-V2.md`](docs/DESIGN-V2.md)): your lads fight alongside you and follow orders. Between
  trips you're at THE ANCHOR, your local, where you recruit, train, pick who travels and live with the consequences
  (injuries, reputation, police heat, event cards).

## Play

No build step and no dependencies. Serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 scripts/serve.py
```

Then open http://localhost:8642. Add `?play=N` to jump straight into level N (0-based).

**3D renderer (beta, phase A of [`docs/DESIGN-V2.md`](docs/DESIGN-V2.md)):** add `?renderer=3d` or pick
OPTIONS → GRAPHICS → 3D. It uses Three.js (loaded from jsDelivr via an import map) with real lighting and shadows.

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

## Develop

* `node scripts/check.mjs [levelId] [--sim]`: validates levels and runs a headless simulation of the whole level.
* `node scripts/env_coverage.mjs [levelId] [--missing]`: shows which walls, floors and props have Blender sprites.
* `tools/sprites.html?model=m_jacket`: character sprite viewer.
* Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/LEVELS.md`](docs/LEVELS.md), [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md).

### Rebuilding the Blender art (needs Blender 4.2+, Python with Pillow + numpy)

```bash
python3 scripts/build_sprites.py --jobs 3
```

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/render_env.py -- scripts/blender/env_common.py
```

All clubs, firms, people and places are fictional.
