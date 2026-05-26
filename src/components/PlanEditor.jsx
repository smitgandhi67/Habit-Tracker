import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronRight, Archive, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGym, BODY_PARTS } from '../hooks/useGym';

function emptyDay(label = 'New day') {
  return { label, focus: '', isRestDay: false, notes: '', exercises: [] };
}

function emptyExercise() {
  return { exerciseName: '', bodyPart: 'chest', sets: 3, repsMin: 8, repsMax: 10, notes: '', order: 0 };
}

export default function PlanEditor({ isAdmin, onClose }) {
  const {
    plans, refetchPlans,
    createPlan, updatePlan, archivePlan,
    fetchExerciseList,
  } = useGym();

  const [selectedId, setSelectedId] = useState(plans[0]?._id || null);
  const [draft,      setDraft]      = useState(null); // working copy of selected plan
  const [library,    setLibrary]    = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [openDays,   setOpenDays]   = useState({}); // day index → bool

  useEffect(() => {
    fetchExerciseList().then(setLibrary);
  }, [fetchExerciseList]);

  // Load draft when selection changes.
  useEffect(() => {
    if (!selectedId) { setDraft(null); return; }
    const plan = plans.find(p => p._id === selectedId);
    if (!plan) { setDraft(null); return; }
    // Deep-ish clone (plan is plain JSON from API).
    setDraft(JSON.parse(JSON.stringify(plan)));
    setOpenDays({});
  }, [selectedId, plans]);

  const canWrite = useMemo(() => {
    if (!draft) return false;
    if (draft.isMaster) return isAdmin;
    return true; // user always owns their own private plans here
  }, [draft, isAdmin]);

  const exercisesByBodyPart = useMemo(() => {
    const map = {};
    for (const ex of library) {
      if (!map[ex.bodyPart]) map[ex.bodyPart] = [];
      map[ex.bodyPart].push(ex);
    }
    return map;
  }, [library]);

  function startNewPlan() {
    setSelectedId('__new__');
    setDraft({
      _id: null, isMaster: false, name: 'My plan', description: '',
      days: [emptyDay('Day 1')],
    });
  }

  function updateDraft(patch) {
    setDraft(prev => prev ? { ...prev, ...patch } : prev);
  }

  function updateDay(idx, patch) {
    setDraft(prev => {
      if (!prev) return prev;
      const days = prev.days.slice();
      days[idx] = { ...days[idx], ...patch };
      return { ...prev, days };
    });
  }

  function removeDay(idx) {
    if (!confirm('Remove this day from the plan?')) return;
    setDraft(prev => prev ? { ...prev, days: prev.days.filter((_, i) => i !== idx) } : prev);
  }

  function addDay() {
    setDraft(prev => {
      if (!prev) return prev;
      const next = `Day ${prev.days.length + 1}`;
      return { ...prev, days: [...prev.days, emptyDay(next)] };
    });
  }

  function updateExercise(dayIdx, exIdx, patch) {
    setDraft(prev => {
      if (!prev) return prev;
      const days = prev.days.slice();
      const exs  = days[dayIdx].exercises.slice();
      exs[exIdx] = { ...exs[exIdx], ...patch };
      days[dayIdx] = { ...days[dayIdx], exercises: exs };
      return { ...prev, days };
    });
  }

  function removeExercise(dayIdx, exIdx) {
    setDraft(prev => {
      if (!prev) return prev;
      const days = prev.days.slice();
      days[dayIdx] = {
        ...days[dayIdx],
        exercises: days[dayIdx].exercises.filter((_, i) => i !== exIdx),
      };
      return { ...prev, days };
    });
  }

  function addExercise(dayIdx) {
    setDraft(prev => {
      if (!prev) return prev;
      const days = prev.days.slice();
      const exs  = [...days[dayIdx].exercises, { ...emptyExercise(), order: days[dayIdx].exercises.length }];
      days[dayIdx] = { ...days[dayIdx], exercises: exs };
      return { ...prev, days };
    });
  }

  async function handleSave() {
    if (!draft) return;
    if (!draft.name?.trim()) { toast.error('Plan needs a name'); return; }
    setSaving(true);
    try {
      const body = {
        name: draft.name.trim(),
        description: draft.description || '',
        days: draft.days.map(d => ({
          label: d.label?.trim() || 'Day',
          focus: d.focus || '',
          isRestDay: !!d.isRestDay,
          notes: d.notes || '',
          exercises: (d.exercises || []).map((ex, i) => ({
            exerciseId:   ex.exerciseId || undefined,
            exerciseName: ex.exerciseName?.trim() || '',
            bodyPart:     ex.bodyPart || 'full_body',
            sets:         Number(ex.sets) || 3,
            repsMin:      ex.repsMin ? Number(ex.repsMin) : undefined,
            repsMax:      ex.repsMax ? Number(ex.repsMax) : undefined,
            notes:        ex.notes || '',
            order:        i,
          })).filter(ex => ex.exerciseName),
        })),
      };
      if (draft._id) {
        await updatePlan(draft._id, body);
        toast.success('Plan updated');
      } else {
        const created = await createPlan(body);
        setSelectedId(created._id);
        toast.success('Plan created');
      }
      await refetchPlans();
    } catch (err) {
      toast.error(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!draft?._id) return;
    if (!confirm(`Archive plan "${draft.name}"? You can restore it later.`)) return;
    try {
      await archivePlan(draft._id);
      toast.success('Plan archived');
      setSelectedId(null);
      setDraft(null);
    } catch (err) {
      toast.error(err.message || 'Failed to archive');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Workout plans</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col sm:flex-row">
          {/* Plan list */}
          <div className="sm:w-56 sm:border-r border-slate-100 p-3 space-y-1 shrink-0">
            <button
              onClick={startNewPlan}
              className="w-full flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:bg-violet-50 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={14} /> New plan
            </button>
            <div className="h-px bg-slate-100 my-1" />
            {plans.map(p => (
              <button
                key={p._id}
                onClick={() => setSelectedId(p._id)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  selectedId === p._id ? 'bg-violet-100 text-violet-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p.isMaster && <Star size={12} className="text-amber-500 shrink-0" />}
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            {plans.length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-2 italic">No plans yet</p>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 p-5 overflow-y-auto">
            {!draft ? (
              <p className="text-sm text-slate-400">Select a plan to edit, or create a new one.</p>
            ) : (
              <>
                {draft.isMaster && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-1.5">
                    <Star size={12} />
                    Master plan {!isAdmin && '— read-only (admin can edit)'}
                  </div>
                )}

                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</label>
                <input
                  className="w-full mt-1 mb-3 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50"
                  value={draft.name || ''}
                  onChange={e => updateDraft({ name: e.target.value })}
                  disabled={!canWrite}
                  placeholder="e.g. 3-Day Full Body"
                />

                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
                <textarea
                  className="w-full mt-1 mb-4 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50"
                  rows={2}
                  value={draft.description || ''}
                  onChange={e => updateDraft({ description: e.target.value })}
                  disabled={!canWrite}
                  placeholder="Optional"
                />

                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Days</p>
                  {canWrite && (
                    <button onClick={addDay} className="text-xs text-violet-600 font-medium hover:underline flex items-center gap-1">
                      <Plus size={12} /> Add day
                    </button>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  {draft.days.map((day, dayIdx) => {
                    const open = !!openDays[dayIdx];
                    return (
                      <div key={dayIdx} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 p-2 bg-slate-50">
                          <button
                            onClick={() => setOpenDays(o => ({ ...o, [dayIdx]: !open }))}
                            className="p-1 text-slate-500"
                          >
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <input
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:bg-slate-100"
                            value={day.label}
                            onChange={e => updateDay(dayIdx, { label: e.target.value })}
                            disabled={!canWrite}
                          />
                          <input
                            className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:bg-slate-100"
                            placeholder="Focus"
                            value={day.focus || ''}
                            onChange={e => updateDay(dayIdx, { focus: e.target.value })}
                            disabled={!canWrite}
                          />
                          {canWrite && (
                            <button onClick={() => removeDay(dayIdx)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {open && (
                          <div className="p-3 space-y-2">
                            <input
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:bg-slate-50"
                              placeholder="Day notes (optional)"
                              value={day.notes || ''}
                              onChange={e => updateDay(dayIdx, { notes: e.target.value })}
                              disabled={!canWrite}
                            />

                            {day.exercises.map((ex, exIdx) => (
                              <div key={exIdx} className="border border-slate-200 rounded-lg p-2 space-y-1.5 bg-white">
                                <div className="flex gap-1.5">
                                  <select
                                    className="w-24 border border-slate-200 rounded px-1.5 py-1 text-xs disabled:bg-slate-50"
                                    value={ex.bodyPart}
                                    onChange={e => updateExercise(dayIdx, exIdx, { bodyPart: e.target.value, exerciseName: '' })}
                                    disabled={!canWrite}
                                  >
                                    {BODY_PARTS.map(bp => (
                                      <option key={bp.key} value={bp.key}>{bp.label}</option>
                                    ))}
                                  </select>
                                  <select
                                    className="flex-1 border border-slate-200 rounded px-1.5 py-1 text-xs disabled:bg-slate-50"
                                    value={ex.exerciseName}
                                    onChange={e => updateExercise(dayIdx, exIdx, { exerciseName: e.target.value })}
                                    disabled={!canWrite}
                                  >
                                    <option value="">Pick exercise…</option>
                                    {(exercisesByBodyPart[ex.bodyPart] || []).map(libEx => (
                                      <option key={libEx._id} value={libEx.name}>{libEx.name}</option>
                                    ))}
                                  </select>
                                  {canWrite && (
                                    <button
                                      onClick={() => removeExercise(dayIdx, exIdx)}
                                      className="p-1 text-red-400 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <div className="flex gap-1.5 items-center">
                                  <input
                                    type="number" min="1" max="10"
                                    className="w-12 border border-slate-200 rounded px-1.5 py-1 text-xs disabled:bg-slate-50"
                                    value={ex.sets}
                                    onChange={e => updateExercise(dayIdx, exIdx, { sets: e.target.value })}
                                    disabled={!canWrite}
                                    title="Sets"
                                  />
                                  <span className="text-xs text-slate-400">sets</span>
                                  <input
                                    type="number" min="1"
                                    className="w-12 border border-slate-200 rounded px-1.5 py-1 text-xs disabled:bg-slate-50"
                                    value={ex.repsMin || ''}
                                    onChange={e => updateExercise(dayIdx, exIdx, { repsMin: e.target.value })}
                                    disabled={!canWrite}
                                    placeholder="min"
                                  />
                                  <span className="text-xs text-slate-400">–</span>
                                  <input
                                    type="number" min="1"
                                    className="w-12 border border-slate-200 rounded px-1.5 py-1 text-xs disabled:bg-slate-50"
                                    value={ex.repsMax || ''}
                                    onChange={e => updateExercise(dayIdx, exIdx, { repsMax: e.target.value })}
                                    disabled={!canWrite}
                                    placeholder="max"
                                  />
                                  <span className="text-xs text-slate-400">reps</span>
                                </div>
                                <input
                                  className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs text-slate-600 disabled:bg-slate-50"
                                  placeholder="Notes (optional)"
                                  value={ex.notes || ''}
                                  onChange={e => updateExercise(dayIdx, exIdx, { notes: e.target.value })}
                                  disabled={!canWrite}
                                />
                              </div>
                            ))}

                            {canWrite && (
                              <button
                                onClick={() => addExercise(dayIdx)}
                                className="w-full text-xs text-violet-600 font-medium hover:bg-violet-50 py-1.5 rounded-lg flex items-center justify-center gap-1"
                              >
                                <Plus size={12} /> Add exercise
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {canWrite && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all"
                    >
                      {saving ? 'Saving…' : draft._id ? 'Save changes' : 'Create plan'}
                    </button>
                    {draft._id && (
                      <button
                        onClick={handleArchive}
                        className="px-4 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-sm font-medium flex items-center gap-1.5"
                      >
                        <Archive size={14} /> Archive
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
