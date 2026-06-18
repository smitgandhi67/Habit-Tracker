# Points Ledger (per-day history of where points come from)

Date: 2026-06-18

## Problem
Parents (and kids) can see a points *balance* but not its *history*. There's no
way to answer "where did these points come from / go?" — which habit awards were
approved or declined, what the parent added or removed, what was redeemed, and how
much came from math practice. This feature adds a paginated, per-day ledger.

## Audience
- **Parent (admin):** views any kid's ledger from the console.
- **Kid:** views their own ledger (read-only).

## Event sources (all merged into one timeline)
| kind | source | delta (signed) | notes |
|------|--------|----------------|-------|
| `earn`    | `MathDailyStat.correct > 0`                          | `+correct` | one row per day; individual answers aren't logged |
| `approve` | `MathPointAdjustment` type `add`, reason `Habit award …` | `+amount`  | habit award approved → pool credited |
| `add`     | `MathPointAdjustment` type `add` (other reasons)     | `+amount`  | parent bonus |
| `deduct`  | `MathPointAdjustment` type `deduct`                  | `−amount`  | parent removal |
| `reset`   | `MathPointAdjustment` type `reset`                   | `−amount`  | pool wiped (amount = what was wiped) |
| `redeem`  | `MathPointAdjustment` type `redeem`                  | `−amount`  | spent on a reward (`rewardKey` in meta) |
| `decline` | `HabitPointAward` status `rejected`                  | `0`        | shows the points it *would* have been |

`approve` vs `add` is distinguished by the reason prefix `Habit award` (that's how
the approval path writes its audit row today).

## Bucketing & ordering
- Each event has a `ts` (Date) and a `localDate` ('YYYY-MM-DD') in the **kid's
  timezone** (`User.timezone`):
  - adjustments → `createdAt`
  - declines → `reviewedAt`
  - earnings → the stat's `date` at local noon (`<date>T12:00:00` in the kid tz)
- Timeline is newest-first by `ts`.

## Pagination — timestamp cursor (k-way merge)
DB-level sorting across three collections isn't possible, and calendar-day paging
wastes slots on empty days. Instead:

`buildLedger(userId, timezone, cursor, limit)`:
1. `cursor` is an ISO timestamp string (absent = now / newest). `limit` default 50,
   max 200.
2. Query each source for events with `ts < cursor`, sorted desc, limited to `limit`:
   - `MathPointAdjustment.find({ userId, createdAt: { $lt: cursor } }).sort(-createdAt).limit(limit)`
   - `HabitPointAward.find({ userId, status: 'rejected', reviewedAt: { $lt: cursor } }).sort(-reviewedAt).limit(limit)`
   - `MathDailyStat` — convert each stat date to its local-noon `ts`; fetch a bounded
     window (`limit` most recent stats with correct>0 whose ts < cursor).
3. Merge the three lists, sort by `ts` desc, take the first `limit`.
4. `nextCursor` = the `ts` of the last returned event (ISO string), or `null` if
   fewer than `limit` events remain across all sources.

Returns `{ events, nextCursor }`. Each event:
`{ ts, localDate, kind, delta, label, meta }` where `label` is a short human string
(e.g. "Read book with dad", "TV time ×2", "Reset", "Math practice").

## Endpoints
- `GET /api/math/admin/ledger?userId=&cursor=&limit=` — `requireAdmin`; validates
  `userId`.
- `GET /api/math/ledger?cursor=&limit=` — the signed-in kid's own ledger.

Both call the shared `buildLedger` helper. Cursor/limit validated (limit clamped,
cursor must parse to a valid date or be omitted).

## Frontend
- One `PointsLedger` component: groups the returned events by `localDate`, renders a
  day header with the day's **net ±**, then each line item (icon by kind, label,
  signed delta; declines shown muted with "(declined)"). A "Load more" button passes
  `nextCursor`; hidden when `nextCursor` is null.
- **Kid:** new route `/math/history`, reached from a "History" link on the Math page
  header. Fetches `/api/math/ledger`.
- **Parent:** rendered inside the console under the selected kid, fetching
  `/api/math/admin/ledger?userId=<kid>`.

## Testing
- e2e smoke (against running server, minted JWTs): seed a kid with a mix —
  approved award, declined award, admin add, deduct, redeem, and a daily stat —
  then page the ledger and assert order (newest first), correct `kind`/`delta` per
  row, day grouping, and cursor paging (limit=2 → nextCursor → remaining). Restore
  all seeded data afterward.
- Build + lint touched files.

## Out of scope
- No per-answer math itemization (only daily aggregates exist).
- No CSV/export (the existing health export is separate).
- No editing/undo from the ledger — it's read-only history.
