import { type CheerioAPI } from 'cheerio';
import { ScrapedProductWithVoting } from '../../../types/scraper';
import { RetailerConfig } from '../../../models';
import { settingsCache } from '../../../utils/cache';
import { extractMetaWithCandidates, findInJsonLd, evaluateMetadataSelectors } from './utils';
import { parseSelector } from '../extractors/metadata';
import { extractByRegex } from '../extractors/price-extraction';

export interface ImageDimensions {
  width: number;
  height: number;
  area: number;
}

export function parseImageDimensions(url: string): ImageDimensions | null {
  try {
    const urlObj = new URL(url);
    
    // Check if height/width parameters are present but empty (e.g., height= & width=)
    const hasWidthParam = urlObj.searchParams.has('width') || urlObj.searchParams.has('w') || urlObj.searchParams.has('size') || urlObj.searchParams.has('s');
    const hasHeightParam = urlObj.searchParams.has('height') || urlObj.searchParams.has('h');
    
    const w = urlObj.searchParams.get('width') || urlObj.searchParams.get('w') || urlObj.searchParams.get('size') || urlObj.searchParams.get('s');
    const h = urlObj.searchParams.get('height') || urlObj.searchParams.get('h');
    
    if ((hasWidthParam && !w) || (hasHeightParam && !h)) {
      return { width: 0, height: 0, area: 0 };
    }
    
    let width = w ? parseInt(w, 10) : NaN;
    let height = h ? parseInt(h, 10) : NaN;

    // 2. Try path matching (e.g., /640x480/ or _640x480.jpg)
    if (isNaN(width) || isNaN(height)) {
      const match = urlObj.pathname.match(/[_-]?(\d+)[xX](\d+)\b/);
      if (match) {
        width = parseInt(match[1], 10);
        height = parseInt(match[2], 10);
      }
    }

    if (!isNaN(width) && !isNaN(height)) {
      return { width, height, area: width * height };
    } else if (!isNaN(width)) {
      return { width, height: width, area: width * width };
    } else if (!isNaN(height)) {
      return { width: height, height, area: height * height };
    }
    
    // If size parameters are completely absent, it's also unconstrained (original full-size)
    if (!hasWidthParam && !hasHeightParam) {
      return { width: 0, height: 0, area: 0 };
    }
  } catch (e) {}
  return { width: 0, height: 0, area: 0 };
}

export interface SrcsetCandidate {
  url: string;
  width?: number;
}

export function parseSrcset(srcsetVal: string): SrcsetCandidate[] {
  if (!srcsetVal) return [];
  return srcsetVal.split(',').map(entry => {
    const trimmed = entry.trim();
    const parts = trimmed.split(/\s+/);
    const url = parts[0];
    const descriptor = parts[1];
    
    let width: number | undefined;
    if (descriptor) {
      if (descriptor.endsWith('w')) {
        width = parseInt(descriptor.slice(0, -1), 10);
      } else if (descriptor.endsWith('x')) {
        const factor = parseFloat(descriptor.slice(0, -1));
        width = Math.round(factor * 1000); // Scale factor for comparison (e.g. 2x -> 2000)
      }
    }
    return { url, width };
  }).filter(c => !!c.url);
}

export function extractAllImageAttributes(el: any, $: CheerioAPI): string[] {
  const urls: string[] = [];
  const attributes = [
    'src', 'data-src', 'srcset', 'data-srcset', 
    'data-lazy-src', 'data-actual-src', 'data-original', 
    'zoom-image', 'data-zoom-image', 'href', 'imagesrcset'
  ];
  
  attributes.forEach(attr => {
    const val = $(el).attr(attr);
    if (!val) return;
    
    if (attr === 'srcset' || attr === 'data-srcset' || attr === 'imagesrcset') {
      const candidates = parseSrcset(val);
      candidates.forEach(c => {
        let targetUrl = c.url;
        if (c.width && !targetUrl.includes('width=') && !targetUrl.includes('w=')) {
          const sep = targetUrl.includes('?') ? '&' : '?';
          targetUrl = `${targetUrl}${sep}width=${c.width}`;
        }
        urls.push(targetUrl);
      });
    } else {
      urls.push(val);
    }
  });
  
  return urls;
}

export function processImageElement(el: any, $: CheerioAPI, callback: (url: string) => void) {
  // Extract all attributes from the element itself
  const urls = extractAllImageAttributes(el, $);
  urls.forEach(url => callback(url));

  // If this is an img tag, check if it's inside a <picture> element
  const tagName = $(el).prop('tagName')?.toLowerCase();
  if (tagName === 'img') {
    const parent = $(el).parent();
    if (parent.length && parent[0].name === 'picture') {
      parent.find('source').each((_, sourceEl) => {
        const sourceUrls = extractAllImageAttributes(sourceEl, $);
        sourceUrls.forEach(url => callback(url));
      });
    }
  }
}

export function evaluateImageSelectors(
  $: CheerioAPI,
  siteSelectors: string[],
  genericSelectors: string[],
  extractionSteps: string[],
  html?: string
): any[] {
  const candidates: any[] = [];
  const processedUrls = new Set<string>();

  const addCandidate = (url: string, method: string, selector: string, confidence: number) => {
    const cleanUrl = url.trim();
    if (!cleanUrl || processedUrls.has(cleanUrl)) return;
    processedUrls.add(cleanUrl);
    candidates.push({ value: cleanUrl, method, selector, confidence });
  };

  const runSelectors = (selectors: string[], methodLabel: string, baseConfidence: number) => {
    const cleanSelectors = Array.from(new Set(selectors.map(s => s.trim()).filter(Boolean)));
    for (const s of cleanSelectors) {
      try {
        const { realSelector, method, engine, attribute } = parseSelector(s);
        
        if (engine === 'regex' && html) {
          const matches = extractByRegex(html, [realSelector]);
          for (const val of matches) {
            addCandidate(val, `${methodLabel}-regex`, s, baseConfidence);
          }
          continue;
        }

        // TODO: XPath (Phase 4)
        if (engine === 'xpath') continue;

        $(realSelector).each((_, element) => {
          if (method === 'attr' && attribute) {
            const val = $(element).attr(attribute);
            if (val) addCandidate(val, methodLabel, s, baseConfidence);
          } else {
            processImageElement(element, $, (url) => {
              addCandidate(url, methodLabel, s, baseConfidence);
            });
          }
        });
      } catch (e) {}
    }
  };

  if (siteSelectors.length > 0) {
    extractionSteps.push(`Extract | Image | Evaluating site-specific selectors: ${JSON.stringify(siteSelectors)}`);
    runSelectors(siteSelectors, 'site-specific', 1.0);
  }

  if (candidates.length === 0 && genericSelectors.length > 0) {
    extractionSteps.push(`Extract | Image | Evaluating generic selectors: ${JSON.stringify(genericSelectors)}`);
    runSelectors(genericSelectors, 'generic', 0.6);
  }

  return candidates;
}

export async function extractProductImage(
  $: CheerioAPI,
  domainConfig: RetailerConfig | undefined,
  extractionSteps: string[],
  result: ScrapedProductWithVoting
): Promise<void> {
  const siteSelectors = domainConfig?.image_selectors || [];
  const genericSelectors = await settingsCache.getImageSelectors() || [];
  const preferJsonLd = (await settingsCache.get('prefer_jsonld_image')) === 'true';
  if (!result.imageCandidates) result.imageCandidates = [];

  extractionSteps.push(`Extract | Image | Prefer JSON-LD: ${preferJsonLd}`);

  const candidates = evaluateImageSelectors($, siteSelectors, genericSelectors, extractionSteps, result.html || undefined);

  result.imageCandidates.push(...candidates);

  // Check JSON-LD
  const settings = await settingsCache.getAISettings();
  const resolvedImageKey = domainConfig?.jsonld_image_key || settings?.jsonld_image_key || 'image';

  findInJsonLd($, 'Product', (obj) => {
    const imgVal = obj[resolvedImageKey];
    if (imgVal) {
      const imageUrl = Array.isArray(imgVal) ? imgVal[0] : imgVal;
      if (typeof imageUrl === 'string') {
        result.imageCandidates?.push({ value: imageUrl.trim(), method: 'json-ld', confidence: 0.99 });
      }
    }
  });

  const ogImg = $('meta[property="og:image"]').attr('content');
  if (ogImg) result.imageCandidates.push({ value: ogImg, method: 'og:image', confidence: 0.8 });

  $('link[rel="preload"][as="image"]').each((_, el) => {
    processImageElement(el, $, (url) => {
      result.imageCandidates!.push({ value: url.trim(), method: 'link-preload', confidence: 0.85 });
    });
  });

  // Deduplication & Priority Sorting
  if (result.imageCandidates.length > 0) {
    result.imageCandidates.sort((a, b) => {
      const confA = (preferJsonLd && a.method === 'json-ld') ? 1.01 : a.confidence;
      const confB = (preferJsonLd && b.method === 'json-ld') ? 1.01 : b.confidence;
      return confB - confA;
    });

    const seenUrls = new Map<string, { index: number; area: number }>();
    const deduplicated: typeof result.imageCandidates = [];

    result.imageCandidates.forEach((c) => {
      const val = String(c.value || '').trim();
      if (!val) return;

      let base = val;
      try {
        base = val.split('?')[0].split('#')[0].toLowerCase();
      } catch (e) {}

      const dims = parseImageDimensions(val);
      const area = dims ? dims.area : 0;

      const existing = seenUrls.get(base);
      if (!existing) {
        seenUrls.set(base, { index: deduplicated.length, area });
        deduplicated.push(c);
      } else if (area > existing.area) {
        seenUrls.set(base, { index: existing.index, area });
        deduplicated[existing.index] = c;
      }
    });

    result.imageCandidates = deduplicated;
    extractionSteps.push(`Extract | Image | Found ${result.imageCandidates.length} unique candidates (dimension optimized)`);
  }

  if (!result.imageUrl) {
    result.imageUrl = (result.imageCandidates?.[0]?.value as string) || null;
  }
}

