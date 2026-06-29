# Problem Journal: mark done → approve for 100 points

## Goal
A kid can mark a Problem Journal entry **done**. Doing so sends it for parent
approval worth **100 points**. The parent approves it in the **same screen** they
already use for habit completions. Each problem can earn the 100 only **once**.

## Decisions
- Approval surface: reuse the existing parent approval queue (habit-awards screen).
- Points: 100, fixed.
- Cap: once per problem (enforced by a unique index on `problemId`).
- Safeguard against accidents: a **confirm dialog when the kid marks Done** (only
  the `done` action). No parent-side confirm, no reverse-credit in this iteration.

## Data model — new `ProblemAward` collection
Reusing `HabitPointAward` would require a risky live migration of its
`{habitId,date}` unique index (habitId is required there). A separate collection
keeps the proven habit flow untouched and gives "once per problem" for free.

```
ProblemAward {
  userId     ObjectId  ref User, required, index
  problemId  ObjectId  ref ProblemEntry, required, UNIQUE   // once per problem
  text       String    // snapshot of the problem at done-time
  kind       String    // snapshot (annoyance|curiosity|idea)
  date       String    // YYYY-MM-DD, snapshot of problem.date (for grouping/display)
  points     Number    // snapshot (100)
  status     enum pending|approved|rejected, default pending, index
  reviewedBy String    // admin email
  reviewedAt Date
  timestamps
}
```

## Backend changes
- `utils/builder.js`: add `done` to `PROBLEM_STATUSES`; add `POINTS.problemSolved = 100`.
- `models/ProblemEntry.js`: status enum picks up `done` automatically (uses PROBLEM_STATUSES).
- `routes/build.js`:
  - `PATCH /problems/:id`: when status transitions to `done`, upsert a pending
    `ProblemAward` (idempotent via unique problemId — re-marking never double-awards).
  - `GET /`: attach `approval` (`pending|approved|rejected|null`) to each problem.
  - `DELETE /problems/:id`: delete its `ProblemAward`.
- `routes/math.js`:
  - `GET /admin/habit-awards`: merge habit + problem awards into the same response
    shape, tagged `source: 'habit'|'problem'`. Problem rows use the kind emoji as
    `habitEmoji` and the problem text as `habitName`.
  - approve / reject / approve-batch: resolve the id against either collection.
    Approving a problem award credits the shared wallet +points and writes an audit
    row `Problem solved: "<text>"`. Same atomic/idempotent/revert guards as habits.

## Frontend changes
- `pages/Build.jsx` `ProblemRow`:
  - Add a **Done** button (hidden once done). Clicking it opens a confirm:
    "Mark done and send for approval? You'll earn 100 points once a parent approves."
    Only the done action confirms.
  - Show an approval badge from the new `approval` field:
    pending → "Awaiting approval", approved → "Earned 100 ⭐", rejected → "Not approved".
  - Add a `done` entry to `STATUS_CHIP`.
- `pages/MathAdmin.jsx`: unchanged — problem awards render in the existing queue
  (label = problem text, emoji = kind). Per-row Approve/Reject and batch already
  POST by id, now resolved against both collections.

## Flow
kid marks Done (confirm) → status `done` + pending 100 award → parent sees it in the
approval screen → Approve credits 100 to the shared wallet; Reject credits nothing.

## Out of scope
Daily cap (parent is the gate), "explain it" gate, point clawback on un-done,
parent-side reverse/un-approve.

## Deploy note
UI auto-deploys via Vercel on push. The Lambda backend (build.js, math.js, models,
builder.js) needs a manual SAM deploy before the API behaves as specced.
