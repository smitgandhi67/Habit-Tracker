import { BookOpenCheck, ArrowRight } from 'lucide-react';
import { oneOfEachType, rootCounts, CONCEPT_INTRO } from '../lib/roots';
import RootCard from '../components/RootCard';

// Word Decoder — the vocabulary analogue of the math module. Stage 1 renders the loaded
// content: the "big idea" (words are built from meaningful parts) plus one card of each
// root type, proving the data file + loader are wired end to end. Interactions, SRS,
// decode challenges, and progress arrive in later stages.
export default function DecodePage() {
  const counts = rootCounts();
  const cards = oneOfEachType();
  const intro = CONCEPT_INTRO?.examples || [];

  return (
    <div className="px-4">
      <header className="pt-4 mb-4">
        <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-2">
          <BookOpenCheck className="text-indigo-500" /> Word Decoder
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Crack words you've never seen by their Greek &amp; Latin roots.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-1">
            {counts.total} roots
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            {counts.word_family} word-family
          </span>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            {counts.keyword_mnemonic} keyword-image
          </span>
        </div>
      </header>

      {/* The big idea — words are built from parts (Stage-0 concept, static preview here) */}
      <section className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-4 mb-5 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wide text-white/80">The big idea</div>
        <p className="mt-0.5 text-sm text-white/90">Every big word is a puzzle of smaller meaning-parts.</p>
        <div className="mt-3 space-y-2">
          {intro.map(ex => (
            <div key={ex.word} className="rounded-xl bg-white/10 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1">
                {ex.parts.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className="text-sm font-bold bg-white/20 rounded px-1.5 py-0.5">{p.text}</span>
                    <span className="text-[11px] text-white/70">({p.meaning})</span>
                    {i < ex.parts.length - 1 && <span className="text-white/50 mx-0.5">+</span>}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-sm font-semibold flex items-center gap-1">
                <ArrowRight size={13} className="text-white/70" /> {ex.word} — {ex.gloss}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* One card of each root type (Stage-1 render check) */}
      <div className="space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Two kinds of roots
        </div>
        {cards.map(root => (
          <RootCard key={root.id} root={root} />
        ))}
      </div>

      <p className="mt-6 mb-2 text-center text-xs text-slate-400">
        Stage 1 preview · practice, mastery &amp; decode challenges coming next
      </p>
    </div>
  );
}
