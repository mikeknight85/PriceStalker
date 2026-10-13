# PriceStalker Admin: Model Context Protocol (MCP) Server

PriceStalker includes an official **Model Context Protocol (MCP)** server package (`pricestalker-mcp`) designed to connect your PriceStalker instance directly to AI assistant hosts like **Claude Desktop**, **Cursor**, **Cline**, and **Home Assistant**.

It allows an AI assistant to inspect database health, search error logs, check store selector configurations, and perform live URL scraper extractions without giving the model unrestricted write access or exposing internal infrastructure to SSRF vulnerabilities.

Architecture and design constraints are detailed in [ADR 001](../developer/adr/001-mcp-server.md).

---

## 1. Architecture & Security Model

The MCP server runs as a separate workspace package (`pricestalker-mcp`) over `stdio` on the operator's machine or host:

1. **Client of the REST API**: The MCP server holds an API token and communicates over standard HTTP/HTTPS (`Authorization: Bearer ps_...`). It introduces no new open ports or network listeners on your server.
2. **Granular Token Scopes**: Access is strictly gated by the system API token's granted scopes. A token issued with `mcp:read` cannot perform scrape refreshes or clear system caches.
3. **Egress Boundary Redaction**: All tool outputs, logs, and resource context feeds pass through redaction before reaching the model:
   - Inline credentials (`http://user:pass@host`) are masked to `http://[REDACTED]:[REDACTED]@host`.
   - Passwords, API keys, tokens, and authorization headers are masked to `[REDACTED]`.
   - User email addresses in logs or error traces are masked to `[REDACTED_EMAIL]`.
4. **Server-Side SSRF Protection**: When performing live URL debug extractions (`debug_extract`), the backend validates the destination through `assertUrlIsSafe`, blocking requests to loopback (`127.0.0.1`), private RFC 1918 networks (`10/8`, `172.16/12`, `192.168/16`), and cloud metadata services (`169.254.169.254`).

---

## 2. Setting Up an API Token

In the PriceStalker Admin Panel, navigate to **Admin -> API Tokens**:

1. Click **Add Token**.
2. Give it a descriptive label (e.g., `Claude Desktop MCP`).
3. Select the required scopes:
   - **`mcp:read`** (Required): Enables read-only tools (`get_system_health`, `query_system_logs`, `list_items`, `get_item`, `search_items`, `get_price_history`, `get_retailer_config`) and context resources.
   - **`mcp:extract`** (Optional): Enables `debug_extract` to fetch and test live product URLs.
   - **`mcp:write`** (Optional): Enables `refresh_product_price` to trigger immediate price re-scrapes for existing products.
   - **`admin:system`** (Optional): Enables `flush_system_caches` to bust settings and configuration caches.
4. Set an expiration period (e.g., 90 days).
5. Copy the generated `ps_<hex>` token string immediately (tokens are write-only and cannot be viewed again).

---

## 3. Configuring AI Assistant Hosts

### Claude Desktop

Add the server to your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pricestalker": {
      "command": "node",
      "args": ["/path/to/pricestalker/mcp/dist/index.js", "mcp"],
      "env": {
        "PRICESTALKER_URL": "http://your-server-ip:5003",
        "PRICESTALKER_TOKEN": "ps_your_token_here"
      }
    }
  }
}
```

### Cursor

In your workspace, create or edit `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pricestalker": {
      "command": "node",
      "args": ["/path/to/pricestalker/mcp/dist/index.js", "mcp"],
      "env": {
        "PRICESTALKER_URL": "http://your-server-ip:5003",
        "PRICESTALKER_TOKEN": "ps_your_token_here"
      }
    }
  }
}
```

---

## 4. Available Tools Reference

| Tool | Required Scope | Description |
| :--- | :--- | :--- |
| `get_system_health` | `mcp:read` | Inspect database connectivity and backend application version. |
| `query_system_logs` | `mcp:read` | Query and filter system logs (capped at 50 records; emails redacted). |
| `list_items` | `mcp:read` | List all tracked items with their best current prices and store counts. |
| `get_item` | `mcp:read` | Fetch full details for a tracked product or store listing by its ID. |
| `search_items` | `mcp:read` | Perform a product search via SearXNG. |
| `get_price_history` | `mcp:read` | Retrieve recorded price and stock history time series for a product. |
| `get_retailer_config`| `mcp:read` | Fetch scraping selector rules and configuration flags for a store domain. |
| `refresh_product_price` | `mcp:write` | Trigger an immediate live price re-scrape for an existing product. |
| `flush_system_caches`| `admin:system`| Invalidate in-memory system, retailer, and regional caches. |
| `debug_extract` | `mcp:extract` | Test live URL extraction, discovering candidate prices and selectors safely. |

---

## 5. Resources & Prompts

### Context Feeds (Resources)
AI assistants can subscribe to or read these live feeds:
- `pricestalker://retailers/{domain}`: Live configuration rules for a retailer.
- `pricestalker://scrapes/recent-errors`: Last 20 scrape errors and failure logs.
- `pricestalker://system/health`: Live system and database health status.

### Guided Prompt (`debug-retailer`)
The `debug-retailer` prompt provides an interactive diagnostic workflow. When asked to investigate a failing store, the model:
1. Queries recent scrape error logs for that store domain.
2. Inspects current selector configuration and flags.
3. Checks price history of existing items tracked at that store.
4. Generates a concrete selector diff or JSON snippet for the administrator to review and paste into **Admin -> Retailers**.

---

## 6. Standalone CLI Utility

The `@pricestalker/mcp` package also functions as a lightweight terminal CLI for operators:

```bash
# Build the package
pnpm --filter pricestalker-mcp run build

# Health check
pnpm --filter pricestalker-mcp start --url http://localhost:5003 --token ps_*** health

# Search items
pnpm --filter pricestalker-mcp start --url http://localhost:5003 --token ps_*** items -q "headphones"

# Live debug extraction
pnpm --filter pricestalker-mcp start --url http://localhost:5003 --token ps_*** extract https://store.example/product

# Flush cache
pnpm --filter pricestalker-mcp start --url http://localhost:5003 --token ps_*** flush
```
