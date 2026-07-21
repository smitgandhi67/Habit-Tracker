import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import PointsLedger from '../components/PointsLedger';
import { useAuth } from '../context/AuthContext';
import { flushPending } from '../lib/mathSync';

// Kid-facing read-only view of their own points history. The Sync button pushes any answers
// still buffered in THIS browser (earned but not yet posted) to the server, then refetches
// the ledger — a manual safety net so points can never look "missing" after a big session.
export default function PointsHistory() {
  const { user } = useAuth();
  const uid = user?._id ? String(user._id) : 'anon';
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    try {
      const { synced } = await flushPending(uid);
      toast.success(synced > 0 ? `Synced ${synced} answer${synced === 1 ? '' : 's'} 🎉` : 'Already up to date');
      setRefreshKey(k => k + 1); // remount the ledger so it refetches with the new points
    } catch {
      toast.error('Sync failed — check your connection and try again');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-4 pb-28">
      <header className="pt-4 mb-4 flex items-center gap-2">
        <Link to="/math" className="text-slate-400 hover:text-slate-600" aria-label="Back to Math">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-slate-800">Points history</h1>
          <p className="text-slate-400 text-sm">Where your points came from</p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-1 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-700 text-sm font-semibold px-3 py-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </header>
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
        <PointsLedger key={refreshKey} endpoint="/api/math/ledger" />
      </div>
    </div>
  );
}
