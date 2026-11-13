// TOUR ARENA — STAMFORD BRIDGE (CHELSEA, THE BLUES). Firm: THE HEADHUNTERS. Fulham Road, London SW6.
// An autumn Saturday in 1994: the Shed End terrace is a building site, the low sun is going down over the
// Fulham Road and the Headhunters already know you're on the District line.
//
// Route: FULHAM BROADWAY ticket hall (ambush at the gateline, men coming up the stairs behind you)
//        -> THE FULHAM ROAD (the pub empties; traffic and buses both ways)
//        -> optional KING'S ROAD boutique mews (Stone Island in the window; a stockroom behind a fake shopfront)
//        -> through the BRITANNIA GATE -> the FORECOURT (they come from both sides: keep the firm together)
//        -> the turnstiles -> THE SHED END building site (scaffold to climb, a crane hoist dropping bricks,
//           cement mixers, portakabins (one is hollow), and THE GAFFER: the big man to pin)
//        -> the AWAY SECTION (real stepped terrace; your own fans up the back; Headhunters got in)
//        -> BOSS in the PLAYERS' CAR PARK among the flash motors: MONTY 'THE BROLLY' FAIRWEATHER
//        -> out through the car park gate onto the Fulham Road.
// Everyone named here is invented; the firm, club, ground and streets are real. Map: rect fills (buildMap).
import '../../themes/common.js';
import '../../themes/derby.js';            // reuse: derby_sign, derby_banner, derby_stall, derby_flagpole, derby_crushBarrier, derby_burgerVan
import './theme.js';
import './boss.js';
import './music.js';
import { segments } from '../../themes/derby.js';
import { hoistPhase, BLUE, WHITE } from './theme.js';
import { CARD_TEXT } from './boss.js';
import { audio } from '../../../audio/audio.js';
import { input } from '../../../engine/input.js';

const RED = '#c8102e', GOLD = '#e8c040', NAVY = '#0a2350';
const STAFF = 'stamfordbridge_staff';      // key nobody carries: these gates are opened by the level script

// ------------------------------------------------------------------ map
const W = 58, H = 59;
function buildMap() {
  const g = Array.from({ length: H }, () => Array(W).fill(' '));
  const rect = (ch, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
  // ---- north band: Fulham Broadway station, the shops & pub, the boutique mews
  rect('q', 0, 0, 19, 12);
  rect('T', 1, 1, 18, 11);
  rect('q', 1, 1, 4, 2);                  // stairwell block (to the District line)
  rect('o', 14, 1, 18, 3);                // ticket office
  rect('Q', 0, 12, 19, 12);               // station front
  rect('T', 7, 12, 11, 12);               // station entrance
  rect('H', 20, 0, 39, 11);
  rect('S', 20, 12, 25, 12);
  rect('P', 26, 12, 33, 12);              // THE BLUE LION
  rect('S', 34, 12, 39, 12);
  rect('b', 40, 0, 53, 3);                // boutique row (north)
  rect('b', 40, 4, 41, 12);               // boutiques (west side, fronts face the mews)
  rect('M', 54, 0, 57, 12);               // mews houses
  rect('Y', 42, 4, 53, 7);
  rect('c', 42, 8, 53, 12);
  rect('Y', 48, 1, 50, 2);                // stockroom (secret)
  rect('f', 48, 3, 50, 3);                // ...behind a fake shopfront
  // ---- the Fulham Road
  rect(',', 0, 13, 57, 13);
  rect('k', 0, 14, 57, 14);
  rect('r', 0, 15, 57, 19);
  rect('-', 0, 17, 57, 17);
  rect(',', 0, 20, 57, 21);
  // ---- stadium perimeter + the Britannia Gate
  rect('I', 0, 22, 57, 22);
  rect('J', 25, 22, 25, 22); rect('J', 30, 22, 30, 22);
  rect('F', 26, 22, 29, 22);
  // ---- forecourt
  rect('E', 0, 23, 0, 28); rect('E', 57, 23, 57, 28);
  rect('F', 1, 23, 56, 28);
  // ---- Shed End facade with turnstiles, the East Stand block
  rect('D', 0, 29, 30, 29);
  for (const x of [5, 7, 9, 11]) rect('U', x, 29, x, 29);
  rect('V', 31, 29, 57, 41);
  // ---- the Shed End building site
  rect('O', 0, 30, 0, 41);
  rect('m', 1, 30, 30, 41);
  rect('1', 16, 30, 23, 31);              // scaffold against the old Shed
  rect('2', 21, 30, 23, 30);              // ...top lift
  rect('1', 3, 34, 4, 35);                // scaffold tower
  rect('C', 24, 33, 28, 34);              // portakabin (site office)
  rect('C', 24, 37, 28, 40);              // portakabin (canteen) - hollow
  rect('m', 25, 38, 27, 39);
  rect('x', 26, 40, 26, 40);              // ...its door is not locked, it's not even a wall
  rect('O', 0, 42, 30, 42);               // hoardings
  rect('a', 12, 42, 14, 42);              // gap (gated)
  rect('w', 31, 42, 57, 42);
  // ---- away section: flat front + six real steps up to the back
  rect('A', 0, 43, 0, 58);
  rect('a', 1, 43, 24, 44);
  rect('3', 1, 45, 24, 46); rect('4', 1, 47, 24, 48); rect('5', 1, 49, 24, 50);
  rect('6', 1, 51, 24, 52); rect('7', 1, 53, 24, 54); rect('8', 1, 55, 24, 57);
  rect('A', 0, 58, 25, 58);
  rect('w', 25, 43, 25, 44);              // car park gate posts (gated)
  rect('p', 25, 43, 25, 44);
  rect('A', 25, 45, 25, 57);
  // ---- players' car park
  rect('p', 26, 43, 56, 57);
  rect('w', 57, 43, 57, 58); rect('p', 57, 49, 57, 50);   // exit gate (gated)
  rect('w', 26, 58, 57, 58);
  return g.map(r => r.join(''));
}

const CARPARK = { x: 26, y: 43, w: 30.9, h: 14.9 };

function openTagged(world, tag) {
  for (const p of world.props) if (p.o.tag === tag) p.open = true;
  world.rebuildPropGrid();
}
const gate = (x, y, tag, msg, dir = 'x') => ({ type: 'gate', x, y, dir, key: STAFF, tag, color: '#14306a', lockedMsg: msg });
const step = h => ({ floor: 'stamfordbridge_terrace', wall: 'stamfordbridge_step', h });
const fans = (x, y, side, base = 0, flip = false) => ({ type: 'stamfordbridge_fans', x, y, side, base, flip });

export default {
  id: 'stamfordbridge',
  tour: true,
  num: 10,
  name: 'STAMFORD BRIDGE',
  subtitle: 'SATURDAY. 14:40. LOW AUTUMN SUN.',
  intro: [
    'AWAY DAY: STAMFORD BRIDGE, FULHAM ROAD.',
    'THE HEADHUNTERS LEAVE CALLING CARDS.',
    'THEIR TOP MAN CARRIES A BROLLY. IT ISN\'T RAINING.',
    'WEAR YOUR BEST CLOBBER. YOU MIGHT LOSE IT.',
  ],
  music: 'stamfordbridge',
  crowd: 0.75,
  weather: null,
  ambient: { dark: 0.36, color: '#1c0e24', playerLight: 3.1 },
  bg: '#0a0710',
  fog: 'rgba(255,140,70,0.045)',
  extraTokens: 1,
  defaultFloor: 'pavement',
  start: { x: 8.5, y: 3.5 },
  startFacing: { x: 0, y: 1 },
  legend: {
    'T': { floor: 'stamfordbridge_tube' },
    'q': { floor: 'stamfordbridge_tube', wall: 'stamfordbridge_tubeWall', h: 3 },
    'o': { floor: 'stamfordbridge_tube', wall: 'stamfordbridge_ticketOffice', h: 2.4 },
    'Q': { floor: 'pavement', wall: 'stamfordbridge_tubeFacade', h: 4 },
    ',': { floor: 'pavement' },
    'k': { floor: 'kerbX' },
    'r': { floor: 'road' },
    '-': { floor: 'roadLineX' },
    'H': { floor: 'pavement', wall: 'house', h: 5 },
    'S': { floor: 'pavement', wall: 'shop', h: 4.5 },
    'P': { floor: 'pavement', wall: 'stamfordbridge_pub', h: 4.2 },
    'b': { floor: 'stamfordbridge_yorkstone', wall: 'stamfordbridge_boutique', h: 4 },
    'f': { floor: 'stamfordbridge_yorkstone', wall: 'stamfordbridge_boutique', h: 4, solid: false, fake: true },
    'M': { floor: 'cobble', wall: 'stamfordbridge_mews', h: 3.4 },
    'Y': { floor: 'stamfordbridge_yorkstone' },
    'c': { floor: 'cobble' },
    'I': { floor: 'pavement', wall: 'stamfordbridge_railing', h: 1.6 },
    'J': { floor: 'pavement', wall: 'stamfordbridge_pier', h: 3.4 },
    'F': { floor: 'stamfordbridge_forecourt' },
    'E': { floor: 'stamfordbridge_forecourt', wall: 'brickYellow', h: 3 },
    'D': { floor: 'stamfordbridge_site', wall: 'stamfordbridge_shed', h: 3.6 },
    'U': { floor: 'stamfordbridge_forecourt', prop: { type: 'stamfordbridge_turnstile' } },
    'V': { floor: 'concrete', wall: 'stamfordbridge_eastStand', h: 4.6 },
    'm': { floor: 'stamfordbridge_site' },
    '1': { floor: 'stamfordbridge_site', wall: 'stamfordbridge_scaffold', h: 1.1 },
    '2': { floor: 'stamfordbridge_site', wall: 'stamfordbridge_scaffold', h: 2.1 },
    'C': { floor: 'stamfordbridge_site', wall: 'stamfordbridge_portakabin', h: 2.4 },
    'x': { floor: 'stamfordbridge_site', wall: 'stamfordbridge_portakabin', h: 2.4, solid: false, fake: true },
    'O': { floor: 'stamfordbridge_site', wall: 'stamfordbridge_hoarding', h: 2.4 },
    'a': { floor: 'stamfordbridge_terrace' },
    '3': step(0.3), '4': step(0.6), '5': step(0.9), '6': step(1.2), '7': step(1.5), '8': step(1.8),
    'A': { floor: 'stamfordbridge_terrace', wall: 'stamfordbridge_awayStand', h: 4 },
    'p': { floor: 'stamfordbridge_carpark' },
    'w': { floor: 'stamfordbridge_carpark', wall: 'stamfordbridge_wall', h: 2.8 },
  },
  map: buildMap(),
  items: [
    // ---- the five lost scarves
    { type: 'scarf', x: 46.5, y: 4.5 },                          // in the Stone Island window (break the glass)
    { type: 'scarf', x: 55.5, y: 20.5 },                         // Fulham Road, by the bus stop
    { type: 'scarf', x: 22.5, y: 30.5, z: 2.1 },                 // top lift of the Shed scaffold (jump up)
    { type: 'scarf', x: 26.5, y: 38.5 },                         // inside the hollow portakabin
    { type: 'scarf', x: 3.5, y: 56.5, z: 1.8 },                  // top step of the away section
    // ---- the pin badge: boutique stockroom behind the fake shopfront
    { type: 'badge', x: 49.5, y: 1.5 },
    { type: 'cash20', x: 48.5, y: 2.5 },
    { type: 'fanzine', x: 16.5, y: 9.5, title: 'A CALLING CARD (FOUND ON THE DISTRICT LINE)', text: CARD_TEXT + '. ON THE BACK, IN BIRO: "THE BROLLY SAYS HELLO. BRING A COAT." WORD IS THEIR TOP MAN MONTY NEVER RUNS, NEVER SWEATS AND NEVER LETS GO OF THAT UMBRELLA. DUCK THE CARD. MIND THE CARS IN THE CAR PARK, HE LIKES A BONNET.' },
    { type: 'fanzine', x: 27.5, y: 39.5, title: 'MATCHDAY PROGRAMME 1994/95', text: 'THE NEW SHED END IS COMING ALONG NICELY, SAYS THE CLUB. THE SITE GAFFER WOULD LIKE HIS TEA MUG BACK. TOP TIP FROM THE LADS: A BIG MAN IS A SMALL PROBLEM WHEN ONE OF YOU HOLDS HIM AND THE OTHER ONE HITS HIM.' },
    // ---- health between fights
    { type: 'pie', x: 2.5, y: 9.5 },
    { type: 'pint', x: 36.5, y: 20.5 },
    { type: 'kebab', x: 52.5, y: 11.5 },
    { type: 'pie', x: 40.5, y: 27.5 },
    { type: 'stamfordbridge_cuppa', x: 3.5, y: 31.5 },
    { type: 'stamfordbridge_cuppa', x: 29.5, y: 36.5 },
    { type: 'pint', x: 25.5, y: 39.5 },
    { type: 'pint', x: 20.5, y: 43.5 },
    { type: 'energy', x: 27.5, y: 44.5 },
    // ---- weapons
    { type: 'umbrella', x: 12.5, y: 10.5 },                      // lost property
    { type: 'bottle', x: 22.5, y: 14.5 },
    { type: 'bottle', x: 37.5, y: 13.5 },
    { type: 'chair', x: 6.5, y: 24.5 },
    { type: 'stamfordbridge_pole', x: 8.5, y: 37.5 },
    { type: 'brick', x: 20.5, y: 39.5 },
    { type: 'flag', x: 16.5, y: 43.5 },
    { type: 'coin', x: 30.5, y: 20.5 }, { type: 'coin', x: 45.5, y: 26.5 }, { type: 'cash5', x: 2.5, y: 40.5 },
  ],
  props: [
    // ================= Fulham Broadway ticket hall
    ...[1, 2, 3, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17, 18].map(x => ({ type: 'stamfordbridge_gateline', x, y: 6 })),
    ...segments({ type: 'derby_sign', x: 1, y: 2, len: 4, z: 1.4, height: 0.6, text: 'TO PLATFORMS', color: '#ffffff', bg: '#0019a8' }),
    ...segments({ type: 'derby_sign', x: 14, y: 3, len: 5, z: 1.5, height: 0.6, text: 'TICKETS', color: '#ffffff', bg: '#d81e05' }),
    { type: 'stamfordbridge_roundel', x: 0, y: 5, side: 'right', z: 1.8 },
    { type: 'stamfordbridge_mapBoard', x: 0, y: 9, side: 'right', z: 1.5 },
    { type: 'stamfordbridge_roundel', x: 6, y: 2, z: 1.8, text: 'FULHAM BROADWAY' },
    { type: 'bin', x: 1, y: 10 }, { type: 'bench', x: 17, y: 10 },
    { type: 'graffiti', x: 19, y: 8, side: 'left', z: 1.0, text: 'HH', color: '#3a78ff' },
    // station front on the Fulham Road
    ...segments({ type: 'derby_sign', x: 1, y: 12, len: 6, z: 2.7, height: 0.7, text: 'FULHAM BROADWAY', color: '#ffffff', bg: '#5a1a16' }),
    { type: 'stamfordbridge_roundel', x: 13, y: 12, z: 2.2, text: 'UNDERGROUND' },
    { type: 'stamfordbridge_roundel', x: 16, y: 12, z: 2.2, text: 'DISTRICT' },
    // ================= Fulham Road
    ...segments({ type: 'derby_sign', x: 20, y: 12, len: 6, z: 3.2, height: 0.7, text: 'PIE & MASH', color: '#ffffff', bg: '#1a4a2a' }),
    ...segments({ type: 'derby_sign', x: 26, y: 12, len: 8, z: 3.55, height: 0.5, text: 'THE BLUE LION', color: GOLD, bg: '#0e2a1a' }),
    { type: 'stamfordbridge_pubSign', x: 33, y: 12, text: 'FREE HOUSE' },
    ...segments({ type: 'derby_sign', x: 34, y: 12, len: 6, z: 3.2, height: 0.7, text: 'TURF ACCOUNTANT', color: '#ffe14a', bg: '#2a1a3a' }),
    ...segments({ type: 'derby_sign', x: 40, y: 12, len: 2, z: 2.2, height: 0.6, text: 'KINGS RD', color: '#ffffff', bg: '#1a1a1a' }),
    { type: 'exitArrow', x: 46, y: 12, flipY: true, dir: 'y' },
    { type: 'lamp', x: 4, y: 13 }, { type: 'lamp', x: 18, y: 13 }, { type: 'lamp', x: 36, y: 13 }, { type: 'lamp', x: 52, y: 13 },
    { type: 'lamp', x: 10, y: 21 }, { type: 'lamp', x: 22, y: 21 }, { type: 'lamp', x: 40, y: 21 }, { type: 'lamp', x: 50, y: 21 },
    { type: 'phonebox', x: 56, y: 13 },
    { type: 'postbox', x: 13, y: 13 },
    { type: 'newsStand', x: 23, y: 13 },
    { type: 'busStop', x: 53, y: 21 },
    { type: 'bin', x: 32, y: 21 }, { type: 'bollard', x: 6, y: 21 }, { type: 'bollard', x: 45, y: 21 },
    { type: 'graffiti', x: 20, y: 11, side: 'left', z: 1.0, text: 'CFC', color: '#3a78ff' },
    // ================= King's Road boutique mews
    ...segments({ type: 'derby_sign', x: 42, y: 3, len: 4, z: 3.0, height: 0.6, text: 'STONE ISLAND', color: '#e8c040', bg: '#1a1a1a' }),
    ...segments({ type: 'derby_sign', x: 48, y: 3, len: 3, z: 3.0, height: 0.6, text: 'BOUTIQUE', color: '#ffffff', bg: '#5a1a2a' }),
    ...segments({ type: 'derby_sign', x: 51, y: 3, len: 3, z: 3.0, height: 0.6, text: 'CASUALS', color: '#ffffff', bg: '#2a3a5a' }),
    ...segments({ type: 'derby_sign', x: 41, y: 5, side: 'right', len: 4, z: 3.0, height: 0.6, text: 'GENTS OUTFITTERS', color: '#e8c040', bg: '#2a4a3a' }),
    { type: 'stamfordbridge_window', x: 46, y: 4, secret: 'stoneisland', text: '£250' },
    { type: 'stamfordbridge_window', x: 43, y: 4, text: '£180' },
    { type: 'bench', x: 52, y: 6 }, { type: 'tree', x: 53, y: 9 }, { type: 'bin', x: 42, y: 11 },
    { type: 'lamp', x: 42, y: 8 },
    { type: 'graffiti', x: 54, y: 10, side: 'left', z: 1.1, text: 'TRESPASSERS WILL', color: '#c8c8c8' },
    // ================= stadium perimeter & Britannia Gate
    gate(26, 22, 'britannia', 'THE BRITANNIA GATE IS SHUT. DEAL WITH THE PUB FIRST.'),
    gate(27, 22, 'britannia', 'THE BRITANNIA GATE IS SHUT. DEAL WITH THE PUB FIRST.'),
    gate(28, 22, 'britannia', 'THE BRITANNIA GATE IS SHUT. DEAL WITH THE PUB FIRST.'),
    gate(29, 22, 'britannia', 'THE BRITANNIA GATE IS SHUT. DEAL WITH THE PUB FIRST.'),
    { type: 'derby_sign', x: 25, y: 22, z: 2.4, height: 0.7, text: 'BRITANNIA', color: '#ffffff', bg: BLUE },
    { type: 'derby_sign', x: 30, y: 22, z: 2.4, height: 0.7, text: 'GATE', color: '#ffffff', bg: BLUE },
    { type: 'stamfordbridge_crest', x: 25, y: 22, z: 1.3 }, { type: 'stamfordbridge_crest', x: 30, y: 22, z: 1.3 },
    { type: 'stamfordbridge_flagBanner', x: 6, y: 22, z: 0.6, text: 'CFC', bw: 24 },
    { type: 'stamfordbridge_flagBanner', x: 16, y: 22, z: 0.6, crest: true, bw: 24 },
    { type: 'stamfordbridge_flagBanner', x: 40, y: 22, z: 0.6, crest: true, bw: 24 },
    { type: 'stamfordbridge_flagBanner', x: 50, y: 22, z: 0.6, text: 'BLUES', bw: 30 },
    // ================= forecourt
    { type: 'stamfordbridge_crestBoard', x: 33, y: 24, text: 'CHELSEA F.C.' },
    { type: 'derby_stall', x: 9, y: 24, a: BLUE, b: WHITE, text: 'PROGRAMMES £1.50' },
    { type: 'derby_stall', x: 45, y: 24, a: BLUE, b: WHITE, text: 'SCARVES £5' },
    { type: 'derby_burgerVan', x: 18, y: 24 },
    { type: 'derby_flagpole', x: 23, y: 23, a: BLUE, b: WHITE }, { type: 'derby_flagpole', x: 32, y: 23, a: BLUE, b: WHITE },
    { type: 'derby_flagpole', x: 4, y: 28, a: BLUE, b: WHITE }, { type: 'derby_flagpole', x: 13, y: 28, a: BLUE, b: WHITE },
    fans(1, 23, 'home'), fans(2, 23, 'home'), fans(1, 24, 'home'), fans(1, 25, 'home', 0, false),
    fans(56, 23, 'home', 0, true), fans(55, 23, 'home', 0, true), fans(56, 24, 'home', 0, true), fans(56, 25, 'home', 0, true), fans(54, 23, 'home', 0, true),
    { type: 'barrier', x: 3, y: 24, dir: 'y' }, { type: 'barrier', x: 2, y: 26 },
    { type: 'barrier', x: 53, y: 24, dir: 'y' }, { type: 'barrier', x: 54, y: 26 },
    { type: 'bin', x: 28, y: 28 }, { type: 'bin', x: 42, y: 28 },
    { type: 'derby_banner', x: 0, y: 23, side: 'right', len: 5, z: 1.4, height: 0.9, text: 'CHELSEA', a: BLUE, b: WHITE, color: WHITE },
    // ================= Shed End building site
    ...segments({ type: 'derby_sign', x: 0, y: 29, len: 5, z: 2.5, height: 0.8, text: 'THE SHED', color: '#ffffff', bg: BLUE }),
    { type: 'stamfordbridge_crest', x: 13, y: 29, z: 2.0, big: false },
    ...segments({ type: 'derby_sign', x: 25, y: 29, len: 5, z: 2.4, height: 0.6, text: 'HARD HATS', color: '#1a1a1a', bg: '#f0c020' }),
    { type: 'stamfordbridge_hoist', x: 9, y: 33 },
    { type: 'stamfordbridge_hoist', x: 18, y: 36, phase: 3.2 },
    { type: 'stamfordbridge_mixer', x: 6, y: 38 }, { type: 'stamfordbridge_mixer', x: 14, y: 40 },
    { type: 'stamfordbridge_bricks', x: 27, y: 31 }, { type: 'stamfordbridge_bricks', x: 28, y: 31 }, { type: 'stamfordbridge_bricks', x: 2, y: 37 },
    { type: 'skip', x: 11, y: 30 },
    { type: 'cone', x: 8, y: 31 }, { type: 'cone', x: 12, y: 33 }, { type: 'cone', x: 21, y: 38 },
    { type: 'pallet', x: 29, y: 39 }, { type: 'crate', x: 29, y: 40 },
    ...segments({ type: 'derby_sign', x: 24, y: 34, len: 3, z: 1.6, height: 0.5, text: 'SITE OFFICE', color: '#ffffff', bg: '#2a3a4a' }),
    ...segments({ type: 'derby_sign', x: 24, y: 40, len: 2, z: 1.7, height: 0.5, text: 'CANTEEN', color: '#ffffff', bg: '#2a3a4a' }),
    { type: 'graffiti', x: 27, y: 40, side: 'left', z: 0.9, text: 'KEEP OUT', color: '#ffffff' },
    ...segments({ type: 'derby_sign', x: 1, y: 42, len: 9, z: 1.5, height: 0.6, text: 'NEW SHED END: OPENING SOON-ISH', color: '#ffffff', bg: BLUE }),
    gate(12, 42, 'awayGate', 'AWAY FANS ONLY. CLEAR THE SITE FIRST.'),
    gate(13, 42, 'awayGate', 'AWAY FANS ONLY. CLEAR THE SITE FIRST.'),
    gate(14, 42, 'awayGate', 'AWAY FANS ONLY. CLEAR THE SITE FIRST.'),
    // ================= away section (stepped)
    ...[2, 3, 4, 6, 7, 9, 10, 11, 14, 15, 17, 18, 21, 22].map((x, i) => fans(x, 57, 'away', 1.8, i % 2 === 1)),
    ...[5, 8, 13, 19, 23].map(x => fans(x, 55, 'away', 1.8)),
    ...[4, 5, 11, 12, 19, 20].map(x => ({ type: 'derby_crushBarrier', x, y: 50, base: 0.9 })),
    ...[7, 8, 15, 16].map(x => ({ type: 'derby_crushBarrier', x, y: 46, base: 0.3 })),
    ...[8, 9, 16, 17].map(x => ({ type: 'derby_crushBarrier', x, y: 53, base: 1.5, scarf: x === 16 })),
    ...segments({ type: 'derby_banner', x: 0, y: 45, side: 'right', len: 7, z: 2.2, height: 1.0, text: 'NORDHAMN ON TOUR', a: RED, b: WHITE, color: WHITE }),
    ...segments({ type: 'derby_sign', x: 25, y: 46, side: 'right', len: 1, z: 0.6, height: 0.5, text: 'AWAY', color: '#ffffff', bg: RED }),
    gate(25, 43, 'carparkGate', 'PLAYERS AND OFFICIALS ONLY. CLEAR THE AWAY END FIRST.', 'y'),
    gate(25, 44, 'carparkGate', 'PLAYERS AND OFFICIALS ONLY. CLEAR THE AWAY END FIRST.', 'y'),
    // ================= players' car park
    ...segments({ type: 'derby_sign', x: 33, y: 42, len: 8, z: 1.7, height: 0.6, text: 'PLAYERS & OFFICIALS ONLY', color: '#ffffff', bg: BLUE }),
    { type: 'stamfordbridge_crest', x: 43, y: 42, z: 1.4 },
    ...segments({ type: 'derby_sign', x: 46, y: 42, len: 5, z: 1.7, height: 0.6, text: 'EAST STAND', color: '#ffffff', bg: NAVY }),
    { type: 'stamfordbridge_sportscar', x: 27, y: 44, color: RED },
    { type: 'stamfordbridge_sportscar', x: 36, y: 44, color: '#1a1a1a', roof: '#2a2a2a' },
    { type: 'stamfordbridge_sportscar', x: 45, y: 44, color: '#e8c020' },
    { type: 'car', x: 30, y: 54, color: '#f4f4f0' },
    { type: 'stamfordbridge_sportscar', x: 39, y: 54, color: '#b8bcc4' },
    { type: 'car', x: 46, y: 54, color: NAVY },
    { type: 'lamp', x: 26, y: 50 }, { type: 'lamp', x: 52, y: 47 }, { type: 'lamp', x: 52, y: 57 },
    { type: 'cone', x: 54, y: 48 }, { type: 'cone', x: 54, y: 51 },
    { type: 'gate', x: 57, y: 49, dir: 'y', requiresExit: true, tag: 'exitGate', color: '#14306a', lockedMsg: 'THE CAR PARK GATE IS LOCKED. MONTY HAS THE CLICKER.' },
    { type: 'gate', x: 57, y: 50, dir: 'y', requiresExit: true, tag: 'exitGate', color: '#14306a', lockedMsg: 'THE CAR PARK GATE IS LOCKED. MONTY HAS THE CLICKER.' },
    ...segments({ type: 'derby_sign', x: 57, y: 46, side: 'right', len: 3, z: 2.0, height: 0.6, text: 'FULHAM RD', color: '#ffffff', bg: '#1a6a3a' }),
    { type: 'exitArrow', x: 56, y: 49 },
  ],
  lights: [
    // ticket hall strip lights
    { x: 5, y: 4, z: 2.6, r: 5, color: '#e8f4ff', intensity: 0.65 },
    { x: 13, y: 8, z: 2.6, r: 5, color: '#e8f4ff', intensity: 0.6, flicker: true },
    { x: 9, y: 11, z: 2.4, r: 4, color: '#e8f4ff', intensity: 0.5 },
    // Fulham Road: pub glow, low sun, shop light
    { x: 30, y: 13.5, z: 1.8, r: 4.5, color: '#ffc070', intensity: 0.75 },
    { x: 22, y: 13.5, z: 1.8, r: 3.5, color: '#ffe0a0', intensity: 0.5 },
    { x: 37, y: 13.5, z: 1.8, r: 3.5, color: '#d0a0ff', intensity: 0.45 },
    { x: 8, y: 17, z: 5, r: 9, color: '#ffb070', intensity: 0.4 },
    { x: 46, y: 17, z: 5, r: 9, color: '#ffb070', intensity: 0.4 },
    // King's Road windows
    { x: 45, y: 5, z: 1.6, r: 3.5, color: '#fff0d0', intensity: 0.7 },
    { x: 43, y: 9, z: 1.6, r: 3.5, color: '#fff0d0', intensity: 0.55 },
    { x: 49, y: 2, z: 1.5, r: 2.4, color: '#ffd080', intensity: 0.6 },
    // forecourt
    { x: 12, y: 26, z: 4, r: 7, color: '#ffc890', intensity: 0.5 },
    { x: 28, y: 25, z: 4, r: 7, color: '#ffc890', intensity: 0.5 },
    { x: 46, y: 26, z: 4, r: 7, color: '#ffc890', intensity: 0.5 },
    // building site work lights
    { x: 6, y: 33, z: 3.5, r: 6, color: '#fff4c0', intensity: 0.55 },
    { x: 18, y: 35, z: 3.5, r: 6, color: '#fff4c0', intensity: 0.55, flicker: true },
    { x: 26, y: 38.5, z: 1.5, r: 2.6, color: '#ffd890', intensity: 0.7 },
    // away section
    { x: 8, y: 48, z: 5, r: 8, color: '#f0f0ff', intensity: 0.45 },
    { x: 18, y: 53, z: 5, r: 8, color: '#f0f0ff', intensity: 0.45 },
    // car park sodium lamps
    { x: 34, y: 50, z: 4.5, r: 8, color: '#ffb050', intensity: 0.55 },
    { x: 47, y: 50, z: 4.5, r: 8, color: '#ffb050', intensity: 0.55 },
  ],
  hazards: [
    // Fulham Road traffic both ways: cars, black cabs and red buses
    { type: 'traffic', lane: [{ x: -6, y: 16.0 }, { x: 64, y: 16.0 }], interval: [5, 10], speed: 8.5, offset: 2, dmg: 16,
      mix: [{ style: 'car', colors: ['#8a2020', '#203a8a', '#d8d8d0', '#2a6a3a', '#3a3a3e'], weight: 3 }, { style: 'taxi', colors: ['#141416'], weight: 2 }, { style: 'bus', colors: ['#c8102e'], weight: 1, dmg: 24 }] },
    { type: 'traffic', lane: [{ x: 64, y: 18.6 }, { x: -6, y: 18.6 }], interval: [6, 11], speed: 8, offset: 6, dmg: 16,
      mix: [{ style: 'car', colors: ['#8a2020', '#203a8a', '#d8d8d0', '#c8b020', '#3a3a3e'], weight: 3 }, { style: 'taxi', colors: ['#141416'], weight: 2 }, { style: 'bus', colors: ['#c8102e'], weight: 1, dmg: 24 }] },
    // the crane hoist drops its pallet of bricks (hits anyone under it, their lot too)
    { type: 'zone', area: { x: 9.15, y: 33.15, w: 1.7, h: 1.7 }, dmg: 16, interval: 0.3, kb: 4, knockdown: true, sfx: 'hitHeavy', height: 1, active: w => hoistPhase(w.time, 0).drop },
    { type: 'zone', area: { x: 18.15, y: 36.15, w: 1.7, h: 1.7 }, dmg: 16, interval: 0.3, kb: 4, knockdown: true, sfx: 'hitHeavy', height: 1, active: w => hoistPhase(w.time, 3.2).drop },
  ],
  triggers: [
    { area: { x: 6, y: 2, w: 6, h: 3 }, toast: 'FULHAM BROADWAY. THE HEADHUNTERS KNOW YOU\'RE HERE.' },
    { area: { x: 1, y: 4, w: 18, h: 2 }, toast: 'JUMP THE BARRIERS OR USE THE OPEN GATES' },
    { area: { x: 1, y: 13, w: 56, h: 2 }, msg: 'THE FULHAM ROAD', sub: 'MIND THE BUSES', dur: 2.2, color: '#a8c8ff' },
    { area: { x: 42, y: 8, w: 12, h: 4 }, msg: 'THE KING\'S ROAD', sub: '(NEAR ENOUGH.) STONE ISLAND IN THE WINDOW.', dur: 2.6 },
    { area: { x: 42, y: 4, w: 6, h: 3 }, toast: 'THAT JACKET COSTS MORE THAN YOUR COACH. SHAME IF THE GLASS BROKE.' },
    { area: { x: 24, y: 23, w: 8, h: 2 }, msg: 'STAMFORD BRIDGE', sub: 'CAREFREE, WHEREVER YOU MAY BE...', dur: 2.4, color: '#a8c8ff', action: () => { audio.chant && audio.chant(); } },
    { area: { x: 4, y: 30, w: 9, h: 2 }, msg: 'THE SHED END', sub: '...WHAT\'S LEFT OF IT', dur: 2.2 },
    { area: { x: 6, y: 31, w: 8, h: 2 }, toast: 'WATCH THE HOIST! RED LIGHT = BRICKS INCOMING' },
    { area: { x: 14, y: 32, w: 3, h: 3 }, toast: 'THE SCAFFOLD TAKES YOUR WEIGHT. JUMP UP. SOMETHING\'S ON THE TOP LIFT.' },
    { area: { x: 9, y: 43, w: 8, h: 2 }, msg: 'THE AWAY SECTION', sub: 'YOUR LOT ARE UP THE BACK. SO ARE THEIRS.', dur: 2.4, color: '#ff8a8a', action: () => { audio.chant && audio.chant(); } },
    { area: { x: 26, y: 43, w: 3, h: 3 }, msg: 'THE PLAYERS\' CAR PARK', sub: 'NICE MOTORS. SHAME.', dur: 2.2 },
  ],
  secrets: [
    { id: 'stoneisland', x: 46, y: 4, msg: 'STONE ISLAND, FIVE FINGER DISCOUNT', score: 1500 },
    { id: 'stockroom', x: 48, y: 1, w: 3, h: 2, msg: 'THE BOUTIQUE STOCKROOM', score: 2000 },
    { id: 'toplift', x: 21, y: 30, w: 3, h: 1, msg: 'ON THE TOP LIFT', score: 800 },
    { id: 'canteen', x: 25, y: 38, w: 3, h: 2, msg: 'THE SITE CANTEEN', score: 1200 },
  ],
  encounters: [
    {
      id: 'tickethall', area: { x: 1, y: 7, w: 18, h: 2 }, lockArea: { x: 1, y: 1, w: 17.9, h: 10.9 },
      msg: 'WELCOME TO SW6', sub: 'THEY WERE WAITING AT THE BARRIERS', goTo: { x: 7, y: 11, w: 5, h: 2 },
      waves: [
        { enemies: [
          { type: 'stamfordbridge_casual', x: 6.5, y: 8.5, from: { x: 9.5, y: 12.5 } },
          { type: 'stamfordbridge_casual', x: 12.5, y: 9.5, from: { x: 9.5, y: 12.5 } },
          { type: 'stamfordbridge_casual', x: 5.5, y: 4.5, from: { x: 2.5, y: 2.5 } },
        ] },
        { nextAt: 1, msg: 'MORE UP THE STAIRS!', enemies: [
          { type: 'stamfordbridge_cityboy', x: 10.5, y: 9.5, from: { x: 9.5, y: 13.5 } },
          { type: 'stamfordbridge_casual', x: 15.5, y: 8.5, from: { x: 16.5, y: 2.5 } },
          { type: 'stamfordbridge_casual', x: 3.5, y: 4.5, from: { x: 2.5, y: 2.5 }, delay: 1.5 },
        ] },
        { nextAt: 1, enemies: [
          { type: 'stamfordbridge_cityboy', x: 13.5, y: 4.5, from: { x: 16.5, y: 2.5 } },
          { type: 'stamfordbridge_casual', x: 5.5, y: 9.5, from: { x: 2.5, y: 2.5 } },
          { type: 'stamfordbridge_casual', x: 9.5, y: 8.5, from: { x: 9.5, y: 12.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'fulhamroad', area: { x: 5, y: 13, w: 9, h: 2 }, lockArea: { x: 1, y: 13, w: 38.9, h: 8.9 },
      msg: 'THE BLUE LION EMPTIES!', sub: 'THEY BROUGHT THEIR PINTS', goTo: { x: 26, y: 20, w: 4, h: 2 }, clearMsg: 'THE BRITANNIA GATE IS OPEN!',
      waves: [
        { enemies: [
          { type: 'stamfordbridge_casual', x: 24.5, y: 15.5, from: { x: 28.5, y: 11.5 } },
          { type: 'stamfordbridge_casual', x: 30.5, y: 16.5, from: { x: 31.5, y: 11.5 } },
          { type: 'stamfordbridge_cityboy', x: 20.5, y: 14.5, from: { x: 28.5, y: 11.5 } },
          { type: 'bottler', x: 34.5, y: 13.5, from: { x: 31.5, y: 11.5 } },
        ] },
        { nextAt: 1, msg: 'UP AND DOWN THE ROAD!', enemies: [
          { type: 'stamfordbridge_casual', x: 14.5, y: 19.5, from: { x: -1.5, y: 19.5 } },
          { type: 'stamfordbridge_casual', x: 33.5, y: 19.5, from: { x: 40.5, y: 20.5 } },
          { type: 'stamfordbridge_cityboy', x: 25.5, y: 20.5, from: { x: 27.5, y: 23.5 } },
        ] },
        { nextAt: 1, msg: 'HEADHUNTERS!', enemies: [
          { type: 'firm', x: 22.5, y: 17.5, from: { x: 28.5, y: 11.5 } },
          { type: 'stamfordbridge_casual', x: 16.5, y: 15.5, from: { x: -1.5, y: 13.5 } },
          { type: 'stamfordbridge_casual', x: 30.5, y: 14.5, from: { x: 31.5, y: 11.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'kingsroad', area: { x: 44, y: 9, w: 8, h: 3 }, lockArea: { x: 42, y: 4, w: 11.9, h: 8.9 },
      msg: 'SHOPPING TRIP', sub: 'THEY DON\'T LIKE BROWSERS', goTo: { x: 44, y: 12, w: 6, h: 1 },
      waves: [
        { enemies: [
          { type: 'stamfordbridge_cityboy', x: 47.5, y: 6.5, from: { x: 45.5, y: 3.5 } },
          { type: 'stamfordbridge_casual', x: 50.5, y: 8.5, from: { x: 52.5, y: 3.5 } },
        ] },
        { nextAt: 0, enemies: [
          { type: 'stamfordbridge_cityboy', x: 44.5, y: 10.5, from: { x: 41.5, y: 9.5 } },
          { type: 'stamfordbridge_casual', x: 49.5, y: 5.5, from: { x: 45.5, y: 3.5 } },
          { type: 'stamfordbridge_casual', x: 51.5, y: 10.5, from: { x: 55.5, y: 10.5 } },
        ] },
      ],
    },
    {
      id: 'forecourt', area: { x: 24, y: 23, w: 8, h: 2 }, lockArea: { x: 1, y: 23, w: 55.9, h: 5.9 },
      msg: 'FROM BOTH SIDES!', sub: 'STICK TOGETHER', goTo: { x: 4, y: 27, w: 9, h: 2 },
      waves: [
        { enemies: [
          { type: 'stamfordbridge_casual', x: 14.5, y: 25.5, from: { x: -0.5, y: 25.5 } },
          { type: 'stamfordbridge_casual', x: 40.5, y: 25.5, from: { x: 57.5, y: 25.5 } },
          { type: 'stamfordbridge_cityboy', x: 20.5, y: 27.5, from: { x: 7.5, y: 30.5 } },
          { type: 'stamfordbridge_cityboy', x: 36.5, y: 27.5, from: { x: 57.5, y: 26.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'stamfordbridge_casual', x: 10.5, y: 26.5, from: { x: -0.5, y: 24.5 } },
          { type: 'stamfordbridge_casual', x: 46.5, y: 26.5, from: { x: 57.5, y: 24.5 } },
          { type: 'bottler', x: 30.5, y: 27.5, from: { x: 9.5, y: 30.5 } },
          { type: 'stamfordbridge_scaffolder', x: 18.5, y: 26.5, from: { x: 11.5, y: 30.5 } },
        ] },
        { nextAt: 1, msg: 'THEIR TOP BOYS!', enemies: [
          { type: 'firm', x: 27.5, y: 25.5, from: { x: 57.5, y: 25.5 } },
          { type: 'stamfordbridge_casual', x: 22.5, y: 24.5, from: { x: -0.5, y: 26.5 } },
          { type: 'stamfordbridge_casual', x: 37.5, y: 24.5, from: { x: 57.5, y: 27.5 } },
          { type: 'stamfordbridge_cityboy', x: 12.5, y: 27.5, from: { x: 5.5, y: 30.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'buildingsite', area: { x: 4, y: 30, w: 9, h: 2 }, lockArea: { x: 1, y: 30, w: 29.9, h: 11.9 },
      msg: 'OI! SITE\'S CLOSED!', sub: 'THE SCAFFOLDERS ARE HEADHUNTERS TOO', goTo: { x: 12, y: 40, w: 3, h: 2 }, clearMsg: 'THE AWAY SECTION GATE IS OPEN!',
      waves: [
        { enemies: [
          { type: 'stamfordbridge_scaffolder', x: 12.5, y: 36.5, from: { x: 26.5, y: 33.5 } },
          { type: 'stamfordbridge_scaffolder', x: 20.5, y: 33.5, from: { x: 26.5, y: 34.5 } },
          { type: 'stamfordbridge_scaffolder', x: 7.5, y: 36.5, from: { x: -0.5, y: 38.5 } },
          { type: 'stamfordbridge_casual', x: 16.5, y: 38.5, from: { x: 13.5, y: 43.5 } },
        ] },
        { nextAt: 1, msg: 'THE GAFFER!', enemies: [
          { type: 'stamfordbridge_gaffer', x: 14.5, y: 35.5, from: { x: 26.5, y: 33.5 } },
          { type: 'stamfordbridge_scaffolder', x: 22.5, y: 38.5, from: { x: 26.5, y: 34.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'stamfordbridge_casual', x: 9.5, y: 32.5, from: { x: -0.5, y: 33.5 } },
          { type: 'stamfordbridge_scaffolder', x: 18.5, y: 40.5, from: { x: 13.5, y: 43.5 } },
          { type: 'stamfordbridge_cityboy', x: 22.5, y: 35.5, from: { x: 29.5, y: 30.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'awayend', area: { x: 9, y: 43, w: 8, h: 2 }, lockArea: { x: 1, y: 43, w: 23.9, h: 14.9 },
      msg: 'HEADHUNTERS IN THE AWAY END!', sub: 'BOLD AS BRASS', goTo: { x: 23, y: 43, w: 2, h: 2 }, clearMsg: 'THE CAR PARK GATE IS OPEN!',
      waves: [
        { enemies: [
          { type: 'stamfordbridge_casual', x: 8.5, y: 48.5, from: { x: 12.5, y: 57.5 } },
          { type: 'stamfordbridge_casual', x: 16.5, y: 49.5, from: { x: 16.5, y: 57.5 } },
          { type: 'stamfordbridge_cityboy', x: 20.5, y: 45.5, from: { x: 25.5, y: 44.5 } },
        ] },
        { nextAt: 1, msg: 'BEHIND YOU!', enemies: [
          { type: 'stamfordbridge_casual', x: 5.5, y: 44.5, from: { x: 13.5, y: 41.5 } },
          { type: 'stamfordbridge_casual', x: 19.5, y: 51.5, from: { x: 20.5, y: 57.5 } },
          { type: 'stamfordbridge_cityboy', x: 11.5, y: 47.5, from: { x: 25.5, y: 43.5 } },
          { type: 'stamfordbridge_casual', x: 14.5, y: 44.5, from: { x: 13.5, y: 41.5 }, delay: 2.5 },
        ] },
        { nextAt: 1, msg: 'THEIR TOP BOY!', enemies: [
          { type: 'firm', x: 12.5, y: 49.5, from: { x: 12.5, y: 57.5 } },
          { type: 'stamfordbridge_casual', x: 6.5, y: 51.5, from: { x: 4.5, y: 57.5 } },
        ] },
      ],
    },
  ],
  boss: {
    type: 'stamfordbridge_monty', x: 47.5, y: 50.5, title: 'MONTY \'THE BROLLY\' FAIRWEATHER', intro: 'HEADHUNTERS TOP BOY. NEVER RUNS. NEVER SWEATS.',
    area: { x: 26, y: 43, w: 6, h: 14.9 }, lockArea: CARPARK,
    minions: [
      { type: 'stamfordbridge_casual', x: 43.5, y: 48.5 },
      { type: 'stamfordbridge_cityboy', x: 49.5, y: 52.5 },
    ],
  },
  sbCrewFrom: [{ x: 57.5, y: 45.5 }, { x: 57.5, y: 55.5 }, { x: 41.5, y: 42.5 }],
  exit: { x: 57, y: 49, w: 1.2, h: 2 },

  onStart(world) {
    world.__sbLvl = { leafT: 0, gafferTold: false, forecourtTold: false, chants: [3] };
  },

  onUpdate(world, dt) {
    const S = world.__sbLvl || (world.__sbLvl = { leafT: 0, gafferTold: false, forecourtTold: false, chants: [] });
    for (let i = S.chants.length - 1; i >= 0; i--) { S.chants[i] -= dt; if (S.chants[i] <= 0) { S.chants.splice(i, 1); audio.chant && audio.chant(); } }
    const p = world.player;
    if (!p) return;
    // autumn leaves drifting down outdoors (not in the tube)
    S.leafT -= dt;
    if (S.leafT <= 0 && p.y > 12.5) {
      S.leafT = 0.35 + Math.random() * 0.4;
      const col = ['#c8641e', '#a04a14', '#d89a2a', '#8a5a1a', '#b8301a'][Math.floor(Math.random() * 5)];
      world.fx.add({ x: p.x + (Math.random() - 0.3) * 12, y: p.y + (Math.random() - 0.7) * 10, z: 4 + Math.random() * 2, vx: 0.6 + Math.random() * 0.6, vy: (Math.random() - 0.5) * 0.4, vz: -0.4, life: 4.5, color: col, size: 2, g: 0.08, kind: 'confetti', drag: 0.6, ph: Math.random() * 6 });
    }
    // teach the pin on the big man
    if (!S.gafferTold && world.fighters.some(f => f.type === 'stamfordbridge_gaffer' && f.alive && !f.controller.goal)) {
      S.gafferTold = true;
      world.toast(world.firm ? `BIG MAN! HOLD ${input.hint('command')} + ${input.hint('grab')} ON HIM: A LAD PINS HIM, YOU HIT HIM FOR FREE` : 'BIG MAN! DON\'T TRADE PUNCHES. DODGE THE CHARGE.');
    }
    // the forecourt: outnumbered from both sides
    if (!S.forecourtTold && world.encounters.some(e => e.id === 'forecourt' && e.state === 'active')) {
      S.forecourtTold = true;
      world.toast(world.firm ? `OUTNUMBERED! KEEP THE LADS CLOSE: BACK TO ME (${input.hint('orderRegroup')}), SING UP (${input.hint('orderSing')})` : 'OUTNUMBERED! KEEP YOUR BACK TO A WALL');
    }
  },

  onEncounterClear(world, e) {
    const S = world.__sbLvl; if (S) S.chants.push(0.6);
    if (e.id === 'fulhamroad') { openTagged(world, 'britannia'); world.toast('THROUGH THE BRITANNIA GATE. OR: THE KING\'S ROAD IS UP THE MEWS...'); }
    if (e.id === 'buildingsite') { openTagged(world, 'awayGate'); world.toast('THE AWAY SECTION. YOUR LOT ARE IN THERE.'); }
    if (e.id === 'awayend') { openTagged(world, 'carparkGate'); world.toast('MONTY IS WAITING IN THE PLAYERS\' CAR PARK...'); }
  },

  onBossDefeated(world, boss) {
    openTagged(world, 'exitGate');
    world.fx.confetti(boss.x, boss.y, 1.5, [RED, WHITE, '#f4f0e4'], 30);
    world.toast('MONTY HAS LEFT HIS CARD. OUT THROUGH THE GATE, ONTO THE FULHAM ROAD!');
    const S = world.__sbLvl; if (S) { S.chants.push(0.4); S.chants.push(4); }
  },
};
