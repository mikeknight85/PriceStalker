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
* **HTTP Method**: Choose `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`.
* **Headers**: Optional JSON object of header key-value pairs (e.g. `{"Authorization": "Bearer ..."}`). The `Content-Type` header defaults to `application/json` for non-GET requests if omitted.
* **Body Template**: Optional. Leave blank to send PriceStalker's default JSON payload structure. If defined, variables enclosed in `{}` will be substituted:

| Token | Meaning |
|-------|---------|
| `{title}` / `{product_name}` | Product name |
| `{type}` | Alert event type (e.g. `price_drop`, `target_price`, `back_in_stock`, `unavailable`, `resumed`) |
| `{url}` | Product URL |
| `{currency}` | ISO currency code |
| `{price}` | Current price formatted with currency |
| `{new_price}` / `{current_price}` | Raw numeric current price |
| `{old_price}` | Previous price (when applicable) |
| `{threshold}` | Configured price drop threshold |
| `{target_price}` | Configured target price |
| `{reason}` | Detailed explanation (e.g. for unavailable alerts or stock transitions) |
| `{timestamp}` | ISO-8601 message timestamp |

* *Tip: Hit **Send Test** to send a test payload. Webhook.site is an excellent tool for testing webhook payloads.*

---

## 2. Customizable Message Templates
Under your notification channel configurations, you can customize the message formats across channels. Shared template variables (`{{product_name}}`, `{{price}}`, `{{current_price}}`, `{{old_price}}`, `{{url}}`, `{{reason}}`) are resolved dynamically for each event.

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
