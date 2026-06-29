import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronLeft, Activity, Star, Plus, Trash2, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { listActivities } from '../lib/capabilities/activities';
import { getRollup, listActivityLogs, logActivity, deleteActivityLog } from '../lib/capabilities/tracker';

const SOURCE_LABEL = { activities: 'activities', math: 'math', builder: 'builder', gym: 'gym', habits: 'habits' };

// Per-domain reps bar — width relative to the strongest domain in the window.
function DomainBar({ d, max }) {
  const width = max > 0 ? Math.round((d.reps / max) * 100) : 0;
  const active = Object.entries(d.sources).filter(([, n]) => n > 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-300 tabular-nums w-4">{d.num}</span>
          {d.name}
          {d.foundational && <Star size={12} className="fill-violet-500 text-violet-500" />}
        </span>
        <span className="text-xs tabular-nums text-slate-500 font-semibold">{d.reps} reps</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${d.foundational ? 'bg-violet-500' : 'bg-sky-400'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {active.length > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-400">
          {active.map(([s, n]) => `${SOURCE_LABEL[s]} ${n}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

// Activity tracker (handover_1.md §9): log evidence-based reps for a child and watch
// them roll up per domain — combined with the reps the rest of the app already
// records (math, builder, gym, tagged habits). Read-only aggregation: a rep is a
// practice signal, never points. Nudges a quarterly baseline re-take when it's stale.
export default function SkillsTracker() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [children, setChildren] = useState(isAdmin ? null : []); // null = loading (admin only)
  const [childId, setChildId] = useState('');
  const [activities, setActivities] = useState([]);
  const [rollup, setRollup] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Log form
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Admin: load the linked children for the picker.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    apiFetch('/api/capabilities/children')
      .then(list => {
        if (cancelled) return;
        setChildren(list);
        if (list.length >= 1) setChildId(String(list[0].childUserId));
      })
      .catch(() => { if (!cancelled) setChildren([]); });
    return () => { cancelled = true; };
  }, [isAdmin]);

  // The 'do' activities available to log (catalog is child-independent).
  useEffect(() => {
    let cancelled = false;
    listActivities({ kind: 'do' })
      .then(list => { if (!cancelled) setActivities(list); })
      .catch(() => { /* dropdown just stays empty */ });
    return () => { cancelled = true; };
  }, []);

  // Rollup + recent logs for the selected child (or self when not admin).
  useEffect(() => {
    if (isAdmin && !childId) return; // wait for a child selection
    let cancelled = false;
    const target = childId || undefined;
    Promise.all([getRollup({ childUserId: target }), listActivityLogs({ childUserId: target, limit: 25 })])
      .then(([r, l]) => { if (!cancelled) { setRollup(r); setLogs(l); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, [childId, isAdmin, reloadKey]);

  async function handleLog() {
    if (!slug) return;
    setSaving(true);
    try {
      await logActivity({ activitySlug: slug, subjectUserId: childId || undefined, date, note: note.trim() });
      setNote('');
      setReloadKey(k => k + 1);
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteActivityLog(id);
      setReloadKey(k => k + 1);
    } catch (err) {
      setError(err.message || 'Could not delete');
    }
  }

  const maxReps = rollup ? Math.max(1, ...rollup.domains.map(d => d.reps)) : 1;
  const needsReassess = rollup?.baseline?.needsReassessment;
  const daysSince = rollup?.baseline?.daysSince;

  return (
    <div className="px-4 pb-12 pt-4">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/skills" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </Link>
        <Activity size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">Activity tracker</h1>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Reps are a practice signal across the whole app — <span className="font-medium">not points</span>.
        Quality of reps beats quantity.
      </p>

      {/* Child picker (admin) */}
      {isAdmin && children && children.length > 1 && (
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500">Whose tracker?</label>
          <select
            value={childId}
            onChange={e => setChildId(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
          >
            {children.map(c => (
              <option key={String(c.childUserId)} value={String(c.childUserId)}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-2xl p-4 mb-3">{error}</div>}

      {isAdmin && children && children.length === 0 && (
        <div className="bg-amber-50 text-amber-700 text-sm rounded-2xl p-4">
          Link a child first in the Parenting console, then come back to track their activities.
        </div>
      )}

      {/* Quarterly re-assessment nudge */}
      {needsReassess && (
        <Link
          to="/skills/baseline/parent"
          className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 mb-4 hover:bg-amber-100 transition-colors"
        >
          <CalendarClock size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800">
            {daysSince == null
              ? 'No baseline yet — take the baseline to see where to focus.'
              : `Last baseline was ${daysSince} days ago. Re-take it (~quarterly) to see what moved.`}
          </span>
        </Link>
      )}

      {/* Log an activity */}
      {(!isAdmin || childId) && (
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm mb-5">
          <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <Plus size={15} className="text-violet-600" /> Log an activity
          </p>
          <select
            value={slug}
            onChange={e => setSlug(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
          >
            <option value="">Choose an activity…</option>
            {activities.map(a => (
              <option key={a.slug} value={a.slug}>{a.title}</option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <input
              type="date"
              value={date}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={e => setDate(e.target.value)}
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
            />
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="How it went (optional)"
              maxLength={280}
              className="flex-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
            />
          </div>
          <button
            onClick={handleLog}
            disabled={!slug || saving}
            className={`mt-3 w-full rounded-2xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              slug && !saving ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {saving ? 'Logging…' : 'Log rep'}
          </button>
        </div>
      )}

      {/* Per-domain rollup */}
      {rollup && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-700">Reps by domain</h2>
            <span className="text-[11px] text-slate-400">since {rollup.since} · {rollup.totalReps} total</span>
          </div>
          {rollup.totalReps === 0 ? (
            <p className="text-sm text-slate-400 italic rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center">
              No reps in this window yet. Log an activity above, or do some math / build / gym — they all roll up here.
            </p>
          ) : (
            <div className="space-y-2">
              {rollup.domains.map(d => <DomainBar key={d.key} d={d} max={maxReps} />)}
            </div>
          )}
        </div>
      )}

      {/* Recent reps */}
      {logs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-2">Recent reps</h2>
          <ul className="space-y-2">
            {logs.map(l => (
              <li key={l._id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-700 truncate">{l.title}</span>
                  <span className="block text-[11px] text-slate-400">
                    {l.date}{l.note ? ` · ${l.note}` : ''}
                  </span>
                </span>
                <button
                  onClick={() => handleDelete(l._id)}
                  className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  aria-label="Delete rep"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-slate-400 mt-6 leading-relaxed">
        Reps aggregate practice already happening across the app. They never grant points — the
        tracker is a mirror, not a scoreboard.
      </p>
    </div>
  );
}
