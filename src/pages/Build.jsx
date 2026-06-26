import { useState } from 'react';
import { Lightbulb, Plus, Trash2, Rocket, ExternalLink, Sparkles } from 'lucide-react';
import { useBuild } from '../hooks/useBuild';

const KINDS = [
  { key: 'idea', emoji: '💡', label: 'Idea' },
  { key: 'curiosity', emoji: '🤔', label: 'Curious' },
  { key: 'annoyance', emoji: '😤', label: 'Bugs me' },
];
const KIND_EMOJI = Object.fromEntries(KINDS.map(k => [k.key, k.emoji]));

const AI_LEVELS = [
  { key: 'helper', label: 'AI as helper' },
  { key: 'tool', label: 'AI as tool' },
  { key: 'partner', label: 'AI as partner' },
  { key: 'multiplier', label: 'AI as multiplier' },
];

const STATUS_CHIP = {
  logged: 'bg-slate-100 text-slate-500',
  tinkering: 'bg-amber-100 text-amber-700',
  parked: 'bg-slate-100 text-slate-400 line-through',
};

function ProblemRow({ p, onStatus, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="text-lg shrink-0">{KIND_EMOJI[p.kind] || '💡'}</span>
      <span className={`flex-1 text-sm ${p.status === 'parked' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{p.text}</span>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CHIP[p.status]}`}>{p.status}</span>
      {p.status !== 'tinkering' && p.status !== 'parked' && (
        <button onClick={() => onStatus(p._id, 'tinkering')} className="text-xs font-semibold text-violet-600 hover:underline">Tinker</button>
      )}
      {p.status === 'tinkering' && (
        <button onClick={() => onStatus(p._id, 'parked')} className="text-xs font-semibold text-slate-400 hover:underline">Park</button>
      )}
      <button onClick={() => onDelete(p._id)} className="text-slate-300 hover:text-red-400"><Trash2 size={15} /></button>
    </div>
  );
}

function ProjectCard({ p, onShip, onDelete }) {
  const [explained, setExplained] = useState(false);
  const shipped = !!p.shippedAt;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{p.title}</p>
          {p.audience && <p className="text-xs text-slate-400">for {p.audience}</p>}
        </div>
        <button onClick={() => onDelete(p._id)} className="text-slate-300 hover:text-red-400 shrink-0"><Trash2 size={16} /></button>
      </div>
      {p.description && <p className="text-sm text-slate-500 mt-2">{p.description}</p>}
      <div className="flex items-center flex-wrap gap-2 mt-3">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{p.aiLevel}</span>
        {p.url && (
          <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-violet-600 hover:underline flex items-center gap-1">
            <ExternalLink size={13} /> open
          </a>
        )}
        {shipped && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
            <Sparkles size={11} /> shipped
          </span>
        )}
      </div>
      {!shipped && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={explained} onChange={e => setExplained(e.target.checked)} className="mt-0.5" />
            <span>I can explain every part of this. <span className="text-slate-400">(If you can&apos;t teach it, you don&apos;t ship it.)</span></span>
          </label>
          <button
            onClick={() => onShip(p._id, explained)}
            disabled={!explained}
            className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold py-2"
          >
            <Rocket size={15} /> Ship it
          </button>
        </div>
      )}
    </div>
  );
}

export default function Build() {
  const {
    loading, problems, projects, fluency,
    addProblem, setStatus, removeProblem, addProject, shipProject, removeProject,
  } = useBuild();

  const [text, setText] = useState('');
  const [kind, setKind] = useState('idea');
  const [busy, setBusy] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', audience: '', url: '', aiLevel: 'helper', description: '' });

  const submitProblem = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { await addProblem(t, kind); setText(''); } catch { /* toast in hook */ }
    finally { setBusy(false); }
  };

  const submitProject = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await addProject(form);
      setForm({ title: '', audience: '', url: '', aiLevel: 'helper', description: '' });
      setShowForm(false);
    } catch { /* toast in hook */ }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-4 flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Lightbulb className="text-amber-500" size={24} /> Build
        </h1>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-50 text-violet-700 capitalize">
          {fluency.label} · {fluency.shipped} shipped
        </span>
      </div>
      <p className="text-sm text-slate-400 mb-6">Notice problems worth solving. Build a few. Ship the ones you can explain.</p>

      {/* Problem Journal */}
      <section className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-700 mb-3">Problem Journal</h2>
        <form onSubmit={submitProblem} className="space-y-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What bugged you or made you curious?"
            maxLength={280}
            className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <div className="flex gap-2">
            <div className="flex gap-1 flex-1">
              {KINDS.map(k => (
                <button
                  type="button"
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${kind === k.key ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500'}`}
                >
                  {k.emoji} {k.label}
                </button>
              ))}
            </div>
            <button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-violet-600 disabled:opacity-40 text-white px-4 flex items-center gap-1 text-sm font-semibold">
              <Plus size={16} /> Log
            </button>
          </div>
        </form>

        <div className="mt-3">
          {loading && problems.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
          ) : problems.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No problems logged yet. What&apos;s annoying or interesting today?</p>
          ) : (
            problems.map(p => <ProblemRow key={p._id} p={p} onStatus={setStatus} onDelete={removeProblem} />)
          )}
        </div>
      </section>

      {/* Things I made */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700">Things I made</h2>
          <button onClick={() => setShowForm(s => !s)} className="text-sm font-semibold text-violet-600 flex items-center gap-1">
            <Plus size={16} /> New
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitProject} className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-100 space-y-2">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What did you make?" maxLength={100}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200" />
            <input value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} placeholder="Who uses it? (mom, my class, …)" maxLength={140}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200" />
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="Link (optional)" maxLength={300}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200" />
            <select value={form.aiLevel} onChange={e => setForm(f => ({ ...f, aiLevel: e.target.value }))}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200">
              {AI_LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
            </select>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What is it? (optional)" maxLength={1000} rows={2}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200" />
            <button type="submit" disabled={!form.title.trim()} className="w-full rounded-xl bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold py-2">Add project</button>
          </form>
        )}

        {projects.length === 0 && !showForm ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-4xl mb-2">🛠️</p>
            <p className="text-sm">Nothing shipped yet. Pick a problem and make something small.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => <ProjectCard key={p._id} p={p} onShip={shipProject} onDelete={removeProject} />)}
          </div>
        )}
      </section>
    </div>
  );
}
