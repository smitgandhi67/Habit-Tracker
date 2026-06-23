import { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useParentingQuiz } from '../hooks/useParentingQuiz';
import LikertScale from '../components/LikertScale';
import AnchoredScale from '../components/AnchoredScale';
import { PARENTING_DISCLAIMER } from '../lib/parenting/bands';

// Adult questionnaire runner. All items on one scrollable page (lets parents
// review/change answers) with a sticky progress + submit bar.
export default function ParentingQuiz() {
  const { key } = useParams();
  const navigate = useNavigate();
  const {
    form, answers, setAnswer, answeredCount, total, complete, firstUnansweredId,
    submit, submitting, error,
  } = useParentingQuiz(key);

  const itemRefs = useRef({});

  if (error && !form) {
    return <div className="px-4 py-6"><div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div></div>;
  }
  if (!form) {
    return (
      <div className="px-4 py-6 space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="bg-white rounded-3xl h-24 animate-pulse border border-slate-100" />)}
      </div>
    );
  }

  async function handleSubmit() {
    if (!complete) {
      const el = itemRefs.current[firstUnansweredId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error('Please answer every question first.');
      return;
    }
    try {
      const result = await submit();
      navigate(`/parenting/result/${result._id}`, { state: { result } });
    } catch {
      toast.error('Could not save your answers. Please try again.');
    }
  }

  return (
    <div className="px-4 py-2 pb-28">
      <button onClick={() => navigate('/parenting')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
        <ArrowLeft size={16} /> Parenting
      </button>

      <h1 className="text-xl font-bold text-slate-800">{form.title}</h1>
      <p className="text-sm text-slate-500 mt-1">{form.description}</p>
      <p className="text-xs text-slate-400 mt-2">Think about your usual response. There are no right or wrong answers.</p>

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
              {form.format === 'anchored' ? (
                <AnchoredScale
                  options={form.options}
                  value={answers[it.id]}
                  onChange={v => setAnswer(it.id, v)}
                  anchorLow={it.anchorLow}
                  anchorHigh={it.anchorHigh}
                  name={`Q${idx + 1}`}
                />
              ) : (
                <LikertScale
                  options={form.options}
                  value={answers[it.id]}
                  onChange={v => setAnswer(it.id, v)}
                  name={`Q${idx + 1}`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">{PARENTING_DISCLAIMER}</p>

      {/* Sticky progress + submit */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{answeredCount} of {total}</span>
            <span>{Math.round((answeredCount / total) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition-colors ${
            complete && !submitting
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-slate-200 text-slate-500'
          }`}
        >
          {submitting ? 'Saving…' : 'See results'}
        </button>
      </div>
    </div>
  );
}
