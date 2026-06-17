// Smoke test for src/lib/mathTimer.js. Run with:
//   node src/lib/mathTimer.smoke.mjs

import { timerSecondsFor, DEFAULT_TIMER_SECONDS } from './mathTimer.js';

let failures = 0;
function eq(label, a, b) {
  const ok = a === b;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ${b}, got ${a}`}`);
  if (!ok) failures++;
}

eq('mitgandhi67 → 5s',            timerSecondsFor('mitgandhi67@gmail.com'), 5);
eq('case-insensitive override',   timerSecondsFor('MitGandhi67@Gmail.com'), 5);
eq('other kid → 10s',             timerSecondsFor('someone@example.com'), 10);
eq('missing email → default',     timerSecondsFor(undefined), DEFAULT_TIMER_SECONDS);
eq('default is 10',               DEFAULT_TIMER_SECONDS, 10);

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
