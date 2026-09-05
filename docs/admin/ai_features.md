# PriceStalker Admin: AI Features & Provider Setup

PriceStalker includes a modular, multi-provider AI engine designed to automate scraper maintenance and ensure extraction accuracy. AI handles three core tasks:

1. **Retailer Auto-Mapping**: Automatically generates CSS selectors for new or unmapped stores.
2. **Price Cross-Verification**: Audits newly scraped prices against the page layout to catch discounts, multi-pack traps, and hidden fees before updating history.
3. **Fallback Extraction**: Parses prices directly from the HTML when existing CSS selectors break due to site redesigns.

---

## 1. Global AI Settings

Configure global AI behavior under **Admin → AI Engine**:

* **Enable AI Fallback**: When enabled, PriceStalker invokes the configured AI provider to extract the current price if standard CSS/XPath selectors fail to return a value.
* **AI Verification**: When enabled, PriceStalker runs an AI sanity check on scraped values against the pruned page layout. If the AI detects a discrepancy (e.g. sale vs regular price), the price is flagged as `needsReview` and routed to the user voting queue.
* **Auto-Mapping**: When enabled, PriceStalker uses AI to analyze new stores and automatically create working CSS rules, eliminating manual configuration.
* **Request Timeout (ms)**: Maximum time allowed for an AI inference request before aborting (default: `60000` ms / 60 seconds).
* **Max Retries**: Number of retry attempts if an AI provider returns a transient error or rate-limit response (default: `2`).

> [!NOTE]
> All AI configuration settings are instance-wide. Secrets and API keys are masked (`sk-...xxxx`) in the Admin UI.

---

## 2. AI Provider Setup Guides

Select your preferred AI provider in **Admin → AI Engine** from the **Primary AI Provider** dropdown.

---

### Google Gemini (Google AI Studio)

Recommended for most users due to generous free tier quotas and fast inference speeds.

* **Console & API Key**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
* **Configuration Fields**:
  * **Google Gemini API Key**: Paste the key generated from Google AI Studio.
  * **Primary Model**: Click **↻ Sync** to retrieve live available models directly from Google's API, then select a model.
* **Recommended Models**:
  * `gemini-2.5-flash-lite` (Fastest, very low latency, free tier available)
  * `gemini-1.5-flash` / `gemini-2.5-flash` (High accuracy on complex page structures)
* **Verification**: Click **Verify** to test connection and permissions before saving.

---

### OpenAI (GPT)

Industry standard with high reliability and structured output support.

* **Console & API Key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
* **Configuration Fields**:
  * **OpenAI API Key**: Secret key starting with `sk-...`
  * **OpenAI Model**: Model identifier (e.g. `gpt-4.1-nano`, `gpt-4o-mini`, `gpt-4o`)
* **Recommended Models**:
  * `gpt-4.1-nano` or `gpt-4o-mini` (Extremely cost-effective, ~$0.001 per check)
* **Cost Note**: Pay-as-you-go billing with prepaid credits.

---

### Anthropic (Claude)

Excels at complex HTML reasoning and edge cases.

* **Console & API Key**: [console.anthropic.com](https://console.anthropic.com)
* **Configuration Fields**:
  * **Anthropic API Key**: Secret key starting with `sk-ant-...`
  * **Anthropic Model**: Model identifier (e.g. `claude-3-5-haiku-latest`, `claude-3-5-sonnet-latest`)
* **Recommended Models**:
  * `claude-3-5-haiku-latest` / `claude-haiku-4.5` (Fast, low cost)
* **Cost Note**: Usage-based billing.

---

### Google Cloud Vertex AI (REST)

Designed for enterprise GCP deployments or existing Google Cloud projects.

* **Console**: [console.cloud.google.com](https://console.cloud.google.com)
* **Setup Requirements**:
  1. Enable the **Vertex AI API** in your GCP Project.
  2. Create a Service Account or API key with Vertex AI User permissions.
* **Configuration Fields**:
  * **Vertex API Key**: Your GCP API Key or authentication token.
  * **GCP Project ID**: The project ID string (e.g. `my-tracking-project-123`).
  * **Location**: GCP region (e.g. `us-central1`, `europe-west1`).
  * **Model**: Model ID (e.g. `gemini-1.5-flash-002`, `gemini-1.5-pro-002`).
* **Cost Note**: Billed directly through Google Cloud invoices.

---

### Groq

Ultra-low latency inference engine running open-source models on LPU hardware.

* **Console & API Key**: [console.groq.com/keys](https://console.groq.com/keys)
* **Configuration Fields**:
  * **Groq API Key**: Key starting with `gsk_...`
  * **Groq Model**: Model identifier (e.g. `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`)
* **Recommended Models**:
  * `llama-3.3-70b-versatile` (High extraction capability)
* **Cost Note**: Generous free tier quotas available.

---

### DeepSeek

Cost-effective intelligence with strong reasoning capabilities.

* **Console & API Key**: [platform.deepseek.com](https://platform.deepseek.com)
* **Configuration Fields**:
  * **DeepSeek API Key**: Key starting with `sk-...`
  * **DeepSeek Model**: `deepseek-chat`
* **Cost Note**: Pay-as-you-go with very low token costs.

---

### Mistral AI

High performance European open-weight and API models.

* **Console & API Key**: [console.mistral.ai](https://console.mistral.ai)
* **Configuration Fields**:
  * **Mistral API Key**: Generated from the Mistral developer console.
  * **Mistral Model**: `mistral-small-latest` or `mistral-large-latest`
* **Cost Note**: Usage-based pricing.

---

### OpenRouter

Unified gateway accessing hundreds of models across multiple AI vendors with a single key.

* **Console & API Key**: [openrouter.ai/keys](https://openrouter.ai/keys)
* **Configuration Fields**:
  * **OpenRouter API Key**: Key starting with `sk-or-...`
  * **OpenRouter Model**: Full model slug, for example:
    * `google/gemini-2.5-flash-lite`
    * `meta-llama/llama-3.3-70b-instruct`
    * `anthropic/claude-3.5-haiku`
* **Cost Note**: Unified pay-as-you-go balance.

---

### Local Ollama (Self-Hosted)

Run 100% private, local models on your own server hardware without sending data to external APIs.

* **Software Download**: [ollama.ai](https://ollama.ai)
* **Setup**:
  1. Pull your chosen model on your host machine:
     ```bash
     ollama run qwen3
     # or
     ollama run llama3.2
     ```
  2. Set the **Ollama Base URL** in PriceStalker.
     * **Docker tip**: If PriceStalker is running inside a Docker container, `localhost:11434` refers to the container itself. Use `http://host.docker.internal:11434` (macOS/Windows or Linux with `extra_hosts`) or your host's local LAN IP (e.g. `http://192.168.1.100:11434`).
     * Ensure Ollama listens on all interfaces by setting `OLLAMA_HOST=0.0.0.0` on the host machine.
  3. Enter the **Ollama Model** name (e.g. `qwen3`, `llama3.2`).
* **Cost**: Free (local compute and GPU/CPU power).

---

### OpenAI-Compatible Custom Endpoints

Connect to self-hosted inference servers (LocalAI, vLLM, LM Studio, LiteLLM, text-generation-webui).

* **Configuration Fields**:
  * **Endpoint Base URL**: The chat completions root (e.g. `http://host.docker.internal:1234/v1` or `http://10.0.0.5:8000/v1`).
  * **API Key (optional)**: Leave empty if connecting to unauthenticated local servers.
  * **Model**: Target model name (e.g. `Qwen/Qwen2.5-7B-Instruct`).

---

## 3. Recommended Best Practices

1. **Start with Fast & Lightweight Models**:
   Price extraction and selector generation work best with fast, cost-effective models (`gemini-2.5-flash-lite`, `gpt-4.1-nano`, `claude-3-5-haiku-latest`). Heavy reasoning models (like `o1` or `claude-3-7-sonnet`) introduce unnecessary latency and higher costs without extraction improvements.

2. **Always Use AI Verification**:
   AI verification runs after standard CSS selectors extract a price to ensure that discounted, bundled, or out-of-stock items are not erroneously parsed. It prevents price chart corruption.

3. **Auto-Mapping Saves Long-Term Costs**:
   When Auto-Mapping is enabled, AI is used **only once** to generate CSS selectors for a new retailer. Those rules are cached in the `retailer_configs` database table, allowing subsequent scrapes to execute instantly via standard scrapers with zero AI token consumption.
