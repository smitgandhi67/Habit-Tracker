import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, Settings2, Check, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  STATUS, MAX_SETS, describeRecommendation, statusTone, formatTarget, formatWeight,
} from '../lib/progression';

function StatusIcon({ status, className }) {
  if (status === STATUS.READY)  return <TrendingUp size={16} className={className} />;
  if (status === STATUS.DELOAD) return <TrendingDown size={16} className={className} />;
  if (status === STATUS.CLIMB)  return <Sparkles size={16} className={className} />;
  if (status === STATUS.NO_HISTORY) return <Sparkles size={16} className={className} />;
  return <Minus size={16} className={className} />;
}

// Where the rep/set prescription came from. Shown so a wrong inference is
// visible rather than silently steering the recommendation.
const SOURCE_LABEL = {
  setting: 'your setting',
  plan:    'plan',
  default: 'default',
};

/**
 * The "what should I lift today" card at the top of the gym entry modal.
 *
 * `history` is the payload from GET /api/gym/exercise/:name/history — it carries
 * the recommendation, the resolved target, the step, and any stored override.
 */
export default function NextTargetCard({
  history, weightUnit, loading, onApplyWeight, onSaveSetting, onResetSetting,
}) {
  const [editing, setEditing] = useState(false);

  if (loading) {
    return <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />;
  }
  if (!history?.recommendation) return null;

  const { recommendation: rec, target, step, stepSource, setting } = history;
  const described = describeRecommendation(rec, target, weightUnit);
  if (!described) return null;

  const tone = statusTone(rec.status);
  const canApply = described.weight != null && described.weight > 0;

  return (
    <div className={`rounded-2xl border overflow-hidden ${tone.card}`}>
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <StatusIcon status={rec.status} className={tone.accent} />
              Next target
            </p>
            <p className={`text-lg font-bold mt-1 leading-tight ${tone.text}`}>
              {described.headline}
            </p>
            <p className="text-sm font-medium text-slate-600 mt-0.5">{described.repsLine}</p>
          </div>

          <button
            type="button"
            onClick={() => setEditing(v => !v)}
            title="Adjust rep range, sets and weight step"
            aria-expanded={editing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-colors shrink-0"
          >
            <Settings2 size={15} />
          </button>
        </div>

        {described.why && (
          <p className="text-xs text-slate-500 mt-2 leading-snug">{described.why}</p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {canApply && (
            <button
              type="button"
              onClick={() => onApplyWeight(described.weight)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Check size={13} /> Use {formatWeight(described.weight, weightUnit)}
            </button>
          )}
          <span className="text-[11px] text-slate-400">
            {formatTarget(target)} · {SOURCE_LABEL[target?.source] || 'default'}
            {' · step '}{formatWeight(step, weightUnit)}
            {stepSource === 'setting' ? '' : ' (default)'}
          </span>
        </div>
      </div>

      {editing && (
        <SettingEditor
          target={target}
          step={step}
          hasOverride={!!setting}
          weightUnit={weightUnit}
          onSave={async (values) => {
            try {
              await onSaveSetting(values);
              toast.success('Target updated');
              setEditing(false);
            } catch (err) {
              toast.error(err.message || 'Failed to save target');
            }
          }}
          onReset={async () => {
            try {
              await onResetSetting();
              toast.success('Back to plan defaults');
              setEditing(false);
            } catch (err) {
              toast.error(err.message || 'Failed to reset');
            }
          }}
        />
      )}
    </div>
  );
}

// Inline override editor. Seeded from the currently RESOLVED values so the user
// edits what they can see, not an empty form.
function SettingEditor({ target, step, hasOverride, weightUnit, onSave, onReset }) {
  const [repsMin,    setRepsMin]    = useState(String(target?.repsMin ?? ''));
  const [repsMax,    setRepsMax]    = useState(String(target?.repsMax ?? ''));
  const [targetSets, setTargetSets] = useState(String(target?.sets ?? ''));
  const [weightStep, setWeightStep] = useState(String(step ?? ''));
  const [saving,     setSaving]     = useState(false);

  const min  = Number(repsMin);
  const max  = Number(repsMax);
  const sets = Number(targetSets);
  const stp  = Number(weightStep);

  const error =
    !Number.isInteger(min) || min < 1 ? 'Min reps must be a whole number of at least 1'
    : !Number.isInteger(max) || max < 1 ? 'Max reps must be a whole number of at least 1'
    : min > max ? 'Min reps cannot exceed max reps'
    : !Number.isInteger(sets) || sets < 1 || sets > MAX_SETS ? `Sets must be between 1 and ${MAX_SETS}`
    : !Number.isFinite(stp) || stp <= 0 ? 'Weight step must be greater than 0'
    : null;

  async function handleSave() {
    if (error || saving) return;
    setSaving(true);
    try {
      await onSave({ repsMin: min, repsMax: max, targetSets: sets, weightStep: stp });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-white/70 bg-white/60 px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-16 shrink-0">Reps</span>
        <NumberField value={repsMin} onChange={setRepsMin} min="1" />
        <span className="text-xs text-slate-400">–</span>
        <NumberField value={repsMax} onChange={setRepsMax} min="1" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-16 shrink-0">Sets</span>
        <NumberField value={targetSets} onChange={setTargetSets} min="1" max={String(MAX_SETS)} />
        <span className="text-[11px] text-slate-400">at the top of the range unlocks the next weight</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 w-16 shrink-0">Step</span>
        <NumberField value={weightStep} onChange={setWeightStep} min="0.25" step="0.25" />
        <span className="text-[11px] text-slate-400">{weightUnit} per jump</span>
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={!!error || saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-700 transition-colors"
        >
          {saving ? 'Saving…' : 'Save target'}
        </button>
        {hasOverride && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={12} /> Use plan default
          </button>
        )}
      </div>
    </div>
  );
}

function NumberField({ value, onChange, ...rest }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
      {...rest}
    />
  );
}
