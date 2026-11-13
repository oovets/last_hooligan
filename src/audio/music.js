// THE LAST HOOLIGAN — soundtrack, crowd, chants and ambience (all synthesized, all original).
// Installs into the audio engine (src/audio/audio.js):
//   audio.songPlayer = (engine, trackId) => ({ stop(), setBoss(on) })
//   audio.crowdHook = (engine, level) => {...};  audio.chantHook = (engine) => {...}
//   audio.customSfx = { name: (engine, t, {pan, vol, pitch}) => {...} }   (engine.registerSfx(name, fn) also works)
//   audio.crowdReact(kind, vol), audio.crowdFx.{cheer,boo,ooh}(t, vol), audio.ambienceHook(engine, kind)
//
// SEQUENCER
//   Songs are data: sections (bars of 16 sixteenth-steps) with a chord list and layers
//   (drums groove, bass pattern, lead melody, arp, pad, stabs, distorted power-chord guitar).
//   A lookahead scheduler (driven by the engine's worker clock) queues notes ~140 ms ahead,
//   skips missed steps when the tab was throttled, and switches to the BOSS arrangement on the
//   next bar (with a riser into it). Each song player owns its channel strip and tears it down on stop.
//
// PATTERN NOTATION
//   chords : 'Am F G E'   one chord per bar; 'C,G' splits the bar in halves.
//   lead   : note tokens per step at `leadRate` (8 = eighth notes): 'A4 - C5 . ~D5'
//            '-' tie, '.' rest, '~' glide from previous note, '|' ignored (bar marker for readability)
//   bass   : one char per 16th, relative to the chord: R root, F fifth, O octave, T third, S flat 7,
//            L fifth below, N 9th(2), X 6th, Q 4th, U octave+5th; lowercase = short/soft; '-' tie; '.' rest
//   gtr/stab: one char per 16th: O ring (until next hit), X accented short, x short/palm-muted, '.' nothing
//   drums  : lanes k kick, s snare, c clap, h closed hat, o open hat, r ride, x crash, t/m/f toms,
//            p metal clank, b terrace boom, q rim, z shaker. 'X' accent, 'x' normal, 'o' ghost.
import { audio, VOWELS } from './audio.js';

const R = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToMidi(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  return PCS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
}

const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], m9: [0, 3, 7, 10, 14],
};
const chordCache = {};
function parseChord(name) {
  if (chordCache[name]) return chordCache[name];
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!m) return (chordCache[name] = { pc: 0, iv: QUAL[''] });
  const pc = (PCS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return (chordCache[name] = { pc, iv: QUAL[m[3]] || QUAL[''] });
}
// place chord tones at/above `lo`
function voicing(ch, lo, span = 14) {
  const r = lo + (((ch.pc - lo) % 12) + 12) % 12;
  const out = ch.iv.map(i => { let n = r + i; while (n > lo + span) n -= 12; return n; });
  return [...new Set(out)].sort((a, b) => a - b);
}

// ===================================================================== pattern libraries
const DRUMS = {
  none: {},
  hatsIntro: { k: 'X.......X.......', h: 'x.x.x.x.x.x.x.x.' },
  punk: { k: 'X...x.x.X...x...', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
  rock: { k: 'X.....x.X.x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
  skank: { k: 'X...x...X...x...', s: '..x...x...x...X.', h: 'x.x.x.x.x.x.x.x.' },
  dbeat: { k: 'X.x...x.X.x...x.', s: '....X.......X...', o: 'x.x.x.x.x.x.x.x.' },
  halftime: { k: 'X.......x.x.....', s: '........X.......', h: 'x.x.x.x.x.x.x.x.' },
  halftimeBig: { k: 'X.......x.x.....', s: '........X.......', c: '........x.......', h: 'x.x.x.x.x.x.x.x.', b: 'X...............' },
  anthem: { k: 'X...X...X...X...', s: '....X.......X...', c: '....x.......x...', o: '..x...x...x...x.' },
  terrace: { k: 'X...x.x.X...x.x.', c: '....X.......X...', b: 'X.......X.......', h: '..o...o...o...o.' },
  stompSoft: { k: 'X.......X.......', c: '....x.......x...' },
  house: { k: 'X...X...X...X...', c: '....X.......X...', h: 'o.o.o.o.o.o.o.o.', o: '..x...x...x...x.', z: '.o.o.o.o.o.o.o.o' },
  houseIntro: { k: 'X...X...X...X...', o: '..x...x...x...x.' },
  raveBreak: { k: 'X...X...X...X...', s: '....X..o.o..X..o', h: 'x.xxx.xxx.xxx.xx', o: '..x...x...x...x.' },
  breakbeat: { k: 'X.x.......X.....X.........x.x...', s: '....X..o.o..X..o....X..o....X...', h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
  ebmIntro: { k: 'X...X...X...X...', p: '..x.......x..x..' },
  ebm: { k: 'X...X...X...X...', s: '....X.......X...', p: '..x..x....x..x.x', h: 'x.x.x.x.x.x.x.x.' },
  ebm2: { k: 'X...X...X...X...', c: '....X.......X...', s: '....x.......x..o', p: '..x..x....x..x.x', h: 'xoxoxoxoxoxoxoxo' },
  industrial: { k: 'X.x.X...X.x.X...', s: '....X.......X...', p: 'x..xx.x..x.xx..x', h: 'x.x.x.x.x.x.x.x.' },
  factoryIntro: { k: 'X.......X.......', p: 'x..x..x.x..x..x.' },
  march: { k: 'X.......X.......', f: 'X..x..x.X..x..x.', s: 'o.o.o.o.o.o.o.oo', t: '............x.x.' },
  dnb: { k: 'X.........X.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', z: 'oooooooooooooooo' },
  dnb2: { k: 'X.........X.X...', s: '....X..o....X..o', h: 'x.x.x.x.x.x.x.x.', r: 'x...x...x...x...' },
  soft: { k: 'X.......X.......', z: '..x...x...x...x.' },
  heartbeat: { k: 'X..o............' },
  sting: { k: 'X...............', b: 'X...............', x: 'X...............' },
  build: { k: 'X...X...X...X...', s: 'x...x...x.x.xxxx' },
  shuffleIntro: { k: 'X.......X.......', h: 'x.x.x.x.x.x.x.x.' },
  shuffle: { k: 'X.....x.X.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', q: '..........o.....' },
  fill: { k: 'X.......X.......', s: '....X...x.xxXxXX', h: 'x.x.x.x.........' },
  fillT: { k: 'X.......X.......', s: '....X...........', t: '........X.x.....', m: '..........X.x...', f: '............X.X.', h: 'x.x.x.x.........' },
  roll: { k: 'X...X...X...X...', s: 'x.x.x.x.xxxxXXXX' },
  riserBuild: { k: 'X.......X.......', s: '........x...x.x.', z: 'xxxxxxxxxxxxxxxx' },
  jingle: {
    k: 'X.......X.......X...X...X.x.X...X...............',
    s: 'x.x.x.x.xxxxXXXX....X.......X...................',
    x: '................X...............X...............',
    b: '................................X...............',
  },
};

const BASS = {
  drive8: 'R.R.R.R.R.R.R.R.',
  drive8o: 'R.R.R.O.R.R.F.O.',
  roll16: 'RrrrRrrrRrrrRrrr',
  gallop: 'R.rrR.rrR.rrR.rr',
  punk: 'R.R.R.R.F.F.R.R.',
  house: '..R...R...R...R.',
  oct: 'R.O.R.O.R.O.R.O.',
  walk: 'R.T.F.X.O.X.F.T.',
  stomp: 'R.......R...F...',
  stomp8: 'R...R.R.R...R.R.',
  acid: 'R.rO.rRS.R.Or.RN',
  ebm: 'R.rrR.rrR.rrO.rr',
  hold: 'R---------------',
  half: 'R-------R-------',
  dnb: 'R-------..R-----',
  push: 'R.....R.....R.O.',
};

const GTR = {
  hold: 'O...............',
  half: 'O.......O.......',
  chug8: 'X.x.x.x.X.x.x.x.',
  chug16: 'Xxxxxxxxxxxxxxxx',
  punk8: 'O.......x.x.x.x.',
  gallop: 'X.xxX.xxX.xxX.xx',
  push: 'O.....O.....O...',
  off8: '..X...X...X...X.',
};

const STAB = {
  skank: '..x...x...x...x.',
  rave: 'X..X..X...X..X..',
  rave2: 'X..X..X.X..X..X.',
  hold: 'O...............',
  quarter: 'x...x...x...x...',
  push: 'X.....X.....X...',
};

const ARPS = {
  up16: { rate: 16, mode: 'up', lo: 64, span: 2 },
  updown16: { rate: 16, mode: 'updown', lo: 64, span: 2 },
  down16: { rate: 16, mode: 'down', lo: 62, span: 2 },
  rand16: { rate: 16, mode: 'rand', lo: 60, span: 2 },
  up8: { rate: 8, mode: 'up', lo: 67, span: 2 },
  updown8: { rate: 8, mode: 'updown', lo: 64, span: 2 },
  low16: { rate: 16, mode: 'up', lo: 57, span: 1 },
};

// ===================================================================== songs (all original)
// bar markers '|' are only for readability
const SONGS = {
  // ---------------------------------------------------------------- TITLE: anthemic synth + terrace stomp
  title: {
    bpm: 116, gain: 1.05, inst: { bass: 'saw', lead: 'pulse', arp: 'bell', pad: 'saw', lead2: 'saw' },
    sections: {
      intro: { bars: 4, chords: 'Em C G D', drums: 'stompSoft', pad: 1, arp: 'updown8', crash: false },
      A: {
        bars: 8, chords: 'Em C G D Em C Am B', drums: 'terrace', fill: 'fill', bass: 'stomp8', pad: 1, arp: 'up8',
        lead: 'B4 - - B4 A4 - G4 - | G4 - E4 - - - D4 E4 | G4 - - A4 B4 - D5 - | A4 - - - F#4 - - - | B4 - - B4 A4 - G4 - | E5 - - D5 C5 - B4 - | A4 - B4 - C5 - B4 A4 | B4 - - - D#5 - - -',
      },
      B: {
        bars: 8, chords: 'G D Em C G D C D', drums: 'anthem', fill: 'fillT', bass: 'drive8', gtr: 'half', pad: 1, arp: 'up16',
        lead: 'D5 - - - B4 - D5 - | E5 - D5 - A4 - - - | G5 - - F#5 E5 - D5 - | E5 - - - - - . . | D5 - - - B4 - D5 - | F#5 - E5 - D5 - A4 - | C5 - D5 - E5 - G5 - | F#5 - - - - - - .',
        lead2: 'B4 - - - G4 - B4 - | A4 - - - F#4 - - - | B4 - - - G4 - - - | G4 - - - - - . . | B4 - - - G4 - B4 - | A4 - - - F#4 - - - | E4 - - - G4 - C5 - | A4 - - - - - - .',
      },
      C: { bars: 4, chords: 'C D Em Em', drums: 'build', bass: 'half', pad: 1, arp: 'up16', riser: true },
    },
    order: ['intro', 'A', 'B', 'A', 'B', 'C'], loopFrom: 1,
  },

  // ---------------------------------------------------------------- L1 STREETS: driving synth-punk, A minor
  streets: {
    bpm: 132, inst: { bass: 'pick', lead: 'pulse', arp: 'pluck', pad: 'saw' },
    sections: {
      intro: { bars: 4, chords: 'Am Am F G', drums: 'hatsIntro', fill: 'fill', bass: 'drive8', arp: 'up16', crash: false },
      A: {
        bars: 8, chords: 'Am Am F G Am Am F E', drums: 'punk', fill: 'fill', bass: 'drive8o', arp: 'up16',
        lead: 'A4 - C5 - E5 - D5 C5 | D5 - C5 - A4 - - - | C5 - A4 - F4 - G4 A4 | B4 - - - G4 - - - | A4 - C5 - E5 - G5 - | F5 - E5 - D5 - C5 - | D5 - - C5 A4 - C5 - | B4 - - - G#4 - - -',
      },
      B: {
        bars: 8, chords: 'F G Am Am F G E E', drums: 'rock', fill: 'fillT', bass: 'drive8', gtr: 'punk8', pad: 1,
        lead: 'A5 - - - G5 - F5 - | G5 - - - D5 - - - | E5 - - - - - A5 - | G5 - E5 - C5 - D5 - | A5 - - - G5 - F5 - | D6 - - - B5 - G5 - | G#5 - - - - - E5 - | B5 - - - - - . .',
      },
      brk: { bars: 4, chords: 'Am F G E', drums: 'halftime', fill: 'roll', bass: 'half', pad: 1, arp: 'up16', riser: true },
    },
    order: ['intro', 'A', 'B', 'brk', 'A', 'B'], loopFrom: 1,
    boss: {
      bpm: 156, inst: { lead: 'saw', bass: 'saw' },
      sections: {
        X: {
          bars: 8, chords: 'Am Am F G Am Am F E', drums: 'skank', fill: 'fill', bass: 'drive8', gtr: 'chug8', arp: 'up16', leadRate: 16,
          lead: 'A4 . A4 C5 . A4 D5 . A4 E5 . D5 C5 . B4 G4 | A4 . A4 C5 . A4 D5 . E5 . G5 . E5 D5 C5 B4',
        },
        Y: {
          bars: 8, chords: 'F G Am Am F G E E', drums: 'dbeat', fill: 'fillT', bass: 'drive8', gtr: 'gallop', pad: 1, inst: { lead: 'gtr' },
          lead: 'A5 - - - G5 - F5 - | G5 - - - D5 - - - | E5 - - - - - A5 - | G5 - E5 - C5 - D5 - | A5 - - - G5 - F5 - | D6 - - - B5 - G5 - | G#5 - - - - - E5 - | B5 - - - - - . .',
        },
        Z: { bars: 4, chords: 'Am F G E', drums: 'halftime', fill: 'roll', bass: 'half', gtr: 'hold', arp: 'up16', riser: true },
      },
      order: ['X', 'Y', 'X', 'Z'],
    },
  },

  // ---------------------------------------------------------------- L2 PUB: bar-room shuffle, D mixolydian
  pub: {
    bpm: 112, swing8: 0.3, inst: { bass: 'pick', lead: 'whistle', stab: 'organ', pad: 'organ' },
    sections: {
      intro: { bars: 2, chords: 'D C', drums: 'shuffleIntro', bass: 'walk', stab: 'skank', crash: false },
      A: {
        bars: 8, chords: 'D C G D D C G D', drums: 'shuffle', fill: 'fill', bass: 'walk', stab: 'skank',
        lead: 'F#4 - A4 - D5 - A4 - | G4 - E4 - C5 - - - | B4 - A4 G4 - - D4 - | F#4 - - - . . . . | A4 - A4 B4 C5 - A4 - | G4 - E4 G4 - - E4 - | D4 - G4 - B4 - A4 - | D5 - - - . . . .',
      },
      B: {
        bars: 8, chords: 'G C D D G C A A', drums: 'shuffle', fill: 'fillT', bass: 'walk', stab: 'skank', pad: 1, inst: { lead: 'square' },
        lead: 'B4 - B4 - C5 - D5 - | E5 - D5 - C5 - - - | A4 - - - F#4 - A4 - | D5 - - - - - . . | B4 - B4 - C5 - D5 - | E5 - G5 - E5 - C5 - | C#5 - - - E5 - - - | A4 - - - . . . .',
      },
    },
    order: ['intro', 'A', 'B', 'A'], loopFrom: 1,
    boss: {
      bpm: 134, swing8: 0, inst: { lead: 'gtr', bass: 'pick' },
      sections: {
        X: {
          bars: 8, chords: 'D C G D D C G D', drums: 'punk', fill: 'fill', bass: 'drive8', gtr: 'punk8', stab: 'skank', leadOct: 1,
          lead: 'F#4 - A4 - D5 - A4 - | G4 - E4 - C5 - - - | B4 - A4 G4 - - D4 - | F#4 - - - . . . . | A4 - A4 B4 C5 - A4 - | G4 - E4 G4 - - E4 - | D4 - G4 - B4 - A4 - | D5 - - - . . . .',
        },
        Y: {
          bars: 8, chords: 'G C D D G C A A', drums: 'skank', fill: 'fillT', bass: 'drive8', gtr: 'chug8', stab: 'skank',
          lead: 'B5 - B5 - C6 - D6 - | E6 - D6 - C6 - - - | A5 - - - F#5 - A5 - | D6 - - - - - . . | B5 - B5 - C6 - D6 - | E6 - G6 - E6 - C6 - | C#6 - - - E6 - - - | A5 - - - . . . .',
        },
      },
      order: ['X', 'Y'],
    },
  },

  // ---------------------------------------------------------------- L3 UNDERGROUND: dark EBM, F minor
  underground: {
    bpm: 120, inst: { bass: 'acid', lead: 'pulse', arp: 'square', pad: 'saw', stab: 'rave' }, padCut: 1200,
    sections: {
      intro: { bars: 4, chords: 'Fm Fm Db C', drums: 'ebmIntro', bass: 'ebm', pad: 1, crash: false },
      A: {
        bars: 8, chords: 'Fm Fm Db C Fm Fm Eb C', drums: 'ebm', fill: 'fill', bass: 'ebm', arp: 'low16', pad: 1,
        lead: 'C5 - - - - - Ab4 - | G4 - - - F4 - - - | Ab4 - - - Bb4 - C5 - | G4 - - - E4 - - - | C5 - - - - - Eb5 - | Db5 - - - C5 - Ab4 - | Bb4 - - - G4 - Eb5 - | E5 - - - - - . .',
      },
      B: {
        bars: 8, chords: 'Db Eb Fm Fm Db Eb C C', drums: 'ebm2', fill: 'fillT', bass: 'ebm', stab: 'quarter', arp: 'updown16',
        lead: 'F5 - - - Eb5 - - - | G5 - - - Bb4 - - - | C5 - - - Ab5 - - - | G5 - F5 - Eb5 - C5 - | F5 - - - Ab5 - - - | G5 - - - Eb5 - - - | E5 - - - G5 - - - | C6 - - - - - . .',
      },
    },
    order: ['intro', 'A', 'B', 'A'], loopFrom: 1,
    boss: {
      bpm: 136, inst: { lead: 'saw', bass: 'acid' },
      sections: {
        X: {
          bars: 8, chords: 'Fm Fm Db C Fm Fm Eb C', drums: 'breakbeat', fill: 'fill', bass: 'acid', arp: 'rand16', leadRate: 16,
          lead: 'F4 F4 . Ab4 . F4 C5 . F4 . Eb5 . C5 . Ab4 G4',
        },
        Y: {
          bars: 8, chords: 'Db Eb Fm Fm Db Eb C C', drums: 'breakbeat', fill: 'fillT', bass: 'acid', gtr: 'chug8', stab: 'quarter', inst: { lead: 'hoover' },
          lead: 'F5 - - - Eb5 - - - | G5 - - - Bb4 - - - | C5 - - - Ab5 - - - | G5 - F5 - Eb5 - C5 - | F5 - - - Ab5 - - - | G5 - - - Eb5 - - - | E5 - - - G5 - - - | C6 - - - - - . .',
        },
      },
      order: ['X', 'Y'],
    },
  },

  // ---------------------------------------------------------------- L4 AWAY END: stadium punk, G minor
  awayend: {
    bpm: 142, inst: { bass: 'pick', lead: 'pulse', arp: 'pluck', pad: 'choir' },
    sections: {
      intro: { bars: 4, chords: 'Gm Gm Eb F', drums: 'terrace', fill: 'fill', pad: 1, bass: 'stomp', crash: false },
      A: {
        bars: 8, chords: 'Gm Eb Bb F Gm Eb F D', drums: 'punk', fill: 'fill', bass: 'drive8', gtr: 'punk8',
        lead: 'D5 - D5 - Bb4 - G4 - | G4 - Bb4 - Eb5 - D5 - | D5 - - - F5 - D5 - | C5 - - - - - . . | D5 - D5 - Bb4 - G4 - | G5 - F5 - Eb5 - D5 - | C5 - D5 - Eb5 - C5 - | A4 - - - D5 - - -',
      },
      B: {
        bars: 8, chords: 'Eb F Gm Gm Eb F D D', drums: 'anthem', fill: 'fillT', bass: 'drive8', gtr: 'half', pad: 1, arp: 'up16',
        lead: 'G5 - - - F5 - Eb5 - | F5 - - - C5 - - - | D5 - - - G5 - - - | Bb5 - A5 - G5 - D5 - | G5 - - - F5 - Eb5 - | A5 - - - F5 - - - | F#5 - - - A5 - - - | D6 - - - - - . .',
      },
    },
    order: ['intro', 'A', 'B', 'A', 'B'], loopFrom: 1,
    boss: {
      bpm: 166, transpose: 2, inst: { lead: 'gtr' },
      sections: {
        X: {
          bars: 8, chords: 'Gm Eb Bb F Gm Eb F D', drums: 'skank', fill: 'fill', bass: 'drive8', gtr: 'gallop', arp: 'up16',
          lead: 'D5 - D5 - Bb4 - G4 - | G4 - Bb4 - Eb5 - D5 - | D5 - - - F5 - D5 - | C5 - - - - - . . | D5 - D5 - Bb4 - G4 - | G5 - F5 - Eb5 - D5 - | C5 - D5 - Eb5 - C5 - | A4 - - - D5 - - -',
        },
        Y: {
          bars: 8, chords: 'Eb F Gm Gm Eb F D D', drums: 'dbeat', fill: 'fillT', bass: 'drive8', gtr: 'chug8', pad: 1, inst: { lead: 'saw' },
          lead: 'G5 - - - F5 - Eb5 - | F5 - - - C5 - - - | D5 - - - G5 - - - | Bb5 - A5 - G5 - D5 - | G5 - - - F5 - Eb5 - | A5 - - - F5 - - - | F#5 - - - A5 - - - | D6 - - - - - . .',
        },
      },
      order: ['X', 'Y'],
    },
  },

  // ---------------------------------------------------------------- L5 CITY: 90s rave / house, C minor
  city: {
    bpm: 126, inst: { bass: 'saw', lead: 'square', stab: 'rave', arp: 'saw', pad: 'saw' },
    sections: {
      intro: { bars: 4, chords: 'Cm Ab Bb Gm', drums: 'houseIntro', stab: 'rave', crash: false },
      A: { bars: 8, chords: 'Cm Ab Bb Gm Cm Ab Bb Gm', drums: 'house', fill: 'fill', bass: 'house', stab: 'rave', arp: 'up16' },
      B: {
        bars: 8, chords: 'Ab Bb Cm Cm Ab Bb Gm G', drums: 'house', fill: 'fill', bass: 'oct', stab: 'rave2', pad: 1,
        lead: 'Eb5 - - - C5 - Eb5 - | F5 - - - D5 - Bb4 - | G5 - - - - - Eb5 - | F5 - Eb5 - D5 - C5 - | Eb5 - - - C5 - Ab5 - | G5 - - - F5 - D5 - | G5 - - - Bb5 - - - | B5 - - - - - . .',
      },
      C: { bars: 4, chords: 'Ab Bb Cm Cm', drums: 'riserBuild', pad: 1, arp: 'up16', riser: true },
    },
    order: ['intro', 'A', 'B', 'C', 'B'], loopFrom: 1,
    boss: {
      bpm: 140, inst: { lead: 'hoover' },
      sections: {
        X: {
          bars: 8, chords: 'Cm Ab Bb Gm Cm Ab Bb Gm', drums: 'raveBreak', fill: 'fill', bass: 'oct', stab: 'rave', arp: 'rand16',
          lead: 'C5 - - - - - Bb4 - | C5 - - - Eb5 - D5 - | D5 - - - - - Bb4 - | G4 - - - Bb4 - D5 -',
        },
        Y: {
          bars: 8, chords: 'Ab Bb Cm Cm Ab Bb Gm G', drums: 'raveBreak', fill: 'fillT', bass: 'house', stab: 'rave2', arp: 'up16', inst: { lead: 'saw' },
          lead: 'Eb5 - - - C5 - Eb5 - | F5 - - - D5 - Bb4 - | G5 - - - - - Eb5 - | F5 - Eb5 - D5 - C5 - | Eb5 - - - C5 - Ab5 - | G5 - - - F5 - D5 - | G5 - - - Bb5 - - - | B5 - - - - - . .',
        },
      },
      order: ['X', 'Y'],
    },
  },

  // ---------------------------------------------------------------- L6 INDUSTRIAL: EBM/metal, E phrygian
  industrial: {
    bpm: 116, inst: { bass: 'saw', lead: 'pulse', pad: 'saw', arp: 'square' }, bassDrive: true, padCut: 1000,
    sections: {
      intro: { bars: 4, chords: 'E5 F5 E5 G5', drums: 'factoryIntro', bass: 'hold', pad: 1, crash: false },
      A: {
        bars: 8, chords: 'E5 F5 E5 G5 E5 F5 D5 E5', drums: 'ebm', fill: 'fill', bass: 'ebm', gtr: 'half',
        lead: 'B4 - - - C5 - - - | B4 - A4 - - - - - | G4 - - - A4 - B4 - | D5 - C5 - B4 - - - | E5 - - - F5 - - - | E5 - D5 - C5 - - - | D5 - - - A4 - C5 - | B4 - - - - - . .',
      },
      B: {
        bars: 8, chords: 'C5 D5 E5 E5 C5 D5 F5 E5', drums: 'industrial', fill: 'fillT', bass: 'drive8', gtr: 'chug8', arp: 'down16',
        lead: 'G5 - - - E5 - - - | F5 - - - D5 - - - | E5 - - - B4 - - - | E5 - F5 - G5 - - - | G5 - - - E5 - C5 - | A5 - - - F5 - D5 - | F5 - - - E5 - - - | E5 - - - - - . .',
      },
    },
    order: ['intro', 'A', 'B', 'A'], loopFrom: 1,
    boss: {
      bpm: 134, inst: { lead: 'gtr' },
      sections: {
        X: {
          bars: 8, chords: 'E5 F5 E5 G5 E5 F5 D5 E5', drums: 'dbeat', fill: 'fill', bass: 'gallop', gtr: 'gallop',
          lead: 'B4 - - - C5 - - - | B4 - A4 - - - - - | G4 - - - A4 - B4 - | D5 - C5 - B4 - - - | E5 - - - F5 - - - | E5 - D5 - C5 - - - | D5 - - - A4 - C5 - | B4 - - - - - . .',
        },
        Y: {
          bars: 8, chords: 'C5 D5 E5 E5 C5 D5 F5 E5', drums: 'skank', fill: 'fillT', bass: 'roll16', gtr: 'chug16', arp: 'down16', inst: { lead: 'saw' },
          lead: 'G5 - - - E5 - - - | F5 - - - D5 - - - | E5 - - - B4 - - - | E5 - F5 - G5 - - - | G5 - - - E5 - C5 - | A5 - - - F5 - D5 - | F5 - - - E5 - - - | E5 - - - - - . .',
        },
      },
      order: ['X', 'Y'],
    },
  },

  // ---------------------------------------------------------------- L7 DERBY: high-energy punk-rave, D minor
  derby: {
    bpm: 150, inst: { bass: 'pick', lead: 'saw', arp: 'pluck', pad: 'choir' },
    sections: {
      intro: { bars: 4, chords: 'Dm Bb C A', drums: 'terrace', fill: 'roll', gtr: 'hold', pad: 1, crash: false },
      A: {
        bars: 8, chords: 'Dm Bb C Am Dm Bb Gm A', drums: 'punk', fill: 'fill', bass: 'drive8', gtr: 'punk8', arp: 'up16',
        lead: 'A4 - D5 - F5 - E5 D5 | F5 - - - D5 - Bb4 - | C5 - E5 - G5 - F5 E5 | E5 - - - C5 - A4 - | A4 - D5 - F5 - A5 - | G5 - F5 - D5 - F5 - | G5 - - - Bb5 - A5 G5 | A5 - - - E5 - - -',
      },
      B: {
        bars: 8, chords: 'Bb C Dm Dm Bb C A A', drums: 'anthem', fill: 'fillT', bass: 'drive8', gtr: 'half', pad: 1, inst: { lead: 'pulse' },
        lead: 'D6 - - - C6 - Bb5 - | C6 - - - G5 - - - | A5 - - - F5 - D5 - | F5 - E5 - D5 - A4 - | Bb5 - - - A5 - G5 - | G5 - - - E5 - C5 - | C#6 - - - A5 - - - | E5 - - - - - . .',
      },
    },
    order: ['intro', 'A', 'B', 'A', 'B'], loopFrom: 1,
    boss: {
      bpm: 170, transpose: 1, inst: { lead: 'gtr' },
      sections: {
        X: {
          bars: 8, chords: 'Dm Bb C Am Dm Bb Gm A', drums: 'skank', fill: 'fill', bass: 'drive8', gtr: 'chug8', arp: 'up16',
          lead: 'A4 - D5 - F5 - E5 D5 | F5 - - - D5 - Bb4 - | C5 - E5 - G5 - F5 E5 | E5 - - - C5 - A4 - | A4 - D5 - F5 - A5 - | G5 - F5 - D5 - F5 - | G5 - - - Bb5 - A5 G5 | A5 - - - E5 - - -',
        },
        Y: {
          bars: 8, chords: 'Bb C Dm Dm Bb C A A', drums: 'dbeat', fill: 'fillT', bass: 'gallop', gtr: 'gallop', pad: 1, inst: { lead: 'saw' },
          lead: 'D6 - - - C6 - Bb5 - | C6 - - - G5 - - - | A5 - - - F5 - D5 - | F5 - E5 - D5 - A4 - | Bb5 - - - A5 - G5 - | G5 - - - E5 - C5 - | C#6 - - - A5 - - - | E5 - - - - - . .',
        },
      },
      order: ['X', 'Y'],
    },
  },

  // ---------------------------------------------------------------- L8 LAST STAND: epic half-time anthem -> drum'n'bass boss, B minor
  laststand: {
    bpm: 100, inst: { bass: 'sub', lead: 'saw', pad: 'choir', arp: 'bell' },
    sections: {
      intro: { bars: 4, chords: 'Bm G D A', drums: 'march', fill: 'roll', pad: 1, crash: false },
      A: {
        bars: 8, chords: 'Bm G D A Bm G Em F#', drums: 'halftimeBig', fill: 'fillT', bass: 'half', pad: 1, arp: 'up8', leadRate: 4,
        lead: 'F#5 - D5 B4 | D5 - - - | A5 - F#5 D5 | E5 - - - | F#5 - B5 A5 | G5 - F#5 D5 | E5 - G5 F#5 | F#5 - - -',
      },
      B: {
        bars: 8, chords: 'G A Bm Bm G A F# F#', drums: 'anthem', fill: 'fillT', bass: 'drive8', gtr: 'hold', pad: 1, arp: 'up16', leadRate: 4,
        lead: 'B5 - A5 G5 | A5 - E5 - | F#5 - - D5 | B5 - - - | B5 - A5 G5 | C#6 - A5 - | A#5 - - F#5 | F#5 - - -',
      },
    },
    order: ['intro', 'A', 'B', 'A', 'B'], loopFrom: 1,
    boss: {
      bpm: 174, inst: { lead: 'hoover', bass: 'sub' },
      sections: {
        X: {
          bars: 8, chords: 'Bm G D A Bm G Em F#', drums: 'dnb', fill: 'fill', bass: 'dnb', gtr: 'half', arp: 'up16', leadRate: 4,
          lead: 'F#5 - D5 B4 | D5 - - - | A5 - F#5 D5 | E5 - - - | F#5 - B5 A5 | G5 - F#5 D5 | E5 - G5 F#5 | F#5 - - -',
        },
        Y: {
          bars: 8, chords: 'G A Bm Bm G A F# F#', drums: 'dnb2', fill: 'fillT', bass: 'dnb', gtr: 'chug8', pad: 1, leadRate: 4, inst: { lead: 'gtr' },
          lead: 'B5 - A5 G5 | A5 - E5 - | F#5 - - D5 | B5 - - - | B5 - A5 G5 | C#6 - A5 - | A#5 - - F#5 | F#5 - - -',
        },
      },
      order: ['X', 'Y'],
    },
  },

  // ---------------------------------------------------------------- jingles
  victory: {
    bpm: 140, inst: { lead: 'pulse', bass: 'saw', pad: 'saw', arp: 'bell', lead2: 'square' },
    sections: {
      jingle: {
        bars: 3, chords: 'C F,G C', drums: 'jingle', bass: 'R.......R...R...', leadRate: 16, pad: 1, crash: false,
        lead: 'G4 . C5 . E5 . G5 - - . E5 . G5 - - - | A5 - - - F5 - A5 - B5 - - - G5 - B5 - | C6 - - - - - - - - - - - . . . .',
        lead2: 'E4 . G4 . C5 . E5 - - . C5 . E5 - - - | F5 - - - C5 - F5 - G5 - - - D5 - G5 - | E5 - - - - - - - - - - - . . . .', lead2Rate: 16,
      },
      calm: { bars: 8, chords: 'C Am F G C Am Dm G', drums: 'soft', bass: 'half', pad: 1, arp: 'up8' },
    },
    order: ['jingle', 'calm'], loopFrom: 1,
  },
  gameover: {
    bpm: 76, gain: 0.6, inst: { lead: 'saw', bass: 'sub', pad: 'organ', arp: 'bell' },
    sections: {
      sting: { bars: 2, chords: 'Cm Ab,G', drums: 'sting', bass: 'hold', pad: 1, crash: false, lead: 'G4 - F4 - Eb4 - D4 - | C4 - - - - - - .' },
      sad: { bars: 8, chords: 'Cm Ab Fm G Cm Ab Fm G', drums: 'heartbeat', bass: 'hold', pad: 1, arp: 'up8', crash: false },
    },
    order: ['sting', 'sad'], loopFrom: 1,
  },
};

// ===================================================================== compile
function parseMelody(str, rate) {
  const toks = str.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
  const per = 16 / rate, len = toks.length * per, ev = new Array(len).fill(null);
  let last = null;
  toks.forEach((tk, i) => {
    if (tk === '-') { if (last) last.steps += per; return; }
    if (tk === '.') { last = null; return; }
    const slide = tk[0] === '~';
    const m = noteToMidi(slide ? tk.slice(1) : tk);
    if (m === null) { last = null; return; }
    last = { m, steps: per, slide };
    ev[i * per] = last;
  });
  return { len, ev };
}
function parseBass(str) {
  const ch = str.replace(/[\s|]/g, ''), ev = new Array(ch.length).fill(null);
  let last = null;
  for (let i = 0; i < ch.length; i++) {
    const k = ch[i];
    if (k === '-') { if (last) last.steps++; continue; }
    if (k === '.') { last = null; continue; }
    last = { tok: k.toUpperCase(), soft: k !== k.toUpperCase(), steps: 1 };
    ev[i] = last;
  }
  return { len: ch.length, ev };
}
function parseHits(str) {
  const ch = str.replace(/[\s|]/g, ''), n = ch.length, ev = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const k = ch[i];
    if (k === '.' || k === '-') continue;
    let gap = 1; while (gap < n && (ch[(i + gap) % n] === '.' || ch[(i + gap) % n] === '-')) gap++;
    ev[i] = { k, ring: k === 'O' ? gap : 0 };
  }
  return { len: n, ev };
}
function compileSection(sec) {
  const s = { ...sec };
  s.bars = sec.bars || 4;
  s.chordList = (sec.chords || 'C').trim().split(/\s+/).map(tok => tok.split(',').map(parseChord));
  if (sec.lead) s.leadEv = parseMelody(sec.lead, sec.leadRate || 8);
  if (sec.lead2) s.lead2Ev = parseMelody(sec.lead2, sec.lead2Rate || sec.leadRate || 8);
  if (sec.bass) s.bassEv = parseBass(BASS[sec.bass] || sec.bass);
  if (sec.gtr) s.gtrEv = parseHits(GTR[sec.gtr] || sec.gtr);
  if (sec.stab) s.stabEv = parseHits(STAB[sec.stab] || sec.stab);
  s.drumDef = typeof sec.drums === 'object' ? sec.drums : DRUMS[sec.drums] || null;
  s.fillDef = sec.fill ? (typeof sec.fill === 'object' ? sec.fill : DRUMS[sec.fill]) : null;
  s.arpDef = sec.arp ? (typeof sec.arp === 'object' ? sec.arp : ARPS[sec.arp]) : null;
  return s;
}
const compiled = {};
function getSong(id) {
  if (compiled[id]) return compiled[id];
  const def = SONGS[id];
  if (!def) return null;
  const song = { ...def, sections: {}, bossSections: {} };
  for (const k in def.sections) song.sections[k] = compileSection(def.sections[k]);
  if (def.boss) for (const k in def.boss.sections || {}) song.bossSections[k] = compileSection(def.boss.sections[k]);
  return (compiled[id] = song);
}

// ===================================================================== song player
let livePlayers = 0;
const BASS_OFF = { R: 0, F: 7, O: 12, S: 10, L: -5, N: 2, X: 9, Q: 5, U: 19 };

class Player {
  constructor(E, id, song) {
    this.E = E; this.c = E.ctx; this.id = id; this.song = song;
    this.nodes = []; this.oscs = [];
    this.mode = 'normal'; this.pending = null;
    this.bpm = song.bpm; this.targetBpm = song.bpm;
    this.oi = 0; this.bar = 0; this.step = 0; this.played = 0; this.arpI = 0;
    this.lastLead = null; this.lastLead2 = null; this.impact = false; this.stopped = false; this.finished = false;
    this.buildMixer();
    this.enter(song.order[0]);
    this.next = this.c.currentTime + 0.08;
    this.tickFn = () => this.tick();
    E.addTicker(this.tickFn);
    livePlayers++;
  }

  // ---------------------------------------------------------------- mixer
  node(n) { this.nodes.push(n); return n; }
  buildMixer() {
    const c = this.c, E = this.E, mix = this.song.mix || {};
    this.out = this.node(c.createGain());
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.gain.exponentialRampToValueAtTime(this.song.gain || 0.85, c.currentTime + 0.06);
    this.out.connect(E.musicBus);
    this.verbIn = this.node(c.createGain()); this.verbIn.gain.value = 1; this.verbIn.connect(E.musicVerb);
    // tempo-synced feedback delay (dotted eighth)
    this.dlyIn = this.node(c.createGain());
    this.dly = this.node(c.createDelay(2));
    this.dly.delayTime.value = 0.75 * 60 / this.bpm;
    const dlp = this.node(c.createBiquadFilter()); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    const fb = this.node(c.createGain()); fb.gain.value = 0.32;
    const dOut = this.node(c.createGain()); dOut.gain.value = 0.55;
    this.dlyIn.connect(this.dly); this.dly.connect(dlp); dlp.connect(fb); fb.connect(this.dly); dlp.connect(dOut);
    if (c.createStereoPanner) { const p = this.node(c.createStereoPanner()); p.pan.value = 0.35; dOut.connect(p); p.connect(this.out); } else dOut.connect(this.out);

    const ch = this.ch = {};
    const mk = (name, gain, { pan = 0, verb = 0, delay = 0 } = {}) => {
      const g = this.node(c.createGain()); g.gain.value = gain * (mix[name] ?? 1);
      let last = g;
      if (pan && c.createStereoPanner) { const p = this.node(c.createStereoPanner()); p.pan.value = pan; g.connect(p); last = p; }
      last.connect(this.out);
      if (verb) { const s = this.node(c.createGain()); s.gain.value = verb; last.connect(s); s.connect(this.verbIn); }
      if (delay) { const s = this.node(c.createGain()); s.gain.value = delay; last.connect(s); s.connect(this.dlyIn); }
      ch[name] = g;
      return g;
    };
    mk('kick', 0.75);
    mk('snare', 0.5, { verb: 0.22 });
    mk('hat', 0.32, { pan: 0.22, verb: 0.04 });
    mk('cym', 0.3, { pan: -0.2, verb: 0.15 });
    mk('tom', 0.5, { verb: 0.2 });
    mk('perc', 0.45, { pan: -0.3, verb: 0.25, delay: 0.18 });
    mk('boom', 0.7, { verb: 0.45 });
    mk('lead', 0.6, { verb: 0.22, delay: 0.2 });
    mk('lead2', 0.4, { pan: 0.3, verb: 0.25, delay: 0.1 });
    mk('arp', 0.36, { pan: -0.28, verb: 0.15, delay: 0.28 });
    mk('stab', 0.42, { pan: 0.1, verb: 0.25, delay: 0.12 });
    mk('fx', 0.5, { verb: 0.4 });
    // bass (optional gentle drive)
    const bass = mk('bass', 0.62);
    if (this.song.bassDrive) {
      // re-route: bass -> shaper -> out
      bass.disconnect();
      const ws = this.node(c.createWaveShaper()); ws.curve = E.distCurve(2.2);
      const lp = this.node(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = this.node(c.createGain()); g.gain.value = 0.55;
      bass.connect(ws); ws.connect(lp); lp.connect(g); g.connect(this.out);
    }
    // pad: shared lowpass with slow LFO sweep
    const padIn = this.node(c.createGain()); padIn.gain.value = 1;
    const plp = this.node(c.createBiquadFilter()); plp.type = 'lowpass'; plp.Q.value = 0.6; plp.frequency.value = this.song.padCut || 1700;
    const lfo = this.node(c.createOscillator()); lfo.frequency.value = 0.11;
    const lg = this.node(c.createGain()); lg.gain.value = (this.song.padCut || 1700) * 0.35;
    lfo.connect(lg); lg.connect(plp.frequency); lfo.start(); this.oscs.push(lfo);
    const padOut = this.node(c.createGain()); padOut.gain.value = 0.5 * (mix.pad ?? 1);
    padIn.connect(plp); plp.connect(padOut); padOut.connect(this.out);
    const ps = this.node(c.createGain()); ps.gain.value = 0.45; padOut.connect(ps); ps.connect(this.verbIn);
    ch.pad = padIn;
    // guitar: drive -> shaper -> cab -> wide stereo (Haas)
    ch.gtr = this.guitarChain(0.17 * (mix.gtr ?? 1), 7, 0.12, true);
  }
  guitarChain(level, drive, verb, wide) {
    const c = this.c, E = this.E;
    const inp = this.node(c.createGain());
    const hp = this.node(c.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 110;
    const pre = this.node(c.createGain()); pre.gain.value = drive;
    const ws = this.node(c.createWaveShaper()); ws.curve = E.distCurve(4); ws.oversample = '2x';
    const pk = this.node(c.createBiquadFilter()); pk.type = 'peaking'; pk.frequency.value = 1600; pk.Q.value = 0.9; pk.gain.value = 4;
    const lp = this.node(c.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 4300; lp.Q.value = 0.8;
    const post = this.node(c.createGain()); post.gain.value = level;
    inp.connect(hp); hp.connect(pre); pre.connect(ws); ws.connect(pk); pk.connect(lp); lp.connect(post);
    if (wide && c.createStereoPanner) {
      const pl = this.node(c.createStereoPanner()); pl.pan.value = -0.55; post.connect(pl); pl.connect(this.out);
      const d = this.node(c.createDelay(0.05)); d.delayTime.value = 0.014;
      const pr = this.node(c.createStereoPanner()); pr.pan.value = 0.55; post.connect(d); d.connect(pr); pr.connect(this.out);
    } else post.connect(this.out);
    const s = this.node(c.createGain()); s.gain.value = verb; post.connect(s); s.connect(this.verbIn);
    if (!wide) { const ds = this.node(c.createGain()); ds.gain.value = 0.22; post.connect(ds); ds.connect(this.dlyIn); }
    return inp;
  }
  choirChain() {
    if (this.ch.choir) return this.ch.choir;
    const c = this.c;
    const inp = this.node(c.createGain());
    const out = this.node(c.createGain()); out.gain.value = 1.4 * ((this.song.mix || {}).pad ?? 1);
    const F = VOWELS.a;
    [[F[0], 6, 1], [F[1], 8, 0.55], [F[2], 10, 0.25], [VOWELS.o[1], 7, 0.35]].forEach(([f, q, a]) => {
      const bp = this.node(c.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = this.node(c.createGain()); g.gain.value = a;
      inp.connect(bp); bp.connect(g); g.connect(out);
    });
    out.connect(this.out);
    const s = this.node(c.createGain()); s.gain.value = 0.6; out.connect(s); s.connect(this.verbIn);
    return (this.ch.choir = inp);
  }
  leadGtr() {
    if (!this.ch.lgtr) this.ch.lgtr = this.guitarChain(0.15 * ((this.song.mix || {}).lead ?? 1), 10, 0.22, false);
    return this.ch.lgtr;
  }

  // ---------------------------------------------------------------- transport
  sections() { return this.mode === 'boss' ? this.song.boss.order : this.song.order; }
  findSec(name) { return (this.mode === 'boss' && this.song.bossSections[name]) || this.song.sections[name] || this.song.bossSections[name]; }
  enter(name) {
    this.sec = this.findSec(name) || Object.values(this.song.sections)[0];
    this.bar = 0;
  }
  inst(kind) {
    const s = this.sec, sg = this.song;
    return (s.inst && s.inst[kind]) || (this.mode === 'boss' && sg.boss.inst && sg.boss.inst[kind]) || (sg.inst && sg.inst[kind]) || null;
  }
  trans() { return (this.mode === 'boss' ? (this.song.boss.transpose || 0) : 0) + (this.sec.transpose || 0); }
  swing8() { return this.mode === 'boss' && this.song.boss.swing8 !== undefined ? this.song.boss.swing8 : (this.song.swing8 || 0); }
  sd() { return 60 / this.bpm / 4; }
  stepLen(step) {
    const sd = this.sd(), sw = this.swing8();
    if (!sw) return sd;
    return (step % 4) < 2 ? sd * (1 + sw) : sd * (1 - sw);
  }

  tick() {
    if (this.stopped || this.finished) return;
    const now = this.c.currentTime;
    const ahead = (typeof document !== 'undefined' && document.hidden) ? 1.2 : 0.14;
    if (this.next < now - 0.1) {
      // we were throttled / suspended: skip the missed steps (keeps arrangement position, no burst of notes)
      let guard = 0;
      while (this.next < now && guard++ < 4096) this.advance(true);
      if (this.next < now) this.next = now + 0.02;
    }
    let n = 0;
    while (this.next < now + ahead && n++ < 64 && !this.finished) {
      this.playStep(this.next);
      this.advance(false);
    }
  }

  advance(skipping) {
    if (this.bpm !== this.targetBpm) {
      this.bpm += (this.targetBpm - this.bpm) * 0.3;
      if (Math.abs(this.bpm - this.targetBpm) < 0.5) this.bpm = this.targetBpm;
      if (!skipping) this.dly.delayTime.setTargetAtTime(0.75 * 60 / this.bpm, this.c.currentTime, 0.05);
    }
    this.next += this.stepLen(this.step);
    this.step++;
    if (this.step >= 16) {
      this.step = 0; this.bar++;
      if (this.bar >= this.sec.bars) this.nextSection();
    }
  }

  nextSection() {
    const order = this.sections();
    this.oi++;
    this.played++;
    if (this.oi >= order.length) {
      if (this.song.once) { this.finished = true; return; }
      this.oi = this.mode === 'boss' ? 0 : (this.song.loopFrom || 0);
    }
    this.enter(order[this.oi]);
  }

  setBoss(on) {
    if (!this.song.boss) return;
    const want = on ? 'boss' : 'normal';
    if (this.mode === want && !this.pending) return;
    this.pending = want === this.mode ? null : want;
    if (!this.pending) return;
    // riser into the next bar line
    const now = this.c.currentTime;
    let t = this.next, s = this.step;
    while (s !== 0) { t += this.stepLen(s); s = (s + 1) % 16; }
    const len = Math.max(0.12, t - now);
    if (on) this.riser(now + 0.01, len, 1);
    else this.riser(now + 0.01, len, 0.5);
  }

  applyPending(t) {
    const mode = this.pending; this.pending = null;
    this.mode = mode;
    this.oi = mode === 'boss' ? 0 : (this.song.loopFrom || 0);
    this.enter(this.sections()[this.oi]);
    this.targetBpm = mode === 'boss' ? (this.song.boss.bpm || this.song.bpm) : this.song.bpm;
    this.impact = true;
    this.played++;
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    livePlayers--;
    this.E.removeTicker(this.tickFn);
    const c = this.c, t = c.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(0.0001, this.out.gain.value), t);
    this.out.gain.setTargetAtTime(0.0001, t, 0.07);
    setTimeout(() => {
      for (const o of this.oscs) { try { o.stop(); } catch (e) { /* already stopped */ } }
      for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ok */ } }
      this.nodes.length = 0; this.oscs.length = 0;
    }, 700);
  }

  // ---------------------------------------------------------------- per step
  chordAt(s) {
    const sec = this.sec, list = sec.chordList[this.bar % sec.chordList.length];
    const idx = Math.min(list.length - 1, Math.floor(s * list.length / 16));
    const per = 16 / list.length, tr = this.trans(), ch = list[idx];
    return { ch: tr ? { pc: (ch.pc + tr + 120) % 12, iv: ch.iv } : ch, change: s === Math.round(idx * per), span: per };
  }

  playStep(t) {
    if (this.step === 0 && this.pending) this.applyPending(t);
    const sec = this.sec, s = this.step, si = this.bar * 16 + s, sd = this.sd();
    const { ch, change, span } = this.chordAt(s);
    const tr = this.trans();

    // impact (boss switch) / section crash
    if (si === 0) {
      if (this.impact) { this.impact = false; this.crash(t, 1); this.boom(t, 1); this.kick(t, 1); }
      else if (sec.crash !== false && this.played > 0) this.crash(t, 0.8);
    }

    // drums
    const lastBar = this.bar === sec.bars - 1;
    const dr = lastBar && sec.fillDef ? sec.fillDef : sec.drumDef;
    if (dr) for (const lane in dr) {
      const str = dr[lane]; if (!str) continue;
      const k = str[si % str.length];
      if (k && k !== '.') this.drum(lane, t, k === 'X' ? 1 : k === 'x' ? 0.75 : 0.35);
    }
    if (lastBar && s === 0 && sec.riser) this.riser(t, 16 * sd, 0.8);

    // bass
    if (sec.bassEv) {
      const e = sec.bassEv.ev[si % sec.bassEv.len];
      if (e) {
        const root = 28 + (((ch.pc - 28) % 12) + 12) % 12;
        const off = e.tok === 'T' ? (ch.iv[1] <= 4 && ch.iv.length > 2 ? ch.iv[1] : 7) : (BASS_OFF[e.tok] ?? 0);
        const dur = e.soft ? sd * 0.7 : e.steps * sd * 0.92;
        this.bass(t, root + off, dur, e.soft ? 0.65 : 0.95);
      }
    }
    // pad
    if (sec.pad && change) {
      const kind = this.inst('pad') || 'saw';
      const notes = voicing(ch, kind === 'choir' ? 50 : 52, 13);
      this.padChord(t, notes, span * sd + 0.05, kind);
    }
    // guitar
    if (sec.gtrEv) {
      const e = sec.gtrEv.ev[si % sec.gtrEv.len];
      if (e) {
        const root = 40 + (((ch.pc - 40) % 12) + 12) % 12;
        if (e.k === 'O') this.gtr(t, root, Math.min(e.ring, 16 - (si % 16)) * sd, 1, false);
        else this.gtr(t, root, sd * (e.k === 'X' ? 1.6 : 1.1), e.k === 'X' ? 1 : 0.8, true);
      }
    }
    // stabs
    if (sec.stabEv) {
      const e = sec.stabEv.ev[si % sec.stabEv.len];
      if (e) {
        const notes = voicing(ch, 57, 13);
        const dur = e.k === 'O' ? Math.min(e.ring, 16) * sd : e.k === 'X' ? sd * 2 : sd * 1.1;
        this.stab(t, notes, dur, e.k === 'x' ? 0.75 : 1, this.inst('stab') || 'piano');
      }
    }
    // arp
    if (sec.arpDef) {
      const a = sec.arpDef, every = 16 / a.rate;
      if (s % every === 0) {
        const notes = [];
        const base = voicing(ch, a.lo, 12);
        for (let o = 0; o < (a.span || 1); o++) for (const n of base) notes.push(n + o * 12);
        const n = notes.length, i = this.arpI++;
        let idx;
        if (a.mode === 'down') idx = n - 1 - (i % n);
        else if (a.mode === 'updown') { const p = Math.max(1, 2 * n - 2); const k = i % p; idx = k < n ? k : p - k; }
        else if (a.mode === 'rand') idx = (R() * n) | 0;
        else idx = i % n;
        this.arp(t, notes[idx], sd * every * 0.8, (s % 4 === 0 ? 1 : 0.7), this.inst('arp') || 'pluck');
      }
    }
    // leads
    if (sec.leadEv) {
      const e = sec.leadEv.ev[si % sec.leadEv.len];
      if (e) {
        const m = e.m + tr + (sec.leadOct || 0) * 12;
        this.lead(t, m, e.steps * sd * 0.94, 0.9, this.inst('lead') || 'pulse', e.slide ? this.lastLead : null, 'lead');
        this.lastLead = m;
      }
    }
    if (sec.lead2Ev) {
      const e = sec.lead2Ev.ev[si % sec.lead2Ev.len];
      if (e) {
        const m = e.m + tr;
        this.lead(t, m, e.steps * sd * 0.94, 0.8, this.inst('lead2') || 'square', e.slide ? this.lastLead2 : null, 'lead2');
        this.lastLead2 = m;
      }
    }
  }

  // ---------------------------------------------------------------- drums
  drum(lane, t, v) {
    switch (lane) {
      case 'k': this.kick(t, v); break;
      case 's': this.snare(t, v); break;
      case 'c': this.clap(t, v); break;
      case 'h': this.hat(t, v, false); break;
      case 'o': this.hat(t, v, true); break;
      case 'r': this.ride(t, v); break;
      case 'x': this.crash(t, v); break;
      case 't': this.tom(t, v, 220); break;
      case 'm': this.tom(t, v, 160); break;
      case 'f': this.tom(t, v, 105); break;
      case 'p': this.clank(t, v); break;
      case 'b': this.boom(t, v); break;
      case 'q': this.E.noise(t, 0.025, { vol: 0.45 * v, freq: 2300, q: 4, dest: this.ch.snare }); break;
      case 'z': this.E.noise(t, 0.035, { vol: 0.16 * v, freq: 8500, type: 'highpass', attack: 0.008, dest: this.ch.hat }); break;
    }
  }
  kick(t, v) {
    const c = this.c, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(56, t + 0.055);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.95 * v, t + 0.003);
    g.gain.setValueAtTime(0.95 * v, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(this.ch.kick); o.start(t); o.stop(t + 0.36);
    this.E.noise(t, 0.012, { vol: 0.25 * v, freq: 2800, type: 'highpass', dest: this.ch.kick });
  }
  snare(t, v) {
    const E = this.E, d = this.ch.snare;
    E.noise(t, 0.16, { vol: 0.55 * v, freq: 1700, type: 'highpass', q: 0.6, dest: d });
    E.noise(t, 0.08, { vol: 0.35 * v, freq: 1000, q: 1.2, dest: d });
    E.tone(t, 0.08, { freq: 205, to: 165, type: 'triangle', vol: 0.45 * v, dest: d, attack: 0.001 });
  }
  clap(t, v) {
    const c = this.c, src = c.createBufferSource(); src.buffer = this.E.noiseBuf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 1.3;
    const g = c.createGain(), a = 0.6 * v;
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(a, t + i * 0.011); g.gain.exponentialRampToValueAtTime(a * 0.15, t + i * 0.011 + 0.009); }
    g.gain.setValueAtTime(a, t + 0.034);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(bp); bp.connect(g); g.connect(this.ch.snare);
    src.start(t, R() * 1.5); src.stop(t + 0.25);
  }
  hat(t, v, open) {
    if (!open && this.openHat) { try { this.openHat.gain.setTargetAtTime(0.0001, t, 0.012); } catch (e) { /* ok */ } this.openHat = null; }
    const g = this.E.noise(t, open ? 0.26 : 0.03 + v * 0.015, { vol: (open ? 0.3 : 0.38) * v, freq: open ? 7000 : 7800, type: 'highpass', q: 0.7, dest: this.ch.hat, attack: 0.001 });
    if (open) this.openHat = g;
  }
  ride(t, v) {
    this.E.noise(t, 0.35, { vol: 0.15 * v, freq: 6500, q: 2.5, dest: this.ch.cym });
    this.E.tone(t, 0.3, { freq: 3150, type: 'sine', vol: 0.05 * v, dest: this.ch.cym });
  }
  crash(t, v) {
    this.E.noise(t, 1.6, { vol: 0.34 * v, freq: 4200, type: 'highpass', q: 0.5, dest: this.ch.cym });
    this.E.noise(t, 0.9, { vol: 0.14 * v, freq: 9000, q: 1.5, dest: this.ch.cym });
  }
  tom(t, v, f) {
    this.E.tone(t, 0.3, { freq: f * 1.35, to: f * 0.75, type: 'sine', vol: 0.75 * v, dest: this.ch.tom, attack: 0.002 });
    this.E.noise(t, 0.05, { vol: 0.2 * v, freq: 1600, type: 'lowpass', dest: this.ch.tom });
  }
  clank(t, v) {
    const base = [380, 455, 610][(R() * 3) | 0];
    this.E.metal(t, { base, ratios: [1, 1.47, 2.09, 2.76], dur: 0.2, vol: 0.28 * v, dest: this.ch.perc });
    this.E.noise(t, 0.02, { vol: 0.25 * v, freq: 3500, type: 'highpass', dest: this.ch.perc });
  }
  boom(t, v) {
    this.E.tone(t, 0.55, { freq: 78, to: 38, type: 'sine', vol: 0.9 * v, dest: this.ch.boom, attack: 0.003 });
    this.E.noise(t, 0.25, { vol: 0.4 * v, freq: 260, type: 'lowpass', buf: 'brown', dest: this.ch.boom });
  }
  riser(t, len, v) {
    const a = Math.max(0.05, len - 0.02);
    this.E.noise(t, 0.08, { vol: 0.2 * v, freq: 450, q: 1.4, sweep: 18, attack: a, dest: this.ch.fx });
    this.E.tone(t, a + 0.08, { freq: 110, to: 880, type: 'sawtooth', vol: 0.035 * v, attack: a, dest: this.ch.fx });
  }

  // ---------------------------------------------------------------- pitched instruments
  env(g, t, peak, dur, a = 0.005, rel = 0.06, sus = 1) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (sus < 1) g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + Math.min(0.12, dur * 0.5));
    g.gain.setValueAtTime(Math.max(0.0002, peak * sus), t + Math.max(a + 0.01, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur) + rel);
    return t + Math.max(a + 0.01, dur) + rel + 0.02;
  }
  bass(t, m, dur, v) {
    const c = this.c, f = mtof(m), type = this.inst('bass') || 'saw';
    const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass';
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    let peak = 0.3 * v;
    o1.frequency.value = f; o2.frequency.value = f;
    if (type === 'acid') {
      o1.type = 'sawtooth'; o2.type = 'square'; o2.frequency.value = f * 0.5;
      lp.Q.value = 11;
      const acc = v > 0.8 ? 1 : 0.45;
      lp.frequency.setValueAtTime(320 + 2600 * acc, t); lp.frequency.exponentialRampToValueAtTime(230, t + 0.16);
      peak = 0.24 * v;
    } else if (type === 'sub') {
      o1.type = 'sine'; o2.type = 'triangle'; o2.frequency.value = f * 2;
      lp.frequency.value = 700; peak = 0.5 * v;
    } else if (type === 'square') {
      o1.type = 'square'; o2.type = 'sine'; o2.frequency.value = f * 0.5;
      lp.Q.value = 2; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.2);
    } else if (type === 'pick') {
      o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = -6;
      lp.Q.value = 3; lp.frequency.setValueAtTime(2800 * v + 400, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.1);
      peak = 0.26 * v;
    } else {
      o1.type = 'sawtooth'; o2.type = 'sawtooth'; o2.detune.value = 9;
      lp.Q.value = 4; lp.frequency.setValueAtTime(500 + 2300 * v, t); lp.frequency.exponentialRampToValueAtTime(280, t + 0.2);
      peak = 0.24 * v;
    }
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.ch.bass);
    const end = this.env(g, t, peak, dur, 0.004, 0.05);
    o1.start(t); o2.start(t); o1.stop(end); o2.stop(end);
  }

  lead(t, m, dur, v, type, slideFrom, chName) {
    const c = this.c, f = mtof(m), E = this.E;
    let dest = this.ch[chName] || this.ch.lead;
    const g = c.createGain();
    const oscs = [];
    const setF = (o, mult = 1) => {
      if (slideFrom) { o.frequency.setValueAtTime(mtof(slideFrom) * mult, t); o.frequency.exponentialRampToValueAtTime(f * mult, t + 0.07); }
      else o.frequency.setValueAtTime(f * mult, t);
    };
    let peak = 0.26 * v, a = 0.008, rel = 0.09, sus = 0.75, vib = 14, src = null;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.Q.value = 0.7;
    if (type === 'pulse') {
      // PWM: saw minus delayed saw = pulse; modulating the delay sweeps the duty cycle
      const o = c.createOscillator(); o.type = 'sawtooth'; setF(o); oscs.push(o);
      const per = 1 / f;
      const dl = c.createDelay(0.05); dl.delayTime.value = per * 0.32;
      const pl = c.createOscillator(); pl.frequency.value = 0.9 + R() * 0.5; oscs.push(pl);
      const pg = c.createGain(); pg.gain.value = per * 0.16; pl.connect(pg); pg.connect(dl.delayTime);
      const inv = c.createGain(); inv.gain.value = -1;
      const mix = c.createGain(); mix.gain.value = 0.5;
      o.connect(mix); o.connect(dl); dl.connect(inv); inv.connect(mix);
      src = mix; peak = 0.3 * v;
    } else if (type === 'saw' || type === 'hoover') {
      const det = type === 'hoover' ? [-22, 0, 22] : [-9, 9];
      const mix = c.createGain(); mix.gain.value = type === 'hoover' ? 0.38 : 0.5;
      for (const d of det) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = d; oscs.push(o);
        if (type === 'hoover' && !slideFrom) { o.frequency.setValueAtTime(f * 0.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.09); } else setF(o);
        o.connect(mix);
      }
      if (type === 'hoover') { const o = c.createOscillator(); o.type = 'sawtooth'; setF(o, 0.5); o.connect(mix); oscs.push(o); lp.frequency.value = 5200; }
      else lp.frequency.value = 3200;
      src = mix; peak = 0.22 * v;
    } else if (type === 'square') {
      const o = c.createOscillator(); o.setPeriodicWave(E.pulse[0.5]); setF(o); oscs.push(o);
      src = o; peak = 0.2 * v; lp.frequency.value = 4500;
    } else if (type === 'whistle') {
      const o = c.createOscillator(); o.type = 'sine'; setF(o, 2); oscs.push(o);
      const o2 = c.createOscillator(); o2.type = 'triangle'; setF(o2, 2); oscs.push(o2);
      const mix = c.createGain(); mix.gain.value = 0.6; o.connect(mix); o2.connect(mix);
      src = mix; peak = 0.28 * v; vib = 22; a = 0.03;
    } else if (type === 'bell') {
      const mix = c.createGain(); mix.gain.value = 1;
      [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([r, amp]) => {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * r; oscs.push(o);
        const gg = c.createGain(); gg.gain.value = amp; o.connect(gg); gg.connect(mix);
      });
      src = mix; peak = 0.25 * v; vib = 0; dur = Math.max(dur, 0.6); a = 0.002; sus = 0.2; rel = 0.5;
    } else if (type === 'gtr') {
      const o = c.createOscillator(); o.type = 'sawtooth'; setF(o); oscs.push(o);
      const o2 = c.createOscillator(); o2.type = 'square'; o2.detune.value = 7; setF(o2); oscs.push(o2);
      const mix = c.createGain(); mix.gain.value = 0.5; o.connect(mix); o2.connect(mix);
      src = mix; dest = this.leadGtr(); peak = 0.6 * v; vib = 28; sus = 0.9; lp.frequency.value = 2400;
    } else {
      const o = c.createOscillator(); o.type = 'square'; setF(o); oscs.push(o); src = o; peak = 0.16 * v;
    }
    // vibrato with delayed onset
    if (vib && dur > 0.22) {
      const lfo = c.createOscillator(); lfo.frequency.value = 5.4 + R() * 0.6; oscs.push(lfo);
      const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.16); lg.gain.linearRampToValueAtTime(vib, t + 0.35);
      lfo.connect(lg);
      for (const o of oscs) if (o !== lfo && o.detune) lg.connect(o.detune);
    }
    src.connect(lp); lp.connect(g); g.connect(dest);
    const end = this.env(g, t, peak, dur, a, rel, sus);
    for (const o of oscs) { o.start(t); o.stop(end); }
  }

  arp(t, m, dur, v, type) {
    const c = this.c, f = mtof(m), E = this.E;
    if (type === 'bell') { this.lead(t, m, dur, v * 0.7, 'bell', null, 'arp'); return; }
    const o = c.createOscillator();
    if (type === 'saw') o.type = 'sawtooth';
    else o.setPeriodicWave(E.pulse[type === 'square' ? 0.125 : 0.25]);
    o.frequency.value = f;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = type === 'saw' ? 5 : 1;
    lp.frequency.setValueAtTime(type === 'saw' ? 5000 : 4200, t); lp.frequency.exponentialRampToValueAtTime(type === 'saw' ? 700 : 1100, t + Math.max(0.06, dur));
    const g = c.createGain();
    o.connect(lp); lp.connect(g); g.connect(this.ch.arp);
    const end = this.env(g, t, 0.2 * v, dur * 0.85, 0.002, 0.05, 0.5);
    o.start(t); o.stop(end);
  }

  padChord(t, notes, dur, type) {
    const c = this.c;
    const dest = type === 'choir' ? this.choirChain() : this.ch.pad;
    const g = c.createGain();
    const a = Math.min(0.4, dur * 0.3), rel = 0.45;
    const n = notes.length;
    const peak = (type === 'organ' ? 0.11 : type === 'choir' ? 0.16 : 0.09) * 3 / Math.max(3, n);
    const oscs = [];
    for (const m of notes) {
      const f = mtof(m);
      if (type === 'organ') {
        [[1, 'sine', 1], [2, 'sine', 0.45], [0.5, 'sine', 0.5], [3, 'square', 0.05]].forEach(([r, w, amp]) => {
          const o = c.createOscillator(); o.type = w; o.frequency.value = f * r;
          const gg = c.createGain(); gg.gain.value = amp; o.connect(gg); gg.connect(g); oscs.push(o);
        });
      } else {
        for (const d of [-8, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d + (R() - 0.5) * 4; o.connect(g); oscs.push(o); }
      }
    }
    if (type === 'choir') {
      const lfo = c.createOscillator(); lfo.frequency.value = 4.8; const lg = c.createGain(); lg.gain.value = 9;
      lfo.connect(lg); for (const o of oscs) lg.connect(o.detune); oscs.push(lfo);
    }
    g.connect(dest);
    const end = this.env(g, t, peak, dur, type === 'organ' ? 0.01 : a, rel);
    for (const o of oscs) { o.start(t); o.stop(end); }
  }

  gtr(t, root, dur, v, mute) {
    const c = this.c;
    const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = mute ? 650 : 4500;
    const oscs = [];
    for (const iv of [0, 7, 12]) {
      for (const d of [-8, 8]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(root + iv); o.detune.value = d + (R() - 0.5) * 6;
        o.connect(lp); oscs.push(o);
      }
    }
    lp.connect(g); g.connect(this.ch.gtr);
    const end = mute ? this.env(g, t, 0.5 * v, dur * 0.6, 0.002, 0.05, 0.6) : this.env(g, t, 0.5 * v, dur, 0.003, 0.07, 0.85);
    for (const o of oscs) { o.start(t); o.stop(end); }
  }

  stab(t, notes, dur, v, type) {
    const c = this.c, g = c.createGain();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    const oscs = [];
    const peak = 0.13 * v * 3 / Math.max(3, notes.length);
    for (const m of notes) {
      const f = mtof(m);
      if (type === 'organ') {
        for (const [r, w, amp] of [[1, 'square', 0.35], [2, 'sine', 0.7], [0.5, 'sine', 0.6]]) {
          const o = c.createOscillator(); o.type = w; o.frequency.value = f * r;
          const gg = c.createGain(); gg.gain.value = amp; o.connect(gg); gg.connect(lp); oscs.push(o);
        }
      } else if (type === 'rave') {
        for (const d of [-12, 0, 12]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); oscs.push(o); }
      } else {
        for (const [w, d, amp] of [['triangle', 0, 1], ['square', 5, 0.25], ['sine', 1200, 0.3]]) {
          const o = c.createOscillator(); o.type = w; o.frequency.value = f; o.detune.value = d;
          const gg = c.createGain(); gg.gain.value = amp; o.connect(gg); gg.connect(lp); oscs.push(o);
        }
      }
    }
    if (type === 'rave') { lp.Q.value = 3; lp.frequency.setValueAtTime(5500, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.25); }
    else if (type === 'organ') lp.frequency.value = 3500;
    else { lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(1200, t + 0.4); }
    lp.connect(g); g.connect(this.ch.stab);
    const end = type === 'organ' ? this.env(g, t, peak, dur * 0.8, 0.004, 0.04) : this.env(g, t, peak, dur, 0.003, 0.18, 0.45);
    for (const o of oscs) { o.start(t); o.stop(end); }
  }
}

// ===================================================================== crowd voices (cheers, boos, oohs, chants)
function formantBank(E, dest, shift = 1, makeup = 3) {
  const c = E.ctx, inp = c.createGain(), out = c.createGain();
  out.gain.value = makeup;
  const bps = [0, 1, 2].map(i => {
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [5, 7, 9][i]; bp.frequency.value = VOWELS.a[i] * shift;
    const g = c.createGain(); g.gain.value = [1, 0.5, 0.24][i];
    inp.connect(bp); bp.connect(g); g.connect(out);
    return bp;
  });
  out.connect(dest);
  return {
    inp, out,
    set(t, v, tc = 0.02) { const F = VOWELS[v] || VOWELS.a; bps.forEach((bp, i) => bp.frequency.setTargetAtTime(F[i] * shift, t, tc)); },
    now(t, v) { const F = VOWELS[v] || VOWELS.a; bps.forEach((bp, i) => bp.frequency.setValueAtTime(F[i] * shift, t)); },
    kill() { try { inp.disconnect(); out.disconnect(); bps.forEach(b => b.disconnect()); } catch (e) { /* ok */ } },
  };
}

// a crowd "reaction": n voices on one vowel with a pitch contour; contour = [[timeFrac, semis], ...]
function crowdVoices(E, t, { n = 8, f0 = 150, spread = 0.25, vowel = 'a', vowel2 = null, dur = 1.5, contour = [[0, 0], [1, 0]], vol = 0.3, attack = 0.15, dest } = {}) {
  const c = E.ctx;
  dest = dest || E.ambBus;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  lp.connect(dest);
  const vs = c.createGain(); vs.gain.value = 0.5; lp.connect(vs); vs.connect(E.ambVerb);
  const bank = formantBank(E, lp, 1, 3.2);
  bank.now(t, vowel);
  if (vowel2) bank.set(t + dur * 0.45, vowel2, dur * 0.15);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(bank.inp);
  const oscs = [];
  for (let i = 0; i < n; i++) {
    const o = c.createOscillator(); o.type = 'sawtooth';
    const base = f0 * Math.pow(2, (R() - 0.5) * spread * 2);
    const jt = R() * 0.08;
    o.frequency.setValueAtTime(base * Math.pow(2, contour[0][1] / 12), t);
    for (const [fr, st] of contour.slice(1)) o.frequency.linearRampToValueAtTime(base * Math.pow(2, st / 12), t + jt + fr * dur);
    const vg = c.createGain(); vg.gain.value = 0.28 + R() * 0.12;
    o.connect(vg); vg.connect(g);
    o.start(t + jt); o.stop(t + dur + 0.1);
    oscs.push(o);
  }
  // breath / roar noise layer
  const nz = E.noise(t, dur * 0.6, { vol: vol * 0.5, freq: 900, q: 0.7, attack, hold: dur * 0.3, buf: 'pink', dest: lp });
  void nz;
  setTimeout(() => { bank.kill(); try { lp.disconnect(); vs.disconnect(); g.disconnect(); } catch (e) { /* ok */ } }, (t - c.currentTime + dur + 1) * 1000);
  return oscs;
}

function crowdClap(E, t, v, dest) {
  for (let i = 0; i < 4; i++) E.noise(t + R() * 0.03, 0.05 + R() * 0.03, { vol: v * (0.5 + R() * 0.3), freq: 1100 + R() * 900, q: 1.1, dest: dest || E.ambBus });
}
function terraceDrum(E, t, v, dest) {
  E.tone(t, 0.45, { freq: 88, to: 46, type: 'sine', vol: 0.8 * v, dest: dest || E.ambBus, attack: 0.003 });
  E.noise(t, 0.18, { vol: 0.35 * v, freq: 300, type: 'lowpass', buf: 'brown', dest: dest || E.ambBus });
}
function whistle(E, t, v, pan) {
  const c = E.ctx, o = c.createOscillator(), g = c.createGain();
  const f = 2200 + R() * 1200, d = 0.25 + R() * 0.6;
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  if (R() < 0.5) o.frequency.linearRampToValueAtTime(f * (R() < 0.5 ? 1.25 : 0.8), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.03); g.gain.setValueAtTime(0.05 * v, t + d - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(E.out(pan, E.ambBus)); o.start(t); o.stop(t + d + 0.05);
}

// ---------------------------------------------------------------- supporters' chants (original)
// syllable: b beat, d beats, n semitones over key, v vowel, v2 diphthong target, c consonant, f fall (semis)
const NASAL = new Set(['n', 'm', 'l', 'r', 'w', 'y']);
const CHANTS = {
  // "NORD-HAMN!" clap clap clap  (x3, then a long one)
  nordhamn: (() => {
    const syl = [], claps = [], drum = [];
    for (let r = 0; r < 3; r++) {
      const b = r * 4;
      syl.push({ b, d: 0.85, n: 7, v: 'o', c: 'n', f: 1 }, { b: b + 1, d: 1.1, n: 4, v: 'a', c: 'h', f: 5 });
      claps.push(b + 2, b + 2.5, b + 3); drum.push(b, b + 1, b + 2, b + 2.5, b + 3);
    }
    syl.push({ b: 12, d: 1, n: 7, v: 'o', c: 'n', f: 1 }, { b: 13, d: 2.6, n: 4, v: 'a', c: 'h', f: 7 });
    drum.push(12, 13);
    return { bpm: 120, key: 50, syl, claps, drum, len: 16, roar: 13.5 };
  })(),
  // "AN-CHORS, AN-CHORS, RED AND WHITE ALL NIGHT / AN-CHORS, AN-CHORS, NEV-ER SINK-ING"
  anchors: {
    bpm: 104, key: 50, len: 16,
    syl: [
      { b: 0, d: 0.9, n: 7, v: 'a', c: 'n' }, { b: 1, d: 0.9, n: 4, v: 'o', c: 'ch' }, { b: 2, d: 0.9, n: 7, v: 'a', c: 'n' }, { b: 3, d: 0.9, n: 4, v: 'o', c: 'ch' },
      { b: 4, d: 0.45, n: 5, v: 'e', c: 'r' }, { b: 4.5, d: 0.45, n: 5, v: 'ae' }, { b: 5, d: 0.9, n: 9, v: 'a', v2: 'i', c: 'w' }, { b: 6, d: 0.45, n: 7, v: 'o' }, { b: 6.5, d: 1.3, n: 4, v: 'a', v2: 'i', c: 'n' },
      { b: 8, d: 0.9, n: 7, v: 'a', c: 'n' }, { b: 9, d: 0.9, n: 4, v: 'o', c: 'ch' }, { b: 10, d: 0.9, n: 7, v: 'a', c: 'n' }, { b: 11, d: 0.9, n: 9, v: 'o', c: 'ch' },
      { b: 12, d: 0.45, n: 11, v: 'e', c: 'n' }, { b: 12.5, d: 0.45, n: 9, v: 'er' }, { b: 13, d: 0.9, n: 7, v: 'i', c: 's' }, { b: 14, d: 1.8, n: 0, v: 'i', c: 'n' },
    ],
    claps: [0, 1, 2, 3, 8, 9, 10, 11], drum: [0, 2, 4, 6, 8, 10, 12, 14], high: true,
  },
  // call & response: leader "AN-CHORS!" crowd "HOLD FAST!" (rising key each time)
  holdfast: (() => {
    const syl = [], lead = [], drum = [], claps = [];
    for (let r = 0; r < 3; r++) {
      const b = r * 4, k = r * 2;
      lead.push({ b, d: 0.45, n: 9 + k, v: 'a', c: 'n' }, { b: b + 0.5, d: 0.9, n: 7 + k, v: 'o', c: 'ch', f: 2 });
      syl.push({ b: b + 2, d: 0.8, n: 7 + k, v: 'o', c: 'h' }, { b: b + 3, d: 0.9, n: 4 + k, v: 'ae', c: 's', f: 4 });
      drum.push(b + 2, b + 3); claps.push(b + 3.5);
    }
    return { bpm: 124, key: 50, syl, lead, drum, claps, len: 12, roar: 11 };
  })(),
  // wordless terrace taunt: "LA LA LA..."
  lala: (() => {
    const line = (b0, notes) => notes.map(([b, d, n]) => ({ b: b0 + b, d, n, v: 'a', c: 'l' }));
    const A = [[0, 0.5, 0], [0.5, 0.5, 3], [1, 0.5, 5], [1.5, 0.5, 5], [2, 0.5, 7], [2.5, 0.5, 5], [3, 1, 3]];
    const B = [[0, 0.5, 0], [0.5, 0.5, 3], [1, 0.5, 5], [1.5, 0.5, 7], [2, 0.5, 10], [2.5, 0.5, 7], [3, 1, 5]];
    const C = [[0, 0.5, 7], [0.5, 0.5, 5], [1, 0.5, 3], [1.5, 0.5, 2], [2, 2, 0]];
    const syl = [...line(0, A), ...line(4, B), ...line(8, A), ...line(12, C)];
    const claps = []; for (let i = 0; i < 16; i++) claps.push(i);
    return { bpm: 136, key: 52, syl, claps, drum: [0, 2, 4, 6, 8, 10, 12, 14], len: 16, high: true };
  })(),
};
const CHANT_ORDER = ['nordhamn', 'anchors', 'holdfast', 'lala'];

function singGroup(E, t0, spb, syl, key, { voices = 8, oct = 0, vol = 0.3, shift = 1, dest, bright = 0 } = {}) {
  const c = E.ctx;
  const bank = formantBank(E, dest, shift, 3.4 + bright);
  const first = syl[0];
  bank.now(t0, first.v);
  const lfos = [0, 1].map(i => { const l = c.createOscillator(); l.frequency.value = 4.6 + i * 0.9 + R() * 0.3; const g = c.createGain(); g.gain.value = 11; l.connect(g); l.start(t0); return { l, g }; });
  // consonants & vowel automation (shared by the whole group)
  for (const s of syl) {
    const ts = t0 + s.b * spb;
    if (s.c && NASAL.has(s.c)) { bank.set(ts - 0.01, 'n', 0.008); bank.set(ts + 0.06, s.v, 0.025); }
    else bank.set(ts, s.v, 0.02);
    if (s.v2) bank.set(ts + s.d * spb * 0.55, s.v2, 0.05);
    if (s.c === 'ch') E.noise(ts - 0.02, 0.07, { vol: vol * 0.5, freq: 2800, q: 1.5, dest });
    else if (s.c === 's') E.noise(ts - 0.03, 0.1, { vol: vol * 0.4, freq: 5000, type: 'highpass', dest });
    else if (s.c === 'h') E.noise(ts - 0.03, 0.06, { vol: vol * 0.35, freq: 1400, q: 0.6, buf: 'pink', dest });
  }
  const end = t0 + Math.max(...syl.map(s => s.b + s.d)) * spb + 0.3;
  for (let i = 0; i < voices; i++) {
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.detune.value = (R() - 0.5) * 50;
    lfos[i % 2].g.connect(o.detune);
    const vg = c.createGain(); vg.gain.value = 0;
    const vo = (oct + (R() < 0.15 ? -1 : 0)) * 12;
    const lag = R() * 0.045;
    const amp = vol * (0.65 + R() * 0.25);
    o.frequency.value = mtof(key + first.n + vo);
    for (const s of syl) {
      const ts = t0 + s.b * spb + lag + R() * 0.012, d = s.d * spb;
      const f = mtof(key + s.n + vo) * (1 + (R() - 0.5) * 0.012);
      o.frequency.setTargetAtTime(f * 0.96, ts - 0.015, 0.006);
      o.frequency.setTargetAtTime(f, ts + 0.01, 0.03);
      if (s.f) o.frequency.setTargetAtTime(f * Math.pow(2, -s.f / 12), ts + d * 0.5, d * 0.3);
      vg.gain.setTargetAtTime(amp, ts, 0.02);
      vg.gain.setTargetAtTime(0, ts + d * 0.88, 0.045);
    }
    o.connect(vg); vg.connect(bank.inp);
    o.start(t0 - 0.05); o.stop(end + 0.3);
  }
  for (const { l } of lfos) l.stop(end + 0.3);
  setTimeout(() => bank.kill(), (end - c.currentTime + 1.2) * 1000);
}

const Chants = {
  busyUntil: 0, idx: 0, live: 0,
  play(E, intensity = 0.7, which) {
    const c = E.ctx;
    if (!c || c.state !== 'running') return;
    if (c.currentTime < this.busyUntil) return;
    const id = which || CHANT_ORDER[this.idx++ % CHANT_ORDER.length];
    const ch = CHANTS[id];
    if (!ch) return;
    const t0 = c.currentTime + 0.15, spb = 60 / ch.bpm;
    const vol = 0.065 + 0.08 * clamp(intensity, 0, 1);
    const out = c.createGain(); out.gain.value = 1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    out.connect(lp); lp.connect(E.ambBus);
    const vs = c.createGain(); vs.gain.value = 0.55; lp.connect(vs); vs.connect(E.ambVerb);
    singGroup(E, t0, spb, ch.syl, ch.key, { voices: 9, vol, dest: out });
    if (ch.high) singGroup(E, t0, spb, ch.syl, ch.key, { voices: 4, oct: 1, vol: vol * 0.55, shift: 1.12, dest: out });
    if (ch.lead) {
      const p = c.createStereoPanner ? c.createStereoPanner() : null;
      if (p) { p.pan.value = 0.35; p.connect(out); }
      singGroup(E, t0, spb, ch.lead, ch.key, { voices: 1, vol: vol * 1.3, shift: 1.05, dest: p || out, bright: 1 });
    }
    for (const b of ch.claps || []) crowdClap(E, t0 + b * spb, vol * 0.8, out);
    for (const b of ch.drum || []) terraceDrum(E, t0 + b * spb, vol * 1.1, out);
    if (ch.roar !== undefined) crowdVoices(E, t0 + ch.roar * spb, { n: 6, f0: 170, vowel: 'a', vowel2: 'e', dur: 2.2, contour: [[0, 0], [0.4, 3], [1, -2]], vol: vol * 0.7, attack: 0.3, dest: out });
    const len = ch.len * spb + 1.5;
    this.busyUntil = c.currentTime + len;
    this.live++;
    setTimeout(() => { this.live--; try { out.disconnect(); lp.disconnect(); vs.disconnect(); } catch (e) { /* ok */ } }, (len + 2.5) * 1000);
  },
};

// ===================================================================== crowd bed
const STADIUM = new Set(['awayend', 'derby', 'laststand']);
const LEVEL_TRACKS = new Set(['streets', 'pub', 'underground', 'awayend', 'city', 'industrial', 'derby', 'laststand']);

const Crowd = {
  E: null, nodes: null, srcs: [], level: 0, raw: 0, base: 0, awaitBase: false, track: null, tickFn: null,
  nextSwell: 0, nextWhistle: 0, nextClap: 0, nextReact: 0, nextChant: 0, lastReact: 0, offSince: 0,

  onTrack(E, id) {
    this.E = E; this.track = id;
    this.awaitBase = LEVEL_TRACKS.has(id);
    if (!this.awaitBase) this.base = 0;
  },
  effective(raw) {
    if (raw <= 0 || this.track === 'title') return 0;   // attract-mode demo fights stay crowd-free
    const stadium = STADIUM.has(this.track) || this.base > 0;
    if (!stadium) return raw * 0.3;                // street levels: distant match-day murmur only
    return Math.max(raw, this.base * 0.9);
  },
  set(E, raw) {
    this.E = E;
    if (this.awaitBase) { this.base = raw; this.awaitBase = false; }
    this.raw = raw;
    const lvl = this.effective(raw);
    const was = this.level;
    this.level = lvl;
    if (lvl > 0 && !this.nodes) this.build();
    if (!this.nodes) return;
    const t = E.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(lvl > 0 ? 0.35 + 1.0 * lvl : 0.0001, t, lvl > was ? 0.6 : 1.0);
    if (lvl > 0 && this.nextChant < t + 4 && lvl > 0.5) this.nextChant = t + 5 + R() * 6;
    if (lvl > was + 0.25 && lvl > 0.4) this.cheer(t + 0.1, Math.min(1, lvl));
    this.offSince = lvl > 0 ? 0 : t;
  },
  loop(buf, { type = 'bandpass', freq = 500, q = 0.7, gain = 0.3, pan = 0, rate = 1 }) {
    const E = this.E, c = E.ctx;
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g);
    let last = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; this.nodes.push(p); }
    last.connect(this.mix);
    s.start(c.currentTime, R() * 2);
    this.srcs.push(s); this.nodes.push(f, g);
    return g;
  },
  build() {
    const E = this.E, c = E.ctx;
    this.nodes = []; this.srcs = [];
    this.out = c.createGain(); this.out.gain.value = 0.0001;
    this.mix = c.createGain(); this.mix.gain.value = 1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
    this.mix.connect(lp); lp.connect(this.out); this.out.connect(E.ambBus);
    const vs = c.createGain(); vs.gain.value = 0.35; this.out.connect(vs); vs.connect(E.ambVerb);
    this.nodes.push(this.out, this.mix, lp, vs);
    this.loop(E.pinkBuf, { freq: 380, q: 0.8, gain: 0.5, pan: -0.6 });
    this.loop(E.pinkBuf, { freq: 440, q: 0.8, gain: 0.5, pan: 0.6, rate: 0.97 });
    this.loop(E.brownBuf, { type: 'lowpass', freq: 170, gain: 0.35 });
    this.loop(E.noiseBuf, { type: 'highpass', freq: 2600, gain: 0.025 });
    // roar layer through vowel formants, swelled by events
    this.roar = c.createGain(); this.roar.gain.value = 0.35;
    const roarSrc = c.createBufferSource(); roarSrc.buffer = E.pinkBuf; roarSrc.loop = true;
    VOWELS.a.forEach((f, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = [3, 4, 5][i];
      const g = c.createGain(); g.gain.value = [1.6, 0.9, 0.45][i];
      roarSrc.connect(bp); bp.connect(g); g.connect(this.roar);
      this.nodes.push(bp, g);
    });
    this.roar.connect(this.mix); this.nodes.push(this.roar);
    roarSrc.start(c.currentTime, R()); this.srcs.push(roarSrc);
    const t = c.currentTime;
    this.nextSwell = t + 2; this.nextWhistle = t + 3; this.nextClap = t + 12 + R() * 10; this.nextReact = t + 8 + R() * 8;
    this.tickFn = () => this.tick();
    E.addTicker(this.tickFn);
  },
  teardown() {
    if (!this.nodes) return;
    this.E.removeTicker(this.tickFn);
    for (const s of this.srcs) { try { s.stop(); } catch (e) { /* ok */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ok */ } }
    this.nodes = null; this.srcs = [];
  },
  tick() {
    const E = this.E, c = E.ctx, t = c.currentTime, L = this.level;
    if (L <= 0) { if (this.offSince && t - this.offSince > 4) this.teardown(); return; }
    if (c.state !== 'running') return;
    if (t > this.nextSwell) {
      const peak = 0.3 + R() * 0.5 * L + (R() < 0.15 ? 0.6 * L : 0);
      this.roar.gain.setTargetAtTime(peak, t, 0.5 + R() * 0.6);
      this.roar.gain.setTargetAtTime(0.25 + 0.2 * L, t + 1.2 + R() * 2, 1.2);
      this.nextSwell = t + 3 + R() * 6;
    }
    if (t > this.nextWhistle) { whistle(E, t + 0.05, 0.4 + L * 0.6, (R() - 0.5) * 1.6); this.nextWhistle = t + (3 + R() * 10) / (0.3 + L); }
    if (L > 0.35 && t > this.nextClap) {
      const n = 8 + ((R() * 8) | 0), rate = 0.42 + R() * 0.06;
      for (let i = 0; i < n; i++) crowdClap(E, t + 0.1 + i * rate * (1 - i * 0.01), 0.22 * L);
      this.nextClap = t + 25 + R() * 25;
    }
    if (t > this.nextReact) {
      const r = R();
      if (r < 0.55) this.cheer(t + 0.05, 0.4 + 0.5 * L);
      else if (r < 0.8) this.boo(t + 0.05, 0.4 + 0.4 * L);
      else this.ooh(t + 0.05, 0.5 + 0.4 * L);
      this.nextReact = t + 12 + R() * 18;
    }
    if (L > 0.5 && t > this.nextChant) {
      Chants.play(E, L);
      this.nextChant = t + 18 + R() * 20;
      this.nextReact = Math.max(this.nextReact, t + 14);
    }
  },
  // reactions (also used by sfx crowdCheer/crowdBoo/crowdOoh)
  cheer(t, v) {
    const E = this.E || audio;
    crowdVoices(E, t, { n: 7, f0: 210, spread: 0.45, vowel: 'a', vowel2: 'e', dur: 2.2, contour: [[0, -3], [0.25, 2], [1, -1]], vol: 0.22 * v, attack: 0.25 });
    for (let i = 0; i < 3; i++) whistle(E, t + 0.2 + R() * 0.8, v, (R() - 0.5) * 1.6);
  },
  boo(t, v) { crowdVoices(this.E || audio, t, { n: 8, f0: 125, spread: 0.3, vowel: 'u', vowel2: 'o', dur: 2.0, contour: [[0, 0], [0.6, -1], [1, -4]], vol: 0.22 * v, attack: 0.3 }); },
  ooh(t, v) { crowdVoices(this.E || audio, t, { n: 7, f0: 170, spread: 0.3, vowel: 'o', vowel2: 'u', dur: 1.3, contour: [[0, -2], [0.35, 4], [1, -3]], vol: 0.22 * v, attack: 0.12 }); },
  react(kind, v = 1) {
    const E = this.E || audio, c = E.ctx; if (!c) return;
    const L = this.level, t = c.currentTime;
    if (L <= 0.25 || t - this.lastReact < 1.4) return;   // street levels (distant murmur only) don't react
    this.lastReact = t;
    if (kind === 'ko') { if (R() < 0.45) (R() < 0.6 ? this.cheer(t + 0.05, 0.35 + 0.4 * L) : this.ooh(t + 0.05, 0.4 + 0.4 * L)); }
    else if (kind === 'bossKO' || kind === 'win') { this.cheer(t + 0.1, 1); if (L > 0.3) { this.nextChant = t + 3; } }
    else if (kind === 'down') this.ooh(t + 0.05, 0.8);
    else if (kind === 'clear' && L > 0.3) this.cheer(t + 0.05, 0.5 * L);
  },
};

// ===================================================================== background ambience (street/pub/underground/industrial)
const AMB_FOR = { streets: 'street', city: 'street', pub: 'pub', underground: 'underground', industrial: 'industrial', awayend: 'stadium', derby: 'stadium', laststand: 'stadium' };

const Amb = {
  E: null, kind: null, nodes: null, srcs: [], oscs: [], tickFn: null, nx: {}, rainG: null, windG: null, weatherT: 0, weather: null,
  set(E, kind) {
    this.E = E;
    if (kind === this.kind) return;
    this.teardown();
    this.kind = kind || null;
    if (!kind) return;
    const c = E.ctx;
    this.nodes = []; this.srcs = []; this.oscs = []; this.nx = {};
    this.out = c.createGain();
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.gain.setTargetAtTime(1, c.currentTime + 0.3, 0.8);
    this.out.connect(E.ambBus);
    const vs = c.createGain(); vs.gain.value = 0.3; this.out.connect(vs); vs.connect(E.ambVerb);
    this.nodes.push(this.out, vs);
    const L = (buf, o) => this.loop(buf, o);
    // weather layers exist for every kind (silent until the level's weather asks for them)
    this.rainG = c.createGain(); this.rainG.gain.value = 0.0001; this.rainG.connect(this.out); this.nodes.push(this.rainG);
    L(E.noiseBuf, { type: 'bandpass', freq: 5200, q: 0.4, gain: 0.07, dest: this.rainG });
    L(E.pinkBuf, { type: 'bandpass', freq: 900, q: 0.6, gain: 0.09, dest: this.rainG, rate: 0.9 });
    this.windG = c.createGain(); this.windG.gain.value = 0.0001; this.windG.connect(this.out); this.nodes.push(this.windG);
    this.windF = L(E.pinkBuf, { type: 'bandpass', freq: 420, q: 1.6, gain: 0.25, dest: this.windG });
    if (kind === 'street') {
      this.traffic = L(E.brownBuf, { type: 'lowpass', freq: 150, gain: 0.32 });
      L(E.pinkBuf, { type: 'bandpass', freq: 260, q: 0.5, gain: 0.05, rate: 0.8 });
    } else if (kind === 'pub') {
      this.murmur = L(E.pinkBuf, { type: 'bandpass', freq: 520, q: 1.4, gain: 0.16, pan: -0.4 });
      this.murmur2 = L(E.pinkBuf, { type: 'bandpass', freq: 1400, q: 2, gain: 0.07, pan: 0.4, rate: 1.05 });
      L(E.brownBuf, { type: 'lowpass', freq: 120, gain: 0.12 });
    } else if (kind === 'underground') {
      L(E.brownBuf, { type: 'lowpass', freq: 85, gain: 0.45 });
      L(E.pinkBuf, { type: 'bandpass', freq: 300, q: 3, gain: 0.025, rate: 0.6 });
    } else if (kind === 'industrial') {
      L(E.brownBuf, { type: 'lowpass', freq: 120, gain: 0.3 });
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
      const g = c.createGain(); g.gain.value = 0.03;
      o.connect(lp); lp.connect(g); g.connect(this.out); o.start(); this.oscs.push(o); this.nodes.push(lp, g);
    } else if (kind === 'stadium') {
      L(E.brownBuf, { type: 'lowpass', freq: 200, gain: 0.12 });
    }
    this.weatherT = 0; this.weather = undefined;
    this.tickFn = () => this.tick();
    E.addTicker(this.tickFn);
  },
  loop(buf, { type = 'bandpass', freq = 500, q = 0.7, gain = 0.2, pan = 0, rate = 1, dest }) {
    const c = this.E.ctx;
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g);
    let last = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; this.nodes.push(p); }
    last.connect(dest || this.out);
    s.start(c.currentTime, R() * 2);
    this.srcs.push(s); this.nodes.push(f, g);
    return g;
  },
  teardown() {
    if (!this.nodes) { this.kind = null; return; }
    const E = this.E, c = E.ctx, t = c.currentTime;
    E.removeTicker(this.tickFn);
    const out = this.out, nodes = this.nodes, srcs = this.srcs, oscs = this.oscs;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
    out.gain.setTargetAtTime(0.0001, t, 0.15);
    setTimeout(() => {
      for (const s of srcs) { try { s.stop(); } catch (e) { /* ok */ } }
      for (const o of oscs) { try { o.stop(); } catch (e) { /* ok */ } }
      for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ok */ } }
    }, 900);
    this.nodes = null; this.srcs = []; this.oscs = []; this.kind = null;
  },
  readWeather() {
    try {
      const h = typeof window !== 'undefined' && window.__hooligan;
      const w = h && h.world;
      if (w && w.level) return w.level.weather || null;
    } catch (e) { /* ok */ }
    return this.kind === 'street' && Crowd.track === 'streets' ? 'rain' : null;
  },
  tick() {
    const E = this.E, c = E.ctx, t = c.currentTime;
    if (c.state !== 'running' || !this.nodes) return;
    if (t > this.weatherT) {
      this.weatherT = t + 1;
      const w = this.readWeather();
      if (w !== this.weather) {
        this.weather = w;
        this.rainG.gain.setTargetAtTime(w === 'rain' ? 1 : 0.0001, t, 1.2);
        this.windG.gain.setTargetAtTime(w === 'snow' ? 1 : 0.0001, t, 1.5);
      }
      if (w === 'snow') this.windF.gain.setTargetAtTime(0.12 + R() * 0.25, t, 1.5);
    }
    const nx = this.nx, due = (k, lo, hi) => { if (nx[k] === undefined) { nx[k] = t + lo * 0.5 + R() * (hi - lo) * 0.5; return false; } if (t < nx[k]) return false; nx[k] = t + lo + R() * (hi - lo); return true; };
    const A = this.out;
    if (this.weather === 'rain' && due('drip', 0.3, 1.5)) E.tone(t + 0.02, 0.05, { freq: 1800 + R() * 2200, to: 900, type: 'sine', vol: 0.025, dest: A, pan: (R() - 0.5) * 1.6 });
    switch (this.kind) {
      case 'street':
        if (due('car', 5, 14)) this.carPass(t + 0.05);
        if (due('siren', 35, 80)) this.siren(t + 0.1);
        if (due('traffic', 3, 7)) this.traffic.gain.setTargetAtTime(0.18 + R() * 0.3, t, 1.5);
        if (due('dog', 40, 90)) E.playSfx('bark', t, (R() - 0.5) * 1.6, 0.18, 1);
        break;
      case 'pub':
        if (due('clink', 1.5, 5)) for (let i = 0; i < 1 + (R() * 2 | 0); i++) E.metal(t + i * 0.08, { base: 2200 + R() * 1800, ratios: [1, 2.3], dur: 0.25, vol: 0.025, dest: E.out((R() - 0.5) * 1.4, A) });
        if (due('laugh', 9, 24)) { const p = (R() - 0.5) * 1.4, f = 150 + R() * 90; for (let i = 0; i < 3 + (R() * 3 | 0); i++) E.vox(t + i * 0.13, 0.1, { f0: f - i * 6, f1: f - 20 - i * 6, vowel: 'a', vol: 0.05, dest: E.out(p, A) }); }
        if (due('murmur', 2, 5)) { this.murmur.gain.setTargetAtTime(0.1 + R() * 0.12, t, 0.8); this.murmur2.gain.setTargetAtTime(0.04 + R() * 0.06, t, 0.6); }
        break;
      case 'underground':
        if (due('drip', 1, 4)) E.tone(t + 0.02, 0.07, { freq: 1100 + R() * 900, to: 520, type: 'sine', vol: 0.05, dest: E.out((R() - 0.5) * 1.6, A) });
        if (due('train', 28, 60)) this.train(t + 0.1);
        break;
      case 'industrial':
        if (due('clank', 2, 7)) E.metal(t + 0.02, { base: 200 + R() * 400, ratios: [1, 1.47, 2.09, 2.76], dur: 0.6, vol: 0.04, dest: E.out((R() - 0.5) * 1.6, A) });
        if (due('steam', 8, 20)) E.noise(t + 0.05, 0.8, { vol: 0.05, freq: 4000, type: 'highpass', attack: 0.06, hold: 0.4 + R() * 0.8, dest: E.out((R() - 0.5) * 1.4, A) });
        if (due('hydraulic', 12, 30)) E.tone(t + 0.05, 0.9, { freq: 90, to: 140, type: 'sawtooth', vol: 0.025, attack: 0.2, dest: A });
        break;
      case 'stadium':
        if (due('pa', 50, 110)) { E.tone(t + 0.05, 0.4, { freq: 659, type: 'sine', vol: 0.04, dest: A }); E.tone(t + 0.45, 0.6, { freq: 523, type: 'sine', vol: 0.04, dest: A }); }
        break;
    }
  },
  carPass(t) {
    const E = this.E, c = E.ctx, dur = 2.2 + R() * 1.5, dir = R() < 0.5 ? 1 : -1;
    const s = c.createBufferSource(); s.buffer = E.brownBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(520, t + dur * 0.5); f.frequency.linearRampToValueAtTime(220, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g);
    let last = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.setValueAtTime(-0.9 * dir, t); p.pan.linearRampToValueAtTime(0.9 * dir, t + dur); g.connect(p); last = p; }
    last.connect(this.out);
    // tyres on wet road
    if (this.weather === 'rain') E.noise(t + dur * 0.25, dur * 0.4, { vol: 0.05, freq: 3000, q: 0.5, attack: dur * 0.2, dest: this.out });
    s.start(t, R() * 2); s.stop(t + dur + 0.1);
  },
  siren(t) {
    const E = this.E, c = E.ctx, dur = 6 + R() * 3;
    const o = c.createOscillator(); o.type = 'triangle';
    const hi = 940 + R() * 60, lo = hi * 0.75;
    for (let i = 0; i * 0.55 < dur; i++) o.frequency.setValueAtTime(i % 2 ? lo : hi, t + i * 0.55);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g);
    const p = E.out((R() - 0.5) * 1.6, this.out);
    g.connect(p);
    const s = c.createGain(); s.gain.value = 0.8; g.connect(s); s.connect(E.ambVerb);
    o.start(t); o.stop(t + dur + 0.1);
  },
  train(t) {
    const E = this.E, dur = 7;
    E.noise(t, dur * 0.5, { vol: 0.35, freq: 140, type: 'lowpass', attack: dur * 0.4, hold: 1, buf: 'brown', dest: this.out });
    E.noise(t + dur * 0.3, dur * 0.3, { vol: 0.04, freq: 2600, q: 8, attack: 1, buf: 'pink', dest: this.out });
    for (let i = 0; i < 8; i++) E.thump(t + dur * 0.25 + i * 0.32 + (i % 2) * 0.12, { f0: 90, f1: 55, dur: 0.12, vol: 0.06, dest: this.out });
  },
};

// ===================================================================== install
audio.registerSongs(SONGS);

audio.songPlayer = (E, id) => {
  const song = getSong(id) || getSong('streets');
  const p = new Player(E, id, song);
  Crowd.onTrack(E, id);
  const ambKind = E.ambienceOverride !== undefined ? E.ambienceOverride : (AMB_FOR[id] || null);
  Amb.set(E, ambKind);
  return {
    stop() { p.stop(); Amb.set(E, null); },
    setBoss(on) { p.setBoss(on); },
    player: p,
  };
};

audio.crowdHook = (E, level) => Crowd.set(E, level);
audio.chantHook = E => Chants.play(E, Math.max(0.5, Crowd.level));
audio.crowdReact = (kind, v) => Crowd.react(kind, v);
audio.crowdFx = {
  cheer: (t, v = 1) => { Crowd.E = Crowd.E || audio; Crowd.cheer(t, v); },
  boo: (t, v = 1) => { Crowd.E = Crowd.E || audio; Crowd.boo(t, v); },
  ooh: (t, v = 1) => { Crowd.E = Crowd.E || audio; Crowd.ooh(t, v); },
};
audio.ambienceHook = (E, kind) => Amb.set(E, kind === undefined ? (AMB_FOR[E.track] || null) : kind);
audio.statsHook = () => ({ players: livePlayers, crowdBed: !!Crowd.nodes, crowdLevel: +Crowd.level.toFixed(2), ambience: Amb.kind, chantsLive: Chants.live });
audio.chantNamed = id => { if (audio.ctx) Chants.play(audio, Math.max(0.5, Crowd.level), id); };
audio.customSfx = audio.customSfx || {};
// expose built-ins that content code probes for via customSfx (e.g. the away-end steward's whistle)
for (const k of ['whistle', 'siren', 'bell', 'explosion', 'splash', 'train']) {
  if (!audio.customSfx[k]) audio.customSfx[k] = (e, t, o) => e.playSfx(k, t, o.pan, o.vol, o.pitch);
}

export default audio;

// Tour arenas (src/content/arenas/<id>/music.js) bring their own song: registers it as a level track (crowd bed waits
// for the level's crowd value) and, for grounds, as a stadium (louder crowd, chants).
export function registerTrack(id, song, { stadium = true } = {}) {
  audio.registerSongs({ [id]: song });
  LEVEL_TRACKS.add(id);
  if (stadium) STADIUM.add(id);
}
