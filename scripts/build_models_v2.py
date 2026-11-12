#!/usr/bin/env python3
"""Export the v2 characters (skinned, scripts/blender/char_v2.py) for the 3D renderer.

    python3 scripts/build_models_v2.py [--only m_jacket] [--blender /path/to/Blender]

Writes assets/models/v2/<build>_<torso>.glb + assets/models/v2/index.json.
"""
import json, os, subprocess, sys, time
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
args = sys.argv[1:]
BLENDER = args[args.index('--blender') + 1] if '--blender' in args else '/Applications/Blender.app/Contents/MacOS/Blender'
ONLY = args[args.index('--only') + 1].split(',') if '--only' in args else None
MODELS = ['m_jacket', 'm_parka', 'm_tee', 'm_hivis', 'h_jacket', 'h_tee', 'h_hivis', 'f_jacket', 'f_tee']
TMP = os.path.join(ROOT, 'build', 'model_v2')
os.makedirs(TMP, exist_ok=True)
for name in ONLY or MODELS:
    b, torso = name.split('_')
    jp = os.path.join(TMP, name + '.json')
    json.dump({'build': b, 'torso': torso, 'out': 'assets/models/v2/%s.glb' % name}, open(jp, 'w'))
    t = time.time()
    r = subprocess.run([BLENDER, '-b', '--factory-startup', '--python', os.path.join(ROOT, 'scripts/blender/char_v2.py'), '--', jp], capture_output=True, text=True)
    ok = 'EXPORTED' in r.stdout
    print(('ok  ' if ok else 'FAIL'), name, '%.1fs' % (time.time() - t), flush=True)
    if not ok: print(r.stdout[-1500:], r.stderr[-1500:])
have = sorted(n for n in MODELS if os.path.exists(os.path.join(ROOT, 'assets/models/v2', n + '.glb')))
json.dump({'models': have}, open(os.path.join(ROOT, 'assets/models/v2/index.json'), 'w'))
print('index:', have)
