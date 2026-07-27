import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';
function AdminLayout() {
  const { auth } = Route.useRouteContext();
  if (!auth.user?.is_admin) return <Navigate to="/products" replace />;
  return <Outlet />;
}
export const Route = createFileRoute('/_authenticated/admin')({
  validateSearch: (search): { retailer?: string } => ({
    retailer: typeof search.retailer === 'string' && search.retailer.length > 0 ? search.retailer : undefined,
  }),
  component: AdminLayout,
});
