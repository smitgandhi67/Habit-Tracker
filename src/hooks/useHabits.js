import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  isScheduledOn as isScheduledOnFreq,
  isPeriodFrequency,
  periodKeyFor,
  previousPeriodStart,
  targetTimesPerPeriod,
} from '../lib/frequency';

export const HabitsContext = createContext(null);
export const useHabitsContext = () => useContext(HabitsContext);

const STATUS_CYCLE = ['not_started', 'done', 'half_done', 'not_done'];

// logs shape: { 'YYYY-MM-DD': { habitId: { status, value } } }
function entryToLogObj(e) {
  return { status: e.status || 'not_started', value: e.value ?? null };
}

// Adaptive lookback: enough history for cadence-aware visibility / streaks.
// Monthly habits need at least 2 calendar months of context; biweekly need ~6 cycles
// to render a meaningful streak; daily/weekly fit comfortably inside 90 days.
function lookbackForHabits(habits) {
  if (habits.some(h => h.frequency?.type === 'monthly')) return 180;
  if (habits.some(h => h.frequency?.type === 'biweekly')) return 120;
  return 90;
}

export function useHabits() {
  const { user } = useAuth() || {};
  const tz = user?.timezone || null;

  const [habits, setHabits] = useState([]);
  const [habitsLoaded, setHabitsLoaded] = useState(false);
  const [logs, setLogs] = useState({});
  const [fetchedDates, setFetchedDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const valueTimers = useRef({});

  // Load habits on mount
  useEffect(() => {
    apiFetch('/api/habits')
      .then(data => { setHabits(data); setHabitsLoaded(true); })
      .catch(() => toast.error('Failed to load habits'))
      .finally(() => setLoading(false));
  }, []);

  // Load logs once habits are known — lookback adapts to longest cadence present.
  useEffect(() => {
    if (!habitsLoaded) return;
    const days = lookbackForHabits(habits);
    const dates = Array.from({ length: days }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
    apiFetch(`/api/logs/batch?dates=${dates.join(',')}`)
      .then(entries => {
        const map = {};
        dates.forEach(d => { map[d] = {}; });
        entries.forEach(e => {
          if (!map[e.date]) map[e.date] = {};
          map[e.date][e.habitId] = entryToLogObj(e);
        });
        setLogs(map);
        setFetchedDates(new Set(dates));
      })
      .catch(() => toast.error('Failed to load habit history'));
    // Intentionally only depends on habitsLoaded: lookback is sized at first load
    // from the habits snapshot. New habits created after mount don't refetch — that
    // happens naturally on next page reload.
  }, [habitsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureLogsForDate = useCallback(async (date) => {
    const key = format(date, 'yyyy-MM-dd');
    if (fetchedDates.has(key)) return;
    setFetchedDates(prev => new Set([...prev, key]));
    try {
      const entries = await apiFetch(`/api/logs?date=${key}`);
      setLogs(prev => ({
        ...prev,
        [key]: Object.fromEntries(entries.map(e => [e.habitId, entryToLogObj(e)])),
      }));
    } catch {
      setLogs(prev => ({ ...prev, [key]: {} }));
    }
  }, [fetchedDates]);

  const addHabit = useCallback(async (data) => {
    const habit = await apiFetch('/api/habits', { method: 'POST', body: JSON.stringify(data) });
    setHabits(prev => [...prev, habit]);
    return habit;
  }, []);

  const updateHabit = useCallback(async (id, data) => {
    const habit = await apiFetch(`/api/habits/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    setHabits(prev => prev.map(h => h._id === id ? habit : h));
    return habit;
  }, []);

  const deleteHabit = useCallback(async (id) => {
    await apiFetch(`/api/habits/${id}`, { method: 'DELETE' });
    setHabits(prev => prev.filter(h => h._id !== id));
  }, []);

  const reorderHabits = useCallback(async (orderedIds) => {
    setHabits(prev => {
      const map = Object.fromEntries(prev.map(h => [h._id, h]));
      return orderedIds.map((id, i) => ({ ...map[id], order: i }));
    });
    try {
      await apiFetch('/api/habits/reorder', { method: 'PUT', body: JSON.stringify({ ids: orderedIds }) });
    } catch {
      toast.error('Failed to save order');
      apiFetch('/api/habits').then(setHabits).catch(() => {});
    }
  }, []);

  const isScheduledOn = useCallback((habit, date) => isScheduledOnFreq(habit, date, tz), [tz]);

  // True if at least one log entry exists for this habit within loaded history.
  // Used to lock the biweekly anchor in HabitModal — shifting it after logs exist
  // would re-bucket past completions into the wrong period.
  const hasLogsFor = useCallback((habitId) => {
    for (const byHabit of Object.values(logs)) {
      const entry = byHabit?.[habitId];
      if (entry && entry.status !== 'not_started') return true;
    }
    return false;
  }, [logs]);

  // Pre-aggregate weighted period completions: Map<`${habitId}:${periodKey}`, total>.
  // Built once per (habits, logs) change so the hot paths (habitsForDate, getStreak)
  // are O(1) lookups instead of O(logs × habits).
  // Weighting: done → 1.0, half_done → 0.5, other → 0. Two half_dones = one done.
  const periodCompletionsMap = useMemo(() => {
    const map = new Map();
    const periodHabitsById = new Map();
    for (const h of habits) {
      if (isPeriodFrequency(h.frequency)) periodHabitsById.set(h._id, h);
    }
    if (periodHabitsById.size === 0) return map;
    for (const [dateStr, byHabit] of Object.entries(logs)) {
      if (!byHabit) continue;
      let parsed = null;
      for (const [habitId, entry] of Object.entries(byHabit)) {
        const habit = periodHabitsById.get(habitId);
        if (!habit) continue;
        const weight = entry.status === 'done' ? 1 : entry.status === 'half_done' ? 0.5 : 0;
        if (weight === 0) continue;
        if (!parsed) parsed = parseISO(dateStr);
        const key = periodKeyFor(habit, parsed, tz);
        if (!key) continue;
        const mapKey = `${habitId}:${key}`;
        map.set(mapKey, (map.get(mapKey) || 0) + weight);
      }
    }
    return map;
  }, [habits, logs, tz]);

  const completionsInPeriod = useCallback((habit, date) => {
    if (!isPeriodFrequency(habit.frequency)) return 0;
    const key = periodKeyFor(habit, date, tz);
    if (!key) return 0;
    return periodCompletionsMap.get(`${habit._id}:${key}`) || 0;
  }, [periodCompletionsMap, tz]);

  const habitsForDate = useCallback((date) => {
    return habits.filter(h => {
      if (!isScheduledOn(h, date)) return false;
      if (!isPeriodFrequency(h.frequency)) return true;
      // Period cadence: show on date if a log already exists for that date (preserve
      // historical view) OR if completions in the period haven't hit the target yet.
      const key = format(date, 'yyyy-MM-dd');
      if (logs[key]?.[h._id]) return true;
      return completionsInPeriod(h, date) < targetTimesPerPeriod(h);
    });
  }, [habits, isScheduledOn, logs, completionsInPeriod]);

  const getStatus = useCallback((habitId, date) => {
    const key = format(date, 'yyyy-MM-dd');
    return logs[key]?.[habitId]?.status || 'not_started';
  }, [logs]);

  const getValue = useCallback((habitId, date) => {
    const key = format(date, 'yyyy-MM-dd');
    return logs[key]?.[habitId]?.value ?? null;
  }, [logs]);

  const cycleStatus = useCallback(async (habitId, date) => {
    const key = format(date, 'yyyy-MM-dd');
    const current = logs[key]?.[habitId]?.status || 'not_started';
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];

    setLogs(prev => ({
      ...prev,
      [key]: { ...prev[key], [habitId]: { ...prev[key]?.[habitId], status: next } },
    }));

    try {
      await apiFetch(`/api/logs/${habitId}`, {
        method: 'PUT',
        body: JSON.stringify({ date: key, status: next }),
      });
    } catch {
      setLogs(prev => ({
        ...prev,
        [key]: { ...prev[key], [habitId]: { ...prev[key]?.[habitId], status: current } },
      }));
      toast.error('Failed to save — check your connection');
    }
  }, [logs]);

  // Direct status set (Dose Player "Done" button) — same optimistic pattern as cycleStatus.
  const setStatus = useCallback(async (habitId, date, status) => {
    const key = format(date, 'yyyy-MM-dd');
    const current = logs[key]?.[habitId]?.status || 'not_started';
    if (current === status) return;
    setLogs(prev => ({
      ...prev,
      [key]: { ...prev[key], [habitId]: { ...prev[key]?.[habitId], status } },
    }));
    try {
      await apiFetch(`/api/logs/${habitId}`, { method: 'PUT', body: JSON.stringify({ date: key, status }) });
    } catch {
      setLogs(prev => ({
        ...prev,
        [key]: { ...prev[key], [habitId]: { ...prev[key]?.[habitId], status: current } },
      }));
      toast.error('Failed to save — check your connection');
    }
  }, [logs]);

  // Debounced: saves value 600ms after last change
  const setLogValue = useCallback((habitId, date, value) => {
    const key = format(date, 'yyyy-MM-dd');

    // Optimistic update immediately
    setLogs(prev => ({
      ...prev,
      [key]: { ...prev[key], [habitId]: { ...prev[key]?.[habitId], value } },
    }));

    // Debounce the API call
    const timerKey = `${habitId}:${key}`;
    clearTimeout(valueTimers.current[timerKey]);
    valueTimers.current[timerKey] = setTimeout(async () => {
      try {
        await apiFetch(`/api/logs/${habitId}`, {
          method: 'PUT',
          body: JSON.stringify({ date: key, value }),
        });
      } catch {
        toast.error('Failed to save value');
      }
    }, 600);
  }, []);

  const getStreak = useCallback((habitId) => {
    const habit = habits.find(h => h._id === habitId);
    if (!habit) return 0;

    // Period cadences: walk back period-by-period, count consecutive periods
    // where completions met the target. Skip the current (in-progress) period.
    if (isPeriodFrequency(habit.frequency)) {
      const target = targetTimesPerPeriod(habit);
      let streak = 0;
      let cursor = previousPeriodStart(habit, new Date(), tz);
      for (let i = 0; i < 104; i++) {
        if (!cursor) break;
        if (completionsInPeriod(habit, cursor) >= target) {
          streak++;
          cursor = previousPeriodStart(habit, cursor, tz);
        } else break;
      }
      return streak;
    }

    // Daily / specific-days: walk back day-by-day on scheduled days only.
    let streak = 0;
    for (let i = 1; i <= 365; i++) {
      const date = subDays(new Date(), i);
      if (!isScheduledOn(habit, date)) continue;
      const status = getStatus(habitId, date);
      if (status === 'done' || status === 'half_done') streak++;
      else break;
    }
    return streak;
  }, [habits, isScheduledOn, getStatus, completionsInPeriod, tz]);

  return {
    habits, logs, loading,
    addHabit, updateHabit, deleteHabit, reorderHabits,
    habitsForDate, getStatus, getValue, cycleStatus, setStatus, setLogValue,
    getStreak, isScheduledOn, ensureLogsForDate, hasLogsFor,
  };
}
