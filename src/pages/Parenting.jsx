import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, ChevronRight, History } from 'lucide-react';
import { apiFetch } from '../lib/api';

// Parenting assessment hub. Lists the available research-based questionnaires
// and routes into each runner. Instruments are added phase by phase; until the
// first one lands this shows a friendly empty state.
export default function Parenting() {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/parenting/instruments')
      .then(list => { if (!cancelled) setInstruments(list); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 mb-1">
        <HeartHandshake className="text-violet-600" size={22} />
        <h1 className="text-xl font-bold text-slate-800">Parenting</h1>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Research-based questionnaires to reflect on your parenting — and how your
        child experiences it.
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div>
      )}

      {!error && instruments === null && (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 animate-pulse h-20" />
          ))}
        </div>
      )}

      {!error && instruments?.length === 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center">
          <p className="text-slate-600 font-medium">Quizzes coming soon</p>
          <p className="text-sm text-slate-400 mt-1">The first assessment is on its way.</p>
        </div>
      )}

      {!error && instruments?.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => navigate('/parenting/history')}
            className="w-full text-left bg-white rounded-3xl p-4 shadow-sm border border-slate-100 hover:border-violet-200 transition-colors flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              <span className="font-medium text-slate-700">Your history & trends</span>
            </div>
            <ChevronRight className="text-slate-300 shrink-0" size={20} />
          </button>
          {instruments.map(inst => (
            <button
              key={inst.key}
              onClick={() => navigate(inst.audience === 'child' ? `/parenting/kid/${inst.key}` : `/parenting/quiz/${inst.key}`)}
              className="w-full text-left bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:border-violet-200 transition-colors flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-semibold text-slate-800">{inst.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{inst.description}</p>
                <p className="text-xs text-slate-400 mt-1">{inst.itemCount} questions</p>
              </div>
              <ChevronRight className="text-slate-300 shrink-0" size={20} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
