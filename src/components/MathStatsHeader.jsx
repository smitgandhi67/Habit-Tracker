import { format, subDays } from 'date-fns';
import { Flame } from 'lucide-react';
import { useMathProgress } from '../hooks/useMathProgress';

// Lifetime-points rank ladder. Thresholds are on points EARNED (not spendable balance),
// so redeeming rewards never demotes a kid.
const RANKS = [
  { name: 'Rookie',   min: 0,    emoji: '🌱' },
  { name: 'Bronze',   min: 150,  emoji: '🥉' },
  { name: 'Silver',   min: 400,  emoji: '🥈' },
  { name: 'Gold',     min: 900,  emoji: '🥇' },
  { name: 'Platinum', min: 1800, emoji: '💎' },
  { name: 'Diamond',  min: 3200, emoji: '🔷' },
  { name: 'Master',   min: 5500, emoji: '👑' },
];

function rankFor(points) {
  let cur = RANKS[0], next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (points >= RANKS[i].min) { cur = RANKS[i]; next = RANKS[i + 1] || null; }
  }
  const progress = next ? (points - cur.min) / (next.min - cur.min) : 1;
  return { cur, next, progress: Math.max(0, Math.min(1, progress)) };
}

// Consecutive days (ending today, with a one-day grace) that had ≥1 correct answer.
// `todayCorrect` is the live session count so the streak reflects today immediately,
// before the daily stat has flushed to the server.
function computeStreak(days, todayCorrect) {
  const byDate = new Map(days.map(d => [d.date, d.correct || 0]));
  const iso = d => format(d, 'yyyy-MM-dd');
  const todayIso = iso(new Date());
  const activeOn = (isoDate) =>
    (byDate.get(isoDate) || 0) > 0 || (isoDate === todayIso && todayCorrect > 0);

  let cursor = new Date();
  if (!activeOn(todayIso)) cursor = subDays(cursor, 1); // grace: today not done yet
  let streak = 0;
  while (activeOn(iso(cursor))) { streak++; cursor = subDays(cursor, 1); }
  return streak;
}

// SVG progress ring for today's correct-answer goal.
function GoalRing({ value, goal }) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const r = 34, c = 2 * Math.PI * r;
  const met = value >= goal;
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="white" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-2xl font-extrabold">{value}</span>
        <span className="text-[11px] text-white/80">/ {goal}{met ? ' ✓' : ''}</span>
      </div>
    </div>
  );
}

export default function MathStatsHeader({ todayCorrect, goal, lifetimePoints }) {
  const { days } = useMathProgress(8);
  const streak = computeStreak(days, todayCorrect);
  const { cur, next, progress } = rankFor(lifetimePoints || 0);

  return (
    <div className="rounded-3xl p-5 mb-4 text-white shadow-md bg-gradient-to-br from-violet-500 via-violet-500 to-fuchsia-500">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center w-20">
          <div className="flex items-center gap-1 text-3xl font-extrabold">
            <Flame className={streak > 0 ? 'text-amber-300' : 'text-white/50'} /> {streak}
          </div>
          <span className="text-[11px] text-white/80 mt-0.5">day streak</span>
        </div>

        <GoalRing value={todayCorrect} goal={goal} />

        <div className="flex flex-col items-center w-20">
          <span className="text-3xl leading-none">{cur.emoji}</span>
          <span className="text-xs font-bold mt-1">{cur.name}</span>
        </div>
      </div>

      {/* Rank progress toward the next tier */}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-white/85 mb-1">
          <span>Rank: {cur.name}</span>
          <span>{next ? `${lifetimePoints} / ${next.min} → ${next.name}` : 'Max rank! 👑'}</span>
        </div>
        <div className="h-2 bg-white/25 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
