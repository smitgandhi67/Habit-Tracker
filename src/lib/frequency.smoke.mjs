// Smoke test for src/lib/frequency.js. Run with:
//   node src/lib/frequency.smoke.mjs
// Exits 0 if all assertions pass.

import {
  isScheduledOn,
  periodKeyFor,
  periodStartFor,
  previousPeriodStart,
  targetTimesPerPeriod,
  formatFrequency,
  isPeriodFrequency,
} from './frequency.js';

let failures = 0;
function assert(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → ${detail}`}`);
  if (!ok) failures++;
}
function eq(label, a, b) { assert(label, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const dailyHabit  = { _id: 'h1', frequency: 'daily' };
const arrayHabit  = { _id: 'h2', frequency: ['Mon', 'Wed', 'Sat'] };
const weeklyHabit = { _id: 'h3', frequency: { type: 'weekly', times: 2 } };
const biwHabit    = { _id: 'h4', frequency: { type: 'biweekly', times: 1, anchor: '2026-05-25' } }; // Mon
const monthHabit  = { _id: 'h5', frequency: { type: 'monthly', times: 3 } };

// Fixed reference dates (UTC midnight to avoid TZ flakes in CI).
const d = (s) => new Date(`${s}T12:00:00`);

// isScheduledOn
eq('daily scheduled any day',              isScheduledOn(dailyHabit, d('2026-05-25')), true);
eq('array Mon scheduled',                  isScheduledOn(arrayHabit, d('2026-05-25')), true);  // Mon
eq('array Tue not scheduled',              isScheduledOn(arrayHabit, d('2026-05-26')), false); // Tue
eq('array Wed scheduled',                  isScheduledOn(arrayHabit, d('2026-05-27')), true);  // Wed
eq('weekly always scheduled',              isScheduledOn(weeklyHabit, d('2026-05-26')), true);
eq('biweekly before anchor → not scheduled', isScheduledOn(biwHabit, d('2026-05-24')), false);
eq('biweekly on anchor → scheduled',       isScheduledOn(biwHabit, d('2026-05-25')), true);

// periodKeyFor
const wkA = periodKeyFor(weeklyHabit, d('2026-05-25'));      // Mon
const wkB = periodKeyFor(weeklyHabit, d('2026-05-31'));      // Sun same ISO week
const wkC = periodKeyFor(weeklyHabit, d('2026-06-01'));      // Mon next ISO week
assert('weekly key Mon == Sun same week', wkA === wkB, `${wkA} vs ${wkB}`);
assert('weekly key changes next week',    wkA !== wkC, `${wkA} vs ${wkC}`);

const biwA = periodKeyFor(biwHabit, d('2026-05-25')); // cycle 0
const biwB = periodKeyFor(biwHabit, d('2026-06-07')); // day 13 → cycle 0
const biwC = periodKeyFor(biwHabit, d('2026-06-08')); // day 14 → cycle 1
assert('biweekly day 0 and day 13 same cycle', biwA === biwB, `${biwA} vs ${biwB}`);
assert('biweekly day 14 next cycle',           biwA !== biwC, `${biwA} vs ${biwC}`);

const monA = periodKeyFor(monthHabit, d('2026-05-01'));
const monB = periodKeyFor(monthHabit, d('2026-05-31'));
const monC = periodKeyFor(monthHabit, d('2026-06-01'));
assert('monthly key May 1 == May 31',  monA === monB, `${monA} vs ${monB}`);
assert('monthly key changes June 1',   monA !== monC, `${monA} vs ${monC}`);

// targetTimesPerPeriod
eq('target daily=1',    targetTimesPerPeriod(dailyHabit),  1);
eq('target array=1',    targetTimesPerPeriod(arrayHabit),  1);
eq('target weekly=2',   targetTimesPerPeriod(weeklyHabit), 2);
eq('target biweekly=1', targetTimesPerPeriod(biwHabit),    1);
eq('target monthly=3',  targetTimesPerPeriod(monthHabit),  3);

// previousPeriodStart returns a Date in the prior period
const prevWk = previousPeriodStart(weeklyHabit, d('2026-05-25'));
const prevKey = periodKeyFor(weeklyHabit, prevWk);
assert('previousPeriodStart weekly → different bucket', prevKey !== wkA, `${prevKey} vs ${wkA}`);

const prevBw = previousPeriodStart(biwHabit, d('2026-06-08'));
const prevBwKey = periodKeyFor(biwHabit, prevBw);
assert('previousPeriodStart biweekly → cycle 0', prevBwKey === biwA, `${prevBwKey} vs ${biwA}`);

const prevMo = previousPeriodStart(monthHabit, d('2026-06-15'));
const prevMoKey = periodKeyFor(monthHabit, prevMo);
eq('previousPeriodStart monthly → May', prevMoKey, 'M:2026-05');

// formatFrequency
eq('label daily',     formatFrequency('daily'),                                'Every day');
eq('label array',     formatFrequency(['Mon', 'Wed', 'Sat']),                  'Mon · Wed · Sat');
eq('label weekly',    formatFrequency({ type: 'weekly',   times: 2 }),         '2× per week');
eq('label biweekly',  formatFrequency({ type: 'biweekly', times: 1, anchor: '2026-05-25' }), '1× per 2 weeks');
eq('label monthly',   formatFrequency({ type: 'monthly',  times: 3 }),         '3× per month');

// isPeriodFrequency
eq('isPeriod daily=false', isPeriodFrequency('daily'),                false);
eq('isPeriod array=false', isPeriodFrequency(['Mon']),                false);
eq('isPeriod weekly=true', isPeriodFrequency({ type: 'weekly', times: 1 }), true);

// periodStartFor unused-but-exported sanity check
const startMonth = periodStartFor(monthHabit, d('2026-05-15'));
eq('periodStartFor monthly date is day 1', startMonth.getDate(), 1);

console.log(failures === 0 ? `\nAll smoke checks passed.` : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
