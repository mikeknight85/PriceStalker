import { createFileRoute, Navigate } from '@tanstack/react-router';
import { ProtectedRoute } from '../-guards';

function validProductId(id: string): number | undefined {
  const parsed = Number(id);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const Route = createFileRoute('/product/$id')({
  validateSearch: (search): { section?: 'overview' | 'chart' | 'stock' | 'notifications' | 'settings' } => ({
    section: typeof search.section === 'string' && ['overview', 'chart', 'stock', 'notifications', 'settings'].includes(search.section) ? search.section as 'overview' | 'chart' | 'stock' | 'notifications' | 'settings' : undefined,
  }),
  component: () => {
    const { id } = Route.useParams();
    const { section } = Route.useSearch();
    const productId = validProductId(id);

    return (
      <ProtectedRoute>
        <Navigate to="/" search={{ product: productId, section }} replace />
      </ProtectedRoute>
    );
  },
});
