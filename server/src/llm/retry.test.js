import test from 'node:test';
import assert from 'node:assert/strict';
import { callWithRetry, complete } from './index.js';
import { config } from '../config.js';

// A fake clock: sleeping just moves time forward, so tests run instantly.
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; }, advance: (ms) => { t += ms; } };
}
const httpError = (status, extra = {}) => Object.assign(new Error(`HTTP ${status}`), { status, ...extra });
const quiet = () => {};

test('a 503 then success: one retry, waiting 1000 ms, and the result is returned', async () => {
  const c = clock(); const waits = []; let calls = 0;
  const out = await callWithRetry(
    async () => { calls += 1; if (calls === 1) throw httpError(503); return 'ok'; },
    { totalMs: 20000, now: c.now, sleep: async (ms) => { waits.push(ms); await c.sleep(ms); }, log: quiet }
  );
  assert.equal(out, 'ok'); assert.equal(calls, 2); assert.deepEqual(waits, [1000]);
});

test('429 is retried too, at most twice (3 tries), then the last error is thrown', async () => {
  const c = clock(); let calls = 0;
  await assert.rejects(
    callWithRetry(async () => { calls += 1; throw httpError(429); }, { totalMs: 20000, now: c.now, sleep: c.sleep, log: quiet }),
    { status: 429 }
  );
  assert.equal(calls, 3);
});

test('errors that retrying cannot fix are thrown at once: 400, 403, 404, timeouts, unknown errors', async () => {
  for (const err of [httpError(400), httpError(403), httpError(404), new Error('Gemini request timed out'), new Error('boom')]) {
    const c = clock(); let calls = 0;
    await assert.rejects(callWithRetry(async () => { calls += 1; throw err; }, { totalMs: 20000, now: c.now, sleep: c.sleep, log: quiet }));
    assert.equal(calls, 1, `no retry for ${err.message}`);
  }
});

test('Retry-After is used, but capped at 5 seconds', async () => {
  const c = clock(); const waits = []; let calls = 0;
  await callWithRetry(
    async () => { calls += 1; if (calls === 1) throw httpError(429, { retryAfterMs: 2000 }); if (calls === 2) throw httpError(429, { retryAfterMs: 60000 }); return 'ok'; },
    { totalMs: 30000, now: c.now, sleep: async (ms) => { waits.push(ms); await c.sleep(ms); }, log: quiet }
  );
  assert.deepEqual(waits, [2000, 5000]);
});

test('the whole call stays inside the time limit: no retry when too little time is left', async () => {
  const c = clock(); let calls = 0;
  await assert.rejects(
    callWithRetry(async () => { calls += 1; c.advance(4500); throw httpError(503); }, { totalMs: 8000, now: c.now, sleep: c.sleep, log: quiet }),
    { status: 503 }
  );
  assert.equal(calls, 1); // 3500 ms left minus the 1000 ms pause is under the 3000 ms minimum
});

test('complete() with a faked Gemini: 503 once, then a good answer', async () => {
  const realFetch = globalThis.fetch; const saved = { ...config.llm };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response(JSON.stringify({ error: { message: 'high demand' } }), { status: 503, headers: { 'retry-after': '0' } })
      : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }), { status: 200 });
  };
  Object.assign(config.llm, { provider: 'gemini', apiKey: 'test-key', model: 'm', timeoutMs: 20000 });
  const log = console.warn; console.warn = quiet;
  try {
    assert.equal(await complete({ system: 's', user: 'u' }), '[]');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch; Object.assign(config.llm, saved); console.warn = log;
  }
});
