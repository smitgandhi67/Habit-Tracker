const STATUS = {
  not_started: { label: 'Tap to update', ring: 'border-2 border-slate-300 bg-white',     icon: null,  textColor: 'text-slate-400', cardBg: 'bg-white'     },
  done:        { label: 'Done!',          ring: 'bg-green-500 border-2 border-green-600', icon: '✓',   textColor: 'text-green-600', cardBg: 'bg-green-50'  },
  half_done:   { label: 'Half done',      ring: 'bg-amber-400 border-2 border-amber-500', icon: '◑',   textColor: 'text-amber-600', cardBg: 'bg-amber-50'  },
  not_done:    { label: 'Not done',       ring: 'bg-red-400 border-2 border-red-500',     icon: '✕',   textColor: 'text-red-500',   cardBg: 'bg-red-50'    },
};

function ValueInput({ config, value, onChange }) {
  if (!config?.type) return null;

  const base = 'w-full mt-3 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white transition';

  if (config.type === 'number') {
    return (
      <div onClick={e => e.stopPropagation()}>
        <p className="text-xs text-slate-400 mt-3 mb-1">{config.label}</p>
        <input
          type="number"
          className={base}
          placeholder="0"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
    );
  }

  if (config.type === 'time') {
    return (
      <div onClick={e => e.stopPropagation()}>
        <p className="text-xs text-slate-400 mt-3 mb-1">{config.label} (minutes)</p>
        <input
          type="number"
          className={base}
          placeholder="0"
          min="0"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
    );
  }

  if (config.type === 'text') {
    return (
      <div onClick={e => e.stopPropagation()}>
        <p className="text-xs text-slate-400 mt-3 mb-1">{config.label}</p>
        <input
          type="text"
          className={base}
          placeholder="Type here…"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
        />
      </div>
    );
  }

  return null;
}

export default function HabitCard({ habit, status, onCycle, value, onValueChange }) {
  const s = STATUS[status] || STATUS.not_started;
  const hasConfig = !!habit.config?.type;

  return (
    <div className={`w-full rounded-2xl p-4 shadow-sm border border-slate-100 transition-all duration-200 ${s.cardBg}`}>
      <button
        onClick={onCycle}
        className="w-full flex items-center gap-4 active:scale-[0.97] transition-transform cursor-pointer"
      >
        <span className="text-2xl select-none">{habit.emoji}</span>
        <div className="flex-1 text-left">
          <p className="font-semibold text-slate-800 leading-tight">{habit.name}</p>
          <p className={`text-xs mt-0.5 font-medium ${s.textColor}`}>{s.label}</p>
        </div>
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-200 shrink-0 ${s.ring}`}>
          {s.icon ?? <span className="w-2 h-2 rounded-full bg-slate-300" />}
        </div>
      </button>

      {hasConfig && (
        <ValueInput
          config={habit.config}
          value={value}
          onChange={onValueChange}
        />
      )}
    </div>
  );
}
