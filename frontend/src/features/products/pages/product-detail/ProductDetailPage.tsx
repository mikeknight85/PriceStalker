import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from '../../../../layouts/Layout';
import DashboardTabs from '../../components/DashboardTabs';
import PriceSelectionModal from '../../components/PriceSelectionModal';
import ConfirmationModal from '../../../../components/ConfirmationModal';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import { useAuth } from '../../../auth';
import { useProductDetailState } from '../../hooks/useProductDetailState';
import { REFRESH_INTERVALS } from '../../constants';

import OverviewSection from './OverviewSection';
import PriceHistorySection from './PriceHistorySection';
import StockAvailabilitySection from './StockAvailabilitySection';
import NotificationSettingsSection from './NotificationSettingsSection';
import AdvancedSettingsSection from './AdvancedSettingsSection';

import './ProductDetail.css';

interface ProductDetailProps {
  productIdProp?: number;
  onBack?: () => void;
  onDeleted?: (id: number) => void;
  onUpdated?: (id: number, data: any) => void;
  hideLayout?: boolean;
}

export default function ProductDetail({ productIdProp, onBack, onDeleted, onUpdated, hideLayout = false }: ProductDetailProps = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (productIdProp === undefined && id) {
      navigate(`/?product=${id}`, { replace: true });
    }
  }, [id, productIdProp, navigate]);
  
  const activeSection = searchParams.get('section') || 'overview';

  const handleSectionChange = (section: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('section', section);
    setSearchParams(nextParams);
  };

  const productId = productIdProp !== undefined ? productIdProp : parseInt(id || '0', 10);
  
  const state = useProductDetailState(productId, onBack, onDeleted, onUpdated);



  if (state.isLoading) {
    if (hideLayout) {
      return <LoadingSpinner centered size="3rem" />;
    }

    return (
      <Layout>
        <LoadingSpinner centered size="3rem" />
      </Layout>
    );
  }

  if (state.error || !state.product) {
    const errorContent = (
      <>
        <div className="alert alert-error">{state.error || 'Product not found'}</div>
        {onBack ? (
          <button onClick={onBack} className="btn btn-secondary mt-3">
            Back to Product List
          </button>
        ) : (
          <Link to="/" className="btn btn-secondary mt-3">
            Back to Dashboard
          </Link>
        )}
      </>
    );

    if (hideLayout) {
      return <div style={{ padding: '2rem' }}>{errorContent}</div>;
    }

    return (
      <Layout>
        {errorContent}
      </Layout>
    );
  }

  const content = (
    <>
      {hideLayout && onBack && (
        <div className="inline-detail-header" style={{ marginBottom: '1.5rem' }}>
          <button 
            onClick={onBack} 
            className="btn btn-secondary" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem'
            }}
          >
            <span>←</span> Back to Product List
          </button>
        </div>
      )}

      <select
        className="detail-section-select"
        value={activeSection}
        onChange={(e) => handleSectionChange(e.target.value)}
      >
        <option value="overview">Overview</option>
        <option value="chart">Price History</option>
        <option value="stock">Stock Availability</option>
        <option value="notifications">Notifications</option>
        <option value="settings">Advanced Settings</option>
      </select>

      <div className="detail-section-tabs">
        <button 
          onClick={() => handleSectionChange('overview')}
          className={`btn-detail-tab ${activeSection === 'overview' ? 'active' : ''}`}
        >
          Overview
        </button>
        <button 
          onClick={() => handleSectionChange('chart')}
          className={`btn-detail-tab ${activeSection === 'chart' ? 'active' : ''}`}
        >
          Price History
        </button>
        <button 
          onClick={() => handleSectionChange('stock')}
          className={`btn-detail-tab ${activeSection === 'stock' ? 'active' : ''}`}
        >
          Stock Availability
        </button>
        <button 
          onClick={() => handleSectionChange('notifications')}
          className={`btn-detail-tab ${activeSection === 'notifications' ? 'active' : ''}`}
        >
          Notifications
        </button>
        <button 
          onClick={() => handleSectionChange('settings')}
          className={`btn-detail-tab ${activeSection === 'settings' ? 'active' : ''}`}
        >
          Advanced Settings
        </button>
      </div>

      {activeSection === 'overview' && (
        <OverviewSection 
          product={state.product}
          user={user}
          state={state}
          REFRESH_INTERVALS={REFRESH_INTERVALS}
        />
      )}

      {activeSection === 'chart' && (
        <PriceHistorySection 
          product={state.product}
          prices={state.prices}
          handleRangeChange={state.handleRangeChange}
          user={user}
        />
      )}

      {activeSection === 'stock' && (
        <StockAvailabilitySection productId={productId} />
      )}

      {activeSection === 'notifications' && (
        <NotificationSettingsSection 
          notificationSettings={state.notificationSettings}
          priceDropThreshold={state.priceDropThreshold}
          setPriceDropThreshold={state.setPriceDropThreshold}
          targetPrice={state.targetPrice}
          setTargetPrice={state.setTargetPrice}
          notifyBackInStock={state.notifyBackInStock}
          setNotifyBackInStock={state.setNotifyBackInStock}
          handleSaveNotifications={state.handleSaveNotifications}
          isSavingNotifications={state.isSavingNotifications}
        />
      )}

      {activeSection === 'settings' && (
        <AdvancedSettingsSection 
          isAdvancedCollapsed={state.isAdvancedCollapsed}
          setIsAdvancedCollapsed={state.setIsAdvancedCollapsed}
          checkingPaused={state.checkingPaused}
          setCheckingPaused={state.setCheckingPaused}
          aiExtractionDisabled={state.aiExtractionDisabled}
          setAiExtractionDisabled={state.setAiExtractionDisabled}
          aiVerificationDisabled={state.aiVerificationDisabled}
          setAiVerificationDisabled={state.setAiVerificationDisabled}
          handleSaveNotifications={state.handleSaveNotifications}
          isSavingNotifications={state.isSavingNotifications}
        />
      )}

      <ConfirmationModal
        isOpen={state.showDeleteConfirm}
        onClose={() => state.setShowDeleteConfirm(false)}
        onConfirm={() => state.handleDelete()}
        isLoading={state.isRefreshing}
        title="Stop Tracking Product"
        message={`Are you sure you want to stop tracking "${state.product.name || 'this product'}"? This will permanently delete its history.`}
        confirmText="Stop Tracking"
        isDanger={true}
      />

      <PriceSelectionModal
        isOpen={state.showPriceModal}
        onClose={state.handlePriceModalClose}
        onSelect={state.handlePriceSelected}
        productName={state.priceReviewData?.name || null}
        imageUrl={state.priceReviewData?.imageUrl || null}
        candidates={state.priceReviewData?.priceCandidates || []}
        url={state.priceReviewData?.url || ''}
        category={state.product.category || null}
        reviewReason={state.priceReviewData?.reviewReason}
      />
    </>
  );

  if (hideLayout) {
    return <div className="inline-product-detail">{content}</div>;
  }

  return (
    <Layout>
      <DashboardTabs />
      {content}
    </Layout>
  );
}
