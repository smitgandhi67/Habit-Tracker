const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { DOMAINS, FOUNDATIONAL_KEYS } = require('../capabilities/domains');
const { CITATIONS, citationsForDomain, getCitation } = require('../capabilities/citations');
const { listInstruments, getInstrument } = require('../capabilities/instruments');
const { scoreInstrument, gapReport } = require('../parenting/scoring');
const { computeTargets } = require('../capabilities/targets');
const { buildDomainRollup } = require('../capabilities/rollup');
const { buildDashboard } = require('../capabilities/dashboard');
const CapabilityAttempt = require('../models/CapabilityAttempt');
const CapabilityActivity = require('../models/CapabilityActivity');
const CapabilityActivityLog = require('../models/CapabilityActivityLog');
const ParentingLink = require('../models/ParentingLink');
const User = require('../models/User');
const { isAdmin, requireAdmin } = require('../utils/auth');

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Authorize the caller to read/write a given child's data: the child themselves,
// an admin, or a linked parent. Returns { childId } or { error, status }.
async function authorizeChild(req, childUserId) {
  if (!mongoose.Types.ObjectId.isValid(childUserId)) {
    return { error: 'valid childUserId required', status: 400 };
  }
  if (String(childUserId) === String(req.user._id)) return { childId: childUserId };
  if (isAdmin(req)) return { childId: childUserId };
  const link = await ParentingLink.findOne({ parentUserId: req.user._id, childUserId });
  if (!link) return { error: 'No link to this child', status: 403 };
  return { childId: childUserId };
}

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

// ---- activity library (Day 4) ----------------------------------------------

function serializeActivity(a) {
  const c = a.citationKey ? getCitation(a.citationKey) : null;
  return {
    slug: a.slug,
    title: a.title,
    domainKeys: a.domainKeys || [],
    tier: a.tier ?? null,
    kind: a.kind || 'do',
    approachRule: a.approachRule || '',
    why: a.why || '',
    skipReason: a.skipReason || '',
    minAge: a.minAge ?? null,
    maxAge: a.maxAge ?? null,
    citation: c ? { key: c.key, cite: c.cite, strength: c.strength } : null,
  };
}

// GET /api/capabilities/activities[?domain=&tier=&age=&kind=] — the §6 menu,
// filterable by domain, tier, age-fit, and kind. Ordered do-before-skip, tier asc.
router.get('/activities', async (req, res, next) => {
  try {
    const { domain, tier, age, kind } = req.query;
    const filter = { archivedAt: null };
    if (typeof domain === 'string' && domain) filter.domainKeys = domain;
    if (kind === 'do' || kind === 'skip') filter.kind = kind;
    if (tier != null && tier !== '') {
      const t = Number(tier);
      if ([1, 2, 3].includes(t)) filter.tier = t;
    }

    let docs = await CapabilityActivity.find(filter).lean();

    if (age != null && age !== '') {
      const a = Number(age);
      if (Number.isFinite(a)) {
        docs = docs.filter(d => (d.minAge == null || a >= d.minAge) && (d.maxAge == null || a <= d.maxAge));
      }
    }

    docs.sort((x, y) => {
      if ((x.kind === 'skip') !== (y.kind === 'skip')) return x.kind === 'skip' ? 1 : -1;
      const tx = x.tier ?? 99;
      const ty = y.tier ?? 99;
      return tx - ty || (x.order ?? 0) - (y.order ?? 0);
    });

    res.json({ activities: docs.map(serializeActivity) });
  } catch (err) {
    next(err);
  }
});

// ---- activity tracking + domain rollup (Day 5) -----------------------------

function serializeLog(l) {
  return {
    _id: l._id,
    activitySlug: l.activitySlug,
    title: l.title,
    domainKeys: l.domainKeys || [],
    date: l.date,
    note: l.note || '',
    subjectUserId: l.subjectUserId,
    createdAt: l.createdAt,
  };
}

// POST /api/capabilities/activities/log — record one run of a 'do' activity for a
// child. Snapshots the activity's title + domains onto the log (rollup needs no
// join). Body: { activitySlug, subjectUserId?, date?, note? }. subjectUserId
// defaults to self (kid logging own); a parent/admin may log for a linked child.
router.post('/activities/log', async (req, res, next) => {
  try {
    const { activitySlug, subjectUserId, date, note } = req.body || {};
    if (typeof activitySlug !== 'string' || !activitySlug) {
      return res.status(400).json({ error: 'activitySlug is required' });
    }
    const subject = subjectUserId || req.user._id;
    const access = await authorizeChild(req, subject);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const activity = await CapabilityActivity.findOne({ slug: activitySlug, archivedAt: null }).lean();
    if (!activity) return res.status(404).json({ error: 'Unknown activity' });
    if (activity.kind !== 'do') return res.status(400).json({ error: 'Only "do" activities can be logged' });

    const day = (typeof date === 'string' && YMD.test(date)) ? date : new Date().toISOString().slice(0, 10);

    const log = await CapabilityActivityLog.create({
      userId: req.user._id,
      subjectUserId: access.childId,
      activitySlug: activity.slug,
      title: activity.title,
      domainKeys: activity.domainKeys || [],
      date: day,
      note: typeof note === 'string' ? note.slice(0, 280) : '',
    });
    res.status(201).json(serializeLog(log));
  } catch (err) {
    next(err);
  }
});

// GET /api/capabilities/activities/log?childUserId=&limit= — recent reps for a
// child (defaults to self). Newest first.
router.get('/activities/log', async (req, res, next) => {
  try {
    const childUserId = req.query.childUserId || req.user._id;
    const access = await authorizeChild(req, childUserId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const logs = await CapabilityActivityLog.find({ subjectUserId: access.childId })
      .sort({ date: -1, createdAt: -1 }).limit(limit).lean();
    res.json({ logs: logs.map(serializeLog) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/capabilities/activities/log/:id — remove a mistaken rep. The logger
// who created it, or an admin, may delete.
router.delete('/activities/log/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const log = await CapabilityActivityLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: 'Not found' });
    if (String(log.userId) !== String(req.user._id) && !isAdmin(req)) {
      return res.status(403).json({ error: 'Not authorised' });
    }
    await log.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/capabilities/rollup?childUserId=&since= — per-domain reps across every
// track over the window (default last 90 days), plus baseline age + quarterly
// re-assessment flag. Read-only aggregation (never writes the ledger — R7).
router.get('/rollup', async (req, res, next) => {
  try {
    const childUserId = req.query.childUserId || req.user._id;
    const access = await authorizeChild(req, childUserId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { since } = req.query;
    const opts = {};
    if (typeof since === 'string' && YMD.test(since)) opts.since = since;
    res.json(await buildDomainRollup(access.childId, opts));
  } catch (err) {
    next(err);
  }
});

// GET /api/capabilities/dashboard?childUserId= — the per-kid system of record
// (radar + focus areas + cadence + cross-track snapshot). parentView is true for an
// admin or a linked parent; a kid viewing their own profile gets the read-only view
// with the parent-facing pieces stripped (targets, milestones, parent ratings).
router.get('/dashboard', async (req, res, next) => {
  try {
    const childUserId = req.query.childUserId || req.user._id;
    const access = await authorizeChild(req, childUserId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const parentView = isAdmin(req) || String(access.childId) !== String(req.user._id);
    res.json(await buildDashboard(access.childId, { parentView }));
  } catch (err) {
    next(err);
  }
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
    // Weakest foundations first — the parent's focus areas (§8 scoring→action).
    targets: computeTargets(attempt.dimensions),
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
module.exports.authorizeChild = authorizeChild;
