# Upstream Debug Interface Audit Reference

This document is a cleaned-up reference of the historical audit conducted upstream on the frontend Debug Workstation (`/debug` route) and the backend debug API endpoints (`/admin/debug/*`). It acts as a reference registry for bugs and optimization opportunities in the developer testing panels.

---

## 🗺️ Overview & File Map

The Debug Workstation is an admin-only page for running single-shot scraper extractions against arbitrary URLs, inspecting raw HTML, reviewing candidates, and refining selectors.

| File Path | Role |
|---|---|
| `frontend/src/features/debug/pages/DebugPage.tsx` | Root layout & layout shell |
| `frontend/src/features/debug/pages/DebugControls.tsx` | Sidebar input controls |
| `frontend/src/features/debug/pages/ManualConfigSection.tsx` | Per-category selector editor modal |
| `frontend/src/features/debug/pages/ResultDisplay.tsx` | Extraction results & candidate tables |
| `frontend/src/features/debug/pages/useDebugScraper.ts` | Central state management & API flow |
| `frontend/src/features/debug/pages/DebugPage.css` | Panel styling (594 lines) |
| `frontend/src/features/debug/pages/SelectorTester.tsx` | **Dead code** — never imported/rendered |
| `backend/src/routes/admin/debug.ts` | Backend endpoint handlers |
| `frontend/src/api/RetailerAdminService.ts` | `debugExtract()` API client method |

---

## 🔴 Identified Upstream Bugs

### 1. `SelectorTester` Component is Dead Code
* **File:** `SelectorTester.tsx`, `DebugPage.tsx`
* **Issue:** The "Live Selector Lab" (`SelectorTester.tsx`) is a fully implemented helper panel allowing quick testing of custom CSS selectors with matching pill highlights (`+ Price`, `+ Name`, etc.). Although the logic is fully wired in the hook `useDebugScraper.ts`, the component itself is never imported or rendered in any layout shell, making the feature invisible to administrators.
* **Fix:** Import and render `SelectorTester` inside the layout shell of `DebugPage.tsx`.

### 2. `returnHtml` Checkbox is Non-Functional
* **File:** `useDebugScraper.ts` (line 310)
* **Issue:** The "Advanced Options" modal displays a checkbox for "Return Raw HTML" (bound to `returnHtml` state). However, `runExtraction()` passes a hardcoded `true` as the API payload argument, ignoring the user checkbox selection.
* **Impact:** HTML is always sent over the wire, wasting bandwidth and client memory for large files.
* **Fix:** Change the hardcoded `true` value to reference `returnHtml` in the hook function.

### 3. Candidate Tab Bar Disappears on Mobile Views
* **File:** `ResultDisplay.tsx`, `DebugPage.css`
* **Issue:** The responsive CSS includes a rule that hides the horizontal `.tab-buttons` in favor of `.tab-select-mobile` on screens narrower than `600px`. However, the `<select>` container is never rendered in the React tree, meaning mobile layout tests display no candidate tabs.
* **Fix:** Render the select box dropdown in `ResultDisplay.tsx` for small viewports, or utilize a scrollable flex row for the standard tabs.

### 4. Null Pointer Crashes in `ResultDisplay`
* **File:** `ResultDisplay.tsx`
* **Issues:**
  1. `result.stockStatus.replace('_', ' ')` throws a runtime TypeError if `stockStatus` is null.
  2. `(c.confidence * 100).toFixed(0)` throws if confidence values are not populated.
* **Fix:** Add optional chaining / fallback null-guards:
  ```tsx
  (result.stockStatus || 'unknown').replace('_', ' ')
  ((c.confidence ?? 0) * 100).toFixed(0)
  ```
