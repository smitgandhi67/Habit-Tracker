import { useState } from 'react';
import { X } from 'lucide-react';

// Converts a Date to 'YYYY-MM-DDTHH:mm' in local time, suitable for <input type="datetime-local">.
function toLocalInput(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Parses 'YYYY-MM-DDTHH:mm' as local time → Date.
function fromLocalInput(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function SleepSessionModal({ session, defaults, onSave, onClose, busy }) {
  const isEdit = !!session?._id;
  const title = isEdit ? 'Edit sleep segment' : 'Add sleep entry';

  // Parent passes key={session?._id || 'new'} so this component remounts when
  // switching between targets — no effect-based reset needed.
  const [start, setStart] = useState(() => toLocalInput(session?.startAt ?? defaults?.startAt ?? guessStart()));
  const [end,   setEnd]   = useState(() => toLocalInput(session?.endAt ?? defaults?.endAt ?? guessEnd()));
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const startDate = fromLocalInput(start);
    const endDate = fromLocalInput(end);
    if (!startDate) { setError('Start time is required'); return; }
    if (!endDate)   { setError('End time is required');   return; }
    if (endDate <= startDate) { setError('End must be after start'); return; }
    try {
      await onSave({ startAt: startDate.toISOString(), endAt: endDate.toISOString() });
      onClose();
    } catch (err) {
      // Server error already toasted by hook; surface inline summary too.
      setError(err?.message?.includes('Overlaps') ? 'Overlaps an existing session' : 'Save failed');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start</span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => { setStart(e.target.value); setError(''); }}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">End</span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => { setEnd(e.target.value); setError(''); }}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none"
            />
          </label>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 py-2.5 font-semibold text-white shadow"
            >
              {isEdit ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function guessStart() {
  // Default to last night ~11pm.
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 0, 0, 0);
  return d;
}

function guessEnd() {
  // Default to this morning ~7am.
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  return d;
}
