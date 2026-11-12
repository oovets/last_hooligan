# THE LAST STAND (Level 8, theme 'laststand') environment pieces for scripts/blender/render_env.py.
# Night outside the (fictional) Nordhamn Arena: monumental facade, inner stands, balustrades, ticket office,
# fountains, painted club crest, police vans, burnt-out car, floodlights, statues, fireworks.
# Game coords: x,y in tiles (1 tile = 1 m), z in height units (ctx.UNIT metres). Visible faces: +x (screen right), +y (screen left).
import os, sys, math, random
import bpy, bmesh
from mathutils import Vector, Matrix, Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from env_common import _h  # noqa: E402

UNIT = 1.0206
RED, WHITE, NAVY, GOLD = '#c8102e', '#f4f1e8', '#1a1a40', '#d4af37'


def G(gx, gy, gz=0.0):
    return Vector((gy, gx, gz * UNIT))


def hsh(*a):
    return random.Random(hash(a) & 0xffffffff).random()


# ------------------------------------------------------------------ helpers
class Batch:
    """Accumulates many boxes/spheres into one mesh object per material (fast for crowds, grilles, bars)."""
    def __init__(self, ctx):
        self.ctx = ctx; self.bms = {}

    def _bm(self, mat, smooth=False):
        k = (mat.name, smooth)
        if k not in self.bms: self.bms[k] = (mat, smooth, bmesh.new())
        return self.bms[k][2]

    def box(self, gx, gy, gz, w, d, h, mat):
        bm = self._bm(mat)
        M = Matrix.Translation(G(gx + w / 2, gy + d / 2, gz + h / 2)) @ Matrix.Diagonal((d, w, max(h * UNIT, 1e-4), 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)

    def sphere(self, gx, gy, gz, r, mat, seg=8, sz=1.0):
        bm = self._bm(mat, True)
        M = Matrix.Translation(G(gx, gy, gz)) @ Matrix.Diagonal((1, 1, sz, 1))
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2 + 1), radius=r, matrix=M)

    def cyl(self, gx, gy, gz, r, h, mat, seg=10, r2=None):
        bm = self._bm(mat, True)
        M = Matrix.Translation(G(gx, gy, gz) + Vector((0, 0, h * UNIT / 2)))
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h * UNIT, matrix=M)

    def rod(self, a, b, r, mat, seg=6):
        """cylinder between two game-coord points a=(x,y,z) b=(x,y,z)"""
        pa, pb = G(*a), G(*b)
        v = pb - pa
        L = v.length
        if L < 1e-6: return
        bm = self._bm(mat, True)
        q = v.to_track_quat('Z', 'Y')
        M = Matrix.Translation(pa + v / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r, depth=L, matrix=M)

    def flush(self, M=None):
        obs = []
        for (name, smooth), (mat, sm, bm) in self.bms.items():
            if M is not None: bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
            me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
            if smooth:
                for p in me.polygons: p.use_smooth = True
            me.materials.append(mat)
            ob = bpy.data.objects.new(name, me); self.ctx.link(ob); obs.append(ob)
        self.bms = {}
        return obs


def text(ctx, s, gx, gy, gz, size, mat, face='y', extrude=0.003):
    """flat text on a visible face: 'y' (+y face, reads along +x) or 'x' (+x face, reads along -y). (gx,gy,gz) = centre."""
    cu = bpy.data.curves.new('txt', 'FONT'); cu.body = s; cu.size = size
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = extrude
    try: cu.font = bpy.data.fonts.load('<builtin>')
    except Exception: pass
    ob = bpy.data.objects.new('txt', cu); ctx.link(ob); cu.materials.append(mat)
    R = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))) if face == 'y' else Matrix(((-1, 0, 0), (0, 0, 1), (0, 1, 0)))
    ob.matrix_world = Matrix.Translation(G(gx, gy, gz)) @ R.to_4x4()
    return ob


def hcyl(ctx, gx, gy, gz, r, L, mat, axis='x', seg=12):
    """horizontal cylinder whose axis starts at game (gx,gy,gz) and runs L metres along +x or +y"""
    ob = ctx.cyl(gx, gy, gz, r, L / UNIT, mat, seg)
    ob.location = G(gx, gy, gz)
    ob.rotation_euler = (-math.pi / 2, 0, 0) if axis == 'x' else (0, math.pi / 2, 0)
    return ob


def M_(ctx, key, c, rough=0.6, metal=0.0, emit=None, es=1.0):
    return ctx.mat(key, _h(c), rough, metal, emit=_h(emit) if emit else None, emit_strength=es)


def nm(ctx, key, c1, c2, scale=10, rough=0.85, bump=0.25, detail=6, period=None):
    return ctx.noise_mat(key, _h(c1), _h(c2), scale=scale, rough=rough, bump=bump, detail=detail, period=period)


class NB:
    """tiny node-graph builder for custom shaders"""
    def __init__(self, ctx, key):
        self.m, self.N, self.L, self.b, co = ctx.nodemat(key)
        self.tc = co.node
        sep = self.N.new('ShaderNodeSeparateXYZ'); self.L.new(self.tc.outputs['Object'], sep.inputs[0])
        self.gx, self.gy, self.gz = sep.outputs[1], sep.outputs[0], sep.outputs[2]   # game x = obj Y, game y = obj X

    def _in(self, sock, v):
        if isinstance(v, (int, float)): sock.default_value = v
        else: self.L.new(v, sock)

    def math(self, op, a, b=0.0, clamp=False):
        n = self.N.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
        self._in(n.inputs[0], a); self._in(n.inputs[1], b); return n.outputs[0]

    def vec(self, x, y, z=0.0):
        n = self.N.new('ShaderNodeCombineXYZ'); self._in(n.inputs[0], x); self._in(n.inputs[1], y); self._in(n.inputs[2], z); return n.outputs[0]

    def mix(self, fac, a, b, blend='MIX'):
        n = self.N.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = blend
        self._in(n.inputs['Factor'], fac)
        if isinstance(a, tuple): n.inputs['A'].default_value = (*_srgb(a), 1)
        else: self.L.new(a, n.inputs['A'])
        if isinstance(b, tuple): n.inputs['B'].default_value = (*_srgb(b), 1)
        else: self.L.new(b, n.inputs['B'])
        return n.outputs['Result']

    def brick(self, vec, c1, c2, mortar, bw, bh, ms=0.012, bias=0.0, smooth=0.1):
        br = self.N.new('ShaderNodeTexBrick')
        br.inputs['Color1'].default_value = (*_srgb(_h(c1)), 1); br.inputs['Color2'].default_value = (*_srgb(_h(c2)), 1)
        br.inputs['Mortar'].default_value = (*_srgb(_h(mortar)), 1)
        br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = ms
        br.inputs['Mortar Smooth'].default_value = smooth; br.inputs['Bias'].default_value = bias
        br.inputs['Brick Width'].default_value = bw; br.inputs['Row Height'].default_value = bh
        br.offset = 0.5; br.offset_frequency = 2
        self.L.new(vec, br.inputs['Vector'])
        return br.outputs['Color'], br.outputs['Fac']

    def pnoise(self, ctx, period, scale, detail=4.0):
        nz = self.N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'
        nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
        v, w = ctx.periodic_vector(self.N, self.L, self.tc, period)
        self.L.new(v, nz.inputs['Vector']); self.L.new(w, nz.inputs['W'])
        return nz.outputs['Fac']

    def pvoronoi(self, ctx, period, scale):
        vo = self.N.new('ShaderNodeTexVoronoi'); vo.voronoi_dimensions = '4D'; vo.feature = 'F1'
        vo.inputs['Scale'].default_value = scale
        v, w = ctx.periodic_vector(self.N, self.L, self.tc, period)
        self.L.new(v, vo.inputs['Vector']); self.L.new(w, vo.inputs['W'])
        return vo.outputs['Distance']

    def ramp(self, fac, stops, interp='LINEAR'):
        r = self.N.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = interp
        els = r.color_ramp.elements
        while len(els) < len(stops): els.new(0.5)
        for e, (p, c) in zip(els, stops):
            e.position = p; e.color = (*_srgb(_h(c)), 1)
        self._in(r.inputs['Fac'], fac)
        return r.outputs['Color']

    def bump(self, h, strength=0.3, dist=0.02):
        bp = self.N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength
        try: bp.inputs['Distance'].default_value = dist
        except Exception: pass
        self.L.new(h, bp.inputs['Height']); self.L.new(bp.outputs['Normal'], self.b.inputs['Normal'])

    def out(self, color, rough=0.8, emit=None, es=1.0, metal=0.0):
        self.L.new(color, self.b.inputs['Base Color'])
        self._in(self.b.inputs['Roughness'], rough)
        self.b.inputs['Metallic'].default_value = metal
        if emit is not None:
            self.L.new(emit, self.b.inputs['Emission Color']); self.b.inputs['Emission Strength'].default_value = es
        return self.m


def _srgb(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ================================================================== FLOORS
CREST_X, CREST_Y, CREST_R = 21.0, 37.0, 6.4


def plaza_nodes(ctx, key):
    """granite-sett pavers 0.5 x 0.25 m (stretcher bond along x); red soldier-course accent bands every 6 tiles"""
    nb = NB(ctx, key)
    v = nb.vec(nb.gx, nb.gy)
    col, fac = nb.brick(v, '#463c42', '#6e6062', '#221e24', 0.5, 0.25, ms=0.02, bias=0.0)
    colr, _ = nb.brick(nb.vec(nb.math('ADD', nb.gx, 13.0), nb.gy), '#62202a', '#86303a', '#221e24', 0.5, 0.25, ms=0.02)
    # x-band (strip along y): bricks laid the other way so the band never cuts a paver
    vs = nb.vec(nb.gy, nb.gx)
    cols, facs = nb.brick(vs, '#62202a', '#86303a', '#221e24', 0.5, 0.25, ms=0.02)
    mx = nb.math('LESS_THAN', nb.math('FLOORED_MODULO', nb.gx, 6.0), 0.5)
    my = nb.math('LESS_THAN', nb.math('FLOORED_MODULO', nb.gy, 6.0), 0.5)
    c = nb.mix(my, col, colr)
    c = nb.mix(mx, c, cols)
    fac = nb.math('ADD', nb.math('MULTIPLY', fac, nb.math('SUBTRACT', 1.0, mx)), nb.math('MULTIPLY', facs, mx))
    grime = nb.pnoise(ctx, 12, 1.2, 3)
    c = nb.mix(nb.math('MULTIPLY', nb.math('SUBTRACT', grime, 0.35, True), 0.9), c, _h('#2e282c'))
    nb.bump(nb.math('SUBTRACT', 1.0, fac), 0.45)
    return nb, c, fac


def floor_plaza(ctx, n):
    nb, c, fac = plaza_nodes(ctx, 'ls_plaza')
    ctx.plane(0, 0, n, n, nb.out(c, rough=0.75))


def crest_image(S):
    import numpy as np
    res = 1100
    t = (np.arange(res) + 0.5) / res
    gxv = (t - 0.5) * 2 * S            # game dx along image columns
    gyv = (t - 0.5) * 2 * S            # game dy along image rows
    dx, dy = np.meshgrid(gxv, gyv)     # arrays [row=dy, col=dx]
    R = CREST_R
    d = np.hypot(dx, dy)
    a = (dx - dy) * 0.7071; b = (dx + dy) * 0.7071
    C = lambda h: np.array(_h(h))
    out = np.zeros((res, res, 3)); out[:] = C(RED)
    ang = np.arctan2(b, a)
    frac = ((ang + np.pi) / (np.pi * 2)) * 8 + 0.5
    seg = np.floor(frac).astype(int) % 8
    edge = np.abs(frac - np.round(frac)) < 0.04
    ring = (d > R - 2.0) & (d <= R - 0.5)
    out[ring & (seg % 2 == 1)] = C(RED)
    out[ring & (seg % 2 == 0)] = C(WHITE)
    # gold stars on the white segments
    rr = R - 1.25
    sa = np.round((ang + np.pi) / (np.pi / 4)) * (np.pi / 4) - np.pi
    sx, sy = np.cos(sa) * rr, np.sin(sa) * rr
    q = np.abs(a - sx) + np.abs(b - sy) * 0.8
    star = (q < 0.32) | ((np.abs(a - sx) < 0.08) & (np.abs(b - sy) < 0.5)) | ((np.abs(b - sy) < 0.08) & (np.abs(a - sx) < 0.5))
    out[ring & (seg % 2 == 0) & ~edge & star] = C(GOLD)
    out[ring & edge] = C(NAVY)
    out[(d > R - 0.5) & (d <= R - 0.35)] = C(GOLD)
    out[(d > R - 0.35)] = C(NAVY)
    out[(d > R - 2.25) & (d <= R - 2.0)] = C(NAVY)
    inner = d <= R - 2.25
    shank = (np.abs(a) < 0.26) & (b > -2.4) & (b < 2.3)
    ringD = np.hypot(a, b + 2.85); rng = (ringD < 0.62) & (ringD > 0.3)
    stock = (np.abs(b + 1.75) < 0.2) & (np.abs(a) < 1.45)
    stockEnd = np.hypot(np.abs(a) - 1.5, b + 1.75) < 0.28
    armD = np.hypot(a, b - 0.2); arms = (armD > 1.85) & (armD < 2.3) & (b > 0.75)
    fl = (np.abs(a) > 1.5) & (np.abs(a) < 2.35) & (b > 0.35) & (b < 1.25) & ((b - 0.35) > (2.35 - np.abs(a)) * 0.6)
    anchor = shank | rng | stock | stockEnd | arms | fl
    shadow = (np.abs(a) < 0.4) & (b > -2.5) & (b < 2.4) & ~anchor
    out[inner & shadow] = C('#8e0c22')
    out[inner & anchor] = C(WHITE)
    alpha = np.clip((R - d) * 40 + 0.5, 0, 1)
    img = bpy.data.images.new('ls_crest', res, res, alpha=True)
    px = np.concatenate([out, alpha[..., None]], axis=2).astype(np.float32)
    img.pixels.foreach_set(px.ravel())
    return img


def floor_crest(ctx, n):
    # n = 24: the crest centre sits at (21 mod 24, 37 mod 24); plaza pavers (period 12) everywhere else
    nb, c, fac = plaza_nodes(ctx, 'ls_crestfloor')
    S = CREST_R + 0.3
    img = crest_image(S)
    cx, cy = CREST_X % n, CREST_Y % n
    tex = nb.N.new('ShaderNodeTexImage'); tex.image = img; tex.extension = 'CLIP'; tex.interpolation = 'Linear'
    wrap = lambda g, c0: nb.math('SUBTRACT', nb.math('FLOORED_MODULO', nb.math('ADD', g, n / 2 - c0), float(n)), n / 2)
    u = nb.math('ADD', nb.math('DIVIDE', wrap(nb.gx, cx), 2 * S), 0.5)
    v = nb.math('ADD', nb.math('DIVIDE', wrap(nb.gy, cy), 2 * S), 0.5)
    nb.L.new(nb.vec(u, v), tex.inputs['Vector'])
    paint = nb.mix(nb.math('MULTIPLY', fac, 0.55), tex.outputs['Color'], _h('#2a1c22'))
    wear = nb.pnoise(ctx, n, 4.0, 6)
    wearf = nb.math('MULTIPLY', nb.math('SUBTRACT', wear, 0.58, True), 3.0, True)
    a = nb.math('MULTIPLY', tex.outputs['Alpha'], nb.math('SUBTRACT', 1.0, nb.math('MULTIPLY', wearf, 0.7)))
    col = nb.mix(a, c, paint)
    rough = nb.math('ADD', 0.8, nb.math('MULTIPLY', tex.outputs['Alpha'], -0.35))
    ctx.plane(0, 0, n, n, nb.out(col, rough=rough))


def floor_granite(ctx, n):
    grout = M_(ctx, 'ls_grgrout', '#1c1a22', 0.95)
    ctx.plane(0, 0, n, n, grout, gz=-0.002)
    mats = []
    for k, (c, rough) in enumerate([('#4b4752', 0.32), ('#46424e', 0.35), ('#504a57', 0.3), ('#5a3238', 0.28)]):
        nb = NB(ctx, 'ls_granite%d' % k)
        f1 = nb.pnoise(ctx, n, 90.0, 2)
        f2 = nb.pnoise(ctx, n, 6.0, 4)
        cc = nb.ramp(f1, [(0.30, '#2c2832'), (0.38, c), (0.62, c), (0.70, '#9a8c96')])
        cc = nb.mix(nb.math('MULTIPLY', nb.math('SUBTRACT', f2, 0.4, True), 0.6), cc, _h('#2c2832'))
        nb.bump(f1, 0.08)
        mats.append(nb.out(cc, rough=rough))
    for i in range(n):
        for j in range(n):
            m = mats[3] if (i + j) % 4 == 0 else mats[int(hsh('gr', i, j) * 3)]
            ctx.box(i + 0.025, j + 0.025, 0, 0.95, 0.95, 0.03, m, bevel=0.012)


def floor_steps(ctx, n):
    # two steps per tile; each half-tile: tread (0..0.6), nosing (0.6..0.68), riser (0.68..1) toward +y -> rises toward -y
    tread = [nm(ctx, 'ls_tread%d' % k, c, '#4a4652', scale=30, bump=0.15, period=n) for k, c in enumerate(['#5c5864', '#56525e'])]
    nose = M_(ctx, 'ls_nose', '#9a96a2', 0.35)
    riserA = M_(ctx, 'ls_riser', '#34303a', 0.9)
    riserB = M_(ctx, 'ls_riserB', '#26222c', 0.9)
    runner = nm(ctx, 'ls_runner', '#7e1e2a', '#6a1a24', scale=40, bump=0.3, period=n)
    runnerN = M_(ctx, 'ls_runnerN', '#b8484a', 0.6)
    brass = M_(ctx, 'ls_brass', '#c8a040', 0.3, 0.9)
    for j in range(n * 2):
        y0 = j * 0.5
        for i in range(n):
            ctx.box(i, y0, 0, 1, 0.3, 0.02, tread[int(hsh('st', i, j) * 2)])
        hcyl(ctx, 0, y0 + 0.32, 0.015, 0.025, n, nose, 'x', 8)
        ctx.box(0, y0 + 0.34, 0, n, 0.08, 0.012, riserA)
        ctx.box(0, y0 + 0.42, 0, n, 0.08, 0.008, riserB)
        # worn red runner up the middle of the flight (world tiles 27..28 -> 3..4 mod 12)
        ctx.box(3.0, y0, 0, 2.0, 0.3, 0.03, runner)
        ctx.box(3.0, y0 + 0.29, 0.0, 2.0, 0.05, 0.045, runnerN)
        for xx in (3.0, 4.96): ctx.box(xx, y0 + 0.27, 0.03, 0.04, 0.03, 0.02, brass)


def floor_tunnel(ctx, n):
    ctx.plane(0, 0, n, n, nm(ctx, 'ls_tunnel', '#2c2a32', '#3e3c46', scale=18, bump=0.3, period=n))
    joint = M_(ctx, 'ls_tjoint', '#1e1c24', 0.95)
    chan = M_(ctx, 'ls_drain', '#0c0b10', 0.9)
    steel = M_(ctx, 'ls_grate', '#4a4852', 0.45, 0.7)
    for i in range(n):
        ctx.box(i - 0.015, 0, 0, 0.03, n, 0.004, joint)
    for j in range(n):
        ctx.box(0, j + 0.44, 0, n, 0.12, 0.006, chan)
        ctx.box(0, j + 0.43, 0, n, 0.012, 0.012, steel); ctx.box(0, j + 0.558, 0, n, 0.012, 0.012, steel)
        for k in range(n * 8):
            ctx.box(k * 0.125 + 0.075, j + 0.44, 0, 0.05, 0.12, 0.01, steel)


def floor_lino(ctx, n):
    ctx.plane(0, 0, n, n, M_(ctx, 'ls_linogrout', '#3a4238', 0.9), gz=-0.002)
    tiles = [nm(ctx, 'ls_linoA', '#5c6a5a', '#526050', scale=14, rough=0.45, bump=0.08, period=n),
             nm(ctx, 'ls_linoB', '#6e7a64', '#64705a', scale=14, rough=0.45, bump=0.08, period=n)]
    burn = M_(ctx, 'ls_fagburn', '#6a4a30', 0.9)
    for i in range(n * 2):
        for j in range(n * 2):
            par = (i % 2 + j % 2 + i // 2 + j // 2) & 1
            ctx.box(i * 0.5 + 0.0125, j * 0.5 + 0.0125, 0, 0.475, 0.475, 0.012, tiles[par], bevel=0.004)
            if hsh('fb', i, j) < 0.06:
                ctx.cyl(i * 0.5 + 0.1 + hsh('fx', i, j) * 0.3, j * 0.5 + 0.1 + hsh('fy', i, j) * 0.3, 0.012, 0.012, 0.002, burn, 8)


def floor_scorched(ctx, n):
    nb = NB(ctx, 'ls_scorched')
    f = nb.pnoise(ctx, n, 2.0, 6)
    g = nb.pnoise(ctx, n, 40.0, 2)
    c = nb.ramp(f, [(0.35, '#141216'), (0.55, '#24222a'), (0.7, '#2e2a30')])
    c = nb.mix(nb.math('GREATER_THAN', g, 0.66), c, _h('#4a4446'))
    vo = nb.pvoronoi(ctx, n, 6.0)
    ember = nb.math('MULTIPLY', nb.math('LESS_THAN', vo, 0.05), nb.math('GREATER_THAN', f, 0.5))
    em = nb.mix(ember, _h('#000000'), _h('#ff5a10'))
    c = nb.mix(ember, c, _h('#7a3010'))
    nb.bump(nb.math('ADD', f, nb.math('MULTIPLY', g, 0.3)), 0.6)
    ctx.plane(0, 0, n, n, nb.out(c, rough=0.95, emit=em, es=3.0))


def floor_water(ctx, n):
    nb = NB(ctx, 'ls_water')
    f = nb.pnoise(ctx, n, 2.2, 3)
    g = nb.pnoise(ctx, n, 7.0, 2)
    w = nb.math('ADD', f, nb.math('MULTIPLY', g, 0.35))
    c = nb.ramp(w, [(0.42, '#0c2230'), (0.58, '#163e52'), (0.72, '#24607a'), (0.8, '#5aa8c4')])
    hi = nb.math('GREATER_THAN', w, 0.84)
    em = nb.mix(hi, nb.mix(0.0, c, c), _h('#c8f0ff'))
    nb.bump(w, 0.5)
    ctx.plane(0, 0, n, n, nb.out(em, rough=0.12, emit=em, es=0.45))


# ================================================================== WALLS
def facade_panel_mat(ctx):
    return nm(ctx, 'ls_fpanel', '#5c5a64', '#686670', scale=16, bump=0.2)


def facade(ctx, h, v):
    H = h
    gran = nm(ctx, 'ls_plinth', '#3e3a44', '#4a4650', scale=40, rough=0.4, bump=0.1)
    granT = M_(ctx, 'ls_plinthT', '#7a7680', 0.35)
    body = M_(ctx, 'ls_fbody', '#2a2830', 0.9)
    panel = facade_panel_mat(ctx)
    joint = M_(ctx, 'ls_fjoint', '#3a3842', 0.9)
    red = M_(ctx, 'ls_clad', RED, 0.35, 0.3)
    white = M_(ctx, 'ls_cladW', WHITE, 0.4)
    steel = M_(ctx, 'ls_coping', '#a8a8b4', 0.3, 0.8)
    roof = nm(ctx, 'ls_roof', '#2e2c36', '#3a3842', scale=30, bump=0.4)
    glassD = M_(ctx, 'ls_glassD', '#141c2c', 0.08, 0.3)
    glassL = M_(ctx, 'ls_glassL', '#5a3a14', 0.15, 0, emit='#ffd890', es=2.0)
    glassL2 = M_(ctx, 'ls_glassL2', '#5a3a14', 0.15, 0, emit='#e8b060', es=1.4)
    frame = M_(ctx, 'ls_wframe', '#24222a', 0.4, 0.6)
    B = Batch(ctx)
    # core block (recessed 0.05 on the visible faces)
    ctx.box(0, 0, 0, 0.95, 0.95, H - 0.02, body)
    # granite plinth (slightly proud) + lighter weathering top
    ctx.box(0, 0, 0, 1.02, 1.02, 0.95, gran)
    ctx.box(0, 0, 0.93, 1.035, 1.035, 0.07, granT, bevel=0.01)
    zb = H - 0.8                     # top of the ribbed panel zone
    segs = [(1.0, 1.4), (1.4, 2.8), (2.8, zb)] if zb > 2.8 else [(1.0, zb)]
    rnd = random.Random(v * 31 + 7)

    def face_panels(face, windows, glasswall=False):
        # face 'y': along x at y≈1 ; face 'x': along y at x≈1
        def P(a, z0, w, hh, m, depth=0.04, off=0.0):
            if face == 'y': B.box(a, 0.95 + off, z0, w, depth, hh, m)
            else: B.box(0.95 + off, a, z0, depth, w, hh, m)
        for k in range(4):
            a0 = k * 0.25 + 1 / 16
            for (z0, z1) in segs:
                inwin = any(a0 + 0.09 > w0 and a0 + 0.09 < w1 for (w0, w1) in windows)
                if glasswall and 0.06 < a0 < 0.94: inwin = True
                if not inwin:
                    P(a0, z0 + 0.02, 0.1875, z1 - z0 - 0.04, panel, 0.05)
        for (z0, z1) in segs:
            P(0, z1 - 0.02, 1.0, 0.04, joint, 0.015)
        # windows
        for wi, (w0, w1) in enumerate(windows if not glasswall else [(0.06, 0.94)]):
            P(w0 - 0.02, 1.05, 0.02, zb - 1.1, frame, 0.05)
            P(w1, 1.05, 0.02, zb - 1.1, frame, 0.05)
            for fi, (z0, z1) in enumerate(segs):
                lit = hsh('fw', v, fi, wi, face) < 0.6
                m = (glassL if fi % 2 == 0 else glassL2) if lit else glassD
                P(w0, z0 + 0.05, w1 - w0, z1 - z0 - 0.1, m, 0.02, 0.01)
                P(w0, z1 - 0.05, w1 - w0, 0.06, frame, 0.04)
                if glasswall:
                    for mm in (0.29, 0.5, 0.71):
                        P(mm - 0.012, z0, 0.024, z1 - z0, frame, 0.045)
                elif w1 - w0 > 0.2:
                    P((w0 + w1) / 2 - 0.012, z0, 0.024, z1 - z0, frame, 0.045)
                if lit and rnd.random() < 0.4 and not glasswall:   # blind half drawn
                    P(w0, z1 - 0.05 - (z1 - z0) * 0.3, w1 - w0, (z1 - z0) * 0.25, M_(ctx, 'ls_blind', '#c8b890', 0.9), 0.015, 0.02)

    kind = v % 6
    wins = {0: [(0.4, 0.6)], 1: [(0.13, 0.3), (0.7, 0.87)], 2: [], 3: [], 4: [], 5: [(0.4, 0.6)]}[kind]
    for face in ('x', 'y'):
        face_panels(face, wins, glasswall=(kind == 3))
    # dark shadow gap + red/white club cladding band + steel coping
    ctx.box(0, 0, zb, 0.97, 0.97, 0.1, M_(ctx, 'ls_gap', '#1e1a22', 0.9))
    ctx.box(0, 0, zb + 0.1, 1.0, 1.0, 0.55, red, bevel=0.006)
    ctx.box(0, 0, zb + 0.29, 1.008, 1.008, 0.1, white)
    for a in (0.0, 0.5):
        B.box(a, 0.995, zb + 0.1, 0.012, 0.012, 0.55, M_(ctx, 'ls_cladseam', '#7a0a1a', 0.5))
        B.box(0.995, a, zb + 0.1, 0.012, 0.012, 0.55, M_(ctx, 'ls_cladseam', '#7a0a1a', 0.5))
    # coping as a perimeter frame around a gravel roof membrane
    ctx.box(0, 0, H - 0.15, 1.02, 1.02, 0.1, steel, bevel=0.008)
    for (x, y, w, d) in ((0, 0, 1.02, 0.07), (0, 0.95, 1.02, 0.07), (0, 0, 0.07, 1.02), (0.95, 0, 0.07, 1.02)):
        B.box(x, y, H - 0.05, w, d, 0.05, steel)
    ctx.box(0.07, 0.07, H - 0.06, 0.88, 0.88, 0.04, roof)
    if kind == 4:
        # monumental column in front of the panels on each visible face
        colm = nm(ctx, 'ls_column', '#b4b2bc', '#a4a2ac', scale=20, rough=0.6, bump=0.15)
        for (cx, cy) in ((0.5, 1.02), (1.02, 0.5)):
            ctx.cyl(cx, cy, 1.0, 0.13, zb - 1.15, colm, 20)
            for z0 in (0.95, zb - 0.2):
                ctx.box(cx - 0.17, cy - 0.17, z0, 0.34, 0.34, 0.15 if z0 < 1 else 0.2, colm, bevel=0.01)
            for k in range(8):   # flutes
                a = k / 8 * math.tau
                B.box(cx + math.cos(a) * 0.125 - 0.006, cy + math.sin(a) * 0.125 - 0.006, 1.15, 0.012, 0.012, zb - 1.4, M_(ctx, 'ls_flute', '#5a5864', 0.8))
    if kind == 2:
        # louvred plant-room vents
        lv = M_(ctx, 'ls_louvre', '#3a3a44', 0.5, 0.6)
        for face in ('x', 'y'):
            for k in range(7):
                z = 3.0 + k * 0.15
                if face == 'y': B.box(0.3, 0.98, z, 0.4, 0.05, 0.05, lv)
                else: B.box(0.98, 0.3, z, 0.05, 0.4, 0.05, lv)
    if kind == 5:
        # steel service door + green exit sign on the +y face, wall-pack lamp on the +x face
        door = M_(ctx, 'ls_door', '#4a4c56', 0.45, 0.6)
        B.box(0.28, 0.99, 0, 0.44, 0.05, 2.1, door)
        B.box(0.26, 1.0, 2.1, 0.48, 0.05, 0.06, frame)
        B.box(0.32, 1.035, 1.0, 0.1, 0.02, 0.03, steel)
        B.box(0.4, 1.0, 2.2, 0.2, 0.04, 0.12, M_(ctx, 'ls_exit', '#1a8a3a', 0.4, 0, emit='#3aff7a', es=2.5))
        B.box(0.995, 0.4, 3.4, 0.08, 0.2, 0.14, M_(ctx, 'ls_wallpack', '#2a2a30', 0.5, 0.4))
        B.box(1.07, 0.42, 3.4, 0.01, 0.16, 0.04, M_(ctx, 'ls_wallpackL', '#fff2c0', 0.3, 0, emit='#fff0c0', es=6))
    B.flush()


def stand(ctx, h, v):
    H = h
    body = M_(ctx, 'ls_standbody', '#22202a', 0.9)
    step = nm(ctx, 'ls_standstep', '#4a4652', '#3e3a46', scale=20, bump=0.2)
    riser = M_(ctx, 'ls_standriser', '#2a2026', 0.9)
    skins = [M_(ctx, 'ls_skin%d' % k, c, 0.7) for k, c in enumerate(['#e2a97a', '#d49a6a', '#f0c098', '#b87a50', '#8a5636'])]
    shirts = {'r': M_(ctx, 'ls_shR', RED, 0.75), 'w': M_(ctx, 'ls_shW', WHITE, 0.75), 'd': M_(ctx, 'ls_shD', '#2a2a34', 0.8), 'm': M_(ctx, 'ls_shM', '#7a1020', 0.8)}
    hair = M_(ctx, 'ls_hair', '#2a2026', 0.9)
    B = Batch(ctx)
    z0b = 0.5
    zt = H - 0.4
    nrows = int((zt - z0b) / 0.25 + 1e-6)
    ctx.box(0, 0, 0, 0.78, 0.78, H, body)
    rnd = random.Random(v * 101 + 3)
    for face in ('x', 'y'):
        def BX(a, dep, z, w, dd, hh, m):
            # a = along-face position, dep = depth coordinate (towards the face at 1.0)
            if face == 'y': B.box(a, dep, z, w, dd, hh, m)
            else: B.box(dep, a, z, dd, w, hh, m)
        def SP(a, dep, z, r, m):
            if face == 'y': B.sphere(a, dep, z, r, m, 7)
            else: B.sphere(dep, a, z, r, m, 7)
        # pitch-side wall + advertising boards
        BX(0, 0.78, 0, 1, 0.24, 0.26, M_(ctx, 'ls_pitchwall', '#1e3a22', 0.8))
        for k in range(6):
            a = k / 6
            m = M_(ctx, 'ls_adR', RED, 0.5, 0, emit=RED, es=0.25) if (k + v) % 2 == 0 else M_(ctx, 'ls_adW', WHITE, 0.5, 0, emit=WHITE, es=0.15)
            BX(a + 0.005, 1.0, 0.26, 1 / 6 - 0.01, 0.03, 0.24, m)
        for r in range(nrows):
            z = z0b + r * 0.25
            s = r * 0.012
            front = 1.0 - s
            BX(0, 0.78, z, 1, front - 0.78 - 0.06, 0.25, riser)
            BX(0, front - 0.07, z, 1, 0.07, 0.035, step)
            # fans standing on the terrace
            nf = 7
            for k in range(nf):
                if rnd.random() < 0.08: continue
                a = (k + 0.5) / nf + (rnd.random() - 0.5) * 0.04
                hv = rnd.random()
                sh = shirts['r'] if hv < 0.45 else shirts['w'] if hv < 0.8 else shirts['d'] if hv < 0.9 else shirts['m']
                dep = front - 0.05
                BX(a - 0.045, dep - 0.03, z + 0.035, 0.09, 0.05, 0.11, sh)
                hz = z + 0.035 + 0.11 + 0.04
                sk = rnd.choice(skins)
                SP(a, dep - 0.005, hz, 0.036, sk if rnd.random() > 0.15 else hair)
                if rnd.random() < 0.18:   # arms up
                    BX(a - 0.05, dep - 0.01, hz - 0.02, 0.016, 0.016, 0.13, sk)
                    BX(a + 0.034, dep - 0.01, hz - 0.02, 0.016, 0.016, 0.13, sk)
            # scarf held up across a few fans
            if rnd.random() < 0.25:
                a0 = rnd.random() * 0.5
                for q in range(6):
                    BX(a0 + q * 0.06, front - 0.06, z + 0.2, 0.06, 0.012, 0.035, shirts['r'] if q % 2 == 0 else shirts['w'])
        # roof fascia with floodlight dots
        BX(0, 0.78, zt, 1, 0.26, 0.4, M_(ctx, 'ls_rooffascia', '#2a2a34', 0.5, 0.4))
        BX(0, 1.0, zt + 0.32, 1, 0.04, 0.08, M_(ctx, 'ls_roofedge', '#5a5a66', 0.4, 0.6))
        for k in range(4):
            BX(k * 0.25 + 0.06, 1.02, zt + 0.12, 0.1, 0.02, 0.1, M_(ctx, 'ls_fldot', '#ffffff', 0.3, 0, emit='#f0f6ff', es=5))
    ctx.box(0, 0, H - 0.02, 1.04, 1.04, 0.02, nm(ctx, 'ls_standroof', '#24222c', '#2c2a34', scale=50, bump=0.3))
    B.flush()


def balustrade(ctx, h, v):
    stone = nm(ctx, 'ls_balstone', '#9a96a2', '#8a8692', scale=25, rough=0.7, bump=0.2)
    dark = nm(ctx, 'ls_balbase', '#5e5a66', '#56525e', scale=25, rough=0.8, bump=0.2)
    cap = nm(ctx, 'ls_balcap', '#a8a4b0', '#b4b0bc', scale=18, rough=0.55, bump=0.1)
    ctx.box(0, 0, 0, 1, 1, 0.2, dark, bevel=0.01)
    ctx.box(0, 0, h - 0.2, 1, 1, 0.2, cap, bevel=0.015)
    ctx.box(0.06, 0.06, h - 0.03, 0.88, 0.88, 0.04, M_(ctx, 'ls_balcapin', '#8a8692', 0.7))
    B = Batch(ctx)
    pos = [0.125, 0.375, 0.625, 0.875]
    zb, zt = 0.2, h - 0.2
    L = zt - zb
    for (x, y) in [(p, 0.9) for p in pos] + [(0.9, p) for p in pos[:3]] + [(p, 0.1) for p in pos[1:3]] + [(0.1, p) for p in pos[:3]]:
        B.cyl(x, y, zb, 0.05, 0.06, stone, 10)
        B.cyl(x, y, zb + 0.06, 0.035, L * 0.18, stone, 10, r2=0.05)
        B.sphere(x, y, zb + L * 0.48, 0.065, stone, 10, sz=1.7)
        B.cyl(x, y, zb + L * 0.62, 0.05, L * 0.28, stone, 10, r2=0.03)
        B.cyl(x, y, zt - 0.07, 0.03, 0.07, stone, 10, r2=0.05)
    B.flush()


def officewall(ctx, h, v):
    blk = ctx.brick_mat('ls_officeblk', _h('#c4bca4'), _h('#bab29a'), _h('#8e8672'), brick_w=0.5, brick_h=0.255, mortar_size=0.014, rough=0.8, bump=0.25, seed_off=v * 0.7)
    ctx.box(0, 0, 0.5, 1, 1, h - 0.6, blk)
    ctx.box(0, 0, 0, 1.01, 1.01, 0.5, M_(ctx, 'ls_skirt', '#2a4a3a', 0.5))
    ctx.box(0, 0, 0.46, 1.015, 1.015, 0.05, M_(ctx, 'ls_skirtT', '#1a3226', 0.5))
    ctx.box(0, 0, h - 1.0, 1.008, 1.008, 0.2, M_(ctx, 'ls_offred', RED, 0.5))
    ctx.box(0, 0, h - 0.1, 1.01, 1.01, 0.1, M_(ctx, 'ls_offcap', '#e0d8c0', 0.6), bevel=0.005)
    ctx.box(0.03, 0.03, h - 0.02, 0.94, 0.94, 0.02, M_(ctx, 'ls_offtop', '#5a5650', 0.9))
    k = v % 4
    if k == 1:   # notice board
        ctx.box(0.25, 1.0, 0.95, 0.5, 0.02, 0.55, M_(ctx, 'ls_cork', '#9a7448', 0.95))
        for (a, c) in ((0.3, '#f4f1e8'), (0.47, '#ffe14a'), (0.6, '#f4f1e8')):
            ctx.box(a, 1.02, 1.05 + hsh(a, v) * 0.15, 0.12, 0.005, 0.22, M_(ctx, 'ls_note' + c, c, 0.9))
    elif k == 2:  # fire extinguisher + sign
        ctx.cyl(1.07, 0.5, 0.55, 0.05, 0.4, M_(ctx, 'ls_ext', '#c01818', 0.35, 0.2), 12)
        ctx.box(1.0, 0.44, 1.05, 0.02, 0.12, 0.12, M_(ctx, 'ls_extsign', '#e02020', 0.5))
        ctx.box(0.4, 1.0, 1.05, 0.2, 0.02, 0.2, M_(ctx, 'ls_rota', '#f4f1e8', 0.9))
    elif k == 3:  # cable trunking + conduit
        tr = M_(ctx, 'ls_trunk', '#e8e4d8', 0.5)
        ctx.box(0, 1.0, h - 1.2, 1, 0.03, 0.08, tr); ctx.box(1.0, 0, h - 1.2, 0.03, 1, 0.08, tr)
        ctx.box(0.7, 1.0, 0.5, 0.03, 0.03, h - 1.7, tr)


def ticketfront(ctx, h, v):
    lit = v != 3
    red = M_(ctx, 'ls_tfred', RED, 0.4, 0.2)
    dk = M_(ctx, 'ls_tfdark', '#2a2830', 0.6, 0.3)
    plinth = M_(ctx, 'ls_tfplinth', '#3a3640', 0.7)
    grille = M_(ctx, 'ls_tfgrille', '#6a6872', 0.35, 0.8)
    room = M_(ctx, 'ls_tfroom', '#8a6a40', 0.8, 0, emit='#ffd890', es=1.4) if lit else M_(ctx, 'ls_tfroomD', '#141a26', 0.8)
    glass = M_(ctx, 'ls_tfglass', '#2a3a48', 0.04, 0.2, emit='#ffe6b0', es=0.35) if lit else M_(ctx, 'ls_tfglassD', '#1c2230', 0.05, 0.3)
    B = Batch(ctx)
    # lit booth interior behind the glass
    ctx.box(0, 0, 0, 0.82, 0.82, h, room)
    ctx.box(0, 0, 0, 1.0, 1.0, 0.5, plinth)
    ctx.box(0, 0, 0.48, 1.04, 1.04, 0.05, M_(ctx, 'ls_tfledge', '#8a8692', 0.4, 0.4), bevel=0.006)
    ctx.box(0, 0, h - 0.55, 1.0, 1.0, 0.55, red, bevel=0.006)
    ctx.box(0, 0, h - 0.6, 1.0, 1.0, 0.08, M_(ctx, 'ls_tfred2', '#7a0a1a', 0.5))
    ctx.box(0, 0, h - 0.1, 1.01, 1.01, 0.1, M_(ctx, 'ls_tftop', '#e0e0e8', 0.4, 0.5))
    ctx.box(0.03, 0.03, h - 0.02, 0.94, 0.94, 0.03, M_(ctx, 'ls_tfroof', '#3a3640', 0.9))
    for face in ('x', 'y'):
        def BX(a, dep, z, w, dd, hh, m):
            if face == 'y': B.box(a, dep, z, w, dd, hh, m)
            else: B.box(dep, a, z, dd, w, hh, m)
        BX(0, 0.82, 0.5, 0.09, 0.18, h - 1.05, dk)
        BX(0.91, 0.82, 0.5, 0.09, 0.18, h - 1.05, dk)
        BX(0, 0.82, h - 0.62, 1, 0.18, 0.08, dk)
        BX(0.09, 0.93, 0.53, 0.82, 0.01, h - 1.15, glass)
        for k in range(1, 6):
            BX(0.09 + k * 0.82 / 6 - 0.01, 0.95, 0.53, 0.02, 0.02, h - 1.15, grille)
        BX(0.09, 0.95, 1.2, 0.82, 0.02, 0.02, grille)
        BX(0.3, 0.92, 0.53, 0.4, 0.1, 0.05, M_(ctx, 'ls_tfslot', '#8a6a40', 0.5, 0.3))   # ticket slot ledge
        BX(0.42, 0.94, 0.58, 0.16, 0.01, 0.12, M_(ctx, 'ls_tfspeak', '#1a1a20', 0.5, 0.5))
    B.flush()


def counter(ctx, h, v):
    ctx.box(0, 0, 0, 1, 1, 0.1, M_(ctx, 'ls_ctkick', '#3a3632', 0.8))
    ctx.box(0.02, 0.02, 0.1, 0.96, 0.96, h - 0.25, M_(ctx, 'ls_ctface', '#d8d0b8', 0.7))
    ctx.box(0.02, 0.02, h - 0.62, 0.98, 0.98, 0.14, M_(ctx, 'ls_ctred', RED, 0.5))
    wood = ctx.brick_mat('ls_ctwood', _h('#7a4a28'), _h('#6e4222'), _h('#5a3418'), brick_w=0.9, brick_h=0.1, mortar_size=0.004, rough=0.45, bump=0.1)
    ctx.box(0, 0, h - 0.15, 1.03, 1.03, 0.15, wood, bevel=0.01)
    ctx.box(0, 0, h - 0.16, 1.035, 1.035, 0.03, M_(ctx, 'ls_ctedge', '#5a3418', 0.5))
    if v % 2:
        ctx.box(0.3, 0.3, h, 0.25, 0.18, 0.04, M_(ctx, 'ls_tickets', '#f0e8c8', 0.8))
        ctx.box(0.62, 0.35, h, 0.2, 0.2, 0.14, M_(ctx, 'ls_till', '#2a2a30', 0.4, 0.4))


def basin(ctx, h, v):
    stone = nm(ctx, 'ls_basin', '#8a8682', '#7e7a76', scale=22, rough=0.7, bump=0.2)
    ctx.box(0, 0, 0, 0.98, 0.98, h - 0.12, stone)
    moss = nm(ctx, 'ls_moss', '#4a6a4a', '#2e4a30', scale=40, rough=0.9, bump=0.4)
    ctx.box(0, 0, 0, 0.99, 0.99, 0.12, moss)
    lip = nm(ctx, 'ls_basinlip', '#d0ccc8', '#bcb8b4', scale=26, rough=0.55, bump=0.12)
    ctx.box(0, 0, h - 0.13, 1.03, 1.03, 0.13, lip, bevel=0.025)
    ctx.box(0.1, 0.1, h - 0.005, 0.8, 0.8, 0.01, M_(ctx, 'ls_basintop', '#aaa6a2', 0.7))
    if v % 2:
        ctx.box(0.6, 1.0, 0.12, 0.02, 0.01, h * 0.5, M_(ctx, 'ls_crack', '#5a5652', 0.9))


def planter(ctx, h, v):
    stone = nm(ctx, 'ls_planter', '#76727e', '#6e6a76', scale=24, rough=0.75, bump=0.2)
    ctx.box(0, 0, 0, 0.98, 0.98, h - 0.1, stone)
    groove = M_(ctx, 'ls_plgroove', '#5e5a66', 0.9)
    z = 0.3
    while z < h - 0.15:
        ctx.box(0, 0.975, z, 0.98, 0.01, 0.03, groove); ctx.box(0.975, 0, z, 0.01, 0.98, 0.03, groove); z += 0.3
    cap = nm(ctx, 'ls_plcap', '#a8a4ae', '#98949e', scale=24, rough=0.6, bump=0.1)
    for (x, y, w, d) in ((0, 0, 1.02, 0.1), (0, 0.92, 1.02, 0.1), (0, 0, 0.1, 1.02), (0.92, 0, 0.1, 1.02)):
        ctx.box(x, y, h - 0.1, w, d, 0.1, cap, bevel=0.01)
    ctx.box(0.1, 0.1, h - 0.12, 0.82, 0.82, 0.08, nm(ctx, 'ls_soil', '#2a2018', '#3a2c20', scale=40, bump=0.6))
    leaf = [nm(ctx, 'ls_leaf%d' % k, c, '#1e3a18', scale=25, bump=1.0) for k, c in enumerate(['#2a4a22', '#355a2c', '#40682f'])]
    rnd = random.Random(v * 17 + 5)
    k = v % 3
    if k == 0:   # clipped box hedge
        ctx.box(0.16, 0.16, h - 0.06, 0.7, 0.7, 0.32, leaf[1], bevel=0.06)
    elif k == 1:  # shrubs
        for i in range(6):
            ctx.sphere(0.25 + rnd.random() * 0.5, 0.25 + rnd.random() * 0.5, h + 0.05, 0.13 + rnd.random() * 0.06, rnd.choice(leaf), 1, 1, 0.8)
    else:        # red & white flower bed
        for i in range(5):
            ctx.sphere(0.25 + rnd.random() * 0.5, 0.25 + rnd.random() * 0.5, h, 0.12, rnd.choice(leaf), 1, 1, 0.6)
        B = Batch(ctx)
        for i in range(26):
            c = M_(ctx, 'ls_flR', RED, 0.6) if i % 2 else M_(ctx, 'ls_flW', WHITE, 0.6)
            B.sphere(0.18 + rnd.random() * 0.64, 0.18 + rnd.random() * 0.64, h + 0.08 + rnd.random() * 0.06, 0.03, c, 6)
        B.flush()


def hoarding(ctx, h, v):
    k = v % 3
    frame = M_(ctx, 'ls_hframe', '#14141a', 0.5, 0.5)
    plinth = nm(ctx, 'ls_hplinth', '#3e3c46', '#46444e', scale=18, bump=0.2)
    B = Batch(ctx)
    ctx.box(0, 0, 0, 0.9, 0.9, h, M_(ctx, 'ls_hback', '#1a1a20', 0.9))
    ctx.box(0, 0, 0, 1.0, 1.0, 0.6, plinth)
    ctx.box(0, 0, 0.58, 1.01, 1.01, 0.04, M_(ctx, 'ls_hplT', '#5a5862', 0.5))
    ctx.box(0, 0, h - 0.1, 1.02, 1.02, 0.1, frame)
    bg = {0: RED, 1: NAVY, 2: WHITE}[k]
    pm = M_(ctx, 'ls_hpanel' + bg, bg, 0.55)
    fg = {0: WHITE, 1: GOLD, 2: RED}[k]
    fm = M_(ctx, 'ls_hfg' + fg, fg, 0.5, 0.3 if k == 1 else 0)
    rnd = random.Random(v * 7 + 1)
    for face in ('x', 'y'):
        def BX(a, dep, z, w, dd, hh, m):
            if face == 'y': B.box(a, dep, z, w, dd, hh, m)
            else: B.box(dep, a, z, dd, w, hh, m)
        BX(0, 0.9, 0.62, 1, 0.08, h - 0.72, pm)
        BX(0, 0.9, 0.6, 0.05, 0.12, h - 0.6, frame)
        z0, z1 = 0.62, h - 0.1
        if k == 0:   # white chain links + red/white block band
            cz = z1 - 0.8
            for i in range(4):
                a = i * 0.25 + 0.03
                BX(a, 0.985, cz - 0.15, 0.2, 0.012, 0.05, fm); BX(a, 0.985, cz + 0.1, 0.2, 0.012, 0.05, fm)
                BX(a, 0.985, cz - 0.15, 0.04, 0.012, 0.3, fm); BX(a + 0.16, 0.985, cz - 0.15, 0.04, 0.012, 0.3, fm)
                BX(a + 0.17, 0.99, cz - 0.02, 0.12, 0.012, 0.05, fm)
            for i in range(8):
                BX(i / 8, 0.985, cz - 0.6, 1 / 8, 0.012, 0.25, M_(ctx, 'ls_hband8', '#8a0a1e', 0.5) if i % 3 == 0 else fm)
        elif k == 1:  # gold stars
            for (a, z) in ((0.25, z1 - 0.45), (0.75, z1 - 0.45), (0.5, z1 - 1.05), (0.25, z1 - 1.65), (0.75, z1 - 1.65)):
                BX(a - 0.13, 0.985, z - 0.035, 0.26, 0.012, 0.07, fm)
                BX(a - 0.035, 0.985, z - 0.13, 0.07, 0.012, 0.26, fm)
                BX(a - 0.06, 0.988, z - 0.06, 0.12, 0.012, 0.12, fm)
        else:         # abstract red block 'lettering' rows (no real words)
            for row in range(3):
                z = z1 - 0.35 - row * 0.65
                a = 0.06
                while a < 0.9:
                    w = 0.06 + rnd.random() * 0.1
                    if rnd.random() < 0.75:
                        BX(a, 0.985, z - 0.3 + rnd.random() * 0.03, w, 0.012, 0.28, fm)
                    a += w + 0.04
        # torn fly-posters
        for i in range(2 if v >= 3 else 1):
            a = rnd.random() * 0.6 + 0.1; z = 0.8 + rnd.random() * (h - 1.8)
            c = rnd.choice(['#c8c0a0', '#8a8478', '#e8d27a'])
            BX(a, 0.995, z, 0.22, 0.008, 0.5, M_(ctx, 'ls_flyp' + c, c, 0.95))
            BX(a + 0.03, 1.0, z + 0.3, 0.16, 0.008, 0.06, M_(ctx, 'ls_flypt', '#3a3430', 0.9))
    B.flush()


# ================================================================== PROPS
def van_like(ctx, var, burnt=False):
    alongX = var.get('dir', 'x') == 'x'

    def BXX(x, y, z, w, d, hh, m, bev=0.0):
        if alongX: ctx.box(x, y, z, w, d, hh, m, bevel=bev)
        else: ctx.box(y, x, z, d, w, hh, m, bevel=bev)
    return alongX, BXX


def p_policevan(ctx, var):
    alongX, BX = van_like(ctx, var)
    white = M_(ctx, 'ls_vanW', '#e4e6ea', 0.3, 0.2)
    blue = M_(ctx, 'ls_vanB', '#1f3fa0', 0.4, 0.1)
    yel = M_(ctx, 'ls_vanY', '#e8d020', 0.4, 0.1, emit='#e8d020', es=0.15)
    glass = M_(ctx, 'ls_vanGl', '#1a2230', 0.05, 0.4)
    tyre = M_(ctx, 'ls_tyre', '#0c0c0e', 0.85)
    rim = M_(ctx, 'ls_rim', '#8a8a92', 0.3, 0.9)
    blk = M_(ctx, 'ls_vanblk', '#1a1a1e', 0.6)
    L, Wd = 1.92, 0.86
    x0, y0 = 0.04, 0.07
    for wx in (0.42, 1.55):
        for side in (0, 1):
            wy = y0 - 0.005 if side == 0 else y0 + Wd - 0.115
            if alongX:
                hcyl(ctx, wx, wy, 0.16, 0.16, 0.12, tyre, 'y', 14); hcyl(ctx, wx, wy + (0.121 if side else -0.001), 0.16, 0.09, 0.005, rim, 'y', 10)
            else:
                hcyl(ctx, wy, wx, 0.16, 0.16, 0.12, tyre, 'x', 14); hcyl(ctx, wy + (0.121 if side else -0.001), wx, 0.16, 0.09, 0.005, rim, 'x', 10)
    BX(x0, y0, 0.12, L, Wd, 0.14, blk, 0.02)
    BX(x0, y0, 0.2, L, Wd, 0.98, white, 0.05)
    # sloped nose: windscreen block on the front
    BX(x0 + L - 0.02, y0 + 0.08, 0.72, 0.03, Wd - 0.16, 0.36, glass)
    # battenberg checks, two rows, all four sides
    n = 8
    s = (L - 0.16) / n
    for i in range(n):
        for k in range(2):
            m = blue if (i + k) % 2 else yel
            BX(x0 + 0.08 + i * s, y0 + Wd - 0.005, 0.34 + k * 0.17, s, 0.012, 0.17, m)
            BX(x0 + 0.08 + i * s, y0 - 0.007, 0.34 + k * 0.17, s, 0.012, 0.17, m)
    m4 = 4; s2 = (Wd - 0.12) / m4
    for i in range(m4):
        for k in range(2):
            m = blue if (i + k) % 2 else yel
            BX(x0 + L - 0.005, y0 + 0.06 + i * s2, 0.34 + k * 0.17, 0.012, s2, 0.17, m)
            BX(x0 - 0.007, y0 + 0.06 + i * s2, 0.34 + k * 0.17, 0.012, s2, 0.17, m)
    # side windows (rear compartment with mesh grille) + cab door window
    for yy in (y0 + Wd - 0.004, y0 - 0.008):
        BX(x0 + 0.15, yy, 0.8, 0.95, 0.012, 0.28, glass)
        for i in range(6):
            BX(x0 + 0.2 + i * 0.16, yy + (0.004 if yy > 0.5 else -0.004), 0.8, 0.015, 0.012, 0.28, M_(ctx, 'ls_vangr', '#5a5a62', 0.4, 0.7))
        BX(x0 + 1.28, yy, 0.8, 0.45, 0.012, 0.28, glass)
        BX(x0 + 1.22, yy, 0.22, 0.012, 0.012, 0.85, M_(ctx, 'ls_seam', '#9a9ca4', 0.4))
    # lights, bumpers, mirrors
    BX(x0 + L - 0.01, y0 + 0.08, 0.3, 0.03, 0.14, 0.08, M_(ctx, 'ls_headl', '#fff8d0', 0.2, 0, emit='#fff0c0', es=3))
    BX(x0 + L - 0.01, y0 + Wd - 0.22, 0.3, 0.03, 0.14, 0.08, M_(ctx, 'ls_headl', '#fff8d0', 0.2, 0, emit='#fff0c0', es=3))
    BX(x0 - 0.02, y0 + 0.08, 0.3, 0.03, 0.12, 0.1, M_(ctx, 'ls_taill', '#ff2020', 0.3, 0, emit='#ff2020', es=2))
    BX(x0 - 0.02, y0 + Wd - 0.2, 0.3, 0.03, 0.12, 0.1, M_(ctx, 'ls_taill', '#ff2020', 0.3, 0, emit='#ff2020', es=2))
    BX(x0 + L - 0.01, y0 + 0.3, 0.26, 0.03, Wd - 0.6, 0.14, M_(ctx, 'ls_grille', '#2a2a30', 0.4, 0.6))
    BX(x0 + L - 0.04, y0 - 0.06, 0.9, 0.05, 0.06, 0.1, blk); BX(x0 + L - 0.04, y0 + Wd, 0.9, 0.05, 0.06, 0.1, blk)
    # roof: light bar (unlit; the flashing is drawn by the theme overlay) + rack
    BX(0.7, 0.3, 1.18, 0.6, 0.4, 0.04, M_(ctx, 'ls_lbbase', '#3a3a44', 0.4, 0.6))
    BX(0.72, 0.32, 1.21, 0.56, 0.36, 0.09, M_(ctx, 'ls_lbar', '#1a2a6a', 0.15, 0.1, emit='#2a3a9a', es=0.4), 0.02)
    BX(0.15, 0.2, 1.18, 0.4, 0.6, 0.03, M_(ctx, 'ls_rack', '#4a4a52', 0.4, 0.7))
    # POLIS lettering (side)
    tm = M_(ctx, 'ls_polis', '#1f3fa0', 0.4)
    if alongX:
        text(ctx, 'POLIS', 0.95, y0 + Wd + 0.004, 0.735, 0.16, tm, 'y')
    else:
        text(ctx, 'POLIS', y0 + Wd + 0.004, 0.95, 0.735, 0.16, tm, 'x')


def p_burntcar(ctx, var):
    alongX, BX = van_like(ctx, var)
    char = nm(ctx, 'ls_char', '#2a2220', '#3a2a22', scale=14, rough=0.95, bump=0.8)
    rust = nm(ctx, 'ls_rust', '#6a3418', '#4a2a18', scale=30, rough=0.95, bump=0.6)
    soot = M_(ctx, 'ls_soot', '#120e0e', 0.95)
    rim = M_(ctx, 'ls_rimburnt', '#3a2a22', 0.6, 0.5)
    ash = nm(ctx, 'ls_ash', '#3a3638', '#5a5456', scale=50, rough=1.0, bump=0.5)
    for wx in (0.38, 1.6):
        for wy in (0.06, 0.82):
            hcyl(ctx, wx, wy, 0.12, 0.12, 0.12, rim, 'y', 10) if alongX else hcyl(ctx, wy, wx, 0.12, 0.12, 0.12, rim, 'x', 10)
    BX(0.06, 0.1, 0.1, 1.88, 0.8, 0.45, char, 0.04)
    rnd = random.Random(4)
    for i in range(9):
        x = 0.12 + i * 0.2 + rnd.random() * 0.05
        z = 0.15 + rnd.random() * 0.22
        BX(x, 0.895, z, 0.08 + rnd.random() * 0.1, 0.01, 0.06 + rnd.random() * 0.08, rust)
        BX(1.935, 0.15 + rnd.random() * 0.6, z, 0.01, 0.08, 0.06, rust)
    # gutted interior
    BX(0.58, 0.16, 0.5, 0.9, 0.68, 0.06, soot)
    for k in range(5):
        BX(0.62 + k * 0.18, 0.2, 0.56, 0.02, 0.6, 0.04, M_(ctx, 'ls_spring', '#4a3a30', 0.6, 0.6))
    # cabin frame pillars (no glass, no roof skin)
    B = Batch(ctx)
    pm = char
    def pt(x, y, z):
        return (x, y, z) if alongX else (y, x, z)
    for y in (0.17, 0.83):
        B.rod(pt(0.55, y, 0.55), pt(0.75, y, 0.98), 0.025, pm)
        B.rod(pt(1.5, y, 0.55), pt(1.36, y, 0.98), 0.025, pm)
        B.rod(pt(0.75, y, 0.98), pt(1.36, y, 0.98), 0.02, pm)
    B.rod(pt(0.75, 0.17, 0.98), pt(0.75, 0.83, 0.98), 0.02, pm)
    B.rod(pt(1.36, 0.17, 0.98), pt(1.33, 0.83, 0.94), 0.02, pm)
    B.flush()
    # crumpled bonnet, ash heaps
    BX(1.5, 0.14, 0.55, 0.42, 0.72, 0.05, rust)
    for i in range(5):
        x = 0.1 + rnd.random() * 1.8; y = rnd.random() * 0.9
        ctx.sphere(*(pt(x, y, 0)[:2]), 0, 0.06 + rnd.random() * 0.05, ash, 1, 1, 0.5)


def p_floodlight(ctx, var):
    conc = nm(ctx, 'ls_flbase', '#5a5862', '#4a4852', scale=20, bump=0.3)
    steel = M_(ctx, 'ls_flsteel', '#7a7a86', 0.45, 0.8)
    steel2 = M_(ctx, 'ls_flsteel2', '#5a5a66', 0.5, 0.8)
    ctx.box(0.22, 0.22, 0, 0.56, 0.56, 0.5, conc, bevel=0.02)
    B = Batch(ctx)
    top = 6.2
    def leg(cx, cy, z):
        t = (z - 0.5) / (top - 0.5)
        r = 0.18 * (1 - t) + 0.07 * t
        return (0.5 + cx * r, 0.5 + cy * r, z)
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for (cx, cy) in corners:
        B.rod(leg(cx, cy, 0.5), leg(cx, cy, top), 0.022, steel, 6)
    segs = 9
    for i in range(segs):
        za, zb = 0.5 + (top - 0.5) * i / segs, 0.5 + (top - 0.5) * (i + 1) / segs
        for k in range(4):
            c0, c1 = corners[k], corners[(k + 1) % 4]
            B.rod(leg(*c0, za), leg(*c1, zb), 0.01, steel2, 4)
            B.rod(leg(*c0, za), leg(*c1, za), 0.01, steel2, 4)
    # service ladder platform
    B.box(0.3, 0.3, top, 0.4, 0.4, 0.04, steel2)
    B.flush()
    # lamp head: frame facing the camera (+x+y) tilted down
    H = Batch(ctx)
    housing = M_(ctx, 'ls_flhouse', '#3a3a44', 0.5, 0.6)
    lamp = M_(ctx, 'ls_fllamp', '#ffffff', 0.2, 0, emit='#f4f8ff', es=12)
    rim = M_(ctx, 'ls_flrim', '#22222a', 0.5, 0.5)
    # local frame: x = across (width), y = facing direction (+), z = up
    W, Hh = 1.2, 0.62
    H.box(-W / 2 - 0.04, -0.06, -0.04, W + 0.08, 0.06, (Hh + 0.08) / UNIT, housing)
    for r in range(2):
        for c in range(4):
            x = -W / 2 + 0.06 + c * (W - 0.12) / 4
            z = (0.05 + r * Hh / 2) / UNIT
            H.box(x, 0.0, z, (W - 0.12) / 4 - 0.04, 0.03, (Hh / 2 - 0.1) / UNIT, rim)
            H.box(x + 0.03, 0.03, z + 0.03 / UNIT, (W - 0.12) / 4 - 0.1, 0.008, (Hh / 2 - 0.16) / UNIT, lamp)
    H.box(-0.04, -0.3, -0.2, 0.08, 0.3, 0.15, housing)
    # local facing = Blender +X (game +y); turn it to face game (+x,+y) and tilt the beam down
    H.flush(Matrix.Translation(G(0.5, 0.5, top + 0.15)) @ Matrix.Rotation(math.radians(45), 4, 'Z') @ Matrix.Rotation(math.radians(22), 4, 'Y'))


def p_flarepot(ctx, var):
    red = M_(ctx, 'ls_flare', '#c81830', 0.5)
    cap = M_(ctx, 'ls_flarecap', '#e8e0d0', 0.6)
    B = Batch(ctx)
    B.rod((0.44, 0.5, 0.0), (0.53, 0.47, 0.42), 0.022, red, 8)
    B.rod((0.43, 0.5, -0.02), (0.445, 0.5, 0.07), 0.024, cap, 8)
    B.sphere(0.535, 0.468, 0.43, 0.02, M_(ctx, 'ls_flarehot', '#ffd0d8', 0.3, 0, emit='#ff6a6a', es=6), 8)
    rnd = random.Random(2)
    for i in range(6):
        a = rnd.random() * math.tau; r = 0.12 + rnd.random() * 0.2
        B.box(0.5 + math.cos(a) * r, 0.5 + math.sin(a) * r, 0, 0.04, 0.03, 0.01, M_(ctx, 'ls_burnt', '#1a1416', 0.9))
    B.flush()
    ctx.cyl(0.5, 0.5, 0, 0.26, 0.003, nm(ctx, 'ls_scorch', '#1a1416', '#2a2226', scale=20, bump=0.3), 20)


def p_statue(ctx, var):
    base = nm(ctx, 'ls_stbase', '#3e3a44', '#36323c', scale=30, rough=0.5, bump=0.15)
    shaft = nm(ctx, 'ls_stshaft', '#55515c', '#4a4652', scale=60, rough=0.35, bump=0.08)
    capm = nm(ctx, 'ls_stcap', '#6a6670', '#5e5a66', scale=40, rough=0.4, bump=0.1)
    ctx.box(0.04, 0.04, 0, 0.92, 0.92, 0.25, base, bevel=0.015)
    ctx.box(0.1, 0.1, 0.25, 0.8, 0.8, 0.08, capm, bevel=0.01)
    ctx.box(0.14, 0.14, 0.3, 0.72, 0.72, 1.0, shaft, bevel=0.01)
    ctx.box(0.1, 0.1, 1.27, 0.8, 0.8, 0.06, capm, bevel=0.01)
    ctx.box(0.08, 0.08, 1.31, 0.84, 0.84, 0.11, capm, bevel=0.015)
    br = M_(ctx, 'ls_plaque', '#7a5a2a', 0.35, 0.9)
    br2 = M_(ctx, 'ls_plaque2', '#a07a3a', 0.3, 0.9)
    ctx.box(0.2, 0.86, 0.55, 0.6, 0.02, 0.5, br, bevel=0.005)
    ctx.box(0.24, 0.875, 0.6, 0.52, 0.01, 0.4, br2)
    # bronze bootprints / base of the figure on top
    ctx.cyl(0.5, 0.5, 1.42, 0.2, 0.05, M_(ctx, 'ls_bronzebase', '#6a4c22', 0.35, 0.9), 16)
    # little uplighter in front
    ctx.box(0.42, 1.0, 0, 0.16, 0.1, 0.08, M_(ctx, 'ls_uplight', '#2a2a30', 0.4, 0.6))
    ctx.box(0.45, 1.02, 0.08, 0.1, 0.06, 0.01, M_(ctx, 'ls_uplightL', '#ffe8c0', 0.2, 0, emit='#ffd8a0', es=8))


def p_fountainjet(ctx, var):
    st = nm(ctx, 'ls_fstone', '#b8b4b0', '#a8a4a0', scale=24, rough=0.5, bump=0.15)
    st2 = nm(ctx, 'ls_fstone2', '#9a9692', '#8a8682', scale=24, rough=0.55, bump=0.15)
    water = M_(ctx, 'ls_fwater', '#2a6a8a', 0.05, 0, emit='#3aa8d8', es=0.6)
    ctx.cyl(0.5, 0.5, 0, 0.26, 0.12, st2, 20)
    ctx.cyl(0.5, 0.5, 0.12, 0.16, 0.7, st2, 16, r2=0.12)
    ctx.cyl(0.5, 0.5, 0.6, 0.12, 0.1, st, 16)
    ctx.cyl(0.5, 0.5, 0.72, 0.2, 0.12, st, 24, r2=0.62)
    ctx.cyl(0.5, 0.5, 0.84, 0.64, 0.06, st, 32)
    ctx.cyl(0.5, 0.5, 0.86, 0.58, 0.05, water, 32)
    ctx.cyl(0.5, 0.5, 0.9, 0.06, 0.8, st, 12, r2=0.045)
    ctx.cyl(0.5, 0.5, 1.62, 0.08, 0.1, st, 16, r2=0.34)
    ctx.cyl(0.5, 0.5, 1.72, 0.35, 0.05, st, 24)
    ctx.cyl(0.5, 0.5, 1.74, 0.31, 0.04, water, 24)
    ctx.cyl(0.5, 0.5, 1.75, 0.04, 0.12, st, 10, r2=0.02)


def p_fireworks(ctx, var):
    wood = nm(ctx, 'ls_fwwood', '#8a5a30', '#7a4e28', scale=30, rough=0.85, bump=0.3)
    dark = M_(ctx, 'ls_fwdark', '#5e3e20', 0.9)
    ctx.box(0.14, 0.14, 0, 0.72, 0.72, 0.5, wood, bevel=0.008)
    for (x, y, w, d) in ((0.12, 0.12, 0.76, 0.05), (0.12, 0.83, 0.76, 0.05), (0.12, 0.12, 0.05, 0.76), (0.83, 0.12, 0.05, 0.76)):
        ctx.box(x, y, 0.44, w, d, 0.07, dark)
    ctx.box(0.25, 0.862, 0.12, 0.5, 0.01, 0.26, M_(ctx, 'ls_fwlabel', RED, 0.6))
    ctx.box(0.47, 0.874, 0.17, 0.06, 0.005, 0.16, M_(ctx, 'ls_fwstar', '#ffe14a', 0.5))
    ctx.box(0.42, 0.874, 0.225, 0.16, 0.005, 0.05, M_(ctx, 'ls_fwstar', '#ffe14a', 0.5))
    ctx.box(0.862, 0.3, 0.2, 0.01, 0.4, 0.18, M_(ctx, 'ls_fwlabel2', '#ffe14a', 0.6))
    cap = M_(ctx, 'ls_fwcap', '#f0f0f0', 0.6)
    for (x, y, c, hh) in ((0.3, 0.3, '#d82020', 0.38), (0.56, 0.3, '#20a0d8', 0.32), (0.3, 0.6, '#e8c020', 0.3), (0.62, 0.62, '#d820a0', 0.36), (0.45, 0.45, '#30c040', 0.42)):
        m = M_(ctx, 'ls_tube' + c, c, 0.45)
        ctx.cyl(x, y, 0.4, 0.06, hh + 0.1, m, 12)
        ctx.cyl(x, y, 0.5 + hh, 0.062, 0.04, cap, 12)
        ctx.cyl(x, y, 0.54 + hh, 0.03, 0.04, cap, 8, r2=0.0)
    B = Batch(ctx)
    B.rod((0.86, 0.5, 0.42), (0.98, 0.56, 0.6), 0.006, M_(ctx, 'ls_fuse', '#2a2a2a', 0.8), 5)
    B.flush()


def p_turnstile(ctx, var):
    steel = M_(ctx, 'ls_tsteel', '#a0a4ac', 0.3, 0.85)
    dark = M_(ctx, 'ls_tdark', '#4a4e56', 0.4, 0.7)
    ctx.box(0.15, 0.3, 0, 0.3, 0.4, 0.95, steel, bevel=0.02)
    ctx.box(0.14, 0.29, 0.92, 0.32, 0.42, 0.06, dark, bevel=0.01)
    ctx.box(0.2, 0.69, 0.55, 0.2, 0.012, 0.25, M_(ctx, 'ls_treader', '#1a1a20', 0.3, 0.4))
    ctx.box(0.25, 0.7, 0.62, 0.1, 0.005, 0.1, M_(ctx, 'ls_treaderL', '#3a8aff', 0.3, 0, emit='#3a8aff', es=1.5))
    B = Batch(ctx)
    hub = (0.45, 0.5, 0.75)
    B.rod((0.44, 0.5, 0.75), (0.56, 0.5, 0.75), 0.045, dark, 10)
    for k in range(3):
        a = k * 2.094 + 0.4
        e = (0.55 + math.cos(a) * 0.38, 0.5 + math.sin(a) * 0.38, 0.75 - 0.05 * k - (0.12 if k == 1 else 0))
        B.rod((0.55, 0.5, 0.75), e, 0.018, M_(ctx, 'ls_tarm', '#c0c4cc', 0.2, 0.95), 8)
    B.flush()
    ctx.cyl(0.3, 0.7, 0.98, 0.025, 0.02, M_(ctx, 'ls_tled', '#1a6a3a', 0.3), 8)


def p_cabinet(ctx, var):
    c = var.get('color', '#6e727a')
    body = M_(ctx, 'ls_cab' + c, c, 0.45, 0.4)
    dk = M_(ctx, 'ls_cabd', '#3a3c42', 0.6)
    chrome = M_(ctx, 'ls_cabh', '#c8ccd4', 0.2, 0.95)
    ctx.box(0.12, 0.15, 0, 0.76, 0.7, 1.0, body, bevel=0.012)
    for i in range(3):
        z = 0.04 + i * 0.32
        ctx.box(0.15, 0.85, z, 0.7, 0.012, 0.29, body, bevel=0.004)
        ctx.box(0.15, 0.85, z + 0.29, 0.7, 0.014, 0.012, dk)
        ctx.box(0.42, 0.862, z + 0.17, 0.16, 0.025, 0.03, chrome)
        ctx.box(0.45, 0.862, z + 0.22, 0.1, 0.006, 0.04, M_(ctx, 'ls_cablabel', '#e8e4d0', 0.8))
    ctx.box(0.25, 0.3, 1.0, 0.3, 0.22, 0.03, M_(ctx, 'ls_papers', '#f0ecdc', 0.9))


def p_stall(ctx, var):
    post = M_(ctx, 'ls_stpost', '#3a3a44', 0.4, 0.7)
    for (x, y) in ((0.1, 0.1), (1.9, 0.1), (0.1, 0.9), (1.9, 0.9)):
        ctx.cyl(x, y, 0, 0.025, 1.9, post, 8)
    ctx.box(0.05, 0.1, 0, 1.9, 0.8, 0.8, M_(ctx, 'ls_stside', '#2a4a8a', 0.6))
    ctx.box(0.03, 0.08, 0.78, 1.94, 0.84, 0.04, M_(ctx, 'ls_sttop', '#d8d0b8', 0.7), bevel=0.005)
    text(ctx, 'MERCH', 1.0, 0.905, 0.45, 0.22, M_(ctx, 'ls_merch', '#ffe14a', 0.5), 'y')
    red, white = M_(ctx, 'ls_scR', RED, 0.8), M_(ctx, 'ls_scW', WHITE, 0.8)
    B = Batch(ctx)
    for i in range(6):   # scarves laid out on the table
        x = 0.2 + i * 0.28
        for k in range(6):
            B.box(x, 0.25 + k * 0.08, 0.82, 0.18, 0.08, 0.015, red if k % 2 == 0 else white)
    for i in range(5):   # hanging scarves on the front rail
        x = 0.25 + i * 0.36
        for k in range(9):
            B.box(x, 0.88, 1.85 - (k + 1) * 0.1, 0.12, 0.015, 0.1, red if (k // 2) % 2 == 0 else white)
    B.box(0.05, 0.89, 1.84, 1.9, 0.02, 0.02, post)
    B.flush()
    n = 8
    for i in range(n):
        m = white if i % 2 else red
        ctx.box(-0.05 + i * 2.1 / n, -0.05, 1.9, 2.1 / n, 1.1, 0.1, m)
        ctx.box(-0.05 + i * 2.1 / n, 1.04, 1.74, 2.1 / n, 0.02, 0.17, m)   # valance


def lintel(ctx, x0, y0, w, d, z0, z1, face):
    """arena-facade lintel block matching laststand_facade's top bands (face: visible long face 'x' or 'y')"""
    panel = facade_panel_mat(ctx)
    body = M_(ctx, 'ls_fbody', '#2a2830', 0.9)
    joint = M_(ctx, 'ls_fjoint', '#3a3842', 0.9)
    zb = z1 - 0.8
    ctx.box(x0, y0, z0, w * 0.97, d * 0.97, z1 - z0 - 0.02, body)
    ctx.box(x0, y0, z0, w, d, 0.12, M_(ctx, 'ls_lintelsoffit', '#2a2830', 0.8))
    ctx.box(x0, y0, z0 + 0.1, w + 0.005, d + 0.005, 0.06, M_(ctx, 'ls_lintelline', '#46444e', 0.6))
    B = Batch(ctx)
    L = w if face == 'y' else d
    for k in range(int(L * 4)):
        a0 = k * 0.25 + 1 / 16
        if face == 'y': B.box(x0 + a0, y0 + d - 0.05, z0 + 0.2, 0.1875, 0.05, zb - z0 - 0.22, panel)
        else: B.box(x0 + w - 0.05, y0 + a0, z0 + 0.2, 0.05, 0.1875, zb - z0 - 0.22, panel)
    B.flush()
    ctx.box(x0, y0, zb, w * 0.97 + 0.01, d * 0.97 + 0.01, 0.1, M_(ctx, 'ls_gap', '#1e1a22', 0.9))
    ctx.box(x0, y0, zb + 0.1, w, d, 0.55, M_(ctx, 'ls_clad', RED, 0.35, 0.3), bevel=0.006)
    ctx.box(x0, y0, zb + 0.29, w + 0.008, d + 0.008, 0.1, M_(ctx, 'ls_cladW', WHITE, 0.4))
    ctx.box(x0, y0, z1 - 0.15, w + 0.02, d + 0.02, 0.13, M_(ctx, 'ls_coping', '#a8a8b4', 0.3, 0.8), bevel=0.008)
    ctx.box(x0 + 0.07, y0 + 0.07, z1 - 0.03, w - 0.14, d - 0.14, 0.03, nm(ctx, 'ls_roof', '#2e2c36', '#3a3842', scale=30, bump=0.4))


def p_arenagate(ctx, var):
    iron = M_(ctx, 'ls_giron', '#5a5a68', 0.35, 0.8)
    gold = M_(ctx, 'ls_gold', GOLD, 0.25, 1.0)
    B = Batch(ctx)
    zt = 2.8
    for leaf in (0, 1):
        for i in range(9):
            y = leaf + (i + 0.5) / 9
            B.box(0.82, y - 0.022, 0, 0.05, 0.044, zt, iron)
            B.cyl(0.845, y, zt, 0.04, 0.18, gold, 6, r2=0.0)
        for z in (0.15, zt * 0.55, zt - 0.22):
            B.box(0.82, leaf + 0.02, z, 0.05, 0.96, 0.06, M_(ctx, 'ls_grail', '#5a5a66', 0.4, 0.8))
        # scrollwork rings between the rails
        for i in range(4):
            B.cyl(0.845, leaf + 0.15 + i * 0.23, zt * 0.55 + 0.25, 0.04, 0.01, gold, 8)
    B.box(0.8, 0, 0, 0.08, 0.06, 3.0, iron); B.box(0.8, 1.94, 0, 0.08, 0.06, 3.0, iron)
    B.box(0.8, 0.985, 0, 0.08, 0.03, zt, iron)
    B.flush()
    # crest medallion where the leaves meet (+x face)
    hcyl(ctx, 0.86, 1.0, 1.5, 0.21, 0.04, gold, 'x', 24)
    hcyl(ctx, 0.9, 1.0, 1.5, 0.17, 0.01, M_(ctx, 'ls_medred', RED, 0.4), 'x', 24)
    wm = M_(ctx, 'ls_medw', WHITE, 0.5)
    ctx.box(0.905, 0.985, 1.36, 0.01, 0.03, 0.26, wm)
    ctx.box(0.905, 0.93, 1.56, 0.01, 0.14, 0.03, wm)
    ctx.box(0.905, 0.93, 1.38, 0.01, 0.14, 0.03, wm)
    ctx.box(0.905, 0.91, 1.38, 0.01, 0.03, 0.08, wm); ctx.box(0.905, 1.06, 1.38, 0.01, 0.03, 0.08, wm)
    lintel(ctx, 0, 0, 1, 2, 3.0, 5.0, 'x')


def p_boards(ctx, var):
    w = 2
    ctx.box(0, 0.7, 0, w, 0.05, 2.7, M_(ctx, 'ls_void', '#0c0a10', 0.95))
    planks = [nm(ctx, 'ls_plank%d' % k, c, '#5a4024', scale=30, rough=0.9, bump=0.5) for k, c in enumerate(['#8a6a40', '#7a5a34'])]
    nail = M_(ctx, 'ls_nail', '#8a8a90', 0.4, 0.8)
    for i in range(7):
        z0 = 0.15 + i * 0.36
        tilt = (i % 3 - 1) * 0.06
        ob = ctx.box(0.02, 0.75, z0 - 0.15, w - 0.04, 0.05, 0.3, planks[i % 2], bevel=0.008)
        ob.rotation_euler = (math.atan2(-2 * tilt * UNIT, w), 0, 0)
        ob.location = G(0.02, 0.75 + 0.002 * i, z0 - 0.15 + tilt)
        for x in (0.08, w - 0.12):
            ctx.box(x, 0.8 + 0.002 * i, z0 + (tilt if x < 1 else -tilt) - 0.02, 0.025, 0.012, 0.04, nail)
    text(ctx, 'KEEP OUT', w / 2, 0.82, 1.45, 0.3, M_(ctx, 'ls_keepout', '#e8e0c8', 0.8), 'y')
    lintel(ctx, 0, 0, w, 1, 2.7, 5.0, 'y')


def p_flagpole(ctx, var):
    ctx.box(0.35, 0.35, 0, 0.3, 0.3, 0.2, M_(ctx, 'ls_fpbase', '#5a5862', 0.6), bevel=0.01)
    ctx.cyl(0.5, 0.5, 0.2, 0.035, 4.6, M_(ctx, 'ls_fppole', '#c0c0c8', 0.25, 0.9), 12, r2=0.025)
    ctx.sphere(0.5, 0.5, 4.83, 0.045, M_(ctx, 'ls_gold', GOLD, 0.25, 1.0))
    ctx.box(0.53, 0.5, 1.0, 0.03, 0.02, 0.08, M_(ctx, 'ls_cleat', '#3a3a40', 0.4, 0.8))
    B = Batch(ctx)
    B.rod((0.535, 0.505, 1.04), (0.53, 0.5, 4.75), 0.004, M_(ctx, 'ls_halyard', '#e8e8e8', 0.8))
    B.flush()


# ================================================================== registry
PIECES = [
    dict(kind='floor', id='laststand_plaza', n=12, build=floor_plaza),
    dict(kind='floor', id='laststand_crest', n=24, build=floor_crest),
    dict(kind='floor', id='laststand_granite', n=4, build=floor_granite),
    dict(kind='floor', id='laststand_steps', n=12, build=floor_steps),
    dict(kind='floor', id='laststand_tunnel', n=4, build=floor_tunnel),
    dict(kind='floor', id='laststand_lino', n=4, build=floor_lino),
    dict(kind='floor', id='laststand_scorched', n=4, build=floor_scorched),
    dict(kind='floor', id='laststand_water', n=4, build=floor_water),

    dict(kind='wall', id='laststand_facade', heights=[5], variants=6, build=facade, padX=10, padBottom=8),
    dict(kind='wall', id='laststand_stand', heights=[5], variants=4, build=stand, padX=4, padBottom=4),
    dict(kind='wall', id='laststand_balustrade', heights=[1], variants=1, build=balustrade),
    dict(kind='wall', id='laststand_officewall', heights=[2.6], variants=4, build=officewall, padX=6, padBottom=4),
    dict(kind='wall', id='laststand_ticketfront', heights=[2.6], variants=4, build=ticketfront, padX=4, padBottom=4),
    dict(kind='wall', id='laststand_counter', heights=[1.1], variants=2, build=counter, padX=4, padBottom=4),
    dict(kind='wall', id='laststand_basin', heights=[0.6], variants=2, build=basin, padX=4, padBottom=4),
    dict(kind='wall', id='laststand_planter', heights=[0.9], variants=3, build=planter, padX=4, padBottom=4, extraTop=24),
    dict(kind='wall', id='laststand_hoarding', heights=[3], variants=6, build=hoarding, padX=4, padBottom=4),

    # dict(kind='prop', id='laststand_policevan', size=(2, 2, 1.4), build=p_policevan, pad=10, variants=[{'dir': 'x'}, {'dir': 'y'}]),   # -> moved to env_vehicles.py (full scale)
    # dict(kind='prop', id='laststand_burntcar', size=(2, 1, 1.1), build=p_burntcar, pad=10),   # -> moved to env_vehicles.py (full scale)
    dict(kind='prop', id='laststand_floodlight', size=(1, 1, 7.0), build=p_floodlight, pad=30),
    dict(kind='prop', id='laststand_flarepot', size=(1, 1, 0.6), build=p_flarepot, pad=6),
    dict(kind='prop', id='laststand_statue', size=(1, 1, 1.5), build=p_statue, pad=8),
    dict(kind='prop', id='laststand_fountainjet', size=(1, 1, 1.9), build=p_fountainjet, pad=18),
    dict(kind='prop', id='laststand_fireworks', size=(1, 1, 1.0), build=p_fireworks, pad=8),
    dict(kind='prop', id='laststand_turnstile', size=(1, 1, 1.1), build=p_turnstile, pad=8),
    dict(kind='prop', id='laststand_cabinet', size=(1, 1, 1.1), build=p_cabinet, pad=6, variants=[{'color': '#6e727a'}, {'color': '#5a6a5e'}]),
    dict(kind='prop', id='laststand_stall', size=(2, 1, 2.1), build=p_stall, pad=10),
    dict(kind='prop', id='laststand_arenagate', size=(1, 2, 5.0), build=p_arenagate, pad=8),
    dict(kind='prop', id='laststand_boards', size=(2, 1, 5.0), build=p_boards, pad=8),
    dict(kind='prop', id='laststand_flagpole', size=(1, 1, 5.0), build=p_flagpole, pad=8),
]
