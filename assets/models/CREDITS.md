# Model credits

Third-party assets that ship inside files in `assets/models/`. Everything else in this folder is generated from scratch by
`scripts/blender/char_v2.py`.

## hero/m_mpfb.glb (MPFB2 spike, built by `scripts/blender/char_mpfb.py`)

Built with **MPFB 2.0.18** (Blender extension by Joel Palmius / the MakeHuman community, GPL-3.0-or-later,
https://extensions.blender.org/add-ons/mpfb/). MPFB is only the tool: no MPFB code ships in the glb. The base mesh, the
macro shape targets and the `game_engine` rig weights come from MPFB's bundled MakeHuman data, which is CC0.

| Part in the glb | MakeHuman asset | Author | Licence | Pack / source |
|---|---|---|---|---|
| body shape, weights | MakeHuman base mesh + macro targets, `game_engine` rig weights | MakeHuman team | CC0 | bundled with MPFB 2.0.18 |
| skin (`ID_1`) | `young_caucasian_male` | makehuman_system | CC0 | makehuman_system_assets |
| eyes (`eye_brown`) | `low-poly` eyes, `brown` eye material | makehuman_system | CC0 | makehuman_system_assets |
| eyebrows (`ID_18`) | `eyebrow010` | makehuman_system | CC0 | makehuman_system_assets |
| eyelashes (`eyelashes`) | `eyelashes01` | makehuman_system | CC0 | makehuman_system_assets |
| teeth (`teeth`) | `teeth_base` | makehuman_system | CC0 | makehuman_system_assets |
| hair (`ID_2`) | `short01` | makehuman_system | CC0 | makehuman_system_assets |
| top (`ID_3`) | `namuhekam_male_polo_shirt` ("Polo") | namuhekam | CC0 | shirts01, http://www.makehumancommunity.org/node/2909 |
| trousers (`ID_7`) | `punkduck_male_classic_jeans` | punkduck | **CC-BY 4.0** | pants02, http://www.makehumancommunity.org/node/1655 |
| trainers (`ID_9`) | `punkduck_running_shoes_01` ("RunningShoes") | punkduck | **CC-BY 3.0** | shoes02, http://www.makehumancommunity.org/node/570 |

Attribution required by the CC-BY items (put this in the game's credits screen if the model ships):

> "Male classic jeans" and "Running shoes 01" by punkduck (makehumancommunity.org), licensed under CC BY 4.0 / CC BY 3.0.
> Modified: re-fitted, re-rigged, textures downscaled and colour-neutralised.

Asset packs from https://static.makehumancommunity.org/assets/assetpacks.html (files.makehumancommunity.org/asset_packs/),
downloaded 2026-11-13. Installed into MPFB's user data dir but not used in this model: skins02 (CC0), eyebrows01 (CC0),
eyelashes01 (CC0), hair01 (CC0), pants01 (CC0), shirts02 (CC-BY), and the rest of shoes02/pants02 (CC-BY).

## hero/vic.glb (Fat Vic, built by `scripts/blender/char_mpfb.py -- scripts/blender/vic.json`)

Same MPFB 2.0.18 pipeline, rig contract and export as `m_mpfb.glb` (build `h`). The body/face shape is the MakeHuman base
mesh with MPFB's bundled macro + detail targets (CC0; the list is in `vic.json`). His face/scalp colour (material `skin_vic`,
used as authored, not palette-tinted) is projected by `scripts/blender/vic_face.py` from 3D-scan reference renders of Vic
made by the owner from his own photos (not third-party material; the references live in `build/mpfb/vic_refs/`, which is
not committed); the rest of the skin is MakeHuman's CC0 `young_caucasian_male` map, re-toned to match.

| Part in the glb | MakeHuman asset | Author | Licence | Pack / source |
|---|---|---|---|---|
| body shape, weights | base mesh + macro/detail/expression targets, `game_engine` rig weights | MakeHuman team | CC0 | bundled with MPFB 2.0.18 |
| skin (`skin_vic`) | `young_caucasian_male` (body, re-toned) + projected likeness (head) | makehuman_system / owner | CC0 / owner's | makehuman_system_assets |
| eyes (`eye_blue`) | `low-poly` eyes, `blue` eye material | makehuman_system | CC0 | makehuman_system_assets |
| eyebrows (`ID_18`) | `eyebrow007` | makehuman_system | CC0 | makehuman_system_assets |
| teeth (`teeth`) | `teeth_base` | makehuman_system | CC0 | makehuman_system_assets |
| top (`ID_3`) | `namuhekam_male_polo_shirt` | namuhekam | CC0 | shirts01 |
| trousers (`ID_7`) | `punkduck_male_classic_jeans` | punkduck | **CC-BY 4.0** | pants02 |
| trainers (`ID_9`) | `punkduck_running_shoes_01` | punkduck | **CC-BY 3.0** | shoes02 |

No hair (he's shaved) and no eyelashes (his are pale; MakeHuman's lash cards read as mascara). The CC-BY attribution above
covers the jeans and trainers here too.
