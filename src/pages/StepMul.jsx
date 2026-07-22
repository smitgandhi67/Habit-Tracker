import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Check, X, Clock, Asterisk, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

// Step multiplication gives every kid 20s per question, regardless of grade.
function timerFor() {
  return 20;
}

const rand2 = () => 26 + Math.floor(Math.random() * 74);   // 26..99 (two-digit > 25)
const rand3 = () => 100 + Math.floor(Math.random() * 900); // 100..999 (three-digit)
const rand1 = () => 2 + Math.floor(Math.random() * 8);     // 2..9 (non-trivial one-digit)

// Grade 4+ (and unset) mix in three-digit × one-digit questions.
function isBigEligible(grade) {
  return grade == null || grade >= 4;
}

// A fresh step-multiplication question × one-digit and its product. Grade 4+ mixes in
// three-digit operands (~40%); grades 2-3 stay two-digit (>25).
function makeQuestion(grade) {
  const a = (isBigEligible(grade) && Math.random() < 0.4) ? rand3() : rand2();
  const b = rand1();
  return { a, b, product: a * b, key: `${a}x${b}` };
}

// Four answer choices for the wrong/timeout reveal: the correct product plus three
// near-miss distractors (off-by-a-multiple / carry slips), shuffled.
function makeChoices(product) {
  const set = new Set([product]);
  const offsets = [1, -1, 2, -2, 3, -3, 5, -5, 7, -7, 10, -10, 9, -9]
    .sort(() => Math.random() - 0.5);
  for (const o of offsets) {
    if (set.size >= 4) break;
    if (product + o > 0) set.add(product + o);
  }
  let pad = 3;
  while (set.size < 4) { if (product + pad > 0) set.add(product + pad); pad++; }
  return [...set].sort(() => Math.random() - 0.5);
}

// Credit + record one answer server-side (authoritative). `answer` of -1 on a
// timeout logs the attempt without ever grading correct.
function postStepmul(q, answer, dateStr) {
  return apiFetch('/api/math/stepmul/answer', {
    method: 'POST',
    body: JSON.stringify({ a: q.a, b: q.b, answer, date: dateStr }),
  });
}

export default function StepMul({ embedded = false }) {
  const { user } = useAuth();
  const timerTotal = timerFor(user?.grade);
  const dateStr = format(new Date(), 'yyyy-MM-dd');

  const [question, setQuestion] = useState(() => makeQuestion(user?.grade));
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState('input'); // 'input' | 'right' | 'wrong'
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [session, setSession] = useState({ attempted: 0, correct: 0, points: 0 });
  const [balance, setBalance] = useState(null);
  const inputRef = useRef(null);
  const answeredRef = useRef(false); // once the kid has answered, stop regenerating on grade load

  const choices = useMemo(() => makeChoices(question.product), [question]);

  // Initial wallet balance (updates from each answer response afterward).
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/math/state?date=${dateStr}`)
      .then(d => { if (!cancelled && typeof d?.reward?.balance === 'number') setBalance(d.reward.balance); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dateStr]);

  const newQuestion = useCallback(() => {
    setQuestion(makeQuestion(user?.grade));
    setTyped('');
    setPhase('input');
  }, [user?.grade]);

  // Grade resolves after mount; regenerate the first question once it's known (before the
  // kid has answered) so a lower-grade kid never sees a three-digit first question.
  useEffect(() => {
    if (!answeredRef.current) setQuestion(makeQuestion(user?.grade));
  }, [user?.grade]);

  useEffect(() => {
    if (phase === 'input') inputRef.current?.focus();
  }, [phase, question]);

  // Per-question countdown. On zero the question is revealed as wrong (choices shown)
  // and the attempt is logged; it never counts correct.
  useEffect(() => {
    if (phase !== 'input') { setSecondsLeft(null); return; }
    const deadline = Date.now() + timerTotal * 1000;
    setSecondsLeft(timerTotal);
    let id;
    const tick = () => {
      const remMs = deadline - Date.now();
      if (remMs <= 0) {
        clearInterval(id); // stop before the state change re-runs the effect
        answeredRef.current = true;
        setSession(s => ({ ...s, attempted: s.attempted + 1 }));
        postStepmul(question, -1, dateStr)
          .then(res => { if (typeof res?.reward?.balance === 'number') setBalance(res.reward.balance); })
          .catch(() => {});
        setPhase('wrong');
        inputRef.current?.blur(); // surface the choice buttons
        return;
      }
      setSecondsLeft(Math.ceil(remMs / 1000));
    };
    id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phase, question, timerTotal, dateStr]);

  // Grade the typed answer: instant local feedback for the phase, server credits.
  function grade(value) {
    if (phase !== 'input' || value === '' || !question) return;
    answeredRef.current = true;
    const correct = Number(value) === question.product;
    setSession(s => ({ attempted: s.attempted + 1, correct: s.correct + (correct ? 1 : 0), points: s.points }));
    setPhase(correct ? 'right' : 'wrong');
    postStepmul(question, Number(value), dateStr)
      .then(res => {
        if (typeof res?.reward?.balance === 'number') setBalance(res.reward.balance);
        if (res?.awarded) setSession(s => ({ ...s, points: s.points + res.awarded }));
      })
      .catch(() => {});
    if (correct) {
      inputRef.current?.focus();
      setTimeout(() => { newQuestion(); inputRef.current?.focus(); }, 500);
    } else {
      inputRef.current?.blur();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    grade(typed);
  }

  // Auto-grade once the entry is at least as long as the answer — removes the
  // multi-guess loophole, same as the facts page.
  function handleType(value) {
    setTyped(value);
    if (phase !== 'input' || value === '' || !question) return;
    const answerLen = String(question.product).length;
    if (Number(value) === question.product || value.length >= answerLen) grade(value);
  }

  // Picking the right choice in the reveal just moves on — not re-logged, no points.
  function pickChoice(c) {
    if (!question || c !== question.product) return;
    newQuestion();
    inputRef.current?.focus();
  }

  const subtitle = `${isBigEligible(user?.grade) ? '2 or 3-digit' : 'Two-digit'} × one-digit · ${timerTotal}s each · first 20/day earn ⭐10`;

  // Shared by the standalone page and the embedded (inline on /math) form; embedded
  // shows a compact subtitle in place of the page header.
  const card = (
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4">
        {embedded && <p className="text-center text-xs text-slate-400 mb-3">{subtitle}</p>}
        {/* Prompt */}
        <div className="text-center">
          <div className="text-6xl font-extrabold text-slate-800 tracking-tight tabular-nums">
            {question.a} × {question.b}
          </div>
        </div>

        {/* Countdown */}
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

        {/* Answer input — kept mounted + editable so the mobile numpad stays open. */}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center gap-3">
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            value={typed}
            readOnly={phase === 'wrong'}
            onChange={e => handleType(e.target.value)}
            placeholder="?"
            className={`w-44 text-center text-4xl font-bold rounded-2xl border-2 py-3 outline-none tabular-nums ${
              phase === 'right'
                ? 'border-green-400 bg-green-50 text-green-600'
                : phase === 'wrong'
                  ? 'border-red-300 bg-red-50 text-red-500'
                  : 'border-slate-200 focus:border-violet-400'
            }`}
          />
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
              <Check /> Correct!
            </div>
          )}
        </form>

        {phase === 'wrong' && (
          <div className="mt-4">
            <div className="flex items-center justify-center gap-1 text-red-500 font-semibold mb-3">
              <X size={18} /> Tap the right answer
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
      </div>
  );

  if (embedded) return card;

  return (
    <div className="p-4 pb-28">
      <header className="pt-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
            <Asterisk className="text-violet-500" /> Step ×
          </h1>
          <Link
            to="/math"
            className="flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 shrink-0"
          >
            <ArrowLeft size={16} /> Math
          </Link>
        </div>
        <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
      </header>

      {card}

      {/* Wallet balance */}
      {balance != null && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-baseline justify-between">
          <span className="text-slate-500 font-medium">Your points</span>
          <span className="text-4xl font-extrabold text-violet-600 tabular-nums">{balance}</span>
        </div>
      )}
    </div>
  );
}
