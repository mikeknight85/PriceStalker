# PriceStalker MCP Server & CLI (`@pricestalker/mcp`)

Model Context Protocol (MCP) server and interactive command-line interface for [PriceStalker](https://github.com/mikeknight85/PriceStalker).

Connect PriceStalker to AI assistants (**Claude Desktop**, **Cursor**, **Goose**, **Cline**, **Home Assistant**) or use it directly from your terminal.

---

## Quick Start (Terminal CLI)

```bash
# Build the workspace
pnpm --filter pricestalker-mcp run build

# Search tracked items
pnpm --filter pricestalker-mcp start items -q "headphones"

# Check active deals and price drops
pnpm --filter pricestalker-mcp start deals --below-target

# Non-persisted dry-run extraction from a URL
pnpm --filter pricestalker-mcp start extract https://example.com/product/123

# Inspect all candidate prices and selectors across a live page
pnpm --filter pricestalker-mcp start inspect https://example.com/product/123

# Check system & database health
pnpm --filter pricestalker-mcp start health

# Flush system and retailer caches
pnpm --filter pricestalker-mcp start flush
```

---

## AI Assistant Configuration (MCP Server)

### 1. Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "pricestalker": {
      "command": "node",
      "args": ["/path/to/pricestalker/mcp/dist/index.js", "mcp"],
      "env": {
        "PRICESTALKER_URL": "http://localhost:3000",
        "PRICESTALKER_TOKEN": "pst_your_api_token_here"
      }
    }
  }
}
```

### 2. Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "pricestalker": {
      "command": "node",
      "args": ["/path/to/pricestalker/mcp/dist/index.js", "mcp"],
      "env": {
        "PRICESTALKER_URL": "http://localhost:3000",
        "PRICESTALKER_TOKEN": "pst_your_api_token_here"
      }
    }
  }
}
```

---

## Available MCP Capabilities

### Tools
* **Shopping & Price Intelligence:**
  * `search_items` (Search tracked items with best current prices and store listings)
  * `search_web_for_products` (SearXNG web-wide product discovery)
  * `get_item` (Retrieve full item details and stores)
  * `compare_stores` (Cross-compare prices, stock, and retailers for an item)
  * `list_deals_and_drops` (List items with price reductions or below target)
  * `get_price_history` (Historical time-series, ATL, and averages)
  * `analyze_price_trend` ("Buy Now vs. Wait" purchase recommendation)
  * `optimize_shopping_basket` (Multi-item single-store vs split-order cost optimizer)
  * `batch_import_urls` (Extract and track URLs from freeform text / wishlists)
* **Product & Tracking Management:**
  * `track_product` (Add new URL with target price & alert rules)
  * `meta_extract_url` (Extract title, price, currency, image, and stock without saving)
  * `update_item_alerts` (Adjust target price and back-in-stock notifications)
  * `delete_item` (Stop tracking and delete item)
  * `bulk_toggle_tracking` (Bulk pause or resume scheduled scraping)
  * `rescan_product` & `confirm_product_selection` (Re-scan and confirm price selections)
  * `refresh_product_price` (Force an immediate live re-scrape)
* **Developer & Scraper Workbench:**
  * `inspect_url_prices` (Discover all candidate prices across DOM, JSON-LD, and meta tags)
  * `generate_retailer_selectors` (Derive full `RetailerConfig` proposal)
  * `test_retailer_config` (Dry-run custom selectors against a live page)
  * `save_retailer_config` (Persist retailer rules and invalidate caches)
  * `remap_retailer` (Trigger live AI consensus auto-mapping)
  * `benchmark_retailer` (Test selectors across 2–5 URLs to prevent regressions)
  * `debug_extract` (Deep debug with plain HTTP bypass and forced AI modes)
* **System Diagnostics & Operations:**
  * `test_notification_channel` (Live test Telegram, Discord, Pushover, Ntfy, Gotify, Email, Webhook)
  * `test_ai_provider` (Test Gemini, Vertex, Anthropic, DeepSeek, Groq, Mistral, OpenAI, Ollama)
  * `flush_system_caches` (Bust retailer config & regional mapping caches)
  * `query_system_logs` (Search and filter system logs)
  * `get_system_health` (Database connectivity and version status)

### Resources
* `pricestalker://retailers/{domain}`
* `pricestalker://scrapes/recent-errors`
* `pricestalker://deals/active`
* `pricestalker://system/health`

### Prompts
* `debug-retailer` (Interactive guided workflow to fix broken selectors)
* `deal-advisor` (Purchase recommendation analysis across catalog)
* `batch-ingest` (Interactive multi-URL preview and tracking)
