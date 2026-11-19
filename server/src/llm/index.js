import { config } from '../config.js';

// SRS 8 adapter contract: complete({ system, user }) -> Promise<string>
// The provider comes from LLM_PROVIDER and the model from LLM_MODEL. This is the
// only file that talks to an AI provider; the rest of the app just calls complete().

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Gemini 3.x models take a thinking level instead of a sampling temperature.
// "low" keeps latency inside LLM_TIMEOUT_MS (the default, "medium", is slower), and
// "minimal" is not supported by gemini-3.8-flash. Change to 'medium' for deeper checks.
const GEMINI_THINKING_LEVEL = 'low';

// Retry policy. Google answers 503 ("high demand") and 429 (rate limit) quickly and they
// are usually temporary, so a short pause and a second try often works. At most two
// retries, and the WHOLE call (every try plus the pauses) stays inside LLM_TIMEOUT_MS,
// so a review never waits longer than before. Timeouts, bad keys (400/403) and
// unknown models (404) are NOT retried: trying again cannot fix them.
const RETRY_STATUSES = new Set([429, 503]);
const RETRY_DELAYS_MS = [1000, 2500]; // pause before retry 1 and retry 2
const MAX_RETRY_AFTER_MS = 5000; // never obey a longer "Retry-After" than this
const MIN_ATTEMPT_MS = 3000; // do not start another try with less time than this left

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs attempt(remainingMs) and retries it when it fails with a retryable HTTP status.
// `attempt` must throw an Error with a numeric `status` (and optionally `retryAfterMs`)
// for HTTP errors. `sleep` and `now` can be replaced in tests.
export async function callWithRetry(
  attempt,
  { totalMs, delays = RETRY_DELAYS_MS, sleep = realSleep, now = Date.now, log = console.warn } = {}
) {
  const deadline = now() + totalMs;
  for (let tries = 0; ; tries += 1) {
    try {
      return await attempt(deadline - now());
    } catch (err) {
      if (!RETRY_STATUSES.has(err?.status) || tries >= delays.length) throw err;
      const wait = Number.isFinite(err.retryAfterMs) ? Math.min(err.retryAfterMs, MAX_RETRY_AFTER_MS) : delays[tries];
      if (deadline - now() - wait < MIN_ATTEMPT_MS) throw err; // not enough time left for another try
      log(`[llm] Gemini answered ${err.status}; retrying in ${wait} ms (try ${tries + 2} of ${delays.length + 1})`);
      await sleep(wait);
    }
  }
}

// "Retry-After: 2" (seconds) -> 2000. Dates and junk -> undefined (the fixed delay is used).
function retryAfterMs(res) {
  const seconds = Number(res.headers?.get?.('retry-after'));
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

// Google documents that gemini-3.8-flash IGNORES temperature, top_p and top_k (the SRS
// asks for temperature 0), so none of them are sent. JSON mode plus the low thinking
// level is what keeps the output stable, and the verifier checks every answer anyway.
// One try; timeoutMs is the time left for THIS try.
async function geminiAttempt({ system, user, apiKey, model, timeoutMs }) {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;

  // Every message that can reach a log passes through here: never leak the key.
  const redact = (s) => String(s).split(apiKey).join('[redacted]');
  const transportError = (err) =>
    err.name === 'TimeoutError' || err.name === 'AbortError'
      ? new Error('Gemini request timed out')
      : new Error(`Gemini request failed: ${redact(err.message)}`);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      // The key travels in a header, never in the URL, so it cannot end up in logs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL },
        },
      }),
      signal: AbortSignal.timeout(Math.max(timeoutMs, 1)), // also covers reading the response body
    });
  } catch (err) {
    throw transportError(err);
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message || '';
    } catch {
      /* the error body was not JSON */
    }
    const err = new Error(`Gemini API error ${res.status}${detail ? `: ${redact(detail).slice(0, 200)}` : ''}`);
    err.status = res.status; // callWithRetry decides from this
    err.retryAfterMs = retryAfterMs(res);
    throw err;
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw transportError(err);
  }

  // Join the text parts; skip "thought" parts in case the API returns them.
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.filter((p) => typeof p?.text === 'string' && p.thought !== true).map((p) => p.text).join('')
    : '';
  if (!text.trim()) {
    const why = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'empty response';
    throw new Error(`Gemini returned no text (${why})`);
  }
  return text;
}

const completeWithGemini = ({ system, user, apiKey, model, timeoutMs }) =>
  callWithRetry((remainingMs) => geminiAttempt({ system, user, apiKey, model, timeoutMs: remainingMs }), {
    totalMs: timeoutMs,
  });

const PROVIDERS = { gemini: completeWithGemini };

// True when provider, key and model are all set and the provider is supported.
export function isLlmConfigured() {
  const { provider, apiKey, model } = config.llm;
  return Boolean(PROVIDERS[(provider || '').toLowerCase()] && apiKey && model);
}

export async function complete({ system, user }) {
  const { provider, apiKey, model, timeoutMs } = config.llm;
  const impl = PROVIDERS[(provider || '').toLowerCase()];
  if (!impl) throw new Error(`LLM_PROVIDER "${provider || ''}" is not supported (use "gemini")`);
  if (!apiKey) throw new Error('LLM_API_KEY is not set');
  if (!model) throw new Error('LLM_MODEL is not set');
  return impl({ system, user, apiKey, model, timeoutMs });
}
