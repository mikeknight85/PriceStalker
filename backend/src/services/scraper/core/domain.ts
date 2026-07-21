/**
 * Formats a domain string into a human-readable retailer name.
 * Example: "www.petbarn.com.au" -> "Petbarn"
 */
export function formatDomainAsRetailer(domain: string): string {
  if (!domain) return '';
  // Remove common prefixes
  let name = domain.toLowerCase().replace(/^www\./, '');
  // Take everything before the first dot
  name = name.split('.')[0];
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}
