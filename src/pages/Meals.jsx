import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, subDays, isToday, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, BookOpen, Pencil, AlertTriangle } from 'lucide-react';
import { useMealPlan } from '../hooks/useMealPlan';
import MealSlotCard from '../components/MealSlotCard';
import { HabitListSkeleton } from '../components/Skeleton';
import { MEAL_SLOTS } from '../lib/mealLogs';

function sortedMeals(day) {
  if (!day?.meals) return [];
  const slotOrder = Object.fromEntries(MEAL_SLOTS.map((s, i) => [s, i]));
  return [...day.meals].sort((a, b) => {
    const so = (slotOrder[a.slot] ?? 99) - (slotOrder[b.slot] ?? 99);
    if (so !== 0) return so;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

export default function Meals() {
  const [date, setDate] = useState(startOfDay(new Date()));
  const { activePlan, loading, dayForDate, logsFor, setStatus } = useMealPlan();

  // Reset to today when first switching to this page.
  useEffect(() => { /* no-op — date is already today on mount */ }, []);

  if (loading) {
    return <div className="p-4 pt-8 max-w-lg mx-auto"><HabitListSkeleton /></div>;
  }

  if (!activePlan) {
    return (
      <div className="p-4 pt-12 max-w-lg mx-auto text-center">
        <p className="text-5xl mb-4">🥗</p>
        <p className="font-semibold text-slate-700 text-lg">No active meal plan</p>
        <p className="text-sm text-slate-500 mt-2 mb-6">Pick one from the library and start tracking your meals.</p>
        <Link
          to="/meals/library"
          className="inline-flex items-center gap-2 bg-violet-600 text-white font-medium px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors"
        >
          <BookOpen size={16} />
          Browse meal plans
        </Link>
      </div>
    );
  }

  const resolved = dayForDate(date);
  const day      = resolved?.day;
  const meals    = sortedMeals(day);
  const dayLogs  = logsFor(date);

  const totalSlots = meals.length;
  const doneSlots  = meals.filter(m => dayLogs[m.slot]?.status === 'done').length;
  const adherence  = totalSlots === 0 ? 0 : Math.round((doneSlots / totalSlots) * 100);
  const onToday    = isToday(date);

  return (
    <div className="p-4 max-w-lg mx-auto pb-12">
      {/* Date pill */}
      <div className="pt-4 mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(d => subDays(d, 1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{format(date, 'EEEE')}</p>
            <h1 className="text-2xl font-bold text-slate-800 leading-tight">{format(date, 'MMMM d, yyyy')}</h1>
          </div>
          <button
            onClick={() => setDate(d => addDays(d, 1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        {!onToday && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => setDate(startOfDay(new Date()))}
              className="text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1 rounded-full transition-colors"
            >
              Go to today
            </button>
          </div>
        )}
      </div>

      {/* Plan header */}
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Meal plan</p>
            <p className="font-semibold text-slate-800 truncate">{activePlan.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Day {resolved?.dayIndex ?? '—'} of {resolved?.dayCount ?? activePlan.cycleLength}
              {day?.label ? ` · ${day.label}` : ''}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Link
              to="/meals/library"
              className="p-2 rounded-xl text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
              title="Library"
            >
              <BookOpen size={16} />
            </Link>
            <Link
              to={`/meals/${activePlan._id}/edit`}
              className="p-2 rounded-xl text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
              title="Edit plan"
            >
              <Pencil size={16} />
            </Link>
          </div>
        </div>

        {totalSlots > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500">Logged today</p>
              <p className="text-xs font-semibold text-slate-700">{doneSlots} / {totalSlots} · {adherence}%</p>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${adherence}%` }}
              />
            </div>
          </div>
        )}

        {day && (day.totalCalories || day.totalProtein) && (
          <div className="flex gap-2 mt-3 text-xs text-slate-600">
            {day.totalCalories != null && (
              <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">~{day.totalCalories} kcal</span>
            )}
            {day.totalProtein != null && (
              <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-medium">~{day.totalProtein}g protein</span>
            )}
          </div>
        )}

        {day?.flag && (
          <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>{day.flag}</span>
          </div>
        )}
      </div>

      {/* Meal slots */}
      {totalSlots === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-semibold text-slate-600">No meals for this day</p>
          <p className="text-sm mt-1">This plan day is empty — edit the plan to add meals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meals.map(m => (
            <MealSlotCard
              key={`${m.slot}-${m.order ?? 0}`}
              meal={m}
              log={dayLogs[m.slot]}
              onChange={(fields) => setStatus(date, m.slot, fields)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
