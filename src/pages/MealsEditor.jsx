import { useEffect, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMealPlan, updateMealPlan } from '../lib/mealPlans';
import { MEAL_SLOTS, SLOT_LABELS } from '../lib/mealLogs';

function recomputeTotals(meals) {
  let cal = 0, p = 0;
  for (const m of meals) {
    cal += Number(m.calories) || 0;
    p   += Number(m.protein)  || 0;
  }
  return { totalCalories: cal, totalProtein: p };
}

function MealRow({ meal, onChange, onDelete }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
      <div className="flex gap-2">
        <select
          value={meal.slot}
          onChange={e => onChange({ ...meal, slot: e.target.value })}
          className="text-xs font-semibold border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          {MEAL_SLOTS.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
        </select>
        <input
          type="text"
          value={meal.name || ''}
          onChange={e => onChange({ ...meal, name: e.target.value })}
          placeholder="Short label"
          className="flex-1 text-sm border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          onClick={onDelete}
          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          title="Delete meal"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <input
        type="text"
        value={meal.foods || ''}
        onChange={e => onChange({ ...meal, foods: e.target.value })}
        placeholder="Full ingredient list"
        className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <div className="flex gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <span>kcal</span>
          <input
            type="number"
            min="0"
            value={meal.calories ?? ''}
            onChange={e => onChange({ ...meal, calories: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-16 text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          <span>protein g</span>
          <input
            type="number"
            min="0"
            value={meal.protein ?? ''}
            onChange={e => onChange({ ...meal, protein: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-16 text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </label>
        <input
          type="text"
          value={meal.micros || ''}
          onChange={e => onChange({ ...meal, micros: e.target.value })}
          placeholder="Key micros (optional)"
          className="flex-1 text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
      </div>
    </div>
  );
}

export default function MealsEditor() {
  const { id } = useParams();
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMealPlan(id)
      .then(p => { if (!cancelled) setPlan(p); })
      .catch(() => toast.error('Failed to load plan'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const day = plan?.days?.[activeDay];

  const updateMeal = (idx, nextMeal) => {
    setPlan(prev => {
      const days = prev.days.map((d, i) => {
        if (i !== activeDay) return d;
        const meals = d.meals.map((m, j) => j === idx ? nextMeal : m);
        return { ...d, meals, ...recomputeTotals(meals) };
      });
      return { ...prev, days };
    });
  };

  const addMeal = () => {
    setPlan(prev => {
      const days = prev.days.map((d, i) => {
        if (i !== activeDay) return d;
        const meals = [...d.meals, { slot: 'snack', name: '', foods: '', calories: 0, protein: 0, micros: '', order: d.meals.length }];
        return { ...d, meals, ...recomputeTotals(meals) };
      });
      return { ...prev, days };
    });
  };

  const deleteMeal = (idx) => {
    setPlan(prev => {
      const days = prev.days.map((d, i) => {
        if (i !== activeDay) return d;
        const meals = d.meals.filter((_, j) => j !== idx).map((m, j) => ({ ...m, order: j }));
        return { ...d, meals, ...recomputeTotals(meals) };
      });
      return { ...prev, days };
    });
  };

  const updateDayMeta = (patch) => {
    setPlan(prev => {
      const days = prev.days.map((d, i) => i === activeDay ? { ...d, ...patch } : d);
      return { ...prev, days };
    });
  };

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await updateMealPlan(plan._id, {
        name:        plan.name,
        description: plan.description,
        cycleLength: plan.cycleLength,
        startDate:   plan.startDate,
        days:        plan.days,
      });
      toast.success('Saved');
    } catch (err) {
      const msg = String(err.message || '');
      if (msg.includes('archived')) toast.error('Plan is archived — unarchive first');
      else toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const dayTabs = useMemo(() => plan?.days?.map(d => d.label) || [], [plan]);

  if (loading) return <div className="p-4 pt-8 text-slate-400 text-center">Loading…</div>;
  if (!plan)   return <div className="p-4 pt-8 text-slate-400 text-center">Plan not found.</div>;

  return (
    <div className="px-4 pb-12 pt-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/meals/library" className="p-1.5 rounded-full hover:bg-slate-100 transition-colors shrink-0">
            <ChevronLeft size={20} className="text-slate-500" />
          </Link>
          <h1 className="text-lg font-bold text-slate-800 truncate">Edit plan</h1>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 bg-violet-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Plan metadata */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 space-y-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Name</span>
          <input
            type="text"
            value={plan.name}
            onChange={e => setPlan({ ...plan, name: e.target.value })}
            className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">Description</span>
          <textarea
            rows={2}
            value={plan.description || ''}
            onChange={e => setPlan({ ...plan, description: e.target.value })}
            className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
          />
        </label>
        <div className="flex gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Cycle (days)</span>
            <input
              type="number"
              min="1"
              max="60"
              value={plan.cycleLength}
              onChange={e => setPlan({ ...plan, cycleLength: Number(e.target.value) })}
              className="w-20 mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
            />
          </label>
          <label className="block flex-1">
            <span className="text-xs font-semibold text-slate-500">Start date</span>
            <input
              type="date"
              value={plan.startDate || ''}
              onChange={e => setPlan({ ...plan, startDate: e.target.value || null })}
              className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
            />
          </label>
        </div>
      </div>

      {/* Day tabs */}
      {dayTabs.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {dayTabs.map((label, i) => (
            <button
              key={i}
              onClick={() => setActiveDay(i)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                i === activeDay
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Day body */}
      {day && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-xs font-semibold text-slate-500">Day label</span>
              <input
                type="text"
                value={day.label}
                onChange={e => updateDayMeta({ label: e.target.value })}
                className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Day notes (optional)</span>
            <textarea
              rows={2}
              value={day.notes || ''}
              onChange={e => updateDayMeta({ notes: e.target.value })}
              className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
            />
          </label>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{day.totalCalories || 0}</span> kcal · {' '}
              <span className="font-semibold text-slate-700">{day.totalProtein || 0}</span>g protein
            </div>
            <button
              onClick={addMeal}
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              <Plus size={13} /> Add meal
            </button>
          </div>

          <div className="space-y-3">
            {day.meals.map((m, idx) => (
              <MealRow
                key={idx}
                meal={m}
                onChange={(next) => updateMeal(idx, next)}
                onDelete={() => deleteMeal(idx)}
              />
            ))}
            {day.meals.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3 italic">No meals yet. Click "Add meal".</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
