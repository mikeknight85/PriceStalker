import pool from '../../../../config/database';
import { RetailerConfig } from '../../../../models/types';

// Fields whose updates are gated on presence in the payload: a field that is
// absent (undefined) keeps its stored value, while a field that is present
// updates the row even when it is empty. This is what lets an admin CLEAR a
// selector list or text field — the old empty-means-keep SQL made deletion
// impossible (issue #32). Callers that must not clobber existing data (e.g.
// AI auto-mapping) simply omit fields they have no values for.
const PRESENCE_FIELDS = [
  'name_selectors',
  'retailer_name_selectors',
  'price_selectors',
  'deal_price_selectors',
  'member_price_selectors',
  'image_selectors',
  'stock_selectors',
  'in_stock_phrases',
  'out_of_stock_phrases',
  'pre_order_phrases',
  'pre_order_price_selectors',
  'original_price_selectors',
  'exclusion_selectors',
  'custom_selectors',
  'selector_metadata',
  'ai_selectors',
  'user_agent',
  'description',
  'currency_hint',
  'jsonld_image_key',
  'jsonld_price_key',
  'jsonld_name_key',
] as const;

export const retailerMutationRepository = {
  delete: async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM retailer_configs WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  },

  upsert: async (config: Partial<RetailerConfig> & { forceNameRemoval?: boolean }, client?: any): Promise<RetailerConfig> => {
    const executor = client || pool;
    const domain = config.domain?.toLowerCase();
    // $31..$52 — presence flags for PRESENCE_FIELDS, in that order.
    // $53/$54 — prefer_jsonld_image value and its presence flag, appended so
    // adding it did not renumber everything above.
    const presence = PRESENCE_FIELDS.map(field => config[field] !== undefined);
    const result = await executor.query(
      `INSERT INTO retailer_configs (
         domain, name, status, status_history, use_proxy, use_browser_scraper, currency_hint,
         name_selectors, price_selectors, deal_price_selectors, member_price_selectors, image_selectors, stock_selectors,
         in_stock_phrases, out_of_stock_phrases, pre_order_phrases, pre_order_price_selectors, user_agent, custom_selectors, active, description,
         retailer_name_selectors, jsonld_image_key, jsonld_price_key, jsonld_name_key, original_price_selectors, ai_selectors, exclusion_selectors,
         selector_metadata, prefer_jsonld_image
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $53)
       ON CONFLICT (domain) DO UPDATE SET
         name = CASE
           WHEN $30 = true THEN EXCLUDED.name
           WHEN retailer_configs.name = INITCAP(SPLIT_PART(retailer_configs.domain, '.', 1)) THEN COALESCE(NULLIF(EXCLUDED.name, ''), retailer_configs.name)
           ELSE COALESCE(retailer_configs.name, NULLIF(EXCLUDED.name, ''))
         END,
         status_history = CASE
           WHEN EXCLUDED.status IS NOT NULL AND (retailer_configs.status IS NULL OR EXCLUDED.status != retailer_configs.status)
           THEN jsonb_path_query_array(
                  jsonb_insert(
                    COALESCE(retailer_configs.status_history, '[]'::jsonb),
                    '{0}',
                    jsonb_build_object('status', EXCLUDED.status, 'timestamp', CURRENT_TIMESTAMP)
                  ),
                  '$[0 to 9]'
                )
           ELSE retailer_configs.status_history
         END,
         status = COALESCE(EXCLUDED.status, retailer_configs.status),
         use_proxy = COALESCE(EXCLUDED.use_proxy, retailer_configs.use_proxy),
         use_browser_scraper = COALESCE(EXCLUDED.use_browser_scraper, retailer_configs.use_browser_scraper),
         name_selectors = CASE WHEN $31 = true THEN EXCLUDED.name_selectors ELSE retailer_configs.name_selectors END,
         retailer_name_selectors = CASE WHEN $32 = true THEN EXCLUDED.retailer_name_selectors ELSE retailer_configs.retailer_name_selectors END,
         price_selectors = CASE WHEN $33 = true THEN EXCLUDED.price_selectors ELSE retailer_configs.price_selectors END,
         deal_price_selectors = CASE WHEN $34 = true THEN EXCLUDED.deal_price_selectors ELSE retailer_configs.deal_price_selectors END,
         member_price_selectors = CASE WHEN $35 = true THEN EXCLUDED.member_price_selectors ELSE retailer_configs.member_price_selectors END,
         image_selectors = CASE WHEN $36 = true THEN EXCLUDED.image_selectors ELSE retailer_configs.image_selectors END,
         stock_selectors = CASE WHEN $37 = true THEN EXCLUDED.stock_selectors ELSE retailer_configs.stock_selectors END,
         in_stock_phrases = CASE WHEN $38 = true THEN EXCLUDED.in_stock_phrases ELSE retailer_configs.in_stock_phrases END,
         out_of_stock_phrases = CASE WHEN $39 = true THEN EXCLUDED.out_of_stock_phrases ELSE retailer_configs.out_of_stock_phrases END,
         pre_order_phrases = CASE WHEN $40 = true THEN EXCLUDED.pre_order_phrases ELSE retailer_configs.pre_order_phrases END,
         pre_order_price_selectors = CASE WHEN $41 = true THEN EXCLUDED.pre_order_price_selectors ELSE retailer_configs.pre_order_price_selectors END,
         original_price_selectors = CASE WHEN $42 = true THEN EXCLUDED.original_price_selectors ELSE retailer_configs.original_price_selectors END,
         exclusion_selectors = CASE WHEN $43 = true THEN EXCLUDED.exclusion_selectors ELSE retailer_configs.exclusion_selectors END,
         custom_selectors = CASE WHEN $44 = true THEN EXCLUDED.custom_selectors ELSE retailer_configs.custom_selectors END,
         selector_metadata = CASE WHEN $45 = true THEN EXCLUDED.selector_metadata ELSE retailer_configs.selector_metadata END,
         ai_selectors = CASE WHEN $46 = true THEN EXCLUDED.ai_selectors ELSE retailer_configs.ai_selectors END,
         user_agent = CASE WHEN $47 = true THEN EXCLUDED.user_agent ELSE retailer_configs.user_agent END,
         description = CASE WHEN $48 = true THEN EXCLUDED.description ELSE retailer_configs.description END,
         currency_hint = CASE WHEN $49 = true THEN EXCLUDED.currency_hint ELSE retailer_configs.currency_hint END,
         jsonld_image_key = CASE WHEN $50 = true THEN EXCLUDED.jsonld_image_key ELSE retailer_configs.jsonld_image_key END,
         jsonld_price_key = CASE WHEN $51 = true THEN EXCLUDED.jsonld_price_key ELSE retailer_configs.jsonld_price_key END,
         jsonld_name_key = CASE WHEN $52 = true THEN EXCLUDED.jsonld_name_key ELSE retailer_configs.jsonld_name_key END,
         prefer_jsonld_image = CASE WHEN $54 = true THEN EXCLUDED.prefer_jsonld_image ELSE retailer_configs.prefer_jsonld_image END,
         active = COALESCE(EXCLUDED.active, retailer_configs.active),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        domain,
        config.name || null,
        config.status || null,
        JSON.stringify(config.status_history || (config.status ? [{ status: config.status, timestamp: new Date().toISOString() }] : [])),
        config.use_proxy !== undefined ? config.use_proxy : null,
        config.use_browser_scraper !== undefined ? config.use_browser_scraper : null,
        config.currency_hint || null,
        JSON.stringify(config.name_selectors || []),
        JSON.stringify(config.price_selectors || []),
        JSON.stringify(config.deal_price_selectors || []),
        JSON.stringify(config.member_price_selectors || []),
        JSON.stringify(config.image_selectors || []),
        JSON.stringify(config.stock_selectors || []),
        JSON.stringify(config.in_stock_phrases || []),
        JSON.stringify(config.out_of_stock_phrases || []),
        JSON.stringify(config.pre_order_phrases || []),
        JSON.stringify(config.pre_order_price_selectors || []),
        config.user_agent || null,
        JSON.stringify(config.custom_selectors || {}),
        config.active !== undefined ? config.active : null,
        config.description || null,
        JSON.stringify(config.retailer_name_selectors || []),
        config.jsonld_image_key || null,
        config.jsonld_price_key || null,
        config.jsonld_name_key || null,
        JSON.stringify(config.original_price_selectors || []),
        config.ai_selectors ? JSON.stringify(config.ai_selectors) : null,
        JSON.stringify(config.exclusion_selectors || []),
        JSON.stringify(config.selector_metadata || {}),
        config.forceNameRemoval ?? false,
        ...presence,
        // $53/$54 are appended after the presence flags so the existing
        // hand-numbered parameters keep their positions. A value of null here
        // is meaningful -- it means "inherit the global setting" -- so it is
        // passed through rather than collapsed with ||.
        config.prefer_jsonld_image ?? null,
        config.prefer_jsonld_image !== undefined,
      ]
    );
    return result.rows[0];
  }
};
