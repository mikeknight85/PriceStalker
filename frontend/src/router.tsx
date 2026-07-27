import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import LoadingSpinner from './components/LoadingSpinner';
import type { AuthContextType } from './features/auth/context/AuthContext';

export interface RouterContext {
  auth: AuthContextType;
}

export const router = createRouter({
  routeTree,
  context: { auth: undefined! },
  defaultPreload: 'intent',
  defaultPendingComponent: () => <LoadingSpinner fullPage size="3rem" />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
