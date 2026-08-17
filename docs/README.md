# PriceStalker docs

Reference documentation for PriceStalker users, administrators, and developers.

## Choose a guide

| I want to... | Read |
|---|---|
| Install and use PriceStalker | [User Guide](user/README.md) |
| Configure retailers, selectors, AI, or notifications | [Admin Guide](admin/README.md) |
| Develop or debug the application | [Developer Guide](developer/DEVELOPER_GUIDE.md) |
| Understand the scraper pipeline | [Scraper Lifecycle](developer/SCRAPER_LIFECYCLE.md) |
| Work with the database and deployment | [Database Guide](developer/DATABASE.md) |
| Investigate known issues and audits | [Audit material](audit/) |

## User & Administration Guides

| Doc | Covers |
|---|---|
| [user/README.md](user/README.md) | **User Guide**: High-level overview of product tracking, price selection, stock monitoring, and notifications. |
| [admin/README.md](admin/README.md) | **Admin Guide**: Guides for managing retailers, custom selectors, AI settings, API security tokens, and proxies. |
| [developer/ENVIRONMENT_VARIABLES.md](developer/ENVIRONMENT_VARIABLES.md) | **Environment Configuration**: Reference guide for all optional and required `.env` file variables. |
| [developer/LOGGING.md](developer/LOGGING.md) | **Logging System**: Detailed guide on logging configurations, targets (console/files/database), and data scrubbing. |
| [developer/DEVELOPER_GUIDE.md](developer/DEVELOPER_GUIDE.md) | **Developer Guide**: Codebase directory structure, Vitest runner, live debugger, and backend compilation rules. |


## Engine internals (adapted from upstream)

The scraper engine is shared with the upstream fork it was transplanted from.
These describe how it works and were adapted from that fork's docs — his
infrastructure removed, brand normalised, verified against this repo where
noted. Docs drift; trust the code for specifics.

| Doc | Covers |
|---|---|
| [developer/SCRAPER_LIFECYCLE.md](developer/SCRAPER_LIFECYCLE.md) | The seven-stage product scrape pipeline and product-monitoring boundaries. |
| [developer/product_lifecycle_slides.md](developer/product_lifecycle_slides.md) | Overview and detailed visual diagrams for acquisition, extraction, review, monitoring, and notifications. |
| [developer/SELECTORS.md](developer/SELECTORS.md) | The selector DSL — CSS/XPath/Regex engines, `::attr()` and `->status` modifiers, staleness scoring and eviction. |
| [SCRAPER_AUDIT.md](SCRAPER_AUDIT.md) | Large scraper audit and issue register. Findings should be checked against the current source before acting on them. |
| [developer/DATABASE.md](developer/DATABASE.md) | Core tables, the `pg_notify` cache-invalidation triggers, backup. |
| [design/DESIGN_TOKENS.md](design/DESIGN_TOKENS.md) | Frontend CSS design tokens. Verified against `frontend/src/index.css`. |

## PriceStalker-specific

| Doc | Covers |
|---|---|
| [design/SSO_DESIGN.md](design/SSO_DESIGN.md) | OIDC/SSO design (a PriceStalker feature, ported forward). |
| [design/I18N_DESIGN.md](design/I18N_DESIGN.md) | Internationalisation design. |

## Design and audit material

| Area | Entry point |
|---|---|
| Authentication and SSO | [SSO design](design/SSO_DESIGN.md) |
| Internationalisation | [I18N design](design/I18N_DESIGN.md) |
| Frontend visual system | [Design tokens](design/DESIGN_TOKENS.md) |
| Investigations and historical audits | [Audit index](audit/README.md) |

## Audit note

The lifecycle document contains references to issue IDs from an older audit
register (`audits/claude3.md`). Those IDs are historical pointers; verify the
current source before treating them as open issues.

See [../CLAUDE.md](../CLAUDE.md) for contributor rules.
