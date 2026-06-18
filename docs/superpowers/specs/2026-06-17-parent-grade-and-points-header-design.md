# Parent-Owned Grade + Points Header Badge

Date: 2026-06-17

Two small, independent features.

## 1. Parent-only grade control

### Problem
Grade (2–5) is currently self-set by the kid: `PUT /api/auth/grade` plus a picker on
the Math page. Grade drives the math-practice difficulty caps. The parent should own
this setting; the kid should not be able to change it.

### Backend (`server/routes/math.js`)
- New endpoint `PUT /api/math/admin/grade` (guarded by `requireAdmin`):
  - Body: `{ userId, grade }` where `grade ∈ {2, 3, 4, 5, null}`.
  - Validates `grade` (400 on invalid) and `userId` (404 if no such user).
  - Updates `User.grade`, returns `{ _id, grade }`.
- `GET /api/math/admin/users`: include `grade` in each returned user object so the
  console can show the current value.

### Backend (`server/routes/auth.js`)
- Remove the `PUT /api/auth/grade` route entirely (kid can no longer self-set, even
  via direct API call). Grade still ships read-only in the `/me` and login payloads
  for the difficulty cap.

### Frontend
- `src/pages/MathAdmin.jsx`: in the selected-kid card, add a grade picker — buttons
  2/3/4/5 plus a way to clear (null). Reflects `selected.grade`; on click calls the
  admin endpoint, then updates local `users`/`selected` state. Disabled while `busy`.
- `src/pages/Math.jsx`: remove the grade-picker header block.
- `src/context/AuthContext.jsx`: remove the now-unused `updateGrade` helper.

### Testing (manual)
- Parent sets a kid's grade in the console → kid's Math practice respects the cap.
- Kid has no grade UI on the Math page.
- `PUT /api/auth/grade` returns 404 (route gone).

## 2. Points badge in header

### Problem
The kid's points balance is only visible on the Math page. It should be visible
app-wide in the top header.

### Frontend (`src/components/Layout.jsx`)
- Fetch `GET /api/math/state` on mount and whenever `location.pathname` changes
  (cheap GET; keeps the badge fresh after approve/redeem actions that happen on
  other pages).
- Render a badge top-left of the existing top bar: ⭐ + balance (tabular-nums).
  Header changes from `justify-end` to `justify-between` (badge left, avatar right).
- Badge is a `NavLink` to `/math`.
- Shown on all pages for all users (admin/parent included; their balance is whatever
  `/state` returns).
- If the fetch fails, render nothing (no badge) — never block the header.

### Testing (manual)
- Badge shows current balance on every page.
- After an approve (parent console) or redeem (Math page), navigating updates the badge.
- Tapping the badge navigates to `/math`.

## Out of scope
- No real-time/websocket balance updates; refresh-on-navigation is sufficient.
- No change to how grade caps are computed (existing `mathGrades` logic untouched).
