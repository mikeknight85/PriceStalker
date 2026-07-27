import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';
const sections = ['system', 'selectors', 'retailers', 'users', 'ai', 'logs', 'tokens', 'auth'] as const;
function AdminLayout() {
  const { auth } = Route.useRouteContext();
  if (!auth.user?.is_admin) return <Navigate to="/products" replace />;
  return <Outlet />;
}
export const Route = createFileRoute('/_authenticated/admin')({
  validateSearch: (search): { tab?: (typeof sections)[number]; retailer?: string } => ({
    tab: typeof search.tab === 'string' && sections.includes(search.tab as (typeof sections)[number]) ? search.tab as (typeof sections)[number] : undefined,
    retailer: typeof search.retailer === 'string' && search.retailer.length > 0 ? search.retailer : undefined,
  }),
  component: AdminLayout,
});
