import { CheerioAPI } from 'cheerio';

/**
 * Normalizes a selector string into the standardized format.
 * Converts legacy "selector|attribute" into "selector::attr(attribute)".
 */
export function normalizeSelector(selector: string): string {
  if (!selector) return selector;
  const trimmed = selector.trim();
  if (trimmed.startsWith('~') && trimmed.endsWith('~')) return trimmed; // regex
  if (trimmed.startsWith('!')) return trimmed; // html

  // Split only on a `|` outside square brackets (issue #166).
  //
  // CSS has its own `|` operators inside attribute selectors -- the dashmatch
  // `[lang|="en"]`, and namespaces like `[svg|href]`. Splitting on those turned
  // `span[lang|="en"]` into `span[lang::attr(="en"])`, which is not valid CSS
  // and matches nothing, so the selector silently found no elements.
  const pipe = lastPipeOutsideBrackets(trimmed);
  if (pipe !== -1) {
    const base = trimmed.slice(0, pipe);
    const attr = trimmed.slice(pipe + 1);
    return `${base}::attr(${attr})`;
  }
  return trimmed;
}

/**
 * Index of the last `|` that is not inside `[...]`, or -1.
 *
 * Scanning rather than a regex because the legacy form allows a `|` in the
 * base -- `a|b|attr` means base `a|b` -- so the *last* separator is the one
 * that matters, and only when it sits outside an attribute selector.
 */
function lastPipeOutsideBrackets(selector: string): number {
  let depth = 0;
  let found = -1;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (c === '|' && depth === 0) found = i;
  }
  return found;
}

export interface ParsedSelector {
  realSelector: string;
  method: 'text' | 'attr' | 'html';
  engine: 'css' | 'xpath' | 'regex';
  attribute?: string;
  modifier?: {
    type: 'equals' | 'contains';
    value: string;
    targetStatus: string;
  } | null;
}

/**
 * Parses a selector string into its component parts.
 * Supports:
 * - Standard CSS: "#price"
 * - Attributes: "#price::attr(content)" or legacy "#price|content"
 * - Raw HTML: "!#price" (returns outer HTML)
 * - XPath: "xpath://div[@id='price']"
 * - Regex: "regex:/Price: \$(\d+\.\d+)/"
 * - Suffix Modifiers: "selector::attr(name)::equals(value)->status" or "selector::contains(value)->status"
 */
export function parseSelector(selector: string): ParsedSelector {
  if (!selector) {
    return { realSelector: '', method: 'text', engine: 'css', modifier: null };
  }

  let engine: 'css' | 'xpath' | 'regex' = 'css';
  let workingSelector = selector;

  if (selector.startsWith('xpath://')) {
    engine = 'xpath';
    workingSelector = selector.substring(8);
  } else if (selector.startsWith('regex:/') && (selector.endsWith('/') || selector.includes('/::'))) {
    engine = 'regex';
    // Extraction of the actual regex pattern depends on modifiers
    const parts = selector.split('::');
    const regexPart = parts[0];
    workingSelector = regexPart.substring(7);
    if (workingSelector.endsWith('/')) {
      workingSelector = workingSelector.slice(0, -1);
    }
  } else if (selector.startsWith('~') && selector.endsWith('~')) {
    // Legacy ~regex~ support
    engine = 'regex';
    workingSelector = selector.slice(1, -1);
  }

  // Check for suffix modifiers: selector[::attr(name)]::(equals|contains)(value)->status
  const suffixModifierRegex = /^(.+?)(::attr\((.+?)\))?::(equals|contains)\(([\s\S]+?)\)->([a-z0-9_-]+)$/i;
  const modifierMatch = workingSelector.match(suffixModifierRegex);

  if (modifierMatch) {
    let baseSelector = modifierMatch[1];
    const hasAttr = !!modifierMatch[2];
    const attribute = modifierMatch[3];
    const modifierType = modifierMatch[4].toLowerCase() as 'equals' | 'contains';
    const targetValue = modifierMatch[5];
    const targetStatus = modifierMatch[6];

    if (engine === 'xpath' && !baseSelector.startsWith('/') && !baseSelector.startsWith('.')) {
      baseSelector = '//' + baseSelector;
    }

    return {
      realSelector: baseSelector,
      method: hasAttr ? 'attr' : 'text',
      engine,
      attribute: hasAttr ? attribute : undefined,
      modifier: {
        type: modifierType,
        value: targetValue,
        targetStatus: targetStatus
      }
    };
  }

  if (workingSelector.startsWith('!')) return { realSelector: workingSelector.substring(1), method: 'html', engine, modifier: null };
  
  // Check for Scrapy-style ::attr(attributeName) syntax
  const scrapyAttrMatch = workingSelector.match(/(.*)::attr\(([^)]+)\)$/);
  if (scrapyAttrMatch) {
    let base = scrapyAttrMatch[1];
    if (engine === 'xpath' && !base.startsWith('/') && !base.startsWith('.')) base = '//' + base;
    return { realSelector: base, method: 'attr', engine, attribute: scrapyAttrMatch[2], modifier: null };
  }

  // Backwards compatibility with legacy | syntax
  if (workingSelector.includes('|')) {
    const parts = workingSelector.split('|');
    const attr = parts.pop();
    let base = parts.join('|');
    if (engine === 'xpath' && !base.startsWith('/') && !base.startsWith('.')) base = '//' + base;
    return { realSelector: base, method: 'attr', engine, attribute: attr, modifier: null };
  }
  
  if (engine === 'xpath' && !workingSelector.startsWith('/') && !workingSelector.startsWith('.')) {
    workingSelector = '//' + workingSelector;
  }
  
  return { realSelector: workingSelector, method: 'text', engine, modifier: null };
}

/**
 * Checks if an element is likely part of an ad, coupon, or related product list
 * rather than the main product details.
 */
export function isNoiseElement(el: any, $: CheerioAPI): boolean {
  const noiseKeywords = /coupon|savings|save\s*\$|clipcoupon|promoprice|related|recommended|suggested|sponsored|upsell|accessory|carousel|sidebar/i;

  // Check self
  const id = $(el).attr('id') || '';
  const className = $(el).attr('class') || '';
  if (noiseKeywords.test(id + className)) return true;

  // Check parents (up to 10 levels)
  let parent = $(el).parent();
  for (let i = 0; i < 10 && parent.length > 0; i++) {
    const pid = parent.attr('id') || '';
    const pclass = parent.attr('class') || '';
    if (noiseKeywords.test(pid + pclass)) return true;
    parent = parent.parent();
  }

  return false;
}
