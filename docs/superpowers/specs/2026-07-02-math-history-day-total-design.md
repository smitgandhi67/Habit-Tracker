# Math History — Kid-Friendly Day Total

**Date:** 2026-07-02
**Area:** `src/components/PointsLedger.jsx` (rendered by `/math/history` and the admin ledger)

## Problem

On the points history page, each day's total is a tiny gray `+12 pts` string
crammed into the top-right corner of the date header
(`PointsLedger.jsx:93-95`). Kids don't notice it and can't tell it's the total
for that day — there's no label and it competes visually with the date.

## Goal

Make each day's total obvious and readable to a child: prominent, labeled in
plain words, and color-coded, without changing any data or API.

## Design

Add a full-width **day-total banner** at the top of each day group (above the
item rows). Remove the small top-right net from the date header.

Layout per day:

```
FRI, JUN 27
┌───────────────────────────────────────────────┐
│  ⭐  Total today                      +12 pts  │
└───────────────────────────────────────────────┘
 ✨ Addition problem                          +3
 ✨ Subtraction problem                       +3
 🎁 Redeemed sticker                          -4
```

### Banner spec

- **Placement:** first child inside each day block, before the item list. The
  date label (`EEE, MMM d`) stays as the small uppercase header above it.
- **Shape:** full-width rounded card (matches existing `rounded-xl` item style,
  slightly stronger — `rounded-2xl`), padded, colored background tint.
- **Contents (left to right):** star icon, plain-word label, big bold number.
- **Label wording:**
  - Most recent day in the list = `Total today`.
  - All other days = `Day total`.
- **Number:** big and bold (`text-xl`), tabular-nums, with `pts` suffix.
- **Color by sign of `day.net`:**
  - Positive → green (bg `bg-green-50`, text `text-green-700`, star gold).
  - Negative → amber/red (bg `bg-amber-50`, text `text-amber-700`).
  - Zero → gray (bg `bg-slate-50`, text `text-slate-500`), number renders as
    `No change` instead of `0 pts`.
- **Number text:** positive `+N pts`, negative `−N pts` (real minus glyph),
  zero `No change`.

### Data

No change. `day.net` is already computed in the existing `days` memo
(`PointsLedger.jsx:64-76`). "Most recent day" = `days[0]` (events are already
newest-first).

### Scope

- Single file: `src/components/PointsLedger.jsx`, render output only.
- Shared by kid history page and admin ledger — the clearer total benefits both;
  no page-specific branching needed.
- No backend, no API, no new dependencies (icons already from `lucide-react`).

## Out of scope (YAGNI)

- All-time / running balance total.
- Animations or celebratory effects.
- Per-item wording changes.
