#!/usr/bin/env python3
"""Build every character sprite atlas: export poses -> render in Blender (parallel) -> pack.

    /opt/anaconda3/bin/python3 scripts/build_sprites.py [--only m_jacket,h_tee] [--jobs 3] [--blender /path/to/Blender]

Needs: node, Blender 4.2+/5.x, python with Pillow + numpy.
Model naming: <build>_<torso>  build: m (normal) | h (heavy) | f (female);  torso: jacket | parka | tee | hivis.
Accessory layers (hair/hats/face/scarf) are rendered once per build on the <build>_jacket model and shared by the
other torsos of that build at runtime (src/game/sprites.js).
"""
import json, os, subprocess, sys, time, shutil
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'
args = sys.argv[1:]
if '--blender' in args: BLENDER = args[args.index('--blender') + 1]
JOBS = int(args[args.index('--jobs') + 1]) if '--jobs' in args else 3
ONLY = args[args.index('--only') + 1].split(',') if '--only' in args else None
# supplementary atlas: --suffix x1 --clips assets/sprites/clips_x1.json  -> <model>.x1.png/json + hands_<b>.x1.json
SUFFIX = args[args.index('--suffix') + 1] if '--suffix' in args else None
CLIPS = args[args.index('--clips') + 1] if '--clips' in args else 'assets/sprites/clips.json'
TMP = os.path.join(ROOT, 'build', 'sprite_renders')

HAIR_M = ['crop', 'shaved', 'curtains', 'mod', 'flattop', 'mohawk', 'spiky', 'ponytail', 'long', 'bob']
HATS = ['cap', 'beanie', 'bucket', 'helmet']
FACE = ['beard', 'tache', 'shades']
ACC = {
    'm': ['scarf'] + ['hair:' + h for h in HAIR_M] + ['hat:' + h for h in HATS] + ['face:' + f for f in FACE],
    'h': ['scarf'] + ['hair:' + h for h in ['crop', 'shaved', 'mohawk', 'flattop', 'curtains', 'long', 'mod']] + ['hat:' + h for h in HATS] + ['face:' + f for f in FACE],
    'f': ['scarf'] + ['hair:' + h for h in ['ponytail', 'long', 'bob', 'crop', 'curtains', 'mod', 'spiky', 'mohawk']] + ['hat:' + h for h in ['cap', 'beanie', 'bucket']] + ['face:shades'],
}
BUILD = {'m': dict(build=1.05, female=False), 'h': dict(build=1.45, female=False), 'f': dict(build=0.95, female=True)}
MODELS = {
    'm_jacket': ('m', 'jacket', True), 'm_parka': ('m', 'parka', False), 'm_tee': ('m', 'tee', False), 'm_hivis': ('m', 'hivis', False),
    'h_jacket': ('h', 'jacket', True), 'h_tee': ('h', 'tee', False), 'h_hivis': ('h', 'hivis', False),
    'f_jacket': ('f', 'jacket', True), 'f_tee': ('f', 'tee', False),
}

def run(cmd, **kw):
    print('$', ' '.join(cmd), flush=True)
    return subprocess.run(cmd, check=True, **kw)

def build_model(name):
    b, torso, with_acc = MODELS[name]
    oname = name + ('.' + SUFFIX if SUFFIX else '')
    out = os.path.join(TMP, oname)
    if os.path.isdir(out): shutil.rmtree(out)
    variants = [{'name': 'body', 'acc': []}]
    if with_acc:
        variants += [{'name': a.replace(':', '_'), 'acc': [a]} for a in ACC[b]]
    job = {'model': dict(BUILD[b], torso=torso), 'variants': variants, 'clips': CLIPS,
           'out': out, 'res': 128, 'resY': 160, 'dirs': [0, 1, 5, 6, 7], 'samples': 3}
    os.makedirs(TMP, exist_ok=True)
    jp = os.path.join(TMP, oname + '.job.json')
    json.dump(job, open(jp, 'w'))
    t = time.time()
    log = open(os.path.join(TMP, oname + '.log'), 'w')
    subprocess.run([BLENDER, '-b', '--factory-startup', '--python', os.path.join(ROOT, 'scripts/blender/render_char.py'), '--', jp],
                   check=True, stdout=log, stderr=subprocess.STDOUT)
    subprocess.run([sys.executable, os.path.join(ROOT, 'scripts/pack_sprites.py'), out, oname, '--clips', os.path.join(ROOT, CLIPS)], check=True)
    if with_acc:  # bake weapon-hand positions for this build
        hj = os.path.join(TMP, 'hands_%s%s.job.json' % (b, '.' + SUFFIX if SUFFIX else ''))
        json.dump(dict(job, variants=[], handsOnly=True, handsOut='assets/sprites/hands_%s%s.json' % (b, '.' + SUFFIX if SUFFIX else '')), open(hj, 'w'))
        subprocess.run([BLENDER, '-b', '--factory-startup', '--python', os.path.join(ROOT, 'scripts/blender/render_char.py'), '--', hj],
                       check=True, stdout=log, stderr=subprocess.STDOUT)
    print(f'== {oname} done in {time.time() - t:.0f}s', flush=True)
    return name

if __name__ == '__main__':
    if not SUFFIX: run(['node', os.path.join(ROOT, 'scripts/export_poses.mjs')])
    names = ONLY or list(MODELS)
    # accessory-heavy models first so the longest jobs start early
    names.sort(key=lambda n: -int(MODELS[n][2]))
    t0 = time.time()
    with ThreadPoolExecutor(JOBS) as ex:
        for r in ex.map(build_model, names): pass
    ip = os.path.join(ROOT, 'assets/sprites/index.json')
    idx = json.load(open(ip)) if os.path.exists(ip) else {}
    idx['models'] = sorted(n for n in MODELS if os.path.exists(os.path.join(ROOT, 'assets/sprites', n + '.json')))
    extras = set(idx.get('extras', []))
    for f in os.listdir(os.path.join(ROOT, 'assets/sprites')):
        parts = f.split('.')
        if len(parts) == 3 and parts[2] == 'json' and parts[0] in MODELS: extras.add(parts[1])
    idx['extras'] = sorted(extras)
    json.dump(idx, open(ip, 'w'))
    print(f'ALL DONE in {time.time() - t0:.0f}s')
