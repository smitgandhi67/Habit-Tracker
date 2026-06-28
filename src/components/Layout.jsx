import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarDays, ListChecks, BarChart2, Dumbbell, Moon, Utensils, Calculator, Lightbulb, ShieldCheck, LogOut, Star, HeartHandshake, Trophy, Map, Brain } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const NAV = [
  { to: '/today',   icon: CalendarDays, label: 'Today'   },
  { to: '/habits',  icon: ListChecks,   label: 'Habits'  },
  { to: '/meals',   icon: Utensils,     label: 'Meals'   },
  { to: '/math',    icon: Calculator,   label: 'Math'    },
  { to: '/build',   icon: Lightbulb,    label: 'Build'   },
  { to: '/gym',     icon: Dumbbell,     label: 'Gym'     },
  { to: '/sleep',   icon: Moon,         label: 'Sleep'   },
  { to: '/reports', icon: BarChart2,    label: 'Reports' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [balance, setBalance] = useState(null);
  const location = useLocation();

  // Keep the points badge fresh: refetch on mount and whenever the route changes
  // (covers approve/redeem actions that happen on other pages). Failures hide it.
  useEffect(() => {
    let cancelled = false;
    // /api/math/state requires the kid's local date (same as the Math page); without it
    // the request 400s and the points badge silently never shows.
    const today = format(new Date(), 'yyyy-MM-dd');
    apiFetch(`/api/math/state?date=${today}`)
      .then(d => { if (!cancelled) setBalance(d?.balance ?? null); })
      .catch(() => { if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto relative">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pt-4 pb-1">
        {balance != null ? (
          <NavLink
            to="/math"
            className="flex items-center gap-1 rounded-full bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-sm pl-2 pr-3 py-1 transition-colors"
          >
            <Star size={15} className="fill-violet-500 text-violet-500" />
            <span className="tabular-nums">{balance}</span>
          </NavLink>
        ) : (
          <span />
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(p => !p)}
            className="flex items-center gap-2 rounded-full hover:bg-slate-100 p-1 pr-2 transition-colors"
          >
            {user?.photo ? (
              <img src={user.photo} alt={user.name} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center text-violet-700 font-bold text-sm">
                {user?.name?.[0] ?? '?'}
              </div>
            )}
            <span className="text-sm text-slate-600 font-medium hidden sm:block">{user?.name}</span>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-xl border border-slate-100 p-1 w-44 z-50">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-semibold text-slate-700 truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <NavLink
                to="/skills"
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <Brain size={15} /> Skills
              </NavLink>
              <NavLink
                to="/trophies"
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <Trophy size={15} /> Trophies
              </NavLink>
              <NavLink
                to="/parenting"
                onClick={() => setShowMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <HeartHandshake size={15} /> Parenting
              </NavLink>
              {user?.isAdmin && (
                <NavLink
                  to="/journey/admin"
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <Map size={15} /> Roadmap
                </NavLink>
              )}
              {user?.isAdmin && (
                <NavLink
                  to="/math/admin"
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <ShieldCheck size={15} /> Parent console
                </NavLink>
              )}
              {user?.isAdmin && (
                <NavLink
                  to="/parenting/admin"
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <HeartHandshake size={15} /> Parenting console
                </NavLink>
              )}
              <button
                onClick={() => { setShowMenu(false); logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-slate-200 flex shadow-lg">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
