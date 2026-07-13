import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// Drives the Word Decoder practice loop. Unlike the math hook (which grades optimistically
// client-side), decoding is SERVER-graded: free-generation realness (Datamuse) and the
// novel-word gate must be trusted, so every interaction posts to /answer and the server is
// authoritative for correctness, the wallet, and scheduling. The client walks each queue
// item's interaction UI, then submits once.
const introSeenKey = (uid) => `decode:introSeen:${uid}`;

export function useDecode() {
  const { user } = useAuth() || {};
  const uid = user?._id ? String(user._id) : 'anon';
  const today = format(new Date(), 'yyyy-MM-dd');

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [today_, setToday] = useState({ attempted: 0, correct: 0, newRoots: 0 });
  const [cap, setCap] = useState({ newPerDay: 2, newLeft: 2, dailyGoal: 12 });
  const [summary, setSummary] = useState({ total: 0, new: 0, learning: 0, decoding: 0, mastered: 0 });
  const [reward, setReward] = useState({ pointsEarned: 0, pointsSpent: 0, balance: 0 });
  const [session, setSession] = useState({ answered: 0, points: 0, graduated: 0 });
  const [introSeen, setIntroSeen] = useState(true);

  const attempted = useRef(new Set()); // rootIds attempted this session → drives firstTry

  const applyState = useCallback((data) => {
    setQueue(data.queue || []);
    setIdx(0);
    if (data.today) setToday(data.today);
    if (data.cap) setCap(data.cap);
    if (data.summary) setSummary(data.summary);
    if (data.reward) setReward(data.reward);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/decode/state?date=${today}`);
      applyState(data);
    } catch {
      toast.error('Failed to load Word Decoder');
    } finally {
      setLoading(false);
    }
  }, [today, applyState]);

  useEffect(() => {
    try { setIntroSeen(!!localStorage.getItem(introSeenKey(uid))); } catch { setIntroSeen(false); }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const markIntroSeen = useCallback(() => {
    try { localStorage.setItem(introSeenKey(uid), '1'); } catch { /* ignore */ }
    setIntroSeen(true);
  }, [uid]);

  // Submit one interaction result. `payload` carries the interaction-specific fields
  // (words / choice / word+glossChoice). Returns the server result for feedback UI.
  const submit = useCallback(async (item, payload) => {
    const firstTry = !attempted.current.has(item.rootId);
    attempted.current.add(item.rootId);
    try {
      const res = await apiFetch('/api/decode/answer', {
        method: 'POST',
        body: JSON.stringify({ rootId: item.rootId, interaction: item.interaction, date: today, firstTry, ...payload }),
      });
      if (res.reward) setReward(res.reward);
      setToday(t => ({ ...t, attempted: t.attempted + 1, correct: t.correct + (res.correct ? 1 : 0) }));
      setSession(s => ({ answered: s.answered + 1, points: s.points + (res.awarded || 0), graduated: s.graduated + (res.graduated?.length || 0) }));
      if (res.graduated?.length) {
        setSummary(sm => ({ ...sm, decoding: Math.max(0, sm.decoding - res.graduated.length), mastered: sm.mastered + res.graduated.length }));
      }
      return res;
    } catch (err) {
      toast.error(String(err.message || 'Could not submit').slice(0, 120));
      return null;
    }
  }, [today]);

  // Advance to the next queue item; refetch a fresh due queue when the batch is exhausted.
  const next = useCallback(async () => {
    if (idx + 1 < queue.length) { setIdx(idx + 1); return; }
    setLoading(true);
    await load();
  }, [idx, queue.length, load]);

  const current = queue[idx] || null;
  const caughtUp = !loading && queue.length === 0;

  return {
    loading, current, queue, idx,
    today: today_, cap, summary, reward, session,
    caughtUp, introSeen, markIntroSeen,
    submit, next, reload: load,
  };
}
