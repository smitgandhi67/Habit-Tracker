const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');

// Keep the HabitPointAward for a (habit, date) in sync with the habit's completion state.
// Called after a habit log is written. Idempotent and re-derivable.
//
//   status 'done'  + habit.points > 0 → ensure a PENDING award exists (snapshot points).
//                                        A pending award refreshes its snapshot if points changed.
//                                        An already approved/rejected award is left untouched.
//   anything else (or points 0)        → delete a still-PENDING award (nothing to review).
//                                        Approved/rejected awards are final and left untouched.
async function syncHabitAward({ userId, habitId, date, status }) {
  const habit = await Habit.findOne({ _id: habitId, userId }).select('points').lean();
  if (!habit) return null;
  const points = habit.points || 0;
  const existing = await HabitPointAward.findOne({ habitId, date });

  if (status === 'done' && points > 0) {
    if (!existing) {
      try {
        return await HabitPointAward.create({ userId, habitId, date, points, status: 'pending' });
      } catch (err) {
        // Concurrent done-PUTs can race on the unique {habitId,date} index; the award
        // now exists, which is the desired end state — treat as success.
        if (err.code === 11000) return HabitPointAward.findOne({ habitId, date });
        throw err;
      }
    }
    if (existing.status === 'pending' && existing.points !== points) {
      existing.points = points;
      await existing.save();
    }
    return existing;
  }

  if (existing && existing.status === 'pending') {
    await HabitPointAward.deleteOne({ _id: existing._id });
  }
  return null;
}

module.exports = { syncHabitAward };
