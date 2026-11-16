import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';

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

export default app;
