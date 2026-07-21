/**
 * Generates a standardized retailer description based on whether it's a new or existing retailer.
 * Preserves manual descriptions if they don't start with 'Auto-discovered' or 'Auto-updated'.
 */
export function getRetailerDescription(existing: any, method: string): string {
  const existingDescription = existing?.description;
  
  // If no description exists, or it's one of our auto-generated ones, we can update it
  if (!existingDescription || 
      existingDescription.startsWith('Auto-discovered') || 
      existingDescription.startsWith('Auto-updated')) {
    return existing ? `Auto-updated via ${method}` : `Auto-discovered via ${method}`;
  }
  
  // Otherwise, preserve the manual description
  return existingDescription;
}
