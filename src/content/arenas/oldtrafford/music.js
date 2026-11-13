// OLD TRAFFORD — level song (original composition). A baggy Madchester-style shuffle in E minor: loose breakbeat,
// shaker, house-piano stabs and a lazy pulse lead. The boss block turns it into a hoover-and-acid rave at 136 bpm.
import { registerTrack } from '../../../audio/music.js';

const BAGGY = { k: 'X.....x.X.x.....', s: '....X.......X..o', h: 'x.xox.xox.xox.xo', z: 'oooooooooooooooo', o: '..............x.' };
const BAGGY_IN = { k: 'X.......X.......', z: 'oooooooooooooooo', h: '..x...x...x...x.' };

registerTrack('oldtrafford', {
  bpm: 104, inst: { bass: 'pick', lead: 'pulse', arp: 'pluck', pad: 'saw', stab: 'piano' }, padCut: 1400,
  sections: {
    intro: { bars: 4, chords: 'Em Em G D', drums: BAGGY_IN, bass: 'stomp', pad: 1, stab: 'skank', crash: false },
    A: {
      bars: 8, chords: 'Em G D A Em G D Em', drums: BAGGY, fill: 'fill', bass: 'drive8o', stab: 'skank', arp: 'up8',
      lead: 'B4 - D5 E5 - D5 B4 A4 | G4 - - B4 - A4 G4 - | F#4 - A4 D5 - - C#5 - | E5 - - - . . . . | B4 - D5 E5 - G5 F#5 E5 | D5 - B4 - G4 - A4 - | F#4 - - A4 D5 - E5 F#5 | E5 - - - - - . .',
    },
    B: {
      bars: 8, chords: 'C D Em Em C D B B', drums: BAGGY, fill: 'fillT', bass: 'walk', stab: 'rave', pad: 1, inst: { lead: 'square' },
      lead: 'G5 - - E5 - - G5 A5 | F#5 - - D5 - - . . | E5 - G5 - B5 - A5 G5 | E5 - - - - - . . | G5 - - E5 - - G5 A5 | A5 - F#5 - D5 - E5 F#5 | D#5 - - - F#5 - - - | B4 - - - - - . .',
    },
  },
  order: ['intro', 'A', 'B', 'A', 'B'], loopFrom: 1,
  boss: {
    bpm: 136, inst: { lead: 'hoover', bass: 'acid', stab: 'rave' },
    sections: {
      X: {
        bars: 8, chords: 'Em Em C D Em Em C B', drums: 'raveBreak', fill: 'fill', bass: 'acid', stab: 'rave', arp: 'up16',
        lead: 'E5 - E5 G5 - E5 D5 B4 | E5 - - - . . B4 D5 | C5 - E5 - G5 - E5 C5 | D5 - - - F#5 - A5 - | E5 - E5 G5 - E5 D5 B4 | E5 - - - B5 - A5 G5 | C5 - - E5 G5 - - C6 | B5 - - - D#5 - - -',
      },
      Y: {
        bars: 8, chords: 'C D Em Em C D B B', drums: 'breakbeat', fill: 'fillT', bass: 'house', gtr: 'chug8', stab: 'rave2', pad: 1, inst: { lead: 'saw' },
        lead: 'G5 - - E5 - - G5 A5 | F#5 - - D5 - - . . | E5 - G5 - B5 - A5 G5 | E5 - - - - - . . | G5 - - E5 - - G5 A5 | A5 - F#5 - D5 - E5 F#5 | D#5 - - - F#5 - - - | B4 - - - - - . .',
      },
      Z: { bars: 4, chords: 'Em C D B', drums: 'build', bass: 'half', stab: 'hold', arp: 'up16', riser: true },
    },
    order: ['X', 'Y', 'X', 'Z'],
  },
});
