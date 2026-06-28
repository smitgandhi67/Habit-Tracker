import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useCapabilityQuiz } from '../hooks/useCapabilityQuiz';
import LikertScale from '../components/LikertScale';
import { apiFetch } from '../lib/api';

// Parent rates their child across the 10 capability domains (parent_baseline). The
// parent first picks which child the ratings describe (subjectUserId), then fills a
// single scrollable Likert form with a sticky progress + submit bar.
export default function SkillsBaselineParentQuiz() {
  const navigate = useNavigate();
  const {
    form, answers, setAnswer, answeredCount, total, complete, firstUnansweredId,
    submit, submitting, error,
  } = useCapabilityQuiz('parent_baseline');

  const [children, setChildren] = useState(null); // null = loading
  const [childId, setChildId] = useState('');
  const itemRefs = useRef({});

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/capabilities/children')
      .then(list => {
        if (cancelled) return;
        setChildren(list);
        if (list.length === 1) setChildId(String(list[0].childUserId));
      })
      .catch(() => { if (!cancelled) setChildren([]); });
    return () => { cancelled = true; };
  }, []);

  if (error && !form) {
    return <div className="px-4 py-6"><div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div></div>;
  }
  if (!form || children === null) {
    return (
      <div className="px-4 py-6 space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="bg-white rounded-3xl h-24 animate-pulse border border-slate-100" />)}
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="px-4 py-6">
        <button onClick={() => navigate('/skills')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft size={16} /> Skills
        </button>
        <div className="bg-amber-50 text-amber-700 text-sm rounded-2xl p-4">
          Link a child first in the Parenting console, then come back to rate their skills.
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (!childId) {
      toast.error('Pick which child this is for.');
      return;
    }
    if (!complete) {
      const el = itemRefs.current[firstUnansweredId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error('Please answer every question first.');
      return;
    }
    try {
      const result = await submit(childId);
      navigate(`/skills/result/${result._id}`, { state: { result } });
    } catch {
      toast.error('Could not save your answers. Please try again.');
    }
  }

  return (
    <div className="px-4 py-2 pb-10">
      <button onClick={() => navigate('/skills')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
        <ArrowLeft size={16} /> Skills
      </button>

      <h1 className="text-xl font-bold text-slate-800">{form.title}</h1>
      <p className="text-sm text-slate-500 mt-1">{form.description}</p>

      {children.length > 1 && (
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-500">Rating which child?</label>
          <select
            value={childId}
            onChange={e => setChildId(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
          >
            <option value="">Choose…</option>
            {children.map(c => (
              <option key={String(c.childUserId)} value={String(c.childUserId)}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {form.items.map((it, idx) => {
          const answered = answers[it.id] != null;
          return (
            <div
              key={it.id}
              ref={el => { itemRefs.current[it.id] = el; }}
              className={`bg-white rounded-3xl p-4 shadow-sm border ${answered ? 'border-slate-100' : 'border-slate-200'}`}
            >
              <p className="text-sm font-medium text-slate-700 mb-3">
                <span className="text-slate-400 mr-1">{idx + 1}.</span>{it.text}
              </p>
              <LikertScale
                options={form.options}
                value={answers[it.id]}
                onChange={v => setAnswer(it.id, v)}
                name={`Q${idx + 1}`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{answeredCount} of {total} answered</span>
          <span>{Math.round((answeredCount / total) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${
            complete && childId && !submitting ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {submitting ? 'Saving…' : complete ? 'See results' : `Answer all ${total} to continue`}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">
        A self-tracking reflection to find where to focus — not a clinical assessment. Re-take in
        about three months to see what moved.
      </p>
    </div>
  );
}
