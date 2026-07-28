import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../../../pages/Dashboard';
import { productListQuery, profileQuery } from '../../../api/queries';

export const Route = createFileRoute('/_authenticated/products/')({
  validateSearch: (search): { category?: string } => ({ category: typeof search.category === 'string' && search.category.length > 0 ? search.category : undefined }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(productListQuery());
    void context.queryClient.prefetchQuery(profileQuery());
  },
  component: Dashboard,
});
