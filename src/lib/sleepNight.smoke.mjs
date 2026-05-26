// Smoke test for src/lib/sleepNight.js. Run with:
//   node src/lib/sleepNight.smoke.mjs
// Exits 0 if all assertions pass.

import {
  nightDateFor,
  elapsedMs,
  formatDuration,
  formatHMS,
  groupByNight,
} from './sleepNight.js';

let failures = 0;
function assert(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → ${detail}`}`);
  if (!ok) failures++;
}
function eq(label, a, b) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  assert(label, ok, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

const TZ = 'America/New_York';

// ─── nightDateFor ───────────────────────────────────────────────────────────
eq('11pm Mon → Mon',           nightDateFor(new Date('2026-05-25T23:00:00-04:00'), TZ), '2026-05-25');
eq('4am Tue → Mon',            nightDateFor(new Date('2026-05-26T04:00:00-04:00'), TZ), '2026-05-25');
eq('6:00pm exact → that date', nightDateFor(new Date('2026-05-26T18:00:00-04:00'), TZ), '2026-05-26');
eq('5:59pm → previous day',    nightDateFor(new Date('2026-05-26T17:59:00-04:00'), TZ), '2026-05-25');
eq('midnight → previous day',  nightDateFor(new Date('2026-05-26T00:00:00-04:00'), TZ), '2026-05-25');
eq('11:59am → previous day',   nightDateFor(new Date('2026-05-26T11:59:00-04:00'), TZ), '2026-05-25');

// Cross-DST sanity: November DST end in US/Eastern (2026-11-01).
// 2am local before the cutoff should land on the previous date.
eq('DST-fallback 2am → prev day',
   nightDateFor(new Date('2026-11-01T05:00:00Z'), TZ), '2026-10-31'); // 01:00 EDT

// ─── elapsedMs ──────────────────────────────────────────────────────────────
const now = new Date('2026-05-26T07:00:00Z');
eq('elapsed closed',  elapsedMs({ startAt: '2026-05-26T03:00:00Z', endAt: '2026-05-26T07:00:00Z' }, now), 4 * 60 * 60 * 1000);
eq('elapsed active',  elapsedMs({ startAt: '2026-05-26T06:00:00Z', endAt: null }, now), 60 * 60 * 1000);
eq('elapsed no start', elapsedMs({}, now), 0);

// ─── formatDuration ─────────────────────────────────────────────────────────
eq('format null',      formatDuration(null),                '—');
eq('format 0',         formatDuration(0),                   '0m');
eq('format 42m',       formatDuration(42 * 60 * 1000),      '42m');
eq('format 7h',        formatDuration(7 * 3600 * 1000),     '7h');
eq('format 7h 12m',    formatDuration((7 * 60 + 12) * 60 * 1000), '7h 12m');

// ─── formatHMS ──────────────────────────────────────────────────────────────
eq('HMS 0',         formatHMS(0),                       '00:00:00');
eq('HMS 1h 2m 3s',  formatHMS((3600 + 2 * 60 + 3) * 1000), '01:02:03');

// ─── groupByNight ───────────────────────────────────────────────────────────
const sessions = [
  { _id: '1', nightDate: '2026-05-25', startAt: '2026-05-25T23:00:00Z', endAt: '2026-05-26T02:00:00Z' }, // 3h
  { _id: '2', nightDate: '2026-05-25', startAt: '2026-05-26T03:00:00Z', endAt: '2026-05-26T07:00:00Z' }, // 4h
  { _id: '3', nightDate: '2026-05-24', startAt: '2026-05-25T02:00:00Z', endAt: '2026-05-25T07:00:00Z' }, // 5h
];
const groups = groupByNight(sessions, { '2026-05-25': { quality: 4 } });
eq('group count',                  groups.length,                       2);
eq('newest first',                 groups[0].nightDate,                 '2026-05-25');
eq('night-25 total = 7h',          groups[0].totalMs,                   7 * 3600 * 1000);
eq('night-25 session count',       groups[0].sessions.length,           2);
eq('night-25 sessions sorted asc', groups[0].sessions[0]._id,           '1');
eq('night-25 quality propagated',  groups[0].quality,                   4);
eq('night-24 has no quality',      groups[1].quality,                   null);

// Active session in group → isActive true, totalMs excludes open one
const withActive = groupByNight([
  { _id: 'a', nightDate: '2026-05-26', startAt: '2026-05-26T22:00:00Z', endAt: null },
]);
eq('isActive true', withActive[0].isActive, true);
eq('active totalMs 0', withActive[0].totalMs, 0);

// Night with quality but no sessions → bucket still created.
const onlyQuality = groupByNight([], { '2026-05-20': { quality: 3 } });
eq('only-quality night present', onlyQuality.length, 1);
eq('only-quality quality',       onlyQuality[0].quality, 3);

console.log(failures === 0 ? `\nAll smoke checks passed.` : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
