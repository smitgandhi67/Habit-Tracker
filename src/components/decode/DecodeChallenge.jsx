import { useState, useMemo } from 'react';
import { Swords, Check, Trophy, ArrowRight, Sparkles } from 'lucide-react';
import { pickDecodeWord, glossOptions, getRoot } from '../../lib/roots';

// The transfer test: decode a NOVEL word (one the child was never drilled on) by combining
// its parts. This is the ONLY path to mastery. The word's parts are shown (a guided split);
// the child must assemble the whole meaning by choosing the correct gloss. A first-try
// correct on a novel word graduates this root — and any other "ready" root in the word.
export default function DecodeChallenge({ root, decodedWords = [], submit, onNext }) {
  const dw = useMemo(() => pickDecodeWord(root, decodedWords), [root, decodedWords]);
  const options = useMemo(() => (dw ? glossOptions(dw) : []), [dw]);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);

  if (!dw) return null; // guarded upstream

  async function pick(opt) {
    if (picked) return;
    setPicked(opt);
    const res = await submit({ word: dw.word, glossChoice: opt.text });
    setResult(res);
  }

  const answered = !!picked;
  const graduated = (result?.graduated || []).map(getRoot).filter(Boolean);

  return (
    <div className="rounded-2xl border-2 border-amber-100 bg-white p-5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
        <Swords size={13} /> Decode challenge — a word you've never drilled
      </div>

      <p className="mt-2 text-3xl font-black text-slate-800 tracking-tight">{dw.word}</p>

      {/* guided split: the parts are shown; the child combines them */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {dw.parts.map((p, i) => {
          const isTarget = p.id === root.id;
          return (
            <span key={i} className="inline-flex items-center gap-1">
              <span
                className={`rounded-lg font-bold text-sm px-2 py-1 ${isTarget ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : p.id ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
                title={p.meaning}
              >
                {p.text}
              </span>
              <span className="text-[11px] text-slate-400">{p.meaning}</span>
              {i < dw.parts.length - 1 && <span className="text-slate-300 font-bold mx-0.5">+</span>}
            </span>
          );
        })}
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-700">Put the parts together — what does “{dw.word}” mean?</p>
      <div className="mt-2 space-y-2">
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
                  : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
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
            <div className="rounded-xl bg-green-50 border border-green-200 p-3">
              <p className="text-sm font-bold text-green-700 flex items-center gap-1.5"><Check size={16} /> You cracked it!{result.awarded > 0 && <span className="text-violet-600 ml-1">+{result.awarded}</span>}</p>
              {graduated.length > 0 && (
                <p className="mt-1.5 text-sm text-emerald-700 flex items-center gap-1.5 flex-wrap">
                  <Trophy size={15} className="text-amber-500" /> Mastered:
                  {graduated.map(g => <span key={g.id} className="font-bold rounded bg-white px-1.5 py-0.5">{g.root}</span>)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-rose-500 flex items-center gap-1.5">
              <Sparkles size={15} /> Not quite — “{dw.word}” means <span className="text-slate-700">{dw.gloss}</span>. You'll see a fresh word next time.
            </p>
          )}
          <button onClick={onNext} className="mt-3 w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 flex items-center justify-center gap-1 transition-colors">
            Next <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
