---
name: debug-scraper
description: >-
  Use this skill when investigating scraper extraction failures, debugging HTML dumps,
  or testing retail selector patterns.
---

# Scraper HTML Debugging Runbook

## Overview
Scraper HTML responses are often minified into a single giant line. Printing raw dumps directly to terminal causes token spikes and poor visibility. Follow this structured runbook when inspecting retailer responses.

## Procedures

### 1. Locate and Format Debug HTML
The backend writes HTML debug dumps inside containers or local debug directories:
```bash
# Locate recent debug dumps
find backend/debug_html/ -name "*.html" -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n 5
```

If the HTML file is minified onto a single line, split closing tags before analysis:
```bash
tr '>' '\n' < /path/to/dump.html > /tmp/broken.html
```

### 2. Search High-Signal Attributes
Search for structured data and price elements using bounded grep:
```bash
# Target microdata, test IDs, and JSON-LD
grep -E -i 'itemprop="price"|data-testid.*price|class=".*price|application/ld\+json' /tmp/broken.html -C 2 | head -c 3000
```

### 3. Check Stored Retailer Configs
Before updating code, check existing selector rules in the database:
```sql
SELECT domain, price_selectors, name_selectors, availability_selectors, is_active
FROM retailer_configs
WHERE domain = 'example.com';
```

### 4. Test Selector Invariants
- Verify that out-of-stock listings correctly nullify price or mark availability.
- Verify whether the site requires the remote stealth Puppeteer scraper vs basic HTTP acquisition.
- Refer to `docs/developer/SCRAPER_LIFECYCLE.md` for stage transitions and `docs/admin/selectors.md` for the selector DSL syntax.
