const express = require('express');
const router = express.Router();

const RootMastery = require('../models/RootMastery');
const DecodeDailyStat = require('../models/DecodeDailyStat');
const MathReward = require('../models/MathReward');
const {
  ROOTS, getRoot, interactionFor, isDue, validateGeneratedWord,
  applyResult, dueDateAfter, NEW_ROOTS_PER_DAY, DAILY_ITEM_GOAL,
} = require('../utils/rootsEngine');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FREE_GEN_REQUIRED = 3;          // real words needed for a full free-generation pass
const MAX_GEN_WORDS = 6;              // bound Datamuse calls per submit
const QUEUE_LIMIT = 24;               // items handed to the client per /state
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

// ---- shared wallet (same MathReward pool the kid spends on TV/sleepover) -------------
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
async function creditWallet(userId, pts) {
  if (pts <= 0) return rewardSummary(await getReward(userId));
  const reward = await MathReward.findOneAndUpdate(
    { userId }, { $inc: { pointsEarned: pts } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return rewardSummary(reward);
}

// Roll up per-stage progress for the summary rings.
function summarize(masteryByRoot) {
  const s = { total: ROOTS.length, new: 0, learning: 0, decoding: 0, mastered: 0 };
  for (const root of ROOTS) {
    const m = masteryByRoot.get(root.id);
    if (!m || !m.exposed) s.new += 1;
    else if (m.stage === 'mastered') s.mastered += 1;
    else if (m.stage === 'decoding') s.decoding += 1;
    else s.learning += 1;
  }
  return s;
}

// GET /api/decode/state?date=YYYY-MM-DD — the due queue + counters + wallet + summary.
router.get('/state', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    const userId = req.user._id;

    const [rows, daily, reward] = await Promise.all([
      RootMastery.find({ userId }).lean(),
      DecodeDailyStat.findOne({ userId, date }).lean(),
      getReward(userId),
    ]);
    const byRoot = new Map(rows.map(m => [m.rootId, m]));
    const newToday = daily?.newRoots || 0;
    const newBudget = Math.max(0, NEW_ROOTS_PER_DAY - newToday);

    // Due, already-exposed roots not yet earned today (learning first, then decoding, then
    // mastered maintenance). lastCorrectDate === today hides a root for the rest of the day.
    const stageRank = { learning: 0, decoding: 1, mastered: 2 };
    const dueExposed = ROOTS
      .map(root => ({ root, m: byRoot.get(root.id) }))
      .filter(({ m }) => m && m.exposed && isDue(m, date) && m.lastCorrectDate !== date)
      .sort((a, b) => (stageRank[a.m.stage] ?? 0) - (stageRank[b.m.stage] ?? 0));

    // Brand-new roots (no mastery yet), capped by the per-day new-root budget.
    const fresh = ROOTS.filter(root => !byRoot.has(root.id)).slice(0, newBudget);

    const queue = [...dueExposed.map(({ root }) => root), ...fresh]
      .slice(0, QUEUE_LIMIT)
      .map(root => {
        const m = byRoot.get(root.id) || null;
        return { rootId: root.id, interaction: interactionFor(root, m), stage: m?.stage || 'new', decodedWords: m?.decodedWords || [] };
      });

    res.json({
      queue,
      today: { attempted: daily?.attempted || 0, correct: daily?.correct || 0, newRoots: newToday },
      cap: { newPerDay: NEW_ROOTS_PER_DAY, newLeft: newBudget, dailyGoal: DAILY_ITEM_GOAL },
      summary: summarize(byRoot),
      reward: rewardSummary(reward),
    });
  } catch (err) { next(err); }
});

// Grade one interaction. Server owns correctness (re-checks words via Datamuse, verifies
// the gloss/meaning, and enforces the novel-word gate for graduation). Body:
//   { rootId, interaction, date, firstTry, words?, choice?, word?, glossChoice? }
router.post('/answer', async (req, res, next) => {
  try {
    const b = req.body || {};
    const { rootId, interaction, date } = b;
    const firstTry = b.firstTry === true;
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    const root = getRoot(rootId);
    if (!root) return res.status(400).json({ error: 'unknown rootId' });
    const userId = req.user._id;

    const m = await RootMastery.findOne({ userId, rootId }).lean();
    const expected = interactionFor(root, m);
    if (interaction !== expected) return res.status(409).json({ error: `expected interaction '${expected}'`, expected });

    // ---- server-side grading per interaction type ----
    let correct = false;
    let wordUsed = null;
    let perWord = null;
    if (interaction === 'first_exposure') {
      correct = true; // guided scaffold — cannot fail (reveal fallback on the client)
    } else if (interaction === 'free_gen') {
      const words = Array.isArray(b.words) ? b.words.slice(0, MAX_GEN_WORDS) : [];
      perWord = [];
      for (const w of words) perWord.push({ word: w, ...(await validateGeneratedWord(root, w)) });
      correct = perWord.filter(p => p.valid).length >= FREE_GEN_REQUIRED;
    } else if (interaction === 'keyword_recall') {
      correct = norm(b.choice) === norm(root.meaning);
    } else if (interaction === 'decode_challenge') {
      wordUsed = norm(b.word);
      const dw = (root.decode_words || []).find(d => norm(d.word) === wordUsed);
      if (!dw) return res.status(400).json({ error: 'unknown decode word for this root' });
      correct = norm(b.glossChoice) === norm(dw.gloss);
    } else {
      return res.status(400).json({ error: 'unknown interaction' });
    }

    // ---- advance mastery ----
    const result = applyResult(m, { interaction, correct, firstTry, date, word: wordUsed });
    await RootMastery.updateOne(
      { userId, rootId },
      { $set: { rootId, ...result.patch } },
      { upsert: true },
    );

    // ready-roots-only graduation: a successful NOVEL decode also graduates any OTHER
    // taught root in that word that has already cleared learning (stage 'decoding').
    const graduatedRootIds = [];
    if (result.graduated) {
      graduatedRootIds.push(rootId);
      const dw = (root.decode_words || []).find(d => norm(d.word) === wordUsed);
      const others = (dw?.parts || []).map(p => p.id).filter(id => id && id !== rootId);
      for (const id of [...new Set(others)]) {
        const om = await RootMastery.findOne({ userId, rootId: id }).lean();
        if (om && om.stage === 'decoding') {
          await RootMastery.updateOne({ userId, rootId: id }, { $set: {
            stage: 'mastered', level: 1, streakCount: 0, lastCorrectDate: date,
            dueDate: dueDateAfter(date, 1),
            decodedWords: [...new Set([...(om.decodedWords || []), wordUsed])],
          } });
          graduatedRootIds.push(id);
        }
      }
    }

    // ---- daily stats + shared wallet ----
    const inc = { attempted: 1 };
    if (correct && firstTry) inc.correct = 1;
    if (result.points) inc.points = result.points;
    if (result.newRoot) inc.newRoots = 1;
    await DecodeDailyStat.findOneAndUpdate(
      { userId, date }, { $inc: inc },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const reward = await creditWallet(userId, result.points || 0);

    res.json({
      correct,
      awarded: result.points || 0,
      graduated: graduatedRootIds,          // roots that just reached mastery
      stage: result.patch.stage || m?.stage || 'learning',
      perWord,                              // free_gen: per-word validity for feedback
      reward,
    });
  } catch (err) { next(err); }
});

// GET /api/decode/progress?date=&weeks= — trailing daily stats for the streak + week chart.
router.get('/progress', async (req, res, next) => {
  try {
    const { date } = req.query;
    const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 8, 1), 26);
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    const userId = req.user._id;
    const since = dueDateAfter(date, 0); // today
    const start = new Date(Date.UTC(...date.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))));
    start.setUTCDate(start.getUTCDate() - weeks * 7);
    const startIso = start.toISOString().slice(0, 10);

    const rows = await DecodeDailyStat.find({ userId, date: { $gte: startIso, $lte: since } })
      .select('date attempted correct points').sort({ date: 1 }).lean();
    res.json({ days: rows.map(r => ({ date: r.date, attempted: r.attempted, correct: r.correct, points: r.points })) });
  } catch (err) { next(err); }
});

// GET /api/decode/export — the child's full decoding record (mastery rows + daily stats)
// as JSON, for download/backup. Does not include the shared wallet (that's the math side).
router.get('/export', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [roots, days] = await Promise.all([
      RootMastery.find({ userId }).select('-__v -userId').lean(),
      DecodeDailyStat.find({ userId }).select('date attempted correct points newRoots').sort({ date: 1 }).lean(),
    ]);
    res.json({ exportedAt: new Date().toISOString(), rootsTotal: ROOTS.length, mastery: roots, days });
  } catch (err) { next(err); }
});

// DELETE /api/decode/reset — wipe this child's decoding progress (mastery + daily stats)
// so they can start over. The shared points wallet is intentionally left untouched.
router.delete('/reset', async (req, res, next) => {
  try {
    const userId = req.user._id;
    await Promise.all([
      RootMastery.deleteMany({ userId }),
      DecodeDailyStat.deleteMany({ userId }),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
