import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Target, MessagesSquare } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { DOMAINS } from '../lib/capabilities/domains';
import CapabilityRadar from '../components/CapabilityRadar';

const PARENT_COLOR = '#7c3aed';
const KID_COLOR = '#0ea5e9';
const dimValues = dims => Object.fromEntries((dims || []).map(d => [d.key, d.score]));
const pct = n => `${Math.round(n * 100)}%`;

// Baseline result (parent view): a radar across the 10 domains, the weakest
// foundations called out as focus areas, and — for a parent_baseline — the
// parent↔kid gap overlaid with conversation prompts (a self-awareness chat, not a
// correction). Day 2's per-domain bars stay below as the number→name legend.
export default function SkillsBaselineResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(location.state?.result || null);
  const [gap, setGap] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (result) return;
    let cancelled = false;
    apiFetch(`/api/capabilities/attempts/${id}`)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, [id, result]);

  // Overlay the kid's self-report when this is a parent rating a child.
  useEffect(() => {
    if (!result || result.instrumentKey !== 'parent_baseline' || !result.subjectUserId) return;
    let cancelled = false;
    apiFetch(`/api/capabilities/baseline/gap?childUserId=${result.subjectUserId}`)
      .then(g => { if (!cancelled) setGap(g); })
      .catch(() => { /* gap is optional (e.g. kid hasn't taken it / not authorised) */ });
    return () => { cancelled = true; };
  }, [result]);

  if (error) {
    return <div className="px-4 py-6"><div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div></div>;
  }
  if (!result) {
    return <div className="px-4 py-6"><div className="bg-white rounded-3xl h-48 animate-pulse border border-slate-100" /></div>;
  }

  const isParent = result.instrumentKey === 'parent_baseline';
  const dimByKey = dimValues(result.dimensions);
  const rows = DOMAINS.filter(d => d.key in dimByKey).map(d => ({ ...d, score: dimByKey[d.key] }));

  const series = [{ key: 'primary', label: isParent ? 'You' : 'Kid', color: PARENT_COLOR, values: dimByKey }];
  if (gap?.child?.hasData) {
    series.push({ key: 'kid', label: 'Your child', color: KID_COLOR, values: dimValues(gap.child.dimensions) });
  }

  const targets = result.targets || [];
  const divergences = (gap?.gap || []).filter(g => g.alignment !== 'aligned');
  const domainName = key => DOMAINS.find(d => d.key === key)?.name || key;

  return (
    <div className="px-4 py-2 pb-10">
      <button onClick={() => navigate('/skills')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
        <ArrowLeft size={16} /> Skills
      </button>

      <h1 className="text-xl font-bold text-slate-800">{result.title}</h1>
      <p className="text-xs text-slate-400 mt-1">
        Each axis is one domain (numbered below). Further out = stronger right now.
        Foundations ({' '}<Star size={11} className="inline fill-violet-500 text-violet-500" />{' '}) gate the rest.
      </p>

      <div className="mt-4 bg-white rounded-3xl border border-slate-100 p-4 shadow-sm">
        <CapabilityRadar domains={DOMAINS} series={series} />
      </div>

      {/* Focus areas (weakest foundations first) */}
      <div className="mt-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
          <Target size={15} className="text-violet-600" /> Focus areas
        </h2>
        {targets.length ? (
          <ul className="space-y-2">
            {targets.map(t => (
              <li key={t.key} className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                <span className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-violet-800 flex items-center gap-1.5">
                    {t.name}
                    {t.foundational && <Star size={11} className="fill-violet-500 text-violet-500" />}
                  </span>
                  <span className="text-xs tabular-nums text-violet-500">{pct(t.score)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 rounded-2xl border border-slate-100 bg-white px-4 py-3">
            Foundations look solid — keep pairing real reps with real stakes, and re-check in ~3 months.
          </p>
        )}
      </div>

      {/* Parent↔kid divergences — a conversation, not a correction */}
      {isParent && divergences.length > 0 && (
        <div className="mt-5">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
            <MessagesSquare size={15} className="text-sky-600" /> Worth talking about
          </h2>
          <p className="text-xs text-slate-400 mb-2">
            Where you and your child see things differently — a chance to ask them, not to correct them.
          </p>
          <ul className="space-y-2">
            {divergences.map(g => (
              <li key={g.key} className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <span className="block text-sm font-semibold text-sky-800">{domainName(g.key)}</span>
                <span className="block text-xs text-sky-700/80 mt-0.5">
                  You: {pct(g.parent)} · Them: {pct(g.child)}
                  {g.delta > 0 ? ' — they feel less sure here than you do.' : ' — they feel stronger here than you rated.'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-domain detail + number legend */}
      <div className="mt-5">
        <h2 className="text-sm font-bold text-slate-700 mb-2">All domains</h2>
        <div className="space-y-2">
          {rows.map(d => (
            <div key={d.key} className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-300 tabular-nums w-4">{d.num}</span>
                  {d.name}
                  {d.foundational && <Star size={12} className="fill-violet-500 text-violet-500" />}
                </span>
                <span className="text-xs tabular-nums text-slate-400">{pct(d.score)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.foundational ? 'bg-violet-500' : 'bg-sky-400'}`}
                  style={{ width: `${pct(d.score)}` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-5 leading-relaxed">
        A self-tracking reflection, <span className="font-medium">not a clinical assessment</span>.
        Re-take in about three months to see what moved.
      </p>
    </div>
  );
}
