import { useState, useCallback } from 'react';
import { format, startOfWeek } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';

export const BODY_PARTS = [
  { key: 'chest',     label: 'Chest',      emoji: '💪' },
  { key: 'back',      label: 'Back',        emoji: '🔙' },
  { key: 'shoulders', label: 'Shoulders',   emoji: '🏔️' },
  { key: 'arms',      label: 'Arms',        emoji: '💪' },
  { key: 'legs',      label: 'Legs',        emoji: '🦵' },
  { key: 'core',      label: 'Core',        emoji: '🎯' },
  { key: 'cardio',    label: 'Cardio',      emoji: '🏃' },
  { key: 'full_body', label: 'Full Body',   emoji: '⚡' },
];

export const FEEL_OPTIONS = [
  { key: 'easy',   label: 'Easy',   color: 'text-green-600 bg-green-50 border-green-200' },
  { key: 'medium', label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'hard',   label: 'Hard',   color: 'text-red-600 bg-red-50 border-red-200'       },
];

export function useGym() {
  const [entries,    setEntries]    = useState([]);
  const [weekData,   setWeekData]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);

  const loadEntries = useCallback(async (date) => {
    setLoading(true);
    try {
      const key  = format(date, 'yyyy-MM-dd');
      const data = await apiFetch(`/api/gym/entries?date=${key}`);
      setEntries(data);
    } catch {
      toast.error('Failed to load gym entries');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeek = useCallback(async (anyDateInWeek) => {
    setWeekLoading(true);
    try {
      const mon  = startOfWeek(anyDateInWeek, { weekStartsOn: 1 });
      const key  = format(mon, 'yyyy-MM-dd');
      const data = await apiFetch(`/api/gym/week?weekStart=${key}`);
      setWeekData(data);
    } catch {
      // silent — week widget non-critical
    } finally {
      setWeekLoading(false);
    }
  }, []);

  const fetchExerciseHistory = useCallback(async (exerciseName) => {
    if (!exerciseName.trim()) return null;
    try {
      return await apiFetch(`/api/gym/exercise/${encodeURIComponent(exerciseName.trim())}/history`);
    } catch {
      return null;
    }
  }, []);

  const fetchExerciseNames = useCallback(async () => {
    try {
      return await apiFetch('/api/gym/exercises');
    } catch {
      return [];
    }
  }, []);

  const fetchExerciseList = useCallback(async (bodyPart) => {
    try {
      const q = bodyPart ? `?bodyPart=${bodyPart}` : '';
      return await apiFetch(`/api/gym/exercises-list${q}`);
    } catch {
      return [];
    }
  }, []);

  const addExerciseTemplate = useCallback(async (name, bodyPart) => {
    return await apiFetch('/api/gym/exercises-list', {
      method: 'POST',
      body: JSON.stringify({ name, bodyPart }),
    });
  }, []);

  const deleteExerciseTemplate = useCallback(async (id) => {
    return await apiFetch(`/api/gym/exercises-list/${id}`, { method: 'DELETE' });
  }, []);

  const addEntry = useCallback(async (data) => {
    const entry = await apiFetch('/api/gym/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setEntries(prev => [...prev, entry]);
    return entry;
  }, []);

  const updateEntry = useCallback(async (id, data) => {
    const entry = await apiFetch(`/api/gym/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setEntries(prev => prev.map(e => e._id === id ? entry : e));
    return entry;
  }, []);

  const deleteEntry = useCallback(async (id) => {
    await apiFetch(`/api/gym/entries/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e._id !== id));
  }, []);

  return {
    entries, weekData, loading, weekLoading,
    loadEntries, loadWeek,
    fetchExerciseHistory, fetchExerciseNames,
    fetchExerciseList, addExerciseTemplate, deleteExerciseTemplate,
    addEntry, updateEntry, deleteEntry,
  };
}
