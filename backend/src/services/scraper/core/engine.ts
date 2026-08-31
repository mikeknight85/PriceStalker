import { CheerioAPI } from 'cheerio';
import { DOMParser } from '@xmldom/xmldom';
import * as xpath from 'xpath';
import { parseSelector, ParsedSelector } from './selectors';
import { extractByRegex } from '../extractors/price-extraction';

export interface EvaluationResult {
  value: string | null;
  status?: string | null;
}

/**
 * Serialised form of the denoised DOM, cached per Cheerio instance.
 *
 * Regex selectors are evaluated one at a time, and $.html() walks the whole
 * document, so serialising on every evaluation would repeat that work for each
 * rule. The cache is a WeakMap so it disappears with the document.
 */
const denoisedHtmlCache = new WeakMap<object, string>();

function denoisedHtmlFor($: CheerioAPI, fallback: string): string {
  try {
    const cached = denoisedHtmlCache.get($ as unknown as object);
    if (cached !== undefined) return cached;

    const serialised = $.html();
    denoisedHtmlCache.set($ as unknown as object, serialised);
    return serialised;
  } catch {
    // A malformed document should degrade to the old behaviour rather than
    // losing the selector entirely.
    return fallback;
  }
}

/**
 * Evaluates a selector against a DOM ($) or raw HTML.
 */
export function evaluateSelector(
  $: CheerioAPI,
  html: string,
  selector: string | ParsedSelector
): EvaluationResult[] {
  const parsed = typeof selector === 'string' ? parseSelector(selector) : selector;
  const results: EvaluationResult[] = [];

  if (parsed.engine === 'regex') {
    // Match against the denoised document, not the raw response. The raw HTML
    // still contains the sidebars, carousels, footers and tracking payloads the
    // denoiser removed, so a regex written for the product area was matching
    // prices from unrelated parts of the page.
    const matches = extractByRegex(denoisedHtmlFor($, html), [parsed.realSelector]);
    for (const val of matches) {
      const modified = applyModifier({ value: val }, parsed);
      if (modified) {
        results.push(modified);
      }
    }
    return results;
  }

  if (parsed.engine === 'xpath') {
    try {
      // Use Cheerio's XML output to get a more well-formed structure for xmldom
      const wellFormedHtml = $.xml();
      const doc = new DOMParser().parseFromString(wellFormedHtml, 'text/xml');
      const nodes = xpath.select(parsed.realSelector, doc as any);
      
      if (Array.isArray(nodes)) {
        for (const node of nodes) {
          let val: string | null = null;
          if (parsed.method === 'attr' && parsed.attribute) {
            val = (node as any).getAttribute?.(parsed.attribute) || null;
          } else if (parsed.method === 'html') {
            val = node.toString();
          } else {
            val = node.textContent || null;
          }

          if (val !== null) {
            const modified = applyModifier({ value: val.trim() }, parsed);
            if (modified) {
              results.push(modified);
            }
          }
        }
      }
    } catch (e) {
      // SILENT FAIL for now
    }
    return results;
  }

  // Default: CSS (Cheerio)
  $(parsed.realSelector).each((_, el) => {
    let val: string | null = null;
    if (parsed.method === 'attr' && parsed.attribute) {
      val = $(el).attr(parsed.attribute) || null;
    } else if (parsed.method === 'html') {
      val = $(el).html();
    } else {
      const cloned = $(el).clone();
      cloned.find('script, style, noscript').remove();
      val = cloned.text().trim();
    }

    if (val !== null) {
      const modified = applyModifier({ value: val }, parsed);
      if (modified) {
        results.push(modified);
      }
    }
  });

  return results;
}

/**
 * Applies a modifier to an evaluation result.
 * If a modifier is present but doesn't match, it returns NULL (to indicate exclusion).
 */
function applyModifier(result: EvaluationResult, parsed: ParsedSelector): EvaluationResult | null {
  if (!parsed.modifier || !result.value) return result;

  const { type, value, targetStatus } = parsed.modifier;
  const currentVal = result.value.toLowerCase();
  const targetVal = value.toLowerCase();

  let match = false;
  if (type === 'equals') {
    match = currentVal === targetVal;
  } else if (type === 'contains') {
    match = currentVal.includes(targetVal);
  }

  if (match) {
    return { ...result, status: targetStatus };
  }

  return null; // Exclusion: Modifier present but did not match
}
