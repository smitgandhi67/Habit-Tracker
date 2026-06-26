import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

async function parseErr(err) {
  try { const p = JSON.parse(err?.message || ''); if (p?.error) return p.error; } catch { /* not JSON */ }
  return err?.message || 'Something went wrong';
}

const EMPTY_FLUENCY = { level: 0, label: 'helper', shipped: 0 };

// Drives the Builder / Problem-Solver page: a Problem Journal (the problem-finding
// habit) + "things I made" projects gated by the explain-every-line ship check.
// Points credit the shared math wallet, so the header balance reflects them too.
export function useBuild() {
  const { user } = useAuth() || {};
  const userId = user?._id;

  const [problems, setProblems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [fluency, setFluency] = useState(EMPTY_FLUENCY);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const d = await apiFetch('/api/build');
      setProblems(d.problems || []);
      setProjects(d.projects || []);
      setFluency(d.fluency || EMPTY_FLUENCY);
      setBalance(d.balance ?? null);
    } catch { toast.error('Failed to load Build'); }
    finally { setLoading(false); }
  }, [userId]);

  // Defer to a microtask so the synchronous setState inside load() doesn't run as
  // part of the effect body (matches the pattern in useSleep).
  useEffect(() => { queueMicrotask(() => { load(); }); }, [load]);

  const addProblem = useCallback(async (text, kind = 'idea') => {
    const date = format(new Date(), 'yyyy-MM-dd');
    try {
      const res = await apiFetch('/api/build/problems', {
        method: 'POST', body: JSON.stringify({ text, kind, date }),
      });
      setProblems(p => [res.problem, ...p]);
      if (res.balance != null) setBalance(res.balance);
      toast.success(res.awarded > 0 ? `+${res.awarded} for spotting a problem!` : 'Logged! (daily bonus maxed)');
      return res.problem;
    } catch (e) { toast.error(await parseErr(e)); throw e; }
  }, []);

  const setStatus = useCallback(async (id, status) => {
    try {
      const res = await apiFetch(`/api/build/problems/${id}`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      setProblems(p => p.map(x => (x._id === id ? res.problem : x)));
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  const removeProblem = useCallback(async (id) => {
    try {
      await apiFetch(`/api/build/problems/${id}`, { method: 'DELETE' });
      setProblems(p => p.filter(x => x._id !== id));
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  const addProject = useCallback(async (fields) => {
    try {
      const res = await apiFetch('/api/build/projects', {
        method: 'POST', body: JSON.stringify(fields),
      });
      setProjects(p => [res.project, ...p]);
      return res.project;
    } catch (e) { toast.error(await parseErr(e)); throw e; }
  }, []);

  const updateProject = useCallback(async (id, patch) => {
    try {
      const res = await apiFetch(`/api/build/projects/${id}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      });
      setProjects(p => p.map(x => (x._id === id ? res.project : x)));
      return res.project;
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  const shipProject = useCallback(async (id, explainedIt) => {
    try {
      const res = await apiFetch(`/api/build/projects/${id}/ship`, {
        method: 'POST', body: JSON.stringify({ explainedIt }),
      });
      setProjects(p => p.map(x => (x._id === id ? res.project : x)));
      if (res.fluency) setFluency(res.fluency);
      if (res.balance != null) setBalance(res.balance);
      toast.success(`Shipped! +${res.awarded} points 🚀`);
      return res.project;
    } catch (e) { toast.error(await parseErr(e)); throw e; }
  }, []);

  const removeProject = useCallback(async (id) => {
    try {
      await apiFetch(`/api/build/projects/${id}`, { method: 'DELETE' });
      setProjects(p => p.filter(x => x._id !== id));
    } catch (e) { toast.error(await parseErr(e)); }
  }, []);

  return {
    loading, problems, projects, fluency, balance,
    addProblem, setStatus, removeProblem,
    addProject, updateProject, shipProject, removeProject,
    reload: load,
  };
}
