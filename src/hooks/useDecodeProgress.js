import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';

// Trailing daily Word Decoder stats ({ date, attempted, correct, points }) for the streak
// flame + week chart. Mirrors useMathProgress. `refreshKey` lets the page force a refetch
// after answers land so the streak/points update without a reload.
export function useDecodeProgress(weeks = 8, refreshKey = 0) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/decode/progress?date=${today}&weeks=${weeks}`)
      .then(d => { if (!cancelled) setDays(d.days || []); })
      .catch(() => { if (!cancelled) setDays([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [today, weeks, refreshKey]);

  return { days, loading };
}

// Consecutive days (ending today) with at least one attempt. Today not yet practiced does
// not break a streak built through yesterday — it just hasn't extended it yet.
export function streakFrom(days, today) {
  const byDate = new Map(days.map(d => [d.date, d]));
  let streak = 0;
  const cur = new Date(today + 'T00:00:00');
  // if today has activity, count it; otherwise start the walk at yesterday
  if (!(byDate.get(today)?.attempted > 0)) cur.setDate(cur.getDate() - 1);
  for (;;) {
    const key = format(cur, 'yyyy-MM-dd');
    if (byDate.get(key)?.attempted > 0) { streak += 1; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  return streak;
}
