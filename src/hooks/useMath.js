import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { pickDueQuestion, generateFacts } from '../lib/mathFacts';
import { pointsForOp } from '../lib/mathRewards';
import { effectivePoints } from '../lib/mathBonus';
import { OP_KEYS, getType, parseTypedAnswer, gradeAnswer } from '../lib/questionTypes';

const FLUSH_AT = 1; // flush after every answer so points hit the DB immediately (never stranded in the buffer)
const EMPTY_SUPPRESSED = Object.fromEntries(OP_KEYS.map(k => [k, []]));
const EMPTY_LEVELS = Object.fromEntries(OP_KEYS.map(k => [k, {}]));
const emptyAnsweredSets = () => Object.fromEntries(OP_KEYS.map(k => [k, new Set()]));

// localStorage helpers (namespaced per user so a shared device can't leak data).
const stateKey = (uid, date) => `math:state:${uid}:${date}`;
const bufferKey = (uid) => `math:buffer:${uid}`;
const answeredKey = (uid, date) => `math:answered:${uid}:${date}`; // facts earned today, per day
function readLS(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* quota / private mode */ }
}
function clearLS(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

// "Earned today" set survives reload (the in-memory ref doesn't), so already-answered
// facts stay hidden until tomorrow even before the buffer flushes to the server.
function readAnswered(uid, date) {
  const raw = readLS(answeredKey(uid, date));
  const out = emptyAnsweredSets();
  if (raw && typeof raw === 'object') {
    for (const k of OP_KEYS) if (Array.isArray(raw[k])) out[k] = new Set(raw[k]);
  }
  return out;
}
function writeAnswered(uid, date, sets) {
  const obj = {};
  for (const k of OP_KEYS) obj[k] = [...(sets[k] || [])];
  writeLS(answeredKey(uid, date), obj);
}

// Drives the math practice page. Questions are generated client-side from each
// operation's fact universe (no API per question), scheduled by Leitner spaced
// repetition: facts the kid has mastered rest (suppressed) until they come due
// again. Answers are graded optimistically and flushed to the server in batches;
// the server is authoritative for the wallet and the scheduling state.
export function useMath() {
  const { user } = useAuth() || {};
  const uid = user?._id ? String(user._id) : 'anon';
  const today = format(new Date(), 'yyyy-MM-dd');
  const grade = user?.grade;

  const [loading, setLoading] = useState(true);
  const [suppressedByOp, setSuppressedByOp] = useState(EMPTY_SUPPRESSED);
  const [todayCounts, setTodayCounts] = useState({ attempted: 0, correct: 0 });
  const [reward, setReward] = useState({ pointsEarned: 0, pointsSpent: 0, balance: 0 });
  const [rewards, setRewards] = useState([]);
  const [sleepover, setSleepover] = useState(0);

  const [question, setQuestion] = useState(null);
  const [session, setSession] = useState({ attempted: 0, correct: 0, points: 0 });
  const [op, setOp] = useState('mul'); // 'mul' | 'add' | 'sub' | 'div'

  const lastKey = useRef(null);
  const suppressedRef = useRef(suppressedByOp); // freshest resting sets for picking
  const levelsRef = useRef(EMPTY_LEVELS);       // freshest factKey→level maps
  const answeredTodayRef = useRef(emptyAnsweredSets()); // facts earned today → hide until tomorrow
  const buffer = useRef([]);                    // unflushed answers
  const flushing = useRef(false);

  const maxForOp = useCallback((o) => getType(o).maxForGrade(grade), [grade]);

  // Suppressed set for an op = server resting set + facts already earned today this
  // session (optimistic, so a correct fact vanishes immediately, before the next flush).
  const suppressedFor = useCallback((o) => {
    const earned = answeredTodayRef.current[o];
    const base = suppressedRef.current[o] || [];
    return earned && earned.size ? [...base, ...earned] : base;
  }, []);

  // Pick the next due question for the current op, using the freshest scheduling refs.
  const nextQuestion = useCallback(() => {
    const lvl = levelsRef.current[op] || {};
    const q = pickDueQuestion(op, maxForOp(op), suppressedFor(op), lastKey.current, lvl);
    lastKey.current = q?.key ?? null;
    setQuestion(q);
  }, [op, maxForOp, suppressedFor]);

  // Restore today's "earned" set from storage (empty on a new day → facts come back),
  // so a reload doesn't re-show facts already answered correctly today.
  useEffect(() => { answeredTodayRef.current = readAnswered(uid, today); }, [today, uid]);

  // Re-pick when the operation or grade cap changes.
  useEffect(() => { nextQuestion(); }, [nextQuestion]);

  // Merge a scheduling payload ({ suppressedByOp, levelsByOp }) into state + refs.
  const applySchedule = useCallback((data) => {
    if (data.suppressedByOp) { suppressedRef.current = data.suppressedByOp; setSuppressedByOp(data.suppressedByOp); }
    if (data.levelsByOp) { levelsRef.current = data.levelsByOp; }
  }, []);

  // Apply a /state (or batch) payload to local state + cache it.
  const applyState = useCallback((data, { cache = true, pickNext = false } = {}) => {
    applySchedule(data);
    if (data.today) setTodayCounts(data.today);
    if (data.reward) setReward(data.reward);
    if (data.rewards) setRewards(data.rewards);
    if (typeof data.sleepoverPct === 'number') setSleepover(data.sleepoverPct);
    if (pickNext) nextQuestion();
    if (cache) writeLS(stateKey(uid, today), data);
  }, [uid, today, nextQuestion, applySchedule]);

  // Send buffered answers in one request and reconcile with the authoritative state.
  const flush = useCallback(async () => {
    if (flushing.current || buffer.current.length === 0) return;
    flushing.current = true;
    const batch = buffer.current;
    buffer.current = [];
    let ok = false;
    try {
      const res = await apiFetch('/api/math/answer/batch', {
        method: 'POST',
        body: JSON.stringify({ answers: batch }),
      });
      // Server is the source of truth — replace optimistic wallet + scheduling.
      setReward(res.reward);
      setTodayCounts(res.today);
      applySchedule(res);
      clearLS(bufferKey(uid));
      // Keep the cached state roughly fresh for instant next paint.
      const cached = readLS(stateKey(uid, today));
      if (cached) writeLS(stateKey(uid, today), { ...cached, reward: res.reward, today: res.today, suppressedByOp: res.suppressedByOp, levelsByOp: res.levelsByOp });
      ok = true;
    } catch {
      // Re-queue so nothing is lost; will retry on next flush / reload.
      buffer.current = batch.concat(buffer.current);
      writeLS(bufferKey(uid), buffer.current);
    } finally {
      flushing.current = false;
    }
    // Drain answers that arrived while this request was in flight, so the tail of a fast
    // streak posts right away instead of waiting for the next answer or page exit. Only on
    // success — on failure we wait for the next trigger rather than hot-looping the network.
    if (ok && buffer.current.length) flush();
  }, [uid, today, applySchedule]);

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
    // Type-aware: fractions reinterpret keystrokes under the "0." prefix and grade
    // with tolerance; integer types parse + compare exactly. The numeric value is
    // what gets buffered, so the server re-grades the same number.
    const answer = parseTypedAnswer(question.op, question.a, question.b, value);
    const correct = gradeAnswer(question.op, question.a, question.b, answer);
    const earns = correct && firstTry === true;
    // weighted per type; 1-point Qs get the temp per-kid promo (mirrors the server)
    const pts = earns ? effectivePoints(pointsForOp(question.op), user) : 0;

    buffer.current.push({ a: question.a, b: question.b, answer, firstTry: !!firstTry, date: today, op: question.op });
    writeLS(bufferKey(uid), buffer.current);

    setSession(s => ({
      attempted: s.attempted + 1,
      correct: s.correct + (earns ? 1 : 0),
      points: s.points + pts,
    }));
    setTodayCounts(t => ({ attempted: t.attempted + 1, correct: t.correct + (earns ? 1 : 0) }));
    if (earns) {
      // Hide this fact for the rest of today (one correct credit per fact per day).
      // Persisted so the suppression survives a reload, not just this session.
      answeredTodayRef.current[question.op]?.add(question.key);
      writeAnswered(uid, today, answeredTodayRef.current);
      setReward(r => ({ ...r, pointsEarned: r.pointsEarned + pts, balance: r.balance + pts }));
    }

    if (buffer.current.length >= FLUSH_AT) flush();
    return { correct };
  }, [question, today, uid, user, flush]);

  // Advance to the next question using the freshest scheduling refs.
  const advance = useCallback(() => { nextQuestion(); }, [nextQuestion]);

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

  // Facts still due for the current op = capped universe minus the resting set (incl.
  // facts already earned today). Filtered rather than subtracted, because the suppressed
  // set may include keys whose operands exceed this grade's cap.
  const dueSet = new Set(suppressedFor(op));
  const dueCount = generateFacts(op, maxForOp(op)).filter(f => !dueSet.has(f.key)).length;

  // Per-operation progress for the toggle grid: mastery (mastered/total facts within
  // this kid's grade cap) and the points still on the table (due facts × the kid's
  // weighted per-answer payout, promo included). Recomputed each render so mastery and
  // remaining points tick down live as facts are earned.
  const perOpStats = OP_KEYS.map(o => {
    const facts = generateFacts(o, maxForOp(o));
    const total = facts.length;
    const sup = new Set(suppressedFor(o));
    const due = facts.filter(f => !sup.has(f.key)).length;
    const mastered = total - due;
    const perPts = effectivePoints(pointsForOp(o), user);
    return {
      op: o, total, due, mastered,
      masteryPct: total ? Math.round((mastered / total) * 100) : 0,
      perPts, potential: due * perPts,
    };
  });

  return {
    loading,
    question,
    today: todayCounts,
    session,
    reward,
    rewards,
    sleepoverPct: sleepover,
    dueCount,
    perOpStats,
    caughtUp: question === null,
    op,
    setOp,
    submitAnswer,
    advance,
    redeem,
    flush,
  };
}
