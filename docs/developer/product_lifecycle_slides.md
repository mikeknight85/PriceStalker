# PriceStalker Scraper Lifecycle — Detailed Views

The overview diagram shows the complete relationship between the scrape engine and product monitoring. These detailed views are split by responsibility so each flow remains readable. For the written reference, see [SCRAPER_LIFECYCLE.md](SCRAPER_LIFECYCLE.md).

![PriceStalker Product Lifecycle](../assets/product_lifecycle.svg)

## Overview

* [High-Resolution PNG Image](../assets/product_lifecycle.png)
* [Graphviz DOT Source](../assets/product_lifecycle.dot)

## Detailed views

````carousel
![Part 1: Session Initialisation and HTML Acquisition](../assets/lifecycle/lifecycle_part1_init_acquisition.png)
<!-- slide -->
![Part 2: DOM Denoising and Candidate Extraction](../assets/lifecycle/lifecycle_part2_extraction.png)
<!-- slide -->
![Part 3: Challenge Validation and AI Auto-Mapping](../assets/lifecycle/lifecycle_part3_validation_automapping.png)
<!-- slide -->
![Part 4: Consensus, Arbitration and Price Guardrails](../assets/lifecycle/lifecycle_part4_consensus.png)
<!-- slide -->
![Part 5: AI Verification and Human Review](../assets/lifecycle/lifecycle_part5_verification_review.png)
<!-- slide -->
![Part 6: Persistence and Selector Learning](../assets/lifecycle/lifecycle_part6_persistence_learning.png)
<!-- slide -->
![Part 7: Product Onboarding and Monitoring State](../assets/lifecycle/lifecycle_part7_onboarding_monitoring.png)
<!-- slide -->
![Part 8: Monitoring Events and Notifications](../assets/lifecycle/lifecycle_part8_notifications.png)
````

Each detailed view also has a linked SVG and DOT source in [assets/lifecycle](../assets/lifecycle/).

| View | SVG | DOT source |
|---|---|---|
| Part 1 — Initialisation and acquisition | [SVG](../assets/lifecycle/lifecycle_part1_init_acquisition.svg) | [DOT](../assets/lifecycle/lifecycle_part1_init_acquisition.dot) |
| Part 2 — Extraction | [SVG](../assets/lifecycle/lifecycle_part2_extraction.svg) | [DOT](../assets/lifecycle/lifecycle_part2_extraction.dot) |
| Part 3 — Validation and auto-mapping | [SVG](../assets/lifecycle/lifecycle_part3_validation_automapping.svg) | [DOT](../assets/lifecycle/lifecycle_part3_validation_automapping.dot) |
| Part 4 — Consensus | [SVG](../assets/lifecycle/lifecycle_part4_consensus.svg) | [DOT](../assets/lifecycle/lifecycle_part4_consensus.dot) |
| Part 5 — Verification and review | [SVG](../assets/lifecycle/lifecycle_part5_verification_review.svg) | [DOT](../assets/lifecycle/lifecycle_part5_verification_review.dot) |
| Part 6 — Persistence and learning | [SVG](../assets/lifecycle/lifecycle_part6_persistence_learning.svg) | [DOT](../assets/lifecycle/lifecycle_part6_persistence_learning.dot) |
| Part 7 — Onboarding and monitoring | [SVG](../assets/lifecycle/lifecycle_part7_onboarding_monitoring.svg) | [DOT](../assets/lifecycle/lifecycle_part7_onboarding_monitoring.dot) |
| Part 8 — Events and notifications | [SVG](../assets/lifecycle/lifecycle_part8_notifications.svg) | [DOT](../assets/lifecycle/lifecycle_part8_notifications.dot) |
