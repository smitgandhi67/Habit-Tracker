import { useState, useRef, useEffect, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Check, X, Tv, Tent, Trophy, Sparkles } from 'lucide-react';
import { useMath } from '../hooks/useMath';
import { answerChoices, TOTAL_FACTS } from '../lib/mathFacts';
import { affordableQty } from '../lib/mathRewards';
import { apiFetch } from '../lib/api';

export default function MathPage() {
  const {
    loading, question, session, reward, rewards, sleepoverPct,
    retiredCount, submitAnswer, advance, redeem, flush,
  } = useMath();

  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState('input'); // 'input' | 'wrong' | 'right'
  const [stopped, setStopped] = useState(false);
  const inputRef = useRef(null);

  const choices = useMemo(
    () => (question ? answerChoices(question.a, question.b) : []),
    [question]
  );

  useEffect(() => {
    if (phase === 'input') inputRef.current?.focus();
  }, [phase, question]);

  if (loading) {
    return <div className="p-4 pt-10 text-center text-slate-400">Loading…</div>;
  }

  const tv = rewards.find(r => r.key === 'tv');
  const sleepover = rewards.find(r => r.key === 'sleepover');
  const tvMinutes = tv ? affordableQty(reward.balance, tv) : 0;
  const poolLeft = TOTAL_FACTS - retiredCount;

  function handleSubmit(e) {
    e.preventDefault();
    if (phase !== 'input' || typed === '' || !question) return;
    const res = submitAnswer(typed, true); // graded locally — instant, no network wait
    setPhase(res.correct ? 'right' : 'wrong');
    if (res.correct) {
      setTimeout(() => { setTyped(''); setPhase('input'); advance(); }, 500);
    }
  }

  // In the wrong-answer hint flow, picking the correct choice just lets the kid
  // move on — it is NOT logged again (one attempt per question).
  function pickChoice(c) {
    if (!question || c !== question.product) return;
    setTyped(''); setPhase('input'); advance();
  }

  return (
    <div className="p-4 pb-28">
      <header className="pt-4 mb-4">
        <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
          <Sparkles className="text-violet-500" /> Times Tables
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {poolLeft > 0 ? `${poolLeft} facts left to master this week` : 'All facts mastered this week! 🎉'}
        </p>
      </header>

      {/* Practice card */}
      {!stopped ? (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-4">
          {question ? (
            <>
              <div className="text-center">
                <div className="text-6xl font-extrabold text-slate-800 tracking-tight tabular-nums">
                  {question.a} × {question.b}
                </div>
              </div>

              {phase !== 'wrong' && (
                <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center gap-3">
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="numeric"
                    value={typed}
                    disabled={phase === 'right'}
                    onChange={e => setTyped(e.target.value)}
                    placeholder="?"
                    className={`w-40 text-center text-4xl font-bold rounded-2xl border-2 py-3 outline-none tabular-nums ${
                      phase === 'right' ? 'border-green-400 bg-green-50 text-green-600' : 'border-slate-200 focus:border-violet-400'
                    }`}
                  />
                  {phase === 'right' ? (
                    <div className="flex items-center gap-1 text-green-600 font-bold text-lg">
                      <Check /> Correct! +1 point
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-lg rounded-2xl px-8 py-3 transition-colors"
                    >
                      Check
                    </button>
                  )}
                </form>
              )}

              {phase === 'wrong' && (
                <div className="mt-6">
                  <div className="flex items-center justify-center gap-1 text-red-500 font-semibold mb-3">
                    <X size={18} /> Not quite — tap the right answer
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {choices.map(c => (
                      <button
                        key={c}
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
              <p className="font-bold text-slate-700">Every fact mastered this week!</p>
              <p className="text-slate-400 text-sm">Come back next week for a fresh round.</p>
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
