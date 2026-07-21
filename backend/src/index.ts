import dotenv from 'dotenv';
import { startServer } from './app/server';
import { logger } from './utils/system/logger';

// Load environment variables
dotenv.config();

// Global error handlers to ensure crashes are logged
process.on('uncaughtException', (err) => {
  logger.error('Fatal Uncaught Exception', 'System', err);
  // Give a small window for logs to flush before exiting
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', 'System', reason instanceof Error ? reason : { message: String(reason) });
});

// Boot the application
startServer();
