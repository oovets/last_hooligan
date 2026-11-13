# THE LAST HOOLIGAN — Fat Vic review sheet (Blender 5.x, headless): renders the EXPORTED glb, not the build scene.
#
#   Blender -b --factory-startup --python scripts/blender/vic_sheet.py -- scripts/blender/vic.json [out.png]
#
# Row 1: each reference beside the glb's head rendered through the camera vic_face.py fitted to it (build/mpfb/vic_cams.json,
#        moved into exported space with build/mpfb/vic_xform.json from char_mpfb.py).
# Row 2: the sides no reference shows (his left 3/4, back 3/4, under the chin) and the full body front / side / back.
# Default output: build/mpfb/vic_final_sheet.png

import bpy, os, sys, json, math, tempfile
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
JOB = json.load(open(argv[0]))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def P(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)
OUT = P(argv[1]) if len(argv) > 1 else P('build/mpfb/vic_final_sheet.png')
CAMS = json.load(open(P('build/mpfb/vic_cams.json')))
XF = json.load(open(P(JOB.get('xform', 'build/mpfb/vic_xform.json'))))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=P(JOB['out']))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.0144, 0.0144, 0.0144, 1); bg.inputs[1].default_value = 1.0
for m in bpy.data.materials:              # glTF imports the skin glossy-ish: matte preview like vic_face.py
    b = next((n for n in (m.node_tree.nodes if m.node_tree else []) if n.type == 'BSDF_PRINCIPLED'), None)
    if b and not m.name.startswith('eye'): b.inputs['Roughness'].default_value = max(b.inputs['Roughness'].default_value, 0.55)
L = {}
for nm, en in (('key', 3.0), ('fill', 1.2), ('top', 1.0)):
    ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en; ld.angle = math.radians(25)
    o = bpy.data.objects.new(nm, ld); scene.collection.objects.link(o); L[nm] = o
cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam); scene.camera = cam
cd.sensor_fit = 'HORIZONTAL'; cd.sensor_width = 36.0; cd.clip_start = 0.01; cd.clip_end = 50

S, ZMIN = XF['scale'], XF['zmin']
def to_out(p): return Vector((p[0] * S, p[1] * S, (p[2] - ZMIN) * S))

def lights(right, down, fwd):
    for nm, d in (('key', fwd + 0.55 * right + 0.45 * down), ('fill', fwd - 0.8 * right), ('top', 0.3 * fwd + down)):
        L[nm].rotation_euler = Vector(d).normalized().to_track_quat('-Z', 'Y').to_euler()

def render(path, W, H):
    scene.render.resolution_x, scene.render.resolution_y = W, H; scene.render.resolution_percentage = 100
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(path); a = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
    return a.reshape(H, W, 4)[::-1, :, :3].copy()

def load_ref(path):
    im = bpy.data.images.load(P(path)); W, H = im.size
    a = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
    return a.reshape(H, W, 4)[::-1, :, :3].copy()

def fitted(c, path):
    R = np.array(c['R']); t = np.array(c['t'])
    Rw = (np.diag([1.0, -1.0, -1.0]) @ R).T          # blender camera axes in world (raw) space
    loc = to_out(-R.T @ t)
    M = Matrix.Identity(4)
    for i in range(3):
        for j in range(3): M[i][j] = Rw[i, j]
        M[i][3] = loc[i]
    cam.matrix_world = M
    cd.lens = c['f'] * 36.0 / c['W']
    lights(Vector(R[0]), Vector(R[1]), Vector(R[2]))
    return render(path, c['W'], c['H'])

def orbit(path, target, yaw, pitch, dist, lens, W, H):
    """yaw 0 = in front of him (he faces -Y); yaw > 0 swings the camera to HIS right (-X)."""
    r, p = math.radians(yaw), math.radians(pitch)
    d = Vector((-math.sin(r) * math.cos(p), -math.cos(r) * math.cos(p), math.sin(p)))
    cam.location = target + d * dist; cd.lens = lens
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    right = (-d).cross(Vector((0, 0, 1))).normalized(); down = right.cross(-d).normalized()
    lights(right, down, -d)
    return render(path, W, H)

def fit_h(a, h):
    H, W = a.shape[:2]; w = int(round(W * h / H))
    yi = np.clip(((np.arange(h) + 0.5) * H / h).astype(int), 0, H - 1); xi = np.clip(((np.arange(w) + 0.5) * W / w).astype(int), 0, W - 1)
    return a[yi][:, xi]

tmp = tempfile.mkdtemp(prefix='vicsheet_')
TH = 460
row1 = []
for name, c in CAMS.items():
    ref = load_ref(c['img']); ren = fitted(c, os.path.join(tmp, name + '.png'))
    row1 += [fit_h(ref, TH), fit_h(ren, TH), np.zeros((TH, 12, 3), np.float32)]
# head centre in exported space: between the eyes, a little back
eyes = next(o for o in scene.objects if o.type == 'MESH' and o.name.startswith('eyes'))
dg = bpy.context.evaluated_depsgraph_get(); e = eyes.evaluated_get(dg); me = e.to_mesh()
hc = sum((e.matrix_world @ v.co for v in me.vertices), Vector()) / len(me.vertices) + Vector((0, 0.06, 0.0)); e.to_mesh_clear()
row2 = []
for nm, yaw, pitch in (('left34', -40, 4), ('back34', 150, 8), ('chin', 10, -35)):
    row2 += [fit_h(orbit(os.path.join(tmp, nm + '.png'), hc, yaw, pitch, 0.95, 85, 520, 560), TH), np.zeros((TH, 12, 3), np.float32)]
bc = Vector((0, 0, 0.92))
for nm, yaw in (('bfront', 0), ('bside', 90), ('bback', 180)):
    row2 += [fit_h(orbit(os.path.join(tmp, nm + '.png'), bc, yaw, 3, 2.55, 85, 380, 760), TH), np.zeros((TH, 12, 3), np.float32)]
r1 = np.concatenate(row1, 1); r2 = np.concatenate(row2, 1)
Wm = max(r1.shape[1], r2.shape[1])
sheet = np.concatenate([np.pad(r, ((0, 0), (0, Wm - r.shape[1]), (0, 0)), constant_values=0.0144) for r in (r1, r2)], 0)
im = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0])
a = np.ones((sheet.shape[0], sheet.shape[1], 4), np.float32); a[..., :3] = sheet
im.pixels.foreach_set(np.ascontiguousarray(a[::-1]).ravel())
os.makedirs(os.path.dirname(OUT), exist_ok=True)
im.filepath_raw = OUT; im.file_format = 'PNG'; im.save()
print('SHEET', OUT)
