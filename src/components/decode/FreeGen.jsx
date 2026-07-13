import { useState } from 'react';
import { Check, X, Lightbulb, ArrowRight, Loader2 } from 'lucide-react';
import { containsRoot } from '../../lib/roots';

const SLOTS = 3; // the free-generation bar: three real words containing the root

// Later review of a word_family root: FREE generation of three real words that contain
// the root. The server validates each (contains the root AND is real, via Datamuse), so
// this is a real transfer test, not recognition. Hints reveal seed examples as a fallback
// so the child is never dead-ended (though a revealed word still counts as a real word).
export default function FreeGen({ root, submit, onNext }) {
  const stem = root.root.split('/')[0].trim();
  const [words, setWords] = useState(Array(SLOTS).fill(''));
  const [valid, setValid] = useState(Array(SLOTS).fill(null)); // null | true | false
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(null); // server result when correct
  const [msg, setMsg] = useState('');
  const [hintsUsed, setHintsUsed] = useState(0);

  const setWord = (i, v) => {
    setWords(w => w.map((x, k) => (k === i ? v : x)));
    setValid(vv => vv.map((x, k) => (k === i ? null : x))); // editing clears its verdict
  };

  async function check() {
    const trimmed = words.map(w => w.trim());
    if (trimmed.some(w => !w)) { setMsg('Fill in all three words first.'); return; }
    // client pre-check for the obvious "no root" case to save a round trip + guide fast
    const localBad = trimmed.map(w => !containsRoot(root, w));
    if (localBad.some(Boolean)) {
      setValid(trimmed.map((w, i) => (localBad[i] ? false : null)));
      setMsg(`Each word must contain “${stem}”.`);
      return;
    }
    setChecking(true); setMsg('');
    const res = await submit({ words: trimmed });
    setChecking(false);
    if (!res) return;
    const byWord = new Map((res.perWord || []).map(p => [p.word.toLowerCase(), p.valid]));
    setValid(trimmed.map(w => byWord.get(w.toLowerCase()) ?? false));
    if (res.correct) setDone(res);
    else setMsg('Some of those aren’t quite right — fix the red ones and check again.');
  }

  function revealHint() {
    // fill the first empty/invalid slot with an unused seed example
    const used = new Set(words.map(w => w.trim().toLowerCase()));
    const seed = root.seed_examples.find(s => !used.has(s.toLowerCase()));
    if (!seed) return;
    const target = valid.findIndex((v, i) => v === false || !words[i].trim());
    const i = target < 0 ? words.findIndex(w => !w.trim()) : target;
    if (i < 0) return;
    setWord(i >= 0 ? i : 0, seed);
    setHintsUsed(h => h + 1);
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green-100 bg-white p-5">
        <p className="text-sm font-semibold text-green-600 flex items-center gap-1.5"><Check size={16} /> All three real — you own “{stem}”.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {words.map((w, i) => <span key={i} className="text-sm rounded-lg bg-green-50 text-green-700 px-2 py-0.5 font-medium">{w}</span>)}
        </div>
        {done.awarded > 0 && <p className="mt-2 text-sm font-bold text-violet-600">+{done.awarded} points</p>}
        <button onClick={onNext} className="mt-4 w-full rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold py-3 transition-colors">Next →</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-indigo-100 bg-white p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">Review · {root.origin}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-black text-indigo-600">{root.root}</span>
        <span className="text-slate-300">=</span>
        <span className="text-xl font-bold text-slate-700">{root.meaning}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">Write <span className="text-indigo-600">three real words</span> that contain “{stem}”.</p>

      <div className="mt-2 space-y-2">
        {words.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={w}
              onChange={(e) => setWord(i, e.target.value)}
              placeholder={`word ${i + 1}`}
              className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-sm outline-none transition-colors ${
                valid[i] === true ? 'border-green-400 bg-green-50 text-green-700'
                  : valid[i] === false ? 'border-rose-300 bg-rose-50'
                  : 'border-slate-200 focus:border-indigo-400'
              }`}
              disabled={valid[i] === true}
            />
            {valid[i] === true && <Check size={18} className="text-green-500 shrink-0" />}
            {valid[i] === false && <X size={18} className="text-rose-400 shrink-0" />}
          </div>
        ))}
      </div>

      {msg && <p className="mt-2 text-xs text-rose-500">{msg}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={check}
          disabled={checking}
          className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 flex items-center justify-center gap-2 transition-colors"
        >
          {checking ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : 'Check my words'}
        </button>
        <button onClick={revealHint} className="rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-700 px-3 py-3 text-sm font-semibold flex items-center gap-1" title="Show me one">
          <Lightbulb size={15} /> Hint
        </button>
      </div>
      {hintsUsed > 0 && <p className="mt-2 text-[11px] text-slate-400">Filled in an example for you — you can still change it.</p>}
    </div>
  );
}
