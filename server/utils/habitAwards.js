const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');
const { maybeAutoApprove, revertAutoApproval } = require('./autoApprove');

// Keep the HabitPointAward for a (habit, date) in sync with the habit's completion state.
// Called after a habit log is written. Idempotent and re-derivable.
//
//   status 'done'  + habit.points > 0 → ensure a PENDING award exists (snapshot points).
//                                        A pending award refreshes its snapshot if points changed.
//                                        An already approved/rejected award is left untouched.
//                                        Then: if every sibling who shares this habit has also
//                                        completed it today, auto-approve the whole set.
//   anything else (or points 0)        → delete a still-PENDING award (nothing to review), and
//                                        claw back an AUTO-approved one (see utils/autoApprove).
//                                        Parent-approved/rejected awards are final and untouched.
async function syncHabitAward({ userId, habitId, date, status }) {
  const habit = await Habit.findOne({ _id: habitId, userId })
    .select('name points autoApproveWhenAll').lean();
  if (!habit) return null;
  const points = habit.points || 0;
  const existing = await HabitPointAward.findOne({ habitId, date });

  if (status === 'done' && points > 0) {
    let award = existing;
    if (!award) {
      try {
        award = await HabitPointAward.create({ userId, habitId, date, points, status: 'pending' });
      } catch (err) {
        // Concurrent done-PUTs can race on the unique {habitId,date} index; the award
        // now exists, which is the desired end state — treat as success.
        if (err.code !== 11000) throw err;
        award = await HabitPointAward.findOne({ habitId, date });
      }
    } else if (award.status === 'pending' && award.points !== points) {
      award.points = points;
      await award.save();
    }

    // Best-effort, like the award sync itself: auto-approval is re-derivable from the awards,
    // so a failure here must leave the (already correct) pending award standing rather than
    // bubble up and abort the caller's write. The returned award may be a stale pending
    // snapshot when this fires — callers only test it for existence.
    try {
      await maybeAutoApprove({ habit: { ...habit, _id: habitId, userId }, date });
    } catch (autoErr) {
      console.error('maybeAutoApprove failed:', autoErr.message);
    }
    return award;
  }

  if (existing && existing.status === 'approved' && existing.autoApproved) {
    // Auto-approved then un-done: nobody reviewed this, so the points go back.
    try {
      await revertAutoApproval({ habitId, date, habitName: habit.name });
    } catch (revertErr) {
      console.error('revertAutoApproval failed:', revertErr.message);
    }
    return null;
  }

  if (existing && existing.status === 'pending') {
    await HabitPointAward.deleteOne({ _id: existing._id });
  }
  return null;
}

module.exports = { syncHabitAward };
