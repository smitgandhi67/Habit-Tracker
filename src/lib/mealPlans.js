import { apiFetch } from './api';

// MealPlan API client. Pairs with server/routes/meal-plans.js.
// All endpoints assume the user is authenticated (cookie-based).

export function listMealPlans({ includeArchived = false } = {}) {
  const qs = includeArchived ? '?includeArchived=true' : '';
  return apiFetch(`/api/meal-plans${qs}`);
}

export function getMealPlan(id) {
  return apiFetch(`/api/meal-plans/${id}`);
}

export function createMealPlan(body) {
  return apiFetch('/api/meal-plans', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
}

export function updateMealPlan(id, body) {
  return apiFetch(`/api/meal-plans/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(body),
  });
}

export function cloneMealPlan(id) {
  return apiFetch(`/api/meal-plans/${id}/clone`, { method: 'POST' });
}

export function archiveMealPlan(id) {
  return apiFetch(`/api/meal-plans/${id}`, { method: 'DELETE' });
}

export function unarchiveMealPlan(id) {
  return apiFetch(`/api/meal-plans/${id}/unarchive`, { method: 'POST' });
}
