import { AlertOctagon, CheckCircle2, Cpu, Info, Lock, PencilLine, Send, Sparkles, WifiOff } from 'lucide-react';

// One status area for the review screen. It replaces three stacked bars (AI disclosure,
// summary, red "pending" warning) with one panel of three rows:
//   1. Summary       "8 findings · 5 high · 3 medium"      + the review mode chip
//   2. Blocking state "Resolve 5 high findings before submission"  (red ONLY when it needs action)
//   3. The AI-use disclosure (SRS 9), as one small line
// Every state has an icon and words, so colour is never the only signal.

function summaryParts(findings, status) {
  if (findings.length === 0) return { main: status === 'draft' ? 'Not reviewed yet' : 'No findings', detail: '' };
  const count = (k, v) => findings.filter((f) => f[k] === v).length;
  const buckets = [
    [count('severity', 'high'), 'high'],
    [count('severity', 'medium'), 'medium'],
    [count('severity', 'low'), 'low'],
  ]
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`);
  const main = [`${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`, ...buckets].join(' · ');
  const decisions = [
    [count('decision', 'pending'), 'pending'],
    [count('decision', 'accepted'), 'accepted'],
    [count('decision', 'edited'), 'edited'],
    [count('decision', 'dismissed'), 'dismissed'],
  ]
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(' · ');
  return { main, detail: decisions };
}

// What the user has to do (or wait for) next. `tone` decides the colour; only "action" is red.
function blockingState({ findings, status, role, isAuthor, viewingOld, lastApproval }) {
  if (viewingOld) return { tone: 'neutral', Icon: Info, text: 'Viewing an older version. There is nothing to resolve here.' };
  if (status === 'approved') {
    return { tone: 'done', Icon: Lock, text: `Approved. This draft is read-only.${lastApproval?.note ? ` Reviewer note: ${lastApproval.note}` : ''}` };
  }
  if (status === 'submitted') {
    return isAuthor
      ? { tone: 'waiting', Icon: Lock, text: 'Submitted. Waiting for a reviewer, so editing is locked.' }
      : { tone: 'waiting', Icon: Send, text: 'Submitted. Waiting for your decision below.' };
  }
  if (status === 'changes_requested') {
    return isAuthor
      ? { tone: 'waiting', Icon: PencilLine, text: 'Changes requested. Edit the text, run the review again, then resubmit.' }
      : { tone: 'waiting', Icon: PencilLine, text: 'Changes requested. Waiting for the creator to resubmit.' };
  }
  if (status === 'draft' && findings.length === 0) {
    return { tone: 'neutral', Icon: Info, text: isAuthor ? 'Run review to check this version.' : 'This draft has not been reviewed yet.' };
  }
  const pendingHigh = findings.filter((f) => f.severity === 'high' && f.decision === 'pending').length;
  if (pendingHigh > 0) {
    return {
      tone: 'action',
      Icon: AlertOctagon,
      text: `Resolve ${pendingHigh} high ${pendingHigh === 1 ? 'finding' : 'findings'} before submission`,
    };
  }
  if (role === 'creator') return { tone: 'done', Icon: CheckCircle2, text: 'Ready to submit. No high severity findings are pending.' };
  return { tone: 'neutral', Icon: CheckCircle2, text: 'No high severity findings are pending.' };
}

const TONE = {
  action: 'border-red-300 bg-red-50 text-red-900 font-semibold',
  done: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  waiting: 'border-violet-300 bg-violet-50 text-violet-950',
  neutral: 'border-slate-200 bg-slate-50 text-slate-800',
};

// `mode` is the mode of the last review run in THIS session ('ai+rules' | 'rules-only' | null).
// The server does not store it, so after a page reload we can only describe the setting.
function modeChip({ mode, rulesOnlyWorkspace }) {
  if (rulesOnlyWorkspace) return { label: 'Rules-only mode', Icon: Cpu, cls: 'bg-slate-800 text-white', hint: 'An admin switched AI off for this workspace.' };
  if (mode === 'rules-only') return { label: 'Rules-only fallback', Icon: WifiOff, cls: 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-400', hint: 'AI was unavailable on the last run. Run the review again to retry.' };
  if (mode === 'ai+rules') return { label: 'AI + rules', Icon: Sparkles, cls: 'bg-teal-100 text-teal-950 ring-1 ring-inset ring-teal-400', hint: 'The last run used the rule checks and the AI review.' };
  return { label: 'AI + rules enabled', Icon: Sparkles, cls: 'bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-300', hint: 'AI review is switched on for this workspace.' };
}

export default function ReviewStatusPanel({ findings, status, role, viewingOld, mode, rulesOnlyWorkspace, lastApproval }) {
  const isAuthor = role === 'creator' || role === 'admin';
  const summary = summaryParts(findings, status);
  const block = blockingState({ findings, status, role, isAuthor, viewingOld, lastApproval });
  const chip = modeChip({ mode, rulesOnlyWorkspace });

  return (
    <section aria-label="Review status" aria-live="polite" className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <p className="text-base font-semibold text-slate-900">{summary.main}</p>
        {summary.detail && <p className="text-sm text-slate-600">{summary.detail}</p>}
        <span
          title={chip.hint}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${chip.cls}`}
        >
          <chip.Icon size={13} aria-hidden="true" />
          {chip.label}
        </span>
      </div>

      <div className={`mx-4 mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${TONE[block.tone]}`}>
        <block.Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{block.text}</span>
      </div>

      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        AI-assisted review. Draft text is sent to an external AI service with emails and phone numbers masked. Admins can
        switch to rules-only mode.
      </p>
    </section>
  );
}
