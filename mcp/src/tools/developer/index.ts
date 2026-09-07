import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PriceStalkerApiClient } from '../../client/api.js';

export function registerDeveloperTools(server: McpServer, client: PriceStalkerApiClient) {
  // 1. inspect_url_prices
  server.tool(
    'inspect_url_prices',
    'Fetch a URL and discover ALL candidate prices across JSON-LD, meta tags, and DOM elements with source selectors',
    {
      url: z.string().url().describe('Product URL to inspect')
    },
    async ({ url }) => {
      try {
        const result = await client.testRetailerConfig(url, {});
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              url,
              extracted_name: result.name,
              extracted_price: result.price,
              currency: result.currency,
              stock_status: result.stockStatus,
              total_price_candidates: result.priceCandidates?.length || 0,
              candidates: result.priceCandidates || [],
              success: result.success
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to inspect URL prices: ${error.message}` }]
        };
      }
    }
  );

  // 2. generate_retailer_selectors
  server.tool(
    'generate_retailer_selectors',
    'Evaluate a product page and propose a full RetailerConfig object with recommended CSS/DSL selectors',
    {
      url: z.string().url().describe('Product URL to analyze for selector generation')
    },
    async ({ url }) => {
      try {
        const parsedUrl = new URL(url);
        const domain = parsedUrl.hostname.replace(/^www\./, '');

        // Dry-run extraction to get candidates
        const dryRun = await client.testRetailerConfig(url, {});
        const candidates = dryRun.priceCandidates || [];

        const priceSelectors: string[] = [];
        const dealSelectors: string[] = [];
        const originalSelectors: string[] = [];

        for (const cand of candidates) {
          if (cand.selector) {
            if (cand.type === 'deal' || cand.label?.includes('deal')) {
              dealSelectors.push(cand.selector);
            } else if (cand.type === 'original' || cand.label?.includes('was')) {
              originalSelectors.push(cand.selector);
            } else {
              priceSelectors.push(cand.selector);
            }
          }
        }

        const proposedConfig = {
          domain,
          name: domain.split('.')[0].toUpperCase(),
          price_selectors: Array.from(new Set(priceSelectors)),
          deal_price_selectors: Array.from(new Set(dealSelectors)),
          original_price_selectors: Array.from(new Set(originalSelectors)),
          name_selectors: ['h1[itemprop="name"]', 'h1.product-title', 'h1'],
          image_selectors: ['img[itemprop="image"]', 'img.product-image', 'meta[property="og:image"]@content'],
          stock_selectors: ['[itemprop="availability"]', '.stock-status', '.availability'],
          in_stock_phrases: ['in stock', 'available', 'order now'],
          out_of_stock_phrases: ['out of stock', 'sold out', 'temporarily unavailable'],
          use_browser_scraper: false,
          active: true
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              domain,
              proposed_config: proposedConfig,
              extracted_preview: {
                name: dryRun.name,
                price: dryRun.price,
                stock: dryRun.stockStatus
              }
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to generate retailer selectors: ${error.message}` }]
        };
      }
    }
  );

  // 3. test_retailer_config
  server.tool(
    'test_retailer_config',
    'Dry-run test a proposed or modified retailer configuration against a live URL without saving',
    {
      url: z.string().url().describe('Product URL to test against'),
      config: z.record(z.any()).describe('Retailer configuration object (price_selectors, name_selectors, etc.)')
    },
    async ({ url, config }) => {
      try {
        const result = await client.testRetailerConfig(url, config);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to test retailer configuration: ${error.message}` }]
        };
      }
    }
  );

  // 4. save_retailer_config
  server.tool(
    'save_retailer_config',
    'Save or update a retailer configuration in PriceStalker database and automatically invalidate caches',
    {
      config: z.record(z.any()).describe('Retailer configuration object with at least "domain" specified')
    },
    async ({ config }) => {
      try {
        if (!config.domain) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Retailer configuration must include a "domain" field.' }]
          };
        }

        const saved = await client.upsertRetailer(config);
        // Clear caches so scraper immediately uses the new rules
        await client.clearCaches();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: `Retailer config for ${config.domain} saved and caches invalidated successfully.`,
              saved
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to save retailer config: ${error.message}` }]
        };
      }
    }
  );

  // 5. remap_retailer
  server.tool(
    'remap_retailer',
    'Trigger PriceStalker internal AI consensus auto-mapping against a live URL and persist the resulting config',
    {
      url: z.string().url().describe('Product URL from the retailer to re-map')
    },
    async ({ url }) => {
      try {
        const result = await client.remapRetailer(url);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to remap retailer: ${error.message}` }]
        };
      }
    }
  );

  // 6. benchmark_retailer
  server.tool(
    'benchmark_retailer',
    'Test a retailer configuration or domain against 2-5 product URLs to verify selector consistency and prevent regressions',
    {
      domain: z.string().describe('Retailer domain to benchmark (e.g. "amazon.com")'),
      test_urls: z.array(z.string().url()).describe('List of product URLs from this retailer to test against'),
      config_override: z.record(z.any()).optional().describe('Optional candidate configuration to test instead of database config')
    },
    async ({ domain, test_urls, config_override }) => {
      try {
        const config = config_override || (await client.getRetailerByDomain(domain)) || {};
        const results: any[] = [];

        for (const url of test_urls) {
          try {
            const extract = await client.testRetailerConfig(url, config);
            results.push({
              url,
              success: extract.success,
              extracted_price: extract.price,
              extracted_name: extract.name,
              stock_status: extract.stockStatus
            });
          } catch (e: any) {
            results.push({
              url,
              success: false,
              error: e.message
            });
          }
        }

        const successCount = results.filter(r => r.success).length;
        const passRate = ((successCount / results.length) * 100).toFixed(1);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              domain,
              total_tested: results.length,
              passed: successCount,
              pass_rate: `${passRate}%`,
              results
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to benchmark retailer: ${error.message}` }]
        };
      }
    }
  );

  // 7. debug_extract
  server.tool(
    'debug_extract',
    'Deep scraper extraction testing supporting raw HTTP bypass mode and forced AI visual extraction',
    {
      url: z.string().url().describe('Product URL to debug'),
      mode: z.enum(['standard', 'bypass']).optional().describe('"standard" uses scraper pipeline; "bypass" fetches raw HTML'),
      use_ai: z.boolean().optional().describe('Enable AI extraction fallback if selector extraction fails'),
      force_ai: z.boolean().optional().describe('Force AI extraction even if selectors succeed')
    },
    async ({ url, mode = 'standard', use_ai = false, force_ai = false }) => {
      try {
        const result = await client.debugExtract({
          url,
          mode,
          use_ai,
          force_ai,
          returnHtml: false
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to run debug extraction: ${error.message}` }]
        };
      }
    }
  );
}
