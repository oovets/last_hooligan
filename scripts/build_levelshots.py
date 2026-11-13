#!/usr/bin/env python3
"""The Football Tour's level select pictures from the Blender stadium renders (scripts/blender/stadium.py):
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/blender/stadium.py -- build/stadiums
    python3 scripts/build_levelshots.py build/stadiums
-> assets/levelshots/<id>.jpg (800x450), cropped in on the ground. The story levels' pictures are shots from the game itself."""
import os, sys
from PIL import Image, ImageEnhance

SRC = sys.argv[1] if len(sys.argv) > 1 else 'build/stadiums'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'levelshots')
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(SRC, f)).convert('RGB')
    W, H = im.size
    k = 0.66                                  # keep the middle two thirds: the ground fills the card
    cw, ch = int(W * k), int(H * k)
    im = im.crop(((W - cw) // 2, (H - ch) // 2 + int(H * 0.02), (W + cw) // 2, (H + ch) // 2 + int(H * 0.02)))
    im = ImageEnhance.Brightness(im).enhance(1.12)
    im = im.resize((800, 450), Image.LANCZOS)
    p = os.path.join(OUT, f[:-4] + '.jpg')
    im.save(p, quality=82, optimize=True, progressive=True)
    print(p, os.path.getsize(p) // 1024, 'KB')
