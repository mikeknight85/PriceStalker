# Core Project Invariants & Guidelines

These rules protect fundamental architectural decisions across PriceStalker. They apply to every task and must not be bypassed.

## 1. Zero Emoji in UI
* The UI uses custom SVG icons at [`frontend/src/components/Icon/Icon.tsx`](file:///home/steven/projects/pricestalker/frontend/src/components/Icon/Icon.tsx).
* **Never add emoji** (literal, unicode escape `\u{1F514}`, or string) to any `.ts` / `.tsx` file.
* Typographic characters (`→`, `←`, `↑`, `↓`, `↻`) are allowed for genuine text/sort indicators.
* Enforced by `pnpm run lint` (`scripts/check-no-emoji.mjs`).

## 2. Null-Safe Formatting
* `users.locale` can be `null`. Never call `Intl` or `Date#toLocale*` directly on user locale.
* Always format prices and dates using [`frontend/src/utils/format.ts`](file:///home/steven/projects/pricestalker/frontend/src/utils/format.ts) (`formatPrice`, `formatDate`), which safely default `null` to `undefined`.

## 3. Error Boundaries
* Wrap every top-level page and new tab/feature section in `<ErrorBoundary section="...">` ([`frontend/src/components/ErrorBoundary`](file:///home/steven/projects/pricestalker/frontend/src/components/ErrorBoundary)).

## 4. Items vs Products Domain Distinction
* **`items`** (Database) / **"Product"** (UI): The canonical entity the user wants to buy.
* **`products`** (Database) / **"Store"** (UI): An individual retailer listing (URL, scrape schedule/history).
* **Alert settings live on `items`** (`target_price`, `price_drop_threshold`, `notify_back_in_stock`). Queries joining product & alert settings must use `ITEM_ALERT_COLUMNS` / `ITEM_ALERT_JOIN` and `withItemAlertSettings` ([`repositories/item-alert-settings.ts`](file:///home/steven/projects/pricestalker/backend/src/repositories/item-alert-settings.ts)).

## 5. Strict TypeScript & Clean Code
* Strict mode is enabled. **No `as any` or `// @ts-ignore`**.
* Fix type definitions or create minimal local type overrides rather than suppressing errors.
* `axios` is pinned to exactly `1.14.0` across all workspaces.

## 6. Safe System & Agent Operations
* **High-volume directories**: Never search `node_modules`, `dist`, or `.git`. Always specify targeted paths (`find backend/src -name "*.ts"`).
* **Logs as streams**: Never `cat` full log files. Always use `tail -n 100` or targeted `grep`.
* **Credential Scrubbing**: Never log credentials or raw API keys. Rely on the built-in logger scrubber.
* **Secrets over API**: Secrets are write-only over the API (endpoints return `has_<secret>`, never the plain value).

## 7. Git & Commit Workflow
* **Do not commit or push** unless explicitly instructed by the user.
* Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`.
* Branch naming: `<type>/<short-description>`.
