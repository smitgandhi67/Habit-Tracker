const express = require('express');
const router = express.Router();

const ParentingConfig = require('../models/ParentingConfig');
const { listInstruments, getInstrument, activeDefaults } = require('../parenting/instruments');

// ---- config singleton -----------------------------------------------------

// Active-version pointer doc, seeded from the repo registry on first access.
async function getParentingConfig() {
  let cfg = await ParentingConfig.findOne({ singleton: 'config' });
  if (!cfg) {
    cfg = await ParentingConfig.create({ singleton: 'config', active: activeDefaults() });
  }
  return cfg;
}

// ---- serializers ----------------------------------------------------------

// Summary card for the hub — no items, no scoring metadata.
function instrumentSummary(inst) {
  return {
    key: inst.key,
    version: inst.version,
    title: inst.title,
    audience: inst.audience,          // 'parent' | 'child'
    source: inst.source,
    description: inst.description,
    itemCount: inst.items.length,
  };
}

// Full form for the runner — item text + response options only. Strips
// subscale membership, reverse flags, and interpret() so scoring stays server-side.
function instrumentForm(inst) {
  return {
    key: inst.key,
    version: inst.version,
    title: inst.title,
    audience: inst.audience,
    source: inst.source,
    description: inst.description,
    responseScale: inst.responseScale,
    options: inst.options,            // [{ value, label }]
    items: inst.items.map(it => ({ id: it.id, text: it.text })),
  };
}

// ---- taker endpoints ------------------------------------------------------

// GET /api/parenting/instruments — active instruments the caller may take.
router.get('/instruments', async (_req, res, next) => {
  try {
    await getParentingConfig(); // ensure seeded
    res.json(listInstruments().map(instrumentSummary));
  } catch (err) {
    next(err);
  }
});

// GET /api/parenting/instruments/:key — full form for the runner.
router.get('/instruments/:key', async (req, res, next) => {
  try {
    const inst = getInstrument(req.params.key);
    if (!inst) return res.status(404).json({ error: 'Unknown instrument' });
    res.json(instrumentForm(inst));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.getParentingConfig = getParentingConfig;
