import React from 'react';

interface ResultCountProps {
  /** How many cards are actually rendered below this line. */
  count: number;
  /** What one card is, in the UI's own vocabulary. */
  noun: 'product' | 'store';
  activeTag: string | null;
}

/**
 * "Showing N products" / "Showing N stores", rendered by the list it describes.
 *
 * It used to live in `DashboardControls`, above the view toggle, and always
 * reported the number of *listings* -- so a user tracking one product at three
 * stores read "Showing 3 products" above a single card in the grouped view
 * (issue #248). Worse, it reported the flat view's filtered count whichever
 * view was on screen.
 *
 * Keeping it inside each list makes that desync impossible: whoever renders the
 * cards renders the count, and names them with the word that view uses --
 * "Store" for one retailer's listing, "Product" for the thing you want to buy,
 * as CLAUDE.md sets out.
 */
const ResultCount: React.FC<ResultCountProps> = ({ count, noun, activeTag }) => (
  <div
    className="products-count"
    style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}
  >
    Showing {count} {noun}{count !== 1 ? 's' : ''}
    {activeTag && ` tagged ${activeTag}`}
  </div>
);

export default ResultCount;
