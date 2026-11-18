import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { auth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import { apiLimiter, loginLimiter, demoLoginLimiter, reviewLimiter, resetLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import clauseRoutes from './routes/clauses.js';
import factRoutes from './routes/facts.js';
import termRoutes from './routes/terms.js';
import demoRoutes from './routes/demo.js';
import draftRoutes from './routes/drafts.js';
import commentRoutes from './routes/comments.js';
import findingRoutes from './routes/findings.js';
import workspaceRoutes from './routes/workspace.js';

const app = express();

// Render (and Vercel) put a proxy in front of the server. Without this, every visitor
// would share the proxy's IP and therefore ONE rate-limit bucket. "1" = trust one hop.
app.set('trust proxy', 1);

app.use(helmet());
// With an array, cors echoes back the Origin only if it is in the list.
// Requests with no Origin (curl, server-to-server) are allowed through.
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// SRS 7.7. Registered before the limiter so uptime checks never use up the budget.
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Rate limits (SRS 10). The general limiter covers everything below.
app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/demo', demoLoginLimiter);
// Per-user limits need to know the user, so `auth` runs first. These handlers call next()
// and the real route (which authenticates again) answers. One extra lookup on rare routes.
app.post('/api/drafts/:id/review', auth, reviewLimiter);
app.post('/api/demo/reset', auth, resetLimiter);

// SRS 7.1
app.use('/api/auth', authRoutes);

// SRS 7.2: knowledge base
app.use('/api/clauses', clauseRoutes);
app.use('/api/facts', factRoutes);
app.use('/api/terms', termRoutes);

// SRS 7.6: /:id/comments and /:id/audit. Mounted on the same prefix as the drafts
// router; the paths do not overlap, so the order does not matter.
app.use('/api/drafts', commentRoutes);

// SRS 7.3, 7.4, 7.5, 7.6
app.use('/api/drafts', draftRoutes);

// SRS 7.5
app.use('/api/findings', findingRoutes);

// SRS 7.7
app.use('/api/workspace', workspaceRoutes);
app.use('/api/demo', demoRoutes);

// Must stay last: unknown /api paths first, then every error from the routes above.
app.use('/api', notFound);
app.use(errorHandler);

export default app;
