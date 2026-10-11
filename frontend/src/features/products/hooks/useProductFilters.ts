import { useState, useEffect, useMemo } from 'react';
import { Product } from '../../../types/api';
import {
  SortOption,
  SortOrder,
  StockFilter,
  TrackingFilter,
  SORT_OPTIONS,
  STOCK_FILTER_OPTIONS,
  TRACKING_FILTER_OPTIONS,
  getWebsite,
  readStoredChoice,
  writeStoredChoice,
} from '../pages/dashboard/utils';
import { matchesStockFilter, matchesTrackingFilter } from '../pages/dashboard/filters';

interface UseProductFiltersProps {
  products: Product[];
  /** Tags the user has used before. Read from the profile's wire `categories`. */
  userTags: string[];
}

const SORT_VALUES = SORT_OPTIONS.map(option => option.value);
const TRACKING_VALUES = TRACKING_FILTER_OPTIONS.map(option => option.value);
const STOCK_VALUES = STOCK_FILTER_OPTIONS.map(option => option.value);

/**
 * The storage key for the tracking filter keeps its original `pause` name: the
 * control was renamed, not replaced, and a returning user should not lose the
 * choice they already made (issue #246).
 */
const TRACKING_STORAGE_KEY = 'dashboard_pause_filter';
const STOCK_STORAGE_KEY = 'dashboard_stock_filter';

export function useProductFilters({ products, userTags }: UseProductFiltersProps) {
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('dashboard_search_query') || '';
    } catch {
      return '';
    }
  });
  const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>(() =>
    readStoredChoice(TRACKING_STORAGE_KEY, TRACKING_VALUES, 'all'),
  );
  const [stockFilter, setStockFilter] = useState<StockFilter>(() =>
    readStoredChoice(STOCK_STORAGE_KEY, STOCK_VALUES, 'all'),
  );
  const [sortBy, setSortBy] = useState<SortOption>(() =>
    // Validated rather than cast: 'category' was a sort option before #147 and
    // may still be sitting in a returning user's localStorage, which would
    // leave the select showing nothing.
    readStoredChoice('dashboard_sort_by', SORT_VALUES, 'date_added'),
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(() =>
    readStoredChoice<SortOrder>('dashboard_sort_order', ['asc', 'desc'], 'desc'),
  );
  const [activeTag, setActiveTag] = useState<string | null>(() => {
    try {
      return localStorage.getItem('dashboard_active_tag');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    writeStoredChoice('dashboard_sort_by', sortBy);
  }, [sortBy]);

  useEffect(() => {
    writeStoredChoice('dashboard_sort_order', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    writeStoredChoice('dashboard_search_query', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    writeStoredChoice(TRACKING_STORAGE_KEY, trackingFilter);
  }, [trackingFilter]);

  useEffect(() => {
    writeStoredChoice(STOCK_STORAGE_KEY, stockFilter);
  }, [stockFilter]);

  useEffect(() => {
    try {
      if (activeTag === null) {
        localStorage.removeItem('dashboard_active_tag');
      } else {
        localStorage.setItem('dashboard_active_tag', activeTag);
      }
    } catch {
      /* preference is optional */
    }
  }, [activeTag]);

  // `p.category` is the wire field; everything above this line calls it a tag.
  const tags = useMemo(() => {
    const inUse = new Set<string>();
    products.forEach(p => {
      if (p.category) {
        p.category.split(',').forEach(c => inUse.add(c.trim()));
      }
    });
    return Array.from(inUse).filter(Boolean) as string[];
  }, [products]);

  const formTags = useMemo(() => {
    return Array.from(new Set([...tags, ...userTags])).filter(Boolean) as string[];
  }, [tags, userTags]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    // Search AND tag AND tracking AND stock, each independent of the others.
    result = result.filter(p => matchesTrackingFilter(p, trackingFilter));
    result = result.filter(p => matchesStockFilter(p, stockFilter));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.url.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
      );
    }

    if (activeTag) {
      result = result.filter(p =>
        p.category && p.category.split(',').map(c => c.trim()).includes(activeTag)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date_added':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'tag':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
        case 'price': {
          const priceA = typeof a.current_price === 'string' ? parseFloat(a.current_price) : (a.current_price || 0);
          const priceB = typeof b.current_price === 'string' ? parseFloat(b.current_price) : (b.current_price || 0);
          comparison = priceA - priceB;
          break;
        }
        case 'price_change': {
          const aPct = (a.price_change_7d || 0) / 100;
          const aOld = (a.current_price || 0) / (1 + aPct);
          const aAbs = (a.current_price || 0) - aOld;
          const bPct = (b.price_change_7d || 0) / 100;
          const bOld = (b.current_price || 0) / (1 + bPct);
          const bAbs = (b.current_price || 0) - bOld;
          comparison = aAbs - bAbs;
          break;
        }
        case 'price_change_percent':
          comparison = (a.price_change_7d || 0) - (b.price_change_7d || 0);
          break;
        case 'status':
          comparison = (a.stock_status || '').localeCompare(b.stock_status || '');
          break;
        case 'last_checked':
          comparison = new Date(a.last_checked || 0).getTime() - new Date(b.last_checked || 0).getTime();
          break;
        case 'website':
          comparison = getWebsite(a.url).localeCompare(getWebsite(b.url));
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [products, trackingFilter, stockFilter, searchQuery, activeTag, sortBy, sortOrder]);

  return {
    searchQuery,
    setSearchQuery,
    trackingFilter,
    setTrackingFilter,
    stockFilter,
    setStockFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeTag,
    setActiveTag,
    tags,
    formTags,
    filteredAndSortedProducts,
  };
}
