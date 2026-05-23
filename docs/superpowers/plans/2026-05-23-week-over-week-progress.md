# Week-over-Week Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Week" tab to Reports (habit WoW completion comparison) and a "Progress" tab to Gym (per-exercise strength sparklines over 12 weeks).

**Architecture:** Backend gets one new aggregation endpoint `/api/gym/progress`. Frontend adds two new components (WeekSummary, ExerciseProgress) and tabs to two existing pages. Habit WoW uses already-loaded in-memory log data — no new API call. Exercise progress loads on tab open.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, date-fns, Express/MongoDB, no test framework installed.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `server/routes/gym.js` | Modify | Add `GET /progress` route |
| `src/hooks/useGym.js` | Modify | Add `fetchProgress(weeks)` |
| `src/components/WeekSummary.jsx` | Create | WoW habit comparison cards |
| `src/components/ExerciseProgress.jsx` | Create | Per-exercise sparkline cards |
| `src/pages/Reports.jsx` | Modify | Add History/Week tab bar |
| `src/pages/Gym.jsx` | Modify | Add Log/Progress tab bar |

---

## Task 1: Backend — `GET /api/gym/progress` endpoint

**Files:**
- Modify: `server/routes/gym.js`

- [ ] **Step 1: Add the progress route to `server/routes/gym.js`**

Add this block **before** the `module.exports = router;` line at the bottom of `server/routes/gym.js`:

```javascript
// GET /api/gym/progress?weeks=12
router.get('/progress', async (req, res) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 12, 52);

    // Build Monday-aligned week start dates for the last N weeks
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + daysToMon);
    thisMonday.setHours(0, 0, 0, 0);

    const weekStarts = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(thisMonday);
      d.setDate(d.getDate() - i * 7);
      weekStarts.push(d.toISOString().slice(0, 10));
    }

    // Date range: first Monday → end of current week
    const rangeEnd = new Date(thisMonday);
    rangeEnd.setDate(rangeEnd.getDate() + 6);
    const rangeStart = weekStarts[0];
    const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

    const entries = await GymEntry.find({
      userId: req.user._id,
      date: { $gte: rangeStart, $lte: rangeEndStr },
    }).lean();

    if (entries.length === 0) return res.json([]);

    // Map a YYYY-MM-DD date to its Monday week-start
    function toWeekStart(dateStr) {
      const d = new Date(dateStr);
      const dow = d.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }

    // Aggregate: exerciseName → bodyPart + per-week stats
    const map = {};
    for (const entry of entries) {
      if (!map[entry.exerciseName]) {
        map[entry.exerciseName] = { bodyPart: entry.bodyPart, weeks: {} };
      }
      const ws = toWeekStart(entry.date);
      if (!map[entry.exerciseName].weeks[ws]) {
        map[entry.exerciseName].weeks[ws] = { maxWeight: 0, totalVolume: 0, sessions: 0 };
      }
      const w = map[entry.exerciseName].weeks[ws];
      w.sessions++;
      w.maxWeight = Math.max(w.maxWeight, entry.prWeight || 0);
      const vol = entry.sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
      w.totalVolume += vol;
    }

    // Build result with zero-filled weeks
    const result = Object.entries(map).map(([exerciseName, data]) => ({
      exerciseName,
      bodyPart: data.bodyPart,
      weeks: weekStarts.map(ws => ({
        weekStart: ws,
        maxWeight: data.weeks[ws]?.maxWeight || 0,
        totalVolume: data.weeks[ws]?.totalVolume || 0,
        sessions: data.weeks[ws]?.sessions || 0,
      })),
    }));

    // Sort by most recently active week
    result.sort((a, b) => {
      const lastActive = arr => [...arr].reverse().find(w => w.sessions > 0)?.weekStart || '';
      return lastActive(b.weeks).localeCompare(lastActive(a.weeks));
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Smoke-test the endpoint**

Start the server (if not already running): `cd server && node index.js`

Then curl with a valid session cookie, or hit it from the browser dev tools network tab after logging in:

```
GET http://localhost:3003/api/gym/progress?weeks=12
```

Expected: JSON array (empty `[]` if no gym entries yet, or array of exercise objects if data exists). No 500 errors.

- [ ] **Step 3: Commit**

```bash
git add server/routes/gym.js
git commit -m "feat(api): add GET /api/gym/progress weekly aggregation endpoint"
```

---

## Task 2: Frontend hook — `fetchProgress`

**Files:**
- Modify: `src/hooks/useGym.js`

- [ ] **Step 1: Add `fetchProgress` to the hook**

In `src/hooks/useGym.js`, add this after `fetchExerciseList`:

```javascript
const fetchProgress = useCallback(async (weeks = 12) => {
  try {
    return await apiFetch(`/api/gym/progress?weeks=${weeks}`);
  } catch {
    return [];
  }
}, []);
```

Then add `fetchProgress` to the return object at the bottom of `useGym`:

```javascript
return {
  entries, weekData, loading, weekLoading,
  loadEntries, loadWeek,
  fetchExerciseHistory, fetchExerciseNames,
  fetchExerciseList, addExerciseTemplate, deleteExerciseTemplate,
  addEntry, updateEntry, deleteEntry,
  fetchProgress,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useGym.js
git commit -m "feat(hook): add fetchProgress to useGym"
```

---

## Task 3: WeekSummary component

**Files:**
- Create: `src/components/WeekSummary.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { startOfWeek } from 'date-fns';
import { useHabitsContext } from '../hooks/useHabits';

function getWeekDates(mondayOffset) {
  const today = new Date();
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  const mon = new Date(thisMonday);
  mon.setDate(mon.getDate() + mondayOffset * 7);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    // Don't include future days
    if (d <= today) dates.push(d);
  }
  return dates;
}

function weekStats(habit, dates, habitsForDate, getStatus) {
  const scheduled = dates.filter(d => habitsForDate(d).some(h => h._id === habit._id));
  const completed = scheduled.filter(d => {
    const s = getStatus(habit._id, d);
    return s === 'done' || s === 'half_done';
  });
  const rate = scheduled.length === 0 ? null : Math.round((completed.length / scheduled.length) * 100);
  return { completed: completed.length, scheduled: scheduled.length, rate };
}

function BarRow({ label, stats, isThis }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isThis ? 'bg-violet-500' : 'bg-slate-300'}`}
          style={{ width: `${stats.rate ?? 0}%` }}
        />
      </div>
      <span className="text-xs text-slate-600 font-semibold w-24 text-right shrink-0">
        {stats.scheduled === 0
          ? '—'
          : `${stats.completed}/${stats.scheduled} (${stats.rate}%)`}
      </span>
    </div>
  );
}

export default function WeekSummary() {
  const { habits, habitsForDate, getStatus } = useHabitsContext();

  const thisWeekDates = getWeekDates(0);
  const lastWeekDates = getWeekDates(-1);

  const habitData = habits
    .map(habit => {
      const thisWeek = weekStats(habit, thisWeekDates, habitsForDate, getStatus);
      const lastWeek = weekStats(habit, lastWeekDates, habitsForDate, getStatus);
      if (thisWeek.scheduled === 0 && lastWeek.scheduled === 0) return null;
      const delta =
        thisWeek.rate !== null && lastWeek.rate !== null
          ? thisWeek.rate - lastWeek.rate
          : null;
      return { habit, thisWeek, lastWeek, delta };
    })
    .filter(Boolean);

  const improved = habitData.filter(d => d.delta !== null && d.delta > 0).length;
  const same     = habitData.filter(d => d.delta === null || d.delta === 0).length;
  const dropped  = habitData.filter(d => d.delta !== null && d.delta < 0).length;

  if (habitData.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-sm">No scheduled habits this week or last week</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-4 text-sm px-1">
        <span className="text-green-600 font-semibold">{improved} improved</span>
        <span className="text-slate-400">{same} same</span>
        {dropped > 0 && <span className="text-red-500 font-semibold">{dropped} dropped</span>}
      </div>

      {/* Per-habit cards */}
      {habitData.map(({ habit, thisWeek, lastWeek, delta }) => (
        <div key={habit._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl shrink-0">{habit.emoji}</span>
            <span className="font-semibold text-slate-800 truncate">{habit.name}</span>
            {delta !== null && (
              <span
                className={`ml-auto shrink-0 text-sm font-bold ${
                  delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'
                }`}
              >
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '='}{' '}
                {delta !== 0 ? `${Math.abs(delta)}%` : ''}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <BarRow label="This week" stats={thisWeek} isThis={true} />
            <BarRow label="Last week" stats={lastWeek} isThis={false} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WeekSummary.jsx
git commit -m "feat(component): add WeekSummary week-over-week habit comparison"
```

---

## Task 4: ExerciseProgress component

**Files:**
- Create: `src/components/ExerciseProgress.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState, useEffect } from 'react';
import { useGym, BODY_PARTS } from '../hooks/useGym';

function bodyPartLabel(key) {
  return BODY_PARTS.find(b => b.key === key)?.label ?? key;
}

function bodyPartEmoji(key) {
  return BODY_PARTS.find(b => b.key === key)?.emoji ?? '';
}

function Sparkline({ data, color = '#7c3aed', width = 80, height = 28 }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 6) - 3;
    return [x, y];
  });
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={max <= 1 ? 0.25 : 1}
      />
      {pts.map(([x, y], i) =>
        data[i] > 0 ? (
          <circle key={i} cx={x} cy={y} r="2" fill={color} opacity={max <= 1 ? 0.25 : 1} />
        ) : null
      )}
    </svg>
  );
}

function deltaLabel(current, first) {
  if (current === 0 && first === 0) return null;
  if (first === 0) return null;
  const diff = current - first;
  if (diff === 0) return <span className="text-xs text-slate-400 ml-1">no change</span>;
  return (
    <span className={`text-xs ml-1 ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  );
}

function ExerciseCard({ ex }) {
  const weights  = ex.weeks.map(w => w.maxWeight);
  const volumes  = ex.weeks.map(w => w.totalVolume);

  const currentWeight = [...weights].reverse().find(v => v > 0) ?? 0;
  const firstWeight   = weights.find(v => v > 0) ?? 0;
  const currentVol    = [...volumes].reverse().find(v => v > 0) ?? 0;
  const firstVol      = volumes.find(v => v > 0) ?? 0;

  const hasWeight = weights.some(v => v > 0);
  const hasVolume = volumes.some(v => v > 0);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <p className="font-semibold text-slate-800 mb-3">{ex.exerciseName}</p>

      {hasWeight && (
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs text-slate-400 w-20 shrink-0">Max weight</span>
          <Sparkline data={weights} color="#7c3aed" />
          <div className="ml-auto flex items-baseline">
            <span className="text-sm font-bold text-slate-700">{currentWeight}kg</span>
            {deltaLabel(currentWeight, firstWeight)}
          </div>
        </div>
      )}

      {hasVolume && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-20 shrink-0">Volume</span>
          <Sparkline data={volumes} color="#94a3b8" />
          <div className="ml-auto flex items-baseline">
            <span className="text-sm font-bold text-slate-700">{currentVol}</span>
            <span className="text-xs text-slate-400 ml-0.5">kg</span>
            {deltaLabel(currentVol, firstVol)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExerciseProgress() {
  const { fetchProgress } = useGym();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress(12).then(d => {
      setData(d);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📈</p>
        <p className="text-slate-500 text-sm">No exercise history yet</p>
        <p className="text-slate-400 text-xs mt-1">Log exercises to see strength trends</p>
      </div>
    );
  }

  // Group by body part
  const grouped = data.reduce((acc, ex) => {
    if (!acc[ex.bodyPart]) acc[ex.bodyPart] = [];
    acc[ex.bodyPart].push(ex);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400 px-1">Last 12 weeks · sparklines show weekly trend</p>
      {Object.entries(grouped).map(([bp, exercises]) => (
        <div key={bp}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>{bodyPartEmoji(bp)}</span>
            {bodyPartLabel(bp)}
          </p>
          <div className="space-y-3">
            {exercises.map(ex => (
              <ExerciseCard key={ex.exerciseName} ex={ex} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExerciseProgress.jsx
git commit -m "feat(component): add ExerciseProgress sparkline cards"
```

---

## Task 5: Reports page — add History/Week tabs

**Files:**
- Modify: `src/pages/Reports.jsx`

- [ ] **Step 1: Add tab state and tab bar to Reports**

In `src/pages/Reports.jsx`:

1. Add `useState` to the import:
```javascript
import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Flame } from 'lucide-react';
import { useHabitsContext } from '../hooks/useHabits';
import { HabitListSkeleton } from '../components/Skeleton';
import WeekSummary from '../components/WeekSummary';
```

2. Inside the `Reports` function, add tab state after the context destructure:
```javascript
const [tab, setTab] = useState('history');
```

3. Replace the outer `<div className="p-4">` opening and header with this (keeping everything inside intact, just wrapping):

```jsx
return (
  <div className="p-4">
    <div className="pt-4 mb-4">
      <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
    </div>

    {/* Tab bar */}
    <div className="flex border-b border-slate-200 mb-5">
      {[['history', 'History'], ['week', 'This Week']].map(([key, label]) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === key
              ? 'text-violet-600 border-violet-600'
              : 'text-slate-400 border-transparent'
          }`}
        >
          {label}
        </button>
      ))}
    </div>

    {tab === 'week' ? (
      <WeekSummary />
    ) : (
      <>
        <p className="text-slate-400 text-sm mb-6">Last {DAYS} days</p>
        <div className="space-y-4">
          {/* ... existing habit cards JSX unchanged ... */}
        </div>
        {/* ... existing legend unchanged ... */}
      </>
    )}
  </div>
);
```

**Important:** The full existing JSX for the habit cards and legend stays exactly as-is inside the `tab === 'history'` branch. Only the outer wrapper and header change. Full updated `Reports` function:

```jsx
export default function Reports() {
  const { habits, habitsForDate, getStatus, getValue, getStreak, loading } = useHabitsContext();
  const [tab, setTab] = useState('history');

  if (loading) return <div className="p-4 pt-8"><HabitListSkeleton /></div>;

  if (habits.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p className="text-5xl mb-4">📊</p>
        <p className="font-semibold text-slate-600">No data yet</p>
        <p className="text-sm mt-1">Add habits and start tracking to see reports</p>
      </div>
    );
  }

  const dates = Array.from({ length: DAYS }, (_, i) => subDays(new Date(), i));

  return (
    <div className="p-4">
      <div className="pt-4 mb-4">
        <h1 className="text-3xl font-bold text-slate-800">Reports</h1>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-5">
        {[['history', 'History'], ['week', 'This Week']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'text-violet-600 border-violet-600'
                : 'text-slate-400 border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'week' ? (
        <WeekSummary />
      ) : (
        <>
          <p className="text-slate-400 text-sm mb-6">Last {DAYS} days</p>
          <div className="space-y-4">
            {habits.map(habit => {
              const scheduledDates  = dates.filter(d => habitsForDate(d).some(h => h._id === habit._id));
              const completedCount  = scheduledDates.filter(d => {
                const s = getStatus(habit._id, d);
                return s === 'done' || s === 'half_done';
              }).length;
              const rate   = scheduledDates.length === 0 ? 0 : Math.round((completedCount / scheduledDates.length) * 100);
              const streak = getStreak(habit._id);

              return (
                <div key={habit._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl shrink-0">{habit.emoji}</span>
                      <span className="font-semibold text-slate-800 truncate">{habit.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-orange-500 shrink-0 ml-2">
                      <Flame size={15} />
                      <span className="text-sm font-bold">{streak}</span>
                      <span className="text-xs text-slate-400 font-normal">streak</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 font-semibold w-9 text-right">{rate}%</span>
                  </div>
                  <div className="flex gap-1 flex-row-reverse justify-end">
                    {dates.map(d => {
                      const scheduled = habitsForDate(d).some(h => h._id === habit._id);
                      const status    = scheduled ? getStatus(habit._id, d) : null;
                      return (
                        <div
                          key={d.toISOString()}
                          title={`${format(d, 'MMM d')}: ${status ?? 'not scheduled'}`}
                          className={`w-3.5 h-3.5 rounded-sm transition-colors ${status ? STATUS_COLOR[status] : 'bg-slate-50'}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1 px-0.5">
                    <span>{format(dates[DAYS - 1], 'MMM d')}</span>
                    <span>Today</span>
                  </div>
                  <ValueSummary habit={habit} dates={dates} getValue={getValue} />
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex gap-4 flex-wrap justify-center text-xs text-slate-500 pb-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Done</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Half done</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Not done</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" /> Not started</span>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/reports`. You should see:
- "History" and "This Week" tabs below the title
- History tab shows existing dot grids (unchanged)
- This Week tab shows per-habit WoW comparison cards

- [ ] **Step 3: Commit**

```bash
git add src/pages/Reports.jsx
git commit -m "feat(reports): add History/Week tabs with WoW habit comparison"
```

---

## Task 6: Gym page — add Log/Progress tabs

**Files:**
- Modify: `src/pages/Gym.jsx`

- [ ] **Step 1: Add imports and tab state to Gym.jsx**

Add to the imports at the top of `src/pages/Gym.jsx`:

```javascript
import ExerciseProgress from '../components/ExerciseProgress';
```

Add `tab` state inside the `Gym` component, alongside the existing state:

```javascript
const [tab, setTab] = useState('log');
```

- [ ] **Step 2: Add tab bar and conditional render**

In `src/pages/Gym.jsx`, after the date navigation `<div>` (the `flex items-center justify-between mb-4` block that ends before `{/* Weekly coverage */}`), add the tab bar:

```jsx
{/* Tab bar */}
<div className="flex border-b border-slate-200 mb-4">
  {[['log', 'Log'], ['progress', 'Progress']].map(([key, label]) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
        tab === key
          ? 'text-violet-600 border-violet-600'
          : 'text-slate-400 border-transparent'
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

Then wrap the existing content (weekly coverage + entries section + FAB) in `{tab === 'log' && (...)}` and add the progress branch. The `return` statement becomes:

```jsx
return (
  <div className="px-4 pb-6 pt-4 max-w-lg mx-auto">
    {/* Date navigation */}
    <div className="flex items-center justify-between mb-4">
      <button onClick={prevDay} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
        <ChevronLeft size={20} className="text-slate-500" />
      </button>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-base font-semibold text-slate-800">{formattedDate}</span>
        {!isCurrentDay && (
          <button onClick={goToday} className="text-xs text-violet-600 font-medium hover:underline">
            Go to today
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setManageOpen(true)}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          title="Manage exercises"
        >
          <Settings size={20} className="text-slate-500" />
        </button>
        <button onClick={nextDay} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronRight size={20} className="text-slate-500" />
        </button>
      </div>
    </div>

    {/* Tab bar */}
    <div className="flex border-b border-slate-200 mb-4">
      {[['log', 'Log'], ['progress', 'Progress']].map(([key, label]) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === key
              ? 'text-violet-600 border-violet-600'
              : 'text-slate-400 border-transparent'
          }`}
        >
          {label}
        </button>
      ))}
    </div>

    {tab === 'progress' ? (
      <ExerciseProgress />
    ) : (
      <>
        {/* Weekly coverage */}
        {!weekLoading && (
          <WeeklyCoverage weekData={weekData} referenceDate={date} />
        )}

        {/* Entries */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="text-slate-500 text-sm">No exercises logged yet</p>
            <p className="text-slate-400 text-xs mt-1">Tap + to add your first exercise</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([bp, bpEntries]) => (
              <div key={bp}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>{bodyPartEmoji(bp)}</span>
                  {bodyPartLabel(bp)}
                </p>
                <div className="space-y-2">
                  {bpEntries.map(entry => (
                    <div key={entry._id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800 truncate">{entry.exerciseName}</p>
                            {entry.isPersonalRecord && (
                              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <Trophy size={11} /> PR
                              </span>
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${feelColor(entry.feel)}`}>
                              {entry.feel}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {entry.sets.map((s, i) => (
                              <span key={i} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600">
                                {s.reps} reps{s.weight ? ` × ${s.weight}kg` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(entry)} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                            <Pencil size={14} className="text-slate-400" />
                          </button>
                          <button onClick={() => handleDelete(entry._id)} className="p-1.5 rounded-full hover:bg-red-50 transition-colors">
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FAB */}
        <button
          onClick={openAdd}
          className="fixed bottom-24 right-5 w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-violet-700 transition-colors z-30"
        >
          <Plus size={24} />
        </button>
      </>
    )}

    {/* Log entry modal */}
    {modalOpen && (
      <GymEntryModal
        date={dateKey}
        entry={editEntry}
        fetchExerciseList={fetchExerciseList}
        fetchExerciseHistory={fetchExerciseHistory}
        onSave={handleSave}
        onClose={closeModal}
      />
    )}

    {/* Manage exercises modal */}
    {manageOpen && (
      <ManageExercisesModal
        fetchExerciseList={fetchExerciseList}
        addExerciseTemplate={addExerciseTemplate}
        deleteExerciseTemplate={deleteExerciseTemplate}
        onClose={() => setManageOpen(false)}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173/gym`. You should see:
- "Log" and "Progress" tabs below the date navigation
- Log tab shows existing behaviour (date nav, weekly coverage, entries)
- Progress tab shows exercise sparkline cards (or empty state if no data)
- FAB only visible on Log tab

- [ ] **Step 4: Commit**

```bash
git add src/pages/Gym.jsx
git commit -m "feat(gym): add Log/Progress tabs with exercise strength trends"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Verify Reports → This Week tab**

  - Navigate to `/reports`, click "This Week"
  - Habits scheduled this week and last week appear with two bars
  - Delta arrow is green (▲) if this week's rate > last week's, red (▼) if lower
  - Habits with no scheduled days in either week are hidden
  - Summary line shows correct improved/same/dropped counts

- [ ] **Step 2: Verify Gym → Progress tab**

  - Navigate to `/gym`, click "Progress"
  - Exercises appear grouped by body part
  - Each card shows max weight sparkline and volume sparkline
  - Delta labels (e.g., `+5`) appear when there is a difference between first and most recent active week
  - Exercises with bodyweight only (weight=0) show volume row only

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: week-over-week habit summary and exercise strength progress tabs"
```
