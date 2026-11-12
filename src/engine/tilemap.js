// Tile map parsed from a level definition.
//
// Level authoring (see docs/LEVELS.md):
//   map: array of equal-length strings; row index = world y, column = world x.
//   legend: { char: entry }, entry fields:
//     floor:  floor style id (defaults to level.defaultFloor)
//     wall:   wall style id -> a solid block on this tile; h: height in units (default 3)
//     solid:  false -> walk-through block (secret passage); also set fake:true to fade it when the player is near
//     prop:   'propType' | { type, ...props } -> a prop placed on this tile
//     item:   'itemType' -> a pickup placed on this tile
//     marker: 'name'     -> records the tile centre in map.markers[name] (array)
//   ' ' (space) is void (impassable, not drawn) unless defined in the legend.

import { hash2 } from './rng.js';

export class TileMap {
  constructor(level) {
    const rows = level.map;
    this.h = rows.length;
    this.w = Math.max(...rows.map(r => r.length));
    const N = this.w * this.h;
    this.floor = new Array(N).fill(null);
    this.wall = new Array(N).fill(null);
    this.markers = {};
    this.propSpawns = [];
    this.itemSpawns = [];
    const legend = level.legend || {};
    const def = level.defaultFloor || 'asphalt';
    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      if (row.length !== this.w) console.warn(`[map] ${level.id}: row ${y} has length ${row.length}, expected ${this.w}`);
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] ?? ' ';
        const e = legend[ch];
        const i = y * this.w + x;
        if (!e) {
          if (ch !== ' ') console.warn(`[map] ${level.id}: unknown legend char '${ch}' at ${x},${y}`);
          continue;
        }
        this.floor[i] = e.floor === undefined ? def : e.floor;
        if (e.wall) {
          this.wall[i] = {
            style: e.wall,
            h: e.h ?? 3,
            solid: e.solid !== false,
            fake: !!e.fake,
            variant: Math.floor(hash2(x, y, 5) * 64),
          };
        }
        if (e.prop) this.propSpawns.push({ ...(typeof e.prop === 'string' ? { type: e.prop } : e.prop), x, y });
        if (e.item) this.itemSpawns.push({ type: e.item, x: x + 0.5, y: y + 0.5 });
        if (e.marker) (this.markers[e.marker] ||= []).push({ x: x + 0.5, y: y + 0.5 });
      }
    }
  }

  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  idx(tx, ty) { return ty * this.w + tx; }
  floorAt(tx, ty) { return this.inBounds(tx, ty) ? this.floor[this.idx(tx, ty)] : null; }
  wallAt(tx, ty) { return this.inBounds(tx, ty) ? this.wall[this.idx(tx, ty)] : null; }

  // Static collision height of a tile (99 = impassable void).
  heightAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return 99;
    const i = this.idx(tx, ty);
    if (!this.floor[i]) return 99;
    const w = this.wall[i];
    if (w && w.solid) return w.h;
    return 0;
  }
}
