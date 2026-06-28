const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { DOMAINS, FOUNDATIONAL_KEYS } = require('../capabilities/domains');
const { CITATIONS, citationsForDomain } = require('../capabilities/citations');
const { listInstruments, getInstrument } = require('../capabilities/instruments');
const { scoreInstrument, gapReport } = require('../parenting/scoring');
const CapabilityAttempt = require('../models/CapabilityAttempt');
const ParentingLink = require('../models/ParentingLink');
const User = require('../models/User');
const { isAdmin, requireAdmin } = require('../utils/auth');

// Capabilities ("Skills") module API. Day 1: read-only registries. Day 2: the
// capability baseline — parent + kid questionnaires on the shared instrument
// engine, stored in their own collection, plus the parent↔kid baseline gap.
// Mounted under requireAuth in app.js.

// ---- registries (Day 1) ----------------------------------------------------

// GET /api/capabilities/domains — the 10 capability domains, with the foundational set.
router.get('/domains', (_req, res) => {
  res.json({ domains: DOMAINS, foundational: FOUNDATIONAL_KEYS });
});

// GET /api/capabilities/citations[?domain=key] — evidence anchors, optionally filtered.
router.get('/citations', (req, res) => {
  const { domain } = req.query;
  const items = typeof domain === 'string' && domain ? citationsForDomain(domain) : CITATIONS;
  res.json({ citations: items });
});

// ---- instrument serializers ------------------------------------------------

// Summary card — no items, no scoring metadata.
function instrumentSummary(inst) {
  return {
    key: inst.key,
    version: inst.version,
    audience: inst.audience,
    subjectMode: inst.subjectMode,
    title: inst.title,
    description: inst.description,
    source: inst.source,
    itemCount: inst.items.length,
  };
}

// Full form for the runner — item text + response options only. Strips subscale
// membership and interpret() so scoring stays server-side.
function instrumentForm(inst) {
  return {
    key: inst.key,
    version: inst.version,
    audience: inst.audience,
    subjectMode: inst.subjectMode,
    format: inst.format || 'likert',
    title: inst.title,
    description: inst.description,
    source: inst.source,
    responseScale: inst.responseScale,
    options: inst.options,
    items: inst.items.map(it => ({ id: it.id, text: it.text })),
  };
}

// Shape a stored attempt into a client result, re-attaching domain labels.
function attemptResult(attempt, inst) {
  const byKey = inst ? Object.fromEntries(inst.subscales.map(s => [s.key, s])) : {};
  return {
    _id: attempt._id,
    instrumentKey: attempt.instrumentKey,
    version: attempt.version,
    title: inst ? inst.title : attempt.instrumentKey,
    audience: inst ? inst.audience : undefined,
    responseMax: inst ? inst.responseScale.max : 5,
    subjectUserId: attempt.subjectUserId,
    subscales: (attempt.subscales || []).map(s => ({
      key: s.key,
      label: byKey[s.key]?.label || s.key,
      raw: s.raw, mean: s.mean, n: s.n,
    })),
    dimensions: attempt.dimensions || [],
    interpretation: attempt.interpretation || {},
    completedAt: attempt.completedAt,
  };
}

// ---- instruments -----------------------------------------------------------

// GET /api/capabilities/instruments — available baseline instruments.
router.get('/instruments', (_req, res) => {
  res.json(listInstruments().map(instrumentSummary));
});

// GET /api/capabilities/instruments/:key — full form for the runner.
router.get('/instruments/:key', (req, res) => {
  const inst = getInstrument(req.params.key);
  if (!inst) return res.status(404).json({ error: 'Unknown instrument' });
  res.json(instrumentForm(inst));
});

// ---- attempts --------------------------------------------------------------

// Resolve the subject (the child the attempt describes) and authorize.
// Returns { subject } or { error, status }.
async function resolveSubject(inst, req, subjectUserId) {
  if (inst.subjectMode !== 'rated-child') {
    return { subject: req.user._id }; // self-report (kid rates self)
  }
  if (!mongoose.Types.ObjectId.isValid(subjectUserId)) {
    return { error: 'subjectUserId (child) is required', status: 400 };
  }
  if (String(subjectUserId) === String(req.user._id)) {
    return { error: 'Cannot rate yourself as a child', status: 400 };
  }
  if (!isAdmin(req)) {
    const link = await ParentingLink.findOne({ parentUserId: req.user._id, childUserId: subjectUserId });
    if (!link) return { error: 'No link to this child', status: 403 };
  }
  const child = await User.findById(subjectUserId).select('_id').lean();
  if (!child) return { error: 'Child user not found', status: 404 };
  return { subject: subjectUserId };
}

// POST /api/capabilities/attempts — submit a completed baseline. Server re-scores
// (never trusts a client score). Body: { instrumentKey, responses, subjectUserId? }.
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

    const resolved = await resolveSubject(inst, req, subjectUserId);
    if (resolved.error) return res.status(resolved.status).json({ error: resolved.error });

    let scored;
    try {
      scored = scoreInstrument(inst, responses);
    } catch (err) {
      // Engine validation failures are client errors (bad/incomplete responses).
      return res.status(400).json({ error: err.message });
    }

    const attempt = await CapabilityAttempt.create({
      userId: req.user._id,
      subjectUserId: resolved.subject,
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

// GET /api/capabilities/attempts/latest?instrumentKey=&subjectUserId= — the caller's
// most recent attempt for an instrument (optionally about a given child). 200 with
// { result: null } when none exists.
router.get('/attempts/latest', async (req, res, next) => {
  try {
    const { instrumentKey, subjectUserId } = req.query;
    if (typeof instrumentKey !== 'string' || !getInstrument(instrumentKey)) {
      return res.status(400).json({ error: 'valid instrumentKey required' });
    }
    const filter = { userId: req.user._id, instrumentKey };
    if (subjectUserId) {
      if (!mongoose.Types.ObjectId.isValid(subjectUserId)) {
        return res.status(400).json({ error: 'invalid subjectUserId' });
      }
      filter.subjectUserId = subjectUserId;
    }
    const attempt = await CapabilityAttempt.findOne(filter).sort({ completedAt: -1 }).lean();
    res.json({ result: attempt ? attemptResult(attempt, getInstrument(instrumentKey)) : null });
  } catch (err) {
    next(err);
  }
});

// GET /api/capabilities/attempts/:id — one result. Owner or admin only.
router.get('/attempts/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const attempt = await CapabilityAttempt.findById(req.params.id);
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    const owner = String(attempt.userId) === String(req.user._id);
    if (!owner && !isAdmin(req)) return res.status(403).json({ error: 'Not authorised' });
    res.json(attemptResult(attempt, getInstrument(attempt.instrumentKey)));
  } catch (err) {
    next(err);
  }
});

// ---- baseline gap ----------------------------------------------------------

// Parent-rates-child vs kid-rates-self — BOTH describe the same child
// (subjectUserId = child on both sides), unlike the parenting gap. Newest of each.
async function buildBaselineGap(parentId, childId) {
  const [parentA, kidA] = await Promise.all([
    CapabilityAttempt.findOne({ userId: parentId, instrumentKey: 'parent_baseline', subjectUserId: childId })
      .sort({ completedAt: -1 }).lean(),
    CapabilityAttempt.findOne({ userId: childId, instrumentKey: 'kid_baseline', subjectUserId: childId })
      .sort({ completedAt: -1 }).lean(),
  ]);
  const pDims = parentA?.dimensions || [];
  const cDims = kidA?.dimensions || [];
  return {
    parent: { hasData: !!parentA, completedAt: parentA?.completedAt || null, dimensions: pDims },
    child:  { hasData: !!kidA, completedAt: kidA?.completedAt || null, dimensions: cDims },
    gap: (parentA && kidA) ? gapReport(pDims, cDims) : [],
  };
}

// GET /api/capabilities/baseline/gap?childUserId= — caller (parent) vs a child.
router.get('/baseline/gap', async (req, res, next) => {
  try {
    const { childUserId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(childUserId)) {
      return res.status(400).json({ error: 'valid childUserId required' });
    }
    if (!isAdmin(req)) {
      const link = await ParentingLink.findOne({ parentUserId: req.user._id, childUserId });
      if (!link) return res.status(403).json({ error: 'No link to this child' });
    }
    res.json(await buildBaselineGap(req.user._id, childUserId));
  } catch (err) {
    next(err);
  }
});

// ---- children picker (parent) ----------------------------------------------

// GET /api/capabilities/children — this parent's linked children (for the rate-a-child
// picker). Reuses the generic ParentingLink family graph.
router.get('/children', requireAdmin, async (req, res, next) => {
  try {
    const links = await ParentingLink.find({ parentUserId: req.user._id }).lean();
    const ids = links.map(l => l.childUserId);
    const users = await User.find({ _id: { $in: ids } }).select('name email').lean();
    const byId = new Map(users.map(u => [String(u._id), u]));
    res.json(links.map(l => ({
      childUserId: l.childUserId,
      label: l.label,
      name: byId.get(String(l.childUserId))?.name || l.label || 'Child',
    })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.buildBaselineGap = buildBaselineGap;
