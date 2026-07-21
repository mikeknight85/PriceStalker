/**
 * @feature Products
 * @description Public API for Products feature (Dashboard, Details, Charts)
 */

export { default as Dashboard } from './pages/dashboard/DashboardPage';
export { default as ProductDetail } from './pages/product-detail/ProductDetailPage';
export * from './services/ProductService';
export * from './hooks/useDashboardState';
export * from './hooks/useProductDetailState';
export * from './hooks/useProductActions';
