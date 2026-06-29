import { apiFetch } from '../api';

// Activity tracking + cross-track domain rollup (Day 5).

// Per-domain reps across every track (default last 90 days), plus baseline age +
// quarterly re-assessment flag. childUserId omitted = the caller's own profile.
export function getRollup({ childUserId, since } = {}) {
  const qs = new URLSearchParams();
  if (childUserId) qs.set('childUserId', childUserId);
  if (since) qs.set('since', since);
  const q = qs.toString();
  return apiFetch(`/api/capabilities/rollup${q ? `?${q}` : ''}`);
}

// Recent activity reps for a child (defaults to self).
export function listActivityLogs({ childUserId, limit } = {}) {
  const qs = new URLSearchParams();
  if (childUserId) qs.set('childUserId', childUserId);
  if (limit) qs.set('limit', String(limit));
  const q = qs.toString();
  return apiFetch(`/api/capabilities/activities/log${q ? `?${q}` : ''}`).then(r => r.logs || []);
}

// Record one run of a 'do' activity for a child. date is 'YYYY-MM-DD' (kid local).
export function logActivity({ activitySlug, subjectUserId, date, note }) {
  return apiFetch('/api/capabilities/activities/log', {
    method: 'POST',
    body: JSON.stringify({ activitySlug, subjectUserId, date, note }),
  });
}

// Remove a mistaken rep.
export function deleteActivityLog(id) {
  return apiFetch(`/api/capabilities/activities/log/${id}`, { method: 'DELETE' });
}
