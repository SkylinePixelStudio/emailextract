import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Ensure directories exist
['uploads', 'exports', 'logs'].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting
app.use(rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
  max: CONFIG.RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later' },
}));

// Routes
app.use('/api/auth', (await import('./routes/auth')).default);
app.use('/api/crawl', (await import('./routes/crawl')).default);
app.use('/api/contacts', (await import('./routes/contacts')).default);
app.use('/api/exports', (await import('./routes/exports')).default);
app.use('/api/campaigns', (await import('./routes/campaigns')).default);
app.use('/api/dashboard', (await import('./routes/dashboard')).default);
app.use('/api/unsubscribe', (await import('./routes/unsubscribe')).default);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

app.listen(CONFIG.PORT, () => {
  logger.info(`🚀 Server running on port ${CONFIG.PORT} in ${CONFIG.NODE_ENV} mode`);
});
