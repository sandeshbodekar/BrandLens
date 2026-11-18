import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, ChevronRight, AlertOctagon, AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusPill from '../components/StatusPill.jsx';
import JudgePathHint from '../components/JudgePathHint.jsx';

const STATUSES = [
  ['', 'All statuses'],
  ['draft', 'Draft'],
  ['checked', 'Checked'],
  ['submitted', 'Submitted'],
  ['approved', 'Approved'],
  ['changes_requested', 'Changes requested'],
];
const TYPE_LABEL = { post: 'Post', ad: 'Ad', email: 'Email', document: 'Document' };

// "Updated 2 hours ago". The exact time is in the tooltip.
function timeAgo(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (seconds < 3600) return plural(Math.floor(seconds / 60), 'minute');
  if (seconds < 86400) return plural(Math.floor(seconds / 3600), 'hour');
  if (seconds < 7 * 86400) return plural(Math.floor(seconds / 86400), 'day');
  return `on ${new Date(value).toLocaleDateString()}`;
}

// What needs doing on this draft. Every state has an icon AND words (not colour alone);
// only a pending HIGH finding is red, so the draft that needs attention stands out.
function attention(d) {
  const c = d.findingCounts || { total: 0, pending: 0, pendingHigh: 0 };
  if (c.total === 0) {
    return d.status === 'draft'
      ? { label: 'Not reviewed yet', Icon: CircleDashed, cls: 'text-slate-600', urgent: false }
      : { label: 'No findings', Icon: CheckCircle2, cls: 'text-emerald-800', urgent: false };
  }
  if (c.pendingHigh > 0) {
    return { label: `${c.pendingHigh} high pending`, Icon: AlertOctagon, cls: 'font-semibold text-red-800', urgent: true };
  }
  if (c.pending > 0) return { label: `${c.pending} pending`, Icon: AlertTriangle, cls: 'text-amber-900', urgent: false };
  return { label: 'All resolved', Icon: CheckCircle2, cls: 'text-emerald-800', urgent: false };
}

export default function DraftList() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [sampleId, setSampleId] = useState(null); // id of "Summer launch post", for the hint link

  useEffect(() => {
    let cancelled = false;
    setDrafts(null);
    setError('');
    api
      .get(`/api/drafts${status ? `?status=${status}` : ''}`)
      .then((rows) => {
        if (cancelled) return;
        setDrafts(rows);
        const sample = rows.find((d) => d.title === 'Summer launch post');
        if (sample) setSampleId(sample._id);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [status]);

  const statusLabel = STATUSES.find(([value]) => value === status)?.[1] || status;

  return (
    <div className="space-y-4">
      <JudgePathHint sampleId={sampleId} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{user?.role === 'admin' ? 'All drafts' : 'My drafts'}</h1>
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

      <div aria-live="polite">
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
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            {status ? (
              <>
                <p className="text-slate-800">No drafts with status “{statusLabel}”.</p>
                <button type="button" onClick={() => setStatus('')} className="mt-2 text-sm font-medium text-teal-800 underline">
                  Show all drafts
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-800">You have no drafts yet.</p>
                <Link to="/drafts/new" className="mt-2 inline-block text-sm font-medium text-teal-800 underline">
                  Create your first draft
                </Link>
              </>
            )}
          </div>
        )}
        {drafts && drafts.length > 0 && (
          <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {drafts.map((d, i) => {
              const a = attention(d);
              return (
                <li key={d._id} className={i > 0 ? 'border-t border-slate-200' : ''}>
                  <Link
                    to={`/drafts/${d._id}`}
                    className={`group flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 px-4 py-3.5 hover:bg-slate-50 focus:bg-slate-50 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-slate-900 ${
                      a.urgent ? 'border-l-red-600' : 'border-l-transparent'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 group-hover:underline">{d.title}</span>
                      <span className="block text-xs text-slate-500">
                        {TYPE_LABEL[d.contentType] || d.contentType} · version {d.currentVersion} ·{' '}
                        <span title={new Date(d.updatedAt).toLocaleString()}>Updated {timeAgo(d.updatedAt)}</span>
                      </span>
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-sm ${a.cls}`}>
                      <a.Icon size={15} aria-hidden="true" />
                      {a.label}
                    </span>
                    <StatusPill status={d.status} />
                    <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-700" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
