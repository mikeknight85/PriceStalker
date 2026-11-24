import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../../../pages/Dashboard';
import { productListQuery, profileQuery } from '../../../api/queries';

export const Route = createFileRoute('/_authenticated/products/')({
  validateSearch: (search): { tag?: string; view?: 'items' | 'all' } => ({
    tag: typeof search.tag === 'string' && search.tag.length > 0 ? search.tag : undefined,
    view: search.view === 'items' || search.view === 'all' ? search.view : undefined,
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(productListQuery());
    void context.queryClient.prefetchQuery(profileQuery());
  },
  component: Dashboard,
});
