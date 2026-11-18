// SRS 7.2: split pasted guideline text into clause candidates. Pure function: no
// database, no network, so it is easy to test. The result is only a PREVIEW; nothing is
// saved until the admin confirms (POST /api/clauses/bulk).
//
// Rules (from the SRS):
//   - blocks are separated by blank lines
//   - a leading code like "C-4.2", "1.2", "1)" or "1." becomes the clause code,
//     otherwise the code is "C-AUTO-n"
//   - the first sentence becomes the title
// Category and severity are NOT in the pasted text, so they are guessed with a few
// keywords. The admin can change both in the preview.

export const MAX_IMPORT_CHARS = 20000;
export const MAX_IMPORT_CLAUSES = 100;
const MAX_CODE = 30;
const MAX_TITLE = 200;
const MAX_TEXT = 2000;

// Group 1: letters-dash-number codes ("C-4.2", "V-2"). Group 2: plain numbers ("1.2", "1").
// A number may be followed by "." ")" or ":"; a letter code by ":" or whitespace. Digits are
// limited to 1-3 for plain numbers so "2026 sales..." or "100% of..." is NOT read as a code.
const CODE_RE = /^(?:([A-Za-z]{1,4}-\d{1,4}(?:\.\d{1,3})*)|(\d{1,3}(?:\.\d{1,3})*))(?:[.):]|(?=\s|$))\s*/;

// First match wins, so the order matters (legal before claims: "never claim that a product
// cures..." is a legal rule).
const CATEGORY_RULES = [
  ['accessibility', /\b(alt[ -]?text|contrast|accessib\w*|screen reader|wcag)\b/i],
  ['visual', /\b(logo|colou?rs?|palette|fonts?|typeface|images?|photos?|layout)\b/i],
  ['legal', /\b(legal|law|medical|health|disclaimer|regulat\w*|end dates?|offers?|cures?|treat\w*)\b/i],
  ['claims', /\b(claims?|proof|proven|evidence|facts?|statistics?|superlative|ingredients?|nutrition)\b/i],
  ['terminology', /\b(terminology|wording|spelling|call (?:our|it|them)|the words?)\b/i],
];
const guessCategory = (body) => CATEGORY_RULES.find(([, re]) => re.test(body))?.[0] ?? 'tone';
const guessSeverity = (body) => (/\b(never|must not|may not|prohibited|forbidden)\b/i.test(body) ? 'high' : 'medium');

function firstSentence(body) {
  const m = body.match(/^(.+?[.!?])(?=\s|$)/);
  let title = (m ? m[1] : body).replace(/\.$/, '').trim(); // "Foo bar." -> "Foo bar" (keeps ? and !)
  if (title.length > MAX_TITLE) title = `${title.slice(0, MAX_TITLE - 1).trimEnd()}…`;
  return title;
}

// Message for a row that could not be saved as it is, or null when it is fine.
// (The page re-checks live while the admin edits; the server checks again on save.)
function problemOf(item) {
  if (item.code.length > MAX_CODE) return `Code is longer than ${MAX_CODE} characters`;
  if (item.text.length > MAX_TEXT) return `Rule text is longer than ${MAX_TEXT} characters`;
  return null;
}

// text:          the pasted guideline text
// existingCodes: codes already in the workspace (any case), to avoid duplicates
// Returns { clauses, skipped }: clauses = [{ code, category, title, text, severityDefault,
// active, problem }], skipped = blocks ignored because they had no text after the code.
export function parseGuidelines(text, { existingCodes = [] } = {}) {
  const blocks = String(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  let skipped = 0;
  const items = [];
  for (const block of blocks) {
    const m = block.match(CODE_RE);
    const code = m ? m[1] || m[2] : null;
    const rest = m ? block.slice(m[0].length) : block;
    const body = rest.replace(/\s*\n\s*/g, ' ').trim(); // one line, single spaces at the joins
    if (!body) {
      skipped += 1; // e.g. a block that is only "C-4.2"
      continue;
    }
    items.push({
      code,
      category: guessCategory(body),
      title: firstSentence(body),
      text: body,
      severityDefault: guessSeverity(body),
      active: true,
      problem: null,
    });
  }

  // Auto codes are given AFTER all explicit codes are known, so "C-AUTO-2" typed by the
  // admin further down the paste is never handed out first.
  const existing = new Set(existingCodes.map((c) => String(c).toLowerCase()));
  const used = new Set(existing);
  for (const it of items) if (it.code) used.add(it.code.toLowerCase());
  let n = 0;
  for (const it of items) {
    if (it.code) continue;
    do n += 1;
    while (used.has(`c-auto-${n}`));
    it.code = `C-AUTO-${n}`;
    used.add(it.code.toLowerCase());
  }

  // Duplicate checks: against the workspace, and against earlier rows of this paste.
  const seen = new Set();
  for (const it of items) {
    const lower = it.code.toLowerCase();
    if (existing.has(lower)) it.problem = 'A clause with this code already exists';
    else if (seen.has(lower)) it.problem = 'This code appears twice in the pasted text';
    else it.problem = problemOf(it);
    seen.add(lower);
  }
  return { clauses: items, skipped };
}
