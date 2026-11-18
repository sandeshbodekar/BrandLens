import { segment } from './segment.js';

// SRS 8 step 2: deterministic rule checks R1 to R4.
// Pure functions: no database, no network. The review pipeline loads the data
// and passes it in, which is what makes these easy to unit test.
//
// Every rule only flags something it can CITE ("no source, no flag"): if the
// clause a rule needs is missing or inactive, that rule produces nothing.

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

// A match must not touch other letters/digits ("cure" must not match inside
// "secure"), and must not be the start of a longer number ("Rs 99" must not
// match "Rs 999" or "Rs 99.50"). Unicode-aware, so it also works for "₹99".
const WORD_CHARS = String.raw`\p{L}\p{N}_`;
const BEFORE = `(?<![${WORD_CHARS}])`;
const AFTER = `(?![${WORD_CHARS}]|[.,]\\p{N})`;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// All whole-word matches of a regex source inside `text`. Case-insensitive by
// default; pass flags 'gu' for a case-SENSITIVE search. (With the "i" flag,
// \p{Lu} would match lowercase letters too, so the ALL-CAPS check needs 'gu'.)
function findAll(text, patternSource, flags = 'giu') {
  const re = new RegExp(`${BEFORE}(?:${patternSource})${AFTER}`, flags);
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push({ quote: m[0], start: m.index, end: m.index + m[0].length });
  }
  return matches;
}

// First ACTIVE clause of a category, lowest code first ("C-4.2" before "C-7.1").
function firstActiveClause(clauses, category) {
  return (
    clauses
      .filter((c) => c.category === category)
      .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))[0] || null
  );
}

const finding = (fields) => ({
  clauseCode: null,
  factCode: null,
  suggestion: '',
  confidence: 1,
  origin: 'rule',
  ...fields,
});

// R1 Banned terms: each Term.banned item, whole word, any case.
// Cites term.clauseCode; the suggestion is term.preferred.
function checkBannedTerms(text, terms, clauses) {
  const byCode = new Map(clauses.map((c) => [c.code, c]));
  const out = [];
  for (const term of terms) {
    const clause = byCode.get(term.clauseCode);
    if (!clause) continue; // cited clause missing or inactive: nothing to cite
    for (const banned of term.banned) {
      const word = banned.trim();
      if (!word) continue;
      for (const m of findAll(text, escapeRegex(word))) {
        out.push(
          finding({
            ...m,
            type: 'terminology',
            severity: 'medium',
            clauseCode: clause.code,
            explanation: `"${m.quote}" is a banned term. Use "${term.preferred}" instead (${clause.code}: ${clause.title}).`,
            suggestion: term.preferred,
          })
        );
      }
    }
  }
  return out;
}

// R2 Absolute / superlative claims. Cites the first active "claims" clause.
// There is no replacement wording a rule can safely invent, so the suggestion
// is empty, meaning "remove this wording or back it with an approved fact".
const ABSOLUTE_CLAIMS = [
  '#\\s?1',
  'no\\.\\s?1',
  'number\\s+one',
  'best',
  'healthiest',
  'guaranteed',
  '100\\s?%',
  'cure',
  'miracle',
  'proven',
  'risk[\\s-]?free',
  'fastest',
  'cheapest',
];

function checkAbsoluteClaims(text, clauses) {
  const clause = firstActiveClause(clauses, 'claims');
  if (!clause) return [];
  const out = [];
  for (const pattern of ABSOLUTE_CLAIMS) {
    for (const m of findAll(text, pattern)) {
      out.push(
        finding({
          ...m,
          type: 'claim',
          severity: 'high',
          clauseCode: clause.code,
          explanation: `"${m.quote}" is an absolute or superlative claim, and no approved fact supports it (${clause.code}: ${clause.title}).`,
        })
      );
    }
  }
  return out;
}

// R3 Stale fact values. `facts` must already be VALID facts (the pipeline loads
// them with Fact.validFilter). Cites the fact; the suggestion is fact.currentText.
function checkStaleFacts(text, facts) {
  const out = [];
  for (const fact of facts) {
    for (const variant of fact.staleVariants || []) {
      const stale = variant.trim();
      if (!stale) continue;
      for (const m of findAll(text, escapeRegex(stale))) {
        out.push(
          finding({
            ...m,
            type: 'outdated_fact',
            severity: 'medium',
            factCode: fact.code,
            explanation: `"${m.quote}" is an outdated value. The approved fact is: ${fact.statement} (${fact.code}).`,
            suggestion: fact.currentText || '',
          })
        );
      }
    }
  }
  return out;
}

// Lower-case the ALL-CAPS words of a sentence (capitalise one at the very start).
function calmCaps(sentence, caps) {
  let out = sentence;
  for (const c of [...caps].reverse()) {
    // right to left, so earlier offsets stay valid while we edit
    const lower = c.quote.toLowerCase();
    const word = c.start === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    out = out.slice(0, c.start) + word + out.slice(c.end);
  }
  return out;
}

// R4 Shouting. Cites the first active "tone" clause. Two checks:
//  (a) a sentence with 3+ ALL-CAPS words (3+ letters) -> flag the sentence
//  (b) 3+ "!" anywhere in the text -> flag every run of "!"
function checkShouting(text, sentences, clauses) {
  const clause = firstActiveClause(clauses, 'tone');
  if (!clause) return [];
  const source = `${clause.code}: ${clause.title}`;
  const out = [];

  for (const s of sentences) {
    const caps = findAll(s.text, '\\p{Lu}{3,}', 'gu'); // case-sensitive on purpose
    if (caps.length < 3) continue;
    out.push(
      finding({
        quote: s.text,
        start: s.start,
        end: s.end,
        type: 'tone',
        severity: 'low',
        clauseCode: clause.code,
        explanation: `${caps.length} ALL-CAPS words read as shouting. Use a warm, friendly voice (${source}).`,
        suggestion: calmCaps(s.text, caps),
      })
    );
  }

  if ((text.match(/!/g) || []).length >= 3) {
    for (const m of text.matchAll(/!+/g)) {
      out.push(
        finding({
          quote: m[0],
          start: m.index,
          end: m.index + m[0].length,
          type: 'tone',
          severity: 'low',
          clauseCode: clause.code,
          explanation: `Repeated exclamation marks read as shouting. Use a warm, friendly voice (${source}).`,
          suggestion: '.',
        })
      );
    }
  }
  return out;
}

// SRS 8: "If two rule findings overlap, keep the higher severity one."
// Greedy: highest severity first (then earliest, then longest) and drop anything
// that overlaps one already kept. This also guarantees no two findings share
// characters, which "Apply accepted fixes" relies on later.
export function resolveOverlaps(findings) {
  const ranked = [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.start - b.start ||
      b.end - b.start - (a.end - a.start)
  );
  const kept = [];
  for (const f of ranked) {
    if (!kept.some((k) => f.start < k.end && k.start < f.end)) kept.push(f);
  }
  return kept.sort((a, b) => a.start - b.start || a.end - b.end);
}

// Inputs: the draft text, its sentences (from segment.js), and plain objects for
// the workspace's clauses, terms and valid facts. Output: findings sorted by position.
export function runRuleChecks({ text, sentences = segment(text), clauses = [], terms = [], facts = [] }) {
  const active = clauses.filter((c) => c.active !== false);
  return resolveOverlaps([
    ...checkBannedTerms(text, terms, active),
    ...checkAbsoluteClaims(text, active),
    ...checkStaleFacts(text, facts),
    ...checkShouting(text, sentences, active),
  ]);
}
