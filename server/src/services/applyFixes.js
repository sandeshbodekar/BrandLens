// SRS 7.5: "Apply accepted fixes". Pure function: no database, no network.
//
// Input
//   text      the text of the current version
//   findings  plain objects { quote, start, end, suggestion, decision, editedSuggestion }
// Output
//   { text, applied, skipped }   applied/skipped count findings, not characters
//
// Only findings whose decision is "accepted" or "edited" are used. An accepted
// finding is replaced by its suggestion, an edited one by editedSuggestion.
//
// Rules from the SRS:
//  - replace [start, end) in DESCENDING start order, so offsets of the ranges that
//    are still waiting stay valid while the text changes
//  - skip overlapping ranges and keep the first (the one with the lowest start)
// Extra safety: a finding whose range is outside the text, or whose quote no longer
// matches text.slice(start, end), is skipped instead of corrupting the text.
//
// An empty replacement means "remove this text" (rule findings that cannot know a
// better wording). Removing a word would leave "the  juice" or "the ." behind, so
// one neighbouring space is removed with it (see tidyRemoval).
const PUNCTUATION_AFTER = /[.,;:!?)\]\n]/;

export function applyFixes(text, findings) {
  const chosen = findings
    .filter((f) => f.decision === 'accepted' || f.decision === 'edited')
    .map((f) => ({
      start: f.start,
      end: f.end,
      quote: f.quote,
      replacement:
        f.decision === 'edited' && typeof f.editedSuggestion === 'string' ? f.editedSuggestion : f.suggestion || '',
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // Pass 1 (ascending): drop invalid and overlapping ranges, keep the first.
  const ranges = [];
  let skipped = 0;
  let lastEnd = 0;
  for (const r of chosen) {
    const valid =
      Number.isInteger(r.start) &&
      Number.isInteger(r.end) &&
      r.start >= 0 &&
      r.end > r.start &&
      r.end <= text.length &&
      (r.quote === undefined || text.slice(r.start, r.end) === r.quote);
    if (!valid || r.start < lastEnd) {
      skipped += 1;
      continue;
    }
    ranges.push({ ...r });
    lastEnd = r.end;
  }

  // Pass 2 (ascending): widen removals by one space where that tidies the result.
  // The widened range may never reach the neighbouring range.
  let previousEnd = 0;
  ranges.forEach((r, i) => {
    const nextStart = i + 1 < ranges.length ? ranges[i + 1].start : text.length;
    if (r.replacement === '') tidyRemoval(text, r, previousEnd, nextStart);
    previousEnd = r.end;
  });

  // Pass 3 (descending): apply.
  let out = text;
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const r = ranges[i];
    out = out.slice(0, r.start) + r.replacement + out.slice(r.end);
  }
  return { text: out, applied: ranges.length, skipped };
}

// Widens a removal [start, end) in place by at most one space:
//   "the best juice" -> remove "best" and the space after it -> "the juice"
//   "the best."      -> remove "best" and the space before it -> "the."
function tidyRemoval(text, r, previousEnd, nextStart) {
  const before = r.start === 0 ? null : text[r.start - 1];
  const after = r.end >= text.length ? null : text[r.end];
  const atEdge = before === null || before === '\n';

  if ((before === ' ' || atEdge) && after === ' ' && r.end + 1 <= nextStart) {
    r.end += 1;
  } else if (before === ' ' && (after === null || PUNCTUATION_AFTER.test(after)) && r.start - 1 >= previousEnd) {
    r.start -= 1;
  }
}
