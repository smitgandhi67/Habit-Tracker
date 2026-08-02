// Shared-habit auto-approval.
//
// Some habits are done by every kid in a family ("brush teeth", "read 20 min"). When ALL of
// them have completed such a habit for a day, there is nothing for the parent to adjudicate —
// the kids have already checked each other. This module approves that set automatically and
// credits the points, so the approval queue only ever holds the interesting cases (the days
// where one kid did it and the other didn't).
//
// A habit is "shared" purely by structure — 2+ approved-linked siblings each own a
// points-bearing habit with the same name. There is no pairing UI; `Habit.autoApproveWhenAll`
// (default true) is the per-habit off switch.
//
// Everything here mirrors the guards in the manual approve routes (routes/math.js): an atomic
// status claim so concurrent callers can never double-credit, and a revert if crediting fails
// so an award is never left approved-but-uncredited.
const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');
const AccountLink = require('../models/AccountLink');
const MathReward = require('../models/MathReward');
const MathPointAdjustment = require('../models/MathPointAdjustment');

// Stamped as `reviewedBy` / `adminEmail` so auto-approvals are distinguishable from a
// parent's in the award row and in the points ledger. Not a real address by design.
const AUTO_REVIEWER = 'auto-approve';

// Habits pair across kids by name. Whitespace and case differences are noise here — one
// parent typing "Brush Teeth" and "brush teeth" still means the same habit.
const nameKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Every copy of `habit` across the kids who share a parent with its owner — including the
// habit itself. Returns [] when the owner has no approved parent link, when they have no
// siblings, or when no sibling owns a matching habit (i.e. it isn't a shared habit).
async function siblingHabitsFor(habit) {
  const parentLinks = await AccountLink.find({ childId: habit.userId, status: 'approved' })
    .select('parentId').lean();
  if (parentLinks.length === 0) return [];
  const parentIds = [...new Set(parentLinks.map(l => String(l.parentId)))];

  const kidLinks = await AccountLink.find({ parentId: { $in: parentIds }, status: 'approved' })
    .select('childId').lean();
  const kidIds = [...new Set(kidLinks.map(l => String(l.childId)))];
  if (kidIds.length < 2) return [];   // only child — nothing to compare against

  const key = nameKey(habit.name);
  const candidates = await Habit.find({ userId: { $in: kidIds }, archivedAt: null, points: { $gt: 0 } })
    .select('userId name points autoApproveWhenAll').lean();
  return candidates.filter(h => nameKey(h.name) === key);
}

// Flip `ids` pending→approved and credit the pools. Uses the approve-batch trick: a guarded
// updateMany, then a re-read on a unique reviewedAt stamp, so we credit exactly the rows THIS
// call transitioned even if another request is approving the same set concurrently.
async function creditAwards(ids, habitName) {
  const ts = new Date();
  await HabitPointAward.updateMany(
    { _id: { $in: ids }, status: 'pending' },
    { $set: { status: 'approved', autoApproved: true, reviewedBy: AUTO_REVIEWER, reviewedAt: ts } }
  );
  const claimed = await HabitPointAward.find({
    _id: { $in: ids }, status: 'approved', reviewedBy: AUTO_REVIEWER, reviewedAt: ts,
  }).lean();
  if (claimed.length === 0) return [];

  const credited = claimed.filter(a => a.points > 0);
  if (credited.length === 0) return claimed;

  try {
    const perUser = new Map();
    for (const a of credited) perUser.set(String(a.userId), (perUser.get(String(a.userId)) || 0) + a.points);
    await MathReward.bulkWrite([...perUser].map(([userId, pts]) => ({
      updateOne: {
        filter: { userId },
        update: { $inc: { pointsEarned: pts }, $setOnInsert: { pointsSpent: 0 } },
        upsert: true,
      },
    })));
    await MathPointAdjustment.insertMany(credited.map(a => ({
      userId: a.userId, adminEmail: AUTO_REVIEWER, type: 'add', amount: a.points,
      reason: `Auto-approved (all kids done): ${habitName} (${a.date})`,
    })));
  } catch (creditErr) {
    // Never leave an award approved-but-uncredited. Back to pending; the parent sees it in
    // the queue and the next completion re-attempts the auto-approval.
    await HabitPointAward.updateMany(
      { _id: { $in: claimed.map(a => a._id) } },
      { $set: { status: 'pending', autoApproved: false, reviewedBy: null, reviewedAt: null } }
    );
    throw creditErr;
  }
  return claimed;
}

// Called after a kid's award is created for (habit, date). Approves the whole sibling set if
// this completion was the last one outstanding. Returns the awards it approved ([] if not).
//
// `habit` must carry _id, userId, name, points and autoApproveWhenAll.
async function maybeAutoApprove({ habit, date }) {
  if (!habit || habit.autoApproveWhenAll === false || !(habit.points > 0)) return [];

  const siblings = await siblingHabitsFor(habit);
  // Shared only if 2+ DIFFERENT kids own a copy — a habit only one kid has is never auto-approved.
  const owners = new Set(siblings.map(h => String(h.userId)));
  if (owners.size < 2) return [];
  // The whole set must opt in; switching the flag off on one kid's copy disables the pair.
  if (siblings.some(h => h.autoApproveWhenAll === false)) return [];

  const awards = await HabitPointAward.find({ habitId: { $in: siblings.map(h => h._id) }, date }).lean();
  const byHabit = new Map(awards.map(a => [String(a.habitId), a]));
  for (const h of siblings) {
    const a = byHabit.get(String(h._id));
    // A missing award means that kid hasn't completed it; a rejected one is the parent's
    // explicit "no" and must not be revived by a sibling's completion.
    if (!a || a.status === 'rejected') return [];
  }

  const pendingIds = awards.filter(a => a.status === 'pending').map(a => a._id);
  if (pendingIds.length === 0) return [];   // already approved (late re-run) — nothing to do
  return creditAwards(pendingIds, habit.name);
}

// Called when a habit stops being 'done' for a day. Undoes an auto-approval: deletes the award,
// deducts the points and writes a ledger row. A parent-approved award is left alone (approved
// by a human stays final) — the filter below only matches autoApproved rows.
//
// findOneAndDelete is the atomic claim: concurrent un-checks, only one gets the doc back, so
// the deduction happens exactly once.
async function revertAutoApproval({ habitId, date, habitName }) {
  const award = await HabitPointAward.findOneAndDelete({
    habitId, date, status: 'approved', autoApproved: true,
  });
  if (!award) return null;

  if (award.points > 0) {
    try {
      await MathReward.updateOne({ userId: award.userId }, { $inc: { pointsEarned: -award.points } });
      await MathPointAdjustment.create({
        userId: award.userId, adminEmail: AUTO_REVIEWER, type: 'deduct', amount: award.points,
        reason: `Un-done after auto-approval: ${habitName} (${date})`,
      });
    } catch (debitErr) {
      // Put the row back so the award and the credited points stay consistent; safe to retry.
      const doc = typeof award.toObject === 'function' ? award.toObject() : award;
      await HabitPointAward.create(doc);
      throw debitErr;
    }
  }
  return award;
}

module.exports = { AUTO_REVIEWER, nameKey, siblingHabitsFor, maybeAutoApprove, revertAutoApproval };
