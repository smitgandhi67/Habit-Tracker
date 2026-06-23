// Instrument registry. Each instrument module exports a versioned config object
// consumed by the scoring engine (server/parenting/scoring.js):
//   { key, version, title, source, responseScale:{min,max}, options:[...],
//     items:[{id,text,subscale,reverse}], subscales:[{key,label}],
//     dimensions:[{key,from,combine}], interpret(meanByKey, dimByKey) }
//
// Instruments are added here as each phase lands. Phase 0 ships an empty
// registry so the wiring (router, config seed) can be proven end-to-end first.

const REGISTRY = {
  // style:      require('./style'),       // Phase 1
  // scale:      require('./scale'),       // Phase 2
  // child_view: require('./child_view'),  // Phase 3
};

// All instrument configs (latest version of each key).
function listInstruments() {
  return Object.values(REGISTRY);
}

// Resolve a specific instrument. `version` optional — defaults to the registered
// (latest) version. Returns null if unknown.
function getInstrument(key, version) {
  const inst = REGISTRY[key];
  if (!inst) return null;
  if (version != null && inst.version !== version) return null;
  return inst;
}

// Default active-version pointers, used to seed ParentingConfig.
function activeDefaults() {
  return listInstruments().map(i => ({ instrumentKey: i.key, version: i.version }));
}

module.exports = { REGISTRY, listInstruments, getInstrument, activeDefaults };
