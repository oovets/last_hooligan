# Vehicles at a believable scale next to the (stylised, ~2.3-unit-tall) characters.
# Rendered by scripts/blender/render_env.py like any other piece module:
#   Blender -b --factory-startup --python scripts/blender/render_env.py -- scripts/blender/env_vehicles.py
#
# Footprints (tiles, along x for dir 'x'; dir 'y' turns them):
#   car / city_taxi / laststand_burntcar  5 x 2      laststand_policevan  5 x 2      bus  9 x 2
# Prop ids match the game's prop types (src/game/props.js, themes) so World.drawProp / drawVehicle pick them up.
import math, random

def _h(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))

def _dark(c, k): return tuple(x * k for x in c)


class Kit:
    """Local vehicle frame: a = along (0..L, front at a = L), b = across (0..W), z in METRES (converted to units)."""
    def __init__(self, ctx, var, L, W, off_b=0.0):
        self.ctx, self.U = ctx, ctx.UNIT
        self.alongX = var.get('dir', 'x') == 'x'
        self.rev = bool(var.get('rev'))          # front at a = 0 instead of a = L (traffic driving the other way)
        self.L, self.W, self.ob = L, W, off_b

    def box(self, a, b, z, la, lb, h, m, bev=0.0):
        c, U = self.ctx, self.U
        b += self.ob
        if self.rev: a = self.L - a - la
        if self.alongX: return c.box(a, b, z / U, la, lb, h / U, m, bevel=bev)
        return c.box(b, a, z / U, lb, la, h / U, m, bevel=bev)

    def wheel(self, a, b, r, w, tyre, rim, hub=None):
        """wheel centred at (a, b) touching the ground; axle across the vehicle"""
        import mathutils
        c, U = self.ctx, self.U
        b += self.ob
        if self.rev: a = self.L - a
        parts = [(r, w, tyre, 22), (r * 0.62, w + 0.02, rim, 14)]
        if hub: parts.append((r * 0.22, w + 0.04, hub, 10))
        for rr, ww, m, seg in parts:
            o = c.cyl(0, 0, 0, rr, ww / U, m, seg)
            # cylinder is vertical (Blender Z); turn its axis to point across the vehicle
            # game y = Blender X for dir 'x' (across), game x = Blender Y for dir 'y' (across)
            if self.alongX:
                o.rotation_euler = (0, math.radians(90), 0)
                o.location = c.G(a, b, r / U) + mathutils.Vector((-ww / 2, 0, 0))
            else:
                o.rotation_euler = (math.radians(90), 0, 0)
                o.location = c.G(b, a, r / U) + mathutils.Vector((0, ww / 2, 0))


def mats(ctx, color, burnt=False):
    c = _h(color)
    M = {}
    if burnt:
        M['paint'] = ctx.noise_mat('burntPaint', _h('#1c1a18'), _h('#5a3420'), scale=6, rough=0.95, bump=0.8)
        M['paintD'] = ctx.mat('burntD', _h('#141210'), 0.95)
        M['glass'] = ctx.mat('burntGlass', _h('#060606'), 0.9)
        M['tyre'] = ctx.mat('burntTyre', _h('#0a0a0a'), 0.95)
        M['rim'] = ctx.mat('burntRim', _h('#4a3a30'), 0.7, 0.6)
        M['head'] = M['tail'] = ctx.mat('burntLamp', _h('#101010'), 0.9)
        M['chrome'] = ctx.mat('burntChrome', _h('#3a3430'), 0.6, 0.7)
    else:
        M['paint'] = ctx.mat('vpaint' + color, c, 0.22, 0.45)
        M['paintD'] = ctx.mat('vpaintD' + color, _dark(c, 0.7), 0.3, 0.4)
        M['glass'] = ctx.mat('vglass', _h('#1e2a36'), 0.04, 0.65)
        M['tyre'] = ctx.mat('vtyre', _h('#0e0e10'), 0.85)
        M['rim'] = ctx.mat('vrim', _h('#a0a6ae'), 0.25, 0.9)
        M['head'] = ctx.mat('vhead', _h('#fff8d8'), 0.15, 0, emit=_h('#fff0c0'), emit_strength=4)
        M['tail'] = ctx.mat('vtail', _h('#c01414'), 0.3, 0, emit=_h('#ff2020'), emit_strength=2.5)
        M['chrome'] = ctx.mat('vchrome', _h('#c8c8d0'), 0.15, 1.0)
    M['black'] = ctx.mat('vblack', _h('#141418'), 0.6, 0.1)
    M['plate'] = ctx.mat('vplate', _h('#e8e0b0'), 0.6)
    M['hub'] = ctx.mat('vhub', _h('#3a3a40'), 0.4, 0.8)
    return M


def saloon(ctx, var, style='saloon'):
    """5 x 2 footprint, ~1.62 m tall (x1.02 = units). Styles: saloon | taxi | burnt."""
    burnt = style == 'burnt'
    color = var.get('color', '#e8b818' if style == 'taxi' else '#8a2020')
    M = mats(ctx, color, burnt)
    K = Kit(ctx, var, 5.0, 2.0, off_b=0.05)
    L, Wd = 5.0, 1.9
    sink = 0.14 if burnt else 0.0          # burnt-out car sits on its rims
    # wheels
    for a in (1.05, 3.95):
        for b in (0.12, Wd - 0.12):
            if burnt: K.wheel(a, b, 0.3, 0.2, M['rim'], M['rim'])
            else: K.wheel(a, b, 0.42, 0.26, M['tyre'], M['rim'], M['hub'])
    z0 = 0.26 - sink
    # lower body: sills + flanks
    K.box(0.12, 0.06, z0, L - 0.24, Wd - 0.12, 0.52, M['paint'], 0.07)
    # bonnet (front) and boot (rear) tops
    K.box(3.45, 0.08, z0 + 0.5, 1.45, Wd - 0.16, 0.2, M['paint'], 0.06)
    K.box(0.14, 0.08, z0 + 0.5, 1.15, Wd - 0.16, 0.24, M['paint'], 0.06)
    # cabin glasshouse + roof
    K.box(1.25, 0.16, z0 + 0.62, 2.25, Wd - 0.32, 0.6, M['glass'], 0.07)
    K.box(1.5, 0.2, z0 + 1.2, 1.75, Wd - 0.4, 0.12, M['paint'], 0.05)
    for a in (1.27, 2.35, 3.4):          # pillars
        for b in (0.15, Wd - 0.25):
            K.box(a, b, z0 + 0.62, 0.1, 0.1, 0.6, M['paintD'])
    # bumpers, sills, rubbing strips, door shuts, handles, mirrors
    K.box(L - 0.12, 0.04, z0 - 0.02, 0.16, Wd - 0.08, 0.2, M['black'], 0.03)
    K.box(-0.04, 0.04, z0 - 0.02, 0.16, Wd - 0.08, 0.2, M['black'], 0.03)
    for b in (0.04, Wd - 0.08):
        K.box(0.4, b, z0 + 0.26, L - 0.8, 0.04, 0.06, M['black'])
        for a in (2.05, 3.05): K.box(a, b - 0.005, z0 + 0.05, 0.02, 0.05, 0.45, M['paintD'])
        for a in (2.5, 3.5): K.box(a, b - 0.01, z0 + 0.42, 0.18, 0.06, 0.04, M['chrome'])
        K.box(3.3, b - 0.06 if b < 1 else b + 0.02, z0 + 0.72, 0.16, 0.12, 0.12, M['paintD'])
    # front: grille, headlights, plate; rear: tail lights, plate
    K.box(L - 0.02, 0.62, z0 + 0.26, 0.04, Wd - 1.24, 0.18, M['black'])
    for b in (0.18, Wd - 0.58):
        K.box(L - 0.03, b, z0 + 0.26, 0.05, 0.4, 0.16, M['head'])
        K.box(-0.02, b, z0 + 0.3, 0.05, 0.4, 0.14, M['tail'])
    K.box(L, Wd / 2 - 0.26, z0 + 0.04, 0.03, 0.52, 0.12, M['plate'])
    K.box(-0.03, Wd / 2 - 0.26, z0 + 0.1, 0.03, 0.52, 0.12, M['plate'])
    # wheel-arch lips
    for a in (1.05, 3.95):
        for b in (0.03, Wd - 0.07):
            K.box(a - 0.52, b, z0 + 0.4, 1.04, 0.05, 0.08, M['black'])
    if style == 'taxi':
        sign = ctx.mat('taxiSign', _h('#fff0a0'), 0.4, 0, emit=_h('#ffe27a'), emit_strength=2.5)
        K.box(2.15, Wd / 2 - 0.35, z0 + 1.32, 0.42, 0.7, 0.2, sign, 0.03)
        chk = [ctx.mat('chkB', _h('#141414'), 0.5), ctx.mat('chkW', _h('#f0f0e8'), 0.5)]
        for i in range(14):
            for b in (0.035, Wd - 0.075):
                K.box(0.5 + i * 0.29, b, z0 + 0.34, 0.29, 0.045, 0.1, chk[i % 2])
    if burnt:
        soot = ctx.mat('soot', _h('#0c0b0a'), 1.0)
        K.box(1.3, 0.2, z0 + 0.66, 2.1, Wd - 0.4, 0.04, soot)     # caved roof lining
        rnd = random.Random(7)
        rust = ctx.mat('rustSpot', _h('#7a3a18'), 0.95)
        for _ in range(10):
            a = 0.3 + rnd.random() * 4.2
            K.box(a, 0.03 if rnd.random() < 0.5 else Wd - 0.06, z0 + 0.05 + rnd.random() * 0.4, 0.18 + rnd.random() * 0.25, 0.04, 0.08 + rnd.random() * 0.12, rust)


def policevan(ctx, var):
    """5 x 2 panel van in a (fictional) Nordhamn police livery, ~2.25 m tall with a roof light bar."""
    import bpy
    M = mats(ctx, '#e8eaee')
    K = Kit(ctx, var, 5.0, 2.0, off_b=0.03)
    L, Wd = 5.0, 1.94
    for a in (1.0, 4.05):
        for b in (0.12, Wd - 0.12):
            K.wheel(a, b, 0.44, 0.28, M['tyre'], M['rim'], M['hub'])
    z0 = 0.3
    K.box(0.1, 0.04, z0, 3.7, Wd - 0.08, 1.9, M['paint'], 0.06)                 # load box
    K.box(3.8, 0.04, z0, 1.1, Wd - 0.08, 0.95, M['paint'], 0.06)                # bonnet / cab front
    K.box(3.8, 0.06, z0 + 0.95, 0.75, Wd - 0.12, 0.85, M['glass'], 0.05)        # windscreen + cab glass
    K.box(3.8, 0.1, z0 + 1.78, 0.75, Wd - 0.2, 0.1, M['paint'], 0.04)
    blue = ctx.mat('polBlue', _h('#1a3a9a'), 0.35)
    yel = ctx.mat('polYel', _h('#d8e020'), 0.4, 0, emit=_h('#d8e020'), emit_strength=0.25)
    for b in (0.02, Wd - 0.06):                                                  # livery: blue + yellow chequer band
        K.box(0.1, b, z0 + 0.62, 4.75, 0.05, 0.22, blue)
        for i in range(16):
            if i % 2 == 0: K.box(0.15 + i * 0.29, b - 0.005, z0 + 0.86, 0.29, 0.055, 0.2, yel)
        K.box(0.4, b, z0 + 1.15, 3.2, 0.04, 0.5, M['glass'])                    # rear side windows (grilled)
        for i in range(8): K.box(0.45 + i * 0.4, b - 0.01, z0 + 1.15, 0.04, 0.06, 0.5, M['chrome'])
    lb = ctx.mat('lightbar', _h('#2040ff'), 0.2, 0, emit=_h('#3050ff'), emit_strength=6)
    K.box(3.0, Wd / 2 - 0.55, z0 + 1.9, 0.3, 1.1, 0.14, lb, 0.03)
    K.box(L - 0.03, 0.2, z0 + 0.5, 0.05, 0.4, 0.18, M['head']); K.box(L - 0.03, Wd - 0.6, z0 + 0.5, 0.05, 0.4, 0.18, M['head'])
    K.box(0.05, 0.12, z0 + 0.4, 0.05, 0.25, 0.4, M['tail']); K.box(0.05, Wd - 0.37, z0 + 0.4, 0.05, 0.25, 0.4, M['tail'])
    K.box(L - 0.1, 0.02, z0 - 0.04, 0.16, Wd - 0.04, 0.22, M['black'], 0.03)
    K.box(-0.04, 0.02, z0 - 0.04, 0.16, Wd - 0.04, 0.22, M['black'], 0.03)
    K.box(0.06, Wd / 2 - 0.02, z0 + 0.2, 0.04, 0.04, 1.6, M['black'])            # rear door split
    # side text panel "POLICE" in blue (font object, extruded)
    try:
        cu = bpy.data.curves.new('polTxt', 'FONT'); cu.body = 'POLICE'; cu.size = 0.42; cu.extrude = 0.01
        cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
        ob = bpy.data.objects.new('polTxt', cu); ctx.link(ob)
        if K.rev: pass
        ob.data.materials.append(blue)
        # put it on the visible long side
        if K.alongX:   # long side faces +y (screen left) -> text plane is the +y face (Blender +X)
            ob.location = ctx.G(2.0, 2.0 + 0.012, (z0 + 1.42) / ctx.UNIT)
            ob.rotation_euler = (math.radians(90), 0, math.radians(90))
        else:          # long side faces +x (screen right) -> Blender +Y face
            ob.location = ctx.G(2.0 + 0.012, 2.0, (z0 + 1.42) / ctx.UNIT)
            ob.rotation_euler = (math.radians(90), 0, math.radians(180))
    except Exception:
        pass


def bus(ctx, var):
    """9 x 2 single-deck city bus (route N7), ~2.9 m tall, interior lights on."""
    import bpy
    color = var.get('color', '#2a6a4a')
    M = mats(ctx, color)
    K = Kit(ctx, var, 9.0, 2.0, off_b=-0.06)
    L, Wd = 9.0, 2.12
    for a in (1.7, 7.0):
        for b in (0.14, Wd - 0.14):
            K.wheel(a, b, 0.5, 0.3, M['tyre'], M['rim'], M['hub'])
    z0 = 0.32
    cream = ctx.mat('busCream', _h('#e8e0c8'), 0.5)
    lit = ctx.mat('busInterior', _h('#3a3020'), 0.3, 0, emit=_h('#ffe0a0'), emit_strength=1.2)
    K.box(0.05, 0.02, z0, L - 0.1, Wd - 0.04, 0.85, M['paint'], 0.08)            # skirt
    K.box(0.05, 0.02, z0 + 0.85, L - 0.1, Wd - 0.04, 0.95, lit, 0.04)            # window band (lit interior)
    K.box(0.05, 0.02, z0 + 1.8, L - 0.1, Wd - 0.04, 0.6, M['paint'], 0.08)       # upper body
    K.box(0.4, 0.2, z0 + 2.4, 2.0, Wd - 0.4, 0.22, M['paintD'], 0.05)            # roof AC pod
    for b in (0.0, Wd - 0.04):
        K.box(0.1, b, z0 + 0.72, L - 0.2, 0.05, 0.12, cream)                     # cream belt line
        for i in range(10): K.box(0.5 + i * 0.82, b - 0.005, z0 + 0.86, 0.08, 0.06, 0.94, M['paintD'])   # window posts
    # doors on the kerb side (+y for dir x) : front + middle
    door = ctx.mat('busDoor', _h('#203040'), 0.1, 0.4)
    side_b = Wd - 0.03
    K.box(L - 1.6, side_b, z0 + 0.05, 1.0, 0.05, 2.05, door)
    K.box(4.2, side_b, z0 + 0.05, 1.1, 0.05, 2.05, door)
    # front: big windscreen + destination board, lights
    K.box(L - 0.06, 0.15, z0 + 0.8, 0.06, Wd - 0.3, 1.2, M['glass'])
    dest = ctx.mat('busDest', _h('#201000'), 0.4, 0, emit=_h('#ffa020'), emit_strength=3)
    K.box(L - 0.05, 0.3, z0 + 2.05, 0.06, Wd - 0.6, 0.28, dest)
    K.box(L - 0.04, 0.15, z0 + 0.35, 0.05, 0.36, 0.2, M['head']); K.box(L - 0.04, Wd - 0.51, z0 + 0.35, 0.05, 0.36, 0.2, M['head'])
    K.box(-0.02, 0.15, z0 + 0.35, 0.05, 0.3, 0.3, M['tail']); K.box(-0.02, Wd - 0.45, z0 + 0.35, 0.05, 0.3, 0.3, M['tail'])
    K.box(L - 0.1, 0.0, z0 - 0.05, 0.14, Wd, 0.25, M['black'], 0.03)
    K.box(-0.04, 0.0, z0 - 0.05, 0.14, Wd, 0.25, M['black'], 0.03)


CAR_COLOURS = ['#8a2020', '#203a8a', '#d8d8d0', '#2a6a3a', '#d8b020', '#1a1a1e', '#5a2a6a', '#3a3a44']
DIRS = ('x', 'y')

def both_ways(vs):
    return [dict(v, rev=r) for v in vs for r in (0, 1)]

PIECES = [
    dict(kind='prop', id='car', size=(5, 2, 2.0), rotates=True, pad=14,
         build=lambda ctx, v: saloon(ctx, v), variants=both_ways([{'color': c, 'dir': d} for d in DIRS for c in CAR_COLOURS])),
    dict(kind='prop', id='city_taxi', size=(5, 2, 2.0), rotates=True, pad=14,
         build=lambda ctx, v: saloon(ctx, v, 'taxi'), variants=both_ways([{'dir': d, 'color': '#e8b818'} for d in DIRS])),
    dict(kind='prop', id='laststand_burntcar', size=(5, 2, 1.8), rotates=True, pad=14,
         build=lambda ctx, v: saloon(ctx, v, 'burnt'), variants=[{'dir': d} for d in DIRS]),
    dict(kind='prop', id='laststand_policevan', size=(5, 2, 2.6), rotates=True, pad=14,
         build=policevan, variants=[{'dir': d} for d in DIRS]),
    dict(kind='prop', id='bus', size=(9, 2, 3.1), rotates=True, pad=16,
         build=bus, variants=both_ways([{'dir': d, 'color': '#2a6a4a'} for d in DIRS])),
]
