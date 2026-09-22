import React from 'react';
import { useQuery } from '@tanstack/react-query';
import ItemCard from '../../components/ItemCard';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import Icon from '../../../../components/Icon';
import { itemListQuery } from '../../../../api/queries';
import { useAuth } from '../../../auth';

interface ItemListProps {
  /** Applied to the item name, mirroring the flat view's search. */
  searchQuery: string;
  activeTag: string | null;
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
const ItemList: React.FC<ItemListProps> = ({ searchQuery, activeTag }) => {
  const { user } = useAuth();
  const itemsQuery = useQuery(itemListQuery());

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

  // Array.isArray rather than a null check: an unexpected response shape must
  // render as "nothing to show" rather than throwing out of the dashboard.
  const items = (Array.isArray(itemsQuery.data) ? itemsQuery.data : []).filter(item => {
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    // `item.category` is the wire field for what the UI calls tags (#147).
    const matchesTag = !activeTag || (item.category || '').split(',').map(c => c.trim()).includes(activeTag);
    return matchesSearch && matchesTag;
  });

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
