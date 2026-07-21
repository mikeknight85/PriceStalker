export const ARBITRATION_PROMPT = `You are a price arbitration assistant. Multiple price extraction methods found different prices for the same product. Help determine the correct price.

Found prices:
$CANDIDATES$

Analyze the HTML content below and determine which price is the correct CURRENT selling price for the main product.

Consider:
- JSON-LD structured data is usually highly reliable (schema.org standard)
- Site-specific extractors are well-tested for major retailers
- Generic CSS selectors might catch wrong prices (shipping, savings, bundles, etc.)
- Look for the price that appears in the main product display area
- Ignore crossed-out/original prices, shipping costs, subscription prices, or bundle prices

Return a JSON object with:
- selectedIndex: the 0-based index of the correct price from the list above
- confidence: your confidence from 0 to 1
- reason: brief explanation of why this price is correct

Only return valid JSON, no explanation text outside the JSON.

HTML Content:
`;
