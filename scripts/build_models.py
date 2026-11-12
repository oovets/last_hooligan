#!/usr/bin/env python3
"""Export every character model as a rigged glTF for the 3D renderer (phase B, docs/DESIGN-V2.md).

    python3 scripts/build_models.py [--only m_jacket,h_tee] [--blender /path/to/Blender]

Writes assets/models/<build>_<torso>.glb (bind pose, all accessories) + assets/models/index.json.
Uses the same model table and builder as the sprite pipeline (scripts/build_sprites.py, scripts/blender/render_char.py).
"""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from build_sprites import MODELS, BUILD, BLENDER as DEFAULT_BLENDER

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
args = sys.argv[1:]
BLENDER = args[args.index('--blender') + 1] if '--blender' in args else DEFAULT_BLENDER
ONLY = args[args.index('--only') + 1].split(',') if '--only' in args else None
TMP = os.path.join(ROOT, 'build', 'model_export')
os.makedirs(TMP, exist_ok=True)

done = []
for name in ONLY or list(MODELS):
    b, torso, _ = MODELS[name]
    job = {'model': dict(BUILD[b], torso=torso), 'export': 'assets/models/%s.glb' % name}
    jp = os.path.join(TMP, name + '.job.json')
    json.dump(job, open(jp, 'w'))
    t = time.time()
    r = subprocess.run([BLENDER, '-b', '--factory-startup', '--python', os.path.join(ROOT, 'scripts/blender/render_char.py'), '--', jp],
                       capture_output=True, text=True)
    ok = 'EXPORTED' in r.stdout
    print(('ok  ' if ok else 'FAIL'), name, '%.1fs' % (time.time() - t), flush=True)
    if not ok: print(r.stdout[-2000:], r.stderr[-2000:])
    else: done.append(name)

ip = os.path.join(ROOT, 'assets/models/index.json')
have = sorted(n for n in MODELS if os.path.exists(os.path.join(ROOT, 'assets/models', n + '.glb')))
json.dump({'models': have}, open(ip, 'w'))
print('index:', have)
