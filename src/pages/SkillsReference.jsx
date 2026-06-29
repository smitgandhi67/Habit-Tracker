import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, BookOpen, ShieldCheck, AlertTriangle, HelpCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { CITATIONS as FALLBACK_CITATIONS } from '../lib/capabilities/citations';
import { getDomain } from '../lib/capabilities/domains';

// One badge per evidence strength. MIXED and KNOWN never read as settled fact.
const STRENGTH = {
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700', Icon: ShieldCheck },
  MIXED: { label: 'Contested', cls: 'bg-amber-50 text-amber-700', Icon: AlertTriangle },
  KNOWN: { label: 'Unverified', cls: 'bg-slate-100 text-slate-500', Icon: HelpCircle },
};

function StrengthBadge({ strength }) {
  const s = STRENGTH[strength] || STRENGTH.KNOWN;
  const { Icon } = s;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.cls}`}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

function DomainChips({ keys }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {keys.map(k => {
        const d = getDomain(k);
        if (!d) return null;
        return (
          <span
            key={k}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              d.foundational ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {d.short}
          </span>
        );
      })}
    </div>
  );
}

// The "why" behind the module — every evidence anchor, with an honest strength
// badge and the re-verification note (handover §4 + §10.5). Two principles made
// visible: nothing surfaces as fact until it's source-checked (no KNOWN here), and
// replication-contested claims are labelled Contested rather than quietly dropped.
export default function SkillsReference() {
  const [citations, setCitations] = useState(FALLBACK_CITATIONS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/capabilities/citations')
      .then(d => { if (!cancelled && Array.isArray(d?.citations)) setCitations(d.citations); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 pb-12 pt-4">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/skills" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </Link>
        <BookOpen size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">The evidence</h1>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Every claim this module makes, with its source and how strong it is. Re-checked Jun 2026 —
        nothing here is presented as fact until it's been source-checked.
      </p>

      {/* Strength legend */}
      <div className="flex flex-wrap gap-2 mb-4 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-600" /> Verified — source-checked</span>
        <span className="inline-flex items-center gap-1"><AlertTriangle size={12} className="text-amber-600" /> Contested — real source, shaky/contested effect</span>
      </div>

      {error && <p className="text-xs text-amber-600 mb-3">Showing built-in list (couldn’t reach server: {error}).</p>}

      <div className="space-y-3">
        {citations.map(c => (
          <div key={c.key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{c.cite}</p>
              <StrengthBadge strength={c.strength} />
            </div>
            <DomainChips keys={c.domainKeys || []} />
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">{c.finding}</p>
            {c.verifyNote && (
              <p className={`mt-2 text-[11px] leading-relaxed rounded-xl px-3 py-2 ${
                c.strength === 'MIXED' ? 'bg-amber-50/70 text-amber-800' : 'bg-slate-50 text-slate-500'
              }`}>
                {c.verifyNote}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
        Strength reflects the evidence, not how useful the activity is. A Contested anchor doesn’t mean
        “don’t do it” — it means don’t do it <span className="font-medium">for that promised effect</span>.
      </p>
    </div>
  );
}
