import { useState, useMemo } from 'react';
import { Lightbulb, Check, ArrowRight, Eye } from 'lucide-react';
import { recognitionOptions, containsRoot, rootSpan } from '../../lib/roots';

// Highlight the root inside a word.
function Highlighted({ word, root }) {
  const span = rootSpan(root, word);
  if (!span) return <>{word}</>;
  return (
    <>
      {word.slice(0, span[0])}
      <span className="font-bold text-indigo-600 underline decoration-2 decoration-indigo-400">{word.slice(span[0], span[1])}</span>
      {word.slice(span[1])}
    </>
  );
}

// First-exposure scaffold (FIRST sight of a word_family root only): ramp instead of
// demanding words. teach -> recognition (pick the word the root hides in) -> cued
// generation of ONE word, with a hint and a reveal-the-seed fallback so it never
// dead-ends. On completion, onComplete() records the exposure with the server.
export default function FirstExposure({ root, onComplete, submitting }) {
  const [phase, setPhase] = useState('teach'); // teach | recognition | cued | done
  const options = useMemo(() => recognitionOptions(root), [root]);
  const [picked, setPicked] = useState(null);
  const [typed, setTyped] = useState('');
  const [hintLevel, setHintLevel] = useState(0); // 0 none, 1 hint, 2 reveal seed
  const [genOk, setGenOk] = useState(false);

  const isKeyword = root.type === 'keyword_mnemonic';
  const seed = root.seed_examples[0];

  function pickOption(o) {
    if (picked) return;
    setPicked(o);
  }

  function tryWord() {
    const w = typed.trim();
    if (w && containsRoot(root, w)) { setGenOk(true); setPhase('done'); }
    else setHintLevel(l => Math.min(l + 1, 2)); // escalate help instead of failing
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-100 bg-white p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">New root · meet it</div>

      {/* TEACH */}
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="text-4xl font-black text-indigo-600">{root.root}</span>
        <span className="text-slate-300 text-2xl">=</span>
        <span className="text-2xl font-bold text-slate-700">{root.meaning}</span>
        <span className="text-[11px] font-semibold uppercase text-slate-400 ml-1">{root.origin}</span>
      </div>

      {isKeyword && root.mnemonic && (
        <div className="mt-3 rounded-xl bg-violet-50 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-violet-500">Sounds like “{root.mnemonic.keyword}”</div>
          <p className="mt-1 text-sm text-slate-600">{root.mnemonic.image_text}</p>
        </div>
      )}

      {phase === 'teach' && (
        <button
          onClick={() => setPhase(isKeyword ? 'cued' : 'recognition')}
          className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 transition-colors"
        >
          Got it — show me
        </button>
      )}

      {/* RECOGNITION (word_family) */}
      {phase === 'recognition' && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700">
            Which word has <span className="text-indigo-600 font-bold">“{root.root.split('/')[0].trim()}”</span> hiding in it?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {options.map((o) => {
              const chosen = picked?.word === o.word;
              const reveal = !!picked;
              const state = reveal && o.correct ? 'right' : chosen && !o.correct ? 'wrong' : 'idle';
              return (
                <button
                  key={o.word}
                  disabled={reveal && picked.correct}
                  onClick={() => pickOption(o)}
                  className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors ${
                    state === 'right' ? 'border-green-400 bg-green-50 text-green-700'
                      : state === 'wrong' ? 'border-rose-300 bg-rose-50 text-rose-500'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {state === 'right' ? <Highlighted word={o.word} root={root} /> : o.word}
                </button>
              );
            })}
          </div>
          {picked && !picked.correct && (
            <p className="mt-2 text-xs text-rose-500">Not that one — look for the letters. Try again.</p>
          )}
          {picked && picked.correct && (
            <button
              onClick={() => setPhase('cued')}
              className="mt-3 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 flex items-center justify-center gap-1 transition-colors"
            >
              Yes! <Highlighted word={picked.word} root={root} /> <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* CUED GENERATION (one word) */}
      {phase === 'cued' && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700">
            Now you try — think of <span className="text-indigo-600">ONE</span> word with “{root.root.split('/')[0].trim()}”.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && tryWord()}
              placeholder="type a word…"
              className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-400 outline-none"
            />
            <button onClick={tryWord} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 transition-colors">Check</button>
          </div>

          {hintLevel === 1 && (
            <button onClick={() => setHintLevel(2)} className="mt-3 w-full text-left rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700 flex items-center gap-2">
              <Lightbulb size={15} /> Hint: it starts with “{seed[0].toUpperCase()}” … tap again to see one.
            </button>
          )}
          {hintLevel >= 2 && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-3">
              <p className="text-sm text-amber-800 flex items-center gap-2"><Eye size={15} /> Here's one — can you spot the root?</p>
              <p className="mt-1 text-xl font-bold text-slate-800"><Highlighted word={seed} root={root} /></p>
              <button
                onClick={() => { setGenOk(true); setPhase('done'); }}
                className="mt-2 w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 transition-colors"
              >
                I found it! <ArrowRight size={15} className="inline" />
              </button>
            </div>
          )}
          {hintLevel === 0 && (
            <button onClick={() => setHintLevel(1)} className="mt-3 text-xs text-slate-400 hover:text-slate-600">I'm stuck — give me a hint</button>
          )}
        </div>
      )}

      {/* DONE → record exposure */}
      {phase === 'done' && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
            <Check size={16} /> {genOk ? `Nice — you connected “${root.root.split('/')[0].trim()}” to a real word.` : 'Got it!'}
          </p>
          <button
            onClick={onComplete}
            disabled={submitting}
            className="mt-3 w-full rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-3 transition-colors"
          >
            {submitting ? 'Saving…' : 'Next root →'}
          </button>
        </div>
      )}
    </div>
  );
}
