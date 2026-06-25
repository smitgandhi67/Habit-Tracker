// Single registry of math question types (CJS, server-side grading authority).
// Each key is the `op` value stored on answers and MathFactMastery rows. Adding a
// new formula = one descriptor here + its mirror in src/lib/questionTypes.js.
// A descriptor declares everything the server needs to grade & schedule a fact:
//   factKey(a,b)      canonical, op-local dedupe key
//   answer(a,b)       the correct value (may be non-integer/negative for future types)
//   isCorrect(a,b,n)  server trust boundary — never trusts a client verdict
//   validate(a,b)     operand sanity bounds (looser than the client's grade cap)
//   isTrivial(a,b)    identity facts (×1, +0, √1…) → seeded high, low priority
//   points            first-try-correct reward weight
//   generate(max)     finite canonical universe (the seed script enumerates with it)
// KEEP IN SYNC with src/lib/questionTypes.js (a smoke test cross-checks both).

const MUL_MAX = 20;        // multiplication table bound (operands 0..20)
const ADDSUB_MAX = 100;    // sanity bound for add/sub/div operands
const SQ_MAX = 50;         // sanity bound for square base n
const CUBE_MAX = 20;       // sanity bound for cube base n
const FRAC_TOL = 0.005;    // unit-fraction grading tolerance (accepts 2- or 3-dp rounding)

const isInt = Number.isInteger;
const lo = (a, b) => Math.min(a, b);
const hi = (a, b) => Math.max(a, b);

const TYPES = {
  mul: {
    key: 'mul', points: 1, commutative: true,
    factKey: (a, b) => `${lo(a, b)}x${hi(a, b)}`,
    answer: (a, b) => a * b,
    isCorrect: (a, b, ans) => a * b === ans,
    validate: (a, b) => isInt(a) && isInt(b) && a >= 0 && b >= 0 && a <= MUL_MAX && b <= MUL_MAX,
    isTrivial: (a, b) => a <= 1 || b <= 1,
    generate: (max) => { const f = [], c = Math.min(max, MUL_MAX); for (let a = 0; a <= c; a++) for (let b = a; b <= c; b++) f.push({ a, b, key: `${a}x${b}` }); return f; },
  },
  add: {
    key: 'add', points: 1, commutative: true,
    factKey: (a, b) => `${lo(a, b)}+${hi(a, b)}`,
    answer: (a, b) => a + b,
    isCorrect: (a, b, ans) => a + b === ans,
    validate: (a, b) => isInt(a) && isInt(b) && a >= 0 && b >= 0 && a <= ADDSUB_MAX && b <= ADDSUB_MAX,
    isTrivial: (a, b) => a === 0 || b === 0,
    generate: (max) => { const f = []; for (let a = 0; a <= max; a++) for (let b = a; a + b <= max; b++) f.push({ a, b, key: `${a}+${b}` }); return f; },
  },
  sub: {
    key: 'sub', points: 3, commutative: false,
    factKey: (a, b) => `${a}-${b}`,
    answer: (a, b) => a - b,
    isCorrect: (a, b, ans) => a - b === ans,
    validate: (a, b) => isInt(a) && isInt(b) && a >= 0 && b >= 0 && a <= ADDSUB_MAX && b <= ADDSUB_MAX,
    isTrivial: (a, b) => b === 0 || a === b,
    generate: (max) => { const f = []; for (let a = 0; a <= max; a++) for (let b = 0; b <= a; b++) f.push({ a, b, key: `${a}-${b}` }); return f; },
  },
  div: {
    key: 'div', points: 4, commutative: false,
    factKey: (a, b) => `${a}/${b}`,
    answer: (a, b) => a / b,
    isCorrect: (a, b, ans) => b !== 0 && a % b === 0 && a / b === ans, // exact integer division only
    validate: (a, b) => isInt(a) && isInt(b) && a >= 0 && b >= 1 && a <= ADDSUB_MAX && b <= ADDSUB_MAX,
    isTrivial: (a, b) => b === 1 || a === b,
    generate: (max) => { const f = []; for (let b = 1; b <= max; b++) for (let q = 1; b * q <= max; q++) { const a = b * q; f.push({ a, b, key: `${a}/${b}` }); } return f; },
  },
  sq: {
    key: 'sq', points: 3, commutative: false,
    factKey: (a) => `sq:${a}`,                 // a = base n
    answer: (a) => a * a,
    isCorrect: (a, b, ans) => a * a === ans,
    validate: (a) => isInt(a) && a >= 0 && a <= SQ_MAX,
    isTrivial: (a) => a <= 1,
    generate: (max) => { const f = [], c = Math.min(max, SQ_MAX); for (let n = 0; n <= c; n++) f.push({ a: n, b: n, key: `sq:${n}` }); return f; },
  },
  sqrt: {
    key: 'sqrt', points: 4, commutative: false,
    factKey: (a) => `sqrt:${a}`,               // a = radicand n²; b carries the root n
    answer: (a, b) => b,
    isCorrect: (a, b, ans) => ans >= 0 && ans * ans === a,
    validate: (a, b) => isInt(a) && a >= 0 && a <= SQ_MAX * SQ_MAX && isInt(b) && b * b === a,
    isTrivial: (a, b) => b <= 1,
    generate: (max) => { const f = [], c = Math.min(max, SQ_MAX); for (let n = 0; n <= c; n++) f.push({ a: n * n, b: n, key: `sqrt:${n * n}` }); return f; },
  },
  cube: {
    key: 'cube', points: 4, commutative: false,
    factKey: (a) => `cube:${a}`,               // a = base n
    answer: (a) => a * a * a,
    isCorrect: (a, b, ans) => a * a * a === ans,
    validate: (a) => isInt(a) && a >= 0 && a <= CUBE_MAX,
    isTrivial: (a) => a <= 1,
    generate: (max) => { const f = [], c = Math.min(max, CUBE_MAX); for (let n = 0; n <= c; n++) f.push({ a: n, b: n, key: `cube:${n}` }); return f; },
  },
  cbrt: {
    key: 'cbrt', points: 5, commutative: false,
    factKey: (a) => `cbrt:${a}`,               // a = radicand n³; b carries the root n
    answer: (a, b) => b,
    isCorrect: (a, b, ans) => ans >= 0 && ans * ans * ans === a,
    validate: (a, b) => isInt(a) && a >= 0 && a <= CUBE_MAX ** 3 && isInt(b) && b * b * b === a,
    isTrivial: (a, b) => b <= 1,
    generate: (max) => { const f = [], c = Math.min(max, CUBE_MAX); for (let n = 0; n <= c; n++) f.push({ a: n * n * n, b: n, key: `cbrt:${n * n * n}` }); return f; },
  },
  frac: {
    key: 'frac', points: 2, commutative: false, integerAnswer: false,
    factKey: (a) => `frac:1/${a}`,             // a = denominator n (unit fraction 1/n)
    answer: (a) => 1 / a,                      // decimal value
    isCorrect: (a, b, ans) => Math.abs(ans - 1 / a) <= FRAC_TOL, // tolerant of 2/3-dp rounding
    validate: (a) => isInt(a) && a >= 1 && a <= 10,
    isTrivial: (a) => a === 1,                 // 1/1 = 1
    generate: (max) => { const f = [], c = Math.min(max, 10); for (let n = 1; n <= c; n++) f.push({ a: n, b: 1, key: `frac:1/${n}` }); return f; },
  },
};

const OP_KEYS = Object.keys(TYPES);

function get(op) { return TYPES[op]; }
function factKeyFor(op, a, b) { return TYPES[op].factKey(a, b); }
function isCorrect(op, a, b, ans) { return TYPES[op].isCorrect(a, b, ans); }
function validateOperands(op, a, b) { return !!TYPES[op] && TYPES[op].validate(a, b); }
function isTrivial(op, a, b) { return TYPES[op].isTrivial(a, b); }
function pointsForOp(op) { return TYPES[op] ? TYPES[op].points : 1; }

module.exports = { TYPES, OP_KEYS, get, factKeyFor, isCorrect, validateOperands, isTrivial, pointsForOp };
