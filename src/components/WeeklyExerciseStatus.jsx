import { useState, useEffect } from 'react';
import { startOfWeek, format, addDays } from 'date-fns';
import { useGym, BODY_PARTS } from '../hooks/useGym';

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getThisWeekDates() {
  const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => format(addDays(mon, i), 'yyyy-MM-dd'));
}

function bodyPartLabel(key) {
  return BODY_PARTS.find(b => b.key === key)?.label ?? key;
}

function bodyPartEmoji(key) {
  return BODY_PARTS.find(b => b.key === key)?.emoji ?? '';
}

export default function WeeklyExerciseStatus({ weekData }) {
  const { fetchExerciseList } = useGym();
  const [library, setLibrary] = useState([]);
  const [loadingLib, setLoadingLib] = useState(true);

  useEffect(() => {
    fetchExerciseList().then(list => {
      setLibrary(list);
      setLoadingLib(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const weekDates = getThisWeekDates();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Map exerciseName → set of day labels done this week
  const doneMap = {};
  for (const entry of weekData) {
    if (!weekDates.includes(entry.date)) continue;
    const dayIdx = weekDates.indexOf(entry.date);
    if (!doneMap[entry.exerciseName]) doneMap[entry.exerciseName] = [];
    doneMap[entry.exerciseName].push(DAY_LABEL[dayIdx]);
  }

  // Group library by body part
  const byBodyPart = BODY_PARTS.map(bp => ({
    key: bp.key,
    exercises: library.filter(ex => ex.bodyPart === bp.key),
    doneExercises: [...new Set(
      weekData
        .filter(e => e.bodyPart === bp.key && weekDates.includes(e.date))
        .map(e => e.exerciseName)
    )],
  })).filter(bp => bp.exercises.length > 0 || bp.doneExercises.length > 0);

  // Day header row
  const pastDays = weekDates.filter(d => d <= today);

  if (loadingLib) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (byBodyPart.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🗓️</p>
        <p className="text-slate-500 text-sm">No exercises in library yet</p>
        <p className="text-slate-400 text-xs mt-1">Add exercises via the ⚙ button</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week day header */}
      <div className="flex gap-1 px-1">
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

      {byBodyPart.map(({ key, exercises, doneExercises }) => {
        const pendingExercises = exercises.filter(ex => !doneExercises.includes(ex.name));

        return (
          <div key={key} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span>{bodyPartEmoji(key)}</span>
              {bodyPartLabel(key)}
            </p>

            <div className="space-y-2">
              {/* Done exercises */}
              {doneExercises.map(name => (
                <div key={name} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="text-sm text-slate-700 flex-1">{name}</span>
                  <span className="text-xs text-green-600 font-medium">
                    {doneMap[name]?.join(', ')}
                  </span>
                </div>
              ))}

              {/* Pending exercises */}
              {pendingExercises.map(ex => (
                <div key={ex._id} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
                  <span className="text-sm text-slate-400">{ex.name}</span>
                </div>
              ))}

              {doneExercises.length === 0 && pendingExercises.length === 0 && (
                <p className="text-xs text-slate-400 italic">No exercises in library</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-4 justify-center text-xs text-slate-400 pb-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-slate-200 inline-block" /> Pending
        </span>
      </div>
    </div>
  );
}
