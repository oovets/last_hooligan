# Level 7 (THE DERBY) environment pieces for scripts/blender/render_env.py.
# Game coords: x,y in tiles, z in height units. Visible wall faces: +x (screen right) and +y (screen left).
# Everything is original: an invented club (red/white "Anchors"), abstract hoardings, no real brands.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from env_common import _h, w_tiled
import bpy, bmesh
from mathutils import Vector

RED, WHITE, BLUE, YEL, BLK = '#c8102e', '#f4f1e8', '#1f4fb4', '#f0c020', '#141414'

# ------------------------------------------------------------------ helpers
def _mk(ctx, bm, mat, name, loc, rot=None, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); ctx.link(ob); ob.location = loc
    if rot is not None: ob.rotation_euler = rot
    return ob

def beam(ctx, p0, p1, r, mat, seg=8, square=False):
    """bar between two game points (gx, gy, gz units); r = half thickness in metres"""
    a, b = ctx.G(*p0), ctx.G(*p1)
    d = b - a; L = max(d.length, 1e-4)
    bm = bmesh.new()
    if square:
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts: v.co.x *= 2 * r; v.co.y *= 2 * r; v.co.z *= L
    else:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=L)
    return _mk(ctx, bm, mat, 'beam', (a + b) / 2, d.to_track_quat('Z', 'Y').to_euler(), smooth=not square)

def cone_between(ctx, p0, p1, r0, r1, mat, seg=14):
    a, b = ctx.G(*p0), ctx.G(*p1)
    d = b - a; L = d.length
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=L)
    return _mk(ctx, bm, mat, 'cone', (a + b) / 2, d.to_track_quat('Z', 'Y').to_euler(), smooth=True)

def poly(ctx, pts, mat, name='poly'):
    """single flat face through game points [(gx, gy, gz), ...]"""
    bm = bmesh.new()
    vs = [bm.verts.new(ctx.G(*p)) for p in pts]
    bm.faces.new(vs)
    return _mk(ctx, bm, mat, name, (0, 0, 0))

def slab(ctx, pts, mat, t=0.015):
    """quad with thickness t (metres, along world Z) — canopy/awning stripes"""
    bm = bmesh.new()
    top = [bm.verts.new(ctx.G(*p) + Vector((0, 0, t / 2))) for p in pts]
    bot = [bm.verts.new(ctx.G(*p) - Vector((0, 0, t / 2))) for p in pts]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([top[i], bot[i], bot[j], top[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mk(ctx, bm, mat, 'slab', (0, 0, 0))

def wheel(ctx, gx, gy, gz, r, w, mat, hub=None):
    """wheel with its axle along game y"""
    beam(ctx, (gx, gy - w / 2, gz), (gx, gy + w / 2, gz), r, mat, seg=16)
    if hub: beam(ctx, (gx, gy + w / 2, gz), (gx, gy + w / 2 + 0.01, gz), r * 0.5, hub, seg=12)

def alpha_mat(ctx, key, color, alpha, rough=0.08, emit=None, es=0.4):
    if key in ctx.mats: return ctx.mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*_lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Alpha'].default_value = alpha
    if emit:
        b.inputs['Emission Color'].default_value = (*_lin(emit), 1); b.inputs['Emission Strength'].default_value = es
    for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        try: setattr(m, attr, val)
        except Exception: pass
    try: m.use_backface_culling = False
    except Exception: pass
    ctx.mats[key] = m
    return m

def _lin(c):
    if isinstance(c, str): c = _h(c)
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def _math(N, L, op, a, b=None, val=None):
    m = N.new('ShaderNodeMath'); m.operation = op
    if isinstance(a, (int, float)): m.inputs[0].default_value = a
    else: L.new(a, m.inputs[0])
    if b is not None:
        if isinstance(b, (int, float)): m.inputs[1].default_value = b
        else: L.new(b, m.inputs[1])
    return m.outputs[0]

def stripe_mat(ctx, key, c1, c2, freq, zk, duty=0.25, rough=0.55, emit=0.0):
    """diagonal stripes on wall faces: fract(((x+y) + z*zk) * freq) < duty -> c2 else c1"""
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(co, sep.inputs[0])
    s = _math(N, L, 'ADD', sep.outputs[0], sep.outputs[1])
    s = _math(N, L, 'ADD', s, _math(N, L, 'MULTIPLY', sep.outputs[2], zk))
    f = _math(N, L, 'FRACT', _math(N, L, 'MULTIPLY', s, freq))
    k = _math(N, L, 'LESS_THAN', f, duty)
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*_lin(c1), 1); mix.inputs['B'].default_value = (*_lin(c2), 1)
    L.new(k, mix.inputs['Factor']); L.new(mix.outputs['Result'], b.inputs['Base Color'])
    if emit:
        L.new(mix.outputs['Result'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    b.inputs['Roughness'].default_value = rough
    ctx.mats[key] = m
    return m

def mesh_mat(ctx, key, color, freq=4.0, zk=1.0, wire=0.2):
    """chain-link style diamond wire mask (binary alpha) on a face"""
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(co, sep.inputs[0])
    s = _math(N, L, 'ADD', sep.outputs[0], sep.outputs[1])
    z = _math(N, L, 'MULTIPLY', sep.outputs[2], zk)
    a1 = _math(N, L, 'LESS_THAN', _math(N, L, 'FRACT', _math(N, L, 'MULTIPLY', _math(N, L, 'ADD', s, z), freq)), wire)
    a2 = _math(N, L, 'LESS_THAN', _math(N, L, 'FRACT', _math(N, L, 'MULTIPLY', _math(N, L, 'SUBTRACT', s, z), freq)), wire)
    L.new(_math(N, L, 'MAXIMUM', a1, a2), b.inputs['Alpha'])
    b.inputs['Base Color'].default_value = (*_lin(color), 1)
    b.inputs['Metallic'].default_value = 0.7; b.inputs['Roughness'].default_value = 0.35
    for attr, val in (('surface_render_method', 'DITHERED'), ('blend_method', 'HASHED')):
        try: setattr(m, attr, val)
        except Exception: pass
    ctx.mats[key] = m
    return m

def grid_mat(ctx, key, c1, c2, cell, rough=0.7, bump=0.0, tint=None):
    """checker of `cell` metres on object XY (floors)"""
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(co, sep.inputs[0])
    fx = _math(N, L, 'FLOOR', _math(N, L, 'DIVIDE', sep.outputs[0], cell))
    fy = _math(N, L, 'FLOOR', _math(N, L, 'DIVIDE', sep.outputs[1], cell))
    k = _math(N, L, 'FLOORED_MODULO', _math(N, L, 'ADD', fx, fy), 2.0)
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*_lin(c1), 1); mix.inputs['B'].default_value = (*_lin(c2), 1)
    L.new(k, mix.inputs['Factor']); L.new(mix.outputs['Result'], b.inputs['Base Color'])
    if bump:
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
        L.new(k, bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    ctx.mats[key] = m
    return m

def tile_mat(ctx, key, c1, c2, grout, size=0.25, rough=0.2):
    m = ctx.brick_mat(key, _h(c1), _h(c2), _h(grout), brick_w=size, brick_h=size * ctx.UNIT * 0.98, mortar_size=0.012, rough=rough, bump=0.15)
    for n in m.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeTexBrick': n.offset = 0.0
    return m

def on_face(ctx, face, a, z, w, h, mat, t=0.02, out=0.0):
    """panel on a visible face: 'y' = +y face (along x from a), 'x' = +x face (along y from a)"""
    if face == 'y': return ctx.box(a, 1 + out - 0.005, z, w, t, h, mat)
    return ctx.box(1 + out - 0.005, a, z, t, w, h, mat)

def ring(ctx, z, hh, mat, out=0.015):
    """band wrapping both visible faces (and the top edge as a small ledge)"""
    return ctx.box(0, 0, z, 1 + out, 1 + out, hh + 0.004, mat)

def crest(ctx, face, a, z, size):
    """original club roundel: red disc, white ring, simple anchor shape"""
    r = size / 2
    red, white = ctx.mat('crestRed', _h(RED), 0.45, emit=_h(RED), emit_strength=0.15), ctx.mat('crestWhite', _h(WHITE), 0.4)
    gold = ctx.mat('crestGold', _h('#e0b040'), 0.3, 0.6)
    if face == 'y':
        P = lambda u, zz, off: (a + r + u, 1.0 + off, z + r / ctx.UNIT + zz / ctx.UNIT)
        beam(ctx, P(0, 0, -0.01), P(0, 0, 0.025), r, gold, seg=24)
        beam(ctx, P(0, 0, 0.025), P(0, 0, 0.035), r * 0.86, white, seg=24)
        beam(ctx, P(0, 0, 0.035), P(0, 0, 0.045), r * 0.72, red, seg=24)
        ctx.box(a + r - 0.02, 1.045, z + (r - r * 0.5) / ctx.UNIT, 0.04, 0.01, r * 0.95 / ctx.UNIT, white)
        ctx.box(a + r - r * 0.3, 1.045, z + (r + r * 0.25) / ctx.UNIT, r * 0.6, 0.01, 0.035, white)
        ctx.box(a + r - r * 0.45, 1.045, z + (r - r * 0.5) / ctx.UNIT, r * 0.9, 0.01, 0.035, white)
    else:
        P = lambda u, zz, off: (1.0 + off, a + r + u, z + r / ctx.UNIT + zz / ctx.UNIT)
        beam(ctx, P(0, 0, -0.01), P(0, 0, 0.025), r, gold, seg=24)
        beam(ctx, P(0, 0, 0.025), P(0, 0, 0.035), r * 0.86, white, seg=24)
        beam(ctx, P(0, 0, 0.035), P(0, 0, 0.045), r * 0.72, red, seg=24)
        ctx.box(1.045, a + r - 0.02, z + (r - r * 0.5) / ctx.UNIT, 0.01, 0.04, r * 0.95 / ctx.UNIT, white)
        ctx.box(1.045, a + r - r * 0.3, z + (r + r * 0.25) / ctx.UNIT, 0.01, r * 0.6, 0.035, white)
        ctx.box(1.045, a + r - r * 0.45, z + (r - r * 0.5) / ctx.UNIT, 0.01, r * 0.9, 0.035, white)

# ------------------------------------------------------------------ walls
def w_facade(ctx, h, v):
    brick = ctx.brick_mat('dfBrick%d' % (v % 3), _h('#8a3430'), _h('#7a2c2a'), _h('#3a1c1c'), seed_off=v * 0.29)
    stone = ctx.noise_mat('dfStone', _h('#e8e2d4'), _h('#cfc8b8'), scale=26, bump=0.15)
    corn = ctx.mat('dfCornice', _h('#4a1a1e'), 0.6)
    dark = ctx.mat('dfDark', _h('#2a0e10'), 0.8)
    plinth = ctx.noise_mat('dfPlinth', _h('#3a2a2a'), _h('#2a1e1e'), scale=30, bump=0.3)
    ctx.box(0, 0, 0, 1, 1, h, brick)
    ring(ctx, 0, 0.15, plinth, 0.02)
    ring(ctx, h - 0.7, 0.25, stone, 0.02)                             # white stone band
    ring(ctx, h - 0.6, 0.05, ctx.mat('dfPin', _h(RED), 0.5), 0.025)  # red pinstripe
    ring(ctx, h - 0.25, 0.1, dark, 0.01)
    ring(ctx, h - 0.15, 0.15, corn, 0.045)                           # cornice overhang
    ctx.box(0, 0, h - 0.001, 1.045, 1.045, 0.01, grid_top(ctx))
    rivet = ctx.mat('dfRivet', _h('#5a5a62'), 0.3, 0.9)
    for i in range(5):
        ctx.sphere(0.1 + i * 0.2, 1.022, h - 0.575, 0.012, rivet); ctx.sphere(1.022, 0.1 + i * 0.2, h - 0.575, 0.012, rivet)
    k = v % 6
    if k in (0, 3):  # arched window slots, dark and recessed with iron bars
        glass = ctx.mat('dfSlot', _h('#141820'), 0.2, 0.3, emit=_h('#ffb060') if k == 3 else None, emit_strength=0.5)
        frame = ctx.mat('dfSlotFr', _h('#2a2420'), 0.6)
        for face in ('x', 'y'):
            on_face(ctx, face, 0.36, 0.42, 0.28, 0.85, frame, t=0.03)
            on_face(ctx, face, 0.39, 0.45, 0.22, 0.8, glass, t=0.035)
            for j in range(3): on_face(ctx, face, 0.43 + j * 0.065, 0.45, 0.015, 0.8, rivet, t=0.045)
            on_face(ctx, face, 0.34, 0.36, 0.32, 0.07, stone, t=0.05)   # sill
    elif k == 1:     # club crest roundel
        crest(ctx, 'y', 0.25, 0.4, 0.5)
        crest(ctx, 'x', 0.25, 0.4, 0.5)
    elif k == 2:     # cast-iron drainpipe + gate number plate
        pipe = ctx.mat('dfPipe', _h('#2a2a2e'), 0.45, 0.4)
        ctx.cyl(0.88, 1.04, 0, 0.035, h - 0.2, pipe, 10)
        ctx.box(0.82, 1.0, h - 0.3, 0.12, 0.08, 0.1, pipe)
        on_face(ctx, 'x', 0.3, 1.0, 0.4, 0.3, ctx.mat('dfPlate', _h('#f4f1e8'), 0.4), t=0.02)
        on_face(ctx, 'x', 0.34, 1.05, 0.32, 0.2, ctx.mat('dfPlateR', _h(RED), 0.4), t=0.03)
    elif k == 4:     # poster frames (abstract match-day posters)
        for face, col in (('y', '#1f4fb4'), ('x', '#f0c020')):
            on_face(ctx, face, 0.28, 0.45, 0.44, 0.7, ctx.mat('dfPosterF', _h('#1a1a1e'), 0.5), t=0.02)
            on_face(ctx, face, 0.31, 0.5, 0.38, 0.6, ctx.mat('dfPoster' + col, _h(col), 0.6), t=0.025)
            on_face(ctx, face, 0.34, 0.85, 0.32, 0.18, ctx.mat('dfPosterW', _h(WHITE), 0.6), t=0.03)
    # k == 5: plain

def grid_top(ctx):
    return ctx.noise_mat('dfTop', _h('#5a2228'), _h('#3a1418'), scale=12, bump=0.3)

def w_standwall(ctx, h, v):
    conc = ctx.mat('swBody', _h('#3a3846'), 0.75)
    groove = ctx.mat('swGroove', _h('#24222c'), 0.9)
    rib = ctx.mat('swRib', _h('#34323e'), 0.7)
    red = ctx.mat('swRed', _h(RED), 0.5); white = ctx.mat('swWhite', _h(WHITE), 0.5)
    cap = ctx.mat('swCap', _h('#8a8a92'), 0.5, 0.3)
    ctx.box(0, 0, 0, 1, 1, h, conc)
    ctx.box(0, 0, h + 0.006, 1.04, 1.04, 0.004, grid_mat(ctx, 'swTop', '#2e2c36', '#36343e', 0.125, 0.85))
    # grooves every quarter tile, ribbed lower half
    for i in range(1, 4):
        on_face(ctx, 'y', i * 0.25 - 0.012, 0, 0.024, h - 0.5, groove, t=0.01)
        on_face(ctx, 'x', i * 0.25 - 0.012, 0, 0.024, h - 0.5, groove, t=0.01)
    lo = h * 0.45
    for i in range(8):
        on_face(ctx, 'y', i * 0.125 + 0.02, 0.05, 0.05, lo, rib, t=0.025)
        on_face(ctx, 'x', i * 0.125 + 0.02, 0.05, 0.05, lo, rib, t=0.025)
    ring(ctx, 0, 0.05, ctx.mat('swFoot', _h('#1a1820'), 0.9), 0.03)
    # red-white-red bands + capping
    ring(ctx, h - 0.5, 0.15, red, 0.02)
    ring(ctx, h - 0.35, 0.1, white, 0.02)
    ring(ctx, h - 0.25, 0.15, red, 0.02)
    ring(ctx, h - 0.1, 0.1, cap, 0.04)
    rnd = random.Random(v * 31 + int(h * 10))
    scuff = ctx.mat('swScuff', _h('#4a4856'), 0.95)
    for _ in range(3):
        face = rnd.choice('xy'); on_face(ctx, face, rnd.random() * 0.8, rnd.random() * max(0.1, h - 0.8), 0.06 + rnd.random() * 0.1, 0.05, scuff, t=0.03)
    k = v % 4
    if k == 1 and h >= 2:   # block sign: yellow plate with dark bars (abstract lettering)
        on_face(ctx, 'y', 0.3, h - 1.05, 0.4, 0.35, ctx.mat('swSign', _h('#ffd23a'), 0.4, emit=_h('#ffd23a'), emit_strength=0.25), t=0.03)
        for j in range(3): on_face(ctx, 'y', 0.35 + j * 0.11, h - 0.98, 0.07, 0.2, ctx.mat('swSignInk', _h('#1a1a1e'), 0.6), t=0.04)
    elif k == 2:            # conduit + bulkhead lamp
        pipe = ctx.mat('swPipe', _h('#6a6e78'), 0.35, 0.7)
        beam(ctx, (0.0, 1.03, h - 0.6), (1.0, 1.03, h - 0.6), 0.015, pipe)
        if h >= 2:
            on_face(ctx, 'x', 0.42, h - 0.95, 0.16, 0.12, ctx.mat('swLamp', _h('#fff0c0'), 0.2, emit=_h('#ffe8b0'), emit_strength=4), t=0.05)
    elif k == 3 and h >= 2: # stencilled crest
        crest(ctx, 'x', 0.3, h - 1.25, 0.4)

def w_tunnelwall(ctx, h, v):
    tiles = tile_mat(ctx, 'twTiles', '#e2e2dc', '#dcdcd4', '#a8aab0', size=0.25, rough=0.15)
    ctx.box(0, 0, 0, 1, 1, h, tiles)
    ctx.box(0, 0, h + 0.006, 1.012, 1.012, 0.004, ctx.mat('twTop', _h('#8a8a90'), 0.6))
    ring(ctx, 0, 0.15, ctx.mat('twSkirt', _h('#1a1a20'), 0.4), 0.02)
    ring(ctx, 0.9, 0.2, ctx.mat('twRed', _h(RED), 0.25), 0.01)
    ring(ctx, 0.85, 0.05, ctx.mat('twWhite', _h(WHITE), 0.25), 0.012)
    ring(ctx, h - 0.06, 0.06, ctx.mat('twCap', _h('#c8c8cc'), 0.3), 0.012)
    k = v % 3
    if k == 1 and h >= 2:   # caged bulkhead lamp
        on_face(ctx, 'y', 0.42, h - 0.55, 0.16, 0.2, ctx.mat('twLampB', _h('#3a3a40'), 0.4, 0.6), t=0.04)
        on_face(ctx, 'y', 0.44, h - 0.53, 0.12, 0.16, ctx.mat('twLamp', _h('#fff4d0'), 0.2, emit=_h('#fff0c0'), emit_strength=5), t=0.06)
    elif k == 2:            # cable tray / pipe along the top
        pipe = ctx.mat('twPipe', _h('#8a9098'), 0.3, 0.8)
        beam(ctx, (0.0, 1.035, h - 0.25), (1.0, 1.035, h - 0.25), 0.018, pipe)
        beam(ctx, (1.035, 0.0, h - 0.25), (1.035, 1.0, h - 0.25), 0.018, pipe)
        if h >= 2: on_face(ctx, 'x', 0.35, 1.3, 0.3, 0.3, ctx.mat('twNotice', _h('#1a5a3a'), 0.5, emit=_h('#2a8a5a'), emit_strength=0.2), t=0.02)

def w_perimeter(ctx, h, v):
    red = ctx.noise_mat('pmRed', _h(RED), _h('#a00c24'), scale=10, bump=0.1)
    ctx.box(0, 0, 0, 1, 1, h - 0.1, red)
    ring(ctx, 0, 0.1, ctx.mat('pmFoot', _h('#3a1418'), 0.8), 0.015)
    ring(ctx, h - 0.1, 0.1, ctx.mat('pmTop', _h('#e8e4d8'), 0.5), 0.03)
    k = v % 3
    if k == 1:   # advert hoarding: abstract lettering blocks
        pal = [('#1a2a5a', '#ffd23a'), ('#f4f1e8', '#1a1a1e')][(v // 3) % 2]
        bg = ctx.mat('pmAdBg' + pal[0], _h(pal[0]), 0.4, emit=_h(pal[0]), emit_strength=0.25)
        fg = ctx.mat('pmAdFg' + pal[1], _h(pal[1]), 0.4, emit=_h(pal[1]), emit_strength=0.5)
        rnd = random.Random(v * 7)
        for face in ('x', 'y'):
            on_face(ctx, face, 0.03, 0.18, 0.94, h - 0.36, bg, t=0.02)
            u = 0.08
            while u < 0.86:
                w = 0.06 + rnd.random() * 0.1
                hh = (h - 0.56) * (0.6 + rnd.random() * 0.4)
                on_face(ctx, face, u, 0.28, min(w, 0.92 - u), hh, fg, t=0.03)
                u += w + 0.04
    elif k == 2:  # red/white chevrons
        ch = stripe_mat(ctx, 'pmChev', RED, WHITE, 2.0, 1.0, duty=0.3)
        on_face(ctx, 'y', 0.0, 0.12, 1.0, h - 0.24, ch, t=0.015)
        on_face(ctx, 'x', 0.0, 0.12, 1.0, h - 0.24, ch, t=0.015)
    else:         # plain red with bolted panel seams
        seam = ctx.mat('pmSeam', _h('#7a0a1a'), 0.8)
        for face in ('x', 'y'):
            on_face(ctx, face, 0.495, 0.1, 0.01, h - 0.2, seam, t=0.008)
        bolt = ctx.mat('pmBolt', _h('#c8c8cc'), 0.3, 0.8)
        for u in (0.06, 0.94):
            ctx.sphere(u, 1.012, h * 0.5, 0.012, bolt); ctx.sphere(1.012, u, h * 0.5, 0.012, bolt)

def w_awayfence(ctx, h, v):
    post = ctx.mat('afPost', _h('#3a3a44'), 0.4, 0.6)
    rail = ctx.mat('afRail', _h('#c8a020'), 0.4, 0.3)
    mesh = mesh_mat(ctx, 'afMesh', '#8a8e98', freq=4.0, zk=1.0, wire=0.16)
    t = 0.04
    # mesh panels on both visible faces
    ctx.box(0, 1 - t, 0.08, 1, 0.006, h - 0.18, mesh)
    ctx.box(1 - t, 0, 0.08, 0.006, 1, h - 0.18, mesh)
    for (x, y) in ((1 - t - 0.02, 1 - t - 0.02), (0.0, 1 - t - 0.02), (0.5, 1 - t - 0.02), (1 - t - 0.02, 0.0), (1 - t - 0.02, 0.5)):
        ctx.box(x, y, 0, 0.05, 0.05, h - 0.02, post)
    ctx.box(0, 1 - t - 0.02, 0, 1, 0.05, 0.08, post); ctx.box(1 - t - 0.02, 0, 0, 0.05, 1, 0.08, post)
    ctx.box(0, 1 - t - 0.03, h - 0.1, 1, 0.07, 0.1, rail, bevel=0.01)
    ctx.box(1 - t - 0.03, 0, h - 0.1, 0.07, 1, 0.1, rail, bevel=0.01)

def w_awaystand(ctx, h, v):
    conc = ctx.mat('asConc', _h('#5a5a60'), 0.85)
    step = ctx.mat('asStep', _h('#2a2a2e'), 0.9)
    yel = ctx.mat('asYel', _h(YEL), 0.35); yhi = ctx.mat('asYelHi', _h('#ffe070'), 0.35)
    blk = ctx.mat('asBlk', _h('#1a1a1e'), 0.35)
    ctx.box(0, 0, 0, 1, 1, h, conc)
    ctx.box(0, 0, h + 0.006, 1.03, 1.03, 0.004, ctx.mat('asTop', _h('#2a2620'), 0.9))
    ring(ctx, h - 0.1, 0.1, ctx.mat('asCap', _h('#6a6a70'), 0.5, 0.3), 0.03)
    z = h - 0.1
    row = 0
    shadow = ctx.mat('asShadow', _h('#1e1e22'), 0.95)
    while z - 0.35 > -0.01:
        zr = z - 0.35
        ring(ctx, zr, 0.06, step, 0.09)                      # tread nosing of the row below
        ring(ctx, zr + 0.06, 0.04, shadow, 0.012)
        for face in ('x', 'y'):
            for s in range(4):
                black = (s + row * 2 + v) % 7 == 0
                m = blk if black else yel
                a = s * 0.25 + 0.035
                on_face(ctx, face, a, zr + 0.06, 0.18, 0.06, m, t=0.085)      # seat pan
                on_face(ctx, face, a, zr + 0.1, 0.18, 0.2, m, t=0.035)        # seat back
                if not black: on_face(ctx, face, a + 0.01, zr + 0.27, 0.16, 0.03, yhi, t=0.04)
        z = zr
        row += 1

# ------------------------------------------------------------------ floors
def floor_concourse(ctx, n):
    base = ctx.noise_mat('fcConc', _h('#5e5c64'), _h('#6c6a72'), scale=18, bump=0.25, period=n)
    ctx.plane(0, 0, n, n, base)
    joint = ctx.mat('fcJoint', _h('#4c4a52'), 0.95)
    for i in range(n):
        ctx.box(i, 0, 0, 0.025, n, 0.003, joint); ctx.box(0, i, 0, n, 0.025, 0.003, joint)
    paint = ctx.noise_mat('fcPaint', _h('#9a2a30'), _h('#7a2026'), scale=30, period=n)
    for y0 in (0.2, 4.7):
        ctx.box(0, y0, 0, n, 0.12, 0.004, paint)
    stain = ctx.mat('fcStain', _h('#56545c'), 0.7)
    rnd = random.Random(4)
    for _ in range(5):
        ctx.box(rnd.random() * (n - 1.2), rnd.random() * (n - 1.2), 0, 0.5 + rnd.random() * 0.6, 0.4 + rnd.random() * 0.5, 0.0015, stain)
    grate = ctx.mat('fcGrate', _h('#2a2a30'), 0.5, 0.6); gbar = ctx.mat('fcGBar', _h('#3c3c44'), 0.4, 0.7)
    for (gx, gy) in ((2.5, 6.5), (6.5, 2.5)):
        ctx.box(gx - 0.18, gy - 0.1, 0, 0.36, 0.2, 0.004, grate)
        for j in range(8): ctx.box(gx - 0.17 + j * 0.045, gy - 0.09, 0, 0.018, 0.18, 0.008, gbar)
    cup, cupR = ctx.mat('fcCup', _h('#e8e4d8'), 0.6), ctx.mat('fcCupR', _h(RED), 0.6)
    for _ in range(6):
        x, y = rnd.random() * n, rnd.random() * n
        ctx.box(x, y, 0, 0.09, 0.06, 0.04, cup); ctx.box(x, y, 0.04, 0.09, 0.06, 0.012, cupR)
    lit = ctx.mat('fcLitter', _h('#d8d4c8'), 0.8)
    for _ in range(30):
        ctx.box(rnd.random() * n, rnd.random() * n, 0, 0.03, 0.03, 0.003, lit)

def _terrace(ctx, n, tag, tread, lip, lipalt, riser, stub_cols):
    ctx.plane(0, 0, n, n, ctx.noise_mat(tag + 'Tread', _h(tread[0]), _h(tread[1]), scale=16, bump=0.3, period=n))
    lipm = ctx.noise_mat(tag + 'Lip', _h(lip), _h(lipalt), scale=6, bump=0.2, period=n)
    rism = ctx.mat(tag + 'Riser', _h(riser), 0.95)
    for k in range(n * 2):
        y = k * 0.5
        ctx.box(0, y, 0, n, 0.07, 0.005, rism)
        ctx.box(0, y + 0.07, 0, n, 0.06, 0.02, lipm)
    rnd = random.Random(len(tag) * 11)
    gum = ctx.mat(tag + 'Gum', _h('#26242a'), 0.6)
    for _ in range(40): ctx.box(rnd.random() * n, rnd.random() * n, 0, 0.04, 0.04, 0.003, gum)
    for i in range(12):
        c = stub_cols[i % 2]
        ctx.box(rnd.random() * n, rnd.random() * n, 0, 0.07, 0.04, 0.004, ctx.mat(tag + 'Stub' + c, _h(c), 0.7))

def floor_terrace(ctx, n):
    _terrace(ctx, n, 'ftH', ('#5a5860', '#666470'), '#a8a6ae', '#8c8a92', '#26242c', (RED, WHITE))

def floor_away_terrace(ctx, n):
    _terrace(ctx, n, 'ftA', ('#4c4a4e', '#5a585c'), '#b49a34', '#8a7a3a', '#2c2a2c', (YEL, '#e8e4d8'))

def floor_track(ctx, n):
    ctx.plane(0, 0, n, n, ctx.noise_mat('ftrAsh', _h('#7a3a2c'), _h('#9a4c3a'), scale=60, bump=0.6, detail=12, period=n))
    rnd = random.Random(8)
    grit = [ctx.mat('ftrG%d' % i, _h(c), 0.9) for i, c in enumerate(['#5a2a22', '#b86a52', '#c8b8a8'])]
    for _ in range(160):
        s = 0.02 + rnd.random() * 0.025
        ctx.box(rnd.random() * n, rnd.random() * n, 0, s, s, 0.01, rnd.choice(grit))

def floor_pitch(ctx, n):
    # mown bands along x every 2.5 tiles (offset 0.5) + checker every 5 tiles in x. n = 10.
    cols = {(1, 1): '#2e6c2a', (1, 0): '#2b6627', (0, 1): '#3a7d34', (0, 0): '#377831'}
    for by in range(-1, 4):
        y0 = 0.5 + by * 2.5
        band = (by % 2 == 0)
        for cx in range(2):
            chk = (cx % 2 == 0)
            c = cols[(1 if band else 0, 1 if chk else 0)]
            ya, yb = max(0, y0), min(n, y0 + 2.5)
            if yb <= ya: continue
            ctx.plane(cx * 5, ya, 5, yb - ya, ctx.noise_mat('fpG' + c, _h(c), tuple(x * 0.82 for x in _h(c)), scale=90, bump=0.5, detail=10, period=n))
    rnd = random.Random(12)
    tuft = ctx.mat('fpTuft', _h('#24561f'), 0.9)
    for _ in range(60):
        ctx.box(rnd.random() * n, rnd.random() * n, 0, 0.05, 0.05, 0.004, tuft)

def floor_tunnel(ctx, n):
    ctx.plane(0, 0, n, n, grid_mat(ctx, 'ftuRib', '#2e3446', '#3a4056', 0.125, rough=0.6, bump=0.4))
    joint = ctx.mat('ftuJoint', _h('#1a1c26'), 0.9)
    for i in range(n):
        ctx.box(i, 0, 0, 0.03, n, 0.004, joint); ctx.box(0, i, 0, n, 0.03, 0.004, joint)
    rnd = random.Random(3)
    scuff = ctx.mat('ftuScuff', _h('#22262f'), 0.9)
    for _ in range(25): ctx.box(rnd.random() * n, rnd.random() * n, 0, 0.08, 0.05, 0.002, scuff)

def floor_dressing(ctx, n):
    for i in range(n // 3):
        for j in range(n // 3):
            c = '#7a2028' if (i + j) % 2 else '#6c1a22'
            ctx.plane(i * 3, j * 3, 3, 3, ctx.noise_mat('fdL' + c, _h(c), tuple(x * 0.85 for x in _h(c)), scale=14, bump=0.15, period=n))
    line = ctx.mat('fdLine', _h('#d8d0c0'), 0.5)
    for k in range(n // 3):
        ctx.box(k * 3, 0, 0, 0.06, n, 0.004, line); ctx.box(0, k * 3, 0, n, 0.06, 0.004, line)
    rnd = random.Random(5)
    tape = ctx.mat('fdTape', _h('#e8e0c8'), 0.7)
    for _ in range(14): ctx.box(rnd.random() * n, rnd.random() * n, 0, 0.12, 0.03, 0.003, tape)

def floor_tiles(ctx, n):
    light = ctx.noise_mat('ftlLight', _h('#d8d8d0'), _h('#bcb8a8'), scale=6, bump=0.05, period=n)
    dark = ctx.mat('ftlDark', _h('#2a2a30'), 0.25)
    for i in range(n * 2):
        for j in range(n * 2):
            ctx.box(i * 0.5 + 0.02, j * 0.5 + 0.02, 0, 0.46, 0.46, 0.02, dark if (i + j) % 2 else light, bevel=0.012)
    ctx.plane(0, 0, n, n, ctx.mat('ftlGrout', _h('#7a7a80'), 0.9), gz=-0.001)

# ------------------------------------------------------------------ props
def p_flagpole(ctx, var):
    base = ctx.mat('fpBase', _h('#4a4a52'), 0.6, 0.3)
    pole = ctx.mat('fpPole', _h('#c8c8d0'), 0.25, 0.9)
    ctx.box(0.32, 0.32, 0, 0.36, 0.36, 0.25, base, bevel=0.02)
    ctx.cyl(0.5, 0.5, 0.25, 0.05, 0.12, pole, 12)
    ctx.cyl(0.5, 0.5, 0, 0.045, 4.2, pole, 10)
    ctx.sphere(0.5, 0.5, 4.22, 0.05, ctx.mat('fpGold', _h('#e8c040'), 0.25, 0.9))
    beam(ctx, (0.5, 0.5, 2.8), (0.5, 0.5, 4.15), 0.004, ctx.mat('fpRope', _h('#e8e4d8'), 0.8))

def p_stall(ctx, var):
    a, b = var.get('a', RED), var.get('b', WHITE)
    wood = ctx.noise_mat('stWood', _h('#8a6a44'), _h('#6a4a2c'), scale=40, bump=0.4)
    pole = ctx.mat('stPole', _h('#3a3a40'), 0.4, 0.6)
    ma, mb = ctx.mat('stA' + a, _h(a), 0.8), ctx.mat('stB' + b, _h(b), 0.8)
    for (x, y, top) in ((0.1, 0.15, 2.18), (1.9, 0.15, 2.18), (0.1, 0.85, 2.0), (1.9, 0.85, 2.0)):
        ctx.cyl(x, y, 0, 0.025, top, pole, 8)
    ctx.box(0.05, 0.3, 0, 1.9, 0.6, 0.9, wood, bevel=0.015)
    ctx.box(0.03, 0.28, 0.88, 1.94, 0.64, 0.04, ctx.mat('stTop', _h('#a8845a'), 0.7))
    for i in range(4):   # folded scarves on the counter
        ctx.box(0.2 + i * 0.42, 0.45, 0.92, 0.3, 0.3, 0.08 + (i % 2) * 0.06, mb if i % 2 else ma, bevel=0.01)
    for i in range(7):   # scarves hanging off the front
        u = 0.15 + i * 0.25
        for j in range(6):
            ctx.box(u, 0.9, 0.82 - (j + 1) * 0.1, 0.1, 0.02, 0.1, mb if j % 2 else ma)
        for f in range(3): ctx.box(u + 0.01 + f * 0.035, 0.9, 0.12, 0.012, 0.015, 0.1, mb)
    for i in range(8):   # striped canopy
        u0, u1 = i * 0.25, (i + 1) * 0.25
        slab(ctx, [(u0, 0.0, 2.2), (u1, 0.0, 2.2), (u1, 1.15, 1.95), (u0, 1.15, 1.95)], mb if i % 2 else ma)
        ctx.box(u0 + 0.02, 1.13, 1.75, 0.21, 0.02, 0.2, mb if i % 2 else ma)

def p_burger_van(ctx, var):
    body = ctx.mat('bvBody', _h('#e8e4d8'), 0.35, 0.1)
    red = ctx.mat('bvRed', _h(RED), 0.4)
    tyre = ctx.mat('tyre', _h('#0c0c0e'), 0.8); hub = ctx.mat('bvHub', _h('#8a8a90'), 0.3, 0.9)
    for x in (0.5, 2.4):
        wheel(ctx, x, 0.92, 0.17, 0.16, 0.14, tyre, hub); wheel(ctx, x, 0.08, 0.17, 0.16, 0.14, tyre)
    ctx.box(0.05, 0.08, 0.17, 2.9, 0.84, 1.53, body, bevel=0.06)
    ctx.box(0.05, 0.92, 0.55, 2.9, 0.012, 0.15, red); ctx.box(2.947, 0.08, 0.55, 0.012, 0.84, 0.15, red)
    ctx.box(0.02, 0.1, 0.14, 2.96, 0.8, 0.06, ctx.mat('bvBumper', _h('#3a3a40'), 0.5, 0.5))
    # serving hatch (lit) with counter
    ctx.box(0.7, 0.915, 0.75, 1.5, 0.02, 0.72, ctx.mat('bvHatchFr', _h('#2a2a30'), 0.5))
    ctx.box(0.75, 0.925, 0.8, 1.4, 0.02, 0.62, ctx.mat('bvHatch', _h('#ffd88a'), 0.6, emit=_h('#ffc870'), emit_strength=2.2))
    ctx.box(0.75, 0.92, 0.78, 1.4, 0.14, 0.06, ctx.mat('bvCounter', _h('#c08a3a'), 0.5))
    for i in range(3): ctx.cyl(0.95 + i * 0.35, 1.0, 0.84, 0.04, 0.08, ctx.mat('bvCup', _h(WHITE), 0.6), 10)
    for i in range(6):   # striped awning
        x0 = 0.62 + i * 0.28
        slab(ctx, [(x0, 0.93, 1.6), (x0 + 0.28, 0.93, 1.6), (x0 + 0.28, 1.3, 1.36), (x0, 1.3, 1.36)], ctx.mat('bvAw%d' % (i % 2), _h(WHITE if i % 2 else RED), 0.7))
    # cab: windscreen + side window + headlights
    glass = ctx.mat('bvGlass', _h('#7a9ab0'), 0.08, 0.3, emit=_h('#4a6a80'), emit_strength=0.2)
    ctx.box(2.955, 0.18, 0.9, 0.02, 0.64, 0.52, glass)
    ctx.box(2.45, 0.925, 0.95, 0.4, 0.015, 0.42, glass)
    for y in (0.15, 0.73): ctx.box(2.955, y, 0.4, 0.03, 0.12, 0.1, ctx.mat('headl', _h('#fff8d0'), 0.2, 0, emit=_h('#fff0c0'), emit_strength=3))
    # roof sign frame (the lettered board is drawn in the overlay) + chimney
    pole = ctx.mat('bvPole', _h('#3a3a40'), 0.4, 0.6)
    ctx.box(1.45, 0.45, 1.7, 0.1, 0.1, 0.12, pole)
    ctx.cyl(0.45, 0.35, 1.7, 0.05, 0.3, ctx.mat('bvFlue', _h('#8a8a90'), 0.3, 0.9), 10)

def p_turnstile(ctx, var):
    booth = ctx.noise_mat('tsBooth', _h('#5a5a62'), _h('#4a4a52'), scale=20)
    brick = ctx.brick_mat('dfBrick0', _h('#8a3430'), _h('#7a2c2a'), _h('#3a1c1c'))
    for x in (0.0, 0.88):
        ctx.box(x, 0.1, 0, 0.12, 0.8, 1.9, booth, bevel=0.01)
        ctx.box(x + 0.115, 0.3, 0.9, 0.01, 0.4, 0.5, ctx.mat('tsWin', _h('#1a2030'), 0.1, 0.3, emit=_h('#ffd08a'), emit_strength=0.4))
    ctx.box(0.12, 0.45, 0, 0.12, 0.1, 0.9, ctx.mat('tsHub', _h('#9aa0a8'), 0.3, 0.8))   # hub column
    ctx.box(0, 0, 1.9, 1, 1, 0.3, brick)
    ctx.box(0, 0, 2.15, 1.02, 1.02, 0.08, ctx.mat('dfCornice', _h('#4a1a1e'), 0.6))
    ctx.box(0.3, 1.0, 1.95, 0.4, 0.02, 0.2, ctx.mat('tsSign', _h('#1a1a1e'), 0.5))

def p_coach(ctx, var):
    c, c2 = var.get('color', BLUE), var.get('trim', WHITE)
    paint = ctx.mat('coP' + c, _h(c), 0.3, 0.3)
    trim = ctx.mat('coT' + c2, _h(c2), 0.35, 0.2)
    roof = ctx.mat('coR' + c2, tuple(x * 0.85 for x in _h(c2)) if c2 != BLK else _h('#2a2a2e'), 0.4, 0.2)
    tyre = ctx.mat('tyre', _h('#0c0c0e'), 0.8); hub = ctx.mat('bvHub', _h('#8a8a90'), 0.3, 0.9)
    for x in (0.6, 3.3):
        wheel(ctx, x, 0.92, 0.2, 0.19, 0.14, tyre, hub); wheel(ctx, x, 0.08, 0.2, 0.19, 0.14, tyre)
    ctx.box(0.04, 0.06, 0.18, 3.92, 0.88, 1.75, paint, bevel=0.06)
    ctx.box(0.08, 0.1, 1.9, 3.84, 0.8, 0.06, roof, bevel=0.03)
    glass = ctx.mat('coGlass', _h('#1a2030'), 0.08, 0.4)
    ctx.box(0.2, 0.935, 1.05, 3.6, 0.012, 0.55, glass)
    for i in range(6):
        ctx.box(0.25 + i * 0.6, 0.94, 1.1, 0.5, 0.012, 0.45, ctx.mat('coPane%d' % (i % 2), _h('#3a4a60' if i % 2 else '#2c3a4e'), 0.06, 0.4))
    ctx.box(0.04, 0.937, 0.55, 3.92, 0.012, 0.2, trim)
    ctx.box(3.956, 0.06, 0.55, 0.012, 0.88, 0.2, trim)
    ctx.box(3.957, 0.12, 0.95, 0.012, 0.76, 0.72, ctx.mat('coWind', _h('#4a6a88'), 0.06, 0.3, emit=_h('#4a6a88'), emit_strength=0.15))
    ctx.box(3.2, 0.937, 0.25, 0.4, 0.014, 0.75, ctx.mat('coDoor', _h('#1a2030'), 0.1, 0.3))
    for y in (0.14, 0.76): ctx.box(3.958, y, 0.38, 0.03, 0.1, 0.1, ctx.mat('headl', _h('#fff8d0'), 0.2, 0, emit=_h('#fff0c0'), emit_strength=3))
    ctx.box(0.0, 0.08, 0.16, 4.0, 0.84, 0.08, ctx.mat('bvBumper', _h('#3a3a40'), 0.5, 0.5))
    for i in range(3):   # scarves hung in the windows
        for j in range(5):
            ctx.box(0.4 + i * 1.1, 0.95, 1.5 - j * 0.07, 0.08, 0.01, 0.07, paint if j % 2 else trim)

def p_kiosk(ctx, var):
    frame = ctx.mat('kiFrame', _h('#120c14'), 0.6)
    ctx.box(0.0, 0.0, 0.0, 2.0, 0.06, 2.15, frame)
    ctx.box(0.05, 0.06, 1.15, 1.9, 0.01, 0.95, ctx.mat('kiBoard', _h('#2a1a14'), 0.7, emit=_h('#2a1a14'), emit_strength=0.2))
    ctx.box(0.05, 0.06, 0.0, 1.9, 0.01, 1.1, ctx.mat('kiBack', _h('#3a2a24'), 0.7, emit=_h('#ffd08a'), emit_strength=0.15))
    ctx.box(0.0, 0.0, 2.1, 2.0, 0.25, 0.06, ctx.mat('kiHood', _h(RED), 0.5))
    counter = ctx.mat('kiCounter', _h('#e8e4d8'), 0.4)
    ctx.box(0.02, 0.35, 0, 1.96, 0.6, 1.0, counter)
    ctx.box(0.0, 0.33, 1.0, 2.0, 0.64, 0.05, ctx.mat('kiTop', _h('#c8c4bc'), 0.35, 0.3))
    ctx.box(0.02, 0.95, 0.2, 1.96, 0.012, 0.22, ctx.mat('kiRed', _h(RED), 0.5))
    ctx.box(0.02, 0.95, 0.42, 1.96, 0.014, 0.08, ctx.mat('kiWhite', _h(WHITE), 0.5))
    pie = ctx.mat('kiPie', _h('#c8862e'), 0.6)
    for i in range(3):
        ctx.cyl(0.4 + i * 0.25, 0.65, 1.05, 0.08, 0.08, pie, 14)
        ctx.cyl(0.4 + i * 0.25, 0.65, 1.13, 0.07, 0.015, ctx.mat('kiCrust', _h('#e0a050'), 0.6), 14)
    ctx.cyl(1.55, 0.6, 1.05, 0.11, 0.55, ctx.mat('kiUrn', _h('#b8bcc4'), 0.2, 0.9), 16)
    ctx.cyl(1.55, 0.6, 1.6, 0.06, 0.06, ctx.mat('kiUrnTop', _h('#2a2a30'), 0.4, 0.6), 12)
    ctx.box(1.62, 0.7, 1.2, 0.08, 0.03, 0.04, ctx.mat('kiTap', _h('#2a2a30'), 0.4, 0.6))

def p_pillar(ctx, var):
    conc = ctx.noise_mat('piConc', _h('#7a7a82'), _h('#62626a'), scale=12, bump=0.25)
    ctx.box(0.22, 0.22, 0, 0.56, 0.56, 3.6, conc, bevel=0.015)
    ctx.box(0.2, 0.2, 1.0, 0.6, 0.6, 0.25, ctx.mat('piRed', _h(RED), 0.45))
    ctx.box(0.2, 0.2, 1.25, 0.6, 0.6, 0.08, ctx.mat('piWhite', _h(WHITE), 0.45))
    ctx.box(0.2, 0.2, 0, 0.6, 0.6, 0.12, ctx.mat('piFoot', _h('#3a3a42'), 0.8))

def p_crush(ctx, var):
    m = ctx.mat('cbSteel', _h('#9aa0aa'), 0.35, 0.7)
    dark = ctx.mat('cbDark', _h('#3a3e46'), 0.5, 0.6)
    alongX = var.get('dir', 'x') == 'x'
    P = (lambda u, z: (u, 0.5, z)) if alongX else (lambda u, z: (0.5, u, z))
    for u in (0.04, 0.96):
        beam(ctx, P(u, 0), P(u, 0.9), 0.045, dark, seg=10)
        px, py, _ = P(u, 0)
        ctx.cyl(px, py, 0, 0.08, 0.04, dark, 10)
    beam(ctx, P(0.0, 0.87), P(1.0, 0.87), 0.055, m, seg=12)
    beam(ctx, P(0.0, 0.9), P(1.0, 0.9), 0.03, ctx.mat('cbHi', _h('#e8ecf0'), 0.3, 0.6), seg=8)
    beam(ctx, P(0.04, 0.42), P(0.96, 0.42), 0.03, dark, seg=8)

def p_flare(ctx, var):
    ctx.cyl(0.5, 0.5, 0, 0.18, 0.004, ctx.mat('flScorch', _h('#1a1012'), 0.95), 18)
    ctx.cyl(0.5, 0.5, 0, 0.055, 0.3, ctx.mat('flCan', _h('#d82020'), 0.5), 12)
    ctx.cyl(0.5, 0.5, 0.18, 0.057, 0.05, ctx.mat('flBand', _h(WHITE), 0.5), 12)
    ctx.cyl(0.5, 0.5, 0.3, 0.04, 0.05, ctx.mat('flCap', _h('#2a2a2a'), 0.6), 10)

def p_goal(ctx, var):
    L, R, F, B, H, HB = 0.5, 5.5, 1.5, 0.3, 1.9, 1.3
    white = ctx.mat('goPost', _h('#f4f4f0'), 0.3, 0.1, emit=_h('#ffffff'), emit_strength=0.15)
    frame = ctx.mat('goFrame', _h('#9aa0a8'), 0.4, 0.7)
    net = ctx.mat('goNet', _h('#e8ecf0'), 0.6, emit=_h('#e8ecf0'), emit_strength=0.3)
    r = 0.0075
    for i in range(21):
        x = L + (R - L) * i / 20
        beam(ctx, (x, B, 0), (x, B, HB), r, net, seg=4)
        beam(ctx, (x, F, H), (x, B, HB), r, net, seg=4)
    for j in range(7):
        z = HB * j / 6; beam(ctx, (L, B, z), (R, B, z), r, net, seg=4)
    for j in range(4):
        k = j / 3; beam(ctx, (L, F + (B - F) * k, H + (HB - H) * k), (R, F + (B - F) * k, H + (HB - H) * k), r, net, seg=4)
    for x in (L, R):
        for j in range(5):
            k = j / 4; beam(ctx, (x, F + (B - F) * k, 0), (x, F + (B - F) * k, H + (HB - H) * k), r, net, seg=4)
        for j in range(6):
            z = HB * j / 5; beam(ctx, (x, B, z), (x, F, z * H / HB), r, net, seg=4)
        beam(ctx, (x, B, 0), (x, B, HB), 0.02, frame, seg=8)
        beam(ctx, (x, B, HB), (x, F, H), 0.015, frame, seg=8)
        beam(ctx, (x, B, 0.02), (x, F, 0.02), 0.015, frame, seg=8)
    beam(ctx, (L, B, HB), (R, B, HB), 0.015, frame, seg=8)
    beam(ctx, (L, F, 0), (L, F, H), 0.06, white, seg=14)
    beam(ctx, (R, F, 0), (R, F, H), 0.06, white, seg=14)
    beam(ctx, (L - 0.06, F, H), (R + 0.06, F, H), 0.06, white, seg=14)

def p_corner_flag(ctx, var):
    ctx.cyl(0.5, 0.5, 0, 0.035, 1.7, ctx.mat('cfPole', _h('#f4f4f0'), 0.4), 8)
    ctx.cyl(0.5, 0.5, 0, 0.05, 0.03, ctx.mat('cfBase', _h('#3a3a40'), 0.6), 10)
    for k in range(4):
        ctx.cyl(0.5, 0.5, 0.3 + k * 0.35, 0.037, 0.12, ctx.mat('cfBand', _h(RED), 0.4), 8)

def p_dugout(ctx, var):
    back = ctx.noise_mat('duBack', _h('#3a3a44'), _h('#2a2a34'), scale=14)
    ctx.box(0, 0, 0, 3, 0.15, 1.6, back)
    ctx.box(0, 0.15, 0, 3, 0.85, 0.15, ctx.mat('duPlinth', _h('#4a4a52'), 0.8))
    seat = ctx.mat('duSeat' + RED, _h(var.get('seat', RED)), 0.35)
    for i in range(6):
        x = 0.12 + i * 0.47
        ctx.box(x, 0.2, 0.35, 0.36, 0.3, 0.08, seat, bevel=0.015)
        ctx.box(x, 0.17, 0.43, 0.36, 0.06, 0.4, seat, bevel=0.015)
        ctx.box(x + 0.15, 0.3, 0.15, 0.06, 0.06, 0.2, ctx.mat('duLeg', _h('#2a2a30'), 0.4, 0.6))
    persp = alpha_mat(ctx, 'duPerspex', '#b8e0f0', 0.32, emit='#b8e0f0', es=0.15)
    slab(ctx, [(0, 0, 1.6), (3, 0, 1.6), (3, 0.95, 1.2), (0, 0.95, 1.2)], persp, t=0.01)
    for x in (0.0, 3.0):
        poly(ctx, [(x, 0.0, 1.6), (x, 0.95, 1.2), (x, 0.95, 0.15), (x, 0.15, 0.15), (x, 0.15, 1.6)], persp)
    tube = ctx.mat('duTube', _h('#d8e8f0'), 0.3, 0.7)
    for x in (0.0, 3.0):
        beam(ctx, (x, 0.95, 0.15), (x, 0.95, 1.2), 0.02, tube)
        beam(ctx, (x, 0.0, 1.6), (x, 0.95, 1.2), 0.02, tube)
    beam(ctx, (0, 0.95, 1.2), (3, 0.95, 1.2), 0.022, tube)
    beam(ctx, (0, 0.0, 1.6), (3, 0.0, 1.6), 0.022, tube)

def p_tannoy(ctx, var):
    pole = ctx.mat('taPole', _h('#5a5a62'), 0.4, 0.6)
    ctx.cyl(0.5, 0.5, 0, 0.05, 2.65, pole, 10)
    ctx.cyl(0.5, 0.5, 0, 0.1, 0.06, pole, 12)
    ctx.box(0.3, 0.3, 0.7, 0.4, 0.4, 0.5, ctx.mat('taBox', _h('#3a4a3a'), 0.6, 0.2), bevel=0.02)
    ctx.box(0.36, 0.7, 0.78, 0.28, 0.01, 0.34, ctx.mat('taPanel', _h('#2a342a'), 0.5))
    horn = ctx.mat('taHorn', _h('#c8c8b8'), 0.4, 0.3)
    for dx in (-1, 1):   # horns pointing screen-left / screen-right
        d = (dx * 0.33, -dx * 0.33, -0.18)
        beam(ctx, (0.5, 0.5, 2.55), (0.5 + d[0] * 0.3, 0.5 + d[1] * 0.3, 2.55 + d[2] * 0.3), 0.04, horn)
        cone_between(ctx, (0.5 + d[0] * 0.25, 0.5 + d[1] * 0.25, 2.55 + d[2] * 0.25), (0.5 + d[0], 0.5 + d[1], 2.55 + d[2]), 0.04, 0.13, horn)
    ctx.cyl(0.5, 0.5, 2.48, 0.07, 0.12, pole, 10)

def p_ballbag(ctx, var):
    bag = ctx.mat('bbBag', _h('#1a2a6a'), 0.8)
    ctx.sphere(0.5, 0.5, 0.33, 0.3, bag, 1, 1, 1.1)
    ball = ctx.mat('bbBall', _h('#f4f4f0'), 0.4); patch = ctx.mat('bbPatch', _h('#2a2a2a'), 0.5)
    for (x, y, z) in ((0.45, 0.68, 0.48), (0.66, 0.5, 0.52), (0.58, 0.7, 0.24), (0.7, 0.32, 0.28), (0.38, 0.55, 0.62)):
        ctx.sphere(x, y, z, 0.11, ball)
        ctx.sphere(x + 0.05, y + 0.05, z + 0.03, 0.035, patch)
    ctx.cyl(0.5, 0.5, 0.66, 0.05, 0.1, ctx.mat('bbTie', _h('#120c14'), 0.8), 8)
    ctx.cyl(0.5, 0.5, 0.0, 0.3, 0.02, ctx.mat('bbShadow', _h('#101014'), 0.9), 16)

def p_kitbasket(ctx, var):
    wick = ctx.noise_mat('kbWicker', _h('#c8a060'), _h('#a8803c'), scale=70, bump=0.8)
    ctx.box(0.12, 0.15, 0, 0.76, 0.7, 0.7, wick, bevel=0.02)
    strap = ctx.mat('kbStrap', _h('#7a5a28'), 0.8)
    for i in range(1, 6):
        ctx.box(0.12 + i * 0.127, 0.845, 0, 0.02, 0.012, 0.7, strap)
        ctx.box(0.875, 0.15 + i * 0.117, 0, 0.012, 0.02, 0.7, strap)
    ctx.box(0.1, 0.13, 0.62, 0.8, 0.74, 0.05, strap)
    ctx.box(0.2, 0.25, 0.68, 0.5, 0.4, 0.12, ctx.mat('kbRed', _h(RED), 0.85), bevel=0.03)
    ctx.box(0.3, 0.45, 0.76, 0.35, 0.3, 0.08, ctx.mat('kbWhite', _h(WHITE), 0.85), bevel=0.025)
    ctx.box(0.55, 0.6, 0.66, 0.3, 0.3, 0.06, ctx.mat('kbSock', _h('#1a1a1e'), 0.9), bevel=0.02)

def p_merchbox(ctx, var):
    card = ctx.noise_mat('mbCard', _h('#c09a68'), _h('#a8824e'), scale=30, bump=0.2)
    card2 = ctx.noise_mat('mbCard2', _h('#b8925e'), _h('#9e7846'), scale=30, bump=0.2)
    tape = ctx.mat('mbTape', _h('#d8c090'), 0.3)
    ctx.box(0.08, 0.1, 0, 0.84, 0.8, 0.7, card, bevel=0.01)
    ctx.box(0.15, 0.18, 0.7, 0.7, 0.66, 0.6, card2, bevel=0.01)
    ctx.box(0.45, 0.1, 0.695, 0.1, 0.8, 0.01, tape); ctx.box(0.45, 0.18, 1.295, 0.1, 0.66, 0.01, tape)
    ctx.box(0.42, 0.84, 0.92, 0.18, 0.01, 0.13, ctx.mat('mbLabel', _h('#e8e4d8'), 0.6))
    ctx.box(0.15, 0.905, 0.22, 0.12, 0.01, 0.12, ctx.mat('mbArrow', _h('#2a2a2a'), 0.8))

def p_floodlight(ctx, var):
    base = ctx.noise_mat('flBase', _h('#5a5a62'), _h('#4a4a52'), scale=14)
    steel = ctx.mat('flSteel', _h('#8a8e96'), 0.35, 0.8)
    brace = ctx.mat('flBrace', _h('#6a6e76'), 0.4, 0.8)
    ctx.box(0.15, 0.15, 0, 0.7, 0.7, 0.4, base, bevel=0.02)
    top = 8.4
    b0, b1 = 0.2, 0.07
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    P = lambda c, z: (0.5 + c[0] * (b0 + (b1 - b0) * z / top), 0.5 + c[1] * (b0 + (b1 - b0) * z / top), 0.4 + z)
    for c in corners: beam(ctx, P(c, 0), P(c, top), 0.025, steel, square=True)
    nseg = 14
    for i in range(nseg):
        z0, z1 = top * i / nseg, top * (i + 1) / nseg
        for (ca, cb) in ((corners[1], corners[2]), (corners[3], corners[2])):   # the two visible faces
            if i % 2: ca, cb = cb, ca
            beam(ctx, P(ca, z0), P(cb, z1), 0.012, brace, square=True)
            beam(ctx, P(ca, z1), P(cb, z1), 0.012, brace, square=True)
    # lamp bank facing the camera (normal toward +x+y), wide along screen-x = world (1,-1)
    zc = 0.4 + top + 0.45
    hw, hh = 0.62, 0.42
    d = Vector((1, -1, 0)).normalized()
    nrm = Vector((1, 1, 0)).normalized() * 0.05
    def W(u, v, off=0.0):
        return (0.5 + d.x * u + nrm.x * off, 0.5 + d.y * u + nrm.y * off, zc + v)
    frame = ctx.mat('flFrame', _h('#3a3a42'), 0.5, 0.6)
    slab(ctx, [W(-hw, -hh), W(hw, -hh), W(hw, hh), W(-hw, hh)], frame, t=0.02)
    # thickness: the back plate as a second slab offset backwards
    slab(ctx, [W(-hw, -hh, -2), W(hw, -hh, -2), W(hw, hh, -2), W(-hw, hh, -2)], frame, t=0.02)
    for (u0, u1, v0, v1) in ((-hw, hw, hh - 0.05, hh), (-hw, hw, -hh, -hh + 0.05)):
        poly(ctx, [W(u0, v0, -2), W(u1, v0, -2), W(u1, v0, 0.3), W(u0, v0, 0.3)], frame)
    lamp = ctx.mat('flLamp', _h('#ffffff'), 0.2, 0, emit=_h('#f4f8ff'), emit_strength=9)
    rim = ctx.mat('flRim', _h('#9aa0a8'), 0.3, 0.8)
    for r in range(3):
        for c in range(6):
            u = -hw + 0.12 + c * (2 * hw - 0.24) / 5
            v = hh - 0.14 - r * 0.27
            cone_between(ctx, W(u, v, 0.1), W(u, v, 1.2), 0.07, 0.085, rim, seg=12)
            cone_between(ctx, W(u, v, 1.2), W(u, v, 1.4), 0.075, 0.075, lamp, seg=12)
    beam(ctx, (0.5, 0.5, 0.4 + top - 0.05), (0.5, 0.5, zc), 0.04, steel)

def p_seats(ctx, var):
    c = var.get('color', YEL)
    m = ctx.mat('seP' + c, _h(c) if c != BLK else _h('#1e1e22'), 0.3 if c != BLK else 0.25)
    ctx.box(0.05, 0.1, 0, 0.9, 0.8, 0.15, ctx.mat('seBase', _h('#3a3a40'), 0.8))
    ctx.box(0.08, 0.6, 0.15, 0.84, 0.06, 0.1, ctx.mat('seRail', _h('#6a6e76'), 0.4, 0.8))
    for i in range(2):
        x = 0.1 + i * 0.45
        ctx.box(x, 0.25, 0.25, 0.38, 0.45, 0.08, m, bevel=0.02)
        ctx.box(x, 0.2, 0.33, 0.38, 0.07, 0.35, m, bevel=0.02)
        ctx.box(x + 0.16, 0.4, 0.15, 0.06, 0.06, 0.1, ctx.mat('seLeg', _h('#2a2a30'), 0.4, 0.6))

def p_physio(ctx, var):
    leg = ctx.mat('phLeg', _h('#9aa0a8'), 0.3, 0.9)
    for (x, y) in ((0.15, 0.15), (0.8, 0.15), (0.15, 0.8), (0.8, 0.8)): ctx.box(x, y, 0, 0.06, 0.06, 0.7, leg)
    ctx.box(0.12, 0.12, 0.25, 0.76, 0.76, 0.03, leg)
    ctx.box(0.08, 0.08, 0.7, 0.84, 0.84, 0.12, ctx.mat('phPad', _h('#2a3a6a'), 0.6), bevel=0.03)
    ctx.box(0.15, 0.55, 0.82, 0.5, 0.3, 0.03, ctx.mat('phTowel', _h(WHITE), 0.9), bevel=0.01)
    ctx.cyl(0.5, 0.5, 0, 0.12, 0.3, ctx.mat('phBucket', _h('#c8c8c0'), 0.4), 14, r2=0.14)
    ctx.box(0.42, 0.44, 0.3, 0.16, 0.12, 0.07, ctx.mat('phSponge', _h('#e8d040'), 0.9), bevel=0.02)

def p_urinal(ctx, var):
    cer = ctx.mat('urCeramic', _h('#d8dcde'), 0.15)
    steel = ctx.mat('urSteel', _h('#c8ccd0'), 0.25, 0.85)
    ctx.box(0.0, 0.0, 0.55, 1.0, 0.06, 0.85, cer, bevel=0.01)
    ctx.box(0.0, 0.05, 0.3, 1.0, 0.3, 0.25, steel, bevel=0.015)
    ctx.box(0.03, 0.08, 0.5, 0.94, 0.24, 0.06, ctx.mat('urWater', _h('#5a6066'), 0.1, 0.2))
    pipe = ctx.mat('urPipe', _h('#8a9098'), 0.3, 0.85)
    beam(ctx, (0.5, 0.075, 0.55), (0.5, 0.075, 1.4), 0.015, pipe)
    beam(ctx, (0.0, 0.08, 1.4), (1.0, 0.08, 1.4), 0.018, pipe)
    ctx.sphere(0.5, 0.09, 0.62, 0.03, pipe)

# ------------------------------------------------------------------ registry
PIECES = [
    dict(kind='wall', id='derby_facade', heights=[2.2], variants=6, build=w_facade),
    dict(kind='wall', id='derby_standWall', heights=[1.2, 2, 3.5], variants=4, build=w_standwall),
    dict(kind='wall', id='derby_tunnelWall', heights=[1.2, 2], variants=3, build=w_tunnelwall),
    dict(kind='wall', id='derby_perimeter', heights=[1.1], variants=6, build=w_perimeter),
    dict(kind='wall', id='derby_awayFence', heights=[1.2], variants=1, build=w_awayfence),
    dict(kind='wall', id='derby_awayStand', heights=[3.2], variants=4, build=w_awaystand, padX=6, padBottom=4),
    dict(kind='wall', id='tiledWall', heights=[1.2, 2.4], variants=3, build=w_tiled),
    dict(kind='floor', id='derby_concourse', n=9, build=floor_concourse),
    dict(kind='floor', id='derby_terrace', n=4, build=floor_terrace),
    dict(kind='floor', id='derby_awayTerrace', n=4, build=floor_away_terrace),
    dict(kind='floor', id='derby_track', n=4, build=floor_track),
    dict(kind='floor', id='derby_pitch', n=10, build=floor_pitch),
    dict(kind='floor', id='derby_tunnel', n=4, build=floor_tunnel),
    dict(kind='floor', id='derby_dressing', n=6, build=floor_dressing),
    dict(kind='floor', id='tiles', n=4, build=floor_tiles),
    dict(kind='prop', id='derby_flagpole', size=(1, 1, 4.4), build=p_flagpole),
    dict(kind='prop', id='derby_stall', size=(2, 1, 2.3), build=p_stall, pad=12),
    dict(kind='prop', id='derby_burgerVan', size=(3, 1, 2.0), build=p_burger_van, pad=12),
    dict(kind='prop', id='derby_turnstile', size=(1, 1, 2.3), build=p_turnstile),
    dict(kind='prop', id='derby_coach', size=(4, 1, 2.1), build=p_coach, variants=[{'color': BLUE, 'trim': WHITE}, {'color': '#d8b020', 'trim': BLK}]),
    dict(kind='prop', id='derby_kiosk', size=(2, 1, 2.3), build=p_kiosk),
    dict(kind='prop', id='derby_pillar', size=(1, 1, 3.7), build=p_pillar),
    dict(kind='prop', id='derby_crushBarrier', size=(1, 1, 1.0), build=p_crush, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='derby_flare', size=(1, 1, 0.5), build=p_flare),
    dict(kind='prop', id='derby_goal', size=(6, 2, 2.1), build=p_goal),
    dict(kind='prop', id='derby_cornerFlag', size=(1, 1, 1.8), build=p_corner_flag),
    dict(kind='prop', id='derby_dugout', size=(3, 1, 1.7), build=p_dugout),
    dict(kind='prop', id='derby_tannoy', size=(1, 1, 2.9), build=p_tannoy, pad=12),
    dict(kind='prop', id='derby_ballBag', size=(1, 1, 0.9), build=p_ballbag),
    dict(kind='prop', id='derby_kitBasket', size=(1, 1, 1.0), build=p_kitbasket),
    dict(kind='prop', id='derby_merchBox', size=(1, 1, 1.4), build=p_merchbox),
    dict(kind='prop', id='derby_floodlight', size=(1, 1, 9.8), build=p_floodlight, pad=10),
    dict(kind='prop', id='derby_seats', size=(1, 1, 0.8), build=p_seats, variants=[{'color': YEL}, {'color': BLK}]),
    dict(kind='prop', id='derby_physio', size=(1, 1, 1.0), build=p_physio),
    dict(kind='prop', id='derby_urinal', size=(1, 1, 1.5), build=p_urinal),
]
