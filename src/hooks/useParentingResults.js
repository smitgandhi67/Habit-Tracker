import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

// Loads the signed-in user's attempt history for an instrument (or all if
// instrumentKey is falsy), newest first, with cursor-based "load more".
export function useParentingResults(instrumentKey) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = useCallback((cursor) => {
    const params = new URLSearchParams();
    if (instrumentKey) params.set('instrumentKey', instrumentKey);
    if (cursor) params.set('cursor', cursor);
    return `/api/parenting/attempts?${params.toString()}`;
  }, [instrumentKey]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch(query(null))
      .then(res => { if (!cancelled) { setItems(res.items); setNextCursor(res.nextCursor); } })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  useEffect(() => load(), [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const res = await apiFetch(query(nextCursor));
    setItems(prev => [...prev, ...res.items]);
    setNextCursor(res.nextCursor);
  }, [nextCursor, query]);

  return { items, hasMore: !!nextCursor, loadMore, loading, error, reload: load };
}
