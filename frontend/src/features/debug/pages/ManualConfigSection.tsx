import { useState } from 'react';
import { UnifiedSelectorManager } from '../../admin/components';

interface ManualConfigSectionProps {
  state: {
    tempPriceSelectors: string[]; setTempPriceSelectors: (v: string[]) => void;
    tempDealPriceSelectors: string[]; setTempDealPriceSelectors: (v: string[]) => void;
    tempMemberPriceSelectors: string[]; setTempMemberPriceSelectors: (v: string[]) => void;
    tempNameSelectors: string[]; setTempNameSelectors: (v: string[]) => void;
    tempRetailerNameSelectors: string[]; setTempRetailerNameSelectors: (v: string[]) => void;
    tempImageSelectors: string[]; setTempImageSelectors: (v: string[]) => void;
    tempStockSelectors: string[]; setTempStockSelectors: (v: string[]) => void;
    tempExclusionSelectors: string[]; setTempExclusionSelectors: (v: string[]) => void;
  };
}

type ConfigField = 'price_standard' | 'price_deal' | 'price_member' | 'name' | 'retailer' | 'image' | 'stock' | 'exclusion';

export default function ManualConfigSection({ state }: ManualConfigSectionProps) {
  const [activeField, setActiveField] = useState<ConfigField>('price_standard');

  const {
    tempPriceSelectors, setTempPriceSelectors,
    tempDealPriceSelectors, setTempDealPriceSelectors,
    tempMemberPriceSelectors, setTempMemberPriceSelectors,
    tempNameSelectors, setTempNameSelectors,
    tempRetailerNameSelectors, setTempRetailerNameSelectors,
    tempImageSelectors, setTempImageSelectors,
    tempStockSelectors, setTempStockSelectors,
    tempExclusionSelectors, setTempExclusionSelectors
  } = state;

  return (
    <div className="manual-config-section mt-4">
      <div className="form-group mb-3">
        <label className="section-label">Configure Selectors</label>
        <select 
          className="form-control workstation-input" 
          value={activeField} 
          onChange={(e) => setActiveField(e.target.value as ConfigField)}
          style={{ marginBottom: '1rem' }}
          title="Select a category to manage custom selectors"
        >
          <optgroup label="Price Selectors">
            <option value="price_standard">Standard Price</option>
            <option value="price_deal">Deal Price (Highest Priority)</option>
            <option value="price_member">Member Price</option>
          </optgroup>
          <optgroup label="Metadata">
            <option value="name">Product Title</option>
            <option value="retailer">Retailer Name</option>
            <option value="image">Product Image</option>
          </optgroup>
          <optgroup label="Availability">
            <option value="stock">Stock Status</option>
          </optgroup>
          <optgroup label="Noise Control">
            <option value="exclusion">Exclusion Selectors (Pruning)</option>
          </optgroup>
        </select>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem', paddingLeft: '0.25rem' }}>
          💡 Tip: Click elements in the <strong>Interactive Inspector</strong> to pull selectors.
        </div>
      </div>

      <div className="active-selector-manager fade-in" key={activeField}>
        {activeField === 'price_standard' && (
          <div>
            <UnifiedSelectorManager label="Standard Price" items={tempPriceSelectors} onChange={setTempPriceSelectors} placeholder=".price" />
            <small className="d-block mt-1 text-muted" style={{ fontSize: '0.7rem' }}>Standard CSS or <code>xpath://...</code> to extract the main price.</small>
          </div>
        )}
        {activeField === 'price_deal' && (
          <div>
            <UnifiedSelectorManager label="Deal Price" items={tempDealPriceSelectors} onChange={setTempDealPriceSelectors} placeholder=".sale-price" />
            <small className="d-block mt-1 text-muted" style={{ fontSize: '0.7rem' }}>Higher priority than standard price. Automatically preferred in consensus.</small>
          </div>
        )}
        {activeField === 'price_member' && (
          <UnifiedSelectorManager label="Member Price" items={tempMemberPriceSelectors} onChange={setTempMemberPriceSelectors} placeholder=".member-only" />
        )}
        {activeField === 'name' && (
          <UnifiedSelectorManager label="Product Title" items={tempNameSelectors} onChange={setTempNameSelectors} placeholder="h1" />
        )}
        {activeField === 'retailer' && (
          <UnifiedSelectorManager label="Retailer Name" items={tempRetailerNameSelectors} onChange={setTempRetailerNameSelectors} placeholder="meta[property='og:site_name']" />
        )}
        {activeField === 'image' && (
          <UnifiedSelectorManager label="Product Image" items={tempImageSelectors} onChange={setTempImageSelectors} placeholder="img::attr(src)" />
        )}
        {activeField === 'stock' && (
          <div>
            <UnifiedSelectorManager label="Stock Status" items={tempStockSelectors} onChange={setTempStockSelectors} placeholder=".availability" />
            <small className="d-block mt-1 text-muted" style={{ fontSize: '0.7rem' }}>Use <code>::equals(Out of Stock)-&gt;out_of_stock</code> for deterministic mapping.</small>
          </div>
        )}
        {activeField === 'exclusion' && (
          <div>
            <UnifiedSelectorManager label="Exclusion Selectors" items={tempExclusionSelectors} onChange={setTempExclusionSelectors} placeholder=".ad-container, .carousel" />
            <small className="d-block mt-1 text-muted" style={{ fontSize: '0.7rem' }}>Elements matched here are deleted <strong>before</strong> extraction to remove noise.</small>
          </div>
        )}
      </div>
    </div>
  );
}
