// Temporary placeholder level generator (used until a level's real file is authored).
import '../themes/common.js';

export function stubLevel(id, num, name, music) {
  const W = 22, H = 18;
  const rows = [];
  for (let y = 0; y < H; y++) {
    let r = '';
    for (let x = 0; x < W; x++) {
      if (y === 0 || x === 0) r += 'B';
      else if (y === H - 1 || x === W - 1) r += 'b';
      else if (x === 2 && y === 2) r += 'P';
      else if (x === W - 3 && y === H - 3) r += 'E';
      else r += '.';
    }
    rows.push(r);
  }
  return {
    id, num, name, subtitle: 'UNDER CONSTRUCTION', intro: ['THIS LEVEL IS STILL BEING BUILT.'], music,
    ambient: { dark: 0.3, color: '#070a20' }, defaultFloor: 'asphalt',
    legend: { '.': { floor: 'concrete' }, 'B': { wall: 'brick', h: 3 }, 'b': { wall: 'brickDark', h: 1.2 }, 'P': { floor: 'concrete', marker: 'start' }, 'E': { floor: 'concrete', marker: 'exit' } },
    map: rows,
    encounters: [{ id: 'e1', area: { x: 4, y: 1, w: 3, h: 16 }, lockArea: { x: 1, y: 1, w: 20, h: 16 }, waves: [{ enemies: [{ type: 'rival', x: 10.5, y: 8.5 }, { type: 'awayfan', x: 12.5, y: 10.5 }] }] }],
    boss: { type: 'bigtel', x: 15.5, y: 12.5, area: { x: 12, y: 1, w: 9, h: 16 }, lockArea: { x: 1, y: 1, w: 20, h: 16 } },
  };
}
