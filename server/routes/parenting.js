const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const ParentingConfig = require('../models/ParentingConfig');
const ParentingAttempt = require('../models/ParentingAttempt');
const ParentingLink = require('../models/ParentingLink');
const User = require('../models/User');
const { listInstruments, getInstrument, activeDefaults } = require('../parenting/instruments');
const { scoreInstrument, gapReport } = require('../parenting/scoring');
const { isAdmin, requireAdmin, ADMIN_EMAIL } = require('../utils/auth');

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
    format: inst.format || 'likert',  // 'likert' | 'anchored'
    responseScale: inst.responseScale,
    options: inst.options,            // [{ value, label }]
    // anchored instruments carry per-item endpoint anchors; likert items omit them.
    items: inst.items.map(it => (
      it.anchorLow || it.anchorHigh
        ? { id: it.id, text: it.text, anchorLow: it.anchorLow, anchorHigh: it.anchorHigh }
        : { id: it.id, text: it.text }
    )),
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
  const byKey = inst ? Object.fromEntries(inst.subscales.map(s => [s.key, s])) : {};
  return {
    _id: attempt._id,
    instrumentKey: attempt.instrumentKey,
    version: attempt.version,
    title: inst ? inst.title : attempt.instrumentKey,
    source: inst ? inst.source : undefined,
    responseMax: inst ? inst.responseScale.max : 5,
    subjectUserId: attempt.subjectUserId,
    subscales: (attempt.subscales || []).map(s => ({
      key: s.key,
      label: byKey[s.key]?.label || s.key,
      hidden: !!byKey[s.key]?.hidden,
      raw: s.raw, mean: s.mean, n: s.n,
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
    // Child's-view instruments name the parent being rated; if the child doesn't
    // specify one, default to the family parent (the admin user).
    let subject = req.user._id;
    if (inst.audience === 'child') {
      if (subjectUserId) {
        if (!mongoose.Types.ObjectId.isValid(subjectUserId)) {
          return res.status(400).json({ error: 'Invalid subjectUserId' });
        }
        subject = subjectUserId;
      } else {
        const parent = await User.findOne({ email: ADMIN_EMAIL }).select('_id').lean();
        if (parent) subject = parent._id;
      }
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

// Compact row for history/trend lists.
function historyItem(attempt, inst) {
  const interp = attempt.interpretation || {};
  return {
    _id: attempt._id,
    instrumentKey: attempt.instrumentKey,
    title: inst ? inst.title : attempt.instrumentKey,
    completedAt: attempt.completedAt,
    styleKey: interp.styleKey || null,
    total: interp.bands?.total ?? null,
    dimensions: attempt.dimensions || [],
  };
}

// Shared cursor parsing (mirrors the math ledger contract).
function parseHistoryQuery(req) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  let cursor = null;
  if (req.query.cursor) {
    const d = new Date(req.query.cursor);
    if (Number.isNaN(d.getTime())) return { error: 'invalid cursor' };
    cursor = d;
  }
  return { limit, cursor, instrumentKey: typeof req.query.instrumentKey === 'string' ? req.query.instrumentKey : null };
}

// GET /api/parenting/attempts?instrumentKey=&cursor=&limit= — caller's own
// history, newest first, cursor-paginated. Returns { items, nextCursor }.
router.get('/attempts', async (req, res, next) => {
  try {
    const q = parseHistoryQuery(req);
    if (q.error) return res.status(400).json({ error: q.error });
    const filter = { userId: req.user._id };
    if (q.instrumentKey) filter.instrumentKey = q.instrumentKey;
    if (q.cursor) filter.completedAt = { $lt: q.cursor };

    const docs = await ParentingAttempt.find(filter)
      .sort({ completedAt: -1 })
      .limit(q.limit + 1)
      .lean();

    const more = docs.length > q.limit;
    const page = more ? docs.slice(0, q.limit) : docs;
    const items = page.map(d => historyItem(d, getInstrument(d.instrumentKey)));
    const nextCursor = more ? page[page.length - 1].completedAt.toISOString() : null;
    res.json({ items, nextCursor });
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

// ---- gap report -----------------------------------------------------------

// Most-recent value per dimension across a parent's self-report attempts
// (style gives warmth+consistency; scale reinforces consistency). Newest wins.
async function parentDimensions(parentId) {
  const attempts = await ParentingAttempt.find({ userId: parentId, subjectUserId: parentId })
    .sort({ completedAt: -1 }).lean();
  const dims = {};
  let latestAt = null;
  for (const a of attempts) {
    if (!latestAt) latestAt = a.completedAt;
    for (const d of a.dimensions || []) if (!(d.key in dims)) dims[d.key] = d.score;
  }
  return { dims, hasData: attempts.length > 0, completedAt: latestAt };
}

// Latest child's-view of a given parent.
async function childDimensions(childId, parentId) {
  const a = await ParentingAttempt.findOne({ userId: childId, subjectUserId: parentId, instrumentKey: 'child_view' })
    .sort({ completedAt: -1 }).lean();
  if (!a) return { dims: {}, hasData: false, completedAt: null };
  return { dims: Object.fromEntries((a.dimensions || []).map(d => [d.key, d.score])), hasData: true, completedAt: a.completedAt };
}

function toArr(dims) { return Object.entries(dims).map(([key, score]) => ({ key, score })); }

async function buildGap(parentId, childId) {
  const [p, c] = await Promise.all([parentDimensions(parentId), childDimensions(childId, parentId)]);
  return {
    parent: { hasData: p.hasData, completedAt: p.completedAt, dimensions: toArr(p.dims) },
    child: { hasData: c.hasData, completedAt: c.completedAt, dimensions: toArr(c.dims) },
    gap: (p.hasData && c.hasData) ? gapReport(toArr(p.dims), toArr(c.dims)) : [],
  };
}

// GET /api/parenting/gap?childUserId= — caller (parent) vs a linked child.
router.get('/gap', async (req, res, next) => {
  try {
    const { childUserId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(childUserId)) {
      return res.status(400).json({ error: 'valid childUserId required' });
    }
    const link = await ParentingLink.findOne({ parentUserId: req.user._id, childUserId });
    if (!link) return res.status(403).json({ error: 'No link to this child' });
    res.json(await buildGap(req.user._id, childUserId));
  } catch (err) { next(err); }
});

// ---- markdown report export -----------------------------------------------

const CONCERN_FACETS = new Set(['physical_coercion', 'verbal_hostility', 'non_reasoning', 'indulgent']);
const STYLE_BLURB = {
  authoritative: 'High warmth paired with firm, reasoned structure — the profile most consistently linked to positive child outcomes.',
  authoritarian: 'High control and demands with lower warmth and little negotiation.',
  permissive: 'Warm and responsive, but with limited structure and follow-through.',
  uninvolved: 'Lower engagement on both warmth and structure.',
};
const fmtDate = d => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'n/a');
const pct = n => `${Math.round(n * 100)}%`;

function renderStyle(md, attempt) {
  const inst = getInstrument('style');
  const labels = Object.fromEntries(inst.subscales.map(s => [s.key, s.label]));
  const b = attempt.interpretation?.bands || {};
  const sc = b.scales || {};
  md.push(`### Parenting Style — PSDQ (taken ${fmtDate(attempt.completedAt)})`);
  md.push('');
  md.push(`**Predominant style: ${(attempt.interpretation?.styleKey || '').replace(/^\w/, c => c.toUpperCase())}** — ${STYLE_BLURB[attempt.interpretation?.styleKey] || ''}`);
  md.push('');
  md.push('| Style scale | Score (1–5) |');
  md.push('|---|---|');
  md.push(`| Authoritative | ${sc.authoritative ?? '–'} |`);
  md.push(`| Authoritarian | ${sc.authoritarian ?? '–'} |`);
  md.push(`| Permissive | ${sc.permissive ?? '–'} |`);
  md.push('');
  md.push('| Facet | Score (1–5) | Type |');
  md.push('|---|---|---|');
  for (const s of attempt.subscales || []) {
    md.push(`| ${labels[s.key] || s.key} | ${s.mean} | ${CONCERN_FACETS.has(s.key) ? 'watch' : 'positive'} |`);
  }
  md.push('');
}

function renderScale(md, attempt) {
  const b = attempt.interpretation?.bands || {};
  const f = b.factors || {}; const cut = b.cutoffs || {}; const flag = b.flags || {};
  md.push(`### Discipline — Parenting Scale (taken ${fmtDate(attempt.completedAt)})`);
  md.push('');
  md.push('Higher = more dysfunctional discipline. Thresholds are published clinical reflection points.');
  md.push('');
  md.push('| Factor | Score (1–7) | Threshold | Flag |');
  md.push('|---|---|---|---|');
  for (const k of ['laxness', 'overreactivity', 'hostility']) {
    md.push(`| ${k.replace(/^\w/, c => c.toUpperCase())} | ${f[k] ?? '–'} | ${cut[k] ?? '–'} | ${flag[k] ? '⚠ elevated' : 'typical'} |`);
  }
  md.push(`| **Total** | ${b.total ?? '–'} | ${cut.total ?? '–'} | ${flag.total ? '⚠ elevated' : 'typical'} |`);
  md.push('');
  md.push(`_${b.summary || ''}_`);
  md.push('');
}

async function buildReportMarkdown(parentId, includeChildren) {
  const parent = await User.findById(parentId).select('name email').lean();
  const [style, scale] = await Promise.all([
    ParentingAttempt.findOne({ userId: parentId, subjectUserId: parentId, instrumentKey: 'style' }).sort({ completedAt: -1 }).lean(),
    ParentingAttempt.findOne({ userId: parentId, subjectUserId: parentId, instrumentKey: 'scale' }).sort({ completedAt: -1 }).lean(),
  ]);

  const md = [];
  md.push('# Parenting Assessment Report');
  md.push('');
  md.push(`_Generated ${fmtDate(new Date())} • HabitTracker Parenting module_`);
  md.push('');
  md.push('Validated questionnaire results for one family. Instruments: **PSDQ** (parenting style; Robinson et al. 1995/2001), **Parenting Scale** (discipline; Arnold et al. 1993, revised scoring Rhoades & O\'Leary 2007), **APQ-C** (child report; Frick 1991; Shelton et al. 1996). These are this family\'s own self-/child-reports — a reflection tool, **not a clinical diagnosis**.');
  md.push('');
  md.push('---');
  md.push('');
  md.push(`## Parent: ${parent?.name || 'Unknown'}`);
  md.push('');
  if (style) renderStyle(md, style); else md.push('_Parenting Style quiz not taken yet._\n');
  if (scale) renderScale(md, scale); else md.push('_Parenting Scale (discipline) quiz not taken yet._\n');

  const suggestions = [];
  if (style) {
    const facet = Object.fromEntries((style.subscales || []).map(s => [s.key, s.mean]));
    if ((facet.verbal_hostility ?? 0) >= 2.5) suggestions.push('Calm-voice follow-through: one warning, then the same calm consequence — no repeating or raising your voice. (Verbal-hostility facet is elevated.)');
    if ((facet.indulgent ?? 0) >= 3) suggestions.push('Hold one limit a day all the way through, even when it causes a fuss. (Indulgent facet is elevated.)');
  }
  if (scale) {
    const flag = scale.interpretation?.bands?.flags || {};
    if (flag.overreactivity) suggestions.push('Pause-before-reacting: a 3-breath gap before responding to misbehavior. (Over-reactivity is elevated.)');
    if (flag.hostility) suggestions.push('Replace harsh/loud responses with a brief, firm consequence; step away if anger spikes. (Hostility is elevated.)');
    if (flag.laxness) suggestions.push('Do-what-I-said: carry out every stated consequence. (Laxness is elevated.)');
  }

  if (includeChildren) {
    const links = await ParentingLink.find({ parentUserId: parentId }).lean();
    if (links.length) {
      md.push('---');
      md.push('');
      md.push('## Children');
      md.push('');
      for (const link of links) {
        const child = await User.findById(link.childUserId).select('name').lean();
        const cv = await ParentingAttempt.findOne({ userId: link.childUserId, subjectUserId: parentId, instrumentKey: 'child_view' }).sort({ completedAt: -1 }).lean();
        const name = child?.name || link.label || 'Child';
        md.push(`### ${name} — "How I See My Parent" (APQ-C${cv ? `, taken ${fmtDate(cv.completedAt)}` : ''})`);
        md.push('');
        if (cv) {
          const dims = Object.fromEntries((cv.dimensions || []).map(d => [d.key, d.score]));
          md.push(`How this child experiences your parenting: **Warmth ${pct(dims.warmth ?? 0)}**, **Consistency ${pct(dims.consistency ?? 0)}**.`);
          md.push('');
          const gap = await buildGap(parentId, link.childUserId);
          if (gap.gap.length) {
            md.push(`#### Gap — You vs ${name}`);
            md.push('');
            md.push('| Dimension | You | Child | Difference | Alignment |');
            md.push('|---|---|---|---|---|');
            for (const g of gap.gap) {
              md.push(`| ${g.key.replace(/^\w/, c => c.toUpperCase())} | ${pct(g.parent)} | ${pct(g.child)} | ${(g.delta >= 0 ? '+' : '')}${Math.round(g.delta * 100)}% | ${g.alignment} |`);
              if (g.alignment !== 'aligned' && g.key === 'consistency' && g.delta > 0) {
                suggestions.push(`Consistency gap with ${name}: your child experiences rules as less consistent than you do. Same consequence every time closes it.`);
              }
            }
            md.push('');
          }
        } else {
          md.push('_This child has not taken the quiz yet._');
          md.push('');
        }
      }
    }
  }

  md.push('---');
  md.push('');
  md.push('## Suggested focus areas (auto-generated from your scores)');
  md.push('');
  if (suggestions.length) for (const s of [...new Set(suggestions)]) md.push(`- ${s}`);
  else md.push('- No elevated areas flagged. Keep pairing warmth with consistent follow-through; re-take in ~3 months to track change.');
  md.push('');
  md.push('## How to read these scores');
  md.push('');
  md.push('- **PSDQ style scales (1–5):** higher = more of that style. Predominant style = highest scale; warm + structured = Authoritative.');
  md.push('- **Parenting Scale factors (1–7):** higher = more dysfunctional discipline; compare to the thresholds shown.');
  md.push('- **Gap %:** each dimension is normalized 0–100% so parent self-report and child report are comparable. Aligned <15 pts, some-gap 15–30, large-gap >30.');
  md.push('');
  md.push('## Prompts for an AI parenting coach');
  md.push('');
  md.push('1. Given these scores, what are my top 2 strengths and top 2 growth areas?');
  md.push('2. Turn the growth areas into specific daily habits I can track for 8 weeks.');
  md.push('3. Where my child and I see things differently, what conversation could I have with them?');
  md.push('4. What does the research say about my predominant style for kids aged 7–10?');
  md.push('');
  return md.join('\n');
}

// GET /api/parenting/export — full family report as markdown (admin gets children).
router.get('/export', async (req, res, next) => {
  try {
    const md = await buildReportMarkdown(req.user._id, isAdmin(req));
    res.json({ filename: `parenting-report-${new Date().toISOString().slice(0, 10)}.md`, markdown: md });
  } catch (err) { next(err); }
});

// ---- admin: users + family links ------------------------------------------

// GET /api/parenting/admin/users — all users (for the parent console picker).
router.get('/admin/users', requireAdmin, async (_req, res, next) => {
  try {
    const users = await User.find().select('name email').lean();
    res.json(users
      .map(u => ({ _id: u._id, name: u.name, email: u.email, isAdmin: u.email === ADMIN_EMAIL }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '')));
  } catch (err) { next(err); }
});

// GET /api/parenting/admin/links — this parent's child links.
router.get('/admin/links', requireAdmin, async (req, res, next) => {
  try {
    const links = await ParentingLink.find({ parentUserId: req.user._id }).lean();
    const childIds = links.map(l => l.childUserId);
    const children = await User.find({ _id: { $in: childIds } }).select('name email').lean();
    const byId = new Map(children.map(c => [String(c._id), c]));
    res.json(links.map(l => ({
      _id: l._id,
      childUserId: l.childUserId,
      label: l.label,
      childName: byId.get(String(l.childUserId))?.name || null,
      childEmail: byId.get(String(l.childUserId))?.email || null,
    })));
  } catch (err) { next(err); }
});

// POST /api/parenting/admin/links — link a child to this parent. Body: { childUserId, label? }.
router.post('/admin/links', requireAdmin, async (req, res, next) => {
  try {
    const { childUserId, label } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(childUserId)) {
      return res.status(400).json({ error: 'valid childUserId required' });
    }
    if (String(childUserId) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot link yourself as a child' });
    }
    const child = await User.findById(childUserId).select('_id').lean();
    if (!child) return res.status(404).json({ error: 'Child user not found' });
    try {
      const link = await ParentingLink.create({ parentUserId: req.user._id, childUserId, label });
      res.status(201).json({ _id: link._id, childUserId: link.childUserId, label: link.label });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'Link already exists' });
      throw err;
    }
  } catch (err) { next(err); }
});

// DELETE /api/parenting/admin/links/:id — remove a link this parent owns.
router.delete('/admin/links/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const link = await ParentingLink.findOneAndDelete({ _id: req.params.id, parentUserId: req.user._id });
    if (!link) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/parenting/admin/gap?parentUserId=&childUserId= — any pair (admin).
router.get('/admin/gap', requireAdmin, async (req, res, next) => {
  try {
    const { parentUserId, childUserId } = req.query;
    if (!mongoose.Types.ObjectId.isValid(parentUserId) || !mongoose.Types.ObjectId.isValid(childUserId)) {
      return res.status(400).json({ error: 'valid parentUserId and childUserId required' });
    }
    res.json(await buildGap(parentUserId, childUserId));
  } catch (err) { next(err); }
});

// GET /api/parenting/admin/attempts?userId=&instrumentKey=&cursor= — any user's history (admin).
router.get('/admin/attempts', requireAdmin, async (req, res, next) => {
  try {
    const q = parseHistoryQuery(req);
    if (q.error) return res.status(400).json({ error: q.error });
    if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return res.status(400).json({ error: 'valid userId required' });
    }
    const filter = { userId: req.query.userId };
    if (q.instrumentKey) filter.instrumentKey = q.instrumentKey;
    if (q.cursor) filter.completedAt = { $lt: q.cursor };
    const docs = await ParentingAttempt.find(filter).sort({ completedAt: -1 }).limit(q.limit + 1).lean();
    const more = docs.length > q.limit;
    const page = more ? docs.slice(0, q.limit) : docs;
    res.json({
      items: page.map(d => historyItem(d, getInstrument(d.instrumentKey))),
      nextCursor: more ? page[page.length - 1].completedAt.toISOString() : null,
    });
  } catch (err) { next(err); }
});

// GET /api/parenting/admin/config — active version pointers + available versions.
router.get('/admin/config', requireAdmin, async (_req, res, next) => {
  try {
    const cfg = await getParentingConfig();
    const activeByKey = Object.fromEntries(cfg.active.map(a => [a.instrumentKey, a.version]));
    res.json(listInstruments().map(i => ({
      instrumentKey: i.key,
      title: i.title,
      availableVersions: [i.version],
      activeVersion: activeByKey[i.key] ?? i.version,
    })));
  } catch (err) { next(err); }
});

// PUT /api/parenting/admin/config — set active version. Body: { instrumentKey, version }.
router.put('/admin/config', requireAdmin, async (req, res, next) => {
  try {
    const { instrumentKey, version } = req.body || {};
    const inst = getInstrument(instrumentKey, version);
    if (!inst) return res.status(400).json({ error: 'Unknown instrument or version' });
    const cfg = await getParentingConfig();
    const existing = cfg.active.find(a => a.instrumentKey === instrumentKey);
    if (existing) existing.version = version;
    else cfg.active.push({ instrumentKey, version });
    await cfg.save();
    res.json({ instrumentKey, version });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.getParentingConfig = getParentingConfig;
module.exports.attemptResult = attemptResult;
