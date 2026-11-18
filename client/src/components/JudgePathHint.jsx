import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, X } from 'lucide-react';

const KEY = 'brandlens_judge_hint_dismissed';

function wasDismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

// A one-line, dismissible hint for first-time users (and judges). `sampleId` is the id of
// the "Summer launch post" draft when it is in the list, so the title can be a link.
export default function JudgePathHint({ sampleId }) {
  const [hidden, setHidden] = useState(wasDismissed);
  if (hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* storage blocked: it only stays hidden until the next reload */
    }
    setHidden(true);
  }

  const title = '“Summer launch post”';
  return (
    <div role="note" className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <Compass size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Try the full workflow:</span> open{' '}
        {sampleId ? (
          <Link to={`/drafts/${sampleId}`} className="font-medium underline focus:outline focus:outline-2 focus:outline-sky-900">
            {title}
          </Link>
        ) : (
          title
        )}{' '}
        → Run review → resolve findings → submit for approval.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss this hint"
        className="rounded p-1 text-sky-900 hover:bg-sky-100 focus:outline focus:outline-2 focus:outline-sky-900"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
