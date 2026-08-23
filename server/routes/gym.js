const express   = require('express');
const router    = express.Router();
const GymEntry  = require('../models/GymEntry');
const Exercise  = require('../models/Exercise');
const ExerciseSetting = require('../models/ExerciseSetting');
const WorkoutPlan = require('../models/WorkoutPlan');
const User      = require('../models/User');
const { requireAdmin, isAdmin } = require('../utils/auth');
const { normalizeExerciseName } = require('../utils/exerciseName');
const { canonicalizeExercise } = require('../utils/canonicalExercise');
const { resolveTarget, resolveStep, recommendNext, MAX_SETS } = require('../utils/progression');

const BODY_PART_LABEL = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
  legs: 'Legs', core: 'Core', cardio: 'Cardio', full_body: 'Full Body',
};

// All routes protected by requireAuth (applied in index.js)

// ─── helpers ────────────────────────────────────────────────────────────────

function maxWeight(sets) {
  return Math.max(0, ...sets.map(s => s.weight || 0));
}

async function checkAndMarkPR(entry, userId) {
  const entryMax = maxWeight(entry.sets);
  // Find best weight ever for this exercise (excluding current entry if update)
  const best = await GymEntry.findOne(
    { userId, exerciseName: entry.exerciseName, _id: { $ne: entry._id } },
    { prWeight: 1 }
  ).sort({ prWeight: -1 });

  const historicalBest = best?.prWeight || 0;
  entry.prWeight        = entryMax;
  entry.isPersonalRecord = entryMax > 0 && entryMax >= historicalBest;
  return entry;
}

// ─── progression helpers ────────────────────────────────────────────────────

// The JWT carries only identity (_id / email / name / photo), NOT preferences,
// and the weight-unit toggle writes straight to the User document — so reading
// req.user.weightUnit would always be undefined and every kg user would silently
// get lb-sized increments (5 instead of 2.5). Read it from the User document,
// the same way routes/export.js does.
async function weightUnitOf(userId) {
  const user = await User.findById(userId).select('weightUnit').lean();
  return user?.weightUnit || 'lb';
}

// How many past sessions the engine looks at. It only needs the most recent
// plus the most recent one at a different weight, but a few extra let the client
// show a short trend without another round trip.
const RECENT_SESSIONS = 5;
const MAX_RECENT_SESSIONS = 20;

// Load the plans this user may see, cheapest-relevant first: the plan they have
// active in the UI, then the master plan, then their own. `planId` comes from
// the client because "active plan" is a client-side preference (localStorage).
async function visiblePlans(userId, planId) {
  const filter = {
    archivedAt: null,
    $or: [{ isMaster: true }, { ownerUserId: userId }],
  };
  const plans = await WorkoutPlan.find(filter).select('_id isMaster days').lean();
  // Stable priority: active plan, then master, then the rest.
  return plans.sort((a, b) => {
    const rank = p => (planId && String(p._id) === String(planId) ? 0 : p.isMaster ? 1 : 2);
    return rank(a) - rank(b);
  });
}

// First matching plan exercise across the prioritised plans, by normalized name.
function findPlanExercise(plans, exerciseName, dayLabel) {
  const key = normalizeExerciseName(exerciseName);
  for (const plan of plans) {
    for (const day of plan.days || []) {
      if (dayLabel && day.label !== dayLabel) continue;
      for (const ex of day.exercises || []) {
        if (normalizeExerciseName(ex.exerciseName) === key) return ex;
      }
    }
  }
  return null;
}

// Build the full recommendation payload for one exercise.
function buildRecommendation({ exerciseName, bodyPart, sessions, setting, planExercise, weightUnit }) {
  const target = resolveTarget({ bodyPart, setting, planExercise });
  const { step, source: stepSource } = resolveStep({ weightUnit, bodyPart, setting });
  return {
    exerciseName,
    bodyPart,
    target,
    step,
    stepSource,
    recommendation: recommendNext({ sessions, target, step }),
  };
}

// Last N sessions for many exercises in ONE round trip. Without this the plan
// tab would fire a query per planned exercise.
async function recentSessionsByExercise(userId, names, limit) {
  if (!names.length) return new Map();
  const rows = await GymEntry.aggregate([
    { $match: { userId, exerciseName: { $in: names } } },
    { $sort: { date: -1, createdAt: -1 } },
    { $group: {
      _id: '$exerciseName',
      bodyPart: { $first: '$bodyPart' },
      sessions: { $push: { date: '$date', sets: '$sets' } },
    } },
    { $project: { bodyPart: 1, sessions: { $slice: ['$sessions', limit] } } },
  ]);
  return new Map(rows.map(r => [r._id, r]));
}

// ─── routes ─────────────────────────────────────────────────────────────────

// GET /api/gym/entries?date=YYYY-MM-DD
router.get('/entries', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const entries = await GymEntry.find({ userId: req.user._id, date }).sort({ createdAt: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/week?weekStart=YYYY-MM-DD  — returns all entries for a 7-day window
router.get('/week', async (req, res) => {
  try {
    const { weekStart } = req.query;
    if (!weekStart) return res.status(400).json({ error: 'weekStart required' });

    const dates = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const entries = await GymEntry.find(
      { userId: req.user._id, date: { $in: dates } }
    ).select('date bodyPart exerciseName planDayLabel');
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/exercise/:name/history?planId=&dayLabel=&recent=
//   Last session + all-time PR (unchanged shape, still the primary use), plus
//   the resolved target, weight step and the next-weight recommendation.
router.get('/exercise/:name/history', async (req, res) => {
  try {
    const exerciseName = decodeURIComponent(req.params.name);
    const recentCount = Math.min(
      MAX_RECENT_SESSIONS,
      Math.max(1, parseInt(req.query.recent, 10) || RECENT_SESSIONS),
    );

    // Recent sessions, newest first. Doubles as the "last session" panel and as
    // the engine's input, so one query serves both.
    const recent = await GymEntry.find({ userId: req.user._id, exerciseName })
      .sort({ date: -1, createdAt: -1 })
      .limit(recentCount)
      .lean();

    // All-time PR entry
    const pr = await GymEntry.findOne(
      { userId: req.user._id, exerciseName, isPersonalRecord: true },
    ).sort({ prWeight: -1 }).lean();

    const last = recent[0] || null;

    // bodyPart drives the default rep window and step when nothing else does.
    // Prefer the catalog over the last log so a recategorised exercise is right.
    const nameKey  = normalizeExerciseName(exerciseName);
    const catalog  = await Exercise.findOne({ nameKey }).select('bodyPart').lean();
    const bodyPart = catalog?.bodyPart || last?.bodyPart || null;

    const setting = await ExerciseSetting.findOne({ userId: req.user._id, nameKey }).lean();
    const plans   = await visiblePlans(req.user._id, req.query.planId);
    const planExercise = findPlanExercise(plans, exerciseName, req.query.dayLabel);

    const built = buildRecommendation({
      exerciseName,
      bodyPart,
      sessions: recent,
      setting,
      planExercise,
      weightUnit: await weightUnitOf(req.user._id),
    });

    res.json({
      last,
      pr: pr || null,
      recent,
      bodyPart,
      target: built.target,
      step: built.step,
      stepSource: built.stepSource,
      recommendation: built.recommendation,
      setting: setting || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/recommendations?planId=&dayLabel=&names=a,b,c
//   Bulk next-weight targets. Without `names` it covers every exercise in the
//   selected plan (optionally one day). Used by the Plan and Log tabs.
router.get('/recommendations', async (req, res) => {
  try {
    const { planId, dayLabel } = req.query;
    const plans = await visiblePlans(req.user._id, planId);

    // Explicit list wins; otherwise take the plan's exercises. Cap the list so a
    // hand-crafted query can't fan out without bound.
    let wanted = [];
    if (typeof req.query.names === 'string' && req.query.names.trim()) {
      wanted = req.query.names.split(',').map(n => n.trim()).filter(Boolean);
    } else {
      // Restrict to the ACTIVE plan when one was named, so the Plan tab reflects
      // the plan on screen rather than every plan the user can see.
      const scope = planId ? plans.filter(p => String(p._id) === String(planId)) : plans;
      const seen = new Set();
      for (const plan of scope) {
        for (const day of plan.days || []) {
          if (dayLabel && day.label !== dayLabel) continue;
          for (const ex of day.exercises || []) {
            const key = normalizeExerciseName(ex.exerciseName);
            if (!ex.exerciseName || seen.has(key)) continue;
            seen.add(key);
            wanted.push(ex.exerciseName);
          }
        }
      }
    }
    wanted = wanted.slice(0, 100);
    if (wanted.length === 0) return res.json([]);

    const keys = wanted.map(normalizeExerciseName);
    const [byExercise, settings, catalog, weightUnit] = await Promise.all([
      recentSessionsByExercise(req.user._id, wanted, RECENT_SESSIONS),
      ExerciseSetting.find({ userId: req.user._id, nameKey: { $in: keys } }).lean(),
      Exercise.find({ nameKey: { $in: keys } }).select('nameKey bodyPart').lean(),
      weightUnitOf(req.user._id),
    ]);

    const settingByKey  = new Map(settings.map(s => [s.nameKey, s]));
    const bodyPartByKey = new Map(catalog.map(c => [c.nameKey, c.bodyPart]));

    const out = wanted.map(name => {
      const key    = normalizeExerciseName(name);
      const logged = byExercise.get(name);
      return buildRecommendation({
        exerciseName: name,
        bodyPart:     bodyPartByKey.get(key) || logged?.bodyPart || null,
        sessions:     logged?.sessions || [],
        setting:      settingByKey.get(key) || null,
        planExercise: findPlanExercise(plans, name, dayLabel),
        weightUnit,
      });
    });

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/exercises  — list distinct exercise names for autocomplete
router.get('/exercises', async (req, res) => {
  try {
    const names = await GymEntry.distinct('exerciseName', { userId: req.user._id });
    res.json(names.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gym/entries
router.post('/entries', async (req, res) => {
  try {
    const { date, feel, sets, planDayLabel, safetyChecks } = req.body;
    let { bodyPart, exerciseName } = req.body;
    // Canonical-name guard: snap to the catalog so logs/progress share one key.
    const match = exerciseName
      ? await Exercise.findOne({ nameKey: normalizeExerciseName(exerciseName) })
      : null;
    ({ name: exerciseName, bodyPart } = canonicalizeExercise({ name: exerciseName, bodyPart }, match));
    const entry = new GymEntry({
      userId: req.user._id,
      date, bodyPart, exerciseName, feel, sets,
      planDayLabel: planDayLabel || '',
      safetyChecks: safetyChecks || {},
    });
    await checkAndMarkPR(entry, req.user._id);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/gym/entries/:id
router.put('/entries/:id', async (req, res) => {
  try {
    const entry = await GymEntry.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const { feel, sets, planDayLabel, safetyChecks } = req.body;
    let { bodyPart, exerciseName } = req.body;
    if (exerciseName) {
      // Canonical-name guard: snapping name also snaps bodyPart to the catalog.
      const match = await Exercise.findOne({ nameKey: normalizeExerciseName(exerciseName) });
      ({ name: exerciseName, bodyPart } = canonicalizeExercise(
        { name: exerciseName, bodyPart: bodyPart || entry.bodyPart }, match));
      entry.exerciseName = exerciseName;
      entry.bodyPart     = bodyPart;
    } else if (bodyPart) {
      entry.bodyPart = bodyPart;
    }
    if (feel)         entry.feel         = feel;
    if (sets)         entry.sets         = sets;
    if (planDayLabel !== undefined) entry.planDayLabel = planDayLabel;
    if (safetyChecks !== undefined) entry.safetyChecks = safetyChecks;

    await checkAndMarkPR(entry, req.user._id);
    await entry.save();
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gym/entries/:id
router.delete('/entries/:id', async (req, res) => {
  try {
    const entry = await GymEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── per-exercise progression settings ───────────────────────────────────────

// Every field is optional and nullable: null means "fall back to the plan, then
// to the body-part default". Absent means "leave whatever is already stored".
const SETTING_FIELDS = {
  weightStep: { min: 0.25, max: 100, integer: false },
  repsMin:    { min: 1,    max: 100, integer: true  },
  repsMax:    { min: 1,    max: 100, integer: true  },
  targetSets: { min: 1,    max: MAX_SETS, integer: true },
};

// Returns { values, error }. `values` only holds the fields actually supplied.
function parseSettingBody(body) {
  const values = {};
  for (const [field, spec] of Object.entries(SETTING_FIELDS)) {
    if (!(field in (body || {}))) continue;
    const raw = body[field];
    if (raw === null || raw === '') { values[field] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) return { error: `${field} must be a number or null` };
    if (spec.integer && !Number.isInteger(n)) return { error: `${field} must be a whole number` };
    if (n < spec.min || n > spec.max) {
      return { error: `${field} must be between ${spec.min} and ${spec.max}` };
    }
    values[field] = n;
  }
  return { values };
}

// GET /api/gym/exercise-settings — every override this user has made.
router.get('/exercise-settings', async (req, res) => {
  try {
    const list = await ExerciseSetting.find({ userId: req.user._id })
      .sort({ exerciseName: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/gym/exercise-settings/:name — upsert overrides for one exercise.
router.put('/exercise-settings/:name', async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name || '').trim();
    if (!rawName) return res.status(400).json({ error: 'exercise name required' });

    const { values, error } = parseSettingBody(req.body);
    if (error) return res.status(400).json({ error });
    if (Object.keys(values).length === 0) {
      return res.status(400).json({ error: 'no settings supplied' });
    }

    const nameKey = normalizeExerciseName(rawName);
    // Snap to the catalog so the stored display name matches everywhere else.
    const catalog = await Exercise.findOne({ nameKey }).select('name').lean();
    const exerciseName = catalog?.name || rawName;

    // findOneAndUpdate skips document middleware, so nameKey is set explicitly
    // here rather than relying on the model's pre('validate') hook.
    let doc = await ExerciseSetting.findOne({ userId: req.user._id, nameKey });
    if (!doc) doc = new ExerciseSetting({ userId: req.user._id, nameKey, exerciseName });
    doc.exerciseName = exerciseName;
    Object.assign(doc, values);

    // Cross-field check against the MERGED document, not just the patch: sending
    // only repsMin must still be rejected if it lands above the stored repsMax.
    if (doc.repsMin != null && doc.repsMax != null && doc.repsMin > doc.repsMax) {
      return res.status(400).json({ error: 'repsMin must be less than or equal to repsMax' });
    }

    await doc.save();
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Setting already exists' });
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gym/exercise-settings/:name — back to plan / body-part defaults.
router.delete('/exercise-settings/:name', async (req, res) => {
  try {
    const nameKey = normalizeExerciseName(decodeURIComponent(req.params.name || ''));
    if (!nameKey) return res.status(400).json({ error: 'exercise name required' });
    await ExerciseSetting.findOneAndDelete({ userId: req.user._id, nameKey });
    // Idempotent: "no override" is the desired end state either way.
    res.json({ message: 'Reset to defaults' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── exercise templates ──────────────────────────────────────────────────────

// GET /api/gym/exercises-list?bodyPart=  (optional filter) — shared across all users
router.get('/exercises-list', async (req, res) => {
  try {
    const filter = {};
    if (req.query.bodyPart) filter.bodyPart = req.query.bodyPart;
    const list = await Exercise.find(filter).sort({ name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function validVideoUrl(v) {
  if (v === undefined || v === null || v === '') return true;
  return typeof v === 'string' && /^https?:\/\/\S+/i.test(v.trim());
}

// POST /api/gym/exercises-list — anyone can add; userId stored for audit
router.post('/exercises-list', async (req, res) => {
  try {
    const { name, bodyPart, videoUrl } = req.body;
    if (!name || !bodyPart) return res.status(400).json({ error: 'name and bodyPart required' });
    if (!validVideoUrl(videoUrl)) return res.status(400).json({ error: 'videoUrl must be a valid http(s) URL' });

    const trimmedName = name.trim();
    const nameKey = normalizeExerciseName(trimmedName);
    const existing = await Exercise.findOne({ nameKey });
    if (existing) {
      const where = BODY_PART_LABEL[existing.bodyPart] || existing.bodyPart;
      return res.status(409).json({ error: `Exercise '${existing.name}' already exists in ${where}` });
    }

    const ex = await Exercise.create({
      userId: req.user._id,
      name: trimmedName,
      bodyPart,
      videoUrl: (videoUrl || '').trim(),
    });
    res.status(201).json(ex);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Exercise already exists' });
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/gym/exercises-list/:id
// - videoUrl: editable by any authenticated user (existing behavior).
// - name / bodyPart: admin only. Cascades to all GymEntry rows that referenced
//   the previous name so historical data stays consistent.
const BODY_PARTS = ['chest','back','shoulders','arms','legs','core','cardio','full_body'];
router.put('/exercises-list/:id', async (req, res) => {
  try {
    const { name, bodyPart, videoUrl } = req.body || {};
    const wantsNameOrBodyPart = name !== undefined || bodyPart !== undefined;

    if (wantsNameOrBodyPart && !isAdmin(req)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    if (videoUrl !== undefined && !validVideoUrl(videoUrl)) {
      return res.status(400).json({ error: 'videoUrl must be a valid http(s) URL' });
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name must be a non-empty string' });
    }
    if (bodyPart !== undefined && !BODY_PARTS.includes(bodyPart)) {
      return res.status(400).json({ error: `bodyPart must be one of ${BODY_PARTS.join(', ')}` });
    }

    const ex = await Exercise.findById(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Not found' });

    const oldName = ex.name;
    const oldBodyPart = ex.bodyPart;
    let nameChanged = false;
    let bodyPartChanged = false;

    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed !== ex.name) {
        const newKey = normalizeExerciseName(trimmed);
        if (newKey !== ex.nameKey) {
          const collision = await Exercise.findOne({ nameKey: newKey, _id: { $ne: ex._id } });
          if (collision) {
            const where = BODY_PART_LABEL[collision.bodyPart] || collision.bodyPart;
            return res.status(409).json({ error: `Exercise '${collision.name}' already exists in ${where}` });
          }
        }
        ex.name = trimmed;
        nameChanged = true;
      }
    }
    if (bodyPart !== undefined && bodyPart !== ex.bodyPart) {
      ex.bodyPart = bodyPart;
      bodyPartChanged = true;
    }
    if (videoUrl !== undefined) {
      ex.videoUrl = (videoUrl || '').trim();
    }

    await ex.save();

    let entriesUpdated = 0;
    if (nameChanged || bodyPartChanged) {
      const setOps = {};
      if (nameChanged)     setOps.exerciseName = ex.name;
      if (bodyPartChanged) setOps.bodyPart     = ex.bodyPart;
      // Match historic entries by the OLD name (and old bodyPart when only bodyPart changes,
      // to avoid retagging unrelated entries that happen to share a name).
      const filter = { exerciseName: oldName };
      if (!nameChanged) filter.bodyPart = oldBodyPart;
      const result = await GymEntry.updateMany(filter, { $set: setOps });
      entriesUpdated = result.modifiedCount || 0;
    }

    res.json({ ...ex.toObject(), entriesUpdated });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Exercise name already exists' });
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gym/exercises-list/:id — admin only
router.delete('/exercises-list/:id', requireAdmin, async (req, res) => {
  try {
    const ex = await Exercise.findByIdAndDelete(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/progress?weeks=12
router.get('/progress', async (req, res) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 12, 52);

    // Build Monday-aligned week start dates for the last N weeks
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + daysToMon);
    thisMonday.setHours(0, 0, 0, 0);

    const weekStarts = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(thisMonday);
      d.setDate(d.getDate() - i * 7);
      weekStarts.push(d.toISOString().slice(0, 10));
    }

    // Date range: first Monday → end of current week
    const rangeEnd = new Date(thisMonday);
    rangeEnd.setDate(rangeEnd.getDate() + 6);
    const rangeStart = weekStarts[0];
    const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

    const entries = await GymEntry.find({
      userId: req.user._id,
      date: { $gte: rangeStart, $lte: rangeEndStr },
    }).lean();

    if (entries.length === 0) return res.json([]);

    // Map a YYYY-MM-DD date to its Monday week-start
    function toWeekStart(dateStr) {
      const d = new Date(dateStr);
      const dow = d.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }

    // Aggregate: exerciseName → bodyPart + per-week stats
    const map = {};
    for (const entry of entries) {
      if (!map[entry.exerciseName]) {
        map[entry.exerciseName] = { bodyPart: entry.bodyPart, weeks: {} };
      }
      const ws = toWeekStart(entry.date);
      if (!map[entry.exerciseName].weeks[ws]) {
        map[entry.exerciseName].weeks[ws] = { maxWeight: 0, totalVolume: 0, sessions: 0 };
      }
      const w = map[entry.exerciseName].weeks[ws];
      w.sessions++;
      w.maxWeight = Math.max(w.maxWeight, entry.prWeight || 0);
      const vol = entry.sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
      w.totalVolume += vol;
    }

    // Build result with zero-filled weeks
    const result = Object.entries(map).map(([exerciseName, data]) => ({
      exerciseName,
      bodyPart: data.bodyPart,
      weeks: weekStarts.map(ws => ({
        weekStart: ws,
        maxWeight: data.weeks[ws]?.maxWeight || 0,
        totalVolume: data.weeks[ws]?.totalVolume || 0,
        sessions: data.weeks[ws]?.sessions || 0,
      })),
    }));

    // Sort by most recently active week
    result.sort((a, b) => {
      const lastActive = arr => [...arr].reverse().find(w => w.sessions > 0)?.weekStart || '';
      return lastActive(b.weeks).localeCompare(lastActive(a.weeks));
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
