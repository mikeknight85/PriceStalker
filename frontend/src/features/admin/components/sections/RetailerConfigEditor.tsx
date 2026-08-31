import { useState, useEffect } from 'react';
import { RetailerConfig, GlobalCurrency } from '../../../../types/api';
import { useToast } from '../../../../context/ToastContext';
import { RetailerAdminService } from '../../services/RetailerAdminService';
import { useAuth } from '../../../auth';
import { useAsyncAction } from '../../../../hooks/useAsyncAction';
import { 
  FieldHelp,
  SettingsCacheNotice,
  CollapsibleCard, 
  ToggleSwitch
} from '../../components';
import SearchableSelect from '../../../../components/SearchableSelect';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import { apiErrorMessage } from '../../../../api/error';

// Sub-sections
import ScraperEngineSection from './retailer-config/ScraperEngineSection';
import ExtractionParamsSection from './retailer-config/ExtractionParamsSection';
import StockPhrasesSection from './retailer-config/StockPhrasesSection';
import ScrapeValidationHub from './retailer-config/ScrapeValidationHub';
import AISelectorsSection from './retailer-config/AISelectorsSection';
import Icon from '../../../../components/Icon';

interface RetailerConfigEditorProps {
  initialRetailer: Partial<RetailerConfig>;
  globalCurrencies: GlobalCurrency[];
  onSave: () => void;
  onCancel: () => void;
  onDelete: (id: number) => void;
}

export default function RetailerConfigEditor({ 
  initialRetailer, 
  globalCurrencies, 
  onSave, 
  onCancel, 
  onDelete 
}: RetailerConfigEditorProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  
  const [draftConfig, setDraftConfig] = useState<Partial<RetailerConfig>>(initialRetailer);
  const { execute: runSaveRetailer, isLoading: isSavingRetailer } = useAsyncAction();
  const [showRemap, setShowRemap] = useState(false);
  const [remapUrl, setRemapUrl] = useState('');
  const [isRemapping, setIsRemapping] = useState(false);

  /**
   * Re-runs AI auto-mapping against a product URL (issue #74).
   *
   * The previous way to fix a bad retailer configuration was to delete the
   * retailer and re-scrape a product through it, because auto-mapping only fires
   * for an unknown domain or a shell config.
   */
  const handleRemap = async () => {
    setIsRemapping(true);
    try {
      const res = await RetailerAdminService.remapRetailer(remapUrl.trim());
      showToast('Retailer re-mapped from that page', 'success');
      setShowRemap(false);
      setRemapUrl('');
      onSave();
      void res;
    } catch (err) {
      showToast(apiErrorMessage(err) || 'Auto-mapping failed', 'error');
    } finally {
      setIsRemapping(false);
    }
  };
  const { execute: runTestConfig, isLoading: isTestingConfig } = useAsyncAction();
  const { execute: runDeleteRetailer } = useAsyncAction();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [forceNameRemoval, setForceNameRemoval] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  // Form draft states for arrays/JSON
  const [draftPriceSelectors, setDraftPriceSelectors] = useState<string[]>([]);
  const [draftRetailerNameSelectors, setDraftRetailerNameSelectors] = useState<string[]>([]);
  const [draftDealPriceSelectors, setDraftDealPriceSelectors] = useState<string[]>([]);
  const [draftMemberPriceSelectors, setDraftMemberPriceSelectors] = useState<string[]>([]);
  const [draftOriginalPriceSelectors, setDraftOriginalPriceSelectors] = useState<string[]>([]);
  const [draftPreOrderPriceSelectors, setDraftPreOrderPriceSelectors] = useState<string[]>([]);
  const [draftTitleSelectors, setDraftTitleSelectors] = useState<string[]>([]);
  const [draftImageSelectors, setDraftImageSelectors] = useState<string[]>([]);
  const [draftExclusionSelectors, setDraftExclusionSelectors] = useState<string[]>([]);
  const [draftStockSelectors, setDraftStockSelectors] = useState<string[]>([]);
  const [draftInStockPhrases, setDraftInStockPhrases] = useState<string[]>([]);
  const [draftOutOfStockPhrases, setDraftOutOfStockPhrases] = useState<string[]>([]);
  const [draftPreOrderPhrases, setDraftPreOrderPhrases] = useState<string[]>([]);
  const [draftCustomSelectorsJson, setDraftCustomSelectorsJson] = useState('');
  const [draftAiPriceSelectors, setDraftAiPriceSelectors] = useState<string[]>([]);
  const [draftAiImageSelectors, setDraftAiImageSelectors] = useState<string[]>([]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    engine: false,
    selectors_product: false,
    selectors_pricing: false,
    selectors_pruning: false,
    phrases: false,
    tester: false,
    ai_selectors: false,
  });

  const toggleSection = (name: string) => {
    setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    setDraftConfig(initialRetailer);
    setForceNameRemoval(false);
    setDraftPriceSelectors(initialRetailer.price_selectors || []);
    setDraftRetailerNameSelectors(initialRetailer.retailer_name_selectors || []);
    setDraftDealPriceSelectors(initialRetailer.deal_price_selectors || []);
    setDraftMemberPriceSelectors(initialRetailer.member_price_selectors || []);
    setDraftOriginalPriceSelectors(initialRetailer.original_price_selectors || []);
    setDraftPreOrderPriceSelectors(initialRetailer.pre_order_price_selectors || []);
    setDraftTitleSelectors(initialRetailer.name_selectors || []);
    setDraftImageSelectors(initialRetailer.image_selectors || []);
    setDraftExclusionSelectors(initialRetailer.exclusion_selectors || []);
    setDraftStockSelectors(initialRetailer.stock_selectors || []);
    setDraftInStockPhrases(initialRetailer.in_stock_phrases || []);
    setDraftOutOfStockPhrases(initialRetailer.out_of_stock_phrases || []);
    setDraftPreOrderPhrases(initialRetailer.pre_order_phrases || []);
    setDraftCustomSelectorsJson(initialRetailer.custom_selectors ? JSON.stringify(initialRetailer.custom_selectors, null, 2) : '');
    setDraftAiPriceSelectors(initialRetailer.ai_selectors?.price || []);
    setDraftAiImageSelectors(initialRetailer.ai_selectors?.image || []);
  }, [initialRetailer]);

  const handleUpdateDraft = (updates: Partial<RetailerConfig>) => {
    setDraftConfig(prev => ({ ...prev, ...updates }));
  };

  const handleSaveRetailer = () => runSaveRetailer(async () => {
    if (!draftConfig?.domain) {
      showToast('Domain is required', 'error');
      throw new Error('Domain is required');
    }
    
    let customObj = null;
    if (draftCustomSelectorsJson) {
      try { customObj = JSON.parse(draftCustomSelectorsJson); } 
      catch (e) {
        throw new Error('Invalid JSON in Advanced Selectors');
      }
    }

    await RetailerAdminService.upsertRetailer({
      ...draftConfig,
      forceNameRemoval,
      price_selectors: draftPriceSelectors,
      retailer_name_selectors: draftRetailerNameSelectors,
      deal_price_selectors: draftDealPriceSelectors,
      member_price_selectors: draftMemberPriceSelectors,
      original_price_selectors: draftOriginalPriceSelectors,
      pre_order_price_selectors: draftPreOrderPriceSelectors,
      name_selectors: draftTitleSelectors,
      image_selectors: draftImageSelectors,
      exclusion_selectors: draftExclusionSelectors,
      stock_selectors: draftStockSelectors,
      in_stock_phrases: draftInStockPhrases, 
      out_of_stock_phrases: draftOutOfStockPhrases, 
      pre_order_phrases: draftPreOrderPhrases,
      custom_selectors: customObj,
      ai_selectors: {
        price: draftAiPriceSelectors,
        image: draftAiImageSelectors
      }
    });
    onSave();
  }, { onSuccessMessage: 'Retailer configuration saved', onErrorFallback: 'Failed to save configuration' });

  const handleDeleteRetailer = () => runDeleteRetailer(async () => {
    if (!draftConfig.id) return;
    await RetailerAdminService.deleteRetailer(draftConfig.id);
    onDelete(draftConfig.id);
  }, { onSuccessMessage: 'Retailer configuration deleted', onErrorFallback: 'Failed to delete configuration' });

  const handleTestConfig = () => runTestConfig(async () => {
    if (!testUrl || !draftConfig) return;
    setTestResult(null);
    
    const config = {
      ...draftConfig,
      price_selectors: draftPriceSelectors,
      deal_price_selectors: draftDealPriceSelectors,
      member_price_selectors: draftMemberPriceSelectors,
      original_price_selectors: draftOriginalPriceSelectors,
      pre_order_price_selectors: draftPreOrderPriceSelectors,
      name_selectors: draftTitleSelectors,
      image_selectors: draftImageSelectors,
      exclusion_selectors: draftExclusionSelectors,
      stock_selectors: draftStockSelectors,
      in_stock_phrases: draftInStockPhrases, 
      out_of_stock_phrases: draftOutOfStockPhrases, 
      pre_order_phrases: draftPreOrderPhrases,
      ai_selectors: {
        price: draftAiPriceSelectors,
        image: draftAiImageSelectors
      }
    };
    
    const res = await RetailerAdminService.testRetailerConfig(config, testUrl);
    setTestResult(res);
  }, { onErrorMessage: 'Live test failed' });

  return (
    <div className="settings-card" style={{ borderLeft: '4px solid var(--primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ margin: 0 }}>{draftConfig.id ? 'Modify' : 'Initialize'} Retailer</h3>
        {draftConfig.id && (
          <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>
            Delete Permanent
          </button>
        )}
      </div>

      <ConfirmationModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteRetailer}
        title="Delete Retailer"
        message={`Are you sure you want to delete ${draftConfig.domain}? This will permanently remove all scraping configurations for this domain.`}
        confirmText="Permanently Delete"
        isDanger={true}
      />
      
      <div className="retailer-editor-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draftConfig.name || draftConfig.domain || 'New retailer'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draftConfig.domain}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowRemap(true)}
            disabled={!draftConfig.domain}
            title="Regenerate this retailer's selectors from a product page"
          >
            Re-run auto-map
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Discard</button>
          <button className="btn btn-primary btn-sm" onClick={handleSaveRetailer} disabled={isSavingRetailer}>
            {isSavingRetailer ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {showRemap && (
        <div className="settings-card" style={{ border: '1px solid var(--primary)', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>Re-run auto-mapping</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.75rem', maxWidth: '70ch' }}>
            Regenerates this retailer's selectors by reading a real product page. A
            product URL is required &mdash; a home page has no price to learn from.
            The generated configuration replaces what is saved here.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="url"
              className="form-control"
              style={{ flex: 1, minWidth: '260px' }}
              value={remapUrl}
              onChange={e => setRemapUrl(e.target.value)}
              placeholder={`https://${draftConfig.domain || 'example.com'}/product/...`}
            />
            <button className="btn btn-primary" onClick={() => void handleRemap()} disabled={isRemapping || !remapUrl.trim()}>
              {isRemapping ? 'Mapping...' : 'Run'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowRemap(false)} disabled={isRemapping}>Cancel</button>
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="form-group">
          <label>Primary Domain</label>
          <input 
            type="text" 
            className="form-control" 
            value={draftConfig.domain || ''} 
            onChange={e => handleUpdateDraft({ domain: e.target.value })} 
            placeholder="amazon.com.au" 
          />
        </div>
        <div className="form-group">
          <label>Retailer Friendly Name</label>
          <input 
            type="text" 
            className="form-control" 
            value={draftConfig.name || ''} 
            onChange={e => handleUpdateDraft({ name: e.target.value })} 
            placeholder="Amazon Australia" 
          />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Display Status</label>
          <input 
            type="text" 
            className="form-control" 
            value={draftConfig.status || ''} 
            onChange={e => handleUpdateDraft({ status: e.target.value })} 
            placeholder="OK" 
          />
        </div>
        <div className="form-group">
          <SearchableSelect
            label="Currency Hint"
            placeholder="None (Auto-detect)"
            options={[
              { label: 'None (Auto-detect)', value: '' },
              ...globalCurrencies.map(gc => ({
                label: `${gc.iso} (${gc.symbol})`,
                value: gc.iso,
                subLabel: gc.currency_name
              }))
            ]}
            value={draftConfig.currency_hint || ''}
            onChange={(val) => handleUpdateDraft({ currency_hint: val || null })}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Internal Notes / Description</label>
        <input 
          type="text" 
          className="form-control" 
          value={draftConfig.description || ''} 
          onChange={e => handleUpdateDraft({ description: e.target.value })} 
          placeholder="Used for internal reference..." 
        />
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '280px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Active Status</span>
            <ToggleSwitch 
              active={draftConfig.active !== false} 
              onToggle={() => handleUpdateDraft({ active: draftConfig.active === false })} 
            />
        </div>
        <div style={{ flex: '1', minWidth: '280px' }}>
            {!draftConfig.name && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={forceNameRemoval} onChange={e => setForceNameRemoval(e.target.checked)} />
              Allow name removal (Clear friendly name on save)
            </label>
          )}
        </div>
      </div>

      <SettingsCacheNotice compact />

      <div style={{ marginTop: '2rem' }}>
        <CollapsibleCard title="Page acquisition" leadingIcon={<Icon name="globe" />} id="engine" expandedSections={expandedSections} onToggle={toggleSection}>
          <ScraperEngineSection 
            draftConfig={draftConfig} 
            onUpdateConfig={handleUpdateDraft} 
          />
        </CollapsibleCard>

        <CollapsibleCard title="Product information" leadingIcon={<Icon name="fileText" />} id="selectors_product" expandedSections={expandedSections} onToggle={toggleSection}>
          <ExtractionParamsSection
            draftConfig={draftConfig}
            onUpdateConfig={handleUpdateDraft}
            titleSelectors={draftTitleSelectors}
            setTitleSelectors={setDraftTitleSelectors}
            retailerNameSelectors={draftRetailerNameSelectors}
            setRetailerNameSelectors={setDraftRetailerNameSelectors}
            priceSelectors={draftPriceSelectors}
            setPriceSelectors={setDraftPriceSelectors}
            dealPriceSelectors={draftDealPriceSelectors}
            setDealPriceSelectors={setDraftDealPriceSelectors}
            memberPriceSelectors={draftMemberPriceSelectors}
            setMemberPriceSelectors={setDraftMemberPriceSelectors}
            originalPriceSelectors={draftOriginalPriceSelectors}
            setOriginalPriceSelectors={setDraftOriginalPriceSelectors}
            preOrderPriceSelectors={draftPreOrderPriceSelectors}
            setPreOrderPriceSelectors={setDraftPreOrderPriceSelectors}
            imageSelectors={draftImageSelectors}
            setImageSelectors={setDraftImageSelectors}
            exclusionSelectors={draftExclusionSelectors}
            setExclusionSelectors={setDraftExclusionSelectors}
            customSelectorsJson={draftCustomSelectorsJson}
            setCustomSelectorsJson={setDraftCustomSelectorsJson}
            part="product"
          />
          <FieldHelp>Title, image and the JSON-LD keys they are read from. Retailer identity is the shop, not the manufacturer.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Pricing" leadingIcon={<Icon name="tag" />} id="selectors_pricing" expandedSections={expandedSections} onToggle={toggleSection}>
          <ExtractionParamsSection
            draftConfig={draftConfig}
            onUpdateConfig={handleUpdateDraft}
            titleSelectors={draftTitleSelectors}
            setTitleSelectors={setDraftTitleSelectors}
            retailerNameSelectors={draftRetailerNameSelectors}
            setRetailerNameSelectors={setDraftRetailerNameSelectors}
            priceSelectors={draftPriceSelectors}
            setPriceSelectors={setDraftPriceSelectors}
            dealPriceSelectors={draftDealPriceSelectors}
            setDealPriceSelectors={setDraftDealPriceSelectors}
            memberPriceSelectors={draftMemberPriceSelectors}
            setMemberPriceSelectors={setDraftMemberPriceSelectors}
            originalPriceSelectors={draftOriginalPriceSelectors}
            setOriginalPriceSelectors={setDraftOriginalPriceSelectors}
            preOrderPriceSelectors={draftPreOrderPriceSelectors}
            setPreOrderPriceSelectors={setDraftPreOrderPriceSelectors}
            imageSelectors={draftImageSelectors}
            setImageSelectors={setDraftImageSelectors}
            exclusionSelectors={draftExclusionSelectors}
            setExclusionSelectors={setDraftExclusionSelectors}
            customSelectorsJson={draftCustomSelectorsJson}
            setCustomSelectorsJson={setDraftCustomSelectorsJson}
            part="pricing"
          />
          <FieldHelp>Only the standard price becomes the tracked price. Original / RRP is a reference value and is never saved as it.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="False-positive prevention" leadingIcon={<Icon name="ban" />} id="selectors_pruning" expandedSections={expandedSections} onToggle={toggleSection}>
          <ExtractionParamsSection
            draftConfig={draftConfig}
            onUpdateConfig={handleUpdateDraft}
            titleSelectors={draftTitleSelectors}
            setTitleSelectors={setDraftTitleSelectors}
            retailerNameSelectors={draftRetailerNameSelectors}
            setRetailerNameSelectors={setDraftRetailerNameSelectors}
            priceSelectors={draftPriceSelectors}
            setPriceSelectors={setDraftPriceSelectors}
            dealPriceSelectors={draftDealPriceSelectors}
            setDealPriceSelectors={setDraftDealPriceSelectors}
            memberPriceSelectors={draftMemberPriceSelectors}
            setMemberPriceSelectors={setDraftMemberPriceSelectors}
            originalPriceSelectors={draftOriginalPriceSelectors}
            setOriginalPriceSelectors={setDraftOriginalPriceSelectors}
            preOrderPriceSelectors={draftPreOrderPriceSelectors}
            setPreOrderPriceSelectors={setDraftPreOrderPriceSelectors}
            imageSelectors={draftImageSelectors}
            setImageSelectors={setDraftImageSelectors}
            exclusionSelectors={draftExclusionSelectors}
            setExclusionSelectors={setDraftExclusionSelectors}
            customSelectorsJson={draftCustomSelectorsJson}
            setCustomSelectorsJson={setDraftCustomSelectorsJson}
            part="pruning"
          />
          <FieldHelp>Removed from the page before extraction runs. Carousels and related products are the usual source of a price belonging to a different item.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Availability" leadingIcon={<Icon name="package" />} id="phrases" expandedSections={expandedSections} onToggle={toggleSection}>
          <StockPhrasesSection 
            stockSelectors={draftStockSelectors}
            setStockSelectors={setDraftStockSelectors}
            inStockPhrases={draftInStockPhrases}
            setInStockPhrases={setDraftInStockPhrases}
            outOfStockPhrases={draftOutOfStockPhrases}
            setOutOfStockPhrases={setDraftOutOfStockPhrases}
            preOrderPhrases={draftPreOrderPhrases}
            setPreOrderPhrases={setDraftPreOrderPhrases}
          />
        </CollapsibleCard>

        <CollapsibleCard title="AI Preprocessor Selectors" leadingIcon={<Icon name="cpu" />} id="ai_selectors" expandedSections={expandedSections} onToggle={toggleSection}>
          <AISelectorsSection 
            draftAiPriceSelectors={draftAiPriceSelectors}
            setDraftAiPriceSelectors={setDraftAiPriceSelectors}
            draftAiImageSelectors={draftAiImageSelectors}
            setDraftAiImageSelectors={setDraftAiImageSelectors}
          />
        </CollapsibleCard>

        <CollapsibleCard title="Validation" leadingIcon={<Icon name="flask" />} id="tester" isExpanded={expandedSections.tester} onToggle={toggleSection}>
          <ScrapeValidationHub 
            testUrl={testUrl}
            setTestUrl={setTestUrl}
            onTest={handleTestConfig}
            isTesting={isTestingConfig}
            testResult={testResult}
            userLocale={user?.locale ?? undefined}
            showToast={showToast}
          />
        </CollapsibleCard>
      </div>

    </div>
  );
}
