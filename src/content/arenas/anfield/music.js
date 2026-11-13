// ANFIELD — level song (original composition). Jangly beat-group guitar pop played as terrace punk, A major / F# minor,
// a chiming 12-string-ish arp and a whistled hook; the boss is a double-time gallop in F# minor with distorted
// guitar. Song format: see src/audio/music.js (SONGS).
import { registerTrack } from '../../../audio/music.js';

registerTrack('anfield', {
  bpm: 146, gain: 1.0, inst: { bass: 'pick', lead: 'pulse', arp: 'pluck', pad: 'organ', lead2: 'whistle' },
  sections: {
    // drizzle and a lone organ, then the tambourine-ish shaker comes in
    intro: { bars: 4, chords: 'F#m D A E', drums: { k: 'X.......X.......', z: '..x...x...x...x.', q: '....x.......x...' }, pad: 1, arp: 'updown8', crash: false },
    A: {
      bars: 8, chords: 'A F#m D E A F#m Bm E', drums: 'rock', fill: 'fill', bass: 'drive8o', gtr: 'push', arp: 'up16',
      lead: 'E5 - C#5 - A4 - B4 C#5 | F#5 - - - E5 - C#5 - | D5 - F#5 - A5 - F#5 E5 | E5 - - - B4 - - - | E5 - C#5 - A4 - B4 C#5 | F#5 - A5 - G#5 - F#5 - | D5 - E5 - F#5 - D5 B4 | B4 - - - . . . .',
    },
    B: {
      bars: 8, chords: 'D E C#m F#m D E B E', drums: 'anthem', fill: 'fillT', bass: 'drive8', gtr: 'half', pad: 1,
      lead: 'A5 - - - F#5 - E5 - | G#5 - - - E5 - B4 - | C#5 - E5 - G#5 - - - | F#5 - - - - - . . | A5 - - - B5 - A5 - | G#5 - E5 - B4 - E5 - | D#5 - F#5 - B5 - A5 - | G#5 - - - E5 - - -',
      lead2: 'F#4 - - - D4 - C#4 - | E4 - - - B3 - G#3 - | A3 - C#4 - E4 - - - | C#4 - - - - - . . | F#4 - - - G#4 - F#4 - | E4 - B3 - G#3 - B3 - | B3 - D#4 - F#4 - D#4 - | E4 - - - B3 - - -',
    },
    // the "stand up" break: half time, everyone clapping along
    C: { bars: 4, chords: 'F#m D E E', drums: { k: 'X.......x.x.....', c: '....X.......X...', b: 'X...............' }, bass: 'half', pad: 1, arp: 'up16', riser: true },
  },
  order: ['intro', 'A', 'B', 'A', 'C', 'B'], loopFrom: 1,
  boss: {
    bpm: 168, inst: { lead: 'gtr', bass: 'pick' },
    sections: {
      X: {
        bars: 8, chords: 'F#m F#m D E F#m F#m Bm C#', drums: 'dbeat', fill: 'fill', bass: 'gallop', gtr: 'gallop', arp: 'up16', leadRate: 16,
        lead: 'F#4 . F#4 A4 . F#4 C#5 . F#4 . E5 . C#5 . A4 G#4 | F#4 . F#4 A4 . C#5 D5 . C#5 . A4 . B4 . G#4 .',
      },
      Y: {
        bars: 8, chords: 'D E F#m F#m D E C# C#', drums: 'skank', fill: 'fillT', bass: 'drive8', gtr: 'chug8', pad: 1, inst: { lead: 'saw' },
        lead: 'A5 - - - G#5 - F#5 - | G#5 - - - E5 - - - | F#5 - - - C#5 - A4 - | C#5 - D5 - C#5 - - - | A5 - - - B5 - C#6 - | B5 - G#5 - E5 - - - | F5 - G#5 - C#6 - B5 - | G#5 - - - F5 - - -',
      },
      Z: { bars: 4, chords: 'Bm C# F#m F#m', drums: 'build', bass: 'half', gtr: 'hold', arp: 'up16', riser: true },
    },
    order: ['X', 'Y', 'X', 'Z'],
  },
});
