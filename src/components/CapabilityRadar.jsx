// Dependency-free SVG radar for the 10 capability domains. One or two series
// (e.g. parent vs kid). No chart library — fixed 10-axis geometry is ~one function,
// and avoiding a dep keeps the bundle lean (handover app §9 risk R3).
//
// Props:
//   domains: ordered [{ key, num, name?, foundational? }]
//   series:  [{ key, label, color, values: { [domainKey]: 0..1 } }]   (1–2 entries)
//   size:    px (square), default 300
//
// Axes are labelled by domain number; the caller renders the number→name legend
// (the result page's per-domain bars already serve that role).

const RINGS = [0.25, 0.5, 0.75, 1];

export default function CapabilityRadar({ domains, series, size = 300 }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const n = domains.length;

  // Axis i points from top, clockwise.
  const angle = i => (-90 + (i * 360) / n) * (Math.PI / 180);
  const point = (value, i) => {
    const a = angle(i);
    const r = R * Math.max(0, Math.min(1, value));
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const toPath = values =>
    domains.map((d, i) => point(values?.[d.key] ?? 0, i).join(',')).join(' ');

  const labelPos = i => {
    const a = angle(i);
    const r = R + 16;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    const cos = Math.cos(a);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    return { x, y, anchor };
  };

  const ariaLabel = series
    .map(s => `${s.label}: ${domains.map(d => Math.round((s.values?.[d.key] ?? 0) * 100)).join(', ')}`)
    .join('; ');

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[340px] mx-auto block"
        role="img"
        aria-label={`Capability radar. ${ariaLabel}`}
      >
        {/* grid rings */}
        {RINGS.map(ring => (
          <polygon
            key={ring}
            points={domains.map((_, i) => point(ring, i).join(',')).join(' ')}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}

        {/* spokes + numbered axis labels */}
        {domains.map((d, i) => {
          const [ex, ey] = point(1, i);
          const lp = labelPos(i);
          return (
            <g key={d.key}>
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#e2e8f0" strokeWidth="1" />
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={lp.anchor}
                dominantBaseline="middle"
                fontSize="11"
                fontWeight={d.foundational ? 700 : 500}
                fill={d.foundational ? '#7c3aed' : '#94a3b8'}
              >
                {d.num}
              </text>
            </g>
          );
        })}

        {/* series polygons (draw first series last so it sits on top) */}
        {[...series].reverse().map(s => (
          <g key={s.key}>
            <polygon points={toPath(s.values)} fill={s.color} fillOpacity="0.15" stroke={s.color} strokeWidth="2" />
            {domains.map((d, i) => {
              const [px, py] = point(s.values?.[d.key] ?? 0, i);
              return <circle key={d.key} cx={px} cy={py} r="2.5" fill={s.color} />;
            })}
          </g>
        ))}
      </svg>

      {series.length > 1 && (
        <figcaption className="flex items-center justify-center gap-4 mt-2">
          {series.map(s => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
