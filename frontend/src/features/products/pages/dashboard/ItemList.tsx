import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ItemCard from '../../components/ItemCard';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import Icon from '../../../../components/Icon';
import { itemListQuery } from '../../../../api/queries';
import { useAuth } from '../../../auth';
import { SortOption, SortOrder } from './utils';
import { sortItems } from './itemSort';

interface ItemListProps {
  /** Applied to the item name, mirroring the flat view's search. */
  searchQuery: string;
  activeTag: string | null;
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
const ItemList: React.FC<ItemListProps> = ({ searchQuery, activeTag, sortBy, sortOrder }) => {
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
      return matchesSearch && matchesTag;
    });

    return sortItems(filtered, sortBy, sortOrder);
  }, [data, searchQuery, activeTag, sortBy, sortOrder]);

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

  if (items.length === 0) {
    return (
      <div className="products-empty">
        <div className="products-empty-icon"><Icon name="package" /></div>
        <div>{searchQuery || activeTag ? 'No items match this filter' : 'Nothing tracked yet'}</div>
      </div>
    );
  }

  return (
    <div className="items-list">
      {items.map(item => (
        <ItemCard key={item.id} item={item} userLocale={user?.locale ?? undefined} />
      ))}
    </div>
  );
};

export default ItemList;
