import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Check, X, Link2Off, Users, Clock } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

// apiFetch throws Error(responseText); the body is our JSON { error }. Pull the message.
function errMsg(err, fallback) {
  try { return JSON.parse(err.message).error || fallback; } catch { return fallback; }
}

const STATUS_CHIP = {
  pending:  { label: 'waiting for approval', cls: 'text-amber-600 bg-amber-50' },
  approved: { label: 'linked', cls: 'text-green-600 bg-green-50' },
  rejected: { label: 'declined', cls: 'text-slate-400 bg-slate-100' },
};

function Avatar({ account }) {
  return account?.photo ? (
    <img src={account.photo} alt={account.name} className="w-9 h-9 rounded-full shrink-0" referrerPolicy="no-referrer" />
  ) : (
    <div className="w-9 h-9 rounded-full bg-violet-200 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
      {account?.name?.[0] ?? '?'}
    </div>
  );
}

export default function Family() {
  const { refreshUser } = useAuth();
  const [outgoing, setOutgoing] = useState([]); // links where I'm the parent (my children)
  const [incoming, setIncoming] = useState([]); // links where I'm the child (requests + my parents)
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [out, inc] = await Promise.all([
        apiFetch('/api/links?direction=outgoing'),
        apiFetch('/api/links?direction=incoming'),
      ]);
      setOutgoing(out);
      setIncoming(inc);
    } catch {
      toast.error('Failed to load family links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addChild(e) {
    e.preventDefault();
    const childEmail = email.trim();
    if (!childEmail) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/links', { method: 'POST', body: JSON.stringify({ childEmail }) });
      setEmail('');
      toast.success(res.already === 'approved' ? 'Already linked' : res.already === 'pending' ? 'Request already sent' : 'Request sent — waiting for approval');
      await load();
      await refreshUser();
    } catch (err) {
      toast.error(errMsg(err, 'Could not send request'));
    } finally { setBusy(false); }
  }

  async function act(path, okMsg) {
    setBusy(true);
    try {
      await apiFetch(path, { method: path.endsWith('approve') || path.endsWith('reject') ? 'POST' : 'DELETE' });
      toast.success(okMsg);
      await load();
      await refreshUser();
    } catch (err) {
      toast.error(errMsg(err, 'Action failed'));
    } finally { setBusy(false); }
  }

  // Split the two directions into the three sections we render.
  const children = outgoing.filter(l => l.status === 'pending' || l.status === 'approved');
  const requests = incoming.filter(l => l.status === 'pending'); // people asking to parent me
  const parents  = incoming.filter(l => l.status === 'approved'); // my approved parents

  if (loading) return <div className="p-4 pt-10 text-center text-slate-400">Loading…</div>;

  return (
    <div className="p-4 pb-28">
      <header className="pt-4 mb-5">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="text-violet-500" size={24} /> Family
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Link a parent and child account. The parent sends a request; the child approves it.
        </p>
      </header>

      {/* Incoming requests to approve */}
      {requests.length > 0 && (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-4">
          <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            Requests for you
            <span className="text-xs bg-rose-100 text-rose-600 rounded-full px-2 py-0.5">{requests.length}</span>
          </h2>
          <div className="space-y-2">
            {requests.map(l => (
              <div key={l._id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2">
                <Avatar account={l.account} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{l.account?.name || '—'}</p>
                  <p className="text-xs text-slate-400 truncate">wants to link as your parent</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => act(`/api/links/${l._id}/approve`, 'Approved')}
                  className="flex items-center gap-1 bg-green-500 text-white text-sm font-bold rounded-xl px-3 py-1.5 hover:bg-green-600 disabled:opacity-50"
                >
                  <Check size={15} /> Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => act(`/api/links/${l._id}/reject`, 'Declined')}
                  className="flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl px-2.5 py-1.5 hover:bg-slate-200 disabled:opacity-50"
                  aria-label="Decline"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My children (I'm the parent) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-4">
        <h2 className="font-bold text-slate-700 mb-1">Your children</h2>
        <p className="text-xs text-slate-400 mb-3">Enter your child's account email. They'll get a request to approve.</p>
        <form onSubmit={addChild} className="flex gap-2 mb-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="child@email.com"
            className="flex-1 min-w-0 rounded-xl border-2 border-slate-200 focus:border-violet-400 outline-none px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="flex items-center gap-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl px-3 py-2 disabled:opacity-40 shrink-0"
          >
            <UserPlus size={16} /> Add
          </button>
        </form>
        {children.length === 0 ? (
          <p className="text-sm text-slate-400">No children linked yet.</p>
        ) : (
          <div className="space-y-2">
            {children.map(l => {
              const chip = STATUS_CHIP[l.status] || STATUS_CHIP.pending;
              return (
                <div key={l._id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2">
                  <Avatar account={l.account} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{l.account?.name || '—'}</p>
                    <p className="text-xs text-slate-400 truncate">{l.account?.email}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${chip.cls}`}>
                    {l.status === 'pending' && <Clock size={11} />}{chip.label}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => act(`/api/links/${l._id}`, 'Unlinked')}
                    className="flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 disabled:opacity-50 shrink-0"
                    aria-label="Unlink"
                  >
                    <Link2Off size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My parents (I'm the child) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
        <h2 className="font-bold text-slate-700 mb-3">Your parents</h2>
        {parents.length === 0 ? (
          <p className="text-sm text-slate-400">No parents linked to your account.</p>
        ) : (
          <div className="space-y-2">
            {parents.map(l => (
              <div key={l._id} className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-2">
                <Avatar account={l.account} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{l.account?.name || '—'}</p>
                  <p className="text-xs text-slate-400 truncate">{l.account?.email}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => act(`/api/links/${l._id}`, 'Unlinked')}
                  className="flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 disabled:opacity-50 shrink-0"
                  aria-label="Unlink"
                >
                  <Link2Off size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
