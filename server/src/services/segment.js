// SRS 8 step 1: split text into sentences while keeping the ORIGINAL character
// offsets. Deterministic and deliberately simple.
//
// A sentence is a run of text plus the terminators that follow it (. ! ? or a
// newline), so "HURRY!!!" is ONE sentence, not four. Known simplification:
// "Rs. 99" and "4.5" are also split at the dot; the rules that use sentences
// (only R4) are not affected in a way that matters.
//
// Returns [{ text, start, end }] with end exclusive, so
// text.slice(start, end) === sentence.text.
export function segment(text) {
  const sentences = [];
  const re = /[^.!?\n]*[.!?\n]+|[^.!?\n]+/g; // never matches an empty string
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const trimmed = raw.trim();
    // Skip pieces with no letters or digits (blank lines, "...").
    if (!/[\p{L}\p{N}]/u.test(trimmed)) continue;
    const start = m.index + (raw.length - raw.trimStart().length);
    sentences.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return sentences;
}
