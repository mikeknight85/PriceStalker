/**
 * Scrubs inline credentials from a URL string (e.g., http://user:pass@host -> http://[REDACTED]:[REDACTED]@host)
 */
export const scrubUrlCredentials = (val: string): string => {
  if (typeof val !== 'string') return val;
  // Replace username:password in URL (http://user:pass@host)
  return val.replace(/(https?:\/\/)([^:]+):([^@]+)(@[^\s/?#]+)/gi, '$1[REDACTED]:[REDACTED]$4');
};

/**
 * Scrubs sensitive keys and URL credentials from any data type (object, array, string, Error)
 */
export const scrubSensitiveData = (data: any): any => {
  if (!data) return data;

  if (typeof data === 'string') {
    return scrubUrlCredentials(data);
  }

  if (data instanceof Error) {
    const msg = scrubUrlCredentials(data.message);
    const stack = data.stack ? scrubUrlCredentials(data.stack) : undefined;
    const scrubbedError = new Error(msg);
    scrubbedError.name = data.name;
    if (stack) scrubbedError.stack = stack;
    return scrubbedError;
  }

  if (Array.isArray(data)) {
    return data.map(item => scrubSensitiveData(item));
  }

  if (typeof data === 'object') {
    const scrubbed: any = {};
    const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'password_hash', 'token_hash', 'authorization', 'proxy'];
    
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        if (key.toLowerCase().includes('proxy') && typeof val === 'boolean') {
          scrubbed[key] = val;
        } else if (typeof val === 'string') {
          if (val.match(/https?:\/\//i)) {
            scrubbed[key] = scrubUrlCredentials(val);
          } else {
            scrubbed[key] = '[REDACTED]';
          }
        } else {
          scrubbed[key] = '[REDACTED]';
        }
      } else {
        scrubbed[key] = scrubSensitiveData(val);
      }
    }
    return scrubbed;
  }

  return data;
};

