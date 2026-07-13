import { useState } from 'react';
import { Check, ArrowRight, Puzzle } from 'lucide-react';
import { meaningOptions } from '../../lib/roots';

// Later review of a keyword_mnemonic (opaque) root: recall the MEANING from the vivid
// image cue. The image is the whole teaching mechanism for these roots, so we show it and
// ask the child to pick the meaning. Server grades the choice.
export default function KeywordRecall({ root, submit, onNext }) {
  const [options] = useState(() => meaningOptions(root));
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);

  async function pick(opt) {
    if (picked) return;
    setPicked(opt);
    const res = await submit({ choice: opt.text });
    setResult(res);
  }

  const answered = !!picked;

  return (
    <div className="rounded-2xl border-2 border-violet-100 bg-white p-5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-400">
        <Puzzle size={13} /> Keyword review · {root.origin}
      </div>
      <div className="mt-1 text-3xl font-black text-violet-600">{root.root}</div>

      {root.mnemonic && (
        <div className="mt-3 rounded-xl bg-violet-50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Remember: sounds like “{root.mnemonic.keyword}”</div>
          <p className="mt-1 text-sm text-slate-600">{root.mnemonic.image_text}</p>
        </div>
      )}

      <p className="mt-4 text-sm font-semibold text-slate-700">So what does “{root.root}” mean?</p>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {options.map((o) => {
          const chosen = picked?.text === o.text;
          const reveal = answered;
          const state = reveal && o.correct ? 'right' : chosen && !o.correct ? 'wrong' : 'idle';
          return (
            <button
              key={o.text}
              disabled={answered}
              onClick={() => pick(o)}
              className={`w-full text-left rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                state === 'right' ? 'border-green-400 bg-green-50 text-green-700'
                  : state === 'wrong' ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
              }`}
            >
              {o.text}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-4">
          {result?.correct ? (
            <p className="text-sm font-semibold text-green-600 flex items-center gap-1.5"><Check size={16} /> Yes! “{root.root}” = {root.meaning}.{result.awarded > 0 && <span className="text-violet-600 font-bold ml-1">+{result.awarded}</span>}</p>
          ) : (
            <p className="text-sm font-semibold text-rose-500">Close — “{root.root}” means <span className="text-slate-700">{root.meaning}</span>. Picture the “{root.mnemonic?.keyword}” again.</p>
          )}
          <button onClick={onNext} className="mt-3 w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 flex items-center justify-center gap-1 transition-colors">
            Next <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
