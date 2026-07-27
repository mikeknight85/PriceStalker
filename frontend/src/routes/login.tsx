import { createFileRoute } from '@tanstack/react-router';
import Login from '../pages/Login';
import { PublicRoute } from './-guards';

export const Route = createFileRoute('/login')({
  validateSearch: (search): { redirect?: string; local?: string } => ({ redirect: typeof search.redirect === 'string' ? search.redirect : undefined, local: typeof search.local === 'string' ? search.local : undefined }),
  component: () => <PublicRoute><Login /></PublicRoute>,
});
