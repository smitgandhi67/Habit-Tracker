# Exercise Template Edit (Name + Category) — Design Spec

**Date:** 2026-05-29
**Status:** Approved, implementation pending.

## Problem

`Exercise` documents are the shared library that Gym pages auto-complete from. Today, the only editable field is `videoUrl` (`PUT /api/gym/exercises-list/:id`). Renames or category corrections require a delete + re-create, and that orphans every `GymEntry` ever logged with the old name (`exerciseName` is stored as a plain string, not a foreign key).

Admins need to rename or recategorize a template *and* have history follow along so the Progress tab stays continuous.

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Who edits name / bodyPart | Admin only. `videoUrl` stays editable by anyone (unchanged). |
| Past GymEntry rename | Cascade update — bulk rename matching `exerciseName`. |
| Past GymEntry bodyPart | Cascade update — bulk update matching rows' `bodyPart` too. |

## Data model

No schema change.

- `Exercise.nameKey` already has a global unique index. Renaming triggers the existing `pre('validate')` hook to recompute `nameKey`.
- `GymEntry.exerciseName` (String) and `GymEntry.bodyPart` (enum) are the cascade targets.

## API — `PUT /api/gym/exercises-list/:id`

Extend body to accept any subset of `{ name, bodyPart, videoUrl }`.

```
videoUrl-only  → behaves exactly like today (any authenticated user).
name or bodyPart present → requireAdmin. Cascades to GymEntry.
```

### Validation

| Field | Rule |
|-------|------|
| `name` | trim, non-empty string. |
| `bodyPart` | one of `['chest','back','shoulders','arms','legs','core','cardio','full_body']`. |
| `videoUrl` | existing `validVideoUrl` helper. |

### Authorization

- Path 1: body has only `videoUrl` (current behavior) — no admin check.
- Path 2: body has `name` or `bodyPart` — must be admin, else 403.

### Cascade

When `name` or `bodyPart` changes:

1. Capture `oldName = exercise.name` before mutation.
2. Apply changes and `await exercise.save()` (recomputes `nameKey`; unique index catches collisions → translate to 409).
3. `await GymEntry.updateMany({ exerciseName: oldName }, { $set: setOps })` where `setOps` includes only the fields that changed.
4. Return `{ ...exercise.toObject(), entriesUpdated: result.modifiedCount }`.

### Atomicity

No mongo transaction. Order is Exercise → GymEntry. If the second step fails the entries keep the old name (recoverable by retrying the same edit). Surface as 500. YAGNI on multi-doc transactions; the failure mode is rare and non-corrupting.

### Errors

| Code | Cause |
|------|-------|
| 400 | invalid `bodyPart`, empty `name`, invalid `videoUrl`. |
| 403 | non-admin sent `name` or `bodyPart`. |
| 404 | exercise not found. |
| 409 | nameKey collision with another exercise. |

## Client

### `useGym.updateExerciseTemplate`

Widen signature to forward the whole body:

```js
const updateExerciseTemplate = useCallback(async (id, body) => {
  return await apiFetch(`/api/gym/exercises-list/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}, []);
```

Callers (`ManageExercisesModal`) pass `{ videoUrl }` today; new admin path passes `{ name, bodyPart }`.

### `ManageExercisesModal`

For each row, render an admin-only pencil button beside the existing "Edit link". When clicked:

- Inline edit panel replaces the row content: text input for name + `<select>` for bodyPart.
- Save button calls `updateExerciseTemplate(id, { name, bodyPart })`.
- On success: refresh the exercise list AND call the parent-provided `onTemplateEdited` callback so the current Gym page can `loadEntries(date)` + `loadWeek(date)` to pick up renamed entries.
- On 409: toast "Name already used by another exercise". On 403: toast "Admin only".

Non-admin users see no change.

### Wiring `onTemplateEdited`

`Gym.jsx` passes `onTemplateEdited={() => { loadEntries(date); loadWeek(date); }}` into `ManageExercisesModal`. Optional prop; default no-op.

## Files

| File | Change |
|------|--------|
| `server/routes/gym.js` | extend `PUT /exercises-list/:id` handler. |
| `src/hooks/useGym.js` | widen `updateExerciseTemplate(id, body)`. |
| `src/components/ManageExercisesModal.jsx` | inline name/bodyPart edit, admin-only. |
| `src/pages/Gym.jsx` | pass `onTemplateEdited` refetch callback. |

## Verification

**Server (manual via REST)**:
- Non-admin PUT `{ videoUrl: 'x' }` → 200 (unchanged behavior).
- Non-admin PUT `{ name: 'x' }` → 403.
- Admin PUT `{ name: 'Bench Press v2' }` → 200, entries updated.
- Admin PUT `{ bodyPart: 'core' }` for a chest exercise → 200, entries' bodyPart now `core`.
- Admin PUT `{ name: 'existing other exercise' }` → 409.
- Admin PUT `{ bodyPart: 'invalid' }` → 400.

**Client**:
- As admin, open Manage Exercises. Click pencil → fields appear → change name → Save → list updates, Gym day view's matching entries reflect new name without page reload.
- Cancel button reverts in-place.

**Automated**:
- `npm run build` clean.
- ESLint clean on touched files.

## Production-readiness

- [ ] All admin-gated paths checked.
- [ ] Validation on every input.
- [ ] Error envelope `{ error: msg }` consistent with other gym routes.
- [ ] Client surfaces 4xx/5xx via toast.
- [ ] Cascade documented in commit message + this spec.
