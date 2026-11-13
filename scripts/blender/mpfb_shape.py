# THE LAST HOOLIGAN — shape helpers shared by char_mpfb.py and vic_face.py (imported, not run).
#
# sculpt_cranium(body, cfg): MPFB's head targets can't give a bald hero a round, broad dome (head-round / head-square /
# head-scale-* move the whole head, and the crown stays egg-shaped). This pulls the skin of the cranium onto a smooth
# ellipsoid fitted to it (then scaled), as one extra shape key, BEFORE the rig and clothes are fitted:
#   cfg = {"strength": 0.85,            # 0 = untouched, 1 = exactly on the ellipsoid
#          "scale": [1.06, 1.0, 0.98],  # ellipsoid radii multipliers (x = width, y = depth, z = height)
#          "lift": 0.0,                 # move the ellipsoid centre up (m, raw MPFB metres)
#          "back": 0.0}                 # ... and backwards (+Y)
# The blend region is above a plane through the brow that tilts down towards the nape, feathered over "feather" metres;
# ears are left alone (they follow the skin under them through the same weight at their root).
import numpy as np


def _mixed(ob):
    if not ob.data.shape_keys:
        return np.array([v.co for v in ob.data.vertices])
    k = ob.shape_key_add(name='_mix', from_mix=True)
    c = np.array([d.co for d in k.data])
    ob.shape_key_remove(k)
    return c


def _group(ob, name, thr=0.5):
    if name not in ob.vertex_groups: return np.zeros(0, int)
    gi = ob.vertex_groups[name].index
    return np.array([v.index for v in ob.data.vertices if any(g.group == gi and g.weight > thr for g in v.groups)], int)


def _fit_ellipsoid(P):
    """axis-aligned ellipsoid a x^2 + b y^2 + c z^2 + d x + e y + f z = 1 (least squares) -> centre, radii."""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    A = np.c_[x * x, y * y, z * z, x, y, z]
    p, *_ = np.linalg.lstsq(A, np.ones(len(P)), rcond=None)
    a, b, c, d, e, f = p
    cen = np.array([-d / (2 * a), -e / (2 * b), -f / (2 * c)])
    g = 1 + a * cen[0] ** 2 + b * cen[1] ** 2 + c * cen[2] ** 2
    rad = np.sqrt(g / np.array([a, b, c]))
    return cen, rad


def sculpt_cranium(body, cfg, log=print):
    if not cfg: return
    CO = _mixed(body)
    skin = _group(body, 'body')
    ears = set(_group(body, 'ears', 0.05).tolist())
    lash = np.concatenate([_group(body, 'helper-r-eyelashes-1'), _group(body, 'helper-l-eyelashes-1')])
    eye = CO[lash].mean(0)                            # between the upper lid margins
    z0 = eye[2] + cfg.get('above_brow', 0.035)        # plane through the brow ...
    y0 = eye[1]
    tilt = cfg.get('tilt', 0.55)                      # ... dropping this much per metre towards the back (+Y)
    feather = cfg.get('feather', 0.045)
    P = CO[skin]
    s = (P[:, 2] - z0) + tilt * (P[:, 1] - y0)
    core = P[(s > feather) & (np.abs(P[:, 0]) < 0.2)]
    core = core[[i not in ears for i in skin[(s > feather) & (np.abs(P[:, 0]) < 0.2)]]]
    cen, rad = _fit_ellipsoid(core)
    cen[0] = 0.0                                      # symmetric
    log('   cranium fit: centre %s radii %s (%d pts)' % (np.round(cen, 3), np.round(rad, 3), len(core)))
    cen = cen + np.array([0, cfg.get('back', 0.0), cfg.get('lift', 0.0)])
    rad = rad * np.array(cfg.get('scale', [1, 1, 1]))
    w = np.clip(s / feather, 0, 1); w = w * w * (3 - 2 * w)
    w *= cfg.get('strength', 0.85)
    d = P - cen
    k = np.sqrt(((d / rad) ** 2).sum(1))
    onto = cen + d / np.maximum(k, 1e-6)[:, None]
    newP = P + (onto - P) * w[:, None]
    # ears: ride along with the skin at their root (rigid shift = the nearest moved skin vertex's offset)
    delta = np.zeros_like(CO)
    delta[skin] = newP - P
    if ears:
        ei = np.array(sorted(ears)); ns = np.setdiff1d(skin, ei)
        for i in ei:
            j = ns[np.argmin(((CO[ns] - CO[i]) ** 2).sum(1))]
            delta[i] = delta[j]
    # write as a shape key relative to the basis (value 1): basis + delta
    if not body.data.shape_keys:
        body.shape_key_add(name='Basis', from_mix=False)
    key = body.shape_key_add(name='cranium', from_mix=False)
    base = np.array([d_.co for d_ in key.data])
    flat = (base + delta).astype(np.float32).ravel()
    key.data.foreach_set('co', flat)
    key.value = 1.0
    log('   cranium sculpt: %d verts moved, max %.1f mm' % (int((np.abs(delta).sum(1) > 1e-6).sum()), 1000 * np.linalg.norm(delta, axis=1).max()))
