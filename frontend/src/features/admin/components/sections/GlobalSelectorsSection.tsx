import { useState, useEffect } from 'react';
import { AdminSystemService } from '../../services/AdminSystemService';
import { useToast } from '../../../../context/ToastContext';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { 
  CollapsibleCard, 
  UnifiedSelectorManager 
} from '../../components';
import Icon from '../../../../components/Icon';

export default function GlobalSelectorsSection() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Global Selector states
  const [globalPriceSelectors, setGlobalPriceSelectors] = useState<string[]>([]);
  const [globalDealPriceSelectors, setGlobalDealPriceSelectors] = useState<string[]>([]);
  const [globalMemberPriceSelectors, setGlobalMemberPriceSelectors] = useState<string[]>([]);
  const [globalPreOrderPriceSelectors, setGlobalPreOrderPriceSelectors] = useState<string[]>([]);
  const [globalNameSelectors, setGlobalNameSelectors] = useState<string[]>([]);
  const [globalRetailerNameSelectors, setGlobalRetailerNameSelectors] = useState<string[]>([]);
  const [globalImageSelectors, setGlobalImageSelectors] = useState<string[]>([]);
  const [globalStockSelectors, setGlobalStockSelectors] = useState<string[]>([]);
  const [globalExclusionSelectors, setGlobalExclusionSelectors] = useState<string[]>([]);

  // Global Phrase states
  const [globalInStockPhrases, setGlobalInStockPhrases] = useState<string[]>([]);
  const [globalOutOfStockPhrases, setGlobalOutOfStockPhrases] = useState<string[]>([]);
  const [globalPreOrderPhrases, setGlobalPreOrderPhrases] = useState<string[]>([]);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sys_sel_price: false,
    sys_sel_deal: false,
    sys_sel_member: false,
    sys_sel_preorder: false,
    sys_sel_name: false,
    sys_sel_retailer: false,
    sys_sel_image: false,
    sys_sel_stock: false,
    sys_sel_exclusion: false,
    sys_phrases: false,
    sys_phr_instock: false,
    sys_phr_outofstock: false,
    sys_phr_preorder: false
  });

  const toggleSection = (name: string) => {
    setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  useEffect(() => {
    fetchSelectorData();
  }, []);

  const fetchSelectorData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminSystemService.getSystemSettings();
      const settings = res.data;
      
      try { setGlobalPriceSelectors(JSON.parse(settings.generic_price_selectors || '[]')); } catch { setGlobalPriceSelectors([]); }
      try { setGlobalDealPriceSelectors(JSON.parse(settings.generic_deal_price_selectors || '[]')); } catch { setGlobalDealPriceSelectors([]); }
      try { setGlobalMemberPriceSelectors(JSON.parse(settings.generic_member_price_selectors || '[]')); } catch { setGlobalMemberPriceSelectors([]); }
      try { setGlobalPreOrderPriceSelectors(JSON.parse(settings.generic_pre_order_price_selectors || '[]')); } catch { setGlobalPreOrderPriceSelectors([]); }
      try { setGlobalNameSelectors(JSON.parse(settings.generic_name_selectors || '[]')); } catch { setGlobalNameSelectors([]); }
      try { setGlobalRetailerNameSelectors(JSON.parse(settings.generic_retailer_name_selectors || '[]')); } catch { setGlobalRetailerNameSelectors([]); }
      try { setGlobalImageSelectors(JSON.parse(settings.generic_image_selectors || '[]')); } catch { setGlobalImageSelectors([]); }
      try { setGlobalStockSelectors(JSON.parse(settings.generic_stock_selectors || '[]')); } catch { setGlobalStockSelectors([]); }
      try { setGlobalExclusionSelectors(JSON.parse(settings.generic_exclusion_selectors || '[]')); } catch { setGlobalExclusionSelectors([]); }

      try { setGlobalInStockPhrases(JSON.parse(settings.generic_in_stock_phrases || '[]')); } catch { setGlobalInStockPhrases([]); }
      try { setGlobalOutOfStockPhrases(JSON.parse(settings.generic_out_of_stock_phrases || '[]')); } catch { setGlobalOutOfStockPhrases([]); }
      try { setGlobalPreOrderPhrases(JSON.parse(settings.generic_pre_order_phrases || '[]')); } catch { setGlobalPreOrderPhrases([]); }
    } catch {
      showToast('Failed to load global selectors', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSelectors = async () => {
    setIsSaving(true);
    try {
      const payload = {
        generic_price_selectors: JSON.stringify(globalPriceSelectors),
        generic_deal_price_selectors: JSON.stringify(globalDealPriceSelectors),
        generic_member_price_selectors: JSON.stringify(globalMemberPriceSelectors),
        generic_pre_order_price_selectors: JSON.stringify(globalPreOrderPriceSelectors),
        generic_name_selectors: JSON.stringify(globalNameSelectors),
        generic_retailer_name_selectors: JSON.stringify(globalRetailerNameSelectors),
        generic_image_selectors: JSON.stringify(globalImageSelectors),
        generic_stock_selectors: JSON.stringify(globalStockSelectors),
        generic_exclusion_selectors: JSON.stringify(globalExclusionSelectors),
        generic_in_stock_phrases: JSON.stringify(globalInStockPhrases),
        generic_out_of_stock_phrases: JSON.stringify(globalOutOfStockPhrases),
        generic_pre_order_phrases: JSON.stringify(globalPreOrderPhrases),
      };

      await AdminSystemService.updateSystemSettings(payload);
      showToast('Global selectors saved successfully', 'success');
    } catch {
      showToast('Failed to save selectors', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner centered />;

  return (
    <div className="settings-card">
      <h2 className="settings-card-title">Global HTML Selector Configuration</h2>

      <CollapsibleCard title="Generic Price Selectors" leadingIcon={<Icon name="search" />} id="sys_sel_price" badge={String(globalPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Price Selectors" items={globalPriceSelectors} onChange={setGlobalPriceSelectors} placeholder=".price, #price" />
      </CollapsibleCard>

      <CollapsibleCard title="Deal / Sale / Clearance Price Selectors" leadingIcon={<Icon name="tag" />} id="sys_sel_deal" badge={String(globalDealPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Deal / Sale / Clearance Price Selectors" items={globalDealPriceSelectors} onChange={setGlobalDealPriceSelectors} placeholder=".price-item--sale" />
      </CollapsibleCard>

      <CollapsibleCard title="Generic Member Price Selectors" leadingIcon={<Icon name="users" />} id="sys_sel_member" badge={String(globalMemberPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Member Price Selectors" items={globalMemberPriceSelectors} onChange={setGlobalMemberPriceSelectors} placeholder=".member-price" />
      </CollapsibleCard>

      <CollapsibleCard title="⏳ Generic Pre-Order Price Selectors" id="sys_sel_preorder" badge={String(globalPreOrderPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Pre-Order Price Selectors" items={globalPreOrderPriceSelectors} onChange={setGlobalPreOrderPriceSelectors} placeholder=".preorder-price" />
      </CollapsibleCard>

      <CollapsibleCard title="Generic Name Selectors" leadingIcon={<Icon name="fileText" />} id="sys_sel_name" badge={String(globalNameSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Name Selectors" items={globalNameSelectors} onChange={setGlobalNameSelectors} placeholder="h1, .product-name" />
      </CollapsibleCard>

      <CollapsibleCard title="Generic Retailer Name Selectors" leadingIcon={<Icon name="building" />} id="sys_sel_retailer" badge={String(globalRetailerNameSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Retailer Name Selectors" items={globalRetailerNameSelectors} onChange={setGlobalRetailerNameSelectors} placeholder="meta[property='og:site_name']" />
      </CollapsibleCard>

      <CollapsibleCard title="Generic Image Selectors" leadingIcon={<Icon name="image" />} id="sys_sel_image" badge={String(globalImageSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Image Selectors" items={globalImageSelectors} onChange={setGlobalImageSelectors} placeholder="img.product" />
      </CollapsibleCard>

      <CollapsibleCard title="Generic Stock Selectors" leadingIcon={<Icon name="package" />} id="sys_sel_stock" badge={String(globalStockSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Stock Selectors" items={globalStockSelectors} onChange={setGlobalStockSelectors} placeholder=".stock-status, .availability" />
      </CollapsibleCard>

      <CollapsibleCard title="Generic Exclusion Selectors" leadingIcon={<Icon name="ban" />} id="sys_sel_exclusion" badge={String(globalExclusionSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
        <UnifiedSelectorManager label="Generic Exclusion Selectors" items={globalExclusionSelectors} onChange={setGlobalExclusionSelectors} placeholder=".ad-container, .carousel" />
      </CollapsibleCard>

      <CollapsibleCard title="Global Stock Phrases" leadingIcon={<Icon name="package" />} id="sys_phrases" badge={String(globalInStockPhrases.length + globalOutOfStockPhrases.length + globalPreOrderPhrases.length) + ' total'} expandedSections={expandedSections} onToggle={toggleSection}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <CollapsibleCard title="Generic In-Stock Phrases" leadingIcon={<Icon name="checkCircle" />} id="sys_phr_instock" badge={String(globalInStockPhrases.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
            <UnifiedSelectorManager label="Generic In-Stock Phrases" items={globalInStockPhrases} onChange={setGlobalInStockPhrases} placeholder="in stock, available" />
          </CollapsibleCard>

          <CollapsibleCard title="Generic Out-of-Stock Phrases" leadingIcon={<Icon name="xCircle" />} id="sys_phr_outofstock" badge={String(globalOutOfStockPhrases.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
            <UnifiedSelectorManager label="Generic Out-of-Stock Phrases" items={globalOutOfStockPhrases} onChange={setGlobalOutOfStockPhrases} placeholder="out of stock, sold out" />
          </CollapsibleCard>

          <CollapsibleCard title="Generic Pre-Order Phrases" leadingIcon={<Icon name="clock" />} id="sys_phr_preorder" badge={String(globalPreOrderPhrases.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
            <UnifiedSelectorManager label="Generic Pre-Order Phrases" items={globalPreOrderPhrases} onChange={setGlobalPreOrderPhrases} placeholder="pre-order, preorder" />
          </CollapsibleCard>
        </div>
      </CollapsibleCard>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={fetchSelectorData}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveSelectors} disabled={isSaving}>Save Selectors</button>
      </div>
    </div>
  );
}
