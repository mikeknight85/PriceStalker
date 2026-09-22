import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../../../pages/Dashboard';
import { productListQuery, profileQuery } from '../../../api/queries';

export const Route = createFileRoute('/_authenticated/products/')({
  validateSearch: (search): { tag?: string } => ({ tag: typeof search.tag === 'string' && search.tag.length > 0 ? search.tag : undefined }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(productListQuery());
    void context.queryClient.prefetchQuery(profileQuery());
  },
  component: Dashboard,
});
