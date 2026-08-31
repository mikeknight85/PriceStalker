/**
 * Image URL normalisation.
 *
 * A selector can match the right element and still yield an unusable URL. Pages
 * routinely express image sources as:
 *
 *   /content/dam/example/image.jpg     relative to the site root
 *   ../img/product.jpg                 relative to the current path
 *   //cdn.example.com/image.jpg        protocol-relative
 *   data:image/gif;base64,R0lGOD...    a 1x1 spacer standing in for a lazy image
 *
 * None of these were resolved against the page they came from, so they were
 * stored and rendered as-is and the product showed a broken image.
 */

/**
 * Fragments that identify a stand-in rather than a product image. Matched
 * against the lowercased URL path.
 *
 * `placeholder` alone was the previous test, which missed every other spelling
 * a CDN uses for the same thing.
 */
const PLACEHOLDER_MARKERS = [
  'placeholder',
  'no-image',
  'noimage',
  'no_image',
  'image-not-available',
  'notfound',
  'not-found',
  'default-product',
  'dummy',
  'blank.gif',
  'blank.png',
  'spacer.gif',
  'spacer.png',
  'transparent.gif',
  'transparent.png',
  'grey.gif',
  'pixel.gif',
  '1x1.',
];

/** Schemes that can never be fetched by a browser rendering the dashboard. */
const UNUSABLE_SCHEMES = ['javascript:', 'about:', 'blob:', 'file:'];

export function isPlaceholderImageUrl(url: string): boolean {
  const lowered = url.toLowerCase();

  // A data: URI is almost always the transparent spacer a lazy-loading script
  // swaps out. Keep a genuinely large inline image, which is occasionally the
  // real product shot on a small shop.
  if (lowered.startsWith('data:')) return lowered.length < 1000;

  let path = lowered;
  try {
    path = new URL(lowered).pathname;
  } catch {
    // Not absolute yet; match against the whole string.
  }

  return PLACEHOLDER_MARKERS.some((marker) => path.includes(marker));
}

/**
 * Resolve a raw image value against the page it was scraped from.
 *
 * Returns null when the value cannot become something fetchable. A trailing
 * slash is deliberately *not* a rejection: several CDNs serve images from a
 * directory-style endpoint, and rejecting those threw away working images.
 */
export function resolveImageUrl(rawValue: string, pageUrl?: string | null): string | null {
  const value = rawValue?.trim();
  if (!value) return null;

  if (UNUSABLE_SCHEMES.some((scheme) => value.toLowerCase().startsWith(scheme))) {
    return null;
  }

  // Inline images are already self-contained; there is nothing to resolve.
  if (value.toLowerCase().startsWith('data:')) {
    return isPlaceholderImageUrl(value) ? null : value;
  }

  let resolved: URL;
  try {
    if (pageUrl) {
      // Handles absolute, root-relative, path-relative and protocol-relative in
      // one step: the URL constructor inherits scheme and host from the base.
      resolved = new URL(value, pageUrl);
    } else {
      // Without a page to resolve against, only an absolute URL is usable. A
      // protocol-relative one can still be rescued by assuming https.
      resolved = value.startsWith('//') ? new URL(`https:${value}`) : new URL(value);
    }
  } catch {
    return null;
  }

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
  if (!resolved.hostname) return null;

  // A page served over https resolving a protocol-relative URL correctly yields
  // https. A page served over http would yield http for the same input, which a
  // browser on an https dashboard then blocks as mixed content. Prefer https for
  // the image regardless of how the page itself was fetched.
  if (resolved.protocol === 'http:' && value.startsWith('//')) {
    resolved.protocol = 'https:';
  }

  if (isPlaceholderImageUrl(resolved.href)) return null;

  return resolved.href;
}
