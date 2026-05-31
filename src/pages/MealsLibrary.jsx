import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Archive, RotateCcw, Pencil, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listMealPlans,
  cloneMealPlan,
  archiveMealPlan,
  unarchiveMealPlan,
  createMealPlan,
} from '../lib/mealPlans';

function PlanCard({ plan, active, onClone, onArchive, onUnarchive, isAdmin }) {
  const isMine = !plan.isMaster;
  const readOnlyForMe = plan.isMaster && !isAdmin;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-colors ${active ? 'bg-violet-50 border-violet-200' : 'bg-white border-slate-100'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {plan.isMaster && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                <Sparkles size={10} /> Master
              </span>
            )}
            {active && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
            {plan.archivedAt && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                Archived
              </span>
            )}
          </div>
          <p className="font-semibold text-slate-800 truncate">{plan.name}</p>
          {plan.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-3">{plan.description}</p>
          )}
          <p className="text-[11px] text-slate-400 mt-2">
            {plan.cycleLength}-day cycle · {plan.days?.length || 0} days defined
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        {plan.isMaster && (
          <button
            onClick={() => onClone(plan)}
            className="inline-flex items-center gap-1 bg-violet-600 text-white text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Plus size={13} /> Use this plan
          </button>
        )}
        {isMine && !plan.archivedAt && (
          <Link
            to={`/meals/${plan._id}/edit`}
            className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl hover:border-violet-300 hover:text-violet-700 transition-colors"
          >
            <Pencil size={13} /> Edit
          </Link>
        )}
        {!readOnlyForMe && !plan.archivedAt && isMine && (
          <button
            onClick={() => onArchive(plan)}
            className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium px-3 py-1.5 rounded-xl hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Archive size={13} /> Archive
          </button>
        )}
        {!readOnlyForMe && plan.archivedAt && (
          <button
            onClick={() => onUnarchive(plan)}
            className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium px-3 py-1.5 rounded-xl hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RotateCcw size={13} /> Unarchive
          </button>
        )}
      </div>
    </div>
  );
}

export default function MealsLibrary() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async (includeArchived) => {
    setLoading(true);
    try {
      const data = await listMealPlans({ includeArchived });
      setPlans(data);
    } catch {
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listMealPlans({ includeArchived: showArchived });
        if (!cancelled) setPlans(data);
      } catch {
        if (!cancelled) toast.error('Failed to load plans');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showArchived]);

  const activeOwnId = plans.find(p => !p.isMaster && !p.archivedAt)?._id;

  const handleClone = async (plan) => {
    try {
      await cloneMealPlan(plan._id);
      toast.success('Plan added to your account');
      navigate('/meals');
    } catch (err) {
      const msg = String(err.message || '');
      if (msg.includes('already have an active copy')) {
        toast('You already have a copy — open it from your meals page', { icon: 'ℹ️' });
        navigate('/meals');
        return;
      }
      toast.error('Failed to clone plan');
    }
  };

  const handleArchive = async (plan) => {
    if (!window.confirm(`Archive "${plan.name}"? You can unarchive later.`)) return;
    try {
      await archiveMealPlan(plan._id);
      toast.success('Archived');
      refresh(showArchived);
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleUnarchive = async (plan) => {
    try {
      await unarchiveMealPlan(plan._id);
      toast.success('Restored');
      refresh(showArchived);
    } catch {
      toast.error('Failed to unarchive');
    }
  };

  const handleNewBlank = async () => {
    const name = window.prompt('Name your new meal plan:');
    if (!name?.trim()) return;
    try {
      const plan = await createMealPlan({
        name:        name.trim(),
        description: '',
        cycleLength: 7,
        days:        Array.from({ length: 7 }, (_, i) => ({
          dayIndex: i + 1,
          label:    `Day ${i + 1}`,
          meals:    [],
        })),
      });
      toast.success('Created');
      navigate(`/meals/${plan._id}/edit`);
    } catch {
      toast.error('Failed to create plan');
    }
  };

  const masters = plans.filter(p => p.isMaster);
  const own     = plans.filter(p => !p.isMaster);

  return (
    <div className="px-4 pb-12 pt-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <Link to="/meals" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
          <ChevronLeft size={20} className="text-slate-500" />
        </Link>
        <h1 className="text-lg font-bold text-slate-800">Meal plan library</h1>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading…</div>
      ) : (
        <>
          {masters.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Master plans</h2>
              <div className="space-y-3">
                {masters.map(p => (
                  <PlanCard
                    key={p._id}
                    plan={p}
                    active={false}
                    onClone={handleClone}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your plans</h2>
              <button
                onClick={handleNewBlank}
                className="text-xs text-violet-600 font-semibold hover:underline"
              >
                + Blank plan
              </button>
            </div>
            {own.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">No personal plans yet. Pick a master plan above to get started.</p>
            ) : (
              <div className="space-y-3">
                {own.map(p => (
                  <PlanCard
                    key={p._id}
                    plan={p}
                    active={p._id === activeOwnId}
                    onClone={handleClone}
                    onArchive={handleArchive}
                    onUnarchive={handleUnarchive}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="mt-6 text-center">
            <button
              onClick={() => setShowArchived(s => !s)}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
