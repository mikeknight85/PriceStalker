import { ItemWithListings, ProductWithSparkline } from '../../../../models/types';

/**
 * Groups listings into the items they belong to (issue #143).
 *
 * A pure function over rows the flat dashboard already fetched, rather than a
 * second query. Both views must agree about every number on screen, and the
 * surest way to guarantee that is for both to come from one place -- it also
 * avoids a second copy of the exchange rate triangulation.
 *
 * ## Which price is compared, and in what currency
 *
 * When the user has a preferred currency, `converted_price` is the figure to
 * compare: the price when the currencies already match, the converted amount
 * when a rate resolved, and null when no rate could be found.
 *
 * When they do not -- `users.currency IS NULL`, which is the "Automatic"
 * default every new account starts on -- `converted_price` is null for *every*
 * listing, because the SQL compares against a null currency and the rate join
 * never fires. The first version of this treated that as "nothing is
 * comparable" and told a new user with two shops in one currency that neither
 * could be compared (issue #160).
 *
 * So with no preferred currency the stores' own shared currency is used
 * instead. Two AUD shops compare in AUD, which is what the user means by
 * "Automatic". Listings in a different currency are still excluded, because
 * without a rate there is genuinely nothing to compare them with.
 *
 * ## What "best price" refuses to mean
 *
 * A listing that cannot be expressed in the comparison currency is excluded
 * rather than compared raw. Ranking 49.99 EUR against 49.99 CHF and declaring
 * a winner is worse than declining to -- the user acts on that number.
 * `excluded_count` exists so the UI can say "cheapest of 2 of your 4 stores".
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
    // The primary listing supplies anything the item itself is missing, which
    // is how a freshly migrated item that never had its own name displays
    // sensibly.
    const primary = listings.find(l => (l as any).is_primary) ?? listings[0];

    const currency = comparisonCurrency(listings, primary, preferredCurrency);
    const priceOf = (l: ProductWithSparkline) => comparablePrice(l, preferredCurrency, currency);

    const comparable = listings.filter(l => priceOf(l) !== null);
    const availableComparable = comparable.filter(isListingAvailable);
    const oosComparable = comparable.filter(l => !isListingAvailable(l));

    // Best price is chosen from stores where the user can actually buy the
    // item. An out-of-stock store at a lower price is not an actionable deal;
    // crowning it as the best price creates phantom savings and misleads the
    // user. Only fall back to out-of-stock stores if every comparable store is
    // out of stock.
    const candidates = availableComparable.length > 0 ? availableComparable : comparable;
    const candidatePrices = candidates.map(l => priceOf(l) as number);

    const best = candidatePrices.length > 0 ? Math.min(...candidatePrices) : null;
    const worst = candidatePrices.length > 0 ? Math.max(...candidatePrices) : null;

    // Every listing at the best price among candidates. Two shops
    // at the same price are both the cheapest (issue #161).
    const bestIds = best === null ? [] : candidates.filter(l => priceOf(l) === best).map(l => l.id);

    const spread = candidatePrices.length >= 2 && worst !== null && best !== null ? round2(worst - best) : null;

    // Ordered cheapest available first, then out-of-stock comparable stores,
    // then the ones that could not be compared. The store a user can act on
    // at the cheapest price goes at the top.
    const uncomparable = listings.filter(l => priceOf(l) === null);
    const ordered = [
      ...availableComparable.slice().sort((a, b) => (priceOf(a) as number) - (priceOf(b) as number)),
      ...oosComparable.slice().sort((a, b) => (priceOf(a) as number) - (priceOf(b) as number)),
      ...uncomparable,
    ];

    items.push({
      id: itemId,
      name: (primary as any).item_name || primary.name || primary.url,
      image_url: (primary as any).item_image_url ?? primary.image_url ?? null,
      category: (primary as any).item_category ?? primary.category ?? null,
      user_id: primary.user_id,
      target_price: primary.target_price,
      price_drop_threshold: primary.price_drop_threshold,
      notify_back_in_stock: primary.notify_back_in_stock,
      created_at: primary.created_at,
      updated_at: primary.created_at,

      listings: ordered,
      store_count: listings.length,

      best_price: best,
      best_price_listing_ids: bestIds,
      // Null rather than a guessed code when nothing was comparable, so the UI
      // never renders an amount beside a currency we did not actually use.
      best_price_currency: best === null ? null : currency,

      // Every comparable store at the same price. Saying "best of 3" then would
      // claim a difference that does not exist.
      all_tied: candidates.length > 1 && spread === 0,

      price_spread: spread,
      comparable_count: candidates.length,
      excluded_count: listings.length - comparable.length,

      any_in_stock: listings.some(l => l.stock_status === 'in_stock' || l.stock_status === 'pre_order' || l.stock_status === 'member_only'),
    });
  }

  return items;
}

/**
 * The currency prices are compared in for one item.
 *
 * The user's preference wins when they have one. Otherwise the stores decide:
 * the primary listing's currency, falling back to whichever the listings
 * actually use. Picking the primary's keeps the comparison stable as prices
 * move, rather than letting the cheapest store redefine the currency.
 */
function comparisonCurrency(
  listings: ProductWithSparkline[],
  primary: ProductWithSparkline,
  preferredCurrency: string | null | undefined
): string | null {
  if (preferredCurrency) return preferredCurrency;
  return primary.currency || listings.find(l => l.currency)?.currency || null;
}

/**
 * The figure this listing contributes to the comparison, or null if it cannot
 * take part.
 *
 * Null means the same thing in both branches: there is no number here we can
 * honestly rank against the others.
 */
function comparablePrice(
  listing: ProductWithSparkline,
  preferredCurrency: string | null | undefined,
  currency: string | null
): number | null {
  if (preferredCurrency) {
    return finiteOrNull(listing.converted_price);
  }
  // No preference: only listings already in the comparison currency, since
  // without a target currency there is no rate to convert with.
  if (!currency || listing.currency !== currency) return null;
  return finiteOrNull(listing.current_price);
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Currency arithmetic, kept to two places so a spread reads as money. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A listing is available for purchase if it is not definitively out of stock
 * or unavailable/delisted.
 */
function isListingAvailable(listing: ProductWithSparkline): boolean {
  return listing.stock_status !== 'out_of_stock' && listing.stock_status !== 'not_available';
}
