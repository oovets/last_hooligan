// TOUR ARENA — ANFIELD. LIVERPOOL (THE REDS) v THE URCHINS (the Road End crew). Anfield, Liverpool L4.
// A grey, drizzly late afternoon in the last season of the standing Kop.
//
// Route: the coach drops you on Utting Avenue -> STANLEY PARK (fight on the lawn; ambush on the old bridge over the
//        lake; keeper's hut + loose glasshouse pane secrets) -> the west gate onto ROCKFIELD ROAD -> the ginnel into
//        the JIGGER (back-alley lads come over the yard walls; secret yard behind an unbolted gate) -> WALTON BRECK
//        ROAD (The Albert empties onto the street, the chippy, traffic) -> THE SHANKLY GATES -> concourse -> the
//        away turnstiles -> the AWAY END (Urchins have got in) -> the gate onto the PITCH (the Kop empties onto it)
//        -> BOSS in the shadow of the Kop: LENNY "THE JIGGER" -> the Paisley Gates -> out through the jigger behind
//        the stand.
// Map: 64 x 64, generated with rect fills (scratch generator). All people named here are invented.
import '../../themes/common.js';
import './theme.js';
import './boss.js';
import './music.js';
import { LFC, drawSurgeWarnings } from './theme.js';
import { tickTimers } from './boss.js';
import { audio } from '../../../audio/audio.js';

const RED = LFC.red, YEL = LFC.yel, WHITE = LFC.white;
const STAFF = 'anfield_staff';   // key nobody carries: these gates are opened by the level script

const PARK = { x: 23, y: 6, w: 39.9, h: 12.9 };
const BOSS_ARENA = { x: 12, y: 46, w: 12.9, h: 13.9 };
const KOP_STEP = [3.0, 2.7, 2.4, 2.1, 1.8, 1.5, 1.2, 0.9, 0.6, 0.3];   // x 1..10

function openTagged(world, tag) {
  for (const p of world.props) if (p.o.tag === tag) p.open = true;
  world.rebuildPropGrid();
}
const cleared = id => w => { const e = w.encounters.find(o => o.id === id); return !e || e.state === 'cleared'; };
function chant(world, delay = 0) { (world.__anfLvl ||= { chants: [] }).chants.push(delay); }

// the Kop crowd: one prop per column per two rows, standing on its step
const kopFans = [];
for (let i = 0; i < 10; i++) for (let y = 32; y <= 58; y += 2) kopFans.push({ type: 'anfield_kopFans', x: 1 + i, y, base: KOP_STEP[i] });

export default {
  id: 'anfield',
  num: 11,
  tour: true,
  name: 'ANFIELD',
  subtitle: 'SATURDAY. 16:40. DRIZZLE.',
  intro: [
    'ANFIELD. LIVERPOOL L4.',
    'THE LAST SEASON OF THE STANDING KOP.',
    'THE URCHINS KNOW EVERY JIGGER AND BACK YARD.',
    'MIND YOUR TRAINERS. AND YOUR POCKETS.',
  ],
  music: 'anfield',
  crowd: 0.7,
  weather: 'rain',
  ambient: { dark: 0.3, color: '#141a26', playerLight: 2.6 },
  bg: '#0c0e14',
  fog: 'rgba(150,160,180,0.06)',
  extraTokens: 1,
  defaultFloor: 'anfield_grass',
  start: { x: 59.5, y: 4.5 },
  startFacing: { x: -1, y: 0 },
  legend: {
    'g': { floor: 'anfield_grass' },
    'p': { floor: 'anfield_path' },
    '=': { floor: 'anfield_bridge' },
    '~': { floor: 'water' },
    ',': { floor: 'pavement' },
    'm': { floor: 'road' },
    'l': { floor: 'roadLineX' },
    'j': { floor: 'anfield_jigger' },
    'y': { floor: 'anfield_yard' },
    '_': { floor: 'anfield_concourse' },
    'k': { floor: 'anfield_track' },
    'q': { floor: 'anfield_pitch' },
    't': { floor: 'anfield_terrace' },
    'H': { floor: 'pavement', wall: 'anfield_house', h: 5 },
    'A': { floor: 'pavement', wall: 'anfield_pub', h: 4.5 },
    'C': { floor: 'pavement', wall: 'anfield_chippy', h: 4.5 },
    'R': { floor: 'anfield_grass', wall: 'anfield_parkRail', h: 1.4 },
    'r': { floor: 'anfield_grass', wall: 'anfield_lakeRail', h: 1.4 },
    'T': { floor: 'anfield_grass', wall: 'hedge', h: 2.2 },
    'W': { floor: 'anfield_path', wall: 'anfield_glasshouse', h: 2.6 },
    'w': { floor: 'anfield_path', wall: 'anfield_glasshouse', h: 2.6, solid: false, fake: true },
    'Y': { floor: 'anfield_yard', wall: 'anfield_yardWall', h: 1.2 },
    'Z': { floor: 'anfield_yard', wall: 'anfield_yardWall', h: 1.7 },
    'D': { floor: 'anfield_yard', wall: 'anfield_yardGate', h: 1.7, solid: false, fake: true },
    'F': { floor: 'pavement', wall: 'anfield_facade', h: 3.5 },
    'S': { floor: 'anfield_concourse', wall: 'anfield_standWall', h: 3.5 },
    'V': { floor: 'anfield_track', wall: 'anfield_perimeter', h: 1.4 },
    'K': { floor: 'anfield_terrace', wall: 'anfield_kopBack', h: 4.2 },
    '1': { floor: 'anfield_terrace', wall: 'anfield_step', h: 0.3 },
    '2': { floor: 'anfield_terrace', wall: 'anfield_step', h: 0.6 },
    '3': { floor: 'anfield_terrace', wall: 'anfield_step', h: 0.9 },
    '4': { floor: 'anfield_terrace', wall: 'anfield_step', h: 1.2 },
    '5': { floor: 'anfield_terrace', wall: 'anfield_step', h: 1.5 },
    '6': { floor: 'anfield_terrace', wall: 'anfield_step', h: 1.8 },
    '7': { floor: 'anfield_terrace', wall: 'anfield_step', h: 2.1 },
    '8': { floor: 'anfield_terrace', wall: 'anfield_step', h: 2.4 },
    '9': { floor: 'anfield_terrace', wall: 'anfield_step', h: 2.7 },
    '0': { floor: 'anfield_terrace', wall: 'anfield_step', h: 3.0 },
  },
  map: [
    'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHHHHH,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,H',
    'HHHHHHHHHHHHHHHHHHHHHHHmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmH',
    'HHHHHHHHHHHHHHHHHHHHHHHllllllllllllllllllllllllllllllllllllllllH',
    'HHHHHHHHHHHHHHHHHHHHHHH,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,H',
    'HHHHHHyyYjjjYyyHHH,mm,RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRppRRRRR',
    'HHHHHHyyYjjjYyyHHH,mm,RggggggggggggggggggggggggggggggggggppggggT',
    'HHHHHHYYYjjjYYYHHH,mm,RgggggggpppppppppppppppppppppppppppppggggT',
    'HHHHHHyyYjjjjjjjjj,mm,RgpppppppppppppppppppppppppppppppppppggggT',
    'HHHHHHyyyjjjjjjjjj,mm,Rgppggggggrrrrrrrrr==rrrrrrrrrppgggggggggT',
    'HHHHHHyyYjjjYyyHHH,mm,Rgppggggggr~~~~~~~r==r~~~~~~~rppgggggggggT',
    'HHHHHHYYYjjjYYYHHH,mm,RgppWWWWWWr~~~~~~~r==r~~~~~~~rppgggggggggT',
    'HHHHHHyyYjjjyyyHHH,mm,RgppWppppWr~~~~~~~r==r~~~~~~~rppgggggggggT',
    'HHHHHHyyYjjjYyyHHH,mm,RgppWWwWWWr~~~~~~~r==r~~~~~~~rppgggggggggT',
    'HHHHHHYYYjjjZZZHHH,mm,Rgppggggggrrrrrrrrr==rrrrrrrrrppgggggggggT',
    'HHHHHHyyYjjjZyyHHH,mm,pppppppppppppppppppgggggggggggppgggggggggT',
    'HHHHHHyyyjjjDyyHHH,mm,ppppppppppppppppppppppppppppppppgggggggggT',
    'HHHHHHyyYjjjZyyHHH,mm,RggggggggggggggggggpppppppppppppgggggggggT',
    'HHHHHHyyYjjjZyyHHH,mm,RggggggggggggggggggggggggggggggggggggggggT',
    'HCCCCHHHHjjjAAAAAAHHHHRRRRAAAAAAHHRRRRRRRRRRRRRRRRRRRRRRRRRRRRRH',
    'H,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,H',
    'HmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmH',
    'HllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllllH',
    'HmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmH',
    'H,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,H',
    'H,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,H',
    'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF____FFFF',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS_____________________S',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS_____________________S',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS_____________________S',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS_____________________S',
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS___SSSSS',
    'K0987654321VkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkkttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkkttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkVttttttttttS',
    'K0987654321VkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkVttttttttttS',
    'SSSSSSSSSSSSSSSSkkSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
    'jjjjjjjjjjjjjjjjjjjjjjjjjjH                                     ',
    'jjjjjjjjjjjjjjjjjjjjjjjjjjH                                     ',
    'HHHHHHHHHHHHHHHHHHHHHHHHHHH                                     ',
  ],
  items: [
    // ---- the five lost scarves
    { type: 'scarf', x: 62.5, y: 18.5 },                 // tucked behind the park keeper's hut (break it)
    { type: 'scarf', x: 56.0, y: 11.0, z: 0.6 },         // on the bandstand floor (jump up)
    { type: 'scarf', x: 13.5, y: 17.5 },                 // the secret back yard (unbolted gate)
    { type: 'scarf', x: 38.9, y: 24.5, z: 1.2 },         // on top of the skip on Walton Breck Road (jump)
    { type: 'scarf', x: 62.5, y: 58.5 },                 // far corner of the away end
    // ---- the pin badge: inside the glasshouse, through the loose pane
    { type: 'badge', x: 29.5, y: 12.5 },
    { type: 'cash20', x: 27.5, y: 12.5 },
    { type: 'fanzine', x: 21.5, y: 7.5, title: 'THE ROAD END RAG #4', text: 'A WORD ABOUT LENNY "THE JIGGER". NOBODY HAS EVER LANDED A CLEAN ONE ON HIM. WHEN HE DOES HIS LITTLE SHUFFLE, DO NOT SWING - HE ROLLS ROUND YOU AND BACK-HEELS YOU INTO NEXT WEEK. WHEN HE SHOWS OFF HIS TRAINERS, EITHER HIT HIM STRAIGHT AWAY OR GET WELL BACK: THE GLINT OFF THEM HAS BLINDED BETTER MEN. AND IF HE STARTS WAVING AT THE KOP, LOOK FOR THE RED ARROWS AND GET OUT OF THE WAY. ALSO: THE GLASSHOUSE IN THE PARK HAS A LOOSE PANE. WE SAID NOTHING.' },
    // ---- health between fights
    { type: 'pie', x: 45.5, y: 7.5 },
    { type: 'anfield_chips', x: 30.5, y: 16.5 },
    { type: 'anfield_scouse', x: 19.5, y: 10.5 },
    { type: 'pint', x: 10.5, y: 17.5 },
    { type: 'anfield_chips', x: 3.5, y: 20.5 },
    { type: 'pint', x: 14.5, y: 21.0 },
    { type: 'anfield_scouse', x: 47.5, y: 28.5 },
    { type: 'pint', x: 58.5, y: 40.5 },
    { type: 'energy', x: 32.0, y: 46.5 },
    { type: 'anfield_scouse', x: 27.5, y: 52.5 },
    { type: 'pie', x: 44.5, y: 24.5 },
    // ---- weapons
    { type: 'umbrella', x: 36.5, y: 17.5 },
    { type: 'bottle', x: 49.5, y: 6.5 },
    { type: 'anfield_prop', x: 13.5, y: 10.5 },
    { type: 'binlid', x: 10.5, y: 6.5 },
    { type: 'brick', x: 6.5, y: 9.5 },
    { type: 'bottle', x: 20.5, y: 24.5 },
    { type: 'pipe', x: 33.5, y: 25.5 },
    { type: 'brick', x: 55.5, y: 50.5 },
    { type: 'bottle', x: 20.5, y: 50.5 },
    { type: 'umbrella', x: 14.5, y: 55.5 },
    // ---- small change
    { type: 'coin', x: 40.5, y: 6.5 }, { type: 'coin', x: 10.5, y: 11.5 }, { type: 'cash5', x: 23.5, y: 12.5 },
    { type: 'coin', x: 24.5, y: 20.5 }, { type: 'coin', x: 60.5, y: 34.5 }, { type: 'cash5', x: 6.5, y: 61.5 },
  ],
  props: [
    // ================= Utting Avenue + Stanley Park
    { type: 'anfield_coach', x: 52, y: 2, color: '#e8e4d8', trim: RED, text: 'NORDHAMN EXECUTIVE' },
    { type: 'lamp', x: 47, y: 4 }, { type: 'lamp', x: 33, y: 4 },
    { type: 'busStop', x: 40, y: 1 },
    { type: 'anfield_parkGates', x: 57, y: 5, dir: 'x', len: 2, text: 'STANLEY PARK' },
    { type: 'gate', x: 22, y: 15, dir: 'y', key: STAFF, tag: 'parkGate', lockedMsg: 'THE PARK KEEPER LOCKED IT. CLEAR THE BRIDGE.' },
    { type: 'gate', x: 22, y: 16, dir: 'y', key: STAFF, tag: 'parkGate', lockedMsg: 'THE PARK KEEPER LOCKED IT. CLEAR THE BRIDGE.' },
    { type: 'tree', x: 24, y: 6 }, { type: 'tree', x: 30, y: 6 }, { type: 'tree', x: 61, y: 7 }, { type: 'tree', x: 62, y: 11 },
    { type: 'tree', x: 60, y: 15 }, { type: 'tree', x: 49, y: 18 }, { type: 'tree', x: 38, y: 18 }, { type: 'tree', x: 31, y: 17 },
    { type: 'tree', x: 28, y: 9 }, { type: 'tree', x: 55, y: 13 }, { type: 'tree', x: 36, y: 6 },
    { type: 'lamp', x: 46, y: 6 }, { type: 'lamp', x: 54, y: 16 }, { type: 'lamp', x: 26, y: 17 }, { type: 'lamp', x: 44, y: 18 },
    { type: 'bench', x: 50, y: 6 }, { type: 'bench', x: 34, y: 17 }, { type: 'bench', x: 47, y: 18 }, { type: 'bench', x: 40, y: 6 },
    { type: 'bin', x: 59, y: 6 }, { type: 'bin', x: 39, y: 15 },
    { type: 'anfield_bandstand', x: 55, y: 10 },
    { type: 'anfield_hut', x: 61, y: 18, secret: 'hut' },
    { type: 'bin', x: 62, y: 17 },
    { type: 'anfield_ducks', x: 35, y: 11 }, { type: 'anfield_ducks', x: 47, y: 12 }, { type: 'anfield_ducks', x: 37, y: 13 },
    { type: 'sign', x: 40, y: 9, side: 'right', len: 1, z: 1.45, height: 0.5, text: 'NO', color: '#ffffff', bg: '#2a5a32' },
    // ================= Rockfield Road, the ginnel and the jigger
    { type: 'sign', x: 17, y: 11, side: 'right', len: 4, z: 3.3, height: 0.55, text: 'ROCKFIELD ROAD L4', color: '#1a1a1a', bg: '#f0f0ea' },
    { type: 'anfield_banner', x: 17, y: 6, side: 'right', z: 2.4, text: 'URCHINS' },
    { type: 'anfield_banner', x: 17, y: 15, side: 'right', z: 2.4, a: WHITE, b: RED, crest: RED, color: RED, text: 'REDS' },
    { type: 'anfield_van', x: 19, y: 12 },
    { type: 'wheeliebin', x: 18, y: 6 }, { type: 'wheeliebin', x: 21, y: 17 },
    { type: 'wheeliebin', x: 9, y: 6 }, { type: 'wheeliebin', x: 11, y: 13 }, { type: 'wheeliebin', x: 9, y: 17 },
    { type: 'bin', x: 11, y: 10 },
    { type: 'anfield_washing', x: 6, y: 12, dir: 'y', len: 2 },
    { type: 'anfield_washing', x: 13, y: 10, dir: 'x', len: 2 },
    { type: 'anfield_washing', x: 6, y: 15, dir: 'y', len: 3 },
    { type: 'anfield_washing', x: 13, y: 15, dir: 'y', len: 3 },
    { type: 'anfield_outhouse', x: 14, y: 16 },
    { type: 'anfield_outhouse', x: 7, y: 8 },
    { type: 'graffiti', x: 8, y: 13, side: 'right', z: 0.25, text: 'URCHINS', color: '#e83a3a' },
    { type: 'graffiti', x: 8, y: 6, side: 'right', z: 0.3, text: 'ROAD END', color: '#ffffff' },
    { type: 'graffiti', x: 8, y: 17, side: 'right', z: 0.3, text: 'SCALLY LADS', color: '#9ad0e8' },
    { type: 'graffiti', x: 17, y: 7, side: 'right', z: 0.9, text: 'LFC', color: '#e83a3a' },
    // ================= Walton Breck Road
    { type: 'sign', x: 12, y: 19, len: 6, z: 1.85, height: 0.5, text: 'THE ALBERT', color: '#f0d070', bg: '#1c4a30' },
    { type: 'sign', x: 26, y: 19, len: 6, z: 1.85, height: 0.5, text: 'THE PARK', color: '#f0d070', bg: '#5a1420' },
    { type: 'sign', x: 1, y: 19, len: 4, z: 1.75, height: 0.5, text: 'CHIPPY', color: '#fff4a0', bg: '#c01828' },
    { type: 'sign', x: 18, y: 19, len: 4, z: 3.3, height: 0.5, text: 'WALTON BRECK RD', color: '#1a1a1a', bg: '#f0f0ea' },
    { type: 'anfield_banner', x: 19, y: 19, z: 2.3, text: 'YNWA' },
    { type: 'anfield_banner', x: 7, y: 19, z: 2.3, a: WHITE, b: RED, crest: RED, color: RED, text: 'L4' },
    { type: 'anfield_locals', x: 13, y: 20, pint: true }, { type: 'anfield_locals', x: 17, y: 20, flip: true, pint: true },
    { type: 'anfield_locals', x: 27, y: 20, pint: true }, { type: 'anfield_locals', x: 31, y: 20, flip: true },
    { type: 'anfield_locals', x: 2, y: 20 },
    { type: 'anfield_locals', x: 46, y: 25 }, { type: 'anfield_locals', x: 50, y: 25, flip: true }, { type: 'anfield_locals', x: 61, y: 25, flip: true },
    { type: 'table', x: 15, y: 20 },
    { type: 'skip', x: 38, y: 24 },
    { type: 'busStop', x: 44, y: 20 },
    { type: 'lamp', x: 6, y: 25 }, { type: 'lamp', x: 22, y: 25 }, { type: 'lamp', x: 34, y: 25 }, { type: 'lamp', x: 53, y: 25 },
    { type: 'postbox', x: 36, y: 20 },
    { type: 'graffiti', x: 33, y: 19, side: 'left', z: 1.2, text: 'URCHINS', color: '#e83a3a' },
    // stadium facade (the +y face shows from the concourse side; the gate arch is visible from the road)
    { type: 'anfield_shanklyGates', x: 56, y: 26, len: 4 },
    { type: 'sign', x: 42, y: 26, len: 8, z: 1.7, height: 0.8, text: 'LIVERPOOL FOOTBALL CLUB', color: '#ffffff', bg: '#a80c24' },
    { type: 'sign', x: 51, y: 26, len: 4, z: 1.2, height: 0.6, text: 'AWAY FANS →', color: '#1a1a1a', bg: YEL },
    { type: 'anfield_banner', x: 60, y: 26, z: 1.6 }, { type: 'anfield_banner', x: 61, y: 26, z: 1.6, a: WHITE, b: RED, crest: RED },
    { type: 'bin', x: 43, y: 30 }, { type: 'bin', x: 62, y: 27 }, { type: 'bench', x: 48, y: 30 },
    { type: 'anfield_turnstile', x: 56, y: 31, text: 'AWAY' }, { type: 'anfield_turnstile', x: 57, y: 31, text: 'AWAY' }, { type: 'anfield_turnstile', x: 58, y: 31, text: 'AWAY' },
    // ================= the ground: stand walls, the Kop
    { type: 'sign', x: 20, y: 31, len: 10, z: 2.4, height: 0.8, text: 'THIS IS ANFIELD', color: '#ffffff', bg: '#a80c24' },
    { type: 'sign', x: 33, y: 31, len: 8, z: 2.5, height: 0.6, text: 'KEEP OFF THE PITCH', color: '#ffffff', bg: '#1a5a32' },
    { type: 'anfield_banner', x: 31, y: 31, z: 1.4 }, { type: 'anfield_banner', x: 42, y: 31, z: 1.4, a: WHITE, b: RED, crest: RED },
    { type: 'sign', x: 0, y: 40, side: 'right', len: 12, z: 3.2, height: 0.9, text: 'THE KOP', color: '#ffffff', bg: '#a80c24' },
    { type: 'anfield_banner', x: 0, y: 34, side: 'right', z: 4.25, height: 1.2, text: 'LFC' },
    { type: 'anfield_banner', x: 0, y: 54, side: 'right', z: 4.25, height: 1.2, a: WHITE, b: RED, crest: RED, color: RED, text: 'REDS' },
    ...kopFans,
    { type: 'anfield_goal', x: 13, y: 44 },
    { type: 'anfield_goal', x: 49, y: 44, flip: true },
    { type: 'anfield_cornerFlag', x: 14, y: 33 }, { type: 'anfield_cornerFlag', x: 14, y: 58 },
    { type: 'anfield_cornerFlag', x: 49, y: 33 }, { type: 'anfield_cornerFlag', x: 49, y: 58 },
    // away end
    ...[36, 37, 42, 43, 49, 50, 55, 56].map(y => ({ type: 'anfield_crushBarrier', x: 56, y, scarf: y === 49 })),
    ...[33, 34, 39, 40, 46, 47, 52, 53].map(y => ({ type: 'anfield_crushBarrier', x: 59, y })),
    { type: 'anfield_banner', x: 54, y: 31, z: 1.2, a: '#1a1a20', b: RED, crest: WHITE, text: 'NORDHAMN' },
    { type: 'anfield_banner', x: 60, y: 31, z: 1.2, a: '#1a1a20', b: RED, crest: WHITE, text: 'ON TOUR' },
    { type: 'gate', x: 52, y: 44, dir: 'y', key: STAFF, tag: 'awayGate', lockedMsg: 'THE PEN GATE IS LOCKED. SORT THE AWAY END OUT FIRST.' },
    { type: 'gate', x: 52, y: 45, dir: 'y', key: STAFF, tag: 'awayGate', lockedMsg: 'THE PEN GATE IS LOCKED. SORT THE AWAY END OUT FIRST.' },
    // the Paisley Gates and the exit jigger
    { type: 'gate', x: 16, y: 60, dir: 'x', requiresExit: true, tag: 'paisley', lockedMsg: 'THE PAISLEY GATES ARE CHAINED. DEAL WITH LENNY.' },
    { type: 'gate', x: 17, y: 60, dir: 'x', requiresExit: true, tag: 'paisley', lockedMsg: 'THE PAISLEY GATES ARE CHAINED. DEAL WITH LENNY.' },
    { type: 'sign', x: 13, y: 60, len: 3, z: 2.3, height: 0.6, text: 'PAISLEY GATES', color: '#f0d070', bg: '#1a1a20' },
    { type: 'wheeliebin', x: 21, y: 61 }, { type: 'wheeliebin', x: 8, y: 62 },
    { type: 'graffiti', x: 26, y: 61, side: 'right', z: 1.2, text: 'URCHINS', color: '#e83a3a' },
    { type: 'exitArrow', x: 0, y: 61 },
  ],
  lights: [
    // park lamps are lit (lamp props); the glasshouse glows
    { x: 28.5, y: 12.5, z: 1.6, r: 3.2, color: '#d0ffd8', intensity: 0.5 },
    // pubs + chippy spill warm light onto the wet road
    { x: 15, y: 20.5, z: 1.4, r: 4.5, color: '#ffc870', intensity: 0.75 },
    { x: 29, y: 20.5, z: 1.4, r: 4.5, color: '#ffc870', intensity: 0.7 },
    { x: 2.5, y: 20.5, z: 1.4, r: 4, color: '#fff4c0', intensity: 0.8, flicker: true },
    // jigger: one bare bulb over a back gate
    { x: 10.5, y: 12, z: 2.2, r: 3.4, color: '#ffd890', intensity: 0.6, flicker: true },
    // concourse
    { x: 47, y: 28.5, z: 2.6, r: 5, color: '#e8f0ff', intensity: 0.55 },
    { x: 57.5, y: 29, z: 2.6, r: 5, color: '#e8f0ff', intensity: 0.6 },
    // floodlights (on the stand roofs)
    { x: 22, y: 40, z: 7, r: 11, color: '#f4f6ff', intensity: 0.6 },
    { x: 40, y: 40, z: 7, r: 11, color: '#f4f6ff', intensity: 0.6 },
    { x: 22, y: 53, z: 7, r: 11, color: '#f4f6ff', intensity: 0.6 },
    { x: 40, y: 53, z: 7, r: 11, color: '#f4f6ff', intensity: 0.6 },
    { x: 57.5, y: 38, z: 5, r: 8, color: '#fff0c8', intensity: 0.45 },
    { x: 57.5, y: 52, z: 5, r: 8, color: '#fff0c8', intensity: 0.45 },
    { x: 5, y: 40, z: 6, r: 9, color: '#ffe8e0', intensity: 0.45 },
    { x: 5, y: 52, z: 6, r: 9, color: '#ffe8e0', intensity: 0.45 },
    // the exit jigger
    { x: 12, y: 61.5, z: 2, r: 3.5, color: '#ffd890', intensity: 0.55 },
  ],
  hazards: [
    // Walton Breck Road traffic, both ways
    { type: 'traffic', lane: [{ x: -4, y: 21.5 }, { x: 68, y: 21.5 }], interval: [6, 11], speed: 8, offset: 4, dmg: 14, colors: ['#8a2020', '#d8d8d0', '#203a8a', '#2a6a3a', '#3a3a40'] },
    { type: 'traffic', lane: [{ x: 68, y: 23.5 }, { x: -4, y: 23.5 }], interval: [7, 12], speed: 7.5, offset: 8, dmg: 14, mix: [{ style: 'car', colors: ['#c8c0a8', '#6a1a1a', '#1a2a4a'], weight: 3 }, { style: 'bus', colors: ['#c8102e'], weight: 1, dmg: 20 }] },
  ],
  triggers: [
    { area: { x: 56, y: 1, w: 7, h: 4 }, toast: 'STANLEY PARK. THE GROUND IS ON THE FAR SIDE.' },
    { area: { x: 36, y: 6, w: 4, h: 3 }, toast: 'THE OLD BRIDGE. THE OTHER LOT\'S GROUND IS THAT WAY. NOT TODAY.' },
    { area: { x: 26, y: 14, w: 6, h: 2 }, toast: 'ONE OF THOSE GLASSHOUSE PANES LOOKS LOOSE...' },
    { area: { x: 52, y: 9, w: 2, h: 3 }, toast: 'IS THAT A SCARF UP ON THE BANDSTAND?' },
    { area: { x: 18, y: 14, w: 4, h: 3 }, msg: 'ROCKFIELD ROAD', sub: 'EYES BEHIND EVERY NET CURTAIN', dur: 2.4 },
    { area: { x: 15, y: 8, w: 2, h: 2 }, toast: 'THE GINNEL. INTO THE JIGGER.' },
    { area: { x: 9, y: 14, w: 3, h: 4 }, toast: 'THAT YARD GATE ISN\'T BOLTED...' },
    { area: { x: 36, y: 20, w: 3, h: 6 }, msg: 'WALTON BRECK ROAD', sub: 'MIND THE TRAFFIC', dur: 2.2 },
    { area: { x: 54, y: 24, w: 7, h: 2 }, msg: 'THE SHANKLY GATES', sub: 'TAKE YOUR HAT OFF', dur: 2.4, color: '#f0d070', action: () => { audio.chant && audio.chant(); } },
    { area: { x: 55, y: 32, w: 5, h: 1 }, msg: 'THE AWAY END', sub: 'AND THE KOP AT THE FAR END. SWAYING.', dur: 2.4, color: '#ff6a6a', action: w => chant(w, 0.2) },
    { area: { x: 46, y: 43, w: 4, h: 4 }, msg: 'ON THE PITCH!', sub: 'THE KOP HAS SEEN YOU', dur: 2, color: '#ffe14a', action: w => chant(w, 0) },
    { area: { x: 14, y: 33, w: 2, h: 2 }, toast: 'E = PULL OUT THE CORNER FLAG' },
    { area: { x: 48, y: 57, w: 2, h: 2 }, toast: 'E = PULL OUT THE CORNER FLAG' },
  ],
  secrets: [
    { id: 'hut', x: 61, y: 18, msg: 'THE PARK KEEPER\'S HUT', score: 1200 },
    { id: 'glasshouse', x: 27, y: 12, w: 4, h: 1, msg: 'INSIDE THE GLASSHOUSE', score: 2000 },
    { id: 'backyard', x: 13, y: 15, w: 2, h: 4, msg: 'NAN\'S BACK YARD', score: 1500 },
  ],
  encounters: [
    {
      id: 'park', area: { x: 50, y: 6, w: 12, h: 3 }, lockArea: PARK, crowd: 0.5,
      msg: 'URCHINS IN THE PARK!', sub: 'AND SCALLIES. THEY NICK THINGS. FLOOR THEM TO GET IT BACK.',
      goTo: { x: 41, y: 11, w: 2, h: 2 },
      waves: [
        { enemies: [
          { type: 'anfield_urchin', x: 52.5, y: 12.5, from: { x: 52.5, y: 19.5 } },
          { type: 'anfield_urchin', x: 47.5, y: 7.5, from: { x: 30.5, y: 5.5 } },
          { type: 'anfield_scally', x: 54.5, y: 15.5, from: { x: 58.5, y: 19.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'anfield_scally', x: 44.5, y: 7.5, from: { x: 38.5, y: 5.5 } },
          { type: 'anfield_bottler', x: 53.5, y: 14.5, from: { x: 53.5, y: 19.5 } },
          { type: 'anfield_urchin', x: 58.5, y: 16.5, from: { x: 62.5, y: 19.5 } },
        ] },
        { msg: 'MORE OVER THE RAILINGS!', enemies: [
          { type: 'anfield_urchin', x: 52.5, y: 10.5, from: { x: 63.5, y: 10.5 } },
          { type: 'anfield_scally', x: 46.5, y: 8.5, from: { x: 44.5, y: 5.5 } },
          { type: 'anfield_urchin', x: 57.5, y: 12.5, from: { x: 63.5, y: 14.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'bridge', area: { x: 41, y: 11, w: 2, h: 2 }, lockArea: PARK, crowd: 0.5, requires: cleared('park'),
      msg: 'BOXED IN ON THE BRIDGE!', sub: 'BOTH ENDS. TELL THE LADS TO HOLD!',
      goTo: { x: 22, y: 15, w: 2, h: 2 }, clearMsg: 'THE WEST GATE IS OPEN!',
      waves: [
        { enemies: [
          { type: 'anfield_urchin', x: 41.5, y: 8.0, from: { x: 41.5, y: 5.5 } },
          { type: 'anfield_scally', x: 42.5, y: 7.5, from: { x: 46.5, y: 5.5 } },
          { type: 'anfield_urchin', x: 41.5, y: 15.5, from: { x: 41.5, y: 19.5 } },
          { type: 'anfield_urchin', x: 42.5, y: 16.5, from: { x: 44.5, y: 19.5 } },
        ] },
        { nextAt: 1, msg: 'BIG KOP LAD! LADS - GRAB HIM!', enemies: [
          { type: 'anfield_koplad', x: 42.0, y: 16.0, from: { x: 42.5, y: 19.5 } },
          { type: 'anfield_scally', x: 41.5, y: 7.5, from: { x: 36.5, y: 5.5 } },
        ] },
        { msg: 'THEY\'RE COMING FROM THE BOWLING GREEN!', enemies: [
          { type: 'anfield_urchin', x: 42.5, y: 8.0, from: { x: 48.5, y: 5.5 } },
          { type: 'anfield_bottler', x: 46.5, y: 16.5, from: { x: 48.5, y: 19.5 } },
          { type: 'anfield_urchin', x: 40.5, y: 16.5, from: { x: 36.5, y: 19.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'jigger', area: { x: 9, y: 8, w: 3, h: 2 }, lockArea: { x: 6, y: 5, w: 8.9, h: 13.9 }, crowd: 0.3,
      msg: 'AMBUSH IN THE JIGGER!', sub: 'OVER THE BACK-YARD WALLS',
      goTo: { x: 9, y: 18, w: 3, h: 2 },
      waves: [
        { enemies: [
          { type: 'anfield_alleylad', x: 9.5, y: 6.5, from: { x: 6.5, y: 5.5 }, vault: true },
          { type: 'anfield_alleylad', x: 11.5, y: 11.0, from: { x: 13.5, y: 12.5 }, vault: true },
          { type: 'anfield_scally', x: 10.5, y: 15.5, from: { x: 10.5, y: 19.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'anfield_alleylad', x: 9.5, y: 12.5, from: { x: 6.5, y: 12.5 }, vault: true },
          { type: 'anfield_alleylad', x: 9.5, y: 16.5, from: { x: 6.5, y: 17.5 }, vault: true, weapon: 'brick' },
          { type: 'anfield_urchin', x: 10.5, y: 14.5, from: { x: 10.5, y: 19.5 }, weapon: 'binlid' },
        ] },
        { msg: 'THEY KNOW EVERY YARD!', enemies: [
          { type: 'anfield_topboy', x: 10.5, y: 13.5, from: { x: 10.5, y: 19.5 } },
          { type: 'anfield_alleylad', x: 11.5, y: 6.5, from: { x: 13.5, y: 5.5 }, vault: true },
          { type: 'anfield_scally', x: 10.5, y: 7.0, from: { x: 10.5, y: 4.6 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'waltonbreck', area: { x: 9, y: 19, w: 3, h: 2 }, lockArea: { x: 1, y: 20, w: 34.9, h: 5.9 }, crowd: 0.6,
      msg: 'THE ALBERT IS EMPTYING!', sub: 'WALTON BRECK ROAD. MIND THE TRAFFIC.',
      goTo: { x: 56, y: 24, w: 4, h: 2 }, clearMsg: 'ON TO THE SHANKLY GATES!',
      waves: [
        { enemies: [
          { type: 'anfield_urchin', x: 14.5, y: 22.5, from: { x: 14.5, y: 19.5 } },
          { type: 'anfield_urchin', x: 18.5, y: 24.5, from: { x: 16.5, y: 19.5 } },
          { type: 'anfield_bottler', x: 26.5, y: 24.5, from: { x: 28.5, y: 19.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'anfield_scally', x: 4.5, y: 22.5, from: { x: 0.6, y: 22.5 } },
          { type: 'anfield_scally', x: 30.5, y: 23.5, from: { x: 36.5, y: 22.5 } },
          { type: 'anfield_koplad', x: 28.5, y: 22.5, from: { x: 29.5, y: 19.5 } },
        ] },
        { msg: 'THEIR TOP BOY!', enemies: [
          { type: 'anfield_topboy', x: 15.5, y: 23.5, from: { x: 15.5, y: 19.5 } },
          { type: 'anfield_urchin', x: 8.5, y: 24.5, from: { x: 3.5, y: 19.5 } },
          { type: 'anfield_urchin', x: 24.5, y: 21.5, from: { x: 36.5, y: 21.5 } },
          { type: 'anfield_bottler', x: 32.5, y: 25.0, from: { x: 36.5, y: 25.0 }, delay: 2.5 },
        ] },
      ],
    },
    {
      id: 'awayend', area: { x: 54, y: 32, w: 8, h: 2 }, lockArea: { x: 53, y: 32, w: 9.9, h: 27.9 }, crowd: 1,
      msg: 'URCHINS IN THE AWAY END!', sub: 'THEY CAME IN THROUGH THE EXIT GATES',
      goTo: { x: 50, y: 43, w: 2, h: 4 }, clearMsg: 'THE PEN GATE IS OPEN!',
      waves: [
        { enemies: [
          { type: 'anfield_urchin', x: 57.5, y: 41.5, from: { x: 57.5, y: 60.5 } },
          { type: 'anfield_urchin', x: 54.5, y: 40.5, from: { x: 51.5, y: 40.5 } },
          { type: 'anfield_scally', x: 60.5, y: 44.5, from: { x: 60.5, y: 60.5 } },
        ] },
        { nextAt: 1, msg: 'OVER THE FENCE!', enemies: [
          { type: 'anfield_koplad', x: 56.5, y: 46.5, from: { x: 51.5, y: 46.5 } },
          { type: 'anfield_scally', x: 59.5, y: 38.5, from: { x: 51.5, y: 37.5 } },
          { type: 'anfield_bottler', x: 61.5, y: 51.5, from: { x: 61.5, y: 60.5 } },
        ] },
        { msg: 'THE URCHINS\' FRONT LINE!', enemies: [
          { type: 'anfield_topboy', x: 57.5, y: 44.5, from: { x: 57.5, y: 60.5 } },
          { type: 'anfield_urchin', x: 54.5, y: 49.5, from: { x: 51.5, y: 50.5 } },
          { type: 'anfield_alleylad', x: 60.5, y: 47.5, from: { x: 61.5, y: 60.5 }, delay: 2 },
        ] },
      ],
    },
    {
      id: 'pitch', area: { x: 50, y: 43, w: 2, h: 4 }, lockArea: { x: 12, y: 32, w: 39.9, h: 27.9 }, crowd: 1,
      msg: 'PITCH INVASION!', sub: 'THE WHOLE ROAD END IS OUT',
      goTo: { x: 16, y: 48, w: 6, h: 6 }, clearMsg: 'LENNY THE JIGGER IS WAITING BY THE KOP...',
      waves: [
        { enemies: [
          { type: 'anfield_urchin', x: 42.5, y: 40.5, from: { x: 42.5, y: 31.5 } },
          { type: 'anfield_urchin', x: 40.5, y: 52.5, from: { x: 40.5, y: 60.5 } },
          { type: 'anfield_scally', x: 44.5, y: 46.5, from: { x: 32.5, y: 60.5 } },
          { type: 'anfield_scally', x: 37.5, y: 44.5, from: { x: 32.5, y: 31.5 } },
        ] },
        { nextAt: 1, enemies: [
          { type: 'anfield_koplad', x: 36.5, y: 47.5, from: { x: 28.5, y: 31.5 } },
          { type: 'anfield_topboy', x: 34.5, y: 42.5, from: { x: 26.5, y: 31.5 } },
          { type: 'anfield_bottler', x: 30.5, y: 52.5, from: { x: 30.5, y: 60.5 } },
          { type: 'anfield_urchin', x: 40.5, y: 50.5, from: { x: 44.5, y: 60.5 } },
        ] },
        { nextAt: 1, msg: 'THE KOP IS EMPTYING ONTO THE PITCH!', enemies: [
          { type: 'anfield_scally', x: 26.5, y: 40.5, from: { x: 11.5, y: 40.5 } },
          { type: 'anfield_scally', x: 26.5, y: 51.5, from: { x: 11.5, y: 51.5 } },
          { type: 'anfield_alleylad', x: 30.5, y: 46.5, from: { x: 11.5, y: 46.5 } },
          { type: 'anfield_urchin', x: 34.5, y: 38.5, from: { x: 34.5, y: 31.5 } },
        ] },
        { msg: 'THE URCHINS\' TOP BOYS!', enemies: [
          { type: 'anfield_topboy', x: 30.5, y: 44.5, from: { x: 20.5, y: 31.5 } },
          { type: 'anfield_topboy', x: 30.5, y: 49.5, from: { x: 20.5, y: 60.5 } },
          { type: 'anfield_koplad', x: 26.5, y: 46.5, from: { x: 11.5, y: 46.5 }, delay: 2.5 },
        ] },
      ],
    },
  ],
  boss: {
    type: 'anfield_lenny', x: 18.5, y: 53.5, title: 'LENNY THE JIGGER', intro: 'THE URCHINS\' TOP BOY. NOBODY\'S EVER LAID A FINGER ON HIM.',
    area: { x: 12, y: 46, w: 12.9, h: 13.9 }, lockArea: BOSS_ARENA, requires: cleared('pitch'),
    minions: [
      { type: 'anfield_scally', x: 21.5, y: 49.5 },
      { type: 'anfield_urchin', x: 14.5, y: 57.5 },
    ],
  },
  exit: { x: 0, y: 61, w: 1.2, h: 2 },

  onStart(world) {
    world.__anfLvl = { chants: [3] };
  },

  onUpdate(world, dt) {
    const S = world.__anfLvl || (world.__anfLvl = { chants: [] });
    for (let i = S.chants.length - 1; i >= 0; i--) {
      S.chants[i] -= dt;
      if (S.chants[i] <= 0) { S.chants.splice(i, 1); audio.chant && audio.chant(); }
    }
    tickTimers(world, dt);
  },

  onEncounterClear(world, e) {
    chant(world, 0.6);
    if (e.id === 'bridge') { openTagged(world, 'parkGate'); world.toast('THE PARK KEEPER HAS LEGGED IT. THE WEST GATE IS OPEN.'); }
    if (e.id === 'awayend') { openTagged(world, 'awayGate'); world.toast('A STEWARD OPENED THE PEN GATE AND RAN.'); }
    if (e.id === 'pitch') world.toast('LENNY IS WAITING IN FRONT OF THE KOP...');
  },

  onBossDefeated(world) {
    openTagged(world, 'paisley');
    world.message('LENNY HAS BEEN CAUGHT!', 'FIRST TIME FOR EVERYTHING', 3, '#ffe14a');
    world.toast('THE PAISLEY GATES ARE OPEN - OUT THROUGH THE JIGGER!');
    chant(world, 0.3);
  },

  drawOverlay(ctx, world) { drawSurgeWarnings(ctx, world); },
};
