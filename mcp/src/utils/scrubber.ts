/**
 * Scrubs inline credentials from a URL string (e.g., http://user:pass@host -> http://[REDACTED]:[REDACTED]@host)
 */
export const scrubUrlCredentials = (val: string): string => {
  if (typeof val !== 'string') return val;
  return val.replace(/(https?:\/\/)([^:]+):([^@]+)(@[^\s/?#]+)/gi, '$1[REDACTED]:[REDACTED]$4');
};

/**
 * Scrubs email addresses from string content to prevent PII leakage into model context.
 */
export const scrubEmails = (val: string): string => {
  if (typeof val !== 'string') return val;
  return val.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
};

/**
 * Scrubs sensitive keys, credentials, and emails from any data type (object, array, string, Error).
 */
export const scrubSensitiveData = (data: any): any => {
  if (!data) return data;

  if (typeof data === 'string') {
    return scrubEmails(scrubUrlCredentials(data));
  }

  if (data instanceof Error) {
    const msg = scrubEmails(scrubUrlCredentials(data.message));
    const stack = data.stack ? scrubEmails(scrubUrlCredentials(data.stack)) : undefined;
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
    const sensitiveKeys = [
      'password',
      'token',
      'api_key',
      'secret',
      'password_hash',
      'token_hash',
      'authorization',
      'proxy'
    ];

    for (const key of Object.keys(data)) {
      const val = data[key];
      const lowerKey = key.toLowerCase();

      if (lowerKey === 'email' || lowerKey.endsWith('_email')) {
        scrubbed[key] = '[REDACTED_EMAIL]';
      } else if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        if (lowerKey.includes('proxy') && typeof val === 'boolean') {
          scrubbed[key] = val;
        } else if (typeof val === 'string') {
          if (val.match(/https?:\/\//i)) {
            scrubbed[key] = scrubEmails(scrubUrlCredentials(val));
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

/**
 * Helper to serialize scrubbed data into formatted JSON.
 */
export const formatScrubbedJson = (data: any): string => {
  return JSON.stringify(scrubSensitiveData(data), null, 2);
};
