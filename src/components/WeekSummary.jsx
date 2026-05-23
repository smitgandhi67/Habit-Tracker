import { startOfWeek } from 'date-fns';
import { useHabitsContext } from '../hooks/useHabits';

function getWeekDates(mondayOffset) {
  const today = new Date();
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  const mon = new Date(thisMonday);
  mon.setDate(mon.getDate() + mondayOffset * 7);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    if (d <= today) dates.push(d);
  }
  return dates;
}

function weekStats(habit, dates, habitsForDate, getStatus) {
  const scheduled = dates.filter(d => habitsForDate(d).some(h => h._id === habit._id));
  const completed = scheduled.filter(d => {
    const s = getStatus(habit._id, d);
    return s === 'done' || s === 'half_done';
  });
  const rate = scheduled.length === 0 ? null : Math.round((completed.length / scheduled.length) * 100);
  return { completed: completed.length, scheduled: scheduled.length, rate };
}

function BarRow({ label, stats, isThis }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isThis ? 'bg-violet-500' : 'bg-slate-300'}`}
          style={{ width: `${stats.rate ?? 0}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 font-semibold w-24 text-right shrink-0">
        {stats.scheduled === 0
          ? '—'
          : `${stats.completed}/${stats.scheduled} (${stats.rate}%)`}
      </span>
    </div>
  );
}

export default function WeekSummary() {
  const { habits, habitsForDate, getStatus } = useHabitsContext();

  const thisWeekDates = getWeekDates(0);
  const lastWeekDates = getWeekDates(-1);

  const habitData = habits
    .map(habit => {
      const thisWeek = weekStats(habit, thisWeekDates, habitsForDate, getStatus);
      const lastWeek = weekStats(habit, lastWeekDates, habitsForDate, getStatus);
      if (thisWeek.scheduled === 0 && lastWeek.scheduled === 0) return null;
      const delta =
        thisWeek.rate !== null && lastWeek.rate !== null
          ? thisWeek.rate - lastWeek.rate
          : null;
      return { habit, thisWeek, lastWeek, delta };
    })
    .filter(Boolean);

  const improved = habitData.filter(d => d.delta !== null && d.delta > 0).length;
  const same     = habitData.filter(d => d.delta === null || d.delta === 0).length;
  const dropped  = habitData.filter(d => d.delta !== null && d.delta < 0).length;

  if (habitData.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-sm">No scheduled habits this week or last week</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm px-1">
        <span className="text-green-600 font-semibold">{improved} improved</span>
        <span className="text-slate-400">{same} same</span>
        {dropped > 0 && <span className="text-red-500 font-semibold">{dropped} dropped</span>}
      </div>

      {habitData.map(({ habit, thisWeek, lastWeek, delta }) => (
        <div key={habit._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl shrink-0">{habit.emoji}</span>
            <span className="font-semibold text-slate-800 truncate">{habit.name}</span>
            {delta !== null && (
              <span
                className={`ml-auto shrink-0 text-sm font-bold ${
                  delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'
                }`}
              >
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '='}{' '}
                {delta !== 0 ? `${Math.abs(delta)}%` : ''}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <BarRow label="This week" stats={thisWeek} isThis={true} />
            <BarRow label="Last week" stats={lastWeek} isThis={false} />
          </div>
        </div>
      ))}
    </div>
  );
}
