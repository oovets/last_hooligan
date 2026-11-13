// Club affiliation for your firm (chosen on the FIRM SETUP screen when a new game starts, src/ui/firmsetup.js).
// The club gives the firm its name and colours: the CLUB SCARF in the wardrobe, the pub's banner, chants.
// save.data.club = club id (kept between games); save.data.firm.club = the club the current firm was formed for.
//
// CLUB = { id, short, name, nick, firm, city, a, b, c? (colours: main, second, accent), chant }
// Firm names: the well-known ones are the real terrace names (it's a private game); the rest are made up and marked.
import { save } from '../save.js';

export const CLUBS = [
  { id: 'nordhamn', short: 'NAFC', name: 'NORDHAMN ATHLETIC', nick: 'THE ANCHORS', firm: 'THE ANCHOR CREW', city: 'NORDHAMN',
    a: '#c8102e', b: '#f4f1e8', chant: 'RED AND WHITE TILL I DIE!' },
  { id: 'aik', short: 'AIK', name: 'AIK', nick: 'GNAGET', firm: 'FIRMAN BOYS', city: 'SOLNA',
    a: '#141416', b: '#f2c811', chant: 'AIK! AIK! AIK!' },
  { id: 'dif', short: 'DIF', name: 'DJURGÅRDENS IF', nick: 'JÄRNKAMINERNA', firm: 'DFG', city: 'STOCKHOLM',
    a: '#003c8f', b: '#d0102a', c: '#f2c811', chant: 'DJURGÅR\'N! DJURGÅR\'N!' },
  { id: 'bajen', short: 'BAJEN', name: 'HAMMARBY IF', nick: 'BAJEN', firm: 'KGB', city: 'SÖDERMALM',
    a: '#00843d', b: '#f4f4f0', chant: 'BAJEN! BAJEN!' },
  { id: 'blavitt', short: 'IFK', name: 'IFK GÖTEBORG', nick: 'BLÅVITT', firm: 'WISEMEN', city: 'GÖTEBORG',
    a: '#0a3d91', b: '#f4f4f0', chant: 'BLÅVITT! BLÅVITT!' },
  { id: 'mff', short: 'MFF', name: 'MALMÖ FF', nick: 'DI BLÅE', firm: 'TRUE ROCKERS', city: 'MALMÖ',
    a: '#7fb8e6', b: '#f4f4f0', chant: 'MALMÖ! MALMÖ!' },
  { id: 'hbg', short: 'HIF', name: 'HELSINGBORGS IF', nick: 'DI RÖE', firm: 'FRONTLINE', city: 'HELSINGBORG',
    a: '#d0102a', b: '#0a3d91', chant: 'DI RÖE! DI RÖE!' },
  // made-up firm name
  { id: 'peking', short: 'IFKN', name: 'IFK NORRKÖPING', nick: 'PEKING', firm: 'PEKING FIRM', city: 'NORRKÖPING',
    a: '#f4f4f0', b: '#0a3d91', chant: 'PEKING! PEKING!' },
];

export const clubById = id => CLUBS.find(c => c.id === id) || CLUBS[0];
// the club of the firm you're running now (falls back to your last pick, then Nordhamn)
export const currentClub = () => clubById((save.data.firm && save.data.firm.club) || save.data.club || 'nordhamn');
