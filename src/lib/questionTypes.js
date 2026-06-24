// Single registry of math question types (ESM, client). Mirror of
// server/utils/questionTypes.js for the grading bits (factKey/answer/isTrivial/
// points/generate), PLUS the presentation a descriptor needs on the page:
//   label    toggle-button text          symbol   toggle-button glyph
//   display(a,b)  how the prompt reads    commutative  random-orientation flag
//   maxForGrade(grade)  pool size cap for this kid
// Adding a new formula = one descriptor here + its server mirror.
// KEEP grading rules IN SYNC with server/utils/questionTypes.js.

import { mulMaxForGrade, addSubMaxForGrade, squareMaxForGrade } from './mathGrades.js';

const MUL_MAX = 20;
const SQ_MAX = 50;
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
};

export const OP_KEYS = Object.keys(TYPES);

export function getType(op) { return TYPES[op]; }
export function pointsForOp(op) { return TYPES[op] ? TYPES[op].points : 1; }
export function isTrivialFact(op, a, b) { return TYPES[op].isTrivial(a, b); }
export function factKeyFor(op, a, b) { return TYPES[op].factKey(a, b); }
