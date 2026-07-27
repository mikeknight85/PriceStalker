import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import ProductDetail from '../../../../pages/ProductDetail';

function validProductId(value: string): boolean {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

export const Route = createFileRoute('/_authenticated/products/$productId')({
  beforeLoad: ({ params }) => {
    if (!validProductId(params.productId)) throw redirect({ to: '/products', replace: true });
  },
  component: () => <ProductDetail productId={Number(Route.useParams().productId)}><Outlet /></ProductDetail>,
});
