import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Trophy, Map, Plus, Trash2, Pencil, ExternalLink, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useJourney } from '../hooks/useJourney';

const M_CATS = ['math', 'competition', 'science', 'building', 'leadership', 'test', 'application', 'writing', 'other'];
const M_STATUSES = ['upcoming', 'in_progress', 'done'];
const A_CATS = ['competition', 'project', 'science-fair', 'leadership', 'service', 'research', 'award', 'test', 'other'];
const GRADES = [5, 6, 7, 8, 9, 10, 11, 12];

const NEXT_STATUS = { upcoming: 'in_progress', in_progress: 'done', done: 'upcoming' };
const STATUS_CHIP = {
  upcoming: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
};
const gradeLabel = (g) => (g == null ? 'Someday' : `Grade ${g}`);
const input = 'w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200';

const EMPTY_M = { title: '', grade: '', category: 'math', status: 'upcoming', target: '', notes: '' };
const EMPTY_A = { title: '', date: '', grade: '', category: 'competition', placement: '', hours: '', url: '', description: '' };

// Normalize a form's grade ('' → null) and numeric hours for the API.
const cleanGrade = (g) => (g === '' ? null : Number(g));

function groupByGrade(items) {
  const buckets = new Map();
  for (const it of items) {
    const k = it.grade == null ? null : it.grade;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  const graded = [...buckets.keys()].filter(k => k !== null).sort((a, b) => a - b);
  const out = graded.map(g => ({ grade: g, items: buckets.get(g) }));
  if (buckets.has(null)) out.push({ grade: null, items: buckets.get(null) });
  return out;
}

export default function JourneyAdmin() {
  const { user, loading: authLoading } = useAuth();
  const j = useJourney(!!user?.isAdmin);
  const [mForm, setMForm] = useState(null); // null = closed; else { editId|null, ...fields }
  const [aForm, setAForm] = useState(null);

  if (authLoading) return null;
  if (!user?.isAdmin) return <Navigate to="/today" replace />;

  const submitMilestone = async (e) => {
    e.preventDefault();
    if (!mForm.title.trim()) return;
    const payload = { ...mForm, grade: cleanGrade(mForm.grade) };
    delete payload.editId;
    if (mForm.editId) await j.updateMilestone(mForm.editId, payload);
    else await j.addMilestone(payload);
    setMForm(null);
  };

  const submitAchievement = async (e) => {
    e.preventDefault();
    if (!aForm.title.trim() || !aForm.date) return;
    const payload = { ...aForm, grade: cleanGrade(aForm.grade), hours: aForm.hours === '' ? 0 : Number(aForm.hours) };
    delete payload.editId;
    if (aForm.editId) await j.updateAchievement(aForm.editId, payload);
    else await j.addAchievement(payload);
    setAForm(null);
  };

  return (
    <div className="p-4">
      <h1 className="pt-4 text-2xl font-bold text-slate-800 mb-1">Roadmap & Brag-sheet</h1>
      <p className="text-sm text-slate-400 mb-4">The long game — kept here, with you. Milestones are targets; achievements are the real-time record.</p>

      {/* Kid picker */}
      <div className="flex gap-2 flex-wrap mb-6">
        {j.users.map(u => (
          <button
            key={u._id}
            onClick={() => { j.setSelected(u); setMForm(null); setAForm(null); }}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${j.selected?._id === u._id ? 'border-violet-300 bg-violet-50 text-violet-700 font-semibold' : 'border-slate-200 text-slate-500'}`}
          >
            {u.name}
          </button>
        ))}
      </div>

      {!j.selected ? (
        <p className="text-center text-slate-400 py-16">Pick a kid to see their roadmap.</p>
      ) : (
        <>
          {/* Roadmap */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2"><Map size={18} className="text-violet-500" /> Roadmap</h2>
              <button onClick={() => setMForm({ editId: null, ...EMPTY_M })} className="text-sm font-semibold text-violet-600 flex items-center gap-1"><Plus size={16} /> Milestone</button>
            </div>

            {mForm && (
              <form onSubmit={submitMilestone} className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-600">{mForm.editId ? 'Edit milestone' : 'New milestone'}</p>
                  <button type="button" onClick={() => setMForm(null)} className="text-slate-400"><X size={16} /></button>
                </div>
                <input className={input} placeholder="Target (e.g. Finish AoPS Pre-Algebra)" value={mForm.title} onChange={e => setMForm(f => ({ ...f, title: e.target.value }))} maxLength={160} />
                <div className="flex gap-2">
                  <select className={input} value={mForm.grade} onChange={e => setMForm(f => ({ ...f, grade: e.target.value }))}>
                    <option value="">No grade</option>
                    {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                  <select className={input} value={mForm.category} onChange={e => setMForm(f => ({ ...f, category: e.target.value }))}>
                    {M_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className={input} value={mForm.status} onChange={e => setMForm(f => ({ ...f, status: e.target.value }))}>
                    {M_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <input className={input} placeholder="Target date (free text, e.g. Jan 2027)" value={mForm.target} onChange={e => setMForm(f => ({ ...f, target: e.target.value }))} maxLength={60} />
                <input className={input} placeholder="Notes (optional)" value={mForm.notes} onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))} maxLength={500} />
                <button type="submit" disabled={!mForm.title.trim()} className="w-full rounded-xl bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold py-2">{mForm.editId ? 'Save' : 'Add milestone'}</button>
              </form>
            )}

            {j.milestones.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No milestones yet.</p>
            ) : (
              groupByGrade(j.milestones).map(group => (
                <div key={String(group.grade)} className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">{gradeLabel(group.grade)}</p>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                    {group.items.map(m => (
                      <div key={m._id} className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => j.updateMilestone(m._id, { status: NEXT_STATUS[m.status] })}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CHIP[m.status]}`}
                          title="Click to cycle status"
                        >
                          {m.status.replace('_', ' ')}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{m.title}</p>
                          <p className="text-xs text-slate-400">{m.category}{m.target ? ` · ${m.target}` : ''}</p>
                        </div>
                        <button onClick={() => setMForm({ editId: m._id, title: m.title, grade: m.grade ?? '', category: m.category, status: m.status, target: m.target || '', notes: m.notes || '' })} className="text-slate-300 hover:text-violet-500"><Pencil size={15} /></button>
                        <button onClick={() => j.deleteMilestone(m._id)} className="text-slate-300 hover:text-red-400"><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Brag-sheet */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Brag-sheet</h2>
              <button onClick={() => setAForm({ editId: null, ...EMPTY_A })} className="text-sm font-semibold text-violet-600 flex items-center gap-1"><Plus size={16} /> Achievement</button>
            </div>

            {aForm && (
              <form onSubmit={submitAchievement} className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-600">{aForm.editId ? 'Edit achievement' : 'New achievement'}</p>
                  <button type="button" onClick={() => setAForm(null)} className="text-slate-400"><X size={16} /></button>
                </div>
                <input className={input} placeholder="What happened (e.g. Math Kangaroo — Nat'l Rank 20)" value={aForm.title} onChange={e => setAForm(f => ({ ...f, title: e.target.value }))} maxLength={160} />
                <div className="flex gap-2">
                  <input type="date" className={input} value={aForm.date} onChange={e => setAForm(f => ({ ...f, date: e.target.value }))} />
                  <select className={input} value={aForm.grade} onChange={e => setAForm(f => ({ ...f, grade: e.target.value }))}>
                    <option value="">No grade</option>
                    {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <select className={input} value={aForm.category} onChange={e => setAForm(f => ({ ...f, category: e.target.value }))}>
                    {A_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className={input} placeholder="Placement (1st, State…)" value={aForm.placement} onChange={e => setAForm(f => ({ ...f, placement: e.target.value }))} maxLength={80} />
                  <input className={input} type="number" min="0" placeholder="Hours" value={aForm.hours} onChange={e => setAForm(f => ({ ...f, hours: e.target.value }))} />
                </div>
                <input className={input} placeholder="Link / evidence (optional)" value={aForm.url} onChange={e => setAForm(f => ({ ...f, url: e.target.value }))} maxLength={300} />
                <input className={input} placeholder="Notes (optional)" value={aForm.description} onChange={e => setAForm(f => ({ ...f, description: e.target.value }))} maxLength={1000} />
                <button type="submit" disabled={!aForm.title.trim() || !aForm.date} className="w-full rounded-xl bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold py-2">{aForm.editId ? 'Save' : 'Add achievement'}</button>
              </form>
            )}

            {j.achievements.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No achievements logged yet.</p>
            ) : (
              <div className="space-y-2">
                {j.achievements.map(a => (
                  <div key={a._id} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex items-start gap-2">
                    <Trophy size={16} className="text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{a.title}</p>
                      <p className="text-xs text-slate-400">
                        {a.date}{a.grade ? ` · Grade ${a.grade}` : ''} · {a.category}
                        {a.placement ? ` · ${a.placement}` : ''}{a.hours ? ` · ${a.hours}h` : ''}
                      </p>
                      {a.description && <p className="text-xs text-slate-500 mt-1">{a.description}</p>}
                      {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1 mt-1"><ExternalLink size={12} /> link</a>}
                    </div>
                    <button onClick={() => setAForm({ editId: a._id, title: a.title, date: a.date, grade: a.grade ?? '', category: a.category, placement: a.placement || '', hours: a.hours || '', url: a.url || '', description: a.description || '' })} className="text-slate-300 hover:text-violet-500"><Pencil size={15} /></button>
                    <button onClick={() => j.deleteAchievement(a._id)} className="text-slate-300 hover:text-red-400"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
