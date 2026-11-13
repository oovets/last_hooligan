// TOUR ARENA — OLD TRAFFORD (Manchester United, the Red Devils). Stretford, Manchester M16. Danger 5.
// A cold, wet, floodlit night. The home firm: THE MEN IN BLACK, with the old Red Army all around them.
//
// Route: the coach gets diverted -> the BRIDGEWATER CANAL TOWPATH (ambush off the loading bridge, then from behind;
//        a narrowboat in the lock to jump onto; loose bricks in the embankment hide a pocket "under the arches")
//        -> the RAILWAY HALT by the ground (police cordon with dogs that bite anyone; first Men in Black come over the
//        footbridge) -> up and over the FOOTBRIDGE -> SIR MATT BUSBY WAY (burger vans, programme huts, touts nicking
//        your cash, police vans down the road, the Red Army in numbers) -> the TURNSTILES of the Stretford End where
//        THE MEN IN BLACK close a pincer from both sides (keep the firm tight: BACK TO ME / HOLD) -> through the
//        turnstiles: concourse and the AWAY CORNER (the home end opens the segregation gate: hold it) -> down the
//        TUNNEL, across the road to the SOUTH STAND FORECOURT: BOSS — DES "THE FUNERAL DIRECTOR" GRIMSHAW
//        -> out through the gate on the Trafford Park side.
// The map is built from rectangle fills below (62 x 64). Rows = y, columns = x.
import '../../themes/common.js';
import './theme.js';
import './boss.js';
import './music.js';
import { OT, segments, dogLunging } from './theme.js';
import { mibState, lightsOn } from './boss.js';
import { audio } from '../../../audio/audio.js';
import { input } from '../../../engine/input.js';

const { RED, WHITE, BLACK, GOLD } = OT;
const STAFF = 'ot_staff';            // key nobody carries: these gates are opened by the level script
const BOSS_ARENA = { x: 14, y: 44, w: 33.9, h: 18.9 };
const hint = a => { try { return input.hint(a) || ''; } catch (e) { return ''; } };

// ------------------------------------------------------------------ map
const W = 62, H = 64;
const g = Array.from({ length: H }, () => Array(W).fill(' '));
const fill = (ch, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
// A: the towpath
fill('U', 0, 0, 61, 0);                    // Trafford Park units across the water
fill('w', 1, 1, 47, 2);                    // the Bridgewater Canal
fill('r', 1, 3, 47, 3);                    // towpath railings
fill('L', 19, 1, 19, 3); fill('L', 25, 1, 25, 3);   // the lock gates (boat sits between them)
fill('k', 20, 3, 24, 3);                   // mooring coping (no railing)
fill('D', 33, 1, 35, 3);                   // loading bridge deck (jumpable)
fill('A', 32, 1, 32, 3); fill('A', 36, 1, 36, 3);   // its brick piers
fill('.', 1, 4, 47, 8);
fill('v', 1, 8, 31, 8);
fill('A', 0, 0, 0, 9);                     // road bridge abutment at the west end
fill('E', 1, 9, 35, 9);                    // railway embankment
fill('e', 4, 9, 5, 9);                     // loose bricks (secret)
fill('.', 36, 9, 47, 10);
fill('U', 48, 0, 61, 10);
// stadium dead zone behind the stand + the pocket under the arches
fill('E', 0, 10, 35, 11);
fill('a', 3, 10, 6, 11);
// B: the railway halt
fill('W', 35, 10, 35, 29);                 // side of the Stretford End
fill('P', 36, 11, 58, 18);
fill('_', 36, 19, 58, 19);
fill('f', 36, 20, 58, 20); fill('T', 36, 21, 58, 22); fill('f', 36, 23, 58, 23);
fill(',', 36, 24, 58, 30);
fill('E', 59, 11, 61, 30);
fill('1', 44, 16, 45, 16); fill('2', 44, 17, 45, 17); fill('3', 44, 18, 45, 18); fill('4', 44, 19, 45, 19);
fill('B', 44, 20, 45, 23);
fill('4', 44, 24, 45, 24); fill('3', 44, 25, 45, 25); fill('2', 44, 26, 45, 26); fill('1', 44, 27, 45, 27);
fill('b', 43, 19, 43, 24); fill('b', 46, 19, 46, 24);   // footbridge parapets
// D: inside the Stretford End (north of the street)
fill('X', 0, 12, 35, 12);                  // back of the stand: rows of red seats
fill('X', 0, 13, 0, 21);
fill('t', 1, 13, 17, 21);                  // the away corner
fill('F', 18, 13, 18, 21);                 // segregation fence
fill('t', 18, 17, 18, 18);                 // (its gate)
fill('t', 19, 13, 34, 21);                 // home section
for (let y = 13; y <= 20; y++) for (let x = 21; x <= 34; x++) if ((x + y) % 3 !== 0) g[y][x] = (x * 7 + y * 3) % 11 === 0 ? 'g' : (x + y) % 2 ? 'h' : 'j';
fill('l', 1, 22, 17, 22); fill('c', 5, 22, 6, 22); fill('c', 12, 22, 13, 22);
fill('F', 18, 22, 28, 22);
fill('Z', 29, 22, 34, 22);
fill('W', 0, 22, 0, 29);
fill('c', 1, 23, 28, 29);                  // concourse
fill('Z', 29, 23, 29, 29); fill('u', 29, 26, 29, 27);   // tunnel door
fill('u', 30, 23, 34, 29);                 // the tunnel
fill('S', 0, 30, 35, 30);                  // the Stretford End facade
for (const x of [8, 10, 12, 14]) g[30][x] = ',';      // turnstiles
fill('u', 31, 30, 32, 30);                 // tunnel mouth onto the street
// C: Sir Matt Busby Way
fill('H', 0, 31, 0, 43);
fill(',', 1, 31, 60, 33); fill('R', 1, 34, 60, 39); fill(',', 1, 40, 60, 42);
fill('E', 61, 31, 61, 43);
fill('p', 1, 43, 60, 43); fill(',', 31, 43, 32, 43);  // forecourt palisade + its gate
// E: the South Stand forecourt (boss)
fill('U', 13, 44, 13, 63);
fill('y', 14, 44, 47, 62);
fill('E', 48, 44, 48, 63); fill('y', 48, 53, 48, 54);  // exit gate to Trafford Park
fill('E', 13, 63, 48, 63);
const MAP = g.map(r => r.join(''));

// ------------------------------------------------------------------ helpers
function openTagged(world, tag) {
  for (const p of world.props) if (p.o.tag === tag) p.open = true;
  world.rebuildPropGrid();
}
function chant(world) { if (audio.chant) audio.chant(); }
const gates = (xs, y, dir, tag, msg, extra = {}) => xs.map(x => ({ type: 'gate', x, y, dir, key: STAFF, tag, lockedMsg: msg, ...extra }));
const gatesY = (x, ys, tag, msg, extra = {}) => ys.map(y => ({ type: 'gate', x, y, dir: 'y', key: STAFF, tag, lockedMsg: msg, ...extra }));

export default {
  id: 'oldtrafford',
  num: 12,
  tour: true,
  name: 'OLD TRAFFORD',
  subtitle: 'TUESDAY. 19:20. COLD, WET, FLOODLIT.',
  intro: [
    'AWAY AT THE THEATRE OF DREAMS.',
    'THE COACH GOT DIVERTED, SO IT\'S THE TOWPATH.',
    'THE RED ARMY IS EVERYWHERE TONIGHT,',
    'AND THE MEN IN BLACK ARE WAITING IN THE SHADOWS.',
    'STAY TIGHT. NOBODY WANDERS OFF.',
  ],
  music: 'oldtrafford',
  crowd: 0.8,
  weather: 'rain',
  ambient: { dark: 0.55, color: '#060a1e', playerLight: 3.2 },
  bg: '#04050c',
  fog: 'rgba(120,140,200,0.05)',
  extraTokens: 1,
  defaultFloor: 'ot_towpath',
  start: { x: 3.5, y: 6.5 },
  startFacing: { x: 1, y: 0 },
  legend: {
    '.': { floor: 'ot_towpath' },
    'v': { floor: 'ot_verge' },
    'k': { floor: 'ot_coping' },
    'w': { floor: 'ot_canal' },
    'U': { floor: 'ot_yard', wall: 'ot_unit', h: 4 },
    'r': { floor: 'ot_coping', wall: 'ot_towRail', h: 1.6 },
    'L': { floor: 'ot_canal', wall: 'ot_lockGate', h: 2.6 },
    'A': { floor: 'ot_towpath', wall: 'ot_bridge', h: 3.5 },
    'D': { floor: 'ot_canal', wall: 'ot_bridgeDeck', h: 1.2 },
    'E': { floor: 'ot_towpath', wall: 'ot_embank', h: 1.6 },
    'e': { floor: 'ot_towpath', wall: 'ot_embank', h: 1.6, solid: false, fake: true },
    'a': { floor: 'ot_yard' },
    'P': { floor: 'ot_platform' },
    '_': { floor: 'ot_platEdge' },
    'T': { floor: 'ot_track' },
    'f': { floor: 'ot_track', wall: 'ot_palisade', h: 1.6 },
    '1': { floor: 'ot_platform', wall: 'ot_steps', h: 0.3 },
    '2': { floor: 'ot_platform', wall: 'ot_steps', h: 0.6 },
    '3': { floor: 'ot_platform', wall: 'ot_steps', h: 0.9 },
    '4': { floor: 'ot_platform', wall: 'ot_steps', h: 1.2 },
    'B': { floor: 'ot_track', wall: 'ot_footbridge', h: 1.5 },
    'b': { floor: 'ot_track', wall: 'ot_footbridge', h: 3 },
    ',': { floor: 'ot_paviour' },
    'R': { floor: 'ot_road' },
    'H': { floor: 'ot_paviour', wall: 'ot_terraced', h: 4.5 },
    'S': { floor: 'ot_paviour', wall: 'ot_standFacade', h: 3 },
    'W': { floor: 'ot_concourse', wall: 'ot_standWall', h: 3 },
    'X': { floor: 'ot_terrace', wall: 'ot_seatsWall', h: 3.5 },
    'F': { floor: 'ot_terrace', wall: 'ot_segFence', h: 1.6 },
    'l': { floor: 'ot_concourse', wall: 'ot_standWall', h: 1.2 },
    't': { floor: 'ot_terrace' },
    'h': { floor: 'ot_terrace', prop: { type: 'ot_fans' } },
    'j': { floor: 'ot_terrace', prop: { type: 'ot_fans', flip: true } },
    'g': { floor: 'ot_terrace', prop: { type: 'ot_fans', flag: true } },
    'c': { floor: 'ot_concourse' },
    'Z': { floor: 'ot_tunnel', wall: 'ot_tunnelWall', h: 2.4 },
    'u': { floor: 'ot_tunnel' },
    'p': { floor: 'ot_paviour', wall: 'ot_palisade', h: 1.6 },
    'y': { floor: 'ot_yard' },
  },
  map: MAP,
  items: [
    // ---- the five scarves
    { type: 'scarf', x: 22.5, y: 1.5, z: 1.0 },                // on the narrowboat's roof (jump on)
    { type: 'scarf', x: 34.5, y: 1.5, z: 1.2 },                // on the loading bridge (jump up)
    { type: 'scarf', x: 37.5, y: 11.5 },                       // platform end at the halt
    { type: 'scarf', x: 48.5, y: 32.5 },                       // under the programme hut (break it)
    { type: 'scarf', x: 1.5, y: 13.5 },                        // top corner of the away pen
    // ---- the pin badge: under the arches behind the loose bricks
    { type: 'badge', x: 4.5, y: 10.5 },
    { type: 'cash20', x: 5.5, y: 11.5 },
    { type: 'fanzine', x: 6.5, y: 5.5, title: 'RED ISSUE OF OUR OWN #9: OLD TRAFFORD', text: 'THE MEN IN BLACK DON\'T BRAWL, THEY WORK. WHEN ONE SHOUTS NOW THEY ALL FREEZE, GUARDS UP, THEN ALL GO FOR WHOEVER IS ON HIS OWN. SO NOBODY IS ON HIS OWN. THEIR MAIN MAN, DES GRIMSHAW, THE FUNERAL DIRECTOR, PUNISHES BUTTON BASHERS WITH A HAMMERFIST. AND HE LIKES THE DARK. THE FUSE BOX ON THE FORECOURT WALL IS YOUR FRIEND.' },
    // ---- health between fights
    { type: 'ot_tea', x: 13.5, y: 7.5 },
    { type: 'ot_pasty', x: 41.5, y: 9.5 },
    { type: 'pint', x: 38.5, y: 17.5 },
    { type: 'ot_tea', x: 40.5, y: 27.5 },
    { type: 'pie', x: 49.5, y: 40.5 },
    { type: 'ot_pasty', x: 24.5, y: 33.5 },
    { type: 'ot_tea', x: 11.5, y: 28.5 },
    { type: 'kebab', x: 9.5, y: 19.5 },
    { type: 'pint', x: 32.5, y: 27.5 },
    { type: 'energy', x: 30.5, y: 41.5 },
    { type: 'ot_tea', x: 31.5, y: 45.5 },
    // ---- weapons
    { type: 'bottle', x: 11.5, y: 5.5 },
    { type: 'ot_rattle', x: 40.5, y: 13.5 },
    { type: 'umbrella', x: 47.5, y: 29.5 },
    { type: 'ot_programme', x: 45.5, y: 33.5 },
    { type: 'pipe', x: 3.5, y: 41.5 },
    { type: 'bottle', x: 22.5, y: 27.5 },
    { type: 'chair', x: 17.5, y: 48.5 },
    // ---- loose cash (the touts will go for it)
    { type: 'coin', x: 20.5, y: 6.5 }, { type: 'coin', x: 24.5, y: 5.5 }, { type: 'cash5', x: 28.5, y: 7.5 },
    { type: 'coin', x: 46.5, y: 13.5 }, { type: 'cash5', x: 50.5, y: 17.5 },
    { type: 'cash5', x: 35.5, y: 36.5 }, { type: 'coin', x: 40.5, y: 38.5 }, { type: 'coin', x: 45.5, y: 35.5 }, { type: 'cash5', x: 30.5, y: 38.5 },
    { type: 'coin', x: 8.5, y: 25.5 }, { type: 'cash5', x: 12.5, y: 17.5 },
  ],
  props: [
    // ================= towpath
    { type: 'ot_narrowboat', x: 20, y: 1 },
    { type: 'lamp', x: 9, y: 4 }, { type: 'lamp', x: 29, y: 4, flicker: true }, { type: 'lamp', x: 42, y: 4 },
    { type: 'ot_lifebuoy', x: 16, y: 4 }, { type: 'ot_lifebuoy', x: 39, y: 4 },
    { type: 'ot_milepost', x: 26, y: 6, text: 'B6' }, { type: 'ot_milepost', x: 45, y: 6, text: 'B7' },
    { type: 'bin', x: 2, y: 4 }, { type: 'trolley', x: 31, y: 7 },
    ...segments({ type: 'ot_sign', x: 3, y: 0, len: 6, z: 2.6, height: 0.7, text: 'TRAFFORD PARK', color: '#ffffff', bg: '#1a2a4a' }),
    ...segments({ type: 'ot_sign', x: 38, y: 0, len: 4, z: 2.4, height: 0.6, text: 'UNIT 7', color: GOLD, bg: '#2a2a2e' }),
    { type: 'graffiti', x: 12, y: 0, side: 'left', z: 1.0, text: 'MUFC', color: '#e8402c' },
    { type: 'graffiti', x: 17, y: 9, side: 'left', z: 0.8, text: 'RED ARMY', color: '#e8402c' },
    { type: 'graffiti', x: 5, y: 9, side: 'left', z: 0.8, text: 'MIND THE GAP', color: '#8a8a8a' },
    { type: 'graffiti', x: 26, y: 9, side: 'left', z: 0.8, text: 'M.I.B.', color: '#f4f4f0' },
    { type: 'graffiti', x: 0, y: 6, side: 'right', z: 1.4, text: 'STRETFORD', color: '#e8402c' },
    // ================= railway halt
    ...segments({ type: 'ot_sign', x: 49, y: 10, len: 7, z: 2.2, height: 0.75, text: 'UNITED FOOTBALL GROUND', color: BLACK, bg: '#f0ece0' }),
    ...segments({ type: 'ot_sign', x: 35, y: 13, side: 'right', len: 5, z: 1.7, height: 0.8, text: 'STRETFORD END', color: '#ffffff', bg: RED, crest: true }),
    ...segments({ type: 'ot_banner', x: 35, y: 21, side: 'right', len: 6, z: 1.2, height: 0.9, text: 'RED ARMY', a: RED, b: BLACK, crest: true }),
    { type: 'bench', x: 38, y: 12 }, { type: 'bench', x: 48, y: 12 },
    { type: 'lamp', x: 42, y: 11 }, { type: 'lamp', x: 51, y: 11 },
    { type: 'ot_policeVan', x: 56, y: 12 },
    ...[11, 12, 14, 15, 17, 18].map((y, i) => ({ type: 'ot_copper', x: 55, y, flip: true })),
    { type: 'ot_policeDog', x: 54, y: 13, phase: 0 },
    { type: 'ot_policeDog', x: 54, y: 16, phase: 2.1 },
    { type: 'wheeliebin', x: 37, y: 24 }, { type: 'lamp', x: 40, y: 24 }, { type: 'lamp', x: 52, y: 24 },
    ...segments({ type: 'ot_sign', x: 47, y: 23, len: 3, z: 0.25, height: 0.6, text: 'NO ENTRY', color: '#ffffff', bg: '#7a1010' }),
    // ================= Sir Matt Busby Way
    ...segments({ type: 'ot_sign', x: 2, y: 30, len: 5, z: 2.0, height: 0.7, text: 'STRETFORD END', color: '#ffffff', bg: RED, crest: true }),
    ...segments({ type: 'ot_sign', x: 16, y: 30, len: 12, z: 2.05, height: 0.75, text: 'MANCHESTER UNITED FOOTBALL CLUB', color: GOLD, bg: '#1a1a1e' }),
    ...segments({ type: 'ot_sign', x: 8, y: 30, len: 7, z: 2.05, height: 0.55, text: 'TURNSTILES 1 - 4', color: '#ffffff', bg: '#1a1a1e' }),
    ...segments({ type: 'ot_sign', x: 30, y: 30, len: 4, z: 2.05, height: 0.55, text: 'EXIT TUNNEL', color: '#ffffff', bg: '#1a6a3a' }),
    { type: 'ot_turnstile', x: 8, y: 30, n: 1 }, { type: 'ot_turnstile', x: 10, y: 30, n: 2 }, { type: 'ot_turnstile', x: 12, y: 30, n: 3 }, { type: 'ot_turnstile', x: 14, y: 30, n: 4 },
    ...gates([8, 10, 12, 14], 30, 'x', 'turnstiles', 'TURNSTILES SHUT. SORT THE MEN IN BLACK OUT FIRST.'),
    ...gates([31, 32], 30, 'x', 'tunnelOut', 'THE TUNNEL IS SHUT FROM THIS SIDE.'),
    { type: 'ot_clock', x: 34, y: 31 },
    { type: 'ot_scarfStall', x: 18, y: 31, text: 'SCARVES £3' },
    { type: 'ot_progHut', x: 27, y: 31 },
    { type: 'ot_progHut', x: 48, y: 32, secret: 'proghut' },
    { type: 'ot_burgerVan', x: 38, y: 41, text: 'BURGERS' },
    { type: 'ot_burgerVan', x: 52, y: 41, text: 'HOT DOGS', color: '#d8d0b8' },
    { type: 'ot_policeVan', x: 7, y: 41 },
    { type: 'lamp', x: 5, y: 31 }, { type: 'lamp', x: 23, y: 31 }, { type: 'lamp', x: 40, y: 31 }, { type: 'lamp', x: 56, y: 31 },
    { type: 'lamp', x: 15, y: 40 }, { type: 'lamp', x: 30, y: 40 }, { type: 'lamp', x: 46, y: 40 },
    { type: 'bin', x: 2, y: 31 }, { type: 'bin', x: 59, y: 33 }, { type: 'barrier', x: 21, y: 40 }, { type: 'barrier', x: 22, y: 40 },
    { type: 'graffiti', x: 0, y: 36, side: 'right', z: 1.6, text: 'U-N-I-T-E-D', color: '#e8402c' },
    // ================= concourse + away corner
    { type: 'ot_kiosk', x: 2, y: 23, text: 'PIES', text2: 'TEA 50P' },
    { type: 'ot_kiosk', x: 23, y: 23, text: 'BAR', text2: 'NO REFUNDS' },
    { type: 'ot_pillar', x: 9, y: 26 }, { type: 'ot_pillar', x: 19, y: 26, text: 'K' },
    { type: 'bin', x: 1, y: 29 }, { type: 'bin', x: 27, y: 29 },
    ...segments({ type: 'ot_sign', x: 0, y: 24, side: 'right', len: 3, z: 1.2, height: 0.6, text: 'AWAY FANS', color: BLACK, bg: GOLD }),
    ...[3, 5, 7, 9, 11, 13, 15].map(x => ({ type: 'ot_seats', x, y: 13 })),
    ...[4, 5, 10, 11, 15, 16].map(x => ({ type: 'ot_crushBarrier', x, y: 16 })),
    ...[2, 3, 7, 8, 13, 14].map(x => ({ type: 'ot_crushBarrier', x, y: 19 })),
    ...segments({ type: 'ot_banner', x: 21, y: 12, len: 6, z: 1.8, height: 1.0, text: 'THEATRE OF DREAMS', a: RED, b: WHITE, color: WHITE, crest: true }),
    ...segments({ type: 'ot_banner', x: 28, y: 12, len: 5, z: 1.8, height: 1.0, text: 'RED ARMY', a: BLACK, b: RED, color: RED }),
    ...segments({ type: 'ot_banner', x: 3, y: 12, len: 6, z: 1.9, height: 0.8, text: 'AWAY END', a: '#3a3a42', b: GOLD, color: GOLD }),
    ...segments({ type: 'ot_banner', x: 0, y: 14, side: 'right', len: 5, z: 1.6, height: 1.0, text: 'GLORY GLORY', a: RED, b: WHITE, color: WHITE, crest: true }),
    ...gatesY(18, [17, 18], 'segGate', 'THE SEGREGATION GATE. LOCKED. FOR NOW.', { color: '#4a5a6a' }),
    ...gatesY(29, [26, 27], 'tunnelDoor', 'THE TUNNEL DOOR. CLEAR THE AWAY CORNER FIRST.'),
    ...segments({ type: 'ot_sign', x: 30, y: 22, len: 4, z: 1.4, height: 0.6, text: 'TO THE FORECOURT', color: '#ffffff', bg: '#1a6a3a' }),
    // ================= the South Stand forecourt (boss)
    ...gates([31, 32], 43, 'x', 'bossGate', 'THE FORECOURT GATE. CLEAR THE AWAY CORNER FIRST.'),
    ...segments({ type: 'ot_sign', x: 13, y: 46, side: 'right', len: 5, z: 2.3, height: 0.7, text: 'TRAFFORD PARK', color: '#ffffff', bg: '#1a2a4a' }),
    ...segments({ type: 'ot_sign', x: 13, y: 56, side: 'right', len: 4, z: 2.2, height: 0.6, text: 'NO PARKING', color: '#ffffff', bg: '#7a1010' }),
    { type: 'ot_fuseBox', x: 13, y: 52, side: 'right' },
    ...segments({ type: 'ot_sign', x: 13, y: 51, side: 'right', len: 1, z: 1.9, height: 0.4, text: 'FUSES', color: BLACK, bg: GOLD }),
    { type: 'ot_floodlight', x: 15, y: 45 }, { type: 'ot_floodlight', x: 46, y: 45 },
    { type: 'ot_floodlight', x: 15, y: 61 }, { type: 'ot_floodlight', x: 46, y: 61 },
    { type: 'ot_bundles', x: 21, y: 48 }, { type: 'ot_bundles', x: 22, y: 48 }, { type: 'ot_bundles', x: 40, y: 58 },
    { type: 'skip', x: 37, y: 47 },
    { type: 'wheeliebin', x: 26, y: 61 }, { type: 'wheeliebin', x: 27, y: 61 },
    ...gatesY(48, [53, 54], 'exit', 'THE GATE TO TRAFFORD PARK. DEAL WITH GRIMSHAW.', { requiresExit: true }),
    { type: 'exitArrow', x: 47, y: 53 },
  ],
  lights: [
    // towpath: sodium lamps (props) + strip lights on the units and the boat's portholes
    { x: 12, y: 1.5, z: 3.2, r: 4, color: '#d8e8ff', intensity: 0.5 },
    { x: 22.5, y: 2, z: 1, r: 3, color: '#ffc070', intensity: 0.6 },
    { x: 41, y: 1.5, z: 3.2, r: 4, color: '#d8e8ff', intensity: 0.45, flicker: true },
    // halt: platform lights + the blue lamp at the cordon
    { x: 39, y: 15, z: 3, r: 5, color: '#fff0d0', intensity: 0.55 },
    { x: 48, y: 15, z: 3, r: 5, color: '#fff0d0', intensity: 0.55 },
    { x: 55, y: 14.5, z: 2, r: 4.5, color: '#6a9aff', intensity: 0.6, flicker: true },
    { x: 44.5, y: 21.5, z: 2.5, r: 3.5, color: '#ffe0b0', intensity: 0.6 },
    // the street: floodlight spill from the stand + the turnstile glow
    { x: 11, y: 32, z: 3, r: 5, color: '#ffe8c0', intensity: 0.6 },
    { x: 26, y: 35, z: 6, r: 9, color: '#e8eeff', intensity: 0.35 },
    { x: 46, y: 36, z: 6, r: 9, color: '#e8eeff', intensity: 0.35 },
    // inside: terrace floods, concourse strips, the tunnel
    { x: 9, y: 17, z: 4, r: 7, color: '#e8ecff', intensity: 0.5 },
    { x: 27, y: 16, z: 4, r: 7, color: '#e8ecff', intensity: 0.45 },
    { x: 8, y: 26, z: 2.4, r: 4.5, color: '#e8f0ff', intensity: 0.6 },
    { x: 20, y: 26, z: 2.4, r: 4.5, color: '#e8f0ff', intensity: 0.55, flicker: true },
    { x: 32, y: 25, z: 2, r: 3.5, color: '#f0f0ff', intensity: 0.7 },
    { x: 32, y: 28.5, z: 2, r: 3.5, color: '#f0f0ff', intensity: 0.6, flicker: true },
    // the forecourt (these die in LIGHTS OUT)
    { x: 24, y: 50, z: 4, r: 7, color: '#e8eeff', intensity: 0.5 },
    { x: 38, y: 55, z: 4, r: 7, color: '#e8eeff', intensity: 0.5 },
    { x: 30, y: 59, z: 4, r: 6, color: '#ffe0b0', intensity: 0.4 },
    // the fuse box's little lamp stays on (outside the arena edge) so you can find it
    { x: 13.2, y: 52.5, z: 2, r: 2.2, color: '#ffe14a', intensity: 0.7 },
  ],
  hazards: [
    // the police dogs lunge on a cycle and bite whoever is in front of them (both sides!)
    { type: 'zone', area: { x: 52.4, y: 12.6, w: 1.6, h: 1.8 }, dmg: 9, interval: 0.4, kb: 4, knockdown: true, sfx: 'punch', active: w => dogLunging(w.time, 0) },
    { type: 'zone', area: { x: 52.4, y: 15.6, w: 1.6, h: 1.8 }, dmg: 9, interval: 0.4, kb: 4, knockdown: true, sfx: 'punch', active: w => dogLunging(w.time, 2.1) },
    // police vans tear down Sir Matt Busby Way
    { type: 'traffic', lane: [{ x: 65, y: 36.5 }, { x: -4, y: 36.5 }], interval: [7, 13], speed: 9, offset: 6, dmg: 16, vehicle: 'van', colors: ['#e8e8ec'] },
  ],
  triggers: [
    { area: { x: 1, y: 4, w: 5, h: 5 }, toast: 'COACH DIVERTED. UP THE TOWPATH, LADS. STAY TIGHT.' },
    { area: { x: 17, y: 4, w: 10, h: 2 }, toast: 'A NARROWBOAT IN THE LOCK. JUMP ON THE ROOF?' },
    { area: { x: 31, y: 4, w: 6, h: 2 }, toast: 'THAT LOADING BRIDGE LOOKS LOW ENOUGH TO JUMP ONTO...' },
    { area: { x: 2, y: 7, w: 6, h: 2 }, toast: 'THE EMBANKMENT BRICKS LOOK LOOSE HERE' },
    { area: { x: 36, y: 9, w: 12, h: 2 }, msg: 'THE RAILWAY HALT', sub: 'UNITED FOOTBALL GROUND. MATCHDAY SPECIALS ONLY.', dur: 2.4 },
    { area: { x: 48, y: 11, w: 5, h: 8 }, toast: 'POLICE DOGS BITE ANYONE IN FRONT OF THEM. LURE THEM IN' },
    { area: { x: 43, y: 28, w: 4, h: 3 }, msg: 'SIR MATT BUSBY WAY', sub: 'BURGERS, TOUTS AND THE RED ARMY', dur: 2.4, color: '#ff6a5a', action: w => { chant(w); w.toast('MIND THE ROAD. THE OLD BILL DRIVE LIKE MANIACS'); } },
    { area: { x: 17, y: 31, w: 3, h: 12 }, action: w => w.toast(`MEN IN BLACK AHEAD. BACK TO ME (${hint('orderRegroup')}) OR HOLD (${hint('orderHold')}) - NOBODY ON HIS OWN`) },
    { area: { x: 7, y: 27, w: 9, h: 3 }, msg: 'THE AWAY CORNER', sub: 'PENNED IN NEXT TO THE STRETFORD END', dur: 2.4, color: '#ffe14a', action: w => chant(w) },
    { area: { x: 30, y: 23, w: 5, h: 3 }, toast: 'DOWN THE TUNNEL. GRIMSHAW IS ON THE FORECOURT.' },
    { area: { x: 30, y: 44, w: 4, h: 2 }, toast: 'THE FUSE BOX IS ON THE WEST WALL. REMEMBER THAT.' },
  ],
  secrets: [
    { id: 'narrowboat', x: 20, y: 1, w: 5, h: 2, msg: 'ON THE STRETFORD ROSE', score: 1500 },
    { id: 'loadingbridge', x: 33, y: 1, w: 3, h: 2.9, msg: 'UP ON THE LOADING BRIDGE', score: 1000 },
    { id: 'arches', x: 3, y: 10, w: 4, h: 2, msg: 'UNDER THE ARCHES', score: 2000 },
    { id: 'proghut', x: 48, y: 32, msg: 'UNDER THE COUNTER', score: 1000 },
  ],
  encounters: [
    {
      id: 'towpath', area: { x: 9, y: 4, w: 2, h: 5 }, lockArea: { x: 1, y: 4, w: 46.9, h: 4.9 }, crowd: 0.5,
      msg: 'IT\'S A SET-UP!', sub: 'THE RED ARMY KNEW ABOUT THE TOWPATH',
      waves: [
        { enemies: [
          { type: 'ot_redarmy', x: 17.5, y: 5.5, from: { x: 47.5, y: 5.5 } },
          { type: 'ot_redarmy', x: 18.5, y: 7.5, from: { x: 47.5, y: 7.5 } },
          { type: 'ot_redarmy', x: 15.5, y: 6.5, from: { x: 34.5, y: 2.5 } },
        ] },
        { nextAt: 1, msg: 'OFF THE LOADING BRIDGE!', enemies: [
          { type: 'ot_redarmy', x: 14.5, y: 5.5, from: { x: 33.5, y: 1.5 } },
          { type: 'ot_redarmy', x: 20.5, y: 7.5, from: { x: 35.5, y: 1.5 } },
          { type: 'ot_oldboy', x: 22.5, y: 6.5, from: { x: 47.5, y: 6.5 } },
        ] },
        { msg: 'BEHIND YOU! THEY\'VE CUT US OFF!', enemies: [
          { type: 'ot_redarmy', x: 5.5, y: 5.5, from: { x: 1.5, y: 4.5 } },
          { type: 'ot_redarmy', x: 6.5, y: 7.5, from: { x: 1.5, y: 8.5 } },
          { type: 'ot_tout', x: 16.5, y: 7.5, from: { x: 47.5, y: 7.5 } },
          { type: 'ot_oldboy', x: 12.5, y: 6.5, from: { x: 34.5, y: 1.5 }, delay: 2, weapon: 'ot_rattle' },
        ] },
      ],
    },
    {
      id: 'halt', area: { x: 36, y: 10, w: 12, h: 2 }, lockArea: { x: 36, y: 10, w: 22.9, h: 9.9 }, crowd: 0.6,
      msg: 'WELCOME TO MANCHESTER', sub: 'THE HALT IS CRAWLING WITH THEM',
      goTo: { x: 44, y: 15, w: 2, h: 1 }, clearMsg: 'OVER THE FOOTBRIDGE!',
      waves: [
        { enemies: [
          { type: 'ot_redarmy', x: 41.5, y: 14.5, from: { x: 36.5, y: 12.5 } },
          { type: 'ot_redarmy', x: 42.5, y: 17.5, from: { x: 36.5, y: 17.5 } },
          { type: 'ot_tout', x: 48.5, y: 14.5, from: { x: 36.5, y: 15.5 } },
        ] },
        { nextAt: 1, msg: 'THE OLD BILL LET THEM THROUGH!', enemies: [
          { type: 'ot_oldboy', x: 50.5, y: 15.5, from: { x: 57.5, y: 15.5 } },
          { type: 'ot_redarmy', x: 49.5, y: 12.5, from: { x: 57.5, y: 13.5 } },
          { type: 'ot_redarmy', x: 49.5, y: 18.5, from: { x: 57.5, y: 16.5 } },
        ] },
        { msg: 'MEN IN BLACK ON THE FOOTBRIDGE!', enemies: [
          { type: 'ot_mib', x: 42.5, y: 16.5, from: { x: 44.5, y: 21.5 } },
          { type: 'ot_mib', x: 47.5, y: 16.5, from: { x: 45.5, y: 21.5 } },
          { type: 'ot_redarmy', x: 39.5, y: 13.5, from: { x: 36.5, y: 14.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'busbyway', area: { x: 42, y: 28, w: 6, h: 3 }, lockArea: { x: 20, y: 24, w: 40.9, h: 18.9 }, crowd: 0.9,
      msg: 'THE RED ARMY!', sub: 'ALL OF THEM. EVERYWHERE.',
      goTo: { x: 17, y: 32, w: 2, h: 8 }, clearMsg: 'THEY\'RE WAITING AT THE TURNSTILES...',
      waves: [
        { enemies: [
          { type: 'ot_redarmy', x: 50.5, y: 35.5, from: { x: 60.5, y: 35.5 } },
          { type: 'ot_redarmy', x: 52.5, y: 38.5, from: { x: 60.5, y: 39.5 } },
          { type: 'ot_redarmy', x: 38.5, y: 34.5, from: { x: 21.5, y: 34.5 } },
          { type: 'ot_redarmy', x: 40.5, y: 32.5, from: { x: 21.5, y: 32.5 } },
        ] },
        { nextAt: 1, msg: 'TOUTS! WATCH YOUR MONEY!', enemies: [
          { type: 'ot_tout', x: 34.5, y: 37.5, from: { x: 21.5, y: 37.5 } },
          { type: 'ot_tout', x: 47.5, y: 36.5, from: { x: 60.5, y: 37.5 } },
          { type: 'ot_redarmy', x: 44.5, y: 39.5, from: { x: 60.5, y: 41.5 } },
          { type: 'ot_redarmy', x: 36.5, y: 31.5, from: { x: 21.5, y: 31.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'ot_oldboy', x: 42.5, y: 36.5, from: { x: 60.5, y: 36.5 } },
          { type: 'ot_redarmy', x: 30.5, y: 34.5, from: { x: 21.5, y: 35.5 } },
          { type: 'ot_redarmy', x: 33.5, y: 39.5, from: { x: 21.5, y: 40.5 } },
          { type: 'ot_redarmy', x: 48.5, y: 33.5, from: { x: 60.5, y: 32.5 } },
        ] },
        { msg: 'THE STRETFORD END EMPTIES ONTO THE ROAD!', enemies: [
          { type: 'ot_oldboy', x: 36.5, y: 36.5, from: { x: 21.5, y: 36.5 } },
          { type: 'ot_redarmy', x: 40.5, y: 38.5, from: { x: 60.5, y: 38.5 } },
          { type: 'ot_redarmy', x: 44.5, y: 33.5, from: { x: 60.5, y: 33.5 } },
          { type: 'ot_redarmy', x: 32.5, y: 32.5, from: { x: 21.5, y: 33.5 }, delay: 2 },
          { type: 'ot_tout', x: 47.5, y: 39.5, from: { x: 60.5, y: 40.5 }, delay: 3 },
        ] },
      ],
    },
    {
      id: 'mib', area: { x: 15, y: 31, w: 2, h: 12 }, lockArea: { x: 1, y: 31, w: 21.9, h: 11.9 }, crowd: 0.7,
      msg: 'THE MEN IN BLACK', sub: 'THEY MOVE AS ONE. KEEP YOUR LADS TIGHT!',
      goTo: { x: 8, y: 29, w: 7, h: 2 }, clearMsg: 'THE TURNSTILES ARE OPEN!',
      waves: [
        { msg: 'THEY\'RE COMING FROM BOTH SIDES!', enemies: [
          { type: 'ot_mib', x: 5.5, y: 34.5, from: { x: 1.5, y: 33.5 } },
          { type: 'ot_mib', x: 5.5, y: 38.5, from: { x: 1.5, y: 39.5 } },
          { type: 'ot_mib', x: 20.5, y: 34.5, from: { x: 23.5, y: 34.5 } },
          { type: 'ot_mib', x: 20.5, y: 39.5, from: { x: 23.5, y: 39.5 } },
        ] },
        { nextAt: 1, msg: 'MORE THROUGH THE TURNSTILES!', enemies: [
          { type: 'ot_mib', x: 10.5, y: 33.5, from: { x: 10.5, y: 30.5 } },
          { type: 'ot_redarmy', x: 8.5, y: 35.5, from: { x: 8.5, y: 30.5 } },
          { type: 'ot_redarmy', x: 13.5, y: 36.5, from: { x: 14.5, y: 30.5 } },
          { type: 'ot_mib', x: 16.5, y: 40.5, from: { x: 23.5, y: 41.5 } },
        ] },
        { msg: 'THEIR INNER CIRCLE!', enemies: [
          { type: 'ot_mib', x: 6.5, y: 36.5, from: { x: 1.5, y: 36.5 }, hp: 75, name: 'MIB LIEUTENANT' },
          { type: 'ot_mib', x: 17.5, y: 33.5, from: { x: 23.5, y: 32.5 } },
          { type: 'ot_mib', x: 17.5, y: 38.5, from: { x: 23.5, y: 38.5 } },
          { type: 'ot_oldboy', x: 11.5, y: 38.5, from: { x: 12.5, y: 30.5 }, delay: 2.5 },
        ] },
      ],
    },
    {
      id: 'awaycorner', area: { x: 5, y: 27, w: 12, h: 2 }, lockArea: { x: 1, y: 13, w: 27.9, h: 16.9 }, crowd: 1,
      msg: 'HOME FANS IN THE AWAY CORNER!', sub: 'AND THE STEWARDS ARE NO HELP',
      goTo: { x: 28, y: 26, w: 1, h: 2 }, clearMsg: 'DOWN THE TUNNEL!',
      waves: [
        { enemies: [
          { type: 'steward', x: 12.5, y: 25.5, from: { x: 12.5, y: 30.5 } },
          { type: 'ot_redarmy', x: 9.5, y: 17.5, from: { x: 24.5, y: 16.5 } },
          { type: 'ot_redarmy', x: 13.5, y: 15.5, from: { x: 26.5, y: 14.5 } },
          { type: 'steward', x: 20.5, y: 27.5, from: { x: 14.5, y: 30.5 } },
        ] },
        { nextAt: 1, msg: 'THEY\'VE OPENED THE SEGREGATION GATE!', enemies: [
          { type: 'ot_redarmy', x: 14.5, y: 17.5, from: { x: 20.5, y: 17.5 } },
          { type: 'ot_redarmy', x: 14.5, y: 18.5, from: { x: 20.5, y: 18.5 } },
          { type: 'ot_oldboy', x: 12.5, y: 18.5, from: { x: 19.5, y: 21.5 } },
          { type: 'ot_redarmy', x: 13.5, y: 20.5, from: { x: 20.5, y: 21.5 }, delay: 2 },
          { type: 'ot_redarmy', x: 14.5, y: 14.5, from: { x: 20.5, y: 13.5 }, delay: 3.5 },
        ] },
        { nextAt: 1, msg: 'MEN IN BLACK FROM THE TUNNEL!', enemies: [
          { type: 'ot_mib', x: 22.5, y: 25.5, from: { x: 31.5, y: 26.5 } },
          { type: 'ot_mib', x: 22.5, y: 28.5, from: { x: 31.5, y: 27.5 } },
          { type: 'ot_mib', x: 16.5, y: 24.5, from: { x: 31.5, y: 25.5 } },
        ] },
        { msg: 'LAST OF THEM!', enemies: [
          { type: 'ot_tout', x: 8.5, y: 24.5, from: { x: 10.5, y: 30.5 } },
          { type: 'ot_mib', x: 10.5, y: 20.5, from: { x: 20.5, y: 18.5 } },
          { type: 'ot_mib', x: 6.5, y: 26.5, from: { x: 8.5, y: 30.5 } },
          { type: 'ot_oldboy', x: 15.5, y: 15.5, from: { x: 20.5, y: 15.5 } },
        ] },
      ],
    },
  ],
  boss: {
    type: 'ot_grimshaw', x: 31.5, y: 54.5, title: 'DES "THE FUNERAL DIRECTOR" GRIMSHAW', intro: 'THE MEN IN BLACK. NOBODY LEAVES.',
    area: { x: 29, y: 44, w: 5, h: 3 }, lockArea: BOSS_ARENA,
    minions: [
      { type: 'ot_mib', x: 24.5, y: 52.5 },
      { type: 'ot_mib', x: 38.5, y: 52.5 },
    ],
    crewSpots: [
      { x: 17.5, y: 47.5, from: { x: 13.5, y: 47.5 } },
      { x: 44.5, y: 48.5, from: { x: 48.5, y: 48.5 } },
      { x: 17.5, y: 59.5, from: { x: 13.5, y: 59.5 } },
      { x: 44.5, y: 59.5, from: { x: 48.5, y: 59.5 } },
    ],
  },
  exit: { x: 48, y: 53, w: 1, h: 2 },

  onStart(world) {
    world.__otLvl = { segOpen: false };
  },

  onUpdate(world, dt) {
    const S = world.__otLvl || (world.__otLvl = { segOpen: false });
    // the home end opens the segregation gate during the away-corner fight (hold it!)
    const ac = world.encounters.find(e => e.id === 'awaycorner');
    if (ac && ac.state === 'active' && ac.wave >= 1 && !S.segOpen) {
      S.segOpen = true;
      openTagged(world, 'segGate');
      world.toast(`HOLD THE GATE! SEND THE LADS OVER (HOLD ${hint('command')}) OR HOLD (${hint('orderHold')})`);
      world.sfx('door', world.player);
    }
    // lights never stay off without Grimshaw standing
    if (world.__otDark && !world.fighters.some(f => f.type === 'ot_grimshaw' && f.alive && f.hp > 0)) lightsOn(world, false);
  },

  onEncounterClear(world, e) {
    chant(world);
    if (e.id === 'halt') world.toast('UP THE STEPS AND OVER THE TRACKS');
    if (e.id === 'busbyway') { const M = mibState(world); M.cd = 2.5; }
    if (e.id === 'mib') { openTagged(world, 'turnstiles'); world.toast('THE TURNSTILES ARE OPEN. INTO THE AWAY CORNER.'); }
    if (e.id === 'awaycorner') {
      openTagged(world, 'tunnelDoor'); openTagged(world, 'tunnelOut'); openTagged(world, 'bossGate');
      world.toast('DOWN THE TUNNEL, ACROSS THE ROAD, ONTO THE FORECOURT');
    }
  },

  onBossDefeated(world) {
    lightsOn(world, false);
    openTagged(world, 'exit');
    for (const f of world.fighters) if (f.type === 'ot_mib' && f.alive && f.controller) f.controller.fleeT = 6;
    world.message('THE FUNERAL DIRECTOR IS BURIED!', 'THE MEN IN BLACK MELT AWAY', 3, '#ffe14a');
    world.toast('OUT THROUGH THE TRAFFORD PARK GATE!');
    chant(world);
  },
};
