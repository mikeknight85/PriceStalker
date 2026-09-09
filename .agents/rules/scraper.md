# Scraper Pipeline & HTML Extraction Guidelines

## 1. Pipeline Architecture
* The scraper engine follows a 7-stage pipeline (see `docs/developer/SCRAPER_LIFECYCLE.md` and `docs/admin/selectors.md`).
* Do not bypass consensus weighting, out-of-stock price nullification, or the AI auto-mapping / voting flows.
* When debugging retail extraction, inspect `retailer_configs` and `system_logs` first.

## 2. Debugging Minified HTML Dumps
Scraper HTML pages are often minified into a single line.
* **Detect minification**: Check if the HTML is on a single line. Break tags into lines before searching:
  ```bash
  sed 's/>/>\'$'\n/g' /path/to/dump.html > /tmp/broken.html
  # or
  tr '>' '\n' < /path/to/dump.html > /tmp/broken.html
  ```
* **Never print full HTML to console**: Redirect dumps to temporary files.
* **Target high-signal attributes**: Focus grep queries on:
  - `itemprop="price"`
  - `data-testid="*price*"`
  - `data-price`
  - `class="*price*"`
  - `application/ld+json`
* **Cap output with head**:
  ```bash
  grep -E -i 'itemprop="price"|data-testid.*price|class=".*price' /tmp/broken.html -C 2 | head -c 2000
  ```
