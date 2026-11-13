// Persistent save (localStorage). save.data is the live object; call save.write() after changes.
// New fields must get defaults in defaultSave(): load() deep-merges stored data over the defaults,
// so older saves pick up anything added later.
const KEY = 'theLastHooligan.save.v1';

// Owner's switch: every level (story + tour), every wardrobe item. false = earn them as designed.
export const UNLOCK_ALL = true;

// Arcade "hall of fame" seed table (fictional terrace legends).
export const DEFAULT_HISCORES = [
  { name: 'TEL', score: 60000, level: 8 },
  { name: 'BAZ', score: 50000, level: 7 },
  { name: 'KEV', score: 40000, level: 6 },
  { name: 'MOZ', score: 30000, level: 5 },
  { name: 'GAZ', score: 25000, level: 4 },
  { name: 'STU', score: 20000, level: 3 },
  { name: 'DAZ', score: 15000, level: 3 },
  { name: 'LEE', score: 10000, level: 2 },
  { name: 'SID', score: 5000, level: 1 },
  { name: 'ROY', score: 2500, level: 1 },
];

export function defaultSave() {
  return {
    version: 7,                  // 2: 3D renderer became the default; 3: Terrace Tina replaced by Kenny Showtime; 4: Big Al joins; 5: Big Al max TOUGH; 6: no scarves on the lads; 7: Kenny Showtime is the default lad
    unlocked: 1,                 // number of levels unlocked (1..8)
    character: 'kenny',          // last selected playable character (content/characters.js); Kenny Showtime by default
    best: {},                    // levelId -> best score
    highScore: 0,
    cash: 0,                     // spendable currency (wardrobe)
    scarves: {},                 // levelId -> [indices collected]
    badges: {},                  // levelId -> true
    secrets: {},                 // levelId -> [secret ids]
    owned: [],                   // wardrobe item ids bought/unlocked (defaults are implicit)
    outfit: { hair: 'crop', hairColor: 'brown', jacket: 'harrington_green', pants: 'jeans_blue', shoes: 'white', scarf: 'none', extra: 'none', facial: 'stubble', gloves: 'none' },
    settings: {
      music: 0.6, sfx: 0.8, shake: true, difficulty: 'normal',
      controls: 'screen',        // 'screen' (up = up the screen) | 'iso' (up = along the iso axis); read by player.js
      minimap: true,             // HUD minimap
      scanlines: false,          // CRT scanline overlay
      hints: true,               // on-screen button hints
      firm: true,                // your lads come along (game/firm.js); false = lone wolf
      firmSize: 3,               // lads in the firm (1..4)
      renderer: '3d',            // '3d' (Three.js renderer, default) | '2d' (pixel-art canvas); ?renderer= overrides
    },
    run: null,                   // snapshot to continue from (GameState.snapshot())
    completed: false,
    hiscores: DEFAULT_HISCORES.map(h => ({ ...h })),
    lastInitials: 'AAA',
    totals: { kos: 0, playTime: 0, games: 0, deaths: 0, cashEarned: 0, bestCombo: 0 },
    firm: null,                  // the persistent firm (game/firmdata.js), created on first use
    seenNew: [],                 // wardrobe ids the player has already seen as unlocked ("NEW!" tag)
  };
}

// v3: Terrace Tina left the firm, Kenny Showtime took her place (same slot, his stats, look and moves)
function migrateTina(d) {
  if (d.character === 'tina') d.character = 'kenny';
  const F = d.firm;
  if (!F || !Array.isArray(F.lads)) return;
  for (const l of F.lads) {
    if (l.char !== 'tina') continue;
    Object.assign(l, { char: 'kenny', name: 'KENNY SHOWTIME', nick: 'ULTRAVIOLENCE', look: null,
      stats: { fists: 8, kicks: 4, tough: 7, speed: 5, nerve: 8, loyalty: 5 }, traits: ['liability'] });
  }
}

function merge(def, obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj ?? def;
  const out = { ...def };
  for (const k of Object.keys(obj)) {
    out[k] = def && typeof def[k] === 'object' && def[k] !== null && !Array.isArray(def[k]) ? merge(def[k], obj[k]) : obj[k];
  }
  return out;
}

export const save = {
  data: defaultSave(),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaultSave(), JSON.parse(raw));
      // v1 saves stored renderer '2d' because that was the default: switch them to 3D once (OPTIONS > GRAPHICS can go back)
      if ((this.data.version || 1) < 2) { this.data.settings.renderer = '3d'; this.data.version = 2; }
      if (this.data.version < 3) { migrateTina(this.data); this.data.version = 3; }
      if (this.data.version < 4) { this.data.addBigAl = true; this.data.version = 4; }   // firmdata.getFirm adds him to an existing firm
      if (this.data.version < 5) {                // Big Al became the hardest man in the firm: TOUGH 10 for the one already in it
        for (const l of (this.data.firm && this.data.firm.lads) || []) if (l.char === 'bigal' && l.stats) l.stats.tough = 10;
        this.data.version = 5;
      }
      if (this.data.version < 6) {                // the lads lost their scarves: your outfit and every lad in the firm
        if (this.data.outfit && this.data.outfit.scarf === 'home') this.data.outfit.scarf = 'none';
        const F = this.data.firm;
        for (const l of [...((F && F.lads) || []), ...((F && F.pool) || [])]) if (l && l.look) l.look.scarf = null;
        this.data.version = 6;
      }
      if (this.data.version < 7) { this.data.character = 'kenny'; this.data.version = 7; }   // Kenny Showtime is the default lad
      if (UNLOCK_ALL) this.data.unlocked = Math.max(this.data.unlocked || 1, 99);   // clamped to the level count where shown
    } catch (e) { console.warn('save load failed', e); }
    if (!Array.isArray(this.data.hiscores) || !this.data.hiscores.length) this.data.hiscores = DEFAULT_HISCORES.map(h => ({ ...h }));
    return this.data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* storage unavailable */ }
  },
  reset() { this.data = defaultSave(); this.write(); },

  // ---- hall of fame helpers
  topScore() { const t = this.data.hiscores || []; return Math.max(this.data.highScore || 0, t.length ? t[0].score : 0); },
  qualifies(score) {
    const t = this.data.hiscores || [];
    return score > 0 && (t.length < 10 || score > t[t.length - 1].score);
  },
  addHiscore(name, score, level) {
    const t = (this.data.hiscores ||= []);
    const e = { name: String(name || 'AAA').slice(0, 3), score: Math.floor(score), level };
    t.push(e);
    t.sort((a, b) => b.score - a.score);
    t.length = Math.min(t.length, 10);
    this.data.highScore = Math.max(this.data.highScore || 0, Math.floor(score));
    this.write();
    return t.indexOf(e);
  },
};
