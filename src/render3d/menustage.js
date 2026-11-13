// Menu stage: renders the rigged v2 characters (characters2.js) for the 2D menus — the YOUR LAD portrait, the firm
// on the title screen, the character select. One small WebGL renderer draws into its own canvas and the menu blits
// that onto the 2D canvas, so the menus stay plain 2D code:
//
//   r3d.menu.draw(ctx, key, actors, rect, t, opts) -> true if drawn
//     key:    scene id (each key keeps its own characters and camera)
//     actors: [{ look, x, feet, h, anim, phase, yaw, pose?, dark?, run?, fight?, sync? }] in logical screen px: feet position and body height;
//             run = running speed (tiles/s): the in-game procedural run cycle, charging the way he faces (title screen)
//             pose = an explicit pose-library pose (overrides anim), dark = a black silhouette (locked characters)
//             fight = fists up: the in-game guard stance (the title screen's mob), sync = in step with the others
//     rect:   logical rect of the 2D canvas the stage covers (also the render viewport)
//     opts:   { light: 'terrace' | 'studio', persp: bool, shadows?: bool (self-shadows; off unless asked for),
//               floor?: bool (the lads cast real shadows on the ground they stand on; the camera tips down a little so the
//               ground is seen. The lads don't shadow themselves) }   persp: perspective camera (rounder faces and feet; use it for
//             single hero shots, keep orthographic for rows of busts)
//
// Lighting: an image-based room environment (soft wrap-around light and real reflections on PBR materials) under a
// warm key light (self-shadows only with opts.shadows), plus two gentle coloured rims.
//
// Actors are posed from the game's pose library (sampleAnim) through the same layered animator as in the game.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHAR2, Character2, modelFor2, heroTemplate } from './characters2.js';
import { sampleAnim } from '../game/poses.js';

const FLOOR_GEO = new THREE.PlaneGeometry(60, 12);          // the floor's shadow catcher (opts.floor)
const devScale = ctx => (ctx.getTransform ? ctx.getTransform().a : 2) || 2;

export class MenuStage {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;      // PCF honours shadow.radius (PCFSoft ignores it)
    // image-based lighting, shared by every menu scene (generated once, no download)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scenes = new Map();
    this.ready = CHAR2.ready;
    this.size = [0, 0];
  }

  scene(key, light) {
    let s = this.scenes.get(key);
    if (s) return s;
    const scene = new THREE.Scene();
    scene.environment = this.env;
    let key1;
    if (light === 'studio') {
      scene.environmentIntensity = 0.32;
      scene.add(new THREE.HemisphereLight(0xc8ccff, 0x2a1a20, 0.35));
      key1 = new THREE.DirectionalLight(0xfff0dc, 2.2); key1.position.set(-2, 3, 4);
      const rimL = new THREE.DirectionalLight(0xff9a8a, 1.3); rimL.position.set(-4, 2, -3); scene.add(rimL);
      const rimR = new THREE.DirectionalLight(0xbcd0ff, 1.2); rimR.position.set(4, 3, -2); scene.add(rimR);
    } else {
      scene.environmentIntensity = 0.3;
      scene.add(new THREE.HemisphereLight(0x8890d0, 0x401018, 0.7));
      key1 = new THREE.DirectionalLight(0xfff2e0, 2.0); key1.position.set(1, 4, 5);
      const flare = new THREE.DirectionalLight(0xff6a3a, 1.8); flare.position.set(-3, -0.5, -2); scene.add(flare);
      const flood = new THREE.DirectionalLight(0xc8d8ff, 1.4); flood.position.set(3, 5, -4); scene.add(flood);
    }
    // the key light shadows the characters onto themselves; its shadow box is fitted to the actors every draw
    key1.castShadow = true;
    key1.shadow.mapSize.set(1024, 1024);
    key1.shadow.bias = -0.0004; key1.shadow.normalBias = 0.02; key1.shadow.radius = 5;   // soft edges
    scene.add(key1); scene.add(key1.target);
    s = { scene, actors: [], t: null, key: key1, keyDir: key1.position.clone().normalize() };
    this.scenes.set(key, s);
    return s;
  }

  // one actor: Character2 + a fake fighter for the animator
  actor(s, i, a) {
    // menus show the realistic hero model when the character has one; the key changes when it finishes loading
    const hero = a.look && a.look.hero && !a.dark ? heroTemplate(a.look.hero) : null;
    const lk = JSON.stringify(a.look) + (a.dark ? '|dark' : '') + (hero ? '|' + hero : '');
    let A = s.actors[i];
    if (A && A.lk === lk) return A;
    if (A) { s.scene.remove(A.char.group); A.char.dispose(); }
    if (!modelFor2(a.look)) return (s.actors[i] = null);
    const char = new Character2(a.look, { hero: !!hero });
    if (a.dark) {
      // locked characters: a flat black silhouette (unlit, so the room environment can't put sheen on it). Keep the map
      // only for its alpha (cut-out brows / hair cards keep their shape); black colour x map stays black.
      const dark = new Map();
      char.group.traverse(o => {
        if (!o.isMesh) return;
        let d = dark.get(o.material);
        if (!d) {
          const m = o.material;
          d = new THREE.MeshBasicMaterial({ color: 0x07050a, map: m.alphaTest > 0 || m.transparent ? m.map : null, alphaTest: m.alphaTest, transparent: m.transparent, side: m.side });
          dark.set(m, d); char.mats['dark|' + dark.size] = d;
        }
        o.material = d;
      });
    }
    char.group.traverse(o => { if (o.isMesh) { o.castShadow = !a.dark; o.receiveShadow = !a.dark; } });
    s.scene.add(char.group);
    char.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(char.inner);
    const f = { state: 'idle', x: 0, y: 0, fx: 0, fy: 1, combat: false, isPlayer: false, controller: null, alive: true, onGround: true, id: i * 7, look: a.look, anim: 'idle', t: 0 };
    f.getPose = () => f.pose || sampleAnim(f.anim, f.t);
    A = s.actors[i] = { char, f, lk, H: Math.max(0.5, box.max.y - box.min.y) };
    return A;
  }

  draw(ctx, key, actors, rect, t, opts = {}) {
    if (!this.ready) return false;
    const S = devScale(ctx);
    const W = Math.max(2, Math.round(rect.w * S)), H = Math.max(2, Math.round(rect.h * S));
    // the drawing buffer only grows; each draw renders into its bottom-left W x H viewport (several stages per frame
    // without reallocating the buffer)
    if (this.size[0] < W || this.size[1] < H) { this.size = [Math.max(W, this.size[0]), Math.max(H, this.size[1])]; this.renderer.setSize(this.size[0], this.size[1], false); }
    this.renderer.setViewport(0, 0, W, H);
    const s = this.scene(key, opts.light);
    const dt = s.t === null ? 1 / 60 : Math.max(0, Math.min(0.1, t - s.t));
    s.t = t;
    // camera: 1 world unit = PPU logical px at the actors' plane
    const PPU = 40, persp = !!opts.persp;
    const cw = rect.w / PPU, ch = rect.h / PPU;
    let cam = s.cam;
    if (!cam || cam.isPerspectiveCamera !== persp) {
      cam = s.cam = persp ? new THREE.PerspectiveCamera(24, cw / ch, 0.1, 200) : new THREE.OrthographicCamera(-cw / 2, cw / 2, ch / 2, -ch / 2, 0.1, 200);
    }
    const dist = persp ? (ch / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) : 30;
    // with a floor the camera looks down a little (ELEV) so the ground plane - and the shadows on it - can be seen
    const elev = opts.floor ? 0.24 : 0;
    cam.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    if (!persp) { cam.left = -cw / 2; cam.right = cw / 2; cam.top = ch / 2; cam.bottom = -ch / 2; }
    else cam.aspect = cw / ch;
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    let any = false;
    actors.forEach((a, i) => {
      const A = this.actor(s, i, a);
      if (!A) return;
      any = true;
      const g = A.char.group;
      // logical -> world (z = 0 plane, the depth order by feet y)
      g.position.set((a.x - rect.x - rect.w / 2) / PPU, (rect.y + rect.h / 2 - a.feet) / PPU, (a.feet - rect.y) / rect.h * 0.8);
      g.scale.setScalar((a.h / PPU) / A.H);
      A.f.anim = a.anim || 'idle'; A.f.t = t + (a.phase || 0); A.f.pose = a.pose || null;
      A.f.fx = Math.sin(a.yaw || 0); A.f.fy = Math.cos(a.yaw || 0);
      A.f.combat = !!a.fight;                                          // fight = fists up (the in-game guard stance)
      A.f.id = a.sync ? 0 : i * 7;                                     // sync = everyone bounces in step
      if (a.run) { A.f.state = 'run'; A.f.y += a.run * dt; }           // treadmill: the animator's run cycle follows distance
      else A.f.state = (a.pose || (a.anim && a.anim !== 'idle' && a.anim !== 'guard')) ? 'menu' : 'idle';   // poses/anims go through the pose library
      A.char.animate(A.f, { time: t }, dt);
    });
    for (let i = actors.length; i < s.actors.length; i++) if (s.actors[i]) { const A = s.actors[i]; s.scene.remove(A.char.group); A.char.dispose(); s.actors[i] = null; }
    if (!any) return false;
    // self-shadows only for single-character hero shots (portrait, character select, wardrobe): rows of busts and the
    // title-screen firm skip the shadow pass
    const shadows = !!opts.shadows;                       // off by default (owner preference: no shadows on the lads)
    s.key.castShadow = shadows || !!opts.floor;
    // the floor: one big shadow catcher (invisible apart from the shadows) at the lads' feet
    if (opts.floor && !s.floor) {
      s.floor = new THREE.Mesh(FLOOR_GEO, new THREE.ShadowMaterial({ opacity: 0.42 }));
      s.floor.rotation.x = -Math.PI / 2; s.floor.receiveShadow = true;
      s.scene.add(s.floor);
    }
    if (s.floor) {
      s.floor.visible = !!opts.floor;
      const live = s.actors.filter(Boolean);
      if (live.length) {
        const fy = Math.min(...live.map(A => A.char.group.position.y));
        const cz = live.reduce((a, A) => a + A.char.group.position.z, 0) / live.length;
        s.floor.position.set(0, fy + 0.004, cz);
      }
      for (const A of live) A.char.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    }
    // fit the key light's shadow camera round the actors (world units are small: a lad is ~4 units tall here)
    s.scene.updateMatrixWorld();
    const box = new THREE.Box3();
    if (shadows || opts.floor) for (const A of s.actors) if (A) box.expandByObject(A.char.inner);
    if (opts.floor && !box.isEmpty()) box.expandByScalar(1.5);          // room for the shadows on the floor
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.6 + 0.5;
      const L = s.key;
      L.target.position.copy(c); L.position.copy(c).addScaledVector(s.keyDir, r * 2);   // authored direction, re-centred
      const sc = L.shadow.camera;
      sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.1; sc.far = r * 4;
      sc.updateProjectionMatrix(); L.target.updateMatrixWorld();
    }
    this.renderer.clear();
    this.renderer.render(s.scene, cam);
    ctx.drawImage(this.canvas, 0, this.size[1] - H, W, H, rect.x, rect.y, rect.w, rect.h);
    return true;
  }
}
