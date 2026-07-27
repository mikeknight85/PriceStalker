import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';
import LoadingSpinner from '../../components/LoadingSpinner';

function PublicLayout() {
  const { auth } = Route.useRouteContext();
  if (auth.isLoading) return <LoadingSpinner fullPage size="3rem" />;
  if (auth.user) return <Navigate to="/products" replace />;
  return <Outlet />;
}

export const Route = createFileRoute('/_public')({ component: PublicLayout });
