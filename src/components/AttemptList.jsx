import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { styleInfo } from '../lib/parenting/bands';

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

// Cursor-driven list of past attempts (patterned on PointsLedger). Each row links
// to the full result. Rows carry the instrument's headline metric snapshot.
export default function AttemptList({ items, hasMore, onLoadMore }) {
  if (!items.length) {
    return <p className="text-sm text-slate-400 text-center py-8">No results yet. Take a quiz to start your history.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map(it => {
        const style = it.styleKey ? styleInfo(it.styleKey) : null;
        return (
          <Link
            key={it._id}
            to={`/parenting/result/${it._id}`}
            className="flex items-center justify-between gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100 hover:border-violet-200 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-slate-700">{it.title}</p>
              <p className="text-xs text-slate-400">{formatDate(it.completedAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              {style && <span className="text-xs font-semibold text-slate-600">{style.label}</span>}
              {it.total != null && <span className="text-xs font-semibold tabular-nums text-slate-600">{it.total.toFixed(2)}</span>}
              <ChevronRight size={16} className="text-slate-300" />
            </div>
          </Link>
        );
      })}
      {hasMore && (
        <button onClick={onLoadMore} className="w-full text-sm text-violet-600 font-medium py-2 hover:text-violet-700">
          Load more
        </button>
      )}
    </div>
  );
}
