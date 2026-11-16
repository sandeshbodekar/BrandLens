import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext.jsx';

// Usage in App.jsx:
//   <Route element={<ProtectedRoute />}>                       logged-in users only
//   <Route element={<ProtectedRoute roles={['admin']} />}>     only these roles
// This is a UX guard. The real enforcement is requireRole on the server.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) {
    // `from` lets the login page send the user back to where they were headed.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" aria-hidden="true" />
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Access denied</h1>
        <p className="mt-1 text-sm text-slate-700">
          Your role ({user.role}) cannot open this page.
        </p>
        <Link
          to={homeFor(user.role)}
          className="mt-4 inline-block rounded text-blue-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Go to your home page
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
