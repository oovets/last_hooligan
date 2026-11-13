// TOUR ARENA — IBROX. Rangers away: the last and longest trip. Govan, Glasgow G51, horizontal rain.
// The ICF (Rangers' Inter City Firm) are waiting. Every named character here is invented.
//
// Route: off the overnight bus on GOVAN ROAD (welcome committee; secret: a dark close -> hidden back green)
//        -> down into IBROX SUBWAY (fight on the island platform; the wee orange train is a hazard on the track)
//        -> up onto COPLAND ROAD and through a close into the tenement BACK COURTS (close mouth ambush, middens,
//           washing poles, a shipyard hard man; scarf on a midden roof)
//        -> through the pend onto PAISLEY ROAD WEST (pubs empty out; the chippy's fryers spit fat; freezer secret)
//        -> down to EDMISTON DRIVE under the red-brick Main Stand facade (two shipyard hard men: pin them)
//        -> home turnstiles -> concourse (the MARBLE HALL detour; a loose panel -> the trophy room)
//        -> the away section of the BROOMLOAN stand (they pour over the segregation fence: hold the pen)
//        -> exit gates -> BOSS on the Edmiston Drive forecourt in the rain: BIG SHUGGIE "THE RIVET" McGLASHAN
//        -> the waiting coach.
// The map is built from rect fills below (60 x 64).
import '../../themes/common.js';
import '../../themes/derby.js';            // reuses the wall-decal props derby_sign / derby_banner, floodlight, goal
import './theme.js';
import './boss.js';
import './music.js';
import { segments } from '../../themes/derby.js';
import { fryerSpitting, spawnSubwayTrain, drawCranes, drawGust, ROYAL, RED, WHITE } from './theme.js';
import { audio } from '../../../audio/audio.js';

const SUB = '#e8661a';
const STAFF = 'ibrox_staff';               // key nobody carries: these gates are opened by the level script
const W = 60, H = 64;
const BOSS_ARENA = { x: 1, y: 56, w: 21.9, h: 6.9 };
const noDraw = () => {};

// ---------------------------------------------------------------- map
function buildMap() {
  const g = Array.from({ length: H }, () => Array(W).fill(' '));
  const F = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
  // Walls bounding a play area from the north/west are full height; from the south/east they are cut away
  // (low) so they never hide the fight behind them.
  // ===== GOVAN ROAD (y 0-10)
  F(0, 0, 33, 0, 'T'); F(0, 0, 0, 63, 'T');
  F(1, 1, 33, 2, '.'); F(1, 3, 33, 7, 'r'); F(1, 5, 33, 5, 'l'); F(1, 8, 33, 10, '.');
  F(0, 11, 37, 12, 'u');
  F(7, 11, 7, 12, 'G');                                   // the dark close (fake wall)
  F(34, 0, 37, 2, 'T'); F(34, 3, 37, 7, 's'); F(34, 8, 37, 10, 'u');
  // ===== IBROX SUBWAY (x 38-59, y 0-12)
  F(38, 0, 59, 0, 'X'); F(38, 1, 43, 2, 'X'); F(44, 1, 58, 2, 't'); F(59, 0, 59, 12, 'x');
  F(38, 3, 43, 10, 'h'); F(44, 3, 58, 3, 'e'); F(44, 4, 58, 10, 'p');
  F(38, 11, 58, 11, 'x'); F(38, 12, 58, 12, 'u'); F(50, 11, 53, 12, 'z');
  // ===== hidden back green + COPLAND ROAD (y 13-17)
  F(1, 13, 17, 19, 'Y'); F(13, 13, 17, 17, 'y'); F(3, 17, 12, 17, 'y'); F(3, 13, 12, 16, 'g');
  F(18, 13, 58, 13, '.'); F(18, 14, 58, 16, 'r'); F(18, 15, 58, 15, 'l'); F(18, 17, 58, 17, '.');
  F(59, 13, 59, 63, 'u');
  // tenement block with three closes, then the BACK COURTS (y 20-26)
  F(18, 18, 58, 19, 'Y'); F(24, 18, 25, 19, 'q'); F(38, 18, 39, 19, 'q'); F(52, 18, 53, 19, 'q');
  F(1, 20, 58, 26, 'g'); F(1, 26, 58, 26, 'c');
  F(16, 20, 16, 25, 'b'); F(16, 22, 16, 23, 'g');
  F(31, 20, 31, 25, 'b'); F(31, 21, 31, 22, 'g');
  F(46, 20, 46, 25, 'b'); F(46, 23, 46, 24, 'g');
  F(1, 27, 58, 27, 'y'); F(1, 28, 58, 28, 'U'); F(4, 27, 5, 28, 'q');      // the pend
  F(9, 28, 14, 28, 'P'); F(36, 28, 41, 28, 'P'); F(46, 28, 50, 28, 'P');   // pubs
  // ===== PAISLEY ROAD WEST (y 29-33) + the chippy (a box standing on its own south of the street)
  F(1, 29, 58, 29, '.'); F(1, 30, 58, 32, 'r'); F(1, 31, 58, 31, 'l'); F(1, 33, 58, 33, '.');
  F(1, 34, 51, 34, 'y'); F(51, 34, 51, 39, 'Y');
  F(22, 34, 35, 34, 'I'); F(21, 34, 21, 38, 'I'); F(36, 34, 36, 39, 'y'); F(21, 39, 36, 39, 'y');
  F(22, 35, 35, 38, 'k'); F(28, 34, 29, 34, 'k');
  F(52, 34, 58, 55, '.'); F(54, 34, 56, 55, 'r');                           // down to Edmiston Drive
  // ===== THE GROUND (y 40-55)
  F(1, 40, 14, 40, 'S'); F(15, 40, 50, 40, 'K');
  F(1, 41, 14, 45, 'a'); F(1, 46, 14, 46, 'V'); F(1, 47, 14, 54, 'a');     // home section / fence / away pen
  F(15, 41, 15, 54, 'V'); F(15, 51, 15, 52, 'a');
  F(16, 41, 38, 48, '~'); F(16, 49, 38, 49, 'E'); F(16, 50, 38, 54, '_');  // pitch / stand front / concourse
  F(39, 41, 50, 48, 'K'); F(39, 41, 39, 54, 'W'); F(39, 52, 39, 53, 'm');
  F(40, 44, 50, 44, 'W'); F(40, 45, 40, 48, 'W'); F(41, 45, 49, 48, 'm'); F(50, 45, 50, 48, 'w');  // trophy room
  F(40, 49, 50, 49, 'w'); F(45, 49, 45, 49, 'H');                           // the loose panel
  F(40, 50, 50, 54, 'm');                                                    // the marble hall
  F(51, 40, 51, 55, 'F');
  F(1, 55, 14, 55, 'Q'); F(6, 55, 7, 55, 'a');                               // pen exit gates
  F(15, 55, 50, 55, 'F');
  for (const x of [24, 26, 28, 30, 32]) F(x, 55, x, 55, '_');               // turnstiles
  F(44, 55, 45, 55, 'm');                                                    // main door
  // ===== EDMISTON DRIVE (y 56-62)
  F(1, 56, 58, 57, 'f'); F(1, 58, 58, 61, 'r'); F(1, 59, 58, 59, 'l'); F(1, 62, 58, 62, '.');
  F(0, 63, 59, 63, 'n');
  F(23, 56, 23, 62, 'L');                                                    // police line
  return g.map(r => r.join(''));
}

const openTagged = (world, tag) => { for (const p of world.props) if (p.o.tag === tag) p.open = true; world.rebuildPropGrid(); };
const inRect = (p, x0, y0, x1, y1) => p.x >= x0 && p.y >= y0 && p.x <= x1 && p.y <= y1;
// under a roof: the Subway, the chippy, the ground (the Broomloan stand and the Main Stand are covered)
const indoors = p => inRect(p, 34, 0, 60, 12.9) || inRect(p, 21, 34.5, 36.5, 39) || inRect(p, 0, 40, 52, 55.2);

export default {
  id: 'ibrox',
  tour: true,
  num: 13,
  name: 'IBROX',
  subtitle: 'SATURDAY. 14:02. GOVAN. HORIZONTAL RAIN.',
  intro: [
    'THE LONGEST TRIP. ELEVEN HOURS ON A COACH',
    'WITH NO TOILET AND BIG MALC\'S EGG SANDWICHES.',
    'GOVAN. IT\'S RAINING SIDEWAYS. THE ICF',
    'ARE AT THE SUBWAY. NOBODY BROUGHT A BROLLY.',
  ],
  music: 'ibrox',
  crowd: 0.75,
  weather: 'rain',
  ambient: { dark: 0.36, color: '#0a1022', playerLight: 3 },
  bg: '#0c1018',
  fog: 'rgba(140,160,190,0.05)',
  extraTokens: 1,
  defaultFloor: 'pavement',
  start: { x: 8.5, y: 6.5 },
  startFacing: { x: 1, y: 0 },
  legend: {
    '.': { floor: 'pavement' },
    'r': { floor: 'road' },
    'l': { floor: 'roadLineX' },
    's': { floor: 'ibrox_stairs' },
    'z': { floor: 'ibrox_stairsY' },
    'h': { floor: 'ibrox_hall' },
    't': { floor: 'ibrox_track' },
    'e': { floor: 'ibrox_platEdge' },
    'p': { floor: 'ibrox_platform' },
    'g': { floor: 'ibrox_backcourt' },
    'c': { floor: 'cobble' },
    'q': { floor: 'ibrox_close' },
    'k': { floor: 'ibrox_chippyFloor' },
    '_': { floor: 'ibrox_concourse' },
    'm': { floor: 'ibrox_marble' },
    'a': { floor: 'ibrox_awaySteps' },
    'f': { floor: 'ibrox_forecourt' },
    '~': { floor: 'pitch' },
    'T': { floor: 'pavement', wall: 'ibrox_tenement', h: 5 },
    'U': { floor: 'pavement', wall: 'ibrox_tenement', h: 2.4 },
    'u': { floor: 'pavement', wall: 'ibrox_tenement', h: 1.4 },
    'y': { floor: 'pavement', wall: 'ibrox_tenementBack', h: 1.4 },
    'x': { floor: 'ibrox_hall', wall: 'ibrox_subwayWall', h: 1.2 },
    'Q': { floor: 'ibrox_awaySteps', wall: 'ibrox_standWall', h: 2 },
    'w': { floor: 'ibrox_marble', wall: 'ibrox_woodPanel', h: 1.8 },
    'n': { floor: 'pavement', wall: 'brickDark', h: 1.2 },
    'Y': { floor: 'pavement', wall: 'ibrox_tenementBack', h: 5 },
    'G': { floor: 'ibrox_close', wall: 'ibrox_tenement', h: 1.4, solid: false, fake: true },
    'X': { floor: 'ibrox_hall', wall: 'ibrox_subwayWall', h: 3 },
    'b': { floor: 'ibrox_backcourt', wall: 'ibrox_courtWall', h: 1.2 },
    'P': { floor: 'pavement', wall: 'ibrox_pubFront', h: 2.4 },
    'I': { floor: 'ibrox_chippyFloor', wall: 'ibrox_chippyInner', h: 2.4 },
    'S': { floor: 'ibrox_awaySteps', wall: 'ibrox_seatsWall', h: 4.5 },
    'K': { floor: 'ibrox_concourse', wall: 'ibrox_standWall', h: 3.5 },
    'V': { floor: 'ibrox_awaySteps', wall: 'ibrox_awayFence', h: 1.6 },
    'E': { floor: 'ibrox_concourse', wall: 'ibrox_standFront', h: 1.5 },
    'W': { floor: 'ibrox_marble', wall: 'ibrox_woodPanel', h: 3 },
    'H': { floor: 'ibrox_marble', wall: 'ibrox_woodPanel', h: 1.8, solid: false, fake: true },
    'F': { floor: 'ibrox_forecourt', wall: 'ibrox_facade', h: 4 },
    'L': { floor: 'ibrox_forecourt', wall: 'ibrox_policeLine', h: 1.5 },
  },
  map: buildMap(),
  items: [
    // ---- the five lost scarves
    { type: 'scarf', x: 8.5, y: 14.5 },                      // hidden back green (through the dark close)
    { type: 'scarf', x: 56.5, y: 1.6 },                      // ON THE SUBWAY TRACK. Mind the train.
    { type: 'scarf', x: 34.6, y: 24.5, z: 1.15 },            // on the midden roof (jump)
    { type: 'scarf', x: 35.5, y: 38.5 },                     // in the chippy freezer (break it)
    { type: 'scarf', x: 41.5, y: 53.5 },                     // the marble hall detour
    // ---- the pin badge: the trophy room behind the loose panel
    { type: 'badge', x: 44.5, y: 47.5 },
    { type: 'cash20', x: 48.5, y: 47.5 },
    { type: 'fanzine', x: 4.5, y: 9.5, title: 'THE NORDHAMN ANCHOR LINE #19: TOUR SPECIAL', text: 'IBROX. ELEVEN HOURS UP THE ROAD. THE ICF WILL MEET THE COACH, THEY ALWAYS DO. OUR MAN IN GOVAN SAYS THEIR TOP BOY IS BIG SHUGGIE "THE RIVET" - EX-SHIPYARD, PARKA THE SIZE OF A TENT. HE HEADBUTTS, HE SLIDES IN ON THE WET, AND HE THROWS HIS FISH SUPPER AT YOU. SIDESTEP THE NUT AND HE SEES STARS. ALSO: ONE OF THE CLOSES ON GOVAN ROAD GOES SOMEWHERE IT SHOULDN\'T.' },
    // ---- health between fights
    { type: 'ibrox_ginger', x: 30.5, y: 9.5 },
    { type: 'pie', x: 40.5, y: 9.5 },
    { type: 'ibrox_chips', x: 55.5, y: 13.5 },
    { type: 'pint', x: 6.5, y: 25.5 },
    { type: 'ibrox_munchy', x: 24.8, y: 35.5, z: 1.05 },     // on the chippy counter
    { type: 'ibrox_chips', x: 55.5, y: 44.5 },
    { type: 'pint', x: 20.5, y: 53.5 },
    { type: 'kebab', x: 47.5, y: 51.5 },
    { type: 'ibrox_ginger', x: 2.5, y: 53.5 },
    // ---- weapons
    { type: 'umbrella', x: 11.5, y: 9.5 },
    { type: 'bottle', x: 29.5, y: 2.5 },
    { type: 'binlid', x: 22.5, y: 23.5 },
    { type: 'brick', x: 42.5, y: 25.5 },
    { type: 'chair', x: 16.5, y: 29.5 },
    { type: 'ibrox_supper', x: 31.5, y: 37.5 },
    { type: 'pipe', x: 57.5, y: 49.5 },
    { type: 'umbrella', x: 36.5, y: 51.5 },
    { type: 'coin', x: 20.5, y: 1.5 }, { type: 'coin', x: 45.5, y: 6.5 }, { type: 'cash5', x: 10.5, y: 21.5 },
    { type: 'coin', x: 26.5, y: 33.5 }, { type: 'cash5', x: 18.5, y: 61.5 },
  ],
  props: [
    // ================= GOVAN ROAD
    { type: 'ibrox_coach', x: 2, y: 4, text: 'NORDHAMN TOURS', trim: '#6a2a8a' },
    { type: 'lamp', x: 6, y: 1 }, { type: 'lamp', x: 18, y: 1 }, { type: 'lamp', x: 30, y: 1 },
    { type: 'lamp', x: 12, y: 10 }, { type: 'lamp', x: 25, y: 10 },
    { type: 'busStop', x: 15, y: 9 },
    { type: 'bin', x: 1, y: 1 }, { type: 'wheeliebin', x: 33, y: 1 }, { type: 'postbox', x: 21, y: 10 },
    { type: 'ibrox_drain', x: 10, y: 4 }, { type: 'ibrox_drain', x: 27, y: 6 },
    ...segments({ type: 'derby_sign', x: 3, y: 0, len: 3, z: 3.6, height: 0.5, text: 'GOVAN RD', color: '#ffffff', bg: '#1a2a5a' }),
    ...segments({ type: 'derby_sign', x: 10, y: 0, len: 4, z: 1.5, height: 0.6, text: 'NEWSAGENT', color: '#ffe14a', bg: '#3a1010' }),
    ...segments({ type: 'derby_sign', x: 22, y: 0, len: 3, z: 1.5, height: 0.6, text: 'CAFE', color: '#ffffff', bg: '#1a3a1a', neon: true }),
    ...segments({ type: 'derby_sign', x: 34, y: 2, len: 4, z: 2.3, height: 0.7, text: 'SUBWAY', color: '#ffffff', bg: SUB }),
    { type: 'graffiti', x: 15, y: 0, side: 'left', z: 1.0, text: 'ICF', color: '#3a6ad8' },
    { type: 'graffiti', x: 28, y: 0, side: 'left', z: 1.1, text: 'GERS', color: '#e8e8e8' },
    // ================= IBROX SUBWAY
    { type: 'ibrox_ticketOffice', x: 39, y: 3 },
    { type: 'barrier', x: 42, y: 4, dir: 'y' }, { type: 'barrier', x: 42, y: 6, dir: 'y' }, { type: 'barrier', x: 42, y: 8, dir: 'y' },
    { type: 'bench', x: 48, y: 8 }, { type: 'bench', x: 55, y: 8 }, { type: 'bin', x: 52, y: 4 },
    ...segments({ type: 'derby_sign', x: 46, y: 0, len: 4, z: 1.5, height: 0.7, text: 'IBROX', color: '#ffffff', bg: SUB }),
    ...segments({ type: 'derby_sign', x: 52, y: 0, len: 5, z: 1.5, height: 0.6, text: 'INNER CIRCLE', color: SUB, bg: '#1a1a1e' }),
    ...segments({ type: 'derby_sign', x: 38, y: 0, len: 5, z: 1.8, height: 0.6, text: 'MIND THE TRAIN', color: '#ffe14a', bg: '#1a1a1e' }),
    ...segments({ type: 'derby_sign', x: 46, y: 11, len: 4, z: 1.6, height: 0.6, text: 'WAY OUT ↓', color: '#ffffff', bg: '#1a3a1a' }),
    // ================= COPLAND ROAD
    ...segments({ type: 'derby_sign', x: 44, y: 12, len: 5, z: 3.4, height: 0.7, text: 'IBROX STATION', color: '#ffffff', bg: SUB }),
    ...segments({ type: 'derby_sign', x: 26, y: 12, len: 4, z: 3.6, height: 0.5, text: 'COPLAND RD', color: '#ffffff', bg: '#1a2a5a' }),
    ...segments({ type: 'derby_sign', x: 33, y: 12, len: 3, z: 1.5, height: 0.6, text: 'BOOKIES', color: '#ffffff', bg: '#2a1a4a' }),
    { type: 'lamp', x: 22, y: 13 }, { type: 'lamp', x: 36, y: 13 }, { type: 'lamp', x: 30, y: 17 }, { type: 'lamp', x: 45, y: 17 },
    { type: 'phonebox', x: 19, y: 13 },
    { type: 'graffiti', x: 22, y: 12, side: 'left', z: 1.0, text: 'GOVAN', color: '#e8e8e8' },
    // ================= hidden back green
    { type: 'ibrox_washpole', x: 4, y: 14, len: 4 },
    { type: 'crate', x: 11, y: 13 }, { type: 'wheeliebin', x: 3, y: 16 },
    // ================= BACK COURTS
    { type: 'ibrox_midden', x: 19, y: 21 }, { type: 'ibrox_midden', x: 34, y: 24 }, { type: 'ibrox_midden', x: 56, y: 21 },
    { type: 'wheeliebin', x: 21, y: 21 }, { type: 'wheeliebin', x: 33, y: 24 }, { type: 'bin', x: 55, y: 21 },
    { type: 'ibrox_washpole', x: 18, y: 24, len: 3 }, { type: 'ibrox_washpole', x: 39, y: 21, len: 4 }, { type: 'ibrox_washpole', x: 49, y: 24, len: 3 },
    { type: 'pallet', x: 28, y: 25 }, { type: 'crate', x: 9, y: 20 }, { type: 'rubble', x: 43, y: 20 },
    { type: 'graffiti', x: 30, y: 19, side: 'left', z: 1.0, text: 'NO BALL GAMES', color: '#e8e8e8' },
    // ================= PAISLEY ROAD WEST
    ...segments({ type: 'derby_sign', x: 9, y: 28, len: 5, z: 2.35, height: 0.5, text: 'THE STEAMIE', color: '#e8c860', bg: '#1a3a2a' }),
    ...segments({ type: 'derby_sign', x: 36, y: 28, len: 5, z: 2.35, height: 0.5, text: 'THE WEE SHIP', color: '#e8c860', bg: '#4a1418' }),
    ...segments({ type: 'derby_sign', x: 46, y: 28, len: 4, z: 2.35, height: 0.5, text: 'CRANE BAR', color: '#e8c860', bg: '#14204a' }),
    ...segments({ type: 'derby_sign', x: 18, y: 28, len: 6, z: 3.6, height: 0.5, text: 'PAISLEY RD WEST', color: '#ffffff', bg: '#1a2a5a' }),
    ...segments({ type: 'derby_sign', x: 24, y: 28, len: 3, z: 1.5, height: 0.6, text: 'OFFIE', color: '#7affd0', bg: '#10202a', neon: true }),
    ...segments({ type: 'derby_banner', x: 37, y: 28, len: 3, z: 3.0, height: 0.6, text: 'GERS', a: ROYAL, b: WHITE, color: WHITE }),
    { type: 'ibrox_pubSign', x: 12, y: 29, text: 'STEAMIE', a: '#1a3a2a' },
    { type: 'ibrox_pubSign', x: 39, y: 29, text: 'WEE SHIP', a: '#4a1418' },
    { type: 'ibrox_pubSign', x: 27, y: 33, text: 'CHIPPY', a: '#14204a' },
    { type: 'ibrox_fans', x: 8, y: 29, single: true }, { type: 'ibrox_fans', x: 15, y: 29, single: true, flip: true },
    { type: 'ibrox_fans', x: 35, y: 29, single: true }, { type: 'ibrox_fans', x: 42, y: 29, single: true, flip: true },
    { type: 'lamp', x: 20, y: 33 }, { type: 'lamp', x: 44, y: 33 }, { type: 'lamp', x: 3, y: 33 },
    { type: 'bin', x: 30, y: 29 }, { type: 'ibrox_drain', x: 33, y: 31 },
    // ================= THE CHIPPY ("THE GOLDEN FRY")
    { type: 'ibrox_counter', x: 23, y: 35 },
    { type: 'ibrox_fryer', x: 30, y: 35 },
    { type: 'ibrox_freezer', x: 35, y: 38, secret: 'freezer' },
    { type: 'bin', x: 22, y: 38 },
    ...segments({ type: 'derby_sign', x: 23, y: 34, len: 6, z: 2.6, height: 0.6, text: 'THE GOLDEN FRY', color: '#ffe14a', bg: ROYAL }),
    ...segments({ type: 'derby_sign', x: 30, y: 34, len: 5, z: 2.6, height: 0.6, text: 'DEEP FRIED ANYTHING', color: '#ffffff', bg: '#7a1010' }),
    // ================= down to Edmiston Drive
    { type: 'lamp', x: 52, y: 38 }, { type: 'lamp', x: 58, y: 46 }, { type: 'lamp', x: 52, y: 52 },
    { type: 'barrier', x: 53, y: 42, dir: 'y' }, { type: 'cone', x: 57, y: 40 }, { type: 'cone', x: 57, y: 41 },
    ...segments({ type: 'derby_sign', x: 51, y: 42, side: 'right', len: 4, z: 3.2, height: 0.6, text: 'MAIN STAND', color: '#ffffff', bg: ROYAL }),
    // ================= THE GROUND: home section of the Broomloan stand (they jeer at you)
    ...[1, 3, 5, 7, 9, 11, 13].flatMap(x => [{ type: 'ibrox_fans', x, y: 41 }, { type: 'ibrox_fans', x: x + 1, y: 41, flip: true },
      { type: 'ibrox_fans', x, y: 43, flip: true }, { type: 'ibrox_fans', x: x + 1, y: 43 }]),
    ...segments({ type: 'derby_banner', x: 1, y: 40, len: 5, z: 1.4, height: 1.0, text: 'GOVAN GERS', a: ROYAL, b: WHITE, color: WHITE }),
    ...segments({ type: 'derby_banner', x: 7, y: 40, len: 7, z: 1.4, height: 1.0, text: 'LIGHT BLUES', a: WHITE, b: ROYAL, color: ROYAL }),
    ...segments({ type: 'derby_banner', x: 18, y: 40, len: 7, z: 1.0, height: 1.0, text: 'WELCOME TO IBROX', a: ROYAL, b: RED, color: WHITE }),
    ...segments({ type: 'derby_banner', x: 28, y: 40, len: 6, z: 1.0, height: 1.0, text: 'GOVAN NEVER DRY', a: RED, b: WHITE, color: WHITE }),
    // away pen
    ...[2, 3, 4, 5, 9, 10, 11, 12].map(x => ({ type: 'ibrox_seats', x, y: 48 })),
    ...[2, 3, 4, 10, 11, 12].map(x => ({ type: 'ibrox_seats', x, y: 53 })),
    ...segments({ type: 'derby_sign', x: 15, y: 47, side: 'right', len: 3, z: 0.2, height: 0.6, text: 'AWAY FANS', color: '#141414', bg: '#f0c020' }),
    { type: 'gate', x: 6, y: 55, dir: 'x', key: STAFF, tag: 'penExit', lockedMsg: 'EXIT GATES LOCKED. HOLD THE PEN FIRST.' },
    { type: 'gate', x: 7, y: 55, dir: 'x', key: STAFF, tag: 'penExit', lockedMsg: 'EXIT GATES LOCKED. HOLD THE PEN FIRST.' },
    // pitch and stand
    { type: 'derby_goal', x: 22, y: 41 },
    { type: 'derby_floodlight', x: 16, y: 41 }, { type: 'derby_floodlight', x: 38, y: 41 },
    { type: 'bench', x: 20, y: 54 }, { type: 'bin', x: 37, y: 50 },
    ...segments({ type: 'derby_sign', x: 22, y: 49, len: 4, z: 0.3, height: 0.6, text: 'KEEP OFF', color: '#ffffff', bg: '#1a6a3a' }),
    // marble hall + trophy room
    { type: 'ibrox_staircase', x: 44, y: 50 },
    { type: 'ibrox_trophies', x: 42, y: 45 }, { type: 'ibrox_trophies', x: 46, y: 45 },
    ...segments({ type: 'derby_sign', x: 41, y: 49, len: 3, z: 2.2, height: 0.5, text: 'BOARDROOM', color: '#e8c860', bg: '#3a2214' }),
    ...segments({ type: 'derby_sign', x: 47, y: 49, len: 3, z: 2.2, height: 0.5, text: 'NO ENTRY', color: '#e8c860', bg: '#3a2214' }),
    // ================= EDMISTON DRIVE: the Main Stand facade
    ...segments({ type: 'derby_sign', x: 30, y: 55, len: 12, z: 3.25, height: 0.55, text: 'RANGERS FOOTBALL CLUB', color: '#f4ecd8', bg: '#5a2a22' }),
    ...segments({ type: 'derby_sign', x: 24, y: 55, len: 5, z: 2.15, height: 0.45, text: 'TURNSTILES', color: '#ffffff', bg: ROYAL }),
    ...segments({ type: 'derby_sign', x: 43, y: 55, len: 4, z: 2.6, height: 0.5, text: 'MAIN STAND', color: '#f4ecd8', bg: ROYAL }),
    ...segments({ type: 'derby_sign', x: 2, y: 55, len: 4, z: 2.4, height: 0.5, text: 'BROOMLOAN RD', color: '#ffffff', bg: '#1a2a5a' }),
    ...[24, 26, 28, 30, 32].map(x => ({ type: 'ibrox_turnstile', x, y: 55 })),
    { type: 'door', x: 44, y: 55, dir: 'x', color: '#3a2214' }, { type: 'door', x: 45, y: 55, dir: 'x', color: '#3a2214' },
    { type: 'lamp', x: 27, y: 57 }, { type: 'lamp', x: 39, y: 57 }, { type: 'lamp', x: 51, y: 57 },
    { type: 'lamp', x: 4, y: 57 }, { type: 'lamp', x: 18, y: 57 },
    { type: 'derby_sign', x: 23, y: 57, side: 'right', len: 1, z: 0.4, height: 0.5, text: 'POLICE', color: '#ffffff', bg: '#1a3a8a' },
    { type: 'derby_sign', x: 23, y: 60, side: 'right', len: 1, z: 0.4, height: 0.5, text: 'POLICE', color: '#ffffff', bg: '#1a3a8a' },
    { type: 'ibrox_drain', x: 12, y: 60 }, { type: 'ibrox_drain', x: 40, y: 60 },
    { type: 'cone', x: 46, y: 62 }, { type: 'cone', x: 34, y: 62 },
    // the coach home
    { type: 'ibrox_coach', x: 1, y: 62, text: 'NORDHAMN TOURS', trim: '#6a2a8a' },
    { type: 'exitArrow', x: 1, y: 59 },
  ],
  lights: [
    // Govan Road shop glow
    { x: 11, y: 2, z: 1.5, r: 3.5, color: '#ffe0a0', intensity: 0.5 },
    { x: 23, y: 2, z: 1.5, r: 3.5, color: '#c8ffd8', intensity: 0.45, flicker: true },
    // Subway strip lights
    { x: 40, y: 6, z: 2.6, r: 5, color: '#fff0d8', intensity: 0.7 },
    { x: 47, y: 6, z: 2.6, r: 5, color: '#fff0d8', intensity: 0.7 },
    { x: 54, y: 6, z: 2.6, r: 5, color: '#fff0d8', intensity: 0.65, flicker: true },
    { x: 51.5, y: 11.5, z: 2, r: 3, color: '#fff0d8', intensity: 0.5 },
    // pubs on Paisley Road West
    { x: 11.5, y: 29.5, z: 1.5, r: 4, color: '#ffb860', intensity: 0.7 },
    { x: 38.5, y: 29.5, z: 1.5, r: 4, color: '#ffb860', intensity: 0.7 },
    { x: 48, y: 29.5, z: 1.5, r: 3.5, color: '#ffb860', intensity: 0.6, flicker: true },
    { x: 25, y: 29.5, z: 1.5, r: 2.5, color: '#7affd0', intensity: 0.5, flicker: true },
    // chippy
    { x: 26, y: 37, z: 2.5, r: 5, color: '#f0f4ff', intensity: 0.7 },
    { x: 33, y: 37, z: 2.5, r: 4, color: '#fff0d0', intensity: 0.6 },
    // the ground: floodlight spill and concourse
    { x: 8, y: 45, z: 5, r: 8, color: '#e8ecff', intensity: 0.5 },
    { x: 8, y: 51, z: 4, r: 7, color: '#e8ecff', intensity: 0.5 },
    { x: 22, y: 52, z: 2.4, r: 4.5, color: '#e8f0ff', intensity: 0.55 },
    { x: 32, y: 52, z: 2.4, r: 4.5, color: '#e8f0ff', intensity: 0.55, flicker: true },
    { x: 27, y: 45, z: 6, r: 9, color: '#f4f6ff', intensity: 0.5 },
    // marble hall chandelier + trophy room
    { x: 45, y: 52, z: 2.6, r: 5, color: '#ffe8b0', intensity: 0.8 },
    { x: 45, y: 46.5, z: 2.4, r: 3.5, color: '#fff4d0', intensity: 0.6 },
    // Edmiston Drive: the facade lit up in the rain
    { x: 30, y: 57, z: 3, r: 6, color: '#ffe0b0', intensity: 0.5 },
    { x: 44.5, y: 57, z: 3, r: 5, color: '#ffe0b0', intensity: 0.6 },
    { x: 11, y: 58, z: 3, r: 7, color: '#e8ecff', intensity: 0.45 },
    { x: 3, y: 60, z: 1.5, r: 3.5, color: '#fff0c0', intensity: 0.5 },
  ],
  hazards: [
    // the wee orange train (every 11-16 s, east tunnel to west tunnel); warning chime and lights
    { type: 'traffic', id: 'ibroxTrain', lane: [{ x: 66, y: 2 }, { x: 34, y: 2 }], interval: [11, 16], speed: 12, offset: 8, halfLen: 3.5, halfWidth: 0.62, dmg: 30, train: true, clip: [44, 59], draw: noDraw },
    // the chippy fryers spit fat
    { type: 'zone', area: { x: 30, y: 35.9, w: 5, h: 0.95 }, dmg: 7, interval: 0.4, kb: 3, sfx: 'punch', active: w => fryerSpitting(w.time, 0) },
  ],
  triggers: [
    { area: { x: 6, y: 3, w: 6, h: 6 }, msg: 'GOVAN', sub: 'OFF THE OVERNIGHT COACH. IT\'S RAINING SIDEWAYS.', dur: 2.6, color: '#a8c8ff' },
    { area: { x: 5, y: 8, w: 5, h: 3 }, toast: 'THAT CLOSE LOOKS DARKER THAN THE REST...' },
    { area: { x: 30, y: 3, w: 4, h: 5 }, toast: 'DOWN THE SUBWAY. THE ICF WILL BE ON THE PLATFORM.' },
    { area: { x: 38, y: 3, w: 4, h: 8 }, msg: 'IBROX SUBWAY', sub: 'THE CLOCKWORK ORANGE. THE WEE TRAIN STOPS FOR NOBODY.', dur: 2.4, color: '#ffb070' },
    { area: { x: 44, y: 3, w: 15, h: 2 }, toast: 'WHEN THE CHIME GOES, KNOCK THEM ONTO THE TRACK' },
    { area: { x: 49, y: 13, w: 6, h: 3 }, msg: 'COPLAND ROAD', sub: 'THROUGH A CLOSE INTO THE BACK COURTS', dur: 2.2 },
    { area: { x: 31, y: 21, w: 6, h: 5 }, toast: 'THE MIDDEN ROOF. GOOD VIEW FROM UP THERE.' },
    { area: { x: 3, y: 29, w: 5, h: 4 }, msg: 'PAISLEY ROAD WEST', sub: 'PUBS, A CHIPPY AND THE ICF. IN THAT ORDER.', dur: 2.4, color: '#ffd080' },
    { area: { x: 27, y: 33, w: 3, h: 2 }, toast: 'THE FRYERS SPIT FAT. THROW SOMEBODY IN.' },
    { area: { x: 52, y: 40, w: 7, h: 3 }, toast: 'THE MAIN STAND. HALF OF GOVAN IS DOWN THERE.' },
    { area: { x: 40, y: 50, w: 11, h: 5 }, msg: 'THE MARBLE HALL', sub: 'WIPE YER FEET.', dur: 2, color: '#e8c860' },
    { area: { x: 43, y: 50, w: 4, h: 2 }, toast: 'THAT PANEL AT THE TOP OF THE STAIRS IS LOOSE...' },
    { area: { x: 24, y: 53, w: 10, h: 2 }, toast: 'HOME TURNSTILES. NOBODY ASKED FOR A TICKET.' },
  ],
  secrets: [
    { id: 'close', x: 3, y: 13, w: 10, h: 4, msg: 'THROUGH THE CLOSE: A HIDDEN BACK GREEN', score: 1500 },
    { id: 'middenroof', x: 34, y: 24, w: 2, h: 1, msg: 'ON THE MIDDEN ROOF', score: 800 },
    { id: 'freezer', x: 35, y: 38, msg: 'THE DEEP FREEZE', score: 1200 },
    { id: 'trophyroom', x: 41, y: 45, w: 9, h: 4, msg: 'THE TROPHY ROOM', score: 2000 },
  ],
  encounters: [
    {
      id: 'govanroad', area: { x: 14, y: 1, w: 3, h: 10 }, lockArea: { x: 1, y: 1, w: 32.9, h: 9.9 },
      msg: 'THE WELCOME COMMITTEE!', sub: 'THE ICF WERE WAITING AT THE BUS STOP',
      goTo: { x: 34, y: 3, w: 3, h: 5 },
      waves: [
        { enemies: [
          { type: 'ibrox_gers', x: 22.5, y: 6.5, from: { x: 36.5, y: 5.5 } },
          { type: 'ibrox_gers', x: 20.5, y: 3.5, from: { x: 20.5, y: 0.5 } },
          { type: 'ibrox_spotter', x: 27.5, y: 8.5, from: { x: 36.5, y: 4.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'ibrox_gers', x: 18.5, y: 8.5, from: { x: 12.5, y: 11.5 } },
          { type: 'ibrox_icf', x: 24.5, y: 5.5, from: { x: 36.5, y: 5.5 } },
          { type: 'ibrox_gers', x: 26.5, y: 2.5, from: { x: 28.5, y: 0.5 }, delay: 1.5 },
        ] },
      ],
    },
    {
      id: 'platform', area: { x: 44, y: 4, w: 3, h: 6 }, lockArea: { x: 38, y: 1, w: 20.9, h: 9.9 },
      msg: 'AMBUSH ON THE PLATFORM!', sub: 'THE SPOTTERS SAW THE COACH COME IN',
      goTo: { x: 50, y: 10, w: 4, h: 2 },
      waves: [
        { enemies: [
          { type: 'ibrox_spotter', x: 55.5, y: 8.5, from: { x: 51.5, y: 12.5 } },
          { type: 'ibrox_gers', x: 52.5, y: 5.5, from: { x: 59.5, y: 5.5 } },
          { type: 'ibrox_gers', x: 49.5, y: 8.5, from: { x: 51.5, y: 12.5 } },
        ] },
        { nextAt: 1, msg: 'MORE OFF THE TRAIN!', enemies: [
          { type: 'ibrox_gers', x: 53.5, y: 4.5, from: { x: 59.5, y: 4.5 } },
          { type: 'ibrox_spotter', x: 56.5, y: 9.5, from: { x: 59.5, y: 9.5 } },
          { type: 'ibrox_closemouth', x: 46.5, y: 9.5, from: { x: 41.5, y: 12.5 } },
        ] },
        { msg: 'ICF TOP BOY!', enemies: [
          { type: 'ibrox_icf', x: 51.5, y: 6.5, from: { x: 51.5, y: 12.5 } },
          { type: 'ibrox_gers', x: 55.5, y: 5.5, from: { x: 59.5, y: 6.5 } },
          { type: 'ibrox_gers', x: 48.5, y: 4.5, from: { x: 59.5, y: 3.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'backcourts', area: { x: 17, y: 20, w: 41, h: 1.5 }, lockArea: { x: 1, y: 20, w: 57.9, h: 6.9 },
      msg: 'OUT THE CLOSES!', sub: 'IT\'S A SET-UP. BACK TO BACK, LADS.',
      goTo: { x: 4, y: 25, w: 2, h: 2 },
      waves: [
        { enemies: [
          { type: 'ibrox_closemouth', x: 48.5, y: 23.5, from: { x: 52.5, y: 18.2 } },
          { type: 'ibrox_closemouth', x: 55.5, y: 24.5, from: { x: 59.5, y: 24.5 } },
          { type: 'ibrox_gers', x: 43.5, y: 22.5, from: { x: 38.5, y: 18.2 } },
        ] },
        { nextAt: 1, msg: 'THEY\'RE COMING OUT THE WALLS!', enemies: [
          { type: 'ibrox_closemouth', x: 40.5, y: 25.5, from: { x: 38.5, y: 18.2 } },
          { type: 'ibrox_closemouth', x: 50.5, y: 22.5, from: { x: 52.5, y: 18.2 } },
          { type: 'ibrox_gers', x: 44.5, y: 24.5, from: { x: 46.5, y: 27.5 } },
          { type: 'ibrox_spotter', x: 36.5, y: 21.5, from: { x: 24.5, y: 18.2 } },
        ] },
        { msg: 'SHIPYARD HARD MAN! SHOUT GRAB HIM!', enemies: [
          { type: 'ibrox_hardman', x: 44.5, y: 23.5, from: { x: 31.5, y: 26.5 } },
          { type: 'ibrox_closemouth', x: 52.5, y: 25.5, from: { x: 52.5, y: 18.2 }, delay: 2 },
          { type: 'ibrox_gers', x: 38.5, y: 24.5, from: { x: 24.5, y: 18.2 } },
        ] },
      ],
    },
    {
      id: 'paisleyroad', area: { x: 2, y: 29, w: 6, h: 5 }, lockArea: { x: 1, y: 29, w: 50.9, h: 9.9 },
      msg: 'THE PUBS EMPTY OUT!', sub: 'HALF-TIME IN THE STEAMIE. THEY HEARD YOU COMING.',
      goTo: { x: 52, y: 34, w: 7, h: 2 },
      waves: [
        { enemies: [
          { type: 'ibrox_gers', x: 12.5, y: 31.5, from: { x: 11.5, y: 28.2 } },
          { type: 'ibrox_gers', x: 16.5, y: 30.5, from: { x: 11.5, y: 28.2 }, delay: 1 },
          { type: 'ibrox_spotter', x: 20.5, y: 29.5, from: { x: 38.5, y: 28.2 } },
        ] },
        { nextAt: 1, msg: 'THE WEE SHIP HAS EMPTIED!', enemies: [
          { type: 'ibrox_gers', x: 24.5, y: 31.5, from: { x: 38.5, y: 28.2 } },
          { type: 'ibrox_gers', x: 28.5, y: 30.5, from: { x: 38.5, y: 28.2 }, delay: 1 },
          { type: 'ibrox_closemouth', x: 18.5, y: 32.5, from: { x: 4.5, y: 27.8 } },
          { type: 'ibrox_icf', x: 30.5, y: 32.5, from: { x: 52.5, y: 31.5 } },
        ] },
        { msg: 'THE CHIPPY REGULARS!', enemies: [
          { type: 'ibrox_hardman', x: 28.5, y: 31.5, from: { x: 28.5, y: 36.5 } },
          { type: 'ibrox_gers', x: 32.5, y: 30.5, from: { x: 52.5, y: 30.5 } },
          { type: 'ibrox_gers', x: 24.5, y: 32.5, from: { x: 28.5, y: 36.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'edmiston', area: { x: 52, y: 50, w: 7, h: 5 }, lockArea: { x: 24, y: 50, w: 34.9, h: 12.9 },
      msg: 'EDMISTON DRIVE', sub: 'UNDER THE RED-BRICK MAIN STAND. THE SHIPYARD SENT ITS BEST.',
      goTo: { x: 24, y: 55, w: 9, h: 1 }, clearMsg: 'THROUGH THE TURNSTILES!',
      waves: [
        { enemies: [
          { type: 'ibrox_gers', x: 40.5, y: 58.5, from: { x: 22.5, y: 59.5 } },
          { type: 'ibrox_gers', x: 46.5, y: 60.5, from: { x: 46.5, y: 63.5 } },
          { type: 'ibrox_icf', x: 36.5, y: 57.5, from: { x: 30.5, y: 55.2 } },
        ] },
        { nextAt: 1, msg: 'BIG MEN! GET A LAD ON EACH - GRAB HIM!', enemies: [
          { type: 'ibrox_hardman', x: 42.5, y: 59.5, from: { x: 30.5, y: 55.2 } },
          { type: 'ibrox_hardman', x: 34.5, y: 60.5, from: { x: 22.5, y: 60.5 } },
          { type: 'ibrox_spotter', x: 48.5, y: 57.5, from: { x: 44.5, y: 55.2 } },
        ] },
        { msg: 'THE ICF ARE OUT IN FORCE!', enemies: [
          { type: 'ibrox_icf', x: 38.5, y: 58.5, from: { x: 28.5, y: 55.2 } },
          { type: 'ibrox_closemouth', x: 50.5, y: 61.5, from: { x: 58.5, y: 63.5 } },
          { type: 'ibrox_gers', x: 30.5, y: 57.5, from: { x: 22.5, y: 58.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'awaypen', area: { x: 11, y: 50, w: 4, h: 4 }, lockArea: { x: 1, y: 47, w: 13.9, h: 7.9 },
      msg: 'THEY\'RE OVER THE FENCE!', sub: 'HOLD THE AWAY END. NOT AN INCH.',
      goTo: { x: 6, y: 54, w: 2, h: 2 }, clearMsg: 'THE EXIT GATES ARE OPEN!',
      waves: [
        { enemies: [
          { type: 'ibrox_gers', x: 4.5, y: 49.5, from: { x: 4.5, y: 45.2 } },
          { type: 'ibrox_gers', x: 9.5, y: 49.5, from: { x: 9.5, y: 45.2 } },
          { type: 'ibrox_closemouth', x: 7.5, y: 52.5, from: { x: 2.5, y: 45.2 } },
        ] },
        { nextAt: 1, msg: 'HOLD THE PEN!', enemies: [
          { type: 'ibrox_gers', x: 3.5, y: 51.5, from: { x: 3.5, y: 45.2 } },
          { type: 'ibrox_icf', x: 8.5, y: 50.5, from: { x: 8.5, y: 45.2 } },
          { type: 'ibrox_spotter', x: 12.5, y: 49.5, from: { x: 12.5, y: 45.2 } },
          { type: 'ibrox_gers', x: 6.5, y: 53.5, from: { x: 6.5, y: 45.2 }, delay: 2 },
        ] },
        { msg: 'THEIR TOP BOYS!', enemies: [
          { type: 'ibrox_icf', x: 5.5, y: 50.5, from: { x: 5.5, y: 45.2 } },
          { type: 'ibrox_hardman', x: 9.5, y: 51.5, from: { x: 10.5, y: 45.2 } },
          { type: 'ibrox_gers', x: 13.5, y: 53.5, from: { x: 13.5, y: 45.2 }, delay: 1.5 },
        ] },
      ],
    },
  ],
  boss: {
    type: 'ibrox_shuggie', x: 13.5, y: 59.5, title: 'BIG SHUGGIE', intro: '"THE RIVET". GOVAN\'S HARDEST PARKA.',
    area: { x: 1, y: 56, w: 21.9, h: 6.9 }, lockArea: BOSS_ARENA,
    minions: [
      { type: 'ibrox_gers', x: 4.5, y: 60.5 },
      { type: 'ibrox_icf', x: 18.5, y: 58.5 },
    ],
  },
  exit: { x: 1, y: 58.5, w: 1.6, h: 3 },

  onStart(world) {
    world.level.weather = 'rain';
    world.__ibrox = { warn: false, gust: 0, gustT: 6 + Math.random() * 4, chants: [] };
  },

  onUpdate(world, dt) {
    const S = world.__ibrox || (world.__ibrox = { warn: false, gust: 0, gustT: 6, chants: [] });
    const p = world.player;
    if (!p) return;
    // under a roof -> no rain (the level object is per-run state here; onStart puts the rain back)
    const inside = indoors(p);
    world.level.weather = inside ? null : 'rain';
    // gusts of horizontal rain outside
    S.gustT -= dt;
    if (S.gustT <= 0) { S.gustT = 8 + Math.random() * 6; S.gustLeft = 2.6; if (!inside && Math.random() < 0.35) world.toast('THE RAIN IS GOING SIDEWAYS NOW.'); }
    if (S.gustLeft > 0) S.gustLeft -= dt;
    const target = !inside && S.gustLeft > 0 ? 1 : 0;
    S.gust += (target - S.gust) * Math.min(1, dt * 3);
    // the wee orange train: warning chime + lights, draw actors for each train
    const hz = world.hazards.find(h => h.id === 'ibroxTrain');
    if (hz) {
      const passing = world.vehicles.some(v => v.def === hz && !v.removed);
      const warn = hz.t < 2.6 || passing;
      if (warn && !S.warn && !passing && inRect(p, 37, 0, 59, 11)) {
        world.sfx('underground_chime', p);
        world.toast('STAND BACK! THE WEE TRAIN IS COMING!');
      }
      S.warn = warn;
      if (warn) for (const x of [46, 51, 56]) world.addFrameLight({ x, y: 3.2, z: 0.3, r: 2.2, color: '#ffb030', intensity: Math.floor(world.time * 4) % 2 ? 0.9 : 0.3 });
      for (const v of world.vehicles) {
        if (v.def !== hz || v.ibx) continue;
        v.ibx = true;
        spawnSubwayTrain(world, v);
      }
      for (const v of world.vehicles) {
        if (v.def !== hz || v.ibxWhoosh) continue;
        if (Math.abs(v.y - p.y) < 4 && Math.abs(v.x - p.x) < 2.5) { v.ibxWhoosh = true; world.sfx('whooshBig', p); world.camera.shake(3, 0.4); }
      }
    }
    // queued chants
    for (let i = S.chants.length - 1; i >= 0; i--) { S.chants[i] -= dt; if (S.chants[i] <= 0) { S.chants.splice(i, 1); audio.chant && audio.chant(); } }
  },

  onEncounterClear(world, e) {
    const S = world.__ibrox;
    if (S && e.id !== 'govanroad') S.chants.push(0.6);
    if (e.id === 'platform') world.toast('UP THE STAIRS TO COPLAND ROAD.');
    if (e.id === 'backcourts') world.toast('THROUGH THE PEND TO PAISLEY ROAD WEST.');
    if (e.id === 'paisleyroad') world.toast('EAST, THEN DOWN TO THE MAIN STAND.');
    if (e.id === 'awaypen') { openTagged(world, 'penExit'); world.toast('SOMEBODY BIG IS WAITING ON THE FORECOURT...'); }
  },

  onBossDefeated(world) {
    world.message('THE RIVET IS DOWN!', 'GOVAN WILL TALK ABOUT THIS FOR YEARS', 3, '#a8c8ff');
    world.toast('THE COACH IS WAITING. LONG WAY HAME.');
    const S = world.__ibrox;
    if (S) { S.chants.push(0.3); S.chants.push(4); }
  },

  drawGround(ctx, world) { drawCranes(ctx, world); },
  drawOverlay(ctx, world) { const S = world.__ibrox; if (S) drawGust(ctx, world, S.gust); },
};
