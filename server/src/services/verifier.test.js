import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAiFindings } from './verifier.js';

// The draft is the SRS "Summer launch post". Clauses are the ACTIVE ones and facts the
// VALID ones, exactly what the pipeline passes in.
const text =
  "Our juice is India's #1 healthiest drink and 100% sugar free - guaranteed to boost immunity! Buy now at just Rs 99 (offer valid till Dec).";
const clauses = [{ code: 'C-4.2' }, { code: 'C-5.1' }, { code: 'C-6.1' }, { code: 'V-2' }, { code: 'T-1' }];
const facts = [{ code: 'F-12' }, { code: 'F-20' }];

// A fully valid model item; each test overrides what it wants to break.
const item = (over = {}) => ({
  quote: '100% sugar free',
  type: 'fact_conflict',
  severity: 'high',
  clauseCode: null,
  factCode: 'F-12',
  explanation: 'The sugar claim conflicts with the approved fact.',
  suggestion: 'no added sugar',
  confidence: 0.9,
  ...over,
});
const verify = (items, extra = {}) =>
  verifyAiFindings({ raw: JSON.stringify(items), text, clauses, facts, ruleFindings: [], ...extra });

test('a valid item is accepted: offsets come from the original text, low confidence is kept, code case is fixed', () => {
  const out = verify([item(), item({ quote: 'Buy now', type: 'tone', severity: 'low', clauseCode: 'v-2', factCode: null, explanation: 'Pushy urgency phrase.', suggestion: 'Try it today', confidence: 0.4 })]);
  assert.equal(out.parseFailed, false);
  assert.equal(out.dropped, 0);
  assert.equal(out.findings.length, 2);
  for (const f of out.findings) {
    assert.equal(text.slice(f.start, f.end), f.quote);
    assert.equal(f.origin, 'ai');
  }
  const buyNow = out.findings.find((f) => f.quote === 'Buy now');
  assert.equal(buyNow.clauseCode, 'V-2'); // "v-2" from the model is stored as the real code
  assert.equal(buyNow.confidence, 0.4); // kept; the UI labels it "Needs human judgement"
});

test('a made-up clause or fact code is dropped; a made-up code next to a real one is removed, not stored', () => {
  const out = verify([
    item({ quote: 'healthiest', type: 'claim', clauseCode: 'C-99', factCode: null, suggestion: 'tasty' }), // made-up clause only
    item({ clauseCode: null, factCode: 'F-99' }), // made-up fact only
    item({ clauseCode: null, factCode: null }), // cites nothing
    item({ clauseCode: 'C-99', factCode: 'F-12' }), // one real source: kept, fake code removed
  ]);
  assert.equal(out.dropped, 3);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].clauseCode, null);
  assert.equal(out.findings[0].factCode, 'F-12');

  // A clause that is not in the active list (e.g. switched off) cannot be cited either.
  const withoutT1 = verify([item({ quote: 'Buy now', type: 'terminology', clauseCode: 'T-1', factCode: null, suggestion: 'Order today' })], {
    clauses: clauses.filter((c) => c.code !== 'T-1'),
  });
  assert.equal(withoutT1.findings.length, 0);
  assert.equal(withoutT1.dropped, 1);
});

test('a quote that is not in the draft is dropped (misquote, wrong case, empty, not a string)', () => {
  const out = verify([
    item({ quote: "India's #1 drink" }), // not a substring
    item({ quote: '100% SUGAR FREE' }), // wrong case
    item({ quote: '' }),
    item({ quote: '   ' }),
    item({ quote: 123 }),
  ]);
  assert.equal(out.findings.length, 0);
  assert.equal(out.dropped, 5);
});

test('items with a bad type, severity, suggestion, explanation or confidence are dropped', () => {
  const buyNow = (over) => item({ quote: 'Buy now', type: 'tone', severity: 'low', clauseCode: 'V-2', factCode: null, suggestion: 'Order today', ...over });
  const out = verify([
    buyNow({ type: 'spelling' }),
    buyNow({ severity: 'urgent' }),
    buyNow({ suggestion: '' }),
    buyNow({ suggestion: 'Buy now' }), // identical to the quote
    buyNow({ explanation: '' }),
    buyNow({ confidence: 1.5 }),
    buyNow({ confidence: 'very' }),
    buyNow({ confidence: undefined }),
    buyNow({ severity: 'HIGH', confidence: '0.8' }), // case and a numeric string are tolerated
  ]);
  assert.equal(out.dropped, 8);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].severity, 'high');
  assert.equal(out.findings[0].confidence, 0.8);
});

test('unusable output gives parseFailed with the rule findings untouched; fences and surrounding prose are handled', () => {
  const rule = { quote: 'Rs 99', start: text.indexOf('Rs 99'), end: text.indexOf('Rs 99') + 5, type: 'outdated_fact', severity: 'medium', clauseCode: null, factCode: 'F-20', explanation: 'Old price.', suggestion: 'Rs 109', confidence: 1, origin: 'rule' };
  for (const raw of ['Sorry, I cannot help with that.', '{"findings": []}', '', undefined, '[{"quote": ']) {
    const out = verifyAiFindings({ raw, text, clauses, facts, ruleFindings: [rule] });
    assert.equal(out.parseFailed, true);
    assert.deepEqual(out.findings, [rule]);
    assert.equal(out.dropped, 0);
  }
  const json = JSON.stringify([item()]);
  assert.equal(verify(JSON.parse(`[${json.slice(1, -1)}]`)).findings.length, 1);
  assert.equal(verifyAiFindings({ raw: '```json\n' + json + '\n```', text, clauses, facts }).findings.length, 1);
  assert.equal(verifyAiFindings({ raw: 'Here you go:\n' + json + '\nHope it helps.', text, clauses, facts }).findings.length, 1);
  const empty = verifyAiFindings({ raw: '[]', text, clauses, facts });
  assert.deepEqual([empty.findings, empty.dropped, empty.parseFailed], [[], 0, false]);
});

test('a repeated quote maps to its next occurrence; once all are taken the extra item is a dropped duplicate', () => {
  const twice = 'Rs 99 now, Rs 99 later.';
  const stale = item({ quote: 'Rs 99', type: 'outdated_fact', factCode: 'F-20', suggestion: 'Rs 109' });
  const out = verifyAiFindings({ raw: JSON.stringify([stale, stale, stale]), text: twice, clauses, facts });
  assert.deepEqual(out.findings.map((f) => f.start), [0, twice.indexOf('Rs 99', 1)]);
  assert.equal(out.dropped, 1);
});

test('an AI finding on a rule finding never adds a second finding: the rule wins, a different source is appended once', () => {
  const start = text.indexOf('100%');
  const rule = { quote: '100%', start, end: start + 4, type: 'claim', severity: 'high', clauseCode: 'C-4.2', factCode: null, explanation: 'Rule: unsupported claim.', suggestion: '', confidence: 1, origin: 'rule' };
  const out = verify(
    [
      item(), // "100% sugar free" overlaps the rule and cites F-12, a NEW source
      item({ quote: '100%', type: 'claim', clauseCode: 'C-4.2', factCode: null, suggestion: 'a lot' }), // same source as the rule: nothing to add
    ],
    { ruleFindings: [rule] }
  );
  assert.equal(out.findings.length, 1);
  const f = out.findings[0];
  assert.equal(f.origin, 'rule');
  assert.equal(f.severity, 'high');
  assert.equal(f.factCode, 'F-12'); // the new source fills the free slot
  assert.equal(f.clauseCode, 'C-4.2');
  assert.ok(f.explanation.startsWith('Rule: unsupported claim.'));
  assert.equal(f.explanation.match(/Also F-12/g).length, 1);
  assert.equal(out.dropped, 1); // the second item added nothing
  // the caller's object was not modified
  assert.equal(rule.factCode, null);
  assert.equal(rule.explanation, 'Rule: unsupported claim.');
});

test('overlapping AI findings keep the higher severity; non-object items are dropped', () => {
  const out = verify([
    'junk',
    null,
    5,
    [],
    item({ quote: 'healthiest drink', type: 'claim', severity: 'low', clauseCode: 'C-4.2', factCode: null, suggestion: 'tasty drink' }),
    item({ quote: 'healthiest', type: 'claim', severity: 'high', clauseCode: 'C-4.2', factCode: null, suggestion: 'tasty' }),
  ]);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].quote, 'healthiest');
  assert.equal(out.findings[0].severity, 'high');
  assert.equal(out.dropped, 5); // 4 junk items + the overlapped low-severity one
});
