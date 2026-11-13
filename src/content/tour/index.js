// THE FOOTBALL TOUR (phase F): away days at real grounds, unlocked by the firm's reputation (game/firmdata.js).
// The 8 home levels (LEVELS, in your club's town) stay the story campaign; tour arenas live here and are reached from THE MAP in the pub
// (ui/hub.js TourMapPanel). Each arena is a self-contained package in src/content/arenas/<id>/ (level.js imports its
// own theme.js / boss.js / music.js), so arenas can be built independently.
//
// ALL_LEVELS = [...LEVELS, ...tour levels] in a FIXED order: a level's index there is what PlayScene / the run snapshot
// use. Unfinished arenas export { stub: true } and are skipped by check.mjs and shown as "COMING SOON" on the map.
//
// TOUR entry: { id, venue, club, nick, firm, city, region, rep (needed to travel), lat, lon (map pin),
//               colors: [primary, secondary], danger 1-5, blurb, level }
import { LEVELS } from '../levels/index.js';
import { currentClub } from '../clubs.js';
import theden from '../arenas/theden/level.js';
import stamfordbridge from '../arenas/stamfordbridge/level.js';
import anfield from '../arenas/anfield/level.js';
import oldtrafford from '../arenas/oldtrafford/level.js';
import ibrox from '../arenas/ibrox/level.js';

// home: your club's city (clubs.js). Sweden is off the edge of the map, so the pin sits out in the North Sea on the
// map's east edge: the ferry over, where every away day starts
export const HOME = { get name() { return currentClub().city; }, lat: 56.2, lon: 1.6 };

export const TOUR = [
  { id: 'theden', venue: 'THE DEN', club: 'MILLWALL', nick: 'THE LIONS', firm: 'THE BUSHWACKERS', city: 'BERMONDSEY, LONDON SE16',
    region: 'LONDON', rep: 15, lat: 51.486, lon: -0.051, colors: ['#0b2c6b', '#f4f4f4'], danger: 5,
    blurb: 'NO ONE LIKES THEM. THEY DON\'T CARE. COLD BLOWING LANE IS NOT A PLACE FOR TOURISTS.', level: theden },
  { id: 'stamfordbridge', venue: 'STAMFORD BRIDGE', club: 'CHELSEA', nick: 'THE BLUES', firm: 'THE HEADHUNTERS', city: 'FULHAM ROAD, LONDON SW6',
    region: 'LONDON', rep: 35, lat: 51.482, lon: -0.191, colors: ['#034694', '#f4f4f4'], danger: 4,
    blurb: 'THE SHED END, THE KING\'S ROAD AND A FIRM THAT LEAVES CALLING CARDS. WEAR YOUR BEST CLOBBER.', level: stamfordbridge },
  { id: 'anfield', venue: 'ANFIELD', club: 'LIVERPOOL', nick: 'THE REDS', firm: 'THE URCHINS', city: 'ANFIELD, LIVERPOOL L4',
    region: 'NORTH WEST', rep: 60, lat: 53.431, lon: -2.961, colors: ['#c8102e', '#f6eb61'], danger: 4,
    blurb: 'THE KOP, THE TERRACED STREETS AND SCALLIES IN TRAINERS YOU CAN\'T BUY HERE YET.', level: anfield },
  { id: 'oldtrafford', venue: 'OLD TRAFFORD', club: 'MANCHESTER UNITED', nick: 'THE RED DEVILS', firm: 'THE MEN IN BLACK', city: 'STRETFORD, MANCHESTER M16',
    region: 'NORTH WEST', rep: 90, lat: 53.463, lon: -2.291, colors: ['#da291c', '#fbe122'], danger: 5,
    blurb: 'THE THEATRE OF DREAMS. THE RED ARMY OUTSIDE, THE MEN IN BLACK IN THE SHADOWS OF THE STRETFORD END.', level: oldtrafford },
  { id: 'ibrox', venue: 'IBROX', club: 'RANGERS', nick: 'THE GERS', firm: 'THE ICF', city: 'GOVAN, GLASGOW G51',
    region: 'SCOTLAND', rep: 130, lat: 55.853, lon: -4.309, colors: ['#1b458f', '#c8102e'], danger: 5,
    blurb: 'THE LONGEST TRIP. RED BRICK, THE BROOMLOAN ROAD AND THE INTER CITY FIRM WAITING AT THE SUBWAY.', level: ibrox },
];

export const ALL_LEVELS = [...LEVELS, ...TOUR.map(t => t.level)];
export const tourFor = level => TOUR.find(t => t.level === level || t.id === (level && level.id)) || null;
export const levelIndex = id => ALL_LEVELS.findIndex(l => l.id === id);
export const isTour = i => i >= LEVELS.length;
