import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { pickQuestion, pickArithmetic, factCountForMax } from '../lib/mathFacts';
import { mulMaxForGrade, addSubMaxForGrade } from '../lib/mathGrades';
import { pointsForOp } from '../lib/mathRewards';

const FLUSH_AT = 8; // buffered answers before an automatic background flush

// localStorage helpers (namespaced per user so a shared device can't leak data).
const stateKey = (uid, date) => `math:state:${uid}:${date}`;
const bufferKey = (uid) => `math:buffer:${uid}`;
function readLS(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / private mode */ }
}
function clearLS(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

// Drives the multiplication practice page. Questions are generated client-side
// (no API per question); answers are graded optimistically and flushed in batches.
export function useMath() {
  const { user } = useAuth() || {};
  const uid = user?._id ? String(user._id) : 'anon';
  const today = format(new Date(), 'yyyy-MM-dd');
  const mulMax = mulMaxForGrade(user?.grade);       // grade-based multiplication cap
  const addSubMax = addSubMaxForGrade(user?.grade); // grade-based add/sub cap

  const [loading, setLoading] = useState(true);
  const [retired, setRetired] = useState(() => new Set());
  const [todayCounts, setTodayCounts] = useState({ attempted: 0, correct: 0 });
  const [reward, setReward] = useState({ pointsEarned: 0, pointsSpent: 0, balance: 0 });
  const [rewards, setRewards] = useState([]);
  const [sleepover, setSleepover] = useState(0);

  const [question, setQuestion] = useState(null);
  const [session, setSession] = useState({ attempted: 0, correct: 0, points: 0 });
  const [op, setOp] = useState('mul'); // 'mul' | 'add' | 'sub'

  const lastKey = useRef(null);
  const retiredRef = useRef(retired);   // freshest retired set for question picking
  const buffer = useRef([]);            // unflushed answers
  const flushing = useRef(false);

  const nextQuestion = useCallback((retiredSet) => {
    const q = op === 'mul'
      ? pickQuestion(retiredSet, lastKey.current, mulMax)
      : pickArithmetic(op, addSubMax, lastKey.current);
    lastKey.current = q?.key ?? null;
    setQuestion(q);
  }, [op, mulMax, addSubMax]);

  // Re-pick when the operation or grade cap changes (kid switches op/grade).
  useEffect(() => { nextQuestion(retiredRef.current); }, [nextQuestion]);

  // Apply a /state (or batch) payload to local state + cache it.
  const applyState = useCallback((data, { cache = true, pickNext = false } = {}) => {
    const retiredSet = new Set(data.retiredFactKeys || []);
    retiredRef.current = retiredSet;
    setRetired(retiredSet);
    if (data.today) setTodayCounts(data.today);
    if (data.reward) setReward(data.reward);
    if (data.rewards) setRewards(data.rewards);
    if (typeof data.sleepoverPct === 'number') setSleepover(data.sleepoverPct);
    if (pickNext) nextQuestion(retiredSet);
    if (cache) writeLS(stateKey(uid, today), data);
  }, [uid, today, nextQuestion]);

  // Send buffered answers in one request and reconcile with the authoritative wallet.
  const flush = useCallback(async () => {
    if (flushing.current || buffer.current.length === 0) return;
    flushing.current = true;
    const batch = buffer.current;
    buffer.current = [];
    try {
      const res = await apiFetch('/api/math/answer/batch', {
        method: 'POST',
        body: JSON.stringify({ answers: batch }),
      });
      // Server is the source of truth — replace optimistic wallet + pool.
      setReward(res.reward);
      setTodayCounts(res.today);
      const retiredSet = new Set(res.retiredFactKeys || []);
      retiredRef.current = retiredSet;
      setRetired(retiredSet);
      clearLS(bufferKey(uid));
      // Keep the cached state roughly fresh for instant next paint.
      const cached = readLS(stateKey(uid, today));
      if (cached) writeLS(stateKey(uid, today), { ...cached, reward: res.reward, today: res.today, retiredFactKeys: res.retiredFactKeys });
    } catch {
      // Re-queue so nothing is lost; will retry on next flush / reload.
      buffer.current = batch.concat(buffer.current);
      writeLS(bufferKey(uid), buffer.current);
    } finally {
      flushing.current = false;
    }
  }, [uid, today]);

  // Mount: instant paint from cache, recover any unflushed buffer, then revalidate.
  useEffect(() => {
    let cancelled = false;
    const cached = readLS(stateKey(uid, today));
    const pending = readLS(bufferKey(uid));
    if (pending && Array.isArray(pending)) buffer.current = pending;

    Promise.resolve().then(async () => {
      if (cancelled) return;
      if (cached) { applyState(cached, { cache: false, pickNext: true }); setLoading(false); }
      if (buffer.current.length) await flush();
      try {
        const data = await apiFetch(`/api/math/state?date=${today}`);
        if (!cancelled) applyState(data, { pickNext: !cached });
      } catch {
        if (!cancelled && !cached) toast.error('Failed to load math practice');
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [uid, today, applyState, flush]);

  // Flush on tab hide / unmount so points are never stranded in the buffer.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, [flush]);

  // Grade locally (the answer is known client-side) → instant feedback, no await.
  // Returns { correct } synchronously; the server re-grades on the next flush.
  const submitAnswer = useCallback((value, firstTry) => {
    if (!question) return { correct: false };
    const answer = Number(value);
    const correct = answer === question.answer;
    const earns = correct && firstTry === true;
    const pts = earns ? pointsForOp(question.op) : 0; // weighted (sub = 3, else = 1)

    buffer.current.push({ a: question.a, b: question.b, answer, firstTry: !!firstTry, date: today, op: question.op });
    writeLS(bufferKey(uid), buffer.current);

    setSession(s => ({
      attempted: s.attempted + 1,
      correct: s.correct + (earns ? 1 : 0),
      points: s.points + pts,
    }));
    setTodayCounts(t => ({ attempted: t.attempted + 1, correct: t.correct + (earns ? 1 : 0) }));
    if (earns) {
      setReward(r => ({ ...r, pointsEarned: r.pointsEarned + pts, balance: r.balance + pts }));
    }

    if (buffer.current.length >= FLUSH_AT) flush();
    return { correct };
  }, [question, today, uid, flush]);

  // Advance to the next question using the freshest retired set.
  const advance = useCallback(() => { nextQuestion(retiredRef.current); }, [nextQuestion]);

  const redeem = useCallback(async (rewardKey, qty = 1) => {
    await flush(); // ensure the server has all earned points before spending
    try {
      const res = await apiFetch('/api/math/redeem', {
        method: 'POST',
        body: JSON.stringify({ rewardKey, qty }),
      });
      setReward(res.reward);
      const data = await apiFetch(`/api/math/state?date=${today}`);
      applyState(data);
      toast.success('Redeemed!');
      return true;
    } catch (err) {
      toast.error(String(err.message || 'Redeem failed').slice(0, 120));
      return false;
    }
  }, [flush, today, applyState]);

  return {
    loading,
    question,
    today: todayCounts,
    session,
    reward,
    rewards,
    sleepoverPct: sleepover,
    retiredCount: retired.size,
    totalFacts: factCountForMax(mulMax),
    op,
    setOp,
    submitAnswer,
    advance,
    redeem,
    flush,
  };
}
