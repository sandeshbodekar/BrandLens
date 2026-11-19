import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAiFailure } from './aiFailure.js';

const reason = (m, extra) => classifyAiFailure(Object.assign(new Error(m), extra)).reason;

test('429 is a rate limit, with a sentence a judge can read', () => {
  const r = classifyAiFailure(new Error('Gemini API error 429: Resource exhausted'));
  assert.equal(r.reason, 'rate_limited');
  assert.match(r.message, /too many requests/);
});

test('503 and other server errors are "overloaded"', () => {
  for (const s of [500, 502, 503, 504]) assert.equal(reason(`Gemini API error ${s}: x`), 'overloaded', String(s));
  assert.equal(reason('The model is overloaded. Please try again later.'), 'overloaded');
});

test('timeouts are recognised with or without the millisecond count', () => {
  assert.equal(reason('Gemini request timed out after 20000 ms'), 'timeout');
  assert.equal(reason('Gemini request timed out'), 'timeout');
});

test('bad key, wrong model, empty answer, network', () => {
  assert.equal(reason('Gemini API error 400: API key not valid'), 'auth');
  assert.equal(reason('Gemini API error 403: denied'), 'auth');
  assert.equal(reason('Gemini API error 404: model not found'), 'model');
  assert.equal(reason('Gemini returned no text (SAFETY)'), 'empty');
  assert.equal(reason('Gemini request failed: fetch failed'), 'network');
});

test('err.status wins over the text, and unknown errors get a generic reason', () => {
  assert.equal(reason('something odd', { status: 429 }), 'rate_limited');
  assert.equal(reason('something odd'), 'error');
});
