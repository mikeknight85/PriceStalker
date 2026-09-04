# PriceStalker Admin: API Tokens

External integrations, scripts, or bot alerts authenticate using secure tokens managed via the **API Tokens** tab in the Admin Panel.

---

## 1. UI Token Management
Inside the **API Tokens** tab of the Admin Panel, you can:
* View a list of currently active system tokens, their creation date, and last used timestamps.
* Generate a new token by providing a description/name for the integration. Tokens are generated with a secure `ps_` prefix (e.g. `ps_a1b2c3d4...`) for easy identification in configuration files and secret managers.
* Copy the full token string immediately upon creation (tokens are write-only and cannot be revealed again).
* Revoke a token instantly if it is compromised or no longer needed.

---

## 2. Authenticating with Tokens
Pass the generated token in the `Authorization` header of your HTTP request:

```bash
curl -H "Authorization: Bearer ps_your_token_here" http://localhost:3001/api/products
```

---

## 3. Generating Tokens via CLI
Tokens can also be generated directly on the server host using backend console tools. To generate an access token, execute the following script in your terminal:

```bash
pnpm --filter pricestalker-backend exec tsx src/scripts/generate-api-token.ts --user <username>
```

Replace `<username>` with the username of the account requiring authorization.

---

## 4. Database Revocation
System tokens are stored in the `system_api_tokens` table in PostgreSQL. If you do not have access to the UI panel, you can view or delete token records directly by querying the database.
