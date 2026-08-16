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
 * Returns null if the image is a placeholder.
 */
export function sanitizeProductImage(imageUrl: string | null | undefined, currentImageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.includes('placeholder')) return null;
  if (currentImageUrl === imageUrl) return null; // unchanged
  // A differing scraped image replaces the stored one: retailers rotate CDN
  // asset URLs, and a stored URL that is never refreshed 404s forever once
  // the old asset disappears. Blocked/challenged scrapes extract no image,
  // so they cannot overwrite a good URL with junk.
  return imageUrl;
}
