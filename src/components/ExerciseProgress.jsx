import { useState, useEffect, useMemo } from 'react';
import { useGym, BODY_PARTS } from '../hooks/useGym';
import { useAuth } from '../context/AuthContext';
import {
  summarize, averagePct, formatPct, pctTone,
  sortByWeightPctDesc, PERIOD_OPTIONS, periodForKey,
} from '../lib/progress';

const LS_KEY = (userId) => `gym:progressPeriod:${userId || 'anon'}`;

function bodyPartLabel(key) { return BODY_PARTS.find(b => b.key === key)?.label ?? key; }
function bodyPartEmoji(key) { return BODY_PARTS.find(b => b.key === key)?.emoji ?? ''; }

function SessionBar({ count, max }) {
  const pct = max > 0 ? Math.max(0.08, count / max) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold text-slate-700 tabular-nums w-5 text-right">{count}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-violet-300 rounded-full" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

export default function ExerciseProgress() {
  const { user } = useAuth() || {};
  const { fetchProgress } = useGym();

  const [periodKey, setPeriodKey] = useState(() => {
    if (typeof window === 'undefined') return '1mo';
    return window.localStorage.getItem(LS_KEY(user?._id)) || '1mo';
  });
  const period = periodForKey(periodKey);

  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      fetchProgress(period.weeks).then(d => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      });
    });
    return () => { cancelled = true; };
  }, [period.weeks, fetchProgress]);

  function selectPeriod(key) {
    setPeriodKey(key);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY(user?._id), key);
    }
  }

  const rows = useMemo(() => {
    const enriched = (data || []).map(ex => ({
      exerciseName: ex.exerciseName,
      bodyPart:     ex.bodyPart,
      ...summarize(ex.weeks),
    }));
    return sortByWeightPctDesc(enriched);
  }, [data]);

  const maxSessions = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.sessions || 0), 0),
    [rows],
  );

  const overall = useMemo(() => ({
    weight: averagePct(rows.map(r => r.weightPct)),
    volume: averagePct(rows.map(r => r.volumePct)),
    tracked: rows.filter(r => r.sessions > 0).length,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {PERIOD_OPTIONS.map(p => (
          <button
            key={p.key}
            onClick={() => selectPeriod(p.key)}
            className={`flex-1 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
              periodKey === p.key
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <SummaryCard overall={overall} period={period} />

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📈</p>
          <p className="text-slate-500 text-sm">No exercise history yet</p>
          <p className="text-slate-400 text-xs mt-1">Log exercises to see growth trends</p>
        </div>
      ) : (
        <ProgressTable rows={rows} maxSessions={maxSessions} />
      )}
    </div>
  );
}

function SummaryCard({ overall, period }) {
  const weightTone = pctTone(overall.weight);
  const volumeTone = pctTone(overall.volume);
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Avg weight"  value={formatPct(overall.weight)}  tone={weightTone.text} />
        <Stat label="Avg volume"  value={formatPct(overall.volume)}  tone={volumeTone.text} />
      </div>
      <p className="text-xs text-slate-400 mt-3">
        over last {period.weeks} weeks · {overall.tracked} {overall.tracked === 1 ? 'exercise' : 'exercises'} tracked
      </p>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function ProgressTable({ rows, maxSessions }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="grid grid-cols-[1fr_64px_64px_64px] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Exercise</span>
        <span className="text-right">Sets</span>
        <span className="text-right">Wt Δ%</span>
        <span className="text-right">Vol Δ%</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map(r => {
          const wTone = pctTone(r.weightPct);
          const vTone = pctTone(r.volumePct);
          return (
            <li
              key={r.exerciseName}
              className={`grid grid-cols-[1fr_64px_64px_64px] gap-2 px-4 py-2.5 items-center border-l-4 ${wTone.border}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate leading-tight">{r.exerciseName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {bodyPartEmoji(r.bodyPart)} {bodyPartLabel(r.bodyPart)}
                </p>
              </div>
              <SessionBar count={r.sessions} max={maxSessions} />
              <span className={`text-sm font-semibold tabular-nums text-right ${wTone.text}`}>{formatPct(r.weightPct)}</span>
              <span className={`text-sm font-semibold tabular-nums text-right ${vTone.text}`}>{formatPct(r.volumePct)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
