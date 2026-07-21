/**
 * Helper to calculate selector specificity score (higher = more specific)
 */
export function getSelectorSpecificity(selector: string): number {
  if (selector.startsWith('~') && selector.endsWith('~')) {
    return 1000;
  }

  let cleanSel = selector;
  if (selector.includes('|')) {
    cleanSel = selector.split('|')[0];
  }
  if (cleanSel.startsWith('!')) {
    cleanSel = cleanSel.substring(1);
  }

  let score = 0;

  const idMatches = cleanSel.match(/#[a-zA-Z0-9_-]+/g);
  if (idMatches) {
    score += idMatches.length * 100;
  }

  const attrMatches = cleanSel.match(/\[[^\]]+\]/g) || [];
  for (const attr of attrMatches) {
    if (attr.includes('*=') || attr.includes('^=') || attr.includes('$=') || attr.includes('~=')) {
      score += 5;
    } else {
      score += 50;
    }
  }

  const classMatches = cleanSel.match(/\.[a-zA-Z0-9_-]+/g);
  if (classMatches) {
    score += classMatches.length * 10;
  }

  const tags = cleanSel.split(/[\s>+~]+/).filter(part => {
    if (!part || /^[\.#\[]/.test(part)) return false;
    return true;
  });
  score += tags.length * 1;

  return score;
}

/**
 * Helper to clean, filter, and sort selector arrays
 */
export function cleanSelectors(arr: any, genericSet: Set<string>): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    
    // Skip global generic selectors
    if (genericSet.has(lower)) continue;
    
    if (!seen.has(lower)) {
      seen.add(lower);
      cleaned.push(trimmed);
    }
  }
  
  // Sort by specificity descending
  return cleaned.sort((a, b) => getSelectorSpecificity(b) - getSelectorSpecificity(a));
}
