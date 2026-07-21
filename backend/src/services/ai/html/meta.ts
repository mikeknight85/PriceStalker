import { CheerioAPI } from 'cheerio';

/**
 * Extracts high-value meta tags for AI processing.
 */
export function extractHighValueMeta($: CheerioAPI): string[] {
  const metaTags: string[] = [];
  
  $('meta').each((_, el) => {
    const property = $(el).attr('property')?.toLowerCase() || '';
    const name = $(el).attr('name')?.toLowerCase() || '';
    const content = $(el).attr('content') || '';
    
    const highValueMeta = [
      'price', 'currency', 'availability', 'stock', 'title', 'og:price', 'og:currency', 
      'og:availability', 'product:price', 'product:availability', 'product:condition',
      'twitter:title', 'twitter:description', 'image'
    ];
    
    if (highValueMeta.some(keyword => property.includes(keyword) || name.includes(keyword))) {
      metaTags.push(`<meta ${property ? `property="${property}"` : `name="${name}"`} content="${content}">`);
    }
  });

  return metaTags;
}
