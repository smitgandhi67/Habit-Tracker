import { useState, useEffect, useMemo } from 'react';
import { startOfWeek, format, addDays } from 'date-fns';
import { Play, Pencil, Plus, CheckCircle2, Circle } from 'lucide-react';
import { useGym, BODY_PARTS } from '../hooks/useGym';
import { useAuth } from '../context/AuthContext';
import PlanEditor from './PlanEditor';

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function bodyPartEmoji(key) {
  return BODY_PARTS.find(b => b.key === key)?.emoji ?? '';
}

function getThisWeekDates() {
  const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(mon, i), 'yyyy-MM-dd'));
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
    if (!activePlan) { setSelectedDayLabel(''); return; }
    const stillValid = activePlan.days?.some(d => d.label === selectedDayLabel);
    if (!stillValid) setSelectedDayLabel(activePlan.days?.[0]?.label || '');
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

  // Week grid: which plan days have a logged session with matching planDayLabel?
  const weekDates = getThisWeekDates();
  const today = format(new Date(), 'yyyy-MM-dd');
  const dayLabelToDates = useMemo(() => {
    const map = {};
    for (const entry of weekData) {
      if (!entry.planDayLabel || !weekDates.includes(entry.date)) continue;
      const idx = weekDates.indexOf(entry.date);
      if (!map[entry.planDayLabel]) map[entry.planDayLabel] = new Set();
      map[entry.planDayLabel].add(DAY_LABEL[idx]);
    }
    return map;
  }, [weekData, weekDates]);

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

      {/* Week grid: plan day vs done */}
      {activePlan && activePlan.days?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">This week</p>
          <div className="flex gap-1 mb-3 px-1">
            {DAY_LABEL.map((d, i) => (
              <div
                key={d}
                className={`flex-1 text-center text-xs font-medium rounded-lg py-1 ${
                  weekDates[i] === today
                    ? 'bg-violet-100 text-violet-700'
                    : weekDates[i] < today
                    ? 'text-slate-500'
                    : 'text-slate-300'
                }`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {activePlan.days.map(d => {
              const doneDays = dayLabelToDates[d.label];
              const done = !!doneDays && doneDays.size > 0;
              return (
                <div key={d.label} className="flex items-center gap-2">
                  {done
                    ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    : <Circle size={16} className="text-slate-300 shrink-0" />
                  }
                  <span className={`text-sm flex-1 ${done ? 'text-slate-700' : 'text-slate-400'}`}>
                    {d.label}{d.focus ? ` · ${d.focus}` : ''}
                  </span>
                  {done && (
                    <span className="text-xs text-green-600 font-medium">
                      {[...doneDays].join(', ')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editorOpen && <PlanEditor isAdmin={isAdmin} onClose={() => setEditorOpen(false)} />}
    </div>
  );
}
