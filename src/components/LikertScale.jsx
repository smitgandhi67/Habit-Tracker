// Accessible Likert response row. Renders the instrument's options as a radio
// group of pill buttons. Keyboard + touch friendly. Value is the option's
// numeric `value`; onChange(value) fires on select.
export default function LikertScale({ options, value, onChange, name }) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="grid grid-cols-1 sm:grid-cols-5 gap-2"
    >
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`rounded-2xl px-3 py-3 text-sm font-medium border transition-colors text-center ${
              selected
                ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
            }`}
          >
            <span className="block tabular-nums text-xs opacity-70">{opt.value}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
