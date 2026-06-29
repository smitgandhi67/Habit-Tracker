import { apiFetch } from '../api';

// Fetch the §6 activity library, optionally filtered by domain / tier / age / kind.
export function listActivities({ domain, tier, age, kind } = {}) {
  const qs = new URLSearchParams();
  if (domain) qs.set('domain', domain);
  if (tier) qs.set('tier', String(tier));
  if (age != null && age !== '') qs.set('age', String(age));
  if (kind) qs.set('kind', kind);
  const q = qs.toString();
  return apiFetch(`/api/capabilities/activities${q ? `?${q}` : ''}`).then(r => r.activities || []);
}
