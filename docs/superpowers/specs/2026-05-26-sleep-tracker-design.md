# Sleep Tracker — Design Spec

**Date:** 2026-05-26
**Status:** Approved, implementation in progress.

## Problem

HabitTracker has no first-class way to track sleep. The user wants to:

- Tap a single button before bed to record the start of a sleep session.
- Tap again on wakeup to record the end.
- Record multiple sessions per night (mid-night wake → restart sleep → second segment).
- Manually create / edit / delete sessions to fix mis-taps and missed entries.

The feature must fit existing conventions (Express + Mongoose backend, React + Vite + Tailwind frontend, `apiFetch` HTTP wrapper, bottom-nav layout, `useGym`-style hook).

## Decisions (from brainstorming)

| Question | Decision |
|----------|----------|
| Data model for a "night" | Flat `SleepSession` rows, auto-grouped client-side by `nightDate`. |
| Active session UX | One active at a time; large Start/Stop toggle with live timer. |
| Night-date assignment | 6pm cutoff: if `startAt` local hour ≥ 18, use start's date; else use previous date. |
| Extras | Quality rating (1–5) per night, stored in separate `SleepNight` doc. No notes, no tags. |
| Page layout | Single page: Tonight panel + History list. No tabs. |

## Data model

### `SleepSession`

```js
{
  userId:    ObjectId (ref User, required, indexed)
  nightDate: String 'YYYY-MM-DD'  (required, indexed; derived from startAt)
  startAt:   Date (required)
  endAt:     Date | null  (null ⇒ active)
  // mongoose timestamps: createdAt, updatedAt
}
```

Indexes:
- `(userId, nightDate)` — for history / group queries.
- `(userId, endAt)` partial where `endAt: null` — for active lookup.

### `SleepNight`

```js
{
  userId:    ObjectId (required, indexed)
  nightDate: String 'YYYY-MM-DD' (required)
  quality:   Number 1..5 (required)
  // timestamps
}
```

Unique compound index `(userId, nightDate)`. Lazy: a night doc is created only when the user sets quality.

### Night-date rule

Implemented in both `server/utils/sleepNight.js` and `src/lib/sleepNight.js` so client and server always agree.

```
nightDateFor(date, tz):
  hour = local hour of `date` in `tz`
  ymd  = 'YYYY-MM-DD' of `date` in `tz`
  return hour >= 18 ? ymd : (ymd - 1 day)
```

Uses `date-fns-tz` (existing dep). Without `tz`, falls back to system local time.

Client passes `Intl.DateTimeFormat().resolvedOptions().timeZone` with every mutation; server computes `nightDate` from `startAt` + tz, never trusts client value.

## API — `/api/sleep` (all routes mounted with `requireAuth`)

| Method | Path                          | Body / Query                          | Success                       | Errors |
|--------|-------------------------------|---------------------------------------|-------------------------------|--------|
| GET    | `/sessions?from&to`           | YYYY-MM-DD (default last 30 days)     | `200 [session...]`            | 400 bad date |
| GET    | `/sessions/active`            | —                                     | `200 session \| null`         | — |
| POST   | `/sessions/start`             | `{ tz }`                              | `201 session`                 | 409 already active |
| POST   | `/sessions/:id/stop`          | `{ tz }`                              | `200 session`                 | 409 already stopped, 404 not found |
| POST   | `/sessions`                   | `{ startAt, endAt, tz }`              | `201 session`                 | 400 invalid / 409 overlap |
| PUT    | `/sessions/:id`               | `{ startAt?, endAt?, tz }`            | `200 session`                 | 400 invalid / 409 overlap / 404 |
| DELETE | `/sessions/:id`               | —                                     | `200 { ok: true }`            | 404 |
| GET    | `/nights?from&to`             | YYYY-MM-DD                            | `200 [{nightDate, quality}]`  | 400 |
| PUT    | `/nights/:date/quality`       | `{ quality: 1..5 }`                   | `200 {nightDate, quality}`    | 400 |

All routes scope by `req.user._id`. Error envelope: `{ error: msg }`. Mirrors `server/routes/gym.js`.

### Validation rules (server)

- `startAt`, `endAt` must parse to valid `Date`.
- When both present: `endAt > startAt`.
- Quality must be integer 1..5.
- Manual create / edit: reject if the new range overlaps any existing session for the same user (closed `[start, end)` intervals; active sessions treated as `[start, +∞)`).
- `start` endpoint rejects if any session of this user has `endAt === null`.
- `nightDate` always recomputed server-side via `nightDateFor(startAt, tz)`.

## Client architecture

### `src/lib/sleepNight.js`

Pure functions:
- `nightDateFor(date, tz)` — matches server.
- `groupByNight(sessions)` — returns `[{ nightDate, sessions, totalMs, isActive }]`, newest night first, sessions sorted by `startAt`.
- `formatDuration(ms)` — `"7h 12m"`, `"42m"`, `"—"`.
- `elapsedMs(session, now)` — `(endAt ?? now) - startAt`.

Smoke tests in `src/lib/sleepNight.smoke.mjs` mirror `frequency.smoke.mjs`.

### `src/hooks/useSleep.js`

Returns:
```js
{
  active, sessions, nights, loading,
  reload, startSleep, stopSleep, addManual,
  updateSession, removeSession, setQuality,
}
```

- Active session polled every 30s while page is visible.
- Optimistic updates for stop/edit/delete; rollback on error, surface via `react-hot-toast`.
- TZ included in every mutation body.

### Components

- `src/pages/Sleep.jsx` — page shell. State: `editingSession`, `manualOpen`, `expandedNight`.
- `src/components/SleepActiveCard.jsx` — Start/Stop button, ticking timer when active.
- `src/components/SleepNightCard.jsx` — expandable card per night.
- `src/components/SleepSessionModal.jsx` — datetime-local inputs for start + end (used for both manual-add and edit).
- `src/components/SleepQualityPicker.jsx` — 5-star picker.

### Nav + route

- `src/components/Layout.jsx`: add `{ to: '/sleep', icon: Moon, label: 'Sleep' }` to `NAV` (lucide `Moon`).
- `src/App.jsx`: `<Route path="/sleep" element={<Sleep />} />`.

## Edge cases

| Case | Handling |
|------|----------|
| Start while already active | Server 409; client toast. |
| Active session stale (>18h) | Banner with `[Finish at…]` (opens edit modal) / `[Delete]`. |
| Manual / edit overlaps existing | Server 409; client toast. |
| `end < start` | Client blocks; server rejects 400. |
| Edit moves session across the 6pm boundary | Server recomputes `nightDate`; client refetches; UI regroups. |
| Browser closed mid-active | Active persists server-side; `/sessions/active` restores on next load. |
| Time-zone change | Sticky: existing `nightDate` not recomputed retroactively. New sessions use current tz. |
| Multiple devices | 30s polling; latest write wins. |

## Production-readiness

- Indexes added on `SleepSession` and `SleepNight`.
- All routes scoped by `req.user._id`.
- Server-side validation for every input field.
- JSON error envelope with proper status codes.
- Client toasts surface every server error.
- Empty + loading states in `Sleep.jsx`.
- Smoke tests for `sleepNight.js`.
- `npm run lint` and `npm run build` clean.
- Manual browser walkthrough of all golden + edge paths.

## Verification

See the implementation plan at `~/.claude/plans/i-want-to-add-bright-treasure.md` for the full walkthrough script.
