import { PriceCandidate } from '../types/scraper';
import { findPriceConsensus } from '../services/scraper/arbitrators/consensus';

// The exact candidates extracted from Mwave
const mwaveCandidates: PriceCandidate[] = [
  {
    price: 1999,
    currency: 'AUD',
    method: 'original-price',
    selector: '[class*="rrp" i]',
    context: 'MSRP $1,999.00',
    confidence: 0.95
  },
  {
    price: 1999,
    currency: 'AUD',
    method: 'generic-css',
    selector: '[class*="price" i]',
    context: 'MSRP $1,999.00',
    confidence: 0.6
  },
  {
    price: 1699,
    currency: 'AUD',
    method: 'generic-css',
    selector: '[class*="price" i]',
    context: '$1,699.00',
    confidence: 0.6
  },
  {
    price: 1999,
    currency: 'AUD',
    method: 'generic-css',
    selector: '[class*="Price" i]',
    context: 'MSRP $1,999.00',
    confidence: 0.6
  },
  {
    price: 1699,
    currency: 'AUD',
    method: 'generic-css',
    selector: '[class*="Price" i]',
    context: '$1,699.00',
    confidence: 0.6
  }
];

function simulateFallback(candidates: PriceCandidate[], filterStandardOnly: boolean) {
  console.log(`\n--- Simulating Fallback Selection (filterStandardOnly: ${filterStandardOnly}) ---`);
  
  let targetCandidates = candidates;
  if (filterStandardOnly) {
    targetCandidates = candidates.filter(c => c.method !== 'member-price' && c.method !== 'original-price');
  }

  if (targetCandidates.length > 0) {
    // Sort by confidence descending
    const sorted = [...targetCandidates].sort((a, b) => b.confidence - a.confidence);
    console.log('Sorted candidates:');
    sorted.forEach(c => console.log(`- $${c.price} (${c.method}) confidence: ${c.confidence} via ${c.selector}`));
    
    const best = sorted[0];
    console.log(`🏆 Suggested Price: $${best.price} via ${best.method}`);
  } else {
    console.log('No candidates available.');
  }
}

function simulateConsensus(candidates: PriceCandidate[], deduplicateSelectors: boolean, addCustomSelector: boolean) {
  console.log(`\n--- Simulating Consensus Phase (deduplicateSelectors: ${deduplicateSelectors}, addCustomSelector: ${addCustomSelector}) ---`);

  let testCandidates = [...candidates];

  if (deduplicateSelectors) {
    // Remove duplicate case-insensitive matches for the same element
    // Simulating by removing "[class*='Price' i]" since it's identical to "[class*='price' i]"
    testCandidates = testCandidates.filter(c => c.selector !== '[class*="Price" i]');
  }

  if (addCustomSelector) {
    // Simulate user has manual-voted or config has custom selector '.divPriceNormal' (weight 1.5)
    testCandidates.push({
      price: 1699,
      currency: 'AUD',
      method: 'custom-css',
      selector: '.divPriceNormal',
      context: '$1,699.00',
      confidence: 0.9
    });
  }

  console.log('Active candidates for consensus:');
  testCandidates.forEach(c => console.log(`- $${c.price} (${c.method}) via ${c.selector}`));

  const consensusResult = findPriceConsensus(testCandidates);
  console.log('Consensus Result:');
  console.log(`- hasConsensus: ${consensusResult.hasConsensus}`);
  console.log(`- price: ${consensusResult.price ? `$${consensusResult.price.price} (${consensusResult.price.method})` : 'null'}`);
  console.log(`- originalPrice: ${consensusResult.originalPrice ? `$${consensusResult.originalPrice.price}` : 'null'}`);
}

async function main() {
  console.log('Mwave Price Voting Simulation');
  console.log('=============================');
  
  // 1. Current Behavior (Fallback selects original-price due to high confidence 0.95)
  simulateFallback(mwaveCandidates, false);

  // 2. Fixed Behavior (Fallback only selects from standard price candidates)
  simulateFallback(mwaveCandidates, true);

  // 3. Current Consensus run
  simulateConsensus(mwaveCandidates, false, false);

  // 4. Consensus run with deduplicated selectors
  simulateConsensus(mwaveCandidates, true, false);

  // 5. Consensus run after learning custom selector (Auto-tracks correctly!)
  simulateConsensus(mwaveCandidates, false, true);
}

main().catch(console.error);
