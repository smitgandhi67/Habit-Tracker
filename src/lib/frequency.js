// Client-side helpers for the canonical Habit.frequency shapes.
// Server-side mirror: server/utils/frequency.js
//
// Shapes:
//   'daily'                                              → every day
//   ['Mon','Wed','Sat']                                  → specific weekdays
//   { type: 'weekly',   times: N }                       → N times / ISO week (Mon-Sun)
//   { type: 'biweekly', times: N, anchor: 'YYYY-MM-DD' } → N times / 14-day cycle from anchor
//   { type: 'monthly',  times: N }                       → N times / calendar month

import {
  format,
  startOfWeek,
  startOfMonth,
  getISOWeekYear,
  getISOWeek,
  differenceInCalendarDays,
  parseISO,
  subDays,
  subMonths,
} from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// Convert a Date or ISO-date string into the equivalent "wall clock" Date in the
// user's timezone. Used so period bucketing reflects the user's local calendar
// regardless of which device they're viewing from.
function inUserTz(date, tz) {
  if (!tz) return typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(date, tz);
}

export const PERIOD_TYPES = ['weekly', 'biweekly', 'monthly'];

const dayName = (date) => format(date, 'EEE'); // 'Mon','Tue',…

function isPeriodFreq(freq) {
  return freq && typeof freq === 'object' && !Array.isArray(freq) && PERIOD_TYPES.includes(freq.type);
}

// Returns true if this habit's schedule applies to this date (ignoring completion state).
// `tz` is optional IANA timezone; when provided, day-of-week and anchor comparison
// are computed in that timezone.
export function isScheduledOn(habit, date, tz) {
  const freq = habit?.frequency;
  const d = inUserTz(date, tz);
  if (freq === 'daily') return true;
  if (Array.isArray(freq)) return freq.includes(dayName(d));
  if (isPeriodFreq(freq)) {
    if (freq.type === 'biweekly' && freq.anchor) {
      const anchor = parseISO(freq.anchor);
      if (differenceInCalendarDays(d, anchor) < 0) return false;
    }
    return true;
  }
  return false;
}

// Stable string key for the period containing `date`, given a habit's cadence.
// Used to bucket logs and decide "is this period complete".
// `tz` is optional IANA timezone; when provided, the calendar boundaries
// (ISO week, calendar month, biweekly cycle day) are computed in that zone.
export function periodKeyFor(habit, date, tz) {
  const freq = habit?.frequency;
  const d = inUserTz(date, tz);
  if (isPeriodFreq(freq)) {
    if (freq.type === 'weekly') {
      return `W:${getISOWeekYear(d)}-${String(getISOWeek(d)).padStart(2, '0')}`;
    }
    if (freq.type === 'biweekly') {
      if (!freq.anchor) return null;
      const anchor = parseISO(freq.anchor);
      const cycle  = Math.floor(differenceInCalendarDays(d, anchor) / 14);
      return `B:${freq.anchor}:${cycle}`;
    }
    if (freq.type === 'monthly') {
      const ym = tz ? formatInTimeZone(date, tz, 'yyyy-MM') : format(d, 'yyyy-MM');
      return `M:${ym}`;
    }
  }
  const ymd = tz ? formatInTimeZone(date, tz, 'yyyy-MM-dd') : format(d, 'yyyy-MM-dd');
  return `D:${ymd}`;
}

// First date (Date object) of the period containing `date` for this habit. Useful for iteration.
// `tz` is optional — when provided the input is interpreted in that zone first.
export function periodStartFor(habit, date, tz) {
  const freq = habit?.frequency;
  const d = inUserTz(date, tz);
  if (isPeriodFreq(freq)) {
    if (freq.type === 'weekly')  return startOfWeek(d, { weekStartsOn: 1 });
    if (freq.type === 'monthly') return startOfMonth(d);
    if (freq.type === 'biweekly' && freq.anchor) {
      const anchor = parseISO(freq.anchor);
      const cycle  = Math.floor(differenceInCalendarDays(d, anchor) / 14);
      const start  = new Date(anchor);
      start.setDate(anchor.getDate() + cycle * 14);
      return start;
    }
  }
  return new Date(d);
}

// How many completions are required per period. 1 for non-period (daily / specific-day).
export function targetTimesPerPeriod(habit) {
  const freq = habit?.frequency;
  if (isPeriodFreq(freq)) return freq.times;
  return 1;
}

// Human-readable label for a habit's frequency. Used in Habits list.
export function formatFrequency(freq) {
  if (freq === 'daily') return 'Every day';
  if (Array.isArray(freq) && freq.length > 0) return freq.join(' · ');
  if (isPeriodFreq(freq)) {
    const t = freq.times;
    if (freq.type === 'weekly')   return `${t}× per week`;
    if (freq.type === 'biweekly') return `${t}× per 2 weeks`;
    if (freq.type === 'monthly')  return `${t}× per month`;
  }
  return '';
}

export function isPeriodFrequency(freq) {
  return isPeriodFreq(freq);
}

// Start of the previous period for a period-cadence habit, or null if not period-based.
// `tz` is optional — when provided, boundaries are computed in that zone.
export function previousPeriodStart(habit, date, tz) {
  const freq = habit?.frequency;
  if (!isPeriodFreq(freq)) return null;
  const d = inUserTz(date, tz);
  if (freq.type === 'weekly')   return startOfWeek(subDays(d, 7),  { weekStartsOn: 1 });
  if (freq.type === 'biweekly') return periodStartFor(habit, subDays(d, 14), tz);
  if (freq.type === 'monthly')  return startOfMonth(subMonths(d, 1));
  return null;
}
