/**
 * @feature Products
 * @description Public API for Products feature (Dashboard, Details, Charts)
 */

export { default as Dashboard } from './pages/dashboard/DashboardPage';
export { default as AddProductPage } from './pages/dashboard/AddProductPage';
export { default as InsightsPage } from './pages/dashboard/InsightsPage';
export { default as ProductDetail } from './pages/product-detail/ProductDetailPage';
export { default as ItemDetailPage } from './pages/item-detail/ItemDetailPage';
export { default as ItemDetailSection } from './pages/item-detail/ItemDetailSection';
export * from './services/ProductService';
export * from './hooks/useDashboardState';
export * from './hooks/useProductDetailState';
export * from './hooks/useProductActions';
