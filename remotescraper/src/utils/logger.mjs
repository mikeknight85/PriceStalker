/**
 * Enhanced logger with timestamp, levels, and context support
 */

const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CURRENT_LEVEL = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
const MIN_LEVEL = LEVELS[CURRENT_LEVEL] !== undefined ? LEVELS[CURRENT_LEVEL] : LEVELS.INFO;

/**
 * Formatted logger with timestamp and optional context
 */
export function log(message, type = 'INFO', context = {}) {
  const levelValue = LEVELS[type.toUpperCase()] !== undefined ? LEVELS[type.toUpperCase()] : LEVELS.INFO;
  
  if (levelValue < MIN_LEVEL && !context.forceDebug) {
    return;
  }

  const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' });
  const typeStr = type.padEnd(5);
  
  // Format context identifiers
  let ctxStr = '';
  if (context.requestId) ctxStr += ` [${context.requestId}]`;
  if (context.productId) ctxStr += ` [PROD-${context.productId}]`;
  
  const output = `[${timestamp}] ${typeStr} |${ctxStr} ${message}`;
  
  if (levelValue >= LEVELS.ERROR) {
    console.error(output);
  } else {
    console.log(output);
  }

  // If there's extra metadata, log it as an object
  if (context.metadata) {
    console.dir(context.metadata, { depth: null, colors: true });
  }
}
