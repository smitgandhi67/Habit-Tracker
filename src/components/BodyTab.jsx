import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertTriangle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBody } from '../hooks/useBody';
import {
  avg7, latestWeight, weeklyDelta, weightAlert, weeklyBuckets, formatDelta, deltaTone,
} from '../lib/body.js';

const SIZE_METRICS = [
  { key: 'chest',   label: 'Chest'   },
  { key: 'waist',   label: 'Waist'   },
  { key: 'abdomen', label: 'Abdomen' },
  { key: 'hips',    label: 'Hips'    },
];
const ALERT_PCT = 1; // warn beyond ±1% of body weight per week

function fmt(v, decimals = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return Number(v.toFixed(decimals)).toString();
}

// Tiny inline sparkline over the non-null weekly points.
function Sparkline({ points, width = 64, height = 22 }) {
  const vals = points.filter(p => p.value != null).map(p => p.value);
  if (vals.length < 2) {
    return <div className="text-[10px] text-slate-300 w-16 text-center">—</div>;
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const n = points.length;
  const coords = points.map((p, i) => {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * (width - 4) + 2;
    if (p.value == null) return null;
    const y = height - 2 - ((p.value - min) / span) * (height - 4);
    return `${x},${y}`;
  }).filter(Boolean);
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-violet-500"
      />
    </svg>
  );
}

export default function BodyTab({ dateKey, weightUnit, lengthUnit }) {
  const { measurements, loading, save, remove } = useBody();
  const [openSizes, setOpenSizes] = useState(false);
  const [form, setForm] = useState({ weight: '', chest: '', waist: '', abdomen: '', hips: '' });
  const [saving, setSaving] = useState(false);

  const current = useMemo(
    () => measurements.find(m => m.date === dateKey) || null,
    [measurements, dateKey],
  );

  // Hydrate the form from the entry for the selected date. Done during render
  // (guarded by a signature) rather than in an effect to avoid cascading renders.
  const sig = current
    ? `${dateKey}|${current.weight}|${current.chest}|${current.waist}|${current.abdomen}|${current.hips}`
    : `${dateKey}|empty`;
  const [hydratedSig, setHydratedSig] = useState(null);
  if (hydratedSig !== sig) {
    setForm({
      weight:  current?.weight  != null ? String(current.weight)  : '',
      chest:   current?.chest   != null ? String(current.chest)   : '',
      waist:   current?.waist   != null ? String(current.waist)   : '',
      abdomen: current?.abdomen != null ? String(current.abdomen) : '',
      hips:    current?.hips    != null ? String(current.hips)    : '',
    });
    if (current && (current.chest != null || current.waist != null || current.abdomen != null || current.hips != null)) {
      setOpenSizes(true);
    }
    setHydratedSig(sig);
  }

  const latest   = useMemo(() => latestWeight(measurements), [measurements]);
  const curAvg   = useMemo(() => avg7(measurements, dateKey), [measurements, dateKey]);
  const wDelta   = useMemo(() => weeklyDelta(measurements, 'weight', dateKey), [measurements, dateKey]);
  const waistDel = useMemo(() => weeklyDelta(measurements, 'waist', dateKey), [measurements, dateKey]);
  const alert    = weightAlert(wDelta.current, wDelta.previous, ALERT_PCT);

  const wTone = deltaTone(wDelta.delta);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  // Build the PUT payload: parse each field; empty string clears (null) only if it
  // previously had a value; untouched-empty fields are omitted.
  function buildFields() {
    const fields = {};
    const keys = ['weight', ...SIZE_METRICS.map(m => m.key)];
    for (const k of keys) {
      const raw = form[k].trim();
      if (raw === '') {
        if (current && current[k] != null) fields[k] = null; // clear
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`${k} must be a number greater than 0`);
      }
      fields[k] = n;
    }
    return fields;
  }

  async function handleSave() {
    let fields;
    try {
      fields = buildFields();
    } catch (err) {
      toast.error(err.message);
      return;
    }
    if (Object.keys(fields).length === 0) {
      toast('Nothing to save');
      return;
    }
    setSaving(true);
    try {
      await save(dateKey, fields);
      toast.success('Measurement saved');
    } catch { /* hook toasts */ } finally {
      setSaving(false);
    }
  }

  async function handleDelete(date) {
    if (!confirm(`Delete measurement for ${date}?`)) return;
    try {
      await remove(date);
      toast.success('Deleted');
    } catch { /* hook toasts */ }
  }

  const recent = useMemo(
    () => measurements.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [measurements],
  );

  if (loading && measurements.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header: current weight + 7-day avg + Δ vs 7 days ago */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weight</p>
            <p className="text-3xl font-bold text-slate-800 tabular-nums">
              {latest ? fmt(latest.value) : '—'}
              <span className="text-base font-medium text-slate-400 ml-1">{weightUnit}</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              7-day avg: <span className="font-semibold text-slate-600 tabular-nums">{curAvg != null ? fmt(curAvg) : '—'}</span>
            </p>
          </div>
          <div className={`flex flex-col items-end ${wTone.text}`}>
            <div className="flex items-center gap-1">
              {wDelta.delta != null && wDelta.delta !== 0
                ? (wDelta.delta > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />)
                : null}
              <span className="text-lg font-bold tabular-nums">{formatDelta(wDelta.delta)}</span>
              <span className="text-xs font-medium">{weightUnit}</span>
            </div>
            <span className="text-[11px] text-slate-400">vs 7 days ago</span>
          </div>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-semibold">
              {alert.dir === 'gain' ? 'Gaining' : 'Losing'} {Math.abs(alert.deltaPct).toFixed(1)}% / week
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Beyond the ±{ALERT_PCT}% body-weight band. Waist Δ:{' '}
              <span className="font-semibold tabular-nums">
                {waistDel.delta != null ? `${formatDelta(waistDel.delta)} ${lengthUnit}` : '—'}
              </span>
              {waistDel.delta != null && (
                <> — {alert.dir === 'gain'
                  ? (waistDel.delta > 0 ? 'waist also up' : 'waist steady/down')
                  : (waistDel.delta < 0 ? 'waist also down' : 'waist steady/up')}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Log for selected date */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Log · {dateKey === format(new Date(), 'yyyy-MM-dd') ? 'Today' : dateKey}
        </p>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700">Weight</span>
          <span className="flex items-center gap-1.5">
            <input
              type="number" inputMode="decimal" step="0.1" min="0"
              value={form.weight}
              onChange={e => set('weight', e.target.value)}
              placeholder="—"
              className="w-24 text-right rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <span className="text-xs text-slate-400 w-6">{weightUnit}</span>
          </span>
        </label>

        <button
          onClick={() => setOpenSizes(o => !o)}
          className="flex items-center gap-1 text-xs font-semibold text-violet-600"
        >
          {openSizes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Circumferences (weekly)
        </button>

        {openSizes && (
          <div className="space-y-2.5">
            {SIZE_METRICS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="number" inputMode="decimal" step="0.1" min="0"
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    placeholder="—"
                    className="w-24 text-right rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-violet-300"
                  />
                  <span className="text-xs text-slate-400 w-6">{lengthUnit}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-violet-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save measurement'}
        </button>
      </div>

      {/* Trends — last 4 weeks */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Last 4 weeks</p>
        <div className="space-y-3">
          {[{ key: 'weight', label: 'Weight', unit: weightUnit },
            ...SIZE_METRICS.map(m => ({ ...m, unit: lengthUnit }))].map(({ key, label, unit }) => {
            const buckets = weeklyBuckets(measurements, key, 4, dateKey);
            const del = weeklyDelta(measurements, key, dateKey);
            const tone = deltaTone(del.delta);
            const last = [...buckets].reverse().find(b => b.value != null);
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-600 w-20">{label}</span>
                <Sparkline points={buckets} />
                <div className="flex items-center gap-3 justify-end w-32">
                  <span className="text-sm font-semibold text-slate-700 tabular-nums">
                    {last ? `${fmt(last.value)}` : '—'}<span className="text-[10px] text-slate-400 ml-0.5">{last ? unit : ''}</span>
                  </span>
                  <span className={`text-xs font-semibold tabular-nums w-12 text-right ${tone.text}`}>
                    {formatDelta(del.delta)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">History</p>
          <div className="divide-y divide-slate-100">
            {recent.map(m => (
              <div key={m.date} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600 tabular-nums">{m.date}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700 tabular-nums">
                    {m.weight != null ? `${fmt(m.weight)} ${weightUnit}` : '—'}
                  </span>
                  <button
                    onClick={() => handleDelete(m.date)}
                    className="p-1 rounded-full hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
