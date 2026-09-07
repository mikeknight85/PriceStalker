import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PriceStalkerApiClient } from '../../client/api.js';

export function registerShoppingTools(server: McpServer, client: PriceStalkerApiClient) {
  // 1. search_items
  server.tool(
    'search_items',
    'Search through locally tracked items in PriceStalker with best current price and store count',
    {
      query: z.string().optional().describe('Filter items by title or name substring'),
      in_stock_only: z.boolean().optional().describe('Only return items that are currently in stock at one or more stores')
    },
    async ({ query, in_stock_only }) => {
      try {
        const items = await client.getItems();
        let filtered = items;

        if (query) {
          const q = query.toLowerCase();
          filtered = filtered.filter(item => item.name?.toLowerCase().includes(q));
        }

        if (in_stock_only) {
          filtered = filtered.filter(item =>
            item.stores?.some(s => s.stock_status === 'in_stock')
          );
        }

        const summary = filtered.map(item => ({
          id: item.id,
          name: item.name,
          best_price: item.best_price ?? null,
          currency: item.currency ?? null,
          target_price: item.target_price ?? null,
          store_count: item.stores?.length ?? 0,
          stores: item.stores?.map(s => ({
            id: s.id,
            store: s.retailer_name || s.domain,
            price: s.current_price,
            stock: s.stock_status,
            url: s.url
          }))
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify({ count: summary.length, items: summary }, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to search items: ${error.message}` }]
        };
      }
    }
  );

  // 2. search_web_for_products
  server.tool(
    'search_web_for_products',
    'Search the web for product listings across multiple retailers via SearXNG',
    {
      query: z.string().describe('Product search query (e.g. "Sony WH-1000XM5 headphones")')
    },
    async ({ query }) => {
      try {
        const results = await client.searchWeb(query);
        return {
          content: [{ type: 'text', text: JSON.stringify({ query, count: results.length, results }, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to search web for products: ${error.message}` }]
        };
      }
    }
  );

  // 3. get_item
  server.tool(
    'get_item',
    'Get full details of a tracked item and all its store listings, price history summaries, and alert settings',
    {
      item_id: z.number().describe('The ID of the item')
    },
    async ({ item_id }) => {
      try {
        const items = await client.getItems();
        const item = items.find(i => i.id === item_id);
        if (!item) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Item with ID ${item_id} not found.` }]
          };
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(item, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get item ${item_id}: ${error.message}` }]
        };
      }
    }
  );

  // 4. compare_stores
  server.tool(
    'compare_stores',
    'Compare current prices, availability, and retailer info across all tracked stores for an item',
    {
      item_id: z.number().describe('The ID of the item')
    },
    async ({ item_id }) => {
      try {
        const items = await client.getItems();
        const item = items.find(i => i.id === item_id);
        if (!item) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Item with ID ${item_id} not found.` }]
          };
        }

        const stores = item.stores || [];
        const comparison = stores.map(s => ({
          product_id: s.id,
          store: s.retailer_name || s.domain || 'Unknown Store',
          current_price: s.current_price,
          currency: s.currency,
          stock_status: s.stock_status,
          paused: s.paused,
          url: s.url,
          last_checked: s.last_checked
        })).sort((a, b) => {
          if (a.current_price === null) return 1;
          if (b.current_price === null) return -1;
          return a.current_price - b.current_price;
        });

        const bestDeal = comparison.find(c => c.current_price !== null && c.stock_status === 'in_stock') || comparison[0];

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              item_id,
              name: item.name,
              best_available_deal: bestDeal,
              stores: comparison
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to compare stores for item ${item_id}: ${error.message}` }]
        };
      }
    }
  );

  // 5. list_deals_and_drops
  server.tool(
    'list_deals_and_drops',
    'List tracked products and items that experienced price drops or are currently below target price',
    {
      min_discount_pct: z.number().optional().describe('Minimum price drop percentage (e.g. 10 for 10% drop)'),
      below_target_only: z.boolean().optional().describe('Only return items where current price is at or below the user target price')
    },
    async ({ min_discount_pct = 0, below_target_only = false }) => {
      try {
        const items = await client.getItems();
        const deals: any[] = [];

        for (const item of items) {
          const target = item.target_price;
          const stores = item.stores || [];

          for (const store of stores) {
            if (store.current_price === null) continue;

            const isBelowTarget = target !== null && target !== undefined && store.current_price <= target;
            if (below_target_only && !isBelowTarget) continue;

            deals.push({
              item_id: item.id,
              product_id: store.id,
              name: item.name,
              store: store.retailer_name || store.domain,
              current_price: store.current_price,
              currency: store.currency,
              target_price: target,
              is_below_target: isBelowTarget,
              stock_status: store.stock_status,
              url: store.url
            });
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              count: deals.length,
              deals
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list deals: ${error.message}` }]
        };
      }
    }
  );

  // 6. get_price_history
  server.tool(
    'get_price_history',
    'Get price history points and statistics (all-time low, high, average) for a product store listing',
    {
      product_id: z.number().describe('Product store listing ID'),
      days: z.number().optional().describe('Number of days of history to fetch (default: all)')
    },
    async ({ product_id, days }) => {
      try {
        const historyData = await client.getPriceHistory(product_id, days);
        return {
          content: [{ type: 'text', text: JSON.stringify(historyData, null, 2) }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to fetch price history: ${error.message}` }]
        };
      }
    }
  );

  // 7. analyze_price_trend
  server.tool(
    'analyze_price_trend',
    'Analyze historical price trajectory and provide a Buy Now vs. Wait purchase recommendation',
    {
      product_id: z.number().describe('Product listing ID to analyze')
    },
    async ({ product_id }) => {
      try {
        const historyData = await client.getPriceHistory(product_id, 180);
        const history = historyData.history || [];
        const stats = historyData.stats;

        if (history.length === 0 || !stats) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                product_id,
                recommendation: 'INSUFFICIENT_DATA',
                reason: 'Not enough price history data points to formulate a trend recommendation.'
              }, null, 2)
            }]
          };
        }

        const current = stats.currentPrice ?? (history[history.length - 1]?.price ?? null);
        const lowest = stats.lowestPrice;
        const average = stats.averagePrice;

        let recommendation = 'BUY_NOW';
        let reason = 'Price is at all-time low.';

        if (current !== null && lowest !== null && average !== null) {
          const discountFromAvg = ((average - current) / average) * 100;
          const diffFromLowest = ((current - lowest) / lowest) * 100;

          if (current <= lowest * 1.02) {
            recommendation = 'STRONG_BUY';
            reason = `Current price (${current}) is at or within 2% of the all-time low (${lowest}).`;
          } else if (current < average) {
            recommendation = 'BUY_FAIR';
            reason = `Current price (${current}) is ${discountFromAvg.toFixed(1)}% below the historical average (${average.toFixed(2)}).`;
          } else {
            recommendation = 'WAIT';
            reason = `Current price (${current}) is above historical average (${average.toFixed(2)}) and ${diffFromLowest.toFixed(1)}% higher than the all-time low (${lowest}).`;
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              product_id,
              recommendation,
              reason,
              current_price: current,
              all_time_low: lowest,
              historical_average: average,
              total_datapoints: history.length
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to analyze price trend: ${error.message}` }]
        };
      }
    }
  );

  // 8. optimize_shopping_basket
  server.tool(
    'optimize_shopping_basket',
    'Calculate the cheapest single store vs. optimal split order across multiple stores for a list of items',
    {
      item_ids: z.array(z.number()).describe('Array of Item IDs to include in the shopping basket')
    },
    async ({ item_ids }) => {
      try {
        const allItems = await client.getItems();
        const selectedItems = allItems.filter(i => item_ids.includes(i.id));

        if (selectedItems.length === 0) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'No matching items found for the provided IDs.' }]
          };
        }

        // Map stores and available prices
        const storeMap: Record<string, { total: number; itemsFound: number; missingItems: string[] }> = {};
        const splitOrder: Array<{ item: string; store: string; price: number; url: string }> = [];
        let splitTotal = 0;

        for (const item of selectedItems) {
          const stores = (item.stores || []).filter(s => s.current_price !== null && s.stock_status === 'in_stock');
          if (stores.length === 0) continue;

          // Find best individual store for this item
          stores.sort((a, b) => (a.current_price ?? 0) - (b.current_price ?? 0));
          const best = stores[0];
          splitOrder.push({
            item: item.name,
            store: best.retailer_name || best.domain || 'Store',
            price: best.current_price!,
            url: best.url
          });
          splitTotal += best.current_price!;

          // Accumulate for each store
          for (const s of stores) {
            const storeName = s.retailer_name || s.domain || 'Unknown';
            if (!storeMap[storeName]) {
              storeMap[storeName] = { total: 0, itemsFound: 0, missingItems: [] };
            }
            storeMap[storeName].total += s.current_price!;
            storeMap[storeName].itemsFound += 1;
          }
        }

        const singleStoreOptions = Object.entries(storeMap)
          .filter(([_, data]) => data.itemsFound === selectedItems.length)
          .map(([store, data]) => ({ store, total: Number(data.total.toFixed(2)) }))
          .sort((a, b) => a.total - b.total);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              items_analyzed: selectedItems.length,
              optimal_split_order: {
                total_cost: Number(splitTotal.toFixed(2)),
                basket: splitOrder
              },
              single_store_options: singleStoreOptions.length > 0 ? singleStoreOptions : 'No single store carries all selected items in stock.'
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to optimize shopping basket: ${error.message}` }]
        };
      }
    }
  );

  // 9. batch_import_urls
  server.tool(
    'batch_import_urls',
    'Extract product URLs from unstructured text (wishlist, forum post, notes) and batch track them',
    {
      raw_text: z.string().describe('Freeform text containing product URLs'),
      target_price: z.number().optional().describe('Optional default target price for all imported URLs')
    },
    async ({ raw_text, target_price }) => {
      try {
        const urlRegex = /https?:\/\/[^\s"'<>()[\]]+/gi;
        const matchedUrls = Array.from(new Set(raw_text.match(urlRegex) || []));

        if (matchedUrls.length === 0) {
          return {
            content: [{ type: 'text', text: 'No valid URLs found in the provided text.' }]
          };
        }

        const results: any[] = [];
        for (const url of matchedUrls) {
          try {
            const res = await client.addProduct(url, { target_price });
            results.push({ url, status: 'success', data: res });
          } catch (e: any) {
            results.push({ url, status: 'failed', error: e.message });
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total_found: matchedUrls.length,
              results
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to batch import URLs: ${error.message}` }]
        };
      }
    }
  );
}
