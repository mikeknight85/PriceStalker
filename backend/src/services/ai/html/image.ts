import { CheerioAPI } from 'cheerio';
import { parseImageDimensions, processImageElement } from '../../scraper/metadata/image';

/**
 * Specifically extracts product image elements from the DOM before pruning.
 */
export function extractImageElements($: CheerioAPI, imageSelectors: string[]): string[] {
  const imageElements: string[] = [];
  const seenUrls = new Map<string, { fullUrl: string; area: number }>();

  const isValidImageUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http') && !trimmed.startsWith('//') && !trimmed.startsWith('/')) {
      return false;
    }
    const lower = trimmed.toLowerCase();
    const noisePatterns = [
      /spacer/i, /transparent/i, /placeholder/i, /logo/i, /icon/i,
      /sprite/i, /pixel/i, /loading/i, /spinner/i, /avatar/i,
      /facebook/i, /twitter/i, /instagram/i, /pinterest/i, /youtube/i
    ];
    return !noisePatterns.some(pattern => pattern.test(lower));
  };

  const processCandidate = (url: string) => {
    if (!isValidImageUrl(url)) return;
    const cleanUrl = url.trim();
    let base = cleanUrl;
    try {
      base = cleanUrl.split('?')[0].split('#')[0].toLowerCase();
    } catch (e) {}

    const dims = parseImageDimensions(cleanUrl);
    const area = dims ? dims.area : 0;

    const existing = seenUrls.get(base);
    if (!existing || area > existing.area) {
      seenUrls.set(base, { fullUrl: cleanUrl, area });
    }
  };

  const uniqueSelectors = Array.from(new Set(imageSelectors));

  for (const selector of uniqueSelectors) {
    try {
      $(selector).each((_, el) => {
        processImageElement(el, $, (url) => processCandidate(url));
      });
    } catch (e) {
      // Ignore selector errors
    }
  }

  // Schema markup (fallback)
  $('[itemprop="image"]').each((_, el) => {
    const url = $(el).attr('content') || $(el).attr('src') || $(el).attr('href');
    if (url) processCandidate(url);
  });

  // Collect final elements
  for (const [_, info] of seenUrls) {
    imageElements.push(`Image: "${info.fullUrl}"`);
  }

  return imageElements;
}
