# Common environment pieces (Level 1 street set + shared props) for scripts/blender/render_env.py.
# Coordinates are GAME coords: x,y in tiles (1 tile = 1 m), z in height units (ctx.UNIT metres).
# Visible faces of a wall block are the +x face (screen right) and the +y face (screen left).
import random, math

def _h(c):  # hex -> rgb floats
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))

# ------------------------------------------------------------------ walls
def wall_brick(c1, c2, mortar, cap='#6a6064'):
    def build(ctx, h, v):
        m = ctx.brick_mat('brick_' + c1 + str(v), _h(c1), _h(c2), _h(mortar), seed_off=v * 0.37)
        ctx.box(0, 0, 0, 1, 1, h - 0.08, m)
        ctx.box(0, 0, h - 0.08, 1, 1, 0.08, ctx.noise_mat('cap' + cap, _h(cap), tuple(x * 0.8 for x in _h(cap)), scale=30))
        rnd = random.Random(v * 13 + int(h * 7))
        # grime streaks & a drainpipe on some variants
        if v % 4 == 3 and h >= 2:
            pipe = ctx.mat('pipe', _h('#2a2a2e'), 0.5, 0.3)
            ctx.cyl(0.85, 1.03, 0, 0.035, h - 0.1, pipe, 10)
        if v % 4 == 1 and h >= 2:
            ctx.box(0.3, 0.995, 0.6, 0.35, 0.01, 0.5, ctx.mat('poster%d' % v, _h(rnd.choice(['#c8102e', '#e8d27a', '#3a8ad8'])), 0.9))
    return build

def window(ctx, face, a, z0, w, hgt, lit, frame_c='#d8d0c0', glass_lit='#ffd27a', glass_dark='#1a2436', curtain=None):
    """window on a visible face: face 'x' (+x face, along y from a) or 'y' (+y face, along x from a)"""
    fr = ctx.mat('frame' + frame_c, _h(frame_c), 0.6)
    gl = ctx.mat('glassL' + glass_lit, _h('#3a2a10'), 0.2, 0, emit=_h(glass_lit), emit_strength=2.2) if lit else ctx.mat('glassD', _h(glass_dark), 0.08, 0.2)
    t = 0.05
    if face == 'y':
        ctx.box(a - t, 0.985, z0 - t / ctx.UNIT, w + 2 * t, 0.03, hgt + 2 * t / ctx.UNIT, fr)
        ctx.box(a, 0.995, z0, w, 0.03, hgt, gl)
        ctx.box(a + w / 2 - 0.02, 1.01, z0, 0.04, 0.02, hgt, fr)
        ctx.box(a - t, 0.98, z0 - 0.08, w + 2 * t, 0.07, 0.05, fr)  # sill
        if curtain and lit: ctx.box(a, 1.0, z0 + hgt * 0.55, w * 0.3, 0.02, hgt * 0.45, ctx.mat('curt' + curtain, _h(curtain), 0.9))
    else:
        ctx.box(0.985, a - t, z0 - t / ctx.UNIT, 0.03, w + 2 * t, hgt + 2 * t / ctx.UNIT, fr)
        ctx.box(0.995, a, z0, 0.03, w, hgt, gl)
        ctx.box(1.01, a + w / 2 - 0.02, z0, 0.02, 0.04, hgt, fr)
        ctx.box(0.98, a - t, z0 - 0.08, 0.07, w + 2 * t, 0.05, fr)
        if curtain and lit: ctx.box(1.0, a, z0 + hgt * 0.55, 0.02, w * 0.3, hgt * 0.45, ctx.mat('curt' + curtain, _h(curtain), 0.9))

def house(ctx, h, v):
    m = ctx.brick_mat('housebrick%d' % (v % 3), _h(['#8a4a38', '#7a4232', '#94543e'][v % 3]), _h('#6a3428'), _h('#3a2a26'), seed_off=v * 0.21)
    ctx.box(0, 0, 0, 1, 1, h - 0.25, m)
    roof = ctx.noise_mat('slate', _h('#3a3440'), _h('#2a2630'), scale=40, bump=0.5)
    ctx.box(0, 0, h - 0.25, 1, 1, 0.25, roof)
    ctx.box(0, 0, h - 0.32, 1, 1, 0.07, ctx.mat('gutter', _h('#1a1a1e'), 0.4, 0.5))
    rnd = random.Random(v * 7 + 3)
    storey = 2.2
    s = 0
    while (s + 1) * storey <= h - 0.3:
        z0 = s * storey + 0.75
        for face in ('x', 'y'):
            window(ctx, face, 0.22, z0, 0.56, 1.05, rnd.random() < 0.5, curtain=rnd.choice([None, '#c8a060', '#a03030', '#4a6a9a']))
        s += 1

def shop(ctx, h, v):
    pals = [('#b02828', '#ffe0a0'), ('#1f4fb4', '#c8e8ff'), ('#2a7a3a', '#e0ffd0'), ('#d8a020', '#fff0c0'), ('#6a2a8a', '#ffd0ff'), ('#1a1a1a', '#ff9a50')]
    awn, glow = pals[v % len(pals)]
    m = ctx.brick_mat('shopbrick', _h('#6a4038'), _h('#5a3430'), _h('#2e2022'))
    ctx.box(0, 0, 1.75, 1, 1, h - 2.0, m)
    roof = ctx.noise_mat('slate', _h('#3a3440'), _h('#2a2630'), scale=40, bump=0.5)
    ctx.box(0, 0, h - 0.25, 1, 1, 0.25, roof)
    # ground floor: dark pilasters + big lit window on both visible faces
    pil = ctx.mat('pilaster', _h('#2a2228'), 0.5)
    ctx.box(0, 0, 0, 1, 1, 0.25, pil)
    ctx.box(0, 0, 0, 0.94, 0.94, 1.75, ctx.mat('shopInside', _h('#4a3a30'), 0.9, 0, emit=_h(glow), emit_strength=0.8))
    gl = ctx.mat('shopGlass' + glow, _h('#202830'), 0.05, 0.1, emit=_h(glow), emit_strength=1.6)
    ctx.box(0.06, 0.985, 0.28, 0.88, 0.02, 1.35, gl)
    ctx.box(0.985, 0.06, 0.28, 0.02, 0.88, 1.35, gl)
    for a in (0.0, 0.94):
        ctx.box(a, 0.94, 0.0, 0.06, 0.06, 1.75, pil); ctx.box(0.94, a, 0.0, 0.06, 0.06, 1.75, pil)
    # fascia board + striped awning sticking out over the pavement
    fas = ctx.mat('fascia' + awn, _h(awn), 0.6)
    ctx.box(0, 0.97, 1.62, 1, 0.05, 0.35, fas); ctx.box(0.97, 0, 1.62, 0.05, 1, 0.35, fas)
    stripeA, stripeB = ctx.mat('awnA' + awn, _h(awn), 0.8), ctx.mat('awnB', _h('#e8e4dc'), 0.8)
    for i in range(5):
        mt = stripeA if i % 2 == 0 else stripeB
        ctx.box(i * 0.2, 1.0, 1.5, 0.2, 0.22, 0.08, mt)
        ctx.box(1.0, i * 0.2, 1.5, 0.22, 0.2, 0.08, mt)
    # upper window
    window(ctx, 'y', 0.25, 2.5, 0.5, 1.0, v % 2 == 0)
    window(ctx, 'x', 0.25, 2.5, 0.5, 1.0, v % 3 == 0)

def low_wall(c1, c2, mortar):
    def build(ctx, h, v):
        m = ctx.brick_mat('lw' + c1, _h(c1), _h(c2), _h(mortar), seed_off=v * 0.3)
        ctx.box(0, 0, 0, 1, 1, h - 0.12, m)
        ctx.box(0, 0, h - 0.12, 1, 1, 0.12, ctx.noise_mat('coping', _h('#8a8486'), _h('#6a6466'), scale=25))
    return build

# ------------------------------------------------------------------ floors
def floor_asphalt(ctx, n):
    ctx.plane(0, 0, n, n, ctx.noise_mat('asphalt', _h('#26262c'), _h('#3e3e46'), scale=60, rough=0.75, bump=0.6, detail=10, period=n))

def floor_road(line=None):
    def build(ctx, n):
        ctx.plane(0, 0, n, n, ctx.noise_mat('road', _h('#222228'), _h('#36363e'), scale=55, rough=0.6, bump=0.5, detail=10, period=n))
        paint = ctx.mat('paint', _h('#d8d0a0'), 0.7)
        if line == 'x':
            for i in range(0, n, 2): ctx.box(i, 0.47 + 0.0, 0, 0.75, 0.06, 0.004, paint)
        if line == 'y':
            for i in range(0, n, 2): ctx.box(0.47, i, 0, 0.06, 0.75, 0.004, paint)
        if line in ('x', 'y'):
            pass
    return build

def floor_pavement(ctx, n):
    slab = [ctx.noise_mat('slab%d' % k, _h(c), _h('#5e5c66'), scale=14, bump=0.15) for k, c in enumerate(['#7d7a84', '#77747e', '#716e78'])]
    rnd = random.Random(5)
    for i in range(n * 2):
        for j in range(n * 2):
            ctx.box(i * 0.5 + 0.012, j * 0.5 + 0.012, 0, 0.476, 0.476, 0.02, rnd.choice(slab))
    ctx.plane(0, 0, n, n, ctx.mat('grout', _h('#4a4852'), 0.95), gz=-0.001)

def floor_cobble(ctx, n):
    stones = [ctx.mat('cob%d' % k, _h(c), 0.8) for k, c in enumerate(['#625a62', '#6c646c', '#58505a', '#706870'])]
    rnd = random.Random(9)
    for i in range(n * 4):
        for j in range(n * 4):
            off = 0.125 if i % 2 else 0
            ctx.box(i * 0.25 + 0.02, (j * 0.25 + off) % n + 0.02, 0, 0.21, 0.21, 0.035, rnd.choice(stones), bevel=0.02)
    ctx.plane(0, 0, n, n, ctx.mat('cobgrout', _h('#2e2a32'), 0.95), gz=-0.001)

def floor_grass(ctx, n):
    ctx.plane(0, 0, n, n, ctx.noise_mat('grass', _h('#2a4620'), _h('#4e7236'), scale=70, bump=0.8, detail=12, period=n))

def floor_concrete(ctx, n):
    ctx.plane(0, 0, n, n, ctx.noise_mat('concrete', _h('#56565c'), _h('#6a6a70'), scale=22, bump=0.25, period=n))
    joint = ctx.mat('joint', _h('#404046'), 0.9)
    for i in range(n + 1):
        ctx.box(i - 0.01, 0, 0, 0.02, n, 0.003, joint); ctx.box(0, i - 0.01, 0, n, 0.02, 0.003, joint)

def floor_parking(ctx, n):
    ctx.plane(0, 0, n, n, ctx.noise_mat('tarmacP', _h('#38383e'), _h('#4a4a52'), scale=45, bump=0.4, detail=8, period=n))
    paint = ctx.mat('paintW', _h('#d8d4c0'), 0.7)
    for i in range(n): ctx.box(i, 0.15, 0, 0.05, 0.85, 0.004, paint)

def floor_kerb_x(ctx, n):
    floor_pavement(ctx, n)
    kerb = ctx.noise_mat('kerb', _h('#9a98a2'), _h('#7a7882'), scale=20)
    for i in range(n): ctx.box(i, 0.82, 0, 1, 0.18, 0.06, kerb, bevel=0.01)

def floor_zebra(ctx, n):
    floor_road()(ctx, n)
    w = ctx.mat('zebraW', _h('#d8d8d0'), 0.7)
    for i in range(n):
        for k in range(2): ctx.box(i + k * 0.5 + 0.05, 0, 0, 0.25, n, 0.004, w)

# ------------------------------------------------------------------ props
def p_lamp(ctx, var):
    post = ctx.mat('lampPost', _h('#3c4048'), 0.45, 0.6)
    ctx.cyl(0.5, 0.5, 0, 0.09, 0.25, post, 12)
    ctx.cyl(0.5, 0.5, 0, 0.045, 3.3, post, 10)
    ctx.box(0.5, 0.45, 3.25, 0.55, 0.1, 0.06, post)
    ctx.box(0.85, 0.38, 3.12, 0.3, 0.24, 0.13, post)
    ctx.box(0.88, 0.41, 3.1, 0.24, 0.18, 0.04, ctx.mat('lampGlow', _h('#fff2c0'), 0.2, 0, emit=_h('#ffe0a0'), emit_strength=8))

def p_bench(ctx, var):
    wood = ctx.mat('benchWood', _h('#7a5a30'), 0.7); iron = ctx.mat('iron', _h('#26262c'), 0.4, 0.6)
    if var.get('dir', 'x') == 'x':
        for x in (0.1, 0.82): ctx.box(x, 0.32, 0, 0.08, 0.36, 0.42, iron)
        for k in range(3): ctx.box(0.02, 0.3 + k * 0.13, 0.4, 0.96, 0.11, 0.05, wood)
        for k in range(2): ctx.box(0.02, 0.28, 0.55 + k * 0.17, 0.96, 0.05, 0.12, wood)
    else:
        for y in (0.1, 0.82): ctx.box(0.32, y, 0, 0.36, 0.08, 0.42, iron)
        for k in range(3): ctx.box(0.3 + k * 0.13, 0.02, 0.4, 0.11, 0.96, 0.05, wood)
        for k in range(2): ctx.box(0.28, 0.02, 0.55 + k * 0.17, 0.05, 0.96, 0.12, wood)

def p_wheeliebin(ctx, var):
    c = _h(var.get('color', '#22262c'))
    body = ctx.mat('wb' + str(c), c, 0.55)
    ctx.box(0.18, 0.15, 0.05, 0.64, 0.7, 1.08, body, bevel=0.03)
    ctx.box(0.14, 0.1, 1.13, 0.72, 0.8, 0.07, ctx.mat('wbl' + str(c), tuple(min(1, x * 1.3) for x in c), 0.5), bevel=0.015)
    wheel = ctx.mat('tyre', _h('#0c0c0e'), 0.8)
    for y in (0.2, 0.72): ctx.cyl(0.12, y, 0, 0.07, 0.12, wheel, 10)

def p_bin(ctx, var):
    m = ctx.mat('litterbin', _h(var.get('color', '#2a5a30')), 0.5, 0.2)
    ctx.cyl(0.5, 0.5, 0, 0.28, 0.95, m, 18)
    ctx.cyl(0.5, 0.5, 0.95, 0.31, 0.1, ctx.mat('binlid', _h('#3a3a40'), 0.4, 0.5), 18)

def p_crate(ctx, var):
    wood = ctx.mat('crateWood', _h(var.get('color', '#8a6038')), 0.85)
    dark = ctx.mat('crateDark', _h('#5e3e20'), 0.9)
    ctx.box(0.06, 0.06, 0, 0.88, 0.88, 0.88, wood, bevel=0.01)
    for (x, y, w, d) in ((0.04, 0.04, 0.92, 0.06), (0.04, 0.9, 0.92, 0.06), (0.04, 0.04, 0.06, 0.92), (0.9, 0.04, 0.06, 0.92)):
        ctx.box(x, y, 0, w, d, 0.9, dark)

def p_barrel(ctx, var):
    m = ctx.mat('barrel', _h('#6a4424'), 0.7)
    hoop = ctx.mat('hoop', _h('#3a3a40'), 0.4, 0.7)
    ctx.cyl(0.5, 0.5, 0, 0.3, 1.0, m, 18)
    for z in (0.15, 0.8): ctx.cyl(0.5, 0.5, z, 0.31, 0.08, hoop, 18)
    if var.get('fire'):
        ctx.cyl(0.5, 0.5, 0.98, 0.25, 0.04, ctx.mat('embers', _h('#401000'), 0.9, 0, emit=_h('#ff6a10'), emit_strength=6), 16)

def p_car(ctx, var):
    c = _h(var.get('color', '#8a2020'))
    paint = ctx.mat('carpaint' + str(c), c, 0.25, 0.4)
    glass = ctx.mat('carglass', _h('#3a5068'), 0.05, 0.3)
    tyre = ctx.mat('tyre', _h('#0c0c0e'), 0.8)
    chrome = ctx.mat('chrome', _h('#c8c8d0'), 0.15, 1.0)
    alongX = var.get('dir', 'x') == 'x'
    def B(x, y, z, w, d, h, m, bev=0.0):
        if alongX: ctx.box(x, y, z, w, d, h, m, bevel=bev)
        else: ctx.box(y, x, z, d, w, h, m, bevel=bev)
    def C(x, y, z, r, h, m):
        if alongX: ctx.cyl(x, y, z, r, h, m, 12)
        else: ctx.cyl(y, x, z, r, h, m, 12)
    for wx in (0.38, 1.6):
        for wy in (0.12, 0.88): C(wx, wy, 0, 0.17, 0.33, tyre)
    B(0.05, 0.1, 0.18, 1.9, 0.8, 0.45, paint, 0.05)
    B(0.5, 0.14, 0.6, 1.0, 0.72, 0.42, glass, 0.05)
    B(0.56, 0.16, 0.98, 0.88, 0.68, 0.06, paint, 0.02)
    B(1.94, 0.15, 0.3, 0.04, 0.7, 0.08, chrome)
    for wy in (0.18, 0.72): B(1.95, wy, 0.42, 0.03, 0.1, 0.08, ctx.mat('headl', _h('#fff8d0'), 0.2, 0, emit=_h('#fff0c0'), emit_strength=3))
    for wy in (0.18, 0.72): B(0.03, wy, 0.42, 0.03, 0.1, 0.08, ctx.mat('taill', _h('#ff2020'), 0.3, 0, emit=_h('#ff2020'), emit_strength=2))

def p_phonebox(ctx, var):
    red = ctx.mat('phonered', _h('#b01818'), 0.45)
    gl = ctx.mat('phoneglass', _h('#c8e0e8'), 0.1, 0, emit=_h('#fff4d0'), emit_strength=0.6)
    ctx.box(0.15, 0.15, 0, 0.7, 0.7, 2.75, red, bevel=0.02)
    ctx.box(0.1, 0.1, 2.75, 0.8, 0.8, 0.2, red, bevel=0.04)
    for r in range(4):
        z = 0.75 + r * 0.45
        ctx.box(0.22, 0.84, z, 0.56, 0.03, 0.36, gl); ctx.box(0.84, 0.22, z, 0.03, 0.56, 0.36, gl)
    ctx.box(0.25, 0.85, 2.5, 0.5, 0.02, 0.15, ctx.mat('telsign', _h('#ffffff'), 0.4, 0, emit=_h('#ffffff'), emit_strength=1.5))

def p_postbox(ctx, var):
    red = ctx.mat('postred', _h('#c01818'), 0.4)
    ctx.cyl(0.5, 0.5, 0, 0.17, 1.3, red, 16)
    ctx.sphere(0.5, 0.5, 1.3, 0.18, red, 1, 1, 0.5)
    ctx.box(0.6, 0.45, 1.0, 0.08, 0.1, 0.03, ctx.mat('slot', _h('#200808'), 0.9))

def p_tree(ctx, var):
    bark = ctx.noise_mat('bark', _h('#3a2818'), _h('#5a4028'), scale=30, bump=0.6)
    ctx.cyl(0.5, 0.5, 0, 0.09, 1.8, bark, 10, r2=0.06)
    rnd = random.Random(3)
    leaves = [ctx.noise_mat('leaf%d' % k, _h(c), _h('#1e3a18'), scale=25, bump=1.0) for k, c in enumerate(['#2e5a2a', '#3a6a30', '#4a7a36'])]
    for i in range(9):
        a = rnd.random() * 6.28; r = rnd.random() * 0.3
        ctx.sphere(0.5 + math.cos(a) * r, 0.5 + math.sin(a) * r, 1.9 + rnd.random() * 0.9, 0.3 + rnd.random() * 0.15, rnd.choice(leaves))

def p_bollard(ctx, var):
    m = ctx.mat('bollard', _h('#2a2a30'), 0.4, 0.3)
    ctx.cyl(0.5, 0.5, 0, 0.08, 0.68, m, 12)
    ctx.cyl(0.5, 0.5, 0.48, 0.085, 0.06, ctx.mat('bollardBand', _h('#e8e8e8'), 0.5), 12)

def p_cone(ctx, var):
    o = ctx.mat('coneO', _h('#ff6a1a'), 0.5); w = ctx.mat('coneW', _h('#ffffff'), 0.5)
    ctx.box(0.3, 0.3, 0, 0.4, 0.4, 0.04, o)
    ctx.cyl(0.5, 0.5, 0.04, 0.15, 0.6, o, 14, r2=0.03)
    ctx.cyl(0.5, 0.5, 0.3, 0.1, 0.1, w, 14, r2=0.085)

def p_table(ctx, var):
    wood = ctx.mat('tableWood', _h('#6a4020'), 0.6); iron = ctx.mat('iron', _h('#26262c'), 0.4, 0.6)
    ctx.cyl(0.5, 0.5, 0, 0.18, 0.04, iron, 12); ctx.cyl(0.5, 0.5, 0, 0.04, 0.7, iron, 8)
    ctx.cyl(0.5, 0.5, 0.7, 0.4, 0.06, wood, 20)
    pint = ctx.mat('ale', _h('#b06a18'), 0.1, 0, emit=_h('#401800'), emit_strength=0.3)
    ctx.cyl(0.4, 0.5, 0.76, 0.045, 0.16, pint, 10); ctx.cyl(0.4, 0.5, 0.92, 0.046, 0.02, ctx.mat('froth', _h('#f5f0e0'), 0.8), 10)

def p_chair(ctx, var):
    wood = ctx.mat('chairWood', _h('#8a5a30'), 0.6)
    for (x, y) in ((0.3, 0.3), (0.62, 0.3), (0.3, 0.62), (0.62, 0.62)): ctx.box(x, y, 0, 0.06, 0.06, 0.45, wood)
    ctx.box(0.28, 0.28, 0.45, 0.42, 0.42, 0.05, wood)
    ctx.box(0.28, 0.28, 0.5, 0.06, 0.42, 0.5, wood)

def p_gate(ctx, var):
    iron = ctx.mat('gateIron', _h('#6a6a76'), 0.35, 0.8)
    alongX = var.get('dir', 'x') == 'x'
    for i in range(7):
        t = i / 6
        if alongX: ctx.box(t * 0.96, 0.47, 0, 0.04, 0.06, 2.8, iron)
        else: ctx.box(0.47, t * 0.96, 0, 0.06, 0.04, 2.8, iron)
    for z in (0.2, 1.4, 2.7):
        if alongX: ctx.box(0, 0.46, z, 1, 0.08, 0.08, iron)
        else: ctx.box(0.46, 0, z, 0.08, 1, 0.08, iron)

def p_skip(ctx, var):
    m = ctx.mat('skip', _h(var.get('color', '#d08a18')), 0.5, 0.3)
    ctx.box(0.05, 0.1, 0, 1.9, 0.8, 1.2, m, bevel=0.03)
    ctx.box(0.15, 0.2, 0.95, 1.7, 0.6, 0.2, ctx.noise_mat('rubbish', _h('#4a4038'), _h('#7a6a50'), scale=20, bump=1))

def p_barrier(ctx, var):
    m = ctx.mat('barrier', _h('#b0b4bc'), 0.35, 0.8)
    alongX = var.get('dir', 'x') == 'x'
    for i in range(7):
        t = i / 6
        if alongX: ctx.box(t * 0.97, 0.49, 0, 0.03, 0.02, 0.8, m)
        else: ctx.box(0.49, t * 0.97, 0, 0.02, 0.03, 0.8, m)
    for z in (0.08, 0.78):
        if alongX: ctx.box(0, 0.48, z, 1, 0.04, 0.04, m)
        else: ctx.box(0.48, 0, z, 0.04, 1, 0.04, m)

PIECES = [
    dict(kind='wall', id='brick', heights=[3], variants=4, build=wall_brick('#8a4a38', '#7a3e30', '#3a2a26')),
    dict(kind='wall', id='brickDark', heights=[1.2, 2, 3, 6], variants=4, build=wall_brick('#5e3a30', '#4e3028', '#22181a', cap='#4a4448')),
    dict(kind='wall', id='brickYellow', heights=[3], variants=4, build=wall_brick('#b09a64', '#a08a54', '#5a4a3a')),
    dict(kind='wall', id='house', heights=[5], variants=6, build=house),
    dict(kind='wall', id='shop', heights=[5], variants=6, build=shop, padX=12, padBottom=8),
    dict(kind='floor', id='asphalt', n=4, build=floor_asphalt),
    dict(kind='floor', id='road', n=4, build=floor_road()),
    dict(kind='floor', id='roadLineX', n=4, build=floor_road('x')),
    dict(kind='floor', id='roadLineY', n=4, build=floor_road('y')),
    dict(kind='floor', id='pavement', n=4, build=floor_pavement),
    dict(kind='floor', id='kerbX', n=4, build=floor_kerb_x),
    dict(kind='floor', id='cobble', n=4, build=floor_cobble),
    dict(kind='floor', id='grass', n=4, build=floor_grass),
    dict(kind='floor', id='concrete', n=4, build=floor_concrete),
    dict(kind='floor', id='parking', n=4, build=floor_parking),
    dict(kind='floor', id='zebra', n=4, build=floor_zebra),
    dict(kind='prop', id='lamp', size=(1, 1, 3.5), build=p_lamp, pad=20),
    dict(kind='prop', id='bench', size=(1, 1, 1), build=p_bench, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='wheeliebin', size=(1, 1, 1.3), build=p_wheeliebin, variants=[{'color': '#22262c'}, {'color': '#2a5a30'}, {'color': '#1f3f8f'}]),
    dict(kind='prop', id='bin', size=(1, 1, 1.1), build=p_bin, variants=[{'color': '#2a5a30'}]),
    dict(kind='prop', id='crate', size=(1, 1, 1), build=p_crate),
    dict(kind='prop', id='barrel', size=(1, 1, 1.1), build=p_barrel, variants=[{}, {'fire': 1}]),
    dict(kind='prop', id='car', size=(2, 1, 1.2), build=p_car, variants=[{'color': c, 'dir': d} for d in ('x', 'y') for c in ('#8a2020', '#203a8a', '#d8d8d0', '#2a6a3a', '#d8b020', '#1a1a1e')]),
    dict(kind='prop', id='phonebox', size=(1, 1, 3), build=p_phonebox),
    dict(kind='prop', id='postbox', size=(1, 1, 1.5), build=p_postbox),
    dict(kind='prop', id='tree', size=(1, 1, 3.2), build=p_tree, pad=24),
    dict(kind='prop', id='bollard', size=(1, 1, 0.8), build=p_bollard),
    dict(kind='prop', id='cone', size=(1, 1, 0.7), build=p_cone),
    dict(kind='prop', id='table', size=(1, 1, 1), build=p_table),
    dict(kind='prop', id='chairProp', size=(1, 1, 1), build=p_chair),
    dict(kind='prop', id='gate', size=(1, 1, 3), build=p_gate, variants=[{'dir': 'x'}, {'dir': 'y'}]),
    dict(kind='prop', id='skip', size=(2, 1, 1.3), build=p_skip),
    dict(kind='prop', id='barrier', size=(1, 1, 0.9), build=p_barrier, variants=[{'dir': 'x'}, {'dir': 'y'}]),
]

# ------------------------------------------------------------------ more shared wall styles
def w_concrete(ctx, h, v):
    m = ctx.noise_mat('wconc%d' % (v % 2), _h('#5a5a60'), _h('#6e6e74'), scale=14 + v, bump=0.3)
    ctx.box(0, 0, 0, 1, 1, h, m)
    seam = ctx.mat('seam', _h('#46464c'), 0.9)
    z = 1.2
    while z < h:
        ctx.box(0, 0.995, z, 1, 0.01, 0.03, seam); ctx.box(0.995, 0, z, 0.01, 1, 0.03, seam); z += 1.2
    if v % 3 == 2: ctx.box(0.35, 0.996, 0.2, 0.4, 0.01, min(1.4, h * 0.5), ctx.mat('stain', _h('#4a4a40'), 0.95))

def corrugated(c1, c2):
    def build(ctx, h, v):
        a = ctx.mat('corrA' + c1, _h(c1), 0.45, 0.6); b = ctx.mat('corrB' + c2, _h(c2), 0.55, 0.5)
        ctx.box(0, 0, 0, 0.96, 0.96, h, b)
        for i in range(8):
            ctx.box(i / 8, 0.96, 0, 1 / 16, 0.04, h, a)
            ctx.box(0.96, i / 8, 0, 0.04, 1 / 16, h, a)
        ctx.box(0, 0, h - 0.06, 1, 1, 0.06, ctx.mat('corrTop', _h('#4a5058'), 0.5, 0.6))
    return build

def w_container(ctx, h, v):
    cols = ['#8a2a20', '#1f4f8a', '#2a6a3a', '#b08a20']
    c = _h(cols[v % 4]); m = ctx.mat('cont%d' % v, c, 0.5, 0.4); d = ctx.mat('contD%d' % v, tuple(x * 0.7 for x in c), 0.5, 0.4)
    ctx.box(0, 0, 0, 0.94, 0.94, h, d)
    for i in range(6):
        ctx.box(i / 6, 0.94, 0.05, 1 / 12, 0.06, h - 0.1, m)
        ctx.box(0.94, i / 6, 0.05, 0.06, 1 / 12, h - 0.1, m)
    for z in (0, h - 0.08): ctx.box(0, 0, z, 1, 1, 0.08, d)

def w_glass(ctx, h, v):
    fr = ctx.mat('curtFrame', _h('#2a3038'), 0.3, 0.8)
    gl = ctx.mat('curtGlass%d' % (v % 2), _h('#3a5a7a'), 0.04, 0.6, emit=_h('#a8c8e0') if v % 2 else None, emit_strength=0.25)
    ctx.box(0, 0, 0, 0.98, 0.98, h, gl)
    for i in range(3):
        ctx.box(i / 2 - 0.02, 0.97, 0, 0.04, 0.04, h, fr); ctx.box(0.97, i / 2 - 0.02, 0, 0.04, 0.04, h, fr)
    z = 0
    while z <= h:
        ctx.box(0, 0.97, z, 1, 0.04, 0.05, fr); ctx.box(0.97, 0, z, 0.04, 1, 0.05, fr); z += 1.0

def w_hedge(ctx, h, v):
    leaf = ctx.noise_mat('hedge', _h('#244a1e'), _h('#4a7a36'), scale=22, bump=1.2, detail=10)
    ctx.box(0.02, 0.02, 0, 0.96, 0.96, h, leaf, bevel=0.08)

def w_fence_wood(ctx, h, v):
    w1 = ctx.noise_mat('fwood', _h('#5a4028'), _h('#7a5a38'), scale=40, bump=0.4)
    for i in range(6):
        ctx.box(i / 6 + 0.01, 0.9, 0, 1 / 6 - 0.02, 0.08, h - (0.05 if i % 2 else 0), w1)
        ctx.box(0.9, i / 6 + 0.01, 0, 0.08, 1 / 6 - 0.02, h - (0.05 if i % 2 else 0), w1)
    rail = ctx.mat('frail', _h('#4a3420'), 0.9)
    for z in (0.3, h - 0.4): ctx.box(0, 0.86, z, 1, 0.04, 0.1, rail); ctx.box(0.86, 0, z, 0.04, 1, 0.1, rail)
    ctx.box(0, 0, 0, 0.86, 0.86, h - 0.02, ctx.mat('fback', _h('#3a2814'), 0.95))

def w_railing(ctx, h, v):
    iron = ctx.mat('railIron', _h('#2a2a30'), 0.35, 0.8)
    for i in range(8):
        ctx.box(i / 8 + 0.03, 0.47, 0, 0.03, 0.03, h, iron); ctx.box(0.47, i / 8 + 0.03, 0, 0.03, 0.03, h, iron)
    for z in (0.1, h - 0.08): ctx.box(0, 0.46, z, 1, 0.05, 0.05, iron); ctx.box(0.46, 0, z, 0.05, 1, 0.05, iron)

def w_tiled(ctx, h, v):
    tile = ctx.brick_mat('wtile', _h('#e0e0d8'), _h('#d4d4cc'), _h('#9a9a9a'), brick_w=0.15, brick_h=0.075, mortar_size=0.01, rough=0.25, bump=0.1)
    ctx.box(0, 0, 0, 1, 1, h, tile)
    band = ctx.mat('tileband%d' % (v % 3), _h(['#c8102e', '#1f4fb4', '#2a7a3a'][v % 3]), 0.3)
    ctx.box(0, 0.995, 1.1, 1, 0.01, 0.12, band); ctx.box(0.995, 0, 1.1, 0.01, 1, 0.12, band)

def w_stand(ctx, h, v):
    m = ctx.noise_mat('standConc', _h('#3a3a44'), _h('#4a4a54'), scale=10)
    ctx.box(0, 0, 0, 1, 1, h, m)
    red = ctx.mat('standRed', _h('#c8102e'), 0.5); white = ctx.mat('standWhite', _h('#f4f1e8'), 0.5)
    ctx.box(0, 0.995, h - 0.35, 1, 0.01, 0.25, red); ctx.box(0.995, 0, h - 0.35, 0.01, 1, 0.25, red)
    ctx.box(0, 0.995, h - 0.42, 1, 0.012, 0.07, white); ctx.box(0.995, 0, h - 0.42, 0.012, 1, 0.07, white)

def w_advert(ctx, h, v):
    pals = [('#1a1a8a', '#ffd23a'), ('#c8102e', '#ffffff'), ('#0a6a3a', '#ffffff'), ('#ffd23a', '#1a1a1a'), ('#ffffff', '#c8102e'), ('#2a2a2a', '#3aff7a')]
    bg, fg = pals[v % len(pals)]
    ctx.box(0, 0, 0, 1, 1, h, ctx.mat('advBg' + bg, _h(bg), 0.4, 0, emit=_h(bg), emit_strength=0.4))
    f = ctx.mat('advFg' + fg, _h(fg), 0.4, 0, emit=_h(fg), emit_strength=0.8)
    rnd = random.Random(v)
    for i in range(4):
        w = 0.12 + rnd.random() * 0.1
        ctx.box(0.08 + i * 0.22, 0.996, h * 0.3, w, 0.01, h * 0.4, f)
        ctx.box(0.996, 0.08 + i * 0.22, h * 0.3, 0.01, w, h * 0.4, f)

def w_rock(ctx, h, v):
    m = ctx.noise_mat('rock', _h('#3a3632'), _h('#5a5650'), scale=6, bump=1.5, detail=12)
    ctx.box(0, 0, 0, 1, 1, h, m, bevel=0.05)

def w_crates(ctx, h, v):
    wood = ctx.mat('crateWood', _h('#8a6038'), 0.85); dark = ctx.mat('crateDark', _h('#5e3e20'), 0.9)
    z = 0
    while z < h - 0.01:
        hh = min(0.95, h - z)
        ctx.box(0.02, 0.02, z, 0.96, 0.96, hh, wood)
        for (x, y, w, d) in ((0, 0.93, 1, 0.07), (0.93, 0, 0.07, 1)): ctx.box(x, y, z, w, d, hh, dark)
        ctx.box(0, 0, z + hh - 0.06, 1, 1, 0.06, dark)
        z += hh

PIECES += [
    dict(kind='wall', id='concrete', heights=[1, 1.2, 2, 3, 4, 5, 6], variants=3, build=w_concrete),
    dict(kind='wall', id='corrugated', heights=[2, 3, 4, 5], variants=2, build=corrugated('#6e7884', '#4a525c')),
    dict(kind='wall', id='corrugatedRust', heights=[2, 3, 4, 5], variants=2, build=corrugated('#8e5a3a', '#5e3a26')),
    dict(kind='wall', id='container', heights=[1.3, 2.6, 3], variants=4, build=w_container),
    dict(kind='wall', id='glass', heights=[3, 4, 5, 6], variants=2, build=w_glass),
    dict(kind='wall', id='hedge', heights=[1, 1.2, 1.5, 2], variants=2, build=w_hedge),
    dict(kind='wall', id='fenceWood', heights=[1.2, 1.5, 2, 3], variants=2, build=w_fence_wood),
    dict(kind='wall', id='railing', heights=[1, 1.2, 1.5, 2], variants=1, build=w_railing),
    dict(kind='wall', id='tiledWall', heights=[3, 4, 5], variants=3, build=w_tiled),
    dict(kind='wall', id='stand', heights=[3, 4, 5, 6], variants=2, build=w_stand),
    dict(kind='wall', id='advert', heights=[0.8, 1, 1.2], variants=6, build=w_advert),
    dict(kind='wall', id='rock', heights=[1, 2, 3, 4], variants=2, build=w_rock),
    dict(kind='wall', id='crateStack', heights=[1, 2, 3], variants=2, build=w_crates),
    dict(kind='wall', id='brick', heights=[1, 1.2, 1.5, 2, 4, 5, 6], variants=4, build=wall_brick('#8a4a38', '#7a3e30', '#3a2a26')),
    dict(kind='wall', id='brickYellow', heights=[1.2, 2, 4, 5], variants=4, build=wall_brick('#b09a64', '#a08a54', '#5a4a3a')),
    dict(kind='wall', id='brickDark', heights=[1, 1.5, 4, 5], variants=4, build=wall_brick('#5e3a30', '#4e3028', '#22181a', cap='#4a4448')),
    dict(kind='wall', id='house', heights=[4, 6], variants=6, build=house),
    dict(kind='wall', id='shop', heights=[4, 6], variants=6, build=shop, padX=12, padBottom=8),
]
