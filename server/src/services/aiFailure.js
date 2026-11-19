// Turns "why did the AI step not run?" into a short reason code and a plain sentence
// for the review page, so a judge sees what happened instead of a generic fallback.
// Pure functions: no network, no draft text, no keys (error messages are already redacted).

const OVERLOAD_STATUSES = new Set([500, 502, 503, 504]);

// err comes from llm/index.js. Its message looks like "Gemini API error 429: ...",
// "Gemini request timed out ..." or "Gemini request failed: ...". An err.status, if
// present, wins over the text.
export function classifyAiFailure(err) {
  const text = String(err?.message || err || '');
  const status = Number(err?.status) || Number((text.match(/error (\d{3})/i) || [])[1]) || null;

  if (status === 429) {
    return { reason: 'rate_limited', message: 'The Gemini AI service is getting too many requests right now (rate limit reached).' };
  }
  if ((status && OVERLOAD_STATUSES.has(status)) || /overloaded|unavailable/i.test(text)) {
    return { reason: 'overloaded', message: 'The Gemini AI service is overloaded or temporarily unavailable.' };
  }
  if (/timed out|timeout/i.test(text)) {
    return { reason: 'timeout', message: 'The Gemini AI service took too long to answer.' };
  }
  if (status === 400 || status === 401 || status === 403 || /api key|LLM_API_KEY/i.test(text)) {
    return { reason: 'auth', message: 'The Gemini AI service rejected the server’s API key or request.' };
  }
  if (status === 404) {
    return { reason: 'model', message: 'The configured Gemini model was not found.' };
  }
  if (/returned no text/i.test(text)) {
    return { reason: 'empty', message: 'The Gemini AI service returned no usable answer.' };
  }
  if (/request failed|fetch failed|ENOTFOUND|ECONN/i.test(text)) {
    return { reason: 'network', message: 'The server could not reach the Gemini AI service.' };
  }
  return { reason: 'error', message: 'The Gemini AI service returned an error.' };
}

export const AI_REASONS = {
  disabled: 'AI mode is switched off for this workspace, so this review uses the rule checks only.',
  not_configured: 'The AI service is not configured on the server.',
  parse_failed: 'The AI answer could not be read.',
};
