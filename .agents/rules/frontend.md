# Frontend Architecture & Guidelines

## 1. Feature-Sliced Structure
The frontend is organized by feature slices under `frontend/src/features/<feature>/`:
* `components/`: Feature-specific UI components.
* `pages/`: Feature page views.
* `services/` & `hooks/`: Feature API services, data hooks, and business logic.
* `frontend/src/components/`: Shared, reusable UI components only.
* `frontend/src/pages/`: Top-level route shells only — **do not place business logic, state hooks, or API calls directly in route shells**.

## 2. Defensive Data Handling
* Never assume the shape of API responses.
* The test mock proxy or backend error handlers can return `{}` or empty data.
* `data?.find(...)` or `data?.map(...)` will crash if `data` is an empty object (`{}`).
* Always use guards: `Array.isArray(data) ? data : []`.

## 3. UI Icon Standards (No Emoji)
* Use `<Icon name="..." />` from [`frontend/src/components/Icon/Icon.tsx`](file:///home/steven/projects/pricestalker/frontend/src/components/Icon/Icon.tsx).
* To add new icons, define them in `Icon.tsx` following the 24×24 viewBox, stroke-based, `currentColor` pattern.
* Never use raw or unicode-escaped emoji in `.tsx`/`.ts` files.

## 4. Null-Safe Locale & Currency Formatting
* Format all price and date values through [`frontend/src/utils/format.ts`](file:///home/steven/projects/pricestalker/frontend/src/utils/format.ts) (`formatPrice`, `formatDate`).
* Never pass un-sanitized `users.locale` into `Intl` constructors.

## 5. ErrorBoundary Containment
* Every route view and distinct tab section must be enclosed inside an `<ErrorBoundary section="...">` to prevent render crashes from blanking the application.

## 6. Testing & Building Frontend
* **Build Before Route Tests**: Playwright route tests (`pnpm --filter pricestalker-frontend run test:routes`) run against the prebuilt `dist/` directory served via Vite preview.
* Always execute `pnpm --filter pricestalker-frontend run build` before executing route tests to ensure tests run against current code.
