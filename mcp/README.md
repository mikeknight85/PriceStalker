# PriceStalker MCP Server & CLI (`pricestalker-mcp`)

Model Context Protocol (MCP) server and developer/admin tooling interface for [PriceStalker](https://github.com/mikeknight85/PriceStalker).

Connects PriceStalker to AI assistant hosts (**Claude Desktop**, **Cursor**, **Goose**, **Cline**, **Home Assistant**) over `stdio`, enabling operators to debug scraper configurations, inspect system health, search error logs, and inspect price trends directly within model context.

Architecture and design constraints are documented in [ADR 001](docs/developer/adr/001-mcp-server.md).

---

## Authentication & Token Scopes

The MCP server authenticates via a **System API Token** configured with the appropriate scopes in the PriceStalker Admin Panel (**Admin -> API Tokens**):

- `mcp:read`: Required for all read-only diagnostic tools, items, logs, retailer configurations, and context resources.
- `mcp:write`: Required if using `refresh_product_price` to force a price re-scrape.
- `admin:system`: Required if using `flush_system_caches` to invalidate in-memory settings and config caches.

All tool results and resource outputs pass through boundary redaction (`scrubber.ts`) to redact API keys, credentials, and user email addresses before entering model context.

---

## Quick Start (Terminal CLI)

```bash
# Build the workspace
pnpm --filter pricestalker-mcp run build

# Check system and database health
pnpm --filter pricestalker-mcp start health

# Search and list tracked items
pnpm --filter pricestalker-mcp start items -q "headphones"

# Flush system caches (requires admin:system scope)
pnpm --filter pricestalker-mcp start flush
```

---

## AI Assistant Configuration (MCP Server)

Configure your host with `PRICESTALKER_URL` and `PRICESTALKER_TOKEN`.

### 1. Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "pricestalker": {
      "command": "node",
      "args": ["/path/to/pricestalker/mcp/dist/index.js", "mcp"],
      "env": {
        "PRICESTALKER_URL": "http://localhost:3001",
        "PRICESTALKER_TOKEN": "ps_your_token_here"
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
        "PRICESTALKER_URL": "http://localhost:3001",
        "PRICESTALKER_TOKEN": "ps_your_token_here"
      }
    }
  }
}
```

---

## Capabilities (v1 Scope)

### Tools (9)
- `get_system_health`: Inspect database connection status and application version.
- `query_system_logs`: Query and filter system logs with server-side limit capping and email/credential redaction.
- `list_items`: List tracked items with their best current prices and store counts.
- `get_item`: Retrieve details for a specific tracked product or store listing.
- `search_items`: Perform a name-based product search via SearXNG.
- `get_price_history`: Retrieve recorded price and stock history time series for a product.
- `get_retailer_config`: Fetch scraping selector rules and configuration flags for a retailer domain.
- `refresh_product_price`: Trigger an immediate live price re-scrape for an existing product.
- `flush_system_caches`: Invalidate all in-memory system, retailer, and regional caches.

### Resources (3)
- `pricestalker://retailers/{domain}`: Active selector configuration for a store domain.
- `pricestalker://scrapes/recent-errors`: Last 20 scrape errors and failure logs.
- `pricestalker://system/health`: Live system and database health status.

### Prompts (1)
- `debug-retailer`: Guided interactive workflow to diagnose store scraping failures and hand the operator a configuration diff to apply in the Admin UI.
