import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ClipboardCheck, Loader2, PenLine, ShieldCheck } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext.jsx';

const DEMO_BUTTONS = [
  { role: 'admin', label: 'Admin', hint: 'Knowledge base and settings', Icon: ShieldCheck },
  { role: 'creator', label: 'Creator', hint: 'Write drafts and run reviews', Icon: PenLine },
  { role: 'reviewer', label: 'Reviewer', hint: 'Approve or request changes', Icon: ClipboardCheck },
];

export default function Login() {
  const { user, loading, login, demoLogin } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null); // 'login' | 'admin' | 'creator' | 'reviewer' | null
  const [error, setError] = useState('');

  // Already signed in (or just signed in): go back to where the user was headed,
  // or to the role's home page. No explicit navigate() is needed after login.
  if (!loading && user) {
    return <Navigate to={location.state?.from?.pathname || homeFor(user.role)} replace />;
  }

  async function run(key, action) {
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || loading;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">BrandLens</h1>
        <p className="mt-1 text-sm text-slate-600">Pre-publication brand governance</p>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <section aria-labelledby="demo-heading" className="mt-6">
          <h2 id="demo-heading" className="text-sm font-medium text-slate-800">
            Try demo
          </h2>
          <div className="mt-2 grid gap-2">
            {DEMO_BUTTONS.map(({ role, label, hint, Icon }) => (
              <button
                key={role}
                type="button"
                disabled={disabled}
                onClick={() => run(role, () => demoLogin(role))}
                className="flex items-center gap-3 rounded-lg border border-slate-300 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === role ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden="true" />
                ) : (
                  <Icon className="h-5 w-5 text-slate-600" aria-hidden="true" />
                )}
                <span>
                  <span className="block text-sm font-medium text-slate-900">Try demo: {label}</span>
                  <span className="block text-xs text-slate-600">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-500" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          or sign in
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run('login', () => login(email, password));
          }}
          className="grid gap-3"
        >
          <label className="grid gap-1 text-sm text-slate-800" htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-800" htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="submit"
            disabled={disabled}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'login' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy === 'login' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
