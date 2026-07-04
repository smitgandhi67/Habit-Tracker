import { useState, useEffect, useMemo, useRef } from 'react';
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

// How long a just-tapped card is held in its old section before it slides to the new
// one. Stops the list reordering under the user's finger (which caused mis-taps on the
// card that slid up). Also the duration of the tap "flash" feedback.
const MOVE_DELAY_MS = 800;

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
  // Depth Pack programs (self): habitId -> programId so training habits get a ▶ link.
  const [programByHabit, setProgramByHabit] = useState({});
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/capabilities/programs')
      .then(({ programs }) => {
        if (cancelled) return;
        const map = {};
        for (const p of programs) if (p.status === 'active') map[p.habitId] = p._id;
        setProgramByHabit(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const done  = habits.filter(h => getStatus(h._id, date) === 'done').length;
  const half  = habits.filter(h => getStatus(h._id, date) === 'half_done').length;
  const total = habits.length;
  const progress = total === 0 ? 0 : Math.round(((done + half * 0.5) / total) * 100);
  const onToday  = isToday(date);

  // Which tracking section a habit belongs to. A points-bearing habit that's done but
  // not yet approved (or whose award hasn't synced) is awaiting; rejected points drop
  // back to pending (needs redo); done with no points has nothing to approve, so it
  // counts as approved.
  const sectionOf = (h) => {
    const st = getStatus(h._id, date);
    const pts = h.points || 0;
    if (st !== 'done') return 'pending';
    if (pts === 0) return 'approved';
    const aw = awards[h._id]?.status || 'pending';
    if (aw === 'approved') return 'approved';
    if (aw === 'rejected') return 'pending';
    return 'awaiting';
  };

  // habitId -> section to hold it in during the move-delay animation (see MOVE_DELAY_MS).
  const [pinned, setPinned] = useState({});
  const timersRef = useRef([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // Tap handler: cycle the status, but pin the card to its pre-tap section briefly so a
  // completion doesn't yank the list and steal the next tap. The flash gives tap feedback.
  const handleCycle = (habitId) => {
    const from = sectionOf(habits.find(h => h._id === habitId));
    cycleStatus(habitId, date);
    // Pin to the section it was in BEFORE this tap; keep the original pin if one is
    // already active (rapid re-taps) so the card holds steady instead of jumping.
    setPinned(p => (habitId in p ? p : { ...p, [habitId]: from }));
    timersRef.current.push(setTimeout(() => {
      setPinned(p => { const n = { ...p }; delete n[habitId]; return n; });
    }, MOVE_DELAY_MS));
  };

  // Partition into sections, honoring any active pin so cards don't jump mid-tap.
  const groups = { pending: [], awaiting: [], approved: [] };
  for (const h of habits) {
    const sec = pinned[h._id] || sectionOf(h);
    (groups[sec] || groups.pending).push(h);
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
                      onCycle={() => handleCycle(habit._id)}
                      value={getValue(habit._id, date)}
                      onValueChange={(val) => setLogValue(habit._id, date, val)}
                      award={awards[habit._id]}
                      flash={!!pinned[habit._id]}
                      trainTo={programByHabit[habit._id] ? `/skills/train/${programByHabit[habit._id]}` : null}
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
