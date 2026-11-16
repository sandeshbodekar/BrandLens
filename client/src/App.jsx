import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { apiGet } from './api.js';

// Temporary Phase 0 home page. Phase 1 replaces "/" with the login flow.
function Home() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'

  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/health', { signal: controller.signal })
      .then((data) => setStatus(data.ok ? 'ok' : 'error'))
      .catch((err) => {
        // React StrictMode runs effects twice in dev; the first run is aborted
        // on purpose, so ignore that error.
        if (err.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold text-slate-900">BrandLens</h1>
        <p className="mt-1 text-sm text-slate-600">Pre-publication brand governance</p>

        <div className="mt-6 flex items-center justify-center gap-2" role="status" aria-live="polite">
          {status === 'loading' && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden="true" />
              <span className="text-slate-700">Checking API… (a sleeping server can take up to a minute)</span>
            </>
          )}
          {status === 'ok' && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
              <span className="font-medium text-green-700">API OK</span>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
              <span className="font-medium text-red-700">API unreachable</span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <Link to="/" className="text-blue-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
        Back to home
      </Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
