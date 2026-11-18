import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuidelines } from './guidelineImport.js';
import { CLAUSES } from '../seed/brandData.js';

const parse = (text, existingCodes) => parseGuidelines(text, { existingCodes });

test('blocks are split on blank lines and each leading code style is read', () => {
  const { clauses, skipped } = parse(
    'C-4.2 Superlative claims need proof. Use best only with a fact.\n\n1.2 Be friendly. Keep a warm voice.\n\n3) Use short words. Avoid jargon.\n\n4. Mind the logo. Keep clear space.\n\nV-2: Friendly, not pushy. No urgency.'
  );
  assert.deepEqual(clauses.map((c) => c.code), ['C-4.2', '1.2', '3', '4', 'V-2']);
  assert.equal(skipped, 0);
});

test('title is the first sentence without its full stop; text is the whole body on one line', () => {
  const { clauses } = parse('C-1 Short title. First line of detail\ncontinues on the next line.');
  assert.equal(clauses[0].title, 'Short title');
  assert.equal(clauses[0].text, 'Short title. First line of detail continues on the next line.');
  const q = parse('Is this a question? Yes.').clauses[0];
  assert.equal(q.title, 'Is this a question?'); // ? and ! are kept
});

test('no code means C-AUTO-n, which skips codes already used in the workspace', () => {
  const { clauses } = parse('First rule here.\n\nC-2 Typed by the admin.\n\nSecond rule here.', ['c-auto-1']);
  assert.deepEqual(clauses.map((c) => c.code), ['C-AUTO-2', 'C-2', 'C-AUTO-3']);
});

test('numbers at the start of a sentence are not mistaken for codes', () => {
  const { clauses } = parse('100% of claims need proof.\n\n2026 prices must be updated.');
  assert.deepEqual(clauses.map((c) => c.code), ['C-AUTO-1', 'C-AUTO-2']);
  assert.equal(clauses[0].text, '100% of claims need proof.');
});

test('duplicate codes are flagged: against the workspace (any case) and inside the paste', () => {
  const { clauses } = parse('C-1 One.\n\nc-2 Two.\n\nC-1 One again.', ['C-2']);
  assert.equal(clauses[0].problem, null);
  assert.equal(clauses[1].problem, 'A clause with this code already exists');
  assert.equal(clauses[2].problem, 'This code appears twice in the pasted text');
});

test('empty blocks and code-only blocks are skipped; limits are flagged or truncated', () => {
  const { clauses, skipped } = parse('C-9\n\n   \n\nC-10 Real rule.');
  assert.equal(clauses.length, 1);
  assert.equal(skipped, 1);

  const long = parse(`C-11 ${'a'.repeat(250)}`).clauses[0];
  assert.equal(long.title.length, 200);
  assert.ok(long.title.endsWith('…'));
  const huge = parse(`C-12 ${'b'.repeat(2100)}`).clauses[0];
  assert.match(huge.problem, /2000 characters/);
});

test('the seeded FreshNest clauses survive a round trip: code, title and a sensible category', () => {
  const pasted = CLAUSES.map((c) => `${c.code} ${c.title}. ${c.text}`).join('\n\n');
  const { clauses } = parse(pasted);
  assert.equal(clauses.length, CLAUSES.length);
  clauses.forEach((got, i) => {
    assert.equal(got.code, CLAUSES[i].code);
    assert.equal(got.title, CLAUSES[i].title);
    assert.equal(got.category, CLAUSES[i].category, `category of ${got.code}`);
    assert.equal(got.problem, null);
  });
});
