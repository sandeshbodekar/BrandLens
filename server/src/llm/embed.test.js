import test from 'node:test';
import assert from 'node:assert/strict';
import { embedWith, formatInput, normalize } from './embed.js';

// A fake Gemini: records requests and answers with vectors of `size` numbers.
function fakeFetch({ size = 8, failures = [] } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    const failure = failures.shift();
    if (failure) {
      return { ok: false, status: failure, headers: { get: () => null }, json: async () => ({ error: { message: 'busy' } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ embeddings: body.requests.map((_, i) => ({ values: Array.from({ length: size }, (_, j) => i + j + 1) })) }),
    };
  };
  return { impl, calls };
}

const base = { apiKey: 'KEY123', model: 'gemini-embedding-2', dims: 4, timeoutMs: 20000, retryOptions: { sleep: async () => {} } };

test('gemini-embedding-2: task and title go into the text, no taskType, key stays out of the URL', async () => {
  const f = fakeFetch();
  await embedWith({ ...base, texts: ['Price is Rs 109'], titles: ['F-20'], kind: 'document', fetchImpl: f.impl });
  const req = f.calls[0].body.requests[0];
  assert.equal(req.content.parts[0].text, 'title: F-20 | text: Price is Rs 109');
  assert.equal(req.model, 'models/gemini-embedding-2');
  assert.equal(req.outputDimensionality, 4);
  assert.equal('taskType' in req, false);
  assert.ok(!f.calls[0].url.includes('KEY123'));
  assert.equal(f.calls[0].init.headers['x-goog-api-key'], 'KEY123');
});

test('claims are sent as fact-checking queries', () => {
  assert.equal(formatInput('gemini-embedding-2', 'query', 'Only Rs 99!'), 'task: fact checking | query: Only Rs 99!');
  assert.equal(formatInput('gemini-embedding-2', 'document', 'x'), 'title: none | text: x');
});

test('gemini-embedding-001: plain text plus a taskType', async () => {
  const f = fakeFetch();
  await embedWith({ ...base, model: 'gemini-embedding-001', texts: ['a'], kind: 'query', fetchImpl: f.impl });
  const req = f.calls[0].body.requests[0];
  assert.equal(req.content.parts[0].text, 'a');
  assert.equal(req.taskType, 'RETRIEVAL_QUERY');
});

test('vectors are cut to the requested size and scaled to length 1', async () => {
  const f = fakeFetch({ size: 8 });
  const [v] = await embedWith({ ...base, texts: ['a'], fetchImpl: f.impl });
  assert.equal(v.length, 4);
  assert.ok(Math.abs(Math.sqrt(v.reduce((s, x) => s + x * x, 0)) - 1) < 1e-9);
  assert.deepEqual(normalize([0, 0]), [0, 0]); // a zero vector is not divided by zero
});

test('more than 100 texts are sent in batches, in order', async () => {
  const f = fakeFetch();
  const texts = Array.from({ length: 250 }, (_, i) => `t${i}`);
  const out = await embedWith({ ...base, texts, fetchImpl: f.impl });
  assert.equal(out.length, 250);
  assert.deepEqual(f.calls.map((c) => c.body.requests.length), [100, 100, 50]);
});

test('503 is retried and then succeeds', async () => {
  const f = fakeFetch({ failures: [503] });
  const out = await embedWith({ ...base, texts: ['a'], fetchImpl: f.impl, retryOptions: { sleep: async () => {}, log: () => {} } });
  assert.equal(out.length, 1);
  assert.equal(f.calls.length, 2);
});

test('a bad key (403) is not retried and carries the status', async () => {
  const f = fakeFetch({ failures: [403, 403] });
  await assert.rejects(embedWith({ ...base, texts: ['a'], fetchImpl: f.impl }), (err) => err.status === 403 && /embedding API error 403/.test(err.message));
  assert.equal(f.calls.length, 1);
});

test('a wrong number of vectors is an error, not silent bad data', async () => {
  const impl = async () => ({ ok: true, json: async () => ({ embeddings: [] }) });
  await assert.rejects(embedWith({ ...base, texts: ['a'], fetchImpl: impl }), /unexpected number of vectors/);
});

test('no texts means no request', async () => {
  const f = fakeFetch();
  assert.deepEqual(await embedWith({ ...base, texts: [], fetchImpl: f.impl }), []);
  assert.equal(f.calls.length, 0);
});
