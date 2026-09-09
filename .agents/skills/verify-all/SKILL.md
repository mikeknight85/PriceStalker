---
name: verify-all
description: >-
  Use this skill to run the full verification and test pipeline for PriceStalker
  (frontend build, backend tests, route tests, and emoji lint checks).
---

# Complete Verification Pipeline

## Step-by-Step Execution

Run the following commands in order:

### 1. Frontend Build & Typecheck
Ensure the frontend builds clean and types validate:
```bash
pnpm --filter pricestalker-frontend run build
```

### 2. Backend Tests & Build
Run vitest backend tests and compile TypeScript:
```bash
pnpm --filter pricestalker-backend test
pnpm --filter pricestalker-backend run build
```

### 3. Frontend Unit Tests
```bash
pnpm --filter pricestalker-frontend test
```

### 4. Playwright Route Tests
*Note: This relies on the prebuilt `frontend/dist` directory.*
```bash
pnpm --filter pricestalker-frontend run test:routes
```

### 5. UI Emoji Check
Verify that no emoji or unicode escape sequences exist in the UI code:
```bash
pnpm run lint
```

### 6. Full Repository Verification (Optional / Pre-Release)
```bash
make verify
```
