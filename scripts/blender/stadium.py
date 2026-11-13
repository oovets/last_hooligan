# The Football Tour's grounds as 3D dioramas for the level select cards: each stadium is built from a few parameters
# taken from photos of the real ground (stands and their tiers, roofs, seat colours, facades, floodlights, what's around
# it), lit for a night match and rendered from above at the game's isometric angle.
#
#   Blender -b --factory-startup --python scripts/blender/stadium.py -- <out_dir> [id ...]
#   -> <out_dir>/<id>.png (1600x900); scripts/build_levelshots.py turns them into assets/levelshots/<id>.jpg
#
# Reference photos (Wikimedia Commons): Old Trafford, Anfield, Stamford Bridge: drone shots by Arne Müseler
# (CC BY-SA 3.0 DE); Ibrox from the air by Thomas Nugent (CC BY-SA 2.0); The Den panorama by TheLostBoy (CC BY-SA 4.0).
import bpy, bmesh, math, random, sys, os
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else '/tmp/stadiums'
ONLY = ARGS[1:]

PITCH_L, PITCH_W, RUNOFF = 105.0, 68.0, 6.0

def hexc(h, a=1.0):
    h = h.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)

# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()                     # (the old scene's materials are gone)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    try: sc.eevee.taa_render_samples = 48
    except Exception: pass
    try: sc.eevee.use_shadows = True
    except Exception: pass
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    sc.view_settings.exposure = -0.4
    w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = hexc('#0b1020'); bg.inputs[1].default_value = 0.6
    return sc

_mats = {}
def mat(name, color, rough=0.7, metal=0.0, emit=None, emit_k=0.0):
    key = (name, color, rough, metal, emit, emit_k)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexc(color); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = hexc(emit); b.inputs['Emission Strength'].default_value = emit_k
    _mats[key] = m
    return m

def crowd_mat(seat, kit=('#141416', '#f4f1e8'), fill=0.7):
    """seats with a packed crowd on them: dark coats, faces, scarves in the club's colours, a few empty seats"""
    key = ('crowd', seat, kit, fill)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new('crowd'); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = 0.9
    tc = N.new('ShaderNodeTexCoord')
    vor = N.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 3.2; vor.feature = 'F1'
    L.new(tc.outputs['Object'], vor.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); cr = ramp.color_ramp
    cols = ['#121216', '#1e1e26', '#a87a5a', kit[0], '#2a2a32', kit[1], '#16161c', '#1a2236']   # coats, faces, scarves
    cr.elements[0].color = hexc(cols[0]); cr.elements[1].position = 1.0; cr.elements[1].color = hexc(cols[-1])
    for i, c in enumerate(cols[1:-1]):
        e = cr.elements.new((i + 1) / (len(cols) - 1)); e.color = hexc(c)
    cr.interpolation = 'CONSTANT'
    L.new(vor.outputs['Color'], ramp.inputs['Fac']) if 'Color' in vor.outputs else L.new(vor.outputs['Distance'], ramp.inputs['Fac'])
    noise = N.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 1.4
    L.new(tc.outputs['Object'], noise.inputs['Vector'])
    thr = N.new('ShaderNodeMath'); thr.operation = 'GREATER_THAN'; thr.inputs[1].default_value = 1 - fill
    L.new(noise.outputs['Fac'], thr.inputs[0])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs[6].default_value = hexc(seat)
    L.new(thr.outputs[0], mix.inputs['Factor'])
    L.new(ramp.outputs['Color'], mix.inputs[7])
    L.new(mix.outputs[2], b.inputs['Base Color'])
    L.new(mix.outputs[2], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 0.015
    _mats[key] = m
    return m

def link(obj):
    bpy.context.scene.collection.objects.link(obj); return obj

def box(name, size, loc, material, rot_z=0.0):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me)); o.location = loc; o.rotation_euler.z = rot_z
    o.data.materials.append(material); return o

def prism(name, prof, length, mats, slope_idx=None):
    """a profile [(d, z), ...] (d = away from the pitch) swept along local x over `length`; face slope_idx gets mats[1]"""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    hl = length / 2
    a = [bm.verts.new((-hl, d, z)) for d, z in prof]
    b = [bm.verts.new((hl, d, z)) for d, z in prof]
    n = len(prof)
    for i in range(n):
        f = bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
        f.material_index = 1 if i == slope_idx else 0
    bm.faces.new(list(reversed(a))); bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me))
    for m in mats: o.data.materials.append(m)
    return o

SIDES = {   # where a stand goes: (rotation, origin, length along the pitch)
    'N': (0.0, lambda g: (0, PITCH_W / 2 + g, 0), PITCH_L),
    'S': (math.pi, lambda g: (0, -(PITCH_W / 2 + g), 0), PITCH_L),
    'E': (-math.pi / 2, lambda g: (PITCH_L / 2 + g, 0, 0), PITCH_W),
    'W': (math.pi / 2, lambda g: (-(PITCH_L / 2 + g), 0, 0), PITCH_W),
}

def stand(cfg, side, S):
    """one stand: tiers of seats rising away from the pitch, a back wall (the facade), a roof over the seats"""
    rot, org, base_len = SIDES[side]
    L = cfg.get('len', base_len + 6)
    concrete, facade = mat('concrete', '#4a4e56', 0.85), mat('facade', cfg.get('facade', S['facade']), 0.6)
    crowd = crowd_mat(S['seat'], S.get('kit', ('#141416', '#f4f1e8')))
    objs = []
    d0, top, back = 0.0, 0.0, 0.0
    for i, (dep, zf, zb) in enumerate(cfg['tiers']):
        # each tier: the seats slope up from its front lip; upper tiers start a little way back over the one below
        prof = [(d0, zf - 0.4), (d0, zf), (d0 + dep, zb), (d0 + dep, max(0, zf - 4) if i else 0), (d0, max(0, zf - 4) if i else 0)]
        objs.append(prism(f'{side}_tier{i}', prof, L, [concrete, crowd], slope_idx=1))
        back = max(back, d0 + dep)
        d0 = d0 + dep * 0.72
        top = max(top, zb)
    rz = cfg.get('roof', top + 4)
    # facade: the back wall, ground to roof
    f = prism(f'{side}_facade', [(back, 0), (back, rz), (back + 2.5, rz), (back + 2.5, 0)], L, [facade]); objs.append(f)
    objs.append(prism(f'{side}_concourse', [(back + 2.5, rz * 0.42), (back + 2.5, rz * 0.42 + 1.0), (back + 2.6, rz * 0.42 + 1.0), (back + 2.6, rz * 0.42)], L * 0.96, [mat('concourse', '#ffe0a0', 0.4, 0, '#ffd890', 1.2)]))
    if cfg.get('band'):
        objs.append(prism(f'{side}_band', [(back + 2.5, 2), (back + 2.5, 5), (back + 2.7, 5), (back + 2.7, 2)], L, [mat('band', cfg['band'], 0.5)]))
    # roof: from the back out over the seats, a little tilt up at the front
    front = cfg.get('roof_front', back * 0.42)        # the roof covers the back of the stand, the front rows are open
    roofm = mat('roof', S.get('roof', '#d8dce2'), 0.55, 0.3)
    objs.append(prism(f'{side}_roof', [(front, rz + 1.2), (back + 2.5, rz), (back + 2.5, rz + 1.4), (front, rz + 2.0)], L, [roofm]))
    # roof-front floodlight strip
    if S.get('floods', 'roof') == 'roof':
        objs.append(prism(f'{side}_lights', [(front, rz + 0.6), (front + 1.2, rz + 0.5), (front + 1.2, rz + 1.1), (front, rz + 1.2)], L * 0.9, [mat('lamp', '#fff6e0', 0.3, 0, '#fff2d8', 18.0)]))
    if cfg.get('masts'):
        for k in range(cfg['masts']):
            x = -L / 2 + (k + 0.5) * L / cfg['masts']
            m = box(f'{side}_mast{k}', (1.4, 1.4, 14), (x, back + 1.2, rz + 7), mat('mast', '#f2c811', 0.4, 0.3)); objs.append(m)
    p = org(RUNOFF)
    for o in objs:
        o.location = Vector(o.location); o.location.rotate(__import__('mathutils').Euler((0, 0, rot)))
        o.location += Vector(p); o.rotation_euler.z += rot
    return back + 2.7, rz

def corner(cx, cy, size, h, S):
    crowd = crowd_mat(S['seat'], S.get('kit', ('#141416', '#f4f1e8')))
    box(f'corner_{cx}_{cy}', (size, size, h), (cx, cy, h / 2), mat('facade', S['facade'], 0.6))
    box(f'cornerWin_{cx}_{cy}', (size + 0.2, size + 0.2, 1.0), (cx, cy, h * 0.45), mat('concourse', '#ffe0a0', 0.4, 0, '#ffd890', 1.2))
    o = box(f'cornerTop_{cx}_{cy}', (size * 0.9, size * 0.9, 1), (cx, cy, h + 0.5), crowd)
    box(f'cornerRoof_{cx}_{cy}', (size, size, 1.2), (cx, cy, h + 5), mat('roof', S.get('roof', '#d8dce2'), 0.45, 0.2))

def pitch(S):
    me = bpy.data.meshes.new('pitch'); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(((PITCH_L + 2 * RUNOFF) / 2, (PITCH_W + 2 * RUNOFF) / 2, 1)), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new('pitch', me)); o.location.z = 0.02
    m = bpy.data.materials.new('grass'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = 0.85
    tc = N.new('ShaderNodeTexCoord'); wave = N.new('ShaderNodeTexWave'); wave.inputs['Scale'].default_value = 0.065
    wave.wave_profile = 'SAW' if False else 'SIN'; wave.bands_direction = 'X'
    nt.links.new(tc.outputs['Object'], wave.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].color = hexc('#2a7a2e'); ramp.color_ramp.elements[1].position = 0.5; ramp.color_ramp.elements[1].color = hexc('#34903a')
    nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    o.data.materials.append(m)
    white = mat('line', '#f4f4f0', 0.5, 0, '#ffffff', 0.4)
    hl, hw, t = PITCH_L / 2, PITCH_W / 2, 0.25
    for (sx, sy, lx, ly) in [(PITCH_L, t, 0, hw), (PITCH_L, t, 0, -hw), (t, PITCH_W, hl, 0), (t, PITCH_W, -hl, 0), (t, PITCH_W, 0, 0),
                             (16.5, t, hl - 8.25, 20.15), (16.5, t, hl - 8.25, -20.15), (t, 40.3, hl - 16.5, 0),
                             (16.5, t, -hl + 8.25, 20.15), (16.5, t, -hl + 8.25, -20.15), (t, 40.3, -hl + 16.5, 0)]:
        box('line', (sx, sy, 0.05), (lx, ly, 0.05), white)
    ring = bpy.data.meshes.new('circle'); bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=False, radius=9.15, segments=48)
    bm.to_mesh(ring); bm.free()
    c = link(bpy.data.objects.new('circle', ring)); c.location.z = 0.06
    mod = c.modifiers.new('w', 'WIREFRAME'); mod.thickness = 0.25; c.data.materials.append(white)
    for gx in (hl, -hl):
        box('goal', (0.3, 7.3, 2.4), (gx + (1.2 if gx > 0 else -1.2), 0, 1.2), mat('goal', '#f4f4f0', 0.4, 0, '#ffffff', 0.6))

def floodlight_pylons(ext, S):
    for sx in (1, -1):
        for sy in (1, -1):
            x, y = sx * (PITCH_L / 2 + ext * 0.9), sy * (PITCH_W / 2 + ext * 0.9)
            box('pylon', (1.6, 1.6, 50), (x, y, 25), mat('pylon', '#9a9ea8', 0.5, 0.6))
            box('pylonhead', (6, 1.2, 4), (x, y, 51), mat('lamp', '#fff6e0', 0.3, 0, '#fff2d8', 18.0), rot_z=math.atan2(y, x) + math.pi / 2)

def lights(S):
    # the floodlit pitch: a big soft light above it, spots from the corners, a dim moon
    bpy.ops.object.light_add(type='AREA', location=(0, 0, 70)); a = bpy.context.object
    a.data.shape = 'RECTANGLE'; a.data.size = PITCH_L * 1.4; a.data.size_y = PITCH_W * 1.6; a.data.energy = 160000; a.data.color = (1, 0.96, 0.9)
    for sx in (1, -1):
        for sy in (1, -1):
            bpy.ops.object.light_add(type='SPOT', location=(sx * 80, sy * 60, 60)); s = bpy.context.object
            s.data.energy = 120000; s.data.spot_size = math.radians(70); s.data.spot_blend = 0.6; s.data.color = (1, 0.95, 0.85)
            d = Vector((0, 0, 0)) - s.location; s.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 100)); m = bpy.context.object
    m.data.energy = 0.9; m.data.color = (0.6, 0.7, 1.0); m.rotation_euler = (math.radians(50), 0, math.radians(30))
    # a soft fill from the camera's side so the facades facing us aren't black
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 100)); f = bpy.context.object
    f.data.energy = 0.8; f.data.color = (1.0, 0.85, 0.65); f.rotation_euler = (math.radians(58), 0, math.radians(128))

def surroundings(S, ext, seed):
    rnd = random.Random(seed)
    ground = box('ground', (900, 900, 0.2), (0, 0, -0.1), mat('ground', '#2a2c34', 0.95))
    road = mat('road', '#2c2e36', 0.9)
    hx, hy = PITCH_L / 2 + ext + 14, PITCH_W / 2 + ext + 14
    for (sx, sy, x, y) in [(2 * hx + 30, 10, 0, hy), (2 * hx + 30, 10, 0, -hy), (10, 2 * hy + 30, hx, 0), (10, 2 * hy + 30, -hx, 0)]:
        box('road', (sx, sy, 0.05), (x, y, 0.03), road)
    # streets of houses beyond the roads (terraces / tenements / sheds by S['town'])
    town = S.get('town', 'terrace')
    wall = mat('housewall', {'terrace': '#7a4a36', 'tenement': '#8a4a3a', 'shed': '#4a4e58', 'mixed': '#6a6258'}[town], 0.85)
    win = mat('window', '#ffd890', 0.4, 0, '#ffcf80', 1.6)
    roofm = mat('houseroof', '#2a2a30', 0.8)
    for _ in range(260):
        ang = rnd.uniform(0, math.tau); r = rnd.uniform(1.15, 2.6)
        x, y = math.cos(ang) * (hx + 12) * r, math.sin(ang) * (hy + 12) * r
        if abs(x) < hx + 8 and abs(y) < hy + 8: continue
        if S.get('hotel') and x < -hx - 6 and abs(y) < 50 and x > -hx - 70: continue
        w, d = rnd.uniform(10, 22), rnd.uniform(7, 12)
        h = {'terrace': rnd.uniform(6, 9), 'tenement': rnd.uniform(12, 16), 'shed': rnd.uniform(6, 12), 'mixed': rnd.uniform(6, 20)}[town]
        rz = round(ang / (math.pi / 2)) * (math.pi / 2)
        box('house', (w, d, h), (x, y, h / 2), wall, rot_z=rz)
        box('houseroof', (w + 0.4, d + 0.4, 0.6), (x, y, h + 0.3), roofm, rot_z=rz)
        for k in range(int(w // 4)):
            if rnd.random() < 0.45: box('win', (1.4, d + 0.1, 1.2), (x + (k - w / 8) * 4 * (1 if rz % math.pi < 0.1 else 0), y + (k - w / 8) * 4 * (0 if rz % math.pi < 0.1 else 1), h * 0.6), win, rot_z=rz)

def camera(ext):
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
    span = (PITCH_L + 2 * ext) * 1.75
    cam.ortho_scale = span
    o = link(bpy.data.objects.new('cam', cam)); bpy.context.scene.camera = o
    el, az = math.radians(34), math.radians(38)
    d = Vector((math.cos(el) * math.cos(az), -math.cos(el) * math.sin(az), math.sin(el)))
    target = Vector((0, 0, 8))
    o.location = target + d * 600
    o.rotation_euler = (target - o.location).to_track_quat('-Z', 'Y').to_euler()
    cam.clip_start, cam.clip_end = 1, 2000

# ---------------------------------------------------------------- the grounds (from the reference photos)
STADIUMS = {
    'oldtrafford': dict(seat='#c8102e', kit=('#c8102e', '#141416'), facade='#b8bcc4', roof='#e2e6ea', town='mixed',
        stands={'N': dict(tiers=[(18, 1, 14), (16, 16, 30), (12, 32, 42)], roof=46, masts=6, band='#c8102e', len=178),   # (round the corners)
                'S': dict(tiers=[(18, 1, 14), (10, 16, 22)], roof=26, band='#c8102e'),
                'E': dict(tiers=[(18, 1, 14), (16, 16, 30)], roof=34, band='#c8102e'),
                'W': dict(tiers=[(18, 1, 14), (16, 16, 30)], roof=34, band='#c8102e')},
        corners=[]),
    'anfield': dict(seat='#c8102e', kit=('#c8102e', '#f4f1e8'), facade='#e8ecf0', roof='#eef0f2', town='terrace',
        stands={'N': dict(tiers=[(18, 1, 14), (16, 16, 30), (12, 32, 42)], roof=46, len=170),
                'W': dict(tiers=[(44, 1, 30)], roof=34),
                'E': dict(tiers=[(16, 1, 13), (14, 15, 27)], roof=31),
                'S': dict(tiers=[(16, 1, 13), (12, 15, 25)], roof=29)},
        corners=[]),
    'stamfordbridge': dict(seat='#1f4fb4', kit=('#1f4fb4', '#f4f1e8'), facade='#c8ccd2', roof='#f0f2f4', town='mixed', hotel=True,
        stands={'N': dict(tiers=[(14, 1, 11), (12, 13, 23), (10, 25, 33)], roof=36, len=172),
                'S': dict(tiers=[(14, 1, 11), (12, 13, 22), (10, 24, 31)], roof=34, len=172),
                'E': dict(tiers=[(16, 1, 13), (14, 15, 26)], roof=29),
                'W': dict(tiers=[(14, 1, 11), (10, 13, 20)], roof=23)},
        corners=[]),
    'ibrox': dict(seat='#1b458f', kit=('#1b458f', '#f4f4f0'), facade='#b8bcc4', roof='#d8dce2', town='tenement',
        stands={'S': dict(tiers=[(16, 1, 12), (12, 14, 24), (8, 26, 32)], roof=36, facade='#9a3a2a'),
                'N': dict(tiers=[(16, 1, 13), (12, 15, 24)], roof=27, len=168),
                'E': dict(tiers=[(16, 1, 13), (12, 15, 24)], roof=27),
                'W': dict(tiers=[(16, 1, 13), (12, 15, 24)], roof=27)},
        corners=[]),
    'theden': dict(seat='#1d4fa8', kit=('#1d4fa8', '#f4f4f0'), facade='#3a4458', roof='#5a6272', town='shed',
        stands={'N': dict(tiers=[(20, 1, 13)], roof=17), 'S': dict(tiers=[(20, 1, 13)], roof=17),
                'E': dict(tiers=[(18, 1, 12)], roof=16), 'W': dict(tiers=[(18, 1, 12)], roof=16)},
        corners=[]),
}

def build(sid, S):
    reset()
    pitch(S)
    ext = 0
    for side, cfg in S['stands'].items():
        back, rz = stand(cfg, side, S)
        ext = max(ext, back + RUNOFF)
    for c, h in S.get('corners', []):
        sx = 1 if 'E' in c else -1; sy = 1 if 'N' in c else -1
        size = 22
        corner(sx * (PITCH_L / 2 + RUNOFF + size / 2 + 2), sy * (PITCH_W / 2 + RUNOFF + size / 2 + 2), size, h, S)
    if S.get('floods') == 'pylons': floodlight_pylons(ext, S)
    if S.get('hotel'):
        hm = mat('hotel', '#d8ccb0', 0.7); hw = mat('window', '#ffd890', 0.4, 0, '#ffcf80', 3.0)
        for (sx, sy, x, y, h) in [(26, 34, -(PITCH_L / 2 + ext + 18), 22, 30), (30, 26, -(PITCH_L / 2 + ext + 20), -18, 24)]:
            box('hotel', (sx, sy, h), (x, y, h / 2), hm); box('hotelwin', (sx + 0.2, sy * 0.8, 1.2), (x, y, h * 0.6), hw)
    surroundings(S, ext, sum(map(ord, sid)))
    lights(S)
    camera(ext)
    os.makedirs(OUT, exist_ok=True)
    bpy.context.scene.render.filepath = os.path.join(OUT, sid + '.png')
    bpy.ops.render.render(write_still=True)
    print('[stadium] rendered', sid)

for sid, S in STADIUMS.items():
    if ONLY and sid not in ONLY: continue
    build(sid, S)
