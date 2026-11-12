# Level 4 (THE AWAY END) environment pieces for scripts/blender/render_env.py.
# Game coords: x,y in tiles (1 tile = 1 m), z in height units (ctx.UNIT metres).
# Visible faces of a wall block: +x (screen right, darker) and +y (screen left, lit).
# Everything is original: an invented home club (Portside City, blue/white), abstract hoardings, no real brands.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from env_common import _h
import bpy, bmesh
from mathutils import Vector

BLUE, BLUE_D, NAVY, WHITE, RED, YEL = '#1f4fb4', '#163578', '#1c2c54', '#f2f2f2', '#c8102e', '#ffd23a'

# ================================================================== helpers
def lin(c):
    if isinstance(c, str): c = _h(c)
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def M(ctx, color, rough=0.7, metal=0.0, emit=None, es=1.0, key=None):
    """plain material from a hex colour (cached by parameters)"""
    return ctx.mat(key or ('m' + color + str(rough) + str(metal) + str(emit) + str(es)), _h(color), rough, metal,
                   _h(emit) if isinstance(emit, str) else emit, es)

def E(ctx, color, es=3.0, base='#202020'):
    """emissive material"""
    return ctx.mat('e' + color + str(es) + base, _h(base), 0.4, 0, _h(color), es)

def _mk(ctx, bm, mat, name, loc, rot=None, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); ctx.link(ob); ob.location = loc
    if rot is not None: ob.rotation_euler = rot
    return ob

def beam(ctx, p0, p1, r, mat, seg=8, square=False):
    """bar between two game points (gx, gy, gz units); r = radius / half thickness in metres"""
    a, b = ctx.G(*p0), ctx.G(*p1)
    d = b - a; L = max(d.length, 1e-4)
    bm = bmesh.new()
    if square:
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts: v.co.x *= 2 * r; v.co.y *= 2 * r; v.co.z *= L
    else:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=L)
    return _mk(ctx, bm, mat, 'beam', (a + b) / 2, d.to_track_quat('Z', 'Y').to_euler(), smooth=not square)

def cone(ctx, p0, p1, r0, r1, mat, seg=12):
    a, b = ctx.G(*p0), ctx.G(*p1)
    d = b - a; L = max(d.length, 1e-4)
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=L)
    return _mk(ctx, bm, mat, 'cone', (a + b) / 2, d.to_track_quat('Z', 'Y').to_euler(), smooth=True)

def poly(ctx, pts, mat, name='poly'):
    bm = bmesh.new()
    vs = [bm.verts.new(ctx.G(*p)) for p in pts]
    bm.faces.new(vs)
    return _mk(ctx, bm, mat, name, (0, 0, 0))

def slab(ctx, pts, mat, t=0.015):
    """quad/polygon through game points with thickness t metres (along world Z)"""
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

def fbox(ctx, face, a, z, w, h, mat, t=0.02, out=0.0, base=1.0, bevel=0.0):
    """box on a visible face: face 'y' = +y face at y=base (runs along x from a), 'x' = +x face at x=base (along y from a)"""
    if face == 'y': return ctx.box(a, base + out - t / 2, z, w, t, h, mat, bevel=bevel)
    return ctx.box(base + out - t / 2, a, z, t, w, h, mat, bevel=bevel)

def both(ctx, a, z, w, h, mat, t=0.02, out=0.0, bevel=0.0):
    fbox(ctx, 'y', a, z, w, h, mat, t, out, bevel=bevel); fbox(ctx, 'x', a, z, w, h, mat, t, out, bevel=bevel)

def fcyl(ctx, face, a, z, r, h, mat, out=0.0, seg=10, base=1.0):
    """vertical cylinder standing against a visible face (pipes)"""
    if face == 'y': return ctx.cyl(a, base + r + out, z, r, h, mat, seg)
    return ctx.cyl(base + r + out, a, z, r, h, mat, seg)

def _math(N, L, op, a, b=None):
    m = N.new('ShaderNodeMath'); m.operation = op
    if isinstance(a, (int, float)): m.inputs[0].default_value = a
    else: L.new(a, m.inputs[0])
    if b is not None:
        if isinstance(b, (int, float)): m.inputs[1].default_value = b
        else: L.new(b, m.inputs[1])
    return m.outputs[0]

def _wpos(N, L):
    """world position split into (game x, game y, z metres) sockets"""
    g = N.new('ShaderNodeNewGeometry'); s = N.new('ShaderNodeSeparateXYZ')
    L.new(g.outputs['Position'], s.inputs[0])
    return s.outputs[1], s.outputs[0], s.outputs[2]

def _torus(N, L, a, b, pa, pb):
    """map two coordinates onto a 4D torus (periods pa, pb) -> (vector, w) for 4D noise"""
    def tr(sock, per, op):
        return _math(N, L, 'MULTIPLY', _math(N, L, op, _math(N, L, 'MULTIPLY', sock, 2 * math.pi / per)), per / (2 * math.pi))
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(tr(a, pa, 'COSINE'), comb.inputs[0]); L.new(tr(a, pa, 'SINE'), comb.inputs[1]); L.new(tr(b, pb, 'COSINE'), comb.inputs[2])
    return comb.outputs[0], tr(b, pb, 'SINE')

def _noise4(N, L, vec, w, scale, detail=5.0, rough=0.55):
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
    try: nz.inputs['Roughness'].default_value = rough
    except Exception: pass
    L.new(vec, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
    return nz

def _ramp(N, L, fac, stops):
    r = N.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    while len(els) < len(stops): els.new(0.5)
    for e, (pos, col) in zip(els, stops):
        e.position = pos; e.color = (*lin(col), 1)
    L.new(fac, r.inputs['Fac'])
    return r.outputs['Color']

def wall_mat(ctx, key, c1, c2, scale=6.0, rough=0.85, bump=0.25, block=None, mortar=None, bw=0.5, bh=0.255, mortar_size=0.012,
             stack=False, metal=0.0, streak=0.0, grime=0.0, seed=0.0):
    """Wall material in WORLD coords, seamless between blocks (horizontal coord u = x + y, period 1 m).
    Optional block/brick bond (bw x bh metres, bw must divide 1), vertical streaks, darker grime toward the ground."""
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, _ = ctx.nodemat(key)
    gx, gy, gz = _wpos(N, L)
    u = _math(N, L, 'ADD', gx, gy)
    vec, w = _torus(N, L, u, gz, 1.0, 50.0)
    w = _math(N, L, 'ADD', w, seed * 7.3)
    nz = _noise4(N, L, vec, w, scale)
    col = _ramp(N, L, nz.outputs['Fac'], [(0.3, c1), (0.75, c2)])
    height = nz.outputs['Fac']
    if streak:
        # vertical streaks: noise stretched along z
        sv, sw = _torus(N, L, u, _math(N, L, 'MULTIPLY', gz, 0.08), 1.0, 50.0)
        sn = _noise4(N, L, sv, _math(N, L, 'ADD', sw, seed * 3.1 + 11), 9.0, 3.0)
        mk = N.new('ShaderNodeMix'); mk.data_type = 'RGBA'; mk.blend_type = 'MULTIPLY'
        f = _math(N, L, 'MULTIPLY', _math(N, L, 'MAXIMUM', _math(N, L, 'SUBTRACT', sn.outputs['Fac'], 0.52), 0.0), streak * 6)
        L.new(_math(N, L, 'MINIMUM', f, 1.0), mk.inputs['Factor'])
        L.new(col, mk.inputs['A']); mk.inputs['B'].default_value = (*lin('#6a5a48'), 1)
        col = mk.outputs['Result']
    if block:
        br = N.new('ShaderNodeTexBrick')
        br.inputs['Color1'].default_value = (*lin(block[0]), 1); br.inputs['Color2'].default_value = (*lin(block[1]), 1)
        br.inputs['Mortar'].default_value = (*lin(mortar), 1)
        br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = mortar_size
        br.inputs['Brick Width'].default_value = bw; br.inputs['Row Height'].default_value = bh
        br.offset = 0.0 if stack else 0.5
        cb = N.new('ShaderNodeCombineXYZ'); L.new(u, cb.inputs[0]); L.new(gz, cb.inputs[1])
        L.new(cb.outputs[0], br.inputs['Vector'])
        mk = N.new('ShaderNodeMix'); mk.data_type = 'RGBA'; mk.blend_type = 'MULTIPLY'; mk.inputs['Factor'].default_value = 1.0
        L.new(br.outputs['Color'], mk.inputs['A']); L.new(col, mk.inputs['B'])
        col = mk.outputs['Result']
        height = _math(N, L, 'ADD', _math(N, L, 'MULTIPLY', br.outputs['Fac'], -1.0), _math(N, L, 'MULTIPLY', nz.outputs['Fac'], 0.3))
    if grime:
        f = _math(N, L, 'MULTIPLY', _math(N, L, 'MAXIMUM', _math(N, L, 'SUBTRACT', 0.35, gz), 0.0), grime * 2.5)
        mk = N.new('ShaderNodeMix'); mk.data_type = 'RGBA'; mk.blend_type = 'MULTIPLY'
        L.new(_math(N, L, 'MINIMUM', f, 0.8), mk.inputs['Factor'])
        L.new(col, mk.inputs['A']); mk.inputs['B'].default_value = (*lin('#3a3830'), 1)
        col = mk.outputs['Result']
    L.new(col, b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.02
    L.new(height, bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    ctx.mats[key] = m
    return m

def floor_mat(ctx, key, stops, period, scale=8.0, rough=0.85, bump=0.2, detail=6.0, rough_wet=None, wet_scale=1.2, wet_stops=None,
              wet_thresh=0.62, seed=0.0, metal=0.0):
    """Floor material in WORLD coords, seamless every `period` tiles; optional wet/puddle mask (low roughness, tinted)."""
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, _ = ctx.nodemat(key)
    gx, gy, gz = _wpos(N, L)
    vec, w = _torus(N, L, gx, gy, period, period)
    nz = _noise4(N, L, vec, _math(N, L, 'ADD', w, seed), scale, detail)
    col = _ramp(N, L, nz.outputs['Fac'], stops)
    rough_s = None
    if rough_wet is not None:
        wn = _noise4(N, L, vec, _math(N, L, 'ADD', w, seed + 17.0), wet_scale, 3.0)
        mask = _math(N, L, 'GREATER_THAN', wn.outputs['Fac'], wet_thresh)
        soft = _math(N, L, 'MINIMUM', _math(N, L, 'MULTIPLY', _math(N, L, 'MAXIMUM', _math(N, L, 'SUBTRACT', wn.outputs['Fac'], wet_thresh - 0.03), 0.0), 12.0), 1.0)
        mk = N.new('ShaderNodeMix'); mk.data_type = 'RGBA'
        L.new(soft, mk.inputs['Factor']); L.new(col, mk.inputs['A'])
        if wet_stops:
            L.new(_ramp(N, L, nz.outputs['Fac'], wet_stops), mk.inputs['B'])
        else:
            dk = N.new('ShaderNodeMix'); dk.data_type = 'RGBA'; dk.blend_type = 'MULTIPLY'; dk.inputs['Factor'].default_value = 1.0
            L.new(col, dk.inputs['A']); dk.inputs['B'].default_value = (0.55, 0.6, 0.66, 1); L.new(dk.outputs['Result'], mk.inputs['B'])
        col = mk.outputs['Result']
        rmix = N.new('ShaderNodeMapRange'); L.new(soft, rmix.inputs['Value'])
        rmix.inputs['To Min'].default_value = rough; rmix.inputs['To Max'].default_value = rough_wet
        rough_s = rmix.outputs['Result']
    L.new(col, b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.02
    L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    if rough_s is not None: L.new(rough_s, b.inputs['Roughness'])
    else: b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    ctx.mats[key] = m
    return m

def alpha_mat(ctx, key, color, alpha, rough=0.08, emit=None, es=0.4):
    if key in ctx.mats: return ctx.mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Alpha'].default_value = alpha
    if emit:
        b.inputs['Emission Color'].default_value = (*lin(emit), 1); b.inputs['Emission Strength'].default_value = es
    for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        try: setattr(m, attr, val)
        except Exception: pass
    try: m.use_backface_culling = False
    except Exception: pass
    ctx.mats[key] = m
    return m

def stripes_mat(ctx, key, c1, c2, period, duty=0.5, axis='u', rough=0.5, emit=0.0, metal=0.0):
    """world-space stripes: axis 'u' = along x+y (vertical stripes on walls), 'z' = horizontal bands, 'x'/'y' floors"""
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, _ = ctx.nodemat(key)
    gx, gy, gz = _wpos(N, L)
    s = {'u': _math(N, L, 'ADD', gx, gy), 'z': gz, 'x': gx, 'y': gy}[axis]
    k = _math(N, L, 'LESS_THAN', _math(N, L, 'FRACT', _math(N, L, 'DIVIDE', s, period)), duty)
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    mx.inputs['A'].default_value = (*lin(c2), 1); mx.inputs['B'].default_value = (*lin(c1), 1)
    L.new(k, mx.inputs['Factor']); L.new(mx.outputs['Result'], b.inputs['Base Color'])
    if emit:
        L.new(mx.outputs['Result'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    ctx.mats[key] = m
    return m

def pick(rnd, seq): return seq[int(rnd.random() * len(seq)) % len(seq)]

# ================================================================== WALLS
def w_stadiumwall(ctx, h, v):
    """outer wall: grey breeze block, white band, faded club-blue painted base, concrete coping with anti-climb spikes"""
    rnd = random.Random(v * 31 + 5)
    zb = h * 0.45                         # top of the blue base
    blue = wall_mat(ctx, 'sw_blue', '#1b46a0', '#2456c0', scale=5, bump=0.35, block=('#ffffff', '#e8ecf4'), mortar='#7a8ab0',
                    rough=0.6, grime=0.6)
    grey = wall_mat(ctx, 'sw_grey', '#7c7e84', '#9a9ca2', scale=7, bump=0.4, block=('#ffffff', '#eceae4'), mortar='#6a6c70',
                    streak=0.9, seed=1)
    ctx.box(0, 0, 0, 1, 1, zb, blue)
    ctx.box(0, 0, zb, 1, 1, 0.12, M(ctx, '#e4e2d8', 0.5), bevel=0.004)
    ctx.box(0, 0, zb + 0.12, 1, 1, h - zb - 0.12 - 0.16, grey)
    cop = wall_mat(ctx, 'sw_cop', '#64666c', '#76787e', scale=14, bump=0.3, seed=2)
    ctx.box(0, 0, h - 0.16, 1.015, 1.015, 0.16, cop, bevel=0.01)
    ctx.box(0, 0, h - 0.18, 1.0, 1.0, 0.02, M(ctx, '#3a3c42', 0.9))
    # coping joints (every half tile) on the top
    for k in (0.0, 0.5):
        ctx.box(k, 0, h - 0.004, 0.008, 1.015, 0.005, M(ctx, '#6a6c72', 0.9))
    # peeled paint patches on the blue base: exposed grey block
    peel = M(ctx, '#7a7c80', 0.95)
    for i in range(3 + v % 3):
        face = rnd.choice('xy'); a = rnd.random() * 0.8; z = 0.15 + rnd.random() * (zb - 0.4)
        fbox(ctx, face, a, z, 0.06 + rnd.random() * 0.12, 0.05 + rnd.random() * 0.12, peel, t=0.006)
    # rust run-off under the coping
    rust = M(ctx, '#7a4a28', 0.9)
    for i in range(1 + v % 2):
        face = rnd.choice('xy'); a = 0.1 + rnd.random() * 0.8
        fbox(ctx, face, a, h - 0.9 - rnd.random() * 0.4, 0.025, 0.7 + rnd.random() * 0.3, rust, t=0.004)
    kind = v % 6
    if kind == 0:   # cast drainpipe with brackets
        pipe = M(ctx, '#2a2c34', 0.45, 0.4)
        fcyl(ctx, 'y', 0.78, 0, 0.04, h - 0.2, pipe); ctx.cyl(0.78, 1.04, h - 0.32, 0.06, 0.14, pipe, 10)
        for z in (0.6, 1.6, 2.6): fbox(ctx, 'y', 0.75, z, 0.06, 0.05, pipe, t=0.09, out=0.04)
        ctx.cyl(0.78, 1.04, 0, 0.065, 0.12, pipe, 10)
    elif kind == 1:  # louvred vent
        frame = M(ctx, '#5a5e66', 0.5, 0.5)
        fbox(ctx, 'x', 0.3, zb + 0.5, 0.4, 0.45, frame, t=0.03)
        for i in range(5): fbox(ctx, 'x', 0.32, zb + 0.53 + i * 0.08, 0.36, 0.035, M(ctx, '#2a2c32', 0.5, 0.5), t=0.05, out=0.01)
    elif kind == 2:  # gate number plate + lamp
        fbox(ctx, 'y', 0.3, zb + 0.55, 0.4, 0.4, M(ctx, BLUE, 0.5), t=0.03, bevel=0.005)
        fbox(ctx, 'y', 0.33, zb + 0.58, 0.34, 0.34, M(ctx, '#f0f0e8', 0.5), t=0.032)
        fbox(ctx, 'y', 0.38, zb + 0.63, 0.24, 0.24, M(ctx, BLUE, 0.5), t=0.034)
        fbox(ctx, 'y', 0.47, zb + 0.66, 0.06, 0.18, M(ctx, '#f0f0e8', 0.5), t=0.036)
    elif kind == 3:  # bulkhead light + conduit
        fbox(ctx, 'x', 0.45, 0.0, 0.03, h - 0.5, M(ctx, '#9a9ca2', 0.5, 0.6), t=0.03)
        fbox(ctx, 'x', 0.38, h - 0.75, 0.18, 0.12, M(ctx, '#2a2c32', 0.5), t=0.07)
        fbox(ctx, 'x', 0.4, h - 0.73, 0.14, 0.08, E(ctx, '#e8f0ff', 3.0), t=0.08)
    elif kind == 4:  # crack + fly-posted notice
        fbox(ctx, 'y', 0.2, zb + 0.4, 0.3, 0.42, M(ctx, '#d8d4c4', 0.9), t=0.006)
        for i in range(4): fbox(ctx, 'y', 0.24, zb + 0.72 - i * 0.08, 0.22 - (i % 2) * 0.08, 0.03, M(ctx, '#3a3a40', 0.9), t=0.008)
        fbox(ctx, 'y', 0.24, zb + 0.77, 0.22, 0.04, M(ctx, RED, 0.8), t=0.008)
        for i in range(6): fbox(ctx, 'x', 0.6 - i * 0.03, 0.4 + i * 0.12, 0.012, 0.13, M(ctx, '#3a3c40', 0.95), t=0.006)
    else:            # steel junction box with cable
        fbox(ctx, 'x', 0.55, 1.0, 0.25, 0.32, M(ctx, '#8a8e96', 0.45, 0.6), t=0.1, bevel=0.01)
        fbox(ctx, 'x', 0.66, 0.0, 0.03, 1.0, M(ctx, '#1a1a1e', 0.6), t=0.03)
        fbox(ctx, 'x', 0.6, 1.2, 0.08, 0.05, M(ctx, YEL, 0.5), t=0.105)

def w_turnstilewall(ctx, h, v):
    """turnstile booth: red-brick base, cream panelled upper with a barred (lit) pay window, dark flat roof"""
    lit = v % 2 == 0
    zm = h * 0.5
    brick = wall_mat(ctx, 'ts_brick', '#8a8a8a', '#ffffff', scale=10, bump=0.5, block=('#7a3a2a', '#6a3224'), mortar='#3a2220',
                     bw=0.25, bh=0.075, mortar_size=0.008, grime=0.8)
    ctx.box(0, 0, 0, 1, 1, zm, brick)
    ctx.box(0, 0, zm - 0.06, 1.012, 1.012, 0.06, M(ctx, '#8a8478', 0.8), bevel=0.004)     # brick-on-edge course / sill
    cream = wall_mat(ctx, 'ts_cream', '#d8cfae', '#e4dcbe', scale=8, bump=0.15, seed=3, rough=0.6)
    ctx.box(0, 0, zm, 1, 1, h - zm - 0.2, cream)
    # panel trims at the tile edges + horizontal rail
    trim = M(ctx, '#a89e80', 0.6)
    for a in (0.0, 0.955):
        both(ctx, a, zm, 0.045, h - zm - 0.2, trim, t=0.02)
    both(ctx, 0, zm + 0.04, 1, 0.04, trim, t=0.02)
    # fascia + roof
    ctx.box(0, 0, h - 0.2, 1.02, 1.02, 0.12, M(ctx, '#4a4e56', 0.5, 0.3))
    ctx.box(0, 0, h - 0.08, 1.03, 1.03, 0.08, M(ctx, '#1a1c20', 0.6, 0.2), bevel=0.006)
    ctx.box(0.06, 0.06, h - 0.06, 0.94, 0.94, 0.07, M(ctx, '#34363c', 0.9))           # felt roof inside the upstand
    # pay window on both faces
    wz0, wz1 = h * 0.58, h - 0.5
    gl = E(ctx, '#ffd890', 2.2, '#5a4020') if lit else M(ctx, '#1c2430', 0.1, 0.2)
    bar = M(ctx, '#5a5e66', 0.35, 0.8)
    frame = M(ctx, '#2a2c30', 0.5, 0.3)
    for face in 'xy':
        fbox(ctx, face, 0.19, wz0 - 0.03, 0.62, wz1 - wz0 + 0.06, frame, t=0.03)
        fbox(ctx, face, 0.22, wz0, 0.56, wz1 - wz0, gl, t=0.01, out=0.019)
        if lit:   # operator silhouette behind the glass
            fbox(ctx, face, 0.42, wz0, 0.16, 0.2, M(ctx, '#5a3a20', 0.9), t=0.004, out=0.026)
            fbox(ctx, face, 0.46, wz0 + 0.2, 0.08, 0.09, M(ctx, '#6a4426', 0.9), t=0.004, out=0.026)
        for i in range(6):
            a = 0.25 + i * 0.1
            if face == 'y': beam(ctx, (a, 1.04, wz0), (a, 1.04, wz1), 0.008, bar, 6)
            else: beam(ctx, (1.04, a, wz0), (1.04, a, wz1), 0.008, bar, 6)
        fbox(ctx, face, 0.17, wz0 - 0.09, 0.66, 0.06, M(ctx, '#8a8478', 0.8), t=0.07)           # sill / coin tray
        fbox(ctx, face, 0.4, wz0 - 0.07, 0.2, 0.03, M(ctx, '#1a1a1e', 0.5), t=0.08)
        # status light + speaker grille under the window
        fbox(ctx, face, 0.46, zm + 0.12, 0.08, 0.08, E(ctx, '#30d050' if v % 2 else '#e03030', 4.0), t=0.03, bevel=0.005)
        fbox(ctx, face, 0.66, zm + 0.1, 0.12, 0.14, M(ctx, '#6a6e76', 0.4, 0.6), t=0.025)
    if v >= 2:   # pinned notice on the brick base
        fbox(ctx, 'y', 0.1, 0.35, 0.22, 0.3, M(ctx, '#e8e4d0', 0.8), t=0.006)
        fbox(ctx, 'y', 0.12, 0.55, 0.18, 0.06, M(ctx, RED, 0.6), t=0.008)

def w_standback(ctx, h, v):
    """back of the stand: blue corrugated cladding over a stained concrete plinth, gutter on top"""
    rnd = random.Random(v * 17 + 2)
    zp = h * 0.28
    plinth = wall_mat(ctx, 'sb_plinth', '#5c5c62', '#6e6e74', scale=8, bump=0.4, streak=0.6, grime=0.9, seed=4)
    ctx.box(0, 0, 0, 1, 1, zp, plinth)
    ctx.box(0, 0, zp - 0.05, 1.02, 1.02, 0.05, M(ctx, '#3a3a40', 0.8))     # flashing
    back = M(ctx, '#142a58', 0.6, 0.3)
    ctx.box(0, 0, zp, 0.96, 0.96, h - zp - 0.15, back)
    clad = stripes_mat(ctx, 'sb_clad', '#2a4c8e', '#1e3c76', 1 / 6, 0.5, 'u', rough=0.45, metal=0.5)
    rib = M(ctx, '#2c4e92', 0.4, 0.55)
    rust = M(ctx, '#7a4a2a', 0.85)
    hz = h - zp - 0.15
    for i in range(6):
        a = i / 6
        both(ctx, a + 0.02, zp, 1 / 12, hz, rib, t=0.05, out=-0.025)
        both(ctx, a + 1 / 12 + 0.02, zp, 1 / 12, hz, clad, t=0.03, out=-0.04)
    # rust streaks from a couple of fixings
    for i in range(2 + v % 2):
        face = rnd.choice('xy'); a = rnd.random() * 0.9; z1 = h - 0.2 - rnd.random() * 0.8
        fbox(ctx, face, a, z1 - 0.9, 0.02, 0.9, rust, t=0.004, out=0.002)
    # fixing bolts rows
    bolt = M(ctx, '#8a92a0', 0.3, 0.8)
    for z in (zp + 0.25, zp + hz * 0.5, h - 0.4):
        for i in range(6):
            fbox(ctx, 'y', i / 6 + 0.05, z, 0.015, 0.015, bolt, t=0.01, out=0.004)
            fbox(ctx, 'x', i / 6 + 0.05, z, 0.015, 0.015, bolt, t=0.01, out=0.004)
    # gutter + roof edge
    gut = M(ctx, '#2a2e36', 0.35, 0.6)
    ctx.box(0, 0, h - 0.15, 1.04, 1.04, 0.12, gut, bevel=0.01)
    ctx.box(0, 0, h - 0.03, 1.0, 1.0, 0.03, stripes_mat(ctx, 'sb_roof', '#26365a', '#1c2a48', 1 / 6, 0.7, 'y', rough=0.5, metal=0.5))
    if v % 4 == 0:   # exposed steel stanchion
        st = M(ctx, '#2a2c30', 0.4, 0.7)
        for face in 'xy':
            fbox(ctx, face, 0.36, zp, 0.28, hz, st, t=0.03, out=0.0)
            fbox(ctx, face, 0.42, zp, 0.16, hz, M(ctx, '#464a52', 0.35, 0.8), t=0.03, out=0.02)
    if v % 4 == 2:   # downpipe
        p = M(ctx, '#1a2a50', 0.5, 0.4)
        fcyl(ctx, 'x', 0.8, 0, 0.035, h - 0.12, p); fcyl(ctx, 'y', 0.8, 0, 0.035, h - 0.12, p)

def w_blockwork(ctx, h, v):
    """painted breeze blocks: navy gloss dado, white stripe, cream above"""
    rnd = random.Random(v * 11 + int(h * 10))
    zd = min(1.5, h * 0.45)
    navy = wall_mat(ctx, 'bw_navy', '#1e2e58', '#22345e', scale=6, bump=0.35, block=('#ffffff', '#e6eaf2'), mortar='#5a6a90',
                    rough=0.25, grime=0.4, seed=5)
    cream = wall_mat(ctx, 'bw_cream', '#cfc8b0', '#d8d2bc', scale=6, bump=0.35, block=('#ffffff', '#f0ece4'), mortar='#a8a28e',
                     rough=0.7, seed=6)
    ctx.box(0, 0, 0, 1, 1, zd, navy)
    ctx.box(0, 0, zd, 1.006, 1.006, 0.08, M(ctx, '#ecE8dc'.lower(), 0.35))
    ctx.box(0, 0, zd + 0.08, 1, 1, h - zd - 0.08 - 0.06, cream)
    ctx.box(0, 0, h - 0.06, 1.01, 1.01, 0.06, M(ctx, '#8a8678', 0.8), bevel=0.004)
    ctx.box(0.02, 0.02, h - 0.004, 0.96, 0.96, 0.006, M(ctx, '#5a5850', 0.95))
    # skirting scuffs (boot marks)
    scuff = M(ctx, '#0e1428', 0.9)
    for i in range(3):
        fbox(ctx, rnd.choice('xy'), rnd.random() * 0.85, 0.05 + rnd.random() * 0.3, 0.05 + rnd.random() * 0.1, 0.02, scuff, t=0.004)
    kind = v % 4
    if h >= 2.5:
        if kind == 1:     # fire exit sign (green, lit)
            fbox(ctx, 'y', 0.3, h - 0.6, 0.4, 0.2, M(ctx, '#e8e8e0', 0.5), t=0.04)
            fbox(ctx, 'y', 0.32, h - 0.58, 0.36, 0.16, E(ctx, '#20c050', 2.5), t=0.045)
            fbox(ctx, 'y', 0.36, h - 0.55, 0.06, 0.1, E(ctx, '#f0fff0', 3.0), t=0.05)
            fbox(ctx, 'y', 0.46, h - 0.52, 0.16, 0.04, E(ctx, '#f0fff0', 3.0), t=0.05)
        elif kind == 2:   # conduit + junction box
            c = M(ctx, '#d8d8d0', 0.5)
            fbox(ctx, 'x', 0, h - 0.35, 1, 0.035, c, t=0.035)
            fbox(ctx, 'x', 0.62, 0.9, 0.035, h - 1.25, c, t=0.035)
            fbox(ctx, 'x', 0.55, 1.4, 0.18, 0.24, M(ctx, '#c8c8c0', 0.5), t=0.07, bevel=0.008)
            fbox(ctx, 'x', 0.6, 1.5, 0.08, 0.04, M(ctx, YEL, 0.5), t=0.075)
        elif kind == 3:   # notice board with club poster
            fbox(ctx, 'y', 0.2, zd + 0.3, 0.6, 0.55, M(ctx, '#3a2a1a', 0.8), t=0.03)
            fbox(ctx, 'y', 0.24, zd + 0.34, 0.25, 0.46, M(ctx, '#e8e4d8', 0.8), t=0.035)
            fbox(ctx, 'y', 0.26, zd + 0.6, 0.21, 0.16, M(ctx, BLUE, 0.6), t=0.04)
            fbox(ctx, 'y', 0.53, zd + 0.4, 0.23, 0.32, M(ctx, '#f0e8a0', 0.8), t=0.035)
            for i in range(3): fbox(ctx, 'y', 0.56, zd + 0.46 + i * 0.07, 0.17, 0.025, M(ctx, '#3a3a40', 0.9), t=0.04)
    else:
        if kind == 1:   # little stencilled block-number
            fbox(ctx, 'y', 0.35, zd + 0.15, 0.3, 0.2, M(ctx, '#1c2c54', 0.5), t=0.006)
            fbox(ctx, 'y', 0.42, zd + 0.19, 0.16, 0.12, M(ctx, '#e8e4d8', 0.5), t=0.008)
        elif kind == 2:
            fbox(ctx, 'x', 0.3, zd + 0.1, 0.4, 0.035, M(ctx, '#d8d8d0', 0.5), t=0.035)

def w_pillar(ctx, h, v):
    """round concrete column with a club band; flared base and capital"""
    conc = wall_mat(ctx, 'pl_conc', '#6c6c74', '#7c7c84', scale=9, bump=0.35, streak=0.4, seed=7)
    ctx.box(0.14, 0.14, 0, 0.72, 0.72, 0.14, M(ctx, '#4a4a52', 0.8), bevel=0.02)
    ctx.cyl(0.5, 0.5, 0.14, 0.31, 0.12, M(ctx, '#3a3a40', 0.8), 32)
    ctx.cyl(0.5, 0.5, 0.26, 0.29, h - 0.26 - 0.3, conc, 32)
    ctx.cyl(0.5, 0.5, h - 0.3, 0.29, 0.18, conc, 32, r2=0.4)
    ctx.box(0.08, 0.08, h - 0.12, 0.84, 0.84, 0.12, wall_mat(ctx, 'pl_cap', '#5a5a62', '#6a6a72', scale=12, seed=8), bevel=0.01)
    b0, b1 = h * 0.44, h * 0.58
    ctx.cyl(0.5, 0.5, b0, 0.296, b1 - b0, M(ctx, BLUE, 0.4), 32)
    for z in (b0 + 0.07, b1 - 0.12): ctx.cyl(0.5, 0.5, z, 0.298, 0.05, M(ctx, '#f0f0e8', 0.4), 32)
    if v == 1:   # fire extinguisher point plate + bracket
        fbox(ctx, 'y', 0.4, 0.9, 0.2, 0.28, M(ctx, RED, 0.5), t=0.02, base=0.79)
        ctx.cyl(0.5, 0.86, 0.3, 0.06, 0.55, M(ctx, '#c01818', 0.35, 0.2), 14)
        ctx.cyl(0.5, 0.86, 0.85, 0.025, 0.08, M(ctx, '#1a1a1a', 0.5), 8)

def w_kioskwall(ctx, h, v):
    """refreshment kiosk: menu board, striped fascia, open lit hatch with urn & pies, steel counter"""
    rnd = random.Random(v * 23 + 1)
    zc = 0.6
    zh = h - 1.0                      # top of hatch
    zf = zh + 0.2                     # top of fascia
    steel = M(ctx, '#9aa0a8', 0.35, 0.8)
    ctx.box(0, 0, 0, 1, 1, zc - 0.04, stripes_mat(ctx, 'kw_front', '#a8aeb6', '#8a9098', 1 / 8, 0.5, 'u', rough=0.35, metal=0.7))
    ctx.box(0, 0, zc - 0.04, 1.06, 1.06, 0.05, steel, bevel=0.006)             # counter top ledge
    # recessed hatch interior
    ctx.box(0, 0, zc, 0.62, 0.62, zh - zc, E(ctx, '#e8a858', 0.9, '#c88a44'))
    ctx.box(0, 0, zc, 1, 1, 0.01, M(ctx, '#7a7e86', 0.4, 0.5))
    for face in 'xy':
        for a in (0.0, 0.95): fbox(ctx, face, a, zc, 0.05, zh - zc, M(ctx, '#3a3a40', 0.6), t=0.38, base=0.81)
    ctx.box(0.94, 0.94, zc, 0.06, 0.06, zh - zc, M(ctx, '#3a3a40', 0.6))
    # interior: shelf, urn, cups, pies (on both faces)
    shelf = M(ctx, '#5a3a20', 0.8)
    urn = M(ctx, '#c8ccd4', 0.2, 0.9)
    pie = M(ctx, '#c8862e', 0.6)
    for face in 'xy':
        P = (lambda a, d: (a, d)) if face == 'y' else (lambda a, d: (d, a))
        x, y = P(0.06, 0.62); w, dd = (0.88, 0.12) if face == 'y' else (0.12, 0.88)
        ctx.box(x, y, zc + 0.42, w, dd, 0.03, shelf)
        ux, uy = P(0.62 + rnd.random() * 0.15, 0.7)
        ctx.cyl(ux, uy, zc, 0.07, 0.3, urn, 14); ctx.cyl(ux, uy, zc + 0.3, 0.04, 0.04, M(ctx, '#1a1a1a', 0.5), 8)
        for i in range(3 + v % 2):
            px, py = P(0.12 + i * 0.1, 0.72)
            ctx.cyl(px, py, zc + 0.45, 0.04, 0.05, pie, 10, r2=0.034)
        for i in range(3):
            cx, cy = P(0.2 + i * 0.07, 0.86)
            ctx.cyl(cx, cy, zc + 0.01, 0.025, 0.09, M(ctx, '#f0f0e8', 0.6), 8, r2=0.03)
        if v % 2:   # bottles on the shelf
            for i in range(3):
                bx, by = P(0.55 + i * 0.07, 0.66)
                ctx.cyl(bx, by, zc + 0.45, 0.018, 0.13, M(ctx, ['#d02020', '#e8c020', '#5a3010'][i], 0.3), 8)
    # rolled shutter box above the opening
    ctx.box(0, 0, zh - 0.14, 1.02, 1.02, 0.14, stripes_mat(ctx, 'kw_shut', '#a0a4ac', '#7a7e86', 0.05, 0.5, 'z', rough=0.4, metal=0.7))
    # striped fascia
    ctx.box(0, 0, zh, 1.03, 1.03, 0.2, stripes_mat(ctx, 'kw_fascia', BLUE, '#f0f0e8', 0.25, 0.5, 'u', rough=0.5))
    # menu board
    ctx.box(0, 0, zf, 1, 1, h - zf - 0.15, M(ctx, '#141418', 0.6))
    ink = [E(ctx, '#e8e8e0', 1.2), E(ctx, '#ff6a3a', 1.5), E(ctx, YEL, 1.6)]
    rows = int((h - zf - 0.25) / 0.12)
    for face in 'xy':
        for r in range(rows):
            z = h - 0.27 - r * 0.12
            a = 0.08
            while a < 0.66:
                w = 0.05 + rnd.random() * 0.12
                if a + w > 0.66: break
                fbox(ctx, face, a, z, w, 0.05, ink[1] if r == 0 else ink[0], t=0.012, out=0.003)
                a += w + 0.04
            fbox(ctx, face, 0.76, z, 0.14, 0.05, ink[2], t=0.012, out=0.003)
    ctx.box(0, 0, h - 0.15, 1.02, 1.02, 0.15, M(ctx, '#1a1a20', 0.5, 0.3), bevel=0.006)
    ctx.box(0.05, 0.05, h - 0.01, 0.92, 0.92, 0.012, M(ctx, '#2a2a30', 0.9))

def w_toiletwall(ctx, h, v):
    """grubby white tiles, navy band, marker scribbles"""
    rnd = random.Random(v * 41 + 9)
    tiles = wall_mat(ctx, 'tw_tiles', '#d4d5ce', '#e4e5de', scale=5, bump=0.45, block=('#ffffff', '#f2f2ea'), mortar='#8a8c88',
                     bw=0.25, bh=0.2 * ctx.UNIT, stack=True, mortar_size=0.01, rough=0.25, grime=1.0, streak=0.5, seed=9)
    zb = h * 0.45
    ctx.box(0, 0, 0, 1, 1, zb - 0.15, tiles)
    navy = wall_mat(ctx, 'tw_navy', '#1c2c54', '#22325c', scale=5, bump=0.4, block=('#ffffff', '#e8ecf4'), mortar='#4a5470',
                    bw=0.25, bh=0.15 * ctx.UNIT, stack=True, mortar_size=0.012, rough=0.2, seed=10)
    ctx.box(0, 0, zb - 0.15, 1.004, 1.004, 0.15, navy)
    ctx.box(0, 0, zb, 1, 1, h - zb - 0.06, tiles)
    ctx.box(0, 0, h - 0.06, 1.01, 1.01, 0.06, M(ctx, '#8a8a90', 0.6), bevel=0.004)
    # cracked / missing tiles
    for i in range(2 + v % 3):
        face = rnd.choice('xy'); a = int(rnd.random() * 4) * 0.25; z = int(rnd.random() * (h / 0.2 - 2)) * 0.2 + 0.2
        if abs(z - zb) < 0.3: continue
        fbox(ctx, face, a + 0.01, z + 0.01, 0.23, 0.18, M(ctx, '#a8a89a', 0.9), t=0.006)
    # marker graffiti scribbles
    if v % 3 == 0:
        ink = M(ctx, '#b02020' if v % 2 else '#202020', 0.9)
        face = 'y' if v % 2 == 0 else 'x'
        z = zb + 0.25
        for i in range(9):
            a = 0.18 + i * 0.07
            beam(ctx, *(((a, 1.004, z + rnd.random() * 0.25), (a + 0.05, 1.004, z + rnd.random() * 0.25)) if face == 'y'
                        else ((1.004, a, z + rnd.random() * 0.25), (1.004, a + 0.05, z + rnd.random() * 0.25))), 0.007, ink, 4)
    kind = v % 6
    if kind == 1:     # hand dryer
        fbox(ctx, 'y', 0.35, 1.0, 0.3, 0.32, M(ctx, '#e8e8e4', 0.35), t=0.18, bevel=0.03)
        fbox(ctx, 'y', 0.42, 0.98, 0.16, 0.05, M(ctx, '#3a3a40', 0.5), t=0.2)
    elif kind == 2:   # paper towel dispenser (empty, obviously)
        fbox(ctx, 'x', 0.3, 1.1, 0.3, 0.4, M(ctx, '#c8ccd0', 0.3, 0.7), t=0.12, bevel=0.01)
        fbox(ctx, 'x', 0.34, 1.12, 0.22, 0.04, M(ctx, '#1a1a1e', 0.5), t=0.13)
    elif kind == 4:   # exposed water pipe
        p = M(ctx, '#b87333', 0.3, 0.9)
        fbox(ctx, 'y', 0, h - 0.45, 1, 0.04, p, t=0.04, out=0.03)
        fbox(ctx, 'x', 0, h - 0.45, 1, 0.04, p, t=0.04, out=0.03)
    elif kind == 5:   # wall cistern
        fbox(ctx, 'x', 0.2, h - 0.75, 0.5, 0.35, M(ctx, '#e0e0da', 0.4), t=0.16, bevel=0.02)
        fbox(ctx, 'x', 0.62, 0.3, 0.03, h - 1.05, M(ctx, '#c8ccd0', 0.3, 0.8), t=0.03, out=0.02)

def _fence(ctx, h, v, along):
    """perimeter / segregation fence: posts every half tile, rails, diamond wire mesh, spiked top. along 'y' -> plane x=0.5"""
    post = M(ctx, '#2e3238', 0.4, 0.7)
    wire = M(ctx, '#9aa2ac', 0.35, 0.85)
    rail = M(ctx, '#3a3e46', 0.4, 0.7)
    def P(s, z, off=0.0):        # s along the fence, z units, off across
        return (0.5 + off, s, z) if along == 'y' else (s, 0.5 + off, z)
    def B(s, off, z, ls, lo, hh, m):
        if along == 'y': ctx.box(0.5 + off, s, z, lo, ls, hh, m)
        else: ctx.box(s, 0.5 + off, z, ls, lo, hh, m)
    for s in (0.0, 0.5):
        B(s - 0.03, -0.03, 0, 0.06, 0.06, h, post)
        B(s - 0.05, -0.05, 0, 0.1, 0.1, 0.06, M(ctx, '#5a5a60', 0.8))
    for z in (0.05, h * 0.5, h - 0.28):
        beam(ctx, P(0, z), P(1, z), 0.018, rail, 8)
    # diamond mesh: wires s +/- z (metres) on a 0.125 m lattice, clipped to the panel
    z0, z1 = 0.07 * ctx.UNIT, (h - 0.3) * ctx.UNIT
    sp = 0.125
    for sign in (1, -1):
        for k in range(-int(z1 / sp) - 2, int((1 + z1) / sp) + 3):
            c = k * sp                                   # wire: s = c + sign * zm
            sa, za, sb, zb = c + sign * z0, z0, c + sign * z1, z1
            if sa > sb: sa, za, sb, zb = sb, zb, sa, za
            if sb < 0 or sa > 1: continue
            if sa < 0: za = za + (zb - za) * (0 - sa) / (sb - sa); sa = 0.0
            if sb > 1: zb = za + (zb - za) * (1 - sa) / (sb - sa); sb = 1.0
            if sb - sa > 0.01:
                beam(ctx, P(sa, za / ctx.UNIT), P(sb, zb / ctx.UNIT), 0.0045, wire, 4)
    # spiked top: inward-cranked bayonet strip
    for i in range(8):
        s = i / 8 + 0.0625
        cone(ctx, P(s, h - 0.28), P(s, h), 0.012, 0.002, post, 5)
    beam(ctx, P(0, h - 0.06), P(1, h - 0.06), 0.008, wire, 6)
    if v == 1:   # tied-on away scarf (red/white)
        for i in range(5):
            m = M(ctx, RED if i % 2 == 0 else '#f4f1e8', 0.8)
            B(0.62 + i * 0.05, 0.035, h * 0.5 - 0.35 + (i % 2) * 0.01, 0.05, 0.015, 0.4, m)

def w_fenceY(ctx, h, v): _fence(ctx, h, v, 'y')
def w_fenceX(ctx, h, v): _fence(ctx, h, v, 'x')

def w_farstand(ctx, h, v):
    """the main stand across the pitch: dark roof with floodlight strip, raked rows packed with home fans, LED advert band"""
    rnd = random.Random(v * 97 + 13)
    zr = h - 1.1
    za = 0.7
    # LED advert band
    ctx.box(0, 0, 0, 1, 1, za, M(ctx, '#1a1a20', 0.5, 0.3))
    pal = [(WHITE, BLUE), (YEL, '#1a1a1a'), (BLUE, '#ffffff'), (RED, '#ffffff')][v % 4]
    fbox(ctx, 'y', 0.0, 0.12, 1.0, 0.48, E(ctx, pal[0], 0.9, pal[0]), t=0.02)
    a = 0.06
    while a < 0.92:
        w = 0.06 + rnd.random() * 0.14
        if a + w > 0.96: break
        if rnd.random() < 0.8: fbox(ctx, 'y', a, 0.2 + rnd.random() * 0.05, w, 0.26 + rnd.random() * 0.06, E(ctx, pal[1], 1.1, pal[1]), t=0.024)
        a += w + 0.04
    # stand body behind the rows
    ctx.box(0, 0, za, 1, 0.9, zr - za, M(ctx, '#0e1a3a', 0.8))
    row_h = 0.25
    nrows = int((zr - za) / row_h)
    tread = M(ctx, '#5a6278', 0.85)
    seatm = M(ctx, BLUE, 0.45)
    seatd = M(ctx, '#173a8a', 0.5)
    skins = [M(ctx, c, 0.7) for c in ('#e2a97a', '#c08a60', '#f0c098', '#8a5636', '#d49a6a')]
    shirts = [M(ctx, c, 0.7) for c in (BLUE, BLUE, BLUE, '#f2f2f2', '#2a2a34', '#1d2742', '#b5a98a')]
    hairs = [M(ctx, c, 0.8) for c in ('#141016', '#3a2717', '#6a4a2a', '#b4521c', '#5a5a5a')]
    for r in range(nrows):
        z = za + r * row_h
        ctx.box(0, 0.88, z, 1, 0.12, 0.04, tread)
        ctx.box(0, 0.86, z + 0.04, 1, 0.02, row_h - 0.04, M(ctx, '#1a2a58', 0.9))
        for s in range(4):
            x = s * 0.25 + 0.03
            k = rnd.random()
            if k < 0.72:   # a fan
                shirt = pick(rnd, shirts)
                ctx.box(x + 0.02, 0.9, z + 0.04, 0.17, 0.08, 0.17, shirt, bevel=0.015)
                ctx.sphere(x + 0.105, 0.94, z + 0.27, 0.055, pick(rnd, skins))
                ctx.sphere(x + 0.105, 0.935, z + 0.3, 0.05, pick(rnd, hairs), 1, 1, 0.55)
                if rnd.random() < 0.18:       # arms up
                    ctx.box(x + 0.03, 0.92, z + 0.2, 0.025, 0.025, 0.14, shirt)
                    ctx.box(x + 0.15, 0.92, z + 0.2, 0.025, 0.025, 0.14, shirt)
                elif rnd.random() < 0.15:     # scarf held up
                    ctx.box(x - 0.02, 0.95, z + 0.24, 0.24, 0.01, 0.05, stripes_mat(ctx, 'fs_scarf', BLUE, '#f2f2f2', 0.06, 0.5, 'x'))
            else:          # empty tip-up seat
                ctx.box(x + 0.03, 0.9, z + 0.04, 0.16, 0.08, 0.04, seatd)
                ctx.box(x + 0.03, 0.89, z + 0.08, 0.16, 0.03, 0.12, seatm)
    # roof: fascia with floodlight units, dark deck
    ctx.box(0, 0, zr, 1, 1, 1.1, M(ctx, '#14151a', 0.6, 0.3))
    ctx.box(0, 0, zr, 1.0, 1.04, 0.06, M(ctx, '#3a3e48', 0.5, 0.5))
    fbox(ctx, 'y', 0, zr + 0.35, 1, 0.3, M(ctx, '#2a2c34', 0.5, 0.4), t=0.04, out=0.01)
    lamps = [(0.1, 0.38), (0.6, 0.38)] if v % 2 == 0 else [(0.35, 0.38)]
    for (a, w) in lamps:
        fbox(ctx, 'y', a, zr + 0.4, w * 0.75, 0.2, M(ctx, '#1a1a20', 0.5), t=0.06, out=0.02)
        for i in range(3):
            fbox(ctx, 'y', a + 0.03 + i * w * 0.24, zr + 0.43, w * 0.18, 0.14, E(ctx, '#e8f0ff', 6.0, '#ffffff'), t=0.065, out=0.02)
    ctx.box(0, 0, h - 0.04, 1, 1, 0.04, stripes_mat(ctx, 'fs_roof', '#1a1c22', '#24272e', 0.2, 0.6, 'x', rough=0.5, metal=0.5))

def w_advert(ctx, h, v):
    """pitch-side LED/printed advertising hoarding for invented brands (abstract wordmarks)"""
    pals = [('#1a1a8a', '#ffd23a'), ('#c8102e', '#ffffff'), ('#0a6a3a', '#ffffff'), ('#ffd23a', '#1a1a1a'), ('#ffffff', '#c8102e'), ('#2a2a2a', '#3aff7a')]
    bg, fg = pals[v % len(pals)]
    rnd = random.Random(v * 7 + 3)
    frame = M(ctx, '#1a1a20', 0.45, 0.5)
    ctx.box(0, 0, 0, 0.94, 0.94, h, M(ctx, '#22222a', 0.6, 0.3))
    ctx.box(0, 0, h - 0.05, 1.0, 1.0, 0.05, frame)
    ctx.box(0, 0, 0, 1.0, 1.0, 0.06, frame)
    for face in 'xy':
        fbox(ctx, face, 0.0, 0.06, 1.0, h - 0.11, E(ctx, bg, 0.55, bg), t=0.06, out=-0.03)
        # wordmark: chunky blocks + a roundel or chevron
        a = 0.07 + rnd.random() * 0.05
        style = (v + (face == 'x')) % 3
        if style == 0:
            ctx_s = 0.16
            fbox(ctx, face, a, 0.18, ctx_s, h - 0.36, E(ctx, fg, 0.9, fg), t=0.008, out=0.001)   # roundel-ish block
            a += ctx_s + 0.05
        while a < 0.88:
            w = 0.04 + rnd.random() * 0.08
            if a + w > 0.92: break
            hh = (h - 0.4) * (0.6 + rnd.random() * 0.4)
            fbox(ctx, face, a, 0.2, w, hh, E(ctx, fg, 0.9, fg), t=0.008, out=0.001)
            a += w + 0.03
        if style == 2:
            fbox(ctx, face, 0.05, 0.12, 0.9, 0.035, E(ctx, fg, 0.9, fg), t=0.008, out=0.001)

def w_cratestack(ctx, h, v):
    """pallet with a crate and boxes (stock room)"""
    wood = M(ctx, '#8a6038', 0.85); dark = M(ctx, '#5e3e20', 0.9)
    pal = M(ctx, '#9a7a4a', 0.9)
    for i in range(3): ctx.box(0.02, 0.05 + i * 0.42, 0, 0.96, 0.1, 0.1, pal)
    for i in range(5): ctx.box(0.02 + i * 0.235, 0.02, 0.1, 0.12, 0.96, 0.03, pal)
    if v == 0:
        ctx.box(0.04, 0.04, 0.13, 0.92, 0.92, h - 0.13, wood, bevel=0.01)
        for (x, y, w, d) in ((0.03, 0.9, 0.94, 0.07), (0.9, 0.03, 0.07, 0.94)):
            ctx.box(x, y, 0.13, w, d, h - 0.13, dark)
        for z in (0.5, h - 0.1):
            ctx.box(0.03, 0.03, z, 0.95, 0.95, 0.06, dark)
        both(ctx, 0.3, 0.6, 0.35, 0.2, M(ctx, '#2a2a2a', 0.9), t=0.004, out=-0.025)   # stencil
    else:
        card = M(ctx, '#b08a58', 0.9); tape = M(ctx, '#d8c8a0', 0.6)
        ctx.box(0.05, 0.05, 0.13, 0.9, 0.9, 0.55, card, bevel=0.01)
        ctx.box(0.05, 0.47, 0.67, 0.9, 0.06, 0.01, tape)
        ctx.box(0.12, 0.1, 0.68, 0.8, 0.82, h - 0.68, M(ctx, '#a07a48', 0.9), bevel=0.01)
        ctx.box(0.12, 0.48, h - 0.005, 0.8, 0.06, 0.006, tape)
        fbox(ctx, 'y', 0.3, 0.3, 0.3, 0.2, M(ctx, BLUE, 0.7), t=0.004, out=-0.05 + 0.002)

PIECES = [
    dict(kind='wall', id='awayend_stadiumwall', heights=[3.5], variants=6, build=w_stadiumwall),
    dict(kind='wall', id='awayend_turnstilewall', heights=[2.6], variants=4, build=w_turnstilewall),
    dict(kind='wall', id='awayend_standback', heights=[3.6], variants=4, build=w_standback),
    dict(kind='wall', id='awayend_blockwork', heights=[1.7, 3], variants=4, build=w_blockwork),
    dict(kind='wall', id='awayend_pillar', heights=[4], variants=2, build=w_pillar),
    dict(kind='wall', id='awayend_kioskwall', heights=[2.4], variants=4, build=w_kioskwall),
    dict(kind='wall', id='awayend_toiletwall', heights=[2.5], variants=6, build=w_toiletwall),
    dict(kind='wall', id='awayend_fenceY', heights=[2.2], variants=2, build=w_fenceY),
    dict(kind='wall', id='awayend_fenceX', heights=[2.2], variants=2, build=w_fenceX),
    dict(kind='wall', id='awayend_farstand', heights=[6], variants=6, build=w_farstand),
    dict(kind='wall', id='advert', heights=[0.9], variants=6, build=w_advert),
    dict(kind='wall', id='crateStack', heights=[1.2], variants=2, build=w_cratestack),
]

# ================================================================== FLOORS (patches n x n, seamless: world-space periodic textures)
def _conc(ctx, key, c1, c2, n, seed=0.0, scale=10.0, rough=0.88, bump=0.3, **kw):
    return floor_mat(ctx, key, [(0.25, c1), (0.75, c2)], n, scale=scale, rough=rough, bump=bump, seed=seed, **kw)

def _specks(ctx, n, cols, count, seed, size=(0.02, 0.05)):
    """gum / grit specks scattered over the patch (kept inside it so repeats stay seamless)"""
    rnd = random.Random(seed)
    mats = [M(ctx, c, 0.9) for c in cols]
    for i in range(count):
        s = size[0] + rnd.random() * (size[1] - size[0])
        x, y = rnd.random() * (n - s), rnd.random() * (n - s)
        ctx.cyl(x + s / 2, y + s / 2, 0.0, s / 2, 0.006, pick(rnd, mats), 8)

def _terrace(ctx, n, aisle=False):
    rnd = random.Random(4 if aisle else 3)
    treads = [_conc(ctx, 'tr_a', '#54555c', '#62636a', n, 1.0), _conc(ctx, 'tr_b', '#585960', '#666770', n, 2.0)]
    nose = _conc(ctx, 'tr_nose', '#7c7d84', '#94959c', n, 3.0, scale=16)
    riser = M(ctx, '#2c2d35', 0.9); riser2 = M(ctx, '#1e1f25', 0.9)
    yel = floor_mat(ctx, 'tr_yel', [(0.3, '#c8a828'), (0.7, '#e2c434')], n, scale=14, rough=0.6, bump=0.25, seed=5.0)
    for i in range(n):
        for j in range(n):
            ctx.box(i, j, 0, 0.84, 1, 0.004, pick(rnd, treads))
            ctx.box(i + 0.84, j, 0, 0.06, 1, 0.03, yel if aisle else nose, bevel=0.008)
            ctx.box(i + 0.9, j, 0, 0.055, 1, 0.006, riser)
            ctx.box(i + 0.955, j, 0, 0.045, 1, 0.006, riser2)
            if aisle:
                ctx.box(i, j, 0, 0.84, 0.05, 0.008, yel); ctx.box(i, j + 0.95, 0, 0.84, 0.05, 0.008, yel)
                ctx.box(i + 0.78, j, 0, 0.06, 1, 0.01, yel)
    if not aisle:   # expansion joint every 4 tiles + drainage slot
        ctx.box(0, 0, 0, n, 0.025, 0.008, M(ctx, '#34353c', 0.9))
    _specks(ctx, n, ['#3a3a40', '#2e2e34', '#8a8a80'], 26 * n // 4, 7 if aisle else 6)

def f_terrace(ctx, n): _terrace(ctx, n)
def f_aisle(ctx, n): _terrace(ctx, n, True)

def f_concourse(ctx, n):
    m = floor_mat(ctx, 'cc_conc', [(0.2, '#343a3c'), (0.55, '#3e4648'), (0.85, '#4a5254')], n, scale=7, rough=0.85, bump=0.3,
                  rough_wet=0.12, wet_scale=1.6, wet_thresh=0.66, wet_stops=[(0.2, '#4a3c20'), (0.8, '#5e4c28')], seed=11.0)
    ctx.plane(0, 0, n, n, m)
    joint = M(ctx, '#24292a', 0.9)
    for i in range(n):
        ctx.box(i, 0, 0, 0.025, n, 0.004, joint); ctx.box(0, i, 0, n, 0.025, 0.004, joint)
    _specks(ctx, n, ['#1e2224', '#5a6062', '#2a2e30'], 30 * n // 4, 12)
    # dropped cups / foil wrappers (static litter)
    rnd = random.Random(13)
    for i in range(3):
        x, y = 0.3 + rnd.random() * (n - 0.6), 0.3 + rnd.random() * (n - 0.6)
        ctx.box(x, y, 0, 0.06, 0.04, 0.02, M(ctx, '#e8dcc0', 0.6)); ctx.box(x + 0.02, y, 0.02, 0.02, 0.04, 0.003, M(ctx, '#d07020', 0.6))

def _stairs(ctx, n, along):
    conc = [_conc(ctx, 'st_a', '#545560', '#5e5f68', n, 21.0), _conc(ctx, 'st_b', '#585964', '#62636c', n, 22.0)]
    yel = floor_mat(ctx, 'st_yel', [(0.3, '#a8902a'), (0.7, '#e0c034')], n, scale=12, rough=0.55, bump=0.4, seed=23.0)
    sh = M(ctx, '#26272d', 0.9); string = M(ctx, '#2e2f36', 0.8)
    rnd = random.Random(21)
    def B(a, b, z, la, lb, hh, m, bev=0.0):
        if along == 'x': ctx.box(a, b, z, la, lb, hh, m, bevel=bev)
        else: ctx.box(b, a, z, lb, la, hh, m, bevel=bev)
    for i in range(n):
        for j in range(n):
            for k in range(3):
                a = i + k / 3
                B(a, j, 0, 0.74 / 3, 1, 0.004, pick(rnd, conc))
                B(a + 0.74 / 3, j, 0, 0.12 / 3, 1, 0.03, yel, 0.006)
                B(a + 0.86 / 3, j, 0, 0.14 / 3, 1, 0.006, sh)
            B(i, j, 0, 1, 0.06, 0.05, string, 0.01); B(i, j + 0.94, 0, 1, 0.06, 0.05, string, 0.01)

def f_stairs(ctx, n): _stairs(ctx, n, 'x')
def f_stairsY(ctx, n): _stairs(ctx, n, 'y')

def f_grate(ctx, n):
    plate = floor_mat(ctx, 'gr_plate', [(0.3, '#585d64'), (0.7, '#686d74')], n, scale=6, rough=0.4, bump=0.1, seed=31.0, metal=0.85)
    ctx.plane(0, 0, n, n, plate)
    lug = M(ctx, '#9aa0a8', 0.3, 0.9)
    for i in range(n * 8):
        for j in range(n * 8):
            cx, cy = (i + 0.5) / 8, (j + 0.5) / 8
            d = 0.035
            if (i + j) % 2: beam(ctx, (cx - d, cy - d, 0.01), (cx + d, cy + d, 0.01), 0.009, lug, square=True)
            else: beam(ctx, (cx - d, cy + d, 0.01), (cx + d, cy - d, 0.01), 0.009, lug, square=True)
    edge = M(ctx, '#2a2c30', 0.6, 0.5)
    for i in range(n):
        ctx.box(i, 0, 0, 0.035, n, 0.012, edge); ctx.box(0, i, 0, n, 0.035, 0.012, edge)
    bolt = M(ctx, '#b0b6be', 0.3, 0.9)
    for i in range(n):
        for j in range(n):
            for (bx, by) in ((0.07, 0.07), (0.93, 0.07), (0.07, 0.93), (0.93, 0.93)):
                ctx.cyl(i + bx, j + by, 0, 0.015, 0.02, bolt, 8)

def f_wettiles(ctx, n):
    ctx.plane(0, 0, n, n, M(ctx, '#5e6264', 0.9), gz=-0.002)
    def tm(k, c1, c2):
        return floor_mat(ctx, 'wt_%d' % k, [(0.3, c1), (0.7, c2)], n, scale=5, rough=0.35, bump=0.1, rough_wet=0.04, wet_scale=1.3,
                         wet_thresh=0.6, wet_stops=[(0.3, '#8aa2b4'), (0.7, '#9ab0c0')], seed=41.0)
    mats = [tm(0, '#c0c4be', '#ccd0ca'), tm(1, '#b8bcb4', '#c4c8c0'), tm(2, '#d0d4ce', '#dadcd6'), tm(3, '#a8aca2', '#b4b6ac')]
    rnd = random.Random(41)
    s = 1 / 3
    for i in range(n * 3):
        for j in range(n * 3):
            r = rnd.random()
            m = mats[3] if r < 0.08 else mats[2] if r > 0.88 else mats[int(rnd.random() * 2)]
            ctx.box(i * s + 0.012, j * s + 0.012, 0, s - 0.024, s - 0.024, 0.012, m, bevel=0.004)
    # dirty grout / dropped paper
    for i in range(2):
        x, y = 0.4 + rnd.random() * (n - 0.8), 0.4 + rnd.random() * (n - 0.8)
        ctx.box(x, y, 0.012, 0.1, 0.07, 0.004, M(ctx, '#e8e8e0', 0.8))

def _corridor(ctx, n):
    m = floor_mat(ctx, 'co_vinyl', [(0.25, '#30394a'), (0.6, '#36404e'), (0.9, '#424c5c')], n, scale=9, rough=0.45, bump=0.12, seed=51.0)
    ctx.plane(0, 0, n, n, m)
    rnd = random.Random(51)
    scuff = M(ctx, '#222a36', 0.7); scuffL = M(ctx, '#4e5866', 0.6)
    for i in range(10 * n // 4):
        x, y = 0.2 + rnd.random() * (n - 0.5), 0.2 + rnd.random() * (n - 0.5)
        a = rnd.random() * math.pi
        beam(ctx, (x, y, 0.002), (x + math.cos(a) * 0.15, y + math.sin(a) * 0.15, 0.002), 0.006, pick(rnd, [scuff, scuffL]), square=True)

def f_corridor(ctx, n): _corridor(ctx, n)

def f_corridorLine(ctx, n):
    _corridor(ctx, n)
    paint = floor_mat(ctx, 'co_paint', [(0.3, '#c8a828'), (0.7, '#e0c038')], n, scale=20, rough=0.6, bump=0.2, seed=52.0)
    for j in range(n):
        for k in range(n * 2):
            ctx.box(k * 0.5, j + 0.44, 0, 0.4, 0.12, 0.004, paint)

def f_track(ctx, n):
    m = floor_mat(ctx, 'tk_rubber', [(0.2, '#6a2e22'), (0.5, '#7c3628'), (0.8, '#9a4a36')], n, scale=40, rough=0.95, bump=0.6, detail=8, seed=61.0)
    ctx.plane(0, 0, n, n, m)
    line = floor_mat(ctx, 'tk_line', [(0.3, '#d8d4cc'), (0.7, '#ece8e0')], n, scale=30, rough=0.8, bump=0.3, seed=62.0)
    for i in range(0, n, 3):
        ctx.box(i + 0.47, 0, 0, 0.06, n, 0.004, line)

def f_moat(ctx, n):
    water = floor_mat(ctx, 'mo_water', [(0.2, '#162a22'), (0.55, '#20362e'), (0.85, '#2e4a3e')], n, scale=3.5, rough=0.06, bump=0.5,
                      detail=3, seed=71.0)
    ctx.plane(0, 0, n, n, water)
    rnd = random.Random(71)
    for i in range(4):   # floating litter
        x, y = 0.3 + rnd.random() * (n - 0.6), 0.3 + rnd.random() * (n - 0.6)
        k = rnd.random()
        if k < 0.4: ctx.cyl(x, y, 0, 0.035, 0.03, M(ctx, '#e8e8e0', 0.6), 10)
        elif k < 0.7: ctx.box(x, y, 0, 0.12, 0.08, 0.006, M(ctx, '#d8d0b8', 0.8))
        else: beam(ctx, (x, y, 0.01), (x + 0.12, y + 0.05, 0.01), 0.02, M(ctx, '#3a6a3a', 0.2), 8)
    # scum along the patch (subtle algae blobs)
    for i in range(5):
        x, y = 0.3 + rnd.random() * (n - 0.6), 0.3 + rnd.random() * (n - 0.6)
        ctx.cyl(x, y, 0, 0.08 + rnd.random() * 0.1, 0.004, M(ctx, '#3a4a2a', 0.7), 12)

def f_forecourt(ctx, n):
    ctx.plane(0, 0, n, n, M(ctx, '#3a363c', 0.95), gz=-0.002)
    mats = [floor_mat(ctx, 'fc_%d' % k, [(0.3, c), (0.7, c2)], n, scale=18, rough=0.85, bump=0.35, seed=81.0 + k)
            for k, (c, c2) in enumerate([('#665a60', '#72666c'), ('#6e6268', '#7a6e74'), ('#605458', '#6c6064')])]
    rnd = random.Random(81)
    for c in range(n * 4):
        off = 0.25 if c % 2 else 0.0
        for r in range(n * 2):
            y = r * 0.5 + off
            ctx.box(c * 0.25 + 0.012, y + 0.012, 0, 0.226, 0.476, 0.03, pick(rnd, mats), bevel=0.01)
    # the half-pavers that cross the patch edge at y=0 (offset columns)
    for c in range(1, n * 4, 2):
        ctx.box(c * 0.25 + 0.012, -0.25 + 0.012, 0, 0.226, 0.476, 0.03, pick(rnd, mats), bevel=0.01)

def _pitch(ctx, n):
    a = floor_mat(ctx, 'pi_a', [(0.2, '#285e24'), (0.5, '#2f6a2a'), (0.85, '#3a7432')], n, scale=60, rough=0.9, bump=0.5, detail=8, seed=91.0)
    b = floor_mat(ctx, 'pi_b', [(0.2, '#326e2c'), (0.5, '#3a7a34'), (0.85, '#468440')], n, scale=60, rough=0.9, bump=0.5, detail=8, seed=91.0)
    for k in range(0, n, 2):
        ctx.box(0, k, 0, n, 2, 0.0005, a if (k // 2) % 2 == 0 else b)

def f_pitch(ctx, n): _pitch(ctx, n)

def f_pitchLineY(ctx, n):
    _pitch(ctx, n)
    w = floor_mat(ctx, 'pi_line', [(0.3, '#d8dcd0'), (0.7, '#f0f2ea')], n, scale=40, rough=0.8, bump=0.2, seed=92.0)
    for i in range(n): ctx.box(i + 0.435, 0, 0, 0.13, n, 0.003, w)

PIECES += [
    dict(kind='floor', id='awayend_terrace', n=4, build=f_terrace),
    dict(kind='floor', id='awayend_aisle', n=4, build=f_aisle),
    dict(kind='floor', id='awayend_concourse', n=4, build=f_concourse),
    dict(kind='floor', id='awayend_stairs', n=2, build=f_stairs),
    dict(kind='floor', id='awayend_stairsY', n=2, build=f_stairsY),
    dict(kind='floor', id='awayend_grate', n=2, build=f_grate),
    dict(kind='floor', id='awayend_wettiles', n=4, build=f_wettiles),
    dict(kind='floor', id='awayend_corridor', n=4, build=f_corridor),
    dict(kind='floor', id='awayend_corridorLine', n=4, build=f_corridorLine),
    dict(kind='floor', id='awayend_track', n=6, build=f_track),
    dict(kind='floor', id='awayend_moat', n=4, build=f_moat),
    dict(kind='floor', id='awayend_forecourt', n=4, build=f_forecourt),
    dict(kind='floor', id='pitch', n=4, build=f_pitch),
    dict(kind='floor', id='pitchLineY', n=4, build=f_pitchLineY),
]

# ================================================================== PROPS
ZB = 1.0     # wall-decal props are modelled with their z origin at ZB; the theme overlay shifts them by (o.z - ZB)

def _steel(ctx): return M(ctx, '#9aa0a8', 0.35, 0.85)

def p_turnstile(ctx, var):
    """walk-through turnstile cabinet (static body; the rotor arms are drawn by the theme overlay)"""
    body = M(ctx, '#7a7e86', 0.35, 0.8); dark = M(ctx, '#3e4248', 0.5, 0.6)
    ctx.box(0.0, 0.12, 0, 0.3, 0.76, 0.06, M(ctx, '#2a2c30', 0.6, 0.5))
    ctx.box(0.02, 0.15, 0.06, 0.26, 0.7, 0.92, body, bevel=0.015)
    ctx.box(0.0, 0.13, 0.98, 0.3, 0.74, 0.07, dark, bevel=0.01)
    # recessed panel + ticket slot + reader on the lane side (+x)
    ctx.box(0.28, 0.25, 0.2, 0.012, 0.5, 0.55, M(ctx, '#5a5e66', 0.4, 0.7))
    ctx.box(0.285, 0.55, 0.78, 0.02, 0.18, 0.12, M(ctx, '#1a1a1e', 0.4))
    ctx.box(0.29, 0.58, 0.81, 0.02, 0.12, 0.06, E(ctx, '#3aff6a', 2.5))
    ctx.box(0.285, 0.25, 0.8, 0.02, 0.2, 0.03, M(ctx, '#0a0a0c', 0.5))
    # rotor hub housing
    beam(ctx, (0.28, 0.5, 0.85), (0.36, 0.5, 0.85), 0.07, dark, 14)
    beam(ctx, (0.36, 0.5, 0.85), (0.38, 0.5, 0.85), 0.05, _steel(ctx), 14)
    # status lamp on top
    ctx.box(0.1, 0.42, 1.05, 0.1, 0.16, 0.06, M(ctx, '#1a1a1e', 0.5))
    ctx.box(0.11, 0.45, 1.1, 0.08, 0.1, 0.04, E(ctx, '#3aff6a', 4.0))
    # grab rail on the other side of the lane
    rail = _steel(ctx)
    for y in (0.18, 0.82): ctx.cyl(0.95, y, 0, 0.022, 0.95, rail, 10)
    beam(ctx, (0.95, 0.18, 0.95), (0.95, 0.82, 0.95), 0.022, rail, 10)

def p_burgervan(ctx, var):
    cream = M(ctx, '#f0ead8', 0.5, 0.1); creamd = M(ctx, '#d8d0bc', 0.5)
    red = M(ctx, RED, 0.4); tyre = M(ctx, '#0c0c0e', 0.85); rim = M(ctx, '#8a8a90', 0.3, 0.8)
    for x in (0.4, 1.5):
        for y in (0.12, 0.88):
            beam(ctx, (x, y - 0.05, 0.17), (x, y + 0.05, 0.17), 0.17, tyre, 16)
        beam(ctx, (x, 0.93, 0.17), (x, 0.94, 0.17), 0.09, rim, 12)
    ctx.box(0.1, 0.15, 0.15, 1.8, 0.7, 0.12, M(ctx, '#1a1a1e', 0.6))
    ctx.box(0.04, 0.1, 0.24, 1.92, 0.8, 1.46, cream, bevel=0.06)
    ctx.box(0.03, 0.09, 0.62, 1.94, 0.82, 0.14, red, bevel=0.02)                 # red stripe
    ctx.box(0.03, 0.09, 0.79, 1.94, 0.82, 0.03, M(ctx, '#f8f4e8', 0.4), bevel=0.01)
    ctx.box(0.08, 0.14, 1.7, 1.84, 0.72, 0.04, creamd, bevel=0.02)               # roof
    # cab end (+x): windscreen + lights
    ctx.box(1.93, 0.18, 0.95, 0.03, 0.64, 0.45, M(ctx, '#2a3a4a', 0.08, 0.3))
    for y in (0.2, 0.7): ctx.box(1.95, y, 0.4, 0.03, 0.1, 0.1, E(ctx, '#fff4c8', 2.0))
    ctx.box(1.95, 0.15, 0.24, 0.04, 0.7, 0.08, M(ctx, '#c8c8d0', 0.2, 0.9))
    # serving hatch on +y: dark frame, warm interior, the cook, counter shelf
    hf = M(ctx, '#1a1a1e', 0.6)
    for (x0, w0) in ((0.47, 0.05), (1.48, 0.05)): ctx.box(x0, 0.88, 0.82, w0, 0.05, 0.66, hf)
    ctx.box(0.47, 0.88, 1.44, 1.06, 0.05, 0.05, hf)
    ctx.box(0.55, 0.6, 0.88, 0.9, 0.3, 0.54, E(ctx, '#f0b860', 1.0, '#c08040'))
    ctx.box(0.6, 0.62, 0.9, 0.3, 0.04, 0.2, M(ctx, '#c8ccd4', 0.25, 0.8))      # griddle hood
    # cook: white coat, head, paper hat
    ctx.box(0.92, 0.66, 0.9, 0.2, 0.14, 0.3, M(ctx, '#f4f4f0', 0.6), bevel=0.02)
    ctx.sphere(1.02, 0.73, 1.29, 0.07, M(ctx, '#e2a97a', 0.7))
    ctx.box(0.96, 0.68, 1.34, 0.12, 0.1, 0.06, M(ctx, '#f4f4f0', 0.6))
    ctx.box(0.5, 0.88, 0.82, 1.0, 0.18, 0.04, _steel(ctx), bevel=0.008)           # counter shelf
    for i, c in enumerate(('#d02020', '#e8c020', '#5a3010')):
        ctx.cyl(0.66 + i * 0.07, 0.98, 0.86, 0.022, 0.13, M(ctx, c, 0.3), 8)
    ctx.cyl(1.25, 0.97, 0.86, 0.06, 0.05, M(ctx, '#e8dcc0', 0.6), 10)             # napkins
    # hatch flap awning propped open
    slab(ctx, [(0.5, 0.9, 1.5), (1.5, 0.9, 1.5), (1.5, 1.25, 1.62), (0.5, 1.25, 1.62)], stripes_mat(ctx, 'bv_awn', '#d8d0b8', RED, 0.2, 0.5, 'x'), 0.03)
    for x in (0.55, 1.45): beam(ctx, (x, 0.92, 1.1), (x, 1.22, 1.6), 0.01, _steel(ctx), 6)
    # roof sign box (lettering drawn by the theme overlay)
    ctx.box(0.12, 0.4, 1.74, 1.76, 0.12, 0.4, M(ctx, '#1a1a20', 0.5, 0.2), bevel=0.01)
    ctx.box(0.15, 0.52, 1.77, 1.7, 0.01, 0.34, E(ctx, '#2a2420', 0.4, '#141418'))
    # gas bottles + flue
    for y in (0.2, 0.32): ctx.cyl(1.82, y, 1.74, 0.05, 0.3, M(ctx, '#d84020', 0.4, 0.2), 12)
    ctx.cyl(0.3, 0.3, 1.74, 0.04, 0.35, M(ctx, '#5a5a60', 0.4, 0.7), 10)
    # grime + drip tray
    ctx.box(0.6, 0.9, 0.24, 0.8, 0.02, 0.25, M(ctx, '#b8ae96', 0.8))

def p_kiosk(ctx, var):
    green = M(ctx, '#2a5a3a', 0.6); greend = M(ctx, '#1e4029', 0.6)
    ctx.box(0.1, 0.1, 0, 0.8, 0.8, 0.12, M(ctx, '#2a2a2e', 0.8))
    ctx.box(0.1, 0.1, 0.1, 0.8, 0.8, 1.06, green, bevel=0.015)
    # vertical boarding grooves
    for i in range(1, 8):
        ctx.box(0.1 + i * 0.1, 0.895, 0.12, 0.008, 0.01, 1.02, greend)
        ctx.box(0.895, 0.1 + i * 0.1, 0.12, 0.01, 0.008, 1.02, greend)
    ctx.box(0.06, 0.06, 1.16, 0.88, 0.88, 0.06, M(ctx, '#3a3a40', 0.7), bevel=0.01)   # flat roof (jumpable)
    ctx.box(0.1, 0.1, 1.22, 0.8, 0.8, 0.01, M(ctx, '#2e2e34', 0.9))
    # display window with programme covers
    ctx.box(0.17, 0.89, 0.44, 0.66, 0.03, 0.58, M(ctx, '#141418', 0.6))
    ctx.box(0.2, 0.9, 0.47, 0.6, 0.03, 0.5, E(ctx, '#e8e4d4', 0.5, '#d8d4c4'))
    for i in range(3):
        c = RED if i == 1 else BLUE
        ctx.box(0.24 + i * 0.19, 0.925, 0.55, 0.14, 0.012, 0.36, M(ctx, c, 0.5), bevel=0.003)
        ctx.box(0.25 + i * 0.19, 0.935, 0.78, 0.12, 0.006, 0.06, M(ctx, '#f2f2f2', 0.5))
        ctx.box(0.28 + i * 0.19, 0.935, 0.6, 0.06, 0.006, 0.12, M(ctx, '#e8d27a', 0.5))
    ctx.box(0.17, 0.88, 0.4, 0.66, 0.1, 0.04, M(ctx, '#5a3a20', 0.7))            # sill / coin ledge
    # price panel on +x (text by overlay)
    ctx.box(0.9, 0.18, 0.2, 0.012, 0.64, 0.2, M(ctx, '#e8d8a0', 0.6))
    # striped awning sloping out over the window
    slab(ctx, [(0.1, 0.9, 1.15), (0.9, 0.9, 1.15), (0.9, 1.1, 1.0), (0.1, 1.1, 1.0)], stripes_mat(ctx, 'ki_awn', BLUE, '#f0f0e8', 0.2, 0.5, 'x'), 0.025)
    for i in range(8):
        ctx.box(0.1 + i * 0.1, 1.08, 0.94, 0.1, 0.02, 0.06, M(ctx, BLUE if i % 2 == 0 else '#f0f0e8', 0.6))

def _counter_body(ctx):
    st = _steel(ctx)
    ctx.box(0.02, 0.2, 0, 0.96, 0.6, 0.05, M(ctx, '#2a2c30', 0.6, 0.4))
    ctx.box(0.02, 0.2, 0.05, 0.96, 0.6, 0.94, stripes_mat(ctx, 'ct_front', '#8a9098', '#a0a6ae', 0.16, 0.85, 'u', rough=0.35, metal=0.8))
    ctx.box(0.0, 0.18, 0.99, 1.0, 0.64, 0.06, M(ctx, '#c0c6ce', 0.25, 0.9), bevel=0.01)
    ctx.box(0.1, 0.8, 0.82, 0.8, 0.06, 0.03, st)       # tray rail
    for i in range(2): ctx.box(0.18 + i * 0.4, 0.795, 0.3, 0.22, 0.01, 0.35, M(ctx, '#7a8088', 0.4, 0.8))  # cupboard doors
    ctx.box(0.2, 0.25, 1.05, 0.25, 0.18, 0.01, M(ctx, '#e8e4dc', 0.7))  # napkins

def p_counter(ctx, var):
    _counter_body(ctx)
    part = var.get('part')
    if part == 'urn':
        urn = M(ctx, '#c8ccd4', 0.15, 0.95)
        ctx.cyl(0.35, 0.5, 1.05, 0.15, 0.06, M(ctx, '#2a2a2e', 0.5), 16)
        ctx.cyl(0.35, 0.5, 1.1, 0.13, 0.5, urn, 20)
        ctx.cyl(0.35, 0.5, 1.6, 0.13, 0.08, urn, 20, r2=0.08)
        ctx.cyl(0.35, 0.5, 1.68, 0.03, 0.05, M(ctx, '#1a1a1a', 0.5), 8)
        ctx.box(0.47, 0.47, 1.18, 0.08, 0.06, 0.04, M(ctx, '#1a1a1a', 0.5))           # tap
        ctx.cyl(0.6, 0.5, 1.05, 0.04, 0.09, M(ctx, '#f0ece0', 0.6), 10, r2=0.045)       # cups
        ctx.cyl(0.7, 0.42, 1.05, 0.04, 0.09, M(ctx, '#f0ece0', 0.6), 10, r2=0.045)
        ctx.cyl(0.7, 0.42, 1.13, 0.035, 0.01, M(ctx, '#6a3a1a', 0.3), 10)
    elif part == 'warmer':
        glass = alpha_mat(ctx, 'ct_glass', '#c8e0e8', 0.35, emit='#ffe0a0', es=0.3)
        ctx.box(0.2, 0.3, 1.05, 0.6, 0.4, 0.04, M(ctx, '#3a3a40', 0.4, 0.6))
        pie = M(ctx, '#c8862e', 0.6); crust = M(ctx, '#e8b45a', 0.6)
        for i in range(3):
            for j in range(2):
                ctx.cyl(0.3 + i * 0.18, 0.4 + j * 0.18, 1.09, 0.06, 0.06, pie, 12, r2=0.05)
                ctx.cyl(0.3 + i * 0.18, 0.4 + j * 0.18, 1.15, 0.05, 0.01, crust, 12)
        ctx.box(0.2, 0.3, 1.09, 0.6, 0.4, 0.28, glass)
        ctx.box(0.18, 0.28, 1.37, 0.64, 0.44, 0.04, M(ctx, '#3a3a40', 0.4, 0.6))
        ctx.box(0.25, 0.45, 1.36, 0.5, 0.1, 0.01, E(ctx, '#ffb060', 3.0))

def p_crushbarrier(ctx, var):
    col = var.get('color', '#2a4c8e')
    paint = M(ctx, col, 0.45, 0.4); chip = M(ctx, '#d8d8d0', 0.6); rust = M(ctx, '#8a4a28', 0.85)
    alongY = var.get('dir') != 'x'
    def P(a, z, off=0.0): return (0.5 + off, a, z) if alongY else (a, 0.5 + off, z)
    for a in (0.15, 0.85):
        beam(ctx, P(a, 0.0), P(a, 0.95), 0.035, paint, 12)
        bx, by = (0.38, a - 0.12) if alongY else (a - 0.12, 0.38)
        ctx.box(bx, by, 0, 0.24, 0.24, 0.03, M(ctx, '#3a3a40', 0.6, 0.6))
        beam(ctx, P(a, 0.25), P(a, 0.95), 0.036, paint, 12)
        # diagonal stay
        beam(ctx, P(a, 0.0, -0.32), P(a, 0.7), 0.02, paint, 8)
    beam(ctx, P(-0.03, 0.95), P(1.03, 0.95), 0.05, paint, 16)
    beam(ctx, P(-0.03, 0.965), P(1.03, 0.965), 0.04, M(ctx, '#4a6cae', 0.4, 0.4), 16)
    rnd = random.Random(7)
    for i in range(6):   # chipped paint / rust patches
        a = 0.05 + rnd.random() * 0.9
        beam(ctx, P(a, 0.95), P(a + 0.04, 0.95), 0.0505, rust if i % 2 else chip, 16)

def p_tv(ctx, var):
    """CRT telly on a bracket (screen picture animated by the overlay). Modelled at z origin ZB."""
    side = var.get('side')
    if not side: return
    case = M(ctx, '#2a2a30', 0.45, 0.2); br = M(ctx, '#1a1a1e', 0.5, 0.6)
    scr = E(ctx, '#2e6a2a', 1.4, '#1a3a1a')
    z0, z1 = ZB + 0.05, ZB + 0.5
    if side == 'left':
        ctx.box(0.2, 1.0, z0, 0.75, 0.28, z1 - z0, case, bevel=0.03)
        ctx.box(0.3, 0.92, z0 + 0.06, 0.55, 0.1, z1 - z0 - 0.12, case, bevel=0.03)     # tube back
        ctx.box(0.26, 1.27, z0 + 0.06, 0.63, 0.015, z1 - z0 - 0.12, scr)
        ctx.box(0.78, 1.275, z0 + 0.03, 0.12, 0.01, 0.02, E(ctx, '#ff3020', 2.0))
        beam(ctx, (0.575, 0.75, ZB + 0.68), (0.575, 1.12, ZB + 0.68), 0.02, br, 8, True)
        beam(ctx, (0.575, 1.12, ZB + 0.68), (0.575, 1.12, z1), 0.02, br, 8, True)
        ctx.box(0.5, 0.7, ZB + 0.6, 0.15, 0.05, 0.16, br)
    else:
        ctx.box(1.0, 0.05, z0, 0.28, 0.75, z1 - z0, case, bevel=0.03)
        ctx.box(0.92, 0.15, z0 + 0.06, 0.1, 0.55, z1 - z0 - 0.12, case, bevel=0.03)
        ctx.box(1.27, 0.11, z0 + 0.06, 0.015, 0.63, z1 - z0 - 0.12, scr)
        ctx.box(1.275, 0.1, z0 + 0.03, 0.01, 0.12, 0.02, E(ctx, '#ff3020', 2.0))
        beam(ctx, (0.75, 0.425, ZB + 0.68), (1.12, 0.425, ZB + 0.68), 0.02, br, 8, True)
        beam(ctx, (1.12, 0.425, ZB + 0.68), (1.12, 0.425, z1), 0.02, br, 8, True)
        ctx.box(0.7, 0.35, ZB + 0.6, 0.05, 0.15, 0.16, br)

def p_cctv(ctx, var):
    side = var.get('side')
    if not side: return
    body = M(ctx, '#d8d8d0', 0.4, 0.1); dark = M(ctx, '#2a2a30', 0.5, 0.5); glass = M(ctx, '#101820', 0.05, 0.5)
    z = ZB + 0.3
    if side == 'left':
        ctx.box(0.55, 0.98, z - 0.25, 0.1, 0.04, 0.25, dark)                          # wall plate
        beam(ctx, (0.6, 1.0, z - 0.12), (0.6, 1.14, z - 0.12), 0.015, dark, 8)
        beam(ctx, (0.62, 1.14, z - 0.2), (0.32, 1.22, z - 0.3), 0.07, body, 14, True)     # housing angled down-left
        slab(ctx, [(0.66, 1.06, z - 0.12), (0.26, 1.16, z - 0.24), (0.26, 1.3, z - 0.24), (0.66, 1.2, z - 0.12)], body, 0.01)  # sun hood
        beam(ctx, (0.33, 1.22, z - 0.3), (0.3, 1.23, z - 0.31), 0.05, glass, 12)
    else:
        ctx.box(0.98, 0.35, z - 0.25, 0.04, 0.1, 0.25, dark)
        beam(ctx, (1.0, 0.4, z - 0.12), (1.14, 0.4, z - 0.12), 0.015, dark, 8)
        beam(ctx, (1.14, 0.38, z - 0.2), (1.22, 0.68, z - 0.3), 0.07, body, 14, True)
        slab(ctx, [(1.06, 0.34, z - 0.12), (1.16, 0.74, z - 0.24), (1.3, 0.74, z - 0.24), (1.2, 0.34, z - 0.12)], body, 0.01)
        beam(ctx, (1.22, 0.67, z - 0.3), (1.23, 0.7, z - 0.31), 0.05, glass, 12)

def p_walllamp(ctx, var):
    side = var.get('side')
    if not side: return
    on = var.get('lit', 1)
    base = M(ctx, '#1a1c20', 0.5, 0.5); cage = M(ctx, '#3a3e46', 0.4, 0.8)
    glow = E(ctx, '#f4fbff', 5.0, '#d8e8f0') if on else M(ctx, '#6a7078', 0.3)
    z0, z1 = ZB - 0.2, ZB
    if side == 'left':
        ctx.box(0.25, 1.0, z0, 0.56, 0.05, z1 - z0, base, bevel=0.01)
        ctx.box(0.29, 1.04, z0 + 0.03, 0.48, 0.06, z1 - z0 - 0.06, glow, bevel=0.02)
        for i in range(5): ctx.box(0.3 + i * 0.11, 1.095, z0 + 0.02, 0.012, 0.012, z1 - z0 - 0.04, cage)
        ctx.box(0.28, 1.095, (z0 + z1) / 2 - 0.006, 0.5, 0.012, 0.012, cage)
    else:
        ctx.box(1.0, 0.19, z0, 0.05, 0.56, z1 - z0, base, bevel=0.01)
        ctx.box(1.04, 0.23, z0 + 0.03, 0.06, 0.48, z1 - z0 - 0.06, glow, bevel=0.02)
        for i in range(5): ctx.box(1.095, 0.24 + i * 0.11, z0 + 0.02, 0.012, 0.012, z1 - z0 - 0.04, cage)
        ctx.box(1.095, 0.22, (z0 + z1) / 2 - 0.006, 0.012, 0.5, 0.012, cage)

def p_vending(ctx, var):
    red = M(ctx, '#b01828', 0.35, 0.1); redd = M(ctx, '#7a1020', 0.4)
    ctx.box(0.1, 0.18, 0, 0.8, 0.64, 0.08, M(ctx, '#1a1a1e', 0.6))
    ctx.box(0.1, 0.18, 0.06, 0.8, 0.64, 1.74, red, bevel=0.03)
    ctx.box(0.12, 0.2, 1.78, 0.76, 0.6, 0.03, M(ctx, '#3a3a44', 0.5))
    # glazed front with shelves of cans
    ctx.box(0.15, 0.8, 0.52, 0.5, 0.03, 1.18, M(ctx, '#141418', 0.5))
    ctx.box(0.17, 0.81, 0.55, 0.46, 0.02, 1.12, E(ctx, '#bfe0f0', 0.6, '#9ac8e0'))
    cols = ['#2a62d8', '#c8102e', '#f0c020', '#3aa040']
    for r in range(4):
        ctx.box(0.17, 0.66, 0.62 + r * 0.26, 0.46, 0.15, 0.015, M(ctx, '#c8ccd4', 0.3, 0.8))
        for c in range(4):
            ctx.cyl(0.22 + c * 0.11, 0.76, 0.635 + r * 0.26, 0.035, 0.16, M(ctx, cols[(r + c) % 4], 0.25, 0.4), 10)
    glass = alpha_mat(ctx, 'vd_glass', '#d8f0ff', 0.25)
    ctx.box(0.17, 0.83, 0.55, 0.46, 0.008, 1.12, glass)
    # control column: button grid, coin slot, LED (blink by overlay)
    ctx.box(0.67, 0.81, 0.9, 0.18, 0.02, 0.6, M(ctx, '#202024', 0.5))
    for r in range(4):
        for c in range(2):
            ctx.box(0.7 + c * 0.07, 0.825, 1.05 + r * 0.08, 0.05, 0.01, 0.05, M(ctx, '#c8ccd4', 0.3, 0.7))
    ctx.box(0.72, 0.825, 0.95, 0.08, 0.012, 0.06, M(ctx, '#8a8e96', 0.3, 0.9))
    # dispensing tray + header panel
    ctx.box(0.2, 0.8, 0.15, 0.6, 0.03, 0.25, M(ctx, '#0e0e12', 0.5))
    ctx.box(0.22, 0.79, 0.17, 0.56, 0.035, 0.2, M(ctx, '#2a2a30', 0.5, 0.5))
    ctx.box(0.12, 0.81, 1.62, 0.76, 0.02, 0.14, E(ctx, '#ffffff', 0.8, '#e8e8e8'))
    for i in range(4): ctx.box(0.2 + i * 0.15, 0.825, 1.65, 0.1, 0.006, 0.08, M(ctx, RED if i % 2 else BLUE, 0.4))
    ctx.box(0.9, 0.25, 0.3, 0.008, 0.5, 1.3, redd)

def p_urinal(ctx, var):
    tile = M(ctx, '#c8ccd0', 0.3, 0.2)
    st = M(ctx, '#b8bcc0', 0.2, 0.9)
    ctx.box(0.0, 0.0, 0, 0.12, 1.0, 1.5, M(ctx, '#a8acb0', 0.25, 0.85))                  # back splash
    ctx.box(0.12, 0.02, 0.35, 0.36, 0.96, 0.05, st)                                          # trough floor
    ctx.box(0.44, 0.02, 0.35, 0.04, 0.96, 0.22, st, bevel=0.01)                              # front lip
    for y in (0.02, 0.94): ctx.box(0.12, y, 0.35, 0.36, 0.04, 0.22, st)
    ctx.box(0.12, 0.06, 0.4, 0.32, 0.88, 0.01, M(ctx, '#3a4a52', 0.05, 0.3))                 # wet bottom
    ctx.sphere(0.25, 0.5, 0.42, 0.05, M(ctx, '#e8e0a0', 0.6), 1, 1.4, 0.5)                   # the lemon
    for y in (0.2, 0.8): ctx.box(0.2, y, 0.0, 0.04, 0.04, 0.35, st)                           # legs
    beam(ctx, (0.08, 0.5, 1.45), (0.08, 0.5, 0.6), 0.025, M(ctx, '#b87333', 0.3, 0.9), 10)   # flush pipe
    beam(ctx, (0.08, 0.1, 1.2), (0.08, 0.9, 1.2), 0.02, M(ctx, '#b87333', 0.3, 0.9), 10)
    ctx.box(0.12, 0.3, 0.0, 0.3, 0.4, 0.003, M(ctx, '#8a8a6a', 0.1))                          # puddle

def p_sink(ctx, var):
    porc = M(ctx, '#e8eae6', 0.2); st = M(ctx, '#9aa0a8', 0.25, 0.9)
    # mirror on the wall behind (plane y = 0.02), cracked
    ctx.box(0.25, 0.0, 1.45, 0.56, 0.03, 0.6, M(ctx, '#2a2c30', 0.5, 0.5))
    ctx.box(0.28, 0.02, 1.48, 0.5, 0.015, 0.54, M(ctx, '#a8c0cc', 0.03, 0.9))
    beam(ctx, (0.35, 0.04, 2.0), (0.6, 0.04, 1.55), 0.004, M(ctx, '#3a4a52', 0.5), 4)
    beam(ctx, (0.5, 0.04, 1.78), (0.72, 0.04, 1.85), 0.004, M(ctx, '#3a4a52', 0.5), 4)
    # pedestal + basin
    ctx.cyl(0.5, 0.25, 0, 0.08, 0.7, porc, 14, r2=0.06)
    ctx.box(0.2, 0.05, 0.7, 0.6, 0.45, 0.18, porc, bevel=0.04)
    ctx.box(0.27, 0.12, 0.84, 0.46, 0.3, 0.05, M(ctx, '#b8c0c4', 0.1, 0.3))
    ctx.cyl(0.5, 0.12, 0.88, 0.02, 0.12, st, 8)
    beam(ctx, (0.5, 0.12, 1.0), (0.5, 0.22, 0.97), 0.015, st, 8)
    for x in (0.35, 0.65): ctx.cyl(x, 0.1, 0.88, 0.025, 0.05, st, 8)
    ctx.box(0.42, 0.1, 0.88, 0.16, 0.04, 0.01, M(ctx, '#7a5a3a', 0.5))                     # soap stub

def p_cubicle(ctx, var):
    wood = wall_mat(ctx, 'cb_wood', '#6a4a2c', '#7a5a3a', scale=4, bump=0.2, streak=0.4, seed=12, rough=0.6)
    ctx.box(0.05, 0.05, 0.1, 0.9, 0.9, 2.0, wood)
    for (x, y) in ((0.05, 0.9), (0.9, 0.05), (0.9, 0.9)): ctx.box(x, y, 0, 0.05, 0.05, 0.12, _steel(ctx))
    ctx.box(0.03, 0.03, 2.1, 0.94, 0.94, 0.04, M(ctx, '#4a4038', 0.7))
    # door on +y with hinges, lock indicator, kick plate, scrawl
    ctx.box(0.2, 0.94, 0.15, 0.6, 0.02, 1.75, M(ctx, '#8a6a46', 0.55))
    ctx.box(0.2, 0.955, 0.18, 0.6, 0.01, 0.18, M(ctx, '#9aa0a8', 0.3, 0.8))
    ctx.box(0.68, 0.955, 1.0, 0.06, 0.03, 0.04, M(ctx, '#c8c8c0', 0.3, 0.8))
    ctx.box(0.45, 0.955, 1.55, 0.1, 0.012, 0.05, E(ctx, '#30c050', 2.0))
    for z in (0.4, 1.6): ctx.box(0.19, 0.955, z, 0.04, 0.02, 0.08, M(ctx, '#3a3a40', 0.4, 0.7))
    ink = M(ctx, '#202020', 0.9)
    rnd = random.Random(3)
    for i in range(5):
        x = 0.3 + i * 0.07
        beam(ctx, (x, 0.962, 1.2 + rnd.random() * 0.1), (x + 0.05, 0.962, 1.2 + rnd.random() * 0.1), 0.006, ink, 4)
    ctx.box(0.05, 0.05, 0.1, 0.012, 0.9, 2.0, M(ctx, '#5a4228', 0.6))

def p_boiler(ctx, var):
    rust = wall_mat(ctx, 'bo_body', '#6a3a2e', '#8a4a36', scale=8, bump=0.6, streak=1.0, seed=13, rough=0.7)
    ctx.box(0.08, 0.08, 0, 0.84, 0.84, 0.12, M(ctx, '#2a2a2e', 0.7))
    ctx.box(0.1, 0.1, 0.1, 0.8, 0.8, 1.8, rust, bevel=0.03)
    for z in (0.5, 1.2): ctx.box(0.09, 0.09, z, 0.82, 0.82, 0.04, M(ctx, '#3a2420', 0.6, 0.4))
    ctx.box(0.12, 0.12, 1.88, 0.76, 0.76, 0.06, M(ctx, '#5a3a30', 0.6, 0.3))
    # gauge (needle by overlay), pilot window, valves, pipes, flue
    beam(ctx, (0.35, 0.9, 1.5), (0.35, 0.94, 1.5), 0.08, M(ctx, '#b89a50', 0.3, 0.9), 16)
    beam(ctx, (0.35, 0.94, 1.5), (0.35, 0.95, 1.5), 0.065, M(ctx, '#e8e4d8', 0.5), 16)
    ctx.box(0.52, 0.9, 0.25, 0.18, 0.02, 0.18, M(ctx, '#141418', 0.5))
    ctx.box(0.55, 0.91, 0.28, 0.12, 0.02, 0.12, E(ctx, '#4a8aff', 2.0, '#2a4a8a'))
    pipe = M(ctx, '#b87333', 0.35, 0.9)
    beam(ctx, (0.9, 0.3, 0.8), (1.0, 0.3, 0.8), 0.04, pipe, 10)
    beam(ctx, (0.9, 0.6, 0.3), (1.0, 0.6, 0.3), 0.04, pipe, 10)
    ctx.cyl(0.95, 0.3, 0.0, 0.04, 0.8, pipe, 10); ctx.cyl(0.95, 0.6, 0.0, 0.04, 0.3, pipe, 10)
    beam(ctx, (0.7, 0.9, 1.0), (0.7, 1.0, 1.0), 0.05, M(ctx, '#c02020', 0.4, 0.4), 12)     # red valve wheel
    flue = M(ctx, '#8a6a4a', 0.5, 0.6)
    ctx.cyl(0.5, 0.5, 1.94, 0.1, 1.3, flue, 14)
    for z in (2.3, 2.8): ctx.cyl(0.5, 0.5, z, 0.11, 0.04, M(ctx, '#5a4a3a', 0.5, 0.6), 14)
    ctx.box(0.2, 0.9, 0.7, 0.2, 0.012, 0.14, M(ctx, '#e8e0a0', 0.8))                       # inspection tag

def p_floodlight(ctx, var):
    H = var.get('height')
    if not H: return
    steel = M(ctx, '#8a8e96', 0.4, 0.8); dark = M(ctx, '#4a4e56', 0.45, 0.7)
    ctx.box(0.15, 0.15, 0, 0.7, 0.7, 0.25, wall_mat(ctx, 'fl_base', '#6a6a70', '#7a7a80', scale=10, seed=14), bevel=0.02)
    r0, r1 = 0.28, 0.08
    def leg(k, sx, sy):
        r = r0 + (r1 - r0) * k
        return (0.5 + sx * r, 0.5 + sy * r, 0.25 + (H - 0.25) * k)
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for sx, sy in corners:
        beam(ctx, leg(0, sx, sy), leg(1, sx, sy), 0.03, steel, 6, True)
    nseg = int(H)
    for i in range(nseg):
        k0, k1 = i / nseg, (i + 1) / nseg
        for c in range(4):
            a, b = corners[c], corners[(c + 1) % 4]
            m = steel if c in (1, 2) else dark
            beam(ctx, leg(k0, *a), leg(k1, *b), 0.012, m, 4, True)
            beam(ctx, leg(k0, *b), leg(k1, *a), 0.012, m, 4, True)
            beam(ctx, leg(k1, *a), leg(k1, *b), 0.012, m, 4, True)
    # ladder up the front
    beam(ctx, leg(0.02, 1, 1), leg(0.95, 1, 1), 0.008, dark, 4)
    # head platform + lamp bank facing the viewer (toward +x+y), tilted down
    top = H
    ctx.box(0.25, 0.25, top - 0.05, 0.5, 0.5, 0.06, dark)
    cx, cy, cz = 0.62, 0.62, top + 0.45
    ux, uy = 0.7071, -0.7071          # along the bank (screen horizontal)
    nx, ny = 0.7071, 0.7071           # facing direction
    W, Hh = 1.4, 0.9 * 1.0
    tilt = 0.25
    def BP(s, t, d=0.0):  # s along width (-0.5..0.5), t up (-0.5..0.5) in units of W/Hh; d along normal
        return (cx + ux * s * W + nx * (d - t * tilt * 0.5), cy + uy * s * W + ny * (d - t * tilt * 0.5), cz + t * Hh)
    frame = M(ctx, '#2a2c32', 0.5, 0.6)
    slab_pts = [BP(-0.5, -0.5), BP(0.5, -0.5), BP(0.5, 0.5), BP(-0.5, 0.5)]
    # back plate as a thick quad: build from two slabs offset along the normal
    bm = bmesh.new()
    vf = [bm.verts.new(ctx.G(*BP(s, t, 0.0))) for (s, t) in ((-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5))]
    vb = [bm.verts.new(ctx.G(*BP(s, t, -0.12))) for (s, t) in ((-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5))]
    bm.faces.new(vf); bm.faces.new(list(reversed(vb)))
    for i in range(4):
        j = (i + 1) % 4; bm.faces.new([vf[i], vb[i], vb[j], vf[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _mk(ctx, bm, frame, 'bank', (0, 0, 0))
    lampm = E(ctx, '#fffbe0', 7.0, '#ffffff'); rim = M(ctx, '#5a5e66', 0.4, 0.8)
    for r in range(3):
        for c in range(5):
            s = -0.4 + c * 0.2; t = -0.3 + r * 0.3
            beam(ctx, BP(s, t, 0.0), BP(s, t, 0.05), 0.085, rim, 14)
            beam(ctx, BP(s, t, 0.05), BP(s, t, 0.055), 0.07, lampm, 14)
    # yoke to the mast
    beam(ctx, (0.5, 0.5, top), BP(0, -0.5, -0.06), 0.03, dark, 8)
    beam(ctx, leg(1, 0, 0), (0.5, 0.5, top + 0.2), 0.04, dark, 8)

def p_dugout(ctx, var):
    navy = M(ctx, '#1f3a7a', 0.5); seat = M(ctx, BLUE, 0.35)
    ctx.box(0.05, 0.05, 0, 1.9, 0.9, 0.04, M(ctx, '#3a3a40', 0.8))
    ctx.box(0.05, 0.05, 0, 1.9, 0.12, 1.4, navy, bevel=0.01)
    for x in (0.4, 0.9, 1.4):     # moulded bucket seats
        ctx.box(x, 0.25, 0.04, 0.36, 0.4, 0.06, M(ctx, '#2a2a30', 0.5, 0.5))
        ctx.box(x, 0.2, 0.4, 0.36, 0.4, 0.06, seat, bevel=0.02)
        ctx.box(x, 0.18, 0.45, 0.36, 0.06, 0.45, seat, bevel=0.02)
        ctx.box(x + 0.15, 0.4, 0.04, 0.06, 0.06, 0.36, M(ctx, '#2a2a30', 0.5, 0.5))
    # perspex roof + sides on a steel frame
    st = M(ctx, '#c8d8e8', 0.3, 0.8)
    for x in (0.06, 1.88): beam(ctx, (x, 0.9, 0.0), (x, 0.9, 1.4), 0.02, st, 8)
    beam(ctx, (0.06, 0.9, 1.4), (1.88, 0.9, 1.4), 0.02, st, 8)
    roof = alpha_mat(ctx, 'dg_roof', '#9ab8d0', 0.55, rough=0.1)
    slab(ctx, [(0.05, 0.05, 1.42), (1.95, 0.05, 1.42), (1.95, 0.95, 1.35), (0.05, 0.95, 1.35)], roof, 0.03)
    side = alpha_mat(ctx, 'dg_side', '#c8e0f0', 0.25, rough=0.05)
    for x in (0.05, 1.93): ctx.box(x, 0.17, 0.04, 0.02, 0.73, 1.33, side)
    ctx.box(0.6, 0.06, 1.0, 0.8, 0.02, 0.25, M(ctx, '#f2f2f2', 0.5))   # club board on the back wall
    ctx.box(0.65, 0.07, 1.05, 0.7, 0.02, 0.15, M(ctx, BLUE, 0.5))
    ctx.box(1.6, 0.3, 0.04, 0.22, 0.18, 0.2, M(ctx, '#e8e4dc', 0.5))   # kit bag / water bottles
    for i in range(3): ctx.cyl(1.2 + i * 0.06, 0.75, 0.04, 0.025, 0.2, M(ctx, '#3ab8ff', 0.2), 8)

def p_amnesty(ctx, var):
    frame = M(ctx, '#3a3a40', 0.45, 0.7); mesh = M(ctx, '#9aa0a8', 0.35, 0.85)
    ctx.box(0.15, 0.15, 0, 0.7, 0.7, 0.06, frame)
    ctx.box(0.15, 0.15, 0.06, 0.7, 0.02, 0.9, M(ctx, '#2a2a30', 0.7))   # back panels
    ctx.box(0.15, 0.15, 0.06, 0.02, 0.7, 0.9, M(ctx, '#1e1e24', 0.7))
    # confiscated haul: bottles, umbrella, a flag, cans
    ctx.cyl(0.35, 0.6, 0.06, 0.035, 0.32, M(ctx, '#3a6a2a', 0.15, 0.2), 10); ctx.cyl(0.35, 0.6, 0.38, 0.015, 0.1, M(ctx, '#3a6a2a', 0.15), 8)
    ctx.cyl(0.6, 0.5, 0.06, 0.035, 0.3, M(ctx, '#5a3010', 0.15, 0.2), 10); ctx.cyl(0.6, 0.5, 0.36, 0.015, 0.1, M(ctx, '#5a3010', 0.15), 8)
    beam(ctx, (0.25, 0.3, 0.1), (0.7, 0.7, 0.85), 0.02, M(ctx, '#1a1a22', 0.5), 8)
    ctx.sphere(0.27, 0.32, 0.12, 0.05, M(ctx, '#8a5a30', 0.6))
    slab(ctx, [(0.4, 0.35, 0.5), (0.7, 0.35, 0.5), (0.7, 0.35, 0.8), (0.4, 0.35, 0.8)], M(ctx, RED, 0.7), 0.01)
    ctx.cyl(0.5, 0.35, 0.06, 0.03, 0.12, M(ctx, YEL, 0.3, 0.6), 10)
    ctx.cyl(0.7, 0.3, 0.06, 0.03, 0.12, M(ctx, '#c8ccd4', 0.3, 0.8), 10)
    # mesh front & side: vertical bars + frame
    for i in range(7):
        a = 0.15 + i * 0.7 / 6
        beam(ctx, (a, 0.85, 0.06), (a, 0.85, 0.95), 0.008, mesh, 6)
        beam(ctx, (0.85, a, 0.06), (0.85, a, 0.95), 0.008, mesh, 6)
    for z in (0.06, 0.5, 0.95):
        beam(ctx, (0.15, 0.85, z), (0.85, 0.85, z), 0.012, frame, 6); beam(ctx, (0.85, 0.15, z), (0.85, 0.85, z), 0.012, frame, 6)
    ctx.box(0.13, 0.13, 0.95, 0.74, 0.74, 0.05, M(ctx, '#9aa0a8', 0.35, 0.8), bevel=0.008)
    ctx.box(0.3, 0.86, 0.4, 0.4, 0.01, 0.2, M(ctx, '#f0e8c0', 0.6))                         # label
    ctx.box(0.33, 0.865, 0.52, 0.34, 0.006, 0.04, M(ctx, RED, 0.6))
    ctx.box(0.75, 0.86, 0.45, 0.06, 0.03, 0.1, M(ctx, '#c8a020', 0.3, 0.9))                 # padlock

def p_hamper(ctx, var):
    wick = wall_mat(ctx, 'hm_wicker', '#9a7440', '#c09a5c', scale=30, bump=0.8, block=('#ffffff', '#e8dcc8'), mortar='#6a5030',
                    bw=0.05, bh=0.04, mortar_size=0.006, rough=0.9, seed=15)
    ctx.box(0.1, 0.12, 0, 0.8, 0.76, 0.78, wick, bevel=0.03)
    ctx.box(0.08, 0.1, 0.76, 0.84, 0.8, 0.09, wall_mat(ctx, 'hm_lid', '#a07a40', '#b88c50', scale=30, bump=0.6, seed=16), bevel=0.03)
    lea = M(ctx, '#4a2a14', 0.6)
    for x in (0.25, 0.75):
        ctx.box(x - 0.03, 0.865, 0.1, 0.06, 0.02, 0.77, lea); ctx.box(x - 0.03, 0.1, 0.85, 0.06, 0.8, 0.025, lea)
    ctx.box(0.88, 0.4, 0.5, 0.03, 0.2, 0.08, M(ctx, '#2a2a2e', 0.5))                        # handle
    ctx.box(0.35, 0.88, 0.3, 0.3, 0.012, 0.25, M(ctx, BLUE, 0.6))                             # kit label
    ctx.box(0.38, 0.89, 0.42, 0.24, 0.006, 0.04, M(ctx, '#f2f2f2', 0.6))
    ctx.box(0.6, 0.3, 0.84, 0.25, 0.25, 0.06, stripes_mat(ctx, 'hm_scarf', BLUE, '#f2f2f2', 0.08, 0.5, 'x'))   # shirt poking out

PIECES += [
    dict(kind='prop', id='awayend_turnstile', size=(1, 1, 1.2), build=p_turnstile),
    dict(kind='prop', id='awayend_burgervan', size=(2, 1, 2.2), build=p_burgervan, pad=12),
    dict(kind='prop', id='awayend_kiosk', size=(1, 1, 1.3), build=p_kiosk, pad=10),
    dict(kind='prop', id='awayend_counter', size=(1, 1, 1.8), build=p_counter, variants=[{}, {'part': 'urn'}, {'part': 'warmer'}]),
    dict(kind='prop', id='awayend_crushbarrier', size=(1, 1, 1.1), build=p_crushbarrier, variants=[{}, {'dir': 'x'}]),
    dict(kind='prop', id='awayend_tv', size=(1, 1, 2.0), build=p_tv, pad=20, variants=[{}, {'side': 'left'}, {'side': 'right'}]),
    dict(kind='prop', id='awayend_cctv', size=(1, 1, 2.0), build=p_cctv, pad=20, variants=[{}, {'side': 'left'}, {'side': 'right'}]),
    dict(kind='prop', id='awayend_walllamp', size=(1, 1, 2.0), build=p_walllamp, pad=16,
         variants=[{}, {'side': 'left', 'lit': 1}, {'side': 'left', 'lit': 0}, {'side': 'right', 'lit': 1}, {'side': 'right', 'lit': 0}]),
    dict(kind='prop', id='awayend_vending', size=(1, 1, 1.9), build=p_vending),
    dict(kind='prop', id='awayend_urinal', size=(1, 1, 1.6), build=p_urinal),
    dict(kind='prop', id='awayend_sink', size=(1, 1, 2.2), build=p_sink),
    dict(kind='prop', id='awayend_cubicle', size=(1, 1, 2.2), build=p_cubicle),
    dict(kind='prop', id='awayend_boiler', size=(1, 1, 3.3), build=p_boiler),
    dict(kind='prop', id='awayend_floodlight', size=(1, 1, 12.6), build=p_floodlight, pad=36,
         variants=[{}, {'height': 9}, {'height': 10}, {'height': 11}]),
    dict(kind='prop', id='awayend_dugout', size=(2, 1, 1.5), build=p_dugout),
    dict(kind='prop', id='awayend_amnesty', size=(1, 1, 1.05), build=p_amnesty),
    dict(kind='prop', id='awayend_hamper', size=(1, 1, 0.95), build=p_hamper),
]
