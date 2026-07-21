import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../auth';
import { formatPrice } from '../../../../utils/format';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import './PriceSelectionModal.css';
import Icon from '../../../../components/Icon';

export interface PriceCandidate {
  price: number;
  currency: string;
  method: string;
  context?: string;
  confidence: number;
  selector?: string;
}

interface PriceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (price: number, method: string, currency: string, category: string | null, selector?: string) => void;
  productName: string | null;
  imageUrl: string | null;
  candidates: PriceCandidate[];
  url: string;
  category?: string | null;
  reviewReason?: string;
}

const METHOD_LABELS: Record<string, string> = {
  'json-ld': 'Structured Data',
  'site-specific': 'Site Scraper',
  'generic-css': 'CSS Selector',
  'ai': 'AI Extraction',
  'member-price': 'Member Price',
  'deal-price': 'Limited Deal',
  'original-price': 'Original Price / RRP',
  'pre-order-price': 'Pre-order Price',
};

const METHOD_DESCRIPTIONS: Record<string, string> = {
  'json-ld': 'Found in page metadata (schema.org)',
  'site-specific': 'Extracted using site-specific rules',
  'generic-css': 'Found using general price selectors',
  'ai': 'Detected by AI analysis',
  'member-price': 'Price available to members/subscribers',
  'deal-price': 'Promotional or limited-time deal',
  'original-price': 'Original list price or MSRP / RRP',
  'pre-order-price': 'Price for item currently in pre-order',
};

const METHOD_TIERS: Record<string, number> = {
  'deal-price': 1,
  'member-price': 1,
  'pre-order-price': 1,
  'original-price': 1,
  'custom-css': 2,
  'custom-regex': 2,
  'json-ld': 3,
  'ai': 4,
  'standard-css': 4,
  'generic-css': 5,
};

const REVIEW_REASON_COPY: Record<string, string> = {
  no_consensus: 'Our scrapers found multiple conflicting prices. Please confirm the correct price.',
  ai_correction: 'Our AI suggested a different price from the raw layout. Please review and confirm.',
  oos_guardrail: 'This item appears to be out of stock. Please confirm the last known price.',
  manual_rescan: 'You requested a manual re-scan. Please verify the current price.',
  first_scan: 'This is the first scan for this product. Please select the correct price to track.',
};

type PriceTypeFilter = 'all' | 'standard' | 'deal' | 'member' | 'rrp';

const FILTER_METHODS: Record<PriceTypeFilter, string[]> = {
  all: [],
  standard: ['custom-css', 'json-ld', 'standard-css', 'generic-css', 'ai', 'site-specific'],
  deal: ['deal-price'],
  member: ['member-price'],
  rrp: ['original-price', 'pre-order-price'],
};

const PriceSelectionModal: React.FC<PriceSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  productName,
  imageUrl,
  candidates,
  url,
  category,
  reviewReason,
}) => {
  const { user } = useAuth();

  const [activeFilter, setActiveFilter] = useState<PriceTypeFilter>('all');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [manualCurrency, setManualCurrency] = useState('AUD');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Method tier + confidence hybrid sort and (price, tier) deduplication
  const uniqueCandidates = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => {
      const tierA = METHOD_TIERS[a.method] ?? 99;
      const tierB = METHOD_TIERS[b.method] ?? 99;
      if (tierA !== tierB) return tierA - tierB;
      return b.confidence - a.confidence;
    });

    const result: PriceCandidate[] = [];
    const seen = new Set<string>();
    for (const c of sorted) {
      const tier = METHOD_TIERS[c.method] ?? 99;
      const key = `${c.price.toFixed(2)}_${tier}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }
    return result;
  }, [candidates]);

  // Zone A: Price Context summary extraction
  const priceContext = useMemo(() => {
    const types = ['deal-price', 'member-price', 'original-price'];
    return types.reduce((acc, method) => {
      const match = candidates.find(c => c.method === method);
      if (match) acc[method] = match;
      return acc;
    }, {} as Record<string, PriceCandidate>);
  }, [candidates]);

  // Filter candidates list dynamically by pill-tabs
  const filteredCandidates = useMemo(() => {
    if (activeFilter === 'all') return uniqueCandidates;
    const allowed = FILTER_METHODS[activeFilter];
    return uniqueCandidates.filter(c => allowed.includes(c.method));
  }, [uniqueCandidates, activeFilter]);

  // Track selection index in the active filtered list
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);

  // Handle selected candidate state syncing
  React.useEffect(() => {
    setSelectedIndex(filteredCandidates.length > 0 ? 0 : null);
    setWarningMessage(null);
  }, [filteredCandidates]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (showManualEntry) {
      const parsed = parseFloat(manualPrice);
      if (isNaN(parsed) || parsed <= 0) {
        setWarningMessage('Please enter a valid price greater than $0.00.');
        return;
      }
      setIsSubmitting(true);
      try {
        await onSelect(parsed, 'manual', manualCurrency, category || null);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (selectedIndex === null || selectedIndex < 0 || isSubmitting) return;
    const selected = filteredCandidates[selectedIndex];

    // Submission warnings for low confidence
    if (selected.confidence < 0.3 && !warningMessage) {
      setWarningMessage('Warning: This candidate has low extraction confidence. Confirm if correct.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSelect(selected.price, selected.method, selected.currency, category || null, selected.selector);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#6b7280';
  };

  // Determine if specific tabs should be displayed
  const availableTabs = (['all', 'standard', 'deal', 'member', 'rrp'] as PriceTypeFilter[]).filter(tab => {
    if (tab === 'all') return true;
    const allowed = FILTER_METHODS[tab];
    return uniqueCandidates.some(c => allowed.includes(c.method));
  });

  return (
    <div className="price-modal-overlay">
      <div className="price-modal">
        <div className="price-modal-header">
          <h2 className="price-modal-title">
            {uniqueCandidates.length > 1 ? 'Multiple Prices Found' : 'Confirm Price'}
          </h2>
          <p className="price-modal-subtitle">
            {reviewReason && REVIEW_REASON_COPY[reviewReason]
              ? REVIEW_REASON_COPY[reviewReason]
              : uniqueCandidates.length > 1
                ? 'We found different prices for this product. Please select the correct one.'
                : 'Please verify this is the correct price for the product.'}
          </p>
        </div>

        {/* Zone A: Price Context Panel */}
        {Object.keys(priceContext).length > 0 && (
          <div className="price-context-panel">
            {priceContext['deal-price'] && (
              <div className="price-context-item deal">
                <span className="price-context-item-label">Limited Deal</span>
                <span className="price-context-item-price">
                  {formatPrice(priceContext['deal-price'].price, priceContext['deal-price'].currency, user?.locale)}
                </span>
              </div>
            )}
            {priceContext['member-price'] && (
              <div className="price-context-item member">
                <span className="price-context-item-label">Member Price</span>
                <span className="price-context-item-price">
                  {formatPrice(priceContext['member-price'].price, priceContext['member-price'].currency, user?.locale)}
                </span>
              </div>
            )}
            {priceContext['original-price'] && (
              <div className="price-context-item rrp">
                <span className="price-context-item-label">Original RRP</span>
                <span className="price-context-item-price">
                  {formatPrice(priceContext['original-price'].price, priceContext['original-price'].currency, user?.locale)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="price-modal-product">
          {imageUrl && (
            <img src={imageUrl} alt="" className="price-modal-product-image" />
          )}
          <div className="price-modal-product-info">
            <p className="price-modal-product-name">{productName || 'Unknown Product'}</p>
            <p className="price-modal-product-url">{url}</p>
          </div>
        </div>

        {/* Warning Banner */}
        {warningMessage && (
          <div className="warning-banner">
            <Icon name="alertTriangle" /> {warningMessage}
          </div>
        )}

        {/* Zone B: Type Filter Tab Pills */}
        {!showManualEntry && availableTabs.length > 1 && (
          <div className="price-filter-tabs">
            {availableTabs.map(tab => (
              <button
                key={tab}
                className={`price-filter-tab ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => setActiveFilter(tab)}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="price-modal-body">
          {showManualEntry ? (
            <div className="manual-entry-container">
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>
                Enter product price to track manually:
              </p>
              <div className="manual-entry-row">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="manual-entry-input"
                  placeholder="e.g. 99.99"
                  value={manualPrice}
                  onChange={(e) => {
                    setManualPrice(e.target.value);
                    setWarningMessage(null);
                  }}
                />
                <select
                  className="manual-entry-select"
                  value={manualCurrency}
                  onChange={(e) => setManualCurrency(e.target.value)}
                >
                  <option value="AUD">AUD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="NZD">NZD</option>
                </select>
              </div>
              <button
                className="manual-entry-link"
                style={{ textAlign: 'left', marginTop: '0.25rem' }}
                onClick={() => {
                  setShowManualEntry(false);
                  setWarningMessage(null);
                }}
              >
                ← Back to candidates list
              </button>
            </div>
          ) : (
            <div className="price-candidates-list">
              {filteredCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No candidates found for this price type filter.
                </div>
              ) : (
                filteredCandidates.map((candidate, index) => (
                  <div
                    key={index}
                    className={`price-candidate ${selectedIndex === index ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedIndex(index);
                      setWarningMessage(null);
                    }}
                  >
                    <div className="price-candidate-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="price-candidate-header">
                      <span className="price-candidate-price">
                        {formatPrice(candidate.price, candidate.currency, user?.locale)}
                      </span>
                      <span
                        className="price-candidate-confidence"
                        style={{ color: getConfidenceColor(candidate.confidence) }}
                      >
                        {getConfidenceLabel(candidate.confidence)} confidence
                      </span>
                    </div>
                    <div className="price-candidate-method">
                      {METHOD_LABELS[candidate.method] || candidate.method}
                    </div>
                    <div className="price-candidate-context">
                      {candidate.context || METHOD_DESCRIPTIONS[candidate.method] || 'No additional context'}
                    </div>
                    {candidate.selector && (
                      <div className="candidate-selector-wrapper">
                        <code className="candidate-selector" title={candidate.selector}>
                          {candidate.selector.length > 55
                            ? candidate.selector.substring(0, 55) + '…'
                            : candidate.selector}
                        </code>
                      </div>
                    )}
                  </div>
                ))
              )}

              <button className="manual-entry-link" onClick={() => {
                setShowManualEntry(true);
                setWarningMessage(null);
              }}>
                None of these look right — enter price manually
              </button>
            </div>
          )}
        </div>

        <div className="price-modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={(!showManualEntry && selectedIndex === null) || isSubmitting}
          >
            {isSubmitting ? <LoadingSpinner size="1rem" /> : 'Confirm Selection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceSelectionModal;
