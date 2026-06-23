import { CONCERN_FACETS, FACET_LABELS } from '../lib/parenting/bands';

// Horizontal score bars for subscale means. `max` is the response-scale max so
// bar width = mean/max. Concern facets (harsh/permissive) tint amber; positive
// parenting facets tint emerald. Color is never the only signal — the numeric
// mean is always shown.
export default function SubscaleBars({ subscales, max = 5 }) {
  return (
    <div className="space-y-3">
      {subscales.map(s => {
        const label = s.label || FACET_LABELS[s.key] || s.key;
        const pct = Math.max(0, Math.min(100, (s.mean / max) * 100));
        const concern = CONCERN_FACETS.has(s.key);
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-slate-600">{label}</span>
              <span className="text-sm font-semibold text-slate-700 tabular-nums">
                {s.mean.toFixed(2)}
                <span className="text-slate-300 font-normal"> / {max}</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${concern ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${pct}%` }}
                role="meter"
                aria-valuenow={s.mean}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={label}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
