/**
 * The PriceStalker selector DSL, as the browser sees it.
 *
 * This mirrors `backend/src/services/scraper/core/selectors.ts`, which is the
 * source of truth: the backend runs the real extraction, this copy exists so
 * the admin UI can normalise what an admin types and so the Debug Workstation's
 * Live Selector Lab can preview a rule the same way the engine would read it.
 * Frontend and backend are separate workspaces with no shared package, so the
 * grammar is restated here rather than imported. Keep the two in step; if you
 * change one, change the other.
 *
 * The grammar is documented in `docs/admin/selectors.md`:
 *
 *   - CSS (default)        `.price`, `span[itemprop="price"]`
 *   - Attribute            `.price::attr(content)`, legacy `.price|content`
 *   - Raw HTML             `!.price`
 *   - XPath                `xpath://div[@id="price"]`
 *   - Regex                `regex:/price: ([0-9.]+)/`, legacy `~pattern~`
 *   - Suffix modifiers     `.stock::contains(sold out)->out_of_stock`
 */

export type SelectorEngine = 'css' | 'xpath' | 'regex';
export type SelectorMethod = 'text' | 'attr' | 'html';

export interface SelectorModifier {
  type: 'equals' | 'contains';
  value: string;
  targetStatus: string;
}

export interface ParsedSelector {
  realSelector: string;
  method: SelectorMethod;
  engine: SelectorEngine;
  attribute?: string;
  modifier: SelectorModifier | null;
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

/**
 * Normalizes a selector string into the standardized format.
 * Converts legacy "selector|attribute" into "selector::attr(attribute)".
 *
 * Splits only on a `|` outside square brackets (issue #166, #168). CSS has its
 * own `|` operators inside attribute selectors -- the dashmatch `[lang|="en"]`
 * and namespaces like `[svg|href]`. Splitting on those turned `span[lang|="en"]`
 * into `span[lang::attr(="en"])`, which is not valid CSS and matches nothing, so
 * the selector silently found no elements.
 */
export function normalizeSelector(selector: string): string {
  if (!selector) return selector;
  const trimmed = selector.trim();
  if (trimmed.startsWith('~') && trimmed.endsWith('~')) return trimmed; // regex
  if (trimmed.startsWith('!')) return trimmed; // html

  const pipe = lastPipeOutsideBrackets(trimmed);
  if (pipe !== -1) {
    const base = trimmed.slice(0, pipe);
    const attr = trimmed.slice(pipe + 1);
    return `${base}::attr(${attr})`;
  }
  return trimmed;
}

/**
 * Parses a selector string into its component parts.
 *
 * A port of the backend `parseSelector`; see the module comment.
 */
export function parseSelector(selector: string): ParsedSelector {
  if (!selector) {
    return { realSelector: '', method: 'text', engine: 'css', modifier: null };
  }

  let engine: SelectorEngine = 'css';
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
        targetStatus
      }
    };
  }

  if (workingSelector.startsWith('!')) {
    return { realSelector: workingSelector.substring(1), method: 'html', engine, modifier: null };
  }

  // Scrapy-style ::attr(attributeName) syntax
  const scrapyAttrMatch = workingSelector.match(/(.*)::attr\(([^)]+)\)$/);
  if (scrapyAttrMatch) {
    let base = scrapyAttrMatch[1];
    if (engine === 'xpath' && !base.startsWith('/') && !base.startsWith('.')) base = '//' + base;
    return { realSelector: base, method: 'attr', engine, attribute: scrapyAttrMatch[2], modifier: null };
  }

  // Backwards compatibility with the legacy | syntax, bracket-aware so that a
  // CSS dashmatch such as `[lang|="en"]` is left alone.
  const pipe = lastPipeOutsideBrackets(workingSelector);
  if (pipe !== -1) {
    const attr = workingSelector.slice(pipe + 1);
    let base = workingSelector.slice(0, pipe);
    if (engine === 'xpath' && !base.startsWith('/') && !base.startsWith('.')) base = '//' + base;
    return { realSelector: base, method: 'attr', engine, attribute: attr, modifier: null };
  }

  if (engine === 'xpath' && !workingSelector.startsWith('/') && !workingSelector.startsWith('.')) {
    workingSelector = '//' + workingSelector;
  }

  return { realSelector: workingSelector, method: 'text', engine, modifier: null };
}
