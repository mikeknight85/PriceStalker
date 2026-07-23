# PriceStalker Admin: API Tokens

External integrations, scripts, or bot alerts authenticate using secure tokens managed via the **API Tokens** tab in the Admin Panel.

---

## 1. UI Token Management
Inside the **API Tokens** tab of the Admin Panel, you can:
* View a list of currently active system tokens.
* Generate a new token by providing a description/name for the integration.
* Revoke a token instantly if it is compromised or no longer needed.

---

## 2. Generating Tokens via CLI
Tokens can also be generated directly on the server host using backend console tools. To generate an access token, execute the following script in your terminal:

```bash
pnpm --filter pricestalker-backend exec ts-node src/scripts/generate-api-token.ts --user <username>
```

Replace `<username>` with the username of the account requiring authorization.

---

## 3. Database Revocation
System tokens are stored in the PostgreSQL database. If you do not have access to the UI panel, you can view or delete token records directly by inspecting the database schema.
