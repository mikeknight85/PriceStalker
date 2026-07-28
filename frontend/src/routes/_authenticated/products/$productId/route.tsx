import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import ProductDetail from '../../../../pages/ProductDetail';
import { productDetailQuery, profileQuery } from '../../../../api/queries';

function validProductId(value: string): boolean {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

export const Route = createFileRoute('/_authenticated/products/$productId')({
  beforeLoad: ({ params }) => {
    if (!validProductId(params.productId)) throw redirect({ to: '/products', replace: true });
  },
  loader: ({ context, params }) => {
    const productId = Number(params.productId);
    void context.queryClient.prefetchQuery(productDetailQuery(productId));
    void context.queryClient.prefetchQuery(profileQuery());
  },
  component: () => <ProductDetail productId={Number(Route.useParams().productId)}><Outlet /></ProductDetail>,
});
