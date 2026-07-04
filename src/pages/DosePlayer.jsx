import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHabitsContext } from '../hooks/useHabits';
import { listPrograms, putMeasure } from '../lib/capabilities/programs';

// Mon–Fri drill cards; weekend shows Friday's card with a rest-day banner.
const jsDayToCard = jsDay => (jsDay >= 1 && jsDay <= 5 ? jsDay : 5);

// Countdown for one drill card. Callers remount it per card (via key) so a card
// switch resets the clock without effect-driven state writes.
function Timer({ minutes }) {
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const leftRef = useRef(minutes * 60);
  const ref = useRef(null);
  useEffect(() => {
    if (!running) return undefined;
    ref.current = setInterval(() => {
      const next = Math.max(leftRef.current - 1, 0);
      leftRef.current = next;
      setLeft(next);
      if (next === 0) {
        clearInterval(ref.current);
        setRunning(false);
        toast('⏰ Time! Nice work.');
      }
    }, 1000);
    return () => clearInterval(ref.current);
  }, [running]);
  const reset = () => {
    setRunning(false);
    leftRef.current = minutes * 60;
    setLeft(minutes * 60);
  };
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5">
      <span className={`font-mono text-2xl font-bold ${left === 0 ? 'text-green-600' : 'text-slate-700'}`}>{mm}:{ss}</span>
      <button onClick={() => setRunning(r => !r)} className="p-2 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200">
        {running ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button onClick={reset} className="p-2 rounded-full text-slate-400 hover:bg-slate-200">
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

export default function DosePlayer() {
  const { programId } = useParams();
  const { getStatus, setStatus } = useHabitsContext();
  const [program, setProgram] = useState(null);
  const [error, setError] = useState(null);
  const today = new Date();
  const [selectedDay, setSelectedDay] = useState(jsDayToCard(today.getDay()));
  const [checked, setChecked] = useState({});
  const [score, setScore] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPrograms()
      .then(({ programs }) => {
        if (cancelled) return;
        const p = programs.find(x => String(x._id) === String(programId));
        if (!p) setError('Program not found');
        else setProgram(p);
      })
      .catch(() => { if (!cancelled) setError('Failed to load program'); });
    return () => { cancelled = true; };
  }, [programId]);

  const card = useMemo(
    () => program?.week?.days?.find(d => d.day === selectedDay) || null,
    [program, selectedDay]
  );
  const scoreDef = card?.scoreMetric
    ? program.pack.metrics.find(m => m.key === card.scoreMetric)
    : null;

  if (error) return (
    <div className="p-6 text-center text-slate-500">
      <p className="mb-2">{error}</p>
      <Link to="/today" className="text-violet-600 font-semibold text-sm">Back to Today</Link>
    </div>
  );
  if (!program) return <div className="p-6 text-center text-slate-400">Loading…</div>;

  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const doneToday = !program.habitMissing && getStatus(program.habitId, today) === 'done';
  const paused = program.status !== 'active';

  const saveScore = async () => {
    if (score === '' || !scoreDef) return;
    setSavingScore(true);
    try {
      await putMeasure(program._id, program.currentWeek, { metrics: { [card.scoreMetric]: Number(score) } });
      toast.success(`${scoreDef.label} saved!`);
    } catch { toast.error('Could not save score'); }
    setSavingScore(false);
  };

  const markDone = () => {
    if (program.habitMissing) return;
    setStatus(program.habitId, today, 'done');
    toast.success('Dose done! 🎉');
  };

  return (
    <div className="px-4 pb-12 pt-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/today" className="p-1.5 rounded-full hover:bg-slate-100"><ChevronLeft size={20} className="text-slate-500" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-800">{program.pack.title}</h1>
          <p className="text-xs text-slate-400">Week {program.currentWeek} of {program.totalWeeks} · {program.week?.theme}</p>
        </div>
      </div>

      {/* Ladder strip (read-only) */}
      <div className="flex gap-1 my-3">
        {program.pack.ladder.map(l => (
          <span key={l.level} title={l.milestone}
            className="flex-1 text-center text-[10px] font-bold py-1 rounded bg-slate-100 text-slate-400">
            L{l.level}
          </span>
        ))}
      </div>

      {paused && <p className="mb-3 text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-2">This program is {program.status}. Ask a parent to resume it.</p>}
      {isWeekend && <p className="mb-3 text-xs font-semibold text-sky-600 bg-sky-50 rounded-lg px-3 py-2">Weekend — rest day. Friday's card is here if you want it.</p>}

      {/* Day tabs */}
      <div className="flex gap-1.5 mb-4">
        {(program.week?.days || []).map(d => (
          <button key={d.day} onClick={() => { setSelectedDay(d.day); setChecked({}); setScore(''); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${d.day === selectedDay ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d.day - 1]}
          </button>
        ))}
      </div>

      {card && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="font-bold text-slate-800 mb-3">{card.title}</h2>
          <div className="space-y-2 mb-4">
            {card.steps.map((s, i) => (
              <label key={i} className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={!!checked[i]}
                  onChange={() => setChecked(c => ({ ...c, [i]: !c[i] }))}
                  className="mt-0.5 accent-violet-600" />
                <span className={`text-sm ${checked[i] ? 'text-slate-300 line-through' : 'text-slate-600'}`}>{s}</span>
              </label>
            ))}
          </div>

          <Timer key={`${program.currentWeek}-${card.day}`} minutes={card.timerMin} />

          {scoreDef && (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-1">{scoreDef.label} ({scoreDef.min}–{scoreDef.max})</p>
              <div className="flex gap-2">
                <input type="number" min={scoreDef.min} max={scoreDef.max} value={score}
                  onChange={e => setScore(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                <button onClick={saveScore} disabled={savingScore || score === ''}
                  className="px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">
                  Save
                </button>
              </div>
            </div>
          )}

          <button onClick={markDone} disabled={doneToday || program.habitMissing || paused}
            className={`mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm ${doneToday ? 'bg-green-100 text-green-600' : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-40'}`}>
            <CheckCircle2 size={18} />
            {doneToday ? 'Done for today!' : 'Done for today'}
          </button>
          {program.habitMissing && <p className="mt-2 text-xs text-red-400">The linked habit was deleted — ask a parent to restart this pack.</p>}
        </div>
      )}
    </div>
  );
}
