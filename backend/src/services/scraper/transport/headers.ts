import { settingsCache } from '../../../utils/cache';
import { logger } from '../../../utils/system/logger';
import { parseUserAgent, buildClientHintHeaders } from './user-agent';

/**
 * The fallback used when no User-Agent is configured.
 *
 * Kept in step with the seeded `default_user_agent`. Client hints are derived
 * from whichever string wins, so the two can differ without producing a
 * contradiction -- but there is no reason for them to.
 */
export const FALLBACK_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

/**
 * The User-Agent this scrape will present: retailer override, then the system
 * setting, then the fallback.
 *
 * Exported so the browser path resolves it the same way. It previously did not
 * resolve one at all -- both remote calls passed `undefined` -- so a retailer
 * that saw the configured Chrome on the first request saw whatever Chromium
 * build happened to be in the scraper container on the fallback. Presenting two
 * different browsers for one product is the same fault as presenting two
 * different versions in one request.
 */
export async function resolveUserAgent(override?: string | null): Promise<string> {
  return override || (await settingsCache.getDefaultUserAgent()) || FALLBACK_USER_AGENT;
}

/**
 * Request headers for the plain HTTP scraper.
 *
 * Every header describing who is asking is derived from the User-Agent, so the
 * request cannot claim to be two browsers at once. The client hints used to be
 * hardcoded to Chrome 121 on Windows regardless of the configured UA -- see
 * ./user-agent.ts for what that cost.
 */
export async function getHeaders(userAgent?: string): Promise<Record<string, string>> {
  const ua = await resolveUserAgent(userAgent);
  const identity = parseUserAgent(ua);

  if (identity.family === 'unknown') {
    // Worth saying out loud: an unrecognised UA gets no client hints, which is
    // correct but means a Chromium UA we failed to parse silently loses them.
    logger.warn(
      `Scraper | Headers | Could not identify the browser in the configured User-Agent, so no client hints will be sent: "${ua.slice(0, 120)}"`,
      'Scraper'
    );
  }

  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    ...buildClientHintHeaders(identity),
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
}
