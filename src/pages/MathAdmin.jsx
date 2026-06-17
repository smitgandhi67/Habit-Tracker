import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Minus, Plus, RotateCcw, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

// Parent-only console: pick a kid, see their points, adjust them, edit reward costs.
export default function MathAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [rewards, setRewards] = useState([]);
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

  useEffect(() => {
    if (!user?.isAdmin) return;
    apiFetch('/api/math/admin/users')
      .then(list => setUsers(list))
      .catch(() => toast.error('Failed to load users'));
    apiFetch('/api/math/admin/config')
      .then(d => setRewards(d.rewards || []))
      .catch(() => {});
  }, [user]);

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

  async function saveConfig() {
    setBusy(true);
    try {
      const clean = rewards.map(r => ({ ...r, costPoints: Number(r.costPoints) }));
      const d = await apiFetch('/api/math/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ rewards: clean }),
      });
      setRewards(d.rewards || []);
      await loadUsers();
      toast.success('Reward costs saved');
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

      {/* Reward config */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-700 mb-3">Reward costs (points)</h3>
        <div className="space-y-2 mb-3">
          {rewards.map((r, i) => (
            <div key={r.key} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-medium text-slate-600">
                {r.label} <span className="text-slate-400">({r.unit})</span>
              </span>
              <input
                type="number"
                value={r.costPoints}
                onChange={e => setRewards(rs => rs.map((x, j) => (j === i ? { ...x, costPoints: e.target.value } : x)))}
                className="w-28 rounded-xl border-2 border-slate-200 focus:border-violet-400 outline-none px-3 py-1.5 tabular-nums text-right"
              />
            </div>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={saveConfig}
          className="flex items-center justify-center gap-1 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl py-2.5 disabled:opacity-50"
        >
          <Save size={16} /> Save costs
        </button>
      </div>
    </div>
  );
}
