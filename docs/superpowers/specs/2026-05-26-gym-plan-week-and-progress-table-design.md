# Gym: Plan This-Week Exercises + Progress Table — Design Spec

**Date:** 2026-05-26
**Status:** Approved, implementation pending.

## Problem

Two friction points on the Gym page:

1. **Plan → This Week** currently only shows whether each *plan day* has been done. When life interrupts a week, the user can't see which specific exercises are still owed. They need a "catch up" list.
2. **Progress** tab uses 12-week per-exercise sparklines. It's pretty but doesn't answer the actual question — *is progressive overload working?* User wants a tabular % view across a 1-3 month window.

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Missed rule | Per exercise in active plan, by week. Done if logged anywhere this week. |
| This-Week layout | Two sections: Done | Pending. Pending expanded by default. |
| Growth metric | Both weight Δ% and volume Δ% side-by-side. |
| Period selector | Toggle 1mo / 3mo / All. Default 1mo. |
| Table shape | Exercise | Sessions | Weight Δ% | Volume Δ%, sorted by Weight Δ% desc. |

Both changes are UI-only — no schema, no new endpoints.

## Feature 1 — Plan → This Week per-exercise

### Scope

Replace the day-level checklist at the bottom of [PlanTab.jsx](src/components/PlanTab.jsx) (lines 189-232) with a per-exercise Done/Pending view.

### Data (already available)

- `weekData`: `[{date, bodyPart, exerciseName, planDayLabel}]` for the current week (from `GET /api/gym/week`).
- `activePlan.days[].exercises[]`: planned exercises with `exerciseName`, `bodyPart`, `sets`, `repsMin/Max`, `notes`.

### Logic

```js
const planned = uniqueByExerciseName(activePlan.days.flatMap(d => d.exercises))
const doneNames = new Set(weekData.map(e => e.exerciseName))
const done    = planned.filter(p =>  doneNames.has(p.exerciseName))
const pending = planned.filter(p => !doneNames.has(p.exerciseName))
```

Duplicates across plan days collapse to one row. Logged exercises not in the plan are ignored.

### UI

```
┌─ This week — 8 / 14 exercises done ──────┐
│ ▼ Pending (6) — catch up                 │
│   ⚪ 💪 Incline Dumbbell Press · chest    │
│   ⚪ 🔙 Lat Pulldown · back               │
│   ...                                    │
│ ▶ Done (8)                               │
└──────────────────────────────────────────┘
```

- Pending section expanded by default.
- Done section collapsed by default; expand to verify.
- Header summary: "X / Y exercises done".
- Each row: body-part emoji + exercise name + body-part label.
- Tap a pending row → calls existing `onOpenEntry({bodyPart, exerciseName, sets, repsMin, repsMax, planDayLabel})` to open the entry modal pre-filled. For exercises that appear in multiple plan days, prefill with the first occurrence's day label.
- No active plan or no planned exercises → render nothing (matches current behavior).

### Edge cases

| Case | Behavior |
|------|----------|
| Plan with zero exercises | Section omitted. |
| Exercise logged with `planDayLabel: ''` but matches a planned name | Counts as Done. |
| Same exercise in multiple plan days | Single row in either Done or Pending. |
| Exercise logged this week but not in plan | Excluded from both counts. |
| 0 pending | Pending section header reads "Pending (0) — all caught up 🎉". |

---

## Feature 2 — Progress tab tabular %

### Scope

Replace the sparkline-card layout in [ExerciseProgress.jsx](src/components/ExerciseProgress.jsx) with a period toggle + summary header + table. Delete `Sparkline` + `DeltaLabel` + `ExerciseCard` (no longer used).

### Data (already available)

`GET /api/gym/progress?weeks=N` (in [server/routes/gym.js](server/routes/gym.js) lines 215-296) returns:
```ts
[{
  exerciseName: string,
  bodyPart: string,
  weeks: [{ weekStart, maxWeight, totalVolume, sessions }],
}]
```

Period toggle drives `weeks` query param:
- **1mo** → 4
- **3mo** → 13
- **All** → 52 (server caps at 52)

### Aggregation (client-side, pure function)

```js
function summarize(weeks) {
  // Active weeks = weeks with sessions > 0
  const active = weeks.filter(w => w.sessions > 0);
  if (active.length === 0) return { sessions: 0, weightPct: null, volumePct: null, currentWeight: 0, currentVolume: 0 };
  const sessions = active.reduce((s, w) => s + w.sessions, 0);
  const firstW   = active[0];
  const lastW    = active[active.length - 1];
  const weightPct = (firstW.maxWeight > 0 && active.length >= 2)
    ? ((lastW.maxWeight - firstW.maxWeight) / firstW.maxWeight) * 100
    : null;
  const volumePct = (firstW.totalVolume > 0 && active.length >= 2)
    ? ((lastW.totalVolume - firstW.totalVolume) / firstW.totalVolume) * 100
    : null;
  return { sessions, weightPct, volumePct, currentWeight: lastW.maxWeight, currentVolume: lastW.totalVolume };
}
```

Live in `src/lib/progress.js` with smoke tests at `src/lib/progress.smoke.mjs`.

**Overall %** averages exercises whose `weightPct` (resp. `volumePct`) is non-null — single-session exercises are excluded so noise doesn't dominate.

### UI

```
┌──────────────────────────────────────────┐
│  [ 1mo ]  [ 3mo ]  [ All ]               │  ← segmented toggle
├──────────────────────────────────────────┤
│  Avg weight  +8.4%   Avg volume  +15.2%  │
│  over last 4 weeks · 12 exercises        │
└──────────────────────────────────────────┘

  Exercise                Sessions  Wt Δ%   Vol Δ%
  ─────────────────────────────────────────────────
  🟢 Bench Press · chest      6     +12%    +28%
  🟢 Deadlift · back          4      +9%    +12%
  ⚪ Overhead Press · shldr   3       0%    +14%
  🔴 Lat Pulldown · back      3      -3%    -10%
  ⚪ Bicep Curl · arms        1       —      —
```

- Period toggle persisted in `localStorage` per user (`gym:progressPeriod:{userId}`).
- Summary card colored neutral; growth values colored green / slate / red.
- Table rows: left-border color matches Weight Δ% sign (green `>0`, slate `=0` or null, red `<0`).
- Body part shown as small chip below or beside exercise name.
- Sessions column: number + thin horizontal bar (max bar width = max sessions in current set).
- Empty state: same panda emoji placeholder as today.

### Sorting

Default sort: Weight Δ% desc, nulls last. Stable on exerciseName.

### Edge cases

| Case | Behavior |
|------|----------|
| Zero exercises with any session in window | Empty state. |
| All exercises have only 1 active week | Table shows them with "—" in Δ% columns; overall % shows "—". |
| First active week's max weight = 0 (bodyweight) | weightPct = null; row shows volume Δ% only. |
| First active week's volume = 0 | volumePct = null. |
| User switches period | Refetch via `fetchProgress(weeks)`. |

---

## Files

**Modify:**
- `src/components/PlanTab.jsx` — replace bottom "This week" card with new per-exercise section.
- `src/components/ExerciseProgress.jsx` — full rewrite for table layout + period toggle.

**Create:**
- `src/lib/progress.js` — `summarize`, `averagePct`, `formatPct` helpers.
- `src/lib/progress.smoke.mjs` — smoke tests for the helpers.

**Reused (no change):**
- `GET /api/gym/progress` (already supports 1..52 weeks).
- `GET /api/gym/week` (already returns exerciseName).
- `useGym.fetchProgress` and `weekData` state.

## Verification

Automated:
```bash
node src/lib/progress.smoke.mjs
npm run build
```

Manual:
1. Open `/gym`, select Plan tab. Confirm "This week" card shows summary + Pending section expanded.
2. Log an exercise that appears in the plan; switch back to Plan tab → exercise moves from Pending to Done.
3. Tap a Pending row → entry modal opens pre-filled.
4. Switch to Progress tab. Confirm 1mo toggle active by default; summary shows two Δ% values.
5. Toggle 3mo and All; table updates.
6. Confirm sort puts highest weight gain at top, regressors at bottom.
7. Reload the page → period toggle persists.

## Production-readiness

- [ ] No new server routes, no schema changes.
- [ ] Pure helper functions covered by smoke tests.
- [ ] Empty + loading states preserved.
- [ ] Period preference persists per user.
- [ ] `npm run build` clean.
- [ ] No console errors in dev tools.
