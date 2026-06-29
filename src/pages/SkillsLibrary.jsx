import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Compass, Star, Ban } from 'lucide-react';
import { listActivities } from '../lib/capabilities/activities';
import { DOMAINS, getDomain } from '../lib/capabilities/domains';

const TIER_LABEL = { 1: 'Tier 1 · do these', 2: 'Tier 2 · strong, high-value', 3: 'Tier 3 · for their own sake' };
const STRENGTH_STYLE = {
  VERIFIED: 'bg-emerald-50 text-emerald-700',
  KNOWN: 'bg-amber-50 text-amber-700',
};

function DomainTags({ keys }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
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

function ageLabel(a) {
  if (a.minAge == null && a.maxAge == null) return null;
  if (a.minAge != null && a.maxAge == null) return `Best from age ${a.minAge}`;
  if (a.minAge == null && a.maxAge != null) return `Up to age ${a.maxAge}`;
  return `Ages ${a.minAge}–${a.maxAge}`;
}

function ActivityCard({ a }) {
  const isSkip = a.kind === 'skip';
  const age = ageLabel(a);
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${isSkip ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-800 text-sm">{a.title}</p>
        {a.citation && (
          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STRENGTH_STYLE[a.citation.strength] || 'bg-slate-100 text-slate-500'}`}>
            {a.citation.strength}
          </span>
        )}
      </div>
      <DomainTags keys={a.domainKeys} />

      {isSkip ? (
        <p className="mt-2 text-xs text-slate-600 flex gap-1.5">
          <Ban size={14} className="text-slate-400 shrink-0 mt-px" />
          {a.skipReason}
        </p>
      ) : (
        <div className="mt-2 rounded-xl bg-violet-50/70 border border-violet-100 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-0.5">How to run it</p>
          <p className="text-xs text-violet-900/90 leading-relaxed">{a.approachRule}</p>
        </div>
      )}

      {a.why && <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">Why: {a.why}</p>}
      {age && <p className="mt-1 text-[11px] text-slate-400">{age}</p>}
    </div>
  );
}

export default function SkillsLibrary() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listActivities({ domain: domain || undefined })
      .then(list => { if (!cancelled) { setActivities(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [domain]);

  const doItems = activities.filter(a => a.kind !== 'skip');
  const skipItems = activities.filter(a => a.kind === 'skip');
  const tiers = [1, 2, 3].map(t => ({ tier: t, items: doItems.filter(a => a.tier === t) })).filter(g => g.items.length);

  return (
    <div className="px-4 pb-12 pt-4">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/skills" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </Link>
        <Compass size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">Activity library</h1>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Filtered by evidence, not popularity. The <span className="font-medium text-violet-600">how to run it</span> note
        is what turns an activity into a skill.
      </p>

      {/* Domain filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        <button
          onClick={() => setDomain('')}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            domain === '' ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          All
        </button>
        {DOMAINS.map(d => (
          <button
            key={d.key}
            onClick={() => setDomain(d.key)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1 ${
              domain === d.key ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {d.foundational && <Star size={10} className={domain === d.key ? 'fill-white text-white' : 'fill-violet-400 text-violet-400'} />}
            {d.short}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4 mt-3">{error}</div>}

      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading…</div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-8 text-center">
          No activities yet. (Run the seed: <code>node server/scripts/seedCapabilityActivities.js</code>)
        </p>
      ) : (
        <div className="mt-2 space-y-6">
          {tiers.map(g => (
            <section key={g.tier}>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{TIER_LABEL[g.tier]}</h2>
              <div className="space-y-3">
                {g.items.map(a => <ActivityCard key={a.slug} a={a} />)}
              </div>
            </section>
          ))}

          {skipItems.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Skip / deprioritize</h2>
              <div className="space-y-3">
                {skipItems.map(a => <ActivityCard key={a.slug} a={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
