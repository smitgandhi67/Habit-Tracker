// Parent dashboard aggregator (handover_1.md §9 — the per-kid "system of record").
// Pulls one child's whole capability picture into a single payload: baseline radar
// (parent + kid), focus areas, the cross-track domain rollup, activity cadence, and a
// snapshot of the signals the rest of the app already records (math, builder, journey).
//
// Two guardrails:
//  - READ-ONLY (R7): aggregates existing data, never writes a ledger or a track.
//  - parentView gating: the kid's own view is read-only and OMITS the parent-facing
//    pieces — focus areas/targets, roadmap milestones, and the parent's ratings —
//    mirroring the journey principle "the kid sees achievements, not targets" (R5).

const { gapReport } = require('../parenting/scoring');
const { computeTargets } = require('./targets');
const { buildDomainRollup } = require('./rollup');
const { topFluency } = require('../utils/builder');

const CapabilityAttempt = require('../models/CapabilityAttempt');
const CapabilityActivityLog = require('../models/CapabilityActivityLog');
const MathDailyStat = require('../models/MathDailyStat');
const ProblemEntry = require('../models/ProblemEntry');
const BuildProject = require('../models/BuildProject');
const Achievement = require('../models/Achievement');
const Milestone = require('../models/Milestone');
const User = require('../models/User');

// --- pure helpers (unit-tested) ---------------------------------------------

// Fold a window of MathDailyStat rows into totals + active-day count.
function foldMathStats(rows = []) {
  return rows.reduce((a, s) => ({
    correct: a.correct + (s.correct || 0),
    points: a.points + (s.points || 0),
    activeDays: a.activeDays + ((s.correct || 0) > 0 ? 1 : 0),
  }), { correct: 0, points: 0, activeDays: 0 });
}

// Roadmap milestones -> { total, done } (parent-only; never shown to the kid).
function summarizeMilestones(rows = []) {
  return { total: rows.length, done: rows.filter(m => m.status === 'done').length };
}

function serializeLog(l) {
  return { title: l.title, date: l.date, domainKeys: l.domainKeys || [], activitySlug: l.activitySlug };
}

// --- builder ----------------------------------------------------------------

async function buildDashboard(childUserId, { parentView = true, now = new Date() } = {}) {
  const rollup = await buildDomainRollup(childUserId, { now });
  const sinceYmd = rollup.since;

  const [child, parentA, kidA, recentLogs, windowReps, mathRows, problems, shipped, achievements, milestones] =
    await Promise.all([
      User.findById(childUserId).select('name email').lean(),
      CapabilityAttempt.findOne({ instrumentKey: 'parent_baseline', subjectUserId: childUserId })
        .sort({ completedAt: -1 }).lean(),
      CapabilityAttempt.findOne({ instrumentKey: 'kid_baseline', subjectUserId: childUserId })
        .sort({ completedAt: -1 }).lean(),
      CapabilityActivityLog.find({ subjectUserId: childUserId }).sort({ date: -1, createdAt: -1 }).limit(5).lean(),
      CapabilityActivityLog.countDocuments({ subjectUserId: childUserId, date: { $gte: sinceYmd } }),
      MathDailyStat.find({ userId: childUserId, date: { $gte: sinceYmd } }).select('correct points').lean(),
      ProblemEntry.countDocuments({ userId: childUserId, date: { $gte: sinceYmd } }),
      BuildProject.find({ userId: childUserId, shippedAt: { $ne: null } }).select('aiLevel').lean(),
      Achievement.countDocuments({ userId: childUserId }),
      parentView
        ? Milestone.find({ userId: childUserId }).select('status').lean()
        : Promise.resolve(null),
    ]);

  const parentDims = parentA?.dimensions || [];
  const kidDims = kidA?.dimensions || [];

  const out = {
    childUserId: String(childUserId),
    childName: child?.name || 'Child',
    since: sinceYmd,
    generatedAt: now.toISOString(),
    parentView,
    baseline: {
      lastAt: rollup.baseline.lastAt,
      daysSince: rollup.baseline.daysSince,
      needsReassessment: rollup.baseline.needsReassessment,
      // The kid never sees the parent's ratings of them.
      parent: parentView
        ? { hasData: !!parentA, dimensions: parentDims, completedAt: parentA?.completedAt || null }
        : { hasData: false, dimensions: [], completedAt: null },
      kid: { hasData: !!kidA, dimensions: kidDims, completedAt: kidA?.completedAt || null },
    },
    rollup: { domains: rollup.domains, totalReps: rollup.totalReps },
    cadence: {
      windowReps,
      lastAt: recentLogs[0]?.date || null,
      recent: recentLogs.map(serializeLog),
    },
    tracks: {
      math: foldMathStats(mathRows),
      builder: { problems, ...topFluency(shipped) },
      journey: {
        achievements,
        // Targets (milestones) are parent-only; kid view gets null.
        milestones: parentView ? summarizeMilestones(milestones) : null,
      },
    },
  };

  // Parent-only analysis: focus areas + the parent↔kid divergences worth a chat.
  if (parentView) {
    out.baseline.targets = parentA ? computeTargets(parentDims) : [];
    out.baseline.gap = (parentA && kidA)
      ? gapReport(parentDims, kidDims).filter(g => g.alignment !== 'aligned')
      : [];
  }

  return out;
}

module.exports = { buildDashboard, foldMathStats, summarizeMilestones };
