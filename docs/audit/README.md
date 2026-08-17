# PriceStalker Audit & Investigation Material

This directory contains investigations, historical audits, proposed fixes, and
reference material. These documents are not all authoritative descriptions of
the current implementation.

## How to use these documents

- Verify findings against the current source before opening an issue or making a
  change.
- Treat documents describing a proposed fix as design notes, not as evidence
  that the fix has been implemented.
- Treat upstream audit references as historical context unless the current code
  confirms the finding still applies.
- Prefer the main documentation under `docs/` for current user, admin, and
  developer guidance.

## Contents

| Document | Purpose | Status |
|---|---|---|
| [Upstream scraping and consensus audit](upstream_scraping_consensus_audit.md) | Consolidated upstream findings and issue register | Historical reference; verify against source |
| [Master refix plan](refix_plan.md) | Proposed remediation plan for audit findings | Planning material |
| [Logging audit](LOGGING.md) | Logging coverage and identified gaps | Audit material |
| [Debug interface audit](upstream_debug_interface_audit.md) | Review of the debug interface | Historical reference; verify against source |
| [Amazon block investigation](amazon_block_issue.md) | Retailer-specific acquisition investigation | Issue investigation |
| [Reference architectures](reference_architectures.md) | Scraping and configuration design references | Reference material |

The large [SCRAPER_AUDIT.md](../SCRAPER_AUDIT.md) file is the broad backend
audit register. It is intentionally kept separate from the concise lifecycle
and user documentation.
