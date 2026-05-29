import { useState, useCallback, useEffect, useMemo } from 'react';
import { format, startOfWeek } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  listPlans, createPlan, updatePlan, archivePlan, unarchivePlan,
} from '../lib/plans';

const ACTIVE_PLAN_LS_KEY = (userId) => `gym:activePlanId:${userId}`;

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
  const { user } = useAuth() || {};
  const userId   = user?._id;

  const [entries,    setEntries]    = useState([]);
  const [weekData,   setWeekData]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);

  // Workout plans state
  const [plans,         setPlans]         = useState([]);
  const [plansLoaded,   setPlansLoaded]   = useState(false);
  const [activePlanId, setActivePlanIdState] = useState(() => {
    if (typeof window === 'undefined' || !userId) return null;
    return window.localStorage.getItem(ACTIVE_PLAN_LS_KEY(userId));
  });

  // Load plans once authenticated; auto-select master plan if none chosen.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listPlans()
      .then(data => {
        if (cancelled) return;
        setPlans(data);
        setPlansLoaded(true);
        const stored = window.localStorage.getItem(ACTIVE_PLAN_LS_KEY(userId));
        const stillExists = stored && data.some(p => p._id === stored);
        if (!stillExists) {
          const master = data.find(p => p.isMaster);
          const fallback = master?._id || data[0]?._id || null;
          setActivePlanIdState(fallback);
          if (fallback) window.localStorage.setItem(ACTIVE_PLAN_LS_KEY(userId), fallback);
          else window.localStorage.removeItem(ACTIVE_PLAN_LS_KEY(userId));
        } else {
          setActivePlanIdState(stored);
        }
      })
      .catch(() => {
        if (!cancelled) setPlansLoaded(true);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const setActivePlanId = useCallback((id) => {
    setActivePlanIdState(id);
    if (!userId) return;
    if (id) window.localStorage.setItem(ACTIVE_PLAN_LS_KEY(userId), id);
    else    window.localStorage.removeItem(ACTIVE_PLAN_LS_KEY(userId));
  }, [userId]);

  const activePlan = useMemo(
    () => plans.find(p => p._id === activePlanId) || null,
    [plans, activePlanId]
  );

  const refetchPlans = useCallback(async () => {
    try {
      const data = await listPlans();
      setPlans(data);
      return data;
    } catch (err) {
      toast.error('Failed to refresh plans');
      throw err;
    }
  }, []);

  const createNewPlan = useCallback(async (body) => {
    const created = await createPlan(body);
    setPlans(prev => [...prev, created]);
    setActivePlanId(created._id);
    return created;
  }, [setActivePlanId]);

  const updateExistingPlan = useCallback(async (id, body) => {
    const updated = await updatePlan(id, body);
    setPlans(prev => prev.map(p => p._id === id ? updated : p));
    return updated;
  }, []);

  const archiveExistingPlan = useCallback(async (id) => {
    await archivePlan(id);
    setPlans(prev => prev.filter(p => p._id !== id));
    if (activePlanId === id) {
      const next = plans.find(p => p._id !== id);
      setActivePlanId(next?._id || null);
    }
  }, [plans, activePlanId, setActivePlanId]);

  const unarchiveExistingPlan = useCallback(async (id) => {
    const restored = await unarchivePlan(id);
    setPlans(prev => {
      const idx = prev.findIndex(p => p._id === id);
      if (idx === -1) return [...prev, restored];
      const next = prev.slice();
      next[idx] = restored;
      return next;
    });
    return restored;
  }, []);

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

  const fetchProgress = useCallback(async (weeks = 12) => {
    try {
      return await apiFetch(`/api/gym/progress?weeks=${weeks}`);
    } catch {
      return [];
    }
  }, []);

  const addExerciseTemplate = useCallback(async (name, bodyPart, videoUrl) => {
    return await apiFetch('/api/gym/exercises-list', {
      method: 'POST',
      body: JSON.stringify({ name, bodyPart, videoUrl: videoUrl || '' }),
    });
  }, []);

  const updateExerciseTemplate = useCallback(async (id, body) => {
    // body may include any subset of { name, bodyPart, videoUrl }.
    return await apiFetch(`/api/gym/exercises-list/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body || {}),
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
    fetchExerciseList, addExerciseTemplate, updateExerciseTemplate, deleteExerciseTemplate,
    addEntry, updateEntry, deleteEntry,
    fetchProgress,
    // Plans
    plans, plansLoaded, activePlanId, activePlan,
    setActivePlanId, refetchPlans,
    createPlan: createNewPlan, updatePlan: updateExistingPlan,
    archivePlan: archiveExistingPlan, unarchivePlan: unarchiveExistingPlan,
  };
}
