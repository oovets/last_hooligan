# Level 2 (THE PUB, "The Anchor") environment pieces for scripts/blender/render_env.py.
# Game coords: x,y in tiles (1 tile = 1 m), z in height units (ctx.UNIT metres).
# Visible faces of a wall block: +x (screen right, darker) and +y (screen left, lit).
# Everything is original: invented pub/brewery, no real brands, logos or clubs. Lettering is drawn by the
# game (overlays in src/content/themes/pub.js), never baked here.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from env_common import _h, w_crates
import bpy, bmesh
from mathutils import Vector

U = 1.0206   # metres per height unit (== ctx.UNIT)

# ================================================================== generic helpers
def _lin(c):
    if isinstance(c, str): c = _h(c)
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def _mk(ctx, bm, mat, name, loc, rot=None, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons: p.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); ctx.link(ob); ob.location = loc
    if rot is not None: ob.rotation_euler = rot
    return ob

def M(ctx, color, rough=0.6, metal=0.0, emit=None, es=1.0, key=None):
    return ctx.mat(key or ('m' + str(color) + str(rough) + str(metal)), _h(color), rough, metal, emit=(_h(emit) if isinstance(emit, str) else emit) if emit else None, emit_strength=es)

def E(ctx, color, es=2.0, base=None):
    """emissive material (glowing glass / neon / screens)"""
    return ctx.mat('e' + color + str(es), _h(base or color), 0.3, 0, emit=_h(color), emit_strength=es)

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

def poly(ctx, pts, mat, name='poly'):
    bm = bmesh.new()
    vs = [bm.verts.new(ctx.G(*p)) for p in pts]
    bm.faces.new(vs)
    return _mk(ctx, bm, mat, name, (0, 0, 0))

def quadbox(ctx, pts, mat, t=0.02):
    """flat quad (4 game points) extruded along its normal by t metres"""
    bm = bmesh.new()
    vs = [Vector(ctx.G(*p)) for p in pts]
    n = (vs[1] - vs[0]).cross(vs[2] - vs[0]).normalized() * t
    a = [bm.verts.new(v) for v in vs]; b = [bm.verts.new(v + n) for v in vs]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    for i in range(4):
        j = (i + 1) % 4; bm.faces.new([a[i], a[j], b[j], b[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mk(ctx, bm, mat, 'qbox', (0, 0, 0))

def lathe(ctx, gx, gy, gz, prof, mat, seg=20, name='lathe'):
    """surface of revolution around a vertical axis at game (gx, gy); prof = [(radius_m, z_units), ...] bottom->top"""
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z * U)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
    if prof[0][0] > 0: bm.faces.new(list(reversed(rings[0])))
    if prof[-1][0] > 0: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _mk(ctx, bm, mat, name, ctx.G(gx, gy, gz), smooth=True)

def hcyl(ctx, x0, y0, z0, x1, y1, z1, r, mat, seg=16):
    return beam(ctx, (x0, y0, z0), (x1, y1, z1), r, mat, seg)

def disc(ctx, gx, gy, gz, r, mat, axis='z', t=0.01, seg=24):
    """thin disc facing up (axis z) or facing +y / +x (wall decals)"""
    if axis == 'z': return ctx.cyl(gx, gy, gz, r, t / U, mat, seg)
    if axis == 'y': return beam(ctx, (gx, gy, gz), (gx, gy + t, gz), r, mat, seg)
    return beam(ctx, (gx, gy, gz), (gx + t, gy, gz), r, mat, seg)

def alpha_mat(ctx, key, color, alpha, rough=0.08, emit=None, es=0.4):
    if key in ctx.mats: return ctx.mats[key]
    m = bpy.data.materials.new(key); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*_lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Alpha'].default_value = alpha
    if emit:
        b.inputs['Emission Color'].default_value = (*_lin(emit), 1); b.inputs['Emission Strength'].default_value = es
    _blend(m)
    ctx.mats[key] = m
    return m

def _blend(m):
    for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
        try: setattr(m, attr, val)
        except Exception: pass
    try: m.use_backface_culling = False
    except Exception: pass

# ---- tiny node-expression helper for procedural pattern materials
class NX:
    def __init__(self, N, L): self.N, self.L = N, L
    def m(self, op, a, b=None, c=None):
        n = self.N.new('ShaderNodeMath'); n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: self.L.new(v, n.inputs[i])
        return n.outputs[0]
    def add(self, a, b): return self.m('ADD', a, b)
    def sub(self, a, b): return self.m('SUBTRACT', a, b)
    def mul(self, a, b): return self.m('MULTIPLY', a, b)
    def fract(self, a): return self.m('FRACT', a)
    def floor(self, a): return self.m('FLOOR', a)
    def abs(self, a): return self.m('ABSOLUTE', a)
    def lt(self, a, b): return self.m('LESS_THAN', a, b)
    def gt(self, a, b): return self.m('GREATER_THAN', a, b)
    def mx(self, a, b): return self.m('MAXIMUM', a, b)
    def mn(self, a, b): return self.m('MINIMUM', a, b)
    def sin(self, a): return self.m('SINE', a)
    def cos(self, a): return self.m('COSINE', a)
    def mod(self, a, b): return self.m('FLOORED_MODULO', a, b)
    def lerp(self, f, a, b):
        return self.add(a, self.mul(f, self.sub(b, a))) if not isinstance(a, (int, float)) or not isinstance(b, (int, float)) else self.add(a, self.mul(f, b - a))
    def mix(self, fac, a, b):
        n = self.N.new('ShaderNodeMix'); n.data_type = 'RGBA'
        for sock, v in (('Factor', fac), ('A', a), ('B', b)):
            if isinstance(v, (str, tuple)): n.inputs[sock].default_value = (*_lin(v), 1)
            elif isinstance(v, (int, float)): n.inputs[sock].default_value = v
            else: self.L.new(v, n.inputs[sock])
        return n.outputs['Result']
    def pnoise(self, ctx, tc, period, scale, detail=4.0, rough=0.5):
        """seamless (period metres) noise factor"""
        nz = self.N.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'
        nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
        try: nz.inputs['Roughness'].default_value = rough
        except Exception: pass
        v, w = ctx.periodic_vector(self.N, self.L, tc, period)
        self.L.new(v, nz.inputs['Vector']); self.L.new(w, nz.inputs['W'])
        return nz.outputs['Fac']
    def noise(self, vec, scale, detail=4.0):
        nz = self.N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
        self.L.new(vec, nz.inputs['Vector']); return nz.outputs['Fac']

def pattern_mat(ctx, key, fn, rough=0.7, metal=0.0, bump=0.0, emit=0.0):
    """fn(nx, X, Y, Z, tc) -> (color_socket, height_socket|None[, rough_socket])  (object coords, Blender axes: X = game y, Y = game x)"""
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    nx = NX(N, L)
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(co, sep.inputs[0])
    res = fn(nx, sep.outputs[0], sep.outputs[1], sep.outputs[2], co.node)
    col, hgt = res[0], res[1]
    L.new(col, b.inputs['Base Color'])
    if len(res) > 2 and isinstance(res[2], (int, float)): b.inputs['Roughness'].default_value = res[2]
    elif len(res) > 2 and res[2] is not None: L.new(res[2], b.inputs['Roughness'])
    else: b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        L.new(col, b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    if hgt is not None and bump:
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
        L.new(hgt, bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    ctx.mats[key] = m
    return m

def grain_mat(ctx, key, c1, c2, scale=9.0, along='x', rough=0.45, bump=0.08, dist=6.0):
    """wood grain: bands running along game x ('x') or y ('y') or z ('z')"""
    key = 'grain' + key
    if key in ctx.mats: return ctx.mats[key]
    m, N, L, b, co = ctx.nodemat(key)
    w = N.new('ShaderNodeTexWave'); w.wave_type = 'BANDS'
    w.bands_direction = {'x': 'X', 'y': 'Y', 'z': 'X'}[along]   # Blender X = game y: bands vary along game y -> lines run along x
    w.inputs['Scale'].default_value = scale; w.inputs['Distortion'].default_value = dist
    w.inputs['Detail'].default_value = 3.0
    L.new(co, w.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*_lin(c1), 1); ramp.color_ramp.elements[1].color = (*_lin(c2), 1)
    L.new(w.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
    L.new(w.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    try: b.inputs['Coat Weight'].default_value = 0.4 if rough < 0.35 else 0.0
    except Exception: pass
    ctx.mats[key] = m
    return m

def tile_mat(ctx, key, c1, c2, grout, size=0.25, rough=0.2, bump=0.15):
    """square tiles on wall faces (horizontal coord = x+y like brick_mat), no stagger"""
    m = ctx.brick_mat(key, _h(c1), _h(c2), _h(grout), brick_w=size, brick_h=size / U, mortar_size=0.01, rough=rough, bump=bump)
    for n in m.node_tree.nodes:
        if n.bl_idname == 'ShaderNodeTexBrick': n.offset = 0.0
    return m

def shadow_blob(ctx, cx, cy, rx, ry, a=0.45):
    """soft contact shadow on the ground (alpha gradient disc)"""
    key = 'blobshadow%.2f' % a
    if key not in ctx.mats:
        m, N, L, b, co = ctx.nodemat(key)
        nx = NX(N, L)
        sep = N.new('ShaderNodeSeparateXYZ'); L.new(co, sep.inputs[0])
        r = nx.m('SQRT', nx.add(nx.mul(sep.outputs[0], sep.outputs[0]), nx.mul(sep.outputs[1], sep.outputs[1])))
        k = nx.m('MAXIMUM', nx.sub(1.0, r), 0.0)
        L.new(nx.mul(nx.mul(k, k), a), b.inputs['Alpha'])
        b.inputs['Base Color'].default_value = (0.01, 0.005, 0.01, 1); b.inputs['Roughness'].default_value = 1
        _blend(m); ctx.mats[key] = m
    bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=24, radius=1.0)
    ob = _mk(ctx, bm, ctx.mats[key], 'shadow', ctx.G(cx, cy, 0.004))
    ob.scale = (ry, rx, 1)    # Blender X = game y; object coords stay normalised for the gradient
    return ob

def DB(ctx, dy, x, y, z, w, d, h, mat, bev=0.0):
    """dir-aware box: dir 'y' swaps the local x/y axes"""
    return ctx.box(y, x, z, d, w, h, mat, bevel=bev) if dy else ctx.box(x, y, z, w, d, h, mat, bevel=bev)

def DP(dy, x, y, z):
    return (y, x, z) if dy else (x, y, z)

def face_box(ctx, face, a, z, w, h, mat, t=0.02, out=0.0, bev=0.0):
    """panel on a visible face: 'y' = +y face (spans x from a), 'x' = +x face (spans y from a)"""
    if face == 'y': return ctx.box(a, 1 + out - 0.005, z, w, t, h, mat, bevel=bev)
    return ctx.box(1 + out - 0.005, a, z, t, w, h, mat, bevel=bev)

def fpt(face, a, off, z):
    """point on a visible face: a along the face, off = distance out from the face (m), z units"""
    return (a, 1 + off, z) if face == 'y' else (1 + off, a, z)

def ring(ctx, z, hh, mat, out=0.015, inset=0.0):
    """band wrapping both visible faces of a block"""
    return ctx.box(inset, inset, z, 1 + out - inset, 1 + out - inset, hh, mat)

BOTTLES = ['#2a6a2a', '#7a3a10', '#d8d0b0', '#3a5a9a', '#a01a1a', '#c89020', '#1a1a1a', '#5a8a3a']

def bottle(ctx, x, y, z, hgt, col, r=0.032, lab=None):
    gl = ctx.mat('btl' + col, _h(col), 0.12, 0.0, emit=_h(col), emit_strength=0.25)
    b = hgt * 0.62
    lathe(ctx, x, y, z, [(r * 0.9, 0), (r, 0.01), (r, b), (r * 0.45, b + hgt * 0.14), (r * 0.32, b + hgt * 0.18), (r * 0.32, hgt), (0, hgt)], gl, seg=10)
    if lab: ctx.cyl(x, y, z + b * 0.35, r + 0.002, b * 0.3, M(ctx, lab, 0.7), 10)

def pint(ctx, x, y, z, full=True, dark=False):
    glass = alpha_mat(ctx, 'pintglass', '#d8e8f0', 0.35, 0.05)
    lathe(ctx, x, y, z, [(0.03, 0), (0.036, 0.15), (0.04, 0.16), (0.038, 0.17)], glass, seg=12)
    if full:
        beer = ctx.mat('beer' + str(dark), _h('#1a0e08' if dark else '#b06a18'), 0.15, 0, emit=_h('#5a2a08'), emit_strength=0.25)
        lathe(ctx, x, y, z + 0.005, [(0.028, 0), (0.034, 0.13), (0, 0.13)], beer, seg=12)
        ctx.cyl(x, y, z + 0.135, 0.035, 0.025, M(ctx, '#f5f0e0', 0.8), 12)

# ================================================================== WALLS
def w_ext_brick(ctx, h, v):
    """The Anchor's Victorian exterior: red brick over a green glazed-tile plinth, cream stone cornice,
    big etched pub windows glowing amber, cafe curtains on brass rods."""
    brick = ctx.brick_mat('pxBrick%d' % (v % 3), _h(['#7a3a2a', '#82402c', '#743628'][v % 3]), _h('#6a3024'), _h('#3a2220'), seed_off=v * 0.31, bump=0.45)
    ctx.box(0, 0, 0.5, 1, 1, h - 0.65, brick)
    glaze = tile_mat(ctx, 'pxGlaze', '#1f5a3a', '#235f40', '#0e2a1a', size=0.125, rough=0.12, bump=0.25)
    ctx.box(0, 0, 0, 1.025, 1.025, 0.5, glaze)
    ctx.box(0, 0, 0.47, 1.04, 1.04, 0.06, M(ctx, '#143a26', 0.15, key='pxBull'), bevel=0.012)   # bullnose trim
    ctx.box(0, 0, 0, 1.03, 1.03, 0.06, M(ctx, '#0e2a1a', 0.3, key='pxPlinthFoot'))
    stone = ctx.noise_mat('pxStone', _h('#c8b89a'), _h('#a89878'), scale=22, bump=0.25)
    ctx.box(0, 0, h - 0.15, 1.045, 1.045, 0.15, stone, bevel=0.01)                              # cornice
    for i in range(5):                                                                          # dentils
        ctx.box(i * 0.2 + 0.05, 1.0, h - 0.24, 0.1, 0.03, 0.08, stone); ctx.box(1.0, i * 0.2 + 0.05, h - 0.24, 0.03, 0.1, 0.08, stone)
    ctx.box(0, 0, h - 0.002, 1.0, 1.0, 0.004, ctx.noise_mat('pxRoof', _h('#3a2a26'), _h('#2a1e1c'), scale=30, bump=0.4))
    rnd = random.Random(v * 17 + 3)
    if v % 6 in (0, 1, 2, 4):
        for face in ('x', 'y'): pub_window(ctx, face, 0.12, 0.75, 0.76, h - 0.6 - 0.75, rnd, curtain=v % 2 == 0)
    elif v % 6 == 3:   # blank bay with a brass carriage lantern
        for face in ('x', 'y'):
            face_box(ctx, face, 0.25, 0.9, 0.5, 1.55, ctx.brick_mat('pxRecess', _h('#5a2a20'), _h('#4e2418'), _h('#2a1816')), t=0.02, out=-0.03)
            lantern(ctx, face, 0.5, 2.1)
    else:              # blank bay: drainpipe + ventilation brick
        pipe = M(ctx, '#1a1e1c', 0.35, 0.5)
        ctx.cyl(0.86, 1.05, 0.05, 0.035, h - 0.2, pipe, 10); ctx.box(0.81, 1.0, h - 0.4, 0.1, 0.1, 0.18, pipe)
        ctx.cyl(1.05, 0.86, 0.05, 0.035, h - 0.2, pipe, 10); ctx.box(1.0, 0.81, h - 0.4, 0.1, 0.1, 0.18, pipe)
        vent = M(ctx, '#2a2422', 0.8)
        face_box(ctx, 'y', 0.35, 1.5, 0.25, 0.18, vent); face_box(ctx, 'x', 0.35, 1.5, 0.25, 0.18, vent)

def pub_window(ctx, face, a, z0, w, hh, rnd, curtain=True):
    frame = M(ctx, '#d8d0c0', 0.5, key='pxFrame')
    lower = ctx.mat('pxGlassLo', _h('#3a2410'), 0.15, 0, emit=_h('#e8a040'), emit_strength=1.6)
    upper = ctx.mat('pxGlassHi', _h('#4a3010'), 0.15, 0, emit=_h('#ffd27a'), emit_strength=2.2)
    etch = ctx.mat('pxEtch', _h('#fff4d8'), 0.3, 0, emit=_h('#fff0c8'), emit_strength=2.8)
    tz = z0 + hh * 0.62
    # deep reveal: dark interior box sunk into the brick, glass a little in, frame proud
    face_box(ctx, face, a, z0, w, hh, M(ctx, '#140c08', 0.9, key='pxReveal'), t=0.03, out=0.0)
    face_box(ctx, face, a + 0.02, z0 + 0.02, w - 0.04, tz - z0 - 0.04, lower, t=0.01, out=0.03)
    face_box(ctx, face, a + 0.02, tz + 0.03, w - 0.04, z0 + hh - tz - 0.05, upper, t=0.01, out=0.03)
    # etched oval in the lower pane + fan lines in the transom
    cx = a + w / 2
    for i, (ww, zz) in enumerate(((0.16, 0.0), (0.28, 0.08), (0.34, 0.2), (0.28, 0.32), (0.16, 0.4))):
        face_box(ctx, face, cx - ww / 2, z0 + (tz - z0) * 0.3 + zz, ww, 0.03, etch, t=0.005, out=0.041)
    for k in range(5):
        face_box(ctx, face, a + 0.06 + k * (w - 0.12) / 4 - 0.008, tz + 0.08, 0.016, (z0 + hh - tz) * 0.6, frame, t=0.006, out=0.04)
    # frame: outer, mullion, transom, sill, pediment
    for (aa, zz, ww, hz) in ((a - 0.03, z0 - 0.03, w + 0.06, 0.05), (a - 0.03, z0 + hh - 0.02, w + 0.06, 0.05),
                             (a - 0.03, z0 - 0.03, 0.05, hh + 0.05), (a + w - 0.02, z0 - 0.03, 0.05, hh + 0.05),
                             (cx - 0.02, z0, 0.04, tz - z0), (a, tz - 0.01, w, 0.05)):
        face_box(ctx, face, aa, zz, ww, hz, frame, t=0.05, out=0.0)
    face_box(ctx, face, a - 0.06, z0 - 0.1, w + 0.12, 0.07, M(ctx, '#b8ac94', 0.6, key='pxSill'), t=0.09, out=0.0)
    face_box(ctx, face, a - 0.05, z0 + hh + 0.03, w + 0.1, 0.08, M(ctx, '#c8b89a', 0.6, key='pxPedi'), t=0.07, out=0.0)
    if curtain:   # half-height cafe curtains on a brass rod
        brass = M(ctx, '#d8a838', 0.25, 1.0, key='brass')
        cur = ctx.noise_mat('pxCurtain', _h('#7a1420'), _h('#5a0c16'), scale=40, bump=0.4)
        rz = z0 + (tz - z0) * 0.55
        face_box(ctx, face, a + 0.02, rz, w - 0.04, 0.025, brass, t=0.02, out=0.05)
        for k in range(6):
            face_box(ctx, face, a + 0.03 + k * (w - 0.06) / 6, z0 + 0.03, (w - 0.06) / 6 - 0.005, rz - z0 - 0.03, cur, t=0.012 + 0.01 * (k % 2), out=0.045)

def lantern(ctx, face, a, z):
    iron = M(ctx, '#1a1a1e', 0.4, 0.6, key='iron2')
    glow = ctx.mat('lanternGlow', _h('#ffe0a0'), 0.2, 0, emit=_h('#ffd080'), emit_strength=5)
    p0 = fpt(face, a, 0.0, z + 0.25); p1 = fpt(face, a, 0.22, z + 0.25)
    beam(ctx, p0, p1, 0.012, iron, square=True)
    c = fpt(face, a, 0.22, z - 0.2)
    ctx.box(c[0] - 0.06, c[1] - 0.06, c[2], 0.12, 0.12, 0.3, glow)
    ctx.box(c[0] - 0.08, c[1] - 0.08, c[2] + 0.3, 0.16, 0.16, 0.05, iron)
    ctx.cyl(c[0], c[1], c[2] + 0.35, 0.05, 0.08, iron, 8, r2=0.01)
    ctx.box(c[0] - 0.07, c[1] - 0.07, c[2] - 0.04, 0.14, 0.14, 0.05, iron)
    for dx in (-0.065, 0.055):
        for dy in (-0.065, 0.055): ctx.box(c[0] + dx, c[1] + dy, c[2], 0.01, 0.01, 0.3, iron)

def damask_mat(ctx, key, base, ring_c, gold, h):
    """flock wallpaper: staggered diamond medallions (1/4 m) on the wall faces, nicotine toward the ceiling"""
    def fn(nx, X, Y, Z, tc):
        s = nx.add(X, Y)
        row = nx.floor(nx.mul(Z, 3.4))
        u = nx.fract(nx.add(nx.mul(s, 4.0), nx.mul(nx.mod(row, 2.0), 0.5)))
        vv = nx.fract(nx.mul(Z, 3.4))
        d = nx.add(nx.abs(nx.sub(u, 0.5)), nx.mul(nx.abs(nx.sub(vv, 0.5)), 0.8))
        petal = nx.mul(nx.lt(nx.abs(nx.sub(u, 0.5)), 0.07), nx.lt(nx.abs(nx.sub(vv, 0.5)), 0.42))
        c = nx.mix(nx.mx(nx.lt(d, 0.13), petal), base, gold)
        c = nx.mix(nx.mul(nx.gt(d, 0.27), nx.lt(d, 0.34)), c, ring_c)
        top = nx.mx(nx.sub(Z, (h - 0.9) * U), 0.0)
        c = nx.mix(nx.mn(nx.mul(top, 0.5), 0.35), c, '#6a5a2a')
        return c, nx.lt(d, 0.13)
    return pattern_mat(ctx, key, fn, rough=0.95, bump=0.25)

def w_panel(ctx, h, v):
    """lounge wall: flock wallpaper over a dark mahogany dado, picture rail, cornice; framed pictures & sconces"""
    dado = min(1.3, round(h * 0.45 * 20) / 20)
    paper = damask_mat(ctx, 'pnPaper%s' % h, '#5a1420', '#7a5a2a', '#b08a3a', h)
    ctx.box(0, 0, dado, 1, 1, h - dado, paper)
    wood = grain_mat(ctx, 'pnWood', '#4a2a14', '#6a3e20', scale=7, along='z', rough=0.4)
    dark = grain_mat(ctx, 'pnDark', '#2e1a0c', '#46280f', scale=9, along='z', rough=0.45)
    ctx.box(0, 0, 0, 1, 1, dado, dark)
    for face in ('x', 'y'):
        for k in range(2):   # two raised & fielded panels per tile per face
            a = 0.06 + k * 0.5
            face_box(ctx, face, a, 0.25, 0.38, dado - 0.45, wood, t=0.025, out=0.0, bev=0.008)
            face_box(ctx, face, a + 0.05, 0.31, 0.28, dado - 0.57, wood, t=0.02, out=0.02, bev=0.01)
    ctx.box(0, 0, 0, 1.03, 1.03, 0.16, M(ctx, '#22140a', 0.5, key='pnSkirt'), bevel=0.006)
    rail = M(ctx, '#9a7a42', 0.35, 0.2, key='pnRail')
    ctx.box(0, 0, dado - 0.08, 1.035, 1.035, 0.08, rail, bevel=0.01)
    ctx.box(0, 0, h - 0.5, 1.02, 1.02, 0.04, M(ctx, '#3a2414', 0.4, key='pnPicRail'))
    ctx.box(0, 0, h - 0.14, 1.045, 1.045, 0.14, M(ctx, '#3a2414', 0.4, key='pnCornice'), bevel=0.012)
    ctx.box(0, 0, h - 0.18, 1.025, 1.025, 0.04, M(ctx, '#7a5a32', 0.35, key='pnCorniceHi'))
    ctx.box(0, 0, h - 0.002, 1.0, 1.0, 0.004, M(ctx, '#2a1a12', 0.9, key='pnTop'))
    if h < 3:
        if v % 4 == 2:
            for face in ('x', 'y'): sconce(ctx, face, 0.5, dado + 0.55)
        return
    kind = v % 8
    for face in ('x', 'y'):
        if kind in (1, 5): picture(ctx, face, 0.2, dado + 0.35, 0.6, 0.85, 'ship' if kind == 1 else 'team')
        elif kind in (3, 7): sconce(ctx, face, 0.5, dado + 0.8)
        elif kind == 6: mirror(ctx, face, 0.5, dado + 0.85)

def picture(ctx, face, a, z, w, hh, what):
    gold = M(ctx, '#c8a040', 0.3, 0.8, key='gilt')
    face_box(ctx, face, a, z, w, hh, gold, t=0.035, out=0.0, bev=0.008)
    face_box(ctx, face, a + 0.05, z + 0.06, w - 0.1, hh - 0.12, M(ctx, '#6a4a1a', 0.6, key='picMat'), t=0.01, out=0.035)
    ia, iz, iw, ih = a + 0.08, z + 0.1, w - 0.16, hh - 0.2
    if what == 'ship':
        face_box(ctx, face, ia, iz + ih * 0.45, iw, ih * 0.55, M(ctx, '#a8b8c0', 0.7, key='picSky'), t=0.005, out=0.045)
        face_box(ctx, face, ia, iz, iw, ih * 0.45, M(ctx, '#1a3a5a', 0.5, key='picSea'), t=0.005, out=0.045)
        face_box(ctx, face, ia + iw * 0.2, iz + ih * 0.32, iw * 0.6, ih * 0.16, M(ctx, '#3a1a10', 0.6, key='picHull'), t=0.005, out=0.05)
        face_box(ctx, face, ia + iw * 0.48, iz + ih * 0.48, 0.015, ih * 0.42, M(ctx, '#3a2a1a', 0.6, key='picMast'), t=0.005, out=0.05)
        for (sa, sz, sw, sh) in ((0.28, 0.52, 0.18, 0.3), (0.53, 0.55, 0.16, 0.27)):
            face_box(ctx, face, ia + iw * sa, iz + ih * sz, iw * sw, ih * sh, M(ctx, '#e8e0d0', 0.7, key='picSail'), t=0.005, out=0.052)
    else:   # sepia team photo: two rows of little figures
        face_box(ctx, face, ia, iz, iw, ih, M(ctx, '#a08a60', 0.7, key='picSepia'), t=0.005, out=0.045)
        for r in range(2):
            for k in range(5):
                aa = ia + 0.04 + k * (iw - 0.08) / 4.6
                zz = iz + 0.08 + r * ih * 0.38
                face_box(ctx, face, aa, zz, 0.05, ih * 0.22, M(ctx, '#c8102e' if r == 0 else '#5a4a30', 0.7, key='picShirt%d' % r), t=0.005, out=0.05)
                face_box(ctx, face, aa + 0.008, zz + ih * 0.22, 0.034, 0.06, M(ctx, '#3a2a1a', 0.7, key='picHead'), t=0.005, out=0.05)

def sconce(ctx, face, a, z):
    brass = M(ctx, '#c8a040', 0.3, 0.9, key='brassS')
    shade_m = ctx.mat('sconceShade', _h('#f0a848'), 0.4, 0, emit=_h('#ffb050'), emit_strength=3.0)
    face_box(ctx, face, a - 0.05, z - 0.12, 0.1, 0.16, brass, t=0.02, out=0.0, bev=0.005)
    beam(ctx, fpt(face, a, 0.0, z - 0.04), fpt(face, a, 0.12, z + 0.04), 0.01, brass)
    c = fpt(face, a, 0.13, z + 0.05)
    lathe(ctx, c[0], c[1], c[2], [(0.03, 0), (0.075, 0.18), (0.05, 0.2)], shade_m, seg=14)
    # warm wash on the wallpaper
    wash = alpha_mat(ctx, 'sconceWash', '#ffb050', 0.18, 0.9, emit='#ffa040', es=0.8)
    face_box(ctx, face, a - 0.22, z - 0.25, 0.44, 0.75, wash, t=0.002, out=0.003)

def mirror(ctx, face, a, z):
    gold = M(ctx, '#c8a040', 0.3, 0.8, key='gilt')
    glass = M(ctx, '#5a6a78', 0.05, 0.9, key='mirrorGlass')
    p = fpt(face, a, 0.0, z)
    ax = 'y' if face == 'y' else 'x'
    disc(ctx, p[0], p[1], p[2], 0.28, gold, axis=ax, t=0.03)
    p2 = fpt(face, a, 0.03, z)
    disc(ctx, p2[0], p2[1], p2[2], 0.23, glass, axis=ax, t=0.008)

def w_panel_low(ctx, h, v):
    """snug half-wall: panelled oak with a wide capping rail"""
    wood = grain_mat(ctx, 'plWood', '#4a2a14', '#6a3e20', scale=7, along='z', rough=0.4)
    dark = grain_mat(ctx, 'plDark', '#2e1a0c', '#46280f', scale=9, along='z', rough=0.45)
    ctx.box(0, 0, 0, 1, 1, h - 0.1, dark)
    for face in ('x', 'y'):
        for k in range(2):
            a = 0.06 + k * 0.5
            face_box(ctx, face, a, 0.2, 0.38, h - 0.45, wood, t=0.025, bev=0.008)
            face_box(ctx, face, a + 0.05, 0.26, 0.28, h - 0.57, wood, t=0.02, out=0.02, bev=0.01)
    ctx.box(0, 0, 0, 1.03, 1.03, 0.12, M(ctx, '#22140a', 0.5, key='pnSkirt'))
    cap = grain_mat(ctx, 'plCap', '#6a4022', '#8a5a30', scale=5, along='x' if v % 2 else 'y', rough=0.3)
    ctx.box(-0.0, -0.0, h - 0.1, 1.04, 1.04, 0.1, cap, bevel=0.015)

def w_bar(ctx, h, v):
    """THE COUNTER: mahogany panelled front, polished top with beer mats / drip trays, brass foot rail (on the +y side)"""
    body = grain_mat(ctx, 'barBody', '#3a1408', '#5a2010', scale=8, along='z', rough=0.4)
    pan = grain_mat(ctx, 'barPanel', '#6a2a14', '#8a3a1c', scale=6, along='z', rough=0.3)
    ctx.box(0, 0, 0, 1, 1, h - 0.1, body)
    for face in ('x', 'y'):
        for k in range(2):
            a = 0.07 + k * 0.5
            face_box(ctx, face, a, 0.3, 0.36, h - 0.55, pan, t=0.02, bev=0.008)
            face_box(ctx, face, a + 0.04, 0.35, 0.28, h - 0.65, pan, t=0.02, out=0.02, bev=0.01)
        face_box(ctx, face, 0.0, h - 0.24, 1.0, 0.07, M(ctx, '#2a0e06', 0.4, key='barShadowLip'), t=0.03)
    ctx.box(0, 0, 0, 1.025, 1.025, 0.14, M(ctx, '#1e0c06', 0.5, key='barKick'))
    top = grain_mat(ctx, 'barTop', '#4e1e10', '#6e2c16', scale=5, along='x', rough=0.18, bump=0.04)
    ctx.box(0, 0, h - 0.1, 1.0, 1.08, 0.1, top, bevel=0.02)
    # brass foot rail on brackets along the customer (+y) side
    brass = M(ctx, '#e0b040', 0.22, 1.0, key='brassRail')
    hcyl(ctx, -0.01, 1.14, 0.27, 1.01, 1.14, 0.27, 0.025, brass)
    for x in (0.25, 0.75):
        beam(ctx, (x, 1.0, 0.2), (x, 1.14, 0.27), 0.012, brass)
    k = v % 6
    surf = h + 0.003
    if k == 0:   # round beer mat (red ring) + pint
        disc(ctx, 0.45, 0.55, h, 0.065, M(ctx, '#f4f1e8', 0.8, key='matW'), t=0.004)
        disc(ctx, 0.45, 0.55, h + 0.002, 0.05, M(ctx, '#c8102e', 0.8, key='matR'), t=0.004)
        disc(ctx, 0.45, 0.55, h + 0.004, 0.032, M(ctx, '#f4f1e8', 0.8, key='matW'), t=0.004)
    elif k == 1:   # ribbed rubber drip mat
        ctx.box(0.12, 0.25, h, 0.76, 0.4, 0.008, M(ctx, '#2a2a2e', 0.7, key='dripMat'))
        for i in range(10): ctx.box(0.15 + i * 0.072, 0.27, h + 0.008, 0.035, 0.36, 0.006, M(ctx, '#0c0c0e', 0.6, key='dripRib'))
    elif k == 2:   # wet ring stains + a half pint
        pint(ctx, 0.62, 0.48, h, full=True, dark=True)
    elif k == 3:   # brass drip tray
        ctx.box(0.2, 0.3, h, 0.6, 0.32, 0.02, M(ctx, '#c8a040', 0.25, 0.9, key='tray'), bevel=0.005)
        for i in range(8): ctx.box(0.23 + i * 0.07, 0.33, h + 0.02, 0.03, 0.26, 0.003, M(ctx, '#7a6020', 0.4, 0.8, key='trayHole'))
    elif k == 4:   # beer mats + empty pint
        disc(ctx, 0.3, 0.6, h, 0.06, M(ctx, '#e8e0d0', 0.8, key='matC'), t=0.004)
        disc(ctx, 0.62, 0.42, h, 0.06, M(ctx, '#3a6ae8', 0.8, key='matB'), t=0.004)
        pint(ctx, 0.62, 0.42, h + 0.004, full=False)
    # k == 5: bare polished top

def w_backbar(ctx, h, v):
    """back bar: chiller fridges, two lit shelves of bottles, mirror with optics; detailed on the +y face"""
    rnd = random.Random(v * 31 + 7)
    wood = grain_mat(ctx, 'bbWood', '#3a2414', '#5a3420', scale=8, along='z', rough=0.4)
    ctx.box(0, 0, 0, 0.92, 0.92, h, wood)
    ctx.box(0, 0, h - 0.002, 1.0, 1.0, 0.004, M(ctx, '#2a1a12', 0.9, key='pnTop'))
    ctx.box(0, 0, h - 0.18, 1.04, 1.04, 0.18, M(ctx, '#3a2414', 0.4, key='pnCornice'), bevel=0.01)
    ctx.box(0, 0, h - 0.22, 1.02, 1.02, 0.04, M(ctx, '#8a6a3a', 0.35, key='bbCorniceHi'))
    # chiller fridges z 0..0.9 (glowing blue-white interiors with bottles)
    frame = M(ctx, '#1a1a1e', 0.35, 0.4, key='fridgeFrame')
    inside = ctx.mat('fridgeIn', _h('#2a5a6a'), 0.4, 0, emit=_h('#5aa0c0'), emit_strength=0.7)
    ctx.box(0, 0, 0, 1.0, 1.0, 0.92, frame)
    for face in ('y', 'x'):
        for k in range(2):
            a = 0.04 + k * 0.48
            face_box(ctx, face, a, 0.08, 0.44, 0.78, inside, t=0.01, out=0.002)
            for s in range(3):
                zz = 0.1 + s * 0.26
                face_box(ctx, face, a, zz, 0.44, 0.015, M(ctx, '#2a5a6a', 0.4, key='fridgeShelf'), t=0.06, out=-0.05)
                for b in range(5):
                    c = rnd.choice(['#c86a1a', '#3a8a3a', '#c8a020', '#a01a1a', '#2a4a8a'])
                    p = fpt(face, a + 0.05 + b * 0.085, -0.02, zz + 0.015)
                    bottle(ctx, p[0], p[1], p[2], 0.2, c, r=0.025)
            face_box(ctx, face, a + 0.02, 0.1, 0.03, 0.7, M(ctx, '#c8c8d0', 0.2, 0.9, key='fridgeHandle'), t=0.02, out=0.03)
            face_box(ctx, face, a, 0.08, 0.44, 0.78, alpha_mat(ctx, 'fridgeGlass', '#d8f0ff', 0.12, 0.02), t=0.004, out=0.035)
    ctx.box(0, 0, 0.9, 1.05, 1.05, 0.08, grain_mat(ctx, 'bbLedge', '#6a2a14', '#8a3a1a', scale=6, along='x', rough=0.25), bevel=0.01)
    # shelves of bottles (+y face full, +x face lighter)
    led = ctx.mat('shelfLED', _h('#ffe0a0'), 0.3, 0, emit=_h('#ffd27a'), emit_strength=4)
    for face in ('y', 'x'):
        full = face == 'y'
        for si, zb in enumerate((1.05, 1.75)):
            face_box(ctx, face, 0.0, zb - 0.04, 1.0, 0.04, M(ctx, '#5a3a20', 0.4, key='bbShelf'), t=0.14, out=-0.04)
            face_box(ctx, face, 0.0, zb - 0.045, 1.0, 0.012, led, t=0.005, out=0.1)
            n = 9 if full else 5
            for b in range(n):
                aa = 0.06 + b * (0.88 / (n - 1))
                p = fpt(face, aa, -0.02 + rnd.random() * 0.04, zb)
                if si == 0 and rnd.random() < 0.3:
                    glass = alpha_mat(ctx, 'pintglass', '#d8e8f0', 0.35, 0.05)
                    lathe(ctx, p[0], p[1], p[2], [(0.038, 0), (0.03, 0.16), (0, 0.16)], glass, seg=10)
                else:
                    bottle(ctx, p[0], p[1], p[2], 0.42 + rnd.random() * 0.22, rnd.choice(BOTTLES), r=0.035, lab=rnd.choice(['#e8e0c8', '#f4f1e8', '#c8a040']))
        # mirror with optics (upside-down bottles in brass measures)
        mz = 2.42
        face_box(ctx, face, 0.02, mz, 0.96, h - 0.22 - mz - 0.02, M(ctx, '#4a5a68', 0.04, 0.95, key='bbMirror'), t=0.01, out=-0.07)
        if full:
            brass = M(ctx, '#d8a838', 0.25, 1.0, key='brass')
            for b in range(4):
                aa = 0.14 + b * 0.24
                c = rnd.choice(BOTTLES)
                p = fpt(face, aa, -0.01, mz + 0.12)
                ctx.box(p[0] - 0.03 if face == 'y' else p[0] - 0.03, p[1] - 0.03, mz + 0.06, 0.06, 0.06, 0.05, brass)
                gl = ctx.mat('btl' + c, _h(c), 0.12, 0.0, emit=_h(c), emit_strength=0.25)
                lathe(ctx, p[0], p[1], mz + 0.11, [(0.012, 0), (0.012, 0.06), (0.04, 0.12), (0.04, 0.42), (0, 0.44)], gl, seg=10)
                ctx.cyl(p[0], p[1], mz + 0.48, 0.008, h - 0.22 - mz - 0.48, brass, 6)
    # bottom light strip under the ledge
    face_box(ctx, 'y', 0.0, 0.88, 1.0, 0.015, led, t=0.004, out=0.04)

def w_gents(ctx, h, v):
    """the gents: cream tiles, a dark green glazed band, green skirting tiles, grime, copper flush pipe"""
    rnd = random.Random(v * 11 + 1)
    cream = tile_mat(ctx, 'gtCream', '#ddd8c4', '#d4ceb8', '#8a8a7e', size=0.2, rough=0.18, bump=0.25)
    green = tile_mat(ctx, 'gtGreen', '#2a7a5a', '#26725a', '#1a4a36', size=0.2, rough=0.12, bump=0.25)
    dgreen = tile_mat(ctx, 'gtDark', '#245a42', '#215640', '#1a3a2a', size=0.2, rough=0.15, bump=0.25)
    ctx.box(0, 0, 0, 1, 1, h, cream)
    ctx.box(0, 0, 0, 1.012, 1.012, 0.4, dgreen)
    ctx.box(0, 0, 1.7, 1.012, 1.012, 0.4, green)
    blk = M(ctx, '#101a14', 0.3, key='gtLine')
    for z in (1.68, 2.1): ctx.box(0, 0, z, 1.02, 1.02, 0.03, blk, bevel=0.005)
    ctx.box(0, 0, h - 0.06, 1.02, 1.02, 0.06, M(ctx, '#b8b8b0', 0.5, key='gtTop'))
    ctx.box(0, 0, h - 0.002, 1.0, 1.0, 0.004, M(ctx, '#9a9aa0', 0.8, key='gtCeil'))
    # grime: translucent streaks running down from the band and at the floor
    grime = alpha_mat(ctx, 'gtGrime', '#7a6a3a', 0.28, 0.9)
    for face in ('x', 'y'):
        for k in range(3):
            a = rnd.random() * 0.8
            face_box(ctx, face, a, 0.4, 0.04 + rnd.random() * 0.08, 0.5 + rnd.random() * 0.9, grime, t=0.002, out=0.015)
        face_box(ctx, face, 0, 0.4, 1, 0.12, grime, t=0.002, out=0.016)
    if v % 3 == 1:
        cu = M(ctx, '#b06a3a', 0.3, 0.9, key='copper')
        hcyl(ctx, 0.0, 1.06, 2.35, 1.0, 1.06, 2.35, 0.018, cu); hcyl(ctx, 1.06, 0.0, 2.35, 1.06, 1.0, 2.35, 0.018, cu)
        for a in (0.2, 0.7):
            ctx.box(a, 1.0, 2.31, 0.03, 0.07, 0.08, M(ctx, '#7a7a80', 0.4, 0.8, key='clip'))
            ctx.box(1.0, a, 2.31, 0.07, 0.03, 0.08, M(ctx, '#7a7a80', 0.4, 0.8, key='clip'))
    if v % 3 == 2:   # cracked & missing tile
        for face in ('x', 'y'):
            face_box(ctx, face, 0.4, 1.2, 0.2, 0.2, M(ctx, '#5a5a50', 0.9, key='gtMissing'), t=0.01, out=-0.005)
    if v == 3:       # ventilation grille
        for face in ('x', 'y'):
            face_box(ctx, face, 0.3, 2.5, 0.4, 0.3, M(ctx, '#c8c8c0', 0.5, key='gtVent'), t=0.02)
            for i in range(5): face_box(ctx, face, 0.33, 2.53 + i * 0.05, 0.34, 0.02, M(ctx, '#2a2a28', 0.6, key='gtVentS'), t=0.01, out=0.02)

def w_partition(ctx, h, v):
    """cubicle partition: brown laminate on chrome feet (gap at the bottom), aluminium top rail, scratched wisdom"""
    rnd = random.Random(v * 5 + 2)
    lam = grain_mat(ctx, 'ptLam', '#5e4230', '#6e4e36', scale=3, along='z', rough=0.35, bump=0.02, dist=2)
    ctx.box(0.04, 0.04, 0.2, 0.92, 0.92, h - 0.26, lam, bevel=0.01)
    alu = M(ctx, '#b8b8c0', 0.3, 0.9, key='alu')
    ctx.box(0.02, 0.02, h - 0.07, 0.96, 0.96, 0.07, alu, bevel=0.008)
    for (x, y) in ((0.06, 0.06), (0.86, 0.06), (0.06, 0.86), (0.86, 0.86)):
        ctx.cyl(x + 0.04, y + 0.04, 0, 0.025, 0.21, alu, 10)
    scratch = M(ctx, '#c8b898', 0.8, key='ptScratch'); ink = M(ctx, '#1a1a40', 0.6, key='ptInk')
    for face in ('x', 'y'):
        for k in range(7):
            a = 0.1 + rnd.random() * 0.7; z = 0.6 + rnd.random() * (h - 1.1)
            p0 = fpt(face, a, -0.035, z); p1 = fpt(face, a + 0.06 + rnd.random() * 0.12, -0.035, z + (rnd.random() - 0.5) * 0.1)
            beam(ctx, p0, p1, 0.004, scratch if k % 3 else ink, square=True)
    ctx.box(0.04, 0.04, h - 0.002, 0.92, 0.92, 0.004, M(ctx, '#a0a0a8', 0.6, key='ptTop'))

def cellar_mat(ctx, key, h):
    """whitewashed brick with peeling patches (red brick showing) and rising damp"""
    def fn(nx, X, Y, Z, tc):
        s = nx.add(X, Y)
        br = nx.N.new('ShaderNodeTexBrick')
        comb = nx.N.new('ShaderNodeCombineXYZ'); nx.L.new(s, comb.inputs[0]); nx.L.new(Z, comb.inputs[1])
        nx.L.new(comb.outputs[0], br.inputs['Vector'])
        br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = 0.012
        br.inputs['Brick Width'].default_value = 0.25; br.inputs['Row Height'].default_value = 0.0638; br.offset = 0.5
        br.inputs['Color1'].default_value = (*_lin('#d4d0c4'), 1); br.inputs['Color2'].default_value = (*_lin('#c4c0b2'), 1)
        br.inputs['Mortar'].default_value = (*_lin('#a8a498'), 1)
        red = nx.mix(br.outputs['Fac'], nx.mix(nx.noise(comb.outputs[0], 30), '#8a4a38', '#6a3428'), '#3a2a22')
        pe = nx.noise(comb.outputs[0], 3.5, 6)
        peel = nx.gt(pe, 0.62)
        c = nx.mix(peel, br.outputs['Color'], red)
        damp = nx.mx(nx.sub(1.0, nx.mul(Z, 1.4)), 0.0)
        c = nx.mix(nx.mn(nx.mul(damp, nx.add(0.6, nx.noise(comb.outputs[0], 6))), 0.85), c, '#38443a')
        return c, nx.add(br.outputs['Fac'], nx.mul(peel, 0.3)), 0.9
    return pattern_mat(ctx, key, fn, bump=0.4)

def w_cellar(ctx, h, v):
    rnd = random.Random(v * 13 + 5)
    ctx.box(0, 0, 0, 1, 1, h, cellar_mat(ctx, 'clWash', h))
    ctx.box(0, 0, h - 0.002, 1.0, 1.0, 0.004, ctx.noise_mat('clTop', _h('#6a6660'), _h('#58544e'), scale=20))
    kind = v % 5
    if kind == 0 and h > 2.5:   # beer lines (red / blue / white) clipped along the wall
        for i, c in enumerate(('#c03030', '#3050c0', '#d8d0c0')):
            z = 2.3 - i * 0.1
            m = M(ctx, c, 0.35, key='line' + c)
            hcyl(ctx, 0.0, 1.03, z, 1.0, 1.03, z, 0.018, m); hcyl(ctx, 1.03, 0.0, z, 1.03, 1.0, z, 0.018, m)
        for a in (0.25, 0.75):
            ctx.box(a, 1.0, 2.05, 0.03, 0.06, 0.32, M(ctx, '#7a7a80', 0.4, 0.8, key='clip'))
            ctx.box(1.0, a, 2.05, 0.06, 0.03, 0.32, M(ctx, '#7a7a80', 0.4, 0.8, key='clip'))
    elif kind == 2 and h > 2.5:   # bricked-up arch niche
        for face in ('x', 'y'):
            face_box(ctx, face, 0.2, 0.0, 0.6, 1.5, ctx.brick_mat('clNiche', _h('#4a3a32'), _h('#3e3028'), _h('#1e1814')), t=0.02, out=-0.025)
            p = fpt(face, 0.5, -0.02, 1.5)
            ax = (0, 0.06, 0) if face == 'y' else (0.06, 0, 0)
            beam(ctx, p, (p[0] + ax[0], p[1] + ax[1], p[2]), 0.36, ctx.brick_mat('clArch', _h('#8a4a38'), _h('#7a3e30'), _h('#3a2a26')), seg=24)
            beam(ctx, (p[0] - ax[0] * 0.1, p[1] - ax[1] * 0.1, p[2]), (p[0] + ax[0] * 1.1, p[1] + ax[1] * 1.1, p[2]), 0.29, ctx.brick_mat('clNiche', _h('#4a3a32'), _h('#3e3028'), _h('#1e1814')), seg=24)
            # the lower half of the discs must not poke below the niche top: cover with a wash band
            face_box(ctx, face, 0.12, 1.12, 0.76, 0.38, cellar_mat(ctx, 'clWash', h), t=0.08, out=-0.02)
            face_box(ctx, face, 0.2, 0.0, 0.6, 1.5, ctx.brick_mat('clNiche', _h('#4a3a32'), _h('#3e3028'), _h('#1e1814')), t=0.03, out=-0.02)
    elif kind == 4 and h > 2.5:   # caged bulkhead lamp
        for face in ('x', 'y'):
            p = fpt(face, 0.5, 0.0, 2.2)
            glow = ctx.mat('bulkGlow', _h('#fff0c0'), 0.2, 0, emit=_h('#ffe0a0'), emit_strength=6)
            face_box(ctx, face, 0.4, 2.1, 0.2, 0.2, M(ctx, '#2a2a2a', 0.5, 0.5, key='bulkBase'), t=0.03)
            face_box(ctx, face, 0.43, 2.13, 0.14, 0.14, glow, t=0.06)
            for i in range(3): face_box(ctx, face, 0.42 + i * 0.07, 2.12, 0.012, 0.16, M(ctx, '#1a1a1a', 0.5, 0.6, key='cage'), t=0.075)
    # damp streaks
    st = alpha_mat(ctx, 'clStreak', '#3e4a3a', 0.35, 0.9)
    for face in ('x', 'y'):
        for k in range(2):
            face_box(ctx, face, rnd.random() * 0.85, 0.0, 0.05 + rnd.random() * 0.1, 0.6 + rnd.random() * (h - 1.0), st, t=0.002, out=0.004)

def w_garden(ctx, h, v):
    rnd = random.Random(v * 7 + 9)
    brick = ctx.brick_mat('gwBrick%d' % (v % 2), _h('#6a3a2a'), _h('#5e3224'), _h('#2e1e1a'), seed_off=v * 0.4, bump=0.5)
    ctx.box(0, 0, 0, 1, 1, h - 0.14, brick)
    cop = pattern_mat(ctx, 'gwCoping', lambda nx, X, Y, Z, tc: (
        nx.mix(nx.gt(nx.noise(tc.outputs['Object'], 9, 6), 0.56), '#8a8478', '#4a6a34'), nx.noise(tc.outputs['Object'], 9, 6)), rough=0.9, bump=0.6)
    ctx.box(-0.02, -0.02, h - 0.14, 1.06, 1.06, 0.14, cop, bevel=0.02)
    moss = ctx.noise_mat('gwMoss', _h('#2e4a24'), _h('#3e6a2e'), scale=25, bump=0.8)
    for face in ('x', 'y'):
        for k in range(3):
            a = rnd.random() * 0.8
            face_box(ctx, face, a, 0.0, 0.1 + rnd.random() * 0.2, 0.08 + rnd.random() * 0.15, moss, t=0.02, bev=0.008)
    if v % 4 == 3:   # ivy tumbling over the coping
        leaf = ctx.noise_mat('ivy', _h('#2a5a24'), _h('#3e7a30'), scale=30, bump=1.0)
        for k in range(10):
            ctx.sphere(0.2 + rnd.random() * 0.8, 0.9 + rnd.random() * 0.15, h - 0.2 - rnd.random() * 0.5, 0.06 + rnd.random() * 0.05, leaf, 1, 0.5, 0.8)

def w_fence(ctx, h, v):
    """close-board garden fence (boards on both visible faces), half eaten by ivy"""
    rnd = random.Random(v * 19 + 4)
    back = M(ctx, '#2a1a0e', 0.95, key='fnBack')
    ctx.box(0.02, 0.02, 0, 0.88, 0.88, h - 0.04, back)
    cols = [grain_mat(ctx, 'fnB%d' % i, c1, c2, scale=14, along='z', rough=0.85, bump=0.15) for i, (c1, c2) in enumerate((('#5a3e24', '#6e4c2c'), ('#64462a', '#7a5634'), ('#523822', '#664628')))]
    rail = M(ctx, '#3e2a16', 0.9, key='fnRail')
    for z in (0.35, h - 0.55): ctx.box(0, 0.86, z, 1, 0.04, 0.12, rail); ctx.box(0.86, 0, z, 0.04, 1, 0.12, rail)
    for i in range(7):
        hh = h - 0.06 * (i % 2)
        ctx.box(i / 7 + 0.006, 0.9, 0.04, 1 / 7 - 0.012, 0.06, hh - 0.04, rnd.choice(cols), bevel=0.004)
        ctx.box(0.9, i / 7 + 0.006, 0.04, 0.06, 1 / 7 - 0.012, hh - 0.04, rnd.choice(cols), bevel=0.004)
    ctx.box(0, 0.88, h - 0.06, 1, 0.1, 0.06, rail); ctx.box(0.88, 0, h - 0.06, 0.1, 1, 0.06, rail)
    gravel = M(ctx, '#3a3228', 0.9, key='fnGravel')
    ctx.box(0, 0.94, 0, 1, 0.04, 0.18, gravel); ctx.box(0.94, 0, 0, 0.04, 1, 0.18, gravel)
    leaf = [ctx.noise_mat('ivy%d' % i, _h(c), _h('#1e3a18'), scale=30, bump=1.0) for i, c in enumerate(('#2a5a24', '#3e7a30', '#346a2a'))]
    n = [14, 22, 8, 18, 26, 12][v % 6]
    for k in range(n):
        z = (rnd.random() ** 1.6) * h * 0.85
        a = rnd.random()
        r = 0.05 + rnd.random() * 0.06
        if rnd.random() < 0.5: ctx.sphere(a, 0.97, z, r, rnd.choice(leaf), 1.1, 0.45, 0.9)
        else: ctx.sphere(0.97, a, z, r, rnd.choice(leaf), 0.45, 1.1, 0.9)
    ctx.box(0.02, 0.02, h - 0.002, 0.96, 0.96, 0.004, M(ctx, '#5a4028', 0.9, key='fnTop'))

# ================================================================== FLOORS
def fl_yard(ctx, n):
    def fn(nx, X, Y, Z, tc):
        base = nx.mix(nx.pnoise(ctx, tc, n, 9, 8), '#4e4e4a', '#62625c')
        speck = nx.pnoise(ctx, tc, n, 60, 2)
        base = nx.mix(nx.mul(nx.gt(speck, 0.62), 0.5), base, '#6e6e68')
        oil = nx.pnoise(ctx, tc, n, 2.2, 3)
        base = nx.mix(nx.mul(nx.gt(oil, 0.62), 0.6), base, '#1e1e26')
        return base, speck, nx.add(0.85, nx.mul(nx.gt(oil, 0.62), -0.5))
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'yardConc%d' % n, fn, bump=0.35))
    joint = M(ctx, '#34342f', 0.95, key='yardJoint')
    for i in range(n):
        ctx.box(i, 0, -0.01, 0.025, n, 0.012, joint); ctx.box(0, i, -0.01, n, 0.025, 0.012, joint)
    # cracks with weeds
    rnd = random.Random(4)
    dark = M(ctx, '#262622', 0.95, key='crack'); weed = ctx.noise_mat('weed', _h('#2e4a24'), _h('#4a6e30'), scale=40, bump=1)
    for c in range(4):
        x, y = 0.4 + rnd.random() * 3.0, 0.4 + rnd.random() * 3.0
        ang = rnd.random() * 6.28
        for s in range(5):
            ang += (rnd.random() - 0.5) * 1.2
            x2, y2 = x + math.cos(ang) * 0.14, y + math.sin(ang) * 0.14
            if 0.1 < x2 < n - 0.1 and 0.1 < y2 < n - 0.1:
                beam(ctx, (x, y, 0.002), (x2, y2, 0.002), 0.008, dark, square=True)
                if rnd.random() < 0.35: ctx.sphere(x2, y2, 0.0, 0.035, weed, 1, 1, 0.5)
                x, y = x2, y2
    for k in range(6):   # bottle caps / fag ends
        x, y = 0.2 + rnd.random() * 3.6, 0.2 + rnd.random() * 3.6
        ctx.box(x, y, 0, 0.05, 0.015, 0.012, M(ctx, '#e8e0d0', 0.8, key='fagend'))

def fl_boards(ctx, n):
    ctx.plane(0, 0, n, n, M(ctx, '#1a0e08', 0.9, key='bdGap'), gz=-0.001)
    rnd = random.Random(21)
    mats = [grain_mat(ctx, 'bd%d' % i, c1, c2, scale=16, along='x', rough=0.55, bump=0.06, dist=3) for i, (c1, c2) in
            enumerate((('#40240f', '#55301c'), ('#4a2a18', '#5e3820'), ('#38200e', '#4a2a16'), ('#523019', '#64401f')))]
    nail = M(ctx, '#8a8a90', 0.4, 0.8, key='nail')
    W = 0.2
    for j in range(int(n / W)):
        o = rnd.random() * 2.0
        starts = [o - 2.0 + 2.0 * k for k in range(int(n / 2) + 2)]
        cols = [rnd.choice(mats) for _ in starts]
        for k, s in enumerate(starts):
            e = s + 2.0
            col = cols[k % int(n / 2)]
            a, b = max(s, 0.0), min(e, float(n))
            if b - a < 0.01: continue
            ga = 0.006 if a == s else 0.0; gb = 0.006 if b == e else 0.0
            ctx.box(a + ga, j * W + 0.006, 0, b - a - ga - gb, W - 0.012, 0.012, col)
            for xe in (s + 0.05, e - 0.07):
                if a <= xe < b - 0.02:
                    for yy in (0.05, 0.13): ctx.box(xe, j * W + yy, 0.012, 0.012, 0.012, 0.002, nail)
    # worn, paler path where the drinkers stand + sticky dark patches
    def wear(nx, X, Y, Z, tc):
        f = nx.pnoise(ctx, tc, n, 1.6, 3)
        return nx.mix(nx.gt(f, 0.55), '#7a5a3a', '#140a04'), None
    wm = pattern_mat(ctx, 'bdWear%d' % n, wear)
    m = wm.node_tree; b = m.nodes['Principled BSDF']
    # alpha from the same noise: worn where high, sticky where low
    nx = NX(m.nodes, m.links)
    f = nx.pnoise(ctx, m.nodes['Texture Coordinate'], n, 1.6, 3)
    a = nx.add(nx.mul(nx.mx(nx.sub(f, 0.55), 0.0), 2.2), nx.mul(nx.mx(nx.sub(0.4, f), 0.0), 2.0))
    m.links.new(a, b.inputs['Alpha']); _blend(wm)
    ctx.plane(0, 0, n, n, wm, gz=0.013)

def carpet_mat(ctx, n):
    TAU = 2 * math.pi
    def fn(nx, X, Y, Z, tc):
        # paisley-ish swirl, periodic every 1/1.5 and 1/1.25 m -> seamless over n=4
        # medallion lattice on the world axes (0.5 m cells, alternate rows offset) with swirling petals
        row = nx.floor(nx.mul(X, 2.0))
        cx = nx.sub(nx.fract(nx.add(nx.mul(Y, 2.0), nx.mul(nx.mod(row, 2.0), 0.5))), 0.5)
        cy = nx.sub(nx.fract(nx.mul(X, 2.0)), 0.5)
        r = nx.m('SQRT', nx.add(nx.mul(cx, cx), nx.mul(cy, cy)))
        ang = nx.m('ARCTAN2', cy, cx)
        pet = nx.sin(nx.add(nx.mul(ang, 5.0), nx.mul(r, 14.0)))
        c = nx.mix(nx.mul(nx.gt(pet, 0.2), nx.lt(r, 0.36)), '#5a161c', '#3a0c12')
        c = nx.mix(nx.mul(nx.mul(nx.gt(pet, 0.45), nx.gt(r, 0.16)), nx.lt(r, 0.33)), c, '#1e4430')
        c = nx.mix(nx.lt(nx.abs(nx.sub(r, 0.36)), 0.022), c, '#8a6a2a')
        c = nx.mix(nx.mul(nx.lt(r, 0.15), nx.gt(pet, -0.2)), c, '#7a2a1a')
        c = nx.mix(nx.lt(r, 0.06), c, '#c89a40')
        k = nx.m('SQRT', nx.add(nx.mul(nx.sub(nx.abs(cx), 0.5), nx.sub(nx.abs(cx), 0.5)), nx.mul(nx.sub(nx.abs(cy), 0.5), nx.sub(nx.abs(cy), 0.5))))
        c = nx.mix(nx.lt(k, 0.09), c, '#1e4430')
        c = nx.mix(nx.lt(k, 0.04), c, '#b08a36')
        st = nx.pnoise(ctx, tc, n, 2.4, 3)
        c = nx.mix(nx.mul(nx.gt(st, 0.64), 0.55), c, '#140406')        # pint stains
        fib = nx.pnoise(ctx, tc, n, 90, 2)
        c = nx.mix(nx.mul(fib, 0.25), c, '#000000')
        return c, fib
    return pattern_mat(ctx, 'carpet%d' % n, fn, rough=0.95, bump=0.5)

def fl_carpet(ctx, n):
    ctx.plane(0, 0, n, n, carpet_mat(ctx, n))
    rnd = random.Random(8)
    for k in range(5):   # fag burns + crisps
        x, y = 0.2 + rnd.random() * 3.6, 0.2 + rnd.random() * 3.6
        disc(ctx, x, y, 0, 0.02, M(ctx, '#0a0606', 0.9, key='burn'), t=0.002, seg=8)
    for k in range(3):
        x, y = 0.2 + rnd.random() * 3.6, 0.2 + rnd.random() * 3.6
        ctx.box(x, y, 0, 0.04, 0.03, 0.008, M(ctx, '#e8b040', 0.6, key='crisp'))

def fl_barmat(ctx, n):
    def fn(nx, X, Y, Z, tc):
        hu = nx.fract(nx.mul(X, 6.0)); hv = nx.fract(nx.mul(Y, 6.0))
        hole = nx.mul(nx.lt(nx.abs(nx.sub(hu, 0.5)), 0.2), nx.lt(nx.abs(nx.sub(hv, 0.5)), 0.2))
        edge = nx.mx(nx.lt(nx.fract(X), 0.03), nx.lt(nx.fract(Y), 0.03))
        beer = nx.gt(nx.pnoise(ctx, tc, n, 3, 2), 0.6)
        c = nx.mix(hole, '#2a2a2e', nx.mix(beer, '#0c0c0e', '#4a3014'))
        c = nx.mix(edge, c, '#3a3a40')
        return c, nx.sub(1.0, hole), nx.mix(hole, 0.75, 0.3) if False else None
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'barmat%d' % n, fn, rough=0.7, bump=0.6))

def fl_func(ctx, n):
    def fn(nx, X, Y, Z, tc):
        a = nx.mul(nx.add(X, Y), 2.0); b = nx.mul(nx.sub(X, Y), 2.0)
        fa = nx.fract(a); fb = nx.fract(b)
        line = nx.mx(nx.lt(fa, 0.035), nx.lt(fb, 0.035))
        ca = nx.add(nx.abs(nx.sub(fa, 0.5)), nx.abs(nx.sub(fb, 0.5)))
        c = nx.mix(nx.lt(ca, 0.27), '#1c2858', '#2c3a74')
        c = nx.mix(nx.lt(ca, 0.2), c, '#8a1a2a')
        c = nx.mix(nx.lt(ca, 0.08), c, '#c8a040')
        c = nx.mix(nx.lt(nx.abs(nx.sub(ca, 0.36)), 0.02), c, '#5a5a8a')
        c = nx.mix(line, c, '#a8822e')
        fib = nx.pnoise(ctx, tc, n, 90, 2)
        c = nx.mix(nx.mul(fib, 0.22), c, '#000000')
        sp = nx.pnoise(ctx, tc, n, 2.6, 3)
        c = nx.mix(nx.mul(nx.gt(sp, 0.66), 0.4), c, '#0a0a18')
        return c, nx.add(line, nx.mul(fib, 0.5))
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'func%d' % n, fn, rough=0.95, bump=0.4))
    rnd = random.Random(13)
    for k in range(10):  # confetti
        x, y = 0.2 + rnd.random() * 3.6, 0.2 + rnd.random() * 3.6
        ctx.box(x, y, 0, 0.03, 0.03, 0.004, M(ctx, rnd.choice(['#e8e8f0', '#c8102e', '#c8c8d0', '#ffd23a']), 0.5, key='conf%d' % (k % 4)))

def fl_dance(ctx, n):
    ctx.plane(0, 0, n, n, M(ctx, '#08080c', 0.4, key='danceGrout'), gz=-0.001)
    pal = ['#3a1a4a', '#1a3a4a', '#4a3a14', '#1a4a2a']
    em = ['#6a2a8a', '#2a6a8a', '#8a6a1a', '#2a8a4a']
    for i in range(n * 2):
        for j in range(n * 2):
            k = (i + 2 * j + (j // 2)) % 4
            m = ctx.mat('dance%d' % k, _h(pal[k]), 0.12, 0, emit=_h(em[k]), emit_strength=0.6)
            ctx.box(i * 0.5 + 0.025, j * 0.5 + 0.025, 0, 0.45, 0.45, 0.02, m, bevel=0.01)
            ctx.box(i * 0.5 + 0.06, j * 0.5 + 0.06, 0.02, 0.38, 0.38, 0.002, alpha_mat(ctx, 'danceHi', '#ffffff', 0.08, 0.05))

def fl_gents(ctx, n):
    def fn(nx, X, Y, Z, tc):
        su = nx.fract(nx.mul(X, 6.0)); sv = nx.fract(nx.mul(Y, 6.0))
        grout = nx.mx(nx.lt(su, 0.1), nx.lt(sv, 0.1))
        k = nx.mod(nx.add(nx.floor(nx.mul(X, 6.0)), nx.floor(nx.mul(Y, 6.0))), 2.0)
        c = nx.mix(k, '#7a98a8', '#c8c8bc')
        wet = nx.gt(nx.pnoise(ctx, tc, n, 1.7, 3), 0.55)
        c = nx.mix(nx.mul(wet, 0.3), c, '#9ab8c8')
        yel = nx.gt(nx.pnoise(ctx, tc, n, 7, 2), 0.66)
        c = nx.mix(nx.mul(yel, 0.35), c, '#b8a868')
        c = nx.mix(grout, c, '#5a5a50')
        return c, nx.sub(1.0, grout), nx.lerp(wet, nx.lerp(grout, 0.3, 0.8), 0.06)
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'gentsFl%d' % n, fn, bump=0.3))
    # floor drain
    ctx.cyl(2.0, 2.0, 0, 0.09, 0.006, M(ctx, '#8a8a90', 0.4, 0.8, key='drain'), 16)
    for i in range(5): ctx.box(1.93 + i * 0.03, 1.94, 0.006, 0.012, 0.12, 0.002, M(ctx, '#1a1a1a', 0.6, key='drainH'))

def fl_snug(ctx, n):
    def fn(nx, X, Y, Z, tc):
        x = nx.abs(nx.sub(nx.mul(nx.fract(nx.mul(X, 0.5)), 2.0), 1.0))
        y = nx.abs(nx.sub(nx.mul(nx.fract(nx.mul(Y, 0.5)), 2.0), 1.0))
        d = nx.add(x, y)
        c = nx.mix(nx.gt(d, 1.3), '#6a1a1a', '#2a1a3a')
        c = nx.mix(nx.lt(nx.abs(nx.sub(d, 0.9)), 0.08), c, '#c8a040')
        c = nx.mix(nx.lt(nx.abs(nx.sub(d, 1.12)), 0.03), c, '#1a2a4a')
        c = nx.mix(nx.lt(d, 0.4), c, '#1a2a4a')
        c = nx.mix(nx.lt(d, 0.25), c, '#c8a040')
        # small motifs between
        m = nx.add(nx.abs(nx.sub(nx.fract(nx.mul(X, 4.0)), 0.5)), nx.abs(nx.sub(nx.fract(nx.mul(Y, 4.0)), 0.5)))
        c = nx.mix(nx.mul(nx.lt(m, 0.12), nx.gt(d, 1.3)), c, '#8a5a2a')
        worn = nx.pnoise(ctx, tc, n, 3, 4)
        c = nx.mix(nx.mul(nx.gt(worn, 0.6), 0.45), c, '#4a3a30')
        fib = nx.pnoise(ctx, tc, n, 80, 2)
        c = nx.mix(nx.mul(fib, 0.2), c, '#000000')
        return c, fib
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'snug%d' % n, fn, rough=0.95, bump=0.5))

def fl_cellar(ctx, n):
    def joint(nx, X, Y, Z, tc):
        f = nx.pnoise(ctx, tc, n, 12, 3)
        return nx.mix(nx.gt(f, 0.55), '#1e1c1a', '#2e3a2c'), None
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'clJoint%d' % n, joint), gz=-0.001)
    rnd = random.Random(31)
    stones = [ctx.noise_mat('clFlag%d' % k, _h(c), _h('#2e2a26'), scale=16, bump=0.35) for k, c in enumerate(['#3e3a36', '#46423c', '#38342f', '#4a453e'])]
    for i in range(n * 2):
        off = 0.25 if i % 2 else 0.0
        for j in range(n * 2 + 1):
            y0 = j * 0.5 + off - 0.5
            a, b = max(y0, 0.0), min(y0 + 0.5, float(n))
            if b - a < 0.02: continue
            mat = stones[(i * 7 + (j % (n * 2)) * 3) % 4]
            ga = 0.025 if a == y0 else 0.0; gb = 0.025 if b == y0 + 0.5 else 0.0
            ctx.box(i * 0.5 + 0.025, a + ga, 0, 0.45, b - a - ga - gb, 0.025 + (((j % (n * 2)) * 7 + i * 3) % 4) * 0.003, mat, bevel=0.008)
    stain = pattern_mat(ctx, 'clStain%d' % n, lambda nx, X, Y, Z, tc: (nx.mix(nx.gt(nx.pnoise(ctx, tc, n, 2, 3), 0.5), '#5a4a20', '#2e3a2c'), None))
    nt = stain.node_tree; nx = NX(nt.nodes, nt.links)
    f = nx.pnoise(ctx, nt.nodes['Texture Coordinate'], n, 2, 3)
    nt.links.new(nx.mul(nx.mx(nx.sub(f, 0.56), 0.0), 3.0), nt.nodes['Principled BSDF'].inputs['Alpha']); _blend(stain)
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.25
    ctx.plane(0, 0, n, n, stain, gz=0.04)

def fl_flags(ctx, n):
    def joint(nx, X, Y, Z, tc):
        f = nx.pnoise(ctx, tc, n, 10, 3)
        return nx.mix(nx.gt(f, 0.5), '#26241f', '#2e4a24'), None
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'fgJoint%d' % n, joint), gz=-0.001)
    rnd = random.Random(41)
    stones = [ctx.noise_mat('fgStone%d' % k, _h(c), _h('#46423c'), scale=12, bump=0.3) for k, c in enumerate(['#57534c', '#615c54', '#4f4b45', '#6a655b'])]
    wet = ctx.mat('fgWet', _h('#4e5258'), 0.12, 0.1)
    for j in range(n * 2):          # rows along y, running bond along x
        off = 0.25 if j % 2 else 0.0
        for i in range(n * 2 + 1):
            x0 = i * 0.5 + off - 0.5
            a, b = max(x0, 0.0), min(x0 + 0.5, float(n))
            if b - a < 0.02: continue
            idx = (j * 5 + (i % (n * 2)) * 3 + (j * i) % 3) % 4
            mat = wet if (j * 3 + (i % (n * 2))) % 11 == 0 else stones[idx]
            ga = 0.02 if a == x0 else 0.0; gb = 0.02 if b == x0 + 0.5 else 0.0
            ctx.box(a + ga, j * 0.5 + 0.02, 0, b - a - ga - gb, 0.46, 0.03 + (((i % (n * 2)) * 13 + j * 7) % 5) * 0.003, mat, bevel=0.01)
    for k in range(5):
        x, y = 0.3 + rnd.random() * 3.4, 0.3 + rnd.random() * 3.4
        ctx.box(x, y, 0.035, 0.05, 0.014, 0.012, M(ctx, '#e8e0d0', 0.8, key='fagend'))
        ctx.box(x + 0.035, y, 0.035, 0.015, 0.014, 0.012, M(ctx, '#c86a2a', 0.8, key='fagtip'))

def fl_lawn(ctx, n):
    def fn(nx, X, Y, Z, tc):
        g = nx.pnoise(ctx, tc, n, 40, 6)
        c = nx.mix(g, '#2a4220', '#4e6e32')
        mud = nx.pnoise(ctx, tc, n, 2.5, 4)
        mm = nx.gt(mud, 0.6)
        c = nx.mix(mm, c, nx.mix(nx.pnoise(ctx, tc, n, 30, 3), '#3a2c20', '#5a4632'))
        return c, nx.lerp(mm, g, 0.3)
    ctx.plane(0, 0, n, n, pattern_mat(ctx, 'lawn%d' % n, fn, rough=0.9, bump=1.0))
    rnd = random.Random(51)
    blades = [ctx.noise_mat('blade%d' % k, _h(c), _h('#2a4220'), scale=50, bump=1) for k, c in enumerate(['#3e5c2a', '#4e6e32'])]
    for k in range(60):   # tufts
        x, y = rnd.random() * n, rnd.random() * n
        if 0.05 < x < n - 0.05 and 0.05 < y < n - 0.05:
            ctx.sphere(x, y, 0.0, 0.04 + rnd.random() * 0.03, rnd.choice(blades), 1, 1, 0.45)
    for k in range(4):
        x, y = 0.3 + rnd.random() * 3.4, 0.3 + rnd.random() * 3.4
        disc(ctx, x, y, 0.01, 0.018, M(ctx, '#c8c0a0', 0.4, 0.7, key='cap'), t=0.006, seg=10)

def fl_stairs(ctx, n):
    """cellar stairs going down along -x: 4 treads per tile with brass nosings and dark risers"""
    tread = ctx.noise_mat('stTread', _h('#5a3420'), _h('#4a2a1a'), scale=40, bump=0.3)
    brass = M(ctx, '#c8a040', 0.3, 0.9, key='stBrass')
    riser = M(ctx, '#1a120c', 0.9, key='stRiser')
    side = M(ctx, '#2a1a10', 0.9, key='stSide')
    ctx.plane(0, 0, n, n, riser, gz=-0.001)
    for i in range(n * 4):
        x = i * 0.25
        ctx.box(x + 0.07, 0, 0, 0.18, n, 0.01, tread)
        ctx.box(x + 0.0, 0, 0, 0.035, n, 0.016, brass, bevel=0.004)
    for j in range(n):
        ctx.box(0, j + 0.0, 0.012, n, 0.07, 0.008, side); ctx.box(0, j + 0.93, 0.012, n, 0.07, 0.008, side)

PIECES = [
    dict(kind='wall', id='pub_extBrick', heights=[3.2], variants=6, build=w_ext_brick, padX=6, padBottom=6),
    dict(kind='wall', id='pub_panel', heights=[3.2], variants=8, build=w_panel, padX=4, padBottom=4),
    dict(kind='wall', id='pub_panel', heights=[2.4], variants=4, build=w_panel, padX=4, padBottom=4),
    dict(kind='wall', id='pub_panelLow', heights=[1.2], variants=3, build=w_panel_low, padX=4, padBottom=4),
    dict(kind='wall', id='pub_bar', heights=[1], variants=6, build=w_bar, padX=10, padBottom=8),
    dict(kind='wall', id='pub_backbar', heights=[3.2], variants=4, build=w_backbar, padX=6, padBottom=6),
    dict(kind='wall', id='pub_gentsWall', heights=[3.2], variants=6, build=w_gents, padX=6, padBottom=4),
    dict(kind='wall', id='pub_partition', heights=[2], variants=4, build=w_partition, padX=2, padBottom=2),
    dict(kind='wall', id='pub_cellarWall', heights=[3.2], variants=5, build=w_cellar, padX=6, padBottom=4),
    dict(kind='wall', id='pub_cellarWall', heights=[2.2], variants=4, build=w_cellar, padX=6, padBottom=4),
    dict(kind='wall', id='pub_gardenWall', heights=[1.1], variants=4, build=w_garden, padX=6, padBottom=4),
    dict(kind='wall', id='pub_fence', heights=[2.4], variants=6, build=w_fence, padX=8, padBottom=6),
    dict(kind='wall', id='crateStack', heights=[1.8], variants=2, build=w_crates),
    dict(kind='floor', id='pub_yard', n=4, build=fl_yard),
    dict(kind='floor', id='pub_boards', n=4, build=fl_boards),
    dict(kind='floor', id='pub_carpet', n=4, build=fl_carpet),
    dict(kind='floor', id='pub_barmat', n=4, build=fl_barmat),
    dict(kind='floor', id='pub_func', n=4, build=fl_func),
    dict(kind='floor', id='pub_dance', n=4, build=fl_dance),
    dict(kind='floor', id='pub_gents', n=4, build=fl_gents),
    dict(kind='floor', id='pub_snug', n=4, build=fl_snug),
    dict(kind='floor', id='pub_cellar', n=4, build=fl_cellar),
    dict(kind='floor', id='pub_flags', n=4, build=fl_flags),
    dict(kind='floor', id='pub_lawn', n=4, build=fl_lawn),
    dict(kind='floor', id='pub_stairs', n=4, build=fl_stairs),
]

# ================================================================== PROPS
def _mats(ctx):
    return dict(
        chrome=M(ctx, '#d0d4dc', 0.12, 1.0, key='chrome'),
        steel=M(ctx, '#9aa0a8', 0.32, 0.9, key='steel'),
        brass=M(ctx, '#d8a838', 0.25, 1.0, key='brass'),
        black=M(ctx, '#141418', 0.45, 0.1, key='blackPl'),
        iron=M(ctx, '#26262c', 0.45, 0.6, key='ironP'),
        porc=M(ctx, '#f2f2ea', 0.12, key='porcelain'),
        rubber=M(ctx, '#0c0c0e', 0.85, key='rubber'),
    )

def fan_disc(ctx, face, a, off, zc, radii, sectors, matfn, mats, name='fan'):
    """flat ring-sector disc on a wall face (face 'y' -> +y face plane at y=1+off; 'x' -> x=1+off), centre a along the face, zc units"""
    bm = bmesh.new()
    def P(r, ang):
        u, v = math.cos(ang) * r, math.sin(ang) * r
        p = fpt(face, a + u, off, zc + v / U)
        return bm.verts.new(ctx.G(*p))
    prev = 0.0
    for ri, r in enumerate(radii):
        for si in range(sectors):
            a0 = 2 * math.pi * (si - 0.5) / sectors; a1 = 2 * math.pi * (si + 0.5) / sectors
            if prev == 0: f = bm.faces.new([P(0, 0), P(r, a0), P(r, a1)])
            else: f = bm.faces.new([P(prev, a0), P(r, a0), P(r, a1), P(prev, a1)])
            f.material_index = matfn(ri, si)
        prev = r
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); ctx.link(ob)
    return ob

# ---- beer garden
def p_picnic(ctx, var):
    dy = var.get('dir', 'x') == 'y'
    wood = grain_mat(ctx, 'picnic', '#7a5a32', '#9a7a48', scale=10, along='y' if dy else 'x', rough=0.8, bump=0.2)
    dark = grain_mat(ctx, 'picnicD', '#5a3e22', '#6e4e2c', scale=10, along='z', rough=0.85)
    L = 2.0
    for lx in (0.28, L - 0.38):
        for (y0, y1) in ((0.12, 0.45), (0.88, 0.55)):   # A-frame legs splayed out to the benches
            beam(ctx, DP(dy, lx + 0.05, y0, 0.0), DP(dy, lx + 0.05, y1, 0.7), 0.035, dark, square=True)
        beam(ctx, DP(dy, lx + 0.05, 0.02, 0.4), DP(dy, lx + 0.05, 0.98, 0.4), 0.03, dark, square=True)   # bench bearer
    beam(ctx, DP(dy, 0.33, 0.5, 0.42), DP(dy, L - 0.33, 0.5, 0.66), 0.025, dark, square=True)          # brace
    for k in range(3):   # table planks
        DB(ctx, dy, 0.04, 0.29 + k * 0.143, 0.68, L - 0.08, 0.135, 0.07, wood, 0.008)
    for yb in (0.03, 0.75):   # bench planks
        for k in range(2): DB(ctx, dy, 0.08, yb + k * 0.115, 0.4, L - 0.16, 0.105, 0.06, wood, 0.006)
    # pints, an ashtray, a crisp packet
    p1 = DP(dy, 0.5, 0.45, 0.75); p2 = DP(dy, 1.3, 0.58, 0.75); at = DP(dy, 1.62, 0.42, 0.75)
    pint(ctx, p1[0], p1[1], 0.75, True); pint(ctx, p2[0], p2[1], 0.75, False)
    lathe(ctx, at[0], at[1], 0.75, [(0.05, 0), (0.06, 0.03), (0.045, 0.03), (0.04, 0.012), (0, 0.012)], M(ctx, '#8a929a', 0.2, 0.0, key='ashGlass'), seg=14)
    cr = DP(dy, 0.95, 0.62, 0.75); DB(ctx, False, cr[0], cr[1], 0.75, 0.09, 0.06, 0.015, M(ctx, '#2a62d8', 0.5, key='crispBag'))
    shadow_blob(ctx, *DP(dy, 1.0, 0.5, 0)[:2], *((0.5, 1.1) if dy else (1.1, 0.5)), a=0.4)

def p_heater(ctx, var):
    k = _mats(ctx)
    shadow_blob(ctx, 0.5, 0.5, 0.32, 0.32, 0.45)
    lathe(ctx, 0.5, 0.5, 0, [(0.24, 0), (0.25, 0.03), (0.23, 0.06), (0.17, 0.08), (0, 0.08)], k['iron'], seg=24)
    hous = M(ctx, '#7a8088', 0.3, 0.8, key='heaterHousing')
    lathe(ctx, 0.5, 0.5, 0.08, [(0.17, 0), (0.17, 0.62), (0.12, 0.7), (0.05, 0.74), (0, 0.74)], hous, seg=20)
    ctx.box(0.52, 0.64, 0.25, 0.12, 0.04, 0.2, M(ctx, '#3a3a40', 0.5, key='heaterDoor'))
    ctx.cyl(0.5, 0.5, 0.8, 0.028, 1.22, k['steel'], 12)
    ctx.cyl(0.5, 0.5, 1.15, 0.045, 0.06, k['chrome'], 12)    # control knob collar
    # burner + emitter mesh cylinder (glows)
    lathe(ctx, 0.5, 0.5, 2.0, [(0.03, 0), (0.08, 0.05), (0.08, 0.06), (0, 0.06)], k['iron'], seg=16)
    glow = ctx.mat('heaterMesh', _h('#5a2008'), 0.6, 0, emit=_h('#ff7a20'), emit_strength=4)
    ctx.cyl(0.5, 0.5, 2.06, 0.075, 0.2, glow, 18)
    for i in range(6):   # mesh rods
        a = i * math.pi / 3
        ctx.cyl(0.5 + math.cos(a) * 0.08, 0.5 + math.sin(a) * 0.08, 2.05, 0.006, 0.22, k['iron'], 6)
    # reflector hood (wide shallow cone)
    hood = M(ctx, '#c8ced8', 0.22, 0.9, key='heaterHood')
    lathe(ctx, 0.5, 0.5, 2.26, [(0.04, 0), (0.4, 0.12), (0.42, 0.14), (0.4, 0.15), (0.05, 0.05), (0, 0.06)], hood, seg=28)
    ctx.cyl(0.5, 0.5, 2.38, 0.03, 0.06, k['steel'], 10)

def p_shelter(ctx, var):
    W, D, zr = 3, 2, 2.3
    green = M(ctx, '#3a5a46', 0.45, 0.5, key='shelterGreen')
    for (x, y) in ((0.05, 0.05), (W - 0.12, 0.05), (0.05, D - 0.12), (W - 0.12, D - 0.12)):
        ctx.box(x, y, 0, 0.07, 0.07, zr + 0.25 - (y + 0.03) * 0.15, green, bevel=0.01)
        ctx.box(x - 0.03, y - 0.03, 0, 0.13, 0.13, 0.03, green)
    for y in (0.05, D - 0.12):   # eaves rails (the translucent roof is drawn by the game)
        ctx.box(0.0, y, zr + 0.18 - y * 0.15, W, 0.07, 0.07, green)
    for x in (0.05, W - 0.12): beam(ctx, (x + 0.035, 0.05, zr + 0.23), (x + 0.035, D - 0.05, zr + 0.25 - D * 0.15 + 0.02), 0.03, green, square=True)
    # back screen (perspex) + slatted bench + ash bin
    ctx.box(0.12, 0.06, 0.5, W - 0.24, 0.03, 1.4, alpha_mat(ctx, 'perspex', '#b8d8c8', 0.25, 0.05))
    slat = grain_mat(ctx, 'shelterSlat', '#5a6a5a', '#4a5a4a', scale=12, along='x', rough=0.6)
    for k in range(3): ctx.box(0.25, 0.1 + k * 0.1, 0.42, W - 0.5, 0.085, 0.04, slat, bevel=0.005)
    for x in (0.35, W - 0.45): ctx.box(x, 0.12, 0, 0.06, 0.24, 0.42, green)
    ash = M(ctx, '#3a4a3a', 0.4, 0.6, key='ashBin')
    ctx.cyl(W - 0.35, D - 0.4, 0, 0.12, 0.72, ash, 16)
    ctx.cyl(W - 0.35, D - 0.4, 0.72, 0.13, 0.05, M(ctx, '#c8c8c0', 0.3, 0.8, key='ashTop'), 16)
    ctx.cyl(W - 0.35, D - 0.4, 0.77, 0.06, 0.01, M(ctx, '#2a2a2a', 0.9, key='ashSand'), 12)
    shadow_blob(ctx, W / 2, D / 2, W * 0.55, D * 0.5, 0.25)
    rnd = random.Random(3)
    for i in range(8):   # fag ends
        ctx.box(0.4 + rnd.random() * 2.2, 0.5 + rnd.random() * 1.3, 0, 0.04, 0.012, 0.012, M(ctx, '#e8e0d0', 0.8, key='fagend'))

def p_post(ctx, var):
    wood = grain_mat(ctx, 'post', '#5a3e22', '#7a5a34', scale=14, along='z', rough=0.8, bump=0.25)
    shadow_blob(ctx, 0.5, 0.5, 0.18, 0.18, 0.4)
    ctx.box(0.43, 0.43, 0, 0.14, 0.14, 2.6, wood, bevel=0.01)
    ctx.box(0.41, 0.41, 2.6, 0.18, 0.18, 0.05, M(ctx, '#3a2a1a', 0.8, key='postCap'), bevel=0.01)
    ctx.box(0.4, 0.4, 0, 0.2, 0.2, 0.25, M(ctx, '#2a2a2e', 0.5, 0.6, key='postShoe'))
    ctx.cyl(0.5, 0.58, 2.45, 0.012, 0.08, M(ctx, '#7a7a80', 0.4, 0.8, key='hook'), 6)

def p_aboard(ctx, var):
    frame = grain_mat(ctx, 'aboard', '#4a3020', '#5e3e28', scale=10, along='z', rough=0.7)
    chalk = ctx.noise_mat('chalkboard', _h('#1e2620'), _h('#2a342c'), scale=30, bump=0.1)
    white = M(ctx, '#e8e8e0', 0.9, key='chalkW'); pink = M(ctx, '#ff8a8a', 0.9, key='chalkP')
    shadow_blob(ctx, 0.5, 0.5, 0.42, 0.3, 0.35)
    def Q(y0, y1): return [(0.15, y0, 0.0), (0.85, y0, 0.0), (0.85, y1, 0.9), (0.15, y1, 0.9)]
    quadbox(ctx, Q(0.3, 0.48), frame, t=0.025)        # back board
    quadbox(ctx, Q(0.72, 0.52), frame, t=0.03)        # front board
    def F(u, z, off=0.0):   # point on the front board surface
        y = 0.72 - 0.2 * (z / 0.9) + off
        return (u, y, z)
    pts = [F(0.2, 0.07, 0.006), F(0.8, 0.07, 0.006), F(0.8, 0.83, 0.006), F(0.2, 0.83, 0.006)]
    quadbox(ctx, pts, chalk, t=0.006)
    rnd = random.Random(5)
    for i in range(5):
        z = 0.7 - i * 0.13
        w = 0.25 + rnd.random() * 0.3
        beam(ctx, F(0.27, z, 0.016), F(0.27 + w, z, 0.016), 0.006, pink if i == 0 else white, square=True)
    hz = F(0.62, 0.32, 0.018); ctx.sphere(hz[0], hz[1], hz[2], 0.03, M(ctx, '#c8102e', 0.8, key='chalkR'))
    beam(ctx, (0.17, 0.45, 0.82), (0.17, 0.55, 0.82), 0.008, M(ctx, '#7a7a80', 0.4, 0.8, key='hinge'))
    beam(ctx, (0.83, 0.45, 0.82), (0.83, 0.55, 0.82), 0.008, M(ctx, '#7a7a80', 0.4, 0.8, key='hinge'))

def anchor_emblem(ctx, x, y0, zc, mat, s=1.0):
    """original simple anchor shape on a +x-facing sign at plane x, centred at (y0, zc)"""
    t = 0.012
    ctx.box(x, y0 - 0.02 * s, zc - 0.28 * s, t, 0.04 * s, 0.56 * s / U * U, mat)            # shank
    ctx.box(x, y0 - 0.12 * s, zc + 0.16 * s, t, 0.24 * s, 0.04 * s, mat)                    # stock
    beam(ctx, (x + t / 2, y0, zc + 0.31 * s), (x + t / 2 + 0.001, y0, zc + 0.31 * s), 0.05 * s, mat)
    for sgn in (-1, 1):   # arms + flukes
        beam(ctx, (x + t / 2, y0, zc - 0.27 * s), (x + t / 2, y0 + sgn * 0.17 * s, zc - 0.12 * s), 0.02 * s, mat, square=True)
        beam(ctx, (x + t / 2, y0 + sgn * 0.17 * s, zc - 0.12 * s), (x + t / 2, y0 + sgn * 0.2 * s, zc - 0.03 * s), 0.028 * s, mat, square=True)

def p_hangsign(ctx, var):
    z = 2.4
    iron = M(ctx, '#2a2a30', 0.4, 0.6, key='ironB')
    gold = M(ctx, '#c8a040', 0.3, 0.8, key='gilt')
    red = ctx.noise_mat('signRed', _h('#8a0c20'), _h('#6a0818'), scale=20, bump=0.2)
    # wall plate + bracket arm with a scroll
    ctx.box(0.42, 1.0, z + 0.35, 0.16, 0.03, 0.4, iron)
    ctx.box(0.47, 1.0, z + 0.55, 0.06, 0.88, 0.05, iron)
    beam(ctx, (0.5, 1.02, z + 0.38), (0.5, 1.45, z + 0.56), 0.012, iron, square=True)
    for yy in (1.12, 1.73):
        ctx.cyl(0.5, yy, z + 0.43, 0.006, 0.12, iron, 6)
    # the sign board (faces +x / -x), gilt frame, red field, white anchor
    ctx.box(0.47, 1.05, z - 0.55, 0.06, 0.75, 1.0, gold, bevel=0.01)
    ctx.box(0.465, 1.1, z - 0.5, 0.07, 0.65, 0.9, red)
    anchor_emblem(ctx, 0.535, 1.425, z - 0.05, M(ctx, '#f4f1e8', 0.5, key='signWhite'), 0.9)
    ctx.box(0.46, 1.03, z + 0.43, 0.08, 0.79, 0.05, gold, bevel=0.01)

# ---- lounge
def p_booth(ctx, var):
    dy = var.get('dir', 'x') == 'y'
    c = var.get('color', '#7a1a22')
    wood = grain_mat(ctx, 'booth', '#3a2010', '#4e2c16', scale=8, along='y' if dy else 'x', rough=0.4)
    vinyl = ctx.mat('vinyl' + c, _h(c), 0.32, 0.0)
    vinylD = ctx.mat('vinylD' + c, tuple(x * 0.72 for x in _h(c)), 0.35, 0.0)
    btn = M(ctx, '#3a080c', 0.4, key='btn')
    DB(ctx, dy, 0.02, 0.05, 0, 0.96, 0.86, 0.3, wood, 0.01)
    DB(ctx, dy, 0.0, 0.88, 0.0, 1.0, 0.04, 0.06, M(ctx, '#22140a', 0.5, key='pnSkirt'))
    DB(ctx, dy, 0.03, 0.2, 0.3, 0.94, 0.68, 0.16, vinyl, 0.04)          # seat cushion
    DB(ctx, dy, 0.02, 0.0, 0.3, 0.96, 0.2, 0.9, wood, 0.01)             # back frame
    for i in range(5):                                                  # fluted (channel) back
        DB(ctx, dy, 0.05 + i * 0.18, 0.12, 0.42, 0.17, 0.1, 0.72, vinylD if i % 2 else vinyl, 0.035)
    for i in range(5):
        for j in range(2):
            p = DP(dy, 0.135 + i * 0.18, 0.225, 0.62 + j * 0.3)
            ctx.sphere(p[0], p[1], p[2], 0.014, btn)
    DB(ctx, dy, 0.0, -0.01, 1.18, 1.0, 0.24, 0.05, wood, 0.012)        # top rail
    DB(ctx, dy, 0.0, 0.18, 1.16, 1.0, 0.04, 0.03, M(ctx, '#c8a040', 0.3, 0.9, key='brassS'))

def p_jukebox(ctx, var):
    k = _mats(ctx)
    shadow_blob(ctx, 0.5, 0.5, 0.5, 0.42, 0.5)
    walnut = grain_mat(ctx, 'juke', '#4a1a10', '#6a2a16', scale=9, along='z', rough=0.25)
    ctx.box(0.12, 0.15, 0, 0.76, 0.7, 1.15, walnut, bevel=0.015)
    for i in range(3): ctx.box(0.16 + i * 0.08, 0.2, 1.15 + i * 0.1, 0.68 - i * 0.16, 0.6, 0.1, walnut, bevel=0.012)
    ctx.box(0.1, 0.13, 0, 0.8, 0.74, 0.06, k['chrome'], bevel=0.01)
    # front (+y): domed record window, chrome grille, programme strip
    win = ctx.mat('jukeWin', _h('#e8c070'), 0.2, 0, emit=_h('#ffe8a0'), emit_strength=2.2)
    ctx.box(0.2, 0.84, 0.75, 0.6, 0.03, 0.35, win)
    lathe(ctx, 0.5, 0.82, 0.86, [(0.13, 0), (0.13, 0.01), (0, 0.01)], M(ctx, '#111114', 0.3, key='vinylRec'), seg=24)   # record lying inside
    ctx.box(0.47, 0.8, 0.865, 0.06, 0.06, 0.012, M(ctx, '#c8102e', 0.5, key='recLabel'))
    ctx.box(0.18, 0.84, 0.72, 0.64, 0.05, 0.03, k['chrome'])
    ctx.box(0.18, 0.84, 1.1, 0.64, 0.05, 0.03, k['chrome'])
    ctx.box(0.2, 0.845, 0.12, 0.6, 0.02, 0.48, M(ctx, '#1a0c08', 0.8, key='grilleCloth'))
    for i in range(7): ctx.box(0.22 + i * 0.09, 0.86, 0.14, 0.022, 0.025, 0.44, k['chrome'], bevel=0.004)
    ctx.box(0.2, 0.845, 0.62, 0.6, 0.03, 0.1, M(ctx, '#f0e8d0', 0.6, emit=_h('#fff4d8'), es=0.6, key='jukeProg'))
    for i in range(5): ctx.box(0.24 + i * 0.12, 0.865, 0.66, 0.05, 0.02, 0.03, M(ctx, '#c8c8d0', 0.3, 0.8, key='jukeBtn'))
    # glass tubes for the neon (the game paints the cycling colours over them)
    tube = ctx.mat('jukeTube', _h('#f0d8f0'), 0.15, 0, emit=_h('#ffd0f0'), emit_strength=1.5)
    for x in (0.14, 0.88): ctx.cyl(x, 0.87, 0.1, 0.022, 1.05, tube, 10)
    pts = [(0.51 - math.cos(math.pi * i / 10) * 0.37, 0.87, 1.15 + math.sin(math.pi * i / 10) * 0.35) for i in range(11)]
    for i in range(10): beam(ctx, pts[i], pts[i + 1], 0.022, tube, seg=8)
    ctx.box(0.12, 0.15, 1.42, 0.76, 0.7, 0.02, k['chrome'])

def p_fruit(ctx, var):
    k = _mats(ctx)
    shadow_blob(ctx, 0.5, 0.5, 0.48, 0.4, 0.5)
    body = M(ctx, '#22225a', 0.35, 0.2, key='fruitBody')
    ctx.box(0.12, 0.15, 0, 0.76, 0.7, 1.45, body, bevel=0.01)
    for (x, y) in ((0.11, 0.84), (0.87, 0.84), (0.87, 0.14)): ctx.box(x, y, 0, 0.03, 0.03, 1.45, k['chrome'])
    top = ctx.mat('fruitTop', _h('#c8102e'), 0.3, 0, emit=_h('#ff3040'), emit_strength=0.5)
    ctx.box(0.1, 0.12, 1.45, 0.8, 0.76, 0.28, top, bevel=0.01)
    ctx.box(0.12, 0.885, 1.5, 0.76, 0.01, 0.18, ctx.mat('fruitTopArt', _h('#ffd23a'), 0.3, 0, emit=_h('#ffc020'), emit_strength=1.2))
    ctx.box(0.885, 0.14, 1.5, 0.01, 0.72, 0.18, ctx.mat('fruitTopArt', _h('#ffd23a'), 0.3, 0, emit=_h('#ffc020'), emit_strength=1.2))
    for i in range(6): ctx.sphere(0.15 + i * 0.13, 0.89, 1.48, 0.022, M(ctx, '#7a5a1a', 0.3, emit=_h('#a07020'), es=1.0, key='bulbOff'))
    # reel window: chrome bezel, three white reels (horizontal drums) with coloured symbol bands
    ctx.box(0.16, 0.85, 0.83, 0.68, 0.02, 0.5, k['chrome'], bevel=0.008)
    ctx.box(0.18, 0.86, 0.85, 0.64, 0.01, 0.46, M(ctx, '#0a0a14', 0.5, key='reelBack'))
    reel = ctx.mat('reel', _h('#f4f4ec'), 0.4, 0, emit=_h('#ffffff'), emit_strength=0.5)
    for i in range(3):
        x0 = 0.21 + i * 0.2
        hcyl(ctx, x0, 0.8, 1.08, x0 + 0.17, 0.8, 1.08, 0.11, reel, 20)
        for j, c in enumerate(('#c8102e', '#ffd23a', '#3a8a2a')):
            ang = -0.6 + j * 0.6
            zz = 1.08 + math.sin(ang) * 0.11 / U
            ctx.box(x0 + 0.04, 0.8 + math.cos(ang) * 0.112 - 0.01, zz - 0.03, 0.09, 0.02, 0.06, M(ctx, c, 0.4, key='sym' + c))
    ctx.box(0.16, 0.86, 1.06, 0.68, 0.03, 0.012, M(ctx, '#ff2020', 0.4, emit=_h('#ff2020'), es=2, key='winline'))
    # side art panels (abstract glowing stripes)
    for i, c in enumerate(('#ff3aa0', '#3ad8ff', '#ffd23a')):
        ctx.box(0.88, 0.25 + i * 0.18, 0.4, 0.01, 0.12, 0.9, ctx.mat('fside' + c, _h(c), 0.4, 0, emit=_h(c), emit_strength=0.9))
    # buttons, coin slot, tray
    for i, c in enumerate(('#ff3a3a', '#ffe14a', '#3aff7a')):
        ctx.box(0.24 + i * 0.2, 0.84, 0.7, 0.12, 0.05, 0.06, ctx.mat('fbtn' + c, _h(c), 0.3, 0, emit=_h(c), emit_strength=1.2), bevel=0.01)
    ctx.box(0.15, 0.84, 0.62, 0.7, 0.08, 0.04, k['chrome'])
    ctx.box(0.25, 0.83, 0.12, 0.5, 0.08, 0.2, k['chrome'], bevel=0.01)
    ctx.box(0.28, 0.9, 0.15, 0.44, 0.02, 0.12, M(ctx, '#202024', 0.4, key='trayIn'))
    ctx.box(0.7, 0.85, 0.5, 0.08, 0.02, 0.06, M(ctx, '#3a3a40', 0.4, 0.8, key='coinSlot'))

def p_pool(ctx, var):
    k = _mats(ctx)
    W, D = 2.0, 1.0
    shadow_blob(ctx, 1.0, 0.5, 1.15, 0.65, 0.5)
    wood = grain_mat(ctx, 'pool', '#3a1a0a', '#5a2a12', scale=7, along='x', rough=0.3)
    for (x, y) in ((0.12, 0.12), (W - 0.28, 0.12), (0.12, D - 0.28), (W - 0.28, D - 0.28)):
        lathe(ctx, x + 0.08, y + 0.08, 0, [(0.08, 0), (0.09, 0.05), (0.06, 0.12), (0.075, 0.2), (0.07, 0.3), (0, 0.3)], wood, seg=12)
    ctx.box(0.04, 0.04, 0.3, W - 0.08, D - 0.08, 0.45, wood, bevel=0.015)
    for i in range(3):   # apron panels
        ctx.box(0.15 + i * 0.6, D - 0.045, 0.38, 0.5, 0.01, 0.3, M(ctx, '#2a1206', 0.4, key='poolPanel'))
    ctx.box(0.0, 0.0, 0.75, W, D, 0.1, wood, bevel=0.02)
    felt = ctx.noise_mat('baize', _h('#1f6a3a'), _h('#1a5c32'), scale=60, bump=0.15, rough=0.95)
    ctx.box(0.1, 0.1, 0.84, W - 0.2, D - 0.2, 0.012, felt)
    cush = M(ctx, '#17502c', 0.9, key='cushion')
    for (x, y, w, d) in ((0.1, 0.1, W - 0.2, 0.04), (0.1, D - 0.14, W - 0.2, 0.04), (0.1, 0.1, 0.04, D - 0.2), (W - 0.14, 0.1, 0.04, D - 0.2)):
        ctx.box(x, y, 0.84, w, d, 0.04, cush)
    for (x, y) in ((0.1, 0.1), (1.0, 0.07), (W - 0.1, 0.1), (0.1, D - 0.1), (1.0, D - 0.07), (W - 0.1, D - 0.1)):
        ctx.cyl(x, y, 0.83, 0.045, 0.04, M(ctx, '#050505', 0.9, key='pocket'), 12)
    for (x, y) in ((0.3, 0.07), (0.6, 0.07), (1.4, 0.07), (1.7, 0.07), (0.3, 0.93), (0.6, 0.93), (1.4, 0.93), (1.7, 0.93)):
        ctx.cyl(x, y, 0.85, 0.01, 0.006, M(ctx, '#e8e0c8', 0.4, key='diamond'), 6)
    balls = [(0.5, 0.5, '#f4f1e8'), (1.35, 0.5, '#c8102e'), (1.43, 0.45, '#f0c020'), (1.43, 0.55, '#c8102e'), (1.51, 0.4, '#f0c020'),
             (1.51, 0.5, '#111111'), (1.51, 0.6, '#c8102e'), (1.0, 0.3, '#f0c020'), (0.8, 0.72, '#c8102e'), (1.75, 0.22, '#f0c020')]
    for (x, y, c) in balls: ctx.sphere(x, y, 0.85 + 0.04 / U, 0.04, M(ctx, c, 0.12, key='ball' + c))
    beam(ctx, (0.15, 0.82, 0.88), (1.42, 0.7, 0.9), 0.012, grain_mat(ctx, 'cue', '#c8a060', '#a88040', scale=20, along='z', rough=0.4))
    beam(ctx, (0.15, 0.82, 0.88), (0.5, 0.79, 0.885), 0.016, M(ctx, '#2a1a10', 0.4, key='cueButt'))

def p_poollamp(ctx, var):
    z = 2.1
    k = _mats(ctx)
    shade = M(ctx, '#1f5a3a', 0.25, 0.3, key='poolShade')
    for x in (0.5, 1.5):
        ctx.cyl(x, 0.5, z + 0.22, 0.006, 3.5 - z - 0.22, k['black'], 6)
        ctx.cyl(x, 0.5, 3.45, 0.04, 0.05, k['brass'], 10)
    ctx.box(0.22, 0.3, z + 0.12, 1.56, 0.4, 0.12, shade, bevel=0.02)
    beam(ctx, (0.24, 0.5, z + 0.2), (1.76, 0.5, z + 0.2), 0.17, shade, seg=16)
    ctx.box(0.22, 0.3, z + 0.1, 1.56, 0.4, 0.03, k['brass'])
    glow = ctx.mat('poolGlow', _h('#fff4c8'), 0.3, 0, emit=_h('#fff0c0'), emit_strength=6)
    ctx.box(0.28, 0.34, z + 0.09, 1.44, 0.32, 0.012, glow)

def p_cuerack(ctx, var):
    k = _mats(ctx)
    board = grain_mat(ctx, 'cueRack', '#5a3418', '#7a4a24', scale=8, along='z', rough=0.35)
    ctx.box(0.15, 0.0, 0.15, 0.7, 0.04, 1.75, board, bevel=0.008)
    ctx.box(0.15, 0.0, 0.25, 0.7, 0.1, 0.06, board, bevel=0.008)
    ctx.box(0.15, 0.0, 1.6, 0.7, 0.08, 0.05, board, bevel=0.008)
    cue = grain_mat(ctx, 'cue', '#c8a060', '#a88040', scale=20, along='z', rough=0.4)
    for i in range(4):
        x = 0.27 + i * 0.15
        beam(ctx, (x, 0.07, 0.12), (x - 0.02, 0.06, 1.85), 0.012, cue if i % 2 == 0 else grain_mat(ctx, 'cue2', '#b08850', '#8a6838', scale=20, along='z', rough=0.4))
        beam(ctx, (x, 0.07, 0.12), (x - 0.005, 0.07, 0.6), 0.016, M(ctx, '#2a1a10', 0.4, key='cueButt'))
        ctx.box(x - 0.03, 0.05, 1.85, 0.02, 0.02, 0.02, M(ctx, '#4a7ae8', 0.6, key='tip'))
    ctx.box(0.45, 0.04, 1.95, 0.06, 0.06, 0.05, M(ctx, '#3a6ae8', 0.8, key='chalkBlue'))
    ctx.box(0.43, 0.0, 1.92, 0.1, 0.08, 0.03, board)

def dartboard_on(ctx, face, a, z):
    """dartboard in a dark cabinet + chalk scoreboard on a visible face"""
    wood = grain_mat(ctx, 'dartCab', '#2a1a10', '#3a2414', scale=8, along='z', rough=0.5)
    face_box(ctx, face, a - 0.32, z - 0.32 / U, 0.64, 0.64 / U, wood, t=0.05, bev=0.01)
    face_box(ctx, face, a - 0.29, z - 0.29 / U, 0.58, 0.58 / U, M(ctx, '#141414', 0.9, key='dartBack'), t=0.02, out=0.05)
    blk, crm, red, grn = (M(ctx, '#141414', 0.85, key='dbBlk'), M(ctx, '#e8dcb8', 0.85, key='dbCrm'),
                          M(ctx, '#c8102e', 0.7, key='dbRed'), M(ctx, '#1f7a3a', 0.7, key='dbGrn'))
    radii = [0.012, 0.03, 0.12, 0.135, 0.205, 0.22, 0.245]
    def mf(ri, si):
        alt = si % 2
        if ri == 0: return 2
        if ri == 1: return 3
        if ri in (3, 5): return 2 if alt else 3
        if ri == 6: return 0
        return 0 if alt else 1
    fan_disc(ctx, face, a, 0.075, z, radii, 20, mf, [blk, crm, red, grn])
    wire = M(ctx, '#c8c8d0', 0.3, 0.9, key='dbWire')
    for (da, dz, c) in ((0.04, 0.05, '#ff3a3a'), (-0.06, 0.02, '#3aff7a'), (0.02, -0.08, '#ffe14a')):
        p0 = fpt(face, a + da, 0.075, z + dz); p1 = fpt(face, a + da + 0.03, 0.2, z + dz + 0.03)
        beam(ctx, p0, p1, 0.004, wire)
        beam(ctx, p1, fpt(face, a + da + 0.04, 0.24, z + dz + 0.04), 0.012, M(ctx, c, 0.6, key='flight' + c), seg=4)
    # chalk scoreboard
    sa = a + 0.38
    face_box(ctx, face, sa, z - 0.32 / U, 0.3, 0.6 / U, wood, t=0.04, bev=0.008)
    face_box(ctx, face, sa + 0.03, z - 0.29 / U, 0.24, 0.54 / U, ctx.noise_mat('chalkboard', _h('#1e2620'), _h('#2a342c'), scale=30, bump=0.1), t=0.01, out=0.04)
    for i in range(4):
        face_box(ctx, face, sa + 0.06, z + 0.18 - i * 0.12, 0.08 + (i * 37 % 10) / 70, 0.02, M(ctx, '#e8e8e0', 0.9, key='chalkW'), t=0.004, out=0.05)

def p_dartboard(ctx, var):
    face = 'x' if var.get('dir', 'x') == 'y' else 'y'
    dartboard_on(ctx, face, 0.4, 1.3)

def p_telly(ctx, var):
    face = 'x' if var.get('dir', 'x') == 'y' else 'y'
    z = 2.2
    k = _mats(ctx)
    # wall bracket + boxy CRT telly
    face_box(ctx, face, 0.42, z - 0.55, 0.16, 0.25, k['iron'], t=0.03)
    beam(ctx, fpt(face, 0.5, 0.02, z - 0.42), fpt(face, 0.5, 0.25, z - 0.42), 0.03, k['iron'], square=True)
    face_box(ctx, face, 0.3, z - 0.4, 0.4, 0.04, k['iron'], t=0.3, out=0.05)
    case = M(ctx, '#2a2a30', 0.45, key='tvCase')
    face_box(ctx, face, 0.26, z - 0.36, 0.48, 0.56, case, t=0.26, out=0.03, bev=0.02)
    face_box(ctx, face, 0.18, z - 0.4, 0.64, 0.66, case, t=0.06, out=0.27, bev=0.015)
    face_box(ctx, face, 0.22, z - 0.33, 0.56, 0.46, ctx.mat('tvScreen', _h('#2e7a32'), 0.2, 0, emit=_h('#3a9a3e'), emit_strength=1.6), t=0.01, out=0.33)
    lines = ctx.mat('tvLines', _h('#e8f0e0'), 0.3, 0, emit=_h('#e8f0e0'), emit_strength=1.5)
    face_box(ctx, face, 0.49, z - 0.33, 0.012, 0.46, lines, t=0.004, out=0.34)
    face_box(ctx, face, 0.22, z - 0.12, 0.56, 0.012, lines, t=0.004, out=0.34)
    face_box(ctx, face, 0.66, z - 0.38, 0.08, 0.04, M(ctx, '#ff3a3a', 0.4, emit=_h('#ff2020'), es=2, key='tvLed'), t=0.005, out=0.33)

def p_stool(ctx, var):
    k = _mats(ctx)
    wood = grain_mat(ctx, 'stool', '#5a3418', '#7a4a24', scale=10, along='z', rough=0.4)
    shadow_blob(ctx, 0.5, 0.5, 0.3, 0.3, 0.4)
    for (x, y) in ((0.26, 0.26), (0.74, 0.26), (0.26, 0.74), (0.74, 0.74)):
        beam(ctx, (x, y, 0.0), (0.5 + (x - 0.5) * 0.55, 0.5 + (y - 0.5) * 0.55, 0.6), 0.022, wood)
    ring_r = 0.19
    for i in range(4):
        a0, a1 = i * math.pi / 2 + math.pi / 4, (i + 1) * math.pi / 2 + math.pi / 4
        beam(ctx, (0.5 + math.cos(a0) * ring_r, 0.5 + math.sin(a0) * ring_r, 0.22), (0.5 + math.cos(a1) * ring_r, 0.5 + math.sin(a1) * ring_r, 0.22), 0.014, k['brass'])
    lathe(ctx, 0.5, 0.5, 0.58, [(0.17, 0), (0.19, 0.03), (0.19, 0.05), (0, 0.05)], wood, seg=20)
    seat = M(ctx, '#8a1a22', 0.35, key='stoolSeat')
    lathe(ctx, 0.5, 0.5, 0.63, [(0.19, 0), (0.2, 0.04), (0.17, 0.09), (0.0, 0.1)], seat, seg=20)

# ---- cellar & yard
def p_keg(ctx, var):
    c = var.get('color', '#c8102e')
    steel = M(ctx, '#a8aeb6', 0.28, 0.95, key='kegSteel')
    shadow_blob(ctx, 0.5, 0.5, 0.3, 0.3, 0.5)
    H = 0.85
    lathe(ctx, 0.5, 0.5, 0, [(0.18, 0), (0.2, 0.02), (0.2, 0.12), (0.205, 0.14), (0.2, 0.16), (0.2, H - 0.16), (0.205, H - 0.14),
                             (0.2, H - 0.12), (0.2, H - 0.04), (0.17, H - 0.01), (0.06, H), (0, H)], steel, seg=28)
    ctx.cyl(0.5, 0.5, H * 0.45, 0.203, 0.09, ctx.mat('kegBand' + c, _h(c), 0.4), 28)
    # chime with handle cut-outs
    lathe(ctx, 0.5, 0.5, H - 0.02, [(0.2, 0), (0.2, 0.14), (0.185, 0.14), (0.185, 0.0)], steel, seg=28)
    for a in (0.6, 0.6 + math.pi):
        ctx.box(0.5 + math.cos(a) * 0.19 - 0.05, 0.5 + math.sin(a) * 0.19 - 0.02, H + 0.04, 0.1, 0.04, 0.06, M(ctx, '#2a2a30', 0.6, key='kegHole'))
    ctx.cyl(0.5, 0.5, H, 0.045, 0.06, M(ctx, '#1a1a1a', 0.5, key='kegSpear'), 12)
    ctx.cyl(0.5, 0.5, H + 0.06, 0.03, 0.02, ctx.mat('kegCap' + c, _h(c), 0.4), 12)

def p_cask(ctx, var):
    c = var.get('color', '#7a4a24')
    shadow_blob(ctx, 0.5, 0.5, 0.32, 0.32, 0.5)
    wood = ctx.mat('caskW' + c, _h(c), 0.75)
    staves = pattern_mat(ctx, 'caskStave' + c, lambda nx, X, Y, Z, tc: (
        nx.mix(nx.lt(nx.fract(nx.mul(nx.m('ARCTAN2', Y, X), 18 / (2 * math.pi))), 0.08), nx.mix(nx.noise(tc.outputs['Object'], 30, 3), c, tuple(min(1, x * 1.25) for x in _h(c))), '#2a1a0c'),
        nx.noise(tc.outputs['Object'], 30, 3)), rough=0.75, bump=0.3)
    H = 0.9
    prof = [(0.2, 0)] + [(0.2 + 0.045 * math.sin(math.pi * i / 8), H * i / 8) for i in range(1, 8)] + [(0.2, H), (0, H)]
    lathe(ctx, 0.5, 0.5, 0, prof, staves, seg=24)
    hoop = M(ctx, '#3a3a40', 0.45, 0.7, key='hoop')
    for zz in (0.05, 0.2, H - 0.26, H - 0.11):
        r = 0.2 + 0.045 * math.sin(math.pi * (zz + 0.03) / H) + 0.006
        ctx.cyl(0.5, 0.5, zz, r, 0.06, hoop, 24)
    ctx.cyl(0.5, 0.5, H - 0.005, 0.185, 0.01, ctx.mat('caskHead' + c, tuple(x * 0.85 for x in _h(c)), 0.8), 24)
    ctx.cyl(0.5, 0.5, H, 0.035, 0.015, M(ctx, '#c8a040', 0.3, 0.9, key='shive'), 10)

def p_empties(ctx, var):
    c = var.get('color', '#c8202a')
    shadow_blob(ctx, 0.5, 0.5, 0.45, 0.45, 0.45)
    pl = ctx.mat('crate' + c, _h(c), 0.45)
    dk = ctx.mat('crateD' + c, tuple(x * 0.45 for x in _h(c)), 0.6)
    ctx.box(0.1, 0.1, 0, 0.8, 0.8, 0.5, pl, bevel=0.015)
    for face in ('x', 'y'):   # slots + handle
        for r in range(2):
            for i in range(4):
                p = fpt(face, 0.16 + i * 0.18, -0.1, 0.1 + r * 0.17)
                if face == 'y': ctx.box(p[0], 0.895, p[2], 0.13, 0.01, 0.1, dk)
                else: ctx.box(0.895, p[1], p[2], 0.01, 0.13, 0.1, dk)
        if face == 'y': ctx.box(0.35, 0.895, 0.4, 0.3, 0.01, 0.06, dk)
        else: ctx.box(0.895, 0.35, 0.4, 0.01, 0.3, 0.06, dk)
    ctx.box(0.13, 0.13, 0.49, 0.74, 0.74, 0.012, dk)
    rnd = random.Random(len(c))
    for i in range(4):
        for j in range(3):
            col = '#2a6a2a' if (i + j * 2) % 3 == 0 else '#6a3410'
            x, y = 0.2 + i * 0.2, 0.25 + j * 0.25
            bottle(ctx, x, y, 0.05, 0.62 + rnd.random() * 0.03, col, r=0.032)
            ctx.cyl(x, y, 0.62 + 0.05, 0.012, 0.012, M(ctx, '#d8c050', 0.3, 0.8, key='btlCap'), 8)

def p_dray(ctx, var):
    c = var.get('color', '#6a1a24')
    k = _mats(ctx)
    paint = ctx.mat('dray' + c, _h(c), 0.25, 0.3)
    gold = M(ctx, '#e8c050', 0.3, 0.8, key='drayGold')
    shadow_blob(ctx, 2.0, 1.0, 2.2, 1.15, 0.5)
    tyre = M(ctx, '#0c0c0e', 0.85, key='tyre2'); hub = M(ctx, '#7a7a82', 0.4, 0.8, key='hub')
    for x in (0.6, 2.0, 3.4):
        for y in (0.08, 1.72):
            hcyl(ctx, x, y, 0.27, x, y + 0.2, 0.27, 0.27, tyre, 18)
            hcyl(ctx, x, y + (0.2 if y > 1 else -0.005), 0.27, x, y + (0.205 if y > 1 else 0.0), 0.27, 0.15, hub, 12)
    ctx.box(0.05, 0.25, 0.25, 3.9, 1.5, 0.2, M(ctx, '#1a1a1e', 0.5, 0.4, key='chassis'))
    # flatbed with drop sides
    ctx.box(0.05, 0.1, 0.45, 2.85, 1.8, 0.08, M(ctx, '#3a3a40', 0.6, 0.5, key='bedFloor'))
    for (y, d) in ((0.08, 0.06), (1.86, 0.06)):
        ctx.box(0.05, y, 0.45, 2.85, d, 0.32, paint, bevel=0.01)
        ctx.box(0.05, y - 0.005, 0.62, 2.85, d + 0.01, 0.03, gold)
    ctx.box(0.03, 0.1, 0.45, 0.06, 1.8, 0.4, paint)
    for x in (0.05, 0.95, 1.9, 2.85): ctx.box(x, 1.85, 0.45, 0.05, 0.08, 0.34, M(ctx, '#2a2a2e', 0.4, 0.7, key='stake'))
    # kegs on the bed (3 x 2)
    steel = M(ctx, '#a8aeb6', 0.28, 0.95, key='kegSteel')
    for i in range(3):
        for j in range(2):
            x, y = 0.45 + i * 0.85, 0.55 + j * 0.85
            lathe(ctx, x, y, 0.53, [(0.18, 0), (0.2, 0.02), (0.2, 0.62), (0.17, 0.66), (0, 0.67)], steel, seg=20)
            ctx.cyl(x, y, 0.8, 0.203, 0.07, ctx.mat('kegBandR', _h('#c8102e'), 0.4), 20)
            ctx.cyl(x, y, 1.2, 0.04, 0.05, M(ctx, '#1a1a1a', 0.5, key='kegSpear'), 10)
    # strap over the kegs
    for i in range(3): ctx.box(0.42 + i * 0.85, 0.1, 1.2, 0.06, 1.8, 0.015, M(ctx, '#e0a020', 0.7, key='strap'))
    # cab
    ctx.box(2.95, 0.1, 0.45, 0.95, 1.8, 1.0, paint, bevel=0.03)
    ctx.box(2.97, 0.12, 1.45, 0.88, 1.76, 0.55, paint, bevel=0.04)
    glass = M(ctx, '#3a5068', 0.05, 0.4, key='cabGlass')
    ctx.box(3.86, 0.18, 1.48, 0.03, 1.64, 0.45, glass)
    ctx.box(3.1, 1.895, 1.5, 0.6, 0.02, 0.42, glass)
    ctx.box(3.1, 0.085, 1.5, 0.6, 0.02, 0.42, glass)
    ctx.box(3.88, 0.4, 0.55, 0.04, 1.2, 0.4, k['chrome'])                    # grille
    for i in range(8): ctx.box(3.91, 0.43 + i * 0.145, 0.57, 0.02, 0.06, 0.36, M(ctx, '#2a2a2e', 0.5, key='grilleS'))
    ctx.box(3.88, 0.08, 0.35, 0.1, 1.84, 0.14, k['black'])                    # bumper
    for y in (0.22, 1.62):
        ctx.box(3.9, y, 0.7, 0.04, 0.16, 0.14, ctx.mat('drayHL', _h('#fff8d0'), 0.2, 0, emit=_h('#fff0c0'), emit_strength=3))
    for y in (0.0, 1.95):
        ctx.box(3.5, y, 1.55, 0.05, 0.05, 0.3, k['black'])
    ctx.box(2.95, 0.1, 1.05, 0.95, 0.012, 0.05, gold); ctx.box(2.95, 1.9, 1.05, 0.95, 0.012, 0.05, gold)
    ctx.box(3.05, 0.5, 2.0, 0.6, 0.8, 0.05, M(ctx, '#e0a020', 0.4, emit=_h('#ffb020'), es=0.6, key='roofMarker'))
    ctx.box(0.05, 1.93, 0.48, 2.85, 0.01, 0.12, M(ctx, '#2a0a0e', 0.6, key='signBand'))

# ---- gents
def p_toilet(ctx, var):
    k = _mats(ctx)
    shadow_blob(ctx, 0.5, 0.5, 0.35, 0.3, 0.4)
    ctx.box(0.72, 0.28, 0.35, 0.22, 0.44, 0.6, k['porc'], bevel=0.025)                  # cistern
    ctx.box(0.7, 0.26, 0.95, 0.26, 0.48, 0.04, k['porc'], bevel=0.01)
    ctx.box(0.7, 0.62, 0.85, 0.04, 0.06, 0.02, k['chrome'])                              # flush lever
    lathe(ctx, 0.48, 0.5, 0, [(0.1, 0), (0.12, 0.05), (0.1, 0.2), (0.16, 0.36), (0.19, 0.42), (0, 0.42)], k['porc'], seg=20)
    ctx.cyl(0.48, 0.5, 0.42, 0.17, 0.005, M(ctx, '#6a8a9a', 0.05, key='bowlWater'), 20)
    lathe(ctx, 0.47, 0.5, 0.43, [(0.19, 0), (0.2, 0.03), (0.13, 0.04), (0.12, 0.0)], M(ctx, '#1a1a1a', 0.4, key='seat'), seg=20)
    ctx.box(0.6, 0.45, 0.42, 0.12, 0.1, 0.1, k['porc'])

def p_urinal(ctx, var):
    k = _mats(ctx)
    ctx.box(0.28, 0.0, 0.35, 0.44, 0.3, 0.9, k['porc'], bevel=0.06)
    ctx.box(0.33, 0.12, 0.42, 0.34, 0.2, 0.7, M(ctx, '#a8b0b0', 0.2, key='urinalIn'), bevel=0.04)
    ctx.box(0.42, 0.18, 0.43, 0.16, 0.08, 0.04, M(ctx, '#ffe14a', 0.6, key='cake'), bevel=0.01)
    ctx.cyl(0.5, 0.05, 1.25, 0.018, 0.95, k['chrome'], 10)
    ctx.cyl(0.5, 0.05, 1.25, 0.03, 0.05, k['chrome'], 10)
    ctx.box(0.47, 0.0, 0.2, 0.06, 0.08, 0.16, k['chrome'])

def p_sink(ctx, var):
    k = _mats(ctx)
    # mirror on the -x wall, with a crack
    ctx.box(0.0, 0.18, 1.22, 0.035, 0.64, 0.92, M(ctx, '#5a6a72', 0.4, 0.6, key='mirFrame'), bevel=0.008)
    ctx.box(0.03, 0.22, 1.27, 0.012, 0.56, 0.82, M(ctx, '#9ab8c8', 0.04, 0.9, key='mirGlass'))
    beam(ctx, (0.045, 0.3, 1.9), (0.045, 0.45, 1.65), 0.004, M(ctx, '#e8f4f8', 0.3, emit=_h('#ffffff'), es=0.5, key='crackW'), square=True)
    beam(ctx, (0.045, 0.45, 1.65), (0.045, 0.6, 1.4), 0.004, M(ctx, '#e8f4f8', 0.3, emit=_h('#ffffff'), es=0.5, key='crackW'), square=True)
    lathe(ctx, 0.3, 0.5, 0, [(0.07, 0), (0.06, 0.4), (0.08, 0.74), (0, 0.74)], k['porc'], seg=14)
    ctx.box(0.04, 0.2, 0.74, 0.55, 0.6, 0.15, k['porc'], bevel=0.03)
    ctx.box(0.12, 0.28, 0.87, 0.4, 0.44, 0.03, M(ctx, '#8aa0aa', 0.1, key='basin'), bevel=0.02)
    for y in (0.38, 0.62):
        ctx.cyl(0.1, y, 0.89, 0.02, 0.1, k['chrome'], 10)
        beam(ctx, (0.1, y, 0.99), (0.17, y, 0.97), 0.01, k['chrome'])
    ctx.box(0.06, 0.66, 0.89, 0.1, 0.06, 0.03, M(ctx, '#e8e0a0', 0.5, key='soap'), bevel=0.01)

def p_cubdoor(ctx, var):
    lam = grain_mat(ctx, 'ptLam', '#5e4230', '#6e4e36', scale=3, along='z', rough=0.35, bump=0.02, dist=2)
    k = _mats(ctx)
    pts = [(0.0, 0.05, 0.15), (0.55, 0.75, 0.15), (0.55, 0.75, 1.85), (0.0, 0.05, 1.85)]
    quadbox(ctx, pts, lam, t=0.03)
    for zz in (0.35, 1.6): ctx.box(0.0, 0.03, zz, 0.04, 0.04, 0.12, M(ctx, '#b8b8c0', 0.3, 0.9, key='alu'))
    ctx.sphere(0.46, 0.66, 1.0, 0.02, k['chrome'])
    ctx.box(0.22, 0.38, 1.0, 0.05, 0.05, 0.04, M(ctx, '#3aa03a', 0.4, emit=_h('#3aa03a'), es=0.6, key='vacant'))

def p_armchair(ctx, var):
    def chintz(nx, X, Y, Z, tc):
        co = tc.outputs['Object']
        v = nx.N.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 14; nx.L.new(co, v.inputs['Vector'])
        d = v.outputs['Distance']
        c = nx.mix(nx.lt(d, 0.28), '#8a5a3a', '#d8a0a0')
        c = nx.mix(nx.lt(d, 0.12), c, '#b0505a')
        c = nx.mix(nx.mul(nx.gt(d, 0.42), nx.gt(nx.noise(co, 20), 0.55)), c, '#4a6a3a')
        return c, d
    fab = pattern_mat(ctx, 'chintz', chintz, rough=0.9, bump=0.2)
    shadow_blob(ctx, 0.5, 0.5, 0.45, 0.45, 0.45)
    wood = M(ctx, '#3a2010', 0.4, key='chairFoot')
    for (x, y) in ((0.15, 0.15), (0.8, 0.15), (0.15, 0.8), (0.8, 0.8)): ctx.box(x, y, 0, 0.05, 0.05, 0.1, wood)
    ctx.box(0.12, 0.12, 0.1, 0.76, 0.76, 0.32, fab, bevel=0.04)
    ctx.box(0.14, 0.3, 0.4, 0.5, 0.4, 0.12, fab, bevel=0.05)                          # seat cushion
    ctx.box(0.62, 0.12, 0.38, 0.26, 0.76, 0.85, fab, bevel=0.06)                     # back (against +x)
    for y in (0.12, 0.7): ctx.box(0.12, y, 0.38, 0.55, 0.18, 0.34, fab, bevel=0.06)   # arms
    ctx.box(0.6, 0.32, 0.95, 0.02, 0.36, 0.3, M(ctx, '#f4f1e8', 0.8, key='doily'))    # antimacassar
    ctx.box(0.2, 0.62, 0.72, 0.18, 0.12, 0.04, M(ctx, '#2a62d8', 0.5, key='crispBag'))

# ---- function room
def p_stage(ctx, var):
    W, D = 4, 8
    plank = grain_mat(ctx, 'stagePlank', '#4a2e18', '#5e3a20', scale=10, along='y', rough=0.5)
    ctx.box(0, 0, 0, W, D, 0.3, M(ctx, '#141418', 0.85, key='stageSkirt'))
    for i in range(W * 4):
        ctx.box(i / 4 + 0.004, 0, 0.3, 0.242, D, 0.01, plank)
    # pleated black skirt on the visible faces
    sk = M(ctx, '#0c0c10', 0.9, key='skirtPleat')
    for i in range(D * 6): ctx.box(W, i / 6, 0.0, 0.025, 1 / 12, 0.29, sk)
    for i in range(W * 6): ctx.box(i / 6, D, 0.0, 1 / 12, 0.025, 0.29, sk)
    ctx.box(W - 0.06, 0, 0.29, 0.08, D, 0.025, M(ctx, '#c8a040', 0.4, 0.6, key='stageEdge'))
    tape = M(ctx, '#d8d0b0', 0.7, key='tape')
    beam(ctx, (2.2, 3.6, 0.32), (2.6, 4.0, 0.32), 0.012, tape, square=True)
    beam(ctx, (2.6, 3.6, 0.32), (2.2, 4.0, 0.32), 0.012, tape, square=True)
    for i in range(D * 2):   # footlight housings (the game paints the lit colours)
        ctx.box(W + 0.01, 0.2 + i * 0.5, 0.08, 0.04, 0.1, 0.12, M(ctx, '#2a2a30', 0.4, 0.5, key='footHouse'))
    rnd = random.Random(2)
    for i in range(6):   # cables + gaffer tape
        y = 0.5 + rnd.random() * 7
        beam(ctx, (0.3, y, 0.31), (0.3 + 1.5 + rnd.random(), y + (rnd.random() - 0.5) * 0.6, 0.31), 0.008, M(ctx, '#0a0a0a', 0.5, key='cable'))

def p_speaker(ctx, var):
    z = 0.3
    k = _mats(ctx)
    cab = ctx.noise_mat('speakerCab', _h('#1a1a1e'), _h('#24242a'), scale=60, bump=0.3)
    ctx.box(0.12, 0.12, z, 0.76, 0.76, 0.85, cab, bevel=0.01)
    ctx.box(0.16, 0.16, z + 0.85, 0.68, 0.68, 0.7, cab, bevel=0.01)
    for (x, y, zz) in ((0.12, 0.12, z), (0.86, 0.86, z), (0.86, 0.12, z), (0.12, 0.86, z), (0.16, 0.82, z + 0.85), (0.82, 0.82, z + 0.85), (0.82, 0.16, z + 0.85)):
        ctx.box(x - 0.01, y - 0.01, zz, 0.04, 0.04, 0.05, k['chrome'])
    cone = M(ctx, '#2a2a30', 0.6, key='spkCone'); dust = M(ctx, '#0a0a0c', 0.7, key='spkDust')
    for face in ('y', 'x'):
        p = fpt(face, 0.5, -0.11, z + 0.42)
        ax = (0, 1, 0) if face == 'y' else (1, 0, 0)
        for (r, off, m) in ((0.3, 0.0, k['black']), (0.27, 0.005, cone), (0.08, 0.02, dust)):
            beam(ctx, (p[0] + ax[0] * (0.11 + off), p[1] + ax[1] * (0.11 + off), p[2]), (p[0] + ax[0] * (0.115 + off), p[1] + ax[1] * (0.115 + off), p[2]), r, m, seg=24)
        h0 = fpt(face, 0.5, -0.16, z + 1.2)
        face_box(ctx, face, 0.3, z + 1.06, 0.4, 0.28, k['black'], t=0.03, out=-0.16)
        face_box(ctx, face, 0.36, z + 1.12, 0.28, 0.16, M(ctx, '#3a3a42', 0.4, 0.5, key='horn'), t=0.02, out=-0.14)
    ctx.box(0.4, 0.4, z + 1.55, 0.2, 0.2, 0.02, k['iron'])

def p_decks(ctx, var):
    z = 0.3
    k = _mats(ctx)
    case = M(ctx, '#1a1a1e', 0.4, key='flightCase')
    ctx.box(0.1, 0.1, z, 0.8, 1.8, 0.62, case, bevel=0.01)
    for (x, y) in ((0.1, 0.1), (0.86, 0.1), (0.1, 1.86), (0.86, 1.86)): ctx.box(x - 0.01, y - 0.01, z, 0.06, 0.06, 0.64, k['chrome'])
    ctx.box(0.08, 0.08, z + 0.6, 0.84, 1.84, 0.03, k['chrome'])
    zt = z + 0.63
    for y in (0.5, 1.5):
        ctx.box(0.17, y - 0.33, zt, 0.66, 0.6, 0.06, M(ctx, '#b8bcc4', 0.3, 0.8, key='deckPlinth'), bevel=0.01)
        ctx.cyl(0.5, y - 0.05, zt + 0.06, 0.22, 0.02, M(ctx, '#2a2a30', 0.4, 0.6, key='platter'), 32)
        ctx.cyl(0.5, y - 0.05, zt + 0.08, 0.2, 0.006, M(ctx, '#0a0a0a', 0.15, key='vinylRec2'), 32)
        ctx.cyl(0.5, y - 0.05, zt + 0.086, 0.06, 0.003, M(ctx, '#c8102e', 0.5, key='recLabel'), 16)
        beam(ctx, (0.75, y + 0.2, zt + 0.12), (0.62, y - 0.02, zt + 0.11), 0.008, k['chrome'])
        ctx.cyl(0.75, y + 0.2, zt + 0.06, 0.03, 0.06, k['chrome'], 10)
    ctx.box(0.25, 0.86, zt, 0.5, 0.28, 0.05, M(ctx, '#2a2a30', 0.4, 0.5, key='mixer'))
    for i in range(3): ctx.box(0.33 + i * 0.12, 0.92, zt + 0.05, 0.03, 0.12, 0.015, M(ctx, '#c8c8d0', 0.3, 0.9, key='fader'))

def p_mic(ctx, var):
    z = 0.3
    k = _mats(ctx)
    for i in range(3):
        a = i * 2 * math.pi / 3 + 0.4
        beam(ctx, (0.5, 0.5, z + 0.35), (0.5 + math.cos(a) * 0.22, 0.5 + math.sin(a) * 0.22, z), 0.008, k['black'])
    ctx.cyl(0.5, 0.5, z + 0.2, 0.012, 1.2, k['black'], 8)
    ctx.cyl(0.5, 0.5, z + 1.0, 0.02, 0.05, k['chrome'], 8)
    beam(ctx, (0.5, 0.5, z + 1.4), (0.72, 0.62, z + 1.58), 0.008, k['black'])
    beam(ctx, (0.72, 0.62, z + 1.58), (0.79, 0.66, z + 1.62), 0.018, k['black'])
    ctx.sphere(0.81, 0.67, z + 1.63, 0.03, M(ctx, '#9a9aa2', 0.4, 0.8, key='micHead'))

def p_disco(ctx, var):
    z = 3.0
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.17)
    rnd = random.Random(1)
    mats = [M(ctx, c, r, 1.0, key='mball%d' % i) for i, (c, r) in enumerate((('#c8d0e0', 0.05), ('#8a90a0', 0.15), ('#5a5e6a', 0.1), ('#ffffff', 0.02)))]
    for f in bm.faces: f.material_index = rnd.choice([0, 0, 1, 1, 2, 3])
    me = bpy.data.meshes.new('ball'); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new('ball', me); ctx.link(ob); ob.location = ctx.G(0.5, 0.5, z)
    ctx.cyl(0.5, 0.5, z + 0.15, 0.004, 1.2, M(ctx, '#5a5a62', 0.4, 0.8, key='chain'), 6)
    ctx.cyl(0.5, 0.5, z + 0.15, 0.03, 0.04, M(ctx, '#2a2a30', 0.4, 0.8, key='motor'), 10)

def p_buffet(ctx, var):
    k = _mats(ctx)
    shadow_blob(ctx, 1.0, 0.5, 1.1, 0.55, 0.45)
    cloth = ctx.noise_mat('tablecloth', _h('#f4f4ec'), _h('#e4e4dc'), scale=20, bump=0.1)
    ctx.box(0.05, 0.1, 0.72, 1.9, 0.8, 0.06, cloth, bevel=0.01)
    for i in range(16):   # draped skirt folds on the visible sides
        ctx.box(0.05 + i * 0.119, 0.88 + (i % 2) * 0.012, 0.02, 0.119, 0.03, 0.74, cloth)
    for i in range(7): ctx.box(1.93 + (i % 2) * 0.012, 0.1 + i * 0.114, 0.02, 0.03, 0.114, 0.74, cloth)
    for i in range(10):
        ctx.sphere(0.11 + i * 0.19, 0.92, 0.72, 0.04, cloth, 1, 0.5, 0.6)
    plate = M(ctx, '#e8e8f0', 0.2, key='plate')
    def platter(x, y): ctx.cyl(x, y, 0.78, 0.13, 0.015, plate, 20)
    platter(0.3, 0.45)
    for (dx, dy) in ((-0.05, -0.04), (0.05, -0.02), (0.0, 0.05), (-0.06, 0.04)): ctx.sphere(0.3 + dx, 0.45 + dy, 0.81, 0.04, M(ctx, '#e8c070', 0.6, key='roll'), 1, 1, 0.7)
    platter(0.75, 0.42)
    for i in range(5): beam(ctx, (0.66 + i * 0.04, 0.36, 0.8), (0.69 + i * 0.04, 0.48, 0.8), 0.022, M(ctx, '#f0e0b0', 0.7, key='sarnie'), square=True)
    lathe(ctx, 1.18, 0.5, 0.78, [(0.08, 0), (0.12, 0.08), (0.11, 0.08), (0.07, 0.01), (0, 0.01)], M(ctx, '#c8c8d0', 0.15, 0.9, key='bowl'), seg=16)
    for i in range(6): ctx.sphere(1.18 + (i % 3 - 1) * 0.04, 0.5 + (i // 3 - 0.5) * 0.05, 0.85, 0.03, M(ctx, '#e8b040', 0.5, key='crisps'), 1, 1, 0.4)
    platter(1.62, 0.45)   # silver-wedding cake
    lathe(ctx, 1.62, 0.45, 0.8, [(0.1, 0), (0.1, 0.16), (0.06, 0.16), (0.06, 0.28), (0, 0.28)], M(ctx, '#f4f1e8', 0.6, key='icing'), seg=20)
    ctx.cyl(1.62, 0.45, 0.94, 0.101, 0.02, M(ctx, '#c8c8d0', 0.3, 0.9, key='silverRibbon'), 20)
    ctx.cyl(1.62, 0.45, 1.08, 0.006, 0.08, M(ctx, '#ffe14a', 0.4, emit=_h('#ffd040'), es=1, key='candle'), 6)
    for i in range(4): ctx.cyl(0.2 + i * 0.05, 0.75, 0.78, 0.07, 0.01 + i * 0.006, M(ctx, '#f0f0f8', 0.4, key='paperPlate'), 14)

# ---- doors, hatch, boarded doorway
def p_door(ctx, var):
    dy = var.get('dir', 'x') == 'y'
    c = var.get('color', '#4a2412')
    wood = grain_mat(ctx, 'door' + c, c, tuple(min(1, x * 1.35) for x in _h(c)), scale=8, along='z', rough=0.35)
    frost = ctx.mat('frostGlass', _h('#e8c070'), 0.35, 0, emit=_h('#ffd890'), emit_strength=1.8)
    brass = M(ctx, '#d8a838', 0.25, 1.0, key='brass')
    DB(ctx, dy, 0, 0.42, 0, 1, 0.16, 2.6, wood, 0.01)
    for side in (0.4, 0.6):   # both faces get the same treatment
        o = 0.58 if side > 0.5 else 0.4
        s = 1 if side > 0.5 else -1
        def fb(a, z, w, h, m, t=0.02, off=0.0):
            yy = o + (off if s > 0 else -off - t)
            DB(ctx, dy, a, yy, z, w, t, h, m)
        fb(0.15, 1.42, 0.7, 0.96, wood, 0.02)
        fb(0.2, 1.47, 0.6, 0.86, frost, 0.01, 0.012)
        for i in range(3): fb(0.24 + i * 0.2, 1.52, 0.012, 0.76, M(ctx, '#fff4d8', 0.3, emit=_h('#fff4d8'), es=2.4, key='etchLine'), 0.004, 0.02)
        fb(0.18, 0.35, 0.3, 0.85, wood, 0.03); fb(0.52, 0.35, 0.3, 0.85, wood, 0.03)
        fb(0.05, 0.02, 0.9, 0.2, brass, 0.008)
        fb(0.82, 1.18, 0.05, 0.2, brass, 0.03)
    DB(ctx, dy, -0.02, 0.38, 2.6, 1.04, 0.24, 0.1, M(ctx, '#2a140a', 0.5, key='doorHead'))

def p_hatch(ctx, var):
    wood = grain_mat(ctx, 'hatch', '#4a301a', '#5e3e22', scale=12, along='z', rough=0.8, bump=0.25)
    iron = M(ctx, '#2a2a30', 0.5, 0.6, key='strapIron')
    ctx.box(0, 0.4, 0, 2, 0.2, 2.5, M(ctx, '#2a1a0c', 0.9, key='hatchBack'))
    for i in range(10): ctx.box(i * 0.2 + 0.006, 0.55, 0.02, 0.188, 0.06, 2.42, wood, bevel=0.006)
    for z in (0.4, 1.25, 2.1):
        ctx.box(0.05, 0.6, z, 0.85, 0.02, 0.1, iron); ctx.box(1.1, 0.6, z, 0.85, 0.02, 0.1, iron)
        for x in (0.1, 0.5, 0.85, 1.15, 1.5, 1.9): ctx.sphere(x, 0.625, z + 0.05, 0.012, iron)
    ctx.box(0.99, 0.6, 0.02, 0.02, 0.02, 2.42, M(ctx, '#140a04', 0.9, key='hatchGap'))
    ctx.box(0.92, 0.6, 1.17, 0.16, 0.03, 0.16, iron)
    ctx.box(0.96, 0.62, 1.05, 0.08, 0.04, 0.12, M(ctx, '#c8a040', 0.3, 0.9, key='padlock'), bevel=0.01)
    ctx.box(-0.05, 0.38, 2.5, 2.1, 0.26, 0.12, M(ctx, '#3a2a1a', 0.7, key='lintel'))

def p_boarded(ctx, var):
    rnd = random.Random(6)
    ctx.box(0, 0.15, 0, 1, 0.7, 2.2, M(ctx, '#0c0806', 0.95, key='voidDark'))
    ctx.box(0, 0.15, 2.2, 1, 0.75, 0.03, ctx.noise_mat('pxStone', _h('#c8b89a'), _h('#a89878'), scale=22, bump=0.25))
    planks = [grain_mat(ctx, 'board%d' % i, c1, c2, scale=12, along='x', rough=0.85, bump=0.2) for i, (c1, c2) in enumerate((('#8a6a3a', '#a8885a'), ('#7a5a30', '#94744a'), ('#6a4a26', '#82623a')))]
    nail = M(ctx, '#9a9aa2', 0.4, 0.8, key='nail2')
    for i, (z, a, b) in enumerate(((0.25, 0.1, 0.08), (0.7, -0.08, 0.1), (1.15, 0.05, -0.05), (1.6, -0.1, 0.06), (1.95, 0.05, 0.02))):
        beam(ctx, (-0.05, 0.9, z + a), (1.05, 0.9, z + b), 0.07, rnd.choice(planks), square=True)
        for x, zz in ((0.05, z + a), (0.95, z + b)): ctx.sphere(x, 0.97, zz, 0.012, nail)
    beam(ctx, (0.1, 0.96, 0.1), (0.9, 0.96, 2.05), 0.06, planks[2], square=True)

# ---- the public bar
def p_bell(ctx, var):
    z = 2.2
    brass = M(ctx, '#d8a838', 0.22, 1.0, key='bellBrass')
    wood = grain_mat(ctx, 'bellBoard', '#3a2414', '#5a3420', scale=8, along='x', rough=0.4)
    face_box(ctx, 'y', 0.28, z + 0.32, 0.44, 0.12, wood, t=0.04, bev=0.008)
    beam(ctx, (0.5, 1.02, z + 0.38), (0.5, 1.2, z + 0.38), 0.015, brass, square=True)
    lathe(ctx, 0.5, 1.2, z - 0.12, [(0.13, 0), (0.12, 0.02), (0.1, 0.08), (0.075, 0.25), (0.06, 0.32), (0.02, 0.34), (0, 0.34)], brass, seg=24)
    ctx.sphere(0.5, 1.2, z + 0.27, 0.025, brass)
    beam(ctx, (0.5, 1.2, z - 0.1), (0.53, 1.24, z - 0.55), 0.012, M(ctx, '#e8e0c0', 0.9, key='rope'))
    ctx.sphere(0.53, 1.24, z - 0.58, 0.025, M(ctx, '#e8e0c0', 0.9, key='rope'))

def p_pumps(ctx, var):
    z = 1.0
    k = _mats(ctx)
    cer = M(ctx, '#e8e0d0', 0.2, key='pumpCeramic')
    ctx.box(0.08, 0.3, z, 0.84, 0.4, 0.015, M(ctx, '#c8a040', 0.25, 0.9, key='tray'))
    for i in range(3):
        x = 0.22 + i * 0.27
        ctx.cyl(x, 0.5, z, 0.05, 0.12, k['brass'], 14)
        ctx.cyl(x, 0.5, z + 0.12, 0.035, 0.05, k['chrome'], 12)
        beam(ctx, (x, 0.5, z + 0.18), (x + 0.07, 0.48, z + 0.9), 0.022, cer, seg=12)
        beam(ctx, (x + 0.07, 0.48, z + 0.9), (x + 0.08, 0.478, z + 1.0), 0.028, k['brass'], seg=12)
        beam(ctx, (x + 0.01, 0.5, z + 0.25), (x + 0.025, 0.498, z + 0.33), 0.026, k['brass'], seg=12)
        beam(ctx, (x, 0.58, z + 0.1), (x, 0.66, z + 0.06), 0.012, k['chrome'])   # swan-neck spout
    # lager font (T-bar) at the back
    ctx.cyl(0.5, 0.15, z, 0.04, 0.55, k['chrome'], 12)
    ctx.box(0.28, 0.1, z + 0.55, 0.44, 0.1, 0.14, M(ctx, '#d8dce4', 0.25, 0.9, key='fontFrost'), bevel=0.02)
    for x in (0.34, 0.66):
        ctx.cyl(x, 0.2, z + 0.45, 0.012, 0.12, k['chrome'], 8)
        ctx.box(x - 0.012, 0.18, z + 0.55, 0.024, 0.04, 0.16, k['black'])

def p_till(ctx, var):
    z = 1.0
    k = _mats(ctx)
    body = M(ctx, '#2a2a30', 0.35, 0.4, key='tillBody')
    ctx.box(0.22, 0.18, z, 0.56, 0.6, 0.12, body, bevel=0.01)                  # drawer
    ctx.box(0.45, 0.76, z + 0.05, 0.1, 0.03, 0.03, k['chrome'])
    beam(ctx, (0.25, 0.25, z + 0.12), (0.25, 0.7, z + 0.3), 0.001, body)
    quadbox(ctx, [(0.26, 0.74, z + 0.14), (0.74, 0.74, z + 0.14), (0.74, 0.32, z + 0.38), (0.26, 0.32, z + 0.38)], body, t=0.12)
    for r in range(3):
        for c in range(4):
            yy = 0.66 - r * 0.1; zz = z + 0.21 + r * 0.058
            ctx.box(0.32 + c * 0.1, yy - 0.025, zz, 0.06, 0.05, 0.03, M(ctx, '#e8e4d8' if c < 3 else '#c8102e', 0.4, key='tillKey%d' % (c == 3)), bevel=0.005)
    ctx.box(0.3, 0.26, z + 0.3, 0.3, 0.2, 0.2, body, bevel=0.01)
    ctx.box(0.33, 0.45, z + 0.38, 0.24, 0.02, 0.08, M(ctx, '#0a1a0a', 0.4, key='tillDisp'))
    ctx.box(0.68, 0.3, z + 0.3, 0.06, 0.06, 0.18, k['chrome'])                    # handle
    ctx.sphere(0.71, 0.33, z + 0.5, 0.03, M(ctx, '#e8e4d8', 0.3, key='knob'))

def p_pendant(ctx, var):
    z = 2.5
    k = _mats(ctx)
    ctx.cyl(0.5, 0.5, z + 0.25, 0.005, 3.6 - z - 0.25, k['black'], 6)
    ctx.cyl(0.5, 0.5, 3.55, 0.05, 0.05, k['brass'], 12)
    ctx.cyl(0.5, 0.5, z + 0.2, 0.025, 0.07, k['brass'], 10)
    glass = ctx.mat('pendGlass', _h('#c87a20'), 0.25, 0, emit=_h('#e88a28'), emit_strength=2.2)
    lathe(ctx, 0.5, 0.5, z, [(0.17, 0), (0.165, 0.03), (0.12, 0.12), (0.05, 0.2), (0.025, 0.22), (0, 0.22)], glass, seg=24)
    ctx.cyl(0.5, 0.5, z - 0.005, 0.14, 0.006, ctx.mat('pendBulb', _h('#fff0c0'), 0.3, 0, emit=_h('#fff0c0'), emit_strength=6), 20)

PIECES += [
    dict(kind='prop', id='pub_picnic', size=(2, 2, 1.0), build=p_picnic, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='pub_heater', size=(1, 1, 2.5), build=p_heater, pad=14),
    dict(kind='prop', id='pub_shelter', size=(3, 2, 2.7), build=p_shelter),
    dict(kind='prop', id='pub_post', size=(1, 1, 2.8), build=p_post),
    dict(kind='prop', id='pub_aboard', size=(1, 1, 1.0), build=p_aboard),
    dict(kind='prop', id='pub_hangsign', size=(1, 2, 3.1), build=p_hangsign),
    dict(kind='prop', id='pub_booth', size=(1, 1, 1.3), build=p_booth, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='pub_jukebox', size=(1, 1, 1.6), build=p_jukebox),
    dict(kind='prop', id='pub_fruit', size=(1, 1, 1.8), build=p_fruit),
    dict(kind='prop', id='pub_pool', size=(2, 1, 1.0), build=p_pool),
    dict(kind='prop', id='pub_poollamp', size=(2, 1, 3.6), build=p_poollamp),
    dict(kind='prop', id='pub_cuerack', size=(1, 1, 2.1), build=p_cuerack),
    dict(kind='prop', id='pub_dartboard', size=(1, 1.3, 1.8), build=p_dartboard, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='pub_telly', size=(1.4, 1.4, 2.6), build=p_telly, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='pub_stool', size=(1, 1, 0.8), build=p_stool),
    dict(kind='prop', id='pub_keg', size=(1, 1, 1.0), build=p_keg, variants=[{}, {'color': '#1f4fb4'}, {'color': '#2a6a3a'}, {'color': '#c8a020'}]),
    dict(kind='prop', id='pub_cask', size=(1, 1, 1.0), build=p_cask, variants=[{}, {'color': '#5a3a1c'}]),
    dict(kind='prop', id='pub_empties', size=(1, 1, 0.8), build=p_empties, variants=[{}, {'color': '#e0b020'}, {'color': '#2a6a3a'}]),
    dict(kind='prop', id='pub_dray', size=(4, 2, 2.1), build=p_dray),
    dict(kind='prop', id='pub_toilet', size=(1, 1, 1.1), build=p_toilet),
    dict(kind='prop', id='pub_urinal', size=(1, 1, 2.3), build=p_urinal),
    dict(kind='prop', id='pub_sink', size=(1, 1, 2.2), build=p_sink),
    dict(kind='prop', id='pub_cubdoor', size=(1, 1, 1.9), build=p_cubdoor),
    dict(kind='prop', id='pub_armchair', size=(1, 1, 1.3), build=p_armchair),
    dict(kind='prop', id='pub_stage', size=(4, 8, 0.4), build=p_stage),
    dict(kind='prop', id='pub_speaker', size=(1, 1, 1.9), build=p_speaker),
    dict(kind='prop', id='pub_decks', size=(1, 2, 1.1), build=p_decks),
    dict(kind='prop', id='pub_mic', size=(1, 1, 2.0), build=p_mic),
    dict(kind='prop', id='pub_disco', size=(1, 1, 4.3), build=p_disco),
    dict(kind='prop', id='pub_buffet', size=(2, 1, 1.2), build=p_buffet),
    dict(kind='prop', id='pub_door', size=(1, 1, 2.8), build=p_door, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='pub_hatch', size=(2, 1, 2.7), build=p_hatch),
    dict(kind='prop', id='pub_boarded', size=(1, 1, 2.3), build=p_boarded),
    dict(kind='prop', id='pub_bell', size=(1, 1.3, 2.7), build=p_bell),
    dict(kind='prop', id='pub_pumps', size=(1, 1, 2.1), build=p_pumps),
    dict(kind='prop', id='pub_till', size=(1, 1, 1.6), build=p_till),
    dict(kind='prop', id='pub_pendant', size=(1, 1, 3.6), build=p_pendant),
]
