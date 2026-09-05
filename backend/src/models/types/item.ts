/**
 * The canonical thing a user wants to buy, as opposed to one retailer's
 * listing of it (issue #143).
 *
 * A `Product` row is one retailer's page. An `Item` is the thing itself, and
 * owns everything that describes intent rather than a shop: the display name,
 * the image, and the alert settings. "Tell me when anyone has this under 50" is
 * a statement about the item, not about any one store.
 *
 * Every product belongs to exactly one item -- a product sold at a single
 * retailer is an item with one listing. The alternative, creating items only
 * when a user links two URLs, means alert settings have to live on both tables
 * with a rule about which wins.
 *
 * Naming: the UI says "Product" for an item and "Store" for a listing, because
 * that is how people think about it. The database says `items` and `products`
 * because those are unambiguous to read. See CLAUDE.md.
 */
export interface Item {
  id: number;
  name: string;
  category: string | null;
  image_url: string | null;
  user_id: number;
  /** Alert settings live here, not on the listing. */
  target_price: number | null;
  price_drop_threshold: number | null;
  notify_back_in_stock: boolean;
  created_at: Date;
  updated_at: Date;
}
