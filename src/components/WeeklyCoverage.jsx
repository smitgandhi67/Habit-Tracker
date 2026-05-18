import { format, startOfWeek, addDays, isToday, isFuture } from 'date-fns';
import { BODY_PARTS } from '../hooks/useGym';

const ALL_KEYS = BODY_PARTS.map(b => b.key);

export default function WeeklyCoverage({ weekData, referenceDate }) {
  const mon  = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));

  // Build map: date → Set of body parts trained
  const dayMap = {};
  days.forEach(d => { dayMap[format(d, 'yyyy-MM-dd')] = new Set(); });
  weekData.forEach(e => {
    if (dayMap[e.date]) dayMap[e.date].add(e.bodyPart);
  });

  // Which body parts done this week total
  const doneThisWeek = new Set(weekData.map(e => e.bodyPart));
  const pending      = ALL_KEYS.filter(k => !doneThisWeek.has(k));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">This week</p>

      {/* Day strip */}
      <div className="flex gap-1 mb-4">
        {days.map(d => {
          const key    = format(d, 'yyyy-MM-dd');
          const parts  = dayMap[key];
          const today  = isToday(d);
          const future = isFuture(d) && !today;
          const hasParts = parts.size > 0;

          return (
            <div key={key} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-xs font-medium ${today ? 'text-violet-600' : 'text-slate-400'}`}>
                {format(d, 'EEE')[0]}
              </span>
              <div
                className={`w-full rounded-lg flex items-center justify-center text-xs font-bold transition-colors
                  ${today        ? 'ring-2 ring-violet-400' : ''}
                  ${hasParts     ? 'bg-green-500 text-white' : future ? 'bg-slate-100 text-slate-300' : 'bg-slate-200 text-slate-400'}
                `}
                style={{ height: 32 }}
                title={hasParts ? [...parts].map(k => BODY_PARTS.find(b => b.key === k)?.label).join(', ') : format(d, 'MMM d')}
              >
                {hasParts ? parts.size : format(d, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body part chips */}
      <div className="flex flex-wrap gap-1.5">
        {BODY_PARTS.map(({ key, label }) => {
          const done = doneThisWeek.has(key);
          return (
            <span
              key={key}
              className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                done
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {done ? '✓ ' : ''}{label}
            </span>
          );
        })}
      </div>

      {pending.length === 0 && (
        <p className="text-xs text-green-600 font-semibold mt-2">🎉 All body parts covered this week!</p>
      )}
    </div>
  );
}
