// IBROX — "HORIZONTAL RAIN": original level song (A minor, a reel-ish whistle lead over terrace punk).
// Boss: "THE RIVET" — the same tunes, faster and heavier, with a stomping half-time breakdown.
import { registerTrack } from '../../../audio/music.js';

// a terrace stomp with a rattling snare on the off-beats (inline pattern; lanes as in music.js DRUMS)
const REEL = { k: 'X..x..X.X..x..X.', s: '....X.......X..o', h: 'x.x.x.x.x.x.x.x.', b: 'X.......X.......' };
const STOMP = { k: 'X.......X.x.....', c: '....X.......X...', b: 'X...............', h: '..x...x...x...x.' };

registerTrack('ibrox', {
  bpm: 146, inst: { bass: 'pick', lead: 'whistle', arp: 'pluck', pad: 'organ', lead2: 'square' },
  sections: {
    intro: { bars: 4, chords: 'Am G Am E', drums: 'terrace', fill: 'roll', gtr: 'hold', pad: 1, crash: false,
      lead2: 'A4 - - - - - - - | G4 - - - - - - - | A4 - - - C5 - B4 - | G#4 - - - - - . .' },
    A: {
      bars: 8, chords: 'Am G C G Am G Em Am', drums: REEL, fill: 'fill', bass: 'drive8', gtr: 'punk8', arp: 'up16',
      lead: 'E5 - A5 - G5 E5 D5 - | D5 - B4 - G4 - B4 D5 | E5 - G5 - E5 D5 C5 - | B4 - D5 - - - . . | E5 - A5 - B5 A5 G5 E5 | D5 - E5 - G5 - A5 - | B5 - A5 G5 E5 - D5 - | A4 - - - E5 - - -',
    },
    B: {
      bars: 8, chords: 'F G Am Am F G E E', drums: 'anthem', fill: 'fillT', bass: 'drive8', gtr: 'half', pad: 1, inst: { lead: 'pulse' },
      lead: 'C6 - - - B5 - A5 - | B5 - - - G5 - D5 - | E5 - - - A5 - - - | C6 - B5 - A5 - E5 - | C6 - - - D6 - C6 - | B5 - - - G5 - - - | G#5 - - - B5 - - - | E5 - - - - - . .',
    },
    C: {
      bars: 4, chords: 'Dm Am Dm E', drums: 'halftimeBig', fill: 'fillT', bass: 'half', pad: 1, arp: 'updown8', leadRate: 4,
      lead: 'F5 - E5 D5 | C5 - - - | F5 - A5 G5 | G#5 - - -',
    },
  },
  order: ['intro', 'A', 'B', 'A', 'C', 'B'], loopFrom: 1,
  boss: {
    bpm: 172, transpose: 2, inst: { lead: 'gtr' },
    sections: {
      X: {
        bars: 8, chords: 'Am G C G Am G Em Am', drums: 'skank', fill: 'fill', bass: 'drive8', gtr: 'chug8', arp: 'up16',
        lead: 'E5 - A5 - G5 E5 D5 - | D5 - B4 - G4 - B4 D5 | E5 - G5 - E5 D5 C5 - | B4 - D5 - - - . . | E5 - A5 - B5 A5 G5 E5 | D5 - E5 - G5 - A5 - | B5 - A5 G5 E5 - D5 - | A4 - - - E5 - - -',
      },
      Y: {
        bars: 8, chords: 'F G Am Am F G E E', drums: 'dbeat', fill: 'fillT', bass: 'gallop', gtr: 'gallop', pad: 1, inst: { lead: 'saw' },
        lead: 'C6 - - - B5 - A5 - | B5 - - - G5 - D5 - | E5 - - - A5 - - - | C6 - B5 - A5 - E5 - | C6 - - - D6 - C6 - | B5 - - - G5 - - - | G#5 - - - B5 - - - | E5 - - - - - . .',
      },
      Z: {
        bars: 4, chords: 'Am Am F E', drums: STOMP, fill: 'roll', bass: 'stomp', gtr: 'hold', pad: 1, inst: { lead: 'whistle' },
        lead: 'A5 - - - G5 - E5 - | A5 - - - C6 - B5 - | A5 - G5 - F5 - E5 - | E5 - - - - - . .',
      },
    },
    order: ['X', 'Y', 'Z'],
  },
});
