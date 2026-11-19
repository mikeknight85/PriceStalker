import { NOTIFICATION_CREDENTIAL_FIELDS } from 'pricestalker-backend/notification-credentials';

/**
 * Scrubs inline credentials from a URL string (e.g., http://user:pass@host -> http://[REDACTED]:[REDACTED]@host)
 * Constrained so that query strings and paths with colons and at-signs do not get corrupted.
 */
export const scrubUrlCredentials = (val: string): string => {
  if (typeof val !== 'string') return val;
  return val.replace(/(https?:\/\/)([^:/?#]+):([^@/?#]+)(@[^\s/?#]+)/gi, '$1[REDACTED]:[REDACTED]$4');
};

/**
 * Scrubs email addresses from string content to prevent PII leakage into model context.
 */
export const scrubEmails = (val: string): string => {
  if (typeof val !== 'string') return val;
  return val.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
};

const BASE_SENSITIVE_PATTERNS = [
  'password',
  'token',
  'api_key',
  'secret',
  'password_hash',
  'token_hash',
  'authorization',
  'proxy',
  'private_key',
  'passphrase',
  'session_cookie',
  'cookie'
];

const NOTIFICATION_FIELDS: readonly string[] = NOTIFICATION_CREDENTIAL_FIELDS;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (NOTIFICATION_FIELDS.some(f => lower === f.toLowerCase() || lower.endsWith(`_${f.toLowerCase()}`))) {
    return true;
  }
  return BASE_SENSITIVE_PATTERNS.some(sk => lower.includes(sk));
}

/**
 * Scrubs sensitive keys, credentials, and emails from any data type (object, array, string, Error).
 * Equipped with a WeakSet cycle guard to protect against self-referential structures.
 */
export const scrubSensitiveData = (data: unknown, seen = new WeakSet<object>()): unknown => {
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

  if (typeof data !== 'object') {
    return data;
  }

  if (seen.has(data)) {
    return '[CIRCULAR]';
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map(item => scrubSensitiveData(item, seen));
  }

  const scrubbed: Record<string, unknown> = {};
  const obj = data as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const lowerKey = key.toLowerCase();

    if (lowerKey === 'email' || lowerKey.endsWith('_email')) {
      scrubbed[key] = '[REDACTED_EMAIL]';
    } else if (isSensitiveKey(key)) {
      if (lowerKey.includes('proxy') && typeof val === 'boolean') {
        scrubbed[key] = val;
      } else if (lowerKey.includes('proxy') && typeof val === 'string' && /^https?:\/\//i.test(val)) {
        scrubbed[key] = scrubEmails(scrubUrlCredentials(val));
      } else {
        scrubbed[key] = '[REDACTED]';
      }
    } else {
      scrubbed[key] = scrubSensitiveData(val, seen);
    }
  }

  return scrubbed;
};

/**
 * Helper to serialize scrubbed data into formatted JSON.
 */
export const formatScrubbedJson = (data: unknown): string => {
  return JSON.stringify(scrubSensitiveData(data), null, 2);
};
