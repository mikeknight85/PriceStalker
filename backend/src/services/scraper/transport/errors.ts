/**
 * Error thrown when a page is explicitly not available (404, 410, or root redirect).
 */
export class PageNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageNotAvailableError';
  }
}
