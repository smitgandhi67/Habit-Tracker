// Pack template registry — the machine-readable Depth Pack curricula.
// Templates are pure data; programs reference them by key (TrainingProgram.packKey).

const { PACK: learningToLearn } = require('./learningToLearn');
const { PACK: communicationPrecision } = require('./communicationPrecision');

const PACKS = new Map([
  [learningToLearn.key, learningToLearn],
  [communicationPrecision.key, communicationPrecision],
]);

const listPacks = () => [...PACKS.values()];
const getPack = key => PACKS.get(key) || null;

// Metric keys a kid may self-report from the dose player (every day.scoreMetric).
function kidWritableMetricKeys(pack) {
  const keys = new Set();
  for (const w of pack.weeks) for (const d of w.days) if (d.scoreMetric) keys.add(d.scoreMetric);
  return keys;
}

module.exports = { PACKS, listPacks, getPack, kidWritableMetricKeys };
