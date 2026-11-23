import { config } from '../config.js';
import { callWithRetry } from './index.js';

// Round 3, improvement 1: text embeddings for claim-to-fact matching.
// Like llm/index.js this is the only place that talks to the provider, so the rest of
// the app only sees embedTexts(texts, { kind }) -> number[][].
//
// Model: LLM_EMBED_MODEL (gemini-embedding-2 or gemini-embedding-001). A text-generation
// model such as gemini-3.x-flash cannot create embeddings.
// Size:  LLM_EMBED_DIMENSIONS (default 768). Google's models are trained so that a
//        shortened vector stays useful, so we ask for 768 numbers instead of 3072.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const BATCH_SIZE = 100; // batchEmbedContents accepts up to 100 requests per call

export function isEmbedConfigured() {
  const { provider, apiKey, embedModel } = config.llm;
  return (provider || '').toLowerCase() === 'gemini' && Boolean(apiKey && embedModel);
}

// gemini-embedding-2 has no taskType field: the task goes into the text itself.
// gemini-embedding-001 takes a taskType and plain text.
const usesPrefixes = (model) => /embedding-2/i.test(model);

// kind 'document' = a stored fact; kind 'query' = a claim we want to check against facts.
// Exported so tests can pin the exact request text.
export function formatInput(model, kind, text, title) {
  if (!usesPrefixes(model)) return text;
  return kind === 'query'
    ? `task: fact checking | query: ${text}`
    : `title: ${title || 'none'} | text: ${text}`;
}

// Scale to length 1, so cosine similarity is a plain dot product and scores are comparable.
export function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return norm === 0 ? vector.slice() : vector.map((x) => x / norm);
}

// The core, with every dependency passable so it can be tested without a network.
// Returns one normalized vector of length `dims` per input text, in the same order.
export async function embedWith({
  texts,
  kind = 'document',
  titles = [],
  apiKey,
  model,
  dims,
  timeoutMs,
  fetchImpl = fetch,
  retryOptions = {},
}) {
  if (!texts.length) return [];
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:batchEmbedContents`;
  const redact = (s) => String(s).split(apiKey).join('[redacted]');
  const out = [];

  for (let from = 0; from < texts.length; from += BATCH_SIZE) {
    const chunk = texts.slice(from, from + BATCH_SIZE);
    const body = {
      requests: chunk.map((text, i) => ({
        model: `models/${model}`,
        content: { parts: [{ text: formatInput(model, kind, text, titles[from + i]) }] },
        outputDimensionality: dims,
        ...(usesPrefixes(model) ? {} : { taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT' }),
      })),
    };

    const attempt = async (remainingMs) => {
      let res;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, // key in a header, never the URL
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.max(remainingMs, 1)),
        });
      } catch (err) {
        throw err.name === 'TimeoutError' || err.name === 'AbortError'
          ? new Error('Gemini embedding request timed out')
          : new Error(`Gemini embedding request failed: ${redact(err.message)}`);
      }
      if (!res.ok) {
        let detail = '';
        try {
          detail = (await res.json())?.error?.message || '';
        } catch {
          /* the error body was not JSON */
        }
        const err = new Error(`Gemini embedding API error ${res.status}${detail ? `: ${redact(detail).slice(0, 200)}` : ''}`);
        err.status = res.status; // callWithRetry retries 429 and 503 only
        const seconds = Number(res.headers?.get?.('retry-after'));
        if (Number.isFinite(seconds) && seconds >= 0) err.retryAfterMs = seconds * 1000;
        throw err;
      }
      return res.json();
    };

    const data = await callWithRetry(attempt, { totalMs: timeoutMs, ...retryOptions });
    const embeddings = data?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== chunk.length) {
      throw new Error('Gemini embedding API returned an unexpected number of vectors');
    }
    for (const e of embeddings) {
      const values = e?.values;
      if (!Array.isArray(values) || values.length < dims) {
        throw new Error('Gemini embedding API returned a vector shorter than requested');
      }
      out.push(normalize(values.slice(0, dims))); // cut to size, then rescale to length 1
    }
  }
  return out;
}

export async function embedTexts(texts, { kind = 'document', titles = [] } = {}) {
  const { apiKey, embedModel, embedDimensions, timeoutMs } = config.llm;
  if (!isEmbedConfigured()) throw new Error('LLM_EMBED_MODEL is not set');
  return embedWith({ texts, kind, titles, apiKey, model: embedModel, dims: embedDimensions, timeoutMs });
}
