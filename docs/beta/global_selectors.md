# PriceStalker Fallback Universal Selectors: Reference Defaults

This document serves as a general scratch pad reference for default fallback universal selectors. These settings map generic CSS, XPath, and pattern attributes to guide extraction when no retailer-specific selectors are defined.

---

## 1. Fallback Selector Configs

### `generic_price_selectors`
```json
[
  "meta[itemprop=\"lowPrice\"]::attr(content)",
  "[itemprop=\"lowPrice\"]",
  "[itemprop=\"price\"]",
  "meta[property=\"product:price:amount\"]::attr(content)",
  "meta[property=\"og:price:amount\"]::attr(content)",
  "[data-price-type=\"finalPrice\"] .price",
  "[data-price-amount]",
  "[data-product-price]",
  "[data-test=\"price\"]",
  "[data-test=\"product-price\"]",
  "[data-test=\"current-price\"]",
  "[data-automation-test-id*=\"price\" i]",
  "[data-testid*=\"price\" i]",
  "[data-test-id*=\"price\" i]",
  ".price-item--sale",
  ".price-item--regular",
  ".woocommerce-Price-amount.amount",
  ".summary .price .amount",
  "[data-price]",
  "[data-price-amount]",
  ".price-box .price",
  ".special-price .price",
  ".price",
  ".product-price",
  ".current-price",
  ".sale-price",
  ".final-price",
  ".offer-price",
  "#price",
  "[class*=\"price\" i]"
]
```

### `generic_deal_price_selectors`
```json
[
  ".price-item--sale",
  ".special-price .price",
  ".sale-price",
  ".deal-price"
]
```

### `generic_member_price_selectors`
```json
[
  ".member-price",
  ".perks-price",
  ".club-price"
]
```

### `generic_pre_order_price_selectors`
```json
[
  "[class*=\"preorder-price\" i]",
  "[class*=\"pre-order-price\" i]",
  "[data-testid*=\"preorder-price\" i]",
  "[data-testid*=\"pre-order-price\" i]",
  "[id*=\"preorder-price\" i]"
]
```

### `generic_original_price_selectors`
```json
[
  ".rrp",
  ".was-price",
  ".price-item--regular",
  ".old-price",
  "[class*=\"original\" i]",
  "[class*=\"rrp\" i]",
  "[class*=\"was-price\" i]",
  "[data-testid*=\"strikethrough-price\"]"
]
```

### `generic_name_selectors`
```json
[
  "meta[property=\"og:title\"]::attr(content)",
  "meta[name=\"twitter:title\"]::attr(content)",
  "[itemprop=\"name\"]",
  "[data-automation-test-id*=\"title\" i]",
  "[data-automation-test-id*=\"name\" i]",
  "[data-testid*=\"title\" i]",
  "[data-testid*=\"name\" i]",
  "h1[class*=\"product\"]",
  "h1[class*=\"title\"]",
  ".product-title",
  "h1"
]
```

### `generic_image_selectors`
```json
[
  "[itemprop=\"image\"]",
  "[property=\"og:image\"]",
  "link[rel=\"preload\"][as=\"image\"]",
  "[data-automation-test-id*=\"image\" i]",
  "[data-testid*=\"image\" i]",
  ".product-image img",
  ".main-image img",
  "[data-zoom-image]",
  "img[class*=\"product\"]",
  ".productthumbnail::attr(src)"
]
```

### `generic_stock_selectors`
```json
[
  "[itemprop=\"availability\"]",
  ".stock-status",
  ".availability",
  "[data-automation-test-id*=\"stock\" i]",
  "[data-automation-test-id*=\"availability\" i]",
  "[data-automation-test-id*=\"buy-box\" i]",
  "[data-testid*=\"stock\" i]",
  "[data-testid*=\"availability\" i]",
  "[data-test-id*=\"stock\" i]",
  "[data-test-id*=\"availability\" i]",
  "[class*=\"stock-status\" i]",
  "[class*=\"availability\" i]"
]
```

### `generic_retailer_name_selectors`
```json
[
  "meta[property=\"og:site_name\"]::attr(content)",
  "meta[name=\"application-name\"]::attr(content)",
  "[itemprop=\"brand\"] [itemprop=\"name\"]",
  "[itemprop=\"brand\"]::attr(content)",
  "a[class*=\"logo\" i]::attr(aria-label)",
  "a[id*=\"logo\" i]::attr(aria-label)"
]
```

### `generic_exclusion_selectors`
```json
[
  ".site-wide-ad"
]
```

---

## 2. Universal AI Fallbacks

### `generic_ai_price_selectors`
```json
[
  "[class*=\"price\" i]",
  "[class*=\"Price\" i]",
  "[data-testid*=\"price\" i]",
  "[data-automation*=\"price\" i]",
  "[data-automation*=\"Price\" i]",
  "[itemprop=\"price\"]",
  "[data-price]",
  "[data-price-amount]",
  "[data-product-price]"
]
```

### `generic_ai_image_selectors`
```json
[
  "link[rel=\"preload\"][as=\"image\"]",
  "img#landingImage",
  "img#main-image",
  "img.main-image",
  "img.hero-image",
  "img[class*=\"product-image\" i]",
  "img[class*=\"product__image\" i]",
  "img[class*=\"gallery\" i]",
  "img[data-testid*=\"image\" i]"
]
```
