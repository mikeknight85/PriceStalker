import { Link, useNavigate } from '@tanstack/react-router';
import ErrorBoundary from '../../../../components/ErrorBoundary';
import { REFRESH_INTERVALS } from '../../constants';
import AdvancedSettingsSection from './AdvancedSettingsSection';
import NotificationSettingsSection from './NotificationSettingsSection';
import OverviewSection from './OverviewSection';
import PriceHistorySection from './PriceHistorySection';
import StockAvailabilitySection from './StockAvailabilitySection';
import { useProductDetail } from './ProductDetailContext';

export type ProductDetailSectionName = 'overview' | 'chart' | 'stock' | 'notifications' | 'settings';

const sectionPaths: Record<ProductDetailSectionName, '' | '/history' | '/stock' | '/notifications' | '/settings'> = {
  overview: '', chart: '/history', stock: '/stock', notifications: '/notifications', settings: '/settings',
};

export default function ProductDetailSection({ section }: { section: ProductDetailSectionName }) {
  const navigate = useNavigate();
  const { productId, state, user } = useProductDetail();
  const changeSection = (nextSection: ProductDetailSectionName) => navigate({
    to: `/products/$productId${sectionPaths[nextSection]}`,
    params: { productId: String(productId) },
  });

  return (
    <>
      <Link to="/products" className="btn btn-secondary" style={{ display: 'inline-flex', marginBottom: '1.5rem' }}>← Back to Products</Link>
      <select className="detail-section-select" value={section} onChange={(event) => changeSection(event.target.value as ProductDetailSectionName)}>
        <option value="overview">Overview</option><option value="chart">Price History</option><option value="stock">Stock Availability</option><option value="notifications">Notifications</option><option value="settings">Advanced Settings</option>
      </select>
      <div className="detail-section-tabs">
        <button onClick={() => changeSection('overview')} className={`btn-detail-tab ${section === 'overview' ? 'active' : ''}`}>Overview</button>
        <button onClick={() => changeSection('chart')} className={`btn-detail-tab ${section === 'chart' ? 'active' : ''}`}>Price History</button>
        <button onClick={() => changeSection('stock')} className={`btn-detail-tab ${section === 'stock' ? 'active' : ''}`}>Stock Availability</button>
        <button onClick={() => changeSection('notifications')} className={`btn-detail-tab ${section === 'notifications' ? 'active' : ''}`}>Notifications</button>
        <button onClick={() => changeSection('settings')} className={`btn-detail-tab ${section === 'settings' ? 'active' : ''}`}>Advanced Settings</button>
      </div>
      {section === 'overview' && <ErrorBoundary section="the overview"><OverviewSection product={state.product!} user={user} state={state} REFRESH_INTERVALS={REFRESH_INTERVALS} /></ErrorBoundary>}
      {section === 'chart' && <ErrorBoundary section="the price history"><PriceHistorySection product={state.product!} prices={state.prices} handleRangeChange={state.handleRangeChange} user={user} /></ErrorBoundary>}
      {section === 'stock' && <ErrorBoundary section="stock availability"><StockAvailabilitySection productId={productId} /></ErrorBoundary>}
      {section === 'notifications' && <ErrorBoundary section="notification settings"><NotificationSettingsSection notificationSettings={state.notificationSettings} priceDropThreshold={state.priceDropThreshold} setPriceDropThreshold={state.setPriceDropThreshold} targetPrice={state.targetPrice} setTargetPrice={state.setTargetPrice} notifyBackInStock={state.notifyBackInStock} setNotifyBackInStock={state.setNotifyBackInStock} handleSaveNotifications={state.handleSaveNotifications} isSavingNotifications={state.isSavingNotifications} /></ErrorBoundary>}
      {section === 'settings' && <ErrorBoundary section="advanced settings"><AdvancedSettingsSection isAdvancedCollapsed={state.isAdvancedCollapsed} setIsAdvancedCollapsed={state.setIsAdvancedCollapsed} checkingPaused={state.checkingPaused} setCheckingPaused={state.setCheckingPaused} aiExtractionDisabled={state.aiExtractionDisabled} setAiExtractionDisabled={state.setAiExtractionDisabled} aiVerificationDisabled={state.aiVerificationDisabled} setAiVerificationDisabled={state.setAiVerificationDisabled} handleSaveNotifications={state.handleSaveNotifications} isSavingNotifications={state.isSavingNotifications} /></ErrorBoundary>}
    </>
  );
}
