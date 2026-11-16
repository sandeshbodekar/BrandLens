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

  // Read now so config.js is complete; used from Phase 3.
  llm: {
    provider: process.env.LLM_PROVIDER,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 20000,
  },
};
