// Target-domain selection — handover_1.md §8 scoring→action: "Target the 1–3
// lowest-scoring FOUNDATIONAL domains (2,3,4) first, then the lowest others."
//
// Foundations gate the rest, so a weak foundation always outranks a weak non-
// foundation. We only surface domains below a gentle threshold — when everything
// is solid we return [] rather than manufacturing a problem (measurement-ethics
// guardrail: don't turn childhood into a performance review).

const { DOMAINS } = require('./domains');

const byKey = new Map(DOMAINS.map(d => [d.key, d]));

function computeTargets(dimensions, opts = {}) {
  const limit = opts.limit ?? 3;
  const threshold = opts.threshold ?? 0.6;

  const rows = (dimensions || []).map(d => {
    const dom = byKey.get(d.key);
    return {
      key: d.key,
      score: d.score,
      foundational: !!dom?.foundational,
      num: dom?.num ?? 999,
      name: dom?.name || d.key,
    };
  });

  const asc = (a, b) => a.score - b.score || a.num - b.num;

  // Weak foundations first; only fall through to non-foundations if no foundation
  // is below threshold.
  const foundLow = rows.filter(r => r.foundational && r.score < threshold).sort(asc);
  if (foundLow.length) return foundLow.slice(0, limit);

  const otherLow = rows.filter(r => !r.foundational && r.score < threshold).sort(asc);
  return otherLow.slice(0, limit);
}

module.exports = { computeTargets };
