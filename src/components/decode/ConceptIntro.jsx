import { useState } from 'react';
import { ArrowRight, Sparkles, KeyRound, PartyPopper } from 'lucide-react';
import { CONCEPT_INTRO } from '../../lib/roots';

// Stage 0 — the one-time "aha": big words are built from meaning-parts, and knowing the
// parts lets you crack words you've never seen. Runs once at the very start (gated by the
// hook's introSeen flag). Three worked decompositions, then ONE novel word the child
// finishes with heavy help. Goal is the mindset shift, not coverage.
export default function ConceptIntro({ onDone }) {
  const examples = CONCEPT_INTRO?.examples || [];
  const novel = CONCEPT_INTRO?.novelSplit;
  // steps: 0..examples.length-1 = worked examples, then the "you try" step
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(null);

  const onTry = step >= examples.length;
  const ex = examples[step];

  // Two gloss options for the "you try" step (real + one distractor).
  const glossChoices = novel
    ? [{ text: novel.gloss, correct: true }, { text: 'a kind of musical instrument', correct: false }]
    : [];

  return (
    <div className="px-1">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/80">
          <KeyRound size={14} /> Cracking the code
        </div>
        <h2 className="mt-1 text-2xl font-black leading-tight">Big words are puzzles.</h2>
        <p className="mt-1 text-sm text-white/90">
          Every long word is built from smaller meaning-parts. Learn the parts and you can crack
          words you've <em>never seen before</em> — like a detective.
        </p>
      </div>

      {!onTry && ex && (
        <div className="mt-4 rounded-2xl border-2 border-indigo-100 bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Example {step + 1} of {examples.length}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {ex.parts.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className="rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm px-2 py-1">{p.text}</span>
                <span className="text-[11px] text-slate-400">= {p.meaning}</span>
                {i < ex.parts.length - 1 && <span className="text-slate-300 mx-0.5 font-bold">+</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 text-lg font-bold text-slate-800 flex items-center gap-1.5">
            <ArrowRight size={18} className="text-indigo-500" /> {ex.word}
          </p>
          <p className="text-sm text-slate-500">{ex.gloss}</p>
          <button
            onClick={() => setStep(step + 1)}
            className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 transition-colors"
          >
            {step + 1 < examples.length ? 'Next example' : "Now you try →"}
          </button>
        </div>
      )}

      {onTry && novel && (
        <div className="mt-4 rounded-2xl border-2 border-violet-100 bg-white p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-500">
            <Sparkles size={13} /> Your turn (with help)
          </div>
          <p className="mt-1 text-sm text-slate-600">Here are the parts of a word you've maybe never split before:</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {novel.parts.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className="rounded-lg bg-violet-50 text-violet-700 font-bold text-sm px-2 py-1">{p.text}</span>
                <span className="text-[11px] text-slate-400">= {p.meaning}</span>
                {i < novel.parts.length - 1 && <span className="text-slate-300 mx-0.5 font-bold">+</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 font-bold text-slate-800 text-lg">{novel.word}</p>
          <p className="text-sm text-slate-500">So what do you think it means?</p>
          <div className="mt-3 space-y-2">
            {glossChoices.map((g, i) => {
              const chosen = picked === i;
              const reveal = picked != null;
              const state = reveal && g.correct ? 'right' : chosen ? 'wrong' : 'idle';
              return (
                <button
                  key={i}
                  disabled={reveal}
                  onClick={() => setPicked(i)}
                  className={`w-full text-left rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    state === 'right' ? 'border-green-400 bg-green-50 text-green-700'
                      : state === 'wrong' ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                  }`}
                >
                  {g.text}
                </button>
              );
            })}
          </div>
          {picked != null && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
                <PartyPopper size={16} /> That's decoding! You just cracked a word from its parts.
              </p>
              <button
                onClick={onDone}
                className="mt-3 w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 transition-colors"
              >
                Start learning roots →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
