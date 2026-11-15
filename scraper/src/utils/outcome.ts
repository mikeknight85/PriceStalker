/**
 * How a finished scrape is described in the log (issue #255).
 *
 * `routes.ts` used to log `Success: <url> (<bytes>)` for anything that came
 * back without throwing, so a 37KB challenge wall was announced as a success
 * in the scraper container at the same second the backend logged
 * `Product | Add | Failed | The retailer blocked the request`. Two services
 * disagreeing in the logs costs real debugging time.
 *
 * The decision is taken from what `ScraperService` *recorded* while it was
 * looking at the live page, never re-derived from the HTML here: the scraper
 * already has the title (which a wall page carries and a serialised body may
 * not) and the compiled phrase list the backend sent. Re-sniffing the HTML at
 * the route would be a second, worse classifier -- and a third copy of
 * patterns that already exist in `utils/challenge.ts` and, for the backend,
 * in `transport/detection.ts`.
 */

import type { ScrapeResult } from '../types.js';

export interface ScrapeOutcomeLog {
  level: 'INFO' | 'WARN';
  message: string;
}

/**
 * The one line to log for a completed scrape.
 *
 * - An unresolved challenge is a WARN naming what came back, because the
 *   bytes returned are a wall and not the product page.
 * - A challenge that auto-resolved is still a success, but says so, because
 *   "it worked on the second round" is the thing worth knowing next time.
 */
export function scrapeOutcomeLog(url: string, result: ScrapeResult): ScrapeOutcomeLog {
  const size = `${result.html.length} bytes`;

  if (result.challengeUnresolved) {
    return { level: 'WARN', message: `Unresolved challenge wall returned: ${url} (${size})` };
  }
  if (result.challengeDetected) {
    return { level: 'INFO', message: `Success after challenge auto-resolve: ${url} (${size})` };
  }
  return { level: 'INFO', message: `Success: ${url} (${size})` };
}
