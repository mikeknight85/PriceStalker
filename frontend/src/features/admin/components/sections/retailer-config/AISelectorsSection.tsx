import UnifiedSelectorManager from '../../UnifiedSelectorManager';

interface AISelectorsSectionProps {
  draftAiPriceSelectors: string[];
  setDraftAiPriceSelectors: (selectors: string[]) => void;
  draftAiImageSelectors: string[];
  setDraftAiImageSelectors: (selectors: string[]) => void;
}

export default function AISelectorsSection({
  draftAiPriceSelectors,
  setDraftAiPriceSelectors,
  draftAiImageSelectors,
  setDraftAiImageSelectors
}: AISelectorsSectionProps) {
  return (
    <div className="extraction-params-section">
      <div className="form-grid">
        <div className="settings-card" style={{ padding: '1rem', background: 'var(--surface)', marginBottom: 0 }}>
          <h4 className="mb-3">AI Price Preprocessor</h4>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Configures high-signal element classes parsed by the preprocessor before prompting Gemini for prices.
          </div>
          <UnifiedSelectorManager 
            label="AI Price Selectors" 
            items={draftAiPriceSelectors} 
            onChange={setDraftAiPriceSelectors} 
            placeholder="[class*='price' i], [data-price]" 
          />
        </div>

        <div className="settings-card" style={{ padding: '1rem', background: 'var(--surface)', marginBottom: 0 }}>
          <h4 className="mb-3">AI Image Preprocessor</h4>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Configures image element tags harvested by the preprocessor before sending hero image candidates.
          </div>
          <UnifiedSelectorManager 
            label="AI Image Selectors" 
            items={draftAiImageSelectors} 
            onChange={setDraftAiImageSelectors} 
            placeholder="img.hero-image, img.main-image" 
          />
        </div>
      </div>
    </div>
  );
}
