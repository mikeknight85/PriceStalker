import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from '../routes/auth';
import productRoutes from '../routes/products';
import priceRoutes from '../routes/prices';
import settingsRoutes from '../routes/settings';
import profileRoutes from '../routes/profile';
import adminRoutes from '../routes/admin';
import notificationRoutes from '../routes/notifications';
import { requestLogger, logger } from '../utils/system/logger';
import pool from '../config/database';

const app = express();

// Ensure debug directory exists
const debugDir = path.join(process.cwd(), 'debug_html');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(requestLogger);

// Serve debug HTML files
app.use('/debug_files', express.static(debugDir));

// Health check endpoint
app.get('/health', async (_, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      db: 'ok',
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    logger.error('Health Check Failed', 'System', err);
    res.status(503).json({ 
      status: 'error', 
      db: 'unreachable',
      timestamp: new Date().toISOString() 
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error('Unhandled server error', 'System', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

export default app;
