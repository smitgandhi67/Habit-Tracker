import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const BASE = import.meta.env.VITE_API_BASE_URL || '';

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// One-shot backfill: if user's stored tz differs from the browser's current tz,
// PUT the new one. Server validates IANA format. Failures are non-fatal.
async function syncTimezone(user, setUser) {
  if (!user) return;
  const tz = browserTimezone();
  if (!tz || tz === user.timezone) return;
  try {
    const res = await fetch(`${BASE}/api/auth/timezone`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    });
    if (res.ok) {
      const { timezone } = await res.json();
      setUser(prev => prev ? { ...prev, timezone } : prev);
    }
  } catch {
    /* non-fatal */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        setUser(u);
        if (u) syncTimezone(u, setUser);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (googleCredential) => {
    const res = await fetch(`${BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential: googleCredential }),
    });
    if (!res.ok) throw new Error('Login failed');
    const u = await res.json();
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
