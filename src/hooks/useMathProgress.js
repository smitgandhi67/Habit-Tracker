import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { apiFetch } from '../lib/api';

// Trailing daily math stats ({ date, attempted, correct }) for the streak card and the
// week chart. Shared so both read the same fetch rather than hitting /progress twice.
export function useMathProgress(weeks = 8) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/math/progress?date=${today}&weeks=${weeks}`)
      .then(d => { if (!cancelled) setDays(d.days || []); })
      .catch(() => { if (!cancelled) setDays([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [today, weeks]);

  return { days, loading };
}
