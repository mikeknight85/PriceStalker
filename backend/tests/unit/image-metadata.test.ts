import { describe, it, expect } from 'vitest';
import { parseImageDimensions } from '../../src/services/scraper/metadata/image';

describe('parseImageDimensions Unit Tests', () => {
  it('should parse explicit width and height from query params', () => {
    const dims = parseImageDimensions('http://example.com/image.jpg?width=800&height=600');
    expect(dims).not.toBeNull();
    expect(dims?.width).toBe(800);
    expect(dims?.height).toBe(600);
    expect(dims?.area).toBe(480000);
  });

  it('should parse size from path matching', () => {
    const dims = parseImageDimensions('http://example.com/image_1000x800.jpg');
    expect(dims).not.toBeNull();
    expect(dims?.width).toBe(1000);
    expect(dims?.height).toBe(800);
    expect(dims?.area).toBe(800000);
  });

  it('should return default (not infinity) for dimension-less URLs', () => {
    const dims = parseImageDimensions('http://example.com/image.jpg');
    expect(dims).not.toBeNull();
    // Default area should be low (e.g. 0) so that explicitly sized high-res images beat it.
    expect(dims?.area).toBeLessThan(100000);
  });
});
