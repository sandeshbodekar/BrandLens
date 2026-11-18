import { Eye } from 'lucide-react';

// History tab: every version of the draft, newest first. Clicking "View" opens that
// version read-only on the review page. `versions` comes from GET /api/drafts/:id
// (version number, note, createdAt; the text is not included).
export default function VersionList({ versions, currentVersion, viewing, onView }) {
  const list = [...versions].sort((a, b) => b.version - a.version);
  return (
    <ol className="space-y-2" aria-label="Version history">
      {list.map((v) => {
        const isCurrent = v.version === currentVersion;
        const isViewing = v.version === viewing;
        return (
          <li
            key={v.version}
            className={`flex flex-wrap items-center gap-3 rounded-lg border bg-white px-4 py-3 ${isViewing ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Version {v.version}
                {isCurrent && (
                  <span className="ml-2 rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900 ring-1 ring-inset ring-teal-300">Current</span>
                )}
              </p>
              <p className="truncate text-xs text-slate-600">{v.note || 'No note'}</p>
              <p className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString()}</p>
            </div>
            <button
              type="button"
              onClick={() => onView(v.version)}
              disabled={isViewing}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-default disabled:opacity-60 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900"
            >
              <Eye size={14} aria-hidden="true" /> {isViewing ? 'Viewing' : 'View'}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
