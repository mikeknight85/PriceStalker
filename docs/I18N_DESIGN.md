# Internationalization (i18n) — Design Document

Target release: **v1.4.0** (after SLO and multi-store land in v1.3.0).
Feature branch: `feature/i18n` (when started).

## Goals

- Make every user-facing string in the React frontend translatable.
- Ship **English + German** out of the gate; allow other languages to slot
  in via community PRs without code changes.
- Keep the architecture light enough that contributors can translate by
  forking + editing JSON files, no specialized tooling required.

## Non-goals (v1.4.0)

- **Backend log strings** — they're for operators, not users.
- **Notification templates** (Telegram / Discord / ntfy / Gotify message
  bodies) — separate, smaller surface; can come in a follow-up.
- **Right-to-left layout support** (Arabic, Hebrew). Worth doing eventually
  but adds CSS complexity; defer until there's actual demand.
- **Translation platform (Crowdin / Weblate / Lokalise)** — overkill until
  there are ≥3 active translators per language. Start with bare JSON +
  GitHub PR workflow.
- **Server-side locale negotiation** — locale lives client-side only.

## Library choice: react-i18next

| Candidate | Why considered | Why rejected |
|-----------|----------------|--------------|
| **react-i18next** ⭐ | Most popular React i18n lib (~50K weekly d/l), mature, plugins for detection + plurals + HTTP backend, good docs, framework-agnostic core | — |
| react-intl (FormatJS) | Strong on ICU message format, used by Linkwarden | More verbose API; ICU plurals overkill for our scope |
| Lingui | Compile-time message extraction | Smaller community, would need a Babel plugin in our Vite setup |
| i18next + manual React hooks | Flexible | More boilerplate than react-i18next gives us for free |

Pinning **react-i18next v15.x** + **i18next-browser-languagedetector** for
language autodetection. No HTTP backend — all translations bundle into
the SPA at build time (small total payload, simpler ops, no extra request).

## File structure

```
frontend/src/
├── i18n/
│   ├── config.ts             # i18next initialization, plugin wiring
│   └── languages.ts          # supported language list (EN, DE, FR, IT, ES, PT)
└── locales/
    ├── en/
    │   ├── common.json       # buttons, generic words ("Save", "Cancel", ...)
    │   ├── auth.json         # login/register/SSO-complete screens
    │   ├── dashboard.json    # product cards, summary, filters, sort
    │   ├── product.json      # product detail page
    │   ├── settings.json     # all settings sections
    │   ├── notifications.json
    │   └── errors.json       # toast + banner error messages
    ├── de/   (same files, translated)
    └── ...
```

Namespaces (one per file) keep translation chunks small and per-screen
discoverable. A translator fixing a typo on the dashboard never has to
scroll through 600 settings strings.

## Translation key conventions

- **Camel-case keys** within each namespace, organized by feature area:
  ```json
  {
    "loginTitle": "Sign in",
    "passwordPlaceholder": "••••••••",
    "errors": {
      "invalidCredentials": "Invalid email or password"
    }
  }
  ```
- **Placeholders use `{{name}}`** (i18next default):
  `t('auth:signInWith', { provider: 'Authentik' })` → `"Sign in with Authentik"`
- **Plurals** via `_one` / `_other` suffixes (i18next handles Slavic-style
  multi-category plurals automatically when needed):
  ```json
  { "productCount_one": "{{count}} product",
    "productCount_other": "{{count}} products" }
  ```
- **Don't pre-format dates / numbers / currencies in translations** —
  use `Intl.DateTimeFormat(locale)` and the existing `formatPrice` util,
  which already understands locale-specific separators.

## Language detection + switcher

Auto-detection order via `i18next-browser-languagedetector`:

1. URL query param `?lng=de` (debugging / sharing links)
2. `localStorage.i18nextLng` (user's last manual choice)
3. `navigator.language` (browser setting)
4. Fallback to `en`

**Manual switcher**: dropdown in the navbar (next to the theme toggle).
Selection persists to localStorage so it overrides browser detection on
return visits.

## Phases

| Phase | Scope | Estimate |
|-------|-------|----------|
| 0 | This doc + library choice locked | done when committed |
| 1 | Add deps, `i18n/config.ts`, language detector wiring, English `common.json` with the 20 most-frequent generic words | ~2h |
| 2 | Extract `auth.json` strings (login + register + SSO-complete). Smallest surface, proves the architecture | ~3h |
| 3 | Extract `dashboard.json` + `product.json` | ~4h |
| 4 | Extract `settings.json` (largest, six sub-sections) + `notifications.json` + `errors.json` | ~5h |
| 5 | Mike writes `de/*.json` (native speaker pass) | ~half day |
| 6 | Navbar language switcher + persistence | ~1h |
| 7 | Write `docs/TRANSLATING.md` for contributors | ~30 min |
| 8 | Cut v1.4.0 — EN + DE shipped | release |

After v1.4.0, additional languages slot in as community PRs over time
without further code changes.

## Translator workflow (`docs/TRANSLATING.md`)

For people translating PriceStalker into a new language:

1. Fork the repo
2. Copy the entire `frontend/src/locales/en/` directory to
   `frontend/src/locales/<your-bcp47-code>/` — e.g. `pt-BR`, `ja`, `nl`
3. Translate the *values* (right side of `:`) in each `.json` file. Don't
   touch the keys. Don't translate `{{placeholders}}`.
4. Add your language code to `frontend/src/i18n/languages.ts`
5. Open a PR. We review for sanity (correct keys, no broken JSON, no
   accidentally-translated placeholders) and merge.

CI will flag JSON syntax errors and missing keys against the EN baseline.
Stale translations (EN added a key, your language hasn't caught up) emit
warnings but don't block the PR — the missing strings just fall back to
English at runtime.

## Open questions

- **Should currency display follow UI language or product origin?**
  Product origin is what we already do (Digitec product = CHF, Amazon.de = EUR).
  The UI language only affects how digits are grouped (`1,234.56` vs `1.234,56`).
  Keep this behaviour — it's the right one.
- **Date/time format**: rely entirely on `Intl.DateTimeFormat(navigator.language)`.
  No translation strings for dates.
- **AI provider names** (Anthropic, OpenAI, Groq, OpenRouter, Ollama):
  proper nouns, don't translate. The labels around them (e.g. "Provider")
  do translate.
- **Email format validation messages**: keep generic — the validation
  is browser-handled with `<input type="email" required>` mostly.

## Rejected alternatives

- **Translation files in YAML or .po**: most React tooling expects JSON;
  no benefit from leaving the standard.
- **Lazy-loaded language bundles**: each language is ~30KB gzipped. Bundling
  all 6 supported languages adds ~150KB to the SPA — acceptable for the
  simpler ops story.
- **Translation comments / context inline**: would inflate JSON files.
  If a key needs context, name it descriptively (`auth.passwordTooShort`
  not just `auth.error1`) and rely on the translator's eyes.
