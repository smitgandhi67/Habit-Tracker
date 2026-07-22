import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Check, X, Clock, Zap, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

// 20s per question for everyone (matches step-multiplication).
function timerFor() {
  return 20;
}

const rand3 = () => 100 + Math.floor(Math.random() * 900); // 100..999
const rand2 = () => 10 + Math.floor(Math.random() * 90);   // 10..99

// Grades 2-3 add three 2-digit numbers; grades 4-5 (and unset grades) add three
// 3-digit numbers.
function isLowerGrade(grade) {
  return grade === 2 || grade === 3;
}

// A fresh zigzag question and its sum: three operands either way — 2-digit for the
// lower grades (e.g. 22 + 12 + 34), 3-digit for the rest.
function makeQuestion(grade) {
  const r = isLowerGrade(grade) ? rand2 : rand3;
  const a = r(), b = r(), c = r();
  return { a, b, c, sum: a + b + c, key: `${a}+${b}+${c}` };
}

// Four answer choices for the wrong/timeout reveal: the correct sum plus three
// near-miss distractors (common carry/place-value slips), shuffled.
function makeChoices(sum) {
  const set = new Set([sum]);
  const offsets = [1, -1, 10, -10, 100, -100, 9, -9, 11, -11, 2, -2, 20, -20]
    .sort(() => Math.random() - 0.5);
  for (const o of offsets) {
    if (set.size >= 4) break;
    if (sum + o > 0) set.add(sum + o);
  }
  let pad = 3;
  while (set.size < 4) { if (sum + pad > 0) set.add(sum + pad); pad++; }
  return [...set].sort(() => Math.random() - 0.5);
}

// Credit + record one answer server-side (authoritative). `answer` of -1 on a
// timeout logs the attempt without ever grading correct.
function postZigzag(q, answer, dateStr) {
  return apiFetch('/api/math/zigzag/answer', {
    method: 'POST',
    body: JSON.stringify({ a: q.a, b: q.b, c: q.c, answer, date: dateStr }),
  });
}

export default function Zigzag({ embedded = false }) {
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
  const answeredRef = useRef(false);

  const choices = useMemo(() => makeChoices(question.sum), [question]);

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

  // The auth context resolves the user (and grade) asynchronously after mount, so the
  // very first question may have been generated before the grade was known. Refresh it
  // once the grade loads, but only before the kid has answered anything.
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
        postZigzag(question, -1, dateStr)
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
    const correct = Number(value) === question.sum;
    setSession(s => ({ attempted: s.attempted + 1, correct: s.correct + (correct ? 1 : 0), points: s.points }));
    setPhase(correct ? 'right' : 'wrong');
    postZigzag(question, Number(value), dateStr)
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

  // Auto-grade once the entry is at least as long as the answer (3 or 4 digits) —
  // removes the multi-guess loophole, same as the facts page.
  function handleType(value) {
    setTyped(value);
    if (phase !== 'input' || value === '' || !question) return;
    const answerLen = String(question.sum).length;
    if (Number(value) === question.sum || value.length >= answerLen) grade(value);
  }

  // Picking the right choice in the reveal just moves on — not re-logged, no points.
  function pickChoice(c) {
    if (!question || c !== question.sum) return;
    newQuestion();
    inputRef.current?.focus();
  }

  const subtitle = `${isLowerGrade(user?.grade) ? 'Add three 2-digit numbers' : 'Add three 3-digit numbers'} · ${timerTotal}s each · first 20/day earn ⭐15`;

  // The practice card is shared by the standalone page and the embedded (inline on
  // /math) form; embedded shows a compact subtitle in place of the page header.
  const card = (
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4">
        {embedded && <p className="text-center text-xs text-slate-400 mb-3">{subtitle}</p>}
        {/* Column-addition prompt */}
        <div className="flex justify-center">
          <div className="text-5xl font-extrabold text-slate-800 tracking-tight tabular-nums text-right leading-tight">
            <div>{question.a}</div>
            {question.c != null && <div>{question.b}</div>}
            <div className="flex items-center justify-end gap-3">
              <span className="text-3xl text-violet-500">+</span>
              <span>{question.c != null ? question.c : question.b}</span>
            </div>
            <div className="mt-2 border-t-4 border-slate-300" />
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
            <Zap className="text-violet-500" /> Zigzag
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
