// Single registry of math question types (ESM, client). Mirror of
// server/utils/questionTypes.js for the grading bits (factKey/answer/isTrivial/
// points/generate), PLUS the presentation a descriptor needs on the page:
//   label    toggle-button text          symbol   toggle-button glyph
//   display(a,b)  how the prompt reads    commutative  random-orientation flag
//   maxForGrade(grade)  pool size cap for this kid
// Adding a new formula = one descriptor here + its server mirror.
// KEEP grading rules IN SYNC with server/utils/questionTypes.js.

import { mulMaxForGrade, addSubMaxForGrade, squareMaxForGrade, cubeMaxForGrade } from './mathGrades.js';

const MUL_MAX = 20;
const SQ_MAX = 50;
const CUBE_MAX = 20;
const FRAC_TOL = 0.005;   // decimal grading tolerance (accepts 2- or 3-dp rounding)
const PCT_TOL = 0.05;     // percent grading tolerance (accepts the exact half-percents)
const lo = (a, b) => Math.min(a, b);
const hi = (a, b) => Math.max(a, b);

// Common fraction↔decimal↔percent equivalents, as [numerator, denominator].
// PCT_SET: fractions whose percent is a whole number (Percents mode, exact grading).
const PCT_SET = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10], [1, 20], [1, 25], [1, 100]];
// FDEC_SET: PCT_SET + eighths + thirds — the full decimal set (Frac→Dec, tolerant).
const FDEC_SET = [...PCT_SET, [1, 8], [3, 8], [5, 8], [7, 8], [1, 3], [2, 3]];
// MIX: the mastery set. Each fraction is asked as a decimal; fractions with a terminating
// percent (everything except thirds — eighths give the half-percents 12.5/37.5/62.5/87.5)
// are also asked as a percent. So the eighths family exists in all three representations.
const MIX = FDEC_SET.map(([n, d]) => ({ n, d, dec: n / d, pct: (100 * n) / d, hasPct: d !== 3 }));

export const TYPES = {
  mul: {
    key: 'mul', label: 'Multiply', symbol: '×', commutative: true, points: 1,
    display: (a, b) => `${a} × ${b}`,
    maxForGrade: mulMaxForGrade,
    factKey: (a, b) => `${lo(a, b)}x${hi(a, b)}`,
    answer: (a, b) => a * b,
    isTrivial: (a, b) => a <= 1 || b <= 1,
    generate: (max) => { const f = [], c = Math.min(max, MUL_MAX); for (let a = 0; a <= c; a++) for (let b = a; b <= c; b++) f.push({ a, b, key: `${a}x${b}` }); return f; },
  },
  add: {
    key: 'add', label: 'Add', symbol: '+', commutative: true, points: 1,
    display: (a, b) => `${a} + ${b}`,
    maxForGrade: addSubMaxForGrade,
    factKey: (a, b) => `${lo(a, b)}+${hi(a, b)}`,
    answer: (a, b) => a + b,
    isTrivial: (a, b) => a === 0 || b === 0,
    generate: (max) => { const f = []; for (let a = 0; a <= max; a++) for (let b = a; a + b <= max; b++) f.push({ a, b, key: `${a}+${b}` }); return f; },
  },
  sub: {
    key: 'sub', label: 'Subtract', symbol: '−', commutative: false, points: 3,
    display: (a, b) => `${a} − ${b}`,
    maxForGrade: addSubMaxForGrade,
    factKey: (a, b) => `${a}-${b}`,
    answer: (a, b) => a - b,
    isTrivial: (a, b) => b === 0 || a === b,
    generate: (max) => { const f = []; for (let a = 0; a <= max; a++) for (let b = 0; b <= a; b++) f.push({ a, b, key: `${a}-${b}` }); return f; },
  },
  div: {
    key: 'div', label: 'Divide', symbol: '÷', commutative: false, points: 4,
    display: (a, b) => `${a} ÷ ${b}`,
    maxForGrade: addSubMaxForGrade,
    factKey: (a, b) => `${a}/${b}`,
    answer: (a, b) => a / b,
    isTrivial: (a, b) => b === 1 || a === b,
    generate: (max) => { const f = []; for (let b = 1; b <= max; b++) for (let q = 1; b * q <= max; q++) { const a = b * q; f.push({ a, b, key: `${a}/${b}` }); } return f; },
  },
  sq: {
    key: 'sq', label: 'Squares', symbol: 'x²', commutative: false, points: 3,
    display: (a) => `${a}²`,
    maxForGrade: squareMaxForGrade,
    factKey: (a) => `sq:${a}`,
    answer: (a) => a * a,
    isTrivial: (a) => a <= 1,
    generate: (max) => { const f = [], c = Math.min(max, SQ_MAX); for (let n = 0; n <= c; n++) f.push({ a: n, b: n, key: `sq:${n}` }); return f; },
  },
  sqrt: {
    key: 'sqrt', label: 'Roots', symbol: '√', commutative: false, points: 4,
    display: (a) => `√${a}`,                   // a = radicand; b carries the root
    maxForGrade: squareMaxForGrade,
    factKey: (a) => `sqrt:${a}`,
    answer: (a, b) => b,
    isTrivial: (a, b) => b <= 1,
    generate: (max) => { const f = [], c = Math.min(max, SQ_MAX); for (let n = 0; n <= c; n++) f.push({ a: n * n, b: n, key: `sqrt:${n * n}` }); return f; },
  },
  cube: {
    key: 'cube', label: 'Cubes', symbol: 'x³', commutative: false, points: 4,
    display: (a) => `${a}³`,
    maxForGrade: cubeMaxForGrade,
    factKey: (a) => `cube:${a}`,
    answer: (a) => a * a * a,
    isTrivial: (a) => a <= 1,
    generate: (max) => { const f = [], c = Math.min(max, CUBE_MAX); for (let n = 0; n <= c; n++) f.push({ a: n, b: n, key: `cube:${n}` }); return f; },
  },
  cbrt: {
    key: 'cbrt', label: 'Cube roots', symbol: '∛', commutative: false, points: 5,
    display: (a) => `∛${a}`,                   // a = radicand n³; b carries the root
    maxForGrade: cubeMaxForGrade,
    factKey: (a) => `cbrt:${a}`,
    answer: (a, b) => b,
    isTrivial: (a, b) => b <= 1,
    generate: (max) => { const f = [], c = Math.min(max, CUBE_MAX); for (let n = 0; n <= c; n++) f.push({ a: n * n * n, b: n, key: `cbrt:${n * n * n}` }); return f; },
  },
  frac: {
    // Unit fractions 1/n as decimals. The kid types the digits after a fixed "0."
    // prefix (25 → 0.25, 167 → 0.167); graded with tolerance so 2- or 3-dp both pass.
    key: 'frac', label: 'Fractions', symbol: '½', commutative: false, points: 2,
    integerAnswer: false, tolerance: FRAC_TOL, autoSubmit: false,
    display: (a) => `1/${a}`,
    maxForGrade: () => 10,
    factKey: (a) => `frac:1/${a}`,
    answer: (a) => 1 / a,
    isTrivial: (a) => a === 1,
    generate: (max) => { const f = [], c = Math.min(max, 10); for (let n = 1; n <= c; n++) f.push({ a: n, b: 1, key: `frac:1/${n}` }); return f; },
    // UI: show "0." before the input (except 1/1, whose value is the whole number 1).
    answerPrefix: (a) => (a === 1 ? '' : '0.'),
    // Turn the kid's keystrokes into a number. Digits after the "0." prefix → 0.ddd;
    // a typed dot means they entered the whole decimal; '1/1' types the whole number.
    parseTyped: (raw, a) => {
      const s = String(raw);
      if (s.includes('-')) return NaN;
      if (s.includes('.')) return Number(s);
      const d = s.replace(/[^\d]/g, '');
      if (d === '') return NaN;
      return a === 1 ? Number(d) : Number('0.' + d);
    },
  },
  pct: {
    // Show a common fraction, type its whole-number percent (3/4 → 75). Exact grading.
    key: 'pct', label: 'Percents', symbol: '%', commutative: false, points: 3,
    display: (a, b) => `${a}/${b} = ?%`,
    maxForGrade: () => 100,
    factKey: (a, b) => `pct:${a}/${b}`,
    answer: (a, b) => (100 * a) / b,
    isTrivial: () => false,
    generate: () => PCT_SET.map(([a, b]) => ({ a, b, key: `pct:${a}/${b}` })),
  },
  fdec: {
    // Show a common fraction, type its decimal (reuses the "0." entry + tolerance).
    key: 'fdec', label: 'Frac→Dec', symbol: '0.', commutative: false, points: 3,
    integerAnswer: false, tolerance: FRAC_TOL, autoSubmit: false, decimalInput: true,
    display: (a, b) => `${a}/${b}`,
    maxForGrade: () => 100,
    factKey: (a, b) => `fdec:${a}/${b}`,
    answer: (a, b) => a / b,
    isTrivial: () => false,
    generate: () => FDEC_SET.map(([a, b]) => ({ a, b, key: `fdec:${a}/${b}` })),
    answerPrefix: () => '0.',
    parseTyped: (raw) => {
      const s = String(raw);
      if (s.includes('-')) return NaN;
      if (s.includes('.')) return Number(s);
      const d = s.replace(/[^\d]/g, '');
      return d === '' ? NaN : Number('0.' + d);
    },
  },
  mix: {
    // Mastery tile (unlocked once Percents + Frac→Dec are mastered): each question asks
    // for the decimal (b=0) or the percent (b=1) of a fraction. `a` indexes MIX, `b` the
    // direction. Percent direction includes the eighths' half-percents.
    key: 'mix', label: 'Mixed', symbol: '↔', commutative: false, points: 5,
    integerAnswer: false, autoSubmit: false, decimalInput: true, mastery: true,
    display: (a, b) => `${MIX[a].n}/${MIX[a].d} = ${b === 1 ? '?%' : '?'}`,
    maxForGrade: () => 100,
    factKey: (a, b) => `mix:${a}:${b}`,
    answer: (a, b) => (b === 1 ? MIX[a].pct : MIX[a].dec),
    isTrivial: () => false,
    generate: () => {
      const f = [];
      MIX.forEach((m, i) => {
        f.push({ a: i, b: 0, key: `mix:${i}:0` });
        if (m.hasPct) f.push({ a: i, b: 1, key: `mix:${i}:1` });
      });
      return f;
    },
    answerPrefix: (a, b) => (b === 1 ? '' : '0.'),
    parseTyped: (raw, a, b) => {
      const s = String(raw);
      if (s.includes('-')) return NaN;
      if (b === 1) return s === '' ? NaN : Number(s); // percent: typed directly (75 or 37.5)
      if (s.includes('.')) return Number(s);
      const d = s.replace(/[^\d]/g, '');
      return d === '' ? NaN : Number('0.' + d);        // decimal: digits after "0."
    },
    grade: (a, b, val) => {
      if (Number.isNaN(val)) return false;
      return b === 1 ? Math.abs(val - MIX[a].pct) <= PCT_TOL : Math.abs(val - MIX[a].dec) <= FRAC_TOL;
    },
  },
};

export const OP_KEYS = Object.keys(TYPES);

export function getType(op) { return TYPES[op]; }
export function pointsForOp(op) { return TYPES[op] ? TYPES[op].points : 1; }
export function isTrivialFact(op, a, b) { return TYPES[op].isTrivial(a, b); }
export function factKeyFor(op, a, b) { return TYPES[op].factKey(a, b); }

// Parse a kid's raw keystrokes into a numeric answer for grading (type-aware:
// fractions reinterpret digits under the "0." prefix; everything else is Number()).
export function parseTypedAnswer(op, a, b, raw) {
  const t = TYPES[op];
  return t && t.parseTyped ? t.parseTyped(raw, a, b) : Number(raw);
}

// Is `val` a correct answer for this fact? Tolerant types (fractions) accept any
// value within `tolerance`; everything else must match exactly.
export function gradeAnswer(op, a, b, val) {
  const t = TYPES[op];
  if (!t || Number.isNaN(val)) return false;
  if (t.grade) return t.grade(a, b, val);
  const correct = t.answer(a, b);
  return t.tolerance ? Math.abs(val - correct) <= t.tolerance : val === correct;
}
