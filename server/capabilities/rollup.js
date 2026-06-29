// Cross-track domain rollup (handover_1.md §9 — "tracks progress" across the whole
// app, not just within the Skills module). Counts per-domain "reps" a child has
// accumulated over a window, drawing from BOTH capability activity logs AND the
// existing tracks the app already records:
//
//   math    (MathDailyStat.correct)        -> cognitive
//   builder (ProblemEntry + shipped Build)  -> cognitive + agency
//   gym     (GymEntry)                       -> physical
//   habits  (HabitLog 'done', tagged Habit) -> the habit's domainKeys
//   activities (CapabilityActivityLog)       -> the activity's snapshot domainKeys
//
// RISK R7: this is READ-ONLY aggregation. It NEVER writes the points ledger or any
// track — it only counts what other features already recorded. A rep here is a
// signal of practice, deliberately NOT a reward (no double-crediting).

const { DOMAINS, isDomainKey } = require('./domains');

const CapabilityActivityLog = require('../models/CapabilityActivityLog');
const MathDailyStat = require('../models/MathDailyStat');
const ProblemEntry = require('../models/ProblemEntry');
const BuildProject = require('../models/BuildProject');
const GymEntry = require('../models/GymEntry');
const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const CapabilityAttempt = require('../models/CapabilityAttempt');

const SOURCES = ['activities', 'math', 'builder', 'gym', 'habits'];
const DEFAULT_WINDOW_DAYS = 90;
const REASSESS_DAYS = 90;

// 'YYYY-MM-DD' for `days` ago (UTC is fine — window bounds, not display).
function ymdDaysAgo(days, now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// --- pure aggregation -------------------------------------------------------
// contributions: [{ source, domains: [key], reps }]. Folds them into one row per
// domain (all 10, in registry order) with a per-source breakdown. Unknown domain
// keys and non-positive reps are ignored. Pure + dependency-free -> unit tested.
function rollupFromContributions(contributions = []) {
  const rows = new Map(
    DOMAINS.map(d => [d.key, {
      key: d.key, name: d.name, short: d.short, num: d.num,
      foundational: d.foundational,
      reps: 0,
      sources: Object.fromEntries(SOURCES.map(s => [s, 0])),
    }]),
  );

  for (const c of contributions) {
    const reps = Number(c.reps) || 0;
    if (reps <= 0) continue;
    const source = SOURCES.includes(c.source) ? c.source : null;
    for (const key of c.domains || []) {
      const row = rows.get(key);
      if (!row) continue; // unknown domain -> skip
      row.reps += reps;
      if (source) row.sources[source] += reps;
    }
  }

  const domains = [...rows.values()].sort((a, b) => a.num - b.num);
  const totalReps = domains.reduce((sum, d) => sum + d.reps, 0);
  return { domains, totalReps };
}

// --- DB-backed builder ------------------------------------------------------
// Gathers a child's reps across every track and folds them. childUserId is the
// kid's own user id (= subjectUserId on activity logs, = userId on every track).
async function buildDomainRollup(childUserId, { since, now = new Date() } = {}) {
  const sinceYmd = (typeof since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(since))
    ? since
    : ymdDaysAgo(DEFAULT_WINDOW_DAYS, now);
  const sinceDate = new Date(`${sinceYmd}T00:00:00.000Z`);

  const [activityLogs, mathStats, problemCount, projectCount, gymCount, taggedHabits, lastAttempt] =
    await Promise.all([
      CapabilityActivityLog.find({ subjectUserId: childUserId, date: { $gte: sinceYmd } })
        .select('domainKeys').lean(),
      MathDailyStat.find({ userId: childUserId, date: { $gte: sinceYmd } })
        .select('correct').lean(),
      ProblemEntry.countDocuments({ userId: childUserId, date: { $gte: sinceYmd } }),
      BuildProject.countDocuments({ userId: childUserId, shippedAt: { $ne: null, $gte: sinceDate } }),
      GymEntry.countDocuments({ userId: childUserId, date: { $gte: sinceYmd } }),
      Habit.find({ userId: childUserId, archivedAt: null, domainKeys: { $exists: true, $ne: [] } })
        .select('_id domainKeys').lean(),
      CapabilityAttempt.findOne({ subjectUserId: childUserId })
        .sort({ completedAt: -1 }).select('completedAt').lean(),
    ]);

  const contributions = [];

  // Capability activity logs — one rep each, to the snapshotted domains.
  for (const log of activityLogs) {
    contributions.push({ source: 'activities', domains: log.domainKeys || [], reps: 1 });
  }

  // Math — first-try-correct answers are the reps; all land in cognitive.
  const mathReps = mathStats.reduce((sum, s) => sum + (s.correct || 0), 0);
  if (mathReps > 0) contributions.push({ source: 'math', domains: ['cognitive'], reps: mathReps });

  // Builder — problems noticed + projects shipped: problem-solving (cognitive) + agency.
  const builderReps = problemCount + projectCount;
  if (builderReps > 0) contributions.push({ source: 'builder', domains: ['cognitive', 'agency'], reps: builderReps });

  // Gym — each logged session is a physical rep.
  if (gymCount > 0) contributions.push({ source: 'gym', domains: ['physical'], reps: gymCount });

  // Habits — only domain-tagged habits, counting 'done' logs in the window.
  if (taggedHabits.length) {
    const doneCounts = await Promise.all(
      taggedHabits.map(h =>
        HabitLog.countDocuments({ habitId: h._id, userId: childUserId, date: { $gte: sinceYmd }, status: 'done' })),
    );
    taggedHabits.forEach((h, i) => {
      const reps = doneCounts[i];
      const domains = (h.domainKeys || []).filter(isDomainKey);
      if (reps > 0 && domains.length) contributions.push({ source: 'habits', domains, reps });
    });
  }

  const { domains, totalReps } = rollupFromContributions(contributions);

  const lastAt = lastAttempt?.completedAt || null;
  const daysSince = lastAt ? Math.floor((now - new Date(lastAt)) / 86400000) : null;

  return {
    childUserId: String(childUserId),
    since: sinceYmd,
    generatedAt: now.toISOString(),
    domains,
    totalReps,
    baseline: {
      lastAt,
      daysSince,
      // No baseline yet, or older than a quarter -> nudge a re-take (§9 quarterly).
      needsReassessment: lastAt == null || daysSince >= REASSESS_DAYS,
    },
  };
}

module.exports = {
  rollupFromContributions,
  buildDomainRollup,
  ymdDaysAgo,
  SOURCES,
  DEFAULT_WINDOW_DAYS,
  REASSESS_DAYS,
};
