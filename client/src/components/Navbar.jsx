import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext.jsx';

// SRS 9 routes table decides who sees what.
const NAV_ITEMS = [
  {
    to: '/drafts',
    label: 'Drafts',
    roles: ['creator', 'admin'],
    // "/drafts/new" has its own item, so don't highlight both.
    isActive: (p) => p.startsWith('/drafts') && p !== '/drafts/new',
  },
  {
    to: '/drafts/new',
    label: 'New draft',
    roles: ['creator', 'admin'],
    isActive: (p) => p === '/drafts/new',
  },
  {
    to: '/queue',
    label: 'Review queue',
    roles: ['reviewer', 'admin'],
    isActive: (p) => p.startsWith('/queue'),
  },
  {
    to: '/knowledge',
    label: 'Knowledge',
    roles: ['admin', 'creator', 'reviewer'], // everyone can read; only admin writes
    isActive: (p) => p.startsWith('/knowledge'),
  },
];

export default function Navbar() {
  const { user, workspace, logout } = useAuth();
  const { pathname } = useLocation();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            to={homeFor(user.role)}
            className="rounded text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            BrandLens
          </Link>
          <ul className="flex flex-wrap items-center gap-1">
            {items.map((item) => {
              const active = item.isActive(pathname);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {workspace && (
            <span className="hidden text-slate-500 lg:inline">{workspace.name}</span>
          )}
          <span className="text-slate-800">{user.name}</span>
          {/* Role is shown as text, so colour is never the only signal. */}
          <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
            {user.role}
          </span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}
