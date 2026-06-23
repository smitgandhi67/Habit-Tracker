import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import GapPairBars from '../components/GapPairBars';
import { PARENTING_DISCLAIMER } from '../lib/parenting/bands';

// Parent ↔ child gap report. The parent picks a linked child and sees how their
// self-report compares to the child's experience on the shared dimensions.
export default function ParentingGap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [links, setLinks] = useState(null);
  const [childId, setChildId] = useState('');
  const [gap, setGap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.isAdmin) return;
    apiFetch('/api/parenting/admin/links')
      .then(l => { setLinks(l); if (l.length) setChildId(String(l[0].childUserId)); })
      .catch(err => setError(err.message));
  }, [user]);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setLoading(true); setError(null); setGap(null);
    apiFetch(`/api/parenting/gap?childUserId=${childId}`)
      .then(g => { if (!cancelled) setGap(g); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [childId]);

  return (
    <div className="px-4 py-2 pb-10">
      <button onClick={() => navigate('/parenting')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft size={16} /> Parenting
      </button>
      <div className="flex items-center gap-2 mb-1">
        <Users className="text-violet-600" size={20} />
        <h1 className="text-xl font-bold text-slate-800">You & your child</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">How your self-report compares with how your child experiences your parenting.</p>

      {!user?.isAdmin && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-sm text-slate-600">
          The family parent sets up the child comparison in the parent console.
        </div>
      )}

      {user?.isAdmin && links && links.length === 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-sm text-slate-600">
          No children linked yet. Link a child in the <Link to="/parenting/admin" className="text-violet-600 font-medium">parent console</Link> first.
        </div>
      )}

      {user?.isAdmin && links && links.length > 0 && (
        <>
          {links.length > 1 && (
            <select value={childId} onChange={e => setChildId(e.target.value)} className="w-full mb-4 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm">
              {links.map(l => <option key={l._id} value={String(l.childUserId)}>{l.childName || l.label || 'Child'}</option>)}
            </select>
          )}

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4">{error}</div>}
          {loading && <div className="bg-white rounded-3xl h-40 animate-pulse border border-slate-100" />}

          {gap && !loading && (
            <>
              {!gap.parent.hasData && (
                <div className="bg-amber-50 text-amber-700 text-sm rounded-2xl p-4 mb-3">
                  Take a parent quiz first (e.g. <Link to="/parenting/quiz/style" className="font-medium underline">Parenting Style</Link>) to compare.
                </div>
              )}
              {!gap.child.hasData && (
                <div className="bg-amber-50 text-amber-700 text-sm rounded-2xl p-4 mb-3">
                  Your child hasn’t completed the “How I See My Parent” quiz yet.
                </div>
              )}
              {gap.gap.length > 0 && (
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                  <GapPairBars gap={gap.gap} />
                </div>
              )}
            </>
          )}
          <p className="text-[11px] text-slate-400 mt-5 leading-relaxed">{PARENTING_DISCLAIMER}</p>
        </>
      )}
    </div>
  );
}
