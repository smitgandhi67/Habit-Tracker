import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { formatDuration, elapsedMs } from '../lib/sleepNight';
import SleepQualityPicker from './SleepQualityPicker';

export default function SleepNightCard({ night, defaultExpanded = false, onEdit, onDelete, onSetQuality }) {
  const [open, setOpen] = useState(defaultExpanded);

  const dateLabel = formatNightDate(night.nightDate);
  const totalLabel = night.totalMs > 0 ? formatDuration(night.totalMs) : (night.isActive ? 'in progress' : '—');

  return (
    <article className="mx-4 mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition"
      >
        <div className="text-left flex-1 min-w-0">
          <div className="font-semibold text-slate-700 truncate">{dateLabel}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {totalLabel}{night.sessions.length > 1 ? ` · ${night.sessions.length} segments` : ''}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <SleepQualityPicker
            value={night.quality}
            onChange={(n) => onSetQuality?.(night.nightDate, n)}
          />
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-2">
          {night.sessions.length === 0 ? (
            <div className="text-sm text-slate-400 py-2">No segments recorded.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {night.sessions.map(s => (
                <li key={s._id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 truncate">
                      {formatTime(s.startAt)} – {s.endAt ? formatTime(s.endAt) : <span className="text-violet-600 font-medium">ongoing</span>}
                    </div>
                    <div className="text-xs text-slate-400">{formatDuration(s.endAt ? elapsedMs(s) : null)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit?.(s)}
                    className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition"
                    aria-label="Edit segment"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(s)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    aria-label="Delete segment"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function formatNightDate(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
