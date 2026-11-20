import { createFileRoute } from '@tanstack/react-router';
import { ItemDetailSection } from '../../../../features/products/pages/item-detail';

export const Route = createFileRoute('/_authenticated/items/$itemId/stock')({
  component: () => <ItemDetailSection section="stock" />,
});
