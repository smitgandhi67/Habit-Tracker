import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Plus } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { apiFetch } from '../lib/api';

// Compact Today entry point for the Builder track: a one-line "log a problem" quick
// action + the fluency badge. Self-contained (own fetch) so it doesn't couple to
// Today's habit state.
export default function BuilderTodayCard() {
  const [fluency, setFluency] = useState(null);
  const [openCount, setOpenCount] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    apiFetch('/api/build')
      .then(d => {
        setFluency(d.fluency || null);
        setOpenCount((d.problems || []).filter(p => p.status === 'tinkering').length);
      })
      .catch(() => { /* non-critical */ });
  };
  useEffect(() => { refresh(); }, []);

  const add = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/build/problems', {
        method: 'POST',
        body: JSON.stringify({ text: t, kind: 'idea', date: format(new Date(), 'yyyy-MM-dd') }),
      });
      setText('');
      toast.success(res.awarded > 0 ? `+${res.awarded} for spotting a problem!` : 'Logged!');
      refresh();
    } catch { toast.error('Could not log'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Lightbulb size={18} className="text-amber-500" />
          </span>
          <div>
            <p className="font-semibold text-slate-700 leading-tight">Builder</p>
            <p className="text-xs text-slate-400 capitalize">
              {fluency ? `${fluency.label} · ${fluency.shipped} shipped` : 'problem-finding'}
            </p>
          </div>
        </div>
        <Link to="/build" className="text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1 rounded-full transition-colors">Open</Link>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What bugged you or made you curious today?"
          maxLength={280}
          className="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-violet-600 disabled:opacity-40 text-white px-3 flex items-center">
          <Plus size={18} />
        </button>
      </form>
      {openCount > 0 && <p className="text-xs text-slate-400 mt-2">{openCount} idea{openCount > 1 ? 's' : ''} you&apos;re tinkering with</p>}
    </div>
  );
}
