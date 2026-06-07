import { useState } from 'react';
import { format, subYears } from 'date-fns';
import toast from 'react-hot-toast';
import { downloadHealthExport } from '../lib/export';

export default function ExportHealthModal({ onClose }) {
  const today = new Date();
  const [from, setFrom] = useState(format(subYears(today, 1), 'yyyy-MM-dd'));
  const [to, setTo]     = useState(format(today, 'yyyy-MM-dd'));
  const [busy, setBusy] = useState(false);
  const valid = from && to && from <= to;

  async function handleDownload() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await downloadHealthExport(from, to);
      toast.success('Export downloaded');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-1">Export health data</h2>
        <p className="text-xs text-slate-500 mb-4">
          Gym log, body measurements, and sleep as a Markdown file to feed an AI.
        </p>

        <label className="block text-xs font-semibold text-slate-600 mb-1">From</label>
        <input
          type="date" value={from} max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="w-full mb-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />

        <label className="block text-xs font-semibold text-slate-600 mb-1">To</label>
        <input
          type="date" value={to} min={from}
          onChange={(e) => setTo(e.target.value)}
          className="w-full mb-4 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />

        {!valid && (
          <p className="text-xs text-red-500 mb-2">“From” must be on or before “To”.</p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={!valid || busy}
            className="px-4 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? 'Preparing…' : 'Download .md'}
          </button>
        </div>
      </div>
    </div>
  );
}
