import { createFileRoute } from '@tanstack/react-router';
import Login from '../../pages/Login';

export const Route = createFileRoute('/_public/login')({
  validateSearch: (search): { redirect?: string; local?: string } => ({ redirect: typeof search.redirect === 'string' ? search.redirect : undefined, local: typeof search.local === 'string' ? search.local : undefined }),
  component: Login,
});
