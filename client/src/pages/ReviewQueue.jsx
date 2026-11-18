import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api.js';
import StatusPill from '../components/StatusPill.jsx';

const TYPE_LABEL = { post: 'Post', ad: 'Ad', email: 'Email', document: 'Document' };

// SRS 9: submitted drafts waiting for review (reviewer, admin).
export default function ReviewQueue() {
  const [drafts, setDrafts] = useState(null); // null = loading
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/drafts?status=submitted')
      .then((rows) => !cancelled && setDrafts(rows))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Review queue</h1>
      <p className="mt-1 text-sm text-slate-600">Drafts that creators have submitted and that wait for a decision.</p>

      <div className="mt-6" aria-live="polite">
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            Could not load the queue: {error}
          </p>
        )}
        {!error && drafts === null && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading queue…
          </p>
        )}
        {drafts && drafts.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-slate-800">
            Nothing is waiting for review.
          </div>
        )}
        {drafts && drafts.length > 0 && (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {drafts.map((d) => (
              <li key={d._id}>
                <Link
                  to={`/drafts/${d._id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50 focus:bg-slate-50 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-slate-900"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{d.title}</span>
                  <span className="text-sm text-slate-600">{TYPE_LABEL[d.contentType] || d.contentType}</span>
                  <span className="text-sm text-slate-500">v{d.currentVersion}</span>
                  <StatusPill status={d.status} />
                  <span className="w-28 text-right text-xs text-slate-500">{new Date(d.updatedAt).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
