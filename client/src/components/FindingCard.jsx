import { forwardRef, useState } from 'react';
import { HelpCircle, Bot, Ruler, Check, Pencil, X, Loader2 } from 'lucide-react';
import SeverityBadge from './SeverityBadge.jsx';

const TYPE_LABEL = {
  tone: 'Tone',
  terminology: 'Terminology',
  claim: 'Claim',
  fact_conflict: 'Fact conflict',
  outdated_fact: 'Outdated fact',
  legal: 'Legal',
  other: 'Other',
};

// A source chip: clause or fact code. Hover or keyboard focus shows what it says.
function SourceChip({ code, source }) {
  return (
    <span className="group relative inline-block">
      <button
        type="button"
        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus:outline focus:outline-2 focus:outline-slate-900"
        aria-label={source ? `${code}: ${source.title}. ${source.text}` : code}
      >
        {code}
      </button>
      {source && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded-md bg-slate-900 p-2 text-xs font-normal leading-5 text-white shadow-lg group-hover:block group-focus-within:block"
        >
          {source.title && <strong className="block">{source.title}</strong>}
          {source.text}
        </span>
      )}
    </span>
  );
}

const btn =
  'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

// One finding. `onDecide(findingId, { decision, editedSuggestion?, reason? })` returns a
// promise that rejects with an Error whose message is shown on the card.
// `canDecide` is false for reviewers, old versions and locked drafts (read-only card).
const FindingCard = forwardRef(function FindingCard({ finding, index, selected, onSelect, sources, canDecide, onDecide }, ref) {
  const f = finding;
  const needsJudgement = f.confidence < 0.5;
  const [mode, setMode] = useState(null); // null | 'edit' | 'dismiss'
  const [changing, setChanging] = useState(false); // re-opening the buttons of a decided card
  const [editValue, setEditValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const decided = f.decision !== 'pending';
  const showActions = canDecide && (!decided || changing);
  const reasonRequired = f.severity === 'high';

  async function decide(payload) {
    setBusy(true);
    setError('');
    try {
      await onDecide(f._id, payload);
      setMode(null);
      setChanging(false);
      setReason('');
    } catch (err) {
      setError(err.message || 'Could not save the decision');
    } finally {
      setBusy(false);
    }
  }

  function openEdit() {
    setEditValue(f.editedSuggestion ?? f.suggestion ?? '');
    setError('');
    setMode('edit');
  }
  function openDismiss() {
    setReason(f.decisionReason || '');
    setError('');
    setMode('dismiss');
  }

  const decisionLine = {
    accepted: { Icon: Check, cls: 'bg-emerald-50 text-emerald-900 ring-emerald-300', text: 'Accepted' },
    edited: { Icon: Pencil, cls: 'bg-sky-50 text-sky-900 ring-sky-300', text: 'Edited' },
    dismissed: { Icon: X, cls: 'bg-slate-100 text-slate-700 ring-slate-300', text: 'Dismissed' },
  }[f.decision];

  return (
    <article
      ref={ref}
      id={`card-${f._id}`}
      onClick={() => onSelect(f._id, 'card')}
      aria-current={selected ? 'true' : undefined}
      className={`rounded-lg border p-4 ${
        selected ? 'border-teal-700 border-l-8 bg-teal-50 shadow-lg ring-2 ring-teal-600' : 'border-slate-200 bg-white shadow-sm'
      } ${f.decision === 'dismissed' && !selected ? 'opacity-80' : ''}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
        <SeverityBadge severity={f.severity} />
        <span className="text-xs font-medium text-slate-600">{TYPE_LABEL[f.type] || f.type}</span>
        {decisionLine && (
          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${decisionLine.cls}`}>
            <decisionLine.Icon size={12} aria-hidden="true" />
            {decisionLine.text}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
          {f.origin === 'ai' ? <Bot size={12} aria-hidden="true" /> : <Ruler size={12} aria-hidden="true" />}
          {f.origin === 'ai' ? 'AI check' : 'Rule check'}
        </span>
      </header>

      <blockquote className="mt-3 border-l-4 border-slate-300 pl-3 text-sm italic text-slate-800 whitespace-pre-wrap break-words">
        {f.quote}
      </blockquote>

      <p className="mt-3 text-sm text-slate-700">{f.explanation}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Source</span>
        {f.clauseCode && <SourceChip code={f.clauseCode} source={sources[f.clauseCode]} />}
        {f.factCode && <SourceChip code={f.factCode} source={sources[f.factCode]} />}
        {needsJudgement ? (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-300">
            <HelpCircle size={12} aria-hidden="true" />
            Needs human judgement
          </span>
        ) : (
          <span className="text-xs text-slate-500">Confidence {Math.round(f.confidence * 100)}%</span>
        )}
      </div>

      <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
        <span className="font-medium">Suggested fix: </span>
        {f.suggestion ? (
          <span className="whitespace-pre-wrap break-words">{f.suggestion}</span>
        ) : (
          <span>Remove this text, or back it with an approved fact.</span>
        )}
      </div>

      {/* The decision that was made, so a read-only card still tells the story. */}
      {f.decision === 'edited' && (
        <p className="mt-2 text-sm text-slate-800">
          <span className="font-medium">Your edit: </span>
          {f.editedSuggestion ? <span className="whitespace-pre-wrap break-words">{f.editedSuggestion}</span> : <span>Remove this text.</span>}
        </p>
      )}
      {f.decision === 'dismissed' && (
        <p className="mt-2 text-sm text-slate-800">
          <span className="font-medium">Reason: </span>
          {f.decisionReason || <span className="text-slate-500">No reason given</span>}
        </p>
      )}

      {showActions && mode === null && (
        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <button type="button" disabled={busy} onClick={() => decide({ decision: 'accepted' })} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-600`}>
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Accept
          </button>
          <button type="button" disabled={busy} onClick={openEdit} className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
            <Pencil size={14} aria-hidden="true" /> Edit
          </button>
          <button type="button" disabled={busy} onClick={openDismiss} className={`${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
            <X size={14} aria-hidden="true" /> Dismiss
          </button>
          {changing && (
            <button type="button" onClick={() => setChanging(false)} className="text-sm text-slate-600 underline">
              Cancel
            </button>
          )}
        </div>
      )}

      {showActions && mode === 'edit' && (
        <form
          className="mt-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            decide({ decision: 'edited', editedSuggestion: editValue });
          }}
        >
          <label htmlFor={`edit-${f._id}`} className="text-sm font-medium text-slate-800">
            Replace “{f.quote.length > 40 ? `${f.quote.slice(0, 40)}…` : f.quote}” with
          </label>
          <input
            id={`edit-${f._id}`}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            maxLength={2000}
            autoFocus
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-slate-900"
          />
          <p className="text-xs text-slate-500">Leave it empty to remove the text.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${btn} bg-slate-900 text-white hover:bg-slate-700`}>
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Save edit
            </button>
            <button type="button" disabled={busy} onClick={() => setMode(null)} className={`${btn} text-slate-700 underline`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {showActions && mode === 'dismiss' && (
        <form
          className="mt-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (reasonRequired && !reason.trim()) return;
            decide({ decision: 'dismissed', ...(reason.trim() ? { reason: reason.trim() } : {}) });
          }}
        >
          <label htmlFor={`reason-${f._id}`} className="text-sm font-medium text-slate-800">
            Reason {reasonRequired ? '(required for high severity)' : '(optional)'}
          </label>
          <input
            id={`reason-${f._id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            autoFocus
            required={reasonRequired}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-slate-900"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || (reasonRequired && !reason.trim())} className={`${btn} bg-slate-900 text-white hover:bg-slate-700`}>
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Dismiss finding
            </button>
            <button type="button" disabled={busy} onClick={() => setMode(null)} className={`${btn} text-slate-700 underline`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {canDecide && decided && !changing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMode(null);
            setChanging(true);
          }}
          className="mt-2 text-sm text-slate-600 underline focus:outline focus:outline-2 focus:outline-slate-900"
        >
          Change decision
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}
    </article>
  );
});

export default FindingCard;
