import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

async function tryParseError(err) {
  const msg = err?.message || '';
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error) return parsed.error;
  } catch { /* not JSON */ }
  return msg || 'Something went wrong';
}

export function useBody() {
  const { user } = useAuth() || {};
  const userId   = user?._id;

  const [measurements, setMeasurements] = useState([]); // sorted asc by date
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await apiFetch('/api/body/measurements');
      setMeasurements(rows);
    } catch (err) {
      setError(err);
      toast.error('Failed to load measurements');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    queueMicrotask(() => { reload(); });
  }, [userId, reload]);

  // Upsert any subset of metrics for a date. Pass null to clear a metric.
  const save = useCallback(async (date, fields) => {
    try {
      const doc = await apiFetch(`/api/body/measurements/${date}`, {
        method: 'PUT',
        body: JSON.stringify(fields),
      });
      setMeasurements(prev => {
        const idx = prev.findIndex(m => m.date === date);
        const next = idx === -1 ? [...prev, doc] : prev.map(m => m.date === date ? doc : m);
        return next.sort((a, b) => a.date.localeCompare(b.date));
      });
      return doc;
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, []);

  const remove = useCallback(async (date) => {
    try {
      await apiFetch(`/api/body/measurements/${date}`, { method: 'DELETE' });
      setMeasurements(prev => prev.filter(m => m.date !== date));
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, []);

  return { measurements, loading, error, reload, save, remove };
}
