import { format } from 'date-fns';
import { Flame, Check, Star } from 'lucide-react';
import { useDecodeProgress, streakFrom } from '../../hooks/useDecodeProgress';

// Streak flame + daily-dose ring + today's points, mirroring the math page's motivational
// header. The ring fills toward the daily goal; a green check marks the dose done for today
// (which the page signals via `caughtUp`, since the real "done" is an empty due-queue).
export default function DecodeStatsHeader({ todayAttempted = 0, goal = 12, caughtUp = false, refreshKey = 0 }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { days } = useDecodeProgress(8, refreshKey);
  const streak = streakFrom(days, today);
  const todayPoints = days.find(d => d.date === today)?.points || 0;

  const pct = goal > 0 ? Math.min(1, todayAttempted / goal) : 0;
  const R = 26, C = 2 * Math.PI * R;
  const done = caughtUp && todayAttempted > 0;

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
      {/* ring */}
      <div className="relative shrink-0" style={{ width: 62, height: 62 }}>
        <svg width="62" height="62" className="-rotate-90">
          <circle cx="31" cy="31" r={R} fill="none" stroke="#eef2ff" strokeWidth="6" />
          <circle
            cx="31" cy="31" r={R} fill="none"
            stroke={done ? '#10b981' : '#6366f1'} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - (done ? 1 : pct))}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {done ? <Check size={22} className="text-emerald-500" />
            : <span className="text-sm font-black text-indigo-600 tabular-nums">{todayAttempted}</span>}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Flame size={17} className={streak > 0 ? 'text-orange-500 fill-orange-400' : 'text-slate-300'} />
          {streak > 0 ? `${streak}-day streak` : 'Start your streak'}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {done ? "Today's dose complete — nice work!" : `${todayAttempted} of ~${goal} today`}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <div className="flex items-center gap-1 font-bold text-violet-600"><Star size={14} className="fill-violet-500 text-violet-500" /> {todayPoints}</div>
        <p className="text-[10px] text-slate-400">today</p>
      </div>
    </div>
  );
}
