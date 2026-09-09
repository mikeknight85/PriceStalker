import { describe, it, expect } from 'vitest';
import { scoreImageCandidate } from '../../src/services/scraper/metadata/image';

/**
 * An enterprise CMS can put an asset *folder* in JSON-LD rather than a file
 * (issue #164). It resolves to a valid-looking URL, JSON-LD scores highest, and
 * the product ends up showing a broken image while a perfectly good og:image
 * sits unused.
 *
 * Reordering rather than filtering: #102 deliberately kept extension-less URLs
 * because some retailers serve images from dynamic endpoints, and one of those
 * is still better than no image at all.
 */

const jsonLd = (value: string) => ({ value, method: 'json-ld', confidence: 0.99 });
const ogImage = (value: string) => ({ value, method: 'og:image', confidence: 0.8 });

const better = (a: Parameters<typeof scoreImageCandidate>[0], b: Parameters<typeof scoreImageCandidate>[0]) =>
  scoreImageCandidate(a, true) > scoreImageCandidate(b, true);

describe('scoreImageCandidate', () => {
  it('prefers a real image file over a JSON-LD directory path', () => {
    // The reported case, from telstra.com.au.
    const directory = jsonLd('https://www.telstra.com.au/content/dam/tcom/devices/ghdwerb-pbp2/hazel/');
    const file = ogImage('https://www.telstra.com.au/content/dam/tcom/devices/front.png');
    expect(better(file, directory)).toBe(true);
  });

  it('still prefers JSON-LD when both point at real files', () => {
    // The demotion must not reverse the normal ordering.
    expect(better(jsonLd('https://x.test/a.jpg'), ogImage('https://x.test/b.jpg'))).toBe(true);
  });

  it('ranks an extension-less URL between a directory and a file', () => {
    const directory = jsonLd('https://x.test/assets/');
    const dynamic = jsonLd('https://x.test/image/12345');
    const file = jsonLd('https://x.test/image.png');
    expect(scoreImageCandidate(file, true)).toBeGreaterThan(scoreImageCandidate(dynamic, true));
    expect(scoreImageCandidate(dynamic, true)).toBeGreaterThan(scoreImageCandidate(directory, true));
  });

  it('accepts a query string after the extension', () => {
    // CDN URLs routinely carry resize parameters.
    const plain = jsonLd('https://x.test/p.jpg');
    const resized = jsonLd('https://x.test/p.jpg?w=800&fm=webp');
    expect(scoreImageCandidate(resized, true)).toBe(scoreImageCandidate(plain, true));
  });

  it.each(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'])('treats .%s as an image file', (ext) => {
    const file = jsonLd(`https://x.test/p.${ext}`);
    const directory = jsonLd('https://x.test/p/');
    expect(scoreImageCandidate(file, true)).toBeGreaterThan(scoreImageCandidate(directory, true));
  });

  it('does not throw on a value that is not a URL', () => {
    expect(() => scoreImageCandidate({ value: 'not a url', method: 'json-ld', confidence: 0.99 }, true)).not.toThrow();
    expect(() => scoreImageCandidate({ value: undefined, method: 'og:image', confidence: 0.8 }, false)).not.toThrow();
  });

  it('leaves a directory candidate usable when it is the only one', () => {
    // Demoted, not discarded: a dynamic endpoint beats no image at all.
    expect(scoreImageCandidate(jsonLd('https://x.test/assets/'), true)).toBeGreaterThan(0);
  });
});
