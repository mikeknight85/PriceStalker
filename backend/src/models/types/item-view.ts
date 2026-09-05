import { Item } from './item';
import { ProductWithSparkline } from './product';

/**
 * An item as the grouped dashboard shows it: the thing you want to buy, with
 * every store that sells it (issue #143).
 *
 * Deliberately built by grouping the same rows the flat dashboard already
 * fetches, rather than by a second query. The flat and grouped views must agree
 * about every number on screen, and the surest way to guarantee that is for
 * both to come from one place. It also avoids a second copy of the exchange
 * rate triangulation, which is the fiddliest SQL in the repository.
 */
export interface ItemWithListings extends Item {
  /** Every store selling this item, best comparable price first. */
  listings: ProductWithSparkline[];
  store_count: number;

  /**
   * The lowest price across stores, in the user's own currency.
   *
   * Null when no store has a comparable price -- see `excluded_count`. Never a
   * raw figure from a currency we could not convert: comparing 49.99 EUR with
   * 49.99 CHF and declaring a winner is worse than declining to.
   */
  best_price: number | null;
  /** Which listing supplies `best_price`, so the UI can name the store. */
  best_price_listing_id: number | null;
  /** The currency `best_price` is expressed in: the user's preferred one. */
  best_price_currency: string | null;

  /**
   * Difference between the cheapest and dearest comparable store, or null when
   * fewer than two could be compared. This is the number that justifies
   * tracking an item in several places at all.
   */
  price_spread: number | null;

  /** How many listings had a price that could be converted and compared. */
  comparable_count: number;
  /**
   * How many were left out of the comparison -- no price scraped yet, or a
   * currency that could not be resolved. Surfaced rather than hidden: "cheapest
   * of 2 of your 4 stores" is honest, "cheapest" alone is not.
   */
  excluded_count: number;

  /** True when at least one store has it. */
  any_in_stock: boolean;
}
