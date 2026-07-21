import express from 'express';
import { log } from './utils/logger.mjs';
import { startWatchdog } from './core/SessionManager.mjs';
import router from './api/routes.mjs';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 5100;

// Use modular routes
app.use('/', router);

// Start browser watchdog
startWatchdog();

app.listen(PORT, '0.0.0.0', () => {
  log(`Remotescraper API listening at http://0.0.0.0:${PORT}`, 'INFO');
});
