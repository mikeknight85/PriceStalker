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

### Custom Webhook
For integrations with Home Assistant, Apprise, n8n, Zapier, or custom APIs, select **Custom Webhook** in Settings → Notifications:
* **URL**: The endpoint of the receiver.
* **HTTP Method**: Choose `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`.
* **Headers**: Optional JSON object of header key-value pairs (e.g. `{"Authorization": "Bearer ..."}`). The `Content-Type` header defaults to `application/json` for non-GET requests if omitted.
* **Body Template**: Optional. Leave blank to send PriceStalker's default JSON payload structure. If defined, variables enclosed in `{}` will be substituted:

| Token | Meaning |
|-------|---------|
| `{title}` | Product name |
| `{type}` | Alert type trigger: `price_drop` · `price_change` · `target_price` · `back_in_stock` |
| `{url}` | Product URL |
| `{currency}` | ISO currency code |
| `{price}` / `{new_price}` | Current extracted price |
| `{old_price}` | Previous price (when applicable) |
| `{threshold}` | Configured price drop threshold |
| `{target_price}` | Configured target price |
| `{timestamp}` | ISO-8601 message timestamp |

* *Tip: Hit **Send Test** to send a test payload. Webhook.site is an excellent tool for testing webhook payloads.*

---

## 2. Customizable Message Templates
Under your notification channel configurations, you can customize the message formats. You can define distinct templates for different providers.

---

## 3. Alert Types
When adding or editing a tracked product, you can toggle the following alert criteria:

* **Price Drop Alerts**: Triggers when the price drops below your target or drops by a specific amount/percentage.
* **Target Price Alerts**: Triggers when a product hits or goes below your specified target price.
* **Any-Change Alerts**: Sends an alert on every price movement (either up or down), useful for keeping a complete change history log.
* **Back-in-Stock Alerts**: Triggers when an item transitions from out-of-stock to available.
