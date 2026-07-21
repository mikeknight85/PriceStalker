// PriceGhost Frontend Logger Utility
// Provides standardized logging with timestamps and log levels

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export const logger = {
  info: (msg: string, context?: string) => print('INFO', msg, context),
  warn: (msg: string, context?: string) => print('WARN', msg, context),
  error: (msg: string, context?: string | Error, error?: any) => {
    if (context instanceof Error) {
      print('ERROR', context.message, 'Error');
      if (context.stack) console.error(context.stack);
    } else {
      print('ERROR', msg, context);
      if (error) {
        if (error.stack) console.error(error.stack);
        else console.error(error);
      }
    }
  },
  debug: (msg: string, context?: string) => {
    // Only show debug logs in development or if explicitly enabled
    if (import.meta.env.DEV || localStorage.getItem('DEBUG') === 'true') {
      print('DEBUG', msg, context);
    }
  },
};

function print(level: LogLevel, msg: string, context?: string) {
  const ts = new Date().toISOString();
  const ctx = context ? ' [' + context + ']' : '';
  const output = '[' + ts + '] ' + level + ctx + ': ' + msg;

  if (level === 'ERROR') {
    console.error(output);
  } else if (level === 'WARN') {
    console.warn(output);
  } else {
    console.log(output);
  }
}
