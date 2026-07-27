import { createRootRouteWithContext, Navigate, Outlet } from '@tanstack/react-router';
import ErrorBoundary from '../components/ErrorBoundary';
import type { RouterContext } from '../router';

function RootLayout() {
  return (
    <ErrorBoundary section="this page">
      <Outlet />
    </ErrorBoundary>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <Navigate to="/products" replace />,
});
