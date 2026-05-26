import { useState, useEffect } from 'react';
import { Play, Square, Moon } from 'lucide-react';
import { elapsedMs, formatHMS, formatDuration } from '../lib/sleepNight';

export default function SleepActiveCard({ active, tonight, onStart, onStop, busy }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsed = active ? elapsedMs(active, now) : 0;
  const tonightTotalMs = tonight?.totalMs ?? 0;
  const tonightLabel = tonight?.nightDate ? formatNightLabel(tonight.nightDate) : '';

  return (
    <section className="mx-4 mt-3 rounded-3xl bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-violet-100 shadow-sm p-5">
      <div className="flex items-center gap-2 text-violet-500 text-xs font-semibold uppercase tracking-wider mb-1">
        <Moon size={14} /> Sleep
      </div>
      {active ? (
        <>
          <div className="text-3xl font-bold tabular-nums text-violet-700 mt-1">{formatHMS(elapsed)}</div>
          <div className="text-xs text-violet-500 mt-1">Started {formatTime(new Date(active.startAt))}</div>
          <button
            disabled={busy}
            onClick={onStop}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-2xl py-3 shadow active:scale-[0.99] transition"
          >
            <Square size={18} fill="currentColor" /> Stop sleep
          </button>
        </>
      ) : (
        <>
          <div className="text-base text-violet-700 font-medium">
            {tonightTotalMs > 0
              ? `${tonightLabel} · ${formatDuration(tonightTotalMs)} so far`
              : 'Tap to start sleeping'}
          </div>
          <button
            disabled={busy}
            onClick={onStart}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold rounded-2xl py-3 shadow active:scale-[0.99] transition"
          >
            <Play size={18} fill="currentColor" /> Start sleep
          </button>
        </>
      )}
    </section>
  );
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatNightLabel(ymd) {
  // ymd: YYYY-MM-DD
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
