import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';

export const HabitsContext = createContext(null);
export const useHabitsContext = () => useContext(HabitsContext);

const STATUS_CYCLE = ['not_started', 'done', 'half_done', 'not_done'];

// logs shape: { 'YYYY-MM-DD': { habitId: { status, value } } }
function entryToLogObj(e) {
  return { status: e.status || 'not_started', value: e.value ?? null };
}

export function useHabits() {
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState({});
  const [fetchedDates, setFetchedDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const valueTimers = useRef({});

  // Load habits on mount
  useEffect(() => {
    apiFetch('/api/habits')
      .then(setHabits)
      .catch(() => toast.error('Failed to load habits'))
      .finally(() => setLoading(false));
  }, []);

  // Load logs for today and 30 days back — single batch request
  useEffect(() => {
    const dates = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));
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
  }, []);

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

  const isScheduledOn = useCallback((habit, date) => {
    if (habit.frequency === 'daily') return true;
    const day = format(date, 'EEE');
    return Array.isArray(habit.frequency) && habit.frequency.includes(day);
  }, []);

  const habitsForDate = useCallback((date) => {
    return habits.filter(h => isScheduledOn(h, date));
  }, [habits, isScheduledOn]);

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
    let streak = 0;
    for (let i = 1; i <= 365; i++) {
      const date = subDays(new Date(), i);
      if (!isScheduledOn(habit, date)) continue;
      const status = getStatus(habitId, date);
      if (status === 'done' || status === 'half_done') streak++;
      else break;
    }
    return streak;
  }, [habits, isScheduledOn, getStatus]);

  return {
    habits, logs, loading,
    addHabit, updateHabit, deleteHabit, reorderHabits,
    habitsForDate, getStatus, getValue, cycleStatus, setLogValue,
    getStreak, isScheduledOn, ensureLogsForDate,
  };
}
