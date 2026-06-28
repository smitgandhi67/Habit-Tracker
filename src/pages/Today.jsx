import { useState, useEffect, useMemo } from 'react';
import { format, addDays, subDays, isToday, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useHabitsContext } from '../hooks/useHabits';
import HabitCard from '../components/HabitCard';
import BuilderTodayCard from '../components/BuilderTodayCard';
import { HabitListSkeleton } from '../components/Skeleton';
import { apiFetch } from '../lib/api';

// Tracking sections for the habit list, in display order.
const SECTIONS = [
  { key: 'pending',  label: 'Pending',           dot: 'bg-slate-300' },
  { key: 'awaiting', label: 'Awaiting approval', dot: 'bg-amber-400' },
  { key: 'approved', label: 'Done & approved',   dot: 'bg-green-500' },
];

export default function Today() {
  const [date, setDate] = useState(startOfDay(new Date()));
  const { habitsForDate, getStatus, getValue, cycleStatus, setLogValue, loading, ensureLogsForDate } = useHabitsContext();

  useEffect(() => { ensureLogsForDate(date); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const habits = habitsForDate(date);
  const dateStr = format(date, 'yyyy-MM-dd');

  // Habit-points awards for the viewed date, keyed by habitId. Refetched when the
  // date or any completion state changes (a 'done' creates a pending award server-side).
  const [awards, setAwards] = useState({});
  const statusSig = useMemo(
    () => habits.map(h => `${h._id}:${getStatus(h._id, date)}`).join('|'),
    [habits, getStatus, date]
  );
  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/math/awards?dates=${dateStr}`)
      .then(list => {
        if (cancelled) return;
        const map = {};
        for (const a of list) map[a.habitId] = a;
        setAwards(map);
      })
      .catch(() => { if (!cancelled) setAwards({}); });
    return () => { cancelled = true; };
  }, [dateStr, statusSig]);
  const done  = habits.filter(h => getStatus(h._id, date) === 'done').length;
  const half  = habits.filter(h => getStatus(h._id, date) === 'half_done').length;
  const total = habits.length;
  const progress = total === 0 ? 0 : Math.round(((done + half * 0.5) / total) * 100);
  const onToday  = isToday(date);

  // Partition habits into the three tracking sections. A points-bearing habit
  // that's done but not yet approved (or whose award hasn't synced) is awaiting;
  // rejected points drop back to pending (needs redo); done with no points has
  // nothing to approve, so it counts as approved.
  const groups = { pending: [], awaiting: [], approved: [] };
  for (const h of habits) {
    const st = getStatus(h._id, date);
    const pts = h.points || 0;
    if (st === 'done') {
      if (pts === 0) { groups.approved.push(h); continue; }
      const aw = awards[h._id]?.status || 'pending';
      if (aw === 'approved') groups.approved.push(h);
      else if (aw === 'rejected') groups.pending.push(h);
      else groups.awaiting.push(h);
    } else {
      groups.pending.push(h);
    }
  }

  const message =
    total === 0       ? '' :
    done === total    ? 'All done! Amazing work!' :
    progress >= 75    ? "You're killing it — keep going!" :
    progress >= 40    ? "Nice progress. You've got this!" :
    'Let\'s get started!';

  if (loading) {
    return <div className="p-4 pt-8"><HabitListSkeleton /></div>;
  }

  return (
    <div className="p-4">
      {/* Date navigation */}
      <div className="pt-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(d => subDays(d, 1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex-1 text-center">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
              {format(date, 'EEEE')}
            </p>
            <h1 className="text-2xl font-bold text-slate-800 leading-tight">
              {format(date, 'MMMM d, yyyy')}
            </h1>
          </div>

          <button
            onClick={() => setDate(d => addDays(d, 1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Go to today pill */}
        {!onToday && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setDate(startOfDay(new Date()))}
              className="text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1 rounded-full transition-colors"
            >
              Go to today
            </button>
          </div>
        )}
      </div>

      {/* Progress card */}
      {total > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-slate-500 text-sm">Completed</p>
              <p className="mt-0.5">
                <span className="text-3xl font-bold text-violet-600">{done}</span>
                <span className="text-slate-400 text-lg"> / {total}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-slate-700">{progress}%</span>
              {progress === 100 && <Sparkles className="text-amber-400 ml-1 inline" size={20} />}
            </div>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {message && <p className="text-slate-400 text-xs mt-2">{message}</p>}
        </div>
      )}

      {/* Builder quick-action (today only) */}
      {onToday && <BuilderTodayCard />}

      {/* Habit list */}
      {total === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-5xl mb-4">🌱</p>
          <p className="font-semibold text-slate-600">No habits for this day</p>
          <p className="text-sm mt-1">Add habits in the Habits tab</p>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(sec => {
            const list = groups[sec.key];
            if (list.length === 0) return null;
            return (
              <div key={sec.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={`w-2 h-2 rounded-full ${sec.dot}`} />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {sec.label}
                  </h2>
                  <span className="text-xs font-semibold text-slate-400">{list.length}</span>
                </div>
                <div className="space-y-3">
                  {list.map(habit => (
                    <HabitCard
                      key={habit._id}
                      habit={habit}
                      status={getStatus(habit._id, date)}
                      onCycle={() => cycleStatus(habit._id, date)}
                      value={getValue(habit._id, date)}
                      onValueChange={(val) => setLogValue(habit._id, date, val)}
                      award={awards[habit._id]}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="mt-6 flex gap-3 flex-wrap justify-center text-xs text-slate-400">
          <span>○ Not started</span>
          <span className="text-green-500">✓ Done</span>
          <span className="text-amber-500">◑ Half done</span>
          <span className="text-red-400">✕ Not done</span>
        </div>
      )}
    </div>
  );
}
