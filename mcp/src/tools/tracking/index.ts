import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PriceStalkerApiClient } from '../../client/api.js';

export function registerTrackingTools(server: McpServer, client: PriceStalkerApiClient) {
  // 1. track_product
  server.tool(
    'track_product',
    'Track a new product URL in PriceStalker and configure alert thresholds',
    {
      url: z.string().url().describe('Product URL to track'),
      name: z.string().optional().describe('Custom name override for the product'),
      target_price: z.number().optional().describe('Target price alert threshold'),
      price_drop_threshold: z.number().optional().describe('Percentage price drop threshold (e.g. 10 for 10%)'),
      notify_back_in_stock: z.boolean().optional().describe('Whether to notify when product comes back in stock')
    },
    async ({ url, name, target_price, price_drop_threshold, notify_back_in_stock }) => {
      try {
        const result = await client.addProduct(url, {
          name,
          target_price,
          price_drop_threshold,
          notify_back_in_stock
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: result.needsReview ? 'Product added but requires selector review' : 'Product successfully tracked',
              result
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to track product: ${error.message}` }]
        };
      }
    }
  );

  // 2. meta_extract_url
  server.tool(
    'meta_extract_url',
    'Extract product title, price, currency, image, and stock from a URL without saving it to the database',
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
              extracted_title: result.name,
              extracted_price: result.price,
              currency: result.currency,
              image_url: result.imageUrl,
              stock_status: result.stockStatus,
              price_candidates: result.priceCandidates,
              success: result.success
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to extract URL meta: ${error.message}` }]
        };
      }
    }
  );

  // 3. update_item_alerts
  server.tool(
    'update_item_alerts',
    'Update alert settings (target price, drop threshold, back in stock notification) for an item',
    {
      product_id: z.number().describe('Product listing ID'),
      target_price: z.number().nullable().optional().describe('New target price (set null to clear)'),
      price_drop_threshold: z.number().nullable().optional().describe('New drop percentage threshold'),
      notify_back_in_stock: z.boolean().optional().describe('Enable/disable back in stock notification')
    },
    async ({ product_id, target_price, price_drop_threshold, notify_back_in_stock }) => {
      try {
        const updateData: any = {};
        if (target_price !== undefined) updateData.target_price = target_price;
        if (price_drop_threshold !== undefined) updateData.price_drop_threshold = price_drop_threshold;
        if (notify_back_in_stock !== undefined) updateData.notify_back_in_stock = notify_back_in_stock;

        const updated = await client.updateProduct(product_id, updateData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ message: 'Item alert settings updated successfully', updated }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to update item alerts: ${error.message}` }]
        };
      }
    }
  );

  // 4. delete_item
  server.tool(
    'delete_item',
    'Delete a product listing from PriceStalker and stop tracking it',
    {
      product_id: z.number().describe('Product listing ID to delete')
    },
    async ({ product_id }) => {
      try {
        const result = await client.deleteProduct(product_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to delete product ${product_id}: ${error.message}` }]
        };
      }
    }
  );

  // 5. bulk_toggle_tracking
  server.tool(
    'bulk_toggle_tracking',
    'Bulk pause or resume price tracking across multiple product IDs',
    {
      product_ids: z.array(z.number()).describe('Array of product IDs'),
      paused: z.boolean().describe('True to pause scheduled scraping, false to resume')
    },
    async ({ product_ids, paused }) => {
      try {
        const result = await client.bulkPause(product_ids, paused);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to bulk update tracking status: ${error.message}` }]
        };
      }
    }
  );

  // 6. rescan_product
  server.tool(
    'rescan_product',
    'Trigger a full DOM re-scan of an existing product listing to discover new candidate prices and selectors',
    {
      product_id: z.number().describe('Product ID to re-scan')
    },
    async ({ product_id }) => {
      try {
        const result = await client.scanProduct(product_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to rescan product ${product_id}: ${error.message}` }]
        };
      }
    }
  );

  // 7. confirm_product_selection
  server.tool(
    'confirm_product_selection',
    'Confirm a selected price candidate or selector rule for a previously rescanned product',
    {
      product_id: z.number().describe('Product ID'),
      selection: z.record(z.any()).describe('Selection payload containing chosen price, name, or selector override')
    },
    async ({ product_id, selection }) => {
      try {
        const result = await client.confirmProductSelection(product_id, selection);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to confirm product selection: ${error.message}` }]
        };
      }
    }
  );

  // 8. refresh_product_price
  server.tool(
    'refresh_product_price',
    'Force an immediate live re-scrape and price update for a product listing',
    {
      product_id: z.number().describe('Product ID to refresh')
    },
    async ({ product_id }) => {
      try {
        const result = await client.refreshProductPrice(product_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to refresh product price: ${error.message}` }]
        };
      }
    }
  );
}
