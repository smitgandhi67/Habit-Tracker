const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const ParentingConfig = require('../models/ParentingConfig');
const ParentingAttempt = require('../models/ParentingAttempt');
const { listInstruments, getInstrument, activeDefaults } = require('../parenting/instruments');
const { scoreInstrument } = require('../parenting/scoring');
const { isAdmin } = require('../utils/auth');

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

// Shape a stored attempt into a client result, re-attaching subscale labels from
// the instrument (stored docs keep only keys). Falls back to the key as label.
function attemptResult(attempt, inst) {
  const labelByKey = inst ? Object.fromEntries(inst.subscales.map(s => [s.key, s.label])) : {};
  return {
    _id: attempt._id,
    instrumentKey: attempt.instrumentKey,
    version: attempt.version,
    title: inst ? inst.title : attempt.instrumentKey,
    source: inst ? inst.source : undefined,
    subjectUserId: attempt.subjectUserId,
    subscales: (attempt.subscales || []).map(s => ({
      key: s.key, label: labelByKey[s.key] || s.key, raw: s.raw, mean: s.mean, n: s.n,
    })),
    dimensions: attempt.dimensions || [],
    interpretation: attempt.interpretation || {},
    completedAt: attempt.completedAt,
  };
}

// POST /api/parenting/attempts — submit a completed questionnaire. The server
// re-scores (never trusts a client score), persists the attempt, and returns
// the result. Body: { instrumentKey, responses, subjectUserId? }.
router.post('/attempts', async (req, res, next) => {
  try {
    const { instrumentKey, responses, subjectUserId } = req.body || {};
    if (typeof instrumentKey !== 'string') {
      return res.status(400).json({ error: 'instrumentKey is required' });
    }
    if (!Array.isArray(responses)) {
      return res.status(400).json({ error: 'responses must be an array' });
    }
    const inst = getInstrument(instrumentKey);
    if (!inst) return res.status(404).json({ error: 'Unknown instrument' });

    // Determine subject. Self-report instruments always describe the taker.
    // Child's-view instruments (Phase 3) name the parent being rated.
    let subject = req.user._id;
    if (inst.audience === 'child') {
      if (subjectUserId && !mongoose.Types.ObjectId.isValid(subjectUserId)) {
        return res.status(400).json({ error: 'Invalid subjectUserId' });
      }
      if (subjectUserId) subject = subjectUserId;
    }

    let scored;
    try {
      scored = scoreInstrument(inst, responses);
    } catch (err) {
      // Engine validation failures are client errors (bad/incomplete responses).
      return res.status(400).json({ error: err.message });
    }

    const attempt = await ParentingAttempt.create({
      userId: req.user._id,
      subjectUserId: subject,
      instrumentKey: inst.key,
      version: inst.version,
      responses,
      subscales: scored.subscales.map(s => ({ key: s.key, raw: s.raw, mean: s.mean, n: s.n })),
      dimensions: scored.dimensions,
      interpretation: scored.interpretation,
    });

    res.status(201).json(attemptResult(attempt, inst));
  } catch (err) {
    next(err);
  }
});

// GET /api/parenting/attempts/:id — one attempt result. Owner or admin only.
router.get('/attempts/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const attempt = await ParentingAttempt.findById(req.params.id);
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    const owner = String(attempt.userId) === String(req.user._id);
    if (!owner && !isAdmin(req)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    res.json(attemptResult(attempt, getInstrument(attempt.instrumentKey)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.getParentingConfig = getParentingConfig;
module.exports.attemptResult = attemptResult;
