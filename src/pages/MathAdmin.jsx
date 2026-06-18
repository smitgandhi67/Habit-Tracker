import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Minus, Plus, RotateCcw, Save, Check, X, Star, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { GRADES } from '../lib/mathGrades';

// Parent-only console: pick a kid, see their points, adjust them, assign habit
// points, approve habit awards, and edit reward costs.
export default function MathAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [rewards, setRewards] = useState([]);
  const [habits, setHabits] = useState([]);   // selected kid's habits (with editable points)
  const [awards, setAwards] = useState([]);    // pending habit-point awards across kids
  const [picked, setPicked] = useState(() => new Set()); // award ids checked for batch approve
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const list = await apiFetch('/api/math/admin/users');
      setUsers(list);
      setSelected(prev => (prev ? list.find(u => u._id === prev._id) || null : null));
    } catch {
      toast.error('Failed to load users');
    }
  }, []);

  const loadAwards = useCallback(async () => {
    try {
      const list = await apiFetch('/api/math/admin/habit-awards?status=pending');
      setAwards(list);
      // Drop any checked ids that no longer exist (approved/rejected elsewhere).
      const live = new Set(list.map(a => a._id));
      setPicked(prev => new Set([...prev].filter(id => live.has(id))));
    } catch {
      toast.error('Failed to load approvals');
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) return;
    apiFetch('/api/math/admin/users')
      .then(list => setUsers(list))
      .catch(() => toast.error('Failed to load users'));
    apiFetch('/api/math/admin/config')
      .then(d => setRewards(d.rewards || []))
      .catch(() => {});
    apiFetch('/api/math/admin/habit-awards?status=pending')
      .then(list => setAwards(list))
      .catch(() => {});
  }, [user]);

  // Load the selected kid's habits (with point values) for the assignment UI.
  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      Promise.resolve().then(() => { if (!cancelled) setHabits([]); });
      return () => { cancelled = true; };
    }
    apiFetch(`/api/math/admin/habits?userId=${selected._id}`)
      .then(list => { if (!cancelled) setHabits(list.map(h => ({ ...h, draft: String(h.points || 0) }))); })
      .catch(() => { if (!cancelled) setHabits([]); });
    return () => { cancelled = true; };
  }, [selected]);

  async function saveHabitPoints(habitId, draft) {
    const points = Number(draft);
    if (!Number.isInteger(points) || points < 0) { toast.error('Points must be a whole number ≥ 0'); return; }
    setBusy(true);
    try {
      await apiFetch(`/api/math/admin/habits/${habitId}/points`, {
        method: 'PUT', body: JSON.stringify({ points }),
      });
      setHabits(hs => hs.map(h => (h._id === habitId ? { ...h, points, draft: String(points) } : h)));
      toast.success('Saved');
    } catch (err) {
      toast.error(String(err.message || 'Failed').slice(0, 120));
    } finally { setBusy(false); }
  }

  async function setGrade(grade) {
    if (!selected) return;
    setBusy(true);
    try {
      const { grade: saved } = await apiFetch('/api/math/admin/grade', {
        method: 'PUT',
        body: JSON.stringify({ userId: selected._id, grade }),
      });
      setSelected(prev => (prev ? { ...prev, grade: saved } : prev));
      setUsers(us => us.map(u => (u._id === selected._id ? { ...u, grade: saved } : u)));
      toast.success(saved ? `Grade ${saved}` : 'Grade cleared');
    } catch (err) {
      toast.error(String(err.message || 'Failed').slice(0, 120));
    } finally { setBusy(false); }
  }

  function togglePick(id) {
    setPicked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setPicked(prev => (prev.size === awards.length ? new Set() : new Set(awards.map(a => a._id))));
  }

  async function approveSelected() {
    const ids = [...picked];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      // Send in chunks of 200 to stay within the server's per-request cap.
      let approved = 0, skipped = 0;
      for (let i = 0; i < ids.length; i += 200) {
        const res = await apiFetch('/api/math/admin/habit-awards/approve-batch', {
          method: 'POST', body: JSON.stringify({ ids: ids.slice(i, i + 200) }),
        });
        approved += res.approved || 0;
        skipped += res.skipped || 0;
      }
      await loadAwards();   // single refresh for the whole batch
      await loadUsers();    // balances changed
      setPicked(new Set());
      toast.success(`Approved ${approved} ⭐${skipped ? ` (${skipped} skipped)` : ''}`);
    } catch (err) {
      toast.error(String(err.message || 'Failed').slice(0, 120));
    } finally { setBusy(false); }
  }

  async function reviewAward(id, action) {
    setBusy(true);
    try {
      await apiFetch(`/api/math/admin/habit-awards/${id}/${action}`, { method: 'POST' });
      await loadAwards();             // refresh queue from the server
      await loadUsers();              // balances change on approve
      toast.success(action === 'approve' ? 'Approved ⭐' : 'Rejected');
    } catch (err) {
      toast.error(String(err.message || 'Failed').slice(0, 120));
    } finally { setBusy(false); }
  }

  if (authLoading) return <div className="p-4 pt-10 text-center text-slate-400">Loading…</div>;
  if (!user?.isAdmin) return <Navigate to="/math" replace />;

  async function adjust(type) {
    if (!selected) return;
    const amt = Number(amount);
    if (type !== 'reset' && (!Number.isInteger(amt) || amt < 1)) {
      toast.error('Enter a whole number');
      return;
    }
    if (type === 'reset' && !window.confirm(`Reset all points for ${selected.name}?`)) return;
    setBusy(true);
    try {
      await apiFetch('/api/math/admin/adjust', {
        method: 'POST',
        body: JSON.stringify({ userId: selected._id, type, amount: amt, reason }),
      });
      setAmount(''); setReason('');
      await loadUsers();
      toast.success(type === 'reset' ? 'Reset done' : `${type === 'add' ? 'Added' : 'Deducted'} ${amt}`);
    } catch (err) {
      toast.error(String(err.message || 'Failed').slice(0, 120));
    } finally {
      setBusy(false);
    }
  }

  function addReward() {
    setRewards(rs => [...rs, { key: '', label: '', costPoints: '', unit: 'event' }]);
  }

  function removeReward(idx) {
    setRewards(rs => rs.filter((_, j) => j !== idx));
  }

  async function saveConfig() {
    // Validate client-side so the parent gets an inline message instead of a 400.
    const clean = [];
    for (const r of rewards) {
      const label = (r.label || '').trim();
      const costPoints = Number(r.costPoints);
      if (!label) { toast.error('Each reward needs a label'); return; }
      if (!Number.isInteger(costPoints) || costPoints < 1) {
        toast.error(`Cost for "${label}" must be a whole number ≥ 1`); return;
      }
      // New rows send no key; the server generates a unique slug from the label.
      clean.push({ ...(r.key ? { key: r.key } : {}), label, costPoints, unit: r.unit === 'minute' ? 'minute' : 'event' });
    }
    if (clean.length === 0) { toast.error('Add at least one reward'); return; }
    setBusy(true);
    try {
      const d = await apiFetch('/api/math/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ rewards: clean }),
      });
      setRewards(d.rewards || []);
      await loadUsers();
      toast.success('Rewards saved');
    } catch (err) {
      toast.error(String(err.message || 'Failed').slice(0, 120));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 pb-28">
      <header className="pt-4 mb-4">
        <h1 className="text-2xl font-extrabold text-slate-800">Math — Parent Console</h1>
        <p className="text-slate-400 text-sm">Manage kids' points and rewards</p>
      </header>

      {/* Pending habit-point approvals */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            Approvals
            {awards.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{awards.length}</span>
            )}
          </h3>
          {awards.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              {picked.size === awards.length ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>
        {awards.length === 0 ? (
          <p className="text-sm text-slate-400">No habit points waiting for approval.</p>
        ) : (
          <>
            {picked.size > 0 && (
              <button
                disabled={busy}
                onClick={approveSelected}
                className="flex items-center justify-center gap-1 w-full bg-green-500 text-white text-sm font-bold rounded-xl py-2.5 mb-3 hover:bg-green-600 disabled:opacity-50"
              >
                <Check size={15} /> Approve {picked.size} selected
              </button>
            )}
            <div className="space-y-2">
              {awards.map(a => (
                <div
                  key={a._id}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition-colors ${
                    picked.has(a._id) ? 'border-violet-300 bg-violet-50' : 'border-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(a._id)}
                    onChange={() => togglePick(a._id)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer"
                    aria-label={`Select ${a.userName} ${a.habitName}`}
                  />
                  <span className="text-lg select-none">{a.habitEmoji || '⭐'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{a.userName} · {a.habitName}</p>
                    <p className="text-xs text-slate-400">{a.date} · ⭐ {a.points}</p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => reviewAward(a._id, 'approve')}
                    className="flex items-center gap-1 bg-green-500 text-white text-sm font-bold rounded-xl px-3 py-1.5 hover:bg-green-600 disabled:opacity-50"
                  >
                    <Check size={15} /> Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => reviewAward(a._id, 'reject')}
                    className="flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl px-2.5 py-1.5 hover:bg-slate-200 disabled:opacity-50"
                    aria-label="Reject"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User list */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-4">
        <h3 className="font-bold text-slate-700 mb-3">Kids</h3>
        <div className="space-y-2">
          {users.map(u => (
            <button
              key={u._id}
              onClick={() => setSelected(u)}
              className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 border-2 transition-colors ${
                selected?._id === u._id ? 'border-violet-400 bg-violet-50' : 'border-slate-100 hover:bg-slate-50'
              }`}
            >
              <div className="text-left">
                <p className="font-semibold text-slate-700 text-sm">{u.name}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-violet-600 tabular-nums">{u.balance}</p>
                <p className="text-[10px] text-slate-400">sleepover {Math.round(u.sleepoverPct * 100)}%</p>
              </div>
            </button>
          ))}
          {users.length === 0 && <p className="text-sm text-slate-400">No users yet.</p>}
        </div>
      </div>

      {/* Adjust selected */}
      {selected && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
          <h3 className="font-bold text-slate-700 mb-1">{selected.name}</h3>
          <p className="text-sm text-slate-500 mb-4">
            Earned <b>{selected.pointsEarned}</b> · Spent <b>{selected.pointsSpent}</b> · Balance{' '}
            <b className="text-violet-600">{selected.balance}</b>
          </p>

          {/* School grade — drives the math difficulty cap */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-slate-400">Grade</span>
            {GRADES.map(g => (
              <button
                key={g}
                disabled={busy}
                onClick={() => setGrade(selected.grade === g ? null : g)}
                className={`w-9 h-9 rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${
                  selected.grade === g
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
            {!selected.grade && <span className="text-xs text-amber-600 font-medium">no cap (full range)</span>}
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Points"
              className="flex-1 rounded-xl border-2 border-slate-200 focus:border-violet-400 outline-none px-4 py-2 tabular-nums"
            />
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1 rounded-xl border-2 border-slate-200 focus:border-violet-400 outline-none px-4 py-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              disabled={busy}
              onClick={() => adjust('deduct')}
              className="flex items-center justify-center gap-1 bg-red-50 text-red-600 font-bold rounded-xl py-2.5 hover:bg-red-100 disabled:opacity-50"
            >
              <Minus size={16} /> Deduct
            </button>
            <button
              disabled={busy}
              onClick={() => adjust('add')}
              className="flex items-center justify-center gap-1 bg-green-50 text-green-600 font-bold rounded-xl py-2.5 hover:bg-green-100 disabled:opacity-50"
            >
              <Plus size={16} /> Add
            </button>
            <button
              disabled={busy}
              onClick={() => adjust('reset')}
              className="flex items-center justify-center gap-1 bg-slate-100 text-slate-600 font-bold rounded-xl py-2.5 hover:bg-slate-200 disabled:opacity-50"
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        </div>
      )}

      {/* Habit points for the selected kid */}
      {selected && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
          <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
            <Star size={16} className="text-violet-500" /> Habit points — {selected.name}
          </h3>
          <p className="text-xs text-slate-400 mb-3">Points earned each day the habit is fully completed (you approve them).</p>
          {habits.length === 0 ? (
            <p className="text-sm text-slate-400">No active habits for this kid.</p>
          ) : (
            <div className="space-y-2">
              {habits.map(h => (
                <div key={h._id} className="flex items-center gap-2">
                  <span className="text-lg select-none">{h.emoji}</span>
                  <span className="flex-1 text-sm font-medium text-slate-600 truncate">{h.name}</span>
                  <input
                    type="number"
                    min="0"
                    value={h.draft}
                    onChange={e => setHabits(hs => hs.map(x => (x._id === h._id ? { ...x, draft: e.target.value } : x)))}
                    className="w-20 rounded-xl border-2 border-slate-200 focus:border-violet-400 outline-none px-3 py-1.5 tabular-nums text-right"
                  />
                  <button
                    disabled={busy || h.draft === String(h.points || 0)}
                    onClick={() => saveHabitPoints(h._id, h.draft)}
                    className="flex items-center gap-1 bg-violet-600 text-white text-sm font-bold rounded-xl px-3 py-1.5 hover:bg-violet-700 disabled:opacity-40"
                  >
                    <Save size={14} /> Save
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reward config — add/edit/remove rewards and their point cost */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-1">Rewards</h3>
        <p className="text-xs text-slate-400 mb-3">
          Points a kid spends to redeem. “minute” rewards can be redeemed in quantities; “event” is one-shot.
        </p>
        <div className="space-y-2 mb-3">
          {rewards.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={r.label}
                placeholder="Reward name"
                onChange={e => setRewards(rs => rs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                className="flex-1 min-w-0 rounded-xl border-2 border-slate-200 focus:border-violet-400 outline-none px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setRewards(rs => rs.map((x, j) => (j === i ? { ...x, unit: x.unit === 'minute' ? 'event' : 'minute' } : x)))}
                className="text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1.5 w-16 shrink-0"
              >
                {r.unit === 'minute' ? 'minute' : 'event'}
              </button>
              <input
                type="number"
                min="1"
                value={r.costPoints}
                placeholder="pts"
                onChange={e => setRewards(rs => rs.map((x, j) => (j === i ? { ...x, costPoints: e.target.value } : x)))}
                className="w-20 shrink-0 rounded-xl border-2 border-slate-200 focus:border-violet-400 outline-none px-2 py-1.5 tabular-nums text-right text-sm"
              />
              <button
                type="button"
                onClick={() => removeReward(i)}
                className="flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 shrink-0"
                aria-label={`Remove ${r.label || 'reward'}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {rewards.length === 0 && <p className="text-sm text-slate-400">No rewards yet — add one below.</p>}
        </div>
        <button
          type="button"
          onClick={addReward}
          className="flex items-center justify-center gap-1 w-full border-2 border-dashed border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600 font-semibold rounded-xl py-2 mb-3 transition-colors"
        >
          <Plus size={16} /> Add reward
        </button>
        <button
          disabled={busy}
          onClick={saveConfig}
          className="flex items-center justify-center gap-1 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl py-2.5 disabled:opacity-50"
        >
          <Save size={16} /> Save rewards
        </button>
      </div>
    </div>
  );
}
