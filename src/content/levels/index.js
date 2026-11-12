// Level list in play order. Each module default-exports a level definition (see docs/LEVELS.md).
import l1 from './l1_streets.js';
import l2 from './l2_pub.js';
import l3 from './l3_underground.js';
import l4 from './l4_awayend.js';
import l5 from './l5_city.js';
import l6 from './l6_industrial.js';
import l7 from './l7_derby.js';
import l8 from './l8_laststand.js';

export const LEVELS = [l1, l2, l3, l4, l5, l6, l7, l8];
