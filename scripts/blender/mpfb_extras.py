# THE LAST HOOLIGAN — extra kit for the MPFB hero models (char_mpfb.py), for the looks MPFB has no clothing asset for.
#
# Built in the scaled export space (soles at z=0, facing -Y) after the clothes are fitted and BEFORE the weights are
# merged, so pieces cut from the body keep the body's vertex groups. Job keys (all optional):
#   "sleeveless": true            cut the top's sleeves off at the shoulders (Kenny's white vest from a tee)
#   "top_split": {"pants": "#hex", "shirt": "#hex"}
#                                 an all-in-one MakeHuman outfit (jacket + shirt + jeans in one mesh, male_casualsuit05):
#                                 faces whose texture is denim become ID_7 (look.pants), the striped shirt ID_6 (look.shirt);
#                                 the rest stays the jacket, ID_3. The job then drops the separate "pants" asset.
#   "balaclava": {"slit": [w, h]} a knitted shell over the head and neck with an eye slit (ID_14 = look.hat colour; the
#                                 runtime makes a neon one glow), layer 'hat:balaclava'
#   "cap": {"color": "#hex"}      a flat cap: a shell over the crown, flattened and pulled forward, plus a peak (ID_14),
#                                 layer 'hat:cap'
#   "tache": {"width": 0.034}     a moustache: strands over the upper lip (ID_2 = look.hair colour), layer 'face:tache'
#   "tattoo": {"size": 0.085}     a UV-mapped patch on the left upper arm's skin (ID_26: the runtime draws the design,
#                                 characters2.js tattooTexture), layer 'tattoo:arm'
#
# EXTRA[role] = {name, tag, force (bone or None: keep the body weights), mat: (name, rgba, roughness, image|None, alpha)}

import bpy, bmesh, math, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

EXTRA = {}


def srgb_to_lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def hexlin(h): return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1.0,)


def _landmarks(OBJ, J):
    eyes = [v.co for v in OBJ['eyes'].data.vertices]
    ec = sum(eyes, Vector()) / len(eyes)
    eye_front = min(v.y for v in eyes)
    bv = OBJ['body'].data.vertices
    hc = Vector((J['head'].x, J['head'].y, 0))
    # nose tip: the frontmost body vertex on the midline between the eyes and the mouth
    nose = min((v.co for v in bv if abs(v.co.x) < 0.012 and ec.z - 0.075 < v.co.z < ec.z - 0.015), key=lambda c: c.y)
    tz = [v.co.z for v in OBJ['teeth'].data.vertices] if 'teeth' in OBJ else [nose.z - 0.04]
    return {'eye': ec, 'eye_front': eye_front, 'axis': hc, 'nose': nose, 'mouth_z': (max(tz) + min(tz)) / 2, 'teeth_top': max(tz)}


def _is_bone(name):
    """A deform-bone vertex group of MPFB's game_engine rig (not a mask / helper / body-part group)."""
    return name in ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'Root') or (name[-2:] in ('_l', '_r') and not name.startswith(('delete', 'helper', 'joint')))


def _drop_islands(bm, min_faces):
    """Delete connected face islands smaller than min_faces (cuff and hem scraps left by a cut)."""
    seen = set(); small = []
    for f in bm.faces:
        if f.index in seen: continue
        isl = []; stack = [f]; seen.add(f.index)
        while stack:
            g = stack.pop(); isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen: seen.add(h.index); stack.append(h)
        if len(isl) < min_faces: small += isl
    bm.faces.index_update()
    bmesh.ops.delete(bm, geom=small, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')


def _snap_rim(ob, fn):
    """Move the shell's open-edge vertices with fn(co) -> new co (a clean knitted edge instead of the face staircase)."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for v in bm.verts:
        if v.is_boundary: v.co = fn(v.co.copy())
    bm.to_mesh(ob.data); bm.free()


def _shell(src, keep_vert, offset, name):
    """Copy of src's faces whose vertices all pass keep_vert(co, normal), pushed out along the vertex normals. Keeps
    UVs and vertex groups (same group names, same order) so it deforms with the body."""
    bm = bmesh.new(); bm.from_mesh(src.data)
    bm.normal_update()
    keep = {v.index for v in bm.verts if keep_vert(v.co, v.normal)}
    gone = [f for f in bm.faces if not all(v.index in keep for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * offset
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for g in src.vertex_groups: ob.vertex_groups.new(name=g.name)
    me.materials.clear()
    return ob


def _strand_image(name, w=128, h=64, seed=7):
    """Hair strands for a tache: vertical streaks, ragged lower edge, soft sides (alpha clip at 0.5)."""
    rng = np.random.default_rng(seed)
    px = np.zeros((h, w, 4), np.float32); px[..., :3] = 0.45; px[..., 3] = 1.0      # dark roots between the strands
    xs = np.arange(w) / (w - 1)
    for _ in range(900):
        x = rng.uniform(0.02, 0.98)
        side = abs(x - 0.5) * 2                              # 0 at the philtrum, 1 at the corners
        top = 0.08 + 0.12 * side
        bot = 0.86 - 0.25 * side ** 2 + rng.uniform(-0.08, 0.06)
        lean = (x - 0.5) * 0.25                              # strands comb outwards and down
        shade = rng.uniform(0.55, 1.0)
        for t in np.linspace(top, bot, 24):
            xx = int(np.clip(x + lean * (t - top), 0, 1) * (w - 1)); yy = int(t * (h - 1))
            px[h - 1 - yy, xx, :3] = np.maximum(px[h - 1 - yy, xx, :3], shade)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(px.ravel())
    return img


def _knit_images(name, px=256, cols=32, rows=32):
    """A tileable rib knit: columns of V stitches (each a pair of slanted lobes), dark grooves between the ribs.
    Returns (colour map, normal map) Blender images."""
    y, x = np.mgrid[0:px, 0:px].astype(np.float32) / px
    sx = (x * cols) % 1.0; sy = (y * rows) % 1.0
    d = np.abs(sx - 0.5) - 0.24 - (sy - 0.5) * 0.32           # the two legs of the V, leaning in toward the bottom
    h = np.exp(-(d / 0.13) ** 2) * (0.55 + 0.45 * np.sin(np.pi * sy))
    h *= 1.0 - 0.6 * np.exp(-((sx - 0.0) / 0.05) ** 2) - 0.6 * np.exp(-((sx - 1.0) / 0.05) ** 2)   # rib grooves
    rng = np.random.default_rng(3)
    h += rng.normal(0, 0.03, h.shape).astype(np.float32)        # fuzz
    colv = np.clip(0.84 + 0.2 * h, 0, 1)
    gy, gx = np.gradient(h)
    k = 6.0
    n = np.dstack([-gx * k * px / cols / 4, -gy * k * px / rows / 4, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    out = []
    for tag, rgb, data in (('col', np.dstack([colv] * 3), False), ('nrm', n * 0.5 + 0.5, True)):
        img = bpy.data.images.new(name + '_' + tag, px, px, alpha=False)
        a = np.ones((px, px, 4), np.float32); a[..., :3] = rgb
        img.pixels.foreach_set(a.ravel())
        if data: img.colorspace_settings.name = 'Non-Color'
        out.append(img)
    return out


def build(JOB, OBJ, J):
    """Make the extra pieces (and cut the top) in the scaled space. Returns EXTRA (role -> spec)."""
    L = _landmarks(OBJ, J)
    ec, axis = L['eye'], L['axis']

    def radial(co): return math.hypot(co.x - axis.x, co.y - axis.y)

    if JOB.get('sleeveless') and 'top' in OBJ:
        cut = abs(J['upperArm_L'].x) - JOB['sleeveless'].get('in', 0.012) if isinstance(JOB['sleeveless'], dict) else abs(J['upperArm_L'].x) - 0.012
        bm = bmesh.new(); bm.from_mesh(OBJ['top'].data)
        gone = [f for f in bm.faces if any(abs(v.co.x) > cut for v in f.verts)]
        bmesh.ops.delete(bm, geom=gone, context='FACES')
        _drop_islands(bm, 60)
        bm.to_mesh(OBJ['top'].data); bm.free(); OBJ['top'].data.update()
        print('SLEEVELESS: cut', len(gone), 'faces')

    if JOB.get('vest'):
        V = JOB['vest']
        src = OBJ['body']; gname = {g.index: g.name for g in src.vertex_groups}
        TORSO = ('pelvis', 'spine_01', 'spine_02', 'spine_03')
        waist = J['hips'].z + V.get('waist', 0.05)
        pit = J['upperArm_L'].z - V.get('pit', 0.085)          # armhole bottom
        neck_front = J['chest'].z + V.get('scoop', 0.075)       # neckline scoop at the front
        def wsum(v, names): return sum(g.weight for g in v.groups if gname.get(g.group, '') in names)
        me = src.data; keepv = set()
        ARM = lambda n: n.startswith(('upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky'))
        s_in, s_out = V.get('strap_in', 0.045), V.get('strap_out', 0.1)
        for v in me.vertices:
            co = v.co
            if co.z < waist or co.z > J['neck'].z + 0.005: continue
            tot = sum(g.weight for g in v.groups if _is_bone(gname.get(g.group, ''))) or 1
            arm = sum(g.weight for g in v.groups if ARM(gname.get(g.group, ''))) / tot
            if arm > (0.35 if co.z <= pit else 0.75): continue           # the arms stay bare (above the pit the armhole decides)
            if co.z > pit:                                                # armholes: curve from the armpit up to the strap
                t = min(1.0, (co.z - pit) / max(0.02, J['neck'].z - pit))
                if abs(co.x) > 0.22 + (s_out - 0.22) * t ** 0.6: continue
            if abs(co.x) < s_in:                                          # neckline: a U at the front, a shallow one at the back
                u = (abs(co.x) / s_in) ** V.get('u_pow', 4)
                top = J['neck'].z + 0.005
                if co.y < J['chest'].y and co.z > neck_front + (top - neck_front) * u: continue
                back = top - V.get('back_scoop', 0.06)
                if co.y >= J['chest'].y and co.z > back + (top - back) * u: continue
            keepv.add(v.index)
        ob = _shell(src, lambda co, n, _k=None: True, 0.0, 'vest')   # full copy, then cut to the kept vertices
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bm.verts.ensure_lookup_table()
        kco = {tuple(round(c, 5) for c in me.vertices[i].co) for i in keepv}      # by position: the copy drops loose verts
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(tuple(round(c, 5) for c in v.co) in kco for v in f.verts)], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        _drop_islands(bm, 40)
        # smooth the hems (the face staircase): boundary verts slide toward their boundary neighbours, back onto the skin
        bmb = bmesh.new(); bmb.from_mesh(src.data); bvh = BVHTree.FromBMesh(bmb); bmb.free()
        for _ in range(V.get('smooth', 10)):
            moves = {}
            for v in bm.verts:
                if not v.is_boundary: continue
                nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                if len(nb) == 2: moves[v] = (nb[0].co + nb[1].co) * 0.5 * 0.6 + v.co * 0.4
            for v, c in moves.items():
                hit = bvh.find_nearest(c, 0.05)
                v.co = hit[0] if hit[0] is not None else c
        bm.normal_update()
        for v in bm.verts:                                   # sit on the skin, along the SKIN's normal (never inside it)
            hit = bvh.find_nearest(v.co, 0.05)
            if hit[0] is not None: v.co = hit[0] + hit[1] * V.get('offset', 0.004)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.to_mesh(ob.data); bm.free()
        OBJ['vest'] = ob
        EXTRA['vest'] = {'name': 'top', 'tag': '', 'force': None, 'mat': ('ID_3', hexlin(V.get('color', '#ecebe4')), 0.85, None, False)}
        print('VEST', len(ob.data.polygons), 'faces, top z %.3f' % max(p.center.z for p in ob.data.polygons))

    if JOB.get('balaclava'):
        # a knitted balaclava, not face paint: a shell over head and neck, smoothed until the nose, lips and ears are only
        # soft lumps under the wool, held a few mm off the skin everywhere, an eye slit with a thick turned edge, a folded
        # hem at the neck, cylindrical UVs for a rib-knit map (colour x look.hat colour, plus a knit normal map)
        B = JOB['balaclava']
        sw, sh = B.get('slit', [0.066, 0.016])
        neck_z = J['neck'].z - 0.03
        off = B.get('offset', 0.0075)
        def keep(co, n):
            if co.z < neck_z or radial(co) > (0.17 if co.z > ec.z - 0.1 else 0.1): return False
            return not (abs(co.x) < sw + 0.004 and abs(co.z - ec.z) < sh + 0.004 and co.y < L['eye_front'] + 0.035)
        ob = _shell(OBJ['body'], keep, 0.0, 'balaclava')
        bmb = bmesh.new(); bmb.from_mesh(OBJ['body'].data); bvh = BVHTree.FromBMesh(bmb); bmb.free()
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
        # close the body's mouth opening (and any other small hole) so the wool runs over the lips: every boundary loop
        # except the eye slit and the neck hem
        seen = set(); fill = []
        for e in bm.edges:
            if not e.is_boundary or e in seen: continue
            loop = []; stack = [e]
            while stack:
                x = stack.pop()
                if x in seen: continue
                seen.add(x); loop.append(x)
                for v in x.verts:
                    stack += [y for y in v.link_edges if y.is_boundary and y not in seen]
            vs = {v for x in loop for v in x.verts}
            cz = sum(v.co.z for v in vs) / len(vs)
            if cz > neck_z + 0.04 and abs(cz - ec.z) > sh + 0.02: fill += loop
        if fill: bmesh.ops.holes_fill(bm, edges=fill, sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        print('BALACLAVA holes filled:', len(fill), 'edges')
        def clean_slit(co):            # the slit: a soft-cornered box, flat across (no dip over the nose)
            k = min(1.0, abs(co.x) / sw); hh = sh * (1.0 - 0.4 * k ** 4)
            co.z = ec.z + (hh if co.z > ec.z else -hh); return co
        slit = lambda v: v.is_boundary and v.co.z > neck_z + 0.04
        chin_z = L['mouth_z'] - 0.03
        for it in range(B.get('smooth', 18)):           # Laplacian smoothing over the face; jaw + neck stay snug
            new = {}
            for v in bm.verts:
                nb = [e.other_vert(v) for e in v.link_edges]
                if not nb: continue
                if v.is_boundary:
                    bn = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                    c = (bn[0].co + bn[1].co) * 0.5 if len(bn) == 2 else v.co.copy()
                    c = v.co.lerp(c, 0.5)
                    if v.co.z < neck_z + 0.02: c = Vector((c.x, c.y, neck_z))     # the neck hem: level
                    elif slit(v) and abs(v.co.z - ec.z) < sh + 0.02: c = clean_slit(c)
                else:
                    w = 0.6 if v.co.z > chin_z else 0.6 * max(0.0, 1 - (chin_z - v.co.z) / 0.02)
                    c = v.co.lerp(sum((u.co for u in nb), Vector()) / len(nb), w) if w > 0 else v.co.copy()
                new[v] = c
            for v, c in new.items(): v.co = c
            for v in bm.verts:                          # never closer than off to the skin (wool over the nose and ears)
                hit = bvh.find_nearest(v.co, 0.08)
                if hit[0] is None: continue
                d = (v.co - hit[0]).dot(hit[1])
                if d < off: v.co += hit[1] * (off - d)
        # turned edges: fold every rim back toward the skin (thickness you can see at the eye slit and the neck)
        rims = [e for e in bm.edges if e.is_boundary]
        ext = bmesh.ops.extrude_edge_only(bm, edges=rims)
        for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]:
            hit = bvh.find_nearest(v.co, 0.08)
            if hit[0] is not None: v.co = hit[0] + hit[1] * 0.0015
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        bm.normal_update()
        # cylindrical UVs around the head axis: ~120 stitch columns around, 4 mm rows (the map tiles 32 x 32 stitches)
        uvl = bm.loops.layers.uv.verify()
        U = B.get('tiles_around', 4.0); VZ = B.get('tile_height', 0.128)
        for f in bm.faces:
            us = []
            for lp in f.loops:
                c = lp.vert.co
                us.append((math.atan2(c.x - axis.x, -(c.y - axis.y)) / (2 * math.pi) + 0.5) * U)
            if max(us) - min(us) > U / 2: us = [u + U if u < U / 2 else u for u in us]       # the seam at the back
            for lp, u in zip(f.loops, us): lp[uvl].uv = (u, lp.vert.co.z / VZ)
        bm.to_mesh(ob.data); bm.free()
        for p in ob.data.polygons: p.use_smooth = True
        OBJ['balaclava'] = ob
        col, nrm = _knit_images('balaclava_knit')
        EXTRA['balaclava'] = {'name': 'balaclava', 'tag': 'acc:' + B.get('layer', 'hat:balaclava'), 'force': None,
                              'mat': ('ID_14', hexlin(B.get('color', '#ff5a00')), 0.97, col, False), 'normal': nrm if B.get('knit_normal', True) else None}
        print('BALACLAVA', len(ob.data.polygons), 'faces')

    if JOB.get('cap'):
        z_front = ec.z + JOB['cap'].get('front', 0.034)
        slope = JOB['cap'].get('slope', 0.22)
        def rim_z(co): return z_front - slope * max(0.0, co.y - L['eye_front'])     # +Y is the back of the head
        def keep(co, n):
            return radial(co) < 0.135 and co.z > rim_z(co) and not (abs(co.x) > 0.072 and co.z < ec.z + 0.05)
        ob = _shell(OBJ['body'], keep, JOB['cap'].get('offset', 0.007), 'cap')
        zt = max(v.co.z for v in ob.data.vertices)
        for v in ob.data.vertices:   # a flat cap: the crown lifted flat (never into the skull), sliding forward over the peak
            d = Vector((v.co.x - axis.x, v.co.y - axis.y, 0)) * 0.025
            v.co += d
            if v.co.z > zt - 0.07:
                k = (v.co.z - (zt - 0.07)) / 0.07
                v.co.z = zt - (zt - v.co.z) * (1 - 0.85 * k) + 0.003
                v.co.y -= 0.04 * k
                v.co.x *= 1 + 0.1 * k
        _snap_rim(ob, lambda co: Vector((co.x, co.y, rim_z(co) - 0.004)))
        # the peak: extrude the front stretch of the cap's lower rim forward and a little down
        bm = bmesh.new(); bm.from_mesh(ob.data)
        rim = [e for e in bm.edges if e.is_boundary and all(v.co.y < axis.y - 0.035 for v in e.verts)]
        if rim:
            ext = bmesh.ops.extrude_edge_only(bm, edges=rim)
            for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]:
                w = min(1.0, max(0.0, (axis.y - 0.035 - v.co.y) / 0.06)) ** 0.7     # long in front, tapering to the sides
                v.co += Vector((v.co.x * 0.15 * w, -0.058 * w, -0.016 * w))
        bm.to_mesh(ob.data); bm.free()
        OBJ['cap'] = ob
        EXTRA['cap'] = {'name': 'cap', 'tag': 'acc:hat:cap', 'force': 'head',
                        'mat': ('ID_14', hexlin(JOB['cap'].get('color', '#6a5a40')), 0.9, None, False)}
        print('CAP', len(ob.data.polygons), 'faces, peak edges', len(rim))

    if JOB.get('tache'):
        hw = JOB['tache'].get('width', 0.034)
        z_top = L['nose'].z - JOB['tache'].get('below_nose', 0.03)
        z_bot = L['mouth_z'] + JOB['tache'].get('over_lip', 0.007)
        def keep(co, n):
            droop = (abs(co.x) / hw) ** 2 * 0.012                # the corners hang down a little
            return abs(co.x) < hw and z_bot - droop < co.z < z_top and n.y < -0.2 and co.y < axis.y - 0.04
        ob = _shell(OBJ['body'], keep, 0.0035, 'tache')
        xs = [v.co.x for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
        if xs:
            x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
            uvl = ob.data.uv_layers.active or ob.data.uv_layers.new(name='UVMap')
            for lp in ob.data.loops:
                co = ob.data.vertices[lp.vertex_index].co
                uvl.data[lp.index].uv = ((co.x - x0) / max(1e-4, x1 - x0), (co.z - z0) / max(1e-4, z1 - z0))
            OBJ['tache'] = ob
            EXTRA['tache'] = {'name': 'tache', 'tag': 'acc:face:tache', 'force': None,
                              'mat': ('ID_2', hexlin(JOB['tache'].get('color', '#9a9a9a')), 0.7, _strand_image('tache_strands'), False)}
            print('TACHE', len(ob.data.polygons), 'faces')
            print('TACHE BAND z %.3f..%.3f (nose %.3f, mouth %.3f, eye %.3f)' % (z_bot, z_top, L['nose'].z, L['mouth_z'], ec.z))
        else:
            print('WARN tache: no faces in the upper lip band')

    if JOB.get('tattoo'):
        S = JOB['tattoo'].get('size', 0.085)
        bmt = bmesh.new(); bmt.from_mesh(OBJ['body'].data); bvh = BVHTree.FromBMesh(bmt); bmt.free()
        ua, fa = J['upperArm_L'], J['forearm_L']; d_ = (fa - ua).normalized()
        def on_arm(axis_pt, out_dir, lift):
            hit = bvh.ray_cast(axis_pt + out_dir * 0.2, -out_dir, 0.2)
            if hit[0] is None: return None
            n = hit[1] if hit[1].dot(out_dir) > 0 else -hit[1]
            return hit[0] + n * lift, n
        lat = Vector((1, 0, 0)); lat = (lat - d_ * lat.dot(d_)).normalized()
        out_ = (lat + Vector((0, -1, 0)) * 0.25).normalized()
        h = on_arm(ua.lerp(fa, JOB['tattoo'].get('at', 0.45)), out_, 0.0012)
        if not h: raise SystemExit('tattoo: no skin under the left upper arm')
        p, nrm = h; up = -d_; across = up.cross(nrm).normalized(); up = nrm.cross(across).normalized()
        COLS = ROWS = 8
        bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); grid = {}
        for i in range(COLS + 1):
            for j in range(ROWS + 1):
                q = p + across * (i / COLS - 0.5) * S + up * (j / ROWS - 0.5) * S
                t = max(0.0, min(1.0, (q - ua).dot(fa - ua) / (fa - ua).length_squared)); ax = ua.lerp(fa, t)
                o2 = q - ax; o2 = (o2 - d_ * o2.dot(d_)).normalized()
                hq = on_arm(ax, o2, 0.0012)
                grid[i, j] = (bm.verts.new(hq[0] if hq else q), (i / COLS, j / ROWS))
        for i in range(COLS):
            for j in range(ROWS):
                quad = [grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]]
                f = bm.faces.new([q[0] for q in quad])
                for loop, (_, uv) in zip(f.loops, quad): loop[uvl].uv = uv
        me = bpy.data.meshes.new('tattoo'); bm.to_mesh(me); bm.free()
        for pl in me.polygons: pl.use_smooth = True
        ob = bpy.data.objects.new('tattoo', me); bpy.context.scene.collection.objects.link(ob)
        OBJ['tattoo'] = ob
        EXTRA['tattoo'] = {'name': 'tattoo', 'tag': 'acc:tattoo:arm', 'force': 'upperArm_L',
                           'mat': ('ID_26', (0.02, 0.02, 0.025, 1.0), 0.6, None, False)}
        print('TATTOO at', tuple(round(x, 3) for x in p))
    for i, T in enumerate(JOB.get('chest_tattoos', [])):
        # a tattoo on the chest (job "chest_tattoos": [{"side": "R"|"L", "size": m, "image": path | null, "drop": m}]):
        # a patch cast onto the skin from the front; no image = ID_26 (the runtime draws look.tattoo), an image = its
        # own colour ink (e.g. a club crest)
        sg = 1 if T.get('side', 'R') == 'L' else -1                     # the character's left is +X
        S = T.get('size', 0.08); AR = T.get('aspect', 1.0)
        bmt = bmesh.new(); bmt.from_mesh(OBJ['body'].data); bvh = BVHTree.FromBMesh(bmt); bmt.free()
        cz = J['upperArm_L'].z - T.get('drop', 0.07); cx = sg * T.get('out', 0.072)
        def on_chest(x, z):
            hit = bvh.ray_cast(Vector((x, -0.5, z)), Vector((0, 1, 0)), 1.0)
            return None if hit[0] is None else hit[0] + hit[1] * 0.0012
        COLS, ROWS = 8, 8
        bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); grid = {}
        for a in range(COLS + 1):
            for b in range(ROWS + 1):
                x = cx + (a / COLS - 0.5) * S; z = cz + (b / ROWS - 0.5) * S * AR
                q = on_chest(x, z)
                if q is None: raise SystemExit('chest tattoo: no skin at %.3f %.3f' % (x, z))
                grid[a, b] = (bm.verts.new(q), (a / COLS, b / ROWS))
        for a in range(COLS):
            for b in range(ROWS):
                quad = [grid[a, b], grid[a + 1, b], grid[a + 1, b + 1], grid[a, b + 1]]
                f = bm.faces.new([q[0] for q in quad])
                for lp, (_, uv) in zip(f.loops, quad): lp[uvl].uv = uv
                f.normal_update()
                if f.normal.y > 0: f.normal_flip()
        role = 'chest_%d' % i
        me = bpy.data.meshes.new(role); bm.to_mesh(me); bm.free()
        for pl in me.polygons: pl.use_smooth = True
        ob = bpy.data.objects.new(role, me); bpy.context.scene.collection.objects.link(ob)
        OBJ[role] = ob
        if T.get('image'):
            img = bpy.data.images.load(T['image'] if os.path.isabs(T['image']) else os.path.join(ROOT, T['image']))
            EXTRA[role] = {'name': 'chestInk%d' % i, 'tag': 'acc:tattoo:arm', 'force': 'chest',
                           'mat': ('ink_%d' % i, (1, 1, 1, 1), 0.55, img, True), 'ink': T.get('ink', 0.85)}
        else:
            EXTRA[role] = {'name': 'chestTattoo%d' % i, 'tag': 'acc:tattoo:arm', 'force': 'chest',
                           'mat': ('ID_26', (0.02, 0.02, 0.025, 1.0), 0.6, None, False)}
        print('CHEST TATTOO', T.get('side'), 'at', (round(cx, 3), round(cz, 3)))
    build_kit(JOB, OBJ, J, L)
    build_cover(JOB, OBJ, J, L)
    for role in EXTRA:                          # pieces cut from the skin carry its custom normals: drop them (dark blotches)
        me = OBJ[role].data
        if 'custom_normal' in me.attributes: me.attributes.remove(me.attributes['custom_normal'])
        if getattr(me, 'has_custom_normals', False):
            with bpy.context.temp_override(object=OBJ[role], active_object=OBJ[role]):
                bpy.ops.mesh.customdata_custom_splitnormals_clear()
    return EXTRA


def split_classes(top):
    """Per-face class of an all-in-one outfit from its ORIGINAL texture: 'pants' (denim blue), 'shirt' (red) or None."""
    m = top.data.materials[0]
    tex = next((n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image is not None), None)
    if tex is None: return []
    img = tex.image; w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    uv = top.data.uv_layers.active.data
    out = []
    for pl in top.data.polygons:
        uvs = [uv[i].uv for i in pl.loop_indices]
        c = sum((Vector(u) for u in uvs), Vector((0, 0))) / len(uvs)
        pts = [c] + [c.lerp(Vector(u), 0.6) for u in uvs]
        rgb = np.mean([px[int(np.clip(q.y, 0, 0.9999) * h), int(np.clip(q.x, 0, 0.9999) * w), :3] for q in pts], 0)
        r, g, b = rgb
        out.append('pants' if b > r + 0.05 and b > 0.22 else 'shirt' if r > g + 0.1 and r > 0.18 else None)
    return out


def materials(OBJ, JOB, texdir):
    """Untextured (or strand-textured) palette materials for the extra pieces."""
    for role, spec in EXTRA.items():
        if spec.get('mats'):                    # several palette materials, picked per face by spec['face_mat'](polygon)
            me = OBJ[role].data
            for nm, rgba, rough in spec['mats']:
                mt = bpy.data.materials.new(nm); mt.use_nodes = True
                b = mt.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = rgba; b.inputs['Roughness'].default_value = rough
                mt.use_backface_culling = False; me.materials.append(mt)
            if spec.get('face_mat'):
                for pl in me.polygons: pl.material_index = spec['face_mat'](pl)
            continue
        name, rgba, rough, img, alpha = spec['mat']
        if img is not None and not img.filepath_raw:      # generated strands: write a PNG so the glTF carries a file
            fp = os.path.join(texdir, img.name + '.png'); img.filepath_raw = fp; img.file_format = 'PNG'; img.save()
        mat = bpy.data.materials.get(name) if img is None and name != 'ID_2' else None   # textured: never borrow (ID_18 is also the brows)
        if mat is None:
            mat = bpy.data.materials.new(name); mat.use_nodes = True
            b = mat.node_tree.nodes['Principled BSDF']
            b.inputs['Base Color'].default_value = rgba; b.inputs['Roughness'].default_value = rough
            if img is not None:
                N = mat.node_tree.nodes; Lk = mat.node_tree.links
                tx = N.new('ShaderNodeTexImage'); tx.image = img
                mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
                mix.inputs[7].default_value = rgba
                Lk.new(tx.outputs['Color'], mix.inputs[6]); Lk.new(mix.outputs[2], b.inputs['Base Color'])
                if alpha:
                    rnd = N.new('ShaderNodeMath'); rnd.operation = 'ROUND'
                    Lk.new(tx.outputs['Alpha'], rnd.inputs[0]); Lk.new(rnd.outputs[0], b.inputs['Alpha'])
            if spec.get('normal') is not None:
                nimg = spec['normal']
                if not nimg.filepath_raw:
                    fp = os.path.join(texdir, nimg.name + '.png'); nimg.filepath_raw = fp; nimg.file_format = 'PNG'; nimg.save()
                N = mat.node_tree.nodes; Lk = mat.node_tree.links
                nt = N.new('ShaderNodeTexImage'); nt.image = nimg; nimg.colorspace_settings.name = 'Non-Color'
                nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.0
                Lk.new(nt.outputs['Color'], nm.inputs['Color']); Lk.new(nm.outputs['Normal'], b.inputs['Normal'])
            mat.use_backface_culling = False
        OBJ[role].data.materials.append(mat)


# ---------------------------------------------------------------------------------------------------------------------
# the wardrobe kit (Dez: every hat, the shades, the scarf, a beard, gloves, a mohican), each its own LOOK layer.
# Job keys: "beanie", "bucket", "helmet" (hats, ID_14 / trim ID_15), "shades" (ID_19), "scarf" (ID_11 / ID_12 bands),
# "beard" (ID_18 strands), "gloves" (ID_16), "mohawk" (ID_2). Each value is a dict of options ({} for defaults).

def _bvh(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data); t = BVHTree.FromBMesh(bm); bm.free(); return t


def _push_out(ob, bvh, off):
    """Every vertex at least off outside the skin (along the skin's normal)."""
    for v in ob.data.vertices:
        hit = bvh.find_nearest(v.co, 0.1)
        if hit[0] is None: continue
        d = (v.co - hit[0]).dot(hit[1])
        if d < off: v.co += hit[1] * (off - d)


def _uv_planar(ob, ax='xz'):
    me = ob.data; uvl = me.uv_layers.active or me.uv_layers.new(name='UVMap')
    i0, i1 = 'xyz'.index(ax[0]), 'xyz'.index(ax[1])
    cs = [v.co for v in me.vertices]
    a0, a1 = min(c[i0] for c in cs), max(c[i0] for c in cs); b0, b1 = min(c[i1] for c in cs), max(c[i1] for c in cs)
    for lp in me.loops:
        c = me.vertices[lp.vertex_index].co
        uvl.data[lp.index].uv = ((c[i0] - a0) / max(1e-4, a1 - a0), (c[i1] - b0) / max(1e-4, b1 - b0))


def _beard_image(name, w=128, h=128, seed=11):
    """Short dense beard: many short strands pointing down, darker roots, a soft ragged top edge."""
    rng = np.random.default_rng(seed)
    px = np.zeros((h, w, 4), np.float32); px[..., :3] = 0.5; px[..., 3] = 1.0
    for _ in range(4000):
        x, y = rng.uniform(0, 1), rng.uniform(0, 1)
        L = rng.uniform(0.03, 0.08); sh = rng.uniform(0.6, 1.0)
        for t in np.linspace(0, L, 6):
            xx = int(np.clip(x + t * 0.15, 0, 0.999) * w); yy = int(np.clip(y - t, 0, 0.999) * h)
            px[yy, xx, :3] = np.maximum(px[yy, xx, :3], sh)
    img = bpy.data.images.new(name, w, h, alpha=True); img.pixels.foreach_set(px.ravel()); return img


def _smooth_rim(ob, bvh, off, it=8):
    """Relax a shell's open edges (no face staircase), then hold them off the skin again."""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for _ in range(it):
        mv = {}
        for v in bm.verts:
            if not v.is_boundary: continue
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2: mv[v] = v.co.lerp((nb[0].co + nb[1].co) * 0.5, 0.6)
        for v, c in mv.items(): v.co = c
    bm.to_mesh(ob.data); bm.free()
    _push_out(ob, bvh, off)


def build_kit(JOB, OBJ, J, L):
    body = OBJ['body']; ec, axis = L['eye'], L['axis']
    def radial(co): return math.hypot(co.x - axis.x, co.y - axis.y)
    bvh = None
    def B():
        nonlocal bvh
        if bvh is None: bvh = _bvh(body)
        return bvh

    def head_shell(name, rim, off, ears=False):
        """A shell over the skull above rim(co) (a height that can depend on where you are round the head)."""
        def keep(co, n):
            if radial(co) > 0.15 or co.z < rim(co): return False
            return ears or not (abs(co.x) > 0.07 and co.z < ec.z + 0.05)
        ob = _shell(body, keep, 0.0, name)
        _push_out(ob, B(), off)
        _snap_rim(ob, lambda co: Vector((co.x, co.y, max(co.z, rim(co)))))
        return ob

    if JOB.get('beanie') is not None:
        o = JOB['beanie']; off = o.get('offset', 0.016)
        rim = lambda co: ec.z + 0.045 - 0.12 * max(0.0, co.y - L['eye_front'])
        ob = head_shell('beanie', rim, off)
        zmin = min(v.co.z for v in ob.data.vertices); zt = max(v.co.z for v in ob.data.vertices)
        bm = bmesh.new(); bm.from_mesh(ob.data)               # the bobble on top
        top = Vector((axis.x, axis.y + 0.01, zt + 0.022))
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.03, matrix=__import__('mathutils').Matrix.Translation(top))
        # the turned-up band: a fat ring round the rim (a clean edge, not the face staircase)
        rimv = [v.co.copy() for v in bm.verts if v.is_boundary]
        if rimv:
            cx = sum(c.x for c in rimv) / len(rimv); cy = sum(c.y for c in rimv) / len(rimv)
            N, M, Tb = 32, 6, 0.017
            rows = []
            for i in range(N + 1):
                a = i / N * 2 * math.pi
                d = Vector((math.sin(a), -math.cos(a), 0))
                # the rim's own radius and height in this direction
                best = max(rimv, key=lambda c: (c - Vector((cx, cy, c.z))).normalized().dot(d) if (c - Vector((cx, cy, c.z))).length > 1e-4 else -1)
                r = math.hypot(best.x - cx, best.y - cy); zc = best.z + Tb * 0.9
                c0 = Vector((cx, cy, zc)) + d * (r + Tb * 0.35)
                rows.append([bm.verts.new(c0 + d * math.cos(b) * Tb * 0.7 + Vector((0, 0, math.sin(b) * Tb * 1.3))) for b in [k / M * 2 * math.pi for k in range(M)]])
            for i in range(N):
                for k in range(M):
                    bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][(k + 1) % M], rows[i][(k + 1) % M])).material_index = 1
        bm.to_mesh(ob.data); bm.free()
        for p in ob.data.polygons: p.use_smooth = True
        OBJ['beanie'] = ob
        EXTRA['beanie'] = {'name': 'beanie', 'tag': 'acc:hat:beanie', 'force': 'head',
                           'mats': [('ID_14', hexlin('#c8102e'), 0.95), ('ID_15', hexlin('#f4f1e8'), 0.95)],
                           'face_mat': lambda pl, zt=zt: 1 if (pl.material_index == 1 or pl.center.z > zt + 0.002) else 0}
        print('BEANIE', len(ob.data.polygons))

    if JOB.get('bucket') is not None:
        o = JOB['bucket']; off = o.get('offset', 0.018)
        rim = lambda co: ec.z + 0.05
        ob = head_shell('bucket', rim, off)
        zt = max(v.co.z for v in ob.data.vertices)
        for v in ob.data.vertices:                            # a flat-topped crown
            if v.co.z > zt - 0.03: v.co.z = zt - 0.03 + (v.co.z - (zt - 0.03)) * 0.35
        bm = bmesh.new(); bm.from_mesh(ob.data)
        for _ in range(10):                                   # a round, level band to hang the brim from
            mv = {}
            for v in bm.verts:
                if not v.is_boundary: continue
                nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                if len(nb) == 2: mv[v] = v.co.lerp((nb[0].co + nb[1].co) * 0.5, 0.6)
            for v, c in mv.items(): v.co = c; v.co.z = ec.z + 0.05
        rimE = [e for e in bm.edges if e.is_boundary]
        ext = bmesh.ops.extrude_edge_only(bm, edges=rimE)
        for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]:
            d = Vector((v.co.x - axis.x, v.co.y - axis.y, 0)).normalized()
            v.co += d * 0.05 + Vector((0, 0, -0.022))
        bm.to_mesh(ob.data); bm.free()
        OBJ['bucket'] = ob
        EXTRA['bucket'] = {'name': 'bucketHat', 'tag': 'acc:hat:bucket', 'force': 'head', 'mat': ('ID_14', hexlin('#d8d0b8'), 0.95, None, False)}
        print('BUCKET', len(ob.data.polygons))

    if JOB.get('helmet') is not None:
        o = JOB['helmet']; off = o.get('offset', 0.028)
        rim = lambda co: ec.z + 0.035 - 0.5 * max(0.0, co.y - L['eye_front'] - 0.04)
        ob = head_shell('helmet', rim, off, ears=True)
        bm = bmesh.new(); bm.from_mesh(ob.data)
        for _ in range(12):                                   # a hard shell: smooth the skull's lumps away
            new = {v: v.co.lerp(sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges), 0.6)
                   for v in bm.verts if v.link_edges and not v.is_boundary}
            for v, c in new.items(): v.co = c
        bm.to_mesh(ob.data); bm.free()
        _push_out(ob, B(), off)
        OBJ['helmet'] = ob
        EXTRA['helmet'] = {'name': 'helmet', 'tag': 'acc:hat:helmet', 'force': 'head', 'mat': ('ID_14', hexlin('#20242c'), 0.35, None, False)}
        print('HELMET', len(ob.data.polygons))

    if JOB.get('shades') is not None:
        ev = [v.co for v in OBJ['eyes'].data.vertices]
        eyes = [sum((c for c in ev if c.x * sg > 0), Vector()) / max(1, sum(1 for c in ev if c.x * sg > 0)) for sg in (1, -1)]
        yf = L['eye_front'] - 0.012
        bm = bmesh.new(); ring = []
        for e in eyes:
            c = bm.verts.new(Vector((e.x, yf, e.z)))
            pts = [bm.verts.new(Vector((e.x + math.cos(a) * 0.022, yf + 0.002 * math.sin(a) ** 2, e.z + math.sin(a) * 0.016 - (0.003 if math.sin(a) < 0 else 0))))
                   for a in [i / 18 * 2 * math.pi for i in range(18)]]
            for i in range(18): bm.faces.new((c, pts[i], pts[(i + 1) % 18]))
            ring.append(pts)
        # bridge and the arms back to the ears
        def bar(a, b, w=0.004):
            d = (b - a); up = Vector((0, 0, w))
            bm.faces.new((bm.verts.new(a - up), bm.verts.new(b - up), bm.verts.new(b + up), bm.verts.new(a + up)))
        bar(Vector((eyes[1].x + 0.02, yf, eyes[1].z + 0.004)), Vector((eyes[0].x - 0.02, yf, eyes[0].z + 0.004)), 0.003)
        for e, sg in zip(eyes, (1, -1)):
            a = Vector((e.x + sg * 0.022, yf, e.z + 0.004)); hb = Vector((sg * 0.074, axis.y + 0.01, e.z - 0.004))
            bm.faces.new((bm.verts.new(a - Vector((0, 0, 0.003))), bm.verts.new(hb - Vector((0, 0, 0.003))), bm.verts.new(hb + Vector((0, 0, 0.003))), bm.verts.new(a + Vector((0, 0, 0.003)))))
        me = bpy.data.meshes.new('shades'); bm.normal_update(); bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new('shades', me); bpy.context.scene.collection.objects.link(ob)
        for g in body.vertex_groups: ob.vertex_groups.new(name=g.name)
        OBJ['shades'] = ob
        EXTRA['shades'] = {'name': 'shades', 'tag': 'acc:face:shades', 'force': 'head', 'mat': ('ID_19', (0.02, 0.02, 0.025, 1), 0.12, None, False)}

    if JOB.get('scarf') is not None:
        # a terrace scarf: two thick wraps round the bottom of the neck, the ends hanging down the front, in bands of
        # the club's two colours (ID_11 / ID_12, look.scarf.a / .b)
        o = JOB['scarf']
        nz = J['neck'].z + o.get('lift', 0.0)
        ring = [v.co for v in body.data.vertices if abs(v.co.z - nz) < 0.012 and math.hypot(v.co.x - J['neck'].x, v.co.y - J['neck'].y) < 0.11]
        cx = sum(c.x for c in ring) / len(ring); cy = sum(c.y for c in ring) / len(ring)
        rx = max(abs(c.x - cx) for c in ring); ry = max(abs(c.y - cy) for c in ring)
        T = o.get('thick', 0.009); TH = o.get('height', 0.021); N, M = 32, 8
        bm = bmesh.new()
        def tube(zc, grow, phase):
            rows = []
            for i in range(N + 1):
                a = i / N * 2 * math.pi
                c = Vector((cx + math.sin(a) * (rx + T + 0.004 + grow), cy - math.cos(a) * (ry + T + 0.004 + grow), zc))
                out = Vector((math.sin(a) * ry, -math.cos(a) * rx, 0)).normalized()
                rows.append([bm.verts.new(c + out * math.cos(b) * T + Vector((0, 0, math.sin(b) * TH))) for b in [k / M * 2 * math.pi for k in range(M)]])
            for i in range(N):
                for k in range(M):
                    f = bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][(k + 1) % M], rows[i][(k + 1) % M]))
                    f.material_index = ((i + phase) // 3) % 2
        tube(nz - 0.016, 0.006, 0)
        tube(nz + 0.03, -0.002, 1)
        # the two ends, hanging down the chest from the front of the knot, a little apart
        bvh = B()
        for sg, ln in ((1, 0.30), (-1, 0.24)):
            x0 = cx + sg * 0.035; W = 0.085; rows = []
            for k in range(13):
                z = nz - 0.02 - ln * k / 12
                hit = bvh.ray_cast(Vector((x0, cy - 0.6, z)), Vector((0, 1, 0)), 1.0)
                yy = (hit[0].y if hit[0] is not None else cy - ry) - o.get('ends_out', 0.085)     # outside the clothes
                rows.append((bm.verts.new(Vector((x0 - W / 2, yy, z))), bm.verts.new(Vector((x0 + W / 2, yy, z)))))
            for k in range(12):
                f = bm.faces.new((rows[k][0], rows[k][1], rows[k + 1][1], rows[k + 1][0]))
                f.material_index = (k // 2) % 2
                f.normal_update()
                if f.normal.y > 0: f.normal_flip()           # face the front (the runtime's palette materials are one-sided)
        bm.normal_update()
        me = bpy.data.meshes.new('scarf'); bm.to_mesh(me); bm.free()
        for pl in me.polygons: pl.use_smooth = True
        ob = bpy.data.objects.new('scarf', me); bpy.context.scene.collection.objects.link(ob)
        for g in body.vertex_groups: ob.vertex_groups.new(name=g.name)
        OBJ['scarf'] = ob
        EXTRA['scarf'] = {'name': 'scarf', 'tag': 'acc:scarf', 'force': 'chest',
                          'mats': [('ID_11', hexlin('#c8102e'), 0.95), ('ID_12', hexlin('#f4f1e8'), 0.95)], 'face_mat': None}
        print('SCARF', len(ob.data.polygons))

    if JOB.get('beard') is not None:
        o = JOB['beard']
        nose_b = L['nose'].z - 0.014
        def keep(co, n):
            if radial(co) > 0.12 or co.y > axis.y + 0.01: return False
            if co.z > nose_b or co.z < L['mouth_z'] - 0.05 - 0.25 * max(0.0, co.y - (L['eye_front'] + 0.02)): return False   # jaw and chin, not the neck
            if co.z > ec.z - 0.045 and abs(co.x) > 0.05: return False        # cheeks stay clear up near the eyes
            if abs(co.x) < 0.028 and abs(co.z - L['mouth_z']) < 0.009: return False   # the mouth
            return abs(co.x) < 0.078
        ob = _shell(body, keep, 0.0, 'beard')
        _push_out(ob, B(), o.get('offset', 0.008))
        _smooth_rim(ob, B(), o.get('offset', 0.008))
        _uv_planar(ob, 'xz')
        OBJ['beard'] = ob
        EXTRA['beard'] = {'name': 'beard', 'tag': 'acc:face:beard', 'force': None,          # skinned like the jaw under it
                          'mat': ('ID_18', hexlin('#3a2717'), 0.8, _beard_image('beard_strands'), False)}
        print('BEARD', len(ob.data.polygons))

    if JOB.get('gloves') is not None:
        gname = {g.index: g.name for g in body.vertex_groups}
        HAND = ('hand', 'thumb', 'index', 'middle', 'ring', 'pinky')
        keepv = set()
        for v in body.data.vertices:
            tot = sum(g.weight for g in v.groups if _is_bone(gname.get(g.group, ''))) or 1
            hw = sum(g.weight for g in v.groups if gname.get(g.group, '').startswith(HAND)) / tot
            if hw > 0.5: keepv.add(v.index)
        kco = {tuple(round(c, 5) for c in body.data.vertices[i].co) for i in keepv}
        ob = _shell(body, lambda co, n: tuple(round(c, 5) for c in co) in kco, 0.0, 'gloves')
        _push_out(ob, B(), JOB['gloves'].get('offset', 0.003))
        OBJ['gloves'] = ob
        EXTRA['gloves'] = {'name': 'gloves', 'tag': 'acc:gloves', 'force': None, 'mat': ('ID_16', hexlin('#141416'), 0.7, None, False)}
        print('GLOVES', len(ob.data.polygons))

    if JOB.get('track_stripes') is not None:
        # three stripes down the outside of each sleeve, shoulder to cuff (layer track:stripes, ID_22 = look.jacket.trim on
        # a track top): ribbons cast onto the jacket, one object per arm segment so each rides its own bone
        o = JOB['track_stripes']; top = OBJ[o.get('on', 'top_jacket')]; bt = _bvh(top)
        W, GAP = o.get('width', 0.0085), o.get('gap', 0.006)
        for sg, sd in ((1, 'L'), (-1, 'R')):
            segs = (('upperArm', J['upperArm_' + sd] + Vector((0, 0, 0.03)), J['forearm_' + sd]),
                    ('forearm', J['forearm_' + sd], J['hand_' + sd] + (J['forearm_' + sd] - J['hand_' + sd]).normalized() * 0.035))
            for bone, a, b in segs:
                d = (b - a).normalized()
                out = Vector((sg, 0, 0)) + Vector((0, -0.15, 0)); out = (out - d * out.dot(d)).normalized()
                around = d.cross(out).normalized()
                bm = bmesh.new(); made = 0
                for k in (-1, 0, 1):
                    rows = []
                    for i in range(13):
                        p = a.lerp(b, i / 12)
                        ang = k * (W + GAP) / 0.05                      # ~5 cm sleeve radius: the stripes sit side by side
                        o2 = (out * math.cos(ang) + around * math.sin(ang)).normalized()
                        hit = bt.ray_cast(p + o2 * 0.25, -o2, 0.3)
                        if hit[0] is None: continue
                        n = hit[1] if hit[1].dot(o2) > 0 else -hit[1]
                        q = hit[0] + n * 0.0018; side = d.cross(n).normalized() * W * 0.5
                        rows.append((bm.verts.new(q - side), bm.verts.new(q + side), n))
                    for i in range(len(rows) - 1):
                        f = bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
                        f.normal_update()
                        if f.normal.dot(rows[i][2]) < 0: f.normal_flip()     # face out (one-sided palette material)
                        made += 1
                me = bpy.data.meshes.new('stripes'); bm.to_mesh(me); bm.free()
                role = 'trackStripes%s_%s' % (sd, bone)
                ob = bpy.data.objects.new(role, me); bpy.context.scene.collection.objects.link(ob)
                for p in me.polygons: p.use_smooth = True
                OBJ[role] = ob
                EXTRA[role] = {'name': role, 'tag': 'acc:track:stripes', 'force': bone + '_' + sd,
                               'mat': ('ID_22', hexlin(o.get('color', '#f4f1e8')), 0.7, None, False)}
                print('TRACK STRIPES', sd, bone, made, 'quads')

    if JOB.get('mohawk') is not None:
        o = JOB['mohawk']
        def keep(co, n):
            return abs(co.x) < o.get('half', 0.018) and co.z > ec.z + 0.03 and radial(co) < 0.15 and co.z > ec.z + 0.03 - 0.6 * max(0.0, co.y - axis.y - 0.04)
        ob = _shell(body, keep, 0.002, 'mohawk')
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.normal_update()
        ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
        vs = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
        for v in vs:
            d = Vector((0, v.co.y - axis.y, v.co.z - (ec.z - 0.02))).normalized()
            v.co += d * o.get('height', 0.05); v.co.x *= 0.45
        bm.normal_update(); bm.to_mesh(ob.data); bm.free()
        OBJ['mohawk'] = ob
        EXTRA['mohawk'] = {'name': 'mohawk', 'tag': 'acc:hair:mohawk', 'force': 'head', 'mat': ('ID_2', hexlin('#3a2717'), 0.7, None, False)}
        print('MOHAWK', len(ob.data.polygons))


def _soft_shell(body, keep, name, off, bvh, smooth=12):
    """A shell cut from the skin, its lumps smoothed away and held off the skin (fabric over the head / face)."""
    ob = _shell(body, keep, 0.0, name)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for _ in range(smooth):
        mv = {}
        for v in bm.verts:
            if not v.link_edges: continue
            if v.is_boundary:
                nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
                if len(nb) == 2: mv[v] = v.co.lerp((nb[0].co + nb[1].co) * 0.5, 0.5)
            else:
                mv[v] = v.co.lerp(sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges), 0.6)
        for v, c in mv.items(): v.co = c
        bm.to_mesh(ob.data)
        _push_out(ob, bvh, off)
        bm.free(); bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons: p.use_smooth = True
    return ob


def build_cover(JOB, OBJ, J, L):
    """Hood up (layer hood:up, the top's colour ID_3) and a snood over the nose (layer mask:snood, ID_14)."""
    body = OBJ['body']; ec, axis = L['eye'], L['axis']; bvh = _bvh(body)
    def radial(co): return math.hypot(co.x - axis.x, co.y - axis.y)
    if JOB.get('hood') is not None:
        o = JOB['hood']; nz = J['neck'].z - 0.02
        def keep(co, n):
            if co.z < nz or radial(co) > 0.17: return False
            face = co.y < axis.y - 0.015 and abs(co.x) < 0.068 and co.z < ec.z + 0.075
            return not face
        ob = _soft_shell(body, keep, 'hood', o.get('offset', 0.03), bvh)
        OBJ['hood'] = ob
        EXTRA['hood'] = {'name': 'hood', 'tag': 'acc:hood:up', 'force': None, 'mat': ('ID_3', hexlin(o.get('color', '#141416')), 0.9, None, False)}
        print('HOOD', len(ob.data.polygons))
    if JOB.get('snood') is not None:
        o = JOB['snood']
        def keep(co, n):
            return J['neck'].z - 0.04 < co.z < L['nose'].z + 0.004 and radial(co) < 0.14
        ob = _soft_shell(body, keep, 'snood', o.get('offset', 0.012), bvh, 16)
        OBJ['snood'] = ob
        EXTRA['snood'] = {'name': 'snood', 'tag': 'acc:mask:snood', 'force': None, 'mat': ('ID_14', hexlin(o.get('color', '#141416')), 0.95, None, False)}
        print('SNOOD', len(ob.data.polygons))
