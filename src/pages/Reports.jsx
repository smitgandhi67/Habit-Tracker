import { format, subDays } from 'date-fns';
import { Flame } from 'lucide-react';
import { useHabitsContext } from '../hooks/useHabits';
import { HabitListSkeleton } from '../components/Skeleton';

const STATUS_COLOR = {
  done:        'bg-green-500',
  half_done:   'bg-amber-400',
  not_done:    'bg-red-400',
  not_started: 'bg-slate-200',
};

const DAYS = 21;

function ValueSummary({ habit, dates, getValue }) {
  if (!habit.config?.type) return null;

  const { type, label } = habit.config;
  const vals = dates
    .map(d => getValue(habit._id, d))
    .filter(v => v !== null && v !== undefined && v !== '');

  if (vals.length === 0) return null;

  if (type === 'number' || type === 'time') {
    const nums  = vals.map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    const total = nums.reduce((a, b) => a + b, 0);
    const avg   = (total / nums.length).toFixed(1);
    const unit  = type === 'time' ? 'min' : '';
    return (
      <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 text-xs text-slate-500">
        <span><span className="font-semibold text-slate-700">{avg}{unit}</span> avg {label}</span>
        <span><span className="font-semibold text-slate-700">{total}{unit}</span> total</span>
        <span><span className="font-semibold text-slate-700">{nums.length}</span> entries</span>
      </div>
    );
  }

  if (type === 'text') {
    const last = vals[0]; // dates are newest-first
    return (
      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <span className="font-medium text-slate-400">{label} (latest): </span>
        <span className="text-slate-700 italic">"{last}"</span>
      </div>
    );
  }

  return null;
}

export default function Reports() {
  const { habits, habitsForDate, getStatus, getValue, getStreak, loading } = useHabitsContext();

  if (loading) return <div className="p-4 pt-8"><HabitListSkeleton /></div>;

  if (habits.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-5xl mb-4">📊</p>
        <p className="font-semibold text-slate-600">No data yet</p>
        <p className="text-sm mt-1">Add habits and start tracking to see reports</p>
      </div>
    );
  }

  const dates = Array.from({ length: DAYS }, (_, i) => subDays(new Date(), i));

  return (
    <div className="p-4">
      <div className="pt-4 mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
        <p className="text-slate-400 text-sm mt-1">Last {DAYS} days</p>
      </div>

      <div className="space-y-4">
        {habits.map(habit => {
          const scheduledDates  = dates.filter(d => habitsForDate(d).some(h => h._id === habit._id));
          const completedCount  = scheduledDates.filter(d => {
            const s = getStatus(habit._id, d);
            return s === 'done' || s === 'half_done';
          }).length;
          const rate   = scheduledDates.length === 0 ? 0 : Math.round((completedCount / scheduledDates.length) * 100);
          const streak = getStreak(habit._id);

          return (
            <div key={habit._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              {/* Top row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">{habit.emoji}</span>
                  <span className="font-semibold text-slate-800 truncate">{habit.name}</span>
                </div>
                <div className="flex items-center gap-1 text-orange-500 shrink-0 ml-2">
                  <Flame size={15} />
                  <span className="text-sm font-bold">{streak}</span>
                  <span className="text-xs text-slate-400 font-normal">streak</span>
                </div>
              </div>

              {/* Completion bar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
                </div>
                <span className="text-xs text-slate-500 font-semibold w-9 text-right">{rate}%</span>
              </div>

              {/* Dot grid — newest right */}
              <div className="flex gap-1 flex-row-reverse justify-end">
                {dates.map(d => {
                  const scheduled = habitsForDate(d).some(h => h._id === habit._id);
                  const status    = scheduled ? getStatus(habit._id, d) : null;
                  return (
                    <div
                      key={d.toISOString()}
                      title={`${format(d, 'MMM d')}: ${status ?? 'not scheduled'}`}
                      className={`w-3.5 h-3.5 rounded-sm transition-colors ${status ? STATUS_COLOR[status] : 'bg-slate-50'}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1 px-0.5">
                <span>{format(dates[DAYS - 1], 'MMM d')}</span>
                <span>Today</span>
              </div>

              {/* Value summary */}
              <ValueSummary habit={habit} dates={dates} getValue={getValue} />
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-4 flex-wrap justify-center text-xs text-slate-500 pb-2">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Half done</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Not done</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" /> Not started</span>
      </div>
    </div>
  );
}
