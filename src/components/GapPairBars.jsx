import { DIMENSION_LABELS, ALIGNMENT } from '../lib/parenting/bands';

const ALIGN_TINT = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
};

// Paired bars per shared dimension: the parent's self-report vs the child's
// experience, on a 0–100% scale, with an alignment badge. Scores are normalized
// 0..1 so different instruments/scales are comparable.
export default function GapPairBars({ gap }) {
  if (!gap?.length) return null;
  return (
    <div className="space-y-5">
      {gap.map(g => {
        const align = ALIGNMENT[g.alignment] || ALIGNMENT['some-gap'];
        return (
          <div key={g.key}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">{DIMENSION_LABELS[g.key] || g.key}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ALIGN_TINT[align.color]}`}>{align.label}</span>
            </div>
            <Row label="You" value={g.parent} tint="bg-violet-500" />
            <Row label="Your child" value={g.child} tint="bg-sky-500" />
            <p className="text-[11px] text-slate-400 mt-1">{align.note}</p>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, tint }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="w-20 text-xs text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${tint}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums text-slate-600">{Math.round(value * 100)}%</span>
    </div>
  );
}
