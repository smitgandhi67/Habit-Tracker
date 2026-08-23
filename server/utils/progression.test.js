// Unit tests for the progressive-overload engine (server/utils/progression.js).
// Pure functions, so no DB and no stubs — just the decision table, the target /
// step resolution chain, and the numeric edge cases.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  MIN_REPS_NEW_WEIGHT, DEFAULT_TARGET_SETS, MAX_SETS, STATUS,
  roundWeight, workingSets, topWeightOf, topSetsOf, summarizeSession,
  defaultRepTarget, defaultWeightStep, resolveTarget, resolveStep, recommendNext,
} = require('./progression');

// ─── fixtures ────────────────────────────────────────────────────────────────

// A session of `count` identical sets.
const session = (date, weight, reps, count = 3) => ({
  date,
  sets: Array.from({ length: count }, () => ({ reps, weight })),
});

// A session with explicit per-set reps at one weight.
const sessionReps = (date, weight, repsList) => ({
  date,
  sets: repsList.map(reps => ({ reps, weight })),
});

const TARGET_8_10  = { repsMin: 8,  repsMax: 10, sets: 3 };
const TARGET_12_15 = { repsMin: 12, repsMax: 15, sets: 3 };

// ─── constants ───────────────────────────────────────────────────────────────

test('the rep floor at a new weight is 4', () => {
  assert.equal(MIN_REPS_NEW_WEIGHT, 4);
});

test('default target set count is 3 and the set cap is 12', () => {
  assert.equal(DEFAULT_TARGET_SETS, 3);
  assert.equal(MAX_SETS, 12);
});

// ─── numeric helpers ─────────────────────────────────────────────────────────

test('roundWeight kills float drift from repeated 1.25 kg steps', () => {
  let w = 0;
  for (let i = 0; i < 10; i++) w = roundWeight(w + 1.25);
  assert.equal(w, 12.5);
  assert.equal(roundWeight(0.1 + 0.2), 0.3);
  assert.equal(roundWeight(NaN), 0);
  assert.equal(roundWeight(undefined), 0);
});

// ─── set primitives ──────────────────────────────────────────────────────────

test('workingSets drops warmups and unfilled rows', () => {
  const sets = [
    { reps: 10, weight: 20, isWarmup: true },
    { reps: 8,  weight: 50 },
    { reps: 0,  weight: 50 },        // never filled in
    { reps: null, weight: 50 },      // blank row
    { reps: 7,  weight: 50 },
  ];
  assert.equal(workingSets(sets).length, 2);
  assert.deepEqual(workingSets(sets).map(s => s.reps), [8, 7]);
  assert.deepEqual(workingSets(null), []);
  assert.deepEqual(workingSets(undefined), []);
});

test('topWeight ignores a heavy-looking warmup and reads only working sets', () => {
  // Warmup flagged at a silly-high weight must not become the top weight.
  const sets = [
    { reps: 5, weight: 999, isWarmup: true },
    { reps: 8, weight: 50 },
    { reps: 8, weight: 45 },
  ];
  assert.equal(topWeightOf(sets), 50);
  assert.equal(topSetsOf(sets).length, 1);
});

test('topSets excludes back-off sets below the top weight', () => {
  const sets = [
    { reps: 10, weight: 50 },
    { reps: 10, weight: 50 },
    { reps: 12, weight: 40 },  // back-off
  ];
  assert.equal(topWeightOf(sets), 50);
  assert.equal(topSetsOf(sets).length, 2);
});

test('summarizeSession counts qualifying sets against repsMax', () => {
  const s = summarizeSession(sessionReps('2026-08-01', 50, [10, 10, 9]), 10);
  assert.equal(s.topWeight, 50);
  assert.equal(s.topSetCount, 3);
  assert.equal(s.qualifyingSets, 2);
  assert.equal(s.minTopReps, 9);
  assert.equal(s.maxTopReps, 10);
  assert.equal(s.volume, 50 * (10 + 10 + 9));
});

test('summarizeSession reports a warmup-only session as having no work', () => {
  const s = summarizeSession({
    date: '2026-08-01',
    sets: [{ reps: 10, weight: 20, isWarmup: true }],
  }, 10);
  assert.equal(s.hasWork, false);
});

// ─── defaults ────────────────────────────────────────────────────────────────

test('compound body parts default to 8-10, isolation to 12-15', () => {
  for (const bp of ['chest', 'back', 'legs', 'full_body']) {
    assert.deepEqual(defaultRepTarget(bp), { repsMin: 8, repsMax: 10, sets: 3 }, bp);
  }
  for (const bp of ['arms', 'shoulders', 'core']) {
    assert.deepEqual(defaultRepTarget(bp), { repsMin: 12, repsMax: 15, sets: 3 }, bp);
  }
  assert.deepEqual(defaultRepTarget('cardio'), { repsMin: 8, repsMax: 10, sets: 3 });
  assert.deepEqual(defaultRepTarget(undefined), { repsMin: 8, repsMax: 10, sets: 3 });
});

test('weight step defaults: 5/2.5 lb, 2.5/1.25 kg', () => {
  assert.equal(defaultWeightStep({ weightUnit: 'lb', bodyPart: 'chest' }), 5);
  assert.equal(defaultWeightStep({ weightUnit: 'lb', bodyPart: 'arms'  }), 2.5);
  assert.equal(defaultWeightStep({ weightUnit: 'kg', bodyPart: 'legs'  }), 2.5);
  assert.equal(defaultWeightStep({ weightUnit: 'kg', bodyPart: 'shoulders' }), 1.25);
  // Unknown body part gets the conservative step: too small only costs an extra
  // session, too large pushes straight through the 4-rep floor.
  assert.equal(defaultWeightStep(), 2.5);
  assert.equal(defaultWeightStep({ weightUnit: 'kg' }), 1.25);
});

// ─── target resolution ───────────────────────────────────────────────────────

test('target resolution prefers the user setting over the plan over the default', () => {
  const plan = { repsMin: 8, repsMax: 10, sets: 3 };

  assert.deepEqual(
    resolveTarget({ bodyPart: 'chest', planExercise: plan, setting: null }),
    { repsMin: 8, repsMax: 10, sets: 3, source: 'plan' },
  );

  assert.deepEqual(
    resolveTarget({ bodyPart: 'chest', planExercise: null, setting: null }),
    { repsMin: 8, repsMax: 10, sets: 3, source: 'default' },
  );

  assert.deepEqual(
    resolveTarget({
      bodyPart: 'chest',
      planExercise: plan,
      setting: { repsMin: 12, repsMax: 15, targetSets: 4 },
    }),
    { repsMin: 12, repsMax: 15, sets: 4, source: 'setting' },
  );
});

test('each target field falls back independently', () => {
  // Only targetSets is overridden — the plan keeps supplying the rep window.
  const r = resolveTarget({
    bodyPart: 'chest',
    planExercise: { repsMin: 8, repsMax: 10, sets: 3 },
    setting: { targetSets: 5 },
  });
  assert.equal(r.repsMin, 8);
  assert.equal(r.repsMax, 10);
  assert.equal(r.sets, 5);
  assert.equal(r.source, 'setting');
});

test('a half-specified or reversed rep window never yields repsMax < repsMin', () => {
  // Plan gives a min but no max: the default max (10) is below the min (12).
  const r = resolveTarget({
    bodyPart: 'chest',
    planExercise: { repsMin: 12 },
  });
  assert.equal(r.repsMin, 12);
  assert.ok(r.repsMax >= r.repsMin, `repsMax ${r.repsMax} must be >= repsMin ${r.repsMin}`);

  const reversed = resolveTarget({ bodyPart: 'chest', setting: { repsMin: 15, repsMax: 12 } });
  assert.ok(reversed.repsMax >= reversed.repsMin);
});

test('target set count is clamped to the schema cap', () => {
  assert.equal(resolveTarget({ bodyPart: 'chest', setting: { targetSets: 99 } }).sets, MAX_SETS);
  assert.equal(resolveTarget({ bodyPart: 'chest', setting: { targetSets: 0 } }).sets, 3);
});

test('step resolution prefers the user override', () => {
  assert.deepEqual(
    resolveStep({ weightUnit: 'lb', bodyPart: 'back', setting: { weightStep: 10 } }),
    { step: 10, source: 'setting' },
  );
  assert.deepEqual(
    resolveStep({ weightUnit: 'lb', bodyPart: 'back', setting: null }),
    { step: 5, source: 'default' },
  );
  // A junk override falls through to the default rather than producing NaN.
  assert.equal(resolveStep({ weightUnit: 'lb', bodyPart: 'back', setting: { weightStep: 0 } }).step, 5);
});

// ─── the decision table ──────────────────────────────────────────────────────

test('no history -> no_history, no weight suggested', () => {
  const r = recommendNext({ sessions: [], target: TARGET_8_10, step: 5 });
  assert.equal(r.status, STATUS.NO_HISTORY);
  assert.equal(r.recommendedWeight, null);
  assert.equal(r.repsMin, 8);
  assert.equal(r.repsMax, 10);
});

test('warmup-only history still counts as no history', () => {
  const r = recommendNext({
    sessions: [{ date: '2026-08-01', sets: [{ reps: 10, weight: 20, isWarmup: true }] }],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.NO_HISTORY);
});

test('hold: short of the top of the range on one set', () => {
  const r = recommendNext({
    sessions: [sessionReps('2026-08-01', 50, [10, 10, 9])],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.HOLD);
  assert.equal(r.recommendedWeight, 50);
  assert.equal(r.repsTarget, 10);
  assert.equal(r.setsAtTarget, 2);
  assert.equal(r.setsNeeded, 1);
  assert.equal(r.unlockWeight, 55);
});

test('ready: 8-10 range, all 3 sets at 10 -> next weight with a 4-rep floor', () => {
  const r = recommendNext({
    sessions: [session('2026-08-01', 50, 10, 3)],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.READY);
  assert.equal(r.currentWeight, 50);
  assert.equal(r.recommendedWeight, 55);
  assert.equal(r.repsTarget, MIN_REPS_NEW_WEIGHT);
  assert.equal(r.repsMax, 10);
  assert.equal(r.setsNeeded, 0);
});

test('ready: 12-15 range, all 3 sets at 15 -> next weight', () => {
  const r = recommendNext({
    sessions: [session('2026-08-01', 30, 15, 3)],
    target: TARGET_12_15,
    step: 2.5,
  });
  assert.equal(r.status, STATUS.READY);
  assert.equal(r.recommendedWeight, 32.5);
  assert.equal(r.repsTarget, MIN_REPS_NEW_WEIGHT);
  assert.equal(r.repsMax, 15);
});

test('12-15 range at 14 reps holds — the top of the range means the top', () => {
  const r = recommendNext({
    sessions: [session('2026-08-01', 30, 14, 3)],
    target: TARGET_12_15,
    step: 2.5,
  });
  assert.equal(r.status, STATUS.HOLD);
  assert.equal(r.recommendedWeight, 30);
  assert.equal(r.setsNeeded, 3);
});

test('climb: reps dropped right after a weight increase, still above the floor', () => {
  const r = recommendNext({
    sessions: [
      session('2026-08-08', 55, 6, 3),   // newest — just moved up
      session('2026-08-01', 50, 10, 3),
    ],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.CLIMB);
  assert.equal(r.recommendedWeight, 55);
  assert.equal(r.repsTarget, 10);
  assert.equal(r.climbingFrom, 50);
  assert.equal(r.unlockWeight, 60);
});

test('climb lasts the whole consolidation, not just the session after the jump', () => {
  // Third session at 55 and still short of 10 — the user is mid-climb, not
  // plateaued, and the UI must keep framing it that way.
  const r = recommendNext({
    sessions: [
      sessionReps('2026-08-15', 55, [9, 9, 8]),
      sessionReps('2026-08-11', 55, [8, 8, 7]),
      sessionReps('2026-08-08', 55, [6, 5, 5]),
      session('2026-08-04', 50, 10, 3),
    ],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.CLIMB);
  assert.equal(r.climbingFrom, 50);
});

test('parked at one weight for many sessions is a hold, never a climb', () => {
  const r = recommendNext({
    sessions: [
      sessionReps('2026-08-15', 50, [9, 9, 8]),
      sessionReps('2026-08-11', 50, [9, 8, 8]),
      sessionReps('2026-08-08', 50, [8, 8, 8]),
    ],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.HOLD);
  assert.equal(r.climbingFrom, null);
});

test('rebuilding after a deload is a hold — that weight was handled before', () => {
  const r = recommendNext({
    sessions: [
      sessionReps('2026-08-15', 55, [8, 8, 7]),   // back down to 55
      sessionReps('2026-08-11', 60, [3, 3, 2]),   // 60 was too heavy
      session('2026-08-08', 55, 10, 3),
    ],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.HOLD);
  assert.equal(r.climbingFrom, null);
});

test('deload: under 4 reps at the new weight -> back to the weight that worked', () => {
  const r = recommendNext({
    sessions: [
      session('2026-08-08', 60, 3, 3),
      session('2026-08-01', 55, 10, 3),
    ],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.DELOAD);
  assert.equal(r.recommendedWeight, 55);
});

test('deload with no earlier session steps down by one increment', () => {
  const r = recommendNext({
    sessions: [session('2026-08-08', 60, 2, 3)],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.DELOAD);
  assert.equal(r.recommendedWeight, 55);
});

test('deload never recommends a zero or negative weight', () => {
  const r = recommendNext({
    sessions: [session('2026-08-08', 5, 2, 3)],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.DELOAD);
  assert.ok(r.recommendedWeight > 0, `expected > 0, got ${r.recommendedWeight}`);
  assert.equal(r.recommendedWeight, 5);
});

test('deload takes priority even when some sets hit the target', () => {
  // One good set then a collapse: the best top set is still under the floor
  // only if ALL are; here maxTopReps is 10, so this is NOT a deload.
  const notDeload = recommendNext({
    sessions: [sessionReps('2026-08-08', 60, [10, 3, 2])],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(notDeload.status, STATUS.HOLD);

  // Every top set under 4 -> deload, regardless of set count.
  const deload = recommendNext({
    sessions: [sessionReps('2026-08-08', 60, [3, 3, 2])],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(deload.status, STATUS.DELOAD);
});

test('bodyweight / timed holds progress by reps, never by added weight', () => {
  const r = recommendNext({
    sessions: [session('2026-08-01', 0, 45, 3)],
    target: { repsMin: 30, repsMax: 45, sets: 3 },
    step: 5,
  });
  assert.equal(r.status, STATUS.BODYWEIGHT);
  assert.equal(r.recommendedWeight, 0);
  assert.equal(r.unlockWeight, null);
  assert.equal(r.repsTarget, 45);
});

// ─── set-count interactions ──────────────────────────────────────────────────

test('two sets at the top of the range do not unlock a 3-set target', () => {
  const r = recommendNext({
    sessions: [session('2026-08-01', 50, 10, 2)],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.HOLD);
  assert.equal(r.setsAtTarget, 2);
  assert.equal(r.setsNeeded, 1);
});

test('a 5-set target needs 5 qualifying sets', () => {
  const target = { repsMin: 8, repsMax: 10, sets: 5 };
  assert.equal(recommendNext({ sessions: [session('2026-08-01', 50, 10, 4)], target, step: 5 }).status, STATUS.HOLD);
  assert.equal(recommendNext({ sessions: [session('2026-08-01', 50, 10, 5)], target, step: 5 }).status, STATUS.READY);
});

test('extra sets beyond the target still unlock once enough of them qualify', () => {
  // 4 sets logged, 3 hit 10, the 4th fell to 8. The 3-set prescription is met.
  const r = recommendNext({
    sessions: [sessionReps('2026-08-01', 50, [10, 10, 10, 8])],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.READY);
  assert.equal(r.recommendedWeight, 55);
});

test('warmup sets never block a weight increase', () => {
  const r = recommendNext({
    sessions: [{
      date: '2026-08-01',
      sets: [
        { reps: 12, weight: 20, isWarmup: true },  // light warmup
        { reps: 8,  weight: 35, isWarmup: true },  // ramp-up
        { reps: 10, weight: 50 },
        { reps: 10, weight: 50 },
        { reps: 10, weight: 50 },
      ],
    }],
    target: TARGET_8_10,
    step: 5,
  });
  assert.equal(r.status, STATUS.READY);
  assert.equal(r.currentWeight, 50);
  assert.equal(r.recommendedWeight, 55);
});

test('an unflagged light warmup DOES block the increase (why the flag exists)', () => {
  const r = recommendNext({
    sessions: [{
      date: '2026-08-01',
      sets: [
        { reps: 12, weight: 20 },   // not flagged
        { reps: 10, weight: 50 },
        { reps: 10, weight: 50 },
        { reps: 10, weight: 50 },
      ],
    }],
    target: TARGET_8_10,
    step: 5,
  });
  // Still ready: the 20 lb set is below the top weight so it is not a top set.
  assert.equal(r.status, STATUS.READY);

  // But a lighter set at the SAME weight would count, which is the real hazard.
  const blocked = recommendNext({
    sessions: [sessionReps('2026-08-01', 50, [4, 10, 10, 10])],
    target: { repsMin: 8, repsMax: 10, sets: 4 },
    step: 5,
  });
  assert.equal(blocked.status, STATUS.HOLD);
});

// ─── robustness ──────────────────────────────────────────────────────────────

test('missing target and step fall back instead of producing NaN', () => {
  const r = recommendNext({ sessions: [session('2026-08-01', 50, 10, 3)] });
  assert.equal(r.status, STATUS.READY);
  assert.equal(Number.isFinite(r.recommendedWeight), true);
  assert.equal(r.recommendedWeight, 55);
});

test('no arguments at all returns no_history rather than throwing', () => {
  const r = recommendNext();
  assert.equal(r.status, STATUS.NO_HISTORY);
});

test('kg 1.25 steps stay exact across a full climb', () => {
  let weight = 40;
  for (let i = 0; i < 8; i++) {
    const r = recommendNext({
      sessions: [session('2026-08-01', weight, 15, 3)],
      target: TARGET_12_15,
      step: 1.25,
    });
    weight = r.recommendedWeight;
  }
  assert.equal(weight, 50);
});

// ─── the user's own scenario, end to end ─────────────────────────────────────

test('worked example: bench press 3 x 8-10, step 5 lb, six sessions', () => {
  const history = [];
  const run = () => recommendNext({
    sessions: [...history].reverse(),   // newest first
    target: TARGET_8_10,
    step: 5,
  });

  // 1. 50x10, 50x10, 50x9 -> one set short.
  history.push(sessionReps('2026-08-01', 50, [10, 10, 9]));
  let r = run();
  assert.equal(r.status, STATUS.HOLD);
  assert.equal(r.recommendedWeight, 50);
  assert.equal(r.setsNeeded, 1);
  assert.equal(r.unlockWeight, 55);

  // 2. All three at 10 -> earn 55, with a 4-rep floor.
  history.push(session('2026-08-04', 50, 10, 3));
  r = run();
  assert.equal(r.status, STATUS.READY);
  assert.equal(r.recommendedWeight, 55);
  assert.equal(r.repsTarget, 4);
  assert.equal(r.repsMax, 10);

  // 3. First session at 55: reps collapse to 6/5/5 — expected, above the floor.
  history.push(sessionReps('2026-08-08', 55, [6, 5, 5]));
  r = run();
  assert.equal(r.status, STATUS.CLIMB);
  assert.equal(r.recommendedWeight, 55);
  assert.equal(r.repsTarget, 10);

  // 4. Still climbing at 55: 8/8/7, short of 10 on all three. Two sessions in,
  //    so this only reads as a climb because the engine looks back past the
  //    previous session to the last session at a different weight.
  history.push(sessionReps('2026-08-11', 55, [8, 8, 7]));
  r = run();
  assert.equal(r.status, STATUS.CLIMB);
  assert.equal(r.recommendedWeight, 55);
  assert.equal(r.climbingFrom, 50);
  assert.equal(r.setsAtTarget, 0);

  // 5. Topped out at 55 -> earn 60.
  history.push(session('2026-08-15', 55, 10, 3));
  r = run();
  assert.equal(r.status, STATUS.READY);
  assert.equal(r.recommendedWeight, 60);

  // 6. 60 is too heavy (3/3/2) -> back to 55.
  history.push(sessionReps('2026-08-18', 60, [3, 3, 2]));
  r = run();
  assert.equal(r.status, STATUS.DELOAD);
  assert.equal(r.recommendedWeight, 55);
});

test('worked example: isolation 3 x 12-15, step 2.5 lb', () => {
  const history = [];
  const run = () => recommendNext({
    sessions: [...history].reverse(),
    target: TARGET_12_15,
    step: 2.5,
  });

  history.push(sessionReps('2026-08-01', 25, [15, 15, 13]));
  assert.equal(run().status, STATUS.HOLD);

  history.push(session('2026-08-04', 25, 15, 3));
  let r = run();
  assert.equal(r.status, STATUS.READY);
  assert.equal(r.recommendedWeight, 27.5);
  assert.equal(r.repsTarget, 4);

  history.push(sessionReps('2026-08-08', 27.5, [9, 8, 8]));
  r = run();
  assert.equal(r.status, STATUS.CLIMB);
  assert.equal(r.repsTarget, 15);
  assert.equal(r.unlockWeight, 30);
});
