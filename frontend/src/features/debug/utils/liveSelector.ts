/**
 * Evaluating a PriceStalker selector against the extracted HTML, in the browser.
 *
 * The Live Selector Lab used to hand the admin's input straight to
 * `document.querySelectorAll`. Anything beyond plain CSS -- `::attr(content)`,
 * `!.price`, `xpath://`, `~regex~` -- made the DOM throw a SyntaxError, which
 * the Lab reported as "no elements found": the one message that tells an admin
 * their rule is wrong when in fact it was never run (issue #168).
 *
 * So the selector is parsed with the same grammar the backend uses, and each
 * engine is dispatched to the browser equivalent of what the scraper does:
 * CSS to `querySelectorAll`, XPath to `document.evaluate`, regex to `RegExp`
 * over the HTML. The value each match yields is the value the extraction engine
 * would have taken from it, so what the Lab shows is what the scraper sees.
 */

import { parseSelector, SelectorEngine, SelectorMethod } from '../../../utils/selectorDsl';

/** How many matches the Lab renders. Pages can match thousands of nodes. */
const MAX_MATCHES = 10;

export interface LiveMatch {
  /** Tag name of the matched element, or null for a regex capture. */
  tagName: string | null;
  /** The value the extraction engine would take from this match. */
  value: string | null;
  /** What that value is -- "Text", "content", "HTML", "Match". */
  valueLabel: string;
  /** Element text, kept as context even when the value came from an attribute. */
  text: string;
  /** The attribute the rule targets, so the card can highlight it. */
  attribute: string | null;
  /** Stock status asserted by a suffix modifier, when the rule carries one. */
  status: string | null;
  html: string;
  attributes: Record<string, string>;
}

export interface LiveSelectorResult {
  matches: LiveMatch[];
  engine: SelectorEngine;
  method: SelectorMethod;
  /** Set when the selector could not be run at all, rather than simply missing. */
  error: string | null;
}

function emptyResult(engine: SelectorEngine, method: SelectorMethod, error: string | null): LiveSelectorResult {
  return { matches: [], engine, method, error };
}

/**
 * The last document parsed, kept so that typing a selector does not re-parse a
 * multi-megabyte retailer page on every keystroke. One entry is enough: the Lab
 * tests one extraction at a time, and it is dropped as soon as a different page
 * is scraped.
 */
let lastParsed: { html: string; doc: Document } | null = null;

function parseOnce(html: string): Document {
  if (lastParsed && lastParsed.html === html) return lastParsed.doc;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  lastParsed = { html, doc };
  return doc;
}

/** Text of an element as the scraper reads it: script/style/noscript stripped. */
function elementText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, noscript').forEach(node => node.remove());
  return (clone.textContent || '').trim();
}

function collectAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

/**
 * The scraper drops a match whose suffix modifier does not agree; the Lab does
 * the same, so a rule that asserts a status shows only the nodes it accepts.
 */
function applyModifier(
  value: string | null,
  modifier: { type: 'equals' | 'contains'; value: string; targetStatus: string } | null
): { keep: boolean; status: string | null } {
  if (!modifier || !value) return { keep: true, status: null };
  const current = value.toLowerCase();
  const target = modifier.value.toLowerCase();
  const matched = modifier.type === 'equals' ? current === target : current.includes(target);
  return matched ? { keep: true, status: modifier.targetStatus } : { keep: false, status: null };
}

function matchesFromElements(
  elements: Element[],
  method: SelectorMethod,
  attribute: string | undefined,
  modifier: { type: 'equals' | 'contains'; value: string; targetStatus: string } | null
): LiveMatch[] {
  const matches: LiveMatch[] = [];

  for (const el of elements) {
    if (matches.length >= MAX_MATCHES) break;

    const text = elementText(el);
    let value: string | null;
    let valueLabel: string;

    if (method === 'attr' && attribute) {
      value = el.getAttribute(attribute);
      valueLabel = attribute;
    } else if (method === 'html') {
      // Mirrors the engine's CSS branch, which takes inner HTML.
      value = el.innerHTML;
      valueLabel = 'HTML';
    } else {
      value = text;
      valueLabel = 'Text';
    }

    const { keep, status } = applyModifier(value, modifier);
    if (!keep) continue;

    matches.push({
      tagName: el.tagName.toLowerCase(),
      value: value === null ? null : value.substring(0, 300),
      valueLabel,
      text: text.substring(0, 100),
      attribute: method === 'attr' && attribute ? attribute : null,
      status,
      html: el.innerHTML.substring(0, 200),
      attributes: collectAttributes(el)
    });
  }

  return matches;
}

function runXPath(doc: Document, expression: string): Element[] {
  const snapshot = doc.evaluate(expression, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const elements: Element[] = [];
  for (let i = 0; i < snapshot.snapshotLength; i++) {
    const node = snapshot.snapshotItem(i);
    if (node && node.nodeType === Node.ELEMENT_NODE) {
      elements.push(node as Element);
    }
  }
  return elements;
}

function runRegex(
  html: string,
  pattern: string,
  modifier: { type: 'equals' | 'contains'; value: string; targetStatus: string } | null
): LiveMatch[] {
  const regex = new RegExp(pattern, 'g');
  const matches: LiveMatch[] = [];
  let found: RegExpExecArray | null;

  while ((found = regex.exec(html)) !== null && matches.length < MAX_MATCHES) {
    // A pattern that can match the empty string would otherwise spin forever.
    if (found.index === regex.lastIndex) regex.lastIndex++;

    const value = found[1] ?? found[0];
    const { keep, status } = applyModifier(value, modifier);
    if (!keep) continue;

    matches.push({
      tagName: null,
      value: value.substring(0, 300),
      valueLabel: 'Match',
      text: value.substring(0, 100),
      attribute: null,
      status,
      html: found[0].substring(0, 200),
      attributes: {}
    });
  }

  return matches;
}

/**
 * Runs `selector` against `html` and reports what the extraction engine would
 * find. Never throws: a selector the browser rejects comes back as `error` so
 * the Lab can say the rule is invalid rather than that the page lacks it.
 */
export function evaluateLiveSelector(html: string, selector: string): LiveSelectorResult {
  const trimmed = selector.trim();
  if (!html || !trimmed) return emptyResult('css', 'text', null);

  const parsed = parseSelector(trimmed);

  if (!parsed.realSelector) {
    return emptyResult(parsed.engine, parsed.method, 'The selector is empty once its syntax is stripped.');
  }

  if (parsed.engine === 'regex') {
    try {
      return {
        matches: runRegex(html, parsed.realSelector, parsed.modifier),
        engine: parsed.engine,
        method: parsed.method,
        error: null
      };
    } catch (e) {
      return emptyResult(parsed.engine, parsed.method, `Invalid regular expression: ${(e as Error).message}`);
    }
  }

  let doc: Document;
  try {
    doc = parseOnce(html);
  } catch (e) {
    return emptyResult(parsed.engine, parsed.method, `Could not parse the extracted HTML: ${(e as Error).message}`);
  }

  let elements: Element[];
  try {
    elements = parsed.engine === 'xpath'
      ? runXPath(doc, parsed.realSelector)
      : Array.from(doc.querySelectorAll(parsed.realSelector));
  } catch (e) {
    const label = parsed.engine === 'xpath' ? 'XPath expression' : 'CSS selector';
    return emptyResult(parsed.engine, parsed.method, `Invalid ${label}: ${(e as Error).message}`);
  }

  return {
    matches: matchesFromElements(elements, parsed.method, parsed.attribute, parsed.modifier),
    engine: parsed.engine,
    method: parsed.method,
    error: null
  };
}
