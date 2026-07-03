# Gym: daily exercise count + dedicated "This week" tab

Date: 2026-07-03
Page: `/gym`

Two independent UI changes to the Gym page.

## Task 1 — Daily exercise count (Log tab)

**Goal:** glanceable count of exercises logged for the selected day.

- Location: small chip at the top of the Log tab, under the date nav, above `WeeklyCoverage`.
- Content: `🏋️ N exercises` (singular `1 exercise`), where `N = entries.length` (the already-loaded day entries).
- Visibility: only when `entries.length > 0` (empty state already covers zero).
- Style: matches existing pill chips — `rounded-full`, `text-xs`, slate border, inline-flex.
- Count = number of exercise entries (not sets, not reps).

## Task 2 — "This week" moves to its own tab

**Goal:** the per-exercise Done/Pending "This week" tracker currently living inside the Plan tab becomes its own top-level tab.

- New component `src/components/WeekTab.jsx`:
  - Move `uniquePlannedExercises`, `ThisWeekExercises`, `SectionHeader` out of `PlanTab.jsx`.
  - Pulls `plans`, `activePlan` from `useGym()`.
  - Props: `weekData`, `onOpenEntry`.
  - Computes `doneExercises` / `pendingExercises` (same logic currently in `PlanTab`).
  - Empty states: no active plan → "No active plan"; active plan but no planned exercises → "No exercises planned yet".
- `src/components/PlanTab.jsx`: remove the moved logic and the `ThisWeekExercises` render block. Plan tab keeps plan selector + day picker + selected-day exercises.
- `src/pages/Gym.jsx`:
  - Tab bar gains `['week', 'Week']`, placed after Plan → `Log · Plan · Week · Progress · Body`.
  - Render `<WeekTab weekData={weekData} onOpenEntry={openFromPlan} />` when `tab === 'week'`.

## Out of scope

- No backend/API changes.
- `WeeklyCoverage` ("This week" body-part card on Log tab) is untouched — separate feature.
- No changes to logging flow, plan editing, or data model.
