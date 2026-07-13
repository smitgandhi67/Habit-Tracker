import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';

async function parseErr(err) {
  try { const p = JSON.parse(err?.message || ''); if (p?.error) return p.error; } catch { /* not JSON */ }
  return err?.message || 'Something went wrong';
}

// Parent (admin) hook for the roadmap + brag-sheet: pick a kid, then CRUD their
// milestones (forward targets) and achievements (real-time brag-log).
export function useJourney(isAdmin) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch('/api/math/parent/children')
      .then(list => setUsers(list))
      .catch(() => toast.error('Failed to load children'));
  }, [isAdmin]);

  const load = useCallback(async (userId) => {
    if (!userId) { setMilestones([]); setAchievements([]); return; }
    setLoading(true);
    try {
      const d = await apiFetch(`/api/journey/admin?userId=${userId}`);
      setMilestones(d.milestones || []);
      setAchievements(d.achievements || []);
    } catch { toast.error('Failed to load roadmap'); }
    finally { setLoading(false); }
  }, []);

  // Defer so the synchronous setState inside load() doesn't run in the effect body
  // (matches useSleep/useBuild — avoids the cascading-render lint).
  useEffect(() => { queueMicrotask(() => { load(selected?._id); }); }, [selected, load]);

  // ---- milestones ----
  const addMilestone = useCallback(async (fields) => {
    try {
      const res = await apiFetch('/api/journey/admin/milestones', {
        method: 'POST', body: JSON.stringify({ ...fields, userId: selected._id }),
      });
      setMilestones(m => [...m, res.milestone]);
      return res.milestone;
    } catch (e) { toast.error(await parseErr(e)); throw e; }
  }, [selected]);

  const updateMilestone = useCallback(async (id, patch) => {
    try {
      const res = await apiFetch(`/api/journey/admin/milestones/${id}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      });
      setMilestones(m => m.map(x => (x._id === id ? res.milestone : x)));
      return res.milestone;
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  const deleteMilestone = useCallback(async (id) => {
    try {
      await apiFetch(`/api/journey/admin/milestones/${id}`, { method: 'DELETE' });
      setMilestones(m => m.filter(x => x._id !== id));
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  // ---- achievements ----
  const addAchievement = useCallback(async (fields) => {
    try {
      const res = await apiFetch('/api/journey/admin/achievements', {
        method: 'POST', body: JSON.stringify({ ...fields, userId: selected._id }),
      });
      setAchievements(a => [res.achievement, ...a]);
      return res.achievement;
    } catch (e) { toast.error(await parseErr(e)); throw e; }
  }, [selected]);

  const updateAchievement = useCallback(async (id, patch) => {
    try {
      const res = await apiFetch(`/api/journey/admin/achievements/${id}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      });
      setAchievements(a => a.map(x => (x._id === id ? res.achievement : x)));
      return res.achievement;
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  const deleteAchievement = useCallback(async (id) => {
    try {
      await apiFetch(`/api/journey/admin/achievements/${id}`, { method: 'DELETE' });
      setAchievements(a => a.filter(x => x._id !== id));
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  return {
    users, selected, setSelected, milestones, achievements, loading,
    addMilestone, updateMilestone, deleteMilestone,
    addAchievement, updateAchievement, deleteAchievement,
  };
}
