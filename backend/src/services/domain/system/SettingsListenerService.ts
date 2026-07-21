import pool from '../../../config/database';
import { logger } from '../../../utils/system/logger';
import { configCache, regionalMappingCache, settingsCache } from '../../../utils/cache';

/**
 * Connects to PostgreSQL and listens for changes in system settings or retailer configs.
 */
export function startSettingsListener() {
  if (process.env.NODE_ENV === 'test') return;

  let client: any = null;

  async function connectAndListen() {
    try {
      client = await pool.connect();
      
      logger.info('System | Settings Listener | Connected to database', 'Database');
      await client.query('LISTEN settings_change');

      let debounceTimeout: NodeJS.Timeout | null = null;
      const pendingPayloads = new Set<string>();

      client.on('notification', (msg: any) => {
        if (msg.channel === 'settings_change') {
          pendingPayloads.add(msg.payload);

          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }

          debounceTimeout = setTimeout(() => {
            const payloads = Array.from(pendingPayloads).join(', ');
            logger.info(`System | Settings Listener | Notifications processed: [${payloads}]. Clearing cache.`, 'System');
            configCache.invalidate();
            regionalMappingCache.clear();
            settingsCache.clear();
            pendingPayloads.clear();
            debounceTimeout = null;
          }, 250);
        }
      });

      client.on('error', (err: any) => {
        logger.error('System | Settings Listener | DB Client error', 'Database', err);
        reconnect();
      });

      client.on('end', () => {
        logger.warn('System | Settings Listener | DB Connection ended', 'Database');
        reconnect();
      });

    } catch (error) {
      logger.error('System | Settings Listener | Failed to connect and listen', 'Database', error);
      reconnect();
    }
  }

  let reconnectTimeout: any = null;
  function reconnect() {
    if (client) {
      try {
        client.release(true); // force destroy this client
      } catch (e) {}
      client = null;
    }

    if (reconnectTimeout) return;
    
    logger.info('System | Settings Listener | Scheduling reconnection in 5s...', 'Database');
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connectAndListen();
    }, 5000);
  }

  connectAndListen();
}
