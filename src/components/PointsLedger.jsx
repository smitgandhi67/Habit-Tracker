import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Plus, Minus, RotateCcw, Gift, X, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';

// Visual treatment per ledger event kind.
const KIND = {
  earn:    { icon: Sparkles, tint: 'text-violet-500', sign: 'pos' },
  approve: { icon: Check,    tint: 'text-green-500',  sign: 'pos' },
  add:     { icon: Plus,     tint: 'text-green-500',  sign: 'pos' },
  deduct:  { icon: Minus,    tint: 'text-red-500',    sign: 'neg' },
  reset:   { icon: RotateCcw,tint: 'text-red-500',    sign: 'neg' },
  redeem:  { icon: Gift,     tint: 'text-amber-500',  sign: 'neg' },
  decline: { icon: X,        tint: 'text-slate-400',  sign: 'zero' },
};

function deltaText(delta) {
  if (delta > 0) return { text: `+${delta}`, cls: 'text-green-600' };
  if (delta < 0) return { text: `${delta}`, cls: 'text-red-600' };
  return { text: '0', cls: 'text-slate-400' };
}

// Read-only points history. `endpoint` is the full API path (may already carry a
// query string, e.g. the admin variant with ?userId=). Pages via the server cursor.
// Reset is handled by the parent via a `key` prop (remount on endpoint change),
// so this component only ever appends pages for a single endpoint.
export default function PointsLedger({ endpoint }) {
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const urlFor = useCallback((cur) => (
    endpoint + (endpoint.includes('?') ? '&' : '?') + 'limit=50' + (cur ? `&cursor=${encodeURIComponent(cur)}` : '')
  ), [endpoint]);

  // First page on mount (parent remounts via `key` when the endpoint changes).
  useEffect(() => {
    let active = true;
    apiFetch(urlFor(null))
      .then(data => { if (!active) return; setEvents(data.events); setCursor(data.nextCursor); setDone(!data.nextCursor); setLoading(false); })
      .catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [urlFor]);

  function loadMore() {
    setLoading(true);
    apiFetch(urlFor(cursor))
      .then(data => { setEvents(prev => [...prev, ...data.events]); setCursor(data.nextCursor); setDone(!data.nextCursor); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  function retry() {
    setLoading(true); setError(false);
    apiFetch(urlFor(null))
      .then(data => { setEvents(data.events); setCursor(data.nextCursor); setDone(!data.nextCursor); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  // Group the (already newest-first) events by local day, with a per-day net.
  const days = useMemo(() => {
    const out = [];
    let cur = null;
    for (const e of events) {
      if (!cur || cur.date !== e.localDate) {
        cur = { date: e.localDate, items: [], net: 0 };
        out.push(cur);
      }
      cur.items.push(e);
      cur.net += e.delta;
    }
    return out;
  }, [events]);

  if (error && events.length === 0) {
    return <p className="text-sm text-red-500">Couldn't load history. <button onClick={retry} className="underline">Retry</button></p>;
  }
  if (events.length === 0 && !loading) {
    return <p className="text-sm text-slate-400">No points history yet.</p>;
  }

  return (
    <div className="space-y-4">
      {days.map(day => (
        <div key={day.date}>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {format(parseISO(day.date), 'EEE, MMM d')}
            </h4>
            <span className={`text-xs font-bold tabular-nums ${day.net > 0 ? 'text-green-600' : day.net < 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {day.net > 0 ? `+${day.net}` : day.net} pts
            </span>
          </div>
          <div className="space-y-1">
            {day.items.map((e, i) => {
              const k = KIND[e.kind] || KIND.add;
              const Icon = k.icon;
              const d = deltaText(e.delta);
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Icon size={15} className={k.tint} />
                  <span className="flex-1 min-w-0 text-sm text-slate-600 truncate">
                    {e.label}
                    {e.kind === 'decline' && e.meta?.wouldBe ? (
                      <span className="text-slate-400"> · would've been +{e.meta.wouldBe}</span>
                    ) : null}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${d.cls}`}>{d.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!done && (
        <button
          disabled={loading}
          onClick={loadMore}
          className="w-full text-sm font-semibold text-violet-600 hover:text-violet-700 py-2 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
