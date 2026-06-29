// Pure logic for the Builder / Problem-Solver track (no DB) — unit-tested.
// The route (routes/build.js) owns persistence; this owns the rules so they're cheap
// to test and tune. The single spendable currency is shared with math practice, so
// Builder actions credit the same wallet.

// Point values — tune here.
const POINTS = { problem: 2, ship: 25, problemSolved: 100 };
const DAILY_PROBLEM_CAP = 3; // only the first N problems logged per day earn points (anti-farm)

const PROBLEM_KINDS = ['annoyance', 'curiosity', 'idea'];
// 'done' = kid marked the problem solved; sends a 100-pt award for parent approval.
const PROBLEM_STATUSES = ['logged', 'tinkering', 'parked', 'done'];

// AI-fluency ladder (doc: helper → tool → partner → multiplier). A kid's badge is the
// highest level reached by any SHIPPED project; shipped count drives the "next" hint.
const FLUENCY_LEVELS = ['helper', 'tool', 'partner', 'multiplier'];

function fluencyRank(level) {
  const i = FLUENCY_LEVELS.indexOf(level);
  return i < 0 ? 0 : i;
}

// Points for logging a problem given how many already earned today.
function problemAward(creditedToday) {
  return creditedToday < DAILY_PROBLEM_CAP ? POINTS.problem : 0;
}

// The "explain every line" ship gate: a project ships only if it has a title and the
// kid attests they can explain every part ("if you can't teach it, you don't ship it").
function canShip(project, explainedIt) {
  if (!project) return { ok: false, error: 'Project not found' };
  if (project.shippedAt) return { ok: false, error: 'Already shipped' };
  if (!String(project.title || '').trim()) return { ok: false, error: 'Project needs a title' };
  if (explainedIt !== true) {
    return { ok: false, error: "Can't ship until you can explain every part" };
  }
  return { ok: true };
}

// Highest fluency reached across shipped projects → the kid's badge.
function topFluency(shippedProjects) {
  const list = shippedProjects || [];
  let rank = 0;
  for (const p of list) rank = Math.max(rank, fluencyRank(p.aiLevel));
  return { level: rank, label: FLUENCY_LEVELS[rank], shipped: list.length };
}

module.exports = {
  POINTS, DAILY_PROBLEM_CAP, PROBLEM_KINDS, PROBLEM_STATUSES, FLUENCY_LEVELS,
  fluencyRank, problemAward, canShip, topFluency,
};
