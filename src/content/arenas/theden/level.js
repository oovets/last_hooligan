// TOUR ARENA — THE DEN (MILLWALL, THE LIONS). Firm: THE BUSHWACKERS. Bermondsey, London SE16.
// A raw grey Saturday in 1994. The train from London Bridge stops at South Bermondsey and the Bushwackers are on the
// platform. Nobody likes them. They don't care.
//
// Route: SOUTH BERMONDSEY platform (off the train, straight into it; trains through on the line behind you)
//        -> the BOOKING HALL -> THE CAGE: the fenced walkway to the ground, two lads wide, ambushed from both ends
//           (a cut in the fence -> the railway embankment, a scarf, and the trains)
//        -> UNDER THE ARCHES: lock-ups, car breakers, a brazier; trains rumble over the viaduct and shake loose
//           bricks out of the arches (secret: LOCK-UP 23 behind a roller door that isn't locked)
//        -> the BREAKERS' YARD (scrap piles, a crushed-car stack to climb, THE LUMPER: the big man to pin)
//        -> ZAMPA ROAD, the industrial estate (vans both ways; secret: the back of the transport cafe)
//        -> COLD BLOW LANE under the stand's turnstiles (police horses, a van, the home lot behind the railings)
//        -> BOSS on the forecourt: DOUG "THE DOCKER" CRATCHLEY -> out through the gate with the police escort.
// Everyone named here is invented; the firm, club, ground and streets are real. Map: rect fills (buildMap), 60 x 64.
import '../../themes/common.js';
import '../../themes/derby.js';            // reuse: derby_sign, derby_banner, derby_stall, derby_burgerVan
import '../../themes/laststand.js';        // reuse: laststand_policevan
import './theme.js';
import './boss.js';
import './music.js';
import { segments } from '../../themes/derby.js';
import { NAVY, WHITE, archTrain, brickDrop, spawnStationTrain, addViaductTrain, drawSkyline, VIA } from './theme.js';
import { audio } from '../../../audio/audio.js';

const RED = '#c8102e', GOLD = '#e8c040';
const STAFF = 'theden_staff';              // key nobody carries: these gates are opened by the level script
const W = 60, H = 64;
const BOSS_ARENA = { x: 7, y: 56, w: 51.9, h: 6.9 };
const ARCH_ZONES = [10, 17, 26, 35];       // where the passing trains shake bricks out of the arches
const noDraw = () => {};

// ------------------------------------------------------------------ map
function buildMap() {
  const g = Array.from({ length: H }, () => Array(W).fill(' '));
  const F = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
  const arches = (x0, x1, y, fake = false) => { for (let x = x0; x <= x1; x++) g[y][x] = String((x + 1) % 3 + (fake ? 3 : 0)); };
  // ===== SOUTH BERMONDSEY (y 0-10): back wall, the line, the platform, the booking hall, the embankment
  F(0, 0, 59, 0, 'X'); F(0, 1, 59, 2, 'R');
  F(0, 3, 0, 37, 'X');
  F(1, 3, 34, 3, 'e'); F(1, 4, 34, 8, 'p'); F(1, 9, 34, 9, 'f');
  F(35, 3, 47, 3, 'Q'); F(35, 4, 35, 10, 'q'); F(35, 5, 35, 7, 'h'); F(36, 4, 46, 9, 'h'); F(47, 4, 47, 10, 'q');
  F(35, 10, 47, 10, 'q'); F(44, 10, 45, 10, 'h');
  F(48, 3, 59, 21, 'g'); F(1, 10, 34, 13, 'g'); F(35, 11, 42, 13, 'g');
  // ===== THE CAGE: the fenced walkway (x 44-45, y 11-25)
  F(43, 11, 43, 23, 'c'); F(44, 11, 45, 25, 'n'); F(46, 11, 46, 25, 'c'); F(46, 17, 46, 17, 'C');
  F(47, 22, 59, 22, 'c');
  // ===== THE VIADUCT (y 14-18) and the lane under the arches (y 19-25)
  F(0, 14, 42, 15, 't'); F(0, 16, 42, 17, 'v'); arches(0, 42, 18);
  F(5, 16, 7, 18, 'i'); F(29, 16, 31, 18, 'i'); F(38, 16, 40, 18, 'i');      // open lock-ups
  F(19, 16, 23, 17, 'i'); arches(20, 22, 18, true);                          // LOCK-UP 23 (the door isn't locked)
  F(1, 19, 42, 25, 's'); F(43, 24, 43, 25, 's');
  // ===== the breakers' yard (x 1-28, y 27-36) and the Zampa Road units (x 30-59, y 23-37)
  F(0, 26, 29, 26, 'L'); F(12, 26, 14, 26, 'y');
  F(1, 27, 28, 36, 'y'); F(29, 26, 29, 37, 'k'); F(0, 37, 29, 37, 'k'); F(13, 37, 15, 37, 'y');
  F(3, 28, 5, 29, 'S'); F(22, 33, 25, 34, 'S');                               // crushed-car stacks
  F(47, 23, 59, 25, 'U'); F(30, 26, 59, 37, 'U');
  F(33, 34, 37, 36, 'j'); F(34, 37, 36, 37, 'P');                             // the transport cafe (fake front)
  // ===== ZAMPA ROAD (y 38-44)
  F(0, 38, 0, 62, 'X'); F(59, 38, 59, 44, 'X');
  F(1, 38, 58, 38, ','); F(1, 39, 58, 39, 'K'); F(1, 40, 58, 42, 'r'); F(1, 41, 58, 41, '-'); F(1, 43, 58, 44, ',');
  // ===== THE DEN: railings, the home lot's pen, the stand (east face = turnstiles), the railway bridge to the west
  F(0, 45, 51, 45, 'I'); F(0, 46, 11, 55, 'v'); arches(0, 11, 55);
  F(12, 46, 50, 55, 'V'); F(51, 46, 51, 47, 'V'); F(51, 48, 51, 55, 'T');
  F(52, 45, 58, 55, 'b'); F(59, 45, 59, 62, 'L');
  // ===== the forecourt (y 56-62); the exit gate in the railings at x 6
  F(1, 56, 58, 62, 'F'); F(6, 56, 6, 62, 'I'); F(6, 58, 6, 60, 'F');
  F(14, 61, 44, 61, 'I');                                                    // the home lot's pen along the south side
  F(0, 63, 59, 63, 'I');
  return g.map(r => r.join(''));
}

function openTagged(world, tag) {
  for (const p of world.props) if (p.o.tag === tag) p.open = true;
  world.rebuildPropGrid();
}
const gate = (x, y, tag, msg, dir = 'x') => ({ type: 'gate', x, y, dir, key: STAFF, tag, color: '#14306a', lockedMsg: msg });
const arch = (k, fake) => ({ floor: 'theden_archFloor', wall: 'theden_arch' + k, h: 4.5, ...(fake ? { solid: false, fake: true } : {}) });
const inRect = (p, x0, y0, x1, y1) => p.x >= x0 && p.y >= y0 && p.x <= x1 && p.y <= y1;
// the home lot penned in behind the railings on the south side of the forecourt (they jeer the boss fight)
const homeFans = [];
for (let x = 15; x <= 43; x++) homeFans.push({ type: 'theden_fans', x, y: 62, single: x % 2 === 1, flip: x > 29 });

export default {
  id: 'theden',
  tour: true,
  num: 9,
  name: 'THE DEN',
  subtitle: 'SATURDAY. 14:15. SOUTH BERMONDSEY. GREY.',
  intro: [
    'AWAY DAY: THE DEN, BERMONDSEY SE16.',
    'NO ONE LIKES THEM. THEY DON\'T CARE.',
    'THE BUSHWACKERS KNOW WHICH TRAIN YOU\'RE ON.',
    'COLD BLOW LANE IS NOT A PLACE FOR TOURISTS.',
  ],
  music: 'theden',
  crowd: 0.75,
  weather: null,
  ambient: { dark: 0.38, color: '#10141e', playerLight: 3 },
  bg: '#0b0d14',
  fog: 'rgba(150,160,180,0.05)',
  extraTokens: 1,
  defaultFloor: 'pavement',
  start: { x: 4.5, y: 6.5 },
  startFacing: { x: 1, y: 0 },
  legend: {
    'X': { floor: 'pavement', wall: 'theden_stationWall', h: 3.2 },
    'R': { floor: 'theden_track' },
    'e': { floor: 'theden_platEdge' },
    'p': { floor: 'theden_platform' },
    'f': { floor: 'theden_platform', wall: 'theden_fence', h: 1.6 },
    'Q': { floor: 'theden_hall', wall: 'theden_hallFront', h: 3 },
    'q': { floor: 'theden_hall', wall: 'theden_hallLow', h: 1.4 },
    'h': { floor: 'theden_hall' },
    'g': { floor: 'theden_scrub' },
    'c': { floor: 'theden_walkway', wall: 'theden_fence', h: 2 },
    'C': { floor: 'theden_walkway', wall: 'theden_fenceCut', h: 2, solid: false, fake: true },
    'n': { floor: 'theden_walkway' },
    't': { floor: 'theden_archFloor', wall: 'theden_viaductTrack', h: 4.5 },
    'v': { floor: 'theden_archFloor', wall: 'theden_viaduct', h: 4.5 },
    '0': arch(0), '1': arch(1), '2': arch(2),
    '3': arch(0, true), '4': arch(1, true), '5': arch(2, true),
    'i': { floor: 'theden_archFloor' },
    's': { floor: 'theden_setts' },
    'L': { floor: 'pavement', wall: 'theden_lowWall', h: 1.2 },
    'y': { floor: 'theden_yard' },
    'k': { floor: 'theden_yard', wall: 'theden_corrugated', h: 1.8 },
    'S': { floor: 'theden_yard', wall: 'theden_scrapStack', h: 1.2 },
    'U': { floor: 'concrete', wall: 'theden_unit', h: 3 },
    'P': { floor: 'theden_cafe', wall: 'theden_cafeFront', h: 3, solid: false, fake: true },
    'j': { floor: 'theden_cafe' },
    ',': { floor: 'pavement' },
    'K': { floor: 'kerbX' },
    'r': { floor: 'road' },
    '-': { floor: 'roadLineX' },
    'I': { floor: 'theden_forecourt', wall: 'theden_railings', h: 1.3 },
    'F': { floor: 'theden_forecourt' },
    'b': { floor: 'theden_lane' },
    'V': { floor: 'concrete', wall: 'theden_stand', h: 4 },
    'T': { floor: 'concrete', wall: 'theden_turnstiles', h: 4 },
  },
  map: buildMap(),
  items: [
    // ---- the five lost scarves
    { type: 'scarf', x: 56.5, y: 5.5 },                         // on the railway embankment (down the line or through the fence)
    { type: 'scarf', x: 5.5, y: 16.5 },                         // at the back of the car breakers' arch
    { type: 'scarf', x: 4.5, y: 28.5, z: 1.2 },                 // on top of the crushed-car stack (jump)
    { type: 'scarf', x: 35.5, y: 34.5 },                        // the back of the transport cafe
    { type: 'scarf', x: 1.5, y: 38.5 },                         // the dead end of Zampa Road
    // ---- the pin badge: LOCK-UP 23
    { type: 'badge', x: 21.5, y: 16.5 },
    { type: 'cash20', x: 22.5, y: 17.5 }, { type: 'cash20', x: 19.5, y: 16.5 },
    { type: 'fanzine', x: 3.5, y: 7.5, title: 'THE NORDHAMN ANCHOR LINE #21: AWAY DAY SPECIAL', text: 'THE DEN. GET OFF AT SOUTH BERMONDSEY AND STICK TOGETHER: THE WALKWAY TO THE GROUND IS A CAGE AND THE BUSHWACKERS KNOW BOTH ENDS OF IT. THEIR TOP MAN IS DOUG "THE DOCKER" CRATCHLEY: FLAT CAP, DONKEY JACKET, HANDS LIKE SHOVELS. WHEN HE SHOUTS "HOOK!" GET OUT OF RANGE OR HE REELS YOU IN FOR THE NUT. WHEN HE PLANTS HIS FEET, SIDESTEP: HE CHARGES LIKE A DRAY HORSE AND DOESN\'T STOP FOR VANS. ALSO: THE ARCHES SHAKE WHEN A TRAIN GOES OVER. WATCH YOUR HEAD.' },
    { type: 'fanzine', x: 34.5, y: 35.5, title: 'SOUTH LONDON PRESS, SATURDAY', text: 'TRADERS ON ZAMPA ROAD COMPLAIN OF "LARGE GROUPS OF MEN" EVERY OTHER SATURDAY. THE TRANSPORT CAFE SAYS BUSINESS HAS NEVER BEEN BETTER. A SPOKESMAN FOR THE CLUB SAID NOBODY LIKES THEM AND THEY DON\'T CARE.' },
    // ---- health between fights
    { type: 'pie', x: 15.5, y: 7.5 },
    { type: 'theden_tea', x: 39.5, y: 8.5 },
    { type: 'pint', x: 44.5, y: 21.5 },
    { type: 'theden_tea', x: 8.5, y: 25.5 },
    { type: 'theden_pieMash', x: 36.5, y: 35.5 },
    { type: 'kebab', x: 26.5, y: 30.5 },
    { type: 'pint', x: 5.5, y: 43.5 },
    { type: 'energy', x: 55.5, y: 44.5 },
    { type: 'theden_tea', x: 54.5, y: 56.5 },
    { type: 'pie', x: 3.5, y: 25.5 },
    // ---- weapons
    { type: 'bottle', x: 30.5, y: 7.5 },
    { type: 'theden_wheelbrace', x: 6.5, y: 17.5 },
    { type: 'theden_hubcap', x: 25.5, y: 20.5 },
    { type: 'brick', x: 33.5, y: 24.5 },
    { type: 'pipe', x: 16.5, y: 31.5 },
    { type: 'binlid', x: 40.5, y: 43.5 },
    { type: 'bottle', x: 53.5, y: 46.5 },
    { type: 'coin', x: 22.5, y: 6.5 }, { type: 'coin', x: 45.5, y: 18.5 }, { type: 'cash5', x: 12.5, y: 21.5 },
    { type: 'coin', x: 21.5, y: 35.5 }, { type: 'cash5', x: 48.5, y: 43.5 }, { type: 'coin', x: 56.5, y: 60.5 },
  ],
  props: [
    // ================= SOUTH BERMONDSEY platform
    { type: 'theden_stationBoard', x: 8, y: 4 },
    { type: 'theden_stationBoard', x: 26, y: 4 },
    { type: 'bench', x: 12, y: 8 }, { type: 'bench', x: 22, y: 8 }, { type: 'bin', x: 18, y: 8 },
    { type: 'lamp', x: 4, y: 8 }, { type: 'lamp', x: 16, y: 4 }, { type: 'lamp', x: 31, y: 8 },
    ...segments({ type: 'derby_sign', x: 3, y: 0, len: 6, z: 1.6, height: 0.6, text: 'NETWORK SOUTHEAST', color: WHITE, bg: '#1a3a8a' }),
    ...segments({ type: 'derby_sign', x: 13, y: 0, len: 7, z: 1.6, height: 0.6, text: 'FOR THE DEN: WAY OUT', color: '#1a1a2a', bg: '#e8c040' }),
    ...segments({ type: 'derby_sign', x: 38, y: 0, len: 5, z: 1.8, height: 0.6, text: 'MIND THE GAP', color: '#ffe14a', bg: '#1a1a1e' }),
    { type: 'graffiti', x: 24, y: 0, side: 'left', z: 0.7, text: 'MILLWALL', color: '#3a6ad8' },
    // ================= the booking hall
    ...segments({ type: 'derby_sign', x: 36, y: 3, len: 4, z: 2.0, height: 0.6, text: 'BOOKING HALL', color: WHITE, bg: RED }),
    ...segments({ type: 'derby_sign', x: 41, y: 3, len: 3, z: 1.6, height: 0.6, text: 'TICKETS', color: WHITE, bg: '#1a3a8a' }),
    { type: 'barrier', x: 40, y: 5, dir: 'y' }, { type: 'barrier', x: 40, y: 7, dir: 'y' },
    { type: 'bench', x: 37, y: 9 }, { type: 'bin', x: 46, y: 4 },
    gate(35, 5, 'hallDoor', 'THE BARRIERS ARE SHUT. DEAL WITH THE PLATFORM FIRST.', 'y'),
    gate(35, 6, 'hallDoor', 'THE BARRIERS ARE SHUT. DEAL WITH THE PLATFORM FIRST.', 'y'),
    gate(35, 7, 'hallDoor', 'THE BARRIERS ARE SHUT. DEAL WITH THE PLATFORM FIRST.', 'y'),
    gate(44, 10, 'hallExit', 'THE WAY OUT IS SHUT. CLEAR THE HALL FIRST.'),
    gate(45, 10, 'hallExit', 'THE WAY OUT IS SHUT. CLEAR THE HALL FIRST.'),
    // the wasteland between the platform and the viaduct (set dressing)
    { type: 'theden_burntCar', x: 9, y: 11 }, { type: 'theden_tyres', x: 20, y: 12 }, { type: 'rubble', x: 28, y: 11 },
    { type: 'skip', x: 36, y: 12 }, { type: 'tree', x: 3, y: 12 }, { type: 'tree', x: 32, y: 10 },
    // ================= THE CAGE + the embankment
    ...segments({ type: 'derby_sign', x: 43, y: 12, side: 'right', len: 4, z: 1.0, height: 0.5, text: 'TO THE GROUND', color: WHITE, bg: NAVY }),
    { type: 'lamp', x: 42, y: 20 },
    { type: 'tree', x: 52, y: 9 }, { type: 'tree', x: 56, y: 15 }, { type: 'tree', x: 49, y: 19 }, { type: 'rubble', x: 53, y: 12 },
    // ================= UNDER THE ARCHES
    ...segments({ type: 'derby_sign', x: 1, y: 18, len: 4, z: 3.0, height: 0.6, text: 'CAR BREAKERS', color: '#ffe14a', bg: '#3a1a14' }),
    ...segments({ type: 'derby_sign', x: 8, y: 18, len: 4, z: 3.0, height: 0.6, text: 'MOT & REPAIRS', color: WHITE, bg: '#1a3a5a' }),
    ...segments({ type: 'derby_sign', x: 14, y: 18, len: 4, z: 1.4, height: 0.5, text: 'NO PARKING', color: WHITE, bg: RED }),
    ...segments({ type: 'derby_sign', x: 20, y: 18, len: 4, z: 3.0, height: 0.5, text: 'LOCK-UP 23', color: '#c8c8c0', bg: '#2a2a2e' }),
    ...segments({ type: 'derby_sign', x: 32, y: 18, len: 6, z: 3.0, height: 0.6, text: 'TYRES & EXHAUSTS', color: WHITE, bg: '#2a5a3a' }),
    ...segments({ type: 'derby_sign', x: 41, y: 18, len: 2, z: 3.0, height: 0.6, text: 'CASH', color: '#1a1a1a', bg: '#e8c040' }),
    ...segments({ type: 'derby_banner', x: 24, y: 18, len: 5, z: 2.2, height: 0.7, text: 'NO ONE LIKES US', a: NAVY, b: WHITE, color: WHITE }),
    { type: 'graffiti', x: 12, y: 18, side: 'left', z: 0.9, text: 'LIONS', color: '#e8e8e8' },
    { type: 'graffiti', x: 36, y: 18, side: 'left', z: 1.0, text: 'MFC', color: '#3a6ad8' },
    { type: 'theden_engine', x: 7, y: 16 },
    { type: 'theden_brazier', x: 13, y: 20 }, { type: 'theden_brazier', x: 34, y: 20 },
    { type: 'theden_tyres', x: 28, y: 19 }, { type: 'theden_tyres', x: 32, y: 19 }, { type: 'theden_tyres', x: 37, y: 19 },
    { type: 'theden_teaChest', x: 24, y: 19 }, { type: 'theden_teaChest', x: 3, y: 23 },
    { type: 'car', x: 9, y: 23, color: '#6a6a40' },
    { type: 'lamp', x: 2, y: 25 }, { type: 'lamp', x: 20, y: 25 }, { type: 'lamp', x: 39, y: 25 },
    // ================= the breakers' yard
    ...segments({ type: 'derby_sign', x: 7, y: 26, len: 4, z: 0.3, height: 0.5, text: 'ACE BREAKERS', color: '#ffe14a', bg: '#3a1a14' }),
    ...segments({ type: 'derby_sign', x: 2, y: 37, len: 10, z: 0.6, height: 0.6, text: 'ACE BREAKERS - CASH FOR CARS', color: '#1a1a1a', bg: '#e8c040' }),
    ...segments({ type: 'derby_sign', x: 18, y: 37, len: 6, z: 0.6, height: 0.6, text: 'BEWARE OF THE DOG', color: WHITE, bg: RED }),
    { type: 'theden_scrapPile', x: 9, y: 33, v: 0 }, { type: 'theden_scrapPile', x: 19, y: 29, v: 1 },
    { type: 'theden_tyres', x: 26, y: 28 }, { type: 'theden_tyres', x: 27, y: 28 }, { type: 'theden_engine', x: 2, y: 35 },
    { type: 'theden_burntCar', x: 5, y: 32 }, { type: 'theden_teaChest', x: 17, y: 36 },
    { type: 'theden_brazier', x: 12, y: 30 },
    gate(13, 37, 'yardGate', 'THE YARD GATE IS CHAINED. SORT THE YARD OUT FIRST.'),
    gate(14, 37, 'yardGate', 'THE YARD GATE IS CHAINED. SORT THE YARD OUT FIRST.'),
    gate(15, 37, 'yardGate', 'THE YARD GATE IS CHAINED. SORT THE YARD OUT FIRST.'),
    // ================= ZAMPA ROAD
    ...segments({ type: 'derby_sign', x: 39, y: 37, len: 4, z: 2.3, height: 0.5, text: 'ZAMPA RD SE16', color: '#1a1a1a', bg: WHITE }),
    ...segments({ type: 'derby_sign', x: 33, y: 37, len: 5, z: 2.4, height: 0.5, text: 'TRANSPORT CAFE', color: WHITE, bg: RED }),
    ...segments({ type: 'derby_sign', x: 44, y: 37, len: 6, z: 2.4, height: 0.5, text: 'DOCKSIDE MOTORS', color: WHITE, bg: '#1a3a8a' }),
    ...segments({ type: 'derby_sign', x: 52, y: 37, len: 5, z: 2.4, height: 0.5, text: 'UNIT 9: TIMBER', color: '#1a1a1a', bg: '#c8a060' }),
    { type: 'lamp', x: 8, y: 44 }, { type: 'lamp', x: 24, y: 44 }, { type: 'lamp', x: 40, y: 44 }, { type: 'lamp', x: 54, y: 38 },
    { type: 'phonebox', x: 46, y: 38 }, { type: 'bollard', x: 20, y: 38 }, { type: 'bollard', x: 30, y: 38 },
    { type: 'skip', x: 2, y: 43 },
    // ================= COLD BLOW LANE
    ...segments({ type: 'derby_sign', x: 51, y: 47, side: 'right', len: 5, z: 3.0, height: 0.6, text: 'COLD BLOW LANE', color: '#1a1a1a', bg: WHITE }),
    ...segments({ type: 'derby_sign', x: 51, y: 52, side: 'right', len: 4, z: 2.2, height: 0.5, text: 'TURNSTILES', color: WHITE, bg: NAVY }),
    { type: 'laststand_policevan', x: 57, y: 47, dir: 'y' },
    { type: 'theden_policeHorse', x: 52, y: 53 },
    { type: 'barrier', x: 55, y: 45 }, { type: 'barrier', x: 56, y: 55 },
    { type: 'lamp', x: 58, y: 53 },
    // ================= THE FORECOURT
    ...segments({ type: 'derby_sign', x: 22, y: 55, len: 6, z: 2.6, height: 0.8, text: 'THE DEN', color: WHITE, bg: NAVY }),
    ...segments({ type: 'derby_sign', x: 33, y: 55, len: 9, z: 2.7, height: 0.6, text: 'MILLWALL FOOTBALL CLUB', color: WHITE, bg: NAVY }),
    { type: 'theden_lion', x: 30, y: 55, z: 2.6, big: true },
    { type: 'theden_lion', x: 18, y: 55, z: 2.2 }, { type: 'theden_lion', x: 46, y: 55, z: 2.2 },
    ...segments({ type: 'derby_sign', x: 1, y: 55, len: 5, z: 2.4, height: 0.5, text: 'TO THE STATION', color: '#1a1a1a', bg: '#e8c040' }),
    { type: 'derby_stall', x: 14, y: 56, a: NAVY, b: WHITE, text: 'PROGRAMMES £1.50' },
    { type: 'derby_burgerVan', x: 40, y: 56 },
    { type: 'laststand_policevan', x: 9, y: 61 },
    { type: 'laststand_policevan', x: 46, y: 61 },
    { type: 'theden_policeHorse', x: 24, y: 56, flip: true },
    ...homeFans,
    ...segments({ type: 'derby_banner', x: 16, y: 61, len: 6, z: 0.15, height: 0.9, text: 'BERMONDSEY LIONS', a: WHITE, b: NAVY, color: NAVY }),
    ...segments({ type: 'derby_banner', x: 33, y: 61, len: 6, z: 0.15, height: 0.9, text: 'NO ONE LIKES US', a: NAVY, b: WHITE, color: WHITE }),
    { type: 'lamp', x: 8, y: 57 }, { type: 'lamp', x: 13, y: 60 }, { type: 'lamp', x: 52, y: 62 },
    { type: 'gate', x: 6, y: 58, dir: 'y', requiresExit: true, tag: 'exitGate', color: '#14306a', lockedMsg: 'THE OLD BILL HAVE SHUT THE GATE. THE DOCKER FIRST.' },
    { type: 'gate', x: 6, y: 59, dir: 'y', requiresExit: true, tag: 'exitGate', color: '#14306a', lockedMsg: 'THE OLD BILL HAVE SHUT THE GATE. THE DOCKER FIRST.' },
    { type: 'gate', x: 6, y: 60, dir: 'y', requiresExit: true, tag: 'exitGate', color: '#14306a', lockedMsg: 'THE OLD BILL HAVE SHUT THE GATE. THE DOCKER FIRST.' },
    { type: 'exitArrow', x: 3, y: 59 },
  ],
  lights: [
    // platform lamps and the booking hall strip lights
    { x: 9, y: 6, z: 3, r: 6, color: '#fff0d0', intensity: 0.55 },
    { x: 24, y: 6, z: 3, r: 6, color: '#fff0d0', intensity: 0.5, flicker: true },
    { x: 41, y: 6, z: 2.6, r: 5, color: '#e8f4ff', intensity: 0.65 },
    // the cage
    { x: 44.5, y: 14, z: 2.5, r: 4, color: '#ffb050', intensity: 0.45 },
    { x: 44.5, y: 23, z: 2.5, r: 4, color: '#ffb050', intensity: 0.45, flicker: true },
    // arches: work lights in the open lock-ups, the lock-up 23 bulb
    { x: 6.5, y: 17.5, z: 2.2, r: 4, color: '#fff4c0', intensity: 0.7 },
    { x: 30.5, y: 17.5, z: 2.2, r: 4, color: '#fff4c0', intensity: 0.6, flicker: true },
    { x: 39.5, y: 17.5, z: 2.2, r: 4, color: '#fff4c0', intensity: 0.6 },
    { x: 21.5, y: 16.8, z: 1.8, r: 3, color: '#ffd080', intensity: 0.6 },
    { x: 22, y: 23, z: 4, r: 8, color: '#ffb060', intensity: 0.35 },
    // the yard, the cafe
    { x: 8, y: 31, z: 4, r: 7, color: '#ffc890', intensity: 0.4 },
    { x: 21, y: 33, z: 4, r: 7, color: '#ffc890', intensity: 0.4 },
    { x: 35, y: 35, z: 2, r: 3.5, color: '#fff0d0', intensity: 0.7 },
    // Zampa Road sodium
    { x: 14, y: 41, z: 4.5, r: 8, color: '#ffb050', intensity: 0.5 },
    { x: 32, y: 41, z: 4.5, r: 8, color: '#ffb050', intensity: 0.5 },
    { x: 50, y: 41, z: 4.5, r: 8, color: '#ffb050', intensity: 0.5 },
    // Cold Blow Lane + the forecourt floodlight spill
    { x: 55, y: 50, z: 4, r: 7, color: '#e8ecff', intensity: 0.5 },
    { x: 18, y: 59, z: 5, r: 9, color: '#f0f2ff', intensity: 0.5 },
    { x: 34, y: 59, z: 5, r: 9, color: '#f0f2ff', intensity: 0.5 },
    { x: 50, y: 59, z: 5, r: 9, color: '#f0f2ff', intensity: 0.5 },
  ],
  hazards: [
    // the London Bridge stopping train runs through the station (every 12-18 s, east to west)
    { type: 'traffic', id: 'denTrain', lane: [{ x: 68, y: 2 }, { x: -8, y: 2 }], interval: [12, 18], speed: 13, offset: 9, halfLen: 4.5, halfWidth: 0.72, dmg: 30, train: true, clip: [0, 60], draw: noDraw },
    // Zampa Road: vans and cars both ways
    { type: 'traffic', lane: [{ x: -6, y: 40.6 }, { x: 66, y: 40.6 }], interval: [6, 11], speed: 8, offset: 3, dmg: 16,
      mix: [{ style: 'car', colors: ['#8a2020', '#203a8a', '#d8d8d0', '#3a3a3e'], weight: 2 }, { style: 'van', colors: ['#e4e6ea'], weight: 2, dmg: 20 }] },
    { type: 'traffic', lane: [{ x: 66, y: 42.4 }, { x: -6, y: 42.4 }], interval: [7, 12], speed: 7.5, offset: 7, dmg: 16,
      mix: [{ style: 'car', colors: ['#2a6a3a', '#c8b020', '#d8d8d0', '#5a2a1a'], weight: 3 }, { style: 'van', colors: ['#e4e6ea'], weight: 1, dmg: 20 }] },
    // loose bricks shaken out of the arches after a train has gone over (hits anyone under them, their lot too)
    ...ARCH_ZONES.map(zx => ({ type: 'zone', area: { x: zx - 0.9, y: 19, w: 1.8, h: 1.3 }, dmg: 14, interval: 0.3, kb: 3, knockdown: true, sfx: 'hitHeavy', height: 1, active: w => brickDrop(w.time, zx).drop })),
  ],
  triggers: [
    { area: { x: 2, y: 4, w: 6, h: 5 }, msg: 'SOUTH BERMONDSEY', sub: 'THE BUSHWACKERS KNEW WHICH TRAIN YOU WERE ON', dur: 2.6, color: '#a8c0ff' },
    { area: { x: 1, y: 3, w: 33, h: 1 }, toast: 'TRAINS COME THROUGH WITHOUT STOPPING. KNOCK THEM ONTO THE LINE.' },
    { area: { x: 36, y: 4, w: 4, h: 5 }, msg: 'THE BOOKING HALL', sub: 'NOBODY HAS EVER BOUGHT A TICKET HERE', dur: 2.2 },
    { area: { x: 44, y: 11, w: 2, h: 2 }, msg: 'THE CAGE', sub: 'TWO WIDE, FENCED BOTH SIDES. NOWHERE TO RUN.', dur: 2.4, color: '#a8c0ff' },
    { area: { x: 44, y: 16, w: 2, h: 3 }, toast: 'SOMEBODY\'S CUT A HOLE IN THAT FENCE...' },
    { area: { x: 48, y: 3, w: 11, h: 3 }, toast: 'THE EMBANKMENT. MIND THE LIVE RAIL. AND THE TRAINS.' },
    { area: { x: 38, y: 19, w: 4, h: 7 }, msg: 'UNDER THE ARCHES', sub: 'LOCK-UPS, CAR BREAKERS AND THE 14:22 OVERHEAD', dur: 2.4 },
    { area: { x: 8, y: 19, w: 30, h: 2 }, toast: 'WHEN A TRAIN GOES OVER, THE ARCHES SHAKE. WATCH FOR FALLING BRICKS.' },
    { area: { x: 19, y: 19, w: 5, h: 2 }, toast: 'LOCK-UP 23. THE PADLOCK\'S JUST HANGING THERE...' },
    { area: { x: 11, y: 27, w: 5, h: 2 }, msg: 'THE BREAKERS\' YARD', sub: 'CASH FOR CARS. NO QUESTIONS ASKED.', dur: 2.2 },
    { area: { x: 6, y: 28, w: 3, h: 3 }, toast: 'THE CAR STACK TAKES YOUR WEIGHT. JUMP UP.' },
    { area: { x: 12, y: 38, w: 6, h: 2 }, msg: 'ZAMPA ROAD', sub: 'THE INDUSTRIAL ESTATE. THE VANS DON\'T STOP.', dur: 2.4 },
    { area: { x: 32, y: 38, w: 6, h: 2 }, toast: 'THE CAFE\'S DOOR IS OPEN. SMELLS LIKE A FRY-UP.' },
    { area: { x: 52, y: 45, w: 7, h: 2 }, msg: 'COLD BLOW LANE', sub: 'NOT A PLACE FOR TOURISTS', dur: 2.6, color: '#a8c0ff', action: () => { audio.chant && audio.chant(); } },
  ],
  secrets: [
    { id: 'embankment', x: 50, y: 4, w: 9, h: 5, msg: 'THE EMBANKMENT', score: 1200 },
    { id: 'lockup', x: 19, y: 16, w: 5, h: 2, msg: 'LOCK-UP 23: NO QUESTIONS ASKED', score: 2000 },
    { id: 'carstack', x: 3, y: 28, w: 3, h: 2, msg: 'ON TOP OF THE CAR STACK', score: 800 },
    { id: 'cafe', x: 33, y: 34, w: 5, h: 3, msg: 'THE BACK OF THE TRANSPORT CAFE', score: 1500 },
  ],
  encounters: [
    {
      id: 'platform', area: { x: 12, y: 4, w: 2, h: 5 }, lockArea: { x: 1, y: 3, w: 33.9, h: 5.9 },
      msg: 'WELCOME TO BERMONDSEY', sub: 'THEY WERE WAITING ON THE PLATFORM', goTo: { x: 33, y: 5, w: 2, h: 3 }, clearMsg: 'THE BARRIERS ARE OPEN!',
      waves: [
        { enemies: [
          { type: 'theden_bushwacker', x: 20.5, y: 5.5, from: { x: 36.5, y: 6.5 } },
          { type: 'theden_bushwacker', x: 24.5, y: 7.5, from: { x: 36.5, y: 5.5 } },
          { type: 'theden_bushwacker', x: 17.5, y: 4.5, from: { x: 17.5, y: 1.5 } },
        ] },
        { nextAt: 1, msg: 'MORE OFF THE LONDON BRIDGE TRAIN!', enemies: [
          { type: 'theden_bushwacker', x: 8.5, y: 7.5, from: { x: 3.5, y: 1.5 } },
          { type: 'theden_scrapper', x: 28.5, y: 5.5, from: { x: 36.5, y: 6.5 } },
          { type: 'theden_bushwacker', x: 14.5, y: 6.5, from: { x: 14.5, y: 1.5 }, delay: 1.5 },
        ] },
        { nextAt: 1, msg: 'THEIR TOP BOY!', enemies: [
          { type: 'theden_oldboy', x: 22.5, y: 6.5, from: { x: 36.5, y: 6.5 } },
          { type: 'theden_bushwacker', x: 30.5, y: 7.5, from: { x: 36.5, y: 7.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'hall', area: { x: 36, y: 5, w: 2, h: 3 }, lockArea: { x: 36, y: 4, w: 10.9, h: 5.9 },
      msg: 'UP THE WALKWAY!', sub: 'THEY\'RE COMING BACK FOR YOU', goTo: { x: 44, y: 9, w: 2, h: 2 }, clearMsg: 'OUT TO THE WALKWAY!',
      waves: [
        { enemies: [
          { type: 'theden_bushwacker', x: 41.5, y: 6.5, from: { x: 44.5, y: 12.5 } },
          { type: 'theden_bushwacker', x: 43.5, y: 8.5, from: { x: 45.5, y: 12.5 } },
          { type: 'theden_scrapper', x: 44.5, y: 4.5, from: { x: 44.5, y: 13.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'theden_bushwacker', x: 39.5, y: 8.5, from: { x: 44.5, y: 12.5 } },
          { type: 'theden_lockup', x: 42.5, y: 5.5, from: { x: 45.5, y: 12.5 }, delay: 1.5 },
        ] },
      ],
    },
    {
      id: 'cage', area: { x: 44, y: 15, w: 2, h: 2 }, lockArea: { x: 44, y: 10, w: 1.9, h: 15.9 },
      msg: 'AMBUSH!', sub: 'THE BUSHWACKERS ARE AT BOTH ENDS', goTo: { x: 41, y: 24, w: 3, h: 2 }, clearMsg: 'UNDER THE ARCHES',
      waves: [
        { enemies: [
          { type: 'theden_bushwacker', x: 44.5, y: 19.5, from: { x: 40.5, y: 24.5 } },
          { type: 'theden_bushwacker', x: 45.5, y: 21.5, from: { x: 38.5, y: 25.5 } },
          { type: 'theden_bushwacker', x: 44.5, y: 11.5, from: { x: 41.5, y: 7.5 } },
        ] },
        { nextAt: 1, msg: 'BEHIND YOU!', enemies: [
          { type: 'theden_lockup', x: 45.5, y: 12.5, from: { x: 41.5, y: 6.5 } },
          { type: 'theden_bushwacker', x: 44.5, y: 22.5, from: { x: 36.5, y: 24.5 } },
          { type: 'theden_scrapper', x: 45.5, y: 24.5, from: { x: 30.5, y: 22.5 }, delay: 1 },
        ] },
        { nextAt: 1, msg: 'BOTH ENDS!', enemies: [
          { type: 'theden_oldboy', x: 44.5, y: 18.5, from: { x: 38.5, y: 24.5 } },
          { type: 'theden_bushwacker', x: 45.5, y: 13.5, from: { x: 40.5, y: 6.5 }, delay: 1.5 },
        ] },
      ],
    },
    {
      id: 'arches', area: { x: 39, y: 23, w: 3, h: 3 }, lockArea: { x: 1, y: 16, w: 41.9, h: 9.9 },
      msg: 'OUT OF THE LOCK-UPS!', sub: 'EVERY ARCH HAS A BUSHWACKER IN IT', goTo: { x: 12, y: 25, w: 3, h: 2 }, clearMsg: 'INTO THE BREAKERS\' YARD',
      waves: [
        { enemies: [
          { type: 'theden_lockup', x: 30.5, y: 21.5, from: { x: 30.5, y: 16.5 } },
          { type: 'theden_lockup', x: 38.5, y: 22.5, from: { x: 39.5, y: 16.5 } },
          { type: 'theden_bushwacker', x: 34.5, y: 24.5, from: { x: 30.5, y: 17.5 } },
        ] },
        { nextAt: 1, msg: 'THEY\'RE STILL COMING OUT!', enemies: [
          { type: 'theden_lockup', x: 24.5, y: 21.5, from: { x: 30.5, y: 17.5 } },
          { type: 'theden_scrapper', x: 27.5, y: 24.5, from: { x: 29.5, y: 16.5 } },
          { type: 'theden_bushwacker', x: 36.5, y: 21.5, from: { x: 38.5, y: 17.5 } },
          { type: 'theden_bushwacker', x: 20.5, y: 23.5, from: { x: 1.5, y: 22.5 }, delay: 2 },
        ] },
        { nextAt: 1, msg: 'THE OLD BOYS!', enemies: [
          { type: 'theden_oldboy', x: 28.5, y: 22.5, from: { x: 6.5, y: 17.5 } },
          { type: 'theden_lockup', x: 32.5, y: 23.5, from: { x: 39.5, y: 17.5 } },
          { type: 'theden_bushwacker', x: 25.5, y: 20.5, from: { x: 1.5, y: 21.5 }, delay: 1.5 },
        ] },
      ],
    },
    {
      id: 'yard', area: { x: 11, y: 27, w: 5, h: 2 }, lockArea: { x: 1, y: 27, w: 27.9, h: 9.9 },
      msg: 'THE BREAKERS\' YARD', sub: 'THEY STRIP A CAR IN TEN MINUTES. AND YOU?', goTo: { x: 13, y: 35, w: 3, h: 2 }, clearMsg: 'THE YARD GATE IS OPEN!',
      waves: [
        { enemies: [
          { type: 'theden_scrapper', x: 20.5, y: 32.5, from: { x: 27.5, y: 31.5 } },
          { type: 'theden_lockup', x: 8.5, y: 31.5, from: { x: 1.5, y: 35.5 } },
          { type: 'theden_bushwacker', x: 16.5, y: 34.5, from: { x: 14.5, y: 38.5 } },
        ] },
        { nextAt: 1, msg: 'THE LUMPER!', enemies: [
          { type: 'theden_lumper', x: 14.5, y: 31.5, from: { x: 14.5, y: 38.5 } },
          { type: 'theden_scrapper', x: 24.5, y: 29.5, from: { x: 27.5, y: 28.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'theden_lockup', x: 6.5, y: 30.5, from: { x: 1.5, y: 30.5 } },
          { type: 'theden_bushwacker', x: 19.5, y: 35.5, from: { x: 14.5, y: 38.5 } },
          { type: 'theden_scrapper', x: 26.5, y: 35.5, from: { x: 27.5, y: 35.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'zampa', area: { x: 12, y: 38, w: 5, h: 2 }, lockArea: { x: 1, y: 38, w: 57.9, h: 6.9 },
      msg: 'THEY\'VE BLOCKED THE ROAD!', sub: 'MIND THE VANS', goTo: { x: 52, y: 44, w: 7, h: 2 }, clearMsg: 'COLD BLOW LANE',
      waves: [
        { enemies: [
          { type: 'theden_bushwacker', x: 22.5, y: 43.5, from: { x: 58.5, y: 43.5 } },
          { type: 'theden_bushwacker', x: 24.5, y: 38.5, from: { x: 34.5, y: 37.5 } },
          { type: 'theden_scrapper', x: 28.5, y: 43.5, from: { x: 58.5, y: 44.5 } },
        ] },
        { nextAt: 1, msg: 'OUT OF THE UNITS!', enemies: [
          { type: 'theden_lockup', x: 18.5, y: 38.5, from: { x: 20.5, y: 36.5 } },
          { type: 'theden_bushwacker', x: 32.5, y: 43.5, from: { x: 58.5, y: 40.5 } },
          { type: 'theden_bushwacker', x: 8.5, y: 43.5, from: { x: 1.5, y: 41.5 }, delay: 1 },
          { type: 'theden_oldboy', x: 26.5, y: 38.5, from: { x: 55.5, y: 46.5 } },
        ] },
        { nextAt: 1, msg: 'ANOTHER BIG LUMP!', enemies: [
          { type: 'theden_lumper', x: 30.5, y: 43.5, from: { x: 55.5, y: 47.5 } },
          { type: 'theden_bushwacker', x: 36.5, y: 38.5, from: { x: 58.5, y: 38.5 }, delay: 1.5 },
          { type: 'theden_scrapper', x: 14.5, y: 43.5, from: { x: 1.5, y: 43.5 } },
        ] },
      ],
    },
    {
      id: 'coldblow', area: { x: 52, y: 45, w: 6.9, h: 1.5 }, lockArea: { x: 52, y: 45, w: 6.9, h: 10.9 },
      msg: 'OUT OF THE TURNSTILES!', sub: 'THE OLD BILL ARE WATCHING. THEY WON\'T HELP.', goTo: { x: 52, y: 55, w: 7, h: 2 }, clearMsg: 'THE FORECOURT. SOMEBODY BIG IS WAITING.',
      waves: [
        { enemies: [
          { type: 'theden_bushwacker', x: 54.5, y: 50.5, from: { x: 55.5, y: 57.5 } },
          { type: 'theden_bushwacker', x: 55.5, y: 53.5, from: { x: 54.5, y: 58.5 } },
          { type: 'theden_oldboy', x: 53.5, y: 48.5, from: { x: 50.5, y: 49.5 } },
        ] },
        { nextAt: 1, msg: 'MORE THROUGH THE TURNSTILES!', enemies: [
          { type: 'theden_lockup', x: 53.5, y: 51.5, from: { x: 50.5, y: 51.5 } },
          { type: 'theden_bushwacker', x: 55.5, y: 46.5, from: { x: 50.5, y: 48.5 } },
          { type: 'theden_scrapper', x: 56.5, y: 54.5, from: { x: 56.5, y: 58.5 } },
          { type: 'theden_bushwacker', x: 54.5, y: 49.5, from: { x: 50.5, y: 53.5 }, delay: 1.5 },
        ] },
      ],
    },
  ],
  boss: {
    type: 'theden_docker', x: 28.5, y: 59.5, title: 'DOUG "THE DOCKER" CRATCHLEY', intro: 'BUSHWACKERS TOP BOY. HANDS LIKE SHOVELS.',
    area: { x: 52, y: 56, w: 6.9, h: 1.5 }, lockArea: BOSS_ARENA,
    minions: [
      { type: 'theden_bushwacker', x: 34.5, y: 58.5 },
      { type: 'theden_lockup', x: 22.5, y: 59.5 },
    ],
  },
  denAmbushFrom: [{ x: 7.5, y: 59.5 }, { x: 55.5, y: 52.5 }],
  exit: { x: 1, y: 57.5, w: 4.5, h: 4 },

  onStart(world) {
    world.__den = { chants: [3], trainWarn: false, archPass: -1, dropped: {} };
    addViaductTrain(world);
  },

  onUpdate(world, dt) {
    const S = world.__den || (world.__den = { chants: [], trainWarn: false, archPass: -1, dropped: {} });
    for (let i = S.chants.length - 1; i >= 0; i--) { S.chants[i] -= dt; if (S.chants[i] <= 0) { S.chants.splice(i, 1); audio.chant && audio.chant(); } }
    const p = world.player;
    if (!p) return;
    // ---- the station train: warning + lights, slice actors per train
    const hz = world.hazards.find(h => h.id === 'denTrain');
    if (hz) {
      const passing = world.vehicles.some(v => v.def === hz && !v.removed);
      const warn = hz.t < 2.4 || passing;
      if (warn && !S.trainWarn && !passing && inRect(p, 0, 0, 60, 10)) { world.sfx('train', p); world.toast('TRAIN COMING THROUGH! STAND BACK FROM THE EDGE!'); }
      S.trainWarn = warn;
      if (warn) for (const x of [8, 20, 32]) world.addFrameLight({ x, y: 3.3, z: 0.3, r: 2.2, color: '#ffb030', intensity: Math.floor(world.time * 4) % 2 ? 0.85 : 0.3 });
      for (const v of world.vehicles) {
        if (v.def !== hz || v.den) continue;
        v.den = true;
        spawnStationTrain(world, v);
      }
    }
    // ---- the overhead train on the viaduct: rumble, shake, dust and loose bricks
    const T = archTrain(world.time);
    const pass = Math.floor((world.time + VIA.phase) / VIA.period);
    const underArches = inRect(p, 0, 18.5, 43, 26);
    if (T.on && S.archPass !== pass) {
      S.archPass = pass; S.dropped = {};
      if (underArches || inRect(p, 43, 10, 47, 26)) { world.sfx('train', p); world.toast('A TRAIN OVERHEAD. THE ARCHES ARE SHAKING...'); }
    }
    if (T.on && underArches && T.x > -2 && T.x < 44) world.camera.shake(1.2, 0.1);
    for (const zx of ARCH_ZONES) {
      const B = brickDrop(world.time, zx);
      if (B.warn && Math.random() < dt * 14) world.fx.add({ x: zx + (Math.random() - 0.5) * 1.6, y: 19.1 + Math.random() * 1.1, z: 4.2, vx: 0, vy: 0, vz: -0.5, g: 0.6, life: 1.2, color: Math.random() < 0.5 ? '#8a7a5e' : '#a8a090', size: 1, kind: 'drop' });
      if (B.drop && !S.dropped[zx]) {
        S.dropped[zx] = true;
        world.fx.debris(zx, 19.6, 3.6, ['#5e4e40', '#8a7a5e', '#3a3228'], 14);
        world.fx.dust(zx, 19.6, 0, 10);
        if (Math.hypot(p.x - zx, p.y - 19.6) < 9) { world.sfx('wallSlam', { x: zx, y: 19.6 }); world.camera.shake(3, 0.2); }
      }
    }
  },

  onEncounterClear(world, e) {
    const S = world.__den;
    if (S) S.chants.push(0.6);
    if (e.id === 'platform') { openTagged(world, 'hallDoor'); world.toast('THROUGH THE BOOKING HALL. THE GROUND IS DOWN THE WALKWAY.'); }
    if (e.id === 'hall') { openTagged(world, 'hallExit'); world.toast('THE WALKWAY. STICK TOGETHER IN THERE.'); }
    if (e.id === 'cage') world.toast('UNDER THE ARCHES. THE GROUND IS PAST THE BREAKERS\' YARD.');
    if (e.id === 'yard') { openTagged(world, 'yardGate'); world.toast('THROUGH THE GATE ONTO ZAMPA ROAD.'); }
    if (e.id === 'zampa') world.toast('EAST, THEN DOWN COLD BLOW LANE.');
  },

  onBossDefeated(world, boss) {
    openTagged(world, 'exitGate');
    world.fx.confetti(boss.x, boss.y, 1.5, [RED, WHITE, GOLD], 30);
    world.message('THE DOCKER IS DOWN!', 'BERMONDSEY WILL TALK ABOUT THIS FOR YEARS', 3, '#a8c0ff');
    world.toast('THE OLD BILL WILL WALK YOU TO THE STATION. OUT THROUGH THE GATE!');
    const S = world.__den; if (S) { S.chants.push(0.4); S.chants.push(4); }
  },

  drawGround(ctx, world) { drawSkyline(ctx, world); },
};
