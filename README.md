# BrandLens

Pre-publication brand-governance platform. See `SRS.md` for the full specification.

## Local setup

**Server**
```bash
cd server
cp .env.example .env     # fill in MONGODB_URI
npm install
npm run dev              # http://localhost:5000
```

**Client**
```bash
cd client
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

## Deploy notes (Phase 0)

1. **Atlas:** create a free cluster and a DB user. Under Network Access add `0.0.0.0/0` (Render needs this). Copy the connection string and add the database name `brandlens`.
2. **Render (server):** Root Directory `server`, Build Command `npm install`, Start Command `node src/index.js`. Env vars: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (the Vercel URL, no trailing slash), `LLM_TIMEOUT_MS=20000`. Free instances sleep, so the first request after idle can take about 50 seconds.
3. **Vercel (client):** Root Directory `client`, Build Command `npm run build`, Output `dist`. Env var `VITE_API_URL` = the Render URL. Vite bakes this in at build time, so redeploy after changing it. `vercel.json` rewrites all paths to `index.html` so deep links work.
4. After both are live, set Render's `CLIENT_ORIGIN` to the final Vercel URL and redeploy the server.
