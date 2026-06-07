const BASE = import.meta.env.VITE_API_BASE_URL || '';

// Fetch the health Markdown export for [from, to] and trigger a browser
// download. Throws Error(message) on a non-OK response so callers can toast it.
// (Cannot reuse apiFetch — that helper always parses the body as JSON.)
export async function downloadHealthExport(from, to) {
  const url = `${BASE}/api/export/health?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `health-export_${from}_${to}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
