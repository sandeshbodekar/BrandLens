// SRS 8 step 3.1: mask personal data BEFORE draft text is sent to an external AI.
//   emails            -> [EMAIL]
//   10-digit phones   -> [PHONE]
// Only the copy sent to the model is masked. Findings are still located in the
// original text (the verifier needs the real wording to compute offsets).

// The lookbehinds make each match start at a token boundary, which also keeps
// the matching fast on long text without spaces.
const EMAIL = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;

// A 10-digit number, optionally written as 5+5 digits ("98765 43210" or
// "98765-43210") and optionally with a +91 / 91 / 0 prefix. Digits next to the
// match (a longer number) are not touched, so prices and dates stay readable.
const PHONE = /(?<![\p{N}+])(?:\+?91[\s-]?|0)?\d{5}[\s-]?\d{5}(?!\p{N})/gu;

export function maskPii(text) {
  if (typeof text !== 'string') return '';
  // Emails first: an email can contain a long digit run that is not a phone.
  return text.replace(EMAIL, '[EMAIL]').replace(PHONE, '[PHONE]');
}
