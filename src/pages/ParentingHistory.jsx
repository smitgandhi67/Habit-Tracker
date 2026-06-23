import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useParentingResults } from '../hooks/useParentingResults';
import AttemptList from '../components/AttemptList';

// Pull a single trend metric per attempt so re-takes can be charted over time.
// Parenting Scale -> overall total (higher = more dysfunctional). Style -> warmth
// dimension (higher = warmer). Falls back gracefully if neither is present.
function metricFor(item) {
  if (item.total != null) return { value: item.total, max: 7, higherIsBetter: false };
  const warmth = (item.dimensions || []).find(d => d.key === 'warmth');
  if (warmth) return { value: warmth.score, max: 1, higherIsBetter: true };
  return null;
}

function Trend({ items }) {
  // oldest -> newest, left to right
  const series = [...items].reverse().map(metricFor);
  if (series.some(s => s == null) || series.length < 2) return null;
  return (
    <div className="flex items-end gap-1 h-20 mt-1">
      {series.map((s, i) => {
        const pct = Math.max(6, Math.min(100, (s.value / s.max) * 100));
        return (
          <div
            key={i}
            className={`flex-1 rounded-t ${s.higherIsBetter ? 'bg-emerald-400' : 'bg-amber-400'}`}
            style={{ height: `${pct}%` }}
            title={s.value.toFixed(2)}
          />
        );
      })}
    </div>
  );
}

export default function ParentingHistory() {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/parenting/instruments')
      .then(list => {
        if (cancelled) return;
        const parentOnes = list.filter(i => i.audience !== 'child');
        setInstruments(parentOnes);
        if (parentOnes.length) setActive(parentOnes[0].key);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { items, hasMore, loadMore, loading, error } = useParentingResults(active);

  return (
    <div className="px-4 py-2">
      <button onClick={() => navigate('/parenting')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft size={16} /> Parenting
      </button>
      <h1 className="text-xl font-bold text-slate-800 mb-3">Your history</h1>

      {instruments.length > 1 && (
        <div className="flex gap-2 mb-4">
          {instruments.map(inst => (
            <button
              key={inst.key}
              onClick={() => setActive(inst.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active === inst.key ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {inst.title}
            </button>
          ))}
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div>}

      {!error && !loading && items.length >= 2 && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-4">
          <p className="text-xs text-slate-400 mb-1">Trend over time (oldest → newest)</p>
          <Trend items={items} />
        </div>
      )}

      {loading
        ? <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="bg-white rounded-2xl h-14 animate-pulse border border-slate-100" />)}</div>
        : <AttemptList items={items} hasMore={hasMore} onLoadMore={loadMore} />}
    </div>
  );
}
