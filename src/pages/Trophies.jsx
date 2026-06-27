import { useState, useEffect } from 'react';
import { Trophy, ExternalLink } from 'lucide-react';
import { apiFetch } from '../lib/api';

const CAT_EMOJI = {
  competition: '🏅', project: '🚀', 'science-fair': '🔬', leadership: '⭐',
  service: '🤝', research: '📄', award: '🏆', test: '📝', other: '✨',
};

// Read-only, celebratory shelf of the kid's own achievements. Backward-looking only —
// no future-target pressure (milestones live in the parent console).
export default function Trophies() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/journey/trophies')
      .then(d => { if (!cancelled) setAchievements(d.achievements || []); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-4">
      <h1 className="pt-4 text-2xl font-bold text-slate-800 flex items-center gap-2 mb-1">
        <Trophy className="text-amber-500" size={24} /> My Trophies
      </h1>
      <p className="text-sm text-slate-400 mb-6">Everything you&apos;ve done. Keep stacking them up.</p>

      {loading ? (
        <p className="text-center text-slate-400 py-16">Loading…</p>
      ) : achievements.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-5xl mb-3">🏆</p>
          <p className="font-semibold text-slate-600">No trophies yet</p>
          <p className="text-sm mt-1">Win a competition, ship a project, run an experiment — they show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {achievements.map(a => (
            <div key={a._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-start gap-3">
              <span className="text-2xl shrink-0">{CAT_EMOJI[a.category] || '✨'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400">
                  {a.date}{a.placement ? ` · ${a.placement}` : ''}{a.hours ? ` · ${a.hours}h` : ''}
                </p>
                {a.description && <p className="text-sm text-slate-500 mt-1">{a.description}</p>}
                {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1 mt-1"><ExternalLink size={12} /> see it</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
