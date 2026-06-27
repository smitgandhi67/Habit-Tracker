// Pure logic for the Milestone + Brag-sheet ("journey") system of record — no DB.
// Milestones = forward, grade-anchored targets the parent tracks toward.
// Achievements = the backward-looking real-time brag-log of what actually happened.

const MILESTONE_CATEGORIES = ['math', 'competition', 'science', 'building', 'leadership', 'test', 'application', 'writing', 'other'];
const MILESTONE_STATUSES = ['upcoming', 'in_progress', 'done'];

const ACHIEVEMENT_CATEGORIES = ['competition', 'project', 'science-fair', 'leadership', 'service', 'research', 'award', 'test', 'other'];

const MIN_GRADE = 5;
const MAX_GRADE = 12;

// A grade is valid if null (ungrouped) or an integer 5..12.
function validGrade(g) {
  return g === null || g === undefined || (Number.isInteger(g) && g >= MIN_GRADE && g <= MAX_GRADE);
}

// Group items by grade, ascending, with ungraded (null) last. Returns an ordered
// array of { grade, items } so the roadmap renders Grade 5 → 12 → "Someday".
function groupByGrade(items) {
  const buckets = new Map();
  for (const it of items || []) {
    const key = validGrade(it.grade) && it.grade != null ? it.grade : null;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  }
  const grades = [...buckets.keys()].filter(k => k !== null).sort((a, b) => a - b);
  const out = grades.map(g => ({ grade: g, items: buckets.get(g) }));
  if (buckets.has(null)) out.push({ grade: null, items: buckets.get(null) });
  return out;
}

module.exports = {
  MILESTONE_CATEGORIES, MILESTONE_STATUSES, ACHIEVEMENT_CATEGORIES,
  MIN_GRADE, MAX_GRADE, validGrade, groupByGrade,
};
