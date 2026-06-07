# Health Export (Gym + Sleep → Markdown) — Design

**Date:** 2026-06-06
**Status:** Approved (pending spec review)

## Goal

Let a user export their training, body, and sleep data as a single Markdown
file over a chosen date range, so they can paste it into an AI assistant and
get analysis of their routine/health and suggestions for improvement.

## Decisions (locked)

- **One combined file** — Gym (log + body) and Sleep in one `.md`.
- **Range picker**, default last 1 year (today−365 → today).
- **Server-generated** Markdown (one place owns format + heavy queries).
- **Button on the Gym page only** (Sleep page stays clean).

## Architecture

### Server

New route module `server/routes/export.js`, mounted in `server/app.js`:

```js
app.use('/api/export', requireAuth, exportRouter);
```

Endpoint:

```
GET /api/export/health?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Behavior:
- Validate `from`/`to` against `^\d{4}-\d{2}-\d{2}$` (reuse the `ISO_DATE`
  pattern used across routes). On bad format → `400`.
- Defaults: `to` = today (UTC, `YYYY-MM-DD`), `from` = today − 365 days.
- Reject `from > to` → `400 { error: 'from must be on or before to' }`.
- Query, all scoped to `req.user._id` and the date range:
  - `GymEntry`   — `date` in `[from, to]`, sort `date` desc, then `createdAt` asc.
  - `BodyMeasurement` — `date` in `[from, to]`, sort `date` desc.
  - `SleepSession` — `nightDate` in `[from, to]`, sort `startAt` asc.
  - `SleepNight`  — `nightDate` in `[from, to]` (`select nightDate quality`).
  - `User` — read `weightUnit` (default `lb`) and `lengthUnit` (default `in`).
- Build markdown via the pure formatter (below).
- Respond:
  - `Content-Type: text/markdown; charset=utf-8`
  - `Content-Disposition: attachment; filename="health-export_<from>_<to>.md"`
  - body = markdown string.

No new write paths. Read-only endpoint.

### Pure formatter

`server/utils/healthMarkdown.js`:

```js
function buildHealthMarkdown({ from, to, generatedAt, units, gymEntries, body, sleepNights }) { /* → string */ }
module.exports = { buildHealthMarkdown };
```

- `units` = `{ weight, length }`.
- `gymEntries` = array of `{ date, bodyPart, exerciseName, feel, sets:[{reps,weight}], isPersonalRecord, planDayLabel }`.
- `body` = array of `{ date, weight, chest, waist, abdomen, hips }`.
- `sleepNights` = array of `{ nightDate, durationMs, segments, quality }` —
  the route pre-aggregates sessions into per-night rows before calling the
  formatter (sum of `endAt−startAt` per `nightDate`; active/no-end sessions
  excluded from duration but still counted toward `segments`).
- Pure: no DB, no `Date.now()` except a passed-in `generatedAt` (so the smoke
  test is deterministic). Signature includes `generatedAt`.

Rationale for pre-aggregating sleep in the route: keeps the formatter free of
timezone/duration logic and trivially testable; the route already has the
session docs.

### Client

- `src/lib/export.js` → `downloadHealthExport(from, to)`:
  - raw `fetch(\`${BASE}/api/export/health?from=${from}&to=${to}\`, { credentials: 'include' })`
  - on `!res.ok` → `throw new Error(await res.text())`
  - else `blob()` → create object URL → click a temporary `<a download=...>` →
    revoke URL. Filename from `Content-Disposition` when present, else
    `health-export_<from>_<to>.md`.
  - Cannot reuse `apiFetch` (it always `res.json()`s).
- `src/components/ExportHealthModal.jsx`:
  - Two date inputs: `from` (default today−365), `to` (default today).
  - Client-side guard: `from <= to` before enabling Download.
  - Download button → `downloadHealthExport`; `toast.success`/`toast.error`;
    busy state while fetching; close on success.
- `src/pages/Gym.jsx` header: add a Download-icon button (next to the Settings
  gear) that opens `ExportHealthModal`. Visible on all tabs (export is whole-
  account, not tab-specific).

## Markdown layout

```markdown
# Health Export

- **Range:** 2025-06-06 → 2026-06-06
- **Units:** weight = lb, length = in
- **Generated:** 2026-06-06T18:30:00Z

## Summary
- Training days: 96 · sets logged: 712 · distinct exercises: 31 · PRs: 14
- Body weight: 182 lb (2025-06-10) → 174 lb (2026-06-04) — Δ −8 lb
- Sleep: 188 nights tracked · avg duration 7h 06m · avg quality 3.8 / 5

## Gym — Training Log
_Grouped by date, newest first._

### 2026-06-05 · Day 3 (Push)
- **Bench Press** [chest] · medium · 8×135lb, 8×135lb, 6×145lb · 🏆 PR
- **Triceps Pushdown** [arms] · easy · 12×40lb, 12×40lb, 10×45lb

### 2026-06-03 · Day 1 (Legs)
- **Goblet Squat** [legs] · hard · 10×50lb, 10×50lb, 8×55lb

## Gym — Body Measurements
| Date | Weight | Chest | Waist | Abdomen | Hips |
|------|-------:|------:|------:|--------:|-----:|
| 2026-06-04 | 174 | 40 | 33 | 32 | 39 |
| 2026-05-28 | 176 | — | — | — | — |

## Sleep
| Night | Duration | Segments | Quality |
|-------|---------:|---------:|--------:|
| 2026-06-05 | 7h 30m | 1 | 4/5 |
| 2026-06-04 | 6h 50m | 2 | 3/5 |
```

Formatting rules:
- **Summary** primes the AI: training-day count (distinct `date`s with a gym
  entry), total sets, distinct exercise names, PR count; body weight first→last
  with delta (only when ≥1 weight present; omit line if none); sleep nights
  tracked, avg duration, avg quality (averages over nights with data).
- **Training Log** grouped by `date` desc. Day heading shows `planDayLabel`
  when present (`### <date> · <planDayLabel>`), else just `### <date>`.
  Each exercise: `**name** [bodyPart] · feel · <sets> · 🏆 PR?`.
  Sets render `reps×<weight><unit>`; weight omitted when 0/bodyweight
  (`reps` only).
- **Body** one row per measurement date; missing metrics → `—`.
- **Sleep** one row per night present in range (from sessions or nights); missing
  quality → `—`; duration formatted `Xh YYm` (reuse logic equivalent to
  `formatDuration`); `0` segments rows only appear if a quality exists with no
  session.
- Any empty section renders `_No data in this range._` instead of a header-only
  empty table.

## Error handling

- Server: invalid date format or `from > to` → `400` with `{ error }`.
- Empty result set is **not** an error — produce a valid file with
  `_No data in this range._` sections and a Summary noting zero counts.
- Client: non-OK response → read body text, `toast.error`; modal stays open.

## Testing

- `server/utils/healthMarkdown.smoke.js` (node script, repo smoke convention,
  exit 0/1):
  - Full fixture (gym + body + sleep) → assert presence of each section header,
    a sample exercise line with PR marker, a body row with a `—`, a sleep row.
  - Summary math: weight delta, avg sleep duration, avg quality, training-day
    count, PR count.
  - Empty fixture → all four sections show `_No data in this range._`, Summary
    shows zeros, no thrown error.
  - Deterministic via passed-in `generatedAt`.
- Manual read-only check against live catalog/data during implementation
  (fetch the endpoint for the admin user, eyeball the file).

## Deploy note

Server change → **manual SAM deploy** (`cd server && npm run deploy:update`);
not auto-deployed. Client change auto-deploys via Vercel on push. The feature
only works end-to-end once the Lambda is deployed.

## Out of scope (YAGNI)

- Per-exercise progression tables (raw log + summary lets the AI derive these).
- Per-tab/separate files; combined-only.
- CSV/JSON formats; Markdown only.
- Referential `exerciseId` export (names are already canonicalized on write).
