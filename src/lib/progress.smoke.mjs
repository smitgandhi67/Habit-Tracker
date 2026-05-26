// Smoke test for src/lib/progress.js. Run with:
//   node src/lib/progress.smoke.mjs
// Exits 0 on success.

import { summarize, averagePct, formatPct, pctTone, sortByWeightPctDesc, periodForKey } from './progress.js';

let failures = 0;
function assert(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → ${detail}`}`);
  if (!ok) failures++;
}
function eq(label, a, b) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  assert(label, ok, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function near(label, got, want, tol = 0.001) {
  assert(label, Math.abs(got - want) < tol, `expected ~${want}, got ${got}`);
}

// ─── summarize ──────────────────────────────────────────────────────────────
const empty = summarize([]);
eq('empty.sessions=0',          empty.sessions,    0);
eq('empty.weightPct=null',      empty.weightPct,   null);
eq('empty.currentWeight=0',     empty.currentWeight, 0);

const oneActive = summarize([
  { weekStart: 'w1', sessions: 0, maxWeight: 0, totalVolume: 0 },
  { weekStart: 'w2', sessions: 2, maxWeight: 60, totalVolume: 480 },
]);
eq('1 active → sessions=2',      oneActive.sessions,    2);
eq('1 active → weightPct null',  oneActive.weightPct,   null);
eq('1 active → currentWeight 60', oneActive.currentWeight, 60);

const growing = summarize([
  { weekStart: 'w1', sessions: 1, maxWeight: 50, totalVolume: 400 },
  { weekStart: 'w2', sessions: 1, maxWeight: 55, totalVolume: 480 },
  { weekStart: 'w3', sessions: 1, maxWeight: 60, totalVolume: 540 },
]);
eq('growing.sessions',        growing.sessions, 3);
near('growing.weightPct =20%', growing.weightPct,  20);
near('growing.volumePct =35%', growing.volumePct,  35);

const regress = summarize([
  { weekStart: 'w1', sessions: 1, maxWeight: 80, totalVolume: 800 },
  { weekStart: 'w2', sessions: 1, maxWeight: 72, totalVolume: 720 },
]);
near('regress.weightPct -10%', regress.weightPct, -10);

const bodyweight = summarize([
  { weekStart: 'w1', sessions: 1, maxWeight: 0, totalVolume: 100 },
  { weekStart: 'w2', sessions: 1, maxWeight: 0, totalVolume: 150 },
]);
eq('bodyweight.weightPct null', bodyweight.weightPct, null);
near('bodyweight.volumePct 50%', bodyweight.volumePct, 50);

// ─── averagePct ─────────────────────────────────────────────────────────────
eq('avg empty',  averagePct([]),                       null);
eq('avg all null', averagePct([null, null]),           null);
near('avg mix', averagePct([10, 20, null, -5]),         (10 + 20 - 5) / 3);

// ─── formatPct ──────────────────────────────────────────────────────────────
eq('fmt null',   formatPct(null),   '—');
eq('fmt 0',      formatPct(0.4),    '0%');
eq('fmt +12.4',  formatPct(12.4),   '+12%');
eq('fmt -3.6',   formatPct(-3.6),   '-4%');
eq('fmt inf',    formatPct(Infinity), '—');

// ─── pctTone ────────────────────────────────────────────────────────────────
eq('tone null',  pctTone(null).text,  'text-slate-400');
eq('tone pos',   pctTone(5).text,     'text-green-600');
eq('tone neg',   pctTone(-2).text,    'text-red-500');
eq('tone zero',  pctTone(0).text,     'text-slate-500');

// ─── sortByWeightPctDesc ────────────────────────────────────────────────────
const sorted = sortByWeightPctDesc([
  { exerciseName: 'Squat',  weightPct: 5 },
  { exerciseName: 'Curl',   weightPct: null },
  { exerciseName: 'Bench',  weightPct: 12 },
  { exerciseName: 'Press',  weightPct: -3 },
  { exerciseName: 'Pull',   weightPct: null },
]);
eq('sorted names',
   sorted.map(r => r.exerciseName),
   ['Bench', 'Squat', 'Press', 'Curl', 'Pull']);

// ─── periodForKey ───────────────────────────────────────────────────────────
eq('period 1mo weeks',   periodForKey('1mo').weeks, 4);
eq('period 3mo weeks',   periodForKey('3mo').weeks, 13);
eq('period all weeks',   periodForKey('all').weeks, 52);
eq('period bad fallback', periodForKey('xx').key,   '1mo');

console.log(failures === 0 ? `\nAll smoke checks passed.` : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
