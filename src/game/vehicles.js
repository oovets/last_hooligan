// Full-scale vehicles: sizes, collision extents and Blender-sprite drawing for traffic.
// Sprites come from scripts/blender/env_vehicles.py (prop ids car, city_taxi, laststand_policevan, bus; dir x|y, rev 0|1).
import { envProp } from '../engine/envsprites.js';
import { toScreen } from '../engine/iso.js';
// Vehicle sizes in tiles (L along, W across, H height units) and collision half-extents.
export const VEHICLE_SIZE = {
  car: { L: 5, W: 2, H: 1.6, hl: 2.4, hw: 0.95, sprite: 'car' },
  taxi: { L: 5, W: 2, H: 1.6, hl: 2.4, hw: 0.95, sprite: 'city_taxi' },
  van: { L: 5, W: 2, H: 2.2, hl: 2.4, hw: 0.95, sprite: 'laststand_policevan' },
  bus: { L: 9, W: 2, H: 2.9, hl: 4.4, hw: 1.0, sprite: 'bus' },
};

// Draw a moving vehicle with its Blender sprite, centred on (v.x, v.y). Returns false if no sprite is available.
export function drawVehicleSprite(ctx, v, style = 'car') {
  const sz = VEHICLE_SIZE[style] || VEHICLE_SIZE.car;
  const alongX = Math.abs(v.dx) > Math.abs(v.dy);
  const rev = alongX ? v.dx < 0 : v.dy < 0;
  const spr = envProp(sz.sprite, { color: v.color, dir: alongX ? 'x' : 'y', rev });
  if (!spr || (style === 'car' && spr.color && String(spr.color).toLowerCase() !== String(v.color).toLowerCase())) return false;
  const W = alongX ? sz.L : sz.W, D = alongX ? sz.W : sz.L;
  const a = toScreen(v.x - W / 2, v.y - D / 2, 0);
  ctx.drawImage(spr.img, Math.round(a.x) - spr.ax / 2, Math.round(a.y) - spr.ay / 2, spr.img.width / 2, spr.img.height / 2);
  return true;
}
