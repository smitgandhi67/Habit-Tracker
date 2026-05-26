import { useState, useMemo, useEffect } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSleep } from '../hooks/useSleep';
import { groupByNight, elapsedMs, formatDuration, nightDateFor } from '../lib/sleepNight';
import SleepActiveCard from '../components/SleepActiveCard';
import SleepNightCard from '../components/SleepNightCard';
import SleepSessionModal from '../components/SleepSessionModal';

const STALE_MS = 18 * 60 * 60 * 1000;

export default function Sleep() {
  const {
    active, sessions, nights, loading,
    startSleep, stopSleep, addManual,
    updateSession, removeSession, setQuality,
  } = useSleep();

  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', session? }
  const [busy, setBusy] = useState(false);

  const nightsByDate = useMemo(() => {
    const map = {};
    for (const n of nights) map[n.nightDate] = n;
    return map;
  }, [nights]);

  const grouped = useMemo(
    () => groupByNight(sessions, nightsByDate),
    [sessions, nightsByDate],
  );

  const tonightDate = useMemo(() => {
    try { return nightDateFor(new Date()); } catch { return null; }
  }, []);
  const tonight = useMemo(
    () => grouped.find(g => g.nightDate === tonightDate) || null,
    [grouped, tonightDate],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [active]);
  const staleActive = active && (nowMs - new Date(active.startAt).getTime() > STALE_MS);

  async function handleStart() {
    setBusy(true);
    try { await startSleep(); }
    catch { /* toasted in hook */ }
    finally { setBusy(false); }
  }

  async function handleStop() {
    setBusy(true);
    try {
      const stopped = await stopSleep();
      if (stopped) {
        const ms = elapsedMs(stopped);
        toast.success(`Slept ${formatDuration(ms)}`);
      }
    } catch { /* toasted in hook */ }
    finally { setBusy(false); }
  }

  async function handleSave({ startAt, endAt }) {
    setBusy(true);
    try {
      if (modal?.session) {
        await updateSession(modal.session._id, { startAt, endAt });
        toast.success('Updated');
      } else {
        await addManual({ startAt, endAt });
        toast.success('Added');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(s) {
    if (!confirm('Delete this sleep segment?')) return;
    try {
      await removeSession(s._id);
      toast.success('Deleted');
    } catch { /* toasted in hook */ }
  }

  async function handleSetQuality(nightDate, q) {
    try {
      await setQuality(nightDate, q);
    } catch { /* toasted in hook */ }
  }

  return (
    <div className="pb-4">
      <header className="px-4 pt-2 pb-1">
        <h1 className="text-2xl font-bold text-slate-800">Sleep</h1>
      </header>

      <SleepActiveCard
        active={active}
        tonight={tonight}
        busy={busy}
        onStart={handleStart}
        onStop={handleStop}
      />

      {staleActive && (
        <div className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 flex gap-2">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-amber-800">
            <div className="font-semibold">Unfinished session</div>
            <div className="text-xs mt-0.5">
              Started {new Date(active.startAt).toLocaleString()}.
              Set the actual end time below, or delete if it was a mistake.
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setModal({ mode: 'edit', session: active })}
                className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5"
              >
                Set end time
              </button>
              <button
                onClick={() => handleDelete(active)}
                className="text-xs font-semibold bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 rounded-lg px-3 py-1.5"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 mt-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">History</h2>
        <button
          type="button"
          onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          <Plus size={16} /> Add manual entry
        </button>
      </div>

      {loading && grouped.length === 0 ? (
        <div className="px-4 mt-6 text-center text-slate-400 text-sm">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="mx-4 mt-3 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">
          No sleep recorded yet. Tap “Start sleep” when you head to bed, or add a manual entry.
        </div>
      ) : (
        grouped.map((night, i) => (
          <SleepNightCard
            key={night.nightDate}
            night={night}
            defaultExpanded={i === 0}
            onEdit={(s) => setModal({ mode: 'edit', session: s })}
            onDelete={handleDelete}
            onSetQuality={handleSetQuality}
          />
        ))
      )}

      {modal && (
        <SleepSessionModal
          key={modal.session?._id || 'new'}
          session={modal.session}
          busy={busy}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
