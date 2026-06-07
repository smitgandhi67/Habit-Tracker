# Health Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-button export that downloads a user's gym log, body measurements, and sleep history over a chosen date range as a single Markdown file for feeding to an AI.

**Architecture:** A read-only server endpoint `GET /api/export/health` queries the four collections, pre-aggregates sleep sessions into per-night rows, and runs everything through a pure Markdown formatter that returns the file body as a `text/markdown` attachment. The frontend adds a Download button in the Gym header that opens a small range-picker modal and triggers a blob download.

**Tech Stack:** Node/Express + Mongoose (server), React + date-fns + react-hot-toast (client). Tests use the repo's plain-node smoke-script convention (assert + `process.exit`).

---

## File Structure

- Create `server/utils/healthMarkdown.js` — pure formatter + sleep aggregation (no DB, no clock). Exports `buildHealthMarkdown`, `aggregateSleepNights`, `formatDurationMs`.
- Create `server/utils/healthMarkdown.smoke.js` — smoke test for the above.
- Create `server/routes/export.js` — `GET /api/export/health` route.
- Modify `server/app.js` — mount the export router under `requireAuth`.
- Create `src/lib/export.js` — `downloadHealthExport(from, to)` blob download helper.
- Create `src/components/ExportHealthModal.jsx` — range-picker modal.
- Modify `src/pages/Gym.jsx` — Download button in header + modal wiring.

---

## Task 1: Pure formatter + sleep aggregation (TDD)

**Files:**
- Create: `server/utils/healthMarkdown.js`
- Test: `server/utils/healthMarkdown.smoke.js`

- [ ] **Step 1: Write the failing smoke test**

Create `server/utils/healthMarkdown.smoke.js`:

```js
// Smoke test for healthMarkdown. Run with:
//   node server/utils/healthMarkdown.smoke.js
// Exits 0 if all assertions pass, 1 otherwise.

const {
  buildHealthMarkdown, aggregateSleepNights, formatDurationMs,
} = require('./healthMarkdown');

let failures = 0;
function ok(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
}

// --- formatDurationMs ---
ok('duration 7h30m', formatDurationMs(27_000_000) === '7h 30m');
ok('duration pads minutes', formatDurationMs(6 * 3600_000 + 5 * 60_000) === '6h 05m');
ok('duration zero → dash', formatDurationMs(0) === '—');

// --- aggregateSleepNights ---
const agg = aggregateSleepNights(
  [
    { nightDate: '2026-06-05', startAt: '2026-06-05T22:00:00Z', endAt: '2026-06-06T05:30:00Z' },
    { nightDate: '2026-06-04', startAt: '2026-06-04T23:00:00Z', endAt: '2026-06-05T02:00:00Z' },
    { nightDate: '2026-06-04', startAt: '2026-06-05T03:00:00Z', endAt: '2026-06-05T06:00:00Z' },
  ],
  [
    { nightDate: '2026-06-05', quality: 4 },
    { nightDate: '2026-06-04', quality: 3 },
  ],
);
ok('agg sorted desc', agg[0].nightDate === '2026-06-05' && agg[1].nightDate === '2026-06-04');
ok('agg merges segments', agg[1].segments === 2);
ok('agg sums duration', agg[1].durationMs === 6 * 3600_000);
ok('agg attaches quality', agg[0].quality === 4);

// --- buildHealthMarkdown: full fixture ---
const md = buildHealthMarkdown({
  from: '2025-06-06', to: '2026-06-06', generatedAt: '2026-06-06T18:30:00Z',
  units: { weight: 'lb', length: 'in' },
  gymEntries: [
    { date: '2026-06-05', bodyPart: 'chest', exerciseName: 'Bench Press', feel: 'medium',
      sets: [{ reps: 8, weight: 135 }, { reps: 6, weight: 145 }], isPersonalRecord: true, planDayLabel: 'Day 3' },
    { date: '2026-06-03', bodyPart: 'legs', exerciseName: 'Goblet Squat', feel: 'hard',
      sets: [{ reps: 10, weight: 50 }], isPersonalRecord: false, planDayLabel: '' },
  ],
  body: [
    { date: '2026-06-04', weight: 174, chest: 40, waist: 33, abdomen: null, hips: null },
    { date: '2025-06-10', weight: 182, chest: null, waist: null, abdomen: null, hips: null },
  ],
  sleepNights: agg,
});
ok('has title', md.includes('# Health Export'));
ok('has range', md.includes('2025-06-06 → 2026-06-06'));
ok('summary training days', md.includes('Training days: 2'));
ok('summary PR count', md.includes('PRs: 1'));
ok('summary weight delta', md.includes('182 lb (2025-06-10) → 174 lb (2026-06-04)') && md.includes('−8 lb'));
ok('log day label', md.includes('### 2026-06-05 · Day 3'));
ok('log no-label heading', md.includes('### 2026-06-03\n'));
ok('log exercise + PR', md.includes('**Bench Press** [chest] · medium · 8×135lb, 6×145lb · 🏆 PR'));
ok('body row with dash', md.includes('| 2026-06-04 | 174 | 40 | 33 | — | — |'));
ok('sleep row', md.includes('| 2026-06-05 | 7h 30m | 1 | 4/5 |'));

// --- buildHealthMarkdown: empty fixture ---
const empty = buildHealthMarkdown({
  from: '2026-01-01', to: '2026-01-31', generatedAt: '2026-02-01T00:00:00Z',
  units: { weight: 'kg', length: 'cm' }, gymEntries: [], body: [], sleepNights: [],
});
ok('empty: training log placeholder', empty.includes('## Gym — Training Log\n_No data in this range._'));
ok('empty: body placeholder', empty.includes('## Gym — Body Measurements\n_No data in this range._'));
ok('empty: sleep placeholder', empty.includes('## Sleep\n_No data in this range._'));
ok('empty: summary no crash', empty.includes('Training days: 0'));

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node server/utils/healthMarkdown.smoke.js`
Expected: FAIL — `Cannot find module './healthMarkdown'`.

- [ ] **Step 3: Implement the formatter**

Create `server/utils/healthMarkdown.js`:

```js
// Pure Markdown builder for the health export. No DB and no wall-clock
// (generatedAt is passed in) so output is deterministic and unit-testable.

function pad2(n) { return String(n).padStart(2, '0'); }

// milliseconds → "Xh YYm"; 0/falsy → "—"
function formatDurationMs(ms) {
  if (!ms || ms <= 0) return '—';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${pad2(m)}m`;
}

// numeric cell or "—" for null/undefined/NaN
function cell(v) {
  return (v === null || v === undefined || Number.isNaN(v)) ? '—' : String(v);
}

// "reps×weightunit"; weight omitted when 0/falsy (bodyweight)
function formatSet(set, weightUnit) {
  const reps = set?.reps ?? 0;
  if (!set || !set.weight) return `${reps}`;
  return `${reps}×${set.weight}${weightUnit}`;
}

// Collapse raw sleep sessions + night-quality docs into one row per night.
// Returns rows sorted by nightDate descending. Pure.
function aggregateSleepNights(sessions = [], nights = []) {
  const map = new Map();
  const ensure = (d) => {
    if (!map.has(d)) map.set(d, { nightDate: d, durationMs: 0, segments: 0, quality: null });
    return map.get(d);
  };
  for (const s of sessions) {
    const row = ensure(s.nightDate);
    row.segments += 1;
    if (s.endAt) row.durationMs += new Date(s.endAt).getTime() - new Date(s.startAt).getTime();
  }
  for (const n of nights) ensure(n.nightDate).quality = n.quality;
  return [...map.values()].sort((a, b) => b.nightDate.localeCompare(a.nightDate));
}

function buildSummary({ units, gymEntries, body, sleepNights }) {
  const lines = [];

  const trainDates = new Set(gymEntries.map(e => e.date));
  const totalSets = gymEntries.reduce((n, e) => n + (e.sets?.length || 0), 0);
  const exNames = new Set(gymEntries.map(e => e.exerciseName));
  const prs = gymEntries.filter(e => e.isPersonalRecord).length;
  lines.push(`- Training days: ${trainDates.size} · sets logged: ${totalSets} · distinct exercises: ${exNames.size} · PRs: ${prs}`);

  const weights = body
    .filter(b => b.weight !== null && b.weight !== undefined)
    .map(b => ({ date: b.date, weight: b.weight }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (weights.length) {
    const f = weights[0];
    const l = weights[weights.length - 1];
    const delta = l.weight - f.weight;
    const sign = delta > 0 ? '+' : (delta < 0 ? '−' : '±');
    lines.push(`- Body weight: ${f.weight} ${units.weight} (${f.date}) → ${l.weight} ${units.weight} (${l.date}) — Δ ${sign}${Math.abs(delta)} ${units.weight}`);
  }

  if (sleepNights.length) {
    const withDur = sleepNights.filter(n => n.durationMs > 0);
    const withQual = sleepNights.filter(n => n.quality !== null && n.quality !== undefined);
    const avgDur = withDur.length ? withDur.reduce((s, n) => s + n.durationMs, 0) / withDur.length : 0;
    const avgQual = withQual.length ? withQual.reduce((s, n) => s + n.quality, 0) / withQual.length : null;
    const qualStr = avgQual === null ? '—' : `${avgQual.toFixed(1)} / 5`;
    lines.push(`- Sleep: ${sleepNights.length} nights tracked · avg duration ${formatDurationMs(avgDur)} · avg quality ${qualStr}`);
  }

  return lines.join('\n');
}

function buildTrainingLog(gymEntries, weightUnit) {
  if (!gymEntries.length) return '_No data in this range._';
  const order = [];
  const byDate = new Map();
  for (const e of gymEntries) {
    if (!byDate.has(e.date)) { byDate.set(e.date, []); order.push(e.date); }
    byDate.get(e.date).push(e);
  }
  const blocks = order.map(date => {
    const items = byDate.get(date);
    const label = items.find(i => i.planDayLabel)?.planDayLabel;
    const heading = label ? `### ${date} · ${label}` : `### ${date}`;
    const lines = items.map(e => {
      const sets = (e.sets || []).map(s => formatSet(s, weightUnit)).join(', ');
      const pr = e.isPersonalRecord ? ' · 🏆 PR' : '';
      return `- **${e.exerciseName}** [${e.bodyPart}] · ${e.feel} · ${sets}${pr}`;
    });
    return `${heading}\n${lines.join('\n')}`;
  });
  return `_Grouped by date, newest first._\n\n${blocks.join('\n\n')}`;
}

function buildBodyTable(body) {
  if (!body.length) return '_No data in this range._';
  const head = '| Date | Weight | Chest | Waist | Abdomen | Hips |\n|------|-------:|------:|------:|--------:|-----:|';
  const rows = body.map(b =>
    `| ${b.date} | ${cell(b.weight)} | ${cell(b.chest)} | ${cell(b.waist)} | ${cell(b.abdomen)} | ${cell(b.hips)} |`);
  return [head, ...rows].join('\n');
}

function buildSleepTable(sleepNights) {
  if (!sleepNights.length) return '_No data in this range._';
  const head = '| Night | Duration | Segments | Quality |\n|-------|---------:|---------:|--------:|';
  const rows = sleepNights.map(n =>
    `| ${n.nightDate} | ${formatDurationMs(n.durationMs)} | ${n.segments} | ${n.quality == null ? '—' : `${n.quality}/5`} |`);
  return [head, ...rows].join('\n');
}

function buildHealthMarkdown({ from, to, generatedAt, units, gymEntries = [], body = [], sleepNights = [] }) {
  return [
    '# Health Export\n',
    `- **Range:** ${from} → ${to}`,
    `- **Units:** weight = ${units.weight}, length = ${units.length}`,
    `- **Generated:** ${generatedAt}\n`,
    '## Summary',
    buildSummary({ units, gymEntries, body, sleepNights }) + '\n',
    '## Gym — Training Log',
    buildTrainingLog(gymEntries, units.weight) + '\n',
    '## Gym — Body Measurements',
    buildBodyTable(body) + '\n',
    '## Sleep',
    buildSleepTable(sleepNights),
  ].join('\n');
}

module.exports = { buildHealthMarkdown, aggregateSleepNights, formatDurationMs };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node server/utils/healthMarkdown.smoke.js`
Expected: `All smoke checks passed.` and exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/utils/healthMarkdown.js server/utils/healthMarkdown.smoke.js
git commit -m "feat(export): pure health-export Markdown formatter + smoke test"
```

---

## Task 2: Export route

**Files:**
- Create: `server/routes/export.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create the route**

Create `server/routes/export.js`:

```js
const express = require('express');
const router = express.Router();
const GymEntry = require('../models/GymEntry');
const BodyMeasurement = require('../models/BodyMeasurement');
const SleepSession = require('../models/SleepSession');
const SleepNight = require('../models/SleepNight');
const User = require('../models/User');
const { buildHealthMarkdown, aggregateSleepNights } = require('../utils/healthMarkdown');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayUTC() { return new Date().toISOString().slice(0, 10); }
function minusDaysUTC(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// GET /api/export/health?from=YYYY-MM-DD&to=YYYY-MM-DD
// Defaults: from = today-365, to = today. Returns a text/markdown attachment.
router.get('/health', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (from && !ISO_DATE.test(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
    if (to && !ISO_DATE.test(to))     return res.status(400).json({ error: 'to must be YYYY-MM-DD' });

    const fromStr = from || minusDaysUTC(365);
    const toStr   = to   || todayUTC();
    if (fromStr > toStr) return res.status(400).json({ error: 'from must be on or before to' });

    const userId = req.user._id;
    const [user, gymEntries, body, sessions, nights] = await Promise.all([
      User.findById(userId).select('weightUnit lengthUnit'),
      GymEntry.find({ userId, date: { $gte: fromStr, $lte: toStr } }).sort({ date: -1, createdAt: 1 }).lean(),
      BodyMeasurement.find({ userId, date: { $gte: fromStr, $lte: toStr } }).sort({ date: -1 }).lean(),
      SleepSession.find({ userId, nightDate: { $gte: fromStr, $lte: toStr } }).sort({ startAt: 1 }).lean(),
      SleepNight.find({ userId, nightDate: { $gte: fromStr, $lte: toStr } }).select('nightDate quality').lean(),
    ]);

    const sleepNights = aggregateSleepNights(sessions, nights);
    const units = {
      weight: user?.weightUnit || 'lb',
      length: user?.lengthUnit || 'in',
    };

    const md = buildHealthMarkdown({
      from: fromStr, to: toStr,
      generatedAt: new Date().toISOString(),
      units, gymEntries, body, sleepNights,
    });

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="health-export_${fromStr}_${toStr}.md"`);
    res.send(md);
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 2: Mount the router in `server/app.js`**

Add the require alongside the other route requires (after the `bodyRouter` line):

```js
const exportRouter     = require('./routes/export');
```

Add the mount alongside the other `app.use('/api/...', requireAuth, ...)` lines (after the `/api/body` line):

```js
app.use('/api/export',      requireAuth, exportRouter);
```

- [ ] **Step 3: Syntax-check both files**

Run: `node --check server/routes/export.js && node --check server/app.js`
Expected: no output, exit 0.

- [ ] **Step 4: Re-run the formatter smoke test (regression)**

Run: `node server/utils/healthMarkdown.smoke.js`
Expected: `All smoke checks passed.`

- [ ] **Step 5: Commit**

```bash
git add server/routes/export.js server/app.js
git commit -m "feat(export): GET /api/export/health Markdown endpoint"
```

---

## Task 3: Client download helper, modal, and Gym button

**Files:**
- Create: `src/lib/export.js`
- Create: `src/components/ExportHealthModal.jsx`
- Modify: `src/pages/Gym.jsx`

- [ ] **Step 1: Create the download helper**

Create `src/lib/export.js`:

```js
const BASE = import.meta.env.VITE_API_BASE_URL || '';

// Fetch the health Markdown export for [from, to] and trigger a browser
// download. Throws Error(message) on a non-OK response so callers can toast it.
// (Cannot reuse apiFetch — that helper always parses the body as JSON.)
export async function downloadHealthExport(from, to) {
  const url = `${BASE}/api/export/health?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `health-export_${from}_${to}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
```

- [ ] **Step 2: Create the modal**

Create `src/components/ExportHealthModal.jsx`:

```jsx
import { useState } from 'react';
import { format, subYears } from 'date-fns';
import toast from 'react-hot-toast';
import { downloadHealthExport } from '../lib/export';

export default function ExportHealthModal({ onClose }) {
  const today = new Date();
  const [from, setFrom] = useState(format(subYears(today, 1), 'yyyy-MM-dd'));
  const [to, setTo]     = useState(format(today, 'yyyy-MM-dd'));
  const [busy, setBusy] = useState(false);
  const valid = from && to && from <= to;

  async function handleDownload() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await downloadHealthExport(from, to);
      toast.success('Export downloaded');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-1">Export health data</h2>
        <p className="text-xs text-slate-500 mb-4">
          Gym log, body measurements, and sleep as a Markdown file to feed an AI.
        </p>

        <label className="block text-xs font-semibold text-slate-600 mb-1">From</label>
        <input
          type="date" value={from} max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="w-full mb-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />

        <label className="block text-xs font-semibold text-slate-600 mb-1">To</label>
        <input
          type="date" value={to} min={from}
          onChange={(e) => setTo(e.target.value)}
          className="w-full mb-4 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />

        {!valid && (
          <p className="text-xs text-red-500 mb-2">“From” must be on or before “To”.</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={!valid || busy}
            className="px-4 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? 'Preparing…' : 'Download .md'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the button into `src/pages/Gym.jsx`**

3a. Add `Download` to the existing lucide-react import (line 4). The current line is:

```js
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Trophy, Settings, BookOpen } from 'lucide-react';
```

Replace with:

```js
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Trophy, Settings, BookOpen, Download } from 'lucide-react';
```

3b. Add the modal import after the `BodyTab` import (line 13):

```js
import ExportHealthModal from '../components/ExportHealthModal';
```

3c. Add modal state next to the other `useState` hooks (after the `manageOpen` line, ~line 33):

```js
  const [exportOpen, setExportOpen] = useState(false);
```

3d. Add the Download button in the header actions, immediately before the Settings (Manage exercises) button. Find:

```jsx
          <button
            onClick={() => setManageOpen(true)}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Manage exercises"
          >
            <Settings size={20} className="text-slate-500" />
          </button>
```

Insert immediately before it:

```jsx
          <button
            onClick={() => setExportOpen(true)}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Export health data"
          >
            <Download size={20} className="text-slate-500" />
          </button>
```

3e. Render the modal. Find the Manage exercises modal block near the end:

```jsx
      {/* Manage exercises modal */}
      {manageOpen && (
```

Insert immediately before that comment:

```jsx
      {/* Export health modal */}
      {exportOpen && (
        <ExportHealthModal onClose={() => setExportOpen(false)} />
      )}

```

- [ ] **Step 4: Lint the changed frontend files**

Run: `npx eslint src/pages/Gym.jsx src/components/ExportHealthModal.jsx src/lib/export.js`
Expected: no output (clean), exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export.js src/components/ExportHealthModal.jsx src/pages/Gym.jsx
git commit -m "feat(export): Gym header export button + range-picker modal"
```

---

## Task 4: Deploy and verify end-to-end

**Files:** none (deploy only).

- [ ] **Step 1: Build the frontend to catch compile errors**

Run: `npm run build`
Expected: Vite build succeeds, no errors.

- [ ] **Step 2: Push (frontend auto-deploys via Vercel)**

```bash
git push origin master
```

Expected: push succeeds; Vercel begins a deploy.

- [ ] **Step 3: Deploy the server (manual SAM)**

Run in PowerShell:

```powershell
Set-Location server; sam build; if ($?) { sam deploy --no-confirm-changeset }
```

Expected: `Successfully created/updated stack - habit-tracker in us-east-2`.

- [ ] **Step 4: Verify the endpoint after both deploys finish**

In the running app (logged in), open the Gym tab → tap the Download icon → pick a range → **Download .md**. Confirm a `health-export_<from>_<to>.md` file downloads and contains the `# Health Export` header, a Summary line, and the three sections. For an account with no data in range, confirm the sections show `_No data in this range._` rather than erroring.

---

## Self-Review

**Spec coverage:**
- Combined single file → `buildHealthMarkdown` (Task 1) ✓
- Server-generated, `GET /api/export/health?from&to`, defaults today−365→today, `from>to` 400 → Task 2 ✓
- Pure formatter + smoke test → Task 1 ✓
- Route pre-aggregates sleep into per-night rows → `aggregateSleepNights` (Task 1), used in Task 2 ✓
- `text/markdown` attachment + filename → Task 2 ✓
- Client raw-fetch blob download (not apiFetch) → `src/lib/export.js` (Task 3) ✓
- Range-picker modal, default last 1yr, `from<=to` guard → `ExportHealthModal` (Task 3) ✓
- Download button in Gym header, all tabs → Gym.jsx edits (Task 3) ✓
- Markdown layout (Summary, Training Log by date w/ planDayLabel + PR, Body table w/ `—`, Sleep table), empty sections `_No data in this range._` → Task 1 formatter + smoke assertions ✓
- Units from `User.weightUnit`/`lengthUnit` (req.user is JWT only) → Task 2 fetches User ✓
- Manual SAM deploy note → Task 4 ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `buildHealthMarkdown({ from, to, generatedAt, units, gymEntries, body, sleepNights })`, `aggregateSleepNights(sessions, nights)`, `formatDurationMs(ms)`, `downloadHealthExport(from, to)` used identically across the route, modal, and tests. ✓
