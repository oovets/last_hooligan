# THE LAST HOOLIGAN — character v2 builder (Blender 5.x, headless). Skinned bodies + keyframed animations.
#
#   Blender -b --factory-startup --python scripts/blender/char_v2.py -- <job.json>
#
# job.json: { "build": "m"|"h"|"f", "torso": "jacket"|"parka"|"tee"|"hivis", "out": "assets/models/v2/m_jacket.glb",
#             "preview": "path.png" (optional: render a preview sheet instead of / as well as exporting),
#             "previewPoses": ["tpose","guard",...] }
#
# The body is one skinned mesh grown from a joint graph with the Skin modifier, smoothed, then skinned to a named
# humanoid armature with automatic weights. Clothing regions are materials on that mesh (ID_<n>, same ids and
# runtime palette as the sprites / v1 models); the jacket region is pushed out along the normals for a real silhouette.
# The head is a separate, rigidly skinned mesh with a face; hair/hats/scarf are accessory meshes tagged 'acc:<layer>'.
#
# Character faces Blender -Y (front). glTF converts to +Z forward, +Y up.

import bpy, bmesh, json, math, os, sys
from mathutils import Vector, Matrix, Euler, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
JOB = json.load(open(argv[0])) if argv else {'build': 'm', 'torso': 'jacket', 'preview': '/tmp/char_v2.png'}
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def P(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)

ID = dict(skin=1, hair=2, jacket=3, trim=4, lining=5, shirt=6, pants=7, pantsTrim=8, shoes=9, sole=10,
          scarfA=11, scarfB=12, eye=13, hat=14, hatTrim=15, glove=16, band=17, facial=18, shades=19, mouth=20, belt=21, stripe=22)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
BUILD = JOB.get('build', 'm')
TORSO = JOB.get('torso', 'jacket')
FEM = BUILD == 'f'
G = {'m': 1.0, 'h': 1.32, 'f': 0.9}[BUILD]          # girth
H = {'m': 1.0, 'h': 1.02, 'f': 0.95}[BUILD]         # height

# ------------------------------------------------------------------ materials (preview colours; runtime recolours by name)
PREVIEW = {1: (0.85, 0.62, 0.48), 2: (0.2, 0.13, 0.08), 3: (0.12, 0.2, 0.12), 4: (0.08, 0.12, 0.08), 5: (0.7, 0.12, 0.1),
           6: (0.9, 0.9, 0.86), 7: (0.18, 0.26, 0.42), 8: (0.3, 0.4, 0.6), 9: (0.92, 0.92, 0.9), 10: (0.7, 0.6, 0.42),
           11: (0.78, 0.06, 0.18), 12: (0.95, 0.94, 0.9), 13: (0.05, 0.03, 0.03), 18: (0.15, 0.1, 0.06), 20: (0.45, 0.15, 0.15),
           21: (0.15, 0.1, 0.07), 22: (0.12, 0.2, 0.12), 14: (0.6, 0.05, 0.1), 15: (0.9, 0.9, 0.9), 19: (0.03, 0.03, 0.05), 17: (0.9, 0.9, 0.95)}
MATS = {}
def mat(idn):
    if idn in MATS: return MATS[idn]
    m = bpy.data.materials.new('ID_%d' % idn)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    c = PREVIEW.get(idn, (0.5, 0.5, 0.5))
    if b:
        b.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1)
        b.inputs['Roughness'].default_value = 0.75 if idn not in (13, 19) else 0.2
    m.diffuse_color = (c[0], c[1], c[2], 1)
    MATS[idn] = m
    return m

def link(ob):
    scene.collection.objects.link(ob)
    return ob

# ------------------------------------------------------------------ skeleton (metres, Blender Z-up, facing -Y)
# joint positions in a relaxed A-pose; x = character's left (+) / right (-)
def V(x, y, z): return Vector((x, y, z * H))
SW = (0.2 if not FEM else 0.175) * (0.92 + 0.08 * G)     # shoulder half-width
HW = (0.1 if not FEM else 0.11) * (0.95 + 0.05 * G)      # hip half-width
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
    J['forearm_' + s] = V(sg * (SW + 0.08), 0.04, 1.1)
    J['hand_' + s] = V(sg * (SW + 0.12), 0.0, 0.87)
    J['handEnd_' + s] = V(sg * (SW + 0.14), -0.01, 0.76)
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

# ------------------------------------------------------------------ body: skin modifier over the joint graph
# radii: (lateral, front-back) in metres
R = {
    'hips': (0.155 * G, 0.11 * G), 'spine': (0.145 * G + (0.03 if BUILD == 'h' else 0), 0.105 * G + (0.04 if BUILD == 'h' else 0)),
    'chest': ((0.165 if not FEM else 0.15) * G, 0.11 * G), 'neck': (0.055 * (0.9 + 0.1 * G), 0.055 * (0.9 + 0.1 * G)),
    'head': (0.07, 0.07), 'headTop': (0.03, 0.03),
}
for s in ('L', 'R'):
    R['shoulder_' + s] = (0.078 * G, 0.075 * G)
    R['upperArm_' + s] = (0.066 * G, 0.064 * G)
    R['forearm_' + s] = (0.055 * G, 0.052 * G)
    R['hand_' + s] = (0.05, 0.038)
    R['handEnd_' + s] = (0.045, 0.03)
    R['thigh_' + s] = (0.098 * G, 0.095 * G)
    R['shin_' + s] = (0.068 * (0.9 + 0.1 * G), 0.066 * (0.9 + 0.1 * G))
    R['foot_' + s] = (0.052, 0.05)
    R['toe_' + s] = (0.052, 0.04)
    R['toeEnd_' + s] = (0.042, 0.025)

EDGES = [('hips', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'head')]
for s in ('L', 'R'):
    EDGES += [('chest', 'shoulder_' + s), ('shoulder_' + s, 'upperArm_' + s), ('upperArm_' + s, 'forearm_' + s), ('forearm_' + s, 'hand_' + s),
              ('hand_' + s, 'handEnd_' + s), ('hips', 'thigh_' + s), ('thigh_' + s, 'shin_' + s), ('shin_' + s, 'foot_' + s),
              ('foot_' + s, 'toe_' + s), ('toe_' + s, 'toeEnd_' + s)]
names = [n for n in J if n not in ('root', 'headTop')]
idx = {n: i for i, n in enumerate(names)}
me = bpy.data.meshes.new('body')
me.from_pydata([J[n] for n in names], [(idx[a], idx[b]) for a, b in EDGES], [])
body = link(bpy.data.objects.new('body', me))
sk = body.modifiers.new('skin', 'SKIN')
sk.branch_smoothing = 0.6
sk.use_smooth_shade = True
for n, i in idx.items():
    sv = me.skin_vertices[0].data[i]
    rx, ry = R.get(n, (0.05, 0.05))
    sv.radius = (rx, ry)
    if n == 'hips': sv.use_root = True
sub = body.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
bpy.context.view_layer.objects.active = body
for m in list(body.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

# ------------------------------------------------------------------ clothing regions by nearest bone
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
JACKET_BONES = {'spine', 'chest', 'shoulder_L', 'shoulder_R', 'upperArm_L', 'upperArm_R'} | ({'forearm_L', 'forearm_R'} if TORSO != 'tee' else set())
for n in ('hips',): pass
bm = bmesh.new(); bm.from_mesh(me)
bm.normal_update()
slot = {}
def S(idn):
    k = 'ID_%d' % idn
    if k not in slot: me.materials.append(mat(idn)); slot[k] = len(me.materials) - 1
    return slot[k]
push = {}
for f in bm.faces:
    c = f.calc_center_median()
    n, t = region(c)
    mid = ID['skin']
    if n in JACKET_BONES: mid = ID['jacket'] if TORSO != 'tee' else ID['shirt']
    if n == 'forearm_L' or n == 'forearm_R':
        if TORSO != 'tee' and t > 0.88: mid = ID['trim']          # cuffs
    if n == 'hips':
        mid = ID['pants'] if c.z < J['hips'].z + 0.02 else (ID['jacket'] if TORSO != 'tee' else ID['shirt'])
        if abs(c.z - (J['hips'].z + 0.04)) < 0.02 and TORSO == 'tee': mid = ID['belt']
    if n and n.startswith(('thigh', 'shin')): mid = ID['pants']
    if n and n.startswith('shin') and t > 0.86: mid = ID['pantsTrim']
    if n and n.startswith(('foot', 'toe')): mid = ID['shoes'] if c.z > 0.035 else ID['sole']
    if n == 'chest' and TORSO in ('jacket', 'hivis') and abs(c.x) < 0.035 and c.y < 0: mid = ID['shirt']   # open front
    if n == 'neck': mid = ID['skin']
    if n and n.startswith('hand'): mid = ID['skin']
    f.material_index = S(mid)
    if mid in (ID['jacket'], ID['trim']) and TORSO != 'tee':
        for v in f.verts: push[v.index] = 0.018 if TORSO != 'parka' else 0.03
    if mid in (ID['pants'], ID['pantsTrim']):
        for v in f.verts: push[v.index] = max(push.get(v.index, 0), 0.008)
    if mid in (ID['shoes'], ID['sole']):
        for v in f.verts: push[v.index] = max(push.get(v.index, 0), 0.012)
for v in bm.verts:
    if v.index in push: v.co += v.normal * push[v.index]
# heavy build: belly
if BUILD == 'h':
    for v in bm.verts:
        if 0.95 < v.co.z < 1.3 and v.co.y < 0:
            k = math.exp(-((v.co.z - 1.1) / 0.12) ** 2) * math.exp(-(v.co.x / 0.16) ** 2)
            v.co.y -= 0.06 * k
bm.to_mesh(me); bm.free()
for p in me.polygons: p.use_smooth = True

# ------------------------------------------------------------------ head with a face (rigid to 'head')
ACC = []
def obj_from_bm(name, bm, idn, tags='', parent_bone='head'):
    m = bpy.data.meshes.new(name); bm.to_mesh(m); bm.free()
    for p in m.polygons: p.use_smooth = True
    m.materials.append(mat(idn))
    o = link(bpy.data.objects.new(name, m))
    o['tags'] = tags
    o['bone'] = parent_bone
    return o
def ellipsoid(c, r, seg=20, rings=14):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2])) + c
    return bm
HC = J['head'] + Vector((0, -0.01, 0.12))
HS = 1.15   # stylised big head
# skull: slightly squarer jaw by pushing the lower front
bmh = ellipsoid(HC, (0.095, 0.105, 0.118), 24, 18)
for v in bmh.verts:
    d = v.co - HC
    if d.z < -0.03: v.co.x *= 0.92 + 0.08 * (1 + d.z / 0.12); v.co.y += 0.012 * max(0, -d.z - 0.03) / 0.08
    if d.y < -0.06 and -0.02 < d.z < 0.04: v.co.y -= 0.004      # brow/cheek fullness
parts = [obj_from_bm('skull', bmh, ID['skin'])]
nose = ellipsoid(HC + Vector((0, -0.103, -0.01)), (0.016, 0.022, 0.03), 10, 8); parts.append(obj_from_bm('nose', nose, ID['skin']))
for s in (-1, 1):
    parts.append(obj_from_bm('ear%d' % s, ellipsoid(HC + Vector((s * 0.094, 0.0, 0.0)), (0.012, 0.02, 0.03), 10, 8), ID['skin']))
    parts.append(obj_from_bm('eye%d' % s, ellipsoid(HC + Vector((s * 0.035, -0.092, 0.018)), (0.013, 0.008, 0.01), 10, 8), ID['eye']))
    b = bmesh.new(); bmesh.ops.create_cube(b, size=1.0)
    for v in b.verts: v.co = Vector((v.co.x * 0.035, v.co.y * 0.012, v.co.z * 0.01)) + HC + Vector((s * 0.036, -0.097, 0.04))
    parts.append(obj_from_bm('brow%d' % s, b, ID['hair']))
b = bmesh.new(); bmesh.ops.create_cube(b, size=1.0)
for v in b.verts: v.co = Vector((v.co.x * 0.04, v.co.y * 0.008, v.co.z * 0.008)) + HC + Vector((0, -0.1, -0.055))
parts.append(obj_from_bm('mouth', b, ID['mouth']))

# hair / hats / facial hair / shades / scarf (accessories)
def hair_cap(name, sx=1.0, zcut=-0.04, extra=0.012, front=0.0):
    bmc = ellipsoid(HC + Vector((0, 0.008, 0.012)), ((0.095 + extra) * sx, 0.105 + extra, 0.118 + extra), 24, 16)
    for v in bmc.verts:
        d = v.co - HC
        lim = zcut + (0.075 if d.y < -0.05 else 0.02 if d.y < 0 else 0) - front
        if d.z < lim: v.co.z = HC.z + lim
    return obj_from_bm(name, bmc, ID['hair'])
def acc(name, objs):
    for o in objs: o['tags'] = 'acc:' + name
    ACC.extend(objs)
acc('hair:crop', [hair_cap('crop')])
acc('hair:shaved', [hair_cap('shaved', extra=0.004)])
acc('hair:mod', [hair_cap('mod', extra=0.02, zcut=-0.07, front=0.02)])
acc('hair:curtains', [hair_cap('curtains', extra=0.016, zcut=-0.06)])
acc('hair:long', [hair_cap('longCap', extra=0.016, zcut=-0.08), obj_from_bm('longBack', ellipsoid(HC + Vector((0, 0.07, -0.1)), (0.08, 0.05, 0.13)), ID['hair'])])
acc('hair:ponytail', [hair_cap('ptCap', extra=0.012), obj_from_bm('ptTail', ellipsoid(HC + Vector((0, 0.12, -0.04)), (0.03, 0.03, 0.11)), ID['hair'])])
acc('hair:bob', [hair_cap('bob', extra=0.02, zcut=-0.1)])
acc('hair:spiky', [hair_cap('spikyBase', extra=0.01)] + [obj_from_bm('spike%d' % i, ellipsoid(HC + Vector(((i % 3 - 1) * 0.04, (i // 3 - 0.5) * 0.06, 0.13)), (0.018, 0.018, 0.035), 8, 6), ID['hair']) for i in range(6)])
acc('hair:mohawk', [obj_from_bm('mohawk', ellipsoid(HC + Vector((0, 0.0, 0.11)), (0.018, 0.1, 0.05)), ID['hair'])])
acc('hair:flattop', [hair_cap('flatSides', extra=0.01), obj_from_bm('flat', ellipsoid(HC + Vector((0, 0, 0.12)), (0.1, 0.105, 0.04)), ID['hair'])])
acc('face:beard', [obj_from_bm('beard', ellipsoid(HC + Vector((0, -0.04, -0.07)), (0.085, 0.07, 0.06)), ID['facial'])])
acc('face:tache', [obj_from_bm('tache', ellipsoid(HC + Vector((0, -0.102, -0.035)), (0.03, 0.01, 0.008), 10, 6), ID['facial'])])
acc('face:shades', [obj_from_bm('shades', ellipsoid(HC + Vector((0, -0.098, 0.018)), (0.075, 0.012, 0.018), 12, 6), ID['shades'])])
acc('hat:cap', [obj_from_bm('capDome', ellipsoid(HC + Vector((0, 0.005, 0.04)), (0.102, 0.112, 0.09), 20, 10), ID['hat']),
                obj_from_bm('capBrim', ellipsoid(HC + Vector((0, -0.13, 0.04)), (0.075, 0.06, 0.008), 16, 6), ID['hatTrim'])])
acc('hat:beanie', [obj_from_bm('beanie', ellipsoid(HC + Vector((0, 0.005, 0.05)), (0.104, 0.114, 0.105)), ID['hat']),
                   obj_from_bm('bobble', ellipsoid(HC + Vector((0, 0.01, 0.17)), (0.03, 0.03, 0.03), 10, 8), ID['hatTrim'])])
acc('hat:bucket', [obj_from_bm('bucket', ellipsoid(HC + Vector((0, 0, 0.06)), (0.105, 0.115, 0.08)), ID['hat']),
                   obj_from_bm('bucketBrim', ellipsoid(HC + Vector((0, 0, 0.025)), (0.15, 0.16, 0.01), 20, 6), ID['hat'])])
acc('hat:helmet', [obj_from_bm('helmet', ellipsoid(HC + Vector((0, 0, 0.03)), (0.11, 0.12, 0.125)), ID['hat'])])
# scarf: knotted round the neck, tails down the chest (rigid to chest)
scarf = []
NK = J['neck'] + Vector((0, 0.005, 0.0))
def scarf_tube(name, pts, rad, idn):
    # a flattened tube along points (soft knit scarf)
    bm = bmesh.new(); rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = d.orthogonal().normalized(); b = d.cross(a).normalized()
        ring = [bm.verts.new(p + a * math.cos(t) * rad[0] + b * math.sin(t) * rad[1]) for t in [k / 10 * math.tau for k in range(10)]]
        rings.append(ring)
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for k in range(10): bm.faces.new((r0[k], r0[(k + 1) % 10], r1[(k + 1) % 10], r1[k]))
    return obj_from_bm(name, bm, idn, parent_bone='chest')
for k in range(8):   # wrap: alternating colour bands round the neck
    a0, a1 = k / 8 * math.tau, (k + 1) / 8 * math.tau + 0.05
    pts = [NK + Vector((math.cos(a) * 0.088 * G, math.sin(a) * 0.08 * G, -0.01)) for a in [a0 + (a1 - a0) * t / 3 for t in range(4)]]
    scarf.append(scarf_tube('scarfWrap%d' % k, pts, (0.03, 0.028), ID['scarfA'] if k % 2 else ID['scarfB']))
for k in range(4):   # hanging tail
    z0 = -0.04 - k * 0.07
    pts = [NK + Vector((0.04, -0.1 * G - 0.004 * k, z0 - t * 0.024)) for t in range(4)]
    scarf.append(scarf_tube('scarfTail%d' % k, pts, (0.034, 0.011), ID['scarfA'] if k % 2 == 0 else ID['scarfB']))
acc('scarf', scarf)
# jacket collar (part of the jacket models)
if TORSO in ('jacket', 'hivis', 'parka'):
    col = bmesh.new()
    for i in range(16):
        pass
    parts.append(obj_from_bm('collar', ellipsoid(J['neck'] + Vector((0, 0.01, -0.02)), (0.085 * G, 0.075 * G, 0.03), 18, 6), ID['trim'], parent_bone='chest'))

# stylised big head: scale everything on the head bone about the head centre
for o in parts + ACC:
    if o.get('bone', 'head') != 'head': continue
    for v in o.data.vertices: v.co = HC + (v.co - HC) * HS

# ------------------------------------------------------------------ skinning
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for o in parts + ACC:
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
    'guard': {'hips': (0, 22, 0), 'spine': (6, -6, 0), 'chest': (6, -12, 0), 'head': (-8, 6, 0),
              'upperArm_L': (40, 0, 12), 'forearm_L': (115, 0, 0), 'upperArm_R': (30, 0, 18), 'forearm_R': (125, 0, 0),
              'thigh_L': (24, 0, 4), 'shin_L': (-26, 0, 0), 'foot_L': (6, 0, 0), 'thigh_R': (-14, 0, 6), 'shin_R': (-22, 0, 0), 'foot_R': (20, 0, 0)},
    'jab': {'hips': (0, 34, 0), 'spine': (8, -10, 0), 'chest': (8, -20, 0), 'head': (-10, 10, 0),
            'upperArm_L': (85, 0, 4), 'forearm_L': (8, 0, 0), 'upperArm_R': (30, 0, 18), 'forearm_R': (125, 0, 0),
            'thigh_L': (30, 0, 4), 'shin_L': (-24, 0, 0), 'thigh_R': (-18, 0, 6), 'shin_R': (-16, 0, 0), 'foot_R': (16, 0, 0)},
    'kick': {'hips': (0, 15, 0), 'spine': (-10, 0, 0), 'chest': (-8, -8, 0), 'head': (12, 0, 0),
             'upperArm_L': (30, 0, 40), 'forearm_L': (90, 0, 0), 'upperArm_R': (-20, 0, 45), 'forearm_R': (70, 0, 0),
             'thigh_R': (95, 0, 0), 'shin_R': (-12, 0, 0), 'foot_R': (-25, 0, 0), 'thigh_L': (-6, 0, 0), 'shin_L': (-14, 0, 0)},
}

def preview(path, which):
    # game camera: ortho, looking down 30°, from the front-right
    cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 2.4
    cam = link(bpy.data.objects.new('cam', cam_d))
    scene.camera = cam
    sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 3.5
    sun = link(bpy.data.objects.new('sun', sun_d)); sun.rotation_euler = Euler((math.radians(50), 0, math.radians(-30)))
    fill_d = bpy.data.lights.new('fill', 'SUN'); fill_d.energy = 0.8
    fill = link(bpy.data.objects.new('fill', fill_d)); fill.rotation_euler = Euler((math.radians(60), 0, math.radians(150)))
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.08, 0.07, 0.1, 1); bg.inputs[1].default_value = 1
    floor_m = bpy.data.meshes.new('floor'); floor_m.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    fl = link(bpy.data.objects.new('floor', floor_m)); fm = mat(99); fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.25, 0.22, 0.2, 1); floor_m.materials.append(fm)
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 360 * len(which); scene.render.resolution_y = 420
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    # one rig instance per pose, side by side: easiest is to render each pose separately and stitch
    import tempfile
    tiles = []
    show = set(JOB.get('previewAcc', ['hair:crop', 'scarf']))
    for o in ACC: o.hide_render = o['tags'][4:] not in show
    views = [(pn, 35) for pn in which] + [(pn, 90) for pn in which]
    for i, (pn, yaw) in enumerate(views):
        pose(pn, POSES.get(pn, {}))
        rig.rotation_euler = (0, 0, math.radians(yaw))
        cam.rotation_euler = Euler((math.radians(60), 0, math.radians(45)))
        fwd = Vector((0, 0, -1)); fwd.rotate(cam.rotation_euler)
        cam.location = Vector((0, 0, 0.95 * H)) - fwd * 10
        scene.render.resolution_x = 360
        fp = os.path.join(tempfile.gettempdir(), 'cv2_%d.png' % i)
        scene.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        tiles.append(fp)
    # stitch
    imgs = [bpy.data.images.load(t) for t in tiles]
    n = len(which); W = imgs[0].size[0] * n; Hh = imgs[0].size[1] * 2
    out = bpy.data.images.new('sheet', W, Hh, alpha=True)
    px = [0.0] * (W * Hh * 4)
    for k, im in enumerate(imgs):
        w0, h0 = im.size; src = list(im.pixels)
        ox = (k % n) * w0; oy = (1 - k // n) * h0
        for y in range(h0):
            px[((y + oy) * W + ox) * 4:((y + oy) * W + ox + w0) * 4] = src[y * w0 * 4:(y + 1) * w0 * 4]
    out.pixels = px
    out.filepath_raw = path; out.file_format = 'PNG'; out.save()
    print('PREVIEW', path)

if JOB.get('preview'):
    preview(P(JOB['preview']), JOB.get('previewPoses', ['tpose', 'guard', 'jab', 'kick']))
if JOB.get('out'):
    pose('tpose', {})
    for o in ACC: o.hide_render = False
    rig['hooligan'] = json.dumps({'v': 2, 'build': BUILD, 'torso': TORSO, 'girth': G, 'height': H, 'headCentre': list(HC), 'headScale': HS})
    out = P(JOB['out']); os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_extras=True, export_yup=True)
    print('EXPORTED', out)
