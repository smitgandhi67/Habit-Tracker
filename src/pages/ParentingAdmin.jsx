import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ShieldCheck, Trash2, Link2, BarChart3 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

function Card({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
        {Icon && <Icon size={16} className="text-violet-600" />}{title}
      </h2>
      {children}
    </div>
  );
}

// Parent console: manage parent↔child links and view instrument versions.
export default function ParentingAdmin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [links, setLinks] = useState([]);
  const [config, setConfig] = useState([]);
  const [pick, setPick] = useState('');
  const [error, setError] = useState(null);

  const loadLinks = useCallback(() => {
    apiFetch('/api/parenting/admin/links').then(setLinks).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) return;
    apiFetch('/api/parenting/admin/users').then(setUsers).catch(e => setError(e.message));
    apiFetch('/api/parenting/admin/config').then(setConfig).catch(() => {});
    loadLinks();
  }, [user, loadLinks]);

  if (!user?.isAdmin) {
    return <div className="px-4 py-6"><div className="bg-white rounded-3xl p-6 border border-slate-100 text-sm text-slate-600">Parent console is available to the family parent only.</div></div>;
  }

  const linkedIds = new Set(links.map(l => String(l.childUserId)));
  const candidates = users.filter(u => !u.isAdmin && !linkedIds.has(String(u._id)));

  async function addLink() {
    if (!pick) return;
    try {
      await apiFetch('/api/parenting/admin/links', { method: 'POST', body: JSON.stringify({ childUserId: pick }) });
      setPick('');
      loadLinks();
      toast.success('Child linked');
    } catch (e) { toast.error(e.message || 'Could not link'); }
  }

  async function removeLink(id) {
    try {
      await apiFetch(`/api/parenting/admin/links/${id}`, { method: 'DELETE' });
      loadLinks();
    } catch (e) { toast.error(e.message || 'Could not remove'); }
  }

  return (
    <div className="px-4 py-2 pb-10 space-y-4">
      <button onClick={() => navigate('/parenting')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={16} /> Parenting
      </button>
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-violet-600" size={20} />
        <h1 className="text-xl font-bold text-slate-800">Parent console</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div>}

      <Card title="Family links" icon={Link2}>
        {links.length === 0 && <p className="text-sm text-slate-400 mb-3">No children linked yet.</p>}
        <div className="space-y-2 mb-3">
          {links.map(l => (
            <div key={l._id} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2.5">
              <span className="text-sm text-slate-700">{l.childName || l.childEmail || 'Child'}</span>
              <button onClick={() => removeLink(l._id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        {candidates.length > 0 ? (
          <div className="flex gap-2">
            <select value={pick} onChange={e => setPick(e.target.value)} className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Choose a child…</option>
              {candidates.map(u => <option key={u._id} value={u._id}>{u.name || u.email}</option>)}
            </select>
            <button onClick={addLink} disabled={!pick} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${pick ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-500'}`}>Link</button>
          </div>
        ) : <p className="text-xs text-slate-400">All other users are already linked.</p>}
      </Card>

      <Card title="Compare with your child" icon={BarChart3}>
        <p className="text-sm text-slate-500 mb-3">See how your self-report compares with your child’s experience.</p>
        <Link to="/parenting/gap" className="inline-flex rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Open gap report</Link>
      </Card>

      <Card title="Instruments">
        <div className="space-y-2">
          {config.map(c => (
            <div key={c.instrumentKey} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{c.title}</span>
              <span className="text-slate-400">v{c.activeVersion}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
