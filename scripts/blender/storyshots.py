# The story levels as 3D dioramas for the level select cards, in the same style as the Football Tour's grounds
# (scripts/blender/stadium.py). The story is set in your club's town (AIK by default), so where a level has a real place
# behind it, that's what's built: THE DERBY at Raasunda, THE AWAY END at Stockholms Stadion (the rival's ground, with
# its brick towers and running track), THE LAST STAND outside a big modern arena (Friends Arena-style) with a plaza.
# The rest are what the level is: a street of terraces and a corner pub, the pub and its beer garden, a tube station
# cut open, the city's neon square, the docks.
#
#   Blender -b --factory-startup --python scripts/blender/storyshots.py -- <out_dir> [id ...]
#   -> <out_dir>/<id>.png; scripts/build_levelshots.py turns them into assets/levelshots/<id>.jpg
import bpy, bmesh, math, random, sys, os
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stadium as ST
from stadium import box, mat, hexc, link

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else '/tmp/story'
ONLY = ARGS[1:]
ST.OUT = OUT

WIN = lambda k=1.6: mat('window', '#ffd890', 0.4, 0, '#ffcf80', k)

def night(moon=1.6, fill=1.3):
    bpy.context.scene.view_settings.exposure = 0.35      # (the story scenes are streets at night: a touch brighter than the grounds)
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 100)); m = bpy.context.object
    m.data.energy = moon; m.data.color = (0.6, 0.7, 1.0); m.rotation_euler = (math.radians(50), 0, math.radians(30))
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 100)); f = bpy.context.object
    f.data.energy = fill; f.data.color = (1.0, 0.85, 0.65); f.rotation_euler = (math.radians(58), 0, math.radians(128))

def point(loc, energy=800, color=(1, 0.8, 0.55), r=0.5):
    bpy.ops.object.light_add(type='POINT', location=loc); l = bpy.context.object
    l.data.energy = energy; l.data.color = color; l.data.shadow_soft_size = r
    return l

def ground(color='#2a2c34', size=400):
    box('ground', (size, size, 0.2), (0, 0, -0.1), mat('ground', color, 0.95))

def lamp(x, y, h=6, col=(1, 0.75, 0.45), e=2400):
    box('lamppost', (0.25, 0.25, h), (x, y, h / 2), mat('post', '#2a2c32', 0.5, 0.6))
    box('lamphead', (1.0, 0.5, 0.25), (x, y, h), mat('lamp', '#fff0d0', 0.3, 0, '#ffd8a0', 12.0))
    point((x, y, h - 0.4), e, col)

def house(x, y, w, d, h, wall, rot=0.0, roof='#3a2e2a', seed=0, door='#3a1e14'):
    rnd = random.Random(seed)
    box('house', (w, d, h), (x, y, h / 2), mat('wall_' + wall, wall, 0.9), rot_z=rot)
    # pitched roof: a prism along the length
    me = bpy.data.meshes.new('roof'); bm = bmesh.new()
    hw, hd = w / 2 + 0.3, d / 2 + 0.3
    vs = [bm.verts.new(v) for v in [(-hw, -hd, 0), (hw, -hd, 0), (hw, 0, d * 0.35), (-hw, 0, d * 0.35), (-hw, hd, 0), (hw, hd, 0)]]
    bm.faces.new((vs[0], vs[1], vs[2], vs[3])); bm.faces.new((vs[3], vs[2], vs[5], vs[4])); bm.faces.new((vs[0], vs[3], vs[4])); bm.faces.new((vs[1], vs[5], vs[2]))
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new('roof', me)); o.location = (x, y, h); o.rotation_euler.z = rot
    o.data.materials.append(mat('roof_' + roof, roof, 0.8))
    # windows on the long sides, lit at random, and a door
    ca, sa = math.cos(rot), math.sin(rot)
    for side in (-1, 1):
        for fl in range(int(h // 3)):
            for k in range(max(1, int(w // 3))):
                if rnd.random() < 0.45: continue
                lx = -w / 2 + 1.5 + k * 3; ly = side * (d / 2 + 0.05); lz = 1.6 + fl * 3
                box('win', (1.1, 0.12, 1.3), (x + lx * ca - ly * sa, y + lx * sa + ly * ca, lz), WIN(rnd.uniform(1.0, 2.2)), rot_z=rot)
    ly = -(d / 2 + 0.05)
    box('door', (1.0, 0.12, 2.0), (x - ly * sa, y + ly * ca, 1.0), mat('door', door, 0.6), rot_z=rot)

def car(x, y, rot, color, seed=0):
    box('carbody', (4.2, 1.8, 0.8), (x, y, 0.6), mat('car_' + color, color, 0.35, 0.4), rot_z=rot)
    ca, sa = math.cos(rot), math.sin(rot)
    box('carcab', (2.2, 1.6, 0.6), (x - 0.2 * ca, y - 0.2 * sa, 1.25), mat('glass', '#1a2030', 0.15, 0.3), rot_z=rot)

def road(x, y, w, d, rot=0.0, lines=True):
    box('road', (w, d, 0.06), (x, y, 0.03), mat('asphalt', '#24262e', 0.6), rot_z=rot)
    if lines:
        ca, sa = math.cos(rot), math.sin(rot)
        for k in range(int(w // 6)):
            lx = -w / 2 + 3 + k * 6
            box('dash', (2.5, 0.2, 0.02), (x + lx * ca, y + lx * sa, 0.07), mat('paint', '#e8e4d0', 0.5, 0, '#ffffff', 0.3), rot_z=rot)

def pave(x, y, w, d, rot=0.0):
    box('pave', (w, d, 0.2), (x, y, 0.1), mat('pave', '#5a5c64', 0.85), rot_z=rot)

def cam(target, span, el=34, az=38):
    ST.camera(0, span=span, target=target, el=el, az=az)

# ---------------------------------------------------------------- the levels
def streets():
    ST.reset(); ground()
    road(0, 0, 90, 10); pave(0, 7, 90, 4); pave(0, -7, 90, 4)
    rnd = random.Random(1)
    for i in range(9):                               # terraced houses both sides, brick in a few shades
        for side in (1, -1):
            x = -36 + i * 9
            if side == 1 and i in (5, 6): continue   # the corner pub goes here
            house(x, side * 14, 8.6, 8, rnd.choice([6, 6.5, 7]), rnd.choice(['#7a3e2c', '#8a4a32', '#6a3626', '#7e4a3a']), seed=i * 3 + (side > 0))
    # the corner pub: green tiled ground floor, a lit sign, a light over the door
    box('pub', (17, 9, 7.5), (13.5, 14.5, 3.75), mat('pubwall', '#3a5a3a', 0.7))
    box('pubtop', (17.2, 9.2, 1.0), (13.5, 14.5, 7.6), mat('pubtrim', '#1e2a1e', 0.6))
    box('pubsign', (8, 0.3, 1.0), (13.5, 9.9, 5.6), mat('pubsign', '#f2c811', 0.4, 0, '#ffd84a', 6.0))
    for k in range(4): box('pubwin', (2.4, 0.15, 2.2), (7.5 + k * 4, 9.95, 2.0), WIN(3.0))
    point((13.5, 8.5, 3), 1500, (1, 0.7, 0.4), 1.0)
    for x in (-30, -12, 6, 24, 40): lamp(x, 9.3); lamp(x - 9, -9.3)
    for i, (x, c) in enumerate([(-24, '#7a1e1e'), (-8, '#1e3a6a'), (20, '#2a2a30'), (32, '#c8b060')]):
        car(x, 3.6 if i % 2 else -3.6, 0, c)
    box('busstop', (4, 1.4, 2.6), (-2, -8.2, 1.3), mat('glass', '#8ab0c8', 0.1, 0.2))
    night(); cam((0, 0, 3), 84)

def pub():
    ST.reset(); ground('#262830')
    # the pub: cream render upstairs, dark wood and big lit windows downstairs, a hanging sign
    box('pubwall', (26, 14, 9), (0, 6, 4.5), mat('pubcream', '#d8ccae', 0.85))
    box('pubground', (26.2, 14.2, 4), (0, 6, 2), mat('pubwood', '#2a1a12', 0.6))
    box('pubroof', (27, 15, 0.8), (0, 6, 9.4), mat('slate', '#2a2c34', 0.8))
    for k in range(5): box('pubwin', (3.2, 0.2, 2.6), (-10 + k * 5, -1.05, 2.0), WIN(3.2))
    for k in range(5): box('upwin', (1.6, 0.2, 1.8), (-10 + k * 5, -1.05, 6.5), WIN(1.4))
    box('pubsign', (0.3, 3.0, 2.0), (13.4, -1.6, 6.5), mat('pubsign', '#f2c811', 0.4, 0, '#ffd84a', 5.0))
    box('lettering', (14, 0.3, 1.0), (0, -1.2, 4.6), mat('letters', '#f2c811', 0.4, 0, '#ffd84a', 3.0))
    # beer garden: picnic tables, umbrellas, a string of bulbs
    pave(0, -12, 34, 16)
    rnd = random.Random(3)
    for i in range(8):
        x, y = -13 + (i % 4) * 8.5, -8 - (i // 4) * 7
        box('table', (2.6, 1.2, 0.2), (x, y, 0.8), mat('woodtable', '#7a5a38', 0.8))
        for s in (-1, 1): box('bench', (2.6, 0.4, 0.15), (x, y + s * 1.0, 0.5), mat('woodtable', '#7a5a38', 0.8))
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.8, depth=0.8, location=(x, y, 2.8)); u = bpy.context.object
        u.data.materials.append(mat('umb', rnd.choice(['#141416', '#f2c811']), 0.6))
        box('umbpole', (0.1, 0.1, 2.6), (x, y, 1.3), mat('post', '#2a2c32', 0.5, 0.6))
    for k in range(20):
        x = -16 + k * 1.7
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(x, -4.2, 3.3 - abs(math.sin(k * 0.6)) * 0.4))
        bpy.context.object.data.materials.append(mat('bulb', '#fff0c0', 0.3, 0, '#ffd890', 25.0))
    point((0, -10, 5), 3000, (1, 0.75, 0.45), 4.0)
    road(0, -26, 70, 9)
    for i, c in enumerate(['#7a1e1e', '#2a2a30', '#1e3a6a']): car(-14 + i * 6, -21.5, math.pi / 2, c)
    for i in range(4): house(-34 + (i % 2) * 70, 10 - (i // 2) * 20, 10, 9, 7, '#7a4a36', rot=math.pi / 2, seed=40 + i)
    for x in (-20, 8, 26): lamp(x, -21)
    night(); cam((0, -6, 2), 60)

def underground():
    ST.reset(); ground('#1a1a1e')
    tiles, dark = mat('tiles', '#d8d2b8', 0.4), mat('tilesgreen', '#2f6a4a', 0.5)
    box('platformA', (70, 8, 1.2), (0, 6, 0.6), mat('platform', '#7a7880', 0.8))
    box('platformB', (70, 8, 1.2), (0, -14, 0.6), mat('platform', '#7a7880', 0.8))
    box('edgeA', (70, 0.6, 0.05), (0, 2.2, 1.22), mat('yellowline', '#f2c811', 0.5, 0, '#f2c811', 0.5))
    box('edgeB', (70, 0.6, 0.05), (0, -10.2, 1.22), mat('yellowline', '#f2c811', 0.5, 0, '#f2c811', 0.5))
    box('pit', (70, 12, 0.3), (0, -4, -0.1), mat('ballast', '#3a3632', 0.95))
    for y in (-2, -6):
        for o in (-0.7, 0.7): box('rail', (70, 0.15, 0.2), (0, y + o, 0.15), mat('rail', '#9a9ea8', 0.3, 0.9))
    # the back wall (tiled, a green band, the line's roundels) and the cut-away end walls
    box('wallback', (70, 0.8, 7), (0, 10.4, 3.5), tiles); box('band', (70, 0.85, 0.8), (0, 10.4, 2.6), dark)
    for k in range(5):
        bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.2, location=(-24 + k * 12, 9.9, 4.6), rotation=(math.pi / 2, 0, 0))
        bpy.context.object.data.materials.append(mat('roundel', '#c8102e', 0.4, 0, '#ff3040', 1.5))
        box('roundelbar', (2.6, 0.25, 0.5), (-24 + k * 12, 9.8, 4.6), mat('roundelbar', '#1f3f8f', 0.4, 0, '#3a6aff', 1.0))
    box('wallend', (0.8, 25, 7), (-35, -4, 3.5), tiles)
    # a train in at the far platform: silver, a red band, lit windows
    box('train', (52, 3.0, 3.4), (4, -6, 1.9), mat('trainbody', '#c8ccd2', 0.3, 0.7))
    box('trainband', (52.1, 3.05, 0.5), (4, -6, 1.2), mat('trainred', '#c8102e', 0.4))
    for k in range(13): box('trainwin', (2.2, 3.1, 1.1), (-19 + k * 3.9, -6, 2.6), WIN(2.5))
    for x in range(-30, 31, 10):                     # strip lights under the (cut away) ceiling
        box('strip', (6, 0.3, 0.15), (x, 6, 6.2), mat('striplight', '#f0f4ff', 0.3, 0, '#e8f0ff', 10.0)); point((x, 6, 5.6), 700, (0.9, 0.95, 1))
        box('strip', (6, 0.3, 0.15), (x, -14, 6.2), mat('striplight', '#f0f4ff', 0.3, 0, '#e8f0ff', 10.0)); point((x, -14, 5.6), 700, (0.9, 0.95, 1))
    # stairs up at the end
    for k in range(8): box('step', (6, 1.2, 0.4 * (k + 1)), (28 - k * 0.0, 9.0 - k * 1.2, 0.2 * (k + 1) + 1.2), mat('platform', '#7a7880', 0.8))
    night(0.8, 0.8); cam((0, -3, 2), 64)

def city():
    ST.reset(); ground('#1e2028')
    box('plaza', (60, 44, 0.2), (0, 0, 0.1), mat('wetstone', '#3a3c46', 0.15, 0.2))   # wet: it reflects the neon
    bpy.ops.mesh.primitive_cylinder_add(radius=5, depth=1.0, location=(0, 0, 0.6)); bpy.context.object.data.materials.append(mat('stone', '#6a6a72', 0.7))
    bpy.ops.mesh.primitive_cylinder_add(radius=4.4, depth=0.3, location=(0, 0, 1.1)); bpy.context.object.data.materials.append(mat('water', '#3ab8ff', 0.05, 0, '#2a90ff', 2.0))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=4, location=(0, 0, 3)); bpy.context.object.data.materials.append(mat('jet', '#cfe8ff', 0.1, 0, '#a8d8ff', 3.0))
    point((0, 0, 2), 1500, (0.5, 0.75, 1.0), 2)
    rnd = random.Random(5)
    neon = ['#ff3ab0', '#3affe0', '#f2c811', '#ff5a3a', '#7a6aff']
    for i in range(10):                              # tall blocks round the square, neon signs on them
        ang = i / 10 * math.tau; r = 34
        if -math.pi * 0.62 < math.atan2(math.sin(ang), math.cos(ang)) < math.pi * 0.05: continue   # (not between the camera and the square)
        x, y = math.cos(ang) * r * 1.2, math.sin(ang) * r * 0.85
        w, d, h = rnd.uniform(12, 18), rnd.uniform(10, 14), rnd.uniform(14, 32)
        rot = math.atan2(y, x) + math.pi / 2
        box('block', (w, d, h), (x, y, h / 2), mat('block' + str(i % 3), ['#3a3c48', '#4a4450', '#2e3240'][i % 3], 0.8), rot_z=rot)
        for fl in range(int(h // 3.5)):
            if rnd.random() < 0.6: box('blockwin', (w * 0.85, d + 0.1, 0.9), (x, y, 2 + fl * 3.5), WIN(rnd.uniform(0.6, 1.8)), rot_z=rot)
        c = rnd.choice(neon)
        box('neon', (w * 0.6, d + 0.3, 1.4), (x, y, rnd.uniform(5, 9)), mat('neon' + c, c, 0.3, 0, c, 9.0), rot_z=rot)
        point((x * 0.85, y * 0.85, 6), 900, tuple(hexc(c)[:3]), 1.5)
    # the nightclub's open front: a lit dance floor in colour squares
    for k in range(25):
        c = neon[k % len(neon)]
        box('dance', (1.8, 1.8, 0.05), (18 + (k % 5) * 1.9, -12 + (k // 5) * 1.9, 0.25), mat('dance' + c, c, 0.3, 0, c, 4.0))
    road(0, -26, 80, 9)
    for i, c in enumerate(['#f2c811', '#f2c811', '#2a2a30', '#7a1e1e']): car(-18 + i * 10, -24, 0, c)
    for x in (-24, -8, 8, 24): lamp(x, 19); lamp(x, -20)
    night(); cam((0, -2, 3), 96)

def industrial():
    ST.reset(); ground('#24262c')
    box('water', (120, 40, 0.3), (0, -36, -0.6), mat('dockwater', '#0e1a2a', 0.05, 0.1))
    box('quay', (120, 3, 1.4), (0, -15, 0.2), mat('quayedge', '#5a5650', 0.85))
    box('yard', (120, 50, 0.2), (0, 10, 0.1), mat('concrete', '#4a4c52', 0.9))
    rnd = random.Random(9)
    cols = ['#c8402e', '#1f4fb4', '#2a7a3a', '#f2c811', '#8a8e96', '#d86a1a']
    for i in range(6):                               # container stacks
        for j in range(3):
            for k in range(rnd.randint(1, 3)):
                box('container', (12, 2.6, 2.6), (-40 + i * 14, 2 + j * 3.2, 1.3 + k * 2.65), mat('cont' + str((i + j + k) % 6), cols[(i + j + k) % 6], 0.6, 0.2))
    # a gantry crane over the quay
    steel = mat('crane', '#f2c811', 0.5, 0.4)
    for x in (12, 30):
        for y in (-13, 3): box('leg', (1.2, 1.2, 28), (x, y, 14), steel)
    box('beam', (22, 2, 2), (21, -5, 28), steel); box('boom', (2, 46, 2), (21, -18, 26), steel)
    box('cab', (4, 4, 3), (21, -12, 23.5), mat('cab', '#e8e4d8', 0.5))
    # a ship alongside, sheds, a lorry, sodium floodlights
    box('ship', (60, 14, 6), (-10, -26, 2), mat('hull', '#2a2c34', 0.6, 0.3)); box('shipdeck', (16, 12, 8), (14, -26, 9), mat('bridge', '#e8e4d8', 0.6))
    for k in range(6): box('shipwin', (1.6, 12.2, 0.8), (8 + k * 2.4, -26, 11), WIN(2.0))
    box('shed', (34, 18, 12), (-30, 26, 6), mat('shed', '#5a6070', 0.7, 0.3)); box('shedroof', (35, 19, 1), (-30, 26, 12.5), mat('shedroof', '#3a3e48', 0.7))
    box('lorry', (12, 2.6, 3.6), (20, 18, 1.8), mat('trailer', '#e8e4d8', 0.6)); box('lorrycab', (3, 2.6, 3.2), (27.5, 18, 1.6), mat('lorrycab', '#c8102e', 0.4, 0.3))
    for (x, y) in [(-50, 0), (-20, 16), (6, 22), (40, 12), (48, -8)]:
        box('pole', (0.6, 0.6, 18), (x, y, 9), mat('post', '#2a2c32', 0.5, 0.6))
        box('sodium', (2.2, 1.2, 0.6), (x, y, 18), mat('sodium', '#ffb060', 0.3, 0, '#ff9a30', 14.0)); point((x, y, 17), 6000, (1, 0.6, 0.25), 1.2)
    night(); cam((0, -2, 4), 104)

def laststand():
    # outside the big arena on the last night: the bowl lit up (black-and-yellow LED band), the plaza with your
    # club's crest painted on it, a fountain, police vans, flares
    ST.reset(); ground('#22242c')
    box('plaza', (140, 90, 0.2), (0, -20, 0.1), mat('granite', '#4a4c56', 0.35, 0.1))
    shell = mat('arenashell', '#9aa0aa', 0.4, 0.6)
    me = bpy.data.meshes.new('arena'); bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, radius=1.0, segments=48)
    bmesh.ops.scale(bm, vec=Vector((70, 52, 1)), verts=bm.verts)
    bm.to_mesh(me); bm.free()
    a = link(bpy.data.objects.new('arena', me)); a.location = (0, 40, 0)
    sol = a.modifiers.new('h', 'SOLIDIFY'); sol.thickness = 34; sol.offset = 1
    a.data.materials.append(shell)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 40, 34)); dome = bpy.context.object
    dome.scale = (68, 50, 9); dome.data.materials.append(mat('arenaroof', '#c8ccd4', 0.35, 0.5))
    for z, c in ((10, '#f2c811'), (22, '#f2c811')):   # LED bands round the bowl
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.025, major_segments=64, minor_segments=8, location=(0, 40, z))
        b = bpy.context.object; b.scale = (70.6, 52.6, 30)
        b.data.materials.append(mat('led' + c, c, 0.3, 0, c, 8.0))
    for k in range(5): box('gate', (6, 0.6, 7), (-24 + k * 12, -11.8, 3.5), WIN(3.0))
    # the crest on the plaza, the fountain, vans, flares, lamps
    bpy.ops.mesh.primitive_cylinder_add(radius=11, depth=0.1, location=(-22, -38, 0.25)); bpy.context.object.data.materials.append(mat('crestring', '#141416', 0.5))
    bpy.ops.mesh.primitive_cylinder_add(radius=8, depth=0.12, location=(-22, -38, 0.28)); bpy.context.object.data.materials.append(mat('crestin', '#f2c811', 0.5))
    bpy.ops.mesh.primitive_cylinder_add(radius=6, depth=1.2, location=(26, -40, 0.6)); bpy.context.object.data.materials.append(mat('stone', '#6a6a72', 0.7))
    bpy.ops.mesh.primitive_cylinder_add(radius=5.4, depth=0.3, location=(26, -40, 1.2)); bpy.context.object.data.materials.append(mat('water', '#3ab8ff', 0.05, 0, '#2a90ff', 2.0))
    for i, x in enumerate((-48, -40)):
        box('van', (6, 2.6, 2.8), (x, -24, 1.4), mat('van', '#e8e8ec', 0.4, 0.2), rot_z=0.3)
        box('vanstripe', (6.05, 2.65, 0.5), (x, -24, 1.2), mat('vanstripe', '#1f4fb4', 0.4, 0, '#2a5aff', 1.0), rot_z=0.3)
        box('siren', (1.2, 0.6, 0.3), (x, -24, 2.95), mat('siren', '#3a6aff', 0.3, 0, '#3a7aff', 20.0), rot_z=0.3)
    hot = mat('flare', '#ff5020', 0.3, 0, '#ff4010', 40.0)
    for (x, y) in [(-6, -30), (8, -46), (36, -22), (-34, -50)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.6, location=(x, y, 0.9)); bpy.context.object.data.materials.append(hot)
        point((x, y, 2), 3000, (1, 0.35, 0.15), 1.5)
    for (x, y) in [(-60, -10), (-30, -10), (30, -10), (60, -10), (-60, -60), (0, -64), (60, -60)]: lamp(x, y, 8, e=1500)
    for x in (-50, 50): point((x, 0, 30), 30000, (1, 0.9, 0.7), 6)
    for (x, y) in [(-30, -30), (20, -30), (0, -50)]: point((x, y, 14), 12000, (1, 0.85, 0.65), 4)
    night(); cam((0, 0, 8), 170)

def derby():
    # Raasunda: the home ground, rammed, flares going off in the home end
    S = dict(seat='#141416', kit=('#f2c811', '#141416'), facade='#8a8e96', roof='#c8ccd2', town='mixed', floods='pylons', flares=14,
             stands={'N': dict(tiers=[(16, 1, 13), (10, 15, 22)], roof=26, len=118),
                     'S': dict(tiers=[(20, 1, 14)], roof=18),
                     'E': dict(tiers=[(18, 1, 13)], roof=17),
                     'W': dict(tiers=[(18, 1, 13), (8, 15, 20)], roof=24)})
    ST.build('derby', S, render=False)

def awayend():
    # the rival's ground, the old Olympic stadium: brick all round, the athletics track, the two towers at the open end
    S = dict(seat='#1f3f8f', kit=('#003c8f', '#d0102a'), facade='#7a3a26', roof='#3a5a4a', town='mixed', track=True, runoff=15,
             stands={'N': dict(tiers=[(18, 1, 11)], roof=15, facade='#7a3a26'),
                     'S': dict(tiers=[(18, 1, 11)], noroof=True, facade='#7a3a26'),
                     'E': dict(tiers=[(16, 1, 10)], noroof=True, facade='#7a3a26')},
             towers=[(-(105 / 2 + 15 + 6), 24, 8, 30, '#7a3a26'), (-(105 / 2 + 15 + 6), -24, 8, 30, '#7a3a26')])
    ST.build('awayend', S, render=False)

SCENES = {'streets': streets, 'pub': pub, 'underground': underground, 'awayend': awayend, 'city': city,
          'industrial': industrial, 'derby': derby, 'laststand': laststand}

for sid, fn in SCENES.items():
    if ONLY and sid not in ONLY: continue
    fn()
    ST.render_to(sid)
