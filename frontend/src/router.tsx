import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import LoadingSpinner from './components/LoadingSpinner';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: () => <LoadingSpinner fullPage size="3rem" />,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
