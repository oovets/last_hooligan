# THE CITY (Level 5, theme 'city') environment pieces for scripts/blender/render_env.py.
# Downtown Nordhamn at night after the match: rain-wet paving with neon reflections, neon shopfronts, an arcade and a
# kebab shop, the hotel, a 70s galleria over the road tunnel, the VELVET nightclub (velvet walls, bar, DJ booth, dance
# floor), a multi-storey car park, the night market and fountain square with the founder's statue.
# Everything is original (no real brands). Game coords: x,y in tiles (1 tile = 1 m), z in height units (ctx.UNIT m).
# Visible faces of a wall block: +x (screen right) and +y (screen left).
import os, sys, math, random
import bpy, bmesh
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from env_common import _h  # noqa: E402

UNIT = 1.0206
TAU = math.pi * 2
NEON = {'pink': '#ff3aa0', 'cyan': '#3ae0ff', 'amber': '#ffc23a', 'green': '#5aff7a', 'violet': '#b06aff', 'orange': '#ff7a3a', 'red': '#ff3a4a'}
DANCE_COLS = ['#ff3aa0', '#3ae0ff', '#ffd23a', '#7aff5a', '#b06aff', '#ff7a3a']


def G(gx, gy, gz=0.0):
    return Vector((gy, gx, gz * UNIT))


def hsh(*a):
    return random.Random(repr(a)).random()


def _srgb(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def dim(c, k):
    c = _h(c) if isinstance(c, str) else c
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(x * k * 255)))) for x in c)


# ================================================================== geometry helpers
class Batch:
    """Accumulates many boxes/spheres/cylinders into one mesh object per material."""
    def __init__(self, ctx):
        self.ctx = ctx; self.bms = {}

    def _bm(self, mat, smooth=False):
        k = (mat.name, smooth)
        if k not in self.bms: self.bms[k] = (mat, smooth, bmesh.new())
        return self.bms[k][2]

    def box(self, gx, gy, gz, w, d, h, mat, bevel=0.0):
        if w <= 0 or d <= 0 or h <= 0: return
        bm = self._bm(mat)
        if bevel > 0:
            tmp = bmesh.new()
            bmesh.ops.create_cube(tmp, size=1.0, matrix=Matrix.Diagonal((d, w, h * UNIT, 1)))
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=min(bevel, 0.45 * min(w, d, h * UNIT)), segments=2, affect='EDGES')
            bmesh.ops.translate(tmp, vec=G(gx + w / 2, gy + d / 2, gz + h / 2), verts=tmp.verts)
            me = bpy.data.meshes.new('t'); tmp.to_mesh(me); tmp.free()
            bm.from_mesh(me); bpy.data.meshes.remove(me)
            return
        M = Matrix.Translation(G(gx + w / 2, gy + d / 2, gz + h / 2)) @ Matrix.Diagonal((d, w, max(h * UNIT, 1e-4), 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)

    def sphere(self, gx, gy, gz, r, mat, seg=10, sx=1.0, sy=1.0, sz=1.0):
        bm = self._bm(mat, True)
        M = Matrix.Translation(G(gx, gy, gz)) @ Matrix.Diagonal((sy, sx, sz, 1))
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2 + 1), radius=r, matrix=M)

    def cyl(self, gx, gy, gz, r, h, mat, seg=12, r2=None):
        bm = self._bm(mat, True)
        M = Matrix.Translation(G(gx, gy, gz) + Vector((0, 0, h * UNIT / 2)))
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h * UNIT, matrix=M)

    def rod(self, a, b, r, mat, seg=8, r2=None):
        """cylinder between game points a=(x,y,z) and b=(x,y,z) (z in units)"""
        pa, pb = G(*a), G(*b)
        v = pb - pa
        L = v.length
        if L < 1e-6: return
        bm = self._bm(mat, True)
        q = v.to_track_quat('Z', 'Y')
        M = Matrix.Translation(pa + v / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=L, matrix=M)

    def quad(self, pts, mat):
        """flat polygon from game points [(x,y,z),...]"""
        bm = self._bm(mat)
        vs = [bm.verts.new(G(*p)) for p in pts]
        bm.faces.new(vs)

    def flush(self):
        obs = []
        for (name, smooth), (mat, sm, bm) in self.bms.items():
            me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
            for p in me.polygons: p.use_smooth = sm
            me.materials.append(mat)
            ob = bpy.data.objects.new(name, me); self.ctx.link(ob); obs.append(ob)
        self.bms = {}
        return obs


def text(ctx, s, gx, gy, gz, size, mat, face='y', extrude=0.004, align='CENTER'):
    """flat text on a visible face: 'y' (+y face, reads along +x) or 'x' (+x face, reads along -y); 'top' lies flat (reads along +x).
    (gx,gy,gz) = centre."""
    cu = bpy.data.curves.new('txt', 'FONT'); cu.body = s; cu.size = size
    cu.align_x = align; cu.align_y = 'CENTER'; cu.extrude = extrude
    try: cu.font = bpy.data.fonts.load('<builtin>')
    except Exception: pass
    ob = bpy.data.objects.new('txt', cu); ctx.link(ob); cu.materials.append(mat)
    if face == 'y': R = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0)))
    elif face == 'x': R = Matrix(((-1, 0, 0), (0, 0, 1), (0, 1, 0)))
    else: R = Matrix(((0, -1, 0), (1, 0, 0), (0, 0, 1)))
    ob.matrix_world = Matrix.Translation(G(gx, gy, gz)) @ R.to_4x4()
    return ob


def M_(ctx, key, c, rough=0.6, metal=0.0, emit=None, es=1.0):
    return ctx.mat('c_' + key, _h(c), rough, metal, emit=_h(emit) if emit else None, emit_strength=es)


def glow(ctx, c, es=3.0, base=None):
    """emissive neon/screen material"""
    return ctx.mat('c_glow' + c + str(es), _h(base or dim(c, 0.5)), 0.3, 0, emit=_h(c), emit_strength=es)


# ================================================================== node material builder (world coords == game coords)
class NB:
    def __init__(self, ctx, key):
        self.ctx = ctx
        self.m, self.N, self.L, self.b, co = ctx.nodemat('c_' + key)
        geo = self.N.new('ShaderNodeNewGeometry')
        sep = self.N.new('ShaderNodeSeparateXYZ'); self.L.new(geo.outputs['Position'], sep.inputs[0])
        self.gx, self.gy, self.gzm = sep.outputs[1], sep.outputs[0], sep.outputs[2]   # game x = world Y, game y = world X

    def _in(self, sock, v):
        if isinstance(v, (int, float)): sock.default_value = v
        else: self.L.new(v, sock)

    def math(self, op, a, b=0.0, clamp=False):
        n = self.N.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
        self._in(n.inputs[0], a); self._in(n.inputs[1], b); return n.outputs[0]

    def add(self, a, b): return self.math('ADD', a, b)
    def sub(self, a, b): return self.math('SUBTRACT', a, b)
    def mul(self, a, b): return self.math('MULTIPLY', a, b)
    def frac(self, a): return self.math('FRACT', a)
    def floor(self, a): return self.math('FLOOR', a)
    def mod(self, a, b): return self.math('FLOORED_MODULO', a, b)
    def lt(self, a, b): return self.math('LESS_THAN', a, b)
    def gt(self, a, b): return self.math('GREATER_THAN', a, b)
    def mn(self, a, b): return self.math('MINIMUM', a, b)
    def mx(self, a, b): return self.math('MAXIMUM', a, b)
    def clamp01(self, a): return self.math('MULTIPLY', a, 1.0, True)
    def lerp(self, f, a, b): return self.add(self.mul(self.sub(1.0, f), a), self.mul(f, b))

    def smooth(self, e0, e1, x):
        n = self.N.new('ShaderNodeMapRange'); n.interpolation_type = 'SMOOTHSTEP'
        self._in(n.inputs['Value'], x); n.inputs['From Min'].default_value = e0; n.inputs['From Max'].default_value = e1
        return n.outputs['Result']

    def vec(self, x, y, z=0.0):
        n = self.N.new('ShaderNodeCombineXYZ'); self._in(n.inputs[0], x); self._in(n.inputs[1], y); self._in(n.inputs[2], z); return n.outputs[0]

    def col(self, c):
        n = self.N.new('ShaderNodeRGB'); n.outputs[0].default_value = (*_srgb(_h(c)), 1); return n.outputs[0]

    def mix(self, fac, a, b, blend='MIX'):
        n = self.N.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = blend
        self._in(n.inputs['Factor'], fac)
        for sock, v in ((n.inputs['A'], a), (n.inputs['B'], b)):
            if isinstance(v, str): sock.default_value = (*_srgb(_h(v)), 1)
            else: self.L.new(v, sock)
        return n.outputs['Result']

    def ramp(self, fac, stops, interp='LINEAR'):
        r = self.N.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = interp
        els = r.color_ramp.elements
        while len(els) < len(stops): els.new(0.5)
        for e, (p, c) in zip(els, stops):
            e.position = p; e.color = (*_srgb(_h(c)), 1)
        self._in(r.inputs['Fac'], fac)
        return r.outputs['Color']

    def torus(self, period, x=None, y=None):
        x = self.gx if x is None else x; y = self.gy if y is None else y
        R = period / TAU
        ax, ay = self.mul(x, TAU / period), self.mul(y, TAU / period)
        c = lambda s, op: self.mul(self.math(op, s), R)
        return self.vec(c(ax, 'COSINE'), c(ax, 'SINE'), c(ay, 'COSINE')), c(ay, 'SINE')

    def pnoise(self, period, scale, detail=4.0, rough=0.5, x=None, y=None):
        nz = self.N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'
        nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
        nz.inputs['Roughness'].default_value = rough
        v, w = self.torus(period, x, y)
        self.L.new(v, nz.inputs['Vector']); self.L.new(w, nz.inputs['W'])
        return nz.outputs['Fac']

    def noise(self, scale, detail=4.0, vec=None):
        nz = self.N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
        self.L.new(vec if vec is not None else self.vec(self.gx, self.gy, self.gzm), nz.inputs['Vector'])
        return nz.outputs['Fac']

    def cellrand(self, cx, cy, seed=0.0):
        """per-cell random 0..1 from integer cell coords"""
        wn = self.N.new('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'
        self.L.new(self.vec(cx, cy, seed), wn.inputs['Vector'])
        return wn.outputs['Value']

    def bump(self, h, strength=0.3, dist=0.02):
        bp = self.N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength
        try: bp.inputs['Distance'].default_value = dist
        except Exception: pass
        self.L.new(h, bp.inputs['Height']); self.L.new(bp.outputs['Normal'], self.b.inputs['Normal'])

    def out(self, color, rough=0.8, emit=None, es=1.0, metal=0.0):
        if isinstance(color, str): self.b.inputs['Base Color'].default_value = (*_srgb(_h(color)), 1)
        else: self.L.new(color, self.b.inputs['Base Color'])
        self._in(self.b.inputs['Roughness'], rough)
        self.b.inputs['Metallic'].default_value = metal
        if emit is not None:
            self.L.new(emit, self.b.inputs['Emission Color'])
            self._in(self.b.inputs['Emission Strength'], es)
        return self.m


def image_from(name, arr):
    """numpy float array [rows(v), cols(u), 3|4] in sRGB 0..1 -> Blender image"""
    import numpy as np
    h, w = arr.shape[:2]
    if arr.shape[2] == 3: arr = np.concatenate([arr, np.ones((h, w, 1))], axis=2)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(arr.astype(np.float32).ravel())
    return img


# ================================================================== shared surface materials
def wet_layer(nb, n, c, rough_dry=0.55, amount=0.58, streaks=True, seed=0.0):
    """rain: puddle mask (periodic), darker glossy puddles with coloured neon reflection streaks.
    returns (colour, roughness, emission, puddle mask)"""
    p = nb.pnoise(n, 1.1, 3.0, 0.55, x=nb.add(nb.gx, seed), y=nb.gy)
    pud = nb.smooth(amount, amount + 0.05, p)
    damp = nb.smooth(amount - 0.12, amount, p)
    c = nb.mix(nb.mul(damp, 0.35), c, '#0a0a12')
    c = nb.mix(nb.mul(pud, 0.55), c, '#0c0e1a')
    rough = nb.add(nb.mul(nb.sub(1.0, damp), rough_dry - 0.2), nb.add(0.2, nb.mul(pud, -0.12)))
    em = None
    if streaks:
        # vertical (screen) reflection smears: bands of constant (x - y), one neon colour per band, periodic in n
        K = 5.0
        wob = nb.pnoise(n, 1.5, 2.0, 0.5, x=nb.add(nb.gx, 7.3), y=nb.gy)
        s = nb.add(nb.mul(nb.sub(nb.gx, nb.gy), K / n), nb.mul(wob, 0.35))
        idx = nb.mod(nb.floor(s), K)
        band = nb.sub(1.0, nb.smooth(0.02, 0.16, nb.math('ABSOLUTE', nb.sub(nb.frac(s), 0.5))))
        hue = nb.cellrand(idx, 3.0, 17.0 + seed)
        nc = nb.ramp(hue, [(0.0, '#e0388e'), (0.3, '#36b8d8'), (0.55, '#d8a038'), (0.78, '#9a5ae0')], 'CONSTANT')
        fade = nb.pnoise(n, 0.9, 2.0, 0.5, x=nb.add(nb.add(nb.gx, nb.gy), 11.0), y=nb.mul(nb.sub(nb.gx, nb.gy), 3.0))
        k = nb.mul(nb.mul(band, nb.smooth(amount - 0.06, amount + 0.1, p)), nb.smooth(0.45, 0.68, fade))
        em = nb.mix(nb.mul(k, 0.32), '#000000', nc)
        c = nb.mix(nb.mul(k, 0.15), c, nc)
    return c, rough, em, pud


# ================================================================== FLOORS
def floor_wetpave(ctx, n):
    """0.5 m concrete slabs, dark grout, rain puddles with neon smears"""
    nb = NB(ctx, 'wetPave')
    cx, cy = nb.floor(nb.mul(nb.gx, 2.0)), nb.floor(nb.mul(nb.gy, 2.0))
    fu, fv = nb.frac(nb.mul(nb.gx, 2.0)), nb.frac(nb.mul(nb.gy, 2.0))
    edge = nb.mn(nb.mn(fu, nb.sub(1.0, fu)), nb.mn(fv, nb.sub(1.0, fv)))
    grout = nb.sub(1.0, nb.smooth(0.012, 0.03, edge))
    r = nb.cellrand(nb.mod(cx, 2 * n), nb.mod(cy, 2 * n), 1.0)
    base = nb.ramp(r, [(0.0, '#4c4a58'), (0.33, '#524f5f'), (0.66, '#57546a'), (1.0, '#4a4855')])
    grain = nb.pnoise(n, 26.0, 6.0, 0.6)
    base = nb.mix(nb.mul(nb.sub(grain, 0.5), 0.8), base, '#33313c')
    # occasional cracked/stained slab
    st = nb.cellrand(nb.mod(cx, 2 * n), nb.mod(cy, 2 * n), 7.0)
    blot = nb.mul(nb.gt(st, 0.86), nb.smooth(0.45, 0.65, nb.pnoise(n, 5.0, 3.0)))
    base = nb.mix(nb.mul(blot, 0.5), base, '#2c2a34')
    c = nb.mix(nb.mul(grout, 0.8), base, '#2a2834')
    c, rough, em, pud = wet_layer(nb, n, c)
    nb.bump(nb.add(nb.mul(grout, -1.0), nb.mul(grain, 0.15)), 0.35)
    ctx.plane(0, 0, n, n, nb.out(c, rough=rough, emit=em, es=1.4))


def asphalt_nodes(nb, n, c1='#1f1f27', c2='#2e2e38', seed=0.0):
    grain = nb.pnoise(n, 70.0, 8.0, 0.65, x=nb.add(nb.gx, seed), y=nb.gy)
    patch = nb.pnoise(n, 1.6, 3.0, 0.5, x=nb.add(nb.gx, seed + 4.0), y=nb.gy)
    c = nb.ramp(grain, [(0.35, c1), (0.65, c2)])
    c = nb.mix(nb.mul(nb.smooth(0.45, 0.7, patch), 0.35), c, '#16161c')
    # tyre tracks (darker, smoother) along y at u ~ 0.28 / 0.72
    u = nb.frac(nb.gx)
    trk = nb.mx(nb.sub(1.0, nb.smooth(0.0, 0.1, nb.math('ABSOLUTE', nb.sub(u, 0.28)))), nb.sub(1.0, nb.smooth(0.0, 0.1, nb.math('ABSOLUTE', nb.sub(u, 0.72)))))
    c = nb.mix(nb.mul(trk, 0.3), c, '#141418')
    return c, grain, trk


def road_out(ctx, nb, n, c, grain, paint=None, amount=0.55):
    c, rough, em, pud = wet_layer(nb, n, c, rough_dry=0.6, amount=amount)
    h = nb.mul(grain, 0.25)
    if paint is not None:
        pm, pc = paint
        wear = nb.smooth(0.3, 0.55, nb.pnoise(n, 12.0, 4.0, 0.6, x=nb.add(nb.gx, 21.0), y=nb.gy))
        pm = nb.mul(pm, nb.add(0.35, nb.mul(wear, 0.65)))
        c = nb.mix(pm, c, nb.mix(nb.mul(pud, 0.5), pc, '#5a5a60'))
        rough = nb.lerp(pm, rough, 0.5)
        h = nb.add(h, nb.mul(pm, 0.4))
    nb.bump(h, 0.35)
    ctx.plane(0, 0, n, n, nb.out(c, rough=rough, emit=em, es=1.2))


def floor_wetroad(ctx, n):
    nb = NB(ctx, 'wetRoad')
    c, grain, trk = asphalt_nodes(nb, n)
    road_out(ctx, nb, n, c, grain)


def floor_roadline_y(ctx, n):
    nb = NB(ctx, 'roadLineY')
    c, grain, trk = asphalt_nodes(nb, n, seed=2.0)
    u, v2 = nb.frac(nb.gx), nb.frac(nb.mul(nb.gy, 0.5))
    m = nb.mul(nb.lt(nb.math('ABSOLUTE', nb.sub(u, 0.5)), 0.05), nb.lt(v2, 0.35))
    road_out(ctx, nb, n, c, grain, (m, '#d8c870'))


def floor_buslane(ctx, n):
    nb = NB(ctx, 'busLane')
    grain = nb.pnoise(n, 70.0, 8.0, 0.65)
    c = nb.ramp(grain, [(0.35, '#3c181e'), (0.65, '#52242a')])
    patch = nb.pnoise(n, 1.6, 3.0, 0.5, x=nb.add(nb.gx, 9.0), y=nb.gy)
    c = nb.mix(nb.mul(nb.smooth(0.5, 0.75, patch), 0.4), c, '#2a1418')
    u = nb.frac(nb.gx)
    m = nb.mx(nb.lt(u, 0.05), nb.gt(u, 0.95))
    road_out(ctx, nb, n, c, grain, (m, '#e8dcc0'))


def floor_zebra(ctx, n):
    nb = NB(ctx, 'zebra')
    c, grain, trk = asphalt_nodes(nb, n, seed=5.0)
    u, v = nb.frac(nb.gx), nb.frac(nb.gy)
    stripe = nb.lt(nb.mod(nb.floor(nb.mul(u, 4.0)), 2.0), 0.5)
    inner = nb.mul(nb.gt(v, 0.04), nb.lt(v, 0.96))
    road_out(ctx, nb, n, c, grain, (nb.mul(stripe, inner), '#d4d4cc'), amount=0.6)


def floor_taxibay(ctx, n):
    nb = NB(ctx, 'taxiBay')
    c, grain, trk = asphalt_nodes(nb, n, seed=8.0)
    u, v = nb.frac(nb.gx), nb.frac(nb.gy)
    side = nb.mx(nb.lt(u, 0.05), nb.gt(u, 0.95))
    cross = nb.mul(nb.lt(nb.mod(nb.floor(nb.gy), 3.0), 0.5), nb.lt(v, 0.04))
    road_out(ctx, nb, n, c, grain, (nb.mx(side, cross), '#e8c020'))


def floor_tactile(ctx, n):
    """dropped kerb with blister paving: 6x6 domes per tile on a red slab, dark joints"""
    B = Batch(ctx)
    nb = NB(ctx, 'tactBase')
    t = nb.pnoise(n, 30.0, 5.0)
    slab = nb.out(nb.ramp(t, [(0.3, '#8a4234'), (0.7, '#9e4c3c')]), rough=0.55)
    nb2 = NB(ctx, 'tactDome')
    dome = nb2.out(nb2.ramp(nb2.pnoise(n, 40.0, 3.0), [(0.3, '#c46e52'), (0.7, '#d68262')]), rough=0.45)
    joint = M_(ctx, 'tactJoint', '#2c2834', 0.9)
    ctx.plane(0, 0, n, n, joint, gz=-0.001)
    for i in range(n):
        for j in range(n):
            B.box(i + 0.035, j + 0.035, 0, 0.93, 0.93, 0.025, slab, bevel=0.008)
            for a in range(6):
                for b in range(6):
                    B.sphere(i + 0.035 + (a + 0.5) * 0.155, j + 0.035 + (b + 0.5) * 0.155, 0.025, 0.045, dome, seg=8, sz=0.55)
    B.flush()


def floor_brickpave(ctx, n):
    """basket-weave clay pavers (pairs of 0.5 x 0.25 bricks, alternating direction), rain-wet"""
    B = Batch(ctx)
    mats = []
    for k, (c1, c2) in enumerate([('#5a3e44', '#664a4e'), ('#624649', '#6e5254'), ('#533a40', '#5e4248'), ('#6a4c4c', '#765a56')]):
        nb = NB(ctx, 'brickPave%d' % k)
        g = nb.pnoise(n, 30.0, 5.0, 0.6, x=nb.add(nb.gx, k * 3.0), y=nb.gy)
        c = nb.ramp(g, [(0.3, c1), (0.7, c2)])
        c, rough, em, pud = wet_layer(nb, n, c, rough_dry=0.6, amount=0.6)
        nb.bump(g, 0.15)
        mats.append(nb.out(c, rough=rough, emit=em, es=1.2))
    ctx.plane(0, 0, n, n, M_(ctx, 'bpGrout', '#34262c', 0.95), gz=-0.001)
    rnd = random.Random(36)
    g = 0.009
    for cx in range(n * 2):
        for cy in range(n * 2):
            horiz = (cx + cy) % 2 == 0
            for k in range(2):
                m = rnd.choice(mats)
                if horiz: B.box(cx * 0.5 + g, cy * 0.5 + k * 0.25 + g, 0, 0.5 - 2 * g, 0.25 - 2 * g, 0.035, m, bevel=0.007)
                else: B.box(cx * 0.5 + k * 0.25 + g, cy * 0.5 + g, 0, 0.25 - 2 * g, 0.5 - 2 * g, 0.035, m, bevel=0.007)
    B.flush()


def floor_marketcobble(ctx, n):
    """granite setts (0.25 m, offset columns) + market litter: cabbage leaves, paper, a squashed tomato"""
    B = Batch(ctx)
    mats = []
    for k, c in enumerate(['#625a66', '#6e6672', '#58505c', '#766e7a']):
        nb = NB(ctx, 'cobble%d' % k)
        g = nb.pnoise(n, 45.0, 4.0, 0.6, x=nb.add(nb.gx, k * 5.0), y=nb.gy)
        cc = nb.ramp(g, [(0.25, dim(c, 0.82)), (0.75, c)])
        cc, rough, em, pud = wet_layer(nb, n, cc, rough_dry=0.55, amount=0.62, streaks=False)
        nb.bump(g, 0.25)
        mats.append(nb.out(cc, rough=rough))
    ctx.plane(0, 0, n, n, M_(ctx, 'cobGrout', '#221e26', 0.95), gz=-0.001)
    rnd = random.Random(44)
    for i in range(n * 4):
        for j in range(n * 4):
            off = 0.125 if i % 2 else 0.0
            jx, jy = rnd.uniform(-0.008, 0.008), rnd.uniform(-0.008, 0.008)
            s = 0.205 + rnd.uniform(-0.01, 0.008)
            hh = 0.04 + rnd.uniform(-0.008, 0.01)
            B.box(i * 0.25 + 0.022 + jx, (j * 0.25 + off) % n + 0.022 + jy, 0, s, s, hh, rnd.choice(mats), bevel=0.03)
    leaf = [M_(ctx, 'cabLeaf', '#4a8a2a', 0.6), M_(ctx, 'cabLeaf2', '#6aa83a', 0.6)]
    paper = M_(ctx, 'paper', '#d8d0c0', 0.85)
    tomato = M_(ctx, 'tomato', '#a8241a', 0.35)
    for k in range(9):
        x, y = rnd.uniform(0.2, n - 0.4), rnd.uniform(0.2, n - 0.4)
        a = rnd.uniform(0, TAU)
        if k < 5:
            r = rnd.uniform(0.07, 0.11)
            pts = [(x + math.cos(a + t * TAU / 7) * r * (0.7 + 0.3 * ((t * 37) % 5) / 5), y + math.sin(a + t * TAU / 7) * r * (0.7 + 0.3 * ((t * 53) % 5) / 5), 0.06) for t in range(7)]
            B.quad(pts, rnd.choice(leaf))
        elif k < 8:
            w, d = rnd.uniform(0.06, 0.12), rnd.uniform(0.05, 0.09)
            ca, sa = math.cos(a), math.sin(a)
            pts = [(x + ca * px - sa * py, y + sa * px + ca * py, 0.058) for (px, py) in ((-w, -d), (w, -d), (w, d), (-w, d))]
            B.quad(pts, paper)
        else:
            B.sphere(x, y, 0.045, 0.045, tomato, seg=8, sx=1.3, sy=1.0, sz=0.35)
    B.flush()


def floor_deck(ctx, n):
    """multi-storey car park deck: power-floated concrete, oil stains, tyre scuffs, joints every 4 m"""
    nb = NB(ctx, 'deck')
    g = nb.pnoise(n, 18.0, 6.0, 0.6)
    c = nb.ramp(g, [(0.3, '#42424a'), (0.7, '#50505a')])
    oil = nb.smooth(0.6, 0.66, nb.pnoise(n, 1.7, 4.0, 0.6, x=nb.add(nb.gx, 13.0), y=nb.gy))
    c = nb.mix(nb.mul(oil, 0.75), c, '#1e1e24')
    sc = nb.pnoise(n, 0.9, 2.0, 0.5, x=nb.add(nb.gx, 2.0), y=nb.add(nb.gy, 9.0))
    scuff = nb.mul(nb.smooth(0.85, 0.97, nb.math('SINE', nb.add(nb.mul(nb.gy, TAU * 2 / n), nb.mul(sc, 14.0)))), 0.35)
    c = nb.mix(scuff, c, '#2a2a30')
    jx = nb.lt(nb.frac(nb.mul(nb.add(nb.gx, 0.01), 0.25)), 0.006)
    jy = nb.lt(nb.frac(nb.mul(nb.add(nb.gy, 0.01), 0.25)), 0.006)
    j = nb.mx(jx, jy)
    c = nb.mix(j, c, '#2a2a32')
    rough = nb.add(0.7, nb.mul(oil, -0.5))
    nb.bump(nb.add(nb.mul(g, 0.2), nb.mul(j, -0.6)), 0.3)
    ctx.plane(0, 0, n, n, nb.out(c, rough=rough))
    return nb


def floor_bay(ctx, n):
    nb = NB(ctx, 'bay')
    g = nb.pnoise(n, 18.0, 6.0, 0.6)
    c = nb.ramp(g, [(0.3, '#42424a'), (0.7, '#50505a')])
    oil = nb.smooth(0.62, 0.68, nb.pnoise(n, 1.7, 4.0, 0.6, x=nb.add(nb.gx, 23.0), y=nb.gy))
    c = nb.mix(nb.mul(oil, 0.7), c, '#1e1e24')
    u, v = nb.frac(nb.gx), nb.frac(nb.gy)
    pm = nb.mx(nb.lt(v, 0.06), nb.mul(nb.lt(u, 0.05), nb.lt(v, 0.5)))
    wear = nb.smooth(0.25, 0.5, nb.pnoise(n, 14.0, 4.0, 0.6, x=nb.add(nb.gx, 3.0), y=nb.gy))
    pm = nb.mul(pm, nb.add(0.4, nb.mul(wear, 0.6)))
    c = nb.mix(pm, c, '#d8d0b0')
    nb.bump(nb.add(nb.mul(g, 0.2), nb.mul(pm, 0.3)), 0.3)
    ctx.plane(0, 0, n, n, nb.out(c, rough=nb.add(0.7, nb.mul(oil, -0.5))))


def floor_clubfloor(ctx, n):
    """polished black-violet terrazzo tiles (0.5 m) with glitter"""
    nb = NB(ctx, 'clubFloor')
    fu, fv = nb.frac(nb.mul(nb.gx, 2.0)), nb.frac(nb.mul(nb.gy, 2.0))
    edge = nb.mn(nb.mn(fu, nb.sub(1.0, fu)), nb.mn(fv, nb.sub(1.0, fv)))
    grout = nb.sub(1.0, nb.smooth(0.015, 0.035, edge))
    chips = nb.pnoise(n, 90.0, 1.0, 0.5)
    c = nb.ramp(chips, [(0.3, '#120c18'), (0.55, '#1a1222'), (0.75, '#2a1c36'), (0.8, '#4a2a5e')], 'CONSTANT')
    c = nb.mix(grout, c, '#2c2038')
    sp = nb.pnoise(n, 160.0, 0.0, 0.5, x=nb.add(nb.gx, 4.0), y=nb.gy)
    spark = nb.smooth(0.78, 0.8, sp)
    em = nb.mix(spark, '#000000', '#c88aff')
    nb.bump(nb.mul(grout, -1.0), 0.25)
    ctx.plane(0, 0, n, n, nb.out(c, rough=nb.add(0.18, nb.mul(grout, 0.6)), emit=em, es=1.5))


def floor_dance(ctx, n):
    """light-up glass dance floor (colour per tile matches the procedural (3x+5y)%6), n=6 keeps the pattern"""
    B = Batch(ctx)
    frame = M_(ctx, 'danceFrame', '#0a0a10', 0.35, 0.6)
    frameHi = M_(ctx, 'danceFrameHi', '#3a3a48', 0.3, 0.8)
    ctx.plane(0, 0, n, n, frame, gz=-0.001)
    mats = []
    for k, c in enumerate(DANCE_COLS):
        nb = NB(ctx, 'dance%d' % k)
        u, v = nb.frac(nb.gx), nb.frac(nb.gy)
        d = nb.mx(nb.math('ABSOLUTE', nb.sub(u, 0.5)), nb.math('ABSOLUTE', nb.sub(v, 0.5)))
        rim = nb.smooth(0.25, 0.43, d)
        diag = nb.sub(1.0, nb.smooth(0.0, 0.04, nb.math('ABSOLUTE', nb.sub(u, v))))
        base = nb.mix(0.26, '#0e0e16', c)
        em = nb.mix(nb.add(nb.mul(rim, 0.6), nb.mul(diag, 0.25)), dim(c, 0.35), c)
        mats.append(nb.out(base, rough=0.08, emit=em, es=nb.add(0.12, nb.mul(rim, 0.45))))
    for i in range(n):
        for j in range(n):
            B.box(i + 0.07, j + 0.07, 0, 0.86, 0.86, 0.03, mats[(i * 3 + j * 5) % 6])
            B.box(i, j, 0, 0.07, 1.0, 0.035, frame); B.box(i, j, 0, 1.0, 0.07, 0.035, frame)
            B.box(i + 0.93, j + 0.07, 0, 0.07, 0.93, 0.035, frameHi); B.box(i + 0.07, j + 0.93, 0, 0.93, 0.07, 0.035, frameHi)
            B.box(i + 0.09, j + 0.09, 0.03, 0.1, 0.1, 0.003, M_(ctx, 'danceGlint', '#c8c8d0', 0.1, 0, emit='#ffffff', es=0.25))
    B.flush()


def floor_kebabtiles(ctx, n):
    nb = NB(ctx, 'kebabTiles')
    X, Y = nb.mul(nb.gx, 3.0), nb.mul(nb.gy, 3.0)
    par = nb.mod(nb.add(nb.floor(X), nb.floor(Y)), 2.0)
    fu, fv = nb.frac(X), nb.frac(Y)
    edge = nb.mn(nb.mn(fu, nb.sub(1.0, fu)), nb.mn(fv, nb.sub(1.0, fv)))
    grout = nb.sub(1.0, nb.smooth(0.025, 0.06, edge))
    dirt = nb.pnoise(n, 6.0, 5.0, 0.6)
    c = nb.mix(par, '#d8d4c8', '#b03626')
    c = nb.mix(nb.mul(nb.smooth(0.5, 0.8, dirt), 0.35), c, '#6a5a48')
    c = nb.mix(grout, c, '#6e6c70')
    nb.bump(nb.mul(grout, -1.0), 0.3)
    ctx.plane(0, 0, n, n, nb.out(c, rough=nb.add(0.22, nb.mul(grout, 0.6))))


def floor_water(ctx, n):
    """fountain basin water: dark blue, wind ripples, sparkles, a few wish coins on the bottom"""
    nb = NB(ctx, 'water')
    f = nb.pnoise(n, 2.4, 3.0, 0.5)
    g = nb.pnoise(n, 9.0, 2.0, 0.5, x=nb.add(nb.gx, 3.0), y=nb.gy)
    w = nb.add(f, nb.mul(g, 0.4))
    cz = nb.pnoise(n, 3.5, 2.0, 0.5, x=nb.add(nb.gx, 1.3), y=nb.add(nb.gy, 2.1))
    rip = nb.sub(1.0, nb.smooth(0.0, 0.035, nb.math('ABSOLUTE', nb.sub(cz, 0.5))))
    c = nb.ramp(w, [(0.4, '#0e2236'), (0.6, '#183a58'), (0.78, '#2a5a80')])
    hi = nb.mul(nb.mul(rip, nb.smooth(0.45, 0.65, w)), 0.7)
    c = nb.mix(hi, c, '#6aa0d0')
    em = nb.mix(hi, '#020814', '#9ac8f0')
    nb.bump(nb.add(w, nb.mul(rip, 0.05)), 0.4)
    ctx.plane(0, 0, n, n, nb.out(c, rough=0.05, emit=em, es=0.7))
    B = Batch(ctx)
    rnd = random.Random(43)
    coinC = M_(ctx, 'coinCu', '#8a5a2a', 0.4, 0.8)
    coinS = M_(ctx, 'coinAg', '#8a8a96', 0.4, 0.8)
    for k in range(14):
        B.cyl(rnd.uniform(0.2, n - 0.2), rnd.uniform(0.2, n - 0.2), 0.0, 0.03, 0.006, coinC if k % 3 else coinS, seg=10)
    B.flush()


def floor_arcadecarpet(ctx, n):
    """garish arcade carpet: navy with UV-neon confetti (plus, triangle, zigzag, ring); periodic numpy texture"""
    import numpy as np
    res = 128 * n
    rnd = random.Random(37)
    img = np.zeros((res, res, 3))
    img[:] = _h('#141432')
    yy, xx = np.mgrid[0:res, 0:res]
    diag = ((xx + yy) % 38) < 2
    img[diag] = _h('#1c1a44')
    cols = [_h(c) for c in ('#ff3aa0', '#3ae0ff', '#ffd23a', '#7aff5a', '#b06aff')]
    em = np.zeros((res, res))
    px = res / n

    def stamp(mask_fn, cx, cy, r, col):
        x0, x1 = int(cx - r - 2), int(cx + r + 3)
        y0, y1 = int(cy - r - 2), int(cy + r + 3)
        ys, xs = np.mgrid[y0:y1, x0:x1]
        m = mask_fn(xs - cx, ys - cy)
        ys, xs = ys[m] % res, xs[m] % res
        img[ys, xs] = col; em[ys, xs] = 1.0

    for k in range(int(12 * n * n)):
        cx, cy = rnd.uniform(0, res), rnd.uniform(0, res)
        r = px * rnd.uniform(0.06, 0.1)
        col = rnd.choice(cols)
        a = rnd.uniform(0, math.pi)
        ca, sa = math.cos(a), math.sin(a)
        kind = rnd.randrange(4)
        if kind == 0:   # plus
            stamp(lambda X, Y: ((abs(X * ca + Y * sa) < r * 0.28) & (abs(-X * sa + Y * ca) < r)) | ((abs(-X * sa + Y * ca) < r * 0.28) & (abs(X * ca + Y * sa) < r)), cx, cy, r * 1.5, col)
        elif kind == 1:  # triangle
            def tri(X, Y):
                u, v = X * ca + Y * sa, -X * sa + Y * ca
                return (v > -r * 0.6) & (v < r * 0.9 - abs(u) * 1.7)
            stamp(tri, cx, cy, r * 1.5, col)
        elif kind == 2:  # zigzag squiggle
            def zz(X, Y):
                u, v = X * ca + Y * sa, -X * sa + Y * ca
                return (abs(u) < r * 1.2) & (abs(v - (np.abs(((u / (r * 0.5)) % 2) - 1) - 0.5) * r * 0.7) < r * 0.16)
            stamp(zz, cx, cy, r * 1.8, col)
        else:            # ring
            stamp(lambda X, Y: (np.hypot(X, Y) < r * 0.75) & (np.hypot(X, Y) > r * 0.45), cx, cy, r, col)
    imgb = image_from('c_carpet', img)
    emb = image_from('c_carpetEm', np.repeat(em[..., None], 3, axis=2))
    nb = NB(ctx, 'arcadeCarpet')
    uv = nb.vec(nb.math('DIVIDE', nb.gx, float(n)), nb.math('DIVIDE', nb.gy, float(n)))
    t1 = nb.N.new('ShaderNodeTexImage'); t1.image = imgb; t1.extension = 'REPEAT'; t1.interpolation = 'Closest'
    t2 = nb.N.new('ShaderNodeTexImage'); t2.image = emb; t2.extension = 'REPEAT'; t2.interpolation = 'Closest'
    nb.L.new(uv, t1.inputs['Vector']); nb.L.new(uv, t2.inputs['Vector'])
    fuzz = nb.pnoise(n, 120.0, 2.0, 0.6)
    worn = nb.smooth(0.55, 0.75, nb.pnoise(n, 1.4, 3.0, 0.5, x=nb.add(nb.gx, 5.0), y=nb.gy))
    c = nb.mix(nb.mul(nb.sub(fuzz, 0.5), 0.5), t1.outputs['Color'], '#08081a')
    c = nb.mix(nb.mul(worn, 0.25), c, '#2a2a3a')
    em = nb.mix(t2.outputs['Color'], '#000000', t1.outputs['Color'])
    nb.bump(fuzz, 0.3)
    ctx.plane(0, 0, n, n, nb.out(c, rough=0.95, emit=em, es=0.3))


PLAZA_C = (20.0, 27.0)


def floor_plaza(ctx, n):
    """concentric granite-sett rings around the fountain (centre (20,27)); n=40 covers the whole square 1:1"""
    nb = NB(ctx, 'plaza')
    X, Y = nb.sub(nb.gx, PLAZA_C[0]), nb.sub(nb.gy, PLAZA_C[1])
    r = nb.math('SQRT', nb.add(nb.mul(X, X), nb.mul(Y, Y)))
    RW = 0.5
    rr = nb.math('DIVIDE', r, RW)
    ring = nb.floor(rr)
    segs = nb.floor(nb.add(nb.mul(ring, 5.4), 6.0))
    ang = nb.math('DIVIDE', nb.add(nb.math('ARCTAN2', Y, X), math.pi), TAU)
    sa = nb.mul(ang, segs)
    seg = nb.floor(sa)
    fr_r = nb.frac(rr)
    fr_a = nb.frac(sa)
    arcl = nb.math('DIVIDE', nb.mul(nb.mul(nb.add(ring, 0.5), RW), TAU), segs)   # stone length (m)
    da = nb.mul(nb.mn(fr_a, nb.sub(1.0, fr_a)), arcl)
    dr = nb.mul(nb.mn(fr_r, nb.sub(1.0, fr_r)), RW)
    edge = nb.mn(da, dr)
    grout = nb.sub(1.0, nb.smooth(0.012, 0.03, edge))
    rnd = nb.cellrand(ring, seg, 41.0)
    acc = nb.lt(nb.mod(ring, 4.0), 0.5)
    base = nb.ramp(rnd, [(0.0, '#56525e'), (0.5, '#5e5a66'), (1.0, '#504c58')])
    base = nb.mix(acc, base, nb.ramp(rnd, [(0.0, '#6e6672'), (1.0, '#7a7280')]))
    grain = nb.pnoise(n, 60.0, 4.0, 0.6)
    base = nb.mix(nb.mul(nb.sub(grain, 0.5), 0.6), base, '#2e2c34')
    c = nb.mix(grout, base, '#2a2832')
    c, rough, em, pud = wet_layer(nb, n, c, amount=0.6)
    bev = nb.smooth(0.0, 0.05, edge)
    nb.bump(nb.add(bev, nb.mul(grain, 0.1)), 0.4)
    ctx.plane(0, 0, n, n, nb.out(c, rough=rough, emit=em, es=1.3))


FLOORS = [
    dict(kind='floor', id='city_wetPave', n=4, build=floor_wetpave),
    dict(kind='floor', id='city_wetRoad', n=4, build=floor_wetroad),
    dict(kind='floor', id='city_roadLineY', n=4, build=floor_roadline_y),
    dict(kind='floor', id='city_busLane', n=4, build=floor_buslane),
    dict(kind='floor', id='city_zebra', n=4, build=floor_zebra),
    dict(kind='floor', id='city_taxiBay', n=6, build=floor_taxibay),
    dict(kind='floor', id='city_tactile', n=4, build=floor_tactile),
    dict(kind='floor', id='city_brickPave', n=4, build=floor_brickpave),
    dict(kind='floor', id='city_marketCobble', n=4, build=floor_marketcobble),
    dict(kind='floor', id='city_deck', n=4, build=floor_deck),
    dict(kind='floor', id='city_bay', n=4, build=floor_bay),
    dict(kind='floor', id='city_clubFloor', n=4, build=floor_clubfloor),
    dict(kind='floor', id='city_dance', n=6, build=floor_dance),
    dict(kind='floor', id='city_kebabTiles', n=4, build=floor_kebabtiles),
    dict(kind='floor', id='city_water', n=4, build=floor_water),
    dict(kind='floor', id='city_arcadeCarpet', n=4, build=floor_arcadecarpet),
    dict(kind='floor', id='city_plaza', n=40, build=floor_plaza),
]

