# PriceStalker Admin: Tokens & API Auth

External tools, webhooks, or notification scripts must authenticate before accessing PriceStalker endpoints.

---

## 1. Authentication Header
PriceStalker endpoints require authentication headers. Send requests using:
```http
Authorization: Bearer <your_token>
```

---

## 2. Generating Tokens
Tokens can be generated using backend console tools. To generate an access token, execute the script in your terminal:

```bash
pnpm --filter pricestalker-backend exec ts-node src/scripts/generate-api-token.ts --user <username>
```

Replace `<username>` with the username of the account requiring authorization.

---

## 3. Revoking Tokens
Tokens are stored inside the database repository. If a token is compromised:
1. Open your Postgres database client.
2. View user rows or session rows in the schema to revoke the access credentials.
