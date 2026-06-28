// Capability instrument registry — parallel to the parenting registry, but for the
// capability-baseline questionnaires. Shares the SAME scoring engine
// (server/parenting/scoring.js, imported by the routes) — only the instrument
// configs and the attempt collection are separate, so the domains never mix.

const REGISTRY = {
  parent_baseline: require('./parent_baseline'),
  kid_baseline:    require('./kid_baseline'),
};

function listInstruments() {
  return Object.values(REGISTRY);
}

function getInstrument(key, version) {
  const inst = REGISTRY[key];
  if (!inst) return null;
  if (version != null && inst.version !== version) return null;
  return inst;
}

module.exports = { REGISTRY, listInstruments, getInstrument };
