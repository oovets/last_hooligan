// THE ANCHOR — the firm's local between trips (phase D hub; not in the LEVELS list, see ui/hub.js).
// Walk around, talk to your lads (USE next to them), and use the stations:
//   THE MAP (cork board, back wall)  plan the next trip, pick who travels
//   THE BAR                         Ron points out lads who want in (recruit)
//   THE BACK ROOM (heavy bag)        training
//   THE COAT RACK                    the wardrobe
//   THE DOOR                         call it a night (a day passes)
import './themes/common.js';
import './themes/pub.js';
import './themes/hub.js';

export const HUB_STATIONS = {
  map: { label: 'THE MAP', sub: 'PLAN THE NEXT TRIP' },
  bar: { label: 'THE BAR', sub: 'NEW FACES WANT IN' },
  train: { label: 'THE BACK ROOM', sub: 'TRAINING' },
  wardrobe: { label: 'THE COAT RACK', sub: 'WARDROBE' },
  door: { label: 'THE DOOR', sub: 'CALL IT A NIGHT' },
  lads: { label: 'THE LADS', sub: 'WHO\'S WHO' },
};

// where the lads hang about (tile centres), in order of preference
export const HUB_SPOTS = [
  [7.5, 8.5], [10.5, 7.8], [3.5, 5.5], [12.2, 4.5], [16.5, 6.5], [19.5, 7.5], [12.5, 9.5], [5.5, 9.2],
];

export default {
  id: 'hub',
  num: 0,
  name: 'THE ANCHOR',
  subtitle: 'THE FIRM\'S LOCAL',
  music: 'pub',
  crowd: 0,
  weather: null,
  firm: false,
  ambient: { dark: 0.34, color: '#140a1a', playerLight: 3.4 },
  bg: '#07050a',
  defaultFloor: 'pub_carpet',
  legend: {
    'c': { floor: 'pub_carpet' },
    'w': { floor: 'pub_boards' },
    'm': { floor: 'pub_barmat' },
    'e': { floor: 'pub_flags' },
    'S': { floor: 'pub_flags', marker: 'start' },
    'P': { floor: 'pub_boards', wall: 'pub_panel', h: 3.2 },
    'K': { floor: 'pub_barmat', wall: 'pub_backbar', h: 3.2 },
    'B': { floor: 'pub_barmat', wall: 'pub_bar', h: 1.0 },
    'l': { floor: 'pub_boards', wall: 'pub_panelLow', h: 1.2 },
  },
  map: [
    'PPPPPPPPPPPPPPPKKKKKKKKP',
    'Pccccccccccccccmmmmmmmml',
    'Pccccccccccccccmmmmmmmml',
    'PccccccccccccccBBBBBBBBl',
    'Pccccccccccccccwwwwwwwwl',
    'Pccccccccccccccwwwwwwwwl',
    'Pccccccccccccccwwwwwwwwl',
    'Pccccccccccccccwwwwwwwwl',
    'Pccccccccccccccwwwwwwwwl',
    'Pccccccccccccccwwwwwwwwl',
    'Pccccccccccccccwwwwwwwwl',
    'Pllllllcclcccccwwwwwwwwl',
    'Pwwwwwwwwlcccccwwwwwwwwl',
    'Pwwwwwwwwlcccccwwwwwwwwl',
    'Pwwwwwwwwlcccccwwwweeeel',
    'Pwwwwwwwwlcccccwwwweeeel',
    'PwwwwwwwwlcccccwwwweeSel',
    'Plllllllllllllllllllllll',
  ],
  startFacing: { x: -1, y: -1 },
  items: [],
  props: [
    // the map on the back wall
    { type: 'hub_corkboard', x: 5, y: 0, len: 2, text: 'THE TOUR' },
    { type: 'hub_station', x: 5, y: 1, action: 'map' }, { type: 'hub_station', x: 6, y: 1, action: 'map' },
    // lounge
    { type: 'pub_jukebox', x: 1, y: 1, openMsg: 'YOU FEED THE JUKEBOX A QUID...', danceMsg: 'B4: ROLL ON SATURDAY' },
    { type: 'pub_dartboard', x: 10, y: 0, z: 1.3 },
    { type: 'pub_telly', x: 13, y: 0, z: 2.2 },
    { type: 'pub_booth', x: 1, y: 4, dir: 'y' }, { type: 'pub_booth', x: 1, y: 5, dir: 'y' }, { type: 'pub_booth', x: 1, y: 6, dir: 'y' },
    { type: 'table', x: 2, y: 5 },
    { type: 'pub_pool', x: 8, y: 6 }, { type: 'pub_poollamp', x: 8, y: 6 },
    { type: 'pub_cuerack', x: 0, y: 8, side: 'right', infinite: true },
    { type: 'pub_stool', x: 11, y: 2 }, { type: 'pub_stool', x: 12, y: 6 },
    // the bar
    { type: 'pub_pumps', x: 17, y: 3, z: 1.0 }, { type: 'pub_pumps', x: 20, y: 3, z: 1.0, clips: ['#1f4fb4', '#c8102e', '#e8e0d0'] },
    { type: 'pub_till', x: 22, y: 3, z: 1.0 },
    { type: 'pub_pendant', x: 16, y: 3 }, { type: 'pub_pendant', x: 19, y: 3 }, { type: 'pub_pendant', x: 22, y: 3 },
    { type: 'pub_stool', x: 16, y: 4 }, { type: 'pub_stool', x: 21, y: 4 },
    { type: 'hub_station', x: 18, y: 4, action: 'bar' }, { type: 'hub_station', x: 19, y: 4, action: 'bar' },
    // back room
    { type: 'hub_punchbag', x: 3, y: 13 },
    { type: 'hub_station', x: 4, y: 13, action: 'train' }, { type: 'hub_station', x: 3, y: 14, action: 'train' },
    { type: 'pub_keg', x: 7, y: 15 }, { type: 'pub_keg', x: 8, y: 15 }, { type: 'pub_cask', x: 1, y: 16 },
    // wardrobe by the back room door
    { type: 'hub_coatrack', x: 11, y: 12 },
    { type: 'hub_station', x: 12, y: 12, action: 'wardrobe' },
    // the way out
    { type: 'hub_station', x: 22, y: 15, action: 'door' },
  ],
  lights: [
    { x: 6, y: 5, z: 2.6, r: 5, color: '#ffcf8a', intensity: 0.7 },
    { x: 11, y: 9, z: 2.6, r: 4.5, color: '#ffcf8a', intensity: 0.6 },
    { x: 18.5, y: 5, z: 2.6, r: 5.5, color: '#ffd8a0', intensity: 0.8 },
    { x: 18.5, y: 11, z: 2.6, r: 5, color: '#ffcf8a', intensity: 0.55 },
    { x: 4.5, y: 14, z: 2.4, r: 4, color: '#d8e8ff', intensity: 0.65, flicker: true },
    { x: 5.5, y: 1.6, z: 2.2, r: 2.6, color: '#fff0c0', intensity: 0.6 },
  ],
  hazards: [],
  triggers: [],
  secrets: [],
  encounters: [],
};
