import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ItemDetailPage } from '../../../../features/products';
import { itemDetailQuery, profileQuery } from '../../../../api/queries';

function validItemId(value: string): boolean {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

function ItemDetailLayout() {
  const { itemId } = Route.useParams();
  return (
    <ItemDetailPage itemId={Number(itemId)}>
      <Outlet />
    </ItemDetailPage>
  );
}

export const Route = createFileRoute('/_authenticated/items/$itemId')({
  beforeLoad: ({ params }) => {
    if (!validItemId(params.itemId)) throw redirect({ to: '/products', replace: true });
  },
  loader: ({ context, params }) => {
    const itemId = Number(params.itemId);
    void context.queryClient.prefetchQuery(itemDetailQuery(itemId));
    void context.queryClient.prefetchQuery(profileQuery());
  },
  component: ItemDetailLayout,
});
