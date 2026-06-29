import { apiFetch } from '../api';

// Per-kid system of record (Day 7). childUserId omitted = the caller's own profile
// (kids get the read-only view; parents/admins get the full dashboard).
export function getDashboard({ childUserId } = {}) {
  const qs = childUserId ? `?childUserId=${encodeURIComponent(childUserId)}` : '';
  return apiFetch(`/api/capabilities/dashboard${qs}`);
}
