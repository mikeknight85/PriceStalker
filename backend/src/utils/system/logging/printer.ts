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

export function print(level: LogLevel, msg: string, context?: string, details?: any) {
  msg = scrubSensitiveData(msg);
  if (context) context = scrubSensitiveData(context);
  if (details) details = scrubSensitiveData(details);

  const currentConsoleLevel = process.env.CONSOLE_LOG_LEVEL || process.env.LOG_LEVEL || (process.env.DEBUG === 'true' ? 'DEBUG' : DEFAULT_LOG_LEVEL);
  const currentFileLevel = process.env.FILE_LOG_LEVEL || process.env.LOG_LEVEL || (process.env.DEBUG === 'true' ? 'DEBUG' : DEFAULT_LOG_LEVEL);
  
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

  const ts = new Date().toLocaleString('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/,/, '');
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

  // --- DATABASE PERSISTENCE RULES ---
  let shouldSaveToDb = false;
  const noiseContexts = ['HTTP', 'Database', 'Scheduler'];

  if (level === 'ERROR' || level === 'WARN') {
    shouldSaveToDb = true;
  } else if (level === 'INFO') {
    // Only save INFO if it's not a noise context
    shouldSaveToDb = !noiseContexts.includes(context || '');
  } else if (level === 'DEBUG') {
    // Only save DEBUG if it's the consolidated Voting trace
    shouldSaveToDb = (context === 'Voting');
  }

  if (shouldSaveToDb) {
    saveToDb(level, cleanMsg, context, details).catch(() => {});
  }
}
