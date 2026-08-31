import { print, isLevelEnabled } from './printer';

export const logger = {
  info: (msg: string, context?: string, details?: any) => print('INFO', msg, context, details),
  warn: (msg: string, context?: string, details?: any) => print('WARN', msg, context, details),
  error: (msg: string, context?: string | Error, errorOrDetails?: any) => {
    if (context instanceof Error) {
      const err = context;
      print('ERROR', err.message, 'Error', { error: err.message, stack: err.stack });
      if (err.stack) console.error(err.stack);
    } else {
      let details = errorOrDetails;
      if (errorOrDetails instanceof Error) {
        details = { error: errorOrDetails.message, stack: errorOrDetails.stack };
      } else if (errorOrDetails && typeof errorOrDetails === 'object') {
        // If it's a details object that has an 'error' property which is an Error object
        if (errorOrDetails.error instanceof Error) {
          errorOrDetails.stack = errorOrDetails.stack || errorOrDetails.error.stack;
          errorOrDetails.error = errorOrDetails.error.message;
        }
      }
      
      print('ERROR', msg, context, details);
      
      // Console error output
      if (errorOrDetails) {
        const stack = errorOrDetails.stack || (errorOrDetails instanceof Error ? errorOrDetails.stack : undefined);
        if (stack) console.error(stack);
        else if (errorOrDetails instanceof Error) console.error(errorOrDetails);
        else if (errorOrDetails.error) console.error(errorOrDetails.error);
      }
    }
  },
  debug: (msg: string, context?: string, details?: any) => {
    // This used to check the global LOG_LEVEL only, so setting
    // CONSOLE_LOG_LEVEL=debug or DB_LOG_LEVEL=debug on its own produced no
    // debug output at all. Ask the printer whether any sink wants it.
    if (isLevelEnabled('DEBUG')) {
      print('DEBUG', msg, context, details);
    }
  },
};
