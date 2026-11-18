import test from 'node:test';
import assert from 'node:assert/strict';
import { segment } from './segment.js';
import { runRuleChecks } from './ruleChecks.js';

// Small fixture modelled on the FreshNest seed. C-7.1 is listed BEFORE C-4.2 on
// purpose: "first active claims clause" must mean lowest code, not list order.
const clauses = [
  { code: 'C-7.1', category: 'claims', title: 'Ingredient accuracy', active: true },
  { code: 'C-4.2', category: 'claims', title: 'Superlative claims need proof', active: true },
  { code: 'V-2', category: 'tone', title: 'Friendly, not pushy', active: true },
  { code: 'T-1', category: 'terminology', title: 'Preferred product terms', active: true },
];
const terms = [{ preferred: 'cold-pressed juice', banned: ['detox', 'miracle', 'cure'], clauseCode: 'T-1' }];
const facts = [
  {
    code: 'F-20',
    statement: 'The price of a 300 ml bottle is Rs 109.',
    currentText: 'Rs 109',
    staleVariants: ['Rs 99', 'Rs. 99', '₹99'],
  },
];
const run = (text, overrides = {}) =>
  runRuleChecks({ text, sentences: segment(text), clauses, terms, facts, ...overrides });

test('R1: banned term is matched as a whole word in any case, cites its clause, suggests the preferred term', () => {
  const found = run('Our DETOX plan is not a detoxify thing.');
  assert.equal(found.length, 1); // "detoxify" must not match
  assert.deepEqual(
    { quote: found[0].quote, type: found[0].type, severity: found[0].severity },
    { quote: 'DETOX', type: 'terminology', severity: 'medium' }
  );
  assert.equal(found[0].clauseCode, 'T-1');
  assert.equal(found[0].suggestion, 'cold-pressed juice');
  assert.equal(found[0].origin, 'rule');
  assert.equal(found[0].confidence, 1);
});

test('R1: a term whose clause is missing or inactive produces no finding (no source, no flag)', () => {
  const orphan = [{ preferred: 'x', banned: ['detox'], clauseCode: 'T-99' }];
  assert.equal(run('Try our detox plan.', { terms: orphan }).length, 0);
  const inactive = clauses.map((c) => (c.code === 'T-1' ? { ...c, active: false } : c));
  assert.equal(run('Try our detox plan.', { clauses: inactive }).length, 0);
});

test('R2: superlatives are high severity and cite the lowest-coded claims clause; words inside other words are ignored', () => {
  const found = run("India's #1 healthiest drink, 100% sugar free, guaranteed. A bestseller that is secure.");
  assert.deepEqual(found.map((f) => f.quote), ['#1', 'healthiest', '100%', 'guaranteed']);
  for (const f of found) {
    assert.equal(f.type, 'claim');
    assert.equal(f.severity, 'high');
    assert.equal(f.clauseCode, 'C-4.2');
  }
  const noClaimsClause = clauses.filter((c) => c.category !== 'claims');
  assert.equal(run('The best juice.', { clauses: noClaimsClause }).length, 0);
});

test('R3: stale values of a valid fact are flagged with the current text; longer numbers and the current price are not', () => {
  const found = run('Now Rs 99 or Rs. 99 or ₹99, not Rs 999, Rs 99.50 or Rs 109.');
  assert.deepEqual(found.map((f) => f.quote), ['Rs 99', 'Rs. 99', '₹99']);
  for (const f of found) {
    assert.equal(f.type, 'outdated_fact');
    assert.equal(f.severity, 'medium');
    assert.equal(f.factCode, 'F-20');
    assert.equal(f.clauseCode, null);
    assert.equal(f.suggestion, 'Rs 109');
  }
});

test('R4: 3+ ALL-CAPS words flag the sentence; "!" only counts at 3 or more in the text', () => {
  const caps = run('BUY NOW FOR FREE JUICE today. Fresh and calm.');
  assert.equal(caps.length, 1);
  assert.equal(caps[0].quote, 'BUY NOW FOR FREE JUICE today.');
  assert.equal(caps[0].suggestion, 'Buy now for free juice today.');
  assert.equal(caps[0].severity, 'low');
  assert.equal(caps[0].clauseCode, 'V-2');

  assert.equal(run('HEY YOU there, friend.').length, 0); // only 2 caps words
  assert.equal(run('Wow! Great!').length, 0); // only 2 "!"
  const bangs = run('Wow! Great! Tasty!');
  assert.deepEqual(bangs.map((f) => f.quote), ['!', '!', '!']);
  assert.equal(bangs[0].suggestion, '.');
});

test('overlaps keep the higher severity; offsets are exact; a clean text has no findings', () => {
  const text = 'Our miracle green juice is a natural cure for tiredness and the fastest way.';
  const found = run(text);
  // R1 (medium) and R2 (high) both match "miracle" and "cure": the claim wins.
  assert.deepEqual(found.map((f) => f.quote), ['miracle', 'cure', 'fastest']);
  assert.ok(found.every((f) => f.type === 'claim' && f.severity === 'high'));
  for (let i = 0; i < found.length; i += 1) {
    assert.equal(text.slice(found[i].start, found[i].end), found[i].quote);
    if (i > 0) assert.ok(found[i].start >= found[i - 1].end); // sorted, no overlap
  }
  const clean = 'Meet our new mango cold-pressed juice. Made in small batches in Pune with no added sugar. Available now for Rs 109.';
  assert.deepEqual(run(clean), []);
});
