import { resolveImageUrl } from '../../../scraper/metadata/image-url';
/**
 * Metadata validation and sanitization utilities for Products.
 */

export const GENERIC_NAME_BLACKLIST = [
  'notifications red dot',
  'javascript disabled',
  'enable javascript',
  'loading...',
  'checkout',
  'cart',
  'unknown product'
];

/**
 * Checks if a product name is generic or high-noise.
 */
export function isGenericName(name: string | null | undefined): boolean {
  if (!name) return true;
  const lowerName = name.toLowerCase();
  return GENERIC_NAME_BLACKLIST.some(phrase => lowerName.includes(phrase));
}

/**
 * Validates and sanitizes a product name candidate.
 * Returns null if the name is generic or empty.
 */
export function sanitizeProductName(name: string | null | undefined): string | null {
  if (!name || isGenericName(name)) return null;
  return name.trim().substring(0, 255);
}

/**
 * Validates and sanitizes a product image URL.
 * Returns null when the candidate should not replace what is already stored.
 */
export function sanitizeProductImage(imageUrl: string | null | undefined, currentImageUrl: string | null): string | null {
  if (!imageUrl) return null;

  // The scraper resolves candidates against the page before they get here, but
  // this is also reached from paths that did not (imports, older rows, a
  // hand-edited value), so re-check rather than trust the caller. A value that
  // is still relative or still a placeholder must never replace a working URL.
  const resolved = resolveImageUrl(imageUrl, null);
  if (!resolved) return null;

  if (currentImageUrl === resolved) return null; // unchanged
  // A differing scraped image replaces the stored one: retailers rotate CDN
  // asset URLs, and a stored URL that is never refreshed 404s forever once
  // the old asset disappears. Blocked/challenged scrapes extract no image,
  // so they cannot overwrite a good URL with junk.
  return resolved;
}
