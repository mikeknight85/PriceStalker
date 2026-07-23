# PriceStalker docs

Reference documentation for the codebase.

## User & Administration Guides

| Doc | Covers |
|---|---|
| [BETA.md](BETA.md) | **User Guide**: High-level overview of product tracking, the scraping cascade, consensus weighting, and the user voting queue. |
| [beta/README.md](beta/README.md) | **System Administration Portal**: Guides for managing retailers, custom selectors, AI settings, API security tokens, and proxies in Version 2. |

## Engine internals (adapted from upstream)

The scraper engine is shared with the upstream fork it was transplanted from.
These describe how it works and were adapted from that fork's docs — his
infrastructure removed, brand normalised, verified against this repo where
noted. Docs drift; trust the code for specifics.

| Doc | Covers |
|---|---|
| [SCRAPER_LIFECYCLE.md](SCRAPER_LIFECYCLE.md) | The 6-phase product scrape pipeline: acquisition → extraction → auto-mapping → consensus → verification. Confidence scores and method weights. |
| [SELECTORS.md](SELECTORS.md) | The selector DSL — CSS/XPath/Regex engines, `::attr()` and `->status` modifiers, staleness scoring and eviction. |
| [SCRAPER_AUDIT.md](SCRAPER_AUDIT.md) | Upstream backend audit / issue register (S-1…X-3). `[COMPLETED]` = fixed in HIS code — verify against ours. |
| [DATABASE.md](DATABASE.md) | Core tables, the `pg_notify` cache-invalidation triggers, backup. |
| [DESIGN_TOKENS.md](DESIGN_TOKENS.md) | Frontend CSS design tokens. Verified against `frontend/src/index.css`. |

## PriceStalker-specific

| Doc | Covers |
|---|---|
| [SSO_DESIGN.md](SSO_DESIGN.md) | OIDC/SSO design (a PriceStalker feature, ported forward). |
| [I18N_DESIGN.md](I18N_DESIGN.md) | Internationalisation design. |

## Not yet imported

The lifecycle doc references an upstream **audit register** (`audits/claude3.md`)
with a numbered issue list (U-1, X-2, C-3, …) — the catalogue of known
scraper landmines. We don't have it yet; requested from upstream. Until then the
issue IDs in SCRAPER_LIFECYCLE.md are pointers without the full text.

See [../CLAUDE.md](../CLAUDE.md) for contributor rules.
