import { Sparkles, Puzzle } from 'lucide-react';

// Highlight the root's letters inside an example word so the "hidden part" is visible
// (bio -> [bio]logy). Uses the first spelling variant of the root (e.g. "scop / scope"
// -> "scop") and matches case-insensitively; falls back to the plain word if no match.
function HighlightRoot({ word, root, color }) {
  const stem = String(root).split('/')[0].trim().toLowerCase();
  const lower = word.toLowerCase();
  const at = stem ? lower.indexOf(stem) : -1;
  if (at < 0) return <span>{word}</span>;
  return (
    <span>
      {word.slice(0, at)}
      <span className="font-bold rounded px-0.5" style={{ color: '#fff', backgroundColor: color }}>
        {word.slice(at, at + stem.length)}
      </span>
      {word.slice(at + stem.length)}
    </span>
  );
}

const TYPE_META = {
  word_family: { color: '#4f46e5', tint: '#eef2ff', label: 'Word family', icon: Sparkles,
    hint: 'This root already hides inside words you know.' },
  keyword_mnemonic: { color: '#9333ea', tint: '#faf5ff', label: 'Keyword image', icon: Puzzle,
    hint: 'A brand-new root — learn it with a picture.' },
};

// A single root card. word_family cards surface the familiar words the root hides in;
// keyword_mnemonic cards lead with the vivid sound-link image (the whole point of the
// opaque bucket). Both show a preview of the novel words this root helps decode.
export default function RootCard({ root }) {
  const meta = TYPE_META[root.type] || TYPE_META.word_family;
  const Icon = meta.icon;

  return (
    <div className="rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: meta.tint }}>
      {/* header: type + origin */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5"
          style={{ color: meta.color, backgroundColor: meta.tint }}
        >
          <Icon size={12} /> {meta.label}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {root.origin}
        </span>
      </div>

      {/* the root + meaning */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl font-black tracking-tight" style={{ color: meta.color }}>
          {root.root}
        </span>
        <span className="text-slate-400 text-xl font-light">=</span>
        <span className="text-2xl font-bold text-slate-700">{root.meaning}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{meta.hint}</p>

      {/* keyword image (opaque roots only) */}
      {root.type === 'keyword_mnemonic' && root.mnemonic && (
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: meta.tint }}>
          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
            Sounds like “{root.mnemonic.keyword}”
          </div>
          <p className="mt-1 text-sm text-slate-600 leading-snug">{root.mnemonic.image_text}</p>
        </div>
      )}

      {/* words the root hides in */}
      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          {root.type === 'word_family' ? 'Hiding in words you know' : 'Shows up in'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {root.seed_examples.map(w => (
            <span key={w} className="text-sm rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-600">
              <HighlightRoot word={w} root={root.root} color={meta.color} />
            </span>
          ))}
        </div>
      </div>

      {/* novel-decode preview */}
      {root.decode_words?.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Helps you crack new words like
          </div>
          {root.decode_words.slice(0, 1).map(dw => (
            <div key={dw.word}>
              <div className="flex flex-wrap items-center gap-1">
                {dw.parts.map((p, i) => (
                  <span
                    key={i}
                    className="text-sm font-semibold rounded px-1.5 py-0.5"
                    style={p.id
                      ? { color: meta.color, backgroundColor: meta.tint }
                      : { color: '#64748b', backgroundColor: '#f1f5f9' }}
                    title={p.meaning}
                  >
                    {p.text}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-sm text-slate-500 italic">“{dw.word}” — {dw.gloss}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
