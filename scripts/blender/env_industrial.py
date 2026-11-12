# THE INDUSTRIAL ZONE (Level 6, theme 'industrial') environment pieces for scripts/blender/render_env.py.
# Saturday night down the (fictional) Nordhamn docks: ribbed shipping containers, warehouse cladding, sooty factory brick,
# pallet racking, conveyor belts, steam vents, lorries backed onto the loading bay, guard hut, portakabin canteen, the quay.
# Game coords: x,y in tiles (1 tile = 1 m), z in height units (ctx.UNIT metres).
# Visible faces of a wall block: +x (screen right) and +y (screen left).
#
# Props that need state the sprite matcher (envProp: dir/color/fire) cannot pick (lorry segments, lifted office furniture,
# wall lamps, press ram frames, lever/lamp states, gate signs) render extra variants tagged with a 'part' key; the matching
# overlay() in src/content/themes/industrial.js picks and draws them.
import os, sys, math, random
import bpy, bmesh
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from env_common import _h  # noqa: E402

UNIT = 1.0206
SQ2 = math.sqrt(2)


def G(gx, gy, gz=0.0):
    return Vector((gy, gx, gz * UNIT))


def shade(c, f):
    r = _h(c) if isinstance(c, str) else c
    if f < 0: r = tuple(x * (1 + f) for x in r)
    else: r = tuple(x + (1 - x) * f for x in r)
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(x * 255))) for x in r)


def rnd(*a):
    return random.Random('|'.join(str(x) for x in a))


# ------------------------------------------------------------------ batched geometry (one object per material)
class Batch:
    def __init__(self, ctx):
        self.ctx = ctx; self.bms = {}

    def _bm(self, mat, smooth=False):
        k = (mat.name, smooth)
        if k not in self.bms: self.bms[k] = (mat, smooth, bmesh.new())
        return self.bms[k][2]

    def box(self, gx, gy, gz, w, d, h, mat, bev=0.0):
        bm = self._bm(mat)
        M = Matrix.Translation(G(gx + w / 2, gy + d / 2, gz + h / 2)) @ Matrix.Diagonal((max(d, 1e-4), max(w, 1e-4), max(h * UNIT, 1e-4), 1))
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=M)
        if bev > 0:
            edges = list({e for v in res['verts'] for e in v.link_edges})
            bmesh.ops.bevel(bm, geom=edges, offset=bev, segments=2, affect='EDGES', clamp_overlap=True)

    def obox(self, cx, cy, cz, lx, ly, h, ang, mat):
        """box centred at game (cx,cy), base cz; lx along game direction rotated by ang (radians, from +x toward +y)"""
        bm = self._bm(mat)
        # Blender: X = game y, Y = game x -> game angle a maps to Blender angle (pi/2 - a)
        R = Matrix.Rotation(math.pi / 2 - ang, 4, 'Z')
        M = Matrix.Translation(G(cx, cy, cz + h / 2)) @ R @ Matrix.Diagonal((lx, ly, max(h * UNIT, 1e-4), 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)

    def cyl(self, gx, gy, gz, r, h, mat, seg=12, r2=None):
        bm = self._bm(mat, True)
        M = Matrix.Translation(G(gx, gy, gz) + Vector((0, 0, h * UNIT / 2)))
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=max(h * UNIT, 1e-4), matrix=M)

    def rod(self, a, b, r, mat, seg=6, r2=None):
        pa, pb = G(*a), G(*b)
        v = pb - pa; L = v.length
        if L < 1e-6: return
        bm = self._bm(mat, True)
        q = v.to_track_quat('Z', 'Y')
        M = Matrix.Translation(pa + v / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=L, matrix=M)

    def sphere(self, gx, gy, gz, r, mat, seg=12, sz=1.0, sx=1.0, sy=1.0):
        bm = self._bm(mat, True)
        M = Matrix.Translation(G(gx, gy, gz)) @ Matrix.Diagonal((sy, sx, sz, 1))
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2 + 1), radius=r, matrix=M)

    def torus(self, cx, cy, cz, R, r, mat, seg=24, rseg=10, axis='z', sq=1.0):
        """torus centred at game (cx,cy,cz units); R,r metres; axis = ring axis ('z' lying flat, 'x' or 'y' standing)"""
        bm = self._bm(mat, True)
        c = G(cx, cy, cz)
        rows = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            row = []
            for j in range(rseg):
                b = 2 * math.pi * j / rseg
                rr = R + r * math.cos(b); zz = r * math.sin(b) * sq
                p = (rr * math.cos(a), rr * math.sin(a), zz)          # ring in local XY, axis local Z
                if axis == 'z': q = Vector((p[0], p[1], p[2]))
                elif axis == 'x': q = Vector((p[0], p[2], p[1]))      # axis along game x = Blender Y
                else: q = Vector((p[2], p[0], p[1]))                  # axis along game y = Blender X
                row.append(bm.verts.new(c + q))
            rows.append(row)
        for i in range(seg):
            for j in range(rseg):
                a, b = rows[i][j], rows[(i + 1) % seg][j]
                cc, d = rows[(i + 1) % seg][(j + 1) % rseg], rows[i][(j + 1) % rseg]
                bm.faces.new((a, b, cc, d))

    def quad(self, pts, mat):
        """flat polygon from game points [(x,y,z)...]"""
        bm = self._bm(mat)
        bm.faces.new([bm.verts.new(G(*p)) for p in pts])

    def flush(self):
        obs = []
        for (name, smooth), (mat, sm, bm) in self.bms.items():
            me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
            if smooth:
                for p in me.polygons: p.use_smooth = True
            me.materials.append(mat)
            ob = bpy.data.objects.new(name, me); self.ctx.link(ob); obs.append(ob)
        self.bms = {}
        return obs


def fb(B, face, u0, u1, z0, z1, d0, d1, mat, bev=0.0):
    """box on a visible face of a 1x1 block. face 'y' (+y, screen-left: u along +x) or 'x' (+x, screen-right: u along -y,
    so u=0 is the front corner on both faces). d0..d1 = offset from the face plane (positive = outward). z in units."""
    if face == 'y': B.box(u0, 1 + d0, z0, u1 - u0, d1 - d0, z1 - z0, mat, bev)
    else: B.box(1 + d0, 1 - u1, z0, d1 - d0, u1 - u0, z1 - z0, mat, bev)


def fpt(face, u, d=0.0):
    """game (x, y) of a point on a visible face"""
    return (u, 1 + d) if face == 'y' else (1 + d, 1 - u)


# ------------------------------------------------------------------ materials
def gm(ctx, key, base, rust=0.0, dirt=0.3, rough=0.6, metal=0.0, scale=5.0, streak=0.15, seed=0.0, bump=0.08,
       rustc='#5a2e16', dirtc='#141012', emit=None, es=1.0, alpha=1.0):
    """painted / weathered surface: base colour, vertical rust streaks, fine grime"""
    k = 'gm|%s|%s|%.2f|%.2f|%.2f|%.2f' % (key, base, rust, dirt, seed, alpha)
    if k in ctx.mats: return ctx.mats[k]
    m, N, L, b, co = ctx.nodemat(k)
    tc = co.node
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale, scale, scale * streak)
    mp.inputs['Location'].default_value = (seed * 3.7, seed * 1.3, seed * 0.7)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 1.0; n1.inputs['Detail'].default_value = 5
    L.new(mp.outputs['Vector'], n1.inputs['Vector'])
    mp2 = N.new('ShaderNodeMapping'); mp2.inputs['Location'].default_value = (seed * 2.1, seed, seed * 5.3)
    L.new(tc.outputs['Object'], mp2.inputs['Vector'])
    n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = scale * 7; n2.inputs['Detail'].default_value = 8
    L.new(mp2.outputs['Vector'], n2.inputs['Vector'])
    r1 = N.new('ShaderNodeValToRGB'); r1.color_ramp.elements[0].position = 0.52; r1.color_ramp.elements[1].position = 0.78
    L.new(n1.outputs['Fac'], r1.inputs['Fac'])
    f1 = N.new('ShaderNodeMath'); f1.operation = 'MULTIPLY'; f1.inputs[1].default_value = rust
    L.new(r1.outputs['Color'], f1.inputs[0])
    mx1 = N.new('ShaderNodeMix'); mx1.data_type = 'RGBA'
    mx1.inputs['A'].default_value = (*_lin(base), 1); mx1.inputs['B'].default_value = (*_lin(rustc), 1)
    L.new(f1.outputs[0], mx1.inputs['Factor'])
    r2 = N.new('ShaderNodeValToRGB'); r2.color_ramp.elements[0].position = 0.35; r2.color_ramp.elements[1].position = 0.75
    L.new(n2.outputs['Fac'], r2.inputs['Fac'])
    f2 = N.new('ShaderNodeMath'); f2.operation = 'MULTIPLY'; f2.inputs[1].default_value = dirt
    L.new(r2.outputs['Color'], f2.inputs[0])
    mx2 = N.new('ShaderNodeMix'); mx2.data_type = 'RGBA'; mx2.inputs['B'].default_value = (*_lin(dirtc), 1)
    L.new(mx1.outputs['Result'], mx2.inputs['A']); L.new(f2.outputs[0], mx2.inputs['Factor'])
    L.new(mx2.outputs['Result'], b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    L.new(n2.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*_lin(emit), 1); b.inputs['Emission Strength'].default_value = es
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    ctx.mats[k] = m
    return m


def _lin(c):
    c = _h(c) if isinstance(c, str) else c
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def M(ctx, col, rough=0.7, metal=0.0, emit=None, es=1.0, key=None, alpha=1.0):
    m = ctx.mat(key or ('m' + col), col, rough, metal, emit=emit, emit_strength=es)
    if alpha < 1:
        m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = alpha
    return m


def stripe_mat(ctx, key, c1, c2, freq=3.0, axes='xyz', worn=0.0, rough=0.6, period=None):
    """hazard stripes: c1/c2 alternate along (sum of the chosen Object axes) * freq. axes in game terms: 'x','y','z'."""
    k = 'st|%s|%s|%s|%.2f|%s|%.2f' % (key, c1, c2, freq, axes, worn)
    if k in ctx.mats: return ctx.mats[k]
    m, N, L, b, co = ctx.nodemat(k)
    tc = co.node
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    # game x = Blender Y, game y = Blender X
    socks = {'x': sep.outputs[1], 'y': sep.outputs[0], 'z': sep.outputs[2]}
    acc = None
    for a in axes:
        if acc is None: acc = socks[a]; continue
        ad = N.new('ShaderNodeMath'); ad.operation = 'ADD'; L.new(acc, ad.inputs[0]); L.new(socks[a], ad.inputs[1]); acc = ad.outputs[0]
    mu = N.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = freq; L.new(acc, mu.inputs[0])
    fr = N.new('ShaderNodeMath'); fr.operation = 'FRACT'; L.new(mu.outputs[0], fr.inputs[0])
    lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.5; L.new(fr.outputs[0], lt.inputs[0])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    mx.inputs['A'].default_value = (*_lin(c2), 1); mx.inputs['B'].default_value = (*_lin(c1), 1)
    L.new(lt.outputs[0], mx.inputs['Factor'])
    out = mx.outputs['Result']
    if worn > 0:
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 14; nz.inputs['Detail'].default_value = 6
        if period:
            nz.noise_dimensions = '4D'
            v, w = ctx.periodic_vector(N, L, tc, period); L.new(v, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
        else:
            L.new(tc.outputs['Object'], nz.inputs['Vector'])
        rp = N.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].position = 0.62 - worn * 0.2; rp.color_ramp.elements[1].position = 0.7 - worn * 0.2
        rp.color_ramp.elements[0].color = (0, 0, 0, 1); rp.color_ramp.elements[1].color = (1, 1, 1, 1)
        L.new(nz.outputs['Fac'], rp.inputs['Fac'])
        mx2 = N.new('ShaderNodeMix'); mx2.data_type = 'RGBA'; mx2.inputs['B'].default_value = (*_lin('#2a2826'), 1)
        f = N.new('ShaderNodeMath'); f.operation = 'MULTIPLY'; f.inputs[1].default_value = 0.85
        L.new(rp.outputs['Color'], f.inputs[0])
        L.new(out, mx2.inputs['A']); L.new(f.outputs[0], mx2.inputs['Factor']); out = mx2.outputs['Result']
    L.new(out, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    ctx.mats[k] = m
    return m


def fmat(ctx, key, c1, c2, period, scale=24.0, big='#000000', big_amt=0.3, rough=0.85, bump=0.25, detail=8.0, spec=0.5):
    """seamless floor material: fine grain c1..c2 plus large-scale darker blotches (period = patch n)"""
    k = 'fm|%s|%d' % (key, period)
    if k in ctx.mats: return ctx.mats[k]
    m, N, L, b, co = ctx.nodemat(k)
    tc = co.node
    v, w = ctx.periodic_vector(N, L, tc, period)
    n1 = N.new('ShaderNodeTexNoise'); n1.noise_dimensions = '4D'; n1.inputs['Scale'].default_value = scale; n1.inputs['Detail'].default_value = detail
    L.new(v, n1.inputs['Vector']); L.new(w, n1.inputs['W'])
    n2 = N.new('ShaderNodeTexNoise'); n2.noise_dimensions = '4D'; n2.inputs['Scale'].default_value = 1.6; n2.inputs['Detail'].default_value = 3
    w2 = N.new('ShaderNodeMath'); w2.operation = 'ADD'; w2.inputs[1].default_value = 7.3; L.new(w, w2.inputs[0])
    L.new(v, n2.inputs['Vector']); L.new(w2.outputs[0], n2.inputs['W'])
    r1 = N.new('ShaderNodeValToRGB'); r1.color_ramp.elements[0].color = (*_lin(c1), 1); r1.color_ramp.elements[1].color = (*_lin(c2), 1)
    r1.color_ramp.elements[0].position = 0.3; r1.color_ramp.elements[1].position = 0.7
    L.new(n1.outputs['Fac'], r1.inputs['Fac'])
    r2 = N.new('ShaderNodeValToRGB'); r2.color_ramp.elements[0].position = 0.45; r2.color_ramp.elements[1].position = 0.7
    L.new(n2.outputs['Fac'], r2.inputs['Fac'])
    f = N.new('ShaderNodeMath'); f.operation = 'MULTIPLY'; f.inputs[1].default_value = big_amt; L.new(r2.outputs['Color'], f.inputs[0])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['B'].default_value = (*_lin(big), 1)
    L.new(r1.outputs['Color'], mx.inputs['A']); L.new(f.outputs[0], mx.inputs['Factor'])
    L.new(mx.outputs['Result'], b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    L.new(n1.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    try: b.inputs['Specular IOR Level'].default_value = spec
    except Exception: pass
    ctx.mats[k] = m
    return m


def brick_ind(ctx, key, c1, c2, mortar, h, soot=0.7, seed=0.0):
    """sooty factory brick: (x+y)-continuous coursing, grime streaks, soot gradient toward the top of a block of height h"""
    k = 'bi|%s|%.2f|%.2f' % (key, h, seed)
    if k in ctx.mats: return ctx.mats[k]
    m, N, L, b, co = ctx.nodemat(k)
    tc = co.node
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    add = N.new('ShaderNodeMath'); add.operation = 'ADD'; L.new(sep.outputs[0], add.inputs[0]); L.new(sep.outputs[1], add.inputs[1])
    off = N.new('ShaderNodeMath'); off.operation = 'ADD'; off.inputs[1].default_value = seed; L.new(add.outputs[0], off.inputs[0])
    comb = N.new('ShaderNodeCombineXYZ'); L.new(off.outputs[0], comb.inputs[0]); L.new(sep.outputs[2], comb.inputs[1])
    br = N.new('ShaderNodeTexBrick')
    br.inputs['Color1'].default_value = (*_lin(c1), 1); br.inputs['Color2'].default_value = (*_lin(c2), 1)
    br.inputs['Mortar'].default_value = (*_lin(mortar), 1)
    br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = 0.011
    br.inputs['Brick Width'].default_value = 0.25; br.inputs['Row Height'].default_value = 0.0638
    br.inputs['Bias'].default_value = 0.0
    br.offset = 0.5
    L.new(comb.outputs[0], br.inputs['Vector'])
    # grime streaks (vertical) + soot toward the top
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (9, 9, 0.9); mp.inputs['Location'].default_value = (seed, seed * 2, 0)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 4
    L.new(mp.outputs['Vector'], nz.inputs['Vector'])
    rz = N.new('ShaderNodeMapRange'); rz.inputs['From Min'].default_value = h * UNIT - soot * UNIT * 1.6; rz.inputs['From Max'].default_value = h * UNIT
    rz.inputs['To Min'].default_value = 0.0; rz.inputs['To Max'].default_value = 0.85
    L.new(sep.outputs[2], rz.inputs['Value'])
    gz = N.new('ShaderNodeMath'); gz.operation = 'MULTIPLY'; L.new(rz.outputs['Result'], gz.inputs[0])
    nr = N.new('ShaderNodeMapRange'); nr.inputs['From Min'].default_value = 0.35; nr.inputs['From Max'].default_value = 0.65
    L.new(nz.outputs['Fac'], nr.inputs['Value']); L.new(nr.outputs['Result'], gz.inputs[1])
    st = N.new('ShaderNodeMath'); st.operation = 'MULTIPLY'; st.inputs[1].default_value = 0.35
    L.new(nr.outputs['Result'], st.inputs[0])
    tot = N.new('ShaderNodeMath'); tot.operation = 'ADD'; tot.use_clamp = True; L.new(gz.outputs[0], tot.inputs[0]); L.new(st.outputs[0], tot.inputs[1])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['B'].default_value = (*_lin('#0e0a0a'), 1)
    L.new(br.outputs['Color'], mx.inputs['A']); L.new(tot.outputs[0], mx.inputs['Factor'])
    L.new(mx.outputs['Result'], b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.45
    L.new(br.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.9
    ctx.mats[k] = m
    return m


# ================================================================== WALLS
CONTAINER = {'Red': '#8a3324', 'Blue': '#2a4d7a', 'Green': '#3c6a3c', 'Orange': '#b0602a', 'Grey': '#6a6e72', 'Cream': '#a89c80'}


def container_block(ctx, B, z0, H, col, v, seed):
    paint = gm(ctx, 'ctr' + col, col, rust=0.55, dirt=0.28, rough=0.55, metal=0.25, scale=3.2, streak=0.06, seed=seed + v * 1.37, bump=0.05)
    valley = gm(ctx, 'ctrV' + col, shade(col, -0.18), rust=0.5, dirt=0.35, rough=0.6, metal=0.25, scale=3.2, streak=0.06, seed=seed + v * 1.37 + 0.5, bump=0.05)
    rail = gm(ctx, 'ctrR' + col, shade(col, -0.32), rust=0.7, dirt=0.4, rough=0.6, metal=0.3, scale=6, streak=0.3, seed=seed)
    roof = gm(ctx, 'ctrT' + col, shade(col, 0.06), rust=0.35, dirt=0.45, rough=0.6, metal=0.2, scale=2.5, streak=1.0, seed=seed + 3)
    B.box(0, 0, z0 + 0.02, 0.965, 0.965, H - 0.04, valley)
    R = rnd('ctr', col, v, seed)
    dent = R.randrange(8) if v % 6 == 1 else -1
    for face in ('x', 'y'):
        for k in range(4):
            if face == 'y' and k == dent: continue
            u = k / 4 + 0.055
            fb(B, face, u, u + 0.14, z0 + 0.15, z0 + H - 0.17, -0.035, 0.0, paint, bev=0.012)
        if face == 'y' and dent >= 0:
            u = dent / 4 + 0.055
            fb(B, face, u, u + 0.14, z0 + 0.15, z0 + H - 0.17, -0.05, -0.02, valley, bev=0.012)
        # top & bottom side rails (proud)
        fb(B, face, 0, 1, z0 + H - 0.17, z0 + H - 0.02, -0.035, 0.012, rail, bev=0.008)
        fb(B, face, 0, 1, z0, z0 + 0.15, -0.035, 0.012, rail, bev=0.008)
    # roof plate with cross corrugation
    B.box(0, 0, z0 + H - 0.05, 1, 1, 0.05, roof)
    for k in range(6):
        B.box(k / 6 + 0.03, 0.0, z0 + H, 0.07, 1.0, 0.018, roof)
    # stencilled ID code (abstract bars) on the long side
    if v % 3 == 0:
        st = M(ctx, '#d8d4c8', 0.8, key='stencil')
        zc = z0 + H - 0.5
        x = 0.12
        for i in range(9):
            w = 0.035 if R.random() < 0.6 else 0.05
            if i == 4: x += 0.05; continue
            fb(B, 'y', x, x + w, zc, zc + 0.11, 0.0, 0.004, st)
            x += w + 0.025
        x = 0.12
        for i in range(5):
            w = 0.04; fb(B, 'y', x, x + w, zc - 0.17, zc - 0.07, 0.0, 0.004, st); x += 0.065
    if v % 6 == 5:  # primer-grey repair patch
        fb(B, 'y', 0.5, 0.82, z0 + 0.5, z0 + 1.15, 0.0, 0.004, gm(ctx, 'primer', '#6e6a64', rust=0.4, dirt=0.3, seed=7))
    # door end hardware on the +x face (only visible where the tile ends a container)
    if v % 2 == 0:
        steel = M(ctx, '#3a3a3e', 0.45, 0.6, key='lockbar')
        for yb in (0.22, 0.42, 0.62, 0.82):
            B.cyl(1.03, yb, z0 + 0.18, 0.016, H - 0.36, steel, 8)
            B.box(1.02, yb - 0.035, z0 + 0.85, 0.05, 0.07, 0.06, steel)          # handle
            for zz in (z0 + 0.2, z0 + H - 0.24): B.box(1.0, yb - 0.03, zz, 0.035, 0.06, 0.06, steel)
        # door seam
        B.box(1.0, 0.0, z0 + 0.15, 0.004, 0.02, H - 0.32, M(ctx, '#111114', 0.9, key='seam'))


def w_container(col):
    def build(ctx, h, v):
        B = Batch(ctx)
        container_block(ctx, B, 0, h, col, v, len(col))
        B.flush()
    return build


def w_stack(lo, hi):
    def build(ctx, h, v):
        B = Batch(ctx)
        half = h / 2
        container_block(ctx, B, 0, half, lo, v, 3)
        container_block(ctx, B, half, half, hi, (v + 3) % 6, 5)
        B.flush()
    return build


def w_cladding(ctx, h, v):
    B = Batch(ctx)
    R = rnd('clad', v)
    plinth = gm(ctx, 'plinth', '#5e5e62', dirt=0.45, rough=0.9, scale=4, streak=0.6, seed=1.1, bump=0.3)
    sheet = gm(ctx, 'cladS', '#4c5866', rust=0.25 + 0.1 * (v % 3), dirt=0.3, rough=0.5, metal=0.35, scale=2.6, streak=0.05, seed=v * 0.7)
    rib = gm(ctx, 'cladR', '#5e6c7a', rust=0.25 + 0.1 * (v % 3), dirt=0.25, rough=0.45, metal=0.4, scale=2.6, streak=0.05, seed=v * 0.7)
    flash = M(ctx, '#7a8894', 0.4, 0.6, key='flashing')
    dark = M(ctx, '#2e3640', 0.6, 0.3, key='cladDark')
    lit = v % 2 == 0
    glow = M(ctx, '#c8a060', 0.4, 0, emit='#ffb860', es=1.6, key='rooflightLit') if lit else M(ctx, '#6e7e86', 0.3, 0.1, key='rooflight')
    B.box(0, 0, 0, 1, 1, 0.45, plinth)
    B.box(0, 0, 0.45, 0.975, 0.975, h - 0.45, sheet)
    zt = h - 0.25
    for face in ('x', 'y'):
        fb(B, face, 0, 1, 0.43, 0.47, 0.0, 0.02, dark)                      # plinth flashing
        for k in range(6):
            u = k / 6 + 0.035
            fb(B, face, u, u + 0.095, 0.47, h - 0.7, -0.025, 0.0, rib, bev=0.01)
            fb(B, face, u, u + 0.095, h - 0.25, h - 0.1, -0.025, 0.0, rib, bev=0.01)
        # translucent rooflight band
        fb(B, face, 0, 1, h - 0.68, h - 0.27, -0.02, 0.0, glow)
        for u in (0.0, 0.5):
            fb(B, face, u, u + 0.03, h - 0.7, h - 0.25, -0.02, 0.01, dark)
        fb(B, face, 0, 1, h - 0.7, h - 0.66, -0.02, 0.012, dark); fb(B, face, 0, 1, h - 0.29, h - 0.25, -0.02, 0.012, dark)
        # sheet laps
        z = h - 0.7 - 1.5
        while z > 0.6:
            fb(B, face, 0, 1, z, z + 0.03, 0.0, 0.006, dark); z -= 1.5
        fb(B, face, 0, 1, h - 0.1, h, -0.02, 0.03, flash)                    # top flashing
    # roof: ribbed sheet
    roof = gm(ctx, 'cladRoof', '#46525e', rust=0.2, dirt=0.4, rough=0.55, metal=0.3, scale=3, streak=1, seed=2)
    B.box(0, 0, h - 0.04, 1, 1, 0.04, roof)
    for k in range(4): B.box(k / 4 + 0.08, 0, h, 0.06, 1, 0.02, M(ctx, '#3a444e', 0.5, 0.3, key='roofrib'))
    # variant details
    if v % 3 == 1:  # louvred vent on +x
        fr = M(ctx, '#3a4048', 0.5, 0.4, key='louvreF')
        fb(B, 'x', 0.3, 0.7, 1.4, 2.0, 0.0, 0.03, fr)
        for i in range(6): fb(B, 'x', 0.32, 0.68, 1.43 + i * 0.095, 1.48 + i * 0.095, 0.02, 0.06, M(ctx, '#6a7682', 0.4, 0.5, key='louvre'))
    if v % 3 == 2:  # downpipe on +y
        pipe = M(ctx, '#2a3038', 0.45, 0.5, key='dpipe')
        B.cyl(0.78, 1.06, 0.0, 0.04, h - 0.15, pipe, 10)
        B.box(0.72, 1.0, h - 0.4, 0.12, 0.12, 0.25, pipe)
        for z in (0.8, 1.9, 3.0):
            if z < h - 0.5: B.box(0.74, 1.0, z, 0.08, 0.1, 0.05, pipe)
    if v == 3:  # green fire-exit box sign
        fb(B, 'y', 0.3, 0.7, 1.9, 2.15, 0.0, 0.04, M(ctx, '#1a8a3a', 0.4, 0, emit='#3aff7a', es=0.9, key='exitSign'))
        fb(B, 'y', 0.36, 0.48, 1.95, 2.1, 0.04, 0.045, M(ctx, '#e8ffe8', 0.4, 0, emit='#e8ffe8', es=1.2, key='exitW'))
    if v == 0:  # bay number plate
        fb(B, 'x', 0.25, 0.75, 1.5, 1.9, 0.0, 0.015, M(ctx, '#d8b020', 0.5, key='bayplate'))
        fb(B, 'x', 0.42, 0.47, 1.57, 1.83, 0.015, 0.02, M(ctx, '#1a1a1e', 0.6, key='bayInk'))
        fb(B, 'x', 0.53, 0.6, 1.57, 1.83, 0.015, 0.02, M(ctx, '#1a1a1e', 0.6, key='bayInk'))
    B.flush()


def w_factory_brick(ctx, h, v):
    B = Batch(ctx)
    R = rnd('fbrick', v, h)
    brick = brick_ind(ctx, 'fb', '#5a3228', '#4e2a22', '#1e1616', h, seed=v * 0.37)
    B.box(0, 0, 0, 1, 1, h - 0.1, brick)
    coping = gm(ctx, 'coping', '#5a463c', dirt=0.5, rough=0.85, scale=6, streak=0.5, seed=4)
    for face in ('x', 'y'):
        fb(B, face, 0, 1, h - 0.12, h, 0.0, 0.03, coping)
        fb(B, face, 0, 1, 0, 0.18, 0.0, 0.02, gm(ctx, 'fbPlinth', '#2e2420', dirt=0.4, rough=0.9, seed=2))
    B.box(0, 0, h - 0.1, 1, 1, 0.1, gm(ctx, 'tar', '#2e2220', dirt=0.4, rough=0.95, scale=10, streak=1, seed=1))
    if h >= 2.5 and v % 4 != 3:
        steel = M(ctx, '#26262a', 0.5, 0.5, key='winSteel')
        sill = gm(ctx, 'sill', '#6a6460', dirt=0.4, rough=0.85, seed=3)
        z0, z1 = 0.6, h - 0.5
        for face in ('x', 'y'):
            lit = R.random() < 0.6
            glL = M(ctx, '#3a2010', 0.3, 0, emit='#ffb050', es=2.4, key='fwinLit')
            glL2 = M(ctx, '#3a2010', 0.3, 0, emit='#d87a30', es=1.8, key='fwinLit2')
            glD = M(ctx, '#1e2430', 0.08, 0.3, key='fwinDark')
            broken = M(ctx, '#060608', 0.9, key='fwinBroken')
            fb(B, face, 0.19, 0.81, z1, z1 + 0.14, 0.0, 0.03, sill)          # lintel
            fb(B, face, 0.17, 0.83, z0 - 0.1, z0, 0.0, 0.07, sill)           # sill
            fb(B, face, 0.19, 0.81, z0, z1, -0.002, 0.004, steel)            # frame back
            nr = max(2, int(round((z1 - z0) / 0.36)))
            for r in range(nr):
                za, zb = z0 + (z1 - z0) * r / nr, z0 + (z1 - z0) * (r + 1) / nr
                for c in range(4):
                    ua, ub = 0.19 + 0.155 * c, 0.19 + 0.155 * (c + 1)
                    mat = glD
                    if lit: mat = glL if (r + c) % 3 else glL2
                    if R.random() < 0.08: mat = broken
                    fb(B, face, ua + 0.012, ub - 0.012, za + 0.02, zb - 0.02, 0.0, 0.008, mat)
            for c in range(5):
                u = 0.19 + 0.155 * c
                fb(B, face, u - 0.012, u + 0.012, z0, z1, 0.0, 0.016, steel)
            for r in range(nr + 1):
                z = z0 + (z1 - z0) * r / nr
                fb(B, face, 0.19, 0.81, z - 0.02, z + 0.02, 0.0, 0.016, steel)
            # opening hopper on lit windows
            if lit and R.random() < 0.5:
                fb(B, face, 0.36, 0.64, z1 - (z1 - z0) / nr + 0.02, z1 - 0.02, 0.01, 0.06, glL)
    elif v % 4 == 3:  # downpipe + wall vent
        pipe = M(ctx, '#22262a', 0.45, 0.5, key='castpipe')
        B.cyl(0.5, 1.07, 0, 0.05, h - 0.2, pipe, 10)
        B.box(0.42, 1.0, h - 0.5, 0.16, 0.16, 0.3, pipe)
        z = 0.6
        while z < h - 0.6:
            B.box(0.44, 1.0, z, 0.12, 0.1, 0.06, pipe); z += 1.2
        fb(B, 'x', 0.35, 0.65, h - 1.4, h - 0.9, 0.0, 0.03, M(ctx, '#3a3a3e', 0.6, 0.4, key='airbrick'))
        for i in range(4): fb(B, 'x', 0.37, 0.63, h - 1.37 + i * 0.12, h - 1.33 + i * 0.12, 0.03, 0.035, M(ctx, '#0e0e10', 0.9, key='slot'))
    else:  # short walls: blank brick with a pilaster
        fb(B, 'y', 0.0, 0.12, 0, h - 0.12, 0.0, 0.05, brick)
    B.flush()


def w_shutter(ctx, h, v):
    B = Batch(ctx)
    slatA = gm(ctx, 'slatA', '#7a828c', rust=0.15, dirt=0.25, rough=0.45, metal=0.55, scale=3, streak=0.1, seed=v)
    slatB = gm(ctx, 'slatB', '#5a626c', rust=0.15, dirt=0.3, rough=0.5, metal=0.5, scale=3, streak=0.1, seed=v + 1)
    guide = M(ctx, '#26282c', 0.5, 0.5, key='guide')
    box = gm(ctx, 'coil', '#30343a', rust=0.2, dirt=0.3, rough=0.5, metal=0.5, seed=2)
    haz = stripe_mat(ctx, 'shutHaz', '#d8b020', '#1e1e22', freq=4.0, axes='xyz', worn=0.4)
    B.box(0, 0, 0, 0.96, 0.96, h, M(ctx, '#2e3238', 0.7, 0.3, key='shutCore'))
    for face in ('x', 'y'):
        z = 0.3; i = 0
        while z < h - 0.36:
            fb(B, face, 0.06, 0.94, z, min(z + 0.14, h - 0.36), -0.04, -0.005 if i % 2 else 0.0, slatA if i % 2 == 0 else slatB, bev=0.006)
            z += 0.14; i += 1
        fb(B, face, 0.06, 0.94, 0.02, 0.3, -0.04, 0.012, haz)                 # bottom bar
        fb(B, face, 0.0, 0.065, 0, h - 0.3, -0.04, 0.035, guide)
        fb(B, face, 0.935, 1.0, 0, h - 0.3, -0.04, 0.035, guide)
        fb(B, face, 0.0, 1.0, h - 0.36, h, -0.04, 0.07, box, bev=0.01)        # coil box
        fb(B, face, 0.45, 0.55, 0.12, 0.2, 0.012, 0.04, M(ctx, '#8a8e96', 0.3, 0.8, key='handle'))
    B.box(0, 0, h - 0.02, 1, 1, 0.02, M(ctx, '#2e3238', 0.7, 0.3, key='shutTop'))
    if v == 1:  # padlock + dented slat
        fb(B, 'y', 0.48, 0.53, 0.06, 0.13, 0.04, 0.06, M(ctx, '#d8b030', 0.3, 0.8, key='padlock'))
        fb(B, 'x', 0.25, 0.5, 1.1, 1.24, -0.06, -0.03, slatB)
    B.flush()


def w_shelf(ctx, h, v):
    """pallet racking, two-sided, 1 tile deep: orange uprights, blue beams, goods on pallets; empty slots see-through"""
    B = Batch(ctx)
    R = rnd('shelf', v)
    up = gm(ctx, 'rackUp', '#e07a1a', dirt=0.25, rough=0.5, metal=0.2, scale=6, streak=0.3, seed=1)
    beam = gm(ctx, 'rackBeam', '#2a5aa8', dirt=0.2, rough=0.45, metal=0.2, scale=6, streak=2, seed=2)
    deck = gm(ctx, 'rackDeck', '#b08a58', dirt=0.35, rough=0.85, scale=8, streak=3, seed=3)
    mesh = M(ctx, '#8a9098', 0.5, 0.6, key='rackMesh')
    for x in (0.0, 0.93):
        for y in (0.02, 0.92):
            B.box(x, y, 0, 0.07, 0.06, h, up, bev=0.006)
        # frame bracing on the uprights' frame (along y) — visible on the +x end
        for k in range(3):
            za, zb = 0.15 + k * 0.82, 0.15 + (k + 1) * 0.82
            if zb > h: break
            B.rod((x + 0.035, 0.08, za), (x + 0.035, 0.92, zb), 0.012, up)
        for z in (0.15, h - 0.1):
            B.box(x + 0.01, 0.05, z, 0.05, 0.88, 0.04, up)
    levels = [0.0, 0.88, 1.74]
    tops = levels[1:] + [h]
    for li, zl in enumerate(levels):
        zt = tops[li]
        if li > 0:
            for y in (0.0, 0.92):
                B.box(0.0, y, zl - 0.12, 1.0, 0.08, 0.12, beam, bev=0.006)
            B.box(0.02, 0.06, zl - 0.03, 0.96, 0.88, 0.03, mesh)
        avail = zt - zl - (0.16 if li < len(levels) - 1 else 0.12)
        k = R.random()
        if k < 0.2: continue
        zb = zl + (0.0 if li == 0 else 0.0)
        # pallet
        B.box(0.06, 0.08, zb, 0.88, 0.84, 0.12, deck)
        hg = avail - 0.12 - R.random() * 0.25
        if hg < 0.2: continue
        z1 = zb + 0.12
        if k < 0.6:  # cardboard boxes
            card = gm(ctx, 'card%d' % (li % 2), '#a87a48', dirt=0.25, rough=0.85, scale=6, seed=li + v)
            card2 = gm(ctx, 'card2', '#c89a5e', dirt=0.2, rough=0.85, scale=6, seed=9)
            tape = M(ctx, '#d8c8a0', 0.4, key='tape')
            nz = 2 if hg > 0.5 else 1
            bh = hg / nz
            for iz in range(nz):
                for ix in range(2):
                    for iy in range(2):
                        if R.random() < 0.12: continue
                        x0, y0 = 0.08 + ix * 0.42 + R.random() * 0.03, 0.1 + iy * 0.4 + R.random() * 0.03
                        B.box(x0, y0, z1 + iz * bh, 0.4, 0.38, bh - 0.01, card if (ix + iy + iz) % 2 else card2, bev=0.008)
                        B.box(x0 + 0.17, y0 - 0.002, z1 + iz * bh + bh - 0.02, 0.06, 0.384, 0.012, tape)
                        B.box(x0 + 0.17, y0 + 0.378, z1 + iz * bh + bh * 0.4, 0.06, 0.006, bh * 0.6 - 0.01, tape)
        elif k < 0.82:  # blue plastic crates
            pc = M(ctx, '#2e5aa0', 0.45, key='pcrate'); pcl = M(ctx, '#5a8ad8', 0.4, key='pcrateL')
            n = max(1, int(hg / 0.28))
            for iz in range(n):
                for ix in range(2):
                    B.box(0.1 + ix * 0.41, 0.12, z1 + iz * 0.28, 0.38, 0.76, 0.26, pc, bev=0.01)
                    B.box(0.12 + ix * 0.41, 0.885, z1 + iz * 0.28 + 0.06, 0.34, 0.01, 0.06, pcl)
                    B.box(0.88 + ix * 0.0, 0.2, z1 + iz * 0.28 + 0.06, 0.01, 0.6, 0.06, pcl) if ix == 1 else None
        else:  # shrink-wrapped load
            wrap = gm(ctx, 'wrap', '#b4bac2', dirt=0.15, rough=0.25, scale=12, streak=4, seed=5)
            B.box(0.09, 0.11, z1, 0.82, 0.78, hg, wrap, bev=0.03)
            for z in (z1 + hg * 0.3, z1 + hg * 0.7):
                B.box(0.085, 0.105, z, 0.83, 0.79, 0.03, M(ctx, '#e8ecf0', 0.2, key='wrapband'))
    # top deck (the block's roof): plywood on beams
    B.box(0.02, 0.04, h - 0.03, 0.96, 0.92, 0.03, deck)
    for y in (0.0, 0.92): B.box(0.0, y, h - 0.12, 1.0, 0.08, 0.12, beam)
    B.flush()


def w_mesh_y(ctx, h, v):
    """chain-link fence on the tile's +x edge (runs along world y), barbed wire on top"""
    B = Batch(ctx)
    post = gm(ctx, 'fpost', '#6a7078', rust=0.3, dirt=0.25, rough=0.4, metal=0.7, scale=5, seed=3)
    wire = M(ctx, '#8a929c', 0.35, 0.8, key='chainwire')
    x = 0.94
    B.cyl(x, 0.97, 0, 0.035, h, post, 10)
    B.box(x - 0.06, 0.91, 0, 0.12, 0.12, 0.05, M(ctx, '#5a5a5e', 0.9, key='footing'))
    zt = h - 0.32
    B.rod((x, 0.0, zt), (x, 1.0, zt), 0.018, post)
    B.rod((x, 0.0, 0.08), (x, 1.0, 0.08), 0.01, wire)
    # chain-link diamonds
    sp = 0.1
    zz0, zz1 = 0.08 * UNIT, zt * UNIT
    hm = zz1 - zz0
    k = -int(hm / sp) - 1
    while k * sp < 1.0:
        a0 = k * sp
        # rising diagonal: y = a0 + s, z = s ; falling: y = a0 + hm - s
        for sgn in (1, -1):
            ys, ye = (a0, a0 + hm) if sgn > 0 else (a0 + hm, a0)
            # clip to y in [0,1]
            def clip(y0, y1):
                t0, t1 = 0.0, 1.0
                dy = y1 - y0
                if abs(dy) < 1e-9: return None
                for lim in (0.0, 1.0):
                    t = (lim - y0) / dy
                    if dy > 0:
                        if lim == 0.0: t0 = max(t0, t)
                        else: t1 = min(t1, t)
                    else:
                        if lim == 0.0: t1 = min(t1, t)
                        else: t0 = max(t0, t)
                return (t0, t1) if t1 > t0 else None
            c = clip(ys, ye)
            if c:
                t0, t1 = c
                p0 = (x, ys + (ye - ys) * t0, (zz0 + hm * t0) / UNIT)
                p1 = (x, ys + (ye - ys) * t1, (zz0 + hm * t1) / UNIT)
                B.rod(p0, p1, 0.0065, wire, seg=4)
        k += 1
    # barbed wire arm leaning outwards (+x) and strands
    arm_top = (x + 0.18, 0.97, h)
    B.rod((x, 0.97, zt), arm_top, 0.014, post)
    barb = M(ctx, '#9aa0a8', 0.35, 0.8, key='barb')
    for i in range(3):
        f = (i + 1) / 3
        px, pz = x + 0.18 * f, zt + (h - zt) * f
        B.rod((px, 0.0, pz), (px, 1.0, pz), 0.006, barb, seg=4)
        for j in range(7):
            yb = (j + 0.5 + (i % 2) * 0.5) / 7.5
            B.rod((px - 0.025, yb - 0.02, pz - 0.03), (px + 0.025, yb + 0.02, pz + 0.03), 0.004, barb, seg=3)
    if v == 1:  # warning plate
        pl = M(ctx, '#d8b020', 0.5, key='warnplate')
        B.box(x + 0.012, 0.35, 1.0, 0.012, 0.3, 0.35, pl)
        B.box(x + 0.025, 0.44, 1.07, 0.004, 0.12, 0.2, M(ctx, '#1a1a1e', 0.6, key='warnInk'))
    # top-rail cap visible on the block top
    B.flush()


def w_hut(ctx, h, v):
    B = Batch(ctx)
    R = rnd('hut', v)
    render = gm(ctx, 'hutRender', '#d4d0c4', dirt=0.35, rough=0.9, scale=5, streak=0.25, seed=v, bump=0.3)
    trim = M(ctx, '#2a4a8a', 0.5, 0.1, key='hutTrim')
    base = gm(ctx, 'hutBase', '#6a6a70', dirt=0.4, rough=0.9, seed=2)
    B.box(0, 0, 0, 0.98, 0.98, h - 0.12, render)
    for face in ('x', 'y'):
        fb(B, face, 0, 1, 0, 0.25, -0.02, 0.02, base)
        fb(B, face, 0, 1, h - 0.16, h, -0.02, 0.05, trim)
    B.box(0, 0, h - 0.12, 1, 1, 0.1, gm(ctx, 'hutRoof', '#4a4a52', dirt=0.4, rough=0.8, seed=6, scale=8))
    if v != 2:
        for face in ('x', 'y'):
            lit = face == 'y' or v == 1
            gl = M(ctx, '#5a3a10', 0.2, 0, emit='#ffe08a' if face == 'y' else '#e8b860', es=2.0 if face == 'y' else 1.2, key='hutGlass' + face) if lit else M(ctx, '#202a38', 0.1, 0.2, key='hutDark')
            fb(B, face, 0.12, 0.88, 1.0, 2.02, -0.02, 0.02, trim)
            fb(B, face, 0.15, 0.85, 1.04, 1.98, 0.0, 0.025, gl)
            fb(B, face, 0.48, 0.52, 1.04, 1.98, 0.0, 0.04, trim)
            fb(B, face, 0.1, 0.9, 0.94, 1.0, 0.0, 0.08, trim)
            if lit:  # blind half down
                fb(B, face, 0.15, 0.85, 1.6, 1.98, 0.025, 0.03, M(ctx, '#e8dcb0', 0.6, 0, emit='#ffd890', es=0.5, key='hutBlind'))
    else:  # notice board + CCTV
        fb(B, 'y', 0.2, 0.8, 1.0, 1.7, 0.0, 0.04, M(ctx, '#3a2a1a', 0.8, key='nb'))
        for i, c in enumerate(('#f0ece0', '#ffe08a', '#f0ece0')):
            fb(B, 'y', 0.25 + i * 0.18, 0.4 + i * 0.18, 1.1 + (i % 2) * 0.15, 1.5 + (i % 2) * 0.1, 0.04, 0.045, M(ctx, c, 0.8, key='paper' + c))
        cam = M(ctx, '#d8d8d0', 0.4, key='cctv')
        B.rod((0.92, 0.92, h - 0.3), (1.08, 1.08, h - 0.25), 0.02, M(ctx, '#2a2a30', 0.4, 0.6, key='bracket'))
        B.box(1.0, 1.0, h - 0.33, 0.16, 0.16, 0.14, cam)
        B.sphere(1.12, 1.12, h - 0.26, 0.02, M(ctx, '#ff2020', 0.3, 0, emit='#ff2020', es=4, key='cctvLed'))
    if v == 3:  # aircon unit
        B.box(0.25, 1.0, 0.3, 0.5, 0.22, 0.5, gm(ctx, 'ac', '#c8c8c0', dirt=0.3, rough=0.6, seed=4))
        B.cyl(0.5, 1.23, 0.36, 0.17, 0.38, M(ctx, '#2a2a2e', 0.6, key='acfan'), 16)
    B.flush()


def w_kabin(ctx, h, v):
    B = Batch(ctx)
    R = rnd('kabin', v)
    panel = gm(ctx, 'kabinP', '#c8c0a0', dirt=0.35, rough=0.7, metal=0.1, scale=4, streak=0.2, seed=v)
    seam = M(ctx, '#8a8268', 0.6, key='kabinSeam')
    top = M(ctx, '#6a6450', 0.6, 0.2, key='kabinTop')
    skirt = gm(ctx, 'kabinSkirt', '#2a4a8a', dirt=0.4, rough=0.6, metal=0.2, seed=3)
    B.box(0, 0, 0, 0.98, 0.98, h - 0.1, panel)
    for face in ('x', 'y'):
        fb(B, face, 0, 1, 0, 0.25, -0.02, 0.02, skirt)
        fb(B, face, 0, 1, h - 0.15, h, -0.02, 0.05, top)
        for u in (0.0, 0.5):
            fb(B, face, u, u + 0.025, 0.25, h - 0.15, -0.02, 0.012, seam)
    B.box(0, 0, h - 0.1, 1, 1, 0.08, gm(ctx, 'kabinRoof', '#5a5a50', dirt=0.5, rough=0.7, metal=0.2, seed=8, scale=6))
    frame = M(ctx, '#4a4a50', 0.5, 0.3, key='kabinFrame')
    for face in ('x', 'y'):
        kind = (v + (0 if face == 'y' else 1)) % 4
        if kind == 3:  # vent grille + sticker
            fb(B, face, 0.6, 0.8, 1.7, 1.9, 0.0, 0.02, frame)
            for i in range(4): fb(B, face, 0.61, 0.79, 1.72 + i * 0.045, 1.74 + i * 0.045, 0.02, 0.025, M(ctx, '#1a1a1e', 0.8, key='grilleSlot'))
            fb(B, face, 0.2, 0.42, 1.0, 1.3, 0.0, 0.006, M(ctx, '#e8e4d8', 0.7, key='notice'))
            fb(B, face, 0.22, 0.4, 1.22, 1.27, 0.006, 0.008, M(ctx, '#c8102e', 0.7, key='noticeR'))
            continue
        lit = kind != 2
        gl = M(ctx, '#5a3a10', 0.2, 0, emit='#ffd890', es=1.8, key='kabinLit') if lit else M(ctx, '#202a38', 0.1, 0.2, key='kabinDark')
        fb(B, face, 0.17, 0.83, 1.28, 1.98, -0.01, 0.025, frame)
        fb(B, face, 0.2, 0.8, 1.31, 1.95, 0.0, 0.03, gl)
        fb(B, face, 0.49, 0.51, 1.31, 1.95, 0.0, 0.04, frame)
        if lit:  # venetian blinds half drawn
            for i in range(5):
                fb(B, face, 0.2, 0.8, 1.66 + i * 0.06, 1.69 + i * 0.06, 0.03, 0.034, M(ctx, '#e8e0c0', 0.6, 0, emit='#ffe0a0', es=0.4, key='kabinBlind'))
        # security grille bars
        for i in range(6):
            u = 0.22 + i * 0.11
            fb(B, face, u, u + 0.012, 1.31, 1.95, 0.04, 0.052, M(ctx, '#3a3a40', 0.4, 0.6, key='bars'))
    B.flush()


def mezz_edge(ctx, B, z1):
    """steel mezzanine edge face (0..z1) with hazard tape on top and bolts"""
    steel = gm(ctx, 'mezzSteel', '#585e68', rust=0.15, dirt=0.3, rough=0.5, metal=0.5, scale=4, streak=0.4, seed=2)
    haz = stripe_mat(ctx, 'mezzHaz', '#d8b020', '#1e1e22', freq=5.0, axes='xyz', worn=0.3)
    bolt = M(ctx, '#9aa0a8', 0.35, 0.8, key='bolt')
    B.box(0, 0, 0, 0.99, 0.99, z1 - 0.15, steel)
    for face in ('x', 'y'):
        fb(B, face, 0, 1, z1 - 0.16, z1 - 0.02, -0.01, 0.012, haz)
        fb(B, face, 0, 1, z1 - 0.32, z1 - 0.16, -0.01, 0.02, steel)
        for u in (0.25, 0.75):
            for z in (z1 - 0.26, 0.3):
                x, y = fpt(face, u, 0.025)
                B.sphere(x, y, z, 0.018, bolt, seg=6)
        # stiffener under the deck
        fb(B, face, 0.47, 0.53, 0, z1 - 0.32, -0.01, 0.015, steel)


def lino_top(ctx, B, z):
    a = gm(ctx, 'linoA', '#7e7464', dirt=0.25, rough=0.5, scale=8, streak=1, seed=1)
    b = gm(ctx, 'linoB', '#625c52', dirt=0.25, rough=0.5, scale=8, streak=1, seed=2)
    gr = M(ctx, '#4a463e', 0.8, key='linoGrout')
    B.box(0, 0, z - 0.02, 1, 1, 0.02, gr)
    for i in range(2):
        for j in range(2):
            B.box(i * 0.5 + 0.012, j * 0.5 + 0.012, z - 0.02, 0.476, 0.476, 0.025, a if (i + j) % 2 else b)


def w_mezz(ctx, h, v):
    B = Batch(ctx)
    mezz_edge(ctx, B, h)
    lino_top(ctx, B, h)
    B.flush()


def w_partition(ctx, h, v):
    """office partition standing on the mezzanine edge: low panel, glass with blinds (see-through), frame"""
    B = Batch(ctx)
    zm = 1.2
    mezz_edge(ctx, B, zm)
    lino_top(ctx, B, zm)
    frame = M(ctx, '#3a3e46', 0.45, 0.5, key='partFrame')
    low = gm(ctx, 'partLow', '#8a8070', dirt=0.3, rough=0.7, seed=4)
    glass = M(ctx, '#8aa8c0', 0.05, 0.0, key='partGlass', alpha=0.22)
    blind = M(ctx, '#d8d4c0', 0.6, 0, emit='#fff0d0', es=0.25, key='partBlind')
    for face in ('x', 'y'):
        d0, d1 = -0.06, -0.01
        fb(B, face, 0, 1, zm, zm + 0.45, d0, d1, low)
        fb(B, face, 0, 1, zm + 0.45, zm + 0.5, d0 - 0.01, d1 + 0.01, frame)
        fb(B, face, 0, 1, h - 0.1, h, d0 - 0.01, d1 + 0.01, frame)
        fb(B, face, 0, 1, zm + 0.5, h - 0.1, -0.04, -0.03, glass)
        for u in (0.0, 0.96):
            fb(B, face, u, u + 0.04, zm, h, d0 - 0.01, d1 + 0.01, frame)
        # venetian blinds: drawn ~2/3 down, slats with gaps
        z = h - 0.14; i = 0
        zb = zm + 0.5 + (h - zm - 0.6) * (0.35 if v % 2 else 0.5)
        while z > zb:
            fb(B, face, 0.04, 0.96, z - 0.035, z, -0.055, -0.045, blind)
            z -= 0.075; i += 1
        fb(B, face, 0.04, 0.96, z - 0.02, z + 0.005, -0.06, -0.04, frame)
    B.flush()


def w_step(ctx, h, v):
    B = Batch(ctx)
    steel = gm(ctx, 'stepSteel', '#4a4e56', rust=0.15, dirt=0.3, rough=0.45, metal=0.6, scale=4, seed=1)
    tread = gm(ctx, 'tread', '#5c6068', dirt=0.25, rough=0.4, metal=0.7, scale=6, seed=2)
    stud = M(ctx, '#8c9098', 0.3, 0.8, key='treadStud')
    yel = stripe_mat(ctx, 'nosing', '#d8b020', '#d8b020', worn=0.35)
    B.box(0, 0, 0, 1, 1, h - 0.02, steel)
    B.box(0, 0, h - 0.02, 1, 0.86, 0.02, tread)
    B.box(0, 0.86, h - 0.03, 1, 0.14, 0.03, yel)
    for face in ('x', 'y'):
        fb(B, face, 0, 1, h - 0.1, h - 0.02, 0.0, 0.006, yel)
    for i in range(8):
        for j in range(7):
            x, y = (i + 0.5) / 8, (j + 0.5) / 8
            ang = math.pi / 4 if (i + j) % 2 else -math.pi / 4
            B.obox(x, y, h, 0.075, 0.018, 0.012, ang, stud)
    B.flush()


def w_crates(ctx, h, v):
    """one big slatted shipping crate filling the block"""
    B = Batch(ctx)
    wood = gm(ctx, 'crateW', '#8a6038', dirt=0.3, rough=0.85, scale=6, streak=6, seed=v)
    wood2 = gm(ctx, 'crateW2', '#a07848', dirt=0.25, rough=0.85, scale=6, streak=6, seed=v + 2)
    dark = gm(ctx, 'crateD', '#5e3e20', dirt=0.3, rough=0.9, scale=6, streak=6, seed=4)
    B.box(0.01, 0.01, 0, 0.97, 0.97, h - 0.01, M(ctx, '#3a2614', 0.9, key='crateGap'))
    n = 5
    for face in ('x', 'y'):
        for k in range(n):
            za, zb = 0.06 + k * (h - 0.12) / n, 0.06 + (k + 1) * (h - 0.12) / n
            fb(B, face, 0.06, 0.94, za + 0.008, zb - 0.008, -0.03, -0.005, wood if k % 2 else wood2)
        # frame
        for (ua, ub) in ((0.0, 0.08), (0.92, 1.0)):
            fb(B, face, ua, ub, 0, h, -0.03, 0.012, dark, bev=0.004)
        fb(B, face, 0.0, 1.0, 0.0, 0.08, -0.03, 0.012, dark, bev=0.004)
        fb(B, face, 0.0, 1.0, h - 0.08, h, -0.03, 0.012, dark, bev=0.004)
        # diagonal brace
        a, b = fpt(face, 0.08, 0.008), fpt(face, 0.92, 0.008)
        if v % 2 == 0: B.rod((a[0], a[1], 0.12), (b[0], b[1], h - 0.12), 0.03, dark, seg=4)
        else: B.rod((a[0], a[1], h - 0.12), (b[0], b[1], 0.12), 0.03, dark, seg=4)
        if face == 'y':  # stencil marks
            st = M(ctx, '#1e140c', 0.9, key='crateInk')
            fb(B, face, 0.2, 0.36, h * 0.62, h * 0.7, 0.0, 0.004, st)
            fb(B, face, 0.62, 0.8, h * 0.3, h * 0.36, 0.0, 0.004, st)
    B.box(0, 0, h - 0.04, 1, 1, 0.04, wood2)
    for k in range(4): B.box(k / 4 + 0.02, 0, h, 0.21, 1, 0.012, wood if k % 2 else wood2)
    B.flush()


# ================================================================== FLOORS
def yard_base(ctx, n):
    B = Batch(ctx)
    ctx.plane(0, 0, n, n, fmat(ctx, 'yard', '#2c2a30', '#3c3940', n, scale=30, big='#1c1b20', big_amt=0.45, rough=0.8, bump=0.35))
    R = rnd('yard', n)
    stain = M(ctx, '#18161c', 0.25, key='oilstain', alpha=0.85)
    stain2 = M(ctx, '#232128', 0.4, key='oilstain2', alpha=0.7)
    sheen = M(ctx, '#3a3448', 0.12, 0.3, key='oilsheen', alpha=0.6)
    for i in range(5):
        cx, cy = R.random() * n, R.random() * n
        r = 0.18 + R.random() * 0.25
        B.cyl(cx, cy, 0.0005, r * 1.25, 0.0008, stain2, 20)
        B.cyl(cx + 0.05, cy, 0.001, r, 0.0008, stain, 20)
        if R.random() < 0.6: B.cyl(cx - r * 0.3, cy - r * 0.2, 0.0015, r * 0.35, 0.0006, sheen, 14)
    crack = M(ctx, '#18171c', 0.9, key='crack')
    for i in range(4):
        x, y = R.random() * n, R.random() * n
        ang = R.random() * math.pi
        for s in range(7):
            ang += (R.random() - 0.5) * 0.9
            nx, ny = x + math.cos(ang) * 0.22, y + math.sin(ang) * 0.22
            B.obox((x + nx) / 2, (y + ny) / 2, 0.0, 0.24, 0.018, 0.002, ang, crack)
            x, y = nx, ny
    patch = fmat(ctx, 'yardPatch', '#26252a', '#302e34', n, scale=40, rough=0.75, bump=0.4)
    for i in range(2):
        x, y = R.randrange(n), R.randrange(n)
        B.box(x + 0.15, y + 0.2, 0, 0.7 + R.random() * 0.5, 0.5 + R.random() * 0.4, 0.003, patch)
    B.flush()


def floor_yard(ctx, n):
    yard_base(ctx, n)


def floor_yard_line_x(ctx, n):
    yard_base(ctx, n)
    paint = worn_paint(ctx, 'yardline', '#d0a42c', '#7a6428', n)
    for j in range(n): ctx.box(0, j + 0.44, 0, n, 0.12, 0.004, paint)


def worn_paint(ctx, key, col, worn_col, n, alpha=1.0):
    k = 'wp|%s|%d' % (key, n)
    if k in ctx.mats: return ctx.mats[k]
    m, N, L, b, co = ctx.nodemat(k)
    tc = co.node
    v, w = ctx.periodic_vector(N, L, tc, n)
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 9; nz.inputs['Detail'].default_value = 8
    L.new(v, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
    rp = N.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].position = 0.42; rp.color_ramp.elements[1].position = 0.58
    rp.color_ramp.elements[0].color = (*_lin(worn_col), 1); rp.color_ramp.elements[1].color = (*_lin(col), 1)
    L.new(nz.outputs['Fac'], rp.inputs['Fac'])
    L.new(rp.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.6
    ctx.mats[k] = m
    return m


def slab_base(ctx, n):
    B = Batch(ctx)
    R = rnd('slab', n)
    mats = [fmat(ctx, 'slab%d' % k, c, shade(c, 0.08), n, scale=26, big='#2a302c', big_amt=0.35, rough=0.5, bump=0.18, spec=0.6)
            for k, c in enumerate(('#4a524e', '#464e4a', '#4e5652'))]
    ctx.plane(0, 0, n, n, M(ctx, '#2c322f', 0.9, key='slabJoint'), gz=-0.002)
    for i in range(n):
        for j in range(n):
            B.box(i + 0.015, j + 0.015, 0, 0.97, 0.97, 0.004, mats[(i * 7 + j * 3) % 3])
    scuff = M(ctx, '#2a2e2c', 0.6, key='scuff', alpha=0.55)
    for j in range(n):
        for i in range(n):
            if R.random() < 0.35:
                for vv in (0.3, 0.7):
                    B.box(i + R.random() * 0.3, j + vv - 0.03, 0.0045, 0.5 + R.random() * 0.5, 0.06, 0.0005, scuff)
    B.flush()


def floor_slab(ctx, n): slab_base(ctx, n)


def floor_slab_line_x(ctx, n):
    slab_base(ctx, n)
    paint = worn_paint(ctx, 'slabline', '#d8b030', '#8a7a3a', n)
    for j in range(n): ctx.box(0, j + 0.43, 0, n, 0.14, 0.006, paint)


def factory_base(ctx, n):
    B = Batch(ctx)
    R = rnd('factory', n)
    ctx.plane(0, 0, n, n, fmat(ctx, 'factory', '#36322f', '#45403d', n, scale=28, big='#221e1c', big_amt=0.4, rough=0.7, bump=0.3))
    joint = M(ctx, '#24211f', 0.9, key='fjoint')
    for i in range(2 * n):
        B.box(i * 0.5 - 0.012, 0, 0.0, 0.024, n, 0.002, joint)
        B.box(0, i * 0.5 - 0.012, 0.0, n, 0.024, 0.002, joint)
    oil = M(ctx, '#1e1a1a', 0.2, key='foil', alpha=0.8)
    sheen = M(ctx, '#3e3450', 0.1, 0.3, key='fsheen', alpha=0.5)
    for i in range(4):
        cx, cy = R.random() * n, R.random() * n
        r = 0.15 + R.random() * 0.2
        B.cyl(cx, cy, 0.003, r, 0.0008, oil, 18)
        B.cyl(cx + 0.05, cy - 0.04, 0.0035, r * 0.4, 0.0005, sheen, 12)
    # swarf / bolts
    for i in range(10):
        B.cyl(R.random() * n, R.random() * n, 0.003, 0.012, 0.01, M(ctx, '#8a8e96', 0.3, 0.8, key='swarf'), 6)
    B.flush()


def floor_factory(ctx, n): factory_base(ctx, n)


def floor_factory_line(axis):
    def build(ctx, n):
        factory_base(ctx, n)
        paint = worn_paint(ctx, 'fline', '#d8b030', '#8a7a3a', n)
        for j in range(n):
            if axis == 'x': ctx.box(0, j + 0.44, 0, n, 0.12, 0.006, paint)
            else: ctx.box(j + 0.44, 0, 0, 0.12, n, 0.006, paint)
    return build


def floor_lino(ctx, n):
    B = Batch(ctx)
    a = fmat(ctx, 'linoFA', '#7e7464', '#867c6c', n, scale=30, big='#5a5246', big_amt=0.3, rough=0.45, bump=0.08)
    b = fmat(ctx, 'linoFB', '#625c52', '#6a645a', n, scale=30, big='#4a4438', big_amt=0.3, rough=0.45, bump=0.08)
    ctx.plane(0, 0, n, n, M(ctx, '#4a463e', 0.8, key='linoGroutF'), gz=-0.002)
    for i in range(2 * n):
        for j in range(2 * n):
            B.box(i * 0.5 + 0.012, j * 0.5 + 0.012, 0, 0.476, 0.476, 0.004, a if (i + j) % 2 else b)
    B.flush()


def quay_base(ctx, n):
    B = Batch(ctx)
    R = rnd('quay', n)
    mats = [fmat(ctx, 'quay%d' % k, c, shade(c, 0.1), n, scale=60, big='#3a3832', big_amt=0.35, rough=0.75, bump=0.3, detail=10)
            for k, c in enumerate(('#55534c', '#5c5a52', '#504e48', '#5a5850'))]
    ctx.plane(0, 0, n, n, M(ctx, '#2e2c28', 0.9, key='quayJoint'), gz=-0.002)
    for i in range(n):
        for j in range(n):
            B.box(i + 0.02, j + 0.02, 0, 0.96, 0.96, 0.01, mats[R.randrange(4)], bev=0.008)
    chip = M(ctx, '#46443e', 0.9, key='quayChip')
    for i in range(14):
        B.cyl(R.random() * n, R.random() * n, 0.006, 0.02 + R.random() * 0.04, 0.005, chip, 7)
    B.flush()


def floor_quay(ctx, n): quay_base(ctx, n)


def floor_quay_edge(ctx, n):
    quay_base(ctx, n)
    B = Batch(ctx)
    paint = worn_paint(ctx, 'quayline', '#d8b030', '#8a7a3a', n)
    lip = fmat(ctx, 'quayLip', '#7a7870', '#8a887e', n, scale=50, rough=0.7, bump=0.4)
    edge = M(ctx, '#1c1c1e', 0.8, key='quayDrop')
    for j in range(n):
        B.box(0, j + 0.72, 0, n, 0.12, 0.014, paint)
        B.box(0, j + 0.885, 0, n, 0.12, 0.05, lip, bev=0.01)
        B.box(0, j + 0.95, 0, n, 0.05, 0.002, edge)
    B.flush()
    # rusty edge rail strip
    for j in range(n): ctx.box(0, j + 0.93, 0.05, n, 0.025, 0.02, M(ctx, '#5a3a24', 0.6, 0.5, key='edgeRail'))


def floor_water(ctx, n):
    k = 'water|%d' % n
    m, N, L, b, co = ctx.nodemat(k)
    tc = co.node
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    # waves: sin(2pi*(3*gx + gy)/n + distortion) — periodic over the patch
    gx, gy = sep.outputs[1], sep.outputs[0]
    m1 = N.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; m1.inputs[1].default_value = 2 * math.pi * 3 / n; L.new(gx, m1.inputs[0])
    m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; m2.inputs[1].default_value = 2 * math.pi * 1 / n; L.new(gy, m2.inputs[0])
    a = N.new('ShaderNodeMath'); a.operation = 'ADD'; L.new(m1.outputs[0], a.inputs[0]); L.new(m2.outputs[0], a.inputs[1])
    v, w = ctx.periodic_vector(N, L, tc, n)
    nz = N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'; nz.inputs['Scale'].default_value = 3; nz.inputs['Detail'].default_value = 4
    L.new(v, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
    dm = N.new('ShaderNodeMath'); dm.operation = 'MULTIPLY'; dm.inputs[1].default_value = 5.0; L.new(nz.outputs['Fac'], dm.inputs[0])
    a2 = N.new('ShaderNodeMath'); a2.operation = 'ADD'; L.new(a.outputs[0], a2.inputs[0]); L.new(dm.outputs[0], a2.inputs[1])
    s = N.new('ShaderNodeMath'); s.operation = 'SINE'; L.new(a2.outputs[0], s.inputs[0])
    nz2 = N.new('ShaderNodeTexNoise'); nz2.noise_dimensions = '4D'; nz2.inputs['Scale'].default_value = 14; nz2.inputs['Detail'].default_value = 6
    L.new(v, nz2.inputs['Vector']); L.new(w, nz2.inputs['W'])
    mixh = N.new('ShaderNodeMath'); mixh.operation = 'MULTIPLY_ADD'; mixh.inputs[1].default_value = 0.35
    L.new(nz2.outputs['Fac'], mixh.inputs[0]); L.new(s.outputs[0], mixh.inputs[2])
    rp = N.new('ShaderNodeValToRGB')
    rp.color_ramp.elements[0].position = 0.3; rp.color_ramp.elements[0].color = (*_lin('#0a1520'), 1)
    rp.color_ramp.elements[1].position = 1.0; rp.color_ramp.elements[1].color = (*_lin('#2a4660'), 1)
    e = rp.color_ramp.elements.new(0.82); e.color = (*_lin('#142636'), 1)
    L.new(mixh.outputs[0], rp.inputs['Fac'])
    L.new(rp.outputs['Color'], b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.35; bp.inputs['Distance'].default_value = 0.02
    L.new(mixh.outputs[0], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.18
    b.inputs['Metallic'].default_value = 0.0
    ctx.mats[k] = m
    ctx.plane(0, 0, n, n, m)


def floor_hatch(ctx, n):
    ctx.plane(0, 0, n, n, fmat(ctx, 'yard', '#2c2a30', '#3c3940', n, scale=30, big='#1c1b20', big_amt=0.45, rough=0.8, bump=0.35), gz=-0.001)
    ctx.box(0, 0, 0, n, n, 0.003, stripe_mat(ctx, 'hatch', '#d0a422', '#1e1d22', freq=3.0, axes='xy', worn=0.45, rough=0.6, period=n))
    # border line on each tile edge is not wanted (hatching is continuous); scuffs
    R = rnd('hatch')
    sc = M(ctx, '#2a2826', 0.8, key='hatchScuff', alpha=0.5)
    for i in range(6):
        ctx.box(R.random() * n, R.random() * n, 0.0035, 0.6, 0.05, 0.0005, sc)


def floor_belt(axis):
    def build(ctx, n):
        B = Batch(ctx)
        rubber = fmat(ctx, 'belt', '#1a1a1e', '#26262c', n, scale=50, rough=0.75, bump=0.25)
        rail = gm(ctx, 'beltRail', '#767a84', dirt=0.3, rough=0.4, metal=0.7, scale=5, seed=2)
        railD = M(ctx, '#2a2c30', 0.5, 0.5, key='beltRailD')
        bolt = M(ctx, '#3e4148', 0.4, 0.7, key='beltBolt')
        ctx.plane(0, 0, n, n, M(ctx, '#121214', 0.9, key='beltPit'), gz=-0.002)
        for j in range(n):
            if axis == 'x':
                B.box(0, j + 0.12, 0, n, 0.76, 0.012, rubber)
                for (a, b) in ((0.0, 0.12), (0.88, 1.0)):
                    B.box(0, j + a, 0, n, b - a, 0.04, rail)
                    B.box(0, j + (a if a == 0.0 else b - 0.025), 0, n, 0.025, 0.045, railD)
                    for i in range(4 * n):
                        B.cyl(i * 0.25 + 0.125, j + (a + b) / 2, 0.04, 0.02, 0.012, bolt, 8)
            else:
                B.box(j + 0.12, 0, 0, 0.76, n, 0.012, rubber)
                for (a, b) in ((0.0, 0.12), (0.88, 1.0)):
                    B.box(j + a, 0, 0, b - a, n, 0.04, rail)
                    B.box(j + (a if a == 0.0 else b - 0.025), 0, 0, 0.025, n, 0.045, railD)
                    for i in range(4 * n):
                        B.cyl(j + (a + b) / 2, i * 0.25 + 0.125, 0.04, 0.02, 0.012, bolt, 8)
        B.flush()
    return build


def floor_ramp(ctx, n):
    B = Batch(ctx)
    plate = gm(ctx, 'rampPlate', '#5a5e66', rust=0.35, dirt=0.3, rough=0.45, metal=0.6, scale=3, streak=1, seed=3)
    ridge = M(ctx, '#8a8e96', 0.35, 0.7, key='rampRidge')
    side = M(ctx, '#2a2c30', 0.5, 0.5, key='rampSide')
    B.box(0, 0, 0, n, n, 0.01, plate)
    for j in range(6 * n):
        B.box(0, j / 6 + 0.06, 0.01, n, 0.035, 0.02, ridge)
    for i in range(n):
        B.box(i, 0, 0, 0.06, n, 0.05, side); B.box(i + 0.94, 0, 0, 0.06, n, 0.05, side)
    B.flush()


def floor_rail(ctx, n):
    B = Batch(ctx)
    ctx.plane(0, 0, n, n, fmat(ctx, 'ballast', '#3a3632', '#56524a', n, scale=90, big='#2c2a28', big_amt=0.3, rough=0.95, bump=0.8, detail=4))
    R = rnd('rail')
    stone = [M(ctx, c, 0.9, key='ballast' + c) for c in ('#4a4640', '#56524a', '#3a3632')]
    for i in range(int(60 * n * n / 4)):
        B.sphere(R.random() * n, R.random() * n, 0.0, 0.018 + R.random() * 0.012, R.choice(stone), seg=5, sz=0.6)
    sleeper = gm(ctx, 'sleeper', '#4a3424', dirt=0.4, rough=0.9, scale=8, streak=5, seed=1)
    rail = M(ctx, '#6a6a72', 0.4, 0.8, key='railSteel')
    head = M(ctx, '#d0d4dc', 0.18, 1.0, key='railHead')
    for j in range(n):
        for i in range(3 * n):
            B.box(i / 3 + 0.03, j + 0.12, 0, 0.13, 0.76, 0.05, sleeper, bev=0.008)
        for vv in (0.3, 0.7):
            B.box(0, j + vv - 0.035, 0.05, n, 0.07, 0.03, rail)
            B.box(0, j + vv - 0.015, 0.05, n, 0.03, 0.09, rail)
            B.box(0, j + vv - 0.022, 0.13, n, 0.044, 0.02, head)
    B.flush()


# ================================================================== PROPS
def p_pallet(ctx, var, B=None, ox=0.0, oy=0.0, z=0.0, s=1.0):
    own = B is None
    if own: B = Batch(ctx)
    c = var.get('color', '#b08a50')
    w1 = gm(ctx, 'pal1' + c, c, dirt=0.3, rough=0.85, scale=5, streak=8, seed=1)
    w2 = gm(ctx, 'pal2' + c, shade(c, -0.15), dirt=0.35, rough=0.9, scale=5, streak=8, seed=2)
    w3 = gm(ctx, 'pal3' + c, shade(c, 0.1), dirt=0.25, rough=0.85, scale=5, streak=8, seed=3)
    S = lambda a: a * s
    for y in (0.05, 0.45, 0.85):
        B.box(ox + S(0.05), oy + S(y), z, S(0.9), S(0.1), 0.03, w2)
    for x in (0.05, 0.45, 0.85):
        for y in (0.05, 0.45, 0.85):
            B.box(ox + S(x), oy + S(y), z + 0.03, S(0.1), S(0.1), 0.12, w2, bev=0.005)
    for y in (0.05, 0.45, 0.85):
        B.box(ox + S(0.05), oy + S(y), z + 0.15, S(0.9), S(0.1), 0.04, w1)
    for i in range(5):
        B.box(ox + S(0.05 + i * 0.2), oy + S(0.05), z + 0.19, S(0.14), S(0.9), 0.05, w3 if i % 2 else w1, bev=0.004)
    if own: B.flush()


def p_pallet_boxes(ctx, var):
    B = Batch(ctx)
    p_pallet(ctx, {}, B, 0.05, 0.05, 0.0, 0.9)
    c = var.get('color', '#a87a48')
    grey = c == '#9aa0a8'
    z0 = 0.24
    H = 0.62
    if grey:
        wrap = gm(ctx, 'pbWrap', '#9aa0a8', dirt=0.15, rough=0.22, metal=0.1, scale=10, streak=5, seed=2)
        B.box(0.1, 0.1, z0, 0.8, 0.8, H, wrap, bev=0.04)
        for z in (z0 + 0.12, z0 + 0.35, z0 + 0.55):
            B.box(0.095, 0.095, z, 0.81, 0.81, 0.025, M(ctx, '#d0d4da', 0.15, key='pbBand'))
        B.box(0.4, 0.905, z0 + 0.2, 0.2, 0.004, 0.14, M(ctx, '#f0ece0', 0.6, key='pbLabel'))
    else:
        card = gm(ctx, 'pbCard', '#a87a48', dirt=0.25, rough=0.85, scale=6, seed=1)
        card2 = gm(ctx, 'pbCard2', '#b8885a', dirt=0.2, rough=0.85, scale=6, seed=4)
        tape = M(ctx, '#d8c8a0', 0.35, key='tape')
        for iz in range(2):
            for ix in range(2):
                for iy in range(2):
                    x0, y0 = 0.1 + ix * 0.4, 0.1 + iy * 0.4
                    zb = z0 + iz * H / 2
                    B.box(x0 + 0.005, y0 + 0.005, zb, 0.39, 0.39, H / 2 - 0.01, card if (ix + iy + iz) % 2 else card2, bev=0.008)
                    B.box(x0 + 0.17, y0, zb + H / 2 - 0.02, 0.06, 0.4, 0.012, tape)
                    if iy == 1: B.box(x0 + 0.17, y0 + 0.395, zb + H / 4, 0.06, 0.006, H / 4 - 0.01, tape)
                    if ix == 1: B.box(x0 + 0.395, y0 + 0.17, zb + H / 4, 0.006, 0.06, H / 4 - 0.01, tape)
        # thin clear stretch wrap sheen
        B.box(0.095, 0.095, z0 + 0.05, 0.81, 0.81, H - 0.1, M(ctx, '#ffffff', 0.08, key='stretch', alpha=0.12))
        B.box(0.25, 0.903, z0 + 0.38, 0.14, 0.003, 0.12, M(ctx, '#f0ece0', 0.6, key='pbLabel'))
        B.box(0.27, 0.906, z0 + 0.4, 0.1, 0.002, 0.03, M(ctx, '#c8102e', 0.6, key='pbLabelR'))
    B.flush()


def p_drum(ctx, var):
    B = Batch(ctx)
    c = var.get('color', '#2a4d7a')
    paint = gm(ctx, 'drum' + c, c, rust=0.45, dirt=0.25, rough=0.45, metal=0.35, scale=6, streak=0.12, seed=len(c))
    rim = gm(ctx, 'drumR' + c, shade(c, -0.3), rust=0.5, dirt=0.3, rough=0.5, metal=0.4, scale=8, seed=2)
    H = 1.0
    r = 0.29
    B.cyl(0.5, 0.5, 0.02, r, H - 0.04, paint, 24)
    for z in (0.0, H - 0.04):
        B.torus(0.5, 0.5, z + 0.02, r, 0.018, rim, seg=24, rseg=6)
    for z in (0.33, 0.66):
        B.torus(0.5, 0.5, z, r + 0.004, 0.014, paint, seg=24, rseg=6)
    B.cyl(0.5, 0.5, H - 0.04, r - 0.02, 0.02, rim, 24)
    B.cyl(0.38, 0.45, H - 0.03, 0.035, 0.03, M(ctx, '#2a2a2e', 0.5, 0.6, key='bung'), 8)
    B.cyl(0.62, 0.58, H - 0.03, 0.022, 0.03, M(ctx, '#2a2a2e', 0.5, 0.6, key='bung'), 8)
    if var.get('label', True) and c != '#d8b020':
        # hazard label facing the camera (+x+y)
        a = math.radians(45)
        lx, ly = 0.5 + math.cos(a) * (r + 0.003), 0.5 + math.sin(a) * (r + 0.003)
        B.obox(lx, ly, 0.45, 0.17, 0.006, 0.22, a + math.pi / 2, M(ctx, '#d8b020', 0.5, key='drumLabel'))
        B.obox(lx + 0.004, ly + 0.004, 0.52, 0.06, 0.004, 0.08, a + math.pi / 2, M(ctx, '#120c14', 0.6, key='drumInk'))
    B.flush()


def p_tyres(ctx, var):
    B = Batch(ctx)
    tyre = gm(ctx, 'tyre', '#202024', dirt=0.25, rough=0.85, scale=12, seed=1, bump=0.4, dirtc='#3a3530')
    R = rnd('tyres')
    for k in range(4):
        cx, cy = 0.5 + (R.random() - 0.5) * 0.06, 0.5 + (R.random() - 0.5) * 0.06
        B.torus(cx, cy, 0.11 + k * 0.215, 0.24, 0.105, tyre, seg=28, rseg=10, sq=1.0)
    B.cyl(0.5, 0.5, 0.0, 0.16, 0.86, M(ctx, '#08080a', 0.9, key='tyreHole'), 16)
    B.flush()


def p_bollard(ctx, var):
    B = Batch(ctx)
    iron = gm(ctx, 'mooring', '#26282c', rust=0.6, dirt=0.3, rough=0.55, metal=0.5, scale=6, streak=0.3, seed=2)
    B.cyl(0.5, 0.5, 0.0, 0.24, 0.06, iron, 20)
    for i in range(6):
        a = i * math.pi / 3
        B.cyl(0.5 + math.cos(a) * 0.19, 0.5 + math.sin(a) * 0.19, 0.06, 0.02, 0.02, M(ctx, '#3a3e44', 0.4, 0.7, key='mbolt'), 6)
    B.cyl(0.5, 0.5, 0.06, 0.15, 0.4, iron, 20, r2=0.13)
    B.cyl(0.5, 0.5, 0.44, 0.2, 0.08, iron, 20)
    B.sphere(0.5, 0.5, 0.52, 0.2, iron, seg=16, sz=0.35)
    # worn rope loop
    B.torus(0.5, 0.5, 0.3, 0.16, 0.025, gm(ctx, 'rope', '#8a7a5a', dirt=0.4, rough=0.95, scale=30, seed=3), seg=20, rseg=6)
    B.flush()


def p_lamp(ctx, var):
    B = Batch(ctx)
    off = var.get('part') == 'off'
    post = gm(ctx, 'mast', '#5a5e66', rust=0.3, dirt=0.3, rough=0.4, metal=0.6, scale=4, streak=0.2, seed=1)
    base = gm(ctx, 'mastBase', '#6a6a6e', dirt=0.4, rough=0.9, seed=2)
    B.box(0.3, 0.3, 0, 0.4, 0.4, 0.22, base, bev=0.02)
    B.cyl(0.5, 0.5, 0.22, 0.09, 0.12, post, 12)
    B.cyl(0.5, 0.5, 0.22, 0.065, 3.9, post, 12, r2=0.045)
    B.cyl(0.5, 0.5, 0.6, 0.068, 0.3, stripe_mat(ctx, 'mastBand', '#d8b020', '#1e1e22', freq=8, axes='z'), 12)
    B.box(0.44, 0.555, 0.9, 0.12, 0.02, 0.22, M(ctx, '#3a3e46', 0.5, 0.5, key='mastHatch'))
    zt = 4.1
    head = M(ctx, '#2a2c30', 0.45, 0.5, key='lampHead')
    lens = M(ctx, '#3a2a18', 0.4, key='lensOff') if off else M(ctx, '#ffd090', 0.2, 0, emit='#ffa040', es=12, key='lensOn')
    for s in (1, -1):
        ex, ey = 0.5 + s * 0.42, 0.5 - s * 0.42
        B.rod((0.5, 0.5, zt - 0.1), (ex, ey, zt + 0.06), 0.03, post)
        hx, hy = 0.5 + s * 0.5, 0.5 - s * 0.5
        B.obox(hx, hy, zt - 0.02, 0.42, 0.2, 0.14, -math.pi / 4, head)
        B.sphere(hx, hy, zt - 0.03, 0.12, lens, seg=12, sz=0.45, sx=1.5, sy=1.5)
    B.cyl(0.5, 0.5, zt - 0.1, 0.06, 0.22, head, 10)
    B.flush()


def p_wall_lamp(ctx, var):
    B = Batch(ctx)
    part = var.get('part', '')
    if part == 'blank': return
    side = 'y' if part.startswith('left') else 'x'
    white = part.endswith('white')
    housing = M(ctx, '#3a3e46', 0.45, 0.4, key='bulkHouse')
    lens = M(ctx, '#f0f4ff', 0.2, 0, emit='#e8f0ff', es=7, key='bulkW') if white else M(ctx, '#ffc070', 0.2, 0, emit='#ffb050', es=7, key='bulkO')
    cage = M(ctx, '#1a1a1e', 0.5, 0.5, key='bulkCage')
    zc = 0.45
    fb(B, side, 0.32, 0.68, zc - 0.13, zc + 0.13, 0.0, 0.03, housing, bev=0.01)
    fb(B, side, 0.35, 0.65, zc - 0.1, zc + 0.1, 0.03, 0.075, lens, bev=0.02)
    for u in (0.42, 0.5, 0.58):
        fb(B, side, u - 0.008, u + 0.008, zc - 0.1, zc + 0.1, 0.075, 0.085, cage)
    fb(B, side, 0.35, 0.65, zc - 0.006, zc + 0.006, 0.075, 0.085, cage)
    # conduit up the wall
    fb(B, side, 0.48, 0.52, zc + 0.13, zc + 0.5, 0.0, 0.025, M(ctx, '#2a2c30', 0.6, 0.4, key='conduit'))
    B.flush()


def p_gate(ctx, var):
    B = Batch(ctx)
    d = var.get('dir', 'x')
    part = var.get('part', '')
    def P(a, z=0.0, o=0.0):  # point along the gate line (a in 0..1), offset o towards the camera side
        return (a, 0.5 + o, z) if d == 'x' else (0.5 + o, 1 - a, z)
    def bx(a0, a1, z0, z1, o0, o1, mat, bev=0.0):
        if d == 'x': B.box(a0, 0.5 + o0, z0, a1 - a0, o1 - o0, z1 - z0, mat, bev)
        else: B.box(0.5 + o0, 1 - a1, z0, o1 - o0, a1 - a0, z1 - z0, mat, bev)
    if part == 'sign':
        bx(0.32, 0.68, 1.15, 1.6, 0.03, 0.045, M(ctx, '#e8e4d8', 0.6, key='gsign'))
        bx(0.36, 0.64, 1.22, 1.52, 0.045, 0.05, M(ctx, '#c01818', 0.5, key='gsignR'))
        bx(0.41, 0.59, 1.35, 1.39, 0.05, 0.054, M(ctx, '#ffffff', 0.5, key='gsignW'))
        B.flush(); return
    zt = 2.5
    tube = gm(ctx, 'gateTube', '#8a929c', rust=0.25, dirt=0.25, rough=0.35, metal=0.75, scale=5, seed=2)
    yel = gm(ctx, 'gateYel', '#d8b020', rust=0.3, dirt=0.25, rough=0.45, metal=0.3, scale=5, seed=3)
    wire = M(ctx, '#7a8088', 0.35, 0.8, key='gateWire')
    bx(0.0, 1.0, 0.1, 0.18, -0.03, 0.03, tube, 0.01)
    bx(0.0, 1.0, zt - 0.08, zt, -0.03, 0.03, yel, 0.01)
    bx(0.0, 1.0, zt * 0.5, zt * 0.5 + 0.06, -0.025, 0.025, tube)
    for a in (0.0, 0.94):
        bx(a, a + 0.06, 0.1, zt, -0.03, 0.03, tube, 0.01)
    # welded mesh infill
    for k in range(1, 12):
        a = k / 12
        p0, p1 = P(a, 0.18, 0.0), P(a, zt - 0.08, 0.0)
        B.rod(p0, p1, 0.006, wire, seg=4)
    z = 0.18
    while z < zt - 0.1:
        B.rod(P(0.03, z), P(0.97, z), 0.005, wire, seg=4); z += 0.16
    # rollers
    for a in (0.2, 0.8):
        x, y, _ = P(a, 0, 0)
        if d == 'x': B.rod((x, y - 0.05, 0.06), (x, y + 0.05, 0.06), 0.06, M(ctx, '#1a1a1e', 0.6, key='roller'), seg=10)
        else: B.rod((x - 0.05, y, 0.06), (x + 0.05, y, 0.06), 0.06, M(ctx, '#1a1a1e', 0.6, key='roller'), seg=10)
    # barbed wire on top
    barb = M(ctx, '#9aa0a8', 0.35, 0.8, key='barb')
    for zz in (zt + 0.12, zt + 0.24):
        B.rod(P(0.0, zz), P(1.0, zz), 0.005, barb, seg=3)
    for a in (0.03, 0.97):
        B.rod(P(a, zt), P(a, zt + 0.28), 0.012, tube, seg=6)
    # red warning lamp housing (overlay blinks it)
    x, y, _ = P(0.5, 0, 0.04)
    B.box(x - 0.04, y - 0.04, zt * 0.25 - 0.06, 0.08, 0.08, 0.12, M(ctx, '#1a1a1e', 0.5, key='glampH'))
    B.sphere(x, y, zt * 0.25, 0.035, M(ctx, '#5a1a14', 0.4, key='glampOff'), seg=8)
    B.flush()


def p_cabinet(ctx, var):
    if var.get('part') == 'blank': return
    B = Batch(ctx)
    body = gm(ctx, 'cab', '#6a7078', dirt=0.25, rough=0.45, metal=0.4, scale=5, streak=0.4, seed=1)
    face = gm(ctx, 'cabF', '#5a6068', dirt=0.2, rough=0.4, metal=0.4, scale=5, seed=2)
    handle = M(ctx, '#c8ccd0', 0.25, 0.9, key='cabHandle')
    label = M(ctx, '#e8e4d8', 0.6, key='cabLabel')
    B.box(0.2, 0.2, 0, 0.6, 0.6, 1.6, body, bev=0.01)
    for k in range(4):
        za = 0.08 + k * 0.38
        B.box(0.23, 0.79, za, 0.54, 0.02, 0.34, face, bev=0.006)
        B.box(0.4, 0.81, za + 0.2, 0.2, 0.025, 0.04, handle)
        B.box(0.44, 0.81, za + 0.27, 0.12, 0.006, 0.05, label)
    B.box(0.2, 0.2, 1.6, 0.6, 0.6, 0.0, body)
    # files / box on top
    B.box(0.3, 0.3, 1.6, 0.35, 0.28, 0.18, gm(ctx, 'archive', '#c8a878', dirt=0.25, rough=0.85, seed=3), bev=0.006)
    B.flush()


def p_desk(ctx, var):
    if var.get('part') == 'blank': return
    B = Batch(ctx)
    wood = gm(ctx, 'desk', '#6a5a40', dirt=0.25, rough=0.6, scale=4, streak=6, seed=1)
    side = gm(ctx, 'deskS', '#4a3e2c', dirt=0.3, rough=0.7, scale=4, streak=6, seed=2)
    beige = gm(ctx, 'crt', '#c8c0a8', dirt=0.3, rough=0.6, scale=6, seed=3)
    B.box(0.1, 0.15, 0.71, 0.8, 0.7, 0.05, wood, bev=0.008)
    B.box(0.12, 0.17, 0.0, 0.05, 0.66, 0.71, side)
    B.box(0.55, 0.17, 0.0, 0.33, 0.66, 0.71, side)
    for k in range(3):
        B.box(0.57, 0.83, 0.06 + k * 0.21, 0.29, 0.02, 0.18, wood, bev=0.005)
        B.box(0.68, 0.85, 0.13 + k * 0.21, 0.08, 0.02, 0.03, M(ctx, '#c8ccd0', 0.3, 0.8, key='deskH'))
    B.box(0.17, 0.2, 0.3, 0.38, 0.02, 0.4, side)
    # CRT monitor
    B.box(0.22, 0.22, 0.76, 0.36, 0.34, 0.07, beige)
    B.box(0.24, 0.22, 0.83, 0.32, 0.26, 0.38, beige, bev=0.02)
    B.box(0.26, 0.47, 0.86, 0.28, 0.02, 0.3, M(ctx, '#1e1e1a', 0.6, key='crtBezel'))
    B.box(0.28, 0.485, 0.88, 0.24, 0.01, 0.26, M(ctx, '#1a4a32', 0.2, 0, emit='#3aff7a', es=1.6, key='crtScreen'))
    for i in range(4):
        B.box(0.3, 0.495, 1.08 - i * 0.05, 0.08 + (i % 3) * 0.04, 0.004, 0.02, M(ctx, '#c8ffd8', 0.3, 0, emit='#c8ffd8', es=3, key='crtText'))
    # keyboard, papers, mug
    B.box(0.25, 0.6, 0.76, 0.32, 0.12, 0.03, beige)
    B.box(0.62, 0.5, 0.76, 0.2, 0.26, 0.012, M(ctx, '#f0ece0', 0.8, key='paper'))
    B.box(0.64, 0.53, 0.772, 0.18, 0.22, 0.01, M(ctx, '#e0dccc', 0.8, key='paper2'))
    B.cyl(0.76, 0.3, 0.76, 0.045, 0.17, M(ctx, '#c8102e', 0.4, key='mug'), 12)
    B.cyl(0.76, 0.3, 0.92, 0.038, 0.01, M(ctx, '#5a3010', 0.2, key='tea'), 12)
    B.flush()


def p_workbench(ctx, var):
    B = Batch(ctx)
    steel = gm(ctx, 'wbSteel', '#3a3e46', rust=0.2, dirt=0.3, rough=0.5, metal=0.6, seed=1)
    top = gm(ctx, 'wbTop', '#8a6a40', dirt=0.45, rough=0.75, scale=4, streak=8, seed=2)
    for (x, y) in ((0.05, 0.15), (0.87, 0.15), (0.05, 0.78), (0.87, 0.78)):
        B.box(x, y, 0, 0.07, 0.07, 0.8, steel)
    B.box(0.05, 0.15, 0.22, 0.89, 0.7, 0.04, steel)
    B.box(0.0, 0.1, 0.8, 1.0, 0.8, 0.08, top, bev=0.01)
    # pegboard with tools at the back
    peg = gm(ctx, 'pegboard', '#7a6a50', dirt=0.3, rough=0.9, seed=4)
    B.box(0.02, 0.1, 0.88, 0.96, 0.03, 0.8, peg)
    tool = M(ctx, '#8a8e96', 0.3, 0.8, key='tool')
    hand = M(ctx, '#c01818', 0.5, key='toolHandle')
    for i, x in enumerate((0.15, 0.32, 0.5, 0.68, 0.84)):
        B.box(x, 0.13, 1.25, 0.03, 0.02, 0.3, tool)
        B.box(x - 0.01, 0.13, 1.18 if i % 2 else 1.42, 0.05, 0.025, 0.12, hand if i % 2 else M(ctx, '#e8b820', 0.5, key='toolHandleY'))
    B.cyl(0.85, 0.15, 1.45, 0.08, 0.04, tool, 12)
    # toolbox + vice + spilled bits
    B.box(0.12, 0.3, 0.88, 0.3, 0.2, 0.16, M(ctx, '#c01818', 0.4, 0.2, key='toolbox'), bev=0.01)
    B.box(0.2, 0.36, 1.04, 0.14, 0.04, 0.04, M(ctx, '#1a1a1e', 0.5, key='tbHandle'))
    vice = M(ctx, '#4a6a9a', 0.4, 0.4, key='vice')
    B.box(0.62, 0.62, 0.88, 0.16, 0.2, 0.12, vice, bev=0.01)
    B.box(0.66, 0.82, 0.9, 0.08, 0.1, 0.08, vice)
    B.rod((0.7, 0.92, 0.95), (0.7, 0.98, 0.95), 0.012, tool)
    B.box(0.45, 0.6, 0.88, 0.1, 0.05, 0.02, tool)
    B.flush()


def p_boiler(ctx, var):
    B = Batch(ctx)
    c = var.get('color', '#6a3a2c')
    body = gm(ctx, 'boiler' + c, c, rust=0.55, dirt=0.3, rough=0.55, metal=0.35, scale=3, streak=0.1, seed=len(c))
    band = gm(ctx, 'boilerB' + c, shade(c, -0.4), rust=0.6, dirt=0.35, rough=0.55, metal=0.4, seed=2)
    pipe = gm(ctx, 'bpipe', '#5a5e66', rust=0.4, dirt=0.3, rough=0.45, metal=0.6, seed=3)
    r = 0.42
    B.box(0.12, 0.12, 0, 0.76, 0.76, 0.15, gm(ctx, 'bplinth', '#4a4a4e', dirt=0.4, rough=0.9, seed=4))
    B.cyl(0.5, 0.5, 0.15, r, 2.35, body, 28)
    B.sphere(0.5, 0.5, 2.5, r, body, seg=28, sz=0.35)
    for z in (0.5, 1.3, 2.1):
        B.cyl(0.5, 0.5, z, r + 0.012, 0.08, band, 28)
    rv = M(ctx, '#3a2a24', 0.5, 0.5, key='rivet')
    for z in (0.54, 1.34, 2.14):
        for i in range(10):
            a = math.radians(-40 + i * 13)
            B.sphere(0.5 + math.cos(a) * (r + 0.02), 0.5 + math.sin(a) * (r + 0.02), z, 0.012, rv, seg=5)
    # gauge facing the camera (overlay draws the needle)
    a = math.radians(GAUGE_ANG)
    gx, gy = 0.5 + math.cos(a) * (r + 0.03), 0.5 + math.sin(a) * (r + 0.03)
    B.rod((0.5 + math.cos(a) * r, 0.5 + math.sin(a) * r, GAUGE_Z), (gx, gy, GAUGE_Z), 0.075, M(ctx, '#2a2a2e', 0.4, 0.6, key='gaugeRim'), seg=16)
    B.rod((gx, gy, GAUGE_Z), (gx + math.cos(a) * 0.006, gy + math.sin(a) * 0.006, GAUGE_Z), 0.064, M(ctx, '#e8e4d8', 0.4, 0, emit='#e8e4d8', es=0.3, key='gaugeFace'), seg=16)
    # pipework: flue up into the dark + a side pipe with a valve wheel
    B.cyl(0.62, 0.4, 2.55, 0.07, 1.5, pipe, 12)
    B.cyl(0.62, 0.4, 2.62, 0.09, 0.08, pipe, 12)
    B.rod((0.5 + 0.3, 0.5 - 0.3, 1.0), (1.0, 0.0, 1.0), 0.05, pipe, seg=10)
    B.rod((0.92, 0.08, 0.0), (0.92, 0.08, 1.0), 0.05, pipe, seg=10)
    B.torus(0.95, 0.12, 1.0, 0.09, 0.012, M(ctx, '#c01818', 0.5, 0.3, key='valve'), seg=16, rseg=5, axis='x')
    B.sphere(0.5, 0.5, 2.7, 0.05, pipe, seg=8)
    B.flush()


GAUGE_ANG = 70     # degrees from +x toward +y (camera faces +x+y, 45deg)
GAUGE_Z = 1.65


def p_press(ctx, var):
    """H-frame hydraulic press: columns at the screen-left/right corners, crosshead on top. var['ram'] = ram bottom z."""
    B = Batch(ctx)
    ram = var.get('ram', 1.35)
    steel = gm(ctx, 'pressSteel', '#4a4e56', rust=0.25, dirt=0.35, rough=0.5, metal=0.6, scale=4, seed=1)
    yel = gm(ctx, 'pressYel', '#d8b020', rust=0.2, dirt=0.35, rough=0.5, metal=0.3, scale=4, streak=0.3, seed=2)
    chrome = M(ctx, '#c8ccd2', 0.15, 1.0, key='pressRod')
    haz = stripe_mat(ctx, 'pressHaz', '#d8b020', '#1e1e22', freq=6.0, axes='xyz', worn=0.3)
    B.box(0.03, 0.03, 0, 0.94, 0.94, 0.42, steel, bev=0.015)
    B.box(0.15, 0.15, 0.42, 0.7, 0.7, 0.08, M(ctx, '#2a2c30', 0.4, 0.7, key='bed'))
    for face in ('x', 'y'): fb(B, face, 0.0, 1.0, 0.3, 0.42, -0.03, 0.004, haz)
    for (x, y) in ((0.04, 0.82), (0.82, 0.04)):
        B.box(x, y, 0.42, 0.14, 0.14, 1.8, yel, bev=0.012)
    B.box(0.0, 0.0, 2.2, 1.0, 1.0, 0.3, yel, bev=0.02)
    for face in ('x', 'y'): fb(B, face, 0.1, 0.9, 2.24, 2.3, 0.0, 0.006, haz)
    # hydraulic cylinder on top + hoses
    B.cyl(0.5, 0.5, 2.5, 0.2, 0.35, steel, 16)
    B.cyl(0.5, 0.5, 2.85, 0.22, 0.05, steel, 16)
    hose = M(ctx, '#121214', 0.7, key='hose')
    B.rod((0.65, 0.5, 2.8), (0.95, 0.35, 2.4), 0.025, hose); B.rod((0.95, 0.35, 2.4), (0.95, 0.12, 1.2), 0.025, hose)
    # warning lamp (overlay blinks it)
    B.box(0.9, 0.45, 2.5, 0.08, 0.1, 0.1, M(ctx, '#1a1a1e', 0.5, key='plampH'))
    B.sphere(0.95, 0.5, 2.62, 0.04, M(ctx, '#5a2010', 0.4, key='plampOff'), seg=8)
    # ram: chrome rod + platen
    B.cyl(0.5, 0.5, ram + 0.25, 0.07, 2.2 - ram - 0.25, chrome, 14)
    B.box(0.22, 0.22, ram, 0.56, 0.56, 0.25, M(ctx, '#8a8e96', 0.35, 0.7, key='platen'), bev=0.015)
    # crushed boxes on the bed
    B.box(0.3, 0.32, 0.5, 0.4, 0.36, 0.08, gm(ctx, 'crushed', '#a87a48', dirt=0.4, rough=0.9, seed=5))
    B.flush()


PRESS_FRAMES = [1.35 + 0.55 * k / 6 for k in range(7)]


def p_lever(ctx, var):
    B = Batch(ctx)
    pulled = var.get('part') == 'pulled'
    yel = gm(ctx, 'lvYel', '#d8b020', rust=0.2, dirt=0.35, rough=0.5, metal=0.3, seed=1)
    B.box(0.2, 0.25, 0, 0.6, 0.5, 1.0, yel, bev=0.02)
    B.box(0.28, 0.75, 0.5, 0.44, 0.02, 0.35, M(ctx, '#2a2a2e', 0.5, key='lvPanel'))
    B.box(0.32, 0.765, 0.58, 0.14, 0.012, 0.08, M(ctx, '#e8e4d8', 0.6, key='lvLabel'))
    lamp = M(ctx, '#5a1a14', 0.4, key='lvRed') if pulled else M(ctx, '#1a6a3a', 0.4, key='lvGreen')
    B.sphere(0.5, 0.765, 0.97 - 0.02 - 0.05, 0.03, lamp, seg=8)
    haz = stripe_mat(ctx, 'lvHaz', '#d8b020', '#1e1e22', freq=8.0, axes='xyz')
    B.box(0.2, 0.25, 0.0, 0.6, 0.5, 0.12, haz)
    # pivot + handle in the screen plane (direction (1,-1)/sqrt2 is screen-right)
    piv = (0.5, 0.5, 1.0)
    B.rod((0.5 - 0.08, 0.5 + 0.08, 1.02), (0.5 + 0.08, 0.5 - 0.08, 1.02), 0.04, M(ctx, '#3a3a40', 0.4, 0.7, key='lvPivot'), seg=10)
    ang = 0.9 if pulled else -0.5
    L = 0.52
    hx, hz = math.sin(ang) * L / SQ2, math.cos(ang) * L / UNIT
    end = (piv[0] + hx, piv[1] - hx, piv[2] + hz)
    B.rod((piv[0], piv[1], piv[2] + 0.02), end, 0.02, M(ctx, '#c8ccd0', 0.25, 0.9, key='lvRod'))
    B.sphere(end[0], end[1], end[2], 0.06, M(ctx, '#c01818', 0.35, key='lvKnob'), seg=12)
    B.flush()


def p_cage(ctx, var):
    B = Batch(ctx)
    frame = gm(ctx, 'cageF', '#4a4e56', rust=0.25, dirt=0.3, rough=0.45, metal=0.6, seed=1)
    wire = M(ctx, '#8a9098', 0.35, 0.8, key='cageWire')
    zt = 1.9
    B.box(0.05, 0.05, 0, 0.9, 0.9, 0.02, M(ctx, '#2a2c30', 0.7, 0.3, key='cageFloor'))
    for (x, y) in ((0.05, 0.05), (0.92, 0.05), (0.05, 0.92), (0.92, 0.92)):
        B.box(x - 0.02, y - 0.02, 0, 0.05, 0.05, zt, frame)
    for z in (0.02, zt - 0.04):
        B.box(0.03, 0.03, z, 0.94, 0.05, 0.04, frame); B.box(0.03, 0.92, z, 0.94, 0.05, 0.04, frame)
        B.box(0.03, 0.03, z, 0.05, 0.94, 0.04, frame); B.box(0.92, 0.03, z, 0.05, 0.94, 0.04, frame)
    n = 10
    for k in range(1, n):
        a = 0.05 + 0.9 * k / n
        for (p0, p1) in (((a, 0.95, 0.05), (a, 0.95, zt)), ((0.95, a, 0.05), (0.95, a, zt)),
                         ((a, 0.05, 0.05), (a, 0.05, zt)), ((0.05, a, 0.05), (0.05, a, zt))):
            B.rod(p0, p1, 0.005, wire, seg=4)
    for z in [0.05 + i * 0.18 for i in range(11)]:
        if z > zt: break
        for (p0, p1) in (((0.05, 0.95, z), (0.95, 0.95, z)), ((0.95, 0.05, z), (0.95, 0.95, z)),
                         ((0.05, 0.05, z), (0.95, 0.05, z)), ((0.05, 0.05, z), (0.05, 0.95, z))):
            B.rod(p0, p1, 0.005, wire, seg=4)
    # roof mesh
    for k in range(1, n):
        a = 0.05 + 0.9 * k / n
        B.rod((a, 0.05, zt), (a, 0.95, zt), 0.005, wire, seg=4)
        B.rod((0.05, a, zt), (0.95, a, zt), 0.005, wire, seg=4)
    # door frame + padlock on the +y face, warning plate (overlay writes PRIVATE)
    B.box(0.35, 0.94, 0.05, 0.03, 0.03, 1.6, frame); B.box(0.65, 0.94, 0.05, 0.03, 0.03, 1.6, frame)
    B.box(0.45, 0.955, 0.9, 0.1, 0.03, 0.12, M(ctx, '#e8c040', 0.3, 0.8, key='lock'), bev=0.008)
    B.torus(0.5, 0.97, 1.05, 0.035, 0.008, M(ctx, '#c8ccd0', 0.25, 0.9, key='shackle'), seg=12, rseg=4, axis='y')
    B.box(0.22, 0.958, 1.42, 0.56, 0.01, 0.26, M(ctx, '#e8e4d8', 0.6, key='cagePlate'))
    B.box(0.24, 0.965, 1.44, 0.52, 0.004, 0.22, M(ctx, '#c01818', 0.5, key='cagePlateR'))
    B.flush()


def p_post_sign(ctx, var):
    B = Batch(ctx)
    bg = var.get('bg', '#d8b020')
    wpx = var.get('wpx', 71)            # board width in logical px (text width + 8)
    t = wpx / 32.0                       # half-span along (1,-1) in tiles: screen width = 32 * t
    post = gm(ctx, 'spost', '#5a5e66', rust=0.3, dirt=0.3, rough=0.45, metal=0.6, seed=2)
    board = gm(ctx, 'sboard' + bg, bg, dirt=0.25, rough=0.55, metal=0.2, scale=5, seed=3)
    for s in (-1, 1):
        o = 0.32 * s
        B.cyl(0.5 + o, 0.5 - o, 0, 0.035, 2.25, post, 10)
        B.cyl(0.5 + o, 0.5 - o, 0, 0.07, 0.05, M(ctx, '#3a3a3e', 0.6, 0.4, key='spBase'), 10)
    zc = SIGN_ZC
    L = t * SQ2
    B.obox(0.5, 0.5, zc - 0.375, L + 0.04, 0.05, 0.75, -math.pi / 4, M(ctx, '#1a1a1e', 0.6, 0.3, key='sbFrame'))
    B.obox(0.5 + 0.018, 0.5 + 0.018, zc - 0.35, L, 0.02, 0.7, -math.pi / 4, board)
    B.flush()


SIGN_ZC = 36.5 / 20          # board centre (units) = procedural text row


def p_vent(ctx, var):
    B = Batch(ctx)
    frame = gm(ctx, 'ventF', '#2a2c30', rust=0.3, dirt=0.3, rough=0.5, metal=0.6, seed=1)
    B.box(0.15, 0.15, 0, 0.7, 0.7, 0.03, frame, bev=0.01)
    B.box(0.2, 0.2, 0.0, 0.6, 0.6, 0.032, M(ctx, '#0a0a0c', 0.9, key='ventPit'))
    bar = M(ctx, '#6a6e76', 0.35, 0.7, key='ventBar')
    for k in range(5):
        B.box(0.22 + k * 0.14 - 0.015, 0.2, 0.0, 0.03, 0.6, 0.036, bar)
    B.box(0.2, 0.49, 0.0, 0.6, 0.02, 0.034, bar)
    # warning post at the back corner
    B.cyl(0.12, 0.12, 0, 0.03, 0.8, stripe_mat(ctx, 'ventPost', '#d8b020', '#1e1e22', freq=6, axes='z'), 8)
    B.box(0.07, 0.07, 0.8, 0.1, 0.1, 0.1, M(ctx, '#1a1a1e', 0.5, key='ventLampH'))
    B.sphere(0.12, 0.12, 0.93, 0.04, M(ctx, '#5a1a14', 0.4, key='ventLampOff'), seg=8)
    B.flush()


def lorry_geometry(ctx, B, col, cab, stripe):
    """whole lorry in lorry-local game coords: x 0..2, trailer y 0..5 (rear at y=0), cab y 5..7 facing +y"""
    body = gm(ctx, 'trailer' + col, col, rust=0.2, dirt=0.35, rough=0.5, metal=0.2, scale=2.5, streak=0.15, seed=1)
    post = gm(ctx, 'trailerP' + col, shade(col, -0.25), rust=0.3, dirt=0.4, rough=0.5, metal=0.3, seed=2)
    stri = M(ctx, stripe, 0.45, 0.1, key='stripe' + stripe)
    chassis = M(ctx, '#1e1e22', 0.6, 0.4, key='chassis')
    tyre = gm(ctx, 'lTyre', '#1a1a1e', dirt=0.25, rough=0.85, scale=12, seed=1, dirtc='#3a3530')
    hub = M(ctx, '#8a8e96', 0.35, 0.8, key='hub')
    # ---- trailer
    B.box(0.03, 0.02, 0.45, 1.94, 4.96, 1.85, body, bev=0.02)
    for k in range(11):
        y = 0.02 + k * 0.496
        B.box(1.965, y - 0.02, 0.5, 0.025, 0.04, 1.75, post)
        B.box(0.01, y - 0.02, 0.5, 0.025, 0.04, 1.75, post)
    B.box(1.968, 0.02, 0.55, 0.03, 4.96, 0.2, stri)
    B.box(1.968, 0.02, 2.05, 0.03, 4.96, 0.15, stri)
    B.box(0.03, 0.02, 2.27, 1.94, 4.96, 0.04, post)
    B.box(0.0, 0.0, 0.42, 2.0, 5.0, 0.06, chassis)                           # floor rail
    B.box(0.3, 0.2, 0.2, 0.2, 4.6, 0.25, chassis); B.box(1.5, 0.2, 0.2, 0.2, 4.6, 0.25, chassis)
    for y in (0.75, 1.65):                                                     # tandem axles at the rear
        for x in (0.12, 1.88):
            B.rod((x - 0.12, y, 0.27), (x + 0.12, y, 0.27), 0.27, tyre, seg=16)
            B.rod((x + (0.12 if x > 1 else -0.12), y, 0.27), (x + (0.125 if x > 1 else -0.125), y, 0.27), 0.14, hub, seg=12)
        B.box(1.86, y - 0.4, 0.5, 0.14, 0.8, 0.05, chassis)                    # mudguard
    B.box(1.9, 2.3, 0.2, 0.08, 1.6, 0.2, gm(ctx, 'skirt', '#3a3a40', dirt=0.4, rough=0.6, seed=4))   # side guard
    for x in (0.4, 1.5):                                                       # landing legs
        B.box(x, 3.9, 0.0, 0.1, 0.1, 0.45, chassis)
        B.box(x - 0.05, 3.85, 0.0, 0.2, 0.2, 0.03, chassis)
    B.box(0.1, 0.0, 0.25, 1.8, 0.06, 0.08, M(ctx, '#d8d8d0', 0.5, key='underrun'))
    # ---- cab (cab-over)
    cc = gm(ctx, 'cab' + cab, cab, rust=0.1, dirt=0.3, rough=0.35, metal=0.35, scale=3, streak=0.2, seed=3)
    dark = M(ctx, '#2a2a2e', 0.5, 0.3, key='cabDark')
    glass = M(ctx, '#20303e', 0.06, 0.3, key='cabGlass')
    glass_hi = M(ctx, '#5a7890', 0.1, 0.4, key='cabGlassHi')
    B.box(0.3, 5.0, 0.3, 1.4, 0.15, 0.2, chassis)                             # fifth wheel gap chassis
    B.box(0.05, 5.15, 0.3, 1.9, 1.78, 2.0, cc, bev=0.05)
    B.box(0.15, 5.3, 2.3, 1.7, 1.4, 0.18, cc, bev=0.05)                       # roof/deflector
    # windscreen (front = +y face)
    B.box(0.15, 6.92, 1.45, 1.7, 0.03, 0.72, glass)
    B.box(0.2, 6.935, 1.9, 0.35, 0.02, 0.22, glass_hi)
    B.box(0.12, 6.93, 2.15, 1.76, 0.06, 0.08, dark)                            # sun visor
    B.box(0.97, 6.94, 1.45, 0.06, 0.03, 0.72, dark)
    # grille, lights, bumper
    B.box(0.2, 6.93, 0.7, 1.6, 0.03, 0.5, dark)
    for k in range(5):
        B.box(0.24, 6.955, 0.75 + k * 0.09, 1.52, 0.02, 0.04, M(ctx, '#6a6e76', 0.3, 0.8, key='grilleBar'))
    for x in (0.12, 1.66):
        B.box(x, 6.93, 0.5, 0.22, 0.04, 0.16, M(ctx, '#fff2b0', 0.2, 0, emit='#fff0c0', es=5, key='headlamp'))
    B.box(0.02, 6.9, 0.3, 1.96, 0.12, 0.17, M(ctx, '#3a3a40', 0.4, 0.5, key='bumper'), bev=0.02)
    # side window + door on +x
    B.box(1.94, 5.6, 1.45, 0.03, 1.15, 0.65, glass)
    B.box(1.955, 5.4, 0.55, 0.02, 1.3, 0.04, shade_mat(ctx, cab, -0.4))
    B.box(1.955, 5.4, 0.55, 0.02, 0.04, 1.55, shade_mat(ctx, cab, -0.4))
    B.box(1.96, 6.45, 1.05, 0.03, 0.12, 0.05, M(ctx, '#c8ccd0', 0.3, 0.8, key='doorH'))
    for k in range(2):
        B.box(1.9, 5.5 + k * 0.1, 0.32 + k * 0.28, 0.12, 0.35, 0.04, M(ctx, '#6a6e76', 0.4, 0.7, key='step'))
    # mirrors
    for x in (-0.02, 1.98):
        B.box(x, 6.85, 1.5, 0.04, 0.12, 0.55, dark)
    # front wheels
    for x in (0.12, 1.88):
        B.rod((x - 0.12, 6.25, 0.27), (x + 0.12, 6.25, 0.27), 0.27, tyre, seg=16)
        B.rod((x + (0.12 if x > 1 else -0.12), 6.25, 0.27), (x + (0.125 if x > 1 else -0.125), 6.25, 0.27), 0.14, hub, seg=12)
    # marker lights on the roof
    for x in (0.4, 0.8, 1.2, 1.6):
        B.box(x, 6.62, 2.48, 0.08, 0.05, 0.05, M(ctx, '#ffb030', 0.3, 0, emit='#ffb030', es=4, key='marker'))


def shade_mat(ctx, col, f):
    return M(ctx, shade(col, f), 0.5, 0.3, key='sh%s%.2f' % (col, f))


LORRIES = [('#c8c4b8', '#b02020', '#c8102e'), ('#3a4a6a', '#e8e4d8', '#d8b020')]


def p_lorry(ctx, var):
    part = var.get('part', 'blank')
    if part == 'blank': return
    if part == 'trailer':
        col = var['color']; cab = next(c for (t, c, s) in LORRIES if t == col); stripe = next(s for (t, c, s) in LORRIES if t == col)
        oy = var['j']
    else:
        cab = var['cabColor']; col = next(t for (t, c, s) in LORRIES if c == cab); stripe = next(s for (t, c, s) in LORRIES if c == cab)
        oy = 5 + var['j']
    ox = var['i']
    B = Batch(ctx)
    lorry_geometry(ctx, B, col, cab, stripe)
    obs = B.flush()
    for ob in obs:
        ob.location = G(-ox, -oy, 0)
    cut_cell(ctx, obs)


def cut_cell(ctx, obs):
    cutter = ctx.box(-0.0005, -0.0005, -1, 1.001, 1.001, 10, ctx.mat('cutter', (1, 0, 1)), name='cutter')
    cutter.hide_render = True
    for ob in obs:
        m = ob.modifiers.new('cut', 'BOOLEAN'); m.operation = 'INTERSECT'; m.object = cutter
        m.solver = 'EXACT'
        try: m.use_self = True; m.use_hole_tolerant = True
        except Exception: pass


# ================================================================== PIECES
PIECES = []
for name in ('Red', 'Blue', 'Green', 'Grey', 'Orange'):
    PIECES.append(dict(kind='wall', id='industrial_container' + name, heights=[2.4], variants=6, build=w_container(CONTAINER[name]), padX=2, padBottom=2))
PIECES += [
    dict(kind='wall', id='industrial_stackA', heights=[5], variants=6, build=w_stack('#2a4d7a', '#8a3324'), padX=2, padBottom=2),
    dict(kind='wall', id='industrial_stackB', heights=[5], variants=6, build=w_stack('#6a6e72', '#3c6a3c'), padX=2, padBottom=2),
    dict(kind='wall', id='industrial_cladding', heights=[3, 4.5], variants=6, build=w_cladding, padX=4, padBottom=4),
    dict(kind='wall', id='industrial_factoryBrick', heights=[3, 4.5], variants=8, build=w_factory_brick, padX=6, padBottom=4),
    dict(kind='wall', id='industrial_shutter', heights=[3], variants=2, build=w_shutter, padX=6, padBottom=4),
    dict(kind='wall', id='industrial_shelf', heights=[2.6], variants=6, build=w_shelf, padX=2, padBottom=2),
    dict(kind='wall', id='industrial_meshY', heights=[2.4], variants=2, build=w_mesh_y, padX=12, padBottom=4),
    dict(kind='wall', id='industrial_hut', heights=[2.4], variants=4, build=w_hut, padX=12, padBottom=6, extraTop=4),
    dict(kind='wall', id='industrial_kabin', heights=[2.4], variants=4, build=w_kabin, padX=6, padBottom=4),
    dict(kind='wall', id='industrial_partition', heights=[3.4], variants=2, build=w_partition, padX=2, padBottom=2),
    dict(kind='wall', id='industrial_mezz', heights=[1.2], variants=1, build=w_mezz, padX=2, padBottom=2),
    dict(kind='wall', id='industrial_step', heights=[0.3, 0.6, 0.9], variants=1, build=w_step, padX=2, padBottom=2),
    dict(kind='wall', id='crateStack', heights=[1.1], variants=2, build=w_crates, padX=2, padBottom=2),

    dict(kind='floor', id='industrial_yard', n=8, build=floor_yard),
    dict(kind='floor', id='industrial_yardLineX', n=8, build=floor_yard_line_x),
    dict(kind='floor', id='industrial_hatch', n=4, build=floor_hatch),
    dict(kind='floor', id='industrial_slab', n=4, build=floor_slab),
    dict(kind='floor', id='industrial_slabLineX', n=4, build=floor_slab_line_x),
    dict(kind='floor', id='industrial_factory', n=4, build=floor_factory),
    dict(kind='floor', id='industrial_factoryLineX', n=4, build=floor_factory_line('x')),
    dict(kind='floor', id='industrial_factoryLineY', n=4, build=floor_factory_line('y')),
    dict(kind='floor', id='industrial_lino', n=4, build=floor_lino),
    dict(kind='floor', id='industrial_quay', n=4, build=floor_quay),
    dict(kind='floor', id='industrial_quayEdge', n=4, build=floor_quay_edge),
    dict(kind='floor', id='industrial_water', n=4, build=floor_water),
    dict(kind='floor', id='industrial_beltXp', n=4, build=floor_belt('x')),
    dict(kind='floor', id='industrial_beltYn', n=4, build=floor_belt('y')),
    dict(kind='floor', id='industrial_ramp', n=4, build=floor_ramp),
    dict(kind='floor', id='rail', n=4, build=floor_rail),

    dict(kind='prop', id='industrial_palletBoxes', size=(1, 1, 0.9), build=p_pallet_boxes, pad=6, variants=[{}, {'color': '#9aa0a8'}]),
    dict(kind='prop', id='industrial_drum', size=(1, 1, 1.05), build=p_drum, pad=6,
         variants=[{}, {'color': '#8a3324'}, {'color': '#3c6a3c'}, {'color': '#d8b020'}, {'color': '#2a4d7a'}]),
    dict(kind='prop', id='industrial_tyres', size=(1, 1, 0.95), build=p_tyres, pad=6),
    dict(kind='prop', id='industrial_bollard', size=(1, 1, 0.65), build=p_bollard, pad=6),
    dict(kind='prop', id='industrial_lamp', size=(1, 1, 4.4), build=p_lamp, pad=24, variants=[{}, {'part': 'off'}]),
    dict(kind='prop', id='industrial_wallLamp', size=(1, 1, 1.0), build=p_wall_lamp, pad=6,
         variants=[{'part': 'blank'}, {'part': 'left'}, {'part': 'right'}, {'part': 'leftwhite'}, {'part': 'rightwhite'}]),
    dict(kind='prop', id='industrial_gate', size=(1, 1, 2.9), build=p_gate, pad=6,
         variants=[{'dir': 'y'}, {'dir': 'x'}, {'dir': 'y', 'part': 'sign'}, {'dir': 'x', 'part': 'sign'}]),
    dict(kind='prop', id='industrial_cabinet', size=(1, 1, 1.8), build=p_cabinet, pad=6, variants=[{'part': 'blank'}, {'part': 'body'}]),
    dict(kind='prop', id='industrial_desk', size=(1, 1, 1.25), build=p_desk, pad=6, variants=[{'part': 'blank'}, {'part': 'body'}]),
    dict(kind='prop', id='industrial_workbench', size=(1, 1, 1.7), build=p_workbench, pad=6),
    dict(kind='prop', id='industrial_boiler', size=(1, 1, 4.1), build=p_boiler, pad=8, variants=[{}, {'color': '#4a5a6a'}]),
    dict(kind='prop', id='industrial_press', size=(1, 1, 2.95), build=p_press, pad=8,
         variants=[{'ram': r, 'part': 'f%d' % k} for k, r in enumerate(PRESS_FRAMES)]),
    dict(kind='prop', id='industrial_lever', size=(1, 1, 1.6), build=p_lever, pad=8, variants=[{}, {'part': 'pulled'}]),
    dict(kind='prop', id='industrial_cage', size=(1, 1, 2.0), build=p_cage, pad=6),
    dict(kind='prop', id='industrial_postSign', size=(1, 1, 2.3), build=p_post_sign, pad=44,
         variants=[{'bg': '#d8b020', 'wpx': 71}, {'bg': '#2a4a8a', 'wpx': 43, 'color': '#ffffff'}]),
    dict(kind='prop', id='industrial_vent', size=(1, 1, 1.0), build=p_vent, pad=6),
    dict(kind='prop', id='pallet', size=(1, 1, 0.4), build=p_pallet, pad=6),
    dict(kind='prop', id='industrial_lorry', size=(1, 1, 2.75), build=p_lorry, pad=6,
         variants=[{'part': 'blank'}] + [{'part': 'blank', 'color': t} for (t, c, s) in LORRIES]
         + [{'part': 'trailer', 'i': i, 'j': j, 'color': t} for (t, c, s) in LORRIES for j in range(5) for i in range(2)]
         + [{'part': 'cab', 'i': i, 'j': j, 'cabColor': c} for (t, c, s) in LORRIES for j in range(2) for i in range(2)]),
]
