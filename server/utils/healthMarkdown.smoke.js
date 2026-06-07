// Smoke test for healthMarkdown. Run with:
//   node server/utils/healthMarkdown.smoke.js
// Exits 0 if all assertions pass, 1 otherwise.

const {
  buildHealthMarkdown, aggregateSleepNights, formatDurationMs,
} = require('./healthMarkdown');

let failures = 0;
function ok(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
}

// --- formatDurationMs ---
ok('duration 7h30m', formatDurationMs(27_000_000) === '7h 30m');
ok('duration pads minutes', formatDurationMs(6 * 3600_000 + 5 * 60_000) === '6h 05m');
ok('duration zero -> dash', formatDurationMs(0) === '-');

// --- aggregateSleepNights ---
const agg = aggregateSleepNights(
  [
    { nightDate: '2026-06-05', startAt: '2026-06-05T22:00:00Z', endAt: '2026-06-06T05:30:00Z' },
    { nightDate: '2026-06-04', startAt: '2026-06-04T23:00:00Z', endAt: '2026-06-05T02:00:00Z' },
    { nightDate: '2026-06-04', startAt: '2026-06-05T03:00:00Z', endAt: '2026-06-05T06:00:00Z' },
  ],
  [
    { nightDate: '2026-06-05', quality: 4 },
    { nightDate: '2026-06-04', quality: 3 },
  ],
);
ok('agg sorted desc', agg[0].nightDate === '2026-06-05' && agg[1].nightDate === '2026-06-04');
ok('agg merges segments', agg[1].segments === 2);
ok('agg sums duration', agg[1].durationMs === 6 * 3600_000);
ok('agg attaches quality', agg[0].quality === 4);

// --- buildHealthMarkdown: full fixture ---
const md = buildHealthMarkdown({
  from: '2025-06-06', to: '2026-06-06', generatedAt: '2026-06-06T18:30:00Z',
  units: { weight: 'lb', length: 'in' },
  gymEntries: [
    { date: '2026-06-05', bodyPart: 'chest', exerciseName: 'Bench Press', feel: 'medium',
      sets: [{ reps: 8, weight: 135 }, { reps: 6, weight: 145 }], isPersonalRecord: true, planDayLabel: 'Day 3' },
    { date: '2026-06-03', bodyPart: 'legs', exerciseName: 'Goblet Squat', feel: 'hard',
      sets: [{ reps: 10, weight: 50 }], isPersonalRecord: false, planDayLabel: '' },
  ],
  body: [
    { date: '2026-06-04', weight: 174, chest: 40, waist: 33, abdomen: null, hips: null },
    { date: '2025-06-10', weight: 182, chest: null, waist: null, abdomen: null, hips: null },
  ],
  sleepNights: agg,
});
ok('ascii only', !/[^\x00-\x7F]/.test(md));
ok('has title', md.includes('# Health Export'));
ok('has range', md.includes('2025-06-06 -> 2026-06-06'));
ok('summary training days', md.includes('Training days: 2'));
ok('summary PR count', md.includes('PRs: 1'));
ok('summary weight delta', md.includes('182 lb (2025-06-10) -> 174 lb (2026-06-04)') && md.includes('change -8 lb'));
ok('log day label', md.includes('### 2026-06-05 | Day 3'));
ok('log no-label heading', md.includes('### 2026-06-03\n'));
ok('log exercise + PR', md.includes('**Bench Press** [chest] | medium | 8x135lb, 6x145lb | [PR]'));
ok('body row with dash', md.includes('| 2026-06-04 | 174 | 40 | 33 | - | - |'));
ok('sleep row', md.includes('| 2026-06-05 | 7h 30m | 1 | 4/5 |'));

// --- buildHealthMarkdown: weight delta is rounded (no float dust) ---
const rounded = buildHealthMarkdown({
  from: '2026-05-26', to: '2026-06-06', generatedAt: '2026-06-06T00:00:00Z',
  units: { weight: 'lb', length: 'in' }, gymEntries: [],
  body: [
    { date: '2026-06-06', weight: 150.6, chest: null, waist: null, abdomen: null, hips: null },
    { date: '2026-05-26', weight: 151.7, chest: null, waist: null, abdomen: null, hips: null },
  ],
  sleepNights: [],
});
ok('weight delta rounded', rounded.includes('change -1.1 lb') && !rounded.includes('1.0999'));

// --- buildHealthMarkdown: empty fixture ---
const empty = buildHealthMarkdown({
  from: '2026-01-01', to: '2026-01-31', generatedAt: '2026-02-01T00:00:00Z',
  units: { weight: 'kg', length: 'cm' }, gymEntries: [], body: [], sleepNights: [],
});
ok('empty: training log placeholder', empty.includes('## Gym - Training Log\n_No data in this range._'));
ok('empty: body placeholder', empty.includes('## Gym - Body Measurements\n_No data in this range._'));
ok('empty: sleep placeholder', empty.includes('## Sleep\n_No data in this range._'));
ok('empty: summary no crash', empty.includes('Training days: 0'));

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
