import { useState, useEffect } from 'react';
import { AdminSystemService } from '../../services/AdminSystemService';
import { useToast } from '../../../../context/ToastContext';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import {
  CollapsibleCard,
  UnifiedSelectorManager,
  SettingsCacheNotice,
  RuleGroup,
  PriorityNote,
  FieldHelp
} from '../../components';
import Icon from '../../../../components/Icon';
import { queryClient } from '../../../../api/queryClient';
import { adminSystemSettingsQuery, queryKeys } from '../../../../api/queries';

export default function GlobalSelectorsSection() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Global Selector states
  const [globalPriceSelectors, setGlobalPriceSelectors] = useState<string[]>([]);
  const [globalDealPriceSelectors, setGlobalDealPriceSelectors] = useState<string[]>([]);
  const [globalMemberPriceSelectors, setGlobalMemberPriceSelectors] = useState<string[]>([]);
  const [globalOriginalPriceSelectors, setGlobalOriginalPriceSelectors] = useState<string[]>([]);
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
      const res = await queryClient.fetchQuery(adminSystemSettingsQuery());
      const settings = res;
      
      try { setGlobalPriceSelectors(JSON.parse(settings.generic_price_selectors || '[]')); } catch { setGlobalPriceSelectors([]); }
      try { setGlobalDealPriceSelectors(JSON.parse(settings.generic_deal_price_selectors || '[]')); } catch { setGlobalDealPriceSelectors([]); }
      try { setGlobalMemberPriceSelectors(JSON.parse(settings.generic_member_price_selectors || '[]')); } catch { setGlobalMemberPriceSelectors([]); }
      try { setGlobalOriginalPriceSelectors(JSON.parse(settings.generic_original_price_selectors || '[]')); } catch { setGlobalOriginalPriceSelectors([]); }
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
        generic_original_price_selectors: JSON.stringify(globalOriginalPriceSelectors),
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

      const updated = await AdminSystemService.updateSystemSettings(payload);
      queryClient.setQueryData(queryKeys.adminSystemSettings, updated);
      showToast('Extraction rules saved', 'success');
    } catch {
      showToast('Failed to save extraction rules', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner centered />;

  return (
    <div className="settings-card">
      <h2 className="settings-card-title">Extraction Rules</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '-0.75rem', marginBottom: '1rem', maxWidth: '70ch' }}>
        Fallbacks used when a retailer has no site-specific rules of its own.
      </p>

      <PriorityNote
        label="Rule priority"
        steps={['Retailer rules', 'These default rules', 'Built-in fallbacks']}
      />

      <SettingsCacheNotice />

      <RuleGroup
        title="Product information"
        description="What is being tracked, and which shop it came from."
      >
        <CollapsibleCard title="Product title" leadingIcon={<Icon name="fileText" />} id="sys_sel_name" badge={String(globalNameSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Product title selectors" items={globalNameSelectors} onChange={setGlobalNameSelectors} placeholder="h1, .product-name" />
          <FieldHelp>Identifies the product being tracked.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Retailer identity" leadingIcon={<Icon name="building" />} id="sys_sel_retailer" badge={String(globalRetailerNameSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Retailer identity selectors" items={globalRetailerNameSelectors} onChange={setGlobalRetailerNameSelectors} placeholder="meta[property='og:site_name']" />
          <FieldHelp>
            Identifies the shop, not the product manufacturer. Brand selectors do not
            belong here: they make a store take the first scraped product's brand as
            its name.
          </FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Product image" leadingIcon={<Icon name="image" />} id="sys_sel_image" badge={String(globalImageSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Product image selectors" items={globalImageSelectors} onChange={setGlobalImageSelectors} placeholder="img.product" />
          <FieldHelp>Identifies the main product image. Relative and protocol-relative URLs are resolved against the product page.</FieldHelp>
        </CollapsibleCard>
      </RuleGroup>

      <RuleGroup
        title="Pricing"
        description="Only the current price becomes the product's tracked price. The others are recorded alongside it."
      >
        <CollapsibleCard title="Current price" leadingIcon={<Icon name="search" />} id="sys_sel_price" badge={String(globalPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Current price selectors" items={globalPriceSelectors} onChange={setGlobalPriceSelectors} placeholder=".price, #price" />
          <FieldHelp>The price saved as the product's tracked price.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Sale / deal price" leadingIcon={<Icon name="tag" />} id="sys_sel_deal" badge={String(globalDealPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Sale / deal price selectors" items={globalDealPriceSelectors} onChange={setGlobalDealPriceSelectors} placeholder=".price-item--sale" />
          <FieldHelp>A public promotional price. Takes priority over the current price when found.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Member price" leadingIcon={<Icon name="users" />} id="sys_sel_member" badge={String(globalMemberPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Member price selectors" items={globalMemberPriceSelectors} onChange={setGlobalMemberPriceSelectors} placeholder=".member-price" />
          <FieldHelp>A loyalty or account-holder price. Recorded separately and never used as the all-time low.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Pre-order price" leadingIcon={<Icon name="clock" />} id="sys_sel_preorder" badge={String(globalPreOrderPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Pre-order price selectors" items={globalPreOrderPriceSelectors} onChange={setGlobalPreOrderPriceSelectors} placeholder=".preorder-price" />
          <FieldHelp>A price for an item not yet released.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Original / RRP price" leadingIcon={<Icon name="tag" />} id="sys_sel_original" badge={String(globalOriginalPriceSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Original / RRP selectors" items={globalOriginalPriceSelectors} onChange={setGlobalOriginalPriceSelectors} placeholder=".rrp, .was-price" />
          <FieldHelp>
            Reference price only; never saved as the tracked price. Generic RRP
            patterns match strikethrough prices anywhere on the page, including
            unrelated products in carousels, so prefer per-retailer selectors and
            keep this list short.
          </FieldHelp>
        </CollapsibleCard>
      </RuleGroup>

      <RuleGroup
        title="Availability"
        description="Stock is read from page evidence first, then from the wording found inside it. Prefer buy buttons, stock badges and availability elements over broad selectors."
      >
        <CollapsibleCard title="Stock evidence" leadingIcon={<Icon name="package" />} id="sys_sel_stock" badge={String(globalStockSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Stock evidence selectors" items={globalStockSelectors} onChange={setGlobalStockSelectors} placeholder=".stock-status, .availability" />
          <FieldHelp>Where availability text or purchase controls are found.</FieldHelp>
        </CollapsibleCard>

        <CollapsibleCard title="Status phrases" leadingIcon={<Icon name="fileText" />} id="sys_phrases" badge={String(globalInStockPhrases.length + globalOutOfStockPhrases.length + globalPreOrderPhrases.length) + ' total'} expandedSections={expandedSections} onToggle={toggleSection}>
          <PriorityNote
            label="Detection order"
            steps={['Member only', 'Pre-order', 'Out of stock', 'In stock']}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <CollapsibleCard title="In stock" leadingIcon={<Icon name="checkCircle" />} id="sys_phr_instock" badge={String(globalInStockPhrases.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
              <UnifiedSelectorManager label="In-stock phrases" items={globalInStockPhrases} onChange={setGlobalInStockPhrases} placeholder="in stock, available" />
            </CollapsibleCard>

            <CollapsibleCard title="Out of stock" leadingIcon={<Icon name="xCircle" />} id="sys_phr_outofstock" badge={String(globalOutOfStockPhrases.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
              <UnifiedSelectorManager label="Out-of-stock phrases" items={globalOutOfStockPhrases} onChange={setGlobalOutOfStockPhrases} placeholder="out of stock, sold out" />
            </CollapsibleCard>

            <CollapsibleCard title="Pre-order" leadingIcon={<Icon name="clock" />} id="sys_phr_preorder" badge={String(globalPreOrderPhrases.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
              <UnifiedSelectorManager label="Pre-order phrases" items={globalPreOrderPhrases} onChange={setGlobalPreOrderPhrases} placeholder="pre-order, preorder" />
            </CollapsibleCard>
          </div>
          <FieldHelp>Specific states take priority over generic "available" text.</FieldHelp>
        </CollapsibleCard>
      </RuleGroup>

      <RuleGroup
        title="False-positive prevention"
        description="Regions removed from the page before price and stock extraction runs."
      >
        <CollapsibleCard title="Exclusion selectors" leadingIcon={<Icon name="ban" />} id="sys_sel_exclusion" badge={String(globalExclusionSelectors.length) + ' items'} expandedSections={expandedSections} onToggle={toggleSection}>
          <UnifiedSelectorManager label="Exclusion selectors" items={globalExclusionSelectors} onChange={setGlobalExclusionSelectors} placeholder=".ad-container, .carousel" />
          <FieldHelp>Removes adverts, related products and carousels, which are the usual source of a price belonging to a different item.</FieldHelp>
        </CollapsibleCard>
      </RuleGroup>

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={fetchSelectorData}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveSelectors} disabled={isSaving}>Save rules</button>
      </div>
    </div>
  );
}
