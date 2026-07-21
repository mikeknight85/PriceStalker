import { useState } from 'react';
import { formatPrice } from '../../../utils/format';
import PriceSelectionModal from '../../products/components/PriceSelectionModal';
import Icon from '../../../components/Icon';

interface ResultDisplayProps {
  state: {
    url: string;
    result: any;
    user: any;
  };
  actions: {
    handleSaveToRetailer: () => void;
    addToSelectors: (type: string, selector: string) => void;
    showToast: (msg: string, type?: "success" | "error" | "info", data?: any) => void;
  };
}

export default function ResultDisplay({ state, actions }: ResultDisplayProps) {
  const { result, user, url } = state;
  const { handleSaveToRetailer, addToSelectors, showToast } = actions;
  
  const [showVotingPreview, setShowVotingPreview] = useState(false);
  const [activeCandidateTab, setActiveCandidateTab] = useState<
    | 'price'
    | 'deal-price'
    | 'member-price'
    | 'original-price'
    | 'pre-order-price'
    | 'name'
    | 'image'
    | 'retailer'
    | 'stock'
  >('price');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const onSave = async () => {
    setIsSavingConfig(true);
    await handleSaveToRetailer();
    setIsSavingConfig(false);
  };

  const getFullDebugUrl = (path: string) => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    return `${apiBase}${path}`;
  };

  if (!result) return null;

  return (
    <div className="results-container fade-in">
      <div className="dashboard-grid">
        {/* Summary Card */}
        <div className="card result-card summary-section">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0 }}><Icon name="package" /> Extraction Results</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => showToast('Full result payload sent to session activity', 'info', result)}
                title="View technical details in activity drawer"
              >
                <Icon name="clipboard" /> LOG
              </button>
              {result.debugFileUrl && (
                <a href={getFullDebugUrl(result.debugFileUrl)} target="_blank" rel="noopener noreferrer" className="download-link" style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                  HTML
                </a>
              )}
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowVotingPreview(true)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
              >
                <Icon name="eye" /> VOTING
              </button>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={onSave}
                disabled={isSavingConfig}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
              >
                {isSavingConfig ? '...' : <><Icon name="save" /> SAVE</>}
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="product-glance" style={{ flexWrap: 'wrap' }}>
              <div className="product-image-frame">
                {result.imageUrl ? <img src={result.imageUrl} alt="" /> : <div className="image-placeholder">No Image</div>}
              </div>
              <div className="product-info">
                <div className="retailer-label">{result.retailerName || 'Generic Extraction'}</div>
                <h2 className="product-name">{result.name || 'Unknown Product Name'}</h2>
                <div className="price-display">
                  {result.price ? formatPrice(result.price.price, result.price.currency, user?.locale) : 'Price Not Found'}
                </div>
                <div className="status-badges">
                  <span className={`badge status-${result.stockStatus}`}>{result.stockStatus.replace('_', ' ')}</span>
                  <span className="badge method-badge">via {result.selectedMethod || 'none'}</span>
                  {result.memberPrice && (
                    <span className="badge status-member" title="Member price detected">
                      Member: {formatPrice(result.memberPrice.price, result.memberPrice.currency, user?.locale)}
                    </span>
                  )}
                  {result.originalPrice && (
                    <span className="badge status-original" title="Original / RRP price detected">
                      Original: {formatPrice(result.originalPrice.price, result.originalPrice.currency, user?.locale)}
                    </span>
                  )}
                  {result.aiStatus && (
                    <span className={`badge status-ai-${result.aiStatus}`} title="AI Verification Status">
                      AI: {result.aiStatus}
                    </span>
                  )}
                  {result.needsReview && (
                    <span className="badge status-needs-review" title="Requires manual configuration verification">
                      <Icon name="alertTriangle" /> Needs Review
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="card result-card candidates-section">
          <div className="card-header" style={{ borderBottom: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}><Icon name="listChecks" /> Candidates</h3>
              
              <div className="tab-buttons">
                <button className={`tab-btn ${activeCandidateTab === 'price' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('price')}>Price</button>
                <button className={`tab-btn ${activeCandidateTab === 'deal-price' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('deal-price')}>Deal</button>
                <button className={`tab-btn ${activeCandidateTab === 'member-price' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('member-price')}>Member</button>
                <button className={`tab-btn ${activeCandidateTab === 'original-price' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('original-price')}>Original</button>
                <button className={`tab-btn ${activeCandidateTab === 'pre-order-price' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('pre-order-price')}>Pre-Order</button>
                <button className={`tab-btn ${activeCandidateTab === 'name' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('name')}>Name</button>
                <button className={`tab-btn ${activeCandidateTab === 'image' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('image')}>Image</button>
                <button className={`tab-btn ${activeCandidateTab === 'retailer' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('retailer')}>Retailer</button>
                <button className={`tab-btn ${activeCandidateTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveCandidateTab('stock')}>Stock</button>
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="workstation-table" style={{ minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Extracted Value</th>
                    <th>Selector / Source</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const isPriceTab = ['price', 'deal-price', 'member-price', 'original-price', 'pre-order-price'].includes(activeCandidateTab);
                    
                    const candidates = 
                      activeCandidateTab === 'price' ? result.priceCandidates?.filter((c: any) => c.method !== 'member-price' && c.method !== 'original-price' && c.method !== 'deal-price' && c.method !== 'pre-order-price') :
                      activeCandidateTab === 'deal-price' ? result.priceCandidates?.filter((c: any) => c.method === 'deal-price') :
                      activeCandidateTab === 'member-price' ? result.priceCandidates?.filter((c: any) => c.method === 'member-price') :
                      activeCandidateTab === 'original-price' ? result.priceCandidates?.filter((c: any) => c.method === 'original-price') :
                      activeCandidateTab === 'pre-order-price' ? result.priceCandidates?.filter((c: any) => c.method === 'pre-order-price') :
                      activeCandidateTab === 'name' ? result.nameCandidates :
                      activeCandidateTab === 'image' ? result.imageCandidates :
                      activeCandidateTab === 'retailer' ? result.retailerNameCandidates :
                      result.stockCandidates;
                    
                    const winnerValue = 
                      activeCandidateTab === 'price' ? result.price?.price :
                      activeCandidateTab === 'deal-price' ? result.price?.price :
                      activeCandidateTab === 'member-price' ? result.memberPrice?.price :
                      activeCandidateTab === 'original-price' ? result.originalPrice?.price :
                      activeCandidateTab === 'pre-order-price' ? result.price?.price :
                      activeCandidateTab === 'name' ? result.name :
                      activeCandidateTab === 'image' ? result.imageUrl :
                      activeCandidateTab === 'retailer' ? result.retailerName :
                      result.stockStatus;

                    if (!candidates || candidates.length === 0) {
                      return <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No candidates found for this field</td></tr>;
                    }

                    return candidates.map((c: any, i: number) => (
                      <tr key={i} className={String(c.value) === String(winnerValue) || (isPriceTab && c.price === winnerValue) ? 'winner' : ''}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span className="method-tag">{c.method}</span>
                            {c.selector && (
                              <button 
                                className="mini-action-btn" 
                                onClick={() => addToSelectors(activeCandidateTab, c.selector)}
                                style={{ width: 'fit-content' }}
                              >
                                + Use Selector
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="price-val">
                          {activeCandidateTab === 'image' && typeof c.value === 'string' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <img src={c.value} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                              <small style={{ fontSize: '0.6rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.value}</small>
                            </div>
                          ) : isPriceTab ? (
                            formatPrice(c.price, c.currency, user?.locale)
                          ) : (
                            String(c.value || '-')
                          )}
                        </td>
                        <td className="selector-val"><code>{c.selector || '-'}</code></td>
                        <td className="context-val">{(c.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <PriceSelectionModal
        isOpen={showVotingPreview}
        onClose={() => setShowVotingPreview(false)}
        onSelect={() => {
          setShowVotingPreview(false);
        }}
        productName={result?.name || null}
        imageUrl={result?.imageUrl || null}
        candidates={result?.priceCandidates || []}
        url={url}
      />
    </div>
  );
}
