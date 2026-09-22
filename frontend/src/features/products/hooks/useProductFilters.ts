import { useState, useEffect, useMemo } from 'react';
import { Product } from '../../../types/api';
import { SortOption, SortOrder, PauseFilter, SORT_OPTIONS, getWebsite } from '../pages/dashboard/utils';

interface UseProductFiltersProps {
  products: Product[];
  /** Tags the user has used before. Read from the profile's wire `categories`. */
  userTags: string[];
}

export function useProductFilters({ products, userTags }: UseProductFiltersProps) {
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('dashboard_search_query') || '';
  });
  const [pauseFilter, setPauseFilter] = useState<PauseFilter>(() => {
    const saved = localStorage.getItem('dashboard_pause_filter');
    return (saved as PauseFilter) || 'all';
  });
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    // Validated rather than cast: 'category' was a sort option before #147 and
    // may still be sitting in a returning user's localStorage, which would
    // leave the select showing nothing.
    const saved = localStorage.getItem('dashboard_sort_by');
    return SORT_OPTIONS.some(option => option.value === saved) ? (saved as SortOption) : 'date_added';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = localStorage.getItem('dashboard_sort_order');
    return (saved as SortOrder) || 'desc';
  });
  const [activeTag, setActiveTag] = useState<string | null>(() => {
    return localStorage.getItem('dashboard_active_tag');
  });

  useEffect(() => {
    localStorage.setItem('dashboard_sort_by', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('dashboard_sort_order', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('dashboard_search_query', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('dashboard_pause_filter', pauseFilter);
  }, [pauseFilter]);

  useEffect(() => {
    if (activeTag === null) {
      localStorage.removeItem('dashboard_active_tag');
    } else {
      localStorage.setItem('dashboard_active_tag', activeTag);
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

    if (pauseFilter === 'active') {
      result = result.filter(p => (p.checking_paused as any) === false || (p.checking_paused as any) === 0 || p.checking_paused === undefined || p.checking_paused === null);
    } else if (pauseFilter === 'paused') {
      result = result.filter(p => (p.checking_paused as any) === true || (p.checking_paused as any) === 1);
    }

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
  }, [products, pauseFilter, searchQuery, activeTag, sortBy, sortOrder]);

  return {
    searchQuery,
    setSearchQuery,
    pauseFilter,
    setPauseFilter,
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
