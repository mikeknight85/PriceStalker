import { pool, retailerRepository, Product } from '../../models';
import { cleanSelectors } from './selector-utils';
import { runAiAudit, throttle } from './ai-helper';
import { getUrlLookup } from '../../utils/scraping/urlHelper';

export async function runAudit(options: {
  dryRun: boolean;
  runAi: boolean;
  mergeAi: boolean;
  overwriteAi: boolean;
  targetDomain: string | null;
}) {
  const { dryRun, runAi, mergeAi, overwriteAi, targetDomain } = options;

  console.log(`[Audit] Starting Retailer Selector Audit... ${dryRun ? '(DRY-RUN MODE)' : ''}`);

  try {
    // 1. Fetch all retailers
    const retailers = await retailerRepository.getAll(false);
    console.log(`[Audit] Found ${retailers.length} retailer configurations in database.`);

    // 2. Fetch global generic selectors from settings
    const settingsRes = await pool.query(
      `SELECT key, value FROM system_settings 
       WHERE key IN (
         'generic_price_selectors', 
         'generic_deal_price_selectors', 
         'generic_member_price_selectors', 
         'generic_pre_order_price_selectors', 
         'generic_original_price_selectors'
       )`
    );
    const allGenericSelectors = new Set<string>();
    for (const row of settingsRes.rows) {
      try {
        const val = JSON.parse(row.value);
        if (Array.isArray(val)) {
          for (const s of val) {
            allGenericSelectors.add(s.trim().toLowerCase());
          }
        }
      } catch (e) {}
    }
    console.log(`[Audit] Loaded ${allGenericSelectors.size} global generic selectors to exclude from custom configs.`);

    // 3. Fetch all products to find matching URLs for AI scraping
    const productsRes = await pool.query('SELECT id, url FROM products WHERE checking_paused = false');
    const products = productsRes.rows;
    console.log(`[Audit] Loaded ${products.length} active products to match for AI verification.`);

    let cleanedCount = 0;
    let aiTriggeredCount = 0;

    for (const r of retailers) {
      if (targetDomain && r.domain.toLowerCase() !== targetDomain.toLowerCase()) {
        continue;
      }
      console.log(`\n--------------------------------------------------`);
      console.log(`Processing Retailer: ${r.name || r.domain} (${r.domain})`);

      // Clean existing arrays
      const cPrice = cleanSelectors(r.price_selectors, allGenericSelectors);
      const cName = cleanSelectors(r.name_selectors, allGenericSelectors);
      const cImage = cleanSelectors(r.image_selectors, allGenericSelectors);
      const cStock = cleanSelectors(r.stock_selectors, allGenericSelectors);
      const cDeal = cleanSelectors(r.deal_price_selectors, allGenericSelectors);
      const cMember = cleanSelectors(r.member_price_selectors, allGenericSelectors);
      const cPreOrder = cleanSelectors(r.pre_order_price_selectors, allGenericSelectors);
      const cOriginal = cleanSelectors(r.original_price_selectors, allGenericSelectors);

      let hasDiff = 
        JSON.stringify(cPrice) !== JSON.stringify(r.price_selectors || []) ||
        JSON.stringify(cName) !== JSON.stringify(r.name_selectors || []) ||
        JSON.stringify(cImage) !== JSON.stringify(r.image_selectors || []) ||
        JSON.stringify(cStock) !== JSON.stringify(r.stock_selectors || []) ||
        JSON.stringify(cDeal) !== JSON.stringify(r.deal_price_selectors || []) ||
        JSON.stringify(cPreOrder) !== JSON.stringify(r.pre_order_price_selectors || []) ||
        JSON.stringify(cMember) !== JSON.stringify(r.member_price_selectors || []) ||
        JSON.stringify(cOriginal) !== JSON.stringify(r.original_price_selectors || []);

      if (hasDiff) {
        console.log(`[Clean] Found duplicate or uncleaned selectors in database.`);
      }

      let updatedPrice = [...cPrice];
      let updatedName = [...cName];
      let updatedImage = [...cImage];
      let updatedStock = [...cStock];
      let updatedDeal = [...cDeal];
      let updatedMember = [...cMember];
      let updatedPreOrder = [...cPreOrder];
      let updatedOriginal = [...cOriginal];

      // AI Recreation check
      if (runAi) {
        const matchedProduct = products.find((p: Product) => {
          try {
            const urlLookup = getUrlLookup(p.url);
            return urlLookup.startsWith(r.domain.toLowerCase());
          } catch (e) {
            return false;
          }
        });

        if (matchedProduct) {
          console.log(`[AI] Found active product URL to scrape: ${matchedProduct.url}`);
          aiTriggeredCount++;
          const aiResult = await runAiAudit(matchedProduct.url, matchedProduct.id, r);

          if (aiResult.success && aiResult.config) {
            const generated = aiResult.config;
            if (overwriteAi) {
              updatedPrice = cleanSelectors(generated.price_selectors, allGenericSelectors);
              updatedName = cleanSelectors(generated.name_selectors, allGenericSelectors);
              updatedImage = cleanSelectors(generated.image_selectors, allGenericSelectors);
              updatedStock = cleanSelectors(generated.stock_selectors, allGenericSelectors);
              updatedDeal = cleanSelectors(generated.deal_price_selectors, allGenericSelectors);
              updatedMember = cleanSelectors(generated.member_price_selectors, allGenericSelectors);
              updatedPreOrder = cleanSelectors(generated.pre_order_price_selectors, allGenericSelectors);
              updatedOriginal = cleanSelectors(generated.original_price_selectors, allGenericSelectors);
              hasDiff = true;
            } else if (mergeAi) {
              updatedPrice = cleanSelectors([...updatedPrice, ...(generated.price_selectors || [])], allGenericSelectors);
              updatedName = cleanSelectors([...updatedName, ...(generated.name_selectors || [])], allGenericSelectors);
              updatedImage = cleanSelectors([...updatedImage, ...(generated.image_selectors || [])], allGenericSelectors);
              updatedStock = cleanSelectors([...updatedStock, ...(generated.stock_selectors || [])], allGenericSelectors);
              updatedDeal = cleanSelectors([...updatedDeal, ...(generated.deal_price_selectors || [])], allGenericSelectors);
              updatedMember = cleanSelectors([...updatedMember, ...(generated.member_price_selectors || [])], allGenericSelectors);
              updatedPreOrder = cleanSelectors([...updatedPreOrder, ...(generated.pre_order_price_selectors || [])], allGenericSelectors);
              updatedOriginal = cleanSelectors([...updatedOriginal, ...(generated.original_price_selectors || [])], allGenericSelectors);
              hasDiff = true;
            }
          } else {
            console.log(`[AI] AI discovery failed: ${aiResult.error || 'No config returned'}`);
          }
          await throttle();
        }
      }

      // Write updates to DB
      if (hasDiff && !dryRun) {
        await pool.query(
          `UPDATE retailer_configs SET 
            name_selectors = $1, 
            price_selectors = $2, 
            deal_price_selectors = $3, 
            member_price_selectors = $4, 
            image_selectors = $5, 
            stock_selectors = $6, 
            pre_order_price_selectors = $7, 
            original_price_selectors = $8,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $9`,
          [
            JSON.stringify(updatedName),
            JSON.stringify(updatedPrice),
            JSON.stringify(updatedDeal),
            JSON.stringify(updatedMember),
            JSON.stringify(updatedImage),
            JSON.stringify(updatedStock),
            JSON.stringify(updatedPreOrder),
            updatedOriginal,
            r.id
          ]
        );
        cleanedCount++;
        console.log(`[Audit] Successfully saved clean config for ${r.domain} to database.`);
      } else if (hasDiff && dryRun) {
        console.log(`[Audit] Dry-run: Skip saving modifications for ${r.domain}.`);
      }
    }

    console.log(`\n==================================================`);
    console.log(`[Audit] Completed successfully!`);
    console.log(` - Retailers parsed: ${retailers.length}`);
    console.log(` - AI Audits run:    ${aiTriggeredCount}`);
    console.log(` - Cleaned / Saved:  ${cleanedCount}`);
    console.log(`==================================================`);
  } catch (error) {
    console.error(`[Audit] Failed:`, error);
  } finally {
    await pool.end();
  }
}
