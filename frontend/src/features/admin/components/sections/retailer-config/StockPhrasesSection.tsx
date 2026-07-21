import { UnifiedSelectorManager } from '../../index';

interface StockPhrasesSectionProps {
  stockSelectors: string[];
  setStockSelectors: (s: string[]) => void;
  inStockPhrases: string[];
  setInStockPhrases: (s: string[]) => void;
  outOfStockPhrases: string[];
  setOutOfStockPhrases: (s: string[]) => void;
  preOrderPhrases: string[];
  setPreOrderPhrases: (s: string[]) => void;
}

export default function StockPhrasesSection({
  stockSelectors,
  setStockSelectors,
  inStockPhrases,
  setInStockPhrases,
  outOfStockPhrases,
  setOutOfStockPhrases,
  preOrderPhrases,
  setPreOrderPhrases
}: StockPhrasesSectionProps) {
  return (
    <div className="stock-phrases-section">
      <div className="form-grid">
        <div className="settings-card" style={{ padding: '1rem', background: 'var(--surface)', marginBottom: 0 }}>
          <h4 className="mb-3">Status Extraction</h4>
          <UnifiedSelectorManager 
            label="Stock Status Selectors" 
            items={stockSelectors} 
            onChange={setStockSelectors} 
            placeholder=".availability, .stock-status" 
          />
        </div>

        <div className="settings-card" style={{ padding: '1rem', background: 'var(--surface)', marginBottom: 0 }}>
          <h4 className="mb-3">Detection Phrases</h4>
          <UnifiedSelectorManager 
            label="In-Stock Phrases" 
            items={inStockPhrases} 
            onChange={setInStockPhrases} 
            placeholder="In Stock, Available" 
          />
          <UnifiedSelectorManager 
            label="Out-of-Stock Phrases" 
            items={outOfStockPhrases} 
            onChange={setOutOfStockPhrases} 
            placeholder="Out of Stock, Sold Out" 
          />
          <UnifiedSelectorManager 
            label="Pre-Order Phrases" 
            items={preOrderPhrases} 
            onChange={setPreOrderPhrases} 
            placeholder="Pre-Order, Coming Soon" 
          />
        </div>
      </div>
    </div>
  );
}
