import { createFileRoute } from '@tanstack/react-router';
import { ItemDetailSection } from '../../../../features/products';

export const Route = createFileRoute('/_authenticated/items/$itemId/')({
  component: () => <ItemDetailSection section="overview" />,
});
