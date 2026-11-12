// Wardrobe: unlockable cosmetics for THE LAST HOOLIGAN.
// Each category is a list of options:
//   { id, name, cost (cash, 0 = free), desc?, req: null | { level:n } | { scarves:n } | { badge:'levelId' } | { badges:n }
//     | { secrets:n } | { kos:n } | { score:n } | { complete:true }, ...data }
// buildLook(outfit) turns the saved outfit ids into a doll look (see doll.js LOOK FORMAT).

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
  ],
  shoes: [
    { id: 'white', name: 'WHITE TRAINERS', cost: 0, color: '#f2f2ee', sole: '#b9a27a' },
    { id: 'gum', name: 'GUM-SOLE CLASSICS', cost: 150, color: '#121214', sole: '#c49a5a' },
    { id: 'red', name: 'RED TRAINERS', cost: 180, color: '#c8102e', sole: '#f2f2ee' },
    { id: 'blue', name: 'BLUE SUEDES', cost: 200, color: '#2d5bb3', sole: '#e8e0d0', req: { level: 3 } },
    { id: 'boots', name: 'CHERRY BOOTS', cost: 300, color: '#5a1418', sole: '#d8c060', req: { level: 5 } },
    { id: 'gold', name: 'GOLDEN BOOTS', cost: 1500, color: '#d4af37', sole: '#fff4c0', req: { scarves: 35 } },
  ],
  scarf: [
    { id: 'home', name: 'ANCHORS BAR SCARF', cost: 0, a: '#c8102e', b: '#f4f1e8' },
    { id: 'retro', name: '1986 CUP SCARF', cost: 200, a: '#f4f1e8', b: '#c8102e', req: { level: 2 } },
    { id: 'black', name: 'ULTRAS BLACK', cost: 250, a: '#16161a', b: '#c8102e', req: { level: 4 } },
    { id: 'gold', name: 'CENTENARY SCARF', cost: 600, a: '#d4af37', b: '#c8102e', req: { complete: true }, desc: 'ONLY FOR THOSE WHO SAW THE LAST STAND.' },
    { id: 'none', name: 'NO SCARF', cost: 0, none: true, desc: 'TRAVELLING INCOGNITO.' },
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
  ],
  gloves: [
    { id: 'none', name: 'BARE KNUCKLES', cost: 0, gloves: null },
    { id: 'black', name: 'BLACK LEATHER GLOVES', cost: 200, gloves: '#18161a', req: { level: 2 } },
    { id: 'driving', name: 'DRIVING GLOVES', cost: 250, gloves: '#7a4a28', req: { level: 5 } },
    { id: 'red', name: 'CLUB RED MITTS', cost: 300, gloves: '#c8102e', req: { scarves: 20 } },
  ],
};

export const CATEGORY_NAMES = { hair: 'HAIR', hairColor: 'HAIR COLOUR', jacket: 'JACKET', pants: 'TROUSERS', shoes: 'SHOES', scarf: 'SCARF', facial: 'FACE', extra: 'HEADGEAR', gloves: 'GLOVES' };
export const CATEGORY_ORDER = ['jacket', 'pants', 'shoes', 'scarf', 'hair', 'hairColor', 'facial', 'extra', 'gloves'];

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
    jacket: { style: j.style, color: j.color, trim: j.trim, lining: j.lining },
    shirt: j.shirt || '#e8e4dc',
    pants: { style: p.style, color: p.color, trim: p.trim },
    shoes: { color: sh.color, sole: sh.sole },
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
  return opt.cost === 0 || (data.owned || []).includes(cat + ':' + opt.id);
}

export function progressTotals(data) { return totals(data); }
