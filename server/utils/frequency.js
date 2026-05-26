// Canonical Habit.frequency shapes:
//   'daily'                                            → every day
//   ['Mon','Wed','Sat']                                → specific weekdays (1-7 unique)
//   { type: 'weekly',   times: N }                     → N times per ISO week (Mon-Sun), 1-7
//   { type: 'biweekly', times: N, anchor: 'YYYY-MM-DD' } → N times per 14-day cycle from anchor, 1-14
//   { type: 'monthly',  times: N }                     → N times per calendar month, 1-31
//
// Period-completion semantics (client-side, see src/hooks/useHabits.js completionsInPeriod):
//   done      contributes 1.0
//   half_done contributes 0.5
//   target hit when total >= times (so two half_dones = one done)
// Server stores raw status only; the weighting rule lives client-side because it
// affects derived UI (visibility / streak), not stored state.

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PERIOD_MAX_TIMES = { weekly: 7, biweekly: 14, monthly: 31 };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Returns null if valid, or a string error message.
function validateFrequency(freq) {
  if (freq === 'daily') return null;

  if (Array.isArray(freq)) {
    if (freq.length < 1 || freq.length > 7) {
      return 'frequency array must have 1-7 days';
    }
    const seen = new Set();
    for (const d of freq) {
      if (typeof d !== 'string' || !DAYS.includes(d)) {
        return `frequency contains invalid day "${d}" (expected one of ${DAYS.join(',')})`;
      }
      if (seen.has(d)) return `frequency contains duplicate day "${d}"`;
      seen.add(d);
    }
    return null;
  }

  if (isPlainObject(freq)) {
    const { type, times, anchor } = freq;
    if (!(type in PERIOD_MAX_TIMES)) {
      return `frequency.type "${type}" invalid (expected weekly|biweekly|monthly)`;
    }
    if (!Number.isInteger(times) || times < 1 || times > PERIOD_MAX_TIMES[type]) {
      return `frequency.times must be integer between 1 and ${PERIOD_MAX_TIMES[type]} for ${type}`;
    }
    if (type === 'biweekly') {
      if (typeof anchor !== 'string' || !ISO_DATE.test(anchor)) {
        return 'biweekly frequency requires anchor in YYYY-MM-DD format';
      }
      const parsed = new Date(`${anchor}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return 'biweekly anchor is not a valid date';
    }
    return null;
  }

  return 'frequency must be "daily", array of weekday names, or {type,times[,anchor]}';
}

// Strip any unknown keys from frequency object form (defense-in-depth).
function sanitizeFrequency(freq) {
  if (freq === 'daily') return 'daily';
  if (Array.isArray(freq)) return [...freq];
  if (isPlainObject(freq)) {
    const out = { type: freq.type, times: freq.times };
    if (freq.type === 'biweekly') out.anchor = freq.anchor;
    return out;
  }
  return freq;
}

module.exports = {
  DAYS,
  PERIOD_MAX_TIMES,
  validateFrequency,
  sanitizeFrequency,
};
