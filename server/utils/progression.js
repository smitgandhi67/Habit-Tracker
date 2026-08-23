// Progressive-overload engine for the Gym module.
//
// Pure functions, no I/O and no prose: callers pass in sessions + a target and
// get back a structured decision. All user-facing wording lives in the client
// (src/lib/progression.js) because it needs the user's weight-unit label.
//
// ─── The rule this implements ────────────────────────────────────────────────
//
// An exercise has a target: `{ repsMin, repsMax, sets }`, e.g. 3 x 8-10.
// You stay at a weight until you hit the TOP of the rep range on the required
// number of sets. That earns the next weight. At the new weight reps collapse,
// and that is expected: the floor is MIN_REPS_NEW_WEIGHT (4). You then climb
// back up to repsMax over as many sessions as it takes, and the cycle repeats.
//
//   3 x 8-10 : 50x10, 50x10, 50x10  ->  move to 55, aim 4+, build back to 10
//   3 x 12-15: 30x15, 30x15, 30x15  ->  move to 32.5, aim 4+, build back to 15
//
// Dropping below the 4-rep floor means the jump was too big — recommend going
// back down rather than grinding.
//
// ─── Why nothing is persisted ────────────────────────────────────────────────
//
// The recommendation is DERIVED from logged history on every read. Ignoring a
// suggestion, deloading on your own, or editing an old entry all self-correct on
// the next read. There is no "current target weight" row to drift out of sync.

// Minimum reps expected at a freshly increased weight. Below this the jump was
// too large and the engine recommends stepping back down.
const MIN_REPS_NEW_WEIGHT = 4;

// Used when neither a user override nor a plan prescribes a set count.
const DEFAULT_TARGET_SETS = 3;

// Mirrors GymEntry.MAX_SETS_PER_ENTRY. Kept here so the pure module has no
// model dependency; models/GymEntry.js is the schema-level authority.
const MAX_SETS = 12;

const COMPOUND_PARTS = ['chest', 'back', 'legs', 'full_body'];

const STATUS = {
  NO_HISTORY: 'no_history',
  BODYWEIGHT: 'bodyweight',
  DELOAD:     'deload',
  READY:      'ready',
  CLIMB:      'climb',
  HOLD:       'hold',
};

// ─── numeric helpers ─────────────────────────────────────────────────────────

// Weights are entered in 2.5 / 1.25 increments, so repeated addition can drift
// (0.1 + 0.2 territory). Every weight leaving this module passes through here.
function roundWeight(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function toPositiveNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNonNegativeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// ─── set / session primitives ────────────────────────────────────────────────

// Working sets are what the engine judges: warmups are excluded, and so are
// rows with no reps (a blank line the user never filled in).
function workingSets(sets) {
  if (!Array.isArray(sets)) return [];
  return sets.filter(s => s && !s.isWarmup && toNonNegativeNumber(s.reps) > 0);
}

// Heaviest load across the working sets. 0 means bodyweight or a timed hold.
function topWeightOf(sets) {
  const working = workingSets(sets);
  if (working.length === 0) return 0;
  return roundWeight(Math.max(...working.map(s => toNonNegativeNumber(s.weight))));
}

// The sets performed at the session's top weight — the ones that decide whether
// the weight goes up. Back-off and drop sets sit below it and are ignored.
function topSetsOf(sets) {
  const working = workingSets(sets);
  const top = topWeightOf(sets);
  return working.filter(s => roundWeight(toNonNegativeNumber(s.weight)) === top);
}

// Collapse one logged session into the handful of numbers the decision needs.
function summarizeSession(session, repsMax) {
  const sets = session?.sets || [];
  const working = workingSets(sets);
  const topWeight = topWeightOf(sets);
  const topSets = topSetsOf(sets);
  const reps = topSets.map(s => toNonNegativeNumber(s.reps));
  const goal = toPositiveNumber(repsMax);

  return {
    date:          session?.date || null,
    hasWork:       working.length > 0,
    topWeight,
    topSetCount:   topSets.length,
    workingSetCount: working.length,
    topReps:       reps,
    minTopReps:    reps.length ? Math.min(...reps) : 0,
    maxTopReps:    reps.length ? Math.max(...reps) : 0,
    // Sets that reached the top of the rep range — the currency of progression.
    qualifyingSets: goal ? reps.filter(r => r >= goal).length : 0,
    // Total load moved, for the client's "volume" line.
    volume:        working.reduce((n, s) =>
      n + toNonNegativeNumber(s.reps) * toNonNegativeNumber(s.weight), 0),
  };
}

// ─── defaults ────────────────────────────────────────────────────────────────

// The app's own convention (see the Coaching guide): compounds run heavy in the
// 8-10 window, isolation work runs lighter for 12-15.
function defaultRepTarget(bodyPart) {
  if (COMPOUND_PARTS.includes(bodyPart)) {
    return { repsMin: 8, repsMax: 10, sets: DEFAULT_TARGET_SETS };
  }
  if (bodyPart === 'arms' || bodyPart === 'shoulders' || bodyPart === 'core') {
    return { repsMin: 12, repsMax: 15, sets: DEFAULT_TARGET_SETS };
  }
  // cardio / unknown: nominal window. Weight progression is not really
  // meaningful here, but the engine still needs numbers to reason with.
  return { repsMin: 8, repsMax: 10, sets: DEFAULT_TARGET_SETS };
}

// Smallest jump that is actually loadable. Big muscles get the bigger plate.
function defaultWeightStep({ weightUnit = 'lb', bodyPart } = {}) {
  const isCompound = COMPOUND_PARTS.includes(bodyPart);
  if (weightUnit === 'kg') return isCompound ? 2.5 : 1.25;
  return isCompound ? 5 : 2.5;
}

// ─── resolution: setting -> plan -> default ──────────────────────────────────

// Resolve the rep/set prescription. Each field falls back independently, so a
// user who only overrides `targetSets` keeps the plan's rep window.
function resolveTarget({ bodyPart, setting, planExercise } = {}) {
  const fallback = defaultRepTarget(bodyPart);

  const pick = (settingVal, planVal, defaultVal) => {
    const s = toPositiveNumber(settingVal);
    if (s !== null) return { value: s, source: 'setting' };
    const p = toPositiveNumber(planVal);
    if (p !== null) return { value: p, source: 'plan' };
    return { value: defaultVal, source: 'default' };
  };

  const min  = pick(setting?.repsMin,    planExercise?.repsMin, fallback.repsMin);
  const max  = pick(setting?.repsMax,    planExercise?.repsMax, fallback.repsMax);
  const sets = pick(setting?.targetSets, planExercise?.sets,    fallback.sets);

  // A half-specified window (only a min, or a reversed pair) must not produce a
  // repsMax below repsMin — that would make the target instantly unreachable.
  const repsMin = Math.max(1, Math.round(min.value));
  const repsMax = Math.max(repsMin, Math.round(max.value));

  // The most specific source wins the label, so the UI can say where the
  // prescription came from and offer to change it.
  const rank = { setting: 3, plan: 2, default: 1 };
  const source = [min, max, sets].reduce(
    (best, cur) => (rank[cur.source] > rank[best.source] ? cur : best),
  ).source;

  return {
    repsMin,
    repsMax,
    sets: Math.min(MAX_SETS, Math.max(1, Math.round(sets.value))),
    source,
  };
}

function resolveStep({ weightUnit, bodyPart, setting } = {}) {
  const override = toPositiveNumber(setting?.weightStep);
  if (override !== null) return { step: roundWeight(override), source: 'setting' };
  return { step: defaultWeightStep({ weightUnit, bodyPart }), source: 'default' };
}

// ─── the decision ────────────────────────────────────────────────────────────

/**
 * Decide what to lift next.
 *
 * @param {object[]} sessions  Logged sessions for ONE exercise, newest first.
 *                             Each: { date, sets: [{ reps, weight, isWarmup }] }
 * @param {object}   target    { repsMin, repsMax, sets } from resolveTarget.
 * @param {number}   step      Weight increment from resolveStep.
 * @returns {object} Structured, prose-free recommendation.
 */
function recommendNext({ sessions = [], target, step } = {}) {
  const t = {
    repsMin: toPositiveNumber(target?.repsMin) || 8,
    repsMax: toPositiveNumber(target?.repsMax) || 10,
    sets:    toPositiveNumber(target?.sets)    || DEFAULT_TARGET_SETS,
  };
  const inc = toPositiveNumber(step) || 5;

  const base = {
    repsMin:      t.repsMin,
    repsMax:      t.repsMax,
    targetSets:   t.sets,
    step:         roundWeight(inc),
    repsFloor:    MIN_REPS_NEW_WEIGHT,
    currentWeight: 0,
    recommendedWeight: null,
    repsTarget:   t.repsMax,
    setsAtTarget: 0,
    setsNeeded:   t.sets,
    unlockWeight: null,
    climbingFrom: null,
    lastDate:     null,
    lastTopReps:  [],
  };

  // Only sessions that actually contain working sets can inform the decision;
  // a warmup-only or empty entry is skipped rather than treated as a failure.
  const graded = sessions
    .map(s => summarizeSession(s, t.repsMax))
    .filter(s => s.hasWork);

  if (graded.length === 0) {
    return { ...base, status: STATUS.NO_HISTORY, recommendedWeight: null };
  }

  const last = graded[0];
  const prev = graded[1] || null;

  const common = {
    ...base,
    currentWeight: last.topWeight,
    setsAtTarget:  last.qualifyingSets,
    setsNeeded:    Math.max(0, t.sets - last.qualifyingSets),
    lastDate:      last.date,
    lastTopReps:   last.topReps,
  };

  // Bodyweight / timed holds: there is no weight to add, so progression is by
  // reps alone. Saying "add 5 lb to your plank" would be nonsense.
  if (last.topWeight === 0) {
    return {
      ...common,
      status: STATUS.BODYWEIGHT,
      recommendedWeight: 0,
      repsTarget: t.repsMax,
      unlockWeight: null,
    };
  }

  // Below the floor: the jump was too big. Go back to the weight that was
  // working, or one step down if there is no earlier session to fall back to.
  if (last.maxTopReps < MIN_REPS_NEW_WEIGHT) {
    const priorWorking = prev && prev.topWeight > 0 && prev.topWeight < last.topWeight
      ? prev.topWeight
      : null;
    // Never recommend a non-positive weight — floor the step-down at one step.
    const steppedDown = Math.max(inc, roundWeight(last.topWeight - inc));
    return {
      ...common,
      status: STATUS.DELOAD,
      recommendedWeight: roundWeight(priorWorking ?? steppedDown),
      repsTarget: t.repsMax,
      unlockWeight: null,
    };
  }

  // Earned it: repsMax reached on enough sets at the top weight.
  if (last.qualifyingSets >= t.sets) {
    const next = roundWeight(last.topWeight + inc);
    return {
      ...common,
      status: STATUS.READY,
      recommendedWeight: next,
      // At a new weight the immediate goal is the floor, not the ceiling.
      repsTarget: MIN_REPS_NEW_WEIGHT,
      setsNeeded: 0,
      unlockWeight: next,
    };
  }

  // Not there yet — hold the weight. `climb` is the same decision as `hold` but
  // distinguishes "you stepped up to this weight and are still building the reps
  // back" from "you have been parked here and are still short". The UI words the
  // two differently: dropping to 6 reps is progress in the first case and a
  // plateau in the second.
  //
  // Climbing lasts for the WHOLE consolidation, not just the session right after
  // the jump, so this looks back to the last session at a different weight
  // rather than only at the previous session. A step back down (deload, then
  // rebuilding at a weight already handled) is a hold, not a climb.
  const lastDifferent = graded.slice(1).find(s => s.topWeight !== last.topWeight);
  const isClimbing = !!lastDifferent
    && lastDifferent.topWeight > 0
    && lastDifferent.topWeight < last.topWeight;

  return {
    ...common,
    status: isClimbing ? STATUS.CLIMB : STATUS.HOLD,
    recommendedWeight: last.topWeight,
    repsTarget: t.repsMax,
    // Weight this session's top reps were climbing from, so the UI can show
    // "build 6 -> 10" rather than a bare rep goal.
    climbingFrom: isClimbing ? lastDifferent.topWeight : null,
    unlockWeight: roundWeight(last.topWeight + inc),
  };
}

module.exports = {
  MIN_REPS_NEW_WEIGHT,
  DEFAULT_TARGET_SETS,
  MAX_SETS,
  STATUS,
  roundWeight,
  workingSets,
  topWeightOf,
  topSetsOf,
  summarizeSession,
  defaultRepTarget,
  defaultWeightStep,
  resolveTarget,
  resolveStep,
  recommendNext,
};
