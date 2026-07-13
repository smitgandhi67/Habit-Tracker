import { format, subDays } from 'date-fns';
import { useDecodeProgress } from '../../hooks/useDecodeProgress';

// Last-7-days bar chart of decoding activity (attempts/day), mirroring the math week chart.
export default function WeekChart({ refreshKey = 0 }) {
  const { days } = useDecodeProgress(8, refreshKey);
  const byDate = new Map(days.map(d => [d.date, d]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const ds = format(day, 'yyyy-MM-dd');
    return { ds, label: format(day, 'EEEEE'), attempted: byDate.get(ds)?.attempted || 0 };
  });
  const max = Math.max(1, ...week.map(d => d.attempted));

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">This week</div>
      <div className="flex items-end justify-between gap-1.5 h-20">
        {week.map((d, i) => (
          <div key={d.ds} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: 56 }}>
              <div
                className={`w-full rounded-t-md ${d.attempted > 0 ? 'bg-gradient-to-t from-indigo-400 to-violet-400' : 'bg-slate-100'}`}
                style={{ height: `${Math.max(6, (d.attempted / max) * 56)}px` }}
                title={`${d.attempted} on ${d.ds}`}
              />
            </div>
            <span className={`text-[10px] ${i === 6 ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
