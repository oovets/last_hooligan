# Art pipeline: Blender → recolourable sprites

The game's logical resolution is 640×360. The canvas backing store is **2×** (1280×720, set in `src/main.js`).
Procedural pixel art is drawn through a 2× transform, so it keeps its chunky look. Blender sprites are rendered at
2× and blitted at half size, so they show full detail.

## Characters (`scripts/build_sprites.py`)

1. `node scripts/export_poses.mjs` imports **all** content, including animations and attack poses registered by
   levels, bosses and characters. It samples every animation into discrete clips: `assets/sprites/clips.json`.
2. `scripts/blender/render_char.py` builds a stylised character from meshes on a joint rig
   (hip, torso, head, shoulders, elbows, hips, knees, ankles). Rotations come straight from the 2D pose angles
   (sagittal plane; `N` limbs = the character's right side).
   - Each frame is rendered in 5 directions: game-world facings 0, 1, 5, 6 and 7. The runtime mirrors these to 8.
   - Each frame gets two passes:
     - **ID pass** (Workbench, flat, no AA): every material outputs `id * 10` in the red channel.
     - **Light pass** (Eevee, white override material): key light from the upper-left, rim light and AO.
   - **Body variants:** `<build>_<torso>`. Builds are `m` normal, `h` heavy and `f` female. Torsos are
     jacket, parka, tee and hivis.
   - **Accessory variants** (hair, hats, beard, tache, shades, scarf) are rendered once per build on the
     `<build>_jacket` model, as body+accessory renders.
3. `scripts/pack_sprites.py` trims every frame and keeps only the accessory's own material IDs for accessory
   layers, so occlusion by arms and hands is baked in. It packs everything into `assets/sprites/<model>.png` +
   `.json`. Pixel encoding: R = light, G = id×8, A = mask.
4. A `handsOnly` pass bakes the projected weapon-hand and elbow positions to `assets/sprites/hands_<build>.json`,
   so held weapons follow the fist.

At runtime, `src/game/sprites.js`:
- maps a doll LOOK to a model, accessory layers and a palette;
- composes body + layers, then recolours with a 6-band toon ramp, adds 1 px outlines and material-boundary
  darkening;
- caches composed frames (LRU);
- maps Fighter state and time to a clip frame.

If no atlas is loaded, `src/game/doll.js` (procedural) is the fallback.

Material IDs: 1 skin, 2 hair, 3 jacket, 4 trim, 5 lining, 6 shirt, 7 pants, 8 pantsTrim, 9 shoes, 10 sole,
11/12 scarf, 13 eye, 14/15 hat, 16 glove, 17 band, 18 facial, 19 shades, 20 mouth, 21 belt, 22 stripe.

## 3D characters (`scripts/build_models.py`)

The 3D renderer (`?renderer=3d`) uses the same character builder. `python3 scripts/build_models.py [--only m_jacket]`
runs `render_char.py` with `{"model": {...}, "export": "assets/models/<model>.glb"}`. That writes the rigged character
in its bind pose, with every accessory included and joints as plain glTF nodes, and updates `assets/models/index.json`.
`src/render3d/characters.js` poses the joints every frame from `Fighter.getPose()`, using the same conversion as
`set_pose()` (rotation about Blender +Y by a = rotation about three +Z by −a). It shows accessories by their
`acc:<layer>` extras and recolours by material name (`ID_<n>` → palette from `specForLook`).

## 3D characters v2 (`scripts/build_models_v2.py`)

`python3 scripts/build_models_v2.py [--only m_jacket]` runs `scripts/blender/char_v2.py` for each model and writes
`assets/models/v2/<build>_<torso>.glb`. Each file holds a skinned body grown from a joint graph with the Skin modifier
and auto-weighted to a 22-bone humanoid rig (`root`, `hips`, `spine`, `chest`, `neck`, `head`, plus
`shoulder`/`upperArm`/`forearm`/`hand`/`thigh`/`shin`/`foot`/`toe` with `_L`/`_R`). Clothing regions are `ID_<n>`
materials. The head and its accessories are rigid on `head`, and the scarf is on `chest`. Bone-local axes follow
Blender: limbs swing forward about X, out to the side about Z and twist about Y. A job with `"preview": "x.png"`
renders a pose sheet from the game's camera angle.
`src/render3d/characters2.js` animates the rig (see the comment at the top of that file).

## Environment (`scripts/blender/render_env.py`)

Piece modules (`scripts/blender/env_<theme>.py`) define `PIECES`. Each piece is a wall (per style × height ×
variant), a floor patch (n×n tiles, seamless) or a prop (per variant). The camera matches the game's 2:1
projection exactly: 1 tile = 1 m and 1 height unit = 1.0206 m.

Output goes to `assets/env/{walls,floors,props}/`. Each module writes `assets/env/parts/<module>.json`, and
`assets/env/index.json` is rebuilt from all parts.

At runtime, `src/engine/envsprites.js` loads everything at boot:
- `drawWallBlock` uses the wall sprite;
- `renderFloor` samples floor patches into a 2× floor bake;
- `World.drawProp` uses prop sprites (plus an optional `def.overlay` for animated details).

Anything missing falls back to the procedural styles. `node scripts/env_coverage.mjs --missing` lists the gaps.
