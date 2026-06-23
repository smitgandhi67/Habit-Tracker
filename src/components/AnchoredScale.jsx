// 7-point response row anchored by two endpoint phrases (the Parenting Scale
// format). Left anchor = low value, right anchor = high value. Numbers are the
// tap targets; anchor text sits beside them (stacked on narrow screens).
export default function AnchoredScale({ options, value, onChange, anchorLow, anchorHigh, name }) {
  return (
    <div>
      <div className="flex items-stretch gap-2">
        <span className="hidden sm:flex items-center w-28 text-xs text-slate-500 text-right justify-end shrink-0">
          {anchorLow}
        </span>
        <div role="radiogroup" aria-label={name} className="flex-1 grid grid-cols-7 gap-1">
          {options.map(opt => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${opt.value}${opt.value === options[0].value ? ` — ${anchorLow}` : ''}${opt.value === options[options.length - 1].value ? ` — ${anchorHigh}` : ''}`}
                onClick={() => onChange(opt.value)}
                className={`aspect-square rounded-xl text-sm font-semibold border transition-colors tabular-nums ${
                  selected
                    ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-violet-300'
                }`}
              >
                {opt.value}
              </button>
            );
          })}
        </div>
        <span className="hidden sm:flex items-center w-28 text-xs text-slate-500 shrink-0">
          {anchorHigh}
        </span>
      </div>
      {/* Narrow screens: anchors below the row */}
      <div className="flex sm:hidden justify-between text-[11px] text-slate-500 mt-1.5">
        <span className="max-w-[45%]">{anchorLow}</span>
        <span className="max-w-[45%] text-right">{anchorHigh}</span>
      </div>
    </div>
  );
}
