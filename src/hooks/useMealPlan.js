import { useState, useEffect, useCallback, useRef } from 'react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { listMealPlans, getMealPlan } from '../lib/mealPlans';
import { batchMealLogs, setMealLog } from '../lib/mealLogs';

// Active meal plan + log state for the current user.
// One plan is "active": the first non-archived user-owned plan returned by the
// list endpoint (sorted by updatedAt desc). UI surfaces the library page for
// switching/cloning.
export function useMealPlan() {
  const [plans, setPlans]         = useState([]);     // all visible plans (master + own)
  const [activePlan, setActive]   = useState(null);   // resolved active plan doc (full days[])
  const [logs, setLogs]           = useState({});     // { 'YYYY-MM-DD': { slot: log } }
  const [loading, setLoading]     = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const saveTimers = useRef({});

  const refreshPlans = useCallback(async () => {
    const all = await listMealPlans();
    setPlans(all);
    const ownActive = all.find(p => !p.isMaster && !p.archivedAt);
    if (ownActive) {
      // Re-fetch the full plan doc — list endpoint returns it but include lean()
      // already. Use what we have unless it's missing nested days.
      if (ownActive.days?.length) setActive(ownActive);
      else setActive(await getMealPlan(ownActive._id));
    } else {
      setActive(null);
    }
    return all;
  }, []);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshPlans();
      } catch {
        if (!cancelled) toast.error('Failed to load meal plans');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshPlans]);

  // Once a plan is active, prefetch ±cycleLength days of logs so navigation is instant.
  useEffect(() => {
    if (!activePlan?._id) {
      // Defer the clear to a microtask to avoid a same-frame setState during effect body.
      Promise.resolve().then(() => setLogs({}));
      return;
    }
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setLogsLoading(true); });
    const today = new Date();
    const span  = Math.max(14, activePlan.cycleLength || 14);
    const dates = [];
    for (let i = -span; i <= span; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(format(d, 'yyyy-MM-dd'));
    }
    batchMealLogs({ planId: activePlan._id, dates })
      .then(entries => {
        if (cancelled) return;
        const map = {};
        for (const e of entries) {
          if (!map[e.date]) map[e.date] = {};
          map[e.date][e.slot] = { status: e.status, swapNote: e.swapNote || '' };
        }
        setLogs(map);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load meal history');
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => { cancelled = true; };
  }, [activePlan?._id, activePlan?.cycleLength]);

  // Resolve a calendar date to its position in the plan cycle.
  // Returns { dayIndex (1..cycleLength), day, dayCount } or null if no plan.
  const dayForDate = useCallback((date) => {
    if (!activePlan) return null;
    const cycle = activePlan.cycleLength || activePlan.days?.length || 14;
    const anchor = activePlan.startDate
      ? parseISO(activePlan.startDate)
      : new Date(activePlan.createdAt || Date.now());
    const offset = differenceInCalendarDays(date, anchor);
    // JS % keeps sign of dividend — normalise for dates before the anchor.
    const dayIndex = ((offset % cycle) + cycle) % cycle + 1;
    const day = activePlan.days?.find(d => d.dayIndex === dayIndex) || null;
    return { dayIndex, day, dayCount: cycle };
  }, [activePlan]);

  const logsFor = useCallback((date) => {
    const key = format(date, 'yyyy-MM-dd');
    return logs[key] || {};
  }, [logs]);

  // Optimistic + 600ms debounce on status/swapNote writes.
  const setStatus = useCallback((date, slot, fields) => {
    if (!activePlan) return;
    const key   = format(date, 'yyyy-MM-dd');
    const prior = logs[key]?.[slot] || { status: 'not_started', swapNote: '' };
    const next  = { ...prior, ...fields };

    setLogs(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [slot]: next },
    }));

    const tk = `${key}:${slot}`;
    clearTimeout(saveTimers.current[tk]);
    saveTimers.current[tk] = setTimeout(async () => {
      try {
        await setMealLog({
          planId:   activePlan._id,
          date:     key,
          slot,
          status:   next.status,
          swapNote: next.swapNote,
        });
      } catch {
        setLogs(prev => ({
          ...prev,
          [key]: { ...(prev[key] || {}), [slot]: prior },
        }));
        toast.error('Failed to save — check connection');
      }
    }, 600);
  }, [activePlan, logs]);

  const switchActive = useCallback(async (planId) => {
    const plan = await getMealPlan(planId);
    setActive(plan);
  }, []);

  return {
    plans, activePlan, loading, logsLoading,
    refreshPlans, switchActive,
    dayForDate, logsFor, setStatus,
  };
}
