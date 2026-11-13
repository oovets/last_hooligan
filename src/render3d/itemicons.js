// 3D item icons for the kit bag and the HUD: every item is built from a few Three.js shapes (a bottle, a can, a bag, a
// stick, a chair...), lit like the menus (room environment + a warm key light), rendered ONCE to a small canvas and
// cached. The 2D game (no Three.js) keeps the old pixel icons (items.js def.icon).
//
//   itemIcon(def) -> canvas (ICON px square, transparent) | null when the item has no 3D build
//   main.js puts it on r3d.itemIcon; ui/itemicon.js drawItemIcon() uses it and falls back to def.icon.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ICON = 160;                         // px; drawn down to slot size with smoothing
let R = null, scene = null, camera = null, env = null;
const cache = new Map();

function setup() {
  const c = document.createElement('canvas'); c.width = c.height = ICON;
  R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setClearColor(0x000000, 0); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NeutralToneMapping;
  const pm = new THREE.PMREMGenerator(R); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = 0.8;
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd88a, 1.2); rim.position.set(-3, 1.5, -2); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xdde4ff, 0x30281c, 0.5));
  camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
}

// ---------------------------------------------------------------- materials and shapes
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0, transparent: (o.a ?? 1) < 1, opacity: o.a ?? 1, emissive: o.e || 0x000000, emissiveIntensity: o.ei ?? 1 });
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const cyl = (rt, rb, h, seg = 28) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
const lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 32);
const group = (...o) => { const g = new THREE.Group(); for (const x of o) g.add(x); return g; };
const tilt = (g, z = -0.7, x = 0.25) => { g.rotation.set(x, 0.35, z); return g; };    // long things go corner to corner

const B = {
  bottle: (p) => group(
    mesh(lathe([[0, 0], [0.26, 0], [0.27, 0.05], [0.27, 0.62], [0.2, 0.78], [0.09, 0.9], [0.085, 1.12], [0, 1.12]]), M(p.c || '#5a3010', { r: 0.12, a: 0.92 })),
    mesh(cyl(0.272, 0.272, 0.26), M(p.label || '#e8dcb8', { r: 0.7 }), 0, 0.36, 0),
    mesh(cyl(0.1, 0.1, 0.06), M(p.cap || '#c8a030', { r: 0.3, m: 0.8 }), 0, 1.14, 0)),
  can: (p) => group(
    mesh(cyl(0.3, 0.3, 0.92), M(p.c || '#1a8a3a', { r: 0.25, m: 0.6 }), 0, 0.46, 0),
    mesh(cyl(0.302, 0.302, 0.2), M(p.band || '#f4f1e8', { r: 0.3, m: 0.3 }), 0, 0.5, 0),
    mesh(cyl(0.26, 0.3, 0.05), M('#c8c8cc', { r: 0.25, m: 0.9 }), 0, 0.945, 0)),
  cup: (p) => group(          // paper / plastic cup, steaming tea or beef tea
    mesh(lathe([[0, 0], [0.22, 0], [0.3, 0.7], [0.32, 0.72], [0, 0.72]]), M(p.c || '#f4f1e8', { r: 0.8 })),
    mesh(cyl(0.29, 0.29, 0.02), M(p.drink || '#7a4a20', { r: 0.2 }), 0, 0.68, 0)),
  mug: (p) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 12, 24, Math.PI), M(p.c || '#f4f1e8', { r: 0.4 })); t.position.set(0.3, 0.36, 0); t.rotation.z = -Math.PI / 2;
    return group(mesh(cyl(0.28, 0.27, 0.7), M(p.c || '#f4f1e8', { r: 0.4 }), 0, 0.35, 0), mesh(cyl(0.25, 0.25, 0.02), M(p.drink || '#9a6030', { r: 0.2 }), 0, 0.66, 0), t); },
  pint: (p) => group(
    mesh(lathe([[0, 0], [0.24, 0], [0.3, 0.95], [0.28, 1.0], [0, 1.0]]), M(p.c || '#c87a18', { r: 0.1, a: 0.85 })),
    mesh(cyl(0.29, 0.29, 0.12), M('#f4ecd8', { r: 0.9 }), 0, 0.93, 0)),
  bag: (p) => { const g = group(mesh(box(0.7, 0.9, 0.22, 0.08), M(p.c || '#f2f2f2', { r: p.r ?? 0.35, a: p.a ?? 1 }), 0, 0.45, 0));
    if (p.fill) g.add(mesh(box(0.55, 0.6, 0.14, 0.06), M(p.fill, { r: 0.9 }), 0, 0.36, 0));
    if (p.band) g.add(mesh(box(0.72, 0.12, 0.23, 0.02), M(p.band, { r: 0.5 }), 0, 0.82, 0));
    g.rotation.set(0.2, 0.5, 0.1); return g; },
  carton: (p) => { const g = group(mesh(box(0.8, 0.5, 0.5, 0.04), M(p.c || '#f4f1e8', { r: 0.85 }), 0, 0.25, 0));
    if (p.food) g.add(mesh(box(0.66, 0.16, 0.38, 0.06), M(p.food, { r: 0.8 }), 0, 0.55, 0));
    if (p.band) g.add(mesh(box(0.82, 0.12, 0.52, 0.02), M(p.band, { r: 0.6 }), 0, 0.3, 0));
    g.rotation.set(0.35, 0.6, 0); return g; },
  bowl: (p) => group(
    mesh(lathe([[0, 0], [0.3, 0], [0.48, 0.32], [0.5, 0.34], [0, 0.34]]), M(p.c || '#f4f1e8', { r: 0.5 })),
    mesh(new THREE.SphereGeometry(0.44, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), M(p.food || '#8a5a2a', { r: 0.8 }), 0, 0.18, 0)),
  pie: (p) => group(
    mesh(cyl(0.48, 0.42, 0.32), M(p.c || '#c8902a', { r: 0.75 }), 0, 0.16, 0),
    mesh(new THREE.SphereGeometry(0.47, 24, 10, 0, Math.PI * 2, 0, Math.PI / 4), M(p.top || '#d8a040', { r: 0.7 }), 0, 0.0, 0),
    ...(p.mash ? [mesh(new THREE.SphereGeometry(0.3, 18, 10), M('#f4ecd0', { r: 0.9 }), 0.42, 0.18, 0.2), mesh(cyl(0.6, 0.6, 0.04), M('#7a9a4a', { r: 0.4 }), 0.1, 0.02, 0.1)] : [])),
  kebab: () => { const w = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 24, 1, true), M('#f4f1e8', { r: 0.8 })); w.rotation.x = Math.PI; w.position.y = 0.45;
    return group(w, mesh(new THREE.SphereGeometry(0.3, 16, 10), M('#8a4a22', { r: 0.8 }), 0, 0.9, 0), mesh(new THREE.SphereGeometry(0.2, 12, 8), M('#4a8a2a', { r: 0.7 }), 0.12, 1.02, 0.08), mesh(new THREE.SphereGeometry(0.12, 12, 8), M('#c81e1e', { r: 0.6 }), -0.12, 1.05, 0.1)); },
  apple: (p) => group(mesh(new THREE.SphereGeometry(0.42, 28, 18), M(p.c || '#c82a1e', { r: 0.35 }), 0, 0.42, 0), mesh(cyl(0.02, 0.025, 0.18, 8), M('#4a3020'), 0, 0.88, 0)),
  melon: () => { const g = group(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 24, 1, false, 0, Math.PI / 2.2), M('#e84a4a', { r: 0.6 })),
    mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.19, 24, 1, true, 0, Math.PI / 2.2), M('#2a7a2a', { r: 0.5 }))); g.rotation.set(1.2, 0.2, 0); return g; },
  stick: (p) => { const L = p.len || 2.2, r = p.rad || 0.06, g = group(mesh(cyl(r * (p.taper || 1), r, L), M(p.c || '#8a5a2a', { r: p.rough ?? 0.6, m: p.metal || 0, e: p.glow || 0, ei: 1.5 })));
    if (p.tip) g.add(mesh(cyl(r * 1.15, r * 1.15, L * 0.08), M(p.tip, { r: 0.4, m: p.tipMetal || 0 }), 0, L / 2, 0));
    if (p.knob) g.add(mesh(new THREE.SphereGeometry(r * 2.2, 16, 12), M(p.knob, { r: 0.25, m: 0.9 }), 0, L / 2 + r, 0));
    if (p.grip) g.add(mesh(cyl(r * 1.2, r * 1.2, L * 0.3), M(p.grip, { r: 0.8 }), 0, -L * 0.33, 0));
    return tilt(g); },
  umbrella: () => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 10, 20, Math.PI), M('#4a3020', { r: 0.5 })); h.position.set(0.14, -1.0, 0); h.rotation.z = Math.PI;
    return tilt(group(mesh(new THREE.ConeGeometry(0.16, 1.5, 20), M('#141416', { r: 0.6 }), 0, 0.1, 0), mesh(cyl(0.025, 0.025, 1.9), M('#9a9aa0', { m: 0.8, r: 0.3 }), 0, 0, 0), h)); },
  spanner: (p) => { const s = p.big ? 1.5 : 1, mt = M(p.c || '#a8acb4', { m: 0.85, r: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14 * s, 0.05 * s, 10, 20), mt); ring.position.y = 0.8 * s;
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.16 * s, 0.055 * s, 10, 20, Math.PI * 1.4), mt); jaw.position.y = -0.8 * s; jaw.rotation.z = Math.PI * 1.3;
    return tilt(group(mesh(box(0.12 * s, 1.5 * s, 0.05 * s, 0.02), mt), ring, jaw)); },
  cross: (p) => { const mt = M(p.c || '#9a9ea8', { m: 0.8, r: 0.3 }); const a = mesh(cyl(0.07, 0.07, 1.5), mt), b = mesh(cyl(0.07, 0.07, 1.5), mt); b.rotation.z = Math.PI / 2;
    const g = group(a, b); for (const [x, y] of [[0, 0.75], [0, -0.75], [0.75, 0], [-0.75, 0]]) g.add(mesh(cyl(0.11, 0.11, 0.16, 6), mt, x, y, 0).rotateX(Math.PI / 2)); g.rotation.set(0.35, 0.25, 0.6); return g; },
  chair: (p) => { const wd = M(p.c || '#7a4a22', { r: 0.6 }), g = group(mesh(box(0.8, 0.08, 0.8, 0.02), wd, 0, 0.7, 0), mesh(box(0.8, 0.8, 0.07, 0.02), wd, 0, 1.15, -0.37));
    for (const [x, z] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) g.add(mesh(cyl(0.035, 0.035, 0.7, 8), wd, x, 0.35, z));
    g.rotation.y = 0.6; return g; },
  stool: (p) => { const g = group(mesh(cyl(0.38, 0.38, 0.1), M(p.top || '#7a1e1e', { r: 0.5 }), 0, 1.1, 0), mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 24), M('#a8acb4', { m: 0.9, r: 0.3 }), 0, 0.45, 0));
    g.children[1].rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4, l = mesh(cyl(0.03, 0.03, 1.1, 8), M('#a8acb4', { m: 0.9, r: 0.3 }), Math.cos(a) * 0.28, 0.55, Math.sin(a) * 0.28); g.add(l); }
    return g; },
  seat: (p) => { const pl = M(p.c || '#1f4fb4', { r: 0.4 }); const g = group(mesh(box(0.9, 0.12, 0.8, 0.06), pl, 0, 0.1, 0), mesh(box(0.9, 0.8, 0.1, 0.06), pl, 0, 0.5, -0.36));
    g.rotation.set(0.15, 0.6, 0); return g; },
  ball: (p) => { const g = group(mesh(new THREE.SphereGeometry(0.45, 32, 20), M(p.c || '#f4f4f0', { r: p.r ?? 0.4 }), 0, 0.45, 0));
    if (p.spot) g.add(mesh(new THREE.CircleGeometry(0.18, 20), M(p.spot, { r: 0.3 }), 0.02, 0.5, 0.45));
    if (p.patches) for (const [x, y, z] of [[0, 0.9, 0], [0.4, 0.55, 0.2], [-0.3, 0.6, 0.32], [0.1, 0.3, 0.42]]) { const d = mesh(new THREE.CircleGeometry(0.11, 5), M('#141416'), x * 0.99, y, z * 0.99); d.lookAt(x * 3, y * 3 - 0.9, z * 3); g.add(d); }
    return g; },
  disc: (p) => { const g = group(mesh(cyl(p.r || 0.55, p.r || 0.55, p.h || 0.08, 36), M(p.c || '#8a8a90', { m: p.m ?? 0.8, r: p.rough ?? 0.35 })));
    if (p.boss) g.add(mesh(cyl(0.12, 0.16, 0.12), M(p.c || '#8a8a90', { m: 0.8, r: 0.35 }), 0, 0.08, 0));
    if (p.rim) g.add(mesh(new THREE.TorusGeometry(p.r || 0.55, 0.03, 8, 36), M(p.rim, { m: 0.8, r: 0.3 })).rotateX(Math.PI / 2));
    g.rotation.set(1.0, 0, 0.25); return g; },
  buoy: () => { const g = group(); for (let i = 0; i < 8; i++) g.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.16, 14, 12, Math.PI / 4), M(i % 2 ? '#f4f1e8' : '#d8261e', { r: 0.5 })).rotateZ(i * Math.PI / 4));
    g.rotation.set(0.35, 0.2, 0); return g; },
  card: (p) => { const g = group(mesh(box(p.w || 0.9, 0.03, p.d || 0.55, 0.01), M(p.c || '#f4f1e8', { r: 0.8 })));
    if (p.stripe) g.add(mesh(box((p.w || 0.9) * 0.98, 0.032, (p.d || 0.55) * 0.25, 0.005), M(p.stripe, { r: 0.6 }), 0, 0.002, -(p.d || 0.55) * 0.2));
    g.rotation.set(1.05, 0.15, 0.2); return g; },
  brick: (p) => { const g = group(mesh(box(0.55, 0.32, 0.5, 0.03), M(p.c || '#a8522e', { r: 0.95 }))); g.rotation.set(0.4, 0.7, 0); return g; },
  crate: (p) => { const wd = M(p.c || '#a87a48', { r: 0.85 }), dk = M('#6a4a2a', { r: 0.9 });
    const g = group(mesh(box(1, 1, 1, 0.02), wd)); for (const y of [-0.42, 0.42]) g.add(mesh(box(1.02, 0.1, 1.02, 0.01), dk, 0, y, 0));
    g.rotation.set(0.35, 0.65, 0); return g; },
  barrel: (p) => { const g = group(mesh(cyl(0.45, 0.45, 1.2), M(p.c || '#2a4a8a', { r: 0.45, m: 0.5 })));
    for (const y of [-0.3, 0.3]) g.add(mesh(cyl(0.465, 0.465, 0.06), M('#1a2a4a', { m: 0.6, r: 0.4 }), 0, y, 0)); g.rotation.set(0.3, 0, 0.1); return g; },
  cone: () => group(mesh(box(0.8, 0.08, 0.8, 0.02), M('#141416'), 0, 0.04, 0), mesh(new THREE.ConeGeometry(0.32, 1.1, 24), M('#ff6a10', { r: 0.5 }), 0, 0.6, 0), mesh(cyl(0.15, 0.2, 0.2), M('#f4f4f0', { r: 0.4 }), 0, 0.68, 0)),
  flag: (p) => { const f = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, -0.2, 0), new THREE.Vector3(0, -0.45, 0)]), M(p.c || '#f2c811', { r: 0.6 }));
    f.geometry.computeVertexNormals(); f.material.side = THREE.DoubleSide; f.position.set(0.03, 1.0, 0);
    return tilt(group(mesh(cyl(0.03, 0.03, 2.1), M('#f4f4f0', { r: 0.5 })), f), -0.4); },
  scarf: () => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(Math.sin(t * Math.PI * 1.6) * 0.5, -t * 1.4 + 0.7, Math.cos(t * Math.PI * 1.6) * 0.25)); }
    const curve = new THREE.CatmullRomCurve3(pts), g = group();
    for (let i = 0; i < 10; i++) { const sub = new THREE.CatmullRomCurve3(curve.getPoints(40).slice(i * 4, i * 4 + 5)); g.add(new THREE.Mesh(new THREE.TubeGeometry(sub, 4, 0.15, 10), M(i % 2 ? '#f2c811' : '#141416', { r: 0.8 }))); }
    return g; },
  shield: () => { const s = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.6, 24, 1, true, -0.5, 1), M('#cfe4f4', { r: 0.05, a: 0.55 })); s.material.side = THREE.DoubleSide;
    const g = group(s, mesh(box(0.5, 0.12, 0.02, 0.01), M('#141416'), 0, 0.5, 0.99)); g.rotation.y = 0.5; return g; },
  megaphone: () => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.16, 0.9, 24, 1, true), M('#f4f4f0', { r: 0.4 })); c.material.side = THREE.DoubleSide; c.rotation.z = Math.PI / 2;
    const g = group(c, mesh(box(0.12, 0.4, 0.12, 0.03), M('#141416'), -0.15, -0.3, 0), mesh(cyl(0.17, 0.17, 0.3), M('#d8261e', { r: 0.4 }), -0.55, 0, 0).rotateZ(Math.PI / 2)); g.rotation.y = 0.6; return g; },
  flare: () => tilt(group(mesh(cyl(0.1, 0.1, 1.2), M('#d8261e', { r: 0.5 })), mesh(new THREE.SphereGeometry(0.16, 14, 10), M('#ff8a3a', { e: 0xff5a10, ei: 3 }), 0, 0.66, 0)), -0.5),
  rattle: () => tilt(group(mesh(box(0.5, 0.7, 0.12, 0.02), M('#a87a48', { r: 0.7 }), 0, 0.3, 0), mesh(cyl(0.05, 0.05, 1.0), M('#6a4a2a'), 0, -0.4, 0), mesh(box(0.52, 0.12, 0.13, 0.01), M('#d8261e'), 0, 0.45, 0)), -0.4),
  phone: () => { const g = group(mesh(box(0.35, 1.0, 0.18, 0.04), M('#1a1a1e', { r: 0.4 })), mesh(cyl(0.025, 0.025, 0.5, 8), M('#2a2a2e'), 0.1, 0.72, 0), mesh(box(0.26, 0.16, 0.02, 0.01), M('#7ac87a', { e: 0x2a6a2a }), 0, 0.28, 0.1));
    g.rotation.set(0.2, 0.5, -0.3); return g; },
  handbag: (p) => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 24, Math.PI), M('#1a1a1e', { r: 0.4 })); h.position.y = 0.5;
    const g = group(mesh(box(0.9, 0.6, 0.3, 0.1), M(p.c || '#8a1e3a', { r: 0.35 }), 0, 0.2, 0), h, mesh(box(0.2, 0.08, 0.02, 0.01), M('#d4af37', { m: 0.9, r: 0.2 }), 0, 0.3, 0.16)); g.rotation.y = 0.5; return g; },
  heel: () => { const red = M('#c81e1e', { r: 0.25 }); const sole = mesh(box(0.3, 0.06, 1.0, 0.03), red, 0, 0.35, 0); sole.rotation.x = 0.45;
    const g = group(sole, mesh(cyl(0.025, 0.04, 0.55, 8), red, 0, 0.27, -0.4), mesh(box(0.28, 0.2, 0.3, 0.06), red, 0, 0.18, 0.42)); g.rotation.y = 1.0; return g; },
  hammer: () => tilt(group(mesh(cyl(0.05, 0.05, 1.4), M('#f2c811', { r: 0.3 })), mesh(cyl(0.22, 0.22, 0.7), M('#d8261e', { r: 0.25 }), 0, 0.75, 0).rotateZ(Math.PI / 2)), -0.5),
  dart: () => { const g = group(mesh(cyl(0.012, 0.012, 0.5, 8), M('#c8c8cc', { m: 0.9, r: 0.2 }), 0, 0.5, 0), mesh(cyl(0.05, 0.05, 0.5), M('#2a2a2e', { m: 0.6 }), 0, 0, 0));
    for (let i = 0; i < 3; i++) { const f = mesh(box(0.22, 0.3, 0.01, 0.005), M('#f2c811', { r: 0.5 }), 0, -0.4, 0); f.rotation.y = i * Math.PI / 3; g.add(f); } return tilt(g, -0.8); },
  gumshield: () => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 12, 24, Math.PI * 1.1), M('#5a8af0', { r: 0.2, a: 0.85 })); t.rotation.set(1.2, 0, Math.PI * 0.95); return group(t); },
  boot: () => { const gold = M('#d4af37', { m: 1, r: 0.2 }); const g = group(mesh(box(0.4, 0.7, 0.45, 0.1), gold, 0, 0.35, 0), mesh(box(0.42, 0.3, 0.8, 0.12), gold, 0, 0.15, 0.25));
    for (let i = 0; i < 3; i++) g.add(mesh(cyl(0.03, 0.03, 0.1, 8), gold, 0.1 * (i - 1), -0.03, 0.1 + i * 0.15)); g.rotation.y = -0.9; return g; },
  key: (p) => { const mt = M(p.c || '#d4af37', { m: 0.9, r: 0.25 }); const g = group(mesh(new THREE.TorusGeometry(0.2, 0.06, 10, 20), mt, 0, 0.5, 0), mesh(box(0.08, 0.8, 0.04, 0.01), mt, 0, -0.1, 0), mesh(box(0.2, 0.08, 0.04, 0.01), mt, 0.1, -0.35, 0), mesh(box(0.15, 0.08, 0.04, 0.01), mt, 0.08, -0.2, 0));
    return tilt(g, -0.5); },
  note: (p) => { const g = group(); for (let i = 0; i < (p.n || 2); i++) g.add(mesh(box(1.0, 0.02, 0.5, 0.005), M(p.c || '#6a9a5a', { r: 0.8 }), i * 0.06, i * 0.03, i * 0.04).rotateY(i * 0.15));
    g.rotation.set(1.0, 0.2, 0.15); return g; },
  coin: (p) => { const g = group(mesh(cyl(0.4, 0.4, 0.07, 32), M(p.c || '#e8c040', { m: 0.75, r: 0.3 })), mesh(cyl(0.3, 0.3, 0.075, 32), M(p.c || '#e8c040', { m: 0.6, r: 0.45 }))); g.rotation.set(0.45, 0, 0.3); return g; },
  badge: () => { const g = group(mesh(cyl(0.4, 0.4, 0.06, 32), M('#141416', { r: 0.3 })), mesh(cyl(0.3, 0.3, 0.07, 32), M('#f2c811', { r: 0.3, m: 0.3 }))); g.rotation.set(1.2, 0, 0.3); return g; },
  fanzine: () => { const g = group(mesh(box(0.8, 0.06, 1.1, 0.01), M('#ece6d4', { r: 0.9 })), mesh(box(0.8, 0.065, 0.28, 0.005), M('#141416'), 0, 0.001, -0.4)); g.rotation.set(1.0, 0.2, 0.15); return g; },
  shirt: () => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#bd9d66'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#16120e'; for (let i = 0; i < 64; i += 16) { x.fillRect(i, 0, 3, 64); x.fillRect(0, i, 64, 3); } x.fillStyle = '#c0281e'; x.fillRect(8, 0, 1, 64); x.fillRect(0, 8, 64, 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
    const g = group(mesh(box(1.0, 0.18, 0.8, 0.06), m), mesh(box(0.4, 0.1, 0.25, 0.04), m, 0, 0.12, -0.3)); g.rotation.set(0.6, 0.4, 0); return g; },
};

// item id -> [builder, params]
const ITEM3D = {
  pint: ['pint'], pub_glass: ['pint', { c: '#d8e8f0' }], bottle: ['bottle'], city_champagne: ['bottle', { c: '#1e3a1e', label: '#e8dcb8', cap: '#d4af37' }],
  energy: ['can', { c: '#1a1a1e', band: '#7aff3a' }], ibrox_ginger: ['can', { c: '#e87a1a', band: '#1f4fb4' }],
  pie: ['pie'], ot_pasty: ['pie', { c: '#b8802a' }], theden_pieMash: ['pie', { mash: true }], kebab: ['kebab'],
  charlie: ['bag', { c: '#e8eef4', a: 0.45, fill: '#ffffff', band: '#d8261e', r: 0.1 }], pub_crisps: ['bag', { c: '#1f4fb4', band: '#f2c811' }],
  anfield_chips: ['carton', { c: '#f4f1e8', food: '#c8902a', band: '#6a3a10' }], ibrox_chips: ['carton', { c: '#f4f1e8', food: '#e8c060' }],
  ibrox_munchy: ['carton', { c: '#e8e0c8', food: '#d8a040', band: '#d8261e' }], ibrox_supper: ['carton', { c: '#ece6d4', food: '#d8b060' }],
  anfield_scouse: ['bowl', { food: '#8a5a2a' }],
  ot_tea: ['cup'], awayend_beeftea: ['cup', { drink: '#5a2a10' }], derby_beeftea: ['cup', { drink: '#5a2a10' }], stamfordbridge_cuppa: ['mug', { c: '#1f4fb4' }],
  theden_tea: ['mug'], industrial_tea: ['mug', { c: '#f2c811' }], underground_tea: ['cup', { c: '#d8d8d0' }],
  city_apple: ['apple'], city_melon: ['melon'],
  pipe: ['stick', { c: '#6a6e78', metal: 0.7, rough: 0.4, len: 1.8, rad: 0.07 }], pub_cue: ['stick', { c: '#c8a070', len: 2.6, rad: 0.05, taper: 0.5, tip: '#3a6ab4', grip: '#2a1a10' }],
  underground_pickhandle: ['stick', { c: '#a8784a', len: 2.0, rad: 0.08, taper: 1.4 }], anfield_prop: ['stick', { c: '#b88a5a', len: 2.6, rad: 0.06 }],
  stamfordbridge_pole: ['stick', { c: '#9a9ea8', metal: 0.85, rough: 0.35, len: 2.4, rad: 0.08 }], industrial_pole: ['stick', { c: '#9a9ea8', metal: 0.85, rough: 0.35, len: 2.4, rad: 0.08 }],
  city_cane: ['stick', { c: '#1a1a1e', len: 2.0, rad: 0.04, knob: '#d8d8dc' }], city_neon: ['stick', { c: '#ff6ad8', len: 2.2, rad: 0.05, glow: 0xff3ac8, rough: 0.2 }],
  industrial_torch: ['stick', { c: '#1a1a1e', len: 1.3, rad: 0.12, tip: '#e8e8d0' }], awayend_programme: ['stick', { c: '#f4f1e8', len: 1.2, rad: 0.12, tip: '#1f4fb4' }],
  ot_programme: ['stick', { c: '#f4f1e8', len: 1.2, rad: 0.12, tip: '#d8261e' }], umbrella: ['umbrella'],
  industrial_spanner: ['spanner'], underground_spanner: ['spanner', { c: '#8a8e96' }], industrial_wrench: ['spanner', { big: true, c: '#c82a1e' }], theden_wheelbrace: ['cross'],
  chair: ['chair'], pub_stool: ['stool'], derby_seat: ['seat', { c: '#141416' }], ibrox_seat: ['seat', { c: '#1f4fb4' }], ot_seat: ['seat', { c: '#d8261e' }],
  derby_ball: ['ball', { patches: true }], pub_poolball: ['ball', { c: '#d8261e', spot: '#f4f4f0', r: 0.1 }],
  binlid: ['disc', { c: '#7a7e86', r: 0.6, boss: true, rim: '#5a5e66' }], theden_hubcap: ['disc', { c: '#d8dce4', r: 0.5, boss: true, m: 1, rough: 0.15 }], ot_buoy: ['buoy'],
  awayend_coin: ['coin', { c: '#c8c8cc' }], coin: ['coin'], cash5: ['note', { c: '#4a8a8a' }], cash20: ['note', { c: '#7a4a9a', n: 3 }],
  ticket: ['card', { c: '#f4f1e8', stripe: '#f2c811' }], industrial_pass: ['card', { c: '#f4f1e8', stripe: '#1f4fb4', w: 0.6, d: 0.9 }], fanzine: ['fanzine'], badge: ['badge'],
  key: ['key'], brick: ['brick'], theden_crate: ['crate'], industrial_crate: ['crate'], industrial_barrel: ['barrel'], cone: ['cone'], flag: ['flag'], scarf: ['scarf'],
  awayend_shield: ['shield'], laststand_megaphone: ['megaphone'], laststand_flare: ['flare'], ot_rattle: ['rattle'], city_phone: ['phone'],
  city_handbag: ['handbag'], city_heel: ['heel'], city_inflatable: ['hammer'], pub_dart: ['dart'], gumshield: ['gumshield'], life: ['boot'], alshirt: ['shirt'],
};

function fit(obj) {
  obj.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(0.55, 0.62, 1).normalize();
  const d = s.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
  camera.position.copy(s.center).addScaledVector(dir, d);
  camera.near = d / 20; camera.far = d * 4; camera.updateProjectionMatrix();
  camera.lookAt(s.center);
}

export function itemIcon(def) {
  if (!def) return null;
  if (cache.has(def.id)) return cache.get(def.id);
  const spec = ITEM3D[def.id];
  if (!spec || !B[spec[0]]) { cache.set(def.id, null); return null; }
  let out = null;
  try {
    if (!R) setup();
    const obj = B[spec[0]](spec[1] || {});
    scene.add(obj); fit(obj);
    R.render(scene, camera);
    out = document.createElement('canvas'); out.width = out.height = ICON;
    out.getContext('2d').drawImage(R.domElement, 0, 0);
    scene.remove(obj);
    obj.traverse(o => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
  } catch (e) { console.warn('[3d icons]', def.id, e); out = null; }
  cache.set(def.id, out);
  return out;
}
