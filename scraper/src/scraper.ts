import express from 'express';
import { log } from './utils/logger.js';
import { startWatchdog, cleanupStaleProfiles, shutdownAllSessions } from './core/SessionManager.js';
import router from './api/routes.js';
import { errorMessage } from './types.js';
import { invalidTimezone } from './utils/timestamp.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT) || 5100;

// Use modular routes
app.use('/', router);

// Reap browser profiles leaked by a previous run (crash, SIGKILL) before
// launching anything new — see issue #52.
cleanupStaleProfiles().catch((error: unknown) => {
  log(`Startup profile sweep failed: ${errorMessage(error)}`, 'WARN');
});

// Start browser watchdog
startWatchdog();

// Close every browser (deleting its profile) before the container stops, so
// profiles do not accumulate across restarts.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log(`Received ${signal}, closing browser sessions...`, 'INFO');
    void shutdownAllSessions().finally(() => process.exit(0));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  // Once, at startup: a misspelled TZ falls back to UTC rather than throwing,
  // so without this the operator has no way to tell why it was ignored.
  const badTz = invalidTimezone();
  if (badTz) {
    log(`TZ="${badTz}" is not a timezone this runtime recognises. Log timestamps will use UTC.`, 'WARN');
  }
  log(`Scraper API listening at http://0.0.0.0:${PORT}`, 'INFO');
});
