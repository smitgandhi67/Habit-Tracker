import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft, Trophy, ArrowRight, Pause, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { listPrograms, patchProgram, putMeasure, getMeasures } from '../lib/capabilities/programs';

// Dependency-free sparkline (same philosophy as CapabilityRadar: inline SVG only).
function Sparkline({ points, max }) {
  if (!points.length) return null;
  const w = 120, h = 28, pad = 2;
  const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / Math.max(points.length - 1, 1));
  const ys = points.map(p => h - pad - ((p / (max || 1)) * (h - 2 * pad)));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <path d={d} fill="none" stroke="#7c3aed" strokeWidth="1.5" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill="#7c3aed" />
    </svg>
  );
}

// The guided ritual for one program: numbers → celebrate → brag → bump.
function ProgramReview({ program, childId, onChanged }) {
  const [measures, setMeasures] = useState([]);
  const [form, setForm] = useState({});
  const [note, setNote] = useState('');
  const [brag, setBrag] = useState('');
  const [busy, setBusy] = useState(false);
  const week = program.currentWeek;

  const load = useCallback(() => {
    getMeasures(program._id).then(({ measures: m }) => {
      setMeasures(m);
      const current = m.find(x => x.week === week);
      const prev = [...m].reverse().find(x => x.week <= week);
      setForm({ ...(prev?.metrics || {}), ...(current?.metrics || {}) });
      setNote(current?.note || '');
    }).catch(() => {});
  }, [program._id, week]);
  useEffect(() => { load(); }, [load]);

  // Celebration hint: metric with the biggest positive move vs the previous week.
  const prevWeek = measures.filter(m => m.week < week).pop();
  let hint = null;
  if (prevWeek) {
    let best = 0;
    for (const m of program.pack.metrics) {
      const delta = (Number(form[m.key]) || 0) - (Number(prevWeek.metrics[m.key]) || 0);
      if (delta > best) { best = delta; hint = `${m.label}: up ${delta} this week — name the strategy, not the talent.`; }
    }
  }

  const saveNumbers = async () => {
    setBusy(true);
    try {
      const metrics = {};
      for (const m of program.pack.metrics) if (form[m.key] !== '' && form[m.key] !== undefined) metrics[m.key] = Number(form[m.key]);
      await putMeasure(program._id, week, { metrics, note });
      toast.success(`Week ${week} numbers saved`);
      load();
    } catch (err) { toast.error(err.message || 'Save failed'); }
    setBusy(false);
  };

  const captureBrag = async () => {
    if (!brag.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/api/journey/admin/achievements', {
        method: 'POST',
        body: JSON.stringify({
          userId: childId,
          title: brag.trim().slice(0, 160),
          date: new Date().toISOString().slice(0, 10),
          category: 'other',
          description: `${program.pack.title} — week ${week}`,
        }),
      });
      toast.success('On the trophy shelf! 🏆');
      setBrag('');
    } catch { toast.error('Could not save achievement'); }
    setBusy(false);
  };

  const bump = async () => {
    setBusy(true);
    try {
      if (week >= program.totalWeeks) {
        await patchProgram(program._id, { status: 'done' });
        toast.success('Pack complete! 🎓');
      } else {
        await patchProgram(program._id, { currentWeek: week + 1 });
        toast.success(`Advanced to week ${week + 1}`);
      }
      onChanged();
    } catch (err) { toast.error(err.message || 'Failed'); }
    setBusy(false);
  };

  const togglePause = async () => {
    setBusy(true);
    try {
      await patchProgram(program._id, { status: program.status === 'paused' ? 'active' : 'paused' });
      onChanged();
    } catch (err) { toast.error(err.message || 'Failed'); }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bold text-slate-800">{program.pack.title}</h2>
          <p className="text-xs text-slate-400">Week {week}/{program.totalWeeks} · {program.week?.theme} · {program.status}</p>
        </div>
        <button onClick={togglePause} disabled={busy} className="p-2 rounded-full text-slate-400 hover:bg-slate-100">
          {program.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>

      {/* 1. Numbers */}
      <div className="space-y-2 mb-3">
        {program.pack.metrics.map(m => (
          <div key={m.key} className="flex items-center gap-2">
            <label className="flex-1 text-xs text-slate-500">{m.label}</label>
            <Sparkline points={measures.map(x => Number(x.metrics[m.key]) || 0)} max={m.max} />
            <input type="number" min={m.min} max={m.max}
              value={form[m.key] ?? ''}
              onChange={e => setForm(f => ({ ...f, [m.key]: e.target.value }))}
              className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm text-right" />
          </div>
        ))}
        <input type="text" placeholder="Note for the week (optional)" value={note} onChange={e => setNote(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        <button onClick={saveNumbers} disabled={busy}
          className="w-full py-2 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-40">
          Save week {week} numbers
        </button>
      </div>

      {/* 2. Celebrate */}
      {hint && <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-2 mb-3">🎉 {hint}</p>}

      {/* 3. Brag capture */}
      <div className="flex gap-2 mb-3">
        <input type="text" placeholder="Real win this week? → trophy shelf" value={brag} onChange={e => setBrag(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" />
        <button onClick={captureBrag} disabled={busy || !brag.trim()}
          className="px-3 rounded-lg bg-amber-500 text-white disabled:opacity-40"><Trophy size={14} /></button>
      </div>

      {/* 4. Bump */}
      <button onClick={bump} disabled={busy || program.status !== 'active'}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40">
        {week >= program.totalWeeks ? 'Mark pack complete 🎓' : `Advance to week ${week + 1}`} <ArrowRight size={15} />
      </button>
    </div>
  );
}

export default function SundayReview() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState('');
  const [programs, setPrograms] = useState(null);

  const reload = useCallback(() => {
    if (!childId) return;
    listPrograms({ childId }).then(({ programs: p }) => setPrograms(p.filter(x => x.status !== 'done')))
      .catch(() => setPrograms([]));
  }, [childId]);

  useEffect(() => {
    apiFetch('/api/capabilities/children')
      .then(list => { setChildren(list); if (list.length) setChildId(String(list[0].childUserId)); })
      .catch(() => setChildren([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  if (!user?.isAdmin) return <Navigate to="/today" replace />;

  return (
    <div className="px-4 pb-12 pt-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Link to="/skills" className="p-1.5 rounded-full hover:bg-slate-100"><ChevronLeft size={20} className="text-slate-500" /></Link>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Sunday review</h1>
          <p className="text-xs text-slate-400">Numbers → celebrate → brag → bump. 15 minutes.</p>
        </div>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4">
          {children.map(c => (
            <button key={c.childUserId} onClick={() => setChildId(String(c.childUserId))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${String(c.childUserId) === childId ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {programs === null ? <p className="text-center text-slate-400 py-10">Loading…</p>
        : programs.length === 0 ? <p className="text-center text-slate-400 py-10">No running programs for this kid. Start one from the Skills dashboard.</p>
        : programs.map(p => <ProgramReview key={p._id} program={p} childId={childId} onChanged={reload} />)}
    </div>
  );
}
