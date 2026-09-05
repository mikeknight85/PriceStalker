# PriceStalker: User Notifications Guide

PriceStalker supports a wide range of notification channels and customizable alerts to keep you updated on price movements.

---

## 1. Notification Channels Setup
You can configure and test your notification channels under **User Settings → Notifications**:

### Telegram
1. Create a bot via [@BotFather](https://t.me/botfather) on Telegram.
2. Get your Chat ID from [@userinfobot](https://t.me/userinfobot).
3. Enter both Bot Token and Chat ID in Settings → Notifications.

### Discord
1. Go to Server Settings → Integrations → Webhooks → New Webhook.
2. Copy the Webhook URL, and paste it into Settings → Notifications.

### Pushover
1. Create an account at [pushover.net](https://pushover.net).
2. Note your User Key, and create an application at [pushover.net/apps](https://pushover.net/apps/build) to get an API Token.
3. Enter both in Settings → Notifications.

### ntfy.sh
1. Pick a unique topic name (e.g. `pricestalker-yourname-abc123`).
2. Subscribe on your phone via the [ntfy app](https://ntfy.sh/app) or by navigating to `https://ntfy.sh/your-topic-name`.
3. Enter the topic in Settings → Notifications. 
* *Note: Self-hosted ntfy is also supported—simply enter your server URL and optional username/password credentials.*

### Gotify (Self-hosted)
1. Deploy [Gotify](https://gotify.net/docs/install).
2. Create an application in Gotify to retrieve an App Token.
3. Enter your Gotify server URL and the App Token in Settings → Notifications; click **Test Connection** to verify before saving.

### Email (SMTP)
1. In **Settings → Notifications**, enable **Email Notifications**.
2. Enter your **SMTP Server Host** (e.g. `smtp.example.com`), **Port** (e.g. `587` or `465`), and SMTP username/password if authentication is required.
3. Set your **From Address** and recipient **To Address**.
4. Optionally customize the Subject and Body message templates, or leave them blank to use the built-in event-aware email layout.
5. Click **Test Email** to verify delivery.

### Custom Webhook
For integrations with Home Assistant, Apprise, n8n, Zapier, or custom APIs, select **Custom Webhook** in Settings → Notifications:
* **URL**: The endpoint of the receiver.
* **Headers**: Optional JSON object of header key-value pairs (e.g. `{"Authorization": "Bearer ..."}`). `Content-Type: application/json` is sent by default.
* **Body Template**: Optional. Leave blank to send PriceStalker's default JSON payload, below. If you supply one, variables in **double** braces are substituted — `{{product_name}}`, not `{product_name}`. Single braces are left untouched.

The request is always a `POST`. (v1 had a configurable method; v2 does not.)

**Default payload**, sent when no body template is set:

```json
{
  "event": "price_drop",
  "product": "Sony WH-1000XM5",
  "productId": 409,
  "url": "https://shop.example/p/1",
  "price": 249.99,
  "oldPrice": 299.00,
  "targetPrice": 250.00,
  "currency": "CHF",
  "oldStockStatus": "out_of_stock",
  "newStockStatus": "in_stock",
  "reason": null,
  "paused": null,
  "timestamp": "2026-09-05T09:20:00.000Z"
}
```

`event` is one of `price_drop`, `target_price`, `back_in_stock`, `price_announced`, `not_available`, `product_restored`. Any field that does not apply to an event is `null` — including `currency`, which is `null` rather than a guessed `USD` when the scrape could not resolve one.

* *Tip: Hit **Send Test** to send a test payload. Webhook.site is an excellent tool for testing webhook payloads.*

---

## 2. Customizable Message Templates
Under your notification channel configurations, you can customize the message formats across channels. The full set of variables, resolved for every channel and every event:

| Variable | Meaning |
|---|---|
| `{{product_name}}` | Product name |
| `{{product_url}}` | Product URL (**not** `{{url}}`) |
| `{{product_id}}` | Numeric id, or `N/A` |
| `{{price}}` | Current price with its currency attached, e.g. `CHF 49.90`, or `unavailable` |
| `{{current_price}}` | Current price as a bare number, e.g. `49.90`, or `unavailable` |
| `{{old_price}}` | Previous price as a bare number, or `unavailable` |
| `{{currency}}` | ISO code, or empty when the scrape could not resolve one |
| `{{currency_symbol}}` | Symbol where one is recognised, otherwise empty |
| `{{type}}` | Event, de-underscored, e.g. `back in stock` |
| `{{old_stock_status}}` / `{{new_stock_status}}` | Stock either side of the change, e.g. `Out of stock` |
| `{{reason}}` | Why a product could not be read, on unavailable alerts |

One template covers **every** event, so wording it around a price drop reads
oddly on a back-in-stock or unavailable alert. Use `{{type}}` and
`{{new_stock_status}}` to describe what happened, or leave the field empty to
get wording chosen per event.

---

## 3. Alert Event Types
PriceStalker tracks and announces six distinct lifecycle event types across all channels:

* **Price Drop (`price_drop`)**: Triggers when the price drops below your configured threshold or below the previous price.
* **Target Price (`target_price`)**: Triggers when a product hits or goes below your specified target price.
* **Back in Stock (`back_in_stock`)**: Triggers when an item transitions from out-of-stock / member-only to available.
* **Price Announced (`price_announced`)**: Triggers when a price is first detected or announced on a previously unpriced listing.
* **Unavailable (`unavailable`)**: Triggers when a product page cannot be reached after repeated attempts, including the specific reason (e.g. HTTP 404, connection timeout, bot wall).
* **Resumed (`resumed`)**: Triggers when an unavailable product becomes reachable again and monitoring is automatically resumed.
* **Any-Change Alerts**: When enabled on a product, fires on every recorded price movement (up or down).
