import { useState, useEffect } from 'react';
import { useGym, BODY_PARTS } from '../hooks/useGym';

function bodyPartLabel(key) {
  return BODY_PARTS.find(b => b.key === key)?.label ?? key;
}

function bodyPartEmoji(key) {
  return BODY_PARTS.find(b => b.key === key)?.emoji ?? '';
}

function Sparkline({ data, color = '#7c3aed', width = 80, height = 28 }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 6) - 3;
    return [x, y];
  });
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={max <= 1 ? 0.25 : 1}
      />
      {pts.map(([x, y], i) =>
        data[i] > 0 ? (
          <circle key={i} cx={x} cy={y} r="2" fill={color} opacity={max <= 1 ? 0.25 : 1} />
        ) : null
      )}
    </svg>
  );
}

function DeltaLabel({ current, first }) {
  if (current === 0 && first === 0) return null;
  if (first === 0) return null;
  const diff = current - first;
  if (diff === 0) return <span className="text-xs text-slate-400 ml-1">no change</span>;
  return (
    <span className={`text-xs ml-1 ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  );
}

function ExerciseCard({ ex }) {
  const weights = ex.weeks.map(w => w.maxWeight);
  const volumes = ex.weeks.map(w => w.totalVolume);

  const currentWeight = [...weights].reverse().find(v => v > 0) ?? 0;
  const firstWeight   = weights.find(v => v > 0) ?? 0;
  const currentVol    = [...volumes].reverse().find(v => v > 0) ?? 0;
  const firstVol      = volumes.find(v => v > 0) ?? 0;

  const hasWeight = weights.some(v => v > 0);
  const hasVolume = volumes.some(v => v > 0);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <p className="font-semibold text-slate-800 mb-3">{ex.exerciseName}</p>

      {hasWeight && (
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs text-slate-400 w-20 shrink-0">Max weight</span>
          <Sparkline data={weights} color="#7c3aed" />
          <div className="ml-auto flex items-baseline">
            <span className="text-sm font-bold text-slate-700">{currentWeight}kg</span>
            <DeltaLabel current={currentWeight} first={firstWeight} />
          </div>
        </div>
      )}

      {hasVolume && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-20 shrink-0">Volume</span>
          <Sparkline data={volumes} color="#94a3b8" />
          <div className="ml-auto flex items-baseline">
            <span className="text-sm font-bold text-slate-700">{currentVol}</span>
            <span className="text-xs text-slate-400 ml-0.5">kg</span>
            <DeltaLabel current={currentVol} first={firstVol} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExerciseProgress() {
  const { fetchProgress } = useGym();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress(12).then(d => {
      setData(d);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📈</p>
        <p className="text-slate-500 text-sm">No exercise history yet</p>
        <p className="text-slate-400 text-xs mt-1">Log exercises to see strength trends</p>
      </div>
    );
  }

  const grouped = data.reduce((acc, ex) => {
    if (!acc[ex.bodyPart]) acc[ex.bodyPart] = [];
    acc[ex.bodyPart].push(ex);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400 px-1">Last 12 weeks · sparklines show weekly trend</p>
      {Object.entries(grouped).map(([bp, exercises]) => (
        <div key={bp}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>{bodyPartEmoji(bp)}</span>
            {bodyPartLabel(bp)}
          </p>
          <div className="space-y-3">
            {exercises.map(ex => (
              <ExerciseCard key={ex.exerciseName} ex={ex} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
