import React, { useState, useEffect, FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { ProductService } from '../../services/ProductService';
import { SearchResult } from '../../../../types/api';
import './ProductForm.css';

interface ProductFormProps {
  onSubmit: (url: string, refreshInterval: number, category: string) => Promise<void | boolean>;
  availableCategories?: string[];
}

import { REFRESH_INTERVALS } from '../../constants';
import Icon from '../../../../components/Icon';

const ProductForm: React.FC<ProductFormProps> = ({ onSubmit, availableCategories }) => {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'url' | 'search'>('url');
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(43200);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ReactNode>('');

  useEffect(() => {
    ProductService.getSearchStatus()
      .then(res => setIsSearchEnabled(res.data.enabled))
      .catch(() => setIsSearchEnabled(false));
  }, []);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');
    try {
      const res = await ProductService.search(searchQuery);
      setSearchResults(res.data);
    } catch (err: any) {
      setError('Search failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTag = (e?: React.KeyboardEvent | React.FocusEvent) => {
    if (e && 'key' in e && e.key !== 'Enter' && e.key !== ',') return;
    if (e) e.preventDefault();

    const val = tagInput.trim().replace(/,$/, '');
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
      setTagInput('');
    } else {
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    let processedUrl = url.trim();

    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = 'https://' + processedUrl;
    }

    setIsLoading(true);

    try {
      const finalTags = [...tags];
      if (tagInput.trim()) {
        const val = tagInput.trim().replace(/,$/, '');
        if (val && !finalTags.includes(val)) finalTags.push(val);
      }
      
      const categoryString = finalTags.join(', ');
      
      const result = await onSubmit(processedUrl, refreshInterval, categoryString);
      
      if (result !== false) {
        setUrl('');
        setTags([]);
        setTagInput('');
        setRefreshInterval(43200);
      }
    } catch (err) {
      if (err instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const axiosError = err as any;
        const status = axiosError.response?.status;
        const serverError = axiosError.response?.data?.error;
        const message = axiosError.response?.data?.message;

        if (status === 409) {
          const id = axiosError.response?.data?.existingProductId;
          setError(
            <span>
              {message || 'You are already tracking this product.'}{' '}
              <Link to={`/?product=${id}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                Click here to view it.
              </Link>
            </span>
          );
        } else if (status === 403) {
          setError('Access Denied: The retailer is blocking our scraper. Try enabling the Remote Scraper or a Proxy for this site in Retailer Settings.');
        } else if (status === 400) {
          setError(serverError || 'Scraping Failed: We could not find a price on this page. Check your selectors in Retailer Settings.');
        } else if (status === 500) {
          setError('Server Error: Something went wrong on the backend. Please check the logs.');
        } else {
          setError(serverError || 'Failed to add product. Please try again.');
        }
      } else {
        setError('Failed to add product');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="product-form">
      <h2>Track a New Product</h2>
      
      {isSearchEnabled && (
        <div className="mode-switch mb-4">
          <button 
            type="button"
            className={`mode-switch-btn ${mode === 'url' ? 'active' : ''}`}
            onClick={() => setMode('url')}
          >
            <Icon name="link" /> Direct URL
          </button>
          <button 
            type="button"
            className={`mode-switch-btn ${mode === 'search' ? 'active' : ''}`}
            onClick={() => setMode('search')}
          >
            <Icon name="search" /> Product Search
          </button>
        </div>
      )}

      {mode === 'url' ? (
        <>
          <p className="text-muted mb-4" style={{ fontSize: '0.875rem', marginTop: '-0.5rem' }}>
            Enter the URL of the product you want to track. We'll automatically fetch the price and notify you of any drops.
          </p>

          {error && <div className="alert alert-error mb-3">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group mb-4">
              <label htmlFor="product-url">Product URL</label>
              <input
                type="url"
                id="product-url"
                className="form-control"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.example.com/product"
                required
                style={{ width: '100%' }}
              />
            </div>

            <div className="product-form-row">
              <div className="form-group" style={{ margin: 0 }}>
                <label>Category (optional)</label>
                <div className="category-tag-field">
                  {tags.map(tag => (
                    <span key={tag} className="tag-pill">
                      {tag}
                      <button type="button" className="tag-close" onClick={() => removeTag(tag)}>×</button>
                    </span>
                  ))}
                  <input
                    className="tag-input"
                    list="form-existing-categories"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    onBlur={() => handleAddTag()}
                    placeholder={tags.length === 0 ? "e.g. Tech, Home" : "Add..."}
                  />
                  <datalist id="form-existing-categories">
                    {(availableCategories || []).map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="refresh-interval">Check Every</label>
                <select
                  id="refresh-interval"
                  className="form-control"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
                  style={{ height: '46px' }}
                >
                  {REFRESH_INTERVALS.map((interval) => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ height: '46px' }}
              >
                {isLoading ? <LoadingSpinner size="1rem" /> : 'Add Product'}
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="search-mode-container">
          <p className="text-muted mb-4" style={{ fontSize: '0.875rem', marginTop: '-0.5rem' }}>
            Search for products by name across supported and external retailers.
          </p>

          {error && <div className="alert alert-error mb-3">{error}</div>}

          <form onSubmit={handleSearch} className="search-form mb-4">
            <div className="search-input-group">
              <input
                type="text"
                className="form-control search-input-field"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name, model or brand..."
                required
                autoFocus
              />
              <button type="submit" className="btn btn-primary search-submit-btn" disabled={isSearching}>
                {isSearching ? <LoadingSpinner size="1rem" /> : 'Search'}
              </button>
            </div>
          </form>

          {searchResults.length > 0 ? (
            <div className="search-results-list">
              {searchResults.map((result, idx) => (
                <div key={idx} className="search-result-item">
                  <div className="result-main">
                    <h3 className="result-title">{result.title}</h3>
                    <div className="result-meta">
                      <span className="result-domain">{result.domain}</span>
                      {result.isSupported ? (
                        <span className="badge status-in_stock ml-2" style={{ fontSize: '0.6rem' }}>Supported</span>
                      ) : (
                        <span className="badge method-badge ml-2" style={{ fontSize: '0.6rem' }}>Generic</span>
                      )}
                    </div>
                    <p className="result-content">{result.content}</p>
                  </div>
                  <div className="result-actions">
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setUrl(result.url);
                        setMode('url');
                      }}
                    >
                      Track this
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : !isSearching && searchQuery && (
            <div className="empty-search-state">
              <p>No results found. Try a different query or use a direct URL.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductForm;
