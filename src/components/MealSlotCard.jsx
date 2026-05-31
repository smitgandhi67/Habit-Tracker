import { useState } from 'react';
import { Check, X, Repeat, Flame, Drumstick } from 'lucide-react';
import { SLOT_LABELS } from '../lib/mealLogs';

const STATUS = {
  not_started: { label: 'Tap a button to log',  cardBg: 'bg-white' },
  done:        { label: 'Done',                  cardBg: 'bg-green-50' },
  skipped:     { label: 'Skipped',               cardBg: 'bg-slate-50' },
  swapped:     { label: 'Swapped',               cardBg: 'bg-amber-50' },
};

const PALETTES = {
  green: {
    active:   'bg-green-500 text-white border-green-600',
    inactive: 'bg-white text-slate-500 border-slate-200 hover:border-green-300 hover:text-green-600',
  },
  slate: {
    active:   'bg-slate-500 text-white border-slate-600',
    inactive: 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700',
  },
  amber: {
    active:   'bg-amber-500 text-white border-amber-600',
    inactive: 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600',
  },
};

function StatusButton({ active, color, onClick, Icon, label }) {
  const p = PALETTES[color] || PALETTES.slate;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 rounded-xl border py-1.5 px-2 text-xs font-medium transition-colors ${active ? p.active : p.inactive}`}
    >
      <Icon size={14} strokeWidth={2.5} />
      <span>{label}</span>
    </button>
  );
}

export default function MealSlotCard({ meal, log, onChange }) {
  const status   = log?.status   || 'not_started';
  const swapNote = log?.swapNote || '';
  const s        = STATUS[status] || STATUS.not_started;
  const [showSwap, setShowSwap] = useState(status === 'swapped');

  const cycle = (target) => {
    if (target === 'swapped') setShowSwap(true);
    else                       setShowSwap(false);
    // Tapping the active status again clears back to not_started.
    const next = status === target ? 'not_started' : target;
    onChange({ status: next, swapNote: next === 'swapped' ? swapNote : '' });
  };

  return (
    <div className={`rounded-2xl border border-slate-100 shadow-sm p-4 transition-colors ${s.cardBg}`}>
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">
            {SLOT_LABELS[meal.slot] || meal.slot}
          </p>
          <p className="font-semibold text-slate-800 leading-tight mt-0.5">{meal.name}</p>
          {meal.foods && meal.foods !== meal.name && (
            <p className="text-xs text-slate-500 mt-1 leading-snug">{meal.foods}</p>
          )}
        </div>
        <div className="flex flex-col items-end shrink-0 text-right">
          {meal.calories != null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-2 py-0.5">
              <Flame size={11} className="text-orange-400" />
              {meal.calories}
            </span>
          )}
          {meal.protein != null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-2 py-0.5 mt-1">
              <Drumstick size={11} className="text-rose-400" />
              {meal.protein}g
            </span>
          )}
        </div>
      </div>

      {meal.micros && (
        <p className="text-[11px] text-slate-400 italic mb-3">{meal.micros}</p>
      )}

      <div className="flex gap-2">
        <StatusButton active={status === 'done'}    color="green"  onClick={() => cycle('done')}    Icon={Check}  label="Done" />
        <StatusButton active={status === 'skipped'} color="slate"  onClick={() => cycle('skipped')} Icon={X}      label="Skipped" />
        <StatusButton active={status === 'swapped'} color="amber"  onClick={() => cycle('swapped')} Icon={Repeat} label="Swapped" />
      </div>

      {showSwap && (
        <textarea
          rows={2}
          value={swapNote}
          onChange={e => onChange({ status: 'swapped', swapNote: e.target.value })}
          placeholder="What did you eat instead?"
          className="w-full mt-2 border border-amber-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
        />
      )}

      <p className="text-[11px] text-slate-400 mt-2">{s.label}</p>
    </div>
  );
}
