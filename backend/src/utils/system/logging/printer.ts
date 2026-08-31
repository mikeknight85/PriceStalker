import { LogLevel, saveToDb } from './persistence';
import fs from 'fs';
import path from 'path';
import { scrubSensitiveData } from './scrubber';

const DEFAULT_LOG_LEVEL = 'INFO';
const LOG_DIR = process.env.LOG_DIR_PATH || path.join(process.cwd(), 'logs');

function writeToLogFile(level: LogLevel, outputLine: string) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const generalLogPath = path.join(LOG_DIR, 'backend.log');
    fs.appendFileSync(generalLogPath, outputLine + '\n');

    if (level === 'WARN' || level === 'ERROR') {
      const errorLogPath = path.join(LOG_DIR, 'error.log');
      fs.appendFileSync(errorLogPath, outputLine + '\n');
    }
  } catch (err) {
    console.error('Logger failed writing to disk:', err);
  }
}


function getLogLevelValue(level: LogLevel | string): number {
  switch (level.toUpperCase()) {
    case 'DEBUG': return 0;
    case 'INFO': return 1;
    case 'WARN': return 2;
    case 'ERROR': return 3;
    default: return 1;
  }
}

/**
 * Each sink has its own threshold, falling back to the global LOG_LEVEL.
 * These are read per call rather than cached so a level can be changed without
 * a restart.
 */
function getSinkLevels() {
  const global =
    process.env.LOG_LEVEL || (process.env.DEBUG === 'true' ? 'DEBUG' : DEFAULT_LOG_LEVEL);
  return {
    console: process.env.CONSOLE_LOG_LEVEL || global,
    file: process.env.FILE_LOG_LEVEL || global,
    database: process.env.DB_LOG_LEVEL || global,
  };
}

/**
 * True when at least one sink would accept this level. Callers use it to skip
 * building a message no sink will keep -- most usefully `logger.debug`, which
 * would otherwise format and scrub text that is thrown away.
 */
export function isLevelEnabled(level: LogLevel): boolean {
  const value = getLogLevelValue(level);
  const levels = getSinkLevels();
  return (
    value >= getLogLevelValue(levels.console) ||
    value >= getLogLevelValue(levels.file) ||
    value >= getLogLevelValue(levels.database)
  );
}

/**
 * High-volume contexts. Below WARN they are operational chatter that would bloat
 * system_logs without telling an administrator anything; at WARN and above they
 * describe an actual problem and are always worth keeping.
 */
const NOISE_CONTEXTS = ['HTTP', 'Database', 'Scheduler'];

export function print(level: LogLevel, msg: string, context?: string, details?: any) {
  msg = scrubSensitiveData(msg);
  if (context) context = scrubSensitiveData(context);
  if (details) details = scrubSensitiveData(details);

  const sinkLevels = getSinkLevels();
  const currentConsoleLevel = sinkLevels.console;
  const currentFileLevel = sinkLevels.file;
  
  // Clean up redundant context in message
  let cleanMsg = msg;

  if (context) {
    // Match context at the start: "Context | ..." or "Context: ..."
    const startPattern = new RegExp('^' + context.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' [|:] ');
    cleanMsg = cleanMsg.replace(startPattern, '');
    
    // Match context in the middle: "... | Context | ..."
    const midPattern = new RegExp(' [|:] ' + context.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' [|:] ');
    cleanMsg = cleanMsg.replace(midPattern, ' | ');
  }

  // Strip common redundant prefixes
  cleanMsg = cleanMsg.replace(/^System [|:] /, '');

  const ts = new Date().toISOString();
  const ctx = context ? ' [' + context + ']' : '';

  // Prepare Console-safe version (Strip HTML tags for Docker visibility)
  let consoleMsg = cleanMsg.replace(/<br\s*\/?>/gi, ' | ');
  consoleMsg = consoleMsg.replace(/<[^>]*>?/gm, '');
  consoleMsg = consoleMsg.replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Include trace in console if provided in details
  if (details?.trace) {
    let traceSteps: string[] = [];
    if (Array.isArray(details.trace)) {
      traceSteps = details.trace;
    } else if (typeof details.trace === 'string') {
      traceSteps = details.trace.split(/<br\s*\/?>/gi);
    }
    
    if (traceSteps.length > 0) {
      consoleMsg += '\n' + traceSteps.map((step: string) => {
        const cleanStep = step.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').replace(/\s{2,}/g, ' ').trim();
        return `    ↳ ${cleanStep}`;
      }).join('\n');
    }
  }

  let metaStr = '';
  if (details && typeof details === 'object') {
    const metaParts: string[] = [];
    if (details.requestId) metaParts.push(`requestId=${details.requestId}`);
    if (details.product_id) metaParts.push(`productId=${details.product_id}`);
    const domainVal = details.retailer_domain || details.domain;
    if (domainVal) metaParts.push(`domain=${domainVal}`);
    
    if (metaParts.length > 0) {
      metaStr = ` (${metaParts.join(', ')})`;
    }
  }

  const output = '[' + ts + '] ' + level + ctx + metaStr + ': ' + consoleMsg;
  
  // 1. CONSOLE OUTPUT
  if (getLogLevelValue(level) >= getLogLevelValue(currentConsoleLevel)) {
    if (level === 'ERROR') {
      console.error(output);
    } else if (level === 'WARN') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  // 2. FILE OUTPUT (PERSISTENT LOGS)
  if (getLogLevelValue(level) >= getLogLevelValue(currentFileLevel)) {
    let fileOutput = output;
    
    // Audit #5: Include stack traces in disk logs if present
    const stack = details?.stack || (details?.error instanceof Error ? details.error.stack : undefined);
    if (level === 'ERROR' && stack) {
      fileOutput += '\n' + stack;
    }

    writeToLogFile(level, fileOutput);
  }

  // 3. DATABASE PERSISTENCE
  // Previously this ignored the configured level entirely: every INFO was
  // written whatever LOG_LEVEL said, while DEBUG could never be written at all.
  // The threshold now applies here like it does to the other two sinks.
  const isProblem = level === 'WARN' || level === 'ERROR';
  const shouldSaveToDb =
    getLogLevelValue(level) >= getLogLevelValue(sinkLevels.database) &&
    (isProblem || !NOISE_CONTEXTS.includes(context || ''));

  if (shouldSaveToDb) {
    saveToDb(level, cleanMsg, context, details).catch(() => {});
  }
}
