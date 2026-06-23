import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { apiFetch } from '../lib/api';
import SubscaleBars from '../components/SubscaleBars';
import { styleInfo, PARENTING_DISCLAIMER } from '../lib/parenting/bands';

const STYLE_TINT = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  sky: 'bg-sky-50 border-sky-200 text-sky-800',
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
  violet: 'bg-violet-50 border-violet-200 text-violet-800',
};

const SCALE_LABELS = {
  authoritative: 'Authoritative',
  authoritarian: 'Authoritarian',
  permissive: 'Permissive',
};

export default function ParentingResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(location.state?.result || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (result) return;
    let cancelled = false;
    apiFetch(`/api/parenting/attempts/${id}`)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, [id, result]);

  if (error) return <div className="px-4 py-6"><div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div></div>;
  if (!result) return <div className="px-4 py-6"><div className="bg-white rounded-3xl h-40 animate-pulse border border-slate-100" /></div>;

  const style = result.interpretation?.styleKey ? styleInfo(result.interpretation.styleKey) : null;
  const scales = result.interpretation?.bands?.scales || null;
  const max = 5;

  return (
    <div className="px-4 py-2 pb-10">
      <button onClick={() => navigate('/parenting')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft size={16} /> Parenting
      </button>

      <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{result.title}</p>

      {style && (
        <div className={`mt-2 rounded-3xl p-5 border ${STYLE_TINT[style.color] || STYLE_TINT.violet}`}>
          <p className="text-xs font-semibold opacity-70">Your predominant style</p>
          <h1 className="text-2xl font-bold mt-0.5">{style.label}</h1>
          <p className="text-sm mt-1 opacity-90">{style.summary}</p>
        </div>
      )}

      {scales && (
        <div className="mt-5 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Style scores</h2>
          <div className="space-y-3">
            {Object.entries(scales).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{SCALE_LABELS[k] || k}</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{v.toFixed(2)} <span className="text-slate-300 font-normal">/ {max}</span></span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(v / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.subscales?.length > 0 && (
        <div className="mt-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Full breakdown</h2>
          <p className="text-xs text-slate-400 mb-3">Seven parenting facets behind your style.</p>
          <SubscaleBars subscales={result.subscales} max={max} />
        </div>
      )}

      {style && (style.research || style.grow) && (
        <div className="mt-4 bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
          {style.research && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">What the research says</h3>
              <p className="text-sm text-slate-600 mt-1">{style.research}</p>
            </div>
          )}
          {style.grow && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Where to grow</h3>
              <p className="text-sm text-slate-600 mt-1">{style.grow}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <Link to={`/parenting/quiz/${result.instrumentKey}`} className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-violet-300">
          <RefreshCw size={15} /> Retake
        </Link>
        <Link to="/parenting" className="flex-1 flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
          Done
        </Link>
      </div>

      {result.source && <p className="text-[11px] text-slate-400 mt-5">Instrument: {result.source}</p>}
      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{PARENTING_DISCLAIMER}</p>
    </div>
  );
}
