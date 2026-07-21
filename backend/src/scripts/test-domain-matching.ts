import { pool, retailerRepository } from '../models';
import { getUrlLookup } from '../utils/scraping/urlHelper';
import * as fs from 'fs';
import * as path from 'path';

interface ProductRow {
  id: number;
  name: string;
  url: string;
}

async function main() {
  console.log('Starting PriceGhost Domain Matching Audit...');
  console.log('===========================================\n');

  // Fetch all products
  const productsResult = await pool.query('SELECT id, name, url FROM products');
  const products: ProductRow[] = productsResult.rows;

  console.log(`Found ${products.length} products in database.`);

  const auditResults: Array<{
    productId: number;
    productName: string;
    productUrl: string;
    urlLookup: string;
    matchedDomain: string | null;
    proposedMatchedDomain: string | null;
    matchType: 'exact' | 'path-specific' | 'subdomain-specific' | 'fallback-generic' | 'boundary-collision' | 'no-config';
    comment: string;
    sqlDiffer: boolean;
  }> = [];

  let sqlDifferenceCount = 0;

  for (const product of products) {
    try {
      const urlLookup = getUrlLookup(product.url);
      const urlObj = new URL(product.url);
      const domain = urlObj.hostname.replace('www.', '').toLowerCase();

      // Retrieve config with current logic
      const config = await retailerRepository.getConfigForUrl(urlLookup);

      // Retrieve config with proposed logic
      const proposedResult = await pool.query(
        "SELECT * FROM retailer_configs WHERE (domain = $1 OR $1 ILIKE domain || '/%') AND active = true ORDER BY length(domain) DESC LIMIT 1",
        [urlLookup]
      );
      const proposedConfig = proposedResult.rows[0] || null;

      const matchedDomain = config ? config.domain.toLowerCase() : null;
      const proposedMatchedDomain = proposedConfig ? proposedConfig.domain.toLowerCase() : null;
      const sqlDiffer = matchedDomain !== proposedMatchedDomain;

      if (sqlDiffer) {
        sqlDifferenceCount++;
      }

      if (!config) {
        auditResults.push({
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          urlLookup,
          matchedDomain: null,
          proposedMatchedDomain,
          matchType: 'no-config',
          comment: 'No matching configuration found (will fall back to generic/global scraping)',
          sqlDiffer
        });
        continue;
      }

      const activeMatchedDomain = config.domain.toLowerCase();

      // Determine boundary collision for old logic
      let matchType: typeof auditResults[0]['matchType'] = 'exact';
      let comment = '';

      if (urlLookup.startsWith(activeMatchedDomain)) {
        const nextChar = urlLookup[activeMatchedDomain.length];
        if (nextChar && nextChar !== '/' && nextChar !== '?' && nextChar !== '#') {
          matchType = 'boundary-collision';
          comment = `TLD mismatch collision! Product on TLD boundary matched config '${activeMatchedDomain}' instead of falling back or matching a correct TLD.`;
        } else {
          // Valid match
          if (activeMatchedDomain === domain) {
            matchType = 'exact';
            comment = `Exact match to domain '${activeMatchedDomain}'`;
          } else if (activeMatchedDomain.includes('/') && urlLookup.startsWith(activeMatchedDomain)) {
            matchType = 'path-specific';
            comment = `Path-specific match to '${activeMatchedDomain}'`;
          } else if (domain.startsWith(activeMatchedDomain) && domain !== activeMatchedDomain) {
            matchType = 'boundary-collision';
            comment = `Subdomain prefix matched root domain config '${activeMatchedDomain}' without explicit subdomain configuration.`;
          } else {
            matchType = 'exact';
            comment = `Matched config '${activeMatchedDomain}'`;
          }
        }
      } else {
        matchType = 'fallback-generic';
        comment = `Resolved to config '${activeMatchedDomain}' but did not start with it directly (unexpected case)`;
      }

      auditResults.push({
        productId: product.id,
        productName: product.name,
        productUrl: product.url,
        urlLookup,
        matchedDomain: activeMatchedDomain,
        proposedMatchedDomain,
        matchType,
        comment,
        sqlDiffer
      });

    } catch (err: any) {
      console.error(`Error processing product ID ${product.id} (${product.url}): ${err.message}`);
    }
  }

  // --- Run Simulated Boundary Tests ---
  console.log('\nRunning Simulated Boundary Verification Cases...');
  console.log('--------------------------------------------------');

  const simulatedCases = [
    {
      name: 'Path match (exact path match)',
      url: 'https://www.apple.com/au/shop/buy-ipad/ipad-pro',
      expectedOld: 'apple.com/au',
      expectedProposed: 'apple.com/au'
    },
    {
      name: 'Path match (root domain match)',
      url: 'https://store.google.com/au/product/google_tv_streamer',
      expectedOld: 'store.google.com/au',
      expectedProposed: 'store.google.com/au'
    },
    {
      name: 'Subdomain match (exact subdomain)',
      url: 'https://au.creative.com/p/speakers/creative-pebble-se',
      expectedOld: 'au.creative.com',
      expectedProposed: 'au.creative.com'
    },
    {
      name: 'TLD Boundary Mismatch (e.g. apple.com.au vs apple.com/au)',
      url: 'https://www.apple.com.au/shop/buy-ipad/ipad-pro',
      expectedOld: null,
      expectedProposed: null
    }
  ];

  for (const tc of simulatedCases) {
    const urlLookup = getUrlLookup(tc.url);

    const oldConfig = await retailerRepository.getConfigForUrl(urlLookup);
    const proposedResult = await pool.query(
      "SELECT * FROM retailer_configs WHERE (domain = $1 OR $1 ILIKE domain || '/%') AND active = true ORDER BY length(domain) DESC LIMIT 1",
      [urlLookup]
    );
    const proposedConfig = proposedResult.rows[0] || null;

    console.log(`\nCase: ${tc.name}`);
    console.log(`  URL: ${tc.url}`);
    console.log(`  urlLookup: ${urlLookup}`);
    console.log(`  Old Match: ${oldConfig ? oldConfig.domain : 'None'}`);
    console.log(`  Proposed Match: ${proposedConfig ? proposedConfig.domain : 'None'}`);
  }

  // Group and summarize results
  const collisions = auditResults.filter(r => r.matchType === 'boundary-collision');
  const pathSpecific = auditResults.filter(r => r.matchType === 'path-specific');
  const exact = auditResults.filter(r => r.matchType === 'exact');
  const noConfig = auditResults.filter(r => r.matchType === 'no-config');

  console.log('\nAudit Summary:');
  console.log(`- Exact matches: ${exact.length}`);
  console.log(`- Path-specific matches (e.g. /au): ${pathSpecific.length}`);
  console.log(`- Boundary collisions: ${collisions.length}`);
  console.log(`- Products without configs: ${noConfig.length}`);
  console.log(`- SQL Differences found on existing products: ${sqlDifferenceCount}`);

  // Write report to markdown
  let report = `# Domain Matching Audit Report\n\n`;
  report += `Generated on: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `| Match Type | Count | Description |\n`;
  report += `| --- | --- | --- |\n`;
  report += `| **Exact Matches** | ${exact.length} | Matches root domain config exactly |\n`;
  report += `| **Path-Specific** | ${pathSpecific.length} | Matches regional path config (e.g., \`apple.com/au\`) |\n`;
  report += `| **Boundary Collisions** | ${collisions.length} | Prefix collisions between different domains/TLDs (CRITICAL) |\n`;
  report += `| **No Configuration** | ${noConfig.length} | No active config matching the URL |\n`;
  report += `| **SQL Differences** | ${sqlDifferenceCount} | Mismatches between current prefix matching and proposed boundary-safe matching |\n\n`;

  if (sqlDifferenceCount > 0) {
    report += `## ⚠️ SQL Matching Differences on Existing Products\n\n`;
    report += `| Product ID | Product Name | urlLookup | Old Matched | Proposed Matched |\n`;
    report += `| --- | --- | --- | --- | --- |\n`;
    for (const r of auditResults.filter(r => r.sqlDiffer)) {
      report += `| ${r.productId} | ${r.productName} | \`${r.urlLookup}\` | \`${r.matchedDomain || 'None'}\` | \`${r.proposedMatchedDomain || 'None'}\` |\n`;
    }
    report += `\n`;
  } else {
    report += `## ✅ No Differences on Existing Products\n\nBoth current and proposed boundary-safe SQL queries returned identical matched configurations for all existing products in the database.\n\n`;
  }

  report += `## Detailed Mappings (Sample of 50)\n\n`;
  report += `| Product ID | Product Name | urlLookup | Matched Domain | Match Type |\n`;
  report += `| --- | --- | --- | --- | --- |\n`;
  for (const r of auditResults.slice(0, 50)) {
    report += `| ${r.productId} | ${r.productName} | \`${r.urlLookup}\` | \`${r.matchedDomain || 'None'}\` | ${r.matchType} |\n`;
  }

  const tmpDir = path.join(__dirname, '../../../../tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const reportPath = path.join(tmpDir, 'domain_matching_audit_report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\nDetailed report written to: ${reportPath}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('Fatal error running audit:', err);
  await pool.end();
});
