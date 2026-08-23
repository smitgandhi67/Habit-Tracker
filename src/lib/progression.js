// Client-side companion to server/utils/progression.js.
//
// The SERVER owns the decision. This module owns two things the server
// deliberately does not:
//
//   1. Wording. The server returns a prose-free, structured recommendation
//      because it does not know the user's weight-unit label; the sentences are
//      composed here.
//   2. A live preview. While the user is still typing sets into the modal there
//      is nothing saved for the server to judge, so `previewUnlock` re-derives
//      just the "how many sets have hit the target" count from the draft rows.
//
// `summarizeDraftSets` intentionally mirrors the server's working-set / top-set
// primitives. It is a small, deliberate duplication: the alternative is a round
// trip on every keystroke. It is only ever used for the optimistic preview —
// the authoritative status always comes back from the API after saving.

export const MIN_REPS_NEW_WEIGHT = 4;
export const MAX_SETS = 12;

export const STATUS = {
  NO_HISTORY: 'no_history',
  BODYWEIGHT: 'bodyweight',
  DELOAD:     'deload',
  READY:      'ready',
  CLIMB:      'climb',
  HOLD:       'hold',
};

// ─── formatting ──────────────────────────────────────────────────────────────

// Trim trailing zeros so 32.50 reads as "32.5" and 55.00 as "55".
export function formatWeight(weight, unit) {
  if (weight == null || !Number.isFinite(Number(weight))) return '—';
  const n = Number(weight);
  const text = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  return unit ? `${text} ${unit}` : text;
}

export function formatReps(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list.join(', ');
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// ─── draft-set primitives (mirror of the server's) ───────────────────────────

// Draft rows hold strings (the inputs are uncontrolled numbers), so everything
// is coerced before it is compared.
export function summarizeDraftSets(sets) {
  const working = (sets || []).filter(s => s && !s.isWarmup && Number(s.reps) > 0);
  if (working.length === 0) {
    return { hasWork: false, topWeight: 0, topSetCount: 0, topReps: [], maxTopReps: 0 };
  }
  const weights = working.map(s => Number(s.weight) || 0);
  const topWeight = Math.round(Math.max(...weights) * 100) / 100;
  const topSets = working.filter(s => Math.round((Number(s.weight) || 0) * 100) / 100 === topWeight);
  const topReps = topSets.map(s => Number(s.reps) || 0);
  return {
    hasWork: true,
    topWeight,
    topSetCount: topSets.length,
    topReps,
    maxTopReps: topReps.length ? Math.max(...topReps) : 0,
  };
}

/**
 * Optimistic "will this session unlock the next weight?" line for the entry
 * modal, computed from rows the user has not saved yet.
 *
 * @returns {{ text: string, tone: string }|null} null when there is nothing
 *          useful to say (no reps entered, or no target resolved yet).
 */
export function previewUnlock({ sets, target, step, unit }) {
  if (!target) return null;
  const s = summarizeDraftSets(sets);
  if (!s.hasWork) return null;

  const { repsMax, sets: targetSets } = target;
  const qualifying = s.topReps.filter(r => r >= repsMax).length;
  const nextWeight = Math.round((s.topWeight + (step || 0)) * 100) / 100;

  if (s.topWeight > 0 && s.maxTopReps < MIN_REPS_NEW_WEIGHT) {
    return {
      tone: 'bg-red-50 border-red-200 text-red-700',
      text: `Under ${MIN_REPS_NEW_WEIGHT} reps at ${formatWeight(s.topWeight, unit)} — that jump looks too big. Drop back a step next time.`,
    };
  }

  if (qualifying >= targetSets) {
    if (s.topWeight === 0) {
      return {
        tone: 'bg-emerald-50 border-emerald-200 text-emerald-700',
        text: `${repsMax} reps on all ${targetSets} sets — time to add reps or load.`,
      };
    }
    return {
      tone: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      text: `${repsMax} reps on ${plural(targetSets, 'set')} — this unlocks ${formatWeight(nextWeight, unit)} next session.`,
    };
  }

  const remaining = targetSets - qualifying;
  return {
    tone: 'bg-slate-50 border-slate-200 text-slate-600',
    text: `${qualifying}/${targetSets} sets at ${repsMax} reps — ${plural(remaining, 'more set')} to unlock ${formatWeight(nextWeight, unit)}.`,
  };
}

// ─── describing a saved recommendation ───────────────────────────────────────

// Tailwind classes per status, so every surface (modal card, plan chip, log
// badge) tints the same way for the same state.
export function statusTone(status) {
  switch (status) {
    case STATUS.READY:
      return {
        card:  'bg-emerald-50 border-emerald-200',
        text:  'text-emerald-700',
        chip:  'bg-emerald-50 border-emerald-200 text-emerald-700',
        accent:'text-emerald-600',
      };
    case STATUS.DELOAD:
      return {
        card:  'bg-red-50 border-red-200',
        text:  'text-red-700',
        chip:  'bg-red-50 border-red-200 text-red-700',
        accent:'text-red-600',
      };
    case STATUS.CLIMB:
      return {
        card:  'bg-violet-50 border-violet-200',
        text:  'text-violet-700',
        chip:  'bg-violet-50 border-violet-200 text-violet-700',
        accent:'text-violet-600',
      };
    default:
      return {
        card:  'bg-slate-50 border-slate-200',
        text:  'text-slate-700',
        chip:  'bg-slate-50 border-slate-200 text-slate-600',
        accent:'text-slate-500',
      };
  }
}

/**
 * Turn the server's structured recommendation into the sentences the UI shows.
 *
 * @returns {{ headline, repsLine, why, weight, status, short }}
 *   headline — the instruction, e.g. "Move up to 55 lb"
 *   repsLine — the rep goal for that weight, e.g. "4+ reps · build to 10"
 *   why      — what in the last session caused this
 *   short    — one-line form for chips and badges
 */
export function describeRecommendation(rec, target, unit) {
  if (!rec) return null;

  const w      = weight => formatWeight(weight, unit);
  const repsMax = rec.repsMax ?? target?.repsMax;
  const repsMin = rec.repsMin ?? target?.repsMin;
  const sets    = rec.targetSets ?? target?.sets;

  switch (rec.status) {
    case STATUS.NO_HISTORY:
      return {
        status: rec.status,
        weight: null,
        headline: 'First time on this one',
        repsLine: `Target ${repsMin}-${repsMax} reps × ${sets} sets`,
        why: 'Pick a weight where the last two reps are hard but you still have 1-2 in the tank.',
        short: `${repsMin}-${repsMax} reps`,
      };

    case STATUS.BODYWEIGHT:
      return {
        status: rec.status,
        weight: 0,
        headline: `Build to ${repsMax}`,
        repsLine: `${sets} sets · bodyweight`,
        why: rec.lastTopReps?.length
          ? `Last time: ${formatReps(rec.lastTopReps)}.`
          : '',
        short: `${repsMax} reps`,
      };

    case STATUS.READY:
      return {
        status: rec.status,
        weight: rec.recommendedWeight,
        headline: `Move up to ${w(rec.recommendedWeight)}`,
        repsLine: `${MIN_REPS_NEW_WEIGHT}+ reps · build back to ${repsMax}`,
        why: `You hit ${repsMax} reps on ${plural(sets, 'set')} at ${w(rec.currentWeight)}.`,
        short: w(rec.recommendedWeight),
      };

    case STATUS.CLIMB:
      return {
        status: rec.status,
        weight: rec.recommendedWeight,
        headline: `Stay at ${w(rec.recommendedWeight)}`,
        repsLine: rec.lastTopReps?.length
          ? `Build ${Math.max(...rec.lastTopReps)} → ${repsMax} reps`
          : `Build to ${repsMax} reps`,
        why: rec.climbingFrom != null
          ? `You moved up from ${w(rec.climbingFrom)} — reps dropping is expected. ${w(rec.unlockWeight)} unlocks at ${repsMax} × ${sets}.`
          : `${w(rec.unlockWeight)} unlocks at ${repsMax} reps × ${sets} sets.`,
        short: w(rec.recommendedWeight),
      };

    case STATUS.DELOAD:
      return {
        status: rec.status,
        weight: rec.recommendedWeight,
        headline: `Drop back to ${w(rec.recommendedWeight)}`,
        repsLine: `Rebuild to ${repsMax} reps × ${sets} sets`,
        why: `${w(rec.currentWeight)} came in under ${MIN_REPS_NEW_WEIGHT} reps — that is too heavy to build from.`,
        short: w(rec.recommendedWeight),
      };

    case STATUS.HOLD:
    default: {
      const remaining = rec.setsNeeded ?? sets;
      return {
        status: STATUS.HOLD,
        weight: rec.recommendedWeight,
        headline: `Stay at ${w(rec.recommendedWeight)}`,
        repsLine: `${repsMax} reps × ${sets} sets`,
        why: rec.setsAtTarget > 0
          ? `${rec.setsAtTarget}/${sets} sets at ${repsMax} last time — ${plural(remaining, 'more set')} unlocks ${w(rec.unlockWeight)}.`
          : `Hit ${repsMax} reps on all ${sets} sets to unlock ${w(rec.unlockWeight)}.`,
        short: w(rec.recommendedWeight),
      };
    }
  }
}

// Short label for the target itself, e.g. "3 × 8-10".
export function formatTarget(target) {
  if (!target) return '';
  const reps = target.repsMin === target.repsMax
    ? `${target.repsMax}`
    : `${target.repsMin}-${target.repsMax}`;
  return `${target.sets} × ${reps}`;
}
