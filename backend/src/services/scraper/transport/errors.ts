import type { UnavailableReason } from '../../../types/availability';

/**
 * Error thrown when a page is explicitly not available (404, 410, or root redirect).
 *
 * The reason is carried structurally as well as in the message. The message is
 * for a human reading a log; the reason is what gets persisted on the product
 * and rendered back to a user, and parsing it out of prose later was how the
 * notification history ended up saying "404/410" no matter what happened.
 */
export class PageNotAvailableError extends Error {
  readonly reason: UnavailableReason;

  constructor(message: string, reason: UnavailableReason = 'unknown_scrape_failure') {
    super(message);
    this.name = 'PageNotAvailableError';
    this.reason = reason;
  }
}
