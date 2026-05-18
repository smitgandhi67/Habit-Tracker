import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, ListChecks, BarChart2, Dumbbell, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/today',   icon: CalendarDays, label: 'Today'   },
  { to: '/habits',  icon: ListChecks,   label: 'Habits'  },
  { to: '/reports', icon: BarChart2,    label: 'Reports' },
  { to: '/gym',     icon: Dumbbell,     label: 'Gym'     },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto relative">
      {/* Top bar */}
      <header className="flex items-center justify-end px-4 pt-4 pb-1">
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
