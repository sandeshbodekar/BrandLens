import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../api.js';

const LABELS = {
  draft_created: 'Draft created',
  review_run: 'Review run',
  version_saved: 'New version saved',
  fixes_applied: 'Fixes applied',
  finding_decided: 'Finding decided',
  draft_submitted: 'Submitted for approval',
  draft_approved: 'Approved',
  changes_requested: 'Changes requested',
  comment_added: 'Comment added',
};

// One short line of detail from the row's meta (counts, version, note).
function detail(row) {
  const m = row.meta || {};
  switch (row.action) {
    case 'review_run':
      return `Version ${m.version}: ${m.findings ?? 0} findings (${m.high ?? 0} high), ${m.mode}${m.dropped ? `, ${m.dropped} dropped` : ''}${m.message ? `. ${m.message}` : ''}`;
    case 'version_saved':
      return `Version ${m.version}`;
    case 'fixes_applied':
      return `${m.applied} applied, version ${m.version}`;
    case 'finding_decided':
      return `${m.severity} finding ${m.decision}${m.reason ? `: ${m.reason}` : ''}`;
    case 'draft_submitted':
      return `Version ${m.version}`;
    case 'draft_approved':
    case 'changes_requested':
      return m.note ? `Version ${m.version}. Note: ${m.note}` : `Version ${m.version}`;
    case 'comment_added':
      return `On version ${m.version}`;
    default:
      return '';
  }
}

// History tab, below the version list. `refreshKey` changes after every action on the
// draft (the page passes draft.updatedAt), which loads the trail again.
export default function AuditTrail({ draftId, refreshKey }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api
      .get(`/api/drafts/${draftId}/audit`)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [draftId, refreshKey]);

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">Audit trail</h3>
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          Could not load the audit trail: {error}
        </p>
      )}
      {!error && rows === null && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading…
        </p>
      )}
      {rows && rows.length === 0 && <p className="text-sm text-slate-600">No activity recorded yet.</p>}
      {rows && rows.length > 0 && (
        <ol className="space-y-2" aria-label="Audit trail">
          {rows.map((r) => (
            <li key={r._id} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5">
              <p className="text-sm font-medium text-slate-900">
                {LABELS[r.action] || r.action}
                <span className="font-normal text-slate-600"> by {r.actorId?.name || 'unknown user'}</span>
              </p>
              {detail(r) && <p className="text-xs text-slate-600">{detail(r)}</p>}
              <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
