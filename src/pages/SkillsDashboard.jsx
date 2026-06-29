import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, LayoutDashboard, Star, Target, MessagesSquare, Activity, CalendarClock, Calculator, Lightbulb, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DOMAINS } from '../lib/capabilities/domains';
import { getDashboard } from '../lib/capabilities/dashboard';
import CapabilityRadar from '../components/CapabilityRadar';

const PARENT_COLOR = '#7c3aed';
const KID_COLOR = '#0ea5e9';
const dimValues = dims => Object.fromEntries((dims || []).map(d => [d.key, d.score]));
const pct = n => `${Math.round(n * 100)}%`;
const domainName = key => DOMAINS.find(d => d.key === key)?.name || key;

function TrackCard({ icon: Icon, label, children, to }) {
  const body = (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm h-full">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1.5">
        <Icon size={14} /> <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
  return to ? <Link to={to} className="block hover:opacity-90 transition-opacity">{body}</Link> : body;
}

// Reps-by-domain mini list — strongest domains in the window.
function TopDomains({ domains }) {
  const ranked = [...domains].filter(d => d.reps > 0).sort((a, b) => b.reps - a.reps).slice(0, 5);
  if (!ranked.length) return null;
  const max = Math.max(...ranked.map(d => d.reps));
  return (
    <div className="space-y-1.5">
      {ranked.map(d => (
        <div key={d.key}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-slate-600 flex items-center gap-1">
              {d.name}{d.foundational && <Star size={10} className="fill-violet-500 text-violet-500" />}
            </span>
            <span className="tabular-nums text-slate-400">{d.reps}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${d.foundational ? 'bg-violet-500' : 'bg-sky-400'}`}
              style={{ width: `${Math.round((d.reps / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SkillsDashboard() {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [children, setChildren] = useState(isAdmin ? null : []);
  const [childId, setChildId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (isAdmin && !childId) return;
    let cancelled = false;
    getDashboard({ childUserId: childId || undefined })
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, [childId, isAdmin]);

  const parentView = data?.parentView;
  const series = [];
  if (data?.baseline?.kid?.hasData) {
    series.push({ key: 'kid', label: parentView ? 'Child’s view' : 'You', color: KID_COLOR, values: dimValues(data.baseline.kid.dimensions) });
  }
  if (parentView && data?.baseline?.parent?.hasData) {
    series.unshift({ key: 'parent', label: 'Your rating', color: PARENT_COLOR, values: dimValues(data.baseline.parent.dimensions) });
  }
  const hasRadar = series.length > 0;
  const targets = data?.baseline?.targets || [];
  const gap = data?.baseline?.gap || [];

  return (
    <div className="px-4 pb-12 pt-4">
      <div className="flex items-center gap-2 mb-1">
        <Link to="/skills" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </Link>
        <LayoutDashboard size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">{parentView === false ? 'My skills profile' : 'Dashboard'}</h1>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {parentView === false
          ? 'Your radar, your reps, and your trophy shelf — all in one place.'
          : 'One child’s whole picture: baseline, focus areas, reps, and what’s moving across the app.'}
      </p>

      {isAdmin && children && children.length > 1 && (
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500">Which child?</label>
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
          Link a child first in the Parenting console to see their dashboard.
        </div>
      )}

      {!data && !error && !(isAdmin && children && children.length === 0) ? (
        <div className="bg-white rounded-3xl h-48 animate-pulse border border-slate-100" />
      ) : data && (
        <div className="space-y-5">
          {parentView && (
            <p className="text-sm font-semibold text-slate-700">{data.childName}</p>
          )}

          {/* Quarterly re-assessment nudge */}
          {data.baseline.needsReassessment && (
            <Link
              to={parentView ? '/skills/baseline/parent' : '/skills/baseline/kid'}
              className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors"
            >
              <CalendarClock size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <span className="text-xs text-amber-800">
                {data.baseline.daysSince == null
                  ? 'No baseline yet — take it to start the picture.'
                  : `Last baseline was ${data.baseline.daysSince} days ago. Re-take it (~quarterly).`}
              </span>
            </Link>
          )}

          {/* Radar */}
          {hasRadar ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm">
              <CapabilityRadar domains={DOMAINS} series={series} />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center text-sm text-slate-400">
              No baseline yet. <Link to={parentView ? '/skills/baseline/parent' : '/skills/baseline/kid'} className="text-violet-600 font-medium">Take it</Link> to see the radar.
            </div>
          )}

          {/* Focus areas (parent only) */}
          {parentView && targets.length > 0 && (
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <Target size={15} className="text-violet-600" /> Focus areas
              </h2>
              <ul className="space-y-2">
                {targets.map(t => (
                  <li key={t.key} className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-violet-800 flex items-center gap-1.5">
                      {t.name}{t.foundational && <Star size={11} className="fill-violet-500 text-violet-500" />}
                    </span>
                    <span className="text-xs tabular-nums text-violet-500">{pct(t.score)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Parent↔kid divergences (parent only) */}
          {parentView && gap.length > 0 && (
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
                <MessagesSquare size={15} className="text-sky-600" /> Worth talking about
              </h2>
              <ul className="space-y-2">
                {gap.map(g => (
                  <li key={g.key} className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                    <span className="block text-sm font-semibold text-sky-800">{domainName(g.key)}</span>
                    <span className="block text-xs text-sky-700/80 mt-0.5">
                      You: {pct(g.parent)} · Them: {pct(g.child)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reps by domain */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                <Activity size={15} className="text-emerald-600" /> Reps by domain
              </h2>
              <Link to="/skills/track" className="text-[11px] font-medium text-violet-600">Open tracker</Link>
            </div>
            {data.rollup.totalReps > 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <TopDomains domains={data.rollup.domains} />
                <p className="mt-2 text-[11px] text-slate-400">{data.rollup.totalReps} reps since {data.since}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic rounded-2xl border border-slate-100 bg-white px-4 py-4 text-center">
                No reps yet in this window.
              </p>
            )}
          </div>

          {/* Cross-track snapshot */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 mb-2">Across the app</h2>
            <div className="grid grid-cols-3 gap-2">
              <TrackCard icon={Calculator} label="Math" to="/math">
                <p className="text-lg font-bold text-slate-800 tabular-nums">{data.tracks.math.correct}</p>
                <p className="text-[11px] text-slate-400">correct · {data.tracks.math.activeDays}d active</p>
              </TrackCard>
              <TrackCard icon={Lightbulb} label="Builder" to="/build">
                <p className="text-lg font-bold text-slate-800 tabular-nums">{data.tracks.builder.shipped}</p>
                <p className="text-[11px] text-slate-400">shipped · {data.tracks.builder.problems} problems</p>
                {data.tracks.builder.label && (
                  <p className="text-[11px] text-violet-600 font-medium capitalize">{data.tracks.builder.label}</p>
                )}
              </TrackCard>
              <TrackCard icon={Trophy} label="Trophies" to="/trophies">
                <p className="text-lg font-bold text-slate-800 tabular-nums">{data.tracks.journey.achievements}</p>
                <p className="text-[11px] text-slate-400">
                  {data.tracks.journey.milestones
                    ? `${data.tracks.journey.milestones.done}/${data.tracks.journey.milestones.total} milestones`
                    : 'trophy shelf'}
                </p>
              </TrackCard>
            </div>
          </div>

          {/* Recent reps */}
          {data.cadence.recent.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-700 mb-2">Recent reps</h2>
              <ul className="space-y-1.5">
                {data.cadence.recent.map((l, i) => (
                  <li key={i} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2 shadow-sm">
                    <span className="text-sm text-slate-700 truncate">{l.title}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{l.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            A self-tracking system of record, <span className="font-medium">not a clinical assessment</span>.
            Reps mirror practice across the app and never grant points.
          </p>
        </div>
      )}
    </div>
  );
}
