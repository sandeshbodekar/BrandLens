import { SEVERITIES } from '../models/Clause.js';
import { FINDING_TYPES } from '../models/Finding.js';
import { resolveOverlaps } from './ruleChecks.js';

// SRS 8 step 4: "no source, no flag". Everything the model says is untrusted until
// it passes here, so a made-up rule, a misquoted sentence or a malformed item can
// never reach the user. Pure function: no database, no network.

const MAX_AI_ITEMS = 50; // a runaway answer must not become hundreds of findings

// Parse the model output. Returns an array, or null if there is no JSON array.
// Strips ```json fences. If the text is not JSON at all (the model wrapped the array in
// prose), the outermost [ ... ] is tried. Valid JSON of another shape, such as an
// object, is a failure: the prompt asked for a bare array.
export function parseModelOutput(raw) {
  if (typeof raw !== 'string') return null;
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    /* not JSON: maybe prose around an array, handled below */
  }

  const open = text.indexOf('[');
  const close = text.lastIndexOf(']');
  if (open === -1 || close <= open) return null;
  try {
    const value = JSON.parse(text.slice(open, close + 1));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// Checks 2 and 3 of the SRS list: enums, a real cited source, a usable suggestion.
// Returns the cleaned item, or null if it must be dropped.
function cleanItem(item, clauseByLower, factByLower) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const quote = typeof item.quote === 'string' ? item.quote.trim() : '';
  if (!quote) return null;

  const type = typeof item.type === 'string' ? item.type.trim().toLowerCase() : '';
  const severity = typeof item.severity === 'string' ? item.severity.trim().toLowerCase() : '';
  if (!FINDING_TYPES.includes(type) || !SEVERITIES.includes(severity)) return null;

  // Keep a cited code only if it really exists (active clause / valid fact). A
  // made-up code is removed, never stored. At least one real source must remain.
  const lookup = (map, code) => (typeof code === 'string' ? map.get(code.trim().toLowerCase()) || null : null);
  const clauseCode = lookup(clauseByLower, item.clauseCode);
  const factCode = lookup(factByLower, item.factCode);
  if (!clauseCode && !factCode) return null;

  const suggestion = typeof item.suggestion === 'string' ? item.suggestion.trim() : '';
  if (!suggestion || suggestion === quote) return null;

  // Not in the SRS list, but a finding without an explanation cannot be stored or shown.
  const explanation = typeof item.explanation === 'string' ? item.explanation.trim() : '';
  if (!explanation) return null;

  // Same reason: confidence must be a number from 0 to 1.
  const rawConfidence = typeof item.confidence === 'string' && item.confidence.trim() !== '' ? Number(item.confidence) : item.confidence;
  if (typeof rawConfidence !== 'number' || !Number.isFinite(rawConfidence) || rawConfidence < 0 || rawConfidence > 1) return null;

  return { quote, type, severity, clauseCode, factCode, explanation, suggestion, confidence: rawConfidence };
}

// First occurrence of `quote` in the ORIGINAL text that no earlier AI item has taken.
// A quote repeated twice by the model therefore maps to its first and second occurrence.
function findRange(text, quote, used) {
  let from = 0;
  for (;;) {
    const start = text.indexOf(quote, from);
    if (start === -1) return null;
    const end = start + quote.length;
    if (!used.some((u) => u.start === start && u.end === end)) return { start, end };
    from = start + 1;
  }
}

// An AI finding that overlaps a rule finding never becomes a second finding: the rule
// finding stays and gets the AI explanation appended, but only if the AI cites a source
// the rule finding does not already cite. Returns true if something was added.
function mergeIntoRule(rule, citedCodes, ai) {
  const added = [ai.clauseCode, ai.factCode].filter((code) => code && !citedCodes.has(code));
  if (!added.length) return false;
  rule.explanation = `${rule.explanation} Also ${added.join(', ')}: ${ai.explanation}`;
  for (const code of added) citedCodes.add(code);
  // Show the extra source as a chip when the finding has a free slot for it.
  if (!rule.clauseCode && added.includes(ai.clauseCode)) rule.clauseCode = ai.clauseCode;
  if (!rule.factCode && added.includes(ai.factCode)) rule.factCode = ai.factCode;
  return true;
}

// Inputs:
//   raw          the model's answer, exactly as returned (a string)
//   text         the ORIGINAL draft text (not the PII-masked copy)
//   clauses      the ACTIVE clauses  [{ code }]
//   facts        the facts VALID today [{ code }]
//   ruleFindings findings from ruleChecks.js
// Output: { findings, dropped, parseFailed }
//   findings     rule findings (some with an AI explanation appended) + accepted AI findings,
//                sorted by position. The inputs are not modified.
//   dropped      model items that did not become, or add to, a finding
//   parseFailed  true when the answer was not a JSON array (the pipeline then uses rules only)
export function verifyAiFindings({ raw, text, clauses = [], facts = [], ruleFindings = [] }) {
  const rules = ruleFindings.map((f) => ({ ...f })).sort((a, b) => a.start - b.start || a.end - b.end);

  const items = parseModelOutput(raw);
  if (items === null) return { findings: rules, dropped: 0, parseFailed: true };

  const clauseByLower = new Map(clauses.map((c) => [c.code.toLowerCase(), c.code]));
  const factByLower = new Map(facts.map((f) => [f.code.toLowerCase(), f.code]));
  const citedByRule = rules.map((r) => new Set([r.clauseCode, r.factCode].filter(Boolean)));

  let dropped = Math.max(0, items.length - MAX_AI_ITEMS);
  const used = [];
  const accepted = [];

  for (const item of items.slice(0, MAX_AI_ITEMS)) {
    const clean = cleanItem(item, clauseByLower, factByLower);
    if (!clean) {
      dropped += 1;
      continue;
    }

    // Check 1: the quote must be real text from the draft. Done after the cheap checks, so
    // an item that is dropped anyway does not use up an occurrence of a repeated quote.
    const range = findRange(text, clean.quote, used);
    if (!range) {
      dropped += 1; // not in the draft, or every occurrence is already taken (duplicate)
      continue;
    }
    used.push(range);

    // Check 4: overlap with a rule finding.
    const ruleIndex = rules.findIndex((r) => range.start < r.end && r.start < range.end);
    if (ruleIndex !== -1) {
      if (!mergeIntoRule(rules[ruleIndex], citedByRule[ruleIndex], clean)) dropped += 1;
      continue;
    }

    accepted.push({ ...clean, ...range, origin: 'ai' });
  }

  // Two AI findings on overlapping text: keep the higher severity (same rule as for
  // rule findings), so no two findings ever share characters.
  const kept = resolveOverlaps(accepted);
  dropped += accepted.length - kept.length;

  const findings = [...rules, ...kept].sort((a, b) => a.start - b.start || a.end - b.end);
  return { findings, dropped, parseFailed: false };
}
