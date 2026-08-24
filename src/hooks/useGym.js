import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { format, startOfWeek } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { cacheKey, readCache, writeCache, clearCache, isFresh } from '../lib/gymCache';
import {
  listPlans, createPlan, updatePlan, archivePlan, unarchivePlan,
} from '../lib/plans';

const ACTIVE_PLAN_LS_KEY = (userId) => `gym:activePlanId:${userId}`;

// One store per gym page, shared through this context. Calling useGym() in each
// component gave every tab its own copy of the plans (four /api/plans requests
// per visit) and its own activePlanId, so switching plans in the Plan tab left
// the Log tab's recommendations resolved against the previous plan.
export const GymContext = createContext(null);
// Co-located hook for the provider above; intentionally exported alongside it.
export const useGymStore = () => useContext(GymContext);

// Cache names (namespaced per user by cacheKey).
const CK_PLANS   = 'plans';
const CK_LIBRARY = 'exercise-library';
const CK_RECS    = 'plan-recs';

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

  // Adopt a plans list (cached or fresh) and reconcile the selection, which
  // lives in localStorage and so can point at a plan archived on another device.
  const applyPlans = useCallback((data) => {
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
  }, [userId]);

  // Load plans once authenticated: paint the cached copy, then revalidate only
  // if it has gone stale. queueMicrotask keeps the cached paint out of the
  // effect body, which must not set state synchronously.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const key    = cacheKey(userId, CK_PLANS);
    const cached = readCache(key);

    queueMicrotask(() => {
      if (!cancelled && cached?.value) applyPlans(cached.value);
    });

    if (!isFresh(cached)) {
      listPlans()
        .then(data => {
          if (cancelled) return;
          writeCache(key, data);
          applyPlans(data);
        })
        .catch(() => {
          // Keep the cached copy on screen; only an empty cache falls through
          // to the "no plans yet" state.
          if (!cancelled && !cached?.value) setPlansLoaded(true);
        });
    }
    return () => { cancelled = true; };
  }, [userId, applyPlans]);

  // Every local write re-caches the list, so the next mount paints the
  // post-write state instead of flashing the pre-write one.
  const cachePlans = useCallback((data) => {
    if (userId) writeCache(cacheKey(userId, CK_PLANS), data);
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
      cachePlans(data);
      return data;
    } catch (err) {
      toast.error('Failed to refresh plans');
      throw err;
    }
  }, [cachePlans]);

  const createNewPlan = useCallback(async (body) => {
    const created = await createPlan(body);
    setPlans(prev => {
      const next = [...prev, created];
      cachePlans(next);
      return next;
    });
    setActivePlanId(created._id);
    return created;
  }, [setActivePlanId, cachePlans]);

  const updateExistingPlan = useCallback(async (id, body) => {
    const updated = await updatePlan(id, body);
    setPlans(prev => {
      const next = prev.map(p => p._id === id ? updated : p);
      cachePlans(next);
      return next;
    });
    return updated;
  }, [cachePlans]);

  const archiveExistingPlan = useCallback(async (id) => {
    await archivePlan(id);
    setPlans(prev => {
      const next = prev.filter(p => p._id !== id);
      cachePlans(next);
      return next;
    });
    if (activePlanId === id) {
      const next = plans.find(p => p._id !== id);
      setActivePlanId(next?._id || null);
    }
  }, [plans, activePlanId, setActivePlanId, cachePlans]);

  const unarchiveExistingPlan = useCallback(async (id) => {
    const restored = await unarchivePlan(id);
    setPlans(prev => {
      const idx = prev.findIndex(p => p._id === id);
      const next = idx === -1 ? [...prev, restored] : prev.slice();
      if (idx !== -1) next[idx] = restored;
      cachePlans(next);
      return next;
    });
    return restored;
  }, [cachePlans]);

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

  // Returns { last, pr, recent, target, step, stepSource, recommendation, setting }.
  // `planId` lets the server resolve the rep window from the plan the user
  // actually has selected, since "active plan" lives in localStorage.
  const fetchExerciseHistory = useCallback(async (exerciseName, opts = {}) => {
    if (!exerciseName?.trim()) return null;
    try {
      const params = new URLSearchParams();
      if (opts.planId)   params.set('planId', opts.planId);
      if (opts.dayLabel) params.set('dayLabel', opts.dayLabel);
      const qs = params.toString();
      return await apiFetch(
        `/api/gym/exercise/${encodeURIComponent(exerciseName.trim())}/history${qs ? `?${qs}` : ''}`,
      );
    } catch {
      return null;
    }
  }, []);

  // Bulk next-weight targets. With no `names` the server covers every exercise
  // in the given plan (optionally one day).
  const fetchRecommendations = useCallback(async ({ planId, dayLabel, names } = {}) => {
    try {
      const params = new URLSearchParams();
      if (planId)   params.set('planId', planId);
      if (dayLabel) params.set('dayLabel', dayLabel);
      if (names?.length) params.set('names', names.join(','));
      const qs = params.toString();
      return await apiFetch(`/api/gym/recommendations${qs ? `?${qs}` : ''}`);
    } catch {
      return [];
    }
  }, []);

  // Bumped by every entry write. Recommendations are derived from logged sets,
  // so a save or delete invalidates both the cached plan targets and the
  // per-date "next up" chips on the Log tab.
  const [recsEpoch, setRecsEpoch] = useState(0);
  const invalidateRecs = useCallback(() => {
    if (userId) clearCache(cacheKey(userId, CK_RECS));
    setRecsEpoch(v => v + 1);
  }, [userId]);

  // Next-weight targets for every exercise in the active plan. Held here rather
  // than in PlanTab so leaving the tab and coming back doesn't refetch. The
  // cache holds one plan at a time — { planId, list } — so a cached list can
  // never be served for a plan it wasn't computed for.
  const [planRecs, setPlanRecs] = useState([]);

  useEffect(() => {
    if (!userId || !activePlanId) return undefined;
    let cancelled = false;
    const key    = cacheKey(userId, CK_RECS);
    const entry  = readCache(key);
    const cached = entry?.value?.planId === activePlanId ? entry.value.list : null;

    queueMicrotask(() => {
      if (!cancelled && cached) setPlanRecs(cached);
    });

    if (!cached || !isFresh(entry)) {
      fetchRecommendations({ planId: activePlanId }).then(list => {
        if (cancelled) return;
        writeCache(key, { planId: activePlanId, list });
        setPlanRecs(list);
      });
    }
    return () => { cancelled = true; };
  }, [userId, activePlanId, fetchRecommendations, recsEpoch]);

  const fetchExerciseSettings = useCallback(async () => {
    try {
      return await apiFetch('/api/gym/exercise-settings');
    } catch {
      return [];
    }
  }, []);

  // Errors propagate here (unlike the read helpers above) because the caller
  // shows a toast — a silently swallowed failure would look like a save.
  const saveExerciseSetting = useCallback(async (exerciseName, values) => {
    const saved = await apiFetch(
      `/api/gym/exercise-settings/${encodeURIComponent(exerciseName.trim())}`,
      { method: 'PUT', body: JSON.stringify(values) },
    );
    invalidateRecs(); // step / rounding changes move every target for this lift
    return saved;
  }, [invalidateRecs]);

  const resetExerciseSetting = useCallback(async (exerciseName) => {
    const reset = await apiFetch(
      `/api/gym/exercise-settings/${encodeURIComponent(exerciseName.trim())}`,
      { method: 'DELETE' },
    );
    invalidateRecs();
    return reset;
  }, [invalidateRecs]);

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

  // The full, unfiltered catalogue — the Plan tab and the plan editor both want
  // it every time they mount, so it lives here behind the same cache. Callers
  // that need a single body part still go through fetchExerciseList.
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [libraryEpoch, setLibraryEpoch] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    const key    = cacheKey(userId, CK_LIBRARY);
    const cached = readCache(key);

    queueMicrotask(() => {
      if (!cancelled && cached?.value) setExerciseLibrary(cached.value);
    });

    if (!isFresh(cached)) {
      fetchExerciseList().then(list => {
        // fetchExerciseList swallows errors into [], which would otherwise
        // cache an empty catalogue over a good one.
        if (cancelled || !list.length) return;
        writeCache(key, list);
        setExerciseLibrary(list);
      });
    }
    return () => { cancelled = true; };
  }, [userId, fetchExerciseList, libraryEpoch]);

  const invalidateLibrary = useCallback(() => {
    if (userId) clearCache(cacheKey(userId, CK_LIBRARY));
    setLibraryEpoch(v => v + 1);
  }, [userId]);

  const fetchProgress = useCallback(async (weeks = 12) => {
    try {
      return await apiFetch(`/api/gym/progress?weeks=${weeks}`);
    } catch {
      return [];
    }
  }, []);

  const addExerciseTemplate = useCallback(async (name, bodyPart, videoUrl) => {
    const created = await apiFetch('/api/gym/exercises-list', {
      method: 'POST',
      body: JSON.stringify({ name, bodyPart, videoUrl: videoUrl || '' }),
    });
    invalidateLibrary();
    return created;
  }, [invalidateLibrary]);

  const updateExerciseTemplate = useCallback(async (id, body) => {
    // body may include any subset of { name, bodyPart, videoUrl }.
    const updated = await apiFetch(`/api/gym/exercises-list/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body || {}),
    });
    invalidateLibrary();
    return updated;
  }, [invalidateLibrary]);

  const deleteExerciseTemplate = useCallback(async (id) => {
    const res = await apiFetch(`/api/gym/exercises-list/${id}`, { method: 'DELETE' });
    invalidateLibrary();
    return res;
  }, [invalidateLibrary]);

  const addEntry = useCallback(async (data) => {
    const entry = await apiFetch('/api/gym/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setEntries(prev => [...prev, entry]);
    invalidateRecs();
    return entry;
  }, [invalidateRecs]);

  const updateEntry = useCallback(async (id, data) => {
    const entry = await apiFetch(`/api/gym/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setEntries(prev => prev.map(e => e._id === id ? entry : e));
    invalidateRecs();
    return entry;
  }, [invalidateRecs]);

  const deleteEntry = useCallback(async (id) => {
    await apiFetch(`/api/gym/entries/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e._id !== id));
    invalidateRecs();
  }, [invalidateRecs]);

  return {
    entries, weekData, loading, weekLoading,
    loadEntries, loadWeek,
    fetchExerciseHistory, fetchExerciseNames,
    // Progression
    fetchRecommendations, fetchExerciseSettings, planRecs, recsEpoch,
    saveExerciseSetting, resetExerciseSetting,
    fetchExerciseList, exerciseLibrary,
    addExerciseTemplate, updateExerciseTemplate, deleteExerciseTemplate,
    addEntry, updateEntry, deleteEntry,
    fetchProgress,
    // Plans
    plans, plansLoaded, activePlanId, activePlan,
    setActivePlanId, refetchPlans,
    createPlan: createNewPlan, updatePlan: updateExistingPlan,
    archivePlan: archiveExistingPlan, unarchivePlan: unarchiveExistingPlan,
  };
}
