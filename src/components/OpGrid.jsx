// Per-operation accent colors (hex, applied inline so Tailwind's purge can't drop them).
const OP_COLOR = {
  mul: '#7c3aed', add: '#059669', sub: '#e11d48', div: '#0284c7',
  sq: '#d97706', sqrt: '#ea580c', cube: '#c026d3', cbrt: '#db2777', frac: '#0d9488',
};

// Operation picker where each mode shows its own accent, a mastery bar (mastered / total
// facts) and the points still on the table (⭐ due × payout). Makes it obvious what's left
// to master and where the easy points are.
export default function OpGrid({ ops, perOpStats, op, setOp, children }) {
  const statByOp = new Map(perOpStats.map(s => [s.op, s]));

  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
      {ops.map(o => {
        const s = statByOp.get(o.key) || { masteryPct: 0, potential: 0, due: 0 };
        const color = OP_COLOR[o.key] || '#7c3aed';
        const selected = op === o.key;
        return (
          <button
            key={o.key}
            onClick={() => setOp(o.key)}
            className="rounded-xl p-2.5 text-left transition-all border-2"
            style={{
              backgroundColor: selected ? color : '#fff',
              borderColor: selected ? color : '#e2e8f0',
              color: selected ? '#fff' : '#334155',
            }}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 font-bold text-sm min-w-0">
                <span className="text-lg leading-none" style={{ color: selected ? '#fff' : color }}>{o.symbol}</span>
                <span className="truncate">{o.label}</span>
              </span>
              {s.due === 0 ? (
                <span className="shrink-0 text-[10px] font-bold" style={{ color: selected ? '#fff' : '#16a34a' }}>✓</span>
              ) : s.potential > 0 ? (
                <span
                  className="shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{
                    backgroundColor: selected ? 'rgba(255,255,255,0.25)' : `${color}1a`,
                    color: selected ? '#fff' : color,
                  }}
                >
                  ⭐{s.potential}
                </span>
              ) : null}
            </div>
            {/* Mastery bar */}
            <div
              className="mt-2 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: selected ? 'rgba(255,255,255,0.3)' : '#f1f5f9' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${s.masteryPct}%`, backgroundColor: selected ? '#fff' : color }}
              />
            </div>
            <div className="mt-1 text-[10px] font-medium" style={{ color: selected ? 'rgba(255,255,255,0.85)' : '#94a3b8' }}>
              {s.masteryPct}% mastered
            </div>
          </button>
        );
      })}
      {children}
    </div>
  );
}
