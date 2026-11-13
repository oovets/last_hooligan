# THE LAST HOOLIGAN — MPFB2 character spike (Blender 5.x, headless): a realistic MakeHuman lad conformed to OUR skeleton.
#
#   Blender -b --factory-startup --python scripts/blender/char_mpfb.py -- [job.json]
#
# job.json (all optional): { "out": "assets/models/hero/m_mpfb.glb", "preview": "build/mpfb/preview.png", "tex": "build/mpfb/tex",
#                             "assets": {"hair": "short04", "brows": "eyebrow010", ...} (swap the MPFB asset used for a role; null drops it),
#                             "macro": {"weight": 0.9, ...} (MPFB macro sliders, merged over the defaults below),
#                             "targets": {"head-round": 0.5, "expression/units/caucasian/eye-left-slit": 0.3, ...} (extra MPFB targets:
#                                        file stem, or a path under MPFB's data/targets for ambiguous names),
#                             "eye_mat": "grey", "height": 1.78 (top of the skull, m),
#                             "skin_tex": "build/mpfb/vic_skin.png", "skin_mat": "skin_vic" (an authored skin map: used as is, and the
#                                        material is NOT named ID_1, so the runtime doesn't tint it),
#                             "tints": {"brows": "#b58a5c", ...} (preview colour of a palette part; the runtime LOOK replaces it),
#                             "meta": {"build": "h", "girth": 1.32, ...} (merged into rig['hooligan']),
#                             "cranium": {"strength": 0.9, "scale": [1.06, 1, 1]} (round the bald dome, see mpfb_shape.py),
#                             "xform": "build/mpfb/vic_xform.json" (write the raw -> exported transform),
#                             "badge": true, "badge_scale": 1.0 (the arm badge on the top's left sleeve, layer 'badge:arm'),
#                             "top_clear": [0.008, 0.04] (gap, reach in m: lift the top clear of the trousers),
#                             "hide_pants_under_top": true (delete the trousers where the top covers them: no poke-through) }
#   scripts/blender/vic.json is the Fat Vic hero job (its face map comes from scripts/blender/vic_face.py).
#
# Needs (one-off, see assets/models/CREDITS.md for what was downloaded):
#   Blender --command extension install-file -r user_default -e add-on-mpfb-v2.0.18.zip
#   Blender -b --factory-startup --python scripts/blender/mpfb_install_packs.py -- <asset pack zips>
# --factory-startup keeps the run reproducible (no user prefs / startup file). It also disables every add-on, so MPFB is
# enabled explicitly below with addon_utils.enable(..., default_set=True) (default_set is required: MPFB reads its own
# preferences from bpy.context.preferences.addons and raises if it isn't registered there).
#
# Pipeline:
#   1. MPFB builds the human: macro sliders, game_engine rig (BEFORE clothes so clothes get rig weights), body parts,
#      clothes (subdiv 0, delete groups hide the body under them), GAMEENGINE skin; bake_modifiers_remove_helpers
#   2. rest pose: arms lowered into our relaxed A-pose (upper arm ~17 deg from vertical), palms to the thighs, hands
#      curled into loose fists; the posed shape is applied to every mesh (armature modifier applied)
#   3. scale/ground: soles at z=0, top of the skull at 1.78 m, facing -Y
#   4. weights merged into OUR bone names (root, hips, spine, chest, neck, head, shoulder/upperArm/forearm/hand,
#      thigh/shin/foot/toe), MPFB rig deleted, our rig built at the MPFB joint positions with char_v2's roll rule
#   5. materials: ID_<n> for palette-tinted parts (base maps neutralised so the runtime tint gives the LOOK colour),
#      authored names for eyes/lashes/teeth; textures <= 1024 px (JPEG, PNG where alpha is needed)
#   6. Draco glTF export (same options as char_v2.py), then an EEVEE preview sheet

import bpy, addon_utils, os, sys, json, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
JOB = json.load(open(argv[0])) if argv else {}
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def P(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)
OUT = P(JOB.get('out', 'assets/models/hero/m_mpfb.glb'))
PREVIEW = JOB.get('preview', 'build/mpfb/preview.png')
TEXDIR = P(JOB.get('tex', 'build/mpfb/tex'))
HEIGHT = JOB.get('height', 1.78)                  # top of the skull (soles at 0), like char_v2's headTop

bpy.ops.wm.read_factory_settings(use_empty=True)
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services import HumanService, ExportService, LocationService, TargetService

scene = bpy.context.scene
UD = LocationService.get_user_data()
def asset(sub, name, ext='.mhclo'): return os.path.join(UD, sub, name, name + ext)

# ------------------------------------------------------------------ 1. MPFB human
MACRO = {'gender': 1.0, 'age': 0.5, 'muscle': 0.62, 'weight': 0.55, 'proportions': 0.6, 'height': 0.55, 'cupsize': 0.5, 'firmness': 0.5,
         'race': {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0}}      # adult (25) male, medium/athletic build
MACRO.update(JOB.get('macro', {}))
PARTS = [  # role, asset subdir, asset name, MPFB asset type
    ('eyes', 'eyes', 'low-poly', 'Eyes'),
    ('brows', 'eyebrows', 'eyebrow010', 'Eyebrows'),
    ('lashes', 'eyelashes', 'eyelashes01', 'Eyelashes'),
    ('teeth', 'teeth', 'teeth_base', 'Teeth'),
    ('hair', 'hair', 'short01', 'Hair'),
    ('top', 'clothes', 'namuhekam_male_polo_shirt', 'Clothes'),
    ('pants', 'clothes', 'punkduck_male_classic_jeans', 'Clothes'),
    ('shoes', 'clothes', 'punkduck_running_shoes_01', 'Clothes'),
]
PARTS = [(r, sub, JOB.get('assets', {}).get(r, n), t) for r, sub, n, t in PARTS]     # job may swap assets per role
PARTS = [p for p in PARTS if p[2]]                                                     # ... or drop one (null)
SKIN = ('skins', JOB.get('assets', {}).get('skin', 'young_caucasian_male'))
EYE_MAT = JOB.get('eye_mat', 'brown')

def target_path(name):
    """A target by file stem (MPFB's own lookup) or by a path under MPFB's data/targets (expression units exist per race)."""
    if '/' in name:
        p = os.path.join(LocationService.get_mpfb_data('targets'), name + ('' if name.endswith('.gz') else '.target.gz'))
        return p if os.path.exists(p) else None
    return TargetService.target_full_path(name)

body = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True,
                                 scale=0.1, macro_detail_dict=MACRO)          # scale 0.1: MakeHuman decimetres -> metres
for tname, tw in JOB.get('targets', {}).items():      # extra shape targets (face/body detail) before rig + clothes fitting
    tp = target_path(tname)
    if not tp: raise SystemExit('unknown MPFB target ' + tname)
    TargetService.load_target(body, tp, weight=tw)
if JOB.get('cranium'):                                 # a round bald dome (scripts/blender/mpfb_shape.py), before rig + clothes
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mpfb_shape
    mpfb_shape.sculpt_cranium(body, JOB['cranium'])
mrig = HumanService.add_builtin_rig(body, 'game_engine', import_weights=True)   # before clothes, so they get weights
OBJ = {'body': body}
for role, sub, name, typ in PARTS:
    OBJ[role] = HumanService.add_mhclo_asset(asset(sub, name), body, asset_type=typ, subdiv_levels=0, material_type='GAMEENGINE')
HumanService.set_character_skin(asset(*SKIN, ext='.mhmat'), body, skin_type='GAMEENGINE')
ExportService.bake_modifiers_remove_helpers(body, bake_masks=True, bake_subdiv=False, remove_helpers=True)

def tri_count(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)
def apply_mod(ob, name):
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=name)

for role, ob in OBJ.items():
    if ob.data.shape_keys:                                      # macro targets: keep the mix, drop the keys
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for m in list(ob.modifiers):
        if m.type != 'ARMATURE': ob.modifiers.remove(m)

# ------------------------------------------------------------------ 2. rest pose: relaxed A-pose arms, loose fists
pb = mrig.pose.bones
RW = mrig.matrix_world
def wpos(bn, tail=False):
    b = pb[bn]; return RW @ (b.tail if tail else b.head)
def wdir(bn): return (wpos(bn, True) - wpos(bn)).normalized()
def rotate_about_head(bn, R3):
    """Rotate a pose bone (and so its children) about its head by world-space rotation R3."""
    b = pb[bn]
    Ra = (RW.to_3x3().inverted() @ R3 @ RW.to_3x3()).to_4x4()
    h = b.head.copy()
    b.matrix = Matrix.Translation(h) @ Ra @ Matrix.Translation(-h) @ b.matrix
    bpy.context.view_layer.update()
def aim(bn, d):
    rotate_about_head(bn, wdir(bn).rotation_difference(d.normalized()).to_matrix())
def twist(bn, axis, ang):
    rotate_about_head(bn, Matrix.Rotation(ang, 3, axis.normalized()))
def signed_angle(a, b, axis):
    return math.atan2(axis.normalized().dot(a.cross(b)), a.dot(b))

# char_v2's joints for the m build (relaxed A-pose): upperArm (.20,.02,1.36) -> forearm (.28,.04,1.10) -> hand (.32,0,.87) -> handEnd (.34,-.01,.76)
for sg, s in ((1, 'l'), (-1, 'r')):
    aim('upperarm_' + s, Vector((sg * 0.08, 0.02, -0.26)))
    aim('lowerarm_' + s, Vector((sg * 0.04, -0.04, -0.23)))
    aim('hand_' + s, Vector((sg * 0.02, -0.01, -0.11)))
    # palms to the thighs, thumbs forward: index->pinky knuckle line should run backwards (+Y). Half the twist in the
    # forearm, the rest in the wrist, so neither candy-wraps.
    for bn, part in (('lowerarm_' + s, 0.5), ('hand_' + s, 1.0)):
        d = wdir('hand_' + s)
        across = wpos('pinky_01_' + s) - wpos('index_01_' + s); across -= d * across.dot(d)
        want = Vector((0, 1, 0)); want -= d * want.dot(d)
        twist(bn, d, signed_angle(across, want, d) * part)
    # loose fist: curl each finger toward the palm (palm faces the body: -X on the left, +X on the right)
    palm_n = Vector((-sg, 0, 0))
    for f in ('index', 'middle', 'ring', 'pinky'):
        for seg, ang in zip(('01', '02', '03'), (68, 92, 62)):
            bn = '%s_%s_%s' % (f, seg, s)
            twist(bn, wdir(bn).cross(palm_n), math.radians(ang))
    # thumb: tuck the metacarpal toward the palm, then lay the thumb across the curled index/middle fingers
    twist('thumb_01_' + s, wdir('thumb_01_' + s).cross(palm_n), math.radians(18))
    aim('thumb_02_' + s, wpos('index_02_' + s) + palm_n * 0.012 - wpos('thumb_02_' + s))
    aim('thumb_03_' + s, wpos('middle_02_' + s) + palm_n * 0.014 - wpos('thumb_03_' + s))

# joint positions from the posed MPFB rig (world space; transformed with the meshes in step 3)
JM = {'root': Vector((0, 0, 0))}
for s, sm in (('L', 'l'), ('R', 'r')):
    JM.update({'shoulder_' + s: wpos('clavicle_' + sm), 'upperArm_' + s: wpos('upperarm_' + sm), 'forearm_' + s: wpos('lowerarm_' + sm),
               'hand_' + s: wpos('hand_' + sm), 'handEnd_' + s: wpos('middle_01_' + sm),
               'thigh_' + s: wpos('thigh_' + sm), 'shin_' + s: wpos('calf_' + sm), 'foot_' + s: wpos('foot_' + sm),
               'toe_' + s: wpos('ball_' + sm), 'toeEnd_' + s: wpos('ball_' + sm, True)})
JM.update({'hips': wpos('pelvis'), 'spine': wpos('spine_01'), 'chest': wpos('spine_03'), 'neck': wpos('neck_01'),
           'head': wpos('head'), 'headTop': wpos('head', True)})

# bake the pose into the meshes, then drop the MPFB rig
for ob in OBJ.values():
    arm = next((m for m in ob.modifiers if m.type == 'ARMATURE'), None)
    if arm: apply_mod(ob, arm.name)
    mw = ob.matrix_world.copy(); ob.parent = None; ob.data.transform(mw); ob.matrix_world = Matrix.Identity(4)
bpy.data.objects.remove(mrig, do_unlink=True)
# teeth come at ~7k triangles for something you barely see: decimate (they ride the head bone only anyway)
dc = OBJ['teeth'].modifiers.new('dc', 'DECIMATE'); dc.ratio = 900 / max(1, tri_count(OBJ['teeth']))
bpy.context.view_layer.update(); apply_mod(OBJ['teeth'], 'dc')

# ------------------------------------------------------------------ 3. ground + scale
allz = [v.co.z for ob in OBJ.values() for v in ob.data.vertices]
zmin = min(allz)
ztop = max(v.co.z for v in OBJ['body'].data.vertices)
S = HEIGHT / (ztop - zmin)
T = Matrix.Scale(S, 4) @ Matrix.Translation((0, 0, -zmin))
for ob in OBJ.values(): ob.data.transform(T)
J = {k: T @ v for k, v in JM.items()}
J['root'] = Vector((0, 0, 0))
print('SCALE %.4f (raw height %.3f m, sole %.3f)' % (S, ztop - zmin, zmin))
if JOB.get('xform'):          # raw MPFB space -> exported space (vic_sheet.py puts vic_face.py's fitted cameras on the glb)
    os.makedirs(os.path.dirname(P(JOB['xform'])), exist_ok=True)
    json.dump({'scale': S, 'zmin': zmin}, open(P(JOB['xform']), 'w'))

# the jeans' waistband and belt loops poke through the polo's hem: lift the top clear of the trousers (8 mm)
def clear_of(outer, inner, gap=0.008, reach=0.04):
    from mathutils.bvhtree import BVHTree
    import bmesh
    bmi = bmesh.new(); bmi.from_mesh(inner.data); bvh = BVHTree.FromBMesh(bmi); bmi.free()
    moved = 0
    for v in outer.data.vertices:
        hit = bvh.find_nearest(v.co, reach)
        if hit[0] is None: continue
        p, n = hit[0], hit[1]
        d = (v.co - p).dot(n)
        if d < gap: v.co += n * (gap - d); moved += 1
    return moved

def hide_under(inner, outer, slack=0.03, margin=0.06):
    """Delete the trousers where the top covers them (belt loops and waistband poke through a loose untucked shirt, and
    thin loops can't be pushed back: their normals point sideways). A trouser vertex goes when a ray from the body axis
    out through it meets the top no more than slack inside it, at its height AND margin lower (so it's well above the
    hem: the trousers below the shirt-tail stay whole)."""
    from mathutils.bvhtree import BVHTree
    import bmesh
    bmo = bmesh.new(); bmo.from_mesh(outer.data); bvh = BVHTree.FromBMesh(bmo); bmo.free()
    tv = np.array([v.co[:] for v in outer.data.vertices])
    def centre(z):
        band = tv[np.abs(tv[:, 2] - z) < 0.03]
        return Vector((band[:, 0].mean(), band[:, 1].mean(), z)) if len(band) else None
    def covered(co):
        c = centre(co.z)
        if c is None: return False
        d = co - c; d.z = 0
        r = d.length
        if r < 1e-4: return False
        d /= r
        hit = bvh.ray_cast(c, d, r + 0.3)
        return hit[0] is not None and hit[3] >= r - slack
    bm = bmesh.new(); bm.from_mesh(inner.data)
    gone = [v for v in bm.verts if covered(v.co) and covered(v.co - Vector((0, 0, margin)))]
    bmesh.ops.delete(bm, geom=gone, context='VERTS')
    bm.to_mesh(inner.data); bm.free(); inner.data.update()
    return len(gone)
if JOB.get('hide_pants_under_top'):
    print('PANTS HIDDEN UNDER TOP', hide_under(OBJ['pants'], OBJ['top']), 'verts')
TG = JOB.get('top_clear', [0.008, 0.04])           # (gap, reach) m: a loose untucked shirt needs a little more
print('TOP LIFTED', clear_of(OBJ['top'], OBJ['pants'], TG[0], TG[1]), 'verts')

# the arm badge (job "badge": true): a UV-mapped patch hugging the top's left sleeve, like char_v2's (layer 'badge:arm',
# material ID_24: the runtime draws the design, characters2.js badgeTexture). Rides the upper arm only.
if JOB.get('badge'):
    from mathutils.bvhtree import BVHTree
    import bmesh
    bmt = bmesh.new(); bmt.from_mesh(OBJ['top'].data); bvh_top = BVHTree.FromBMesh(bmt); bmt.free()
    FRONT = Vector((0, -1, 0))
    ua, fa = J['upperArm_L'], J['forearm_L']; d_ = (fa - ua).normalized()
    def on_sleeve(axis_pt, out_dir, lift):
        """Cast from outside the sleeve back toward the arm axis: the outermost point of the top, lifted along its normal."""
        hit = bvh_top.ray_cast(axis_pt + out_dir * 0.25, -out_dir, 0.25)
        if hit[0] is None: return None
        n = hit[1] if hit[1].dot(out_dir) > 0 else -hit[1]
        return hit[0] + n * lift, n
    lat = Vector((1, 0, 0)); lat = (lat - d_ * lat.dot(d_)).normalized()
    out_ = (lat + FRONT * 0.12).normalized()
    h = on_sleeve(ua.lerp(fa, 0.3), out_, 0.0035)
    if not h: raise SystemExit('badge: no sleeve under the left upper arm')
    p, nrm = h; up = -d_; across = up.cross(nrm).normalized(); up = nrm.cross(across).normalized()
    BW, BH, COLS, ROWS = 0.1 * JOB.get('badge_scale', 1.0), 0.05 * JOB.get('badge_scale', 1.0), 10, 2
    bmq = bmesh.new(); uvl = bmq.loops.layers.uv.new('UVMap'); grid = {}
    for i in range(COLS + 1):
        for j in range(ROWS + 1):
            q = p + across * (i / COLS - 0.5) * BW + up * (j / ROWS - 0.5) * BH
            t = max(0.0, min(1.0, (q - ua).dot(fa - ua) / (fa - ua).length_squared)); axis = ua.lerp(fa, t)
            o2 = q - axis; o2 = (o2 - d_ * o2.dot(d_)).normalized()
            hq = on_sleeve(axis, o2, 0.0035)
            grid[i, j] = (bmq.verts.new(hq[0] if hq else q), (i / COLS, j / ROWS))
    for i in range(COLS):
        for j in range(ROWS):
            quad = [grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]]
            f = bmq.faces.new([q[0] for q in quad])
            for loop, (_, uv) in zip(f.loops, quad): loop[uvl].uv = uv
    bm_mesh = bpy.data.meshes.new('badge'); bmq.to_mesh(bm_mesh); bmq.free()
    for poly in bm_mesh.polygons: poly.use_smooth = True
    ob_b = bpy.data.objects.new('badge', bm_mesh); scene.collection.objects.link(ob_b)
    OBJ['badge'] = ob_b
    print('BADGE at', tuple(round(x, 3) for x in p))

# three stripes on the trainers (job "shoe_stripes": true): on both sides of each shoe, slanting back from the laces to
# the sole, plus a heel tab. Material ID_23 (look.shoes.stripe), layer 'shoes:stripes', each shoe's stripes ride its foot.
SOLE_H = JOB.get('sole_h')                         # (m) the sole's top edge: faces below get their own material (ID_10)
if JOB.get('shoe_stripes'):
    from mathutils.bvhtree import BVHTree
    import bmesh
    sh = OBJ['shoes']; SV = [v.co.copy() for v in sh.data.vertices]
    sole_top = SOLE_H or 0.025
    for sg, side_ in ((1, 'L'), (-1, 'R')):
        polys = [list(pl.vertices) for pl in sh.data.polygons if sum(SV[i].x for i in pl.vertices) * sg > 0]
        bvh = BVHTree.FromPolygons(SV, polys)
        fv = [SV[i] for pl in polys for i in pl]
        xc = sum(v.x for v in fv) / len(fv)
        y0, y1 = min(v.y for v in fv), max(v.y for v in fv); zt = max(v.z for v in fv); Lg = y1 - y0
        W = Lg * 0.034; z_top = min(zt * 0.78, 0.085)
        bms = bmesh.new()
        def ribbon(pts_dirs, width):
            """pts_dirs: [(point near the surface, direction to cast along)] -> a strip on the shoe, width wide."""
            hits = []
            for q, d in pts_dirs:
                h = bvh.ray_cast(q - d * 0.2, d, 0.4)
                if h[0] is not None: hits.append((h[0], h[1] if h[1].dot(d) < 0 else -h[1]))
            if len(hits) < 3: return 0
            row = []
            for i, (pp, nn) in enumerate(hits):
                t = (hits[min(i + 1, len(hits) - 1)][0] - hits[max(i - 1, 0)][0]).normalized()
                w = nn.cross(t).normalized()
                row.append((bms.verts.new(pp + w * width / 2 + nn * 0.0016), bms.verts.new(pp - w * width / 2 + nn * 0.0016), nn))
            for i in range(len(row) - 1):
                a, b = row[i], row[i + 1]
                f = bms.faces.new((a[0], b[0], b[1], a[1]))
                f.normal_update()
                if f.normal.dot(a[2]) < 0: f.normal_flip()
            return 1
        made = 0
        for out in (sg, -sg):                      # outer side, then inner side
            d = Vector((-out, 0, 0))
            for k in range(3):
                ya, yb = y0 + Lg * (0.40 + 0.075 * k), y0 + Lg * (0.53 + 0.075 * k)
                pts = [(Vector((xc, ya + (yb - ya) * i / 9, z_top + (sole_top + 0.004 - z_top) * i / 9)), d) for i in range(10)]
                made += ribbon(pts, W)
        made += ribbon([(Vector((xc, y1, sole_top + 0.006 + (zt * 0.9 - sole_top) * i / 7)), Vector((0, -1, 0))) for i in range(8)], Lg * 0.085)   # heel tab
        me_s = bpy.data.meshes.new('stripes_' + side_); bms.to_mesh(me_s); bms.free()
        ob_s = bpy.data.objects.new('stripes_' + side_, me_s); scene.collection.objects.link(ob_s)
        OBJ['stripes_' + side_] = ob_s
        print('SHOE STRIPES', side_, made, 'strips')

# ------------------------------------------------------------------ 4. weights -> our bone names, our rig
def our_bone(g):
    fixed = {'Root': 'root', 'pelvis': 'hips', 'spine_01': 'spine', 'spine_02': 'spine', 'spine_03': 'chest', 'neck_01': 'neck', 'head': 'head'}
    if g in fixed: return fixed[g]
    if g[-2:] not in ('_l', '_r'): return None
    s = g[-1].upper(); base = g[:-2]
    if base.startswith(('thumb', 'index', 'middle', 'ring', 'pinky')): return 'hand_' + s
    m = {'clavicle': 'shoulder', 'upperarm': 'upperArm', 'lowerarm': 'forearm', 'hand': 'hand', 'thigh': 'thigh', 'calf': 'shin',
         'foot': 'foot', 'ball': 'toe'}.get(base)
    return m + '_' + s if m else None

def conform_weights(ob, force=None):
    names = {g.index: g.name for g in ob.vertex_groups}
    per_v = []
    orphans = 0
    for v in ob.data.vertices:
        w = {}
        if force: w[force] = 1.0
        else:
            for g in v.groups:
                t = our_bone(names.get(g.group, ''))
                if t and g.weight > 0: w[t] = w.get(t, 0.0) + g.weight
        tot = sum(w.values())
        if tot < 1e-6:
            orphans += 1; w = {'hips': 1.0}; tot = 1.0
        per_v.append({k: x / tot for k, x in w.items()})
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    groups = {}
    for i, w in enumerate(per_v):
        for k, x in w.items():
            if x < 1e-4: continue
            g = groups.get(k) or groups.setdefault(k, ob.vertex_groups.new(name=k))
            g.add([i], x, 'REPLACE')
    return orphans

FORCE_HEAD = ('eyes', 'brows', 'lashes', 'teeth', 'hair')       # everything on the head rides the head bone only
for role, ob in OBJ.items():
    n = conform_weights(ob, 'head' if role in FORCE_HEAD else 'upperArm_L' if role == 'badge' else 'foot_' + role[-1] if role.startswith('stripes_') else None)
    if n: print('WARN %s: %d unweighted verts -> hips' % (role, n))

BONES = [('root', 'root', None, None), ('hips', 'hips', 'spine', 'root'), ('spine', 'spine', 'chest', 'hips'),
         ('chest', 'chest', 'neck', 'spine'), ('neck', 'neck', 'head', 'chest'), ('head', 'head', 'headTop', 'neck')]
for s in ('L', 'R'):
    BONES += [('shoulder_' + s, 'shoulder_' + s, 'upperArm_' + s, 'chest'), ('upperArm_' + s, 'upperArm_' + s, 'forearm_' + s, 'shoulder_' + s),
              ('forearm_' + s, 'forearm_' + s, 'hand_' + s, 'upperArm_' + s), ('hand_' + s, 'hand_' + s, 'handEnd_' + s, 'forearm_' + s),
              ('thigh_' + s, 'thigh_' + s, 'shin_' + s, 'hips'), ('shin_' + s, 'shin_' + s, 'foot_' + s, 'thigh_' + s),
              ('foot_' + s, 'foot_' + s, 'toe_' + s, 'shin_' + s), ('toe_' + s, 'toe_' + s, 'toeEnd_' + s, 'foot_' + s)]

arm_d = bpy.data.armatures.new('rig')
rig = bpy.data.objects.new('rig', arm_d); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for name, a, b, parent in BONES:
    bone = arm_d.edit_bones.new(name)
    bone.head = J[a]
    bone.tail = J[b] if b else J[a] + Vector((0, 0.15, 0))
    if parent: bone.parent = eb[parent]; bone.use_connect = False
    eb[name] = bone
for name, bone in eb.items():       # char_v2 roll rule: local Z forward (-Y), feet/toes local Z up
    bone.align_roll(Vector((0, -1, 0)) if not name.startswith(('foot', 'toe')) else Vector((0, 0, 1)))
bpy.ops.object.mode_set(mode='OBJECT')

def strip_props(idb):
    """Drop custom props and (Blender 5+) the stored values of add-on RNA props, which glTF also exports as extras."""
    for k in list(idb.keys()): del idb[k]
    sp = idb.bl_system_properties_get() if hasattr(idb, 'bl_system_properties_get') else None
    if sp is not None:
        for k in list(sp.keys()): del sp[k]

NAMES = {'body': 'body', 'eyes': 'eyes', 'brows': 'eyebrows', 'lashes': 'eyelashes', 'teeth': 'teeth', 'hair': 'hair',
         'top': 'top', 'pants': 'pants', 'shoes': 'shoes', 'badge': 'badge', 'stripes_L': 'shoeStripesL', 'stripes_R': 'shoeStripesR'}
TAGS = {'hair': 'acc:hair:crop', 'badge': 'acc:badge:arm', 'stripes_L': 'acc:shoes:stripes', 'stripes_R': 'acc:shoes:stripes'}   # shown only for LOOKs with hair / a badge / striped trainers
for role, ob in OBJ.items():
    strip_props(ob)                              # MPFB bookkeeping props would leak into glTF extras
    ob.name = ob.data.name = NAMES[role]
    ob['tags'] = TAGS.get(role, ''); ob['bone'] = 'head' if role in FORCE_HEAD else 'upperArm_L' if role == 'badge' else 'foot_' + role[-1] if role.startswith('stripes_') else ''
    ob.parent = rig
    md = ob.modifiers.new('arm', 'ARMATURE'); md.object = rig

# ------------------------------------------------------------------ 5. materials + textures
def srgb_to_lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def hexlin(h): return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1.0,)
# role -> (material name, palette id or None, preview colour = sprites.js default palette, texture cap px, alpha, roughness)
MAT = {
    'body': ('ID_1', 1, '#e2a97a', 1024, False, 0.55),
    'hair': ('ID_2', 2, '#3a2717', 512, True, 0.6),
    'brows': ('ID_18', 18, '#352415', 256, True, 0.7),
    'top': ('ID_3', 3, '#2b3a2a', 1024, False, 0.85),
    'pants': ('ID_7', 7, '#34507a', 1024, False, 0.85),
    'shoes': ('ID_9', 9, '#f2f2ee', 512, False, 0.6),
    'eyes': ('eye_' + EYE_MAT, None, None, 256, False, 0.12),
    'lashes': ('eyelashes', None, None, 256, True, 0.7),
    'teeth': ('teeth', None, None, 256, False, 0.35),
}
for role, hx in JOB.get('tints', {}).items():      # preview / baseColorFactor colour of a palette part (the LOOK overrides it)
    if role in MAT: MAT[role] = MAT[role][:2] + (hx,) + MAT[role][3:]     # ('stripes', 'sole': used where those are built)
SKIN_TEX = JOB.get('skin_tex')
if SKIN_TEX:            # authored skin (a projected likeness): keep its colour, and keep it out of the ID_ tint path
    MAT['body'] = (JOB.get('skin_mat', 'skin'), None, None, 1024, False, 0.55)
    assert not MAT['body'][0].startswith('ID_')
os.makedirs(TEXDIR, exist_ok=True)

def img_array(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32); img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)

NEUTRAL_MEAN = 0.86       # target mean of a neutralised base map (sRGB): the runtime tint then lands near the LOOK colour

def neutralise(px, alpha):
    """Make a base map palette-tintable: grey on average (keeps relative hue: lips, stitching, denim weave), bright.
    Maps with bright detail (white seams, laces, denim highlights) can't simply be scaled up: their brightest texels cap
    the gain and the mean stays dark (jeans came out at 0.4, trainers at 0.2, so the LOOK tint rendered near black).
    So: scale the 99.5th percentile to white, then lift the mids with a gamma curve until the mean hits NEUTRAL_MEAN
    (whites stay white, darks open up, the weave survives)."""
    rgb = px[..., :3]; mask = px[..., 3] > 0.5 if alpha else np.ones(rgb.shape[:2], bool)
    if mask.sum() < 16: return px
    mean = rgb[mask].mean(0)
    if mean.max() < 0.003:                # a pure-black map (some brows): only its alpha carries detail -> flat white
        px[..., :3] = 0.9; return px
    rgb = rgb / np.maximum(mean, 1e-3) * mean.mean()
    lum = rgb.mean(-1)[mask]
    rgb = np.clip(rgb * min(1.0 / max(np.percentile(lum, 99.5), 1e-3), NEUTRAL_MEAN / max(lum.mean(), 1e-3)), 0, 1)
    lum = rgb.mean(-1)[mask]
    if lum.mean() < NEUTRAL_MEAN - 0.01:  # gamma < 1 lifts the mids: bisect for the exponent that gives the target mean
        sample = lum[:: max(1, lum.size // 200000)]
        lo, hi = 0.05, 1.0
        for _ in range(30):
            g = 0.5 * (lo + hi)
            if (sample ** g).mean() > NEUTRAL_MEAN: lo = g
            else: hi = g
        rgb = rgb ** (0.5 * (lo + hi))
    px[..., :3] = rgb
    return px

def process_image(img, cap, tag, alpha, neutral, is_data=False):
    w, h = img.size
    sc = min(1.0, cap / max(w, h))
    new = img.copy(); new.name = tag
    if sc < 1: new.scale(max(1, int(w * sc)), max(1, int(h * sc)))
    px = img_array(new)
    if neutral: px = neutralise(px, alpha)
    out = bpy.data.images.new(tag, new.size[0], new.size[1], alpha=alpha)
    out.pixels.foreach_set(px.ravel())
    ext = '.png' if alpha else '.jpg'
    fp = os.path.join(TEXDIR, tag + ext)
    out.filepath_raw = fp; out.file_format = 'PNG' if alpha else 'JPEG'
    out.save(filepath=fp, quality=88)
    bpy.data.images.remove(out); bpy.data.images.remove(new)
    res = bpy.data.images.load(fp); res.name = tag
    if is_data: res.colorspace_settings.name = 'Non-Color'
    return res

if 'badge' in OBJ:      # untextured ID_24: the runtime swaps in its own felt badge texture (preview: plain black felt)
    bm_mat = bpy.data.materials.new('ID_24'); bm_mat.use_nodes = True
    bb = bm_mat.node_tree.nodes['Principled BSDF']
    bb.inputs['Base Color'].default_value = (0.012, 0.012, 0.014, 1); bb.inputs['Roughness'].default_value = 0.92
    OBJ['badge'].data.materials.append(bm_mat)
for sd in ('L', 'R'):   # untextured ID_23: the runtime colours the stripes with look.shoes.stripe
    if 'stripes_' + sd in OBJ:
        st_mat = bpy.data.materials.get('ID_23') or bpy.data.materials.new('ID_23'); st_mat.use_nodes = True
        sb = st_mat.node_tree.nodes['Principled BSDF']
        sb.inputs['Base Color'].default_value = hexlin(JOB.get('tints', {}).get('stripes', '#f2f2ee')); sb.inputs['Roughness'].default_value = 0.6
        OBJ['stripes_' + sd].data.materials.append(st_mat)
for role, ob in OBJ.items():
    if role == 'badge' or role.startswith('stripes_'): continue
    mname, pid, prev, cap, alpha, rough = MAT[role]
    m = ob.data.materials[0]
    strip_props(m)
    m.name = mname
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = rough
    for ln in list(L):                                           # rebuild alpha + colour wiring
        if ln.to_node == bsdf and ln.to_socket.name in ('Alpha', 'Base Color'): L.remove(ln)
    diff = N.get('DiffuseTexture')
    if role == 'body' and SKIN_TEX:
        diff.image = bpy.data.images.load(P(SKIN_TEX))
    if role == 'eyes':      # MPFB's eye mhclo defaults may not be the colour we want: load the chosen iris map
        src = bpy.data.images.load(os.path.join(UD, 'eyes', 'materials', EYE_MAT + '_eye.png'))
        diff.image = src
    diff.image = process_image(diff.image, cap, mname.replace(':', '_') + '_base', alpha, neutral=pid is not None)
    if pid is not None:     # base map x palette colour (glTF baseColorFactor; the runtime swaps in the LOOK colour)
        mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = hexlin(prev)
        L.new(diff.outputs['Color'], mix.inputs[6]); L.new(mix.outputs[2], bsdf.inputs['Base Color'])
        m.diffuse_color = hexlin(prev)
    else:
        L.new(diff.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha:               # alpha clip (glTF MASK, cutoff 0.5): sorts cleanly in three.js
        rnd = N.new('ShaderNodeMath'); rnd.operation = 'ROUND'
        L.new(diff.outputs['Alpha'], rnd.inputs[0]); L.new(rnd.outputs[0], bsdf.inputs['Alpha'])
    nrm = N.get('NormalMapTextue')
    if nrm is not None:
        if nrm.image is not None:
            nrm.image = process_image(nrm.image, 512, mname + '_normal', False, neutral=False, is_data=True)
        else:
            N.remove(nrm)
            for n in [n for n in N if n.type == 'NORMAL_MAP']: N.remove(n)
    for n in [n for n in N if n.type == 'TEX_IMAGE' and n.image is None]: N.remove(n)
    alpha_tex = N.get('AlphaMapTexture')
    if alpha_tex is not None: N.remove(alpha_tex)

if SOLE_H:   # the sole (job "sole_h", m): the shoe faces below it get a copy of the trainer material named ID_10 (look.shoes.sole)
    shm = OBJ['shoes'].data; m9 = shm.materials[0]; m10 = m9.copy(); m10.name = 'ID_10'
    for nd in m10.node_tree.nodes:
        if nd.type == 'MIX' and nd.data_type == 'RGBA': nd.inputs[7].default_value = hexlin(JOB.get('tints', {}).get('sole', '#b9a27a'))
    shm.materials.append(m10)
    n_sole = 0
    for pl in shm.polygons:
        if pl.center.z < SOLE_H: pl.material_index = 1; n_sole += 1
    print('SOLE', n_sole, 'faces')

# ------------------------------------------------------------------ 6. export
HC = sum((v.co for v in OBJ['eyes'].data.vertices), Vector()) / len(OBJ['eyes'].data.vertices) + Vector((0, 0.07, 0.03))
rows = sorted(((tri_count(o), o.name) for o in OBJ.values()), reverse=True)
print('TRIS total %d | %s' % (sum(r[0] for r in rows), ', '.join('%s %d' % (n, t) for t, n in rows)))
print('JOINTS', {k: tuple(round(x, 3) for x in J[k]) for k in ('hips', 'chest', 'neck', 'head', 'headTop', 'upperArm_L', 'forearm_L', 'hand_L', 'handEnd_L', 'thigh_L', 'shin_L', 'foot_L', 'toe_L')})

META = {'v': 3, 'build': 'm', 'torso': 'tee', 'girth': 1.0, 'height': 1.0, 'headCentre': [round(x, 4) for x in HC], 'headScale': 1.0}
META.update(JOB.get('meta', {})); META['source'] = 'mpfb2'
rig['hooligan'] = json.dumps(META)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_yup=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10)
print('EXPORTED %s (%.0f KB)' % (OUT, os.path.getsize(OUT) / 1024))

# ------------------------------------------------------------------ 7. preview sheet (EEVEE): full body 3/4, side, head close-up
def preview(path):
    import tempfile
    from mathutils import Euler
    def link(o): scene.collection.objects.link(o); return o
    cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'
    cam = link(bpy.data.objects.new('cam', cam_d)); scene.camera = cam
    for nm, en, rx, rz in (('sun', 3.2, 50, -30), ('fill', 0.9, 65, 150), ('rim', 1.4, 70, 200)):
        ld = bpy.data.lights.new(nm, 'SUN'); ld.energy = en; ld.angle = math.radians(8)
        link(bpy.data.objects.new(nm, ld)).rotation_euler = Euler((math.radians(rx), 0, math.radians(rz)))
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.12, 0.11, 0.14, 1); bg.inputs[1].default_value = 1.0
    fm = bpy.data.meshes.new('floor'); fm.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    fmat = bpy.data.materials.new('floor'); fmat.use_nodes = True
    fmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.3, 0.28, 0.26, 1); fm.materials.append(fmat)
    link(bpy.data.objects.new('floor', fm))
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'AgX'
    views = [(30, 2.1, 0.95, 12, None), (90, 2.1, 0.95, 12, None), (20, 0.36, None, 6, HC)]
    tiles = []; tmpd = tempfile.mkdtemp(prefix='charmpfb_')
    for i, (yaw, ortho, cz, elev, centre) in enumerate(views):
        rig.rotation_euler = (0, 0, math.radians(yaw))
        bpy.context.view_layer.update()
        cam_d.ortho_scale = ortho
        cam.rotation_euler = Euler((math.radians(90 - elev), 0, 0))
        fwd = Vector((0, 0, -1)); fwd.rotate(cam.rotation_euler)
        tgt = Vector((0, 0, cz)) if centre is None else rig.matrix_world @ centre
        cam.location = tgt - fwd * 10
        scene.render.resolution_x = 480; scene.render.resolution_y = 700
        fp = os.path.join(tmpd, 'tile_%d.png' % i); scene.render.filepath = fp
        bpy.ops.render.render(write_still=True); tiles.append(fp)
    imgs = [bpy.data.images.load(t) for t in tiles]
    w0, h0 = imgs[0].size; W = w0 * len(imgs)
    sheet = np.zeros((h0, W, 4), np.float32)
    for k, im in enumerate(imgs): sheet[:, k * w0:(k + 1) * w0] = img_array(im)
    out = bpy.data.images.new('sheet', W, h0, alpha=True); out.pixels.foreach_set(sheet.ravel())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.filepath_raw = path; out.file_format = 'PNG'; out.save()
    rig.rotation_euler = (0, 0, 0)
    print('PREVIEW', path)

if PREVIEW:
    preview(P(PREVIEW))
