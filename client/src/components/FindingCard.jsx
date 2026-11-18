import { forwardRef } from 'react';
import { HelpCircle, Bot, Ruler } from 'lucide-react';
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

// Phase 4 shows a finding read-only. Accept / Edit / Dismiss come in Phase 5.
const FindingCard = forwardRef(function FindingCard({ finding, index, selected, onSelect, sources }, ref) {
  const f = finding;
  const needsJudgement = f.confidence < 0.5;
  return (
    <article
      ref={ref}
      id={`card-${f._id}`}
      onClick={() => onSelect(f._id)}
      className={`rounded-lg border bg-white p-4 shadow-sm ${selected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
        <SeverityBadge severity={f.severity} />
        <span className="text-xs font-medium text-slate-600">{TYPE_LABEL[f.type] || f.type}</span>
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
    </article>
  );
});

export default FindingCard;
