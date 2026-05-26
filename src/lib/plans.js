import { apiFetch } from './api';

// WorkoutPlan API client. Pairs with server/routes/plans.js.
// All endpoints assume the user is authenticated (cookie-based).

export function listPlans() {
  return apiFetch('/api/plans');
}

export function getPlan(id) {
  return apiFetch(`/api/plans/${id}`);
}

export function createPlan(body) {
  return apiFetch('/api/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updatePlan(id, body) {
  return apiFetch(`/api/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function archivePlan(id) {
  return apiFetch(`/api/plans/${id}`, { method: 'DELETE' });
}

export function unarchivePlan(id) {
  return apiFetch(`/api/plans/${id}/unarchive`, { method: 'POST' });
}
