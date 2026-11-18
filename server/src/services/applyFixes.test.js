import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFixes } from './applyFixes.js';

// Builds a finding for the first occurrence of `quote` in `text`.
const at = (text, quote, over = {}) => {
  const start = text.indexOf(quote);
  return { quote, start, end: start + quote.length, suggestion: '', decision: 'accepted', editedSuggestion: null, ...over };
};

test('accepted and edited findings are applied; pending and dismissed are ignored; offsets stay valid', () => {
  const text = 'Now Rs 99 or buy now, BEST juice here.';
  const out = applyFixes(text, [
    at(text, 'Rs 99', { suggestion: 'Rs 109' }), // longer replacement
    at(text, 'buy now', { suggestion: 'order', decision: 'edited', editedSuggestion: 'try it' }), // edited wins
    at(text, 'BEST', { suggestion: 'tasty', decision: 'dismissed' }),
    at(text, 'juice', { suggestion: 'drink', decision: 'pending' }),
  ]);
  assert.equal(out.text, 'Now Rs 109 or try it, BEST juice here.');
  assert.deepEqual([out.applied, out.skipped], [2, 0]);
});

test('findings are applied in any input order (the function sorts them itself)', () => {
  const text = 'aaa bbb ccc';
  const out = applyFixes(text, [
    at(text, 'ccc', { suggestion: 'C' }),
    at(text, 'aaa', { suggestion: 'AAAAAA' }),
    at(text, 'bbb', { suggestion: 'B' }),
  ]);
  assert.equal(out.text, 'AAAAAA B C');
});

test('overlapping ranges: the first one (lowest start) is kept, the others are skipped', () => {
  const text = 'the healthiest drink';
  const out = applyFixes(text, [
    at(text, 'the healthiest', { suggestion: 'X' }), // starts first: kept
    at(text, 'healthiest drink', { suggestion: 'Y' }), // overlaps the first one: skipped
    at(text, 'healthiest', { suggestion: 'tasty' }), // inside the first one: skipped
    at(text, 'drink', { suggestion: 'Z' }), // touches but does not overlap: applied
  ]);
  assert.equal(out.text, 'X Z');
  assert.deepEqual([out.applied, out.skipped], [2, 2]);
});

test('an empty suggestion removes the text and one neighbouring space', () => {
  let text = 'Our juice is the best drink.';
  assert.equal(applyFixes(text, [at(text, 'best')]).text, 'Our juice is the drink.'); // no double space

  text = 'It is the best.';
  assert.equal(applyFixes(text, [at(text, 'best')]).text, 'It is the.'); // no space before the dot

  text = 'BEST juice today';
  assert.equal(applyFixes(text, [at(text, 'BEST')]).text, 'juice today'); // start of text

  text = 'line one best\nline two';
  assert.equal(applyFixes(text, [at(text, 'best')]).text, 'line one\nline two'); // before a line break
});

test('neighbouring removals do not eat each other or the words around them', () => {
  const text = "India's #1 healthiest drink";
  assert.equal(applyFixes(text, [at(text, '#1'), at(text, 'healthiest')]).text, "India's drink");

  const touching = 'a b c';
  // b is removed with its trailing space; c is a replacement right behind it
  assert.equal(applyFixes(touching, [at(touching, 'b'), at(touching, 'c', { suggestion: 'C' })]).text, 'a C');
});

test('a range outside the text, or whose quote no longer matches, is skipped (text is never corrupted)', () => {
  const text = 'Hello world';
  const out = applyFixes(text, [
    { quote: 'world', start: 6, end: 20, suggestion: 'x', decision: 'accepted' }, // past the end
    { quote: 'Hallo', start: 0, end: 5, suggestion: 'x', decision: 'accepted' }, // text changed since
    { quote: 'x', start: 3, end: 3, suggestion: 'x', decision: 'accepted' }, // empty range
    at(text, 'world', { suggestion: 'there' }),
  ]);
  assert.equal(out.text, 'Hello there');
  assert.deepEqual([out.applied, out.skipped], [1, 3]);
});

test('with nothing accepted the text is returned unchanged', () => {
  const text = 'Nothing to do.';
  const out = applyFixes(text, [at(text, 'Nothing', { decision: 'pending', suggestion: 'x' })]);
  assert.deepEqual(out, { text, applied: 0, skipped: 0 });
});

test('the SRS sample "Summer launch post": the five rule findings become a clean sentence', () => {
  const text = "Our juice is India's #1 healthiest drink and 100% sugar free - guaranteed to boost immunity! Buy now at just Rs 99 (offer valid till Dec).";
  const out = applyFixes(text, [
    at(text, '#1'),
    at(text, 'healthiest'),
    at(text, '100%'),
    at(text, 'guaranteed'),
    at(text, 'Rs 99', { suggestion: 'Rs 109' }),
  ]);
  assert.equal(out.text, "Our juice is India's drink and sugar free - to boost immunity! Buy now at just Rs 109 (offer valid till Dec).");
  assert.equal(out.applied, 5);
});
