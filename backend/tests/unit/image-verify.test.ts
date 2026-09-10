import { describe, it, expect } from 'vitest';
import { isImageResponse, needsVerification } from '../../src/services/scraper/metadata/image-verify';

/**
 * Ranking alone could not fix the reported Telstra product: every candidate on
 * that page is a directory, including the og:image, so reordering only changed
 * which broken URL won. Measured against the live page, the directory returns
 * 404 text/html and the only real image files in the static HTML are
 * pictograms and a preloader (issue #164).
 *
 * The decision is separated from the request so it can be pinned down without
 * a network or a mocked client -- the rules are the part worth testing, and
 * the request around them is three lines of axios.
 */

describe('needsVerification spends requests only where they might help', () => {
  it.each([
    'https://x.test/p.jpg',
    'https://x.test/p.jpg?w=800&fm=webp',
    'https://x.test/a/b/c.webp',
  ])('trusts %s without a request', (url) => {
    expect(needsVerification(url)).toBe(false);
  });

  it.each([
    'https://telstra.com.au/content/dam/a/hazel/',
    'https://x.test/image/12345',
  ])('checks %s', (url) => {
    expect(needsVerification(url)).toBe(true);
  });

  it('does not try to verify something that is not a URL', () => {
    expect(needsVerification('not a url')).toBe(false);
  });
});

describe('isImageResponse', () => {
  it('accepts an image content-type', () => {
    expect(isImageResponse(200, 'image/webp')).toBe(true);
  });

  it('rejects the reported case: 404 text/html', () => {
    expect(isImageResponse(404, 'text/html;charset=utf-8')).toBe(false);
  });

  it('rejects a 200 that is not an image', () => {
    // A CMS serving a directory listing rather than an error.
    expect(isImageResponse(200, 'text/html')).toBe(false);
  });

  it('accepts a 200 with no content-type rather than guessing', () => {
    // Some CDNs omit it on HEAD. Absence is not evidence.
    expect(isImageResponse(200, undefined)).toBe(true);
    expect(isImageResponse(200, '')).toBe(true);
  });

  it.each([301, 302, 304])('accepts %s, which axios follows or treats as fresh', (status) => {
    expect(isImageResponse(status, 'image/png')).toBe(true);
  });

  it.each([403, 404, 410, 500])('rejects %s', (status) => {
    expect(isImageResponse(status, 'image/png')).toBe(false);
  });

  it('is case-insensitive about the content-type', () => {
    expect(isImageResponse(200, 'IMAGE/JPEG')).toBe(true);
  });
});
