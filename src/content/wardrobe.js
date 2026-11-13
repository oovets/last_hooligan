// Wardrobe: unlockable cosmetics for THE LAST HOOLIGAN.
// Each category is a list of options:
//   { id, name, cost (cash, 0 = free), desc?, req: null | { level:n } | { scarves:n } | { badge:'levelId' } | { badges:n }
//     | { secrets:n } | { kos:n } | { score:n } | { complete:true }, ...data }
// buildLook(outfit) turns the saved outfit ids into a doll look (see doll.js LOOK FORMAT).
// Jackets may carry pockets (chest pockets), badge (the compass badge on the left arm), pattern: 'check' (trim = the dark
// bands, lining = the over-check line) and hood: 'down'; shoes may carry stripe (three stripes + heel tab).
// KITS are whole looks: { sets: { category: optionId, ... } }, worn in one go.
import { UNLOCK_ALL } from '../save.js';

export const CLUB = { name: 'NORDHAMN ATHLETIC', a: '#c8102e', b: '#f4f1e8', nick: 'THE ANCHORS' };

export const WARDROBE = {
  hair: [
    { id: 'crop', name: 'NUMBER TWO CROP', cost: 0, style: 'crop', desc: 'SENSIBLE. FIVE MINUTES WITH THE CLIPPERS.' },
    { id: 'shaved', name: 'GRADE ONE', cost: 0, style: 'shaved', desc: 'AERODYNAMIC. NOTHING TO GRAB.' },
    { id: 'skinhead', name: 'BOOTED BALDIE', cost: 150, style: 'skinhead', desc: 'POLISHED TO A SHINE EVERY MATCHDAY.' },
    { id: 'curtains', name: 'CURTAINS', cost: 250, style: 'curtains', desc: 'MIDDLE PARTING. VERY 1994.' },
    { id: 'mod', name: 'MOD BOWL', cost: 300, style: 'mod', req: { level: 2 }, desc: 'YOUR MUM DID IT WITH A PUDDING BASIN.' },
    { id: 'spiky', name: 'GEL SPIKES', cost: 350, style: 'spiky', req: { level: 3 }, desc: 'HALF A TUB OF WET-LOOK GEL.' },
    { id: 'flattop', name: 'FLAT TOP', cost: 400, style: 'flattop', req: { level: 4 }, desc: 'YOU COULD REST A PINT ON IT.' },
    { id: 'long', name: 'TERRACE MULLET', cost: 450, style: 'long', req: { level: 5 }, desc: 'BUSINESS AT THE FRONT. AWAY END AT THE BACK.' },
    { id: 'ponytail', name: 'ROADIE PONYTAIL', cost: 350, style: 'ponytail', req: { secrets: 6 }, desc: 'FOR LADS WHO KNOW ALL THE SHORTCUTS.' },
    { id: 'mohawk', name: 'TERRACE MOHICAN', cost: 600, style: 'mohawk', req: { scarves: 15 }, desc: 'IN CLUB COLOURS IF YOU DYE IT RED.' },
    { id: 'bald', name: 'CUE BALL', cost: 500, style: 'bald', req: { kos: 300 }, desc: 'THREE HUNDRED KNOCKOUTS. NOTHING LEFT TO PROVE.' },
  ],
  hairColor: [
    { id: 'brown', name: 'MOUSY BROWN', cost: 0, color: '#3a2717' },
    { id: 'black', name: 'JET BLACK', cost: 0, color: '#141016' },
    { id: 'ginger', name: 'GINGER', cost: 100, color: '#b4521c' },
    { id: 'blonde', name: 'PEROXIDE', cost: 150, color: '#e8d27a' },
    { id: 'grey', name: 'SILVER FOX', cost: 200, color: '#9a98a0', req: { level: 4 } },
    { id: 'red', name: 'CLUB RED', cost: 300, color: '#c8102e', req: { scarves: 10 } },
  ],
  jacket: [
    { id: 'harrington_green', name: 'HARRINGTON (BOTTLE)', cost: 0, style: 'harrington', color: '#2b3a2a', lining: '#b8302a', desc: 'THE CLASSIC. TARTAN LINING, ZIP TO THE CHIN.' },
    { id: 'harrington_navy', name: 'HARRINGTON (NAVY)', cost: 0, style: 'harrington', color: '#1d2742', lining: '#c33a2a', desc: 'FOR NIGHT MATCHES.' },
    { id: 'harrington_stone', name: 'HARRINGTON (STONE)', cost: 200, style: 'harrington', color: '#b5a98a', lining: '#b8302a', desc: 'SHOWS EVERY STAIN. BRAVE.' },
    { id: 'polo', name: 'TIPPED POLO', cost: 150, style: 'polo', color: '#f0ece0', shirt: '#f0ece0', trim: '#c8102e', desc: 'COLLAR UP, OBVIOUSLY.' },
    { id: 'homeshirt', name: 'ANCHORS HOME SHIRT', cost: 300, style: 'tee', color: '#c8102e', shirt: '#c8102e', trim: '#f4f1e8', req: { level: 2 }, desc: 'RED AND WHITE TILL YOU DIE.' },
    { id: 'track_red', name: 'SHELL TRACKTOP', cost: 250, style: 'track', color: '#a01020', trim: '#f2efe6', desc: 'SWISHES WHEN YOU WALK.' },
    { id: 'track_blue', name: 'TERRACE TRACKTOP', cost: 250, style: 'track', color: '#2a2f45', trim: '#c8102e', req: { level: 2 }, desc: 'NAVY WITH RED PIPING. SHARP.' },
    { id: 'cagoule', name: 'STORM CAGOULE', cost: 300, style: 'track', color: '#2a6a5a', trim: '#e8e4d0', req: { level: 3 }, desc: 'PACKS INTO ITS OWN POCKET.' },
    { id: 'bomber', name: 'FLIGHT BOMBER', cost: 350, style: 'bomber', color: '#3d4a2c', trim: '#252d1a', lining: '#e07020', req: { level: 3 }, desc: 'ORANGE LINING FOR EMERGENCIES.' },
    { id: 'parka', name: 'FISHTAIL PARKA', cost: 450, style: 'parka', color: '#4e5536', req: { level: 4 }, desc: 'HOOD UP, NOBODY KNOWS IT IS YOU.' },
    { id: 'leather', name: 'LEATHER BOMBER', cost: 500, style: 'leather', color: '#231a17', req: { level: 5 }, desc: 'SMELLS OF RAIN AND CIGARETTES.' },
    { id: 'suit', name: 'SUNDAY BEST', cost: 800, style: 'suit', color: '#2a2a32', shirt: '#e8e4dc', req: { badges: 4 }, desc: 'FOR CUP FINALS AND COURT DATES.' },
    { id: 'hivis', name: 'NICKED STEWARD BIB', cost: 400, style: 'hivis', color: '#d8e030', req: { level: 7 }, desc: 'NOBODY QUESTIONS A HI-VIS.' },
    { id: 'gold', name: 'GOLDEN HARRINGTON', cost: 2000, style: 'harrington', color: '#c9a227', lining: '#c8102e', req: { badges: 8 }, desc: 'EVERY PIN BADGE FOUND. A LIVING LEGEND.' },
    // ---- the labels
    { id: 'si_overshirt', name: 'STONE ISLAND OVERSHIRT', cost: 900, style: 'overshirt', color: '#a3ad97', trim: '#88937d', lining: '#a3ad97', shirt: '#f4f1e8', pockets: true, badge: true, desc: 'SAGE, TWO POCKETS, THE BADGE ON THE LEFT ARM. NEVER BUTTONED.' },
    { id: 'si_crinkle', name: 'STONE ISLAND CRINKLE REPS', cost: 1100, style: 'bomber', color: '#1b2235', trim: '#141a28', lining: '#1b2235', badge: true, hood: 'down', desc: 'NAVY NYLON THAT CRUMPLES LIKE A CRISP PACKET.' },
    { id: 'si_smock', name: 'STONE ISLAND SMOCK', cost: 1000, style: 'hoodie', color: '#c66a1f', trim: '#a8561a', badge: true, req: { level: 3 }, desc: 'OVER THE HEAD, ORANGE, AND THE BADGE. SUBTLE.' },
    { id: 'si_jacket_red', name: 'STONE ISLAND (FIRE RED)', cost: 1200, style: 'harrington', color: '#a8221e', trim: '#7a1814', lining: '#1e1a18', badge: true, pockets: true, req: { level: 4 }, desc: 'IF THEY DIDN\'T SEE YOU COMING, THEY DO NOW.' },
    { id: 'cp_goggle', name: 'C.P. COMPANY GOGGLE JACKET', cost: 1100, style: 'bomber', color: '#2a3542', trim: '#1e2630', lining: '#2a3542', hood: 'down', req: { level: 2 }, desc: 'THE GOGGLES LIVE IN THE HOOD. ZIP IT UP, NOBODY KNOWS YOU.' },
    { id: 'cp_overshirt', name: 'C.P. COMPANY OVERSHIRT', cost: 800, style: 'overshirt', color: '#3e4a3a', trim: '#2e382c', lining: '#3e4a3a', shirt: '#e8e4dc', pockets: true, desc: 'THE LENS ON THE ARM POCKET. GARMENT DYED.' },
    { id: 'aqua_check', name: 'AQUASCUTUM CLUB CHECK', cost: 950, style: 'harrington', pattern: 'check', color: '#c4aa7c', trim: '#5c4632', lining: '#1e1a18', desc: 'THE CLUB CHECK. A GENTLEMAN\'S JACKET FOR NOT VERY GENTLEMANLY AFTERNOONS.' },
    { id: 'aqua_mac', name: 'AQUASCUTUM MAC', cost: 1000, style: 'parka', color: '#b9a47e', trim: '#8f7c58', lining: '#c4aa7c', req: { level: 5 }, desc: 'A RAINCOAT FOR THE ROYAL ENCLOSURE. WORN IN THE AWAY END.' },
    { id: 'burberry_harrington', name: 'BURBERRY HARRINGTON', cost: 850, style: 'harrington', color: '#1d2742', trim: '#141a2e', lining: '#c8a86a', desc: 'NAVY OUTSIDE, THE CHECK INSIDE. FLASH IT AT THE BAR.' },
    { id: 'burberry_nova', name: 'BURBERRY NOVA CHECK SHIRT', cost: 700, style: 'shirt', pattern: 'check', color: '#d2b88a', trim: '#1e1a18', lining: '#b52a26', desc: 'CAMEL, BLACK AND A RED LINE. THE PUB KNOWS.' },
    { id: 'lacoste_white', name: 'LACOSTE POLO (WHITE)', cost: 400, style: 'polo', color: '#f2f0ea', shirt: '#f2f0ea', trim: '#f2f0ea', desc: 'THE CROCODILE. COLLAR UP.' },
    { id: 'lacoste_bottle', name: 'LACOSTE POLO (BOTTLE)', cost: 400, style: 'polo', color: '#1f4a32', shirt: '#1f4a32', trim: '#1f4a32', desc: 'BOTTLE GREEN, CROCODILE, TUCKED IN. OR NOT.' },
    { id: 'perry_white', name: 'FRED PERRY TWIN TIPPED', cost: 350, style: 'polo', color: '#f2f0ea', shirt: '#f2f0ea', trim: '#141416', desc: 'THE LAUREL WREATH. BLACK TIPPING.' },
    { id: 'perry_burgundy', name: 'FRED PERRY (BURGUNDY)', cost: 350, style: 'polo', color: '#5a1a22', shirt: '#5a1a22', trim: '#e8c860', desc: 'OXBLOOD WITH GOLD TIPPING. VERY 1983.' },
    { id: 'tacchini', name: 'SERGIO TACCHINI DALLAS', cost: 600, style: 'track', color: '#1d2742', trim: '#f4f1e8', desc: 'THE TRACK TOP THAT STARTED IT ALL. FROM A TENNIS SHOP IN MONTE CARLO.' },
    { id: 'fila_bj', name: 'FILA BJ TRACK TOP', cost: 600, style: 'track', color: '#f2f0ea', trim: '#1d2742', desc: 'BORG WORE IT AT WIMBLEDON. YOU WEAR IT ON THE TERRACE.' },
    { id: 'ellesse', name: 'ELLESSE TRACK TOP', cost: 550, style: 'track', color: '#c8102e', trim: '#f2efe6', desc: 'THE HALF BALL. RED AS A PILLAR BOX.' },
    { id: 'adidas_firebird', name: 'ADIDAS FIREBIRD', cost: 450, style: 'track', color: '#151518', trim: '#f2efe6', desc: 'BLACK, THREE WHITE STRIPES. GOES WITH EVERYTHING.' },
    { id: 'lyle_scott', name: 'LYLE & SCOTT JUMPER', cost: 450, style: 'shirt', color: '#e8c95a', trim: '#e8c95a', lining: '#e8c95a', desc: 'PASTEL LAMBSWOOL WITH THE GOLDEN EAGLE.' },
    { id: 'pringle', name: 'PRINGLE DIAMOND JUMPER', cost: 500, style: 'shirt', pattern: 'check', color: '#c9b089', trim: '#7a1e2a', lining: '#1d2742', desc: 'GOLF CLUB KNITWEAR. NOT FOR GOLF.' },
    { id: 'henri_lloyd', name: 'HENRI LLOYD CONSORT', cost: 700, style: 'harrington', color: '#1b2340', trim: '#c8102e', lining: '#e8c860', desc: 'A SAILING JACKET. NOBODY HAS EVER SAILED IN ONE.' },
    { id: 'barbour', name: 'BARBOUR WAX JACKET', cost: 800, style: 'harrington', color: '#3b3d2a', trim: '#5a3a24', lining: '#7a6a4a', pockets: true, req: { level: 2 }, desc: 'WAXED COTTON AND A CORD COLLAR. COUNTRY GENT, CITY CENTRE.' },
    { id: 'paul_shark', name: 'PAUL & SHARK JUMPER', cost: 750, style: 'shirt', color: '#1d2742', trim: '#1d2742', lining: '#1d2742', req: { level: 3 }, desc: 'NAVY, THE SHARK ON THE ARM. YACHT MONEY.' },
  ],
  pants: [
    { id: 'jeans_blue', name: 'TURN-UP JEANS', cost: 0, style: 'jeans', color: '#34507a' },
    { id: 'jeans_bleach', name: 'BLEACHED JEANS', cost: 120, style: 'jeans', color: '#7d97bf' },
    { id: 'jeans_black', name: 'BLACK DENIM', cost: 120, style: 'jeans', color: '#1e1e26' },
    { id: 'trackies', name: 'TRACKIES', cost: 150, style: 'trackies', color: '#22232c', trim: '#e8e8e8' },
    { id: 'cords', name: 'BEIGE CORDS', cost: 200, style: 'cargo', color: '#a68f68', req: { level: 2 } },
    { id: 'cargo', name: 'COMBAT CARGOS', cost: 250, style: 'cargo', color: '#4a4f38', req: { level: 4 } },
    { id: 'shorts', name: 'CUP FINAL SHORTS', cost: 200, style: 'shorts', color: '#f4f1e8', req: { level: 6 }, desc: 'IN NOVEMBER. RESPECT.' },
    { id: 'suit', name: 'SUIT TROUSERS', cost: 300, style: 'suit', color: '#2a2a32', req: { badges: 4 } },
    { id: 'levis_501', name: 'LEVI\'S 501 (STONEWASH)', cost: 250, style: 'jeans', color: '#6d88b0', desc: 'BUTTON FLY. STONEWASHED IN 1986.' },
    { id: 'armani_jeans', name: 'ARMANI JEANS', cost: 400, style: 'jeans', color: '#2a2f45', desc: 'THE EAGLE ON THE BACK POCKET.' },
    { id: 'lois_cords', name: 'LOIS CORDS', cost: 300, style: 'cargo', color: '#7a5a3a', desc: 'JUMBO CORD, THE BULL ON THE BACK. LIVERPOOL 1983.' },
    { id: 'farah', name: 'FARAH HOPSACKS', cost: 300, style: 'suit', color: '#8a7a5a', desc: 'STAY-PRESS SLACKS. YOUR DAD\'S, BUT CASUAL.' },
    { id: 'si_cargo', name: 'STONE ISLAND CARGOS', cost: 600, style: 'cargo', color: '#3e4632', desc: 'POCKETS FOR EVERYTHING. BADGE ON THE THIGH.' },
    { id: 'tacchini_trackies', name: 'SERGIO TACCHINI TRACKIES', cost: 400, style: 'trackies', color: '#1d2742', trim: '#f4f1e8' },
  ],
  shoes: [
    { id: 'white', name: 'WHITE TRAINERS', cost: 0, color: '#f2f2ee', sole: '#b9a27a' },
    { id: 'gum', name: 'GUM-SOLE CLASSICS', cost: 150, color: '#121214', sole: '#c49a5a' },
    { id: 'red', name: 'RED TRAINERS', cost: 180, color: '#c8102e', sole: '#f2f2ee' },
    { id: 'blue', name: 'BLUE SUEDES', cost: 200, color: '#2d5bb3', sole: '#e8e0d0', req: { level: 3 } },
    { id: 'boots', name: 'CHERRY BOOTS', cost: 300, color: '#5a1418', sole: '#d8c060', req: { level: 5 } },
    { id: 'gold', name: 'GOLDEN BOOTS', cost: 1500, color: '#d4af37', sole: '#fff4c0', req: { scarves: 35 } },
    { id: 'samba', name: 'ADIDAS SAMBA', cost: 300, color: '#141416', stripe: '#f2f2ee', sole: '#c49a5a', desc: 'BLACK LEATHER, WHITE STRIPES, GUM SOLE. INDOOR FOOTBALL, OUTDOOR TROUBLE.' },
    { id: 'gazelle_blue', name: 'ADIDAS GAZELLE (BLUE)', cost: 350, color: '#2d4fa0', stripe: '#f2f2ee', sole: '#f2f2ee', desc: 'BLUE SUEDE. GOLD LETTERS ON THE SIDE.' },
    { id: 'gazelle_red', name: 'ADIDAS GAZELLE (RED)', cost: 350, color: '#b0182a', stripe: '#f2f2ee', sole: '#f2f2ee' },
    { id: 'spezial', name: 'ADIDAS SPEZIAL', cost: 400, color: '#33508a', stripe: '#9ec4e8', sole: '#c49a5a', desc: 'HANDBALL SHOES. NOBODY ON A TERRACE HAS PLAYED HANDBALL.' },
    { id: 'munchen', name: 'ADIDAS MUNCHEN', cost: 400, color: '#2a4a8a', stripe: '#f2f2ee', sole: '#c49a5a' },
    { id: 'forest_hills', name: 'ADIDAS FOREST HILLS', cost: 500, color: '#f2f2ee', stripe: '#2d5bb3', sole: '#f2f2ee', desc: 'THE HOLY GRAIL OF 1983. IMPORTED, IF YOU KNOW A MAN.' },
    { id: 'trimm_trab', name: 'ADIDAS TRIMM TRAB', cost: 450, color: '#2a3e70', stripe: '#e8e4d8', sole: '#e8e4d8' },
    { id: 'vic_blues', name: 'ADIDAS (VIC\'S BLUES)', cost: 450, color: '#2d5bb3', stripe: '#f07a1a', sole: '#b5793a', desc: 'BLUE WITH BRIGHT ORANGE STRIPES, GUM SOLE. ASK VIC.' },
    { id: 'kenny_whites', name: 'ADIDAS (KENNY\'S WHITES)', cost: 400, color: '#f4f4f0', stripe: '#141416', sole: '#ecebe6', desc: 'WHITE, BLACK STRIPES. KEPT SPOTLESS, SOMEHOW.' },
    { id: 'al_blacks', name: 'ADIDAS (AL\'S BLACKS)', cost: 400, color: '#18181b', stripe: '#f5c518', sole: '#ece8de', desc: 'BLACK WITH YELLOW STRIPES. SIZE THIRTEEN.' },
    { id: 'diadora', name: 'DIADORA BORG ELITE', cost: 450, color: '#f2f0ea', sole: '#e8e0d0', desc: 'BJORN BORG\'S. MADE IN ITALY.' },
    { id: 'reebok', name: 'REEBOK CLASSIC', cost: 250, color: '#f4f2ec', sole: '#c49a5a' },
    { id: 'nb576', name: 'NEW BALANCE 576', cost: 350, color: '#8a8a90', sole: '#f2f2ee', desc: 'GREY SUEDE. MADE IN ENGLAND.' },
    { id: 'wallabees', name: 'CLARKS WALLABEES', cost: 300, color: '#b9a07a', sole: '#e8d8a8', desc: 'CREPE SOLES AND SUEDE. MANCHESTER, 1989.' },
  ],
  scarf: [
    { id: 'none', name: 'NO SCARF', cost: 0, none: true, desc: 'TRAVELLING INCOGNITO.' },
    { id: 'home', name: 'ANCHORS BAR SCARF', cost: 0, a: '#c8102e', b: '#f4f1e8' },
    { id: 'retro', name: '1986 CUP SCARF', cost: 200, a: '#f4f1e8', b: '#c8102e', req: { level: 2 } },
    { id: 'black', name: 'ULTRAS BLACK', cost: 250, a: '#16161a', b: '#c8102e', req: { level: 4 } },
    { id: 'gold', name: 'CENTENARY SCARF', cost: 600, a: '#d4af37', b: '#c8102e', req: { complete: true }, desc: 'ONLY FOR THOSE WHO SAW THE LAST STAND.' },
    { id: 'aqua_scarf', name: 'AQUASCUTUM SCARF', cost: 400, a: '#c4aa7c', b: '#5c4632', desc: 'CAMEL AND BROWN. THE CLUB CHECK, ROUND YOUR NECK.' },
    { id: 'burberry_scarf', name: 'BURBERRY SCARF', cost: 400, a: '#d2b88a', b: '#1e1a18' },
  ],
  facial: [
    { id: 'stubble', name: 'MATCHDAY STUBBLE', cost: 0, facial: 'stubble' },
    { id: 'none', name: 'CLEAN SHAVEN', cost: 0, facial: 'none' },
    { id: 'tache', name: 'TERRACE TACHE', cost: 150, facial: 'tache' },
    { id: 'beard', name: 'FULL BEARD', cost: 250, facial: 'beard', req: { level: 3 } },
  ],
  extra: [
    { id: 'none', name: 'NOTHING', cost: 0 },
    { id: 'shades', name: 'SHADES', cost: 200, shades: true, desc: 'INDOORS. AT NIGHT. IN THE RAIN.' },
    { id: 'beanie', name: 'BOBBLE BEANIE', cost: 200, hat: { style: 'beanie', color: '#c8102e', trim: '#f4f1e8' } },
    { id: 'cap', name: 'CHECK CAP', cost: 250, hat: { style: 'cap', color: '#b5a98a' }, req: { level: 2 } },
    { id: 'capshades', name: 'CAP AND SHADES', cost: 400, hat: { style: 'cap', color: '#1e1e26' }, shades: true, req: { level: 4 } },
    { id: 'bucket', name: 'BUCKET HAT', cost: 300, hat: { style: 'bucket', color: '#d8d0b8' }, req: { level: 6 } },
    { id: 'helmet', name: 'NICKED RIOT HELMET', cost: 700, hat: { style: 'helmet', color: '#20242c' }, req: { score: 100000 }, desc: 'SCORE 100000 IN ONE RUN.' },
    { id: 'tache', name: 'TERRACE TACHE (OLD)', cost: 150, facial: 'tache', hidden: true },
    { id: 'burberry_cap', name: 'BURBERRY CHECK CAP', cost: 450, hat: { style: 'cap', color: '#c8a86a' }, desc: 'THE NOVA CHECK. PEAK DOWN.' },
    { id: 'si_beanie', name: 'STONE ISLAND BEANIE', cost: 350, hat: { style: 'beanie', color: '#1d2742', trim: '#1d2742' }, desc: 'NAVY, RIBBED, THE BADGE ON THE TURN-UP.' },
    { id: 'lacoste_cap', name: 'LACOSTE CAP', cost: 300, hat: { style: 'cap', color: '#f2f0ea' } },
    { id: 'kangol_bucket', name: 'KANGOL BUCKET HAT', cost: 300, hat: { style: 'bucket', color: '#e0d6bc' }, desc: 'THE KANGAROO. MADCHESTER, 1990.' },
    { id: 'armani_shades', name: 'ARMANI SHADES', cost: 400, shades: true, desc: 'EMPORIO. FROM A MARKET STALL IN RIMINI.' },
  ],
  kit: [
    { id: 'none', name: 'MIX AND MATCH', cost: 0, sets: {}, desc: 'PICK EACH PIECE YOURSELF.' },
    { id: 'perry_boy', name: 'THE PERRY BOY (1982)', sets: { jacket: 'perry_white', pants: 'levis_501', shoes: 'samba', hair: 'mod', extra: 'none', scarf: 'none' }, desc: 'FRED PERRY, 501S, SAMBAS AND A WEDGE THAT HIDES ONE EYE.' },
    { id: 'scally', name: 'THE SCALLY (1984)', sets: { jacket: 'ellesse', pants: 'lois_cords', shoes: 'forest_hills', hair: 'curtains', extra: 'none', scarf: 'none' }, desc: 'BACK FROM EUROPE WITH A BAG OF SPORTSWEAR NOBODY PAID FOR.' },
    { id: 'tacchini_lad', name: 'THE TACCHINI LAD', sets: { jacket: 'tacchini', pants: 'tacchini_trackies', shoes: 'diadora', extra: 'none', scarf: 'none' }, desc: 'HEAD TO TOE IN MONTE CARLO TENNIS GEAR.' },
    { id: 'si_casual', name: 'STONE ISLAND CASUAL', sets: { jacket: 'si_overshirt', pants: 'levis_501', shoes: 'spezial', extra: 'si_beanie', scarf: 'none' }, desc: 'THE BADGE, THE BEANIE, THE SPEZIALS. NOTHING ELSE TO SAY.' },
    { id: 'nineties', name: 'TERRACE 1996', sets: { jacket: 'cp_goggle', pants: 'si_cargo', shoes: 'gazelle_blue', extra: 'burberry_cap', scarf: 'none' }, desc: 'GOGGLE JACKET, CARGOS AND THE CHECK CAP. EURO 96, ALL SUMMER.' },
    { id: 'gent', name: 'THE AQUASCUTUM GENT', sets: { jacket: 'aqua_check', pants: 'armani_jeans', shoes: 'wallabees', extra: 'armani_shades', scarf: 'aqua_scarf' }, desc: 'CLUB CHECK, ARMANI AND A NICE PAIR OF SHADES. LOOKS LIKE MONEY.' },
    { id: 'old_school', name: 'OLD SCHOOL', sets: { jacket: 'harrington_green', pants: 'jeans_blue', shoes: 'boots', hair: 'skinhead', extra: 'none', scarf: 'none' }, desc: 'HARRINGTON, TURN-UPS, CHERRY BOOTS. 1979 NEVER ENDED.' },
  ],
  gloves: [
    { id: 'none', name: 'BARE KNUCKLES', cost: 0, gloves: null },
    { id: 'black', name: 'BLACK LEATHER GLOVES', cost: 200, gloves: '#18161a', req: { level: 2 } },
    { id: 'driving', name: 'DRIVING GLOVES', cost: 250, gloves: '#7a4a28', req: { level: 5 } },
    { id: 'red', name: 'CLUB RED MITTS', cost: 300, gloves: '#c8102e', req: { scarves: 20 } },
  ],
};

export const CATEGORY_NAMES = { kit: 'KITS', hair: 'HAIR', hairColor: 'HAIR COLOUR', jacket: 'JACKET', pants: 'TROUSERS', shoes: 'SHOES', scarf: 'SCARF', facial: 'FACE', extra: 'HEADGEAR', gloves: 'GLOVES' };
export const CATEGORY_ORDER = ['kit', 'jacket', 'pants', 'shoes', 'scarf', 'hair', 'hairColor', 'facial', 'extra', 'gloves'];

export function findOption(cat, id) {
  const list = WARDROBE[cat] || [];
  return list.find(o => o.id === id) || list[0];
}

export function buildLook(outfit = {}) {
  const hair = findOption('hair', outfit.hair);
  const hc = findOption('hairColor', outfit.hairColor);
  const j = findOption('jacket', outfit.jacket);
  const p = findOption('pants', outfit.pants);
  const sh = findOption('shoes', outfit.shoes);
  const sc = findOption('scarf', outfit.scarf);
  const ex = findOption('extra', outfit.extra);
  const fa = findOption('facial', outfit.facial);
  const gl = findOption('gloves', outfit.gloves);
  return {
    skin: '#e2a97a',
    hair: { style: hair.style, color: hc.color },
    jacket: { style: j.style, color: j.color, trim: j.trim, lining: j.lining, pockets: !!j.pockets, pattern: j.pattern || undefined, hood: j.hood || undefined },
    badge: j.badge ? { base: '#141416', mark: '#c8d43a' } : null,
    shirt: j.shirt || '#e8e4dc',
    pants: { style: p.style, color: p.color, trim: p.trim },
    shoes: { color: sh.color, sole: sh.sole, stripe: sh.stripe || undefined },
    scarf: sc.none ? null : { a: sc.a, b: sc.b },
    shades: !!ex.shades,
    hat: ex.hat || null,
    facial: ex.facial || (fa && fa.facial) || 'stubble',
    gloves: (gl && gl.gloves) || null,
    build: 1.05,
    height: 1,
  };
}

function totals(data) {
  const scarves = Object.values(data.scarves || {}).reduce((s, a) => s + (a ? a.length : 0), 0);
  const badges = Object.keys(data.badges || {}).filter(k => data.badges[k]).length;
  const secrets = Object.values(data.secrets || {}).reduce((s, a) => s + (a ? a.length : 0), 0);
  return { scarves, badges, secrets };
}

// Is an option unlocked given the save data? Returns { ok, reason }.
export function isUnlocked(opt, data) {
  if (UNLOCK_ALL) return { ok: true };
  const r = opt.req;
  if (!r) return { ok: true };
  const T = totals(data);
  if (r.level && (data.unlocked || 1) < r.level) return { ok: false, reason: `REACH LEVEL ${r.level}` };
  if (r.scarves && T.scarves < r.scarves) return { ok: false, reason: `${r.scarves} SCARVES (${T.scarves})` };
  if (r.badges && T.badges < r.badges) return { ok: false, reason: `${r.badges} BADGES (${T.badges})` };
  if (r.badge && !(data.badges || {})[r.badge]) return { ok: false, reason: 'FIND THE BADGE' };
  if (r.secrets && T.secrets < r.secrets) return { ok: false, reason: `${r.secrets} SECRETS (${T.secrets})` };
  if (r.kos && ((data.totals && data.totals.kos) || 0) < r.kos) return { ok: false, reason: `${r.kos} KNOCKOUTS (${(data.totals && data.totals.kos) || 0})` };
  if (r.score && (data.highScore || 0) < r.score) return { ok: false, reason: `SCORE ${r.score}` };
  if (r.complete && !data.completed) return { ok: false, reason: 'FINISH THE GAME' };
  return { ok: true };
}

export function isOwned(cat, opt, data) {
  if (UNLOCK_ALL) return true;
  if (opt.sets) return kitParts(opt).every(([c, o]) => isOwned(c, o, data));
  return opt.cost === 0 || (data.owned || []).includes(cat + ':' + opt.id);
}

// a kit's pieces: [[category, option], ...]; its price is what you don't own yet
export function kitParts(kit) { return Object.entries(kit.sets || {}).map(([c, id]) => [c, findOption(c, id)]); }
export function kitCost(kit, data) { return kitParts(kit).reduce((s, [c, o]) => s + (isOwned(c, o, data) ? 0 : o.cost || 0), 0); }

export function progressTotals(data) { return totals(data); }
