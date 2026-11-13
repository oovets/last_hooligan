// THE DEN — "COLD BLOW STOMP": an original, menacing terrace stomp in D minor (low pick bass, a dark organ pad and a
// square-wave lead that keeps circling the same few notes) that turns into a skanking punk charge for the boss,
// THE DOCKER. Original composition (no real melodies quoted).
import { registerTrack } from '../../../audio/music.js';

// the stomp: big kick on one and three, claps on the backbeat, a hi-hat that never lets up (lanes as in music.js DRUMS)
const STOMP = { k: 'X.......X..x....', c: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', b: 'X.......X.......' };

registerTrack('theden', {
  bpm: 124, inst: { bass: 'pick', lead: 'square', arp: 'pluck', pad: 'organ' },
  sections: {
    intro: { bars: 4, chords: 'Dm Dm Bb A', drums: STOMP, fill: 'roll', pad: 1, gtr: 'hold', crash: false,
      lead: 'D5 - - - - - - - | F5 - - - E5 - - - | D5 - - - C5 - Bb4 - | A4 - - - - - . .' },
    A: {
      bars: 8, chords: 'Dm C Bb A Dm C Gm A', drums: STOMP, fill: 'fill', bass: 'drive8', gtr: 'punk8', arp: 'up8',
      lead: 'D5 - D5 - F5 - E5 D5 | C5 - - - E5 - G5 - | F5 - E5 - D5 - Bb4 - | A4 - - - C#5 - E5 - | D5 - F5 - A5 - G5 F5 | E5 - - - C5 - E5 - | D5 - Bb4 - G4 - Bb4 D5 | C#5 - - - A4 - - -',
    },
    B: {
      bars: 8, chords: 'Bb C Dm Dm Bb C A A', drums: 'anthem', fill: 'fillT', bass: 'oct', gtr: 'half', pad: 1, inst: { lead: 'pulse' },
      lead: 'F5 - - - G5 - A5 - | G5 - - - E5 - C5 - | D5 - F5 - A5 - - - | A5 - G5 - F5 - D5 - | F5 - - - G5 - Bb5 - | C6 - - - Bb5 - G5 - | A5 - - - G5 - E5 - | C#5 - - - - - . .',
    },
    C: {
      bars: 4, chords: 'Gm Dm Bb A', drums: 'halftimeBig', fill: 'roll', bass: 'half', pad: 1, arp: 'updown8', leadRate: 4,
      lead: 'G5 - Bb5 A5 | F5 - - - | D5 - F5 Bb5 | A5 - - -',
    },
  },
  order: ['intro', 'A', 'B', 'A', 'C', 'B'], loopFrom: 1,
  boss: {
    bpm: 168, inst: { lead: 'gtr', bass: 'pick' },
    sections: {
      X: {
        bars: 8, chords: 'Dm C Bb A Dm C Gm A', drums: 'skank', fill: 'fill', bass: 'gallop', gtr: 'chug8', arp: 'up16',
        lead: 'D5 - D5 - F5 - E5 D5 | C5 - - - E5 - G5 - | F5 - E5 - D5 - Bb4 - | A4 - - - C#5 - E5 - | D5 - F5 - A5 - G5 F5 | E5 - - - C5 - E5 - | D5 - Bb4 - G4 - Bb4 D5 | C#5 - - - A4 - - -',
      },
      Y: {
        bars: 8, chords: 'Bb C Dm Dm Bb C A A', drums: 'dbeat', fill: 'fillT', bass: 'roll16', gtr: 'gallop', pad: 1, inst: { lead: 'saw' },
        lead: 'F5 - - - G5 - A5 - | G5 - - - E5 - C5 - | D5 - F5 - A5 - - - | A5 - G5 - F5 - D5 - | F5 - - - G5 - Bb5 - | C6 - - - Bb5 - G5 - | A5 - - - G5 - E5 - | C#5 - - - - - . .',
      },
      Z: {
        bars: 4, chords: 'Dm Dm Bb A', drums: STOMP, fill: 'roll', bass: 'stomp', gtr: 'hold', pad: 1, inst: { lead: 'square' },
        lead: 'D5 - - - F5 - E5 - | D5 - - - A5 - G5 - | F5 - E5 - D5 - C5 - | C#5 - - - - - . .',
      },
    },
    order: ['X', 'Y', 'Z'],
  },
});
