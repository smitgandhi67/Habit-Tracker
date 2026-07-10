import { useState, useRef, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { Check, X, Tv, Tent, Trophy, Sparkles, History, Clock, Zap, Asterisk } from 'lucide-react';
import { useMath } from '../hooks/useMath';
import { choicesForQuestion } from '../lib/mathFacts';
import { affordableQty, pointsForOp } from '../lib/mathRewards';
import { TYPES, OP_KEYS, getType, gradeAnswer } from '../lib/questionTypes';
import { timerSecondsFor } from '../lib/mathTimer';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

// Operation toggle, built from the question-type registry so a new formula appears
// here automatically (key/symbol/label come from the descriptor).
const OPS = OP_KEYS.map(k => ({ key: k, symbol: TYPES[k].symbol, label: TYPES[k].label }));

export default function MathPage() {
  const { user } = useAuth();
  const {
    loading, question, session, reward, rewards, sleepoverPct,
    dueCount, caughtUp, op, setOp, submitAnswer, advance, redeem, flush,
  } = useMath();

  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState('input'); // 'input' | 'wrong' | 'right'
  const [stopped, setStopped] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const inputRef = useRef(null);

  const choices = useMemo(() => choicesForQuestion(question), [question]);
  const timerTotal = timerSecondsFor(user?.email);

  useEffect(() => {
    if (phase === 'input') inputRef.current?.focus();
  }, [phase, question]);

  // Visible per-question countdown. Ticks every 200ms toward a fixed deadline; when it
  // hits zero the question counts as incorrect and the choice hint is shown.
  useEffect(() => {
    if (phase !== 'input' || !question || stopped) { setSecondsLeft(null); return; }
    const totalMs = timerTotal * 1000;
    const deadline = Date.now() + totalMs;
    setSecondsLeft(timerTotal);
    let id;
    const tick = () => {
      const remMs = deadline - Date.now();
      if (remMs <= 0) {
        clearInterval(id); // stop before the state change re-runs the effect (no double-submit)
        submitAnswer(-1, true); // sentinel: never equals an answer → logged as incorrect
        setPhase('wrong');
        inputRef.current?.blur(); // surface the choice buttons
        return;
      }
      setSecondsLeft(Math.ceil(remMs / 1000));
    };
    id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phase, question, stopped, timerTotal, submitAnswer]);

  if (loading) {
    return <div className="p-4 pt-10 text-center text-slate-400">Loading…</div>;
  }

  const tv = rewards.find(r => r.key === 'tv');
  const sleepover = rewards.find(r => r.key === 'sleepover');
  const tvMinutes = tv ? affordableQty(reward.balance, tv) : 0;
  const opLabel = OPS.find(o => o.key === op)?.label || 'Math';
  // Fixed prefix shown before the input for decimal types (e.g. "0." for fractions).
  const answerPrefix = question ? (getType(question.op).answerPrefix?.(question.a, question.b) || '') : '';

  function grade(value) {
    if (phase !== 'input' || value === '' || !question) return;
    const res = submitAnswer(value, true); // graded locally — instant, no network wait
    setPhase(res.correct ? 'right' : 'wrong');
    if (res.correct) {
      // Refocus synchronously inside this submit gesture so the numpad stays open
      // through the 500ms "Correct!" pause and into the next question (no re-tap).
      inputRef.current?.focus();
      setTimeout(() => { setTyped(''); setPhase('input'); advance(); inputRef.current?.focus(); }, 500);
    } else {
      // Wrong: drop the keyboard so the multiple-choice buttons are visible.
      inputRef.current?.blur();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    grade(typed);
  }

  // Auto-submit once the kid has typed as many digits as the correct answer — graded
  // right OR wrong. This removes the multi-attempt loophole: previously a wrong number
  // waited for "Check" and stayed editable, letting the kid keep guessing. Now the first
  // full-length entry is the one graded. Partial entries (e.g. "1" on the way to "12")
  // still wait, since they're shorter than the answer.
  // Graded synchronously inside the keystroke gesture (NOT a useEffect): iOS only
  // lets focus() reopen the soft keyboard from within a user gesture, so handling
  // it here keeps the numpad open through the pause into the next question.
  function handleType(value) {
    setTyped(value);
    if (phase !== 'input' || value === '' || !question) return;
    // Types with non-integer answers (fractions) can't auto-submit on digit count —
    // the kid taps Check. For integer types, grade the instant it matches, or once the
    // entry is at least as long as the answer (a wrong guess of full length).
    if (getType(question.op).autoSubmit === false) return;
    const answerLen = String(question.answer).length;
    if (Number(value) === question.answer || value.length >= answerLen) {
      grade(value);
    }
  }

  // In the wrong-answer hint flow, picking the correct choice just lets the kid
  // move on — it is NOT logged again (one attempt per question). Tolerance-aware so
  // a rounded fraction decimal counts.
  function pickChoice(c) {
    if (!question || !gradeAnswer(question.op, question.a, question.b, c)) return;
    setTyped(''); setPhase('input'); advance();
    // Refocus inside this tap gesture so the keypad reopens for the next question.
    inputRef.current?.focus();
  }

  return (
    <div className="p-4 pb-28">
      <header className="pt-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-violet-500" /> Math Practice
          </h1>
          <Link
            to="/math/history"
            className="flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 shrink-0"
          >
            <History size={16} /> History
          </Link>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          {caughtUp
            ? `${opLabel}: all caught up! New facts coming soon 🎉`
            : `${dueCount} ${dueCount === 1 ? 'fact' : 'facts'} due · ${opLabel} practice`}
        </p>

        {/* Operation toggle — grid so 6+ question types wrap cleanly on mobile. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {OPS.map(o => (
            <button
              key={o.key}
              onClick={() => setOp(o.key)}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold transition-colors ${
                op === o.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span className="text-lg leading-none">{o.symbol}</span> {o.label}
            </button>
          ))}
          <Link
            to="/math/zigzag"
            className="flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <Zap size={16} /> Zigzag
          </Link>
          <Link
            to="/math/stepmul"
            className="flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <Asterisk size={16} /> Step ×
          </Link>
        </div>
      </header>

      {/* Practice card */}
      {!stopped ? (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4">
          {question ? (
            <>
              <div className="text-center">
                <div className="text-6xl font-extrabold text-slate-800 tracking-tight tabular-nums">
                  {question.display}
                </div>
              </div>

              {/* Visible countdown — seconds left to answer before it auto-marks wrong. */}
              {phase === 'input' && secondsLeft != null && (
                <div className="mt-4 flex flex-col items-center gap-1">
                  <div className={`flex items-center gap-1 text-sm font-bold tabular-nums ${secondsLeft <= 3 ? 'text-red-500' : 'text-slate-400'}`}>
                    <Clock size={14} /> {secondsLeft}s
                  </div>
                  <div className="w-40 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ease-linear ${secondsLeft <= 3 ? 'bg-red-400' : 'bg-violet-400'}`}
                      style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / timerTotal) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* The input stays mounted in every phase and is never `disabled` (that
                  blurs and drops the mobile keyboard). It is only `readOnly` in the wrong
                  phase (where we blur to show the choices). On the correct path it stays
                  editable+focused: iOS Safari hides the keypad the instant a focused field
                  turns readOnly, so keeping it editable is what holds the numpad open on
                  iPad through the pause and into the next question. */}
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-1">
                  {answerPrefix && (
                    <span className="text-4xl font-bold text-slate-400 tabular-nums">{answerPrefix}</span>
                  )}
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode={answerPrefix ? 'decimal' : 'numeric'}
                    value={typed}
                    readOnly={phase === 'wrong'}
                    onChange={e => handleType(e.target.value)}
                    placeholder="?"
                    className={`w-40 text-center text-4xl font-bold rounded-2xl border-2 py-3 outline-none tabular-nums ${
                      phase === 'right'
                        ? 'border-green-400 bg-green-50 text-green-600'
                        : phase === 'wrong'
                          ? 'border-red-300 bg-red-50 text-red-500'
                          : 'border-slate-200 focus:border-violet-400'
                    }`}
                  />
                </div>
                {phase === 'input' && (
                  <button
                    type="submit"
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-lg rounded-2xl px-8 py-3 transition-colors"
                  >
                    Check
                  </button>
                )}
                {phase === 'right' && (
                  <div className="flex items-center gap-1 text-green-600 font-bold text-lg">
                    <Check /> Correct! +{pointsForOp(question.op)} {pointsForOp(question.op) === 1 ? 'point' : 'points'}
                  </div>
                )}
              </form>

              {phase === 'wrong' && (
                <div className="mt-4">
                  <div className="flex items-center justify-center gap-1 text-red-500 font-semibold mb-3">
                    <X size={18} /> Not quite — tap the right answer
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {choices.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => pickChoice(c)}
                        className="text-2xl font-bold tabular-nums rounded-2xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50 py-4 transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Live session counters */}
              <div className="mt-6 flex justify-center gap-6 text-sm text-slate-500">
                <span><b className="text-slate-700">{session.attempted}</b> tried</span>
                <span><b className="text-green-600">{session.correct}</b> correct</span>
                <span><b className="text-violet-600">+{session.points}</b> points</span>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Trophy className="mx-auto text-amber-400 mb-2" size={40} />
              <p className="font-bold text-slate-700">All caught up on {opLabel.toLowerCase()}!</p>
              <p className="text-slate-400 text-sm">These facts are resting. Try another operation, or check back soon for a review.</p>
            </div>
          )}

          {question && (
            <button
              onClick={() => { flush(); setStopped(true); }}
              className="mt-6 w-full text-slate-400 hover:text-slate-600 text-sm font-medium"
            >
              Stop for now
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Nice work! 🎉</h2>
          <div className="flex justify-center gap-6 text-sm text-slate-500 mb-4">
            <span><b className="text-slate-700">{session.attempted}</b> tried</span>
            <span><b className="text-green-600">{session.correct}</b> correct</span>
            <span><b className="text-violet-600">+{session.points}</b> points</span>
          </div>
          <button
            onClick={() => { setStopped(false); setPhase('input'); setTyped(''); }}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl px-8 py-3 transition-colors"
          >
            Practice more
          </button>
        </div>
      )}

      {/* Wallet */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-slate-500 font-medium">Your points</span>
          <span className="text-4xl font-extrabold text-violet-600 tabular-nums">{reward.balance}</span>
        </div>

        {tv && (
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 mb-3">
            <div className="flex items-center gap-2">
              <Tv className="text-sky-500" size={20} />
              <div>
                <p className="font-semibold text-slate-700 text-sm">TV time</p>
                <p className="text-xs text-slate-400">{tv.costPoints} pts = 1 min · you can get {tvMinutes} min</p>
              </div>
            </div>
            <button
              disabled={tvMinutes < 1}
              onClick={() => redeem('tv', tvMinutes)}
              className="bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm rounded-xl px-4 py-2 transition-colors"
            >
              Use {tvMinutes} min
            </button>
          </div>
        )}

        {sleepover && (
          <div className="bg-slate-50 rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tent className="text-amber-500" size={20} />
                <p className="font-semibold text-slate-700 text-sm">Sleepover</p>
              </div>
              <span className="text-xs text-slate-400 tabular-nums">{reward.balance} / {sleepover.costPoints}</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${Math.round(sleepoverPct * 100)}%` }}
              />
            </div>
            {reward.balance >= sleepover.costPoints && (
              <button
                onClick={() => redeem('sleepover', 1)}
                className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl py-2 transition-colors"
              >
                Claim sleepover! 🎉
              </button>
            )}
          </div>
        )}
      </div>

      <WeekProgress />
    </div>
  );
}

// This-week + recent daily counts. Self-contained fetch so the practice hook stays lean.
function WeekProgress() {
  const [days, setDays] = useState([]);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    apiFetch(`/api/math/progress?date=${today}&weeks=8`)
      .then(d => setDays(d.days || []))
      .catch(() => setDays([]));
  }, [today]);

  // Build last 7 days (oldest → newest) for the bar row.
  const byDate = new Map(days.map(d => [d.date, d]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const ds = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    return { date: ds, ...(byDate.get(ds) || { attempted: 0, correct: 0 }) };
  });
  const max = Math.max(1, ...week.map(d => d.correct));

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-bold text-slate-700 mb-4">This week</h3>
      <div className="flex items-end justify-between gap-2 h-28">
        {week.map(d => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-semibold text-slate-500 tabular-nums">{d.correct || ''}</span>
            <div className="w-full bg-slate-100 rounded-lg flex items-end" style={{ height: '100%' }}>
              <div
                className="w-full bg-violet-400 rounded-lg transition-all"
                style={{ height: `${(d.correct / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{format(new Date(d.date + 'T12:00:00'), 'EEE')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
