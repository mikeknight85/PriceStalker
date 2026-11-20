export const RETAILER_GENERATION_PROMPT = `You are a web scraping expert. Analyze the provided HTML and JSON-LD data to determine the best CSS selectors and JSON-LD keys for extracting product information from this domain.

Return a JSON object exactly matching this interface:
{
  "retailer_name": string | null,
  "currency": string | null,
  "name_selectors": string[],
  "price_selectors": string[],
  "deal_price_selectors": string[],
  "member_price_selectors": string[],
  "pre_order_price_selectors": string[],
  "original_price_selectors": string[],
  "image_selectors": string[],
  "stock_selectors": string[],
  "price_regex": string[],
  "jsonld_name_key": string | null,
  "jsonld_price_key": string | null,
  "jsonld_image_key": string | null,
  "prefer_jsonld_image": boolean | null
}

Important Guidelines:
- "retailer_name": The human-readable name of the store/website. For regional domains/subdomains of a global brand, identify the regional site name if present in metadata or page titles (e.g., including the country/region name).
- "currency": The 3-letter currency code (e.g., "USD", "AUD", "EUR") detected on the page, or null if ambiguous.
- "prefer_jsonld_image": Set to true if structured JSON-LD contains a clean canonical image and DOM images are dynamic, hashed, or wrapped in complex carousels/thumbnails.
- Prefer specific, robust CSS selectors over generic tag names (e.g. prefer specific classes over generic "h1" or "span").
- **ATTRIBUTE SYNTAX**:
  * When extracting values from attributes (such as \`<meta ... content="...">\`, \`data-price="..."\`, or \`src="..."\`), always use \`::attr(attributeName)\`. For example:
    - \`meta[property="og:title"]::attr(content)\`
    - \`meta[property="og:image"]::attr(content)\`
    - \`span[data-price]::attr(data-price)\`
- **STABILITY PRIORITY**:
  1. Prioritize stable semantic attributes like \`[data-automation="..."]\`, \`[data-testid="..."]\`, \`[data-test="..."]\`, \`[data-identifier-id="..."]\`, \`[itemprop="..."]\`, etc., over class names when they are present on the element.
  2. If using class names, use standard, human-written classes (e.g., \`.product-title\`, \`#price-value\`, \`.pdp-price\`).
  3. **NEVER** use dynamically generated, hashed, or CSS-in-JS class names (e.g. \`.css-ip5c5v\`, \`.css-11o4j7i\`, or class names with random alphanumeric hashes). These change every time the website redeploys and will break.
  4. **AVOID SKELETONS, MODALS & NOISE**: Many modern websites render empty "skeleton" placeholders, hidden dialogs/modals (e.g., cart limit modals, sign-in dialogs, error alerts), or related product carousels. **NEVER** select these elements. Avoid selectors targeting \`[role="dialog"]\`, modal titles, or elements with \`.d-none\` / \`[hidden]\`. Target the genuine product details on the main page.
  5. **CASE SENSITIVITY & CAMELCASE**: If generating partial class matching selectors like \`[class*="..."]\`, make sure the matched string matches the casing of the classes in the HTML exactly. (e.g., if the class is "memberPrice" camelCase, use \`[class*="memberPrice"]\` rather than \`[class*="member-price"]\`).
- **PRECISION MAPPING**:
  * **Price**: 
    - "price_selectors": CSS selectors for the standard/regular price of the product.
    - "deal_price_selectors": CSS selectors for any active public deal/sale price.
    - "member_price_selectors": CSS selectors for members-only or loyalty program prices (e.g., "Member Price").
    - "pre_order_price_selectors": CSS selectors for pre-order pricing.
    - "original_price_selectors": CSS selectors for the original retail/MSRP/RRP price when a sale or member price is active.
    - Avoid overly broad wildcard selectors (such as \`[class*="price" i]\`) which match discount badges ("1/2 Price"), unit pricing (e.g., "$5.28/100g"), or recommended carousel product prices.
    - **SCREEN-READER / HIDDEN PRICE ELEMENTS**: Some websites render split visible prices (e.g., separate elements for currency symbol, whole number, and cents) next to a hidden screen-reader element containing the complete price (often with classes indicating hidden or offscreen text). When this pattern is detected, always prefer targeting the screen-reader only child element to extract a clean, single-string price, rather than selecting the parent element which would result in duplicated text (e.g., "$227.00$227.00").
  * **Name**: Target the main product heading (usually the main H1).
  * **Image**: Target the main product hero/gallery image, avoiding thumbnails or header logos.
  * **Stock & Availability**:
    - "stock_selectors": CSS selectors for elements indicating stock status or purchase capability.
    - **CRITICAL**: Always target the main buy/checkout button (e.g., elements containing "Add to Cart", "Buy Now", "Add to Basket") if present. Buy buttons are the most reliable indicators of online stock and act as an essential override when the site's static JSON-LD metadata reports "OutOfStock" incorrectly.
    - Also target elements displaying explicit stock/availability text (e.g., "In Stock", "Temporarily Unavailable", "Out of Stock").
- **Regex Fields**:
  * "price_regex": A list of regular expression patterns to clean up raw extracted prices, especially useful when the site splits the dollar/cents elements or prepends text. Return a site-specific regex pattern only if standard CSS selectors would extract fragmented or dirty values.
- Include multiple backup selectors if applicable.
- **JSON-LD Keys (Nested Dot-Paths)**:
  * "jsonld_name_key": The path to the product title inside the JSON-LD structure (usually "name").
  * "jsonld_price_key": The path to the price. If nested (which is very common for schema.org @type: Product), provide the full dot-path. For example:
    - "offers.price" (if offers is a single object)
    - "offers[0].price" (if offers is an array)
    - "offers.priceSpecification.price"
  * "jsonld_image_key": The path to the main product image. If the image is stored in an array or object, provide the specific index or key path. For example:
    - "image" (if string)
    - "image[0]" (if array of strings)
- Return ONLY valid JSON, no explanation text outside the JSON.

HTML Content:
`;
