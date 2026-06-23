import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import SubscaleBars from '../components/SubscaleBars';
import { styleInfo, SCALE_FACTORS, AXIS_INFO, PARENTING_DISCLAIMER } from '../lib/parenting/bands';

const STYLE_TINT = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  sky: 'bg-sky-50 border-sky-200 text-sky-800',
  slate: 'bg-slate-50 border-slate-200 text-slate-700',
  violet: 'bg-violet-50 border-violet-200 text-violet-800',
};

const SCALE_LABELS = { authoritative: 'Authoritative', authoritarian: 'Authoritarian', permissive: 'Permissive' };

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-3xl p-5 shadow-sm border border-slate-100 ${className}`}>{children}</div>;
}

// Simple value bar with an optional cut-off marker.
function ScoreBar({ value, max, cutoff, tint = 'bg-violet-500' }) {
  return (
    <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${tint}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      {cutoff != null && (
        <div className="absolute top-0 bottom-0 w-px bg-slate-400/70" style={{ left: `${(cutoff / max) * 100}%` }} title={`Reflection threshold ${cutoff}`} />
      )}
    </div>
  );
}

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

  const max = result.responseMax || 5;
  const interp = result.interpretation || {};
  const isStyle = !!interp.styleKey;
  const isScale = !isStyle && !!interp.bands?.factors;
  // Axis instruments (e.g. Strictness & Pressure): no typology, no factor bands —
  // rendered from their normalized dimensions using AXIS_INFO meanings.
  const axisDims = (result.dimensions || []).filter(d => AXIS_INFO[d.key]);
  const isAxis = !isStyle && !isScale && axisDims.length > 0;
  const visibleSubscales = (result.subscales || []).filter(s => !s.hidden);

  // concern = a healthy-low axis sitting high, or a healthy-high axis sitting low.
  const axisConcern = (key, score) => {
    const a = AXIS_INFO[key];
    if (!a || a.adaptive === 'context') return false;
    return a.adaptive === 'low' ? score >= 0.5 : score < 0.5;
  };

  const style = isStyle ? styleInfo(interp.styleKey) : null;
  const scales = interp.bands?.scales || null;

  return (
    <div className="px-4 py-2 pb-10">
      <button onClick={() => navigate('/parenting')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft size={16} /> Parenting
      </button>
      <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{result.title}</p>

      {/* STYLE typology header */}
      {isStyle && style && (
        <div className={`mt-2 rounded-3xl p-5 border ${STYLE_TINT[style.color] || STYLE_TINT.violet}`}>
          <p className="text-xs font-semibold opacity-70">Your predominant style</p>
          <h1 className="text-2xl font-bold mt-0.5">{style.label}</h1>
          <p className="text-sm mt-1 opacity-90">{style.summary}</p>
        </div>
      )}

      {/* SCALE discipline-profile header */}
      {isScale && (
        <div className={`mt-2 rounded-3xl p-5 border ${interp.bands.flags.total ? STYLE_TINT.amber : STYLE_TINT.emerald}`}>
          <div className="flex items-center gap-2">
            {interp.bands.flags.total ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <p className="text-sm font-semibold">{interp.bands.summary}</p>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Overall discipline score</span>
              <span className="font-semibold tabular-nums">{interp.bands.total.toFixed(2)} / {max}</span>
            </div>
            <ScoreBar value={interp.bands.total} max={max} cutoff={interp.bands.cutoffs.total} tint={interp.bands.flags.total ? 'bg-amber-400' : 'bg-emerald-500'} />
            <p className="text-[11px] opacity-70 mt-1">Marker = reflection threshold ({interp.bands.cutoffs.total}). Higher means more dysfunctional discipline.</p>
          </div>
        </div>
      )}

      {/* STYLE: three style scores */}
      {isStyle && scales && (
        <Card className="mt-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Style scores</h2>
          <div className="space-y-3">
            {Object.entries(scales).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{SCALE_LABELS[k] || k}</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{v.toFixed(2)} <span className="text-slate-300 font-normal">/ {max}</span></span>
                </div>
                <ScoreBar value={v} max={max} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SCALE: per-factor cards with cut-off + tips */}
      {isScale && (
        <div className="mt-4 space-y-3">
          {['laxness', 'overreactivity', 'hostility'].map(k => {
            const v = interp.bands.factors[k];
            const elevated = interp.bands.flags[k];
            const info = SCALE_FACTORS[k];
            if (v == null) return null;
            return (
              <Card key={k}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-semibold text-slate-700">{info.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">{v.toFixed(2)} <span className="text-slate-300 font-normal">/ {max}</span></span>
                </div>
                <ScoreBar value={v} max={max} cutoff={interp.bands.cutoffs[k]} tint={elevated ? 'bg-amber-400' : 'bg-emerald-500'} />
                <p className="text-xs text-slate-500 mt-2">{info.high}</p>
                {elevated && <p className="text-xs text-amber-700 mt-1.5"><strong>Where to grow:</strong> {info.grow}</p>}
              </Card>
            );
          })}
        </div>
      )}

      {/* AXIS instrument (Strictness & Pressure) */}
      {isAxis && (
        <>
          <div className={`mt-2 rounded-3xl p-5 border ${interp.bands?.concerns?.length ? STYLE_TINT.amber : STYLE_TINT.emerald}`}>
            <div className="flex items-center gap-2">
              {interp.bands?.concerns?.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              <p className="text-sm font-semibold">{interp.bands?.summary}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {axisDims.map(d => {
              const info = AXIS_INFO[d.key];
              const concern = axisConcern(d.key, d.score);
              const tint = info.adaptive === 'context' ? 'bg-sky-500' : concern ? 'bg-rose-400' : 'bg-emerald-500';
              const tip = concern ? (info.highTip || info.lowTip) : null;
              return (
                <Card key={d.key}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-semibold text-slate-700">{info.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-700">{Math.round(d.score * 100)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${tint}`} style={{ width: `${Math.round(d.score * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{info.meaning}</p>
                  {tip && <p className="text-xs text-rose-700 mt-1.5"><strong>Try:</strong> {tip}</p>}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* STYLE: facet breakdown */}
      {isStyle && visibleSubscales.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Full breakdown</h2>
          <p className="text-xs text-slate-400 mb-3">Seven parenting facets behind your style.</p>
          <SubscaleBars subscales={visibleSubscales} max={max} />
        </Card>
      )}

      {/* STYLE: research + grow */}
      {isStyle && style && (style.research || style.grow) && (
        <Card className="mt-4 space-y-3">
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
        </Card>
      )}

      <div className="mt-5 flex gap-3">
        <Link to={`/parenting/quiz/${result.instrumentKey}`} className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-violet-300">
          <RefreshCw size={15} /> Retake
        </Link>
        <Link to="/parenting/history" className="flex-1 flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-violet-300">
          History
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
