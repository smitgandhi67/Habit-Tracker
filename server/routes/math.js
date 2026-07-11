const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const MathDailyStat = require('../models/MathDailyStat');
const MathFactMastery = require('../models/MathFactMastery');
const MathReward = require('../models/MathReward');
const MathPointAdjustment = require('../models/MathPointAdjustment');
const MathRewardConfig = require('../models/MathRewardConfig');
const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');
const ProblemAward = require('../models/ProblemAward');
const User = require('../models/User');
const { requireAdmin } = require('../utils/auth');
const {
  DEFAULT_REWARDS,
  factKeyFor,
  balanceOf,
  pointsForOp,
  PROMOTE_AT,
  MAX_LEVEL,
  DEMOTE_STEP,
  dueDateAfter,
  initialLevelFor,
} = require('../utils/math');
const { OP_KEYS, validateOperands, isCorrect } = require('../utils/questionTypes');
const { effectivePoints } = require('../utils/mathBonus');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPS = OP_KEYS; // every registered question type (mul/add/sub/div/sq/sqrt/…)

// Validation + grading are owned by the question-type registry (the trust boundary):
// the server re-grades every answer itself and never trusts a client verdict.
const validOperands = (op, a, b) => validateOperands(op, a, b);
const isCorrectAnswer = (op, a, b, answer) => isCorrect(op, a, b, answer);

// ---- Leitner mastery -------------------------------------------------------

// Apply one graded answer to a fact's spaced-repetition state. First-try-correct on
// a new day advances the streak; PROMOTE_AT distinct-day corrects bump the level and
// rest the fact (dueDate pushed out). A first-try miss of a due fact demotes it and
// resurfaces it now. Non-first-try answers don't move mastery. Idempotent within a
// day for corrects (lastCorrectDate guard → at most one step per day per fact).
async function applyMastery(userId, op, a, b, correct, firstTry, date) {
  if (firstTry !== true) return;
  const factKey = factKeyFor(op, a, b);
  const fp = await MathFactMastery.findOneAndUpdate(
    { userId, op, factKey },
    { $setOnInsert: { level: initialLevelFor(op, a, b), streakCount: 0, lastCorrectDate: null, dueDate: null, lapses: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (correct) {
    if (fp.lastCorrectDate === date) return; // already counted today
    fp.streakCount += 1;
    fp.lastCorrectDate = date;
    if (fp.streakCount >= PROMOTE_AT) {
      fp.level = Math.min(MAX_LEVEL, fp.level + 1);
      fp.dueDate = dueDateAfter(date, fp.level);
      fp.streakCount = 0;
      fp.lastCorrectDate = null; // fresh cycle when it next comes due
    }
    await fp.save();
    return;
  }

  // First-try miss: only demote a fact that was actually due (resting facts are
  // never shown by the picker, but guard anyway).
  const isDue = !fp.dueDate || fp.dueDate <= date;
  if (!isDue) return;
  fp.level = Math.max(0, fp.level - DEMOTE_STEP);
  fp.streakCount = 0;
  fp.lastCorrectDate = null;
  fp.dueDate = date;
  fp.lapses += 1;
  await fp.save();
}

// Build the client's scheduling view: per-op resting (suppressed) fact keys and a
// factKey→level map (so the client can prioritize low levels). `date` is the kid's
// local today; a fact rests while dueDate > today.
async function scheduleStateFor(userId, date) {
  const rows = await MathFactMastery.find({ userId }).select('op factKey level dueDate lastCorrectDate').lean();
  const suppressedByOp = {};
  const levelsByOp = {};
  for (const k of OP_KEYS) { suppressedByOp[k] = []; levelsByOp[k] = {}; }
  for (const m of rows) {
    if (!levelsByOp[m.op]) continue; // ignore rows for a retired/unknown type
    levelsByOp[m.op][m.factKey] = m.level;
    // A fact rests if it's not due yet, OR it was already answered correctly today
    // (one correct credit per fact per day — it returns tomorrow).
    const resting = m.dueDate && m.dueDate > date;
    const answeredToday = m.lastCorrectDate === date;
    if (resting || answeredToday) suppressedByOp[m.op].push(m.factKey);
  }
  return { suppressedByOp, levelsByOp };
}

// ---- helpers --------------------------------------------------------------

// Reward catalog, seeded from defaults on first access.
async function getConfig() {
  let cfg = await MathRewardConfig.findOne({ singleton: 'config' });
  if (!cfg) {
    cfg = await MathRewardConfig.create({ singleton: 'config', rewards: DEFAULT_REWARDS });
  }
  return cfg;
}

async function getReward(userId) {
  let r = await MathReward.findOne({ userId });
  if (!r) r = await MathReward.create({ userId, pointsEarned: 0, pointsSpent: 0 });
  return r;
}

function rewardSummary(reward) {
  const pointsEarned = reward?.pointsEarned || 0;
  const pointsSpent = reward?.pointsSpent || 0;
  return { pointsEarned, pointsSpent, balance: Math.max(0, pointsEarned - pointsSpent) };
}

function sleepoverPct(balance, rewards) {
  const sleepover = rewards.find(r => r.key === 'sleepover');
  if (!sleepover || sleepover.costPoints <= 0) return 0;
  return Math.min(1, balance / sleepover.costPoints);
}

// Attach affordable quantity to each reward for the client.
function rewardsWithAffordability(rewards, balance) {
  return rewards.map(r => ({
    key: r.key,
    label: r.label,
    costPoints: r.costPoints,
    unit: r.unit,
    affordableQty: r.costPoints > 0 ? Math.floor(balance / r.costPoints) : 0,
  }));
}

// ---- kid (self) routes ----------------------------------------------------

// GET /api/math/state?date=YYYY-MM-DD — pool + today's counters + wallet.
router.get('/state', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    const userId = req.user._id;

    const [cfg, reward, daily, schedule] = await Promise.all([
      getConfig(),
      getReward(userId),
      MathDailyStat.findOne({ userId, date }).lean(),
      scheduleStateFor(userId, date),
    ]);

    const summary = rewardSummary(reward);
    res.json({
      suppressedByOp: schedule.suppressedByOp,
      levelsByOp: schedule.levelsByOp,
      today: { attempted: daily?.attempted || 0, correct: daily?.correct || 0 },
      reward: summary,
      rewards: rewardsWithAffordability(cfg.rewards, summary.balance),
      sleepoverPct: sleepoverPct(summary.balance, cfg.rewards),
    });
  } catch (err) { next(err); }
});

// POST /api/math/answer — body { a, b, answer, firstTry, date, op? }
// op is 'mul' (default), 'add', 'sub', or 'div'. Server validates correctness itself;
// never trusts a client-supplied verdict. Spaced-repetition mastery applies to all ops.
router.post('/answer', async (req, res, next) => {
  try {
    const { a, b, answer, firstTry, date, op = 'mul' } = req.body || {};
    if (!OPS.includes(op)) return res.status(400).json({ error: `op must be one of: ${OPS.join(', ')}` });
    if (!validOperands(op, a, b)) return res.status(400).json({ error: 'invalid operands for operation' });
    if (!Number.isFinite(answer)) return res.status(400).json({ error: 'answer must be a number' }); // non-integer for fractions; isCorrect re-grades
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

    const userId = req.user._id;
    const correct = isCorrectAnswer(op, a, b, answer);
    const earns = correct && firstTry === true; // only first-try-correct earns points
    // weighted by operation (div=4, sub=3, else=1); 1-point Qs get the temp per-kid promo
    const pts = earns ? effectivePoints(pointsForOp(op), req.user) : 0;

    // Daily counters: always attempted++, correct++ when it earns, points by weight.
    await MathDailyStat.findOneAndUpdate(
      { userId, date },
      { $inc: { attempted: 1, correct: earns ? 1 : 0, points: pts } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Spaced-repetition: advance/demote this fact's mastery (all ops).
    await applyMastery(userId, op, a, b, correct, firstTry === true, date);

    let summary;
    if (earns) {
      const reward = await MathReward.findOneAndUpdate(
        { userId },
        { $inc: { pointsEarned: pts } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      summary = rewardSummary(reward);
    } else {
      summary = rewardSummary(await getReward(userId));
    }

    res.json({ correct, factKey: factKeyFor(op, a, b), reward: summary });
  } catch (err) { next(err); }
});

// POST /api/math/answer/batch — body { answers: [{ a, b, answer, firstTry, date, op? }] }
// Same grading as /answer but for a buffered batch (one Lambda call for N answers).
// Server still re-grades each (never trusts the client). Returns the authoritative
// wallet + the current scheduling state (suppressed facts + levels) so the client
// can reconcile its pool.
const MAX_BATCH = 200;
router.post('/answer/batch', async (req, res, next) => {
  try {
    const { answers } = req.body || {};
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers must be a non-empty array' });
    }
    if (answers.length > MAX_BATCH) return res.status(400).json({ error: `max ${MAX_BATCH} answers per batch` });
    for (const it of answers) {
      const op = it.op || 'mul';
      if (!OPS.includes(op) || !validOperands(op, it.a, it.b) || !Number.isFinite(it.answer) || !it.date || !ISO_DATE.test(it.date)) {
        return res.status(400).json({ error: 'each answer needs valid op, operands, a numeric answer, and date' });
      }
    }

    const userId = req.user._id;

    // Group by date so daily stats + week keys stay correct across a midnight crossover.
    const byDate = new Map();
    for (const it of answers) {
      if (!byDate.has(it.date)) byDate.set(it.date, []);
      byDate.get(it.date).push(it);
    }

    let pointsInc = 0;
    for (const [date, items] of byDate) {
      let attempted = 0, correct = 0, points = 0;
      for (const it of items) {
        const op = it.op || 'mul';
        attempted += 1;
        const isCorrect = isCorrectAnswer(op, it.a, it.b, it.answer);
        if (isCorrect && it.firstTry === true) {
          correct += 1;
          points += effectivePoints(pointsForOp(op), req.user); // weighted; 1-pt Qs boosted by the temp promo
        }
        // Spaced-repetition: advance on first-try-correct (distinct-day guarded inside),
        // demote on a first-try miss of a due fact. Sequential so the per-fact
        // read-modify-write sees prior updates within this batch.
        await applyMastery(userId, op, it.a, it.b, isCorrect, it.firstTry === true, date);
      }
      pointsInc += points;

      await MathDailyStat.findOneAndUpdate(
        { userId, date },
        { $inc: { attempted, correct, points } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const reward = pointsInc > 0
      ? await MathReward.findOneAndUpdate({ userId }, { $inc: { pointsEarned: pointsInc } }, { upsert: true, new: true, setDefaultsOnInsert: true })
      : await getReward(userId);

    // Reconcile scheduling state + today's counters against the most recent batch date.
    const latestDate = answers.map(a => a.date).sort().at(-1);
    const [schedule, daily] = await Promise.all([
      scheduleStateFor(userId, latestDate),
      MathDailyStat.findOne({ userId, date: latestDate }).lean(),
    ]);

    res.json({
      reward: rewardSummary(reward),
      suppressedByOp: schedule.suppressedByOp,
      levelsByOp: schedule.levelsByOp,
      today: { attempted: daily?.attempted || 0, correct: daily?.correct || 0 },
    });
  } catch (err) { next(err); }
});

// Timed drills (zigzag addition, step multiplication). Each is an infinite random
// pool, so points are tiered per day to stop endless farming at the full rate: the
// first N first-try-correct answers each earn the drill's tier-1 rate, and every
// correct answer after that earns DRILL_TIER2_POINTS.
const DRILL_TIER2_POINTS   = 1;
const ZIGZAG_TIER1_POINTS  = 15, ZIGZAG_TIER1_LIMIT  = 20;
const STEPMUL_TIER1_POINTS = 10, STEPMUL_TIER1_LIMIT = 20;
const isZigzagOperand3  = (v) => Number.isInteger(v) && v >= 100 && v <= 999;
const isZigzagOperand2  = (v) => Number.isInteger(v) && v >= 10 && v <= 99; // grades 2-3
const isStepmulTwoDigit = (v) => Number.isInteger(v) && v >= 26 && v <= 99; // "two-digit >25"
const isStepmulOneDigit = (v) => Number.isInteger(v) && v >= 2 && v <= 9;   // non-trivial one-digit

// Record one drill attempt and credit the tiered points on a first-try-correct answer.
// `counterField` is the per-day count of correct answers for this drill (drives the
// tier). The attempt also feeds the shared daily stats so drills show in the week chart
// + points ledger, same as fact practice. Returns the awarded points + wallet summary.
async function creditDrill(userId, date, correct, counterField, tier1Points, tier1Limit) {
  const daily = await MathDailyStat.findOne({ userId, date }).select(counterField).lean();
  const priorCorrect = daily?.[counterField] || 0;
  const award = correct
    ? (priorCorrect < tier1Limit ? tier1Points : DRILL_TIER2_POINTS)
    : 0;

  await MathDailyStat.findOneAndUpdate(
    { userId, date },
    { $inc: { attempted: 1, correct: correct ? 1 : 0, points: award, [counterField]: correct ? 1 : 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const reward = award > 0
    ? await MathReward.findOneAndUpdate({ userId }, { $inc: { pointsEarned: award } }, { upsert: true, new: true, setDefaultsOnInsert: true })
    : await getReward(userId);

  return { award, reward: rewardSummary(reward) };
}

// POST /api/math/zigzag/answer — body { a, b, c, answer, date }. Grades 2-3: two
// 2-digit operands, c omitted/null. Grades 4-5 (and unset): three 3-digit operands.
// Server re-grades a+b(+c) (never trusts the client). One request per question
// (low volume: 10–20s each), so no batching.
router.post('/zigzag/answer', async (req, res, next) => {
  try {
    const { a, b, c, answer, date } = req.body || {};
    if (!Number.isFinite(answer) || !date || !ISO_DATE.test(date)) {
      return res.status(400).json({ error: 'need operands, a numeric answer, and a valid date' });
    }
    let correct;
    if (c === null || c === undefined) {
      if (!isZigzagOperand2(a) || !isZigzagOperand2(b)) {
        return res.status(400).json({ error: 'need two 2-digit operands, a numeric answer, and a valid date' });
      }
      correct = a + b === answer;
    } else {
      if (!isZigzagOperand3(a) || !isZigzagOperand3(b) || !isZigzagOperand3(c)) {
        return res.status(400).json({ error: 'need three 3-digit operands, a numeric answer, and a valid date' });
      }
      correct = a + b + c === answer;
    }
    const { award, reward } = await creditDrill(req.user._id, date, correct, 'zigzag', ZIGZAG_TIER1_POINTS, ZIGZAG_TIER1_LIMIT);
    res.json({ correct, awarded: award, reward });
  } catch (err) { next(err); }
});

// POST /api/math/stepmul/answer — body { a, b, answer, date }. Two-digit (>25) ×
// one-digit. Server re-grades a*b (never trusts the client).
router.post('/stepmul/answer', async (req, res, next) => {
  try {
    const { a, b, answer, date } = req.body || {};
    if (!isStepmulTwoDigit(a) || !isStepmulOneDigit(b) ||
        !Number.isFinite(answer) || !date || !ISO_DATE.test(date)) {
      return res.status(400).json({ error: 'need a two-digit (>25) operand, a one-digit operand, a numeric answer, and a valid date' });
    }
    const correct = a * b === answer;
    const { award, reward } = await creditDrill(req.user._id, date, correct, 'stepmul', STEPMUL_TIER1_POINTS, STEPMUL_TIER1_LIMIT);
    res.json({ correct, awarded: award, reward });
  } catch (err) { next(err); }
});

// POST /api/math/redeem — body { rewardKey, qty }. Spends points from the balance.
router.post('/redeem', async (req, res, next) => {
  try {
    const { rewardKey, qty = 1 } = req.body || {};
    if (!rewardKey) return res.status(400).json({ error: 'rewardKey required' });
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'qty must be a positive integer' });

    const cfg = await getConfig();
    const reward = cfg.rewards.find(r => r.key === rewardKey);
    if (!reward) return res.status(404).json({ error: 'Unknown reward' });

    const cost = reward.costPoints * qty;
    const userId = req.user._id;
    const wallet = await getReward(userId);
    if (balanceOf(wallet) < cost) return res.status(400).json({ error: 'Not enough points' });

    wallet.pointsSpent += cost;
    await wallet.save();
    await MathPointAdjustment.create({
      userId, adminEmail: null, type: 'redeem', rewardKey, amount: cost,
      reason: `Redeemed ${qty} ${reward.unit}(s) of ${reward.label}`,
    });

    res.json({ reward: rewardSummary(wallet) });
  } catch (err) { next(err); }
});

// GET /api/math/progress?date=YYYY-MM-DD&weeks=8 — daily stats for the trailing window.
router.get('/progress', async (req, res, next) => {
  try {
    const { date } = req.query;
    const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 1), 52);
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

    // Build the trailing list of date strings from the client's "today".
    const days = weeks * 7;
    const [y, m, d] = date.split('-').map(Number);
    const dates = [];
    for (let i = 0; i < days; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d - i));
      dates.push(dt.toISOString().slice(0, 10));
    }

    const stats = await MathDailyStat.find({ userId: req.user._id, date: { $in: dates } })
      .select('date attempted correct').lean();
    res.json({ days: stats });
  } catch (err) { next(err); }
});

// GET /api/math/awards?dates=d1,d2 — the signed-in kid's own habit-point awards
// (status + points per habit/day), so habit cards can show pending/approved state.
router.get('/awards', async (req, res, next) => {
  try {
    const { dates } = req.query;
    if (!dates) return res.status(400).json({ error: 'dates query param required' });
    const list = dates.split(',').slice(0, 200).filter(d => ISO_DATE.test(d));
    if (list.length === 0) return res.json([]);
    const awards = await HabitPointAward.find({ userId: req.user._id, date: { $in: list } })
      .select('habitId date points status').lean();
    res.json(awards);
  } catch (err) { next(err); }
});

// ---- admin routes ---------------------------------------------------------

// GET /api/math/admin/users — every user with their points summary.
router.get('/admin/users', requireAdmin, async (req, res, next) => {
  try {
    const cfg = await getConfig();
    const [users, rewards] = await Promise.all([
      User.find().select('name email grade').lean(),
      MathReward.find().lean(),
    ]);
    const byUser = new Map(rewards.map(r => [String(r.userId), r]));
    const list = users.map(u => {
      const summary = rewardSummary(byUser.get(String(u._id)));
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        grade: u.grade ?? null,
        ...summary,
        sleepoverPct: sleepoverPct(summary.balance, cfg.rewards),
      };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json(list);
  } catch (err) { next(err); }
});

// PUT /api/math/admin/grade — body { userId, grade: 2|3|4|5|null }. Parent sets a
// kid's school grade (drives the math difficulty caps). Admin-only.
router.put('/admin/grade', requireAdmin, async (req, res, next) => {
  try {
    const { userId, grade } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'valid userId required' });
    if (grade !== null && ![2, 3, 4, 5].includes(grade)) {
      return res.status(400).json({ error: 'grade must be 2, 3, 4, 5, or null' });
    }
    const user = await User.findByIdAndUpdate(userId, { grade }, { new: true }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ _id: user._id, grade: user.grade ?? null });
  } catch (err) { next(err); }
});

// POST /api/math/admin/adjust — body { userId, type, amount, reason }
router.post('/admin/adjust', requireAdmin, async (req, res, next) => {
  try {
    const { userId, type, amount, reason = '' } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'valid userId required' });
    if (!['deduct', 'add', 'reset'].includes(type)) return res.status(400).json({ error: 'type must be deduct|add|reset' });

    const wallet = await getReward(userId);
    let magnitude = 0;
    if (type === 'reset') {
      magnitude = wallet.pointsEarned; // record what was wiped
      wallet.pointsEarned = 0;
      wallet.pointsSpent = 0;
    } else {
      if (!Number.isInteger(amount) || amount < 1) return res.status(400).json({ error: 'amount must be a positive integer' });
      magnitude = amount;
      if (type === 'deduct') wallet.pointsSpent += amount;   // remove points from the balance
      else wallet.pointsEarned += amount;                    // add/bonus → grows the balance
    }
    await wallet.save();
    await MathPointAdjustment.create({
      userId, adminEmail: req.user.email, type, amount: magnitude, reason,
    });

    res.json({ reward: rewardSummary(wallet) });
  } catch (err) { next(err); }
});

// GET /api/math/admin/config — current reward catalog.
router.get('/admin/config', requireAdmin, async (req, res, next) => {
  try {
    const cfg = await getConfig();
    res.json({ rewards: cfg.rewards });
  } catch (err) { next(err); }
});

// Slugify a label into a stable reward key: lowercase alphanumerics joined by '-'.
function slugifyKey(s) {
  const slug = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'reward';
}

// PUT /api/math/admin/config — body { rewards: [{ key?, label, costPoints, unit }] }.
// Parent-managed reward catalog. New rewards may omit `key` — one is generated from the
// label and de-duplicated. Costs are points-per-unit ('event' one-shot | 'minute' qty).
router.put('/admin/config', requireAdmin, async (req, res, next) => {
  try {
    const { rewards } = req.body || {};
    if (!Array.isArray(rewards) || rewards.length === 0) {
      return res.status(400).json({ error: 'rewards must be a non-empty array' });
    }
    const seen = new Set();
    const clean = [];
    for (const r of rewards) {
      const label = String(r.label || '').trim();
      if (!label) return res.status(400).json({ error: 'each reward needs a label' });
      if (label.length > 60) return res.status(400).json({ error: 'label too long (max 60)' });
      if (!Number.isInteger(r.costPoints) || r.costPoints < 1) {
        return res.status(400).json({ error: `costPoints for "${label}" must be a positive integer` });
      }
      // Use the provided key if any, else derive from the label; ensure uniqueness.
      let key = slugifyKey(r.key || label);
      if (seen.has(key)) {
        let n = 2;
        while (seen.has(`${key}-${n}`)) n++;
        key = `${key}-${n}`;
      }
      seen.add(key);
      clean.push({ key, label, costPoints: r.costPoints, unit: r.unit === 'minute' ? 'minute' : 'event' });
    }
    const cfg = await MathRewardConfig.findOneAndUpdate(
      { singleton: 'config' },
      { rewards: clean },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ rewards: cfg.rewards });
  } catch (err) { next(err); }
});

// ---- admin: habit points + approvals --------------------------------------

// GET /api/math/admin/habits?userId= — active habits (optionally for one kid) with
// their point value, for the points-assignment UI.
router.get('/admin/habits', requireAdmin, async (req, res, next) => {
  try {
    const filter = { archivedAt: null };
    if (req.query.userId) {
      if (!mongoose.isValidObjectId(req.query.userId)) return res.status(400).json({ error: 'valid userId required' });
      filter.userId = req.query.userId;
    }
    const habits = await Habit.find(filter).select('userId name emoji points order').sort({ order: 1 }).lean();
    res.json(habits);
  } catch (err) { next(err); }
});

// PUT /api/math/admin/habits/:habitId/points — body { points }
router.put('/admin/habits/:habitId/points', requireAdmin, async (req, res, next) => {
  try {
    const { points } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.habitId)) return res.status(400).json({ error: 'valid habitId required' });
    if (!Number.isInteger(points) || points < 0) return res.status(400).json({ error: 'points must be a non-negative integer' });
    const habit = await Habit.findByIdAndUpdate(req.params.habitId, { points }, { new: true }).select('_id name points').lean();
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    res.json(habit);
  } catch (err) { next(err); }
});

// Emoji per problem kind, so solved-problem awards read nicely in the parent queue.
const PROBLEM_KIND_EMOJI = { idea: '💡', curiosity: '🤔', annoyance: '😤' };

// GET /api/math/admin/habit-awards?status=pending — awards to review, enriched with
// kid + habit names. Merges habit completions and solved-problem awards into one queue
// (each row tagged `source`). Defaults to pending; accepts pending|approved|rejected.
router.get('/admin/habit-awards', requireAdmin, async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const [habitAwards, problemAwards] = await Promise.all([
      HabitPointAward.find({ status }).sort({ date: -1, createdAt: -1 }).limit(500).lean(),
      ProblemAward.find({ status }).sort({ date: -1, createdAt: -1 }).limit(500).lean(),
    ]);
    const userIds = [...new Set([...habitAwards, ...problemAwards].map(a => String(a.userId)))];
    const habitIds = [...new Set(habitAwards.map(a => String(a.habitId)))];
    const [users, habits] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('name email').lean(),
      Habit.find({ _id: { $in: habitIds } }).select('name emoji').lean(),
    ]);
    const userMap = new Map(users.map(u => [String(u._id), u]));
    const habitMap = new Map(habits.map(h => [String(h._id), h]));
    const rows = [
      ...habitAwards.map(a => ({
        _id: a._id,
        source: 'habit',
        userId: a.userId,
        userName: userMap.get(String(a.userId))?.name || '—',
        habitId: a.habitId,
        habitName: habitMap.get(String(a.habitId))?.name || '—',
        habitEmoji: habitMap.get(String(a.habitId))?.emoji || '',
        date: a.date,
        points: a.points,
        status: a.status,
        createdAt: a.createdAt,
      })),
      ...problemAwards.map(a => ({
        _id: a._id,
        source: 'problem',
        userId: a.userId,
        userName: userMap.get(String(a.userId))?.name || '—',
        habitId: null,
        habitName: a.text,
        habitEmoji: PROBLEM_KIND_EMOJI[a.kind] || '💡',
        date: a.date,
        points: a.points,
        status: a.status,
        createdAt: a.createdAt,
      })),
    ];
    // Newest first across both sources (date, then created time).
    rows.sort((x, y) => (y.date || '').localeCompare(x.date || '') || new Date(y.createdAt) - new Date(x.createdAt));
    res.json(rows.map(({ createdAt, ...r }) => r));
  } catch (err) { next(err); }
});

// Approve a single solved-problem award (pending->approved): atomic claim, credit the
// shared pool, write an audit row. Mirrors the habit-award approve guards. Returns a
// small result the caller maps to an HTTP response: { notFound } | { conflict } | { award }.
async function approveProblemAward(id, adminEmail) {
  const award = await ProblemAward.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: 'approved', reviewedBy: adminEmail, reviewedAt: new Date() } },
    { new: true }
  );
  if (!award) {
    const existing = await ProblemAward.findById(id).lean();
    if (!existing) return { notFound: true };
    if (existing.status === 'approved') return { award: existing }; // idempotent, no double credit
    return { conflict: existing.status };
  }
  if (award.points > 0) {
    try {
      await MathReward.findOneAndUpdate(
        { userId: award.userId },
        { $inc: { pointsEarned: award.points }, $setOnInsert: { pointsSpent: 0 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await MathPointAdjustment.create({
        userId: award.userId, adminEmail, type: 'add',
        amount: award.points, reason: `Problem solved: "${award.text}"`,
      });
    } catch (creditErr) {
      // Revert the flip so the award isn't left approved-but-uncredited; safe to retry.
      await ProblemAward.updateOne(
        { _id: award._id },
        { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
      );
      throw creditErr;
    }
  }
  return { award };
}

// POST /api/math/admin/habit-awards/:id/approve — idempotent: credits the kid's pool
// once on the pending→approved transition, with an audit row.
router.post('/admin/habit-awards/:id/approve', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid award id required' });
    // Atomic claim: only the pending→approved transition proceeds. Concurrent approves
    // of the same award (double-click, retried request) can never double-credit the pool
    // because just one updateOne wins the guarded filter.
    const award = await HabitPointAward.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { $set: { status: 'approved', reviewedBy: req.user.email, reviewedAt: new Date() } },
      { new: true }
    );
    if (!award) {
      // Didn't transition. Either it's a solved-problem award (different collection),
      // or a habit award that's missing/already-reviewed. Distinguish for the client.
      const existing = await HabitPointAward.findById(req.params.id).lean();
      if (!existing) {
        const r = await approveProblemAward(req.params.id, req.user.email);
        if (r.notFound) return res.status(404).json({ error: 'Award not found' });
        if (r.conflict) return res.status(409).json({ error: `Cannot approve a ${r.conflict} award` });
        return res.json({ award: r.award });
      }
      if (existing.status === 'approved') return res.json({ award: existing }); // idempotent, no double credit
      return res.status(409).json({ error: `Cannot approve a ${existing.status} award` });
    }

    if (award.points > 0) {
      try {
        const habit = await Habit.findById(award.habitId).select('name').lean();
        const habitName = habit?.name || 'Unknown habit';
        await MathReward.findOneAndUpdate(
          { userId: award.userId },
          { $inc: { pointsEarned: award.points } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        await MathPointAdjustment.create({
          userId: award.userId, adminEmail: req.user.email, type: 'add',
          amount: award.points, reason: `Habit award: ${habitName} (${award.date})`,
        });
      } catch (creditErr) {
        // Revert the flip so the award isn't left approved-but-uncredited; safe to retry.
        await HabitPointAward.updateOne(
          { _id: award._id },
          { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
        );
        throw creditErr;
      }
    }
    res.json({ award });
  } catch (err) { next(err); }
});

// POST /api/math/admin/habit-awards/:id/reject — only from pending (approved is final).
router.post('/admin/habit-awards/:id/reject', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid award id required' });
    const award = await HabitPointAward.findById(req.params.id)
      || await ProblemAward.findById(req.params.id);
    if (!award) return res.status(404).json({ error: 'Award not found' });
    if (award.status === 'approved') return res.status(409).json({ error: 'Cannot reject an already-approved award' });

    award.status = 'rejected';
    award.reviewedBy = req.user.email;
    award.reviewedAt = new Date();
    await award.save();
    res.json({ award });
  } catch (err) { next(err); }
});

// POST /api/math/admin/habit-awards/approve-batch — body { ids: [...] }. Approves many
// pending awards in a single round trip (saves Lambda + Mongo cost vs N calls). Atomic:
// a guarded updateMany flips only still-pending rows, then a unique reviewedAt stamp lets
// us re-read exactly the rows THIS request transitioned (race-safe under concurrent admins
// and idempotent — already-approved/rejected/missing ids are skipped, never double-credited).
const APPROVE_BATCH_MAX = 200;
router.post('/admin/habit-awards/approve-batch', requireAdmin, async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    if (!ids || ids.length === 0) return res.status(400).json({ error: 'ids must be a non-empty array' });
    if (ids.length > APPROVE_BATCH_MAX) return res.status(400).json({ error: `Cannot approve more than ${APPROVE_BATCH_MAX} at once` });
    const validIds = [...new Set(ids.filter(id => mongoose.isValidObjectId(id)).map(String))];
    if (validIds.length === 0) return res.status(400).json({ error: 'no valid award ids' });

    const ts = new Date();
    await HabitPointAward.updateMany(
      { _id: { $in: validIds }, status: 'pending' },
      { $set: { status: 'approved', reviewedBy: req.user.email, reviewedAt: ts } }
    );
    const claimed = await HabitPointAward.find(
      { _id: { $in: validIds }, status: 'approved', reviewedBy: req.user.email, reviewedAt: ts }
    ).lean();

    // Sum points per kid → one $inc per distinct kid (bulk), one audit row per credited award.
    if (claimed.length > 0) {
      const perUser = new Map();
      for (const a of claimed) {
        if (a.points > 0) perUser.set(String(a.userId), (perUser.get(String(a.userId)) || 0) + a.points);
      }
      if (perUser.size > 0) {
        try {
          const credited = claimed.filter(a => a.points > 0);
          const habitIds = [...new Set(credited.map(a => String(a.habitId)))];
          const habits = await Habit.find({ _id: { $in: habitIds } }).select('name').lean();
          const nameById = new Map(habits.map(h => [String(h._id), h.name]));
          await MathReward.bulkWrite([...perUser].map(([userId, pts]) => ({
            updateOne: {
              filter: { userId },
              update: { $inc: { pointsEarned: pts }, $setOnInsert: { pointsSpent: 0 } },
              upsert: true,
            },
          })));
          await MathPointAdjustment.insertMany(
            credited.map(a => ({
              userId: a.userId, adminEmail: req.user.email, type: 'add',
              amount: a.points,
              reason: `Habit award: ${nameById.get(String(a.habitId)) || 'Unknown habit'} (${a.date})`,
            }))
          );
        } catch (creditErr) {
          // Crediting failed after the status flip — revert these awards to pending so they
          // aren't left approved-but-uncredited. Safe to retry the batch afterward.
          await HabitPointAward.updateMany(
            { _id: { $in: claimed.map(a => a._id) } },
            { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
          );
          throw creditErr;
        }
      }
    }

    // Solved-problem awards share the parent's queue, so the same id batch may include
    // them. Same guarded claim + credit + revert pattern, against the ProblemAward set.
    await ProblemAward.updateMany(
      { _id: { $in: validIds }, status: 'pending' },
      { $set: { status: 'approved', reviewedBy: req.user.email, reviewedAt: ts } }
    );
    const claimedP = await ProblemAward.find(
      { _id: { $in: validIds }, status: 'approved', reviewedBy: req.user.email, reviewedAt: ts }
    ).lean();
    if (claimedP.length > 0) {
      const perUserP = new Map();
      for (const a of claimedP) {
        if (a.points > 0) perUserP.set(String(a.userId), (perUserP.get(String(a.userId)) || 0) + a.points);
      }
      if (perUserP.size > 0) {
        try {
          const credited = claimedP.filter(a => a.points > 0);
          await MathReward.bulkWrite([...perUserP].map(([userId, pts]) => ({
            updateOne: {
              filter: { userId },
              update: { $inc: { pointsEarned: pts }, $setOnInsert: { pointsSpent: 0 } },
              upsert: true,
            },
          })));
          await MathPointAdjustment.insertMany(
            credited.map(a => ({
              userId: a.userId, adminEmail: req.user.email, type: 'add',
              amount: a.points, reason: `Problem solved: "${a.text}"`,
            }))
          );
        } catch (creditErr) {
          await ProblemAward.updateMany(
            { _id: { $in: claimedP.map(a => a._id) } },
            { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
          );
          throw creditErr;
        }
      }
    }

    const approvedIds = [...claimed.map(a => a._id), ...claimedP.map(a => a._id)];
    res.json({ approved: approvedIds.length, skipped: validIds.length - approvedIds.length, ids: approvedIds });
  } catch (err) { next(err); }
});

// ---- points ledger (per-day history) --------------------------------------

// Local 'YYYY-MM-DD' for a Date in the given IANA tz (en-CA renders ISO order).
function localDateOf(date, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

// Builds a newest-first, cursor-paginated timeline of everything that moved a kid's
// points: math-practice earnings (daily), habit approvals, admin add/deduct/reset,
// redeems, and declined habit awards. Merges three collections in app (no cross-collection
// DB sort exists) and pages by a timestamp cursor. Returns { events, nextCursor }.
async function buildLedger(userId, cursorIso, limit) {
  const user = await User.findById(userId).select('timezone').lean();
  const tz = user?.timezone || 'America/New_York';
  const upper = cursorIso ? new Date(cursorIso) : new Date(8640000000000000); // exclusive upper bound

  const [adjustments, declines, stats] = await Promise.all([
    MathPointAdjustment.find({ userId, createdAt: { $lt: upper } }).sort({ createdAt: -1 }).limit(limit).lean(),
    HabitPointAward.find({ userId, status: 'rejected', reviewedAt: { $ne: null, $lt: upper } }).sort({ reviewedAt: -1 }).limit(limit).lean(),
    // Stats carry no timestamp; we derive one from the local date (noon UTC) and filter in app.
    MathDailyStat.find({ userId, correct: { $gt: 0 } }).sort({ date: -1 }).limit(limit * 2).lean(),
  ]);

  const adjEvents = adjustments.map(a => {
    const isHabit = a.type === 'add' && /^Habit award/i.test(a.reason || '');
    const kind = a.type === 'add' ? (isHabit ? 'approve' : 'add') : a.type; // deduct|reset|redeem
    const positive = kind === 'approve' || kind === 'add';
    const labels = { approve: a.reason || 'Habit approved', add: a.reason || 'Bonus', deduct: a.reason || 'Deduction', reset: 'Reset', redeem: a.reason || a.rewardKey || 'Redeemed' };
    return {
      ts: a.createdAt, localDate: localDateOf(a.createdAt, tz), kind,
      delta: positive ? a.amount : -a.amount, label: labels[kind],
      meta: { adminEmail: a.adminEmail, rewardKey: a.rewardKey || null },
    };
  });

  const declineEvents = declines.map(d => ({
    ts: d.reviewedAt, localDate: localDateOf(d.reviewedAt, tz), kind: 'decline',
    delta: 0, label: `Declined habit award (${d.date})`,
    meta: { wouldBe: d.points, habitDate: d.date },
  }));

  const earnEvents = stats
    // points is the weighted earnings; legacy rows (pre-weighting) fall back to correct (1:1).
    .map(s => ({ ts: new Date(`${s.date}T12:00:00Z`), localDate: s.date, correct: s.correct, attempted: s.attempted, points: s.points ?? s.correct }))
    .filter(e => e.ts < upper)
    .slice(0, limit)
    .map(e => ({
      ts: e.ts, localDate: e.localDate, kind: 'earn',
      delta: e.points, label: 'Math practice',
      meta: { correct: e.correct, attempted: e.attempted, points: e.points },
    }));

  const merged = [...adjEvents, ...declineEvents, ...earnEvents].sort((a, b) => b.ts - a.ts);
  const events = merged.slice(0, limit);
  const more = merged.length > limit
    || adjustments.length === limit || declines.length === limit || earnEvents.length === limit;
  const nextCursor = (more && events.length) ? events[events.length - 1].ts.toISOString() : null;
  return { events, nextCursor };
}

// Shared parsing/validation for both ledger routes.
function parseLedgerQuery(req) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  let cursor = null;
  if (req.query.cursor) {
    const d = new Date(req.query.cursor);
    if (Number.isNaN(d.getTime())) return { error: 'invalid cursor' };
    cursor = d.toISOString();
  }
  return { limit, cursor };
}

// GET /api/math/ledger?cursor=&limit= — the signed-in kid's own points history.
router.get('/ledger', async (req, res, next) => {
  try {
    const q = parseLedgerQuery(req);
    if (q.error) return res.status(400).json({ error: q.error });
    res.json(await buildLedger(req.user._id, q.cursor, q.limit));
  } catch (err) { next(err); }
});

// GET /api/math/admin/ledger?userId=&cursor=&limit= — any kid's history (admin).
router.get('/admin/ledger', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.userId)) return res.status(400).json({ error: 'valid userId required' });
    const q = parseLedgerQuery(req);
    if (q.error) return res.status(400).json({ error: q.error });
    res.json(await buildLedger(req.query.userId, q.cursor, q.limit));
  } catch (err) { next(err); }
});

module.exports = router;
