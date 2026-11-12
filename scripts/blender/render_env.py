# THE LAST HOOLIGAN — Blender environment renderer (walls, floors, props) for Blender 4.2+/5.x, headless.
#
#   Blender -b --factory-startup --python scripts/blender/render_env.py -- <pieces_module.py> [<pieces_module2.py> ...] [--only id1,id2] [--preview]
#
# A pieces module (see scripts/blender/env_common.py) defines PIECES = [ dict(kind=..., id=..., build=fn, ...), ... ]:
#   kind 'wall'  : id = wall style id (same id as src/content/themes/*.js), heights=[3,5,...], variants=4,
#                  build(ctx, h_units, variant) creates geometry for ONE tile block occupying game [0,1]x[0,1], z 0..h*UNIT
#   kind 'floor' : id = floor style id, build(ctx, n) creates an n x n tile patch (game [0,n]x[0,n]) at z=0; the
#                  renderer cuts it into n*n tile diamonds (texture must be continuous in world space)
#   kind 'prop'  : id = prop type id, variants=[{...}], build(ctx, variant) creates geometry in game coords with the prop's
#                  footprint starting at (0,0) (w x d tiles); size = (w, d, hmax_units)
# All geometry helpers take GAME coordinates (gx, gy, gz units) — ctx.G(gx, gy, gz) converts to Blender space.
#
# Output (2x the game's logical pixel scale): assets/env/<kind>/<id>[_h<h>]_<variant>.png + assets/env/<id>.json manifest
# entries merged into assets/env/index.json:
#   walls: { id: { heights: { "3": [file...] } } }   drawn so the tile's NORTH corner sits at (32, h*40) px of the image
#   floors: { id: { n, files: [file of tile (i,j) ...] } } 64x32 diamonds
#   props: { id: { variants: [ { file, ax, ay } ] } }  (ax, ay) = pixel of the prop anchor (north corner of its footprint)

import bpy, bmesh, json, math, os, sys, importlib.util, time
from mathutils import Vector, Euler, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = None
if '--only' in argv:
    ONLY = set(argv[argv.index('--only') + 1].split(','))
PREVIEW = '--preview' in argv
mods = [a for a in argv if a.endswith('.py')]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'env')

S2 = 45.2548           # px per metre at 2x (tile diamond 64 px wide)
UNIT = 1.0206          # metres per game height unit (Z_PX 20 at 1x == 40 px at 2x)
ZPX = 40               # px per height unit at 2x

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    try: sc.eevee.taa_render_samples = 16
    except Exception: pass
    for attr, val in (('use_shadows', True), ('use_gtao', True), ('gtao_distance', 0.6)):
        try: setattr(sc.eevee, attr, val)
        except Exception: pass
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    try: sc.render.filter_size = 0.7
    except Exception: pass
    # camera (same projection as the game; game x -> Blender +Y, game y -> Blender +X)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.clip_end = 400
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.rotation_euler = Euler((math.radians(60), 0, math.radians(135)), 'XYZ')
    # lights: key from screen upper-left, soft sky fill
    sd = bpy.data.lights.new('key', 'SUN'); sd.energy = 3.6; sd.angle = math.radians(6)
    so = bpy.data.objects.new('key', sd); sc.collection.objects.link(so)
    so.rotation_euler = Vector((-0.35, 1.0, -1.35)).normalized().to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    if bg: bg.inputs[0].default_value = (0.32, 0.34, 0.4, 1); bg.inputs[1].default_value = 0.9
    return sc, cam

def project_basis(cam):
    m = cam.rotation_euler.to_matrix()
    return m @ Vector((1, 0, 0)), m @ Vector((0, 1, 0)), m @ Vector((0, 0, -1))

def G(gx, gy, gz=0.0):
    """game coords (tiles, tiles, height units) -> Blender metres"""
    return Vector((gy, gx, gz * UNIT))

def frame_camera(sc, cam, anchor_world, anchor_px, W, H):
    right, up, fwd = project_basis(cam)
    cam.data.ortho_scale = max(W, H) / S2
    sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
    # camera centre so that anchor_world projects to anchor_px (pixel coords, y down)
    du = (anchor_px[0] - W / 2) / S2
    dv = (H / 2 - anchor_px[1]) / S2
    centre = anchor_world - right * du - up * dv
    cam.location = centre - fwd * 150

def screen_px(cam, p, anchor_world, anchor_px):
    right, up, fwd = project_basis(cam)
    d = p - anchor_world
    return (anchor_px[0] + d.dot(right) * S2, anchor_px[1] - d.dot(up) * S2)

# ------------------------------------------------------------------ geometry/material helpers passed to builders
class Ctx:
    def __init__(self, sc):
        self.sc = sc
        self.mats = {}
    G = staticmethod(G)
    UNIT = UNIT

    def link(self, ob):
        self.sc.collection.objects.link(ob); return ob

    def box(self, gx, gy, gz, w, d, h, mat, bevel=0.0, name='box'):
        """axis-aligned box in game coords: [gx,gx+w] x [gy,gy+d] x [gz,gz+h] (h in units)"""
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x = (v.co.x + 0.5) * d      # Blender X = game y
            v.co.y = (v.co.y + 0.5) * w      # Blender Y = game x
            v.co.z = (v.co.z + 0.5) * h * UNIT
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES')
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me); self.link(ob)
        ob.location = G(gx, gy, gz)
        return ob

    def cyl(self, gx, gy, gz, r, h, mat, seg=16, r2=None, name='cyl'):
        """vertical cylinder centred at game (gx,gy), from gz up h units; r in metres"""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h * UNIT)
        for v in bm.verts: v.co.z += h * UNIT / 2
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me); self.link(ob)
        ob.location = G(gx, gy, gz)
        return ob

    def sphere(self, gx, gy, gz, r, mat, sx=1, sy=1, sz=1, name='sph'):
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
        for v in bm.verts: v.co.x *= sy; v.co.y *= sx; v.co.z *= sz
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me); self.link(ob); ob.location = G(gx, gy, gz)
        return ob

    def plane(self, gx, gy, w, d, mat, gz=0.0, name='plane'):
        return self.box(gx, gy, gz, w, d, 0.0005, mat, name=name)

    # ---- materials
    def mat(self, key, color=(0.5, 0.5, 0.5), rough=0.8, metal=0.0, emit=None, emit_strength=1.0):
        k = (key, color, rough, metal, emit, emit_strength)
        if k in self.mats: return self.mats[k]
        m = bpy.data.materials.new(key); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*srgb(color), 1)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        if emit:
            try:
                b.inputs['Emission Color'].default_value = (*srgb(emit), 1)
                b.inputs['Emission Strength'].default_value = emit_strength
            except Exception: pass
        self.mats[k] = m
        return m

    def nodemat(self, key):
        """empty node material: returns (material, nodes, links, bsdf, texcoord-object-vector)"""
        m = bpy.data.materials.new(key); m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes['Principled BSDF']
        tc = nt.nodes.new('ShaderNodeTexCoord')
        return m, nt.nodes, nt.links, b, tc.outputs['Object']

    def brick_mat(self, key, c1, c2, mortar, brick_w=0.25, brick_h=0.0638, mortar_size=0.012, rough=0.85, bump=0.35, seed_off=0.0, coord='Object'):
        if key in self.mats: return self.mats[key]
        m, N, L, b, co = self.nodemat(key)
        tc = co.node
        mp = N.new('ShaderNodeMapping'); mp.inputs['Location'].default_value = (seed_off, 0, 0)
        # bricks run horizontally on both wall faces: use (x+y) as the horizontal coordinate
        sep = N.new('ShaderNodeSeparateXYZ'); comb = N.new('ShaderNodeCombineXYZ'); add = N.new('ShaderNodeMath'); add.operation = 'ADD'
        L.new(tc.outputs[coord], sep.inputs[0]); L.new(sep.outputs[0], add.inputs[0]); L.new(sep.outputs[1], add.inputs[1])
        L.new(add.outputs[0], comb.inputs[0]); L.new(sep.outputs[2], comb.inputs[1])
        br = N.new('ShaderNodeTexBrick')
        br.inputs['Color1'].default_value = (*srgb(c1), 1); br.inputs['Color2'].default_value = (*srgb(c2), 1)
        br.inputs['Mortar'].default_value = (*srgb(mortar), 1)
        br.inputs['Scale'].default_value = 1.0
        br.inputs['Mortar Size'].default_value = mortar_size
        br.inputs['Brick Width'].default_value = brick_w
        br.inputs['Row Height'].default_value = brick_h
        br.offset = 0.5
        L.new(comb.outputs[0], br.inputs['Vector'])
        noise = N.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 18
        L.new(tc.outputs[coord], noise.inputs['Vector'])
        mixc = N.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; mixc.blend_type = 'MULTIPLY'
        mixc.inputs['Factor'].default_value = 0.18
        L.new(br.outputs['Color'], mixc.inputs['A']); L.new(noise.outputs['Color'], mixc.inputs['B'])
        L.new(mixc.outputs['Result'], b.inputs['Base Color'])
        bmp = N.new('ShaderNodeBump'); bmp.inputs['Strength'].default_value = bump
        L.new(br.outputs['Fac'], bmp.inputs['Height']); L.new(bmp.outputs['Normal'], b.inputs['Normal'])
        b.inputs['Roughness'].default_value = rough
        self.mats[key] = m
        return m

    def periodic_vector(self, N, L, tc, period, coord='Object'):
        """Map object coords (x,y) onto a 4D torus so textures repeat seamlessly every `period` metres.
        Returns (vector_socket, w_socket) for a 4D Noise/Voronoi texture (1 unit == 1 metre)."""
        R = period / (2 * math.pi)
        sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs[coord], sep.inputs[0])
        def ang(sock):
            m = N.new('ShaderNodeMath'); m.operation = 'MULTIPLY'; m.inputs[1].default_value = 2 * math.pi / period
            L.new(sock, m.inputs[0]); return m.outputs[0]
        def trig(sock, op):
            m = N.new('ShaderNodeMath'); m.operation = op; L.new(sock, m.inputs[0])
            k = N.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = R
            L.new(m.outputs[0], k.inputs[0]); return k.outputs[0]
        ax, ay = ang(sep.outputs[0]), ang(sep.outputs[1])
        comb = N.new('ShaderNodeCombineXYZ')
        L.new(trig(ax, 'COSINE'), comb.inputs[0]); L.new(trig(ax, 'SINE'), comb.inputs[1]); L.new(trig(ay, 'COSINE'), comb.inputs[2])
        return comb.outputs[0], trig(ay, 'SINE')

    def noise_mat(self, key, c1, c2, scale=8.0, rough=0.9, bump=0.2, detail=6.0, coord='Object', period=None):
        """Two-colour noise material. period=n -> seamless every n metres (use for floor patches: period = patch n)."""
        key = key + ('|p%s' % period if period else '')
        if key in self.mats: return self.mats[key]
        m, N, L, b, co = self.nodemat(key)
        tc = co.node
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
        if period:
            nz.noise_dimensions = '4D'
            v, w = self.periodic_vector(N, L, tc, period, coord)
            L.new(v, nz.inputs['Vector']); L.new(w, nz.inputs['W'])
        else:
            L.new(tc.outputs[coord], nz.inputs['Vector'])
        ramp = N.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*srgb(c1), 1); ramp.color_ramp.elements[1].color = (*srgb(c2), 1)
        L.new(nz.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], b.inputs['Base Color'])
        bmp = N.new('ShaderNodeBump'); bmp.inputs['Strength'].default_value = bump
        L.new(nz.outputs['Fac'], bmp.inputs['Height']); L.new(bmp.outputs['Normal'], b.inputs['Normal'])
        b.inputs['Roughness'].default_value = rough
        self.mats[key] = m
        return m

def srgb(c):
    if isinstance(c, str):
        h = c.lstrip('#'); c = tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

# ------------------------------------------------------------------ renderers
def clear_objects(sc):
    for ob in list(sc.collection.objects):
        if ob.type in ('MESH', 'CURVE', 'META', 'EMPTY', 'FONT'):
            bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0: bpy.data.meshes.remove(me)

def render_to(sc, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

def render_wall(sc, cam, ctx, piece, index):
    out = index['walls'].setdefault(piece['id'], {'heights': {}})
    nv = piece.get('variants', 4)
    for h in piece.get('heights', [3]):
        files = []
        for v in range(nv if not PREVIEW else 1):
            clear_objects(sc)
            piece['build'](ctx, h, v)
            Hpx = round(h * ZPX)
            mx, et, eb = piece.get('padX', 0), piece.get('extraTop', 0), piece.get('padBottom', 0)
            W, Hh = 64 + 2 * mx, 32 + Hpx + et + eb
            frame_camera(sc, cam, G(0, 0, h), (32 + mx, et), W, Hh)
            f = 'walls/%s_h%s_%d.png' % (piece['id'], str(h).replace('.', 'p'), v)
            render_to(sc, os.path.join(OUT, f))
            files.append(f)
        out['heights'][str(h)] = {'files': files, 'extraTop': piece.get('extraTop', 0), 'padX': piece.get('padX', 0)}

def render_floor(sc, cam, ctx, piece, index):
    n = piece.get('n', 4)
    clear_objects(sc)
    piece['build'](ctx, n)
    # tile the patch geometry 3x3 so the rendered centre patch has no AA/lighting edge -> seamless when repeated
    base = [ob for ob in sc.collection.objects if ob.type == 'MESH']
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == 0 and dy == 0: continue
            for ob in base:
                c = ob.copy(); sc.collection.objects.link(c)
                c.location = ob.location + G(dx * n, dy * n, 0)
    # whole patch: north corner of tile (0,0) at the top centre
    W, H = n * 64, n * 32
    anchor = G(0, 0, 0)
    frame_camera(sc, cam, anchor, (W / 2, 0), W, H)
    f = 'floors/%s.png' % piece['id']
    render_to(sc, os.path.join(OUT, f))
    index['floors'][piece['id']] = {'n': n, 'file': f}

def render_prop(sc, cam, ctx, piece, index):
    w, d, hmax = piece.get('size', (1, 1, 2))
    vars_ = piece.get('variants', [{}])
    out = {'variants': []}
    for vi, var in enumerate(vars_ if not PREVIEW else vars_[:1]):
        clear_objects(sc)
        piece['build'](ctx, var)
        # bounding projection of the footprint box
        corners = [G(x, y, z) for x in (0, w) for y in (0, d) for z in (0, hmax)]
        anchor = G(0, 0, 0)
        pad = piece.get('pad', 8)
        right, up, fwd = project_basis(cam)
        us = [(c - anchor).dot(right) * S2 for c in corners]; vs = [-(c - anchor).dot(up) * S2 for c in corners]
        x0, x1 = min(us) - pad, max(us) + pad; y0, y1 = min(vs) - pad, max(vs) + pad
        W, H = int(math.ceil(x1 - x0)), int(math.ceil(y1 - y0))
        W += W % 2; H += H % 2
        ax, ay = -x0, -y0
        frame_camera(sc, cam, anchor, (ax, ay), W, H)
        f = 'props/%s_%d.png' % (piece['id'], vi)
        render_to(sc, os.path.join(OUT, f))
        out['variants'].append({'file': f, 'ax': round(ax, 2), 'ay': round(ay, 2), **{k: v for k, v in var.items() if isinstance(v, (str, int, float))}})
    index['props'][piece['id']] = out

RENDERED = {}

def merge_index():
    parts_dir = os.path.join(OUT, 'parts')
    out = {'walls': {}, 'floors': {}, 'props': {}}
    for f in sorted(os.listdir(parts_dir)) if os.path.isdir(parts_dir) else []:
        if not f.endswith('.json'): continue
        try: d = json.load(open(os.path.join(parts_dir, f)))
        except Exception: continue
        for k in out:
            for pid, v in d.get(k, {}).items():
                if k == 'walls' and pid in out[k]:
                    out[k][pid]['heights'].update(v['heights'])
                else:
                    out[k][pid] = json.loads(json.dumps(v))
    tmp = os.path.join(OUT, 'index.json.tmp')
    json.dump(out, open(tmp, 'w'), indent=0)
    os.replace(tmp, os.path.join(OUT, 'index.json'))

def main():
    sc, cam = reset_scene()
    ctx = Ctx(sc)
    idx_path = os.path.join(OUT, 'index.json')
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    for k in ('walls', 'floors', 'props'): index.setdefault(k, {})
    # start each wall entry fresh for this run so heights merge cleanly
    t0 = time.time()
    for mp in mods:
        spec = importlib.util.spec_from_file_location(os.path.basename(mp)[:-3], mp if os.path.isabs(mp) else os.path.join(ROOT, mp))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        RENDERED[os.path.basename(mp)[:-3]] = {'walls': set(), 'floors': set(), 'props': set()}
        for piece in mod.PIECES:
            if ONLY and piece['id'] not in ONLY: continue
            RENDERED[os.path.basename(mp)[:-3]][piece['kind'] + 's'].add(piece['id'])
            {'wall': render_wall, 'floor': render_floor, 'prop': render_prop}[piece['kind']](sc, cam, ctx, piece, index)
            print('rendered', piece['kind'], piece['id'], '%.1fs' % (time.time() - t0), flush=True)
    # write this run's entries into a per-module part file, then rebuild index.json from all parts
    # (safe when several Blender processes render different modules at the same time)
    parts_dir = os.path.join(OUT, 'parts'); os.makedirs(parts_dir, exist_ok=True)
    for mp in mods:
        name = os.path.basename(mp)[:-3]
        pp = os.path.join(parts_dir, name + '.json')
        cur = json.load(open(pp)) if os.path.exists(pp) else {}
        for k in ('walls', 'floors', 'props'):
            cur.setdefault(k, {})
            for pid, v in index[k].items():
                if pid in RENDERED[name][k]: cur[k][pid] = v
        json.dump(cur, open(pp, 'w'), indent=0)
    merge_index()
    print('DONE %.1fs' % (time.time() - t0))

main()
