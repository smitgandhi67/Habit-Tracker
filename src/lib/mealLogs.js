import { apiFetch } from './api';

// MealLog API client. Pairs with server/routes/meal-logs.js.

export function batchMealLogs({ planId, dates }) {
  const params = new URLSearchParams({ planId, dates: dates.join(',') });
  return apiFetch(`/api/meal-logs/batch?${params.toString()}`);
}

export function getMealLogs({ planId, date }) {
  const params = new URLSearchParams({ planId, date });
  return apiFetch(`/api/meal-logs?${params.toString()}`);
}

export function setMealLog({ planId, date, slot, status, swapNote }) {
  const body = { planId, date, slot };
  if (status   !== undefined) body.status   = status;
  if (swapNote !== undefined) body.swapNote = swapNote;
  return apiFetch('/api/meal-logs', {
    method: 'PUT',
    body:   JSON.stringify(body),
  });
}

export const MEAL_SLOTS = ['early_am', 'breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'bed'];

export const SLOT_LABELS = {
  early_am:    'Early AM',
  breakfast:   'Breakfast',
  mid_morning: 'Mid-morning',
  lunch:       'Lunch',
  snack:       'Snack',
  dinner:      'Dinner',
  bed:         'Bedtime',
};
