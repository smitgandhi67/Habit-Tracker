// Smoke test for src/lib/mathGrades.js. Run with:
//   node src/lib/mathGrades.smoke.mjs

import { mulMaxForGrade, addSubMaxForGrade, DEFAULT_MUL_MAX, DEFAULT_ADDSUB_MAX, GRADES } from './mathGrades.js';

let failures = 0;
const eq = (l, a, b) => { const ok = a === b; console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  ${ok ? '' : `→ expected ${b}, got ${a}`}`); if (!ok) failures++; };

eq('grade 2 mul cap', mulMaxForGrade(2), 9);
eq('grade 3 mul cap', mulMaxForGrade(3), 12);
eq('grade 4 mul cap', mulMaxForGrade(4), 15);
eq('grade 5 mul cap', mulMaxForGrade(5), 20);
eq('no grade mul cap', mulMaxForGrade(null), DEFAULT_MUL_MAX);
eq('unknown grade mul cap', mulMaxForGrade(99), 20);

eq('grade 2 add/sub cap', addSubMaxForGrade(2), 20);
eq('grade 3 add/sub cap', addSubMaxForGrade(3), 40);
eq('grade 5 add/sub cap', addSubMaxForGrade(5), 40);
eq('no grade add/sub cap', addSubMaxForGrade(null), DEFAULT_ADDSUB_MAX);

eq('GRADES list', GRADES.join(','), '2,3,4,5');

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
