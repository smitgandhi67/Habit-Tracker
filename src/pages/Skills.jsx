import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Brain, Star, ClipboardList, Smile } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DOMAINS as FALLBACK_DOMAINS } from '../lib/capabilities/domains';

// Capabilities ("Skills") module home. Day 1 scaffold: lists the 10 capability
// domains served from the API (falls back to the bundled mirror if the request
// fails), flags the three foundations, and frames the baseline that lands on Day 2.
export default function Skills() {
  const { user } = useAuth();
  const [domains, setDomains] = useState(FALLBACK_DOMAINS);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/capabilities/domains')
      .then(d => { if (!cancelled && Array.isArray(d?.domains)) setDomains(d.domains); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={22} className="text-violet-600" />
        <h1 className="text-xl font-bold text-slate-800">Skills</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Ten capability domains real life demands. The three marked
        {' '}<span className="font-semibold text-violet-600">Foundation</span> gate the rest — build
        those first.
      </p>

      {error && (
        <p className="text-xs text-amber-600 mb-3">Showing built-in list (couldn’t reach server: {error}).</p>
      )}

      {/* Baseline check-in entry points */}
      <div className="grid grid-cols-1 gap-2 mb-5">
        {user?.isAdmin && (
          <NavLink
            to="/skills/baseline/parent"
            className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 hover:bg-violet-100 transition-colors"
          >
            <ClipboardList size={20} className="text-violet-600 shrink-0" />
            <span>
              <span className="block text-sm font-semibold text-violet-800">Rate your child’s skills</span>
              <span className="block text-xs text-violet-600/80">Parent baseline — 20 quick questions across the ten domains.</span>
            </span>
          </NavLink>
        )}
        <NavLink
          to="/skills/baseline/kid"
          className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 hover:bg-sky-100 transition-colors"
        >
          <Smile size={20} className="text-sky-600 shrink-0" />
          <span>
            <span className="block text-sm font-semibold text-sky-800">My skills check-in</span>
            <span className="block text-xs text-sky-600/80">For kids — ten quick “how much is this like me?” questions.</span>
          </span>
        </NavLink>
      </div>

      <ul className="space-y-2">
        {domains.map(d => (
          <li
            key={d.key}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 tabular-nums w-5">{d.num}</span>
                <span className="font-semibold text-slate-800">{d.name}</span>
              </div>
              {d.foundational && (
                <span className="flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold px-2 py-0.5">
                  <Star size={11} className="fill-violet-500 text-violet-500" /> Foundation
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{d.description}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-400 mt-5 leading-relaxed">
        A baseline check-in (parent + kid) lands next — it’s a self-tracking reflection tool to find
        where to focus, <span className="font-medium">not a clinical assessment</span>.
      </p>
    </div>
  );
}
