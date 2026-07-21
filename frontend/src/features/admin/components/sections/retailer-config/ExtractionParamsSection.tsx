import { RetailerConfig } from '../../../../../types/api';
import { UnifiedSelectorManager } from '../../index';
import Icon from '../../../../../components/Icon';

interface ExtractionParamsSectionProps {
  draftConfig: Partial<RetailerConfig>;
  onUpdateConfig: (updates: Partial<RetailerConfig>) => void;
  titleSelectors: string[];
  setTitleSelectors: (s: string[]) => void;
  retailerNameSelectors: string[];
  setRetailerNameSelectors: (s: string[]) => void;
  priceSelectors: string[];
  setPriceSelectors: (s: string[]) => void;
  dealPriceSelectors: string[];
  setDealPriceSelectors: (s: string[]) => void;
  memberPriceSelectors: string[];
  setMemberPriceSelectors: (s: string[]) => void;
  preOrderPriceSelectors: string[];
  setPreOrderPriceSelectors: (s: string[]) => void;
  imageSelectors: string[];
  setImageSelectors: (s: string[]) => void;
  exclusionSelectors: string[];
  setExclusionSelectors: (s: string[]) => void;
  customSelectorsJson: string;
  setCustomSelectorsJson: (s: string) => void;
}

export default function ExtractionParamsSection({
  draftConfig,
  onUpdateConfig,
  titleSelectors,
  setTitleSelectors,
  retailerNameSelectors,
  setRetailerNameSelectors,
  priceSelectors,
  setPriceSelectors,
  dealPriceSelectors,
  setDealPriceSelectors,
  memberPriceSelectors,
  setMemberPriceSelectors,
  preOrderPriceSelectors,
  setPreOrderPriceSelectors,
  imageSelectors,
  setImageSelectors,
  exclusionSelectors,
  setExclusionSelectors,
  customSelectorsJson,
  setCustomSelectorsJson
}: ExtractionParamsSectionProps) {
  return (
    <div className="extraction-params-section">
      <div className="form-grid">
        <div className="settings-card" style={{ padding: '1rem', background: 'var(--surface)', marginBottom: 0 }}>
          <h4 className="mb-3">Metadata</h4>
          <UnifiedSelectorManager 
            label="Product Title" 
            items={titleSelectors} 
            onChange={setTitleSelectors} 
            placeholder=".product-title, h1" 
          />
          <UnifiedSelectorManager 
            label="Retailer Brand Name" 
            items={retailerNameSelectors} 
            onChange={setRetailerNameSelectors} 
            placeholder=".retailer-name, meta[property='og:site_name']" 
          />
          <div className="form-group mt-2">
            <label>JSON-LD Name Key (Title)</label>
            <input 
              type="text" 
              className="form-control" 
              value={draftConfig.jsonld_name_key || ''} 
              onChange={e => onUpdateConfig({ jsonld_name_key: e.target.value })} 
            />
          </div>
          <hr style={{ margin: '1rem 0', opacity: 0.1 }} />
          <UnifiedSelectorManager 
            label="Product Image" 
            items={imageSelectors} 
            onChange={setImageSelectors} 
            placeholder=".product-image img, #main-img" 
          />
          <div className="form-group mt-2">
            <label>JSON-LD Image Key</label>
            <input 
              type="text" 
              className="form-control" 
              value={draftConfig.jsonld_image_key || ''} 
              onChange={e => onUpdateConfig({ jsonld_image_key: e.target.value })} 
            />
          </div>
        </div>

        <div className="settings-card" style={{ padding: '1rem', background: 'var(--surface)', marginBottom: 0 }}>
          <h4 className="mb-3">Pricing Strategy</h4>
          <UnifiedSelectorManager 
            label="Standard Price" 
            items={priceSelectors} 
            onChange={setPriceSelectors} 
            placeholder=".price-value, #price" 
          />
          <UnifiedSelectorManager 
            label="Deal/Sale" 
            items={dealPriceSelectors} 
            onChange={setDealPriceSelectors} 
            placeholder=".sale-price" 
          />
          <UnifiedSelectorManager 
            label="Member Exclusive" 
            items={memberPriceSelectors} 
            onChange={setMemberPriceSelectors} 
            placeholder=".member-price-text" 
          />
          <UnifiedSelectorManager 
            label="Pre-Order Price" 
            items={preOrderPriceSelectors} 
            onChange={setPreOrderPriceSelectors} 
            placeholder=".preorder-price" 
          />
          <div className="form-group mt-2">
            <label>JSON-LD Price Key</label>
            <input 
              type="text" 
              className="form-control" 
              value={draftConfig.jsonld_price_key || ''} 
              onChange={e => onUpdateConfig({ jsonld_price_key: e.target.value })} 
            />
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
        <h4 className="mb-2"><Icon name="ban" /> Structural Pruning (Exclusions)</h4>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Elements matching these selectors will be completely removed from the DOM before any extraction logic runs. Use this to strip noisy carousels, ads, or recommended products that might contain false-positive prices.
        </div>
        <UnifiedSelectorManager 
          label="Exclusion Selectors" 
          items={exclusionSelectors} 
          onChange={setExclusionSelectors} 
          placeholder=".carousel, .recommended-products, aside" 
        />
      </div>
      
      <div className="form-group mt-4">
        <label>Advanced Selectors (JSON)</label>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Override default scraper behavior with raw selector JSON configurations.
        </div>
        <textarea 
          className="form-control" 
          style={{ fontFamily: 'monospace', fontSize: '0.8rem', height: '100px' }}
          value={customSelectorsJson}
          onChange={e => setCustomSelectorsJson(e.target.value)}
          placeholder='{ "custom_price": ".my-price" }'
        />
      </div>
    </div>
  );
}
