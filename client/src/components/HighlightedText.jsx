import { SEVERITY } from './SeverityBadge.jsx';

const DECISION_LABEL = { accepted: 'accepted', edited: 'edited', dismissed: 'dismissed', pending: 'pending' };

// Renders the draft text with each finding's [start, end) range highlighted.
// Findings never overlap (the pipeline guarantees it), but we still skip any
// range that starts inside the previous one so a bad row cannot break the page.
// Decided findings look different: dismissed ones fade, accepted/edited ones get a
// green frame. The decision is also in the aria-label, so colour is not the only signal.
export default function HighlightedText({ text, findings, selectedId, onSelect }) {
  const sorted = [...findings].sort((a, b) => a.start - b.start || a.end - b.end);
  const parts = [];
  let cursor = 0;
  sorted.forEach((f, i) => {
    if (f.start < cursor || f.end > text.length || f.end <= f.start) return;
    if (f.start > cursor) parts.push(<span key={`t${cursor}`}>{text.slice(cursor, f.start)}</span>);
    const s = SEVERITY[f.severity] || SEVERITY.low;
    const selected = f._id === selectedId;
    const decisionStyle =
      f.decision === 'dismissed'
        ? 'opacity-50 line-through'
        : f.decision === 'accepted' || f.decision === 'edited'
          ? 'ring-2 ring-emerald-600'
          : '';
    parts.push(
      <mark
        key={f._id}
        id={`hl-${f._id}`}
        role="button"
        tabIndex={0}
        aria-label={`${s.label} severity finding ${i + 1}, ${DECISION_LABEL[f.decision] || 'pending'}: ${f.quote}`}
        onClick={() => onSelect(f._id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(f._id);
          }
        }}
        className={`cursor-pointer rounded-sm px-0.5 underline decoration-2 underline-offset-2 text-inherit ${s.mark} ${decisionStyle} ${
          selected ? 'outline outline-2 outline-offset-1 outline-slate-900' : ''
        } focus:outline focus:outline-2 focus:outline-slate-900`}
      >
        {text.slice(f.start, f.end)}
        <sup className="ml-0.5 text-[10px] font-bold text-slate-700">{i + 1}</sup>
      </mark>
    );
    cursor = f.end;
  });
  if (cursor < text.length) parts.push(<span key={`t${cursor}`}>{text.slice(cursor)}</span>);

  // whitespace-pre-wrap keeps "\n" line breaks, so offsets match the stored text.
  return <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-900">{parts}</div>;
}
