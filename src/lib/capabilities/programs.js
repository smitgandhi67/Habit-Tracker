// Client API for the Depth Pack training engine (mirrors server/routes/capabilityPrograms.js).
import { apiFetch } from '../api';

export const listPacks = () => apiFetch('/api/capabilities/programs/packs');
export const listPrograms = ({ childId } = {}) =>
  apiFetch(`/api/capabilities/programs${childId ? `?childId=${childId}` : ''}`);
export const enrollProgram = ({ childId, packKey, points }) =>
  apiFetch('/api/capabilities/programs', { method: 'POST', body: JSON.stringify({ childId, packKey, points }) });
export const patchProgram = (id, body) =>
  apiFetch(`/api/capabilities/programs/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const putMeasure = (id, week, body) =>
  apiFetch(`/api/capabilities/programs/${id}/measures/${week}`, { method: 'PUT', body: JSON.stringify(body) });
export const getMeasures = (id) => apiFetch(`/api/capabilities/programs/${id}/measures`);
