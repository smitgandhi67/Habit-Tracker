import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';

// Raw per-question answers for one attempt, grouped by subscale. Lets a parent
// check whether a child understood each item and see exactly which answers drove
// a result (owner or admin only — enforced server-side).
export default function ParentingAnswers() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/parenting/attempts/${id}/responses`)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="px-4 py-6"><div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div></div>;
  if (!data) return <div className="px-4 py-6"><div className="bg-white rounded-3xl h-40 animate-pulse border border-slate-100" /></div>;

  const max = data.responseScale?.max ?? 5;
  // group by subscale, preserving order
  const groups = [];
  const byKey = new Map();
  for (const it of data.items) {
    const key = it.subscaleLabel || 'Other';
    if (!byKey.has(key)) { byKey.set(key, []); groups.push(key); }
    byKey.get(key).push(it);
  }

  return (
    <div className="px-4 py-2 pb-10">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-xl font-bold text-slate-800">{data.title}</h1>
      <p className="text-sm text-slate-400 mb-4">{data.completedAt ? new Date(data.completedAt).toLocaleString() : ''} · answers as given</p>

      <div className="space-y-4">
        {groups.map(g => (
          <div key={g} className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
            <h2 className="text-sm font-semibold text-violet-700 mb-3">{g}</h2>
            <div className="space-y-3">
              {byKey.get(g).map(it => (
                <div key={it.itemId} className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    {it.text}
                    {it.reverse && <span className="text-[10px] text-slate-400"> (reverse-scored)</span>}
                  </p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {it.answer} <span className="text-slate-400 font-normal">({it.value}/{max})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
