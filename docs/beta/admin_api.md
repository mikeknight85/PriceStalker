# Admin API Documentation

The Admin API provides a secure, authorized interface to manage users, system settings, AI configurations, retailers, and logs.

## Connectivity
- **Backend URL**: `http://localhost/api` (or your configured PriceStalker hostname/IP)
- **Port**: Proxied via the frontend (usually port `80` or `8080`)

## Authentication
All admin endpoints require a valid JWT with `is_admin: true`, a valid `ADMIN_API_TOKEN` header (legacy bootstrap), or a database-backed **System API Token**.

---

## 🔑 System API Tokens
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/system-tokens` | GET | List all active system tokens |
| `/api/admin/system-tokens` | POST | Generate a new system token |
| `/api/admin/system-tokens/:id` | DELETE | Revoke a system token |

---

## 🛠️ System Commands
`POST /api/admin/command`

Execute predefined internal system tasks.

| Command | Description | Params |
|---------|-------------|--------|
| `clear-settings-cache` | Invalidates internal settings & config cache | None |
| `run-migration` | Triggers the database migration runner | None |

---

## 👥 User Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users` | POST | Create a new user |
| `/api/admin/users/:id` | PUT | Update user details |
| `/api/admin/users/:id` | DELETE | Delete a user |
| `/api/admin/users/:id/admin` | PUT | Toggle user admin status |

---

## ⚙️ System Settings
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/settings` | GET | Get system settings |
| `/api/admin/settings` | PUT | Update system settings |
| `/api/admin/debug/status` | GET | (Public) Check if debug mode is enabled |

---

## 🤖 AI Configuration & Testing
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/settings/ai` | GET | Get global AI settings |
| `/api/admin/settings/ai` | PUT | Update global AI settings |
| `/api/admin/settings/ai/test` | POST | Test global AI extraction on a URL |
| `/api/admin/settings/ai/test-gemini` | POST | Test Gemini API connection |
| `/api/admin/settings/ai/test-deepseek` | POST | Test DeepSeek API connection |
| `/api/admin/settings/ai/test-groq` | POST | Test Groq API connection |
| `/api/admin/settings/ai/test-mistral` | POST | Test Mistral API connection |
| `/api/admin/settings/ai/test-anthropic`| POST | Test Anthropic API connection |
| `/api/admin/settings/ai/test-openai` | POST | Test OpenAI API connection |
| `/api/admin/settings/ai/test-ollama` | POST | Test Ollama local connection |
| `/api/admin/settings/ai/gemini/models` | GET | List cached Gemini models |
| `/api/admin/settings/ai/gemini/models/refresh` | POST | Force refresh Gemini model list |

---

## 🏪 Retailer Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/retailers` | GET | List all retailers |
| `/api/admin/retailers` | POST | Add or update a retailer config |
| `/api/admin/retailers/:id` | DELETE | Remove a retailer config |
| `/api/admin/retailers/domain/:domain` | GET | Get config for a specific domain |
| `/api/admin/retailers/test` | POST | Test a retailer config live |

---

## 📜 System Logs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/logs` | GET | Fetch system logs (filtered/paginated) |
| `/api/admin/logs` | DELETE | Delete specific logs by ID |
| `/api/admin/logs/clear` | DELETE | Clear logs by level/context |

---

## 🏥 Database Health Monitoring
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/debug/db-health` | GET | Fetch active database health monitor state |
| `/api/admin/debug/db-health/test-alert` | POST | Trigger direct SMTP test email using fallback credentials |
| `/api/admin/debug/db-health/simulate` | POST | Simulate DB state transition (FAILED, HEALTHY, DEGRADED, RESET) |

---

## 🔍 Debugging & Extraction
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/debug/extract` | POST | Run full multi-strategy extraction on a URL |

> [!NOTE]
> `/api/admin/debug/extract` is the **preferred and standard way** to scrape or test any website via the API. It leverages the exact same multi-strategy consensus pipeline used by the background scheduler.
> 
> For websites that employ anti-bot protections (like Cloudflare, Geoblocking, or JS-based challenges), the remote scraper (`remotescraper` service) is utilized to bypass these blocks via a dockerized Puppeteer instance with stealth automation.

**Payload for `/api/admin/debug/extract`**:
```json
{
  "url": "https://www.example.com/product",
  "mode": "scraper",
  "config": {
    "use_remote_scraper": false
  },
  "use_ai": true,
  "returnHtml": false
}
```

* **`mode`**: Options are:
  * `"scraper"` (default, **preferred**): Executes the full extraction pipeline (standard HTTP first, falling back to remote browser scraping if Cloudflare or other bot challenges are detected).
  * `"bypass"`: Performs a direct local `axios` download, bypassing selector, consensus, and remote scraper logic entirely.
* **`config`**: An optional mock retailer configuration object to override the database config on-the-fly. Handy for testing different remote scraper, proxy, and user-agent settings:
  * `"use_remote_scraper"`: Set to `false` to test lightweight local HTTP crawling first; set to `true` to force remote Puppeteer scraping.
  * `"use_proxy"`: Enable proxy routing for the scrape attempt.
  * `"price_selectors"` / `"deal_price_selectors"` / `"member_price_selectors"`: Test selector overrides.
* **`returnHtml`**: Set to `true` to return the fetched HTML text directly in the JSON response payload.
* **`use_ai`**: Set to `true` to run AI extraction fallback on standard selector failure.

**Example cURL Request**:
```bash
curl -X POST http://localhost/api/admin/debug/extract \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.jbhifi.com.au/products/ecovacs-deebot-n30-pro-omni-robotic-vac-white",
    "mode": "scraper",
    "config": {
      "use_remote_scraper": false
    },
    "use_ai": true,
    "returnHtml": false
  }'
```

**HTML Dumps**:
Every debug scrape writes the acquired HTML content to the backend container's debug volume mapped to `/app/backend/debug_html/` on the server. The response payload will include a `debugFileUrl` field containing a relative path (e.g. `/debug_files/debug_1716900000000_example_com.html`) which can be used to view the exact HTML content served to the scraper at that second.
