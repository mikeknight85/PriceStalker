import axios from 'axios';
import { logger } from '../../../utils/system/logger';

/**
 * Confirms that a suspicious image URL is actually an image (issue #164).
 *
 * The scoring heuristic reorders candidates so a real file beats a folder, but
 * some pages offer nothing better. On the reported Telstra product *every*
 * candidate is a directory -- the JSON-LD entries and the og:image alike -- so
 * reordering changes which broken URL wins, not whether one does. Measured:
 *
 *   .../ghdwerb-pbp2/hazel/   ->  404 text/html
 *
 * and the only real image files in the static HTML are pictograms and a
 * preloader; the product image is rendered by JavaScript.
 *
 * So a URL we cannot rank away has to be checked. Deliberately narrow:
 *
 * - Only for candidates the heuristic already flagged as suspicious. A URL
 *   naming a real image file is not verified, which is nearly all of them.
 * - Only the finally-chosen candidate, not every candidate.
 * - HEAD, with a short timeout.
 *
 * Fails open. A timeout, a refusal, a retailer that rejects HEAD -- none of
 * those prove the URL is bad, and discarding a working image because a check
 * could not complete would be a worse failure than the one being fixed.
 */
const VERIFY_TIMEOUT_MS = 6000;

/**
 * Whether a HEAD response describes an image.
 *
 * Separated from the request so the decision can be tested without a network
 * or a mocked client -- the rules here are the part worth pinning down, and
 * the request around them is three lines of axios.
 */
export function isImageResponse(status: number, contentType: string | undefined): boolean {
  if (status >= 400) return false;

  const type = String(contentType || '').toLowerCase();

  // An empty content-type is not evidence of anything; some CDNs omit it on
  // HEAD. Only a positively non-image type rejects.
  if (type && !type.startsWith('image/')) return false;

  return true;
}

export async function looksLikeRealImage(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout: VERIFY_TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: () => true,
    });

    const accepted = isImageResponse(response.status, response.headers['content-type'] as string | undefined);
    if (!accepted) {
      logger.debug(`Extract | Image | Rejected ${response.status} ${response.headers['content-type']} for ${url}`, 'Scraper');
    }
    return accepted;
  } catch (error) {
    // Network failure, HEAD not allowed, TLS problem. Not proof the image is
    // bad, so keep it.
    logger.debug(`Extract | Image | Could not verify ${url} (${(error as Error)?.message}); keeping it`, 'Scraper');
    return true;
  }
}

/** Whether a candidate is worth spending a request on. */
const IMAGE_FILE_EXTENSION = /\.(jpe?g|png|webp|avif|gif|bmp|svg)(?:[?#]|$)/i;

export function needsVerification(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path.endsWith('/') || !IMAGE_FILE_EXTENSION.test(path);
  } catch {
    return false;
  }
}
