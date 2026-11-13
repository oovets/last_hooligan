// Renderer registry. main.js fills r3d.renderer when the 3D renderer is enabled (?renderer=3d or settings.renderer).
// Kept free of Three.js imports so the 2D game never loads it.
export const r3d = { renderer: null, menu: null, itemIcon: null };   // menu: render3d/menustage.js (3D characters in the menus); itemIcon: render3d/itemicons.js
