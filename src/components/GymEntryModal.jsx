import { useState, useEffect } from 'react';
import { X, Plus, Minus, Trophy } from 'lucide-react';
import { BODY_PARTS, FEEL_OPTIONS } from '../hooks/useGym';

const DEFAULT_SET = { reps: '', weight: '' };

export default function GymEntryModal({ date, entry, fetchExerciseList, fetchExerciseHistory, onSave, onClose }) {
  const isEdit = !!entry;

  const [bodyPart,     setBodyPart]     = useState(entry?.bodyPart     || '');
  const [exerciseName, setExerciseName] = useState(entry?.exerciseName || '');
  const [feel,         setFeel]         = useState(entry?.feel         || 'medium');
  const [sets,         setSets]         = useState(
    entry?.sets?.length
      ? entry.sets.map(s => ({ reps: String(s.reps ?? ''), weight: String(s.weight ?? '') }))
      : [{ ...DEFAULT_SET }]
  );
  const [saving,      setSaving]      = useState(false);
  const [history,     setHistory]     = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [exercises,   setExercises]   = useState([]);
  const [exLoading,   setExLoading]   = useState(false);

  // Load exercises when body part changes
  useEffect(() => {
    if (!bodyPart) { setExercises([]); setExerciseName(''); return; }
    setExLoading(true);
    setExerciseName('');
    setHistory(null);
    fetchExerciseList(bodyPart).then(list => {
      setExercises(list);
      setExLoading(false);
    });
  }, [bodyPart]); // eslint-disable-line react-hooks/exhaustive-deps

  // If editing, load exercise list for the pre-selected body part once
  useEffect(() => {
    if (isEdit && entry.bodyPart) {
      fetchExerciseList(entry.bodyPart).then(list => {
        setExercises(list);
      });
      if (entry.exerciseName) loadHistory(entry.exerciseName);
    }
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

  // Sets helpers
  function updateSet(i, field, val) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }
  function addSet() {
    if (sets.length < 3) setSets(prev => [...prev, { ...DEFAULT_SET }]);
  }
  function removeSet(i) {
    if (sets.length > 1) setSets(prev => prev.filter((_, idx) => idx !== i));
  }

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
          reps:   Number(s.reps)   || 0,
          weight: Number(s.weight) || 0,
        })),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

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
                          <span key={i} className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600">
                            {s.reps} reps{s.weight ? ` × ${s.weight}kg` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {history.pr && history.pr.prWeight > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Trophy size={13} className="text-amber-500" />
                      <p className="text-xs text-amber-700 font-medium">
                        All-time PR: {history.pr.prWeight}kg on {history.pr.date}
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sets</p>
              <div className="space-y-2">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5 text-center font-medium">{i + 1}</span>
                    <input
                      type="number"
                      min="0"
                      value={s.reps}
                      onChange={e => updateSet(i, 'reps', e.target.value)}
                      placeholder="Reps"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <span className="text-xs text-slate-400">×</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={s.weight}
                      onChange={e => updateSet(i, 'weight', e.target.value)}
                      placeholder="kg"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    {sets.length > 1 && (
                      <button onClick={() => removeSet(i)} className="p-1 rounded-full hover:bg-red-50 text-red-400 transition-colors">
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {sets.length < 3 && (
                <button
                  onClick={addSet}
                  className="mt-2 flex items-center gap-1 text-xs text-violet-600 font-medium hover:text-violet-700 transition-colors"
                >
                  <Plus size={13} /> Add set
                </button>
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
