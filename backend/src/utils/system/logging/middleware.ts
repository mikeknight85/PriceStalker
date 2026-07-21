import { logger } from './logger';
import { scrubSensitiveData } from './scrubber';

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: () => void) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    const userId = req.userId || req.user?.id;
    const userStr = userId ? ` | User: ${userId}` : '';
    const msg = req.method + ' ' + req.originalUrl + ' ' + res.statusCode + ' (' + elapsed + 'ms)' + userStr;
    
    // Noise reduction: ignore successful polling routes to prevent log bloat
    const ignoreRoutes = ['/api/notifications/recent', '/health'];
    const shouldIgnore = ignoreRoutes.some(path => req.originalUrl.includes(path)) && res.statusCode < 400;
    if (shouldIgnore) return;

    // Noise reduction: frequent polling and debug routes are logged at DEBUG level
    const pollingRoutes = ['/api/notifications/recent', '/api/admin/logs', '/api/admin/debug', '/health'];
    const isPolling = pollingRoutes.some(path => req.originalUrl.includes(path));

    if (res.statusCode >= 400) {
      logger.warn(msg, 'HTTP');
    } else if (isPolling) {
      logger.debug(msg, 'HTTP');
    } else {
      logger.info(msg, 'HTTP');
    }

    // Extended Debug Logging
    if (process.env.DEBUG === 'true') {
      const debugDetails: any = {
        elapsed: `${elapsed}ms`,
        status: res.statusCode,
        method: req.method,
        url: req.originalUrl,
        userId: userId || null
      };
      
      if (req.query && Object.keys(req.query).length > 0) {
        debugDetails.query = scrubSensitiveData(req.query);
      }
      
      if (req.body && Object.keys(req.body).length > 0) {
        debugDetails.body = scrubSensitiveData(req.body);
      }
      
      logger.debug(`${req.method} ${req.originalUrl} | Request Details`, 'HTTP', debugDetails);
    }
  });
  next();
};
