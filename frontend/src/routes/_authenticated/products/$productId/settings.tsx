import { createFileRoute } from '@tanstack/react-router';
import ProductDetailSection from '../../../../features/products/pages/product-detail/ProductDetailSection';
export const Route = createFileRoute('/_authenticated/products/$productId/settings')({ component: () => <ProductDetailSection section="settings" /> });
