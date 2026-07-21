import { PriceCandidate } from '../types/scraper';

// Simulated subset of candidates from Apple iPad Pro
const appleCandidates: PriceCandidate[] = [
  { price: 3999, currency: 'AUD', method: 'json-ld', confidence: 0.95 },
  { price: 3299, currency: 'AUD', method: 'json-ld', confidence: 0.95 },
  { price: 1699, currency: 'AUD', method: 'json-ld', confidence: 0.95 },
  { price: 2049, currency: 'AUD', method: 'json-ld', confidence: 0.95 },
  { price: 3299, currency: 'AUD', method: 'json-ld', confidence: 0.95 }, // Duplicate in json-ld
  { price: 1699, currency: 'AUD', method: 'json-ld', confidence: 0.95 }, // Duplicate in json-ld
  { price: 3449, currency: 'AUD', method: 'generic-css', selector: '.price', confidence: 0.6 },
  { price: 1699, currency: 'AUD', method: 'generic-css', selector: '.price', confidence: 0.6 },
  { price: 2049, currency: 'AUD', method: 'generic-css', selector: '.price', confidence: 0.6 }
];

function pricesMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

// 1. Current Consensus Logic (compounds weight for duplicates)
function currentConsensus(candidates: PriceCandidate[]) {
  const standardCandidates = candidates.filter(c => c.method !== 'member-price' && c.method !== 'original-price');
  const groups: { price: number, totalWeight: number }[] = [];

  for (const c of standardCandidates) {
    let weight = 1.0;
    if (c.method === 'json-ld') weight = 2.0;
    else if (c.method === 'generic-css') weight = 0.2;

    let found = false;
    for (const g of groups) {
      if (pricesMatch(c.price, g.price)) {
        g.totalWeight += weight;
        found = true;
        break;
      }
    }
    if (!found) groups.push({ price: c.price, totalWeight: weight });
  }

  groups.sort((a, b) => b.totalWeight - a.totalWeight);
  const top = groups[0];
  const hasConsensus = top ? top.totalWeight >= 1.0 : false;

  return { price: top?.price, weight: top?.totalWeight, hasConsensus };
}

// 2. Refined Consensus Logic (deduplicates weight per method, checks for ties)
function refinedConsensus(candidates: PriceCandidate[]) {
  const standardCandidates = candidates.filter(c => c.method !== 'member-price' && c.method !== 'original-price');
  const groups: { price: number, totalWeight: number, methods: Set<string> }[] = [];

  for (const c of standardCandidates) {
    let weight = 1.0;
    if (c.method === 'json-ld') weight = 2.0;
    else if (c.method === 'generic-css') weight = 0.2;

    let found = false;
    for (const g of groups) {
      if (pricesMatch(c.price, g.price)) {
        if (!g.methods.has(c.method)) {
          g.totalWeight += weight;
          g.methods.add(c.method);
        }
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ price: c.price, totalWeight: weight, methods: new Set([c.method]) });
    }
  }

  if (groups.length === 0) return { price: null, weight: 0, hasConsensus: false };

  groups.sort((a, b) => b.totalWeight - a.totalWeight);
  
  // Check for ties in the top groups
  let hasConsensus = groups[0].totalWeight >= 1.0;
  if (groups.length > 1 && Math.abs(groups[0].totalWeight - groups[1].totalWeight) < 0.001) {
    hasConsensus = false; // Tie means no clear majority consensus
  }

  return { price: groups[0].price, weight: groups[0].totalWeight, hasConsensus };
}

// 3. Fallback Selection (Current vs Refined)
function simulateFallback(candidates: PriceCandidate[], useRefinedSort: boolean) {
  const standardCandidates = candidates.filter(c => c.method !== 'member-price' && c.method !== 'original-price');
  
  let sorted: PriceCandidate[];
  if (useRefinedSort) {
    // Sort by confidence desc, then price asc
    sorted = [...standardCandidates].sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) > 0.001) {
        return b.confidence - a.confidence;
      }
      return a.price - b.price;
    });
  } else {
    // Sort by confidence desc only
    sorted = [...standardCandidates].sort((a, b) => b.confidence - a.confidence);
  }

  console.log(`Fallback Selection (useRefinedSort: ${useRefinedSort}):`);
  sorted.forEach(c => console.log(`  - $${c.price} (${c.method}) confidence: ${c.confidence}`));
  console.log(`  🏆 Selected: $${sorted[0]?.price}`);
}

async function main() {
  console.log('Apple Price Consensus Simulation');
  console.log('================================');

  const curr = currentConsensus(appleCandidates);
  console.log('Current Consensus Result:');
  console.log(`- price: $${curr.price}`);
  console.log(`- weight: ${curr.weight}`);
  console.log(`- hasConsensus: ${curr.hasConsensus}`);

  const ref = refinedConsensus(appleCandidates);
  console.log('\nRefined Consensus Result:');
  console.log(`- price: $${ref.price}`);
  console.log(`- weight: ${ref.weight}`);
  console.log(`- hasConsensus: ${ref.hasConsensus}`);

  console.log('');
  simulateFallback(appleCandidates, false);
  console.log('');
  simulateFallback(appleCandidates, true);
}

main().catch(console.error);
