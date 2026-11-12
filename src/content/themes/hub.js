// THEME: THE ANCHOR as the firm's local (phase D hub). Reuses the pub theme; adds the hub's own stations.
// Every id registered here starts with 'hub_'.
//
//   hub_station   invisible USE point: sets world.hubAction = o.action (the hub scene opens that screen)
//   hub_corkboard the tour map on the wall (wall decal on a back-wall tile, 'left' face), o.len tiles wide
//   hub_punchbag  heavy bag hanging in the back room
//   hub_coatrack  coat stand with the firm's jackets (the wardrobe)

import '../themes/pub.js';
import { registerProp } from '../../game/props.js';
import { proj, ellipse, line, thick, isoBox } from '../../engine/gfx.js';
import { drawText } from '../../engine/font.js';
import { shade } from '../../engine/color.js';
import { cylinder, OL } from '../../game/props.js';

const RED = '#c8102e', WHITE = '#f4f1e8';
const px = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

function onFace(ctx, ax, ay, side, u, z, fn) {
  const m = side === 'right' ? proj(ax, ay, 1.01, u, z) : proj(ax, ay, u, 1.01, z);
  ctx.save();
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.transform(1, side === 'right' ? -0.5 : 0.5, 0, 1, 0, 0);
  fn(ctx);
  ctx.restore();
}

registerProp('hub_station', {
  h: 0, solid: false,
  interact: { kind: 'switch', onUse(world, p) { world.hubAction = p.o.action; return true; } },
  draw() {},
});

// The tour map: a cork board with a hand-drawn map of the British Isles + the near continent, pins and string.
registerProp('hub_corkboard', {
  h: 0, solid: false, depthBias: 0.02,
  draw(ctx, ax, ay, p) {
    const len = p.o.len || 2;
    onFace(ctx, ax, ay, 'left', len / 2, p.o.z ?? 1.25, g => {
      const W = len * 22, H = 30;
      px(g, '#2a1a10', -W / 2 - 2, -H / 2 - 2, W + 4, H + 4);
      px(g, '#b8864a', -W / 2, -H / 2, W, H);
      for (let i = 0; i < 40; i++) px(g, '#a07440', -W / 2 + ((i * 37) % W), -H / 2 + ((i * 17) % H), 1, 1);
      // paper map
      px(g, '#e8e0c8', -W / 2 + 3, -H / 2 + 3, W - 6, H - 6);
      px(g, '#9ac0d8', -W / 2 + 4, -H / 2 + 4, W - 8, H - 8);
      // land blobs (fictional sketch)
      px(g, '#7aa060', -W / 2 + 8, -H / 2 + 6, 7, 14); px(g, '#7aa060', -W / 2 + 10, -H / 2 + 19, 9, 4);
      px(g, '#7aa060', -W / 2 + 4, -H / 2 + 10, 3, 6);
      px(g, '#8ab070', -W / 2 + 22, -H / 2 + 8, W - 30, 16); px(g, '#8ab070', -W / 2 + 26, -H / 2 + 5, 10, 5);
      // route string + pins
      const pins = [[-W / 2 + 12, -H / 2 + 12], [-W / 2 + 13, -H / 2 + 20], [-W / 2 + 28, -H / 2 + 14], [-W / 2 + 36, -H / 2 + 18]];
      for (let i = 1; i < pins.length; i++) line(g, pins[i - 1][0], pins[i - 1][1], pins[i][0], pins[i][1], RED);
      pins.forEach(([x, y], i) => { px(g, OL, x - 1, y - 1, 3, 3); px(g, i === 0 ? '#ffe14a' : RED, x, y, 1, 1); });
      drawText(g, p.o.text || 'THE TOUR', 0, -H / 2 - 12, { color: '#ffe14a', align: 'center', outline: '#000' });
    });
  },
});

registerProp('hub_punchbag', {
  h: 1.6,
  draw(ctx, ax, ay, p, t) {
    const b = proj(ax, ay, 0.5, 0.5, 0);
    const sw = Math.round(Math.sin(t * 1.3) * 1.5);
    const top = proj(ax, ay, 0.5, 0.5, 3.1);
    thick(ctx, top.x, top.y, b.x + sw, b.y - 46, 2, OL); line(ctx, top.x, top.y, b.x + sw, b.y - 46, '#9a9aa2');
    ellipse(ctx, b.x, b.y, 8, 4, 'rgba(0,0,0,0.3)');
    cylinder(ctx, b.x + sw, b.y - 12, 7, 3.5, 34, '#7a1a1a');
    ctx.fillStyle = '#e8c040'; ctx.fillRect(b.x + sw - 6, b.y - 32, 12, 2);
    drawText(ctx, 'N.A.', b.x + sw, b.y - 26, { color: WHITE, align: 'center' });
  },
});

registerProp('hub_coatrack', {
  h: 1.2,
  draw(ctx, ax, ay, p) {
    const b = proj(ax, ay, 0.5, 0.5, 0), top = proj(ax, ay, 0.5, 0.5, 2.2);
    ellipse(ctx, b.x, b.y, 7, 3.5, '#2a1a10');
    thick(ctx, b.x, b.y, top.x, top.y, 3, OL); line(ctx, b.x, b.y, top.x, top.y, '#6a4a2a');
    const coats = [['#1d2742', '#c8102e'], ['#c8b48a', '#a01818'], [RED, WHITE]];
    coats.forEach(([c, l], i) => {
      const x = top.x - 7 + i * 6, y = top.y + 4 + (i % 2) * 2;
      ctx.fillStyle = OL; ctx.fillRect(x - 1, y - 1, 7, 16);
      ctx.fillStyle = c; ctx.fillRect(x, y, 5, 14);
      ctx.fillStyle = shade(c, -0.25); ctx.fillRect(x + 3, y, 2, 14);
      ctx.fillStyle = l; ctx.fillRect(x + 2, y, 1, 4);
    });
    // a red & white scarf over the top
    for (let j = 0; j < 10; j++) { ctx.fillStyle = Math.floor(j / 2) % 2 ? WHITE : RED; ctx.fillRect(top.x + 6, top.y + 2 + j, 2, 1); }
  },
});

export { isoBox };
