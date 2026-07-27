import { createRootRoute, Navigate, Outlet } from '@tanstack/react-router';
import ErrorBoundary from '../components/ErrorBoundary';

function RootLayout() {
  return (
    <ErrorBoundary section="this page">
      <Outlet />
    </ErrorBoundary>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <Navigate to="/" replace />,
});
