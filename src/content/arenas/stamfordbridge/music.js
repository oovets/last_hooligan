// STAMFORD BRIDGE — "KING'S ROAD SWAGGER": an original swaggering Britpop-casual stomp in E minor
// (organ pad, jangly square lead over chugging guitars) that tips into a breakbeat-and-gallop boss fight.
// Original composition (no real melodies quoted).
import { registerTrack } from '../../../audio/music.js';

registerTrack('stamfordbridge', {
  bpm: 132, inst: { bass: 'pick', lead: 'square', arp: 'pluck', pad: 'organ' },
  sections: {
    intro: { bars: 4, chords: 'Em C G D', drums: 'terrace', fill: 'roll', pad: 1, gtr: 'hold', crash: false },
    A: {
      bars: 8, chords: 'Em C G D Em C Am B', drums: 'rock', fill: 'fill', bass: 'drive8o', gtr: 'punk8', arp: 'up8',
      lead: 'E5 - G5 - B5 - A5 G5 | E5 - - - C5 - E5 - | D5 - G5 - B5 - D6 - | C6 - B5 A5 F#5 - - - | E5 - G5 - B5 - E6 - | D6 - C6 - G5 - E5 - | A5 - C6 - B5 A5 G5 F#5 | D#5 - - - F#5 - B4 -',
    },
    B: {
      bars: 8, chords: 'C D Em Em C D B B', drums: 'anthem', fill: 'fillT', bass: 'oct', gtr: 'half', pad: 1, inst: { lead: 'pulse' },
      lead: 'G5 - - - A5 - B5 - | A5 - - - F#5 - D5 - | E5 - G5 - B5 - - - | B5 - A5 - G5 - E5 - | G5 - - - A5 - C6 - | D6 - - - C6 - A5 - | B5 - - - A5 - F#5 - | D#5 - - - - - . .',
    },
    C: {
      bars: 4, chords: 'Am Em C B', drums: 'halftime', fill: 'roll', bass: 'half', pad: 1, arp: 'updown16', leadRate: 4,
      lead: 'A5 - C6 B5 | G5 - - - | E5 - G5 C6 | B5 - - -',
    },
  },
  order: ['intro', 'A', 'B', 'A', 'C', 'B'], loopFrom: 1,
  boss: {
    bpm: 160, inst: { lead: 'gtr', bass: 'pick' },
    sections: {
      X: {
        bars: 8, chords: 'Em C G D Em C Am B', drums: 'breakbeat', fill: 'fill', bass: 'gallop', gtr: 'chug8', arp: 'up16',
        lead: 'E5 - G5 - B5 - A5 G5 | E5 - - - C5 - E5 - | D5 - G5 - B5 - D6 - | C6 - B5 A5 F#5 - - - | E5 - G5 - B5 - E6 - | D6 - C6 - G5 - E5 - | A5 - C6 - B5 A5 G5 F#5 | D#5 - - - F#5 - B4 -',
      },
      Y: {
        bars: 8, chords: 'C D Em Em C D B B', drums: 'dbeat', fill: 'fillT', bass: 'roll16', gtr: 'gallop', pad: 1, inst: { lead: 'saw' },
        lead: 'G5 - - - A5 - B5 - | A5 - - - F#5 - D5 - | E5 - G5 - B5 - - - | B5 - A5 - G5 - E5 - | G5 - - - A5 - C6 - | D6 - - - C6 - A5 - | B5 - - - A5 - F#5 - | D#5 - - - - - . .',
      },
    },
    order: ['X', 'Y'],
  },
});
