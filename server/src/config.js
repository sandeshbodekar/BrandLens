import 'dotenv/config';

// Single place that reads environment variables. Nothing else touches process.env.
export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,

  // CLIENT_ORIGIN may hold one URL or several separated by commas
  // (e.g. localhost + the Vercel URL). Trailing slashes are stripped because
  // browsers send the Origin header without one, and a mismatch breaks CORS.
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),

  llm: {
    provider: process.env.LLM_PROVIDER,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 20000,

    // Round 3: embeddings for claim-to-fact matching (llm/embed.js).
    // This must be an EMBEDDING model (gemini-embedding-2 or gemini-embedding-001),
    // not the text model in LLM_MODEL. Leave empty to turn matching off.
    embedModel: process.env.LLM_EMBED_MODEL,
    embedDimensions: Number(process.env.LLM_EMBED_DIMENSIONS) || 768,
  },
};
