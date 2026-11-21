import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import ErrorBoundary from '../../../../components/ErrorBoundary';
import { useItemDetail } from './ItemDetailContext';
import ItemOverviewSection from './ItemOverviewSection';
import ItemPriceHistorySection from './ItemPriceHistorySection';
import ItemStockSection from './ItemStockSection';
import ItemNotificationsSection from './ItemNotificationsSection';
import Icon from '../../../../components/Icon';
import './ItemDetail.css';

export type ItemDetailSectionName = 'overview' | 'chart' | 'stock' | 'notifications';

const sectionPaths: Record<ItemDetailSectionName, '' | '/history' | '/stock' | '/notifications'> = {
  overview: '',
  chart: '/history',
  stock: '/stock',
  notifications: '/notifications',
};

export const ItemDetailSection: React.FC<{ section: ItemDetailSectionName }> = ({ section }) => {
  const navigate = useNavigate();
  const {
    itemId,
    item,
    user,
    historySeries,
    historyDays,
    setHistoryDays,
    refetchItem,
    handleRefreshListing,
    handleRefreshAll,
    handleDetachListing,
    handleDeleteListing,
    handleAttachStore,
    handleSaveName,
    handleSaveImage,
    handleSaveTags,
    handleSaveNotifications,
  } = useItemDetail();

  if (!item) return null;

  const changeSection = (next: ItemDetailSectionName) => {
    navigate({
      to: `/items/$itemId${sectionPaths[next]}`,
      params: { itemId: String(itemId) },
    });
  };

  return (
    <div className="item-detail-container">
      <div className="item-detail-nav">
        <Link
          to="/products"
          search={{ view: 'items' }}
          className="item-detail-back-link"
          onClick={() => {
            try {
              localStorage.setItem('pricestalker.dashboard.view', 'items');
            } catch {
              // ignore
            }
          }}
        >
          ← Back to Products
        </Link>
      </div>

      <select
        className="detail-section-select"
        value={section}
        onChange={e => changeSection(e.target.value as ItemDetailSectionName)}
      >
        <option value="overview">Overview & Stores</option>
        <option value="chart">Combined Price History</option>
        <option value="stock">Stock Availability</option>
        <option value="notifications">Alert Settings</option>
      </select>

      <div className="detail-section-tabs">
        <button
          type="button"
          onClick={() => changeSection('overview')}
          className={`btn-detail-tab ${section === 'overview' ? 'active' : ''}`}
        >
          <Icon name="package" /> Overview & Stores
        </button>
        <button
          type="button"
          onClick={() => changeSection('chart')}
          className={`btn-detail-tab ${section === 'chart' ? 'active' : ''}`}
        >
          <Icon name="barChart" /> Combined Price History
        </button>
        <button
          type="button"
          onClick={() => changeSection('stock')}
          className={`btn-detail-tab ${section === 'stock' ? 'active' : ''}`}
        >
          <Icon name="checkCircle" /> Stock Availability
        </button>
        <button
          type="button"
          onClick={() => changeSection('notifications')}
          className={`btn-detail-tab ${section === 'notifications' ? 'active' : ''}`}
        >
          <Icon name="bell" /> Alerts & Notifications
        </button>
      </div>

      {section === 'overview' && (
        <ErrorBoundary section="product overview">
          <ItemOverviewSection
            item={item}
            userLocale={user?.locale}
            onRefreshListing={handleRefreshListing}
            onRefreshAll={handleRefreshAll}
            onDetachListing={handleDetachListing}
            onDeleteListing={handleDeleteListing}
            onAttachStore={handleAttachStore}
            onSaveName={handleSaveName}
            onSaveImage={handleSaveImage}
            onSaveTags={handleSaveTags}
            onReload={refetchItem}
          />
        </ErrorBoundary>
      )}

      {section === 'chart' && (
        <ErrorBoundary section="product price history">
          <ItemPriceHistorySection
            item={item}
            series={historySeries}
            userLocale={user?.locale}
            selectedRange={historyDays}
            onRangeChange={setHistoryDays}
          />
        </ErrorBoundary>
      )}

      {section === 'stock' && (
        <ErrorBoundary section="product stock history">
          <ItemStockSection
            itemId={itemId}
            userLocale={user?.locale}
          />
        </ErrorBoundary>
      )}

      {section === 'notifications' && (
        <ErrorBoundary section="product alerts">
          <ItemNotificationsSection
            item={item}
            onSave={handleSaveNotifications}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default ItemDetailSection;
