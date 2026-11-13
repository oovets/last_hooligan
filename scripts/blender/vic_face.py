# THE LAST HOOLIGAN — Fat Vic's face (Blender 5.x, headless, MPFB2): shape-match loop + photo projection onto the skin UVs.
#
#   Blender -b --factory-startup --python scripts/blender/vic_face.py -- scripts/blender/vic.json [compare|bake] [tag]
#
# Reads the SAME job as char_mpfb.py (macro, targets, assets.skin/brows, eye_mat) plus its "face" block:
#   "face": { "views": { "<view>": {"img": "build/mpfb/vic_refs/front.png", "lm": {"eye_r_out": [x, y], ...}, "bias": 1.0}, ... },
#             "focal_mm": 85, "tex": "build/mpfb/vic_skin.png", "tex_px": 1024 }
# Landmarks are reference-image pixels (top-left origin), named as in landmarks3d(): eye_r_out, eye_r_in, eye_l_in, eye_l_out,
# nose_tip, mouth_r, mouth_l, stomion, chin, ear_r_top, ear_r_low (r/l = HIS right/left; his right is image-left from the front).
# A view may also give "mask" boxes [x0, y0, x1, y1] to ignore (UI junk) and "bias" (its weight in the blend).
#
#   compare: build the head, fit a camera to each reference from the landmarks, render the head from that camera and write
#            build/mpfb/vic_compare_<tag>.png (one row per view: reference | render | 50/50 overlay with landmarks; green =
#            reference, red = the model's landmark through the fitted camera) and prints the landmark residuals.
#   bake:    the same cameras; every skin texel of the head/neck is projected into each reference (camera + an RBF warp
#            that lands the model's landmarks exactly on the photo's), occlusion-tested, weighted by how squarely it faces
#            that camera (front first; 3/4 and profile for cheek/jaw/ear; his unseen left side borrows the mirrored right),
#            highlight-neutralised, exposure-matched and feathered into the MPFB skin (toned to his colour) elsewhere.
#            Writes face.tex (sRGB, authored colour: char_mpfb.py names that material skin_vic, outside the ID_ tint path),
#            <tex>_mask.png (where the photos were used)
#            and a textured compare sheet build/mpfb/vic_compare_<tag>.png (+ _extra: the unreferenced sides).
#   Both modes write the fitted cameras to build/mpfb/vic_cams.json (scripts/blender/vic_sheet.py renders the glb through them).
#
# Coordinates: MPFB raw space (decimetre basemesh scaled by 0.1, facing -Y, his left = +X). The texture only depends on
# UVs, so the hero build's later posing/scaling doesn't matter.

import bpy, addon_utils, os, sys, json, math, tempfile
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
JOB = json.load(open(argv[0]))
MODE = argv[1] if len(argv) > 1 else 'compare'
TAG = argv[2] if len(argv) > 2 else MODE
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def P(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)
FACE = JOB['face']
OUTDIR = P(FACE.get('out_dir', 'build/mpfb'))
os.makedirs(OUTDIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services import HumanService, ExportService, LocationService, TargetService
scene = bpy.context.scene
UD = LocationService.get_user_data()
def asset(sub, name, ext='.mhclo'): return os.path.join(UD, sub, name, name + ext)

# ------------------------------------------------------------------ build the head (same macro/targets/parts as char_mpfb)
MACRO = {'gender': 1.0, 'age': 0.5, 'muscle': 0.62, 'weight': 0.55, 'proportions': 0.6, 'height': 0.55, 'cupsize': 0.5, 'firmness': 0.5,
         'race': {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0}}
MACRO.update(JOB.get('macro', {}))
A = JOB.get('assets', {})

def target_path(name):
    if '/' in name:
        p = os.path.join(LocationService.get_mpfb_data('targets'), name + ('' if name.endswith('.gz') else '.target.gz'))
        return p if os.path.exists(p) else None
    return TargetService.target_full_path(name)

body = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True,
                                 scale=0.1, macro_detail_dict=MACRO)
for tname, tw in JOB.get('targets', {}).items():
    tp = target_path(tname)
    if not tp: raise SystemExit('unknown MPFB target ' + tname)
    TargetService.load_target(body, tp, weight=tw)
if JOB.get('cranium'):                                 # same dome sculpt as char_mpfb.py
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mpfb_shape
    mpfb_shape.sculpt_cranium(body, JOB['cranium'])
OBJ = {'body': body}
for role, sub, name, typ in (('eyes', 'eyes', A.get('eyes', 'low-poly'), 'Eyes'), ('brows', 'eyebrows', A.get('brows', 'eyebrow010'), 'Eyebrows'),
                             ('lashes', 'eyelashes', A.get('lashes', 'eyelashes01'), 'Eyelashes'), ('teeth', 'teeth', A.get('teeth', 'teeth_base'), 'Teeth')):
    if name: OBJ[role] = HumanService.add_mhclo_asset(asset(sub, name), body, asset_type=typ, subdiv_levels=0, material_type='GAMEENGINE')
HumanService.set_character_skin(asset('skins', A.get('skin', 'young_caucasian_male'), ext='.mhmat'), body, skin_type='GAMEENGINE')

# landmarks need the helper geometry (eyelash helpers trace the lid margins), so read them from the shape-key mix first
def mixed_coords(ob):
    if not ob.data.shape_keys: return np.array([v.co for v in ob.data.vertices])
    k = ob.shape_key_add(name='_mix', from_mix=True)
    c = np.array([d.co for d in k.data]); ob.shape_key_remove(k); return c
CO = mixed_coords(body)
def grp(name, thr=0.5):
    gi = body.vertex_groups[name].index
    return np.array([v.index for v in body.data.vertices if any(g.group == gi and g.weight > thr for g in v.groups)], int)

def landmarks3d():
    L = {}
    for s, sg in (('r', -1), ('l', 1)):
        lash = np.concatenate([grp('helper-%s-eyelashes-1' % s), grp('helper-%s-eyelashes-2' % s)])
        p = CO[lash]
        L['eye_%s_out' % s] = p[np.argmax(p[:, 0] * sg)]          # outer corner = furthest from the midline
        L['eye_%s_in' % s] = p[np.argmin(p[:, 0] * sg)]
    lips = grp('lips'); pl = CO[lips]
    L['mouth_r'] = pl[np.argmin(pl[:, 0])]; L['mouth_l'] = pl[np.argmax(pl[:, 0])]
    mid = pl[np.abs(pl[:, 0]) < 0.003]
    zc = 0.5 * (L['mouth_r'][2] + L['mouth_l'][2])                # stomion: the midline lip point nearest the corners' height
    front = mid[mid[:, 1] < mid[:, 1].min() + 0.012]
    L['stomion'] = front[np.argmin(np.abs(front[:, 2] - zc))]
    sk = np.array([v.index for v in body.data.vertices if v.groups and body.vertex_groups['body'].index in [g.group for g in v.groups]])
    skin = CO[sk]
    eyez = 0.5 * (L['eye_r_in'][2] + L['eye_l_in'][2])
    m = skin[(np.abs(skin[:, 0]) < 0.004) & (skin[:, 2] < eyez) & (skin[:, 2] > zc)]
    L['nose_tip'] = m[np.argmin(m[:, 1])]
    m3 = skin[(np.abs(skin[:, 0]) < 0.004) & (skin[:, 2] < zc - 0.025) & (skin[:, 2] > zc - 0.08) & (skin[:, 1] < L['stomion'][1] + 0.03)]
    L['chin'] = m3[np.argmin(m3[:, 1])]                           # pogonion: the most forward point under the lip
    ears = grp('ears'); pe = CO[ears]; pr = pe[pe[:, 0] < 0]
    L['ear_r_top'] = pr[np.argmax(pr[:, 2])]; L['ear_r_low'] = pr[np.argmin(pr[:, 2])]
    return {k: Vector(v) for k, v in L.items()}
LM3 = landmarks3d()

ExportService.bake_modifiers_remove_helpers(body, bake_masks=True, bake_subdiv=False, remove_helpers=True)
for ob in OBJ.values():
    if ob.data.shape_keys:
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for m in list(ob.modifiers):
        if m.type != 'ARMATURE': ob.modifiers.remove(m)
    mw = ob.matrix_world.copy(); ob.parent = None; ob.data.transform(mw); ob.matrix_world = Matrix.Identity(4)
for o in [o for o in bpy.data.objects if o.type == 'ARMATURE']: bpy.data.objects.remove(o, do_unlink=True)

EYE_MAT = JOB.get('eye_mat', 'brown')
em = OBJ['eyes'].data.materials[0]; ed = em.node_tree.nodes.get('DiffuseTexture')
ed.image = bpy.data.images.load(os.path.join(UD, 'eyes', 'materials', EYE_MAT + '_eye.png'))
for ob in OBJ.values():                          # matte-ish preview materials (the MPFB game materials are glossy)
    for m in ob.data.materials:
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b: b.inputs['Roughness'].default_value = 0.12 if ob is OBJ['eyes'] else 0.55
if 'brows' in OBJ and JOB.get('tints', {}).get('brows'):     # brows in his LOOK colour (the game tints ID_18 the same way)
    hx = JOB['tints']['brows']
    bm = OBJ['brows'].data.materials[0]; bb = next(n for n in bm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    for ln in [l for l in bm.node_tree.links if l.to_socket == bb.inputs['Base Color']]: bm.node_tree.links.remove(ln)
    bb.inputs['Base Color'].default_value = tuple((int(hx[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5)) + (1,)

# ------------------------------------------------------------------ image helpers (arrays are top-down, float RGB(A) 0..1, sRGB)
def load_img(path):
    im = bpy.data.images.load(P(path)); w, h = im.size
    a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1].copy()

def save_img(arr, path, alpha=False):
    h, w = arr.shape[:2]
    a = np.ones((h, w, 4), np.float32); a[..., :arr.shape[2]] = arr[..., :4]
    im = bpy.data.images.new('save', w, h, alpha=alpha)
    im.pixels.foreach_set(np.ascontiguousarray(a[::-1]).ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)

def box_blur(a, r, axis):
    if r < 1: return a
    pad = [(0, 0)] * a.ndim; pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
    n = a.shape[axis]
    return (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(0, n), axis=axis)) / (2 * r + 1)

def blur(a, r):
    for _ in range(3):
        a = box_blur(box_blur(a, r, 0), r, 1)
    return a

def resize(a, h):
    """nearest-ish resample to height h (for sheets)."""
    H, W = a.shape[:2]; w = int(round(W * h / H))
    yi = np.clip((np.arange(h) + 0.5) * H / h, 0, H - 1).astype(int); xi = np.clip((np.arange(w) + 0.5) * W / w, 0, W - 1).astype(int)
    return a[yi][:, xi]

def dot(a, xy, col, r=3):
    x, y = int(round(xy[0])), int(round(xy[1]))
    a[max(0, y - r):y + r + 1, max(0, x - r):x + r + 1, :3] = col

# ------------------------------------------------------------------ camera fit (pinhole, OpenCV convention: x right, y down, z forward)
def rodrigues(r):
    th = np.linalg.norm(r)
    if th < 1e-12: return np.eye(3)
    k = r / th; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K

def project(X, cam):
    Xc = X @ cam['R'].T + cam['t']
    return np.stack([cam['cx'] + cam['f'] * Xc[:, 0] / Xc[:, 2], cam['cy'] + cam['f'] * Xc[:, 1] / Xc[:, 2]], 1), Xc[:, 2]

def fit_camera(X, x, W, H, focal_mm):
    f = W * focal_mm / 36.0; cx, cy = W / 2, H / 2
    Xm, xm = X.mean(0), x.mean(0)
    Aff, *_ = np.linalg.lstsq(np.c_[X - Xm], x - xm, rcond=None)          # x - xm ~ (X - Xm) @ Aff   (3x2)
    U, S, Vt = np.linalg.svd(Aff.T, full_matrices=False)
    R2 = U @ Vt; s = S.mean()
    R = np.vstack([R2, np.cross(R2[0], R2[1])])
    Z0 = f / s
    t = np.array([(xm[0] - cx) * Z0 / f, (xm[1] - cy) * Z0 / f, Z0]) - R @ Xm
    def refine(cam):
        def resid(p):
            c = dict(cam, R=rodrigues(p[:3]) @ cam['R'], t=cam['t'] + p[3:])
            return (project(X, c)[0] - x).ravel()
        p = np.zeros(6); lam = 1e-3
        for it in range(80):                                # Levenberg-Marquardt, numeric Jacobian
            r0 = resid(p); J = np.empty((r0.size, 6))
            for k in range(6):
                d = np.zeros(6); d[k] = 1e-6 if k < 3 else 1e-6 * Z0
                J[:, k] = (resid(p + d) - r0) / d[k]
            A_ = J.T @ J; g = J.T @ r0
            step = -np.linalg.solve(A_ + lam * np.diag(np.diag(A_) + 1e-9), g)
            if (resid(p + step) ** 2).sum() < (r0 ** 2).sum(): p = p + step; lam *= 0.3
            else: lam *= 10
        c = dict(cam, R=rodrigues(p[:3]) @ cam['R'], t=cam['t'] + p[3:])
        return c, (resid(p) ** 2).sum()
    best = None
    for yaw in range(-80, 81, 20):                          # multi-start: the affine guess plus cameras swung round the head
        Ry = np.array(Matrix.Rotation(math.radians(yaw), 3, 'Z'))
        Rs = R @ Ry.T if yaw else R
        ts = np.array([(xm[0] - cx) * Z0 / f, (xm[1] - cy) * Z0 / f, Z0]) - Rs @ Xm
        c, e = refine({'R': Rs, 't': ts, 'f': f, 'cx': cx, 'cy': cy, 'W': W, 'H': H})
        if best is None or e < best[1]: best = (c, e)
    cam = best[0]
    cam['res'] = np.sqrt(((project(X, cam)[0] - x) ** 2).sum(1))
    return cam

def blender_camera(cam, name='cam'):
    D = np.diag([1.0, -1.0, -1.0])
    Rb = D @ cam['R']                                     # world -> blender camera
    M = Matrix.Identity(4)
    Rw = Rb.T; loc = -cam['R'].T @ cam['t']
    for i in range(3):
        for j in range(3): M[i][j] = Rw[i, j]
        M[i][3] = loc[i]
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    ob = bpy.data.objects.get(name) or bpy.data.objects.new(name, cd)
    if ob.name not in scene.collection.objects: scene.collection.objects.link(ob)
    cd.sensor_fit = 'HORIZONTAL'; cd.sensor_width = 36.0; cd.lens = cam['f'] * 36.0 / cam['W']
    cd.clip_start = 0.01; cd.clip_end = 50
    ob.matrix_world = M
    scene.camera = ob
    return ob

# ------------------------------------------------------------------ the three reference views
VIEWS = []
for vname, v in FACE['views'].items():
    img = load_img(v['img'])
    H_, W_ = img.shape[:2]
    names = [k for k in v['lm'] if k in LM3]
    X = np.array([LM3[k] for k in names]); x = np.array([v['lm'][k] for k in names], float)
    cam = fit_camera(X, x, W_, H_, v.get('focal_mm', FACE.get('focal_mm', 85)))
    proj = project(X, cam)[0]
    print('VIEW %-8s rms %.1f px | %s' % (vname, np.sqrt((cam['res'] ** 2).mean()),
          ' '.join('%s:%+.0f,%+.0f' % (n, *(x[i] - proj[i])) for i, n in enumerate(names))))
    fwd = cam['R'][2]                                       # camera forward in world
    print('   cam dir (world) %s, yaw %.1f deg, pitch %.1f deg, lens %.0f mm' % (np.round(fwd, 3), math.degrees(math.atan2(fwd[0], fwd[1])),
          math.degrees(math.asin(-fwd[2])), cam['f'] * 36 / W_))
    VIEWS.append(dict(name=vname, img=img, cam=cam, names=names, X=X, x=x, proj=proj, bias=v.get('bias', 1.0), mask=v.get('mask', [])))
json.dump({V['name']: {'R': V['cam']['R'].tolist(), 't': V['cam']['t'].tolist(), 'f': V['cam']['f'], 'W': V['cam']['W'], 'H': V['cam']['H'],
                       'img': FACE['views'][V['name']]['img']} for V in VIEWS},
          open(os.path.join(OUTDIR, 'vic_cams.json'), 'w'), indent=1)     # raw MPFB space; vic_sheet.py reuses them

# ------------------------------------------------------------------ render setup
def setup_render():
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.0144, 0.0144, 0.0144, 1); bg.inputs[1].default_value = 1.0
    scene.render.film_transparent = False
    for nm, en in (('key', 3.0), ('fill', 1.2), ('top', 1.0)):
        ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en; ld.angle = math.radians(25)
        scene.collection.objects.link(bpy.data.objects.new(nm, ld))
setup_render()

def light_for(cam):
    """key from the camera's upper left, fill from its right, a soft top light (like the scan renders)."""
    Rw = cam['R'].T                                       # columns: cam x (right), y (down), z (forward) in world
    right, down, fwd = Rw[:, 0], Rw[:, 1], Rw[:, 2]
    for nm, d in (('key', -fwd - 0.55 * right - 0.45 * down), ('fill', -fwd + 0.8 * right), ('top', -0.3 * fwd - down)):
        ob = bpy.data.objects[nm]; to_light = Vector(d).normalized()
        ob.rotation_euler = to_light.to_track_quat('Z', 'Y').to_euler()

def render(cam, path, scale=1.0):
    blender_camera(cam); light_for(cam)
    scene.render.resolution_x = cam['W']; scene.render.resolution_y = cam['H']
    scene.render.resolution_percentage = int(100 * scale)
    scene.render.filepath = path; scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    return load_img(path)

def compare_sheet(tag):
    tmp = tempfile.mkdtemp(prefix='vicface_')
    rows = []
    for V in VIEWS:
        ren = render(V['cam'], os.path.join(tmp, V['name'] + '.png'))[..., :3]
        ref = V['img'][..., :3]
        ov = 0.5 * ref + 0.5 * ren
        # silhouettes: reference (green) and render (red) outlines; IoU above the mouth line (cranium + upper face)
        def sil(a):
            bgc = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3)]), 0)
            return np.abs(a - bgc).max(-1) > 0.05
        ms, rs = sil(ref), sil(ren)
        for mk in V['mask']: ms[mk[1]:mk[3], mk[0]:mk[2]] = False
        cut = int(V['x'][V['names'].index('stomion')][1]) if 'stomion' in V['names'] else ref.shape[0]
        iou = (ms[:cut] & rs[:cut]).sum() / max(1, (ms[:cut] | rs[:cut]).sum())
        print('   %s silhouette IoU above the mouth: %.3f (ref %d px, render %d px)' % (V['name'], iou, ms[:cut].sum(), rs[:cut].sum()))
        for mk, col in ((ms, (0.1, 1, 0.1)), (rs, (1, 0.2, 0.1))):
            e = mk & ~(np.roll(mk, 2, 0) & np.roll(mk, -2, 0) & np.roll(mk, 2, 1) & np.roll(mk, -2, 1))
            ov[e] = col
        for i in range(len(V['names'])):
            dot(ov, V['x'][i], (0.1, 1, 0.1), 3); dot(ov, V['proj'][i], (1, 0.15, 0.1), 2)
        row = np.concatenate([resize(a, 520) for a in (ref, ren, ov)], 1)
        save_img(row, os.path.join(OUTDIR, 'vic_compare_%s_%s.png' % (tag, V['name'])))
        rows.append(row)
    Wm = max(r.shape[1] for r in rows)
    sheet = np.concatenate([np.pad(r, ((0, 0), (0, Wm - r.shape[1]), (0, 0))) for r in rows], 0)
    fp = os.path.join(OUTDIR, 'vic_compare_%s.png' % tag); save_img(sheet, fp); print('SHEET', fp)

# ------------------------------------------------------------------ projection bake
def bake_texture(sel):
    """rasterise the body's UV triangles: per texel world position + normal for the triangles in sel (COV), and a mask of
    texels inside any triangle (ALL)."""
    R = FACE.get('tex_px', 1024)
    me = body.data
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    tl = np.empty(nt * 3, int); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(nt, 3)
    tv = np.empty(nt * 3, int); me.loop_triangles.foreach_get('vertices', tv); tv = tv.reshape(nt, 3)
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    vn = np.empty(len(me.vertices) * 3, np.float32); me.vertex_normals.foreach_get('vector', vn); vn = vn.reshape(-1, 3)
    POS = np.zeros((R, R, 3), np.float32); NRM = np.zeros((R, R, 3), np.float32); COV = np.zeros((R, R), bool)
    ALL = np.zeros((R, R), bool)                        # any triangle (for seam dilation)
    POSA = np.zeros((R, R, 3), np.float32)              # world position of every texel (body island too)
    for ti in range(nt):
        p = uv[tl[ti]] * R - 0.5
        x0, y0 = np.floor(p.min(0)).astype(int); x1, y1 = np.ceil(p.max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, R - 1), min(y1, R - 1)
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
        if abs(d) < 1e-12: continue
        b0 = ((p[1, 1] - p[2, 1]) * (gx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (gy - p[2, 1])) / d
        b1 = ((p[2, 1] - p[0, 1]) * (gx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (gy - p[2, 1])) / d
        b2 = 1 - b0 - b1
        ins = (b0 >= -1e-4) & (b1 >= -1e-4) & (b2 >= -1e-4)
        if not ins.any(): continue
        yy, xx = gy[ins], gx[ins]
        ALL[yy, xx] = True
        bb = np.stack([b0[ins], b1[ins], b2[ins]], 1)
        POSA[yy, xx] = bb @ co[tv[ti]]
        if ti not in sel: continue
        POS[yy, xx] = bb @ co[tv[ti]]
        NRM[yy, xx] = bb @ vn[tv[ti]]
        COV[yy, xx] = True
    return POS, NRM, COV, ALL, POSA

def rbf_warp(src, dst, sigma):
    """displacement field d(p) = sum w_i exp(-|p - src_i|^2 / 2 sigma^2), exact at the landmarks (ridge-regularised)."""
    D2 = ((src[:, None] - src[None]) ** 2).sum(-1)
    K = np.exp(-D2 / (2 * sigma ** 2)) + 1e-3 * np.eye(len(src))
    Wt = np.linalg.solve(K, dst - src)
    def f(q):
        out = np.zeros_like(q)
        for i in range(len(src)):
            out += np.exp(-((q - src[i]) ** 2).sum(-1) / (2 * sigma ** 2))[:, None] * Wt[i]
        return q + out
    return f

def bilinear(img, u, v):
    H, W = img.shape[:2]
    u = np.clip(u, 0, W - 1.001); v = np.clip(v, 0, H - 1.001)
    x0 = np.floor(u).astype(int); y0 = np.floor(v).astype(int); fx = (u - x0)[:, None]; fy = (v - y0)[:, None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy) + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)

def prep_reference(V):
    """foreground mask (not the dark backdrop, not UI junk), eroded; strong specular highlights pulled to the local colour."""
    img = V['img'][..., :3].copy()
    bgc = np.median(np.concatenate([img[:8, :8].reshape(-1, 3), img[:8, -8:].reshape(-1, 3)]), 0)
    fg = (np.abs(img - bgc).max(-1) > 0.06).astype(np.float32)
    for (x0, y0, x1, y1) in V['mask']: fg[y0:y1, x0:x1] = 0
    fg = (blur(fg, 3) > 0.98).astype(np.float32)          # erode ~ a few px: no backdrop halo
    base = blur(img * fg[..., None], 10) / np.maximum(blur(fg, 10), 1e-3)[..., None]
    lum = img.mean(-1); blum = base.mean(-1)
    sat = img.max(-1) - img.min(-1)
    hl = np.clip((lum - blum * 1.05) / 0.08, 0, 1) * np.clip(1.4 - sat / 0.25, 0, 1) * fg
    hl = blur(hl, 2)
    img = img * (1 - hl[..., None]) + base * 1.02 * hl[..., None]
    return img, fg

def bake():
    me = body.data
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    tv = np.empty(nt * 3, int); me.loop_triangles.foreach_get('vertices', tv); tv = tv.reshape(nt, 3)
    co = np.array([v.co for v in me.vertices])
    # project only onto the UV islands that lie wholly on the head (face/scalp island, ears, lids, mouth); the body
    # island (which carries the lower neck) keeps the toned MPFB skin, and the projection fades out before the seam
    from bpy_extras.mesh_utils import mesh_linked_uv_islands
    head_polys = set()
    for isl in mesh_linked_uv_islands(me):
        vz = [co[v, 2] for pi in isl for v in me.polygons[pi].vertices]
        if min(vz) > LM3['chin'][2] - 0.12: head_polys.update(isl)
    tp = np.empty(nt, int); me.loop_triangles.foreach_get('polygon_index', tp)
    sel = set(np.where([t in head_polys for t in tp])[0].tolist())
    vin = set(v for pi in head_polys for v in me.polygons[pi].vertices)
    vout = set(v for p_ in me.polygons if p_.index not in head_polys for v in p_.vertices)
    seam = np.array(sorted(vin & vout), int)
    print('   head islands: %d polys, seam %d verts (z %.3f..%.3f)' % (len(head_polys), len(seam), co[seam, 2].min(), co[seam, 2].max()))
    POS, NRM, COV, ALL, POSA = bake_texture(sel)
    R = POS.shape[0]
    idx = np.where(COV.ravel())[0]
    pos = POS.reshape(-1, 3)[idx].astype(np.float64); nrm = NRM.reshape(-1, 3)[idx].astype(np.float64)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    print('BAKE texels', len(idx))
    # occluder = the same triangulation the texels were interpolated on (a quad split the other way self-shadows them)
    bvh = BVHTree.FromPolygons([tuple(c) for c in co], [tuple(t) for t in tv])
    n = len(idx)
    acc = np.zeros((n, 3)); wsum = np.zeros(n)
    accm = np.zeros((n, 3)); wsm = np.zeros(n)          # mirrored fallback (his left side borrows his right)
    per = []
    for V in VIEWS:
        img, fg = prep_reference(V)
        cam = V['cam']
        Cw = -cam['R'].T @ cam['t']
        warp = rbf_warp(V['proj'], V['x'], sigma=0.09 * max(cam['W'], cam['H']))
        for mirror in (False, True):
            p = pos * ([-1, 1, 1] if mirror else 1); nn = nrm * ([-1, 1, 1] if mirror else 1)
            d = Cw - p; dist = np.linalg.norm(d, axis=1); d /= dist[:, None]
            facing = (nn * d).sum(1)
            cand = np.where(facing > 0.05)[0]
            vis = np.zeros(n, bool)
            for i in cand:                                  # occlusion: ray from the texel to the camera
                o = Vector(p[i] + nn[i] * 4e-4 + d[i] * 4e-4)
                hit = bvh.ray_cast(o, Vector(d[i]), dist[i])
                vis[i] = hit[0] is None
            uvp, z = project(p, cam)
            uvp = warp(uvp)
            u, v = uvp[:, 0], uvp[:, 1]
            inb = (u > 1) & (v > 1) & (u < cam['W'] - 2) & (v < cam['H'] - 2) & (z > 0)
            ok = vis & inb
            col = np.zeros((n, 3)); fgs = np.zeros(n)
            col[ok] = bilinear(img, u[ok], v[ok]); fgs[ok] = bilinear(fg[..., None], u[ok], v[ok])[:, 0]
            w = np.clip((facing - 0.12) / 0.88, 0, 1) ** 4 * fgs * ok * V['bias']
            if mirror: accm += col * w[:, None]; wsm += w
            else:
                per.append((col, w)); acc += col * w[:, None]; wsum += w
        print('   view %s: %d texels used' % (V['name'], int((per[-1][1] > 0.05).sum())))
    # exposure match: scale each view to the weighted mean where it overlaps the others
    ref_mean = (acc / np.maximum(wsum, 1e-6)[:, None])
    acc[:] = 0; wsum[:] = 0
    for (col, w), V in zip(per, VIEWS):
        both = (w > 0.2) & (w < 0.9 * sum(pw for _, pw in per))        # texels this view shares with another one
        g = np.ones(3)
        if both.sum() > 200:
            g = np.clip(np.median(ref_mean[both], 0) / np.maximum(np.median(col[both], 0), 1e-3), 0.85, 1.15)
        print('   view %s gain %s' % (V['name'], np.round(g, 3)))
        acc += col * g * w[:, None]; wsum += w
    Cm = accm / np.maximum(wsm, 1e-6)[:, None]
    # his left side (+X): the references all show his right, so lateral texels (cheek, temple, ear: away from the
    # asymmetric smirk and eyes) blend the mirrored right side in as if it were another view
    lat = np.clip((pos[:, 0] - FACE.get('mirror_from', 0.055)) / 0.025, 0, 1); lat = lat * lat * (3 - 2 * lat)
    mb = lat * FACE.get('mirror', 1.0)
    wtot = wsum + wsm * mb
    C = (acc + accm * mb[:, None]) / np.maximum(wtot, 1e-6)[:, None]
    conf = np.clip(wtot / 0.25, 0, 1); confm = np.clip(wsm / 0.25, 0, 1) * 0.9
    use_m = (1 - conf) * confm                              # elsewhere the mirror only fills what no view saw
    Cf = (C * conf[:, None] + Cm * use_m[:, None]) / np.maximum(conf + use_m, 1e-6)[:, None]
    Af = np.clip(conf + use_m, 0, 1)
    # fade out before the head/body UV seam (under the jaw), so both sides of the seam show the same toned skin
    dseam = np.full(n, 1e9)
    for k0 in range(0, len(seam), 64):
        dseam = np.minimum(dseam, np.linalg.norm(pos[:, None] - co[seam[k0:k0 + 64]][None], axis=2).min(1))
    Af *= np.clip((dseam - 0.006) / 0.02, 0, 1)
    # below the jawline the references carry the under-jaw shadow (and a dark neck beard): no projection there.
    # Jawline (side view, y/z): from a little under the ear lobe to just under the chin; plus anything facing down
    # under the mouth. The skin there gets a light stubble tint of his beard colour instead, fading down the neck.
    def smooth(x, a, b):
        t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
    ea, ch = LM3['ear_r_low'], LM3['chin']
    Ay, Az = ea[1], ea[2] - FACE.get('jaw_drop_back', 0.015); By, Bz = ch[1], ch[2] - FACE.get('jaw_drop_chin', 0.004)
    t = np.clip((pos[:, 1] - By) / (Ay - By), 0, 1)
    below = (Bz + t * (Az - Bz)) - pos[:, 2]                # > 0: under the jawline
    down = smooth(-nrm[:, 2], FACE.get('jaw_down', [0.15, 0.5])[0], FACE.get('jaw_down', [0.15, 0.5])[1]) * smooth(LM3['stomion'][2] - pos[:, 2], 0.01, 0.025)
    J = np.maximum(smooth(below, -0.002, 0.012), down)
    Af *= 1 - J
    # his ginger stubble as its own layer (the projection only carries it where the photos saw it lit, and the jaw cut
    # removes the rest): chin and jaw under a line from the jaw angle (below the ear) to just under the mouth corner,
    # fading down the neck. Colour = the projected stubble there, held to a lit ginger-brown.
    mr_ = LM3['mouth_r']
    Sy, Sz = Ay - 0.012, ea[2] - FACE.get('beard_side_drop', 0.005)
    My, Mz = mr_[1] + 0.006, mr_[2] - FACE.get('beard_mouth_drop', 0.012)
    tb = np.clip((pos[:, 1] - My) / (Sy - My), 0, 1)
    zb = Mz + tb * (Sz - Mz)
    halfw = 0.5 * abs(LM3['mouth_l'][0] - LM3['mouth_r'][0])            # under the lower lip on the chin, not on it
    zb = np.minimum(zb, zb + (LM3['stomion'][2] - FACE.get('beard_lip_gap', 0.016) - zb) * (1 - smooth(np.abs(pos[:, 0]), halfw - 0.004, halfw + 0.008)))
    bm = smooth(zb - pos[:, 2], -0.004, 0.01) * (1 - smooth(below, 0.0, FACE.get('beard_neck', 0.03))) * (1 - smooth(pos[:, 1], Sy, Sy + 0.012))
    bm *= 1 - 0.45 * smooth(below, 0.0, 0.012)               # lighter on the neck
    bm *= np.clip((dseam - 0.004) / 0.015, 0, 1)
    beard = (bm > 0.7) & (below < -0.006) & (Af > 0.6)
    bcol = np.median(Cf[beard], 0) if beard.sum() > 50 else np.array([0.55, 0.36, 0.26])
    lb_ = bcol.mean(); bcol = bcol * np.clip(lb_, *FACE.get('beard_lum', [0.36, 0.44])) / max(lb_, 1e-3)
    if FACE.get('beard_rgb'): bcol = np.array(FACE['beard_rgb'])
    stub = bm
    print('   jaw mask: %d texels under the jawline, beard colour %s from %d texels' % (int((J > 0.5).sum()), None if bcol is None else np.round(bcol, 3), int(beard.sum())))
    COL = np.zeros((R * R, 3)); COL[idx] = Cf; COL = COL.reshape(R, R, 3)
    A0 = np.zeros(R * R); A0[idx] = Af; A0 = A0.reshape(R, R)
    # fill texels no view saw well with the nearby projected colour (push-pull), so feathering never pulls in black
    have = (A0 > 0.05).astype(np.float64)
    fill = COL * have[..., None]; fw = have.copy()
    for r in (2, 4, 8, 16, 32):
        hole = fw < 0.5
        bf = blur(COL * have[..., None], r); bw = blur(have, r)
        fill = np.where((hole & (bw > 1e-4))[..., None], bf / np.maximum(bw, 1e-6)[..., None], fill)
        fw = np.where(hole & (bw > 1e-4), 1.0, fw)
    COL = np.where(have[..., None] > 0, COL, fill)
    # nose: the references' nostril/alar shadows land on slightly different geometry and read as a dark smear;
    # lift anything much darker than its surroundings around the nose tip and under it
    NT = np.asarray(LM3['nose_tip'])
    dn = np.linalg.norm(pos - NT, axis=1)
    nzone = (1 - smooth(dn, FACE.get('nose_r', 0.022), FACE.get('nose_r', 0.022) + 0.014)) * (pos[:, 2] < NT[2] + 0.012)
    NZ = np.zeros(R * R); NZ[idx] = nzone; NZ = NZ.reshape(R, R)
    lum = COL.mean(-1); hv = np.maximum(have, 1e-6)
    lb = blur(lum * have, 7) / np.maximum(blur(have, 7), 1e-6)
    cb = blur(COL * have[..., None], 7) / np.maximum(blur(have, 7), 1e-6)[..., None]
    lift = np.clip((0.95 * lb - lum) / (0.25 * np.maximum(lb, 1e-3)), 0, 1) * NZ * FACE.get('nose_lift', 0.9)
    COL = COL + (cb * 1.0 - COL) * lift[..., None]
    print('   nose lift: %d texels in zone, mean lift %.2f' % (int((NZ > 0.5).sum()), float(lift[NZ > 0.5].mean()) if (NZ > 0.5).any() else 0))
    ST = np.zeros(R * R); ST[idx] = stub; ST = blur(ST.reshape(R, R), 2)
    # baked lighting: the references' shading on the forehead/temples/crown (terminator on his far temple, the bright
    # top light) lands as blotches. Above the brows keep only the detail (colour minus its local average) on his scalp
    # tone; everywhere, lift deep shadows to a floor relative to that tone (keeps the ginger stubble, drops the black)
    crown_t = (have > 0.5) & COV & (POS[..., 2] > LM3['eye_r_in'][2] + 0.045)
    T0 = np.median(COL[crown_t], 0) if crown_t.sum() > 100 else COL[have > 0.5].mean(0)
    up = smooth(POS[..., 2] - LM3['eye_r_in'][2], FACE.get('flat_from', [0.022, 0.05])[0], FACE.get('flat_from', [0.022, 0.05])[1]) * COV
    lowf = blur(COL * have[..., None], 14) / np.maximum(blur(have, 14), 1e-6)[..., None]
    COL = COL + (T0 - lowf) * (up * FACE.get('flatten', 0.9))[..., None]
    lum = COL.mean(-1); fl = FACE.get('shadow_floor', 0.6) * T0.mean()
    gain = np.where(lum < fl, fl / np.maximum(lum, 1e-3), 1.0)
    gain = 1 + (np.minimum(gain, 2.5) - 1) * COV
    COL = np.clip(COL * gain[..., None], 0, 1)
    print('   de-shade: scalp tone %s, %d texels flattened, %d lifted to the floor' % (np.round(T0, 3), int((up > 0.5).sum()), int(((gain > 1.02) & (have > 0.5)).sum())))
    # feather: erode a little, then blur (inside the UV islands)
    AL = np.clip(blur(A0, 2) * 1.3 - 0.3, 0, 1)
    AL = blur(AL, 3)
    # MPFB skin, toned to his colour (median over confident forehead/cheek texels, away from lips/beard)
    skin_mat = body.data.materials[0]
    src = skin_mat.node_tree.nodes.get('DiffuseTexture').image
    base_img = src.copy(); base_img.scale(R, R)
    bp = np.empty(R * R * 4, np.float32); base_img.pixels.foreach_get(bp); base = bp.reshape(R, R, 4)[..., :3]  # bottom-up like the UVs
    zone = (A0 > 0.9) & COV & (POS[..., 2] > LM3['eye_r_in'][2] + 0.02) & (np.abs(POS[..., 0]) < 0.05)
    tone = np.median(COL[zone], 0) / np.maximum(np.median(base[zone], 0), 1e-3)
    print('   skin tone gain', np.round(tone, 3), 'from', int(zone.sum()), 'texels')
    base_t = np.clip(base * tone, 0, 1)
    # on the head islands the MPFB map has painted scalp stubble (darker, browner: blurred and toned it left the back of
    # the head an orange cap); he is shaved bald, so the unprojected head is his own scalp tone: the median of the
    # projected upper forehead / crown, with the projection's own colour carried a little way past its edge
    crown = (A0 > 0.9) & COV & (POS[..., 2] > LM3['eye_r_in'][2] + 0.045)
    T = np.median(COL[crown], 0) * FACE.get('scalp_gain', 1.0)
    print('   scalp tone', np.round(T, 3), 'from', int(crown.sum()), 'texels')
    near = np.clip(blur(have, 20) * 1.6, 0, 1)[..., None]
    hb = T * (1 - near) + blur(COL * have[..., None], 20) / np.maximum(blur(have, 20), 1e-6)[..., None] * near
    base_t = np.where(COV[..., None], np.clip(hb, 0, 1), base_t)
    # the body island meets the head at a hard UV seam (under the jaw, round the nape): tone the body skin so its
    # colour next to the seam has the same median as the head's base tone there -> no band at the nape
    cand = np.where((ALL & ~COV).ravel() & (POSA.reshape(-1, 3)[:, 2] > co[seam, 2].min() - 0.05) & (POSA.reshape(-1, 3)[:, 2] < co[seam, 2].max() + 0.01))[0]
    pa = POSA.reshape(-1, 3)[cand].astype(np.float64); dn_ = np.full(len(cand), 1e9)
    for k0 in range(0, len(seam), 64):
        dn_ = np.minimum(dn_, np.linalg.norm(pa[:, None] - co[seam[k0:k0 + 64]][None], axis=2).min(1))
    neck = cand[(dn_ < 0.03) & (pa[:, 1] > 0)]                          # nape (behind the ears): where a band shows
    headside = (COV & (POS[..., 2] < co[seam, 2].max() + 0.03) & (POS[..., 1] > 0.02)).ravel() & (AL.ravel() < 0.1)
    if len(neck) > 100 and headside.sum() > 100:
        tgt = np.median(base_t.reshape(-1, 3)[headside], 0)
        gb = tgt / np.maximum(np.median(base_t.reshape(-1, 3)[neck], 0), 1e-3)
        base_t = np.where((ALL & ~COV)[..., None], np.clip(base_t * gb, 0, 1), base_t)
        print('   body re-tone at the seam: gain %s (%d neck texels)' % (np.round(gb, 3), len(neck)))
    out = base_t * (1 - AL[..., None]) + COL * AL[..., None]
    rng = np.random.default_rng(7)                          # stubble grain
    grain = blur(rng.random((R, R)), 1); grain = 0.55 + 0.45 * (grain - grain.min()) / max(np.ptp(grain), 1e-6)
    s_ = (ST * FACE.get('beard', 0.6) * (1 - FACE.get('beard_over_photo', 0.45) * AL) * grain)[..., None]
    out = out * (1 - s_) + np.clip(bcol, 0, 1) * s_
    # seam dilation: gutter texels (outside every UV triangle) take the colour of the island next to them
    isl = ALL.astype(np.float64); cc = out * isl[..., None]; cw = isl.copy()
    for _ in range(4):
        hole = cw < 1e-3
        sc = blur(cc, 1); sw = blur(cw, 1)
        cc = np.where(hole[..., None], sc, cc); cw = np.where(hole, sw, cw)
    out = np.where((~ALL & (cw > 1e-3))[..., None], cc / np.maximum(cw, 1e-6)[..., None], out)
    tex = P(FACE.get('tex', 'build/mpfb/vic_skin.png'))
    save_img(out[::-1], tex)                                # arrays here are bottom-up (UV space); save_img flips top-down
    save_img(np.stack([AL, ST, NZ], -1)[::-1], tex.replace('.png', '_mask.png'))     # R: projection, G: beard, B: nose lift
    print('TEX', tex)
    img = bpy.data.images.load(tex)
    skin_mat.node_tree.nodes.get('DiffuseTexture').image = img

def extra_views(tag):
    """fixed cameras round the head (his left 3/4 and profile, back 3/4, under the chin, top): the views no reference
    covers, where mirroring / toning / the jaw cut show."""
    tmp = tempfile.mkdtemp(prefix='vicface_x_')
    hc = 0.5 * (LM3['eye_r_out'] + LM3['eye_l_out']) + Vector((0, 0.06, -0.01))
    cd = bpy.data.cameras.new('xcam'); cd.lens = 85; cd.sensor_width = 36
    cam = bpy.data.objects.new('xcam', cd); scene.collection.objects.link(cam); scene.camera = cam
    tiles = []
    for nm, yaw, pitch in (('left34', -40, 3), ('leftprof', -80, 0), ('back34', 145, 8), ('chin', 15, -40), ('top', 0, 60)):
        r = math.radians(yaw); p = math.radians(pitch)
        d = Vector((math.sin(-r) * -1 * -1 if False else -math.sin(r), -math.cos(r), 0))      # yaw>0: to HIS right (-X)
        d = Vector((d.x * math.cos(p), d.y * math.cos(p), math.sin(p)))
        cam.location = hc + d * 0.95
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        right = d.cross(Vector((0, 0, 1))).normalized()
        for ln, v in (('key', -(d + 0.5 * right + Vector((0, 0, 0.5)))), ('fill', -(d - 0.8 * right)), ('top', Vector((0, 0, -1)))):
            bpy.data.objects[ln].rotation_euler = v.normalized().to_track_quat('-Z', 'Y').to_euler()
        scene.render.resolution_x = scene.render.resolution_y = 520; scene.render.resolution_percentage = 100
        fp = os.path.join(tmp, nm + '.png'); scene.render.filepath = fp; bpy.ops.render.render(write_still=True)
        tiles.append(load_img(fp)[..., :3])
    fp = os.path.join(OUTDIR, 'vic_compare_%s_extra.png' % tag); save_img(np.concatenate(tiles, 1), fp); print('EXTRA', fp)

if MODE == 'bake':
    bake()
compare_sheet(TAG)
if MODE == 'bake' or FACE.get('extra_views'):
    extra_views(TAG)
