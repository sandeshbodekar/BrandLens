import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import clauseRoutes from './routes/clauses.js';
import factRoutes from './routes/facts.js';
import termRoutes from './routes/terms.js';
import demoRoutes from './routes/demo.js';
import draftRoutes from './routes/drafts.js';

const app = express();

app.use(helmet());
// With an array, cors echoes back the Origin only if it is in the list.
// Requests with no Origin (curl, server-to-server) are allowed through.
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// SRS 7.7
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// SRS 7.1
app.use('/api/auth', authRoutes);

// SRS 7.2: knowledge base
app.use('/api/clauses', clauseRoutes);
app.use('/api/facts', factRoutes);
app.use('/api/terms', termRoutes);

// SRS 7.3, 7.4
app.use('/api/drafts', draftRoutes);

// SRS 7.7
app.use('/api/demo', demoRoutes);

export default app;
