// Club affiliation for your firm (chosen on the FIRM SETUP screen when a new game starts, src/ui/firmsetup.js).
// The club gives the firm its name and colours: the CLUB SCARF in the wardrobe, the pub's banner, chants.
// save.data.club = club id (kept between games); save.data.firm.club = the club the current firm was formed for.
//
// CLUB = { id, short, name, nick, firm, army (the supporters' club), city, venue (the ground in 1994), a, b, c? (colours: main, second, accent), chant }
// Firm names: the well-known ones are the real terrace names (it's a private game); the rest are made up and marked.
// Your club is the story's home side (content/rivals.js swaps it into the levels); AIK until you pick one.
import { save } from '../save.js';

export const CLUBS = [
  { id: 'aik', logo: 'aik', short: 'AIK', name: 'AIK', nick: 'GNAGET', firm: 'FIRMAN BOYS', army: 'BLACK ARMY', city: 'SOLNA', venue: 'RÅSUNDA',
    a: '#141416', b: '#f2c811', chant: 'AIK! AIK! AIK!' },
  { id: 'dif', logo: 'dif', short: 'DIF', name: 'DJURGÅRDENS IF', nick: 'JÄRNKAMINERNA', firm: 'DFG', army: 'JÄRNKAMINERNA', city: 'STOCKHOLM', venue: 'STOCKHOLMS STADION',
    a: '#003c8f', b: '#d0102a', c: '#f2c811', chant: 'DJURGÅR\'N! DJURGÅR\'N!' },
  { id: 'bajen', logo: 'bajen', short: 'BAJEN', name: 'HAMMARBY IF', nick: 'BAJEN', firm: 'KGB', army: 'BAJEN FANS', city: 'SÖDERMALM', venue: 'SÖDERSTADION',
    a: '#00843d', b: '#f4f4f0', chant: 'BAJEN! BAJEN!' },
  { id: 'blavitt', logo: 'blavitt', short: 'IFK', name: 'IFK GÖTEBORG', nick: 'BLÅVITT', firm: 'WISEMEN', army: 'ÄNGLARNA', city: 'GÖTEBORG', venue: 'ULLEVI',
    a: '#0a3d91', b: '#f4f4f0', chant: 'BLÅVITT! BLÅVITT!' },
  { id: 'mff', logo: 'mff', short: 'MFF', name: 'MALMÖ FF', nick: 'DI BLÅE', firm: 'TRUE ROCKERS', army: 'MFF SUPPORT', city: 'MALMÖ', venue: 'MALMÖ STADION',
    a: '#7fb8e6', b: '#f4f4f0', chant: 'MALMÖ! MALMÖ!' },
  { id: 'hbg', logo: 'hbg', short: 'HIF', name: 'HELSINGBORGS IF', nick: 'DI RÖE', firm: 'FRONTLINE', army: 'KÄRNAN', city: 'HELSINGBORG', venue: 'OLYMPIA',
    a: '#d0102a', b: '#0a3d91', chant: 'DI RÖE! DI RÖE!' },
  // made-up firm name
  { id: 'peking', logo: 'peking', short: 'IFKN', name: 'IFK NORRKÖPING', nick: 'PEKING', firm: 'PEKING FIRM', army: 'PEKING FANZ', city: 'NORRKÖPING', venue: 'IDROTTSPARKEN',
    a: '#f4f4f0', b: '#0a3d91', chant: 'PEKING! PEKING!' },
];

// club crests (assets/logos/<logo>.png; the real ones, from the clubs' Wikipedia pages: a private game for friends, never
// released). clubLogo(club) -> a loaded Image or null (still loading / none: the caller's fallback crest)
const LOGOS = {};
export function clubLogo(club) {
  if (!club || !club.logo || typeof Image === 'undefined') return null;
  let im = LOGOS[club.logo];
  if (!im) { im = LOGOS[club.logo] = new Image(); im.src = new URL('../../assets/logos/' + club.logo + '.png', import.meta.url).href; }
  return im.complete && im.naturalWidth ? im : null;
}
// cb(image) as soon as the club's crest has loaded (right away if it already has)
export function whenClubLogo(club, cb) {
  if (clubLogo(club)) { cb(clubLogo(club)); return; }
  const im = club && club.logo && LOGOS[club.logo];
  if (im) im.addEventListener('load', () => cb(im), { once: true });
}
// draw a crest fitted into a w x h box (bottom-centred); logo not loaded yet -> drawFallback
export function drawClubCrest(ctx, club, x, y, w, h, drawFallback) {
  const im = clubLogo(club);
  if (!im) { if (drawFallback) drawFallback(ctx, x, y, w, h); return; }
  const k = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh), dw, dh);
  ctx.restore();
}

export const DEFAULT_CLUB = 'aik';
// unknown ids (old saves still say 'nordhamn', the made-up club that's gone) -> AIK
export const clubById = id => CLUBS.find(c => c.id === id) || CLUBS.find(c => c.id === DEFAULT_CLUB);
// the club of the firm you're running now (falls back to your last pick, then AIK)
export const currentClub = () => clubById((save.data.firm && save.data.firm.club) || save.data.club || DEFAULT_CLUB);
