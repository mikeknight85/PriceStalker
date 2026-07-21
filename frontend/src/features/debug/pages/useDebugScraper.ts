import { useState, useEffect } from 'react';
import { AdminSystemService, RetailerAdminService } from '../../admin';
import { ProductService } from '../../products/services/ProductService';
import { RetailerConfig, SystemSettings } from '../../../types/api';
import { useToast } from '../../../context/ToastContext';

export function useDebugScraper() {
  const { showToast } = useToast();
  
  // Scraper Controls State
  const [url, setUrl] = useState('');
  const [productIdInput, setProductIdInput] = useState('');
  const [mode, setMode] = useState<'normal' | 'simulate' | 'bypass'>('normal');
  const [returnHtml, setReturnHtml] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [forceAI, setForceAI] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Permissions
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);

  // History State
  const [recentUrls, setRecentUrls] = useState<{url: string, domain: string, timestamp: number}[]>([]);
  
  // Pre-fill / Override State
  const [isFetchingConfig] = useState(false);
  const [useOverride, setUseOverride] = useState(false);
  const [config, setConfig] = useState<Partial<RetailerConfig>>({});
  
  // Temp Selector States
  const [tempPriceSelectors, setTempPriceSelectors] = useState<string[]>([]);
  const [tempDealPriceSelectors, setTempDealPriceSelectors] = useState<string[]>([]);
  const [tempMemberPriceSelectors, setTempMemberPriceSelectors] = useState<string[]>([]);
  const [tempOriginalPriceSelectors, setTempOriginalPriceSelectors] = useState<string[]>([]);
  const [tempPreOrderPriceSelectors, setTempPreOrderPriceSelectors] = useState<string[]>([]);
  const [tempNameSelectors, setTempNameSelectors] = useState<string[]>([]);
  const [tempRetailerNameSelectors, setTempRetailerNameSelectors] = useState<string[]>([]);
  const [tempImageSelectors, setTempImageSelectors] = useState<string[]>([]);
  const [tempStockSelectors, setTempStockSelectors] = useState<string[]>([]);
  const [tempExclusionSelectors, setTempExclusionSelectors] = useState<string[]>([]);

  // Live Selector Testing
  const [liveSelector, setLiveSelector] = useState('');
  const [liveMatches, setLiveMatches] = useState<any[]>([]);

  // Live Selector Testing Logic
  useEffect(() => {
    if (!liveSelector || !result?.html) {
      setLiveMatches([]);
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(result.html, 'text/html');
      const elements = doc.querySelectorAll(liveSelector);
      const matches = Array.from(elements).slice(0, 10).map(el => ({
        tagName: el.tagName.toLowerCase(),
        text: el.textContent?.trim().substring(0, 100),
        html: el.innerHTML.substring(0, 200),
        attributes: Array.from(el.attributes).reduce((acc: any, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {})
      }));
      setLiveMatches(matches);
    } catch (e) {
      setLiveMatches([]);
    }
  }, [liveSelector, result?.html]);

  // 1. Initial Access Check & Load system settings
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await AdminSystemService.getDebugStatus();
        setIsEnabled(res.data.enabled);
      } catch {
        setIsEnabled(false);
      }
    };
    checkStatus();

    const fetchSystemSettings = async () => {
      try {
        const res = await AdminSystemService.getSystemSettings();
        setGlobalSettings(res.data);
      } catch (e) {
        console.error('Failed to fetch system settings', e);
      }
    };
    fetchSystemSettings();

    // Load history
    const saved = localStorage.getItem('debug_history');
    if (saved) {
      try {
        setRecentUrls(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse debug history', e);
      }
    }
  }, []);

  // 2. Sync history to localStorage
  useEffect(() => {
    if (recentUrls.length > 0) {
      localStorage.setItem('debug_history', JSON.stringify(recentUrls));
    }
  }, [recentUrls]);

  // 3. Pre-fill logic when override is enabled
  useEffect(() => {
    if (!useOverride || !globalSettings) return;

    const parseSelectors = (val?: string | string[]): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Fallback to comma separation
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    };

    setTempPriceSelectors(parseSelectors(globalSettings.generic_price_selectors));
    setTempNameSelectors(parseSelectors(globalSettings.generic_name_selectors));
    setTempImageSelectors(parseSelectors(globalSettings.generic_image_selectors));
    setTempDealPriceSelectors(parseSelectors(globalSettings.generic_deal_price_selectors));
    setTempMemberPriceSelectors(parseSelectors(globalSettings.generic_member_price_selectors));
    setTempOriginalPriceSelectors(parseSelectors(globalSettings.generic_original_price_selectors));
    setTempPreOrderPriceSelectors(parseSelectors(globalSettings.generic_pre_order_price_selectors));
    setTempRetailerNameSelectors(parseSelectors(globalSettings.generic_retailer_name_selectors));
    setTempStockSelectors(parseSelectors(globalSettings.generic_stock_selectors));
    setTempExclusionSelectors(parseSelectors(globalSettings.generic_exclusion_selectors));
    showToast('Pre-populated fields with system Global Selectors.');
  }, [useOverride, globalSettings]);

  // Reset selector states when override is toggled off
  useEffect(() => {
    if (!useOverride) {
      setTempPriceSelectors([]);
      setTempNameSelectors([]);
      setTempImageSelectors([]);
      setTempDealPriceSelectors([]);
      setTempMemberPriceSelectors([]);
      setTempOriginalPriceSelectors([]);
      setTempPreOrderPriceSelectors([]);
      setTempRetailerNameSelectors([]);
      setTempStockSelectors([]);
      setTempExclusionSelectors([]);
    }
  }, [useOverride]);

  // 4. Main Execution Logic
  const loadProductById = async () => {
    if (!productIdInput) return;
    const id = parseInt(productIdInput, 10);
    if (isNaN(id)) {
      showToast('Invalid Product ID', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await ProductService.getById(id);
      if (res.data && res.data.url) {
        setUrl(res.data.url);
        showToast(`Loaded product: ${res.data.name || res.data.url}`);
        
        // Optionally trigger config fetch if needed, 
        // but url change will likely be enough for the user to then click "Fetch Config" if that's a feature
        // Actually, let's auto-fetch config if override is enabled? 
        // No, let's keep it simple: just load the URL.
      }
    } catch (err: any) {
      showToast('Failed to load product: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const runExtraction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setResult(null);

    let processedUrl = url.trim();
    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = 'https://' + processedUrl;
    }

    try {
      const urlObj = new URL(processedUrl);
      const STRIP_LIST = [
        'utm_', 'affid', 'affiliate', 'ref', 'referrer', 'tag', 'fbclid', 'gclid', 'gbraid', 'wbraid',
        'spm', 'promo', 'promocode', 'coupon', 'discount', 'source', 'clickid', 'click_id', 'ncid',
        '_ga', '_gl', 'tracking', 'campaign', 'medium', 'session', 'igshid', 'zanpid', 'msclkid',
        'mc_cid', 'mc_eid', 'yclid', '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'rb_clickid',
        's_kwcid', 'bt_ee', 'bt_ts', 'irclickid', 'wickedid', 'twclid', 'ttclid', 'crid', 'sprefix',
        'qid', 'sr', 'dib', 'recently_viewed', 'reviews_redesign', 'queryid', 'objectid', 'indexname',
        'content-id', '_sid'
      ];
      const KEEP_LIST = [
        'store', 'location', 'region', 'postcode', 'state', 'suburb', 'city', 'country', 'site',
        'locale', 'lang', 'hl', 'currency',
        'sku', 'productid', 'variant', 'color', 'size', 'id', 'v', 'page', 'product', 'item',
        'model', 'ean', 'upc', 'dwvar_', 'pdp', 'option', 'pid', 'selectedcolor', 'style', 'th'
      ];

      // Trim trailing slash from pathname if it's not the root path
      if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.substring(0, urlObj.pathname.length - 1);
      }

      const paramsToDelete: string[] = [];
      urlObj.searchParams.forEach((_, key) => {
        const lowerKey = key.toLowerCase();
        const shouldStrip = STRIP_LIST.some(p => lowerKey.includes(p));
        const isEssential = KEEP_LIST.some(k => 
          lowerKey === k || 
          lowerKey.startsWith(k) || 
          lowerKey.includes('_' + k) ||
          lowerKey.includes(k + '_') || 
          lowerKey.endsWith('id') || 
          lowerKey.endsWith('pid')
        );
        if (shouldStrip || !isEssential) paramsToDelete.push(key);
      });
      paramsToDelete.forEach(p => urlObj.searchParams.delete(p));

      if (urlObj.hash) {
        const hashLower = urlObj.hash.toLowerCase();
        const hasEssentialHash = KEEP_LIST.some(k => hashLower.includes(k)) || hashLower.includes('pid');
        if (!hasEssentialHash) {
          urlObj.hash = '';
        }
      }

      processedUrl = urlObj.toString();
      setUrl(processedUrl);
    } catch {
      showToast('Please enter a valid URL', 'error');
      setIsLoading(false);
      return;
    }

    let finalConfig: Partial<RetailerConfig> | undefined = undefined;
    if (useOverride) {
      finalConfig = {
        ...config,
        price_selectors: tempPriceSelectors,
        deal_price_selectors: tempDealPriceSelectors,
        member_price_selectors: tempMemberPriceSelectors,
        original_price_selectors: tempOriginalPriceSelectors,
        pre_order_price_selectors: tempPreOrderPriceSelectors,
        name_selectors: tempNameSelectors,
        retailer_name_selectors: tempRetailerNameSelectors,
        image_selectors: tempImageSelectors,
        stock_selectors: tempStockSelectors,
        exclusion_selectors: tempExclusionSelectors,
      };
    }

    try {
      const res = await RetailerAdminService.debugExtract(processedUrl, finalConfig, mode, true, useAI, forceAI);
      setResult(res.data);
      
      // Save to history
      try {
        const urlObj = new URL(processedUrl);
        const domain = urlObj.hostname.replace('www.', '');
        setRecentUrls(prev => {
          const filtered = prev.filter(item => item.url !== processedUrl);
          return [{ url: processedUrl, domain, timestamp: Date.now() }, ...filtered].slice(0, 15);
        });
      } catch {}
      
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Failed to run extraction', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    state: {
      url, setUrl,
      productIdInput, setProductIdInput,
      mode, setMode,
      returnHtml, setReturnHtml,
      useAI, setUseAI,
      forceAI, setForceAI,
      isLoading,
      result, setResult,
      isEnabled,
      recentUrls,
      isFetchingConfig,
      useOverride, setUseOverride,
      config, setConfig,
      tempPriceSelectors, setTempPriceSelectors,
      tempDealPriceSelectors, setTempDealPriceSelectors,
      tempMemberPriceSelectors, setTempMemberPriceSelectors,
      tempOriginalPriceSelectors, setTempOriginalPriceSelectors,
      tempPreOrderPriceSelectors, setTempPreOrderPriceSelectors,
      tempNameSelectors, setTempNameSelectors,
      tempRetailerNameSelectors, setTempRetailerNameSelectors,
      tempImageSelectors, setTempImageSelectors,
      tempStockSelectors, setTempStockSelectors,
      tempExclusionSelectors, setTempExclusionSelectors,
      liveSelector, setLiveSelector,
      liveMatches, setLiveMatches
    },
    actions: {
      runExtraction,
      loadProductById
    }
  };
}
