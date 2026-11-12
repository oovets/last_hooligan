# THE LAST HOOLIGAN — Blender character sprite renderer (Blender 5.x, run headless).
#
#   Blender -b --factory-startup --python scripts/blender/render_char.py -- <job.json>
#
# job.json:
# {
#   "model": { "build": 1.0, "height": 1.0, "torso": "jacket"|"parka"|"tee"|"hivis", "female": false, "heavyBelly": 0 },
#   "variants": [ { "name": "body", "acc": [] }, { "name": "hair_crop", "acc": ["hair:crop"] }, ... ],
#   "clips": "assets/sprites/clips.json", "clipNames": null | [..subset..],
#   "out": "build/sprites/<model>", "res": 128, "dirs": [0,1,2,6,7], "samples": 6,
#   "preview": false   (true -> renders a handful of frames only)
# }
# Output per variant/dir/frame: <out>/<variant>/d<dir>/id_<frame>.png (flat material ids, no AA) and sh_<frame>.png (lighting)
# Directions are GAME-world facings at 45° steps: 0=(1,0) screen down-right, 1=(1,1) down, 2=(0,1) down-left, 3=(-1,1) left,
# 4=(-1,0) up-left, 5=(-1,-1) up, 6=(0,-1) up-right, 7=(1,-1) right. (Game x -> Blender Y, game y -> Blender X.)
#
# Material ids (palette keys used by src/game/sprites.js):
ID = dict(skin=1, hair=2, jacket=3, trim=4, lining=5, shirt=6, pants=7, pantsTrim=8, shoes=9, sole=10,
          scarfA=11, scarfB=12, eye=13, hat=14, hatTrim=15, glove=16, band=17, facial=18, shades=19, mouth=20, belt=21, stripe=22)

import bpy, bmesh, json, math, os, sys, time
from mathutils import Vector, Matrix, Euler, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
JOB = json.load(open(argv[0]))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def P(p): return p if os.path.isabs(p) else os.path.join(ROOT, p)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
M = JOB['model']
B = M.get('build', 1.0)          # girth
HS = M.get('height', 1.0)        # overall scale
FEM = M.get('female', False)
TORSO = M.get('torso', 'jacket')
k = 0.04                          # metres per doll pixel (doll is ~46 px tall)

# ------------------------------------------------------------------ materials
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
MATS = {}
def mat(idn):
    if idn in MATS: return MATS[idn]
    m = bpy.data.materials.new('ID_%d' % idn)
    v = srgb_to_lin(idn * 10 / 255.0)
    m.diffuse_color = (v, 0.0, 0.0, 1.0)
    MATS[idn] = m
    return m
WHITE = bpy.data.materials.new('WHITE')
WHITE.use_nodes = True
bsdf = WHITE.node_tree.nodes.get('Principled BSDF')
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    bsdf.inputs['Roughness'].default_value = 0.65
    try: bsdf.inputs['Specular IOR Level'].default_value = 0.35
    except Exception: pass

# ------------------------------------------------------------------ mesh helpers
def link(ob, parent=None):
    scene.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    link(e, parent)
    e.location = loc
    e.rotation_mode = 'XYZ'
    return e

def mesh_obj(name, bm, idn, parent, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True, tags=()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    me.materials.append(mat(idn))
    ob = bpy.data.objects.new(name, me)
    link(ob, parent)
    ob.location = loc
    ob.rotation_euler = rot
    ob['tags'] = ','.join(tags)
    return ob

def bm_capsule(r1, r2, length, seg=12, rings=4, sy=1.0, sx=1.0):
    """Tapered capsule from z=0 (radius r1) down to z=-length (radius r2). sx/sy squash the cross-section."""
    bm = bmesh.new()
    rows = []
    # top hemisphere
    for i in range(rings, 0, -1):
        a = (i / rings) * (math.pi / 2)
        rows.append((math.sin(a) * r1, -0.0 + math.cos(a) * 0 + 0, r1 * math.cos(a)))  # (z offset, ring radius placeholder)
    rows = []
    for i in range(rings, -1, -1):
        a = (i / rings) * (math.pi / 2)
        rows.append((r1 * math.sin(a), r1 * math.cos(a)))           # z, radius
    for i in range(1, rings + 1):
        a = (i / rings) * (math.pi / 2)
        rows.append((-length - r2 * math.sin(a), r2 * math.cos(a)))
    verts = []
    for z, r in rows:
        ring = []
        if r < 1e-5:
            ring = [bm.verts.new((0, 0, z))]
        else:
            for j in range(seg):
                t = 2 * math.pi * j / seg
                ring.append(bm.verts.new((math.cos(t) * r * sx, math.sin(t) * r * sy, z)))
        verts.append(ring)
    for a, b in zip(verts[:-1], verts[1:]):
        if len(a) == 1 and len(b) > 1:
            for j in range(seg): bm.faces.new((a[0], b[(j + 1) % seg], b[j]))
        elif len(b) == 1 and len(a) > 1:
            for j in range(seg): bm.faces.new((a[j], a[(j + 1) % seg], b[0]))
        else:
            for j in range(seg): bm.faces.new((a[j], a[(j + 1) % seg], b[(j + 1) % seg], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def bm_ellipsoid(rx, ry, rz, seg=14, rings=9, zcut=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        v.co.x *= rx; v.co.y *= ry; v.co.z *= rz
    if zcut is not None:
        for v in bm.verts:
            if v.co.z < zcut: v.co.z = zcut
    return bm

def bm_box(sx, sy, sz, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES')
    return bm

def bm_torus(R, r, seg=16, rseg=6, sx=1.0, sy=1.0):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c = Vector((math.cos(a) * R * sx, math.sin(a) * R * sy, 0))
        n = Vector((math.cos(a), math.sin(a), 0))
        ring = []
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            p = c + n * (math.cos(b) * r) + Vector((0, 0, math.sin(b) * r))
            ring.append(bm.verts.new(p))
        rings.append(ring)
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % seg]
        for j in range(rseg):
            bm.faces.new((a[j], a[(j + 1) % rseg], b[(j + 1) % rseg], b[j]))
    return bm

# ------------------------------------------------------------------ rig
# Local frame of every joint: +X forward, +Z up (bind pose), Y lateral (+Y = character's LEFT).
# N (near-camera) limbs in the 2D pose data = character's RIGHT side (-Y).
root = empty('root')
root.scale = (HS, HS, HS)
HIP_H = 20 * k
THIGH = 10 * k; SHIN = 9.6 * k; TORSO_L = 14 * k
UARM = 7.5 * k; FARM = 7.0 * k; HEAD_UP = 4.6 * k
SH_W = (0.2 if not FEM else 0.17) * (0.85 + 0.15 * B)
HIP_W = (0.095 if not FEM else 0.1) * (0.9 + 0.1 * B)

hip = empty('hip', root, (0, 0, HIP_H))
torso = empty('torso', hip, (0, 0, 0.02))
neck = empty('neck', torso, (0, 0, TORSO_L))
head = empty('head', neck, (0, 0, 0))
headS = None
J = {}
for side, sgn in (('N', -1), ('F', 1)):
    sh = empty('sh' + side, torso, (0, sgn * SH_W, TORSO_L - 2.2 * k))
    el = empty('el' + side, sh, (0, 0, -UARM))
    th = empty('th' + side, hip, (0, sgn * HIP_W, 0))
    kn = empty('kn' + side, th, (0, 0, -THIGH))
    an = empty('an' + side, kn, (0, 0, -SHIN))
    J[side] = dict(sh=sh, el=el, th=th, kn=kn, an=an)

# ------------------------------------------------------------------ body build
G = B * 1.12  # girth multiplier (stylised: chunkier than real)
HEADS = 1.16 # head scale (game-y proportions)
belly = M.get('heavyBelly', max(0.0, (B - 1.15) * 1.6))
sleeve_long = TORSO not in ('tee',)
jacket_id = ID['jacket'] if TORSO != 'tee' else ID['shirt']

# torso / jacket
ch = mesh_obj('chest', bm_ellipsoid(0.125 * G, (0.205 if not FEM else 0.175) * (0.85 + 0.15 * G), 0.2), jacket_id, torso, (0.0, 0, TORSO_L * 0.66))
ab = mesh_obj('abdomen', bm_ellipsoid((0.112 + belly * 0.06) * G, 0.17 * (0.85 + 0.15 * G), 0.17), jacket_id, torso, (0.012 + belly * 0.04, 0, TORSO_L * 0.3))
for s in (-1, 1):
    mesh_obj('shoulder%d' % s, bm_ellipsoid(0.085 * G, 0.085 * G, 0.075 * G), jacket_id, torso, (-0.005, s * SH_W * 0.95, TORSO_L - 0.07))
if FEM:
    mesh_obj('bust', bm_ellipsoid(0.06, 0.13, 0.055), jacket_id, torso, (0.085, 0, TORSO_L * 0.66))
# jacket hem / waistband / collar
if TORSO in ('jacket', 'hivis'):
    mesh_obj('waistband', bm_torus(0.135, 0.028, 18, 6, sx=0.85 * (G + belly * 0.4), sy=1.18 * (0.85 + 0.15 * G)), ID['trim'], torso, (0.0, 0, 0.0))
    col = bm_torus(0.07, 0.026, 16, 6, sx=1.05, sy=1.25)
    mesh_obj('collar', col, ID['trim'], torso, (-0.01, 0, TORSO_L - 0.015), (math.radians(-12), 0, 0))
    # open front showing lining + shirt
    mesh_obj('lining', bm_box(0.012, 0.05, 0.36), ID['lining'], torso, (0.122 * G + belly * 0.05, 0, TORSO_L * 0.5), (0, math.radians(-6), 0))
    mesh_obj('shirtV', bm_box(0.012, 0.03, 0.12), ID['shirt'], torso, (0.128 * G, 0, TORSO_L * 0.86), (0, math.radians(-15), 0))
if TORSO == 'parka':
    mesh_obj('parkaSkirt', bm_capsule(0.15 * G, 0.17 * G, 0.18, 16, 3, sy=1.25), ID['jacket'], torso, (0, 0, 0.06))
    mesh_obj('hood', bm_torus(0.085, 0.045, 14, 6, sx=1.1, sy=1.3), ID['trim'], torso, (-0.05, 0, TORSO_L - 0.01), (math.radians(-25), 0, 0))
    mesh_obj('parkaZip', bm_box(0.01, 0.012, 0.42), ID['trim'], torso, (0.125 * G, 0, TORSO_L * 0.5))
if TORSO == 'tee':
    mesh_obj('teeCollar', bm_torus(0.065, 0.016, 14, 5, sx=1.0, sy=1.2), ID['trim'], torso, (0, 0, TORSO_L - 0.02))
if TORSO == 'hivis':
    for z in (0.18, 0.34):
        mesh_obj('band%.2f' % z, bm_torus(0.13, 0.02, 18, 5, sx=0.98 * (G + belly * 0.3), sy=1.33 * (0.85 + 0.15 * G)), ID['band'], torso, (0, 0, z))
# belt (visible when jacket rides up) + pelvis
mesh_obj('pelvis', bm_ellipsoid(0.105 * G, (0.15 if not FEM else 0.16) * (0.85 + 0.15 * G), 0.11), ID['pants'], hip, (0, 0, -0.03))
mesh_obj('belt', bm_torus(0.115, 0.018, 18, 5, sx=0.9 * G, sy=1.3 * (0.85 + 0.15 * G)), ID['belt'], hip, (0, 0, 0.04))
# neck + head
mesh_obj('neckM', bm_capsule(0.05 * (0.9 + 0.1 * G), 0.055 * (0.9 + 0.1 * G), 0.07), ID['skin'], neck, (0, 0, 0.07))
HZ = HEAD_UP
head.scale = (HEADS, HEADS, HEADS)
HZ = HEAD_UP / HEADS + 0.01
mesh_obj('skull', bm_ellipsoid(0.105, 0.092, 0.118), ID['skin'], head, (0.0, 0, HZ + 0.01))
mesh_obj('jaw', bm_ellipsoid(0.085, 0.075, 0.07), ID['skin'], head, (0.028, 0, HZ - 0.05))
mesh_obj('nose', bm_ellipsoid(0.025, 0.018, 0.03), ID['skin'], head, (0.105, 0, HZ - 0.005), (0, math.radians(15), 0))
for s in (-1, 1):
    mesh_obj('ear%d' % s, bm_ellipsoid(0.018, 0.02, 0.032), ID['skin'], head, (-0.005, s * 0.093, HZ - 0.0))
    mesh_obj('eye%d' % s, bm_ellipsoid(0.012, 0.016, 0.014), ID['eye'], head, (0.094, s * 0.036, HZ + 0.012))
    mesh_obj('brow%d' % s, bm_box(0.018, 0.04, 0.012), ID['hair'], head, (0.098, s * 0.037, HZ + 0.042), (math.radians(s * -12), 0, 0))
mesh_obj('mouth', bm_box(0.012, 0.045, 0.01), ID['mouth'], head, (0.098, 0, HZ - 0.06))

# arms
for side in ('N', 'F'):
    j = J[side]
    ua_id = jacket_id if TORSO != 'hivis' else ID['shirt']
    mesh_obj('uarm' + side, bm_capsule(0.066 * G, 0.056 * G, UARM - 0.02, 12, 3), ua_id, j['sh'], (0, 0, 0))
    if TORSO == 'tee':
        mesh_obj('farm' + side, bm_capsule(0.047 * G, 0.04 * G, FARM - 0.02, 10, 3), ID['skin'], j['el'], (0, 0, 0))
    else:
        mesh_obj('farm' + side, bm_capsule(0.054 * G, 0.048 * G, FARM - 0.03, 10, 3), ua_id, j['el'], (0, 0, 0))
        mesh_obj('cuff' + side, bm_capsule(0.05 * G, 0.05 * G, 0.03, 10, 2), ID['trim'], j['el'], (0, 0, -FARM + 0.05))
        # track-top stripe along the outer sleeve (palette can hide it by setting trim = jacket)
        sgn = -1 if side == 'N' else 1
        mesh_obj('stripeU' + side, bm_box(0.012, 0.012, UARM - 0.04), ID['stripe'], j['sh'], (0, sgn * 0.064 * G, -UARM / 2), tags=('stripe',))
        mesh_obj('stripeF' + side, bm_box(0.012, 0.012, FARM - 0.06), ID['stripe'], j['el'], (0, sgn * 0.053 * G, -FARM / 2 + 0.01), tags=('stripe',))
    fist = bm_ellipsoid(0.068 * (0.9 + 0.1 * G), 0.054 * (0.9 + 0.1 * G), 0.07)
    mesh_obj('fist' + side, fist, ID['skin'], j['el'], (0.008, 0, -FARM - 0.02))

# legs
for side in ('N', 'F'):
    j = J[side]
    mesh_obj('thigh' + side, bm_capsule(0.082 * G, 0.066 * G, THIGH - 0.02, 12, 3), ID['pants'], j['th'], (0, 0, 0))
    mesh_obj('shin' + side, bm_capsule(0.062 * (0.9 + 0.1 * G), 0.056 * (0.9 + 0.1 * G), SHIN - 0.05, 12, 3), ID['pants'], j['kn'], (0, 0, 0))
    mesh_obj('turnup' + side, bm_capsule(0.062, 0.062, 0.035, 12, 2), ID['pantsTrim'], j['kn'], (0, 0, -SHIN + 0.075))
    mesh_obj('shoe' + side, bm_ellipsoid(0.115, 0.058, 0.05, 12, 7, zcut=-0.03), ID['shoes'], j['an'], (0.045, 0, -0.012))
    mesh_obj('sole' + side, bm_box(0.2, 0.09, 0.022, 0.006), ID['sole'], j['an'], (0.045, 0, -0.048))
    mesh_obj('ankle' + side, bm_ellipsoid(0.05, 0.05, 0.05), ID['shoes'], j['an'], (0.0, 0, 0.02))

# scarf: wrap around the neck + a hanging tail in alternating stripes
scarf_objs = []
wrap = bm_torus(0.072, 0.03, 16, 6, sx=1.05, sy=1.2)
scarf_objs.append(mesh_obj('scarfWrap', wrap, ID['scarfA'], torso, (0.0, 0, TORSO_L - 0.035), (math.radians(-8), 0, 0)))
for i in range(5):
    sid = ID['scarfA'] if i % 2 == 0 else ID['scarfB']
    o = mesh_obj('scarfTail%d' % i, bm_box(0.022, 0.075, 0.05, 0.004), sid, torso, (0.12 * G + belly * 0.03, -0.055, TORSO_L - 0.08 - i * 0.05), (math.radians(4), math.radians(-4), 0))
    scarf_objs.append(o)
for o in scarf_objs: o['tags'] = 'acc:scarf'

# ------------------------------------------------------------------ accessories (hair, hats, facial, shades)
ACC = {}
def acc(name, objs):
    for o in objs: o['tags'] = 'acc:' + name
    ACC[name] = objs

def hair_cap(name, rx, ry, rz, z, x=-0.012, zcut=None, idn=None):
    return mesh_obj(name, bm_ellipsoid(rx, ry, rz, 16, 10, zcut), idn or ID['hair'], head, (x, 0, HZ + z))

acc('hair:crop', [hair_cap('crop', 0.112, 0.098, 0.1, 0.03, -0.012, zcut=-0.035)])
acc('hair:shaved', [hair_cap('shaved', 0.108, 0.095, 0.11, 0.018, -0.01, zcut=-0.04)])
acc('hair:curtains', [hair_cap('curtC', 0.115, 0.1, 0.105, 0.03, -0.01, zcut=-0.06),
                      mesh_obj('curtL', bm_ellipsoid(0.05, 0.03, 0.07), ID['hair'], head, (0.07, 0.07, HZ + 0.02)),
                      mesh_obj('curtR', bm_ellipsoid(0.05, 0.03, 0.07), ID['hair'], head, (0.07, -0.07, HZ + 0.02))])
acc('hair:mod', [hair_cap('mod', 0.12, 0.104, 0.11, 0.025, -0.0, zcut=-0.045)])
acc('hair:flattop', [mesh_obj('flat', bm_box(0.2, 0.18, 0.12, 0.02), ID['hair'], head, (-0.01, 0, HZ + 0.1)),
                     hair_cap('flatSides', 0.11, 0.097, 0.09, 0.03, -0.015, zcut=-0.03)])
acc('hair:mohawk', [mesh_obj('mohawk%d' % i, bm_ellipsoid(0.03, 0.018, 0.06), ID['hair'], head, (0.08 - i * 0.045, 0, HZ + 0.11 + (0.01 if i in (1, 2) else 0)), (0, math.radians(-20 + i * 12), 0)) for i in range(5)])
acc('hair:spiky', [hair_cap('spikyBase', 0.11, 0.097, 0.1, 0.03, -0.012, zcut=-0.03)] +
    [mesh_obj('spike%d' % i, bm_capsule(0.025, 0.004, 0.05, 6, 2), ID['hair'], head, (0.06 - (i % 3) * 0.05, -0.04 + (i // 3) * 0.08, HZ + 0.11), (math.radians(180 + (i // 3 - 0.5) * 30), math.radians(-15 + (i % 3) * 15), 0)) for i in range(6)])
acc('hair:ponytail', [hair_cap('ptCap', 0.114, 0.1, 0.105, 0.025, -0.01, zcut=-0.05),
                      mesh_obj('ptTail', bm_capsule(0.035, 0.02, 0.16, 8, 3), ID['hair'], head, (-0.11, 0, HZ + 0.03), (0, math.radians(30), 0))])
acc('hair:long', [hair_cap('longCap', 0.118, 0.104, 0.11, 0.025, -0.01, zcut=-0.06),
                  mesh_obj('longBack', bm_ellipsoid(0.06, 0.1, 0.16), ID['hair'], head, (-0.07, 0, HZ - 0.08))])
acc('hair:bob', [hair_cap('bobCap', 0.118, 0.106, 0.11, 0.02, 0.0, zcut=-0.09)])
# hats
acc('hat:cap', [mesh_obj('capDome', bm_ellipsoid(0.113, 0.1, 0.075, 16, 8, zcut=0.0), ID['hat'], head, (-0.005, 0, HZ + 0.035)),
                mesh_obj('capBrim', bm_box(0.09, 0.15, 0.012, 0.004), ID['hatTrim'], head, (0.12, 0, HZ + 0.04), (0, math.radians(8), 0))])
acc('hat:beanie', [mesh_obj('beanieDome', bm_ellipsoid(0.115, 0.102, 0.105, 16, 9, zcut=-0.01), ID['hat'], head, (-0.008, 0, HZ + 0.035)),
                   mesh_obj('beanieFold', bm_torus(0.105, 0.022, 16, 5, sy=0.92), ID['hatTrim'], head, (-0.008, 0, HZ + 0.03)),
                   mesh_obj('bobble', bm_ellipsoid(0.035, 0.035, 0.035), ID['hatTrim'], head, (-0.01, 0, HZ + 0.15))])
acc('hat:bucket', [mesh_obj('bucketDome', bm_capsule(0.1, 0.112, 0.075, 16, 3), ID['hat'], head, (-0.005, 0, HZ + 0.11)),
                   mesh_obj('bucketBrim', bm_capsule(0.16, 0.17, 0.008, 18, 1), ID['hat'], head, (-0.005, 0, HZ + 0.035))])
acc('hat:helmet', [mesh_obj('helmet', bm_ellipsoid(0.125, 0.112, 0.12, 16, 9, zcut=-0.03), ID['hat'], head, (-0.01, 0, HZ + 0.03)),
                   mesh_obj('visor', bm_box(0.02, 0.18, 0.06, 0.005), ID['shades'], head, (0.115, 0, HZ + 0.02))])
# facial
acc('face:beard', [mesh_obj('beard', bm_ellipsoid(0.08, 0.085, 0.065), ID['facial'], head, (0.04, 0, HZ - 0.06))])
acc('face:tache', [mesh_obj('tache', bm_box(0.02, 0.07, 0.014, 0.004), ID['facial'], head, (0.108, 0, HZ - 0.035))])
acc('face:shades', [mesh_obj('shades', bm_box(0.02, 0.15, 0.03, 0.004), ID['shades'], head, (0.1, 0, HZ + 0.012))])

ALL_ACC_OBJS = [o for objs in ACC.values() for o in objs]

# ------------------------------------------------------------------ pose application
def set_pose(p, flip=False):
    hip.location = (p['dx'] * k, 0, HIP_H - p['dy'] * k)
    hip.rotation_euler = (0, p['rot'], 0)
    torso.rotation_euler = (0, p['lean'], 0)
    head.rotation_euler = (0, p['head'], 0)
    for side in ('N', 'F'):
        j = J[side]
        j['sh'].rotation_euler = (0, -p['ua' + side], 0)
        j['el'].rotation_euler = (0, -p['fa' + side], 0)
        j['th'].rotation_euler = (0, -p['th' + side], 0)
        j['kn'].rotation_euler = (0, p['kn' + side], 0)
        j['an'].rotation_euler = (0, -(p['th' + side] - p['kn' + side]) * 0.6, 0)  # keep feet roughly level

POSED = [hip, torso, head] + [J[s][n] for s in ('N', 'F') for n in ('sh', 'el', 'th', 'kn', 'an')]

# ------------------------------------------------------------------ glTF export (3D renderer, docs/DESIGN-V2.md phase B)
# {"model": {...}, "export": "assets/models/<name>.glb"}: writes the rigged character in its bind pose (all joint
# rotations zero) with EVERY accessory included. Joints are plain nodes (hip, torso, neck, head, sh/el/th/kn/an + N|F);
# the runtime (src/render3d/characters.js) drives them from the game's pose library, hides accessories by their
# 'tags' extras and recolours by material name (ID_<n>). Axis conversion is glTF's: Blender (x, y, z) -> (x, z, -y).
if JOB.get('export'):
    for o in scene.objects: o.hide_render = False; o.hide_set(False)
    out = P(JOB['export'])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    root['hooligan'] = json.dumps({'k': k, 'hipH': HIP_H, 'build': B, 'female': FEM, 'torso': TORSO, 'ids': ID})
    opts = dict(filepath=out, export_format='GLB', export_extras=True, export_yup=True, export_apply=False,
                export_cameras=False, export_lights=False, export_animations=False)
    try:
        bpy.ops.export_scene.gltf(**opts)
    except TypeError:
        for kk in ('export_cameras', 'export_lights', 'export_animations'): opts.pop(kk, None)
        bpy.ops.export_scene.gltf(**opts)
    print('EXPORTED', out, flush=True)
    sys.exit(0)

# ------------------------------------------------------------------ camera, lights, render settings
RES = JOB.get('res', 128)               # frame width
RESY = JOB.get('resY', 160)            # frame height
PXM = 57.7 * JOB.get('pxScale', 1.0)   # pixels per metre (character ~92 px tall)
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = max(RES, RESY) / PXM
cam = bpy.data.objects.new('cam', cam_d); link(cam)
cam.rotation_euler = Euler((math.radians(60), 0, math.radians(135)), 'XYZ')
fwd = Vector((0, 0, -1)); fwd.rotate(cam.rotation_euler)
ANCHOR_Y = JOB.get('anchorY', 122)    # feet pixel row in the frame
zc = (ANCHOR_Y - RESY / 2) / (0.866 * PXM)
cam.location = Vector((0, 0, zc)) - fwd * 20
cam_d.clip_end = 100
scene.camera = cam

sun_d = bpy.data.lights.new('key', 'SUN'); sun_d.energy = 4.6; sun_d.angle = math.radians(8)
sun = bpy.data.objects.new('key', sun_d); link(sun)
# light rays travel toward screen lower-right: game +x = Blender +Y, so rays go +Y, slightly -X, and down
dvec = Vector((-0.35, 1.0, -1.35)).normalized()
sun.rotation_euler = dvec.to_track_quat('-Z', 'Y').to_euler()
fill_d = bpy.data.lights.new('fill', 'SUN'); fill_d.energy = 0.45
fill = bpy.data.objects.new('fill', fill_d); link(fill)
fill.rotation_euler = fwd.to_track_quat('-Z', 'Y').to_euler()
rim_d = bpy.data.lights.new('rim', 'SUN'); rim_d.energy = 1.4
rim = bpy.data.objects.new('rim', rim_d); link(rim)
rim.rotation_euler = Vector((0.7, 0.7, -0.3)).normalized().to_track_quat('-Z', 'Y').to_euler()
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
if bg: bg.inputs[0].default_value = (0.05, 0.05, 0.065, 1); bg.inputs[1].default_value = 1.0

scene.render.resolution_x = RES; scene.render.resolution_y = RESY; scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.use_compositing = False
scene.render.use_sequencer = False

def setup_id_pass():
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading
    sh.light = 'FLAT'; sh.color_type = 'MATERIAL'
    sh.show_shadows = False; sh.show_cavity = False; sh.show_object_outline = False; sh.show_specular_highlight = False
    scene.display.render_aa = 'OFF'
    bpy.context.view_layer.material_override = None

def setup_shade_pass():
    if JOB.get('shadeEngine') == 'workbench':
        # fast path: Workbench studio lighting + shadows + cavity on a single white colour (~50x faster than Eevee)
        scene.render.engine = 'BLENDER_WORKBENCH'
        sh = scene.display.shading
        sh.light = 'STUDIO'; sh.color_type = 'SINGLE'; sh.single_color = (0.8, 0.8, 0.8)
        try: sh.studio_light = JOB.get('studioLight', 'outdoor.sl')
        except Exception: pass
        sh.use_world_space_lighting = True
        sh.studiolight_rotate_z = math.radians(JOB.get('studioRot', 200))
        sh.show_shadows = True; sh.shadow_intensity = 0.55
        sh.show_cavity = True; sh.cavity_type = 'BOTH'
        sh.cavity_ridge_factor = 1.0; sh.cavity_valley_factor = 1.2
        sh.show_specular_highlight = True; sh.show_object_outline = False
        scene.display.light_direction = tuple(-dvec)
        scene.display.render_aa = 'FXAA'
        bpy.context.view_layer.material_override = None
        return
    scene.render.engine = 'BLENDER_EEVEE'
    try:
        scene.eevee.taa_render_samples = JOB.get('samples', 6)
    except Exception: pass
    for attr, val in (('use_shadows', True), ('use_gtao', True), ('gtao_distance', 0.25)):
        try: setattr(scene.eevee, attr, val)
        except Exception: pass
    bpy.context.view_layer.material_override = WHITE

# ------------------------------------------------------------------ frames
clips = json.load(open(P(JOB['clips'])))['clips']
names = JOB.get('clipNames') or list(clips.keys())
FRAMES = []
for n in names:
    for i, p in enumerate(clips[n]['frames']):
        FRAMES.append((n, i, p))
if JOB.get('preview'):
    keep = set(JOB.get('previewClips', ['idle', 'walk', 'atk_cross', 'atk_kick', 'knockdown', 'block']))
    FRAMES = [f for f in FRAMES if f[0] in keep]
DIR_VECS = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
dirs = JOB.get('dirs', [0, 1, 6, 7, 5])

def yaw_for(d):
    gx, gy = DIR_VECS[d]
    return math.atan2(gx, gy)      # Blender facing vector (gy, gx)

def show_only(acc_names):
    want = set(acc_names)
    for o in ALL_ACC_OBJS + scarf_objs:
        tag = o.get('tags', '')
        name = tag[4:] if tag.startswith('acc:') else ''
        on = name in want
        o.hide_render = not on
    # stripes are always rendered (palette may hide them)

if JOB.get('handsOnly'):
    # project the near (weapon) hand + elbow for every frame/dir -> JSON (no rendering)
    from bpy_extras.object_utils import world_to_camera_view
    fistN = bpy.data.objects['fistN']; elN = J['N']['el']
    data = []
    for fi, (n, i, p) in enumerate(FRAMES):
        row = []
        for d in dirs:
            flip = p.get('flip', 0) >= 0.5
            root.rotation_euler = (0, 0, yaw_for(d) + (math.pi if flip else 0))
            set_pose(p)
            bpy.context.view_layer.update()
            pts = []
            for ob in (fistN, elN):
                v = world_to_camera_view(scene, cam, ob.matrix_world.translation)
                pts += [round(v.x * RES, 1), round((1 - v.y) * RESY, 1)]
            row.append(pts)
        data.append(row)
    json.dump({'frames': [[n, i] for (n, i, _) in FRAMES], 'dirs': dirs, 'anchor': [RES // 2, ANCHOR_Y], 'hands': data},
              open(P(JOB['handsOut']), 'w'), separators=(',', ':'))
    print('HANDS DONE', JOB['handsOut'])
    sys.exit(0)

out_root = P(JOB['out'])
os.makedirs(out_root, exist_ok=True)
manifest = {'frames': [[n, i] for (n, i, _) in FRAMES], 'dirs': dirs, 'res': [RES, RESY], 'anchor': [RES // 2, ANCHOR_Y], 'variants': {}}
t0 = time.time()
for var in JOB['variants']:
    show_only(var.get('acc', []))
    manifest['variants'][var['name']] = var.get('acc', [])
    for d in dirs:
        root.rotation_euler = (0, 0, yaw_for(d))
        od = os.path.join(out_root, var['name'], 'd%d' % d)
        os.makedirs(od, exist_ok=True)
        for pas in ('id', 'sh'):
            (setup_id_pass if pas == 'id' else setup_shade_pass)()
            for fi, (n, i, p) in enumerate(FRAMES):
                flip = p.get('flip', 0) >= 0.5
                root.rotation_euler = (0, 0, yaw_for(d) + (math.pi if flip else 0))
                set_pose(p)
                scene.render.filepath = os.path.join(od, '%s_%04d.png' % (pas, fi))
                bpy.ops.render.render(write_still=True)
        print('rendered', var['name'], 'dir', d, '%.1fs' % (time.time() - t0), flush=True)
json.dump(manifest, open(os.path.join(out_root, 'manifest.json'), 'w'))
print('DONE', out_root, '%.1fs' % (time.time() - t0))
