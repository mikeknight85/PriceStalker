# PriceStalker docs

Reference documentation for PriceStalker users, administrators, and developers.

## Choose a guide

| I want to... | Read |
|---|---|
| Install and use PriceStalker | [User Guide](BETA.md) |
| Configure retailers, selectors, AI, or notifications | [Admin Guide](beta/README.md) |
| Develop or debug the application | [Developer Guide](DEVELOPER_GUIDE.md) |
| Understand the scraper pipeline | [Scraper Lifecycle](SCRAPER_LIFECYCLE.md) |
| Work with the database and deployment | [Database Guide](DATABASE.md) |
| Investigate known issues and audits | [Audit material](audit/) |

## User & Administration Guides

| Doc | Covers |
|---|---|
| [BETA.md](BETA.md) | **User Guide**: High-level overview of product tracking, price selection, stock monitoring, and notifications. |
| [beta/README.md](beta/README.md) | **Admin Guide**: Guides for managing retailers, custom selectors, AI settings, API security tokens, and proxies. |
| [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | **Environment Configuration**: Reference guide for all optional and required `.env` file variables. |
| [LOGGING.md](LOGGING.md) | **Logging System**: Detailed guide on logging configurations, targets (console/files/database), and data scrubbing. |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) | **Developer Guide**: Codebase directory structure, Vitest runner, live debugger, and backend compilation rules. |


## Engine internals (adapted from upstream)

The scraper engine is shared with the upstream fork it was transplanted from.
These describe how it works and were adapted from that fork's docs — his
infrastructure removed, brand normalised, verified against this repo where
noted. Docs drift; trust the code for specifics.

| Doc | Covers |
|---|---|
| [SCRAPER_LIFECYCLE.md](SCRAPER_LIFECYCLE.md) | The seven-stage product scrape pipeline: initialisation → acquisition → extraction → validation → auto-mapping → consensus → verification. Monitoring and persistence boundaries are also documented. |
| [product_lifecycle_slides.md](product_lifecycle_slides.md) | Overview and detailed visual diagrams for acquisition, extraction, review, monitoring, and notifications. |
| [SELECTORS.md](SELECTORS.md) | The selector DSL — CSS/XPath/Regex engines, `::attr()` and `->status` modifiers, staleness scoring and eviction. |
| [SCRAPER_AUDIT.md](SCRAPER_AUDIT.md) | Large scraper audit and issue register. Findings should be checked against the current source before acting on them. |
| [DATABASE.md](DATABASE.md) | Core tables, the `pg_notify` cache-invalidation triggers, backup. |
| [DESIGN_TOKENS.md](DESIGN_TOKENS.md) | Frontend CSS design tokens. Verified against `frontend/src/index.css`. |

## PriceStalker-specific

| Doc | Covers |
|---|---|
| [SSO_DESIGN.md](SSO_DESIGN.md) | OIDC/SSO design (a PriceStalker feature, ported forward). |
| [I18N_DESIGN.md](I18N_DESIGN.md) | Internationalisation design. |

## Audit note

The lifecycle document contains references to issue IDs from an older audit
register (`audits/claude3.md`). Those IDs are historical pointers; verify the
current source before treating them as open issues.

See [../CLAUDE.md](../CLAUDE.md) for contributor rules.
