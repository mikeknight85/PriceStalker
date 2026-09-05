import { ItemWithListings, ProductWithSparkline } from '../../../../models/types';

/**
 * Groups listings into the items they belong to (issue #143).
 *
 * A pure function over rows the flat dashboard already fetched, rather than a
 * second query. Both views must agree about every number on screen, and the
 * surest way to guarantee that is for both to come from one place -- it also
 * avoids a second copy of the exchange rate triangulation.
 *
 * ## What "best price" means, and what it refuses to mean
 *
 * Only listings whose price could be expressed in the user's own currency are
 * compared. `converted_price` is that figure: equal to the price when the
 * currencies already match, the converted amount when a rate resolved, and null
 * when no rate could be found.
 *
 * A listing with a price but no usable rate is therefore excluded rather than
 * compared raw. Ranking 49.99 EUR against 49.99 CHF and declaring a winner is
 * worse than declining to -- the user acts on that number. `excluded_count`
 * exists so the UI can say "cheapest of 2 of your 4 stores" instead of
 * "cheapest", which would be a claim we cannot support.
 */
export function groupIntoItems(
  products: ProductWithSparkline[],
  preferredCurrency: string | null | undefined
): ItemWithListings[] {
  const byItem = new Map<number, ProductWithSparkline[]>();
  // Listings whose item is missing are skipped rather than invented into one:
  // every product has an item, so this means something is wrong, and silently
  // creating a phantom item would hide it.
  for (const product of products) {
    const itemId = (product as any).item_id;
    if (itemId == null) continue;
    const bucket = byItem.get(itemId);
    if (bucket) bucket.push(product);
    else byItem.set(itemId, [product]);
  }

  const items: ItemWithListings[] = [];

  for (const [itemId, listings] of byItem) {
    const comparable = listings.filter(l => isComparable(l));
    const prices = comparable.map(l => Number(l.converted_price));

    const best = prices.length > 0 ? Math.min(...prices) : null;
    const worst = prices.length > 0 ? Math.max(...prices) : null;
    const bestListing = best === null
      ? null
      : comparable.find(l => Number(l.converted_price) === best) ?? null;

    // Ordered cheapest first, then the ones that could not be compared. The
    // store a user acts on is the cheapest one, so it goes at the top; the rest
    // still appear, because a listing left out of the comparison is not a
    // listing the user has stopped tracking.
    const ordered = [
      ...comparable.slice().sort((a, b) => Number(a.converted_price) - Number(b.converted_price)),
      ...listings.filter(l => !isComparable(l)),
    ];

    // The primary listing supplies anything the item itself is missing, which
    // is how a freshly migrated item that never had its own name displays
    // sensibly.
    const primary = listings.find(l => (l as any).is_primary) ?? listings[0];

    items.push({
      id: itemId,
      name: (primary as any).item_name || primary.name || primary.url,
      image_url: (primary as any).item_image_url ?? primary.image_url ?? null,
      category: primary.category ?? null,
      user_id: primary.user_id,
      target_price: primary.target_price,
      price_drop_threshold: primary.price_drop_threshold,
      notify_back_in_stock: primary.notify_back_in_stock,
      created_at: primary.created_at,
      updated_at: primary.created_at,

      listings: ordered,
      store_count: listings.length,

      best_price: best,
      best_price_listing_id: bestListing?.id ?? null,
      // Null rather than a guessed code when nothing was comparable, so the UI
      // never renders an amount beside a currency we did not actually use.
      best_price_currency: best === null ? null : (preferredCurrency ?? null),

      // A spread needs two points. One store is not a comparison.
      price_spread: prices.length >= 2 && worst !== null && best !== null
        ? round2(worst - best)
        : null,

      comparable_count: comparable.length,
      excluded_count: listings.length - comparable.length,

      any_in_stock: listings.some(l => l.stock_status === 'in_stock'),
    });
  }

  return items;
}

/**
 * Whether a listing can take part in a price comparison.
 *
 * `converted_price` is null when the scrape found no price, or when the price
 * is in a currency no exchange rate could resolve. Both mean the same thing
 * here: there is no figure we can honestly rank.
 */
function isComparable(listing: ProductWithSparkline): boolean {
  const value = listing.converted_price;
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

/** Currency arithmetic, kept to two places so a spread reads as money. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
