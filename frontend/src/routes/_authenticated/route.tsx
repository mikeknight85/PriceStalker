import { createFileRoute, Navigate, Outlet, redirect, useRouterState } from '@tanstack/react-router';
import LoadingSpinner from '../../components/LoadingSpinner';

function AuthenticatedLayout() {
  const { auth } = Route.useRouteContext();
  const location = useRouterState({ select: (state) => state.location });
  if (auth.isLoading) return <LoadingSpinner fullPage size="3rem" />;
  if (!auth.user) return <Navigate to="/login" search={{ redirect: location.href }} replace />;
  return <Outlet />;
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isLoading && !context.auth.user) {
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true });
    }
  },
  component: AuthenticatedLayout,
});
