/**
 * Canonical User-Agent string used across PriceStalker backend, scraper, and migrations.
 *
 * Keeping the backend fallback and the remote Puppeteer scraper in step ensures
 * that TLS Client Hints and JavaScript runtime checks present an identical identity.
 */
export const CANONICAL_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

export const CANONICAL_CHROME_VERSION = '154.0.0.0';
export const CANONICAL_CHROME_MAJOR = '154';
