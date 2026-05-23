# Week-over-Week Progress — Design Spec
_Date: 2026-05-23_

## Summary

Two new analytics views:
1. **Reports "Week" tab** — week-over-week habit completion comparison
2. **Gym "Progress" tab** — per-exercise strength trends over 12 weeks

---

## 1. Reports Page — Week Tab

### Tabs
Reports page gains a tab bar: **"History"** (existing) | **"Week"** (new).

### Week Definition
- Week = Mon–Sun (ISO week, `weekStartsOn: 1` via date-fns)
- "This week" = Monday of current week → today
- "Last week" = previous Monday → previous Sunday

### Data Source
No new API call. Uses already-loaded `logs` state (30 days in memory from existing batch fetch).

### Top Summary Bar
One-line aggregate: "X improved · Y same · Z dropped"
- Improved = completion rate this week > last week
- Same = equal rate (including both 0%)
- Dropped = rate lower than last week

### Per-Habit Card
- Emoji + habit name
- "This week": `completedCount / scheduledCount` + `rate%`
- "Last week": same
- Delta: `▲ +X%` (green) / `▼ -X%` (red) / `= no change` (slate)
- Simple two-bar CSS comparison (no SVG needed — just relative-width bars)
- Habits not scheduled in either week: hidden (not shown)

---

## 2. Gym Page — Progress Tab

### Tabs
Gym page gains a tab bar: **"Log"** (existing daily view) | **"Progress"** (new).

### Backend: New Endpoint
```
GET /api/gym/progress?weeks=12
```
Returns weekly aggregated data for all exercises the user has ever logged.

**Response shape:**
```json
[
  {
    "exerciseName": "Bench Press",
    "bodyPart": "chest",
    "weeks": [
      { "weekStart": "2025-11-03", "maxWeight": 80, "totalVolume": 2400, "sessions": 1 },
      ...
    ]
  }
]
```

**Server computation:**
- Generate last N week-start dates (Mondays)
- Query: `GymEntry.find({ userId, date: { $in: allDatesInRange } })`
- Group by `exerciseName`, then by week
- Per week per exercise:
  - `maxWeight` = max of all `prWeight` values in that week
  - `totalVolume` = sum of (reps × weight) across all sets in that week (0 if no entries)
  - `sessions` = count of entries

### Frontend: ExerciseProgress Component

**Layout:** Grouped by body part (same as Gym log view). Each exercise gets a card.

**Per-exercise card:**
- Exercise name + body part emoji
- Row 1: Max weight sparkline (SVG, 12 points, ~80×28px) + "Xkg now" + delta vs 12 weeks ago
- Row 2: Volume sparkline (same) + "Xkg vol" + delta
- Sparkline: polyline SVG, dots at data points, grey for zero weeks, violet for active weeks
- If no weight data (bodyweight/cardio): show reps-based volume only

**Sorting:** exercises sorted by most recently active (last week with any session)

### useGym Hook Addition
```js
fetchProgress(weeks = 12) // calls GET /api/gym/progress?weeks=N, returns array
```

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/Reports.jsx` | Add tab bar; existing content in "History" tab; new "Week" tab renders `WeekSummary` |
| `src/pages/Gym.jsx` | Add tab bar; existing content in "Log" tab; new "Progress" tab renders `ExerciseProgress` |
| `src/components/WeekSummary.jsx` | New — WoW habit cards, computed from existing logs |
| `src/components/ExerciseProgress.jsx` | New — per-exercise sparkline cards |
| `src/hooks/useGym.js` | Add `fetchProgress(weeks)` |
| `server/routes/gym.js` | Add `GET /progress` route with weekly aggregation |

---

## Out of Scope
- Date range picker (hardcoded: WoW = 2 weeks, exercise = 12 weeks)
- Cardio-specific metrics (pace, distance)
- Export / share
