import { useState, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const ACTIVE_POLL_MS = 30_000;

function getTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
  catch { return ''; }
}

async function tryParseError(err) {
  const msg = err?.message || '';
  try {
    const parsed = JSON.parse(msg);
    if (parsed?.error) return parsed.error;
  } catch { /* not JSON */ }
  return msg || 'Something went wrong';
}

export function useSleep() {
  const { user } = useAuth() || {};
  const userId   = user?._id;

  const [active,   setActive]   = useState(null);
  const [sessions, setSessions] = useState([]);
  const [nights,   setNights]   = useState([]); // [{nightDate, quality}]
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Holds the latest reload fn so the polling effect always sees fresh state.
  const reloadRef = useRef(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [act, sess, ngts] = await Promise.all([
        apiFetch('/api/sleep/sessions/active'),
        apiFetch('/api/sleep/sessions'),
        apiFetch('/api/sleep/nights'),
      ]);
      setActive(act);
      setSessions(sess);
      setNights(ngts);
    } catch (err) {
      setError(err);
      toast.error('Failed to load sleep data');
    } finally {
      setLoading(false);
    }
  }, [userId]);
  reloadRef.current = reload;

  const refreshActive = useCallback(async () => {
    if (!userId) return;
    try {
      const act = await apiFetch('/api/sleep/sessions/active');
      setActive(act);
    } catch { /* silent — non-critical */ }
  }, [userId]);

  // Initial load + poll active while page visible.
  useEffect(() => {
    if (!userId) return;
    reload();

    let id = null;
    const start = () => {
      if (id != null) return;
      id = setInterval(() => { refreshActive(); }, ACTIVE_POLL_MS);
    };
    const stop = () => {
      if (id == null) return;
      clearInterval(id);
      id = null;
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refreshActive();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [userId, reload, refreshActive]);

  const startSleep = useCallback(async () => {
    try {
      const s = await apiFetch('/api/sleep/sessions/start', {
        method: 'POST',
        body: JSON.stringify({ tz: getTz() }),
      });
      setActive(s);
      setSessions(prev => [...prev, s]);
      return s;
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, []);

  const stopSleep = useCallback(async () => {
    if (!active?._id) return null;
    try {
      const s = await apiFetch(`/api/sleep/sessions/${active._id}/stop`, {
        method: 'POST',
        body: JSON.stringify({ tz: getTz() }),
      });
      setActive(null);
      setSessions(prev => prev.map(x => x._id === s._id ? s : x));
      return s;
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, [active]);

  const addManual = useCallback(async ({ startAt, endAt }) => {
    try {
      const s = await apiFetch('/api/sleep/sessions', {
        method: 'POST',
        body: JSON.stringify({ startAt, endAt, tz: getTz() }),
      });
      setSessions(prev => [...prev, s]);
      return s;
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, []);

  const updateSession = useCallback(async (id, { startAt, endAt }) => {
    try {
      const body = { tz: getTz() };
      if (startAt !== undefined) body.startAt = startAt;
      if (endAt !== undefined)   body.endAt   = endAt;
      const s = await apiFetch(`/api/sleep/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setSessions(prev => prev.map(x => x._id === id ? s : x));
      if (active?._id === id) setActive(s.endAt ? null : s);
      return s;
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, [active]);

  const removeSession = useCallback(async (id) => {
    try {
      await apiFetch(`/api/sleep/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(x => x._id !== id));
      if (active?._id === id) setActive(null);
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, [active]);

  const setQuality = useCallback(async (nightDate, quality) => {
    try {
      const n = await apiFetch(`/api/sleep/nights/${nightDate}/quality`, {
        method: 'PUT',
        body: JSON.stringify({ quality }),
      });
      setNights(prev => {
        const idx = prev.findIndex(x => x.nightDate === nightDate);
        if (idx === -1) return [...prev, n];
        const next = prev.slice();
        next[idx] = n;
        return next;
      });
      return n;
    } catch (err) {
      toast.error(await tryParseError(err));
      throw err;
    }
  }, []);

  return {
    active, sessions, nights, loading, error,
    reload, refreshActive,
    startSleep, stopSleep, addManual,
    updateSession, removeSession, setQuality,
  };
}
