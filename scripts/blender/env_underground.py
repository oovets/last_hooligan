# THE UNDERGROUND (Level 3, theme 'underground') environment pieces for scripts/blender/render_env.py.
# The Nordhamn Metro: cream glazed tiles with green/red bands, ticket hall barriers & machines, escalators,
# platforms with yellow safety edges, track bed with live rail, tunnels, sooty brick ghost station,
# maintenance tunnels and the signal depot. Cold fluorescent palette. Everything is original (no real brands).
# Game coords: x,y in tiles (1 tile = 1 m), z in height units (ctx.UNIT metres).
# Visible wall faces: +x (screen right) and +y (screen left).
import os, sys, math, random
import bpy, bmesh
from mathutils import Vector, Matrix, Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from env_common import _h, w_railing  # noqa: E402

UNIT = 1.0206


def G(gx, gy, gz=0.0):
    return Vector((gy, gx, gz * UNIT))


def _lin(c):
    if isinstance(c, str): c = _h(c)
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ================================================================== geometry helpers
class Batch:
    """Many boxes merged into one object per (material, bevel) — fast for tiles, bricks, slats."""
    def __init__(self, ctx):
        self.ctx = ctx; self.bms = {}

    def box(self, gx, gy, gz, w, d, h, mat, bevel=0.0):
        k = (mat.name, round(bevel, 5))
        if k not in self.bms: self.bms[k] = [mat, bevel, bmesh.new()]
        bm = self.bms[k][2]
        M = Matrix.Translation(G(gx + w / 2, gy + d / 2, gz + h / 2)) @ Matrix.Diagonal((d, w, max(h * UNIT, 1e-4), 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)

    def done(self):
        for mat, bev, bm in self.bms.values():
            if bev > 0:
                bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bev, segments=2, affect='EDGES', clamp_overlap=True)
            me = bpy.data.meshes.new('batch'); bm.to_mesh(me); bm.free()
            me.materials.append(mat)
            ob = bpy.data.objects.new('batch', me); self.ctx.link(ob)
        self.bms = {}


def _mk(ctx, bm, mat, name, loc=(0, 0, 0), rot=None, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); ctx.link(ob); ob.location = loc
    if rot is not None: ob.rotation_euler = rot
    return ob


def beam(ctx, p0, p1, r, mat, seg=10, square=False, r1=None):
    """bar between two game points (gx, gy, gz units); r = radius / half thickness in metres"""
    a, b = G(*p0), G(*p1)
    d = b - a; L = max(d.length, 1e-4)
    bm = bmesh.new()
    if square:
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts: v.co.x *= 2 * r; v.co.y *= 2 * r; v.co.z *= L
    else:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r1 is None else r1, depth=L)
    return _mk(ctx, bm, mat, 'beam', (a + b) / 2, d.to_track_quat('Z', 'Y').to_euler(), smooth=not square)


def cbox(ctx, cx, cy, z0, w, d, h, mat, rot=0.0, bevel=0.0):
    """box centred on game (cx, cy), z0..z0+h units; w along game x, d along game y, then rotated `rot` degrees
    about the vertical (rot=45 turns its +y face towards the camera: a screen-facing board)"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= d; v.co.y *= w; v.co.z = (v.co.z + 0.5) * h * UNIT
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES', clamp_overlap=True)
    return _mk(ctx, bm, mat, 'cbox', G(cx, cy, z0), Euler((0, 0, math.radians(rot))))


def face_pt(cx, cy, s, a):
    """point on a camera-facing plane through (cx, cy): s = distance towards the camera, a = screen-right offset (m)"""
    k = 1 / math.sqrt(2)
    return (cx + (s + a) * k, cy + (s - a) * k)


def flat(ctx, pts, z, mat, name='flat'):
    """flat n-gon through game (x, y) points at height z (units)"""
    bm = bmesh.new()
    vs = [bm.verts.new(G(x, y, z)) for (x, y) in pts]
    bm.faces.new(vs)
    return _mk(ctx, bm, mat, name)


def prism(ctx, pts, z0, z1, mat, name='prism'):
    """vertical extrusion of a game-xy polygon from z0 to z1 (units)"""
    bm = bmesh.new()
    bot = [bm.verts.new(G(x, y, z0)) for (x, y) in pts]
    top = [bm.verts.new(G(x, y, z1)) for (x, y) in pts]
    bm.faces.new(top); bm.faces.new(list(reversed(bot)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([bot[i], bot[j], top[j], top[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mk(ctx, bm, mat, name)


def quad(ctx, pts, mat, t=0.0, name='quad'):
    """face through game (x, y, z) points, optional thickness t metres along its normal"""
    bm = bmesh.new()
    vs = [bm.verts.new(G(*p)) for p in pts]
    f = bm.faces.new(vs)
    if t > 0:
        bm.normal_update()
        r = bmesh.ops.extrude_face_region(bm, geom=[f])
        nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=-f.normal * t, verts=nv)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mk(ctx, bm, mat, name)


def disc_x(ctx, cx, cy, cz, r, t, mat, seg=24):
    """disc with its axis along game x (centre game point, r metres, t thickness metres)"""
    return beam(ctx, (cx - t / 2, cy, cz), (cx + t / 2, cy, cz), r, mat, seg=seg)


def fbox(ctx, face, a, z, w, h, out, mat, inset=0.0, bevel=0.0, B=None):
    """box on a visible wall face: face 'y' (+y, along x from a) or 'x' (+x, along y from a); sticks out `out` m"""
    t = out + inset
    if face == 'y': args = (a, 1 - inset, z, w, t, h)
    else: args = (1 - inset, a, z, t, w, h)
    if B is not None: B.box(*args, mat, bevel=bevel); return None
    return ctx.box(*args, mat, bevel=bevel)


# ================================================================== material helpers
def M(ctx, c, rough=0.6, metal=0.0, emit=None, es=1.0):
    return ctx.mat('u' + c + str(rough) + str(metal), _h(c), rough, metal, _h(emit) if emit else None, es)


def nm(ctx, key, c1, c2, scale=10, rough=0.85, bump=0.25, detail=6, period=None, metal=0.0):
    m = ctx.noise_mat('u' + key, _h(c1), _h(c2), scale=scale, rough=rough, bump=bump, detail=detail, period=period)
    if metal:
        m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = metal
    return m


def alpha_mat(ctx, key, color, alpha, rough=0.08, emit=None, es=0.4):
    key = 'ua' + key
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


def _math(N, L, op, a, b=None):
    m = N.new('ShaderNodeMath'); m.operation = op
    if isinstance(a, (int, float)): m.inputs[0].default_value = a
    else: L.new(a, m.inputs[0])
    if b is not None:
        if isinstance(b, (int, float)): m.inputs[1].default_value = b
        else: L.new(b, m.inputs[1])
    return m.outputs[0]


def _mix(N, L, fac, a, b, blend='MIX'):
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = blend
    for sock, val in (('Factor', fac), ('A', a), ('B', b)):
        if isinstance(val, (int, float)): mx.inputs[sock].default_value = val
        elif isinstance(val, str): mx.inputs[sock].default_value = (*_lin(val), 1)
        else: L.new(val, mx.inputs[sock])
    return mx.outputs['Result']


def _ramp(N, L, fac, stops, constant=False):
    r = N.new('ShaderNodeValToRGB')
    if constant: r.color_ramp.interpolation = 'CONSTANT'
    els = r.color_ramp.elements
    while len(els) < len(stops): els.new(0.5)
    for e, (pos, col) in zip(els, stops):
        e.position = pos; e.color = (*_lin(col), 1)
    L.new(fac, r.inputs['Fac'])
    return r.outputs['Color']


def pvec(ctx, N, L, sock, period):
    """periodic 4D coords (vector, w) from a position socket, seamless every `period` metres in game x/y"""
    R = period / (2 * math.pi)
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(sock, sep.inputs[0])
    def trig(s, op):
        a = _math(N, L, 'MULTIPLY', s, 2 * math.pi / period)
        return _math(N, L, 'MULTIPLY', _math(N, L, op, a), R)
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(trig(sep.outputs[0], 'COSINE'), comb.inputs[0]); L.new(trig(sep.outputs[0], 'SINE'), comb.inputs[1])
    L.new(trig(sep.outputs[1], 'COSINE'), comb.inputs[2])
    return comb.outputs[0], trig(sep.outputs[1], 'SINE')


def world_pos(N):
    return N.new('ShaderNodeNewGeometry').outputs['Position']


def stone_mat(ctx, key, cols, scale, period, rough=0.85, bump=0.6, gap='#141210', gapw=0.08, oil=None):
    """periodic voronoi stones / chips (ballast, gravel) on world xy"""
    key = 'us' + key
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    v, w = pvec(ctx, N, L, world_pos(N), period)
    vo = N.new('ShaderNodeTexVoronoi'); vo.voronoi_dimensions = '4D'; vo.inputs['Scale'].default_value = scale
    L.new(v, vo.inputs['Vector']); L.new(w, vo.inputs['W'])
    ve = N.new('ShaderNodeTexVoronoi'); ve.voronoi_dimensions = '4D'; ve.feature = 'DISTANCE_TO_EDGE'; ve.inputs['Scale'].default_value = scale
    L.new(v, ve.inputs['Vector']); L.new(w, ve.inputs['W'])
    sepc = N.new('ShaderNodeSeparateColor'); L.new(vo.outputs['Color'], sepc.inputs[0])
    n = len(cols)
    col = _ramp(N, L, sepc.outputs[0], [(i / n, c) for i, c in enumerate(cols)], constant=True)
    edge = _math(N, L, 'LESS_THAN', ve.outputs['Distance'], gapw)
    col = _mix(N, L, edge, col, gap)
    L.new(col, b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    L.new(_math(N, L, 'MINIMUM', ve.outputs['Distance'], 0.3), bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    ctx.mats[key] = m
    return m


def terrazzo_mat(ctx, key, base1, base2, chips, period, scale=34, density=0.42, rough=0.32):
    key = 'ut' + key
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    v, w = pvec(ctx, N, L, world_pos(N), period)
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 4; nz.inputs['Detail'].default_value = 4
    L.new(v, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
    base = _ramp(N, L, nz.outputs['Fac'], [(0.35, base1), (0.65, base2)])
    vo = N.new('ShaderNodeTexVoronoi'); vo.voronoi_dimensions = '4D'; vo.inputs['Scale'].default_value = scale
    L.new(v, vo.inputs['Vector']); L.new(w, vo.inputs['W'])
    sepc = N.new('ShaderNodeSeparateColor'); L.new(vo.outputs['Color'], sepc.inputs[0])
    n = len(chips)
    chip = _ramp(N, L, sepc.outputs[0], [(i / n, c) for i, c in enumerate(chips)], constant=True)
    # chip only where the cell's random G channel says so and inside a shrunken cell
    sel = _math(N, L, 'LESS_THAN', sepc.outputs[1], density)
    inside = _math(N, L, 'LESS_THAN', vo.outputs['Distance'], 0.32)
    fac = _math(N, L, 'MULTIPLY', sel, inside)
    L.new(_mix(N, L, fac, base, chip), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    try: b.inputs['Coat Weight'].default_value = 0.25
    except Exception: pass
    ctx.mats[key] = m
    return m


def brick_wall_mat(ctx, key, c1, c2, mortar, h_units, bw=0.25, bh=0.085, soot=0.0, soot_from=0.35, moss=0.0, seed=0.0,
                   mortar_size=0.012, streaks=0.0):
    """brick on both wall faces (u = x + y, v = z), optional soot gradient towards the top, damp moss, water streaks"""
    key = 'ub' + key
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(co, sep.inputs[0])
    u = _math(N, L, 'ADD', _math(N, L, 'ADD', sep.outputs[0], sep.outputs[1]), seed)
    comb = N.new('ShaderNodeCombineXYZ'); L.new(u, comb.inputs[0]); L.new(sep.outputs[2], comb.inputs[1])
    br = N.new('ShaderNodeTexBrick'); br.offset = 0.5
    br.inputs['Color1'].default_value = (*_lin(c1), 1); br.inputs['Color2'].default_value = (*_lin(c2), 1)
    br.inputs['Mortar'].default_value = (*_lin(mortar), 1)
    br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = mortar_size
    br.inputs['Brick Width'].default_value = bw; br.inputs['Row Height'].default_value = bh
    try: br.inputs['Bias'].default_value = 0.0
    except Exception: pass
    L.new(comb.outputs[0], br.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 16; nz.inputs['Detail'].default_value = 8
    L.new(co, nz.inputs['Vector'])
    col = _mix(N, L, 0.22, br.outputs['Color'], nz.outputs['Color'], 'MULTIPLY')
    if soot > 0:
        H = h_units * UNIT
        mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = H * soot_from; mr.inputs['From Max'].default_value = H
        L.new(sep.outputs[2], mr.inputs['Value'])
        n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 30.0; n2.inputs['Detail'].default_value = 5
        L.new(co, n2.inputs['Vector'])
        f = _math(N, L, 'MULTIPLY', mr.outputs['Result'], _math(N, L, 'ADD', _math(N, L, 'MULTIPLY', n2.outputs['Fac'], 0.5), 0.55))
        f = _math(N, L, 'MINIMUM', _math(N, L, 'MULTIPLY', f, soot), 0.92)
        col = _mix(N, L, f, col, '#0c0908')
    if streaks > 0:
        sc = N.new('ShaderNodeCombineXYZ')
        L.new(_math(N, L, 'MULTIPLY', u, 7.0), sc.inputs[0]); L.new(_math(N, L, 'MULTIPLY', sep.outputs[2], 0.5), sc.inputs[1])
        n3 = N.new('ShaderNodeTexNoise'); n3.inputs['Scale'].default_value = 2.0; n3.inputs['Detail'].default_value = 3
        L.new(sc.outputs[0], n3.inputs['Vector'])
        f3 = _math(N, L, 'MULTIPLY', _math(N, L, 'MAXIMUM', _math(N, L, 'SUBTRACT', n3.outputs['Fac'], 0.55), 0.0), streaks * 3)
        col = _mix(N, L, _math(N, L, 'MINIMUM', f3, 0.7), col, '#14120e')
    if moss > 0:
        n4 = N.new('ShaderNodeTexNoise'); n4.inputs['Scale'].default_value = 9.0; n4.inputs['Detail'].default_value = 6
        L.new(co, n4.inputs['Vector'])
        f4 = _math(N, L, 'GREATER_THAN', n4.outputs['Fac'], 1.0 - moss)
        col = _mix(N, L, _math(N, L, 'MULTIPLY', f4, 0.85), col, '#4e6040')
    L.new(col, b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.45
    L.new(br.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.9
    ctx.mats[key] = m
    return m


def streak_mat(ctx, key, c1, c2, streak='#1e201c', amount=0.6, scale=12, rough=0.88, bump=0.3, metal=0.0):
    """noisy concrete / paint with vertical water streaks (wall faces: u = x + y, v = z)"""
    key = 'uc' + key
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8
    L.new(co, nz.inputs['Vector'])
    col = _ramp(N, L, nz.outputs['Fac'], [(0.3, c1), (0.7, c2)])
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(co, sep.inputs[0])
    sc = N.new('ShaderNodeCombineXYZ')
    L.new(_math(N, L, 'MULTIPLY', _math(N, L, 'ADD', sep.outputs[0], sep.outputs[1]), 9.0), sc.inputs[0])
    L.new(_math(N, L, 'MULTIPLY', sep.outputs[2], 0.6), sc.inputs[1])
    n3 = N.new('ShaderNodeTexNoise'); n3.inputs['Scale'].default_value = 1.6; n3.inputs['Detail'].default_value = 3
    L.new(sc.outputs[0], n3.inputs['Vector'])
    f3 = _math(N, L, 'MULTIPLY', _math(N, L, 'MAXIMUM', _math(N, L, 'SUBTRACT', n3.outputs['Fac'], 0.5), 0.0), amount * 4)
    col = _mix(N, L, _math(N, L, 'MINIMUM', f3, 0.75), col, streak)
    L.new(col, b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    ctx.mats[key] = m
    return m


def stripe_mat(ctx, key, c1, c2, freq, zk=1.0, duty=0.5, rough=0.6, wear=0.0, wear_col='#5a5a58', world=False, period=None):
    """diagonal hazard stripes: fract(((x + y) + z*zk) * freq) < duty -> c2 else c1; optional worn paint"""
    key = 'ux' + key
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    pos = world_pos(N) if world else co
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(pos, sep.inputs[0])
    s = _math(N, L, 'ADD', sep.outputs[0], sep.outputs[1])
    s = _math(N, L, 'ADD', s, _math(N, L, 'MULTIPLY', sep.outputs[2], zk))
    f = _math(N, L, 'FRACT', _math(N, L, 'MULTIPLY', s, freq))
    k = _math(N, L, 'LESS_THAN', f, duty)
    col = _mix(N, L, k, c1, c2)
    if wear > 0:
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 14; nz.inputs['Detail'].default_value = 10
        if period:
            nz.noise_dimensions = '4D'; v, w = pvec(ctx, N, L, pos, period); L.new(v, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
        else:
            L.new(pos, nz.inputs['Vector'])
        wf = _math(N, L, 'GREATER_THAN', nz.outputs['Fac'], 1.0 - wear)
        col = _mix(N, L, wf, col, wear_col)
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.3
        L.new(wf, bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    L.new(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    ctx.mats[key] = m
    return m


def wood_mat(ctx, key, c1, c2, axis='x', scale=3.0, rough=0.7, bump=0.25):
    """stretched-noise wood grain along game axis 'x', 'y' or 'z'"""
    key = 'uw' + key
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    mp = N.new('ShaderNodeMapping')
    # Blender X = game y, Y = game x
    sc = {'x': (14, 1.2, 14), 'y': (1.2, 14, 14), 'z': (14, 14, 1.2)}[axis]
    mp.inputs['Scale'].default_value = sc
    L.new(co, mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 6
    nz.inputs['Distortion'].default_value = 1.5
    L.new(mp.outputs['Vector'], nz.inputs['Vector'])
    col = _ramp(N, L, nz.outputs['Fac'], [(0.35, c1), (0.65, c2)])
    L.new(col, b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    ctx.mats[key] = m
    return m


def glow(ctx, c, es=2.0, base=None):
    return ctx.mat('ug' + c + str(es), _h(base or c), 0.3, 0.0, _h(c), es)


# ================================================================== WALLS
CREAMS = ['#e2dabf', '#ddd5b8', '#e6dec4', '#d8d0b2']
GRIMS = ['#a8a28a', '#9e987e', '#b0aa92', '#948e76']


def _rows(z0, z1, target):
    n = max(1, int(round((z1 - z0) / target)))
    s = (z1 - z0) / n
    return [(z0 + i * s, s) for i in range(n)]


def tile_field(ctx, B, z0, z1, rnd, grim=False, skip=None, row_h=0.2, tw=0.25, grime_to=0.9, missing=0.01, soot=0.0):
    """glazed metro tiles (brick bond) over z0..z1 on both visible faces"""
    gap = 0.026
    pal = GRIMS if grim else CREAMS
    tmats = [ctx.mat('tile' + c, _h(c), 0.16 if not grim else 0.42) for c in pal]
    dirty = [ctx.mat('tileD' + c, tuple(x * (0.72 if grim else 0.9) for x in _h(c)), 0.3 if not grim else 0.6) for c in pal]
    sootm = ctx.mat('tileSoot', _h('#4a463a'), 0.7)
    hole = M(ctx, '#45463e', 0.95)
    for face in ('y', 'x'):
        for ri, (z, s) in enumerate(_rows(z0, z1, row_h)):
            off = (tw / 2) if ri % 2 else 0.0
            a = -off
            while a < 1.0 - 1e-6:
                a0, a1 = max(0.0, a), min(1.0, a + tw)
                if a1 - a0 > 0.03 and not (skip and skip(face, a0, a1, z, z + s)):
                    r = rnd.random()
                    if r < missing:
                        fbox(ctx, face, a0 + gap / 2, z + gap / 2, a1 - a0 - gap, s - gap, 0.002, hole, B=B)
                    else:
                        g = 0.0 if z > grime_to else (grime_to - z) / grime_to
                        if soot and rnd.random() < soot * (0.4 + z / max(z1, 1)):
                            mt = sootm
                        elif rnd.random() < g * (0.7 if grim else 0.45):
                            mt = rnd.choice(dirty)
                        else:
                            mt = tmats[int(rnd.random() ** 1.8 * len(tmats))]
                        fbox(ctx, face, a0 + gap / 2, z + gap / 2 / UNIT, a1 - a0 - gap, s - gap / UNIT, 0.016, mt, bevel=0.006, B=B)
                a += tw


def tile_wall(grim=False, window=False):
    def build(ctx, h, v):
        rnd = random.Random(v * 1009 + int(h * 10) + (77 if grim else 0) + (500 if window else 0))
        B = Batch(ctx)
        grout = M(ctx, '#9a9886' if not grim else '#6a665a', 0.9)
        top = nm(ctx, 'ugTop2', '#1e221f', '#262a26', scale=40, bump=0.05)
        skip = None
        if window:
            skip = lambda face, a0, a1, z0, z1: face == 'y' and z1 > 1.1 and z0 < 2.55
            # core with an opening for the booth on the +y face
            ctx.box(0, 0, 0, 1, 0.72, h, grout)
            ctx.box(0, 0.72, 0, 1, 0.27, 1.1, grout); ctx.box(0, 0.72, 2.55, 1, 0.27, h - 2.55, grout)
            ctx.box(0, 0.72, 1.1, 0.04, 0.27, 1.45, grout); ctx.box(0.96, 0.72, 1.1, 0.04, 0.27, 1.45, grout)
        else:
            ctx.box(0, 0, 0, 0.99, 0.99, h, grout)
        # skirting: dark glazed plinth tiles
        plinth = ctx.mat('plinth' + ('g' if grim else ''), _h('#262a28' if not grim else '#1e1f1c'), 0.25 if not grim else 0.6)
        pl2 = ctx.mat('plinthTop', _h('#4a4e4a'), 0.3)
        for face in ('y', 'x'):
            for i in range(2):
                fbox(ctx, face, i * 0.5 + 0.01, 0, 0.48, 0.17, 0.028, plinth, bevel=0.006, B=B)
            fbox(ctx, face, 0, 0.17, 1.0, 0.035, 0.024, pl2, B=B)
        band = h >= 3
        z_top = h - 0.1
        if band:
            tile_field(ctx, B, 0.21, 1.3, rnd, grim, skip, missing=0.05 if grim else (0.012 if v == 1 else 0.0015), soot=0.25 if grim else 0)
            gdark = ctx.mat('bandDk' + str(grim), _h('#1c4430' if not grim else '#222c22'), 0.2 if not grim else 0.55)
            green = ctx.mat('bandG' + str(grim), _h('#2f6a4a' if not grim else '#3a4a3a'), 0.18 if not grim else 0.5)
            red = ctx.mat('bandR' + str(grim), _h('#c8102e' if not grim else '#6a2a24'), 0.2 if not grim else 0.6)
            for face in ('y', 'x'):
                if skip and skip(face, 0, 1, 1.3, 1.62): continue
                fbox(ctx, face, 0, 1.3, 1.0, 0.05, 0.02, gdark, B=B)
                for i in range(4):
                    fbox(ctx, face, i * 0.25 + 0.012, 1.355, 0.226, 0.1, 0.018, green, bevel=0.005, B=B)
                    fbox(ctx, face, i * 0.25 + 0.012, 1.495, 0.226, 0.07, 0.018, green, bevel=0.005, B=B)
                fbox(ctx, face, 0, 1.457, 1.0, 0.036, 0.022, red, B=B)
                fbox(ctx, face, 0, 1.57, 1.0, 0.05, 0.02, gdark, B=B)
            tile_field(ctx, B, 1.62, z_top, rnd, grim, skip, missing=0.05 if grim else (0.012 if v == 1 else 0.0015), soot=0.35 if grim else 0)
        else:
            tile_field(ctx, B, 0.21, z_top, rnd, grim, skip, missing=0.05 if grim else (0.012 if v == 1 else 0.0015), soot=0.25 if grim else 0)
        # bullnose capping + corner bead (cream glaze)
        cap = ctx.mat('cap' + str(grim), _h('#c8c8b6' if not grim else '#8e8a74'), 0.2 if not grim else 0.5)
        beam(ctx, (0, 1.0, h - 0.05), (1.02, 1.0, h - 0.05), 0.035, cap, seg=10)
        beam(ctx, (1.0, 0, h - 0.05), (1.0, 1.02, h - 0.05), 0.035, cap, seg=10)
        if h < 2:  # low dado wall: glazed cream capping on top
            ctx.box(0, 0, h - 0.04, 1.0, 1.0, 0.04, cap)
        else:
            ctx.box(0, 0, h - 0.03, 1.0, 1.0, 0.03, top)
        B.done()
        if window:
            ticket_booth(ctx, h, v)
            return
        if h < 2: return
        k = v % 6
        if grim:
            if k in (1, 4):   # cast iron pipe
                pipe = M(ctx, '#2a2624', 0.6, 0.4)
                beam(ctx, (1.05, 0.78, 0), (1.05, 0.78, h), 0.04, pipe)
                for zz in (0.8, 1.9): fbox(ctx, 'x', 0.73, zz, 0.1, 0.08, 0.06, pipe)
            if k in (2, 5):   # rusted enamel plate
                fbox(ctx, 'y', 0.3, 2.1, 0.42, 0.3, 0.012, M(ctx, '#3a4a6a', 0.6))
                fbox(ctx, 'y', 0.34, 2.14, 0.34, 0.22, 0.016, M(ctx, '#6a4a30', 0.9))
            return
        if k == 2:            # conduit + junction box on the right face
            met = M(ctx, '#8a9098', 0.4, 0.7)
            beam(ctx, (1.035, 0.78, 0.2), (1.035, 0.78, h), 0.022, met)
            fbox(ctx, 'x', 0.7, 2.0, 0.16, 0.22, 0.06, M(ctx, '#7a8088', 0.45, 0.6), bevel=0.01)
            for zz in (0.7, 1.4, 2.6):
                if zz < h - 0.2: fbox(ctx, 'x', 0.75, zz, 0.06, 0.03, 0.05, met)
        elif k == 3:          # blue enamel wayfinding plate with a white arrow
            fbox(ctx, 'y', 0.22, 2.05, 0.56, 0.36, 0.012, M(ctx, '#f4f1e8', 0.35))
            fbox(ctx, 'y', 0.24, 2.07, 0.52, 0.32, 0.016, M(ctx, '#1f3fa0', 0.3))
            wh = M(ctx, '#f4f1e8', 0.35)
            fbox(ctx, 'y', 0.33, 2.2, 0.22, 0.06, 0.02, wh)
            quad(ctx, [(0.55, 1.02, 2.14), (0.67, 1.02, 2.23), (0.55, 1.02, 2.32)], wh)
        elif k == 4:          # fire alarm call point + red sign
            fbox(ctx, 'y', 0.72, 1.0, 0.14, 0.15, 0.04, M(ctx, '#c01818', 0.35), bevel=0.008)
            fbox(ctx, 'y', 0.745, 1.03, 0.09, 0.09, 0.045, M(ctx, '#f0f0e8', 0.3))
            fbox(ctx, 'y', 0.68, 1.22, 0.22, 0.12, 0.014, M(ctx, '#c01818', 0.4))
        elif k == 5 and h >= 3:  # CCTV camera on a corner bracket
            dk = M(ctx, '#2a2c30', 0.4, 0.5)
            beam(ctx, (1.0, 1.0, h - 0.35), (1.14, 1.14, h - 0.35), 0.015, dk)
            cb = cbox(ctx, 1.12, 1.12, h - 0.52, 0.11, 0.22, 0.12, M(ctx, '#d8dcd8', 0.35), rot=-30, bevel=0.01)
            cb.rotation_euler = Euler((math.radians(-14), 0, math.radians(-30)))
            beam(ctx, (1.17, 1.24, h - 0.48), (1.18, 1.27, h - 0.48), 0.03, M(ctx, '#0a0a0c', 0.1))
    return build


def ticket_booth(ctx, h, v):
    frame = M(ctx, '#2a2a2a', 0.45, 0.5)
    wood = wood_mat(ctx, 'counterTop', '#6a4a2a', '#7e5a34', axis='x')
    # booth interior: lit cream back wall, a clerk silhouette (v0) or a half-drawn blind (v1)
    ctx.box(0.04, 0.72, 1.1, 0.92, 0.02, 1.45, ctx.mat('boothBack', _h('#e8dcb0'), 0.8, 0, _h('#f0e8b0'), 0.9))
    ctx.box(0.04, 0.72, 1.1, 0.92, 0.27, 0.02, M(ctx, '#3a2a1a', 0.8))
    if v % 2 == 0:
        sil = M(ctx, '#2a2a30', 0.8)
        cbox(ctx, 0.36, 0.8, 1.3, 0.3, 0.12, 0.55, sil, bevel=0.04)
        ctx.sphere(0.36, 0.8, 1.98, 0.1, sil)
        cbox(ctx, 0.36, 0.8, 2.05, 0.2, 0.2, 0.05, M(ctx, '#1a2a4a', 0.6))       # inspector's cap
    else:
        ctx.box(0.06, 0.92, 1.85, 0.88, 0.02, 0.62, ctx.mat('blind', _h('#d8ccaa'), 0.9, 0, _h('#f0e0b0'), 0.25))
        for i in range(6): ctx.box(0.06, 0.935, 1.88 + i * 0.1, 0.88, 0.01, 0.015, M(ctx, '#b8ac8a', 0.9))
    # frame, mullion, glass, counter shelf, brass speak grille, deal tray
    for (a, w) in ((0.03, 0.05), (0.92, 0.05), (0.475, 0.05)):
        ctx.box(a, 0.97, 1.3, w, 0.05, 1.22, frame)
    ctx.box(0.03, 0.97, 2.48, 0.94, 0.05, 0.07, frame)
    ctx.box(0.08, 0.985, 1.3, 0.84, 0.01, 1.18, alpha_mat(ctx, 'boothGlass', '#c8f0e0', 0.22, 0.05))
    ctx.box(0.0, 0.9, 1.1, 1.0, 0.2, 0.2, wood, bevel=0.01)
    ctx.box(0.3, 1.02, 1.3, 0.4, 0.04, 0.02, M(ctx, '#8a8a8a', 0.3, 0.8))
    gold = M(ctx, '#c8a850', 0.3, 0.9)
    beam(ctx, (0.25, 0.99, 1.62), (0.25, 1.0, 1.62), 0.06, gold, seg=16)
    beam(ctx, (0.75, 0.99, 1.62), (0.75, 1.0, 1.62), 0.06, gold, seg=16)
    # a small lit 'open' lamp above
    fbox(ctx, 'y', 0.4, 2.62, 0.2, 0.1, 0.03, glow(ctx, '#7aff9a', 2.0) if v % 2 == 0 else M(ctx, '#3a2020', 0.4))


def gateline(ctx, h, v):
    steel = nm(ctx, 'gateSteel', '#9aa2aa', '#b4bcc4', scale=60, rough=0.32, bump=0.05, metal=0.85)
    dark = M(ctx, '#26282c', 0.5)
    topm = M(ctx, '#3a3e44', 0.3, 0.3)
    for x0 in (0.03, 0.69):
        ctx.box(x0, 0.08, 0, 0.28, 0.86, 0.1, dark)
        ctx.box(x0, 0.08, 0.1, 0.28, 0.86, h - 0.18, steel, bevel=0.025)
        ctx.box(x0 - 0.005, 0.07, h - 0.1, 0.29, 0.88, 0.1, topm, bevel=0.03)
        # dark glass top strip + yellow reader pad
        ctx.box(x0 + 0.06, 0.18, h - 0.005, 0.16, 0.55, 0.01, M(ctx, '#121418', 0.08, 0.2))
        ctx.box(x0 + 0.05, 0.76, h - 0.01, 0.18, 0.14, 0.02, ctx.mat('reader', _h('#d8c020'), 0.4, 0, _h('#d8c020'), 0.4))
        ctx.box(x0 + 0.08, 0.8, h + 0.01, 0.12, 0.06, 0.004, M(ctx, '#1a1a1a', 0.3))
        # green arrow lamp facing +y, panel seams
        ctx.box(x0 + 0.08, 0.94, h - 0.32, 0.12, 0.012, 0.14, M(ctx, '#0a0c0a', 0.2))
        quad(ctx, [(x0 + 0.1, 0.956, h - 0.3), (x0 + 0.18, 0.956, h - 0.25), (x0 + 0.1, 0.956, h - 0.2)], glow(ctx, '#3aff6a', 3.0))
        ctx.box(x0 + 0.02, 0.945, 0.2, 0.24, 0.006, 0.4, M(ctx, '#6a727a', 0.4, 0.7))
    # red 'no entry' lamp on the +x side
    ctx.box(0.97, 0.4, h - 0.32, 0.012, 0.14, 0.14, M(ctx, '#0a0c0a', 0.2))
    ctx.box(0.98, 0.43, h - 0.29, 0.006, 0.08, 0.08, glow(ctx, '#ff3a3a', 3.0))
    # closed paddle doors between the cabinets
    pad = alpha_mat(ctx, 'paddle', '#8a1a24', 0.82, 0.25, emit='#4a0a10', es=0.2)
    ctx.box(0.31, 0.47, 0.4, 0.185, 0.04, 0.48, pad, bevel=0.01)
    ctx.box(0.505, 0.47, 0.4, 0.185, 0.04, 0.48, pad, bevel=0.01)
    edge = M(ctx, '#e85a64', 0.4)
    ctx.box(0.31, 0.47, 0.87, 0.38, 0.04, 0.02, edge)


def counter(ctx, h, v):
    wood = wood_mat(ctx, 'ctrWood', '#5a3a22', '#6a4428', axis='z', rough=0.5)
    frame = wood_mat(ctx, 'ctrFrame', '#3a2412', '#4a2e18', axis='x', rough=0.55)
    lam = nm(ctx, 'ctrLam', '#b8a888', '#c4b494', scale=30, rough=0.35, bump=0.02)
    edge = M(ctx, '#6a5a40', 0.4)
    ctx.box(0, 0, 0, 0.97, 0.97, 0.12, M(ctx, '#1e1a16', 0.7))
    ctx.box(0, 0, 0.12, 0.97, 0.97, h - 0.2, frame)
    for face in ('y', 'x'):
        for i in range(2):
            fbox(ctx, face, 0.07 + i * 0.45, 0.22, 0.38, h - 0.42, 0.012, wood, bevel=0.012)
            fbox(ctx, face, 0.11 + i * 0.45, 0.27, 0.3, h - 0.52, 0.02, wood, bevel=0.02)
    ctx.box(-0.0, -0.0, h - 0.09, 1.0, 1.04, 0.09, lam, bevel=0.012)
    ctx.box(0, 1.02, h - 0.1, 1.0, 0.03, 0.06, edge)
    if v % 3 == 1:    # brass bell + leaflet stack
        gold = M(ctx, '#c8a850', 0.25, 0.9)
        ctx.cyl(0.3, 0.6, h, 0.05, 0.02, M(ctx, '#2a2a2a', 0.5)); ctx.sphere(0.3, 0.6, h + 0.02, 0.045, gold, sz=0.8)
        ctx.box(0.6, 0.35, h, 0.22, 0.3, 0.05, M(ctx, '#e8e0c8', 0.8)); ctx.box(0.62, 0.38, h + 0.05, 0.18, 0.24, 0.02, M(ctx, '#c8102e', 0.7))
    elif v % 3 == 2:  # brass foot rail
        gold = M(ctx, '#c8a850', 0.25, 0.9)
        beam(ctx, (0, 1.08, 0.25), (1, 1.08, 0.25), 0.02, gold)
        for x in (0.2, 0.8): beam(ctx, (x, 0.97, 0.25), (x, 1.08, 0.25), 0.012, gold)


def lockers(ctx, h, v):
    paint = nm(ctx, 'lockPaint', '#5a7064', '#62786b', scale=25, rough=0.5, bump=0.05, metal=0.25)
    frame = M(ctx, '#2e3a34', 0.5, 0.3)
    ctx.box(0, 0, 0, 0.99, 0.99, h, frame)
    ctx.box(0, 0, 0, 1.0, 1.0, 0.12, M(ctx, '#1e2420', 0.7))
    ctx.box(0, 0, h - 0.05, 1.0, 1.0, 0.05, M(ctx, '#3a4440', 0.6, 0.3))
    slat = M(ctx, '#1e2420', 0.6)
    chrome = M(ctx, '#c0c8c0', 0.2, 0.9)
    plate = M(ctx, '#e8e4d0', 0.5)
    rnd = random.Random(v * 31 + 7)
    B = Batch(ctx)
    for face in ('y', 'x'):
        for i in range(3):
            a = i / 3 + 0.015
            w = 1 / 3 - 0.03
            fbox(ctx, face, a, 0.15, w, h - 0.25, 0.018, paint, bevel=0.008, B=B)
            for k in range(4):
                fbox(ctx, face, a + 0.06, h - 0.45 + k * 0.06, w - 0.12, 0.025, 0.024, slat, B=B)
                fbox(ctx, face, a + 0.06, 0.3 + k * 0.06, w - 0.12, 0.025, 0.024, slat, B=B)
            fbox(ctx, face, a + w - 0.06, h * 0.5, 0.03, 0.14, 0.04, chrome, B=B)
            fbox(ctx, face, a + 0.08, h - 0.65, 0.12, 0.06, 0.022, plate, B=B)
            if rnd.random() < 0.25:
                fbox(ctx, face, a + 0.05, 0.9 + rnd.random() * 0.5, 0.12, 0.12, 0.022, M(ctx, rnd.choice(['#c8102e', '#e8c020', '#f4f1e8', '#3ab8ff']), 0.7), B=B)
    B.done()


def duct(ctx, h, v):
    galv = nm(ctx, 'galv', '#8a929a', '#a0a8b0', scale=40, rough=0.42, bump=0.04, metal=0.75)
    seam = M(ctx, '#6a727a', 0.45, 0.7)
    rivet = M(ctx, '#d0d8e0', 0.3, 0.9)
    ctx.box(0.02, 0.02, 0, 0.96, 0.96, h, galv)
    B = Batch(ctx)
    for face in ('y', 'x'):
        fbox(ctx, face, 0, 0.0, 1.0, 0.08, 0.02, seam, B=B)
        fbox(ctx, face, 0, h - 0.08, 1.0, 0.08, 0.02, seam, B=B)
        fbox(ctx, face, 0.48, 0, 0.04, h, 0.02, seam, B=B)
        for k in range(int(h / 0.3)):
            for a in (0.455, 0.535):
                fbox(ctx, face, a, 0.15 + k * 0.3, 0.012, 0.025, 0.026, rivet, B=B)
    # louvred grille on the +y face
    fbox(ctx, 'y', 0.12, 0.3, 0.3, h - 0.6, 0.004, M(ctx, '#121418', 0.7), B=B)
    fbox(ctx, 'y', 0.58, 0.3, 0.3, h - 0.6, 0.004, M(ctx, '#121418', 0.7), B=B)
    lv = M(ctx, '#c0c8d0', 0.4, 0.8)
    z = 0.34
    while z < h - 0.34:
        for a in (0.12, 0.58):
            B.box(a, 0.985, z, 0.3, 0.035, 0.03, lv)
        z += 0.09
    for i in range(5):   # standing seams on top
        B.box(i * 0.25, 0.0, h, 0.02, 1.0, 0.03, seam)
    B.done()


def tunnel_wall(ctx, h, v):
    conc = streak_mat(ctx, 'tunConc%d' % (v % 2), '#464844', '#52544f', streak='#2a2c28', amount=0.55 + 0.2 * (v % 2), scale=9 + v)
    joint = M(ctx, '#2e302c', 0.95)
    top = nm(ctx, 'tunTop', '#1c1e1c', '#262826', scale=12)
    ctx.box(0, 0, 0, 1.0, 1.0, h, conc)
    ctx.box(0, 0, h - 0.01, 1.0, 1.0, 0.012, top)
    B = Batch(ctx)
    z = 1.0
    while z < h - 0.05:   # precast segment joints with bolt pockets
        for face in ('y', 'x'):
            fbox(ctx, face, 0, z - 0.012, 1.0, 0.024, 0.002, joint, B=B)
            for a in (0.18, 0.5, 0.82):
                fbox(ctx, face, a - 0.04, z + 0.05, 0.08, 0.08, 0.003, M(ctx, '#20221f', 0.9), B=B)
        z += 1.0
    for face in ('y', 'x'):
        fbox(ctx, face, 0, 0, 1.0, 0.18, 0.012, M(ctx, '#242622', 0.9), B=B)
    if h >= 2.5:   # cable run: brackets + three cables (orange, black, grey)
        br = M(ctx, '#6a6e74', 0.45, 0.7)
        for face in ('y', 'x'):
            for a in (0.2, 0.7):
                fbox(ctx, face, a, 1.5, 0.03, 0.3, 0.13, br, B=B)
        cab = [(M(ctx, '#c8541a', 0.55), 0.03, 1.58, 0.06), (M(ctx, '#18181a', 0.5), 0.034, 1.67, 0.08), (M(ctx, '#3a3a3e', 0.5), 0.026, 1.75, 0.07)]
        for mt, r, zz, out in cab:
            beam(ctx, (0, 1 + out, zz), (1 + out, 1 + out, zz), r, mt)
            beam(ctx, (1 + out, 0, zz), (1 + out, 1 + out, zz), r, mt)
    B.done()
    k = v % 4
    if k == 1 and h >= 2.5:    # emergency telephone box
        fbox(ctx, 'y', 0.35, 0.95, 0.3, 0.4, 0.08, M(ctx, '#c8541a', 0.5), bevel=0.012)
        fbox(ctx, 'y', 0.42, 1.12, 0.16, 0.16, 0.09, M(ctx, '#1a1a1a', 0.4))
    elif k == 2:               # drain pipe / low conduit
        pipe = M(ctx, '#3a3c40', 0.5, 0.5)
        zz = 0.55
        beam(ctx, (0, 1.05, zz), (1.05, 1.05, zz), 0.035, pipe); beam(ctx, (1.05, 0, zz), (1.05, 1.05, zz), 0.035, pipe)
    elif k == 3 and h >= 2.5:  # blue tunnel marker light
        fbox(ctx, 'x', 0.45, 2.3, 0.1, 0.1, 0.05, M(ctx, '#2a2c30', 0.4))
        fbox(ctx, 'x', 0.47, 2.32, 0.06, 0.06, 0.06, glow(ctx, '#5a8aff', 4.0))


def hazard_wall(ctx, h, v):
    block = brick_wall_mat(ctx, 'hzBlock', '#4c4e4a', '#52544f', '#3a3c38', h, bw=0.5, bh=0.22, mortar_size=0.01, streaks=0.4)
    stripes = stripe_mat(ctx, 'hzStripe', '#1a1a1a', '#d8b020', 3.0, zk=1.0, duty=0.5, rough=0.55, wear=0.18, wear_col='#5a5a52', world=True)
    top = nm(ctx, 'tunTop', '#1c1e1c', '#262826', scale=12)
    ctx.box(0, 0, 0, 1.0, 1.0, h, block)
    ctx.box(0, 0, h - 0.01, 1.0, 1.0, 0.012, top)
    for face in ('y', 'x'):
        fbox(ctx, face, 0, 0.0, 1.0, 0.5, 0.012, stripes)
        fbox(ctx, face, 0, 0.5, 1.0, 0.03, 0.016, M(ctx, '#1a1a1a', 0.6))
    if h < 2:
        ctx.box(0, 0, h - 0.06, 1.0, 1.0, 0.06, nm(ctx, 'coping', '#6a6c68', '#5a5c58', scale=20))
        return
    k = v % 4
    if k == 1:    # yellow gas pipe
        beam(ctx, (1.05, 0.25, 0), (1.05, 0.25, h), 0.04, M(ctx, '#d8b020', 0.45, 0.2))
        for zz in (0.9, 2.1): fbox(ctx, 'x', 0.2, zz, 0.1, 0.06, 0.06, M(ctx, '#3a3a3a', 0.5, 0.5))
    elif k == 2:  # isolator switch box with a warning triangle
        fbox(ctx, 'y', 0.3, 1.2, 0.4, 0.5, 0.1, M(ctx, '#6a6e72', 0.45, 0.5), bevel=0.015)
        quad(ctx, [(0.42, 1.105, 1.45), (0.58, 1.105, 1.45), (0.5, 1.105, 1.62)], M(ctx, '#e8c020', 0.4))
        fbox(ctx, 'y', 0.62, 1.3, 0.05, 0.22, 0.14, M(ctx, '#c01818', 0.4))
    elif k == 3:  # fire extinguisher on a bracket
        fbox(ctx, 'y', 0.6, 0.9, 0.18, 0.24, 0.012, M(ctx, '#c01818', 0.5))
        ctx.cyl(0.69, 1.09, 0.45, 0.07, 0.6, M(ctx, '#c01818', 0.3, 0.1))
        ctx.cyl(0.69, 1.09, 1.05, 0.03, 0.08, M(ctx, '#1a1a1a', 0.4))


def brick_soot(ctx, h, v):
    m = brick_wall_mat(ctx, 'soot%s_%d' % (h, v % 2), '#5a3a30', '#4e322a', '#22181a', h, soot=0.95, soot_from=0.25,
                       moss=0.06, seed=v * 0.37, streaks=0.3)
    ctx.box(0, 0, 0, 1.0, 1.0, h, m)
    ctx.box(0, 0, h - 0.01, 1.0, 1.0, 0.012, nm(ctx, 'sootTop', '#1a1412', '#241c1a', scale=12))
    for face in ('y', 'x'):
        fbox(ctx, face, 0, 0, 1.0, 0.12, 0.01, M(ctx, '#1a1614', 0.95))
    if h < 2:
        ctx.box(0, 0, h - 0.07, 1.02, 1.02, 0.07, nm(ctx, 'sootCope', '#3a3230', '#2a2422', scale=24, bump=0.4))
        return
    k = v % 4
    if k == 1:    # old cast iron pipe
        pipe = M(ctx, '#2a2420', 0.7, 0.3)
        beam(ctx, (0.3, 1.05, 0), (0.3, 1.05, h), 0.045, pipe)
        for zz in (1.0, 2.4): fbox(ctx, 'y', 0.24, zz, 0.12, 0.07, 0.08, pipe)
    elif k == 2:  # faded tiled frieze remnant
        for i in range(4):
            fbox(ctx, 'y', i * 0.25 + 0.01, 1.3, 0.23, 0.18, 0.014, M(ctx, '#7a7458' if i % 2 else '#6a6a50', 0.6), bevel=0.004)
    elif k == 3:  # rusted enamel sign
        fbox(ctx, 'x', 0.25, 1.9, 0.5, 0.35, 0.014, M(ctx, '#5a3a2a', 0.9))
        fbox(ctx, 'x', 0.3, 1.95, 0.4, 0.25, 0.018, M(ctx, '#2a3a5a', 0.7))


def brick_blocked(ctx, h, v):
    new = brick_wall_mat(ctx, 'blocked%s' % h, '#7a5a48', '#82604c', '#4a3a30', h, seed=0.11, mortar_size=0.014)
    ctx.box(0, 0, 0, 1.0, 1.0, h, new)
    ctx.box(0, 0, h - 0.01, 1.0, 1.0, 0.012, nm(ctx, 'blkTop', '#2a201c', '#32261f', scale=12))
    # concrete lintel near the top (a bricked-up opening), soot band above it
    lint = nm(ctx, 'lintel', '#6a6660', '#7a766e', scale=18, bump=0.3)
    ctx.box(0, 0, h - 0.75, 1.01, 1.01, 0.22, lint)
    sootb = brick_wall_mat(ctx, 'blockedSoot%s' % h, '#5a3a30', '#4e322a', '#22181a', h, soot=1.2, soot_from=0.6, seed=0.5)
    ctx.box(0, 0, h - 0.53, 1.004, 1.004, 0.52, sootb)
    for face in ('y', 'x'):
        fbox(ctx, face, 0, 0, 1.0, 0.1, 0.008, M(ctx, '#2a2420', 0.95))
    # fresh mortar smears
    fbox(ctx, 'y', 0.2, 0.9, 0.18, 0.05, 0.006, M(ctx, '#8a7a6a', 0.95))
    fbox(ctx, 'x', 0.6, 1.6, 0.14, 0.04, 0.006, M(ctx, '#8a7a6a', 0.95))


# ================================================================== FLOORS
def joints(ctx, n, mat, step=1.0, w=0.02, hz=0.003):
    B = Batch(ctx)
    k = 0.0
    while k <= n + 1e-6:
        B.box(k - w / 2, 0, 0, w, n, hz, mat); B.box(0, k - w / 2, 0, n, w, hz, mat)
        k += step
    B.done()


def floor_terrazzo(ctx, n):
    ctx.plane(0, 0, n, n, terrazzo_mat(ctx, 'terr%d' % n, '#565e58', '#606862', ['#8c9286', '#363c38', '#7a5c4a', '#9a9e92', '#4a524c'], n))
    joints(ctx, n, M(ctx, '#3a423e', 0.6), 1.0, 0.022)


def floor_corridor(ctx, n):
    B = Batch(ctx)
    rnd = random.Random(34)
    cols = [ctx.mat('cor' + c, _h(c), 0.38) for c in ('#8a8a7c', '#82827a', '#76786e', '#8e8e80')]
    for i in range(n * 4):
        for j in range(n * 4):
            B.box(i * 0.25 + 0.014, j * 0.25 + 0.014, 0, 0.222, 0.222, 0.012, cols[int(rnd.random() ** 1.5 * 4)], bevel=0.004)
    B.done()
    ctx.plane(0, 0, n, n, M(ctx, '#4a504a', 0.9), gz=-0.001)


def platform_slabs(ctx, B, x0, y0, x1, y1, rnd):
    mats = [nm(ctx, 'plat%d' % k, c, '#3e423f', scale=24, bump=0.2, period=None) for k, c in enumerate(['#4a4f4c', '#464b48', '#4f5451'])]
    i = x0
    while i < x1 - 1e-6:
        j = y0
        while j < y1 - 1e-6:
            jj = min(j + 0.5, y1)
            B.box(i + 0.012, j + 0.012, 0, 0.476, jj - j - 0.024, 0.02, rnd.choice(mats), bevel=0.004)
            j = jj
        i += 0.5


def floor_platform(ctx, n):
    rnd = random.Random(32)
    B = Batch(ctx)
    platform_slabs(ctx, B, 0, 0, n, n, rnd)
    B.done()
    ctx.plane(0, 0, n, n, M(ctx, '#2c302e', 0.95), gz=-0.001)
    # chewing gum spots + grime
    gum = M(ctx, '#383c3a', 0.8)
    for k in range(40):
        x, y = rnd.random() * n, rnd.random() * n
        ctx.cyl(x, y, 0.02, 0.02 + rnd.random() * 0.02, 0.003, gum, 8)


def edge_row(ctx, B, n, j, flip, dusty=False, rnd=None):
    """one row of platform edge tiles; w = distance from the track-side lip (flip: lip at v=0 instead of v=1)"""
    def Y(w0, w1):
        return (j + w0, w1 - w0) if flip else (j + 1 - w1, w1 - w0)
    lip = M(ctx, '#151716' if not dusty else '#151412', 0.8)
    cope = nm(ctx, 'cope' + str(dusty), '#d0d0c4' if not dusty else '#8a8270', '#b4b4a8' if not dusty else '#7a7262', scale=30, bump=0.15, rough=0.7)
    yel = nm(ctx, 'yline' + str(dusty), '#e8c020' if not dusty else '#8a7a3a', '#d8b018' if not dusty else '#7a6a32', scale=40, rough=0.5, bump=0.05)
    yed = M(ctx, '#a08010', 0.6)
    y, d = Y(0.0, 0.05); B.box(0, y, -0.03, n, d, 0.03, lip)
    y, d = Y(0.05, 0.2)
    for i in range(n * 2):
        B.box(i * 0.5 + 0.01, y + 0.005, 0, 0.48, d - 0.01, 0.025, cope, bevel=0.006)
    if dusty:
        y, d = Y(0.2, 0.28); B.box(0, y, 0, n, d, 0.012, yel)
        return
    y, d = Y(0.2, 0.3); B.box(0, y, 0, n, d, 0.012, yed)
    y, d = Y(0.215, 0.29); B.box(0, y, 0, n, d, 0.016, yel)
    # tactile blister paving
    y, d = Y(0.3, 0.5)
    B.box(0, y + 0.005, 0, n, d - 0.01, 0.012, M(ctx, '#6c6e66', 0.8))
    dot = M(ctx, '#a6a69a', 0.6)
    for i in range(n * 10):
        for k in range(2):
            ctx.cyl(i * 0.1 + 0.05, y + 0.05 + k * 0.1, 0.012, 0.022, 0.02, dot, 8)
    # platform slabs beyond
    y, d = Y(0.5, 1.0)
    platform_slabs(ctx, B, 0, y, n, y + d, rnd)


def floor_edge(flip, dusty=False):
    def build(ctx, n):
        rnd = random.Random(33)
        B = Batch(ctx)
        for j in range(n): edge_row(ctx, B, n, j, flip, dusty, rnd)
        if dusty:
            dust = dusty_mats(ctx, n)
            for j in range(n):
                B.box(0, (j + 0.28) if flip else j, 0, n, 0.72, 0.01, dust[0])
        B.done()
        ctx.plane(0, 0, n, n, M(ctx, '#2c302e', 0.95), gz=-0.001)
    return build


def dusty_mats(ctx, n):
    out = []
    for k, (c1, c2) in enumerate((('#6a5e4a', '#7a7060'), ('#5e5444', '#7a7060'))):
        key = 'udust%d_%d' % (k, n)
        if key in ctx.mats: out.append(ctx.mats[key]); continue
        m, N, L, b, co = ctx.nodemat(key)
        v, w = pvec(ctx, N, L, world_pos(N), n)
        nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 6; nz.inputs['Detail'].default_value = 8
        L.new(v, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
        col = _ramp(N, L, nz.outputs['Fac'], [(0.35, c1), (0.6, c2)])
        n2 = N.new('ShaderNodeTexNoise'); n2.noise_dimensions = '4D'; n2.inputs['Scale'].default_value = 40; n2.inputs['Detail'].default_value = 4
        L.new(v, n2.inputs['Vector']); L.new(w, n2.inputs['W'])
        col = _mix(N, L, _math(N, L, 'GREATER_THAN', n2.outputs['Fac'], 0.68), col, '#3a3228')
        L.new(col, b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = 0.95
        ctx.mats[key] = m; out.append(m)
    return out


def floor_dusty(ctx, n):
    rnd = random.Random(46)
    B = Batch(ctx)
    mats = dusty_mats(ctx, n)
    t = 1 / 3
    for i in range(n * 3):
        for j in range(n * 3):
            B.box(i * t + 0.012, j * t + 0.012, 0, t - 0.024, t - 0.024, 0.014, mats[rnd.random() < 0.5], bevel=0.004)
    B.done()
    ctx.plane(0, 0, n, n, M(ctx, '#3a342c', 0.95), gz=-0.001)
    # debris: grit, old paper scraps
    for k in range(26):
        x, y = rnd.random() * n, rnd.random() * n
        if rnd.random() < 0.3:
            cbox(ctx, x, y, 0.015, 0.12, 0.08, 0.004, M(ctx, '#b8ae90', 0.9), rot=rnd.random() * 180)
        else:
            cbox(ctx, x, y, 0.0, 0.04, 0.03, 0.03, M(ctx, '#4a4238', 0.9), rot=rnd.random() * 180)


def floor_lino(ctx, n):
    B = Batch(ctx)
    a = nm(ctx, 'linoA', '#6a7a68', '#647462', scale=20, rough=0.38, bump=0.03)
    b = nm(ctx, 'linoB', '#8a9480', '#84907a', scale=20, rough=0.38, bump=0.03)
    for i in range(n * 2):
        for j in range(n * 2):
            B.box(i * 0.5 + 0.004, j * 0.5 + 0.004, 0, 0.492, 0.492, 0.006, a if (i + j) % 2 else b)
    B.done()
    ctx.plane(0, 0, n, n, M(ctx, '#3a4038', 0.9), gz=-0.001)


def floor_depot(ctx, n):
    ctx.plane(0, 0, n, n, nm(ctx, 'depotC', '#4a4c48', '#555752', scale=18, bump=0.3, period=n))
    joints(ctx, n, M(ctx, '#323432', 0.9), 1.0, 0.025)
    rnd = random.Random(43)
    oil = M(ctx, '#1e201e', 0.15)
    oil2 = M(ctx, '#2a2c2a', 0.3)
    for (x, y, r) in ((1.4, 0.6, 0.32), (3.2, 2.5, 0.26), (0.5, 3.1, 0.2)):
        cbox(ctx, x, y, 0.0, r * 2.4, r * 1.8, 0.004, oil2, rot=rnd.random() * 90, bevel=0.0)
        ctx.cyl(x + 0.05, y, 0.001, r * 0.8, 0.005, oil, 20)
    # bolts of old fixings
    for k in range(10):
        ctx.cyl(rnd.random() * n, rnd.random() * n, 0, 0.02, 0.015, M(ctx, '#6a6a64', 0.4, 0.7), 8)


def floor_hatch(ctx, n):
    ctx.plane(0, 0, n, n, stripe_mat(ctx, 'hatch%d' % n, '#1a1a1a', '#d8b020', 3.0, zk=0.0, duty=0.5, rough=0.5, wear=0.22,
                                     wear_col='#4a4a46', world=True, period=n))


def floor_ballast(ctx, n):
    ctx.plane(0, 0, n, n, stone_mat(ctx, 'ballast%d' % n, ['#2c2925', '#3a3631', '#33302b', '#4a453d', '#26231f'], 16, n, bump=0.7))
    rnd = random.Random(42)
    oil = M(ctx, '#16140f', 0.2)
    for (x, y) in ((1.3, 2.4), (3.4, 0.7)):
        cbox(ctx, x, y, 0.002, 0.5, 0.35, 0.004, oil, rot=rnd.random() * 90)


def track_row(ctx, B, n, j, flip, mode='live'):
    """one row of track bed; d = 0 at the lane centre (conductor rail), 1 at the platform wall.
    flip=False: lane at v=1 (row A), True: lane at v=0 (row B). mode: 'live' | 'cross' | 'dead'"""
    def Y(d0, d1):
        return (j + d0, d1 - d0) if flip else (j + 1 - d1, d1 - d0)
    dead = mode == 'dead'
    y, d = Y(0.9, 1.0); B.box(0, y, 0, n, d, 0.004, M(ctx, '#121312', 0.95))
    y, d = Y(0.96, 1.0); B.box(0, y, 0, n, d, 0.006, M(ctx, '#0a0b0b', 0.95))
    rail_head = M(ctx, '#c4c8d0', 0.22, 0.95) if not dead else nm(ctx, 'rust', '#7a5a40', '#5a3e2a', scale=40, rough=0.9, bump=0.3)
    rail_web = M(ctx, '#4a4e56', 0.5, 0.6) if not dead else M(ctx, '#4a3426', 0.9, 0.2)
    if mode == 'cross':
        planks = [wood_mat(ctx, 'xb%d' % k, c, '#4a3420', axis='y', rough=0.85) for k, c in enumerate(('#5e4428', '#6a4c2e', '#725434'))]
        rnd = random.Random(37 + j)
        for i in range(n * 4):
            y, d = Y(0.0, 0.52); B.box(i * 0.25 + 0.012, y, 0, 0.226, d, 0.12, planks[rnd.randrange(3)], bevel=0.008)
            y, d = Y(0.58, 0.9); B.box(i * 0.25 + 0.012, y, 0, 0.226, d, 0.12, planks[rnd.randrange(3)], bevel=0.008)
        y, d = Y(0.515, 0.585); B.box(0, y, 0.0, n, d, 0.125, rail_head)
        y, d = Y(0.0, 0.9); B.box(0, y, -0.01, n, d, 0.01, M(ctx, '#2a1e14', 0.9))
        return
    # sleepers every 0.5 m
    sl = wood_mat(ctx, 'sleeper' + mode, '#58483a' if not dead else '#4a3e32', '#4a3c30', axis='y', rough=0.9)
    sle = M(ctx, '#3a3028', 0.9)
    for i in range(n * 2):
        y, d = Y(0.0, 0.8)
        B.box(i * 0.5 + 0.0, y, 0, 0.15, d, 0.05, sl, bevel=0.006)
        # rail chairs / baseplates
        y2, d2 = Y(0.47, 0.63); B.box(i * 0.5 + 0.01, y2, 0.05, 0.13, d2, 0.02, M(ctx, '#3a3a3c', 0.6, 0.5))
    # running rail: foot, web, head
    y, d = Y(0.475, 0.625); B.box(0, y, 0.05, n, d, 0.02, rail_web)
    y, d = Y(0.53, 0.57); B.box(0, y, 0.07, n, d, 0.07, rail_web)
    y, d = Y(0.515, 0.585); B.box(0, y, 0.13, n, d, 0.04, rail_head, bevel=0.006)
    if not dead:
        # conductor (live) rail on white insulator pots
        y, d = Y(0.0, 0.1); B.box(0, y, 0.06, n, d, 0.035, M(ctx, '#706452', 0.6, 0.4))
        y, d = Y(0.0, 0.04); B.box(0, y, 0.095, n, d, 0.004, M(ctx, '#c0b080', 0.3, 0.8))
        pot = M(ctx, '#e0dccc', 0.25)
        for i in range(n * 2):
            yy, dd = Y(0.06, 0.14)
            ctx.cyl(i * 0.5 + 0.41, yy + dd / 2, 0, 0.035, 0.07, pot, 10)
    else:
        rnd = random.Random(38 + j)
        for k in range(n * 3):
            x = rnd.random() * n; yy, dd = Y(rnd.random() * 0.85, 0.9)
            cbox(ctx, x, yy, 0.0, 0.08, 0.05, 0.012 + rnd.random() * 0.02, M(ctx, rnd.choice(['#4a4a40', '#6a6656', '#3a3a34']), 0.9), rot=rnd.random() * 180)


def floor_track(flip, mode='live'):
    def build(ctx, n):
        B = Batch(ctx)
        for j in range(n): track_row(ctx, B, n, j, flip, mode)
        B.done()
        ctx.plane(0, 0, n, n, stone_mat(ctx, 'trkBallast%s%d' % (mode, n), ['#2a2622', '#33302a', '#24211e', '#4a4238', '#2e2a26'] if mode != 'dead'
                                       else ['#2a2622', '#3a352c', '#2e2a24', '#4a4a40'], 18, n, bump=0.6), gz=-0.002)
    return build


def floor_stairs(up):
    def build(ctx, n):
        rnd = random.Random(39 if not up else 41)
        B = Batch(ctx)
        tread = nm(ctx, 'tread' + str(up), '#5c625e' if not up else '#5a605a', '#525854', scale=26, bump=0.2, period=None)
        side = M(ctx, '#30342f' if not up else '#2a2e2a', 0.8)
        nose = M(ctx, '#b8a650', 0.3, 0.85) if not up else M(ctx, '#e0c040', 0.45)
        worn = M(ctx, '#8a7a40', 0.4, 0.6)
        riser = M(ctx, '#272a28', 0.9) if not up else M(ctx, '#7a7e78', 0.7)
        t = 1 / 3
        for j in range(n * 3):
            y = j * t
            for i in range(n):
                B.box(i + 0.0, y, 0, 0.04, t, 0.03, side); B.box(i + 0.96, y, 0, 0.04, t, 0.03, side)
                if not up:
                    B.box(i + 0.04, y, 0.0, 0.92, 0.034, 0.03, nose if rnd.random() > 0.15 else worn, bevel=0.006)
                    B.box(i + 0.04, y + 0.034, 0, 0.92, 0.053, 0.006, riser)
                    B.box(i + 0.04, y + 0.087, 0, 0.92, t - 0.087, 0.02, tread, bevel=0.004)
                else:
                    B.box(i + 0.04, y, 0, 0.92, t - 0.087, 0.02, tread, bevel=0.004)
                    B.box(i + 0.04, y + t - 0.087, 0, 0.92, 0.053, 0.03, riser)
                    B.box(i + 0.04, y + t - 0.034, 0, 0.92, 0.034, 0.035, nose, bevel=0.006)
        B.done()
        ctx.plane(0, 0, n, n, M(ctx, '#202220', 0.95), gz=-0.001)
    return build


def floor_anchor(ctx, n):
    """2x2 mosaic medallion of the Anchors' anchor set into the terrazzo (n = 2)"""
    ctx.plane(0, 0, n, n, terrazzo_mat(ctx, 'terr%d' % n, '#565e58', '#606862', ['#8c9286', '#363c38', '#7a5c4a', '#9a9e92', '#4a524c'], n))
    joints(ctx, n, M(ctx, '#3a423e', 0.6), 1.0, 0.022)
    cx, cy = 1.0, 1.0
    red = M(ctx, '#c8102e', 0.3); white = M(ctx, '#f4f1e8', 0.3); dred = M(ctx, '#a80c26', 0.3)
    ctx.cyl(cx, cy, 0.0, 0.94, 0.008, M(ctx, '#2a2a28', 0.4), 64)
    ctx.cyl(cx, cy, 0.0, 0.92, 0.012, red, 64)
    ctx.cyl(cx, cy, 0.0, 0.84, 0.014, white, 64)
    ctx.cyl(cx, cy, 0.0, 0.78, 0.016, stone_mat(ctx, 'tess', ['#f4f1e8', '#e0dccc', '#ece8da', '#d8d4c4'], 30, n, rough=0.35, bump=0.25, gap='#a8a498', gapw=0.06), 64)
    k = 1 / math.sqrt(2)
    def P(a, b):  # a = screen-right metres, b = screen-down metres (anchor stands upright on screen)
        return (cx + (a + b) * k, cy + (b - a) * k)
    z = 0.017
    flat(ctx, [P(-0.05, -0.42), P(0.05, -0.42), P(0.05, 0.48), P(-0.05, 0.48)], z, dred)             # shank
    flat(ctx, [P(-0.26, -0.33), P(0.26, -0.33), P(0.26, -0.25), P(-0.26, -0.25)], z + 0.001, dred)   # stock
    for e in (-0.26, 0.26): ctx.cyl(*P(e, -0.29), z, 0.05, 0.002, dred, 12)
    ring = []
    for i in range(25):
        t = i / 24 * 2 * math.pi; ring.append(P(math.sin(t) * 0.12, -0.56 + math.cos(t) * 0.12))
    inner = []
    for i in range(25):
        t = i / 24 * 2 * math.pi; inner.append(P(math.sin(t) * 0.065, -0.56 + math.cos(t) * 0.065))
    for i in range(24):  # ring as quads
        flat(ctx, [ring[i], ring[i + 1], inner[i + 1], inner[i]], z, dred)
    # arms: arc of radius 0.42 around (0, 0.08), from -62 to +62 degrees below the centre
    R0, R1, c = 0.38, 0.46, 0.06
    arc_o, arc_i = [], []
    for i in range(21):
        t = math.radians(-62 + 124 * i / 20)
        arc_o.append(P(math.sin(t) * R1, c + math.cos(t) * R1)); arc_i.append(P(math.sin(t) * R0, c + math.cos(t) * R0))
    for i in range(20):
        flat(ctx, [arc_o[i], arc_o[i + 1], arc_i[i + 1], arc_i[i]], z, dred)
    for sgn in (-1, 1):   # flukes
        t = math.radians(62 * sgn)
        tip = (math.sin(t) * 0.42, c + math.cos(t) * 0.42)
        flat(ctx, [P(tip[0] - 0.02 * sgn, tip[1] + 0.06), P(tip[0] + 0.12 * sgn, tip[1] - 0.1), P(tip[0] - 0.1 * sgn, tip[1] - 0.04)], z + 0.001, dred)


# ================================================================== PROPS
OLC = '#120c14'


def p_striplight(ctx, var):
    hous = M(ctx, '#d8dcd8', 0.4, 0.3)
    wire = M(ctx, '#2a2a2a', 0.5)
    for x in (0.25, 0.95):
        beam(ctx, (x, 0.5, 3.12), (x, 0.5, 3.68), 0.006, wire, seg=6)
    ctx.box(0.18, 0.42, 3.09, 0.84, 0.16, 0.08, hous, bevel=0.01)
    ctx.box(0.2, 0.43, 3.07, 0.8, 0.14, 0.03, M(ctx, '#9aa0a0', 0.4, 0.5))
    beam(ctx, (0.21, 0.5, 3.05), (0.99, 0.5, 3.05), 0.042, ctx.mat('tube', _h('#eafff4'), 0.2, 0, _h('#eafff4'), 6.0), seg=12)
    for x in (0.19, 1.01):
        ctx.box(x - 0.015, 0.46, 3.0, 0.03, 0.08, 0.1, M(ctx, '#3a3a3a', 0.5))


def p_worklight(ctx, var):
    blk = M(ctx, '#2a2a2a', 0.5, 0.4)
    yel = M(ctx, '#e8c020', 0.45, 0.2)
    for ang in (90, 210, 330):
        a = math.radians(ang)
        beam(ctx, (0.5 + math.cos(a) * 0.3, 0.5 + math.sin(a) * 0.3, 0.0), (0.5, 0.5, 0.75), 0.014, blk, seg=6)
    beam(ctx, (0.5, 0.5, 0.7), (0.5, 0.5, 1.25), 0.025, yel)
    beam(ctx, (0.5, 0.5, 0.0), (0.5, 0.5, 0.05), 0.02, blk)
    # lamp head facing the camera
    cbox(ctx, 0.5, 0.5, 1.2, 0.5, 0.2, 0.44, M(ctx, '#d8a818', 0.45, 0.2), rot=45, bevel=0.02)
    fx, fy = face_pt(0.5, 0.5, 0.105, 0)
    cbox(ctx, fx, fy, 1.28, 0.36, 0.02, 0.28, ctx.mat('wlLens', _h('#fff8d0'), 0.2, 0, _h('#fff4c0'), 7.0), rot=45)
    gx, gy = face_pt(0.5, 0.5, 0.12, 0)
    for k in range(3):
        cbox(ctx, gx, gy, 1.31 + k * 0.08, 0.38, 0.012, 0.012, blk, rot=45)
    # yellow handle + cable
    beam(ctx, (0.5, 0.5, 1.68), (0.5, 0.5, 1.72), 0.12, yel, square=True)
    beam(ctx, (0.5, 0.5, 0.05), (0.85, 0.35, 0.0), 0.012, M(ctx, '#1a1a1a', 0.6))
    beam(ctx, (0.85, 0.35, 0.0), (1.0, 0.1, 0.0), 0.012, M(ctx, '#1a1a1a', 0.6))


def p_cableDrum(ctx, var):
    wood = wood_mat(ctx, 'drumWood', '#7a5a34', '#8a6a3e', axis='z', rough=0.85)
    cable = M(ctx, '#d8541a', 0.55)
    cable2 = M(ctx, '#b8441a', 0.6)
    cz = 0.46
    for x in (0.12, 0.86):
        disc_x(ctx, x, 0.5, cz, 0.46, 0.05, wood, seg=28)
    # cable windings (rings)
    for i in range(9):
        x = 0.17 + i * 0.075
        disc_x(ctx, x, 0.5, cz, 0.32, 0.07, cable if i % 2 else cable2, seg=24)
    disc_x(ctx, 0.5, 0.5, cz, 0.12, 0.8, M(ctx, '#3a2a18', 0.8), seg=12)
    bolt = M(ctx, '#4a4a4a', 0.4, 0.8)
    for k in range(6):
        a = k / 6 * 2 * math.pi
        disc_x(ctx, 0.89, 0.5 + math.cos(a) * 0.3, cz + math.sin(a) * 0.3 / UNIT, 0.025, 0.02, bolt, seg=8)
    disc_x(ctx, 0.895, 0.5, cz, 0.08, 0.02, M(ctx, '#2a1e14', 0.8), seg=16)
    # cable end trailing on the floor
    beam(ctx, (0.6, 0.82, 0.62), (0.75, 1.0, 0.03), 0.03, cable)


def p_gatePaddle(ctx, var):
    pad = alpha_mat(ctx, 'paddle', '#8a1a24', 0.82, 0.25, emit='#4a0a10', es=0.2)
    edge = M(ctx, '#e85a64', 0.4)
    hinge = M(ctx, '#3a3e44', 0.3, 0.6)
    for x in (0.06, 0.9):
        ctx.box(x, 0.3, 0.45, 0.04, 0.32, 0.4, pad, bevel=0.01)
        ctx.box(x, 0.3, 0.84, 0.04, 0.32, 0.02, edge)
        beam(ctx, (x + 0.02, 0.3, 0.42), (x + 0.02, 0.3, 0.88), 0.02, hinge)


def p_signal(ctx, var):
    post = M(ctx, '#5a5e66', 0.4, 0.6)
    blk = M(ctx, '#1a1a1a', 0.45, 0.2)
    ctx.cyl(0.5, 0.5, 0, 0.1, 0.12, M(ctx, '#3a3c40', 0.6, 0.4), 12)
    ctx.cyl(0.5, 0.5, 0, 0.045, 2.35, post, 12)
    cbox(ctx, 0.5, 0.5, 1.42, 0.42, 0.22, 1.0, blk, rot=45, bevel=0.03)
    cbox(ctx, 0.5, 0.5, 2.42, 0.36, 0.16, 0.06, post, rot=45)
    s = 0.13
    for k, (zt, col, lit) in enumerate(((2.218, '#3a0a0a', False), (1.968, '#3a2a0a', False), (1.718, '#3aff6a', True))):
        fx, fy = face_pt(0.5, 0.5, s, 0)
        gx, gy = face_pt(0.5, 0.5, s - 0.02, 0)
        mat = glow(ctx, '#3aff6a', 5.0) if lit else M(ctx, col, 0.15)
        beam(ctx, (gx, gy, zt), (fx, fy, zt), 0.088, mat, seg=18)
        hx, hy = face_pt(0.5, 0.5, s + 0.06, 0)
        quad(ctx, [(*face_pt(0.5, 0.5, s, -0.11), zt + 0.02), (*face_pt(0.5, 0.5, s, 0.11), zt + 0.02),
                   (*face_pt(0.5, 0.5, s + 0.1, 0.11), zt + 0.0), (*face_pt(0.5, 0.5, s + 0.1, -0.11), zt + 0.0)], blk, t=0.01)


def p_ticketMachine(ctx, var):
    c = var.get('color', '#a8202a')
    body = M(ctx, c, 0.35, 0.3)
    dk = M(ctx, '#3a3e44', 0.4, 0.4)
    ctx.box(0.15, 0.2, 0, 0.7, 0.6, 0.08, M(ctx, '#1a1a1e', 0.6))
    ctx.box(0.15, 0.2, 0.08, 0.7, 0.6, 1.54, body, bevel=0.03)
    ctx.box(0.12, 0.17, 1.62, 0.76, 0.66, 0.06, dk, bevel=0.02)
    # header: dark sign strip on the front (+y) with a lit edge
    ctx.box(0.15, 0.79, 1.68, 0.7, 0.04, 0.24, M(ctx, '#1a1a1e', 0.4), bevel=0.01)
    ctx.box(0.15, 0.2, 1.68, 0.7, 0.6, 0.24, body, bevel=0.02)
    ctx.box(0.17, 0.832, 1.885, 0.66, 0.004, 0.012, glow(ctx, '#7affd0', 2.0))
    # inset front panel
    ctx.box(0.2, 0.795, 0.25, 0.6, 0.012, 1.3, M(ctx, '#2a2c30', 0.35, 0.3), bevel=0.01)
    # screen
    ctx.box(0.25, 0.805, 1.1, 0.36, 0.01, 0.32, M(ctx, '#0e1a16', 0.1))
    ctx.box(0.265, 0.812, 1.12, 0.33, 0.006, 0.28, ctx.mat('tmScreen', _h('#4ad0a0'), 0.2, 0, _h('#7affd0'), 2.5))
    # keypad
    key = M(ctx, '#d8d8d0', 0.4)
    for i in range(3):
        for j in range(3):
            ctx.box(0.27 + i * 0.07, 0.81, 0.78 + j * 0.08, 0.05, 0.02, 0.055, key, bevel=0.004)
    # coin slot, card slot, ticket tray
    ctx.box(0.6, 0.81, 0.95, 0.12, 0.02, 0.14, M(ctx, '#8a8e94', 0.3, 0.8), bevel=0.006)
    ctx.box(0.635, 0.832, 1.01, 0.05, 0.004, 0.012, M(ctx, '#050505', 0.5))
    ctx.box(0.6, 0.81, 0.75, 0.12, 0.02, 0.12, M(ctx, '#8a8e94', 0.3, 0.8), bevel=0.006)
    ctx.box(0.3, 0.79, 0.35, 0.4, 0.03, 0.16, M(ctx, '#0a0a0c', 0.5), bevel=0.008)
    ctx.box(0.28, 0.82, 0.33, 0.44, 0.02, 0.03, M(ctx, '#8a8e94', 0.3, 0.8))
    # side vents on +x
    for k in range(5):
        ctx.box(0.85, 0.32 + k * 0.07, 0.3, 0.008, 0.04, 0.3, M(ctx, '#1a1a1e', 0.5))


def p_departures(ctx, var):
    hous = M(ctx, '#2a2c30', 0.4, 0.5)
    rod = M(ctx, '#3a3a3a', 0.4, 0.6)
    W = 2.36
    cbox(ctx, 0.5, 0.5, 2.92, W, 0.16, 0.72, hous, rot=45, bevel=0.025)
    fx, fy = face_pt(0.5, 0.5, 0.082, 0)
    cbox(ctx, fx, fy, 2.99 + 0.045, 2.2, 0.006, 0.55, M(ctx, '#0a0a08', 0.15), rot=45)
    for a in (-0.83, 0.83):
        px, py = face_pt(0.5, 0.5, 0.0, a)
        beam(ctx, (px, py, 3.62), (px, py, 4.25), 0.012, rod, seg=6)
        cbox(ctx, px, py, 4.22, 0.08, 0.08, 0.04, rod, rot=45)
    # amber LED pixel grain behind the (overlay) text
    rnd = random.Random(5)
    dim = M(ctx, '#2a1a08', 0.3)
    gx, gy = face_pt(0.5, 0.5, 0.086, 0)
    for k in range(3):
        cbox(ctx, gx, gy, 3.06 + k * 0.17, 2.1, 0.002, 0.008, dim, rot=45)


def p_rubble(ctx, var):
    rnd = random.Random(11)
    c = var.get('color', '#6a6056')
    mats = [nm(ctx, 'rub' + c, c, '#5a5048', scale=20, bump=0.6), wood_mat(ctx, 'rubBrick', '#8a4a38', '#7a3e30', axis='x', rough=0.9),
            nm(ctx, 'rubConc', '#7a7a70', '#5a5a52', scale=20, bump=0.6), M(ctx, '#d8d4c0', 0.3)]
    pieces = [(0.3, 0.35, 0.4, 0.3, 0.22), (0.68, 0.6, 0.35, 0.4, 0.3), (0.35, 0.7, 0.3, 0.3, 0.15), (0.7, 0.22, 0.3, 0.25, 0.12),
              (0.45, 0.45, 0.22, 0.2, 0.38), (0.8, 0.8, 0.18, 0.15, 0.1)]
    for i, (x, y, w, d, h) in enumerate(pieces):
        ob = cbox(ctx, x, y, 0.0, w, d, h, mats[i % 3], rot=rnd.random() * 90, bevel=0.03)
        ob.rotation_euler = Euler((math.radians(rnd.uniform(-12, 12)), math.radians(rnd.uniform(-12, 12)), math.radians(rnd.random() * 90)))
    for k in range(14):
        cbox(ctx, 0.15 + rnd.random() * 0.7, 0.15 + rnd.random() * 0.7, 0.0, 0.06, 0.05, 0.04, mats[rnd.randrange(4)], rot=rnd.random() * 90)
    # broken tile shards
    for k in range(5):
        cbox(ctx, 0.2 + rnd.random() * 0.6, 0.2 + rnd.random() * 0.6, 0.0, 0.12, 0.09, 0.015, mats[3], rot=rnd.random() * 90)


def p_hoarding(ctx, var):
    ply = wood_mat(ctx, 'ply', '#b08a58', '#c09868', axis='z', scale=2.5, rough=0.85)
    bat = wood_mat(ctx, 'batten', '#8a6a40', '#7a5a34', axis='x', rough=0.9)
    ctx.box(0, 0.3, 0, 1.0, 0.28, 2.2, M(ctx, '#7a5a34', 0.9))
    ctx.box(0.004, 0.58, 0.0, 0.492, 0.02, 2.2, ply)
    ctx.box(0.504, 0.58, 0.0, 0.492, 0.02, 2.2, ply)
    for z in (0.4, 1.7):
        ctx.box(0, 0.6, z, 1.0, 0.025, 0.1, bat)
    for x in (0.33, 0.66):
        ctx.box(x - 0.02, 0.6, 0.05, 0.04, 0.02, 2.1, bat)
    ctx.box(0, 0.3, 2.2, 1.0, 0.3, 0.04, bat)
    nail = M(ctx, '#3a3a3a', 0.4, 0.7)
    for (x, z) in ((0.05, 0.45), (0.95, 0.45), (0.05, 1.75), (0.95, 1.75), (0.5, 0.45), (0.5, 1.75)):
        ctx.box(x - 0.01, 0.625, z, 0.02, 0.006, 0.02, nail)
    # water stain at the bottom
    ctx.box(0.0, 0.601, 0.0, 1.0, 0.002, 0.12, M(ctx, '#6a5030', 0.95))


def p_rope(ctx, var):
    gold = M(ctx, '#c8a850', 0.22, 0.95)
    velvet = M(ctx, '#8a1a24', 0.8)
    for x in (0.1, 0.9):
        ctx.cyl(x, 0.5, 0, 0.09, 0.04, gold, 18)
        ctx.cyl(x, 0.5, 0.04, 0.022, 0.76, gold, 10)
        ctx.sphere(x, 0.5, 0.82, 0.04, gold)
    pts = []
    for i in range(11):
        u = i / 10
        pts.append((0.12 + 0.76 * u, 0.5, 0.75 - math.sin(u * math.pi) * 0.2))
    for i in range(10):
        beam(ctx, pts[i], pts[i + 1], 0.022, velvet, seg=8)


def p_door(ctx, var):
    c = var.get('color', '#4a2a18')
    steel = 'key' in var
    alongX = var.get('dir', 'x') != 'y'
    mat = M(ctx, c, 0.45, 0.4) if steel else wood_mat(ctx, 'door' + c, c, '#' + ''.join('%02x' % min(255, int(int(c[i:i + 2], 16) * 1.25)) for i in (1, 3, 5)), axis='z', rough=0.6)
    dk = M(ctx, '#' + ''.join('%02x' % int(int(c[i:i + 2], 16) * 0.6) for i in (1, 3, 5)), 0.6, 0.3 if steel else 0)
    gold = M(ctx, '#e8c040', 0.3, 0.9)
    def B(x, y, z, w, d, h, m, bev=0.0):
        if alongX: ctx.box(x, y, z, w, d, h, m, bevel=bev)
        else: ctx.box(y, x, z, d, w, h, m, bevel=bev)
    B(0.0, 0.4, 0, 1.0, 0.2, 2.6, mat, 0.01)
    if steel:
        B(0.08, 0.6, 0.08, 0.84, 0.012, 0.3, M(ctx, '#8a929a', 0.35, 0.8))       # kick plate
        B(0.3, 0.6, 1.75, 0.4, 0.014, 0.5, M(ctx, '#1a2228', 0.1, 0.2))          # wired vision panel
        B(0.33, 0.605, 1.78, 0.34, 0.014, 0.44, alpha_mat(ctx, 'wired', '#9ab0b8', 0.35, 0.1))
        for k in range(5): B(0.33 + k * 0.085, 0.616, 1.78, 0.004, 0.004, 0.44, M(ctx, '#4a4a4a', 0.5))
        B(0.1, 0.6, 2.42, 0.8, 0.012, 0.1, M(ctx, '#e8c020', 0.5))               # hazard header strip
        B(0.7, 0.6, 1.2, 0.2, 0.03, 0.06, M(ctx, '#c0c4c8', 0.25, 0.9))           # push bar handle
        # padlock + hasp
        B(0.44, 0.6, 1.24, 0.12, 0.03, 0.08, M(ctx, '#a8a8b0', 0.3, 0.9))
        B(0.46, 0.63, 1.08, 0.08, 0.05, 0.14, gold, 0.01)
        if alongX: beam(ctx, (0.475, 0.655, 1.22), (0.525, 0.655, 1.22), 0.012, M(ctx, '#a8a8b0', 0.3, 0.9))
    else:
        for (z0, z1) in ((0.25, 1.15), (1.35, 2.35)):
            for x0 in (0.15, 0.55):
                B(x0, 0.6, z0, 0.3, 0.008, z1 - z0, dk)
                B(x0 + 0.03, 0.6, z0 + 0.03, 0.24, 0.02, z1 - z0 - 0.06, mat, 0.015)
        if alongX: ctx.sphere(0.85, 0.62, 1.25, 0.035, gold)
        else: ctx.sphere(0.62, 0.85, 1.25, 0.035, gold)
        B(0.82, 0.6, 1.3, 0.06, 0.01, 0.12, gold)


def p_vending(ctx, var):
    c = '#1f3f8a'
    body = M(ctx, c, 0.3, 0.35)
    ctx.box(0.12, 0.2, 0, 0.76, 0.6, 0.06, M(ctx, '#121418', 0.6))
    ctx.box(0.12, 0.2, 0.06, 0.76, 0.6, 1.74, body, bevel=0.03)
    ctx.box(0.1, 0.18, 1.8, 0.8, 0.64, 0.05, M(ctx, '#3a4a6a', 0.35, 0.4), bevel=0.015)
    # lit logo panel top front
    ctx.box(0.16, 0.795, 1.58, 0.68, 0.012, 0.18, ctx.mat('vendLogo', _h('#c8102e'), 0.3, 0, _h('#ff4a5a'), 1.4))
    # display window (lit back + shelves of drinks) behind glass
    ctx.box(0.17, 0.72, 0.55, 0.5, 0.02, 1.0, ctx.mat('vendBack', _h('#c8e0ff'), 0.4, 0, _h('#d8ecff'), 1.6))
    ctx.box(0.15, 0.7, 0.53, 0.54, 0.1, 0.02, M(ctx, '#2a3040', 0.4))
    ctx.box(0.15, 0.7, 1.55, 0.54, 0.1, 0.02, M(ctx, '#2a3040', 0.4))
    cols = ['#e83a3a', '#e8c020', '#3ad070', '#f4f1e8', '#3ab8ff']
    for r in range(4):
        z = 0.58 + r * 0.245
        ctx.box(0.17, 0.74, z - 0.02, 0.5, 0.06, 0.015, M(ctx, '#8a929a', 0.3, 0.8))
        for i in range(4):
            col = cols[(i + r * 2) % 5]
            m = M(ctx, col, 0.25, 0.3)
            x = 0.23 + i * 0.12
            if r % 2:
                ctx.cyl(x, 0.765, z, 0.032, 0.14, m, 10); ctx.cyl(x, 0.765, z + 0.14, 0.012, 0.05, m, 8)
            else:
                ctx.cyl(x, 0.765, z, 0.035, 0.13, m, 12)
                ctx.cyl(x, 0.765, z + 0.13, 0.03, 0.01, M(ctx, '#c0c4c8', 0.3, 0.8), 12)
    ctx.box(0.16, 0.8, 0.54, 0.54, 0.01, 1.03, alpha_mat(ctx, 'vendGlass', '#d0e8ff', 0.16, 0.04))
    fr = M(ctx, '#0e1a3a', 0.4, 0.4)
    for (x, w) in ((0.15, 0.02), (0.69, 0.02)): ctx.box(x, 0.79, 0.52, w, 0.03, 1.06, fr)
    # selection panel, coin slot, delivery flap
    ctx.box(0.72, 0.79, 0.55, 0.13, 0.025, 1.0, M(ctx, '#2a3040', 0.35, 0.4))
    for k in range(6):
        ctx.box(0.745, 0.81, 1.05 + k * 0.07, 0.08, 0.012, 0.045, M(ctx, '#d8d8d0', 0.4))
    ctx.box(0.75, 0.81, 0.85, 0.07, 0.012, 0.12, M(ctx, '#8a929a', 0.3, 0.8))
    ctx.box(0.76, 0.818, 0.9, 0.05, 0.006, 0.01, M(ctx, '#050505', 0.5))
    ctx.box(0.2, 0.79, 0.15, 0.46, 0.03, 0.26, M(ctx, '#0a0a0c', 0.4))
    ctx.box(0.22, 0.81, 0.17, 0.42, 0.012, 0.2, M(ctx, '#2a3040', 0.3, 0.5))
    # dent + sticker
    ctx.box(0.88, 0.4, 0.9, 0.006, 0.18, 0.18, M(ctx, '#e8c020', 0.6))


def p_sleepers(ctx, var):
    rnd = random.Random(3)
    mats = [wood_mat(ctx, 'slpA', '#4a3624', '#3a2a1a', axis='x', rough=0.92, bump=0.5), wood_mat(ctx, 'slpB', '#56402a', '#46321e', axis='x', rough=0.92, bump=0.5)]
    for i in range(3):
        for k, y0 in enumerate((0.12 + (i % 2) * 0.06, 0.52 - (i % 2) * 0.06)):
            ox = rnd.uniform(-0.04, 0.04)
            ctx.box(0.05 + ox, y0, i * 0.2, 1.9, 0.32, 0.2, mats[(i + k) % 2], bevel=0.02)
    rust = M(ctx, '#6a3a20', 0.9, 0.3)
    for x in (0.4, 1.5):  # old rusty baseplates & spikes on top
        ctx.box(x, 0.2, 0.6, 0.18, 0.22, 0.015, rust)
        ctx.cyl(x + 0.04, 0.25, 0.6, 0.015, 0.05, rust, 6); ctx.cyl(x + 0.14, 0.37, 0.6, 0.015, 0.05, rust, 6)


def p_kiosk(ctx, var):
    c = '#2a5a3a'
    body = M(ctx, c, 0.45, 0.2)
    dk = M(ctx, '#1e3a28', 0.5, 0.2)
    ctx.box(0.1, 0.1, 0, 1.8, 1.8, 2.0, body, bevel=0.02)
    ctx.box(0.0, 0.0, 2.0, 2.0, 2.0, 0.18, M(ctx, '#1a2a20', 0.5, 0.2), bevel=0.02)
    ctx.box(0.08, 0.08, 2.18, 1.84, 1.84, 0.06, dk)
    # fascia boards (overlay writes the name) with a lit trim
    ctx.box(0.05, 1.98, 2.0, 1.9, 0.04, 0.18, M(ctx, '#14281c', 0.5))
    ctx.box(0.05, 2.0, 2.0, 1.9, 0.02, 0.012, glow(ctx, '#ffd23a', 1.5))
    # striped awning over the +y window
    for i in range(6):
        quad(ctx, [(0.1 + i * 0.3, 1.9, 1.85), (0.4 + i * 0.3, 1.9, 1.85), (0.4 + i * 0.3, 2.22, 1.55), (0.1 + i * 0.3, 2.22, 1.55)],
             M(ctx, '#f4f1e8' if i % 2 else '#c8102e', 0.7), t=0.01)
    # window with magazines + counter
    ctx.box(0.25, 1.88, 0.75, 1.5, 0.03, 0.7, M(ctx, '#1a1a14', 0.6))
    ctx.box(0.25, 1.86, 0.75, 1.5, 0.02, 0.7, ctx.mat('kioskIn', _h('#3a3020'), 0.8, 0, _h('#ffe0a0'), 0.6))
    cols = ['#e8c020', '#c8102e', '#3ab8ff', '#f4f1e8', '#e85aa0', '#5ad070']
    for row in range(2):
        for i in range(6):
            mag = ctx.mat('mag' + cols[(i + row) % 6], _h(cols[(i + row) % 6]), 0.5, 0, _h(cols[(i + row) % 6]), 0.25)
            ob = ctx.box(0.32 + i * 0.24, 1.9, 0.95 + row * 0.24, 0.18, 0.012, 0.2, mag)
    ctx.box(0.2, 1.88, 0.68, 1.6, 0.18, 0.08, wood_mat(ctx, 'kioskCounter', '#7a5a30', '#8a6a3a', axis='x'))
    for x in (0.25, 1.73): ctx.box(x, 1.89, 0.75, 0.02, 0.02, 0.7, M(ctx, '#0e1a12', 0.4))
    # sweet jars on the counter
    for i, cc in enumerate(['#e85aa0', '#e8c020', '#5ad070']):
        ctx.cyl(0.45 + i * 0.18, 1.98, 0.76, 0.05, 0.14, alpha_mat(ctx, 'jar' + cc, cc, 0.7, 0.1), 12)
    # headline A-board on the +x face
    ctx.box(1.9, 0.28, 0.25, 0.03, 0.94, 0.8, M(ctx, '#2a2a2a', 0.5))
    ctx.box(1.93, 0.3, 0.3, 0.012, 0.9, 0.7, M(ctx, '#f4f1e8', 0.6))
    # door on the +x side
    ctx.box(1.9, 1.3, 0.0, 0.02, 0.5, 1.8, dk)
    ctx.sphere(1.93, 1.36, 0.95, 0.025, M(ctx, '#c8a850', 0.3, 0.9))


def p_metroSign(ctx, var):
    post = M(ctx, '#3c4048', 0.4, 0.6)
    ctx.box(0.35, 0.35, 0, 0.3, 0.3, 0.12, M(ctx, '#2a2c30', 0.6, 0.3), bevel=0.02)
    ctx.cyl(0.5, 0.5, 0.0, 0.05, 2.3, post, 12)
    ctx.cyl(0.5, 0.5, 2.25, 0.07, 0.1, post, 12)
    cbox(ctx, 0.5, 0.5, 2.27, 1.42, 0.12, 0.72, M(ctx, '#f4f1e8', 0.4), rot=45, bevel=0.02)
    fx, fy = face_pt(0.5, 0.5, 0.062, 0)
    cbox(ctx, fx, fy, 2.33, 1.32, 0.006, 0.6, ctx.mat('metroBlue', _h('#1f3fa0'), 0.35, 0, _h('#2a50c8'), 0.7), rot=45)
    rx, ry = face_pt(0.5, 0.5, 0.068, -0.385)
    cbox(ctx, rx, ry, 2.39, 0.36, 0.006, 0.46, ctx.mat('metroRed', _h('#c8102e'), 0.35, 0, _h('#e01838'), 0.6), rot=45)
    # white 'M' made of four strokes
    wm = ctx.mat('metroWhite', _h('#ffffff'), 0.3, 0, _h('#ffffff'), 0.8)
    def S(a0, z0, a1, z1):
        p0 = face_pt(0.5, 0.5, 0.074, a0); p1 = face_pt(0.5, 0.5, 0.074, a1)
        beam(ctx, (*p0, z0), (*p1, z1), 0.022, wm, square=True)
    S(-0.5, 2.48, -0.5, 2.76); S(-0.27, 2.48, -0.27, 2.76); S(-0.5, 2.76, -0.385, 2.6); S(-0.385, 2.6, -0.27, 2.76)


def p_escalator(ctx, var):
    D = 8.0
    pit = M(ctx, '#1c1e20', 0.7)
    ctx.box(0, 0, -0.02, 2, D, 0.02, pit)
    for lane in (0, 1):
        x0 = lane + 0.12
        ctx.box(x0, 0, 0, 0.76, D, 0.01, M(ctx, '#3a3e44', 0.35, 0.6))
        B = Batch(ctx)
        k = 0
        x = x0 + 0.02
        while x < x0 + 0.74:
            B.box(x, 0.0, 0.01, 0.012, D, 0.008, M(ctx, '#6a7078', 0.3, 0.8))
            x += 0.035
        B.done()
        # comb plates
        for yy in (0.0, D - 0.15):
            ctx.box(x0 - 0.02, yy, 0.0, 0.8, 0.15, 0.03, M(ctx, '#b8a650', 0.35, 0.85), bevel=0.008)
        # yellow step edge demarcation strips along the sides
        ctx.box(x0, 0.15, 0.015, 0.03, D - 0.3, 0.008, M(ctx, '#e8c020', 0.5))
        ctx.box(x0 + 0.73, 0.15, 0.015, 0.03, D - 0.3, 0.008, M(ctx, '#e8c020', 0.5))
    # balustrades: stainless skirts, glass panels, black handrails, rounded newels
    st = M(ctx, '#9aa2aa', 0.3, 0.85)
    glass = alpha_mat(ctx, 'escGlass', '#9ad0c8', 0.22, 0.05)
    rail = M(ctx, '#111111', 0.35)
    for x in (0.04, 1.0, 1.96):
        ctx.box(x - 0.05, 0.0, 0.0, 0.1, D, 0.12, st, bevel=0.01)
        ctx.box(x - 0.008, 0.08, 0.12, 0.016, D - 0.16, 0.6, glass)
        beam(ctx, (x, 0.06, 0.75), (x, D - 0.06, 0.75), 0.035, rail, seg=10)
        for yy in (0.06, D - 0.06):
            ob = beam(ctx, (x, yy, 0.62), (x, yy, 0.75), 0.035, rail, seg=10)
        for yy in (0.4, D / 2, D - 0.4):
            ctx.box(x - 0.006, yy, 0.12, 0.012, 0.012, 0.6, st)
    # lights in the skirts
    for x in (0.08, 0.96, 1.04, 1.92):
        for k in range(8):
            ctx.box(x - 0.006, 0.5 + k * 1.0, 0.04, 0.012, 0.12, 0.04, glow(ctx, '#c8ffe6', 2.0))


def p_guitarCase(ctx, var):
    shell = M(ctx, '#141416', 0.45)
    lining = nm(ctx, 'plush', '#6a1a3a', '#5a1430', scale=60, rough=0.95, bump=0.3)
    gold = M(ctx, '#c8a030', 0.25, 0.9)
    # case outline: body bulbs + neck (along x), open lid propped behind (-y)
    def outline(s):
        pts = []
        for i in range(13):
            t = math.pi / 2 + i / 12 * math.pi
            pts.append((0.32 + math.cos(t) * 0.17 * s, 0.5 + math.sin(t) * 0.2 * s))
        pts += [(0.5, 0.5 - 0.14 * s), (0.86, 0.5 - 0.07 * s), (0.86, 0.5 + 0.07 * s), (0.5, 0.5 + 0.14 * s)]
        return pts
    prism(ctx, outline(1.0), 0, 0.09, shell)
    flat(ctx, outline(0.85), 0.092, lining)
    # lid propped open behind (-y)
    quad(ctx, [(0.15, 0.3, 0.09), (0.86, 0.3, 0.09), (0.86, 0.22, 0.42), (0.15, 0.22, 0.42)], shell, t=0.02)
    quad(ctx, [(0.18, 0.31, 0.12), (0.83, 0.31, 0.12), (0.83, 0.245, 0.39), (0.18, 0.245, 0.39)], lining, t=0.005)
    rnd = random.Random(7)
    for k in range(9):
        ctx.cyl(0.24 + rnd.random() * 0.4, 0.4 + rnd.random() * 0.2, 0.093, 0.022, 0.006, gold if k % 3 else M(ctx, '#c0c4c8', 0.3, 0.9), 12)
    ctx.box(0.55, 0.52, 0.093, 0.12, 0.07, 0.004, M(ctx, '#c8d8b0', 0.8))   # a banknote
    for x in (0.4, 0.6):
        ctx.box(x, 0.68, 0.03, 0.04, 0.03, 0.04, gold)


def desk_z(y):
    """height (units) of the control desk's sloped panel at game y"""
    return 1.15 - (y - 0.25) * (0.3 / 0.35)


def p_controlDesk(ctx, var):
    body = M(ctx, '#5a6a64', 0.45, 0.3)
    dk = M(ctx, '#3a4642', 0.5, 0.3)
    ctx.box(0.05, 0.25, 0, 1.9, 0.6, 0.06, M(ctx, '#1e2420', 0.7))
    ctx.box(0.05, 0.25, 0.06, 1.9, 0.6, 0.74, body, bevel=0.02)
    ctx.box(0.03, 0.6, 0.8, 1.94, 0.28, 0.04, M(ctx, '#3a4440', 0.4), bevel=0.01)       # writing ledge
    # sloped panel (faces the operator / camera)
    prism_pts = None
    bm = bmesh.new()
    def V(x, y, z): return bm.verts.new(G(x, y, z))
    a = [V(0.05, 0.25, 0.8), V(1.95, 0.25, 0.8), V(1.95, 0.6, 0.8), V(0.05, 0.6, 0.8),
         V(0.05, 0.25, desk_z(0.25)), V(1.95, 0.25, desk_z(0.25)), V(1.95, 0.6, desk_z(0.6)), V(0.05, 0.6, desk_z(0.6))]
    for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([a[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _mk(ctx, bm, dk, 'deskPanel')
    off = 0.012
    quad(ctx, [(0.1, 0.29, desk_z(0.29) + off), (1.9, 0.29, desk_z(0.29) + off), (1.9, 0.57, desk_z(0.57) + off), (0.1, 0.57, desk_z(0.57) + off)],
         M(ctx, '#1a2a24', 0.25))
    # static track diagram (white line + platforms), overlay animates the dots/trains
    wl = glow(ctx, '#e8e8e0', 1.6)
    y = 0.42; z = desk_z(y) + off + 0.004
    quad(ctx, [(0.2, y - 0.008, z), (1.8, y - 0.008, z), (1.8, y + 0.008, z), (0.2, y + 0.008, z)], wl)
    y2 = 0.36; z2 = desk_z(y2) + off + 0.004
    quad(ctx, [(0.6, y2 - 0.006, z2), (1.3, y2 - 0.006, z2), (1.3, y2 + 0.006, z2), (0.6, y2 + 0.006, z2)], glow(ctx, '#7affd0', 1.2))
    # knobs & switches along the front lip
    knob = M(ctx, '#d8d8d0', 0.4)
    for i in range(10):
        x = 0.2 + i * 0.17
        ctx.cyl(x, 0.66, 0.84, 0.018, 0.04, knob if i % 3 else M(ctx, '#c01818', 0.4), 8)
    # CRT monitor on the back + telephone
    cbox(ctx, 0.45, 0.13, 1.15, 0.42, 0.24, 0.4, M(ctx, '#c8c4b4', 0.5), bevel=0.03)
    ctx.box(0.28, 0.24, 1.21, 0.34, 0.012, 0.28, ctx.mat('crt', _h('#103020'), 0.2, 0, _h('#3aff8a'), 0.9))
    ctx.box(1.3, 0.62, 0.84, 0.22, 0.16, 0.06, M(ctx, '#2a2a2a', 0.4), bevel=0.01)
    beam(ctx, (1.3, 0.7, 0.93), (1.52, 0.7, 0.93), 0.025, M(ctx, '#2a2a2a', 0.4))
    # mug of tea
    ctx.cyl(1.78, 0.74, 0.84, 0.045, 0.16, M(ctx, '#f4f1e8', 0.3), 14)
    ctx.cyl(1.78, 0.74, 0.99, 0.038, 0.01, M(ctx, '#8a5a30', 0.2), 14)
    beam(ctx, (1.83, 0.74, 0.88), (1.83, 0.74, 0.96), 0.012, M(ctx, '#f4f1e8', 0.3))


def p_lever(ctx, var):
    red = M(ctx, '#5a1a1a', 0.5, 0.3)
    ctx.box(0.25, 0.3, 0, 0.5, 0.4, 0.55, red, bevel=0.02)
    ctx.box(0.22, 0.27, 0.55, 0.56, 0.46, 0.08, M(ctx, '#3a3a40', 0.4, 0.6), bevel=0.015)
    # quadrant plate (in the screen plane the overlay's lever arm swings in)
    q = M(ctx, '#2a2a2e', 0.45, 0.7)
    pts = []
    for i in range(13):
        t = math.radians(-35 + 90 * i / 12)
        pts.append((math.sin(t) * 0.42, math.cos(t) * 0.42))
    for i in range(12):
        a0, z0 = pts[i]; a1, z1 = pts[i + 1]
        p0 = face_pt(0.5, 0.5, 0.0, a0); p1 = face_pt(0.5, 0.5, 0.0, a1)
        quad(ctx, [(*face_pt(0.5, 0.5, 0.0, a0 * 0.8), 0.63 + z0 * 0.8 / UNIT), (*p0, 0.63 + z0 / UNIT), (*p1, 0.63 + z1 / UNIT), (*face_pt(0.5, 0.5, 0.0, a1 * 0.8), 0.63 + z1 * 0.8 / UNIT)], q, t=0.02)
    ctx.cyl(0.5, 0.5, 0.6, 0.05, 0.06, M(ctx, '#c8c8c8', 0.3, 0.9), 12)
    # enamel label plate on the front
    ctx.box(0.3, 0.7, 0.3, 0.3, 0.008, 0.14, M(ctx, '#1a1a1a', 0.5))


def p_trolley(ctx, var):
    yel = M(ctx, '#d8a818', 0.45, 0.2)
    blk = M(ctx, '#0c0c0e', 0.6)
    hub = M(ctx, '#8a8a8a', 0.3, 0.8)
    for (x, y) in ((0.3, 0.08), (1.7, 0.08), (0.3, 0.92), (1.7, 0.92)):
        out = 1 if y > 0.5 else -1
        beam(ctx, (x, y - 0.03, 0.15), (x, y + 0.03, 0.15), 0.15, blk, seg=18)
        beam(ctx, (x, y - 0.03 * out - 0.015, 0.15), (x, y - 0.03 * out + 0.0, 0.15), 0.18, M(ctx, '#2a2a2c', 0.5, 0.5), seg=18)
        beam(ctx, (x, y + 0.03 * out, 0.15), (x, y + 0.045 * out, 0.15), 0.06, hub, seg=12)
    beam(ctx, (0.3, 0.05, 0.15), (0.3, 0.95, 0.15), 0.025, hub); beam(ctx, (1.7, 0.05, 0.15), (1.7, 0.95, 0.15), 0.025, hub)
    ctx.box(0.05, 0.1, 0.18, 1.9, 0.8, 0.22, yel, bevel=0.02)
    stripes = stripe_mat(ctx, 'trolStripe', '#1a1a1a', '#d8b020', 6.0, zk=1.0, duty=0.5, rough=0.5)
    for x in (0.03, 1.95): ctx.box(x, 0.1, 0.2, 0.02, 0.8, 0.16, stripes)
    ctx.box(0.2, 0.2, 0.4, 0.5, 0.6, 0.35, M(ctx, '#8a2a1a', 0.45, 0.3), bevel=0.02)     # tool box
    ctx.box(0.18, 0.18, 0.75, 0.54, 0.64, 0.04, M(ctx, '#6a2010', 0.45, 0.3), bevel=0.01)
    ctx.box(0.35, 0.45, 0.79, 0.2, 0.1, 0.04, M(ctx, '#2a2a2a', 0.4))
    ctx.box(0.9, 0.25, 0.4, 0.9, 0.5, 0.2, M(ctx, '#5a5e66', 0.4, 0.5), bevel=0.015)       # generator / compressor
    for k in range(6): ctx.box(0.95 + k * 0.14, 0.75, 0.44, 0.08, 0.006, 0.12, M(ctx, '#2a2c30', 0.5))
    # push handles + coiled hose
    beam(ctx, (1.95, 0.2, 0.4), (2.0, 0.2, 0.95), 0.018, yel); beam(ctx, (1.95, 0.8, 0.4), (2.0, 0.8, 0.95), 0.018, yel)
    beam(ctx, (2.0, 0.2, 0.95), (2.0, 0.8, 0.95), 0.02, blk)
    for k in range(3): ctx.cyl(1.35, 0.5, 0.6 + k * 0.04, 0.16 - k * 0.01, 0.04, M(ctx, '#1a1a1a', 0.6), 16)
    # NM-07 plate on the +y side
    ctx.box(0.85, 0.9, 0.22, 0.42, 0.006, 0.12, M(ctx, '#e8e4d0', 0.5))


# ================================================================== PIECES
PIECES = [
    # walls (heights exactly as the level uses them)
    dict(kind='wall', id='underground_tiles', heights=[1.2, 3, 4], variants=6, build=tile_wall(), padX=6, padBottom=4),
    dict(kind='wall', id='underground_tilesGrim', heights=[3], variants=6, build=tile_wall(grim=True), padX=6, padBottom=4),
    dict(kind='wall', id='underground_ticketWindow', heights=[4], variants=2, build=tile_wall(window=True), padX=6, padBottom=4),
    dict(kind='wall', id='underground_gateline', heights=[1], variants=1, build=gateline, padX=4, padBottom=4),
    dict(kind='wall', id='underground_counter', heights=[1.1], variants=3, build=counter, padX=6, padBottom=6),
    dict(kind='wall', id='underground_lockers', heights=[2.2], variants=3, build=lockers, padX=4, padBottom=4),
    dict(kind='wall', id='underground_duct', heights=[1.6], variants=1, build=duct, padX=4, padBottom=4),
    dict(kind='wall', id='underground_tunnel', heights=[1.2, 3], variants=4, build=tunnel_wall, padX=8, padBottom=6),
    dict(kind='wall', id='underground_hazard', heights=[1.2, 3.2], variants=4, build=hazard_wall, padX=8, padBottom=4),
    dict(kind='wall', id='underground_brickSoot', heights=[1.2, 3.5], variants=4, build=brick_soot, padX=6, padBottom=4),
    dict(kind='wall', id='underground_brickBlocked', heights=[3.5, 4], variants=2, build=brick_blocked, padX=4, padBottom=4),
    dict(kind='wall', id='railing', heights=[1.1], variants=1, build=w_railing),
    # floors
    dict(kind='floor', id='underground_terrazzo', n=4, build=floor_terrazzo),
    dict(kind='floor', id='underground_corridor', n=4, build=floor_corridor),
    dict(kind='floor', id='underground_platform', n=4, build=floor_platform),
    dict(kind='floor', id='underground_edgeS', n=4, build=floor_edge(False)),
    dict(kind='floor', id='underground_edgeN', n=4, build=floor_edge(True)),
    dict(kind='floor', id='underground_trackA', n=4, build=floor_track(False)),
    dict(kind='floor', id='underground_trackB', n=4, build=floor_track(True)),
    dict(kind='floor', id='underground_crossA', n=4, build=floor_track(False, 'cross')),
    dict(kind='floor', id='underground_crossB', n=4, build=floor_track(True, 'cross')),
    dict(kind='floor', id='underground_deadTrackA', n=4, build=floor_track(False, 'dead')),
    dict(kind='floor', id='underground_deadTrackB', n=4, build=floor_track(True, 'dead')),
    dict(kind='floor', id='underground_stairs', n=4, build=floor_stairs(False)),
    dict(kind='floor', id='underground_stairsUp', n=4, build=floor_stairs(True)),
    dict(kind='floor', id='underground_ballast', n=4, build=floor_ballast),
    dict(kind='floor', id='underground_depot', n=4, build=floor_depot),
    dict(kind='floor', id='underground_hatch', n=4, build=floor_hatch),
    dict(kind='floor', id='underground_lino', n=4, build=floor_lino),
    dict(kind='floor', id='underground_dusty', n=4, build=floor_dusty),
    dict(kind='floor', id='underground_dustEdge', n=4, build=floor_edge(False, dusty=True)),
    dict(kind='floor', id='underground_anchor', n=2, build=floor_anchor),
    # props
    dict(kind='prop', id='underground_striplight', size=(1, 1, 3.75), build=p_striplight, pad=8),
    dict(kind='prop', id='underground_worklight', size=(1, 1, 1.8), build=p_worklight, pad=8),
    dict(kind='prop', id='underground_cableDrum', size=(1, 1, 1.0), build=p_cableDrum, pad=8),
    dict(kind='prop', id='underground_gatePaddle', size=(1, 1, 1.0), build=p_gatePaddle, pad=6),
    dict(kind='prop', id='underground_signal', size=(1, 1, 2.6), build=p_signal, pad=8),
    dict(kind='prop', id='underground_ticketMachine', size=(1, 1, 1.95), build=p_ticketMachine, pad=8,
         variants=[{'color': '#a8202a'}, {'color': '#1f4fb4'}]),
    dict(kind='prop', id='underground_departures', size=(1, 1, 4.3), build=p_departures, pad=40),
    dict(kind='prop', id='rubble', size=(1, 1, 0.5), build=p_rubble, pad=8),
    dict(kind='prop', id='underground_hoarding', size=(1, 1, 2.3), build=p_hoarding, pad=6),
    dict(kind='prop', id='underground_rope', size=(1, 1, 1.0), build=p_rope, pad=6),
    dict(kind='prop', id='door', size=(1, 1, 2.7), build=p_door, pad=6,
         variants=[{'dir': 'x', 'color': '#3a2a1a'}, {'dir': 'x', 'color': '#5a6a64', 'key': 'staff'}, {'dir': 'y', 'color': '#4a2a18'}]),
    dict(kind='prop', id='underground_vending', size=(1, 1, 1.9), build=p_vending, pad=6),
    dict(kind='prop', id='underground_sleepers', size=(2, 1, 0.7), build=p_sleepers, pad=8),
    dict(kind='prop', id='underground_kiosk', size=(2, 2, 2.3), build=p_kiosk, pad=10),
    dict(kind='prop', id='underground_metroSign', size=(1, 1, 3.0), build=p_metroSign, pad=14),
    dict(kind='prop', id='underground_escalator', size=(2, 8, 0.8), build=p_escalator, pad=8),
    dict(kind='prop', id='underground_guitarCase', size=(1, 1, 0.5), build=p_guitarCase, pad=6),
    dict(kind='prop', id='underground_controlDesk', size=(2, 1, 1.6), build=p_controlDesk, pad=8),
    dict(kind='prop', id='underground_lever', size=(1, 1, 1.1), build=p_lever, pad=8),
    dict(kind='prop', id='underground_trolley', size=(2, 1, 1.0), build=p_trolley, pad=8),
]
