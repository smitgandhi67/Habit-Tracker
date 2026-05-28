# Restrict Duplicate Exercise Entry — Design

**Date:** 2026-05-27
**Scope:** Prevent users from adding duplicate exercise templates in the Manage Exercises modal.

## Problem

Today, `Exercise` is unique on `(name, bodyPart)` exact case. A user can still create:

- `Bench Press` in **chest** and `bench press` in **chest** (case differs → both accepted).
- `Bench Press` in **chest** and `Bench Press` in **shoulders** (different body part → both accepted).

Both should be blocked. Exercise names must be **globally unique, case- and whitespace-insensitive**.

## Solution

Normalize the name into a `nameKey` (`trim → lowercase → collapse whitespace`) and enforce uniqueness on that field alone (not scoped to `bodyPart`). Validate on both client (pre-submit) and server (authoritative).

## Server changes

### `server/models/Exercise.js`

- Add field: `nameKey: { type: String, required: true, lowercase: true, trim: true, index: true }`.
- Pre-validate hook computes `nameKey = this.name.trim().toLowerCase().replace(/\s+/g, ' ')`.
- Replace existing index `{ name: 1, bodyPart: 1 }` with `{ nameKey: 1 }`, `unique: true`.
- Comment: must drop the old `name_1_bodyPart_1` index manually before the new index builds:
  `db.exercises.dropIndex("name_1_bodyPart_1")`. Existing rows: backfill `nameKey` once (one-time script or shell command) — see migration note below.

### `server/routes/gym.js` — `POST /exercises-list`

- Compute `nameKey` from `name`.
- Pre-check `Exercise.findOne({ nameKey })`. If found, return `409` with body `{ error: "Exercise '<name>' already exists in <bodyPart>" }` (bodyPart from the existing doc, mapped to the human label client-side or stored as the raw key).
- Keep the duplicate-key catch (11000) as a fallback for race conditions, with the same message shape (without bodyPart context if the doc isn't refetched).

### Migration (one-time, manual)

Run in Mongo shell:

```js
db.exercises.find({ nameKey: { $exists: false } }).forEach(doc => {
  const key = doc.name.trim().toLowerCase().replace(/\s+/g, ' ');
  db.exercises.updateOne({ _id: doc._id }, { $set: { nameKey: key } });
});
db.exercises.dropIndex("name_1_bodyPart_1");
// New unique index on { nameKey: 1 } builds automatically on app start.
```

If duplicates already exist in production (same nameKey, different bodyPart or case), the unique index build will fail. Operator must dedupe first; not handled automatically.

## Client changes

### `src/components/ManageExercisesModal.jsx`

- New state: `allExercises` (array) loaded once on mount via `fetchExerciseList()` (no `bodyPart` arg → returns all).
- Build memoized lookup: `nameKeyMap` = `{ [nameKey]: bodyPartKey }`.
- `handleAdd`:
  1. Compute `nameKey` from `newName`.
  2. If `nameKeyMap[nameKey]` exists: set `error = "Already exists in <BodyPartLabel>"` (label from `BODY_PARTS`). Do NOT call API.
  3. Otherwise call `addExerciseTemplate` as today.
  4. On success: push to both `exercises` (if matching selected bodyPart) and `allExercises`; clear inputs.
  5. On server 409: surface `err.message` inline (existing path).
- On delete: also remove from `allExercises`.

### `src/hooks/useGym.js`

No new function needed — `fetchExerciseList()` with no `bodyPart` already returns the full list. Modal calls it twice on mount (one per body part for the visible list, one global for the dup map). Acceptable; could be optimized later by deriving the per-bodyPart list from `allExercises` instead of refetching, but out of scope.

## Error UX

- Existing red `error` line in modal footer is reused for inline message.
- Server-returned message ("already exists in <bodyPart>") replaces local message on race conditions.
- No toast.

## Out of scope

- Bulk dedupe migration.
- Renaming existing exercises that conflict.
- Cross-user permissions (list is already shared).
