import { createFileRoute } from '@tanstack/react-router';
import Dashboard from '../../../pages/Dashboard';

export const Route = createFileRoute('/_authenticated/products/')({
  validateSearch: (search): { category?: string } => ({ category: typeof search.category === 'string' && search.category.length > 0 ? search.category : undefined }),
  component: Dashboard,
});
