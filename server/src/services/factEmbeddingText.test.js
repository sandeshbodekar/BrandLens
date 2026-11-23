import test from 'node:test';
import assert from 'node:assert/strict';
import { factEmbeddingText, embeddingHash, findStaleFacts } from './factEmbeddingText.js';

const f20 = { code: 'F-20', statement: 'The price of a 300 ml bottle is Rs 109.', currentText: 'Rs 109', staleVariants: ['Rs 99'] };

test('the embedded text has the statement and the approved wording, but never stale values', () => {
  const t = factEmbeddingText(f20);
  assert.match(t, /Rs 109\.\s\(Approved wording: Rs 109\)/);
  assert.ok(!t.includes('Rs 99'));
  assert.equal(factEmbeddingText({ statement: 'Cold-pressed in Pune.', currentText: '' }), 'Cold-pressed in Pune.');
});

test('the hash changes with the text, the model and the size', () => {
  const t = factEmbeddingText(f20);
  const base = embeddingHash(t, 'gemini-embedding-2', 768);
  assert.equal(base, embeddingHash(t, 'gemini-embedding-2', 768));
  assert.notEqual(base, embeddingHash(t + ' x', 'gemini-embedding-2', 768));
  assert.notEqual(base, embeddingHash(t, 'gemini-embedding-001', 768));
  assert.notEqual(base, embeddingHash(t, 'gemini-embedding-2', 1536));
});

test('only facts without a matching hash are stale', () => {
  const opts = { model: 'm', dims: 8 };
  const fresh = { ...f20, embeddingHash: embeddingHash(factEmbeddingText(f20), 'm', 8) };
  const changed = { ...f20, code: 'F-21', embeddingHash: embeddingHash('old text', 'm', 8) };
  const never = { ...f20, code: 'F-22' };
  assert.deepEqual(findStaleFacts([fresh, changed, never], opts).map((f) => f.code), ['F-21', 'F-22']);
  assert.equal(findStaleFacts([fresh], { ...opts, force: true }).length, 1);
  assert.equal(findStaleFacts([fresh], { ...opts, model: 'other' }).length, 1);
});
