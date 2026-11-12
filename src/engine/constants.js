// Core engine constants. All world positions are in TILE units (floats).
// Screen projection is 2:1 dimetric ("isometric").

export const VIEW_W = 640;          // internal render resolution (pixel art)
export const VIEW_H = 360;
export const TILE_W = 32;           // diamond width in px
export const TILE_H = 16;           // diamond height in px
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
export const Z_PX = 20;             // screen px per 1 height unit (1 unit ~ a "block" storey)

export const STEP = 1 / 60;         // fixed simulation step (s)
export const GRAVITY = 24;          // height units / s^2
export const STEP_UP = 0.35;        // max height an entity can walk up onto without jumping
