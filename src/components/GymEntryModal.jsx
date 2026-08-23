import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Minus, Trophy, ShieldCheck, Flame } from 'lucide-react';
import { BODY_PARTS, FEEL_OPTIONS } from '../hooks/useGym';
import { useAuth } from '../context/AuthContext';
import { previewUnlock } from '../lib/progression';
import NextTargetCard from './NextTargetCard';

const DEFAULT_SET = { reps: '', weight: '', isWarmup: false };

// Mirrors GymEntry.MAX_SETS_PER_ENTRY on the server. Warmups, working sets and
// back-off sets all count against it.
const MAX_SETS = 12;

// Eight non-negotiable safety self-checks from the master plan.
const SAFETY_ITEMS = [
  { key: 'warmup',       label: 'Warmed up 8-10 min (cardio + mobility + warmup sets)' },
  { key: 'eccentric',    label: 'Controlled eccentric (2-3 sec down, 1 sec up)' },
  { key: 'notToFailure', label: 'Stopped 1-2 reps shy of failure' },
  { key: 'breathing',    label: 'Exhaled on exertion, no breath-holding' },
  { key: 'noJointPain',  label: 'No sharp / joint pain' },
  { key: 'noBehindNeck', label: 'No behind-the-neck pulldowns or presses' },
  { key: 'noLockout',    label: 'No locked knees / elbows under heavy load' },
  { key: 'recovered',    label: '48h since training the same muscle' },
];

function emptySafetyChecks() {
  return Object.fromEntries(SAFETY_ITEMS.map(i => [i.key, false]));
}

export default function GymEntryModal({
  date, entry, prefill,
  fetchExerciseList, fetchExerciseHistory,
  saveExerciseSetting, resetExerciseSetting,
  onSave, onClose,
}) {
  const isEdit = !!entry;
  const { user } = useAuth() || {};
  const weightUnit = user?.weightUnit || 'lb';

  const initialBodyPart     = entry?.bodyPart     ?? prefill?.bodyPart     ?? '';
  const initialExerciseName = entry?.exerciseName ?? prefill?.exerciseName ?? '';
  const initialFeel         = entry?.feel         ?? 'medium';
  const initialSets = entry?.sets?.length
    ? entry.sets.map(s => ({
        reps: String(s.reps ?? ''),
        weight: String(s.weight ?? ''),
        isWarmup: !!s.isWarmup,
      }))
    : prefill?.sets
      // Honour the plan's prescribed set count (it can now exceed 3).
      ? Array.from({ length: Math.min(MAX_SETS, Math.max(1, Number(prefill.sets) || 1)) },
          () => ({ ...DEFAULT_SET }))
      : [{ ...DEFAULT_SET }];

  const [bodyPart,     setBodyPart]     = useState(initialBodyPart);
  const [exerciseName, setExerciseName] = useState(initialExerciseName);
  const [feel,         setFeel]         = useState(initialFeel);
  const [sets,         setSets]         = useState(initialSets);
  const [planDayLabel] = useState(entry?.planDayLabel ?? prefill?.planDayLabel ?? ''); // read-only badge; never reset after mount
  const [safetyChecks, setSafetyChecks] = useState(() => ({
    ...emptySafetyChecks(),
    ...(entry?.safetyChecks || {}),
  }));
  const [safetyOpen, setSafetyOpen] = useState(!isEdit); // expanded for new entries, collapsed for edits
  const [saving,      setSaving]      = useState(false);
  const [history,     setHistory]     = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [exercises,   setExercises]   = useState([]);
  const [exLoading,   setExLoading]   = useState(false);

  // Skip the initial body-part effect if exerciseName came pre-populated from
  // edit/prefill — otherwise it would get cleared the moment exercises load.
  const skipInitialBodyPartReset = useRef(!!initialExerciseName);

  // Load exercises when body part changes. Resets dependent fields synchronously so
  // stale exercise/history never flashes; this is an intentional reset-on-change effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!bodyPart) { setExercises([]); setExerciseName(''); return; }
    setExLoading(true);
    if (skipInitialBodyPartReset.current) {
      skipInitialBodyPartReset.current = false;
    } else {
      setExerciseName('');
      setHistory(null);
    }
    fetchExerciseList(bodyPart).then(list => {
      setExercises(list);
      setExLoading(false);
    });
  }, [bodyPart]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load history for pre-populated exercise (edit OR plan-driven prefill).
  useEffect(() => {
    if (initialExerciseName) loadHistory(initialExerciseName);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadHistory(name) {
    if (!name) { setHistory(null); return; }
    setHistLoading(true);
    const h = await fetchExerciseHistory(name);
    setHistory(h);
    setHistLoading(false);
  }

  function handleExerciseChange(name) {
    setExerciseName(name);
    loadHistory(name);
  }

  // Saving a per-exercise override changes the target, which changes the
  // recommendation — so reload the history to show the new advice immediately.
  async function handleSaveSetting(values) {
    await saveExerciseSetting(exerciseName, values);
    await loadHistory(exerciseName);
  }

  async function handleResetSetting() {
    await resetExerciseSetting(exerciseName);
    await loadHistory(exerciseName);
  }

  // Sets helpers
  function updateSet(i, field, val) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function addSet() {
    setSets(prev => {
      if (prev.length >= MAX_SETS) return prev;
      // Carry the last set's weight forward — straight sets are the common case,
      // so this saves a tap per set on a long session.
      const last = prev[prev.length - 1];
      return [...prev, { ...DEFAULT_SET, weight: last?.weight ?? '' }];
    });
  }
  function removeSet(i) {
    if (sets.length > 1) setSets(prev => prev.filter((_, idx) => idx !== i));
  }
  function toggleWarmup(i) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, isWarmup: !s.isWarmup } : s));
  }

  // Fill every working (non-warmup) row with the recommended weight.
  function applyWeightToWorkingSets(weight) {
    setSets(prev => prev.map(s => s.isWarmup ? s : { ...s, weight: String(weight) }));
  }

  const warmupCount     = sets.filter(s => s.isWarmup).length;
  const workingSetCount = sets.length - warmupCount;

  // Working sets are numbered 1..n independently of warmup rows, so the numbers
  // line up with the "3 sets of 10" the plan prescribes.
  function workingIndexOf(i) {
    return sets.slice(0, i + 1).filter(s => !s.isWarmup).length;
  }

  // Optimistic preview of whether the rows on screen unlock the next weight.
  // The authoritative status still comes from the server on the next open.
  const unlockPreview = useMemo(
    () => previewUnlock({ sets, target: history?.target, step: history?.step, unit: weightUnit }),
    [sets, history?.target, history?.step, weightUnit],
  );

  const canSave = bodyPart && exerciseName && sets.every(s => s.reps !== '');

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        date,
        bodyPart,
        exerciseName,
        feel,
        sets: sets.map(s => ({
          reps:     Number(s.reps)   || 0,
          weight:   Number(s.weight) || 0,
          isWarmup: !!s.isWarmup,
        })),
        planDayLabel: planDayLabel || '',
        safetyChecks,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function toggleSafety(key) {
    setSafetyChecks(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const safetyDoneCount = SAFETY_ITEMS.filter(i => safetyChecks[i.key]).length;

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92svh] pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit entry' : 'Log exercise'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {planDayLabel && (
            <div className="-mt-1 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700 font-medium">
              From plan: {planDayLabel}
            </div>
          )}

          {/* Safety self-check */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setSafetyOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <ShieldCheck size={14} className="text-emerald-500" />
                Form check
              </span>
              <span className="text-xs text-slate-500">{safetyDoneCount}/{SAFETY_ITEMS.length}</span>
            </button>
            {safetyOpen && (
              <div className="px-4 py-3 space-y-2">
                {SAFETY_ITEMS.map(({ key, label }) => (
                  <label key={key} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!safetyChecks[key]}
                      onChange={() => toggleSafety(key)}
                      className="mt-0.5 w-4 h-4 accent-violet-600 cursor-pointer"
                    />
                    <span className="text-xs text-slate-700 leading-snug">{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Body part grid */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Body part</p>
            <div className="grid grid-cols-4 gap-2">
              {BODY_PARTS.map(({ key, label, emoji }) => (
                <button
                  key={key}
                  onClick={() => setBodyPart(key)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs font-medium transition-colors
                    ${bodyPart === key
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300'
                    }`}
                >
                  <span className="text-lg leading-none">{emoji}</span>
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Exercise dropdown */}
          {bodyPart && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Exercise</p>
              {exLoading ? (
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ) : exercises.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  No exercises set up for this body part yet. Use <strong>Manage exercises</strong> to add some.
                </div>
              ) : (
                <select
                  value={exerciseName}
                  onChange={e => handleExerciseChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 appearance-none"
                >
                  <option value="">Select exercise…</option>
                  {exercises.map(ex => (
                    <option key={ex._id} value={ex.name}>{ex.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Next-weight recommendation */}
          {exerciseName && (
            <NextTargetCard
              history={history}
              weightUnit={weightUnit}
              loading={histLoading}
              onApplyWeight={applyWeightToWorkingSets}
              onSaveSetting={handleSaveSetting}
              onResetSetting={handleResetSetting}
            />
          )}

          {/* History panel */}
          {exerciseName && (
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              {histLoading ? (
                <p className="text-xs text-slate-400">Loading history…</p>
              ) : history ? (
                <>
                  {history.last && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Last session ({history.last.date})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {history.last.sets.map((s, i) => (
                          <span
                            key={i}
                            className={`text-xs border rounded-lg px-2 py-1 ${
                              s.isWarmup
                                ? 'bg-orange-50 border-orange-100 text-orange-500'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {s.isWarmup && <span className="font-semibold mr-1">W</span>}
                            {s.reps} reps{s.weight ? ` × ${s.weight}${weightUnit}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {history.pr && history.pr.prWeight > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Trophy size={13} className="text-amber-500" />
                      <p className="text-xs text-amber-700 font-medium">
                        All-time PR: {history.pr.prWeight}{weightUnit} on {history.pr.date}
                      </p>
                    </div>
                  )}
                  {!history.last && !history.pr && (
                    <p className="text-xs text-slate-400">No history yet — first time!</p>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* Sets */}
          {exerciseName && (
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sets</p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  {workingSetCount} working{warmupCount > 0 ? ` · ${warmupCount} warmup` : ''}
                </p>
              </div>
              <div className="space-y-2">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={`text-xs w-4 text-center font-medium ${s.isWarmup ? 'text-orange-400' : 'text-slate-400'}`}>
                      {s.isWarmup ? 'W' : workingIndexOf(i)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleWarmup(i)}
                      title={s.isWarmup ? 'Warmup set — not counted toward progression' : 'Mark as warmup set'}
                      aria-pressed={s.isWarmup}
                      className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                        s.isWarmup
                          ? 'bg-orange-50 border-orange-200 text-orange-500'
                          : 'bg-white border-slate-200 text-slate-300 hover:text-orange-400 hover:border-orange-200'
                      }`}
                    >
                      <Flame size={13} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={s.reps}
                      onChange={e => updateSet(i, 'reps', e.target.value)}
                      placeholder="Reps"
                      className={`flex-1 min-w-0 border rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-400 ${
                        s.isWarmup ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-200'
                      }`}
                    />
                    <span className="text-xs text-slate-400">×</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={s.weight}
                      onChange={e => updateSet(i, 'weight', e.target.value)}
                      placeholder={weightUnit}
                      className={`flex-1 min-w-0 border rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-400 ${
                        s.isWarmup ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-200'
                      }`}
                    />
                    {sets.length > 1 && (
                      <button
                        onClick={() => removeSet(i)}
                        title="Remove set"
                        className="p-1 rounded-full hover:bg-red-50 text-red-400 transition-colors shrink-0"
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {sets.length < MAX_SETS ? (
                <button
                  onClick={addSet}
                  className="mt-2 flex items-center gap-1 text-xs text-violet-600 font-medium hover:text-violet-700 transition-colors"
                >
                  <Plus size={13} /> Add set
                </button>
              ) : (
                <p className="mt-2 text-[11px] text-slate-400">Maximum {MAX_SETS} sets per exercise.</p>
              )}

              {/* Live unlock preview — recomputed as the user types, so they can
                  see the next weight coming before they save. */}
              {unlockPreview && (
                <div className={`mt-3 px-3 py-2 rounded-xl border text-xs font-medium ${unlockPreview.tone}`}>
                  {unlockPreview.text}
                </div>
              )}
            </div>
          )}

          {/* Feel */}
          {exerciseName && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">How did it feel?</p>
              <div className="flex gap-2">
                {FEEL_OPTIONS.map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setFeel(key)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors
                      ${feel === key ? color : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-3 rounded-2xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Update entry' : 'Log exercise'}
          </button>
        </div>
      </div>
    </div>
  );
}
