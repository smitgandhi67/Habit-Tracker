import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { listPacks, listPrograms, enrollProgram } from '../lib/capabilities/programs';

// Depth Pack programs for one kid: active list + (admin) enrollment buttons.
// childId '' = the signed-in user's own programs (kid view).
export default function ProgramsCard({ childId, isAdmin }) {
  const [packs, setPacks] = useState([]);
  const [programs, setPrograms] = useState(null);
  const [points, setPoints] = useState(100);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    listPrograms({ childId: childId || undefined })
      .then(({ programs: p }) => setPrograms(p))
      .catch(() => setPrograms([]));
  }, [childId]);

  useEffect(() => { listPacks().then(({ packs: p }) => setPacks(p)).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [reload]);

  if (programs === null) return null;
  const liveByPack = new Map(programs.filter(p => p.status !== 'done').map(p => [p.packKey, p]));

  const enroll = async (packKey) => {
    setBusy(true);
    try {
      await enrollProgram({ childId, packKey, points: Number(points) || 0 });
      toast.success('Pack started — habit added to their Today page');
      reload();
    } catch (err) { toast.error(err.message || 'Failed to start pack'); }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-slate-500">
          <GraduationCap size={14} /> <span className="text-[11px] font-bold uppercase tracking-wider">Training programs</span>
        </div>
        {isAdmin && programs.some(p => p.status === 'active') && (
          <Link to="/skills/sunday" className="text-[11px] font-bold text-violet-600 hover:underline">Sunday review →</Link>
        )}
      </div>

      {programs.length === 0 && <p className="text-xs text-slate-400 mb-2">No programs yet.</p>}
      <div className="space-y-2">
        {programs.map(p => (
          <div key={p._id} className="flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-slate-700">{p.pack.title}</p>
              <p className="text-xs text-slate-400">
                Week {p.currentWeek}/{p.totalWeeks}{p.habit ? ` · ⭐ ${p.habit.points}/day` : ''}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {p.status}
            </span>
          </div>
        ))}
      </div>

      {isAdmin && childId && packs.some(pk => !liveByPack.has(pk.key)) && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-slate-400">Points/day</label>
            <input type="number" min="0" value={points} onChange={e => setPoints(e.target.value)}
              className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            {packs.filter(pk => !liveByPack.has(pk.key)).map(pk => (
              <button key={pk.key} disabled={busy} onClick={() => enroll(pk.key)}
                className="text-xs font-semibold bg-violet-600 text-white rounded-lg px-3 py-1.5 hover:bg-violet-700 disabled:opacity-40">
                Start: {pk.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
