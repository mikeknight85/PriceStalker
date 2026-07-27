import { Navigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../features/auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useRouterState({ select: (state) => state.location });

  if (isLoading) return <LoadingSpinner fullPage size="3rem" />;
  if (!user) return <Navigate to="/login" search={{ redirect: location.href }} replace />;

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullPage size="3rem" />;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}
