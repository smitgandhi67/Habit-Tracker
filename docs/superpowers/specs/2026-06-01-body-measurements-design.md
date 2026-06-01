# Body Measurements — Design

Date: 2026-06-01

## Goal

Track body weight (and circumference metrics) over time inside the existing
Gym tab. Surface short-term change signals so the user knows if weekly weight
movement is outside an acceptable band.

## Requirements (from user)

1. Measure weight (primary).
2. Compare current weight against ~7 days ago.
3. Show 7-day average when values are present.
4. Reuse "Habit infrastructure" pattern — dedicated page/model like Sleep, no
   clutter on the Habits screen. **Placement: a new tab inside the Gym page.**
5. Highlight if weekly weight change is beyond an acceptable band.
6. Show last 4 weeks of trends.
7. Allow circumference measurements: chest, waist, abdomen, hips.

## Decisions

- **Storage**: dedicated `BodyMeasurement` model (mirrors `SleepNight`), not
  Habit/HabitLog rows. One doc per `userId + date`, holding all metrics.
- **Metrics**: `weight` (required baseline) + optional `chest`, `waist`,
  `abdomen`, `hips`.
- **Cadence**: weight logged daily (7-day average meaningful); circumferences
  logged weekly. Storage is sparse — any subset of metrics per date.
- **Units**: user-selectable. Reuse existing `weightUnit` (kg/lb); add
  `lengthUnit` (cm/in) on the User model. Values stored raw; unit is a display
  label only (matches the Gym weight convention — no conversion).
- **Alert rule**: weight-threshold only. Warn when |weekly Δ of the 7-day
  average| exceeds **1% of body weight**. No fat-vs-muscle inference. Waist Δ is
  shown beside the alert for context but does not gate it.
- **Stats location**: client-side pure functions in `lib/body.js` (mirrors
  `lib/progress.js` / `lib/sleepNight.js`). Backend stays thin CRUD.

## Architecture

### Backend

- **Model `server/models/BodyMeasurement.js`**

  ```
  { userId: ObjectId(ref User, index),
    date: String 'YYYY-MM-DD',
    weight?: Number, chest?: Number, waist?: Number,
    abdomen?: Number, hips?: Number }   // all metrics > 0
  ```
  Unique compound index `{ userId: 1, date: 1 }`. `timestamps: true`.

- **Routes `server/routes/body.js`** (mounted `app.use('/api/body', requireAuth, ...)`)
  - `GET /measurements?from&to` — ISO-date validated; default window = last 60
    days through tomorrow (covers 4-week trend + 7-day compare). Returns docs
    sorted by `date` asc.
  - `PUT /measurements/:date` — upsert; body may contain any subset of
    `{ weight, chest, waist, abdomen, hips }`. Each provided value must be a
    finite number > 0 (or `null` to clear that metric). Only provided fields are
    written (`$set` / `$unset` for null). Returns the merged doc.
  - `DELETE /measurements/:date` — remove the day's doc.

- **User model**: add `lengthUnit: { enum: ['cm','in'], default: 'in' }`.
- **Auth route**: `PUT /api/auth/length-unit` mirroring `/weight-unit`.
  `me` and `verify` responses include `lengthUnit`.

### Frontend

- **`src/lib/body.js`** — pure, unit-agnostic helpers + `body.smoke.js`:
  - `latestWeight(measurements)` → most recent non-null weight `{ date, value }`.
  - `avg7(measurements, asOf)` → mean of weights within the 7-day window ending
    `asOf`, or `null` if none.
  - `valueNDaysAgo(measurements, metric, asOf, n)` → nearest value at/just
    before `asOf − n` days.
  - `weeklyDelta(measurements, metric, asOf)` → current avg7 (or value) minus the
    value/avg ~7 days prior.
  - `weightAlert(curAvg, prevAvg, pct = 1)` → `null` | `{ dir:'gain'|'loss',
    deltaPct }` when |Δ| / prevAvg × 100 > `pct`.
  - `weeklyBuckets(measurements, metric, weeks = 4)` → array of weekly points for
    the trend sparkline (latest value per ISO week).

- **`src/hooks/useBody.js`** — mirrors `useSleep`: state `measurements`,
  `loading`, `error`; actions `reload`, `save(date, fields)`, `remove(date)`.
  Uses `apiFetch('/api/body/...')`.

- **`src/components/BodyTab.jsx`** — rendered by `Gym.jsx` when `tab === 'body'`.
  Reuses the Gym page's existing top date-navigation as the measurement date.
  Sections:
  1. **Header** — current weight, 7-day average, Δ vs 7 days ago (arrow + tone).
  2. **Alert** — ⚠ banner when `weightAlert` fires (gaining/losing too fast);
     waist Δ shown beside for context.
  3. **Log** — weight input for the selected date; collapsible inputs for
     chest / waist / abdomen / hips. Saves via `save(dateKey, fields)`.
  4. **Trends** — 4-week mini sparkline per metric (`weeklyBuckets`).
  5. **History** — recent dated entries; edit/delete.

- **`src/pages/Gym.jsx`** — add `['body','Body']` to the tab bar; render
  `<BodyTab .../>`. Add a `cm/in` toggle next to the existing `kg/lb` toggle.
- **`src/context/AuthContext.jsx`** — add `updateLengthUnit`, expose in context.

### Data flow

`BodyTab` → `useBody` → `apiFetch('/api/body/...')`. All derived stats computed
in `lib/body.js` from the single `measurements` array. Unit labels read from
`user.weightUnit` / `user.lengthUnit`.

## Error handling

- Routes validate ISO date format and numeric ranges; 400 on bad input,
  404 on missing doc for DELETE.
- Hook surfaces failures via `react-hot-toast` like `useSleep`.
- Empty states: no weight logged → header shows "—", alert hidden, trends show
  placeholder.

## Testing

- `src/lib/body.smoke.js` (ESM, `node src/lib/body.smoke.js`) covering avg7,
  valueNDaysAgo, weeklyDelta, weightAlert thresholds (just under / just over 1%),
  and weeklyBuckets bucketing. Follows existing `*.smoke.js` convention.
- `npm run lint` + `npm run build` for the frontend.

## Deployment

- Frontend: auto-deploys via Vercel on push to `master`.
- Backend (Lambda): manual `sam build && sam deploy` in `server/`. The committed
  `samconfig.toml` hardcodes `AllowedOrigin=localhost:3002`; the live prod stack
  value must be read and passed through on deploy so prod CORS is not clobbered.

## Out of scope (YAGNI)

- Body-fat % / calipers and true composition inference.
- Goal-weight targets, reminders, charts beyond a 4-week sparkline.
- Unit conversion of historical values (raw values keep their entered unit).
