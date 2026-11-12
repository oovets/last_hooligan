#!/usr/bin/env python3
"""Pack Blender-rendered character frames into a recolorable sprite atlas.

    python3 scripts/pack_sprites.py <render_dir> <model_name> [--clips assets/sprites/clips.json]

Reads <render_dir>/manifest.json + <variant>/d<dir>/{id,sh}_NNNN.png written by scripts/blender/render_char.py.
Writes assets/sprites/<model_name>.png and .json.

Atlas pixel encoding: R = light/shade (0..255), G = material id * 8, B = 0, A = 255 (opaque) or 0.
Variant 'body' keeps every pixel; accessory variants keep only their own material ids (so occlusion by the body is baked in).
Needs Pillow + numpy (e.g. the anaconda python).
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
src, model = sys.argv[1], sys.argv[2]
clips_path = os.path.join(ROOT, 'assets/sprites/clips.json')
if '--clips' in sys.argv: clips_path = sys.argv[sys.argv.index('--clips') + 1]
man = json.load(open(os.path.join(src, 'manifest.json')))
clips_src = json.load(open(clips_path))['clips']

ACC_IDS = {'hair': {2}, 'hat': {14, 15, 19}, 'face:beard': {18}, 'face:tache': {18}, 'face:shades': {19}, 'scarf': {11, 12}}
def keep_ids(variant, accs):
    if not accs: return None
    ids = set()
    for a in accs:
        if a in ACC_IDS: ids |= ACC_IDS[a]
        elif a.split(':')[0] in ACC_IDS: ids |= ACC_IDS[a.split(':')[0]]
    return ids

frames = man['frames']
dirs = man['dirs']
pieces = []   # (variant, fi, di, array)
for var, accs in man['variants'].items():
    keep = keep_ids(var, accs)
    for di, d in enumerate(dirs):
        for fi in range(len(frames)):
            p_id = os.path.join(src, var, 'd%d' % d, 'id_%04d.png' % fi)
            p_sh = os.path.join(src, var, 'd%d' % d, 'sh_%04d.png' % fi)
            a_id = np.array(Image.open(p_id).convert('RGBA'))
            a_sh = np.array(Image.open(p_sh).convert('RGBA'))
            ids = np.clip(np.round(a_id[..., 0] / 10.0), 0, 31).astype(np.uint8)
            mask = (a_id[..., 3] > 127) & (ids > 0)
            if keep is not None:
                mask &= np.isin(ids, list(keep))
            out = np.zeros(a_id.shape, np.uint8)
            # shade: un-premultiply edge pixels of the AA'd eevee pass by its own alpha
            al = a_sh[..., 3].astype(np.float32)
            sh = np.where(al > 8, np.clip(a_sh[..., 0].astype(np.float32) * 255.0 / np.maximum(al, 1), 0, 255), a_sh[..., 0])
            out[..., 0] = sh.astype(np.uint8)
            out[..., 1] = ids * 8
            out[..., 3] = np.where(mask, 255, 0)
            out[~mask] = 0
            ys, xs = np.nonzero(mask)
            if len(xs) == 0:
                pieces.append((var, fi, di, None, 0, 0)); continue
            x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            pieces.append((var, fi, di, out[y0:y1, x0:x1], int(x0), int(y0)))

# shelf packing
W = 2048
order = sorted([i for i, p in enumerate(pieces) if p[3] is not None], key=lambda i: -pieces[i][3].shape[0])
pos = {}
x = y = shelf_h = 0
for i in order:
    h, w = pieces[i][3].shape[:2]
    if x + w > W: x = 0; y += shelf_h + 1; shelf_h = 0
    pos[i] = (x, y)
    x += w + 1
    shelf_h = max(shelf_h, h)
H = y + shelf_h + 1
atlas = np.zeros((H, W, 4), np.uint8)
for i, (px, py) in pos.items():
    a = pieces[i][3]
    atlas[py:py + a.shape[0], px:px + a.shape[1]] = a

# metadata
clip_meta = {}
idx = 0
for fi, (name, k) in enumerate(frames):
    if name not in clip_meta:
        c = clips_src[name]
        clip_meta[name] = {'kind': c['kind'], 'dur': c['dur'], 'start': fi, 'n': 0}
    clip_meta[name]['n'] += 1
layers = {}
LKEY = {var: (','.join(accs) if accs else 'body') for var, accs in man['variants'].items()}
for i, (var, fi, di, a, ox, oy) in enumerate(pieces):
    L = layers.setdefault(LKEY[var], [[None] * len(dirs) for _ in frames])
    if a is None: L[fi][di] = 0
    else:
        px, py = pos[i]
        L[fi][di] = [px, py, int(a.shape[1]), int(a.shape[0]), ox, oy]
meta = {'model': model, 'res': man['res'], 'anchor': man['anchor'], 'dirs': dirs, 'clips': clip_meta,
        'layers': layers, 'accessories': man['variants'], 'atlas': [W, H]}
os.makedirs(os.path.join(ROOT, 'assets/sprites'), exist_ok=True)
Image.fromarray(atlas).save(os.path.join(ROOT, 'assets/sprites', model + '.png'), optimize=True)
json.dump(meta, open(os.path.join(ROOT, 'assets/sprites', model + '.json'), 'w'), separators=(',', ':'))
print('packed', model, 'atlas', W, 'x', H, 'pieces', len(pos), 'layers', list(layers))
