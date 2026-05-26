import { useState, useEffect, useMemo } from 'react';
import { Play, Pencil, Plus, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { useGym, BODY_PARTS } from '../hooks/useGym';
import { useAuth } from '../context/AuthContext';
import PlanEditor from './PlanEditor';

function bodyPartEmoji(key) {
  return BODY_PARTS.find(b => b.key === key)?.emoji ?? '';
}

function bodyPartLabel(key) {
  return BODY_PARTS.find(b => b.key === key)?.label ?? key;
}

// Returns one row per unique exerciseName across all plan days.
// Carries the first occurrence's prefill (sets / reps / planDayLabel).
function uniquePlannedExercises(plan) {
  const out = [];
  const seen = new Set();
  for (const day of plan?.days || []) {
    for (const ex of day.exercises || []) {
      if (!ex.exerciseName || seen.has(ex.exerciseName)) continue;
      seen.add(ex.exerciseName);
      out.push({
        bodyPart:     ex.bodyPart,
        exerciseName: ex.exerciseName,
        sets:         ex.sets,
        repsMin:      ex.repsMin,
        repsMax:      ex.repsMax,
        planDayLabel: day.label,
      });
    }
  }
  return out;
}

export default function PlanTab({ weekData, onOpenEntry }) {
  const { user } = useAuth();
  const isAdmin  = !!user?.isAdmin;
  const {
    plans, plansLoaded, activePlan, activePlanId, setActivePlanId,
    fetchExerciseList,
  } = useGym();

  const [selectedDayLabel, setSelectedDayLabel] = useState('');
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);

  // Reset day selection when active plan changes (keep if still valid).
  useEffect(() => {
    queueMicrotask(() => {
      if (!activePlan) { setSelectedDayLabel(''); return; }
      const stillValid = activePlan.days?.some(d => d.label === selectedDayLabel);
      if (!stillValid) setSelectedDayLabel(activePlan.days?.[0]?.label || '');
    });
  }, [activePlan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Library is the source of truth for videoUrl per exercise (plan stores only id/name).
  useEffect(() => {
    fetchExerciseList().then(setExerciseLibrary);
  }, [fetchExerciseList]);

  const videoUrlByName = useMemo(() => {
    const map = new Map();
    for (const ex of exerciseLibrary) {
      if (ex.videoUrl) map.set(ex.name, ex.videoUrl);
    }
    return map;
  }, [exerciseLibrary]);

  const selectedDay = activePlan?.days?.find(d => d.label === selectedDayLabel) || null;

  // This-week per-exercise tracking: which planned exercises have been logged?
  const plannedExercises = useMemo(() => uniquePlannedExercises(activePlan), [activePlan]);
  const doneExerciseNames = useMemo(
    () => new Set((weekData || []).map(e => e.exerciseName).filter(Boolean)),
    [weekData],
  );
  const { doneExercises, pendingExercises } = useMemo(() => {
    const done = [];
    const pending = [];
    for (const ex of plannedExercises) {
      if (doneExerciseNames.has(ex.exerciseName)) done.push(ex);
      else pending.push(ex);
    }
    return { doneExercises: done, pendingExercises: pending };
  }, [plannedExercises, doneExerciseNames]);

  if (!plansLoaded) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-slate-500 text-sm">No workout plans yet</p>
        <button
          onClick={() => setEditorOpen(true)}
          className="mt-4 inline-flex items-center gap-1.5 bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors"
        >
          <Plus size={16} /> Create your first plan
        </button>
        {editorOpen && <PlanEditor isAdmin={isAdmin} onClose={() => setEditorOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan selector + edit */}
      <div className="flex items-center gap-2">
        <select
          value={activePlanId || ''}
          onChange={e => setActivePlanId(e.target.value)}
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          {plans.map(p => (
            <option key={p._id} value={p._id}>
              {p.name}{p.isMaster ? ' (master)' : ''}
            </option>
          ))}
        </select>
        <button
          onClick={() => setEditorOpen(true)}
          className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Edit plans"
        >
          <Pencil size={16} className="text-slate-500" />
        </button>
      </div>

      {/* Day picker */}
      {activePlan && (
        <div className="flex flex-wrap gap-2">
          {activePlan.days?.map(d => (
            <button
              key={d.label}
              onClick={() => setSelectedDayLabel(d.label)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedDayLabel === d.label
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {d.label}{d.focus ? ` · ${d.focus}` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Selected day exercises */}
      {selectedDay && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          {selectedDay.notes && (
            <p className="text-xs text-slate-500 mb-3 italic">{selectedDay.notes}</p>
          )}
          {(!selectedDay.exercises || selectedDay.exercises.length === 0) ? (
            <p className="text-xs text-slate-400">No exercises in this day yet.</p>
          ) : (
            <div className="space-y-2">
              {selectedDay.exercises.map((ex, i) => {
                const videoUrl = videoUrlByName.get(ex.exerciseName);
                const reps = ex.repsMin && ex.repsMax
                  ? (ex.repsMin === ex.repsMax ? `${ex.repsMin}` : `${ex.repsMin}-${ex.repsMax}`)
                  : '';
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <button
                      onClick={() => onOpenEntry?.({
                        bodyPart:     ex.bodyPart,
                        exerciseName: ex.exerciseName,
                        sets:         ex.sets,
                        repsMin:      ex.repsMin,
                        repsMax:      ex.repsMax,
                        planDayLabel: selectedDay.label,
                      })}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs shrink-0">{bodyPartEmoji(ex.bodyPart)}</span>
                        <span className="text-sm font-medium text-slate-800 truncate">{ex.exerciseName}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ex.sets} × {reps || 'reps'} {ex.notes ? `· ${ex.notes}` : ''}
                      </p>
                    </button>
                    {videoUrl && (
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full text-violet-500 hover:bg-violet-50 transition-colors shrink-0"
                        title="Watch demo"
                      >
                        <Play size={14} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* This week — per-exercise Done / Pending */}
      {activePlan && plannedExercises.length > 0 && (
        <ThisWeekExercises
          done={doneExercises}
          pending={pendingExercises}
          onOpenPending={onOpenEntry}
        />
      )}

      {editorOpen && <PlanEditor isAdmin={isAdmin} onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

function ThisWeekExercises({ done, pending, onOpenPending }) {
  const [pendingOpen, setPendingOpen] = useState(true);
  const [doneOpen, setDoneOpen] = useState(false);
  const total = done.length + pending.length;
  const allCaughtUp = pending.length === 0;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">This week</p>
        <p className="text-xs font-semibold text-slate-600">{done.length} / {total} done</p>
      </div>

      <SectionHeader
        label={allCaughtUp ? 'Pending (0) — all caught up 🎉' : `Pending (${pending.length}) — catch up`}
        open={pendingOpen && pending.length > 0}
        onToggle={() => setPendingOpen(v => !v)}
        disabled={pending.length === 0}
        tone="amber"
      />
      {pendingOpen && pending.length > 0 && (
        <ul className="mt-2 mb-3 space-y-1">
          {pending.map(ex => (
            <li key={ex.exerciseName}>
              <button
                type="button"
                onClick={() => onOpenPending?.(ex)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors text-left"
              >
                <Circle size={16} className="text-amber-400 shrink-0" />
                <span className="text-sm shrink-0">{bodyPartEmoji(ex.bodyPart)}</span>
                <span className="text-sm text-slate-700 flex-1 truncate">{ex.exerciseName}</span>
                <span className="text-xs text-slate-400 shrink-0">{bodyPartLabel(ex.bodyPart)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <SectionHeader
        label={`Done (${done.length})`}
        open={doneOpen && done.length > 0}
        onToggle={() => setDoneOpen(v => !v)}
        disabled={done.length === 0}
        tone="green"
      />
      {doneOpen && done.length > 0 && (
        <ul className="mt-2 space-y-1">
          {done.map(ex => (
            <li key={ex.exerciseName} className="flex items-center gap-2 px-2 py-1.5">
              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              <span className="text-sm shrink-0">{bodyPartEmoji(ex.bodyPart)}</span>
              <span className="text-sm text-slate-700 flex-1 truncate">{ex.exerciseName}</span>
              <span className="text-xs text-slate-400 shrink-0">{bodyPartLabel(ex.bodyPart)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionHeader({ label, open, onToggle, disabled, tone }) {
  const toneCls = tone === 'amber' ? 'text-amber-700' : 'text-green-700';
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-full flex items-center gap-1.5 py-1 ${disabled ? 'opacity-60 cursor-default' : 'hover:opacity-80'}`}
    >
      {!disabled && (open
        ? <ChevronUp size={14} className="text-slate-400" />
        : <ChevronDown size={14} className="text-slate-400" />
      )}
      <span className={`text-xs font-semibold ${toneCls}`}>{label}</span>
    </button>
  );
}
