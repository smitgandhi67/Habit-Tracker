import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { DOMAINS } from '../lib/capabilities/domains';

// Baseline result (parent view): each domain's score as a bar, foundations marked.
// Day 3 layers the radar + focus-area flagging on top of this same data.
export default function SkillsBaselineResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(location.state?.result || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (result) return;
    let cancelled = false;
    apiFetch(`/api/capabilities/attempts/${id}`)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, [id, result]);

  if (error) {
    return <div className="px-4 py-6"><div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div></div>;
  }
  if (!result) {
    return <div className="px-4 py-6"><div className="bg-white rounded-3xl h-48 animate-pulse border border-slate-100" /></div>;
  }

  // Order rows by the canonical domain numbering; score = dimension (0..1 normalized).
  const dimByKey = Object.fromEntries((result.dimensions || []).map(d => [d.key, d.score]));
  const rows = DOMAINS
    .filter(d => d.key in dimByKey)
    .map(d => ({ ...d, score: dimByKey[d.key] }));

  return (
    <div className="px-4 py-2 pb-10">
      <button onClick={() => navigate('/skills')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
        <ArrowLeft size={16} /> Skills
      </button>

      <h1 className="text-xl font-bold text-slate-800">{result.title}</h1>
      <p className="text-xs text-slate-400 mt-1">
        Snapshot across the ten domains. Higher = stronger right now. Foundations
        ({' '}<Star size={11} className="inline fill-violet-500 text-violet-500" />{' '}) gate the rest.
      </p>

      <div className="mt-5 space-y-3">
        {rows.map(d => (
          <div key={d.key} className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                {d.name}
                {d.foundational && <Star size={12} className="fill-violet-500 text-violet-500" />}
              </span>
              <span className="text-xs tabular-nums text-slate-400">{Math.round(d.score * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${d.foundational ? 'bg-violet-500' : 'bg-sky-400'}`}
                style={{ width: `${Math.round(d.score * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-5 leading-relaxed">
        A self-tracking reflection, <span className="font-medium">not a clinical assessment</span>. The
        radar view and focus areas — plus the parent↔kid comparison — land next.
      </p>
    </div>
  );
}
