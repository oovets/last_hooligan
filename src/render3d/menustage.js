// Menu stage: renders the rigged v2 characters (characters2.js) for the 2D menus — the YOUR LAD portrait, the firm
// on the title screen, the character select. One small WebGL renderer draws into its own canvas and the menu blits
// that onto the 2D canvas, so the menus stay plain 2D code:
//
//   r3d.menu.draw(ctx, key, actors, rect, t, opts) -> true if drawn
//     key:    scene id (each key keeps its own characters and camera)
//     actors: [{ look, x, feet, h, anim, phase, yaw, pose?, dark? }] in logical screen px: feet position and body height;
//             pose = an explicit pose-library pose (overrides anim), dark = a black silhouette (locked characters)
//     rect:   logical rect of the 2D canvas the stage covers (also the render viewport)
//     opts:   { light: 'terrace' | 'studio', persp: bool }
//
// Actors are posed from the game's pose library (sampleAnim) through the same layered animator as in the game.
import * as THREE from 'three';
import { CHAR2, Character2, modelFor2 } from './characters2.js';
import { sampleAnim } from '../game/poses.js';

const devScale = ctx => (ctx.getTransform ? ctx.getTransform().a : 2) || 2;

export class MenuStage {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = false;
    this.scenes = new Map();
    this.ready = CHAR2.ready;
    this.size = [0, 0];
  }

  scene(key, light) {
    let s = this.scenes.get(key);
    if (s) return s;
    const scene = new THREE.Scene();
    if (light === 'studio') {
      scene.add(new THREE.HemisphereLight(0xb0b8ff, 0x2a1018, 1.5));
      const key1 = new THREE.DirectionalLight(0xfff0dc, 2.6); key1.position.set(-2, 3, 4); scene.add(key1);
      const rimL = new THREE.DirectionalLight(0xff3a3a, 2.4); rimL.position.set(-4, 2, -3); scene.add(rimL);
      const rimR = new THREE.DirectionalLight(0x8ab0ff, 2.2); rimR.position.set(4, 3, -2); scene.add(rimR);
    } else {
      scene.add(new THREE.HemisphereLight(0x8890d0, 0x401018, 1.3));
      const key1 = new THREE.DirectionalLight(0xfff2e0, 2.2); key1.position.set(1, 4, 5); scene.add(key1);
      const flare = new THREE.DirectionalLight(0xff4a2a, 2.6); flare.position.set(-3, -0.5, -2); scene.add(flare);
      const flood = new THREE.DirectionalLight(0xc8d8ff, 1.8); flood.position.set(3, 5, -4); scene.add(flood);
    }
    s = { scene, actors: [], t: null };
    this.scenes.set(key, s);
    return s;
  }

  // one actor: Character2 + a fake fighter for the animator
  actor(s, i, a) {
    const lk = JSON.stringify(a.look) + (a.dark ? '|dark' : '');
    let A = s.actors[i];
    if (A && A.lk === lk) return A;
    if (A) { s.scene.remove(A.char.group); A.char.dispose(); }
    if (!modelFor2(a.look)) return (s.actors[i] = null);
    const char = new Character2(a.look);
    if (a.dark) for (const m of Object.values(char.mats)) { m.color.set(0x07050a); m.gradientMap = null; m.needsUpdate = true; }
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
    cam.position.set(0, 0, dist);
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
      A.f.state = a.anim === 'guard' ? 'idle' : 'idle';
      A.char.animate(A.f, { time: t }, dt);
    });
    for (let i = actors.length; i < s.actors.length; i++) if (s.actors[i]) { s.scene.remove(s.actors[i].char.group); s.actors[i].char.dispose(); s.actors[i] = null; }
    if (!any) return false;
    this.renderer.clear();
    this.renderer.render(s.scene, cam);
    ctx.drawImage(this.canvas, 0, this.size[1] - H, W, H, rect.x, rect.y, rect.w, rect.h);
    return true;
  }
}
