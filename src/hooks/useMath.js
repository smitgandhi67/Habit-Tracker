import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { pickQuestion } from '../lib/mathFacts';

// Drives the multiplication practice page: loads server state (pool + wallet),
// serves random questions, submits answers, and tracks this-session counters.
export function useMath() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [loading, setLoading] = useState(true);
  const [retired, setRetired] = useState(() => new Set());
  const [today_, setToday] = useState({ attempted: 0, correct: 0 });
  const [reward, setReward] = useState({ pointsEarned: 0, pointsSpent: 0, balance: 0 });
  const [rewards, setRewards] = useState([]);
  const [sleepover, setSleepover] = useState(0);

  const [question, setQuestion] = useState(null);
  const [session, setSession] = useState({ attempted: 0, correct: 0, points: 0 });
  const lastKey = useRef(null);

  const nextQuestion = useCallback((retiredSet) => {
    const q = pickQuestion(retiredSet, lastKey.current);
    lastKey.current = q?.key ?? null;
    setQuestion(q);
  }, []);

  // Apply a /state payload to local state (setState lives inside async callbacks).
  const applyState = useCallback((data) => {
    const retiredSet = new Set(data.retiredFactKeys || []);
    setRetired(retiredSet);
    setToday(data.today);
    setReward(data.reward);
    setRewards(data.rewards);
    setSleepover(data.sleepoverPct);
    nextQuestion(retiredSet);
  }, [nextQuestion]);

  // Refetch state — used after a redeem (called from an event handler, not an effect).
  const reload = useCallback(
    () => apiFetch(`/api/math/state?date=${today}`).then(applyState),
    [today, applyState]
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/math/state?date=${today}`)
      .then(data => { if (!cancelled) applyState(data); })
      .catch(() => toast.error('Failed to load math practice'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [today, applyState]);

  // Submit a typed (or hint-corrected) answer. `firstTry` gates points + mastery.
  // Returns { correct, retired } so the UI can drive the hint flow.
  const submitAnswer = useCallback(async (value, firstTry) => {
    if (!question) return { correct: false, retired: false };
    const answer = Number(value);
    try {
      const res = await apiFetch('/api/math/answer', {
        method: 'POST',
        body: JSON.stringify({ a: question.a, b: question.b, answer, firstTry, date: today }),
      });
      // Update wallet + daily counters from the server's authoritative response.
      setReward(res.reward);
      setSession(s => ({
        attempted: s.attempted + 1,
        correct: s.correct + (res.correct && firstTry ? 1 : 0),
        points: res.reward.pointsEarned - reward.pointsEarned + s.points,
      }));
      setToday(t => ({
        attempted: t.attempted + 1,
        correct: t.correct + (res.correct && firstTry ? 1 : 0),
      }));
      if (res.retired) {
        setRetired(prev => {
          const next = new Set(prev);
          next.add(res.factKey);
          return next;
        });
      }
      return { correct: res.correct, retired: res.retired };
    } catch {
      toast.error('Could not save answer');
      return { correct: false, retired: false };
    }
  }, [question, today, reward.pointsEarned]);

  // Advance to the next question (uses the freshest retired set).
  const advance = useCallback(() => {
    setRetired(prev => { nextQuestion(prev); return prev; });
  }, [nextQuestion]);

  const redeem = useCallback(async (rewardKey, qty = 1) => {
    try {
      const res = await apiFetch('/api/math/redeem', {
        method: 'POST',
        body: JSON.stringify({ rewardKey, qty }),
      });
      setReward(res.reward);
      // Recompute affordable quantities + sleepover from the new balance.
      await reload();
      toast.success('Redeemed!');
      return true;
    } catch (err) {
      toast.error(String(err.message || 'Redeem failed').slice(0, 120));
      return false;
    }
  }, [reload]);

  return {
    loading,
    question,
    today: today_,
    session,
    reward,
    rewards,
    sleepoverPct: sleepover,
    retiredCount: retired.size,
    submitAnswer,
    advance,
    redeem,
  };
}
