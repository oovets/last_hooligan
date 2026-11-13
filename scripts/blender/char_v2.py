# THE LAST HOOLIGAN — character v2 builder (Blender 5.x, headless). Skinned, sculpted bodies for the 3D renderer.
#
#   Blender -b --factory-startup --python scripts/blender/char_v2.py -- <job.json>
#
# job.json: { "build": "m"|"h"|"f"|"b" (b = muscle: V-taper, a tee becomes a vest), "torso": "jacket"|"parka"|"tee"|"hivis"|"hoodie", "out": "assets/models/v2/m_jacket.glb",
#             "preview": "path.png" (optional: render a preview sheet), "previewAcc": ["hair:crop", ...] }
#
# Look: realistic proportions with a little caricature (heavier hands, jaw and shoes), modelled on what lads actually
# wear on a match day: hoodies, track tops, parkas, cargos and chunky trainers, hoods up, balaclavas and snoods.
#
# How it's built (no hand-made assets, everything is generated here):
#   * every solid is a union of overlapping ellipsoids ("sculpt primitives"), fused and smoothed with a voxel remesh,
#     so muscles, cloth volume, faces and fists blend into one organic surface
#   * body + clothes are ONE skinned mesh (automatic weights). Clothing regions are materials on it, chosen per face
#     from the nearest bone and a few planes; outer garments are pushed out along the normals so hems overhang
#   * head, hands and rigid details (collar, pockets, sole, bag ...) are separate meshes bound 100% to one bone
#   * optional parts are accessory meshes tagged 'acc:<layer>' (hair:*, hat:*, face:*, mask:*, hood:*, bag, pants:cargo,
#     scarf). The runtime shows the layers a LOOK asks for (game/sprites.js specForLook)
#   * materials are named ID_<n> and recoloured at runtime from the LOOK palette (same ids as the sprites)
#
# The skeleton (names, joint positions, rolls) is the contract with src/render3d/characters2.js and clips.js: keep it.
# Character faces Blender -Y (front). glTF converts to +Z forward, +Y up.

import bpy, bmesh, json, math, os, sys, random
from mathutils import Vector, Matrix, Euler, noise
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
JOB = json.load(open(argv[0])) if argv else {'build': 'm', 'torso': 'jacket', 'preview': '/tmp/char_v2.png'}
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def P(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)

ID = dict(skin=1, hair=2, jacket=3, trim=4, lining=5, shirt=6, pants=7, pantsTrim=8, shoes=9, sole=10,
          scarfA=11, scarfB=12, eye=13, hat=14, hatTrim=15, glove=16, band=17, facial=18, shades=19, mouth=20, belt=21, stripe=22, shoeStripe=23, badge=24, badgeMark=25, tattoo=26)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
BUILD = JOB.get('build', 'm')
TORSO = JOB.get('torso', 'jacket')
FEM = BUILD == 'f'
HEAVY = BUILD == 'h'
MUS = BUILD == 'b'                                   # muscle build (Kenny Showtime)
G = {'m': 1.0, 'h': 1.32, 'f': 0.9, 'b': 1.12}[BUILD]   # girth
H = {'m': 1.0, 'h': 1.02, 'f': 0.95, 'b': 1.04}[BUILD]  # height
SLEEVED = TORSO != 'tee'
random.seed(7)

# ------------------------------------------------------------------ materials (preview colours; runtime recolours by name)
PREVIEW = {1: (0.85, 0.62, 0.48), 2: (0.2, 0.13, 0.08), 3: (0.07, 0.07, 0.08), 4: (0.04, 0.04, 0.05), 5: (0.7, 0.12, 0.1),
           6: (0.9, 0.9, 0.86), 7: (0.16, 0.16, 0.17), 8: (0.3, 0.4, 0.6), 9: (0.92, 0.92, 0.9), 10: (0.85, 0.82, 0.76),
           11: (0.78, 0.06, 0.18), 12: (0.95, 0.94, 0.9), 13: (0.05, 0.03, 0.03), 18: (0.15, 0.1, 0.06), 20: (0.45, 0.2, 0.2),
           21: (0.05, 0.05, 0.05), 22: (0.9, 0.9, 0.9), 14: (0.05, 0.05, 0.06), 15: (0.9, 0.9, 0.9), 19: (0.03, 0.03, 0.05), 17: (0.92, 0.92, 0.95),
           16: (0.06, 0.06, 0.06), 23: (0.95, 0.95, 0.95), 24: (0.03, 0.03, 0.035), 25: (0.75, 0.85, 0.2)}
MATS = {}
def mat(idn):
    if idn in MATS: return MATS[idn]
    m = bpy.data.materials.new('ID_%d' % idn)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    c = PREVIEW.get(idn, (0.5, 0.5, 0.5))
    if b:
        b.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1)
        b.inputs['Roughness'].default_value = 0.8 if idn not in (13, 19) else 0.2
    m.diffuse_color = (c[0], c[1], c[2], 1)
    MATS[idn] = m
    return m

def link(ob):
    scene.collection.objects.link(ob)
    return ob

# ------------------------------------------------------------------ skeleton (metres, Blender Z-up, facing -Y)
# joint positions in a relaxed A-pose; x = character's left (+) / right (-)
def V(x, y, z): return Vector((x, y, z * H))
SW = (0.2 if not FEM else 0.175) * (0.92 + 0.08 * G) + (0.03 if MUS else 0)     # shoulder half-width
HW = (0.1 if not FEM else 0.11) * (0.95 + 0.05 * G)      # hip half-width
AO = 0.1 * (G - 1) + (0.03 if MUS else 0)               # big builds hold their arms further out (clear of the body)
J = {
    'root': V(0, 0, 0),
    'hips': V(0, 0, 0.9),
    'spine': V(0, 0.005, 1.04),
    'chest': V(0, 0.0, 1.22),
    'neck': V(0, 0.01, 1.42),
    'head': V(0, 0.005, 1.5),
    'headTop': V(0, 0.0, 1.78),
}
for s, sg in (('L', 1), ('R', -1)):
    J['shoulder_' + s] = V(sg * 0.05, 0.01, 1.38)
    J['upperArm_' + s] = V(sg * SW, 0.02, 1.36)
    J['forearm_' + s] = V(sg * (SW + 0.08 + AO), 0.04, 1.1)
    J['hand_' + s] = V(sg * (SW + 0.12 + AO * 1.2), 0.0, 0.87)
    J['handEnd_' + s] = V(sg * (SW + 0.14 + AO * 1.2), -0.01, 0.76)
    J['thigh_' + s] = V(sg * HW, 0.0, 0.86)
    J['shin_' + s] = V(sg * (HW + 0.01), -0.01, 0.47)
    J['foot_' + s] = V(sg * (HW + 0.015), 0.02, 0.08)
    J['toe_' + s] = V(sg * (HW + 0.02), -0.12, 0.02)
    J['toeEnd_' + s] = V(sg * (HW + 0.02), -0.19, 0.02)

# bones: name -> (head joint, tail joint, parent)
BONES = [
    ('root', 'root', None, None),
    ('hips', 'hips', 'spine', 'root'),
    ('spine', 'spine', 'chest', 'hips'),
    ('chest', 'chest', 'neck', 'spine'),
    ('neck', 'neck', 'head', 'chest'),
    ('head', 'head', 'headTop', 'neck'),
]
for s in ('L', 'R'):
    BONES += [
        ('shoulder_' + s, 'shoulder_' + s, 'upperArm_' + s, 'chest'),
        ('upperArm_' + s, 'upperArm_' + s, 'forearm_' + s, 'shoulder_' + s),
        ('forearm_' + s, 'forearm_' + s, 'hand_' + s, 'upperArm_' + s),
        ('hand_' + s, 'hand_' + s, 'handEnd_' + s, 'forearm_' + s),
        ('thigh_' + s, 'thigh_' + s, 'shin_' + s, 'hips'),
        ('shin_' + s, 'shin_' + s, 'foot_' + s, 'thigh_' + s),
        ('foot_' + s, 'foot_' + s, 'toe_' + s, 'shin_' + s),
        ('toe_' + s, 'toe_' + s, 'toeEnd_' + s, 'foot_' + s),
    ]

arm_d = bpy.data.armatures.new('rig')
rig = link(bpy.data.objects.new('rig', arm_d))
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for name, a, b, parent in BONES:
    bone = arm_d.edit_bones.new(name)
    bone.head = J[a]
    bone.tail = J[b] if b else J[a] + Vector((0, 0.15, 0))
    if name == 'hips': bone.head = J['hips']; bone.tail = J['spine']
    if parent: bone.parent = eb[parent]; bone.use_connect = False
    eb[name] = bone
# consistent rolls: limbs' local Z points forward (-Y) so bends are about local X
for name, bone in eb.items():
    bone.align_roll(Vector((0, -1, 0)) if not name.startswith(('foot', 'toe')) else Vector((0, 0, 1)))
bpy.ops.object.mode_set(mode='OBJECT')

# ------------------------------------------------------------------ sculpt primitives
FRONT = Vector((0, -1, 0))
def frame(d, ref=FRONT):
    """Rotation whose Z follows d and whose Y is as close to ref as possible (so ry is the front-back radius)."""
    z = d.normalized(); y = ref - z * ref.dot(z)
    if y.length < 1e-4: y = Vector((0, 0, 1)) - z * z.z
    y.normalize(); x = y.cross(z)
    return Matrix((x, y, z)).transposed()

def rot(rx=0, ry=0, rz=0):
    return Euler((math.radians(rx), math.radians(ry), math.radians(rz))).to_matrix()

class Blob:
    """Accumulates overlapping ellipsoids, then fuses them into one smooth surface with a voxel remesh."""
    def __init__(self): self.bm = bmesh.new()
    def ell(self, c, r, M=None, seg=16, rings=10):
        g = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0)
        for v in g['verts']:
            l = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
            v.co = Vector(c) + (M @ l if M is not None else l)
        return self
    def chain(self, a, b, ra, rb, bulge=0.0, at=0.5, width=0.25, ref=FRONT, n=None):
        """Tapered limb from a to b: elliptical cross-section ra=(lateral, front-back) -> rb, optional muscle bulge."""
        a, b = Vector(a), Vector(b); L = (b - a).length
        n = n or max(3, int(L / 0.022))
        M = frame(b - a, ref)
        for i in range(n + 1):
            t = i / n
            k = 1 + bulge * math.exp(-((t - at) / width) ** 2)
            rx = (ra[0] + (rb[0] - ra[0]) * t) * k; ry = (ra[1] + (rb[1] - ra[1]) * t) * k
            self.ell(a.lerp(b, t), (rx, ry, max(L / n * 1.6, min(rx, ry) * 0.95)), M, 14, 9)
        return self
    def build(self, name, voxel, smooth=(0.5, 6), tris=None):
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        ob = link(bpy.data.objects.new(name, me))
        rm = ob.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = voxel; rm.adaptivity = 0.0
        if smooth: sm = ob.modifiers.new('sm', 'SMOOTH'); sm.factor = smooth[0]; sm.iterations = smooth[1]
        bake(ob)
        if tris is None: tris = TRI_BUDGET
        if tris: decimate(ob, tris)
        return ob

TRI_BUDGET = 600   # default triangle budget for small parts (the body/head/hands pass their own)
def tri_count(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)
def decimate(ob, tris):
    n = tri_count(ob)
    if n <= tris: return
    dc = ob.modifiers.new('dc', 'DECIMATE'); dc.ratio = tris / n; dc.use_collapse_triangulate = True
    bake(ob)

def bake(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    m2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data; ob.modifiers.clear(); ob.data = m2; bpy.data.meshes.remove(old)
    for p in ob.data.polygons: p.use_smooth = True

def displace(ob, amp, freq, mask=None):
    """Organic surface noise along the normals (hair clumps, cloth crumple)."""
    me = ob.data; me.update()
    for v in me.vertices:
        w = mask(v.co) if mask else 1.0
        if w <= 0: continue
        v.co += v.normal * amp * w * noise.noise(v.co * freq)

ACC = []      # accessory meshes (tagged acc:<layer>)
PARTS = []    # always-on rigid meshes (head, hands, details)
def tag(ob, idn, bone, tags=''):
    ob.data.materials.clear(); ob.data.materials.append(mat(idn))
    ob['tags'] = tags; ob['bone'] = bone
    return ob
def acc(layer, objs):
    for o in objs: o['tags'] = 'acc:' + layer
    ACC.extend(objs)
def bm_obj(name, bm, idn, bone, tags=''):
    m = bpy.data.meshes.new(name); bm.to_mesh(m); bm.free()
    for p in m.polygons: p.use_smooth = True
    return tag(link(bpy.data.objects.new(name, m)), idn, bone, tags)
def solid(name, idn, bone, shapes, voxel=0.006, smooth=(0.5, 4)):
    """Small rigid part from (centre, radii, M) ellipsoids."""
    b = Blob()
    for s in shapes: b.ell(*s) if len(s) > 2 else b.ell(s[0], s[1])
    return tag(b.build(name, voxel, smooth), idn, bone)

# ------------------------------------------------------------------ body + clothes (one skinned mesh)
def side(sg): return 'L' if sg > 0 else 'R'
JK = 0.012 if TORSO in ('jacket', 'hivis') else 0.03 if TORSO == 'parka' else 0.018 if TORSO == 'hoodie' else 0.0   # garment loft
body_b = Blob()
g = G
# pelvis, glutes, abdomen, ribcage, back, chest
body_b.ell(V(0, 0.005, 0.93), (0.16 * g + (0.02 if FEM else 0), 0.115 * g, 0.12))
for sg in (1, -1):
    body_b.ell(V(sg * 0.07, 0.05, 0.86), (0.085 * g, 0.075 * g, 0.095))
body_b.ell(V(0, 0.0, 1.06), ((0.14 if not FEM else 0.12) * g + JK, 0.105 * g + JK, 0.13))
body_b.ell(V(0, 0.01, 1.24), ((0.17 if not FEM else 0.15) * g + JK, 0.115 * g + JK, 0.17))
body_b.ell(V(0, 0.045, 1.26), ((0.18 if not FEM else 0.15) * g + JK, 0.085 + JK, 0.13))           # lats / upper back
for sg in (1, -1):
    if FEM: body_b.ell(V(sg * 0.065, -0.075 - JK, 1.23), (0.07, 0.065, 0.065))                    # bust
    else: body_b.ell(V(sg * 0.068, -0.045 - JK * 0.5, 1.27), (0.08 * g, 0.04 * g, 0.075))         # pecs
    body_b.ell(V(sg * 0.09, 0.02, 1.37), (0.1 * g, 0.068 + JK, 0.05 + JK * 0.5), rot(0, -16 * sg, 0))  # traps
if HEAVY:
    body_b.ell(V(0, -0.06, 1.04), (0.2, 0.17, 0.2))                                               # belly
    body_b.ell(V(0, -0.1, 0.96), (0.15, 0.1, 0.1))                                                 # belly overhang
    body_b.ell(V(0, 0.03, 1.12), (0.22, 0.13, 0.18))                                               # love handles / back
if MUS:   # V-taper: barrel chest, slabs of pec, big traps and lats, small waist
    body_b.ell(V(0, 0.01, 1.26), (0.24 + JK, 0.15 + JK, 0.17))
    body_b.ell(V(0, 0.05, 1.22), (0.25 + JK, 0.1 + JK, 0.16))
    for sg in (1, -1):
        body_b.ell(V(sg * 0.09, -0.085 - JK, 1.28), (0.1, 0.055, 0.075))
        body_b.ell(V(sg * 0.12, 0.02, 1.4), (0.12, 0.08 + JK, 0.07), rot(0, -20 * sg, 0))
if TORSO == 'parka':
    body_b.ell(V(0, 0.0, 0.83), (0.2 * g, 0.15 * g, 0.12))                                         # coat skirt over the hips
# neck
nr = 0.056 * (0.9 + 0.1 * g) + (0.012 if HEAVY else 0.03 if MUS else 0) - (0.006 if FEM else 0)
body_b.chain(V(0, 0.012, 1.36), V(0, 0.012, 1.54), (nr * 1.05, nr), (nr * 0.9, nr * 0.9))
# arms: deltoid, upper arm (biceps), elbow, forearm (sleeves add a little loft)
for sg in (1, -1):
    s = side(sg); SL = JK if SLEEVED else 0
    if MUS:   # boulder shoulders, big biceps and forearms
        body_b.ell(J['upperArm_' + s], (0.1 + SL, 0.1 + SL, 0.1 + SL))
        body_b.chain(J['upperArm_' + s], J['forearm_' + s], (0.085 + SL, 0.09 + SL), (0.06 + SL, 0.062 + SL), bulge=0.22, at=0.45)
        body_b.chain(J['forearm_' + s], J['hand_' + s], (0.068 + SL, 0.064 + SL), (0.045, 0.04), bulge=0.18, at=0.25)
    body_b.ell(J['upperArm_' + s] + Vector((sg * 0.0, 0.0, 0.0)), (0.06 * g + SL * 0.7, 0.062 * g + SL * 0.7, 0.066 * g + SL * 0.7))
    upper_end = 0.62 if not SLEEVED else 1.0   # a tee sleeve stops above the elbow
    body_b.chain(J['upperArm_' + s], J['forearm_' + s], (0.058 * g + SL, 0.058 * g + SL), (0.047 * g + SL, 0.047 * g + SL), bulge=0.06, at=0.45)
    body_b.ell(J['forearm_' + s], (0.05 * g + SL, 0.05 * g + SL, 0.05 * g + SL))
    body_b.chain(J['forearm_' + s], J['hand_' + s], (0.054 * g + SL, 0.05 * g + SL), (0.037 * g + SL * 0.8, 0.032 * g + SL * 0.8), bulge=0.12, at=0.25)
    if TORSO == 'tee' and not MUS:
        sl = J['upperArm_' + s].lerp(J['forearm_' + s], 0.55)
        body_b.chain(J['upperArm_' + s], sl, (0.075 * g, 0.073 * g), (0.066 * g, 0.064 * g))       # loose short sleeve
# legs: thigh, knee, shin (trousers are loose: little calf/quad definition), chunky trainers
LG = 0.012   # trouser loft
for sg in (1, -1):
    s = side(sg)
    body_b.chain(J['thigh_' + s] + Vector((0, 0.01, 0.03)), J['shin_' + s], (0.098 * g + LG, 0.1 * g + LG), (0.064 * g + LG, 0.066 * g + LG), bulge=0.06, at=0.3)
    body_b.ell(J['shin_' + s], (0.064 * g + LG, 0.066 * g + LG, 0.06))
    body_b.chain(J['shin_' + s], J['foot_' + s] + Vector((0, 0, 0.06)), (0.062 * g + LG, 0.066 * g + LG), (0.058 + LG, 0.06 + LG), bulge=0.08, at=0.3)
    # trainer: heel, mid, toe box, thick sole (sole region is by height, below)
    f0 = J['foot_' + s]; t0 = J['toe_' + s]
    # a real trainer (about 26 cm, slim): rounded heel, padded ankle collar, instep, a toe box that stands up,
    # a thin cupsole with a little toe spring
    body_b.ell(f0 + Vector((0, 0.03, -0.02)), (0.04, 0.045, 0.045))                     # heel counter
    body_b.ell(f0 + Vector((0, 0.018, 0.02)), (0.043, 0.043, 0.03))                     # ankle collar
    body_b.ell(f0.lerp(t0, 0.5) + Vector((0, 0, -0.008)), (0.043, 0.062, 0.04))         # instep
    body_b.ell(t0 + Vector((0, -0.012, 0.008)), (0.04, 0.046, 0.028))                   # toe box
    for k in range(9):                                                                   # cupsole
        q = (f0 + Vector((0, 0.075, 0))).lerp(t0 + Vector((0, -0.05, 0)), k / 8)
        w = 0.044 - 0.009 * (abs(k - 4) / 4) ** 2
        body_b.ell(Vector((q.x, q.y, 0.016 + (0.006 if k == 8 else 0.0))), (w, 0.03, 0.016))
body = body_b.build('body', 0.0085, (0.6, 16), tris=0)   # decimated after the clothing pass
me = body.data

# ---- clothing regions (per face) + garment loft
def seg_dist(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (a + ab * t - p).length, t
SEGS = [(n, J[a], J[b]) for (n, a, b, _) in BONES if b and n != 'root']
def region(p):
    best, bd, bt = None, 9, 0
    for n, a, b in SEGS:
        d, t = seg_dist(p, a, b)
        if d < bd: best, bd, bt = n, d, t
    return best, bt
HEM = {'jacket': 0.95, 'hivis': 0.95, 'hoodie': 0.9, 'parka': 0.7, 'tee': 0.93}[TORSO] * H   # top's lower edge
TOP = ID['shirt'] if TORSO == 'tee' else ID['jacket']
bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
slot = {}
def S(idn):
    k = 'ID_%d' % idn
    if k not in slot: me.materials.append(mat(idn)); slot[k] = len(me.materials) - 1
    return slot[k]
push = {}
for f in bm.faces:
    c = f.calc_center_median(); n, t = region(c); nrm = f.normal
    mid = ID['pants']
    arm = n and n.startswith(('shoulder', 'upperArm', 'forearm'))
    if n in ('spine', 'chest', 'neck') or arm or (n == 'hips' and c.z > HEM) or (TORSO == 'parka' and c.z > HEM and n and n.startswith('thigh')):
        mid = TOP
    if n == 'hips' and c.z <= HEM: mid = ID['pants']
    if arm and not SLEEVED and (n.startswith('forearm') or (n.startswith('upperArm') and (t > 0.55 or MUS)) or (MUS and n.startswith('shoulder') and abs(c.x) > 0.17)): mid = ID['skin']   # a muscle man's tee is a vest
    if n and n.startswith('forearm') and SLEEVED and t > 0.86: mid = ID['trim']                        # cuffs
    if n and n.startswith('hand'): mid = ID['trim'] if SLEEVED else ID['skin']                           # wrist end of the sleeve
    if SLEEVED and TORSO != 'parka' and HEM < c.z < HEM + 0.055 and n in ('hips', 'spine'): mid = ID['trim']   # ribbed waistband
    if TORSO == 'parka' and HEM < c.z < HEM + 0.03 and not arm: mid = ID['trim']
    if (n == 'neck' and c.z > 1.405 * H) or (c.z > 1.45 * H and abs(c.x) < 0.075): mid = ID['skin']
    if n == 'neck' and c.z < 1.43 * H and TORSO == 'tee': mid = ID['shirt']
    # open front of zipped tops: the shirt shows in a V, a dark zip runs down the middle
    if TORSO in ('jacket', 'hivis', 'parka') and nrm.y < -0.3 and n in ('chest', 'spine', 'neck', 'hips') and mid not in (ID['skin'],):
        if abs(c.x) < 0.0065 and c.z > HEM: mid = ID['trim']
    if TORSO == 'hivis' and mid == TOP and (abs(c.z - 1.08 * H) < 0.018 or abs(c.z - 1.2 * H) < 0.018 or (arm and n.startswith('forearm') and abs(t - 0.5) < 0.07)):
        mid = ID['band']
    if mid == TOP and nrm.y < -0.45 and not arm:
        if TORSO == 'hoodie' and abs(c.x) < 0.1 * G and HEM + 0.07 < c.z < HEM + 0.19 and abs(abs(c.x) - 0.1 * G) < 0.012 + (0 if c.z > HEM + 0.17 else 0): mid = ID['trim']
        if TORSO == 'hoodie' and abs(c.x) < 0.1 * G and abs(c.z - (HEM + 0.19)) < 0.007: mid = ID['trim']             # kangaroo pocket outline
        if TORSO in ('jacket', 'hivis') and 0.06 < abs(c.x) < 0.15 * G and abs((c.z - 1.03 * H) - (abs(c.x) - 0.1) * 0.6) < 0.006: mid = ID['trim']   # slanted welt pockets
    if TORSO == 'tee' and n == 'hips' and HEM - 0.04 < c.z < HEM - 0.008: mid = ID['belt']
    if n and n.startswith('shin') and t > 0.9: mid = ID['pantsTrim']
    if n and n.startswith(('foot', 'toe')) or (n and n.startswith('shin') and c.z < 0.115):
        mid = ID['shoes'] if c.z > 0.031 else ID['sole']
    f.material_index = S(mid)
    lift = 0.0
    if mid in (TOP, ID['trim'], ID['band']) and mid != ID['shirt']:
        lift = 0.006 if mid == ID['trim'] else 0.004
    if mid == ID['trim'] and HEM < c.z < HEM + 0.06 and TORSO != 'parka': lift = 0.012    # waistband stands proud
    if mid == ID['trim'] and n and n.startswith('forearm'): lift = 0.008
    if mid == ID['belt']: lift = 0.006
    for v in f.verts: push[v.index] = max(push.get(v.index, 0), lift)
for v in bm.verts:
    if v.index in push: v.co += v.normal * push[v.index]
# cloth crumple: soft folds on the sleeves and trouser legs (low-frequency noise, along the normals)
for v in bm.verts:
    n, t = region(v.co)
    if n and n.startswith(('upperArm', 'forearm')) and SLEEVED: v.co += v.normal * 0.006 * noise.noise(v.co * Vector((9, 9, 26)))
    elif n and n.startswith(('thigh', 'shin')) and v.co.z > 0.12: v.co += v.normal * 0.005 * noise.noise(v.co * Vector((8, 8, 22)) + Vector((3, 1, 0)))
    elif n in ('spine', 'chest', 'hips') and v.co.z > HEM: v.co += v.normal * 0.004 * noise.noise(v.co * 11 + Vector((7, 0, 2)))
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True
decimate(body, 8000)
BVH = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())

def on_surface(p, out, lift=0.0):
    """Project p onto the body surface that faces direction `out` (cast from outside), then lift it outward."""
    out = Vector(out).normalized()
    hit = BVH.ray_cast(Vector(p) + out * 0.5, -out, 1.0)
    return (hit[0] + out * lift) if hit[0] else Vector(p)

# ------------------------------------------------------------------ surface ribbons (three stripes)
def surf(p, out, lift=0.0025, reach=0.35):
    """Ray from outside along -out onto the body; None if it misses. Keep reach short where another limb is near."""
    out = Vector(out).normalized(); hit = BVH.ray_cast(Vector(p) + out * reach, -out, reach * 2)
    return (hit[0] + out * lift, out) if hit[0] else None
def ribbon(name, pts, width, idn, bone):
    """pts: [(point, outward)] along a line on the surface -> a flat strip `width` wide."""
    pts = [q for q in pts if q]
    if len(pts) < 2: return None
    bmr = bmesh.new(); rows = []
    for i, (p, out) in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
        side = d.cross(out).normalized() * width * 0.5
        rows.append((bmr.verts.new(p - side), bmr.verts.new(p + side)))
    for (a0, a1), (b0, b1) in zip(rows[:-1], rows[1:]): bmr.faces.new((a0, a1, b1, b0))
    o = bm_obj(name, bmr, idn, bone)
    for p in o.data.polygons: p.use_smooth = True
    return o
def three(fn, gap):
    """Three parallel ribbons: fn(offset) -> ribbon for a centre-line offset (metres across the stripe)."""
    return [r for r in (fn(k * gap) for k in (-1, 0, 1)) if r]

# track top: three stripes from the collar over the shoulder and down the outside of each sleeve (layer 'track:stripes')
if TORSO == 'jacket':
    TS = []
    for sg in (1, -1):
        s_ = side(sg); ua, fa, hd = J['upperArm_' + s_], J['forearm_' + s_], J['hand_' + s_]
        def stripe(off, sg=sg, s_=s_, ua=ua, fa=fa, hd=hd):
            parts = []
            # over the shoulder: rays straight down, from the neck out to the shoulder joint
            sh = [surf(Vector((sg * (0.075 + (abs(ua.x) - 0.075) * k / 8), ua.y - off * sg * 0, ua.z + 0.0)) + Vector((0, off, 0)), (0, 0, 1)) for k in range(9)]
            parts.append(ribbon('trk_sh%s%d' % (s_, round(off * 1000)), sh, 0.008, ID['stripe'], 'shoulder_' + s_))
            # round the deltoid and down the upper arm: rays swing from straight up to straight out
            d_ = (fa - ua).normalized(); lat = Vector((sg, 0, 0)); lat = (lat - d_ * lat.dot(d_)).normalized()
            arc = []
            for k in range(6):
                a = k / 5 * math.pi / 2; o_ = (Vector((0, 0, 1)) * math.cos(a) + lat * math.sin(a)).normalized()
                arc.append(surf(ua + Vector((0, off, 0)), o_))
            up = [surf(ua.lerp(fa, t / 10) + Vector((0, off, 0)), lat) for t in range(1, 11)]
            parts.append(ribbon('trk_ua%s%d' % (s_, round(off * 1000)), arc + up, 0.008, ID['stripe'], 'upperArm_' + s_))
            d2 = (hd - fa).normalized(); lat2 = Vector((sg, 0, 0)); lat2 = (lat2 - d2 * lat2.dot(d2)).normalized()
            lo = [surf(fa.lerp(hd, t / 10) + Vector((0, off, 0)), lat2) for t in range(0, 9)]
            parts.append(ribbon('trk_fa%s%d' % (s_, round(off * 1000)), lo, 0.008, ID['stripe'], 'forearm_' + s_))
            return [p_ for p_ in parts if p_]
        for k in (-1, 0, 1): TS += stripe(k * 0.014)
    acc('track:stripes', TS)
# trainers: three slanted stripes on each side and a heel tab (layer 'shoes:stripes')
SH = []
for sg in (1, -1):
    s_ = side(sg); f0 = J['foot_' + s_]
    for sd in (1, -1):                                   # outer and inner side of the shoe
        for k in range(3):
            y0 = f0.y - 0.022 - k * 0.02
            pts = [surf(Vector((f0.x, y0 - 0.035 * t / 6, 0.036 + 0.042 * t / 6)), (sd, 0, 0), 0.0018, 0.07) for t in range(7)]   # short rays: the other shoe is close
            r_ = ribbon('shoeStr%s%d%d' % (s_, sd, k), pts, 0.009, ID['shoeStripe'], 'foot_' + s_)
            if r_: SH.append(r_)
    tab = [surf(Vector((f0.x, f0.y, 0.04 + 0.05 * t / 5)), (0, 1, 0), 0.002, 0.12) for t in range(6)]
    r_ = ribbon('heelTab' + s_, tab, 0.026, ID['shoeStripe'], 'foot_' + s_)
    if r_: SH.append(r_)
acc('shoes:stripes', SH)

# ------------------------------------------------------------------ head: one sculpted mesh with a face (rigid to 'head')
HC = J['head'] + Vector((0, -0.012, 0.125))
HS = 1.06     # a touch bigger than life so faces read at game distance
hb = Blob()
jw = 1.12 if HEAVY else 0.9 if FEM else 1.0                                     # jaw width
hb.ell(HC + Vector((0, 0.012, 0.02)), (0.077, 0.098, 0.1))                       # cranium
hb.ell(HC + Vector((0, 0.03, -0.01)), (0.072, 0.08, 0.085))                      # back of the skull
if HEAVY:   # round and full, the chin soft and tucked into the double chin
    hb.ell(HC + Vector((0, -0.028, -0.05)), (0.072 * jw, 0.075, 0.062))
    hb.ell(HC + Vector((0, -0.058, -0.088)), (0.042 * jw, 0.034, 0.026))
else:
    hb.ell(HC + Vector((0, -0.03, -0.055)), (0.066 * jw, 0.072, 0.065))         # face / jaw mass
    hb.ell(HC + Vector((0, -0.06, -0.095)), (0.04 * jw, 0.036, 0.03))          # chin
for sg in (1, -1):
    hb.ell(HC + Vector((sg * 0.046 * jw, -0.015, -0.068)), (0.026, 0.045, 0.032))                    # jaw angle
    hb.ell(HC + Vector((sg * 0.038, -0.056, -0.01)), (0.017, 0.015, 0.013))       # cheekbones (subtle)
    hb.ell(HC + Vector((sg * 0.074, 0.016, -0.014)), (0.007, 0.017, 0.026), rot(0, 0, -14 * sg))    # ears
hb.ell(HC + Vector((0, -0.072, 0.03)), (0.062, 0.02 if not FEM else 0.012, 0.015 if not FEM else 0.01))   # brow ridge
NB = 0.8 if FEM else 1.0
NZ = -0.022 if HEAVY else -0.03                                                 # heavy: a short, rounded nose
hb.chain(HC + Vector((0, -0.084, 0.018)), HC + Vector((0, -0.106 + 0.006 * (1 - NB) / 0.2 + (0.004 if HEAVY else 0), NZ)), (0.009 * NB, 0.01 * NB), (0.013 * NB, 0.014 * NB))   # nose bridge
if FEM: hb.ell(HC + Vector((0, -0.098, -0.03)), (0.011, 0.01, 0.009))           # nose tip
elif HEAVY: hb.ell(HC + Vector((0, -0.1, -0.026)), (0.015, 0.013, 0.012))
else: hb.ell(HC + Vector((0, -0.103, -0.033)), (0.014, 0.013, 0.012))
for sg in (1, -1): hb.ell(HC + Vector((sg * 0.014, -0.096, -0.038 + (0.008 if HEAVY else 0))), (0.011, 0.011, 0.009))   # nostril wings
LP = 1.25 if FEM else 1.0
hb.ell(HC + Vector((0, -0.09, -0.058)), (0.025, 0.012, 0.008 * LP))             # upper lip
hb.ell(HC + Vector((0, -0.087, -0.071)), (0.023, 0.012 * LP, 0.009 * LP))       # lower lip
if HEAVY:
    hb.ell(HC + Vector((0, -0.045, -0.115)), (0.062, 0.05, 0.035))               # double chin
    hb.ell(HC + Vector((0, -0.02, -0.068)), (0.078 * jw, 0.07, 0.052))          # full lower face, no separate jowls
hb.chain(HC + Vector((0, 0.016, -0.06)), HC + Vector((0, 0.02, -0.16)), (0.05, 0.05), (0.048, 0.048))   # neck stub
head = hb.build('head', 0.0028, (0.5, 12 if HEAVY else 6), tris=0)   # heavy: smoother, fuller face
# eye sockets and the mouth line: press the surface in
EYE = {sg: HC + Vector((sg * 0.033, -0.071, 0.01)) for sg in (1, -1)}
for v in head.data.vertices:
    for sg in (1, -1):
        d = (v.co - EYE[sg]); r2 = (d.x / 0.024) ** 2 + (d.y / 0.03) ** 2 + (d.z / 0.017) ** 2
        if r2 < 4: v.co.y += 0.009 * math.exp(-r2)
    d = v.co - (HC + Vector((0, -0.092, -0.065)))
    r2 = (d.x / 0.024) ** 2 + (d.z / 0.0035) ** 2
    if d.y < 0.02 and r2 < 4: v.co.y += 0.004 * math.exp(-r2)
decimate(head, 2800)
tag(head, ID['skin'], 'head'); PARTS.append(head)
for sg in (1, -1):
    e = EYE[sg] + Vector((0, -0.002, 0))
    PARTS.append(solid('eyeWhite%d' % sg, ID['band'], 'head', [(e, (0.0125, 0.01, 0.0095))], 0.0015, None))
    PARTS.append(solid('iris%d' % sg, ID['eye'], 'head', [(e + Vector((-sg * 0.001, -0.0085, 0.0005)), (0.006, 0.003, 0.006))], 0.0012, None))
    # upper lid (skin): gives the heavy-lidded, unimpressed look
    lid_c = e + Vector((0, -0.002, 0.0085)) if HEAVY else e + Vector((0, -0.003, 0.006))
    PARTS.append(solid('lid%d' % sg, ID['skin'], 'head', [(lid_c, (0.0145, 0.0115, 0.0065), rot(-20 if HEAVY else -12, 0, 0))], 0.0015, (0.5, 2)))
    # brows (hair colour): low and angled in
    brow_rot = rot(0, -6 * sg, -4 * sg) if HEAVY else rot(0, 10 * sg, -6 * sg)
    PARTS.append(solid('brow%d' % sg, ID['facial'], 'head', [(HC + Vector((sg * 0.034, -0.088, 0.033 if HEAVY else 0.03)), (0.022, 0.005, 0.004), brow_rot)], 0.0018, (0.5, 2)))
if HEAVY:   # a lopsided grin: the mouth line turns up at the corners, more on his left
    PARTS.append(solid('mouthLine', ID['mouth'], 'head', [(HC + Vector((0, -0.0965, -0.066)), (0.016, 0.003, 0.0019))]
                       + [(HC + Vector((sg * 0.021, -0.092, -0.0615 + (0.002 if sg > 0 else 0))), (0.011, 0.003, 0.0019), rot(0, (-28 if sg > 0 else 20) * sg, 0)) for sg in (1, -1)], 0.0012, None))
else:
    PARTS.append(solid('mouthLine', ID['mouth'], 'head', [(HC + Vector((0, -0.0965, -0.065)), (0.021, 0.003, 0.0018))], 0.0012, None))

# ------------------------------------------------------------------ hands: half-closed fists (rigid to the hand bones)
def hand(sg):
    s = side(sg); w = J['hand_' + s]; d = (J['handEnd_' + s] - w).normalized()
    out = Vector((sg, 0, 0)); fw = FRONT.copy()
    out = (out - d * out.dot(d)).normalized(); fw = d.cross(out).normalized() * (-sg)      # fw: thumb side (front)
    if fw.dot(FRONT) < 0: fw = -fw
    palm_n = -out                                                                       # palm faces the thigh
    k = 1.12                                                                            # chunky brawler hands
    b = Blob()
    b.ell(w + d * 0.008, (0.026 * k, 0.03 * k, 0.025 * k), frame(d, fw))                 # wrist
    b.ell(w + d * 0.05 * k, (0.018 * k, 0.042 * k, 0.045 * k), frame(d, fw))             # palm (thin out->in, wide front-back)
    for i, fo in enumerate((0.027, 0.009, -0.009, -0.026)):
        base = w + d * 0.09 * k + fw * fo * k + palm_n * 0.002
        L = [0.036, 0.026, 0.022][:]; ang = [55, 80, 60]; r = 0.0095 * k * (1 - 0.06 * i)
        p = base; a = 0.0
        for j in range(3):
            a += ang[j]
            dirv = (d * math.cos(math.radians(a)) + palm_n * math.sin(math.radians(a))).normalized()
            q = p + dirv * L[j] * k * (1 - 0.08 * i)
            b.chain(p, q, (r, r), (r * 0.92, r * 0.92), ref=fw, n=3)
            p = q
        b.ell(base, (r * 1.1, r * 1.1, r * 1.1))                                       # knuckle
    t0 = w + d * 0.03 * k + fw * 0.03 * k + palm_n * 0.008
    t1 = t0 + (d * 0.55 + fw * 0.55 + palm_n * 0.45).normalized() * 0.04 * k
    t2 = t1 + (d * 0.75 + palm_n * 0.7 - fw * 0.2).normalized() * 0.03 * k
    b.chain(t0, t1, (0.013 * k, 0.013 * k), (0.011 * k, 0.011 * k), ref=fw, n=3)
    b.chain(t1, t2, (0.011 * k, 0.011 * k), (0.0095 * k, 0.0095 * k), ref=fw, n=3)
    return tag(b.build('hand_' + s, 0.0026, (0.5, 4), tris=800), ID['glove'], 'hand_' + s)
for sg in (1, -1): PARTS.append(hand(sg))

# ------------------------------------------------------------------ garment details (rigid parts)
def ring(name, centre, rx, ry, rad, idn, bone, segs=28, z_wave=0.0, height=None):
    """A soft tube around an elliptical loop (collars, hems, cuffs)."""
    bmr = bmesh.new(); rings = []
    pts = [Vector((centre.x + math.cos(a) * rx, centre.y + math.sin(a) * ry, centre.z + z_wave * math.sin(a))) for a in [k / segs * math.tau for k in range(segs)]]
    for i, p in enumerate(pts):
        dvec = (pts[(i + 1) % segs] - pts[i - 1]).normalized()
        a = Vector((0, 0, 1)); bb = dvec.cross(a).normalized()
        h = height or rad[1]
        rings.append([bmr.verts.new(p + a * math.sin(t) * h + bb * math.cos(t) * rad[0]) for t in [q / 8 * math.tau for q in range(8)]])
    for i in range(segs):
        r0, r1 = rings[i], rings[(i + 1) % segs]
        for q in range(8): bmr.faces.new((r0[q], r0[(q + 1) % 8], r1[(q + 1) % 8], r1[q]))
    return bm_obj(name, bmr, idn, bone)

NK = J['neck'] + Vector((0, 0.012, 0.0))
if TORSO in ('jacket', 'hivis'):
    # stand-up collar, open at the front
    c = Blob()
    for k in range(-10, 11):
        a = math.pi / 2 + k / 10 * math.radians(150)
        p = NK + Vector((math.cos(a) * 0.088 * G, math.sin(a) * 0.08 * G + 0.005, 0.004 + 0.012 * abs(k) / 10))
        c.ell(p, (0.016, 0.016, 0.03))
    PARTS.append(tag(c.build('collar', 0.005, (0.5, 3)), ID['trim'], 'chest'))
if TORSO == 'tee':
    PARTS.append(ring('neckband', NK + Vector((0, 0, 0.01)), 0.07 * G, 0.064 * G, (0.008, 0.008), ID['trim'], 'chest'))
if TORSO == 'parka':
    # big hood lying on the back with a fur-trimmed rim
    hd = Blob()
    hd.ell(NK + Vector((0, 0.085, 0.0)), (0.12 * G, 0.06, 0.1))
    hd.ell(NK + Vector((0, 0.06, 0.06)), (0.11 * G, 0.05, 0.06))
    PARTS.append(tag(hd.build('parkaHood', 0.008, (0.5, 4)), ID['jacket'], 'chest'))
    fur = Blob()
    for k in range(-12, 13):
        a = math.pi / 2 + k / 12 * math.radians(165)
        fur.ell(NK + Vector((math.cos(a) * 0.1 * G, math.sin(a) * 0.09 * G + 0.01, 0.02 + 0.03 * (1 - abs(k) / 12))), (0.022, 0.022, 0.026))
    f_ob = fur.build('parkaFur', 0.006, (0.4, 2)); displace(f_ob, 0.006, 90)
    PARTS.append(tag(f_ob, ID['trim'], 'chest'))
    for sg in (1, -1):
        p = on_surface(V(sg * 0.12 * G, 0, 0.98), FRONT, 0.006)
        PARTS.append(solid('flap%d' % sg, ID['jacket'], 'hips', [(p, (0.06, 0.014, 0.03))], 0.006, (0.5, 3)))
if TORSO == 'hoodie':
    # kangaroo pocket, drawstrings, ribbed neckline
    PARTS.append(ring('hoodNeck', NK + Vector((0, 0.005, 0.0)), 0.075 * G, 0.07 * G, (0.012, 0.012), ID['trim'], 'chest'))
    for sg in (1, -1):
        a = NK + Vector((sg * 0.03, -0.075 * G, -0.01)); b2 = on_surface(V(sg * 0.035, 0, 1.22), FRONT, 0.004)
        st = Blob().chain(a, b2, (0.004, 0.004), (0.0035, 0.0035), n=6)
        PARTS.append(tag(st.build('string%d' % sg, 0.0022, (0.5, 2)), ID['band'], 'chest'))
if TORSO in ('hoodie', 'jacket'):
    acc('hood:down', [tag(Blob().ell(NK + Vector((0, 0.085, 0.02)), (0.12 * G, 0.065, 0.1))
                          .ell(NK + Vector((0, 0.07, 0.07)), (0.1 * G, 0.05, 0.05)).build('hoodDown', 0.008, (0.5, 4)), ID['jacket'], 'chest')])
def plate(name, p, across, up, nrm, size, idn, bone):
    """A thin box lying on the surface at p: size = (across, up, thickness)."""
    bmp = bmesh.new(); bmesh.ops.create_cube(bmp, size=1.0)
    M = Matrix((across, up, nrm)).transposed()
    for v in bmp.verts: v.co = p + M @ Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    o = bm_obj(name, bmp, idn, bone)
    for q in o.data.polygons: q.use_smooth = False
    return o
if TORSO == 'jacket':
    # two chest pockets with buttoned flaps (overshirt / field jacket) - layer 'pockets:chest'
    cp = []
    for sg in (1, -1):
        h = surf(V(sg * 0.085 * G, 0, 1.25), FRONT, 0.003)
        if not h: continue
        p, nrm = h; nrm = (FRONT * 0.8 + Vector((sg * 0.2, 0, 0))).normalized(); across = Vector((0, 0, 1)).cross(nrm).normalized(); up = nrm.cross(across).normalized()
        cp.append(plate('chestPocket%d' % sg, p, across, up, nrm, (0.075, 0.07, 0.006), ID['jacket'], 'chest'))
        cp.append(plate('chestFlap%d' % sg, p + up * 0.032 + nrm * 0.004, across, up, nrm, (0.08, 0.026, 0.006), ID['trim'], 'chest'))
        cp.append(solid('chestBtn%d' % sg, ID['trim'], 'chest', [(p + up * 0.024 + nrm * 0.009, (0.005, 0.005, 0.003))], 0.0015, None))
    acc('pockets:chest', cp)
if SLEEVED:
    # arm badge on the left upper arm (layer 'badge:arm'): a UV-mapped patch that wraps round the sleeve. The design
    # (felt, stitched border, compass rose, ring text, buttons) is a texture drawn at runtime (characters2.js badgeTexture)
    ua, fa = J['upperArm_L'], J['forearm_L']; d_ = (fa - ua).normalized()
    lat = Vector((1, 0, 0)); lat = (lat - d_ * lat.dot(d_)).normalized()
    out_ = (lat * 1.0 + FRONT * 0.12).normalized()
    h = surf(ua.lerp(fa, 0.3), out_, 0.004, 0.25)
    if h:
        p, nrm = h; up = -d_; across = up.cross(nrm).normalized(); up = nrm.cross(across).normalized()
        BW, BH, COLS, ROWS = 0.1, 0.05, 10, 2
        bmq = bmesh.new(); uvl = bmq.loops.layers.uv.new('UVMap'); grid = {}
        for i in range(COLS + 1):
            for j in range(ROWS + 1):
                q = p + across * (i / COLS - 0.5) * BW + up * (j / ROWS - 0.5) * BH
                t = max(0.0, min(1.0, (q - ua).dot(fa - ua) / (fa - ua).length_squared)); axis = ua.lerp(fa, t)
                o2 = (q - axis); o2 = (o2 - d_ * o2.dot(d_)).normalized()
                hq = surf(axis, o2, 0.0035, 0.2)
                grid[i, j] = (bmq.verts.new(hq[0] if hq else q), (i / COLS, j / ROWS))
        for i in range(COLS):
            for j in range(ROWS):
                quad = [grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]]
                f = bmq.faces.new([q[0] for q in quad])
                for loop, (_, uv) in zip(f.loops, quad): loop[uvl].uv = uv
        bd = [bm_obj('badge', bmq, ID['badge'], 'upperArm_L'),
              plate('badgeBack', p - nrm * 0.004, across, up, nrm, (BW * 0.96, BH * 0.94, 0.004), ID['shades'], 'upperArm_L')]   # stays behind the textured face
        acc('badge:arm', bd)
def arm_decal(name, idn, size, at=0.32, lift=0.0012, cols=8, rows=8):
    """A UV-mapped square that hugs the outside of the left upper arm (tattoos on bare arms)."""
    ua, fa = J['upperArm_L'], J['forearm_L']; d_ = (fa - ua).normalized()
    lat = Vector((1, 0, 0)); lat = (lat - d_ * lat.dot(d_)).normalized()
    h = surf(ua.lerp(fa, at), (lat + FRONT * 0.15).normalized(), lift, 0.25)
    if not h: return None
    p, nrm = h; up = -d_; across = up.cross(nrm).normalized(); up = nrm.cross(across).normalized()
    bmq = bmesh.new(); uvl = bmq.loops.layers.uv.new('UVMap'); grid = {}
    for i in range(cols + 1):
        for j in range(rows + 1):
            q = p + across * (i / cols - 0.5) * size + up * (j / rows - 0.5) * size
            t = max(0.0, min(1.0, (q - ua).dot(fa - ua) / (fa - ua).length_squared)); axis = ua.lerp(fa, t)
            o2 = (q - axis); o2 = (o2 - d_ * o2.dot(d_)).normalized()
            hq = surf(axis, o2, lift, 0.2)
            grid[i, j] = (bmq.verts.new(hq[0] if hq else q), (i / cols, j / rows))
    for i in range(cols):
        for j in range(rows):
            quad = [grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]]
            f = bmq.faces.new([q[0] for q in quad])
            for loop, (_, uv) in zip(f.loops, quad): loop[uvl].uv = uv
    return bm_obj(name, bmq, idn, 'upperArm_L')
if not SLEEVED:
    # bare-armed builds: an arm tattoo (layer 'tattoo:arm'); the design is a runtime texture with alpha (ID 26)
    tt = arm_decal('tattoo', ID['tattoo'], 0.13 if MUS else 0.095)
    if tt: acc('tattoo:arm', [tt])

# ------------------------------------------------------------------ accessories: hair, facial hair, hats, hoods, masks, bag
def skull_shell(name, inflate, keep, idn, voxel=0.003, rough=0.0, freq=60.0):
    """Hair/hat/hood shells: the cranium inflated, trimmed by keep(local offset) -> bool, then remeshed."""
    b = Blob()
    b.ell(HC + Vector((0, 0.012, 0.02)), (0.077 + inflate, 0.098 + inflate, 0.1 + inflate))
    b.ell(HC + Vector((0, 0.03, -0.01)), (0.072 + inflate, 0.08 + inflate, 0.085 + inflate))
    ob = b.build(name, voxel, (0.5, 3))
    bmx = bmesh.new(); bmx.from_mesh(ob.data)
    kill = [f for f in bmx.faces if not keep(f.calc_center_median() - HC)]
    bmesh.ops.delete(bmx, geom=kill, context='FACES')
    # give the cut edge some thickness so it doesn't read as paper
    bmesh.ops.solidify(bmx, geom=bmx.faces[:], thickness=-0.0025)
    bmx.to_mesh(ob.data); bmx.free()
    if rough: displace(ob, rough, freq)
    for p in ob.data.polygons: p.use_smooth = True
    return tag(ob, idn, 'head')

def hairline(d, front=0.045, sides=-0.02, back=-0.07):
    """Above the hairline? d = offset from head centre. Front at the forehead, down past the ears at the back."""
    fwd = -d.y
    if fwd > 0.03: return d.z > front - (abs(d.x) * 0.25)
    if fwd > -0.02: return d.z > sides
    return d.z > back
def scalp(name, thick, front, sides, back, rough=0.0, freq=200.0, fade=0.025, temple=0.25):
    """Short hair: a copy of the scalp faces of the head mesh, lifted along the normals, thinning out to the hairline."""
    bmx = bmesh.new(); bmx.from_mesh(head.data); bmx.normal_update()
    line = lambda d: front - abs(d.x) * temple if -d.y > 0.03 else sides if -d.y > -0.02 else back
    bmesh.ops.delete(bmx, geom=[f for f in bmx.faces if (f.calc_center_median() - HC).z < line(f.calc_center_median() - HC)], context='FACES')
    for v in bmx.verts:
        d = v.co - HC; k = max(0.12, min(1.0, (d.z - line(d)) / fade))
        v.co += v.normal * (thick * k + (rough * noise.noise(v.co * freq) if rough else 0))
    o = bm_obj(name, bmx, ID['hair'], 'head'); decimate(o, 1000)
    return o
acc('hair:crop', [scalp('crop', 0.0045, 0.052, -0.004, -0.062, 0.0008, 260)])
acc('hair:shaved', [scalp('shaved', 0.0018, 0.056, 0.0, -0.058, 0.0, 0, 0.012)])
acc('hair:receding', [scalp('receding', 0.0016, 0.07, 0.004, -0.058, 0.0, 0, 0.012, temple=-0.45)])   # buzzed, high temples
acc('hair:mod', [skull_shell('mod', 0.016, lambda d: hairline(d, 0.018, -0.045, -0.085), ID['hair'], rough=0.004, freq=70)])
acc('hair:curtains', [skull_shell('curtains', 0.013, lambda d: hairline(d, 0.03, -0.04, -0.08) and not (abs(d.x) < 0.008 and -d.y > 0.05), ID['hair'], rough=0.004, freq=60)])
acc('hair:long', [skull_shell('long', 0.014, lambda d: hairline(d, 0.035, -0.06, -0.2), ID['hair'], rough=0.004, freq=50),
                  tag(Blob().chain(HC + Vector((0, 0.07, -0.02)), HC + Vector((0, 0.08, -0.2)), (0.075, 0.035), (0.06, 0.02)).build('longBack', 0.005, (0.5, 3)), ID['hair'], 'head')])
acc('hair:ponytail', [skull_shell('ptCap', 0.007, lambda d: hairline(d, 0.045, -0.01, -0.07), ID['hair'], rough=0.002, freq=120),
                      tag(Blob().chain(HC + Vector((0, 0.105, 0.0)), HC + Vector((0, 0.13, -0.16)), (0.025, 0.025), (0.012, 0.012), bulge=0.4, at=0.3).build('ptTail', 0.004, (0.5, 3)), ID['hair'], 'head')])
acc('hair:bob', [skull_shell('bob', 0.018, lambda d: hairline(d, 0.025, -0.075, -0.1), ID['hair'], rough=0.003, freq=60)])
sp = skull_shell('spikyBase', 0.007, lambda d: hairline(d, 0.045, -0.01, -0.06), ID['hair'])
spikes = Blob()
for i in range(14):
    a = random.uniform(0, math.tau); z = random.uniform(0.04, 0.1)
    base = HC + Vector((math.cos(a) * 0.06, math.sin(a) * 0.07 + 0.005, z))
    tip = base + (base - HC).normalized() * 0.035
    spikes.chain(base, tip, (0.014, 0.014), (0.003, 0.003), n=4)
acc('hair:spiky', [sp, tag(spikes.build('spikes', 0.003, (0.4, 2)), ID['hair'], 'head')])
acc('hair:mohawk', [tag(Blob().chain(HC + Vector((0, -0.07, 0.085)), HC + Vector((0, 0.09, 0.06)), (0.012, 0.03), (0.01, 0.03), bulge=0.6, at=0.35, ref=Vector((0, 0, 1)))
                        .build('mohawk', 0.003, (0.5, 3)), ID['hair'], 'head')])
acc('hair:flattop', [skull_shell('flatSides', 0.006, lambda d: hairline(d, 0.045, -0.01, -0.06), ID['hair']),
                     tag(Blob().ell(HC + Vector((0, 0.01, 0.11)), (0.08, 0.095, 0.035)).build('flat', 0.004, (0.3, 2)), ID['hair'], 'head')])
# beard: the face and jaw masses, a little inflated, cut below the cheekbones and round the mouth
fb = Blob()
fb.ell(HC + Vector((0, -0.03, -0.06)), (0.07 * jw, 0.076, 0.068)); fb.ell(HC + Vector((0, -0.064, -0.1)), (0.044 * jw, 0.04, 0.036))
for sg in (1, -1): fb.ell(HC + Vector((sg * 0.052 * jw, -0.02, -0.07)), (0.032, 0.054, 0.04))
bo = fb.build('beard', 0.003, (0.5, 3))
bmx = bmesh.new(); bmx.from_mesh(bo.data)
bmesh.ops.delete(bmx, geom=[f for f in bmx.faces if (f.calc_center_median() - HC).z > -0.03 + max(0, (f.calc_center_median() - HC).y + 0.02) * 0.6
                             or (abs((f.calc_center_median() - HC).x) < 0.026 and -0.085 < (f.calc_center_median() - HC).z < -0.05 and (f.calc_center_median() - HC).y < -0.06)], context='FACES')
bmx.to_mesh(bo.data); bmx.free(); displace(bo, 0.002, 160)
acc('face:beard', [tag(bo, ID['facial'], 'head')])
acc('face:tache', [solid('tache', ID['facial'], 'head', [(HC + Vector((sg * 0.011, -0.098, -0.05)), (0.016, 0.007, 0.0055), rot(0, -14 * sg, 0)) for sg in (1, -1)], 0.0018, (0.4, 2))])
acc('face:shades', [solid('shades', ID['shades'], 'head', [(EYE[sg] + Vector((0, -0.014, 0.002)), (0.019, 0.004, 0.013)) for sg in (1, -1)]
                          + [(HC + Vector((0, -0.088, 0.014)), (0.01, 0.003, 0.003))], 0.0018, (0.3, 1))])
# hats
cap = Blob().ell(HC + Vector((0, 0.008, 0.035)), (0.084, 0.104, 0.085))
cap_o = cap.build('capDome', 0.004, (0.5, 3))
bmx = bmesh.new(); bmx.from_mesh(cap_o.data); bmesh.ops.delete(bmx, geom=[f for f in bmx.faces if (f.calc_center_median() - HC).z < 0.012], context='FACES'); bmx.to_mesh(cap_o.data); bmx.free()
acc('hat:cap', [tag(cap_o, ID['hat'], 'head'), solid('capBrim', ID['hatTrim'], 'head', [(HC + Vector((0, -0.11, 0.022)), (0.07, 0.055, 0.006), rot(-8, 0, 0))], 0.003, (0.3, 1))])
acc('hat:beanie', [skull_shell('beanie', 0.012, lambda d: d.z > 0.0 - (0.02 if d.y > 0 else 0), ID['hat'], rough=0.0015, freq=200),
                   ring('beanieTurn', HC + Vector((0, 0.01, 0.012)), 0.09, 0.11, (0.009, 0.012), ID['hat'], 'head')])
acc('hat:bucket', [skull_shell('bucket', 0.012, lambda d: d.z > 0.01, ID['hat']),
                   solid('bucketBrim', ID['hat'], 'head', [(HC + Vector((0, 0.008, 0.012)), (0.135, 0.15, 0.007))], 0.004, (0.3, 1))])
acc('hat:helmet', [skull_shell('helmet', 0.02, lambda d: d.z > -0.02, ID['hat'])])
# hood up (any top): a deep cowl round the head, open face, drawn in at the chin
hu = Blob()
hu.ell(HC + Vector((0, 0.02, 0.01)), (0.1, 0.12, 0.118)); hu.ell(HC + Vector((0, 0.06, -0.09)), (0.1, 0.08, 0.08))
hu.chain(HC + Vector((0, 0.04, -0.12)), NK + Vector((0, 0.03, -0.02)), (0.1, 0.08), (0.11 * G, 0.09 * G))
hood_up = hu.build('hoodUp', 0.004, (0.5, 4), tris=1400)
bmx = bmesh.new(); bmx.from_mesh(hood_up.data)
def face_hole(c):
    d = c - HC
    return -d.y > 0.02 and abs(d.x) < 0.07 - max(0.0, d.z - 0.03) * 0.5 and -0.13 < d.z < 0.075
bmesh.ops.delete(bmx, geom=[f for f in bmx.faces if face_hole(f.calc_center_median())], context='FACES')
bmesh.ops.solidify(bmx, geom=bmx.faces[:], thickness=-0.006)
bmx.to_mesh(hood_up.data); bmx.free(); displace(hood_up, 0.003, 40)
acc('hood:up', [tag(hood_up, ID['jacket'], 'head')])
# masks: offset copies of the head mesh itself (so no feature can poke through): balaclava (eye slit), snood (nose down)
def head_cover(name, keep, lift, extra=(), rough=0.0012, freq=180):
    bmx = bmesh.new(); bmx.from_mesh(head.data); bmx.normal_update()
    bmesh.ops.delete(bmx, geom=[f for f in bmx.faces if not keep(f.calc_center_median() - HC)], context='FACES')
    for v in bmx.verts: v.co += v.normal * (lift + rough * noise.noise(v.co * freq))
    o = bm_obj(name, bmx, ID['hat'], 'head')
    sm = o.modifiers.new('sm', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 3; bake(o)
    decimate(o, 1600)
    return o
def neck_sleeve(name):
    return tag(Blob().chain(J['neck'] + Vector((0, 0.012, 0.0)), HC + Vector((0, 0.015, -0.12)) , (nr + 0.008, nr + 0.008), (nr + 0.006, nr + 0.006)).build(name, 0.004, (0.5, 3), tris=500), ID['hat'], 'neck')
slit = lambda d: -d.y > 0.035 and abs(d.x) < 0.058 and -0.008 < d.z < 0.026
acc('mask:balaclava', [head_cover('balaclava', lambda d: not slit(d) and d.z > -0.2, 0.0055), neck_sleeve('balaNeck')])
acc('hat:balaclava', [head_cover('balaclava3', lambda d: not ((-d.y > 0.035 and -0.006 < d.z < 0.03 and 0.008 < abs(d.x) < 0.058) or
                                                              (-d.y > 0.05 and -0.084 < d.z < -0.046 and abs(d.x) < 0.03)) and d.z > -0.2, 0.0055), neck_sleeve('bala3Neck')])
acc('mask:snood', [head_cover('snood', lambda d: d.z < -0.012 - max(0.0, d.y + 0.05) * 0.5, 0.008, rough=0.002, freq=80)])
# bum bag worn across the chest: strap runs over the left shoulder down to the right hip, bag rides on the front
TL, BR = (0.1 * G, 1.47 * H), (-0.18 * G, 1.0 * H)
def strap_pt(t, face):
    x = TL[0] + (BR[0] - TL[0]) * t; z = TL[1] + (BR[1] - TL[1]) * t
    return on_surface(Vector((x, 0, z)), Vector((0, face, 0)), 0.005)
front = [strap_pt(k / 10, -1) for k in range(11)]
back = [strap_pt(k / 10, 1) for k in range(11)]
top = [on_surface(Vector((TL[0], front[0].y + (back[0].y - front[0].y) * k / 6, TL[1])), Vector((0, 0, 1)), 0.005) for k in range(7)]
loop = list(reversed(front)) + top[1:-1] + back
strap = Blob()
for a, b2 in zip(loop[:-1], loop[1:]): strap.chain(a, b2, (0.017, 0.0045), (0.017, 0.0045), ref=Vector((0, 0, 1)), n=3)
strap.chain(front[-1], back[-1], (0.017, 0.0045), (0.017, 0.0045), n=4)
bag_c = strap_pt(0.62, -1) + Vector((0, -0.024, 0))
bag_o = Blob().ell(bag_c, (0.08, 0.028, 0.045), rot(0, 32, 0)).build('bag', 0.004, (0.5, 3))
acc('bag', [tag(bag_o, ID['belt'], 'chest'), tag(strap.build('bagStrap', 0.003, (0.4, 2), tris=700), ID['belt'], 'chest'),
            solid('bagZip', ID['band'], 'chest', [(bag_c + Vector((0, -0.027, 0.02)), (0.068, 0.003, 0.0025), rot(0, 32, 0))], 0.002, None)])
# cargo pockets on the thighs
for sg in (1, -1):
    s = side(sg); p = on_surface(J['thigh_' + s].lerp(J['shin_' + s], 0.5) + Vector((sg * 0.0, 0, 0)), Vector((sg, 0, 0)), 0.004)
    acc('pants:cargo', [solid('cargo' + s, ID['pantsTrim'], 'thigh_' + s, [(p, (0.012, 0.06, 0.07)), (p + Vector((sg * 0.006, 0, 0.06)), (0.012, 0.062, 0.016))], 0.004, (0.5, 3))])
# scarf: knotted round the neck, tails down the chest (rigid to chest), knit texture
def two_tone(ob, ida, idb, band_of):
    """Paint faces with two materials (scarf stripes): band_of(face centre) -> 0/1."""
    ob.data.materials.clear(); ob.data.materials.append(mat(ida)); ob.data.materials.append(mat(idb))
    for p in ob.data.polygons: p.material_index = band_of(Vector(p.center))
    return ob
sb = Blob()
pts = [NK + Vector((math.cos(a) * 0.088 * G, math.sin(a) * 0.082 * G, -0.012 + 0.006 * math.sin(2 * a))) for a in [k / 24 * math.tau for k in range(25)]]
for a, b2 in zip(pts[:-1], pts[1:]): sb.chain(a, b2, (0.028, 0.03), (0.028, 0.03), ref=Vector((0, 0, 1)), n=2)
wrap = sb.build('scarfWrap', 0.004, (0.5, 3), tris=1200); displace(wrap, 0.0012, 200)
two_tone(wrap, ID['scarfA'], ID['scarfB'], lambda c: int(((math.atan2(c.y - NK.y, c.x - NK.x) + math.pi) / math.tau * 10)) % 2)
tail_pts = [on_surface(NK + Vector((0.04 + 0.004 * k, 0, -0.03 - 0.03 * k)), FRONT, 0.02) for k in range(7)]   # hangs clear of the chest
tail_top = tail_pts[0]
tb = Blob()
for a, b2 in zip(tail_pts[:-1], tail_pts[1:]): tb.chain(a, b2, (0.034, 0.008), (0.033, 0.008), n=3)
tail = tb.build('scarfTail', 0.0035, (0.4, 2), tris=900); displace(tail, 0.001, 200)
two_tone(tail, ID['scarfA'], ID['scarfB'], lambda c: int((tail_top.z - c.z) / 0.055) % 2)
for o in (wrap, tail): o['bone'] = 'chest'
acc('scarf', [wrap, tail])

# slightly bigger-than-life head: scale everything on the head bone about the head centre
for o in PARTS + ACC:
    if o.get('bone', 'head') != 'head': continue
    for v in o.data.vertices: v.co = HC + (v.co - HC) * HS

# ------------------------------------------------------------------ skinning
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# weight cleanup: automatic weights let the legs grab the lower back and belly, and the arms grab the ribs.
# Fade those influences out by height / distance, then renormalise.
def clean_weights():
    vg = {g.index: g.name for g in body.vertex_groups}
    for v in body.data.vertices:
        w = {vg[g.group]: g.weight for g in v.groups if g.group in vg}
        if not w: continue
        z, ax = v.co.z, abs(v.co.x)
        for n in list(w):
            if n.startswith('thigh'):
                w[n] *= max(0.0, min(1.0, (J['hips'].z + 0.02 - z) / 0.08))          # nothing above the hip line
                if n.endswith('_L') != (v.co.x > 0) and ax > 0.03: w[n] *= 0.2         # nor the other leg's side
            if n.startswith(('upperArm', 'forearm')):
                side_ok = n.endswith('_L') == (v.co.x > 0)
                reach = abs(J[n].x) - 0.09
                if not side_ok or ax < reach: w[n] *= max(0.0, min(1.0, (ax - reach + 0.06) / 0.06)) if side_ok else 0.0
        tot = sum(w.values())
        if tot < 1e-4:   # fall back to the spine
            w = {'spine': 1.0}; tot = 1.0
        for n, x in w.items():
            g = body.vertex_groups.get(n) or body.vertex_groups.new(name=n)
            g.add([v.index], x / tot, 'REPLACE')
clean_weights()
for o in PARTS + ACC:
    bone = o.get('bone', 'head')
    vg = o.vertex_groups.new(name=bone)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    o.parent = rig
    md = o.modifiers.new('arm', 'ARMATURE'); md.object = rig

# ------------------------------------------------------------------ poses (preview) — rotations in degrees per bone, local XYZ
def pose(name, rots, loc=None):
    pb = rig.pose.bones
    for b in pb: b.rotation_mode = 'XYZ'; b.rotation_euler = (0, 0, 0); b.location = (0, 0, 0)
    for bn, (x, y, z) in rots.items():
        if bn.endswith('_R'): y, z = -y, -z           # poses are written for the left side; the right mirrors
        if bn in pb: pb[bn].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
    if loc: pb['root'].location = loc
    bpy.context.view_layer.update()

# Axis conventions (rig built with each bone's local Z facing forward):
#   spine/neck/head (pointing up):  X+ = lean forward, Y = twist, Z = side bend
#   arms/legs (pointing down):      X+ = swing forward (knee bend = shin X-, elbow bend = forearm X+), Z+ = out to the side
#   left side as written; the right side mirrors Y and Z.
POSES = {
    'tpose': {},
    'stand': {'upperArm_L': (4, 0, -6), 'forearm_L': (14, 0, 0), 'upperArm_R': (4, 0, -6), 'forearm_R': (14, 0, 0)},
    'guard': {'hips': (0, 22, 0), 'spine': (6, -6, 0), 'chest': (6, -12, 0), 'head': (-8, 6, 0),
              'upperArm_L': (40, 0, 12), 'forearm_L': (115, 0, 0), 'upperArm_R': (30, 0, 18), 'forearm_R': (125, 0, 0),
              'thigh_L': (24, 0, 4), 'shin_L': (-26, 0, 0), 'foot_L': (6, 0, 0), 'thigh_R': (-14, 0, 6), 'shin_R': (-22, 0, 0), 'foot_R': (20, 0, 0)},
    'kick': {'hips': (0, 15, 0), 'spine': (-10, 0, 0), 'chest': (-8, -8, 0), 'head': (12, 0, 0),
             'upperArm_L': (30, 0, 40), 'forearm_L': (90, 0, 0), 'upperArm_R': (-20, 0, 45), 'forearm_R': (70, 0, 0),
             'thigh_R': (95, 0, 0), 'shin_R': (-12, 0, 0), 'foot_R': (-25, 0, 0), 'thigh_L': (-6, 0, 0), 'shin_L': (-14, 0, 0)},
}

def preview(path):
    """Preview sheet: full body 3/4, side, guard, kick, head close-up (front 3/4)."""
    import tempfile
    cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'
    cam = link(bpy.data.objects.new('cam', cam_d)); scene.camera = cam
    sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 3.2; sun_d.angle = math.radians(8)
    sun = link(bpy.data.objects.new('sun', sun_d)); sun.rotation_euler = Euler((math.radians(50), 0, math.radians(-30)))
    fill_d = bpy.data.lights.new('fill', 'SUN'); fill_d.energy = 0.9
    fill = link(bpy.data.objects.new('fill', fill_d)); fill.rotation_euler = Euler((math.radians(65), 0, math.radians(150)))
    rim_d = bpy.data.lights.new('rim', 'SUN'); rim_d.energy = 1.4
    rim = link(bpy.data.objects.new('rim', rim_d)); rim.rotation_euler = Euler((math.radians(70), 0, math.radians(200)))
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.12, 0.11, 0.14, 1); bg.inputs[1].default_value = 1.0
    floor_m = bpy.data.meshes.new('floor'); floor_m.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    link(bpy.data.objects.new('floor', floor_m)); fm = mat(99); fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.3, 0.28, 0.26, 1); floor_m.materials.append(fm)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'AgX'
    show = set(JOB.get('previewAcc', ['hair:crop', 'scarf']))
    for o in ACC: o.hide_render = o['tags'][4:] not in show
    views = [('stand', 30, 2.1, 0.95, 20), ('stand', 90, 2.1, 0.95, 20), ('guard', 35, 2.1, 0.95, 20), ('kick', 60, 2.1, 0.95, 20), ('stand', 25, 0.42, 1.62, 8)]
    tiles = []; tmpd = tempfile.mkdtemp(prefix='charv2_')   # private dir: other renders may run at the same time
    for i, (pn, yaw, ortho, cz, elev) in enumerate(views):
        pose(pn, POSES.get(pn, {}))
        rig.rotation_euler = (0, 0, math.radians(yaw))
        cam_d.ortho_scale = ortho
        cam.rotation_euler = Euler((math.radians(90 - elev), 0, 0))
        fwd = Vector((0, 0, -1)); fwd.rotate(cam.rotation_euler)
        cam.location = Vector((0, 0, cz * H * (HS if i == 4 else 1))) - fwd * 10
        scene.render.resolution_x = 420; scene.render.resolution_y = 620
        fp = os.path.join(tmpd, 'tile_%d.png' % i)
        scene.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        tiles.append(fp)
    imgs = [bpy.data.images.load(t) for t in tiles]
    n = len(imgs); w0, h0 = imgs[0].size; W = w0 * n
    out = bpy.data.images.new('sheet', W, h0, alpha=True)
    px = [0.0] * (W * h0 * 4)
    for k, im in enumerate(imgs):
        src = list(im.pixels)
        for y in range(h0):
            px[(y * W + k * w0) * 4:(y * W + k * w0 + w0) * 4] = src[y * w0 * 4:(y + 1) * w0 * 4]
    out.pixels = px
    out.filepath_raw = path; out.file_format = 'PNG'; out.save()
    print('PREVIEW', path)

def stats():
    rows = sorted(((tri_count(o), o.name) for o in [body] + PARTS + ACC), reverse=True)
    print('TRIS total %d | %s' % (sum(r[0] for r in rows), ', '.join('%s %d' % (n, t) for t, n in rows[:12])))
stats()

if JOB.get('preview'):
    preview(P(JOB['preview']))
if JOB.get('out'):
    pose('tpose', {})
    for o in ACC: o.hide_render = False
    rig['hooligan'] = json.dumps({'v': 3, 'build': BUILD, 'torso': TORSO, 'girth': G, 'height': H, 'headCentre': list(HC), 'headScale': HS})
    out = P(JOB['out']); os.makedirs(os.path.dirname(out), exist_ok=True)
    # Draco-compressed (about 6x smaller; the runtime decodes with three's DRACOLoader)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_extras=True, export_yup=True,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10)
    print('EXPORTED', out)
