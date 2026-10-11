import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ItemCard from '../../components/ItemCard';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import Icon from '../../../../components/Icon';
import { itemListQuery } from '../../../../api/queries';
import { useAuth } from '../../../auth';
import { SortOption, SortOrder, StockFilter, TrackingFilter } from './utils';
import { sortItems } from './itemSort';
import { itemMatchesStockFilter, itemMatchesTrackingFilter } from './filters';
import ResultCount from './ResultCount';

interface ItemListProps {
  /** Applied to the item name, mirroring the flat view's search. */
  searchQuery: string;
  activeTag: string | null;
  /**
   * The dashboard's filters, which apply here too (issues #246 and #248).
   * `filters.ts` sets out what each one means for an item; in short, the best
   * answer among the item's stores wins, so one live store keeps an item
   * Active and one store with stock keeps it In Stock.
   */
  trackingFilter: TrackingFilter;
  stockFilter: StockFilter;
  /**
   * The dashboard's sort, which applies here too (issue #241). It used to be
   * wired only to the flat list, so every option in this view did nothing and
   * said nothing. `itemSort.ts` sets out what each one means for an item.
   */
  sortBy: SortOption;
  sortOrder: SortOrder;
}

/**
 * The grouped dashboard (issue #143): one card per item rather than per
 * retailer listing.
 *
 * Fetches separately from the flat list rather than grouping client-side. The
 * best price depends on exchange rates the server already resolves for the flat
 * view, and recomputing that in the browser would be a second implementation
 * of the rule about which listings may be compared.
 */
const ItemList: React.FC<ItemListProps> = ({
  searchQuery,
  activeTag,
  trackingFilter,
  stockFilter,
  sortBy,
  sortOrder,
}) => {
  const { user } = useAuth();
  const itemsQuery = useQuery(itemListQuery());
  const data = itemsQuery.data;

  // Above the early returns, because a hook cannot be reached conditionally.
  const items = useMemo(() => {
    // Array.isArray rather than a null check: an unexpected response shape must
    // render as "nothing to show" rather than throwing out of the dashboard.
    const filtered = (Array.isArray(data) ? data : []).filter(item => {
      const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      // `item.category` is the wire field for what the UI calls tags (#147).
      const matchesTag = !activeTag || (item.category || '').split(',').map(c => c.trim()).includes(activeTag);
      return (
        matchesSearch &&
        matchesTag &&
        itemMatchesTrackingFilter(item, trackingFilter) &&
        itemMatchesStockFilter(item, stockFilter)
      );
    });

    return sortItems(filtered, sortBy, sortOrder);
  }, [data, searchQuery, activeTag, trackingFilter, stockFilter, sortBy, sortOrder]);

  if (itemsQuery.isError) {
    return (
      <div className="alert alert-error">
        <span>Failed to load items. Please try again.</span>
        <button type="button" className="btn btn-secondary" onClick={() => void itemsQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (itemsQuery.isLoading) return <LoadingSpinner centered />;

  const isFiltered = Boolean(searchQuery) || activeTag !== null || trackingFilter !== 'all' || stockFilter !== 'all';

  if (items.length === 0) {
    return (
      <>
        {isFiltered && <ResultCount count={0} noun="product" activeTag={activeTag} />}
        <div className="products-empty">
          <div className="products-empty-icon"><Icon name="package" /></div>
          <div>{isFiltered ? 'No products match these filters' : 'Nothing tracked yet'}</div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Items, counted as items: this view's cards are products, not stores. */}
      <ResultCount count={items.length} noun="product" activeTag={activeTag} />
      <div className="items-list">
        {items.map(item => (
          <ItemCard key={item.id} item={item} userLocale={user?.locale ?? undefined} />
        ))}
      </div>
    </>
  );
};

export default ItemList;
