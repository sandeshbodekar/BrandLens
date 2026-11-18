import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import StatusPill from '../components/StatusPill.jsx';

const STATUSES = [
  ['', 'All statuses'],
  ['draft', 'Draft'],
  ['checked', 'Checked'],
  ['submitted', 'Submitted'],
  ['approved', 'Approved'],
  ['changes_requested', 'Changes requested'],
];
const TYPE_LABEL = { post: 'Post', ad: 'Ad', email: 'Email', document: 'Document' };

export default function DraftList() {
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState(null); // null = loading
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDrafts(null);
    setError('');
    api
      .get(`/api/drafts${status ? `?status=${status}` : ''}`)
      .then((rows) => !cancelled && setDrafts(rows))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">My drafts</h1>
        <div className="ml-auto flex items-center gap-3">
          <label className="sr-only" htmlFor="status-filter">Filter by status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-slate-900"
          >
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Link
            to="/drafts/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
          >
            <Plus size={16} aria-hidden="true" /> New draft
          </Link>
        </div>
      </div>

      <div className="mt-6" aria-live="polite">
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            Could not load drafts: {error}
          </p>
        )}
        {!error && drafts === null && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading drafts…
          </p>
        )}
        {drafts && drafts.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
            <p className="text-slate-800">{status ? 'No drafts with this status.' : 'You have no drafts yet.'}</p>
            {!status && (
              <Link to="/drafts/new" className="mt-2 inline-block text-sm font-medium text-teal-800 underline">
                Create your first draft
              </Link>
            )}
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
                  <span className="w-28 text-right text-xs text-slate-500">
                    {new Date(d.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
