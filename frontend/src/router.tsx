import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import LoadingSpinner from './components/LoadingSpinner';
import type { AuthContextType } from './features/auth/context/AuthContext';
import type { QueryClient } from '@tanstack/react-query';

export interface RouterContext {
  auth: AuthContextType;
  queryClient: QueryClient;
}

export const router = createRouter({
  routeTree,
  context: { auth: undefined!, queryClient: undefined! },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: () => <LoadingSpinner fullPage size="3rem" />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
