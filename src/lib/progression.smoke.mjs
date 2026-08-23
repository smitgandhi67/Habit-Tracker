// Smoke test for src/lib/progression.js (the presentation + live-preview half
// of the progression feature). Run with:
//   node src/lib/progression.smoke.mjs
// Exits 0 if all assertions pass, 1 otherwise.
//
// The DECISION logic lives on the server and is covered by
// server/utils/progression.test.js. What is checked here is the wording, the
// unit formatting, and the optimistic preview computed from unsaved draft rows.

import {
  MIN_REPS_NEW_WEIGHT, STATUS,
  formatWeight, formatTarget, summarizeDraftSets, previewUnlock,
  describeRecommendation, statusTone,
} from './progression.js';

let failures = 0;
function eq(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
}
function ok(label, cond) { eq(label, !!cond, true); }
function includes(label, haystack, needle) {
  const hit = typeof haystack === 'string' && haystack.includes(needle);
  console.log(`${hit ? 'PASS' : 'FAIL'}  ${label}${hit ? '' : `\n      ${JSON.stringify(haystack)} does not contain ${JSON.stringify(needle)}`}`);
  if (!hit) failures++;
}

const TARGET_8_10  = { repsMin: 8,  repsMax: 10, sets: 3, source: 'plan' };
const TARGET_12_15 = { repsMin: 12, repsMax: 15, sets: 3, source: 'plan' };

// ---- formatting ------------------------------------------------------------

eq('formatWeight trims whole numbers',    formatWeight(55, 'lb'),   '55 lb');
eq('formatWeight keeps a half step',      formatWeight(32.5, 'lb'), '32.5 lb');
eq('formatWeight rounds float drift',     formatWeight(32.500000001, 'kg'), '32.5 kg');
eq('formatWeight without a unit',         formatWeight(55), '55');
eq('formatWeight handles null',           formatWeight(null, 'lb'), '—');
eq('formatWeight handles junk',           formatWeight('abc', 'lb'), '—');

eq('formatTarget spans a range',   formatTarget(TARGET_8_10), '3 × 8-10');
eq('formatTarget collapses equal', formatTarget({ repsMin: 10, repsMax: 10, sets: 3 }), '3 × 10');
eq('formatTarget handles null',    formatTarget(null), '');

// ---- draft-set primitives --------------------------------------------------

{
  // Draft rows hold strings, because the inputs are text fields.
  const s = summarizeDraftSets([
    { reps: '12', weight: '20', isWarmup: true },
    { reps: '10', weight: '50' },
    { reps: '10', weight: '50' },
    { reps: '9',  weight: '50' },
    { reps: '',   weight: '50' },
  ]);
  eq('draft: top weight from strings', s.topWeight, 50);
  eq('draft: warmup excluded',         s.topSetCount, 3);
  eq('draft: max top reps',            s.maxTopReps, 10);
}

{
  const s = summarizeDraftSets([{ reps: '10', weight: '50' }, { reps: '12', weight: '40' }]);
  eq('draft: back-off set is not a top set', s.topSetCount, 1);
}

eq('draft: no reps means no work', summarizeDraftSets([{ reps: '', weight: '50' }]).hasWork, false);
eq('draft: empty list',            summarizeDraftSets([]).hasWork, false);
eq('draft: undefined',             summarizeDraftSets(undefined).hasWork, false);

// ---- live unlock preview ---------------------------------------------------

eq('preview: nothing typed yet',
  previewUnlock({ sets: [{ reps: '', weight: '' }], target: TARGET_8_10, step: 5, unit: 'lb' }),
  null);

eq('preview: no target resolved yet',
  previewUnlock({ sets: [{ reps: '10', weight: '50' }], target: null, step: 5, unit: 'lb' }),
  null);

{
  const p = previewUnlock({
    sets: [{ reps: '10', weight: '50' }, { reps: '10', weight: '50' }, { reps: '9', weight: '50' }],
    target: TARGET_8_10, step: 5, unit: 'lb',
  });
  includes('preview: short of the target counts sets', p.text, '2/3 sets at 10 reps');
  includes('preview: names the weight it would unlock', p.text, '55 lb');
  includes('preview: says how many more sets', p.text, '1 more set');
}

{
  const p = previewUnlock({
    sets: Array.from({ length: 3 }, () => ({ reps: '10', weight: '50' })),
    target: TARGET_8_10, step: 5, unit: 'lb',
  });
  includes('preview: full house unlocks the next weight', p.text, 'unlocks 55 lb');
  includes('preview: unlocking is toned green', p.tone, 'emerald');
}

{
  const p = previewUnlock({
    sets: Array.from({ length: 3 }, () => ({ reps: '15', weight: '30' })),
    target: TARGET_12_15, step: 2.5, unit: 'lb',
  });
  includes('preview: 12-15 range unlocks at 15 reps', p.text, 'unlocks 32.5 lb');
}

{
  const p = previewUnlock({
    sets: Array.from({ length: 3 }, () => ({ reps: '3', weight: '60' })),
    target: TARGET_8_10, step: 5, unit: 'lb',
  });
  includes('preview: below the 4-rep floor warns', p.text, 'too big');
  includes('preview: the warning is toned red', p.tone, 'red');
}

{
  // Warmups must never drag the preview down.
  const p = previewUnlock({
    sets: [
      { reps: '12', weight: '20', isWarmup: true },
      { reps: '10', weight: '50' },
      { reps: '10', weight: '50' },
      { reps: '10', weight: '50' },
    ],
    target: TARGET_8_10, step: 5, unit: 'lb',
  });
  includes('preview: warmups excluded from the count', p.text, 'unlocks 55 lb');
}

// ---- describing a saved recommendation -------------------------------------

{
  const d = describeRecommendation({
    status: STATUS.READY, currentWeight: 50, recommendedWeight: 55,
    repsMax: 10, repsMin: 8, targetSets: 3, repsTarget: 4,
  }, TARGET_8_10, 'lb');
  eq('ready: headline',  d.headline, 'Move up to 55 lb');
  eq('ready: rep line',  d.repsLine, `${MIN_REPS_NEW_WEIGHT}+ reps · build back to 10`);
  includes('ready: explains why', d.why, 'hit 10 reps on 3 sets at 50 lb');
  eq('ready: chip form', d.short, '55 lb');
}

{
  const d = describeRecommendation({
    status: STATUS.CLIMB, currentWeight: 55, recommendedWeight: 55,
    unlockWeight: 60, climbingFrom: 50, lastTopReps: [6, 5, 5],
    repsMax: 10, repsMin: 8, targetSets: 3,
  }, TARGET_8_10, 'lb');
  eq('climb: headline', d.headline, 'Stay at 55 lb');
  eq('climb: shows the rep climb', d.repsLine, 'Build 6 → 10 reps');
  includes('climb: normalises the drop', d.why, 'reps dropping is expected');
}

{
  const d = describeRecommendation({
    status: STATUS.HOLD, currentWeight: 50, recommendedWeight: 50,
    unlockWeight: 55, setsAtTarget: 2, setsNeeded: 1,
    repsMax: 10, repsMin: 8, targetSets: 3,
  }, TARGET_8_10, 'lb');
  eq('hold: headline', d.headline, 'Stay at 50 lb');
  includes('hold: counts remaining sets', d.why, '2/3 sets at 10');
  includes('hold: names the unlock',      d.why, '55 lb');
}

{
  const d = describeRecommendation({
    status: STATUS.DELOAD, currentWeight: 60, recommendedWeight: 55,
    repsMax: 10, repsMin: 8, targetSets: 3,
  }, TARGET_8_10, 'lb');
  eq('deload: headline', d.headline, 'Drop back to 55 lb');
  includes('deload: explains the floor', d.why, `under ${MIN_REPS_NEW_WEIGHT} reps`);
}

{
  const d = describeRecommendation({
    status: STATUS.NO_HISTORY, recommendedWeight: null,
    repsMax: 10, repsMin: 8, targetSets: 3,
  }, TARGET_8_10, 'lb');
  eq('no history: headline', d.headline, 'First time on this one');
  eq('no history: no weight to apply', d.weight, null);
  includes('no history: shows the window', d.repsLine, '8-10 reps');
}

{
  const d = describeRecommendation({
    status: STATUS.BODYWEIGHT, recommendedWeight: 0, lastTopReps: [45, 40, 40],
    repsMax: 45, repsMin: 30, targetSets: 3,
  }, { repsMin: 30, repsMax: 45, sets: 3 }, 'lb');
  eq('bodyweight: headline', d.headline, 'Build to 45');
  ok('bodyweight: never mentions adding load', !d.headline.includes('lb'));
}

eq('describe: null recommendation', describeRecommendation(null, TARGET_8_10, 'lb'), null);

// kg users get kg wording throughout.
{
  const d = describeRecommendation({
    status: STATUS.READY, currentWeight: 40, recommendedWeight: 42.5,
    repsMax: 15, repsMin: 12, targetSets: 3,
  }, TARGET_12_15, 'kg');
  eq('kg: headline uses the right unit', d.headline, 'Move up to 42.5 kg');
}

// ---- tones -----------------------------------------------------------------

ok('tone: ready is green',   statusTone(STATUS.READY).chip.includes('emerald'));
ok('tone: deload is red',    statusTone(STATUS.DELOAD).chip.includes('red'));
ok('tone: climb is violet',  statusTone(STATUS.CLIMB).chip.includes('violet'));
ok('tone: hold is neutral',  statusTone(STATUS.HOLD).chip.includes('slate'));
ok('tone: unknown falls back', statusTone('nonsense').chip.includes('slate'));

console.log(failures === 0 ? '\nAll progression UI assertions passed.' : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
