import { runAudit } from './retailer-audit/runner';

async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  const runAi = process.argv.includes('--run-ai') || process.argv.includes('-a');
  const mergeAi = process.argv.includes('--merge-ai') || process.argv.includes('-m');
  const overwriteAi = process.argv.includes('--overwrite-ai') || process.argv.includes('-o');
  const help = process.argv.includes('--help') || process.argv.includes('-h');

  const domainIndex = process.argv.indexOf('--domain') !== -1 ? process.argv.indexOf('--domain') : process.argv.indexOf('-dom');
  const targetDomain = domainIndex !== -1 ? process.argv[domainIndex + 1] : null;

  if (help) {
    console.log(`
PriceStalker Retailer Selector Audit Tool
======================================
Usage: npm run audit-retailers [options]
   Or: node dist/scripts/audit-retailers.js [options]

Options:
  -d, --dry-run      Analyze and report duplicates/changes without writing to DB.
  -a, --run-ai       Scrape one active product URL per retailer and call AI config recreation.
  -m, --merge-ai     Merge AI-discovered selectors into existing configs (requires -a).
  -o, --overwrite-ai Overwrite existing configs with AI-discovered selectors (requires -a).
  --domain <domain>  Only audit/run AI on a specific domain (e.g. dev.home.enuff.com).
  -h, --help         Show help.
`);
    process.exit(0);
  }

  await runAudit({
    dryRun,
    runAi,
    mergeAi,
    overwriteAi,
    targetDomain
  });
}

main().catch(console.error);
