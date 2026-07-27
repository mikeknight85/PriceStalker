import { createFileRoute, redirect } from '@tanstack/react-router';

function validProductId(id: string): number | undefined {
  const parsed = Number(id);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const Route = createFileRoute('/product/$id')({
  validateSearch: (search): { section?: 'overview' | 'chart' | 'stock' | 'notifications' | 'settings' } => ({
    section: typeof search.section === 'string' && ['overview', 'chart', 'stock', 'notifications', 'settings'].includes(search.section) ? search.section as 'overview' | 'chart' | 'stock' | 'notifications' | 'settings' : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    const productId = validProductId(params.id);
    if (!productId) throw redirect({ to: '/products', replace: true });
    const sectionPath = search.section === 'chart' ? '/history' : search.section === 'stock' ? '/stock' : search.section === 'notifications' ? '/notifications' : search.section === 'settings' ? '/settings' : '';
    throw redirect({ to: `/products/$productId${sectionPath}`, params: { productId: String(productId) }, replace: true });
  },
});
