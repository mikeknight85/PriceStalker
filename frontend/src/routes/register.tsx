import { createFileRoute } from '@tanstack/react-router';
import Register from '../pages/Register';
import { PublicRoute } from './-guards';

export const Route = createFileRoute('/register')({
  validateSearch: (search): { redirect?: string } => ({ redirect: typeof search.redirect === 'string' ? search.redirect : undefined }),
  component: () => <PublicRoute><Register /></PublicRoute>,
});
