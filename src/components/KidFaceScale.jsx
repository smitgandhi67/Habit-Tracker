// Large, kid-friendly 3-point frequency picker (Never / Sometimes / A lot).
// Uses filled-dot meters rather than happy/sad faces — the questions ask how
// OFTEN something happens, so emotional faces would bias the answer. Big tap
// targets (full-width rows) suit ages 7–10 and touch screens.
const DOT_TINTS = ['bg-sky-400', 'bg-violet-400', 'bg-emerald-400'];

export default function KidFaceScale({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="space-y-3">
      {options.map((opt, idx) => {
        const selected = value === opt.value;
        const dots = idx + 1; // 1, 2, 3 filled
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`w-full flex items-center gap-4 rounded-3xl px-5 py-5 border-2 transition-all ${
              selected
                ? 'border-violet-500 bg-violet-50 scale-[1.01] shadow-sm'
                : 'border-slate-200 bg-white hover:border-violet-300'
            }`}
          >
            <span className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full ${i < dots ? DOT_TINTS[idx] : 'bg-slate-200'}`}
                />
              ))}
            </span>
            <span className={`text-lg font-semibold ${selected ? 'text-violet-700' : 'text-slate-700'}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
