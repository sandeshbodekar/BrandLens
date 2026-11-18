import { Sparkles } from 'lucide-react';

// SRS 9: AI-use disclosure. `rulesOnly` is true when the workspace has AI switched off.
export default function DisclosureBanner({ rulesOnly }) {
  return (
    <div role="note" className="flex flex-wrap items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
      <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        AI-assisted review. Draft text is sent to an external AI service with emails and phone numbers masked. Admins can
        switch to rules-only mode.
      </p>
      {rulesOnly && (
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">Rules-only mode</span>
      )}
    </div>
  );
}
