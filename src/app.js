// Scene manager. Scenes implement { enter?(), exit?(), update(dt), draw(ctx) }.
// Scene modules register factories in app.scenes so they can reference each other without import cycles:
//   app.go(app.scenes.title())   app.go(app.scenes.play(levelIndex))   etc.
import { audio } from './audio/audio.js';

export const app = {
  scene: null,
  scenes: {},
  time: 0,
  fade: 0,          // 0..1 black overlay (scene transition)
  fadeDir: 0,
  next: null,
  go(scene, { fade = true } = {}) {
    if (!fade || !this.scene) { this.swap(scene); return; }
    this.next = scene; this.fadeDir = 1;
  },
  swap(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene;
    if (scene.enter) scene.enter();
  },
  update(dt) {
    this.time += dt;
    if (this.fadeDir === 1) {
      this.fade = Math.min(1, this.fade + dt * 4);
      if (this.fade >= 1) { this.swap(this.next); this.next = null; this.fadeDir = -1; }
      return;
    }
    if (this.fadeDir === -1) { this.fade = Math.max(0, this.fade - dt * 3); if (this.fade <= 0) this.fadeDir = 0; }
    if (this.scene) this.scene.update(dt);
  },
  draw(ctx) {
    if (this.scene) this.scene.draw(ctx);
    if (this.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
  },
  sfx(n) { audio.sfx(n); },
};
