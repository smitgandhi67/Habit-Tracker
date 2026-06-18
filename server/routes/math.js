const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const MathDailyStat = require('../models/MathDailyStat');
const MathFactProgress = require('../models/MathFactProgress');
const MathReward = require('../models/MathReward');
const MathPointAdjustment = require('../models/MathPointAdjustment');
const MathRewardConfig = require('../models/MathRewardConfig');
const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');
const User = require('../models/User');
const { requireAdmin } = require('../utils/auth');
const {
  DEFAULT_REWARDS,
  canonicalKey,
  isValidOperand,
  isoWeekKey,
  balanceOf,
} = require('../utils/math');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RETIRE_AT = 2; // first-try-corrects on distinct days needed to retire a fact for the week
const OPS = ['mul', 'add', 'sub'];
const ADDSUB_MAX = 100; // server-side sanity bound for add/sub operands (client caps tighter by grade)

// Operand validity differs by operation: multiplication uses the 2..20 table universe
// (mastery keys assume it); add/sub allow non-negative integers up to a sane bound.
function validOperands(op, a, b) {
  if (op === 'mul') return isValidOperand(a) && isValidOperand(b);
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a <= ADDSUB_MAX && b <= ADDSUB_MAX;
}

function isCorrectAnswer(op, a, b, answer) {
  if (op === 'mul') return a * b === answer;
  if (op === 'add') return a + b === answer;
  return a - b === answer; // sub
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
    const weekKey = isoWeekKey(date);

    const [cfg, reward, daily, retired] = await Promise.all([
      getConfig(),
      getReward(userId),
      MathDailyStat.findOne({ userId, date }).lean(),
      MathFactProgress.find({ userId, weekKey, retiredAt: { $ne: null } }).distinct('factKey'),
    ]);

    const summary = rewardSummary(reward);
    res.json({
      weekKey,
      retiredFactKeys: retired,
      today: { attempted: daily?.attempted || 0, correct: daily?.correct || 0 },
      reward: summary,
      rewards: rewardsWithAffordability(cfg.rewards, summary.balance),
      sleepoverPct: sleepoverPct(summary.balance, cfg.rewards),
    });
  } catch (err) { next(err); }
});

// POST /api/math/answer — body { a, b, answer, firstTry, date, op? }
// op is 'mul' (default), 'add', or 'sub'. Server validates correctness itself; never
// trusts a client-supplied verdict. Weekly mastery applies to multiplication only.
router.post('/answer', async (req, res, next) => {
  try {
    const { a, b, answer, firstTry, date, op = 'mul' } = req.body || {};
    if (!OPS.includes(op)) return res.status(400).json({ error: 'op must be mul, add, or sub' });
    if (!validOperands(op, a, b)) return res.status(400).json({ error: 'invalid operands for operation' });
    if (!Number.isInteger(answer)) return res.status(400).json({ error: 'answer must be an integer' });
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

    const userId = req.user._id;
    const correct = isCorrectAnswer(op, a, b, answer);
    const earns = correct && firstTry === true; // only first-try-correct earns points (+ mastery for mul)
    const weekKey = isoWeekKey(date);

    // Daily counters: always attempted++, correct++ when it earns.
    await MathDailyStat.findOneAndUpdate(
      { userId, date },
      { $inc: { attempted: 1, correct: earns ? 1 : 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let summary;
    let retired = false;
    if (earns) {
      // +1 point for every first-try-correct (no dedup, no daily cap), any operation.
      const reward = await MathReward.findOneAndUpdate(
        { userId },
        { $inc: { pointsEarned: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      summary = rewardSummary(reward);

      // Weekly mastery — multiplication only, advances once per distinct day.
      if (op === 'mul') {
        const factKey = canonicalKey(a, b);
        const fp = await MathFactProgress.findOneAndUpdate(
          { userId, weekKey, factKey },
          { $setOnInsert: { correctCount: 0, lastCorrectDate: null, retiredAt: null } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (fp.lastCorrectDate !== date && !fp.retiredAt) {
          fp.correctCount += 1;
          fp.lastCorrectDate = date;
          if (fp.correctCount >= RETIRE_AT) fp.retiredAt = new Date();
          await fp.save();
        }
        retired = !!fp.retiredAt;
      }
    } else {
      summary = rewardSummary(await getReward(userId));
    }

    res.json({ correct, retired, factKey: op === 'mul' ? canonicalKey(a, b) : null, reward: summary });
  } catch (err) { next(err); }
});

// POST /api/math/answer/batch — body { answers: [{ a, b, answer, firstTry, date }] }
// Same grading as /answer but for a buffered batch (one Lambda call for N answers).
// Server still re-grades each (never trusts the client). Returns the authoritative
// wallet + the current week's retired facts so the client can reconcile.
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
      if (!OPS.includes(op) || !validOperands(op, it.a, it.b) || !Number.isInteger(it.answer) || !it.date || !ISO_DATE.test(it.date)) {
        return res.status(400).json({ error: 'each answer needs valid op, operands, integer answer, and date' });
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
      const weekKey = isoWeekKey(date);
      let attempted = 0, correct = 0;
      const earnedFacts = new Set(); // distinct multiplication facts earned → 1 mastery step each
      for (const it of items) {
        const op = it.op || 'mul';
        attempted += 1;
        if (isCorrectAnswer(op, it.a, it.b, it.answer) && it.firstTry === true) {
          correct += 1;
          if (op === 'mul') earnedFacts.add(canonicalKey(it.a, it.b));
        }
      }
      pointsInc += correct;

      await MathDailyStat.findOneAndUpdate(
        { userId, date },
        { $inc: { attempted, correct } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      for (const factKey of earnedFacts) {
        const fp = await MathFactProgress.findOneAndUpdate(
          { userId, weekKey, factKey },
          { $setOnInsert: { correctCount: 0, lastCorrectDate: null, retiredAt: null } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        if (fp.lastCorrectDate !== date && !fp.retiredAt) {
          fp.correctCount += 1;
          fp.lastCorrectDate = date;
          if (fp.correctCount >= RETIRE_AT) fp.retiredAt = new Date();
          await fp.save();
        }
      }
    }

    const reward = pointsInc > 0
      ? await MathReward.findOneAndUpdate({ userId }, { $inc: { pointsEarned: pointsInc } }, { upsert: true, new: true, setDefaultsOnInsert: true })
      : await getReward(userId);

    // Reconcile pool + today's counters against the most recent date in the batch.
    const latestDate = answers.map(a => a.date).sort().at(-1);
    const weekKey = isoWeekKey(latestDate);
    const [retiredFactKeys, daily] = await Promise.all([
      MathFactProgress.find({ userId, weekKey, retiredAt: { $ne: null } }).distinct('factKey'),
      MathDailyStat.findOne({ userId, date: latestDate }).lean(),
    ]);

    res.json({
      reward: rewardSummary(reward),
      retiredFactKeys,
      today: { attempted: daily?.attempted || 0, correct: daily?.correct || 0 },
    });
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

// PUT /api/math/admin/config — body { rewards: [{ key, label, costPoints, unit }] }
router.put('/admin/config', requireAdmin, async (req, res, next) => {
  try {
    const { rewards } = req.body || {};
    if (!Array.isArray(rewards) || rewards.length === 0) {
      return res.status(400).json({ error: 'rewards must be a non-empty array' });
    }
    for (const r of rewards) {
      if (!r.key || !r.label) return res.status(400).json({ error: 'each reward needs key and label' });
      if (!Number.isInteger(r.costPoints) || r.costPoints < 1) {
        return res.status(400).json({ error: `costPoints for ${r.key} must be a positive integer` });
      }
    }
    const clean = rewards.map(r => ({
      key: r.key, label: r.label, costPoints: r.costPoints, unit: r.unit === 'minute' ? 'minute' : 'event',
    }));
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

// GET /api/math/admin/habit-awards?status=pending — awards to review, enriched with
// kid + habit names. Defaults to pending; accepts pending|approved|rejected.
router.get('/admin/habit-awards', requireAdmin, async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const awards = await HabitPointAward.find({ status }).sort({ date: -1, createdAt: -1 }).limit(500).lean();
    const userIds = [...new Set(awards.map(a => String(a.userId)))];
    const habitIds = [...new Set(awards.map(a => String(a.habitId)))];
    const [users, habits] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('name email').lean(),
      Habit.find({ _id: { $in: habitIds } }).select('name emoji').lean(),
    ]);
    const userMap = new Map(users.map(u => [String(u._id), u]));
    const habitMap = new Map(habits.map(h => [String(h._id), h]));
    res.json(awards.map(a => ({
      _id: a._id,
      userId: a.userId,
      userName: userMap.get(String(a.userId))?.name || '—',
      habitId: a.habitId,
      habitName: habitMap.get(String(a.habitId))?.name || '—',
      habitEmoji: habitMap.get(String(a.habitId))?.emoji || '',
      date: a.date,
      points: a.points,
      status: a.status,
    })));
  } catch (err) { next(err); }
});

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
      // Didn't transition: missing, or already approved/rejected. Distinguish for the client.
      const existing = await HabitPointAward.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ error: 'Award not found' });
      if (existing.status === 'approved') return res.json({ award: existing }); // idempotent, no double credit
      return res.status(409).json({ error: `Cannot approve a ${existing.status} award` });
    }

    if (award.points > 0) {
      try {
        await MathReward.findOneAndUpdate(
          { userId: award.userId },
          { $inc: { pointsEarned: award.points } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        await MathPointAdjustment.create({
          userId: award.userId, adminEmail: req.user.email, type: 'add',
          amount: award.points, reason: `Habit award ${award.date}`,
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
    const award = await HabitPointAward.findById(req.params.id);
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

    if (claimed.length === 0) {
      return res.json({ approved: 0, skipped: validIds.length, ids: [] });
    }

    // Sum points per kid → one $inc per distinct kid (bulk), one audit row per credited award.
    const perUser = new Map();
    for (const a of claimed) {
      if (a.points > 0) perUser.set(String(a.userId), (perUser.get(String(a.userId)) || 0) + a.points);
    }
    if (perUser.size > 0) {
      try {
        await MathReward.bulkWrite([...perUser].map(([userId, pts]) => ({
          updateOne: {
            filter: { userId },
            update: { $inc: { pointsEarned: pts }, $setOnInsert: { pointsSpent: 0 } },
            upsert: true,
          },
        })));
        await MathPointAdjustment.insertMany(
          claimed.filter(a => a.points > 0).map(a => ({
            userId: a.userId, adminEmail: req.user.email, type: 'add',
            amount: a.points, reason: `Habit award ${a.date}`,
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

    res.json({ approved: claimed.length, skipped: validIds.length - claimed.length, ids: claimed.map(a => a._id) });
  } catch (err) { next(err); }
});

module.exports = router;
