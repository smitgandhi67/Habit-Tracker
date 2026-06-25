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
const FRAC_TOL = 0.005;
const lo = (a, b) => Math.min(a, b);
const hi = (a, b) => Math.max(a, b);

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
  const correct = t.answer(a, b);
  return t.tolerance ? Math.abs(val - correct) <= t.tolerance : val === correct;
}
