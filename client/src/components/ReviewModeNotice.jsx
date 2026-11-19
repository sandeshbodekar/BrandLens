import { WifiOff, ListChecks } from 'lucide-react';

// Says plainly how the last review was produced, so nobody has to guess.
//   mode     'ai+rules' | 'rules-only'   (from POST /api/drafts/:id/review)
//   reason   why the AI step did not run: 'disabled' means an admin switched AI off,
//            anything else (rate_limited, overloaded, timeout, auth, ...) is a failure
//   message  the server's one-sentence explanation of that reason
//
// Shows nothing when the AI took part.
export default function ReviewModeNotice({ mode, reason, message }) {
  if (mode !== 'rules-only') return null;

  // Rules only by choice: not an error, so no warning colours.
  if (reason === 'disabled') {
    return (
      <div role="status" className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-900">
        <ListChecks size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Reviewed by rules.</strong> {message || 'AI mode is switched off, so this review uses the rule checks only.'}
        </span>
      </div>
    );
  }

  // The AI was expected but could not run.
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <strong>AI review unavailable.</strong> {message || 'The AI service could not be used.'} This result is
        from the rule checks only ("Reviewed by rules"). Wait a minute and click Run review again to include the AI check.
      </span>
    </div>
  );
}

// Text for the small chip in the summary bar.
export function modeChipLabel(mode, reason) {
  if (mode === 'ai+rules') return 'AI + rules';
  return reason === 'disabled' ? 'Reviewed by rules' : 'Reviewed by rules (AI unavailable)';
}
