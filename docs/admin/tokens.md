# PriceStalker Admin: API Tokens

External integrations, scripts, or bot alerts authenticate using secure tokens managed via the **API Tokens** tab in the Admin Panel.

---

## 1. UI Token Management
Inside the **API Tokens** tab of the Admin Panel, you can:
* View a list of currently active system tokens, their scopes, creation date, expiry and last used timestamps.
* Generate a new token by providing a label, choosing its scopes and choosing when it expires. Tokens are generated with a secure `ps_` prefix (e.g. `ps_a1b2c3d4...`) for easy identification in configuration files and secret managers.
* Copy the full token string immediately upon creation (tokens are write-only and cannot be revealed again).
* Revoke a token instantly if it is compromised or no longer needed.

---

## 2. Scopes

A token can only reach the endpoints its scopes cover. It still has to belong to
an administrator account to reach the admin endpoints — scopes narrow a
credential, they never widen one.

| Scope | What it allows |
| :--- | :--- |
| `mcp:read` | Read tracked items, price and stock history, the instance version, and the read-only administrative diagnostics (system logs, a retailer's selector config, database health) |
| `mcp:write` | Add, rescan, retarget and untrack products; force a price refresh |
| `mcp:extract` | The URL extraction and debug endpoints under `/api/admin/debug` |
| `admin:read` | Read instance configuration, including authentication and SSO settings |
| `admin:write` | Change instance configuration: users, AI providers, auth config, retailer selectors, system settings |
| `admin:system` | Operational and destructive actions: `POST /api/admin/command` (which includes `run-migration`) and clearing the system log |
| `*` | Full access to every endpoint. Deprecated — grant a narrower set instead |

A request a token's scopes do not cover is answered with `403` and the scopes
that would have been accepted. Minting a new token requires `*`, so a narrow
token cannot issue itself a wider one.

### Deprecated tokens

Tokens issued before scopes existed hold `*` and keep working unchanged — the
upgrade breaks nothing. The Admin UI marks them **DEPRECATED / UNSCOPED / FULL
ACCESS**, and the backend logs a deprecation warning each time one is used,
naming its label.

They cannot be narrowed in place. Only the bcrypt hash of a token is ever
stored, so neither its scopes nor its lookup prefix can be reconstructed from an
existing row. Replace one by generating a new token with the scopes the
integration actually needs, pointing the integration at it, and then deleting the
old one. Support for unscoped tokens will be removed in a future release.

---

## 3. Expiry

A token can be given an expiry when it is created (30 days, 90 days, a year, or
never). An expired token is refused before its scopes or its account are
considered. Tokens created before expiry was offered in the UI have no expiry and
keep working.

---

## 4. Authenticating with Tokens
Pass the generated token in the `Authorization` header of your HTTP request:

```bash
curl -H "Authorization: Bearer ps_your_token_here" http://localhost:3001/api/products
```

---

## 5. Generating Tokens via CLI
Tokens can also be generated directly on the server host using backend console tools:

```bash
pnpm --filter pricestalker-backend exec tsx src/scripts/generate-api-token.ts \
  "Label" "Optional description" --user admin@example.com --scopes mcp:read,admin:read
```

* `--user` is the email address of the administrator account the token acts as.
  Omit it and the token is linked to the longest-standing administrator on the
  installation, which the script prints. A token **must** be linked to a user:
  one that is not is refused at authentication rather than silently acting as
  user 1.
* `--scopes` takes a comma-separated list. Omit it and the token is granted `*`
  (full access), which the script says out loud.

---

## 6. Database Revocation
System tokens are stored in the `system_api_tokens` table in PostgreSQL. If you do not have access to the UI panel, you can view or delete token records directly by querying the database.
