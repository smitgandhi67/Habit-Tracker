import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Star } from 'lucide-react';
import { useCapabilityQuiz } from '../hooks/useCapabilityQuiz';
import KidFaceScale from '../components/KidFaceScale';

// Kid self-report baseline (kid_baseline): one question per screen, big buttons,
// "how much is this like you?" framing, and a gentle thank-you. The child never
// sees scores — results are parent-facing.
export default function SkillsBaselineKidQuiz() {
  const navigate = useNavigate();
  const { form, answers, setAnswer, total, submit, submitting, error } = useCapabilityQuiz('kid_baseline');
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(null);

  if (error && !form) {
    return <div className="px-4 py-6"><div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div></div>;
  }
  if (!form) {
    return <div className="px-4 py-6"><div className="bg-white rounded-3xl h-48 animate-pulse border border-slate-100" /></div>;
  }

  if (done) {
    return (
      <div className="px-4 py-10 text-center">
        <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
          <Star size={40} className="fill-violet-500 text-violet-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">All done!</h1>
        <p className="text-slate-500 mt-2 max-w-xs mx-auto">
          {done.interpretation?.kidSummary || 'Thanks for sharing your answers!'}
        </p>
        <button
          onClick={() => navigate('/skills')}
          className="mt-6 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Finish
        </button>
      </div>
    );
  }

  const item = form.items[idx];

  async function pick(value) {
    setAnswer(item.id, value);
    if (idx < total - 1) {
      setTimeout(() => setIdx(i => i + 1), 180);
    } else {
      try {
        const result = await submit(); // self-report, no subjectUserId
        setDone(result);
      } catch {
        toast.error('Oops — could not save. Try again.');
      }
    }
  }

  return (
    <div className="px-4 py-3 min-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => (idx > 0 ? setIdx(i => i - 1) : navigate('/skills'))}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <span className="text-sm font-medium text-slate-400">{idx + 1} / {total}</span>
      </div>

      <div className="flex gap-1.5 mb-8">
        {form.items.map((it, i) => (
          <div
            key={it.id}
            className={`h-1.5 flex-1 rounded-full ${
              i < idx || answers[it.id] != null ? 'bg-violet-500' : i === idx ? 'bg-violet-300' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <p className="text-xs text-violet-500 font-semibold mb-2">How much is this like you?</p>
        <h2 className="text-xl font-bold text-slate-800 mb-6 leading-snug">{item.text}</h2>
        <KidFaceScale
          options={form.options}
          value={answers[item.id]}
          onChange={pick}
          name={`Question ${idx + 1}`}
        />
        {submitting && <p className="text-sm text-slate-400 text-center mt-5">Saving your answers…</p>}
      </div>
    </div>
  );
}
