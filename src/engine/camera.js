import { VIEW_W, VIEW_H } from './constants.js';
import { toScreen } from './iso.js';

// Camera works in projected screen space. (x,y) is the screen point shown at the view centre.
export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.shakeT = 0; this.shakeMag = 0;
    this.ox = 0; this.oy = 0; // current shake offset
    this.bounds = null;        // {minX,minY,maxX,maxY} in screen px
    this.zoom = 1;
  }

  snapTo(wx, wy, wz = 0) {
    const s = toScreen(wx, wy, wz);
    this.x = s.x; this.y = s.y;
    this.clamp();
  }

  follow(wx, wy, wz, dt, lookX = 0, lookY = 0) {
    const s = toScreen(wx, wy, wz * 0.5);
    const tx = s.x + lookX, ty = s.y - 18 + lookY;
    const k = 1 - Math.pow(0.0025, dt);   // smooth, frame-rate independent
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.clamp();
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.min(1, this.shakeT * 6);
      this.ox = (Math.random() * 2 - 1) * m;
      this.oy = (Math.random() * 2 - 1) * m;
    } else { this.ox = 0; this.oy = 0; }
    if (this.kx || this.ky) {
      this.ox += this.kx; this.oy += this.ky;
      const k = Math.pow(0.0005, dt);
      this.kx *= k; this.ky *= k;
      if (Math.abs(this.kx) < 0.05) this.kx = 0;
      if (Math.abs(this.ky) < 0.05) this.ky = 0;
    }
  }

  clamp() {
    const b = this.bounds;
    if (!b) return;
    const hw = VIEW_W / 2, hh = VIEW_H / 2;
    this.x = b.maxX - b.minX < VIEW_W ? (b.minX + b.maxX) / 2 : Math.max(b.minX + hw, Math.min(b.maxX - hw, this.x));
    this.y = b.maxY - b.minY < VIEW_H ? (b.minY + b.maxY) / 2 : Math.max(b.minY + hh, Math.min(b.maxY - hh, this.y));
  }

  // short directional nudge (hit impact); decays quickly
  kick(dx, dy) { this.kx = (this.kx || 0) + dx; this.ky = (this.ky || 0) + dy; }

  shake(mag = 3, t = 0.25) {
    if (mag >= this.shakeMag || this.shakeT <= 0) { this.shakeMag = mag; this.shakeT = t; }
  }

  // Top-left translation to apply to world drawing.
  get tx() { return Math.round(VIEW_W / 2 - this.x + this.ox); }
  get ty() { return Math.round(VIEW_H / 2 - this.y + this.oy); }
}
